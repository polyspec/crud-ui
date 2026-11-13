// AGENTS (Own): no tracked file names a Git commit. A commit name is a token of 7 to 12 or of 40 lower-case hex digits
// that holds a letter and a digit, as git abbreviates or writes a commit; a word has no such token. Two places name a
// commit because a tool requires it: the commit pin of a GitHub action on its `uses:` line, and a lock, which records
// what its package manager resolved. Some tokens of that form name no commit, each by what it is: a decimal number with
// an exponent (`1e999999`, `234566e-318`), a CSS color after `#`, the file header of an executable in the list that
// names them, the hash of a PHP stub file that gen_stub writes after `Stub hash:`, and a made-up value that repeats the
// hex digits in order (`0123456789abcdef0123…`), which a test passes where a commit is read.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repository = path.resolve(import.meta.dirname, '../..');
const LOCKS = /(^|\/)(package-lock\.json|Cargo\.lock|composer\.lock|mise\.lock|go\.sum|uv\.lock)$/;
const TOKEN = /(#|Stub hash: )?\b([0-9a-f]{40}|[0-9a-f]{7,12})\b/g;
const NUMBER = /^[0-9]+e[0-9]*$/;
const HEX_DIGITS = '0123456789abcdef';
const MAGIC_LIST = /\bEXECUTABLE_MAGIC\b/;

// A token that names something other than a commit, by its form or by what precedes it.
function namesNoCommit(token: string, prefix: string | undefined, line: string): boolean {
  if (prefix !== undefined) return true;
  if (NUMBER.test(token)) return true;
  if (MAGIC_LIST.test(line)) return true;
  return HEX_DIGITS.repeat(3).startsWith(token);
}
const ACTION_PIN = /^\s*(-\s+)?uses:\s+[\w.-]+\/[\w./-]+@([0-9a-f]{40})\b/;

function trackedFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: repository, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split('\0').filter((file) => file !== '');
}

test('no tracked file names a Git commit, except the pin of an action and a lock (AGENTS)', () => {
  const found: string[] = [];
  let read = 0;
  for (const file of trackedFiles().filter((f) => !LOCKS.test(f))) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(path.join(repository, file));
    } catch {
      continue;
    }
    if (bytes.includes(0)) continue;
    read += 1;
    bytes.toString('utf8').split('\n').forEach((line, index) => {
      const pin = ACTION_PIN.exec(line)?.[2];
      for (const [, prefix, token] of line.matchAll(TOKEN)) {
        if (token === undefined || token === pin || !/[a-f]/.test(token) || !/[0-9]/.test(token)) continue;
        if (!namesNoCommit(token, prefix, line)) found.push(`${file}:${index + 1}: ${token}`);
      }
    });
  }
  assert.ok(read > 100, `the check read ${read} tracked text files`);
  assert.deepEqual(found, [], 'a tracked file names a Git commit; state what was verified instead, and keep the commit in the record of the run');
});
