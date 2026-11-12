/**
 * CRUDUI pattern language: recognizer offsets, sets and the linear-time matcher
 * beyond the shared cases (validation-rules.md, "Patterns" and "Parameter errors").
 */

import { describe, test, expect } from 'vitest';
import { compilePattern, recognizePattern, PatternSyntaxError } from './index';
import { CodePointSet, ANY, SPACE, propertySet } from './sets';
import { GENERAL_CATEGORIES, SCRIPTS } from '../unicode/properties';

function failure(pattern: string): string {
  try {
    recognizePattern(pattern);
  } catch (error) {
    if (error instanceof PatternSyntaxError) return `${error.reason} at ${error.offset}`;
    throw error;
  }
  return 'accepted';
}

const matches = (pattern: string, text: string) => compilePattern(pattern).test(text);

describe('sets', () => {
  test('union merges overlapping and adjacent ranges', () => {
    expect(Array.from(CodePointSet.of([5, 9, 1, 3], [4, 4, 20, 30, 25, 26]).ranges)).toEqual([1, 9, 20, 30]);
  });
  test('complement covers 0..U+10FFFF', () => {
    expect(Array.from(CodePointSet.of([0, 0, 0x10ffff, 0x10ffff]).complement().ranges)).toEqual([1, 0x10fffe]);
    expect(Array.from(CodePointSet.of([]).complement().ranges)).toEqual([0, 0x10ffff]);
    expect(Array.from(ANY.ranges)).toEqual([0, 9, 11, 0x10ffff]);
  });
  test('binary search membership', () => {
    const set = CodePointSet.of([10, 20, 30, 40, 50, 50]);
    expect([9, 10, 20, 21, 29, 35, 50, 51].map((c) => set.has(c))).toEqual([false, true, true, false, false, true, true, false]);
    expect(SPACE.has(0xfeff)).toBe(false);
    expect(SPACE.has(0x85)).toBe(true);
  });
  test('every category and script builds from the embedded data', () => {
    for (const name of Object.keys(GENERAL_CATEGORIES)) expect(propertySet(name, false).ranges.length).toBeGreaterThan(0);
    for (const name of Object.keys(SCRIPTS)) expect(propertySet(name, true).ranges.length).toBeGreaterThan(0);
  });
});

describe('recognizer — first invalid construct and offset', () => {
  test.each([
    ['\\P{Script=Klingon}', 'invalid property at 0'],
    ['\\p{Script=Latin', 'invalid property at 0'],
    ['\\p{sc=Latin}', 'invalid property at 0'],
    ['\\p{Cs}', 'invalid property at 0'],
    ['\\u{}', 'invalid escape at 0'],
    ['\\u{0000041}', 'invalid escape at 0'],
    ['a\\', 'invalid escape at 1'],
    ['\\cA', 'invalid escape at 0'],
    ['\\0', 'invalid escape at 0'],
    ['[a\\q]', 'invalid escape at 2'],
    ['a\ud800', 'unexpected character at 1'],
    ['[\udc00]', 'unexpected character at 1'],
    ['a}', 'unexpected character at 1'],
    ['(a$)', 'unexpected character at 2'],
    ['^^', 'unexpected character at 1'],
    ['(a$', 'unterminated group at 3'],
    ['[', 'unterminated class at 1'],
    ['[a-', 'unterminated class at 3'],
    ['[^]', 'invalid class at 0'],
    ['[\\W]', 'invalid class at 0'],
    ['[\\d-\\D]', 'invalid class at 0'],
    ['[\\d-\\q]', 'invalid escape at 4'],
    ['[\\p{L}-z]', 'invalid range at 1'],
    ['[a--]', 'invalid range at 1'],
    ['(?', 'unsupported construct at 0'],
    ['(?P<n>a)', 'unsupported construct at 0'],
    ['(?<', 'invalid group name at 0'],
    ['(?<n', 'invalid group name at 0'],
    ['^*', 'invalid quantifier at 1'],
    ['a|*', 'invalid quantifier at 2'],
    ['a*??', 'invalid quantifier at 3'],
    ['a{1,1001}', 'invalid quantifier at 1'],
    ['a{1001,}', 'invalid quantifier at 1'],
    ['a{99999999999999999999}', 'invalid quantifier at 1'],
    ['(a{600}){2,}', 'pattern too large at 0'],
    ['a{999,}', 'accepted'],
    ['a{1000,}', 'pattern too large at 0'],
    ['(a+){500}', 'accepted'],
    ['(a+){501}', 'pattern too large at 0'],
    ['(a{1000}){1000}[', 'unterminated class at 16'],
    ['('.repeat(100) + ')'.repeat(100), 'accepted'],
    ['('.repeat(101) + ')'.repeat(101), 'nesting too deep at 100'],
    ['()'.repeat(10) + '('.repeat(101), 'nesting too deep at 120'],
  ])('%s → %s', (pattern, expected) => {
    expect(failure(pattern)).toBe(expected);
  });

  test.each([
    '^', '$', '^$', 'a|', '()', '(a{1000}){0}', 'a{0001}', '(a){2}', '[-a]', '[a-]', '[!--]', '[.$^*a-a|]',
    '\\u{10FFFF}', '\\P{Script=Latin}', '\u{1F600}', 'a{1000}', '(?:a*){500}',
  ])('%s is in the language', (pattern) => {
    expect(failure(pattern)).toBe('accepted');
    expect(() => compilePattern(pattern)).not.toThrow();
  });
});

