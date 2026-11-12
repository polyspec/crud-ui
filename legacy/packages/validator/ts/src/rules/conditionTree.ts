/**
 * Condition tree validation rule
 *
 * A non-empty value passes when it is a condition tree (schema.md, "Condition trees";
 * validation-rules.md, "Condition trees"): a group `{all: [...]}` or `{any: [...]}`, a field
 * comparison `{field, op, value}` or, under the parameter `judge`, a judged text `{judge}`, at
 * most 32 levels deep. The check reads no level below the limit.
 */

import { parameterRule } from './factories';
import { isRecord } from '../record';
import { isFiniteNumber, trim } from '../values/index';

/** The parameter message of `conditionTree` (CUVR-068), which the load check reports as well. */
export const CONDITION_TREE_PARAMETER_ERROR = 'Invalid conditionTree parameter: expected true, false or judge';

/** The deepest level of a condition tree; the root condition is level 1 (CUSC-075). */
const CONDITION_TREE_DEPTH = 32;

/** The operators of a field comparison (CUSC-073). */
const OPERATORS: ReadonlySet<unknown> = new Set(['eq', 'ne', 'lt', 'le', 'gt', 'ge', 'in', 'has']);

/** Whether a parameter is one that enables the rule: `true` or `judge`. */
export const isConditionTreeParameter = (ruleParam: unknown): ruleParam is true | 'judge' =>
  ruleParam === true || ruleParam === 'judge';

/** Whether a value is a string, a finite number or a boolean, the scalar of a comparison. */
const isScalar = (value: unknown): boolean =>
  typeof value === 'string' || typeof value === 'boolean' || isFiniteNumber(value);

/** Whether a value is a string that is not empty after trimming. */
const isText = (value: unknown): boolean => typeof value === 'string' && trim(value) !== '';

/** Whether an object has exactly the member names `names`. */
function hasMembers(node: Record<string, unknown>, names: readonly string[]): boolean {
  const keys = Object.keys(node);
  return keys.length === names.length && names.every(name => Object.prototype.hasOwnProperty.call(node, name));
}

/** Whether `node`, at `level`, is a condition; `judge` permits judged text. */
function isConditionTree(node: unknown, judge: boolean, level = 1): boolean {
  if (level > CONDITION_TREE_DEPTH || !isRecord(node)) return false;
  const group = hasMembers(node, ['all']) ? 'all' : hasMembers(node, ['any']) ? 'any' : undefined;
  if (group !== undefined) {
    const list = node[group];
    return Array.isArray(list) && list.every(item => isConditionTree(item, judge, level + 1));
  }
  if (hasMembers(node, ['field', 'op', 'value'])) {
    const { field, op, value } = node;
    if (!isText(field) || !OPERATORS.has(op)) return false;
    return op === 'in' ? Array.isArray(value) && value.every(isScalar) : isScalar(value);
  }
  if (hasMembers(node, ['judge'])) return judge && isText(node.judge);
  return false;
}

/** Condition tree rule definition. */
export const conditionTreeRule = parameterRule(isConditionTreeParameter, CONDITION_TREE_PARAMETER_ERROR, (value, ruleParam, { messages }) =>
  isConditionTree(value, ruleParam === 'judge') ? null : (messages?.conditionTree ?? 'Please enter a valid condition.')
);
