/**
 * Rule parameter checks (validation-rules.md, "Parameter errors").
 *
 * A parameter outside the definitions, and a rule name that is not registered, is a
 * load failure. Declared rule names and parameters are
 * checked after composition and the forbidden-key scan, fields in declaration
 * order and each field's rules in declaration order; a parameter selected by a
 * condition is checked when the validator selects it.
 */

import { ComposeLoadError } from '../compose/errors';
import { isFiniteNumber, isLengthLimit, isLengthRange, isNumberRange, isStep, readMembers } from '../values/index';
import { PatternSyntaxError, compilePattern } from '../pattern/index';
import { getRule } from '../rules/index';
import { CONDITION_TREE_PARAMETER_ERROR, isConditionTreeParameter } from '../rules/conditionTree';

/** The failure a rule parameter causes. */
interface ParameterFailure {
  code: 'INVALID_RULE_PARAMETER' | 'INVALID_RULE_PATTERN';
  message: string;
}

/** Rule names whose parameters this module checks. */
const CHECKED_RULES = new Set([
  'minlength',
  'maxlength',
  'rangelength',
  'number',
  'digits',
  'min',
  'max',
  'range',
  'step',
  'mincount',
  'maxcount',
  'in',
  'match',
  'pattern',
  'equalTo',
  'containedIn',
  'typeFrom',
  'minFrom',
  'maxFrom',
  'enddate',
  'notEqual',
  'unique',
  'conditionTree',
  'reference',
]);

/**
 * The failure an effective (resolved) parameter of a rule causes, or `null`.
 * `false` and `null` disable a rule and are never failures.
 */
function ruleParameterFailure(ruleName: string, param: unknown): ParameterFailure | null {
  if (param === false || param === null || !CHECKED_RULES.has(ruleName)) {
    return null;
  }
  const invalid = (message: string): ParameterFailure => ({ code: 'INVALID_RULE_PARAMETER', message });
  switch (ruleName) {
    case 'minlength':
    case 'maxlength':
    case 'mincount':
    case 'maxcount':
      return isLengthLimit(param)
        ? null
        : invalid(`Invalid ${ruleName} parameter: expected an integer from 0 to 9007199254740991`);
    case 'rangelength':
      return isLengthRange(param)
        ? null
        : invalid('Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum');
    case 'number':
    case 'digits':
      return param === true ? null : invalid(`Invalid ${ruleName} parameter: expected true or false`);
    case 'min':
    case 'max':
      return isFiniteNumber(param) ? null : invalid(`Invalid ${ruleName} parameter: expected a finite number`);
    case 'range':
      return isNumberRange(param)
        ? null
        : invalid('Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum');
    case 'step':
      return isStep(param) ? null : invalid('Invalid step parameter: expected a finite number above 0');
    case 'equalTo':
    case 'containedIn':
    case 'typeFrom':
    case 'minFrom':
    case 'maxFrom':
    case 'enddate':
      return typeof param === 'string'
        ? null
        : invalid(`Invalid ${ruleName} parameter: expected a field reference string`);
    case 'notEqual':
      return typeof param === 'string' || typeof param === 'boolean' || isFiniteNumber(param)
        ? null
        : invalid('Invalid notEqual parameter: expected a string, number or boolean');
    case 'unique':
      return typeof param === 'string' || param === true
        ? null
        : invalid('Invalid unique parameter: expected true, false or a string');
    case 'conditionTree':
      return isConditionTreeParameter(param) ? null : invalid(CONDITION_TREE_PARAMETER_ERROR);
    case 'reference':
      return typeof param === 'string'
        ? null
        : invalid('Invalid reference parameter: expected the declaration path of a field');
    case 'in': {
      const members = readMembers(param);
      return 'error' in members ? invalid(members.error) : null;
    }
    default: {
      if (typeof param !== 'string') return invalid(`Invalid ${ruleName} parameter: expected a pattern string`);
      try {
        // Compiled once here, when the parameter is checked.
        compilePattern(param);
        return null;
      } catch (error) {
        if (!(error instanceof PatternSyntaxError)) throw error;
        return {
          code: 'INVALID_RULE_PATTERN',
          message: `Invalid ${ruleName} pattern: ${error.reason} at ${error.offset}`,
        };
      }
    }
  }
}

/**
 * Throw the load failure of an effective parameter.
 *
 * @param declarationPath the field's property names from the root, without row keys.
 * @throws {ComposeLoadError} when the parameter is outside the definitions.
 */
export function assertRuleParameter(ruleName: string, param: unknown, declarationPath: string[]): void {
  const failure = ruleParameterFailure(ruleName, param);
  if (failure) throw new ComposeLoadError(failure.code, failure.message, [...declarationPath]);
}

/**
 * Throw the load failure of a `validate` or `messages` key that is not a registered rule.
 *
 * @param declarationPath the field's property names from the root, without row keys.
 * @throws {ComposeLoadError} `UNKNOWN_RULE` when the name is not registered.
 */
export function assertRuleName(ruleName: string, declarationPath: string[]): void {
  if (getRule(ruleName) === undefined) {
    throw new ComposeLoadError('UNKNOWN_RULE', `Unknown rule: ${ruleName}`, [...declarationPath]);
  }
}
