/**
 * Layout (docs/spec/form-markup.md, Layout): the HTML renderer writes the inline and line
 * modifiers of the node model on the node roots.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from './index';

const render = (properties: Record<string, unknown>) =>
  renderForm(createForm(compileForm({ type: 'group', properties }), {}, { language: 'en' }));

describe('layout bytes of the HTML renderer', () => {
  const html = () => render({
    look: {
      type: 'group',
      label: 'Look',
      design: { layout: 'inline' },
      properties: {
        theme: { type: 'text', label: 'Theme', description: 'Applies to every window.' },
        font: { type: 'group', label: 'Font', design: { layout: 'line' }, properties: { family: { type: 'text' } } },
      },
    },
  });

  test('a field node of an inline group writes the inline modifier', () => {
    expect(html()).toContain(
      '<div class="crudui-node crudui-node--field crudui-node--inline" data-field-path="look.theme"><div class="crudui-node__header">' +
      '<label class="crudui-node__label" for="crudui:look.theme">Theme</label><p class="crudui-node__description">Applies to every window.</p></div>');
  });

  test('a line group writes the line modifier and its children write none', () => {
    expect(html()).toContain(
      '<div class="crudui-node crudui-node--group crudui-node--inline crudui-node--line" data-field-path="look.font"><div class="crudui-node__header">' +
      '<span class="crudui-node__label">Font</span></div><div class="crudui-node__body"><div class="crudui-node crudui-node--field" data-field-path="look.font.family">');
  });

  test('a checkbox or switcher of an inline group writes its label in the header and the input alone in the body', () => {
    const inline = render({
      look: {
        type: 'group',
        design: { layout: 'inline' },
        properties: {
          sync: { type: 'switcher', label: 'Sync', description: 'Keeps every window in step.' },
          agree: { type: 'checkbox', label: 'Agree' },
        },
      },
    });
    expect(inline).toContain(
      '<div class="crudui-node crudui-node--field crudui-node--inline" data-field-path="look.sync"><div class="crudui-node__header">' +
      '<label class="crudui-node__label" for="crudui:look.sync">Sync</label><p class="crudui-node__description">Keeps every window in step.</p></div>' +
      '<div class="crudui-node__body"><input class="valid-target crudui-input crudui-input--switch" id="crudui:look.sync" type="checkbox" role="switch" name="look[sync]" value="1"/></div></div>');
    expect(inline).toContain(
      '<div class="crudui-node crudui-node--field crudui-node--inline" data-field-path="look.agree"><div class="crudui-node__header">' +
      '<label class="crudui-node__label" for="crudui:look.agree">Agree</label></div>' +
      '<div class="crudui-node__body"><input class="valid-target" id="crudui:look.agree" type="checkbox" name="look[agree]" value="1"/></div></div>');
  });

  test('a switcher outside an inline layout keeps its caption label in the body', () => {
    expect(render({ sync: { type: 'switcher', label: 'Sync' } })).toContain(
      '<div class="crudui-node__body"><input class="valid-target crudui-input crudui-input--switch" id="crudui:sync" type="checkbox" role="switch" name="sync" value="1"/>' +
      '<label for="crudui:sync">Sync</label></div>');
  });
});
