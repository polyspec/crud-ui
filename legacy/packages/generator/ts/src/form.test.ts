import { describe, it, expect, vi } from 'vitest';
import { MemoryLoader, Validator } from '@polyspec/crudui-validator/internal';
import { compileForm, bindForm, createForm, sequenceRowKey, createRowKey } from './index';
import { spec, data, companyKey, storeKey, otherStoreKey, storesPath } from '../../../../tests/fixtures/form-session/scenario.mts';
import { checkFormTemplate } from './template-shape';
import { childrenOf, keysOf, present } from './test-support';

describe('cached structure and nested row lifecycle', () => {
  it('prepares refs and all nested prototypes without data, then binds isolated records from JSON cache', () => {
    const loader = new MemoryLoader({ 'base.yml': spec });
    const load = vi.spyOn(loader, 'load');
    const template = compileForm({ type: 'group', properties: { $ref: 'base.yml' } }, { loader, keyPrefix: 'form' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(template.fields[0].children.find(f => f.name === 'stores')?.children.length).toBeGreaterThan(1);
    expect(Object.isFrozen(template.fields[0].spec)).toBe(true);
    const cache = JSON.stringify(template);
    expect(cache).not.toContain('서울');
    const empty = bindForm(template);
    expect(empty[0].children?.[0].children?.find(f => f.path?.endsWith('.name'))?.widget).toBeTruthy();
    const restored: unknown = JSON.parse(cache);
    checkFormTemplate(restored);
    expect(bindForm(restored, data)).toEqual(bindForm(template, data));
    bindForm(template, { companies: {} }, { language: 'en' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(template)).toBe(cache);
  });

  it('copies only the selected store, renews descendant ids, preserves live edits, then applies saved keys', () => {
    const template = compileForm(spec, { keyPrefix: 'form' });
    const a = createForm(template, data);
    const b = createForm(template, data);
    const independent = b.getData();
    a.setValue(`${storesPath}.${storeKey}.name`, '편집');
    const copied = a.copyRow(storesPath, storeKey);
    expect(copied).toMatch(/^__[0-9a-f]{13}__$/);
    expect(a.getValue(`${storesPath}.${copied}.name`)).toBe('편집');
    const departments = a.getValue(`${storesPath}.${copied}.departments`);
    const departmentKeys = keysOf(departments, 'the departments');
    expect(departmentKeys).not.toContain('d1');
    expect(a.getValue(`${storesPath}.${copied}.departments.${departmentKeys[0]}`)).toEqual({ name: '영업' });
    expect(a.getValue(`${storesPath}.${storeKey}.departments.d1.name`)).toBe('영업');
    expect(b.getData()).toEqual(independent);
    a.moveRow(storesPath, copied, 0);
    a.rekeyRow(storesPath, copied, sequenceRowKey(42));
    expect(keysOf(a.getValue(storesPath), storesPath)).toEqual([sequenceRowKey(42), storeKey, otherStoreKey]);
    expect(keysOf(a.getData().companies, 'companies')).toEqual([companyKey]);
    const fields = present(childrenOf(childrenOf(a.getSnapshot().fields[0])[0]).find(f => f.path === storesPath), storesPath);
    const widget = present(present(childrenOf(childrenOf(fields)[0]).find(f => f.path?.endsWith('.name')), 'the name node').widget, 'the name widget');
    expect('attrs' in widget && widget.attrs.name).toBe(`form[companies][${companyKey}][stores][${sequenceRowKey(42)}][name]`);
    expect('attrs' in widget && widget.attrs['data-rule-name']).toBe('companies[][stores][][name]');
    a.rekeyRow('companies', companyKey, sequenceRowKey(99));
    expect(a.getValue(`companies.${sequenceRowKey(99)}.stores.${sequenceRowKey(42)}.name`)).toBe('편집');
    expect(new Validator(spec).validate(a.getData()).valid).toBe(true);
  });

  it('is atomic on duplicate keys/limits, and can delete to zero and add again', () => {
    const session = createForm(compileForm(spec), data);
    const before = session.getSnapshot();
    expect(() => session.rekeyRow(storesPath, storeKey, otherStoreKey)).toThrow('already exists');
    expect(session.getSnapshot()).toBe(before);
    session.addRow(storesPath);
    session.addRow(storesPath);
    const full = session.getSnapshot();
    expect(() => session.addRow(storesPath)).toThrow('Maximum');
    expect(session.getSnapshot()).toBe(full);
    for (const key of keysOf(session.getValue(storesPath), storesPath)) session.removeRow(storesPath, key);
    expect(session.getValue(storesPath)).toEqual({});
    const fields = present(childrenOf(childrenOf(session.getSnapshot().fields[0])[0]).find(f => f.path === storesPath), storesPath);
    expect(fields.children).toEqual([]);
    expect(session.addRow(storesPath)).toMatch(/^__[0-9a-f]{13}__$/);
    const fixed = createForm(compileForm({ type: 'group', properties: {
      rows: { type: 'text', multiple: { min: 1, max: 1 } },
    } }));
    const fixedBefore = fixed.getSnapshot();
    expect(() => fixed.removeRow('rows', keysOf(fixed.getValue('rows'), 'rows')[0])).toThrow('Minimum');
    expect(() => fixed.addRow('rows')).toThrow('Maximum');
    expect(fixed.getSnapshot()).toBe(fixedBefore);
  });

  it('rejects index arrays and keeps row identity on edits', () => {
    expect(() => createForm(compileForm(spec), { companies: [] })).toThrow('keyed object');
    expect(() => bindForm(compileForm(spec), { companies: [] })).toThrow('Repeated data must be a keyed object: companies');
    const session = createForm(compileForm(spec), data);
    const company = keysOf(session.getData().companies, 'companies')[0];
    const path = `companies.${company}.stores`;
    const keys = keysOf(session.getValue(path), path);
    session.setValue(`${path}.${keys[0]}.name`, 'changed');
    session.moveRow(path, keys[1], 0);
    expect(keysOf(session.getValue(path), path)).toEqual([keys[1], keys[0]]);
    expect(sequenceRowKey('1234567890123')).toBe('__1234567890123__');
    expect(() => sequenceRowKey(1.5)).toThrow();
    expect(() => sequenceRowKey('12345678901234')).toThrow();
    expect(createRowKey()).toMatch(/^__[0-9a-f]{13}__$/);
    expect(() => session.setValue('__proto__.polluted', true)).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

it('rejects a wrong value type in multiple and design declarations at compilation', () => {
  const compile = (field: Record<string, unknown>) => () =>
    compileForm({ type: 'group', properties: { rows: field } });
  expect(compile({ type: 'text', multiple: 'yes' })).toThrow('Invalid multiple at rows: expected a boolean, only or an object');
  expect(compile({ type: 'text', multiple: { max: '2' } })).toThrow('Invalid multiple.max at rows: expected a number');
  expect(compile({ type: 'text', multiple: { sortable: 1 } })).toThrow('Invalid multiple.sortable at rows: expected a boolean');
  expect(compile({ type: 'text', design: 'hidden' })).toThrow('Invalid design at rows: expected a boolean or an object');
  expect(compile({ type: 'text', design: { show: [] } })).toThrow('Invalid design.show at rows: expected an expression, a boolean or a condition map');
  expect(compile({ type: 'text', design: { style: 3 } })).toThrow('Invalid design.style at rows: expected a string or a condition map');
  expect(compile({ type: 'text', design: { group: true } })).toThrow('Invalid design.group at rows: expected an object');
  expect(compile({ type: 'group', properties: { name: { type: 'text', design: { prepend: { class: {} } } } } }))
    .toThrow('Invalid design.prepend.class at rows.name: expected a string or a condition map');
  expect(compile({ type: 'text', multiple: { min: 0, copy: true }, design: { show: '.on', class: { '.on': 'a', true: '' }, label: {} } }))
    .not.toThrow();
});

it('accepts multiple: only with title and header and rejects row settings beside it', () => {
  const compile = (field: Record<string, unknown>) => () =>
    compileForm({ type: 'group', properties: { rows: field } });
  expect(compile({ type: 'text', multiple: 'all' })).toThrow('Invalid multiple at rows: expected a boolean, only or an object');
  expect(compile({ type: 'group', multiple: { only: 'yes' }, properties: {} })).toThrow('Invalid multiple.only at rows: expected a boolean');
  for (const [key, value] of Object.entries({ min: 1, max: 3, copy: true, sortable: true, controls: 'header', onclick: 'go()' })) {
    expect(compile({ type: 'group', multiple: { only: true, [key]: value }, properties: {} }))
      .toThrow(`Invalid multiple.${key} at rows: unknown key`);
    expect(compile({ type: 'group', multiple: { only: false, [key]: value }, properties: {} })).not.toThrow();
  }
  expect(compile({ type: 'text', multiple: 'only' })).not.toThrow();
  expect(compile({ type: 'group', multiple: { only: true, title: 'name', header: 'sticky' },
    properties: { name: { type: 'text' } } })).not.toThrow();
});

it('keeps a data-only collection to the rows of its data and rejects row operations', () => {
  const template = compileForm({ type: 'group', properties: {
    rows: { type: 'group', multiple: 'only', properties: { name: { type: 'text' } } },
  } });
  const empty = bindForm(template)[0];
  expect(empty.children).toEqual([]);
  expect(empty.controls).toBeUndefined();
  const data = { rows: { __opt_b2__: { name: 'b' }, __opt_a1__: { name: 'a' } } };
  const [collection] = bindForm(template, data);
  expect(collection.children?.map(row => row.key)).toEqual(['__opt_b2__', '__opt_a1__']);
  expect(collection.children?.every(row => row.controls === undefined)).toBe(true);
  expect(createForm(template).getData()).toEqual({ rows: {} });
  const session = createForm(template, data);
  const before = session.getSnapshot();
  for (const operation of [
    () => session.addRow('rows'),
    () => session.copyRow('rows', '__opt_a1__'),
    () => session.removeRow('rows', '__opt_a1__'),
    () => session.moveRow('rows', '__opt_a1__', 0),
    () => session.rekeyRow('rows', '__opt_a1__', '__opt_c3__'),
  ]) {
    expect(operation).toThrow(expect.objectContaining({ code: 'INVALID_FORM_INPUT', message: 'Rows of rows come only from data' }));
    expect(session.getData()).toEqual(data);
    expect(session.getSnapshot()).toBe(before);
  }
});

it('preserves sequence row keys in names and generates distinct stable DOM scopes', () => {
  const template = compileForm({ type: 'group', properties: {
    rows: { type: 'group', multiple: true, properties: { value: { type: 'text', label: 'Value' } } },
  } });
  const key = sequenceRowKey(7);
  const data = { rows: { [key]: { value: 'saved' } } };
  const first = createForm(template, data, { idPrefix: 'first' });
  const second = createForm(template, data, { idPrefix: 'second' });
  const widget = (form: typeof first) => present(childrenOf(childrenOf(form.getSnapshot().fields[0])[0])[0].widget, 'the value widget');
  const a = widget(first);
  const b = widget(second);
  if ('unsupported' in a || 'unsupported' in b) throw new Error('Text must be supported');
  expect(a.attrs.name).toBe(`rows[${key}][value]`);
  expect(b.attrs.name).toBe(a.attrs.name);
  expect(b.attrs.id).not.toBe(a.attrs.id);
  first.setData(data);
  expect(widget(first)).toEqual(a);
  expect(first.getData()).toEqual(data);
});
