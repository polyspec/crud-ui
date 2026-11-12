import { FormInputError } from '@polyspec/crudui-validator';
import { bindForm, copyFormRecord, copyFormValue, formDescription, type BindFormOptions, type FormFieldTemplate, type FormTemplate } from './form';
import { bindButtons, type ButtonVM } from './buttons';
import { formMessages, type FormMessages } from './messages';
import type { NodeVM } from './viewmodel';
import { getValueByPath, isPlainRecord, parsePathString } from './util';
import { canUndo, canRedo, emptyHistory, recordChange, undoChange, redoChange, type History } from './history';
import { initialView, rekeyRowView, removeRowView, setAllExpandedView, toggleRowView, type ViewState } from './view';
import { checkFormTemplate } from './template-shape';
import { checkArgumentText, checkBindText } from './input-text';

/** Transport key for an existing database sequence. */
export function sequenceRowKey(sequence: string | number | bigint): string {
  if (typeof sequence === 'number' && !Number.isSafeInteger(sequence)) {
    throw new FormInputError('A sequence must be a safe integer or a decimal string');
  }
  const digits = String(sequence);
  if (!/^\d{1,13}$/.test(digits)) throw new FormInputError('A sequence must contain 1–13 decimal digits');
  return `__${digits.padStart(13, '0')}__`;
}

/** Generate a new row key. This is identity, never a serialization index. */
export function createRowKey(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(7));
  return `__${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, 13)}__`;
}

/** Per-instance presentation options. */
export type CreateFormOptions = Pick<BindFormOptions, 'language' | 'keyPrefix' | 'idPrefix'>;

/** Values and insertion position for a new repeated row. */
export interface AddRowOptions {
  /** Explicit row key; omitted to generate one. */
  key?: string;
  /** Insert after this existing key; omitted to append. */
  afterKey?: string;
  /** Initial values; omitted to use field defaults. */
  value?: unknown;
}

/** Stable subscription snapshot, changed only after a successful operation or view change. */
export interface FormSnapshot {
  /** Evaluated fields for the current data and view. */
  readonly fields: NodeVM[];
  /** Evaluated form buttons for the current data. */
  readonly buttons: ButtonVM[];
  /** Number of successful data updates. */
  readonly revision: number;
  /** Whether `undo` can restore an earlier record. */
  readonly canUndo: boolean;
  /** Whether `redo` can reapply a reverted change. */
  readonly canRedo: boolean;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function repeats(field: FormFieldTemplate): boolean {
  return field.spec.multiple === true || dataOnly(field) || isPlainRecord(field.spec.multiple);
}

/** A `multiple: only` collection: its rows come only from the data. */
function dataOnly(field: FormFieldTemplate): boolean {
  const multiple = field.spec.multiple;
  return multiple === 'only' || (isPlainRecord(multiple) && multiple.only === true);
}

function checkedSegments(path: string): string[] {
  const segments = parsePathString(path);
  if (!segments.length || segments.some(s => ['__proto__', 'prototype', 'constructor'].includes(s))) {
    throw new FormInputError(`Invalid form path: ${path}`);
  }
  return segments;
}

function checkKey(key: string): void {
  // Dot/bracket characters are path syntax. Numeric object keys cannot retain
  // insertion order in JavaScript; normalize database sequences explicitly.
  if (!/^[A-Za-z0-9_-]+$/.test(key) || /^\d+$/.test(key) ||
      ['__proto__', 'prototype', 'constructor'].includes(key)) {
    throw new FormInputError(`Invalid row key: ${key}; use sequenceRowKey for numeric ids`);
  }
}

function putAt(data: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const [head, ...tail] = path;
  return { ...data, [head]: tail.length
    ? putAt(isPlainRecord(data[head]) ? data[head] : {}, tail, value) : value };
}

/** Data and view changes applied together by one commit. */
interface Change {
  /** Path of a value edit; consecutive edits of one path share an undo entry. */
  path?: string;
  /** Replacement view state. */
  view?: ViewState;
  /** Replace the record: clear history and view state. */
  reset?: boolean;
}

/**
 * One editable form instance over a shared template. All row operations are
 * scoped to a collection path; no global string replacement touches siblings.
 * Data, undo history and view state (collapsed rows) are separate; view state is
 * never submitted.
 */
export class FormInstance {
  private data: Record<string, unknown>;
  private snapshot: FormSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly options: CreateFormOptions;
  private history: History<Record<string, unknown>> = emptyHistory();
  private view: ViewState = initialView();

