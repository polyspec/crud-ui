// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, expect, test } from 'vitest';
import { bindForm, compileForm, connectForm, createForm, type NodeVM, type WidgetModel } from './index';

/** The widget of a field node that a supported widget type renders. */
const widgetOf = (node: NodeVM): WidgetModel => {
  const widget = node.widget;
  assert(widget && !('unsupported' in widget), `${node.path ?? ''} has a widget`);
  return widget;
};

/**
 * connectForm().sync() writes the live value of a control from the form value. It must write the
 * string that the server render writes for the same value: the widget evaluators of widget.ts
 * convert a value with phpString of util.ts (applyDefaultString for a text value, effectiveValue
 * for a choice), so true is '1', false is '' and an object or array is ''.
 */
describe('connectForm writes the same control value as the server render', () => {
  const template = compileForm({ type: 'group', properties: {
    yes: { type: 'text' }, no: { type: 'text' }, object: { type: 'text' }, note: { type: 'textarea' },
    choice: { type: 'radio', items: { '1': 'One', '': 'None' } },
  } }, { keyPrefix: 'form' });

  test.each([
    ['true', true],
    ['false', false],
    ['an object', { x: 1 }],
  ])('a text, textarea and radio control of %s', (_name, value) => {
    const data = { yes: value, no: value, object: value, note: value, choice: value };
    const server = bindForm(template, data);
    const element = document.createElement('div');
    element.innerHTML = '<input type="text" name="form[yes]"><input type="text" name="form[no]">'
      + '<input type="text" name="form[object]"><textarea name="form[note]"></textarea>'
      + '<input type="radio" name="form[choice]" value="1"><input type="radio" name="form[choice]" value="">';
    document.body.append(element);
    const connection = connectForm(element, createForm(template, data));
    const controls = Array.from(element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type=text],textarea'));
    expect(controls.map(control => control.value)).toEqual(server.slice(0, 4).map(widgetOf).map(widget =>
      widget.tag === 'textarea' ? widget.text : widget.attrs.value));
    const radios = Array.from(element.querySelectorAll<HTMLInputElement>('input[type=radio]'));
    expect(radios.map(radio => radio.checked)).toEqual((widgetOf(server[4]).options ?? []).map(option => option.selected));
    connection.disconnect();
    element.remove();
  });
});

/**
 * A condition control holds the condition text of its tree, and connectForm reads it back as its
 * decoded value (docs/spec/form-runtime.md, Condition values).
 */
describe('connectForm decodes the text of a condition control', () => {
  const template = compileForm({ type: 'group', properties: {
    pass: { type: 'condition', validate: { conditionTree: 'judge' } },
  } }, { keyPrefix: 'form' });
  const tree = { any: [{ field: 'clues.size', op: 'ge', value: 2 }, { judge: 'Jian "finds" it.' }] };

  const connected = (data: Record<string, unknown>) => {
    const element = document.createElement('div');
    element.innerHTML = '<textarea name="form[pass]" data-crudui-value="json"></textarea>';
    document.body.append(element);
    const form = createForm(template, data);
    const connection = connectForm(element, form);
    const control = element.querySelector('textarea');
    assert(control);
    const type = (text: string) => {
      control.value = text;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      connection.sync();
    };
    const done = () => { connection.disconnect(); element.remove(); };
    return { form, control, type, sync: () => connection.sync(), done };
  };

  test('the control holds the condition text of the tree, as the server render writes it', () => {
    const { control, done } = connected({ pass: tree });
    expect(control.value).toBe(widgetOf(bindForm(template, { pass: tree })[0]).text);
    expect(control.value).toBe(JSON.stringify(tree));
    done();
  });

  test('a typed JSON text sets the tree, and the control keeps the typed text', () => {
    const { form, control, type, done } = connected({});
    const typed = '{ "all": [ { "field": "a", "op": "eq", "value": 1 } ] }';
    type(typed);
    expect(form.getData()).toEqual({ pass: { all: [{ field: 'a', op: 'eq', value: 1 }] } });
    expect(control.value).toBe(typed);
    done();
  });

  test('a text that is no JSON text is the value itself', () => {
    const { form, type, done } = connected({ pass: tree });
    type('{"all": [');
    expect(form.getData()).toEqual({ pass: '{"all": [' });
    type('');
    expect(form.getData()).toEqual({ pass: '' });
    done();
  });

  test('new data writes the condition text of its tree into the control', () => {
    const { form, control, type, sync, done } = connected({ pass: tree });
    type('{"all": []}');
    form.setData({ pass: { any: [] } });
    sync();
    expect(control.value).toBe('{"any":[]}');
    form.setData({ pass: null });
    sync();
    expect(control.value).toBe('');
    done();
  });
});
