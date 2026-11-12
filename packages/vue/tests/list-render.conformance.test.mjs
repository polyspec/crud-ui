/**
 * Verify Vue 3 SSR against the shared three-framework list fixtures.
 *
 * The read sister of form-render.conformance.test.mjs. The shared fixture
 * tests/fixtures/list-render/cases.json holds ONE `expected_html` per list
 * scenario (the React CRUDUI LIST reference's normalized output, SPEC §9). This test
 * runs the Vue list generator through genuine Vue 3 SSR (renderList →
 * vue/server-renderer renderToString), normalizes with the SAME shared
 * normalizer, and asserts equality. Vue must reproduce
 * `expected_html` after normalization.
 *
 * DB-agnostic (SPEC §9): rows are INJECTED; sort/pagination are declared only.
 * read-only: a cell is a DISPLAY value — these tests assert no input control ever
 * reaches the output. An unresolved $ref is a LOAD ERROR (ComposeLoadError),
 * never a silent table. Do NOT weaken assertions or the fixture; fix the Vue
 * generator if it disagrees (the fixture is the React reference truth).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';

import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { renderList } from '../src/listSsr.ts';
import { ComposeLoadError } from '@polyspec/crudui-generator-core';
import { provesConformance } from '../../../tests/conformance/evidence.mts';

/** Run one fixture case and record renderList evidence for it. */
function proves(name, body) {
  return provesConformance(
    { features: ['renderList'], fixture: 'legacy/tests/fixtures/list-render/cases.json', runtime: 'vue', case: name },
    body
  );
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '../../../legacy/tests/fixtures/list-render/cases.json');
const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));



async function render(c) {
  return renderList(c.spec, c.rows ?? [], c.options);
}

const ERROR_CLASS_BY_CODE = { REF_FILE_NOT_FOUND: ComposeLoadError };

describe('list render — Vue 3 SSR reproduces the normalized expected_html', () => {
  for (const c of cases.filter((x) => !x.expectError)) {
    test(c.name, () => proves(c.name, async () => {
      expect(normalizeHtml(await render(c))).toStrictEqual(c.expected_html);
    }));
  }
});

describe('list render — render is idempotent (stable across re-render)', () => {
  for (const c of cases.filter((x) => !x.expectError)) {
    test(`${c.name} — re-render is stable`, () => proves(c.name, async () => {
      expect(normalizeHtml(await render(c))).toStrictEqual(normalizeHtml(await render(c)));
    }));
  }
});

describe('list render — read-only invariant (no input control EVER reaches output)', () => {
  for (const c of cases.filter((x) => x.expected_html)) {
    test(`${c.name} — no input/select/textarea/form`, () => proves(c.name, async () => {
      const raw = await render(c);
      expect(raw).not.toMatch(/<input\b/);
      expect(raw).not.toMatch(/<select\b/);
      expect(raw).not.toMatch(/<textarea\b/);
      expect(raw).not.toMatch(/<form\b/);
    }));
  }
});

describe('list render — invalid input fails with the shared message', () => {
  for (const c of cases.filter((x) => x.expectError?.message)) {
    test(c.name, () => proves(c.name, async () => {
      await expect(render(c)).rejects.toThrow(c.expectError.message);
    }));
  }
});

describe('list render — a load gap is a surfaced ERROR, never a silent table', () => {
  for (const c of cases.filter((x) => x.expectError && !x.expectError.message)) {
    test(c.name, () => proves(c.name, async () => {
      let thrown;
      try {
        await render(c);
      } catch (e) {
        thrown = e;
      }
      const expectedClass = ERROR_CLASS_BY_CODE[c.expectError.code];
      expect(expectedClass, `${c.name}: unknown error code ${c.expectError.code}`).toBeTruthy();
      expect(thrown, `${c.name} must throw a surfaced error`).toBeInstanceOf(expectedClass);
    }));
  }
});
