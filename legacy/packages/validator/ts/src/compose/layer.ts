/**
 * The layering of the members of one node (SPEC §5): a `$ref` lays its resolved base over
 * the members declared before it, the members declared after it override that base, and a
 * `$patch` overlays the result.
 */

import { applyPatch } from './patch';

/** Layer the members of `node` in declaration order; `resolveRef` resolves the value of a `$ref`. */
export function layerMembers(
  node: Record<string, unknown>,
  resolveRef: (value: unknown) => Record<string, unknown>
): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  let patch: unknown;
  let sawPatch = false;
  const own: Record<string, unknown> = {};
  for (const k of Object.keys(node)) {
    if (k === '$ref') {
      // The ref lays down onto whatever was declared before it; later members override.
      base = { ...own, ...resolveRef(node[k]) };
      for (const ok of Object.keys(own)) delete own[ok];
    } else if (k === '$patch') {
      sawPatch = true;
      patch = node[k];
    } else {
      own[k] = node[k];
    }
  }
  const result: Record<string, unknown> = { ...base, ...own };
  return sawPatch ? applyPatch(result, patch) : result;
}
