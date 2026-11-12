/**
 * Value definitions (validation-rules.md, "Values").
 */

import { describe, test, expect } from 'vitest';
import {
  canonicalText, codePointLength, countOf, formatMessage, isDigits, isEmptyValue, isMember, isMultiple, numericValue,
  readMembers, trim,
} from './index';

describe('values', () => {
  test('trimming removes White_Space only', () => {
    expect(trim('\u0085\u3000 a\u00a0\ufeff\u2029')).toBe('a\u00a0\ufeff');
    expect(trim('\u200b\u180e')).toBe('\u200b\u180e');
  });
  test('emptiness', () => {
    expect([undefined, null, '', '\u2000', [], {}].every(isEmptyValue)).toBe(true);
    expect([0, false, '\u0000', '\ufeff', [null], { a: undefined }].some(isEmptyValue)).toBe(false);
  });
  test('canonical text', () => {
    expect([true, false, -0, 1e21, 1e-7, 0.000001, 100].map(canonicalText)).toEqual(['1', '0', '0', '1e+21', '1e-7', '0.000001', '100']);
    expect([NaN, Infinity, [], {}, null].map(canonicalText)).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
  test('length counts code points of the canonical text', () => {
    expect([' \u{1f600} ', 1.5, true, ['a'], { a: 1 }].map(codePointLength)).toEqual([3, 3, 1, undefined, undefined]);
  });
  test('membership', () => {
    // '+1.' is a string member that is not numeric text: only its own text matches it.
    const members = readMembers('+1., .5 ,x');
    if ('error' in members) throw new Error(members.error);
    expect(['1', 1, '+1.', '0.50', 0.5, '5e-1', ' x ', true, 'X', ['x', 0.5], ['x', 1], ['x', null]].map((value) => isMember(value, members.members))).toEqual([
      false, false, true, true, true, true, true, false, false, true, false, true,
    ]);
    const numbers = readMembers([1, 'x']);
    if ('error' in numbers) throw new Error(numbers.error);
    expect(['1', ' 1e0 ', '1.0', true, '+1', '1.', '0x1'].map((value) => isMember(value, numbers.members))).toEqual([
      true, true, true, true, false, false, false,
    ]);
    const padded = readMembers([' 100']);
    if ('error' in padded) throw new Error(padded.error);
    expect([100, '100', ' 100'].map((value) => isMember(value, padded.members))).toEqual([false, false, false]);
    expect([['x', ' '], [undefined], [[], {}], [['x']], [{ a: 'x' }]].map((value) => isMember(value, members.members))).toEqual([
      true, true, true, false, false,
    ]);
    expect(readMembers([null, ' '])).toEqual({ error: 'Invalid in parameter: members must be strings, numbers or booleans' });
    expect(readMembers([' ', null])).toEqual({ error: 'Invalid in parameter: members must not be empty' });
    expect(readMembers(['a', Infinity])).toEqual({ error: 'Invalid in parameter: members must be strings, numbers or booleans' });
    expect(readMembers({ ' ': 'blank' })).toEqual({ error: 'Invalid in parameter: members must not be empty' });
    for (const empty of [[], {}]) {
      const none = readMembers(empty);
      if ('error' in none) throw new Error(none.error);
      expect(['a', '0', 0, 1.5, true, false, ['a']].map((value) => isMember(value, none.members))).toEqual([
        false, false, false, false, false, false, false,
      ]);
    }
  });
  test('numeric text is the HTML valid floating-point number', () => {
    expect(['12', '-.5e+2', '1E-3', '\u3000 12\t', '1e-400', 0, -0.5].map(numericValue)).toEqual([12, -50, 0.001, 12, 0, 0, -0.5]);
    expect(['+1', '1.', '0x10', 'Infinity', 'NaN', '1e', 'e5', '--1', '1e999', '1_0', '\u0661', true, null, ['1'], {}, Infinity]
      .map(numericValue)).toEqual(Array(16).fill(undefined));
  });
  test('multiples are exact on the canonical decimal texts', () => {
    expect([[0.3, 0.1], [0.30000000000000004, 0.1], [0, 0.1], [-0.6, 0.1], [1e21, 0.1], [2e-7, 0.1], [4e-7, 2e-7], [3e-7, 2e-7],
      [1.5e21, 1e20], [1.05e21, 1e20], [1.75, 0.25], [1.8, 0.25], [9007199254740992, 3], [Number.MAX_VALUE, 5e-324]]
      .map(([value, step]) => isMultiple(value, step))).toEqual([
      true, false, true, true, true, false, true, false, true, false, true, false, false, true,
    ]);
  });
  test('digits, counts and messages', () => {
    expect([' 007 ', 42, 0, -0, '-1', 1.5, 1e21, true, '\u0661', [1]].map(isDigits)).toEqual([
      true, true, true, true, false, false, false, false, false, false,
    ]);
    expect([undefined, null, ' ', 'x', 0, false, [], [null], {}, { a: 1 }].map(countOf)).toEqual([0, 0, 0, 1, 1, 1, 0, 1, 0, 1]);
    expect(formatMessage('{0}..{1} ({0} to {1})', 1e21, 0.5)).toBe('1e+21..0.5 (1e+21 to 0.5)');
  });
});
