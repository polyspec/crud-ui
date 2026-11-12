import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { validate } from './validate';
import { ComposeLoadError } from './compose/errors';

// The values inside the groups of a choice list are members of `in` (docs/spec/schema.md, Choice
// groups; docs/spec/validation-rules.md, Values).
const europe = { label: 'Europe', choices: [{ value: 'eu-west', label: 'West' }, { value: 'eu-north', label: 'North' }] };
const asia = { label: 'Asia', choices: [{ value: 7, label: 'Seven' }] };
const spec = (list: unknown[]) => ({ type: 'group', properties: { region: { type: 'select', items: list, validate: { in: list } } } });
const errors = (list: unknown[], region: unknown) => validate(spec(list), { region }).errors.map((error) => error.rule);
const failure = (list: unknown[]) => {
  try {
    validate(spec(list), { region: 'eu-west' });
  } catch (error) {
    assert(error instanceof ComposeLoadError, 'the error is a load error');
    return { code: error.code, message: error.message };
  }
  throw new Error('validate accepted the parameter');
};

describe('in with choice groups', () => {
  it('passes a value inside any group of a list made only of groups', () => {
    for (const region of ['eu-west', 'eu-north', 7, '7', '']) expect(errors([europe, asia], region)).toEqual([]);
  });

  it('passes the values of plain choices and groups and fails any other value', () => {
    const list = [{ value: 'auto', label: 'Automatic' }, europe];
    for (const region of ['auto', 'eu-north']) expect(errors(list, region)).toEqual([]);
    for (const region of ['Europe', 'ap-east', 8]) expect(errors(list, region)).toEqual(['in']);
  });

  it('rejects a group with no choices, a malformed group and a repeated value', () => {
    const pairs = { code: 'INVALID_RULE_PARAMETER', message: 'Invalid in parameter: expected value and label pairs with distinct string or number values' };
    expect(failure([{ label: 'Empty', choices: [] }])).toEqual(pairs);
    expect(failure([europe, { label: 'Bad', choices: 'eu-west' }])).toEqual(pairs);
    expect(failure([{ label: 'Outer', choices: [asia] }])).toEqual(pairs);
    expect(failure([{ ...asia, note: 'x' }])).toEqual(pairs);
    expect(failure([europe, { label: 'Again', choices: [{ value: 'eu-west', label: 'West' }] }])).toEqual(pairs);
    expect(failure([{ value: '7', label: 'Seven' }, asia])).toEqual(pairs);
  });
});
