/**
 * Switches (docs/spec/form-markup.md, Switches): a switcher renders a checkbox input with the
 * switch role, the switch class and the declared attributes of the field.
 */
import { describe, expect, test } from 'vitest';
import { compileForm } from '@polyspec/crudui-generator-core';
import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { renderFields } from '../src/internal/renderFields.ts';

describe('switch output', () => {
  test('a switcher writes the switch role, the switch class and the declared attributes', async () => {
    const spec = { type: 'group', properties: { on: { type: 'switcher', label: 'Sync', design: { attributes: { 'data-setting': 'sync' } } } } };
    expect(normalizeHtml(await renderFields(compileForm(spec), { language: 'en', data: { on: true } }))).toContain(
      '<input checked="" class="valid-target crudui-input crudui-input--switch" data-setting="sync" id="crudui:on" name="on" role="switch" type="checkbox" value="1"><label for="crudui:on">Sync</label>');
  });
});
