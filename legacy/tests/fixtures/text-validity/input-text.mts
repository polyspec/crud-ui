/**
 * The shared case code of the input text units of the generator (docs/spec/input-text.md): the reader of a fixture's
 * cases, the run of a case with the class of the error it throws (CUIT-041), and the registration of a feature's cases as
 * top-level tests named by the case. Each unit has its own test file, which registers its feature.
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import {
  bindForm, buildDetail, buildList, compileForm, ComposeLoadError, createForm, decodeFormTemplate, FormInputError,
} from '@polyspec/crudui-generator-core';
import { isRecord } from './cases.mts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

interface TextCase {
  name: string;
  spec?: Record<string, unknown>;
  /** A compiled template as decoded JSON, which the operation checks at run time. */
  template?: unknown;
  data?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
  record?: Record<string, unknown>;
  options?: Record<string, unknown>;
  action?: { method: string; args: unknown[] };
  /** 'pass', or the code, message and composition trace of the failure. */
  expect: unknown;
}

/** A member of a case that is absent or an object. */
function optionalRecord(value: unknown, what: string): Record<string, unknown> | undefined {
  assert(value === undefined || isRecord(value), `${what} is an object`);
  return value;
}

/** A case of a text-validity fixture, checked member by member. */
function textCase(value: unknown): TextCase {
  assert(isRecord(value), 'a case is an object');
  const { name, template, rows } = value;
  assert(typeof name === 'string', 'a case has a name');
  assert(rows === undefined || (Array.isArray(rows) && rows.every(isRecord)), `${name}: rows is a list of objects`);
  const action = value.action === undefined ? undefined : formAction(value.action, name);
  const spec = optionalRecord(value.spec, `${name}: spec`);
  const data = optionalRecord(value.data, `${name}: data`);
  const record = optionalRecord(value.record, `${name}: record`);
  const options = optionalRecord(value.options, `${name}: options`);
  return {
    name,
    expect: value.expect,
    ...(spec ? { spec } : {}),
    ...(template !== undefined ? { template } : {}),
    ...(data ? { data } : {}),
    ...(rows ? { rows } : {}),
    ...(record ? { record } : {}),
    ...(options ? { options } : {}),
    ...(action ? { action } : {}),
  };
}

/** The action of a case: the method of a form instance and its arguments. */
function formAction(value: unknown, name: string): { method: string; args: unknown[] } {
  assert(isRecord(value), `${name}: action is an object`);
  const { method, args } = value;
  assert(typeof method === 'string' && Array.isArray(args), `${name}: action has a method and arguments`);
  return { method, args };
}

/** A string argument of an action. */
function text(value: unknown, what: string): string {
  assert(typeof value === 'string', `${what} is a string`);
  return value;
}

/** Call the method of a form instance that an action names with its arguments. */
function runFormAction(form: ReturnType<typeof createForm>, { method, args }: { method: string; args: unknown[] }): unknown {
  const [first, second, third] = args;
  switch (method) {
    case 'setValue': return form.setValue(text(first, 'path'), second);
    case 'getValue': return form.getValue(text(first, 'path'));
    case 'setData': assert(isRecord(first), 'data is an object'); return form.setData(first);
    case 'addRow': assert(isRecord(second), 'the row options are an object'); return form.addRow(text(first, 'path'), second);
    case 'copyRow': return form.copyRow(text(first, 'path'), text(second, 'key'));
    case 'removeRow': return form.removeRow(text(first, 'path'), text(second, 'key'));
    case 'moveRow': assert(typeof third === 'number', 'the index is a number'); return form.moveRow(text(first, 'path'), text(second, 'key'), third);
    case 'rekeyRow': return form.rekeyRow(text(first, 'path'), text(second, 'key'), text(third, 'new key'));
    default: throw new Error(`Unknown form method: ${method}`);
  }
}

/** The class of the error that the last run of `failure` threw (CUIT-041), or 'none'. */
let thrownType = 'none';

/** The outcome of a run: 'pass', or the record of the composition or input error it throws. */
export function failure(run: () => unknown): unknown {
  thrownType = 'none';
  try {
    run();
    return 'pass';
  } catch (error) {
    if (error instanceof ComposeLoadError) {
      thrownType = 'ComposeLoadError';
      return { code: error.code, message: error.message, at: error.trace.join('.') };
    }
    if (error instanceof FormInputError) {
      thrownType = 'FormInputError';
      return { code: error.code, message: error.message, at: '' };
    }
    throw error;
  }
}

/** The class that an expectation names (CUIT-041): a load failure is a ComposeLoadError, an input failure a FormInputError. */
function nativeType(expected: unknown): string {
  if (!isRecord(expected) || typeof expected.code !== 'string') return 'none';
  return expected.code === 'INVALID_TEXT' ? 'ComposeLoadError' : 'FormInputError';
}

const template = (c: TextCase): unknown => c.template ?? compileForm(c.spec ?? {});
const operations = {
  compileForm: (c: TextCase) => failure(() => compileForm(c.spec ?? {}, c.options)),
  // @ts-expect-error: a fixture template is decoded JSON that may break the template shape or its text, which bindForm checks at run time.
  bindForm: (c: TextCase) => failure(() => bindForm(template(c), c.data, c.options)),
  createForm: (c: TextCase) => {
    // @ts-expect-error: a fixture template is decoded JSON that may break the template shape or its text, which createForm checks at run time.
    const created = failure(() => createForm(template(c), c.data, c.options));
    const action = c.action;
    if (!action || created !== 'pass') return created;
    const accepted = decodeFormTemplate(template(c));
    const form = createForm(accepted, c.data, c.options);
    return failure(() => runFormAction(form, action));
  },
  buildList: (c: TextCase) => failure(() => buildList(c.spec ?? {}, c.rows, c.options)),
  buildDetail: (c: TextCase) => failure(() => buildDetail(c.spec ?? {}, c.record, c.options)),
};

export type Feature = keyof typeof operations;

/**
 * Registers the cases of the fixture of a feature: each case is a top-level test named by the case, so a failure names
 * its case.
 */
export function registerInputText(feature: Feature): void {
  const decoded: unknown = JSON.parse(
    fs.readFileSync(path.join(ROOT, `legacy/tests/fixtures/text-validity/${feature}/cases.json`), 'utf8'));
  assert(Array.isArray(decoded), `the ${feature} cases are a list`);
  const cases = decoded.map(textCase);
  for (const c of cases) {
    test(c.name, () => {
      expect(operations[feature](c)).toStrictEqual(c.expect);
      expect(thrownType).toBe(nativeType(c.expect));
    });
  }
}
