#!/usr/bin/env node
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, stat, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedFiles } from '@polyspec/kit/tracked-files';
import { parseCLIResponse, OperationError, equalOrdered, equalModels, equalState, validateError, validateForm, validateResponse } from './protocol.mts';
import type { ErrorRecord, FormResponse, FormState, JsonObject, Operation, ProtocolRequest, ResponseMap } from './protocol.mts';
import { readJson, type JTDSchemaType } from '../json.mts';
import type * as javascript from './javascript.mts';
import type { NodeVM, WidgetModel } from '@polyspec/crudui-generator-core';
import { formScenarios, numberCases, companySpec, companyData, row, imageCase, urlCase, dateCases, dateFormSpec, dateFormData, dateListSpec } from './cases.mts';
import { failureOf, runCommand } from '@polyspec/kit/run-command';
import { runRustCommand } from '../../scripts/run-rust-command.mts';
import { recordConformance } from '../conformance/evidence.mts';
import { recordSuiteRun } from '../conformance/runs.mts';
import { createProgress } from '@polyspec/kit/test-progress';

/** A protocol request sent to a target: every one names its operation. */
interface InvokeRequest extends ProtocolRequest { readonly operation: string; readonly [member: string]: unknown }
/** The result of one program run of a check. */
interface ExecuteResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error: Error | undefined;
}
interface ExecuteOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Buffer;
}
/** One language program that answers the protocol. */
interface Target {
  name: string;
  command: string;
  args: string[];
  build?: () => Promise<unknown>;
  probe?: () => Promise<void>;
}
/** The conformance features one check proves for its fixture case. */
interface Proves {
  fixture: string;
  case: string;
  model?: string[];
  html?: string[];
}
interface CheckRecord {
  target: string;
  case: string;
  passed: boolean;
  [key: string]: unknown;
}
interface TargetStatus {
  name: string;
  available: boolean;
  passed: boolean;
  command: string;
  args: string[];
  buildMs?: number;
  error?: string | undefined;
  checks?: number;
  failures?: number;
}
interface InputManifest {
  commit?: string;
  digest: string;
  files: Record<string, string | { unavailable: string }>;
}
interface Report {
  completed: boolean;
  passed: boolean;
  targets: TargetStatus[];
  checks: CheckRecord[];
  buildDirectory?: string;
  filter?: { targets: string[]; checks: string[] };
  inputs?: { start: InputManifest; end?: InputManifest };
  summary?: { passed: number; failed: number; unavailable: string[] };
}
/** The members of a thrown value that the report records. */
interface Thrown {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  at?: unknown;
  expected?: unknown;
  actual?: unknown;
}
/** A declared fixture error. */
interface ExpectedError { code: string; message?: string }
interface FormRenderCase { name: string; spec: JsonObject; options?: JsonObject; data?: JsonObject; expectError?: ExpectedError }
// A case that the library rejects holds a member of another JSON type: those members are unknown.
interface CompleteCase { name: string; spec: JsonObject; data: JsonObject; options: JsonObject; render?: unknown; expected_html?: string; expectError?: ExpectedError }
interface ListCase { name: string; spec?: unknown; rows?: unknown; options?: JsonObject; expectError?: ExpectedError }
interface OutlineCase { name: string; spec: JsonObject; data: JsonObject; options: JsonObject; expected_outline_rows?: unknown }
interface DetailCase { name: string; spec?: unknown; record?: unknown; options?: JsonObject; expectError?: ExpectedError }
interface TextCase {
  name: string;
  spec?: JsonObject;
  template?: unknown;
  data?: JsonObject;
  options?: JsonObject;
  /** The action of a form request, { method, args }, as the fixture writes it. */
  action?: unknown;
  rows?: unknown;
  record?: unknown;
  /** 'pass' or the ErrorRecord of the rejection. */
  expect: unknown;
}
const expectedErrorSchema: JTDSchemaType<ExpectedError> = { properties: { code: { type: 'string' } }, optionalProperties: { message: { type: 'string' } } };
const formCaseSchema: JTDSchemaType<FormRenderCase> = {
  properties: { name: { type: 'string' }, spec: { values: {} } },
  optionalProperties: { options: { values: {} }, data: { values: {} }, expectError: expectedErrorSchema },
  additionalProperties: true,
};
const completeCaseSchema: JTDSchemaType<CompleteCase> = {
  properties: { name: { type: 'string' }, spec: { values: {} }, data: { values: {} }, options: { values: {} } },
  optionalProperties: { render: {}, expected_html: { type: 'string' }, expectError: expectedErrorSchema },
  additionalProperties: true,
};
const listCaseSchema: JTDSchemaType<ListCase> = {
  properties: { name: { type: 'string' } },
  optionalProperties: { spec: {}, rows: {}, options: { values: {} }, expectError: expectedErrorSchema },
  additionalProperties: true,
};
const detailCaseSchema: JTDSchemaType<DetailCase> = {
  properties: { name: { type: 'string' } },
  optionalProperties: { spec: {}, record: {}, options: { values: {} }, expectError: expectedErrorSchema },
  additionalProperties: true,
};
const outlineCaseSchema: JTDSchemaType<OutlineCase> = {
  properties: { name: { type: 'string' }, spec: { values: {} }, data: { values: {} }, options: { values: {} } },
  optionalProperties: { expected_outline_rows: {} },
  additionalProperties: true,
};
const textCaseSchema: JTDSchemaType<TextCase> = {
  properties: { name: { type: 'string' } },
  optionalProperties: {
    expect: {}, spec: { values: {} }, template: {}, data: { values: {} }, options: { values: {} },
    action: {}, rows: {}, record: {},
  },
  additionalProperties: true,
};
/** A change of one compiled template with one field: the template, its field list and its field. */
type TemplateChange = (value: JsonObject, fields: unknown[], field: JsonObject) => void;

let dispatch: typeof javascript.dispatch, errorRecord: typeof javascript.errorRecord;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = 'Usage: node tests/native-generators/run.mts --extension /absolute/crudui.so [--report path] [--source-commit hash] [--target names] [--check patterns]';
const argv = process.argv.slice(2);
// The run is recorded before its arguments are read, so every end of the run has its status.
recordSuiteRun({ program: 'tests/native-generators/run.mts', cwd: '.', args: argv });
let extension: string | undefined, reportPath: string | undefined;
let sourceCommit = process.env.CRUDUI_SOURCE_COMMIT;
const selectedTargets: string[] = [], checkPatterns: string[] = [];
for (let index = 0; index < argv.length; index++) {
  const flag = argv[index], value = argv[++index];
  if (!value || flag === undefined || !['--extension', '--report', '--source-commit', '--target', '--check'].includes(flag)) throw new Error(USAGE);
  if (flag === '--extension') extension = value;
  else if (flag === '--source-commit') sourceCommit = value;
  else if (flag === '--target') selectedTargets.push(...value.split(',').filter(Boolean));
  else if (flag === '--check') checkPatterns.push(...value.split(',').filter(Boolean));
  else reportPath = path.resolve(value);
}
const buildDirectory = await mkdtemp(path.join(os.tmpdir(), 'crudui-native-generators-'));
const report: Report = { completed: false, passed: false, targets: [], checks: [], buildDirectory };
if (selectedTargets.length || checkPatterns.length) report.filter = { targets: selectedTargets, checks: checkPatterns };

