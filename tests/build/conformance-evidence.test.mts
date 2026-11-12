import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkConformance, evidenceSuites, readEvidence, readRuns, suiteStates, summarize } from '../../scripts/check-conformance.mts';
import { recordConformance } from '../conformance/evidence.mts';
import { parseJson, type JTDSchemaType } from '../json.mts';

/** A suite run record as tests/conformance/runs.mts writes it. */
interface RunRecord { program: string; tool: string | null; cwd: string; args: string[]; started: string; status: number | null; phpExtensions?: string[] }
const runSchema: JTDSchemaType<RunRecord> = {
  properties: {
    program: { type: 'string' }, tool: { type: 'string', nullable: true }, cwd: { type: 'string' }, args: { elements: { type: 'string' } },
    started: { type: 'string' }, status: { type: 'int32', nullable: true },
  },
  optionalProperties: { phpExtensions: { elements: { type: 'string' } } },
};

const ROOT = path.resolve(import.meta.dirname, '../..');

const fixture = 'tests/fixtures/list-render/cases.json';
const feature = { id: 'renderList', support: { php: 'pass' }, fixtures: [fixture] };
const registry = [{ path: fixture, kind: 'list-html' }];
const base = { features: [feature], registry, cases: { [fixture]: ['a', 'b'] }, families: ['tests/fixtures/list-render'] };
const record = (runtime: string, name: string, passed = true, extra = {}) => ({ feature: 'renderList', fixture, runtime, case: name, passed, ...extra });

test('every case of a supported runtime needs passing evidence', () => {
  const problems = checkConformance({ ...base, evidence: [record('php', 'a'), record('php', 'b', false)] });
  assert.deepEqual(problems.missing, []);
  assert.deepEqual(problems.failed, [{ feature: 'renderList', fixture, runtime: 'php', case: 'b' }]);
  const none = checkConformance({ ...base, evidence: [] });
  assert.deepEqual(none.missing.map(item => item.case), ['a', 'b']);
  assert.deepEqual(summarize(none), [{ id: `renderList · ${fixture} · php`, runtime: 'php', missing: ['a', 'b'], failed: [], suites: [] }]);
});

test('a case recorded twice passes only when every run passed', () => {
  const problems = checkConformance({ ...base, evidence: [record('php', 'a'), record('php', 'a', false), record('php', 'b')] });
  assert.deepEqual(problems.failed.map(item => item.case), ['a']);
});

test('evidence for an undeclared runtime, feature, fixture or case is reported', () => {
  const problems = checkConformance({
    ...base,
    evidence: [
      record('php', 'a'), record('php', 'b'),
      record('go', 'a'),
      record('rust', 'a'),
      record('php', 'c'),
      { ...record('php', 'a'), feature: 'renderTable' },
      { ...record('php', 'a'), fixture: 'tests/fixtures/detail-render/cases.json' },
    ],
  });
  assert.deepEqual(problems.undeclaredEvidence.map(item => item.reason), [
    'runtime not declared by the feature',
    'runtime not declared by the feature',
    'case not in the fixture',
    'unknown feature',
    'fixture not declared by the feature',
  ]);
});

test('unregistered families, unproven fixtures and named fixtures without cases are reported', () => {
  const problems = checkConformance({
    features: [{ ...feature, fixtures: [fixture, 'tests/fixtures/form-session/scenario.mts'] }],
    registry: [
      ...registry,
      { path: 'tests/fixtures/expr/cases.json', kind: 'expression' },
    ],
    cases: { ...base.cases, 'tests/fixtures/expr/cases.json': ['t'] },
    families: ['tests/fixtures/list-render', 'tests/fixtures/expr', 'tests/fixtures/form-session'],
    evidence: [record('php', 'a'), record('php', 'b')],
  });
  assert.deepEqual(problems.unregisteredFamilies, ['tests/fixtures/form-session']);
  assert.deepEqual(problems.unprovenFixtures, ['tests/fixtures/expr/cases.json']);
  assert.deepEqual(problems.undeclaredFixtures, [
    { feature: 'renderList', fixture: 'tests/fixtures/form-session/scenario.mts' },
  ]);
});

