/**
 * The accept rule reads the MIME type and the file name of a file object only from string
 * members (validation-rules.md): a member of another type names neither, and the rule judges
 * the file by its other member instead of failing.
 */

import { describe, expect, test } from 'vitest';
import { validate } from '../validate/index';

const spec = { type: 'group', properties: { file: { type: 'file', validate: { accept: 'image/*' } } } };

describe('accept on a file object with a member that is no string', () => {
  test('a numeric type leaves the file to its name', () => {
    expect(validate(spec, { file: { type: 5, name: 'photo.png' } }).valid).toBe(true);
    expect(validate(spec, { file: { type: 5, name: 'notes.txt' } }).valid).toBe(false);
  });

  test('a numeric type in a list of files leaves each file to its name', () => {
    expect(validate(spec, { file: [{ type: 5, name: 'photo.png' }] }).valid).toBe(true);
    expect(validate(spec, { file: [{ mimeType: 7, filename: 'notes.txt' }] }).valid).toBe(false);
  });
});
