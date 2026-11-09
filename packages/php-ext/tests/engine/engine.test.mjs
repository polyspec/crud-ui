import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { setup, teardown } from '@polyspec/kit/test-hooks';
import { dispatch } from '../../../../tests/native-generators/javascript.mts';
import { contractPath, outputPath, unicodeDataSource } from '../../tools/generate-unicode-data.mjs';

import { cString, cText, cTextInitializer, EngineFixtureSource, caseProgramStart, caseProgramEnd, caseReport, caseResults, recordCases, fixtureProgram, commaLocaleEnvironment, runUnderCommaLocale, ENGINE_TEST_BUDGET, ENGINE_SANITIZER_BUDGET, ENGINE_INSPECTION_BUDGET, compileAndRunEngineProgram, compileAndRunEngineFixture, compileEngineFixture, runEngineProgram } from './support.mjs';

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
function sourceForInvalidReference() {
  const builder = new EngineFixtureSource();
  const entry = builder.emit({ field: { $ref: null }, fixture: { values: ['used'] } });
  const files = builder.emit({});
  builder.lines.push(
    '  ps_value *error = NULL;',
    `  ps_value *actual = ps_compose_properties(${entry}, ${files}, PS_TEXT(""), &error);`,
    '  if (actual || !error ||',
    '      !ps_is_string(ps_get(error, "code"), "REF_VALUE_TYPE")) return 1;',
    '  ps_value_free(error);',
    `  ps_value_free(${entry}); ps_value_free(${files});`,
  );
  return fixtureProgram(builder.lines);
}

test('PHP extension engine rejects a null reference value', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-compose-invalid-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForInvalidReference(), name: 'compose-invalid',
      sources: ['value.c', 'number_text.c', 'engine_error.c', 'compose.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const validationCases = JSON.parse(readFileSync(
  path.join(root, 'tests/fixtures/validate/cases.json'), 'utf8'));
const specCases = JSON.parse(readFileSync(
  path.join(root, 'tests/fixtures/spec-validity/cases.json'), 'utf8'));
const listCases = JSON.parse(readFileSync(
  path.join(root, 'tests/fixtures/list-validity/cases.json'), 'utf8'));
const detailCases = JSON.parse(readFileSync(
  path.join(root, 'tests/fixtures/detail-validity/cases.json'), 'utf8'));

/* The engine units of rule evaluation, shared by the validation programs. */
const ruleSources = [
  'whitespace.c', 'canonical.c', 'rule_length.c', 'rule_in.c', 'rule_condition_tree.c', 'choice_list.c', 'group_source.c', 'rule_number.c', 'unicode_data.c',
  'pattern_set.c', 'pattern.c', 'pattern_match.c', 'rule_parameters.c', 'references.c',
];

/** The evidence each validation program case proves, in program order. */
const validationEvidence = [
  ...validationCases.map(fixture => ({ features: ['validate'], fixture: 'tests/fixtures/validate/cases.json', name: fixture.name })),
  ...specCases.map(fixture => ({ features: ['validate'], fixture: 'tests/fixtures/spec-validity/cases.json', name: fixture.name })),
  ...listCases.map(fixture => ({ features: ['validateList'], fixture: 'tests/fixtures/list-validity/cases.json', name: fixture.name })),
  ...detailCases.map(fixture => ({ features: ['validateDetail'], fixture: 'tests/fixtures/detail-validity/cases.json', name: fixture.name })),
];

function sourceForValidation() {
  const builder = new EngineFixtureSource();
  const { lines } = builder;
  let status = 1;
  lines.push(...caseProgramStart);

  const check = ({ name, operation, inputs, expected, error }) => {
    lines.push('  {', `  /* ${name} */`, '  int ok = 1;');
    const arguments_ = inputs.map(value => builder.emit(value));
    lines.push(`  ps_result actual = ${operation}(${arguments_.join(', ')});`);
    if (error) {
      const conditions = [`!text_is(ps_get(actual.error, "code"), ${cText(error.code)})`];
      if (error.message !== undefined)
        conditions.push(`!text_is(ps_get(actual.error, "message"), ${cText(error.message)})`);
      if (error.at !== undefined)
        conditions.push(`!text_is(ps_get(actual.error, "at"), ${cText(error.at)})`);
      lines.push(`  if (actual.value || !actual.error || ${conditions.join(' || ')})`);
      lines.push('  {');
      lines.push(`    ok = 0; print_text("error differs: ", ${cText(name)});`);
      lines.push('  }');
    } else if (expected !== undefined) {
      const expectedValue = builder.emit(expected);
      lines.push(`  if (!actual.value || actual.error || !ps_equal(actual.value, ${expectedValue})) {`);
      lines.push(`    print_text("result differs: ", ${cText(name)});`);
      lines.push('    print_json("actual: ", actual.value);');
      lines.push(`    print_json("expected: ", ${expectedValue});`);
      lines.push('    ok = 0;');
      lines.push('  }');
      lines.push(`  ps_value_free(${expectedValue});`);
    } else {
      lines.push('  if (!actual.value || actual.error) {');
      lines.push(`    ok = 0; print_text("operation failed: ", ${cText(name)});`);
      lines.push('  }');
    }
    lines.push('  ps_value_free(actual.value); ps_value_free(actual.error);');
    lines.push(...arguments_.map(value => `  ps_value_free(${value});`));
    lines.push(...caseReport(status), '  }');
    status += 1;
  };

  for (const fixture of validationCases) {
    check({
      name: `validate:${fixture.name}`,
      operation: 'ps_validate',
      inputs: [fixture.spec, fixture.data, {
        ...(fixture.files === undefined ? {} : { files: fixture.files }),
        ...(fixture.basepath === undefined ? {} : { basepath: fixture.basepath }),
      }],
      expected: fixture.expected,
      error: fixture.expectFailure,
    });
  }
  for (const fixture of specCases) {
    const error = typeof fixture.engine === 'object'
      ? { code: fixture.engine.code, at: fixture.engine.at } : undefined;
    check({
      name: `spec:${fixture.name}`,
      operation: 'ps_validate',
      inputs: [fixture.spec, {}, fixture.files === undefined ? {} : { files: fixture.files }],
      expected: { valid: true, errors: [], hidden: [] },
      error,
    });
  }
  for (const [family, operation, cases] of [
    ['list', 'ps_validate_list', listCases],
    ['detail', 'ps_validate_detail', detailCases],
  ]) {
    for (const fixture of cases) {
      const error = typeof fixture.engine === 'object'
        ? { code: fixture.engine.code, at: fixture.engine.at } : undefined;
      check({
        name: `${family}:${fixture.name}`,
        operation,
        inputs: [fixture.spec, fixture.files === undefined ? {} : { files: fixture.files }],
        expected: { valid: true, errors: [] },
        error,
      });
    }
  }
  lines.push(...caseProgramEnd);
  return fixtureProgram(lines);
}

