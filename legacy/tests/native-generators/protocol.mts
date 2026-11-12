import assert from 'node:assert/strict';
import type { ButtonVM, NodeVM, OutlineRow } from '@polyspec/crudui-generator-core';

/** A JSON object value. */
export type JsonObject = Record<string, unknown>;
/** The error record of a failed operation. */
export interface ErrorRecord { code: string; message: string; at: string }
/** The form state of a `form` response and of each of its steps. */
export interface FormState { data: JsonObject; fields: NodeVM[]; html: string; revision: number }
/** One action of a `form` request: its result or its error, and the state after it. */
interface FormStep extends FormState { result: unknown; error: ErrorRecord | null }
/** The response of a `form` request. */
export interface FormResponse extends FormState { steps: FormStep[] }
/** A field of a compiled template, as far as validateTemplate checks it. */
interface TemplateField { name: string; spec: JsonObject; children: TemplateField[] }
/** A compiled template (docs/spec/form-runtime.md), as far as validateTemplate checks it. */
interface CheckedTemplate { kind: 'crudui/form-template'; fields: TemplateField[] }
/** A list model, as far as validateList checks it: its members and their kinds. */
interface CheckedList { columns: unknown[]; rows: unknown[]; pagination: unknown; actions: unknown[]; empty: unknown; description: string; design: unknown }
/** A field of a detail model, as far as validateDetail checks it: its members. */
interface CheckedDetailField { key: unknown; label: unknown; format: unknown; value: unknown; display: unknown; design: unknown }
/** A detail model, as far as validateDetail checks it. */
interface CheckedDetail { fields: CheckedDetailField[]; actions: unknown[]; design: unknown }
/** The response of each protocol operation. */
export interface ResponseMap {
  compileForm: CheckedTemplate;
  bindForm: NodeVM[];
  bindButtons: ButtonVM[];
  formButtonsHtml: string;
  renderList: string;
  buildList: CheckedList;
  buildDetail: CheckedDetail;
  buildOutline: OutlineRow[];
  renderDetail: string;
  renderForm: string;
  form: FormResponse;
}
export type Operation = keyof ResponseMap;
/** A protocol request; its operation selects the response type. */
export interface ProtocolRequest { readonly operation?: unknown; readonly actions?: unknown }
/** The result of one CLI process. */
export interface ProcessResult {
  status?: number | null | undefined;
  signal?: string | null | undefined;
  stdout: string;
  error?: Error | undefined;
}

const own = <K extends string>(value: unknown, key: K): value is { [P in K]: unknown } => Object.prototype.hasOwnProperty.call(value, key);
const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const array = (value: unknown): value is unknown[] => Array.isArray(value);

export class OperationError extends Error {
  declare code: string;
  declare at: string;
  constructor(error: ErrorRecord) {
    super(error.message);
    this.name = 'OperationError';
    this.code = error.code;
    this.at = error.at;
  }
}

export function validateError(error: unknown): asserts error is ErrorRecord {
  assert.ok(object(error), 'Error must be an object');
  for (const key of ['code', 'message', 'at']) {
    assert.equal(typeof error[key], 'string', `Error ${key} must be a string`);
  }
  assert.notEqual(error.code, '', 'Error code must not be empty');
}

const nodeKinds: readonly unknown[] = ['field', 'group', 'collection', 'row', 'lang', 'lang-item'];
const actionNames: readonly unknown[] = ['move-up', 'move-down', 'add-row', 'copy-row', 'remove-row'];
const placements: readonly unknown[] = ['header', 'footer', 'outline'];
const parentKinds: readonly unknown[] = ['group', 'collection', 'lang'];
const pathKinds: readonly unknown[] = ['field', ...parentKinds];

function validateControls(controls: unknown): void {
  assert.ok(object(controls), 'Controls must be an object');
  assert.ok(placements.includes(controls.placement), 'Unknown controls placement');
  assert.equal(typeof controls.label, 'string', 'Controls label must be a string');
  assert.ok(array(controls.actions), 'Control actions must be an array');
  for (const action of controls.actions) {
    assert.ok(object(action), 'Unknown control action');
    assert.ok(actionNames.includes(action.name), 'Unknown control action');
    assert.equal(typeof action.label, 'string', 'Action label must be a string');
    assert.equal(typeof action.disabled, 'boolean', 'Action disabled must be a boolean');
  }
}

