#!/usr/bin/env node
// Writes legacy/packages/php-ext/src/unicode_data.c from contracts/unicode-properties.json.
// Run from the repository root: node legacy/packages/php-ext/tools/generate-unicode-data.mjs
// make php-ext-tables runs it before every target that reads the sources of the extension; the output is untracked (P34).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const contractPath = path.join(root, 'contracts/unicode-properties.json');
export const outputPath = path.join(root, 'legacy/packages/php-ext/src/unicode_data.c');

const bytewise = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));

function rangeRows(ranges) {
  ranges.forEach(([start, end], index) => {
    if (!(Number.isInteger(start) && start <= end && end <= 0x10ffff
      && (index === 0 || start > ranges[index - 1][1] + 1))) {
      throw new Error(`Unicode ranges must be ascending, disjoint and separated: ${start}-${end}`);
    }
  });
  const rows = [];
  for (let index = 0; index < ranges.length; index += 6) {
    rows.push('    ' + ranges.slice(index, index + 6)
      .map(([start, end]) => `{0x${start.toString(16).toUpperCase()}, 0x${end.toString(16).toUpperCase()}}`)
      .join(', ') + ',');
  }
  return rows;
}

/* One property table: its range array and its entries in bytewise name order. */
function propertyTable(prefix, table) {
  const names = Object.keys(table).sort(bytewise);
  const lines = [`static const ps_code_range ${prefix}_ranges[] = {`];
  const entries = [];
  let offset = 0;
  for (const name of names) {
    lines.push(`    /* ${name} */`, ...rangeRows(table[name]));
    entries.push(`    {"${name}", ${prefix}_ranges + ${offset}, ${table[name].length}},`);
    offset += table[name].length;
  }
  lines.push('};', '', `const ps_unicode_property ps_${prefix}[] = {`, ...entries, '};', '',
    `const size_t ps_${prefix}_count = ${names.length};`, '');
  return lines;
}

export function unicodeDataSource(contract) {
  return [
    '/*',
    ' * Generated from contracts/unicode-properties.json (Unicode ' + contract.unicodeVersion + ') by',
    ' * node legacy/packages/php-ext/tools/generate-unicode-data.mjs; do not edit.',
    ' * Inclusive code-point ranges in ascending order; property entries in bytewise name order.',
    ' */',
    '#include "engine_internal.h"',
    '',
    `const char ps_unicode_version[] = "${contract.unicodeVersion}";`,
    '',
    'const ps_code_range ps_white_space[] = {',
    ...rangeRows(contract.whiteSpace),
    '};',
    '',
    `const size_t ps_white_space_count = ${contract.whiteSpace.length};`,
    '',
    ...propertyTable('general_categories', contract.generalCategories),
    ...propertyTable('scripts', contract.scripts),
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const contract = JSON.parse(await readFile(contractPath, 'utf8'));
  await writeFile(outputPath, unicodeDataSource(contract));
}
