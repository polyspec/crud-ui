/**
 * Gateway RENDER verdict — conformance over the parity comparator.
 *
 * compareParity(results) turns three per-framework render envelopes into the
 * cross-check verdict { parity, mismatch }. This is the exact function the live
 * gateway calls; here it is exercised in isolation so a regression in the parity
 * logic is caught without booting the Vite SSR engine.
 *
 * Two layers:
 *   (1) pure-comparator units — same normalized → parity:true; a tampered
 *       (fake-divergent) normalized → parity:false with that framework isolated;
 *       a framework that errors while others render → parity break; all three
 *       sharing one error code → parity:true.
 *   (2) one real fan-out smoke — actually boot the engine and renderAll a shared
 *       form-render fixture across React/Svelte/Vue and assert real parity.
 *
 * The envelope shape under test is the gateway's own contract (render-runner
 * renderOne output): { fw, ok, html, normalized, ms, error:{code,message}|null }.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareParity, renderAll } from './render-runner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const RENDER_FIXTURE = path.resolve(ROOT, 'legacy/tests/fixtures/form-render/cases.json');

/** A clean ok=true render envelope. */
function rok(fw, normalized) {
  return { fw, ok: true, html: `<raw>${normalized}</raw>`, normalized, ms: 1, error: null };
}

/** A render-error envelope. */
function rerr(fw, code) {
  return { fw, ok: false, html: '', normalized: '', ms: 1, error: { code, message: code } };
}

describe('compareParity — agreement', () => {
  test('four renderers share one normalized → parity:true, no mismatch', () => {
    const results = ['html', 'react', 'svelte', 'vue'].map((fw) => rok(fw, '<div>same</div>'));
    const { parity, mismatch } = compareParity(results);
    expect(parity).toBe(true);
    expect(mismatch).toBeNull();
  });

  test('all four share one error code → parity:true (agreement on a LOAD failure)', () => {
    const results = ['html', 'react', 'svelte', 'vue'].map((fw) => rerr(fw, 'REF_FILE_NOT_FOUND'));
    expect(compareParity(results).parity).toBe(true);
  });
});

describe('compareParity — TAMPER (fake-divergent injection)', () => {
  test('one framework normalized tampered → parity:false, that framework isolated', () => {
    // React/Vue agree on the normalized HTML; a fake-Svelte normalized is forged
    // to a different string. Parity must break AND name svelte as the lone group.
    const results = [
      rok('html', '<div>same</div>'),
      rok('react', '<div>same</div>'),
      rok('svelte', '<div>TAMPERED</div>'), // <-- TAMPERED
      rok('vue', '<div>same</div>'),
    ];
    const { parity, mismatch } = compareParity(results);
    expect(parity).toBe(false);
    expect(mismatch).not.toBeNull();
    const svelteGroup = mismatch.groups.find((g) => g.fws.includes('svelte'));
    expect(svelteGroup.fws).toEqual(['svelte']);
    const others = mismatch.groups.find((g) => g.fws.includes('react'));
    expect(others.fws.sort()).toEqual(['html', 'react', 'vue']);
  });

  test('one framework errors while others render → parity break', () => {
    const results = [
      rok('html', '<div>x</div>'),
      rok('react', '<div>x</div>'),
      rok('svelte', '<div>x</div>'),
      rerr('vue', 'UNSUPPORTED_FIELD_TYPE'), // <-- diverges: error vs render
    ];
    const { parity, mismatch } = compareParity(results);
    expect(parity).toBe(false);
    const vueGroup = mismatch.groups.find((g) => g.fws.includes('vue'));
    expect(vueGroup.fws).toEqual(['vue']);
  });

  test('two frameworks one error code, third a different error code → parity break', () => {
    const results = [
      rerr('html', 'REF_FILE_NOT_FOUND'),
      rerr('react', 'REF_FILE_NOT_FOUND'),
      rerr('svelte', 'REF_FILE_NOT_FOUND'),
      rerr('vue', 'RENDER_ERROR'), // <-- diverging error code
    ];
    const { parity, mismatch } = compareParity(results);
    expect(parity).toBe(false);
    const vueGroup = mismatch.groups.find((g) => g.fws.includes('vue'));
    expect(vueGroup.fws).toEqual(['vue']);
  });
});

// ---------------------------------------------------------------------------
// Real fan-out over every form-render fixture. The public-instance path generates
// a random row key when a repeated field has no supplied data; that one fixture
// therefore proves four-renderer parity but cannot be compared to its bindForm
// fixture bytes. All other successful cases also compare React to expected_html.
// ---------------------------------------------------------------------------
const allCasesObj = JSON.parse(fs.readFileSync(RENDER_FIXTURE, 'utf8'));
const allCases = Object.values(allCasesObj);
const randomKeyCase = 'multiple-leaf-empty-placeholder';

describe('renderAll — real four-renderer SSR fan-out (every fixture case)', () => {
  for (const c of allCases) {
    test(`${c.name} — HTML/React/Svelte/Vue agree`, async () => {
      const out = await renderAll({ spec: c.spec, data: c.data, options: c.options });
      expect(out.parity, JSON.stringify(out.mismatch)).toBe(true);
      if (c.expectError) {
        expect(out.results.every((r) => !r.ok && r.error?.code === c.expectError.code)).toBe(true);
        return;
      }
      expect(out.results.every((r) => r.ok)).toBe(true);
      if (c.name !== randomKeyCase) {
        expect(out.results.find((r) => r.fw === 'react').normalized).toStrictEqual(c.expected_html);
      } else {
        const html = out.results.find((r) => r.fw === 'react').normalized;
        expect(html).toMatch(/data-crudui-row-key="__[a-f0-9]{13}__"/);
      }
    }, 120000);
  }
});


test('SSR renderers receive identical generated row identities', async () => {
  const spec = { type: 'group', properties: { companies: {
    type: 'group', multiple: true, properties: { name: { type: 'text' } },
  } } };
  const result = await renderAll({ spec, data: {} });
  const identities = result.results.map(rendered => {
    expect(rendered.ok, rendered.error?.message).toBe(true);
    const keys = [...rendered.html.matchAll(/data-crudui-row-key="([^"]+)"/g)].map(match => match[1]);
    expect(keys.length).toBeGreaterThan(0);
    return keys;
  });
  expect(identities[1]).toEqual(identities[0]);
  expect(identities[2]).toEqual(identities[0]);
  expect(identities[3]).toEqual(identities[0]);
  expect(result.parity).toBe(true);
}, 30000);
