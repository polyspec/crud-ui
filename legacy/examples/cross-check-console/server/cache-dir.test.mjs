// Each run of the cross-check suite has a Vite dependency cache of its own: two processes that load vitest.config.mjs get
// two directories under the temporary directory, neither is the shared node_modules/.vite of the checkout, and each is
// removed when its process exits.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const config = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vitest.config.mjs');

/** The cacheDir of vitest.config.mjs in a process of its own, which exits after it prints the directory. */
function cacheDirOfRun() {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `const { default: c } = await import(${JSON.stringify(`file://${config}`)}); console.log(JSON.stringify({ cacheDir: c.cacheDir, existed: (await import('node:fs')).existsSync(c.cacheDir) }));`,
  ], { encoding: 'utf8', timeout: 30_000 });
  expect(result.status, `node exited with ${result.status}: ${result.stderr}`).toBe(0);
  return JSON.parse(result.stdout.trim().split('\n').pop());
}

describe('vitest.config.mjs gives each run its own Vite cache', () => {
  test('two runs get two directories under the temporary directory, each removed at exit', () => {
    expect(existsSync(config), `${config} is missing`).toBe(true);
    const first = cacheDirOfRun();
    const second = cacheDirOfRun();
    for (const run of [first, second]) {
      expect(typeof run.cacheDir).toBe('string');
      expect(run.existed).toBe(true);
      expect(path.relative(tmpdir(), run.cacheDir).startsWith('..')).toBe(false);
      expect(run.cacheDir.includes(`${path.sep}node_modules${path.sep}.vite`)).toBe(false);
      expect(existsSync(run.cacheDir)).toBe(false);
    }
    expect(first.cacheDir).not.toBe(second.cacheDir);
  });
});
