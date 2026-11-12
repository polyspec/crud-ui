/**
 * Numbers (validation-rules.md, "Values" → "Numbers").
 *
 * A value is numeric when it is a finite number, or a string that after trimming
 * is numeric text (the HTML valid floating-point number) whose value is finite.
 * Booleans, `null`, arrays and objects are not numeric.
 */

import { canonicalText } from './canonical';
import { trim } from './whitespace';

/** The HTML valid floating-point number. */
const NUMERIC_TEXT = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/;

/** The value of a numeric value (the nearest double), or `undefined` when it is not numeric. */
export function numericValue(value: unknown): number | undefined {
  return typeof value === 'string' ? numericValueAsWritten(trim(value)) : numericValueAsWritten(value);
}

/**
 * The value of a finite number or of a string that is numeric text as written
 * (without trimming), or `undefined`. Membership reads its members this way.
 */
export function numericValueAsWritten(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const text = value;
  if (!NUMERIC_TEXT.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

/** Whether a parameter is a finite number. */
export function isFiniteNumber(param: unknown): param is number {
  return typeof param === 'number' && Number.isFinite(param);
}

/** Whether a parameter is a `range` pair `[minimum, maximum]` of finite numbers with minimum ≤ maximum. */
export function isNumberRange(range: unknown): range is [number, number] {
  return (
    Array.isArray(range) &&
    range.length === 2 &&
    isFiniteNumber(range[0]) &&
    isFiniteNumber(range[1]) &&
    range[0] <= range[1]
  );
}

/** Whether a parameter is a `step`: a finite number above 0. */
export function isStep(step: unknown): step is number {
  return isFiniteNumber(step) && step > 0;
}

/** A nonnegative decimal `significand × 10^exponent` read from a canonical text. */
function decimal(text: string): { significand: bigint; exponent: number } {
  const [mantissa, power = '0'] = text.split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  return { significand: BigInt(whole + fraction), exponent: Number(power) - fraction.length };
}

/**
 * Whether a finite number is an integer multiple of a positive finite step,
 * counted from 0. Both are read exactly as the decimal numbers their canonical
 * texts write, without a tolerance.
 */
export function isMultiple(value: number, step: number): boolean {
  const valueText = canonicalText(Math.abs(value));
  const stepText = canonicalText(step);
  if (valueText === undefined || stepText === undefined) throw new RangeError('isMultiple reads finite numbers');
  const v = decimal(valueText);
  const s = decimal(stepText);
  const base = Math.min(v.exponent, s.exponent);
  const scaledValue = v.significand * 10n ** BigInt(v.exponent - base);
  const scaledStep = s.significand * 10n ** BigInt(s.exponent - base);
  return scaledValue % scaledStep === 0n;
}

/** Whether a value passes `digits`: a string (trimmed) or a number whose canonical text is ASCII digits. */
export function isDigits(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const text = typeof value === 'string' ? trim(value) : canonicalText(value);
  return text !== undefined && /^[0-9]+$/.test(text);
}

/**
 * The count of a value for `mincount` and `maxcount`: the elements of an array,
 * the keys of an object, 0 for a missing value, `null` and a blank string, and 1
 * for any other scalar.
 */
export function countOf(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value === undefined || value === null) return 0;
  if (typeof value === 'object') return Object.keys(value).length;
  if (typeof value === 'string' && trim(value) === '') return 0;
  return 1;
}

/** A message with every `{i}` replaced by the canonical text of parameter i. */
export function formatMessage(template: string, ...params: unknown[]): string {
  return params.reduce<string>(
    (text, param, index) => text.split(`{${index}}`).join(canonicalText(param) ?? String(param)),
    template
  );
}
