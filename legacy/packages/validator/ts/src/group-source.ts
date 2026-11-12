/**
 * Choices from a repeated group (docs/spec/schema.md, "Choices from a repeated group"): a choice
 * field whose `items` is a group source `{ from, label? }` takes its choices from the rows of a
 * repeated group of the same form. This module checks the declaration and reads the choices from
 * the data; the generator lists them and the validator checks a value against them
 * (docs/spec/validation-rules.md, "Values").
 */

import { canonicalText, trim } from './values/index';
import { isRecord } from './record';
import { FormInputError } from './validate/errors';

/** The field types that take a group source. */
const CHOICE_TYPES: readonly unknown[] = ['select', 'dropdown', 'selectbox', 'choice', 'radio', 'multichoice', 'checkboxes', 'checkcontainer'];

/** The field types whose stored value is a boolean, which a group source refuses (CUSC-068). */
const BOOLEAN_TYPES: readonly unknown[] = ['checkbox', 'switcher'];

/** One choice of a group source: the canonical text of a row's value and the label text. */
export interface GroupChoice {
  value: string;
  label: unknown;
}

function has(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** Whether `items` is a group source: an object with the member `from`. */
export function isGroupSource(items: unknown): items is Record<string, unknown> {
  return isRecord(items) && has(items, 'from');
}

function repeated(field: Record<string, unknown>): boolean {
  return field.multiple === true || field.multiple === 'only' || isRecord(field.multiple);
}

function hasLang(field: Record<string, unknown>): boolean {
  return field.lang === true || isRecord(field.lang);
}

/** Whether `properties` has a direct child `name` that is not repeated, not a group and has no `lang`. */
function scalarChild(properties: Record<string, unknown>, name: unknown): boolean {
  if (typeof name !== 'string' || !has(properties, name)) return false;
  const child = properties[name];
  return isRecord(child) && child.type !== 'group' && !has(child, 'properties') && !repeated(child) && !hasLang(child);
}

/**
 * The child fields of the repeated group that `from` names under the root `properties`, or
 * `undefined` when `from` is not `{group}.*.{field}` for a field of a repeated group outside
 * repeated groups.
 */
function sourceGroup(from: unknown, properties: Record<string, unknown>): Record<string, unknown> | undefined {
  if (typeof from !== 'string') return undefined;
  const segments = from.split('.');
  if (segments.length < 3 || segments[segments.length - 2] !== '*') return undefined;
  const names = segments.slice(0, -2);
  let current = properties;
  for (const [index, name] of names.entries()) {
    if (name === '' || !has(current, name)) return undefined;
    const field = current[name];
    if (!isRecord(field) || field.type !== 'group' || !isRecord(field.properties)) return undefined;
    if (repeated(field) !== (index === names.length - 1)) return undefined;
    current = field.properties;
  }
  return scalarChild(current, segments[segments.length - 1]) ? current : undefined;
}

/** Whether the child `name` of the group `properties`, a scalar child, is of a type that stores a boolean. */
function holdsBoolean(properties: Record<string, unknown>, name: unknown): boolean {
  const child = typeof name === 'string' ? properties[name] : undefined;
  return isRecord(child) && BOOLEAN_TYPES.includes(child.type);
}

/** The message of a group source whose `member` names the field `field` that holds a boolean (CUSC-068). */
function booleanFailure(member: string, path: string, field: string): string {
  return `Invalid items.${member} at ${path}: ${field} holds a boolean, expected a field whose values are strings or numbers`;
}

/**
 * The message of the first rule that the group source of `field` at the declaration `path` breaks
 * under the root `properties`, or `undefined`: the members of `items` in declaration order, the
 * field, `from`, the type of its field, `label` and then the type of its field.
 */
export function groupSourceFailure(field: Record<string, unknown>, path: string, properties: Record<string, unknown>): string | undefined {
  const items = field.items;
  if (!isGroupSource(items)) return undefined;
  for (const key of Object.keys(items)) {
    if (key !== 'from' && key !== 'label' && key !== 'choices') return `Invalid items.${key} at ${path}: unknown key`;
  }
  if (!CHOICE_TYPES.includes(field.type) || hasLang(field)) return `Invalid items.from at ${path}: expected a choice field without lang`;
  const group = sourceGroup(items.from, properties);
  if (group === undefined) {
    return `Invalid items.from at ${path}: expected {group}.*.{field} for a field of a repeated group outside repeated groups`;
  }
  const segments = String(items.from).split('.');
  const groupPath = segments.slice(0, -2).join('.');
  const valueName = segments[segments.length - 1] ?? '';
  if (holdsBoolean(group, valueName)) return booleanFailure('from', path, `${groupPath}.${valueName}`);
  if (has(items, 'label') && !scalarChild(group, items.label)) {
    return `Invalid items.label at ${path}: expected the name of a direct child field of the group without multiple, properties or lang`;
  }
  if (has(items, 'label') && holdsBoolean(group, items.label)) return booleanFailure('label', path, `${groupPath}.${String(items.label)}`);
  if (has(items, 'choices') && literalChoices(items.choices) === undefined) {
    return `Invalid items.choices at ${path}: expected value and label pairs with distinct string or number values`;
  }
  return undefined;
}

/** The canonical text of a string or a finite number that is not empty after trimming. */
function choiceText(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) return undefined;
  const text = canonicalText(value);
  return text !== undefined && trim(text) !== '' ? text : undefined;
}