/** Validate nodes of the recursive form grammar (docs/spec/form-markup.md). */
function validateFields(nodes: unknown): asserts nodes is NodeVM[] {
  assert.ok(array(nodes), 'Nodes must be an array');
  for (const node of nodes) {
    assert.ok(object(node), 'Node must be an object');
    assert.ok(nodeKinds.includes(node.kind), 'Unknown node kind');
    assert.equal(typeof node.className, 'string', 'Node className must be a string');
    assert.equal(typeof node.hidden, 'boolean', 'Node hidden must be a boolean');
    assert.ok(object(node.body) && typeof node.body.className === 'string', 'Node body must have a className');
    if (node.header !== undefined) {
      assert.ok(object(node.header) && typeof node.header.className === 'string', 'Node header must have a className');
    }
    if (node.controls !== undefined) validateControls(node.controls);
    if (pathKinds.includes(node.kind)) {
      assert.equal(typeof node.path, 'string', 'Node path must be a string');
    }
    if (node.kind === 'row') assert.equal(typeof node.key, 'string', 'Row key must be a string');
    if (node.kind === 'lang-item') assert.equal(typeof node.lang, 'string', 'Language code must be a string');
    if (parentKinds.includes(node.kind) || (node.kind === 'row' && node.collapsible === true)) {
      validateFields(node.children);
    }
    if (node.kind === 'field') assert.ok(object(node.checkbox) || object(node.widget), 'Field node must have a control');
    if (node.kind === 'lang-item' || (node.kind === 'row' && node.collapsible !== true)) {
      assert.ok(object(node.widget), 'Node must have a widget');
    }
  }
}

function validateState(value: unknown): asserts value is FormState {
  assert.ok(object(value), 'Form state must be an object');
  assert.ok(object(value.data), 'Form data must be an object');
  validateFields(value.fields);
  assert.equal(typeof value.html, 'string', 'Form HTML must be a string');
  assert.ok(typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0, 'Revision must be a nonnegative integer');
}

/** Checks the compiled template `value` (docs/spec/form-runtime.md). */
function validateTemplate(value: unknown): asserts value is CheckedTemplate {
  assert.ok(object(value), 'Template must be an object');
  assert.equal(value.kind, 'crudui/form-template');
  const check = (fields: unknown): void => {
    assert.ok(array(fields), 'Template fields must be an array');
    for (const field of fields) {
      assert.ok(object(field));
      assert.equal(typeof field.name, 'string');
      assert.ok(object(field.spec), 'Field specification must be an object');
      check(field.children);
    }
  };
  check(value.fields);
}

/** Checks the button models `value`. */
function validateButtons(value: unknown): asserts value is ButtonVM[] {
  assert.ok(array(value), 'Buttons must be an array');
  for (const button of value) {
    assert.ok(object(button), 'Button members differ');
    assert.deepEqual(Object.keys(button), ['type', 'tag', 'text', 'attrs'], 'Button members differ');
    assert.ok(object(button.attrs) && Object.values(button.attrs).every(item => typeof item === 'string'), 'Button attributes must be strings');
  }
}

/** Checks the list model `value`. */
function validateList(value: unknown): asserts value is CheckedList {
  assert.ok(object(value), 'List model must be an object');
  // A list without a sort declaration has no sort member.
  const members = ['columns', 'rows', 'pagination', ...(Object.hasOwn(value, 'sort') ? ['sort'] : []), 'actions', 'empty', 'description', 'design'];
  assert.deepEqual(Object.keys(value), members, 'List model members differ');
  assert.ok(Array.isArray(value.columns) && Array.isArray(value.rows) && Array.isArray(value.actions));
  assert.equal(typeof value.description, 'string', 'List description must be a string');
}

/** Checks the detail model `value`. */
function validateDetail(value: unknown): asserts value is CheckedDetail {
  assert.ok(object(value), 'Detail model must be an object');
  assert.deepEqual(Object.keys(value), ['fields', 'actions', 'design'], 'Detail model members differ');
  assert.ok(array(value.fields), 'Detail fields must be an array');
  assert.ok(Array.isArray(value.actions), 'Detail actions must be an array');
  for (const field of value.fields) {
    assert.ok(object(field), 'Detail field members differ');
    assert.deepEqual(Object.keys(field), ['key', 'label', 'format', 'value', 'display', 'design'], 'Detail field members differ');
  }
}

/** Checks the structure map rows `value`: the members of each row in their order, and the rows nested in it. */
function validateOutline(value: unknown): asserts value is OutlineRow[] {
  assert.ok(array(value), 'Outline rows must be an array');
  for (const row of value) {
    assert.ok(object(row), 'Outline row must be an object');
    const members = Object.keys(row);
    assert.deepEqual(members, ['path', 'key', 'number', 'title', 'controls', 'rows'].filter(name => members.includes(name)), 'Outline row members differ');
    assert.ok(members.includes('rows') && members.includes('path') && members.includes('key'), 'Outline row needs path, key and rows');
    assert.equal(typeof row.path, 'string', 'Outline row path must be a string');
    assert.equal(typeof row.key, 'string', 'Outline row key must be a string');
    if (members.includes('controls')) validateControls(row.controls);
    validateOutline(row.rows);
  }
}

