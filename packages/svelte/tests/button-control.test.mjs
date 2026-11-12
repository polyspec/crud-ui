/**
 * Button fields (docs/spec/form-markup.md, Button fields): a button field renders a `button`
 * element with the content, the behavior attributes and the declared attributes, and no script or
 * hidden input.
 */
import { describe, expect, test } from 'vitest';
import { compileForm } from '@polyspec/crudui-generator-core';
import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { renderFields } from '../src/internal/renderFields.ts';

const render = (field) => normalizeHtml(renderFields(compileForm({ type: 'group', properties: { run: field } }), { language: 'en', data: {} }));

describe('button output', () => {
  test('a button field writes a button element with its content and declared attributes', () => {
    expect(render({ type: 'button', content: 'Run <now>', design: { class: 'primary', attributes: { 'data-command': 'sync.run' } } })).toContain(
      '<div class="crudui-node__body"><button class="crudui-action crudui-action--text primary" data-command="sync.run" id="crudui:run" type="button">Run &lt;now&gt;</button></div>');
  });

  test('a button field writes its behavior attributes on the button', () => {
    expect(render({ type: 'action', content: 'Run', behavior: { onclick: 'run()' } })).toContain(
      '<div class="crudui-node__body"><button class="crudui-action crudui-action--text" id="crudui:run" onclick="run()" type="button">Run</button></div>');
  });
});
