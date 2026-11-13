import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';
import { setup, teardown } from '@polyspec/kit/test-hooks';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Node } from '@polyspec/crudui-generator-react';
import { buildDetail } from '@polyspec/crudui-generator-core';
import { dateCases, dateListSpec, imageCase, numberCases, urlCase } from '../../../../tests/native-generators/cases.mts';
import { dispatch, errorRecord } from '../../../../tests/native-generators/javascript.mts';

import { cString, cText, EngineFixtureSource, assertCasesReported, casePassed, fixtureProgram, runUnderCommaLocale, ENGINE_TEST_BUDGET, ENGINE_SANITIZER_BUDGET, compileAndRunEngineFixture, compileEngineFixture, runEngineProgram } from '../engine/support.mjs';

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixtures = JSON.parse(readFileSync(
  path.join(root, 'legacy/tests/fixtures/form-render/cases.json'), 'utf8'));

function sourceForFixtures() {
  const builder = new EngineFixtureSource();
  const { lines } = builder;
  fixtures.forEach((fixture, index) => {
    const request = { operation: 'compileForm', spec: fixture.spec, options: fixture.options ?? {} };
    let expected;
    let expectedError;
    try { expected = JSON.parse(JSON.stringify(dispatch(request))); }
    catch (error) { expectedError = errorRecord(error); }
    lines.push('  {', `  /* ${fixture.name} */`);
    const spec = builder.emit(request.spec);
    const options = builder.emit(request.options);
    lines.push(`  ps_result actual = ps_compile_form(${spec}, ${options});`);
    if (expectedError) {
      lines.push(`  if (actual.value || !actual.error || !text_is(ps_get(actual.error, "code"), ${cText(expectedError.code)})) { print_text("error differs: ", ${cText(fixture.name)}); return ${index + 1}; }`);
    } else {
      const value = builder.emit(expected);
      lines.push(`  if (!actual.value || actual.error || !ps_equal(actual.value, ${value})) { print_text("template differs: ", ${cText(fixture.name)}); return ${index + 1}; }`);
      lines.push(`  ps_value_free(${value});`);
    }
    lines.push(`  ps_value_free(actual.value); ps_value_free(actual.error); ps_value_free(${spec}); ps_value_free(${options});`, casePassed(index + 1), '  }');
  });
  return fixtureProgram(lines);
}

test('PHP extension engine compiles every shared form fixture', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-compile-'));
  let output = '';
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForFixtures(), name: 'compile-fixtures',
      onOutput: stdout => { output = stdout; },
      sources: [
        'value.c', 'number_text.c', 'engine_error.c', 'compose.c', 'declaration.c', 'template.c',
        'canonical.c', 'rule_number.c', 'rule_length.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'group_source.c',
      ],
    });
    assertCasesReported(output, fixtures.length,
      'the extension engine compiles each case of legacy/tests/fixtures/form-render/cases.json');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixtures = JSON.parse(readFileSync(
  path.join(root, 'legacy/tests/fixtures/form-render/cases.json'), 'utf8'));
// A fixture that compilation rejects with a CRUDUI error, of any code, has no template to bind; the compilation test
// covers it.
const bindFixtures = fixtures.filter(fixture => {
  try { dispatch({ operation: 'compileForm', spec: fixture.spec, options: fixture.options ?? {} }); return true; }
  catch (error) { if (typeof error?.code !== 'string') throw error; return false; }
});

// The binding options that bindForm rejects, each with its message.
const optionRejections = [
  [{ language: 'fr' }, 'Unsupported language: fr'], [{ language: '' }, 'Unsupported language: '],
  [{ language: 5 }, 'Language must be a string'], [{ language: false }, 'Language must be a string'],
  [{ language: ['ko'] }, 'Language must be a string'], [{ language: { ko: 'ko' } }, 'Language must be a string'],
  [{ unsupported: true }, 'unsupported must be throw or marker'],
  [{ language: 'fr', unsupported: 'other' }, 'unsupported must be throw or marker'],
];

