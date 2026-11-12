/**
 * The form tab's fixture export (../client/fixture-export.js) writes each language's validation
 * result in the shape of legacy/tests/fixtures/validate/cases.json: the cases below run through the five
 * validator processes, and every exported case states the `spec`, `data` and `expected` or
 * `expectFailure` of the shared case.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ROOT } from './engine.mjs';
import { validateAll } from './validate-runner.mjs';
import { validateCases } from '../client/fixture-export.js';

// The form tab sends no files and no base path.
const cases = JSON.parse(fs.readFileSync(path.join(ROOT, 'legacy/tests/fixtures/validate/cases.json'), 'utf8'))
  .filter(c => !Object.hasOwn(c, 'files'));

// A result with hidden paths, a result with errors and a failure record.
const selected = [
  cases.find(c => c.expected?.hidden.length > 0 && c.expected.errors.length > 0),
  cases.find(c => c.expected?.hidden.length > 0 && c.expected.valid),
  cases.find(c => c.expected && c.expected.hidden.length === 0 && !c.expected.valid),
  cases.find(c => c.expectFailure),
];

/** The members of a case other than its name and note. */
const withoutLabels = item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'name' && key !== 'note'));

describe('fixture export — form validation cases', () => {
  test('the shared cases include each selected kind', () => {
    expect(selected.every(Boolean)).toBe(true);
  });

  test('an unannotated export has an empty requirement list', () => {
    const exported = validateCases({ name: 'draft', spec: {}, data: {}, run: {
      idempotent: true, results: [{ lang: 'js', ok: true, valid: true, errors: [], hidden: [] }],
    } });
    expect(exported[0].requirements).toStrictEqual([]);
  });

  test('requirement IDs retain their order without sharing the input array', () => {
    const requirements = ['CUVR-001', 'CUSC-001'];
    const exported = validateCases({ name: 'annotated', requirements, spec: {}, data: {}, run: {
      idempotent: true, results: [{ lang: 'js', ok: true, valid: true, errors: [], hidden: [] }],
    } });
    expect(exported[0].requirements).toStrictEqual(requirements);
    expect(exported[0].requirements).not.toBe(requirements);
  });

  for (const c of selected.filter(Boolean)) {
    test(c.name, async () => {
      const run = await validateAll({ spec: c.spec, data: c.data, files: {}, basepath: '' });
      const exported = validateCases({ name: c.name, requirements: c.requirements, spec: c.spec, data: c.data, run });
      expect(exported.map(item => item.name)).toStrictEqual(['js', 'php', 'go', 'rust', 'python'].map(lang => `${c.name}--${lang}`));
      for (const item of exported) {
        expect(Object.keys(item).sort()).toStrictEqual(Object.keys(c).sort());
        expect(withoutLabels(item)).toStrictEqual(withoutLabels(c));
      }
    }, 60000);
  }
});
