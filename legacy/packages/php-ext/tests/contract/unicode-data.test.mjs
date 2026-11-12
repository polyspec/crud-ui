import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { contractPath } from '../../tools/generate-unicode-data.mjs';
import { cString, compileAndRunEngineFixture, fixtureProgram, ENGINE_TEST_BUDGET } from '../engine/support.mjs';

/*
 * The Unicode tables of the extension (unicode_data.c and the White_Space table of whitespace.c) equal the
 * contract contracts/unicode-properties.json (CUVR-018). The program compares the embedded tables with the
 * contract; the test runs it under node, because the engine is C and its tables are not reachable from PHP.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const unicode = JSON.parse(readFileSync(contractPath, 'utf8'));

const rangeList = ranges => `{${ranges.map(([start, end]) => `{0x${start.toString(16)}, 0x${end.toString(16)}}`).join(', ')}}`;
const propertyRows = table => Object.entries(table).map(([name, ranges]) =>
  `  {${cString(name)}, (const ps_code_range[])${rangeList(ranges)}, ${ranges.length}},`);

function sourceForUnicodeData() {
  const declarations = [
    '/* The contract, independent of the generated source. */',
    `static const ps_code_range contract_white_space[] = ${rangeList(unicode.whiteSpace)};`,
    'static const ps_unicode_property contract_categories[] = {',
    ...propertyRows(unicode.generalCategories),
    '};',
    'static const ps_unicode_property contract_scripts[] = {',
    ...propertyRows(unicode.scripts),
    '};',
    '',
    'static bool same_ranges(const ps_code_range *left, size_t left_count, const ps_code_range *right, size_t right_count)',
    '{',
    '  if (left_count != right_count) return false;',
    '  for (size_t i = 0; i < left_count; ++i)',
    '    if (left[i].start != right[i].start || left[i].end != right[i].end) return false;',
    '  return true;',
    '}',
    '',
    'static int failures;',
    'static void failure(const char *label, ps_text text)',
    '{ fputs(label, stderr); fwrite(text.bytes, 1, text.length > 200 ? 200 : text.length, stderr); fputc(10, stderr); failures++; }',
    '',
  ];
  const lines = [
    '  /* The embedded Unicode data is the contract. */',
    `  if (strcmp(ps_unicode_version, ${cString(unicode.unicodeVersion)})) failure("Unicode version differs", PS_TEXT(""));`,
    '  if (!same_ranges(ps_white_space, ps_white_space_count, contract_white_space, sizeof(contract_white_space) / sizeof(contract_white_space[0])))',
    '    failure("White_Space differs from the contract", PS_TEXT(""));',
    `  if (ps_general_categories_count != ${Object.keys(unicode.generalCategories).length} || ps_scripts_count != ${Object.keys(unicode.scripts).length})`,
    '    failure("property count differs from the contract", PS_TEXT(""));',
    '  for (size_t i = 0; i < sizeof(contract_categories) / sizeof(contract_categories[0]); ++i) {',
    '    const ps_unicode_property *found = ps_unicode_category(ps_fixed(contract_categories[i].name));',
    '    if (!found || !same_ranges(found->ranges, found->count, contract_categories[i].ranges, contract_categories[i].count))',
    '      failure("category differs from the contract: ", ps_fixed(contract_categories[i].name));',
    '  }',
    '  for (size_t i = 0; i < sizeof(contract_scripts) / sizeof(contract_scripts[0]); ++i) {',
    '    const ps_unicode_property *found = ps_unicode_script(ps_fixed(contract_scripts[i].name));',
    '    if (!found || !same_ranges(found->ranges, found->count, contract_scripts[i].ranges, contract_scripts[i].count))',
    '      failure("script differs from the contract: ", ps_fixed(contract_scripts[i].name));',
    '  }',
    '  if (ps_unicode_category(PS_TEXT("Cs")) || ps_unicode_category(PS_TEXT("Cn")) || ps_unicode_script(PS_TEXT("Klingon")))',
    '    failure("a property outside the data was found", PS_TEXT(""));',
    '',
    '  /* Whitespace is the White_Space table over every code point. */',
    '  for (uint32_t code = 0; code <= 0x10ffff; ++code) {',
    '    bool expected = false;',
    '    for (size_t i = 0; i < sizeof(contract_white_space) / sizeof(contract_white_space[0]); ++i)',
    '      expected = expected || (code >= contract_white_space[i].start && code <= contract_white_space[i].end);',
    '    if (ps_whitespace(code) != expected) {',
    '      char text[16]; snprintf(text, sizeof(text), "%X", (unsigned)code);',
    '      failure("whitespace differs: ", ps_fixed(text));',
    '    }',
    '  }',
    '  if (failures) { fprintf(stderr, "%d failures\\n", failures); return 1; }',
  ];
  return fixtureProgram(lines, declarations);
}

test('PHP extension Unicode data equals contracts/unicode-properties.json', { timeout: ENGINE_TEST_BUDGET }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-extension-unicode-'));
  try {
    await compileAndRunEngineFixture({
      signal: t.signal, root, directory, source: sourceForUnicodeData(), name: 'unicode-data',
      sources: ['value.c', 'number_text.c', 'whitespace.c', 'unicode_data.c', 'pattern_set.c'],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
