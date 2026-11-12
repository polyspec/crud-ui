/**
 * Choice lists (docs/spec/schema.md, "Choice lists"): an `items` array of
 * `{ value, label }` objects whose choices keep the list order for any values. The choices of a
 * choice or multichoice field may also declare `class`, `style` and `attributes`
 * (docs/spec/schema.md, "Choice appearance"). The choice list of a select field may also contain
 * groups of choices (docs/spec/schema.md, "Choice groups").
 */

import { FormInputError } from '@polyspec/crudui-validator';
import { styleString } from './css';
import { attributeCopy, checkDeclaredAttributes } from './design';
import { isRecord } from './util';

/** The expected-value text of a choice list declaration failure. */
export const CHOICE_LIST_EXPECTED = 'value and label pairs with distinct string or number values';


function hasMember(item: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(item, key);
}

/** Whether `items` is a choice list: an array with an object element that has a `value` or a `choices` member. */
export function isChoiceList(items: unknown): items is unknown[] {
  return Array.isArray(items) && items.some((item) => isRecord(item) && (hasMember(item, 'value') || hasMember(item, 'choices')));
}

/** Whether a choice list element is a group: an object that has a `choices` member. */
function isGroup(item: unknown): item is Record<string, unknown> {
  return isRecord(item) && hasMember(item, 'choices');
}

/** The canonical text of a choice value: a string itself, a number as `Number.prototype.toString` writes it. */
function valueText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/** The members a choice of a choice or multichoice field may declare besides `value` and `label`. */
const APPEARANCE_MEMBERS: readonly string[] = ['class', 'style', 'attributes'];

/**
 * The `[value text, label]` pairs of a choice list in list order, the choices of each group in
 * place of the group, or `undefined` when an element has another member (an appearance member is
 * accepted with `appearance`), lacks `value` or `label`, has a value that is not a string or a
 * finite number, or repeats the canonical text of an earlier value, or when the list has a group
 * without `groups` or a group that is not `label` and a non-empty list of choices without
 * appearance members.
 */
export function choicePairs(items: readonly unknown[], appearance = false, groups = false): Array<[string, unknown]> | undefined {
  const pairs: Array<[string, unknown]> = [];
  const seen = new Set<string>();
  const add = (item: unknown, members: readonly string[]): boolean => {
    if (!isRecord(item)) return false;
    const extra = Object.keys(item).filter((key) => key !== 'value' && key !== 'label');
    if (!hasMember(item, 'value') || !hasMember(item, 'label') || extra.some((key) => !members.includes(key))) return false;
    const text = valueText(item.value);
    if (text === undefined || seen.has(text)) return false;
    seen.add(text);
    pairs.push([text, item.label]);
    return true;
  };
  for (const item of items) {
    if (groups && isGroup(item)) {
      const choices = item.choices;
      if (Object.keys(item).length !== 2 || !hasMember(item, 'label') || !Array.isArray(choices) || choices.length === 0) return undefined;
      if (!choices.every((choice) => add(choice, []))) return undefined;
    } else if (!add(item, appearance ? APPEARANCE_MEMBERS : [])) {
      return undefined;
    }
  }
  return pairs;
}

/** The group of an option: the position of the group in the choice list and its label. */
export interface ChoiceListGroup {
  /** Zero-based position of the group in the choice list. */
  index: number;
  /** Label of the group as declared. */
  label: unknown;
}

/**
 * The group of each pair of a checked choice list in the order of `choicePairs`, `undefined` for
 * a choice outside groups.
 */
export function choiceGroups(items: readonly unknown[]): Array<ChoiceListGroup | undefined> {
  return items.flatMap((item, index) =>
    isGroup(item) && Array.isArray(item.choices) ? item.choices.map(() => ({ index, label: item.label })) : [undefined]);
}

/** The appearance of one choice: the label class and style and the input attributes. */
export interface ChoiceAppearance {
  /** Label class (`class`). */
  className?: string;
  /** Label inline style (`style`), normalized as a design style. */
  style?: string;
  /** Input attributes (`attributes`). */
  attributes?: Record<string, string>;
}

/**
 * Reject the appearance of a valid choice list whose `class` or `style` is not a string or whose
 * `attributes` break the declared attribute rules, choice by choice in list order.
 */
export function checkChoiceAppearance(items: readonly unknown[], path: string): void {
  items.forEach((item, index) => {
    // choicePairs has accepted the list, whose every choice is an object.
    if (!isRecord(item)) throw new FormInputError(`Invalid items at ${path}: expected ${CHOICE_LIST_EXPECTED}`);
    const choice = item;
    for (const member of ['class', 'style']) {
      if (Object.prototype.hasOwnProperty.call(choice, member) && typeof choice[member] !== 'string') {
        throw new FormInputError(`Invalid items.${index}.${member} at ${path}: expected a string`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(choice, 'attributes')) {
      checkDeclaredAttributes(choice.attributes, `items.${index}.attributes`, path);
    }
  });
}

/** The appearance of each choice of the checked choice list of the field at `path` in list order; members only when declared. */
export function choiceAppearances(items: readonly unknown[], path: string): ChoiceAppearance[] {
  return items.map((item, index) => {
    const choice: Record<string, unknown> = isRecord(item) ? item : {};
    const style = styleString(choice.style);
    const attributes = attributeCopy(choice.attributes, `items.${index}.attributes`, path);
    return {
      ...(typeof choice.class === 'string' && choice.class ? { className: choice.class } : {}),
      ...(style ? { style } : {}),
      ...(Object.keys(attributes).length ? { attributes } : {}),
    };
  });
}
