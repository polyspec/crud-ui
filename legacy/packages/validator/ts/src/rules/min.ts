/**
 * Minimum value validation rule
 *
 * A nonempty value passes when it is numeric and not below the inclusive minimum
 * (validation-rules.md, "Numbers"). A value that is not numeric fails.
 */

import { parameterRule } from './factories';
import { formatMessage, isFiniteNumber, numericValue } from '../values/index';

/** Min rule definition. */
export const minRule = parameterRule(
  isFiniteNumber,
  'Invalid min parameter: expected a finite number',
  (value, limit, { messages }) => {
    const number = numericValue(value);
    return number === undefined || number < limit
      ? formatMessage(messages?.min ?? 'Please enter a value greater than or equal to {0}.', limit)
      : null;
  }
);
