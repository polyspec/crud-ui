#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CommandOptions {
  capture?: boolean | undefined;
  cwd?: string | undefined;
  environment?: NodeJS.ProcessEnv | undefined;
}
export interface CommandOutput {
  stdout: string;
  stderr: string;
}
/** A command runner: runCommand, or a replacement that a test passes; the callers read its standard output. */
export type CommandRunner = (
  executable: string, args: string[], options?: CommandOptions,
) => Promise<Pick<CommandOutput, 'stdout'>>;

export interface RustCommandOptions {
  cwd?: string | undefined;
  environment?: NodeJS.ProcessEnv | undefined;
  run?: CommandRunner | undefined;
  cargo?: string | undefined;
  rustc?: string | undefined;
  rustdoc?: string | undefined;
}

/** The checkout of `cwd`: the top level of its Git working tree, or `cwd` outside one. */
function checkoutOf(cwd: string): string {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : path.resolve(cwd);
}

/**
 * Refuse a CARGO_TARGET_DIR outside the checkout of `cwd`. Cargo judges the freshness of an output by
 * modification times, so a target directory that another checkout also builds into lets a build
 * reuse outputs compiled from that checkout's sources.
 */
export function requireCheckoutTarget(cwd: string, environment: NodeJS.ProcessEnv): void {
  if (!environment.CARGO_TARGET_DIR) return;
  const target = path.resolve(cwd, environment.CARGO_TARGET_DIR);
  const checkout = checkoutOf(cwd);
  const relative = path.relative(checkout, target);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`CARGO_TARGET_DIR ${target} is outside the checkout ${checkout} of ${path.resolve(cwd)}; `
      + 'cargo judges freshness by modification times, so a target that another checkout builds into reuses its outputs. '
      + 'Unset CARGO_TARGET_DIR or name a directory inside the checkout.');
  }
}

/** Resolve one child process from its error or close event. */
export function runCommand(
  executable: string, args: readonly string[], options: CommandOptions = {},
): Promise<CommandOutput> {
  const capture = options.capture ?? false;
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.environment,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
    });
    let stdout = '';
    let stderr = '';
    if (capture) {
      assert.ok(child.stdout && child.stderr);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    }
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0 && signal === null) {
        resolve({ stdout, stderr });
        return;
      }
      const result = signal ?? code ?? 'unknown';
      // A program such as PHP reports a startup failure on its standard output.
      const output = stderr.trim() || stdout.trim();
      const detail = capture && output ? ': ' + output : '';
      reject(new Error('Command failed (' + result + '): '
        + [executable, ...args].map(value => JSON.stringify(value)).join(' ') + detail));
    });
  });
}

/**
 * The absolute path of the executable that PATH names, as the shell finds it. The shims of mise put the pinned toolchain
 * on PATH, so the executable that answers here is the one that the command runs.
 */
function executableOnPath(name: string, environment: NodeJS.ProcessEnv): string {
  const result = spawnSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', name], { encoding: 'utf8', env: environment });
  const found = result.stdout.trim();
  assert.equal(result.status, 0, name + ' is not on PATH');
  assert.ok(path.isAbsolute(found), name + ' on PATH is not an absolute path: ' + found);
  return found;
}

/** Require the working directory to be a directory and not a symbolic link, so that its path names it. */
async function requireRealDirectory(cwd: string): Promise<void> {
  const state = await lstat(cwd);
  assert.equal(state.isSymbolicLink(), false, 'Working directory is a symbolic link: ' + cwd);
  assert.equal(state.isDirectory(), true, 'Working directory is not a directory: ' + cwd);
  assert.equal(await realpath(cwd), cwd, 'Working directory must be canonical: ' + cwd);
}

/**
 * Run one command of the pinned Rust toolchain. Cargo, rustc and rustdoc are the executables that PATH names, which the
 * shims of mise pin through rust-toolchain.toml; an explicit option or the CARGO, RUSTC and RUSTDOC variables replace
 * them. Each executable reports its version before the command runs, so a missing or wrong toolchain fails first.
 */
export async function runRustCommand(
  args: string[], options: RustCommandOptions = {},
): Promise<void> {
  if (!Array.isArray(args) || args.length === 0 || args.some(value => typeof value !== 'string')) {
    throw new TypeError('One Cargo command and its string arguments are required');
  }
  const environment = options.environment ?? process.env;
  const cwd = path.resolve(options.cwd ?? process.cwd());
  requireCheckoutTarget(cwd, environment);
  await requireRealDirectory(cwd);
  const run = options.run ?? runCommand;
  const cargo = options.cargo ?? environment.CARGO ?? executableOnPath('cargo', environment);
  const rustc = options.rustc ?? environment.RUSTC ?? executableOnPath('rustc', environment);
  const rustdoc = options.rustdoc ?? environment.RUSTDOC ?? executableOnPath('rustdoc', environment);
  const verify = async (executable: string, versionArgs: string[], pattern: RegExp): Promise<void> => {
    const result = await run(executable, versionArgs, { capture: true, cwd, environment });
    assert.match(result.stdout.trim(), pattern, 'Executable returned an unexpected version: ' + executable);
  };
  await verify(cargo, ['--version'], /^cargo /);
  await verify(rustc, ['--version'], /^rustc /);
  await verify(rustdoc, ['--version'], /^rustdoc /);
  const executionEnvironment = { ...environment, RUSTC: rustc, RUSTDOC: rustdoc };
  if (environment.LOCAL === '1') {
    // kit's link cargo patches the polyspec git sources with the checkouts of the link declaration (.links) itself (K869).
    await run(process.execPath, [fileURLToPath(import.meta.resolve('@polyspec/kit/link')), 'cargo', cwd, ...args],
      { cwd, environment: executionEnvironment });
  } else {
    await run(cargo, args, { cwd, environment: executionEnvironment });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runRustCommand(process.argv.slice(2), { cwd: process.cwd() }).catch((error: unknown) => {
    process.stderr.write((error instanceof Error ? error.stack ?? error.message : String(error)) + '\n');
    process.exitCode = 1;
  });
}
