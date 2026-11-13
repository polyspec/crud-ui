#!/usr/bin/env node
import { caseFiles, caseGroup, caseValue } from '../tests/case-values.mts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import ajvFormats from 'ajv-formats';
import YAML from 'yaml';
import { checkedShape, shapeOf } from './json-schema.mts';

// The shapes that the helpers of this script check (kit K157, K158): an object, an array, a string and an array of strings.
const OBJECT = shapeOf<Record<string, unknown>>({ type: 'object' });
const ARRAY = shapeOf<unknown[]>({ type: 'array' });
const STRING = shapeOf<string>({ type: 'string' });

// ajv-formats is a CommonJS module: its plugin is the `default` of module.exports.
const addFormats = ajvFormats.default;

/** The parts of contracts/schema/crudui.schema.json that this check reads. */
interface MetaSchema {
  $schema: string;
  definitions: {
    Validate: { anyOf: { type?: string, properties?: Record<string, unknown> }[] },
    Messages: { properties: Record<string, unknown> },
  };
}

/** A case of a structure-validity family (spec-validity, list-validity, detail-validity). */
interface ValidityCase {
  name: string;
  note: string;
  spec: unknown;
  files?: Record<string, unknown>;
  expect: 'ok' | 'fail';
  reason?: string;
  engine: unknown;
}

/** A case of a fixture family that holds a specification. */
/** A case of the compose fixtures. */
/** A request of the cross-check console's validator processes. */
/** An example of the cross-check console client. */
interface ConsoleExample {
  id: string;
  spec: string;
}

/** The child map definition that holds a `$ref`. */
type Slot = 'properties' | 'columns' | 'fields';

const repository = fileURLToPath(new URL('..', import.meta.url));
const at = (relative: string): string => path.join(repository, relative);
const readText = (relative: string): string => readFileSync(at(relative), 'utf8');
/** A JSON file of this repository, relative to this script, as an unknown value that its caller checks. */
const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
/** The cases of the JSON file `path`: an array of objects, each with a string name. */
/**
 * A case of a family in the case form of binding (G-5), with its specification, data and files decoded and its failure
 * as the record of the family: `expectFailure` of the validation cases and `engine` of the structure-validity cases.
 */
function decodedCase(item: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, options: _options, raises, spec, data, ...rest } = item;
  const files = caseFiles(item);
  const failure = OBJECT(raises) ? { code: String(raises.kind).toUpperCase(), at: raises.at } : undefined;
  const message = OBJECT(raises) ? raises.message : undefined;
  const failureKey = 'expect' in rest ? 'engine' : 'expected_html' in rest || 'rows' in item || 'record' in item ? 'expectError' : 'expectFailure';
  return {
    ...rest,
    ...(spec === undefined ? {} : { spec: caseValue(spec) }),
    ...(data === undefined ? {} : { data: caseValue(data) }),
    ...(files === undefined ? {} : { files }),
    ...(failureKey === 'engine' ? { engine: failure ?? 'pass' } : failure === undefined ? {} : { [failureKey]: { ...failure, message } }),
  };
}
/** The cases of a fixture: the group `cases` of a file in the case form, decoded, or the list of a file of its own form. */
const fixtureItems = (path: string): unknown[] => {
  const document = read(path);
  return Array.isArray(document) ? document
    : Object.keys(OBJECT(document) ? document : {}).flatMap((group) => caseGroup(document, group)).map(decodedCase);
};
const readCases = (path: string): (Record<string, unknown> & { name: string })[] =>
  checkedShape(ARRAY, fixtureItems(path), path).map((item, index) => {
    const test = checkedShape(OBJECT, item, `${path}[${index}]`);
    return { ...test, name: checkedShape(STRING, test.name, `${path}[${index}].name`) };
  });
/** `value` of the case `label`, an optional object of files. */
const optionalFiles = (value: unknown, label: string): Record<string, unknown> | undefined =>
  value === undefined ? undefined : checkedShape(OBJECT, value, `${label}: files`);

