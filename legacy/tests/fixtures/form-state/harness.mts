/**
 * The TypeScript reference of the form state fixtures: it runs the steps of a session on a form instance and the call
 * of a function case, and returns what it observed. `generate.mts` writes the observations as `expected`, and the
 * TypeScript test of the fixtures requires them again.
 */

import { validate } from '@polyspec/crudui-validator';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Step = { op: string; args: Json[] };
export interface SessionCase { name: string; spec: Json; data: Json; steps: Step[]; expected: Json[] }
export interface FunctionCase { name: string; op: string; args: Json[]; expected: Json }

interface ViewLike { readonly collapsed: ReadonlySet<string> }
interface HistoryLike { readonly entries: readonly unknown[]; readonly redoEntries: readonly unknown[]; readonly lastPath?: string }

/** The form instance that a session drives. */
interface FormLike {
  getSnapshot(): { readonly revision: number; readonly canUndo: boolean; readonly canRedo: boolean; readonly fields: readonly unknown[] };
  getData(): unknown;
  addRow(path: unknown, options: unknown): unknown;
  copyRow(path: unknown, key: unknown, options: unknown): unknown;
  removeRow(path: unknown, key: unknown): unknown;
  moveRow(path: unknown, key: unknown, index: unknown): unknown;
  rekeyRow(path: unknown, oldKey: unknown, newKey: unknown): unknown;
  setValue(path: unknown, value: unknown): unknown;
  setData(data: unknown): unknown;
  toggleRow(path: unknown, key: unknown): unknown;
  setAllExpanded(expanded: unknown): unknown;
  undo(): unknown;
  redo(): unknown;
}

/** The generator-core API that the observations run on. */
export interface Core {
  compileForm(spec: unknown): unknown;
  createForm(template: unknown, data: unknown, options: unknown): FormLike;
  bindForm(template: unknown, data: unknown, options: unknown): readonly unknown[];
  runAction(form: FormLike, target: unknown): unknown;
  resolveAction(input: unknown): unknown;
  initialView(): ViewLike;
  toggleRowView(view: ViewLike, rowPath: string): ViewLike;
  collapsibleRows(nodes: readonly unknown[]): string[];
  setAllExpandedView(nodes: readonly unknown[], expanded: boolean): ViewLike;
  removeRowView(view: ViewLike, rowPath: string): ViewLike;
  rekeyRowView(view: ViewLike, oldPath: string, newPath: string): ViewLike;
  emptyHistory(): HistoryLike;
  recordChange(history: HistoryLike, previous: unknown, path?: string): HistoryLike;
  canUndo(history: HistoryLike): boolean;
  canRedo(history: HistoryLike): boolean;
  undoChange(history: HistoryLike, current: unknown): { readonly history: HistoryLike; readonly value: unknown };
  redoChange(history: HistoryLike, current: unknown): { readonly history: HistoryLike; readonly value: unknown };
}

const KEY = /__[0-9A-Za-z]{13}__/g;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const isEntries = (value: unknown): value is unknown[] => Array.isArray(value);

/** Names the keys that an operation generated, in order of first appearance: `$1`, `$2`. */
function namer(known: ReadonlySet<string>): (value: unknown) => Json {
  const generated = new Map<string, string>();
  const rename = (text: string): string => text.replace(KEY, key => {
    if (known.has(key)) return key;
    const name = generated.get(key) ?? `$${generated.size + 1}`;
    generated.set(key, name);
    return name;
  });
  const walk = (value: unknown): Json => {
    if (typeof value === 'string') return rename(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(walk);
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, member]) => [rename(key), walk(member)]));
    return null;
  };
  return walk;
}

/** Row paths of the collapsed rows of the evaluated nodes, depth first. */
function collapsedRows(nodes: readonly unknown[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (!isRecord(node)) continue;
    const children = isEntries(node.children) ? node.children : [];
    if (node.kind !== 'collection') {
      collapsedRows(children, out);
      continue;
    }
    for (const row of children) {
      if (!isRecord(row)) continue;
      if (row.collapsible === true && row.expanded === false) out.push(`${String(node.path)}.${String(row.key)}`);
      collapsedRows(isEntries(row.children) ? row.children : [], out);
    }
  }
  return out;
}

