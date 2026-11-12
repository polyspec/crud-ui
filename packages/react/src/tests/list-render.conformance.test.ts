/**
 * CRUDUI list-render conformance — React reference verification (SPEC §9).
 *
 * The read sister of form-render.conformance.test.ts. The shared fixture
 * tests/fixtures/list-render/cases.json declares its `expected_html` to be the
 * React CRUDUI LIST reference generator's OWN normalized output. This test re-verifies
 * that claim by running the real generator (renderList) against the SAME fixture
 * the Vue/Svelte list generators load, normalized through the SAME shared
 * normalizer (legacy/tests/fixtures/form-render/normalize.mts). Every framework
 * generator must reproduce `expected_html` after normalization.
 *
 * DB-agnostic (SPEC §9): rows are INJECTED; sort/pagination are declared only.
 * read-only: a cell is a DISPLAY value — these tests assert no input control ever
 * reaches the output. An unresolved $ref is a LOAD ERROR (ComposeLoadError),
 * never a silent table. Do not weaken assertions; if React disagrees with the
 * fixture, the contract is broken (the fixture is the React output).
 */

import { describe, test, expect } from 'vitest';
import { ComposeLoadError } from '@polyspec/crudui-generator-core';
import { renderList } from '../server';
import { normalizeHtml } from '../../../../legacy/tests/fixtures/form-render/normalize.mts';
// The shared fixture, imported as JSON — the SAME file Vue/Svelte load.
import fixtureCases from '../../../../legacy/tests/fixtures/list-render/cases.json';
import { withoutPreloadLinks } from '../../../../legacy/tests/fixtures/preload-links.mts';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

/** Run one fixture case and record renderList evidence for it. */
function proves(name: string, body: () => unknown): Promise<unknown> {
  return provesConformance(
    { features: ['renderList'], fixture: 'legacy/tests/fixtures/list-render/cases.json', runtime: 'react', case: name },
    body
  );
}

interface ListFixtureCase {
  name: string;
  note: string;
  /** An object, or another JSON value in a case that a JavaScript caller's specification fails. */
  spec: unknown;
  /** An array of objects, or another JSON value in a case that a JavaScript caller's rows fail. */
  rows?: unknown;
  options?: Record<string, unknown>;
  expected_html?: string;
  expectError?: { code: string; message?: string };
}

const cases: ListFixtureCase[] = fixtureCases;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function render(c: ListFixtureCase): string {
  const rows = c.rows ?? [];
  if (isRecord(c.spec) && Array.isArray(rows) && rows.every(isRecord)) return withoutPreloadLinks(renderList(c.spec, rows, c.options ?? {}));
  // A specification or rows that the type of renderList rejects: called as a JavaScript caller does, renderList checks them.
  const html: unknown = Reflect.apply(renderList, undefined, [c.spec, rows, c.options ?? {}]);
  if (typeof html !== 'string') throw new Error(`${c.name}: renderList returned no string`);
  return withoutPreloadLinks(html);
}

describe('list render — React reproduces the normalized expected_html', () => {
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

const ERROR_CLASS_BY_CODE: Record<string, new (...args: never[]) => Error> = { REF_FILE_NOT_FOUND: ComposeLoadError };

describe('list render — invalid input fails with the shared message', () => {
  for (const c of cases) {
    const message = c.expectError?.message;
    if (!message) continue;
    test(c.name, () => proves(c.name, () => {
      expect(() => render(c)).toThrow(message);
    }));
  }
});

describe('list render — a load gap is a surfaced ERROR, never a silent table', () => {
  for (const c of cases) {
    const expected = c.expectError;
    if (!expected || expected.message) continue;
    test(c.name, () => proves(c.name, () => {
      let thrown: unknown;
      try {
        render(c);
      } catch (e) {
        thrown = e;
      }
      const expectedClass = ERROR_CLASS_BY_CODE[expected.code];
      if (!expectedClass) throw new Error(`${c.name}: unknown error code ${expected.code}`);
      expect(thrown, `${c.name} must throw a surfaced error`).toBeInstanceOf(expectedClass);
    }));
  }
});
