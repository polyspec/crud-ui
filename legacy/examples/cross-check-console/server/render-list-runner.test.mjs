/**
 * Gateway RENDER-LIST verdict — conformance over the list parity fan-out.
 *
 * The read sister of render-runner.test.mjs (SPEC §9). `renderAllList(listSpec,
 * rows, options)` is the exact function the live gateway's POST /api/render-list
 * calls: it fans one list-spec + INJECTED rows across the three CRUDUI List SSR
 * entries (React/Svelte sync, Vue async), maps the asymmetric layout option per
 * framework (React `layout`, Vue `layout:card→cards`, Svelte `mode`), strips
 * React 19's SSR `<link rel="preload">` hoists, and reduces the three normalized
 * outputs to one parity verdict via the SAME compareParity the form path uses.
 *
 * Two layers:
 *   (1) pure-comparator units — list-shaped envelopes: three frameworks sharing
 *       one normalized list → parity:true; a TAMPERED (fake-divergent) normalized
 *       → parity:false with that framework isolated; one framework erroring while
 *       the others render a table → parity break; all three sharing one
 *       REF_FILE_NOT_FOUND → parity:true (agreement on a LOAD failure).
 *   (2) real list fan-out over EVERY fixture case in
 *       legacy/tests/fixtures/list-render/cases.json — the SAME file the three
 *       framework conformance suites load. For each non-error case the three
 *       frameworks must agree (parity:true) AND React's normalized output must
 *       equal the fixture's `expected_html` (the fixture is the React reference,
 *       so the gateway bytes equal the conformance reference bytes). Every error
 *       case (an unresolved $ref or invalid list input) must surface its declared
 *       code and message on all three (parity:true, never a silent table).
 *
 * The envelope shape under test is the gateway's own contract (render-runner
 * renderOne output): { fw, ok, html, normalized, ms, error:{code,message}|null }.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareParity, renderAllList } from './render-runner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const LIST_FIXTURE = path.resolve(ROOT, 'legacy/tests/fixtures/list-render/cases.json');

/** A clean ok=true render envelope. */
function rok(fw, normalized) {
  return { fw, ok: true, html: `<raw>${normalized}</raw>`, normalized, ms: 1, error: null };
}

/** A render-error envelope. */
function rerr(fw, code) {
  return { fw, ok: false, html: '', normalized: '', ms: 1, error: { code, message: code } };
}

const TABLE = '<div class="crudui-list"><table class="crudui-list__table"><tbody><tr><td>Ada</td></tr></tbody></table></div>';

describe('compareParity (list envelopes) — agreement', () => {
  test('four renderers share one normalized list → parity:true, no mismatch', () => {
    const results = ['html', 'react', 'svelte', 'vue'].map((fw) => rok(fw, TABLE));
    const { parity, mismatch } = compareParity(results);
    expect(parity).toBe(true);
    expect(mismatch).toBeNull();
  });

  test('all four share one error code → parity:true (agreement on an unresolved $ref)', () => {
    const results = ['html', 'react', 'svelte', 'vue'].map((fw) => rerr(fw, 'REF_FILE_NOT_FOUND'));
    expect(compareParity(results).parity).toBe(true);
  });
});

