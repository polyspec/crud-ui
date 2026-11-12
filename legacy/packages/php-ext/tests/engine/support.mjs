import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { recordConformance } from '../../../../../tests/conformance/evidence.mts';

/*
 * A C string of the UTF-8 bytes of a value followed by a zero byte; a NUL character is a zero byte
 * in it. Text longer than the 4095 bytes ISO C requires of a string literal is a character array.
 */
export function cString(value) {
  const bytes = Buffer.from(value, 'utf8');
  const escape = byte => `\\${byte.toString(8).padStart(3, '0')}`;
  // Each element is a character constant: an integer above 127 does not fit a signed `char`, and
  // GCC rejects it with -Werror=overflow.
  if (bytes.length > 4000) return `((const char[]){${[...bytes, 0].map(byte => `'${escape(byte)}'`).join(',')}})`;
  return `"${[...bytes].map(escape).join('')}"`;
}

/* The same bytes as engine text with their explicit length. */
export function cText(value) {
  return `((ps_text)${cTextInitializer(value)})`;
}

/* Engine text as a brace initializer: a static table member must not be a compound literal. */
export function cTextInitializer(value) {
  return `{${cString(value)}, ${Buffer.byteLength(value, 'utf8')}}`;
}

export class EngineFixtureSource {
  #next = 0;
  lines = [];

  emit(value) {
    const name = `v${this.#next++}`;
    if (value === null) this.lines.push(`  ps_value *${name} = ps_null_value();`);
    else if (typeof value === 'boolean')
      this.lines.push(`  ps_value *${name} = ps_bool_value(${value});`);
    else if (typeof value === 'number' && Number.isSafeInteger(value))
      this.lines.push(`  ps_value *${name} = ps_int_value(INT64_C(${value}));`);
    else if (typeof value === 'number')
      // A C double literal: an integral JavaScript number prints without a decimal point,
      // which C would read as an integer literal and convert.
      this.lines.push(`  ps_value *${name} = ps_float_value(${/[.eE]|Infinity|NaN/.test(String(value)) ? value : `${value}.0`});`);
    else if (typeof value === 'string')
      this.lines.push(`  ps_value *${name} = ps_text_value_checked(${cText(value)});`);
    else if (Array.isArray(value)) {
      this.lines.push(`  ps_value *${name} = ps_array_value();`);
      // Repeated scalar values keep separate ownership without unrolling the same allocation into C source.
      if (value.length > 1 && (value[0] === null || typeof value[0] !== 'object') && value.every(item => Object.is(item, value[0]))) {
        const item = this.emit(value[0]);
        this.lines.push(`  for (size_t i_${name} = 0; i_${name} < ${value.length}; ++i_${name}) push(${name}, ps_value_clone(${item}));`);
        this.lines.push(`  ps_value_free(${item});`);
      } else {
        for (const item of value) this.lines.push(`  push(${name}, ${this.emit(item)});`);
      }
    } else {
      this.lines.push(`  ps_value *${name} = ps_object_value();`);
      for (const [key, item] of Object.entries(value))
        this.lines.push(`  put(${name}, ${cText(key)}, ${this.emit(item)});`);
    }
    return name;
  }
}

