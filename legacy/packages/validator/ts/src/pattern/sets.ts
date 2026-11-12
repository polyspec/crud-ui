/**
 * Code-point sets of the pattern matcher (validation-rules.md, "Patterns").
 *
 * A set is a sorted list of disjoint inclusive ranges built at compile time;
 * membership is a binary search. Sets are built from the embedded Unicode data
 * only, never from the JavaScript engine's Unicode tables.
 */

import { GENERAL_CATEGORIES, SCRIPTS, WHITE_SPACE } from '../unicode/properties';

/** Largest code point. */
const MAX_CODE_POINT = 0x10ffff;

/** An immutable set of code points. */
export class CodePointSet {
  /** Flat sorted disjoint inclusive ranges: [start, end, start, end, …]. */
  readonly ranges: Uint32Array;

  private constructor(ranges: Uint32Array) {
    this.ranges = ranges;
  }

  /** The union of flat inclusive ranges in any order, possibly overlapping. */
  static of(...lists: ReadonlyArray<readonly number[]>): CodePointSet {
    const pairs: Array<[number, number]> = [];
    for (const list of lists) {
      for (let index = 0; index < list.length; index += 2) pairs.push([list[index], list[index + 1]]);
    }
    pairs.sort((left, right) => left[0] - right[0]);
    const merged: number[] = [];
    for (const [start, end] of pairs) {
      const last = merged.length - 1;
      if (last > 0 && start <= merged[last] + 1) {
        merged[last] = Math.max(merged[last], end);
      } else {
        merged.push(start, end);
      }
    }
    return new CodePointSet(Uint32Array.from(merged));
  }

  /** The union of several sets. */
  static union(sets: readonly CodePointSet[]): CodePointSet {
    return CodePointSet.of(...sets.map((set) => Array.from(set.ranges)));
  }

  /** Every code point from 0 to U+10FFFF outside this set. */
  complement(): CodePointSet {
    const result: number[] = [];
    let next = 0;
    for (let index = 0; index < this.ranges.length; index += 2) {
      if (this.ranges[index] > next) result.push(next, this.ranges[index] - 1);
      next = this.ranges[index + 1] + 1;
    }
    if (next <= MAX_CODE_POINT) result.push(next, MAX_CODE_POINT);
    return new CodePointSet(Uint32Array.from(result));
  }

  /** Whether the set contains a code point. */
  has(codePoint: number): boolean {
    let low = 0;
    let high = this.ranges.length / 2 - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (codePoint < this.ranges[middle * 2]) {
        high = middle - 1;
      } else if (codePoint > this.ranges[middle * 2 + 1]) {
        low = middle + 1;
      } else {
        return true;
      }
    }
    return false;
  }
}

/** `\d`, `\w` and `\s`. */
export const DIGIT = CodePointSet.of([0x30, 0x39]);
export const WORD = CodePointSet.of([0x30, 0x39, 0x41, 0x5a, 0x61, 0x7a, 0x5f, 0x5f]);
export const SPACE = CodePointSet.of(WHITE_SPACE);
/** `.`: every code point except U+000A. */
export const ANY = CodePointSet.of([0x0a, 0x0a]).complement();

const categoryCache = new Map<string, CodePointSet>();
const scriptCache = new Map<string, CodePointSet>();

/** Whether a name is a general category a pattern may use. */
export function isGeneralCategory(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(GENERAL_CATEGORIES, name);
}

/** Whether a name is a script a pattern may use. */
export function isScript(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SCRIPTS, name);
}

/** The set of a general category or a script. */
export function propertySet(name: string, script: boolean): CodePointSet {
  const cache = script ? scriptCache : categoryCache;
  let set = cache.get(name);
  if (!set) {
    set = CodePointSet.of((script ? SCRIPTS : GENERAL_CATEGORIES)[name]);
    cache.set(name, set);
  }
  return set;
}
