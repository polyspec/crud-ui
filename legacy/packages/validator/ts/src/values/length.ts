/**
 * Length of a value (validation-rules.md, "Values").
 *
 * Length rules count the Unicode code points of a scalar's canonical text,
 * untrimmed. A value without canonical text (an array or object) has no length
 * and fails a length rule.
 */

import { codePointAt } from '../code-point';
import { canonicalText } from './canonical';

/** Largest length limit: 2^53 - 1. */
const MAX_LENGTH_LIMIT = Number.MAX_SAFE_INTEGER;

/** The code-point length of a value's canonical text, or `undefined` when it has none. */
export function codePointLength(value: unknown): number | undefined {
  const text = canonicalText(value);
  if (text === undefined) return undefined;
  let count = 0;
  for (let index = 0; index < text.length; index += codePointAt(text, index) > 0xffff ? 2 : 1) count++;
  return count;
}

/** Whether a parameter is a length limit: an integer from 0 to 2^53 - 1. */
export function isLengthLimit(limit: unknown): limit is number {
  return typeof limit === 'number' && Number.isInteger(limit) && limit >= 0 && limit <= MAX_LENGTH_LIMIT;
}

/** Whether a parameter is a `rangelength` pair `[minimum, maximum]` with minimum ≤ maximum. */
export function isLengthRange(range: unknown): range is [number, number] {
  return (
    Array.isArray(range) &&
    range.length === 2 &&
    isLengthLimit(range[0]) &&
    isLengthLimit(range[1]) &&
    range[0] <= range[1]
  );
}
