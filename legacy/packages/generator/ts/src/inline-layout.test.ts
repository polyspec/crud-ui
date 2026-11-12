import { describe, expect, it } from 'vitest';
import { FormInputError } from '@polyspec/crudui-validator';
import { bindForm, compileForm, type NodeVM } from './index';
import { childrenOf, present } from './test-support';

// Layout (docs/spec/schema.md, Layout; docs/spec/form-markup.md, Layout).
const G = (properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ type: 'group', ...extra, properties });
const nodes = (spec: Record<string, unknown>, data: Record<string, unknown> = {}): NodeVM[] =>
  bindForm(compileForm(spec), data, { language: 'en' });
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
const classes = (node: NodeVM): string => node.className;

describe('layout in the node model', () => {
  const settings = G({
    look: {
      type: 'group',
      label: 'Look',
      design: { layout: 'inline', wrapper: { class: 'section' } },
      properties: {
        theme: { type: 'text', label: 'Theme', design: { wrapper: { class: 'wide' } } },
        bare: { type: 'text' },
        font: {
          type: 'group',
          label: 'Font',
          design: { layout: 'line' },
          properties: { family: { type: 'text' }, size: { type: 'text' } },
        },
        nested: { type: 'group', properties: { deep: { type: 'checkbox', label: 'Deep' } } },
        plain: { type: 'group', design: { layout: 'stacked' }, properties: { flat: { type: 'text' } } },
        names: { type: 'text', lang: { only: ['en'] } },
      },
    },
    outside: { type: 'text' },
  });

  it('marks every field node of an inline group, at any depth, with the inline modifier', () => {
    const [look, outside] = nodes(settings);
    const [theme, bare, font, nested, plain, names] = childrenOf(look);
    expect(classes(look)).toBe('section');
    expect(classes(theme)).toBe('crudui-node--inline wide');
    expect(classes(bare)).toBe('crudui-node--inline');
    expect(classes(nested)).toBe('');
    expect(classes(childrenOf(nested)[0])).toBe('crudui-node--inline');
    expect(classes(names)).toBe('crudui-node--framed');
    expect(classes(outside)).toBe('');
    expect(classes(plain)).toBe('');
    expect(classes(childrenOf(plain)[0])).toBe('');
    expect(classes(font)).toBe('crudui-node--inline crudui-node--line');
    expect(childrenOf(font).map(classes)).toEqual(['', '']);
  });

  it('lays out a line group outside an inline layout without the inline modifier', () => {
    const [line] = nodes(G({ actions: { type: 'group', design: { layout: 'line' }, properties: { a: { type: 'text' } } } }));
    expect(classes(line)).toBe('crudui-node--line');
  });

  it('applies an inline repeated group to the fields of its rows', () => {
    const [rows] = nodes(G({ rows: { type: 'group', multiple: true, design: { layout: 'inline' }, properties: { name: { type: 'text' } } } }),
      { rows: { a: { name: 'x' } } });
    expect(classes(rows)).toBe('');
    expect(classes(childrenOf(rows)[0])).toBe('');
    expect(classes(childrenOf(childrenOf(rows)[0])[0])).toBe('crudui-node--inline');
  });
});

describe('layout declaration checks', () => {
  it('accepts design.layout only on a group field', () => {
    expect(rejection(G({ a: { type: 'text', design: { layout: 'inline' } } }))).toBe('Invalid design.layout at a: unknown key');
    expect(rejection(G({ a: { type: 'text' } }, { design: { layout: 'inline' } }))).toBe('Invalid design.layout at form: unknown key');
    expect(rejection({ ...G({ a: { type: 'text' } }), buttons: [{ type: 'submit', design: { layout: 'inline' } }] }))
      .toBe('Invalid design.layout at form.buttons.0: unknown key');
  });

  it('accepts stacked, inline or line, and no line on a repeated group', () => {
    expect(rejection(G({ a: { type: 'group', design: { layout: 'grid' }, properties: {} } })))
      .toBe('Invalid design.layout at a: expected stacked, inline or line');
    expect(rejection(G({ a: { type: 'group', design: { layout: { '.wide': 'inline' } }, properties: {} } })))
      .toBe('Invalid design.layout at a: expected stacked, inline or line');
    expect(rejection(G({ a: { type: 'group', multiple: true, design: { layout: 'line' }, properties: {} } })))
      .toBe('Invalid design.layout at a: expected stacked or inline');
  });
});

describe('checkbox and switcher labels in an inline layout', () => {
  const look = (properties: Record<string, unknown>, layout = 'inline') =>
    childrenOf(nodes(G({ look: { type: 'group', design: { layout }, properties } }))[0]);

  it('writes the label of a checkbox or switcher in the header and leaves the input without a caption', () => {
    const [sync, agree] = look({
      sync: { type: 'switcher', label: 'Sync', description: 'Keeps every window in step.' },
      agree: { type: 'checkbox', label: 'Agree' },
    });
    expect(sync.header).toEqual({ className: '', label: 'Sync', labelFor: 'crudui:look.sync', description: 'Keeps every window in step.' });
    expect(sync.checkbox).toEqual({
      id: 'crudui:look.sync',
      name: 'look[sync]',
      className: 'valid-target crudui-input crudui-input--switch',
      checked: false,
      role: 'switch',
    });
    expect(agree.header).toEqual({ className: '', label: 'Agree', labelFor: 'crudui:look.agree' });
    expect(agree.checkbox).toEqual({ id: 'crudui:look.agree', name: 'look[agree]', className: 'valid-target', checked: false });
  });

  it('keeps the caption of a checkbox without a label and of every checkbox outside an inline layout', () => {
    const [bare] = look({ bare: { type: 'checkbox' } });
    expect(bare.header).toBeUndefined();
    expect(present(bare.checkbox, 'the bare checkbox').caption).toBe('');
    const [sync] = look({ sync: { type: 'switcher', label: 'Sync', description: 'Help' } }, 'stacked');
    expect(sync.header).toEqual({ className: '', description: 'Help' });
    expect(present(sync.checkbox, 'the sync checkbox').caption).toBe('Sync');
  });
});
