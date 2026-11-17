// The go runtime job runs lint-go over packages/generator/go, whose zz_generated_*.go files are gitignored and written by
// binding generate (C19.128). The job makes them itself: its setup installs the crates that the generator runs through
// cargo, generates the Go target, and only then runs its gates.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeDryRun } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const config = readFileSync(`${ROOT}/config/ci.json`, 'utf8');

test('the go setup installs the crates, generates the Go target, then builds', () => {
  assert.match(config, /"go": \[\s*"crudui-install-go-modules",\s*"crudui-install-crates",\s*"crudui-generate-go",\s*"build-go"\s*\]/);
});

test('crudui-generate-go writes the Go target of the generator with binding generate', () => {
  const dry = makeDryRun(ROOT, 'crudui-generate-go');
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /generate --contract \S*packages\/generator\/rust\/interface\.json/, dry.stdout);
  assert.match(dry.stdout, /--target go/, dry.stdout);
});

// C19.142: the go job lints packages/validator/go too, whose package files are generated the same way (its tracked files are
// go.mod and the FFI helper only). The job's generation writes the Go target of the validator as well, or the generator's
// import of the validator package finds no package (the branch run, C19.142).
test('crudui-generate-go writes the Go target of the validator too (C19.142)', () => {
  const dry = makeDryRun(ROOT, 'crudui-generate-go');
  assert.equal(dry.status, 0, dry.stderr);
  assert.ok(dry.stdout.split('\n').some(line => line.includes('generate --contract') && line.includes('packages/validator/rust/interface.json') && line.includes('--target go')), dry.stdout);
});
