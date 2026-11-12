/**
 * Recognizer of the CRUDUI pattern language (validation-rules.md, "Patterns" and
 * "Parameter errors").
 *
 * It reads a pattern as code points, left to right, and either returns its
 * syntax tree or throws a `PatternSyntaxError` for the first invalid construct,
 * with the reason and code-point offset the specification assigns to it.
 */

import { codePointAt } from '../code-point';
import type { Alternation, Atom, ClassMember, CodePoint, Property, Quantifier, Shorthand, Term } from './ast';
import { PatternSyntaxError } from './errors';
import { isGeneralCategory, isScript } from './sets';

/** Largest quantifier bound. */
const QUANTIFIER_LIMIT = 1000;

/** Largest pattern size. */
const SIZE_LIMIT = 1000;

/** Deepest group nesting. */
const DEPTH_LIMIT = 100;

/** A recognized pattern. Leading `^` and trailing `$` add nothing and are not kept. */
export interface RecognizedPattern {
  body: Alternation;
}

const cp = (char: string): number => codePointAt(char, 0);

/** Characters a `\` escape turns into themselves. */
const SYNTAX_ESCAPES = new Set(Array.from('^$\\.*+?()[]{}|/-', cp));

/** Control escapes. */
const CONTROL_ESCAPES = new Map<number, number>([
  [cp('t'), 0x09],
  [cp('n'), 0x0a],
  [cp('r'), 0x0d],
  [cp('f'), 0x0c],
  [cp('v'), 0x0b],
]);

const SHORTHANDS = new Map<number, { set: Shorthand; negated: boolean }>([
  [cp('d'), { set: 'digit', negated: false }],
  [cp('w'), { set: 'word', negated: false }],
  [cp('s'), { set: 'space', negated: false }],
  [cp('D'), { set: 'digit', negated: true }],
  [cp('W'), { set: 'word', negated: true }],
  [cp('S'), { set: 'space', negated: true }],
]);

/** Characters that are never literals outside a bracket class. */
const NOT_LITERAL = new Set(Array.from('\\^$.|?*+()[]{}', cp));
const QUANTIFIER_START = new Set(Array.from('*+?{', cp));

const BACKSLASH = cp('\\');
const OPEN_GROUP = cp('(');
const CLOSE_GROUP = cp(')');
const OPEN_CLASS = cp('[');
const CLOSE_CLASS = cp(']');
const OPEN_BRACE = cp('{');
const CLOSE_BRACE = cp('}');
const CARET = cp('^');
const DOLLAR = cp('$');
const DOT = cp('.');
const BAR = cp('|');
const QUESTION = cp('?');
const STAR = cp('*');
const PLUS = cp('+');
const DASH = cp('-');
const COMMA = cp(',');
const COLON = cp(':');
const LESS = cp('<');
const GREATER = cp('>');
const EQUALS = cp('=');
const BANG = cp('!');

const isSurrogate = (c: number): boolean => c >= 0xd800 && c <= 0xdfff;
const isDigit = (c: number | undefined): c is number => c !== undefined && c >= 0x30 && c <= 0x39;
const isHex = (c: number | undefined): c is number =>
  c !== undefined && (isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66));
const isNameStart = (c: number | undefined): boolean =>
  c !== undefined && ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x5f);
const isNamePart = (c: number | undefined): boolean => isNameStart(c) || isDigit(c);

/** An escape read by the recognizer: one code point, a shorthand set or a property. */
type Escape = CodePoint | { kind: 'shorthand'; set: Shorthand; negated: boolean } | Property;

class Recognizer {
  private readonly source: number[];
  private position = 0;
  private readonly groupNames = new Set<string>();
  private depth = 0;

  constructor(pattern: string) {
    this.source = Array.from(pattern, cp);
  }

