/**
 * The registration of the form-state units. Each unit has its own test file, which calls one of these functions with its
 * family and the generator core; every case of the family is a top-level test named by the case, so a failure names its
 * case. The assertions are those of harness.mts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';
import { type Core, functionCase, observeFunction, observeSession, readCases, sessionCase } from './harness.mts';

const FEATURES: Record<string, string> = {
  'form-view': 'viewState', 'view-functions': 'viewState', 'form-history': 'formHistory',
  'history-functions': 'formHistory', 'form-actions': 'runAction', 'form-choices': 'createForm',
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function familyCases(family: string) {
  if (!FEATURES[family]) throw new Error(`No conformance feature is declared for ${family}`);
  return readCases(fs.readFileSync(path.join(ROOT, `legacy/tests/fixtures/${family}/cases.json`), 'utf8'));
}

/** Registers the session cases of a family; history is true for a family that records history and actions. */
export function registerSessionCases(family: string, history: boolean, core: Core): void {
  for (const entry of familyCases(family).map(sessionCase)) {
    it(entry.name, () => provesConformance(
      { features: [FEATURES[family] ?? family], fixture: `legacy/tests/fixtures/${family}/cases.json`, runtime: 'javascript', case: entry.name },
      () => { expect(observeSession(core, entry, history)).toStrictEqual(entry.expected); },
    ));
  }
}

/** Registers the function cases of a family. */
export function registerFunctionCases(family: string, core: Core): void {
  for (const entry of familyCases(family).map(functionCase)) {
    it(entry.name, () => provesConformance(
      { features: [FEATURES[family] ?? family], fixture: `legacy/tests/fixtures/${family}/cases.json`, runtime: 'javascript', case: entry.name },
      () => { expect(observeFunction(core, entry)).toStrictEqual(entry.expected); },
    ));
  }
}
