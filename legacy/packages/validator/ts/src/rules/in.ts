/**
 * In list validation rule
 *
 * Validates that a value is a member of a list, a comma-separated string or a
 * map (validation-rules.md, "Values").
 */

import { RuleDefinition, ValidationContext } from '../types';
import { isEmpty } from './required';
import { isMember, readMembers } from '../values/index';

/**
 * In rule definition
 */
export const inRule: RuleDefinition = {
  validate(context: ValidationContext): string | null {
    const { value, ruleParam, messages } = context;

    // A false or null parameter disables the rule.
    if (ruleParam === false || ruleParam === null || ruleParam === undefined) {
      return null;
    }

    const members = readMembers(ruleParam);
    if ('error' in members) {
      throw new TypeError(members.error);
    }

    // An empty value passes without evaluation (required handles it).
    if (isEmpty(value)) {
      return null;
    }

    if (!isMember(value, members.members)) {
      return messages?.in ?? 'Please select a valid option.';
    }

    return null;
  },
};
