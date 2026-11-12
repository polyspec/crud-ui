import { describe, expect, it } from 'vitest';
import assert from 'node:assert/strict';
import { bindForm, compileForm, type NodeVM } from './index';

// Switches (docs/spec/form-markup.md, Switches).
const field = (spec: Record<string, unknown>, data: Record<string, unknown> = {}): NodeVM =>
  bindForm(compileForm({ type: 'group', properties: { on: spec } }), data, { language: 'en' })[0];

describe('switch model', () => {
  it('gives a switcher the switch role and the switch class', () => {
    expect(field({ type: 'switcher', label: 'Sync', design: { class: 'wide' } }, { on: true }).checkbox).toEqual({
      id: 'crudui:on',
      name: 'on',
      className: 'valid-target crudui-input crudui-input--switch wide',
      checked: true,
      role: 'switch',
      caption: 'Sync',
    });
  });

  it('keeps the declared attributes of the switch input after the caption', () => {
    const box = field({ type: 'switcher', label: 'Sync', design: { attributes: { 'data-setting': 'sync', 'aria-describedby': 'sync-help' } } }).checkbox;
    assert(box, 'the switcher has a checkbox');
    expect(Object.keys(box)).toEqual(['id', 'name', 'className', 'checked', 'role', 'caption', 'attributes']);
    expect(box.attributes).toEqual({ 'data-setting': 'sync', 'aria-describedby': 'sync-help' });
  });

  it('keeps a checkbox without a role and without the switch class', () => {
    expect(field({ type: 'checkbox', label: 'Agree' }).checkbox).toEqual({
      id: 'crudui:on',
      name: 'on',
      className: 'valid-target',
      checked: false,
      caption: 'Agree',
    });
  });
});
