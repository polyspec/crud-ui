/**
 * Range length validation rule
 *
 * The canonical text of the value has between minimum and maximum code points
 * (validation-rules.md, "Values"). An array or object value fails.
 */

import { parameterRule } from './factories';
import { codePointLength, formatMessage, isLengthRange } from '../values/index';

/** Range length rule definition. */
export const rangelengthRule = parameterRule(
  isLengthRange,
  'Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum',
  (value, [minLength, maxLength], { messages }) => {
    const length = codePointLength(value);
    return length === undefined || length < minLength || length > maxLength
      ? formatMessage(
          messages?.rangelength ?? 'Please enter a value between {0} and {1} characters.',
          minLength,
          maxLength
        )
      : null;
  }
);
