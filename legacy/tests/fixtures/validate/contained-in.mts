/**
 * Cases of the containedIn rule, written from docs/spec/validation-rules.md (CUVR-075, CUVR-076): a string value must occur in the
 * string value of the referenced field. Every result record is written from the specification with the default rule messages,
 * never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type FailingCase, type WrittenCase } from './visibility.mts';

/** A fact with its truth and a test whose canary must occur in it, as the drama story form declares. */
const story = (canary: unknown, truth: unknown = 'The butler hid the key.') => ({
  spec: { type: 'group', properties: { truth: { type: 'text' }, canary: { type: 'text', validate: { containedIn: '.truth' } } } },
  data: { truth, canary },
});

/** The containedIn failure of the canary. */
const failed = (value: unknown) => ({
  valid: false,
  errors: [{ path: 'canary', field: 'canary', rule: 'containedIn', message: DEFAULT_MESSAGES.containedIn ?? '', value }],
});

const passed = { valid: true, errors: [] };

export const CONTAINED_IN_CASES: Array<WrittenCase | FailingCase> = [
  { name: 'contained-in-substring', note: 'a canary that occurs in the truth passes.', ...story('butler'), expected: passed },
  { name: 'contained-in-whole', note: 'a canary equal to the whole truth occurs in it.', ...story('The butler hid the key.'), expected: passed },
  { name: 'contained-in-missing', note: 'a canary that does not occur in the truth fails.', ...story('gardener'), expected: failed('gardener') },
  { name: 'contained-in-case', note: 'the substring is matched exactly, with its case.', ...story('BUTLER'), expected: failed('BUTLER') },
  { name: 'contained-in-number-value', note: 'a value that is not a string fails.', ...story(7, 'room 7'), expected: failed(7) },
  { name: 'contained-in-number-reference', note: 'a referenced value that is not a string fails.', ...story('7', 7), expected: failed('7') },
  { name: 'contained-in-empty', note: 'an empty value is not evaluated by the rule.', ...story(''), expected: passed },
  {
    name: 'contained-in-parameter-not-string',
    note: 'a containedIn parameter that is not a string fails the load.',
    spec: { type: 'group', properties: { value: { type: 'text', validate: { containedIn: 5 } } } },
    data: { value: 'x' },
    expectFailure: { code: 'INVALID_RULE_PARAMETER', message: 'Invalid containedIn parameter: expected a field reference string', at: 'value' },
  },
];

export const CONTAINED_IN_REQUIREMENTS: Record<string, string[]> = {
  'contained-in-substring': ['CUVR-075'],
  'contained-in-whole': ['CUVR-075'],
  'contained-in-missing': ['CUVR-075'],
  'contained-in-case': ['CUVR-075'],
  'contained-in-number-value': ['CUVR-075'],
  'contained-in-number-reference': ['CUVR-075'],
  'contained-in-empty': ['CUVR-075'],
  'contained-in-parameter-not-string': ['CUVR-076'],
};
