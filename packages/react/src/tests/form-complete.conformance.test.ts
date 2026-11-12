/**
 * Complete form conformance (form-runtime.md, "Complete form"): the shared cases of
 * tests/fixtures/form-complete/cases.json through React's server rendering. React is the byte
 * reference, so its output equals `expected_html` exactly, and an option outside the contract
 * fails with the declared code and message.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from '../server';
import fixtureCases from '../../../../legacy/tests/fixtures/form-complete/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';
import { checked, renderOptionsSchema } from '../../../../tests/json.mts';

interface CompleteCase {
  name: string;
  spec: Record<string, unknown>;
  data: Record<string, unknown>;
  options: Record<string, unknown>;
  render: unknown;
  expected_html?: string;
  expectError?: { code: string; message: string };
}

const cases: CompleteCase[] = fixtureCases;

/**
 * renderForm with the render options of a case that fails, called as a JavaScript caller does (Reflect.apply): they hold
 * values that the type of the options rejects and renderForm checks at run time.
 */
function renderFailingCase(form: ReturnType<typeof createForm>, render: unknown): unknown {
  return Reflect.apply(renderForm, undefined, [form, render]);
}

describe('complete form: React writes the expected bytes or the declared failure', () => {
  for (const c of cases) {
    test(c.name, () => provesConformance(
      { features: ['renderForm'], fixture: 'legacy/tests/fixtures/form-complete/cases.json', runtime: 'react', case: c.name },
      () => {
        const form = createForm(compileForm(c.spec), c.data, c.options);
        if (c.expectError) {
          let thrown: unknown;
          try { renderFailingCase(form, c.render); } catch (error) { thrown = error; }
          expect(thrown).toBeInstanceOf(Error);
          expect(thrown).toMatchObject(c.expectError);
        } else {
          expect(renderForm(form, checked(c.render, renderOptionsSchema, c.name))).toBe(c.expected_html);
        }
      },
    ));
  }
});
