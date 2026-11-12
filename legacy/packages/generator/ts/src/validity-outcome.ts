/**
 * The validity cases of legacy/tests/fixtures/list-validity and legacy/tests/fixtures/detail-validity (docs/spec/display-formats.md), read
 * and checked by the render runners of list-render-validity and detail-render-validity. A case whose validator load fails
 * is refused with that code and location; a case that the meta-schema rejects but the validator loads is refused with
 * INVALID_FORM_INPUT (CUDF-036 to CUDF-062); every other case builds.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import assert from 'node:assert/strict';
import { ComposeLoadError, FormInputError } from './index';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

export interface ValidityCase {
  name: string;
  spec: Record<string, unknown>;
  files?: Record<string, Record<string, unknown>>;
  expect: 'ok' | 'fail';
  /** 'pass', or the code and composition trace of the engine failure. */
  engine: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A case of a validity fixture, checked member by member. */
function validityCase(value: unknown): ValidityCase {
  assert(isRecord(value), 'a case is an object');
  const { name, spec, files, expect: expected } = value;
  assert(typeof name === 'string', 'a case has a name');
  assert(isRecord(spec), `${name}: spec is an object`);
  assert(expected === 'ok' || expected === 'fail', `${name}: expect is ok or fail`);
  if (files === undefined) return { name, spec, expect: expected, engine: value.engine };
  assert(isRecord(files), `${name}: files is an object`);
  const checked: Record<string, Record<string, unknown>> = {};
  for (const [file, content] of Object.entries(files)) {
    assert(isRecord(content), `${name}: files.${file} is an object`);
    checked[file] = content;
  }
  return { name, spec, files: checked, expect: expected, engine: value.engine };
}

/** The cases of one validity family, `list-validity` or `detail-validity`, in file order. */
export function readValidityCases(family: string): ValidityCase[] {
  const decoded: unknown = JSON.parse(fs.readFileSync(path.join(ROOT, `legacy/tests/fixtures/${family}/cases.json`), 'utf8'));
  assert(Array.isArray(decoded), `the ${family} cases are a list`);
  return decoded.map(validityCase);
}

/** Runs one case through the render and checks its outcome. */
export function checkValidityCase(c: ValidityCase, render: (c: ValidityCase) => unknown): void {
  let result: unknown = 'pass';
  try {
    render(c);
  } catch (error) {
    if (error instanceof ComposeLoadError) result = { code: error.code, at: error.trace.join('.') };
    else if (error instanceof FormInputError) result = { code: error.code, at: '' };
    else throw error;
  }
  if (c.engine !== 'pass') expect(result).toStrictEqual(c.engine);
  else if (c.expect === 'ok') expect(result).toBe('pass');
  else expect(result).toStrictEqual({ code: 'INVALID_FORM_INPUT', at: '' });
}
