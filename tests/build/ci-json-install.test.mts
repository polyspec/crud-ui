// The jobs whose targets load the polyspec_json extension that POLYSPEC_JSON_MODULE names install it before those targets:
// the validator-php job runs crudui-test-php-source, the runtime-tests job runs crudui-test-runtimes (PHPUnit with the
// extension of the generator), and the cross-check-console job runs the manifest test of ButtonsConformanceTest, which passes
// --php-extension "$POLYSPEC_JSON_MODULE". A job that runs such a target without the install gets an empty module path.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

for (const job of ['ci-validator-php', 'ci-runtime-tests', 'ci-cross-check-console']) {
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
