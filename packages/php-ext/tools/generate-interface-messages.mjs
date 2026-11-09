#!/usr/bin/env node
// Writes packages/php-ext/src/interface_messages.c from contracts/interface-messages.json.
// Run from the repository root: node packages/php-ext/tools/generate-interface-messages.mjs
// make php-ext-tables runs it before every target that reads the sources of the extension; the output is untracked (P34).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const contractPath = path.join(root, 'contracts/interface-messages.json');
export const outputPath = path.join(root, 'packages/php-ext/src/interface_messages.c');

// Convert a UTF-8 string to a C string literal with hex escapes for non-ASCII bytes.
// After each hex escape, split the string if the next character is a hex digit to avoid ambiguity.
function cStringLiteral(value) {
  const bytes = Buffer.from(value, 'utf8');
  const parts = [];
  let current = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];

    if (byte >= 0x20 && byte <= 0x7E && byte !== 0x22 && byte !== 0x5C) {
      // ASCII printable (except " and \)
      current += String.fromCharCode(byte);
    } else if (byte === 0x22) {
      // Double quote
      current += '\\"';
    } else if (byte === 0x5C) {
      // Backslash
      current += '\\\\';
    } else {
      // Non-ASCII or control character: use hex escape
      const hex = byte.toString(16).padStart(2, '0');

      // Check if we need to split: the next byte should not be a hex digit
      const nextByte = i + 1 < bytes.length ? bytes[i + 1] : -1;
      const nextIsHexDigit = (nextByte >= 0x30 && nextByte <= 0x39) ||
                             (nextByte >= 0x41 && nextByte <= 0x46) ||
                             (nextByte >= 0x61 && nextByte <= 0x66);

      if (nextIsHexDigit && current) {
        // Close current string and start a new one
        parts.push(`"${current}"`);
        current = '';
      }

      current += `\\x${hex}`;

      if (nextIsHexDigit) {
        // Close this string and start a new one
        parts.push(`"${current}"`);
        current = '';
      }
    }
  }

  if (current) {
    parts.push(`"${current}"`);
  }

  return parts.length === 0 ? '""' : parts.join(' ');
}

/** The C field of a contract key: moveUp → move_up. */
/** Code unit order of two strings, the order of `Array.prototype.sort` without a comparator. */
const codeUnitOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const fieldName = key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

/** Each contract table, its C struct and the generated array of {language, messages}. */
export const TABLES = [
  { table: 'form', struct: 'ps_form_messages', entry: 'ps_language_messages', array: 'ps_interface_messages' },
  { table: 'list', struct: 'ps_list_messages', entry: 'ps_list_language_messages', array: 'ps_interface_list_messages' },
];

/** The fields of every table's struct, in declaration order, read from engine_internal.h. */
export async function structFields() {
  const header = await readFile(path.join(root, 'packages/php-ext/src/engine_internal.h'), 'utf8');
  const fields = {};
  for (const { struct } of TABLES) {
    const body = new RegExp(`typedef struct \\{([^}]*)\\} ${struct};`).exec(header)?.[1];
    if (!body) throw new Error(`engine_internal.h has no ${struct}`);
    fields[struct] = [...body.matchAll(/const char \*(\w+);/g)].map(match => match[1]);
  }
  return fields;
}

/**
 * The C source of the contract's tables. Every language holds exactly the fields of its struct,
 * each set by name, so a key the struct lacks or a field the contract lacks fails here instead
 * of shifting text into another field.
 */
export function interfaceMessagesSource(contract, fields) {
  const lines = [
    '/*',
    ' * Generated from contracts/interface-messages.json by',
    ' * node packages/php-ext/tools/generate-interface-messages.mjs; do not edit.',
    ' */',
    '#include "engine_internal.h"',
  ];
  for (const { table, struct, entry, array } of TABLES) {
    lines.push('', `const ${entry} ${array}[] = {`);
    for (const language of contract.languages) {
      const messages = contract[table][language];
      const keys = Object.keys(messages).map(fieldName);
      if (JSON.stringify([...keys].sort(codeUnitOrder)) !== JSON.stringify([...fields[struct]].sort(codeUnitOrder))) {
        throw new Error(`${table}.${language} keys ${keys.join(', ')} differ from ${struct} fields ${fields[struct].join(', ')}`);
      }
      lines.push(`    {"${language}", {`);
      for (const [key, text] of Object.entries(messages)) lines.push(`        .${fieldName(key)} = ${cStringLiteral(text)},`);
      lines.push('    }},');
    }
    lines.push('};', `const size_t ${array}_count = ${contract.languages.length};`);
  }
  lines.push('');
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const contract = JSON.parse(await readFile(contractPath, 'utf8'));
  await writeFile(outputPath, interfaceMessagesSource(contract, await structFields()));
}
