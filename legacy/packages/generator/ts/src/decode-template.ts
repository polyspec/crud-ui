/** The decoder of the JSON of a compiled form template (docs/spec/form-runtime.md, "Decoding a template"). */

// The validator is ajv's standalone validation code of contracts/schema/form-template.schema.json, which
// scripts/generate-form-template-validator.mts generates (make form-template-validator), so the package imports no ajv and
// compiles no code at run time (C14.38).
import type { ErrorObject } from 'ajv';
import { FormInputError } from '@polyspec/crudui-validator';

import type { FormTemplate } from './form';
import { pointerToken } from './util';
import { validateFormTemplate } from './form-template-validator.mjs';

/**
 * The error of {@link decodeFormTemplate} for a value that is no compiled form template. Its `code` is the
 * `INVALID_FORM_INPUT` of every form input error.
 */
export class FormTemplateError extends FormInputError {
  /** The JSON Pointer (RFC 6901) of the invalid member of the decoded value; the empty string is the value itself. */
  readonly pointer: string;

  constructor(pointer: string, rule: string) {
    super(`Invalid form template at ${pointer === '' ? 'the root' : pointer}: ${rule}`);
    this.name = 'FormTemplateError';
    this.pointer = pointer;
    Object.setPrototypeOf(this, FormTemplateError.prototype);
  }
}

/** The JSON Pointer of the member that `error` finds invalid: a missing or extra member is named by its own pointer. */
function pointerOf(error: ErrorObject): string {
  const { params } = error;
  if (error.keyword === 'required' && typeof params.missingProperty === 'string') return `${error.instancePath}/${pointerToken(params.missingProperty)}`;
  if (error.keyword === 'additionalProperties' && typeof params.additionalProperty === 'string') {
    return `${error.instancePath}/${pointerToken(params.additionalProperty)}`;
  }
  return error.instancePath;
}

/**
 * Decode the JSON value of a compiled form template, such as a template that a server wrote into a page with
 * `JSON.stringify(compileForm(spec))` and a client read back with `JSON.parse`, into a {@link FormTemplate}.
 *
 * @param value - The parsed JSON value; the decoder checks it against contracts/schema/form-template.schema.json.
 * @returns The value as a form template, unchanged.
 * @throws {@link FormTemplateError} with the JSON Pointer of the first invalid member when the value is no compiled
 *   form template.
 */
export function decodeFormTemplate(value: unknown): FormTemplate {
  if (validateFormTemplate(value)) return value;
  const error = validateFormTemplate.errors?.[0];
  if (error === undefined) throw new FormTemplateError('', 'is no form template');
  throw new FormTemplateError(pointerOf(error), error.message ?? error.keyword);
}