test('PHP extension fixture arrays preserve every repeated scalar value', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-extension-repeated-array-'));
  const builder = new EngineFixtureSource();
  for (const [value, count] of [[7, 100000], [null, 4], [true, 4], [0.25, 4], ["a'한글", 4]]) {
    const array = builder.emit(Array.from({ length: count }, () => value));
    const expected = builder.emit(value);
    builder.lines.push(
      `  if (ps_size(${array}) != ${count}) return 1;`,
      `  for (size_t i = 0; i < ${count}; ++i) if (!ps_equal(ps_at(${array}, i), ${expected})) return 2;`,
      `  if (!ps_equal(ps_at(${array}, ${count - 1}), ${expected})) return 3;`,
      `  ps_value_free(${array}); ps_value_free(${expected});`,
    );
  }
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: fixtureProgram(builder.lines), name: 'repeated-array',
      sources: ['value.c', 'number_text.c', 'canonical.c', 'engine_error.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('prepared engine validation programs', () => {
const validationSources = [
  'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'compose.c', 'expression.c',
  'runtime.c', ...ruleSources, 'forbidden_scan.c', 'validation.c',
];
let directory;
let preparedValidation;
let validationLocaleEnvironment;
const preparedSanitizers = new Map();
const preparedUnique = new Map();
setup('compile validation and unique-rule fixtures', async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-extension-validation-'));
  const source = sourceForValidation();
  preparedValidation = await compileEngineFixture({ root, directory, source, name: 'validation', sources: validationSources });
  validationLocaleEnvironment = await commaLocaleEnvironment(directory);
  for (const sanitizer of ['undefined', 'address']) {
    preparedSanitizers.set(sanitizer, await compileEngineFixture({
      root, directory, source, name: sanitizer === 'undefined' ? 'validation-sanitize' : 'validation-address',
      sources: validationSources,
      compilerFlags: [`-fsanitize=${sanitizer}`, '-fno-omit-frame-pointer'],
    }));
  }
  for (const { name, source } of uniquePrograms) {
    preparedUnique.set(name, await compileEngineFixture({ root, directory, source: source(), name, sources: validationSources }));
  }
});
teardown('remove validation and unique-rule fixtures', async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('PHP extension engine validates all shared form, list and detail cases', { timeout: ENGINE_TEST_BUDGET }, async t => {
  let output = '';
  try {
    await runEngineProgram({
      ...preparedValidation, signal: t.signal,
      onOutput: stdout => { output = stdout; },
    });
    // The program reports one result for each case of the shared cases.json files, in their order; a case that the
    // program drops or adds changes the reported ids.
    assert.deepEqual([...caseResults(output).keys()].sort((a, b) => a - b), validationEvidence.map((_, index) => index + 1),
      'the extension engine reports a result for each case of the shared validate, spec-validity, list-validity and detail-validity cases.json');
  } finally {
    recordCases(validationEvidence, output);
  }
});

/*
 * The unique rule walks the rows of a collection once per validation. Each fixture validates
 * 50,000 rows with distinct values, which a single walk checks within seconds; a walk of every
 * earlier row for each row makes 1.25 * 10^9 row visits and does not end before the timeout of
 * the test, which stops the fixture. No fixture reads a clock, so the load of the machine cannot
 * change a result.
 */
const UNIQUE_ROWS = 50000;

/** A fixture program that validates UNIQUE_ROWS rows built by `row` under the emitted spec. */
function sourceForManyUniqueRows(spec, row, data) {
  const builder = new EngineFixtureSource();
  const { lines } = builder;
  // The largest fixture contains two scalar members per row, the rows container, the root and its checked member.
  const emitted = builder.emit({ ...spec, dataLimits: { values: UNIQUE_ROWS * 3 + 3 } });
  lines.push(
    `  bool valid = rows_valid(${emitted}, ${UNIQUE_ROWS});`,
    `  ps_value_free(${emitted});`,
    `  if (!valid) { fputs("${UNIQUE_ROWS} distinct rows were not valid\\n", stderr); return 1; }`,
  );
  return fixtureProgram(lines, [
    '/* Whether the validation of count keyed rows with distinct values is valid. */',
    'static bool rows_valid(const ps_value *spec, size_t count)',
    '{',
    '  ps_value *rows = ps_object_value(), *data = ps_object_value(), *options = ps_object_value();',
    '  for (size_t i = 0; i < count; ++i) {',
    '    char name[32]; snprintf(name, sizeof(name), "row%zu", i);',
    '    ps_value *row = ps_object_value();',
    ...row,
    '    put(rows, ps_fixed(name), row);',
    '  }',
    ...data,
    '  put(data, PS_TEXT("rows"), rows);',
    '  ps_result result = ps_validate(spec, data, options);',
    '  bool valid = result.value && !result.error && ps_get(result.value, "valid") &&',
    '    ps_get(result.value, "valid")->kind == PS_BOOL && ps_get(result.value, "valid")->data.boolean;',
    '  ps_value_free(result.value); ps_value_free(result.error);',
    '  ps_value_free(data); ps_value_free(options);',
    '  return valid;',
    '}',
  ]);
}

/** A filtered unique rule over rows: the filter runs once per row. */
function sourceForUniqueRows() {
  return sourceForManyUniqueRows({
    type: 'group',
    properties: {
      checked: { type: 'number' },
      rows: {
        type: 'group', multiple: true, validate: { unique: 'checked == 1' },
        properties: { name: { type: 'text' }, enabled: { type: 'number' } },
      },
    },
  }, [
    '    put(row, PS_TEXT("name"), ps_string_value(name)); put(row, PS_TEXT("enabled"), ps_int_value(1));',
  ], ['  put(data, PS_TEXT("checked"), ps_int_value(1));']);
}

/** A unique field in rows. */
function sourceForUniqueField() {
  return sourceForManyUniqueRows({
    type: 'group',
    properties: {
      rows: {
        type: 'group', multiple: true,
        properties: { code: { type: 'text', validate: { unique: true } } },
      },
    },
  }, ['    put(row, PS_TEXT("code"), ps_string_value(name));'], []);
}

const uniquePrograms = [
  { title: 'PHP extension engine unique rule walks the rows once', name: 'unique-rows', source: sourceForUniqueRows },
  { title: 'PHP extension engine unique rule on a field in rows walks the rows once', name: 'unique-field', source: sourceForUniqueField },
];
for (const { title, name } of uniquePrograms) {
  test(title, { timeout: ENGINE_TEST_BUDGET }, async t => {
    await runEngineProgram({ ...preparedUnique.get(name), signal: t.signal });
  });
}


test('PHP extension engine validation does not depend on a comma decimal locale', { timeout: ENGINE_TEST_BUDGET }, async t => {
  await runEngineProgram({ ...preparedValidation, name: 'validation-locale', signal: t.signal, runEnvironment: validationLocaleEnvironment });
});

test('PHP extension engine validation has no undefined behavior findings', { timeout: ENGINE_SANITIZER_BUDGET }, async t => {
  await runEngineProgram({
    ...preparedSanitizers.get('undefined'), signal: t.signal,
    runEnvironment: { ...process.env, UBSAN_OPTIONS: 'halt_on_error=1' },
  });
});

test('PHP extension engine validation has no address sanitizer findings', {
  timeout: ENGINE_SANITIZER_BUDGET,
}, async t => {
  await runEngineProgram({
    ...preparedSanitizers.get('address'), signal: t.signal,
    runEnvironment: { ...process.env, ASAN_OPTIONS: 'halt_on_error=1' },
  });
});
});

function sourceForValidationAllocationFailures() {
  const builder = new EngineFixtureSource();
  const repeatedGroupProperties = builder.emit({
    groups: {
      type: 'group',
      multiple: true,
      properties: { name: { type: 'text' } },
    },
  });
  const repeatedGroupData = builder.emit({ groups: { first: { name: 'first' } } });
  const repeatedFieldProperties = builder.emit({
    tags: { type: 'text', multiple: true },
  });
  const repeatedFieldData = builder.emit({ tags: { first: 'first' } });
  const uniqueRowsProperties = builder.emit({
    rows: {
      type: 'group',
      multiple: true,
      properties: { code: { type: 'text', validate: { unique: true } } },
    },
  });
  const uniqueRowsData = builder.emit({ rows: { first: { code: 'a' }, second: { code: 'a' } } });
  builder.lines.push(
    `  int status = verify_validation_allocation_failures(${repeatedGroupProperties}, ${repeatedGroupData}, 8);`,
    '  if (status) return status;',
    `  status = verify_validation_allocation_failures(${repeatedFieldProperties}, ${repeatedFieldData}, 6);`,
    '  if (status) return 10 + status;',
    `  status = verify_validation_allocation_failures(${uniqueRowsProperties}, ${uniqueRowsData}, 17);`,
    '  if (status) return 20 + status;',
    `  ps_value_free(${uniqueRowsProperties}); ps_value_free(${uniqueRowsData});`,
    `  ps_value_free(${repeatedGroupProperties}); ps_value_free(${repeatedGroupData});`,
    `  ps_value_free(${repeatedFieldProperties}); ps_value_free(${repeatedFieldData});`,
  );
  return fixtureProgram(builder.lines, [
    '#include <ctype.h>',
    '#include <errno.h>',
    '#include <math.h>',
    '#include <strings.h>',
    '#include <time.h>',
    '',
    'static size_t validation_allocation_index;',
    'static size_t validation_fail_at;',
    'static bool validation_allocation_failed;',
    '',
    'static bool validation_should_fail(void)',
    '{',
    '  validation_allocation_index++;',
    '  if (validation_allocation_index != validation_fail_at) return false;',
    '  validation_allocation_failed = true;',
    '  return true;',
    '}',
    '',
    'static void *validation_test_malloc(size_t size)',
    '{ return validation_should_fail() ? NULL : malloc(size); }',
    'static void *validation_test_calloc(size_t count, size_t size)',
    '{ return validation_should_fail() ? NULL : calloc(count, size); }',
    'static void *validation_test_realloc(void *pointer, size_t size)',
    '{ return validation_should_fail() ? NULL : realloc(pointer, size); }',
    '',
    '#define malloc(size) validation_test_malloc(size)',
    '#define calloc(count, size) validation_test_calloc(count, size)',
    '#define realloc(pointer, size) validation_test_realloc(pointer, size)',
    '#include "validation.c"',
    '#undef malloc',
    '#undef calloc',
    '#undef realloc',
    '',
    'static int verify_validation_allocation_failures(',
    '    const ps_value *properties, const ps_value *data, size_t allocation_count)',
    '{',
    '  for (size_t fail_at = 1; fail_at <= allocation_count; ++fail_at) {',
    '    validation_context context = {.data = data, .errors = ps_array_value(),',
    '      .unique_positions = ps_object_value(), .properties = properties, .reference_ids = ps_object_value()};',
    '    if (!context.errors || !context.unique_positions || !context.reference_ids) return 1;',
    '    validation_allocation_index = 0;',
    '    validation_fail_at = fail_at;',
    '    validation_allocation_failed = false;',
    '    bool result = validate_properties(properties, data, &context, NULL, 0, 0, false);',
    '    validation_fail_at = 0;',
    '    ps_value_free(context.errors);',
    '    free(context.declaration);',
    '    free(context.row_keys);',
    '    release_unique_rows(&context);',
    '    ps_value_free(context.reference_ids);',
    '    if (!validation_allocation_failed) return 2;',
    '    if (result) return 3;',
    '  }',
    '  validation_context context = {.data = data, .errors = ps_array_value(),',
    '    .unique_positions = ps_object_value(), .properties = properties, .reference_ids = ps_object_value()};',
    '  if (!context.errors || !context.unique_positions || !context.reference_ids) return 4;',
    '  validation_allocation_index = 0;',
    '  validation_fail_at = allocation_count + 1;',
    '  validation_allocation_failed = false;',
    '  bool result = validate_properties(properties, data, &context, NULL, 0, 0, false);',
    '  validation_fail_at = 0;',
    '  ps_value_free(context.errors);',
    '  free(context.declaration);',
    '  free(context.row_keys);',
    '  release_unique_rows(&context);',
    '  ps_value_free(context.reference_ids);',
    '  return result && !validation_allocation_failed ? 0 : 5;',
    '}',
  ]);
}

