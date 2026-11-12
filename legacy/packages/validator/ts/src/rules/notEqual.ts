/**
 * Not Equal validation rule
 *
 * Validates that a value is different from a specified value or another field's value
 */

import { RuleDefinition, ValidationContext } from '../types';
import { isEmpty } from './required';
import { resolveFieldParam } from './equalTo';

/**
 * Not Equal rule definition
 */
export const notEqualRule: RuleDefinition = {
  validate(context: ValidationContext): string | null {
    const { value, ruleParam, messages } = context;

    // Skip if no rule param
    if (ruleParam === null || ruleParam === undefined) {
      return null;
    }

    // Skip validation if value is empty (required rule handles this)
    if (isEmpty(value)) {
      return null;
    }

    let compareValue: unknown;

    // Check if ruleParam is a field path reference (starts with .)
    if (typeof ruleParam === 'string' && ruleParam.startsWith('.')) {
      // Resolved with the same relative-path semantics as conditions
      compareValue = resolveFieldParam(ruleParam, context);
    } else {
      // Direct value comparison
      compareValue = ruleParam;
    }

    // Compare values
    if (value === compareValue) {
      return messages?.notEqual ?? 'Please enter a different value.';
    }

    return null;
  },
};
