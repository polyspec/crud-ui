import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import { checkedFiles } from '@polyspec/kit/tracked-files';
import { checked, parseJson, type JTDSchemaType, type PackageManagerEngine } from '../json.mts';
import { kitToolPath, makeDryRun } from './make-dry-run.mts';
import { DEVENGINES_NPM_VERSION, recordedNpmRelease } from './npm-release.mts';

const repository = fileURLToPath(new URL('../..', import.meta.url));

/** The parts of a workflow step that the tests read. */
interface WorkflowStep {
  run?: unknown;
  uses?: unknown;
  with?: Record<string, unknown>;
}

/** The text of a step's `uses` or `run`: empty when the step has none; a value that is not text fails the test. */
function stepText(step: WorkflowStep, member: 'uses' | 'run'): string {
  const value = step[member];
  if (value === undefined) return '';
  assert.ok(typeof value === 'string', `a step's ${member} is text: ${JSON.stringify(value)}`);
  return value;
}

/** The parts of a workflow job that the tests read. */
interface WorkflowJob {
  'runs-on'?: unknown;
  uses?: unknown;
  steps?: WorkflowStep[];
  strategy?: { matrix?: { php?: unknown } };
}

/** The parts of a workflow file that the tests read. */
interface Workflow {
  env?: Record<string, unknown>;
  jobs: Record<string, WorkflowJob>;
}
const workflowSchema: JTDSchemaType<Workflow> = {
  properties: {
    jobs: {
      values: {
        optionalProperties: {
          'runs-on': {},
          uses: {},
          steps: { elements: { optionalProperties: { run: {}, uses: {}, with: { values: {} } }, additionalProperties: true } },
          strategy: { optionalProperties: { matrix: { optionalProperties: { php: {} }, additionalProperties: true } }, additionalProperties: true },
        },
        additionalProperties: true,
      },
    },
  },
  optionalProperties: { env: { values: {} } },
  additionalProperties: true,
};
/** The workflow text `text` of `file`, checked against the parts that the tests read. */
const workflowOf = (text: string, file: string): Workflow => checked(parse(text), workflowSchema, file);

/** The parts of a package.json that the tests read. */
interface Manifest {
  devEngines?: { packageManager?: PackageManagerEngine };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
const manifestSchema: JTDSchemaType<Manifest> = {
  optionalProperties: {
    devEngines: { optionalProperties: { packageManager: { optionalProperties: { name: { type: 'string' }, version: { type: 'string' }, onFail: { type: 'string' } }, additionalProperties: true } }, additionalProperties: true }, dependencies: { values: { type: 'string' } }, devDependencies: { values: { type: 'string' } },
  },
  additionalProperties: true,
};

/** The parts of config/toolchain.json that the tests read. */
interface ToolchainConfig {
  php: string[];
}
const toolchainSchema: JTDSchemaType<ToolchainConfig> = {
  properties: { php: { elements: { type: 'string' } } },
  additionalProperties: true,
};

/** The releases that recordedToolchain reads. */
interface RecordedToolchain {
  node: string | undefined;
  go: string | undefined;
  rust: string | undefined;
  php: string[];
  python: string | undefined;
  composer: string | undefined;
}

/**
 * The releases that the checkout declares, by the names of this test: Rust of rust-toolchain.toml,
 * the minors of PHP of config/toolchain.json, and Node.js, Go, Python and Composer of mise.toml, which make install-tools
 * installs with mise (kit K127, K171); kit's install-tools and install-kit check the recorded versions (K854).
 */
async function recordedToolchain(root: string): Promise<RecordedToolchain> {
  const text = (file: string): Promise<string> => readFile(path.join(root, file), 'utf8');
  const config = parseJson(await text('config/toolchain.json'), toolchainSchema, 'config/toolchain.json');
  parseJson(await text('package.json'), manifestSchema, 'package.json');
  const mise = await text('mise.toml');
  return {
    node: /^node = "([^"]+)"$/m.exec(mise)?.[1],
    go: /^go = "([^"]+)"$/m.exec(mise)?.[1],
    rust: /^channel = "([^"]+)"$/m.exec(await text('rust-toolchain.toml'))?.[1],
    php: config.php, python: /^python = "([^"]+)"$/m.exec(mise)?.[1], composer: /^"http:composer" = \{ version = "([^"]+)"/m.exec(mise)?.[1],
  };
}