function sourceForFixtures() {
  const builder = new EngineFixtureSource();
  const { lines } = builder;
  bindFixtures.forEach((fixture, index) => {
    const options = fixture.options ?? {};
    const template = JSON.parse(JSON.stringify(
      dispatch({ operation: 'compileForm', spec: fixture.spec, options })));
    let expected;
    let expectedError;
    try {
      expected = JSON.parse(JSON.stringify(dispatch({
        operation: 'bindForm', template, data: fixture.data ?? {}, options,
      })));
    } catch (error) {
      expectedError = errorRecord(error);
    }
    lines.push('  {', `  /* ${fixture.name} */`);
    const templateValue = builder.emit(template);
    const dataValue = builder.emit(fixture.data ?? {});
    const optionsValue = builder.emit(options);
    lines.push(`  ps_value *template_before = ps_value_clone(${templateValue});`);
    lines.push(`  ps_value *data_before = ps_value_clone(${dataValue});`);
    lines.push(`  ps_result actual = ps_bind_form(${templateValue}, ${dataValue}, ${optionsValue});`);
    if (expectedError) {
      lines.push(`  if (actual.value || !actual.error || !text_is(ps_get(actual.error, "code"), ${cText(expectedError.code)}) || !text_is(ps_get(actual.error, "at"), ${cText(expectedError.at)})) { print_text("error differs: ", ${cText(fixture.name)}); return ${index + 1}; }`);
    } else {
      const expectedValue = builder.emit(expected);
      lines.push(`  if (!actual.value || actual.error || !ps_equal(actual.value, ${expectedValue})) {`);
      lines.push(`    print_text("fields differ: ", ${cText(fixture.name)});`);
      lines.push(`    print_json("actual: ", actual.value); print_json("expected: ", ${expectedValue});`);
      lines.push(`    return ${index + 1}; }`);
      lines.push(`  ps_value_free(${expectedValue});`);
    }
    lines.push(`  if (!ps_equal(${templateValue}, template_before) || !ps_equal(${dataValue}, data_before)) { print_text("input changed: ", ${cText(fixture.name)}); return ${index + 1}; }`);
    lines.push(`  ps_value_free(template_before); ps_value_free(data_before); ps_value_free(actual.value); ps_value_free(actual.error); ps_value_free(${templateValue}); ps_value_free(${dataValue}); ps_value_free(${optionsValue});`, casePassed(index + 1), '  }');
  });
  const template = dispatch({ operation: 'compileForm', spec: { type: 'group', properties: { name: { type: 'text' } } }, options: {} });
  optionRejections.forEach(([options, message], index) => {
    let languageError;
    try { dispatch({ operation: 'bindForm', template, data: {}, options }); }
    catch (error) { languageError = errorRecord(error); }
    assert.deepEqual(languageError, { code: 'INVALID_FORM_INPUT', message, at: '' });
    lines.push('  {', `  /* option-rejection-${index} */`);
    const templateValue = builder.emit(JSON.parse(JSON.stringify(template)));
    const dataValue = builder.emit({});
    const optionsValue = builder.emit(options);
    lines.push(`  ps_result actual = ps_bind_form(${templateValue}, ${dataValue}, ${optionsValue});`);
    lines.push(`  if (actual.value || !actual.error || !text_is(ps_get(actual.error, "code"), ${cText(languageError.code)}) || !text_is(ps_get(actual.error, "message"), ${cText(languageError.message)}) || !text_is(ps_get(actual.error, "at"), PS_TEXT(""))) { print_text("error differs: ", ${cText(`option-rejection-${index}`)}); return ${bindFixtures.length + 1 + index}; }`);
    lines.push(`  ps_value_free(actual.error); ps_value_free(${templateValue}); ps_value_free(${dataValue}); ps_value_free(${optionsValue});`, casePassed(bindFixtures.length + 1 + index), '  }');
  });
  return fixtureProgram(lines);
}

