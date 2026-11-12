/**
 * Cases of the minFrom and maxFrom rules, written from docs/spec/validation-rules.md (CUVR-079, CUVR-081): the bounds of a value
 * are read from its siblings, as the int variables and the relationship dimensions of the drama story form declare their min and
 * max. Every result record is written from the specification with the default rule messages, never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type FailingCase, type WrittenCase } from './visibility.mts';

/** A variable with its bounds and its value; an undefined bound leaves the member out. */
const variable = (min: unknown, max: unknown, value: unknown) => ({
  spec: { type: 'group', properties: {
    min: { type: 'text' }, max: { type: 'text' }, value: { type: 'text', validate: { minFrom: '.min', maxFrom: '.max' } },
  } },
  data: { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }), value },
});

/** The failure of the value under `rule`. */
const failed = (rule: 'minFrom' | 'maxFrom', value: unknown) => ({
  valid: false,
  errors: [{ path: 'value', field: 'value', rule, message: DEFAULT_MESSAGES[rule] ?? '', value }],
});

const passed = { valid: true, errors: [] };

export const BOUNDS_FROM_CASES: Array<WrittenCase | FailingCase> = [
  { name: 'bounds-from-inside', note: 'a value between its bounds passes.', ...variable(0, 10, 5), expected: passed },
  { name: 'bounds-from-at-bounds', note: 'the bounds are inclusive.', ...variable(5, 5, 5), expected: passed },
  { name: 'bounds-from-below', note: 'a value below its minimum fails minFrom.', ...variable(0, 10, -1), expected: failed('minFrom', -1) },
  { name: 'bounds-from-above', note: 'a value above its maximum fails maxFrom.', ...variable(0, 10, 11), expected: failed('maxFrom', 11) },
  { name: 'bounds-from-fraction', note: 'a fraction is a finite number and compares as one.', ...variable(0, 1, 0.5), expected: passed },
  { name: 'bounds-from-text-value', note: 'a value that is not a finite number fails the first rule.', ...variable(0, 10, '5'), expected: failed('minFrom', '5') },
  { name: 'bounds-from-missing', note: 'a missing bound declares none.', ...variable(undefined, undefined, 99), expected: passed },
  { name: 'bounds-from-null', note: 'a null bound declares none.', ...variable(null, null, -99), expected: passed },
  { name: 'bounds-from-text-bound', note: 'a bound that is present but not a finite number fails.', ...variable('0', 10, 5), expected: failed('minFrom', 5) },
  {
    name: 'bounds-from-parameter-not-string',
    note: 'a maxFrom parameter that is not a string fails the load.',
    spec: { type: 'group', properties: { value: { type: 'text', validate: { maxFrom: 5 } } } },
    data: { value: 1 },
    expectFailure: { code: 'INVALID_RULE_PARAMETER', message: 'Invalid maxFrom parameter: expected a field reference string', at: 'value' },
  },
];

export const BOUNDS_FROM_REQUIREMENTS: Record<string, string[]> = Object.fromEntries(
  BOUNDS_FROM_CASES.map(c => [c.name, [c.name === 'bounds-from-parameter-not-string' ? 'CUVR-081' : 'CUVR-079']]),
);
