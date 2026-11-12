/**
 * Conditional parameters (validation-rules.md, "Parameter errors"): every literal
 * a condition map or a ternary can select is checked at load; a value a branch
 * takes from the data is checked when it is selected.
 */

import { describe, test, expect } from 'vitest';
import { validate, ComposeLoadError } from './index';

const LIMIT = 'Invalid maxlength parameter: expected an integer from 0 to 9007199254740991';

function run(maxlength: unknown, data: Record<string, unknown>) {
  const spec = {
    type: 'group',
    properties: { flag: { type: 'text' }, limit: { type: 'text' }, value: { type: 'text', validate: { maxlength } } },
  };
  try {
    return validate(spec, data).valid;
  } catch (error) {
    if (error instanceof ComposeLoadError) return `${error.code}: ${error.message} @ ${error.trace.join('.')}`;
    throw error;
  }
}

describe('conditional parameters', () => {
  test('nested ternary literals are checked whether or not they are selected', () => {
    expect(run('.flag ? 3 : .limit ? 2 : -1', { flag: 1, value: 'a' })).toBe(`INVALID_RULE_PARAMETER: ${LIMIT} @ value`);
    expect(run('.flag ? 3 : .limit ? 2 : 1', { flag: 1, value: 'a' })).toBe(true);
  });
  test('a data branch is checked only when selected, before the empty-value skip', () => {
    expect(run('.flag ? .limit : 2', { flag: 0, limit: 'x', value: 'ab' })).toBe(true);
    expect(run('.flag ? .limit : 2', { flag: 1, limit: 'x', value: '' })).toBe(`INVALID_RULE_PARAMETER: ${LIMIT} @ value`);
    expect(run('.flag ? .limit : 2', { flag: 1, limit: 1, value: 'ab' })).toBe(false);
  });
  test('a plain condition yields a boolean from the data: false disables, true fails when selected', () => {
    expect(run('.flag', { flag: 0, value: 'abcdef' })).toBe(true);
    expect(run('.flag', { flag: 1, value: '' })).toBe(`INVALID_RULE_PARAMETER: ${LIMIT} @ value`);
    expect(run('.flag == 1', { flag: 2, value: 'abcdef' })).toBe(true);
  });
  test('condition map values are all checked; false and null disable', () => {
    expect(run({ '.flag': null, true: false }, { value: 'abc' })).toBe(true);
    expect(run({ '.flag': 2, true: true }, { flag: 1, value: 'abc' })).toBe(`INVALID_RULE_PARAMETER: ${LIMIT} @ value`);
  });
});
