/**
 * Range fields (docs/spec/form-markup.md, Range fields): the HTML renderer writes a range input
 * with the bounds and the step of the validation rules, an output with the current value and the
 * append affix that names the unit, with the input attribute placement of React's server
 * rendering.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from './index';

const render = (field: Record<string, unknown>, data: Record<string, unknown> = {}) =>
  renderForm(createForm(compileForm({ type: 'group', properties: { volume: field } }), data, { language: 'en' }));
const volume = { type: 'range', label: 'Volume', default: 50, append: '%', validate: { range: [0, 100], step: 5 } };

describe('range control bytes of the HTML renderer', () => {
  test('a range field writes the input, the output and the unit', () => {
    expect(render(volume)).toContain(
      '<label class="crudui-node__label" for="crudui:volume">Volume</label></div><div class="crudui-node__body">' +
      '<div class="crudui-widget crudui-widget--range"><input type="range" min="0" max="100" step="5" class="valid-target crudui-input crudui-input--range" data-name="volume" data-rule-name="volume" data-default="50" id="crudui:volume" name="volume" value="50"/>' +
      '<output class="crudui-widget__output" for="crudui:volume">50</output><span class="crudui-widget__affix">%</span></div></div>');
  });

  test('the output shows the bound value', () => {
    expect(render(volume, { volume: '35' })).toContain('name="volume" value="35"/><output class="crudui-widget__output" for="crudui:volume">35</output>');
  });

  test('a range input with a behavior attribute is written raw', () => {
    expect(render({ type: 'range', default: 50, validate: volume.validate, behavior: { onchange: 'save(this)' }, design: { attributes: { 'data-setting': 'volume' } } })).toContain(
      '<div class="crudui-widget crudui-widget--range"><input type="range" name="volume" value="50" min="0" max="100" step="5" class="valid-target crudui-input crudui-input--range" onchange="save(this)" data-name="volume" data-rule-name="volume" data-default="50" id="crudui:volume" data-setting="volume">' +
      '<output class="crudui-widget__output" for="crudui:volume">50</output></div>');
  });
});
