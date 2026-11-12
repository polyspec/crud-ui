/**
 * Pattern language errors (validation-rules.md, "Parameter errors").
 */

/** The reasons a pattern is outside the language. */
type PatternErrorReason =
  | 'empty pattern'
  | 'unexpected character'
  | 'unsupported construct'
  | 'invalid escape'
  | 'invalid class'
  | 'invalid range'
  | 'invalid property'
  | 'invalid quantifier'
  | 'unterminated group'
  | 'unterminated class'
  | 'invalid group name'
  | 'duplicate group name'
  | 'nesting too deep'
  | 'pattern too large';

/** A pattern outside the CRUDUI pattern language, with the code-point offset of the invalid construct. */
export class PatternSyntaxError extends Error {
  readonly reason: PatternErrorReason;
  readonly offset: number;

  constructor(reason: PatternErrorReason, offset: number) {
    super(`${reason} at ${offset}`);
    this.name = 'PatternSyntaxError';
    this.reason = reason;
    this.offset = offset;
    Object.setPrototypeOf(this, PatternSyntaxError.prototype);
  }
}

