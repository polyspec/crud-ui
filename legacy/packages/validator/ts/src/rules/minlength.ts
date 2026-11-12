/**
 * Minimum length validation rule
 *
 * The canonical text of the value has at least the given number of code points
 * (validation-rules.md, "Values"). An array or object value fails.
 */

import { parameterRule } from './factories';
import { codePointLength, formatMessage, isLengthLimit } from '../values/index';

/** Minlength rule definition. */
export const minlengthRule = parameterRule(
  isLengthLimit,
  'Invalid minlength parameter: expected an integer from 0 to 9007199254740991',
  (value, limit, { messages }) => {
    const length = codePointLength(value);
    return length === undefined || length < limit
      ? formatMessage(messages?.minlength ?? 'Please enter at least {0} characters.', limit)
      : null;
  }
);
