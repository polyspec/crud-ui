/** Root composition shared by the list and detail structure validators. */

import { resolveRef } from './compose/index';
import { layerMembers } from './compose/layer';
import type { FileLoader } from './compose/index';

/**
 * Apply a specification root `$ref`/`$patch` (base specification inheritance) with the same
 * resolveRef/applyPatch primitives form composition uses. A root without composition keys is
 * returned as a shallow copy. The base file is resolved through resolveRef (a `properties` layer),
 * so a missing or malformed base is a load failure. Own keys written before `$ref` yield to the
 * base; own keys written after it override the base; `$patch` applies last.
 */
export function composeRoot(
  spec: Record<string, unknown>,
  loader: FileLoader,
  opts: { basepath?: string }
): Record<string, unknown> {
  if (!('$ref' in spec) && !('$patch' in spec)) {
    return { ...spec };
  }
  const basepath = opts.basepath ?? '';
  return layerMembers(spec, (ref) => resolveRef(ref, basepath, loader));
}
