/**
 * Detail specification structure conformance for the JavaScript reference.
 *
 * It runs the shared fixture legacy/tests/fixtures/detail-validity/cases.json, which the meta-schema check
 * and the Go, PHP, PHP extension and Rust validators read as well. Each case declares what the
 * four-language engine does:
 *  - `engine: "pass"` — composition and the forbidden-key scan load cleanly. The meta-schema may
 *    still reject the case (`expect: "fail"`); the engine must not.
 *  - `engine: { code, at }` — the engine rejects the case as a load failure with that code and
 *    dotted composition trace.
 */

import assert from 'node:assert/strict';
import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDetail } from './index';
import { ComposeLoadError } from '../compose/index';
import { isRecord } from '../record';
import { provesConformance } from '../../../../../../tests/conformance/evidence.mts';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../tests/fixtures/detail-validity/cases.json'
);

interface DetailValidityCase {
  name: string;
  note: string;
  engine: unknown;
  files?: Record<string, Record<string, unknown>>;
  spec: Record<string, unknown>;
}

/** Whether a value is a set of composition files: an object of JSON objects. */
const isFileSet = (value: unknown): value is Record<string, Record<string, unknown>> =>
  isRecord(value) && Object.values(value).every(isRecord);

/** Whether an engine expectation is a load error: its code and the dotted path of the offending key. */
const isLoadError = (engine: unknown): engine is { code: string; at: string } =>
  isRecord(engine) && typeof engine.code === 'string' && typeof engine.at === 'string';

/** The cases of the fixture, each checked to hold a name, a note, a spec and, when present, composition files. */
function readCases(file: string): DetailValidityCase[] {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new TypeError(`${file} holds no list of cases`);
  return value.map((item: unknown, index): DetailValidityCase => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.note !== 'string' || !isRecord(item.spec)
      || (item.files !== undefined && !isFileSet(item.files))) {
      throw new TypeError(`case ${index} of ${file} has no name, note and spec, or files that are no file set`);
    }
    return {
      name: item.name, note: item.note, spec: item.spec, engine: item.engine,
      ...(isFileSet(item.files) ? { files: item.files } : {}),
    };
  });
}

const cases = readCases(FIXTURE);

/** Run one fixture case and record validateDetail evidence for it. */
function proves(name: string, body: () => void): Promise<void> {
  return provesConformance(
    { features: ['validateDetail'], fixture: 'legacy/tests/fixtures/detail-validity/cases.json', runtime: 'javascript', case: name },
    body
  );
}

function run(c: DetailValidityCase) {
  return validateDetail(c.spec, c.files ? { files: c.files } : {});
}

describe('detail validate — every case declares an engine expectation', () => {
  test('no case is missing engine', () => {
    for (const c of cases) {
      const declared =
        c.engine === 'pass' ||
        isLoadError(c.engine);
      expect(declared, `${c.name} must declare engine: "pass" | {code, at}`).toBe(true);
    }
    expect(cases.length).toBeGreaterThan(0);
  });
});

for (const c of cases.filter((x) => x.engine === 'pass')) {
  test(c.name, () =>
    proves(c.name, () => {
      expect(run(c)).toStrictEqual({ valid: true, errors: [] });
    }));
}

for (const c of cases.filter((x) => isLoadError(x.engine))) {
  test(c.name, () =>
    proves(c.name, () => {
      const want = c.engine;
      assert(isLoadError(want), `${c.name} expects a load error`);
      let thrown: unknown;
      try {
        run(c);
      } catch (error) {
        thrown = error;
      }
      assert(thrown instanceof ComposeLoadError, `${c.name} must throw a load error`);
      const error = thrown;
      expect(error.code).toStrictEqual(want.code);
      expect(error.trace.join('.')).toStrictEqual(want.at);
    }));
}
