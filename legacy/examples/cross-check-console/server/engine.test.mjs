/**
 * The Vite server of the SSR engine scans the checkout for no browser dependency (C14.46).
 *
 * The engine only renders on the server. With automatic dependency discovery on, Vite's cold start crawled every HTML
 * file under the repository root for over a minute and failed on the generated API pages, once for each test file
 * that booted an engine, so the first render case of those files timed out.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { createLogger, createServer } from 'vite';
import { engineServerOptions } from './engine.mjs';

test('the engine server runs no dependency scan of the browser client', async () => {
  const logged = [];
  const base = createLogger('info');
  const record = (message) => { logged.push(String(message)); };
  const customLogger = { ...base, info: record, warn: record, warnOnce: record, error: record };
  // A cache directory of its own makes this a cold start, which an earlier optimizer cache of the checkout would skip.
  const cacheDir = mkdtempSync(path.join(tmpdir(), 'crudui-engine-vite-'));
  const server = await createServer({ ...(await engineServerOptions()), cacheDir, logLevel: 'info', customLogger });
  afterAll(async () => {
    await server.close();
    rmSync(cacheDir, { recursive: true, force: true });
  });
  // The dependency optimizer of the client starts its scan at the cold start; with discovery off it starts none, so
  // its scan ends at once and logs nothing.
  await server.environments.client.depsOptimizer?.scanProcessing;
  expect(logged.filter((line) => /scanning dependencies|dependency scan/.test(line))).toEqual([]);
});
