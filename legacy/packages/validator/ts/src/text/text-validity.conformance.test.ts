/**
 * Input text helpers of the JavaScript validator: unit cases for the text helpers of this folder, and the
 * loader check of a custom document. The shared validation cases of legacy/tests/fixtures/text-validity are registered by the
 * unit files text-validity-validate, text-validity-validate-list, text-validity-validate-detail and
 * text-validity-value-graphs, which read them by their case names.
 */

import { describe, expect, test } from 'vitest';
import { validate } from '@polyspec/crudui-validator';
import { MemoryLoader } from '../compose/index';
import { compareCodePoints, isScalarText, valueFailure } from './index';
import { expectOutcome } from '../../../../../tests/fixtures/text-validity/cases.mts';

describe('input text helpers', () => {
  test('unpaired surrogates are invalid and pairs are valid', () => {
    expect(['', 'a', '😀', '', '￿'].every(isScalarText)).toBe(true);
    expect(['\ud800', 'a\udc00', '\udc00\ud800', '\ud800a', '\ud83d\ud83d'].some(isScalarText)).toBe(false);
  });

  test('code point order places supplementary characters after U+FFFF', () => {
    expect(['😀', '￿', '', 'z', ''].sort(compareCodePoints))
      .toStrictEqual(['', 'z', '', '￿', '😀']);
    expect(compareCodePoints('ab', 'a')).toBeGreaterThan(0);
  });

  test('only plain objects and arrays are searched', () => {
    class Box { value = '\ud800'; }
    expect(valueFailure({ box: new Box(), list: [1, null, true] })).toBeUndefined();
    expect(valueFailure(Object.assign(Object.create(null), { a: ['\udc00'] }))).toStrictEqual({ text: ['a', '0'] });
  });

  test('a value is walked as the tree it denotes', () => {
    const cyclic: Record<string, unknown> = { a: '\ud800' };
    cyclic.self = cyclic;
    const shared = { b: '\udc00' };
    expect(valueFailure(cyclic)).toStrictEqual({ text: ['a'] });
    expect(valueFailure({ y: shared, z: [shared] })).toStrictEqual({ text: ['y', 'b'] });
    const list: unknown[] = [];
    list.push(list);
    expect(valueFailure(list)).toStrictEqual({ limit: true });
    // A class instance is one node: its members are not walked.
    class Box { items = Array.from({ length: 2_000_000 }, () => 'x'); }
    expect(valueFailure([new Box()])).toBeUndefined();
  });

  test('a custom loader document is checked when it is loaded', () => {
    const loader = new MemoryLoader({ 'base.yml': { properties: { x: { type: 'text', label: '\ud800' } } } });
    const spec = { type: 'group', properties: { $ref: 'base.yml' } };
    expectOutcome(() => validate(spec, {}, { loader }), {
      code: 'INVALID_TEXT', message: 'Text must be Unicode scalar values', at: 'base.yml.properties.x.label',
    });
    // A loader replaces the files, which are then not read.
    expectOutcome(() => validate({ type: 'group', properties: {} }, {}, { loader, files: { '\ud800': {} } }),
      { valid: true, errors: [], hidden: [] });
  });
});
