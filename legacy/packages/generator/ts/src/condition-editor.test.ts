// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, expect, test } from 'vitest';
import { bindForm, compileForm, connectForm, createForm } from './index';
import { widgetRootHtml } from './raw-markup';

/**
 * connectForm rewrites the tree of a structured condition field through the controls and buttons of
 * its editor (docs/spec/form-runtime.md, Condition values; docs/spec/form-markup.md, Structured condition editor).
 */
describe('connectForm edits the tree through the structured condition editor', () => {
  const spec = (fields?: string[]): Record<string, unknown> => ({ type: 'group', properties: {
    pass: {
      type: 'condition', design: { editor: 'structured' }, validate: { conditionTree: 'judge' },
      ...(fields ? { options: { fields } } : {}),
    },
  } });

  /** The server markup of the field, connected to a form of `data`; each step renders the editor again. */
  const connected = (data: Record<string, unknown>, fields?: string[]) => {
    const template = compileForm(spec(fields), { keyPrefix: 'form' });
    const form = createForm(template, data);
    const element = document.createElement('div');
    const render = () => {
      const widget = bindForm(template, form.getData())[0]?.widget;
      assert(widget);
      element.innerHTML = widgetRootHtml(widget) ?? '';
    };
    render();
    document.body.append(element);
    const connection = connectForm(element, form);
    const at = (path: string, selector: string) => {
      const condition = Array.from(element.querySelectorAll<HTMLElement>('[data-condition-path]'))
        .find(candidate => candidate.getAttribute('data-condition-path') === path);
      const found = condition && Array.from(condition.querySelectorAll<HTMLElement>(selector))
        .find(control => control.closest('[data-condition-path]') === condition);
      assert(found, `${selector} at ${path}`);
      return found;
    };
    const click = (path: string, action: string) => {
      at(path, `[data-condition-action="${action}"]`).click();
      connection.sync();
      render();
    };
    const set = (path: string, part: string, text: string) => {
      const control = at(path, `[data-condition-part="${part}"]`);
      assert(control instanceof HTMLInputElement || control instanceof HTMLSelectElement, `${part} at ${path} is a control`);
      control.value = text;
      control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      connection.sync();
      render();
    };
    const done = () => { connection.disconnect(); element.remove(); };
    return { form, element, click, set, done };
  };

  test('the buttons of an empty value add a comparison, a group and a judged text to the root all group', () => {
    const { form, click, done } = connected({});
    click('', 'add-comparison');
    expect(form.getData()).toEqual({ pass: { all: [{ field: '', op: 'eq', value: '' }] } });
    click('', 'add-group');
    click('/all/1', 'add-judge');
    expect(form.getData()).toEqual({ pass: { all: [{ field: '', op: 'eq', value: '' }, { all: [{ judge: '' }] }] } });
    done();
  });

  test('a new comparison names the first of options.fields', () => {
    const { form, click, done } = connected({ pass: { any: [] } }, ['score', 'clues.size']);
    click('', 'add-comparison');
    expect(form.getData()).toEqual({ pass: { any: [{ field: 'score', op: 'eq', value: '' }] } });
    done();
  });

  test('the controls rename the mode and set the field, the op, the decoded value and the judged text', () => {
    const { form, set, done } = connected({ pass: { all: [{ field: 'a', op: 'eq', value: 1 }, { judge: '' }] } });
    set('', 'mode', 'any');
    set('/any/0', 'field', 'clues.size');
    set('/any/0', 'value', '2');
    set('/any/1', 'judge', 'Jian "finds" it.');
    expect(form.getData()).toEqual({ pass: { any: [{ field: 'clues.size', op: 'eq', value: 2 }, { judge: 'Jian "finds" it.' }] } });
    set('/any/0', 'op', 'in');
    expect(form.getData()).toEqual({ pass: { any: [{ field: 'clues.size', op: 'in', value: [2] }, { judge: 'Jian "finds" it.' }] } });
    set('/any/0', 'value', '[2,3]');
    set('/any/0', 'op', 'ge');
    expect(form.getData()).toEqual({ pass: { any: [{ field: 'clues.size', op: 'ge', value: 2 }, { judge: 'Jian "finds" it.' }] } });
    done();
  });

  test('an empty value becomes an empty list when the op turns to in, and an empty list the empty text back', () => {
    const { form, set, done } = connected({ pass: { all: [{ field: 'a', op: 'eq', value: '' }] } });
    set('/all/0', 'op', 'in');
    expect(form.getData()).toEqual({ pass: { all: [{ field: 'a', op: 'in', value: [] }] } });
    set('/all/0', 'op', 'ne');
    expect(form.getData()).toEqual({ pass: { all: [{ field: 'a', op: 'ne', value: '' }] } });
    done();
  });

  test('remove takes a condition out of its group', () => {
    const { form, element, click, done } = connected({ pass: { all: [{ judge: 'x' }, { any: [{ field: 'a', op: 'eq', value: 1 }] }] } });
    click('/all/1/any/0', 'remove');
    expect(form.getData()).toEqual({ pass: { all: [{ judge: 'x' }, { any: [] }] } });
    click('/all/0', 'remove');
    expect(form.getData()).toEqual({ pass: { all: [{ any: [] }] } });
    expect(element.querySelector('fieldset[data-condition-path=""] > [data-condition-action="remove"]')).toBeNull();
    done();
  });

  test('the textarea keeps the condition text of the edited tree', () => {
    const { element, click, done } = connected({});
    click('', 'add-group');
    expect(element.querySelector('textarea')?.value).toBe('{"all":[{"all":[]}]}');
    done();
  });
});
