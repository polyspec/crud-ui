/**
 * Verify Svelte's server rendering against the shared detail fixture.
 *
 * tests/fixtures/detail-render/cases.json holds one `expected_html` per detail scenario, generated
 * from the React reference and normalized with the shared normalizer. Svelte must reproduce it
 * after the same normalization. Do not weaken this test or edit the fixture by hand; fix the
 * renderer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { withoutPreloadLinks } from '../../../legacy/tests/fixtures/preload-links.mts';
import { renderDetail } from '../src/index.ts';
import { provesConformance } from '../../../tests/conformance/evidence.mts';

/** Run one fixture case and record renderDetail evidence for it. */
function proves(name, body) {
  return provesConformance(
    { features: ['renderDetail'], fixture: 'legacy/tests/fixtures/detail-render/cases.json', runtime: 'svelte', case: name },
    body
  );
}

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.resolve(here, '../../../legacy/tests/fixtures/detail-render/cases.json'), 'utf8'));

describe('detail render — Svelte reproduces the normalized expected_html', () => {
  for (const item of fixtures.filter((fixture) => !fixture.expectError)) {
    test(item.name, () => proves(item.name, () => {
      expect(normalizeHtml(withoutPreloadLinks(renderDetail(item.spec, item.record ?? {}, item.options)))).toBe(item.expected_html);
    }));
  }
});

describe('detail render — Svelte rejects invalid input with the shared message', () => {
  for (const item of fixtures.filter((fixture) => fixture.expectError)) {
    test(item.name, () => proves(item.name, () => {
      expect(() => renderDetail(item.spec, item.record ?? {}, item.options)).toThrow(item.expectError.message);
    }));
  }
});
