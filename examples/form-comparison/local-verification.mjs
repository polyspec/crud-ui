// The verification of the form comparison against one local stack built from this checkout
// (docs/operations/form-comparison.md, "Local verification"): the record servers run as local processes
// on ports of 127.0.0.1 that the system assigns, the checks run against them in stages, the
// evidence is checked, and the servers stop. Usage:
//   node examples/form-comparison/local-verification.mjs [--results /absolute/results]
//     [--servers php,php-ext,go,rust | --browser-reports /absolute/reports]
// Without `--results` the reports go to a directory of the run under the system temporary
// directory, which is removed after a passing run and kept, with its path printed, after a failure.
// `--servers` selects the browser checks of those servers and runs only them. `--browser-reports`
// runs every other check and takes the browser report of each server from that directory, which
// runs with `--servers` wrote. Every server of a run takes a port of the system, so runs at the
// same time do not collide; the browser summary requires the scheme and host of its own origin in
// every browser report, whose port is that of the run that wrote it.
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { exampleDirectory, repositoryRoot, startLocalStack } from './src/local-servers.mjs';
import { formServers } from './src/runtime-paths.mjs';
import { runAsEntryPoint } from './src/entry-point.mjs';
import { sameSourceIdentity } from './src/source-identity.mjs';
import { sourceIdentity } from './src/source-tree.mjs';
import { formatDuration, runStages } from './src/step-runner.mjs';
import { createProgress } from '@polyspec/kit/test-progress';
import { verifyEvidence } from './verification-evidence.mjs';

/** One check of the verification: a step that runs to its end and prints its progress. */
/** The run-tests tool of kit, which runs the PHPUnit suite of the PHP server. */
const phpRunTests = fileURLToPath(import.meta.resolve('@polyspec/kit/run-tests'));

function check(id, args, environment = {}) {
  return { id, command: process.execPath, args, cwd: exampleDirectory, environment };
}

/**
 * Every check of one verification run against the local stack at `origin`, in execution order.
 * The steps of one stage run at the same time. A check is a long operation: it runs to its end
 * without a time limit and prints its progress; the units inside the pipeline and browser checks
 * keep their own limits. The four browser checks run at the same time: each drives its own browser
 * process and its own server's records. The typing check edits the PHP records of the frames, so
 * it runs after them. With `servers` the run has only the browser checks of those servers; with
 * `browserReports` it has every other check, and the browser summary reads the reports that runs
 * with `servers` wrote.
 */
export function verificationStages({ origin, results, data, prepared, library = repositoryRoot, servers, browserReports = false }) {
  const resultsEnvironment = { FORM_COMPARISON_RESULTS: results };
  const browser = server => check(`browser-${server}`, ['--test', 'check.mjs'],
    { ...resultsEnvironment, FORM_COMPARISON_SERVER: server, FORM_COMPARISON_ORIGIN: origin });
  if (servers !== undefined) {
    assert.equal(browserReports, false, 'A run checks the browsers of its servers or reads their reports, not both');
    return [selectedServers(servers).map(browser)];
  }
  return [
    // The PHPUnit suite of the PHP server in the php mode, with the JSON module of this run loaded into the PHP of
    // PHPUnit; its group modules starts the processor modes with the modules of this run.
    [check('php-modes', [phpRunTests, 'phpunit', '--php-extension', prepared.jsonModule,
      '--cwd', 'examples/form-comparison/servers/php'], {
      FORM_PHP_SERVER: 'php',
      FORM_PHP_NATIVE_AUTOLOAD: prepared.nativePhpAutoload,
      POLYSPEC_JSON_MODULE: prepared.jsonModule,
      FORM_CRUDUI_MODULE: prepared.cruduiModule,
    })],
    // The same suite in the php-ext mode: the run-tests of kit loads the JSON and CRUDUI modules into the PHP of
    // PHPUnit (K165), and the suite runs as in the php mode. It shares the cache
    // directory of PHPUnit with the php mode, so it runs after it.
    [check('php-ext-mode', [phpRunTests, 'phpunit',
      '--php-extension', prepared.jsonModule, '--php-extension', prepared.cruduiModule,
      '--cwd', 'examples/form-comparison/servers/php'], {
      COMPOSER: prepared.nativeComposerManifest,
      COMPOSER_VENDOR_DIR: prepared.nativeComposerVendor,
      FORM_PHP_AUTOLOAD: prepared.nativePhpAutoload,
      FORM_PHP_NATIVE_AUTOLOAD: prepared.nativePhpAutoload,
      FORM_PHP_SERVER: 'php-ext',
      POLYSPEC_JSON_MODULE: prepared.jsonModule,
      FORM_CRUDUI_MODULE: prepared.cruduiModule,
    })],
    [check('generation', ['check-generation.mjs', '--url', origin,
      '--library', library, '--report', path.join(results, 'generation.json')])],
    [check('persistence', ['check-servers.mjs', '--origin', origin, '--data', data,
      '--report', path.join(results, 'server-report.json')])],
    [check('pipeline', ['--test', 'check-pipeline.mjs'], {
      FORM_PIPELINE_ORIGIN: origin, FORM_PIPELINE_REPORT: path.join(results, 'pipeline.json'),
    })],
    ...browserReports ? [] : [formServers.map(browser)],
    [check('browser-summary', ['check-browser-reports.mjs',
      '--results', results, '--origin', origin,
      '--source', path.join(results, 'source.json'),
      '--report', path.join(results, 'browser-summary.json')])],
    [check('typing', ['check-typing.mjs', origin], resultsEnvironment)],
  ];
}

