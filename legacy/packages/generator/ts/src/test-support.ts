/**
 * Reads of the unit tests that fail with what they expect, instead of asserting a value into existence with `!` or a
 * type assertion (kit K156, K157).
 */
import type { NodeVM } from './viewmodel';

/** `value`, which the test knows to be there; throws an Error that names `what` when it is undefined or null. */
export function present<T>(value: T | null | undefined, what: string): T {
  if (value === undefined || value === null) throw new Error(`${what} is missing`);
  return value;
}

/** The child nodes of a group, collection, row or language node. */
export function childrenOf(node: NodeVM): NodeVM[] {
  return present(node.children, `the children of ${node.path ?? node.kind}`);
}

/** The member names of an object value, such as the row keys of a collection that getValue reads. */
export function keysOf(value: unknown, what: string): string[] {
  if (value === null || typeof value !== 'object') throw new Error(`${what} is no object`);
  return Object.keys(value);
}
