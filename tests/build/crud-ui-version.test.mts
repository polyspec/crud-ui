// C19.156: every package of crud-ui has the version of the repository (the version of the root package.json), and every pin of a
// crud-ui package names that version. A version line that the bump misses (packages/generator/python/pyproject.toml named the
// dependency polyspec-crud-ui-validator==0.0.21 after the bump to 0.0.22, on the line that also pins polyspec-json) passed every
// check before this test. The names read here are crud-ui's own, so binding and json pins never match them.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MANIFESTS = new Set(['package.json', 'Cargo.toml', 'pyproject.toml', 'composer.json']);

/** The version of crud-ui and the mismatches of one set of manifests: the own version of each package and each crud-ui pin. */
export function versionMismatches(version: string, files: Record<string, string>): string[] {
  const found: string[] = [];
  for (const [file, text] of Object.entries(files)) {
    const own = file.endsWith('package.json') || file.endsWith('composer.json')
      ? /"version"\s*:\s*"([^"]+)"/.exec(text)?.[1]
      : /^version\s*=\s*"([^"]+)"/m.exec(text)?.[1];
    if (own !== undefined && own !== version) found.push(`${file}: own version ${own}`);
    for (const line of text.split('\n')) {
      for (const match of line.matchAll(/(polyspec-crud-ui[\w-]*|polyspec-crudui-[\w-]+|polyspec\/crudui-[\w-]+|@polyspec\/crudui-[\w-]+)(?:==|\s|":\s*"|"\s*:\s*")([0-9][\w.-]*)/g)) {
        if (match[2] !== version) found.push(`${file}: pins ${match[1]} at ${match[2]}`);
      }
      if (/path\s*=/.test(line)) {
        const pinned = /version\s*=\s*"([^"]+)"/.exec(line)?.[1];
        if (pinned !== undefined && line.includes('polyspec-crud-ui') && pinned !== version) found.push(`${file}: path pin at ${pinned}`);
      }
    }
  }
  return found;
}

function manifests(dir: string, out: Record<string, string> = {}): Record<string, string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'target' || entry === 'dist' || entry === 'var') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) manifests(full, out);
    else if (MANIFESTS.has(entry)) out[path.relative(ROOT, full)] = readFileSync(full, 'utf8');
  }
  return out;
}

test('red: a pin of the previous version in a pyproject is a mismatch (C19.156)', () => {
  const found = versionMismatches('0.0.22', {
    'packages/generator/python/pyproject.toml': 'version = "0.0.22"\ndependencies = ["polyspec-crud-ui-validator==0.0.21", "polyspec-json==0.0.41"]\n',
  });
  assert.deepEqual(found, ['packages/generator/python/pyproject.toml: pins polyspec-crud-ui-validator at 0.0.21']);
});

test('every crud-ui package and pin of packages/ has the root version (C19.156)', () => {
  const parsed: unknown = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8'));
  const version = typeof parsed === 'object' && parsed !== null && 'version' in parsed && typeof parsed.version === 'string' ? parsed.version : '';
  assert.notEqual(version, '', 'package.json has no version');
  assert.deepEqual(versionMismatches(version, manifests(`${ROOT}/packages`)), []);
});
