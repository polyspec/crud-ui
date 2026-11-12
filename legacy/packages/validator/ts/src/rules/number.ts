/**
 * Number validation rule
 *
 * A nonempty value passes when it is numeric (validation-rules.md, "Numbers").
 */

import { flagRule } from './factories';
import { numericValue } from '../values/index';

/** The parameter message of `number`. */
const NUMBER_PARAMETER_ERROR = 'Invalid number parameter: expected true or false';

/** Number rule definition. */
export const numberRule = flagRule(
  'number',
  NUMBER_PARAMETER_ERROR,
  (value) => numericValue(value) !== undefined,
  'Please enter a valid number.'
);
