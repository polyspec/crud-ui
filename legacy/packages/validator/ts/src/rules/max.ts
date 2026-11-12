/**
 * Maximum value validation rule
 *
 * A nonempty value passes when it is numeric and not above the inclusive maximum
 * (validation-rules.md, "Numbers"). A value that is not numeric fails.
 */

import { parameterRule } from './factories';
import { formatMessage, isFiniteNumber, numericValue } from '../values/index';

/** Max rule definition. */
export const maxRule = parameterRule(
  isFiniteNumber,
  'Invalid max parameter: expected a finite number',
  (value, limit, { messages }) => {
    const number = numericValue(value);
    return number === undefined || number > limit
      ? formatMessage(messages?.max ?? 'Please enter a value less than or equal to {0}.', limit)
      : null;
  }
);
