// C19.153: the assets jobs of release.yml run the release check of binding (`binding check --release`) before they build, and that
// check runs `go mod download` with GOPROXY=off, which needs the Go modules in the module cache. The job runs no install of them, so
// the check failed with "module lookup disabled by GOPROXY=off" (release run 44217268150). Each assets recipe downloads the modules
// with the ONLINE install target crudui-install-go-modules before its ci-targets line, when RELEASE is true.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

for (const target of ['ci-assets-platform', 'ci-assets-php', 'ci-assets-npm']) {
  test(`${target} downloads the Go modules before its release check (C19.153)`, () => {
    const lines = readFileSync(`${ROOT}/Makefile`, 'utf8').split('\n');
    // A target can also have variable lines (`ci-assets-php: DYLD_LIBRARY_PATH :=`) before its rule, so every rule line is read.
    const recipe: string[] = [];
    lines.forEach((line, index) => {
      if (!line.startsWith(`${target}:`) || line.includes(':=')) return;
      for (const next of lines.slice(index + 1)) {
        if (!next.startsWith('\t')) break;
        recipe.push(next);
      }
    });
    assert.ok(recipe.length > 0, `the Makefile has no ${target} recipe`);
    const install = recipe.findIndex(line => line.includes('crudui-install-go-modules') && line.includes('RELEASE'));
    const ci = recipe.findIndex(line => line.includes('ci-targets TARGETS='));
    assert.notEqual(install, -1, `${target} does not download the Go modules for its release check`);
    assert.ok(install < ci, `${target} downloads the Go modules after its ci-targets line`);
  });
}
