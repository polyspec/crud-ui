import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeHtml } from '../../../tests/fixtures/form-render/normalize.mts';
import { equalModels, equalOrdered } from '../../../tests/native-generators/protocol.mts';
import { runRustCommand } from '../../../scripts/run-rust-command.mts';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(packageRoot, '../../..');
const temporary = await mkdtemp(join(tmpdir(), 'polyspec-crudui-generator-rust-'));
const output = join(temporary, 'fixtures.json');
let server;
try {
  await runRustCommand([
    'test', '--locked', '--manifest-path', join(packageRoot, 'Cargo.toml'),
    'native_fixture_records',
  ], {
    cwd: repositoryRoot,
    environment: {
      ...globalThis.process.env,
      CRUDUI_GENERATOR_FIXTURE_OUTPUT: output,
    },
  });
  const native = JSON.parse(await readFile(output, 'utf8'));
  const forms = JSON.parse(await readFile(join(repositoryRoot, 'tests/fixtures/form-render/cases.json'), 'utf8'));
  const lists = JSON.parse(await readFile(join(repositoryRoot, 'tests/fixtures/list-render/cases.json'), 'utf8'));
  server = await createServer({
    root: repositoryRoot, configFile: false, logLevel: 'error', server: { middlewareMode: true },
    resolve: {
      alias: {
        // The internal entry precedes the main entry, whose alias also matches its subpaths.
        '@polyspec/crudui-validator/internal': join(repositoryRoot, 'legacy/packages/validator/ts/src/internal.ts'),
        '@polyspec/crudui-validator': join(repositoryRoot, 'legacy/packages/validator/ts/src/index.ts'),
      },
    },
  });
  const { compileForm, bindForm, bindButtons, formMessages, buildList } = await server.ssrLoadModule(join(repositoryRoot, 'legacy/packages/generator/ts/src/index.ts'));
  const { FormFields } = await server.ssrLoadModule(join(repositoryRoot, 'packages/react/src/components/FormFields.tsx'));
  const { List } = await server.ssrLoadModule(join(repositoryRoot, 'packages/react/src/components/List.tsx'));
  const serializable = value => JSON.parse(JSON.stringify(value));
  const failures = [];
  const check = (name, actual, expected, compare = assert.deepEqual) => {
    try { compare(actual, expected, name); }
    catch (error) { failures.push({ name, message: error.message }); }
  };
  assert.equal(native.forms.length, forms.length);
  assert.equal(native.lists.length, lists.length);
  for (let i = 0; i < forms.length; i++) {
    const fixture = forms[i], result = native.forms[i];
    assert.equal(result.name, fixture.name);
    if (fixture.expectError) { check(`${fixture.name}: error`, result.error?.code, fixture.expectError.code); continue; }
    const template = compileForm(fixture.spec, fixture.options);
    const fields = bindForm(template, fixture.data, fixture.options);
    check(`${fixture.name}: template`, result.template, serializable(template), equalOrdered);
    check(`${fixture.name}: fields`, result.fields, serializable(fields), equalModels);
    const buttons = bindButtons(template, fixture.data, fixture.options);
    const messages = formMessages(fixture.options?.language ?? 'ko');
    check(`${fixture.name}: exact HTML`, result.html, renderToStaticMarkup(createElement(FormFields, { fields, buttons, messages })));
    check(`${fixture.name}: layout`, normalizeHtml(result.html), fixture.expected_html);
  }
  for (let i = 0; i < lists.length; i++) {
    const fixture = lists[i], result = native.lists[i];
    assert.equal(result.name, fixture.name);
    if (fixture.expectError) { check(`${fixture.name}: error`, result.error?.code, fixture.expectError.code); continue; }
    const vm = buildList(fixture.spec, fixture.rows, fixture.options);
    check(`${fixture.name}: model`, result.model, serializable(vm), equalModels);
    check(`${fixture.name}: exact HTML`, result.html, renderToStaticMarkup(createElement(List, { vm, layout: fixture.options?.layout })));
  }
  for (const failure of failures) console.error(failure.message);
  if (failures.length) throw new Error(`${failures.length} Rust fixture comparisons failed`);
  process.stdout.write(`Rust fixtures passed: ${forms.length} forms, ${lists.length} lists; complete templates, models and original HTML, plus normalized form layouts.\n`);
} finally {
  await server?.close();
  await rm(temporary, { recursive: true, force: true });
}
