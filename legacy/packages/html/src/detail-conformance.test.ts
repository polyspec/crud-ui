import { expect, test } from 'vitest';
import { renderDetail } from './index';
// @ts-expect-error shared JavaScript fixture normalizer
import { normalizeHtml } from '../../../tests/fixtures/form-render/normalize.mts';
// @ts-expect-error shared JavaScript preload link helper
import { withoutPreloadLinks } from '../../../tests/fixtures/preload-links.mts';
import cases from '../../../tests/fixtures/detail-render/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

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

/** Run one fixture case and record renderDetail evidence for the HTML renderer. */
function proves(name: string, body: () => void): Promise<void> {
  return provesConformance(
    { features: ['renderDetail'], fixture: 'legacy/tests/fixtures/detail-render/cases.json', runtime: 'javascript-html', case: name },
    body
  );
}

for (const item of fixtures.filter((fixture) => !fixture.expectError)) {
  test(item.name, () => proves(item.name, () => {
    const record = item.record ?? {};
    if (!isRecord(item.spec) || !isRecord(record)) throw new Error(`${item.name}: the specification or record of a rendered case is no object`);
    expect(normalizeHtml(withoutPreloadLinks(renderDetail(item.spec, record, item.options)))).toBe(item.expected_html);
  }));
}
for (const item of fixtures) {
  const expected = item.expectError;
  if (!expected) continue;
  test(item.name, () => proves(item.name, () => {
    // Reflect.apply calls renderDetail as a JavaScript caller does, with a specification or record that its type rejects.
    expect(() => { Reflect.apply(renderDetail, undefined, [item.spec, item.record ?? {}, item.options]); }).toThrow(expected.message);
  }));
}
