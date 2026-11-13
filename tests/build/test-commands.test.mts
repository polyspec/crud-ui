// The test command standard: every test the project runs goes through the run-tests tool of @polyspec/kit,
// which prints each test as it starts, runs, passes or fails with its elapsed time and stops a
// test that outlives its own timeout. A test tool called directly from a project command, or a
// CI time limit over a step or a job, fails this check.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { checked, parseJson, manifestSchema, type JTDSchemaType, type Manifest } from '../json.mts';
import {
  isTestCommand, makeHooks, makeTargets, matchesArgument, nodeScripts, nodeTestArguments, projectCommands, runsTests,
  workflowJobs,
} from '../../scripts/test-commands.mts';

/** The prerequisites and recipe lines of a Makefile target. */
interface MakeRule {
  prerequisites: string[];
  commands: string[];
}

/** The npm scripts, Composer scripts, workspaces and Makefile targets that runsTests follows. */
interface Project {
  npm: Record<string, Record<string, string>>;
  composer: Record<string, Record<string, string>>;
  workspaces: Record<string, string>;
  make: Record<string, MakeRule>;
  hooks?: Record<string, string[]>;
}

/** A command of a project file, by the name of its script, target or step. */
interface ProjectCommand {
  name: string;
  command: string;
}

/** The parts of a workflow file that the tests read. */
interface Workflow {
  jobs?: Record<string, { steps?: { name?: string; run?: unknown }[] }>;
}
const workflowSchema: JTDSchemaType<Workflow> = {
  optionalProperties: {
    jobs: {
      values: {
        optionalProperties: { steps: { elements: { optionalProperties: { name: { type: 'string' }, run: {} }, additionalProperties: true } } },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: true,
};

/** The Makefile targets of `text`. */
function targetsOf(text: string): Record<string, MakeRule> {
  return makeTargets(text);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tracked = [
  // A tracked file deleted in the working tree is no longer a project command source.
  ...execFileSync('git', ['ls-files', '*package.json', '*composer.json', '*Makefile', '.github/workflows/*.yml'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(file => file && existsSync(path.join(ROOT, file))),
  'contracts/features.json',
];
const read = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');
/** The package.json or composer.json `file` of the checkout. */
const manifestOf = (file: string): Manifest => parseJson(read(file), manifestSchema, file);

test('a script a test command starts prints through the shared progress lines', () => {
  assert.deepEqual(nodeScripts('node scripts/a.mjs --flag && FOO=1 node --import tsx b/c.js x; node scripts/run-tests.mts node -- d.test.mjs; npm test'), ['scripts/a.mjs', 'b/c.js']);
  assert.equal(isTestCommand('package.json', 'test:forms'), true);
  assert.equal(isTestCommand('package.json', 'pretest'), true);
  assert.equal(isTestCommand('package.json', 'build'), false);
  assert.equal(isTestCommand('Makefile', 'crudui-test-native'), true);
  assert.equal(isTestCommand('Makefile', 'docs-check'), false);
  const violations: string[] = [];
  for (const file of tracked) {
    const directory = path.dirname(file);
    for (const { name, command } of projectCommands(file, read(file))) {
      if (!isTestCommand(file, name)) continue;
      // The tools of @polyspec/kit and its copies follow the rules of kit.
      for (const script of nodeScripts(command).filter(name => !/^\$\(KIT\)\/|node_modules\/@polyspec\/kit\//.test(name))) {
        const source = [path.join(ROOT, directory, script), path.join(ROOT, script)].find(candidate => existsSync(candidate));
        if (!source) violations.push(`${file} ${name}: ${script} does not exist`);
        else if (!/'@polyspec\/kit\/test-progress'/.test(readFileSync(source, 'utf8'))) violations.push(`${file} ${name}: ${script} does not print through @polyspec/kit/test-progress`);
      }
    }
  }
  assert.deepEqual([...new Set(violations)], []);
});

test('every node:test file runs in a project command', () => {
  assert.deepEqual(nodeTestArguments('node scripts/run-tests.mts node -- a.test.mjs b/*.test.mjs && node scripts/run-tests.mts vitest -- c.test.ts'), ['a.test.mjs', 'b/*.test.mjs']);
  assert.equal(matchesArgument('tests/docs/a.test.mts', 'tests/docs/*.test.mts'), true);
  assert.equal(matchesArgument('tests/docs/x/a.test.mts', 'tests/docs/*.test.mts'), false);
  const arguments_ = tracked.flatMap(file => projectCommands(file, read(file)).flatMap(({ command }: ProjectCommand) => nodeTestArguments(command)));
  // Vitest runs every test file of a package that declares a Vitest test script.
  const vitest = tracked.filter(file => file.endsWith('package.json') && /vitest/.test(manifestOf(file).scripts?.['test'] ?? '')).map(path.dirname);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.test.mts', '*.test.mjs', '*.test.cjs', '*.test.js', '*.browser.mjs'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(file => file && existsSync(path.join(ROOT, file)) && !vitest.some(directory => file.startsWith(`${directory}/`)));
  assert.deepEqual(files.filter(file => !arguments_.some(argument => matchesArgument(file, argument))), []);
});

test('every TypeScript package declares a typecheck that CI runs', () => {
  const packages = execFileSync('git', ['ls-files', 'packages/*/tsconfig.json'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).map(path.dirname);
  const missing = packages.filter(directory => !manifestOf(`${directory}/package.json`).scripts?.['typecheck']);
  assert.deepEqual(missing, []);
  const ci = tracked.filter(file => file.startsWith('.github/workflows/')).flatMap(file => projectCommands(file, read(file)).map((item: ProjectCommand) => item.command));
  assert.ok(ci.some(command => /^make ci-targets TARGETS="(?:[\w-]+ )*typecheck(?: [\w-]+)*"$/.test(command)), 'CI does not run make typecheck');
  assert.deepEqual(targetsOf(read('Makefile')).typecheck?.commands, ['$(NPM) run typecheck', 'node_modules/.bin/tsc -p tsconfig.json', 'node_modules/.bin/tsc -p examples/form-comparison/src/tsconfig.json']);
});

/** The npm scripts, Composer scripts, workspaces and Makefile targets the repository declares. */
function declaredCommands(): Project {
  const project: Project = { npm: {}, composer: {}, workspaces: {}, make: {} };
  for (const file of tracked) {
    const directory = path.posix.dirname(file);
    if (file.endsWith('package.json')) {
      const manifest = manifestOf(file);
      project.npm[directory] = manifest.scripts ?? {};
      if (manifest.name) project.workspaces[manifest.name] = directory;
    } else if (file.endsWith('composer.json')) {
      project.composer[directory] = manifestOf(file).scripts ?? {};
    } else if (file === 'Makefile') {
      project.make = targetsOf(read(file));
      project.hooks = makeHooks(read(file));
    }
  }
  return project;
}

test('a CI step runs tests when its command reaches the test runner', () => {
  const project = declaredCommands();
  for (const command of [
    'make crudui-test-runtimes', 'make crudui-test-validator-js', 'make crudui-test-validator-php', 'make crudui-test-validator-go', 'make docs-check', 'make crudui-test-native',
    'make crudui-test-cross-check', 'make manifest-test', 'make crudui-test-build', 'make crudui-test-build-repeat',
  ]) assert.equal(runsTests(command, project), true, command);
  for (const command of [
    'make install-packages', 'make crudui-install-composer', 'make build', 'make lint', 'make typecheck',
    'make build-php-ext', 'make check-ci-browser', 'make check-conformance',
  ]) assert.equal(runsTests(command, project), false, command);
});

/** The prerequisites that run tests, as `target: prerequisite`, of the declared Makefile targets. */
function testPrerequisites(project: Project): string[] {
  return Object.entries(project.make).flatMap(([target, rule]) => rule.prerequisites
    .filter(prerequisite => runsTests(`make ${prerequisite}`, project))
    .map(prerequisite => `${target}: ${prerequisite}`));
}

// Make stops at the first prerequisite that fails, so a target that runs several test targets runs
// each with `$(MAKE) <target> || status=1` and exits with the collected status.
test('no Makefile target takes a target that runs tests as a prerequisite', () => {
  const fixture = targetsOf([
    'all: build test-a test-b', 'build:', '\tnpm run build', 'test-a:', '\tnode scripts/run-tests.mts node -- a.test.mjs',
    'test-b:', '\tnode scripts/run-tests.mts node -- b.test.mjs', 'collect:',
    '\t@status=0; $(MAKE) test-a || status=1; $(MAKE) test-b || status=1; exit $$status', '',
  ].join('\n'));
  assert.deepEqual(testPrerequisites({ npm: {}, composer: {}, workspaces: {}, make: fixture }), ['all: test-a', 'all: test-b']);
  assert.deepEqual(testPrerequisites(declaredCommands()), []);
});

// A check command of a recipe: a command that reaches tests, or a document, format or manifest check.
const CHECK = /\bnpm run [\w:-]*check\b|\bnode scripts\/check-[\w-]+\.m[jt]s\b|--check\b|\bgofmt -l\b/;

/**
 * The recipes that stop at a failing check, as `target: reason`. Make stops at the first recipe
 * line that fails, so the line that runs the first check is the last line of its target and runs
 * each check with `|| status=1`, ending with `exit $$status`. Preparation lines before it still stop
 * the target; a chain joined by `&&` whose later steps read the result of the earlier ones is one
 * check.
 */
function stoppingRecipes(project: Project): string[] {
  const isCheck = (command: string): boolean => CHECK.test(command) || runsTests(command, project);
  const violations: string[] = [];
  for (const [target, rule] of Object.entries(project.make)) {
    const first = rule.commands.findIndex(isCheck);
    if (first === -1) continue;
    const line = rule.commands[first];
    assert.ok(line !== undefined);
    for (const later of rule.commands.slice(first + 1)) violations.push(`${target}: \`${later}\` runs only when \`${line}\` passed`);
    // Each check of the line sets status=1 on failure before the next check, and the line exits
    // with the collected status.
    const segments = line.split(';').map(command => command.trim());
    if (segments.some(command => isCheck(command) && /\|\|\s*exit\b/.test(command))) violations.push(`${target}: a failing check ends the recipe with || exit`);
    const checks = segments.flatMap((command, index) => (isCheck(command) ? [index] : []));
    const recorded = checks.every((index, position) => segments.slice(index, checks[position + 1] ?? segments.length)
      .some(command => /\bstatus=1\b/.test(command)));
    if (checks.length > 1 && (!recorded || !line.endsWith('exit $$status'))) {
      violations.push(`${target}: the checks of one line do not each set status=1 and exit with it`);
    }
  }
  return violations;
}

test('a target that DOCS_CHECKS hooks into kit docs-check reaches the test runner only when it runs tests', () => {
  const runs = 'DOCS_CHECKS += crudui-tests\ncrudui-tests:\n\tnode scripts/run-tests.mts vitest --cwd packages/x -- src/a.test.ts\n';
  const quiet = 'DOCS_CHECKS += crudui-lint\ncrudui-lint:\n\tnode scripts/lint.mts\n';
  const project = (text: string): Project => ({ npm: {}, composer: {}, workspaces: {}, make: makeTargets(text), hooks: makeHooks(text) });
  assert.equal(runsTests('make docs-check', project(runs)), true);
  assert.equal(runsTests('make docs-check', project(quiet)), false);
});

test('a Makefile target runs every check after an earlier check failed', () => {
  const fixture = targetsOf([
    'lines:', '\tnpm run manifest:check', '\tnode scripts/check-documents.mjs', '\tnpm run docs:build',
    'loop:', '\t@for crate in a b; do node scripts/run-rust-command.mts fmt --check --manifest-path "$$crate" || exit 1; done',
    'prepared:', '\t@packages="$$(go list ./...)" || exit $$?; node scripts/run-tests.mts go -- $$packages',
    'check-exit:', '\t@node scripts/run-tests.mts node -- a.test.mjs || exit 1',
    'collected:', '\tnpm run build', '\t@status=0; npm run manifest:check || status=1; node scripts/check-documents.mjs || status=1; exit $$status',
    'chain:', '\t$(MAKE) docs-clean', '\t@runs=$$(mktemp -d) && $(MAKE) docs-web && diff -r "$$runs/a" "$$runs/b"',
    'unrecorded:', '\t@status=0; npm run manifest:check; node scripts/check-documents.mjs || status=1; exit $$status', '',
  ].join('\n'));
  assert.deepEqual(stoppingRecipes({ npm: {}, composer: {}, workspaces: {}, make: fixture }), [
    'lines: `node scripts/check-documents.mjs` runs only when `npm run manifest:check` passed',
    'lines: `npm run docs:build` runs only when `npm run manifest:check` passed',
    'loop: a failing check ends the recipe with || exit',
    'check-exit: a failing check ends the recipe with || exit',
    'unrecorded: the checks of one line do not each set status=1 and exit with it',
  ]);
  assert.deepEqual(stoppingRecipes(declaredCommands()), []);
});

// A command of a package script or a CI step that stops at a failing check: a check in an `&&` chain with a later
// step, or several checks of which one does not record its failure with `|| status=1` before the command exits with the
// collected status. Preparation steps before the first check may stop the command; an `&&` chain whose later steps read
// the result of the earlier ones holds no check before its last step, as a build before its test.
const SCRIPT_CHECK = new RegExp(`${CHECK.source}|\\btsc --noEmit\\b`);
function stoppingCommand(command: string, project: Project, directory = '.'): string[] {
  const isCheck = (step: string): boolean => SCRIPT_CHECK.test(step) || runsTests(step, project, directory);
  const violations: string[] = [];
  const statements = command.split(/;|\n/).map(statement => statement.trim()).filter(Boolean);
  let checks = 0;
  let collected = true;
  for (const statement of statements) {
    const steps = statement.replace(/\s*\|\|\s*(?:status=1|exit \d+)$/, '').split('&&').map(step => step.trim());
    const first = steps.findIndex(isCheck);
    if (first === -1) continue;
    checks += steps.filter(isCheck).length;
    for (const later of steps.slice(first + 1)) violations.push(`\`${later}\` runs only when \`${steps[first]}\` passed`);
    if (!/\|\|\s*status=1$/.test(statement)) collected = false;
  }
  if (checks > 1 && (!collected || !/(?:^|;\s*)status=0\s*;/.test(command) || !/exit \$\$?status$/.test(command.trim()))) {
    violations.push('the checks do not each set status=1 and the command does not exit with the collected status');
  }
  return violations;
}

test('a package script or a CI step runs every check after an earlier check failed', () => {
  const project = declaredCommands();
  const fixture = { ...project, npm: { '.': { 'test:a': 'node scripts/run-tests.mts node -- a.test.mjs' } } };
  assert.deepEqual(stoppingCommand('npm run build && node scripts/run-tests.mts node -- a.test.mjs', fixture), []);
  assert.deepEqual(stoppingCommand('node scripts/run-tests.mts node -- a.test.mjs && npm run test:a', fixture), [
    '`npm run test:a` runs only when `node scripts/run-tests.mts node -- a.test.mjs` passed',
    'the checks do not each set status=1 and the command does not exit with the collected status',
  ]);
  assert.deepEqual(stoppingCommand('npm run build || exit 1; status=0; npm run test:a || status=1; node scripts/check-documents.mjs || status=1; exit $status', fixture), []);
  assert.deepEqual(stoppingCommand('status=0; npm run test:a; node scripts/check-documents.mjs || status=1; exit $status', fixture), [
    'the checks do not each set status=1 and the command does not exit with the collected status',
  ]);
  assert.deepEqual(stoppingCommand('tsc --noEmit && tsc --noEmit --project tests.json', fixture), [
    '`tsc --noEmit --project tests.json` runs only when `tsc --noEmit` passed',
    'the checks do not each set status=1 and the command does not exit with the collected status',
  ]);

  const violations: string[] = [];
  for (const file of tracked.filter(name => name.endsWith('package.json'))) {
    for (const [script, command] of Object.entries(manifestOf(file).scripts ?? {})) {
      for (const violation of stoppingCommand(command, project, path.posix.dirname(file))) violations.push(`${file} ${script}: ${violation}`);
    }
  }
  for (const file of tracked.filter(name => name.startsWith('.github/workflows/'))) {
    for (const [id, job] of Object.entries(checked(parse(read(file)), workflowSchema, file).jobs ?? {})) {
      for (const step of job.steps ?? []) {
        if (typeof step.run !== 'string') continue;
        for (const violation of stoppingCommand(step.run, project)) violations.push(`${file} ${id} ${step.name ?? step.run.split('\n')[0]}: ${violation}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

// A CI step runs either tests, whose cases each hold their own timeout in the test runner, or a
// long operation: a checkout, a toolchain setup, an install, a build, a lint or type check, an
// upload or a deployment. A long operation prints its own logs and has no time limit, and a job
// has no time limit over its steps, so a normal run that takes longer than usual never fails.
test('CI has no time limit over a long operation, a test step or a job', () => {
  const project = declaredCommands();
  const violations: string[] = [];
  for (const file of tracked.filter(name => name.startsWith('.github/workflows/'))) {
    for (const job of workflowJobs(read(file))) {
      if (job.timeout) violations.push(`${file}:${job.line} ${job.name}: the job has timeout-minutes`);
      for (const step of job.steps) {
        if (!step.timeout) continue;
        const kind = step.run && runsTests(step.run, project) ? 'runs tests' : 'runs a long operation';
        violations.push(`${file}:${step.line} ${job.name} ${step.name ?? step.run ?? step.uses}: ${kind} and has timeout-minutes`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

// The load of the machine changes elapsed time, so a test never asserts an upper or lower bound on
// an elapsed time; it checks the cause instead: an event, a result that only the expected path can
// produce, or an operation that never ends unless the code under test stops it, under the test's
// own timeout. A check that a duration is a finite, non-negative number is not a bound.
test('no test asserts a bound on an elapsed time', () => {
  const CLOCK_BOUND = /\bassert\.ok\([^;]*?(?:(?:performance|Date)\.now\(\)\s*-\s*\w+|\.(?:elapsedMs|durationMs))\s*[<>]=?\s*(?!0\b)[\w.(]/;
  const call = 'assert' + '.ok';
  assert.equal(CLOCK_BOUND.test(`${call}(performance.now() - started < 1_000);`), true);
  assert.equal(CLOCK_BOUND.test(`${call}(result.durationMs > 3 * limit);`), true);
  assert.equal(CLOCK_BOUND.test(`${call}(Number.isFinite(run.durationMs) && run.durationMs >= 0);`), false);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.mts', '*.mjs', '*.js', '*.cjs', '*.ts'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(file => file && existsSync(path.join(ROOT, file)));
  const bounds = files.flatMap(file => read(file).split('\n').flatMap((line, index) => CLOCK_BOUND.test(line) ? [`${file}:${index + 1}`] : []));
  assert.deepEqual(bounds, []);
});

// A program waits for the event of what it waits for (AGENTS): a process exit, a readiness line, a
// file event, a signal. It never sleeps in a loop and never re-reads a state on an interval. A
// timer may only print progress lines, so every `setInterval` callback of a program writes a line.
test('no program waits in an interval loop', () => {
  const sleep = /new Promise\(\(?resolve\)? => setTimeout\(resolve, (?!0\))/;
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.mts', '*.mjs', '*.js', '*.cjs', '*.ts'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(file => file && existsSync(path.join(ROOT, file)))
    .filter(file => !/(?:\.test\.[cm]?[jt]s|\.browser\.mjs)$|(?:^|\/)tests?\//.test(file));
  const loops: string[] = [];
  for (const file of files) {
    const lines = read(file).split('\n');
    lines.forEach((line, index) => {
      if (sleep.test(line)) loops.push(`${file}:${index + 1}: sleeps`);
      if (/\bsetInterval\(/.test(line) && !/\b(?:write|progress|line)\(/.test(lines.slice(index, index + 12).join('\n'))) {
        loops.push(`${file}:${index + 1}: an interval that prints no progress line`);
      }
    });
  }
  assert.deepEqual(loops, []);
});

// cargo fmt formats the crate of a manifest and fails with `Failed to find targets` at a manifest with no package, the
// manifest of a workspace alone; --all formats every member of that workspace.
test('make format-check formats a manifest without a package with --all', () => {
  const manifests = execFileSync('git', ['ls-files', '*Cargo.toml'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(file => file && existsSync(path.join(ROOT, file)));
  const virtual = manifests.filter(file => !/^\[package\]$/m.test(read(file)));
  assert.deepEqual(virtual, ['Cargo.toml']);
  const recipe = declaredCommands().make['format-check']?.commands.join('\n') ?? '';
  assert.match(recipe, /if grep -q '\^\\\[package\\\]' "\$\$manifest"; then all=; else all=--all; fi/);
  assert.match(recipe, /run-rust-command\.mts fmt --check \$\$all --manifest-path "\$\$manifest"/);
});
