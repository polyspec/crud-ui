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

const isRecord = shapeOf<Record<string, unknown>>({ type: 'object' });
const STRINGS = shapeOf<string[]>({ type: 'array', items: { type: 'string' } });
const strings = (value: unknown, what: string): string[] => checkedShape(STRINGS, value, what);
import { checked, parseJson, type JTDSchemaType } from '../json.mts';
import { kitToolPath, makeDryRun, makeEnvironment } from './make-dry-run.mts';
// The bootstrap action of this repository: it sets the Node.js of mise.toml up, installs the locked kit package
// with the npm of devEngines.packageManager, then the npm of var/tools and the packages of package-lock.json.
const KIT_BOOTSTRAP = './.github/actions/kit-bootstrap';
const kitBootstrap = (step: Step): boolean => step.uses === KIT_BOOTSTRAP;

const read = (file: string): Promise<string> => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The inputs of a workflow step (`with:`) that these tests read. */
interface StepInputs { path?: string; name?: string; key?: string; cache?: string; pattern?: string; 'if-no-files-found'?: string }
/** A step of a GitHub Actions job. */
interface Step { name?: string; run?: string; uses?: string; if?: string; with?: StepInputs; env?: Record<string, string> }
/** A job of a GitHub Actions workflow; needs is a job id or a list of them. */
interface Job {
  name?: string; if?: string; needs?: unknown; uses?: string; 'runs-on'?: string; steps?: Step[]; strategy?: { matrix?: { php?: string[]; shard?: string[] }; 'fail-fast'?: boolean };
  env?: Record<string, string>;
  environment?: { name?: string };
}
/** A GitHub Actions workflow as `yaml` parses it; on and concurrency are compared as they are parsed. */
interface Workflow { on?: unknown; concurrency?: unknown; jobs: Record<string, Job> }

