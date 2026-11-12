/**
 * Min From and Max From validation rules (CUVR-079)
 *
 * Validates that a finite number is at or above, or at or below, the value of another field
 */

import { parameterRule } from './factories';
import { isFieldReference, resolveFieldParam } from './equalTo';
import type { RuleDefinition } from '../types';

const isFinite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** A rule whose bound is the value of a referenced field: a missing or null bound declares none. */
function boundRule(rule: 'minFrom' | 'maxFrom', within: (value: number, bound: number) => boolean, fallback: string): RuleDefinition {
  return parameterRule(
    isFieldReference,
    `Invalid ${rule} parameter: expected a field reference string`,
    (value, reference, context) => {
      const bound = resolveFieldParam(reference, context);
      const holds = isFinite(value) && (bound === undefined || bound === null || (isFinite(bound) && within(value, bound)));
      return holds ? null : (context.messages?.[rule] ?? fallback);
    }
  );
}

/** Min From rule definition. */
export const minFromRule = boundRule('minFrom', (value, bound) => value >= bound, 'Please enter a value at or above the declared minimum.');

/** Max From rule definition. */
export const maxFromRule = boundRule('maxFrom', (value, bound) => value <= bound, 'Please enter a value at or below the declared maximum.');
