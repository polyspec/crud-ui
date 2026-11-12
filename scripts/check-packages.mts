import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { createRequire } from 'node:module';
import { installLock, isLockPackages, isPackedManifest, type PackedPackage } from './install-lock.mts';
import { packPackage } from './package-install-pack.mts';
import { createProgress } from '@polyspec/kit/test-progress';
import { readFeatureManifest } from './features-manifest.mts';
import { checkedShape, readShape, shapeDetail, shapeOf } from './json-schema.mts';

/** A JSON object: a package.json, a package lock or a module's object of JSON values, which the checks read by its keys. */
const OBJECT = shapeOf<Record<string, unknown>>({ type: 'object' });
/** The package.json of the repository, whose allowScripts setting the install project keeps. */
const ROOT_MANIFEST = shapeOf<{ allowScripts?: unknown; version: string }>({
  type: 'object', required: ['version'], properties: { version: { type: 'string' } },
});
/** A package.json of a workspace package: its devDependencies, which the svelte versions are read from. */
const DEV_DEPENDENCIES = shapeOf<{ devDependencies?: Record<string, unknown> }>({ type: 'object' });
/** A version of a package.json. */
const VERSION = shapeOf<{ version?: unknown }>({ type: 'object' });
/** The package-lock.json of the repository, whose packages the install lock reads. */
const ROOT_LOCK = shapeOf<{ packages?: unknown }>({ type: 'object' });
/** A version that is a string. */
const STRING = shapeOf<string>({ type: 'string' });
/** A value of an exports map of package.json: a path, or conditions and subpaths that lead to paths. */
const EXPORT_TARGET = shapeOf<ExportTarget>({
  $ref: '#/definitions/target',
  definitions: {
    target: {
      anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: { $ref: '#/definitions/target' } }],
    },
  },
});
/** The error message of a caught value, as text. */
const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));


const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const directory = mkdtempSync(join(tmpdir(), 'crudui-install-'));
const packages = ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react', 'vue', 'svelte', 'form-binding'];
// contracts/features.json records every published npm package; the install project installs all of them.
const published = readFeatureManifest(root).packages.map(({ path }) => relative(join(root, 'packages'), join(root, path)));
const dependencies: Record<string, string> = {};
// The packed packages for the install lock (scripts/install-lock.mts).
const packed: Record<string, PackedPackage> = {};
const { allowScripts, version } = readShape(ROOT_MANIFEST, join(root, 'package.json'));
process.stdout.write(`Install project: ${directory}\n`);

/*
 * Each step reports its start, its result and its elapsed time while the check runs,
 * and each step carries its own limit sized from its measured duration (macOS, warm
 * caches): packing 2.2 s, installing 6.4 s, exports 0.1 s, server rendering 2.5 s,
 * types 2.7 s, production build 1.8 s and the browser check 4.2 s.
 */
/** A value of the `exports` map of a package.json: a path, or conditions and subpaths that lead to paths. */
type ExportTarget = string | { [key: string]: ExportTarget };

/** Whether `value` is a value of an exports map that leads to paths. */
const isExportTarget = (value: unknown): value is ExportTarget => EXPORT_TARGET(value);

/** Whether `value` is the module of vite, in the two functions that the check calls. */
const isVite = (value: unknown): value is typeof import('vite') =>
  OBJECT(value) && typeof value.createServer === 'function' && typeof value.preview === 'function';

/** Whether `value` is a function, which the check calls without arguments. */
const isCallable = (value: unknown): value is () => unknown => typeof value === 'function';