const stepSchema: JTDSchemaType<Step> = {
  optionalProperties: {
    name: { type: 'string' }, run: { type: 'string' }, uses: { type: 'string' }, if: { type: 'string' }, env: { values: { type: 'string' } },
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
          name: { type: 'string' }, if: { type: 'string' }, needs: {}, uses: { type: 'string' }, 'runs-on': { type: 'string' }, steps: { elements: stepSchema },
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

// Every workflow of the repository (C19.20). The recipe of a job is ci-<job>; a job of release.yml names its workflow before its
// job, ci-release-<job>, because its job names are also names of jobs of the other workflows.
const CI_WORKFLOWS = ['assets.yml', 'ci-pipeline.yml', 'ci.yml', 'pages.yml', 'release.yml'];
const RECIPE_PREFIX: Record<string, string> = { 'assets.yml': 'assets-', 'release.yml': 'release-' };
// The token of the run, which the release recipes give gh; it is the one variable a run step may set.
const TOKEN_ENV = { GH_TOKEN: '${{ github.token }}' };
// The plan job writes the outputs from which the matrix of the runtime jobs fans out; the judgement jobs read the results of
// the other jobs, which exist only in CI.
const PLAN_JOB = 'plan';
const PLAN_RUN = 'make kit-ci-plan';
const JUDGE_JOBS = new Set(['required', 'ci-passed']);
const JUDGE_RUN = /^make ci-passed RESULTS='\$\{\{ toJSON\(needs\) \}\}'(?: FAIL_SKIPPED=1)?$/;
// An argument of the run step of a job: NAME=value, NAME="words", or NAME=${{ matrix.<key> }} or NAME=${{ inputs.<key> }}, a
// parameter that the fan-out or the caller of the workflow gives the job.
const JOB_ARGUMENT = String.raw`[A-Z][A-Z0-9_]*=(?:[A-Za-z0-9_.,/-]+|"[A-Za-z0-9_.,/ -]+"|\$\{\{ (?:matrix|inputs)\.[A-Za-z0-9_-]+ \}\})`;

/**
 * The findings of the jobs of a workflow that CI runs, as `job: finding`: a job holds its content in a recipe of the Makefile, so
 * a job that runs steps has exactly one run step, `make ci-<job>` with arguments of JOB_ARGUMENT alone, the plan job `make
 * kit-ci-plan` and a judgement job `make ci-passed` with RESULTS of its needs; a run step has no condition and no environment,
 * and a job sets no environment of its own, which its recipe sets; every other step is a uses step, and only a uses step has a
 * condition. A job that calls a workflow, or whose every step is a uses step, runs no recipe.
 */
export function jobContentFindings(workflow: Workflow, prefix = ''): string[] {
  const findings: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    if (job.uses !== undefined) continue;
    const steps = job.steps ?? [];
    const runs = steps.filter(step => step.run !== undefined);
    if (runs.length !== 1 && !(runs.length === 0 && steps.length > 0)) findings.push(`${id}: has ${String(runs.length)} run steps, not one`);
    if (job.env !== undefined) findings.push(`${id}: sets the environment ${Object.keys(job.env).join(', ')}, which its recipe sets`);
    for (const step of steps) {
      if (step.run === undefined) {
        if (step.uses === undefined) findings.push(`${id}: a step is neither a run step nor a uses step`);
        continue;
      }
      const run = step.run.trim();
      const expected = id === PLAN_JOB ? run === PLAN_RUN : JUDGE_JOBS.has(id) ? JUDGE_RUN.test(run) : new RegExp(`^make ci-${prefix}${id}(?: ${JOB_ARGUMENT})*$`).test(run);
      if (!expected) findings.push(`${id}: the run step is not ${id === PLAN_JOB ? PLAN_RUN : JUDGE_JOBS.has(id) ? 'make ci-passed with RESULTS of its needs' : `make ci-${prefix}${id} with arguments NAME=value`}: ${run}`);
      if (step.if !== undefined) findings.push(`${id}: the run step has a condition`);
      if (/\bsudo\b/.test(run)) findings.push(`${id}: the run step runs sudo`);
      if (step.env !== undefined && JSON.stringify(step.env) !== JSON.stringify(TOKEN_ENV)) findings.push(`${id}: the run step sets an environment`);
    }
  }
  return findings;
}

test('a job of a workflow that CI runs has one run step, make ci-<job>, and its other steps are uses steps (C19.20)', () => {
  const checkout = { uses: 'actions/checkout@x' };
  assert.deepEqual(jobContentFindings({ jobs: {
    plan: { steps: [checkout, { run: 'make kit-ci-plan' }] },
    shared: { steps: [checkout, { uses: 'shivammathur/setup-php@x', if: "${{ contains(needs.plan.outputs.common_tools, 'php') }}" }, { run: 'make ci-shared' }, { uses: 'actions/upload-artifact@x', if: '${{ !cancelled() }}' }] },
    runtime: { steps: [checkout, { run: 'make ci-runtime RUNTIME=${{ matrix.runtime }}' }] },
    browser: { steps: [checkout, { run: 'make ci-browser FORM_SERVERS=${{ matrix.server }} BROWSERS="chrome firefox"' }] },
    token: { steps: [checkout, { run: 'make ci-token RUN=${{ inputs.run }}', env: { GH_TOKEN: '${{ github.token }}' } }] },
    deploy: { steps: [{ uses: 'actions/deploy-pages@x' }] },
    kit: { uses: './.github/workflows/ci-pipeline.yml' },
    required: { steps: [checkout, { run: "make ci-passed RESULTS='${{ toJSON(needs) }}'" }] },
    'ci-passed': { steps: [checkout, { run: "make ci-passed RESULTS='${{ toJSON(needs) }}' FAIL_SKIPPED=1" }] },
  } }), []);
  assert.deepEqual(jobContentFindings({ jobs: {
    two: { steps: [{ run: 'make install-tools TOOLS="node"' }, { run: 'make ci-two', if: '${{ !cancelled() }}' }] },
    none: { steps: [] },
    shell: { steps: [{ run: 'sudo apt-get install -y nginx\nphp-fpm -v' }] },
    expression: { steps: [{ run: 'make ci-expression TARGETS="kit-gates-runtime-${{ matrix.runtime }}"' }] },
    joined: { steps: [{ run: "make ci-joined TOOLS=${{ join(matrix.installTools, ' ') }}" }] },
    environment: { env: { CRUDUI_TEST_SHARD: '${{ matrix.shard }}/4' }, steps: [{ run: 'make ci-environment', env: { A: '1' } }] },
    root: { steps: [{ run: 'make ci-root BAY="sudo -n bay"' }] },
    named: { steps: [{ with: { name: 'x' } }, { run: 'make ci-named' }] },
    plan: { steps: [{ run: 'make ci-plan' }] },
    required: { steps: [{ run: 'make ci-passed FAIL_SKIPPED=1' }] },
  } }), [
    'two: has 2 run steps, not one',
    'two: the run step is not make ci-two with arguments NAME=value: make install-tools TOOLS="node"',
    'two: the run step has a condition',
    'none: has 0 run steps, not one',
    'shell: the run step is not make ci-shell with arguments NAME=value: sudo apt-get install -y nginx\nphp-fpm -v',
    'shell: the run step runs sudo',
    'expression: the run step is not make ci-expression with arguments NAME=value: make ci-expression TARGETS="kit-gates-runtime-${{ matrix.runtime }}"',
    "joined: the run step is not make ci-joined with arguments NAME=value: make ci-joined TOOLS=${{ join(matrix.installTools, ' ') }}",
    'environment: sets the environment CRUDUI_TEST_SHARD, which its recipe sets',
    'environment: the run step sets an environment',
    'root: the run step runs sudo',
    'named: a step is neither a run step nor a uses step',
    'plan: the run step is not make kit-ci-plan: make ci-plan',
    'required: the run step is not make ci-passed with RESULTS of its needs: make ci-passed FAIL_SKIPPED=1',
  ]);
  assert.deepEqual(jobContentFindings({ jobs: { tag: { steps: [checkout, { run: 'make ci-tag' }] }, publish: { steps: [{ run: 'make ci-release-publish' }] } } }, 'release-'), [
    'tag: the run step is not make ci-release-tag with arguments NAME=value: make ci-tag',
  ]);
});

// No recipe of a job runs sudo or changes a setting of the machine (C19.20): the action runner-setup sets the machine up before
// the run step. The dry run of each recipe, with every call of make that it prints, holds no sudo.
test('no recipe of a job runs sudo (C19.20)', async () => {
  let recipes = 0;
  for (const file of CI_WORKFLOWS) {
    for (const job of Object.values((await workflowFile(file)).jobs)) {
      const run = runOf(job);
      if (run === undefined || !run.startsWith('make ci-') || run.startsWith('make ci-passed')) continue;
      const [, target, ...variables] = run.split(/ (?=[A-Z][A-Z0-9_]*=|[a-z])/);
      const dry = makeDryRun(ROOT, String(target), { env: { ...process.env, GITHUB_ENV: '/dev/null', TAG: 'v0.0.1' }, variables: variables.map(variable => variable.replace(/^([A-Z][A-Z0-9_]*)="(.*)"$/, '$1=$2').replace(/=\$\{\{ inputs\.[\w-]+ \}\}$/, '=1')) });
      assert.doesNotMatch(dry.stdout, /\bsudo\b/, `${file} ${run} runs sudo:\n${dry.stdout}`);
      recipes += 1;
    }
  }
  assert.ok(recipes > 20, `the check read ${String(recipes)} recipes`);
});

test('every job of the workflows that CI runs holds its content in a recipe of the Makefile (C19.20)', async () => {
  const workflows = (await readdir(new URL('../../.github/workflows/', import.meta.url))).filter(file => /\.ya?ml$/.test(file)).sort();
  assert.deepEqual(workflows, [...CI_WORKFLOWS].sort(), 'a workflow is not in CI_WORKFLOWS');
  const findings: string[] = [];
  for (const file of CI_WORKFLOWS) findings.push(...jobContentFindings(await workflowFile(file), RECIPE_PREFIX[file]).map(finding => `${file} ${finding}`));
  assert.deepEqual(findings, []);
});

// The tools that a call of a release or asset recipe runs, by the pattern of the call (C19.71): the release check of binding and
// binding release-go-module read the Go module with go (binding CK-19) and build with cargo, the builds of the binding packages
// run cargo, and the wheels of the job platform are built by the uv and the Python of mise.toml. A job that runs such a call
// without installing each of its tools with make install-tools before it fails on the runner, for example with spawnSync go
// ENOENT, after the tag is pushed.
const RELEASE_TOOLS: [RegExp, string[]][] = [
  [/^make release-binding-check-[\w-]+\b/, ['go', 'rust']],
  [/^(?:[A-Z_]+="[^"]*" )*make release-go-module-[\w-]+\b/, ['go', 'rust']],
  [/\bbinding(?:\.js)? check\b.*--release\b/, ['go', 'rust']],
  [/^make release-assets-platform-[\w-]+\b/, ['rust', 'go', 'uv', 'python']],
  [/^make release-assets-(?:php|npm)-[\w-]+\b/, ['rust']],
];

/** The tools that `make install-tools TOOLS=...` of the call `command` installs; none for another call. */
function installedTools(command: string): string[] {
  const match = /^make install-tools TOOLS=(?:"([^"]*)"|(\S+))$/.exec(command);
  return match ? (match[1] ?? match[2] ?? '').split(/\s+/).filter(Boolean) : [];
}

/**
 * The calls of `calls`, the make calls of one recipe in order, with the targets of make ci-targets split out, that run a tool
 * of RELEASE_TOOLS that no make install-tools before them installed, as `call: needs <tool>`.
 */
export function missingReleaseTools(calls: string[]): string[] {
  const findings: string[] = [];
  const installed = new Set<string>();
  for (const call of calls) {
    for (const tool of installedTools(call)) installed.add(tool);
    const targets = /^make ci-targets TARGETS="([^"]+)"/.exec(call);
    for (const command of targets?.[1] !== undefined ? targets[1].split(' ').map(target => `make ${target}`) : [call]) {
      for (const [pattern, tools] of RELEASE_TOOLS) {
        if (!pattern.test(command)) continue;
        for (const tool of tools) if (!installed.has(tool)) findings.push(`${command}: needs ${tool}`);
      }
    }
  }
  return findings;
}

