// Project commands and the test tools they call. tests/build/test-commands.test.mts uses these to
// require that every test runs through the run-tests tool of @polyspec/kit. `npm test` and `composer test` run a
// declared script, which is checked where it is declared.

import assert from 'node:assert/strict';
import path from 'node:path';
import { parseFeatureManifest } from './features-manifest.mts';
import { checkedShape, shapeOf } from './json-schema.mts';

// The shapes that the helpers of this script check (kit K157, K158): an object, an array, a string and an array of strings.
const OBJECT = shapeOf<Record<string, unknown>>({ type: 'object' });
const STRING = shapeOf<string>({ type: 'string' });

/** A command of a project file, by the name of its script, target or step. */
export interface ProjectCommand {
  name: string;
  command: string;
}

/** The prerequisites and recipe lines of a Makefile target. */
export interface MakeRule {
  prerequisites: string[];
  commands: string[];
}

/** The scripts of a package.json or composer.json: one command or a list of commands. */
export type Scripts = Record<string, string | readonly string[]>;

/** The declared commands that runsTests follows. */
export interface ProjectDeclarations {
  npm: Record<string, Scripts>;
  composer: Record<string, Scripts>;
  workspaces: Record<string, string>;
  make: Record<string, MakeRule>;
  /** The targets that the Makefile hooks into a kit target, as `DOCS_CHECKS += target`, by the kit target's name. */
  hooks?: Record<string, string[]>;
}

/** A step of a workflow job. */
export interface WorkflowStep {
  line: number;
  timeout: boolean;
  name?: string;
  uses?: string;
  run?: string;
}

/** A job of a workflow with its steps. */
export interface WorkflowJob {
  name: string;
  line: number;
  timeout: boolean;
  steps: WorkflowStep[];
}

/** The item at `index` of `items`, inside the bounds that the caller checked. */
function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  assert.ok(item !== undefined);
  return item;
}

/**
 * The commands a tracked file declares: npm or composer scripts, Makefile recipes, CI steps and
 * the verification commands of the feature manifest.
 */
export function projectCommands(file: string, text: string): ProjectCommand[] {
  const name = file.split('/').pop();
  if (file === 'contracts/features.json') {
    return parseFeatureManifest(text, file).features.flatMap(feature => feature.verification.map(item => ({ name: `${feature.id}/${item.id}`, command: item.command })));
  }
  if (name === 'package.json' || name === 'composer.json') {
    const manifest: unknown = JSON.parse(text);
    const scripts = OBJECT(manifest) && manifest.scripts !== undefined ? checkedShape(OBJECT, manifest.scripts, `scripts of ${file}`) : {};
    return Object.entries(scripts).flatMap(([script, value]) => [value].flat().map(command => ({ name: script, command: checkedShape(STRING, command, `script ${script} of ${file}`) })));
  }
  if (name === 'Makefile') {
    const commands: ProjectCommand[] = [];
    let target = '';
    const lines = text.replace(/\\\n\s*/g, ' ').split('\n');
    for (const line of lines) {
      const rule = /^([^\s#][^:=]*):(?!=)/.exec(line);
      if (rule) {
        const [, name] = rule;
        assert.ok(name !== undefined);
        target = name.trim();
      }
      else if (line.startsWith('\t')) commands.push({ name: target, command: line.trim().replace(/^[@-]+/, '') });
    }
    return commands;
  }
  if (file.startsWith('.github/workflows/')) {
    const commands: ProjectCommand[] = [];
    const lines = text.split('\n');
    for (let index = 0; index < lines.length; index++) {
      const step = /^(\s*)(?:- )?run:\s*(.*)$/.exec(itemAt(lines, index));
      if (!step) continue;
      const [, indent, value] = step;
      assert.ok(indent !== undefined && value !== undefined);
      if (value !== '|' && value !== '>') {
        commands.push({ name: `line ${index + 1}`, command: value });
        continue;
      }
      const block: string[] = [];
      while (index + 1 < lines.length && (itemAt(lines, index + 1).trim() === '' || itemAt(lines, index + 1).search(/\S/) > indent.length + 2)) block.push(itemAt(lines, ++index).trim());
      const joined = value === '>' ? [block.join(' ')] : block.join('\n').replace(/\\\n/g, ' ').split('\n');
      for (const command of joined.filter(Boolean)) commands.push({ name: `line ${index + 1}`, command });
    }
    return commands;
  }
  return [];
}

// Test commands use the kit runtime selected by make, the public CLI adapter, or the conformance evidence runner.
const runner = /(?:^|\/)(?:\$\(KIT\)\/run-tests\.\$\(KIT_EXT\)|scripts\/run-tests\.mts|tests\/conformance\/run-suite\.m[jt]s)$/;

/** Whether a project command runs tests: a test script or target, a CI step or a feature verification. */
export function isTestCommand(file: string, name: string): boolean {
  const base = file.split('/').pop();
  if (file === 'contracts/features.json' || file.startsWith('.github/workflows/')) return true;
  if (base === 'Makefile') return /^(?:crudui-)?(?:test|conformance)/.test(name);
  return /(?:^|:)(?:pre)?test(?::|$)/.test(name);
}

/** The Node.js scripts a command starts directly, other than the test runner. */
export function nodeScripts(command: string): string[] {
  const scripts: string[] = [];
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    while (tokens[0] !== undefined && /^[A-Z_][A-Z0-9_]*=/.test(tokens[0])) tokens.shift();
    if (tokens[0]?.split('/').pop() !== 'node') continue;
    let script: string | undefined;
    for (let index = 1; index < tokens.length && !script; index++) {
      if (['--import', '--require', '-r', '--loader', '--env-file'].includes(itemAt(tokens, index))) index++;
      else if (!itemAt(tokens, index).startsWith('-')) script = tokens[index];
    }
    if (script && /\.(?:mjs|cjs|js)$/.test(script) && !runner.test(script)) scripts.push(script);
  }
  return scripts;
}

/** The file arguments of every `node <test runner> node` segment of a command. */
export function nodeTestArguments(command: string): string[] {
  const files: string[] = [];
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    const at = tokens.findIndex(token => runner.test(token));
    if (at === -1 || tokens[at + 1] !== 'node') continue;
    files.push(...tokens.slice(at + 2).filter(token => /\.(?:mjs|mts|cjs|js)$/.test(token)));
  }
  return files;
}

