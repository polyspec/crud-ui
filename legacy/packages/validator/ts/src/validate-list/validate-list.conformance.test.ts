/**
 * CRUDUI list-spec validation conformance — JS reference verification (SPEC §9).
 *
 * The read sister of validate.conformance.test.ts. It pins the four-language
 * structure check for a list-spec: compose ($ref/$patch on the columns map and a
 * `{ $ref, $patch }` search overlay) + forbidden-scan over the whole composed
 * list tree. It does NOT validate rows — a list has no data (rows are injected,
 * SPEC §9).
 *
 * It runs the SHARED fixture legacy/tests/fixtures/list-validity/cases.json — the
 * same file the Ajv meta-schema check reads. The fixture identifies which
 * checker owns each requirement:
 *  - `engine: "pass"`                       — the four-language engine has NO
 *    opinion (a "schema shape" check: required/enum/additionalProperties/anyOf).
 *    The meta-schema may still REJECT it; the engine must NOT throw.
 *  - `engine: { code, at }`                 — the engine REJECTS it as a LOAD
 *    failure (a forbidden meta key surfaced by compose+forbidden-scan). The
 *    thrown `ComposeLoadError.code` and dotted `trace` are asserted — the depth is
 *    load-bearing.
 *
 * This proves the design claim: list 4-language validation = form passes 1+2
 * (compose + forbidden-scan) reused, DATA pass excluded. The "schema shape" half
 * stays with the meta-schema (no new invention).
 *
 * Do not weaken assertions. If JS disagrees with the fixture, the fixture is NOT
 * the JS engine output and the cross-language contract is broken.
 */

import assert from 'node:assert/strict';
import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateList } from './index';
import { ComposeLoadError } from '../compose/index';
import { isRecord } from '../record';
import { provesConformance } from '../../../../../../tests/conformance/evidence.mts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// src/validate-list -> repo root is five levels up.
const FIXTURE = path.resolve(
  __dirname,
  '../../../../../tests/fixtures/list-validity/cases.json'
);

interface ListValidityCase {
  name: string;
  note: string;
  /** What the four-language engine (compose + forbidden-scan) does. */
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
function readCases(file: string): ListValidityCase[] {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new TypeError(`${file} holds no list of cases`);
  return value.map((item: unknown, index): ListValidityCase => {
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

/** Run one fixture case and record validateList evidence for it. */
function proves(name: string, body: () => void): Promise<void> {
  return provesConformance(
    { features: ['validateList'], fixture: 'legacy/tests/fixtures/list-validity/cases.json', runtime: 'javascript', case: name },
    body
  );
}

function run(c: ListValidityCase) {
  return validateList(c.spec, c.files ? { files: c.files } : {});
}

describe('list validate — every case declares an engine expectation', () => {
  test('no case is silently missing `engine`', () => {
    for (const c of cases) {
      const ok =
        c.engine === 'pass' ||
        isLoadError(c.engine);
      expect(ok, `${c.name} must declare engine: "pass" | {code, at}`).toBe(true);
    }
    expect(cases.length).toBeGreaterThan(0);
  });
});

for (const c of cases.filter((x) => x.engine === 'pass')) {
  test(c.name, () =>
    proves(c.name, () => {
      // The structure check does not reject a meta-schema-only invalid case
      // (required/enum/additionalProperties/anyOf) is the meta-schema's job,
      // never this engine's — so it loads clean here.
      let result: ReturnType<typeof validateList> | undefined;
      expect(() => {
        result = run(c);
      }, `${c.name} must not be rejected by the four-language structure check`).not.toThrow();
      // No rows → no data validation: a clean load is always { valid:true, errors:[] }.
      expect(result).toStrictEqual({ valid: true, errors: [] });
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
      // The dotted trace points at the shallowest offending key — depth is
      // load-bearing (a deeply nested meta key must be caught at its real path).
      expect(err.trace.join('.')).toStrictEqual(want.at);
    }));
}

describe('list validate — does NOT touch form-spec validate (R7 parallel)', () => {
  test('validateList takes no `data` argument and validates no rows', () => {
    // A list-spec carrying a "data-shaped" key alongside columns is irrelevant:
    // the function signature has no data slot and the result never reflects rows.
    const result = validateList({
      columns: { name: { field: 'name' } },
    });
    expect(result).toStrictEqual({ valid: true, errors: [] });
    // Two args max (spec, options) — there is no third data argument.
    expect(validateList.length).toBeLessThanOrEqual(2);
  });
});
