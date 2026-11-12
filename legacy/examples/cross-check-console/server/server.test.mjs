/**
 * Gateway HTTP boundary — error contract + CORS + spec coercion.
 *
 * The node-api server contract the gateway follows:
 *   - a CLIENT INPUT fault (bad JSON body, missing spec, malformed YAML) is a
 *     4xx { error } — NOT a result surface;
 *   - a VALIDATION failure (the data is invalid) is a 200 result envelope, never
 *     an HTTP error (the CRUDUI LOAD-vs-validate distinction lives inside the 200);
 *   - CORS headers are set on every response;
 *   - /health is a liveness 200.
 *
 * The server module is imported for its exported `handler` (no listen side
 * effect after the entry-point guard) and mounted on an ephemeral port. The form
 * and list render paths are covered by their runner tests; the detail render path
 * is exercised here once for a clean and a failing request (it boots the Vite SSR
 * engine). The validate path spawns the five validator processes, which proves the
 * "validation failure == 200" rule on real engine output.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { coerceSpec, handler } from './server.mjs';

let server;
let base;

// The server start is a setup: it ends when the server listens and has no hook timeout.
beforeAll(async () => {
  server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}, Infinity);

// The server stop is a teardown: it ends when the close resolves and has no hook timeout.
afterAll(async () => {
  const started = performance.now();
  await new Promise((resolve) => server.close(resolve));
  process.stdout.write(`[teardown] server stop: finished in ${((performance.now() - started) / 1000).toFixed(1)}s\n`);
}, Infinity);

/** POST raw bytes (so a deliberately malformed JSON body can be sent). */
function postRaw(pathname, rawBody) {
  return fetch(base + pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
}

describe('coerceSpec — unit (YAML string vs object)', () => {
  test('YAML string parses to an object', () => {
    expect(coerceSpec('type: group\nproperties: {}')).toEqual({
      type: 'group',
      properties: {},
    });
  });

  // The console reads YAML in the YAML 1.2 core schema, as the cli and scripts/check-schema.mts read it.
  test('a date-like value of a YAML string stays a string', () => {
    expect(coerceSpec('type: group\nproperties:\n  start:\n    type: date\n    default: 2026-01-01\n')).toEqual({
      type: 'group',
      properties: { start: { type: 'date', default: '2026-01-01' } },
    });
  });

  test('a plain object passes through unchanged', () => {
    const obj = { type: 'group', properties: {} };
    expect(coerceSpec(obj)).toBe(obj);
  });

  test('malformed YAML throws (→ 400 at the boundary)', () => {
    expect(() => coerceSpec('[a, b')).toThrow(/YAML parse error/);
  });

  test('YAML that parses to a non-object (a scalar) throws', () => {
    expect(() => coerceSpec('42')).toThrow(/must parse to an object/);
  });

  test('missing spec (null/undefined) throws', () => {
    expect(() => coerceSpec(undefined)).toThrow(/Missing field: spec/);
  });
});

describe('HTTP boundary — client input faults are 4xx { error }', () => {
  test('bad JSON request body → 400 { error }', async () => {
    const res = await postRaw('/api/validate', '{ this is not json');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('missing spec field → 400 { error }', async () => {
    const res = await postRaw('/api/validate', JSON.stringify({ data: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/spec/i);
  });

  test('malformed YAML spec string → 400 { error }', async () => {
    const res = await postRaw('/api/validate', JSON.stringify({ spec: '[a, b' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/YAML/i);
  });

  test('render endpoint shares the same 400 contract (no engine boot for input faults)', async () => {
    const res = await postRaw('/api/render', JSON.stringify({ spec: '[a, b' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/YAML/i);
  });

  test('validate-list endpoint shares the same 400 contract (malformed YAML list-spec)', async () => {
    const res = await postRaw('/api/validate-list', JSON.stringify({ listSpec: '[a, b' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/YAML/i);
  });

  test('validate-list missing spec → 400 { error }', async () => {
    const res = await postRaw('/api/validate-list', JSON.stringify({ files: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/spec/i);
  });

  test('validate-detail shares the same 400 contract (malformed YAML and missing spec)', async () => {
    const malformed = await postRaw('/api/validate-detail', JSON.stringify({ detailSpec: '[a, b' }));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toMatch(/YAML/i);
    const missing = await postRaw('/api/validate-detail', JSON.stringify({ files: {} }));
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toMatch(/spec/i);
  });

  test('render-list shares the same 400 contract (malformed YAML and missing spec)', async () => {
    const malformed = await postRaw('/api/render-list', JSON.stringify({ listSpec: '[a, b' }));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toMatch(/YAML/i);
    const missing = await postRaw('/api/render-list', JSON.stringify({ rows: [] }));
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toMatch(/spec/i);
  });

  test('render-detail shares the same 400 contract (bad JSON, malformed YAML and missing spec)', async () => {
    const badJson = await postRaw('/api/render-detail', '{ this is not json');
    expect(badJson.status).toBe(400);
    expect((await badJson.json()).error).toBeTruthy();
    const malformed = await postRaw('/api/render-detail', JSON.stringify({ detailSpec: '[a, b' }));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toMatch(/YAML/i);
    const missing = await postRaw('/api/render-detail', JSON.stringify({ record: {} }));
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toMatch(/spec/i);
  });
});

describe('HTTP boundary — a detail render failure is a 200 result surface', () => {
  // Boots the Vite SSR engine (the detail render path starts no validator process).
  test('clean detail YAML → 200, parity:true, the same detail markup in all four', async () => {
    const detailSpec = 'fields:\n  name:\n    field: name\n    label: Name\n';
    const res = await postRaw('/api/render-detail', JSON.stringify({ spec: detailSpec, record: { name: 'Ada' }, options: { language: 'en' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r) => r.fw)).toEqual(['html', 'react', 'svelte', 'vue']);
    expect(body.results.filter((r) => !r.ok).map((r) => `${r.fw}:${r.error.code}`)).toEqual([]);
    expect(body.parity, JSON.stringify(body.mismatch)).toBe(true);
    expect(body.results[0].normalized).toContain('Ada');
  }, 120000);

  test('non-object record → 200 with INVALID_FORM_INPUT in all four, parity:true', async () => {
    const detailSpec = { fields: { name: { field: 'name', label: 'Name' } } };
    const res = await postRaw('/api/render-detail', JSON.stringify({ detailSpec, record: [1, 2] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.every((r) => !r.ok && r.error.code === 'INVALID_FORM_INPUT')).toBe(true);
    expect(body.parity).toBe(true);
  }, 120000);
});

describe('HTTP boundary — CORS + /health', () => {
  test('every response carries CORS (Access-Control-Allow-Origin: *)', async () => {
    const res = await postRaw('/api/validate', '{bad');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('OPTIONS preflight → 204 with CORS', async () => {
    const res = await fetch(base + '/api/validate', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toMatch(/POST/);
  });

  test('GET /health → 200 { status: ok }', async () => {
    const res = await fetch(base + '/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });
});

describe('HTTP boundary — validation FAILURE is a 200 result surface, not an HTTP error', () => {
  // Real 4-language fan-out (spawns the validator processes). A spec whose data is invalid
  // must still return HTTP 200 with { results, idempotent } — the failure lives
  // INSIDE the envelope, never as a 4xx/5xx. Requires the Go/Rust binaries.
  test('invalid data → 200, valid:false in the envelope, idempotent:true', async () => {
    const spec = {
      type: 'group',
      properties: { email: { type: 'email', validate: { required: true } } },
    };
    const res = await postRaw('/api/validate', JSON.stringify({ spec, data: { email: '' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const failed = body.results.filter((r) => !r.ok);
    expect(failed.map((r) => `${r.lang}:${r.error}`)).toEqual([]);
    expect(body.idempotent, JSON.stringify(body.mismatch)).toBe(true);
    expect(body.results.every((r) => r.valid === false)).toBe(true);
  }, 60000);

  // The validate sister of /api/validate (SPEC §9). A list-spec carrying a §6
  // forbidden meta key is a load failure, NOT an HTTP error: still 200, with the
  // SAME failure record on all five engines (idempotent). Requires Go/Rust.
  test('list-spec with a forbidden meta key → 200, failure code on all five, idempotent:true', async () => {
    const listSpec = {
      columns: { name: { field: 'name' }, display_switch: { field: 'x' } },
    };
    const res = await postRaw('/api/validate-list', JSON.stringify({ listSpec }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const failed = body.results.filter((r) => !r.ok);
    expect(failed.map((r) => `${r.lang}:${r.error}`)).toEqual([]);
    expect(body.idempotent, JSON.stringify(body.mismatch)).toBe(true);
    expect(body.results.every((r) => r.failure && r.failure.code === 'FORBIDDEN_META_KEY')).toBe(true);
    expect(body.results.every((r) => r.valid === false)).toBe(true);
  }, 60000);

  test('detail spec with a forbidden meta key → 200, the same failure on all five', async () => {
    const detailSpec = { fields: { name: { field: 'name', show_if: '.admin' } } };
    const res = await postRaw('/api/validate-detail', JSON.stringify({ detailSpec }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.filter((r) => !r.ok).map((r) => `${r.lang}:${r.error}`)).toEqual([]);
    expect(body.idempotent, JSON.stringify(body.mismatch)).toBe(true);
    expect(body.results.every((r) => r.failure && r.failure.code === 'FORBIDDEN_META_KEY' && r.failure.at === 'fields.name.show_if')).toBe(true);
  }, 60000);

  // A clean list-spec → 200, valid:true on all five (idempotent). `data` on the
  // request is ignored — a list has no rows (mode:list runs no DATA pass).
  test('clean list-spec → 200, valid:true on all five, idempotent:true', async () => {
    const listSpec = { columns: { name: { field: 'name', label: 'Name' } } };
    const res = await postRaw('/api/validate-list', JSON.stringify({ listSpec, data: { ignored: true } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const failed = body.results.filter((r) => !r.ok);
    expect(failed.map((r) => `${r.lang}:${r.error}`)).toEqual([]);
    expect(body.idempotent, JSON.stringify(body.mismatch)).toBe(true);
    expect(body.results.every((r) => r.valid === true)).toBe(true);
  }, 60000);
});
