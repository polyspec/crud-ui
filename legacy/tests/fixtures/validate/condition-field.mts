/**
 * Condition field cases written from docs/spec/schema.md ("Condition fields"): a `condition` field
 * holds a condition tree, which its `conditionTree` rule checks. Every result record is written from
 * the specification with the default rule message, never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type WrittenCase } from './visibility.mts';

const message = DEFAULT_MESSAGES.conditionTree;
if (message === undefined) throw new Error('No default message for conditionTree');
const required = DEFAULT_MESSAGES.required;
if (required === undefined) throw new Error('No default message for required');

export const CONDITION_FIELD_CASES: WrittenCase[] = [
  {
    name: 'condition-field-values',
    note: 'A condition field holds a condition tree that its conditionTree rule checks: a tree passes, judged text only under judge, the text of a control that is no JSON text fails, and an empty value fails only required (CUSC-070).',
    spec: { type: 'group', properties: {
      opens_when: { type: 'condition', validate: { conditionTree: true } },
      pass: { type: 'condition', validate: { required: true, conditionTree: 'judge' } },
      judged: { type: 'condition', validate: { conditionTree: true } },
      typed: { type: 'condition', validate: { conditionTree: 'judge' } },
      cleared: { type: 'condition', validate: { required: true, conditionTree: true } },
    } },
    data: {
      opens_when: { all: [{ field: 'episodes.e1.status', op: 'eq', value: 'passed' }] },
      pass: { any: [{ field: 'clues.size', op: 'ge', value: 2 }, { judge: 'Jian finds the second recording.' }] },
      judged: { any: [{ judge: 'Jian finds it.' }] },
      typed: '{"all": [',
      cleared: '',
    },
    expected: { valid: false, errors: [
      { path: 'judged', field: 'judged', rule: 'conditionTree', message, value: { any: [{ judge: 'Jian finds it.' }] } },
      { path: 'typed', field: 'typed', rule: 'conditionTree', message, value: '{"all": [' },
      { path: 'cleared', field: 'cleared', rule: 'required', message: required, value: '' },
    ] },
  },
];

export const CONDITION_FIELD_REQUIREMENTS: Record<string, string[]> = {
  'condition-field-values': ['CUSC-070', 'CUVR-001', 'CUVR-061'],
};