/** The value and label of each option of the field node at a data path, depth first, or undefined. */
function fieldChoices(nodes: readonly unknown[], path: string): Json | undefined {
  for (const node of nodes) {
    if (!isRecord(node)) continue;
    if (node.kind === 'field' && node.path === path) {
      const options = isRecord(node.widget) && isEntries(node.widget.options) ? node.widget.options : [];
      return options.filter(isRecord).map(option => ({ value: String(option.value), label: String(option.label) }));
    }
    const found = fieldChoices(isEntries(node.children) ? node.children : [], path);
    if (found !== undefined) return found;
  }
  return undefined;
}

function failure(error: unknown): Json {
  if (!(error instanceof Error)) return { code: 'ERROR', message: String(error) };
  return { code: 'code' in error && typeof error.code === 'string' ? error.code : 'ERROR', message: error.message };
}

/**
 * The errors of the validator for the specification and the record: each error's data path, field name, rule and message,
 * in the order of the validator; the `valid` flag and the errors are the observation of a `validate` step.
 */
function validation(spec: Json, form: FormLike): Json {
  if (!isRecord(spec)) throw new Error('A session specification is no object');
  const result = validate(spec, form.getData());
  return {
    valid: result.valid,
    errors: result.errors.map(error => ({ path: error.path, field: error.field, rule: error.rule, message: error.message })),
  };
}

/** Runs one step on the form and returns what the step returned. */
function perform(core: Core, form: FormLike, { op, args }: Step, spec: Json): unknown {
  const [a, b, c] = args;
  switch (op) {
    case 'validate': return validation(spec, form);
    case 'choices': {
      const found = fieldChoices(form.getSnapshot().fields, text(a));
      if (found === undefined) throw new Error(`No field node at ${text(a)}`);
      return found;
    }
    case 'runAction': return core.runAction(form, a);
    case 'resolveAction': return core.resolveAction(a);
    case 'addRow': return form.addRow(a, b ?? {});
    case 'copyRow': return form.copyRow(a, b, c ?? {});
    case 'removeRow': return form.removeRow(a, b);
    case 'moveRow': return form.moveRow(a, b, c);
    case 'rekeyRow': return form.rekeyRow(a, b, c);
    case 'setValue': return form.setValue(a, b);
    case 'setData': return form.setData(a);
    case 'toggleRow': return form.toggleRow(a, b);
    case 'setAllExpanded': return form.setAllExpanded(a);
    case 'undo': return form.undo();
    case 'redo': return form.redo();
    default: throw new Error(`Unknown step: ${op}`);
  }
}

/**
 * What the reference observes after each step of a session. The observation of `form-view` sessions has no `canUndo`
 * and `canRedo` (`history` false), so that an implementation without history can run them.
 */
export function observeSession(core: Core, entry: { spec: Json; data: Json; steps: Step[] }, history = true): Json[] {
  const name = namer(new Set(JSON.stringify([entry.spec, entry.data, entry.steps]).match(KEY) ?? []));
  const form = core.createForm(core.compileForm(entry.spec), entry.data, {});
  return entry.steps.map(step => {
    const observed: Record<string, Json> = {};
    try {
      const result = perform(core, form, step, entry.spec);
      if (step.op === 'runAction' || step.op === 'resolveAction' || result !== undefined) observed.result = name(result);
    } catch (error) {
      observed.error = failure(error);
    }
    const snapshot = form.getSnapshot();
    observed.data = name(form.getData());
    observed.revision = snapshot.revision;
    if (history) {
      observed.canUndo = snapshot.canUndo;
      observed.canRedo = snapshot.canRedo;
    }
    observed.collapsed = name(collapsedRows(snapshot.fields));
    return observed;
  });
}

const toView = (input: unknown): ViewLike => ({ collapsed: new Set(isRecord(input) && isStrings(input.collapsed) ? input.collapsed : []) });
const fromView = (view: ViewLike): Json => ({ collapsed: [...view.collapsed] });
const nodesOf = (core: Core, spec: unknown, data: unknown, collapsed?: unknown): readonly unknown[] =>
  core.bindForm(core.compileForm(spec), data, isStrings(collapsed) ? { collapsed: new Set(collapsed) } : {});
