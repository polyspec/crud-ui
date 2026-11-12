import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkedShape, readShape, shapeOf } from './json-schema.mts';

// The shapes that the helpers of this script check (kit K157, K158): an object, an array, a string and an array of strings.
const OBJECT = shapeOf<Record<string, unknown>>({ type: 'object' });
const STRING = shapeOf<string>({ type: 'string' });
const STRINGS = shapeOf<string[]>({ type: 'array', items: { type: 'string' } });

const repository = join(dirname(fileURLToPath(import.meta.url)), '..');

/** One call that a mocked tool logged to CHECK_LOG. */
interface LoggedCall {
  command: string;
  cwd: string;
  args: string[];
}

/** A line of calls.jsonl, which the mocked tools write, checked. */
function loggedCall(value: unknown): LoggedCall {
  const call = checkedShape(OBJECT, value, 'a logged call');
  return { command: checkedShape(STRING, call.command, 'command of a logged call'), cwd: checkedShape(STRING, call.cwd, 'cwd of a logged call'), args: checkedShape(STRINGS, call.args, 'args of a logged call') };
}

function environment<T>(operation: (root: string) => T): T {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'crudui-doc-check-')));
  try {
    for (const relative of ['scripts', 'bin', 'node_modules/.bin', 'legacy/packages/validator/go', 'legacy/packages/generator/go', 'packages/validator/rust', 'packages/generator/rust']) mkdirSync(join(root, relative), { recursive: true });
    for (const file of ['check-doc-coverage.mts', 'run-rust-command.mts']) {
      copyFileSync(new URL('./' + file, import.meta.url), join(root, 'scripts', file));
    }
    return operation(root);
  } finally { rmSync(root, { recursive: true }); }
}
function mock(root: string, command: string, status = 0): void {
  const file = command === 'typedoc' ? 'node_modules/.bin/typedoc' : `bin/${command}`;
  writeFileSync(join(root, file), `#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.CHECK_LOG, JSON.stringify({command:${JSON.stringify(command)}, cwd:process.cwd(), args:process.argv.slice(2)})+'\\n');process.exit(${status});\n`, { mode: 0o755 });
}
function mockRust(root: string, status = 0): Record<string, string> {
  const cargo = join(root, 'bin/cargo-tool');
  const rustc = join(root, 'bin/rustc-tool');
  const rustdoc = join(root, 'bin/rustdoc-tool');
  writeFileSync(cargo, `#!${process.execPath}\n`
    + `if (process.argv[2] === '--version') process.stdout.write('cargo 1.98.1\\n');\n`
    + `else { require('node:fs').appendFileSync(process.env.CHECK_LOG, `
    + `JSON.stringify({command:'cargo',cwd:process.cwd(),args:process.argv.slice(2)})`
    + `+'\\n'); process.exit(${status}); }\n`, { mode: 0o755 });
  writeFileSync(rustc, `#!${process.execPath}\n`
    + `process.stdout.write('rustc 1.98.1 (test 2026-09-01)\\n`
    + `host: aarch64-test-system\\n');\n`, { mode: 0o755 });
  writeFileSync(rustdoc, `#!${process.execPath}\n`
    + `process.stdout.write('rustdoc 1.98.1 (test 2026-09-01)\\n');\n`, { mode: 0o755 });
  return { CARGO: cargo, RUSTC: rustc, RUSTDOC: rustdoc };
}
function run(root: string, target: string, additions: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: root,
    PATH: join(root, 'bin'),
    CHECK_LOG: join(root, 'calls.jsonl'),
  };
  delete env.GO; delete env.CARGO; delete env.RUSTC; delete env.RUSTDOC; delete env.PHP;
  Object.assign(env, additions);
  return spawnSync(process.execPath, [join(root, 'scripts/check-doc-coverage.mts'), target], { encoding: 'utf8', env });
}
const toolTargets: Array<[target: string, command: string]> = [['go', 'go'], ['rust', 'cargo'], ['php', 'php']];
for (const [target, command] of toolTargets) {
  test(`${target} fails when its required tool is missing`, () => environment(root => {
    const result = run(root, target);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /0 passed/);
    assert.ok(!result.stdout.includes('SKIP'));
  }));
  test(`${target} fails on a tool failure`, () => environment(root => {
    const additions = target === 'rust' ? mockRust(root, 17) : (mock(root, command, 17), {});
    assert.equal(run(root, target, additions).status, 1);
  }));
  test(`${target} checks both current packages`, () => environment(root => {
    const additions = target === 'rust' ? mockRust(root) : (mock(root, command), {});
    const result = run(root, target, additions);
    assert.equal(result.status, 0, result.stderr);
    const calls = readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => loggedCall(JSON.parse(line)));
    if (target === 'php') {
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0]?.args, [join(root, 'scripts/php-doc-coverage.php')]);
    } else {
      assert.deepEqual(calls.map(call => call.cwd), ['validator', 'generator'].map(kind => join(root, target === 'rust' ? 'packages' : 'legacy/packages', kind, target)));
    }
  }));
}
// The documentation of the public TypeScript API is checked by API Extractor, which make lint-ts of kit runs in every package
// with an api-extractor.json: ae-undocumented and ae-forgotten-export are errors of the config/api-extractor.kit.json of the kit
// package, which every api-extractor.json extends (kit K514).
const TS_PACKAGES = ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react', 'vue', 'svelte', 'form-binding'];

