/**
 * CRUDUI list-spec meta-schema conformance (SPEC §9.4).
 *
 * The list meta-schema check complements the form-spec check. The definitions are
 * ADDITIVE to contracts/schema/crudui.schema.json — they do NOT touch the form-spec
 * Field entry point (the top `$ref` stays `#/definitions/Field`); a list-spec is
 * validated through a DIFFERENT entry, `#/definitions/List`. This test compiles
 * that entry with the same Ajv configuration as the CLI meta-schema check
 * (cli check.ts: `new Ajv({ strict:false, allErrors:true })` +
 * ajv-formats) and runs the shared fixture legacy/tests/fixtures/list-validity.
 *
 * The §9.4 checks require these results:
 *  - a valid list-spec passes (columns + the §9.2 catalog + read structure slots);
 *  - a forbidden column key / x-prefixed key / forbidden meta key one level below
 *    the open CellFormat options bucket is rejected (ForbiddenKeyNames, shared);
 *  - an unsupported key on Column/Sort/Pagination/ListAction or at the List top is
 *    rejected (additionalProperties:false);
 *  - a bad enum (sort.dir / pagination.mode) and a malformed CellFormat shape are
 *    rejected.
 *
 * Invalid fixture cases must remain rejected for their declared reason.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { isRecord } from './record';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../../../..');
const SCHEMA_PATH = path.join(ROOT, 'contracts/schema/crudui.schema.json');
const FIXTURE = path.join(ROOT, 'legacy/tests/fixtures/list-validity/cases.json');

interface ListValidityCase {
  name: string;
  note: string;
  expect: 'ok' | 'fail';
  reason?: string;
  spec: unknown;
}

/** The cases of the fixture, each checked to hold a name, a note, the meta-schema result and, for a failure, its reason. */
function readCases(file: string): ListValidityCase[] {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new TypeError(`${file} holds no list of cases`);
  return value.map((item: unknown, index): ListValidityCase => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.note !== 'string'
      || (item.expect !== 'ok' && item.expect !== 'fail') || (item.reason !== undefined && typeof item.reason !== 'string')) {
      throw new TypeError(`case ${index} of ${file} has no name, note and expect, or a reason that is no string`);
    }
    const { reason } = item;
    return { name: item.name, note: item.note, expect: item.expect, spec: item.spec, ...(reason === undefined ? {} : { reason }) };
  });
}

/** The meta-schema, checked to name its draft and to hold its definitions. */
function readSchema(file: string): { $schema: string; definitions: Record<string, unknown> } & Record<string, unknown> {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!isRecord(value) || typeof value.$schema !== 'string' || !isRecord(value.definitions)) {
    throw new TypeError(`${file} holds no schema with $schema and definitions`);
  }
  return { ...value, $schema: value.$schema, definitions: value.definitions };
}

const schema = readSchema(SCHEMA_PATH);
const cases = readCases(FIXTURE);

/**
 * Compile a root that points at `#/definitions/List` while keeping the shared
 * `definitions` — the list entry, NOT the form Field entry. This proves the list
 * definitions are additive: the top `$ref` of the schema file is left untouched
 * (it still targets Field), and the list is reachable as its own entry point.
 */
function compileListValidator(): ValidateFunction {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  const listRoot = {
    $schema: schema.$schema,
    definitions: schema.definitions,
    $ref: '#/definitions/List',
  };
  return ajv.compile(listRoot);
}

const validateList = compileListValidator();

describe('list meta-schema — additive: Field entry point is untouched', () => {
  test('the schema file top $ref still targets the form-spec Field (unchanged)', () => {
    expect(schema.$ref).toStrictEqual('#/definitions/Field');
  });

  test('the 7 list definitions are present (additive)', () => {
    for (const def of ['List', 'Columns', 'Column', 'CellFormat', 'Sort', 'Pagination', 'ListAction']) {
      expect(schema.definitions[def], `missing list definition ${def}`).toBeTruthy();
    }
  });
});

describe('list meta-schema — a valid list-spec passes (§9.4)', () => {
  for (const c of cases.filter((x) => x.expect === 'ok')) {
    test(c.name, () => {
      const ok = validateList(c.spec);
      expect(ok, `${c.name} should validate but did not: ${JSON.stringify(validateList.errors)}`).toBe(true);
    });
  }
});

describe('list meta-schema rejects invalid list specifications (§9.4)', () => {
  for (const c of cases.filter((x) => x.expect === 'fail')) {
    test(c.name, () => {
      const ok = validateList(c.spec);
      expect(ok, `${c.name} must be rejected by the meta-schema`).toBe(false);
      // The declared rejection keyword must appear among the ajv errors — the
      // The invalid case fails for its documented reason.
      if (c.reason) {
        const keywords = (validateList.errors ?? []).map((e) => e.keyword);
        expect(keywords, `${c.name}: expected '${c.reason}' among ${JSON.stringify(keywords)}`).toContain(
          c.reason
        );
      }
    });
  }
});
