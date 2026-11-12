/**
 * URL validation rule
 *
 * Validates that a value is a valid URL
 */

import { formatRule } from './factories';
import { trim } from '../values/index';

/**
 * URL pattern for validation
 * Supports http, https, ftp protocols
 */
const URL_PATTERN = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * Check if a value is a valid URL
 */
function isValidUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = trim(value);
  if (trimmed === '') {
    return false;
  }

  // Try using URL constructor if available (modern browsers)
  try {
    const url = new URL(trimmed);
    return ['http:', 'https:', 'ftp:'].includes(url.protocol);
  } catch (error) { if (!(error instanceof TypeError)) throw error;
    // Fall back to regex validation
    return URL_PATTERN.test(trimmed);
  }
}

/** URL rule definition. */
export const urlRule = formatRule('url', isValidUrl, 'Please enter a valid URL.');
