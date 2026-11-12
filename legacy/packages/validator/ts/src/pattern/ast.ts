/**
 * Syntax tree of the CRUDUI pattern language (validation-rules.md, "Patterns").
 */

/** A shorthand set: `\d`, `\w` or `\s`. */
export type Shorthand = 'digit' | 'word' | 'space';

/** A Unicode property: a general category or a script. */
export interface Property {
  kind: 'property';
  /** `\P{…}`: the complement of the property. */
  negated: boolean;
  /** A general category (`Lu`) or a script name (`Hangul`). */
  name: string;
  /** Whether `name` is a script (`\p{Script=Name}`). */
  script: boolean;
}

/** One code point. */
export interface CodePoint {
  kind: 'char';
  value: number;
}

/** A member of a bracket class. */
export type ClassMember =
  | CodePoint
  | { kind: 'range'; from: number; to: number }
  | { kind: 'shorthand'; set: Shorthand }
  | Property;

/** An atom: the unit a quantifier applies to. */
export type Atom =
  | CodePoint
  | { kind: 'any' }
  | { kind: 'shorthand'; set: Shorthand; negated: boolean }
  | Property
  | { kind: 'class'; negated: boolean; members: ClassMember[] }
  | { kind: 'group'; body: Alternation };

/** A repetition `{min,max}`; `max` is `null` when unbounded. */
export interface Quantifier {
  min: number;
  max: number | null;
  lazy: boolean;
}

/** An atom with its optional quantifier. */
export interface Term {
  atom: Atom;
  quantifier: Quantifier | null;
}

/** Alternatives, each a sequence of terms. */
export interface Alternation {
  branches: Term[][];
}