test('explicit fixture runtimes preserve every supported runtime without requiring browser cases in core runtimes', () => {
  const browser = 'tests/fixtures/form-session/scenario.mts';
  const features = [{ id: 'viewState', support: { javascript: 'pass', 'javascript-dom': 'pass' }, fixtures: [fixture, browser] }];
  const result = checkConformance({ features, registry: [
    { path: fixture, kind: 'model', runtimes: ['javascript'] },
    { path: browser, kind: 'browser', runtimes: ['javascript-dom'] },
  ], cases: { [fixture]: ['core'], [browser]: ['browser'] }, families: [], evidence: [
    { feature: 'viewState', fixture, runtime: 'javascript', case: 'core', passed: true },
    { feature: 'viewState', fixture: browser, runtime: 'javascript-dom', case: 'browser', passed: true },
  ] });
  assert.deepEqual(result.invalidApplicability, []);
  assert.deepEqual(result.missing, []);
  const excluded = checkConformance({ features, registry: [{ path: fixture, kind: 'model', runtimes: ['javascript'] }],
    cases: { [fixture]: ['core'] }, families: [], evidence: [] });
  assert.ok(excluded.invalidApplicability.some(problem => problem.includes('javascript-dom has no applicable case')));
});

test('operation-specific feature cases require every existing case and reject unknown or empty selections', () => {
  const features = [
    { id: 'bindForm', support: { php: 'pass' }, fixtures: [fixture] },
    { id: 'bindButtons', support: { php: 'pass' }, fixtures: [fixture] },
  ];
  const entry = { path: fixture, kind: 'model', featureCases: { bindForm: ['form'], bindButtons: ['buttons'] } };
  const input = { features, registry: [entry], cases: { [fixture]: ['form', 'buttons'] }, families: [], evidence: [
    { feature: 'bindForm', fixture, runtime: 'php', case: 'form', passed: true },
    { feature: 'bindButtons', fixture, runtime: 'php', case: 'buttons', passed: true },
  ] };
  const result = checkConformance(input);
  assert.deepEqual(result.invalidApplicability, []);
  assert.deepEqual(result.missing, []);
  for (const selection of [{ bindForm: [], bindButtons: ['buttons'] }, { bindForm: ['unknown'], bindButtons: ['buttons'] },
    { bindForm: ['form'], bindButtons: ['buttons'], unknown: ['form'] }, { bindButtons: ['buttons'] }]) {
    assert.notDeepEqual(checkConformance({ ...input, registry: [{ ...entry, featureCases: selection }] }).invalidApplicability, []);
  }
  assert.notDeepEqual(checkConformance({ ...input, registry: [{ ...entry, runtimes: [] }] }).invalidApplicability, []);
  assert.notDeepEqual(checkConformance({ ...input, registry: [{ ...entry, runtimes: ['unknown'] }] }).invalidApplicability, []);
});

test('feature-specific runtime applicability records Python outline setup without claiming it ran in other runtimes', () => {
  const core = 'tests/fixtures/compose/cases.json';
  const features = [
    { id: 'compileForm', support: { python: 'pass', rust: 'pass' }, fixtures: [fixture, core] },
    { id: 'buildOutline', support: { python: 'pass', rust: 'pass' }, fixtures: [fixture] },
  ];
  const entry = { path: fixture, kind: 'outline', runtimes: ['python', 'rust'], featureRuntimes: { compileForm: ['python'] } };
  const coreEntry = { path: core, kind: 'model' };
  const input = { features, registry: [entry, coreEntry],
    cases: { [fixture]: ['outline'], [core]: ['compose'] }, families: [], evidence: [
      { feature: 'compileForm', fixture, runtime: 'python', case: 'outline', passed: true },
      { feature: 'compileForm', fixture: core, runtime: 'python', case: 'compose', passed: true },
      { feature: 'compileForm', fixture: core, runtime: 'rust', case: 'compose', passed: true },
      { feature: 'buildOutline', fixture, runtime: 'python', case: 'outline', passed: true },
      { feature: 'buildOutline', fixture, runtime: 'rust', case: 'outline', passed: true },
  ] };
  const result = checkConformance(input);
  assert.deepEqual(result.invalidApplicability, []);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.undeclaredEvidence, []);
  for (const featureRuntimes of [{ compileForm: [] }, { compileForm: ['php'] }, { unknown: ['python'] }]) {
    assert.notDeepEqual(checkConformance({ ...input, registry: [{ ...entry, featureRuntimes }, coreEntry] }).invalidApplicability, []);
  }
  assert.notDeepEqual(checkConformance({ ...input, registry: [{ ...entry, runtimes: ['python'], featureRuntimes: { compileForm: ['rust'] } }, coreEntry] }).invalidApplicability, []);
  const fabricated = { feature: 'compileForm', fixture, runtime: 'rust', case: 'outline', passed: true };
  assert.notDeepEqual(checkConformance({ ...input, evidence: [...input.evidence, fabricated] }).undeclaredEvidence, []);
});

