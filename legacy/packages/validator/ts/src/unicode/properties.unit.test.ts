/**
 * The embedded Unicode data equals its source, contracts/unicode-properties.json,
 * and the whitespace definition uses exactly its White_Space ranges.
 */

import { test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERAL_CATEGORIES, SCRIPTS, UNICODE_VERSION, WHITE_SPACE } from './properties';
import { WHITESPACE_RANGES, isWhitespace } from '../values/whitespace';

interface Contract {
  unicodeVersion: string;
  whiteSpace: Array<[number, number]>;
  generalCategories: Record<string, unknown>;
  scripts: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The ranges `value` holds as pairs of numbers. */
function ranges(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) throw new TypeError('the White_Space ranges are no list');
  return value.map((range: unknown): [number, number] => {
    const pair: unknown[] = Array.isArray(range) ? range : [];
    if (pair.length !== 2) throw new TypeError('a White_Space range is no pair');
    const [first, last] = pair;
    if (typeof first !== 'number' || typeof last !== 'number') throw new TypeError('a White_Space range holds no numbers');
    return [first, last];
  });
}

/** contracts/unicode-properties.json, checked to hold the version, the White_Space ranges and the two tables. */
function readContract(file: string): Contract {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!isRecord(value) || typeof value.unicodeVersion !== 'string' || !isRecord(value.generalCategories) || !isRecord(value.scripts)) {
    throw new TypeError(`${file} holds no version and tables`);
  }
  return {
    unicodeVersion: value.unicodeVersion,
    whiteSpace: ranges(value.whiteSpace),
    generalCategories: value.generalCategories,
    scripts: value.scripts,
  };
}

const contract = readContract(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../contracts/unicode-properties.json')
);

const pairs = (flat: readonly number[]) => Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i], flat[2 * i + 1]]);
const table = (map: Readonly<Record<string, readonly number[]>>) =>
  Object.fromEntries(Object.entries(map).map(([name, flat]) => [name, pairs(flat)]));

// CUVR-018: the embedded data equals contracts/unicode-properties.json.
test('src/unicode/properties.ts equals contracts/unicode-properties.json', () => {
  expect(UNICODE_VERSION).toBe(contract.unicodeVersion);
  expect(pairs(WHITE_SPACE)).toStrictEqual(contract.whiteSpace);
  expect(table(GENERAL_CATEGORIES)).toStrictEqual(contract.generalCategories);
  expect(Object.keys(GENERAL_CATEGORIES)).toStrictEqual(Object.keys(contract.generalCategories));
  expect(table(SCRIPTS)).toStrictEqual(contract.scripts);
  expect(Object.keys(SCRIPTS)).toStrictEqual(Object.keys(contract.scripts));
});

test('whitespace is exactly the White_Space data, all in the BMP outside the surrogates', () => {
  expect(WHITESPACE_RANGES.map(([a, b]) => [a, b])).toStrictEqual(contract.whiteSpace);
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    const expected = contract.whiteSpace.some(([a, b]) => codePoint >= a && codePoint <= b);
    if (isWhitespace(codePoint) !== expected) throw new Error(`U+${codePoint.toString(16)}`);
    if (expected && (codePoint > 0xffff || (codePoint >= 0xd800 && codePoint <= 0xdfff))) {
      throw new Error(`whitespace U+${codePoint.toString(16)} is outside the BMP scan`);
    }
  }
});
