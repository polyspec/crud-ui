/**
 * Required validation rule
 *
 * Validates that a field has a nonempty value
 */

import { RuleDefinition, ValidationContext } from '../types';

import { isEmptyValue } from '../values/index';

/**
 * Whether a value is empty (validation-rules.md, "Values"): missing, `null`, a
 * string that is empty after trimming whitespace, an empty array or an empty
 * object.
 */
export const isEmpty = isEmptyValue;

/**
 * Required rule definition
 */
export const requiredRule: RuleDefinition = {
  validate(context: ValidationContext): string | null {
    const { value, ruleParam, messages } = context;

    // If rule is disabled (false), skip validation
    if (ruleParam === false) {
      return null;
    }

    // If rule is a condition expression, it should have been evaluated
    // before calling this function. The ruleParam should be true/false.
    if (ruleParam !== true) {
      return null;
    }

    // Check if value is empty
    if (isEmpty(value)) {
      return messages?.required ?? 'This field is required.';
    }

    return null;
  },
};
