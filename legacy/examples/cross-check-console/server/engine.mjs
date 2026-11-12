/**
 * Load the HTML, React, Vue and Svelte render entries in one Vite SSR environment.
 * The Svelte workspace supplies Vite and its matching compiler plugin.
 * Validation runs separately through the four validator processes.
 */

import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
let enginePromise = null;

/**
 * Boot the Vite SSR environment and load every CRUDUI render entry once. Idempotent:
 * the first call boots, later calls return the same resolved engine.
 *
 * @returns {Promise<{
 *   renderHtml: Function,
 *   renderReact: Function,
 *   renderSvelte: Function,
 *   renderVue: Function,
 *   renderListHtml: Function,
 *   renderListReact: Function,
 *   renderListSvelte: Function,
 *   renderListVue: Function,
 *   renderDetailHtml: Function,
 *   renderDetailReact: Function,
 *   renderDetailSvelte: Function,
 *   renderDetailVue: Function,
 *   normalizeHtml: Function,
 *   errorClasses: { react: object, svelte: object, vue: object },
 *   close: Function,
 * }>}
 */
export function getEngine() {
  if (!enginePromise) {
    enginePromise = bootEngine();
  }
  return enginePromise;
}

/**
 * The options of the Vite server of the engine. It only loads modules for server rendering (ssrLoadModule), so it has
 * no browser entry and discovers no browser dependency (C14.46): with discovery on, the cold start crawled every HTML
 * file under the repository root, the generated API pages of docs/public included, for over a minute, failed on them,
 * and did so once for each test file that booted an engine.
 *
 * @returns {Promise<import('vite').InlineConfig>}
 */
export async function engineServerOptions() {
  const { svelte } = await import('@sveltejs/vite-plugin-svelte');
  return {
    root: ROOT,
    configFile: false,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    plugins: [svelte()],
  };
}

async function bootEngine() {
  // React's SSR dev build prints `Invalid DOM property \`class\`...` warnings to
  // stderr (the CRUDUI React adapter emits raw HTML attribute names by design — its
  // output is byte-matched to the fixture, not idiomatic JSX). Silence only that
  // one console.error line so the gateway log stays readable.
  const origError = console.error;
  console.error = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes('Invalid DOM property')) return;
    origError.apply(console, args);
  };

  const { createServer } = await import('vite');
  const vite = await createServer(await engineServerOptions());

  // The renderers import generator-core from its installed entry; loading that entry through the
  // same server gives the public API and the error classes the renderers throw.
  const [core, htmlMod, reactServer, svelteMod, vueMod, vueListMod, normMod] = await Promise.all([
    vite.ssrLoadModule(realpathSync(fileURLToPath(import.meta.resolve('@polyspec/crudui-generator-core')))),
    vite.ssrLoadModule(path.resolve(ROOT, 'legacy/packages/html/src/index.ts')),
    vite.ssrLoadModule(path.resolve(ROOT, 'packages/react/src/server.ts')),
    vite.ssrLoadModule(path.resolve(ROOT, 'packages/svelte/src/index.ts')),
    vite.ssrLoadModule(path.resolve(ROOT, 'packages/vue/src/index.ts')),
    vite.ssrLoadModule(path.resolve(ROOT, 'packages/vue/src/listSsr.ts')),
    vite.ssrLoadModule(path.resolve(ROOT, 'legacy/tests/fixtures/form-render/normalize.mts')),
  ]);

  const coreErrors = { ComposeLoadError: core.ComposeLoadError, UnsupportedFieldTypeError: core.UnsupportedFieldTypeError };
  return {
    renderHtml: htmlMod.renderForm,
    compileForm: core.compileForm,
    createForm: core.createForm,
    renderReact: reactServer.renderForm,
    renderSvelte: svelteMod.renderForm,
    renderVue: vueMod.renderForm,
    // React and Svelte export list rendering from their package entries.
    // Vue exports list rendering from its list SSR entry.
    renderListReact: reactServer.renderList,
    renderListSvelte: svelteMod.renderList,
    renderListVue: vueListMod.renderList,
    renderListHtml: htmlMod.renderList,
    // All three package entries export detail rendering (Vue re-exports detailSsr).
    renderDetailReact: reactServer.renderDetail,
    renderDetailSvelte: svelteMod.renderDetail,
    renderDetailVue: vueMod.renderDetail,
    renderDetailHtml: htmlMod.renderDetail,
    normalizeHtml: normMod.normalizeHtml,
    // Error classes for surfacing render failures with a stable `code` (the same
    // ERROR_CLASS_BY_CODE keys the conformance tests use).
    errorClasses: {
      html: {},
      react: coreErrors,
      svelte: coreErrors,
      vue: coreErrors,
    },
    close: () => vite.close(),
  };
}
