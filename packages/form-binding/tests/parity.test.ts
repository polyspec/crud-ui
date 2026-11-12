// The error markup the binding writes into a rendered form equals the markup renderForm writes
// for the same errors and form errors (form-runtime.md, "Error display"). The cases are the
// invalid cases of the shared validation fixture whose data a rendered form holds exactly: the
// binding collects that data from the form, so its validation result is the fixture's result.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { ValidationResult } from '@polyspec/crudui-validator';
import { FormInputError } from '@polyspec/crudui-validator';
import { composeProperties, composeSpec, MemoryLoader } from '@polyspec/crudui-validator/internal';
import { UnsupportedFieldTypeError } from '@polyspec/crudui-generator-core';
import { describe, expect, it } from 'vitest';

import { collectData } from '../src/data';
import { bindForm } from '../src/index';
import { documentOf, formBodyOf, formHtml, found } from './dom';

interface Case {
  name: string;
  spec: Record<string, unknown>;
  data: Record<string, unknown>;
  // A case that expects a load or input failure has no expected result; toStrictEqual compares it with the result.
  expected?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFileSet = (value: unknown): value is Record<string, Record<string, unknown>> =>
  isRecord(value) && Object.values(value).every(isRecord);

/**
 * The cases of the shared validation fixture, each checked to hold a name, an object specification and object data. A case
 * that declares an input failure (expectFailure) with a specification or data that is no object is left out, as no
 * rendered form holds it; any other case without them is malformed and fails.
 */
function readCases(text: string): Case[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) throw new TypeError('The validation fixture holds no list of cases');
  return value.flatMap((item: unknown, index): Case[] => {
    if (!isRecord(item) || typeof item.name !== 'string') throw new TypeError(`Case ${index} of the validation fixture has no name`);
    if (!isRecord(item.spec) || !isRecord(item.data)) {
      if (isRecord(item.expectFailure)) return [];
      throw new TypeError(`Case ${index} of the validation fixture has no object spec and data and expects no input failure`);
    }
    let spec = item.spec;
    if (isRecord(item.expected) && item.expected.valid === false) {
      if (item.files !== undefined && !isFileSet(item.files)) {
        throw new TypeError(`Case ${index} of the validation fixture has no composition file set`);
      }
      const loader = new MemoryLoader(item.files ?? {});
      spec = ('$ref' in spec || '$patch' in spec) && !isRecord(spec.properties)
        ? { type: 'group', properties: composeProperties(spec, loader) }
        : composeSpec(spec, loader);
    }
    return [{ name: item.name, spec, data: item.data, ...('expected' in item ? { expected: item.expected } : {}) }];
  });
}

const cases = readCases(readFileSync(new URL('../../../legacy/tests/fixtures/validate/cases.json', import.meta.url), 'utf8'));
const formErrors = (result: ValidationResult) => (result.valid ? [] : ['Check the marked fields.']);

/** The form of a case, parsed, when the case's data renders and a rendered form holds it exactly. */
function holdsData(item: Case): boolean {
  if (!isRecord(item.expected) || item.expected.valid !== false) return false;
  let html: string;
  try { html = formHtml(item.spec, item.data); } catch (error) {
    if (!(error instanceof FormInputError) && !(error instanceof UnsupportedFieldTypeError)) throw error;
    return false;
  }
  return JSON.stringify(collectData(formBodyOf(documentOf(html).document), 'form')) === JSON.stringify(item.data);
}

const selected = cases.filter(holdsData);

/** The form's content with every `aria-invalid` attribute removed, and the controls that had one. */
function withoutInvalidMarks(form: HTMLFormElement): { html: string; invalid: string[] } {
  const invalid = Array.from(form.querySelectorAll<HTMLInputElement>('[aria-invalid]'), (element) => {
    expect(element.getAttribute('aria-invalid')).toBe('true');
    element.removeAttribute('aria-invalid');
    return `${element.name}=${element.value}`;
  });
  return { html: form.innerHTML, invalid };
}

describe('the cases of the validation fixture', () => {
  it('resolves fixture files before deciding whether the rendered form holds the data', () => {
    const item = cases.find(item => item.name === 'composed-member-order');
    assert(item);
    expect(Object.keys(item.spec.properties ?? {})).toStrictEqual(['10', 'b', 'a']);
    expect(() => formHtml(item.spec, item.data)).not.toThrow();
    expect(holdsData(item)).toBe(false);
  });

  it('leave out a case whose specification or data is no object only when it expects an input failure', () => {
    const failure = { code: 'INVALID_FORM_INPUT', message: 'Form data must be an object', at: '' };
    expect(readCases(JSON.stringify([{ name: 'declared', spec: {}, data: ['a'], expectFailure: failure }]))).toStrictEqual([]);
    expect(() => readCases(JSON.stringify([{ name: 'malformed', spec: {}, data: ['a'] }])))
      .toThrow('Case 0 of the validation fixture has no object spec and data and expects no input failure');
    expect(() => readCases(JSON.stringify([{ name: 'malformed', spec: [], data: {}, expected: { valid: false } }])))
      .toThrow('Case 0 of the validation fixture has no object spec and data and expects no input failure');
  });
});

describe('error markup parity with renderForm', () => {
  it('selects the invalid fixture cases whose data a rendered form holds', () => {
    expect(selected.length).toBeGreaterThanOrEqual(50);
    expect(selected.map(item => item.name)).toContain('compose-ref-patch-email');
  });

  for (const item of selected) {
    it(item.name, () => {
      const { document } = documentOf(formHtml(item.spec, item.data));
      const form = found(document.querySelector('form'), 'the form element');
      const result = bindForm(form, item.spec, { keyPrefix: 'form', formErrors }).validate();
      expect(result).toStrictEqual(item.expected);

      const expected = documentOf(formHtml(item.spec, item.data, { errors: result.errors, formErrors: formErrors(result) }))
        .document.querySelector('form');
      assert(expected, 'the form element of renderForm');
      const actual = withoutInvalidMarks(form);
      expect(actual.html).toBe(expected.innerHTML);
      expect(form.noValidate).toBe(true);

      // Every control of a node with errors, and no other control, is marked invalid.
      const failing = new Set(result.errors.map((error) => error.path));
      const marked = Array.from(expected.querySelectorAll<HTMLInputElement>('input[name], select[name], textarea[name]'))
        .filter((element) => {
          const owner = element.closest<HTMLElement>('[data-field-path], [data-crudui-row-key]');
          if (!owner || element.type === 'file' || element.disabled) return false;
          const path = owner.dataset.fieldPath
            ?? `${found(owner.parentElement?.closest<HTMLElement>('[data-field-path]'), 'the collection of a row').dataset.fieldPath}.${owner.getAttribute('data-crudui-row-key')}`;
          return failing.has(path);
        })
        .map((element) => `${element.name}=${element.value}`);
      expect(actual.invalid).toStrictEqual(marked);
    });
  }
});
