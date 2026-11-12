/**
 * The unique rule walks the values of a collection once per validation (validation-rules.md).
 * The checks count reads of the data, which do not depend on the load of the machine: a getter on
 * each value counts its reads and fails a read beyond the reads of the same value in a small
 * collection, so a check that walked the earlier values again for each value fails at once.
 */

import { describe, test, expect } from 'vitest';
import { validate } from '../validate/index';

const key = (index: number) => `__${String(index + 1).padStart(13, '0')}__`;

/**
 * Validate `count` distinct values whose reads are counted. `define` puts the getter of value
 * `index` on its holder; a read beyond `limit` reads of one value throws. Returns the most reads
 * of one value.
 */
function mostReads(
  count: number,
  limit: number,
  spec: Record<string, unknown>,
  data: (define: (holder: object, name: string, index: number) => void) => Record<string, unknown>,
): number {
  const reads = Array.from({ length: count }, () => 0);
  const define = (holder: object, name: string, index: number) => {
    Object.defineProperty(holder, name, {
      enumerable: true,
      get() {
        reads[index] = reads[index] + 1;
        if (reads[index] > limit) throw new Error(`value ${index} of ${count} was read ${reads[index]} times`);
        return `item-${index}`;
      },
    });
  };
  const result = validate(spec, data(define));
  expect(result.errors).toEqual([]);
  expect(result.valid).toBe(true);
  return reads.reduce((most, value) => Math.max(most, value), 0);
}

describe('unique rule reads', () => {
  test('a row of a repeated group is read as often among 10,000 rows as among 10', () => {
    const spec = {
      type: 'group',
      properties: {
        items: { type: 'group', multiple: true, properties: { code: { type: 'text', validate: { unique: true } } } },
      },
    };
    const rows = (count: number) => (define: (holder: object, name: string, index: number) => void) => {
      const items: Record<string, object> = {};
      for (let index = 0; index < count; index++) {
        const row = {};
        define(row, 'code', index);
        items[key(index)] = row;
      }
      return { items };
    };
    const small = mostReads(10, Infinity, spec, rows(10));
    expect(small).toBeGreaterThan(0);
    expect(mostReads(10000, small, spec, rows(10000))).toBe(small);
  });

  test('a value of a repeated field is read as often among 10,000 values as among 10', () => {
    const spec = { type: 'group', properties: { codes: { type: 'text', multiple: true, validate: { unique: true } } } };
    const values = (count: number) => (define: (holder: object, name: string, index: number) => void) => {
      const codes = {};
      for (let index = 0; index < count; index++) define(codes, key(index), index);
      return { codes };
    };
    const small = mostReads(10, Infinity, spec, values(10));
    expect(small).toBeGreaterThan(0);
    expect(mostReads(10000, small, spec, values(10000))).toBe(small);
  });
});

describe('unique rows belong to one validation', () => {
  test('a second validation of the same data object, changed, answers from its own rows', () => {
    const spec = {
      type: 'group',
      properties: {
        rows: {
          type: 'group',
          multiple: true,
          properties: { code: { type: 'text', validate: { unique: true } } },
        },
      },
    };
    const rows: Record<string, { code: string }> = {
      __0000000000001__: { code: 'x' },
      __0000000000002__: { code: 'x' },
    };
    const data = { rows };
    expect(validate(spec, data).valid).toBe(false);
    rows.__0000000000002__.code = 'y';
    expect(validate(spec, data).valid).toBe(true);
  });
});
