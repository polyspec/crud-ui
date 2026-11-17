// The jobs whose targets load the polyspec_json extension that POLYSPEC_JSON_MODULE names install it before those targets:
// the validator-php job runs crudui-test-php-source, the runtime-tests job runs crudui-test-runtimes (PHPUnit with the
// extension of the generator), and the cross-check-console job runs the manifest test of ButtonsConformanceTest, which passes
// --php-extension "$POLYSPEC_JSON_MODULE", and the form-comparison job runs the PHP servers, which refuse to load without the
// extension (`The JSON extension polyspec_json is not loaded`, C19.126). A job that runs such a target without the install gets
// an empty module path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

for (const job of ['ci-validator-php', 'ci-runtime-tests', 'ci-cross-check-console', 'ci-form-comparison']) {
  test(`${job} installs the polyspec_json extension before its targets run`, () => {
    const dry = makeDryRun(ROOT, job);
    assert.equal(dry.status, 0, dry.stderr);
    const lines = dry.stdout.split('\n');
    const install = lines.findIndex(line => line.includes('crudui-install-json-php'));
    const run = lines.findIndex(line => line.includes('ci-targets'));
    assert.notEqual(install, -1, `${job} does not install the polyspec_json extension\n${dry.stdout}`);
    assert.ok(install < run, dry.stdout);
  });
}

// C19.133: PIE installs the extension for the PHP that the job has on its PATH, so a job that downloads polyspec_json
// installs PHP first (the bindings job got /usr/bin/php8.3 from the runner, C19.133).
for (const job of ['ci-bindings', 'ci-validator-php', 'ci-runtime-tests', 'ci-cross-check-console', 'ci-form-comparison']) {
  test(`${job} installs php with its tools before it downloads polyspec_json (C19.133)`, () => {
    const lines = makeDryRun(ROOT, job).stdout.split('\n');
    // crudui-install-bindings depends on crudui-install-json-php, so its make line is the download step of the bindings job.
    const json = lines.findIndex(line => line.includes('crudui-install-json-php') || line.includes('crudui-install-bindings'));
    const tools = lines.findIndex(line => line.includes('install-tools') && /(^|[\s"])php([\s"]|$)/.test(line));
    assert.notEqual(json, -1, `${job} does not download polyspec_json`);
    assert.ok(tools !== -1 && tools < json, `${job} downloads polyspec_json without installing php first:\n${lines.join('\n')}`);
  });
}

// C19.134: the PHP servers of the form comparison load polyspec_json from the scan directory that php-json-scan writes,
// so each target that runs them sets PHP_INI_SCAN_DIR to it (the form-comparison job failed without it).
for (const target of ['crudui-test-form-comparison', 'crudui-test-form-comparison-checks', 'crudui-test-form-comparison-browser', 'crudui-test-form-comparison-summary']) {
  test(`${target} runs PHP with the polyspec_json scan directory (C19.134)`, () => {
    const dry = makeDryRun(ROOT, target);
    assert.equal(dry.status, 0, dry.stderr);
    assert.ok(dry.stdout.split('\n').some(line => line.includes('PHP_INI_SCAN_DIR=') && line.includes('var/php-ext/json-scan')), dry.stdout);
  });
}

// C19.138: install-tools php wraps the php that PATH names when it runs, so the bindings job sets up PHP 8.4 with setup-php before
// it (the branch run wrapped the runner's 8.3 and PIE downloaded for it). Every other job that installs php sets it up the same way.
test('the bindings job sets up PHP before its run step installs the PHP of the checkout (C19.138)', () => {
  const workflow = readFileSync(`${ROOT}/.github/workflows/ci.yml`, 'utf8');
  const start = workflow.indexOf('\n  bindings:\n');
  assert.notEqual(start, -1, 'ci.yml has no bindings job');
  const job = workflow.slice(start, workflow.indexOf('\n  python:\n', start));
  const setup = job.indexOf('shivammathur/setup-php');
  const run = job.indexOf('run: make ci-bindings');
  assert.notEqual(setup, -1, 'the bindings job has no setup-php step');
  assert.ok(setup < run, 'the bindings job runs make ci-bindings before its PHP is set up');
});

// C19.139: when PIE leaves no polyspec_json.so where POLYSPEC_JSON_MODULE looks, php-json-scan lists what PIE wrote, so that the
// run shows the layout of the install (the branch run failed without it, C19.139).
test('php-json-scan lists what PIE wrote when the module is missing (C19.139)', () => {
  const dry = makeDryRun(ROOT, 'php-json-scan');
  assert.equal(dry.status, 0, dry.stderr);
  assert.ok(dry.stdout.split('\n').some(line => line.includes('find ') && line.includes('var/bindings/deps/php')), dry.stdout);
});

// C19.141: php-json-scan finds polyspec_json.so when it runs, in the shell, not through the make variable POLYSPEC_JSON_MODULE,
// whose $(wildcard) make expands when the variable is read (a directory that PIE creates in the same make call may be unseen).
test('php-json-scan finds the module at run time, not through a make wildcard (C19.141)', () => {
  const makefile = readFileSync(`${ROOT}/Makefile`, 'utf8');
  const start = makefile.indexOf('\nphp-json-scan:');
  assert.notEqual(start, -1, 'Makefile has no php-json-scan recipe');
  const recipe = makefile.slice(start, makefile.indexOf('\n\n', start));
  assert.match(recipe, /find \$\(BINDING_PIE\) -path '\*\/vendor\/polyspec\/json\/polyspec_json\.so'/);
  assert.match(recipe, /printf 'extension=%s\\n' "\$\$\(find \$\(BINDING_PIE\) -path '\*\/vendor\/polyspec\/json\/polyspec_json\.so'/);
});

// C19.143: BINDING_PHP_EXTENSIONS finds polyspec_json.so with find at each expansion, not with $(wildcard), which make reads from
// a directory listing it has kept (the cause of the CI failure is the leader's hypothesis for C19.139, not confirmed here).
test('BINDING_PHP_EXTENSIONS finds the module with find at each expansion (C19.143)', () => {
  const makefile = readFileSync(`${ROOT}/Makefile`, 'utf8');
  const line = makefile.split('\n').find(l => l.startsWith('BINDING_PHP_EXTENSIONS ?='));
  assert.ok(line !== undefined, 'Makefile has no BINDING_PHP_EXTENSIONS definition');
  assert.match(line, /\$\(shell find \$\(BINDING_PIE\) -path '\*\/vendor\/polyspec\/json\/polyspec_json\.so'/);
  assert.doesNotMatch(line, /\$\(wildcard/);
});