describe('compareParity (list envelopes) — TAMPER (fake-divergent injection)', () => {
  test('one framework normalized tampered → parity:false, that framework isolated', () => {
    // React/Vue agree on the table; a fake-Svelte normalized is forged to a
    // different row. Parity must break AND name svelte as the lone group.
    const results = [
      rok('react', TABLE),
      rok('svelte', TABLE.replace('Ada', 'TAMPERED')), // <-- TAMPERED
      rok('vue', TABLE),
    ];
    const { parity, mismatch } = compareParity(results);
    expect(parity).toBe(false);
    expect(mismatch).not.toBeNull();
    const svelteGroup = mismatch.groups.find((g) => g.fws.includes('svelte'));
    expect(svelteGroup.fws).toEqual(['svelte']);
    const others = mismatch.groups.find((g) => g.fws.includes('react'));
    expect(others.fws.sort()).toEqual(['react', 'vue']);
  });

  test('one framework errors while the others render a table → parity break', () => {
    const results = [
      rok('react', TABLE),
      rok('svelte', TABLE),
      rerr('vue', 'REF_FILE_NOT_FOUND'), // <-- diverges: error vs render
    ];
    const { parity, mismatch } = compareParity(results);
    expect(parity).toBe(false);
    const vueGroup = mismatch.groups.find((g) => g.fws.includes('vue'));
    expect(vueGroup.fws).toEqual(['vue']);
  });

  test('two frameworks one error code, third a different code → parity break', () => {
    const results = [
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
// Real list fan-out (boots the Vite SSR engine + renders four renderers per case).
// Every fixture case runs — the same cases.json the HTML/React/Vue/Svelte list
// conformance suites load. Slow (one shared engine, reused across cases), so the
// whole describe carries one generous timeout.
// ---------------------------------------------------------------------------
const allCases = JSON.parse(fs.readFileSync(LIST_FIXTURE, 'utf8'));
const okCases = allCases.filter((c) => c.expected_html);
const errorCases = allCases.filter((c) => c.expectError);

describe('renderAllList — real four-renderer list SSR fan-out (every fixture case)', () => {
  for (const c of okCases) {
    test(`${c.name} — HTML/React/Svelte/Vue agree (parity) AND React == fixture expected_html`, async () => {
      const out = await renderAllList(c.spec, c.rows ?? [], c.options ?? {});

      // No framework may fail a non-error case.
      const failed = out.results.filter((r) => !r.ok);
      expect(failed.map((r) => `${r.fw}:${r.error && r.error.code}`)).toEqual([]);

      // The three normalized outputs collapse to one parity key.
      expect(out.parity, JSON.stringify(out.mismatch)).toBe(true);

      // The gateway React bytes equal the conformance reference bytes.
      const react = out.results.find((r) => r.fw === 'react');
      expect(react.normalized).toStrictEqual(c.expected_html);
    }, 120000);
  }

  for (const c of errorCases) {
    test(`${c.name} — surfaces ${c.expectError.code} on all four (parity, never a silent table)`, async () => {
      const out = await renderAllList(c.spec, c.rows ?? [], c.options ?? {});
      // Every framework must FAIL with the SAME code — agreement is parity:true.
      expect(out.results.every((r) => !r.ok)).toBe(true);
      expect(out.results.map((r) => r.error && r.error.code)).toEqual([
        c.expectError.code,
        c.expectError.code,
        c.expectError.code,
        c.expectError.code,
      ]);
      if (c.expectError.message) {
        expect(out.results.map((r) => r.error.message)).toEqual([c.expectError.message, c.expectError.message, c.expectError.message, c.expectError.message]);
      }
      expect(out.parity, JSON.stringify(out.mismatch)).toBe(true);
    }, 120000);
  }
});

// CUDF-023 applies when HTML ignores control characters within the URL scheme.
describe('list JavaScript link URL serialization', () => {
  const fixture = allCases.find(c => c.name === 'format-link-javascript-url');
  for (const [name, href] of [
    ['mixed-case scheme', 'JaVaScRiPt:alert(1)'],
    ['scheme with ignored controls', '\tjava\nscript:alert(1)'],
  ]) {
    test(name, async () => {
      const spec = structuredClone(fixture.spec);
      spec.columns.name.format.href = href;
      const out = await renderAllList(spec, fixture.rows, fixture.options);
      expect(out.results.every(result => result.ok)).toBe(true);
      expect(out.parity, JSON.stringify(out.mismatch)).toBe(true);
      expect(out.results.map(result => result.normalized)).toEqual(Array(4).fill(fixture.expected_html));
    }, 120000);
  }
});
