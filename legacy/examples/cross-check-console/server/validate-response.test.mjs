import { beforeEach, describe, expect, test, vi } from 'vitest';

const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync }));

import { validateAll, validateAllList } from './validate-runner.mjs';

const request = { spec: { type: 'group', properties: {} }, data: {} };
const result = { valid: true, errors: [], hidden: [] };
const listResult = { valid: true, errors: [] };
const error = { path: 'name', field: 'name', rule: 'required', message: 'Required.', value: '' };
const failure = { code: 'REF_FILE_NOT_FOUND', message: 'Missing specification.', at: 'Missing.yml' };
const failureWire = { error: failure.message, code: failure.code, at: failure.at };

beforeEach(() => spawnSync.mockReset());

describe('validator process responses', () => {
  test('accepts a complete successful response', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify(result), stderr: '' });
    const actual = await validateAll(request);
    expect(actual.results.every(item => item.ok)).toBe(true);
    expect(actual.idempotent).toBe(true);
  });

  test.each([null, false, 0, '', [], {}])('preserves error value %j', async value => {
    const errors = [{ ...error, value }];
    spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify({ valid: false, errors, hidden: [] }), stderr: '' });
    const actual = await validateAll(request);
    expect(actual.results.every(item => item.ok && item.valid === false)).toBe(true);
    for (const item of actual.results) expect(item.errors).toEqual(errors);
    expect(actual.idempotent).toBe(true);
  });

  test('keeps the hidden paths of a form result', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify({ ...result, hidden: ['a', 'b.0.c'] }), stderr: '' });
    const actual = await validateAll(request);
    for (const item of actual.results) expect(item.hidden).toStrictEqual(['a', 'b.0.c']);
    expect(actual.idempotent).toBe(true);
  });

  test('accepts a list result without hidden paths', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify(listResult), stderr: '' });
    const actual = await validateAllList(request);
    expect(actual.results.every(item => item.ok && !Object.hasOwn(item, 'hidden'))).toBe(true);
    expect(actual.idempotent).toBe(true);
  });

  test('rejects a list result with hidden paths', async () => {
    spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify(result), stderr: '' });
    const actual = await validateAllList(request);
    expect(actual.results.every(item => item.ok === false)).toBe(true);
  });

  test.each([
    ['form', validateAll], ['list', validateAllList],
  ])('accepts the shared %s failure response with exit 2', async (_, validate) => {
    spawnSync.mockReturnValue({ status: 2, stdout: JSON.stringify(failureWire), stderr: '' });
    const actual = await validate(request);
    expect(actual.results.every(item => item.ok && item.valid === false)).toBe(true);
    for (const item of actual.results) expect(item.failure).toEqual(failure);
    expect(actual.idempotent).toBe(true);
  });

  test.each([
    ['missing result fields', {}],
    ['string validity', { valid: 'false', errors: [], hidden: [] }],
    ['missing errors', { valid: true, hidden: [] }],
    ['missing hidden paths', listResult],
    ['hidden paths that are not an array', { ...result, hidden: 'a' }],
    ['a hidden path that is not a string', { ...result, hidden: [1] }],
    ['invalid errors', { valid: false, errors: {}, hidden: [] }],
    ['incomplete error', { valid: false, errors: [{ rule: 'required' }], hidden: [] }],
    ['missing error value', { valid: false, errors: [{ ...error, value: undefined }], hidden: [] }],
    ['numeric error path', { valid: false, errors: [{ ...error, path: 1 }], hidden: [] }],
    ['null error', { valid: false, errors: [null], hidden: [] }],
    ['valid result with errors', { valid: true, errors: [error], hidden: [] }],
    ['invalid result without errors', { valid: false, errors: [], hidden: [] }],
    ['request error combined with validation', { ...result, error: 'failed' }],
    ['failure without exit 2', failureWire],
  ])('rejects %s with exit 0', async (_, response) => {
    spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify(response), stderr: '' });
    const actual = await validateAll(request);
    expect(actual.results.every(item => item.ok === false)).toBe(true);
    expect(actual.idempotent).toBe(false);
  });

  test.each([
    ['numeric code', { ...failureWire, code: 1 }],
    ['empty message', { ...failureWire, error: '' }],
    ['missing location', { error: failure.message, code: failure.code }],
    ['extra member', { ...failureWire, trace: [] }],
    ['validation result', result],
  ])('rejects a failure response with %s', async (_, response) => {
    spawnSync.mockReturnValue({ status: 2, stdout: JSON.stringify(response), stderr: '' });
    const actual = await validateAll(request);
    expect(actual.results.every(item => item.ok === false)).toBe(true);
    expect(actual.idempotent).toBe(false);
  });

  test.each(['', 'not JSON', 'null', '[]', 'true'])('rejects malformed output %j', async stdout => {
    spawnSync.mockReturnValue({ status: 0, stdout, stderr: '' });
    const actual = await validateAll(request);
    expect(actual.results.every(item => item.ok === false)).toBe(true);
    expect(actual.idempotent).toBe(false);
  });

  test.each([
    ['unsuccessful exit', { status: 1 }],
    ['termination', { status: null, signal: 'SIGTERM' }],
    ['signal with exit status', { status: 0, signal: 'SIGTERM' }],
    ['spawn error', { status: 0, error: new Error('ENOENT') }],
  ])('rejects a validation result after %s', async (_, processState) => {
    spawnSync.mockReturnValue({ ...processState, stdout: JSON.stringify(result), stderr: 'process failed' });
    const actual = await validateAll(request);
    expect(actual.results.every(item => item.ok === false)).toBe(true);
    expect(actual.idempotent).toBe(false);
  });
});
