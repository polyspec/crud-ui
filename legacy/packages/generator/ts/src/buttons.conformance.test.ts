import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { provesConformance } from '../../../../../tests/conformance/evidence.mts';
import * as core from './index';

/**
 * The form button cases of legacy/tests/fixtures/buttons: each case runs bindButtons (CURP-008) or formButtonsHtml (CURP-009)
 * and its observation must equal the expectation. The comparison is on the JSON text, so the attribute order is checked too.
 */
const ROOT = path.resolve(__dirname, '../../../../..');

/** The reference functions take the values of a case as they are, invalid ones included. */
const bindButtons = (template: unknown, data: unknown, options: unknown): unknown =>
  Reflect.apply(core.bindButtons, undefined, [template, data, options]);
const compileForm = (spec: unknown): unknown => Reflect.apply(core.compileForm, undefined, [spec]);
const formButtonsHtml = (buttons: unknown): unknown => Reflect.apply(core.formButtonsHtml, undefined, [buttons]);

/** The observation of one case: the result as JSON, or the error by its code and message. */
function observe(run: () => unknown): unknown {
  try {
    const text: string = JSON.stringify(run() ?? null);
    const result: unknown = JSON.parse(text);
    return { result };
  } catch (error) {
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'ERROR';
    return { error: { code, message: error instanceof Error ? error.message : String(error) } };
  }
}

/** The members of a case, read as they are: a case that is no object fails the run. */
function fields(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('A case is no object');
  return Object.fromEntries(Object.entries(value));
}

const text: string = fs.readFileSync(path.join(ROOT, 'legacy/tests/fixtures/buttons/cases.json'), 'utf8');
const parsed: unknown = JSON.parse(text);
if (!Array.isArray(parsed)) throw new Error('legacy/tests/fixtures/buttons/cases.json is no list');
const list: unknown[] = parsed;

// Each case is a top-level test named by the case, so the parity check reads every case of the unit by its name.
for (const item of list) {
  const entry = fields(item);
  it(String(entry.name), () => provesConformance({
    features: [entry.operation === 'bindButtons' ? 'bindButtons' : 'formButtonsHtml'],
    fixture: 'legacy/tests/fixtures/buttons/cases.json',
    runtime: 'javascript',
    case: String(entry.name),
  }, () => {
    const observed = entry.operation === 'bindButtons'
      ? observe(() => bindButtons(
        entry.spec !== undefined ? compileForm(entry.spec) : entry.template,
        entry.data ?? {},
        entry.options ?? {},
      ))
      : observe(() => formButtonsHtml(entry.buttons));
    expect(JSON.stringify(observed)).toBe(JSON.stringify(entry.expected));
  }));
}
