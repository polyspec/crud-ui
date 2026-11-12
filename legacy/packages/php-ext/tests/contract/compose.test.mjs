import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { cText, EngineFixtureSource, caseProgramStart, caseProgramEnd, caseReport, caseResults, recordCases, fixtureProgram, compileAndRunEngineFixture, ENGINE_TEST_BUDGET } from '../engine/support.mjs';

/*
 * The composition suite of legacy/tests/fixtures/compose: the C engine of the extension composes each case in
 * one program, and each case of the suite is a test of its own that reads the result the program reports for it.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const cases = JSON.parse(readFileSync(
  path.join(root, 'legacy/tests/fixtures/compose/cases.json'), 'utf8'));

function sourceForCases() {
  const builder = new EngineFixtureSource();
  const { lines } = builder;

  lines.push(...caseProgramStart);
  cases.forEach((fixture, index) => {
    lines.push('  {');
    lines.push(`  /* ${fixture.name} */`);
    lines.push('  int ok = 1;');
    const entry = builder.emit(fixture.input.entry);
    const files = builder.emit(fixture.input.files ?? {});
    lines.push('  ps_value *error = NULL;');
    const operation = fixture.input.kind === 'spec' ? 'ps_compose_spec' : 'ps_compose_properties';
    lines.push(`  ps_value *actual = ${operation}(${entry}, ${files}, ${cText(fixture.input.basepath ?? '')}, &error);`);
    if (fixture.expected) {
      const expected = builder.emit(fixture.expected);
      lines.push(`  if (!actual || error || !ps_equal(actual, ${expected})) { ok = 0; print_text("composed result differs: ", ${cText(fixture.name)}); }`);
      lines.push(`  ps_value_free(${expected});`);
    } else {
      lines.push(`  if (actual || !error || !text_is(ps_get(error, "code"), ${cText(fixture.expectError.code)})) { ok = 0; print_text("error differs: ", ${cText(fixture.name)}); }`);
    }
    lines.push(`  ps_value_free(actual); ps_value_free(error); ps_value_free(${entry}); ps_value_free(${files});`);
    lines.push(...caseReport(index + 1));
    lines.push('  }');
  });
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
    const directory = await mkdtemp(path.join(os.tmpdir(), 'crudui-c-compose-'));
    let output = '';
    let failure;
    try {
      await compileAndRunEngineFixture({
        root, directory, source: sourceForCases(), name: 'compose-fixtures',
        sources: ['value.c', 'number_text.c', 'engine_error.c', 'compose.c'],
        onOutput: stdout => { output = stdout; },
      });
    } catch (error) {
      failure = error;
    } finally {
      recordCases(cases.map(fixture => ({
        features: ['compileForm'], fixture: 'legacy/tests/fixtures/compose/cases.json', name: fixture.name,
      })), output);
      await rm(directory, { recursive: true, force: true });
    }
    return { results: caseResults(output), failure };
  })();
  return evaluation;
}

cases.forEach((fixture, index) => {
  test(fixture.name, { timeout: ENGINE_TEST_BUDGET }, async () => {
    const { results, failure } = await evaluate();
    if (results.get(index + 1) === true) return;
    assert.fail(results.has(index + 1)
      ? `the C engine differs from the expectation of ${fixture.name}`
      : `the C engine reported no result for ${fixture.name}: ${failure?.message ?? 'no failure'}`);
  });
});
