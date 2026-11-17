// Every CI job installs what its commands use before they run (C19.113, C19.115). A rule names a use, the pattern of a
// command line that needs something, and the install target that provides it. Two rules: the polyspec_json extension
// (POLYSPEC_JSON_MODULE, or the module path that PHP_JSON_EXTENSION expands to) by crudui-install-json-php, and the Go
// modules by crudui-install-go-modules, since GOPROXY is off and `go` finds only the modules that were downloaded.
// The jobs are read from the workflows, each target is dry-run with the targets that ci-targets names, and a job is checked
// by the order of its lines. The jobs are computed; none is written out here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MAKEFILE = readFileSync(`${ROOT}/Makefile`, 'utf8');
// Jobs that run no command of their own: the plan, and the ci-passed aggregates.
const SKIPPED = new Set(['kit-ci-plan', 'ci-passed']);
// The values that the workflows pass for their matrix, by make variable.
const MATRIX: Record<string, string> = { SHARD: '1', FORM_SERVERS: 'php', RESULTS: "'[]'" };

interface Rule {
  name: string;
  use: RegExp;
  install: string;
  /** The targets that the Makefile makes depend on the install: a prerequisite prints no line of its own. */
  installers: Set<string>;
  /** The lines that print the install itself, such as its download. */
  download?: RegExp;
}

function rule(name: string, use: RegExp, install: string, download?: RegExp): Rule {
  const depends = [...MAKEFILE.matchAll(new RegExp(`^([A-Za-z0-9_.-]+):[^\\n=]*\\b${install}\\b`, 'gm'))].map(match => match[1] ?? '');
  return { name, use, install, installers: new Set([install, ...depends]), download };
}

const RULES: Rule[] = [
  rule('polyspec_json', /POLYSPEC_JSON_MODULE|polyspec_json/, 'crudui-install-json-php',
    /repository:add composer https:\/\/github\.com\/polyspec\/json|download polyspec\/json:/),
  // A go command of the workspace: `go test`, `go vet`, `go -C dir build`, a `$(GO)` expanded into a path, and the like.
  rule('go modules', /(?:^|[\s"'/])go\s+(?:-C\s+\S+\s+)?(?:test|vet|build|mod|run|list|generate|install)\b/, 'crudui-install-go-modules'),
];

/** Whether a dry-run line runs the install of `rule`: a sub-make of it or of a target that depends on it, or its download. */
function installs(line: string, rule: Rule): boolean {
  if (rule.download?.test(line)) return true;
  const words = line.trim().split(/\s+/);
  return /\bmake\b/.test(line) && rule.installers.has(words[words.length - 1] ?? '');
}

/** The make targets that the workflows run, each with its variables, read from `run: make ...` lines. */
function jobTargets(): { target: string; variables: string[] }[] {
  const found: { target: string; variables: string[] }[] = [];
  for (const file of ['.github/workflows/ci.yml', '.github/workflows/ci-pipeline.yml']) {
    for (const match of readFileSync(`${ROOT}/${file}`, 'utf8').matchAll(/run: make ([^\n]+)/g)) {
      const words = (match[1] ?? '').replace(/'[^']*'/g, "''").split(/\s+/).filter(Boolean);
      const target = words[0] ?? '';
      if (SKIPPED.has(target) || target === '') continue;
      const variables = words.slice(1).filter(word => /^[A-Z_]+=/.test(word)).map(word => {
        const [name, value = ''] = word.split('=', 2) as [string, string];
        return value.includes('${{') ? `${name}=${MATRIX[name] ?? 'x'}` : `${name}=${value}`;
      });
      if (variables.some(variable => variable.startsWith('RUNTIME='))) continue;
      found.push({ target, variables });
    }
  }
  return found;
}

/** The dry-run lines of `target`, with the targets that its ci-targets line names expanded in place (each once). */
function expand(target: string, variables: string[], seen: Set<string>): string[] {
  if (seen.has(target)) return [];
  seen.add(target);
  const dry = makeDryRun(ROOT, target, { variables });
  assert.equal(dry.status, 0, `${target}: ${dry.stderr}`);
  const lines: string[] = [];
  for (const line of dry.stdout.split('\n')) {
    const names = /TARGETS="([^"]*)"/.exec(line)?.[1];
    if (names === undefined) lines.push(line);
    else for (const name of names.split(/\s+/).filter(Boolean)) lines.push(...expand(name, [], seen));
  }
  return lines;
}

/** The job's lines, the first line that uses each rule and the install of that rule must come before it. */
function check(job: string, lines: string[], r: Rule): void {
  const use = lines.findIndex(line => r.use.test(line));
  if (use === -1) return;
  const install = lines.findIndex(line => installs(line, r));
  assert.notEqual(install, -1, `${job} uses the ${r.name} rule but never installs it (${r.install}):\n${lines[use]}`);
  assert.ok(install < use, `${job} installs ${r.name} after it is used (${r.install}):\n${lines[use]}`);
}

for (const { target, variables } of jobTargets()) {
  test(`${target} installs what its commands use before they run`, () => {
    const lines = expand(target, variables, new Set());
    for (const r of RULES) check(target, lines, r);
  });
}

/** The runtimes of config/ci.json, each with the setup targets of its gate (shared setup first). */
const config = JSON.parse(readFileSync(`${ROOT}/config/ci.json`, 'utf8')) as {
  runtimes: string[];
  setup: { shared: string[]; runtimes: Record<string, string[]> };
};
for (const runtime of config.runtimes) {
  test(`the ${runtime} runtime gate installs what its commands use in its setup`, () => {
    const gate = expand(`kit-gates-runtime-${runtime}`, [], new Set());
    const setup = [...config.setup.shared, ...(config.setup.runtimes[runtime] ?? [])];
    for (const r of RULES) {
      if (!gate.some(line => r.use.test(line))) continue;
      assert.ok(setup.includes(r.install), `the ${runtime} runtime gate uses the ${r.name} rule, but its setup in config/ci.json does not install it (${r.install})`);
    }
  });
}
