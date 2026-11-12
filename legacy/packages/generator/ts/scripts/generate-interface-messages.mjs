#!/usr/bin/env node
/**
 * Writes src/interface-messages.ts from contracts/interface-messages.json.
 *
 *   node legacy/packages/generator/ts/scripts/generate-interface-messages.mjs
 *
 * The prebuild script of legacy/packages/generator/ts runs it before every build; the output is untracked (P34).
 *
 * Every table of the contract (form, list) is written with its four languages, keys in the
 * contract's order. src/interface-messages.test.ts fails when the written data differs from the
 * contract.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(resolve(here, '../../../../../contracts/interface-messages.json'), 'utf8'));
const target = resolve(here, '../src/interface-messages.ts');

/** The tables of the contract: every member whose value maps each language to its messages. */
const tables = Object.keys(contract).filter(name => contract[name] !== null && typeof contract[name] === 'object'
  && !Array.isArray(contract[name]) && contract.languages.every(language => language in contract[name]));

function languageTable(messages) {
  const lines = Object.entries(messages).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  return `{\n${lines.join('\n')}\n  }`;
}

function table(name) {
  const languages = contract.languages.map(language => `  ${language}: ${languageTable(contract[name][language])},`);
  return `/** The \`${name}\` messages by language. */\nexport const ${name.toUpperCase()}_MESSAGES = {\n${languages.join('\n')}\n} as const;\n`;
}

const text = `/**
 * CRUDUI interface text in every supported language.
 *
 * Generated from contracts/interface-messages.json by
 * \`node legacy/packages/generator/ts/scripts/generate-interface-messages.mjs\`. Do not edit;
 * interface-messages.test.ts fails when this data differs from the contract.
 */

${tables.map(table).join('\n')}`;

writeFileSync(target, text);
