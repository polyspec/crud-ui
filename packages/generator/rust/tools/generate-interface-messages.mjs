#!/usr/bin/env node
/**
 * Writes src/interface_messages.rs from contracts/interface-messages.json.
 * The crate test `embedded_messages_match_the_contract` fails when the two differ.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CRATE = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(CRATE, '../../../contracts/interface-messages.json'), 'utf8'));

// Convert camelCase to snake_case
const toSnakeCase = str => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

// Generate the constant of one table of the contract for a language: `name` is the constant, `type` its struct
const generateTable = (table, lang, name, type) => {
    const fields = Object.entries(contract[table][lang])
        .map(([key, value]) => `    ${toSnakeCase(key)}: ${JSON.stringify(value)},`)
        .join('\n');

    return `pub const ${name}: ${type} = ${type} {\n${fields}\n};`;
};

// Generate a Messages constant for a language
const generateConstant = (lang, langCode) => generateTable('form', lang, langCode, 'Messages');

// Generate a ListMessages constant for a language
const generateListConstant = (lang, langCode) => generateTable('list', lang, `${langCode}_LIST`, 'ListMessages');

// Generate Rust source
const output = `//! Generated from \`contracts/interface-messages.json\` by
//! \`node tools/generate-interface-messages.mjs\` (run in \`packages/generator/rust\`); do not edit.
//!
//! Interface messages for CRUDUI as string constants.

use super::{ListMessages, Messages};

${generateConstant('ko', 'KO')}

${generateConstant('en', 'EN')}

${generateConstant('ja', 'JA')}

${generateConstant('zh', 'ZH')}

${generateListConstant('ko', 'KO')}

${generateListConstant('en', 'EN')}

${generateListConstant('ja', 'JA')}

${generateListConstant('zh', 'ZH')}
`;

writeFileSync(join(CRATE, 'src/messages/interface_messages.rs'), output);