  /** Shared immutable structure. */
  readonly template: FormTemplate;

  /** Create an instance with independent record data. */
  constructor(template: FormTemplate, data: Record<string, unknown> = {}, options: CreateFormOptions = {}) {
    checkBindText(template, data, options);
    checkFormTemplate(template);
    this.template = template;
    this.options = { ...options };
    this.data = this.normalizeFields(template.fields, data);
    this.snapshot = {
      fields: this.build(this.data, this.view.collapsed),
      buttons: bindButtons(template, this.data, this.options),
      revision: 0,
      canUndo: false,
      canRedo: false,
    };
  }

  /** Subscribe to injection, editing, row operations and view changes. Returns an unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Return the current subscription snapshot. */
  getSnapshot = (): FormSnapshot => this.snapshot;

  /** Effective root prefix for submitted input names. */
  get keyPrefix(): string | undefined { return this.options.keyPrefix ?? this.template.keyPrefix; }

  /** Interface text for the instance language. */
  get messages(): FormMessages { return formMessages(this.options.language ?? 'ko'); }

  /** The template's root description translated for the instance language; empty text when none. */
  get description(): string { return formDescription(this.template, { language: this.options.language ?? 'ko' }); }

  /** Detached submission data, retaining keyed nested collections. */
  getData(): Record<string, unknown> { return copyFormRecord(this.data); }

  /** Read a detached value relative to the data root. */
  getValue(path: string): unknown {
    checkArgumentText([['path', path]]);
    checkedSegments(path);
    return copyFormValue(getValueByPath(this.data, path));
  }

  /** Replace the record after an asynchronous load or save; history and view state restart. */
  setData(data: Record<string, unknown>): void {
    checkArgumentText([['data', data]]);
    this.commit(this.normalizeFields(this.template.fields, data), { reset: true });
  }

  /** Update one data path and reevaluate affected form presentation. */
  setValue(path: string, value: unknown): void {
    checkArgumentText([['path', path], ['value', value]]);
    const segments = checkedSegments(path);
    this.commit(this.normalizeFields(this.template.fields, putAt(this.data, segments, copyFormValue(value))),
      { path: segments.join('.') });
  }

  /** Insert a blank/defaulted row, or supplied row data, with one new identity. */
  addRow(path: string, options: AddRowOptions = {}): string {
    checkArgumentText([['path', path]], options, ['afterKey', 'key', 'value']);
    const { field, rows } = this.editableCollection(path);
    const settings = isPlainRecord(field.spec.multiple) ? field.spec.multiple : {};
    if (typeof settings.max === 'number' && Object.keys(rows).length >= settings.max) {
      throw new FormInputError(`Maximum row count reached: ${path}`);
    }
    const key = options.key ?? this.freshKey(new Set(Object.keys(rows)));
    checkKey(key);
    if (hasOwn(rows, key)) throw new FormInputError(`Row key already exists: ${key}`);
    const entries = Object.entries(rows);
    const at = options.afterKey === undefined ? entries.length : entries.findIndex(([k]) => k === options.afterKey) + 1;
    if (options.afterKey !== undefined && at === 0) throw new FormInputError(`Unknown row: ${options.afterKey}`);
    entries.splice(at, 0, [key, this.normalizeRow(field, options.value, [...checkedSegments(path), key].join('.'))]);
    this.commit(putAt(this.data, checkedSegments(path), Object.fromEntries(entries)));
    return key;
  }

  /** Copy current values and give every descendant repeated row a fresh key. */
  copyRow(path: string, key: string, options: Omit<AddRowOptions, 'value'> = {}): string {
    checkArgumentText([['path', path], ['key', key]], options, ['afterKey', 'key']);
    const { field, rows } = this.editableCollection(path);
    if (!hasOwn(rows, key)) throw new FormInputError(`Unknown row: ${key}`);
    const value = this.copyRowValue(field, rows[key]);
    return this.addRow(path, { ...options, afterKey: options.afterKey ?? key, value });
  }

