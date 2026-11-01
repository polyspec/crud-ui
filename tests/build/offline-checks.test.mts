// The checks run offline, and only the install targets download (docs/operations/package-build.md, "Offline checks"): the
// Makefile exports the offline settings of cargo, go, npm and Composer, and `$(ONLINE)` lifts them for the recipe lines
// of the install targets, dependency-review and the consumer installs of the release archives alone. cargo answers a missing crate offline with "retry
// without --offline"; crudui-install-crates fetches the crates of every Cargo.lock with cargo fetch --locked (C18.21),
// so no target depends on a check of them.
// A target runs cargo when a recipe line runs `run-tests.mts cargo` or `run-suite.mts cargo` or `run-rust-command.mts` with a command other than
// fmt, or starts a file, an npm script or a package test that does, directly or through the files that it imports or
// names.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { makeTargets } from '../../scripts/test-commands.mts';
import { makeDryRun } from './make-dry-run.mts';

/** The prerequisites and recipe lines of a Makefile target. */
interface MakeRule {
  prerequisites: string[];
  commands: string[];
}

const ROOT = path.resolve(import.meta.dirname, '../..');

// The targets of the kit.mk and bootstrap of @polyspec/kit that download: the tools, the packages, the
// dependency review, the Python locks, the release tools and backend, the locks of the consumer projects and
// the proof of a release, and the release archives of other repositories (kit K140, K865). The tool lifts the
// offline settings itself.
const KIT_DOWNLOADS = ['install-tools', 'install-packages', 'toolchain-lock'];
const read = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');
const makefile = read('Makefile');
// The evaluated database contains the commands and prerequisites of the checkout and its installed kit. KIT_WORKTREE is empty,
// so the recipes of the checkout that downloads are the ones checked, in a worktree as on main (a worktree's install-tools refuses).
const database = makeDryRun(ROOT, 'help', { database: true, variables: ['KIT_WORKTREE='] });
assert.equal(database.status, 0, database.stderr);
const makefiles = database.stdout;
const rules: Record<string, MakeRule> = makeTargets(makefiles);
const INSTALLS = Object.entries(rules)
  .filter(([name, rule]) => (name.startsWith('install-') || name.startsWith('crudui-install-')) && rule.commands.some(command => command.includes('$(ONLINE)')))
  .map(([name]) => name);
const KIT_ONLINE = Object.entries(rules)
  .filter(([, rule]) => rule.commands.some(command => command.includes('$(ONLINE)')))
  .map(([name]) => name);
const DOWNLOADS = [...new Set([...KIT_DOWNLOADS, ...KIT_ONLINE, ...INSTALLS])];

/** The value of a Makefile variable defined with `=` or `:=` over continued lines. */
function variable(name: string): string {
  const match = new RegExp(`^${name}\\s*:?=((?:.*\\\\\\n)*.*)$`, 'm').exec(makefile);
  return match?.[1] !== undefined ? match[1].replace(/\\\n/g, ' ') : '';
}




test('the Makefile runs cargo, go, npm and Composer offline, and only the install targets lift it', () => {
  for (const setting of ['export CARGO_NET_OFFLINE := true', 'export GOPROXY := off', 'export npm_config_offline := true', 'export COMPOSER_DISABLE_NETWORK := 1']) {
    assert.ok(makefile.includes(`\n${setting}\n`), `the Makefile must ${setting}`);
  }
  assert.equal(variable('ONLINE').trim(), 'env -u CARGO_NET_OFFLINE -u GOPROXY -u npm_config_offline -u COMPOSER_DISABLE_NETWORK');
  const targets: Record<string, MakeRule> = makeTargets(makefiles);
  const online = Object.entries(targets).filter(([, rule]) => rule.commands.some(command => command.includes('$(ONLINE)'))).map(([name]) => name).sort();
  assert.deepEqual(online, [...DOWNLOADS].sort());
  // Every recipe line of an install target that downloads runs with $(ONLINE).
  const downloading = /\b(?:bootstrap-npm\.\$\(KIT_EXT\)|bootstrap-npm\.mts|install-tools\.\$\(KIT_EXT\)|npm ci\b|composer\b.*\binstall\b|fetch-cargo-downloads\.\$\(KIT_EXT\)|dependency-review\.\$\(KIT_EXT\)(?! --provider-entries\b)|release-tools\.\$\(KIT_EXT\)|release-backend\.\$\(KIT_EXT\))/;
  // The provider-entries mode rewrites local Composer metadata and returns before the registry review.
  assert.equal(downloading.test('$(NODE) $(KIT)/dependency-review.$(KIT_EXT) --record'), true);
  assert.equal(downloading.test('$(NODE) $(KIT)/dependency-review.$(KIT_EXT) --provider-entries'), false);
  const offline = Object.entries(targets).flatMap(([name, rule]) => rule.commands
    .filter(command => downloading.test(command) && !command.includes('$(ONLINE)'))
    .map(command => `${name}: ${command}`));
  assert.deepEqual(offline, []);
});


