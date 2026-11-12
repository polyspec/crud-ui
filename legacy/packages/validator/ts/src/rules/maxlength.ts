/**
 * Maximum length validation rule
 *
 * The canonical text of the value has at most the given number of code points
 * (validation-rules.md, "Values"). An array or object value fails.
 */

import { parameterRule } from './factories';
import { codePointLength, formatMessage, isLengthLimit } from '../values/index';

/** Maxlength rule definition. */
export const maxlengthRule = parameterRule(
  isLengthLimit,
  'Invalid maxlength parameter: expected an integer from 0 to 9007199254740991',
  (value, limit, { messages }) => {
    const length = codePointLength(value);
    return length === undefined || length > limit
      ? formatMessage(messages?.maxlength ?? 'Please enter no more than {0} characters.', limit)
      : null;
  }
);
