import { describe, expect, it } from 'vitest';
import { validate } from './validate';

// A range field is validated by its required `range` and `step` rules (docs/spec/schema.md,
// Range fields): a value passes when it is numeric, within the bounds and a multiple of the step.
describe('range field values', () => {
  const spec = { type: 'group', properties: { volume: { type: 'range', validate: { range: [0, 1], step: 0.1 } } } };
  const errors = (volume: unknown) => validate(spec, { volume }).errors.map(error => error.rule);

  it('passes a number or numeric text on a step within the bounds', () => {
    for (const volume of [0, 0.3, '0.7', 1]) expect(errors(volume)).toEqual([]);
  });

  it('fails a value outside the bounds, off the step or not numeric', () => {
    expect(errors(1.1)).toEqual(['range']);
    expect(errors(-0.1)).toEqual(['range']);
    expect(errors(0.25)).toEqual(['step']);
    expect(errors(0.30000000000000004)).toEqual(['step']);
    expect(errors('loud')).toEqual(['range']);
    expect(errors(true)).toEqual(['range']);
  });

  it('passes an empty value unless required', () => {
    expect(errors('')).toEqual([]);
    const required = { type: 'group', properties: { volume: { type: 'range', validate: { required: true, range: [0, 1], step: 0.1 } } } };
    expect(validate(required, { volume: '' }).errors.map(error => error.rule)).toEqual(['required']);
  });
});
