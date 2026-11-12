import { describe, expect, it } from 'vitest';
import { FormInputError } from '@polyspec/crudui-validator';
import { bindButtons, bindForm, buildList, compileForm, type NodeVM } from './index';

// Declared attributes of a control and a node root (docs/spec/schema.md, Declared attributes).
const G = (properties: Record<string, unknown>) => ({ type: 'group', properties });
const field = (spec: Record<string, unknown>, data: Record<string, unknown> = {}): NodeVM =>
  bindForm(compileForm(G({ f: spec })), data, { language: 'en' })[0];
const rejection = (spec: Record<string, unknown>): string => {
  try {
    compileForm(spec);
  } catch (error) {
    if (!(error instanceof FormInputError)) throw error;
    expect(error.code).toBe('INVALID_FORM_INPUT');
    return error.message;
  }
  throw new Error('compileForm accepted the specification');
};

describe('declared attributes in the node and widget models', () => {
  it('rejects a decoded template whose declared attribute is no string, as compileForm rejects its specification', () => {
    const template = compileForm(G({ f: { type: 'text', design: { attributes: { 'data-x': 'y' }, wrapper: { attributes: { 'data-w': 'z' } } } } }));
    const control: unknown = JSON.parse(JSON.stringify(template).replace('"data-x":"y"', '"data-x":5'));
    const wrapper: unknown = JSON.parse(JSON.stringify(template).replace('"data-w":"z"', '"data-w":5'));
    // @ts-expect-error: a template from its JSON cache that was changed after compilation, which bindForm checks at run time.
    expect(() => bindForm(control)).toThrow(new FormInputError('Invalid design.attributes.data-x at f: expected a string'));
    // @ts-expect-error: a template from its JSON cache that was changed after compilation, which bindForm checks at run time.
    expect(() => bindForm(wrapper)).toThrow(new FormInputError('Invalid design.wrapper.attributes.data-w at f: expected a string'));
  });

  it('appends control attributes after the attributes crudui writes, in declaration order', () => {
    const node = field({ type: 'text', design: { attributes: { 'data-setting': 'theme', 'aria-describedby': 'help' } } });
    expect(node.widget && 'attrs' in node.widget ? Object.entries(node.widget.attrs).slice(-3) : []).toEqual([
      ['id', 'crudui:f'], ['data-setting', 'theme'], ['aria-describedby', 'help'],
    ]);
  });

  it('writes wrapper attributes as the node member after style and before hidden', () => {
    const node = field({ type: 'text', design: { show: false, wrapper: { style: 'color: red', attributes: { 'data-section': 'look' } } } });
    expect(Object.keys(node).slice(0, 6)).toEqual(['kind', 'path', 'className', 'style', 'attributes', 'hidden']);
    expect(node.attributes).toEqual({ 'data-section': 'look' });
  });

  it('keeps choice option attributes in extra.option and file attributes in extra.file', () => {
    const choice = field({ type: 'choice', items: { a: 'A' }, design: { attributes: { 'data-x': '1' } } });
    expect(choice.widget && 'extra' in choice.widget ? choice.widget.extra : undefined).toEqual({
      input: { name: 'f', 'data-name': 'f', 'data-rule-name': 'f' },
      option: { 'data-x': '1' },
    });
    const image = field({ type: 'image', design: { attributes: { 'data-x': '1' } } });
    const file = image.widget && 'extra' in image.widget ? image.widget.extra?.file : undefined;
    expect(Object.entries(file ?? {}).slice(-2)).toEqual([['id', 'crudui:f'], ['data-x', '1']]);
  });

  it('writes checkbox attributes after the caption', () => {
    const node = field({ type: 'checkbox', label: 'On', design: { attributes: { 'aria-describedby': 'help' } } });
    expect(node.checkbox).toEqual({
      id: 'crudui:f', name: 'f', className: 'valid-target', checked: false, caption: 'On', attributes: { 'aria-describedby': 'help' },
    });
  });

  it('writes control attributes on every row and language control and none on row and lang-item nodes', () => {
    const rows = field({ type: 'text', multiple: true, design: { attributes: { 'data-x': '1' }, wrapper: { attributes: { 'data-y': '2' } } } }, { f: { a: 'p', b: 'q' } });
    expect(rows.attributes).toEqual({ 'data-y': '2' });
    for (const row of rows.children ?? []) {
      expect(row.attributes).toBeUndefined();
      expect(row.widget && 'attrs' in row.widget ? row.widget.attrs['data-x'] : undefined).toBe('1');
    }
    const lang = field({ type: 'text', lang: { only: ['en', 'ko'] }, design: { attributes: { 'data-x': '1' } } });
    expect(lang.children?.map(item => item.widget && 'attrs' in item.widget ? item.widget.attrs['data-x'] : undefined)).toEqual(['1', '1']);
    expect(lang.children?.map(item => item.attributes)).toEqual([undefined, undefined]);
  });

  it('has no attributes member for an empty declaration', () => {
    const node = field({ type: 'text', design: { attributes: {}, wrapper: { attributes: {} } } });
    expect('attributes' in node).toBe(false);
    expect(node.widget && 'attrs' in node.widget ? Object.keys(node.widget.attrs).slice(-1)[0] : undefined).toBe('id');
  });
});

describe('declared attribute checks', () => {
  it('rejects a declaration that is not an object', () => {
    expect(rejection(G({ a: { type: 'text', design: { attributes: 'x' } } }))).toBe('Invalid design.attributes at a: expected an object');
    expect(rejection(G({ a: { type: 'text', design: { wrapper: { attributes: [] } } } }))).toBe('Invalid design.wrapper.attributes at a: expected an object');
  });

  it('rejects an event, uppercase, empty or crudui-owned name before any value', () => {
    const message = (name: string, key = 'design.attributes') => `Invalid ${key}.${name} at a: expected a data-* or aria-* name that crudui does not write`;
    for (const name of ['onclick', 'class', 'data-Key', 'data-', 'aria-', 'data-name', 'data-rule-name', 'data-default', 'data-field-path', 'data-crudui-row-key', 'data-source-model', 'data-is-default']) {
      expect(rejection(G({ a: { type: 'text', design: { attributes: { 'data-ok': 1, [name]: 'x' } } } }))).toBe(message(name));
    }
    expect(rejection(G({ a: { type: 'text', design: { wrapper: { attributes: { 'data-lang': 'x' } } } } }))).toBe(message('data-lang', 'design.wrapper.attributes'));
  });

  it('rejects a value that is not a string', () => {
    expect(rejection(G({ a: { type: 'text', design: { attributes: { 'data-x': 'ok', 'aria-hidden': true } } } })))
      .toBe('Invalid design.attributes.aria-hidden at a: expected a string');
  });

  it('accepts attributes only on form fields and the wrapper node', () => {
    expect(rejection(G({ a: { type: 'text', design: { label: { attributes: {} } } } }))).toBe('Invalid design.label.attributes at a: unknown key');
    expect(rejection({ ...G({ a: { type: 'text' } }), buttons: [{ type: 'submit', design: { attributes: { 'data-x': '1' } } }] }))
      .toBe('Invalid design.attributes at form.buttons.0: unknown key');
    expect(() => buildList({ columns: { a: { field: 'a', design: { attributes: { 'data-x': '1' } } } } }, []))
      .toThrow('Invalid design.attributes at columns.a: unknown key');
    expect(bindButtons(compileForm(G({ a: { type: 'text' } })))).toHaveLength(1);
  });
});
