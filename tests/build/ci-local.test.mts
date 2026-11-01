import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { checkedShape, shapeOf } from '../../scripts/json-schema.mts';
import { makeTargets } from '../../scripts/test-commands.mts';

const isRecord = shapeOf<Record<string, unknown>>({ type: 'object' });
const STRINGS = shapeOf<string[]>({ type: 'array', items: { type: 'string' } });
const strings = (value: unknown, what: string): string[] => checkedShape(STRINGS, value, what);
import { checked, parseJson, type JTDSchemaType } from '../json.mts';
import { kitToolPath, makeDryRun, makeEnvironment } from './make-dry-run.mts';
import { isVendored } from '../../scripts/repository-files.mts';
// The bootstrap action that kit-sync vendors (kit K992): it sets the Node.js of mise.toml up, installs the locked kit package
// with the npm of devEngines.packageManager, then the npm of var/tools and the packages of package-lock.json.
const KIT_BOOTSTRAP = './.github/actions/kit-bootstrap';
const kitBootstrap = (step: Step): boolean => step.uses === KIT_BOOTSTRAP;

const read = (file: string): Promise<string> => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The inputs of a workflow step (`with:`) that these tests read. */
interface StepInputs { path?: string; name?: string; key?: string; cache?: string; pattern?: string; 'if-no-files-found'?: string }
/** A step of a GitHub Actions job. */
interface Step { name?: string; run?: string; uses?: string; if?: string; with?: StepInputs }
/** A job of a GitHub Actions workflow; needs is a job id or a list of them. */
interface Job {
  name?: string; if?: string; needs?: unknown; 'runs-on'?: string; steps?: Step[]; strategy?: { matrix?: { php?: string[]; shard?: string[] }; 'fail-fast'?: boolean };
  env?: Record<string, string>;
  environment?: { name?: string };
}
/** A GitHub Actions workflow as `yaml` parses it; on and concurrency are compared as they are parsed. */
interface Workflow { on?: unknown; concurrency?: unknown; jobs: Record<string, Job> }

const stepSchema: JTDSchemaType<Step> = {
  optionalProperties: {
    name: { type: 'string' }, run: { type: 'string' }, uses: { type: 'string' }, if: { type: 'string' },
    with: {
      optionalProperties: {
        path: { type: 'string' }, name: { type: 'string' }, key: { type: 'string' }, cache: { type: 'string' }, pattern: { type: 'string' },
        'if-no-files-found': { type: 'string' },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
};
const workflowSchema: JTDSchemaType<Workflow> = {
  properties: {
    jobs: {
      values: {
        optionalProperties: {
          name: { type: 'string' }, if: { type: 'string' }, needs: {}, 'runs-on': { type: 'string' }, steps: { elements: stepSchema },
          strategy: { optionalProperties: { matrix: { optionalProperties: { php: { elements: { type: 'string' } }, shard: { elements: { type: 'string' } } }, additionalProperties: true }, 'fail-fast': { type: 'boolean' } }, additionalProperties: true },
          env: { values: { type: 'string' } },
          environment: { optionalProperties: { name: { type: 'string' } }, additionalProperties: true },
        },
        additionalProperties: true,
      },
    },
  },
  optionalProperties: { on: {}, concurrency: {} },
  additionalProperties: true,
};

/** The workflow `.github/workflows/<name>`, checked against the fields that these tests read. */
const workflowFile = async (name: string): Promise<Workflow> =>
  checked(parse(await read(`.github/workflows/${name}`)), workflowSchema, `.github/workflows/${name}`);

/** The job `id` of `workflow`. */
function jobOf(workflow: Workflow, id: string): Job {
  const job = workflow.jobs[id];
  assert.ok(job, `the workflow has the job ${id}`);
  return job;
}

/** The value of `key` of the parsed object `value`; undefined for a value that is no object. */
function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}


/** Jobs that invoke make before one unconditional run of the kit bootstrap action. */
export function kitBootstrapViolations(workflow: Workflow): string[] {
  const findings: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    const steps = job.steps ?? [];
    const firstMake = steps.findIndex(step => /(?:^|\n)\s*make(?:\s|$)/.test(step.run ?? ''));
    if (firstMake < 0) continue;
    const installs = steps.map((step, index) => ({ step, index })).filter(({ step }) => kitBootstrap(step));
    const install = installs[0];
    if (installs.length !== 1 || !install) findings.push(`${id}: expected one step that uses ${KIT_BOOTSTRAP}`);
    else if (install.step.if !== undefined) findings.push(`${id}: the kit bootstrap must be unconditional`);
    else if (install.index >= firstMake) findings.push(`${id}: the kit bootstrap must precede the first make`);
  }
  return findings;
}

test('each make job runs the kit bootstrap action before make (K992)', async () => {
  const bootstrap = { uses: KIT_BOOTSTRAP };
  assert.deepEqual(kitBootstrapViolations({ jobs: {
    missing: { steps: [{ run: 'make install-tools' }] },
    late: { steps: [{ run: 'make install-tools' }, bootstrap] },
    other: { steps: [{ uses: './.github/actions/other' }, { run: 'make install-tools' }] },
    conditional: { steps: [{ ...bootstrap, if: '${{ success() }}' }, { run: 'make install-tools' }] },
    duplicate: { steps: [bootstrap, bootstrap, { run: 'make install-tools' }] },
    valid: { steps: [bootstrap, { run: 'make install-tools' }] },
    deployment: { steps: [{ uses: 'actions/deploy-pages@x' }] },
  } }), [
    `missing: expected one step that uses ${KIT_BOOTSTRAP}`,
    'late: the kit bootstrap must precede the first make',
    `other: expected one step that uses ${KIT_BOOTSTRAP}`,
    'conditional: the kit bootstrap must be unconditional',
    `duplicate: expected one step that uses ${KIT_BOOTSTRAP}`,
  ]);
  let jobs = 0;
  for (const file of ['ci.yml', 'pages.yml']) {
    const workflow = await workflowFile(file);
    jobs += Object.values(workflow.jobs).filter(job => job.steps?.some(step => /(?:^|\n)\s*make(?:\s|$)/.test(step.run ?? ''))).length;
    assert.deepEqual(kitBootstrapViolations(workflow), [], file);
  }
  assert.ok(jobs > 0, 'the kit bootstrap selection checks at least one make job');
});

// Steps that prepare a runner rather than check the repository.
const preparation = [
  /^make(?: (?:crudui-)?install-[\w-]+)+(?: [A-Z]+="[^"]*")?$/,
  /^make check-ci-browser$/,
  /^make kit-install-(?:php-arginfo|symbols)(?: EXTRACTORS="[^"]+")?$/,
  /^sudo apt-get install -y --no-install-recommends nginx$/,
  /^php-fpm -v$/,
  /^nginx -v$/,
];

/** The checking commands of the workflow, in job and step order. */
export function workflowCommands(workflow: Workflow): string[] {
  const commands: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    // The completion job reads the results of the other jobs and checks no part of the tree.
    if (id === 'ci-passed') continue;
    for (const step of job.steps ?? []) {
      if (typeof step.run !== 'string') continue;
      for (const line of step.run.split('\n').map((text) => text.trim()).filter(Boolean)) {
        for (const command of line.split(' && ')) {
          // make ci-targets runs each target of TARGETS as make -k <target> (ci-targets of @polyspec/kit).
          const targets = /^make ci-targets TARGETS="([^"]+)"$/.exec(command);
          if (targets?.[1] !== undefined) commands.push(...targets[1].split(' ').map((target) => `make ${target}`));
          else if (!preparation.some((pattern) => pattern.test(command))) commands.push(command);
        }
      }
    }
  }
  return commands;
}

