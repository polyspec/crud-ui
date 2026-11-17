// `make test-php-ext` runs the PHP extension tests with PHP_INI_SCAN_DIR set to the directory of the json ini. A scan
// directory set in the environment replaces PHP's own, for every PHP child that inherits it, so the variable must keep
// PHP's compiled scan directory after the json directory (C19.129).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('test-php-ext keeps PHP\'s own scan directory in PHP_INI_SCAN_DIR', () => {
  const dry = makeDryRun(ROOT, 'test-php-ext');
  assert.equal(dry.status, 0, dry.stderr);
  const line = dry.stdout.split('\n').find(text => text.includes('php-extension') && text.includes('PHP_INI_SCAN_DIR='));
  assert.ok(line, dry.stdout);
  const value = /PHP_INI_SCAN_DIR=(\S+)/.exec(line)?.[1] ?? '';
  const php = spawnSync('php', ['-r', 'echo PHP_CONFIG_FILE_SCAN_DIR;'], { encoding: 'utf8' }).stdout.trim();
  assert.ok(php, 'php reports no compiled scan directory');
  assert.ok(value.split(':').includes(php), `PHP_INI_SCAN_DIR=${value} drops the scan directory ${php} of PHP`);
});