describe('matcher', () => {
  test('the whole text matches; alternation is grouped; anchors add nothing', () => {
    expect(['a', 'b', 'ab', 'a\n', ''].map((text) => matches('a|b$', text))).toEqual([true, true, false, false, false]);
    expect(['', 'x'].map((text) => matches('^', text))).toEqual([true, false]);
    expect(matches('a|', '')).toBe(true);
  });
  test('bounded and unbounded repetition, lazy as greedy', () => {
    expect(['', 'a', 'aa', 'aaa', 'aaaa'].map((text) => matches('a{1,3}', text))).toEqual([false, true, true, true, false]);
    expect(['a', 'aa', 'aaaaaa'].map((text) => matches('a{2,}?', text))).toEqual([false, true, true]);
    expect(['', 'ab', 'abab', 'aba'].map((text) => matches('(ab)*', text))).toEqual([true, true, true, false]);
    expect(matches('(a|)*b', 'aaab')).toBe(true);
  });
  test('zero-size repetition compiles to one state', () => {
    const matcher = compilePattern('((){1000}){1000}');
    expect(matcher.stateCount).toBeLessThan(5);
    expect(matcher.test('')).toBe(true);
    expect(matcher.test('a')).toBe(false);
    expect(compilePattern('(()*)+').test('')).toBe(true);
  });
  test('sets and complements', () => {
    expect(['1', '١', '_', 'é'].map((text) => matches('[\\d\\w]', text))).toEqual([true, false, true, false]);
    expect(['x', '\n', ' '].map((text) => matches('.', text))).toEqual([true, false, true]);
    expect(['A', 'a', '1'].map((text) => matches('[^\\p{Lu}\\d]', text))).toEqual([false, true, false]);
    expect(['한', 'a'].map((text) => matches('\\P{Script=Hangul}', text))).toEqual([false, true]);
    expect(matches('[\\]\\-\\\\]+', ']-\\')).toBe(true);
  });
  test('unassigned code points follow the Unicode 16.0 data, not the engine', () => {
    // U+0C5C is a letter in the engine's newer Unicode and unassigned (Cn, in C) in 16.0.
    expect(/\p{L}/u.test('\u0C5C')).toBe(true);
    expect(matches('\\p{C}', '\u0C5C')).toBe(true);
    expect(matches('\\p{L}', '\u0C5C')).toBe(false);
  });
  test('a JavaScript lone surrogate is one code point in C and in every complement', () => {
    expect(matches('.', '\ud800')).toBe(true);
    expect(matches('\\p{C}', '\udc00')).toBe(true);
    expect(matches('\\P{L}', '\ud800')).toBe(true);
    expect(matches('\\p{L}|\\p{Script=Latin}|\\p{Script=Common}', '\ud800')).toBe(false);
    expect(matches('..', '𐀀')).toBe(false);
  });
  test('matching reads each code point of the text once', () => {
    // A text whose code point reads are counted: a second read of a position throws, so a matcher
    // that went back over the text fails at once instead of taking exponential time.
    const counted = (text: string) => {
      const read = new Uint8Array(text.length);
      let reads = 0;
      const view = {
        length: text.length,
        codePointAt(index: number) {
          if (read[index]) throw new Error(`position ${index} was read twice`);
          read[index] = 1;
          reads++;
          return text.codePointAt(index);
        },
      };
      return { text: view, reads: () => reads };
    };
    for (const [pattern, text, expected] of [
      ['(?:.*a){12}c', 'a'.repeat(60), false],
      ['(?:.*a){12}c', 'a'.repeat(20000), false],
      ['\\p{L}{1000}', 'é'.repeat(1000), true],
      ['\\p{L}{1000}', '𐐀'.repeat(1000), true],
      ['(a|aa)*b', 'a'.repeat(50000), false],
    ] as const) {
      const input = counted(text);
      expect(compilePattern(pattern).test(input.text), pattern).toBe(expected);
      expect(input.reads(), pattern).toBe(Array.from(text).length);
    }
  });
});
