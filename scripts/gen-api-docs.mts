#!/usr/bin/env node
/**
 * Generate public API references; a failed tool or missing output fails the command. Each tool
 * command runs to its end without a time limit (@polyspec/kit/run-command) and prints its elapsed
 * time.
 */
import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { failureOf, runCommand } from '@polyspec/kit/run-command';
import { createOperationProgress } from './operation-progress.mts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUST_COMMAND = join(ROOT, 'scripts/run-rust-command.mts');
const API_DIR = join(ROOT, 'docs/api');
const STATIC_API_DIR = join(ROOT, 'docs/public/api');
const target = process.argv[2] ?? 'all';
if (!['all', 'ts', 'go', 'rust', 'php'].includes(target)) {
  throw new Error('Use all, ts, go, rust or php');
}
const want = (name: string): boolean => target === 'all' || target === name;
const packages = ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react', 'vue', 'svelte', 'form-binding'];

const lines = createOperationProgress({ write: text => process.stdout.write(text) });
const shown = (value: string): string => value.startsWith(ROOT) ? relative(ROOT, value) || '.' : value;

/** Run one tool command to its end; `capture` returns its standard output. */
async function run(
  command: string, args: string[], cwd: string = ROOT, { capture = false }: { capture?: boolean } = {},
): Promise<string> {
  const id = [basename(command), ...args.map(shown)].join(' ');
  lines.start(id);
  const result = await runCommand({ command, args, cwd, stdout: capture ? 'pipe' : 'inherit' });
  const failure = failureOf(result);
  if (failure) {
    lines.fail(id, result.elapsedMs, failure);
    throw new Error(`Command failed: ${id} ${failure}`);
  }
  lines.pass(id, result.elapsedMs);
  return result.stdout;
}

function requireOutput(path: string): void {
  if (!existsSync(path)) throw new Error(`Documentation output is missing: ${path}`);
}

