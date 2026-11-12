/**
 * The embedded interface messages equal their source, contracts/interface-messages.json: every
 * table, every language and every key, in the contract's order (CUMK-065).
 */

import { test, expect } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORM_MESSAGES, LIST_MESSAGES } from './interface-messages';

const contract: unknown = JSON.parse(
  fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../contracts/interface-messages.json'),
    'utf8'
  )
);
assert(contract !== null && typeof contract === 'object' && 'form' in contract && 'list' in contract,
  'contracts/interface-messages.json has the form and list tables');

test('src/interface-messages.ts equals contracts/interface-messages.json', () => {
  const embedded = { form: FORM_MESSAGES, list: LIST_MESSAGES };
  for (const name of ['form', 'list'] as const) {
    // JSON text compares the order of languages and keys too.
    expect(JSON.stringify(embedded[name]), `${name}: run node legacy/packages/generator/ts/scripts/generate-interface-messages.mjs`)
      .toBe(JSON.stringify(contract[name]));
  }
});