  recognize(): RecognizedPattern {
    const length = this.source.length;
    if (length === 0) throw new PatternSyntaxError('empty pattern', 0);
    if (this.source[0] === CARET) this.position = 1;
    const alternation = this.alternation();
    if (this.position < length) {
      // Only a `)` without an open group stops the top-level alternation early.
      throw new PatternSyntaxError('unexpected character', this.position);
    }
    // The size limit is checked once the rest of the pattern is valid.
    if (alternationSize(alternation) > SIZE_LIMIT) throw new PatternSyntaxError('pattern too large', 0);
    return { body: alternation };
  }

  private peek(offset = 0): number | undefined {
    return this.source[this.position + offset];
  }

  /** Alternatives up to `)` or the end. */
  private alternation(): Alternation {
    const branches: Term[][] = [this.sequence()];
    while (this.peek() === BAR) {
      this.position++;
      branches.push(this.sequence());
    }
    return { branches };
  }

  private sequence(): Term[] {
    const terms: Term[] = [];
    const length = this.source.length;
    while (this.position < length) {
      const char = this.source[this.position];
      if (char === BAR || char === CLOSE_GROUP) break;
      if (char === DOLLAR || char === CARET) {
        // `^` at 0 was consumed before; `$` is an anchor only as the last character.
        if (char === CARET || this.position !== length - 1) {
          throw new PatternSyntaxError('unexpected character', this.position);
        }
        this.position++;
        break;
      }
      if (QUANTIFIER_START.has(char)) throw new PatternSyntaxError('invalid quantifier', this.position);
      const atom = this.atom();
      terms.push({ atom, quantifier: this.quantifier() });
    }
    return terms;
  }

  private atom(): Atom {
    const start = this.position;
    const char = this.source[start];
    switch (char) {
      case OPEN_GROUP:
        return this.group();
      case OPEN_CLASS:
        return this.bracketClass();
      case DOT:
        this.position++;
        return { kind: 'any' };
      case BACKSLASH:
        return this.escape(null);
    }
    if (NOT_LITERAL.has(char) || isSurrogate(char)) throw new PatternSyntaxError('unexpected character', start);
    this.position++;
    return { kind: 'char', value: char };
  }

  private group(): Atom {
    const start = this.position;
    if (this.depth === DEPTH_LIMIT) throw new PatternSyntaxError('nesting too deep', start);
    this.position++;
    if (this.peek() === QUESTION) {
      const next = this.peek(1);
      if (next === COLON) {
        this.position += 2;
      } else if (next === LESS && this.peek(2) !== EQUALS && this.peek(2) !== BANG) {
        this.position += 2;
        this.groupName(start);
      } else {
        throw new PatternSyntaxError('unsupported construct', start);
      }
    }
    this.depth++;
    const body = this.alternation();
    this.depth--;
    if (this.position >= this.source.length) {
      throw new PatternSyntaxError('unterminated group', this.source.length);
    }
    this.position++; // `)`
    return { kind: 'group', body };
  }

  /** `name>` after `(?<`. */
  private groupName(groupStart: number): void {
    const nameStart = this.position;
    if (!isNameStart(this.peek())) throw new PatternSyntaxError('invalid group name', groupStart);
    while (isNamePart(this.peek())) this.position++;
    if (this.peek() !== GREATER) throw new PatternSyntaxError('invalid group name', groupStart);
    const name = String.fromCodePoint(...this.source.slice(nameStart, this.position));
    this.position++;
    if (this.groupNames.has(name)) throw new PatternSyntaxError('duplicate group name', groupStart);
    this.groupNames.add(name);
  }

