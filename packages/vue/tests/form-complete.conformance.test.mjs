/**
 * Complete form conformance (form-runtime.md, "Complete form"): Vue server rendering of the
 * shared cases in tests/fixtures/form-complete/cases.json. Vue writes its own serialization, so
 * the output and `expected_html` are compared after the shared normalization; an option outside
 * the contract fails with the declared code and message.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { renderForm } from '../src/ssr.ts';
import { provesConformance } from '../../../tests/conformance/evidence.mts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.resolve(HERE, '../../../legacy/tests/fixtures/form-complete/cases.json'), 'utf8'));

describe('complete form: Vue writes the expected markup or the declared failure', () => {
  for (const c of cases) {
    test(c.name, () => provesConformance(
      { features: ['renderForm'], fixture: 'legacy/tests/fixtures/form-complete/cases.json', runtime: 'vue', case: c.name },
      async () => {
        const form = createForm(compileForm(c.spec), c.data, c.options);
        if (c.expectError) {
          let thrown;
          try { await renderForm(form, c.render); } catch (error) { thrown = error; }
          expect({ code: thrown?.code, message: thrown?.message }).toStrictEqual(c.expectError);
        } else {
          expect(normalizeHtml(await renderForm(form, c.render))).toBe(normalizeHtml(c.expected_html));
        }
      },
    ));
  }
});
