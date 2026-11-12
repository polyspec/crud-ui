// The cases of legacy/tests/fixtures/history-functions (CURT-063, CURT-076 to CURT-080): the other implementations pass the same
// cases. Each case is a top-level test named by its name (S6).
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { provesConformance } from '../../../../../tests/conformance/evidence.mts';
import { functionCase, observeFunction, readCases } from '../../../../tests/fixtures/form-state/harness.mts';
import * as core from './index';

const ROOT = path.resolve(__dirname, '../../../../..');

for (const entry of readCases(fs.readFileSync(path.join(ROOT, 'legacy/tests/fixtures/history-functions/cases.json'), 'utf8')).map(functionCase)) {
  it(entry.name, () => provesConformance({
    features: ['formHistory'],
    fixture: 'legacy/tests/fixtures/history-functions/cases.json',
    runtime: 'javascript',
    case: entry.name,
  }, () => {
    expect(observeFunction(core, entry)).toStrictEqual(entry.expected);
  }));
}
