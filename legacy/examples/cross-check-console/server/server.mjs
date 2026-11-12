/**
 * Cross-Check Console gateway server.
 *
 * One Node process is responsible for three things:
 *   (a) POST /api/validate, /api/validate-list, /api/validate-detail — 4-language
 *       CRUDUI validation fan-out (JS/PHP/Go/Rust stdin-JSON validator processes).
 *   (b) POST /api/render, /api/render-list, /api/render-detail — HTML/React/Svelte/Vue CRUDUI
 *       SSR (React/Svelte sync, Vue async), all in-process through the same CRUDUI
 *       entries used by conformance checks.
 *   (c) static console      — serves client/ at /.
 *
 * Server contract: CORS on
 * every response, validation/render failures are NOT HTTP errors (always 200 with
 * a result envelope), and only real server faults use 4xx/5xx with { error }.
 *
 * `spec` may arrive as a YAML string (the console editor) or as an already-parsed
 * object; both are accepted. A YAML parse failure is a 400 { error } (a client
 * input fault, not a validation result).
 *
 * Built on Node's `http` (no express) so the example runs with zero install — the
 * only runtime deps (js-yaml, Vite + the svelte plugin) already live in the
 * workspace. The Express-pattern semantics are preserved deliberately.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load as loadYaml } from 'js-yaml';

import { getEngine } from './engine.mjs';
import { validateAll, validateAllDetail, validateAllList } from './validate-runner.mjs';
import { renderAll, renderAllDetail, renderAllList } from './render-runner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(HERE, '../client');
const PORT = Number(process.env.PORT) || 4000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** Set CORS headers on every response (Express-pattern parity). */
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/** Read and JSON-parse the request body (POST endpoints). */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON request body: ' + e.message));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Coerce `spec` to a plain object: a YAML/JSON string is parsed; an object passes
 * through. Throws on a parse failure or a non-object result (a client fault).
 */
export function coerceSpec(spec) {
  if (spec == null) throw new Error('Missing field: spec');
  if (typeof spec === 'string') {
    let parsed;
    try {
      parsed = loadYaml(spec);
    } catch (e) {
      throw new Error('Spec YAML parse error: ' + e.message, { cause: e });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Spec must parse to an object');
    }
    return parsed;
  }
  if (typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('Spec must be an object or a YAML string');
  }
  return spec;
}

/** Serve a static file from client/ (path-traversal safe). */
function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(CLIENT_DIR, rel);
  // Containment check: never escape CLIENT_DIR.
  if (!filePath.startsWith(CLIENT_DIR + path.sep) && filePath !== CLIENT_DIR) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA-ish fallback: unknown non-API path → index.html.
      if (rel !== '/index.html') {
        return serveStatic(res, '/index.html');
      }
      return sendJson(res, 404, { error: 'Not found' });
    }
    setCors(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  });
}

/**
 * Read the JSON body of a request and coerce the specification that `pick` takes from it. A bad body or specification is
 * answered with 400 here and gives null.
 */
async function readBodyAndSpec(req, res, pick) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    sendJson(res, 400, { error: e.message });
    return null;
  }
  try {
    return { body, spec: coerceSpec(pick(body)) };
  } catch (e) {
    sendJson(res, 400, { error: e.message });
    return null;
  }
}

/**
 * The bare request handler — same routing the live server uses, but with no
 * `listen` side effect. server.test.mjs mounts it on an ephemeral port so the
 * HTTP boundary (coerceSpec YAML/object, 400/500 vs 200 result-surface, CORS,
 * /health) is exercised without booting the production listener.
 */
