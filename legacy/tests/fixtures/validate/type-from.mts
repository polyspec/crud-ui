/**
 * Cases of the typeFrom rule, written from docs/spec/validation-rules.md (CUVR-077, CUVR-078): the value of a sibling names the
 * type of the value, as the variables of the drama story form declare bool, int or enum. Every result record is written from the
 * specification with the default rule messages, never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type FailingCase, type WrittenCase } from './visibility.mts';

/** A variable with its declared type and its initial value; a missing type leaves the member out. */
const variable = (type: unknown, initial: unknown) => ({
  spec: { type: 'group', properties: { type: { type: 'text' }, initial: { type: 'text', validate: { typeFrom: '.type' } } } },
  data: type === undefined ? { initial } : { type, initial },
});

/** The typeFrom failure of the initial value. */
const failed = (value: unknown) => ({
  valid: false,
  errors: [{ path: 'initial', field: 'initial', rule: 'typeFrom', message: DEFAULT_MESSAGES.typeFrom ?? '', value }],
});

const passed = { valid: true, errors: [] };

export const TYPE_FROM_CASES: Array<WrittenCase | FailingCase> = [
  { name: 'type-from-bool', note: 'a boolean of a bool variable passes.', ...variable('bool', true), expected: passed },
  { name: 'type-from-bool-false', note: 'false is a value of a bool variable, not an empty one.', ...variable('bool', false), expected: passed },
  { name: 'type-from-bool-text', note: 'the text true is no boolean.', ...variable('bool', 'true'), expected: failed('true') },
  { name: 'type-from-int', note: 'a number without a fractional part is an int.', ...variable('int', 3), expected: passed },
  { name: 'type-from-int-fraction', note: 'a number with a fractional part is no int.', ...variable('int', 2.5), expected: failed(2.5) },
  { name: 'type-from-int-text', note: 'the text 3 is no int.', ...variable('int', '3'), expected: failed('3') },
  { name: 'type-from-enum', note: 'a string is a value of an enum variable.', ...variable('enum', 'calm'), expected: passed },
  { name: 'type-from-enum-number', note: 'a number is no value of an enum variable.', ...variable('enum', 1), expected: failed(1) },
  { name: 'type-from-unknown-type', note: 'a type that is not bool, int or enum fails.', ...variable('float', 1), expected: failed(1) },
  { name: 'type-from-missing-type', note: 'a missing type fails.', ...variable(undefined, true), expected: failed(true) },
  {
    name: 'type-from-parameter-not-string',
    note: 'a typeFrom parameter that is not a string fails the load.',
    spec: { type: 'group', properties: { value: { type: 'text', validate: { typeFrom: 5 } } } },
    data: { value: 'x' },
    expectFailure: { code: 'INVALID_RULE_PARAMETER', message: 'Invalid typeFrom parameter: expected a field reference string', at: 'value' },
  },
];

export const TYPE_FROM_REQUIREMENTS: Record<string, string[]> = Object.fromEntries(
  TYPE_FROM_CASES.map(c => [c.name, [c.name === 'type-from-parameter-not-string' ? 'CUVR-078' : 'CUVR-077']]),
);
