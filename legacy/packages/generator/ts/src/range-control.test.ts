import { describe, expect, it } from 'vitest';
import { FormInputError } from '@polyspec/crudui-validator';
import { bindForm, compileForm, type NodeVM } from './index';

// Range fields (docs/spec/schema.md, Range fields; docs/spec/form-markup.md, Range fields).
const G = (properties: Record<string, unknown>) => ({ type: 'group', properties });
const volume = { type: 'range', default: 50, append: '%', validate: { range: [0, 100], step: 5 } };
const field = (spec: Record<string, unknown>, data: Record<string, unknown> = {}): NodeVM =>
  bindForm(compileForm(G({ volume: spec })), data, { language: 'en' })[0];
const rejection = (spec: Record<string, unknown>): string => {
  try {
    compileForm(G({ volume: spec }));
  } catch (error) {
    if (!(error instanceof FormInputError)) throw error;
    expect(error.code).toBe('INVALID_FORM_INPUT');
    return error.message;
  }
  throw new Error('compileForm accepted the specification');
};

describe('range widget model', () => {
  it('writes the bounds and the step of the validation rules on a range input', () => {
    expect(field(volume).widget).toEqual({
      kind: 'range',
      layout: 'range',
      tag: 'input',
      attrs: {
        type: 'range',
        name: 'volume',
        value: '50',
        min: '0',
        max: '100',
        step: '5',
        class: 'valid-target crudui-input crudui-input--range',
        'data-name': 'volume',
        'data-rule-name': 'volume',
        'data-default': '50',
        id: 'crudui:volume',
      },
      text: '50',
      append: { text: '%', class: 'crudui-widget__affix' },
    });
  });

  it('shows the bound value, and an empty value as empty text', () => {
    const bound = field(volume, { volume: 35 }).widget;
    expect(bound && 'attrs' in bound ? [bound.attrs.value, bound.text] : []).toEqual(['35', '35']);
    const empty = field({ type: 'range', validate: { range: [-1.5, 1.5], step: 0.5 } }).widget;
    expect(empty && 'attrs' in empty ? [empty.attrs.min, empty.attrs.max, empty.attrs.step, empty.attrs.value, empty.text] : [])
      .toEqual(['-1.5', '1.5', '0.5', '', '']);
  });

  it('labels the range input', () => {
    expect(field({ ...volume, label: 'Volume' }).header?.labelFor).toBe('crudui:volume');
  });
});

describe('range field declaration checks', () => {
  const range = 'Invalid validate.range at volume: expected [minimum, maximum] finite numbers with minimum not above maximum';
  const step = 'Invalid validate.step at volume: expected a finite number above 0';

  it('requires literal bounds with the minimum not above the maximum', () => {
    expect(rejection({ type: 'range' })).toBe(range);
    expect(rejection({ type: 'range', validate: { step: 1 } })).toBe(range);
    expect(rejection({ type: 'range', validate: { range: [5, 1], step: 1 } })).toBe(range);
    expect(rejection({ type: 'range', validate: { range: '.limits', step: 1 } })).toBe(range);
    expect(rejection({ type: 'range', validate: { range: [0, 1, 2], step: 1 } })).toBe(range);
  });

  it('requires a literal step above 0', () => {
    expect(rejection({ type: 'range', validate: { range: [0, 10] } })).toBe(step);
    expect(rejection({ type: 'range', validate: { range: [0, 10], step: 0 } })).toBe(step);
    expect(rejection({ type: 'range', validate: { range: [0, 10], step: { '.fine': 0.1, true: 1 } } })).toBe(step);
  });

  it('requires a minimum that is a multiple of the step, decided exactly', () => {
    expect(rejection({ type: 'range', validate: { range: [0.5, 10], step: 1 } }))
      .toBe('Invalid validate.range at volume: expected a minimum that is a multiple of validate.step');
    expect(() => compileForm(G({ volume: { type: 'range', validate: { range: [0.3, 1], step: 0.1 } } }))).not.toThrow();
  });
});
