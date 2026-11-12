/** Errors for field types without a registered renderer. */

/** An unregistered field type reached the renderer (default-throw mode). */
export class UnsupportedFieldTypeError extends Error {
  /** Stable error code used by conformance error assertions. */
  readonly code = 'UNSUPPORTED_FIELD_TYPE' as const;
  /** The unregistered type string. */
  readonly type: string;
  /** The field path where it occurred. */
  readonly path: string;

  constructor(type: string, path: string) {
    super(`Unsupported field type "${type}" at "${path}"`);
    this.name = 'UnsupportedFieldTypeError';
    this.type = type;
    this.path = path;
    Object.setPrototypeOf(this, UnsupportedFieldTypeError.prototype);
  }
}
