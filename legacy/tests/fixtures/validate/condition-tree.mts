/**
 * Condition tree cases written from docs/spec/schema.md ("Condition trees") and
 * docs/spec/validation-rules.md ("Condition trees", "Parameter errors"). Every result record is
 * written from the specification with the default rule message, never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type WrittenCase } from './visibility.mts';

interface ErrorRecord { path: string; field: string; rule: string; message: string; value: unknown }

interface FailureCase {
  name: string;
  note: string;
  spec: Record<string, unknown>;
  data: Record<string, unknown>;
  expectFailure: { code: string; message: string; at: string };
}

/** One text field per value, all declaring `validate`; the fields named in `failing` fail `conditionTree`. */
function fields(name: string, note: string, values: Record<string, unknown>, validate: Record<string, unknown>,
  failing: string[], dataLimits?: Record<string, number>): WrittenCase {
  for (const field of failing) {
    if (!(field in values)) throw new Error(`${name} names the failing field ${field}, which it does not declare`);
  }
  const properties: Record<string, unknown> = {};
  for (const field of Object.keys(values)) properties[field] = { type: 'text', validate };
  const message = DEFAULT_MESSAGES.conditionTree;
  if (message === undefined) throw new Error('No default message for conditionTree');
  const errors: ErrorRecord[] = Object.keys(values)
    .filter(field => failing.includes(field))
    .map(field => ({ path: field, field, rule: 'conditionTree', message, value: values[field] ?? null }));
  // A tree deeper than the default data limit of 64 levels (CUVR-083) declares a larger one, so the rule sees it (C17.10).
  const spec = { type: 'group', properties, ...(dataLimits ? { dataLimits } : {}) };
  return { name, note, spec, data: values, expected: { valid: errors.length === 0, errors } };
}

/** A one-field specification whose conditionTree parameter fails to load (CUVR-068). */
function parameter(name: string, note: string, param: unknown): FailureCase {
  return {
    name, note,
    spec: { type: 'group', properties: { value: { type: 'text', validate: { conditionTree: param } } } },
    data: { value: { all: [] } },
    expectFailure: {
      code: 'INVALID_RULE_PARAMETER',
      message: 'Invalid conditionTree parameter: expected true, false or judge',
      at: 'value',
    },
  };
}

const comparison = (field: unknown, op: string, value: unknown) => ({ field, op, value });

/** A chain of `levels` conditions: `levels - 1` nested groups around the condition `leaf`, which is level `levels`. */
function chain(levels: number, leaf: Record<string, unknown>): Record<string, unknown> {
  let node = leaf;
  for (let level = 1; level < levels; level += 1) node = { [level % 2 === 0 ? 'any' : 'all']: [node] };
  return node;
}

const TRUE = { conditionTree: true };
const JUDGE = { conditionTree: 'judge' };

