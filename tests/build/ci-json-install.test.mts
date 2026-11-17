// The jobs whose targets load the polyspec_json extension that POLYSPEC_JSON_MODULE names install it before those targets:
// the validator-php job runs crudui-test-php-source, the runtime-tests job runs crudui-test-runtimes (PHPUnit with the
// extension of the generator), and the cross-check-console job runs the manifest test of ButtonsConformanceTest, which passes
// --php-extension "$POLYSPEC_JSON_MODULE", and the form-comparison job runs the PHP servers, which refuse to load without the
// extension (`The JSON extension polyspec_json is not loaded`, C19.126). A job that runs such a target without the install gets
// an empty module path.
import assert from 'node:assert/strict';
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
