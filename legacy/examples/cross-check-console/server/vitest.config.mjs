// The dependency cache of Vite is a directory of this run: the default node_modules/.vite of the checkout is shared by
// every run and every worker, and two of them that optimize the SSR dependencies at once fail the rename of
// deps_ssr_temp_* into deps_ssr with ENOTEMPTY. The directory is removed when the run exits.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

const cacheDir = mkdtempSync(join(tmpdir(), 'crudui-cross-check-vite-'));
process.on('exit', () => rmSync(cacheDir, { recursive: true, force: true }));

export default defineConfig({ cacheDir });
