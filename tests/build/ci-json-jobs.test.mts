// Every CI job whose commands use the polyspec_json extension (POLYSPEC_JSON_MODULE, or the module path that
// PHP_JSON_EXTENSION expands to) installs it before those commands run (C19.113). The jobs are read from the workflows,
// their targets are dry-run with the targets that ci-targets names, and the job is checked by the order of its lines.
// The list is computed; the expected jobs are not written out here. A job that uses the module with no install fails.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// The install is named by a sub-make line (`make crudui-install-json-php`), or by the sub-make of a target that the Makefile
// makes depend on it (a prerequisite prints no line of its own), or by its own download line.
const MAKEFILE = readFileSync(`${ROOT}/Makefile`, 'utf8');
const INSTALLERS = new Set(['crudui-install-json-php', ...[...MAKEFILE.matchAll(/^([A-Za-z0-9_.-]+):[^\n=]*\bcrudui-install-json-php\b/gm)].map(match => match[1] ?? '')]);
const DOWNLOAD = /repository:add composer https:\/\/github\.com\/polyspec\/json|download polyspec\/json:/;
function installs(line: string): boolean {
  if (DOWNLOAD.test(line)) return true;
  const words = line.trim().split(/\s+/);
  return /\bmake\b/.test(line) && INSTALLERS.has(words[words.length - 1] ?? '');
}
const USE = /POLYSPEC_JSON_MODULE|polyspec_json/;
// Jobs that run no command of their own: the plan, the ci-passed aggregates and the install that prepares the runtime gates.
const SKIPPED = new Set(['kit-ci-plan', 'ci-passed']);
// The values that the workflows pass for their matrix, by make variable.
const MATRIX: Record<string, string> = { SHARD: '1', FORM_SERVERS: 'php', RESULTS: "'[]'" };

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

for (const { target, variables } of jobTargets()) {
  test(`${target} installs the polyspec_json extension before the commands that use it`, () => {
    const lines = expand(target, variables, new Set());
    const use = lines.findIndex(line => USE.test(line));
    if (use === -1) return;
    const install = lines.findIndex(installs);
    assert.notEqual(install, -1, `${target} uses the polyspec_json extension but never installs it:\n${lines[use]}`);
    assert.ok(install < use, `${target} installs the extension after it is used:\n${lines[use]}`);
  });
}

/** The runtimes of config/ci.json, each with the setup targets of its gate (shared setup first). */
const config = JSON.parse(readFileSync(`${ROOT}/config/ci.json`, 'utf8')) as {
  runtimes: string[];
  setup: { shared: string[]; runtimes: Record<string, string[]> };
};
for (const runtime of config.runtimes) {
  test(`the ${runtime} runtime gate installs the polyspec_json extension before the commands that use it`, () => {
    const gate = expand(`kit-gates-runtime-${runtime}`, [], new Set());
    const use = gate.findIndex(line => USE.test(line));
    if (use === -1) return;
    const setup = [...config.setup.shared, ...(config.setup.runtimes[runtime] ?? [])];
    assert.ok(
      setup.includes('crudui-install-json-php'),
      `the ${runtime} runtime gate uses the polyspec_json extension, but its setup in config/ci.json does not install it:\n${gate[use]}`,
    );
  });
}
