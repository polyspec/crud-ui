/**
 * End Date validation rule
 *
 * Validates that an end date is greater than or equal to a start date field
 */

import { parameterRule } from './factories';
import { isEmpty } from './required';
import { parseDate } from './date';
import { isFieldReference, resolveFieldParam } from './equalTo';

/** End Date rule definition. */
export const enddateRule = parameterRule(
  isFieldReference,
  'Invalid enddate parameter: expected a field reference string',
  (value, reference, context) => {
    // Parse the end date (current field value)
    const endDate = parseDate(value);
    if (endDate === null) {
      return null; // Invalid date format, let date rule handle it
    }

    const startDateValue = resolveFieldParam(reference, context);

    // Skip if start date is empty
    if (isEmpty(startDateValue)) {
      return null;
    }

    // Parse the start date
    const startDate = parseDate(startDateValue);
    if (startDate === null) {
      return null; // Invalid start date, skip validation
    }

    // Compare dates
    return endDate.getTime() < startDate.getTime()
      ? (context.messages?.enddate ?? 'End date must be after the start date.')
      : null;
  }
);
