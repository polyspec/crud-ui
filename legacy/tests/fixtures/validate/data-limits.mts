/**
 * Cases of the data limits, written from docs/spec/validation-rules.md (CUVR-082 to CUVR-084) and docs/spec/schema.md
 * (CUSC-087): the form root bounds the levels and the nodes of the submitted data, as the drama story form bounds what a
 * story may submit. Every result record is written from the specification, never from a runtime's answer.
 */
import type { FailingCase, WrittenCase } from './visibility.mts';

/** An object that nests `levels` levels, itself the first. */
const nest = (levels: number): Record<string, unknown> => (levels === 1 ? {} : { next: nest(levels - 1) });

/** A form of two text fields, `b` required, bounded by `limits` when it is given. */
const form = (limits?: unknown) => ({
  type: 'group',
  properties: { a: { type: 'text' }, b: { type: 'text', validate: { required: true } } },
  ...(limits === undefined ? {} : { dataLimits: limits }),
});

const passed = { valid: true, errors: [] };

/** The input failure of data beyond `limit`. */
const exceeds = (limit: 'depth' | 'values', n: number) => ({
  code: 'INVALID_FORM_INPUT', message: `Submitted data exceeds the ${limit} limit of ${n}`, at: '',
});

/** The load failure of a bad dataLimits. */
const BAD_LIMITS = {
  code: 'INVALID_RULE_PARAMETER',
  message: 'Invalid dataLimits parameter: expected depth from 1 to 512 and values from 1 to 1000000',
  at: '',
};

const bad = (name: string, note: string, limits: unknown): FailingCase => ({
  name: `data-limits-bad-${name}`, note, spec: form(limits), data: { b: 'x' }, expectFailure: BAD_LIMITS,
});

export const DATA_LIMITS_CASES: Array<WrittenCase | FailingCase> = [
  { name: 'data-limits-depth-at', note: 'data of exactly depth levels passes; the root is the first level.', spec: form({ depth: 3 }), data: { a: nest(2), b: 'x' }, expected: passed },
  { name: 'data-limits-depth-over', note: 'data of more levels than depth fails.', spec: form({ depth: 3 }), data: { a: nest(3), b: 'x' }, expectFailure: exceeds('depth', 3) },
  { name: 'data-limits-depth-arrays', note: 'an array is a level as an object is.', spec: form({ depth: 2 }), data: { a: [[]], b: 'x' }, expectFailure: exceeds('depth', 2) },
  { name: 'data-limits-values-at', note: 'data of exactly values nodes passes: the root, the array, its item and the text of b.', spec: form({ values: 4 }), data: { a: [1], b: 'x' }, expected: passed },
  { name: 'data-limits-values-over', note: 'a null is a node as every scalar is, so five nodes exceed four.', spec: form({ values: 4 }), data: { a: [1, null], b: 'x' }, expectFailure: exceeds('values', 4) },
  { name: 'data-limits-depth-first', note: 'data beyond both limits reports depth.', spec: form({ depth: 2, values: 2 }), data: { a: { next: {} } }, expectFailure: exceeds('depth', 2) },
  { name: 'data-limits-before-rules', note: 'data beyond a limit fails before the required rule of b runs.', spec: form({ values: 2 }), data: { a: [1] }, expectFailure: exceeds('values', 2) },
  { name: 'data-limits-default-depth-at', note: 'without dataLimits, 64 levels pass.', spec: form(), data: { a: nest(63), b: 'x' }, expected: passed },
  { name: 'data-limits-default-depth-over', note: 'without dataLimits, 65 levels fail the default depth of 64.', spec: form(), data: { a: nest(64), b: 'x' }, expectFailure: exceeds('depth', 64) },
  { name: 'data-limits-default-values-over', note: 'a dataLimits without values takes the default of 100000: the root, the array and 99999 items are 100001 nodes.', spec: form({ depth: 512 }), data: { a: Array.from({ length: 99999 }, () => 0), b: 'x' }, expectFailure: exceeds('values', 100000) },
  bad('not-object', 'a dataLimits that is not an object fails the load.', 64),
  bad('unknown-member', 'a member other than depth and values fails the load.', { depth: 3, size: 1 }),
  bad('depth-zero', 'a depth below 1 fails the load.', { depth: 0 }),
  bad('depth-above', 'a depth above the nesting limit of 512 fails the load.', { depth: 513 }),
  bad('values-above', 'values above the node limit of 1000000 fail the load.', { values: 1000001 }),
  bad('values-fraction', 'values that are not an integer fail the load.', { values: 1.5 }),
  bad('depth-boolean', 'a boolean is not an integer.', { depth: true }),
  bad('depth-null', 'a null member is not an integer.', { depth: null }),
  {
    name: 'data-limits-bad-before-rule-names',
    note: 'dataLimits is checked before the rule names of the fields.',
    spec: { ...form({ depth: 0 }), properties: { b: { type: 'text', validate: { nope: true } } } },
    data: { b: 'x' },
    expectFailure: BAD_LIMITS,
  },
];

/** Cases whose data the fixture file writes on one line: their nodes would take a line each. */
export const DATA_LIMITS_COMPACT = ['data-limits-default-values-over'];

export const DATA_LIMITS_REQUIREMENTS: Record<string, string[]> = Object.fromEntries(
  DATA_LIMITS_CASES.map(c => [
    c.name,
    ['CUSC-087', c.name.startsWith('data-limits-bad-') ? 'CUVR-084' : c.name.startsWith('data-limits-default-') ? 'CUVR-083' : 'CUVR-082'],
  ]),
);
