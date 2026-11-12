import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkedFiles } from '@polyspec/kit/tracked-files';

const root = path.resolve(import.meta.dirname, '../..');
/** The Vite configuration files of the checkout at `directory` among its tracked files. */
function viteConfigurationFiles(directory: string): string[] {
  return checkedFiles(directory).filter(file => /(?:^|\/)vite\.config\.[cm]?[jt]s$/.test(file)).sort();
}

test('ES module Vite configurations use native module paths', () => {
  const files = viteConfigurationFiles(root);
  const failures = files.filter((filename) => {
    const source = readFileSync(path.join(root, filename), 'utf8');
    return /^\s*(?:import|export)\s/m.test(source) && /\b__dirname\b/.test(source);
  });
  assert.deepEqual(failures, []);
});

test('Vite configuration discovery does not require Git metadata', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'crudui-vite-config-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, 'packages/example'), { recursive: true });
  mkdirSync(path.join(directory, 'node_modules/ignored'), { recursive: true });
  writeFileSync(path.join(directory, 'packages/example/vite.config.ts'), 'export default {};\n');
  writeFileSync(path.join(directory, 'node_modules/ignored/vite.config.ts'), 'ignored\n');
  writeFileSync(path.join(directory, '.gitignore'), 'node_modules/\n');
  execFileSync('git', ['init', '--quiet'], { cwd: directory });

  assert.deepEqual(viteConfigurationFiles(directory), ['packages/example/vite.config.ts']);
});

test('cross-check renderer resolves build tools by package name', () => {
  const filename = path.join(root, 'legacy/examples/cross-check-console/server/engine.mjs');
  const source = readFileSync(filename, 'utf8');

  assert.match(source, /import\(\s*['"]vite['"]\s*\)/);
  assert.match(source, /import\(\s*['"]@sveltejs\/vite-plugin-svelte['"]\s*\)/);
  assert.doesNotMatch(source, /node_modules/);
});
