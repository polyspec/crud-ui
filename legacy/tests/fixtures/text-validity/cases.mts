/**
 * The shared case code of the text-validity units (CUIT-041): the reader of a fixture, the run of a case with its outcome,
 * and the registration of a feature's cases as top-level tests named by the case. Each unit has its own test file, which
 * registers its feature; the cases are the fixture's, and the assertions are those of the cases.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validate, validateList, validateDetail, ComposeLoadError, FormInputError } from '@polyspec/crudui-validator';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

/** Whether a fixture value is a JSON object rather than null or an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export interface TextCase {
  name: string;
  spec: Record<string, unknown>;
  files?: Record<string, Record<string, unknown>>;
  data?: unknown;
  options?: Record<string, unknown>;
  expect: unknown;
}

/** Whether a value is a set of composition files: an object of JSON objects. */
const isFileSet = (value: unknown): value is Record<string, Record<string, unknown>> =>
  isRecord(value) && Object.values(value).every(isRecord);

/** A case of a fixture, checked to hold a name and a spec and, when present, files and options. */
export function textCase(item: unknown, at: string): TextCase {
  if (!isRecord(item) || typeof item.name !== 'string' || !isRecord(item.spec)) throw new TypeError(`${at}: no name and spec`);
  const { files, options } = item;
  if (files !== undefined && !isFileSet(files)) throw new TypeError(`${at}: the files are no file set`);
  if (options !== undefined && !isRecord(options)) throw new TypeError(`${at}: the options are no object`);
  return {
    name: item.name, spec: item.spec, expect: item.expect,
    ...(files === undefined ? {} : { files }),
    ...('data' in item ? { data: item.data } : {}),
    ...(options === undefined ? {} : { options }),
  };
}

/** The list of the fixture `fixture`, each item read by `read`. */
export function readCases<T>(fixture: string, read: (item: unknown, at: string) => T): T[] {
  const value: unknown = JSON.parse(fs.readFileSync(path.join(ROOT, fixture), 'utf8'));
  if (!Array.isArray(value)) throw new TypeError(`${fixture} holds no list of cases`);
  return value.map((item: unknown, index) => read(item, `case ${index} of ${fixture}`));
}

/** The record of a run and the native type of the error it throws (CUIT-041), or 'none' when it throws nothing. */
function outcome(run: () => unknown): { record: unknown; type: string } {
  try {
    return { record: run(), type: 'none' };
  } catch (error) {
    if (error instanceof ComposeLoadError) {
      return { record: { code: error.code, message: error.message, at: error.trace.join('.') }, type: 'ComposeLoadError' };
    }
    if (error instanceof FormInputError) {
      return { record: { code: error.code, message: error.message, at: '' }, type: 'FormInputError' };
    }
    throw error;
  }
}

/** The native type that the expectation names: a load failure is a ComposeLoadError, an input failure a FormInputError. */
function nativeType(expected: unknown): string {
  if (!isRecord(expected) || typeof expected.code !== 'string') return 'none';
  return expected.code === 'INVALID_TEXT' ? 'ComposeLoadError' : 'FormInputError';
}

/** Checks the record of a run against its expectation and the native type of its error against the expected type. */
export function expectOutcome(run: () => unknown, expected: unknown): void {
  const { record, type } = outcome(run);
  expect(record).toStrictEqual(expected);
  expect(type).toBe(nativeType(expected));
}

export const operations = {
  validate: (c: TextCase) => validate(c.spec, c.data, { ...c.options, ...(c.files ? { files: c.files } : {}) }),
  validateList: (c: TextCase) => validateList(c.spec, { ...c.options, ...(c.files ? { files: c.files } : {}) }),
  validateDetail: (c: TextCase) => validateDetail(c.spec, { ...c.options, ...(c.files ? { files: c.files } : {}) }),
};

export type Feature = keyof typeof operations;

/**
 * Registers the cases of the fixture of a feature: each case is a top-level test named by the case, so a failure names
 * its case; the fixture's case count is checked in a test nested under a describe.
 */
export function registerTextValidity(feature: Feature): void {
  const fixture = `legacy/tests/fixtures/text-validity/${feature}/cases.json`;
  const cases = readCases(fixture, textCase);
  describe(`${feature} — input text`, () => {
    test('the fixture carries cases', () => expect(cases.length).toBeGreaterThan(0));
  });
  for (const c of cases) {
    test(c.name, () =>
      provesConformance({ features: [feature], fixture, runtime: 'javascript', case: c.name }, () => {
        expectOutcome(() => operations[feature](c), c.expect);
      }));
  }
}
