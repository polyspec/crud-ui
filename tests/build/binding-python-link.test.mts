// The wheel of each Python binding is built by the maturin of mise.toml through the link script of kit (kit K1266), so that a
// checkout with a link declaration builds it against the linked crates as the other bindings are built (C19.78): uv build
// starts maturin outside the link, and the wheel then compiles the crates that Cargo.lock pins.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

for (const component of ['validator', 'generator']) {
  test(`test-binding-python-${component} builds its wheel with maturin through the link script (C19.78)`, () => {
    const dry = makeDryRun(ROOT, `test-binding-python-${component}`);
    assert.equal(dry.status, 0, dry.stderr);
    const lines = dry.stdout.split('\n');
    assert.deepEqual(lines.filter(line => /\buv\b.* build\b/.test(line)), []);
    const builds = lines.filter(line => line.includes(`packages/${component}/python`) && /\bmaturin\b/.test(line));
    assert.equal(builds.length, 1, dry.stdout);
    assert.match(builds[0], /link\.m[jt]s maturin \S*packages\/[a-z]+\/python build --locked/);
  });
}
