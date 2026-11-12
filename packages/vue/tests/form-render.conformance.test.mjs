import { ComposeLoadError, FormInputError, UnsupportedFieldTypeError, compileForm } from '@polyspec/crudui-generator-core';
/**
 * form-render conformance — Vue 3 SSR vs the shared 3-framework parity fixture.
 *
 * The shared fixture tests/fixtures/form-render/cases.json holds ONE
 * `expected_html` per case (the React CRUDUI reference's normalized output). This
 * test runs the Vue CRUDUI generator through genuine Vue 3 SSR
 * (vue/server-renderer renderToString via createStaticVNode), normalizes with
 * the SAME shared normalizer (normalize.mjs), and asserts equality. The
 * Vue must reproduce `expected_html` after normalization.
 *
 * It also enforces the core invariant (SPEC §5/§2/G5): an unresolved $ref is a
 * LOAD ERROR (ComposeLoadError) — render FAILS, never valid:true. Do NOT weaken
 * assertions or fixtures; fix the Vue generator if it disagrees.
 *
 * The CRUDUI generator is loaded from TypeScript source via the package's createRequire
 * realm + tsx (Vitest transforms TS); the validator is the linked @polyspec/crudui-validator.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';

// Shared 3-framework fixture + normalizer (the SAME files React/Svelte load).
import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
// Vue CRUDUI generator (TypeScript source; Vitest transforms it).
import { renderFields } from '../src/internal/renderFields.ts';
import { provesConformance } from '../../../tests/conformance/evidence.mts';

/** Run one fixture case and record renderForm evidence for it. */
function proves(name, body) {
  return provesConformance(
    { features: ['renderForm'], fixture: 'legacy/tests/fixtures/form-render/cases.json', runtime: 'vue', case: name },
    body
  );
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '../../../legacy/tests/fixtures/form-render/cases.json');
const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

async function renderSSR(c) {
  return renderFields(compileForm(c.spec, c.options), { ...c.options, data: c.data });
}

describe('form rendering: Vue 3 SSR reproduces the normalized expected_html', () => {
  for (const c of cases.filter((x) => !x.expectError)) {
    test(c.name, () => proves(c.name, async () => {
      const actual = normalizeHtml(await renderSSR(c));
      expect(actual).toStrictEqual(c.expected_html);
    }));
  }
});

describe('form rendering: Vue SSR is idempotent (stable across re-render)', () => {
  for (const c of cases.filter((x) => !x.expectError)) {
    test(`${c.name} — re-render is stable`, () => proves(c.name, async () => {
      const a = normalizeHtml(await renderSSR(c));
      const b = normalizeHtml(await renderSSR(c));
      expect(a).toStrictEqual(b);
    }));
  }
});

// An unresolved $ref throws ComposeLoadError, and an unsupported field type
// throws UnsupportedFieldTypeError. Both errors provide a stable code, and the
// renderer does not return successful or empty output for either condition.
const ERROR_CLASS_BY_CODE = {
  REF_FILE_NOT_FOUND: ComposeLoadError,
  UNSUPPORTED_FIELD_TYPE: UnsupportedFieldTypeError,
  INVALID_FORM_INPUT: FormInputError,
};

describe('form rendering: a load/registry gap is a surfaced ERROR, never silent', () => {
  for (const c of cases.filter((x) => x.expectError)) {
    test(c.name, () => proves(c.name, async () => {
      let thrown;
      try {
        await renderSSR(c);
      } catch (e) {
        thrown = e;
      }
      const expectedClass = ERROR_CLASS_BY_CODE[c.expectError.code];
      expect(expectedClass, `${c.name}: unknown error code ${c.expectError.code}`).toBeTruthy();
      expect(thrown, `${c.name} must throw a surfaced error`).toBeInstanceOf(expectedClass);
      expect(thrown.code).toStrictEqual(c.expectError.code);
      if (c.expectError.message !== undefined) expect(thrown.message).toStrictEqual(c.expectError.message);
    }));
  }
});

// Forbidden condition meta keys. The expr engine resolves design.show/class/style
// to concrete markup; if any of these names reaches the RAW SSR output, a condition
// key leaked. `if`/`when` are matched only as JSON-key-shaped tokens
// ("if"/"when") so label/text prose never false-positives.
const FORBIDDEN_LITERAL = ['display_switch', 'display_target', 'show_if'];
const FORBIDDEN_KEYSHAPE = [/"if"/, /"when"/];

describe('form rendering: eval is never used (no condition metadata)', () => {
  for (const c of cases.filter((x) => x.expected_html)) {
    test(`${c.name} — no forbidden meta-key markup`, () => proves(c.name, async () => {
      const raw = await renderSSR(c);

      // 1: no forbidden condition meta key reaches the markup.
      for (const lit of FORBIDDEN_LITERAL) {
        expect(raw, `${c.name}: ${lit} leaked into raw output`).not.toContain(lit);
      }
      for (const re of FORBIDDEN_KEYSHAPE) {
        expect(raw, `${c.name}: ${re} leaked into raw output`).not.toMatch(re);
      }

    }));
  }

  // 3: G4 data identity — a real row id (e.g. people.p1) is preserved verbatim
  // as data-crudui-row-key in the RAW output, never replaced by a synthesized position
  // token (no __13hex__ position-id leakage; README coverage line).
  test('multiple-group-rows — real data row id survives unmasked (G4)', async () => {
    const c = cases.find((x) => x.name === 'multiple-group-rows');
    expect(c, 'fixture must contain multiple-group-rows').toBeTruthy();
    expect(await renderSSR(c)).toContain('data-crudui-row-key="p1"');
  });
});