test('a support module is covered only through registered proven case fixtures and never supplies fabricated cases', () => {
  const module = { path: 'tests/fixtures/form-state/units.mts', kind: 'support-module', supports: [fixture] };
  const input = { ...base, registry: [...registry, module], families: [...base.families, 'tests/fixtures/form-state'],
    evidence: [record('php', 'a'), record('php', 'b')] };
  const result = checkConformance(input);
  assert.deepEqual(result.invalidApplicability, []);
  assert.deepEqual(result.unregisteredFamilies, []);
  assert.deepEqual(result.unprovenFixtures, []);
  assert.deepEqual(result.missing, []);
  for (const changed of [{ ...module, supports: [] }, { ...module, supports: ['missing'] }, { ...module, cases: ['fake'] }]) {
    assert.notDeepEqual(checkConformance({ ...input, registry: [...registry, changed] }).invalidApplicability, []);
  }
});

test('the JavaScript recorder appends one line per case only when an evidence directory is set', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-evidence-'));
  const previous = process.env.CRUDUI_CONFORMANCE_EVIDENCE;
  try {
    delete process.env.CRUDUI_CONFORMANCE_EVIDENCE;
    recordConformance(record('php', 'a'));
    assert.deepEqual(await readdir(directory), []);
    process.env.CRUDUI_CONFORMANCE_EVIDENCE = directory;
    recordConformance(record('php', 'a'));
    recordConformance(record('php', 'b', false));
    const files = await readdir(directory);
    assert.equal(files.length, 1);
    const [file] = files;
    assert.ok(file !== undefined);
    const lines = (await readFile(path.join(directory, file), 'utf8')).trim().split('\n').map((line): unknown => JSON.parse(line));
    assert.deepEqual(lines, [record('php', 'a'), record('php', 'b', false)]);
    // A record that arrives as JSON from a recorder of another language, whose passed is no boolean.
    const parsed: unknown = JSON.parse(JSON.stringify({ ...record('php', 'a'), passed: 'yes' }));
    assert.throws(() => Reflect.apply(recordConformance, undefined, [parsed]), /passed must be a boolean/);
  } finally {
    if (previous === undefined) delete process.env.CRUDUI_CONFORMANCE_EVIDENCE;
    else process.env.CRUDUI_CONFORMANCE_EVIDENCE = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

const suites = [
  { name: 'validator PHP', run: { program: 'tests/conformance/run-suite.mts', tool: 'phpunit', cwd: 'legacy/packages/validator/php' }, runtimes: ['php'] },
  { name: 'native generators', run: { program: 'legacy/tests/native-generators/run.mts' }, runtimes: ['php', 'go'] },
  { name: 'PHP extension', run: { program: 'tests/conformance/run-suite.mts', tool: 'node', argument: 'legacy/packages/php-ext/tests/engine/engine.test.mjs' }, runtimes: ['php-native'] },
  { name: 'Svelte renderer', run: { program: 'tests/conformance/run-suite.mts', tool: 'vitest', cwd: 'packages/svelte' }, runtimes: ['svelte'] },
];
/** The fields of a run record that a case sets; the others take the values of a run of the native suite. */
interface RunFields { program: string; tool?: string; cwd?: string; args?: string[] }
const run = (fields: RunFields, started: string, status: number | null) => ({ tool: null, cwd: '.', args: [], ...fields, started, status });

// CI downloads the evidence of each job into a directory of its own, so files of two jobs with the same name, such as
// php-<pid>.jsonl of processes with the same id on two runners, are both read.
test('the check reads the evidence and the run records of every subdirectory', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-evidence-jobs-'));
  try {
    for (const [job, name] of [['conformance-evidence-php-api-8.4', 'a'], ['conformance-evidence-php-api-8.5', 'b']] as const) {
      await mkdir(path.join(directory, job, 'runs'), { recursive: true });
      await writeFile(path.join(directory, job, 'php-1234.jsonl'), `${JSON.stringify(record('php', name))}\n`);
      await writeFile(path.join(directory, job, 'runs', '1234-0a.json'), `${JSON.stringify(run({ program: 'legacy/tests/native-generators/run.mts' }, '2026-10-07T10:00:00.000Z', 0))}\n`);
      await writeFile(path.join(directory, job, 'runs', '1234-0b.json.partial'), '{');
    }
    await writeFile(path.join(directory, 'javascript-1234.jsonl'), `${JSON.stringify(record('javascript', 'a'))}\n`);
    const { evidence, files } = await readEvidence(directory);
    assert.equal(files, 3);
    assert.deepEqual(evidence.map(item => `${item.runtime} ${item.case}`).sort(), ['javascript a', 'php a', 'php b']);
    assert.equal((await readRuns(directory)).length, 2);
    assert.deepEqual(await readEvidence(path.join(directory, 'missing')), { evidence: [], files: 0 });
    assert.deepEqual(await readRuns(path.join(directory, 'missing')), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing evidence names each suite of its runtime that did not run, did not finish or failed', () => {
  const runs = [
    run({ program: 'tests/conformance/run-suite.mts', tool: 'phpunit', cwd: 'legacy/packages/validator/php' }, '2026-10-05T10:00:00.000Z', 1),
    run({ program: 'tests/conformance/run-suite.mts', tool: 'phpunit', cwd: 'legacy/packages/validator/php' }, '2026-10-05T11:00:00.000Z', 0),
    run({ program: 'tests/conformance/run-suite.mts', tool: 'node', args: ['legacy/packages/php-ext/tests/engine/engine.test.mjs', 'legacy/packages/php-ext/tests/api.test.mjs'] }, '2026-10-05T10:00:00.000Z', null),
    run({ program: 'tests/conformance/run-suite.mts', tool: 'vitest', cwd: 'packages/svelte' }, '2026-10-05T10:00:00.000Z', 0),
    run({ program: 'tests/conformance/run-suite.mts', tool: 'vitest', cwd: 'packages/svelte', args: ['--config', 'vitest.client.config.ts'] }, '2026-10-05T10:01:00.000Z', 2),
    run({ program: 'tests/conformance/run-suite.mts', tool: 'go', cwd: 'legacy/packages/generator/go' }, '2026-10-05T10:00:00.000Z', 1),
  ];
  assert.deepEqual(Object.fromEntries(suiteStates(suites, runs)), {
    'validator PHP': 'passed',
    'native generators': 'did not run',
    'PHP extension': 'did not finish',
    'Svelte renderer': 'ended with failure (exit 2)',
  });
  const problems = checkConformance({ ...base, evidence: [record('php', 'a')] });
  assert.deepEqual(summarize(problems, { suites, runs }), [{
    id: `renderList · ${fixture} · php`, runtime: 'php', missing: ['b'], failed: [],
    suites: [{ name: 'validator PHP', state: 'passed' }, { name: 'native generators', state: 'did not run' }],
  }]);
});

test('every runtime that a feature supports is proven by a declared suite', async () => {
  const standard = parseJson<{ features: { support: Record<string, string> }[] }>(await readFile(path.join(ROOT, 'contracts/features.json'), 'utf8'), {
    properties: { features: { elements: { properties: { support: { values: { type: 'string' } } }, additionalProperties: true } } },
    additionalProperties: true,
  }, 'contracts/features.json');
  const supported = new Set(standard.features.flatMap(item => Object.entries(item.support)
    .filter(([, support]) => support === 'pass').map(([runtime]) => runtime)));
  const proven = new Set(evidenceSuites.flatMap(suite => suite.runtimes));
  assert.deepEqual([...supported].filter(runtime => !proven.has(runtime)).sort(), []);
});

test('PHP source suite runs cannot stand for extension runs and run metadata never replaces case evidence', () => {
  const source = evidenceSuites.find(suite => suite.name === 'generator PHP');
  const native = evidenceSuites.find(suite => suite.name === 'generator PHP extension');
  assert.ok(source && native);
  const record = { program: 'tests/conformance/run-suite.mts', tool: 'phpunit', cwd: 'legacy/packages/generator/php',
    args: ['tests/FormStateTest.php'], started: '2026-10-27T00:00:00.000Z', status: 0 };
  assert.deepEqual([...suiteStates([source, native], [record])], [['generator PHP', 'passed'], ['generator PHP extension', 'did not run']]);
  const extension = { ...record, phpExtensions: ['var/php-ext/polyspec_crudui.so'] };
  assert.deepEqual([...suiteStates([source, native], [extension])], [['generator PHP', 'did not run'], ['generator PHP extension', 'passed']]);
  const required = checkConformance({ ...base, features: [{ ...feature, support: { php: 'pass', 'php-native': 'pass' } }],
    evidence: [{ feature: feature.id, fixture, runtime: 'php', case: 'a', passed: true }] });
  assert.equal(required.missing.filter(item => item.runtime === 'php-native').length, 2);
});

test('the suite runner and the native suite leave a run record with their exit status', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-suite-runs-'));
  try {
    const passing = path.join(directory, 'pass.test.mjs');
    const failing = path.join(directory, 'fail.test.mjs');
    await writeFile(passing, "import test from 'node:test';\ntest('passes', () => {});\n");
    await writeFile(failing, "import test from 'node:test';\ntest('fails', () => { throw new Error('failed'); });\n");
    const evidence = path.join(directory, 'evidence');
    const env: NodeJS.ProcessEnv = { ...process.env, CRUDUI_CONFORMANCE_EVIDENCE: evidence };
    delete env.NODE_TEST_CONTEXT;
    for (const file of [passing, failing]) {
      spawnSync(process.execPath, [path.join(ROOT, 'tests/conformance/run-suite.mts'), 'node', '--', file], { cwd: ROOT, env, encoding: 'utf8' });
    }
    // The native suite records its run before it reads its arguments, so a usage error ends the run.
    spawnSync(process.execPath, [path.join(ROOT, 'legacy/tests/native-generators/run.mts'), '--unknown'], { cwd: ROOT, env, encoding: 'utf8' });
    const runs = await Promise.all((await readdir(path.join(evidence, 'runs'))).map(async file => (
      parseJson(await readFile(path.join(evidence, 'runs', file), 'utf8'), runSchema, file))));
    const summary = runs.map(({ program, tool, cwd, args, status }) => ({ program, tool, cwd, args, status }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    assert.deepEqual(summary, [
      { program: 'legacy/tests/native-generators/run.mts', tool: null, cwd: '.', args: ['--unknown'], status: 1 },
      { program: 'tests/conformance/run-suite.mts', tool: 'node', cwd: '.', args: [failing], status: 1 },
      { program: 'tests/conformance/run-suite.mts', tool: 'node', cwd: '.', args: [passing], status: 0 },
    ]);
    assert.ok(runs.every(item => !Number.isNaN(Date.parse(item.started))));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});


// A legacy runtime proves the copy of a fixture under legacy/ (plan V-6), and the Rust core the shared fixture.
test('a legacy runtime is checked against the copy of the fixture under legacy/', () => {
  const problems = checkConformance({
    features: [{ id: 'f', support: { rust: 'pass', go: 'pass' }, fixtures: ['tests/fixtures/x/cases.json'] }],
    registry: [{ path: 'tests/fixtures/x/cases.json', kind: 'cases' }],
    cases: { 'tests/fixtures/x/cases.json': ['old', 'new'] },
    legacyCases: { 'legacy/tests/fixtures/x/cases.json': ['old'] },
    families: ['tests/fixtures/x'],
    evidence: [
      { feature: 'f', fixture: 'tests/fixtures/x/cases.json', runtime: 'rust', case: 'old', passed: true },
      { feature: 'f', fixture: 'tests/fixtures/x/cases.json', runtime: 'rust', case: 'new', passed: true },
      { feature: 'f', fixture: 'legacy/tests/fixtures/x/cases.json', runtime: 'go', case: 'old', passed: true },
    ],
  });
  assert.deepEqual([problems.missing, problems.failed, problems.undeclaredEvidence], [[], [], []]);
});
