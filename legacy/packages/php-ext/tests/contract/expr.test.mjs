import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { cText, EngineFixtureSource, caseProgramStart, caseProgramEnd, caseReport, caseResults, recordCases, fixtureProgram, compileAndRunEngineFixture, ENGINE_TEST_BUDGET } from '../engine/support.mjs';

/*
 * The expression suite of legacy/tests/fixtures/expr: the C engine of the extension evaluates each case in one
 * program, and each case of the suite is a test of its own that reads the result the program reports for it.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixtures = JSON.parse(readFileSync(
  path.join(root, 'legacy/tests/fixtures/expr/cases.json'), 'utf8'));

function sourceForFixtures() {
  const builder = new EngineFixtureSource();
  const { lines } = builder;
  let caseIndex = 0;
  lines.push(...caseProgramStart);
  for (const [fixtureIndex, fixture] of fixtures.entries()) {
    if (fixture.error) {
      // The engine reports no message: a rejected expression is one that does not parse.
      lines.push('  {', `  /* ${fixture.name} */`, '  int ok = 1;');
      const data = builder.emit({});
      lines.push('  bool parsed_value = true, parsed_truth = true;');
      lines.push(`  ps_value *actual = ps_expression_value(${cText(fixture.expr)}, ${data}, NULL, NULL, 0, &parsed_value);`);
      lines.push(`  ps_expression_truth(${cText(fixture.expr)}, ${data}, NULL, NULL, 0, &parsed_truth);`);
      lines.push('  if (parsed_value || parsed_truth || actual) {');
      lines.push(`    ok = 0; print_text("expression parsed: ", ${cText(fixture.name)});`);
      lines.push('  }');
      lines.push(`  ps_value_free(actual); ps_value_free(${data});`);
      lines.push(...caseReport(fixtureIndex + 1));
      lines.push('  }');
      continue;
    }
    for (const example of fixture.cases) {
      caseIndex += 1;
      lines.push('  {', `  /* ${fixture.name} */`, '  int ok = 1;');
      const data = builder.emit(example.data);
      const expected = builder.emit(example.value);
      const pathItems = example.currentPath ?? [];
      const currentPath = `path${caseIndex}`;
      const rowKeys = `rows${caseIndex}`;
      if (pathItems.length) {
        lines.push(`  const ps_text ${currentPath}[] = {${pathItems.map(cText).join(', ')}};`);
        lines.push(`  const bool ${rowKeys}[] = {${pathItems.map((_, index) => ((example.rowKeys ?? []).includes(index) ? 'true' : 'false')).join(', ')}};`);
      } else {
        lines.push(`  const ps_text *${currentPath} = NULL;`);
        lines.push(`  const bool *${rowKeys} = NULL;`);
      }
      lines.push('  bool parsed_value = false;');
      lines.push(`  ps_value *actual = ps_expression_value(${cText(fixture.expr)}, ${data}, ${currentPath}, ${rowKeys}, ${pathItems.length}, &parsed_value);`);
      lines.push('  bool parsed_truth = false;');
      lines.push(`  bool truth = ps_expression_truth(${cText(fixture.expr)}, ${data}, ${currentPath}, ${rowKeys}, ${pathItems.length}, &parsed_truth);`);
      lines.push(`  if (!parsed_value || !parsed_truth || !actual || !ps_equal(actual, ${expected}) || truth != ${example.truthy}) {`);
      lines.push(`    ok = 0; print_text("expression result differs: ", ${cText(`${fixture.name} case ${caseIndex}`)});`);
      lines.push('  }');
      lines.push(`  ps_value_free(actual); ps_value_free(${expected}); ps_value_free(${data});`);
      // Every example of an entry reports under the entry, which passes only when all do.
      lines.push(...caseReport(fixtureIndex + 1));
      lines.push('  }');
    }
  }
  lines.push(...caseProgramEnd);
  return fixtureProgram(lines);
}

/*
 * Compile and run the program once for all the cases. A program that reports a failing case ends
 * with a non-zero status, so the status is kept with the reports and each case reads its own report.
 */
let evaluation;
function evaluate() {
  evaluation ??= (async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-expression-'));
    let output = '';
    let failure;
    try {
      await compileAndRunEngineFixture({
        root, directory, source: sourceForFixtures(), name: 'expression-fixtures',
        sources: ['value.c', 'number_text.c', 'value_path.c', 'expression.c', 'canonical.c'],
        onOutput: stdout => { output = stdout; },
      });
    } catch (error) {
      failure = error;
    } finally {
      recordCases(fixtures.map(fixture => ({
        features: ['validate'], fixture: 'legacy/tests/fixtures/expr/cases.json', name: fixture.name,
      })), output);
      await rm(directory, { recursive: true, force: true });
    }
    return { results: caseResults(output), failure };
  })();
  return evaluation;
}

fixtures.forEach((fixture, index) => {
  test(fixture.name, { timeout: ENGINE_TEST_BUDGET }, async () => {
    const { results, failure } = await evaluate();
    if (results.get(index + 1) === true) return;
    assert.fail(results.has(index + 1)
      ? `the C engine differs from the expectation of ${fixture.name}`
      : `the C engine reported no result for ${fixture.name}: ${failure?.message ?? 'no failure'}`);
  });
});
