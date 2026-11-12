/**
 * CRUDUI composition-engine conformance — JS reference verification.
 *
 * The shared fixture legacy/tests/fixtures/compose/cases.json is declared to be the JS
 * reference compose engine's own output (expanded single spec, or load-error
 * code). This test RE-VERIFIES that claim by running the real engine
 * (composeProperties / composeSpec) against the same fixture the other three
 * engines (PHP / Go / Rust) load, with type-strict comparison.
 *
 * It also enforces the core invariant (SPEC §5, §7): an unresolved composition
 * is a LOAD ERROR (ComposeLoadError) — never `valid:true`. Each `err-*` case
 * must throw the exact `expectError.code`; each success case must reproduce
 * `expected` bit-for-bit (composition keys eliminated).
 *
 * Do not weaken assertions. If JS disagrees with the fixture, the fixture is NOT
 * the JS output and the cross-language contract is broken.
 */

import assert from 'node:assert/strict';
import { test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  composeProperties,
  composeSpec,
  MemoryLoader,
  ComposeLoadError,
} from './compose/index';
import { provesConformance } from '../../../../../tests/conformance/evidence.mts';
import { isRecord } from './record';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// legacy/packages/validator/ts/src -> repo root is three levels up.
const FIXTURE = path.resolve(
  __dirname,
  '../../../../tests/fixtures/compose/cases.json'
);

interface CaseInput {
  files?: Record<string, Record<string, unknown>>;
  entry: Record<string, unknown>;
  kind?: 'properties' | 'spec';
  basepath?: string;
}
interface FixtureCase {
  name: string;
  note: string;
  input: CaseInput;
  expected?: unknown;
  expectError?: { code: string };
}

/** Whether a value is a set of composition files: an object of JSON objects. */
const isFileSet = (value: unknown): value is Record<string, Record<string, unknown>> =>
  isRecord(value) && Object.values(value).every(isRecord);

/** The input of a case, checked to hold an entry and, when present, files, a kind and a base path. */
function caseInput(value: unknown, at: string): CaseInput {
  if (!isRecord(value) || !isRecord(value.entry)) throw new TypeError(`${at}: the input has no entry`);
  const { files, kind, basepath } = value;
  if (files !== undefined && !isFileSet(files)) throw new TypeError(`${at}: the files are no file set`);
  if (kind !== undefined && kind !== 'properties' && kind !== 'spec') throw new TypeError(`${at}: unknown kind`);
  if (basepath !== undefined && typeof basepath !== 'string') throw new TypeError(`${at}: the base path is no string`);
  return {
    entry: value.entry,
    ...(files === undefined ? {} : { files }),
    ...(kind === undefined ? {} : { kind }),
    ...(basepath === undefined ? {} : { basepath }),
  };
}

/** The cases of the fixture, each checked to hold a name, a note, an input and, when present, an error code. */
function readCases(file: string): FixtureCase[] {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new TypeError(`${file} holds no list of cases`);
  return value.map((item: unknown, index): FixtureCase => {
    const at = `case ${index} of ${file}`;
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.note !== 'string') {
      throw new TypeError(`${at}: no name and note`);
    }
    const { expectError } = item;
    if (expectError !== undefined && !(isRecord(expectError) && typeof expectError.code === 'string')) {
      throw new TypeError(`${at}: the expected error has no code`);
    }
    return {
      name: item.name, note: item.note, input: caseInput(item.input, at),
      ...('expected' in item ? { expected: item.expected } : {}),
      ...(expectError === undefined ? {} : { expectError: { code: expectError.code } }),
    };
  });
}

const cases = readCases(FIXTURE);

// Stable key ordering so object comparison is order-insensitive (the other
// harnesses canonicalize the same way). Arrays keep their order.
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      out[k] = canon(Reflect.get(v, k));
    }
    return out;
  }
  return v;
}

function run(c: FixtureCase): Record<string, unknown> {
  const loader = new MemoryLoader(c.input.files ?? {});
  const opts = c.input.basepath ? { basepath: c.input.basepath } : {};
  return (c.input.kind ?? 'properties') === 'spec'
    ? composeSpec(c.input.entry, loader, opts)
    : composeProperties(c.input.entry, loader, opts);
}

function proves(name: string, body: () => void): Promise<void> {
  return provesConformance(
    { features: ['compileForm'], fixture: 'legacy/tests/fixtures/compose/cases.json', runtime: 'javascript', case: name },
    body
  );
}

// Each case is a top-level test named by the case, which the parity check reads as the case it runs.
for (const c of cases.filter((x) => !x.expectError)) {
  test(c.name, () =>
    proves(c.name, () => {
      const result = run(c);
      expect(canon(result)).toStrictEqual(canon(c.expected));
      // Composition keys must be eliminated (single-spec equivalence, SPEC §5).
      const json = JSON.stringify(result);
      expect(json).not.toContain('"$ref"');
      expect(json).not.toContain('"$patch"');
      // Composition is pure pre-processing (field-layer invariant): a composed single spec
      // must be bit-identical to the same content written WITHOUT composition. Re-composing
      // the already-expanded spec (no $ref/$patch left) must be a fixed point.
      const again = composeProperties(result, new MemoryLoader({}));
      expect(canon(again), `${c.name} — re-compose is a fixed point`).toStrictEqual(canon(result));
    }));
}

// An unresolved composition is a load error that names the recorded code, never a valid result.
for (const c of cases.filter((x) => x.expectError)) {
  test(c.name, () =>
    proves(c.name, () => {
      let thrown: unknown;
      try {
        run(c);
      } catch (e) {
        thrown = e;
      }
      assert(thrown instanceof ComposeLoadError, `${c.name} must throw a load error`);
      expect(thrown.code).toStrictEqual(c.expectError?.code);
    }));
}
