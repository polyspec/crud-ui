// The manifest runner counts each declared command as one result. Its summary must say so, and its exit status must agree
// with the summary: a run that prints a failure mark exits with status 1 (C19.114). The feature validateList declares two
// cheap commands, which the test runs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('the manifest summary counts the declared commands and agrees with the exit status', () => {
  const run = spawnSync(process.execPath, ['scripts/run-contract-tests.mts', '--feature', 'validateList'], { cwd: ROOT, encoding: 'utf8' });
  const output = `${run.stdout}${run.stderr}`.replace(/\x1b\[[0-9;]*m/g, '');
  const summary = output.split('\n').filter(line => line.includes('manifest:test:')).at(-1) ?? '';
  assert.match(summary, /manifest:test: 2 declared commands: 2 passed, 0 failed, 0 skipped/, output);
  assert.doesNotMatch(summary, /no test ran/, output);
  assert.equal(summary.includes('✖'), false, output);
  assert.equal(run.status, 0, output);
});
