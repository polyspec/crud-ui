#!/usr/bin/env node
/**
 * Writes src/unicode/properties.ts from contracts/unicode-properties.json.
 *
 *   node packages/validator/ts/scripts/generate-unicode-properties.mjs
 *
 * The prebuild script of packages/validator/ts runs it before every build; the output is untracked (P34).
 *
 * Ranges are written as flat [start, end, start, end, …] lists of inclusive
 * code points. src/unicode/properties.unit.test.ts fails when the written data
 * differs from the contract.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(resolve(here, '../../../../contracts/unicode-properties.json'), 'utf8'));
const target = resolve(here, '../src/unicode/properties.ts');

/** A flat list, wrapped so no line grows unbounded. */
function flat(ranges, indent) {
  const numbers = ranges.flat();
  const lines = [];
  for (let i = 0; i < numbers.length; i += 16) lines.push(indent + '  ' + numbers.slice(i, i + 16).join(', ') + ',');
  return `[\n${lines.join('\n')}\n${indent}]`;
}

function table(map) {
  return Object.entries(map)
    .map(([name, ranges]) => `  ${JSON.stringify(name)}: ${flat(ranges, '  ')},`)
    .join('\n');
}

const text = `/**
 * Unicode ${contract.unicodeVersion} data of the CRUDUI pattern language and value definitions.
 *
 * Generated from contracts/unicode-properties.json by
 * \`node packages/validator/ts/scripts/generate-unicode-properties.mjs\`. Do not edit;
 * properties.unit.test.ts fails when this data differs from the contract.
 *
 * Every list is flat inclusive ranges: [start, end, start, end, …].
 */

/** Unicode version of the data. */
export const UNICODE_VERSION = ${JSON.stringify(contract.unicodeVersion)};

/** The White_Space property. */
export const WHITE_SPACE: readonly number[] = ${flat(contract.whiteSpace, '')};

/** The general categories a pattern may name, including the one-letter unions. */
export const GENERAL_CATEGORIES: Readonly<Record<string, readonly number[]>> = {
${table(contract.generalCategories)}
};

/** The scripts (Script property) a pattern may name. */
export const SCRIPTS: Readonly<Record<string, readonly number[]>> = {
${table(contract.scripts)}
};
`;
writeFileSync(target, text);
