import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';


const repository = path.resolve(import.meta.dirname, '../..');
const excludedPrefixes = [
  'docs/api/',
  'docs/.web/',
  'docs/.vitepress/',
];
const sourceExtensions = new Set([
  '.c', '.cjs', '.go', '.js', '.mjs', '.mts', '.php', '.rs', '.sh', '.ts', '.tsx', '.vue',
]);
const descriptiveJsonKeys = new Set(['description', 'message', 'note', 'summary', 'title']);
// The word gate is not discouraged: it is the term of kit for its checks (PRINCIPLES P31, make kit-gates,
// .github/workflows/ci-pipeline.yml), which the records of this repository name.
const discouraged: Array<[label: string, pattern: RegExp]> = [
  ['color-coded test status', /\b(?:RED|GREEN)\b/g],
  ['test-path metaphor', /\blanes?\b/gi],
  ['implementation-history wording', /\b(?:ported|porting|copied from|adapted from|inspired by)\b/gi],
  ['등급 비유', /1급/g],
  ['상태 비유', /죽은 코드|반쪽 게이트/g],
  ['이식 이력', /포팅|무수정 적용/g],
];

// Tracked files and new files not yet added, so prose is checked before it is committed.
function trackedFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repository, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split('\0').filter(Boolean)
    .filter(file => !excludedPrefixes.some(prefix => file.startsWith(prefix)))
    .filter(file => existsSync(path.join(repository, file)));
}

function markdownProse(source: string): string {
  return removeInlineCode(source.replace(/^```[^\n]*\n[\s\S]*?^```/gm, ''));
}

