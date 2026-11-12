/**
 * Keyed maps (docs/spec/schema.md and docs/spec/validation-rules.md, "Keyed maps"): a field that
 * declares `multiple.keys` holds rows only under the row keys of the repeated group that the
 * reference names.
 */

import type { PathContext } from '../types';
import { isRecord } from '../record';
import { FormInputError } from './errors';
import { isMultipleField } from './fields';
import { compareCodePoints } from '../text/index';
import { pathToString, resolveFieldReference } from '../parser/PathResolver';

/** The declared `multiple.keys` of a field, or undefined when it declares none. */
function keyedMapReference(field: Record<string, unknown>): unknown {
  const multiple = field.multiple;
  return isRecord(multiple) && Object.prototype.hasOwnProperty.call(multiple, 'keys') ? multiple.keys : undefined;
}

/**
 * Whether `reference`, declared by the field at `declarationPath`, names a repeated group of the
 * form whose root field map is `root` (CUSC-077): it leaves as many fields of the declaration
 * path as it has leading dots (a bare name one; a path with a dot inside and no leading dot starts at the root),
 * stays within the root, has no empty name and no `*`, passes only through groups that do not
 * repeat and ends on a repeated group.
 */
function namesRepeatedGroup(reference: unknown, declarationPath: string[], root: Record<string, unknown>): boolean {
  if (typeof reference !== 'string') return false;
  let dots = 0;
  while (dots < reference.length && reference[dots] === '.') dots++;
  const rest = reference.slice(dots);
  // A path with a dot inside and no leading dot starts at the root; a bare name leaves the field.
  const fromRoot = dots === 0 && rest.includes('.');
  const leave = fromRoot ? declarationPath.length : Math.max(dots, 1);
  if (leave > declarationPath.length) return false;
  const names = rest.split('.');
  if (names.some(name => name === '' || name === '*')) return false;
  let properties = root;
  for (const name of declarationPath.slice(0, declarationPath.length - leave)) {
    const field = properties[name];
    properties = isRecord(field) && isRecord(field.properties) ? field.properties : {};
  }
  for (const [index, name] of names.entries()) {
    const field = Object.prototype.hasOwnProperty.call(properties, name) ? properties[name] : undefined;
    if (!isRecord(field) || field.type !== 'group' || !isRecord(field.properties)) return false;
    if (index === names.length - 1) return isMultipleField(field);
    if (isMultipleField(field)) return false;
    properties = field.properties;
  }
  return false;
}

/**
 * Fail the load when the field declares a `multiple.keys` that names no repeated group (CUVR-070).
 *
 * @throws {FormInputError} with the field's declaration path.
 */
export function assertKeyedMapReference(field: Record<string, unknown>, declarationPath: string[], root: Record<string, unknown>): void {
  const reference = keyedMapReference(field);
  if (reference === undefined) return;
  if (!namesRepeatedGroup(reference, declarationPath, root)) {
    throw new FormInputError(`Invalid multiple.keys at ${pathToString(declarationPath)}: expected a reference to a repeated group`);
  }
}

/**
 * Fail when a key of the keyed object `value` of the field is not a row key of the group that its
 * `multiple.keys` names, read in the field's row context (CUVR-069); keys in code point order.
 *
 * @throws {FormInputError} with the data path of the first row whose key is not an id.
 */
export function assertKeyedMapKeys(field: Record<string, unknown>, value: Record<string, unknown>, context: PathContext): void {
  const reference = keyedMapReference(field);
  if (typeof reference !== 'string') return;
  const group = resolveFieldReference(reference, context);
  const ids = isRecord(group) ? group : {};
  for (const key of Object.keys(value).sort(compareCodePoints)) {
    if (!Object.prototype.hasOwnProperty.call(ids, key)) {
      throw new FormInputError(`Row key is not an id of ${reference}: ${pathToString([...context.currentPath, key])}`);
    }
  }
}
