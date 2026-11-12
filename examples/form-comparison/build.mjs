import { createRequire } from 'node:module';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { formFrameworks, formRenderingPaths } from './src/runtime-paths.mjs';
import { readFrameDocument } from './src/frame-document.mjs';
import { specFor } from './src/scenario.mjs';

const exampleDirectory = path.dirname(fileURLToPath(import.meta.url));
if (process.argv.length !== 3 || !path.isAbsolute(process.argv[2])) {
  throw new Error('Usage: node build.mjs /absolute/public-directory');
}
const publicDirectory = process.argv[2];
// The repository that contains this script.
const source = path.resolve(exampleDirectory, '../..');
const require = createRequire(path.join(source, 'packages/svelte/package.json'));
const { build, defaultClientConditions } = await import(pathToFileURL(require.resolve('vite')));
const { parse } = await import(pathToFileURL(require.resolve('parse5')));
const { svelte } = await import(pathToFileURL(require.resolve('@sveltejs/vite-plugin-svelte')));
await mkdir(publicDirectory, { recursive: true });
// The build volume is persistent; remove the retired public route and the modules that the benchmark console loaded
// unbundled from an older build.
await rm(path.join(publicDirectory, 'displays'), { recursive: true, force: true });
for (const retired of ['browser-job.mjs', 'frame-readiness.mjs', 'storage-lock.mjs', 'frame-pointer.mjs',
  'runtime-paths.mjs', 'form-snapshot.mjs']) {
  await rm(path.join(publicDirectory, retired), { force: true });
}
// public/ is served as it is, with the page selection rules (record-view.mjs) that the page script imports.
await cp(path.join(exampleDirectory, 'public'), publicDirectory, { recursive: true });
await cp(path.join(exampleDirectory, 'benchmark'), path.join(publicDirectory, 'benchmark'), { recursive: true });
// The browser matrix, read by the Go and Rust servers.
await cp(path.join(exampleDirectory, 'src/runtime-paths.json'),
  path.join(publicDirectory, 'runtime-paths.json'));
// Frames and SSR documents style the form with crudui.css alone, so computed CSS is compared with the real styles.
await cp(path.join(source, 'legacy/packages/generator/ts/styles/crudui.css'),
  path.join(publicDirectory, 'crudui.css'));
await cp(path.join(exampleDirectory, 'fixtures/records.json'),
  path.join(publicDirectory, 'records.json'));
// The record resource of the canonical page, published unchanged; every record server reads it here.
await cp(path.join(exampleDirectory, 'fixtures/customer-records.json'),
  path.join(publicDirectory, 'customer-records.json'));
await cp(path.join(exampleDirectory, 'fixtures/customer-specs.json'),
  path.join(publicDirectory, 'customer-specs.json'));
const spec = specFor();
await writeFile(path.join(publicDirectory, 'spec.json'), JSON.stringify(spec, null, 2) + '\n');

// The frames and the page stages render with the packages of this source tree: their components through the subpath
// imports (#html, #react/*, #vue/*, #svelte/*) of the root package.json, and these packages through these aliases.
const packageAliases = {
  // Each internal entry precedes its main entry, whose alias also matches its subpaths.
  '@polyspec/crudui-generator-core/internal': path.join(source, 'legacy/packages/generator/ts/src/internal.ts'),
  '@polyspec/crudui-generator-core': path.join(source, 'legacy/packages/generator/ts/src/index.ts'),
  '@polyspec/crudui-validator/internal': path.join(source, 'legacy/packages/validator/ts/src/internal.ts'),
  '@polyspec/crudui-validator': path.join(source, 'legacy/packages/validator/ts/src/index.ts'),
};
// The subpath imports #adapter and #stage of the root package.json map one module per condition; each build adds its
// own condition to the default conditions of Vite.
const conditions = condition => [...defaultClientConditions, `form-comparison-${condition}`];

for (const renderingPath of formRenderingPaths) {
  for (const framework of formFrameworks) {
    await build({
      configFile: false,
      root: path.join(exampleDirectory, 'viewer'),
      base: '/frames/' + renderingPath + '-' + framework + '/',
      publicDir: false,
      plugins: framework === 'svelte' ? [svelte({ configFile: false })] : [],
      resolve: {
        dedupe: ['react', 'react-dom', 'vue', 'svelte'],
        conditions: conditions(`${renderingPath}-${framework}`),
        alias: packageAliases,
      },
      define: {
        __FORM_PATH__: JSON.stringify(renderingPath),
        __FRAMEWORK__: JSON.stringify(framework),
      },
      build: {
        target: 'esnext',
        outDir: path.join(publicDirectory, 'frames', renderingPath + '-' + framework),
        emptyOutDir: true,
        sourcemap: true,
      },
    });
    // The servers render into this document, so the build must satisfy the frame contract.
    const document = path.join(publicDirectory, 'frames', renderingPath + '-' + framework, 'index.html');
    readFrameDocument(parse, await readFile(document, 'utf8'), 'csr');
  }
}

// The canonical page loads the stage of the selected client from /pages/{client}/stage.js.
for (const framework of formFrameworks) {
  await build({
    configFile: false,
    root: exampleDirectory,
    publicDir: false,
    plugins: framework === 'svelte' ? [svelte({ configFile: false })] : [],
    resolve: {
      dedupe: ['react', 'react-dom', 'vue', 'svelte'],
      conditions: conditions(`stage-${framework}`),
      alias: packageAliases,
    },
    // A library build keeps the entry's exports and leaves the mode to the build that bundles it; the page is such a build.
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      target: 'esnext',
      outDir: path.join(publicDirectory, 'pages', framework),
      emptyOutDir: true,
      sourcemap: true,
      lib: { entry: path.join(exampleDirectory, 'src/pages/stage.mjs'), formats: ['es'], fileName: () => 'stage.js' },
    },
  });
}

// The benchmark console bundles the modules it imports from this source tree, the snapshot module of the form inspector
// among them.
await build({
  configFile: false,
  root: path.join(exampleDirectory, 'benchmark-console'),
  base: '/benchmark-console/',
  publicDir: false,
  build: {
    target: 'esnext',
    outDir: path.join(publicDirectory, 'benchmark-console'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
