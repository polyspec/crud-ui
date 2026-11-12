import assert from 'node:assert/strict';
import { readFileSync, readdirSync, realpathSync, statSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { tmpdir } from 'node:os';

import { checkedFiles } from '@polyspec/kit/tracked-files';
import { createElement, type FunctionComponent } from 'react';
import { renderToString } from 'react-dom/server';
import { shapeOf } from '../../scripts/json-schema.mts';

const isRecord = shapeOf<Record<string, unknown>>({ type: 'object' });
import { parseJson, readJson, type JTDSchemaType } from '../json.mts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);

/** The fields of a package.json that the checks read; an export is a path or an object of conditions. */
interface PackageManifest {
  name: string;
  type?: string;
  types?: string;
  exports: Record<string, unknown>;
}
const packageSchema: JTDSchemaType<PackageManifest> = {
  properties: { name: { type: 'string' }, exports: { values: {} } },
  optionalProperties: { type: { type: 'string' }, types: { type: 'string' } },
  additionalProperties: true,
};
/** A package directory with its package.json. */
interface LoadedPackage { directory: string; manifest: PackageManifest }
/** The fields of contracts/features.json that the checks read. */
interface ContractManifest {
  packages: { name: string; path: string; entries: Record<string, { visibility: string; exports: string[] }> }[];
}
const contractSchema: JTDSchemaType<ContractManifest> = {
  properties: {
    packages: {
      elements: {
        properties: {
          name: { type: 'string' },
          path: { type: 'string' },
          entries: { values: { properties: { visibility: { type: 'string' }, exports: { elements: { type: 'string' } } }, additionalProperties: true } },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
};

/** The condition or subpath `key` of the export `exports`, an object of conditions; undefined for a path or a missing key. */
function condition(exports: unknown, key: string): unknown {
  return isRecord(exports) ? exports[key] : undefined;
}

/** The member `name` of the loaded module or object `loaded`. */
function member(loaded: unknown, name: string): unknown {
  assert.ok(typeof loaded === 'object' && loaded !== null, `${name} is read from an object`);
  return Reflect.get(loaded, name);
}

/** Whether `value` is a function; a test calls it with the arguments that its contract names. */
function isCallable(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/** The function `name` of the loaded module or object `loaded`, bound to it. */
function callable(loaded: unknown, name: string): (...args: unknown[]) => unknown {
  const value = member(loaded, name);
  assert.ok(isCallable(value), `${name} must be a function`);
  return (...args: unknown[]) => Reflect.apply(value, loaded, args);
}

/** The class `name` of the loaded module `loaded`: a function, which a test constructs with construct or names in instanceof. */
function classOf(loaded: unknown, name: string): Function {
  const value = member(loaded, name);
  assert.ok(typeof value === 'function', `${name} must be a class`);
  return value;
}

/** A new instance of the class `type` with `args`, constructed as `new` does (Reflect.construct). */
function construct(type: Function, ...args: unknown[]): object {
  const instance: unknown = Reflect.construct(type, args);
  assert.ok(typeof instance === 'object' && instance !== null, 'a class constructs an object');
  return instance;
}

/** Whether `value` is a React function component that takes the form props. */
function isFormComponent(value: unknown): value is FunctionComponent<{ form: unknown }> {
  return typeof value === 'function';
}

const load = (folder: string): LoadedPackage => {
  const directory = resolve(root, 'packages', folder);
  const manifest = readJson(resolve(directory, 'package.json'), packageSchema);
  return { directory, manifest };
};
const packages = ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react'].map(load);
// Packages that publish only an ES module: the browser validation binding runs only in a browser
// (docs/spec/form-runtime.md#browser-validation).
const moduleOnlyPackages = ['form-binding'].map(load);
// ES module packages whose declarations TypeScript resolves through the top-level types condition:
// generator-vue loads through its import and require exports, and generator-svelte through the
// svelte export of the Svelte toolchain.
const moduleDeclarationPackages = ['vue', 'svelte'].map(load);
const contract = readJson(resolve(root, 'contracts/features.json'), contractSchema);

test('ES module Vitest configurations declare their module format', () => {
  const failures = [];
  const packagesDirectory = resolve(root, 'packages');
  for (const entry of readdirSync(packagesDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(packagesDirectory, entry.name);
    const manifestPath = resolve(directory, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = readJson<{ type?: string }>(manifestPath, { optionalProperties: { type: { type: 'string' } }, additionalProperties: true });
    for (const filename of readdirSync(directory)) {
      if (!/^vitest(?:\.[^.]+)?\.config\.[cm]?[jt]s$/.test(filename)) continue;
      const source = readFileSync(resolve(directory, filename), 'utf8');
      if (!/^\s*(?:import|export)\s/m.test(source)) continue;
      if (/\.(?:mts|mjs)$/.test(filename) || manifest.type === 'module') continue;
      failures.push(relative(root, resolve(directory, filename)));
    }
  }
  assert.deepEqual(
    failures,
    [],
    'ES module Vitest configurations require .mts, .mjs or package type module',
  );
});

function within(directory: string, filename: string): boolean {
  const path = relative(directory, filename);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

function output(pkg: LoadedPackage, entry: unknown): string {
  assert.ok(typeof entry === 'string', `${pkg.manifest.name} must declare its output`);
  const path = realpathSync(resolve(pkg.directory, entry));
  assert.ok(within(resolve(pkg.directory, 'dist'), path), `${pkg.manifest.name} output must be in dist`);
  assert.ok(statSync(path).isFile(), `${pkg.manifest.name} output must be a file`);
  return path;
}

for (const mode of ['import', 'require']) {
  test(`public ${mode} exports execute the form instance API`, async () => {
    const modules: unknown[] = [];
    for (const pkg of packages) {
      const path = output(pkg, condition(pkg.manifest.exports['.'], mode));
      const resolved = mode === 'import'
        ? fileURLToPath(import.meta.resolve(pkg.manifest.name))
        : require.resolve(pkg.manifest.name);
      assert.equal(realpathSync(resolved), path);
      const loaded: unknown = mode === 'import' ? await import(pkg.manifest.name) : require(pkg.manifest.name);
      modules.push(loaded);
    }
    const [validator, core, htmlGenerator, generator] = modules;
    // Each internal entry is built beside its main entry and shares its chunks.
    const entryNames = async (name: string): Promise<[Record<string, unknown>, string[]]> => {
      const entry: unknown = mode === 'import' ? await import(name) : require(name);
      assert.ok(isRecord(entry), `${name} must load as an object`);
      return [entry, Object.keys(entry).filter(key => key !== 'default' && key !== '__esModule').sort()];
    };
    // The built internal entries export exactly what the contract manifest declares for them.
    const declared = parseJson(readFileSync(new URL('../../contracts/features.json', import.meta.url), 'utf8'), contractSchema, 'contracts/features.json');
    const internals = Object.fromEntries(declared.packages
      .filter(({ entries }) => entries['./internal'])
      .map(({ name, entries }): [string, string[]] => {
        const internal = entries['./internal'];
        assert.ok(internal);
        return [name, [...internal.exports].sort()];
      }));
    assert.deepEqual(Object.keys(internals).sort(), ['@polyspec/crudui-generator-core', '@polyspec/crudui-validator']);
    const loaded: Record<string, Record<string, unknown>> = {};
    for (const [name, expected] of Object.entries(internals)) {
      const pkg = packages.find(({ manifest }) => manifest.name === name);
      assert.ok(pkg, `${name} must be a public package`);
      const internalName = `${name}/internal`;
      const internalExport = pkg.manifest.exports['./internal'];
      assert.ok(isRecord(internalExport), `${name} must export ./internal with conditions`);
      const internalPath = output(pkg, internalExport[mode]);
      assert.equal(realpathSync(mode === 'import' ? fileURLToPath(import.meta.resolve(internalName)) : require.resolve(internalName)), internalPath);
      const [entry, names] = await entryNames(internalName);
      assert.deepEqual(names, expected, internalName);
      loaded[name] = entry;
    }
    assert.deepEqual((await entryNames('@polyspec/crudui-validator'))[1], ['ComposeLoadError', 'FormInputError', 'hiddenPaths', 'validate', 'validateDetail', 'validateList']);
    // An error raised inside the internal entry is the class the public entry exports.
    const MemoryLoader = classOf(loaded['@polyspec/crudui-validator'], 'MemoryLoader');
    const ComposeLoadError = classOf(validator, 'ComposeLoadError');
    assert.throws(() => callable(construct(MemoryLoader, {}), 'load')('missing.yml'), ComposeLoadError);
    assert.equal(member(core, 'ComposeLoadError'), ComposeLoadError);
    assert.equal(member(core, 'FormInputError'), member(validator, 'FormInputError'));
    for (const name of ['compileForm', 'createForm', 'createRowKey', 'sequenceRowKey']) {
      assert.equal(typeof member(core, name), 'function', `core.${name}`);
      assert.equal(member(generator, name), undefined, `react.${name} belongs to generator-core`);
    }
    const Form = member(generator, 'Form');
    assert.ok(isFormComponent(Form), 'react.Form must be a function');
    assert.equal(typeof member(htmlGenerator, 'renderList'), 'function');
    const spec = { type: 'group', properties: { name: { type: 'text' } } };
    const template = callable(core, 'compileForm')(spec);
    const session = callable(core, 'createForm')(template, { name: 'Build check' });
    assert.ok(session instanceof classOf(core, 'FormInstance'));
    assert.equal(member(session, 'template'), template);
    const data = callable(session, 'getData')();
    assert.deepEqual(data, { name: 'Build check' });
    const result = callable(validator, 'validate')(spec, data);
    assert.equal(typeof member(result, 'valid'), 'boolean');
    assert.ok(Array.isArray(member(result, 'errors')));
    const switched = { type: 'group', properties: { on: { type: 'text' }, name: { type: 'text', design: { show: '.on == "1"' } } } };
    const hiddenPaths = callable(validator, 'hiddenPaths');
    assert.deepEqual(hiddenPaths(switched, { on: '0', name: '' }), ['name']);
    assert.deepEqual(hiddenPaths(switched, { on: '1', name: '' }), []);
    const reactHtml = renderToString(createElement(Form, { form: session }));
    assert.match(reactHtml, /<input\b/);
    const html = callable(htmlGenerator, 'renderForm')(session);
    assert.ok(typeof html === 'string', 'renderForm must return the HTML text');
    assert.match(html, /<input\b/);
  });
}

test('ES module packages load through their import export only', async () => {
  for (const pkg of moduleOnlyPackages) {
    const name = pkg.manifest.name;
    const path = realpathSync(fileURLToPath(import.meta.resolve(name)));
    assert.ok(within(resolve(pkg.directory, 'dist'), path) && statSync(path).isFile(), `${name} must load from a file in dist`);
    const declared = contract.packages.find((entry) => entry.name === name)?.entries['.']?.exports;
    assert.ok(declared, `contracts/features.json must declare the "." entry of ${name}`);
    const loaded: unknown = await import(name);
    assert.ok(isRecord(loaded), `${name} must load as an object`);
    assert.deepEqual(Object.keys(loaded).sort(), [...declared].sort(), name);
    assert.throws(() => require.resolve(name), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }, `${name} must not declare a CommonJS entry`);
  }
});

const tsc = resolve(root, 'node_modules/.bin/tsc');

/**
 * Compiles `files` with the tsc of the root and `compilerOptions`, from a tsconfig.json in a temporary directory, in one
 * run of `tsc --noEmit --listFiles --pretty false`: the exit status, the output, and the real paths of the files of the
 * program, which --listFiles prints one per line beside the diagnostics (`<file>(<line>,<column>): error TS<code>: ...`,
 * continued on indented lines) and the error count.
 */
function compile(compilerOptions: Record<string, unknown>, files: string[]): { status: number | null; log: string; program: Set<string> } {
  const temporary = mkdtempSync(resolve(tmpdir(), 'crudui-public-types-'));
  try {
    const config = resolve(temporary, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({ compilerOptions: { ...compilerOptions, noEmit: true }, files }));
    const run = spawnSync(tsc, ['--project', config, '--listFiles', '--pretty', 'false'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.error, undefined);
    const listed = run.stdout.split('\n').filter((line) => line !== '' && !/^\s/.test(line) && !/^\S.*\(\d+,\d+\): error TS\d+:/.test(line) && !/^Found \d+ errors?/.test(line));
    const program = new Set(listed.map((file) => realpathSync(resolve(root, file))));
    return { status: run.status, log: run.stdout + run.stderr, program };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

const declarationOptions = { strict: true, skipLibCheck: false, types: [], target: 'es2022', lib: ['es2022', 'dom', 'dom.iterable'] };

test('public type entries and their declaration graph compile in ESM and CommonJS', () => {
  const fixtures = ['public-types.mts', 'public-types.cts'].map((file) => resolve(root, 'tests/build', file));
  const { status, log, program } = compile({ ...declarationOptions, module: 'nodenext', moduleResolution: 'nodenext' }, fixtures);
  assert.equal(status, 0, log);
  for (const pkg of packages) {
    const declared = output(pkg, pkg.manifest.types);
    assert.equal(output(pkg, condition(pkg.manifest.exports['.'], 'types')), declared);
    assert.ok(program.has(declared), `${pkg.manifest.name} must compile from ${relative(root, declared)}`);
  }
  // An ES module package, and one with a top-level types condition that loads through its import and require
  // exports, declares its types in ES module format: package.json names the type module.
  for (const pkg of [...moduleOnlyPackages, ...moduleDeclarationPackages]) {
    assert.equal(pkg.manifest.type, 'module', `${pkg.manifest.name} declarations must be in ES module format`);
  }
  for (const pkg of moduleOnlyPackages) {
    const conditions = condition(pkg.manifest.exports['.'], 'import');
    assert.ok(isRecord(conditions), `${pkg.manifest.name} must declare import conditions`);
    assert.ok(program.has(output(pkg, conditions['types'])), `${pkg.manifest.name} must compile from its import types`);
  }
  const vue = moduleDeclarationPackages.find(({ manifest }) => manifest.name === '@polyspec/crudui-generator-vue');
  assert.ok(vue);
  assert.equal(output(vue, condition(vue.manifest.exports['.'], 'types')), output(vue, vue.manifest.types));
  assert.ok(program.has(output(vue, vue.manifest.types)), `${vue.manifest.name} must compile from its types`);
  assertDeclarationsOnly(program);
});

test('an ES module only package resolves no types for a CommonJS project', () => {
  const fixture = resolve(root, 'tests/build/module-only-require.cts');
  const { status, log } = compile({ ...declarationOptions, module: 'nodenext', moduleResolution: 'nodenext' }, [fixture]);
  assert.notEqual(status, 0);
  for (const pkg of moduleOnlyPackages) {
    assert.equal(condition(pkg.manifest.exports['.'], 'require'), undefined, `${pkg.manifest.name} must not declare a CommonJS entry`);
    assert.ok(log.includes(`error TS2307: Cannot find module '${pkg.manifest.name}'`), log);
  }
});

test('the generator-svelte types compile as a Svelte project resolves them', () => {
  const pkg = moduleDeclarationPackages.find(({ manifest }) => manifest.name === '@polyspec/crudui-generator-svelte');
  assert.ok(pkg);
  const fixture = resolve(root, 'tests/build/public-types-svelte.mts');
  const { status, log, program } = compile({ ...declarationOptions, module: 'esnext', moduleResolution: 'bundler' }, [fixture]);
  assert.equal(status, 0, log);
  const declared = output(pkg, pkg.manifest.types);
  assert.equal(output(pkg, condition(pkg.manifest.exports['.'], 'types')), declared);
  assert.ok(program.has(declared), `${pkg.manifest.name} must compile from ${relative(root, declared)}`);
  assertDeclarationsOnly(program);
});

/** Every file of the program inside a published package is a declaration of its dist. */
function assertDeclarationsOnly(program: Set<string>): void {
  for (const filename of program) {
    for (const pkg of [...packages, ...moduleOnlyPackages, ...moduleDeclarationPackages]) {
      if (within(pkg.directory, filename)) {
        assert.ok(within(resolve(pkg.directory, 'dist'), filename), `declarations read package source: ${relative(root, filename)}`);
        assert.ok(/\.d\.[cm]?ts$/.test(filename), `non-declaration package input: ${relative(root, filename)}`);
      }
    }
  }
}

test('generator-core exposes the only form stylesheet through the public crudui.css export', () => {
  const pkg = packages.find(({ manifest }) => manifest.name === '@polyspec/crudui-generator-core');
  assert.ok(pkg);
  const stylesheet = pkg.manifest.exports['./crudui.css'];
  assert.ok(typeof stylesheet === 'string', `${pkg.manifest.name} must export ./crudui.css as a file`);
  const path = realpathSync(resolve(pkg.directory, stylesheet));
  assert.equal(realpathSync(require.resolve(`${pkg.manifest.name}/crudui.css`)), path);
  assert.equal(realpathSync(fileURLToPath(import.meta.resolve(`${pkg.manifest.name}/crudui.css`))), path);
  assert.ok(readFileSync(path).length > 0, 'public stylesheet must not be empty');
  for (const other of packages.filter(({ manifest }) => manifest.name !== '@polyspec/crudui-generator-core')) {
    assert.ok(!Object.keys(other.manifest.exports).some(key => key.endsWith('.css')), `${other.manifest.name} must not export a stylesheet`);
  }
});


// The published packages whose declarations TypeScript builds from tsconfig.build.json.
const declarationPackages = ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react', 'vue', 'form-binding'];

test('the declaration build check covers every published package with a declaration build', () => {
  const built = contract.packages
    .filter(({ path }) => existsSync(resolve(root, path, 'tsconfig.build.json')))
    .map(({ path }) => relative(resolve(root, 'packages'), resolve(root, path)));
  assert.deepEqual([...declarationPackages].sort(), built.sort());
});

test('declaration builds emit no files when a public type is invalid', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'crudui-declaration-error-'));
  try {
    const source = resolve(temporary, 'invalid.ts');
    writeFileSync(source, "export const value: number = 'invalid';\n");
    for (const folder of declarationPackages) {
      const directory = resolve(root, 'packages', folder);
      const filename = resolve(directory, 'tsconfig.build.json');
      const shown = spawnSync(tsc, ['--project', filename, '--showConfig'], { cwd: directory, encoding: 'utf8' });
      assert.equal(shown.status, 0, shown.stdout + shown.stderr);
      const { compilerOptions } = parseJson<{ compilerOptions: { noEmitOnError?: boolean; emitDeclarationOnly?: boolean } }>(shown.stdout, {
        properties: { compilerOptions: { optionalProperties: { noEmitOnError: { type: 'boolean' }, emitDeclarationOnly: { type: 'boolean' } }, additionalProperties: true } },
        additionalProperties: true,
      }, `tsc --showConfig of ${filename}`);
      assert.equal(compilerOptions.noEmitOnError, true);
      assert.equal(compilerOptions.emitDeclarationOnly, true);
      const name = folder.replaceAll('/', '-');
      const output = resolve(temporary, name);
      const config = resolve(temporary, `${name}.tsconfig.json`);
      writeFileSync(config, JSON.stringify({ extends: filename, compilerOptions: { rootDir: temporary, outDir: output }, files: [source], include: [] }));
      const run = spawnSync(tsc, ['--project', config, '--pretty', 'false'], { cwd: directory, encoding: 'utf8' });
      assert.notEqual(run.status, 0);
      assert.match(run.stdout, /error TS2322:/);
      assert.equal(existsSync(output), false);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

function* files(directory: string): Generator<string> {
  for (const file of checkedFiles(directory)) yield resolve(directory, file);
}

/**
 * The command programs a package directory publishes. A published package is a library: a
 * non-private package.json, a composer.json whose type is not project, a Go module or a Rust
 * crate. Usage examples under `examples/` are not installed and are not commands.
 */
function publishedCommands(directory: string): string[] {
  const found: string[] = [];
  const json = (name: string): Record<string, unknown> | undefined => existsSync(resolve(directory, name)) ? readJson<Record<string, unknown>>(resolve(directory, name), { values: {} }) : undefined;
  const npm = json('package.json');
  if (npm && npm['private'] !== true && Object.hasOwn(npm, 'bin')) found.push('package.json bin');
  const composer = json('composer.json');
  if (composer && composer['type'] !== 'project') {
    if (Object.hasOwn(composer, 'bin')) found.push('composer.json bin');
    for (const file of files(directory)) {
      if (file.endsWith('.php') && readFileSync(file, 'utf8').startsWith('#!')) found.push(`PHP command ${relative(directory, file)}`);
    }
  }
  if (existsSync(resolve(directory, 'go.mod'))) {
    for (const file of files(directory)) {
      const path = relative(directory, file);
      if (!file.endsWith('.go') || path.split(sep).includes('examples')) continue;
      const source = readFileSync(file, 'utf8');
      // A build-ignored file is never compiled into the module; go generate runs it as a script.
      if (/^package main$/m.test(source) && !/^\/\/go:build ignore$/m.test(source)) found.push(`Go package main ${path}`);
    }
  }
  const cargo = existsSync(resolve(directory, 'Cargo.toml')) ? readFileSync(resolve(directory, 'Cargo.toml'), 'utf8') : undefined;
  if (cargo !== undefined) {
    if (/^\s*\[\[bin\]\]/m.test(cargo)) found.push('Cargo.toml [[bin]]');
    if (existsSync(resolve(directory, 'src/bin'))) found.push('Rust src/bin');
    if (existsSync(resolve(directory, 'src/main.rs'))) found.push('Rust src/main.rs');
  }
  return found;
}

test('each command form in a published package is detected', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'crudui-package-commands-'));
  // The check reads the files of a Git checkout (checkedFiles of @polyspec/kit/tracked-files).
  execFileSync('git', ['init', '--quiet'], { cwd: temporary });
  const make = (name: string, entries: Record<string, string>): string[] => {
    const directory = resolve(temporary, name);
    for (const [path, content] of Object.entries(entries)) {
      mkdirSync(dirname(resolve(directory, path)), { recursive: true });
      writeFileSync(resolve(directory, path), content);
    }
    return publishedCommands(directory);
  };
  try {
    assert.deepEqual(make('npm', { 'package.json': '{"name":"a","bin":"cli.js"}' }), ['package.json bin']);
    assert.deepEqual(make('npm-private', { 'package.json': '{"name":"a","private":true,"bin":"cli.js"}' }), []);
    assert.deepEqual(make('composer', { 'composer.json': '{"type":"library","bin":["bin/run"]}' }), ['composer.json bin']);
    assert.deepEqual(make('composer-script', { 'composer.json': '{}', 'bin/run.php': '#!/usr/bin/env php\n<?php\n' }), [`PHP command ${join('bin', 'run.php')}`]);
    assert.deepEqual(make('composer-project', { 'composer.json': '{"type":"project","bin":["run"]}', 'run.php': '#!/usr/bin/env php\n' }), []);
    assert.deepEqual(make('go', { 'go.mod': 'module a\n', 'cmd/run/main.go': 'package main\n', 'lib.go': 'package a\n' }), [`Go package main ${join('cmd', 'run', 'main.go')}`]);
    assert.deepEqual(make('go-root', { 'go.mod': 'module a\n', 'main.go': '// Command.\npackage main\n' }), ['Go package main main.go']);
    assert.deepEqual(make('go-example', { 'go.mod': 'module a\n', 'examples/server/main.go': 'package main\n', 'gen.go': '//go:build ignore\n\npackage main\n' }), []);
    assert.deepEqual(make('rust-bin', { 'Cargo.toml': '[package]\nname = "a"\n\n[[bin]]\nname = "run"\n' }), ['Cargo.toml [[bin]]']);
    assert.deepEqual(make('rust-src-bin', { 'Cargo.toml': '[package]\n', 'src/bin/run.rs': 'fn main() {}\n' }), ['Rust src/bin']);
    assert.deepEqual(make('rust-main', { 'Cargo.toml': '[package]\n', 'src/main.rs': 'fn main() {}\n', 'examples/form.rs': 'fn main() {}\n' }), ['Rust src/main.rs']);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test('no published package declares or contains a command', () => {
  const packagesDirectory = resolve(root, 'packages');
  const declared = readdirSync(packagesDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => publishedCommands(resolve(packagesDirectory, entry.name)).map(command => `${entry.name}: ${command}`));
  assert.deepEqual(declared, [], 'published packages are libraries; per-language programs live beside the tests that run them');
});
