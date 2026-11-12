// Choices from a repeated group, exercised by every adapter over a mounted form.
// docs/spec/schema.md, Choices from a repeated group (CUSC-071): a form instance lists the choices
// of a group source from its current data after every change, so the mounted form shows the rows
// of the source group as they change; listing the choices changes no value.
import { record, required, type FormControl, type SessionCase } from './scenario.mts';

export const sourceSpec = {
  type: 'group',
  properties: {
    characters: {
      type: 'group', label: 'Characters', multiple: true,
      properties: { id: { type: 'text', label: 'Id' }, name: { type: 'text', label: 'Name' } },
    },
    lead: { type: 'select', label: 'Lead', items: { from: 'characters.*.id', label: 'name' } },
    cast: { type: 'multichoice', label: 'Cast', items: { from: 'characters.*.id', label: 'name' } },
  },
};
export const sourceData = {
  characters: { __ann__: { id: 'ann', name: 'Ann' }, __bob__: { id: 'bob', name: 'Bob' } },
  lead: 'bob',
  cast: ['ann'],
};

/** The value and label of each option of the lead select and whether it is selected. */
function leadOptions(element: HTMLElement): Array<[string, string, boolean]> {
  const select = required(element.querySelector<HTMLSelectElement>('select[name="lead"]'), 'the lead select');
  return Array.from(select.options, option => [option.value, option.textContent ?? '', option.selected]);
}

/** The value and label of each cast checkbox and whether it is checked. */
function castChoices(element: HTMLElement): Array<[string, string, boolean]> {
  return Array.from(element.querySelectorAll<HTMLInputElement>('input[name="cast[]"]'), input => {
    const label = required(element.querySelector(`label[for="${input.id}"]`), `the label of ${input.id}`);
    return [input.value, label.textContent ?? '', input.checked];
  });
}

/** Type a text into a control as the user does: set its value and fire `input`. */
function typeInto(element: HTMLElement, name: string, text: string): void {
  const control = required(Array.from(element.querySelectorAll<FormControl>('[name]')).find(node => node.getAttribute('name') === name), `the control ${name}`);
  control.focus();
  control.value = text;
  control.dispatchEvent(new (required(element.ownerDocument.defaultView, 'the window').Event)('input', { bubbles: true }));
}

/**
 * `session` is created from `compileForm(sourceSpec)` with `sourceData` and mounted in `element`.
 * Typing a label, adding, removing and rekeying a source row, undo and setData change the listed
 * choices, and no step changes the values of `lead` and `cast`.
 */
export async function exerciseGroupSource({ element, session, flush, expect }: SessionCase): Promise<void> {
  expect(leadOptions(element)).toEqual([['ann', 'Ann', false], ['bob', 'Bob', true]]);
  expect(castChoices(element)).toEqual([['ann', 'Ann', true], ['bob', 'Bob', false]]);

  // A typed label is the label of the choice.
  typeInto(element, 'characters[__ann__][name]', 'Anna');
  await flush();
  expect(leadOptions(element)).toEqual([['ann', 'Anna', false], ['bob', 'Bob', true]]);
  expect(castChoices(element)).toEqual([['ann', 'Anna', true], ['bob', 'Bob', false]]);

  // A new row gives a choice once its value is typed; without a label the label is the value.
  session.addRow('characters', { key: '__cy__' });
  await flush();
  expect(leadOptions(element).map(([value]) => value)).toEqual(['ann', 'bob']);
  typeInto(element, 'characters[__cy__][id]', 'cy');
  await flush();
  expect(leadOptions(element)).toEqual([['ann', 'Anna', false], ['bob', 'Bob', true], ['cy', 'cy', false]]);
  expect(castChoices(element)).toEqual([['ann', 'Anna', true], ['bob', 'Bob', false], ['cy', 'cy', false]]);

  // Removing the selected row removes its choice and keeps the value.
  session.removeRow('characters', '__bob__');
  await flush();
  expect(leadOptions(element)).toEqual([['ann', 'Anna', false], ['cy', 'cy', false]]);
  expect(session.getValue('lead')).toBe('bob');
  expect(castChoices(element)).toEqual([['ann', 'Anna', true], ['cy', 'cy', false]]);

  // Undo restores the row, and the choice is selected again.
  session.undo();
  await flush();
  expect(leadOptions(element)).toEqual([['ann', 'Anna', false], ['bob', 'Bob', true], ['cy', 'cy', false]]);

  // Rekeying a row keeps its choice; moving it changes the order.
  session.rekeyRow('characters', '__cy__', '__cyd__');
  session.moveRow('characters', '__cyd__', 0);
  await flush();
  expect(leadOptions(element).map(([value]) => value)).toEqual(['cy', 'ann', 'bob']);

  // Replaced data lists its rows.
  session.setData({ characters: { __dee__: { id: 'dee', name: 'Dee' } }, lead: 'dee', cast: [] });
  await flush();
  expect(leadOptions(element)).toEqual([['dee', 'Dee', true]]);
  expect(castChoices(element)).toEqual([['dee', 'Dee', false]]);
  expect(record(session.getData(), 'the data').cast).toEqual([]);
}
