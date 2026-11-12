#!/usr/bin/env node
/**
 * Check documentation for public Go, Rust and PHP package APIs. The TypeScript packages are checked by API Extractor, which
 * make lint-ts of kit runs in each package with an api-extractor.json (ae-undocumented is an error).
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUST_COMMAND = join(ROOT, 'scripts/run-rust-command.mts');
const target = process.argv[2] ?? 'all';
if (!['all', 'go', 'rust', 'php'].includes(target)) throw new Error('Use all, go, rust or php');
const want = (name: string): boolean => target === 'all' || target === name;
const results: { name: string, passed: boolean }[] = [];
function check(name: string, operation: () => void): void {
  try {
    operation();
    results.push({ name, passed: true });
    process.stdout.write(`[doc-coverage] ${name}: PASS\n`);
  } catch (error) {
    results.push({ name, passed: false });
    process.stderr.write(`[doc-coverage] ${name}: FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}
function run(command: string, args: string[], cwd: string = ROOT): void {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

if (want('go')) for (const pkg of ['../legacy/packages/validator/go', '../legacy/packages/generator/go']) {
  check(`go:${pkg}`, () => run(process.env.GO ?? 'go', ['test', './...', '-run', 'DocCoverage', '-count=1'], join(ROOT, 'packages', pkg)));
}
if (want('rust')) for (const pkg of ['validator/rust', 'generator/rust']) {
  check(`rust:${pkg}`, () => run(process.execPath, [
    RUST_COMMAND, 'build', '--locked', '--lib',
  ], join(ROOT, 'packages', pkg)));
}
if (want('php')) {
  check('php:validator-and-generator', () => run(process.env.PHP ?? 'php', [join(ROOT, 'scripts/php-doc-coverage.php')]));
}
const failed = results.filter(result => !result.passed).length;
process.stdout.write(`[doc-coverage] ${results.length - failed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