/** contracts/schema/crudui.schema.json in the members that the check reads. */
function metaSchema(value: unknown): MetaSchema {
  const file = 'contracts/schema/crudui.schema.json';
  const root = checkedShape(OBJECT, value, file);
  const definitions = checkedShape(OBJECT, root.definitions, `definitions of ${file}`);
  const anyOf = checkedShape(ARRAY, checkedShape(OBJECT, definitions.Validate, `definitions.Validate of ${file}`).anyOf, `definitions.Validate.anyOf of ${file}`)
    .map((shape, index) => {
      const what = `definitions.Validate.anyOf[${index}] of ${file}`;
      const { type, properties } = checkedShape(OBJECT, shape, what);
      return {
        ...(type === undefined ? {} : { type: checkedShape(STRING, type, `type of ${what}`) }),
        ...(properties === undefined ? {} : { properties: checkedShape(OBJECT, properties, `properties of ${what}`) }),
      };
    });
  const messages = checkedShape(OBJECT, checkedShape(OBJECT, definitions.Messages, `definitions.Messages of ${file}`).properties, `definitions.Messages.properties of ${file}`);
  return { $schema: checkedShape(STRING, root.$schema, `$schema of ${file}`), definitions: { Validate: { anyOf }, Messages: { properties: messages } } };
}
const schemaDocument = checkedShape(OBJECT, read('../contracts/schema/crudui.schema.json'), 'contracts/schema/crudui.schema.json');
const schema = metaSchema(schemaDocument);
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
assert.equal(ajv.validateSchema(schemaDocument), true, JSON.stringify(ajv.errors));
const entry = (definition: string): ValidateFunction =>
  ajv.compile({ $schema: schema.$schema, definitions: schemaDocument.definitions, $ref: `#/definitions/${definition}` });
const validateForm = ajv.compile(schemaDocument);
const validateList = entry('List');
const validateDetail = entry('Detail');
// Composition files are validated as the fragment a `$ref` selects in them: a form
// field map, list columns or detail fields.
const validateProperties = entry('Properties');
const validateColumns = entry('Columns');
const validateDetailFields = entry('DetailFields');

