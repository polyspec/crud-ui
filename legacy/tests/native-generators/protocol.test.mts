import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCLIResponse, OperationError, equalOrdered, equalModels, equalState, type ProcessResult } from './protocol.mts';
const compile = { operation: 'compileForm' };
const template = { kind: 'crudui/form-template', fields: [] };
const result = (value: unknown): ProcessResult => ({ status: 0, signal: null, stdout: JSON.stringify(value) });

test('accept a complete template and an expected operation failure', () => {
  assert.deepEqual(parseCLIResponse(compile, result(template)), template);
  assert.throws(() => parseCLIResponse(compile, { status: 1, signal: null, stdout: JSON.stringify({ error: { code: 'INVALID_FORM_INPUT', message: 'Invalid input', at: '' } }) }), OperationError);
});
const rejections: Array<[string, ProcessResult]> = [
  ['missing template fields', result({ kind: 'crudui/form-template' })],
  ['wrong template kind', result({ kind: 'other', fields: [] })],
  ['malformed field', result({ kind: 'crudui/form-template', fields: [{}] })],
  ['empty object', result({})],
  ['null response', result(null)],
  ['invalid JSON', { status: 0, signal: null, stdout: '{' }],
  ['multiple JSON values', { status: 0, signal: null, stdout: '{} {}' }],
  ['nonzero success status', { ...result(template), status: 2 }],
  ['signal termination', { ...result(template), status: null, signal: 'SIGTERM' }],
  ['missing status', { signal: null, stdout: JSON.stringify(template) }],
  ['execution failure', { ...result(template), error: new Error('Failed to start') }],
  ['malformed error code', { status: 1, signal: null, stdout: JSON.stringify({ error: { code: 1, message: 'Failed', at: '' } }) }],
  ['missing error location', { status: 1, signal: null, stdout: JSON.stringify({ error: { code: 'FAILED', message: 'Failed' } }) }],
  ['operation error with zero exit', result({ error: { code: 'FAILED', message: 'Failed', at: '' } })],
];
for (const [name, response] of rejections) test(`reject ${name}`, () => assert.throws(() => parseCLIResponse(compile, response)));

test('reject omitted state, HTML and action results', () => {
  const request = { operation: 'form', actions: [{ method: 'setData', args: [{}] }] };
  const state = { data: {}, fields: [], html: '<div class="form-group"></div>', revision: 1 };
  assert.throws(() => parseCLIResponse(request, result({ ...state, steps: [] })));
  assert.throws(() => parseCLIResponse(request, result({ ...state, steps: [{ ...state, error: null }] })));
  assert.throws(() => parseCLIResponse(request, result({ ...state, html: null, steps: [{ result: null, error: null, ...state }] })));
  assert.throws(() => parseCLIResponse(request, result({ ...state, data: [], steps: [{ result: null, error: null, ...state }] })));
});
test('record member order and empty JSON shapes are compared', () => {
  assert.throws(() => equalOrdered({ five: 5, seven: 7, one: 1 }, { one: 1, five: 5, seven: 7 }));
  assert.throws(() => equalOrdered({}, []));
  assert.throws(() => equalOrdered({ value: null }, {}));
  equalOrdered({ five: {}, seven: [], one: null }, { five: {}, seven: [], one: null });
});
test('models retain member order at every depth', () => {
  equalModels({ name: 'field', attrs: { type: 'text', name: 'field' } }, { name: 'field', attrs: { type: 'text', name: 'field' } });
  assert.throws(() => equalModels({ name: 'field', attrs: { type: 'text' } }, { attrs: { type: 'text' }, name: 'field' }));
  assert.throws(() => equalModels([{ widget: { kind: 'text', attrs: {}, tag: 'input' } }], [{ widget: { kind: 'text', tag: 'input', attrs: {} } }]));
  assert.throws(() => equalModels({ attrs: { name: 'field', type: 'text' } }, { attrs: { type: 'text', name: 'field' } }));
});
test('raw HTML, values and style attributes are never removed for comparison', () => {
  const initial = { data: { name: 'Ada' }, fields: [], html: '<input id="a" style="color:red" value="Ada"/>', revision: 0 };
  for (const html of ['<input style="color:red" value="Ada"/>', '<input id="a" value="Ada"/>', '<input id="a" style="color:red" value=""/>']) {
    assert.throws(() => equalState({ ...initial, html }, initial));
  }
});
test('a list model has a sort member only when the list declares a sort', () => {
  const request = { operation: 'buildList' };
  const model = { columns: [], rows: [], pagination: { enabled: false }, actions: [], empty: '', description: '', design: {} };
  const sorted = { columns: [], rows: [], pagination: { enabled: false }, sort: { field: 'name', dir: 'asc' }, actions: [], empty: '', description: '', design: {} };
  assert.deepEqual(parseCLIResponse(request, result(model)), model);
  assert.deepEqual(parseCLIResponse(request, result(sorted)), sorted);
  const { sort, ...rest } = sorted;
  assert.throws(() => parseCLIResponse(request, result({ sort, ...rest })), /List model members differ/);
  assert.throws(() => parseCLIResponse(request, result({ ...model, extra: true })), /List model members differ/);
});
test('a detail model has fields, actions and design in that order', () => {
  const request = { operation: 'buildDetail' };
  const model = { fields: [], actions: [], design: {} };
  assert.deepEqual(parseCLIResponse(request, result(model)), model);
  assert.throws(() => parseCLIResponse(request, result({ fields: [], design: {} })), /Detail model members differ/);
  assert.throws(() => parseCLIResponse(request, result({ fields: [], design: {}, actions: [] })), /Detail model members differ/);
});
