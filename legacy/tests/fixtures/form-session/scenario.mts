// The same nested form and browser lifecycle are exercised by every adapter.
import type { FormInstance } from '@polyspec/crudui-generator-core';
import type { ExpectStatic } from 'vitest';

/** What a framework test hands a shared form session scenario: the mounted form and its test tools. */
export interface SessionCase {
  /** The element the form is mounted in. */
  element: HTMLElement;
  /** The form session the mounted form renders. */
  session: FormInstance;
  /** Resolves once a change has been rendered. */
  flush: () => Promise<void>;
  /** The expect of the test runner. */
  expect: ExpectStatic;
}

/** What a framework test hands a shared form scenario that names its session `form`. */
export type FormCase = Omit<SessionCase, 'session'> & {
  /** The form session the mounted form renders. */
  form: FormInstance;
};

/** A form control the scenarios read and edit. */
export type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** The value, which a scenario step requires to exist; a missing one fails the step. */
export function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new TypeError(`${what} is missing`);
  return value;
}

/** The value as an object of named values, which a scenario step requires it to be. */
export function record(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${what} is no object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export const companyKey = '__0000000000001__';
// Deliberately the key of the company: replacement must be scoped by path.
export const storeKey = '__0000000000001__';
export const otherStoreKey = '__0000000000002__';
export const spec = {
  type: 'group',
  properties: {
    companies: {
      type: 'group', multiple: { copy: true, sortable: true, header: 'sticky' },
      properties: {
        name: { type: 'text' },
        stores: {
          type: 'group', multiple: { copy: true, sortable: true, max: 4, header: 'sticky' },
          properties: {
            name: { type: 'text', validate: { required: true } },
            enabled: { type: 'checkbox', default: 1 },
            nickname: { type: 'text', default: 'Default' },
            opened: { type: 'date' },
            detail: { type: 'textarea', design: { show: '.enabled' } },
            category: { type: 'select', items: { a: 'A', b: 'B' } },
            title: { type: 'text', lang: { only: ['ko', 'en'] } },
            departments: {
              type: 'group', multiple: true,
              properties: { name: { type: 'text' } },
            },
          },
        },
      },
    },
  },
};
export const data = {
  companies: {
    [companyKey]: {
      name: '회사',
      stores: {
        [storeKey]: { name: '서울', nickname: '', opened: '2026-09-07T10:00:00Z', enabled: 1, detail: '메모', category: 'a', title: { ko: '한국어', en: 'English' }, departments: { d1: { name: '영업' } } },
        [otherStoreKey]: { name: '부산', enabled: '', category: 'b', departments: {} },
      },
    },
  },
};
export const storesPath = `companies.${companyKey}.stores`;

/** Real DOM assertions shared by React, Vue and Svelte (no SSR-only shortcuts). */
export async function exerciseSessionDom({ element, session, flush, expect }: SessionCase): Promise<void> {
  const inputName = (key: string) => `form[companies][${companyKey}][stores][${key}][name]`;
  const control = <T extends FormControl = FormControl>(name: string) =>
    Array.from(element.querySelectorAll<T>('[name]')).find(el => el.getAttribute('name') === name);
  const field = <T extends FormControl = FormControl>(name: string) => required(control<T>(name), `the control ${name}`);
  const active = () => required(element.ownerDocument.activeElement, 'the focused element');
  const rows = (path: string) => Object.keys(record(session.getValue(path), path));
  // Rows and actions are identified by attributes, never by style classes.
  const row = (key: string) => Array.from(element.querySelectorAll<HTMLElement>('[data-crudui-row-key]'))
    .find(node => node.getAttribute('data-crudui-row-key') === key &&
      required(node.parentElement, 'the row parent').closest('[data-field-path]')?.getAttribute('data-field-path') === storesPath);
  const button = (key: string, action: string) => required(
    Array.from(required(row(key), `the row ${key}`).querySelectorAll<HTMLElement>(`[data-crudui-action="${action}"]`))
      .find(b => b.closest('[data-crudui-row-key]') === row(key)),
    `the ${action} button of the row ${key}`);
  const edit = async (input: FormControl, value: string) => {
    input.focus();
    input.value = value;
    input.dispatchEvent(new (required(element.ownerDocument.defaultView, 'the window').Event)('input', { bubbles: true }));
    await flush();
  };
  expect(element.querySelector('input')).toBeTruthy(); // mounted before loading a record
  session.setData(data);
  await flush();
  expect(field(inputName(storeKey)).value).toBe('서울');
  expect(field(inputName(storeKey).replace('[name]', '[nickname]')).value).toBe('');
  expect(field(inputName(storeKey).replace('[name]', '[opened]')).value).toBe('2026-09-07');
  await edit(field(inputName(storeKey)), '서울 수정');
  expect(session.getValue(`${storesPath}.${storeKey}.name`)).toBe('서울 수정');
  expect(active().getAttribute('name')).toBe(inputName(storeKey));

  // A row operation moves focus to the first input of the row it affects.
  button(storeKey, 'add-row').click();
  await flush();
  const added = required(rows(storesPath)[1], 'the added row');
  expect(active().getAttribute('name')).toBe(inputName(added));
  button(added, 'remove-row').click();
  await flush();
  expect(active().getAttribute('name')).toBe(inputName(storeKey));

  button(storeKey, 'copy-row').click();
  await flush();
  const keys = rows(storesPath);
  const copied = required(keys[1], 'the copied row');
  expect(copied).not.toBe(storeKey);
  expect(field(inputName(copied)).value).toBe('서울 수정');
  expect(active().getAttribute('name')).toBe(inputName(copied));
  button(copied, 'move-up').click();
  await flush();
  expect(rows(storesPath)[0]).toBe(copied);
  expect(active().getAttribute('name')).toBe(inputName(copied));
  // An unavailable action stays focusable, and a click on it changes nothing.
  const unavailable = button(copied, 'move-up');
  expect(unavailable.getAttribute('aria-disabled')).toBe('true');
  expect(unavailable.hasAttribute('disabled')).toBe(false);
  unavailable.focus();
  unavailable.click();
  await flush();
  expect(rows(storesPath)[0]).toBe(copied);
  expect(active().getAttribute('data-crudui-action')).toBe('move-up');
  expect(active().closest('[data-crudui-row-key]')).toBe(row(copied));
  // Toggling keeps the focused toggle button of the same row.
  for (const expanded of ['false', 'true']) {
    button(copied, 'toggle-row').focus();
    button(copied, 'toggle-row').click();
    await flush();
    expect(active().getAttribute('data-crudui-action')).toBe('toggle-row');
    expect(active().closest('[data-crudui-row-key]')).toBe(row(copied));
    expect(active().getAttribute('aria-expanded')).toBe(expanded);
  }
  expect(field(inputName(storeKey)).value).toBe('서울 수정');

  // Collapsing and expanding every row: each toggle names its body with aria-controls.
  const toggles = () => Array.from(element.querySelectorAll<HTMLElement>('[data-crudui-action="toggle-row"]'));
  const bodyOf = (toggle: HTMLElement) => required(
    element.ownerDocument.getElementById(required(toggle.getAttribute('aria-controls'), 'aria-controls')), 'the row body');
  session.setAllExpanded(false);
  await flush();
  expect(toggles().length).toBeGreaterThan(0);
  expect(toggles().every(toggle => toggle.getAttribute('aria-expanded') === 'false' && bodyOf(toggle).hidden)).toBe(true);
  session.setAllExpanded(true);
  await flush();
  expect(toggles().every(toggle => toggle.getAttribute('aria-expanded') === 'true' && !bodyOf(toggle).hidden)).toBe(true);

  // Undo restores the control value of the last edit.
  await edit(field(inputName(copied)), '되돌릴 값');
  expect(session.getValue(`${storesPath}.${copied}.name`)).toBe('되돌릴 값');
  session.undo();
  await flush();
  expect(field(inputName(copied)).value).toBe('서울 수정');
  expect(session.getValue(`${storesPath}.${copied}.name`)).toBe('서울 수정');

  const savedKey = '__0000000000042__';
  session.rekeyRow(storesPath, copied, savedKey);
  await flush();
  expect(control(inputName(copied))).toBeUndefined();
  expect(field(inputName(savedKey)).value).toBe('서울 수정');
  expect(field(inputName(storeKey)).value).toBe('서울 수정');
  expect(field(inputName(otherStoreKey)).value).toBe('부산');
  expect(field(inputName(savedKey)).getAttribute('data-rule-name')).toBe('companies[][stores][][name]');

  const checkboxName = inputName(savedKey).replace('[name]', '[enabled]');
  field(checkboxName).click();
  await flush();
  expect(session.getValue(`${storesPath}.${savedKey}.enabled`)).toBe('');
  const detail = field(inputName(savedKey).replace('[name]', '[detail]'));
  expect(required(detail.closest<HTMLElement>('[data-field-path]'), 'the detail field').hidden).toBe(true);

  // Inject a new record over dirty controls, including textarea/select/lang/checkbox.
  session.setData({ companies: { [companyKey]: { stores: {
    [savedKey]: { name: '저장값', enabled: 1, detail: '새 메모', category: 'b', title: { ko: '새 제목', en: 'New' }, departments: {} },
  } } } });
  await flush();
  expect(field(inputName(savedKey)).value).toBe('저장값');
  expect(field<HTMLInputElement>(checkboxName).checked).toBe(true);
  expect(field(inputName(savedKey).replace('[name]', '[detail]')).value).toBe('새 메모');
  expect(field(inputName(savedKey).replace('[name]', '[category]')).value).toBe('b');
  expect(field(inputName(savedKey).replace('[name]', '[title][en]')).value).toBe('New');
  button(savedKey, 'remove-row').click();
  await flush();
  expect(session.getValue(storesPath)).toEqual({});
  // Removing the last row focuses the enclosing company row.
  expect(active().getAttribute('name')).toBe(`form[companies][${companyKey}][name]`);
  const wrapper = required(Array.from(element.querySelectorAll<HTMLElement>('[data-field-path]')).find(node => node.dataset.fieldPath === storesPath), 'the stores field');
  const emptyAdd = required(wrapper.querySelector<HTMLElement>('[data-crudui-action="add-row"]'), 'the add-row button');
  emptyAdd.focus();
  emptyAdd.click();
  await flush();
  const first = required(rows(storesPath)[0], 'the first row');
  expect(active().getAttribute('name')).toBe(inputName(first));
}