function cleanDirectory(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

// API Extractor checks the public API of each package against its committed report and writes its doc model to
// var/api-model/<package> (api-extractor.json of the package); API Documenter writes the Markdown pages of that model.
function unscopedName(manifest: string): string {
  const value: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
  const name = typeof value === 'object' && value !== null && 'name' in value ? value.name : undefined;
  assert.ok(typeof name === 'string', `${manifest} names its package`);
  const unscoped = name.split('/')[1];
  assert.ok(unscoped !== undefined);
  return unscoped;
}

async function genTypeScript(): Promise<void> {
  await run('npm', ['run', 'build']);
  for (const pkg of packages) {
    const pkgDir = join(ROOT, 'packages', pkg);
    // API Extractor writes the doc model to var/api-model/<unscopedPackageName> (api-extractor.json of each package), and
    // API Documenter writes its pages to docs/api/<unscopedPackageName>.
    const unscoped = unscopedName(join(pkgDir, 'package.json'));
    const output = join(API_DIR, unscoped);
    const model = join(ROOT, 'var/api-model', unscoped);
    cleanDirectory(output);
    rmSync(model, { recursive: true, force: true });
    await run(join(ROOT, 'node_modules/.bin/api-extractor'), ['run'], pkgDir);
    await run(join(ROOT, 'node_modules/.bin/api-documenter'), ['markdown', '--input-folder', model, '--output-folder', output]);
    requireOutput(join(output, 'index.md'));
  }
}

async function genGo(): Promise<void> {
  const output = join(API_DIR, 'go.md');
  rmSync(output, { force: true });
  const sections: string[] = [];
  for (const pkg of ['../legacy/packages/validator/go', '../legacy/packages/generator/go']) {
    const cwd = join(ROOT, 'packages', pkg);
    const go = process.env.GO ?? 'go';
    const listed = (await run(go, ['list', '-f', '{{if ne .Name "main"}}{{.ImportPath}}{{end}}', './...'], cwd, { capture: true })).trim();
    if (!listed) throw new Error(`Go package list is empty: ${pkg}`);
    for (const name of listed.split('\n').filter(Boolean).sort()) {
      const body = (await run(go, ['doc', '-all', name], cwd, { capture: true })).trimEnd();
      if (!body) throw new Error(`Go documentation is empty: ${name}`);
      sections.push(`## ${name}\n\n\`\`\`text\n${body}\n\`\`\`\n`);
    }
  }
  writeFileSync(output, '# Go API\n\n' + sections.join('\n'));
}

/**
 * The Rust API of the two core crates. They are members of the Cargo workspace of the root, so cargo runs at the root
 * and writes the documentation into target/doc of the root.
 */
async function genRust(): Promise<void> {
  const generated = join(ROOT, 'target/doc');
  const output = join(STATIC_API_DIR, 'rust');
  cleanDirectory(output);
  await run(process.execPath, [
    RUST_COMMAND, 'doc', '--locked', '--no-deps',
    '-p', 'polyspec-crud-ui-validator', '-p', 'polyspec-crud-ui-generator',
  ], ROOT);
  requireOutput(join(generated, 'polyspec_crud_ui_validator/index.html'));
  requireOutput(join(generated, 'polyspec_crud_ui_generator/index.html'));
  cpSync(generated, output, { recursive: true });
  writeFileSync(join(API_DIR, 'rust.md'),
    '# Rust API\n\n- [Validator](/api/rust/polyspec_crud_ui_validator/index.html)\n- [Generator](/api/rust/polyspec_crud_ui_generator/index.html)\n');
}

/**
 * The checkout whose var/tools the checkout `root` runs, as KIT_TOOLS of kit names it (kit K519): a linked worktree, whose .git is a
 * file naming <main>/.git/worktrees/<name>, runs the tools of its main checkout; a main checkout, and a folder of no repository, its own.
 */
function toolsRoot(root: string): string {
  const marker = join(root, '.git');
  if (!existsSync(marker) || !lstatSync(marker).isFile()) return root;
  const gitdir = /^gitdir: (.+)$/m.exec(readFileSync(marker, 'utf8'))?.[1];
  if (gitdir === undefined) throw new Error(`${marker} names no gitdir`);
  const linked = /^(.*)\/\.git\/worktrees\/[^/]+$/.exec(resolve(root, gitdir.trim()));
  return linked?.[1] ?? root;
}

async function genPhp(): Promise<void> {
  // The tools of a linked worktree are those of its main checkout (kit K519); the cache is the checkout's own.
  const phar = join(toolsRoot(ROOT), 'var/tools/phpdocumentor/phpDocumentor.phar');
  requireOutput(phar);
  const output = join(STATIC_API_DIR, 'php');
  const cache = join(ROOT, 'var/phpdocumentor/cache');
  cleanDirectory(output);
  try {
    await run(process.env.PHP ?? 'php', [phar, 'run', '-d', 'legacy/packages/validator/php/src', '-d', 'legacy/packages/generator/php/src', '-t', output,
      '--cache-folder', cache, '--title', 'CRUDUI PHP API', '--no-interaction']);
    requireOutput(join(output, 'index.html'));
    for (const name of ['Generator', 'Validator', 'Form', 'FormError']) {
      requireOutput(join(output, 'classes', `Polyspec-Crudui-${name}.html`));
    }
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
  writeFileSync(join(API_DIR, 'php.md'),
    '# PHP API\n\n[Open the PHP API reference](/api/php/index.html).\n');
}

mkdirSync(API_DIR, { recursive: true });
if (want('ts')) await genTypeScript();
if (want('go')) await genGo();
if (want('rust')) await genRust();
if (want('php')) await genPhp();
if (target === 'all') {
  const links = packages.map(pkg => unscopedName(join(ROOT, 'packages', pkg, 'package.json')))
    .map(unscoped => `- [${unscoped}](./${unscoped}/index.md)`).join('\n');
  writeFileSync(join(API_DIR, 'index.md'),
    '# API reference\n\nGenerate with `make docs-api`.\n\n' + links +
    '\n- [Go](./go.md)\n- [Rust](./rust.md)\n- [PHP](./php.md)\n');
}
lines.close(`gen-api-docs ${target}`);
process.stdout.write(`[gen-api-docs] ${target}: complete\n`);
