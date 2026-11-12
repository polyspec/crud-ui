/**
 * Type From validation rule (CUVR-077)
 *
 * Validates that a value has the type that the value of another field names: bool, int or enum
 */

import { parameterRule } from './factories';
import { isFieldReference, resolveFieldParam } from './equalTo';

/** Whether `value` has the type that `type` names; any other type fails. */
function hasType(value: unknown, type: unknown): boolean {
  if (type === 'bool') return typeof value === 'boolean';
  if (type === 'int') return typeof value === 'number' && Number.isInteger(value);
  if (type === 'enum') return typeof value === 'string';
  return false;
}

/** Type From rule definition. */
export const typeFromRule = parameterRule(
  isFieldReference,
  'Invalid typeFrom parameter: expected a field reference string',
  (value, reference, context) =>
    hasType(value, resolveFieldParam(reference, context)) ? null : (context.messages?.typeFrom ?? 'Please enter a value of the declared type.')
);
