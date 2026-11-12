/**
 * CRUDUI recursive forbidden-scan conformance — JS reference verification.
 *
 * The shared fixture legacy/tests/fixtures/spec-validity/cases.json is the cross-
 * language contract for SPEC §6 global meta-key rejection: a clean spec
 * passes; a forbidden meta key found at ANY depth (slot/bucket body and one
 * level below, deep child subtrees, array elements, $ref-inherited bases) is a
 * LOAD ERROR, never `valid:true`. This test RE-VERIFIES the claim by running the
 * real load path (`validate` = compose → forbidden-scan → validate) against
 * the same fixture PHP / Go / Rust load.
 *
 * Each `engine: "pass"` case must return `{ valid: true, errors: [], hidden: [] }`. Each
 * `engine: { code, at }` case must throw a `ComposeLoadError` whose `code` is
 * `code` AND whose path (`trace`, dotted) equals `at` — the depth is
 * load-bearing, so the path is asserted, not just the code. The case `files` are
 * the composition files passed to the runtime. The meta-schema members `expect`
 * and `reason` are checked by form-metaschema.conformance.test.ts.
 *
 * Do not weaken assertions. If JS disagrees with the fixture, the fixture is NOT
 * the JS output and the cross-language contract is broken.
 */

import assert from 'node:assert/strict';
import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, ComposeLoadError } from './validate/index';
import { isRecord } from './record';
import { provesConformance } from '../../../../../tests/conformance/evidence.mts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// legacy/packages/validator/ts/src -> repo root is three levels up.
const FIXTURE = path.resolve(
  __dirname,
  '../../../../tests/fixtures/spec-validity/cases.json'
);

interface FixtureCase {
  name: string;
  note: string;
  spec: Record<string, unknown>;
  files?: Record<string, Record<string, unknown>>;
  engine: unknown;
}

/** Whether a value is a set of composition files: an object of JSON objects. */
const isFileSet = (value: unknown): value is Record<string, Record<string, unknown>> =>
  isRecord(value) && Object.values(value).every(isRecord);

/** Whether an engine expectation is a load error: its code and the dotted path of the offending key. */
const isLoadError = (engine: unknown): engine is { code: string; at: string } =>
  isRecord(engine) && typeof engine.code === 'string' && typeof engine.at === 'string';

/** The cases of the fixture, each checked to hold a name, a note, a spec and, when present, composition files. */
function readCases(file: string): FixtureCase[] {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new TypeError(`${file} holds no list of cases`);
  return value.map((item: unknown, index): FixtureCase => {
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

/** Run one fixture case and record validate evidence for it. */
function proves(name: string, body: () => void): Promise<void> {
  return provesConformance(
    { features: ['validate'], fixture: 'legacy/tests/fixtures/spec-validity/cases.json', runtime: 'javascript', case: name },
    body
  );
}

function run(c: FixtureCase) {
  // Data is irrelevant to the scan; pass an empty object. The scan runs in the
  // load path before any data-driven validation.
  return validate(c.spec, {}, c.files ? { files: c.files } : {});
}

for (const c of cases.filter((x) => x.engine === 'pass')) {
  test(c.name, () =>
    proves(c.name, () => {
      expect(run(c)).toStrictEqual({ valid: true, errors: [], hidden: [] });
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
      } catch (e) {
        thrown = e;
      }
      assert(thrown instanceof ComposeLoadError, `${c.name} must throw a load error`);
      const err = thrown;
      expect(err.code).toStrictEqual(want.code);
      expect(err.trace.join('.')).toStrictEqual(want.at);
    }));
}

describe('forbidden-scan — every fixture case declares an expectation', () => {
  test('no case is silently missing an engine field', () => {
    for (const c of cases) {
      const ok =
        c.engine === 'pass' ||
        isLoadError(c.engine);
      expect(ok, `${c.name} must declare engine: "pass" | {code, at}`).toBe(true);
    }
    expect(cases.length).toBeGreaterThan(0);
  });
});
