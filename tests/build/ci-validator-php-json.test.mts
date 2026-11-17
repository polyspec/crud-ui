// The job validator-php runs crudui-test-php-source, whose PHPUnit run loads the polyspec_json extension that
// POLYSPEC_JSON_MODULE names. The job installs it before its targets, as the other jobs that load it do.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('ci-validator-php installs the polyspec_json extension before it runs the PHP source tests', () => {
  const dry = makeDryRun(ROOT, 'ci-validator-php');
  assert.equal(dry.status, 0, dry.stderr);
  const lines = dry.stdout.split('\n');
  const install = lines.findIndex(line => line.includes('crudui-install-json-php'));
  const run = lines.findIndex(line => line.includes('crudui-test-php-source'));
  assert.notEqual(install, -1, dry.stdout);
  assert.ok(install < run, dry.stdout);
});