/** The commands of CI_TARGETS: a make target for each word. */
export function makeCommands(makefile: string): string[] {
  const block = makefile.match(/^CI_TARGETS = \\\n((?:\t[\w-]+(?: \\)?\n)+)/m);
  assert.ok(block?.[1] !== undefined, 'the Makefile declares CI_TARGETS');
  return block[1].trim().split('\n').map((line) => `make ${line.trim().replace(/ \\$/, '')}`);
}

// A release requires the check ci-passed of the tagged commit: the last job of the CI workflow needs every other job, runs
// after a failed, cancelled or skipped one, and fails unless each of them succeeded.
test('the last CI job ci-passed needs every other job and runs always', async () => {
  const workflow = await workflowFile('ci.yml');
  const ids = Object.keys(workflow.jobs);
  assert.equal(ids.at(-1), 'ci-passed', 'ci-passed is the last job of .github/workflows/ci.yml');
  const job = jobOf(workflow, 'ci-passed');
  assert.equal(job.name, undefined, 'the check carries the job id ci-passed');
  assert.equal(job.if, '${{ always() }}');
  assert.deepEqual(job.needs, ids.slice(0, -1));
  assert.equal(job['runs-on'], 'ubuntu-24.04');
  assert.deepEqual((job.steps ?? []).filter((step) => step.run !== undefined && !/^make (?:install-tools|install-packages)\b/.test(step.run)).map((step) => step.run),
    ["make ci-passed RESULTS='${{ toJSON(needs) }}'"]);
});

test('runtime checks run in four independent CI shards with separate reports (C18.9)', async () => {
  const workflow = await workflowFile('ci.yml');
  const job = jobOf(workflow, 'runtime-tests');
  assert.deepEqual(job.strategy?.matrix?.shard, ['1', '2', '3', '4']);
  assert.equal(job.strategy?.['fail-fast'], false);
  assert.equal(job.needs, 'kit');
  assert.equal(job.env?.CRUDUI_TEST_SHARD, '${{ matrix.shard }}/4');
  assert.deepEqual((job.steps ?? []).flatMap(step => step.run?.startsWith('make ci-targets ') ? [step.run] : []),
    ['make ci-targets TARGETS="crudui-test-runtimes"']);
  const upload = (job.steps ?? []).find(step => step.with?.path === 'var/report/ci-targets');
  assert.equal(upload?.with?.name, 'report-runtime-tests-${{ matrix.shard }}');
  const artifacts = (job.strategy?.matrix?.shard ?? []).map(shard => upload?.with?.name?.replaceAll('${{ matrix.shard }}', shard));
  assert.equal(new Set(artifacts).size, 4);
  assert.ok(artifacts.every(name => name !== undefined && !name.includes('/')));
  assert.equal(strings(jobOf(workflow, 'ci-passed').needs, 'CI completion dependencies').includes('runtime-tests'), true);
  assert.equal((jobOf(workflow, 'build-lint').steps ?? []).some(step => step.run?.includes('TARGETS="crudui-test-runtimes')), false);
});

