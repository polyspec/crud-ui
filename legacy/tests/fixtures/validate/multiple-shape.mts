/**
 * Cases of the load check of `multiple`, written from docs/spec/schema.md (CUSC-081): a field whose `multiple` is present and is
 * not a boolean, `only` or an object fails the load with INVALID_RULE_PARAMETER at its declaration path, before its group source
 * and its rules. Every record is written from the specification, never from a runtime's answer.
 */
import type { FailingCase, WrittenCase } from './visibility.mts';

/** The load failure of the `multiple` of the field at `at`. */
const failure = (at: string) => ({
  code: 'INVALID_RULE_PARAMETER',
  message: `Invalid multiple at ${at}: expected a boolean, only or an object`,
  at,
});

/** A form whose group `meta` holds the field `tags` with the given `multiple` and rules. */
const nested = (multiple: unknown, validate?: Record<string, unknown>) => ({
  type: 'group',
  properties: {
    meta: { type: 'group', properties: { tags: { type: 'text', multiple, ...(validate ? { validate } : {}) } } },
  },
});

export const MULTIPLE_SHAPE_CASES: Array<WrittenCase | FailingCase> = [
  {
    name: 'multiple-shape-accepted',
    note: 'A boolean, only and an object are the shapes of multiple; missing data of each field is no row.',
    spec: {
      type: 'group',
      properties: {
        on: { type: 'text', multiple: true },
        off: { type: 'text', multiple: false },
        rows: { type: 'text', multiple: 'only' },
        settings: { type: 'text', multiple: { min: 0 } },
      },
    },
    data: {},
    expected: { valid: true, errors: [] },
  },
  { name: 'multiple-shape-string', note: 'A string other than only is refused at the declaration path of the field.',
    spec: nested('yes'), data: {}, expectFailure: failure('meta.tags') },
  { name: 'multiple-shape-null', note: 'A present null is not a boolean, only or an object.',
    spec: nested(null), data: {}, expectFailure: failure('meta.tags') },
  { name: 'multiple-shape-list', note: 'A list is not an object.',
    spec: nested([]), data: {}, expectFailure: failure('meta.tags') },
  { name: 'multiple-shape-number', note: 'A number is not a boolean.',
    spec: nested(1), data: {}, expectFailure: failure('meta.tags') },
  { name: 'multiple-shape-before-rules', note: 'The multiple of a field is checked before its rules, so an unknown rule beside it is not reported.',
    spec: nested('many', { nope: true }), data: {}, expectFailure: failure('meta.tags') },
];

/** The requirements each case tests. */
export const MULTIPLE_SHAPE_REQUIREMENTS: Record<string, string[]> = Object.fromEntries(
  MULTIPLE_SHAPE_CASES.map((c) => [c.name, c.name === 'multiple-shape-accepted' ? ['CUSC-041'] : ['CUSC-041', 'CUSC-081']]),
);
