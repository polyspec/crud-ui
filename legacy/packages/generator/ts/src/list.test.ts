/**
 * buildList conformance — the read sister of buildForm (SPEC §9).
 *
 * Verifies the list view-model builder reuses the CRUDUI engine 100% (compose /
 * expression / design / i18n) and that the ONE new surface — the read cell
 * renderer (cell.ts) — produces the SPEC §9.2 catalog display values. Rows are
 * INJECTED (DB-agnostic, SPEC §9). Do not weaken assertions; a failure means the
 * builder diverged from the engine or the catalog, not that the spec is wrong.
 */

import { describe, test, expect } from 'vitest';
import { buildList, ComposeLoadError } from './index';
import { paginationPages } from './internal';

describe('buildList — structure & engine reuse', () => {
  test('resolves columns, i18n header, sortable, empty (DB-agnostic rows)', () => {
    const vm = buildList(
      {
        columns: {
          name: { field: 'name', label: { ko: '이름', en: 'Name' }, sortable: true },
          status: { field: 'status', label: { ko: '상태', en: 'Status' } },
        },
        empty: { ko: '데이터가 없습니다', en: 'No data' },
        sort: { field: 'created_at', dir: 'desc' },
        pagination: { per_page: 20, mode: 'pages' },
      },
      [
        { name: 'Ada', status: 'active' },
        { name: 'Lin', status: 'blocked' },
      ],
      { language: 'en', page: 1, total: 42 }
    );

    expect(vm.columns.map((c) => c.key)).toEqual(['name', 'status']);
    expect(vm.columns[0].label).toBe('Name');
    expect(vm.columns[0].sortable).toBe(true);
    expect(vm.columns[1].sortable).toBe(false);
    expect(vm.empty).toBe('No data');
    expect(vm.sort).toEqual({ field: 'created_at', dir: 'desc' });
    expect(vm.pagination).toEqual({
      enabled: true, perPage: 20, mode: 'pages', page: 1, total: 42, pageCount: 3,
      buttons: [
        { role: 'previous', page: 1, label: 'Previous page', current: false, disabled: true },
        { role: 'page', page: 1, label: 'Page 1', current: true, disabled: true },
        { role: 'page', page: 2, label: 'Page 2', current: false, disabled: false },
        { role: 'page', page: 3, label: 'Page 3', current: false, disabled: false },
        { role: 'next', page: 2, label: 'Next page', current: false, disabled: false },
      ],
    });

    expect(vm.rows).toHaveLength(2);
    expect(vm.rows[0].cells[0].value).toBe('Ada');
    expect(vm.rows[0].cells[0].display).toBe('Ada');
    expect(vm.rows[1].cells[1].value).toBe('blocked');
  });

  test('column design.show (expression) drops the hidden column (G1)', () => {
    const vm = buildList(
      {
        columns: {
          name: { field: 'name' },
          secret: { field: 'secret', design: { show: '.admin' } },
        },
      },
      [{ name: 'Ada', secret: 'x' }],
      { data: { admin: false } }
    );
    expect(vm.columns.map((c) => c.key)).toEqual(['name']);
    expect(vm.rows[0].cells).toHaveLength(1);

    const vmAdmin = buildList(
      {
        columns: {
          name: { field: 'name' },
          secret: { field: 'secret', design: { show: '.admin' } },
        },
      },
      [{ name: 'Ada', secret: 'x' }],
      { data: { admin: true } }
    );
    expect(vmAdmin.columns.map((c) => c.key)).toEqual(['name', 'secret']);
  });

  test('compose: $ref base + $patch overlay on the columns map', () => {
    const vm = buildList(
      {
        columns: {
          $ref: 'base-columns.yml',
          $patch: { extra: { field: 'extra', label: 'Extra' } },
        },
      },
      [{ id: 7, extra: 'E' }],
      {
        files: {
          // $ref reuses the SAME compose engine as form-spec: a ref file's
          // payload lives under `properties` (the columns map is the read-side
          // properties symmetric). The engine's convention is unchanged.
          'base-columns.yml': {
            properties: {
              id: { field: 'id', label: 'ID', sortable: true },
            },
          },
        },
      }
    );
    expect(vm.columns.map((c) => c.key)).toEqual(['id', 'extra']);
    expect(vm.columns[0].sortable).toBe(true);
    expect(vm.rows[0].cells[0].value).toBe(7);
    expect(vm.rows[0].cells[1].display).toBe('E');
  });

  test('unresolved $ref → ComposeLoadError (never a silent render)', () => {
    expect(() =>
      buildList({ columns: { $ref: 'missing.yml' } }, [], { files: {} })
    ).toThrow(ComposeLoadError);
  });
});

