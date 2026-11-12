import { describe, expect, it } from 'vitest';
import { validate } from './index';
import { FormInputError } from './errors';

const spec = {
  type: 'group',
  properties: {
    title: { type: 'text' },
    address: { type: 'group', properties: { city: { type: 'text' } } },
    rows: { type: 'group', multiple: true, properties: { code: { type: 'text' } } },
  },
};

describe('unknown form data fields', () => {
  it('fails at the first undeclared field in each object', () => {
    for (const [data, path] of [
      [{ title: 'T', z: 1, a: 2 }, 'a'],
      [{ address: { city: 'Seoul', extra: 1 } }, 'address.extra'],
      [{ rows: { row1: { code: 'C', extra: 1 } } }, 'rows.row1.extra'],
    ] as const) {
      expect(() => validate(spec, data)).toThrow(new FormInputError(`Unknown form data field: ${path}`));
    }
  });
});