export const CONDITION_TREE_CASES: Array<WrittenCase | FailureCase> = [
  fields('condition-tree-groups',
    'all and any hold a list of conditions, which may be empty and may hold groups at any level (CUSC-072, CUVR-067).',
    {
      allEmpty: { all: [] },
      anyEmpty: { any: [] },
      allComparison: { all: [comparison('episodes.e1.status', 'eq', 'passed')] },
      nested: { any: [{ all: [comparison('a', 'eq', 1), { any: [] }] }, comparison('b', 'ne', false)] },
    }, TRUE, []),
  fields('condition-tree-group-shapes',
    'A group has exactly one member, all or any, whose value is a list of conditions; any other object or element fails (CUSC-072, CUVR-067).',
    {
      bothMembers: { all: [], any: [] },
      extraMember: { all: [], note: 'x' },
      notList: { all: {} },
      textList: { any: 'a' },
      scalarElement: { all: [1] },
      listElement: { all: [[]] },
      emptyElement: { all: [{}] },
      nullElement: { any: [null] },
      otherName: { none: [] },
      upperName: { ALL: [] },
    }, TRUE, ['bothMembers', 'extraMember', 'notList', 'textList', 'scalarElement', 'listElement', 'emptyElement', 'nullElement', 'otherName', 'upperName']),
  fields('condition-tree-comparisons',
    'A field comparison has field, op and value in any member order; every op of the list passes with a value of its kind (CUSC-073, CUVR-067).',
    {
      eq: comparison('vars.door', 'eq', 'open'),
      ne: comparison('vars.lit', 'ne', true),
      lt: comparison('turns_open', 'lt', 3),
      le: comparison('turns_open', 'le', 2.5),
      gt: comparison('revealed_clues.size', 'gt', -1),
      ge: comparison('revealed_clues.size', 'ge', 0),
      has: comparison('revealed_clues', 'has', 'clue_cctv'),
      inList: comparison('vars.mood', 'in', ['calm', 1, false]),
      inEmpty: comparison('vars.mood', 'in', []),
      memberOrder: { value: 1, op: 'eq', field: 'a' },
      paddedField: comparison(' a ', 'eq', 1),
    }, TRUE, []),
  fields('condition-tree-comparison-shapes',
    'A field comparison fails without one of its three members, with another member, with a field that is not a string or is empty after trimming, with an op outside the list, and with a value that is not of its kind (CUSC-073, CUVR-067).',
    {
      noValue: { field: 'a', op: 'eq' },
      noOp: { field: 'a', value: 1 },
      noField: { op: 'eq', value: 1 },
      extraMember: { field: 'a', op: 'eq', value: 1, judge: 'x' },
      fieldNumber: comparison(1, 'eq', 1),
      fieldEmpty: comparison('', 'eq', 1),
      fieldWhitespace: comparison('　 \t', 'eq', 1),
      opUnknown: comparison('a', 'contains', 'x'),
      opUpper: comparison('a', 'EQ', 1),
      opSymbol: comparison('a', '==', 1),
      valueNull: comparison('a', 'eq', null),
      valueObject: comparison('a', 'eq', { b: 1 }),
      valueList: comparison('a', 'eq', [1]),
      hasList: comparison('a', 'has', ['x']),
      inScalar: comparison('a', 'in', 'x'),
      inNull: comparison('a', 'in', [null]),
      inObject: comparison('a', 'in', [{}]),
      inNested: comparison('a', 'in', [[1]]),
    }, TRUE, ['noValue', 'noOp', 'noField', 'extraMember', 'fieldNumber', 'fieldEmpty', 'fieldWhitespace', 'opUnknown', 'opUpper', 'opSymbol', 'valueNull', 'valueObject', 'valueList', 'hasList', 'inScalar', 'inNull', 'inObject', 'inNested']),
  fields('condition-tree-judge-permitted',
    'Under the parameter judge a judged text is a condition at any level; its text is a string that is not empty after trimming and its object has no other member (CUSC-074, CUVR-066, CUVR-067).',
    {
      root: { judge: 'Jian finds the second recording.' },
      nested: { any: [comparison('clues.size', 'ge', 2), { all: [{ judge: ' 지안이 영상을 찾는다 ' }] }] },
      blank: { judge: '  ' },
      empty: { judge: '' },
      notText: { judge: true },
      extraMember: { judge: 'x', field: 'a' },
    }, JUDGE, ['blank', 'empty', 'notText', 'extraMember']),
  fields('condition-tree-judge-refused',
    'Under the parameter true a value that holds a judged text at any level fails, and the other conditions pass (CUSC-074, CUVR-066, CUVR-067).',
    {
      root: { judge: 'x' },
      nested: { all: [comparison('a', 'eq', 1), { any: [{ judge: 'x' }] }] },
      plain: { all: [comparison('a', 'eq', 1)] },
    }, TRUE, ['root', 'nested']),
  fields('condition-tree-values',
    'A value that is not an object fails; an empty value passes as for every other rule, and required refuses it (CUVR-020, CUVR-067).',
    {
      text: 'all',
      expression: '.a == 1',
      number: 1,
      boolean: true,
      list: [{ all: [] }],
      emptyObject: {},
      emptyList: [],
      emptyText: ' ',
      nothing: null,
    }, TRUE, ['text', 'expression', 'number', 'boolean', 'list']),
  {
    name: 'condition-tree-required',
    note: 'required refuses an empty object before conditionTree runs, and a condition tree passes both rules (CUVR-001, CUVR-067).',
    spec: { type: 'group', properties: {
      empty: { type: 'text', validate: { required: true, conditionTree: 'judge' } },
      tree: { type: 'text', validate: { required: true, conditionTree: 'judge' } },
    } },
    data: { empty: {}, tree: { all: [] } },
    expected: { valid: false, errors: [
      { path: 'empty', field: 'empty', rule: 'required', message: DEFAULT_MESSAGES.required ?? '', value: {} },
    ] },
  },
  fields('condition-tree-depth',
    'A condition tree is at most 32 levels deep, the root being level 1: a leaf at level 32 passes and one at level 33 fails, whatever the leaf (CUSC-075, CUVR-067).',
    {
      comparison32: chain(32, comparison('a', 'eq', 1)),
      group32: chain(32, { all: [] }),
      comparison33: chain(33, comparison('a', 'eq', 1)),
      group33: chain(33, { any: [] }),
      invalidBelow: chain(33, { any: [1] }),
    }, TRUE, ['comparison33', 'group33', 'invalidBelow'], { depth: 128 }),
  {
    name: 'condition-tree-message',
    note: 'messages.conditionTree overrides the default message of the rule (CUSC-003, CUVR-067).',
    spec: { type: 'group', properties: {
      trigger: { type: 'text', validate: { conditionTree: true }, messages: { conditionTree: 'Write a condition.' } },
    } },
    data: { trigger: { all: [1] } },
    expected: { valid: false, errors: [
      { path: 'trigger', field: 'trigger', rule: 'conditionTree', message: 'Write a condition.', value: { all: [1] } },
    ] },
  },
  {
    name: 'condition-tree-disabled',
    note: 'false and null disable conditionTree, so any value passes (CUVR-066).',
    spec: { type: 'group', properties: {
      off: { type: 'text', validate: { conditionTree: false } },
      none: { type: 'text', validate: { conditionTree: null } },
    } },
    data: { off: 'not a tree', none: { judge: 1 } },
    expected: { valid: true, errors: [] },
  },
  {
    name: 'condition-tree-repeated',
    note: 'A repeated field applies conditionTree to each row value, rows in sorted key order (CUVR-067).',
    spec: { type: 'group', properties: { triggers: { type: 'text', multiple: true, validate: { conditionTree: true } } } },
    data: { triggers: { __0000000000002__: { judge: 'x' }, __0000000000001__: { all: [] }, __0000000000003__: 'any' } },
    expected: { valid: false, errors: [
      { path: 'triggers.__0000000000002__', field: '__0000000000002__', rule: 'conditionTree', message: DEFAULT_MESSAGES.conditionTree ?? '', value: { judge: 'x' } },
      { path: 'triggers.__0000000000003__', field: '__0000000000003__', rule: 'conditionTree', message: DEFAULT_MESSAGES.conditionTree ?? '', value: 'any' },
    ] },
  },
  parameter('condition-tree-parameter-text',
    'A string other than judge is a parameter error; the parameter is received unchanged, so it is not read as a path (CUVR-068).', 'any'),
  parameter('condition-tree-parameter-path',
    'An expression string is not evaluated as a condition: .enabled is a parameter error (CUVR-068).', '.enabled'),
  parameter('condition-tree-parameter-object',
    'An object is not a condition map for conditionTree but a parameter error (CUVR-068).', { '.enabled': true }),
  parameter('condition-tree-parameter-number',
    'A number is a parameter error (CUVR-068).', 1),
  parameter('condition-tree-parameter-upper',
    'The parameter is compared exactly: Judge is a parameter error (CUVR-068).', 'Judge'),
];