let checked = 0;
for (const [multiple, expected] of [
  [{ min: 0, max: 3 }, true],
  [{ min: 'one' }, false],
  [{ copy: true, sortable: true }, true],
  [{ copy: {} }, false],
  [{ title: 'name', controls: 'outline', header: 'sticky' }, true],
  [{ controls: 'side' }, false],
  [{ header: 'fixed' }, false],
  // `multiple: only` is `multiple.only: true`: it combines with title and header only.
  ['only', true],
  [{ only: true }, true],
  [{ only: true, title: 'name', header: 'sticky' }, true],
  [{ only: false, min: 1, copy: true }, true],
  ['all', false],
  [{ only: 'yes' }, false],
  [{ only: true, min: 1 }, false],
  [{ only: true, max: 3 }, false],
  [{ only: true, copy: true }, false],
  [{ only: true, sortable: true }, false],
  [{ only: true, controls: 'header' }, false],
  [{ only: true, onclick: 'go()' }, false],
]) {
  const spec = { type: 'group', properties: { rows: { type: 'text', multiple } } };
  assert.equal(validateForm(spec), expected, `multiple: ${JSON.stringify(validateForm.errors)}`);
  checked++;
}
for (const [extra, expected] of [
  [{ buttons: [{ type: 'submit', name: '__submitted__', value: 'go', text: { ko: '저장', en: 'Save' }, design: { class: 'primary' } }] }, true],
  [{ buttons: [{ type: 'reset' }, { type: 'button', text: 'Cancel', behavior: { onclick: 'history.back()' } }] }, true],
  [{ buttons: [{ type: 'link', text: 'List', href: '../' }], action: { method: 'post', url: '/save' } }, true],
  [{ buttons: [{ type: 'image' }] }, false],
  [{ buttons: [{ type: 'button' }] }, false],
  [{ buttons: [{ type: 'link', text: 'List' }] }, false],
  [{ action: { target: '_blank' } }, false],
] satisfies [Record<string, unknown>, boolean][]) {
  const spec = { type: 'group', properties: { name: { type: 'text' } }, ...extra };
  assert.equal(validateForm(spec), expected, `buttons: ${JSON.stringify(extra)} ${JSON.stringify(validateForm.errors)}`);
  checked++;
}
// Declared attributes (docs/spec/schema.md, Declared attributes): form fields only, data-* or
// aria-* names that crudui does not write, string values.
for (const [label, properties, expected] of [
  ['control and wrapper', { theme: { type: 'text', design: { attributes: { 'data-setting': 'theme', 'aria-describedby': 'help' }, wrapper: { class: 'row', attributes: { 'data-section': 'look' } } } } }, true],
  ['event name', { theme: { type: 'text', design: { attributes: { onclick: 'go()' } } } }, false],
  ['uppercase name', { theme: { type: 'text', design: { attributes: { 'data-Key': 'x' } } } }, false],
  ['bare prefix', { theme: { type: 'text', design: { attributes: { 'aria-': 'x' } } } }, false],
  ['owned name', { theme: { type: 'text', design: { attributes: { 'data-rule-name': 'x' } } } }, false],
  ['owned prefix', { theme: { type: 'text', design: { wrapper: { attributes: { 'data-crudui-row-key': 'x' } } } } }, false],
  ['number value', { theme: { type: 'text', design: { attributes: { 'data-count': 1 } } } }, false],
  ['label node', { theme: { type: 'text', design: { label: { attributes: { 'data-x': '1' } } } } }, false],
] satisfies [string, Record<string, unknown>, boolean][]) {
  const spec = { type: 'group', properties };
  assert.equal(validateForm(spec), expected, `declared attributes, ${label}: ${JSON.stringify(validateForm.errors)}`);
  checked++;
}
for (const [label, valid, value] of [
  ['form button', validateForm, { type: 'group', properties: { theme: { type: 'text' } }, buttons: [{ type: 'submit', design: { attributes: { 'data-x': '1' } } }] }],
  ['list column', validateList, { columns: { a: { field: 'a', design: { attributes: { 'data-x': '1' } } } } }],
  ['detail field', validateDetail, { fields: { a: { field: 'a', design: { attributes: { 'data-x': '1' } } } } }],
] satisfies [string, ValidateFunction, unknown][]) {
  assert.equal(valid(value), false, `declared attributes are rejected on a ${label}`);
  checked++;
}
// Range fields (docs/spec/schema.md, Range fields): literal bounds and a literal step, or a
// composition reference that supplies them.
for (const [label, field, expected] of [
  ['bounds and step', { type: 'range', append: '%', validate: { range: [0, 100], step: 5 } }, true],
  ['reference', { type: 'range', $ref: 'volume.yml' }, true],
  ['no validate', { type: 'range' }, false],
  ['no step', { type: 'range', validate: { range: [0, 100] } }, false],
  ['expression bounds', { type: 'range', validate: { range: '.limits', step: 1 } }, false],
  ['zero step', { type: 'range', validate: { range: [0, 100], step: 0 } }, false],
  ['condition map step', { type: 'range', validate: { range: [0, 100], step: { '.fine': 0.1, true: 1 } } }, false],
] satisfies [string, Record<string, unknown>, boolean][]) {
  const spec = { type: 'group', properties: { volume: field } };
  assert.equal(validateForm(spec), expected, `range field, ${label}: ${JSON.stringify(validateForm.errors)}`);
  checked++;
}
// Condition fields (docs/spec/schema.md, Condition fields): the literal conditionTree true or judge,
// or a composition reference that supplies it.
for (const [label, field, expected] of [
  ['true', { type: 'condition', validate: { conditionTree: true } }, true],
  ['judge', { type: 'condition', validate: { required: true, conditionTree: 'judge' } }, true],
  ['reference', { type: 'condition', $ref: 'pass.yml' }, true],
  ['no validate', { type: 'condition' }, false],
  ['no conditionTree', { type: 'condition', validate: { required: true } }, false],
  ['false', { type: 'condition', validate: { conditionTree: false } }, false],
  ['null', { type: 'condition', validate: { conditionTree: null } }, false],
] satisfies [string, Record<string, unknown>, boolean][]) {
  const spec = { type: 'group', properties: { pass: field } };
  assert.equal(validateForm(spec), expected, `condition field, ${label}: ${JSON.stringify(validateForm.errors)}`);
  checked++;
}
// Choice appearance (docs/spec/schema.md, Choice appearance): the choices of a field's items may
// declare a label class and style and input attributes; `in` keeps value and label pairs.
for (const [label, field, expected] of [
  ['class, style and attributes', { type: 'choice', items: [{ value: 'blue', label: 'Blue', class: 'swatch', style: '--swatch-bg: #1d4ed8', attributes: { 'aria-label': 'Blue accent' } }], design: { group: { class: 'swatches' } } }, true],
  ['class that is not a string', { type: 'choice', items: [{ value: 'blue', label: 'Blue', class: ['swatch'] }] }, false],
  ['owned attribute name', { type: 'choice', items: [{ value: 'blue', label: 'Blue', attributes: { 'data-is-default': '1' } }] }, false],
  ['another member', { type: 'choice', items: [{ value: 'blue', label: 'Blue', id: 'b' }] }, false],
  ['appearance in a membership rule', { type: 'choice', items: ['Blue'], validate: { in: [{ value: 0, label: 'Blue', class: 'swatch' }] } }, false],
] satisfies [string, Record<string, unknown>, boolean][]) {
  const spec = { type: 'group', properties: { accent: field } };
  assert.equal(validateForm(spec), expected, `choice appearance, ${label}: ${JSON.stringify(validateForm.errors)}`);
  checked++;
}
// Layout (docs/spec/schema.md, Layout): stacked, inline or line on a group field; a repeated group
// has no line. The schema describes a field, so the form root's layout is a compilation check.
for (const [label, field, expected] of [
  ['inline group', { type: 'group', design: { layout: 'inline' }, properties: { a: { type: 'text' } } }, true],
  ['line group', { type: 'group', design: { layout: 'line' }, properties: { a: { type: 'text' } } }, true],
  ['inline repeated group', { type: 'group', multiple: true, design: { layout: 'inline' }, properties: { a: { type: 'text' } } }, true],
  ['line repeated group', { type: 'group', multiple: { min: 1 }, design: { layout: 'line' }, properties: { a: { type: 'text' } } }, false],
  ['other value', { type: 'group', design: { layout: 'grid' }, properties: { a: { type: 'text' } } }, false],
  ['text field', { type: 'text', design: { layout: 'inline' } }, false],
] satisfies [string, Record<string, unknown>, boolean][]) {
  const spec = { type: 'group', properties: { look: field } };
  assert.equal(validateForm(spec), expected, `layout, ${label}: ${JSON.stringify(validateForm.errors)}`);
  checked++;
}
// Choice groups (docs/spec/schema.md, Choice groups): a choice list may contain groups of one or
// more value and label pairs, mixed with plain choices, in `items` and in `in`.
for (const [label, field, expected] of [
  ['groups only', { type: 'select', items: [{ label: 'Europe', choices: [{ value: 'eu-west', label: 'West' }] }, { label: { en: 'Asia' }, choices: [{ value: 7, label: 'Seven' }] }] }, true],
  ['groups and choices', { type: 'select', items: [{ value: 'auto', label: 'Automatic' }, { label: 'Europe', choices: [{ value: 'eu-west', label: 'West' }] }] }, true],
  ['groups in a membership rule', { type: 'select', items: ['Auto'], validate: { in: [{ value: 'auto', label: 'Automatic' }, { label: 'Europe', choices: [{ value: 'eu-west', label: 'West' }] }] } }, true],
  ['group without choices', { type: 'select', items: [{ label: 'Europe', choices: [] }] }, false],
  ['group without a label', { type: 'select', items: [{ choices: [{ value: 'eu-west', label: 'West' }] }] }, false],
  ['group with another member', { type: 'select', items: [{ label: 'Europe', class: 'x', choices: [{ value: 'eu-west', label: 'West' }] }] }, false],
  ['nested group', { type: 'select', items: [{ label: 'Europe', choices: [{ label: 'West', choices: [{ value: 'eu-west', label: 'West' }] }] }] }, false],
  ['group choice with appearance', { type: 'select', items: [{ label: 'Europe', choices: [{ value: 'eu-west', label: 'West', class: 'x' }] }] }, false],
  ['group without choices in a membership rule', { type: 'select', items: ['Auto'], validate: { in: [{ label: 'Europe', choices: [] }] } }, false],
] satisfies [string, Record<string, unknown>, boolean][]) {
  const spec = { type: 'group', properties: { region: field } };
  assert.equal(validateForm(spec), expected, `choice groups, ${label}: ${JSON.stringify(validateForm.errors)}`);
  checked++;
}
// `validate` and `messages` accept the registered rule names only: the rules of the rule registry.
const registeredRules = [...readText('legacy/packages/validator/ts/src/rules/index.ts').matchAll(/^ {2}\['(\w+)', \w+Rule\],$/gm)]
  .map(([line, name]) => {
    assert.ok(name !== undefined, `the rule registry line names its rule: ${line}`);
    return name;
  });
