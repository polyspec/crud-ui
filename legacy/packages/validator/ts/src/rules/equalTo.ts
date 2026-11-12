/**
 * Equal To validation rule
 *
 * Validates that a value matches another field's value
 */

import type { ValidationContext } from '../types';
import { parameterRule } from './factories';
import { resolveFieldReference } from '../parser/PathResolver';

/** Whether a rule parameter is a field reference: a string. */
export const isFieldReference = (param: unknown): param is string => typeof param === 'string';

/**
 * Resolve a rule param that references another field (relative or absolute).
 * Shares the relative-path semantics of condition expressions:
 * ".x" = sibling, "..x" = parent group's sibling, a row being one level.
 */
export function resolveFieldParam(
  param: string,
  context: ValidationContext
): unknown {
  return resolveFieldReference(param, {
    currentPath: context.pathSegments,
    rowKeys: context.rowKeys,
    formData: context.allData,
  });
}

/** Equal To rule definition. */
export const equalToRule = parameterRule(
  isFieldReference,
  'Invalid equalTo parameter: expected a field reference string',
  (value, reference, context) =>
    // Compare with the target field's value, resolved by the shared path resolver
    value !== resolveFieldParam(reference, context)
      ? (context.messages?.equalTo ?? 'Please enter the same value again.')
      : null
);
