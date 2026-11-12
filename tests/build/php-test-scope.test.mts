import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { makeDryRun } from './make-dry-run.mts';
import { readJson } from '../json.mts';

const root = path.resolve(import.meta.dirname, '../..');
const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
assert.equal(common.status, 0, common.stderr);
const php = path.resolve(common.stdout.trim(), '../var/tools/bin/php');

function listing(component: string, args: string[]): Set<string> {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'crudui-php-scope-'));
  try {
    const xml = path.join(directory, 'tests.xml');
    const command = [path.join(root, 'vendor/phpunit/phpunit/phpunit'), '-c', 'phpunit.xml', '--list-tests-xml', xml, ...args];
    const result = spawnSync(php, command, { cwd: path.join(root, 'legacy/packages', component, 'php'), encoding: 'utf8', timeout: 60_000 });
    assert.equal(result.error, undefined, `${php} ${command.join(' ')}: ${result.error?.message ?? ''}`);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return new Set([...readFileSync(xml, 'utf8').matchAll(/<testMethod id="([^"]+)"/g)].map(match => match[1] ?? ''));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const component of ['generator', 'validator']) {
  test(`${component} source suites preserve every native PHPUnit case and public selection`, { timeout: 60_000 }, () => {
    const all = listing(component, ['tests']);
    const publicCases = listing(component, ['--testsuite', 'public']);
    const internals = listing(component, ['--testsuite', 'php-source-internal']);
    const defaults = listing(component, []);
    assert.ok(all.size > 0, 'ran no PHP test case');
    assert.ok(internals.size > 0, 'source-internal suite must retain implementation unit cases');
    assert.ok(publicCases.size > 0, 'public suite must retain API and contract cases');
    assert.deepEqual([...publicCases].filter(id => internals.has(id)), [], 'a case belongs to exactly one runtime scope');
    assert.deepEqual([...new Set([...publicCases, ...internals])].sort(), [...all].sort(), 'source suites must not omit any discovered case');
    assert.deepEqual([...defaults].sort(), [...publicCases].sort(), 'extension default must run every public case');
  });
}


test('PHP source entry points select public and source-internal suites', { timeout: 10_000 }, () => {
  for (const component of ['generator', 'validator']) {
    const manifest = readJson<{ scripts: { test: string } }>(path.join(root, 'legacy/packages', component, 'php/composer.json'), {
      properties: { scripts: { properties: { test: { type: 'string' } }, additionalProperties: true } }, additionalProperties: true,
    });
    assert.match(manifest.scripts.test, /--testsuite public,php-source-internal/);
  }
  for (const target of ['crudui-test-php-api', 'crudui-test-validators']) {
    const result = makeDryRun(root, target);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /phpunit --cwd packages\/(?:generator|validator)\/php -- --testsuite public,php-source-internal/);
  }
  const source = makeDryRun(root, 'crudui-test-php-source');
  assert.equal(source.status, 0, source.stderr);
  for (const component of ['generator', 'validator']) {
    assert.ok(source.stdout.includes(`phpunit --cwd packages/${component}/php -- --testsuite public,php-source-internal`));
  }
  assert.doesNotMatch(source.stdout, /runtime-targets|crudui-test-php-source-internals/);
  const filtered = makeDryRun(root, 'crudui-test-php-source',{ variables: ['CASES=ExamplePattern'] });
  assert.equal(filtered.status, 0, filtered.stderr);
  assert.equal([...filtered.stdout.matchAll(/--filter "\$CASES"/g)].length, 2);

});
