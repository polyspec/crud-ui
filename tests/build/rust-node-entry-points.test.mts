import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import { readManifest, script } from '../json.mts';

const repository = path.resolve(import.meta.dirname, '../..');

function copy(root: string, relative: string): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(path.join(repository, relative), target);
}

function executable(filename: string, source: string): void {
  writeFileSync(filename, `#!${process.execPath}\n${source}\n`, { mode: 0o755 });
}

// The sandbox lies in var/tmp, the ignored directory of this checkout, so the copied scripts resolve @polyspec/kit from
// the node_modules of this checkout.
function fixture(t: TestContext, name: string, files: string[], directories: string[] = []): string {
  mkdirSync(path.join(repository, 'var/tmp'), { recursive: true });
  const root = mkdtempSync(path.join(repository, 'var/tmp', name));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of directories) mkdirSync(path.join(root, directory), { recursive: true });
  for (const file of [...files, 'scripts/run-rust-command.mts']) {
    copy(root, file);
  }
  return root;
}

function rustEnvironment(root: string, additions: NodeJS.ProcessEnv = {}): { cargo: string; commandLog: string; environment: NodeJS.ProcessEnv; rustc: string; rustdoc: string } {
  const toolchain = path.join(root, 'toolchain');
  const commandDirectory = path.join(root, 'commands');
  const commandLog = path.join(root, 'rust-commands.jsonl');
  mkdirSync(toolchain);
  mkdirSync(commandDirectory);

  const cargo = path.join(toolchain, 'cargo');
  const rustc = path.join(toolchain, 'rustc');
  const rustdoc = path.join(toolchain, 'rustdoc');
  executable(cargo, String.raw`
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === '--version') {
  process.stdout.write('cargo 1.98.1\n');
  process.exit(0);
}
fs.appendFileSync(process.env.RUST_COMMAND_LOG, JSON.stringify({
  args, cwd: process.cwd(), rustc: process.env.RUSTC, rustdoc: process.env.RUSTDOC,
}) + '\n');
if (process.env.TEST_RUSTDOC_OUTPUT) {
  for (const crate of ['polyspec_crudui_validator', 'polyspec_crudui_generator']) {
    const directory = path.join(process.env.TEST_RUSTDOC_OUTPUT, crate);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'index.html'), crate + '\n');
  }
}
if (args[0] === 'run') {
  for (const spec of ['contact', 'large']) {
    process.stdout.write(JSON.stringify({
      spec, valid: true, error: null, field: null, opsSec: 1, avgUs: 1, ms: 1,
    }) + '\n');
  }
}
`);
  executable(rustc, String.raw`
process.stdout.write('rustc 1.98.1 (test 2026-09-01)\nhost: aarch64-test-system\n');
`);
  executable(rustdoc, String.raw`
process.stdout.write('rustdoc 1.98.1 (test 2026-09-01)\n');
`);

  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    LANG: 'C',
    LC_ALL: 'C',
    LOCAL: '0',
    PATH: `${toolchain}${path.delimiter}${commandDirectory}`,
    RUST_COMMAND_LOG: commandLog,
    ...additions,
  };
  delete environment.CARGO;
  delete environment.RUSTC;
  delete environment.RUSTDOC;
  return { cargo, commandLog, environment, rustc, rustdoc };
}

function commands(filename: string): unknown[] {
  return readFileSync(filename, 'utf8').trim().split('\n').filter(Boolean).map((line): unknown => JSON.parse(line));
}

test('Rust documentation coverage uses one resolved toolchain', t => {
  const root = fixture(t, 'crudui-rust-doc-coverage-', [
    'scripts/check-doc-coverage.mts',
  ], [
    'packages/validator/rust',
    'packages/generator/rust',
  ]);
  const tools = rustEnvironment(root);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-doc-coverage.mts'), 'rust'], {
    encoding: 'utf8',
    env: tools.environment,
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(commands(tools.commandLog), [
    {
      args: ['build', '--locked', '--lib'],
      cwd: path.join(root, 'packages/validator/rust'),
      rustc: tools.rustc,
      rustdoc: tools.rustdoc,
    },
    {
      args: ['build', '--locked', '--lib'],
      cwd: path.join(root, 'packages/generator/rust'),
      rustc: tools.rustc,
      rustdoc: tools.rustdoc,
    },
  ]);
});

test('Rust API generation uses one resolved toolchain', t => {
  const root = fixture(t, 'crudui-rust-api-', [
    'scripts/gen-api-docs.mts',
    'scripts/operation-progress.mts',
  ], [
    'docs/api',
    'docs/public/api',
    'packages/generator/rust',
    'packages/validator/rust',
  ]);
  const generated = path.join(root, 'packages/generator/rust/target/doc');
  const tools = rustEnvironment(root, { TEST_RUSTDOC_OUTPUT: generated });
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/gen-api-docs.mts'), 'rust'], {
    encoding: 'utf8',
    env: tools.environment,
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(commands(tools.commandLog), [{
    args: [
      'doc', '--locked', '--no-deps', '-p', 'polyspec-crudui-validator', '-p', 'polyspec-crudui-generator',
    ],
    cwd: path.join(root, 'packages/generator/rust'),
    rustc: tools.rustc,
    rustdoc: tools.rustdoc,
  }]);
});

