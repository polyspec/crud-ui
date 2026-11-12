/**
 * Verify Vue's server rendering against the shared detail fixture.
 *
 * tests/fixtures/detail-render/cases.json holds one `expected_html` per detail scenario, generated
 * from the React reference and normalized with the shared normalizer. Vue must reproduce it after
 * the same normalization. Do not weaken this test or edit the fixture by hand; fix the renderer.
 */

import { describe, expect, test } from 'vitest';
import { renderDetail } from '../detailSsr';
import { normalizeHtml } from '../../../../legacy/tests/fixtures/form-render/normalize.mts';
import { withoutPreloadLinks } from '../../../../legacy/tests/fixtures/preload-links.mts';
import cases from '../../../../legacy/tests/fixtures/detail-render/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

/** Run one fixture case and record renderDetail evidence for it. */
function proves(name: string, body: () => unknown): Promise<unknown> {
  return provesConformance(
    { features: ['renderDetail'], fixture: 'legacy/tests/fixtures/detail-render/cases.json', runtime: 'vue', case: name },
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

/**
 * renderDetail as a JavaScript caller calls it (Reflect.apply), with a specification or record that its type rejects;
 * renderDetail checks them.
 */
function renderUnchecked(item: DetailFixture): Promise<unknown> {
  const rendering: unknown = Reflect.apply(renderDetail, undefined, [item.spec, item.record ?? {}, item.options]);
  return Promise.resolve(rendering);
}

describe('detail render — Vue reproduces the normalized expected_html', () => {
  for (const item of fixtures.filter((fixture) => !fixture.expectError)) {
    test(item.name, () => proves(item.name, async () => {
      const record = item.record ?? {};
      if (!isRecord(item.spec) || !isRecord(record)) throw new Error(`${item.name}: the specification or record of a rendered case is no object`);
      expect(normalizeHtml(withoutPreloadLinks(await renderDetail(item.spec, record, item.options)))).toBe(item.expected_html);
    }));
  }
});

describe('detail render — Vue rejects invalid input with the shared message', () => {
  for (const item of fixtures) {
    const expected = item.expectError;
    if (!expected) continue;
    test(item.name, () => proves(item.name, async () => {
      await expect(renderUnchecked(item)).rejects.toThrow(expected.message);
    }));
  }
});