/* Shared C value builders; a program includes only the helpers it calls. */
/** @type {Array<[string, string[]]>} */
const fixtureHelpers = [
  ['crudui_locale_start', [
      '/*',
      ' * With CRUDUI_COMMA_LOCALE set, switch to the environment locale and prove that it writes and',
      ' * reads a comma decimal separator, so the checks that follow run under it.',
      ' */',
      'static void crudui_locale_start(void)',
      '{',
      '  if (!getenv("CRUDUI_COMMA_LOCALE")) return;',
      '  char text[16];',
      '  if (!setlocale(LC_ALL, "") || strcmp(localeconv()->decimal_point, ",") || strtod("1.5", NULL) == 1.5 ||',
      '      snprintf(text, sizeof(text), "%.1f", 1.5) != 3 || strcmp(text, "1,5"))',
      '  { fputs("the comma decimal locale is not active\\n", stderr); exit(98); }',
      '}',
  ]],
  ['put', [
      'static void put(ps_value *object, ps_text key, ps_value *value)',
      '{ if (!value || !ps_set_text(object, key, value)) { fputs("fixture allocation failed\\n", stderr); abort(); } }',
  ]],
  ['push', [
      'static void push(ps_value *array, ps_value *value)',
      '{ if (!value || !ps_append(array, value)) { fputs("fixture allocation failed\\n", stderr); abort(); } }',
  ]],
  ['ps_text_value_checked', [
      'static ps_value *ps_text_value_checked(ps_text text)',
      '{ ps_value *value = ps_text_value(text); if (!value) { fputs("fixture string allocation failed\\n", stderr); abort(); } return value; }',
  ]],
  ['text_is', [
      '/* A string value with exactly these bytes. */',
      'static bool text_is(const ps_value *value, ps_text text)',
      '{ return value && value->kind == PS_STRING && ps_text_equal(ps_string(value), text); }',
  ]],
  ['print_text', [
      '/* Write text with every byte, including NUL characters, to standard error. */',
      'static void print_text(const char *label, ps_text text)',
      '{ fputs(label, stderr); fwrite(text.bytes, 1, text.length, stderr); fputc(\'\\n\', stderr); }',
  ]],
  ['print_json', [
      'static void print_json(const char *label, const ps_value *value)',
      '{ ps_chars json = ps_json_string(value); print_text(label, json.bytes ? ps_view(json) : PS_TEXT("null")); free(json.bytes); }',
  ]],
];

/*
 * Per-case results of a fixture program. A program that reports cases declares
 * `int failed = 0;` first (caseProgramStart), runs each case in its own block that sets
 * `ok = 0` on a mismatch instead of returning, prints `crudui-case <id> pass|fail` with
 * caseReport and ends with caseProgramEnd, which exits with the first failing case id.
 */
export const caseProgramStart = ['  int failed = 0;'];

/*
 * The line that reports the case `id` of a fixture program passed, for a program that returns at
 * the first failing case: it runs at the end of the block of the case, so the reports name each
 * case that the program checked.
 */
export function casePassed(id) {
  return `  printf("crudui-case ${id} pass\\n"); fflush(stdout);`;
}

/*
 * Assert that the fixture program of `stdout` reported the cases 1 to `count`, each once or more:
 * the count is that of the cases the test read from a shared cases.json, so a case that the
 * program drops fails the assertion.
 */
export function assertCasesReported(stdout, count, message) {
  assert.deepEqual([...caseResults(stdout).keys()].sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index + 1), message);
}
export const caseProgramEnd = ['  return failed;'];
export function caseReport(id) {
  return [
    `  printf("crudui-case ${id} %s\\n", ok ? "pass" : "fail"); fflush(stdout);`,
    `  if (!ok && !failed) failed = ${id};`,
  ];
}

/**
 * Case results printed by a fixture program: id to passed. A case reported more than once
 * passes only when every report passed.
 */
export function caseResults(stdout) {
  const results = new Map();
  for (const [, id, state] of stdout.matchAll(/^crudui-case (\d+) (pass|fail)$/gm)) {
    results.set(Number(id), (results.get(Number(id)) ?? true) && state === 'pass');
  }
  return results;
}

/**
 * Record php-native conformance evidence for the cases of a fixture program. A case the
 * program did not report, because compilation failed or the program stopped, did not pass.
 */
export function recordCases(cases, stdout) {
  const results = caseResults(stdout);
  cases.forEach(({ features, fixture, name }, index) => {
    const passed = results.get(index + 1) === true;
    for (const feature of features) {
      recordConformance({ feature, fixture, runtime: 'php-native', case: name, passed });
    }
  });
}

