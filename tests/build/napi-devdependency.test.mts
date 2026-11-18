// C19.159: the release recipe of the binding that builds the npm platform packages runs the napi CLI of the repository's own
// devDependency @napi-rs/cli (release.mk: "no napi CLI at node_modules/.bin/napi; the repository pins @napi-rs/cli as a devDependency").
// The repository did not declare it, so a clean install of the release job had no napi CLI and release-npm-platform failed
// (clean release run of the assets job, after the Go and cargo fixes).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('@napi-rs/cli is a pinned devDependency of the repository and locked (C19.159)', () => {
  const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8')) as { devDependencies?: Record<string, string> };
  const version = pkg.devDependencies?.['@napi-rs/cli'];
  assert.match(version ?? '', /^\d+\.\d+\.\d+$/, '@napi-rs/cli is not an exact devDependency of package.json');
  const lock = JSON.parse(readFileSync(`${ROOT}/package-lock.json`, 'utf8')) as { packages: Record<string, { version?: string; dev?: boolean }> };
  assert.equal(lock.packages['node_modules/@napi-rs/cli']?.version, version, 'package-lock.json does not lock @napi-rs/cli at the devDependency');
});
