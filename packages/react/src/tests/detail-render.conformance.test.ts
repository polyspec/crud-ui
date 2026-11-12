/**
 * Verify React's server rendering, the detail reference, against the shared detail fixture.
 *
 * tests/fixtures/detail-render/cases.json holds one `expected_html` per detail scenario, generated
 * from this renderer and normalized with the shared normalizer. Vue, Svelte and the HTML renderer
 * run the same file; the native generators compare the raw bytes. Do not weaken this test or edit
 * the fixture by hand: regenerate the fixture when the contract changes.
 */

import { describe, expect, test } from 'vitest';
import { renderDetail } from '../server';
import { normalizeHtml } from '../../../../legacy/tests/fixtures/form-render/normalize.mts';
import { withoutPreloadLinks } from '../../../../legacy/tests/fixtures/preload-links.mts';
import cases from '../../../../legacy/tests/fixtures/detail-render/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

/** Run one fixture case and record renderDetail evidence for it. */
function proves(name: string, body: () => unknown): Promise<unknown> {
  return provesConformance(
    { features: ['renderDetail'], fixture: 'legacy/tests/fixtures/detail-render/cases.json', runtime: 'react', case: name },
    body
  );
}

interface DetailFixture {
  name: string;
  /** An object, or another JSON value in a case that a JavaScript caller's specification fails. */
  spec: unknown;
  /** An object, or another JSON value in a case that a JavaScript caller's record fails. */
  record?: unknown;
  options?: Record<string, unknown>;
  expected_html?: string;
  expectError?: { code: string; message: string };
}

const fixtures: DetailFixture[] = cases;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function render(item: DetailFixture): string {
  const record = item.record ?? {};
  if (isRecord(item.spec) && isRecord(record)) return renderDetail(item.spec, record, item.options);
  // A specification or record that the type of renderDetail rejects: called as a JavaScript caller does, renderDetail checks them.
  const html: unknown = Reflect.apply(renderDetail, undefined, [item.spec, record, item.options]);
  if (typeof html !== 'string') throw new Error(`${item.name}: renderDetail returned no string`);
  return html;
}

describe('detail render — React reproduces the normalized expected_html', () => {
  for (const item of fixtures.filter((fixture) => !fixture.expectError)) {
    test(item.name, () => proves(item.name, () => {
      expect(normalizeHtml(withoutPreloadLinks(render(item)))).toBe(item.expected_html);
    }));
  }
});

describe('detail render — React rejects invalid input with the shared message', () => {
  for (const item of fixtures) {
    const expected = item.expectError;
    if (!expected) continue;
    test(item.name, () => proves(item.name, () => {
      expect(() => render(item)).toThrow(expected.message);
    }));
  }
});

describe('detail render — read-only output contains no control', () => {
  for (const item of fixtures.filter((fixture) => !fixture.expectError)) {
    test(item.name, () => proves(item.name, () => {
      expect(render(item)).not.toMatch(/<(?:input|select|textarea|form)\b/);
    }));
  }
});
