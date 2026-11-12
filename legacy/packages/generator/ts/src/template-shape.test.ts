import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { FormInputError } from '@polyspec/crudui-validator';
import { provesConformance } from '../../../../../tests/conformance/evidence.mts';
import { bindButtons, bindForm, compileForm, createForm } from './index';
import { isRecord } from './util';

/** A case of legacy/tests/fixtures/template-shape: the operation takes the template, the data and the options of the case. */
interface ShapeCase { name: string; operation: string; template: unknown; data: unknown; options: unknown; expect: unknown; paths?: unknown }

/** Calls a function with the case values, which the shape check at run time takes as they are. */
function call(fn: (...args: never[]) => unknown, args: unknown[]): unknown {
  const value: unknown = Reflect.apply(fn, undefined, args);
  return value;
}
const OPERATIONS: Record<string, (template: unknown, data: unknown, options: unknown) => unknown> = {
  bindForm: (template, data, options) => call(bindForm, [template, data, options]),
  bindButtons: (template, data, options) => call(bindButtons, [template, data, options]),
  createForm: (template, data, options) => call(createForm, [template, data, options]),
};

function caseOf(item: unknown): ShapeCase {
  assert(isRecord(item), 'a case is an object');
  const { name, operation, template, data, options, expect, paths } = item;
  assert(typeof name === 'string' && typeof operation === 'string', 'a case has a name and an operation');
  return { name, operation, template, data, options, expect, ...(paths === undefined ? {} : { paths }) };
}

const cases: ShapeCase[] = (() => {
  const raw: unknown = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/template-shape/cases.json', import.meta.url), 'utf8'));
  assert(Array.isArray(raw), 'the fixture is a list of cases');
  return raw.map(caseOf);
})();

/** An instance of `createForm`, which reads the value at a path. */
function hasGetValue(value: unknown): value is { getValue(path: string): unknown } {
  return typeof value === 'object' && value !== null && 'getValue' in value && typeof value.getValue === 'function';
}

/** The paths of one record of a case: a list of text (CURT-050). */
function pathsOf(paths: unknown, index: number): string[] {
  const list: unknown = Array.isArray(paths) ? paths[index] : undefined;
  assert(Array.isArray(list) && list.every(path => typeof path === 'string'), 'the paths of a record are a list of text');
  return list;
}

/** The values at `paths` of the instance that `createForm` makes from the template and one record (CURT-050). */
function readPaths(template: unknown, record: unknown, paths: string[]): Record<string, unknown> {
  const form: unknown = Reflect.apply(createForm, undefined, [template, record, {}]);
  assert(hasGetValue(form), 'createForm makes an instance with getValue');
  const out: Record<string, unknown> = {};
  for (const path of paths) out[path] = form.getValue(path);
  return out;
}

// The compiled cases of legacy/tests/fixtures/template-shape also test CURP-019 and CURP-024: a serialized compiled template is bound.
// The record cases test CURT-050: records bound from one serialized template are independent.
// Each case is a top-level test named by the case, so the parity check reads every case of the unit by its name.
for (const item of cases) {
  it(item.name, () => provesConformance({
    features: [item.operation === 'createRecords' ? 'createForm' : item.operation],
    fixture: 'legacy/tests/fixtures/template-shape/cases.json',
    runtime: 'javascript',
    case: item.name,
  }, () => {
    if (item.operation === 'createRecords') {
      // CURT-050: each record is bound from the serialized template alone, and reads its own values.
      assert(Array.isArray(item.data) && item.paths, 'the records and their paths are lists');
      const results = item.data.map((record, index) => readPaths(item.template, record, pathsOf(item.paths, index)));
      expect({ results }).toStrictEqual(item.expect);
      return;
    }
    const run = OPERATIONS[item.operation];
    assert(run, `${item.operation} is a template operation`);
    let caught: unknown;
    try { run(item.template, item.data, item.options); } catch (error) { caught = error; }
    if (item.expect === 'pass') {
      expect(caught).toBeUndefined();
      return;
    }
    assert(caught instanceof FormInputError, 'the operation throws a FormInputError');
    expect({ code: caught.code, message: caught.message, at: '' }).toStrictEqual(item.expect);
  }));
}

describe('form template shape', () => {
  it('bindButtons rejects a button whose type is no form button type', () => {
    const template: unknown = JSON.parse(JSON.stringify(compileForm({ type: 'group', properties: { name: { type: 'text' } } })));
    assert(isRecord(template) && Array.isArray(template.buttons), 'a compiled template has a list of buttons');
    const button: unknown = template.buttons[0];
    assert(isRecord(button), 'a compiled button is an object');
    button.type = 'other';
    // @ts-expect-error: a reshaped template is a record, which the type FormTemplate does not accept.
    expect(() => bindButtons(template)).toThrow(new FormInputError('Invalid button type: other'));
  });
  it('treats an undefined member as absent', () => {
    const template = compileForm({ type: 'group', properties: { name: { type: 'text' } } });
    expect(() => bindForm({ ...template, keyPrefix: undefined })).not.toThrow();
  });
});

describe('widget member order', () => {
  it('orders every widget model as the specification lists its members', () => {
    const template = compileForm({
      type: 'group',
      properties: {
        memo: { type: 'textarea', prepend: 'P' },
        note: { type: 'dummy' },
        go: { type: 'button' },
        kind: { type: 'search', options: { a: 'A' } },
        body: { type: 'tinymce' },
      },
    });
    const order = ['kind', 'layout', 'tag', 'attrs', 'text', 'rawHtml', 'source', 'options', 'itemLabelClass', 'script', 'styleChrome', 'prepend', 'append', 'extra'];
    for (const node of bindForm(template, {})) {
      assert(node.widget, 'a field node has a widget');
      const keys = Object.keys(node.widget);
      expect(keys).toEqual(order.filter(key => keys.includes(key)));
    }
  });
});
