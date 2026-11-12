/**
 * Empty values (validation-rules.md, "Values").
 *
 * A missing value, `null`, a string that is empty after trimming, an empty array
 * and an empty object are empty. `0` and `false` are supplied values.
 */

import { trim } from './whitespace';

/** Whether a value is empty. */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return trim(value) === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
