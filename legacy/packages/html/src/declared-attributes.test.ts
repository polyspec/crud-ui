/**
 * Declared attributes (docs/spec/form-markup.md, Declared attributes): the HTML renderer writes
 * them after the attributes crudui writes, with the placement of `style`, `name`, `checked` and
 * `value` that React's server rendering, the reference serialization, gives them, and after
 * `hidden` on a node root.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from './index';

const render = (field: Record<string, unknown>, data: Record<string, unknown> = {}) =>
  renderForm(createForm(compileForm({ type: 'group', properties: { theme: field } }), data, { language: 'en' }));

describe('declared attribute bytes of the HTML renderer', () => {
  test('a text control writes them before name and value', () => {
    expect(render({ type: 'text', design: { attributes: { 'data-setting': 'theme', 'aria-describedby': 'theme-help' } } })).toContain(
      '<input type="text" class="valid-target crudui-input" data-name="theme" data-rule-name="theme" data-default="" id="crudui:theme" data-setting="theme" aria-describedby="theme-help" name="theme" value=""/>');
  });

  test('a control with a behavior attribute writes them last', () => {
    expect(render({ type: 'text', behavior: { onchange: 'save(this)' }, design: { style: 'color: red', attributes: { 'data-setting': 'theme' } } })).toContain(
      '<input type="text" name="theme" value="" class="valid-target crudui-input" style="color: red" onchange="save(this)" data-name="theme" data-rule-name="theme" data-default="" id="crudui:theme" data-setting="theme">');
  });

  test('a node root writes them after hidden', () => {
    expect(render({ type: 'text', design: { show: false, wrapper: { attributes: { 'data-section': 'look', 'aria-label': 'Look & feel' } } } })).toContain(
      '<div class="crudui-node crudui-node--field" data-field-path="theme" hidden="" data-section="look" aria-label="Look &amp; feel">');
  });

  test('a checkbox writes them before name, checked and value', () => {
    expect(render({ type: 'checkbox', label: 'Dark', design: { attributes: { 'aria-describedby': 'help' } } }, { theme: true })).toContain(
      '<input class="valid-target" id="crudui:theme" type="checkbox" aria-describedby="help" name="theme" checked="" value="1"/>');
  });

  test('an option input writes them before name, checked and value', () => {
    expect(render({ type: 'choice', items: { a: 'A' }, design: { attributes: { 'data-x': '1' } } }, { theme: 'a' })).toContain(
      '<input data-name="theme" data-rule-name="theme" type="radio" autoComplete="off" class="valid-target crudui-choices__input" id="crudui:theme:0" data-is-default="" data-x="1" name="theme" checked="" value="a"/>');
  });

  test('an option input with behavior attributes writes them after checked', () => {
    expect(render({ type: 'choice', items: { a: 'A' }, behavior: { onchange: 'go()' }, design: { attributes: { 'data-x': '1' } } }, { theme: 'a' })).toContain(
      '<input name="theme" data-name="theme" data-rule-name="theme" onchange="go()" type="radio" value="a" autocomplete="off" class="valid-target crudui-choices__input" id="crudui:theme:0" data-is-default="" checked="" data-x="1">');
  });

  test('a file input writes them after its id', () => {
    expect(render({ type: 'image', design: { attributes: { 'data-x': '1' } } })).toContain(
      '<input type="file" class="valid-target crudui-input crudui-input--file" data-max-width="0" data-min-width="0" data-max-height="0" data-min-height="0" data-preview-max-width="0" data-preview-max-height="0" data-name="theme" data-rule-name="theme" accept="image/*" id="crudui:theme" data-x="1" name="theme" value=""/>');
  });

  test('a display div writes them before its style', () => {
    expect(render({ type: 'dummy', design: { class: 'note', style: 'color: gray', attributes: { 'aria-live': 'polite' } } }, { theme: 'Ready' })).toContain(
      '<div class="note" aria-live="polite" style="color:gray">Ready</div>');
  });

  test('row and language controls take the control attributes and their nodes take none', () => {
    const rows = render({ type: 'text', multiple: true, design: { attributes: { 'data-x': '1' }, wrapper: { attributes: { 'data-y': '2' } } } }, { theme: { __a__: 'p' } });
    expect(rows).toContain('<div class="crudui-node crudui-node--collection" data-field-path="theme" data-y="2">');
    expect(rows).toContain('<div class="crudui-node crudui-node--row" data-crudui-row-key="__a__">');
    expect(rows).toContain('id="crudui:theme.__a__" data-x="1" name="theme[__a__]"');
    const lang = render({ type: 'text', lang: { only: ['en'] }, design: { attributes: { 'data-x': '1' } } });
    expect(lang).toContain('<div class="crudui-node crudui-node--lang-item" data-lang="en">');
    expect(lang).toContain('id="crudui:theme.en" data-x="1" name="theme[en]"');
  });
});
