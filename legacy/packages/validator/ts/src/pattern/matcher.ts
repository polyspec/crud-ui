/**
 * Linear-time matcher of the CRUDUI pattern language (validation-rules.md,
 * "Patterns").
 *
 * A recognized pattern compiles to a Thompson NFA of CHAR(set), SPLIT, EPSILON
 * and MATCH states. Matching simulates every state at once over the code points
 * of the text: time O(length × states), memory O(states), no backtracking and no
 * recursion that depends on the text.
 */

import { codePointAt, type CodePointText } from '../code-point';
import type { Alternation, Atom, ClassMember, Term } from './ast';
import type { RecognizedPattern } from './recognizer';
import { alternationSize, termSize } from './recognizer';
import { ANY, CodePointSet, DIGIT, SPACE, WORD, propertySet } from './sets';

const CHAR = 0;
const SPLIT = 1;
const EPSILON = 2;
const MATCH = 3;

type Kind = typeof CHAR | typeof SPLIT | typeof EPSILON | typeof MATCH;

const SHORTHAND_SETS = { digit: DIGIT, word: WORD, space: SPACE } as const;

/** The NFA under construction. States are compiled back to front: each takes its successor. */
class Builder {
  readonly kinds: Kind[] = [];
  readonly next: number[] = [];
  readonly alternative: number[] = [];
  readonly sets: Array<CodePointSet | null> = [];
  /** One set per atom, shared by every copy of that atom. */
  private readonly atomSets = new Map<Atom, CodePointSet>();

  state(kind: Kind, next: number, alternative = -1, set: CodePointSet | null = null): number {
    this.kinds.push(kind);
    this.next.push(next);
    this.alternative.push(alternative);
    this.sets.push(set);
    return this.kinds.length - 1;
  }

  alternation(node: Alternation, next: number): number {
    let start = this.sequence(node.branches[node.branches.length - 1], next);
    for (let index = node.branches.length - 2; index >= 0; index--) {
      start = this.state(SPLIT, this.sequence(node.branches[index], next), start);
    }
    return start;
  }

  private sequence(terms: readonly Term[], next: number): number {
    let start = next;
    for (let index = terms.length - 1; index >= 0; index--) start = this.term(terms[index], start);
    return start;
  }

  private term(term: Term, next: number): number {
    const quantifier = term.quantifier;
    if (!quantifier) return this.item(term.atom, next);
    // An item of size 0 matches only empty text, whatever its quantifier.
    if (termSize({ atom: term.atom, quantifier: null }) === 0) return this.state(EPSILON, next);
    let start = next;
    if (quantifier.max === null) {
      // One loop: SPLIT(item → SPLIT, next).
      const loop = this.state(SPLIT, -1, next);
      this.next[loop] = this.item(term.atom, loop);
      start = loop;
    } else {
      // Optional copies: each may be skipped straight to `next`.
      for (let copy = quantifier.min; copy < quantifier.max; copy++) {
        start = this.state(SPLIT, this.item(term.atom, start), next);
      }
    }
    for (let copy = 0; copy < quantifier.min; copy++) start = this.item(term.atom, start);
    return start;
  }

  private item(atom: Atom, next: number): number {
    if (atom.kind === 'group') {
      return alternationSize(atom.body) === 0 ? this.state(EPSILON, next) : this.alternation(atom.body, next);
    }
    let set = this.atomSets.get(atom);
    if (!set) {
      set = atomSet(atom);
      this.atomSets.set(atom, set);
    }
    return this.state(CHAR, next, -1, set);
  }
}

function memberSet(member: ClassMember): CodePointSet {
  switch (member.kind) {
    case 'char':
      return CodePointSet.of([member.value, member.value]);
    case 'range':
      return CodePointSet.of([member.from, member.to]);
    case 'shorthand':
      return SHORTHAND_SETS[member.set];
    case 'property': {
      const set = propertySet(member.name, member.script);
      return member.negated ? set.complement() : set;
    }
  }
}

