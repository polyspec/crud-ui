/**
 * Layout (docs/spec/form-markup.md, Layout): in an inline layout, a checkbox or switcher field with
 * a label writes the label in the header and the input alone in the body; outside an inline layout
 * the caption label stays in the body.
 */
import { describe, expect, test } from 'vitest';
import { compileForm } from '@polyspec/crudui-generator-core';
import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { renderFields } from '../src/internal/renderFields.ts';

const render = async (layout) => normalizeHtml(await renderFields(compileForm({
  type: 'group',
  properties: { look: { type: 'group', design: { layout }, properties: { sync: { type: 'switcher', label: 'Sync', description: 'Keeps every window in step.' } } } },
}), { language: 'en', data: {} }));

describe('inline layout output', () => {
  test('a switcher of an inline group writes its label in the header and the input alone in the body', async () => {
    expect(await render('inline')).toContain(
      '<div class="crudui-node crudui-node--field crudui-node--inline" data-field-path="look.sync"><div class="crudui-node__header">' +
      '<label class="crudui-node__label" for="crudui:look.sync">Sync</label><p class="crudui-node__description">Keeps every window in step.</p></div>' +
      '<div class="crudui-node__body"><input class="valid-target crudui-input crudui-input--switch" id="crudui:look.sync" name="look[sync]" role="switch" type="checkbox" value="1"></div></div>');
  });

  test('a switcher outside an inline layout keeps its caption label in the body', async () => {
    expect(await render('stacked')).toContain(
      '<input class="valid-target crudui-input crudui-input--switch" id="crudui:look.sync" name="look[sync]" role="switch" type="checkbox" value="1"><label for="crudui:look.sync">Sync</label></div>');
  });
});