function removeInlineCode(source: string): string {
  return source.replace(/`[^`\n]+`/g, '');
}

function sourceComments(source: string): string {
  const comments: string[] = [];
  for (const match of source.matchAll(/\/\*[\s\S]*?\*\//g)) comments.push(match[0]);
  for (const line of source.split('\n')) {
    const slash = line.indexOf('//');
    if (slash >= 0 && line[slash - 1] !== ':') comments.push(line.slice(slash));
    if (/^\s*#(?![!])/.test(line)) comments.push(line);
  }
  return removeInlineCode(comments.join('\n'));
}

function jsonDescriptions(source: string): string {
  const values: string[] = [];
  function visit(value: unknown, key = ''): void {
    if (typeof value === 'string' && descriptiveJsonKeys.has(key)) values.push(value);
    else if (Array.isArray(value)) value.forEach(item => visit(item, key));
    else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    }
  }
  visit(JSON.parse(source));
  return removeInlineCode(values.join('\n'));
}

function maintainedProse(file: string, source: string): string {
  if (file.endsWith('.md')) return markdownProse(source);
  // A JSON file with comments, which oxlint and knip read (.oxlintrc.json, knip.json), holds its prose in its comments.
  if (file.endsWith('.json')) return source.trimStart().startsWith('//') ? sourceComments(source) : jsonDescriptions(source);
  if (sourceExtensions.has(path.extname(file))) return sourceComments(source);
  return '';
}

test('repository prose extraction excludes inline code only', () => {
  assert.equal(markdownProse('Uses `gate` as an identifier.'), 'Uses  as an identifier.');
  assert.equal(sourceComments('// Calls `gate()`.'), '// Calls .');
  assert.equal(
    jsonDescriptions('{"description":"Returns `gate` unchanged."}'),
    'Returns  unchanged.',
  );
  assert.match(markdownProse('The gate accepts the result.'), /\bgates?\b/i);
});

test('maintained repository prose describes current operations directly', () => {
  const failures = [];
  for (const file of trackedFiles()) {
    const source = readFileSync(path.join(repository, file), 'utf8');
    const prose = maintainedProse(file, source);
    for (const [label, pattern] of discouraged) {
      pattern.lastIndex = 0;
      for (const match of prose.matchAll(pattern)) {
        const line = prose.slice(0, match.index).split('\n').length;
        failures.push(`${file}:${line}: ${label}: ${JSON.stringify(match[0])}`);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

// The container tools of a development machine. A tracked file names none of them: the checks run their servers as
// local processes, and CI runs on its own runners. The checklist and the change log keep their history.
const developmentContainerTools = [['container', 'ctl'].join('')];
const historyFiles = new Set([
  'CHANGELOG.md', 'CHANGELOG.ko.md', 'docs/plans/execution-checklist/checklist.md', 'docs/plans/execution-checklist/checklist.ko.md',
]);

test('no tracked tool, Makefile line, workflow or document names a container tool of a development machine', () => {
  const failures = [];
  for (const file of trackedFiles().filter(file => !historyFiles.has(file))) {
    const lines = readFileSync(path.join(repository, file), 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      for (const tool of developmentContainerTools) {
        if (line.toLowerCase().includes(tool)) failures.push(`${file}:${index + 1}: names ${tool}`);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

// The command line tools that run containers on a development machine: the container CLI of macOS,
// Docker and Podman. No tracked tool, Makefile line or workflow invokes one; the checks run on the
// machine or the CI runner itself.
const containerCli = ['contain', 'er'].join('');
const containerInvocations: Array<[label: string, pattern: RegExp]> = [
  ['the container CLI', new RegExp(`(?:^\\s*|[;&|(]\\s*|\\$\\(\\s*|['"\`]|\\b(?:exec|sudo|env)\\s+)${containerCli} (?:build|run|exec|image|images|list|ls|inspect|logs|system|start|stop|rm|delete|create|pull|push|builder)\\b`)],
  ['the container CLI', new RegExp(`command -v ${containerCli}\\b|libexec/${containerCli}\\b|brew [^\\n]*\\b${containerCli}\\b`)],
  ['Docker', new RegExp(`\\b${['dock', 'er'].join('')}\\b`, 'i')],
  ['Podman', new RegExp(`\\b${['pod', 'man'].join('')}\\b`, 'i')],
];
const toolFile = (file: string): boolean => file === 'Makefile' || /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file)
  || sourceExtensions.has(path.extname(file));

test('no tracked tool, Makefile line or workflow invokes a container tool of a development machine', () => {
  assert.equal(containerInvocations[0]?.[1].test('TOOL=x; container run --rm image'), true);
  assert.equal(containerInvocations[1]?.[1].test('command -v container >/dev/null'), true);
  assert.equal(containerInvocations[0]?.[1].test('// the view container holds the form'), false);
  assert.equal(containerInvocations[0]?.[1].test('// minimal container images have no ps'), false);
  const failures = [];
  // This file names the tools in its patterns and cases.
  for (const file of trackedFiles().filter(file => toolFile(file) && file !== 'tests/docs/repository-writing.test.mts')) {
    const lines = readFileSync(path.join(repository, file), 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      for (const [label, pattern] of containerInvocations) {
        if (pattern.test(line)) failures.push(`${file}:${index + 1}: invokes ${label}`);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('no document instructs running a container tool of a development machine', () => {
  const failures = [];
  // A document instructs a command in a code block or an inline code span.
  for (const file of trackedFiles().filter(file => file.endsWith('.md') && !historyFiles.has(file))) {
    const lines = readFileSync(path.join(repository, file), 'utf8').split('\n');
    let block = false;
    for (const [index, line] of lines.entries()) {
      if (/^\s*```/.test(line)) { block = !block; continue; }
      const code = block ? [line] : [...line.matchAll(/`([^`\n]+)`/g)].map(match => {
        assert.ok(match[1] !== undefined, 'the code span group always takes part in a match');
        return match[1];
      });
      for (const command of code) {
        for (const [label, pattern] of containerInvocations) {
          if (pattern.test(command)) failures.push(`${file}:${index + 1}: instructs ${label}`);
        }
      }
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('documentation web output is wired in the Pages workflow and repository ignores', () => {
  const workflow = readFileSync(path.join(repository, '.github', 'workflows', 'pages.yml'), 'utf8');
  const ignore = readFileSync(path.join(repository, '.gitignore'), 'utf8');
  const oldName = String.fromCharCode(115, 105, 116, 101);
  const oldWorkflowPath = ['docs', `.${oldName}`, 'dist'].join('/');
  const oldIgnorePath = ['docs', `.${oldName}`].join('/');
  assert.match(workflow, /docs\/\.web\/dist/);
  assert.match(ignore, /docs\/\.web\//);
  assert.doesNotMatch(workflow, new RegExp(oldWorkflowPath.replaceAll('.', '\\.')));
  assert.doesNotMatch(ignore, new RegExp(oldIgnorePath.replaceAll('.', '\\.')));
});
