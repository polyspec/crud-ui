/**
 * Switches (docs/spec/form-markup.md, Switches): the HTML renderer writes a switcher as a checkbox
 * input with the switch role and the switch class, with the input attribute placement of React's
 * server rendering.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from './index';

const render = (field: Record<string, unknown>, data: Record<string, unknown> = {}) =>
  renderForm(createForm(compileForm({ type: 'group', properties: { on: field } }), data, { language: 'en' }));

describe('switch bytes of the HTML renderer', () => {
  test('a switcher writes a checkbox input with the switch role', () => {
    expect(render({ type: 'switcher', label: 'Sync' }, { on: true })).toContain(
      '<div class="crudui-node__body"><input class="valid-target crudui-input crudui-input--switch" id="crudui:on" type="checkbox" role="switch" name="on" checked="" value="1"/>' +
      '<label for="crudui:on">Sync</label></div>');
  });

  test('a switcher writes its declared attributes after the role', () => {
    expect(render({ type: 'switcher', label: 'Sync', design: { attributes: { 'data-setting': 'sync' } } })).toContain(
      '<input class="valid-target crudui-input crudui-input--switch" id="crudui:on" type="checkbox" role="switch" data-setting="sync" name="on" value="1"/>');
  });

  test('a checkbox writes no role', () => {
    expect(render({ type: 'checkbox', label: 'Agree' })).toContain(
      '<input class="valid-target" id="crudui:on" type="checkbox" name="on" value="1"/><label for="crudui:on">Agree</label>');
  });
});
