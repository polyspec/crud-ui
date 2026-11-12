import { describe, expect, it } from 'vitest';
import { FormInputError, hiddenPaths } from './index';

// The data paths of the fields that design.show hides (docs/spec/form-runtime.md, Display).
const spec = {
  type: 'group',
  properties: {
    render: { type: 'select' },
    modes: {
      type: 'group',
      design: { show: ".render != 'csr'" },
      properties: {
        navigation: { type: 'text' },
        note: { type: 'text', design: { show: ".navigation == 'swap'" } },
      },
    },
    rows: {
      type: 'group',
      multiple: true,
      properties: {
        mode: { type: 'text' },
        extra: { type: 'text', design: { show: ".mode == 'x'" } },
      },
    },
    always: { type: 'text', design: { show: true } },
  },
};

describe('hiddenPaths', () => {
  it('lists the fields whose design.show resolves to false, inside hidden groups and rows included', () => {
    expect(hiddenPaths(spec, { render: 'csr', modes: { navigation: 'document' }, rows: { __b__: { mode: 'x' }, __a__: { mode: 'y' } } }))
      .toStrictEqual(['modes', 'modes.note', 'rows.__a__.extra']);
  });

  it('reads missing data and data of another shape as missing', () => {
    expect(hiddenPaths(spec, { modes: 'text', rows: { __a__: 3 } })).toStrictEqual(['modes.note', 'rows.__a__.extra']);
  });

  it('fails for data that is not an object', () => {
    expect(() => hiddenPaths(spec, [])).toThrow(FormInputError);
  });
});
