/**
 * Field shapes that the validator reads from a composed field declaration.
 */

import { isRecord } from '../record';

/** Whether a field repeats: `multiple` is `true`, `only` or an object (docs/spec/schema.md, CUSC-041). */
export function isMultipleField(field: Record<string, unknown>): boolean {
  const multiple = field.multiple;
  return multiple === true || multiple === 'only' || isRecord(multiple);
}
