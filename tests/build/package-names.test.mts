// The package names of the polyspec repositories (docs/operations/package-build.md, "Package names"): npm packages are
// `@polyspec/crudui-<name>`, Composer packages `polyspec/crudui-<name>` with PHP namespaces under `Polyspec\Crudui\`,
// Rust crates `polyspec-crudui-<name>` with the library `polyspec_crudui_<name>`, and Go modules
// `github.com/polyspec/crudui/<path>`. No maintained file names a package by another form; the changelog, the
// checklist and the wave descriptions keep the names that their entries recorded.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { isVendored } from '../../scripts/repository-files.mts';
import { parseJson, type JTDSchemaType } from '../json.mts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');
/** The name and the npm workspaces of a package.json or composer.json. */
interface Named { name?: string; workspaces?: string[] }
const namedSchema: JTDSchemaType<Named> = {
  optionalProperties: { name: { type: 'string' }, workspaces: { elements: { type: 'string' } } },
  additionalProperties: true,
};
const named = (file: string): Named => parseJson(read(file), namedSchema, file);
/** The fields of a composer.json of packages/ that the test reads. */
interface Composer { name: string; autoload: { 'psr-4': Record<string, unknown> }; 'autoload-dev'?: { 'psr-4'?: Record<string, unknown> } }
const composerSchema: JTDSchemaType<Composer> = {
  properties: { name: { type: 'string' }, autoload: { properties: { 'psr-4': { values: {} } }, additionalProperties: true } },
  optionalProperties: { 'autoload-dev': { optionalProperties: { 'psr-4': { values: {} } }, additionalProperties: true } },
  additionalProperties: true,
};
/** The capture group `index` of `match`, which the pattern always captures. */
function group(match: RegExpMatchArray, index: number): string {
  const value = match[index];
  assert.ok(value !== undefined, `no group ${index} in ${match[0]}`);
  return value;
}
// The manifests under .mise/locks are the sidecar locks that mise writes for its npm-backed tools, not packages of crudui.
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(file => file && !isVendored(file) && !file.startsWith('.mise/locks/'));

test('every package of packages/ has the name of the polyspec convention', () => {
  const root = named('package.json');
  assert.equal(root.name, '@polyspec/crudui-workspace');
  // The npm workspaces of package.json, by their folder under packages/.
  const npm = Object.fromEntries((root.workspaces ?? [])
    .map(folder => [folder.slice('packages/'.length), named(`${folder}/package.json`).name]));
  assert.deepEqual(npm, {
    cli: '@polyspec/crudui-cli',
    'form-binding': '@polyspec/crudui-form-binding',
    'generator/ts': '@polyspec/crudui-generator-core',
    'html': '@polyspec/crudui-generator-html',
    'react': '@polyspec/crudui-generator-react',
    'svelte': '@polyspec/crudui-generator-svelte',
    'vue': '@polyspec/crudui-generator-vue',
    'validator/ts': '@polyspec/crudui-validator',
  });

  for (const [directory, name] of [['validator/php', 'polyspec/crudui-validator'], ['generator/php', 'polyspec/crudui-generator']] as const) {
    const composer = parseJson(read(`packages/${directory}/composer.json`), composerSchema, `packages/${directory}/composer.json`);
    assert.equal(composer.name, name);
    const prefixes = [...Object.keys(composer.autoload['psr-4']), ...Object.keys(composer['autoload-dev']?.['psr-4'] ?? {})];
    assert.deepEqual(prefixes.filter(prefix => !prefix.startsWith('Polyspec\\Crudui\\')), [], `${directory}: PSR-4 prefixes`);
  }
  const namespaces = [...read('packages/php-ext/src/polyspec_crudui.stub.php').matchAll(/^namespace ([^ {;]+)/gm)].map(match => group(match, 1));
  assert.ok(namespaces.length > 0);
  assert.deepEqual(namespaces.filter(name => name !== 'Polyspec\\Crudui' && !name.startsWith('Polyspec\\Crudui\\')), []);

  for (const [directory, name] of [['validator/rust', 'polyspec-crudui-validator'], ['generator/rust', 'polyspec-crudui-generator']] as const) {
    const manifest = read(`packages/${directory}/Cargo.toml`);
    assert.equal(/^\[package\]\nname = "([^"]+)"/m.exec(manifest)?.[1], name, directory);
    const library = /^\[lib\]\nname = "([^"]+)"/m.exec(manifest)?.[1];
    if (library) assert.equal(library, name.replaceAll('-', '_'), directory);
  }

  for (const directory of ['validator/go', 'generator/go']) {
    assert.equal(/^module (\S+)$/m.exec(read(`packages/${directory}/go.mod`))?.[1], `github.com/polyspec/crudui/packages/${directory}`);
  }
});

