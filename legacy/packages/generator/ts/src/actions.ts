/** Resolve and run `data-crudui-action` buttons for forms and structure maps. */

import type { FormInstance } from './instance';
import { FormInputError } from '@polyspec/crudui-validator';
import { isRecord } from './util';

/** Operations a `data-crudui-action` button can request. */
export type FormActionName =
  | 'move-up'
  | 'move-down'
  | 'add-row'
  | 'copy-row'
  | 'remove-row'
  | 'toggle-row'
  | 'select-row'
  | 'expand-all'
  | 'collapse-all'
  | 'undo'
  | 'redo';

const ACTIONS: readonly FormActionName[] = [
  'move-up', 'move-down', 'add-row', 'copy-row', 'remove-row',
  'toggle-row', 'select-row', 'expand-all', 'collapse-all', 'undo', 'redo',
];

/** The operation, collection path and row key an action button targets. */
export interface ActionTarget {
  /** Requested operation. */
  name: FormActionName;
  /** Collection path of the nearest `[data-field-path]`. */
  path?: string;
  /** Row key of the nearest `[data-crudui-row-key]` inside that path element. */
  key?: string;
}

/** The row that receives focus after an action, or the collection itself when `key` is absent. */
export interface FocusTarget {
  /** Collection path. */
  path: string;
  /** Row key; absent when the collection has no rows left. */
  key?: string;
}

/** The outcome of an action that ran. */
export interface ActionResult {
  /** Focus destination; absent when focus stays on the current control. */
  focus?: FocusTarget;
}

/** The values a button declares: its action, collection path and row key (CURT-081). */
export interface ActionInput {
  /** Requested operation name. */
  action?: string | null;
  /** Collection path of the nearest `[data-field-path]`. */
  path?: string | null;
  /** Row key of the nearest `[data-crudui-row-key]` inside that path element. */
  key?: string | null;
}

/** Whether `source` is a DOM element rather than the values of a button. */
function isElement(source: Element | ActionInput): source is Element {
  return 'getAttribute' in source && typeof source.getAttribute === 'function';
}

/** The values a button declares, read from its attributes and from the elements around it. */
function readAction(button: Element): ActionInput {
  const scope = button.closest('[data-field-path]');
  const row = button.closest('[data-crudui-row-key]');
  // A row outside the path element belongs to an ancestor collection.
  return {
    action: button.getAttribute('data-crudui-action'),
    path: scope?.getAttribute('data-field-path'),
    key: scope && row && scope.contains(row) ? row.getAttribute('data-crudui-row-key') : undefined,
  };
}

/**
 * Resolve an action target from the values a button declares (CURT-081). A DOM element is read by the browser binding:
 * the action is its `data-crudui-action` attribute, the path the nearest `[data-field-path]` at or above it and the key
 * the nearest `[data-crudui-row-key]` inside that path element.
 */
export function resolveAction(source: Element | ActionInput): ActionTarget | undefined {
  const { action, path, key } = isElement(source) ? readAction(source) : source;
  const name = ACTIONS.find(candidate => candidate === action);
  if (!name) return undefined;
  return { name, ...(path ? { path } : {}), ...(key ? { key } : {}) };
}

/**
 * Run a resolved action. Returns undefined when the target lacks a required path
 * or key. Adding and copying focus the new row, moving focuses the moved row, and
 * removing focuses the previous row, then the next row, then the collection. A name
 * that is none of the eleven actions fails and changes nothing (CURT-091).
 */
export function runAction(form: FormInstance, target: ActionTarget): ActionResult | undefined {
  const { name, path, key } = target;
  if (!ACTIONS.includes(name)) throw new FormInputError(`Unknown action: ${name}`);
  if (name === 'expand-all' || name === 'collapse-all') {
    form.setAllExpanded(name === 'expand-all');
    return {};
  }
  if (name === 'undo') {
    form.undo();
    return {};
  }
  if (name === 'redo') {
    form.redo();
    return {};
  }
  if (!path) return undefined;
  if (name === 'add-row') {
    return { focus: { path, key: form.addRow(path, key === undefined ? {} : { afterKey: key }) } };
  }
  if (!key) return undefined;
  switch (name) {
    case 'copy-row':
      return { focus: { path, key: form.copyRow(path, key) } };
    case 'remove-row': {
      const keys = rowKeys(form, path);
      const index = keys.indexOf(key);
      const neighbour = keys[index - 1] ?? keys[index + 1];
      form.removeRow(path, key);
      return { focus: neighbour === undefined ? { path } : { path, key: neighbour } };
    }
    case 'toggle-row':
      form.toggleRow(path, key);
      return {};
    case 'select-row':
      // Selecting changes no state: it only moves focus to the row.
      return { focus: { path, key } };
    default: {
      const keys = rowKeys(form, path);
      form.moveRow(path, key, keys.indexOf(key) + (name === 'move-up' ? -1 : 1));
      return { focus: { path, key } };
    }
  }
}

/** The row keys of the keyed collection at `path`, whose row an action names. */
function rowKeys(form: FormInstance, path: string): string[] {
  const rows = form.getValue(path);
  if (!isRecord(rows)) throw new FormInputError(`Repeated data must be a keyed object: ${path}`);
  return Object.keys(rows);
}
