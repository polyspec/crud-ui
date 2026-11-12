import { required, type FormCase } from './scenario.mts';

/** Input semantics exercised through each framework's public form component. */
export const controlSpec = {
  type: 'group',
  properties: {
    enabled: { type: 'checkbox', label: 'Enabled' },
    memo: { type: 'textarea', label: 'Memo' },
    choices: { type: 'multichoice', label: 'Choices', items: { a: 'Alpha', b: 'Beta', c: 'Gamma' } },
  },
};

/** Check label targets, array editing, native form fields and record restoration. */
export async function exerciseControls({ element, form, expect, flush }: FormCase & { element: HTMLFormElement }): Promise<void> {
  const input = element.querySelector('input[type=checkbox]');
  const memo = required(element.querySelector('textarea'), 'the memo control');
  const labels = () => Array.from(element.querySelectorAll('label'));
  expect(labels().find(label => label.textContent === 'Enabled')?.control).toBe(input);
  expect(labels().find(label => label.textContent === 'Memo')?.control).toBe(memo);
  const choices = () => Array.from(element.querySelectorAll<HTMLInputElement>('input[name="choices[]"]'));
  expect(choices()).toHaveLength(3);
  expect(choices().filter(input => input.checked).map(input => input.value)).toEqual(['a', 'c']);
  required(choices()[1], 'the second choice').click();
  await flush();
  expect(form.getData().choices).toEqual(['a', 'b', 'c']);
  expect(new (required(element.ownerDocument.defaultView, 'the window').FormData)(element).getAll('choices[]')).toEqual(['a', 'b', 'c']);
  form.setData({ enabled: '', memo: 'Replacement', choices: [] });
  await flush();
  expect(choices().some(input => input.checked)).toBe(false);
  form.setData({ enabled: 1, memo: 'Original', choices: ['a', 'c'] });
  await flush();
  expect(choices().filter(input => input.checked).map(input => input.value)).toEqual(['a', 'c']);
  expect(memo.value).toBe('Original');
  const ids = Array.from(element.querySelectorAll('[id]'), node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
}