/** The servers of `--servers`: a comma-separated list of distinct form servers, at least one. */
export function selectedServers(list) {
  const servers = Array.isArray(list) ? list : String(list).split(',').map(server => server.trim());
  assert.ok(servers.length > 0 && servers.every(server => formServers.includes(server)),
    `--servers names one or more of ${formServers.join(', ')}`);
  assert.equal(new Set(servers).size, servers.length, '--servers names each server once');
  return servers;
}

/** Copy the browser report of each server from `directory` into `results` for the browser summary. */
export async function takeBrowserReports(directory, results) {
  for (const server of formServers) {
    await copyFile(path.join(directory, `report-${server}.json`), path.join(results, `report-${server}.json`));
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    results: { type: 'string' }, servers: { type: 'string' },
    'browser-reports': { type: 'string' },
  } });
  assert.ok(values.results === undefined || path.isAbsolute(values.results), '--results must be an absolute path');
  const browserReports = values['browser-reports'];
  assert.ok(browserReports === undefined || path.isAbsolute(browserReports), '--browser-reports must be an absolute path');
  assert.ok(values.servers === undefined || browserReports === undefined, '--servers and --browser-reports exclude each other');
  const servers = values.servers === undefined ? undefined : selectedServers(values.servers);
  assert.ok(servers === undefined || values.results !== undefined, '--servers keeps its reports in --results');
  const startedAt = new Date().toISOString();
  const startedClock = performance.now();
  const root = await mkdtemp(path.join(tmpdir(), 'crudui-verification-'));
  const results = values.results ?? path.join(root, 'results');
  await mkdir(results, { recursive: true });
  for (const entry of await readdir(results)) await rm(path.join(results, entry), { recursive: true, force: true });
  if (browserReports !== undefined) await takeBrowserReports(browserReports, results);
  const processes = [];
  // Every stage step is one test of the shared progress lines; a stage with a failed step ends the run.
  const lines = createProgress({ write: text => process.stdout.write(text) });
  let passed = false;
  try {
    lines.start('local stack', { group: true });
    let stack;
    try {
      stack = await startLocalStack({ root, processes });
    } catch (error) {
      lines.fail('local stack', undefined, error.message);
      throw error;
    }
    lines.pass('local stack');
    await writeFile(path.join(results, 'source.json'), JSON.stringify(stack.source, null, 2) + '\n');
    const checks = [];
    for (const stage of verificationStages({
      origin: stack.origin, results, data: stack.dataDirectory, prepared: stack.prepared,
      servers, browserReports: browserReports !== undefined,
    })) {
      for (const step of stage) lines.start(step.id);
      const stageResults = await runStages([stage], { label: 'verification' });
      for (const result of stageResults) {
        if (result.status === 'passed') lines.pass(result.id, result.durationMs);
        else lines.fail(result.id, result.durationMs, `${result.id} ${result.status}`);
      }
      checks.push(...stageResults);
      if (stageResults.some(result => result.status !== 'passed')) break;
    }
    process.stdout.write(`[verification] checks: ${checks.map(result =>
      `${result.id} ${result.status} ${formatDuration(result.durationMs)}`).join(', ')}\n`);
    const failed = checks.find(result => result.status !== 'passed');
    if (failed) throw new Error(`Verification check ${failed.id} ${failed.status} after ${formatDuration(failed.durationMs)}`);
    if (servers !== undefined) {
      // The browser summary and the evidence of these reports are the checks of the run with --browser-reports.
      process.stdout.write(`Browser checks passed for ${servers.join(', ')} at ${stack.origin}; their reports are in ${results}\n`);
      passed = true;
      return;
    }
    lines.start('evidence');
    const after = await sourceIdentity(repositoryRoot);
    assert.ok(sameSourceIdentity(after, stack.source), 'The repository changed during verification; verify it again');
    let evidence;
    try {
      evidence = await verifyEvidence(results);
    } catch (error) {
      lines.fail('evidence', undefined, error.message);
      throw error;
    }
    lines.pass('evidence');
    const durationMs = performance.now() - startedClock;
    await writeFile(path.join(results, 'verification.json'), JSON.stringify({
      source: stack.source, startedAt, completedAt: new Date().toISOString(), durationMs, passed: true, checks, evidence,
    }, null, 2) + '\n');
    process.stdout.write(`Verification passed for ${JSON.stringify(stack.source)} in ${formatDuration(durationMs)}: `
      + `${evidence.generation.results} generation, ${evidence.persistence.results} persistence, `
      + `${evidence.pipeline.combinations} canonical flow, ${evidence.browser.checks} browser and `
      + `${evidence.typing.results} typing results\n`);
    passed = true;
  } finally {
    await Promise.all(processes.map(running => running.stop()));
    lines.close('verification', { exitCode: passed ? 0 : 1, requireTests: true });
    if (passed) await rm(root, { recursive: true, force: true });
    else process.stderr.write(`[verification] the reports of this run remain in ${results}\n`);
  }
}

runAsEntryPoint(import.meta.url, main);