  /** Remove one row unless the minimum count would be violated. */
  removeRow(path: string, key: string): void {
    checkArgumentText([['path', path], ['key', key]]);
    const { field, rows } = this.editableCollection(path);
    if (!hasOwn(rows, key)) throw new FormInputError(`Unknown row: ${key}`);
    const settings = isPlainRecord(field.spec.multiple) ? field.spec.multiple : {};
    if (typeof settings.min === 'number' && Object.keys(rows).length <= settings.min) {
      throw new FormInputError(`Minimum row count reached: ${path}`);
    }
    const segments = checkedSegments(path);
    this.commit(putAt(this.data, segments, Object.fromEntries(Object.entries(rows).filter(([k]) => k !== key))), {
      view: removeRowView(this.view, [...segments, key].join('.')),
    });
  }

  /** Change order without changing row keys, values or descendant identities. */
  moveRow(path: string, key: string, toIndex: number): void {
    checkArgumentText([['path', path], ['key', key]]);
    const { rows } = this.editableCollection(path);
    const entries = Object.entries(rows);
    const from = entries.findIndex(([k]) => k === key);
    if (from === -1) throw new FormInputError(`Unknown row: ${key}`);
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= entries.length) {
      throw new FormInputError(`Invalid row position: ${toIndex}`);
    }
    if (from === toIndex) return;
    const [row] = entries.splice(from, 1);
    entries.splice(toIndex, 0, row);
    this.commit(putAt(this.data, checkedSegments(path), Object.fromEntries(entries)));
  }

  /** Apply a saved seq key to exactly one row. Descendant paths and view state follow. */
  rekeyRow(path: string, oldKey: string, newKey: string): void {
    checkArgumentText([['path', path], ['oldKey', oldKey], ['newKey', newKey]]);
    const { rows } = this.editableCollection(path);
    checkKey(newKey);
    if (!hasOwn(rows, oldKey)) throw new FormInputError(`Unknown row: ${oldKey}`);
    if (oldKey === newKey) return;
    if (hasOwn(rows, newKey)) throw new FormInputError(`Row key already exists: ${newKey}`);
    const segments = checkedSegments(path);
    this.commit(putAt(this.data, segments,
      Object.fromEntries(Object.entries(rows).map(([key, value]) => [key === oldKey ? newKey : key, value]))), {
      view: rekeyRowView(this.view, [...segments, oldKey].join('.'), [...segments, newKey].join('.')),
    });
  }

  /** Expand a collapsed row or collapse an expanded one. */
  toggleRow(path: string, key: string): void {
    this.refreshView(toggleRowView(this.view, this.rowPath(path, key)));
  }

  /** Expand or collapse every collapsible row. */
  setAllExpanded(expanded: boolean): void {
    this.refreshView(setAllExpandedView(this.snapshot.fields, expanded));
  }

  /** Restore the record before the last data change. */
  undo(): void {
    const { history, value: previous } = undoChange(this.history, this.data);
    const fields = this.build(previous, this.view.collapsed);
    this.history = history;
    this.data = previous;
    this.publish(fields, this.snapshot.revision + 1);
  }

  /** Reapply the most recently undone data change. */
  redo(): void {
    const { history, value: next } = redoChange(this.history, this.data);
    const fields = this.build(next, this.view.collapsed);
    this.history = history;
    this.data = next;
    this.publish(fields, this.snapshot.revision + 1);
  }

  private build(data: Record<string, unknown>, collapsed: ReadonlySet<string>): NodeVM[] {
    return bindForm(this.template, data, { ...this.options, collapsed });
  }

  private publish(fields: NodeVM[], revision: number): void {
    this.snapshot = {
      fields,
      buttons: bindButtons(this.template, this.data, this.options),
      revision,
      canUndo: canUndo(this.history),
      canRedo: canRedo(this.history),
    };
    for (const listener of this.listeners) listener();
  }

  private refreshView(view: ViewState): void {
    const fields = this.build(this.data, view.collapsed);
    this.view = view;
    this.publish(fields, this.snapshot.revision);
  }

  private commit(data: Record<string, unknown>, change: Change = {}): void {
    const view = change.reset ? initialView() : change.view ?? this.view;
    const fields = this.build(data, view.collapsed); // Failure leaves data, history and view unchanged.
    this.history = change.reset ? emptyHistory() : recordChange(this.history, this.data, change.path);
    this.view = view;
    this.data = data;
    this.publish(fields, this.snapshot.revision + 1);
  }

  /** Canonical row path after checking that the row exists. */
  private rowPath(path: string, key: string): string {
    const { rows } = this.collection(path);
    if (!hasOwn(rows, key)) throw new FormInputError(`Unknown row: ${key}`);
    return [...checkedSegments(path), key].join('.');
  }

