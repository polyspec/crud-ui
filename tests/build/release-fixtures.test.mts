import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { makeTargets } from '../../scripts/test-commands.mts';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = path.resolve(import.meta.dirname, '../..');

test('release and candidate archives prepare caches before the release build (C18.10-17, C18.10-19, C19.76)', () => {
  const database = makeDryRun(ROOT, 'help', { database: true });
  assert.equal(database.status, 0, database.stderr);
  const targets = makeTargets(database.stdout);
  const notParallel = database.stdout.split('\n').find(line => line.startsWith('.NOTPARALLEL:'));
  assert.ok(notParallel, 'archive preparation requires native Make serialization');
  const serialized = notParallel.slice('.NOTPARALLEL:'.length).trim().split(/\s+/);
  for (const target of ['release-assets', 'release-candidate-assets']) {
    // C19.76: the archives hold only the packages of config/release.json, so no current package build is a prerequisite.
    assert.deepEqual(targets[target]?.prerequisites, ['crudui-prepare-release-build'], target);
    assert.ok(serialized.includes(target), `${target}: native preparation must complete before the build`);
  }
  assert.deepEqual(targets['crudui-prepare-release-build']?.prerequisites,
    ['crudui-install-crates', 'crudui-install-go-modules']);
});
