/**
 * Reference validation rule
 *
 * Validates that a value names an id that the data declares at the field the parameter names
 * (validation-rules.md, "References").
 */

import { parameterRule } from './factories';
import { isMember } from '../values/index';

/** Whether a rule parameter is a declaration path: a string, which the load checks against the form. */
const isDeclarationPath = (param: unknown): param is string => typeof param === 'string';

/** Reference rule definition. */
export const referenceRule = parameterRule(
  isDeclarationPath,
  'Invalid reference parameter: expected the declaration path of a field',
  (value, path, context) =>
    isMember(value, context.run.referenceIds(path))
      ? null
      : (context.messages?.reference ?? 'Please select an existing value.')
);
