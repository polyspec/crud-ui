/** Validation input failures, distinct from composition load failures. */

/** Submitted form data whose shape does not match the specification. */
export class FormInputError extends Error {
  /** Stable machine-readable code shared with the form runtime. */
  readonly code = 'INVALID_FORM_INPUT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'FormInputError';
    Object.setPrototypeOf(this, FormInputError.prototype);
  }
}