export function fixtureProgram(body, declarations = [], { explicitLocale = false } = {}) {
  // A helper is included when the program or an included helper calls it; every program can run
  // under a comma decimal locale (commaLocaleEnvironment).
  let used = [...declarations, ...body, 'crudui_locale_start('].join('\n');
  const included = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, lines] of fixtureHelpers) {
      if (included.has(name) || !new RegExp(`\\b${name}\\(`).test(used)) continue;
      included.add(name);
      used += `\n${lines.join('\n')}`;
      changed = true;
    }
  }
  const helpers = fixtureHelpers
    .filter(([name]) => included.has(name))
    .flatMap(([, lines]) => lines);
  return [
    '#include "engine_internal.h"',
    '#include <locale.h>',
    '#include <stdio.h>',
    '#include <stdlib.h>',
    '#include <string.h>',
    '',
    ...helpers,
    '',
    ...declarations,
    'int main(void)',
    '{',
    ...(explicitLocale ? [] : ['  crudui_locale_start();']),
    ...body,
    '  return 0;',
    '}',
    '',
  ].join('\n');
}

/*
 * The environment of a program run under a locale whose decimal separator is a comma. The system
 * locale de_DE.UTF-8 is used when `locale -a` lists it, as on macOS; a toolchain without it gets a
 * locale compiled into the directory from a definition that sets only the numeric category.
 */
export async function commaLocaleEnvironment(directory, signal, { systemLocale = true, localedef = 'localedef' } = {}) {
  if (systemLocale) {
    const listed = await runStep('comma locale: listing', 'locale', ['-a'], { signal });
    if (/^de_DE\.UTF-8$/m.test(listed.stdout)) {
      return { ...process.env, CRUDUI_COMMA_LOCALE: '1', LC_ALL: 'de_DE.UTF-8' };
    }
  }
  const source = path.join(directory, 'comma-locale');
  const charmap = path.join(directory, 'ascii.charmap');
  const locales = path.join(directory, 'locales');
  await writeFile(source, 'LC_NUMERIC\ndecimal_point "<U002C>"\nthousands_sep "<U002E>"\ngrouping 3\nEND LC_NUMERIC\n');
  const characters = [];
  for (let code = 0; code < 128; code += 1) {
    const hex = code.toString(16).padStart(2, '0');
    characters.push(`<U00${hex.toUpperCase()}> /x${hex} CHARACTER ${code}`);
  }
  await writeFile(charmap, ['<code_set_name> CRUDUI-ASCII', '<comment_char> %', '<escape_char> /',
    '<mb_cur_min> 1', '<mb_cur_max> 1', 'CHARMAP', ...characters, 'END CHARMAP', ''].join('\n'));
  // Categories other than the numeric one are absent; -c writes the locale anyway, and localedef
  // then exits with status 1, the status of a locale written with warnings.
  await mkdir(locales, { recursive: true });
  const numeric = path.join(locales, 'crudui-comma', 'LC_NUMERIC');
  const compiled = await runStep('comma locale: compiling', localedef,
    ['-c', '--no-warnings=ascii', '-i', source, '-f', charmap, path.join(locales, 'crudui-comma')], {
      signal,
      outcome: ({ status }) => (status === 1 && existsSync(numeric) ? 'wrote the locale with warnings (exit 1)' : undefined),
    });
  await access(numeric)
    .catch(() => assert.fail(`localedef wrote no locale:\n${compiled.stderr}${compiled.stdout}`));
  assert.ok(compiled.status === 0 || compiled.status === 1,
    `localedef ended ${compiled.signal ? `on ${compiled.signal}` : `with status ${compiled.status}`}:\n${compiled.stderr}${compiled.stdout}`);
  return { ...process.env, CRUDUI_COMMA_LOCALE: '1', LOCPATH: locales, LC_ALL: 'crudui-comma' };
}

