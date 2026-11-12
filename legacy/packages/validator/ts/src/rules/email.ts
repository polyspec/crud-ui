/**
 * Email validation rule
 *
 * Validates that a field contains a valid email address
 */

import { formatRule } from './factories';

/**
 * Email regex pattern based on RFC 5322
 * This is a simplified pattern that covers most valid email formats
 */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Check if a value is a valid email address
 */
function isValidEmail(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // First check the basic pattern
  if (!EMAIL_PATTERN.test(value)) {
    return false;
  }

  // Extract local part (before @)
  const atIndex = value.indexOf('@');
  const localPart = value.substring(0, atIndex);

  // Reject if local part starts with a dot
  if (localPart.startsWith('.')) {
    return false;
  }

  // Reject if local part ends with a dot
  if (localPart.endsWith('.')) {
    return false;
  }

  // Reject if local part has consecutive dots
  if (localPart.includes('..')) {
    return false;
  }

  return true;
}

/** Email rule definition. */
export const emailRule = formatRule(
  'email',
  isValidEmail,
  'Please enter a valid email address.',
  (ruleParam) => ruleParam === true
);