  /** An optional quantifier with its optional lazy `?`. */
  private quantifier(): Quantifier | null {
    const start = this.position;
    const char = this.peek();
    let min: number;
    let max: number | null;
    if (char === STAR) {
      [min, max] = [0, null];
      this.position++;
    } else if (char === PLUS) {
      [min, max] = [1, null];
      this.position++;
    } else if (char === QUESTION) {
      [min, max] = [0, 1];
      this.position++;
    } else if (char === OPEN_BRACE) {
      this.position++;
      min = this.bound(start);
      if (this.peek() === CLOSE_BRACE) {
        max = min;
      } else if (this.peek() === COMMA) {
        this.position++;
        max = this.peek() === CLOSE_BRACE ? null : this.bound(start);
        if (max !== null && min > max) throw new PatternSyntaxError('invalid quantifier', start);
      } else {
        throw new PatternSyntaxError('invalid quantifier', start);
      }
      if (this.peek() !== CLOSE_BRACE) throw new PatternSyntaxError('invalid quantifier', start);
      this.position++;
    } else {
      return null;
    }
    const lazy = this.peek() === QUESTION;
    if (lazy) this.position++;
    return { min, max, lazy };
  }

  /** A decimal bound of at most `QUANTIFIER_LIMIT`. */
  private bound(quantifierStart: number): number {
    const digitsStart = this.position;
    let value = 0;
    for (let digit = this.peek(); isDigit(digit); digit = this.peek()) {
      value = Math.min(value * 10 + (digit - 0x30), QUANTIFIER_LIMIT + 1);
      this.position++;
    }
    if (this.position === digitsStart || value > QUANTIFIER_LIMIT) {
      throw new PatternSyntaxError('invalid quantifier', quantifierStart);
    }
    return value;
  }

  /**
   * An escape at the current `\`. Inside a bracket class (`classStart` is the
   * offset of its `[`), `\D`, `\W` and `\S` are an invalid class.
   */
  private escape(classStart: number | null): Escape {
    const start = this.position;
    const kind = this.peek(1);
    if (kind === undefined) throw new PatternSyntaxError('invalid escape', start);
    if (SYNTAX_ESCAPES.has(kind)) {
      this.position += 2;
      return { kind: 'char', value: kind };
    }
    const control = CONTROL_ESCAPES.get(kind);
    if (control !== undefined) {
      this.position += 2;
      return { kind: 'char', value: control };
    }
    const shorthand = SHORTHANDS.get(kind);
    if (shorthand) {
      if (shorthand.negated && classStart !== null) throw new PatternSyntaxError('invalid class', classStart);
      this.position += 2;
      return { kind: 'shorthand', ...shorthand };
    }
    if (kind === cp('x')) {
      const high = this.peek(2);
      const low = this.peek(3);
      if (!isHex(high) || !isHex(low)) throw new PatternSyntaxError('invalid escape', start);
      const value = parseInt(String.fromCodePoint(high, low), 16);
      this.position += 4;
      return { kind: 'char', value };
    }
    if (kind === cp('u')) return this.codePointEscape(start);
    if (kind === cp('p') || kind === cp('P')) return this.property(start, kind === cp('P'));
    throw new PatternSyntaxError('invalid escape', start);
  }

  /** `\u{H…}`: 1–6 hexadecimal digits naming a Unicode scalar value. */
  private codePointEscape(start: number): CodePoint {
    if (this.peek(2) !== OPEN_BRACE) throw new PatternSyntaxError('invalid escape', start);
    let index = 3;
    let digits = '';
    for (let digit = this.peek(index); isHex(digit); digit = this.peek(index)) {
      digits += String.fromCodePoint(digit);
      index++;
    }
    if (digits.length < 1 || digits.length > 6 || this.peek(index) !== CLOSE_BRACE) {
      throw new PatternSyntaxError('invalid escape', start);
    }
    const value = parseInt(digits, 16);
    if (value > 0x10ffff || isSurrogate(value)) {
      throw new PatternSyntaxError('invalid escape', start);
    }
    this.position += index + 1;
    return { kind: 'char', value };
  }

