// The validator tests and the PHP extension engine fixtures read no clock. A test that compares an
// elapsed time with a limit or with another elapsed time passes or fails with the load of the
// machine, so a complexity check counts a deterministic quantity or relies on the timeout of the
// test (docs/operations/testing.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The calls that read a clock in TypeScript, PHP, Go and Rust, and in C. */
const CLOCK = /\bperformance\.now\(|\bDate\.now\(|\bhrtime\(|\bmicrotime\(|\btime\.Now\(|\btime\.Since\(|\bInstant::now\(|\bSystemTime::now\(/;
const C_CLOCK = /\btimespec_get\(|\bclock_gettime\(|\bgettimeofday\(|\bclock\(\)/;

/**
 * The checked sources with the clock calls of their language: the tests of the four validators
 * (Rust unit tests are in the crate sources), and the C sources of the PHP extension engine
 * fixtures, which the JavaScript test files hold as strings and whose runner reports elapsed time.
 */
const SOURCES: [RegExp, RegExp][] = [
  [/^legacy\/packages\/validator\/ts\/.*\.test\.ts$|^legacy\/packages\/validator\/php\/tests\/.*\.php$|^legacy\/packages\/validator\/go\/.*_test\.go$|^packages\/validator\/rust\/(src|tests)\/.*\.rs$/, CLOCK],
  [/^legacy\/packages\/php-ext\/tests\/.*\.(c|mjs)$/, C_CLOCK],
];

export function clockReads(file: string, text: string, clock: RegExp = CLOCK): string[] {
  return text.split('\n').flatMap((line, index) => (clock.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : []));
}

test('each clock call is found', () => {
  for (const line of ['performance.now()', 'Date.now()', 'hrtime(true)', '\\microtime(true)', 'time.Now()',
    'time.Since(start)', 'Instant::now()', 'std::time::SystemTime::now()']) {
    assert.equal(clockReads('a', line).length, 1, line);
  }
  for (const line of ['new Date(0)', 'datetime(6)', 'elapsed', 'Duration::from_secs(2)']) {
    assert.deepEqual(clockReads('a', line), [], line);
  }
  for (const line of ['timespec_get(&now, TIME_UTC);', 'clock_gettime(CLOCK_MONOTONIC, &now);', 'gettimeofday(&now, NULL);', 'clock()']) {
    assert.equal(clockReads('a', line, C_CLOCK).length, 1, line);
  }
  assert.deepEqual(clockReads('a', 'const started = Date.now();', C_CLOCK), []);
});

test('no validator test or engine fixture reads a clock', () => {
  const files = execFileSync('git', ['ls-files', 'legacy/packages/validator/ts', 'legacy/packages/validator/php', 'legacy/packages/validator/go', 'packages/validator/rust', 'legacy/packages/php-ext/tests'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const reads: string[] = [];
  for (const [source, clock] of SOURCES) {
    const matched = files.filter(file => source.test(file));
    assert.ok(matched.length > 0, `no source matches ${source}`);
    for (const file of matched) reads.push(...clockReads(file, readFileSync(path.join(ROOT, file), 'utf8'), clock));
  }
  assert.deepEqual(reads, [], 'tests that read a clock');
});
