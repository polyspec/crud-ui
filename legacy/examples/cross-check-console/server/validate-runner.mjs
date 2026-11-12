/**
 * Execute the JavaScript, PHP, Go, Rust and Python validator processes and compare their results.
 * Each process receives JSON on stdin and has a ten-second timeout. Responses
 * must match the exit status and JSON contract. Data errors preserve path,
 * field, rule, message and value; a form result carries its hidden paths; load
 * and input failures use failure.
 */

import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { ROOT } from './engine.mjs';

// The validator processes of the console (../validators): one program per language that answers
// one JSON request through the language's public validator API. The JavaScript program needs the
// built packages (`node scripts/require-current-build.mts`); `npm run build:validators` builds
// the Go and Rust programs. A deployment may name other Go and Rust executables.
export const VALIDATORS = path.join(ROOT, 'legacy/examples/cross-check-console/validators');
export const PHP_PROGRAM = path.join(VALIDATORS, 'php/validate.php');
export const validatorProcesses = Object.freeze({
  js: { command: process.execPath, args: [path.join(VALIDATORS, 'js/validate.mjs')] },
  php: { command: 'php', args: [PHP_PROGRAM] },
  go: { command: process.env.CRUDUI_CROSS_CHECK_GO_VALIDATOR ?? path.join(ROOT, 'var/build/cross-check-console/go-validate'), args: [] },
  rust: {
    command: process.env.CRUDUI_CROSS_CHECK_RUST_VALIDATOR
      ?? path.join(VALIDATORS, 'rust/target/release/polyspec-crudui-cross-check-validator'),
    args: [],
  },
  python: { command: process.env.CRUDUI_PYTHON ?? path.join(ROOT, 'var/python/bin/python'), args: [path.join(VALIDATORS, 'python/validate.py')] },
});

/**
 * Validate one request through the five validator processes.
 *
 * @param {object} req { spec, data, files?, basepath? }
 * @returns {Promise<{results: object[], idempotent: boolean, mismatch: object|null}>}
 *   Each result of a form validation holds `hidden`.
 */
export async function validateAll(req) {
  const payload = {
    spec: req.spec,
    data: req.data ?? {},
    files: req.files ?? {},
    basepath: req.basepath ?? '',
  };
  return fanOut(payload);
}

/**
 * Validate list composition and forbidden keys through the five validator processes.
 * List requests contain a specification and composition inputs, without row data.
 *
 * @param {object} req { spec, files?, basepath? }
 * @returns {Promise<{results: object[], idempotent: boolean, mismatch: object|null}>}
 */
export async function validateAllList(req) {
  const payload = {
    spec: req.spec,
    files: req.files ?? {},
    basepath: req.basepath ?? '',
    mode: 'list',
  };
  return fanOut(payload);
}

/**
 * Validate detail composition and forbidden keys through the five validator processes.
 * Detail requests contain a specification and composition inputs, without a record.
 *
 * @param {object} req { spec, files?, basepath? }
 * @returns {Promise<{results: object[], idempotent: boolean, mismatch: object|null}>}
 */
export async function validateAllDetail(req) {
  const payload = {
    spec: req.spec,
    files: req.files ?? {},
    basepath: req.basepath ?? '',
    mode: 'detail',
  };
  return fanOut(payload);
}

/** Execute the five validator processes on one payload and compare the results. */
function fanOut(payload) {
  const results = Object.keys(validatorProcesses).map(lang => runProcess(lang, payload));
  const { idempotent, mismatch } = compareIdempotency(results);
  return { results, idempotent, mismatch };
}


/**
 * Execute a validator process and check its exit status and response fields. Every
 * language uses the same responses:
 *   form result:           exit 0, stdout exactly { valid, errors:[5-field], hidden:[path] }
 *   list or detail result: exit 0, stdout exactly { valid, errors:[5-field] }
 *   load or input failure: exit 2, stdout exactly { error, code, at }
 *   malformed request:     exit 1, stdout { error }
 */