test('every TypeScript package checks its public API with API Extractor and commits its API report', () => {
  const problems = [];
  for (const pkg of TS_PACKAGES) {
    const directory = join(repository, 'packages', pkg);
    let config: Record<string, unknown>;
    try { config = checkedShape(OBJECT, readShape(OBJECT, join(directory, 'api-extractor.json')), `${pkg}/api-extractor.json`); } catch (error) { problems.push(`${pkg}: ${error instanceof Error ? error.message : String(error)}`); continue; }
    if (config.extends !== '@polyspec/kit/config/api-extractor.kit.json') problems.push(`${pkg}: extends ${String(config.extends)}`);
    if (config.mainEntryPointFilePath !== '<projectFolder>/dist/index.d.ts') problems.push(`${pkg}: mainEntryPointFilePath ${String(config.mainEntryPointFilePath)}`);
    const name = checkedShape(STRING, checkedShape(OBJECT, readShape(OBJECT, join(directory, 'package.json')), `${pkg}/package.json`).name, `name of ${pkg}/package.json`).replace(/^@[^/]+\//, '');
    try { readFileSync(join(directory, 'etc', `${name}.api.md`), 'utf8'); } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; problems.push(`${pkg}: etc/${name}.api.md is missing`); }
  }
  assert.deepEqual(problems, []);
});

test('API Extractor with the configuration of the kit package fails on an undocumented export', t => {
  mkdirSync(join(repository, 'var/tmp'), { recursive: true });
  const directory = mkdtempSync(join(repository, 'var/tmp/crudui-api-extractor-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'dist'));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: '@polyspec/planted', version: '0.0.0', types: 'dist/index.d.ts' }));
  writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true }, files: ['dist/index.d.ts'] }));
  writeFileSync(join(directory, 'dist/index.d.ts'), '/** A documented value. */\nexport declare const documented: number;\nexport declare function undocumented(): void;\n');
  writeFileSync(join(directory, 'api-extractor.json'), JSON.stringify({
    extends: join(repository, 'node_modules/@polyspec/kit/config/api-extractor.kit.json'), projectFolder: directory, mainEntryPointFilePath: '<projectFolder>/dist/index.d.ts',
  }));
  const result = spawnSync(join(repository, 'node_modules/.bin/api-extractor'), ['run', '--local'], { cwd: directory, encoding: 'utf8' });
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /ae-undocumented/);
});

test('TypeScript is no target of the doc coverage check', () => environment(root => {
  const result = run(root, 'ts');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Use all, go, rust or php/);
}));
test('unknown doc coverage target fails', () => environment(root => {
  assert.notEqual(run(root, 'unknown').status, 0);
}));
