import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { makeTargets } from '../../scripts/test-commands.mts';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = path.resolve(import.meta.dirname, '../..');

test('release and candidate archives prepare caches before current package builds (C18.10-17, C18.10-19)', () => {
  const database = makeDryRun(ROOT, 'help', { database: true });
  assert.equal(database.status, 0, database.stderr);
  const targets = makeTargets(database.stdout);
  const notParallel = database.stdout.split('\n').find(line => line.startsWith('.NOTPARALLEL:'));
  assert.ok(notParallel, 'archive preparation requires native Make serialization');
  const serialized = notParallel.slice('.NOTPARALLEL:'.length).trim().split(/\s+/);
  for (const target of ['release-assets', 'release-candidate-assets']) {
    assert.deepEqual(targets[target]?.prerequisites, ['crudui-prepare-release-build', 'build'], target);
    assert.ok(serialized.includes(target), `${target}: native preparation must complete before the build`);
  }
  assert.deepEqual(targets['crudui-prepare-release-build']?.prerequisites,
    ['crudui-install-crates', 'crudui-install-go-modules']);
});
