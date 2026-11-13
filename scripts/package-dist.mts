#!/usr/bin/env node
/*
 * Build and pack a workspace package under the holder lock of its `dist` directory
 * (docs/operations/testing.md, "Shared resources").
 *
 * A package build empties `dist` before it writes the new output, and a pack reads `dist`. Both run
 * under the checkout lock `dist-<package folder>` (holder-lock of @polyspec/kit), so a pack never reads a
 * `dist` that a build has emptied or only partly written; a run that finds the lock held is refused
 * with the holder's record.
 *
 *   node ../../scripts/package-dist.mjs build '<build command>'    (the package's build script)
 *   node scripts/package-dist.mts pack <package directory> <destination directory>
 *
 * `pack` prints the JSON report of `npm pack` on standard output; the lock lines and npm's own
 * messages go to standard error.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { acquireHolderLock, runCommand } from '@polyspec/kit/holder-lock';

/** The root of this checkout: the parent of scripts/. A package build runs this script from its package directory. */
const repositoryRoot = path.resolve(import.meta.dirname, '..');

/** The lock file of a resource of this checkout. */
const checkoutLockFile = (name: string): string => path.join(repositoryRoot, 'var/locks', `${name}.lock`);

/** Take the lock of `lockFile` for this checkout and print the acquisition and, on release, the release on standard error. */
function acquireReported(lockFile: string, { command }: { command: string }): { release(): void } {
  const lock = acquireHolderLock(lockFile, { checkout: repositoryRoot, command });
  process.stderr.write(`lock: acquired ${lockFile} (process ${process.pid})\n`);
  return {
    ...lock,
    release() {
      lock.release();
      process.stderr.write(`lock: released ${lockFile}\n`);
    },
  };
}

/**
 * The folders that hold the package directories of this checkout, each with the prefix of its lock names: packages/,
 * and legacy/packages/ with the language implementations that the generated bindings replace (AGENTS.md).
 */
const packageRoots = [
  { root: 'packages', prefix: '' },
  { root: path.join('legacy', 'packages'), prefix: 'legacy' },
];

/**
 * The folder of a package directory of this checkout: relative to packages/ ('react'), and below 'legacy' for a package
 * of legacy/packages/ ('legacy/validator/ts'), so that it and the package of the same path under packages/ hold two locks.
 */
function packageFolder(directory: string): string {
  assert.ok(path.isAbsolute(directory), `Package directory must be absolute: ${directory}`);
  const folders = packageRoots.flatMap(({ root, prefix }) => {
    const folder = path.relative(path.join(repositoryRoot, root), directory);
    return folder !== '' && !folder.startsWith('..') && !path.isAbsolute(folder) ? [path.join(prefix, folder)] : [];
  });
  const [folder] = folders;
  assert.ok(folder !== undefined,
    `${directory} is not a package directory of ${repositoryRoot}: expected a folder under ${packageRoots.map(({ root }) => root).join(' or ')}`);
  assert.ok(fs.lstatSync(directory).isDirectory(), `${directory} is not a directory`);
  return folder;
}

const distLockFile = (folder: string): string => checkoutLockFile(`dist-${folder.split(path.sep).join('-')}`);

/**
 * Build the package of the working directory under its `dist` lock. The build command writes into `dist.next`, which
 * CRUDUI_DIST names, and a complete build replaces `dist` with two renames, so a reader of `dist` finds the previous
 * output or the new one, never an emptied or partly written directory. A failed build leaves `dist` as it was.
 */
async function build(command: string): Promise<number | null> {
  const directory = process.cwd();
  const folder = packageFolder(directory);
  const [dist, next, old] = (['dist', 'dist.next', 'dist.old'] as const).map(name => path.join(directory, name));
  assert.ok(dist !== undefined && next !== undefined && old !== undefined);
  const lock = acquireReported(distLockFile(folder), { command: `build ${command}` });
  try {
    for (const stale of [next, old]) fs.rmSync(stale, { recursive: true, force: true });
    process.env.CRUDUI_DIST = 'dist.next';
    const status = await runCommand('/bin/sh', ['-c', command], { cwd: directory });
    if (status !== 0) return status;
    assert.ok(fs.existsSync(next) && fs.readdirSync(next).length > 0, `${command} wrote no output into ${next}; write the build into $CRUDUI_DIST`);
    if (fs.existsSync(dist)) fs.renameSync(dist, old);
    fs.renameSync(next, dist);
    fs.rmSync(old, { recursive: true, force: true });
    return 0;
  } finally {
    fs.rmSync(next, { recursive: true, force: true });
    lock.release();
  }
}

async function pack(directory: string, destination: string): Promise<number | null> {
  const folder = packageFolder(directory);
  assert.ok(path.isAbsolute(destination), `Pack destination must be absolute: ${destination}`);
  const lock = acquireReported(distLockFile(folder), { command: `pack ${directory}` });
  try {
    const dist = path.join(directory, 'dist');
    assert.ok(fs.existsSync(dist) && fs.readdirSync(dist).length > 0,
      `${dist} holds no build output; build the package first`);
    return await runCommand('npm', ['pack', '.', '--json', '--pack-destination', destination,
      '--workspaces=false'], { cwd: directory });
  } finally {
    lock.release();
  }
}

async function main(argv: string[]): Promise<number | null> {
  const [operation, ...args] = argv;
  const [first, second] = args;
  if (operation === 'build' && args.length === 1 && first !== undefined) return build(first);
  if (operation === 'pack' && args.length === 2 && first !== undefined && second !== undefined) return pack(first, second);
  throw new Error("Usage: node ../../scripts/package-dist.mjs build '<build command>'\n"
    + '       node scripts/package-dist.mts pack <package directory> <destination directory>');
}

main(process.argv.slice(2)).then(status => { process.exitCode = status; }, (error: unknown) => {
  process.stderr.write(`package-dist: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
