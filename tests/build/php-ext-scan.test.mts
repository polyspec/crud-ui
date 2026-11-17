// `make test-php-ext` runs the PHP extension tests with PHP_INI_SCAN_DIR set to the json scan directory. PHP reads one
// scan directory from that variable, so the directory must hold the ini files of PHP's own scan directory as well as the
// json ini; otherwise the PHP children that inherit the variable lose their configuration (C19.129).
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeEnvironment } from './make-dry-run.mts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

test('php-json-scan puts the ini files of PHP\'s scan directory next to the json ini', () => {
  const scan = spawnSync('php', ['-r', 'echo PHP_CONFIG_FILE_SCAN_DIR;'], { encoding: 'utf8' }).stdout.trim();
  const defaults = existsSync(scan) ? readdirSync(scan).filter(name => name.endsWith('.ini')) : [];
  assert.ok(defaults.length > 0, `PHP's scan directory ${scan} holds no ini file, so the check would pass vacuously`);
  const directory = mkdtempSync(path.join(tmpdir(), 'crudui-json-module-'));
  try {
    const module = path.join(directory, 'polyspec_json.so');
    writeFileSync(module, '');
    const run = spawnSync('make', ['--no-print-directory', 'php-json-scan', `POLYSPEC_JSON_MODULE=${module}`], {
      cwd: ROOT, encoding: 'utf8', env: makeEnvironment(),
    });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const written = readdirSync(path.join(ROOT, 'var/php-ext/json-scan'));
    assert.ok(written.includes('polyspec_json.ini'), written.join(' '));
    for (const name of defaults) assert.ok(written.includes(name), `php-json-scan does not copy ${name} of ${scan}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