/** Checks the response `value` of a form request with `actions`: its state and one step for each action. */
export function validateForm(value: unknown, actions: unknown): asserts value is FormResponse {
  validateState(value);
  assert.ok(own(value, 'steps') && array(value.steps), 'Form steps must be an array');
  assert.equal(value.steps.length, array(actions) ? actions.length : 0, 'Every requested action must produce one step');
  for (const step of value.steps) {
    assert.ok(own(step, 'result') && own(step, 'error'), 'Step must contain result and error');
    if (step.error !== null) validateError(step.error);
    validateState(step);
  }
}

/** A string response, an HTML text. */
function text(value: unknown, what: string): string {
  assert.equal(typeof value, 'string', `${what} must be a string`);
  return String(value);
}

/** The check of the response of each operation: it returns the response as the type of the operation. */
const responses: { [O in Operation]: (value: unknown, request: ProtocolRequest) => ResponseMap[O] } = {
  compileForm: (value) => { validateTemplate(value); return value; },
  bindForm: (value) => { validateFields(value); return value; },
  bindButtons: (value) => { validateButtons(value); return value; },
  formButtonsHtml: (value) => text(value, 'Button HTML'),
  renderList: (value) => text(value, 'List HTML'),
  buildList: (value) => { validateList(value); return value; },
  buildDetail: (value) => { validateDetail(value); return value; },
  buildOutline: (value) => { validateOutline(value); return value; },
  renderDetail: (value) => text(value, 'Detail HTML'),
  renderForm: (value) => text(value, 'Form HTML'),
  form: (value, request) => { validateForm(value, request.actions); return value; },
};

const operation = (value: unknown): value is Operation => typeof value === 'string' && Object.hasOwn(responses, value);

/** The response `value` of `request`, checked against the response of its operation. */
export function validateResponse<O extends Operation>(request: ProtocolRequest & { readonly operation: O }, value: unknown): ResponseMap[O];
export function validateResponse(request: ProtocolRequest, value: unknown): unknown;
export function validateResponse(request: ProtocolRequest, value: unknown): unknown {
  if (!operation(request.operation)) throw new Error(`Unknown operation ${JSON.stringify(request.operation)}`);
  return responses[request.operation](value, request);
}

/** The response of `request` that a CLI process printed; an error response throws its OperationError. */
export function parseCLIResponse<O extends Operation>(request: ProtocolRequest & { readonly operation: O }, processResult: ProcessResult): ResponseMap[O];
export function parseCLIResponse(request: ProtocolRequest, processResult: ProcessResult): unknown;
export function parseCLIResponse(request: ProtocolRequest, processResult: ProcessResult): unknown {
  const { status, signal, stdout, error } = processResult;
  if (error) throw new Error(`CLI execution failed: ${error.message}`);
  if (signal || status === null || status === undefined) throw new Error(`CLI terminated: ${signal ?? 'missing exit status'}`);
  let value: unknown;
  try { value = JSON.parse(stdout); } catch (error) { if (!(error instanceof SyntaxError)) throw error; throw new Error('CLI did not return one JSON value', { cause: error }); }
  if (object(value) && own(value, 'error')) {
    validateError(value.error);
    assert.equal(status, 1, 'Operation errors must exit with status 1');
    throw new OperationError(value.error);
  }
  assert.equal(status, 0, 'A failed CLI cannot return a successful result');
  return validateResponse(request, value);
}

export function equalOrdered(actual: unknown, expected: unknown, path = '$'): void {
  assert.deepStrictEqual(actual, expected, `Different value at ${path}`);
  if (array(actual)) {
    // deepStrictEqual proved that expected has the shape of actual.
    assert.ok(array(expected));
    actual.forEach((value, index) => equalOrdered(value, expected[index], `${path}[${index}]`));
  } else if (object(actual)) {
    assert.ok(object(expected));
    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected), `Different object member order at ${path}`);
    for (const key of Object.keys(actual)) equalOrdered(actual[key], expected[key], `${path}.${key}`);
  }
}

// Node and widget models have one member order in every runtime (docs/spec/form-runtime.md).
export function equalModels(actual: unknown, expected: unknown, path = '$'): void {
  assert.deepStrictEqual(actual, expected, `Different model at ${path}`);
  equalOrdered(actual, expected, path);
}

export function equalState(actual: FormState, expected: FormState): void {
  equalOrdered(actual.data, expected.data, '$.data');
  equalModels(actual.fields, expected.fields, '$.fields');
  assert.equal(actual.html, expected.html, 'Raw form HTML differs');
  assert.equal(actual.revision, expected.revision, 'Revision differs');
}
