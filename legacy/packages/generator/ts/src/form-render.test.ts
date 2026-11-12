import { describe, expect, it } from 'vitest';
import { FormInputError } from '@polyspec/crudui-validator';
import { decodeFormRenderOptions, FormRenderOptionsError } from './index';

/** `value` as a page embeds it and a client parses it: the JSON text read back. */
const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** The JSON Pointer and message that decodeFormRenderOptions names for `value`, or undefined when it decodes. */
function failure(value: unknown): { pointer: string; message: string } | undefined {
  try {
    decodeFormRenderOptions(asJson(value));
    return undefined;
  } catch (error) {
    if (!(error instanceof FormRenderOptionsError)) throw error;
    return { pointer: error.pointer, message: error.message };
  }
}

describe('decodeFormRenderOptions', () => {
  it('decodes the JSON of render options into the options that renderForm takes', () => {
    const options = {
      action: { method: 'post', url: '/save' },
      hidden: { _csrf: 'token' },
      formErrors: ['Check the marked fields.'],
      errors: [{ path: 'name', message: 'Required', rule: 'required' }],
    };
    expect(decodeFormRenderOptions(asJson(options))).toStrictEqual(options);
    expect(decodeFormRenderOptions(asJson({}))).toStrictEqual({});
  });

  it('fails with the message of form-runtime.md and the JSON Pointer of the invalid member', () => {
    expect(failure('options')).toStrictEqual({ pointer: '', message: 'Render options must be an object' });
    expect(failure({ extra: 1 })).toStrictEqual({ pointer: '/extra', message: 'Unknown render option: extra' });
    expect(failure({ 'a/b~c': 1 })).toStrictEqual({ pointer: '/a~1b~0c', message: 'Unknown render option: a/b~c' });
    expect(failure({ action: { method: 1 } }))
      .toStrictEqual({ pointer: '/action', message: 'action must be an object with string method, url and enctype' });
    expect(failure({ action: {}, hidden: { a: 1 } })).toStrictEqual({ pointer: '/hidden', message: 'hidden must be an object of strings' });
    expect(failure({ hidden: {} })).toStrictEqual({ pointer: '/hidden', message: 'hidden requires action' });
    expect(failure({ formErrors: ['a', 2] })).toStrictEqual({ pointer: '/formErrors/1', message: 'formErrors must be a list of strings' });
    expect(failure({ formErrors: 'a' })).toStrictEqual({ pointer: '/formErrors', message: 'formErrors must be a list of strings' });
    expect(failure({ errors: [{ path: 'a', message: 'b' }, { path: 'c' }] }))
      .toStrictEqual({ pointer: '/errors/1', message: 'errors must be a list of objects with string path and message' });
  });

  it('throws a FormInputError, the error of every form input', () => {
    expect(() => decodeFormRenderOptions({ extra: 1 })).toThrow(FormInputError);
  });
});
