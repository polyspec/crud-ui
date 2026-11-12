import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { contractPath, fieldName, TABLES } from '../../tools/generate-interface-messages.mjs';
import { cString, compileAndRunEngineFixture, fixtureProgram, ENGINE_TEST_BUDGET } from '../engine/support.mjs';

/*
 * The interface messages that the extension embeds (interface_messages.c) equal contracts/interface-messages.json
 * (CUMK-065), in the form table and in the list table of every language. The program compares each field of each
 * language with the contract; the test runs it under node, because no PHP accessor returns the list messages.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

function sourceForInterfaceMessages() {
  const declarations = [
    'static int failures;',
    '/* A message of the embedded tables that differs from the contract; the label names the table, language and key. */',
    'static void check(const char *actual, const char *expected, const char *label)',
    '{ if (!actual || strcmp(actual, expected)) { fprintf(stderr, "interface message differs: %s\\n", label); failures++; } }',
    '',
  ];
  const lines = [];
  for (const { table, array } of TABLES) {
    const languages = contract.languages;
    lines.push(`  if (${array}_count != ${languages.length}) { fputs("${table} language count differs\\n", stderr); failures++; }`);
    languages.forEach((language, index) => {
      lines.push(`  if (strcmp(${array}[${index}].language, ${cString(language)})) { fputs("${table} language order differs\\n", stderr); failures++; }`);
      for (const [key, text] of Object.entries(contract[table][language])) {
        lines.push(`  check(${array}[${index}].messages.${fieldName(key)}, ${cString(text)}, ${cString(`${table} ${language} ${key}`)});`);
      }
    });
  }
  lines.push('  if (failures) { fprintf(stderr, "%d failures\\n", failures); return 1; }');
  return fixtureProgram(lines, declarations);
}

test('PHP extension form and list messages equal contracts/interface-messages.json', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-extension-messages-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForInterfaceMessages(), name: 'interface-messages',
      sources: ['interface_messages.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