assert.equal(registeredRules.length, 30, 'the rule registry lists 30 rules');
const validateObject = schema.definitions.Validate.anyOf.find((shape) => shape.type === 'object');
assert.ok(validateObject?.properties);
const codeUnitOrder = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
assert.deepEqual(Object.keys(validateObject.properties).sort(codeUnitOrder), [...registeredRules].sort(codeUnitOrder), 'validate lists the registered rules');
assert.deepEqual(Object.keys(schema.definitions.Messages.properties).sort(codeUnitOrder), [...registeredRules].sort(codeUnitOrder), 'messages lists the registered rules');
for (const [field, expected, keyword] of [
  [{ validate: { required: true, minlength: 2, dateISO: true, equalTo: '.other' } }, true],
  [{ validate: { no_such_rule: true } }, false, 'additionalProperties'],
  [{ validate: { conditionTree: true } }, true],
  [{ validate: { conditionTree: 'judge' } }, true],
  [{ validate: { conditionTree: 'any' } }, false, 'enum'],
  [{ validate: { conditionTree: { '.enabled': true } } }, false, 'enum'],
  [{ validate: { requried: false } }, false, 'additionalProperties'],
  [{ validate: { equalto: '.other' } }, false, 'additionalProperties'],
  [{ messages: { required: 'Enter a value.', number: 'Enter a number.', pattern: 'Wrong format.' } }, true],
  [{ messages: { requird: 'Enter a value.' } }, false, 'additionalProperties'],
  [{ messages: { required: 1 } }, false, 'type'],
] satisfies ([Record<string, unknown>, boolean] | [Record<string, unknown>, boolean, string])[]) {
  const spec = { type: 'group', properties: { value: { type: 'text', ...field } } };
  const label = `rule names: ${JSON.stringify(field)}`;
  assert.equal(validateForm(spec), expected, `${label} ${JSON.stringify(validateForm.errors)}`);
  if (keyword) assert.ok(validateForm.errors?.some((error) => error.keyword === keyword), `${label}: expected ${keyword}`);
  checked++;
}
// The structure-validity families share one case shape:
// { name, note, spec, files?, expect: "ok"|"fail", reason?, engine: "pass"|{ code, at }, requirements? }.
// `expect` and `reason` are the meta-schema result for the family entry point; `requirements` names the spec ids that the
// case tests (S6).
const caseKeys = new Set(['name', 'note', 'spec', 'files', 'expect', 'reason', 'engine', 'requirements']);
function validityCase(family: string, test: unknown): ValidityCase {
  assert.ok(OBJECT(test), `${family}: every case is an object`);
  assert.ok(typeof test.name === 'string', `${family}: every case name is a string`);
  const label = `${family}:${test.name}`;
  for (const key of Object.keys(test)) assert.ok(caseKeys.has(key), `${label}: unknown member ${key}`);
  assert.ok(typeof test.note === 'string', `${label}: note is a string`);
  // A fail case may give a specification that is no object (CUDF-091); every other specification is an object.
  assert.ok(OBJECT(test.spec) || test.expect === 'fail', `${label}: spec is an object`);
  if ('files' in test) assert.ok(OBJECT(test.files), `${label}: files is an object`);
  if ('requirements' in test) {
    const ids = test.requirements;
    assert.ok(Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === 'string'), `${label}: requirements is a nonempty array of ids`);
    assert.equal(new Set(ids).size, ids.length, `${label}: requirements names each id once`);
  }
  assert.ok(test.expect === 'ok' || test.expect === 'fail', `${label}: expect is "ok" or "fail"`);
  if (test.expect === 'fail') assert.ok(typeof test.reason === 'string', `${label}: a fail case names its reason`);
  else assert.ok(!('reason' in test), `${label}: only a fail case has a reason`);
  const engineShape =
    test.engine === 'pass' ||
    (OBJECT(test.engine) &&
      Object.keys(test.engine).sort().join() === 'at,code' &&
      typeof test.engine.code === 'string' &&
      typeof test.engine.at === 'string');
  assert.ok(engineShape, `${label}: engine is "pass" or { code, at }`);
  const files = optionalFiles(test.files, label);
  return {
    name: test.name, note: test.note, spec: test.spec, expect: test.expect, engine: test.engine,
    ...(files === undefined ? {} : { files }),
    ...(typeof test.reason === 'string' ? { reason: test.reason } : {}),
  };
}
for (const [family, validate] of [
  ['spec-validity', validateForm],
  ['list-validity', validateList],
  ['detail-validity', validateDetail],
] satisfies [string, ValidateFunction][]) {
  const document = fixtureItems(`../tests/fixtures/${family}/cases.json`);
  assert.ok(document.length > 0, `${family}: cases is a nonempty array`);
  const cases = document.map((test: unknown) => validityCase(family, test));
  assert.equal(new Set(cases.map((test) => test.name)).size, cases.length, `${family}: case names are unique`);
  for (const test of cases) {
    const label = `${family}:${test.name}`;
    assert.equal(validate(test.spec), test.expect === 'ok', `${label}: ${JSON.stringify(validate.errors)}`);
    if (test.expect === 'fail') {
      assert.ok(validate.errors);
      const keywords = validate.errors.map((error) => error.keyword);
      assert.ok(test.reason !== undefined && keywords.includes(test.reason), `${label}: expected ${test.reason} among ${JSON.stringify(keywords)}`);
    }
    checked++;
  }
}

