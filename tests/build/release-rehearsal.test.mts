// C19.162: each CI run rehearses the release before any tag exists (orm T628, the release-rehearsal job). The job runs
// make ci-release-rehearsal, which runs every step of ci-release-publish before its first GitHub write (release-go-module-push,
// release-publish) with no tag, and rehearses each Go module with rehearse-go-module-<component> (binding release-go-module
// --rehearsal, which makes no commit and no tag and pushes nothing). The job reads the repository only, and ci-passed needs it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const text = (file: string): string => readFileSync(`${ROOT}/${file}`, 'utf8');

function job(workflow: string, name: string): string {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `ci.yml has no job ${name}`);
  const rest = workflow.slice(start + 1);
  const end = rest.slice(1).search(/\n  [a-z][a-z-]*:\n/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

test('each CI run rehearses the release job with read-only permissions, after the assets (C19.162)', () => {
  const workflow = text('.github/workflows/ci.yml');
  const rehearsal = job(workflow, 'release-rehearsal');
  assert.match(rehearsal, /\n    needs: \[[^\]]*\bassets\b[^\]]*\]/, 'job release-rehearsal runs after the job assets');
  assert.match(rehearsal, /\n    permissions:\n      contents: read\n/, 'job release-rehearsal reads the repository only, so it can write nothing');
  assert.match(rehearsal, /run: make ci-release-rehearsal\n/, 'job release-rehearsal runs make ci-release-rehearsal');
  assert.match(job(workflow, 'ci-passed'), /\n    needs: \[[^\]]*\brelease-rehearsal\b[^\]]*\]/, 'ci-passed needs release-rehearsal');
});

test('ci-release-rehearsal runs the steps of ci-release-publish before its first GitHub write, in one ci-targets call (C19.162)', () => {
  const makefile = text('Makefile');
  const recipe = makefile.match(/^ci-release-rehearsal:[^\n]*\n((?:\t.*\n)+)/m)?.[1] ?? '';
  assert.notEqual(recipe, '', 'the Makefile has a recipe ci-release-rehearsal');
  const targets = recipe.match(/ci-targets TARGETS="([^"]+)"/)?.[1]?.split(/\s+/) ?? [];
  for (const step of ['release-zip', 'release-prepare', 'release-tools', 'release-candidate-assets', 'release-merge-platform', 'crudui-install-crates', 'release-recipes'])
    assert.ok(targets.includes(step), `ci-release-rehearsal runs ${step} through ci-targets`);
  assert.ok(recipe.includes('rehearse-go-module-$(c)'), 'ci-release-rehearsal rehearses each Go module of BINDING_COMPONENTS');
  for (const forbidden of ['release-go-module-push', 'release-publish', 'release-undraft', 'release-platform-assets', 'release-tag'])
    assert.ok(!targets.includes(forbidden) && !recipe.includes(forbidden), `ci-release-rehearsal must not run ${forbidden}`);
  assert.match(makefile, /^ci-release-rehearsal: export TAG = v\$\(RELEASE_REHEARSAL_VERSION\)$/m, 'the rehearsal exports the rehearsal tag');
});
