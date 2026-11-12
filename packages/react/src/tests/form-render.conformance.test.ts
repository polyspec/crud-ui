import { renderFields } from '../internal/renderFields';
import { ComposeLoadError, FormInputError, UnsupportedFieldTypeError, compileForm } from '@polyspec/crudui-generator-core';
/**
 * form-render conformance — React reference verification.
 *
 * The shared fixture tests/fixtures/form-render/cases.json declares its
 * `expected_html` to be the React CRUDUI reference generator's OWN normalized output.
 * This test re-verifies that claim by running the real generator (renderForm)
 * against the same fixture the Vue/Svelte CRUDUI generators load, normalized through
 * the same shared normalizer (normalize.mjs). Every framework
 * generator must reproduce `expected_html` after normalization.
 *
 * It also enforces the core invariant (SPEC §5/§2/G5): an unresolved $ref is a
 * LOAD ERROR (ComposeLoadError) — render FAILS, never valid:true. Do not weaken
 * assertions; if React disagrees with the fixture, the fixture is not the React
 * output and the contract is broken.
 */

import { describe, test, expect } from 'vitest';
import { normalizeHtml } from '../../../../legacy/tests/fixtures/form-render/normalize.mts';
// The shared fixture, imported as JSON (resolveJsonModule) — the SAME file the
// Vue/Svelte CRUDUI generators load. No node:fs dependency (DOM test env).
import fixtureCases from '../../../../legacy/tests/fixtures/form-render/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

/** Run one fixture case and record renderForm evidence for it. */
function proves(name: string, body: () => unknown): Promise<unknown> {
  return provesConformance(
    { features: ['renderForm'], fixture: 'legacy/tests/fixtures/form-render/cases.json', runtime: 'react', case: name },
    body
  );
}

interface FixtureCase {
  name: string;
  note: string;
  spec: Record<string, unknown>;
  data?: Record<string, unknown>;
  options?: Record<string, unknown>;
  expected_html?: string;
  expectError?: { code: string; message?: string };
}

const cases: FixtureCase[] = fixtureCases;

function render(c: FixtureCase): string {
  return renderFields(compileForm(c.spec, c.options), { ...c.options, data: c.data });
}

describe('form rendering: React reproduces the normalized expected_html', () => {
  for (const c of cases.filter((x) => !x.expectError)) {
    test(c.name, () => proves(c.name, () => {
      const actual = normalizeHtml(render(c));
      expect(actual).toStrictEqual(c.expected_html);
    }));
  }
});

describe('form rendering: render is idempotent (stable across re-render)', () => {
  for (const c of cases.filter((x) => !x.expectError)) {
    test(`${c.name} — re-render is stable`, () => proves(c.name, () => {
      expect(normalizeHtml(render(c))).toStrictEqual(normalizeHtml(render(c)));
    }));
  }
});

// An unresolved $ref throws ComposeLoadError, and an unsupported field type
// throws UnsupportedFieldTypeError. Both errors provide a stable code, and the
// renderer does not return successful or empty output for either condition.
const ERROR_CLASS_BY_CODE: Record<string, new (...args: never[]) => Error> = {
  REF_FILE_NOT_FOUND: ComposeLoadError,
  UNSUPPORTED_FIELD_TYPE: UnsupportedFieldTypeError,
  INVALID_FORM_INPUT: FormInputError,
};

describe('form rendering: a load/registry gap is a surfaced ERROR, never silent', () => {
  for (const c of cases) {
    const expected = c.expectError;
    if (!expected) continue;
    test(c.name, () => proves(c.name, () => {
      let thrown: unknown;
      try {
        render(c);
      } catch (e) {
        thrown = e;
      }
      const expectedClass = ERROR_CLASS_BY_CODE[expected.code];
      if (!expectedClass) throw new Error(`${c.name}: unknown error code ${expected.code}`);
      expect(thrown, `${c.name} must throw a surfaced error`).toBeInstanceOf(expectedClass);
      expect(thrown).toHaveProperty('code', expected.code);
      if (expected.message !== undefined) expect(thrown).toHaveProperty('message', expected.message);
    }));
  }
});

// Forbidden condition meta keys. The expr engine resolves design.show/class/style
// to concrete markup; if any of these names reaches the RAW output, a condition
// key leaked. `if`/`when` are matched only as JSON-key-shaped tokens
// ("if"/"when") so label/text prose never false-positives.
const FORBIDDEN_LITERAL = ['display_switch', 'display_target', 'show_if'];
const FORBIDDEN_KEYSHAPE = [/"if"/, /"when"/];

describe('form rendering: eval is never used (no condition metadata)', () => {
  // Operates on the RAW render output (pre-normalization) — the bytes the
  // generator actually emits, where a forbidden meta key or a magic token would
  // still be visible (there is no normalizer mask to hide one).
  for (const c of cases.filter((x) => x.expected_html)) {
    test(`${c.name} — no forbidden meta-key markup`, () => proves(c.name, () => {
      const raw = render(c);

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
  test('multiple-group-rows — real data row id survives unmasked (G4)', () => {
    const c = cases.find((x) => x.name === 'multiple-group-rows');
    if (!c) throw new Error('the fixture must contain multiple-group-rows');
    const raw = render(c);
    expect(raw).toContain('data-crudui-row-key="p1"');
  });
});