describe('prepared engine binding programs', () => {
const sources = [
  'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'expression.c',
  'runtime.c', 'date.c', 'design.c', 'widget.c', 'rule_condition_tree.c', 'messages.c', 'interface_messages.c', 'binding.c', 'declaration.c', 'choice_list.c', 'group_source.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'canonical.c',
];
let directory;
let preparedBinding;
let preparedSanitizer;
setup('compile binding fixtures', async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-bind-'));
  const source = sourceForFixtures();
  preparedBinding = await compileEngineFixture({ root, directory, source, name: 'bind-fixtures', sources });
  preparedSanitizer = await compileEngineFixture({
    root, directory, source, name: 'bind-fixtures-sanitize', sources,
    compilerFlags: ['-fsanitize=undefined', '-fno-omit-frame-pointer'],
  });
});
teardown('remove binding fixtures', async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('PHP extension engine binds every shared form fixture without changing inputs', { timeout: ENGINE_TEST_BUDGET }, async t => {
  // A case that compilation rejects is left to the compilation test only when the case expects an error.
  assert.deepEqual(fixtures.filter(fixture => !bindFixtures.includes(fixture) && !fixture.expectError).map(fixture => fixture.name), [],
    'every case of legacy/tests/fixtures/form-render/cases.json without expectError compiles, so the binding test binds it');
  let output = '';
  await runEngineProgram({ ...preparedBinding, signal: t.signal, onOutput: stdout => { output = stdout; } });
  assertCasesReported(output, bindFixtures.length + optionRejections.length,
    'the extension engine binds each case of legacy/tests/fixtures/form-render/cases.json that compiles, and each option rejection');
});

test('PHP extension engine binding has no undefined behavior findings', { timeout: ENGINE_SANITIZER_BUDGET }, async t => {
  await runEngineProgram({
    ...preparedSanitizer, signal: t.signal,
    runEnvironment: { ...process.env, UBSAN_OPTIONS: 'halt_on_error=1' },
  });
});
});

}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixtures = JSON.parse(readFileSync(
  path.join(root, 'legacy/tests/fixtures/form-render/cases.json'), 'utf8'));
const renderFixtures = fixtures.filter(fixture => !fixture.expectError);
const edgeFixtures = [
  {
    name: 'raw-event-attribute-escaping',
    spec: {
      type: 'group',
      properties: {
        value: {
          type: 'text',
          behavior: { onchange: 'if (a > b && c < d) run("x")' },
        },
      },
    },
    data: { value: 'a > b' },
  },
  {
    name: 'style-property-normalization',
    spec: {
      type: 'group',
      properties: {
        value: {
          type: 'text',
          design: {
            style: 'color /* current */: red; backgroundColor: black; msTransform: scale(1); color: blue',
          },
        },
      },
    },
  },
];
const allRenderFixtures = [...renderFixtures, ...edgeFixtures];

function renderFields(fields) {
  return renderToStaticMarkup(createElement(
    'div', { className: 'crudui-form' },
    createElement('div', { className: 'crudui-form__body' },
      fields.map(vm => createElement(Node, { key: vm.path, vm }))),
  ));
}

function sourceForFixtures() {
  const builder = new EngineFixtureSource();
  const { lines } = builder;
  allRenderFixtures.forEach((fixture, index) => {
    const options = fixture.options ?? {};
    const template = JSON.parse(JSON.stringify(
      dispatch({ operation: 'compileForm', spec: fixture.spec, options })));
    const expectedFields = JSON.parse(JSON.stringify(dispatch({
      operation: 'bindForm', template, data: fixture.data ?? {}, options,
    })));
    const expectedHtml = renderFields(expectedFields);
    lines.push('  {', `  /* ${fixture.name} */`);
    const templateValue = builder.emit(template);
    const dataValue = builder.emit(fixture.data ?? {});
    const optionsValue = builder.emit(options);
    lines.push(`  ps_result fields = ps_bind_form(${templateValue}, ${dataValue}, ${optionsValue});`);
    lines.push('  if (!fields.value || fields.error) { fputs("binding failed\\n", stderr); return 1; }');
    lines.push('  ps_value *fields_before = ps_value_clone(fields.value);');
    lines.push('  ps_chars actual = ps_render_fields(fields.value);');
    lines.push(`  if (!actual.bytes || !ps_text_equal(ps_view(actual), ${cText(expectedHtml)})) {`);
    lines.push(`    print_text("HTML differs: ", ${cText(fixture.name)});`);
    lines.push(`    print_text("actual: ", actual.bytes ? ps_view(actual) : PS_TEXT("null")); print_text("expected: ", ${cText(expectedHtml)});`);
    lines.push(`    free(actual.bytes); return ${index + 1}; }`);
    lines.push(`  if (!fields_before || !ps_equal(fields.value, fields_before)) { print_text("fields changed: ", ${cText(fixture.name)}); return ${index + 1}; }`);
    lines.push(`  free(actual.bytes); ps_value_free(fields_before); ps_value_free(fields.value); ps_value_free(fields.error); ps_value_free(${templateValue}); ps_value_free(${dataValue}); ps_value_free(${optionsValue});`, casePassed(index + 1), '  }');
  });
  return fixtureProgram(lines);
}