// ---------------------------------------------------------------------------
// Every specification meant to be valid passes the meta-schema.
//
// A case that expects an input or composition failure is not such a
// specification, so it is skipped. The specifications below are declared outside
// the schema on purpose: each one is asserted to FAIL, so the list cannot rot
// into a silent exemption.
// ---------------------------------------------------------------------------
const outsideSchema = new Map([
  [
    'console:detail-edge-forbidden',
    'the forbidden meta key show_if, quoted from detail-validity red-show-if-on-field.',
  ],
  [
    'console:detail-edge-record',
    'a detail specification without fields, quoted from detail-render reject-record-before-fields.',
  ],
]);
const seenOutside = new Set();

/** Validate one specification that is meant to be valid, unless it is a declared exception. */
function checkSpec(label: string, spec: unknown, validate: ValidateFunction): void {
  const reason = outsideSchema.get(label);
  if (reason) {
    seenOutside.add(label);
    assert.equal(validate(spec), false, `${label}: declared outside the schema (${reason}) but it passes`);
  } else {
    assert.equal(validate(spec), true, `${label}: ${JSON.stringify(validate.errors)}`);
  }
  checked++;
}

// A specification whose root is a bare composition entry is the properties-layer
// fragment `$ref` resolves (legacy/packages/validator/ts/src/compose/ref.ts), not a
// composed specification: the whole-spec entry requires `type`, which such a
// fragment supplies only after composition (tests/fixtures/spec-validity
// err-after-compose-ref-base-leak records that result).
const isCompositionEntry = (spec: unknown): boolean =>
  spec !== null && typeof spec === 'object' && '$ref' in spec && typeof spec.$ref === 'string' && !('type' in spec);

