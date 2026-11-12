import assert from 'node:assert/strict';
import { copyFileSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repository = join(dirname(fileURLToPath(import.meta.url)), '..');

function mockRust(root: string, status: number): Record<string, string> {
  const cargo = join(root, 'bin/cargo-tool');
  const rustc = join(root, 'bin/rustc-tool');
  const rustdoc = join(root, 'bin/rustdoc-tool');
  writeFileSync(cargo, `#!${process.execPath}\n`
    + `if (process.argv[2] === '--version') process.stdout.write('cargo 1.98.1\\n');\n`
    + `else process.exit(${status});\n`, { mode: 0o755 });
  writeFileSync(rustc, `#!${process.execPath}\n`
    + `process.stdout.write('rustc 1.98.1 (test 2026-09-01)\\n`
    + `host: aarch64-test-system\\n');\n`, { mode: 0o755 });
  writeFileSync(rustdoc, `#!${process.execPath}\n`
    + `process.stdout.write('rustdoc 1.98.1 (test 2026-09-01)\\n');\n`, { mode: 0o755 });
  return { CARGO: cargo, RUSTC: rustc, RUSTDOC: rustdoc };
}

for (const target of ['ts', 'go', 'rust', 'php']) {
  for (const failure of ['tool-failure', 'missing-output']) {
    test(`${target} rejects ${failure}`, () => {
      // The sandbox lies in var/tmp of this checkout, so the copied scripts resolve @polyspec/kit from its node_modules.
      mkdirSync(join(repository, 'var/tmp'), { recursive: true });
      const root = mkdtempSync(join(repository, 'var/tmp/crudui-api-docs-'));
      try {
        for (const path of ['scripts', 'bin', 'node_modules/.bin', 'var/tools/phpdocumentor',
          'legacy/packages/validator/go', 'packages/validator/rust', 'legacy/packages/generator/go', 'packages/generator/rust',
          ...['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react', 'vue', 'svelte', 'form-binding'].map(pkg => `packages/${pkg}`)]) {
          mkdirSync(join(root, path), { recursive: true });
        }
        for (const file of ['gen-api-docs.mts', 'run-rust-command.mts', 'operation-progress.mts']) {
          mkdirSync(dirname(join(root, 'scripts', file)), { recursive: true });
          copyFileSync(new URL('./' + file, import.meta.url), join(root, 'scripts', file));
        }
        // gen-api-docs names the doc model of a TypeScript package by the name of its package.json.
        for (const pkg of ['../legacy/packages/validator/ts', '../legacy/packages/generator/ts', '../legacy/packages/html', 'react', 'vue', 'svelte', 'form-binding']) {
          copyFileSync(join(repository, 'packages', pkg, 'package.json'), join(root, 'packages', pkg, 'package.json'));
        }
        writeFileSync(join(root, 'var/tools/phpdocumentor/phpDocumentor.phar'), '');
        const script = `#!/bin/sh\nexit ${failure === 'tool-failure' ? 27 : 0}\n`;
        for (const command of ['npm', 'go', 'php']) {
          writeFileSync(join(root, 'bin', command), script, { mode: 0o755 });
        }
        for (const command of ['api-extractor', 'api-documenter']) {
          writeFileSync(join(root, 'node_modules/.bin', command), script, { mode: 0o755 });
        }
        const rust = target === 'rust'
          ? mockRust(root, failure === 'tool-failure' ? 27 : 0)
          : {};
        const resultFile = join(root, 'outer-result.json');
        const seeded = JSON.stringify({ owner: 'outer test', passed: 13 });
        writeFileSync(resultFile, seeded);
        const environment: NodeJS.ProcessEnv = {
          ...process.env, KIT_TEST_RESULT: resultFile, HOME: root, PATH: join(root, 'bin'), GO: 'go', PHP: 'php',
        };
        delete environment.CARGO; delete environment.RUSTC; delete environment.RUSTDOC;
        Object.assign(environment, rust);
        const result = spawnSync(process.execPath, [join(root, 'scripts/gen-api-docs.mts'), target], {
          encoding: 'utf8', env: environment,
        });
        assert.notEqual(result.status, 0);
        assert.equal(readFileSync(resultFile, 'utf8'), seeded);
        assert.ok(!result.stdout.includes(': complete'));
        if (failure === 'missing-output') assert.match(result.stderr, /missing|empty/);
        else assert.match(result.stderr, /Command failed/);
      } finally {
        rmSync(root, { recursive: true });
      }
    });
  }
}


test('successful API generation preserves the enclosing test result', t => {
  mkdirSync(join(repository, 'var/tmp'), { recursive: true });
  const root = mkdtempSync(join(repository, 'var/tmp/crudui-api-operation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['scripts', 'bin', 'legacy/packages/validator/go', 'legacy/packages/generator/go']) mkdirSync(join(root, name), { recursive: true });
  for (const file of ['gen-api-docs.mts', 'operation-progress.mts']) copyFileSync(join(repository, 'scripts', file), join(root, 'scripts', file));
  writeFileSync(join(root, 'bin/go'), `#!${process.execPath}\nprocess.stdout.write(process.argv[2] === 'list' ? 'example/package\\n' : 'func Example()\\n');\n`, { mode: 0o755 });
  const resultFile = join(root, 'outer-result.json');
  const seeded = JSON.stringify({ owner: 'outer test', passed: 13 });
  writeFileSync(resultFile, seeded);
  const result = spawnSync(process.execPath, [join(root, 'scripts/gen-api-docs.mts'), 'go'], {
    encoding: 'utf8', env: { ...process.env, PATH: join(root, 'bin'), GO: 'go', KIT_TEST_RESULT: resultFile },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(resultFile, 'utf8'), seeded);
  assert.equal(readFileSync(join(root, 'docs/api/go.md'), 'utf8').includes('func Example()'), true);
});
