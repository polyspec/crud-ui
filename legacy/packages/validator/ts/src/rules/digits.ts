/**
 * Digits validation rule
 *
 * A nonempty string (trimmed) or number passes when its canonical text consists
 * only of ASCII digits (validation-rules.md, "Numbers"). Other values fail.
 */

import { flagRule } from './factories';
import { isDigits } from '../values/index';

/** The parameter message of `digits`. */
const DIGITS_PARAMETER_ERROR = 'Invalid digits parameter: expected true or false';

/** Digits rule definition. */
export const digitsRule = flagRule('digits', DIGITS_PARAMETER_ERROR, isDigits, 'Please enter only digits.');
