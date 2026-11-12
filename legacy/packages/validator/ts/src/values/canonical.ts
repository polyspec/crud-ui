/**
 * Canonical text of a scalar (validation-rules.md, "Values").
 *
 * A string is itself; `true` is `1` and `false` is `0`; a finite number is
 * written by ECMAScript `Number.prototype.toString` (negative zero is `0`).
 */

/** The canonical text of a scalar, or `undefined` for any other value. */
export function canonicalText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Number.prototype.toString already writes negative zero as "0".
    return value.toString();
  }
  return undefined;
}
