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
  // The untracked tables that make php-tables, python-tables, php-ext-tables and the prebuild scripts write on every run
  // (P34), each to <table>.<pid> and renamed onto the table.
  ...[
    'legacy/packages/generator/ts/scripts/generate-interface-messages.mjs',
    'legacy/packages/validator/ts/scripts/generate-unicode-properties.mjs',
  ].map(file => ({ output: 'a TypeScript table', file, staging: /writeFileSync\(`\$\{target\}\.\$\{process\.pid\}`, text\)/, publish: /renameSync\(`\$\{target\}\.\$\{process\.pid\}`, target\)/ })),
  ...[
    'legacy/packages/php-ext/tools/generate-unicode-data.mjs',
    'legacy/packages/php-ext/tools/generate-interface-messages.mjs',
  ].map(file => ({ output: 'a table of the PHP extension', file, staging: /writeFile\(`\$\{outputPath\}\.\$\{process\.pid\}`, /, publish: /rename\(`\$\{outputPath\}\.\$\{process\.pid\}`, outputPath\)/ })),
  ...[
    'legacy/packages/validator/python/scripts/generate_unicode_data.py',
    'legacy/packages/generator/python/scripts/generate_interface_messages.py',
  ].map(file => ({ output: 'a Python table', file, staging: /staging = TARGET\.with_name\(f"\{TARGET\.name\}\.\{os\.getpid\(\)\}"\)\n\s+staging\.write_text\(/, publish: /os\.replace\(staging, TARGET\)/ })),
  { output: 'a PHP table', file: 'scripts/generator-contract.php', staging: /\$staging = \$file \. '\.' \. getmypid\(\);\n\s+file_put_contents\(\$staging, \$source\)/, publish: /rename\(\$staging, \$file\)/ },
  { output: 'the form template validator', file: 'scripts/generate-form-template-validator.mts', staging: /writeFileSync\(`\$\{OUTPUT\}\.\$\{process\.pid\}`, content\)/, publish: /renameSync\(`\$\{OUTPUT\}\.\$\{process\.pid\}`, OUTPUT\)/ },
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
