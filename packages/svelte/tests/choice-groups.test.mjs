/**
 * Choice groups (docs/spec/form-markup.md, Choice groups): a select field writes the choices of
 * each group as the options of one `optgroup` element, in written order.
 */
import { describe, expect, test } from 'vitest';
import { compileForm } from '@polyspec/crudui-generator-core';
import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { renderFields } from '../src/internal/renderFields.ts';

const render = async (field, data = {}) => normalizeHtml(renderFields(compileForm({ type: 'group', properties: { region: field } }), { language: 'en', data }));
const europe = { label: 'Europe & more', choices: [{ value: 'eu-west', label: 'West' }, { value: 'eu-north', label: 'North' }] };
const asia = { label: 'Asia', choices: [{ value: 'ap-east', label: 'East' }] };

describe('choice group output', () => {
  test('plain choices and groups keep the written order and the value selects an option in a group', async () => {
    expect(await render({ type: 'select', items: [{ value: 'auto', label: 'Automatic' }, europe, asia] }, { region: 'eu-north' })).toContain(
      '><option value="auto">Automatic</option><optgroup label="Europe &amp; more"><option value="eu-west">West</option>' +
      '<option selected="" value="eu-north">North</option></optgroup><optgroup label="Asia"><option value="ap-east">East</option></optgroup></select>');
  });

  test('a list made only of groups writes them raw with a behavior attribute', async () => {
    expect(await render({ type: 'select', items: [europe, asia], behavior: { onchange: 'go()' } })).toContain(
      '><optgroup label="Europe &amp; more"><option value="eu-west">West</option><option value="eu-north">North</option></optgroup>' +
      '<optgroup label="Asia"><option value="ap-east">East</option></optgroup></select>');
  });
});