// Fixture families. `expectError` and `expectFailure` mark the input and
// composition failures the rule excludes.
for (const [family, member, validate] of [
  ['validate', 'spec', validateForm],
  ['form-render', 'spec', validateForm],
  ['form-outline', 'spec', validateForm],
  ['list-render', 'spec', validateList],
  ['detail-render', 'spec', validateDetail],
] satisfies [string, string, ValidateFunction][]) {
  const cases = readCases(`../tests/fixtures/${family}/cases.json`);
  assert.ok(cases.length > 0, `${family}: cases is a nonempty array`);
  for (const test of cases) {
    if (test.expectError || test.expectFailure) continue;
    const spec = test[member];
    checkSpec(`${family}:${test.name}`, spec, isCompositionEntry(spec) ? validateProperties : validate);
  }
}

/** The fragment a `$ref` selects: `(file.yml).a.b` descends a, b and then `properties`. */
function refFragment(document: unknown, reference: string): unknown {
  const match = /^\((?<path>.*?)\)\.(?<keys>.*)$/.exec(reference);
  const path = match?.groups?.keys;
  assert.ok(!match || path !== undefined);
  const keys = path !== undefined ? [...path.split('.'), 'properties'] : ['properties'];
  let node = document;
  for (const key of keys) {
    if (!OBJECT(node) || !(key in node)) return undefined;
    node = node[key];
  }
  return node;
}

/** Every `$ref` in a declaration, with the child map definition its slot holds. */
function collectRefs(
  node: unknown, slot: Slot, found: { reference: string, slot: Slot }[] = [],
): { reference: string, slot: Slot }[] {
  if (node === null || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, slot, found);
    return found;
  }
  if ('$ref' in node && typeof node.$ref === 'string') found.push({ reference: node.$ref, slot });
  for (const [key, value] of Object.entries(node)) {
    const next = key === 'columns' ? 'columns' : key === 'fields' ? 'fields' : key === 'search' ? 'properties' : slot;
    if (key !== '$patch') collectRefs(value, next, found);
  }
  return found;
}

const fragmentValidator: Record<Slot, ValidateFunction> = {
  properties: validateProperties,
  columns: validateColumns,
  fields: validateDetailFields,
};

/** Validate each composition file as the fragment the declaration selects in it. */
function checkFiles(
  label: string, declaration: unknown, files: Record<string, unknown> | undefined, slot: Slot,
): void {
  if (!files) return;
  const references = collectRefs(declaration, slot);
  for (const [name, document] of Object.entries(files)) {
    for (const { reference, slot: kind } of references) {
      if (reference !== name && !reference.startsWith(`(${name})`)) continue;
      const fragment = refFragment(document, reference);
      if (fragment === undefined) continue;
      const validate = fragmentValidator[kind];
      assert.equal(
        validate(fragment),
        true,
        `${label}#${name}: the fragment ${reference} selects is not a valid ${kind} map: ${JSON.stringify(validate.errors)}`,
      );
      checked++;
    }
  }
}

