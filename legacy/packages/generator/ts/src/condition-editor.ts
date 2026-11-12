/**
 * The model of the structured condition editor (docs/spec/schema.md and docs/spec/form-markup.md,
 * Structured condition editor): the nodes of a value that the editor shows, or the named error of a
 * value that it does not show, and the tree edits that `connectForm` makes through its controls
 * (docs/spec/form-runtime.md, Condition values).
 */

import { conditionText, decodeConditionText } from './util';
import { isEmptyValue as isEmptyConditionValue } from '@polyspec/crudui-validator/internal';

/** The comparison operators that the editor offers, in their order (CUSC-073, CUSC-085). */
export const CONDITION_OPS = ['eq', 'ne', 'lt', 'le', 'gt', 'ge', 'in', 'has'] as const;

/** The deepest level of a condition tree; the root is level 1 (CUSC-075). */
const MAX_DEPTH = 32;

/** One node of the editor: a group, a field comparison or a judged text. */
export type ConditionNode =
  | { kind: 'group'; path: string; mode: 'all' | 'any'; items: ConditionNode[] }
  | { kind: 'comparison'; path: string; field: string; op: string; value: string }
  | { kind: 'judge'; path: string; text: string };

/** The interface messages of the editor controls. */
export interface ConditionLabels {
  /** The accessible name of the mode select of a group. */
  mode: string;
  /** The text of the button that adds a comparison to a group. */
  addComparison: string;
  /** The text of the button that adds a group to a group. */
  addGroup: string;
  /** The text of the button that adds a judged text to a group. */
  addJudge: string;
  /** The text of the button that removes a condition from its group. */
  remove: string;
}

