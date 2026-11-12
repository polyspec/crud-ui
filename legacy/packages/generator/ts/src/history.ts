/** Undo history rules of form instances, also exported for data kept outside a form instance. */

import { FormInputError } from '@polyspec/crudui-validator';

/** Maximum number of records kept for undo. */
export const HISTORY_LIMIT = 100;

/** Records before earlier changes and records after undone changes, oldest first. */
export interface History<T> {
  /** Earlier records, at most `HISTORY_LIMIT`. */
  readonly entries: readonly T[];
  /** Records that can be restored by redo, oldest first. */
  readonly redoEntries: readonly T[];
  /** Path of the last change when it was a value edit. */
  readonly lastPath?: string;
}

/** A history with nothing to undo. Replacing the record returns to it. */
export function emptyHistory<T>(): History<T> {
  return { entries: [], redoEntries: [] };
}

/**
 * Record the record before a change. A value edit on the same path as the previous
 * value edit shares its entry; every other change adds an entry, dropping the oldest
 * beyond `HISTORY_LIMIT`.
 */
export function recordChange<T>(history: History<T>, previous: T, path?: string): History<T> {
  const merged = path !== undefined && path === history.lastPath;
  const entries = merged ? history.entries : [...history.entries, previous].slice(-HISTORY_LIMIT);
  return path === undefined ? { entries, redoEntries: [] } : { entries, redoEntries: [], lastPath: path };
}

/** Whether a history has a record to restore. */
export function canUndo<T>(history: History<T>): boolean {
  return history.entries.length > 0;
}

/** Whether a history has a record to restore in the forward direction. */
export function canRedo<T>(history: History<T>): boolean { return history.redoEntries.length > 0; }

/** The outcome of undoing one change. */
export interface UndoResult<T> {
  /** History without the restored record. */
  readonly history: History<T>;
  /** The record before the last change. */
  readonly value: T;
}

/** Take the record before the last change; the next value edit starts a new entry. */
export function undoChange<T>(history: History<T>, current: T): UndoResult<T> {
  if (!history.entries.length) throw new FormInputError('Nothing to undo');
  return { history: { entries: history.entries.slice(0, -1), redoEntries: [...history.redoEntries, current].slice(-HISTORY_LIMIT) }, value: history.entries[history.entries.length - 1] };
}

/** The outcome of redoing one change. */
export interface RedoResult<T> {
  /** History after moving the current record back into the earlier records. */
  readonly history: History<T>;
  /** The record after the reverted change. */
  readonly value: T;
}

/** Take the next record after the current change. */
export function redoChange<T>(history: History<T>, current: T): RedoResult<T> {
  if (!history.redoEntries.length) throw new FormInputError('Nothing to redo');
  const value = history.redoEntries[history.redoEntries.length - 1];
  return { history: { entries: [...history.entries, current].slice(-HISTORY_LIMIT), redoEntries: history.redoEntries.slice(0, -1) }, value };
}
