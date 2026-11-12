/**
 * ISO Date validation rule
 *
 * Validates that a value is a valid ISO 8601 date format (YYYY-MM-DD)
 */

import { formatRule } from './factories';
import { trim } from '../values/index';

/**
 * ISO date pattern (YYYY-MM-DD)
 */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check if a value is a valid ISO date
 */
function isValidDateISO(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = trim(value);
  if (!ISO_DATE_PATTERN.test(trimmed)) {
    return false;
  }

  // Validate the date components
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Check month range
  if (month < 1 || month > 12) {
    return false;
  }

  // Check day range based on month
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return false;
  }

  // Verify the date is valid by creating a Date object
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    return false;
  }

  // Ensure the parsed date matches the input
  return date.getUTCFullYear() === year &&
         date.getUTCMonth() + 1 === month &&
         date.getUTCDate() === day;
}

/** DateISO rule definition. */
export const dateISORule = formatRule(
  'dateISO',
  isValidDateISO,
  'Please enter a valid date in ISO format (YYYY-MM-DD).'
);