test('a release or asset job installs every tool that its calls run before it runs them (C19.70, C19.71)', async () => {
  assert.deepEqual(missingReleaseTools([
    'make install-tools TOOLS="rust"',
    'make release-recipes',
    'make ci-targets TARGETS="release-binding-check-validator release-assets-php-validator"',
    'GIT_AUTHOR_NAME="$GITHUB_ACTOR" make release-go-module-validator',
    'make install-tools TOOLS=go',
    'make release-go-module-generator',
    'node binding.js check packages/x/interface.json --release',
  ]), [
    'make release-binding-check-validator: needs go',
    'GIT_AUTHOR_NAME="$GITHUB_ACTOR" make release-go-module-validator: needs go',
  ]);
  assert.deepEqual(missingReleaseTools(['make ci-targets TARGETS="release-assets-platform-generator"', 'make install-tools TOOLS="rust go uv python"']), [
    'make release-assets-platform-generator: needs rust',
    'make release-assets-platform-generator: needs go',
    'make release-assets-platform-generator: needs uv',
    'make release-assets-platform-generator: needs python',
  ]);
  const findings: string[] = [];
  const checked: string[] = [];
  for (const file of ['assets.yml', 'release.yml']) {
    for (const [id, job] of Object.entries((await workflowFile(file)).jobs)) {
      const step = (job.steps ?? []).find(entry => typeof entry.run === 'string')?.run?.trim();
      if (step === undefined) continue;
      // The jobs of assets.yml run the release check with RELEASE=true, as release.yml calls them, a matrix value is that of
      // the first include entry and another input is a placeholder; the job publish reads TAG from the tag of HEAD, which the
      // checkout of a branch has not.
      const run = step
        .replace(/\$\{\{ matrix\.([\w-]+) \}\}/g, (_, key: string) => matrixValues(job, key)[0] ?? '')
        .replace(/\$\{\{ inputs\.release \}\}/g, 'true')
        .replace(/\$\{\{ inputs\.[\w-]+ \}\}/g, '1');
      const calls = recipeCalls(`${run}${run === 'make ci-release-publish' ? ' TAG=v0.0.1' : ''}`);
      const commands = calls.flatMap(call => /^make ci-targets TARGETS="([^"]+)"/.exec(call)?.[1]?.split(' ').map(target => `make ${target}`) ?? [call]);
      if (commands.some(command => RELEASE_TOOLS.some(([pattern]) => pattern.test(command)))) checked.push(`${file} ${id}`);
      findings.push(...missingReleaseTools(calls).map(finding => `${file} ${id}: ${finding}`));
    }
  }
  assert.deepEqual(checked, ['assets.yml platform', 'assets.yml php', 'assets.yml npm', 'release.yml publish']);
  assert.deepEqual(findings, []);
});

