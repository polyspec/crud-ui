/**
 * Input text checks (docs/spec/input-text.md). Every string and object member name in a
 * specification, a composition file and caller data is a sequence of Unicode scalar values. A
 * JavaScript string that contains an unpaired surrogate code unit is rejected before any other
 * check of the operation; it is never replaced and never passed on.
 */

import { ComposeLoadError } from '../compose/errors';
import type { FileLoader, LoadedDoc } from '../compose/loader';
import { FormInputError } from '../validate/errors';

/** Message of every input text failure. */
export const INVALID_TEXT_MESSAGE = 'Text must be Unicode scalar values';

const SURROGATE = /[\uD800-\uDFFF]/;

/** Whether `text` has no unpaired surrogate code unit. */
export function isScalarText(text: string): boolean {
  if (!SURROGATE.test(text)) return true;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0xd800 || unit > 0xdfff) continue;
    if (unit > 0xdbff) return false;
    const next = text.charCodeAt(i + 1);
    if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    i++;
  }
  return true;
}

/** Compare two well-formed strings in code point order. */
export function compareCodePoints(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);
    if (x === y) continue;
    // A surrogate encodes a code point above every unit from U+E000 to U+FFFF.
    const rank = (unit: number) => (unit >= 0xe000 ? unit - 0x800 : unit >= 0xd800 ? unit + 0x2000 : unit);
    return rank(x) - rank(y);
  }
  return a.length - b.length;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Message of every value beyond the limits of a value. */
const VALUE_LIMIT_MESSAGE = 'Recursive or excessively nested value';

/** Levels of arrays and objects a value may nest, the value itself included. */
export const NESTING_LIMIT = 512;

/** Nodes a value may hold: every array, object, string, number, boolean and null, itself included. */
export const NODE_LIMIT = 1_000_000;

/** The first failure in a value: invalid text at its path, or the value is beyond its limits. */
export type ValueFailure = { text: string[] } | { limit: true };

const LIMIT: ValueFailure = { limit: true };

/**
 * One walk of a value as the tree it denotes. A container reached twice, through sharing or
 * because it contains itself, is walked at each place, so the node count and the nesting limit
 * bound every walk, including one around a cycle.
 */
class Walk {
  private nodes = 0;

  /** Count a node at `depth`; false when it takes the value beyond its limits. */
  admit(value: unknown, depth: number): boolean {
    if (++this.nodes > NODE_LIMIT) return false;
    return depth < NESTING_LIMIT || !(Array.isArray(value) || isPlainObject(value));
  }
}

/** Whether `value` holds a failure; a quick walk in member order before the ordered one. */
function holdsFailure(value: unknown, depth: number, walk: Walk): boolean {
  if (!walk.admit(value, depth)) return true;
  if (typeof value === 'string') return !isScalarText(value);
  if (Array.isArray(value)) return value.some(item => holdsFailure(item, depth + 1, walk));
  if (!isPlainObject(value)) return false;
  return Object.keys(value).some(key => !isScalarText(key) || holdsFailure(value[key], depth + 1, walk));
}

function firstFailure(value: unknown, path: string[], depth: number, walk: Walk): ValueFailure | undefined {
  if (!walk.admit(value, depth)) return LIMIT;
  if (typeof value === 'string') return isScalarText(value) ? undefined : { text: path };
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = firstFailure(value[i], [...path, String(i)], depth + 1, walk);
      if (found) return found;
    }
    return undefined;
  }
  if (!isPlainObject(value)) return undefined;
  const keys = Object.keys(value);
  // A member name is reported at its object; members follow in code point order of their names.
  if (!keys.every(isScalarText)) return { text: path };
  for (const key of keys.sort(compareCodePoints)) {
    const found = firstFailure(value[key], [...path, key], depth + 1, walk);
    if (found) return found;
  }
  return undefined;
}