test('PHP extension validation returns failure after repeated-field allocation failures', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(
    os.tmpdir(), 'crudui-extension-validation-allocation-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForValidationAllocationFailures(),
      name: 'validation-allocation',
      sources: [
        'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'compose.c', 'expression.c',
        'runtime.c', ...ruleSources, 'forbidden_scan.c',
      ],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const unicode = JSON.parse(readFileSync(contractPath, 'utf8'));

test('PHP extension Unicode data is generated from the contract', { timeout: ENGINE_INSPECTION_BUDGET }, async () => {
  assert.equal(unicode.format, 'crudui/unicode-properties');
  assert.equal(await readFile(outputPath, 'utf8'), unicodeDataSource(unicode),
    'Regenerate with: make php-ext-tables');
});

test('PHP extension interface messages are generated from the contract', { timeout: ENGINE_INSPECTION_BUDGET }, async () => {
  const messages = await import('../../tools/generate-interface-messages.mjs');
  const contract = JSON.parse(await readFile(messages.contractPath, 'utf8'));
  assert.equal(contract.format, 'crudui/interface-messages');
  assert.equal(await readFile(messages.outputPath, 'utf8'), messages.interfaceMessagesSource(contract, await messages.structFields()),
    'Regenerate with: make php-ext-tables');
});

test('PHP extension interface messages value includes every contract key', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const contract = JSON.parse(await readFile(path.join(root, 'contracts/interface-messages.json'), 'utf8'));
  const builder = new EngineFixtureSource();
  contract.languages.forEach((language, index) => {
    builder.lines.push('  {');
    const expected = builder.emit(contract.form[language]);
    builder.lines.push(
      `  ps_value *actual = ps_form_messages_value(ps_form_messages_for(${cText(language)}));`,
      `  if (!actual || !ps_equal(actual, ${expected})) {`,
      `    print_text("interface messages differ: ", ${cText(language)});`,
      `    fprintf(stderr, "expected %zu keys from contracts/interface-messages.json for %s, actual %zu; message values must match\\n", ps_size(${expected}), ${cString(language)}, ps_size(actual)); return ${index + 1}; }`,
      `  ps_value_free(actual); ps_value_free(${expected});`,
      '  }',
    );
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-interface-messages-'));
  try {
    await compileAndRunEngineFixture({ signal: t.signal, root, directory,
      source: fixtureProgram(builder.lines), name: 'interface-messages',
      sources: ['value.c', 'number_text.c', 'messages.c', 'interface_messages.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

/* A deterministic sequence of 64-bit patterns (xorshift64*). */
function* bitPatterns(seed, count) {
  let state = seed;
  const mask = (1n << 64n) - 1n;
  for (let index = 0; index < count; index += 1) {
    state ^= state >> 12n;
    state ^= (state << 25n) & mask;
    state ^= state >> 27n;
    yield (state * 0x2545F4914F6CDD1Dn) & mask;
  }
}

function doubleOfBits(bits) {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, bits);
  return view.getFloat64(0);
}

function bitsOfDouble(number) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, number);
  return view.getBigUint64(0);
}

/*
 * Doubles whose canonical text is compared with Number.prototype.toString: edge values, powers of
 * two over the whole range with their largest mantissa, powers of ten with several digit strings,
 * neighbours of short decimals and random bit patterns of every exponent.
 */
function canonicalNumbers() {
  const values = new Set([
    0, -0, 1, -1, 0.1, 0.2, 0.1 + 0.2, 1.5, 12, 123456789012345680000, 1e21, 1e-7, 0.000001,
    1e-6, 9.999999999999999e20, 1.0000000000000001e21, 5e-324, -5e-324, 1e-323,
    Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE, 2.2250738585072014e-308,
    2.225073858507201e-308, Number.EPSILON, Number.MAX_SAFE_INTEGER, 2 ** 53, 2 ** 53 + 2,
    1 / 3, 2 / 3, Math.PI, Math.E, 100, 1e100, 123e-20, 5e-7, 4.35, 0.3,
    9.5e-5, 1234.5678, 0.00001234, 8.41e21, 5e22, 1e23, 2 ** 70, 2 ** 69 + 2 ** 17,
  ]);
  for (let exponent = -1074; exponent <= 1023; exponent += 1) {
    values.add(2 ** exponent);
    values.add(2 ** exponent * (2 - 2 ** -52));
  }
  for (let exponent = -324; exponent <= 308; exponent += 1) {
    for (const digits of ['1', '1.5', '2', '5', '9.999999999999999', '1.2345678901234567'])
      values.add(Number(`${digits}e${exponent}`));
  }
  for (const text of ['0.1', '0.3', '1.1', '2.675', '100.5', '1e22', '123456.789']) {
    const bits = bitsOfDouble(Number(text));
    for (const step of [-2n, -1n, 1n, 2n]) values.add(doubleOfBits(bits + step));
  }
  for (const bits of bitPatterns(0x9E3779B97F4A7C15n, 20000)) values.add(doubleOfBits(bits));
  return [...values].filter(Number.isFinite);
}

/* Numeric text: the HTML valid floating-point number whose value (the nearest double) is finite. */
const NUMERIC_TEXT = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/;
function numericTexts() {
  const texts = new Set([
    '', '-', '.', '1.', '+1', '.5', '-.5', '0', '-0', '00012', '1e', 'e5', '1e+', '1E-3', '--1', '0x10', 'Infinity',
    'NaN', '1_000', '1,5', '1 2', '\u0661', '1e999', '-1e999', '1e-400', '-1e-400', '1e308', '1.7976931348623157e308',
    '1.7976931348623158e308', '1.7976931348623159e308', '179769313486231580793728971405301e276',
    '2.2250738585072011e-308', '2.2250738585072014e-308', '4.9406564584124654e-324', '2.4703282292062327e-324',
    '2.4703282292062328e-324', '7.4109846876186982e-324', '1e-324', '3e-324', '0.1', '0.3', '1e23', '8.41e21',
    '9007199254740993', '9007199254740992.5', '1e0000000000000000000000000005', '1e-0000000000000000000000000400',
    `0.${'0'.repeat(400)}1e400`, `1${'0'.repeat(400)}e-400`, `${'9'.repeat(900)}e-900`, `0.${'1'.repeat(1000)}`,
    `4.${'9'.repeat(799)}e-324`, `2.4703282292062327208828439643411068618252990130716238221279284125033775363510437593264991818081799618989828234772285886546332835517796989819938739800539093906315035659515570226392290858392449105184435931802849936536152500319370457678249219365623669863658480757001585769269903706311928279558551332927834338409351978015531246597263579574622766465272827220056374006485499977096599470454020828166226237857393450736339007967761930577506740176324673600968951340535537458516661134223766678604162159680461914467291840300530057530849048765391711386591646239524912623653881879636239373280423891018672348497668235089863388587925628302755995657524455507255189313690836254779186948667994968324049705821028513185451396213837722826145437693412532098591327667236328125e-324`,
    `2.4703282292062327208828439643411068618252990130716238221279284125033775363510437593264991818081799618989828234772285886546332835517796989819938739800539093906315035659515570226392290858392449105184435931802849936536152500319370457678249219365623669863658480757001585769269903706311928279558551332927834338409351978015531246597263579574622766465272827220056374006485499977096599470454020828166226237857393450736339007967761930577506740176324673600968951340535537458516661134223766678604162159680461914467291840300530057530849048765391711386591646239524912623653881879636239373280423891018672348497668235089863388587925628302755995657524455507255189313690836254779186948667994968324049705821028513185451396213837722826145437693412532098591327667236328125001e-324`,
  ]);
  for (const number of canonicalNumbers().filter((_, index) => index % 7 === 0)) {
    texts.add(String(number));
    texts.add(number.toExponential());
    texts.add(number.toPrecision(21).replace('+', ''));
  }
  for (const bits of bitPatterns(0x243F6A8885A308D3n, 3000)) {
    const number = doubleOfBits(bits);
    if (!Number.isFinite(number)) continue;
    texts.add(number.toPrecision(17));
    texts.add(number.toExponential(25));
  }
  return [...texts].map(text => {
    const number = Number(text);
    return [text, NUMERIC_TEXT.test(text) && Number.isFinite(number), number];
  });
}

/* Texts in the C number syntax beyond numeric text: signs, spaces, prefixes, words and hexadecimal. */
const cNumberTexts = [
  '  +1.5e3xyz', '\t-0.25e-2,5', '1.', '1.e5', '.e1', '1e+', '1ex', '+', '-.', '0x', '0x1p', '0x1.8p1', '0X.8P-2',
  '0x1fffffffffffffp971', '0x1p1024', '-0x1p-1074', '0x1p-1080', '0x123456789abcdef0123p-60', '0xg', 'inf', '-INF',
  'Infinity', 'infinit', 'nan', 'NaN(123abc)', 'nan(', 'nanx', '1e999', '-1e999', '1e-999', '  12abc', '1,5',
  '\u00a01', '٣', '0.000000000000000000000000000000000000001e-300',
];

/* Step multiples decided on the exact decimal numbers of the canonical texts. */
function decimalOf(number) {
  const [mantissa, power = '0'] = String(Math.abs(number)).split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  return [BigInt(whole + fraction), Number(power) - fraction.length];
}
function stepMultiple(value, step) {
  const [a, p] = decimalOf(value);
  const [b, q] = decimalOf(step);
  const base = Math.min(p, q);
  return (a * 10n ** BigInt(p - base)) % (b * 10n ** BigInt(q - base)) === 0n;
}
function stepCases() {
  const cases = [[0.3, 0.1], [0.30000000000000004, 0.1], [2e-7, 0.1], [-0.6, 0.1], [0, 0.1], [1e21, 1e20],
    [1.05e21, 1e20], [1.5e21, 1e20], [3e-7, 2e-7], [4e-7, 2e-7], [1.75, 0.25], [1.8, 0.25], [5e-324, 5e-324],
    [1e-323, 5e-324], [Number.MAX_VALUE, 1e-300], [Number.MAX_VALUE, 7], [1e308, 3e-5], [123456789012345680000, 17],
    [0.000001, 1e-7], [9007199254740992, 3], [12, 1e-320], [1e-7, 1e21]];
  const numbers = canonicalNumbers().filter((_, index) => index % 97 === 0);
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    cases.push([numbers[i], Math.abs(numbers[i + 1]) || 1]);
    cases.push([numbers[i] * 3, Math.abs(numbers[i]) || 1]);
  }
  return cases.filter(([value, step]) => Number.isFinite(value) && Number.isFinite(step) && step > 0)
    .map(([value, step]) => [value, step, stepMultiple(value, step)]);
}

/* Integers are written as their nearest double. */
const canonicalIntegers = [
  0n, 7n, -7n, 9007199254740991n, 9007199254740993n, -9007199254740993n, 123456789012345678n,
  9223372036854775807n, -9223372036854775808n, 1000000000000000000n,
];

/* Patterns outside the language with their reason and offset, and patterns inside it. */
const rejectedPatterns = [
  ['', 'empty pattern', 0],
  ['한(', 'unterminated group', 2],
  ['(a$', 'unterminated group', 3],
  ['[', 'unterminated class', 1],
  ['[a', 'unterminated class', 2],
  ['[a-', 'unterminated class', 3],
  ['(((', 'unterminated group', 3],
  ['(?', 'unsupported construct', 0],
  ['(?<!a)', 'unsupported construct', 0],
  ['(?<=a)', 'unsupported construct', 0],
  ['(?P<a>x)', 'unsupported construct', 0],
  ['(?<', 'invalid group name', 0],
  ['(?<a', 'invalid group name', 0],
  ['(?<a-b>x)', 'invalid group name', 0],
  ['(?<1>x)', 'invalid group name', 0],
  ['(?<n>a)(?<n>b)', 'duplicate group name', 7],
  ['a}', 'unexpected character', 1],
  ['a$b', 'unexpected character', 1],
  ['(a$)', 'unexpected character', 2],
  ['^^', 'unexpected character', 1],
  ['a)', 'unexpected character', 1],
  ['^*', 'invalid quantifier', 1],
  ['a|*', 'invalid quantifier', 2],
  ['a*??', 'invalid quantifier', 3],
  ['a**', 'invalid quantifier', 2],
  ['a{2}{3}', 'invalid quantifier', 4],
  ['a{1,1001}', 'invalid quantifier', 1],
  ['a{1001,}', 'invalid quantifier', 1],
  ['a{3,2}', 'invalid quantifier', 1],
  ['a{,2}', 'invalid quantifier', 1],
  ['a{99999999999999999999}', 'invalid quantifier', 1],
  ['a{x}', 'invalid quantifier', 1],
  ['\\', 'invalid escape', 0],
  ['ab\\', 'invalid escape', 2],
  [String.raw`\u{}`, 'invalid escape', 0],
  [String.raw`\u{0000041}`, 'invalid escape', 0],
  [String.raw`\u{DFFF}`, 'invalid escape', 0],
  [String.raw`\u{110000}`, 'invalid escape', 0],
  ['\\' + 'u0041', 'invalid escape', 0],
  [String.raw`\x4`, 'invalid escape', 0],
  [String.raw`\cA`, 'invalid escape', 0],
  [String.raw`\0`, 'invalid escape', 0],
  [String.raw`\b`, 'invalid escape', 0],
  [String.raw`[a\q]`, 'invalid escape', 2],
  [String.raw`\p{Cs}`, 'invalid property', 0],
  [String.raw`\p{Cn}`, 'invalid property', 0],
  [String.raw`\p{Lu`, 'invalid property', 0],
  [String.raw`\p{lu}`, 'invalid property', 0],
  [String.raw`\pL`, 'invalid property', 0],
  [String.raw`\p{sc=Latin}`, 'invalid property', 0],
  [String.raw`\p{Script=latin}`, 'invalid property', 0],
  [String.raw`\P{Script=Klingon}`, 'invalid property', 0],
  [String.raw`\p{Script_Extensions=Latin}`, 'invalid property', 0],
  ['[^]', 'invalid class', 0],
  ['a[]', 'invalid class', 1],
  [String.raw`[\W]`, 'invalid class', 0],
  [String.raw`[a-\D]`, 'invalid class', 0],
  [String.raw`[\d-\D]`, 'invalid class', 0],
  ['[a[]', 'invalid class', 0],
  ['[a-b-c]', 'invalid class', 0],
  [String.raw`[\d-\q]`, 'invalid escape', 4],
  [String.raw`[\p{L}-z]`, 'invalid range', 1],
  [String.raw`[a-\d]`, 'invalid range', 1],
  ['[a--]', 'invalid range', 1],
  ['x[b-a]', 'invalid range', 2],
  ['a{1001}', 'invalid quantifier', 1],
  ['(a{600}){2,}', 'pattern too large', 0],
  ['a{1000,}', 'pattern too large', 0],
  ['(a+){501}', 'pattern too large', 0],
  ['((a{10}){10}){11}', 'pattern too large', 0],
  ['a'.repeat(1001), 'pattern too large', 0],
  ['(a{1000}){1000}[', 'unterminated class', 16],
  ['(a{1000}){1000}(?', 'unsupported construct', 15],
  ['('.repeat(101) + ')'.repeat(101), 'nesting too deep', 100],
  ['()'.repeat(10) + '('.repeat(101), 'nesting too deep', 120],
];

const acceptedPatterns = [
  '^', '$', '^$', 'a|', '|', '()', '(a{1000}){0}', 'a{0001}', '(a){2}', '[-a]', '[a-]', '[!--]',
  '[.$^*a-a|]', String.raw`\u{10FFFF}`, String.raw`\P{Script=Latin}`, '\u{1F600}', 'a{1000}',
  '(?:a*){500}', 'a{999,}', '(a+){500}', '('.repeat(100) + ')'.repeat(100), '((){1000}){1000}',
  'a'.repeat(1000), String.raw`\p{C}\p{Co}\p{Cf}\p{Cc}`, '/x/i',
];

/* Whole-value matches: pattern, text and whether it matches. */
const matchCases = [
  ['a|b', 'a', true], ['a|b', 'ab', false], ['a|', '', true], ['a|', 'a', true],
  ['^ab$', 'ab', true], ['^$', '', true], ['^$', 'x', false], ['x', 'x\n', false],
  ['a{2,3}', 'a', false], ['a{2,3}', 'aa', true], ['a{2,3}', 'aaa', true], ['a{2,3}', 'aaaa', false],
  ['a{2,3}?', 'aaa', true], ['a{0002}', 'aa', true], ['a{2,}', 'a'.repeat(5000), true],
  ['(ab|c)+d?', 'abcab', true], ['(ab|c)+d?', 'abcabd', true], ['(ab|c)+d?', 'd', false],
  ['(a?)*b', 'aaab', true], ['(|a)+', 'aaa', true], ['()*', '', true], ['()*', 'a', false],
  ['(a{1000}){0}', '', true], ['(a{1000}){0}', 'a', false], ['((){1000}){1000}', '', true],
  ['a.b', 'a\u{1F600}b', true], ['a.b', 'a\nb', false], ['a.b', 'a\u0000b', true],
  ['[.$^*a-a|]+', '.$^*a|', true], ['[.$^*a-a|]', 'b', false],
  ['[^a-c]', 'd', true], ['[^a-c]', 'b', false], ['[^a-c]', '\u{10FFFF}', true],
  [String.raw`\d\w`, '1_', true], [String.raw`\d`, '١', false],
  [String.raw`\s`, '　', true], [String.raw`\s`, '᠎', false], [String.raw`\S`, '᠎', true],
  [String.raw`\S`, '　', false], [String.raw`[\s\d]+`, ' 1 ', true],
  [String.raw`\p{Lu}\P{Lu}`, 'Aa', true], [String.raw`\p{Lu}`, 'a', false],
  [String.raw`\p{Script=Hangul}+`, '한글', true], [String.raw`\P{Script=Latin}+`, '1x', false],
  [String.raw`\p{Script=Garay}`, '\u{10D40}', true], [String.raw`\p{C}`, '\u{E0000}', true],
  [String.raw`\p{C}`, '͸', true], [String.raw`\p{Co}`, '', true], [String.raw`\P{C}`, 'a', true],
  [String.raw`\u{0}\x41\t`, '\u0000A\t', true], ['/x/i', '/x/i', true], ['/x/i', 'x', false],
  ['(?<name>a)(?:b)', 'ab', true], ['[-a]+', '-a-', true], ['[!--]+', '!,-', true],
  ['(?:[^\\n]*a){12}c', 'a'.repeat(100000), false], ['(x+x+)+y', 'x'.repeat(100000), false],
  [String.raw`\p{L}{1000}`, '한'.repeat(1000), true], [String.raw`\p{L}{1000}`, '한'.repeat(999), false],
  ['(a|aa)*(b|c)', 'a'.repeat(100000) + 'd', false], ['(a|aa)*(b|c)', 'a'.repeat(100000) + 'c', true],
];

function sourceForValues() {
  const declarations = [
    '',
    'static bool same_ranges(const ps_code_range *left, size_t left_count, const ps_code_range *right, size_t right_count)',
    '{',
    '  if (left_count != right_count) return false;',
    '  for (size_t i = 0; i < left_count; ++i)',
    '    if (left[i].start != right[i].start || left[i].end != right[i].end) return false;',
    '  return true;',
    '}',
    '',
    'typedef struct { uint64_t bits; const char *text; size_t length; } number_case;',
    'static const number_case number_cases[] = {',
    ...canonicalNumbers().map(number => {
      const text = String(number);
      return `  {UINT64_C(0x${bitsOfDouble(number).toString(16)}), ${cString(text)}, ${text.length}},`;
    }),
    '};',
    'typedef struct { ps_text text; bool numeric; uint64_t bits; } numeric_case;',
    'static const numeric_case numeric_cases[] = {',
    ...numericTexts().map(([text, numeric, number]) =>
      `  {${cTextInitializer(text)}, ${numeric}, UINT64_C(0x${numeric ? bitsOfDouble(number).toString(16) : '0'})},`),
    '};',
    'static const ps_text syntax_cases[] = {',
    ...[...numericTexts().map(([text]) => text), ...cNumberTexts].map(text => `  ${cTextInitializer(text)},`),
    '};',
    'typedef struct { uint64_t value, step; bool multiple; } step_case;',
    'static const step_case step_cases[] = {',
    ...stepCases().map(([value, step, multiple]) =>
      `  {UINT64_C(0x${bitsOfDouble(value).toString(16)}), UINT64_C(0x${bitsOfDouble(step).toString(16)}), ${multiple}},`),
    '};',
    'typedef struct { int64_t integer; const char *text; } integer_case;',
    'static const integer_case integer_cases[] = {',
    ...canonicalIntegers.map(integer => `  {${integer === -9223372036854775808n ? 'INT64_MIN' : `INT64_C(${integer})`}, ${cString(String(Number(integer)))}},`),
    '};',
    '',
    'typedef struct { ps_text source; const char *reason; size_t offset; } rejected_case;',
    'static const rejected_case rejected_cases[] = {',
    ...rejectedPatterns.map(([source, reason, offset]) => `  {${cTextInitializer(source)}, ${cString(reason)}, ${offset}},`),
    '};',
    'static const ps_text accepted_cases[] = {',
    ...acceptedPatterns.map(source => `  ${cTextInitializer(source)},`),
    '};',
    'typedef struct { ps_text source; ps_text text; bool matches; } match_case;',
    'static const match_case match_cases[] = {',
    ...matchCases.map(([source, text, matches]) => `  {${cTextInitializer(source)}, ${cTextInitializer(text)}, ${matches}},`),
    '};',
    '',
    '#include <errno.h>',
    '#include <math.h>',
    'static int failures;',
    'static void failure(const char *label, ps_text text)',
    '{ fputs(label, stderr); fwrite(text.bytes, 1, text.length > 200 ? 200 : text.length, stderr); fputc(10, stderr); failures++; }',
    '',
  ];
  const lines = [
    '  /*',
    '   * The C library is the reference for the C number syntax and for "%.*g", read in the "C"',
    '   * locale before the program switches to the locale under test.',
    '   */',
    '  setlocale(LC_ALL, "C");',
    '  static const int precisions[] = {1, 2, 6, 15, 17};',
    '  size_t number_count = sizeof(number_cases) / sizeof(number_cases[0]);',
    '  char (*general_references)[5][32] = malloc(number_count * sizeof(*general_references));',
    '  if (!general_references) return 1;',
    '  for (size_t i = 0; i < number_count; ++i) {',
    '    double number;',
    '    memcpy(&number, &number_cases[i].bits, sizeof(number));',
    '    for (size_t p = 0; p < 5; ++p) snprintf(general_references[i][p], 32, "%.*g", precisions[p], number);',
    '  }',
    '  size_t syntax_count = sizeof(syntax_cases) / sizeof(syntax_cases[0]);',
    '  typedef struct { size_t length; double number; bool overflow; } syntax_reference;',
    '  syntax_reference *syntax_references = malloc(syntax_count * sizeof(*syntax_references));',
    '  if (!syntax_references) return 1;',
    '  for (size_t i = 0; i < syntax_count; ++i) {',
    '    char *end = NULL;',
    '    errno = 0;',
    '    syntax_references[i].number = strtod(syntax_cases[i].bytes, &end);',
    '    syntax_references[i].length = (size_t)(end - syntax_cases[i].bytes);',
    '    syntax_references[i].overflow = errno == ERANGE && isinf(syntax_references[i].number);',
    '  }',
    '  crudui_locale_start();',
    '',
    `  if (!ps_text_equal(ps_trim(${cText('　\t x \u0000 y  ')}), ${cText('x \u0000 y')})) failure("trim differs", PS_TEXT(""));`,
    `  if (!ps_text_equal(ps_trim(${cText('﻿x​')}), ${cText('﻿x​')})) failure("trim removed a code point that is not whitespace", PS_TEXT(""));`,
    `  if (ps_trim(${cText('  　')}).length) failure("whitespace is not empty after trimming", PS_TEXT(""));`,
    `  if (ps_code_points(${cText('a\u0000\u{1f468}‍\u{1f469}한')}) != 6) failure("code points differ", PS_TEXT(""));`,
    '',
    '  /* Sets: surrogates belong to C and to every complement, never to a script or letter set. */',
    '  {',
    '    const ps_unicode_property *other = ps_unicode_category(PS_TEXT("C"));',
    '    const ps_unicode_property *letter = ps_unicode_category(PS_TEXT("L"));',
    '    if (!ps_code_ranges_contain(other->ranges, other->count, 0xd800) || !ps_code_ranges_contain(other->ranges, other->count, 0xdfff))',
    '      failure("surrogates are not in C", PS_TEXT(""));',
    '    ps_code_set set = {0};',
    '    ps_code_set_add_ranges(&set, letter->ranges, letter->count);',
    '    ps_code_set_complement(&set);',
    '    if (!ps_code_ranges_contain(set.ranges, set.count, 0xd800) || ps_code_ranges_contain(set.ranges, set.count, 0x41) ||',
    '        !ps_code_ranges_contain(set.ranges, set.count, 0x10ffff) || !ps_code_ranges_contain(set.ranges, set.count, 0))',
    '      failure("complement differs", PS_TEXT(""));',
    '    ps_code_set_complement(&set);',
    '    if (!same_ranges(set.ranges, set.count, letter->ranges, letter->count)) failure("double complement differs", PS_TEXT(""));',
    '    ps_code_set_free(&set);',
    '    ps_code_set_add(&set, 5, 9); ps_code_set_add(&set, 0, 2); ps_code_set_add(&set, 3, 4); ps_code_set_add(&set, 20, 30); ps_code_set_add(&set, 25, 26);',
    '    ps_code_set_normalize(&set);',
    '    if (!same_ranges(set.ranges, set.count, (const ps_code_range[]){{0, 9}, {20, 30}}, 2)) failure("union differs", PS_TEXT(""));',
    '    ps_code_set_complement(&set);',
    '    if (!same_ranges(set.ranges, set.count, (const ps_code_range[]){{10, 19}, {31, 0x10ffff}}, 2)) failure("complement from 0 differs", PS_TEXT(""));',
    '    ps_code_set_free(&set);',
    '    ps_code_set_complement(&set);',
    '    if (!same_ranges(set.ranges, set.count, (const ps_code_range[]){{0, 0x10ffff}}, 1)) failure("complement of nothing differs", PS_TEXT(""));',
    '    ps_code_set_complement(&set);',
    '    if (set.count) failure("complement of everything is not empty", PS_TEXT(""));',
    '    ps_code_set_free(&set);',
    '  }',
    '',
    '  /* Canonical number text is Number.prototype.toString of the double. */',
    '  for (size_t i = 0; i < sizeof(number_cases) / sizeof(number_cases[0]); ++i) {',
    '    double number;',
    '    memcpy(&number, &number_cases[i].bits, sizeof(number));',
    '    ps_chars text = ps_number_text(number);',
    '    ps_text expected = {number_cases[i].text, number_cases[i].length};',
    '    if (!text.bytes || !ps_text_equal(ps_view(text), expected)) {',
    '      failure("number text differs from ", expected);',
    '      if (text.bytes) failure("  actual: ", ps_view(text));',
    '    }',
    '    free(text.bytes);',
    '  }',
    '  for (size_t i = 0; i < sizeof(integer_cases) / sizeof(integer_cases[0]); ++i) {',
    '    ps_value *value = ps_int_value(integer_cases[i].integer);',
    '    ps_chars text;',
    '    if (ps_canonical_text(value, &text) != 1 || !ps_text_equal(ps_view(text), ps_fixed(integer_cases[i].text)))',
    '      failure("integer text differs from ", ps_fixed(integer_cases[i].text));',
    '    free(text.bytes);',
    '    ps_value_free(value);',
    '  }',
    '  {',
    '    ps_value *values[] = {ps_bool_value(true), ps_bool_value(false), ps_float_value(-0.0), ps_float_value(2.5),',
    '      ps_text_value(PS_TEXT(" a ")), ps_null_value(), ps_array_value(), ps_object_value()};',
    '    const char *expected[] = {"1", "0", "0", "2.5", " a ", NULL, NULL, NULL};',
    '    for (size_t i = 0; i < sizeof(values) / sizeof(values[0]); ++i) {',
    '      ps_chars text;',
    '      int scalar = ps_canonical_text(values[i], &text);',
    '      if (expected[i] ? scalar != 1 || !ps_text_equal(ps_view(text), ps_fixed(expected[i])) : scalar != 0)',
    '        failure("canonical text differs: ", ps_fixed(expected[i] ? expected[i] : "(none)"));',
    '      free(text.bytes);',
    '      ps_value_free(values[i]);',
    '    }',
    '  }',
    '',
    '  /* The C number syntax and "%.*g" equal the C library in the "C" locale. */',
    '  for (size_t i = 0; i < syntax_count; ++i) {',
    '    double number = 0;',
    '    bool overflow = false;',
    '    size_t length = ps_c_number(syntax_cases[i], &number, &overflow);',
    '    const syntax_reference *expected = &syntax_references[i];',
    '    bool same = length == expected->length && overflow == expected->overflow &&',
    '      (isnan(expected->number) ? isnan(number) : !memcmp(&number, &expected->number, sizeof(number)));',
    '    if (!same) failure("C number syntax differs: ", syntax_cases[i]);',
    '  }',
    '  for (size_t i = 0; i < number_count; ++i) {',
    '    double number;',
    '    memcpy(&number, &number_cases[i].bits, sizeof(number));',
    '    for (size_t p = 0; p < 5; ++p) {',
    '      ps_chars text = ps_format_general(number, precisions[p]);',
    '      if (!text.bytes || !ps_text_equal(ps_view(text), ps_fixed(general_references[i][p]))) {',
    '        failure("general number text differs from ", ps_fixed(general_references[i][p]));',
    '        if (text.bytes) failure("  actual: ", ps_view(text));',
    '      }',
    '      free(text.bytes);',
    '    }',
    '  }',
    '  free(general_references);',
    '  free(syntax_references);',
    '',
    '  /* Numeric text is read exactly and independently of the locale; step multiples are exact. */',
    '  for (size_t i = 0; i < sizeof(numeric_cases) / sizeof(numeric_cases[0]); ++i) {',
    '    double number = 0;',
    '    bool numeric = ps_numeric_text(numeric_cases[i].text, &number);',
    '    uint64_t bits;',
    '    memcpy(&bits, &number, sizeof(bits));',
    '    if (numeric != numeric_cases[i].numeric || (numeric && bits != numeric_cases[i].bits))',
    '      failure(numeric ? "numeric text differs: " : "numeric text rejected: ", numeric_cases[i].text);',
    '  }',
    '  for (size_t i = 0; i < sizeof(step_cases) / sizeof(step_cases[0]); ++i) {',
    '    double value, step;',
    '    memcpy(&value, &step_cases[i].value, sizeof(value));',
    '    memcpy(&step, &step_cases[i].step, sizeof(step));',
    '    if (ps_step_multiple(value, step) != (step_cases[i].multiple ? 1 : 0)) {',
    '      char detail[96]; snprintf(detail, sizeof(detail), "step multiple differs: %.17g / %.17g", value, step);',
    '      failure(detail, PS_TEXT(""));',
    '    }',
    '  }',
    '',
    '  /* The pattern language. */',
    '  for (size_t i = 0; i < sizeof(rejected_cases) / sizeof(rejected_cases[0]); ++i) {',
    '    const rejected_case *item = &rejected_cases[i];',
    '    ps_pattern *pattern;',
    '    ps_pattern_error error;',
    '    int result = ps_pattern_compile(item->source, &pattern, &error);',
    '    if (result != 0 || strcmp(error.reason, item->reason) || error.offset != item->offset) {',
    '      char detail[96];',
    '      snprintf(detail, sizeof(detail), "pattern result differs (%s at %zu): ", result ? "accepted" : error.reason, error.offset);',
    '      failure(detail, item->source);',
    '    }',
    '    ps_pattern_free(pattern);',
    '  }',
    '  for (size_t i = 0; i < sizeof(accepted_cases) / sizeof(accepted_cases[0]); ++i) {',
    '    ps_pattern *pattern;',
    '    ps_pattern_error error;',
    '    if (ps_pattern_compile(accepted_cases[i], &pattern, &error) != 1) failure("pattern rejected: ", accepted_cases[i]);',
    '    /* Character states never exceed the size, and every other state is bounded by it. */',
    '    else if (ps_pattern_state_count(pattern) > 3 * 1000 + 2) failure("too many states: ", accepted_cases[i]);',
    '    ps_pattern_free(pattern);',
    '  }',
    '  {',
    '    ps_pattern *pattern;',
    '    ps_pattern_error error;',
    '    if (ps_pattern_compile(PS_TEXT("((){1000}){1000}"), &pattern, &error) != 1 || ps_pattern_state_count(pattern) > 4)',
    '      failure("a repetition of size 0 is not one state", PS_TEXT(""));',
    '    ps_pattern_free(pattern);',
    '  }',
    '',
    '  /* The matcher. */',
    '  for (size_t i = 0; i < sizeof(match_cases) / sizeof(match_cases[0]); ++i) {',
    '    const match_case *item = &match_cases[i];',
    '    ps_pattern *pattern;',
    '    ps_pattern_error error;',
    '    if (ps_pattern_compile(item->source, &pattern, &error) != 1) { failure("pattern rejected: ", item->source); continue; }',
    '    int matched = ps_pattern_matches(pattern, item->text);',
    '    if (matched != (item->matches ? 1 : 0)) failure(item->matches ? "no match: " : "unexpected match: ", item->source);',
    '    ps_pattern_free(pattern);',
    '  }',
    '  {',
    '    ps_pattern_cache *cache = ps_pattern_cache_new();',
    '    const ps_pattern *first, *second;',
    '    ps_pattern_error error;',
    '    if (!cache || ps_pattern_cache_get(cache, PS_TEXT("a+"), &first, &error) != 1 ||',
    '        ps_pattern_cache_get(cache, PS_TEXT("a+"), &second, &error) != 1 || first != second ||',
    '        ps_pattern_cache_get(cache, PS_TEXT("a("), &second, &error) != 0 || second || error.offset != 2 ||',
    '        ps_pattern_cache_get(cache, PS_TEXT("a("), &second, &error) != 0 || strcmp(error.reason, "unterminated group"))',
    '      failure("the pattern cache differs", PS_TEXT(""));',
    '    ps_pattern_cache_free(cache);',
    '  }',
    '  if (failures) { fprintf(stderr, "%d failures\\n", failures); return 1; }',
  ];
  return fixtureProgram(lines, declarations, { explicitLocale: true });
}

test('PHP extension engine values and number text do not depend on a comma decimal locale', { timeout: ENGINE_TEST_BUDGET }, async t => {
  await runUnderCommaLocale({
    signal: t.signal, root, prefix: 'crudui-extension-values-locale-', name: 'values-locale', source: sourceForValues(),
    sources: ['value.c', 'number_text.c', 'whitespace.c', 'canonical.c', 'rule_length.c', 'rule_number.c', 'unicode_data.c', 'pattern_set.c', 'pattern.c', 'pattern_match.c'],
  });
});

for (const sanitized of [false, true]) {
  test(`PHP extension engine values, patterns and the matcher follow the specification${sanitized ? ' without undefined behavior' : ''}`, {
    timeout: sanitized ? ENGINE_SANITIZER_BUDGET : ENGINE_TEST_BUDGET,
  }, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-extension-values-'));
    try {
      await compileAndRunEngineFixture({
        signal: t.signal, root, directory, source: sourceForValues(),
        name: sanitized ? 'values-sanitize' : 'values',
        sources: ['value.c', 'number_text.c', 'whitespace.c', 'canonical.c', 'rule_length.c', 'rule_number.c', 'unicode_data.c', 'pattern_set.c', 'pattern.c', 'pattern_match.c'],
        compilerFlags: sanitized ? ['-fsanitize=undefined', '-fno-omit-frame-pointer'] : ['-O2'],
        runEnvironment: { ...process.env, UBSAN_OPTIONS: 'halt_on_error=1' },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function sourceForWidgetConstructionFailure() {
  const builder = new EngineFixtureSource();
  const template = builder.emit(JSON.parse(JSON.stringify(dispatch({
    operation: 'compileForm',
    spec: { type: 'group', properties: { title: { type: 'text' } } },
    options: {},
  }))));
  const data = builder.emit({});
  const options = builder.emit({});
  const declarations = [
    'bool ps_widget_supported(ps_text type)',
    '{',
    '  return ps_text_is(type, "text");',
    '}',
    '',
    'bool ps_widget_choices(ps_text type)',
    '{',
    '  (void)type;',
    '  return false;',
    '}',
    '',
    'bool ps_widget_select(ps_text type)',
    '{',
    '  (void)type;',
    '  return false;',
    '}',
    '',
    'const ps_value *ps_declared_attributes(const ps_value *spec, bool wrapper)',
    '{',
    '  (void)spec; (void)wrapper;',
    '  return NULL;',
    '}',
    '',
    'ps_value *ps_widget(const ps_value *spec, const ps_value *value, bool value_present,',
    '                    ps_text path, const ps_value *design, ps_text key_prefix,',
    '                    ps_text id_prefix, ps_text language,',
    '                    const size_t *row_segments, size_t row_count)',
    '{',
    '  (void)spec; (void)value; (void)value_present; (void)path; (void)design;',
    '  (void)key_prefix; (void)id_prefix; (void)language;',
    '  (void)row_segments; (void)row_count;',
    '  return NULL;',
    '}',
    '',
  ];
  builder.lines.push(
    `  ps_result result = ps_bind_form(${template}, ${data}, ${options});`,
    '  if (result.value || !result.error ||',
    '      !ps_is_string(ps_get(result.error, "code"), "INTERNAL_ERROR")) return 1;',
    '  ps_value_free(result.error);',
    `  ps_value_free(${template}); ps_value_free(${data}); ps_value_free(${options});`,
  );
  return fixtureProgram(builder.lines, declarations);
}

test('PHP extension engine reports supported widget construction failures as internal errors', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-widget-failure-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForWidgetConstructionFailure(), name: 'widget-failure',
      sources: [
        'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'expression.c',
        'runtime.c', 'date.c', 'design.c', 'messages.c', 'interface_messages.c', 'binding.c', 'declaration.c', 'choice_list.c', 'group_source.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'canonical.c',
      ],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function sourceForKeys() {
  return [
    '#include "engine_internal.h"',
    '#include <stdint.h>',
    '#include <string.h>',
    '',
    'int main(void)',
    '{',
    '  ps_value *integer = ps_int_value(INT64_C(7));',
    '  ps_result result = ps_sequence_key(integer);',
    '  if (result.error || !ps_is_string(result.value, "__0000000000007__")) return 1;',
    '  ps_value_free(result.value); ps_value_free(integer);',
    '  ps_value *digits = ps_string_value("1234567890123");',
    '  result = ps_sequence_key(digits);',
    '  if (result.error || !ps_is_string(result.value, "__1234567890123__")) return 2;',
    '  ps_value_free(result.value); ps_value_free(digits);',
    '  ps_value *invalid[] = {',
    '    ps_int_value(-1), ps_int_value(INT64_C(10000000000000)),',
    '    ps_float_value(1.0), ps_string_value(""),',
    '    ps_string_value("12345678901234"), ps_string_value("12a")',
    '  };',
    '  for (size_t i = 0; i < sizeof(invalid) / sizeof(invalid[0]); ++i) {',
    '    result = ps_sequence_key(invalid[i]);',
    '    if (result.value || !result.error ||',
    '        !ps_is_string(ps_get(result.error, "code"), "INVALID_FORM_INPUT")) return 3;',
    '    ps_value_free(result.error); ps_value_free(invalid[i]);',
    '  }',
    '  char generated[64][18];',
    '  for (size_t i = 0; i < 64; ++i) {',
    '    result = ps_create_key();',
    '    if (result.error || !result.value || result.value->kind != PS_STRING ||',
    '        result.value->data.string.length != 17) return 4;',
    '    const char *key = ps_string(result.value).bytes;',
    "    if (key[0] != '_' || key[1] != '_' || key[15] != '_' || key[16] != '_') return 5;",
    "    for (size_t j = 2; j < 15; ++j)",
    "      if (!((key[j] >= '0' && key[j] <= '9') ||",
    "            (key[j] >= 'a' && key[j] <= 'f'))) return 6;",
    '    memcpy(generated[i], key, 18);',
    '    for (size_t j = 0; j < i; ++j) if (!strcmp(generated[j], generated[i])) return 7;',
    '    ps_value_free(result.value);',
    '  }',
    '  return 0;',
    '}',
    '',
  ].join('\n');
}

test('PHP extension engine creates and formats row keys', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-key-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForKeys(), name: 'key',
      sources: ['value.c', 'number_text.c', 'engine_error.c', 'key.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function sourceForFormState() {
  const fixture = new EngineFixtureSource();
  const spec = fixture.emit({
    type: 'group',
    properties: {
      companies: {
        type: 'group', multiple: { max: 3 },
        properties: {
          name: { type: 'text' },
          stores: {
            type: 'group', multiple: true,
            properties: {
              name: { type: 'text', default: 'Default' },
              departments: {
                type: 'group', multiple: true,
                properties: { name: { type: 'text' } },
              },
            },
          },
        },
      },
    },
  });
  const data = fixture.emit({
    companies: {
      row_a: {
        name: 'Company',
        stores: {
          store_a: {
            name: 'Store',
            departments: { dept_a: { name: 'Sales' } },
          },
        },
      },
    },
  });
  const compileOptions = fixture.emit({});
  const formOptions = fixture.emit({ idPrefix: "scope:'한글" });
  fixture.lines.push(
    '  ps_result compiled = ps_compile_form(' + spec + ', ' + compileOptions + ');',
    '  if (compiled.error || !compiled.value) return 1;',
    '  ps_form_result created = ps_form_new(compiled.value, ' + data + ', ' + formOptions + ');',
    '  if (created.error || !created.form) return 2;',
    '  ps_form *form = created.form;',
    '  ps_result result = ps_form_read(form, 3);',
    '  if (result.error || !result.value || result.value->kind != PS_INT ||',
    '      result.value->data.integer != 0) return 3;',
    '  ps_value_free(result.value);',
    '  ps_value *args = ps_array_value();',
    '  push(args, ps_string_value("companies.row_a.stores.store_a.name"));',
    '  push(args, ps_string_value("Changed"));',
    '  result = ps_form_apply(form, 2, args); ps_value_free(args);',
    '  if (result.error || !result.value || result.value->kind != PS_NULL) return 4;',
    '  ps_value_free(result.value);',
    '  ps_value *copy_options = ps_object_value();',
    '  put(copy_options, PS_TEXT("key"), ps_string_value("store_copy"));',
    '  args = ps_array_value();',
    '  push(args, ps_string_value("companies.row_a.stores"));',
    '  push(args, ps_string_value("store_a"));',
    '  push(args, copy_options);',
    '  result = ps_form_apply(form, 4, args); ps_value_free(args);',
    '  if (result.error || !ps_is_string(result.value, "store_copy")) return 5;',
    '  ps_value_free(result.value);',
    '  result = ps_form_read(form, 1);',
    '  const ps_value *copied = ps_path(result.value, PS_TEXT("companies.row_a.stores.store_copy"));',
    '  const ps_value *departments = copied ? ps_get(copied, "departments") : NULL;',
    '  if (!copied || !ps_is_string(ps_get(copied, "name"), "Changed") ||',
    '      !departments || departments->kind != PS_OBJECT || ps_size(departments) != 1 ||',
    '      ps_text_is(ps_key(departments, 0), "dept_a")) return 6;',
    '  ps_value_free(result.value);',
    '  args = ps_array_value();',
    '  push(args, ps_string_value("companies.row_a.stores"));',
    '  push(args, ps_string_value("store_copy"));',
    '  push(args, ps_string_value("__0000000000042__"));',
    '  result = ps_form_apply(form, 7, args); ps_value_free(args);',
    '  if (result.error) return 7;',
    '  ps_value_free(result.value);',
    '  args = ps_array_value();',
    '  push(args, ps_string_value("companies.row_a.stores"));',
    '  push(args, ps_string_value("__0000000000042__"));',
    '  push(args, ps_int_value(0));',
    '  result = ps_form_apply(form, 6, args); ps_value_free(args);',
    '  if (result.error) return 8;',
    '  ps_value_free(result.value);',
    '  result = ps_form_read(form, 1);',
    '  const ps_value *stores = ps_path(result.value, PS_TEXT("companies.row_a.stores"));',
    '  if (!stores || !ps_text_is(ps_key(stores, 0), "__0000000000042__")) return 9;',
    '  ps_value *before = result.value;',
    '  result = ps_form_read(form, 3);',
    '  int64_t revision = result.value->data.integer; ps_value_free(result.value);',
    '  ps_value *duplicate = ps_object_value();',
    '  put(duplicate, PS_TEXT("key"), ps_string_value("__0000000000042__"));',
    '  args = ps_array_value();',
    '  push(args, ps_string_value("companies.row_a.stores")); push(args, duplicate);',
    '  result = ps_form_apply(form, 3, args); ps_value_free(args);',
    '  if (result.value || !result.error ||',
    '      !ps_is_string(ps_get(result.error, "code"), "INVALID_FORM_INPUT")) return 10;',
    '  ps_value_free(result.error);',
    '  result = ps_form_read(form, 1);',
    '  if (!ps_equal(before, result.value)) return 11;',
    '  ps_value_free(result.value); ps_value_free(before);',
    '  result = ps_form_read(form, 3);',
    '  if (result.value->data.integer != revision) return 12;',
    '  ps_value_free(result.value);',
    '  ps_form *clone = ps_form_clone(form); if (!clone) return 13;',
    '  args = ps_array_value(); push(args, ps_string_value("companies.row_a.name"));',
    '  push(args, ps_string_value("Clone"));',
    '  result = ps_form_apply(clone, 2, args); ps_value_free(args);',
    '  if (result.error) return 14;',
    '  ps_value_free(result.value);',
    '  args = ps_array_value(); push(args, ps_string_value("companies.row_a.name"));',
    '  result = ps_form_apply(form, 0, args); ps_value_free(args);',
    '  if (!ps_is_string(result.value, "Company")) return 15;',
    '  ps_value_free(result.value);',
    '  result = ps_form_read(form, 4);',
    '  if (result.error || !result.value || result.value->kind != PS_STRING ||',
    '      ps_text_find(ps_string(result.value),',
    '                   PS_TEXT("companies[row_a][stores][__0000000000042__][name]"), 0) == SIZE_MAX) return 16;',
    '  ps_value_free(result.value); ps_form_free(clone); ps_form_free(form);',
    '  ps_value *explicit_empty = ps_object_value();',
    '  put(explicit_empty, PS_TEXT("companies"), ps_object_value());',
    '  created = ps_form_new(compiled.value, explicit_empty, ' + formOptions + ');',
    '  if (created.error || !created.form) return 17;',
    '  result = ps_form_read(created.form, 1);',
    '  if (!ps_get(result.value, "companies") ||',
    '      ps_size(ps_get(result.value, "companies")) != 0) return 18;',
    '  ps_value_free(result.value); ps_form_free(created.form);',
    '  ps_value_free(explicit_empty);',
    '  ps_value *invalid = ps_object_value();',
    '  put(invalid, PS_TEXT("companies"), ps_array_value());',
    '  created = ps_form_new(compiled.value, invalid, ' + formOptions + ');',
    '  if (created.form || !created.error ||',
    '      !ps_is_string(ps_get(created.error, "code"), "INVALID_FORM_INPUT")) return 19;',
    '  ps_value_free(created.error); ps_value_free(invalid);',
    '  ps_value_free(compiled.value);',
    '  ps_value_free(' + spec + '); ps_value_free(' + data + ');',
    '  ps_value_free(' + compileOptions + '); ps_value_free(' + formOptions + ');',
  );
  return fixtureProgram(fixture.lines);
}

test('PHP extension engine updates form state atomically', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-extension-form-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForFormState(), name: 'form-state',
      sources: [
        'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'compose.c', 'declaration.c', 'template.c',
        'expression.c', 'runtime.c', 'date.c', 'design.c', 'widget.c',
        'messages.c', 'interface_messages.c', 'binding.c', 'history.c', 'view.c', 'html.c', 'render.c', 'key.c', 'form.c', 'choice_list.c', 'group_source.c', 'canonical.c',
        'rule_number.c', 'rule_length.c', 'rule_condition_tree.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c',
      ],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

test('PHP extension engine compiles composed form templates', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-template-'));
  try {
    await compileAndRunEngineProgram({
      root, directory, name: 'template-test', signal: t.signal,
      program: path.join(root, 'packages/php-ext/tests/template.c'),
      sources: ['value.c', 'engine_error.c', 'compose.c', 'declaration.c', 'template.c', 'number_text.c',
        'canonical.c', 'rule_number.c', 'rule_length.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'group_source.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

test('PHP extension engine value model preserves order and owns independent values', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-value-'));
  try {
    await compileAndRunEngineProgram({
      root, directory, name: 'value-test', signal: t.signal,
      program: path.join(root, 'packages/php-ext/tests/value.c'), sources: ['value.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = new URL('../../../../', import.meta.url);
const files = Object.fromEntries([
  'Makefile',
  'packages/php-ext/README.md',
  'packages/php-ext/README.ko.md',
].map(filename => [filename, readFileSync(new URL(filename, root), 'utf8')]));

test('The PHP module builds with phpize through the build-php-ext target of kit', { timeout: ENGINE_INSPECTION_BUDGET }, async () => {
  assert.match(files.Makefile, /^crudui-build: .*\bbuild-php-ext\b/m);
  for (const removed of [
    'scripts/php-extension-builder.mts',
    'scripts/build-crudui-php-extension.mts',
    'scripts/build-ordered-json-php-extension.mts',
    'scripts/build-php-extension.sh',
    'scripts/build-php-extension.mjs',
  ]) {
    await assert.rejects(access(new URL(removed, root)));
  }
  await access(new URL('packages/php-ext/src/config.m4', root));
});

test('PHP extension instructions use the build-php-ext target', { timeout: ENGINE_INSPECTION_BUDGET }, () => {
  for (const filename of ['packages/php-ext/README.md', 'packages/php-ext/README.ko.md']) {
    assert.match(files[filename], /make build-php-ext/);
    assert.doesNotMatch(files[filename], /sh scripts\/build-php-extension\.sh/);
  }
});

test('CRUDUI PHP extension package contains one C implementation', { timeout: ENGINE_INSPECTION_BUDGET }, async () => {
  const sourceRoot = new URL('packages/php-ext/', root);
  const generated = new Set(['.build', '.libs', 'autom4te.cache', 'build', 'include',
    'modules', 'target']);
  /** @type {string[]} */
  const prohibited = [];
  async function inspect(directory, relative = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      const filename = path.posix.join(relative, entry.name);
      if (entry.isDirectory() && !generated.has(entry.name)) await inspect(child, filename);
      else if (entry.isFile() && (entry.name === 'Cargo.toml'
        || entry.name === 'Cargo.lock' || entry.name.endsWith('.rs'))) prohibited.push(filename);
    }
  }
  await inspect(sourceRoot);
  prohibited.sort();
  assert.deepEqual(prohibited, []);
  for (const filename of ['packages/php-ext/README.md', 'packages/php-ext/README.ko.md']) {
    assert.doesNotMatch(files[filename], /\b(?:Cargo|Rust|rustc|rustdoc)\b/);
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
/* Byte strings and whether each is a sequence of Unicode scalar values (docs/spec/input-text.md). */
const textBytes = [
  [[], true], [[0x00, 0x41], true], [[0xc3, 0xa9], true], [[0xed, 0x9f, 0xbf], true], [[0xee, 0x80, 0x80], true],
  [[0xef, 0xbf, 0xbf], true], [[0xf0, 0x9f, 0x98, 0x80], true], [[0xf4, 0x8f, 0xbf, 0xbf], true],
  [[0xff], false], [[0x61, 0x80], false], [[0xe2, 0x82], false], [[0xc0, 0xaf], false], [[0xe0, 0x80, 0xaf], false],
  [[0xed, 0xa0, 0x80], false], [[0xed, 0xbf, 0xbf], false], [[0xf4, 0x90, 0x80, 0x80], false],
  [[0xf8, 0x88, 0x80, 0x80, 0x80], false], [[0xf0, 0x9f, 0x98], false],
];
function sourceForText() {
  const cases = textBytes.map(([bytes, valid]) =>
    `    {(const uint8_t *)"${bytes.map(byte => `\\${byte.toString(8).padStart(3, '0')}`).join('')}", ${bytes.length}, ${valid ? 'true' : 'false'}},`);
  return [
    '#include <stdio.h>',
    '#include "crudui_engine.h"',
    'int main(void) {',
    '  static const struct { const uint8_t *bytes; size_t length; bool valid; } cases[] = {',
    ...cases,
    '  };',
    '  int failed = 0;',
    '  for (size_t i = 0; i < sizeof(cases) / sizeof(cases[0]); ++i) {',
    '    ps_value *value = ps_value_new(PS_NULL);',
    '    ps_value *object = ps_value_new(PS_OBJECT);',
    '    bool stored = ps_value_string(value, cases[i].bytes, cases[i].length);',
    '    bool named = ps_value_insert(object, cases[i].bytes, cases[i].length, ps_value_new(PS_NULL));',
    '    if (ps_text_valid(cases[i].bytes, cases[i].length) != cases[i].valid || stored != cases[i].valid || named != cases[i].valid) {',
    '      printf("text case %zu differs\\n", i);',
    '      failed = 1;',
    '    }',
    '    ps_value_free(value);',
    '    ps_value_free(object);',
    '  }',
    '  return failed;',
    '}',
    '',
  ].join('\n');
}

test('PHP extension engine text is exactly Unicode scalar values', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-text-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForText(), name: 'text-valid',
      sources: ['value.c', 'number_text.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

test('a long C string initializes each char with a character constant of its byte', () => {
  const value = `${'\u00ec\u0000a'.repeat(1500)}\u{1f600}`;
  const source = cString(value);
  const elements = /^\(\(const char\[\]\)\{(.*)\}\)$/.exec(source)?.[1].split(',');
  assert.ok(elements, source.slice(0, 80));
  assert.deepEqual(elements.filter(element => /^\d+$/.test(element) && Number(element) > 127).slice(0, 3), [],
    'an integer above 127 initializes a char');
  const bytes = elements.map(element => {
    const constant = /^'\\([0-7]{3})'$/.exec(element);
    assert.ok(constant, `not a character constant: ${element}`);
    return Number.parseInt(constant[1], 8);
  });
  assert.deepEqual(Buffer.from(bytes), Buffer.concat([Buffer.from(value, 'utf8'), Buffer.from([0])]));
});

test('every C program of the engine tests compiles through one function that links the math library', async () => {
  const source = await readFile(new URL('./support.mjs', import.meta.url), 'utf8');
  const compilerUse = new RegExp(String.raw`process\.env\.` + 'CC\\b', 'g');
  const points = [...source.matchAll(compilerUse)].map(match => source.slice(0, match.index).split('\n').length);
  assert.equal(points.length, 1, `compiler commands on lines ${points.join(', ')}`);
  const at = source.search(compilerUse);
  assert.match(source.slice(at, source.indexOf('{ signal', at)), /'-lm'/, 'the compiler command links the math library');
});

test('a comma locale that localedef wrote with warnings is reported as written', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-comma-locale-'));
  const lines = [];
  const write = process.stderr.write.bind(process.stderr);
  t.mock.method(process.stderr, 'write', (chunk, ...rest) => { lines.push(String(chunk)); return write(chunk, ...rest); });
  try {
    // localedef exits with status 1 when it writes a locale with warnings; the stub does the same.
    const localedef = path.join(directory, 'localedef');
    await writeFile(localedef, '#!/bin/sh\nfor target; do :; done\nmkdir -p "$target" && : > "$target/LC_NUMERIC"\necho "warning: no category LC_CTYPE" >&2\nexit 1\n', { mode: 0o755 });
    const environment = await commaLocaleEnvironment(directory, t.signal, { systemLocale: false, localedef });
    assert.equal(environment.LC_ALL, 'crudui-comma');
    const reported = lines.join('').split('\n').filter(line => line.includes('comma locale: compiling:') && !line.endsWith('started'));
    assert.deepEqual(reported.map(line => line.trim().replace(/ in \d+\.\d+s$/, '')),
      ['comma locale: compiling: wrote the locale with warnings (exit 1)']);
    // Without the locale, the same status is a failure.
    await writeFile(localedef, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    await rm(path.join(directory, 'locales'), { recursive: true, force: true });
    await assert.rejects(commaLocaleEnvironment(directory, t.signal, { systemLocale: false, localedef }), /localedef wrote no locale/);
    assert.match(lines.join(''), /comma locale: compiling: failed \(1\)/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

