/**
 * Whitespace and trimming (validation-rules.md, "Values").
 *
 * Whitespace is exactly the code points with the Unicode `White_Space` property.
 * U+0000, U+180E, U+200B and U+FEFF are not whitespace, so the JavaScript notion
 * (`String.prototype.trim`, `\s`) is never used for values.
 */

import { WHITE_SPACE } from '../unicode/properties';

function pairs(flat: readonly number[]): Array<readonly [number, number]> {
  const result: Array<readonly [number, number]> = [];
  for (let index = 0; index < flat.length; index += 2) result.push([flat[index], flat[index + 1]]);
  return result;
}

/** The White_Space code points as inclusive ranges (from the embedded Unicode data). */
export const WHITESPACE_RANGES: ReadonlyArray<readonly [number, number]> = pairs(WHITE_SPACE);

/** Whether a code point is whitespace. */
export function isWhitespace(codePoint: number): boolean {
  for (const [first, last] of WHITESPACE_RANGES) {
    if (codePoint >= first && codePoint <= last) return true;
  }
  return false;
}

/** Remove leading and trailing whitespace and nothing else. */
export function trim(text: string): string {
  // Every White_Space code point is in the BMP and not a surrogate, so a
  // UTF-16 unit scan is exact (properties.unit.test.ts proves it on the data).
  let start = 0;
  let end = text.length;
  while (start < end && isWhitespace(text.charCodeAt(start))) start++;
  while (end > start && isWhitespace(text.charCodeAt(end - 1))) end--;
  return text.slice(start, end);
}