test('PHP extension engine renders successful shared form fixtures and edge cases as exact HTML', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-render-'));
  let output = '';
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForFixtures(), name: 'render-fixtures',
      onOutput: stdout => { output = stdout; },
      sources: [
        'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'expression.c',
        'runtime.c', 'date.c', 'design.c', 'widget.c', 'rule_condition_tree.c', 'messages.c', 'interface_messages.c', 'binding.c', 'declaration.c', 'html.c', 'render.c', 'choice_list.c', 'group_source.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'canonical.c',
      ],
    });
    assertCasesReported(output, allRenderFixtures.length,
      'the extension engine renders each case of legacy/tests/fixtures/form-render/cases.json without expectError, and each edge case');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('PHP extension engine form rendering does not depend on a comma decimal locale', { timeout: ENGINE_TEST_BUDGET }, async t => {
  await runUnderCommaLocale({
    signal: t.signal, root, prefix: 'crudui-c-render-locale-', name: 'render-fixtures-locale', source: sourceForFixtures(),
    sources: [
      'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'expression.c',
      'runtime.c', 'date.c', 'design.c', 'widget.c', 'rule_condition_tree.c', 'messages.c', 'interface_messages.c', 'binding.c', 'declaration.c', 'html.c', 'render.c', 'choice_list.c', 'group_source.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'canonical.c',
    ],
  });
});