  private freshKey(used: Set<string>): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const key = createRowKey();
      checkKey(key);
      if (!used.has(key)) return key;
    }
    throw new FormInputError('Unable to generate an unused row key');
  }

  /** Normalize record data; `path` is the full data path, empty at the root. */
  private normalizeFields(fields: readonly FormFieldTemplate[], value: unknown, path = ''): Record<string, unknown> {
    if (value !== undefined && !isPlainRecord(value)) {
      throw new FormInputError(path ? `Group data must be an object: ${path}` : 'Form data must be an object');
    }
    const data = value === undefined ? {} : copyFormRecord(value);
    for (const field of fields) {
      const raw = data[field.name];
      const fieldPath = path ? `${path}.${field.name}` : field.name;
      if (repeats(field)) {
        const rows: Record<string, unknown> = {};
        // Missing data creates one usable prototype, except in a data-only collection. Explicit {} means zero rows.
        if (raw !== undefined && !isPlainRecord(raw)) throw new FormInputError(`Repeated data must be a keyed object: ${fieldPath}`);
        const entries = raw === undefined ? (dataOnly(field) ? [] : [[this.freshKey(new Set()), undefined] as const])
          : Object.entries(raw);
        for (const [key, row] of entries) {
          checkKey(key);
          if (hasOwn(rows, key)) throw new FormInputError(`Duplicate normalized row key: ${key}`);
          rows[key] = this.normalizeRow(field, row, `${fieldPath}.${key}`);
        }
        data[field.name] = rows;
      } else if (field.spec.type === 'group') {
        data[field.name] = this.normalizeFields(field.children, raw, fieldPath);
      } else if (raw === undefined && field.spec.default !== undefined) {
        data[field.name] = copyFormValue(field.spec.default);
      }
    }
    return data;
  }

  private normalizeRow(field: FormFieldTemplate, value: unknown, path: string): unknown {
    return field.spec.type === 'group' ? this.normalizeFields(field.children, value, path)
      : copyFormValue(value === undefined ? field.spec.default ?? '' : value);
  }

  private copyRowValue(field: FormFieldTemplate, value: unknown): unknown {
    if (field.spec.type !== 'group') return copyFormValue(value);
    const row = isPlainRecord(value) ? copyFormRecord(value) : {};
    return this.copyChildren(field.children, row);
  }

  private copyChildren(fields: readonly FormFieldTemplate[], value: Record<string, unknown>): Record<string, unknown> {
    const out = { ...value };
    for (const child of fields) {
      const raw = out[child.name];
      if (repeats(child) && isPlainRecord(raw)) {
        const used = new Set(Object.keys(raw));
        out[child.name] = Object.fromEntries(Object.values(raw).map(row => {
          const key = this.freshKey(used);
          used.add(key);
          return [key, this.copyRowValue(child, row)];
        }));
      } else if (child.spec.type === 'group' && isPlainRecord(raw)) {
        out[child.name] = this.copyChildren(child.children, raw);
      }
    }
    return out;
  }

  /** A collection whose rows the form may add, copy, remove, move or rekey. */
  private editableCollection(path: string): { field: FormFieldTemplate; rows: Record<string, unknown> } {
    const found = this.collection(path);
    if (dataOnly(found.field)) throw new FormInputError(`Rows of ${path} come only from data`);
    return found;
  }

  private collection(path: string): { field: FormFieldTemplate; rows: Record<string, unknown> } {
    const segments = checkedSegments(path);
    let fields = this.template.fields;
    let field: FormFieldTemplate | undefined;
    for (let i = 0; i < segments.length; i++) {
      field = fields.find(f => f.name === segments[i]);
      if (!field) throw new FormInputError(`Unknown collection: ${path}`);
      if (i === segments.length - 1) break;
      if (repeats(field)) i++;
      fields = field.children;
      field = undefined;
    }
    const rows = getValueByPath(this.data, path);
    if (!field || !repeats(field) || !isPlainRecord(rows)) throw new FormInputError(`Not a keyed collection: ${path}`);
    return { field, rows };
  }
}

/** Create an independent mutable instance from a cacheable form template. */
export function createForm(template: FormTemplate, data?: Record<string, unknown>, options?: CreateFormOptions): FormInstance {
  return new FormInstance(template, data, options);
}
