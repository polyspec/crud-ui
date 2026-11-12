/** A text as the code point reads see it: its UTF-16 length and its code points, as a string has them. */
export type CodePointText = Pick<string, 'length' | 'codePointAt'>;

/**
 * The code point of `text` at the UTF-16 index `index`, which the caller knows to lie inside `text`; a lone surrogate is
 * its own code point, as String.prototype.codePointAt reads it.
 */
export function codePointAt(text: CodePointText, index: number): number {
  const codePoint = text.codePointAt(index);
  if (codePoint === undefined) throw new RangeError(`No code point at ${index} of a text of length ${text.length}`);
  return codePoint;
}
