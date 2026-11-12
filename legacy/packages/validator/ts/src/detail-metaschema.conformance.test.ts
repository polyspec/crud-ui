/**
 * CRUDUI detail-spec meta-schema conformance.
 *
 * This test compiles `#/definitions/Detail` from contracts/schema/crudui.schema.json with the
 * same Ajv configuration as scripts/check-schema.mts
 * (`new Ajv({ strict:false, allErrors:true })` + ajv-formats) and runs the shared
 * fixture legacy/tests/fixtures/detail-validity. Each case declares the meta-schema result
 * in `expect`; a `fail` case names in `reason` the Ajv keyword that must appear
 * among the errors. The runtime result in `engine` is checked by
 * validate-detail/validate-detail.conformance.test.ts.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { isRecord } from './record';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SCHEMA_PATH = path.join(ROOT, 'contracts/schema/crudui.schema.json');
const FIXTURE = path.join(ROOT, 'legacy/tests/fixtures/detail-validity/cases.json');

interface DetailValidityCase {
  name: string;
  note: string;
  expect: 'ok' | 'fail';
  reason?: string;
  spec: unknown;
}

/** The cases of the fixture, each checked to hold a name, a note, the meta-schema result and, for a failure, its reason. */
function readCases(file: string): DetailValidityCase[] {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new TypeError(`${file} holds no list of cases`);
  return value.map((item: unknown, index): DetailValidityCase => {
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

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateDetail = ajv.compile({
  $schema: schema.$schema,
  definitions: schema.definitions,
  $ref: '#/definitions/Detail',
});

describe('detail meta-schema — cases expected to pass', () => {
  for (const c of cases.filter((x) => x.expect === 'ok')) {
    test(c.name, () => {
      const ok = validateDetail(c.spec);
      expect(ok, `${c.name} should validate but did not: ${JSON.stringify(validateDetail.errors)}`).toBe(true);
    });
  }
});

describe('detail meta-schema — cases expected to fail for their reason', () => {
  for (const c of cases.filter((x) => x.expect === 'fail')) {
    test(c.name, () => {
      const ok = validateDetail(c.spec);
      expect(ok, `${c.name} must be rejected by the meta-schema`).toBe(false);
      const keywords = (validateDetail.errors ?? []).map((e) => e.keyword);
      expect(keywords, `${c.name}: expected '${c.reason}' among ${JSON.stringify(keywords)}`).toContain(c.reason);
    });
  }
});
