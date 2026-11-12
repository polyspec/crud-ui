import { describe, expect, it } from 'vitest';
import { FormInputError } from '@polyspec/crudui-validator';
import { bindForm, buildList, compileForm, type NodeVM, type OptionModel } from './index';
import { optionSections } from './internal';
import { present } from './test-support';

// Choice groups (docs/spec/schema.md, Choice groups; docs/spec/form-markup.md, Choice groups).
const G = (properties: Record<string, unknown>) => ({ type: 'group', properties });
const field = (spec: Record<string, unknown>, data: Record<string, unknown> = {}): NodeVM =>
  bindForm(compileForm(G({ region: spec })), data, { language: 'en' })[0];
const options = (spec: Record<string, unknown>, data: Record<string, unknown> = {}): OptionModel[] | undefined => {
  const widget = field(spec, data).widget;
  return widget && 'options' in widget ? widget.options : undefined;
};
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
const europe = { label: { en: 'Europe', ko: '유럽' }, choices: [{ value: 'eu-west', label: 'West' }, { value: 'eu-north', label: 'North' }] };
const asia = { label: 'Asia', choices: [{ value: 'ap-east', label: 'East' }] };

describe('choice groups in the widget model', () => {
  it('lists a list made only of groups with the group of each option in written order', () => {
    expect(options({ type: 'select', items: [europe, asia] })).toEqual([
      { value: 'eu-west', label: 'West', selected: false, isDefault: false, group: { index: 0, label: 'Europe' } },
      { value: 'eu-north', label: 'North', selected: false, isDefault: false, group: { index: 0, label: 'Europe' } },
      { value: 'ap-east', label: 'East', selected: false, isDefault: false, group: { index: 1, label: 'Asia' } },
    ]);
  });

  it('mixes plain choices and groups, and the value selects an option inside a group', () => {
    for (const type of ['select', 'dropdown', 'selectbox']) {
      expect(options({ type, items: [{ value: 'auto', label: 'Automatic' }, europe, { value: 7, label: 'Seven' }] }, { region: 'eu-north' })).toEqual([
        { value: 'auto', label: 'Automatic', selected: false, isDefault: false },
        { value: 'eu-west', label: 'West', selected: false, isDefault: false, group: { index: 1, label: 'Europe' } },
        { value: 'eu-north', label: 'North', selected: true, isDefault: false, group: { index: 1, label: 'Europe' } },
        { value: '7', label: 'Seven', selected: false, isDefault: false },
      ]);
    }
  });

  it('translates the group label', () => {
    const widget = bindForm(compileForm(G({ region: { type: 'select', items: [europe] } })), {}, { language: 'ko' })[0].widget;
    expect(widget && 'options' in widget ? widget.options?.[0]?.group : undefined).toEqual({ index: 0, label: '유럽' });
  });

  it('splits the options into consecutive sections by group', () => {
    const list = present(options({ type: 'select', items: [{ value: 'auto', label: 'Automatic' }, europe, asia] }), 'the options');
    expect(optionSections(list)).toEqual([
      { options: [list[0]] },
      { group: { index: 1, label: 'Europe' }, options: [list[1], list[2]] },
      { group: { index: 2, label: 'Asia' }, options: [list[3]] },
    ]);
  });
});

describe('choice group checks', () => {
  const pairs = 'Invalid items at region: expected value and label pairs with distinct string or number values';

  it('rejects a value that repeats a value inside or outside a group', () => {
    expect(rejection({ type: 'select', items: [europe, { label: 'Again', choices: [{ value: 'eu-west', label: 'West' }] }] })).toBe(pairs);
    expect(rejection({ type: 'select', items: [{ value: 'ap-east', label: 'East' }, asia] })).toBe(pairs);
    expect(rejection({ type: 'select', items: [{ label: 'Numbers', choices: [{ value: 1, label: 'One' }, { value: '1', label: 'One' }] }] })).toBe(pairs);
  });

  it('rejects a group with no choices, a malformed group and a nested group', () => {
    expect(rejection({ type: 'select', items: [{ label: 'Empty', choices: [] }] })).toBe(pairs);
    expect(rejection({ type: 'select', items: [europe, { label: 'Empty', choices: [] }] })).toBe(pairs);
    expect(rejection({ type: 'select', items: [{ label: 'Bad', choices: 'eu-west' }] })).toBe(pairs);
    expect(rejection({ type: 'select', items: [{ choices: [{ value: 1, label: 'One' }] }] })).toBe(pairs);
    expect(rejection({ type: 'select', items: [{ ...asia, class: 'x' }] })).toBe(pairs);
    expect(rejection({ type: 'select', items: [{ label: 'Outer', choices: [asia] }] })).toBe(pairs);
    expect(rejection({ type: 'select', items: [{ label: 'Styled', choices: [{ value: 1, label: 'One', class: 'x' }] }] })).toBe(pairs);
  });

  it('rejects a group in a field that is not a select field', () => {
    for (const type of ['choice', 'radio', 'multichoice', 'checkboxes', 'search', 'dummy']) {
      expect(rejection({ type, items: [europe] })).toBe(pairs);
      expect(rejection({ type, items: [{ value: 'auto', label: 'Automatic' }, asia] })).toBe(pairs);
    }
  });

  it('rejects a group in the choice list of the choice-label format', () => {
    expect(() => buildList({ columns: { region: { field: 'region', format: { type: 'choice-label', items: [europe] } } } }, []))
      .toThrow('Invalid format.items at columns.region: expected value and label pairs with distinct string or number values');
  });
});
