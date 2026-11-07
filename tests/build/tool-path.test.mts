// The tools of the checkout (make install-tools of @polyspec/kit): npm, Go and the other declared tools are installed
// into var/tools and never into the machine, and make and CI put their commands in var/tools/bin first on PATH.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import { makeTargets } from '../../scripts/test-commands.mts';
import { checked, readManifest, type JTDSchemaType } from '../json.mts';
import { recordedNpmRelease } from './npm-release.mts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOLS_BIN = path.join(ROOT, 'var', 'tools', 'bin');

/** The parts of a GitHub Actions workflow the checks read. */
interface Workflow { jobs?: Record<string, { steps?: { run?: unknown }[] }> }
const workflowSchema: JTDSchemaType<Workflow> = {
  optionalProperties: {
    jobs: { values: { optionalProperties: { steps: { elements: { optionalProperties: { run: {} }, additionalProperties: true } } }, additionalProperties: true } },
  },
  additionalProperties: true,
};

// A container image is a machine of its own, so its definition may install npm globally; the scripts, make and CI run
// on the machine of the checkout.
test('no script, make target or CI step installs npm into the machine', () => {
  const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'scripts', 'Makefile', '.github'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const violations: string[] = [];
  for (const file of files) {
    if (!existsSync(path.join(ROOT, file))) continue;
    readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line, index) => {
      if (/\bnpm (?:i|install)\b[^\n]*(?:\s-g\b|--global\b)|\bnpm\b[^\n]*'(?:--global|-g)'/.test(line)) violations.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(violations, []);
});

test('make runs with the tools of var/tools/bin first on PATH', () => {
  const run = spawnSync('make', ['--no-print-directory', '-s', '-f', 'Makefile', '-f', '-', 'print-path'], {
    cwd: ROOT, encoding: 'utf8', input: 'print-path:\n\t@echo "$$PATH"\n', env: { ...process.env, MAKEFLAGS: '', MAKELEVEL: '' },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim().split(path.delimiter)[0], TOOLS_BIN);
});

// GNU Make 3.81 looks up the program of a recipe line without shell syntax on the PATH that make started with, so a
// recipe line `npm ci` would start the npm of the machine; every recipe starts npm as $(NPM), the path in the checkout.
test('every recipe starts npm by its path in the checkout', () => {
  const violations: string[] = [];
  for (const [target, rule] of Object.entries(makeTargets(readFileSync(path.join(ROOT, 'Makefile'), 'utf8')))) {
    for (const command of rule.commands) {
      for (const segment of command.split(/&&|\|\||[;|]/)) {
        if (/^(?:[A-Z_][A-Z0-9_]*=\S*\s+)*(?:npm|npx)\b/.test(segment.trim())) violations.push(`${target}: ${segment.trim()}`);
      }
    }
  }
  assert.deepEqual(violations, [], 'start npm as $(NPM) in a recipe');
});

test('a recipe of make runs the recorded npm of the checkout', () => {
  const recorded = recordedNpmRelease(readManifest(path.join(ROOT, 'package.json')).devEngines?.packageManager);
  // The probe recipe has no shell syntax, so make starts the program itself, as it does for `$(NPM) run docs:api`.
  const run = spawnSync('make', ['--no-print-directory', '-s', '-f', 'Makefile', '-f', '-', 'probe-npm'], {
    cwd: ROOT, encoding: 'utf8', input: 'probe-npm:\n\t$(NPM) --version\n', env: { ...process.env, MAKEFLAGS: '', MAKELEVEL: '' },
  });
  assert.equal(run.status, 0, `${run.stderr}\nfix: make install-tools`);
  assert.equal(run.stdout.trim(), recorded);
});

// A CI step starts npm only through a make target (tests/build/ci-local.test.mts), and the Makefile puts the tools of
// var/tools/bin first on PATH, so no job adds them to GITHUB_PATH.
test('every CI job starts npm through make, which puts var/tools/bin first on PATH', () => {
  assert.match(readFileSync(path.join(ROOT, 'Makefile'), 'utf8'), /^export PATH := \$\(CURDIR\)\/var\/tools\/bin:\$\(PATH\)$/m);
  const directory = path.join(ROOT, '.github/workflows');
  const violations: string[] = [];
  for (const file of readdirSync(directory).filter(name => /\.ya?ml$/.test(name))) {
    const workflow = checked(parse(readFileSync(path.join(directory, file), 'utf8')), workflowSchema, file);
    for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
      for (const step of job.steps ?? []) {
        if (typeof step.run !== 'string') continue;
        for (const command of step.run.split(/\n|&&/).map(text => text.trim()).filter(Boolean)) {
          if (/^(?:npm|npx)\b/.test(command) || /GITHUB_PATH/.test(command)) violations.push(`${file} ${id}: \`${command}\``);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});
