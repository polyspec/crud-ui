/**
 * Contained In validation rule (CUVR-075)
 *
 * Validates that a string value occurs in the string value of another field
 */

import { parameterRule } from './factories';
import { isFieldReference, resolveFieldParam } from './equalTo';

/** Contained In rule definition: a value or a referenced value that is not a string fails. */
export const containedInRule = parameterRule(
  isFieldReference,
  'Invalid containedIn parameter: expected a field reference string',
  (value, reference, context) => {
    const target = resolveFieldParam(reference, context);
    return typeof value === 'string' && typeof target === 'string' && target.includes(value)
      ? null
      : (context.messages?.containedIn ?? 'Please enter a value that the referenced field contains.');
  }
);