/** The values of the key `key` of the include entries of the matrix of `job`. */
function matrixValues(job: Job, key: string): string[] {
  const include = field(job.strategy?.matrix, 'include');
  return Array.isArray(include) ? include.map(entry => field(entry, key)).filter((value): value is string => typeof value === 'string') : [];
}

// The job php of assets.yml builds the PHP extension of each component for each PHP minor of phpExtension.minors of
// config/toolchain.json on each platform of the job platform, and release-platform-assets-<component> requires an asset of each
// (binding GN-19a); a minor of the matrix that the list does not name, or one that it names and the matrix lacks, fails the
// release after the tag is pushed.
test('the PHP minors of the job php of assets.yml are phpExtension.minors of config/toolchain.json on every platform (C19.71)', async () => {
  const toolchain: unknown = JSON.parse(await read('config/toolchain.json'));
  const minors = strings(field(field(toolchain, 'phpExtension'), 'minors'), 'phpExtension.minors of config/toolchain.json');
  assert.ok(minors.length > 0 && minors.every(minor => /^\d+\.\d+$/.test(minor)), JSON.stringify(minors));
  const workflow = await workflowFile('assets.yml');
  const platforms = matrixValues(jobOf(workflow, 'platform'), 'platform');
  assert.deepEqual(platforms, ['linux-x64-gnu', 'linux-arm64-gnu', 'darwin-arm64']);
  const php = jobOf(workflow, 'php');
  const phpMinors = matrixValues(php, 'php');
  const entries = matrixValues(php, 'platform').map((platform, index) => `${platform} ${phpMinors[index] ?? ''}`);
  assert.deepEqual([...entries].sort(), platforms.flatMap(platform => minors.map(minor => `${platform} ${minor}`)).sort());
  assert.match((php.steps ?? []).find(step => typeof step.run === 'string')?.run ?? '', /^make ci-assets-php PHP_MINOR=\$\{\{ matrix\.php \}\} RELEASE=/);
});