const lines = createProgress({ write: text => process.stdout.write(text) });
async function step<T>(label: string, budget: number, operation: (budget: number) => T | Promise<T>): Promise<T> {
  const id = `${label} (limit ${budget / 1000}s)`;
  lines.start(id);
  commandTimeout = budget;
  try {
    const value = await operation(budget);
    lines.pass(id);
    return value;
  } catch (error) {
    lines.fail(id, undefined, errorMessage(error));
    throw error;
  }
}
// A step's limit is also the limit of each command it runs: an unresponsive command is
// killed and named instead of stopping the whole check without a report.
let commandTimeout = 120000;
// Commands run asynchronously, so the progress lines keep reporting while one runs.
// `input`, when given, is written to the command's standard input.
function run(command: string, args: string[], cwd: string = directory, input?: string): Promise<string> {
  const started = Date.now();
  return new Promise<string>((resolve, reject) => {
    const child = execFile(command, args, { cwd, encoding: 'utf8', timeout: commandTimeout, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) return resolve(stdout);
      if (error.signal === 'SIGKILL') error.message = `${command} ${args.join(' ')} ran ${Date.now() - started} ms and exceeded its ${commandTimeout} ms limit`;
      Object.assign(error, { stdout, stderr });
      reject(error);
    });
    assert.ok(child.stdin);
    child.stdin.end(input);
  });
}
try {
  await step(`pack ${packages.length} packages`, 60000, async () => {
  assert.deepEqual([...packages].sort(), [...published].sort(), 'the install check packs every published package');
  for (const folder of packages) {
    const source = join(root, 'packages', folder);
    const manifest: unknown = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
    assert.ok(isPackedManifest(manifest), `${folder}/package.json has a name, a version and dependency fields of strings: ${shapeDetail(isPackedManifest.errors)}`);
    assert.equal(manifest.version, version, manifest.name);
    const tarball = await packPackage(source, directory, manifest.name, run);
    dependencies[manifest.name] = `file:${tarball}`;
    packed[manifest.name] = { directory: `packages/${folder}`, tarball, manifest };
  }
  });
  for (const name of ['react', 'react-dom', 'vue', 'svelte', 'typescript', '@types/react', '@types/react-dom', '@types/node', 'vite', '@sveltejs/vite-plugin-svelte']) {
    const version = ['vite', '@sveltejs/vite-plugin-svelte'].includes(name)
      ? readShape(DEV_DEPENDENCIES, join(root, 'packages/svelte/package.json')).devDependencies?.[name]
      : readShape(VERSION, require.resolve(`${name}/package.json`)).version;
    dependencies[name] = checkedShape(STRING, version, `the version of ${name}`);
  }
  const project = { name: 'crudui-install-check', version: '0.0.1', private: true, type: 'module', dependencies, allowScripts };
  writeFileSync(join(directory, 'package.json'), JSON.stringify(project, null, 2));
  // The install project installs the releases of the root lock from the npm cache that make install fills, without a registry.
  const lockPackages = readShape(ROOT_LOCK, join(root, 'package-lock.json')).packages;
  assert.ok(lockPackages === undefined || isLockPackages(lockPackages), 'the packages of package-lock.json are lock entries');
  const rootLock = lockPackages === undefined ? {} : { packages: lockPackages };
  writeFileSync(join(directory, 'package-lock.json'), `${JSON.stringify(installLock({ rootLock, manifest: project, packed }), null, 2)}\n`);
  writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', strict: true, noEmit: true,
    esModuleInterop: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  }, include: ['main.ts'] }, null, 2));
  writeFileSync(join(directory, 'main.ts'), `
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, h } from 'vue';
import { mount } from 'svelte';
import { compileForm, createForm, validate } from './api';
import { Form as ReactForm, type AnyWidget as ReactAnyWidget } from '@polyspec/crudui-generator-react';
import { Form as VueForm, type AnyWidget as VueAnyWidget } from '@polyspec/crudui-generator-vue';
import { Form as SvelteForm } from '@polyspec/crudui-generator-svelte';
import { renderForm } from '@polyspec/crudui-generator-html';
import { bindForm } from '@polyspec/crudui-form-binding';
type FrameworkWidgetTypes = [ReactAnyWidget, VueAnyWidget];
const frameworkWidgetTypes: FrameworkWidgetTypes | undefined = undefined;
void frameworkWidgetTypes;
const spec = { type: 'group', properties: { name: { type: 'text', label: 'Name' } } };
const template = compileForm(spec);
const data = { name: 'Packaged form' };
const reactForm = createForm(template, data, { idPrefix: 'react' });
const vueForm = createForm(template, data, { idPrefix: 'vue' });
const svelteForm = createForm(template, data, { idPrefix: 'svelte' });
createRoot(document.getElementById('react')!).render(createElement(ReactForm, { form: reactForm }));
createApp({ render: () => h(VueForm, { form: vueForm }) }).mount('#vue');
mount(SvelteForm, { target: document.getElementById('svelte')!, props: { form: svelteForm } });
validate(spec, data);
// The server-rendered form that the browser validation binding validates before submission.
const bindingSpec = { type: 'group', properties: { email: { type: 'email', label: 'Email', validate: { required: true } } } };
document.getElementById('binding')!.innerHTML = renderForm(
  createForm(compileForm(bindingSpec, { keyPrefix: 'form' }), {}, { idPrefix: 'binding', language: 'en' }),
  { action: { method: 'post', url: '/submit' } },
);
bindForm(document.querySelector<HTMLFormElement>('#binding form')!, bindingSpec, { keyPrefix: 'form' });
`);
  writeFileSync(join(directory, 'api.ts'), `export { compileForm, createForm } from '@polyspec/crudui-generator-core';\nexport { validate } from '@polyspec/crudui-validator';\n`);
  writeFileSync(join(directory, 'index.html'), '<!doctype html><html><head><title>Package verification</title><link rel="icon" href="data:,"></head><body><div id="react"></div><div id="vue"></div><div id="svelte"></div><div id="binding"></div><script type="module" src="/main.ts"></script></body></html>');
  writeFileSync(join(directory, 'vite.config.mjs'), `import { defineConfig } from 'vite';\nimport { svelte } from '@sveltejs/vite-plugin-svelte';\nexport default defineConfig({ plugins: [svelte()] });\n`);
  await step('install the packages of the install project', 120000,
    async () => writeFileSync(join(directory, 'install.log'), await run('npm', ['ci', '--offline'])));
  await step('verify package exports', 10000, () => {
  for (const name of Object.keys(dependencies).filter(name => name.startsWith('@polyspec/crudui-'))) {
    const base = join(directory, 'node_modules', name);
    const manifest = readShape(OBJECT, join(base, 'package.json'));
    assert.ok(isExportTarget(manifest.exports), `${name}: the exports of package.json lead to paths`);
    const check = (value: ExportTarget): void => {
      if (typeof value === 'string') assert.ok(existsSync(resolve(base, value)), `${name}: ${value}`);
      else for (const child of Object.values(value)) check(child);
    };
    check(manifest.exports);
    assert.ok(!Object.hasOwn(manifest, 'bin'), `${name}: a published package must not declare bin`);
  }
  });
  // Server rendering from the installed entries: each framework package renders a form, a list and a detail.
  const rendering = `
const form = core.createForm(core.compileForm({ type: 'group', properties: { name: { type: 'text', label: 'Name' } } }), { name: 'Ada' });
const html = [
  await m.renderForm(form),
  await m.renderList({ columns: { name: { field: '.name', label: 'Name' } } }, [{ name: 'Ada' }], { language: 'en' }),
  await m.renderDetail({ fields: { name: { field: '.name', label: 'Name' } } }, { name: 'Ada' }, { language: 'en' }),
];
if (!html.every(part => part.includes('Ada'))) throw new Error('server rendering lost the data');`;
  const installRequire = createRequire(join(directory, 'package.json'));
  const { preview } = await step('render on the server from the installed entries', 60000, async () => {
  for (const name of ['@polyspec/crudui-generator-react/server', '@polyspec/crudui-generator-vue']) {
    await run('node', ['--input-type=module', '-e', `const core = await import('@polyspec/crudui-generator-core');const m = await import('${name}');${rendering}`]);
    await run('node', ['-e', `(async () => { const core = require('@polyspec/crudui-generator-core');const m = require('${name}');${rendering} })().catch(error => { console.error(error); process.exit(1); });`]);
  }
  writeFileSync(join(directory, 'render.mjs'), `import * as core from '@polyspec/crudui-generator-core';\nimport * as m from '@polyspec/crudui-generator-svelte';\nexport async function render() {${rendering}\n}\n`);
  // The vite of the install project: the release that the root package.json pins.
  const vite: unknown = await import(pathToFileURL(installRequire.resolve('vite')).href);
  assert.ok(isVite(vite), 'the vite of the install project has createServer and preview');
  const renderer = await vite.createServer({ root: directory, logLevel: 'silent', server: { middlewareMode: true } });
  try {
    const { render }: { render?: unknown } = await renderer.ssrLoadModule('/render.mjs');
    assert.ok(isCallable(render), 'render.mjs exports render');
    await render();
  } finally {
    await renderer.close();
  }
  return vite;
  });
  await step('type-check the install project', 60000,
    async () => writeFileSync(join(directory, 'typecheck.log'), await run(join(directory, 'node_modules/.bin/tsc'), ['--noEmit'])));
  await step('build the install project', 60000,
    async () => writeFileSync(join(directory, 'build.log'), await run(join(directory, 'node_modules/.bin/vite'), ['build'])));
  await step('run the three-framework and form binding browser check', 60000, async () => {
  const server = await preview({ root: directory, preview: { host: '127.0.0.1', port: 0, open: false } });
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error instanceof Error ? error.message : String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const url = server.resolvedUrls?.local[0];
    assert.ok(url, 'the preview server must report its local URL');
    await page.goto(url);
    await page.waitForFunction(() => ['react', 'vue', 'svelte'].every(id =>
      document.querySelector<HTMLInputElement>(`#${id} input`)?.value === 'Packaged form'));
    for (const framework of ['react', 'vue', 'svelte']) {
      await page.click(`#${framework} label`);
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'INPUT');
      await page.keyboard.press('End');
      await page.type(`#${framework} input`, '!');
      assert.equal(await page.$eval(`#${framework} input`, element => element.value), 'Packaged form!');
    }
    // The bound form stops an invalid submission: it shows the required error and focuses the control.
    await page.click('#binding button[type="submit"]');
    assert.deepEqual(await page.$$eval('#binding .crudui-node__error', elements => elements.map(element => element.textContent)), ['This field is required.']);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'form[email]');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(directory, 'browser.png'), fullPage: true });
    writeFileSync(join(directory, 'browser.json'), JSON.stringify({ frameworks: ['react', 'vue', 'svelte'], labels: true, typing: true, binding: true, pageErrors: errors }, null, 2));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
  });
  lines.close('package install checks');
  // A passing check removes its install project; a failing check keeps it for inspection.
  rmSync(directory, { recursive: true, force: true });
} catch (error) {
  // A failed step throws an Error; a failed command adds its output to it.
  const output = (name: string) => {
    const value = OBJECT(error) ? error[name] : undefined;
    return typeof value === 'string' ? value : undefined;
  };
  const detail = [errorMessage(error), output('stdout'), output('stderr')].filter(Boolean).join('\n');
  writeFileSync(join(directory, 'failure.log'), detail);
  console.error(detail);
  console.error(`Install project retained: ${directory}`);
  lines.close('package install checks');
  process.exitCode = 1;
}
