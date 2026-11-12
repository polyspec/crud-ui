import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { acquireHolderLock } from '@polyspec/kit/holder-lock';
import { packReport } from '../../scripts/package-install-pack.mts';
import { readManifest, script } from '../json.mts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

/** The recipe lines of one Makefile target, up to the next target. */
function recipe(target: string): string {
  const lines = read('Makefile').split('\n');
  const start = lines.findIndex(line => line.startsWith(`${target}:`));
  assert.ok(start >= 0, `Makefile has no target ${target}`);
  const end = lines.findIndex((line, index) => index > start && /^[A-Za-z0-9_.-]+:/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

test('no Makefile recipe writes to a fixed path under /tmp', () => {
  const fixed = read('Makefile').split('\n').map((line, index) => `Makefile:${index + 1}: ${line.trim()}`)
    .filter(line => /(?:^|[\s'"=(])\/tmp\/[A-Za-z0-9]/.test(line));
  assert.deepEqual(fixed, [], 'Two runs would share these paths; create a directory per run with mktemp');
});

test('docs-verify-idempotent compares the two runs in a directory of its own run', () => {
  const lines = recipe('docs-verify-idempotent');
  assert.match(lines, /mktemp -d/);
  assert.match(lines, /trap 'rm -rf "\$\$runs"' EXIT/);
});

const builtPackages = ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react', 'vue',
  'svelte', 'form-binding'];

test('every package build runs under the lock of its dist directory', () => {
  for (const folder of builtPackages) {
    const build = script(readManifest(path.join(root, `packages/${folder}/package.json`)), 'build');
    // The script of the root, named from the package folder ('../../', for a port of a component '../../../', and one
    // level more under legacy/).
    assert.match(build, /^node (?:\.\.\/){2,4}scripts\/package-dist\.mts build '[^']+'$/, folder);
    assert.ok(build.startsWith(`node ${'../'.repeat(path.normalize(`packages/${folder}`).split(path.sep).length)}scripts/package-dist.mts`), folder);
  }
});

/**
 * A checkout of its own in a directory of this run under var/tmp, the ignored directory of this checkout: the dist script
 * and one package whose build writes `dist/index.js`, so the test reads no build output of this checkout. The script
 * imports @polyspec/kit, which Node.js resolves from the node_modules of this checkout above the directory.
 */
function fixtureCheckout() {
  fs.mkdirSync(path.join(root, 'var/tmp'), { recursive: true });
  const checkout = fs.mkdtempSync(path.join(root, 'var/tmp/crudui-dist-lock-'));
  fs.mkdirSync(path.join(checkout, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts/package-dist.mts'), path.join(checkout, 'scripts/package-dist.mts'));
  const packageDirectory = path.join(checkout, 'packages', 'fixture');
  fs.mkdirSync(packageDirectory, { recursive: true });
  fs.writeFileSync(path.join(packageDirectory, 'package.json'), `${JSON.stringify({
    name: '@polyspec/crudui-dist-lock-fixture', version: '0.0.0', private: true, type: 'module', files: ['dist'],
    scripts: { build: "node ../../scripts/package-dist.mts build 'node build.mjs'" },
  }, null, 2)}\n`);
  // The build writes into the directory that CRUDUI_DIST names, as every package build does (scripts/package-dist.mts);
  // BUILD_VALUE sets the output, BUILD_FAIL fails the build after it wrote, and BUILD_SEEN records the dist it saw.
  fs.writeFileSync(path.join(packageDirectory, 'build.mjs'), [
    "import fs from 'node:fs';",
    "const out = process.env.CRUDUI_DIST;",
    "if (process.env.BUILD_SEEN) fs.writeFileSync(process.env.BUILD_SEEN, fs.existsSync('dist') ? fs.readdirSync('dist').map(name => name + '=' + fs.readFileSync('dist/' + name, 'utf8')).join(',') : 'none');",
    "fs.rmSync(out, { recursive: true, force: true });",
    "fs.mkdirSync(out);",
    "fs.writeFileSync(out + '/index.js', `export default ${process.env.BUILD_VALUE ?? 1};\\n`);",
    "if (process.env.BUILD_FAIL) process.exit(3);",
    '',
  ].join('\n'));
  return { checkout, packageDirectory, lockFile: path.join(checkout, 'var/locks', 'dist-fixture.lock') };
}

test('a package build replaces dist with its complete output, and a failed build leaves dist', () => {
  const { checkout, packageDirectory } = fixtureCheckout();
  const build = (env: Record<string, string>) => spawnSync('npm', ['run', 'build'], { cwd: packageDirectory, encoding: 'utf8', env: { ...process.env, ...env } });
  const seen = path.join(checkout, 'seen');
  const dist = () => fs.readFileSync(path.join(packageDirectory, 'dist/index.js'), 'utf8');
  try {
    assert.equal(build({ BUILD_VALUE: '1' }).status, 0);
    assert.equal(dist(), 'export default 1;\n');
    // While the second build writes, dist still holds the first output.
    const second = build({ BUILD_VALUE: '2', BUILD_SEEN: seen });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(fs.readFileSync(seen, 'utf8'), 'index.js=export default 1;\n');
    assert.equal(dist(), 'export default 2;\n');
    const failed = build({ BUILD_VALUE: '3', BUILD_FAIL: '1' });
    assert.equal(failed.status, 3, failed.stderr);
    assert.equal(dist(), 'export default 2;\n');
    assert.deepEqual(fs.readdirSync(packageDirectory).filter(name => name.startsWith('dist')).sort(), ['dist']);
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true });
  }
});

test('a build and a pack of a package refuse while another run holds its dist', () => {
  const { checkout, packageDirectory, lockFile } = fixtureCheckout();
  const destination = path.join(checkout, 'packs');
  fs.mkdirSync(destination);
  const build = () => spawnSync('npm', ['run', 'build'], { cwd: packageDirectory, encoding: 'utf8' });
  const pack = () => spawnSync(process.execPath, [path.join(checkout, 'scripts/package-dist.mts'), 'pack',
    packageDirectory, destination], { cwd: checkout, encoding: 'utf8' });
  try {
    const built = build();
    assert.equal(built.status, 0, built.stderr);
    const distBefore = fs.readdirSync(path.join(packageDirectory, 'dist')).sort();
    assert.deepEqual(distBefore, ['index.js']);
    const lock = acquireHolderLock(lockFile, { command: 'npm run build' });
    try {
      const refusedBuild = build();
      assert.notEqual(refusedBuild.status, 0, refusedBuild.stdout);
      assert.match(refusedBuild.stderr, new RegExp(`${lockFile} is held by process ${process.pid} \\(started `));
      assert.deepEqual(fs.readdirSync(path.join(packageDirectory, 'dist')).sort(), distBefore);
      const refused = pack();
      assert.equal(refused.status, 1, refused.stderr);
      assert.match(refused.stderr, new RegExp(`${lockFile} is held by process ${process.pid} `));
      assert.deepEqual(fs.readdirSync(destination), []);
    } finally {
      lock.release();
    }
    const packed = pack();
    assert.equal(packed.status, 0, packed.stderr);
    const report = packReport(packed.stdout, '@polyspec/crudui-dist-lock-fixture');
    assert.ok(report.files.some(entry => entry.path === 'dist/index.js'), 'The archive holds the built dist');
    assert.deepEqual(fs.readdirSync(destination), [report.filename]);
    assert.equal(fs.existsSync(lockFile), false);
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true });
  }
});
