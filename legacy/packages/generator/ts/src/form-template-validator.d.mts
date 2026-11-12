// The declaration of form-template-validator.mjs, which scripts/generate-form-template-validator.mts generates from
// contracts/schema/form-template.schema.json with ajv standalone validation code (C14.38).
import type { ValidateFunction } from 'ajv';
import type { FormTemplate } from './form';

/** Validates a value against contracts/schema/form-template.schema.json, recording every error in `errors`. */
export declare const validateFormTemplate: ValidateFunction<FormTemplate>;
