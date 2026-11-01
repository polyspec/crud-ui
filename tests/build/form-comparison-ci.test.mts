import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { parse } from 'yaml';

// The browser matrix of examples/form-comparison/src/runtime-paths.mjs, whose formServers lists its servers.
import matrix from '../../examples/form-comparison/src/runtime-paths.json' with { type: 'json' };
import { checked, readManifest, script, type JTDSchemaType } from '../json.mts';
import { makeDryRun } from './make-dry-run.mts';

const repository = path.resolve(import.meta.dirname, '../..');

/** The parts of a GitHub Actions workflow job that the checks read. */
interface Step { run?: string; uses?: string; if?: string; with?: Record<string, unknown> }
interface Job {
  steps: Step[];
  env: Record<string, string>;
  /** A job id or a list of them. */
  needs?: unknown;
  strategy?: { matrix: { server: string[] }; 'fail-fast'?: boolean };
}
const jobSchema: JTDSchemaType<Job> = {
  properties: {
    steps: {
      elements: {
        optionalProperties: { run: { type: 'string' }, uses: { type: 'string' }, if: { type: 'string' }, with: { values: {} } },
        additionalProperties: true,
      },
    },
    env: { values: { type: 'string' } },
  },
  optionalProperties: {
    needs: {},
    strategy: {
      properties: { matrix: { properties: { server: { elements: { type: 'string' } } }, additionalProperties: true } },
      optionalProperties: { 'fail-fast': { type: 'boolean' } },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
};

function workflowJob(source: string, name: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex(line => line === `  ${name}:`);
  assert.notEqual(start, -1, `CI must define the ${name} job`);
  const endOffset = lines.slice(start + 1).findIndex(line => /^ {2}[a-z0-9-]+:$/.test(line));
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
  return lines.slice(start, end).join('\n');
}

test('CI runs the complete form comparison regression suite', async () => {
  const workflow = await readFile(path.join(repository, '.github/workflows/ci.yml'), 'utf8');
  const job = workflowJob(workflow, 'form-comparison');

  assert.match(job, /runs-on:\s*ubuntu-24\.04/);
  assert.match(job, /uses: actions\/checkout@/);
  // The kit bootstrap action sets the Node.js of mise.toml up and installs the npm and the packages (kit K992).
  assert.match(job, /uses: \.\/\.github\/actions\/kit-bootstrap\n/);
  assert.match(job, /uses: shivammathur\/setup-php@/);
  assert.match(job, /php-version-file:\s*\.php-version\n/);
  assert.match(job, /run: make crudui-install-composer\n/);
  assert.match(job, /run: make ci-targets TARGETS="crudui-test-form-comparison"\n/);
});

test('CI builds and runs the five record stores and the canonical flow', async () => {
  const workflow = await readFile(path.join(repository, '.github/workflows/ci.yml'), 'utf8');
  const job = workflowJob(workflow, 'form-comparison-pipeline');
  // The test runner bounds each test; the job has no time limit over them (test-commands.test.mts).
  assert.doesNotMatch(job, /^ {4}timeout-minutes:/m);
  assert.match(job, /uses: shivammathur\/setup-php@/);
  // setup-php installs PHP alone; make install-tools installs the Go and the Composer of mise.toml (kit K127).
  assert.match(job, /tools: phpize, php-config\n/);
  // make install-tools installs the Rust toolchain of rust-toolchain.toml too (kit K151).
  assert.match(job, /run: make install-tools TOOLS="node go rust php composer"\n/);
  assert.doesNotMatch(job, /install-rust/);
  // The Rust record server builds from the OrderedJSON checkout, which make crudui-install-crates installs before the crates.
  assert.match(job, /run: make crudui-install-crates\n/);
  assert.match(job, /workspaces: examples\/form-comparison\/servers\/rust/);
  assert.match(job, /uses: \.\/\.github\/actions\/kit-bootstrap\n/);
  assert.match(job, /run: make crudui-install-composer\n/);
  assert.match(job, /run: make ci-targets TARGETS="crudui-test-form-comparison-pipeline"\n/);
  const pipeline = script(readManifest(path.join(repository, 'package.json')), 'test:form-comparison:pipeline');
  assert.match(pipeline, /examples\/form-comparison\/record-stores\.test\.mjs/);
  assert.match(pipeline, /examples\/form-comparison\/pipeline\.browser\.mjs/);
  // The Go and Rust server tests need the OrderedJSON checkout the record-store test prepares.
  const order = ['record-stores.test.mjs', 'go --cwd examples/form-comparison/servers/go',
    'examples/form-comparison/servers/rust/Cargo.toml', 'pipeline.browser.mjs']
    .map(part => pipeline.indexOf(part));
  assert.ok(order.every((index, position) => index >= 0 && order.slice(0, position).every(earlier => earlier < index)), String(order));
});

test('CI runs the browser checks of each form server in a job of its own and every other check once after them', async () => {
  const workflow = checked<{ jobs: Record<string, unknown> }>(parse(await readFile(path.join(repository, '.github/workflows/ci.yml'), 'utf8')),
    { properties: { jobs: { values: {} } }, additionalProperties: true }, '.github/workflows/ci.yml');
  const browserJob = workflow.jobs['form-comparison-browser'];
  const summaryJob = workflow.jobs['form-comparison-checks'];
  assert.ok(browserJob && summaryJob, 'CI must define the form-comparison-browser and form-comparison-checks jobs');
  const browser = checked(browserJob, jobSchema, 'the job form-comparison-browser');
  const summary = checked(summaryJob, jobSchema, 'the job form-comparison-checks');
  const run = (job: Job) => job.steps.map(step => step.run).filter(command => /^make ci-targets\b/.test(command ?? ''));
  // One job per server of the browser matrix, each with the runner to itself.
  assert.deepEqual(browser.strategy?.matrix.server, [...matrix.servers]);
  assert.equal(browser.strategy?.['fail-fast'], false);
  assert.equal(browser.env.FORM_SERVERS, '${{ matrix.server }}');
  assert.deepEqual(run(browser), ['make ci-targets TARGETS="crudui-test-form-comparison-browser"']);
  const upload = browser.steps.find(step => step.with?.path === 'var/form-comparison/browser');
  assert.ok(upload, 'the browser job uploads var/form-comparison/browser');
  assert.deepEqual({ if: upload.if, name: upload.with?.name, missing: upload.with?.['if-no-files-found'] },
    { if: '${{ !cancelled() }}', name: 'form-comparison-browser-${{ matrix.server }}', missing: 'error' });
  // The summary job follows the job kit (S12) and all four, reads their reports and runs every other check of the verification.
  assert.deepEqual(summary.needs, ['kit', 'form-comparison-browser']);
  assert.equal(summary.strategy, undefined);
  const download = summary.steps.find(step => String(step.uses ?? '').startsWith('actions/download-artifact@'));
  assert.ok(download, 'the summary job downloads the browser reports');
  assert.deepEqual(download.with, { pattern: 'form-comparison-browser-*', path: 'var/form-comparison/browser', 'merge-multiple': true });
  assert.ok(summary.steps.indexOf(download) < summary.steps.findIndex(step => step.run === run(summary)[0]));
  assert.deepEqual(run(summary), ['make ci-targets TARGETS="crudui-test-form-comparison-summary"']);
  for (const job of [browser, summary]) {
    assert.ok(job.steps.some(step => step.with?.tools === 'phpize, php-config'), 'phpize and php-config of the PHP of the job');
    assert.ok(job.steps.some(step => step.run === 'make crudui-install-crates'));
  }
  // Both parts share one report directory, and each run takes ports of the system, so runs at the same time do not collide.
  const dryRun = (target: string) => makeDryRun(repository, target);
  const browserRun = dryRun('crudui-test-form-comparison-browser');
  const summaryRun = dryRun('crudui-test-form-comparison-summary');
  assert.equal(browserRun.status, 0, browserRun.stderr);
  assert.equal(summaryRun.status, 0, summaryRun.stderr);
  const reports = path.join(repository, 'var/form-comparison/browser');
  assert.match(browserRun.stdout, new RegExp(`run test:form-comparison:checks -- --servers php,php-ext,go,rust --results ${reports}$`, 'm'));
  assert.match(summaryRun.stdout, new RegExp(`run test:form-comparison:checks -- --browser-reports ${reports}$`, 'm'));
  for (const run of [browserRun, summaryRun]) assert.doesNotMatch(run.stdout, /--address|FORM_ADDRESS/);
});

test('the native PHP job installs phpize and php-config for the PHP of .php-version', async () => {
  const workflow = await readFile(path.join(repository, '.github/workflows/ci.yml'), 'utf8');
  const job = workflowJob(workflow, 'php-api');

  assert.match(job, /php-version-file:\s*\.php-version\n/);
  assert.match(job, /tools: phpize, php-config\n/);
  assert.doesNotMatch(job, /PHP_EXTENSION_PHP_CONFIG/);
});

test('native job caches the generator packages and the programs that run them', async () => {
  const workflow = await readFile(path.join(repository, '.github/workflows/ci.yml'), 'utf8');
  const job = workflowJob(workflow, 'cross-language-equivalence');
  // The Go module cache is keyed on the go.mod files of the generator and its programs (hashFiles of actions/cache).
  for (const entry of ['packages/generator/go/go.mod', 'tests/native-generators/programs/go/go.mod']) {
    assert.ok(job.includes(`'${entry}'`), entry);
  }
  for (const entry of ['packages/generator/rust', 'tests/native-generators/programs/rust']) {
    assert.match(job, new RegExp(`^\\s+${entry.replaceAll('.', '\\.')}$`, 'm'), entry);
  }
});

test('native report upload uses the current Node.js 24 artifact action', async () => {
  const workflow = await readFile(path.join(repository, '.github/workflows/ci.yml'), 'utf8');
  for (const name of ['php-engine', 'native-generators', 'php-api']) {
    const job = workflowJob(workflow, name);
    const versions = [...job.matchAll(/uses:\s*actions\/upload-artifact@([^\n]+)/g)]
      .flatMap(match => (match[1] === undefined ? [] : [match[1].trim()]));

    assert.ok(versions.length > 0, `The native job ${name} uploads its report`);
    assert.deepEqual(versions.filter(version => !/^[0-9a-f]{40} # v7\.\d+\.\d+$/.test(version)), []);
  }
});

test('browser CI jobs run the sandboxed Chrome that puppeteer pins', async () => {
  const workflow = await readFile(path.join(repository, '.github/workflows/ci.yml'), 'utf8');
  const failures: string[] = [];
  for (const name of ['form-runtime', 'form-comparison', 'form-comparison-pipeline', 'form-comparison-browser', 'form-comparison-checks', 'package-browser', 'native-generators']) {
    const job = workflowJob(workflow, name);
    if (!/PUPPETEER_CACHE_DIR:\s*\$\{\{ github\.workspace \}\}\/\.tools\/puppeteer\n/.test(job)) failures.push(`${name}: the cache of Puppeteer is not .tools/puppeteer of the checkout`);
    if (!/CHROME_DEVEL_SANDBOX:\s*\/usr\/local\/sbin\/chrome-devel-sandbox\n/.test(job)) failures.push(`${name}: CHROME_DEVEL_SANDBOX does not name the installed helper`);
    if (/PUPPETEER_EXECUTABLE_PATH|PUPPETEER_SKIP_DOWNLOAD/.test(job)) failures.push(`${name}: selects a browser outside the pinned build`);
    const install = job.search(/run:\s*make crudui-install-browsers BROWSERS="chrome\b[^\n]*--chrome-sandbox"/);
    const preflight = job.search(/run:\s*make check-ci-browser(?:\s|$)/);
    if (install === -1) failures.push(`${name}: missing installation of the pinned Chrome with its sandbox helper`);
    if (preflight === -1 || preflight < install) failures.push(`${name}: missing sandboxed Chrome preflight after the installation`);
    if (/--no-sandbox|--disable-setuid-sandbox/.test(job)) {
      failures.push(`${name}: disables the Chrome sandbox`);
    }
  }
  for (const file of ['tests/widget-scripts.test.mts', 'tests/form-styles.test.mts', 'tests/widget-script-runs.test.mts', 'tests/browser-engines.mts', 'packages/form-binding/tests/browser.test.ts']) {
    const checks = await readFile(path.join(repository, file), 'utf8');
    if (/--no-sandbox|--disable-setuid-sandbox/.test(checks)) {
      failures.push(`${file}: disables the Chrome sandbox`);
    }
  }
  assert.deepEqual(failures, []);
});

test('release-mode stacks take OrderedJSON from the packages.json repository while local stacks use source providers (C18.10-8, K865)', async () => {
  const manifest = await readFile(path.join(repository, 'composer.json'), 'utf8');
  assert.match(manifest, /"type": "composer",\s*"url": "https:\/\/github\.com\/polyspec\/ordered-json\/releases\/download\/v\d+\.\d+\.\d+\/packages\.json"/);
  for (const target of ['crudui-test-form-comparison-pipeline', 'crudui-test-form-comparison-browser', 'crudui-test-form-comparison-summary', 'crudui-test-form-comparison-checks']) {
    const release = makeDryRun(repository, target, { variables: ['LOCAL=0'] });
    assert.equal(release.status, 0, release.stderr);
    assert.doesNotMatch(release.stdout, /\/release-assets\.(?:mts|mjs) fetch\b/, `${target} takes no release archive of its own`);
    const local = makeDryRun(repository, target, { variables: ['LOCAL=1'] });
    assert.equal(local.status, 0, local.stderr);
    assert.doesNotMatch(local.stdout, /\/release-assets\.(?:mts|mjs) fetch\b/);
  }
});
