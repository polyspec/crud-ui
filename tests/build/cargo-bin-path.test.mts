// C19.158: the Makefile puts the cargo bin of the machine on PATH by name, as the template does at its line 12. rustup is the one
// tool that the machine provides (AGENTS.md), and install-tools for Rust fails with "rustup is missing" when a recipe runs without
// ~/.cargo/bin on PATH (clean release run of the assets job, pre-fix commit 2cbd57bcc, RUSTUP_HOME empty and PATH without brew).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('the Makefile puts $(HOME)/.cargo/bin on PATH by name (C19.158)', () => {
  const makefile = readFileSync(`${ROOT}/Makefile`, 'utf8');
  assert.match(makefile, /^export PATH := \$\(HOME\)\/\.cargo\/bin:\$\(PATH\)$/m);
});
