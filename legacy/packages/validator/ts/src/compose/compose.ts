/**
 * Composition orchestrator (SPEC §5, G5) — the parser's FIRST pass.
 *
 * Resolution order (SPEC §5, verbatim):
 *   (1) $ref   — expand file/path base, recursively (nested $ref included) into a
 *                single properties base.
 *   (2) $patch — overlay add/remove/replace and deep-path set on that base.
 *   (3) the result is the equivalent SINGLE SPEC (composition keys eliminated).
 *   (4) the field layer (validate/design/behavior/options) then applies to it.
 *
 * G5 (SPEC §2): the parser expands composition first, producing a single spec,
 * BEFORE applying the field layer — without composition a `$ref`-using spec
 * cannot even be loaded. So composition is a pre-processing pass that runs
 * BEFORE validation/render, not a validation step.
 *
 * Priority: `$ref` = base (first), `$patch` = overlay (later) — base is laid
 * down, patch overrides.
 *
 * `composeProperties` is the entry point: it operates on a `properties` map (the
 * composition entry point, SPEC §2 / types.ts:73) where `$ref`/`$patch` may sit
 * alongside named child fields. `composeSpec` recurses the whole field tree so a
 * `$ref` nested inside any child `properties` is expanded too. Both throw a
 * `ComposeLoadError` for any unresolved composition (never `valid:true`).
 */

import { isRecord } from '../record';
import { resolveRef } from './ref';
import { layerMembers } from './layer';
import type { FileLoader } from './loader';

/** Options for a composition pass. */
interface ComposeOptions {
  /** Basepath for relative `$ref` resolution . */
  basepath?: string;
}

/**
 * Compose a `properties` map: expand `$ref` to a base, overlay `$patch`, return
 * the single (composition-free) properties map. Named sibling keys follow
 * declaration order — a key declared after `$ref` overrides the base; a key
 * declared before it is overridden by the base.
 */
export function composeProperties(
  properties: Record<string, unknown>,
  loader: FileLoader,
  opts: ComposeOptions = {}
): Record<string, unknown> {
  const basepath = opts.basepath ?? '';

  let result = layerMembers(properties, (ref) => resolveRef(ref, basepath, loader));

  // Recurse into every child field's `properties` (the tree may compose deeper).
  for (const fieldName of Object.keys(result)) {
    const field = result[fieldName];
    if (isRecord(field)) {
      result[fieldName] = composeSpec(field, loader, opts);
    }
  }

  return result;
}

/**
 * Compose a full field spec: expand a field-level `$ref`/`$patch`, then recurse
 * into its `properties` (which may itself compose). Returns the single spec.
 */
export function composeSpec(
  spec: Record<string, unknown>,
  loader: FileLoader,
  opts: ComposeOptions = {}
): Record<string, unknown> {
  const basepath = opts.basepath ?? '';

  // Each branch assigns `resolved` exactly once (no useless first write).
  let resolved: Record<string, unknown>;

  // Field-level $ref / $patch (a field may inherit a whole base spec).
  if ('$ref' in spec || '$patch' in spec) {
    // Field-level $ref resolves a file's properties layer too.
    resolved = layerMembers(spec, (ref) => resolveRef(ref, basepath, loader));
  } else {
    resolved = { ...spec };
  }

  // Recurse into `properties` (composition entry point, SPEC §2 / types.ts:73).
  const props = resolved.properties;
  if (isRecord(props)) {
    resolved.properties = composeProperties(props, loader, opts);
  }

  return resolved;
}