const seconds = (since: number): string => `${((Date.now() - since) / 1000).toFixed(1)}s`;
// Every check prints its start, a line while it keeps running, and its result.
const lines = createProgress({ write: text => process.stdout.write(text) });
const progress = (text: string): unknown => lines.line(text);
// A build prints a line at this interval while it runs.
const RUNNING_INTERVAL = 5000;
// Every check is independent and runs its own processes, so the checks of every target run in
// one pool, this many at the same time.
const CONCURRENCY = os.availableParallelism();
// A check id is `group:case`; the group selects the time budget.
const groupOf = (name: string): string => name.includes(':') ? name.slice(0, name.indexOf(':')) : name;
const pattern = (text: string): RegExp => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, character => character === '*' ? '.*' : `\\${character}`)}$`);
const checkFilters = checkPatterns.map(pattern);
const selectsCheck = (name: string): boolean => checkFilters.length === 0 || checkFilters.some(filter => filter.test(name) || filter.test(groupOf(name)));
let selectedCount = 0;

// Time budgets are sized from the measured duration of the slowest check in each
// group. Measured on macOS (Apple silicon) across all six targets: form fixtures
// 385 ms, form instances 335 ms, timezone cases 282 ms, detail 124 ms and every other
// group under 100 ms. The budgets below hold for a machine an order of magnitude
// slower. A check that exceeds its budget is killed with the processes it started,
// is reported by id and fails the run, and the next check continues.
const CHECK_BUDGETS: Array<[RegExp, number]> = [
  [/^(?:form-fixture|instance|dates)$/, 20000],
];
const DEFAULT_CHECK_BUDGET = 10000;
const checkBudget = (name: string): number => CHECK_BUDGETS.find(([match]) => match.test(groupOf(name)))?.[1] ?? DEFAULT_CHECK_BUDGET;
const digest = (value: unknown): string => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const jsonValue = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const stateOnly = (value: FormState): FormState => ({ data: value.data, fields: value.fields, html: value.html, revision: value.revision });

// The signal of the running check, in the asynchronous context of that check; every process it
// starts is killed when its budget expires.
const checkSignal = new AsyncLocalStorage<AbortSignal>();
const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
/** A member of a response that must be a JSON object. */
const record = (value: unknown, at: string): JsonObject => {
  assert.ok(object(value), `${at} must be an object`);
  return value;
};
/** The widget model of a node of a response. */
const widgetOf = (node: NodeVM | undefined): WidgetModel => {
  const widget = node?.widget;
  assert.ok(widget !== undefined && !('unsupported' in widget), 'The node has no widget model');
  return widget;
};
const thrown = (error: unknown): Thrown => error !== null && typeof error === 'object' ? error : {};
const messageOf = (error: unknown): string | undefined => {
  const { message } = thrown(error);
  return typeof message === 'string' ? message : undefined;
};

/** Run one program of a check; the check's budget stops it. */
function execute(command: string, args: readonly string[], options: ExecuteOptions = {}): Promise<ExecuteResult> {
  const signal = checkSignal.getStore();
  return new Promise(resolve => {
    let stdout = '', stderr = '', failure: Error | undefined, settled = false;
    const settle = (status: number | null, processSignal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      resolve({ status, signal: processSignal, stdout, stderr, error: failure });
    };
    if (signal?.aborted) {
      failure = new Error('Check budget expired before the process started');
      resolve({ status: null, signal: null, stdout, stderr, error: failure });
      return;
    }
    const child = spawn(command, args, { cwd: options.cwd ?? ROOT, env: options.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'], signal, killSignal: 'SIGKILL' });
    child.stdout.on('data', data => { stdout += data; if (stdout.length > 32 * 1024 * 1024) { failure = new Error('CLI response exceeds 32 MiB'); child.kill('SIGKILL'); } });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', error => { failure = error; settle(null, null); });
    child.on('close', (status, processSignal) => settle(status, processSignal));
    child.stdin.on('error', (error: NodeJS.ErrnoException) => { if (error.code !== 'EPIPE') failure = error; });
    child.stdin.end(options.input ?? '');
  });
}

async function inputManifest(): Promise<InputManifest> {
  const entries: Record<string, string | { unavailable: string }> = {};
  const sourceFile = /\.(?:ts|tsx|js|mjs|cjs|go|rs|php|c|h|css|html|vue|svelte|json|ya?ml|toml|lock|mod|sum|xml|m4)$/;
  // The built output of the packages that the generators read, which Git ignores.
  const walk = async (relative: string): Promise<void> => {
    const directory = await readdir(path.join(ROOT, relative), { withFileTypes: true });
    for (const entry of directory.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && /\.(?:js|mjs|cjs)$/.test(file)) entries[file] = digest(await readFile(path.join(ROOT, file)));
    }
  };
  // The sources are the files of the checkout that Git tracks or does not ignore (checkedFiles of @polyspec/kit/tracked-files).
  const sources = /^(?:packages\/(?:generator-[^/]+|validator-[^/]+|php-ext)|tests\/native-generators|tests\/fixtures\/(?:form-render|list-render|detail-render|form-outline|text-validity))\//;
  for (const file of checkedFiles(ROOT)) {
    if (sources.test(file) && (sourceFile.test(file) || path.basename(file) === 'Makefile')) entries[file] = digest(await readFile(path.join(ROOT, file)));
  }
  for (const directory of ['legacy/packages/generator/ts/dist', 'packages/react/dist', 'legacy/packages/validator/ts/dist']) await walk(directory);
  for (const file of ['package.json', 'package-lock.json']) entries[file] = digest(await readFile(path.join(ROOT, file)));
  if (extension) {
    try { entries[extension] = digest(await readFile(extension)); }
    catch (caught) {
      // readFile rejects with a system error.
      if (!(caught instanceof Error) || !('code' in caught) || caught.code !== 'ENOENT') throw caught;
      entries[extension] = { unavailable: caught.code };
    }
  }
  return { ...(sourceCommit ? { commit: sourceCommit } : {}), digest: digest(entries), files: entries };
}

/** Build the Go program to its end; the build tool prints its own output as it runs. */
async function buildGo(cwd: string): Promise<void> {
  const command = process.env.GO ?? 'go';
  const result = await runCommand({ command, args: ['build', '-o', goBinary, '.'], cwd });
  const failure = failureOf(result);
  if (failure) throw new Error(`${command} build -o ${goBinary} . ${failure}`);
}
// Each language's process is a program beside this suite that calls its package's public API.
const programs = path.join(ROOT, 'tests/native-generators/programs');
const goBinary = path.join(buildDirectory, 'generate-go');
const rustBinary = path.join(programs, 'rust/target/debug/polyspec-crudui-native-generator');
const phpCLI = path.join(programs, 'php/generate.php');
const phpLiteral = (value: string): string => "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
function phpProvenanceSource(autoload: boolean): string {
  const load = autoload ? `require ${phpLiteral(path.join(ROOT, 'vendor/autoload.php'))};` : '';
  return `${load}$out=[];foreach(['generator'=>'Polyspec\\Crudui\\Generator','validator'=>'Polyspec\\Crudui\\Validator','form'=>'Polyspec\\Crudui\\Form'] as $key=>$class){$out[$key]=class_exists($class,false) ? (new ReflectionClass($class))->isInternal() : ${autoload ? '((new ReflectionClass($class))->isInternal())' : 'null'};}echo json_encode($out);`;
}
// A target's `build` is a long operation without a time limit; its `probe` is a short check of the
// program it runs.
const targets: Target[] = [
  { name: 'javascript', command: process.execPath, args: [path.join(ROOT, 'tests/native-generators/javascript.mts')] },
  { name: 'html', command: process.execPath, args: [path.join(ROOT, 'tests/native-generators/javascript.mts'), '--renderer', 'html'] },
  { name: 'python', command: process.env.CRUDUI_PYTHON ?? path.join(ROOT, 'var/python/bin/python'), args: [path.join(ROOT, 'tests/native-generators/python.py')] },
  { name: 'php', command: process.env.PHP ?? 'php', args: [phpCLI], probe: async () => {
    await stat(path.join(ROOT, 'vendor/autoload.php'));
    const result = await execute(process.env.PHP ?? 'php', ['-r', phpProvenanceSource(true)]);
    assert.equal(result.status, 0, result.stderr); assert.equal(result.signal, null);
    assert.equal(result.stderr, '', 'PHP class inspection produced diagnostics');
    assert.deepEqual(JSON.parse(result.stdout), { generator: false, validator: false, form: false }, 'Pure PHP target must use PHP classes; disable the native extension in its configuration');
  } },
  { name: 'go', command: goBinary, args: [], build: () => buildGo(path.join(programs, 'go')) },
  { name: 'rust', command: rustBinary, args: [], build: () => runRustCommand(['build', '--locked'], { cwd: path.join(programs, 'rust') }) },
  { name: 'php-native', command: process.env.PHP ?? 'php', args: ['-d', `extension=${extension ?? ''}`, phpCLI], probe: async () => {
    assert.ok(extension && path.isAbsolute(extension), '--extension must provide an absolute native PHP module path');
    assert.ok((await stat(extension)).isFile(), 'Native PHP module must be a file');
    const source = phpProvenanceSource(false);
    const result = await execute(process.env.PHP ?? 'php', ['-d', `extension=${extension}`, '-r', source]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.signal, null);
    assert.equal(result.stderr, '', 'Native PHP class inspection produced diagnostics');
    assert.deepEqual(JSON.parse(result.stdout), { generator: true, validator: true, form: true }, 'Native PHP target must register all common native classes');
  } },
];

async function invoke<O extends Operation>(target: Target, request: InvokeRequest & { readonly operation: O }, timezone?: string): Promise<ResponseMap[O]>;
async function invoke(target: Target, request: InvokeRequest, timezone?: string): Promise<unknown>;
async function invoke(target: Target, request: InvokeRequest, timezone?: string): Promise<unknown> {
  const args = timezone && target.name.startsWith('php') ? ['-d', `date.timezone=${timezone}`, ...target.args] : target.args;
  const result = await execute(target.command, args, { input: JSON.stringify(request), env: timezone ? { ...process.env, TZ: timezone } : process.env });
  if (result.stderr) report.checks.push({ target: target.name, case: request.operation, diagnostic: result.stderr, passed: false });
  return parseCLIResponse(request, result);
}
// The JavaScript dispatcher is the reference of the protocol: its value is the response of the operation of the request.
// Its response is checked as the response of every other target is.
function reference(request: unknown): unknown {
  const value = jsonValue(dispatch(jsonValue(request)));
  return object(request) ? validateResponse(request, value) : value;
}
/** The reference response of a request that names its operation, as the type of that operation. */
function oracle<O extends Operation>(request: InvokeRequest & { readonly operation: O }): ResponseMap[O] {
  return validateResponse(request, jsonValue(dispatch(jsonValue(request))));
}

/**
 * Conformance evidence of one check: the model features a target proves as its own runtime, and
 * the HTML features it proves as a string renderer. The React reference proves no HTML feature
 * (it is the expected output), and the HTML renderer proves no model feature (it shares the
 * JavaScript model).
 */
function recordEvidence(target: Target, proves: Proves, passed: boolean): void {
  const runtimes: Array<[string, string]> = [
    ...(target.name === 'html' ? [] : (proves.model ?? []).map((feature): [string, string] => [feature, target.name])),
    ...(target.name === 'javascript' ? [] : (proves.html ?? []).map((feature): [string, string] => [feature, target.name === 'html' ? 'javascript-html' : target.name])),
  ];
  for (const [feature, runtime] of runtimes) recordConformance({ feature, fixture: proves.fixture, runtime, case: proves.case, passed });
}

/** Run one check within its budget; it resolves with whether the check passed. */
async function runCheck(target: Target, name: string, operation: () => Promise<JsonObject>, proves?: Proves): Promise<boolean> {
  const id = `${target.name} › ${name}`;
  const started = Date.now(), budget = checkBudget(name);
  const controller = new AbortController();
  let expired: Error | undefined;
  lines.start(id);
  const budgetTimer = setTimeout(() => {
    expired = new Error(`${name} ran ${Date.now() - started} ms and exceeded its ${budget} ms budget; the check and its processes were stopped`);
    controller.abort(expired);
  }, budget);
  const expiry = new Promise<never>((resolve, reject) => controller.signal.addEventListener('abort', () => reject(expired), { once: true }));
  // The race below receives the rejection of expiry; this only observes its settlement when the check ends first.
  void Promise.allSettled([expiry]);
  try {
    const details = await Promise.race([checkSignal.run(controller.signal, operation), expiry]);
    report.checks.push({ target: target.name, case: name, passed: true, durationMs: Date.now() - started, ...details });
    if (proves) recordEvidence(target, proves, true);
    lines.pass(id, Date.now() - started);
    return true;
  } catch (error) {
    const failure = thrown(expired ?? error);
    if (proves) recordEvidence(target, proves, false);
    report.checks.push({ target: target.name, case: name, passed: false, durationMs: Date.now() - started, timedOut: expired !== undefined, error: { name: failure.name, message: failure.message, code: failure.code, at: failure.at, expected: failure.expected, actual: failure.actual } });
    lines.fail(id, Date.now() - started, messageOf(expired ?? error));
    return false;
  } finally {
    clearTimeout(budgetTimer);
  }
}
// The selected checks of every target, run by one pool after the builds.
const queue: Array<() => Promise<boolean>> = [];
function check(target: Target, name: string, operation: () => Promise<JsonObject>, proves?: Proves): void {
  if (!selectsCheck(name)) return;
  selectedCount++;
  queue.push(() => runCheck(target, name, operation, proves));
}
async function runQueue(): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => { for (let job = queue[next++]; job !== undefined; job = queue[next++]) await job(); };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
}
function compareError(actual: ErrorRecord | null | undefined, expected: ErrorRecord): asserts actual is ErrorRecord {
  assert.ok(actual, 'Expected operation to fail');
  assert.equal(actual.code, expected.code, 'Error code differs');
  assert.equal(actual.message, expected.message, 'Error message differs');
  assert.equal(actual.at, expected.at, 'Error path differs');
}
function compareForm(actual: FormResponse, expected: FormResponse, initial: FormState): void {
  equalState(actual, expected);
  assert.equal(actual.steps.length, expected.steps.length);
  let previous = stateOnly(initial);
  for (const [index, a] of actual.steps.entries()) {
    const e = expected.steps[index];
    assert.ok(e, `steps[${index}] is missing from the reference`);
    equalState(a, e);
    equalOrdered(a.result, e.result, `steps[${index}].result`);
    if (e.error === null) assert.equal(a.error, null);
    else { compareError(a.error, e.error); equalState(a, previous); }
    previous = stateOnly(a);
  }
}

progress('inputs: hashing sources and built artifacts');
const manifestStart = Date.now();
report.inputs = { start: await inputManifest() };
progress(`inputs: ${Object.keys(report.inputs.start.files).length} files hashed (${seconds(manifestStart)})`);
({ dispatch, errorRecord } = await import('./javascript.mts'));

// The tracked fixture files hold cases of these shapes.
const formCases = readJson<FormRenderCase[]>(path.join(ROOT, 'tests/fixtures/form-render/cases.json'), { elements: formCaseSchema });
const completeCases = readJson<CompleteCase[]>(path.join(ROOT, 'tests/fixtures/form-complete/cases.json'), { elements: completeCaseSchema });
// Specifications written with array-index member names out of numeric order.
const orderTemplateText = (() => {
  const template = JSON.stringify(jsonValue(dispatch({ operation: 'compileForm' as const, spec: { type: 'group', properties: { s: { type: 'select', label: 'S', items: { x: 'Ex', 1: 'One', 2: 'Two' } } } } })));
  const written = '"items":{"2":"Two","x":"Ex","1":"One"}';
  const parsedOrder = '"items":{"1":"One","2":"Two","x":"Ex"}';
  assert.equal(template.split(parsedOrder).length, 2, 'The member order template must hold one items map');
  return template.replace(parsedOrder, written);
})();
const memberOrderRequests: Array<[string, string]> = [
  ['compile-properties', '{"operation":"compileForm","spec":{"type":"group","properties":{"b":{"type":"text","label":"B"},"10":{"type":"text","label":"Ten"},"a":{"type":"text","label":"A"}}}}'],
  ['compile-composed-properties', '{"operation":"compileForm","spec":{"type":"group","properties":{"$ref":"base.json","$patch":{"10":{"type":"text","label":"Ten"}}}},"options":{"files":{"base.json":{"properties":{"b":{"type":"text","label":"B"},"a":{"type":"text","label":"A"}}}}}}'],
  ['compile-unknown-key', '{"operation":"compileForm","spec":{"type":"group","properties":{"rows":{"type":"text","multiple":{"z":1,"5":1}}}}}'],
  ['bind-select-items', `{"operation":"bindForm","template":${orderTemplateText},"data":{},"options":{}}`],
  ['render-list-columns', '{"operation":"renderList","spec":{"columns":{"b":{"field":"b","label":"B"},"10":{"field":"ten","label":"Ten"},"a":{"field":"a","label":"A"}}},"rows":[{"a":"x","b":"y","ten":"z"}],"options":{"language":"en"}}'],
  ['build-crudui-detail__fields', '{"operation":"buildDetail","spec":{"fields":{"b":{"field":"b","label":"B"},"10":{"field":"ten","label":"Ten"},"a":{"field":"a","label":"A"}}},"record":{"a":"x","b":"y","ten":"z"},"options":{"language":"en"}}'],
  ['render-crudui-detail__fields', '{"operation":"renderDetail","spec":{"fields":{"b":{"field":"b","label":"B"},"10":{"field":"ten","label":"Ten"},"a":{"field":"a","label":"A"}}},"record":{"a":"x","b":"y","ten":"z"},"options":{"language":"en"}}'],
];
// Requests written as standard input text, checked at the process boundary of every program.
const requestCases = ((): Array<[string, string]> => {
  const compiled = (spec: JsonObject): string => JSON.stringify(jsonValue(dispatch({ operation: 'compileForm' as const, spec })));
  const empty = compiled({ type: 'group', properties: {} });
  const named = compiled({ type: 'group', properties: { name: { type: 'text' } } });
  const rows = compiled({ type: 'group', properties: { rows: { type: 'text', multiple: true } } });
  const limited = compiled({ type: 'group', properties: { rows: { type: 'text', multiple: { max: 1 } } } });
  const buttons = compiled({ type: 'group', buttons: [{ type: 'link', text: { ko: '목록', en: 'List' }, href: '../?a=1&b="2"' }, { type: 'submit', name: '__submitted__', value: 'go', design: { class: { 'name == "a"': 'primary', true: 'plain' }, style: 'color: red; width: 5px' } }, { type: 'button', text: 'Back <now>', behavior: { onclick: { label: 'x', script: 'history.back()' } } }], properties: { name: { type: 'text' } } });
  const bareTemplate = '{"kind":"crudui/form-template","fields":[],"buttons":[]}';
  const list = '{"columns":{"v":{"field":"v","label":"V"}}}';
  const detail = '{"fields":{"v":{"field":"v"}}}';
  const evaluated = dispatch({ operation: 'bindButtons' as const, template: jsonValue(JSON.parse(buttons)), data: { name: 'a' }, options: { language: 'en' } });
  // A template that is not exactly the compiled shape (docs/spec/form-runtime.md) is rejected by every operation.
  const reshaped = (change: TemplateChange): string => {
    // named is the compiled template of one field.
    const value = record(jsonValue(JSON.parse(named)), 'template');
    const fields = value['fields'];
    assert.ok(Array.isArray(fields), 'the template has its fields');
    change(value, fields, record(fields[0], 'fields[0]'));
    return JSON.stringify(value);
  };
  const templateShapes = Object.entries<TemplateChange>({
    'fields-missing': value => { delete value.fields; },
    'fields-object': value => { value.fields = {}; },
    'fields-null': value => { value.fields = null; },
    'field-string': value => { value.fields = ['name']; },
    'field-null': (value, fields) => { fields.push(null); },
    'field-name-number': (value, fields, field) => { field.name = 1; },
    'field-spec-missing': (value, fields, field) => { delete field.spec; },
    'field-spec-array': (value, fields, field) => { field.spec = []; },
    'field-children-missing': (value, fields, field) => { delete field.children; },
    'field-children-object': (value, fields, field) => { field.children = {}; },
    'field-child-array': (value, fields, field) => { field.children = [[]]; },
    'field-unknown-member': (value, fields, field) => { field.label = 'Name'; },
    'buttons-missing': value => { delete value.buttons; },
    'buttons-object': value => { value.buttons = {}; },
    'button-string': value => { value.buttons = ['submit']; },
    'button-array': value => { value.buttons = [[]]; },
    'unknown-member': value => { value.version = 1; },
    'kind-missing': value => { delete value.kind; },
    'kind-other': value => { value.kind = 'crudui/form-template-2'; },
    'key-prefix-null': value => { value.keyPrefix = null; },
    'key-prefix-number': value => { value.keyPrefix = 1; },
    'action-string': value => { value.action = '/save'; },
    'action-null': value => { value.action = null; },
  }).flatMap(([name, change]) => ['bindForm', 'bindButtons', 'form'].map((operation): [string, string] => [
    `template-${name}-${operation}`, `{"operation":"${operation}","template":${reshaped(change)},"data":{"name":"a"}}`,
  ]));
  return [
    ...templateShapes,
    ['template-declared-members', `{"operation":"form","template":${reshaped(value => { value.keyPrefix = 'p'; value.action = { url: '/save' }; })},"data":{"name":"a"}}`],
    ['text-two-values', '{} {}'], ['text-truncated', '{'], ['text-empty', ''],
    ['null', 'null'], ['array', '[]'], ['string', '"compileForm"'], ['no-operation', '{}'], ['unknown-operation', '{"operation":"render"}'],
    ...['compileForm', 'bindForm', 'bindButtons', 'form', 'renderList', 'buildList', 'formButtonsHtml'].map((operation): [string, string] => [`missing-input-${operation}`, `{"operation":"${operation}"}`]),
    ['options-null', `{"operation":"form","template":${empty},"options":null}`],
    ['options-array', `{"operation":"bindButtons","template":${bareTemplate},"options":[]}`],
    ['data-array', `{"operation":"form","template":${empty},"data":[]}`],
    ['data-null', `{"operation":"bindForm","template":${empty},"data":null}`],
    ['buttons-data-array', `{"operation":"bindButtons","template":${bareTemplate},"data":[]}`],
    ['buttons-language-number', `{"operation":"bindButtons","template":${bareTemplate},"options":{"language":1}}`],
    ['buttons-template-kind', '{"operation":"bindButtons","template":{"kind":"x"}}'],
    ['actions-null', `{"operation":"form","template":${empty},"actions":null}`],
    ['actions-null-member', `{"operation":"form","template":${empty},"actions":[null]}`],
    ['action-shapes', `{"operation":"form","template":${named},"actions":[[],{"method":"render","args":[]},{"method":1,"args":[]},{"method":"getData"},{"method":"getData","args":{}},{"method":"getData","args":[]}]}`],
    ['option-values-null', `{"operation":"form","template":${named},"data":{},"options":{"language":null,"idPrefix":null,"keyPrefix":null,"unsupported":null}}`],
    ['compile-missing-file', '{"operation":"compileForm","spec":{"type":"group","properties":{"$ref":"missing.json"}}}'],
    ['action-failure-keeps-state', `{"operation":"form","template":${named},"data":{"name":"Ada"},"actions":[{"method":"setData","args":[[]]},{"method":"setValue","args":["name","Grace"]}]}`],
    ['row-actions', `{"operation":"form","template":${rows},"data":{"rows":{"row_a":"A","row_b":"B"}},"actions":[{"method":"addRow","args":["rows",{"key":"row_a"}]},{"method":"moveRow","args":["rows","row_b",0]},{"method":"rekeyRow","args":["rows","row_b","saved_row"]}]}`],
    ['row-actions-limit', `{"operation":"form","template":${limited},"data":{"rows":{"first":"kept"}},"actions":[{"method":"addRow","args":["rows",{"key":"second"}]},{"method":"copyRow","args":["rows","first"]},{"method":"getValue","args":["rows.first"]}]}`],
    ['bind-buttons-declared', `{"operation":"bindButtons","template":${buttons},"data":{"name":"a"},"options":{"language":"en"}}`],
    ['bind-buttons-default', `{"operation":"bindButtons","template":${empty}}`],
    ['buttons-html-declared', JSON.stringify({ operation: 'formButtonsHtml' as const, buttons: evaluated })],
    ['buttons-html-missing', '{"operation":"formButtonsHtml"}'],
    ['buttons-html-null', '{"operation":"formButtonsHtml","buttons":null}'],
    ['buttons-html-number', '{"operation":"formButtonsHtml","buttons":1}'],
    ['buttons-html-member-list', '{"operation":"formButtonsHtml","buttons":[[]]}'],
    ['buttons-html-attribute-id', '{"operation":"formButtonsHtml","buttons":[{"tag":"a","text":"x","attrs":{"id":"i"}}]}'],
    ['buttons-html-attribute-href', '{"operation":"formButtonsHtml","buttons":[{"tag":"a","text":"x","attrs":{"href":1}}]}'],
    ...Object.entries({
      'spec-array': '"spec":[],"rows":[1]', 'spec-string': '"spec":"list"', 'rows-object': `"spec":${list},"rows":{}`,
      'rows-number': `"spec":${list},"rows":[1]`, 'rows-array': `"spec":${list},"rows":[[]]`,
      'context-array': `"spec":${list},"rows":[],"options":{"data":[]}`, 'context-string': `"spec":${list},"rows":[],"options":{"data":"s"}`,
      'context-before-page': `"spec":${list},"rows":[],"options":{"data":[],"page":0}`,
      'page-string': `"spec":${list},"rows":[],"options":{"page":"2"}`, 'page-array': `"spec":${list},"rows":[],"options":{"page":[]}`,
      'page-before-total': `"spec":${list},"rows":[],"options":{"page":0,"total":-1,"layout":"grid"}`,
      'page-fraction': `"spec":${list},"rows":[],"options":{"page":1.5}`, 'page-unsafe': `"spec":${list},"rows":[],"options":{"page":9007199254740992}`,
      'page-safe-total-negative-zero': `"spec":${list},"rows":[],"options":{"page":9007199254740991,"total":-0}`,
      'total-before-layout': `"spec":${list},"rows":[],"options":{"total":-1,"layout":"grid"}`,
      'total-fraction': `"spec":${list},"rows":[],"options":{"total":2.5}`, 'total-boolean': `"spec":${list},"rows":[],"options":{"total":true}`,
      'layout-unknown': `"spec":${list},"rows":[],"options":{"layout":"grid"}`, 'layout-number': `"spec":${list},"rows":[],"options":{"layout":5}`,
      'page-meta-array': `"spec":${list},"rows":[],"options":{"pageMeta":[]}`,
      'options-null-members': `"spec":${list},"rows":[{"v":"a"}],"options":{"data":null,"layout":null,"page":null,"total":null}`,
    }).map(([name, members]): [string, string] => [`list-${name}`, `{"operation":"renderList",${members}}`]),
    ['detail-context-array', `{"operation":"renderDetail","spec":${detail},"record":{},"options":{"data":[]}}`],
    ['detail-context-string', `{"operation":"buildDetail","spec":${detail},"record":{},"options":{"data":"s"}}`],
    ['detail-context-null', `{"operation":"renderDetail","spec":${detail},"record":{},"options":{"data":null}}`],
    ['detail-fields-before-context', '{"operation":"buildDetail","spec":{},"record":{},"options":{"data":[]}}'],
    ['detail-record-array', `{"operation":"renderDetail","spec":${detail},"record":[]}`],
  ];
})();
// Input text cases (docs/spec/input-text.md): JSON text with unpaired surrogate escapes.
const textFamilies: Array<{ feature: string; fixture: string; cases: TextCase[] }> = [];
for (const feature of ['compileForm', 'bindForm', 'createForm', 'buildList', 'buildDetail']) {
  const fixture = `tests/fixtures/text-validity/${feature}/cases.json`;
  textFamilies.push({ feature, fixture, cases: readJson<TextCase[]>(path.join(ROOT, fixture), { elements: textCaseSchema }) });
}
function textRequest(feature: string, fixture: TextCase): InvokeRequest {
  const options = fixture.options ?? {};
  // A case gives its template as JSON text, or the specification it is compiled from.
  const template = () => fixture.template ?? oracle({ operation: 'compileForm' as const, spec: fixture.spec });
  switch (feature) {
    case 'compileForm': return { operation: 'compileForm' as const, spec: fixture.spec, options };
    case 'bindForm': return { operation: 'bindForm' as const, template: template(), data: fixture.data ?? {}, options };
    case 'createForm': return { operation: 'form' as const, template: template(), data: fixture.data ?? {}, options, actions: fixture.action ? [fixture.action] : [] };
    case 'buildList': return { operation: 'buildList' as const, spec: fixture.spec, rows: fixture.rows ?? [], options };
    default: return { operation: 'buildDetail' as const, spec: fixture.spec, record: fixture.record ?? {}, options };
  }
}
const listCases = readJson<ListCase[]>(path.join(ROOT, 'tests/fixtures/list-render/cases.json'), { elements: listCaseSchema });
const detailCases = readJson<DetailCase[]>(path.join(ROOT, 'tests/fixtures/detail-render/cases.json'), { elements: detailCaseSchema });
const outlineCases = readJson<OutlineCase[]>(path.join(ROOT, 'tests/fixtures/form-outline/cases.json'), { elements: outlineCaseSchema });
// Each case of these shared cases.json files is a check `group:name` of every available target; the suite check
// fixture-coverage fails when a selected case has no check of a target, so the count of the checks follows cases.json.
const fixtureFamilies: Array<{ fixture: string; group: string; cases: Array<{ name: string }> }> = [
  { fixture: 'tests/fixtures/form-render/cases.json', group: 'form-fixture', cases: formCases },
  { fixture: 'tests/fixtures/list-render/cases.json', group: 'list', cases: listCases },
  { fixture: 'tests/fixtures/form-outline/cases.json', group: 'outline', cases: outlineCases },
  { fixture: 'tests/fixtures/detail-render/cases.json', group: 'detail', cases: detailCases },
];

const targetNames = targets.map(target => target.name);
for (const name of selectedTargets) assert.ok(targetNames.includes(name), `Unknown target: ${name}; available targets are ${targetNames.join(', ')}`);
const runTargets = selectedTargets.length ? targets.filter(target => selectedTargets.includes(target.name)) : targets;
progress(`targets: ${runTargets.map(target => target.name).join(', ')}${checkPatterns.length ? `; checks matching ${checkPatterns.join(', ')}` : ''}`);

// The build step: each selected target that has a program to build builds it once, before any
// check, with the build tool's output and a line every five seconds, and no time limit. A probe
// then checks the program a target runs, within the budget of a check.
const available: Target[] = [];
for (const target of runTargets) {
  const status: TargetStatus = { name: target.name, available: false, passed: false, command: target.command, args: target.args };
  report.targets.push(status);
  if (target.build) {
    const id = `build: ${target.name} program`;
    const buildStart = Date.now();
    lines.start(id, { group: true });
    const running = setInterval(() => progress(`${id}: still running (${seconds(buildStart)})`), RUNNING_INTERVAL);
    try {
      await target.build();
      status.buildMs = Date.now() - buildStart;
      lines.pass(id, status.buildMs);
    } catch (error) {
      status.error = messageOf(error);
      lines.fail(id, Date.now() - buildStart, messageOf(error));
      continue;
    } finally {
      clearInterval(running);
    }
  }
  const { probe } = target;
  if (probe && !await runCheck(target, 'probe', async () => { await probe(); return {}; })) {
    status.error = `${target.name} probe failed`;
    continue;
  }
  status.available = true;
  available.push(target);
}

for (const target of available) {
  for (const fixture of formCases) check(target, `form-fixture:${fixture.name}`, async () => {
    const compileRequest = { operation: 'compileForm' as const, spec: fixture.spec, options: fixture.options ?? {} };
    const bindingOptions = Object.fromEntries(Object.entries(fixture.options ?? {}).filter(([key]) => ['idPrefix', 'language', 'keyPrefix', 'unsupported'].includes(key)));
    let expectedTemplate, expectedFields, expectedError;
    try { expectedTemplate = oracle(compileRequest); expectedFields = oracle({ operation: 'bindForm' as const, template: expectedTemplate, data: (Object.hasOwn(fixture, 'data') ? fixture.data : {}), options: bindingOptions }); }
    catch (error) { expectedError = errorRecord(error); }
    if (fixture.expectError) {
      assert.equal(expectedError?.code, fixture.expectError.code, 'JavaScript does not meet declared fixture error expectation');
      if (fixture.expectError.message !== undefined) assert.equal(expectedError?.message, fixture.expectError.message, 'JavaScript does not meet the declared fixture error message');
    }
    else assert.equal(expectedError, undefined, 'JavaScript unexpectedly rejected a fixture');
    let actualTemplate, actualFields, actualError;
    try {
      actualTemplate = await invoke(target, compileRequest);
      actualFields = await invoke(target, { operation: 'bindForm' as const, template: actualTemplate, data: (Object.hasOwn(fixture, 'data') ? fixture.data : {}), options: bindingOptions });
    } catch (error) { if (!(error instanceof OperationError)) throw error; actualError = error; }
    if (expectedError) { compareError(actualError, expectedError); return { errorCode: actualError.code }; }
    assert.equal(actualError, undefined);
    equalOrdered(actualTemplate, expectedTemplate, '$.template');
    equalModels(actualFields, expectedFields);
    const foreignFields = await invoke(target, { operation: 'bindForm' as const, template: expectedTemplate, data: (Object.hasOwn(fixture, 'data') ? fixture.data : {}), options: bindingOptions });
    equalModels(foreignFields, expectedFields);
    equalModels(oracle({ operation: 'bindForm' as const, template: actualTemplate, data: (Object.hasOwn(fixture, 'data') ? fixture.data : {}), options: bindingOptions }), expectedFields);
    // Server HTML is byte-identical: the form a target renders equals the reference bytes. A row
    // key the instance generates is random, so each distinct generated key becomes its position.
    const formRequest = { operation: 'form' as const, template: expectedTemplate, data: (Object.hasOwn(fixture, 'data') ? fixture.data : {}), options: bindingOptions };
    const generatedKeys = (html: string): string => {
      const positions = new Map<string, number>();
      return html.replace(/__[0-9a-f]{13}__/g, key => `__generated-${positions.has(key) ? positions.get(key) : positions.set(key, positions.size).get(key)}__`);
    };
    const actualHtml = (await invoke(target, formRequest)).html;
    assert.equal(generatedKeys(actualHtml), generatedKeys(oracle(formRequest).html), 'Raw form HTML differs');
    // The form buttons of the record, as a model and as the footer markup built from that model.
    const buttonsRequest = { operation: 'bindButtons' as const, template: expectedTemplate, data: formRequest.data, options: { language: bindingOptions.language ?? 'ko' } };
    const buttons = await invoke(target, buttonsRequest);
    equalOrdered(buttons, oracle(buttonsRequest), '$.buttons');
    const buttonsHtmlRequest = { operation: 'formButtonsHtml' as const, buttons };
    assert.equal(await invoke(target, buttonsHtmlRequest), oracle(buttonsHtmlRequest), 'Raw button HTML differs');
    return { template: digest(actualTemplate), fields: digest(actualFields), html: digest(actualHtml), interoperability: true };
  }, { fixture: 'tests/fixtures/form-render/cases.json', case: fixture.name, model: ['compileForm', 'bindForm', 'bindButtons', 'formButtonsHtml'], html: ['renderForm'] });

  // The complete form (docs/spec/form-runtime.md, "Complete form"): the bytes the specification
  // writes, which the reference also writes, or the declared failure.
  for (const fixture of completeCases) check(target, `form-complete:${fixture.name}`, async () => {
    const template = oracle({ operation: 'compileForm' as const, spec: fixture.spec });
    const request = { operation: 'renderForm' as const, template, data: fixture.data, options: fixture.options, render: fixture.render };
    let expected: unknown, expectedError: ErrorRecord | undefined;
    try { expected = oracle(request); } catch (error) { expectedError = errorRecord(error); }
    let actual, actualError;
    try { actual = await invoke(target, request); } catch (error) { if (!(error instanceof OperationError)) throw error; actualError = error; }
    if (fixture.expectError) {
      assert.deepEqual({ code: expectedError?.code, message: expectedError?.message }, fixture.expectError, 'JavaScript does not meet the declared fixture error');
      // The declared error proves that the reference failed.
      assert.ok(expectedError !== undefined);
      compareError(actualError, expectedError);
      return { errorCode: actualError.code };
    }
    assert.equal(expected, fixture.expected_html, 'The reference differs from the declared complete form');
    assert.equal(actualError, undefined, 'A complete form request was rejected');
    assert.equal(actual, fixture.expected_html, 'Raw complete form HTML differs');
    return { html: digest(actual) };
  }, { fixture: 'tests/fixtures/form-complete/cases.json', case: fixture.name, html: ['renderForm'] });

  const listFixtures: ListCase[] = [...listCases, imageCase, urlCase];
  for (const fixture of listFixtures) check(target, `list:${fixture.name}`, async () => {
    const request = { operation: 'renderList' as const, spec: fixture.spec, rows: fixture.rows ?? [], options: fixture.options ?? {} };
    let expected, expectedError;
    try { expected = oracle(request); } catch (error) { expectedError = errorRecord(error); }
    if (fixture.expectError) {
      assert.equal(expectedError?.code, fixture.expectError.code, 'JavaScript does not meet the declared fixture error code');
      if (fixture.expectError.message !== undefined) {
        assert.equal(expectedError?.message, fixture.expectError.message, 'JavaScript does not meet the declared fixture error message');
      }
    }
    let actual, actualError;
    try { actual = await invoke(target, request); } catch (error) { if (!(error instanceof OperationError)) throw error; actualError = error; }
    // The list model of the same input: the same members in the same order, or the same error.
    const modelRequest = { ...request, operation: 'buildList' as const };
    let expectedModel, expectedModelError, actualModel, actualModelError;
    try { expectedModel = oracle(modelRequest); } catch (error) { expectedModelError = errorRecord(error); }
    try { actualModel = await invoke(target, modelRequest); } catch (error) { if (!(error instanceof OperationError)) throw error; actualModelError = error; }
    if (expectedModelError) compareError(actualModelError, expectedModelError);
    else {
      assert.equal(actualModelError, undefined);
      equalOrdered(actualModel, expectedModel, '$.list');
    }
    if (expectedError) { compareError(actualError, expectedError); return { errorCode: actualError.code }; }
    assert.equal(actualError, undefined);
    assert.equal(actual, expected, 'Raw list HTML differs');
    // A request without an error returned its response.
    assert.ok(actual !== undefined);
    if (fixture === imageCase) assert.ok(actual.startsWith('<link rel="preload" as="image" href="/b.png"/><link rel="preload" as="image" href="/a.png"/>'));
    if (fixture === urlCase) assert.ok(!actual.includes('alert(1)'), 'Ordinary URL contains the rejected script');
    return { html: digest(actual), model: digest(actualModel), rawHTML: true };
  }, listCases.includes(fixture) ? { fixture: 'tests/fixtures/list-render/cases.json', case: fixture.name, model: ['buildList'], html: ['renderList'] } : undefined);

  check(target, 'build-list-model', async () => {
    const request = {
      operation: 'buildList' as const,
      spec: {
        columns: {
          name: { field: 'name', label: 'Name', format: { type: 'link', href: '/users/{=jointablename.id}/{=join.join.name}.pdf' } },
          active: { field: 'active', format: { type: 'bool', as: 'check' } },
        },
        pagination: { per_page: 10, mode: 'offset' },
        sort: { field: 'name', dir: 'desc' },
        actions: { edit: { label: 'Edit', format: { type: 'link', href: '/edit' } } },
      },
      rows: [{ name: 'Ada', active: 1, jointablename: { id: 7 }, join: { join: { name: 'Ada' } } }],
      options: { language: 'en', page: 2, total: 5 },
    };
    const expected = oracle(request);
    const actual = await invoke(target, request);
    equalOrdered(actual, expected, '$.list');
    return { model: digest(actual) };
  });

  // Form button markup accepts evaluated buttons only, with the same error in every runtime.
  const button = { type: 'submit', tag: 'button', text: 'Save', attrs: { type: 'submit', class: 'crudui-action' } };
  const buttonRejections: Array<[string, unknown]> = [
    ['object', {}], ['string', 'buttons'], ['null-button', [null]], ['array-button', [[]]],
    ['tag', [{ ...button, tag: 'div' }]], ['text', [{ ...button, text: 1 }]], ['attrs-array', [{ ...button, attrs: [] }]],
    ['attribute-name', [{ ...button, attrs: { onmouseover: 'x' } }]], ['attribute-value', [{ ...button, attrs: { class: 1 } }]],
  ];
  for (const [name, buttons] of buttonRejections) check(target, `reject-buttons:${name}`, async () => {
    const request = { operation: 'formButtonsHtml' as const, buttons };
    let expected: ErrorRecord | undefined;
    try { oracle(request); } catch (error) { expected = errorRecord(error); }
    assert.ok(expected, 'JavaScript accepted invalid buttons');
    let actual: OperationError | undefined;
    try { await invoke(target, request); } catch (error) { if (!(error instanceof OperationError)) throw error; actual = error; }
    compareError(actual, expected);
    return { errorCode: actual.code };
  });

  // The process boundary: every program answers the same standard input as the JavaScript
  // reference. Text that is not one JSON value fails with the same input error everywhere.
  for (const [name, text] of requestCases) check(target, `request:${name}`, async () => {
    let request: unknown, parsed = true;
    try { request = JSON.parse(text); } catch (error) { if (!(error instanceof SyntaxError)) throw error; parsed = false; }
    let expected: unknown, expectedError: ErrorRecord | undefined;
    if (!parsed) expectedError = { code: 'INVALID_FORM_INPUT', message: 'Request must be valid JSON', at: '' };
    else try { expected = reference(request); } catch (caught) { expectedError = errorRecord(caught); }
    if (name.startsWith('template-') && name !== 'template-declared-members') {
      assert.deepEqual(expectedError, { code: 'INVALID_FORM_INPUT', message: 'Unsupported form template', at: '' }, 'JavaScript does not meet the template shape contract');
    }
    const result = await execute(target.command, target.args, { input: text });
    assert.equal(result.stderr, '', 'The program wrote diagnostics');
    let actual: unknown, actualError: OperationError | undefined;
    const body: ProtocolRequest = object(request) ? request : {};
    try { actual = parseCLIResponse(body, result); }
    catch (caught) { if (!(caught instanceof OperationError)) throw caught; actualError = caught; }
    if (expectedError) { compareError(actualError, expectedError); return { error: expectedError }; }
    assert.equal(actualError, undefined, `The request was rejected: ${actualError?.message}`);
    if (body.operation === 'bindForm') equalModels(actual, expected);
    else if (body.operation === 'form') {
      validateForm(actual, body.actions);
      validateForm(expected, body.actions);
      equalState(actual, expected);
      assert.equal(actual.steps.length, expected.steps.length);
      actual.steps.forEach((step, index) => {
        const expectedStep = expected.steps[index];
        assert.ok(expectedStep, `steps[${index}] is missing from the reference`);
        equalState(step, expectedStep);
        equalOrdered(step.result, expectedStep.result, `steps[${index}].result`);
        if (expectedStep.error === null) assert.equal(step.error, null);
        else compareError(step.error, expectedStep.error);
      });
    } else equalOrdered(actual, expected, '$');
    return { digest: digest(actual) };
  });

  // Invalid input text fails with the same code, message and location in every program; a
  // request that is not UTF-8 is not JSON text.
  for (const { feature, fixture: file, cases } of textFamilies) for (const fixture of cases) check(target, `text:${feature}:${fixture.name}`, async () => {
    const request = textRequest(feature, fixture);
    let actual: unknown, actualError: OperationError | undefined;
    try { actual = await invoke(target, request); } catch (error) { if (!(error instanceof OperationError)) throw error; actualError = error; }
    // A case with an action is a form request (textRequest).
    let failure: ErrorRecord | null | undefined = actualError ?? null;
    if (fixture.action && actualError === undefined) {
      validateForm(actual, request.actions);
      failure = actual.steps[0]?.error;
    }
    const expect = fixture.expect;
    if (expect === 'pass') {
      assert.equal(failure, null, `The input was rejected: ${failure?.message}`);
      return { passed: true };
    }
    validateError(expect);
    compareError(failure, expect);
    return { error: expect };
  }, { fixture: file, case: fixture.name, model: [feature] });
  check(target, 'text:request-not-utf8', async () => {
    const result = await execute(target.command, target.args, { input: Buffer.from([0x7b, 0x22, 0x6f, 0x22, 0x3a, 0x22, 0xed, 0xa0, 0x80, 0x22, 0x7d]) });
    assert.equal(result.stderr, '', 'The program wrote diagnostics');
    let actualError: OperationError | undefined;
    try { parseCLIResponse({}, result); } catch (caught) { if (!(caught instanceof OperationError)) throw caught; actualError = caught; }
    compareError(actualError, { code: 'INVALID_FORM_INPUT', message: 'Request must be valid JSON', at: '' });
    return { error: 'Request must be valid JSON' };
  });

  // The pagination model: member order and defaults for enabled, declared and disabled paging.
  const paginationCases: Array<[string, unknown, JsonObject]> = [
    ['enabled-defaults', true, {}],
    ['enabled-total', true, { page: 9, total: 41 }],
    ['declared-mode', { mode: 'cursor' }, { total: 0 }],
    ['declared-per-page', { per_page: 7 }, { page: 1 }],
    ['disabled-counts', false, { page: 3, total: 12 }],
    ['absent-counts', undefined, { total: 5 }],
  ];
  for (const [name, pagination, options] of paginationCases) check(target, `list-pagination-model:${name}`, async () => {
    const spec = { columns: { name: { field: 'name', label: 'Name' } }, sort: { field: 'name', dir: 'asc' }, ...(pagination === undefined ? {} : { pagination }) };
    const request = { operation: 'buildList' as const, spec, rows: [], options: { language: 'en', ...options } };
    const actual = await invoke(target, request);
    equalOrdered(actual.pagination, oracle(request).pagination, '$.pagination');
    return { pagination: digest(actual.pagination) };
  });

  // A detail is checked at both levels a runtime exposes: the model and its raw HTML.
  for (const fixture of detailCases) check(target, `detail:${fixture.name}`, async () => {
    const evidence: JsonObject = {};
    for (const operation of ['buildDetail', 'renderDetail'] as const) {
      const request = { operation, spec: fixture.spec, record: fixture.record ?? {}, options: fixture.options ?? {} };
      let expected: unknown, expectedError: ErrorRecord | undefined;
      try { expected = oracle(request); } catch (error) { expectedError = errorRecord(error); }
      if (fixture.expectError) {
        assert.equal(expectedError?.code, fixture.expectError.code, 'JavaScript does not meet the declared fixture error code');
        assert.equal(expectedError?.message, fixture.expectError.message, 'JavaScript does not meet the declared fixture error message');
      } else assert.equal(expectedError, undefined, 'JavaScript unexpectedly rejected a detail fixture');
      let actual: unknown, actualError: OperationError | undefined;
      try { actual = await invoke(target, request); } catch (error) { if (!(error instanceof OperationError)) throw error; actualError = error; }
      if (expectedError) {
        compareError(actualError, expectedError);
        evidence[operation] = { errorCode: actualError.code };
        continue;
      }
      assert.equal(actualError, undefined);
      if (operation === 'buildDetail') equalOrdered(actual, expected, '$.detail');
      else assert.equal(actual, expected, 'Raw detail HTML differs');
      evidence[operation] = digest(actual);
    }
    return { model: evidence.buildDetail, html: evidence.renderDetail, rawHTML: true };
  }, { fixture: 'tests/fixtures/detail-render/cases.json', case: fixture.name, model: ['buildDetail'], html: ['renderDetail'] });

  // The structure map rows of the nodes that bindForm returns, as the fixture states them and as the reference builds them.
  for (const fixture of outlineCases) check(target, `outline:${fixture.name}`, async () => {
    const template = oracle({ operation: 'compileForm' as const, spec: fixture.spec });
    const nodes = oracle({ operation: 'bindForm' as const, template, data: fixture.data, options: fixture.options });
    const request = { operation: 'buildOutline' as const, nodes };
    const expected = oracle(request);
    assert.ok(Array.isArray(fixture.expected_outline_rows), 'The fixture case has no expected_outline_rows');
    equalOrdered(expected, fixture.expected_outline_rows, '$.outline');
    const actual = await invoke(target, request);
    equalOrdered(actual, expected, '$.outline');
    return { model: digest(actual) };
  }, { fixture: 'tests/fixtures/form-outline/cases.json', case: fixture.name, model: ['buildOutline'] });

  for (const [index, item] of numberCases.entries()) check(target, `number:${index}`, async () => {
    const format: { type: string; decimals?: unknown } = { type: 'number' };
    if (Object.hasOwn(item, 'decimals')) format.decimals = item.decimals;
    const request = { operation: 'renderList' as const, spec: { columns: { number: { field: 'number', format } } }, rows: [{ number: item.value }] };
    const expected = oracle(request), actual = await invoke(target, request);
    const cell = `<td class="crudui-list__cell crudui-value crudui-value--number">${item.expected}</td>`;
    assert.ok(expected.includes(cell), `JavaScript number does not match the explicit expectation ${item.expected}`);
    assert.ok(actual.includes(cell), `Native number does not match the explicit expectation ${item.expected}`);
    assert.equal(actual, expected);
    return { expectedNumber: item.expected, html: digest(actual) };
  });

  for (const scenario of formScenarios) check(target, `instance:${scenario.name}`, async () => {
    const compileRequest = { operation: 'compileForm' as const, spec: scenario.spec, options: scenario.compileOptions ?? {} };
    const template = oracle(compileRequest), nativeTemplate = await invoke(target, compileRequest);
    equalOrdered(nativeTemplate, template);
    const initialRequest = { operation: 'form' as const, template: nativeTemplate, data: scenario.data, options: scenario.options ?? {}, actions: [] };
    const initial = await invoke(target, initialRequest), expectedInitial = oracle(initialRequest);
    equalState(initial, expectedInitial);
    const request = { ...initialRequest, actions: scenario.actions };
    const actual = await invoke(target, request), expected = oracle(request);
    compareForm(actual, expected, initial);
    if (scenario.rejectAll) assert.ok(actual.steps.every(step => step.error !== null), 'A declared rejected operation succeeded');
    if (scenario.name === 'keyed-order-and-scoped-operations') {
      assert.deepEqual(Object.keys(record(initial.data.companies, 'companies')), [row(5), row(7), row(1)]);
      assert.ok(actual.steps[2]?.html.includes(`form[companies][${row(5)}][stores][${row(42)}][name]`));
    }
    if (scenario.name === 'repeated-and-language-controls-retain-behavior') {
      assert.equal((actual.html.match(/ onchange=/g) ?? []).length, 4, 'Repeated or language controls lost behavior attributes');
    }
    if (scenario.name === 'only-collection-rows-come-from-data' || scenario.name === 'only-collection-missing-data-has-no-rows') {
      // docs/spec/form-runtime.md: exactly the data's rows under the data's keys; row operations fail unchanged.
      const keys = scenario.name === 'only-collection-rows-come-from-data' ? ['__opt_b2__', '__opt_a1__'] : [];
      assert.deepEqual(Object.keys(record(initial.data.variants ?? {}, 'variants')), keys, 'A data-only collection does not hold exactly the data rows');
      assert.deepEqual([...initial.html.matchAll(/data-crudui-row-key="([^"]*)"/g)].map(match => match[1]), keys, 'A data-only collection renders other rows');
      assert.doesNotMatch(initial.html, /data-crudui-action="(?:add-row|copy-row|remove-row|move-up|move-down)"/, 'A data-only collection renders a row control');
      for (const step of actual.steps) {
        assert.deepEqual(step.error, { code: 'INVALID_FORM_INPUT', message: 'Rows of variants come only from data', at: '' }, 'A row operation on a data-only collection did not fail as declared');
        assert.deepEqual(step.data, initial.data, 'A rejected row operation changed the data');
        assert.equal(step.html, initial.html, 'A rejected row operation changed the view');
      }
    }
    if (scenario.name === 'hidden-group-keeps-values') {
      // docs/spec/form-runtime.md: a field hidden by design.show keeps its value and shows it again.
      const [hidden, edited, shown] = actual.steps;
      // parseCLIResponse validated one step for each of the three actions.
      assert.ok(hidden && edited && shown);
      assert.equal(record(hidden.data.display, 'display').code, 'abc1', 'Hiding a group dropped its value');
      assert.match(hidden.html, /data-field-path="display" hidden=""/, 'The hidden group has no hidden attribute');
      assert.match(hidden.html, /name="display\[code\]"[^>]* value="abc1"/, 'The hidden group does not render its value');
      assert.equal(record(edited.data.display, 'display').code, 'kept', 'A value set while hidden was not kept');
      assert.deepEqual(shown.data.display, { code: 'kept', items: { __opt_a1__: 'row' } }, 'Showing the group changed its values');
      assert.doesNotMatch(shown.html, /data-field-path="display" hidden=""/, 'The shown group is still hidden');
      assert.match(shown.html, /name="display\[code\]"[^>]* value="kept"/, 'The shown group does not render the kept value');
    }
    if (scenario.name === 'explicit-null-does-not-apply-default') {
      assert.equal(actual.data.text, null);
      assert.equal(actual.data.display, null);
      assert.equal(widgetOf(actual.fields[0]).attrs.value, '');
      assert.equal(widgetOf(actual.fields[1]).rawHtml, '');
    }
    if (scenario.name === 'composition-removal-preserves-empty-object-default') {
      assert.deepEqual(nativeTemplate.fields[0]?.spec.default, {}, 'Composition changed an empty object to an array');
      assert.deepEqual(initial.data.value, {}, 'Form defaults changed an empty object to an array');
      assert.deepEqual(actual.data.value, {}, 'Data replacement changed an empty object to an array');
    }
    const injected = await invoke(target, { ...initialRequest, data: {}, actions: [{ method: 'setData', args: [scenario.data] }, { method: 'setData', args: [scenario.data] }] });
    for (const step of injected.steps) {
      assert.equal(step.error, null);
      equalOrdered(step.data, initial.data);
      equalModels(step.fields, initial.fields);
      assert.equal(step.html, initial.html, 'Repeated injection changes raw HTML');
    }
    return { data: digest(actual.data), fields: digest(actual.fields), html: digest(actual.html), steps: actual.steps.length, rawHTML: true };
  }, { fixture: 'tests/native-generators/cases.mts', case: scenario.name, model: ['createForm'] });

  check(target, 'instance:nested-copy-fresh-keys-and-original-values', async () => {
    const template = await invoke(target, { operation: 'compileForm' as const, spec: companySpec, options: { keyPrefix: 'form' } });
    const before = await invoke(target, { operation: 'form' as const, template, data: companyData, options: { language: 'en' } });
    const actual = await invoke(target, { operation: 'form' as const, template, data: companyData, options: { language: 'en' }, actions: [{ method: 'copyRow', args: ['companies', row(5)] }] });
    assert.equal(actual.steps[0]?.error, null);
    const key = actual.steps[0]?.result;
    assert.ok(typeof key === 'string', 'copyRow must return the new row key');
    assert.match(key, /^__[0-9a-f]{13}__$/);
    const beforeCompanies = record(before.data.companies, 'companies'), actualCompanies = record(actual.data.companies, 'companies');
    assert.ok(!Object.hasOwn(beforeCompanies, key));
    assert.deepEqual(Object.keys(actualCompanies), [row(5), key, row(7), row(1)]);
    for (const oldKey of Object.keys(beforeCompanies)) equalOrdered(actualCompanies[oldKey], beforeCompanies[oldKey]);
    const copied = record(actualCompanies[key], key), original = record(beforeCompanies[row(5)], row(5));
    assert.equal(copied.name, original.name);
    const originalStoreRows = record(original.stores, 'stores'), copiedStoreRows = record(copied.stores, 'stores');
    const originalStores = Object.keys(originalStoreRows), copiedStores = Object.keys(copiedStoreRows);
    assert.equal(copiedStores.length, originalStores.length);
    for (const [index, copiedStore] of copiedStores.entries()) {
      assert.match(copiedStore, /^__[0-9a-f]{13}__$/);
      assert.ok(!Object.hasOwn(originalStoreRows, copiedStore));
      const originalStore = originalStores[index];
      assert.ok(originalStore !== undefined, `the original store ${index} is missing`);
      equalOrdered(copiedStoreRows[copiedStore], originalStoreRows[originalStore]);
    }
    const expected = oracle({ operation: 'form' as const, template, data: actual.data, options: { language: 'en' } });
    equalOrdered(actual.data, expected.data);
    equalModels(actual.fields, expected.fields);
    assert.equal(actual.html, expected.html, 'HTML from the actual generated keys differs from JavaScript');
    const injected = await invoke(target, { operation: 'form' as const, template, data: companyData, options: { language: 'en' }, actions: [{ method: 'setData', args: [actual.data] }] });
    equalOrdered(injected.data, actual.data);
    equalModels(injected.fields, actual.fields);
    assert.equal(injected.html, actual.html, 'Copied data injection changes raw HTML');
    return { actual, rawHTML: true, generatedKeysPreserved: true };
  });

  check(target, 'instance:missing-repeated-data-creates-one-row', async () => {
    const spec = { type: 'group', properties: { tags: { type: 'text', multiple: true, default: 'new' } } };
    const template = await invoke(target, { operation: 'compileForm' as const, spec });
    const actual = await invoke(target, { operation: 'form' as const, template, data: {} });
    const tags = record(actual.data.tags, 'tags');
    const keys = Object.keys(tags);
    const [key] = keys;
    assert.equal(keys.length, 1); assert.ok(key !== undefined); assert.match(key, /^__[0-9a-f]{13}__$/); assert.equal(tags[key], 'new');
    const expected = oracle({ operation: 'form' as const, template, data: actual.data });
    equalState(actual, expected);
    return { actual, generatedKeysPreserved: true };
  });

  const dataRejections: Array<[string, unknown]> = [['null-root', null], ['array-root', []], ['null-collection', { companies: null }], ['array-collection', { companies: [] }], ['numeric-row-key', { companies: { 5: { name: 'Five', stores: {} } } }]];
  for (const [name, data] of dataRejections) check(target, `reject:${name}`, async () => {
    const request = { operation: 'form' as const, template: oracle({ operation: 'compileForm' as const, spec: companySpec }), data };
    let expected: ErrorRecord | undefined;
    try { oracle(request); } catch (caught) { expected = errorRecord(caught); }
    assert.equal(expected?.code, 'INVALID_FORM_INPUT', 'JavaScript accepted invalid form input');
    let error: OperationError | undefined;
    try { await invoke(target, request); } catch (caught) { if (!(caught instanceof OperationError)) throw caught; error = caught; }
    assert.ok(error, 'Invalid form input was accepted');
    compareError(error, expected);
    return { error: expected };
  });

  const groupSpec = { type: 'group', properties: { address: { type: 'group', properties: { city: { type: 'text' }, geo: { type: 'group', properties: { lat: { type: 'text' } } } } } } };
  const shapeRejections: Array<[string, JsonObject, unknown, string]> = [
    ['array-collection', companySpec, { companies: [] }, 'Repeated data must be a keyed object: companies'],
    ['null-collection', companySpec, { companies: null }, 'Repeated data must be a keyed object: companies'],
    ['scalar-collection', companySpec, { companies: 'one' }, 'Repeated data must be a keyed object: companies'],
    ['nested-array-collection', companySpec, { companies: { [row(1)]: { name: 'One', stores: [] } } }, `Repeated data must be a keyed object: companies.${row(1)}.stores`],
    ['scalar-group-row', companySpec, { companies: { [row(1)]: 'One' } }, `Group data must be an object: companies.${row(1)}`],
    ['null-nested-group-row', companySpec, { companies: { [row(1)]: { name: 'One', stores: { [row(2)]: null } } } }, `Group data must be an object: companies.${row(1)}.stores.${row(2)}`],
    ['scalar-group', groupSpec, { address: 'Seoul' }, 'Group data must be an object: address'],
    ['array-nested-group', groupSpec, { address: { city: 'Seoul', geo: [] } }, 'Group data must be an object: address.geo'],
  ];
  const declarationRejections: Array<[string, JsonObject, string]> = [
    ['multiple-string', { type: 'text', multiple: 'yes' }, 'Invalid multiple at rows: expected a boolean, only or an object'],
    ['multiple-all', { type: 'text', multiple: 'all' }, 'Invalid multiple at rows: expected a boolean, only or an object'],
    ['multiple-only-string', { type: 'group', multiple: { only: 'yes' }, properties: {} }, 'Invalid multiple.only at rows: expected a boolean'],
    ...['min', 'max', 'copy', 'sortable', 'controls', 'onclick'].map((key): [string, JsonObject, string] => [
      `multiple-only-with-${key}`,
      { type: 'group', multiple: { only: true, [key]: { min: 1, max: 3, copy: true, sortable: true, controls: 'header', onclick: 'go()' }[key] }, properties: {} },
      `Invalid multiple.${key} at rows: unknown key`,
    ]),
    ['multiple-min-string', { type: 'text', multiple: { min: '1' } }, 'Invalid multiple.min at rows: expected a number'],
    ['multiple-copy-object', { type: 'text', multiple: { copy: {} } }, 'Invalid multiple.copy at rows: expected a boolean'],
    ['design-array', { type: 'text', design: [] }, 'Invalid design at rows: expected a boolean or an object'],
    ['design-show-number', { type: 'text', design: { show: 1 } }, 'Invalid design.show at rows: expected an expression, a boolean or a condition map'],
    ['design-class-empty-map', { type: 'text', design: { class: {} } }, 'Invalid design.class at rows: expected a string or a condition map'],
    ['design-node-string', { type: 'text', design: { wrapper: 'box' } }, 'Invalid design.wrapper at rows: expected an object'],
    ['multiple-title-not-group', { type: 'text', multiple: { title: 'name' } }, 'Invalid multiple.title at rows: expected a repeated group'],
    ['multiple-title-repeated-child', { type: 'group', multiple: { title: 'tags' }, properties: { tags: { type: 'text', multiple: true } } }, 'Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang'],
    ['multiple-controls-unknown', { type: 'text', multiple: { controls: 'side' } }, 'Invalid multiple.controls at rows: expected header, footer or outline'],
    ['multiple-header-unknown', { type: 'text', multiple: { header: 'fixed' } }, 'Invalid multiple.header at rows: expected static or sticky'],
    ['lang-null', { type: 'text', lang: null }, 'Invalid lang at rows: expected a boolean or an object'],
    ['lang-only-mixed', { type: 'text', lang: { only: ['ko', 3] } }, 'Invalid lang.only at rows: expected a list of language codes or an object'],
    ['nested-design-node-style', { type: 'group', properties: { name: { type: 'text', design: { label: { style: null } } } } }, 'Invalid design.label.style at rows.name: expected a string or a condition map'],
    ['multiple-unknown-key', { type: 'text', multiple: { min: 1, maximum: 3 } }, 'Invalid multiple.maximum at rows: unknown key'],
    ['multiple-unknown-before-value', { type: 'text', multiple: { min: 'x', foo: 1 } }, 'Invalid multiple.foo at rows: unknown key'],
    ['lang-unknown-key', { type: 'text', lang: { only: ['ko'], languages: ['en'] } }, 'Invalid lang.languages at rows: unknown key'],
    ['design-unknown-key', { type: 'text', design: { class: 'a', color: 'red' } }, 'Invalid design.color at rows: unknown key'],
    ['design-node-unknown-key', { type: 'text', design: { label: { class: 'a', text: 'Name' } } }, 'Invalid design.label.text at rows: unknown key'],
    ['behavior-unknown-key', { type: 'text', behavior: { onclick: 'go()', onsubmit: 'send()' } }, 'Invalid behavior.onsubmit at rows: unknown key'],
  ];
  for (const [name, field, message] of declarationRejections) check(target, `compile-reject:${name}`, async () => {
    const request = { operation: 'compileForm' as const, spec: { type: 'group', properties: { rows: field } } };
    let expected: ErrorRecord | undefined;
    try { oracle(request); } catch (caught) { expected = errorRecord(caught); }
    assert.deepEqual(expected, { code: 'INVALID_FORM_INPUT', message, at: '' }, 'JavaScript does not meet the declaration rejection contract');
    let error: OperationError | undefined;
    try { await invoke(target, request); } catch (caught) { if (!(caught instanceof OperationError)) throw caught; error = caught; }
    assert.ok(error, 'A declaration with a wrong value type was accepted');
    compareError(error, expected);
    return { error: expected };
  });
  // Member order: requests are sent as JSON text, so array-index member names arrive in the order they were written
  // (a JavaScript object would already hold them first). Order is judged where it survives parsing: arrays, HTML and messages.
  for (const [name, text] of memberOrderRequests) check(target, `member-order:${name}`, async () => {
    const request = record(JSON.parse(text), 'member order request');
    let expected: unknown, expectedError: ErrorRecord | undefined;
    try { expected = reference(request); } catch (caught) { expectedError = errorRecord(caught); }
    let actual: unknown, actualError: OperationError | undefined;
    try {
      const result = await execute(target.command, target.args, { input: text, env: process.env });
      actual = parseCLIResponse(request, result);
    } catch (caught) { if (!(caught instanceof OperationError)) throw caught; actualError = caught; }
    if (expectedError) { compareError(actualError, expectedError); return { error: expectedError }; }
    assert.equal(actualError, undefined, 'A member order request was rejected');
    if (typeof expected === 'string') assert.equal(actual, expected, 'Member order HTML differs');
    else if (request.operation === 'bindForm') equalModels(actual, expected);
    else equalOrdered(actual, expected, '$');
    return { digest: digest(actual) };
  });
  const optionRejections: Array<[string, JsonObject, string]> = [
    ['language-number', { language: 5, keyPrefix: 5 }, 'Language must be a string'],
    ['key-prefix-number', { language: 'fr', keyPrefix: 5 }, 'keyPrefix must be a string'],
    ['id-prefix-array', { idPrefix: [] }, 'idPrefix must be a string'],
    ['unsupported-boolean', { unsupported: true }, 'unsupported must be throw or marker'],
    ['unsupported-other', { language: 'fr', unsupported: 'other' }, 'unsupported must be throw or marker'],
    ['language-unsupported', { language: 'fr', idPrefix: null }, 'Unsupported language: fr'],
  ];
  // The operation is the outer loop so each check group runs as one contiguous group.
  for (const operation of ['bindForm', 'form'] as const) for (const [name, options, message] of optionRejections) check(target, `${operation}-option-reject:${name}`, async () => {
    const request = { operation, template: oracle({ operation: 'compileForm' as const, spec: companySpec }), data: companyData, options };
    let expected: ErrorRecord | undefined;
    try { oracle(request); } catch (caught) { expected = errorRecord(caught); }
    assert.deepEqual(expected, { code: 'INVALID_FORM_INPUT', message, at: '' }, 'JavaScript does not meet the option rejection contract');
    let error: OperationError | undefined;
    try { await invoke(target, request); } catch (caught) { if (!(caught instanceof OperationError)) throw caught; error = caught; }
    assert.ok(error, 'An option with the wrong type was accepted');
    compareError(error, expected);
    return { error: expected };
  });
  for (const operation of ['bindForm', 'form'] as const) for (const [name, spec, data, message] of shapeRejections) check(target, `${operation}-shape-reject:${name}`, async () => {
    const request = { operation, template: oracle({ operation: 'compileForm' as const, spec }), data };
    let expected: ErrorRecord | undefined;
    try { oracle(request); } catch (caught) { expected = errorRecord(caught); }
    assert.deepEqual(expected, { code: 'INVALID_FORM_INPUT', message, at: '' }, 'JavaScript does not meet the data shape rejection contract');
    let error: OperationError | undefined;
    try { await invoke(target, request); } catch (caught) { if (!(caught instanceof OperationError)) throw caught; error = caught; }
    assert.ok(error, 'Data with the wrong shape was accepted');
    compareError(error, expected);
    return { error: expected };
  });

  for (const timezone of ['UTC', 'Asia/Seoul', 'America/Los_Angeles']) check(target, `dates:${timezone}`, async () => {
    const template = await invoke(target, { operation: 'compileForm' as const, spec: dateFormSpec }, timezone);
    const request = { operation: 'form' as const, template, data: dateFormData, options: { idPrefix: 'utc-dates' } };
    const initial = await invoke(target, request, timezone), expected = oracle(request);
    equalState(initial, expected);
    equalOrdered(initial.data, dateFormData);
    for (const [index, item] of dateCases.entries()) {
      assert.equal(widgetOf(initial.fields[index * 2]).attrs.value, item.date, `Date control changed ${JSON.stringify(item.value)}`);
      assert.equal(widgetOf(initial.fields[index * 2 + 1]).attrs.value, item.datetime, `Datetime control changed ${JSON.stringify(item.value)}`);
    }
    const injected = await invoke(target, { ...request, data: {}, actions: [{ method: 'setData', args: [dateFormData] }, { method: 'setData', args: [{}] }, { method: 'setData', args: [dateFormData] }] }, timezone);
    const [injectedStep, clearedStep, restoredStep] = injected.steps;
    // parseCLIResponse validated one step for each of the three actions.
    assert.ok(injectedStep && clearedStep && restoredStep);
    for (const step of [injectedStep, restoredStep]) {
      assert.equal(step.error, null);
      equalOrdered(step.data, initial.data);
      equalModels(step.fields, initial.fields);
      assert.equal(step.html, initial.html, 'Date injection or restoration changes raw HTML');
    }
    const empty = oracle({ ...request, data: {} });
    assert.equal(clearedStep.error, null);
    equalOrdered(clearedStep.data, empty.data);
    equalModels(clearedStep.fields, empty.fields);
    assert.equal(clearedStep.html, empty.html, 'Clearing date values changes empty-form HTML');
    const listRequest = { operation: 'renderList' as const, spec: dateListSpec, rows: dateCases.map(item => ({ value: item.value })) };
    const html = await invoke(target, listRequest, timezone);
    assert.equal(html, oracle(listRequest), 'UTC list HTML differs');
    const cells = [...html.matchAll(/<td class="crudui-list__cell crudui-value crudui-value--date">(.*?)<\/td>/g)].map(match => match[1]);
    assert.deepEqual(cells, dateCases.map(item => item.date === item.value && item.datetime === item.value ? item.value : item.datetime.replace('T', ' ')), 'List date values differ from explicit expectations');
    return { timezone, dateValues: dateCases.length, html: digest(html), fields: digest(initial.fields), rawHTML: true };
  });

}
const checksStart = Date.now();
progress(`checks: ${queue.length} checks of ${available.length} targets, ${Math.min(CONCURRENCY, queue.length)} at a time`);
await runQueue();
for (const status of report.targets.filter(target => target.available)) {
  status.checks = report.checks.filter(check => check.target === status.name).length;
  status.failures = report.checks.filter(check => check.target === status.name && !check.passed).length;
  status.passed = status.failures === 0;
  progress(`${status.name}: ${status.checks - status.failures}/${status.checks} checks passed`);
}
progress(`checks: finished (${seconds(checksStart)})`);
// A selected case of a shared cases.json that an available target ran no check for was dropped from the run.
const uncovered = available.flatMap(target => {
  const checked = new Set(report.checks.filter(record => record.target === target.name).map(record => record.case));
  return fixtureFamilies.flatMap(({ fixture, group, cases }) => cases.map(({ name }) => `${group}:${name}`)
    .filter(name => selectsCheck(name) && !checked.has(name))
    .map(name => `${target.name} ${name} (${fixture})`));
});
report.checks.push({ target: 'suite', case: 'fixture-coverage', passed: uncovered.length === 0, ...(uncovered.length === 0 ? {} : { error: { message: `No check ran for ${uncovered.length} selected cases: ${uncovered.join(', ')}` } }) });
progress(uncovered.length === 0 ? 'fixture-coverage: every selected case of the shared cases.json files has a check of each available target' : `fixture-coverage: FAILED, ${uncovered.length} selected cases have no check`);
progress('inputs: hashing sources and built artifacts again');
try {
  report.inputs.end = await inputManifest();
  assert.deepEqual(report.inputs.end, report.inputs.start, 'Source or runtime artifacts changed while the conformance suite was running');
  report.checks.push({ target: 'suite', case: 'unchanged-inputs', passed: true });
  progress('inputs: unchanged');
} catch (caught) {
  const error = thrown(caught);
  report.checks.push({ target: 'suite', case: 'unchanged-inputs', passed: false, error: { message: error.message, expected: error.expected, actual: error.actual } });
  progress('inputs: CHANGED while the suite ran');
}
if (checkPatterns.length) {
  const matched = selectedCount > 0;
  report.checks.push({ target: 'suite', case: 'selected-checks', passed: matched, ...(matched ? { selected: selectedCount } : { error: { message: `No check matches ${checkPatterns.join(', ')}` } }) });
}
report.completed = true;
report.passed = report.targets.length === runTargets.length && report.targets.every(target => target.available && target.passed) && report.checks.every(check => check.passed);
report.summary = { passed: report.checks.filter(check => check.passed).length, failed: report.checks.filter(check => !check.passed).length, unavailable: report.targets.filter(target => !target.available).map(target => target.name) };
// A passing run removes its build directory; a failing run keeps it for inspection.
if (report.passed) {
  await rm(buildDirectory, { recursive: true, force: true });
  delete report.buildDirectory;
} else {
  process.stderr.write(`Build directory retained: ${buildDirectory}\n`);
}
if (reportPath) { await mkdir(path.dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
lines.close('native generators');
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
if (!report.passed) process.exitCode = 1;