function runProcess(lang, payload) {
  const { command, args } = validatorProcesses[lang];
  const t0 = performance.now();
  const proc = spawnSync(command, args, {
    encoding: 'utf-8',
    input: JSON.stringify(payload),
    timeout: 10000,
    cwd: VALIDATORS,
    env: process.env,
  });
  const ms = Math.round(performance.now() - t0);

  if (proc.error) {
    const limit = proc.error.code === 'ETIMEDOUT' ? `; it ran ${ms} ms of its 10000 ms limit` : '';
    return processFail(lang, ms, `${[command, ...args].join(' ')}: ${proc.error.message}${limit}`);
  }
  if (proc.signal || proc.status === null) {
    return processFail(lang, ms, `${lang} validator terminated (${proc.signal ?? 'no exit status'})`);
  }

  const stdout = (proc.stdout || '').trim();
  let parsed = null;
  if (stdout) {
    try {
      parsed = JSON.parse(stdout);
    } catch (error) { if (!(error instanceof SyntaxError)) throw error;
      parsed = null;
    }
  }

  if (!isObject(parsed)) {
    return processFail(lang, ms, proc.stderr || `invalid ${lang} JSON response (exit ${proc.status})`);
  }

  if (proc.status === 2) {
    if (Object.keys(parsed).sort().join(',') !== 'at,code,error' ||
        typeof parsed.code !== 'string' || !parsed.code ||
        typeof parsed.error !== 'string' || !parsed.error ||
        typeof parsed.at !== 'string') {
      return processFail(lang, ms, `invalid ${lang} failure response`);
    }
    return {
      lang,
      ok: true,
      valid: false,
      errors: [],
      ms,
      failure: { code: parsed.code, message: parsed.error, at: parsed.at },
    };
  }

  if (proc.status !== 0) {
    return processFail(lang, ms, proc.stderr || parsed.error || `${lang} validator exited ${proc.status}`);
  }
  const form = (payload.mode ?? 'form') === 'form';
  const members = form ? 'errors,hidden,valid' : 'errors,valid';
  if (typeof parsed.valid !== 'boolean' || !Array.isArray(parsed.errors) ||
      !parsed.errors.every(isValidationError) ||
      parsed.valid !== (parsed.errors.length === 0) ||
      (form && !(Array.isArray(parsed.hidden) && parsed.hidden.every(item => typeof item === 'string'))) ||
      Object.keys(parsed).sort().join(',') !== members) {
    return processFail(lang, ms, `invalid ${lang} validation response`);
  }

  return {
    lang,
    ok: true,
    valid: parsed.valid,
    errors: parsed.errors,
    ...(form ? { hidden: parsed.hidden } : {}),
    ms,
    failure: null,
  };
}

function processFail(lang, ms, message) {
  return {
    lang,
    ok: false,
    valid: false,
    errors: [],
    ms,
    failure: null,
    error: String(message || '').trim() || `${lang} validator failed`,
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidationError(error) {
  return isObject(error) &&
    ['path', 'field', 'rule', 'message'].every(key => typeof error[key] === 'string') &&
    Object.hasOwn(error, 'value');
}

/** Serialize object values deterministically; array order remains significant. */
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

/** Stable comparison signature: the complete failure record, or valid + sorted errors + hidden paths in order. */
export function signature(r) {
  if (!r.ok) return `__error__:${r.error || ''}`;
  if (r.failure) return `failure:${r.failure.code}|${r.failure.message}|${r.failure.at}`;
  const sorted = [...r.errors].sort((a, b) =>
    [a.path, a.field, a.rule, a.message].join('|').localeCompare(
      [b.path, b.field, b.rule, b.message].join('|'))
  );
  const key = sorted.map((e) => `${e.path}|${e.field}|${e.rule}|${e.message}|${JSON.stringify(stableValue(e.value))}`);
  const hidden = Array.isArray(r.hidden) ? `#hidden=${JSON.stringify(r.hidden)}` : '';
  return `valid=${r.valid}#${key.join(';')}${hidden}`;
}

/** Compare every required validator, including execution failures. */
export function compareIdempotency(results) {
  const expected = ['js', 'php', 'go', 'rust', 'python'];
  const missing = expected.filter(lang => !results.some(result => result.lang === lang));
  const complete = results.length === expected.length && missing.length === 0 &&
    results.every(result => result.ok && expected.includes(result.lang));
  const sigs = results.map((result) => ({ lang: result.lang, sig: signature(result) }));
  const distinct = new Set(sigs.map(result => result.sig));
  if (complete && distinct.size === 1) return { idempotent: true, mismatch: null };
  // Group langs by signature so the client can show which langs diverged.
  const groups = {};
  for (const s of sigs) {
    (groups[s.sig] ??= []).push(s.lang);
  }
  return {
    idempotent: false,
    mismatch: {
      missing,
      groups: Object.entries(groups).map(([sig, langs]) => ({ langs, signature: sig })),
      detail: results.map((r) => ({
        lang: r.lang,
        ok: r.ok,
        valid: r.valid,
        failure: r.failure,
        errors: r.errors,
        ...(Object.hasOwn(r, 'hidden') ? { hidden: r.hidden } : {}),
        error: r.error ?? null,
      })),
    },
  };
}
