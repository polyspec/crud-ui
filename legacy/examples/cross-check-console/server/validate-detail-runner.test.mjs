/**
 * Detail structure validation across the JavaScript, PHP, Go, Rust and Python validator processes.
 *
 * Every case in legacy/tests/fixtures/detail-validity/cases.json runs through `validateAllDetail`
 * (`mode: "detail"`). The engine verdict follows each case's `engine` member: `"pass"` loads cleanly
 * with `valid: true` in all five languages, and `{ code, at }` is the same load failure in all five.
 * The meta-schema `expect` member is not the engine's verdict.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAllDetail } from './validate-runner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const DETAIL_VALIDITY_FIXTURE = path.resolve(ROOT, 'legacy/tests/fixtures/detail-validity/cases.json');

const allCases = JSON.parse(fs.readFileSync(DETAIL_VALIDITY_FIXTURE, 'utf8'));
const cleanCases = allCases.filter((c) => c.engine === 'pass');
const loadFailCases = allCases.filter((c) => c.engine && typeof c.engine === 'object' && c.engine.code);

describe('validateAllDetail — clean structure loads in all five languages', () => {
  for (const c of cleanCases) {
    test(`${c.name} — valid:true everywhere`, async () => {
      const out = await validateAllDetail({ spec: c.spec, files: c.files ?? {}, basepath: '' });
      expect(out.results.filter((r) => !r.ok).map((r) => `${r.lang}:${r.error}`)).toEqual([]);
      expect(out.results.every((r) => r.failure === null && r.valid === true && r.errors.length === 0)).toBe(true);
      expect(out.idempotent, JSON.stringify(out.mismatch)).toBe(true);
    }, 60000);
  }
});

describe('validateAllDetail — load failures agree in all five languages', () => {
  for (const c of loadFailCases) {
    test(`${c.name} — ${c.engine.code} at ${c.engine.at} everywhere`, async () => {
      const out = await validateAllDetail({ spec: c.spec, files: c.files ?? {}, basepath: '' });
      expect(out.results.filter((r) => !r.ok).map((r) => `${r.lang}:${r.error}`)).toEqual([]);
      expect(out.results.every((r) => r.failure && r.failure.code === c.engine.code && r.failure.at === c.engine.at)).toBe(true);
      expect(out.results.every((r) => r.valid === false)).toBe(true);
      expect(out.idempotent, JSON.stringify(out.mismatch)).toBe(true);
    }, 60000);
  }
});
