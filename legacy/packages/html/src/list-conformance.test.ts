import { expect, test } from 'vitest';
import { renderList } from './index';
// @ts-expect-error shared JavaScript fixture normalizer
import { normalizeHtml } from '../../../tests/fixtures/form-render/normalize.mts';
// @ts-expect-error shared JavaScript preload link helper
import { withoutPreloadLinks } from '../../../tests/fixtures/preload-links.mts';
import cases from '../../../tests/fixtures/list-render/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

interface ListFixture {
  name: string;
  /** An object, or another JSON value in a case that a JavaScript caller's specification fails. */
  spec: unknown;
  /** An array of objects, or another JSON value in a case that a JavaScript caller's rows fail. */
  rows?: unknown;
  options?: Record<string, unknown>;
  expected_html?: string;
  expectError?: { code: string; message?: string };
}

/** Run one fixture case and record renderList evidence for the HTML renderer. */
function proves(name: string, body: () => void): Promise<void> {
  return provesConformance(
    { features: ['renderList'], fixture: 'legacy/tests/fixtures/list-render/cases.json', runtime: 'javascript-html', case: name },
    body
  );
}

const fixtures: ListFixture[] = cases;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

for (const item of fixtures) {
  if (item.expectError) continue;
  test(item.name, () => proves(item.name, () => {
    const rows = item.rows ?? [];
    if (!isRecord(item.spec) || !Array.isArray(rows) || !rows.every(isRecord)) {
      throw new Error(`${item.name}: the specification or rows of a rendered case are no object`);
    }
    expect(normalizeHtml(withoutPreloadLinks(renderList(item.spec, rows, item.options)))).toBe(item.expected_html);
  }));
}
for (const item of fixtures) {
  const expected = item.expectError;
  if (!expected) continue;
  test(item.name, () => proves(item.name, () => {
    let thrown: unknown;
    try {
      // Reflect.apply calls renderList as a JavaScript caller does, with a specification or rows that its type rejects.
      Reflect.apply(renderList, undefined, [item.spec, item.rows ?? [], item.options]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown, `${item.name} must throw`).toBeInstanceOf(Error);
    expect(thrown).toHaveProperty('code', expected.code);
    if (expected.message) expect(thrown).toHaveProperty('message', expect.stringContaining(expected.message));
  }));
}