// The programs of examples/, tests/ and tools/ are packages of this repository too: every tracked manifest names
// its package by the convention, so a private npm package is `@polyspec/crudui-<name>`, a crate and its binaries
// `polyspec-crudui-<name>`, and a Go module `github.com/polyspec/crudui/<directory>`.
test('every tracked manifest names its package by the polyspec convention', () => {
  const failures: string[] = [];
  for (const file of tracked) {
    const name = path.posix.basename(file);
    const directory = path.posix.dirname(file);
    if (name === 'package.json') {
      const manifest = named(file);
      if (manifest.name !== undefined && !/^@polyspec\/crudui-[a-z0-9-]+$/.test(manifest.name)) failures.push(`${file}: ${manifest.name}`);
    } else if (name === 'composer.json') {
      const manifest = named(file);
      if (manifest.name === undefined || !/^polyspec\/crudui-[a-z0-9-]+$/.test(manifest.name)) failures.push(`${file}: ${manifest.name ?? 'no name'}`);
    } else if (name === 'Cargo.toml') {
      const manifest = read(file);
      const names = [...manifest.matchAll(/^\[(package|\[bin\])\]\nname = "([^"]+)"/gm)].map(match => group(match, 2));
      assert.ok(names.length > 0, `${file}: no package name`);
      for (const crate of names) if (!/^polyspec-crudui-[a-z0-9-]+$/.test(crate)) failures.push(`${file}: ${crate}`);
    } else if (name === 'go.mod') {
      const module = /^module (\S+)$/m.exec(read(file))?.[1];
      if (module !== `github.com/polyspec/crudui/${directory}`) failures.push(`${file}: ${module}`);
    }
  }
  assert.deepEqual(failures, []);
});

// The forms of the names before the convention. A C identifier of the extension (crudui_validator_ce) is not a
// package name, and neither is the product of a package in config/release.json, which the label of its release asset
// names (P39).
const OLD_NAMES: [string, RegExp][] = [
  ['npm scope @crudui', /@crudui\//g],
  ['PHP namespace CRUDUI', /\bCRUDUI\\/g],
  // phpDocumentor writes the page of a class as its namespace joined by hyphens: classes/CRUDUI-Generator.html.
  ['PHP API page CRUDUI-', /\bCRUDUI-(?:\$\{|Generator\b|Validator\b|Form)/g],
  ['Composer package crudui/', /(?<![@\w/])crudui\\?\/(?:validator|generator)\b/g],
  ['Rust crate crudui-', /(?<![\w/-])(?<!"product": ")crudui-(?:validator|generator)\b/g],
  ['Rust library crudui_', /(?<!\w)crudui_(?:validator|generator)(?!_ce)\b/g],
];
const RECORDS = new Set(['CHANGELOG.md', 'CHANGELOG.ko.md', 'docs/plans/execution-checklist/checklist.md', 'docs/plans/execution-checklist/checklist.ko.md', 'docs/plans/execution-checklist/plan.md', 'docs/plans/execution-checklist/plan.ko.md']);

test('no maintained file names a package by a form before the convention', () => {
  const failures: string[] = [];
  for (const file of tracked) {
    if (RECORDS.has(file) || file === 'tests/build/package-names.test.mts') continue;
    let text: string;
    try {
      text = read(file);
    } catch (cause) {
      if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') continue;
      throw cause;
    }
    if (text.includes('\0')) continue;
    for (const [label, pattern] of OLD_NAMES) {
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split('\n').length;
        failures.push(`${file}:${line}: ${label}: ${match[0]}`);
      }
    }
  }
  assert.deepEqual(failures.slice(0, 40), [], `${failures.length} names before the convention:\n${failures.slice(0, 40).join('\n')}`);
});
