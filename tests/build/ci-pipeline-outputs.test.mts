// The workflow ci-pipeline.yml reads the outputs of its plan job, which kit-ci-plan writes (kit's ci-setup writes runtimes,
// runner, has_runtimes and shared_php). A reference to an output that kit does not write is an empty string, so the shared
// job's PHP setup (`contains(…, 'php')`) was always skipped and phpDocumentor ran on the runner's PHP 8.3 (C19.120).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const workflow = readFileSync(`${ROOT}/.github/workflows/ci-pipeline.yml`, 'utf8');
// The outputs that kit-ci-plan writes to GITHUB_OUTPUT (node_modules/@polyspec/kit/dist/ci-setup.mjs).
const KIT_PLAN_OUTPUTS = ['runtimes', 'runner', 'has_runtimes', 'shared_php'];

test('ci-pipeline.yml reads only the plan outputs that kit-ci-plan writes', () => {
  const referenced = [...workflow.matchAll(/needs\.plan\.outputs\.([A-Za-z_]+)/g)].map(match => match[1]);
  assert.ok(referenced.length > 0);
  for (const name of referenced) {
    assert.ok(KIT_PLAN_OUTPUTS.includes(name), `needs.plan.outputs.${name} is not written by kit-ci-plan`);
  }
});

test('the plan job declares only outputs that kit-ci-plan writes', () => {
  const declared = [...workflow.matchAll(/^\s{6}([a-z_]+): \$\{\{ steps\.plan\.outputs\.\1 \}\}$/gm)].map(match => match[1]);
  assert.ok(declared.length > 0, 'the plan job declares no outputs, so the check would pass vacuously');
  for (const name of declared) {
    assert.ok(KIT_PLAN_OUTPUTS.includes(name), `the plan job declares ${name}, which kit-ci-plan does not write`);
  }
});

test('the shared job runs its PHP setup when kit-ci-plan reports shared_php', () => {
  assert.match(workflow, /if: \$\{\{ needs\.plan\.outputs\.shared_php == 'true' \}\}/);
});
