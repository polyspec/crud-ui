// Data-only collections and hidden values, exercised by every adapter over a mounted form.
// docs/spec/form-runtime.md: a `multiple: only` collection has exactly the rows its data holds,
// missing data means zero rows, and row operations on it fail with INVALID_FORM_INPUT and
// `Rows of {path} come only from data` without changing the data or view. A field hidden by
// `design.show` keeps its value in the instance and in getData(), and shows it again.
import type { FormInstance } from '@polyspec/crudui-generator-core';
import { record, required, type FormControl, type SessionCase } from './scenario.mts';

export const onlySpec = {
  type: 'group',
  properties: {
    variants: {
      type: 'group', label: 'Variants', multiple: { only: true, title: 'name' },
      properties: { name: { type: 'text', label: 'Name' }, price: { type: 'number', label: 'Price' } },
    },
  },
};
const onlyData = {
  variants: {
    __opt_b2__: { name: 'Blue', price: 2 },
    __opt_a1__: { name: 'Red', price: 1 },
  },
};

const rowOperations: Array<[name: string, operation: (session: FormInstance) => unknown]> = [
  ['addRow', session => session.addRow('variants', {})],
  ['addRow with a key', session => session.addRow('variants', { key: '__opt_c3__', value: { name: 'Added', price: 3 } })],
  ['copyRow', session => session.copyRow('variants', '__opt_b2__')],
  ['removeRow', session => session.removeRow('variants', '__opt_a1__')],
  ['moveRow', session => session.moveRow('variants', '__opt_a1__', 0)],
  ['rekeyRow', session => session.rekeyRow('variants', '__opt_b2__', '__opt_d4__')],
];

/** Every row operation fails with the declared error and leaves the data and the view unchanged. */
async function expectRejectedOperations({ element, session, flush, expect }: SessionCase, operations: typeof rowOperations): Promise<void> {
  for (const [, operation] of operations) {
    const data = JSON.stringify(session.getData());
    const html = element.innerHTML;
    let error: Record<string, unknown> | undefined;
    try { operation(session); } catch (caught) { error = record(caught, 'the thrown error'); }
    await flush();
    expect(error?.code).toBe('INVALID_FORM_INPUT');
    expect(error?.message).toBe('Rows of variants come only from data');
    expect(JSON.stringify(session.getData())).toBe(data);
    expect(element.innerHTML).toBe(html);
  }
}

const rowKeys = (element: HTMLElement) => Array.from(element.querySelectorAll('[data-crudui-row-key]'), node => node.getAttribute('data-crudui-row-key'));
const rowControls = (element: HTMLElement) => element.querySelectorAll('[data-crudui-action="add-row"], [data-crudui-action="copy-row"], [data-crudui-action="remove-row"], [data-crudui-action="move-up"], [data-crudui-action="move-down"]');

/**
 * `session` is created from `compileForm(onlySpec)` without data and mounted in `element`.
 */
export async function exerciseOnlyRows({ element, session, flush, expect }: SessionCase): Promise<void> {
  // Missing data: zero rows, a header and an empty body, no add-row control.
  expect(Object.keys(session.getValue('variants') ?? {})).toEqual([]);
  const collection = Array.from(element.querySelectorAll('[data-field-path]')).find(node => node.getAttribute('data-field-path') === 'variants');
  expect(collection).toBeTruthy();
  expect(rowKeys(element)).toEqual([]);
  expect(rowControls(element)).toHaveLength(0);
  await expectRejectedOperations({ element, session, flush, expect }, rowOperations.slice(0, 2));

  // Data rows: exactly the data's keys in data order, without row controls.
  session.setData(onlyData);
  await flush();
  expect(Object.keys(record(session.getValue('variants'), 'variants'))).toEqual(['__opt_b2__', '__opt_a1__']);
  expect(rowKeys(element)).toEqual(['__opt_b2__', '__opt_a1__']);
  expect(rowControls(element)).toHaveLength(0);
  expect(required(element.querySelector<HTMLInputElement>('[name="variants[__opt_b2__][name]"]'), 'the name control').value).toBe('Blue');
  await expectRejectedOperations({ element, session, flush, expect }, rowOperations);
  expect(session.getData()).toEqual(onlyData);

  // Replacing the data replaces the rows; an empty object is zero rows.
  session.setData({ variants: { __opt_a1__: { name: 'Red', price: 1 } } });
  await flush();
  expect(rowKeys(element)).toEqual(['__opt_a1__']);
  session.setData({ variants: {} });
  await flush();
  expect(rowKeys(element)).toEqual([]);
  expect(rowControls(element)).toHaveLength(0);
}

export const visibilitySpec = {
  type: 'group',
  properties: {
    is_display: { type: 'checkbox', label: 'Display' },
    display: {
      type: 'group', label: 'Details', design: { show: '.is_display' },
      properties: {
        code: { type: 'text', label: 'Code', validate: { required: true } },
        items: { type: 'text', label: 'Items', multiple: true },
      },
    },
  },
};
export const visibilityData = { is_display: 1, display: { code: 'abc1', items: { __opt_a1__: 'row' } } };

/**
 * `session` is created from `compileForm(visibilitySpec)` with `visibilityData` and mounted in
 * `element`. Clicking the checkbox hides and shows the group.
 */
export async function exerciseHiddenValues({ element, session, flush, expect }: SessionCase): Promise<void> {
  const group = () => required(
    Array.from(element.querySelectorAll<HTMLElement>('[data-field-path]')).find(node => node.getAttribute('data-field-path') === 'display'),
    'the display group');
  const control = (name: string) => required(
    Array.from(element.querySelectorAll<FormControl>('[name]')).find(node => node.getAttribute('name') === name),
    `the control ${name}`);
  expect(group().hidden).toBe(false);
  expect(control('display[code]').value).toBe('abc1');

  control('is_display').click();
  await flush();
  expect(group().hidden).toBe(true);
  expect(session.getData().display).toEqual({ code: 'abc1', items: { __opt_a1__: 'row' } });
  expect(control('display[code]').value).toBe('abc1');
  expect(control('display[items][__opt_a1__]').value).toBe('row');

  // A value set while the group is hidden is kept.
  session.setValue('display.code', 'kept');
  await flush();
  expect(record(session.getData().display, 'display').code).toBe('kept');
  expect(group().hidden).toBe(true);

  control('is_display').click();
  await flush();
  expect(group().hidden).toBe(false);
  expect(session.getData().display).toEqual({ code: 'kept', items: { __opt_a1__: 'row' } });
  expect(control('display[code]').value).toBe('kept');
  expect(control('display[items][__opt_a1__]').value).toBe('row');
}