describe('renderCell catalog — SPEC §9.2 read display values', () => {
  function cell(format: unknown, value: unknown, row: Record<string, unknown> = {}, language: 'ko' | 'en' = 'en') {
    const vm = buildList(
      { columns: { c: { field: 'c', ...(format === undefined ? {} : { format }) } } },
      [{ ...row, c: value }],
      { language }
    );
    return vm.rows[0].cells[0].display;
  }

  test('text (default + truncate)', () => {
    expect(cell(undefined, 'hello')).toBe('hello');
    expect(cell('text', 'hello')).toBe('hello');
    expect(cell({ type: 'text', truncate: 3 }, 'hello')).toBe('hel…');
  });

  test('date (pattern)', () => {
    expect(cell({ type: 'date', pattern: 'YYYY-MM-DD' }, '2026-06-14T10:30:00')).toBe('2026-06-14');
    expect(cell({ type: 'date', pattern: 'YYYY/MM' }, '2026-06-14')).toBe('2026/06');
  });

  test('number (decimals + thousands + i18n affix)', () => {
    expect(cell({ type: 'number', decimals: 2, thousands: true }, 1234567.5)).toBe('1,234,567.50');
    expect(cell({ type: 'number', prefix: { ko: '₩', en: '$' }, thousands: true }, 1000)).toBe('$1,000');
  });

  test('badge (value→variant + i18n label)', () => {
    expect(cell({ type: 'badge', map: { active: 'success', blocked: 'danger' } }, 'active')).toEqual({
      kind: 'badge',
      variant: 'success',
      label: 'active',
    });
    expect(
      cell({ type: 'badge', map: { active: { ko: '활성', en: 'Active' } } }, 'active')
    ).toEqual({ kind: 'badge', variant: 'Active', label: 'Active' });
  });

  test('link ({=path} interpolation + condition map href + target)', () => {
    expect(
      cell({ type: 'link', href: '/user/edit/{=id}', target: '_blank', text: 'Edit' }, 'ignored', { id: 9 })
    ).toEqual({ kind: 'link', href: '/user/edit/9', text: 'Edit', target: '_blank' });
    // condition map href via the shared expr engine.
    expect(
      cell({ type: 'link', href: { '.admin': '/admin/{=id}', true: '/u/{=id}' } }, 'x', { id: 3, admin: true })
    ).toEqual({ kind: 'link', href: '/admin/3', text: 'x' });
    expect(
      cell({ type: 'link', href: 'https://example.com/users/{=id}/report.pdf' }, 'x', { id: 3 })
    ).toEqual({ kind: 'link', href: 'https://example.com/users/3/report.pdf', text: 'x' });
    expect(
      cell(
        { type: 'link', href: '/users/{=jointablename.id}/{=join.join.name}' },
        'x',
        { jointablename: { id: 7 }, join: { join: { name: 'Ada' } } }
      )
    ).toEqual({ kind: 'link', href: '/users/7/Ada', text: 'x' });
    expect(cell({ type: 'link', href: '/user/.id' }, 'x', { id: 3 })).toEqual({
      kind: 'link',
      href: '/user/.id',
      text: 'x',
    });
  });

  test('choice-label (static items code→label; dynamic model preserved)', () => {
    expect(cell({ type: 'choice-label', items: { A: 'Apple', B: 'Banana' } }, 'B')).toBe('Banana');
    expect(cell({ type: 'choice-label', items: { A: { ko: '사과', en: 'Apple' } } }, 'A')).toBe('Apple');
    // dynamic { model } source → raw code preserved (never fabricated).
    expect(cell({ type: 'choice-label', items: { model: 'Category' } }, 'CODE_42')).toBe('CODE_42');
  });

  test('choice-label reads a choice list by the canonical text of each value', () => {
    const items = [{ value: 1, label: 'Yes' }, { value: 0, label: { ko: '아니요', en: 'No' } }, { value: 'b', label: 'Bee' }];
    expect(cell({ type: 'choice-label', items }, 1)).toBe('Yes');
    expect(cell({ type: 'choice-label', items }, '0')).toBe('No');
    expect(cell({ type: 'choice-label', items }, 'b')).toBe('Bee');
    expect(cell({ type: 'choice-label', items }, 2)).toBe('2');
    // An array of labels keeps its indexes as the values.
    expect(cell({ type: 'choice-label', items: ['Yes', 'No'] }, 1)).toBe('No');
  });

  test('bool (true/false i18n label + as form)', () => {
    expect(cell({ type: 'bool', true: 'Yes', false: 'No', as: 'check' }, 1)).toEqual({
      kind: 'bool',
      value: true,
      label: 'Yes',
      as: 'check',
    });
    expect(cell({ type: 'bool', true: 'Yes', false: 'No' }, '')).toEqual({
      kind: 'bool',
      value: false,
      label: 'No',
      as: 'text',
    });
  });

  test('image (src + alt {=path} interpolation + size)', () => {
    expect(
      cell({ type: 'image', width: 40, height: 40, alt: 'avatar {=name}.png' }, '/img/a.png', { name: 'Ada' })
    ).toEqual({ kind: 'image', src: '/img/a.png', alt: 'avatar Ada.png', width: '40', height: '40' });
  });

  test('html (raw, unescaped)', () => {
    expect(cell({ type: 'html' }, '<b>x</b>')).toEqual({ kind: 'html', html: '<b>x</b>' });
  });
});

describe('buildList — pagination / actions polymorphism', () => {
  test('pagination defaults page 1 and derives a bounded page count', () => {
    expect(buildList({ columns: { c: {} }, pagination: {} }, [], { total: 45 }).pagination)
      .toMatchObject({ enabled: true, perPage: 20, mode: 'pages', page: 1, pageCount: 3 });
    expect(paginationPages(2, 3)).toEqual([1, 2, 3]);
    expect(paginationPages(500, Number.MAX_SAFE_INTEGER)).toHaveLength(5);
  });

  test('pagination false → disabled; absent → disabled', () => {
    expect(buildList({ columns: { c: {} }, pagination: false }, []).pagination).toEqual({ enabled: false });
    expect(buildList({ columns: { c: {} } }, []).pagination).toEqual({ enabled: false });
  });

  test('actions: object (link format) and bare behavior script', () => {
    const vm = buildList(
      {
        columns: { c: {} },
        actions: {
          edit: { label: { en: 'Edit' }, format: { type: 'link', href: '/edit/{=id}' } },
          remove: 'confirmDelete(this)',
        },
      },
      []
    );
    expect(vm.actions[0]).toMatchObject({ key: 'edit', label: 'Edit' });
    expect(vm.actions[0].format?.type).toBe('link');
    expect(vm.actions[1]).toEqual({ key: 'remove', label: 'remove', behavior: { onclick: 'confirmDelete(this)' } });
  });
});