export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    setCors(res);
    res.statusCode = 204;
    return res.end();
  }

  // ---- POST /api/validate -------------------------------------------------
  if (pathname === '/api/validate' && req.method === 'POST') {
    const request = await readBodyAndSpec(req, res, (body) => body.spec);
    if (!request) return;
    const { body, spec } = request;
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    try {
      const out = await validateAll({
        spec,
        data,
        files: body.files ?? {},
        basepath: body.basepath ?? '',
      });
      // Validation failure is NOT an HTTP error: always 200.
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 500, { error: 'Validate fan-out failed: ' + e.message });
    }
  }

  // ---- POST /api/validate-list --------------------------------------------
  // The validate sister of /api/validate (SPEC §9): a list-spec STRUCTURE fans
  // out across the five validator processes in `mode:list` (compose → forbidden-scan; no
  // DATA pass — a list carries no rows). Same HTTP contract as /api/validate —
  // a LOAD failure / valid:false is a result surface (200), only a real fan-out
  // fault is 5xx. The form validate path above is untouched (additive).
  if (pathname === '/api/validate-list' && req.method === 'POST') {
    // The list-spec arrives as a YAML string (the editor) or a parsed object;
    // `listSpec` is the canonical key, `spec` is accepted as an alias.
    const request = await readBodyAndSpec(req, res, (body) => body.listSpec ?? body.spec);
    if (!request) return;
    const { body, spec: listSpec } = request;
    try {
      const out = await validateAllList({
        spec: listSpec,
        files: body.files ?? {},
        basepath: body.basepath ?? '',
      });
      // A LOAD failure / valid:false is NOT an HTTP error: always 200.
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 500, { error: 'Validate-list fan-out failed: ' + e.message });
    }
  }

  // ---- POST /api/validate-detail ------------------------------------------
  // A detail specification structure fans out across the five validator processes in `mode:detail`
  // (compose → forbidden-scan; no record is validated). The HTTP contract matches
  // /api/validate-list: a load failure or valid:false is a 200 result, and only a
  // fan-out fault is 5xx. `detailSpec` is the canonical key; `spec` is an alias.
  if (pathname === '/api/validate-detail' && req.method === 'POST') {
    const request = await readBodyAndSpec(req, res, (body) => body.detailSpec ?? body.spec);
    if (!request) return;
    const { body, spec: detailSpec } = request;
    try {
      const out = await validateAllDetail({
        spec: detailSpec,
        files: body.files ?? {},
        basepath: body.basepath ?? '',
      });
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 500, { error: 'Validate-detail fan-out failed: ' + e.message });
    }
  }

  // ---- POST /api/render ---------------------------------------------------
  if (pathname === '/api/render' && req.method === 'POST') {
    const request = await readBodyAndSpec(req, res, (body) => body.spec);
    if (!request) return;
    const { body, spec } = request;
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    const options = body.options && typeof body.options === 'object' ? body.options : {};
    try {
      const out = await renderAll({ spec, data, options });
      // A render error (REF_FILE_NOT_FOUND / UNSUPPORTED_FIELD_TYPE) is a result
      // surface, NOT an HTTP error: always 200.
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 500, { error: 'Render fan-out failed: ' + e.message });
    }
  }

  // ---- POST /api/render-list ----------------------------------------------
  // The read sister of /api/render (SPEC §9): a list-spec + INJECTED rows fan out
  // across the three CRUDUI List SSR entries. Same HTTP contract as /api/render —
  // a render error (REF_FILE_NOT_FOUND) is a result surface (200), only a real
  // fan-out fault is 5xx. The form render path above is untouched (additive).
  if (pathname === '/api/render-list' && req.method === 'POST') {
    // The list-spec arrives as a YAML string (the editor) or a parsed object;
    // `listSpec` is the canonical key, `spec` is accepted as an alias.
    const request = await readBodyAndSpec(req, res, (body) => body.listSpec ?? body.spec);
    if (!request) return;
    const { body, spec: listSpec } = request;
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const options = body.options && typeof body.options === 'object' ? body.options : {};
    try {
      const out = await renderAllList(listSpec, rows, options);
      // A render error (REF_FILE_NOT_FOUND) is a result surface, NOT an HTTP
      // error: always 200.
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 500, { error: 'Render-list fan-out failed: ' + e.message });
    }
  }

  // ---- POST /api/render-detail --------------------------------------------
  // A detail specification and one injected record fan out across the three detail
  // SSR entries. The HTTP contract matches /api/render-list: a render error
  // (REF_FILE_NOT_FOUND, INVALID_FORM_INPUT) is a 200 result, and only a fan-out
  // fault is 5xx. `detailSpec` is the canonical key; `spec` is an alias. The record
  // passes unchanged so a non-object record fails in the renderers, not here.
  if (pathname === '/api/render-detail' && req.method === 'POST') {
    const request = await readBodyAndSpec(req, res, (body) => body.detailSpec ?? body.spec);
    if (!request) return;
    const { body, spec: detailSpec } = request;
    const record = body.record === undefined ? {} : body.record;
    const options = body.options && typeof body.options === 'object' ? body.options : {};
    try {
      const out = await renderAllDetail(detailSpec, record, options);
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 500, { error: 'Render-detail fan-out failed: ' + e.message });
    }
  }

  // ---- GET /health --------------------------------------------------------
  if (pathname === '/health' && req.method === 'GET') {
    return sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
  }

  // ---- static console -----------------------------------------------------
  if (req.method === 'GET') {
    return serveStatic(res, pathname);
  }

  return sendJson(res, 404, { error: 'Endpoint not found' });
}

/** Construct the HTTP server around `handler` (no listen). */
export function createGatewayServer() {
  return http.createServer(handler);
}

/** Boot the engine, then start listening. The production entry path. */
function startServer() {
  const server = createGatewayServer();
  server.listen(PORT, async () => {
    // Warm the CRUDUI engine (boot Vite SSR + load every CRUDUI entry) before serving so
    // the first request does not pay the cold-start cost. A boot failure is fatal.
    process.stdout.write('Booting CRUDUI engine (Vite SSR + 4-language wiring)...\n');
    try {
      await getEngine();
      process.stdout.write('CRUDUI engine ready.\n');
    } catch (e) {
      process.stderr.write('FATAL: CRUDUI engine boot failed: ' + (e && e.stack ? e.stack : e) + '\n');
      process.exit(1);
    }
    process.stdout.write(`\nCross-Check Console gateway on http://localhost:${PORT}\n`);
    process.stdout.write('  GET  /                 - console (static client/)\n');
    process.stdout.write('  POST /api/validate     - 4-language CRUDUI validate fan-out\n');
    process.stdout.write('  POST /api/validate-list - 4-language CRUDUI list-spec validate fan-out\n');
    process.stdout.write('  POST /api/validate-detail - 4-language CRUDUI detail specification validate fan-out\n');
    process.stdout.write('  POST /api/render       - HTML/React/Svelte/Vue CRUDUI form SSR\n');
    process.stdout.write('  POST /api/render-list  - HTML/React/Svelte/Vue CRUDUI list SSR\n');
    process.stdout.write('  POST /api/render-detail - HTML/React/Svelte/Vue CRUDUI detail SSR\n');
    process.stdout.write('  GET  /health           - liveness probe\n');
  });
  return server;
}

// Only start listening when run as the entry point (`node server.mjs`), so that
// importing this module for tests does NOT boot the engine or bind a port.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  startServer();
}
