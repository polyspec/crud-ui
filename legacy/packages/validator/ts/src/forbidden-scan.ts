/**
 * Recursive forbidden meta-key scan (SPEC §6) — the runtime half of the
 * global rejection that the meta-schema's `propertyNames` enforces statically.
 *
 * R1: the types/parser PRESERVE every key (round-trip), so blocking forbidden
 * meta keys is the VALIDATION layer's job, not the model's. The direct audit
 * found that the Go/Rust typed models only rejected forbidden keys at the top
 * level and one level under open buckets — a deeply nested meta key
 * (`validate.required.if`, `options.x.display_switch`, …) leaked through. This
 * scan closes that leak: it walks the COMPOSED single spec (after `$ref`/`$patch`
 * expansion and x-strip) to ARBITRARY depth and rejects a forbidden key found at
 * ANY depth — including one level under a slot/bucket body.
 *
 * Placement (SPEC §2 pipeline): this runs in the spec LOAD path, immediately
 * after compose expansion and before validation entry. A hit is therefore a LOAD
 * failure (`ComposeLoadError`, code `FORBIDDEN_META_KEY`) — the spec never comes
 * into existence — never a `valid:false` validation result.
 *
 * Forbidden set (SPEC §6): the enumerated `FORBIDDEN_META_KEYS`
 * (condition-only / composition-directive / magic-symbol meta keys) PLUS the `x{key}` comment
 * family (any `x`-prefixed key). `$ref`/`$patch` are NOT forbidden — compose
 * already consumed them, so they do not survive to here; `x{key}` IS strip-
 * eligible, so any `x{key}` that survives to this scan is rejected (the strip
 * belongs to the meta-schema; survival means it was not stripped).
 */

import { isRecord } from './record';
import { ComposeLoadError } from './compose/errors';
import { FORBIDDEN_META_KEYS } from './schema';

/** O(1) membership for the enumerated forbidden meta keys. */
const FORBIDDEN_SET: ReadonlySet<string> = new Set<string>(FORBIDDEN_META_KEYS);

/**
 * Whether `key` is an `x{key}` comment key: a lowercase/uppercase `x` followed
 * by at least one more character (`xclass`, `xstyle`, `xnote`, …). The bare key
 * `x` is not treated as a comment. The authoritative strip belongs to the meta-
 * schema; this is the runtime backstop that rejects an `x{key}` that survived.
 */
function isXCommentKey(key: string): boolean {
  return key.length > 1 && key.charCodeAt(0) === 0x78 /* 'x' */;
}

/** Whether `key` is globally forbidden (enumerated literal OR `x{key}`). */
function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_SET.has(key) || isXCommentKey(key);
}

/**
 * Recursively scan a composed single spec for any forbidden meta key at any
 * depth. Throws `ComposeLoadError('FORBIDDEN_META_KEY')` on the first hit, with
 * the dotted path to the offending key in `message` and `trace`.
 *
 * The scan descends into every object value AND every array element (a forbidden
 * key nested inside an array of sub-specs is caught too). Map keys are checked
 * before descending into their values, so the reported path points at the
 * shallowest offending key.
 *
 * @param spec the composed (composition-free, x-stripped) single spec to scan.
 * @param rootPath optional path prefix for the error trace (default `[]`).
 * @throws {ComposeLoadError} code `FORBIDDEN_META_KEY` when a forbidden key is
 *         present at any depth.
 */
export function scanForbiddenKeys(spec: unknown, rootPath: string[] = []): void {
  walk(spec, rootPath);
}

function walk(node: unknown, path: string[]): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      walk(node[i], [...path, String(i)]);
    }
    return;
  }
  if (!isRecord(node)) {
    return;
  }
  const obj = node;
  // Check every key at THIS level first (shallowest hit reported), then descend.
  for (const key of Object.keys(obj)) {
    if (isForbiddenKey(key)) {
      const at = [...path, key];
      throw new ComposeLoadError(
        'FORBIDDEN_META_KEY',
        `forbidden meta key "${key}" at ${at.join('.')}`,
        at
      );
    }
  }
  for (const key of Object.keys(obj)) {
    walk(obj[key], [...path, key]);
  }
}
