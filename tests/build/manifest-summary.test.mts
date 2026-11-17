// The manifest runner counts each declared command as one result. Its summary must say so, and its exit status must agree
// with the summary (C19.114). The features are written to a temporary file with trivial commands, so the test does not
// depend on any build of the packages (the runtime shards do not build them).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Runs the manifest runner over the features that `commands` declares, and returns its output and exit status. */
function runWith(commands: string[]): { output: string; status: number | null } {
  const directory = mkdtempSync(path.join(tmpdir(), 'crudui-manifest-summary-'));
  try {
    const file = path.join(directory, 'features.json');
    const verification = commands.map((command, index) => ({ id: `c${index + 1}`, command }));
    writeFileSync(file, JSON.stringify({ features: [{ id: 'summary', verification }] }));
    const run = spawnSync(process.execPath, ['scripts/run-contract-tests.mts', '--features', file], { cwd: ROOT, encoding: 'utf8' });
    return { output: `${run.stdout}${run.stderr}`.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), ''), status: run.status };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function summaryLine(output: string): string {
  return output.split('\n').filter(line => line.includes('manifest:test:')).at(-1) ?? '';
}

test('the manifest summary counts passing commands and agrees with the exit status', () => {
  const run = runWith(['node -e ""', 'node -e "process.exit(0)"']);
  const summary = summaryLine(run.output);
  assert.match(summary, /manifest:test: 2 declared commands: 2 passed, 0 failed, 0 skipped/, run.output);
  assert.doesNotMatch(summary, /no test ran/, run.output);
  assert.equal(summary.includes('✖'), false, run.output);
  assert.equal(run.status, 0, run.output);
});

test('the manifest summary counts a failing command and exits with status 1', () => {
  const run = runWith(['node -e ""', 'node -e "process.exit(1)"']);
  const summary = summaryLine(run.output);
  // The runner names the failed command before the counts: `2 declared commands, failed: <id>: 1 passed, 1 failed, 0 skipped`.
  assert.match(summary, /manifest:test: 2 declared commands, failed: .*: 1 passed, 1 failed, 0 skipped/, run.output);
  assert.equal(summary.includes('✖'), true, run.output);
  assert.equal(run.status, 1, run.output);
});
