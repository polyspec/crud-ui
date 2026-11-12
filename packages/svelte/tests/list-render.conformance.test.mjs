/**
 * Verify Svelte SSR against the shared three-framework list fixtures.
 *
 * The read sister of form-render.conformance.test.mjs. The shared fixture
 * tests/fixtures/list-render/cases.json declares one `expected_html` per list
 * scenario (the React CRUDUI LIST reference generator's OWN normalized output, SPEC
 * §9). This test runs the SVELTE list generator (renderList → List.svelte →
 * svelte/server render()) against the SAME fixture, normalized through the SAME
 * shared normalizer. Every generator must reproduce
 * `expected_html` after normalization.
 *
 * DB-agnostic (SPEC §9): rows are INJECTED; sort/pagination are declared only.
 * read-only: a cell is a DISPLAY value, never an input — these tests assert no
 * `<input>`/`<select>`/`<textarea>`/`<form>` ever reaches the output.
 *
 * Do not weaken assertions or the fixture; the fixture is the React reference
 * truth. If Svelte disagrees, the Svelte adapter is wrong, never the reverse. An
 * unresolved $ref is a LOAD ERROR (ComposeLoadError), never a silent render.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { ComposeLoadError } from '@polyspec/crudui-generator-core';
import { renderList } from '../src/index.ts';
import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { provesConformance } from '../../../tests/conformance/evidence.mts';

/** Run one fixture case and record renderList evidence for it. */
function proves(name, body) {
  return provesConformance(
    { features: ['renderList'], fixture: 'legacy/tests/fixtures/list-render/cases.json', runtime: 'svelte', case: name },
    body
  );
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '../../../legacy/tests/fixtures/list-render/cases.json');
const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));



function render(c) {
  return renderList(c.spec, c.rows ?? [], c.options);
}

const ERROR_CLASS_BY_CODE = { REF_FILE_NOT_FOUND: ComposeLoadError };

describe('list render — Svelte reproduces the normalized expected_html', () => {
  for (const c of cases.filter((x) => !x.expectError)) {
    test(c.name, () => proves(c.name, () => {
      expect(normalizeHtml(render(c))).toStrictEqual(c.expected_html);
    }));
  }
});

describe('list render — render is idempotent (stable across re-render)', () => {
  for (const c of cases.filter((x) => !x.expectError)) {
    test(`${c.name} — re-render is stable`, () => proves(c.name, () => {
      expect(normalizeHtml(render(c))).toStrictEqual(normalizeHtml(render(c)));
    }));
  }
});

describe('list render — read-only invariant (no input control EVER reaches output)', () => {
  for (const c of cases.filter((x) => x.expected_html)) {
    test(`${c.name} — no input/select/textarea/form`, () => proves(c.name, () => {
      const raw = render(c);
      expect(raw).not.toMatch(/<input\b/);
      expect(raw).not.toMatch(/<select\b/);
      expect(raw).not.toMatch(/<textarea\b/);
      expect(raw).not.toMatch(/<form\b/);
    }));
  }
});

describe('list render — invalid input fails with the shared message', () => {
  for (const c of cases.filter((x) => x.expectError?.message)) {
    test(c.name, () => proves(c.name, () => {
      expect(() => render(c)).toThrow(c.expectError.message);
    }));
  }
});

describe('list render — a load gap is a surfaced ERROR, never a silent table', () => {
  for (const c of cases.filter((x) => x.expectError && !x.expectError.message)) {
    test(c.name, () => proves(c.name, () => {
      let thrown;
      try {
        render(c);
      } catch (e) {
        thrown = e;
      }
      const expectedClass = ERROR_CLASS_BY_CODE[c.expectError.code];
      expect(expectedClass, `${c.name}: unknown error code ${c.expectError.code}`).toBeTruthy();
      expect(thrown, `${c.name} must throw a surfaced error`).toBeInstanceOf(expectedClass);
    }));
  }
});
