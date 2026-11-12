import { describe, expect, it } from 'vitest';
import { bindForm, compileForm, type NodeVM } from './index';
import { childrenOf } from './test-support';

// Button fields (docs/spec/form-markup.md, Button fields).
const field = (spec: Record<string, unknown>): NodeVM =>
  bindForm(compileForm({ type: 'group', properties: { run: spec } }), {}, { language: 'en' })[0];

describe('button widget model', () => {
  it('describes a button element with its content and no script or hidden input', () => {
    expect(field({ type: 'button', label: 'Sync', content: { en: 'Run now', ko: '지금 실행' } }).widget).toEqual({
      kind: 'button',
      layout: 'button',
      tag: 'button',
      attrs: { type: 'button', class: 'crudui-action crudui-action--text', id: 'crudui:run' },
      text: 'Run now',
    });
  });

  it('writes the design class and style, the behavior attributes and the declared attributes on the button', () => {
    const run = field({
      type: 'action',
      content: 'Run',
      behavior: { onclick: 'run()' },
      design: { class: 'primary', style: 'margin: 0', attributes: { 'data-command': 'sync.run', 'aria-describedby': 'run-help' } },
    });
    expect(run.widget).toEqual({
      kind: 'button',
      layout: 'button',
      tag: 'button',
      attrs: {
        type: 'button',
        class: 'crudui-action crudui-action--text primary',
        style: 'margin: 0',
        id: 'crudui:run',
        onclick: 'run()',
        'data-command': 'sync.run',
        'aria-describedby': 'run-help',
      },
      text: 'Run',
    });
  });

  it('gives a button in a keyed row its scoped control identifier and no name, value or script', () => {
    const template = compileForm({ type: 'group', properties: { rows: { type: 'group', multiple: true, properties: { run: { type: 'button', content: 'Run' } } } } });
    const row = childrenOf(bindForm(template, { rows: { __a__: {} } }, { idPrefix: 'p', keyPrefix: 'form' })[0])[0];
    expect(childrenOf(row)[0].widget).toEqual({
      kind: 'button',
      layout: 'button',
      tag: 'button',
      attrs: { type: 'button', class: 'crudui-action crudui-action--text', id: 'p:rows.__a__.run' },
      text: 'Run',
    });
  });

  it('targets the button with the label of the header and has no header without a label', () => {
    expect(field({ type: 'button', label: 'Sync', content: 'Run' }).header).toEqual({ className: '', label: 'Sync', labelFor: 'crudui:run' });
    expect(field({ type: 'button', content: 'Run' }).header).toBeUndefined();
  });
});