function atomSet(atom: Exclude<Atom, { kind: 'group' }>): CodePointSet {
  switch (atom.kind) {
    case 'char':
      return CodePointSet.of([atom.value, atom.value]);
    case 'any':
      return ANY;
    case 'shorthand':
      return atom.negated ? SHORTHAND_SETS[atom.set].complement() : SHORTHAND_SETS[atom.set];
    case 'property':
      return memberSet(atom);
    case 'class': {
      const union = CodePointSet.union(atom.members.map(memberSet));
      return atom.negated ? union.complement() : union;
    }
  }
}

/** A compiled pattern: whole-text matching in linear time. */
export class PatternMatcher {
  private readonly kinds: Uint8Array;
  private readonly next: Int32Array;
  private readonly alternative: Int32Array;
  private readonly sets: Array<CodePointSet | null>;
  private readonly setIds: Int32Array;
  private readonly setCount: number;
  private readonly start: number;
  private readonly accept: number;

  constructor(pattern: RecognizedPattern) {
    const builder = new Builder();
    this.accept = builder.state(MATCH, -1);
    this.start = builder.alternation(pattern.body, this.accept);
    this.kinds = Uint8Array.from(builder.kinds);
    this.next = Int32Array.from(builder.next);
    this.alternative = Int32Array.from(builder.alternative);
    this.sets = builder.sets;
    const ids = new Map<CodePointSet, number>();
    this.setIds = Int32Array.from(builder.sets, (set) => {
      if (!set) return -1;
      let id = ids.get(set);
      if (id === undefined) {
        id = ids.size;
        ids.set(set, id);
      }
      return id;
    });
    this.setCount = ids.size;
  }

  /** Number of NFA states. */
  get stateCount(): number {
    return this.kinds.length;
  }

  /** Whether the whole text matches. */
  test(text: CodePointText): boolean {
    const count = this.kinds.length;
    const marks = new Int32Array(count).fill(-1);
    const stack = new Int32Array(2 * count + 1);
    let current = new Int32Array(count);
    let following = new Int32Array(count);
    const setStep = new Int32Array(this.setCount).fill(-1);
    const setMember = new Uint8Array(this.setCount);
    let generation = 0;

    // Add the epsilon closure of `state` to `list`, keeping only CHAR and MATCH states.
    const close = (state: number, list: Int32Array, size: number): number => {
      let top = 0;
      stack[top++] = state;
      while (top > 0) {
        const s = stack[--top];
        if (marks[s] === generation) continue;
        marks[s] = generation;
        const kind = this.kinds[s];
        if (kind === SPLIT) {
          stack[top++] = this.alternative[s];
          stack[top++] = this.next[s];
        } else if (kind === EPSILON) {
          stack[top++] = this.next[s];
        } else {
          list[size++] = s;
        }
      }
      return size;
    };

    let size = close(this.start, current, 0);
    for (let index = 0; index < text.length && size > 0; ) {
      // A lone surrogate is one code point.
      const codePoint = codePointAt(text, index);
      index += codePoint > 0xffff ? 2 : 1;
      generation++;
      const step = generation;
      let nextSize = 0;
      for (let item = 0; item < size; item++) {
        const s = current[item];
        if (this.kinds[s] !== CHAR) continue;
        const id = this.setIds[s];
        if (setStep[id] !== step) {
          setStep[id] = step;
          const set = this.sets[s];
          if (!set) throw new TypeError(`The character state ${s} has no set`);
          setMember[id] = set.has(codePoint) ? 1 : 0;
        }
        if (setMember[id] === 1) nextSize = close(this.next[s], following, nextSize);
      }
      [current, following] = [following, current];
      size = nextSize;
    }
    for (let item = 0; item < size; item++) {
      if (current[item] === this.accept) return true;
    }
    return false;
  }
}
