import { describe, expect, it } from 'vitest';
import { bindForm, compileForm, sequenceRowKey, type WidgetModel } from './index';
import { childrenOf, present } from './test-support';

const key = sequenceRowKey(7);
const options = { idPrefix: "form scope:'한글", keyPrefix: 'form' };

describe('display field defaults', () => {
  for (const type of ['dummy', 'html', 'static']) {
    it(`${type} applies a default only for missing data, including zero defaults`, () => {
      for (const defaultValue of ['default', 0]) {
        const template = compileForm({ type: 'group', properties: { value: { type, default: defaultValue } } });
        expect(bindForm(template, {})[0].widget).toMatchObject({ rawHtml: String(defaultValue) });
        expect(bindForm(template, { value: null })[0].widget).toMatchObject({ rawHtml: '' });
        expect(bindForm(template, { value: '' })[0].widget).toMatchObject({ rawHtml: '' });
      }
    });
  }
});

function repeatedWidget(type: string, multipleLeaf = false): WidgetModel {
  const field = { type, items: { a: 'A', b: 'B' }, options: { callback: 'onSelect' } };
  const spec = { type: 'group', properties: {
    rows: multipleLeaf ? { ...field, multiple: true } : {
      type: 'group', multiple: true, properties: { value: field },
    },
  } };
  const data = { rows: { [key]: multipleLeaf ? 'a' : { value: 'a' } } };
  const row = childrenOf(bindForm(compileForm(spec), data, options)[0])[0];
  const widget = present(multipleLeaf ? row.widget : childrenOf(row)[0].widget, 'the widget');
  if ('unsupported' in widget) throw new Error('The fixture requires a supported widget');
  return widget;
}

describe('widget paths in keyed rows', () => {
  for (const type of ['choice', 'multichoice', 'image', 'file', 'cover', 'search']) {
    it(`${type} uses structural group rule paths and actual submission keys`, () => {
      const widget = repeatedWidget(type);
      const controls = [widget.attrs, ...Object.values(widget.extra ?? {})]
        .filter(attrs => 'data-rule-name' in attrs);
      expect(controls.length).toBeGreaterThan(0);
      for (const attrs of controls) {
        expect(attrs['data-rule-name']).toBe('rows[][value]');
        expect(attrs['data-name']).toBe('value');
        expect(attrs.name).toContain(`[${key}][value]`);
      }
    });

    it(`${type} uses the collection name for repeated scalar values`, () => {
      const widget = repeatedWidget(type, true);
      const controls = [widget.attrs, ...Object.values(widget.extra ?? {})]
        .filter(attrs => 'data-rule-name' in attrs);
      expect(controls.length).toBeGreaterThan(0);
      for (const attrs of controls) {
        expect(attrs['data-rule-name']).toBe('rows[]');
        expect(attrs['data-name']).toBe('rows[]');
      }
    });
  }
});

describe('widget script targets', () => {
  for (const type of ['search', 'tinymce', 'summernote', 'editorjs', 'tui', 'tagify', 'tagify2']) {
    it(`${type} uses its scoped control ID in its script`, () => {
      const widget = repeatedWidget(type);
      const id = `${encodeURIComponent(options.idPrefix)}:${encodeURIComponent(`rows.${key}.value`)}`;
      expect(widget.attrs.id).toBe(id);
      expect(widget.script).toContain(JSON.stringify(id));
    });
  }
});
