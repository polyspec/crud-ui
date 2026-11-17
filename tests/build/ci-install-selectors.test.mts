// Every TOOLS word that a make recipe passes to install-tools names a selector that kit's install-tools declares (C19.89).
// kit lists the selectors in its own error: an unknown selector stops install-tools before any install.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeEnvironment } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('every TOOLS word of an install-tools recipe is a selector that kit declares (C19.89)', () => {
  const probe = spawnSync('make', ['--no-print-directory', 'install-tools', 'TOOLS=__probe__'], { cwd: ROOT, encoding: 'utf8', env: makeEnvironment() });
  const declared = /choose ([^\n]+)/.exec(`${probe.stdout}${probe.stderr}`)?.[1]?.split(', ').map(word => word.trim());
  assert.ok(declared && declared.length > 0, `make install-tools TOOLS=__probe__ names no selectors:\n${probe.stdout}${probe.stderr}`);
  const words = [...readFileSync(`${ROOT}/Makefile`, 'utf8').matchAll(/install-tools TOOLS="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/));
  assert.ok(words.length > 0, 'the Makefile names no install-tools TOOLS list');
  const unknown = [...new Set(words.filter(word => !declared.includes(word)))];
  assert.deepEqual(unknown, [], `the install-tools TOOLS words that kit does not declare; kit declares ${declared.join(', ')}`);
});