/* Compile and run a fixture program under a comma decimal locale. */
export async function runUnderCommaLocale({ signal, root, prefix, name, source, sources }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    const runEnvironment = await commaLocaleEnvironment(directory, signal);
    await compileAndRunEngineFixture({ signal, root, directory, source, sources, name, runEnvironment });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/*
 * Every test compiles and runs a C program, so each step reports its start, its
 * elapsed time and its result while it runs, and the test's own timeout aborts the
 * step it is in. A timeout only turns a fixture that does not end into a failure, so the
 * budgets hold the slowest fixture on a loaded machine: the values fixture took 23.7 s at a load
 * average of 45, and its sanitized run did not end within 54 s at a load average of 107, on an
 * 11-core macOS machine.
 */
export const ENGINE_TEST_BUDGET = 120000;
export const ENGINE_SANITIZER_BUDGET = 300000;
// Tests that only read repository files; measured at 20–70 ms together.
export const ENGINE_INSPECTION_BUDGET = 10000;
const PROGRESS_INTERVAL = 5000;

/**
 * Run one step of a fixture program, reporting progress until it finishes. `outcome` may name the
 * result of a status that the command defines as more than passed or failed.
 */
function runStep(label, command, args, { signal, env, outcome } = {}) {
  const started = Date.now();
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  process.stderr.write(`    ${label}: started\n`);
  const running = setInterval(
    () => process.stderr.write(`    ${label}: still running (${elapsed()})\n`), PROGRESS_INTERVAL);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: env ?? process.env, signal, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => { clearInterval(running); reject(error); });
    child.once('close', (status, closeSignal) => {
      clearInterval(running);
      const result = outcome?.({ status, signal: closeSignal }) ?? (status === 0 ? 'passed' : `failed (${closeSignal ?? status})`);
      process.stderr.write(`    ${label}: ${result} in ${elapsed()}\n`);
      resolve({ status, signal: closeSignal, stdout, stderr });
    });
  });
}

/*
 * Compile a C program with the named sources of legacy/packages/php-ext/src. Every C program
 * of these tests compiles here; the math library is linked because glibc keeps log10, ceil and
 * floor in libm, while macOS has them in its system library.
 */
export async function compileEngineProgram({ root, directory, program, sources, name,
  compilerFlags = [], signal }) {
  const executable = path.join(directory, name);
  const extensionSource = file => path.join(root, 'legacy/packages/php-ext/src', file);
  const compile = await runStep(`${name}: compiling ${sources.length} sources`,
    process.env.CC ?? 'cc', [
      '-std=c11', '-Wall', '-Wextra', '-Werror', '-pedantic',
      ...compilerFlags,
      '-I', path.join(root, 'legacy/packages/php-ext/src'),
      ...sources.map(extensionSource), program, '-o', executable, '-lm',
    ], { signal });
  assert.equal(compile.signal, null);
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  return { executable, name };
}

/** Run an engine program produced by this run's compilation. */
export async function runEngineProgram({ executable, name, runEnvironment, signal, onOutput }) {
  const run = await runStep(`${name}: running`, executable, [],
    { signal, env: runEnvironment ?? process.env });
  onOutput?.(run.stdout);
  assert.equal(run.signal, null, run.stderr || run.stdout);
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

/** Compile and run one engine program. */
export async function compileAndRunEngineProgram(options) {
  const prepared = await compileEngineProgram(options);
  await runEngineProgram({ ...options, ...prepared });
}

/** Write and compile a fixture for execution after the preparation hook. */
export async function compileEngineFixture({ directory, source, name, ...options }) {
  const program = path.join(directory, `${name}.c`);
  await writeFile(program, source);
  return compileEngineProgram({ ...options, directory, program, name });
}

/* Write a generated fixture program to the directory, then compile and run it. */
export async function compileAndRunEngineFixture({ directory, source, name, ...options }) {
  const program = path.join(directory, `${name}.c`);
  await writeFile(program, source);
  await compileAndRunEngineProgram({ ...options, directory, program, name });
}
