/**
 * Max Count validation rule
 *
 * The count of the value (validation-rules.md, "Numbers") is at most the limit.
 * It evaluates empty values, which count 0.
 */

import { parameterRule } from './factories';
import { countOf, formatMessage, isLengthLimit } from '../values/index';

/** Max Count rule definition. */
export const maxcountRule = parameterRule(
  isLengthLimit,
  'Invalid maxcount parameter: expected an integer from 0 to 9007199254740991',
  (value, limit, { messages }) =>
    countOf(value) > limit ? formatMessage(messages?.maxcount ?? 'Please select no more than {0} items.', limit) : null,
  true
);
