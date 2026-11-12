/**
 * Rule factories. `parameterRule` is the shape of every rule that takes a parameter: a false,
 * null or absent parameter switches the rule off, a parameter of another kind throws a
 * TypeError, an empty value passes without evaluation (`required` handles it) unless the rule
 * evaluates empty values, and the rule itself decides the rest. `formatRule` is the rule that
 * checks one format of a non-empty value.
 */

import type { MessagesSpec, RuleDefinition, ValidationContext } from '../types';
import { isEmpty } from './required';

/** Whether a parameter switches a rule off: false, null or absent. */
const isOff = (ruleParam: unknown): boolean => ruleParam === false || ruleParam === null || ruleParam === undefined;

/**
 * A rule with a parameter of the kind `isParameter` accepts (`parameterError` is the TypeError
 * message for any other kind); `evaluate` returns the error message or null.
 * With `evaluatesEmpty` the rule also evaluates empty values.
 */
export function parameterRule<P>(
  isParameter: (ruleParam: unknown) => ruleParam is P,
  parameterError: string,
  evaluate: (value: unknown, ruleParam: P, context: ValidationContext) => string | null,
  evaluatesEmpty = false
): RuleDefinition {
  return {
    validate(context: ValidationContext): string | null {
      const { value, ruleParam } = context;
      if (isOff(ruleParam)) {
        return null;
      }
      if (!isParameter(ruleParam)) {
        throw new TypeError(parameterError);
      }
      if (!evaluatesEmpty && isEmpty(value)) {
        return null;
      }
      return evaluate(value, ruleParam, context);
    },
  };
}

/** Whether a parameter is the flag true. */
const isTrue = (ruleParam: unknown): ruleParam is true => ruleParam === true;

/** A rule whose parameter is the flag true and that fails a non-empty value for which `isValid` is false. */
export function flagRule(
  name: keyof MessagesSpec,
  parameterError: string,
  isValid: (value: unknown) => boolean,
  defaultMessage: string
): RuleDefinition {
  return parameterRule(isTrue, parameterError, (value, _ruleParam, { messages }) =>
    isValid(value) ? null : (messages?.[name] ?? defaultMessage)
  );
}

/**
 * A rule that fails a non-empty value for which `isValid` is false, with the message of the
 * spec or `defaultMessage`. A parameter for which `enabled` is false switches the rule off.
 */
export function formatRule(
  name: keyof MessagesSpec,
  isValid: (value: unknown) => boolean,
  defaultMessage: string,
  enabled: (ruleParam: unknown) => boolean = (ruleParam) => ruleParam !== false
): RuleDefinition {
  return {
    validate(context: ValidationContext): string | null {
      const { value, ruleParam, messages } = context;
      if (!enabled(ruleParam) || isEmpty(value)) {
        return null;
      }
      return isValid(value) ? null : (messages?.[name] ?? defaultMessage);
    },
  };
}
