/**
 * Accept validation rule
 *
 * Validates that a file has an acceptable MIME type or extension
 */

import { isRecord } from '../record';
import { RuleDefinition, ValidationContext } from '../types';
import { isEmpty } from './required';
import { trim } from '../values/index';

/**
 * Common MIME type mappings
 */
const EXTENSION_TO_MIME: Record<string, string[]> = {
  // Images
  'jpg': ['image/jpeg'],
  'jpeg': ['image/jpeg'],
  'png': ['image/png'],
  'gif': ['image/gif'],
  'webp': ['image/webp'],
  'svg': ['image/svg+xml'],
  'bmp': ['image/bmp'],
  'ico': ['image/x-icon', 'image/vnd.microsoft.icon'],

  // Documents
  'pdf': ['application/pdf'],
  'doc': ['application/msword'],
  'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  'xls': ['application/vnd.ms-excel'],
  'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  'ppt': ['application/vnd.ms-powerpoint'],
  'pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  'txt': ['text/plain'],
  'csv': ['text/csv', 'application/csv'],

  // Audio
  'mp3': ['audio/mpeg', 'audio/mp3'],
  'wav': ['audio/wav', 'audio/x-wav'],
  'ogg': ['audio/ogg'],
  'flac': ['audio/flac'],

  // Video
  'mp4': ['video/mp4'],
  'webm': ['video/webm'],
  'avi': ['video/x-msvideo'],
  'mov': ['video/quicktime'],
  'mkv': ['video/x-matroska'],

  // Archives
  'zip': ['application/zip', 'application/x-zip-compressed'],
  'rar': ['application/x-rar-compressed', 'application/vnd.rar'],
  'tar': ['application/x-tar'],
  'gz': ['application/gzip'],
  '7z': ['application/x-7z-compressed'],

  // Code
  'json': ['application/json'],
  'xml': ['application/xml', 'text/xml'],
  'html': ['text/html'],
  'css': ['text/css'],
  'js': ['application/javascript', 'text/javascript'],
};

/**
 * Parse accept parameter into a list of allowed MIME types
 */
function parseAcceptParam(param: unknown): string[] {
  const acceptList: string[] = [];

  if (typeof param === 'string') {
    // Split by comma
    const parts = param.split(',').map(p => trim(p).toLowerCase());
    for (const part of parts) {
      if (part.startsWith('.')) {
        // Extension (e.g., .jpg)
        const ext = part.slice(1);
        const mimes = EXTENSION_TO_MIME[ext];
        if (mimes) {
          acceptList.push(...mimes);
        } else {
          // Unknown extension, add as-is pattern
          acceptList.push(part);
        }
      } else if (part.includes('/')) {
        // MIME type (e.g., image/jpeg or image/*)
        acceptList.push(part);
      }
    }
  } else if (Array.isArray(param)) {
    for (const item of param) {
      acceptList.push(...parseAcceptParam(item));
    }
  }

  return acceptList;
}

/**
 * Check if a MIME type matches the accept list
 */
