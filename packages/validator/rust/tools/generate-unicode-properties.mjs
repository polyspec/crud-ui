#!/usr/bin/env node
/**
 * Writes src/validate/unicode/data.rs from contracts/unicode-properties.json.
 * The crate test `embedded_data_matches_the_contract` fails when the two differ.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CRATE = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(CRATE, '../../../contracts/unicode-properties.json'), 'utf8'));
const hex = value => `0x${value.toString(16).toUpperCase()}`;
const ranges = list => `&[${list.map(([start, end]) => `(${hex(start)}, ${hex(end)})`).join(', ')}]`;
const table = map => Object.entries(map).map(([name, list]) => `    (${JSON.stringify(name)}, ${ranges(list)}),\n`).join('');

writeFileSync(join(CRATE, 'src/validate/unicode/data.rs'), `//! Generated from \`contracts/unicode-properties.json\` by
//! \`node tools/generate-unicode-properties.mjs\` (run in \`packages/validator/rust\`); do not edit.
//!
//! Unicode ${contract.unicodeVersion} data as inclusive code-point ranges.

use super::Ranges;

/// The Unicode version of the data.
#[cfg(test)]
pub(crate) const UNICODE_VERSION: &str = ${JSON.stringify(contract.unicodeVersion)};

/// Code points with the \`White_Space\` property.
#[rustfmt::skip]
pub(crate) const WHITE_SPACE: Ranges = ${ranges(contract.whiteSpace)};

/// General categories a pattern may name, in contract order.
#[rustfmt::skip]
pub(crate) const GENERAL_CATEGORIES: &[(&str, Ranges)] = &[
${table(contract.generalCategories)}];

/// Scripts (the \`Script\` property) a pattern may name, in contract order.
#[rustfmt::skip]
pub(crate) const SCRIPTS: &[(&str, Ranges)] = &[
${table(contract.scripts)}];
`);
