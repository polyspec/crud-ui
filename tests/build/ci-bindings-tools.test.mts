import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

// The job bindings of ci.yml runs make ci-bindings, whose install-tools step selects the tools it installs into var/tools.
// test-binding-python-validator builds the wheels with the maturin of mise.toml (var/tools/mise/shims/maturin), which only
// that selection installs, so the selection must name maturin.
test('the bindings job installs the maturin that builds the Python wheels', () => {
  const dryRun = execFileSync('gmake', ['-n', 'ci-bindings'], { encoding: 'utf8' });
  const install = dryRun.split('\n').find((line) => line.includes('install-tools') && line.includes('TOOLS='));
  assert.ok(install, 'ci-bindings runs install-tools with TOOLS');
  assert.match(install, /TOOLS="[^"]*\bmaturin\b[^"]*"/);
});
