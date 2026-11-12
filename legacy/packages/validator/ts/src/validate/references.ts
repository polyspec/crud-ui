/**
 * References (validation-rules.md, "References").
 *
 * A `reference` parameter is the declaration path of a field: its property names from the root
 * joined with `.`, without row keys. The ids of the path are the values of that field in the data,
 * read in every row of every repeated field on the path.
 */

import { isRecord } from '../record';
import { canonicalText, trim } from '../values/index';
import { isMultipleField } from './fields';

/** An id: a string, a finite number or a boolean whose canonical text is not empty after trimming. */
export type ReferenceId = string | number | boolean;

/** The declared field of the declaration path `segments` under `properties`, or undefined. */
function declaredField(properties: Record<string, unknown>, segments: readonly string[]): Record<string, unknown> | undefined {
  let fields: unknown = properties;
  let field: Record<string, unknown> | undefined;
  for (const name of segments) {
    if (!isRecord(fields) || !Object.prototype.hasOwnProperty.call(fields, name)) return undefined;
    const next = fields[name];
    if (!isRecord(next)) return undefined;
    field = next;
    fields = next.type === 'group' ? next.properties : undefined;
  }
  return field;
}

/**
 * Whether `path` is the declaration path of a field of the form whose type is not `group` and
 * whose `lang` is absent, `false` or `null` (CUVR-074).
 */
export function isReferenceTarget(properties: Record<string, unknown>, path: string): boolean {
  const field = declaredField(properties, path.split('.'));
  if (field === undefined || field.type === 'group') return false;
  return field.lang === undefined || field.lang === false || field.lang === null;
}

/** Whether a value is an id (CUVR-072). */
function isId(value: unknown): value is ReferenceId {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (typeof value !== 'string') return false;
  const text = canonicalText(value);
  return text !== undefined && trim(text) !== '';
}

/** The values a field has in its data `value`: each row of a repeated field, or the value itself. */
function valuesOf(field: Record<string, unknown>, value: unknown): unknown[] {
  if (!isMultipleField(field)) return [value];
  return isRecord(value) ? Object.values(value) : [];
}

/**
 * The ids of the declaration path `path` in `data` (CUVR-072), in data order. The path is followed
 * from the root; data of another shape at a step and a missing value hold no ids.
 */
export function referenceIds(properties: Record<string, unknown>, data: Record<string, unknown>, path: string): ReferenceId[] {
  const segments = path.split('.');
  const ids: ReferenceId[] = [];
  const walk = (fields: unknown, value: unknown, index: number): void => {
    const name = segments[index];
    if (name === undefined || !isRecord(fields) || !isRecord(value)) return;
    const field = fields[name];
    if (!isRecord(field) || !Object.prototype.hasOwnProperty.call(value, name)) return;
    for (const item of valuesOf(field, value[name])) {
      if (index === segments.length - 1) {
        if (isId(item)) ids.push(item);
      } else {
        walk(field.properties, item, index + 1);
      }
    }
  };
  walk(properties, data, 0);
  return ids;
}
