/**
 * CRUDUI validator conformance — JS reference verification.
 *
 * The shared fixture legacy/tests/fixtures/validate/cases.json is declared to be the JS
 * reference CRUDUI validator's own output (`{ valid, errors, hidden }`, or a failure
 * record). This test RE-VERIFIES that claim by running the real engine
 * (`validate` = compose → traverse → validate-slot evaluation) against the
 * same fixture the PHP, C extension, Go and Rust engines load, with type-strict
 * comparison.
 *
 * A failure produces no validation result. An unresolved composition throws a
 * `ComposeLoadError`; submitted data with the wrong shape throws a
 * `FormInputError`. Each `expectFailure` case must throw the exact
 * `{ code, message, at }` record; each result case must reproduce `expected`.
 *
 * Do not weaken assertions. If JS disagrees with the fixture, the fixture is NOT
 * the JS output and the cross-language contract is broken.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, ComposeLoadError, FormInputError } from './validate/index';
import { provesConformance } from '../../../../../tests/conformance/evidence.mts';
import { isRecord } from './record';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// legacy/packages/validator/ts/src -> repo root is three levels up.
const FIXTURE = path.resolve(
  __dirname,
  '../../../../tests/fixtures/validate/cases.json'
);

interface FailureRecord {
  code: string;
  message: string;
  at: string;
}

interface FixtureCase {
  name: string;
  note: string;
  spec: Record<string, unknown>;
  files?: Record<string, Record<string, unknown>>;
  data: unknown;
  expected?: unknown;
  expectFailure?: unknown;
}

/** Whether a value is a set of composition files: an object of JSON objects. */
const isFileSet = (value: unknown): value is Record<string, Record<string, unknown>> =>
  isRecord(value) && Object.values(value).every(isRecord);

/** The cases of the fixture, each checked to hold a name, a spec and, when present, composition files. */
function readCases(file: string): FixtureCase[] {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new TypeError(`${file} holds no list of cases`);
  return value.map((item: unknown, index): FixtureCase => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.note !== 'string' || !isRecord(item.spec)
      || (item.files !== undefined && !isFileSet(item.files))) {
      throw new TypeError(`case ${index} of ${file} has no name, note and spec, or files that are no file set`);
    }
    return {
      name: item.name, note: item.note, spec: item.spec, data: item.data,
      ...(isFileSet(item.files) ? { files: item.files } : {}),
      ...('expected' in item ? { expected: item.expected } : {}),
      ...('expectFailure' in item ? { expectFailure: item.expectFailure } : {}),
    };
  });
}

const cases = readCases(FIXTURE);

/** Run one fixture case and record validate evidence for it. */
function proves(name: string, body: () => void): Promise<void> {
  return provesConformance(
    { features: ['validate'], fixture: 'legacy/tests/fixtures/validate/cases.json', runtime: 'javascript', case: name },
    body
  );
}

function run(c: FixtureCase) {
  return validate(c.spec, c.data, c.files ? { files: c.files } : {});
}

/** The cross-language failure record of a thrown validation failure. */
function failureRecord(error: unknown): FailureRecord | undefined {
  if (error instanceof ComposeLoadError) {
    return { code: error.code, message: error.message, at: error.trace.join('.') };
  }
  if (error instanceof FormInputError) {
    return { code: error.code, message: error.message, at: '' };
  }
  return undefined;
}

// Each case is a top-level test named by the case, so the parity check reads every case of the unit by its name.
// A result case reproduces { valid, errors, hidden } bit-for-bit; a failure case throws the exact failure record.
for (const c of cases.filter((x) => x.expected)) {
  test(c.name, () =>
    proves(c.name, () => {
      const result = run(c);
      expect(result).toStrictEqual(c.expected);
    }));
}

for (const c of cases.filter((x) => x.expectFailure)) {
  test(c.name, () =>
    proves(c.name, () => {
      let thrown: unknown;
      try {
        run(c);
      } catch (e) {
        thrown = e;
      }
      expect(failureRecord(thrown), `${c.name} must throw a validation failure`).toStrictEqual(
        c.expectFailure
      );
    }));
}

describe('validate — every fixture case is exercised', () => {
  test('each case declares exactly one expectation', () => {
    for (const c of cases) {
      expect(
        (c.expected !== undefined) !== (c.expectFailure !== undefined),
        `${c.name} must declare exactly one of expected or expectFailure`
      ).toBe(true);
    }
    expect(cases.length).toBeGreaterThan(0);
  });
});