/** Whether a repository path matches a command's file argument, where `*` matches within one segment. */
export function matchesArgument(file: string, argument: string): boolean {
  const pattern = argument.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
  return new RegExp(`^${pattern}$`).test(file);
}

/**
 * The jobs of a workflow with their steps. A job or a step has `timeout` when it declares
 * `timeout-minutes`; a step has `run` (its command) or `uses` (an action).
 */
export function workflowJobs(text: string): WorkflowJob[] {
  const jobs: WorkflowJob[] = [];
  const lines = text.split('\n');
  const jobsAt = lines.findIndex(line => /^jobs:\s*$/.test(line));
  if (jobsAt === -1) return jobs;
  let job: WorkflowJob | undefined;
  let step: WorkflowStep | undefined;
  for (let index = jobsAt + 1; index < lines.length; index++) {
    const line = itemAt(lines, index);
    if (/^\S/.test(line)) break;
    const name = /^ {2}([\w-]+):\s*$/.exec(line);
    if (name) {
      const [, jobName] = name;
      assert.ok(jobName !== undefined);
      job = { name: jobName, line: index + 1, timeout: false, steps: [] };
      step = undefined;
      jobs.push(job);
      continue;
    }
    if (!job) continue;
    if (/^ {4}timeout-minutes:/.test(line)) job.timeout = true;
    const item = /^ {6}- (.*)$/.exec(line);
    if (item) {
      step = { line: index + 1, timeout: false };
      job.steps.push(step);
    }
    const key = item ? /^([\w-]+):\s*(.*)$/.exec(itemAt(item, 1)) : /^ {8}([\w-]+):\s*(.*)$/.exec(line);
    if (!step || !key) continue;
    const [, field, value] = key;
    assert.ok(value !== undefined);
    if (field === 'timeout-minutes') step.timeout = true;
    else if (field === 'name') step.name = value;
    else if (field === 'uses') step.uses = value;
    else if (field === 'run') {
      if (value !== '|' && value !== '>') {
        step.run = value;
        continue;
      }
      const block: string[] = [];
      while (index + 1 < lines.length && (itemAt(lines, index + 1).trim() === '' || itemAt(lines, index + 1).search(/\S/) > 8)) block.push(itemAt(lines, ++index).trim());
      step.run = block.filter(Boolean).join(value === '>' ? ' ' : '\n');
    }
  }
  return jobs;
}

/** The value of an option given as `--name value` or `--name=value`, and the remaining arguments. */
function takeOptions(
  args: string[], names: string[],
): { options: Record<string, string | undefined>, rest: string[] } {
  const options: Record<string, string | undefined> = {};
  const rest: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const [flag, inline] = itemAt(args, index).split(/=(.*)/s);
    assert.ok(flag !== undefined);
    if (names.includes(flag)) options[flag] = inline ?? args[++index];
    else rest.push(itemAt(args, index));
  }
  return { options, rest };
}

