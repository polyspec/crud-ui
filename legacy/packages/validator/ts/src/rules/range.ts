/**
 * Range validation rule
 *
 * A nonempty value passes when it is numeric and within the inclusive
 * `[minimum, maximum]` (validation-rules.md, "Numbers"). A value that is not
 * numeric fails.
 */

import { parameterRule } from './factories';
import { formatMessage, isNumberRange, numericValue } from '../values/index';

/** The parameter message of `range`. */
const RANGE_PARAMETER_ERROR =
  'Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum';

/** Range rule definition. */
export const rangeRule = parameterRule(isNumberRange, RANGE_PARAMETER_ERROR, (value, [minimum, maximum], { messages }) => {
  const number = numericValue(value);
  return number === undefined || number < minimum || number > maximum
    ? formatMessage(messages?.range ?? 'Please enter a value between {0} and {1}.', minimum, maximum)
    : null;
});
