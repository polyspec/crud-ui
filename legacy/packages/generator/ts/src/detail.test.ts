import { describe, expect, test } from 'vitest';
import { buildDetail } from './detail';

describe('buildDetail', () => {
  test('builds ordered read-only fields through the list display engine', () => {
    const vm = buildDetail({
      fields: {
        name: { field: 'name', label: { en: 'Name', ko: '이름' } },
        state: { field: 'state', format: { type: 'badge', map: { active: 'success' } } },
      },
    }, { name: 'Ada', state: 'active' }, { language: 'en' });

    expect(vm.fields.map((field) => field.key)).toEqual(['name', 'state']);
    expect(vm.fields[0]?.display).toBe('Ada');
    expect(vm.fields[1]?.display).toEqual({ kind: 'badge', variant: 'success', label: 'active' });
  });

  test('rejects a declaration or record that is not an object', () => {
    for (const spec of [null, 'detail', ['fields'], 1]) {
      // @ts-expect-error: a declaration that is no object is no record; buildDetail checks it at run time.
      expect(() => buildDetail(spec)).toThrow('Detail specification must be an object');
    }
    expect(() => buildDetail({})).toThrow('Detail specification must declare fields');
    // @ts-expect-error: a list is no record; buildDetail checks the record at run time.
    expect(() => buildDetail({ fields: {} }, []))
      .toThrow('Detail record must be an object');
  });

  test('carries the same cell members a list row carries', () => {
    const vm = buildDetail({ fields: { name: { field: 'name' } } }, { name: 'Ada' });
    expect(Object.keys(vm.fields[0] ?? {})).toEqual(['key', 'label', 'format', 'value', 'display', 'design']);
  });

  test('resolves composed detail fields', () => {
    const vm = buildDetail({ fields: { $ref: 'shared.json' } }, { name: 'Ada' }, {
      files: { 'shared.json': { properties: { name: { field: 'name' } } } },
    });
    expect(vm.fields[0]?.display).toBe('Ada');
  });
});