test('the runtime script passes native Node sharding only when requested (C18.9)', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'crudui-runtime-shard-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'node'), `#!${process.execPath}\nprocess.stdout.write(JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
  const manifest = parseJson<{ scripts: Record<string, string> }>(await read('package.json'), { properties: { scripts: { values: { type: 'string' } } }, additionalProperties: true }, 'package.json');
  const command = manifest.scripts['test:runtimes'];
  assert.ok(command);
  const environment: NodeJS.ProcessEnv = { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH ?? ''}` };
  delete environment.CRUDUI_TEST_SHARD;
  const args = (shard?: string): string[] => {
    const result = spawnSync('/bin/sh', ['-c', command], { cwd: ROOT, env: { ...environment, ...(shard === undefined ? {} : { CRUDUI_TEST_SHARD: shard }) }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return strings(JSON.parse(result.stdout), 'runtime command arguments');
  };
  const plain = args();
  assert.equal(plain.some(argument => argument.startsWith('--test-shard=')), false);
  const files = plain.filter(argument => argument.startsWith('tests/'));
  assert.ok(files.length > 4);
  for (const shard of ['1/4', '2/4', '3/4', '4/4']) {
    const selected = args(shard);
    assert.deepEqual(selected.filter(argument => argument.startsWith('--test-shard=')), [`--test-shard=${shard}`]);
    assert.deepEqual(selected.filter(argument => argument.startsWith('tests/')), files);
  }
});

// Native unit suites run separately from the cross-language comparison job.
const NATIVE_JOBS: Record<string, { targets: string; tools: string[]; php?: string[] }> = {
  'php-engine': { targets: 'crudui-test-php-engine', tools: ['actions/checkout', KIT_BOOTSTRAP] },
  'native-generators': { targets: 'crudui-test-generator-js', tools: ['actions/checkout', KIT_BOOTSTRAP] },
  'cross-language-equivalence': { targets: 'crudui-test-cross-language-equivalence', tools: ['actions/checkout', KIT_BOOTSTRAP, 'shivammathur/setup-php', 'Swatinem/rust-cache'] },
  'php-api': { targets: 'crudui-test-php-api', tools: ['actions/checkout', KIT_BOOTSTRAP, 'shivammathur/setup-php'] },
};

test('native unit suites and cross-language comparisons each run once', async () => {
  const workflow = await workflowFile('ci.yml');
  for (const [id, expected] of Object.entries(NATIVE_JOBS)) {
    const job = jobOf(workflow, id);
    const steps = job.steps ?? [];
    assert.deepEqual(steps.map((step) => step.run).filter((run) => /^make ci-targets\b/.test(run ?? '')), [`make ci-targets TARGETS="${expected.targets}"`], id);
    const tools = steps.map((step) => String(step.uses ?? '').split('@')[0])
      .filter((uses) => uses && !['actions/upload-artifact', 'actions/cache'].includes(uses));
    assert.deepEqual(tools, expected.tools, id);
    assert.deepEqual(job.strategy?.matrix?.php, expected.php, id);
  }
  const run = makeDryRun(ROOT, 'crudui-test-native');
  assert.equal(run.status, 0, run.stderr);
  const commands = run.stdout.split('\n');
  for (const command of [
    /^\/\S+\/var\/tools\/bin\/node tests\/conformance\/run-suite\.mts node -- packages\/php-ext\/tests\/engine\/engine\.test\.mjs packages\/php-ext\/tests\/contract\/\*\.test\.mjs packages\/php-ext\/tests\/comparison\/comparison\.test\.mjs$/,
    /^\/\S+\/var\/tools\/bin\/node tests\/native-generators\/run\.mts --target javascript,html,go,rust,python --report "[^"]+report\.json" \|\| status=1; \\$/,
    /^\/\S+\/var\/tools\/bin\/node tests\/native-generators\/run\.mts --extension "[^"]+crudui\.so" --target php,php-native --report "[^"]+report-php\.json" \|\| status=1; \\$/,
  ]) assert.equal(commands.filter((line) => command.test(line.trim())).length, 1, `${command}\n${run.stdout}`);
});

// Each job preserves its conformance evidence under a name of its own, and the conformance job downloads each artifact
// into a directory of its own, so no evidence file of one job replaces a file of another.
test('every evidence artifact has a name of its own and the conformance job reads each from its own directory', async () => {
  const workflow = await workflowFile('ci.yml');
  const uploads = Object.entries(workflow.jobs).flatMap(([id, job]) => (job.steps ?? [])
    .filter((step) => step.with?.path === 'conformance-evidence/')
    .flatMap((step) => (job.strategy?.matrix?.php ?? [undefined])
      .map((php) => ({ id, name: php === undefined ? step.with?.name : step.with?.name?.replaceAll('${{ matrix.php }}', php) }))));
  const names = uploads.map((upload) => upload.name);
  assert.equal(new Set(names).size, names.length, names.join(', '));
  assert.ok(names.every((name) => name !== undefined && /^conformance-evidence-[\w.-]+$/.test(name)), names.join(', '));
  const conformance = jobOf(workflow, 'conformance');
  const needs = strings(conformance.needs, 'needs of the conformance job').filter((id) => id !== 'kit');
  assert.deepEqual([...needs].sort(), [...new Set(uploads.map((upload) => upload.id))].sort());
  const download = (conformance.steps ?? []).find((step) => String(step.uses ?? '').startsWith('actions/download-artifact@'));
  assert.deepEqual(download?.with, { pattern: 'conformance-evidence-*', path: 'conformance-evidence' });
});

// The cache of setup-node saved the npm directory of the job that finished first under the key of package-lock.json,
// also of a job that installs no npm package, so every later job restored an empty directory. A job that installs the
// npm packages restores and saves ~/.npm with actions/cache under the key of package-lock.json before it installs npm;
// a job that installs none caches nothing.
const NPM_CACHE = { path: '~/.npm', key: "npm-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('package-lock.json') }}" };

/** The jobs of a workflow whose npm cache differs from that rule, as `job: problem`. */
export function npmCacheViolations(workflow: Workflow): string[] {
  const violations: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    const steps = job.steps ?? [];
    const uses = (prefix: string): Step[] => steps.filter((step) => String(step.uses ?? '').startsWith(prefix));
    for (const step of uses('actions/setup-node@')) if (step.with?.cache !== undefined) violations.push(`${id}: setup-node caches ${step.with.cache}`);
    const caches = uses('actions/cache@').filter((step) => step.with?.path === NPM_CACHE.path);
    // The kit bootstrap action installs the npm of var/tools and the packages of package-lock.json (kit K992).
    const installs = steps.some((step) => kitBootstrap(step) || /^make (?:[\w-]+ )*install-packages\b/.test(String(step.run ?? '')));
    if (!installs) {
      if (caches.length) violations.push(`${id}: caches ~/.npm without installing the npm packages`);
      continue;
    }
    const [cache] = caches;
    if (caches.length !== 1 || cache === undefined) { violations.push(`${id}: installs the npm packages without one cache of ~/.npm`); continue; }
    if (cache.with?.key !== NPM_CACHE.key) violations.push(`${id}: the npm cache key is ${cache.with?.key}`);
    const npm = steps.findIndex((step) => kitBootstrap(step) || /^make (?:[\w-]+ )*install-tools\b/.test(String(step.run ?? '')) || /^make (?:[\w-]+ )*install-packages\b/.test(String(step.run ?? '')));
    if (steps.indexOf(cache) > npm) violations.push(`${id}: the npm cache is restored after npm installs`);
  }
  return violations;
}

test('a job that installs the npm packages caches ~/.npm by package-lock.json, and setup-node caches nothing', async () => {
  const cache = { uses: 'actions/cache@x', with: NPM_CACHE };
  assert.deepEqual(npmCacheViolations({ jobs: {
    a: { steps: [{ uses: 'actions/setup-node@x', with: { cache: 'npm' } }, { run: 'make install-tools' }] },
    b: { steps: [{ run: 'make install-tools' }, { run: 'make install-packages crudui-install-composer' }] },
    c: { steps: [{ run: 'make install-tools' }, cache, { run: 'make install-packages' }] },
    d: { steps: [cache, { run: 'make crudui-install-composer' }] },
    e: { steps: [{ uses: 'actions/cache@x', with: { ...NPM_CACHE, key: 'npm' } }, { run: 'make install-packages' }] },
    f: { steps: [cache, { run: 'make install-tools' }, { run: 'make install-packages' }] },
    g: { steps: [{ uses: KIT_BOOTSTRAP }, cache] },
    h: { steps: [cache, { uses: KIT_BOOTSTRAP }] },
  } }), [
    'a: setup-node caches npm',
    'b: installs the npm packages without one cache of ~/.npm',
    'c: the npm cache is restored after npm installs',
    'd: caches ~/.npm without installing the npm packages',
    'e: the npm cache key is npm',
    'g: the npm cache is restored after npm installs',
  ]);
  const violations: string[] = [];
  // release.yml is the copy of kit, which follows the rules of kit.
  for (const file of ['ci.yml', 'pages.yml']) {
    violations.push(...npmCacheViolations(await workflowFile(file)).map((line) => `${file} ${line}`));
  }
  assert.deepEqual(violations, []);
});

test('CI_TARGETS lists every checking command of the CI workflow, in the same order', async () => {
  const workflow = workflowCommands(await workflowFile('ci.yml'));
  const local = makeCommands(await read('Makefile'));
  assert.ok(workflow.length > 10, 'the workflow has checking commands');
  assert.deepEqual(local, workflow);
});

test('CI builds public JavaScript entries before dependency checks and validator tests (C18.10-3)', async () => {
  const workflow = workflowCommands(await workflowFile('ci.yml'));
  const build = workflow.indexOf('make build');
  assert.ok(build >= 0, 'the public entries are built');
  const validator = makeDryRun(ROOT, 'crudui-test-validator-js');
  assert.equal(validator.status, 0, validator.stderr);
  const lines = validator.stdout.split('\n');
  const prepare = lines.findIndex(line => line.endsWith('/var/tools/bin/node scripts/require-current-build.mts'));
  const suite = lines.findIndex(line => line.endsWith('/var/tools/bin/npm test -w @polyspec/crudui-validator'));
  assert.ok(prepare >= 0 && suite > prepare, 'the validator source suite prepares the public entries it imports');
});

test('Pages prepares dependencies through existing native install targets (C18.10-8)', async () => {
  const job = jobOf(await workflowFile('pages.yml'), 'docs-web');
  const installs = (job.steps ?? []).flatMap(step => /^make (?:crudui-)?install-(?:composer|go-modules|phpdocumentor|crates)$/.test(step.run ?? '') ? [step.run] : []);
  const expected = ['crudui-install-composer', 'crudui-install-go-modules', 'crudui-install-phpdocumentor', 'crudui-install-crates'];
  assert.deepEqual(installs, expected.map(target => `make ${target}`));
  const database = makeDryRun(ROOT, 'help', { database: true });
  assert.equal(database.status, 0, database.stderr);
  const targets = makeTargets(database.stdout);
  for (const target of expected) {
    const rule = targets[target];
    assert.ok(rule, `${target}: expected a declared preparation target`);
    assert.ok(rule.commands.some(command => command.trim() !== '') || rule.prerequisites.length > 0,
      `${target}: expected native preparation commands or prerequisites`);
  }
});

// A recipe of the Makefile starts a tool of kit as $(KIT)/<tool>.mjs; the installed package has to ship it, or the target
// fails with a missing module instead of its own error.
test('every tool of kit that the Makefile starts is in the installed @polyspec/kit', async () => {
  const makefile = await read('Makefile');
  const tools = [...new Set([...makefile.matchAll(/\$\(KIT\)\/([\w-]+)\.\$\(KIT_EXT\)/g)].map((match) => match[1] ?? ''))].sort();
  assert.ok(tools.length > 0, 'the Makefile starts tools of kit');
  assert.deepEqual(tools.filter((tool) => !existsSync(kitToolPath(tool))), []);
});

// The CI build-lint job runs crudui-lint, the ESLint of the Svelte components (C17.91-1); make lint also runs kit's lint task,
// which runs lint-<runtime> of every runtime, and no CI job runs it (K870).

test('a CI install takes OrderedJSON only from its installed packages: no clone and no link of its checkout (C18.17)', () => {
  // S15: CRUDUI knows OrderedJSON through the packages that composer.json, package.json, go.mod and Cargo.toml install, never
  // through a source tree of the other repository; a local checkout is linked only by make link from .links.
  for (const target of ['install-packages', 'crudui-install-composer', 'release-prepare']) {
    const run = makeDryRun(ROOT, target, { env: { ...process.env, GITHUB_ACTIONS: 'true' } });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stdout, /git clone|npm link|\$\(NPM\) link| link --no-save|local-providers/, target);
  }
  // The S5 rule of the path repositories of composer.json names no checkout of another repository as an exception.
  assert.doesNotMatch(readFileSync(path.join(ROOT, 'config/layout.yml'), 'utf8'), /\.\.\/ordered-json/);
});

test('a CI job runs no kit task that repeats the shared gates: build-lint runs the Svelte lint, and kit\'s lint task runs in no job (K870, C17.91)', async () => {
  const workflow = workflowCommands(await workflowFile('ci.yml'));
  const runs = (target: string): boolean => workflow.some(command => new RegExp(`TARGETS="[^"]*\\b${target}\\b`).test(command) || command === `make ${target}`);
  assert.equal(runs('crudui-lint'), true, 'a CI job runs the Svelte lint');
  // kit's lint task runs lint-<runtime> for every runtime, which repeats the TypeScript gate of kit's pipeline (K870).
  assert.equal(runs('lint'), false, 'no CI job runs the lint task of kit');
  assert.deepEqual(['lint-python', 'lint-php', 'lint-rust', 'lint-go', 'lint-ts', 'docs-check'].filter(target => runs(target)), []);
});

/** The steps that run a checking command without `if: ${{ !cancelled() }}`, as `job: step`. */
export function stepsStoppedByFailure(workflow: Workflow): string[] {
  const violations: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.run !== 'string') continue;
      if (workflowCommands({ jobs: { [id]: { steps: [step] } } }).length === 0) continue;
      if (String(step.if ?? '').replace(/\s+/g, ' ').trim() !== '${{ !cancelled() }}') {
        violations.push(`${job.name ?? id}: ${step.name ?? step.run}`);
      }
    }
  }
  return violations;
}

// The programs that a workflow step starts only through a make target, whose recipes start them with the offline
// settings, $(NPM) and the toolchains of the checkout (docs/operations/testing.md).
const THROUGH_MAKE = new Set(['node', 'npm', 'npx', 'cargo', 'go', 'php', 'composer', 'rustup', 'python3', 'sh']);

/** The commands of the steps of a workflow that start a program of THROUGH_MAKE without make, as `job: step: command`. */
export function stepsOutsideMake(workflow: Workflow): string[] {
  const violations: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.run !== 'string') continue;
      for (const command of step.run.split(/\n|&&|\|\||;|\|/).map(text => text.trim()).filter(Boolean)) {
        const words = command.split(/\s+/).filter(word => !/^[A-Z_][A-Z0-9_]*=/.test(word));
        while (['sudo', 'env', 'xvfb-run', 'time'].includes(words[0] ?? '')) words.shift();
        if (THROUGH_MAKE.has(words[0] ?? '')) violations.push(`${job.name ?? id}: ${step.name ?? step.run}: ${command}`);
      }
    }
  }
  return violations;
}

test('a workflow step starts every tool through a make target', async () => {
  assert.deepEqual(stepsOutsideMake({ jobs: { a: { steps: [
    { name: 'install', run: 'node scripts/kit/install-tools.mjs\necho "$PWD" >> "$GITHUB_PATH"' },
    { name: 'test', run: 'FOO=1 xvfb-run npm test && make lint' },
    { name: 'nginx', run: 'sudo apt-get install -y nginx\nphp-fpm -v && nginx -v' },
  ] } } }), ['a: install: node scripts/kit/install-tools.mjs', 'a: test: FOO=1 xvfb-run npm test']);
  const violations: string[] = [];
  // release.yml is the copy of kit, which follows the rules of kit.
  for (const file of ['ci.yml', 'pages.yml']) {
    violations.push(...stepsOutsideMake(await workflowFile(file)).map(line => `${file} ${line}`));
  }
  assert.deepEqual(violations, []);
});

/**
 * The jobs of a workflow that run a check outside make ci-targets, or run checks without uploading their report under
 * `if: ${{ !cancelled() }}` with `if-no-files-found: error`, as `job: problem`.
 */
export function jobsWithoutReport(workflow: Workflow): string[] {
  const violations: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    const steps = job.steps ?? [];
    const runners = steps.filter((step) => /^make ci-targets TARGETS="[^"]+"$/.test(String(step.run ?? '').trim()));
    for (const step of steps) {
      if (typeof step.run !== 'string' || runners.includes(step)) continue;
      if (workflowCommands({ jobs: { [id]: { steps: [step] } } }).length) violations.push(`${id}: ${step.name ?? step.run} runs a check outside make ci-targets`);
    }
    const last = runners.at(-1);
    if (last === undefined) continue;
    const index = steps.indexOf(last);
    const upload = steps.slice(index + 1).find((step) => String(step.uses ?? '').startsWith('actions/upload-artifact@') && step.with?.path === 'var/report/ci-targets');
    if (!upload) violations.push(`${id}: uploads no report of var/report/ci-targets after its checks`);
    else {
      if (String(upload.if ?? '').replace(/\s+/g, ' ').trim() !== '${{ !cancelled() }}') violations.push(`${id}: the report upload does not run after a failure`);
      if (upload.with?.['if-no-files-found'] !== 'error') violations.push(`${id}: the report upload does not fail without a report`);
    }
  }
  return violations;
}

test('every job runs its checks through make ci-targets and uploads their report', async () => {
  assert.deepEqual(jobsWithoutReport({ jobs: {
    a: { steps: [{ run: 'make install-tools' }, { run: 'make lint', if: '${{ !cancelled() }}' }] },
    b: { steps: [{ run: 'make ci-targets TARGETS="lint"', if: '${{ !cancelled() }}' }] },
    c: { steps: [{ run: 'make ci-targets TARGETS="lint"' }, { uses: 'actions/upload-artifact@x', if: 'always()', with: { path: 'var/report/ci-targets' } }] },
    d: { steps: [{ run: 'make ci-targets TARGETS="lint"' }, { uses: 'actions/upload-artifact@x', if: '${{ !cancelled() }}', with: { path: 'var/report/ci-targets', 'if-no-files-found': 'error' } }] },
  } }), [
    'a: make lint runs a check outside make ci-targets',
    'b: uploads no report of var/report/ci-targets after its checks',
    'c: the report upload does not run after a failure',
    'c: the report upload does not fail without a report',
  ]);
  const violations: string[] = [];
  for (const file of ['ci.yml', 'pages.yml']) {
    const workflow = await workflowFile(file);
    violations.push(...jobsWithoutReport(workflow).map((line) => `${file} ${line}`));
    // The report artifact of each job, and of each matrix entry, has a name of its own.
    const names = Object.values(workflow.jobs).flatMap((job) => (job.steps ?? [])
      .filter((step) => step.with?.path === 'var/report/ci-targets').map((step) => step.with?.name));
    assert.equal(new Set(names).size, names.length, `${file}: report names ${names.join(', ')}`);
  }
  assert.deepEqual(violations, []);
});

// The runners are few: a new push to a pull request stops the CI run of its previous push. A merge group has a ref of its
// own and its run is never stopped, and the push check runs on every pushed commit and keeps its runs.
test('no run of a commit of main is stopped by a later push', async () => {
  assert.deepEqual((await workflowFile('ci.yml')).concurrency, {
    group: '${{ github.workflow }}-${{ github.ref }}', 'cancel-in-progress': false,
  });
  assert.deepEqual((await workflowFile('pages.yml')).concurrency, { group: 'github-pages', 'cancel-in-progress': false });
});

// main receives a push of the maintainer while the version is 0.x: CI runs on a push to main and on a manual run, and the
// documentation web is built and deployed from main and on a manual run. The other workflows are the copies of kit
// (ci-pipeline.yml, release.yml), which kit-check holds equal to the installed kit, so their triggers are the rules of kit.
// No other workflow of this repository exists, and each declares exactly these lines.
const TRIGGERS = {
  'ci.yml': 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:\n',
  'pages.yml': 'on:\n  push:\n    branches: [main]\n  workflow_dispatch:\n',
};

test('each workflow declares exactly its triggers', async () => {
  const names = (await readdir(new URL('../../.github/workflows/', import.meta.url)))
    .filter(name => /\.ya?ml$/.test(name) && !isVendored(`.github/workflows/${name}`)).sort();
  assert.deepEqual(names, Object.keys(TRIGGERS).sort());
  for (const [name, block] of Object.entries(TRIGGERS)) {
    const declared = /^on:\n(?: .*\n)+/m.exec(await read(`.github/workflows/${name}`))?.[0] ?? '';
    assert.equal(declared, block, `.github/workflows/${name}`);
  }
});

test('CI runs on a push to main, the push check on every push, and Pages deploys main', async () => {
  assert.deepEqual((await workflowFile('ci.yml')).on, { push: { branches: ['main'] }, workflow_dispatch: null });
  const pages = await workflowFile('pages.yml');
  assert.deepEqual(pages.on, { push: { branches: ['main'] }, workflow_dispatch: null });
  const deploy = jobOf(pages, 'deploy');
  assert.equal(deploy.environment?.name, 'github-pages');
  assert.equal(deploy.needs, 'docs-web');
  assert.doesNotMatch(await read('.github/workflows/ci.yml'), /refs\/heads\/main|deploy-pages|upload-pages-artifact/);
});

test('every checking step of the CI workflow runs after an earlier failure', async () => {
  const violations = stepsStoppedByFailure(await workflowFile('ci.yml'));
  assert.deepEqual(violations, []);
});

test('a checking step that a failure skips is reported by job and step', () => {
  const violations = stepsStoppedByFailure({
    jobs: {
      a: {
        name: 'build',
        steps: [
          { uses: 'actions/checkout@v6' },
          { name: 'Install', run: 'make install-packages' },
          { name: 'Test', run: 'make test-x' },
          { name: 'Lint', run: 'make lint', if: '${{ !cancelled() }}' },
          { run: 'make typecheck', if: 'success()' },
        ],
      },
    },
  });
  assert.deepEqual(violations, ['build: Test', 'build: make typecheck']);
});

test('a workflow command missing from CI_TARGETS is reported', () => {
  const workflow = workflowCommands({
    jobs: {
      a: { steps: [{ run: 'make install-packages crudui-install-composer' }, { run: 'make lint' }] },
      b: { steps: [{ run: 'make test-x && make test-y' }] },
    },
  });
  assert.deepEqual(workflow, ['make lint', 'make test-x', 'make test-y']);
  const local = makeCommands('CI_TARGETS = \\\n\tlint \\\n\ttest-x\n');
  assert.notDeepEqual(local, workflow);
});

// A tag push starts every workflow whose push trigger has no branch filter. The release verifies that the checks named in
// config/release.json succeeded for the tagged commit, so a workflow that creates such a check on a tag push leaves a run
// that has not completed, and the release fails against it. Every workflow of this repository that has a push trigger starts
// on branch pushes only; the release is the copy of kit.
test('no workflow of this repository starts on a tag push', async () => {
  const violations: string[] = [];
  for (const name of (await readdir(new URL('../../.github/workflows/', import.meta.url))).filter(file => /\.ya?ml$/.test(file) && !isVendored(`.github/workflows/${file}`))) {
    const on = (await workflowFile(name)).on;
    if (!isRecord(on) || !Object.hasOwn(on, 'push')) continue;
    // A push without filters parses as null.
    const tags = field(on['push'], 'tags'), branches = field(on['push'], 'branches'), tagsIgnore = field(on['push'], 'tags-ignore');
    if (!Array.isArray(branches) || branches.length === 0) violations.push(`${name}: push has no branch filter, so a tag push starts it`);
    if (tags || tagsIgnore) violations.push(`${name}: push names tags`);
  }
  assert.deepEqual(violations, []);
  // kit 0.0.79 releases by the run id of ci.yml, so config/release.json names no check (K911).
  const release: unknown = JSON.parse(await read('config/release.json'));
  assert.ok(isRecord(release));
  assert.equal(Object.hasOwn(release, 'checks'), false);
});

// make install-packages runs the svelte tools after its npm ci (INSTALL_PACKAGES_EXTRA, kit K428) and links nothing: make
// install links after install-packages through install-link. The tools of packages/svelte then install without a link of their own.
test('install-packages installs the svelte tools after its npm ci and runs no link', () => {
  const run = makeDryRun(ROOT, 'install-packages');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /crudui-install-svelte-tools/, 'install-packages runs the svelte tools');
  assert.doesNotMatch(run.stdout, /link\.mjs|--no-print-directory link/, 'install-packages runs no link');
  const svelte = makeDryRun(ROOT, 'crudui-install-svelte-tools');
  assert.equal(svelte.status, 0, svelte.stderr);
  assert.match(svelte.stdout, /npm ci --prefix packages\/svelte\/tools/);
  assert.doesNotMatch(svelte.stdout, /link\.mjs|--no-print-directory link/, 'the svelte tools link nothing themselves');
  const database = makeDryRun(ROOT, 'help', { database: true });
  assert.equal(database.status, 0, database.stderr);
  const targets = makeTargets(database.stdout);
  assert.ok(targets['install-packages']?.prerequisites.includes('hooks'), 'dependency installation prepares the repository hooks');
  assert.deepEqual(targets.hooks?.commands.filter(command => command.trim() !== ''), ['$(NODE) $(KIT)/git-hooks.$(KIT_EXT) install']);
});

// Both native link entry points use the Python environment prepared for this checkout.
test('install-link links into the venv of var/python', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'crudui-link-venv-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const probe = path.join(directory, 'environment.mjs');
  await writeFile(probe, `