for (const [family, slot] of [
  ['spec-validity', 'properties'],
  ['list-validity', 'properties'],
  ['detail-validity', 'fields'],
] satisfies [string, Slot][]) {
  for (const test of checkedShape(ARRAY, fixtureItems(`../tests/fixtures/${family}/cases.json`), family).map((item) => validityCase(family, item))) {
    if (test.expect !== 'ok') continue;
    checkFiles(`${family}:${test.name}`, test.spec, test.files, slot);
  }
}
for (const test of readCases('../tests/fixtures/validate/cases.json')) {
  if (test.expectFailure) continue;
  const label = `validate:${test.name}`;
  checkFiles(label, test.spec, optionalFiles(test.files, label), 'properties');
}

// Composition entries are the fragment their kind names: a field map by default,
// a whole specification for `kind: "spec"`. `err-` cases expect a composition failure.
for (const test of readCases('../tests/fixtures/compose/cases.json')) {
  if (test.name.startsWith('err-') || test.expectError) continue;
  const label = `compose:${test.name}`;
  const input = checkedShape(OBJECT, test.input, `${label}: input`);
  const { entry: declaration, kind } = input;
  const files = optionalFiles(input.files, label);
  checkSpec(label, declaration, kind === 'spec' ? validateForm : validateProperties);
  checkFiles(label, declaration, files, 'properties');
  for (const document of Object.values(files ?? {})) checkFiles(label, document, files, 'properties');
}

// Requests that the cross-check console's validator processes accept.
for (const test of readCases('../legacy/examples/cross-check-console/validators/requests.json')) {
  const label = `validator-request:${test.name}`;
  if (checkedShape(OBJECT, test.expected, `${label}: expected`).exit !== 0) continue;
  let request: unknown;
  try {
    request = JSON.parse(checkedShape(STRING, test.input, `${label}: input`));
  } catch (error) { if (!(error instanceof SyntaxError)) throw error;
    continue;
  }
  const { mode, spec } = checkedShape(OBJECT, request, `${label}: request`);
  const validate = mode === 'list' ? validateList : mode === 'detail' ? validateDetail : validateForm;
  checkSpec(label, spec, validate);
}

// Browser form-session specifications.
for (const [file, exported] of [
  ['scenario.mts', 'spec'],
  ['controls.mts', 'controlSpec'],
  ['data-rows.mts', 'onlySpec'],
  ['data-rows.mts', 'visibilitySpec'],
  ['typing.mts', 'typingSpec'],
] satisfies [string, string][]) {
  // The fixture module exports its specifications.
  const module: unknown = await import(pathToFileURL(at(`tests/fixtures/form-session/${file}`)).href);
  checkSpec(`form-session:${file}`, checkedShape(OBJECT, module, file)[exported], validateForm);
}

// ---------------------------------------------------------------------------
// Example specifications.
// ---------------------------------------------------------------------------
checkSpec('examples/form-structure', YAML.parse(readText('examples/form-structure/spec.yml')), validateForm);
// The product forms: two specifications and the option-row file they compose with `$ref`.
const optionRow: unknown = YAML.parse(readText('examples/product-forms/option-row.yml'));
const optionForm: unknown = YAML.parse(readText('examples/product-forms/option-form.yml'));
const productFiles = { 'option-row.yml': checkedShape(OBJECT, optionRow, 'examples/product-forms/option-row.yml'), 'option-form.yml': optionForm };
const productForm: unknown = YAML.parse(readText('examples/product-forms/product-form.yml'));
checkSpec('examples/product-forms/option-form', productFiles['option-form.yml'], validateForm);
checkSpec('examples/product-forms/product-form', productForm, validateForm);
checkSpec('examples/product-forms/option-row', productFiles['option-row.yml'].properties, validateProperties);
checkFiles('examples/product-forms/option-form', productFiles['option-form.yml'], productFiles, 'properties');
checkFiles('examples/product-forms/product-form', productForm, productFiles, 'properties');

// The console client is a browser module, so it is loaded by its source rather
// than by path: the nearest package.json does not declare a module type.
const consoleSource = readText('legacy/examples/cross-check-console/client/examples.js');
const consoleModule: unknown = await import(
  `data:text/javascript;base64,${Buffer.from(consoleSource).toString('base64')}`
);
/** The examples that the console module exports as `name`. */
const consoleExamples = (name: string): ConsoleExample[] =>
  checkedShape(ARRAY, checkedShape(OBJECT, consoleModule, 'examples.js')[name], `${name} of examples.js`).map((item, index) => {
    const example = checkedShape(OBJECT, item, `${name}[${index}] of examples.js`);
    return { id: checkedShape(STRING, example.id, `${name}[${index}].id of examples.js`), spec: checkedShape(STRING, example.spec, `${name}[${index}].spec of examples.js`) };
  });
