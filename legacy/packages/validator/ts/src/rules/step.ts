/**
 * Step validation rule
 *
 * A nonempty value passes when it is numeric and an integer multiple of the step,
 * counted from 0 and decided exactly on the canonical decimal texts
 * (validation-rules.md, "Numbers"). A value that is not numeric fails.
 */

import { parameterRule } from './factories';
import { formatMessage, isMultiple, isStep, numericValue } from '../values/index';

/** The parameter message of `step`. */
const STEP_PARAMETER_ERROR = 'Invalid step parameter: expected a finite number above 0';

/** Step rule definition. */
export const stepRule = parameterRule(isStep, STEP_PARAMETER_ERROR, (value, step, { messages }) => {
  const number = numericValue(value);
  return number === undefined || !isMultiple(number, step)
    ? formatMessage(messages?.step ?? 'Please enter a value that is a multiple of {0}.', step)
    : null;
});