  /** `\p{X}` or `\P{X}` with a general category or `Script=Name`. */
  private property(start: number, negated: boolean): Property {
    if (this.peek(2) !== OPEN_BRACE) throw new PatternSyntaxError('invalid property', start);
    let index = 3;
    while (this.peek(index) !== undefined && this.peek(index) !== CLOSE_BRACE) index++;
    if (this.peek(index) === undefined) throw new PatternSyntaxError('invalid property', start);
    const text = String.fromCodePoint(...this.source.slice(this.position + 3, this.position + index));
    let property: Property;
    if (isGeneralCategory(text)) {
      property = { kind: 'property', negated, name: text, script: false };
    } else if (text.startsWith('Script=') && isScript(text.slice('Script='.length))) {
      property = { kind: 'property', negated, name: text.slice('Script='.length), script: true };
    } else {
      throw new PatternSyntaxError('invalid property', start);
    }
    this.position += index + 1;
    return property;
  }

  /** `[…]` or `[^…]` with at least one member. */
  private bracketClass(): Atom {
    const start = this.position;
    const length = this.source.length;
    this.position++;
    const negated = this.peek() === CARET;
    if (negated) this.position++;
    const firstMember = this.position;
    const members: ClassMember[] = [];
    for (;;) {
      if (this.position >= length) throw new PatternSyntaxError('unterminated class', length);
      if (this.peek() === CLOSE_CLASS) {
        this.position++;
        break;
      }
      const memberStart = this.position;
      const from = this.classAtom(start, memberStart === firstMember);
      if (this.peek() === DASH && this.peek(1) !== undefined && this.peek(1) !== CLOSE_CLASS) {
        // A range `from-to` of single code points in non-descending order. The
        // class is read left to right: the end is read before the range is judged.
        this.position++;
        const to = this.classAtom(start, false);
        if (from.kind !== 'char' || to.kind !== 'char' || to.value < from.value) {
          throw new PatternSyntaxError('invalid range', memberStart);
        }
        members.push({ kind: 'range', from: from.value, to: to.value });
      } else {
        members.push(from.kind === 'shorthand' ? { kind: 'shorthand', set: from.set } : from);
      }
    }
    if (members.length === 0) throw new PatternSyntaxError('invalid class', start);
    return { kind: 'class', negated, members };
  }

  /**
   * One class member: a literal, an escape, a shorthand or a property. `[` and
   * `\` are never literals; `-` is a literal only at a boundary of the class.
   */
  private classAtom(classStart: number, first: boolean): Escape {
    const char = this.peek();
    if (char === undefined || char === OPEN_CLASS) throw new PatternSyntaxError('invalid class', classStart);
    if (char === BACKSLASH) return this.escape(classStart);
    if (char === DASH) {
      const next = this.peek(1);
      const boundary = first || next === CLOSE_CLASS || next === undefined;
      if (!boundary) throw new PatternSyntaxError('invalid class', classStart);
    }
    if (isSurrogate(char)) throw new PatternSyntaxError('unexpected character', this.position);
    this.position++;
    return { kind: 'char', value: char };
  }
}

/**
 * Recognize a pattern of the CRUDUI pattern language.
 *
 * @throws {PatternSyntaxError} for the first construct outside the language.
 */
export function recognizePattern(pattern: string): RecognizedPattern {
  return new Recognizer(pattern).recognize();
}

/** Sizes above the limit are kept at limit + 1, so products never overflow. */
const cap = (size: number): number => Math.min(size, SIZE_LIMIT + 1);

function alternationSize(node: Alternation): number {
  let size = 0;
  for (const terms of node.branches) {
    for (const term of terms) size = cap(size + termSize(term));
  }
  return size;
}

/**
 * The size of a term: an atom is 1, a group its body; a quantified item is
 * multiplied by its maximum, or by its minimum plus one when unbounded.
 */
export function termSize(term: Term): number {
  const item = term.atom.kind === 'group' ? alternationSize(term.atom.body) : 1;
  const quantifier = term.quantifier;
  if (!quantifier) return item;
  return cap(item * (quantifier.max === null ? quantifier.min + 1 : quantifier.max));
}

/** The size of a sequence or alternation body. */
export { alternationSize };
