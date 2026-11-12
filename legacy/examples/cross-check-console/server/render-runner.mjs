/**
 * Compile and render one request in HTML, React, Svelte and Vue, then compare HTML
 * using the shared fixture normalizer. Each result records output or its error.
 */

import { getEngine } from './engine.mjs';
// Preload links are removed by the helper the framework conformance checks use, so both compare the same body.
import { withoutPreloadLinks } from '../../../tests/fixtures/preload-links.mts';

/**
 * Render one request across HTML / React / Svelte / Vue in parallel.
 *
 * @param {object} req { spec, data, options }
 * @returns {Promise<{results: object[], parity: boolean, mismatch: object|null}>}
 */
export async function renderAll(req) {
  const engine = await getEngine();
  const spec = req.spec;
  const options = req.options ?? {};
  const form = Promise.resolve().then(() => engine.createForm(engine.compileForm(spec, options), req.data ?? {}, options));

  const [html, react, svelte, vue] = await Promise.all([
    renderOne(engine, 'html', async () => withoutPreloadLinks(engine.renderHtml(await form))),
    renderOne(engine, 'react', async () => engine.renderReact(await form)),
    renderOne(engine, 'svelte', async () => engine.renderSvelte(await form)),
    renderOne(engine, 'vue', async () => engine.renderVue(await form)),
  ]);

  const results = [html, react, svelte, vue];
  const { parity, mismatch } = compareParity(results, engine.normalizeHtml);
  return { results, parity, mismatch };
}

/**
 * Render supplied list rows in HTML, React, Svelte and Vue with the same layout options.
 *
 * @param {object} listSpec the list-spec (columns map; $ref/$patch composable)
 * @param {Array<object>} rows injected display rows
 * @param {object} options { language, data, page, total, files, basepath, layout }
 * @returns {Promise<{results: object[], parity: boolean, mismatch: object|null}>}
 */
export async function renderAllList(listSpec, rows = [], options = {}) {
  const engine = await getEngine();
  // Rows pass unchanged: invalid rows fail in each renderer with the shared input error.
  const [html, react, svelte, vue] = await Promise.all([
    renderOne(engine, 'html', () => withoutPreloadLinks(engine.renderListHtml(listSpec, rows, options))),
    renderOne(engine, 'react', () =>
      withoutPreloadLinks(engine.renderListReact(listSpec, rows, options))
    ),
    renderOne(engine, 'svelte', () =>
      engine.renderListSvelte(listSpec, rows, options)
    ),
    renderOne(engine, 'vue', () =>
      engine.renderListVue(listSpec, rows, options)
    ),
  ]);

  const results = [html, react, svelte, vue];
  const { parity, mismatch } = compareParity(results, engine.normalizeHtml);
  return { results, parity, mismatch };
}

/**
 * Render one record through a detail specification in HTML, React, Svelte and Vue.
 *
 * @param {object} detailSpec the detail specification (fields map; $ref/$patch composable)
 * @param {object} record the injected record
 * @param {object} options { language, data, files, basepath }
 * @returns {Promise<{results: object[], parity: boolean, mismatch: object|null}>}
 */
export async function renderAllDetail(detailSpec, record = {}, options = {}) {
  const engine = await getEngine();
  // The record passes unchanged: an invalid record fails in each renderer with the shared input error.
  const [html, react, svelte, vue] = await Promise.all([
    renderOne(engine, 'html', () => withoutPreloadLinks(engine.renderDetailHtml(detailSpec, record, options))),
    renderOne(engine, 'react', () =>
      withoutPreloadLinks(engine.renderDetailReact(detailSpec, record, options))
    ),
    renderOne(engine, 'svelte', () =>
      engine.renderDetailSvelte(detailSpec, record, options)
    ),
    renderOne(engine, 'vue', () =>
      engine.renderDetailVue(detailSpec, record, options)
    ),
  ]);

  const results = [html, react, svelte, vue];
  const { parity, mismatch } = compareParity(results, engine.normalizeHtml);
  return { results, parity, mismatch };
}

/**
 * Run one framework's render fn (sync or async), normalize, and classify any
 * thrown error to a stable code via the framework's error classes.
 */
async function renderOne(engine, fw, fn) {
  const t0 = performance.now();
  try {
    const html = await fn();
    return {
      fw,
      ok: true,
      html,
      normalized: engine.normalizeHtml(html),
      ms: Math.round(performance.now() - t0),
      error: null,
    };
  } catch (e) {
    return {
      fw,
      ok: false,
      html: '',
      normalized: '',
      ms: Math.round(performance.now() - t0),
      error: classifyError(engine, fw, e),
    };
  }
}

/**
 * Map a thrown render error to { code, message }. ComposeLoadError carries its
 * own .code; UnsupportedFieldTypeError carries UNSUPPORTED_FIELD_TYPE. Anything
 * else surfaces as a generic RENDER_ERROR (never swallowed).
 */
function classifyError(engine, fw, e) {
  const classes = engine.errorClasses[fw] || {};
  if (e && classes.ComposeLoadError && e instanceof classes.ComposeLoadError) {
    return { code: e.code, message: e.message };
  }
  if (
    e &&
    classes.UnsupportedFieldTypeError &&
    e instanceof classes.UnsupportedFieldTypeError
  ) {
    return { code: e.code || 'UNSUPPORTED_FIELD_TYPE', message: e.message };
  }
  // Fall back to a declared `.code` if present (cross-realm instanceof can miss).
  if (e && typeof e.code === 'string') {
    return { code: e.code, message: e.message || String(e) };
  }
  return { code: 'RENDER_ERROR', message: String(e && e.message ? e.message : e) };
}

/**
 * Parity holds iff every framework that rendered (ok) shares one normalized
 * string, AND every framework that errored shares one error code. A framework
 * that fails when others succeed is a parity break.
 */
export function compareParity(results) {
  const sigs = results.map((r) => ({
    fw: r.fw,
    sig: r.ok ? `html:${r.normalized}` : `error:${r.error ? r.error.code : 'RENDER_ERROR'}`,
  }));
  const distinct = new Set(sigs.map((s) => s.sig));
  if (distinct.size <= 1) {
    return { parity: true, mismatch: null };
  }
  const groups = {};
  for (const s of sigs) {
    (groups[s.sig] ??= []).push(s.fw);
  }
  return {
    parity: false,
    mismatch: {
      groups: Object.entries(groups).map(([sig, fws]) => ({ fws, signature: sig })),
      detail: results.map((r) => ({
        fw: r.fw,
        ok: r.ok,
        normalized: r.normalized,
        error: r.error,
      })),
    },
  };
}
