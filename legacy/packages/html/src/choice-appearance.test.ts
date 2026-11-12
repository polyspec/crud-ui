/**
 * Choice appearance (docs/spec/form-markup.md, Choice appearance): the HTML renderer writes the
 * class and style of each choice on its label after the label class, its attributes on its input
 * after the field's control attributes, and design.group on the choices element.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from './index';

const render = (field: Record<string, unknown>, data: Record<string, unknown> = {}) =>
  renderForm(createForm(compileForm({ type: 'group', properties: { accent: field } }), data, { language: 'en' }));
const swatches = [
  { value: 'blue', label: 'Blue', class: 'swatch', style: '--swatch-bg: #1d4ed8', attributes: { 'aria-label': 'Blue accent' } },
  { value: 'green', label: 'Green', class: 'swatch', style: '--swatch-bg: #15803d' },
];

describe('choice appearance bytes of the HTML renderer', () => {
  test('a choice field writes each choice appearance and the choices class', () => {
    expect(render({ type: 'choice', items: swatches, design: { class: 'large', attributes: { 'data-setting': 'accent' }, group: { class: 'swatches' } } }, { accent: 'green' })).toContain(
      '<div class="crudui-choices swatches">' +
      '<input data-name="accent" data-rule-name="accent" type="radio" autoComplete="off" class="valid-target crudui-choices__input" id="crudui:accent:0" data-is-default="" data-setting="accent" aria-label="Blue accent" name="accent" value="blue"/>' +
      '<label for="crudui:accent:0" class="crudui-choices__label large swatch" style="--swatch-bg:#1d4ed8"><span>Blue</span></label>' +
      '<input data-name="accent" data-rule-name="accent" type="radio" autoComplete="off" class="valid-target crudui-choices__input" id="crudui:accent:1" data-is-default="" data-setting="accent" name="accent" checked="" value="green"/>' +
      '<label for="crudui:accent:1" class="crudui-choices__label large swatch" style="--swatch-bg:#15803d"><span>Green</span></label></div>');
  });

  test('a choice field with behavior attributes writes the appearance raw', () => {
    expect(render({ type: 'choice', items: [swatches[0]], behavior: { onchange: 'go()' } })).toContain(
      '<input name="accent" data-name="accent" data-rule-name="accent" onchange="go()" type="radio" value="blue" autocomplete="off" class="valid-target crudui-choices__input" id="crudui:accent:0" data-is-default="" aria-label="Blue accent">' +
      '<label for="crudui:accent:0" class="crudui-choices__label swatch" style="--swatch-bg: #1d4ed8"><span>Blue</span></label>');
  });

  test('a multichoice field writes the choices style', () => {
    expect(render({ type: 'multichoice', items: swatches, design: { group: { style: 'display: grid' } } })).toContain(
      '<div class="crudui-choices crudui-choices--multiple" style="display:grid">');
  });
});