/**
 * The first failure in `value`, walked as the tree it denotes: array items in index order; for an
 * object, every member name first, then the members in code point order of their names. Invalid
 * text is located at the path of its string, or of the object whose member name is invalid. A
 * value that nests more than `NESTING_LIMIT` levels or holds more than `NODE_LIMIT` nodes, which
 * includes every value that contains itself, is beyond its limits where the walk passes them.
 * `undefined` when there is no failure.
 */
export function valueFailure(value: unknown): ValueFailure | undefined {
  return holdsFailure(value, 0, new Walk()) ? firstFailure(value, [], 0, new Walk()) : undefined;
}

/**
 * The levels of arrays and objects that `value` nests, the value itself the first, and the nodes it
 * holds, counted as the value limits count them.
 */
export function valueSize(value: unknown): { levels: number; nodes: number } {
  const size = { levels: 0, nodes: 0 };
  const visit = (node: unknown, level: number): void => {
    size.nodes++;
    if (Array.isArray(node)) {
      size.levels = Math.max(size.levels, level);
      node.forEach(item => visit(item, level + 1));
    } else if (isPlainObject(node)) {
      size.levels = Math.max(size.levels, level);
      for (const key of Object.keys(node)) visit(node[key], level + 1);
    }
  };
  visit(value, 1);
  return size;
}

function limitFailure(name: string): FormInputError {
  return new FormInputError(`${VALUE_LIMIT_MESSAGE}: ${name}`);
}

/**
 * Check a specification and the composition files the operation reads. Invalid text is the load
 * failure `INVALID_TEXT`, located at its specification path or at the file name followed by its
 * path in the file; an invalid file name is located at the empty path. A value beyond its limits
 * is `INVALID_FORM_INPUT` naming `spec` or `files`.
 */
export function checkSpecificationText(spec: unknown, files?: unknown): void {
  for (const [name, value] of [['spec', spec], ['files', files]] as const) {
    const failure = valueFailure(value);
    if (failure && 'limit' in failure) throw limitFailure(name);
    if (failure) throw new ComposeLoadError('INVALID_TEXT', INVALID_TEXT_MESSAGE, failure.text);
  }
}

/**
 * Check named caller values in order; invalid text is `INVALID_FORM_INPUT` naming the value and
 * path, and a value beyond its limits is `INVALID_FORM_INPUT` naming the value.
 */
export function checkInputText(inputs: ReadonlyArray<readonly [string, unknown]>): void {
  for (const [name, value] of inputs) {
    const failure = valueFailure(value);
    if (failure && 'limit' in failure) throw limitFailure(name);
    if (failure) throw new FormInputError(`${INVALID_TEXT_MESSAGE}: ${[name, ...failure.text].join('.')}`);
  }
}

/** Check the present options named in `names`, given in code point order, as `options.{name}`. */
export function checkOptionText(options: unknown, names: readonly string[]): void {
  if (options === null || typeof options !== 'object') return;
  // A property read, as `options[name]` reads it, of options that are an object or a list.
  const read = (name: string): unknown => Reflect.get(options, name);
  checkInputText(names.filter(name => read(name) !== undefined).map(name => [`options.${name}`, read(name)] as const));
}

/** A loader that checks each document it loads, located and named as a composition file. */
export function checkedLoader(loader: FileLoader): FileLoader {
  return {
    normalize: (path: string, basepath: string) => loader.normalize(path, basepath),
    load: (key: string): LoadedDoc => {
      const doc = loader.load(key);
      const failure = valueFailure(doc);
      if (failure && 'limit' in failure) throw limitFailure('files');
      if (failure) throw new ComposeLoadError('INVALID_TEXT', INVALID_TEXT_MESSAGE, [key, ...failure.text]);
      return doc;
    },
  };
}

/**
 * Check the specification side of an operation: the specification, then the files it reads, or
 * wrap its custom loader. Returns the loader the operation composes with.
 */
export function checkedComposition(
  spec: unknown,
  options: { files?: unknown; loader?: FileLoader },
): FileLoader | undefined {
  checkSpecificationText(spec, options.loader ? undefined : options.files);
  return options.loader ? checkedLoader(options.loader) : undefined;
}