/** The requirements each case tests. */
export const CONDITION_TREE_REQUIREMENTS: Record<string, string[]> = {
  'condition-tree-groups': ['CUSC-072', 'CUVR-066', 'CUVR-067'],
  'condition-tree-group-shapes': ['CUSC-072', 'CUVR-067'],
  'condition-tree-comparisons': ['CUSC-073', 'CUVR-067'],
  'condition-tree-comparison-shapes': ['CUSC-073', 'CUVR-067'],
  'condition-tree-judge-permitted': ['CUSC-074', 'CUVR-066', 'CUVR-067'],
  'condition-tree-judge-refused': ['CUSC-074', 'CUVR-066', 'CUVR-067'],
  'condition-tree-values': ['CUVR-020', 'CUVR-067'],
  'condition-tree-required': ['CUVR-001', 'CUVR-067'],
  'condition-tree-depth': ['CUSC-075', 'CUVR-067'],
  'condition-tree-message': ['CUSC-003', 'CUVR-067'],
  'condition-tree-disabled': ['CUVR-066'],
  'condition-tree-repeated': ['CUVR-067'],
  'condition-tree-parameter-text': ['CUVR-068'],
  'condition-tree-parameter-path': ['CUVR-068'],
  'condition-tree-parameter-object': ['CUVR-068'],
  'condition-tree-parameter-number': ['CUVR-068'],
  'condition-tree-parameter-upper': ['CUVR-068'],
};