// The calls of a recipe that prepare a runner rather than check the repository.
const preparation = [
  /^make(?: (?:crudui-)?install-[\w-]+)+(?: [A-Z]+="[^"]*")?$/,
  /^make check-ci-browser$/,
  /^make crudui-nginx-check$/,
  /^make kit-install-(?:php-arginfo|symbols)(?: EXTRACTORS="[^"]+")?$/,
];

/** The first value of a matrix key, as the run step reads it: a string or a number, or '' for none. */
function matrixFirst(values: unknown): string {
  const first: unknown = Array.isArray(values) ? values[0] : undefined;
  return typeof first === 'string' || typeof first === 'number' ? String(first) : '';
}

/** The run step of a job, `make ci-<job> NAME=value...`, with the first value of each matrix key that it names. */
function runOf(job: Job): string | undefined {
  const run = (job.steps ?? []).find(step => typeof step.run === 'string')?.run?.trim();
  return run?.replace(/\$\{\{ matrix\.([\w-]+) \}\}/g, (_, key: string) => matrixFirst(field(job.strategy?.matrix, key)));
}

/** The make calls of the recipe that the run step `run` starts, read from its dry run: each `make <target> ...` of CI_MAKE. */
export function recipeCalls(run: string): string[] {
  const [, target, ...variables] = run.split(/ (?=[A-Z][A-Z0-9_]*=|[a-z])/);
  assert.ok(target !== undefined && run.startsWith('make '), `the run step ${run} is no make target`);
  const dry = makeDryRun(ROOT, target, { variables: variables.map(variable => variable.replace(/^([A-Z][A-Z0-9_]*)="(.*)"$/, '$1=$2')) });
  assert.equal(dry.status, 0, `${run}: ${dry.stderr}`);
  return [...dry.stdout.matchAll(/\bmake --no-print-directory (.*?)(?:;|$| \|\| | && )/gm)].map(match => `make ${match[1] ?? ''}`.trim());
}

