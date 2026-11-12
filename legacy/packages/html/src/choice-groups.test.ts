/**
 * Choice groups (docs/spec/form-markup.md, Choice groups): the HTML renderer writes the choices of
 * each group of a select field as the options of one `optgroup` element, in written order.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from './index';

const render = (field: Record<string, unknown>, data: Record<string, unknown> = {}) =>
  renderForm(createForm(compileForm({ type: 'group', properties: { region: field } }), data, { language: 'en' }));
const europe = { label: 'Europe & more', choices: [{ value: 'eu-west', label: 'West' }, { value: 'eu-north', label: 'North' }] };
const asia = { label: 'Asia', choices: [{ value: 'ap-east', label: 'East' }] };

describe('choice group bytes of the HTML renderer', () => {
  test('a list made only of groups writes one optgroup per group', () => {
    expect(render({ type: 'select', items: [europe, asia] })).toContain(
      '<optgroup label="Europe &amp; more"><option value="eu-west">West</option><option value="eu-north">North</option></optgroup>' +
      '<optgroup label="Asia"><option value="ap-east">East</option></optgroup></select>');
  });

  test('plain choices and groups keep the written order and the value selects an option in a group', () => {
    expect(render({ type: 'select', items: [{ value: 'auto', label: 'Automatic' }, europe, { value: 'off', label: 'Off' }] }, { region: 'eu-north' })).toContain(
      '><option value="auto">Automatic</option><optgroup label="Europe &amp; more"><option value="eu-west">West</option>' +
      '<option value="eu-north" selected="">North</option></optgroup><option value="off">Off</option></select>');
  });

  test('a select with a behavior attribute writes the groups raw', () => {
    expect(render({ type: 'select', items: [asia], behavior: { onchange: 'go()' } })).toContain(
      '><optgroup label="Asia"><option value="ap-east">East</option></optgroup></select>');
  });
});