test('Rust benchmark uses one resolved toolchain for execution and version metadata', t => {
  const root = fixture(t, 'crudui-rust-benchmark-', [
    'benchmarks/validators/run.js',
    'benchmarks/validators/arguments.js',
  ], [
    'benchmarks/validators/fixtures',
    'benchmarks/validators/rust',
  ]);
  writeFileSync(path.join(root, 'benchmarks/validators/fixtures/contact.spec.json'), '{}\n');
  const tools = rustEnvironment(root);
  const result = spawnSync(process.execPath, [
    path.join(root, 'benchmarks/validators/run.js'),
    '--only', 'rust', '--iters', '1', '--warmup', '0',
  ], {
    encoding: 'utf8',
    env: tools.environment,
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(commands(tools.commandLog), [{
    args: [
      'run', '--release', '--quiet', '--', '--fixtures',
      path.join(root, 'benchmarks/validators/fixtures'), '--iters', '1', '--warmup', '0',
    ],
    cwd: path.join(root, 'benchmarks/validators/rust'),
    rustc: tools.rustc,
    rustdoc: tools.rustdoc,
  }]);
  assert.match(readFileSync(path.join(root, 'benchmarks/validators/results.md'), 'utf8'), /cargo 1\.98\.1/);
});

test('Rust generator fixture validation uses one resolved toolchain', t => {
  const root = fixture(t, 'crudui-rust-generator-fixtures-', []);
  const tools = rustEnvironment(root);
  const result = spawnSync(process.execPath, [
    path.join(repository, 'packages/generator/rust/verify-fixtures.mjs'),
  ], {
    cwd: repository,
    encoding: 'utf8',
    env: tools.environment,
  });

  assert.notEqual(result.status, 0, 'The fixture output mock intentionally omits its result');
  assert.doesNotMatch(result.stdout + result.stderr, /spawnSync cargo ENOENT/);
  assert.deepEqual(commands(tools.commandLog), [{
    args: [
      'test', '--locked', '--manifest-path',
      path.join(repository, 'packages/generator/rust/Cargo.toml'), 'native_fixture_records',
    ],
    cwd: repository,
    rustc: tools.rustc,
    rustdoc: tools.rustdoc,
  }]);
});

test('native generator integration uses the shared Rust command entry point', () => {
  const source = readFileSync(path.join(repository, 'tests/native-generators/run.mts'), 'utf8');
  assert.match(source, /runRustCommand/);
  assert.doesNotMatch(source, /process\.env\.CARGO|globalThis\.process\.env\.CARGO/);
});

test('cross-check server builds Rust through its module-located entry point', t => {
  const manifest = readManifest(path.join(repository, 'examples/cross-check-console/server/package.json'));
  assert.equal(script(manifest, 'build:rust'), 'node build-rust.mjs');

  const root = fixture(t, 'crudui-rust-cross-check-', []);
  const tools = rustEnvironment(root);
  const result = spawnSync(process.execPath, [
    path.join(repository, 'examples/cross-check-console/server/build-rust.mjs'),
  ], {
    cwd: path.join(repository, 'examples/cross-check-console/server'),
    encoding: 'utf8',
    env: tools.environment,
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(commands(tools.commandLog), [{
    args: ['build', '--locked', '--release'],
    cwd: path.join(repository, 'examples/cross-check-console/validators/rust'),
    rustc: tools.rustc,
    rustdoc: tools.rustdoc,
  }]);
});

test('a Cargo command refuses a CARGO_TARGET_DIR outside its checkout', async t => {
  const { requireCheckoutTarget, runRustCommand } = await import('../../scripts/run-rust-command.mts');
  const outside = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'crudui-shared-target-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const crate = path.join(repository, 'packages/validator/rust');
  const ran: unknown[][] = [];
  await assert.rejects(
    runRustCommand(['build'], { cwd: crate, environment: { ...process.env, CARGO_TARGET_DIR: outside }, run: async (...call: unknown[]) => { ran.push(call); return { stdout: '' }; } }),
    new RegExp(`CARGO_TARGET_DIR ${outside} is outside the checkout ${repository} of ${crate}`),
  );
  assert.deepEqual(ran, [], 'no tool runs before the refusal');
  // A target inside the checkout, and no CARGO_TARGET_DIR, are accepted.
  assert.doesNotThrow(() => requireCheckoutTarget(crate, { CARGO_TARGET_DIR: path.join(repository, 'var/target') }));
  assert.doesNotThrow(() => requireCheckoutTarget(crate, {}));
  // Outside a Git working tree, the checkout is the working directory.
  assert.doesNotThrow(() => requireCheckoutTarget(outside, { CARGO_TARGET_DIR: path.join(outside, 'target') }));
});


test('local Rust commands run cargo through kit link, which reads the link declaration itself (C18.18)', async () => {
  const { runRustCommand } = await import('../../scripts/run-rust-command.mts');
  const cwd = path.join(repository, 'examples/form-comparison/servers/rust');
  const calls: { executable: string; args: string[]; cwd: string | undefined }[] = [];
  await runRustCommand(['metadata', '--offline', '--format-version=1'], {
    cwd, cargo: '/native/cargo', rustc: '/native/rustc', rustdoc: '/native/rustdoc',
    environment: { ...process.env, LOCAL: '1' },
    run: async (executable, args, options) => {
      calls.push({ executable, args, cwd: options?.cwd });
      return { stdout: executable.endsWith('rustc') ? 'rustc 1.99.0' : executable.endsWith('rustdoc') ? 'rustdoc 1.99.0' : 'cargo 1.99.0' };
    },
  });
  assert.equal(calls.length, 4);
  assert.equal(calls[3]?.executable, process.execPath);
  assert.deepEqual(calls[3]?.args.slice(1), ['cargo', cwd, 'metadata', '--offline', '--format-version=1']);
  assert.equal(calls[3]?.args[0], fileURLToPath(import.meta.resolve('@polyspec/kit/link')));
});
