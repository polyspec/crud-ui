/**
 * Membership (validation-rules.md, "Values").
 *
 * Members come from a list (each element as is), a choice list (the `value` of
 * each choice, inside groups included), a comma-separated string (split at U+002C, each item trimmed) or
 * a map (its keys). A choice list is checked by the choice list rules before its
 * values are checked as members. Members are strings, numbers
 * or booleans, and no member's canonical text is empty after trimming. An empty
 * list or map is an empty member set, which matches no value.
 */

import { canonicalText } from './canonical';
import { trim } from './whitespace';
import { isEmptyValue } from './empty';
import { numericValue, numericValueAsWritten } from './numeric';
import { isRecord } from '../record';

/** The parameter messages of `in` (validation-rules.md, "Parameter errors"). */
const MEMBERSHIP_ERRORS = {
  shape: 'Invalid in parameter: expected a list, a comma-separated string or a map',
  type: 'Invalid in parameter: members must be strings, numbers or booleans',
  empty: 'Invalid in parameter: members must not be empty',
  pairs: 'Invalid in parameter: expected value and label pairs with distinct string or number values',
} as const;

/** A member: a string, a finite number or a boolean. */
type Member = string | number | boolean;

/** Result of reading a membership parameter. */
type MembersResult = { members: Member[] } | { error: string };

function isMemberType(item: unknown): item is Member {
  return typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item));
}

function hasMember(item: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(item, key);
}

/**
 * The values of a choice list (schema.md, "Choice lists" and "Choice groups") in written order,
 * the values of each group in place of the group, or `undefined` when a choice has another
 * member, lacks `value` or `label`, has a value that is not a string or a finite number, or
 * repeats the canonical text of an earlier value, or when a group has another member, lacks
 * `label` or has no list of one or more choices.
 */
function choiceValues(list: readonly unknown[]): Member[] | undefined {
  const values: Member[] = [];
  const seen = new Set<string>();
  const add = (item: unknown): boolean => {
    if (!isRecord(item) || Object.keys(item).length !== 2 || !hasMember(item, 'value') || !hasMember(item, 'label')) return false;
    const value = item.value;
    if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) return false;
    const text = canonicalText(value);
    if (text === undefined || seen.has(text)) return false;
    seen.add(text);
    values.push(value);
    return true;
  };
  for (const item of list) {
    if (isRecord(item) && hasMember(item, 'choices')) {
      const choices = item.choices;
      if (Object.keys(item).length !== 2 || !hasMember(item, 'label') || !Array.isArray(choices) || choices.length === 0) return undefined;
      if (!choices.every(add)) return undefined;
    } else if (!add(item)) {
      return undefined;
    }
  }
  return values;
}

/** Whether a list is a choice list: it has an object element with a `value` or a `choices` member. */
function isChoiceList(list: readonly unknown[]): boolean {
  return list.some((item) => isRecord(item) && (hasMember(item, 'value') || hasMember(item, 'choices')));
}

/** Read the members of an `in` parameter, or the parameter error it causes. */
export function readMembers(param: unknown): MembersResult {
  let members: unknown[];
  if (Array.isArray(param) && isChoiceList(param)) {
    const values = choiceValues(param);
    if (values === undefined) return { error: MEMBERSHIP_ERRORS.pairs };
    members = values;
  } else if (Array.isArray(param)) {
    members = param;
  } else if (typeof param === 'string') {
    members = param.split(',').map(trim);
  } else if (param !== null && typeof param === 'object') {
    members = Object.keys(param);
  } else {
    return { error: MEMBERSHIP_ERRORS.shape };
  }
  const checked: Member[] = [];
  for (const member of members) {
    if (!isMemberType(member)) return { error: MEMBERSHIP_ERRORS.type };
    const text = canonicalText(member);
    if (text === undefined || trim(text) === '') return { error: MEMBERSHIP_ERRORS.empty };
    checked.push(member);
  }
  return { members: checked };
}

/** Whether one scalar value matches one member. */
function matchesMember(value: string | number | boolean, member: Member): boolean {
  const text = canonicalText(value);
  if (text === undefined) return false;
  if (text === canonicalText(member)) return true;
  const left = numericValue(value);
  // Members are read as written; the value is already trimmed.
  const right = numericValueAsWritten(member);
  return left !== undefined && right !== undefined && left === right;
}

/** Whether a scalar value (a string is trimmed first) is one of the members. */
function isScalarMember(value: unknown, members: readonly Member[]): boolean {
  if (typeof value === 'string') value = trim(value);
  if (!isMemberType(value)) return false;
  const scalar = value;
  return members.some((member) => matchesMember(scalar, member));
}

/**
 * Whether a value is a member. An array value is a member when every element
 * is: an empty element (missing, `null`, a blank string, an empty array or an
 * empty object) passes as an empty value does, and a non-empty array or object
 * element fails.
 */
export function isMember(value: unknown, members: readonly Member[]): boolean {
  if (Array.isArray(value)) {
    return value.every((element) => isEmptyValue(element) || isScalarMember(element, members));
  }
  return isScalarMember(value, members);
}