for (const [list, validate] of [
  [consoleExamples('examples'), validateForm],
  [consoleExamples('listExamples'), validateList],
  [consoleExamples('detailExamples'), validateDetail],
] satisfies [ConsoleExample[], ValidateFunction][]) {
  assert.ok(list.length > 0, 'the cross-check console declares examples');
  for (const example of list) checkSpec(`console:${example.id}`, YAML.parse(example.spec), validate);
}

/** The JSON object that starts at `open` in `source`, by brace matching. */
function jsonObjectAt(source: string, open: number): unknown {
  let depth = 0;
  let quoted = false;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '\\') index += 1;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return JSON.parse(source.slice(open, index + 1));
  }
  throw new Error('unterminated object');
}

/** The named group `name` of a match of a pattern that declares it. */
function group(match: RegExpExecArray, name: string): string {
  const value = match.groups?.[name];
  assert.ok(value !== undefined, `the pattern captures ${name}`);
  return value;
}

/** The example specifications each package example embeds in its source. */
const packageExamples: [string, RegExp, (match: RegExpExecArray, source: string) => [string, unknown]][] = [
  ['legacy/packages/generator/go/examples/server/main.go', /^const (?<name>\w+) = `(?<spec>\{.*\})`$/gm, (match) => [group(match, 'name'), JSON.parse(group(match, 'spec'))]],
  ['legacy/packages/generator/php/examples/index.php', /\$(?<name>\w+) = json_decode\(<<<'JSON'\n(?<spec>\{[\s\S]*?\})\nJSON,/g, (match) => [group(match, 'name'), JSON.parse(group(match, 'spec'))]],
  ['packages/generator/rust/examples/form.rs', /let (?<name>\w*spec) = json!\(/g, (match, source) => [group(match, 'name'), jsonObjectAt(source, source.indexOf('{', match.index))]],
];
const packageEntry: Record<string, ValidateFunction | undefined> = {
  specification: validateForm,
  listSpecification: validateList,
  detailSpecification: validateDetail,
  spec: validateForm,
  listSpec: validateList,
  detailSpec: validateDetail,
  list_spec: validateList,
  detail_spec: validateDetail,
};
for (const [file, pattern, extract] of packageExamples) {
  const source = readText(file);
  let found = 0;
  for (const match of source.matchAll(pattern)) {
    const [name, spec] = extract(match, source);
    const validate = packageEntry[name];
    assert.ok(validate, `${file}: ${name} is not a known form, list or detail specification`);
    checkSpec(`${file}:${name}`, spec, validate);
    found += 1;
  }
  assert.equal(found, 3, `${file}: expected the form, list and detail specifications, found ${found}`);
}

// ---------------------------------------------------------------------------
// Every tracked YAML specification is accounted for. The form-structure example
// passes the meta-schema above; the CLI fixtures are inputs of the CLI's own
// tests, several of them invalid on purpose. Any other YAML file would be a
// specification no check reads.
// ---------------------------------------------------------------------------
const checkedYaml = new Set([
  'examples/form-structure/spec.yml',
  'examples/product-forms/option-row.yml',
  'examples/product-forms/option-form.yml',
  'examples/product-forms/product-form.yml',
]);
// The configurations of tools, which those tools read: golangci-lint (make lint-go), alint (make layout-check) and the
// sidecar lock of the npm of mise.toml, which mise writes with make toolchain-lock and reads when it installs npm:npm.
const toolConfigurations = new Set([
  '.golangci.yml', 'config/layout.kit.yml', 'config/layout.yml', '.mise/locks/npm-npm/12.2.0/aube-lock.yaml',
]);
const trackedYaml = execFileSync('git', ['ls-files', '*.yml', '*.yaml'], { cwd: repository, encoding: 'utf8' })
  .split('\n').filter((file) => file && !file.startsWith('.github/') && existsSync(at(file)));
const unchecked = trackedYaml.filter((file) =>
  !checkedYaml.has(file) && !toolConfigurations.has(file) && !file.startsWith('packages/cli/tests/fixtures/'));
assert.deepEqual(unchecked, [], `YAML specifications that no check reads: ${unchecked.join(', ')}`);
for (const file of trackedYaml) YAML.parse(readText(file)); // Throws on a duplicate key.

const unused = [...outsideSchema.keys()].filter((label) => !seenOutside.has(label));
assert.deepEqual(unused, [], `declared outside the schema but never reached: ${unused.join(', ')}`);

process.stdout.write(`[schema] form, list and detail schema compiled; ${checked} specification checks passed\n`);
