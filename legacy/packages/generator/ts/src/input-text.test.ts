import { describe, expect, test } from 'vitest';
import { bindButtons, buildList, compileForm } from './index';
import { failure } from '../../../../tests/fixtures/text-validity/input-text.mts';

/**
 * Input text of the form buttons and of the loader documents (docs/spec/input-text.md), the unit tests of the operations
 * that legacy/tests/fixtures/text-validity does not cover. The shared cases of the five text operations are registered by the unit
 * files text-compile-form, text-bind-form, text-create-form, text-build-list and text-build-detail, which read them by name.
 */

describe('input text of the other form operations', () => {
  test('buttons check the template, the data and the options', () => {
    const compiled = compileForm({ type: 'group', properties: { name: { type: 'text' } } });
    // @ts-expect-error: a lone surrogate is no Language; the options are checked at run time.
    expect(failure(() => bindButtons(compiled, { name: '\ud800' }, { language: '\udc00' }))).toStrictEqual({
      code: 'INVALID_FORM_INPUT', message: 'Text must be Unicode scalar values: data.name', at: '',
    });
  });

  test('a custom loader document is checked when it is loaded', () => {
    const loader = { normalize: (p: string) => p, load: () => ({ properties: { x: { type: '\udc00' } } }) };
    expect(failure(() => compileForm({ type: 'group', properties: { $ref: 'b.yml' } }, { loader }))).toStrictEqual({
      code: 'INVALID_TEXT', message: 'Text must be Unicode scalar values', at: 'b.yml.properties.x.type',
    });
    expect(failure(() => buildList({ columns: { $ref: 'c.yml' } }, [], { loader }))).toStrictEqual({
      code: 'INVALID_TEXT', message: 'Text must be Unicode scalar values', at: 'c.yml.properties.x.type',
    });
  });
});