const toHistory = (input: unknown): HistoryLike => {
  if (!isRecord(input) || !isEntries(input.entries) || !isEntries(input.redoEntries)) throw new Error('Not a history');
  return { entries: input.entries, redoEntries: input.redoEntries, ...(typeof input.lastPath === 'string' ? { lastPath: input.lastPath } : {}) };
};
const text = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Not a string');
  return value;
};

/** Calls the function of a function case with its arguments. */
function call(core: Core, { op, args }: { op: string; args: Json[] }): unknown {
  const [a, b, c] = args;
  switch (op) {
    case 'initialView': return fromView(core.initialView());
    case 'toggleRowView': return fromView(core.toggleRowView(toView(a), text(b)));
    case 'collapsibleRows': return core.collapsibleRows(nodesOf(core, a, b));
    case 'setAllExpandedView': return fromView(core.setAllExpandedView(nodesOf(core, a, b), c === true));
    case 'removeRowView': return fromView(core.removeRowView(toView(a), text(b)));
    case 'rekeyRowView': return fromView(core.rekeyRowView(toView(a), text(b), text(c)));
    case 'bindCollapsed': return collapsedRows(nodesOf(core, a, b, c));
    case 'emptyHistory': return core.emptyHistory();
    case 'recordChange': return core.recordChange(toHistory(a), b, typeof c === 'string' ? c : undefined);
    case 'canUndoRedo': return [core.canUndo(toHistory(a)), core.canRedo(toHistory(a))];
    case 'undoChange': return core.undoChange(toHistory(a), b);
    case 'redoChange': return core.redoChange(toHistory(a), b);
    default: throw new Error(`Unknown function: ${op}`);
  }
}

const isJson = (value: unknown): value is Json => {
  const walk = (item: unknown): boolean => item === null || ['string', 'number', 'boolean'].includes(typeof item)
    || (Array.isArray(item) && item.every(walk)) || (isRecord(item) && Object.values(item).every(walk));
  return walk(value);
};

/** What the reference returns for a call of a function case: `{ result }` or `{ error }`. */
export function observeFunction(core: Core, entry: { op: string; args: Json[] }): Json {
  try {
    const value: unknown = call(core, entry);
    const result: unknown = JSON.parse(JSON.stringify(value ?? null));
    if (!isJson(result)) throw new Error('A result is no JSON value');
    return { result };
  } catch (error) {
    return { error: failure(error) };
  }
}

/** The cases of a `cases.json`, checked for the members that the observations read. */
export function readCases(text: string): Record<string, Json>[] {
  const decoded: unknown = JSON.parse(text);
  if (!Array.isArray(decoded) || decoded.length === 0) throw new Error('A cases.json holds a non-empty list of cases');
  return decoded.map(entry => {
    if (!isRecord(entry) || !isJson(entry) || typeof entry.name !== 'string') throw new Error('A case is an object with a name');
    return entry;
  });
}

const isStep = (value: unknown): value is Step => isRecord(value) && typeof value.op === 'string' && Array.isArray(value.args) && value.args.every(isJson);

/** A case of a session family, checked for the members that `observeSession` reads. */
export function sessionCase(entry: Record<string, Json>): SessionCase {
  const { name, spec, data, steps, expected } = entry;
  const decoded = Array.isArray(steps) ? steps.filter(isStep) : [];
  if (typeof name !== 'string' || spec === undefined || data === undefined || decoded.length !== (Array.isArray(steps) ? steps.length : -1) || !Array.isArray(expected)) {
    throw new Error(`The session case ${JSON.stringify(name)} lacks spec, data, steps or expected`);
  }
  return { name, spec, data, steps: decoded, expected };
}

/** A case of a function family, checked for the members that `observeFunction` reads. */
export function functionCase(entry: Record<string, Json>): FunctionCase {
  const { name, op, args, expected } = entry;
  if (typeof name !== 'string' || typeof op !== 'string' || !Array.isArray(args) || expected === undefined) {
    throw new Error(`The function case ${JSON.stringify(name)} lacks op, args or expected`);
  }
  return { name, op, args, expected };
}
