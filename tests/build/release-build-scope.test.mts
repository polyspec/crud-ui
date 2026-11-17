// The release archives hold only the packages of config/release.json (C19.76): the recipes of release-assets and
// release-candidate-assets build no npm workspace package, since no npm package is released.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

for (const [target, variables] of [['release-assets', ['TAG=v0.0.1']], ['release-candidate-assets', ['VERSION=0.0.1']]] as const) {
  test(`${target} builds no npm workspace package (C19.76)`, () => {
    const dry = makeDryRun(ROOT, target, { variables: [...variables] });
    assert.equal(dry.status, 0, dry.stderr);
    const builds = dry.stdout.split('\n').filter(line => /require-current-build|npm run build\b/.test(line));
    assert.deepEqual(builds, []);
  });
}
