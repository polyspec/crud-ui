// C19.159: the release recipe of the binding that builds the npm platform packages runs the napi CLI of the repository's own
// devDependency @napi-rs/cli (release.mk: "no napi CLI at node_modules/.bin/napi; the repository pins @napi-rs/cli as a devDependency").
// The repository did not declare it, so a clean install of the release job had no napi CLI and release-npm-platform failed
// (clean release run of the assets job, after the Go and cargo fixes).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value ? Reflect.get(value, key) : undefined;
}

test('@napi-rs/cli is a pinned devDependency of the repository and locked (C19.159)', () => {
  const pkg: unknown = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8'));
  const version = field(field(pkg, 'devDependencies'), '@napi-rs/cli');
  assert.equal(typeof version, 'string', '@napi-rs/cli is not a devDependency of package.json');
  assert.match(String(version), /^\d+\.\d+\.\d+$/, '@napi-rs/cli is not an exact devDependency of package.json');
  const lock: unknown = JSON.parse(readFileSync(`${ROOT}/package-lock.json`, 'utf8'));
  const locked = field(field(field(lock, 'packages'), 'node_modules/@napi-rs/cli'), 'version');
  assert.equal(locked, version, 'package-lock.json does not lock @napi-rs/cli at the devDependency');
});