/** The checking commands of the workflow, in job order: the targets of make ci-targets and every other call of each recipe that prepares nothing. */
export function workflowCommands(workflow: Workflow, calls: (run: string) => string[] = recipeCalls): string[] {
  const commands: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    // The judgement job reads the results of the other jobs and checks no part of the tree.
    if (JUDGE_JOBS.has(id)) continue;
    const run = runOf(job);
    if (run === undefined) continue;
    for (const command of calls(run)) {
      // make ci-targets runs each target of TARGETS as make -k <target> (ci-targets of @polyspec/kit).
      const targets = /^make ci-targets TARGETS="([^"]+)"$/.exec(command);
      if (targets?.[1] !== undefined) commands.push(...targets[1].split(' ').map((target) => `make ${target}`));
      else if (!preparation.some((pattern) => pattern.test(command))) commands.push(command);
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

test('the runtime recipe passes native Node sharding only when requested (C18.9)', () => {
  // A shard job of CI exports CRUDUI_TEST_SHARD to every recipe, so the environment of this test drops it: the plain
  // dry run must show no shard whatever the job that runs the test set.
  const { CRUDUI_TEST_SHARD: _inheritedShard, ...inherited } = process.env;
  const args = (shard?: string): string[] => {
    const result = makeDryRun(ROOT, 'crudui-test-runtimes', { env: inherited, variables: shard === undefined ? [] : [`CRUDUI_TEST_SHARD=${shard}`] });
    assert.equal(result.status, 0, result.stderr);
    const line = result.stdout.split('\n').find(entry => entry.includes('scripts/run-tests.mts'));
    assert.ok(line, `make -n crudui-test-runtimes prints the test command:\n${result.stdout}`);
    return line.trim().split(/\s+/);
  };
  const plain = args();
  assert.equal(plain.some(argument => argument.startsWith('--test-shard=')), false);
  const files = plain.filter(argument => argument.startsWith('tests/'));
  assert.ok(files.includes('tests/build/ci-local.test.mts'));
  assert.ok(files.length > 4);
  for (const shard of ['1/4', '2/4', '3/4', '4/4']) {
    const selected = args(shard);
    assert.deepEqual(selected.filter(argument => argument.startsWith('--test-shard=')), [`--test-shard=${shard}`]);
    assert.deepEqual(selected.filter(argument => argument.startsWith('tests/')), files);
  }
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
  for (const file of CI_WORKFLOWS) {
    violations.push(...stepsOutsideMake(await workflowFile(file)).map(line => `${file} ${line}`));
  }
  assert.deepEqual(violations, []);
});

/**
 * The jobs of a workflow whose recipe runs a check outside make ci-targets, or that run checks without uploading their report
 * under `if: ${{ !cancelled() }}` with `if-no-files-found: error`, as `job: problem`. `calls` gives the make calls of the
 * recipe of a run step.
 */
