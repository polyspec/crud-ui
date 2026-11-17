// The publish job of release.yml pushes the tags of the Go modules once, after every release-go-module of the components
// (binding B2.488, C19.80): the module recipes no longer push, so that all tags go up in one git push --atomic.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('ci-release-publish pushes the Go module tags once, after the module recipes of every component (C19.80)', () => {
  const dry = makeDryRun(ROOT, 'ci-release-publish', { variables: ['TAG=v0.0.1'] });
  assert.equal(dry.status, 0, dry.stderr);
  const lines = dry.stdout.split('\n');
  const modules = lines.map((line, index) => ({ line, index })).filter(({ line }) => /release-go-module-(validator|generator)\b/.test(line));
  const pushes = lines.map((line, index) => ({ line, index })).filter(({ line }) => /release-go-module-push\b/.test(line));
  assert.equal(modules.length, 2, dry.stdout);
  assert.equal(pushes.length, 1, dry.stdout);
  assert.ok(pushes[0].index > modules[modules.length - 1].index, 'the push comes before a module recipe');
});