if (process.argv.includes('--make-targets')) {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, process.argv.slice(2), { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
console.log(JSON.stringify({ venv: process.env.UV_PROJECT_ENVIRONMENT }));
`);
  const quote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`;
  for (const target of ['install-link', 'link']) {
    const result = spawnSync('make', ['--silent', '--no-print-directory', target, `NODE=${quote(process.execPath)} ${quote(probe)}`], {
      cwd: ROOT, encoding: 'utf8', timeout: 5_000,
      env: makeEnvironment({ ...process.env, UV_PROJECT_ENVIRONMENT: path.join(directory, 'foreign-venv') }),
    });
    assert.equal(result.error, undefined, `${target}: ${result.error?.message ?? ''}`);
    assert.equal(result.status, 0, result.stderr);
    const report = parseJson<{ venv: string }>(result.stdout, { properties: { venv: { type: 'string' } } }, `${target} process environment`);
    assert.equal(report.venv, path.join(ROOT, 'var/python'), target);
  }
});


test('cross-language generator equivalence runs independently of language unit jobs', async () => {
  const workflow = await workflowFile('ci.yml');
  const comparison = jobOf(workflow, 'cross-language-equivalence');
  assert.equal(comparison.needs, 'kit');
  assert.ok((comparison.steps ?? []).some(step => step.run === 'make ci-targets TARGETS="crudui-test-cross-language-equivalence"'));
  for (const target of ['crudui-test-generator-js', 'crudui-test-generator-go', 'crudui-test-generator-rust', 'crudui-test-php-api']) {
    const run = makeDryRun(ROOT, target);
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stdout, /tests\/native-generators\/run\.mts --/);
  }
  const run = makeDryRun(ROOT, 'crudui-test-cross-language-equivalence');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /--target javascript,html,go,rust,python/);
  assert.match(run.stdout, /--target php,php-native/);
  for (const id of ['conformance', 'ci-passed']) {
    assert.ok(strings(jobOf(workflow, id).needs, `${id} dependencies`).includes('cross-language-equivalence'));
  }
});