/**
 * The literal choices of a group source (schema.md, CUSC-089) with the canonical text of each value, or `undefined` when
 * `choices` is not a list of `{ value, label }` pairs whose values are strings or finite numbers with distinct canonical texts
 * that are not empty after trimming. A source without `choices` has no literal choices.
 */
function literalChoices(choices: unknown): GroupChoice[] | undefined {
  if (choices === undefined) return [];
  if (!Array.isArray(choices)) return undefined;
  const literal: GroupChoice[] = [];
  for (const choice of choices) {
    if (!isRecord(choice) || Object.keys(choice).length !== 2 || !has(choice, 'value') || !has(choice, 'label')) return undefined;
    const value = choiceText(choice.value);
    if (value === undefined || literal.some((known) => known.value === value)) return undefined;
    literal.push({ value, label: choice.label });
  }
  return literal;
}

/** The rows of the group that a checked group source names in the root `data`, as [key, row] entries in data order. */
function sourceRows(source: Record<string, unknown>, data: unknown): Array<[string, unknown]> {
  const segments = String(source.from).split('.');
  let rows: unknown = data;
  for (const name of segments.slice(0, -2)) {
    if (!isRecord(rows) || !has(rows, name)) return [];
    rows = rows[name];
  }
  return isRecord(rows) ? Object.entries(rows) : [];
}

/** The name of the value field of a checked group source. */
function valueField(source: Record<string, unknown>): string {
  const segments = String(source.from).split('.');
  return segments[segments.length - 1] ?? '';
}

/**
 * The choices of a checked group source for the root `data`: its literal choices in written order (CUSC-089), then one per
 * row of the group in data order whose value is a string or a finite number with a non-empty canonical text, each value
 * once, labelled with the text of its `label` field or else its value.
 *
 * @throws {FormInputError} when a row's value has the canonical text of a literal choice.
 */
export function groupChoices(source: Record<string, unknown>, data: unknown): GroupChoice[] {
  const literalRepeat = firstRepeat(source, data, false);
  if (literalRepeat !== undefined) throw new FormInputError(literalRepeat);
  const valueName = valueField(source);
  const literal = literalChoices(source.choices) ?? [];
  const choices: GroupChoice[] = [...literal];
  const seen = new Set<string>();
  for (const [, row] of sourceRows(source, data)) {
    if (!isRecord(row)) continue;
    const value = choiceText(row[valueName]);
    if (value === undefined || seen.has(value)) continue;
    seen.add(value);
    const label = typeof source.label === 'string' ? choiceText(row[source.label]) : undefined;
    choices.push({ value, label: label ?? value });
  }
  return choices;
}

/**
 * The input failure message of the first row of a checked group source, in data order, whose
 * choice value repeats a literal choice (CUSC-089) or that of an earlier row (CUVR-087), or
 * `undefined`.
 */
export function groupSourceRepeat(source: Record<string, unknown>, data: unknown): string | undefined {
  return firstRepeat(source, data, true);
}

/**
 * The message of the first row of a checked group source, in data order, whose choice value is a literal choice, or, with
 * `rows`, the value of an earlier row; `undefined` when none repeats.
 */
function firstRepeat(source: Record<string, unknown>, data: unknown, rows: boolean): string | undefined {
  const segments = String(source.from).split('.');
  const groupPath = segments.slice(0, -2).join('.');
  const valueName = valueField(source);
  const literal = new Set((literalChoices(source.choices) ?? []).map((choice) => choice.value));
  const seen = new Set<string>();
  for (const [key, row] of sourceRows(source, data)) {
    if (!isRecord(row)) continue;
    const value = choiceText(row[valueName]);
    if (value === undefined) continue;
    const at = `${groupPath}.${key}.${valueName}`;
    if (literal.has(value)) return `Group source value repeats a literal choice at ${at}: ${value}`;
    if (rows && seen.has(value)) return `Group source value repeats an earlier row: ${value} at ${at}`;
    seen.add(value);
  }
  return undefined;
}