function matchesMimeType(mimeType: string, acceptList: string[]): boolean {
  const normalizedMime = mimeType.toLowerCase();

  for (const accept of acceptList) {
    if (accept === '*/*') {
      return true;
    }

    if (accept.endsWith('/*')) {
      // Wildcard type (e.g., image/*)
      const typePrefix = accept.slice(0, -1); // Remove *
      if (normalizedMime.startsWith(typePrefix)) {
        return true;
      }
    } else if (accept.startsWith('.')) {
      // Extension check - need to extract extension from filename
      continue; // This is handled separately
    } else if (normalizedMime === accept) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a file extension matches the accept list
 *
 * A filename carries no MIME header, so the extension is mapped to its MIME
 * type(s) via EXTENSION_TO_MIME and those are matched against MIME entries
 * (including wildcards like image slash star and star slash star). Direct
 * extension entries (.jpg) are also matched. Without this mapping a filename
 * such as "image1.jpg" would never satisfy accept of image slash star.
 */
function matchesExtension(filename: string, acceptList: string[]): boolean {
  const parts = filename.toLowerCase().split('.');
  // No dot in the filename means no extension to test.
  if (parts.length < 2) {
    return false;
  }
  const ext = parts.pop();
  if (!ext) {
    return false;
  }

  for (const accept of acceptList) {
    if (accept.startsWith('.')) {
      if (accept.slice(1) === ext) {
        return true;
      }
    }
  }

  // Infer MIME from the extension, then match MIME wildcards/exact.
  const inferredMimes = EXTENSION_TO_MIME[ext];
  if (inferredMimes) {
    for (const mime of inferredMimes) {
      if (matchesMimeType(mime, acceptList)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * The first of the members `key` and `alternative` of a file object that is a non-empty string, or '' when neither is
 * one: a member of another type names no MIME type or file name.
 */
function fileText(file: Record<string, unknown>, key: string, alternative: string): string {
  for (const value of [file[key], file[alternative]]) {
    if (typeof value === 'string' && value !== '') return value;
  }
  return '';
}

/**
 * Accept rule definition
 */
export const acceptRule: RuleDefinition = {
  validate(context: ValidationContext): string | null {
    const { value, ruleParam, messages } = context;

    // Skip if no rule param
    if (ruleParam === null || ruleParam === undefined || ruleParam === false) {
      return null;
    }

    // Skip validation if value is empty (required rule handles this)
    if (isEmpty(value)) {
      return null;
    }

    const acceptList = parseAcceptParam(ruleParam);
    if (acceptList.length === 0) {
      return null;
    }

    // Handle File object (browser environment)
    if (typeof File !== 'undefined' && value instanceof File) {
      const file = value;

      // Check MIME type
      if (file.type && matchesMimeType(file.type, acceptList)) {
        return null;
      }

      // Check extension
      if (file.name && matchesExtension(file.name, acceptList)) {
        return null;
      }

      return messages?.accept ?? 'Please upload a file with a valid format.';
    }

    // Handle FileList
    if (typeof FileList !== 'undefined' && value instanceof FileList) {
      for (let i = 0; i < value.length; i++) {
        const file = value[i];
        const isValid =
          (file.type && matchesMimeType(file.type, acceptList)) ||
          (file.name && matchesExtension(file.name, acceptList));

        if (!isValid) {
          return messages?.accept ?? 'Please upload files with valid formats.';
        }
      }
      return null;
    }

    // Handle array of files (React, etc.)
    if (Array.isArray(value)) {
      for (const file of value) {
        if (isRecord(file)) {
          const mimeType = fileText(file, 'type', 'mimeType');
          const filename = fileText(file, 'name', 'filename');

          const isValid =
            (mimeType && matchesMimeType(mimeType, acceptList)) ||
            (filename && matchesExtension(filename, acceptList));

          if (!isValid) {
            return messages?.accept ?? 'Please upload files with valid formats.';
          }
        }
      }
      return null;
    }

    // Handle string (filename or MIME type)
    if (typeof value === 'string') {
      if (value.includes('/')) {
        // MIME type string
        if (!matchesMimeType(value, acceptList)) {
          return messages?.accept ?? 'Please upload a file with a valid format.';
        }
      } else {
        // Filename string
        if (!matchesExtension(value, acceptList)) {
          return messages?.accept ?? 'Please upload a file with a valid format.';
        }
      }
      return null;
    }

    // Handle object with type/name properties
    if (isRecord(value)) {
      const mimeType = fileText(value, 'type', 'mimeType');
      const filename = fileText(value, 'name', 'filename');

      const isValid =
        (mimeType && matchesMimeType(mimeType, acceptList)) ||
        (filename && matchesExtension(filename, acceptList));

      if (!isValid) {
        return messages?.accept ?? 'Please upload a file with a valid format.';
      }
    }

    return null;
  },
};