test('language jobs install only their required tools and own both validator and generator checks', async () => {
  const workflow = await workflowFile('ci.yml');
  const expected: Record<string, { tools: string; targets: string }> = {
    'validator-js': { tools: 'node', targets: 'crudui-test-validator-js' },
    'validator-go': { tools: 'node go', targets: 'crudui-test-validator-go crudui-test-generator-go' },
    'validator-rust': { tools: 'node rust', targets: 'crudui-test-validator-rust crudui-test-generator-rust' },
    python: { tools: 'node python uv', targets: 'crudui-test-validator-python crudui-test-generator-python' },
    'native-generators': { tools: 'node', targets: 'crudui-test-generator-js' },
  };
  for (const [id, contract] of Object.entries(expected)) {
    const job = jobOf(workflow, id);
    assert.equal(job.needs, 'kit', id);
    const commands = (job.steps ?? []).map(step => step.run);
    assert.ok(commands.includes(`make install-tools TOOLS="${contract.tools}"`), id);
    assert.ok(commands.includes(`make ci-targets TARGETS="${contract.targets}"`), id);
    assert.equal((job.steps ?? []).some(step => step.uses?.startsWith('shivammathur/setup-php@')), false, id);
  }
  for (const id of ['cli', 'form-runtime', 'package-browser', 'php-engine', 'conformance', 'ci-passed']) {
    const job = jobOf(workflow, id);
    assert.ok((job.steps ?? []).some(step => step.run === 'make install-tools TOOLS="node"'), id);
    assert.equal((job.steps ?? []).some(step => step.uses?.startsWith('shivammathur/setup-php@')), false, id);
  }
  for (const [id, job] of Object.entries(workflow.jobs)) {
    assert.equal((job.steps ?? []).some(step => step.run === 'make install-tools'), false, id);
    assert.equal((job.steps ?? []).some(step => /^make install(?:\s|$)/.test(step.run ?? '')), false, id);
  }
});


test('every application workflow declares a bounded tool installation scope', async () => {
  for (const file of ['ci.yml', 'pages.yml']) {
    const workflow = await workflowFile(file);
    for (const [id, job] of Object.entries(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        const run = step.run ?? '';
        assert.doesNotMatch(run, /(?:^|\n)\s*make install-tools\s*(?:\n|$)/, `${file} ${id}`);
        assert.doesNotMatch(run, /(?:^|\n)\s*make install\s*(?:\n|$)/, `${file} ${id}`);
      }
    }
  }
  const pages = jobOf(await workflowFile('pages.yml'), 'docs-web');
  assert.ok((pages.steps ?? []).some(step => step.run === 'make install-tools TOOLS="node go rust php composer"'));
});




