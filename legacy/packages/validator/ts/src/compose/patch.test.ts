/**
 * Unit tests for the $patch deep-merge / deep-remove semantics.
 *
 * cases.json (the shared 4-language fixture) covers the SPEC §5 surface; these
 * tests pin the merge/remove RULES that the fixture does not separately isolate:
 *   - both-object leaf → recursive deep-merge
 *   - scalar leaf → replace (latter wins)
 *   - array leaf → replace (NOT concat; the latter wins)
 *   - nested-map remove form (missing key tolerated)
 *   - structured-remove array form (strict: missing target throws)
 */

import assert from 'node:assert/strict';
import { describe, test, expect } from 'vitest';
import { applyPatch } from './patch';
import { ComposeLoadError } from './errors';

/** The load error that `run` throws; fails the test when it throws nothing or another error. */
function loadError(run: () => unknown): ComposeLoadError {
  try {
    run();
  } catch (error) {
    assert(error instanceof ComposeLoadError, 'the error is a load error');
    return error;
  }
  throw new Error('expected a load error');
}

describe('$patch deep-path assignment', () => {
  test('both-object leaf deep-merges (preserves disjoint subkeys)', () => {
    const base = { a: { x: { p: 1, q: 2 } } };
    const out = applyPatch(base, { 'a.x': { q: 20, r: 30 } });
    expect(out).toStrictEqual({ a: { x: { p: 1, q: 20, r: 30 } } });
  });

  test('scalar leaf replaces (latter wins)', () => {
    const base = { a: { class: 'old' } };
    const out = applyPatch(base, { 'a.class': 'new' });
    expect(out).toStrictEqual({ a: { class: 'new' } });
  });

  test('object value over scalar leaf replaces wholesale', () => {
    const base = { a: { v: 'scalar' } };
    const out = applyPatch(base, { 'a.v': { nested: true } });
    expect(out).toStrictEqual({ a: { v: { nested: true } } });
  });

  test('array leaf replaces (not concatenated)', () => {
    const base = { a: { list: [1, 2, 3] } };
    const out = applyPatch(base, { 'a.list': [9] });
    expect(out).toStrictEqual({ a: { list: [9] } });
  });

  test('creates intermediate objects for a missing deep path', () => {
    const base = { a: {} };
    const out = applyPatch(base, { 'a.b.c': 1 });
    expect(out).toStrictEqual({ a: { b: { c: 1 } } });
  });

  test('does not mutate the input base', () => {
    const base = { a: { x: 1 } };
    const snapshot = JSON.stringify(base);
    applyPatch(base, { 'a.y': 2 });
    expect(JSON.stringify(base)).toStrictEqual(snapshot);
  });
});

describe('$patch add / replace — deep-merge at path', () => {
  test('add deep-merges a new subkey into an existing node', () => {
    const base = { a: { type: 'text' } };
    const out = applyPatch(base, { add: { 'a.label': 'A' } });
    expect(out).toStrictEqual({ a: { type: 'text', label: 'A' } });
  });

  test('replace overrides a scalar via deep-merge rule', () => {
    const base = { a: { design: { class: 'x', show: '.s' } } };
    const out = applyPatch(base, { replace: { 'a.design.class': 'y' } });
    expect(out).toStrictEqual({ a: { design: { class: 'y', show: '.s' } } });
  });
});

describe('$patch remove — array form (strict) vs nested-map form (tolerant)', () => {
  test('array-path remove deletes a deep subkey, keeps siblings', () => {
    const base = { f: { options: { max_tags: 5, min: 2 } } };
    const out = applyPatch(base, { remove: ['f.options.max_tags'] });
    expect(out).toStrictEqual({ f: { options: { min: 2 } } });
  });

  test('array-path remove of a missing target is a load error', () => {
    const base = { a: { type: 'text' } };
    expect(() => applyPatch(base, { remove: ['a.ghost'] })).toThrow(ComposeLoadError);
    expect(loadError(() => applyPatch(base, { remove: ['a.ghost'] })).code).toStrictEqual('PATCH_REMOVE_TARGET_MISSING');
  });

  test('nested-map removal recurses when both values are objects', () => {
    const base = { f: { options: { max_tags: 5, min: 2 } } };
    const out = applyPatch(base, { remove: { f: { options: { max_tags: true } } } });
    expect(out).toStrictEqual({ f: { options: { min: 2 } } });
  });

  test('nested-map removal accepts a missing key', () => {
    const base = { a: { type: 'text' } };
    const out = applyPatch(base, { remove: { ghost: { sub: true } } });
    expect(out).toStrictEqual({ a: { type: 'text' } });
  });

  test('nested-map remove with scalar spec deletes the whole key', () => {
    const base = { a: { type: 'text' }, b: { type: 'num' } };
    const out = applyPatch(base, { remove: { b: true } });
    expect(out).toStrictEqual({ a: { type: 'text' } });
  });
});

describe('$patch shape errors are load errors', () => {
  test('non-object $patch throws PATCH_SHAPE', () => {
    expect(() => applyPatch({}, 'nope')).toThrow(ComposeLoadError);
  });

  test('add with non-object value throws PATCH_SHAPE', () => {
    expect(loadError(() => applyPatch({}, { add: 'x' })).code).toStrictEqual('PATCH_SHAPE');
  });

  test('descend into a scalar intermediate throws PATCH_PATH_CONFLICT', () => {
    expect(loadError(() => applyPatch({ a: 'scalar' }, { 'a.b': 1 })).code).toStrictEqual('PATCH_PATH_CONFLICT');
  });
});
