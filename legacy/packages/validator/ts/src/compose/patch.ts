/**
 * `$patch` application — add / remove / replace over the `$ref` base (SPEC
 * §5). `$patch` is the only overlay; the `$after`/`$before`/`$merge`/`$change`/
 * `$remove` directives are forbidden meta keys. Added keys keep declaration
 * order because CRUDUI properties preserve insertion order.
 *
 * `$patch` is an OBJECT of operations.
 * Two order-preserving input shapes are supported:
 *
 *   1. Deep-path set — `"field.validate.required": ".other"`. The dotted key is
 *      split into path segments and the value is SET at that node (creating
 *      intermediate objects). This is the SPEC §5 canonical form. The value
 *      replaces any scalar leaf; for object values it deep-merges (both
 *      objects → deep merge, else the latter wins).
 *
 *   2. Structured ops — explicit `add` / `remove` / `replace` keys:
 *        add:     { "path.to.new": value, … }   — deep-merge value at path
 *        replace: { "path.to.key": value, … }   — same merge rule (scalar override)
 *        remove:  [ "path.to.key", … ] | { … }  — deep delete
 *
 * Resolution order: base ($ref) first, then $patch overlays. add/replace
 * deep-merge; remove deep-deletes; deep-path set splits then applies. An
 * unresolved patch (op shape error, path conflict, strict-remove miss) is a
 * LOAD ERROR — never `valid:true`.
 */

import { isRecord } from '../record';
import { ComposeLoadError } from './errors';

/** Apply a `$patch` object to the (already `$ref`-expanded) base spec. */
export function applyPatch(base: Record<string, unknown>, patch: unknown): Record<string, unknown> {
  if (!isRecord(patch)) {
    throw new ComposeLoadError(
      'PATCH_SHAPE',
      `$patch must be an object of operations, got ${
        patch === null ? 'null' : Array.isArray(patch) ? 'array' : typeof patch
      }`
    );
  }
  let result = base;

  // Apply entries in declaration order (CRUDUI properties preserve order).
  for (const key of Object.keys(patch)) {
    const val = patch[key];
    if (key === 'add' || key === 'replace') {
      result = applyAddReplace(result, val, key);
    } else if (key === 'remove') {
      result = applyRemove(result, val);
    } else {
      // Deep-path set (SPEC §5 canonical form): "a.b.c": value.
      result = setDeepPath(result, splitPath(key), val);
    }
  }
  return result;
}

/** Structured add/replace: a map of deep-path → value, deep-merged at each path. */
function applyAddReplace(
  base: Record<string, unknown>,
  val: unknown,
  op: 'add' | 'replace'
): Record<string, unknown> {
  if (!isRecord(val)) {
    throw new ComposeLoadError(
      'PATCH_SHAPE',
      `$patch.${op} must be an object of deep-path → value`
    );
  }
  let result = base;
  for (const path of Object.keys(val)) {
    result = setDeepPath(result, splitPath(path), val[path]);
  }
  return result;
}

/** Structured remove: an array of deep-paths, or a nested `{k:{sub:…}}` map. */
function applyRemove(base: Record<string, unknown>, val: unknown): Record<string, unknown> {
  if (Array.isArray(val)) {
    let result = base;
    for (const path of val) {
      if (typeof path !== 'string') {
        throw new ComposeLoadError('PATCH_SHAPE', `$patch.remove array entries must be strings`);
      }
      result = removeDeepPath(result, splitPath(path));
    }
    return result;
  }
  if (isRecord(val)) {
    // Nested map form: recurse where both sides are objects.
    return removeNested(base, val);
  }
  throw new ComposeLoadError(
    'PATCH_SHAPE',
    `$patch.remove must be an array of paths or a nested object`
  );
}

/** Split a dotted deep-path into segments. Empty path is a shape error. */
function splitPath(path: string): string[] {
  if (path === '') {
    throw new ComposeLoadError('PATCH_SHAPE', `$patch path must be non-empty`);
  }
  return path.split('.');
}

/**
 * Set a value at a deep path, creating intermediate objects. When both the
 * existing leaf and the new value are plain objects, DEEP-MERGE;
 * otherwise the new value REPLACES. Returns a new tree
 * (the input is not mutated).
 */
function setDeepPath(
  node: Record<string, unknown>,
  segments: string[],
  value: unknown
): Record<string, unknown> {
  const [head, ...rest] = segments;
  const out: Record<string, unknown> = { ...node };

  if (rest.length === 0) {
    const existing = out[head];
    out[head] = mergeValue(existing, value);
    return out;
  }

  const child = out[head];
  if (child === undefined) {
    out[head] = setDeepPath({}, rest, value);
  } else if (isRecord(child)) {
    out[head] = setDeepPath(child, rest, value);
  } else {
    // Intermediate node is a scalar/array — cannot descend into it.
    throw new ComposeLoadError(
      'PATCH_PATH_CONFLICT',
      `$patch cannot descend into non-object at '${head}'`
    );
  }
  return out;
}

/**
 * Deep-merge leaf rule: both plain objects →
 * recursive deep merge; otherwise the latter value wins (scalar/array override).
 */
function mergeValue(existing: unknown, incoming: unknown): unknown {
  if (isRecord(existing) && isRecord(incoming)) {
    const out: Record<string, unknown> = { ...existing };
    for (const k of Object.keys(incoming)) {
      out[k] = mergeValue(out[k], incoming[k]);
    }
    return out;
  }
  return incoming;
}

/** Delete a value at a deep path. Strict: a missing target is a load error. */
function removeDeepPath(
  node: Record<string, unknown>,
  segments: string[]
): Record<string, unknown> {
  const [head, ...rest] = segments;
  if (!(head in node)) {
    throw new ComposeLoadError(
      'PATCH_REMOVE_TARGET_MISSING',
      `$patch remove target not found: '${segments.join('.')}'`
    );
  }
  const out: Record<string, unknown> = { ...node };
  if (rest.length === 0) {
    delete out[head];
    return out;
  }
  const child = out[head];
  if (!isRecord(child)) {
    throw new ComposeLoadError(
      'PATCH_REMOVE_TARGET_MISSING',
      `$patch remove cannot descend into non-object at '${head}'`
    );
  }
  out[head] = removeDeepPath(child, rest);
  return out;
}

/**
 * Nested-map remove: for each key, recurse when both the
 * target and the removal spec are objects, else unset the key. A missing key is
 * tolerated here (it is silently skipped), unlike the array-path form.
 */
function removeNested(
  base: Record<string, unknown>,
  spec: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(spec)) {
    const sub = spec[key];
    const target = out[key];
    if (key in out && isRecord(target) && isRecord(sub)) {
      out[key] = removeNested(target, sub);
    } else {
      delete out[key];
    }
  }
  return out;
}