/** The container definitions of the checkout: Dockerfile and *Containerfile among its tracked files. */
async function findContainerDefinitions(): Promise<string[]> {
  return checkedFiles(repository).filter(file => /(?:^|\/)(?:Dockerfile|[^/]*Containerfile)$/.test(file)).map(file => path.join(repository, file));
}

/** The exact npm release that devEngines.packageManager of package.json records. */
async function recordedNpm(): Promise<string | undefined> {
  const manifest = parseJson(await readFile(path.join(repository, 'package.json'), 'utf8'), manifestSchema, 'package.json');
  return recordedNpmRelease(manifest.devEngines?.packageManager);
}

test('the npm that runs here is the release that package.json records', async () => {
  const recorded = await recordedNpm();
  const running = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], { encoding: 'utf8' });
  assert.equal(running.error, undefined, running.error?.message ?? '');
  assert.equal(running.stdout.trim(), recorded,
    `npm ${running.stdout.trim()} runs here and package.json records npm ${recorded}; fix: make install-tools installs it into var/tools, and make puts var/tools/bin first on PATH`);
});

test('every workflow job installs the recorded npm before it runs npm', async () => {
  await recordedNpm();
  const violations: string[] = [];
  for (const { file, workflow } of await workflows()) {
    for (const [id, job] of Object.entries(workflow.jobs)) {
      let installed = false;
      for (const step of job.steps ?? []) {
        if (typeof step.run !== 'string') continue;
        // npm@$version is the recorded npm when the step assigns version from devEngines.packageManager (the kit bootstrap).
        const recorded = step.run.includes(DEVENGINES_NPM_VERSION);
        for (const command of step.run.split(/\n|&&/).map(text => text.trim()).filter(Boolean)) {
          const selected = command.replace(recorded ? /\bnpm@\$version\b/g : /$^/, '');
          if (/\bnpm@|\bnpm (?:i|install) (?:-g|--global)\b/.test(selected)) violations.push(`${file} ${id}: \`${command}\` selects an npm release`);
          // make install-tools TOOLS="npm" installs the recorded npm, and make install-packages runs it.
          if (/^make\b.*\binstall-(?:tools|packages)\b/.test(command)) installed = true;
          else if (/^npm\b/.test(command) && !installed) violations.push(`${file} ${id}: \`${command}\` runs before make install-tools`);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('the checkout tracks no container definition: Linux runs on the CI runners', async () => {
  assert.deepEqual((await findContainerDefinitions()).map(file => path.relative(repository, file)), []);
});

const read = (file: string): Promise<string> => readFile(path.join(repository, file), 'utf8');

/** Every workflow file of this repository with its parsed content; the copy of kit, release.yml, follows the rules of kit. */
async function workflows(): Promise<{ file: string; text: string; workflow: Workflow }[]> {
  const directory = path.join(repository, '.github/workflows');
  return Promise.all((await readdir(directory)).filter(name => /\.ya?ml$/.test(name)).map(async file => ({ file, text: await read(`.github/workflows/${file}`), workflow: workflowOf(await read(`.github/workflows/${file}`), file) })));
}

test('the checkout records one exact version of every tool', async () => {
  const recorded = await recordedToolchain(repository);
  const { node } = recorded;
  assert.ok(node !== undefined, 'mise.toml declares no node');
  assert.match(node, /^\d+\.\d+\.\d+$/, 'mise.toml must record node as one exact release');
  assert.equal(Number(node.split('.')[0]) % 2, 0, 'the Node.js release must be of an even, LTS-designated major');
  const toolchain = await read('rust-toolchain.toml');
  assert.match(toolchain, /^profile = "minimal"$/m);
  assert.match(toolchain, /^components = \["rustfmt", "clippy"\]$/m);
  const config = parseJson(await read('config/toolchain.json'), toolchainSchema, 'config/toolchain.json');
  // setup-php and Homebrew cannot install the same patch, so PHP is pinned by its minor release; the patch is evidence.
  assert.ok(config.php.length > 0 && config.php.every(release => /^\d+\.\d+$/.test(release)), `config/toolchain.json must record php as minor releases; it records ${JSON.stringify(config.php)}`);
  // Python, which runs the Python packages and their suites, and Go and Composer are exact releases of mise.toml, locked by mise.lock.
  for (const tool of ['go', 'python', 'composer'] as const) {
    const version = recorded[tool];
    assert.ok(version !== undefined, `mise.toml declares no ${tool}`);
    assert.match(version, /^\d+\.\d+\.\d+$/, `mise.toml must record ${tool} as one exact release`);
  }
});

// The type definitions of Node.js describe the runtime that runs the code, so every manifest requires the major of
// the recorded Node.js release.
test('every @types/node range requires the major of the Node.js of mise.toml', async () => {
  const major = (await recordedToolchain(repository)).node?.split('.')[0];
  assert.ok(major, 'mise.toml declares node');
  const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*package.json'], { cwd: repository, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const violations: string[] = [];
  for (const file of files) {
    let manifest: Manifest;
    // A manifest that is no JSON, such as a template of a fixture, names no range.
    let parsed: unknown;
    try { parsed = JSON.parse(await read(file)); } catch (error) { if (!(error instanceof SyntaxError)) throw error; continue; }
    manifest = checked(parsed, manifestSchema, file);
    for (const field of ['dependencies', 'devDependencies'] as const) {
      const range = manifest[field]?.['@types/node'];
      if (range !== undefined && !new RegExp(`^[\\^~]?${major}\\.`).test(range)) violations.push(`${file} ${field}: @types/node ${range}, mise.toml records Node.js ${major}`);
    }
  }
  assert.deepEqual(violations, []);
});

test('make installs nothing on its own and make install installs the Rust toolchain', async () => {
  const makefile = await read('Makefile');
  assert.match(makefile, /^export RUSTUP_AUTO_INSTALL := 0$/m);
  assert.match(makefile, /^export GOTOOLCHAIN := local$/m);
  // install-tools of kit installs the Rust toolchain of rust-toolchain.toml (kit K151); no target of crudui repeats it.
  assert.doesNotMatch(makefile, /^install-rust:/m);
  // Model the installing checkout in the dry run; an actual worktree uses the main checkout's tools and refuses installs.
  const install = makeDryRun(repository, 'install', { variables: ['KIT_WORKTREE='] });
  assert.equal(install.status, 0, install.stderr);
  const entry = /\/var\/tools\/bin\/node (\S+\/install-tools\.(?:mts|mjs))\s*$/m.exec(install.stdout)?.[1];
  assert.ok(entry, install.stdout);
  assert.equal(realpathSync(path.resolve(repository, entry)), kitToolPath('install-tools'));
});

test('every workflow runs on ubuntu-24.04 with actions named by commit SHA and no auto-install', async () => {
  const violations: string[] = [];
  for (const { file, text, workflow } of await workflows()) {
    if (workflow.env?.RUSTUP_AUTO_INSTALL !== '0' || workflow.env?.GOTOOLCHAIN !== 'local') violations.push(`${file}: env must set RUSTUP_AUTO_INSTALL: '0' and GOTOOLCHAIN: local`);
    // A job that calls a reusable workflow of this repository has no runner; the called workflow's jobs do.
    for (const [id, job] of Object.entries(workflow.jobs).filter(([, job]) => job.uses === undefined)) {
      if (job['runs-on'] !== 'ubuntu-24.04') violations.push(`${file} ${id}: runs-on ${String(job['runs-on'])}`);
    }
    for (const line of text.split('\n').filter(entry => /^\s*(?:- )?uses:/.test(entry) && !/^\s*(?:- )?uses: \.\//.test(entry))) {
      if (!/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v?\d+\.\d+\.\d+$/.test(line)) violations.push(`${file}: ${line.trim()} is not named by the commit SHA of a release with the release in a comment`);
    }
  }
  assert.deepEqual(violations, []);
});

// The core tools of mise.toml that legacy full-install jobs check.
const MISE_TOOLS = ['go', 'python', 'composer'] as const;
// make install-tools of kit installs the tools of mise.toml and the Rust toolchain of rust-toolchain.toml (kit K151).
const INSTALL_TOOLS: readonly string[] = [...MISE_TOOLS, 'rust'];
// The tools input of setup-php: none, or the build tools of the PHP it installs (C16.9).
const SETUP_PHP_TOOLS: readonly string[] = ['none', 'phpize, php-config'];

test('every CI job sets up the recorded toolchains and checks the tools it set up', async () => {
  const recorded = await recordedToolchain(repository);
  for (const tool of MISE_TOOLS) assert.ok(recorded[tool], `mise.toml declares ${tool}`);
  const violations: string[] = [];
  for (const { file, workflow } of await workflows()) {
    for (const [id, job] of Object.entries(workflow.jobs)) {
      const steps = job.steps ?? [];
      if (!steps.some(step => stepText(step, 'uses').startsWith('actions/checkout@'))) continue;
      const tools = ['node'];
      for (const step of steps) {
        const uses = stepText(step, 'uses');
        const run = stepText(step, 'run');
        if (uses.startsWith('actions/setup-node@') && step.with?.['node-version-file'] !== 'mise.toml') violations.push(`${file} ${id}: setup-node must read mise.toml`);
        if (uses.startsWith('actions/setup-go@')) violations.push(`${file} ${id}: setup-go installs a Go; make install-tools installs the Go of mise.toml`);
        if (uses.startsWith('actions/setup-python@')) violations.push(`${file} ${id}: setup-python installs a Python; make install-tools installs the Python of mise.toml`);
        if (uses.startsWith('shivammathur/setup-php@')) {
          tools.push('php');
          // setup-php installs PHP with no tool of its own, or with the phpize and php-config of that PHP, which the phpize build
          // of the extension (make build-php-ext) needs; make install-tools installs the Composer of mise.toml.
          if (!SETUP_PHP_TOOLS.includes(String(step.with?.tools))) violations.push(`${file} ${id}: setup-php installs ${String(step.with?.tools)}; it installs PHP alone or with its phpize and php-config, and make install-tools installs the Composer of mise.toml`);
        }
        if (/^make install-tools$/m.test(run)) tools.push(...INSTALL_TOOLS);
        const selected = /^make install-tools TOOLS="([^"]+)"$/m.exec(run)?.[1]?.split(' ') ?? [];
        tools.push(...selected);
        if (selected.some(tool => ['composer', 'phpunit', 'phpcs', 'phpstan'].includes(tool))) tools.push('php');
        if (selected.some(tool => ['phpunit', 'phpcs', 'phpstan'].includes(tool))) tools.push('composer');
        if (selected.some(tool => ['deadcode', 'govulncheck', 'golangciLint'].includes(tool))) tools.push('go');
        if (selected.includes('vulture')) tools.push('python', 'uv');
        if (/rust-toolchain|dtolnay/.test(uses)) violations.push(`${file} ${id}: ${uses} selects a Rust toolchain; run rustup toolchain install --no-self-update`);
        if (/^make\b.*\binstall-rust\b/m.test(run)) violations.push(`${file} ${id}: make install-rust is gone; make install-tools installs the Rust toolchain of rust-toolchain.toml`);
        if (/^make\b.*\binstall-(?:tools|packages)\b/m.test(run) && !tools.includes('npm')) tools.push('npm');
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('no browser of a release channel or of the machine is installed or launched', async () => {
  const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'scripts', 'tests', '.github', 'Makefile'], { cwd: repository, encoding: 'utf8' }).stdout.split('\n').filter(file => file && !file.endsWith('runtime-version-policy.test.mts'));
  const violations: string[] = [];
  for (const file of files) {
    let source: string;
    try { source = await read(file); } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; continue; }
    source.split('\n').forEach((line, index) => {
      if (/browsers install \S+@(?:stable|latest|beta|dev|canary)\b|\/opt\/google\/chrome|\/Applications\/Firefox|\/usr\/bin\/firefox|CRUDUI_FIREFOX_EXECUTABLE/.test(line)) violations.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(violations, []);
});

test('the declared contract commands run in a shell without login files', async () => {
  const runner = await read('scripts/run-contract-tests.mts');
  assert.match(runner, /args: \['-c', command\]/);
  assert.doesNotMatch(runner, /'-lc'|'-l'/);
});

// .php-version holds the PHP minor of the checkout, one of config/toolchain.json php, and every setup-php step of every
// workflow reads it, as the release.yml of kit does: a workflow that names no PHP, such as the release proof without
// .php-version, keeps the PHP of the runner (template v0.0.7, C14.45).
test('every setup-php step reads the PHP minor of .php-version', async () => {
  const minors = (await recordedToolchain(repository)).php;
  const file = path.join(repository, '.php-version');
  assert.ok(existsSync(file), '.php-version is missing; it holds the PHP minor of the checkout');
  const minor = (await read('.php-version')).trim();
  assert.ok(minors.includes(minor), `.php-version holds ${minor}, which is no minor of config/toolchain.json php (${minors.join(', ')})`);
  const violations: string[] = [];
  for (const { file: name, workflow } of await workflows()) {
    for (const [id, job] of Object.entries(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        if (!stepText(step, 'uses').startsWith('shivammathur/setup-php@')) continue;
        if (step.with?.['php-version-file'] !== '.php-version' || step.with['php-version'] !== undefined) {
          violations.push(`${name} ${id}: setup-php reads php-version ${String(step.with?.['php-version'])} and php-version-file ${String(step.with?.['php-version-file'])}, not php-version-file .php-version alone`);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});
