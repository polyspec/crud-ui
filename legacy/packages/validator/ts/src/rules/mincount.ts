/**
 * Min Count validation rule
 *
 * The count of the value (validation-rules.md, "Numbers") is at least the limit.
 * Unlike most rules, it evaluates empty values: an empty or missing collection
 * counts 0.
 */

import { parameterRule } from './factories';
import { countOf, formatMessage, isLengthLimit } from '../values/index';

/** Min Count rule definition. */
export const mincountRule = parameterRule(
  isLengthLimit,
  'Invalid mincount parameter: expected an integer from 0 to 9007199254740991',
  (value, limit, { messages }) =>
    countOf(value) < limit ? formatMessage(messages?.mincount ?? 'Please select at least {0} items.', limit) : null,
  true
);