test('PHP extension engine form rendering has no undefined behavior findings', { timeout: ENGINE_SANITIZER_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-render-sanitize-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForFixtures(), name: 'render-fixtures-sanitize',
      sources: [
        'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'expression.c',
        'runtime.c', 'date.c', 'design.c', 'widget.c', 'rule_condition_tree.c', 'messages.c', 'interface_messages.c', 'binding.c', 'declaration.c', 'html.c', 'render.c', 'choice_list.c', 'group_source.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'canonical.c',
      ],
      compilerFlags: ['-fsanitize=undefined', '-fno-omit-frame-pointer'],
      runEnvironment: {
        ...process.env,
        UBSAN_OPTIONS: 'halt_on_error=1',
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixtures = JSON.parse(readFileSync(
  path.join(root, 'legacy/tests/fixtures/list-render/cases.json'), 'utf8'));
const additionalFixtures = [
  imageCase,
  urlCase,
  ...numberCases.map((item, index) => ({
    name: `number-${index}`,
    spec: {
      columns: {
        number: {
          field: 'number',
          format: {
            type: 'number',
            ...(Object.hasOwn(item, 'decimals') ? { decimals: item.decimals } : {}),
          },
        },
      },
    },
    rows: [{ number: item.value }],
  })),
  {
    name: 'date-values',
    spec: dateListSpec,
    rows: dateCases.map(item => ({ value: item.value })),
  },
];
const listFixtures = [...fixtures, ...additionalFixtures];

function sourceForFixtures() {
  const builder = new EngineFixtureSource();
  const { lines } = builder;
  listFixtures.forEach((fixture, index) => {
    const options = fixture.options ?? {};
    let expected;
    let expectedError;
    try {
      expected = dispatch({
        operation: 'renderList', spec: fixture.spec, rows: fixture.rows ?? [], options,
      });
    } catch (error) {
      expectedError = errorRecord(error);
    }
    lines.push('  {', `  /* ${fixture.name} */`);
    const specValue = builder.emit(fixture.spec);
    const rowsValue = builder.emit(fixture.rows ?? []);
    const optionsValue = builder.emit(options);
    lines.push(`  ps_value *spec_before = ps_value_clone(${specValue});`);
    lines.push(`  ps_value *rows_before = ps_value_clone(${rowsValue});`);
    lines.push(`  ps_value *options_before = ps_value_clone(${optionsValue});`);
    lines.push(`  ps_result actual = ps_render_list(${specValue}, ${rowsValue}, ${optionsValue});`);
    if (expectedError) {
      lines.push(`  if (actual.value || !actual.error || !text_is(ps_get(actual.error, "code"), ${cText(expectedError.code)}) || !text_is(ps_get(actual.error, "message"), ${cText(expectedError.message)}) || !text_is(ps_get(actual.error, "at"), ${cText(expectedError.at)})) { print_text("error differs: ", ${cText(fixture.name)}); return ${index + 1}; }`);
    } else {
      lines.push(`  if (!actual.value || actual.error || !text_is(actual.value, ${cText(expected)})) {`);
      lines.push(`    print_text("HTML differs: ", ${cText(fixture.name)});`);
      lines.push(`    print_text("actual: ", actual.value ? ps_string(actual.value) : PS_TEXT("null")); print_text("expected: ", ${cText(expected)});`);
      lines.push(`    return ${index + 1}; }`);
    }
    lines.push(`  if (!spec_before || !rows_before || !options_before || !ps_equal(${specValue}, spec_before) || !ps_equal(${rowsValue}, rows_before) || !ps_equal(${optionsValue}, options_before)) { print_text("input changed: ", ${cText(fixture.name)}); return ${index + 1}; }`);
    lines.push(`  ps_value_free(spec_before); ps_value_free(rows_before); ps_value_free(options_before); ps_value_free(actual.value); ps_value_free(actual.error); ps_value_free(${specValue}); ps_value_free(${rowsValue}); ps_value_free(${optionsValue});`, casePassed(index + 1), '  }');
  });
  return fixtureProgram(lines);
}

const sources = [
  'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'expression.c',
  'runtime.c', 'date.c', 'design.c', 'compose.c', 'declaration.c', 'display_declaration.c', 'forbidden_scan.c', 'html.c',
  'list.c', 'messages.c', 'interface_messages.c', 'choice_list.c', 'group_source.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'canonical.c',
];

test('PHP extension engine renders the complete list target as exact HTML', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-list-'));
  let output = '';
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForFixtures(), name: 'list-fixtures', sources,
      onOutput: stdout => { output = stdout; },
    });
    assertCasesReported(output, listFixtures.length,
      'the extension engine renders each case of legacy/tests/fixtures/list-render/cases.json, each number case and the date case');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('PHP extension engine list rendering does not depend on a comma decimal locale', { timeout: ENGINE_TEST_BUDGET }, async t => {
  await runUnderCommaLocale({
    signal: t.signal, root, prefix: 'crudui-c-list-locale-', name: 'list-fixtures-locale', source: sourceForFixtures(), sources,
  });
});

test('PHP extension engine list rendering has no undefined behavior findings', { timeout: ENGINE_SANITIZER_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-list-sanitize-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForFixtures(), name: 'list-fixtures-sanitize', sources,
      compilerFlags: ['-fsanitize=undefined', '-fno-omit-frame-pointer'],
      runEnvironment: { ...process.env, UBSAN_OPTIONS: 'halt_on_error=1' },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}

{
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixtures = JSON.parse(readFileSync(
  path.join(root, 'legacy/tests/fixtures/detail-render/cases.json'), 'utf8'));
const fieldMembers = ['key', 'label', 'format', 'value', 'display', 'design'];

function expectation(operation, fixture) {
  const record = fixture.record ?? {};
  const options = fixture.options ?? {};
  try {
    if (operation === 'render')
      return { value: dispatch({ operation: 'renderDetail', spec: fixture.spec, record, options }) };
    const model = buildDetail(fixture.spec, record, options);
    return {
      value: JSON.parse(JSON.stringify({
        fields: model.fields.map(field => Object.fromEntries(fieldMembers.map(
          key => [key, key === 'value' && field.value === undefined ? null : field[key]]))),
        actions: model.actions,
        design: model.design,
      })),
    };
  } catch (error) {
    return { error: errorRecord(error) };
  }
}

function sourceForFixtures() {
  const builder = new EngineFixtureSource();
  const { lines } = builder;
  let status = 1;
  for (const fixture of fixtures) {
    for (const operation of ['render', 'build']) {
      const name = `${operation}:${fixture.name}`;
      const { value: expected, error } = expectation(operation, fixture);
      if (fixture.expectError) assert.deepEqual({ code: error.code, message: error.message }, fixture.expectError);
      lines.push('  {', `  /* ${name} */`);
      const specValue = builder.emit(fixture.spec);
      const recordValue = builder.emit(fixture.record ?? {});
      const optionsValue = builder.emit(fixture.options ?? {});
      const inputs = [specValue, recordValue, optionsValue];
      lines.push(...inputs.map(value => `  ps_value *${value}_before = ps_value_clone(${value});`));
      lines.push(`  ps_result actual = ps_${operation}_detail(${inputs.join(', ')});`);
      if (error) {
        lines.push(`  if (actual.value || !actual.error || !text_is(ps_get(actual.error, "code"), ${cText(error.code)}) || !text_is(ps_get(actual.error, "message"), ${cText(error.message)}) || !text_is(ps_get(actual.error, "at"), ${cText(error.at)})) { print_text("error differs: ", ${cText(name)}); return ${status}; }`);
      } else if (operation === 'render') {
        lines.push(`  if (!actual.value || actual.error || !text_is(actual.value, ${cText(expected)})) {`);
        lines.push(`    print_text("HTML differs: ", ${cText(name)});`);
        lines.push(`    print_text("actual: ", actual.value ? ps_string(actual.value) : PS_TEXT("null")); print_text("expected: ", ${cText(expected)});`);
        lines.push(`    return ${status}; }`);
      } else {
        const expectedValue = builder.emit(expected);
        lines.push(`  if (!actual.value || actual.error || !ps_equal(actual.value, ${expectedValue})) {`);
        lines.push(`    print_text("model differs: ", ${cText(name)});`);
        lines.push(`    print_json("actual: ", actual.value); print_json("expected: ", ${expectedValue});`);
        lines.push(`    return ${status}; }`);
        lines.push(`  if (!member_order(actual.value, (const char *[]){"fields", "actions", "design"}, 3)) { print_text("model member order differs: ", ${cText(name)}); return ${status}; }`);
        lines.push(`  for (size_t i = 0; i < ps_size(ps_get(actual.value, "fields")); ++i)`);
        lines.push(`    if (!member_order(ps_at(ps_get(actual.value, "fields"), i), (const char *[]){${fieldMembers.map(cString).join(', ')}}, ${fieldMembers.length})) { print_text("field member order differs: ", ${cText(name)}); return ${status}; }`);
        lines.push(`  ps_value_free(${expectedValue});`);
      }
      lines.push(`  if (${inputs.map(value => `!ps_equal(${value}, ${value}_before)`).join(' || ')}) { print_text("input changed: ", ${cText(name)}); return ${status}; }`);
      lines.push(`  ps_value_free(actual.value); ps_value_free(actual.error);`);
      lines.push(...inputs.map(value => `  ps_value_free(${value}); ps_value_free(${value}_before);`), casePassed(status), '  }');
      status += 1;
    }
  }
  return fixtureProgram(lines, [
    'static bool member_order(const ps_value *object, const char *const *keys, size_t count)',
    '{',
    '  if (!object || ps_size(object) != count) return false;',
    '  for (size_t i = 0; i < count; ++i) if (!ps_text_is(ps_key(object, i), keys[i])) return false;',
    '  return true;',
    '}',
    '',
  ]);
}

const sources = [
  'value.c', 'number_text.c', 'value_path.c', 'engine_error.c', 'expression.c',
  'runtime.c', 'date.c', 'design.c', 'compose.c', 'declaration.c', 'display_declaration.c', 'forbidden_scan.c', 'html.c',
  'list.c', 'messages.c', 'interface_messages.c', 'choice_list.c', 'group_source.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c', 'canonical.c',
];

test('PHP extension engine renders and builds every shared detail fixture', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const missing = expectation('build', fixtures.find(fixture => fixture.name === 'missing-value'));
  assert.equal(missing.value.fields[0].value, null);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-detail-'));
  let output = '';
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForFixtures(), name: 'detail-fixtures', sources,
      onOutput: stdout => { output = stdout; },
    });
    assertCasesReported(output, fixtures.length * 2,
      'the extension engine renders and builds each case of legacy/tests/fixtures/detail-render/cases.json');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('PHP extension engine detail evaluation has no undefined behavior findings', { timeout: ENGINE_SANITIZER_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-detail-sanitize-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForFixtures(), name: 'detail-fixtures-sanitize', sources,
      compilerFlags: ['-fsanitize=undefined', '-fno-omit-frame-pointer'],
      runEnvironment: { ...process.env, UBSAN_OPTIONS: 'halt_on_error=1' },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
}
