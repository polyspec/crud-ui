/**
 * Composition load errors (SPEC §5, §7; unresolved_behavior).
 *
 * Composition is a pre-processing pass that runs BEFORE validation/render: the
 * parser expands `$ref`/`$patch` into a single spec first (G5). An unresolved
 * composition is therefore NOT a validation failure (`valid:false`) — it is a
 * LOAD FAILURE: the spec itself does not come into existence. An unresolved
 * `$ref` never passes as `valid:true`. Every throw here is a load error,
 * distinct from a later validation error.
 *
 * Load errors:
 *   (1) $ref file missing
 *   (2) $ref format error
 *   (3) detectKey absent
 *   (4) $ref cycle (A→B→A)
 *   (5) $patch target/op error
 */

/** Base class for every composition load failure. NOT a validation error. */
export class ComposeLoadError extends Error {
  /** Stable machine-readable code (one per unresolved-behavior class). */
  readonly code: ComposeErrorCode;
  /** The composition path stack when the error occurred (for cycle/trace). */
  readonly trace: string[];

  constructor(code: ComposeErrorCode, message: string, trace: string[] = []) {
    super(message);
    this.name = 'ComposeLoadError';
    this.code = code;
    this.trace = trace;
    // Restore prototype chain (TS target ES2020 + extending Error).
    Object.setPrototypeOf(this, ComposeLoadError.prototype);
  }
}

/** Machine-readable load-error codes. */
export type ComposeErrorCode =
  /** $ref points at a file that does not exist (or cannot be read). */
  | 'REF_FILE_NOT_FOUND'
  /** $ref string is malformed: `(…` with no closing `).keys`, or empty path. */
  | 'REF_FORMAT_ERROR'
  /** A detectKey path segment (or the trailing `properties`) is absent. */
  | 'REF_DETECT_KEY_NOT_FOUND'
  /** $ref cycle detected (A→B→A). */
  | 'REF_CYCLE'
  /** $ref value is neither a string nor an array of strings. */
  | 'REF_VALUE_TYPE'
  /** $patch is not an object of deep-path → value entries. */
  | 'PATCH_SHAPE'
  /** $patch op targets a path whose intermediate node is a non-object scalar. */
  | 'PATCH_PATH_CONFLICT'
  /** $patch remove targets a path that does not exist (strict remove). */
  | 'PATCH_REMOVE_TARGET_MISSING'
  /**
   * A forbidden meta key survived into the composed single spec at some depth
   * (SPEC §6). The recursive forbidden-scan runs after composition and x-strip and
   * before validation; a forbidden key anywhere is a LOAD failure, never
   * `valid:true`. `trace` carries the dotted path to the offending key.
   */
  | 'FORBIDDEN_META_KEY'
  /**
   * A rule parameter outside the definitions of validation-rules.md ("Parameter
   * errors"). `trace` is the field's declaration path without row keys.
   */
  | 'INVALID_RULE_PARAMETER'
  /** A `match`/`pattern` string outside the CRUDUI pattern language. */
  | 'INVALID_RULE_PATTERN'
  /**
   * A `validate` or `messages` key that is not a registered rule name
   * (validation-rules.md, "Parameter errors"). `trace` is the field's declaration path.
   */
  | 'UNKNOWN_RULE'
  /**
   * A string or member name in the specification or a composition file that is not a sequence
   * of Unicode scalar values (docs/spec/input-text.md). `trace` is its path.
   */
  | 'INVALID_TEXT';
