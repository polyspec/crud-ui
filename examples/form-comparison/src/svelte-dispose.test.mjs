// The frame awaits `driver.dispose()` before it clears the views and mounts the next form
// (frame.mjs mount()). Svelte 5 `unmount()` returns a Promise that settles when the component is
// removed, so a Svelte adapter's dispose() settles only after every unmount Promise has settled.
// Vite with the Svelte plugin loads each adapter the way build.mjs compiles it; a stand-in for the
// `svelte` module records the mounted components and holds each unmount Promise open.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exampleDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(exampleDirectory, '../..');
const require = createRequire(path.join(source, 'packages/svelte/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { svelte } = await import(pathToFileURL(require.resolve('@sveltejs/vite-plugin-svelte')));

const stubSvelte = '\0svelte-stub';
const stubComponent = '\0svelte-component-stub';
const stubs = {
  name: 'svelte-dispose-stubs',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'svelte') return stubSvelte;
    if (id.startsWith('#svelte/')) return stubComponent;
    return null;
  },
  load(id) {
    if (id === stubSvelte) {
      return 'const record = () => globalThis.svelteDisposeRecord;\n'
        + 'export const flushSync = fn => fn?.();\n'
        + 'export const mount = component => { const app = {}; record().mounted.push(app); return app; };\n'
        + 'export const unmount = app => new Promise(resolve => record().unmounting.set(app, resolve));\n';
    }
    if (id === stubComponent) return 'export default function Component() {}\n';
    return null;
  },
};

const server = await createServer({
  configFile: false,
  root: exampleDirectory,
  logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [stubs, svelte({ configFile: false })],
  resolve: {
    alias: {
      '@polyspec/crudui-generator-core/internal': path.join(source, 'legacy/packages/generator/ts/src/internal.ts'),
      '@polyspec/crudui-generator-core': path.join(source, 'legacy/packages/generator/ts/src/index.ts'),
      '@polyspec/crudui-validator/internal': path.join(source, 'legacy/packages/validator/ts/src/internal.ts'),
      '@polyspec/crudui-validator': path.join(source, 'legacy/packages/validator/ts/src/index.ts'),
    },
  },
});
test.after(() => server.close());

const template = { type: 'group', properties: {} };
const views = () => Object.fromEntries(['form', 'outline', 'data'].map(name => [name, { replaceChildren() {} }]));

for (const adapter of ['create-form-svelte.svelte.ts', 'bind-form-svelte.svelte.ts']) {
  test(`${adapter} dispose settles after every unmount Promise`, async () => {
    const record = { mounted: [], unmounting: new Map() };
    globalThis.svelteDisposeRecord = record;
    const { compileForm } = await server.ssrLoadModule('@polyspec/crudui-generator-core');
    const { mountView } = await server.ssrLoadModule(path.join(exampleDirectory, 'src/adapters', adapter));
    const driver = mountView(views(), compileForm(template), 'en', {});
    assert.equal(record.mounted.length, 3);
    let settled = false;
    const disposing = Promise.resolve(driver.dispose()).then(() => { settled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...record.unmounting.keys()], record.mounted, 'dispose unmounts every component');
    assert.equal(settled, false, 'dispose must not settle while an unmount Promise is pending');
    for (const resolve of record.unmounting.values()) resolve();
    await disposing;
    assert.equal(settled, true);
  });
}
