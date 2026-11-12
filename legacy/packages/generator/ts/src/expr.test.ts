import { describe, expect, it } from 'vitest';
import { evalAppearance, evalFlag, evalShow, makeContext } from './expr';

describe('appearance ternary evaluation', () => {
  const context = makeContext(['value'], { enabled: true, selected: 7 });

  it('resolves a selected field path', () => {
    expect(evalAppearance('.enabled ? .selected : 0', context)).toBe('7');
  });

  it('evaluates a nested true branch', () => {
    expect(evalAppearance(".enabled ? .selected == 7 ? 'yes' : 'no' : 'off'", context)).toBe('yes');
  });

  it('decodes quoted branch escapes with the expression parser', () => {
    expect(evalAppearance(String.raw`.enabled ? 'line\nnext' : ''`, context)).toBe('line\nnext');
  });
});

describe('visibility', () => {
  const context = makeContext(['value'], { mode: 'off' });

  it('hides only when design.show resolves to false', () => {
    expect(evalShow(undefined, context)).toBe(true);
    expect(evalShow(false, context)).toBe(false);
    expect(evalShow(".mode == 'on'", context)).toBe(false);
    expect(evalShow({ ".mode == 'off'": false, true: true }, context)).toBe(false);
    expect(evalShow({ ".mode == 'on'": false, true: true }, context)).toBe(true);
    // A condition map that selects nothing leaves the field visible.
    expect(evalShow({ ".mode == 'on'": false }, context)).toBe(true);
    // A string that is not a valid expression is a literal: visible.
    expect(evalShow('.mode == (', context)).toBe(true);
    expect(evalShow(".mode == 'off' ? false : true", context)).toBe(false);
  });

  it('keeps the flag rule for other flags: a map selecting nothing is false', () => {
    expect(evalFlag(undefined, context)).toBe(false);
    expect(evalFlag({ ".mode == 'on'": true }, context)).toBe(false);
    expect(evalFlag({ ".mode == 'off'": true }, context)).toBe(true);
    expect(evalFlag(".mode == 'off'", context)).toBe(true);
    expect(evalFlag('.mode == (', context)).toBe(false);
  });
});