export function jobsWithoutReport(workflow: Workflow, calls: (run: string) => string[] = recipeCalls): string[] {
  const violations: string[] = [];
  for (const [id, job] of Object.entries(workflow.jobs)) {
    if (JUDGE_JOBS.has(id) || id === PLAN_JOB) continue;
    const steps = job.steps ?? [];
    const step = steps.find(entry => typeof entry.run === 'string');
    const run = runOf(job);
    if (step === undefined || run === undefined) continue;
    const recipe = calls(run);
    for (const command of recipe) {
      if (/^make ci-(?:targets|context-targets) /.test(command) || preparation.some((pattern) => pattern.test(command))) continue;
      violations.push(`${id}: ${command} runs a check outside make ci-targets`);
    }
    if (!recipe.some(command => /^make ci-(?:targets|context-targets) /.test(command))) continue;
    const upload = steps.slice(steps.indexOf(step) + 1).find((entry) => String(entry.uses ?? '').startsWith('actions/upload-artifact@') && /^var\/report\/ci-targets\/?$/.test(entry.with?.path ?? ''));
    if (!upload) violations.push(`${id}: uploads no report of var/report/ci-targets after its checks`);
    else {
      if (String(upload.if ?? '').replace(/\s+/g, ' ').trim() !== '${{ !cancelled() }}') violations.push(`${id}: the report upload does not run after a failure`);
      if (upload.with?.['if-no-files-found'] !== 'error' ) violations.push(`${id}: the report upload does not fail without a report`);
    }
  }
  return violations;
}

test('every job runs its checks through make ci-targets and uploads their report', async () => {
  const recipes: Record<string, string[]> = {
    'make ci-a': ['make install-tools TOOLS="node"', 'make lint'],
    'make ci-b': ['make ci-targets TARGETS="lint"'],
    'make ci-c': ['make ci-targets TARGETS="lint"'],
    'make ci-d': ['make install-tools TOOLS="node"', 'make ci-targets TARGETS="lint"'],
  };
  assert.deepEqual(jobsWithoutReport({ jobs: {
    a: { steps: [{ run: 'make ci-a' }] },
    b: { steps: [{ run: 'make ci-b' }] },
    c: { steps: [{ run: 'make ci-c' }, { uses: 'actions/upload-artifact@x', if: 'always()', with: { path: 'var/report/ci-targets' } }] },
    d: { steps: [{ run: 'make ci-d' }, { uses: 'actions/upload-artifact@x', if: '${{ !cancelled() }}', with: { path: 'var/report/ci-targets', 'if-no-files-found': 'error' } }] },
  } }, run => recipes[run] ?? []), [
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

test('a workflow command missing from CI_TARGETS is reported', () => {
  const recipes: Record<string, string[]> = {
    'make ci-a': ['make install-packages crudui-install-composer', 'make lint'],
    'make ci-b SHARD=1': ['make install-tools TOOLS="node"', 'make ci-targets TARGETS="test-x test-y"'],
  };
  const workflow = workflowCommands({
    jobs: {
      a: { steps: [{ run: 'make ci-a' }] },
      b: { strategy: { matrix: { shard: ['1', '2'] } }, steps: [{ run: 'make ci-b SHARD=${{ matrix.shard }}' }] },
      'ci-passed': { steps: [{ run: "make ci-passed RESULTS='${{ toJSON(needs) }}' FAIL_SKIPPED=1" }] },
    },
  }, run => recipes[run] ?? []);
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
  for (const name of (await readdir(new URL('../../.github/workflows/', import.meta.url))).filter(file => /\.ya?ml$/.test(file))) {
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


test('every application workflow declares a bounded tool installation scope', async () => {
  let recipes = 0;
  for (const file of ['ci.yml', 'pages.yml']) {
    const workflow = await workflowFile(file);
    for (const [id, job] of Object.entries(workflow.jobs)) {
      const run = runOf(job);
      if (run === undefined || JUDGE_JOBS.has(id)) continue;
      recipes += 1;
      for (const command of recipeCalls(run)) {
        assert.doesNotMatch(command, /^make install-tools$/, `${file} ${id}`);
        assert.doesNotMatch(command, /^make install$/, `${file} ${id}`);
      }
    }
  }
  assert.ok(recipes > 10, 'the scope check reads the recipes of the jobs');
  const pages = runOf(jobOf(await workflowFile('pages.yml'), 'docs-web'));
  assert.equal(pages, 'make ci-docs-web');
  assert.ok(recipeCalls(pages).includes('make install-tools TOOLS="node go rust php composer"'));
});




