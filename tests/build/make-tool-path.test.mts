import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runRustCommand, type CommandRunner } from '../../scripts/run-rust-command.mts';

const repository = path.resolve(import.meta.dirname, '../..');
const make = process.env.MAKE || '/usr/bin/make';

async function writeExecutable(filename: string): Promise<void> {
  await writeFile(filename, [
    '#!/bin/sh',
    'printf \'%s\t%s\n\' "${0##*/}" "$*" >> "$COMMAND_LOG"',
    '',
  ].join('\n'));
  await chmod(filename, 0o755);
}

/**
 * The make variables that name the fake commands of `directory`: the recipes start node, npm, go and Composer by the
 * absolute paths of kit.mk and the Makefile (kit K171), so the test sets those paths instead of PATH alone; make passes
 * them on to the sub-makes.
 */
function toolVariables(directory: string): string[] {
  const tools = [['NODE', 'node'], ['NPM', 'npm'], ['GO', 'go'], ['COMPOSER_BIN', 'composer']] as const;
  return tools.map(([name, command]) => `${name}=${path.join(directory, command)}`);
}

test('crudui-test-native runs the generator and PHP API parts after the PHP engine tests fail, and fails', async t => {
  const directory = await mkdtemp(path.join(await realpath(os.tmpdir()), 'crudui-make-status-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const home = path.join(directory, 'home');
  const commandDirectory = path.join(directory, 'commands');
  const commandLog = path.join(directory, 'commands.log');
  await mkdir(home);
  await mkdir(commandDirectory);
  await Promise.all(['composer', 'go', 'npm', 'sh'].map(command => (
    writeExecutable(path.join(commandDirectory, command))
  )));
  // The PHP engine test command fails; every other command succeeds.
  await writeFile(path.join(commandDirectory, 'node'), [
    '#!/bin/sh',
    'printf \'%s\t%s\n\' "${0##*/}" "$*" >> "$COMMAND_LOG"',
    'case "$*" in *packages/php-ext/tests/engine/engine.test.mjs*) exit 1 ;; esac',
    '',
  ].join('\n'));
  await chmod(path.join(commandDirectory, 'node'), 0o755);

  const result = spawnSync(make, ['--no-print-directory', '-f', 'Makefile', 'crudui-test-native', ...toolVariables(commandDirectory)], {
    cwd: repository,
    encoding: 'utf8',
    env: {
      COMMAND_LOG: commandLog,
      HOME: home,
      LANG: 'C',
      LC_ALL: 'C',
      PATH: `${commandDirectory}:/usr/bin:/bin`,
    },
  });

  assert.equal(result.error, undefined, result.error?.message ?? '');
  assert.notEqual(result.status, 0, [result.stdout, result.stderr].join('\n'));
  const commands = await readFile(commandLog, 'utf8');
  assert.match(commands, /^node\ttests\/native-generators\/run\.mts --target javascript,html,go,rust,python /m,
    `the generator part did not run:\n${commands}`);
  assert.match(commands, /^node\ttests\/native-generators\/run\.mts --extension \S+ --target php,php-native /m,
    `the PHP API part did not run:\n${commands}`);
});

test('the Rust command entry point runs the toolchain that PATH names', async t => {
  const directory = await mkdtemp(path.join(await realpath(os.tmpdir()), 'crudui-rust-command-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const toolchain = path.join(directory, 'toolchain');
  const commandLog = path.join(directory, 'commands.log');
  await mkdir(toolchain);
  const cargo = path.join(toolchain, 'cargo');
  const rustc = path.join(toolchain, 'rustc');
  const rustdoc = path.join(toolchain, 'rustdoc');
  await writeFile(cargo, [
    '#!/bin/sh',
    'if [ "$1" = "--version" ]; then printf "cargo 1.98.1\n"; exit 0; fi',
    "printf 'cargo\t%s\t%s\t%s\n' \"$*\" \"$RUSTC\" \"$RUSTDOC\" >> \"$COMMAND_LOG\"",
    '',
  ].join('\n'));
  await writeFile(rustc, [
    '#!/bin/sh',
    'printf "rustc 1.98.1 (test 2026-09-01)\\nhost: aarch64-test-system\\n"',
    '',
  ].join('\n'));
  await writeFile(rustdoc, [
    '#!/bin/sh',
    'printf "rustdoc 1.98.1 (test 2026-09-01)\\n"',
    '',
  ].join('\n'));
  await Promise.all([cargo, rustc, rustdoc].map(filename => chmod(filename, 0o755)));

  const result = spawnSync(process.execPath, [
    path.join(repository, 'scripts/run-rust-command.mts'),
    'test', '--locked', '--manifest-path', 'packages/generator/rust/Cargo.toml',
  ], {
    cwd: repository,
    encoding: 'utf8',
    env: {
      COMMAND_LOG: commandLog,
      LANG: 'C',
      LC_ALL: 'C',
      PATH: `${toolchain}:/usr/bin:/bin`,
    },
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(await readFile(commandLog, 'utf8'),
    `cargo\ttest --locked --manifest-path packages/generator/rust/Cargo.toml\t${rustc}\t${rustdoc}\n`);
});

test('Rust commands run in the working directory of the crate', async t => {
  const directory = await mkdtemp(path.join(await realpath(os.tmpdir()), 'crudui-rust-cwd-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const toolchain = path.join(directory, 'toolchain');
  const workingDirectory = path.join(directory, 'crate');
  await Promise.all([mkdir(toolchain), mkdir(workingDirectory)]);
  const cargo = path.join(toolchain, 'cargo');
  const rustc = path.join(toolchain, 'rustc');
  const rustdoc = path.join(toolchain, 'rustdoc');
  await Promise.all([cargo, rustc, rustdoc].map(writeExecutable));
  const calls: { file: string; args: string[]; cwd: string | undefined }[] = [];
  const run: CommandRunner = async (file, args, options) => {
    calls.push({ file, args, cwd: options?.cwd });
    if (file === cargo && args[0] === '--version') return { stdout: 'cargo 1.98.1\n' };
    if (file === rustc) {
      return { stdout: 'rustc 1.98.1 (test 2026-09-01)\nhost: aarch64-test-system\n' };
    }
    if (file === rustdoc) return { stdout: 'rustdoc 1.98.1 (test 2026-09-01)\n' };
    assert.equal(file, cargo);
    assert.deepEqual(args, ['test']);
    return { stdout: '' };
  };

  await runRustCommand(['test'], {
    cargo, cwd: workingDirectory, environment: { PATH: '' }, run, rustc, rustdoc,
  });
  assert.deepEqual(calls.map(call => call.cwd), [workingDirectory, workingDirectory, workingDirectory, workingDirectory]);
  assert.equal(calls.at(-1)?.file, cargo);
});

test('Rust commands reject a symbolic working directory', async t => {
  const directory = await mkdtemp(path.join(await realpath(os.tmpdir()), 'crudui-rust-link-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'crate');
  const workingDirectory = path.join(directory, 'linked-crate');
  const toolchain = path.join(directory, 'toolchain');
  await Promise.all([mkdir(target), mkdir(toolchain)]);
  await symlink(target, workingDirectory);
  const cargo = path.join(toolchain, 'cargo');
  const rustc = path.join(toolchain, 'rustc');
  const rustdoc = path.join(toolchain, 'rustdoc');
  await Promise.all([cargo, rustc, rustdoc].map(writeExecutable));
  const run = async (file: string, args: string[]) => {
    if (file === cargo) return { stdout: 'cargo 1.98.1\n' };
    if (file === rustc) {
      return { stdout: 'rustc 1.98.1 (test 2026-09-01)\nhost: aarch64-test-system\n' };
    }
    if (file === rustdoc) return { stdout: 'rustdoc 1.98.1 (test 2026-09-01)\n' };
    throw new Error('Unexpected command: ' + file + ' ' + args.join(' '));
  };

  await assert.rejects(runRustCommand(['test'], {
    cargo, cwd: workingDirectory, environment: { PATH: '' }, run, rustc, rustdoc,
  }), /symbolic link/i);
});
