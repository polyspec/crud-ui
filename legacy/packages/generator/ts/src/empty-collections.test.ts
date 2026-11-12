import { describe, expect, test } from 'vitest';
import { bindForm, compileForm } from './index';
import { childrenOf } from './test-support';

const group = { type: 'group', multiple: true, properties: { name: { type: 'text' } } };
const scalar = { type: 'text', multiple: true };

/** Row nodes of the `items` collection. */
function rows(field: Record<string, unknown>, data: Record<string, unknown>) {
  const template = compileForm({ type: 'group', properties: { items: field } });
  return childrenOf(bindForm(template, data)[0]);
}

describe('explicit empty collections', () => {
  for (const [name, field] of Object.entries({ group, scalar })) {
    test(`${name}: an explicit empty object has no rows`, () => {
      expect(rows(field, { items: {} })).toEqual([]);
    });
    test(`${name}: collection data other than a keyed object is rejected`, () => {
      for (const items of [[], ['a'], null, 'a']) {
        expect(() => rows(field, { items })).toThrow('Repeated data must be a keyed object: items');
      }
    });
    test(`${name}: missing data still creates an initial row`, () => {
      expect(rows(field, {})).toHaveLength(1);
    });
  }
  test('visibility does not create or remove collection data', () => {
    const field = { ...group, design: { show: '.visible' } };
    const spec = { type: 'group', properties: { items: field } };
    const template = compileForm(spec);
    for (const items of [{}, { __0000000000005__: { name: 'Five' } }]) {
      for (const visible of [false, true]) {
        const data = { items, visible };
        const before = structuredClone(data);
        const vm = bindForm(template, data)[0];
        expect(vm.hidden).toBe(!visible);
        expect(vm.children).toHaveLength(Object.keys(items).length);
        expect(data).toEqual(before);
      }
    }
  });
  test('nested empty collections preserve sibling identity and order', () => {
    const field = { ...group, properties: { name: { type: 'text' }, children: group } };
    const data = { items: {
      __0000000000005__: { name: 'Five', children: {} },
      __0000000000007__: { name: 'Seven', children: { __0000000000001__: { name: 'Child' } } },
      __0000000000001__: { name: 'One', children: {} },
    } };
    const before = structuredClone(data);
    const output = rows(field, data);
    expect(output.map(row => row.key)).toEqual(Object.keys(data.items));
    expect(output.map(row => childrenOf(childrenOf(row)[1]).length)).toEqual([0, 1, 0]);
    expect(childrenOf(childrenOf(output[1])[1])[0].key).toBe('__0000000000001__');
    expect(data).toEqual(before);
  });
});
