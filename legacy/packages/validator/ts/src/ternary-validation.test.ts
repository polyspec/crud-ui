import { describe, expect, it } from 'vitest';
import { validate } from './validate';

describe('conditional validation parameters', () => {
  const spec = {
    type: 'group',
    properties: {
      enabled: { type: 'text' },
      limit: { type: 'text' },
      value: { type: 'text', validate: { min: '.enabled ? .limit : 0' } },
    },
  };

  it('uses the selected field value as the numeric limit', () => {
    const result = validate(spec, { enabled: true, limit: 7, value: '5' });
    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject([{ path: 'value', rule: 'min' }]);
    expect(validate(spec, { enabled: true, limit: 7, value: '8' }).valid).toBe(true);
  });
});
