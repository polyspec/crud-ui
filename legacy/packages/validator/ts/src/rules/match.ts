/**
 * Pattern validation rule (`match` and `pattern`)
 *
 * The whole canonical text of the value must match a pattern of the CRUDUI
 * pattern language (validation-rules.md, "Patterns").
 */

import { RuleDefinition, ValidationContext } from '../types';
import { isEmpty } from './required';
import { canonicalText } from '../values/index';
import { compilePattern } from '../pattern/index';

/**
 * Match rule definition
 */
export const matchRule: RuleDefinition = {
  validate(context: ValidationContext): string | null {
    const { value, ruleParam, messages, ruleName } = context;

    // A false or null parameter disables the rule.
    if (ruleParam === false || ruleParam === null || ruleParam === undefined) {
      return null;
    }
    if (typeof ruleParam !== 'string') {
      throw new TypeError(`Invalid ${ruleName ?? 'match'} parameter: expected a pattern string`);
    }

    // An empty value passes without evaluation (required handles it).
    if (isEmpty(value)) {
      return null;
    }

    // Throws PatternSyntaxError for a pattern outside the language: never skipped.
    const matcher = compilePattern(ruleParam);

    // A value without canonical text (an array or object) cannot match.
    const text = canonicalText(value);
    if (text === undefined || !matcher.test(text)) {
      // The custom message is found under the declared rule name only.
      const named = ruleName === 'pattern' ? messages?.pattern : messages?.match;
      return named ?? 'Please enter a valid format.';
    }

    return null;
  },
};