/**
 * Whether a command runs tests: it calls the test runner, or an npm script, a Composer
 * script or a Makefile target that is a test command (`isTestCommand`) or that reaches one.
 * `project` holds the declared commands: `npm` and `composer` map a directory to its scripts,
 * `workspaces` maps a package name to its directory and `make` maps a target to its prerequisites
 * and recipe lines.
 */
export function runsTests(
  command: string, project: ProjectDeclarations, directory: string = '.', seen: Set<string> = new Set(),
): boolean {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    while (tokens[0] !== undefined && /^[A-Z_][A-Z0-9_]*=/.test(tokens[0])) tokens.shift();
    if (tokens.some(token => runner.test(token))) return true;
    const reached: [string, string, string][] = [];
    // The Makefile starts npm by its path in the checkout, $(NPM).
    if (tokens[0] === 'npm' || tokens[0] === '$(NPM)') {
      const { options, rest } = takeOptions(tokens.slice(1), ['-w', '--workspace', '--prefix']);
      const [subcommand, script] = rest.filter(token => !token.startsWith('-'));
      assert.ok(subcommand !== undefined);
      const name = ['test', 't'].includes(subcommand) ? 'test' : ['run', 'run-script'].includes(subcommand) ? script : undefined;
      if (!name) continue;
      if (isTestCommand('package.json', name)) return true;
      const workspace = options['-w'] ?? options['--workspace'];
      const target = workspace ? project.workspaces[workspace] : options['--prefix'] ? path.posix.join(directory, options['--prefix']) : directory;
      // A workspace that the project does not declare has no scripts.
      const scripts = target === undefined ? undefined : project.npm[target];
      reached.push(...[scripts?.[name] ?? []].flat().map((value): [string, string, string] => [value, target ?? '.', `npm ${target} ${name}`]));
    } else if (tokens[0] === 'composer') {
      const { options, rest } = takeOptions(tokens.slice(1), ['--working-dir', '-d']);
      const [name] = rest.filter(token => !token.startsWith('-'));
      if (!name) continue;
      if (isTestCommand('composer.json', name)) return true;
      const target = path.posix.join(directory, options['--working-dir'] ?? options['-d'] ?? '.');
      reached.push(...[project.composer[target]?.[name] ?? []].flat().map((value): [string, string, string] => [value, target, `composer ${target} ${name}`]));
    } else if (tokens[0] === 'make' || tokens[0] === '$(MAKE)') {
      for (const target of tokens.slice(1).filter(token => !token.startsWith('-') && !token.includes('='))) {
        if (isTestCommand('Makefile', target)) return true;
        // kit's docs-check runs check-documents and every target of the hook, each regardless of the others.
        for (const hooked of project.hooks?.[target] ?? []) reached.push([`make ${hooked}`, directory, `make ${hooked}`]);
        const rule = project.make[target];
        if (!rule) continue;
        reached.push(...rule.prerequisites.map((prerequisite): [string, string, string] => [`make ${prerequisite}`, directory, `make ${prerequisite}`]));
        reached.push(...rule.commands.map((value): [string, string, string] => [value, directory, `make ${target}`]));
      }
    }
    for (const [value, target, key] of reached) {
      const id = `${key}\n${value}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (runsTests(value, project, target, seen)) return true;
    }
  }
  return false;
}

/** The targets that the Makefile hooks into a kit target: `DOCS_CHECKS += target` gives the target of kit's docs-check. */
export function makeHooks(text: string): Record<string, string[]> {
  const hooks: Record<string, string[]> = {};
  for (const line of text.split('\n')) {
    const hook = /^DOCS_CHECKS\s*\+=\s*(.+?)\s*$/.exec(line);
    if (hook) {
      const [, names] = hook;
      assert.ok(names !== undefined);
      hooks['docs-check'] = [...(hooks['docs-check'] ?? []), ...names.split(/\s+/)];
    }
  }
  return hooks;
}

/** The prerequisites and recipe lines of every Makefile target. */
export function makeTargets(text: string): Record<string, MakeRule> {
  const targets: Record<string, MakeRule> = {};
  let current: MakeRule | undefined;
  for (const line of text.replace(/\\\n\s*/g, ' ').split('\n')) {
    const rule = /^([^\s#.][^:=]*):(?!=)([^#]*)/.exec(line);
    if (rule) {
      const [, names, declared] = rule;
      assert.ok(names !== undefined && declared !== undefined);
      const prerequisites = declared.trim().split(/\s+/).filter(Boolean);
      for (const target of names.trim().split(/\s+/)) targets[target] = current = { prerequisites, commands: [] };
    } else if (line.startsWith('\t') && current) {
      current.commands.push(line.trim().replace(/^[@-]+/, ''));
    }
  }
  return targets;
}
