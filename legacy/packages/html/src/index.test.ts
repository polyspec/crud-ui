import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm, renderList } from './index';

describe('framework-independent form rendering', () => {
  test('renders an editable fragment from the evaluated instance', () => {
    const template = compileForm({
      type: 'group',
      properties: {
        name: { type: 'text', label: 'Name', description: 'Shown safely' },
        role: { type: 'select', items: { admin: 'Admin', user: 'User' } },
        tags: { type: 'text', multiple: true },
      },
    });
    const form = createForm(template, { name: '<Ada & Lin>', role: 'admin', tags: {} });
    const before = JSON.stringify([form.getData(), form.getSnapshot()]);
    const html = renderForm(form);
    const after = JSON.stringify([form.getData(), form.getSnapshot()]);

    expect(html).toContain('data-field-path="name"');
    expect(html).toContain('value="&lt;Ada &amp; Lin&gt;"');
    expect(html).toContain('<option value="admin" selected="">Admin</option>');
    expect(html).toContain('data-crudui-action="add-row"');
    expect(html).not.toContain('<form');
    expect(after).toBe(before);
  });

  test('keeps explicit raw display content and escapes ordinary labels', () => {
    const template = compileForm({
      type: 'group',
      properties: {
        label: { type: 'text', label: '<unsafe>' },
        preview: { type: 'html' },
      },
    });
    const html = renderForm(createForm(template, { label: 'safe', preview: '<strong>raw</strong>' }));
    expect(html).toContain('&lt;unsafe&gt;');
    expect(html).toContain('<strong>raw</strong>');
  });
});

describe('framework-independent list rendering', () => {
  test('renders table and card layouts from the same list model', () => {
    const spec = {
      columns: {
        name: { field: 'name', label: 'Name' },
        status: { field: 'status', format: { type: 'badge', map: { active: 'success' } } },
      },
    };
    const rows = [{ name: 'Ada', status: 'active' }];
    const table = renderList(spec, rows);
    const card = renderList(spec, rows, { layout: 'card' });

    expect(table).toContain('<table class="crudui-list__table">');
    expect(table).toContain('<span class="crudui-badge" data-crudui-variant="success">active</span>');
    expect(card).toContain('<div class="crudui-list__cards">');
    expect(card).toContain('<article class="crudui-list__card">');
    expect(table).not.toContain('Ada</script>');
  });
});