/** The editor of a value that it shows (CUMK-067) or the named error of a value that it does not show (CUMK-068). */
export type ConditionEditorModel =
  | { for: string; judge: boolean; fields: string[] | null; labels: ConditionLabels; root: ConditionNode }
  | { for: string; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isScalar = (value: unknown): boolean =>
  typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

/** The node of `value` at `path` and `depth`, or undefined when the editor does not show it (CUSC-086). */
function node(value: unknown, path: string, depth: number, judge: boolean): ConditionNode | undefined {
  if (depth > MAX_DEPTH || !isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length === 1 && (keys[0] === 'all' || keys[0] === 'any')) {
    const mode = keys[0];
    const list = value[mode];
    if (!Array.isArray(list)) return undefined;
    const items: ConditionNode[] = [];
    for (const [index, item] of list.entries()) {
      const child = node(item, `${path}/${mode}/${index}`, depth + 1, judge);
      if (!child) return undefined;
      items.push(child);
    }
    return { kind: 'group', path, mode, items };
  }
  if (keys.length === 1 && keys[0] === 'judge') {
    return judge && typeof value.judge === 'string' ? { kind: 'judge', path, text: value.judge } : undefined;
  }
  if (keys.length === 3 && keys.includes('field') && keys.includes('op') && keys.includes('value')) {
    const { field, op, value: operand } = value;
    if (typeof field !== 'string' || typeof op !== 'string' || !(CONDITION_OPS as readonly string[]).includes(op)) return undefined;
    const valid = op === 'in' ? Array.isArray(operand) && operand.every(isScalar) : isScalar(operand);
    return valid ? { kind: 'comparison', path, field, op, value: conditionText(operand) } : undefined;
  }
  return undefined;
}

/**
 * The editor model of a structured condition field: its root node when the editor shows `value`, an
 * empty value being an empty `all` group, and otherwise the error text of the field.
 */
export function conditionEditor(
  value: unknown,
  options: { for: string; judge: boolean; fields: string[] | null; labels: ConditionLabels; error: string },
): ConditionEditorModel {
  const root = isEmptyConditionValue(value)
    ? { kind: 'group' as const, path: '', mode: 'all' as const, items: [] }
    : node(value, '', 1, options.judge);
  if (!root) return { for: options.for, error: options.error };
  return { for: options.for, judge: options.judge, fields: options.fields, labels: options.labels, root };
}

/** The tree of an instance value for an edit: an empty value is `{ "all": [] }`. */
function treeOf(value: unknown): unknown {
  return isEmptyConditionValue(value) ? { all: [] } : structuredClone(value);
}

/** The parent list and index of the condition at a JSON Pointer below the root, or undefined. */
function locate(tree: unknown, path: string): { list: unknown[]; index: number } | undefined {
  const segments = path.split('/').slice(1);
  if (segments.length < 2 || segments.length % 2 !== 0) return undefined;
  let current = tree;
  for (let at = 0; at < segments.length; at += 2) {
    const list = isRecord(current) ? current[segments[at]] : undefined;
    const index = Number(segments[at + 1]);
    if (!Array.isArray(list) || !Number.isInteger(index) || index < 0 || index >= list.length) return undefined;
    if (at + 2 === segments.length) return { list, index };
    current = list[index];
  }
  return undefined;
}

/** The condition at a JSON Pointer, the root for the empty pointer. */
function conditionAt(tree: unknown, path: string): unknown {
  if (path === '') return tree;
  const place = locate(tree, path);
  return place ? place.list[place.index] : undefined;
}

/** The list of the group at `path`, or undefined when no group is there. */
function groupList(tree: unknown, path: string): unknown[] | undefined {
  const group = conditionAt(tree, path);
  if (!isRecord(group)) return undefined;
  const list = group.all ?? group.any;
  return Array.isArray(list) ? list : undefined;
}

/** A button action of the editor (docs/spec/form-runtime.md, Condition values). */
export type ConditionAction = 'add-comparison' | 'add-group' | 'add-judge' | 'remove';

const CONDITION_ACTIONS: readonly string[] = ['add-comparison', 'add-group', 'add-judge', 'remove'];

/** Whether a data-condition-action text names a button action of the editor. */
export const isConditionAction = (text: string): text is ConditionAction => CONDITION_ACTIONS.includes(text);

/** The tree after the button `action` of the condition at `path`, or undefined when nothing is there. */
export function applyConditionAction(value: unknown, path: string, action: ConditionAction, fields: readonly string[] | null): unknown {
  const tree = treeOf(value);
  if (action === 'remove') {
    const place = locate(tree, path);
    if (!place) return undefined;
    place.list.splice(place.index, 1);
    return tree;
  }
  const list = groupList(tree, path);
  if (!list) return undefined;
  if (action === 'add-comparison') list.push({ field: fields?.[0] ?? '', op: 'eq', value: '' });
  else if (action === 'add-group') list.push({ all: [] });
  else list.push({ judge: '' });
  return tree;
}

/** A control part of the editor. */
export type ConditionPart = 'mode' | 'field' | 'op' | 'value' | 'judge';

const CONDITION_PARTS: readonly string[] = ['mode', 'field', 'op', 'value', 'judge'];

/** Whether a data-condition-part text names a control part of the editor. */
export const isConditionPart = (text: string): text is ConditionPart => CONDITION_PARTS.includes(text);

/** The tree after the control `part` of the condition at `path` reads `text`, or undefined when nothing is there. */
export function applyConditionPart(value: unknown, path: string, part: ConditionPart, text: string): unknown {
  const tree = treeOf(value);
  const condition = conditionAt(tree, path);
  if (!isRecord(condition)) return undefined;
  if (part === 'mode') {
    const list = condition.all ?? condition.any;
    if (!Array.isArray(list) || (text !== 'all' && text !== 'any')) return undefined;
    delete condition.all;
    delete condition.any;
    condition[text] = list;
  } else if (part === 'op') {
    const previous = condition.op;
    condition.op = text;
    if (text === 'in' && previous !== 'in') {
      condition.value = Array.isArray(condition.value) ? condition.value
        : isEmptyConditionValue(condition.value) ? [] : [condition.value];
    } else if (text !== 'in' && previous === 'in' && Array.isArray(condition.value)) {
      condition.value = condition.value.length ? condition.value[0] : '';
    }
  } else if (part === 'value') {
    condition.value = decodeConditionText(text);
  } else {
    condition[part] = text;
  }
  return tree;
}
