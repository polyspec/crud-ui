// Shared outputs that another run reads at any time are published atomically: each is written to a path of its run and
// renamed into place, so a reader finds the previous output or the new one, never a missing or partial one. The
// behaviour of each publication is tested beside its program; this file keeps every program on that form.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { readManifest, script } from '../json.mts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');

// Each shared output: the program, the staging path it writes and the rename that publishes it.
const publications = [
  { output: 'the build stamp', file: 'scripts/require-current-build.mts', staging: /writeFile\(`\$\{STAMP\}\.\$\{process\.pid\}`/, publish: /rename\(`\$\{STAMP\}\.\$\{process\.pid\}`, STAMP\)/ },
  { output: 'a package dist', file: 'scripts/package-dist.mts', staging: /process\.env\.CRUDUI_DIST = 'dist\.next'/, publish: /fs\.renameSync\(next, dist\);/ },
];

test('every shared output is written to a path of its run and renamed into place', () => {
  const violations = publications.flatMap(({ output, file, staging, publish }) => {
    const source = read(file);
    return [
      ...(staging.test(source) ? [] : [`${file}: ${output} is not written to a path of its run (${staging})`]),
      ...(publish.test(source) ? [] : [`${file}: ${output} is not renamed into place (${publish})`]),
    ];
  });
  assert.deepEqual(violations, []);
});

test('every package build writes into the staging directory that package-dist names', () => {
  const violations: string[] = [];
  for (const name of ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react', 'vue', 'svelte', 'form-binding']) {
    const build = script(readManifest(path.join(ROOT, `packages/${name}/package.json`)), 'build');
    const steps = build.slice(build.indexOf("'") + 1, build.lastIndexOf("'")).split(' && ');
    for (const step of steps) if (!step.includes('"$CRUDUI_DIST"')) violations.push(`${name}: \`${step}\` does not write into "$CRUDUI_DIST"`);
  }
  assert.deepEqual(violations, []);
});
