/**
 * Button fields (docs/spec/form-markup.md, Button fields): the HTML renderer writes a `button`
 * element with the escaped content, and a button with behavior attributes raw.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from './index';

const render = (field: Record<string, unknown>) =>
  renderForm(createForm(compileForm({ type: 'group', properties: { run: field } }), {}, { language: 'en' }));

describe('button bytes of the HTML renderer', () => {
  test('a button field writes a button element after the label of its header', () => {
    expect(render({ type: 'button', label: 'Sync', content: 'Run <now>' })).toContain(
      '<label class="crudui-node__label" for="crudui:run">Sync</label></div><div class="crudui-node__body">' +
      '<button type="button" class="crudui-action crudui-action--text" id="crudui:run">Run &lt;now&gt;</button></div>');
  });

  test('a button field without a label has no header', () => {
    expect(render({ type: 'button', content: 'Run' })).toContain(
      '<div class="crudui-node crudui-node--field" data-field-path="run"><div class="crudui-node__body">' +
      '<button type="button" class="crudui-action crudui-action--text" id="crudui:run">Run</button></div></div>');
  });

  test('a button writes the design class, the declared attributes and the design style last', () => {
    expect(render({ type: 'button', content: 'Run', design: { class: 'primary', style: 'margin: 0', attributes: { 'data-command': 'sync.run' } } })).toContain(
      '<button type="button" class="crudui-action crudui-action--text primary" id="crudui:run" data-command="sync.run" style="margin:0">Run</button>');
  });

  test('a button with a behavior attribute is written raw', () => {
    expect(render({ type: 'action', content: 'Run & go', behavior: { onclick: 'run() && go("x")' }, design: { attributes: { 'data-command': 'sync.run' } } })).toContain(
      '<button type="button" class="crudui-action crudui-action--text" id="crudui:run" onclick="run() &amp;&amp; go(&quot;x&quot;)" data-command="sync.run">Run &amp; go</button>');
  });
});
