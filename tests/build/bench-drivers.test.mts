// The benchmark drivers take their iteration counts from the command line. Every driver and the
// orchestrator apply one rule to them, read from benchmarks/validators/iteration-arguments.json: a
// count is decimal digits inside its range, and anything else stops the program before it loads a
// validator, with the same message. An unchecked count such as `--iters 1e20` used to loop without
// end. The JavaScript and PHP drivers run as the README documents them; the Go and Rust drivers run
// as the programs benchmarks/validators/build-drivers.mjs built before this test, so every case ends within
// seconds and no case pays a compilation.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { BENCH, compiledDrivers } from '../../benchmarks/validators/drivers.mjs';
import { parseJson, readJson, type JTDSchemaType } from '../json.mts';

/** Kills the process group of `pid` with SIGKILL; a group that has already ended (ESRCH) is the outcome sought, and another error throws. */
function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error;
  }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = path.join(BENCH, 'fixtures');
/** benchmarks/validators/iteration-arguments.json: the counts every driver accepts or rejects. */
interface IterationCases {
  rejected: { args: string[]; message: string }[];
  accepted: { args: string[]; iters: number };
}
/** One result row a driver prints as JSON. */
interface BenchRow { spec: string; iters: number }
const casesSchema: JTDSchemaType<IterationCases> = {
  properties: {
    rejected: { elements: { properties: { args: { elements: { type: 'string' } }, message: { type: 'string' } }, additionalProperties: true } },
    accepted: { properties: { args: { elements: { type: 'string' } }, iters: { type: 'float64' } }, additionalProperties: true },
  },
  additionalProperties: true,
};
const rowSchema: JTDSchemaType<BenchRow> = { properties: { spec: { type: 'string' }, iters: { type: 'float64' } }, additionalProperties: true };
interface Program { command: string; args: string[]; cwd: string }
interface RunResult { status: number | null; stdout: string; stderr: string; timedOut: boolean; elapsedMs: number }

const cases = readJson(path.join(ROOT, 'benchmarks/validators/iteration-arguments.json'), casesSchema);

const compiled = compiledDrivers();
const programs: Record<string, Program> = {
  'bench-js.js': { command: process.execPath, args: [path.join(BENCH, 'bench-js.js')], cwd: BENCH },
  'bench-php.php': { command: process.env.PHP ?? 'php', args: [path.join(BENCH, 'bench-php.php')], cwd: BENCH },
  'go/main.go': { command: compiled.go.program, args: ['--fixtures', FIXTURES], cwd: path.join(BENCH, 'go') },
  'rust/main.rs': { command: compiled.rust.program, args: ['--fixtures', FIXTURES], cwd: path.join(BENCH, 'rust') },
};

// One run of a driver ends within these limits; the test runner gives each test 30 seconds.
const ACCEPTED_DEADLINE_MS = 10_000;
const REJECTED_DEADLINE_MS = 5_000;

/**
 * Run one program in its own process group; at the deadline the whole group is killed, so a
 * driver that loops without end fails this test instead of outliving it.
 */
function run({ command, args, cwd }: Program, extra: string[], deadlineMs: number): Promise<RunResult> {
  const started = performance.now();
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, [...args, ...extra], { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid);
    }, deadlineMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', status => {
      clearTimeout(timer);
      killGroup(child.pid);
      resolve({ status, stdout, stderr, timedOut, elapsedMs: performance.now() - started });
    });
  });
}

const rows = (stdout: string): BenchRow[] => stdout.split('\n').filter(line => line.trim().startsWith('{')).map(line => parseJson(line, rowSchema, 'a result row of a driver'));

for (const [name, program] of Object.entries(programs)) {
  test(`${name} accepts a count inside the range`, async () => {
    assert.ok(existsSync(program.command) || !path.isAbsolute(program.command), `${program.command} is missing; run make crudui-build-bench-drivers`);
    const result = await run(program, cases.accepted.args, ACCEPTED_DEADLINE_MS);
    assert.equal(result.timedOut, false, `${name} did not finish`);
    assert.equal(result.status, 0, result.stderr);
    const [row, ...rest] = rows(result.stdout);
    assert.deepEqual(rest, []);
    assert.ok(row, `${name} printed no row`);
    assert.equal(row.spec, 'contact');
    assert.equal(row.iters, cases.accepted.iters);
  });

  test(`${name} rejects every count outside the rule with the shared message`, async () => {
    for (const { args, message } of cases.rejected) {
      const result = await run(program, args, REJECTED_DEADLINE_MS);
      const label = `${name} ${args.join(' ')}`;
      assert.equal(result.timedOut, false, `${label} kept running`);
      assert.notEqual(result.status, 0, label);
      assert.deepEqual(rows(result.stdout), [], label);
      assert.ok(result.stderr.split('\n').includes(message), `${label}: ${JSON.stringify(result.stderr)}`);
    }
  });
}

test('run.js rejects every count outside the rule before it starts a driver', async () => {
  const orchestrator = { command: process.execPath, args: [path.join(BENCH, 'run.js'), '--json'], cwd: BENCH };
  for (const { args, message } of cases.rejected) {
    const result = await run(orchestrator, args, REJECTED_DEADLINE_MS);
    const label = `run.js ${args.join(' ')}`;
    assert.equal(result.timedOut, false, `${label} kept running`);
    assert.equal(result.status, 2, label);
    assert.equal(result.stderr, `${message}\n`, label);
    assert.equal(result.stdout, '', label);
  }
});
