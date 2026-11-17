// PIE downloads the prebuilt polyspec_json extension from GitHub, and in CI it failed with `Could not authenticate against
// github.com` when it ran without a token (C19.121). The recipe of crudui-install-json-php gives PIE the GITHUB_TOKEN of the
// workflow as the github-oauth of COMPOSER_AUTH, and both workflows pass GITHUB_TOKEN to every job.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const makefile = readFileSync(`${ROOT}/Makefile`, 'utf8');
const recipe = makefile.slice(makefile.indexOf('crudui-install-json-php: install-pie'));

test('the json install gives PIE the GitHub token of the environment as github-oauth', () => {
  assert.match(recipe.split('\n').slice(0, 8).join('\n'), /GITHUB_TOKEN/);
  assert.match(recipe.split('\n').slice(0, 8).join('\n'), /COMPOSER_AUTH/);
  assert.match(recipe.split('\n').slice(0, 8).join('\n'), /github-oauth/);
});

for (const workflow of ['ci.yml', 'ci-pipeline.yml']) {
  test(`${workflow} passes GITHUB_TOKEN to its jobs`, () => {
    const text = readFileSync(`${ROOT}/.github/workflows/${workflow}`, 'utf8');
    assert.match(text, /^env:\n {2}GITHUB_TOKEN: \$\{\{ github\.token \}\}$/m);
  });
}
