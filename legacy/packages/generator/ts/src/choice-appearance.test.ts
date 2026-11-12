import { describe, expect, it } from 'vitest';
import { FormInputError } from '@polyspec/crudui-validator';
import { bindForm, compileForm, type NodeVM } from './index';

// Choice appearance (docs/spec/schema.md, Choice appearance; docs/spec/form-markup.md, Choice appearance).
const G = (properties: Record<string, unknown>) => ({ type: 'group', properties });
const field = (spec: Record<string, unknown>, data: Record<string, unknown> = {}): NodeVM =>
  bindForm(compileForm(G({ accent: spec })), data, { language: 'en' })[0];
const rejection = (spec: Record<string, unknown>): string => {
  try {
    field(spec);
  } catch (error) {
    if (!(error instanceof FormInputError)) throw error;
    expect(error.code).toBe('INVALID_FORM_INPUT');
    return error.message;
  }
  throw new Error('bindForm accepted the specification');
};
const swatches = [
  { value: 'blue', label: 'Blue', class: 'swatch', style: '--swatch-bg:#1d4ed8', attributes: { 'aria-label': 'Blue accent' } },
  { value: 'green', label: 'Green' },
];

describe('choice appearance in the widget model', () => {
  it('keeps the class, style and attributes of each choice on its option', () => {
    const widget = field({ type: 'choice', items: swatches }).widget;
    expect(widget && 'options' in widget ? widget.options : undefined).toEqual([
      {
        value: 'blue', label: 'Blue', selected: false, isDefault: false, id: 'crudui:accent:0',
        className: 'swatch', style: '--swatch-bg: #1d4ed8', attributes: { 'aria-label': 'Blue accent' },
      },
      { value: 'green', label: 'Green', selected: false, isDefault: false, id: 'crudui:accent:1' },
    ]);
  });

  it('applies design.group to the choices element of a choice and a multichoice field', () => {
    for (const [type, base] of [['choice', 'crudui-choices'], ['checkboxes', 'crudui-choices crudui-choices--multiple']] as const) {
      const widget = field({ type, items: swatches, design: { group: { class: 'swatches', style: 'grid-template-columns: repeat(6, 2rem)' } } }).widget;
      expect(widget && 'attrs' in widget ? widget.attrs : undefined)
        .toEqual({ class: `${base} swatches`, style: 'grid-template-columns: repeat(6, 2rem)' });
    }
  });
});

describe('choice appearance checks', () => {
  const pairs = 'Invalid items at accent: expected value and label pairs with distinct string or number values';

  it('accepts appearance only in the choices of a choice or multichoice field', () => {
    expect(rejection({ type: 'select', items: swatches })).toBe(pairs);
    expect(rejection({ type: 'search', items: swatches })).toBe(pairs);
    expect(rejection({ type: 'choice', items: [{ value: 1, label: 'One', id: 'x' }] })).toBe(pairs);
  });

  it('requires a string class and style', () => {
    expect(rejection({ type: 'radio', items: [{ value: 1, label: 'One', class: ['a'] }] }))
      .toBe('Invalid items.0.class at accent: expected a string');
    expect(rejection({ type: 'multichoice', items: [{ value: 1, label: 'One' }, { value: 2, label: 'Two', style: { '.on': 'color: red' } }] }))
      .toBe('Invalid items.1.style at accent: expected a string');
  });

  it('checks choice attributes by the declared attribute rules', () => {
    expect(rejection({ type: 'choice', items: [{ value: 1, label: 'One', attributes: 'x' }] }))
      .toBe('Invalid items.0.attributes at accent: expected an object');
    expect(rejection({ type: 'choice', items: [{ value: 1, label: 'One', attributes: { onclick: 'go()' } }] }))
      .toBe('Invalid items.0.attributes.onclick at accent: expected a data-* or aria-* name that crudui does not write');
    expect(rejection({ type: 'choice', items: [{ value: 1, label: 'One', attributes: { 'data-x': 1 } }] }))
      .toBe('Invalid items.0.attributes.data-x at accent: expected a string');
  });
});
