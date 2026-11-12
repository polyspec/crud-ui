import assert from 'node:assert/strict';
import { describe, expect, test } from 'vitest';
import { expectOutcome, operations, readCases, textCase, type TextCase } from '../../../../../tests/fixtures/text-validity/cases.mts';
import { isRecord } from '../record';

/** A value graph of legacy/tests/fixtures/text-validity/value-graphs.json, built with shared containers. */
interface Graph { at: string[]; shape: 'doubled' | 'chain' | 'flat' | 'self-twice'; size?: number; leaf?: string }

interface GraphCase extends TextCase { graph: Graph }

const SHAPES = ['doubled', 'chain', 'flat', 'self-twice'] as const;
const isShape = (value: unknown): value is Graph['shape'] => SHAPES.some((shape) => shape === value);

/** A case of the value graphs, checked to hold a graph of a path, a shape and, when present, a size and a leaf. */
function graphCase(item: unknown, at: string): GraphCase {
  const graph: unknown = isRecord(item) ? item.graph : undefined;
  const names: unknown[] = isRecord(graph) && Array.isArray(graph.at) ? graph.at : [];
  const path = names.filter((name): name is string => typeof name === 'string');
  if (!isRecord(graph) || path.length === 0 || path.length !== names.length || !isShape(graph.shape)) {
    throw new TypeError(`${at}: no graph of a path and a shape`);
  }
  const { size, leaf } = graph;
  if (size !== undefined && typeof size !== 'number') throw new TypeError(`${at}: the size is no number`);
  if (leaf !== undefined && typeof leaf !== 'string') throw new TypeError(`${at}: the leaf is no string`);
  return {
    ...textCase(item, at),
    graph: { at: path, shape: graph.shape, ...(size === undefined ? {} : { size }), ...(leaf === undefined ? {} : { leaf }) },
  };
}

function build({ shape, size = 0, leaf }: Graph): unknown {
  if (shape === 'self-twice') {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    loop.again = loop;
    return loop;
  }
  if (shape === 'flat') return Array.from<unknown>({ length: size }, () => leaf);
  let value: unknown = leaf;
  for (let i = 0; i < size; i++) value = shape === 'doubled' ? [value, value] : [value];
  return value;
}

const fixture = 'legacy/tests/fixtures/text-validity/value-graphs.json';
const cases = readCases(fixture, graphCase);

describe('value graphs — input limits', () => {
  test('the fixture carries cases', () => expect(cases.length).toBeGreaterThan(0));
});

// Each case is a top-level test named by the case, so the parity check reads every case of the unit by its name.
for (const c of cases) {
  test(c.name, () => {
    const inputs: Record<string, unknown> = { spec: c.spec, files: c.files, data: c.data };
    const [name, ...members] = c.graph.at;
    let target: unknown = inputs[name];
    for (const member of members.slice(0, -1)) {
      assert(typeof target === 'object' && target !== null, `${c.name}: ${member} lies in an object`);
      target = Reflect.get(target, member);
    }
    assert(typeof target === 'object' && target !== null, `${c.name}: the graph lies in an object`);
    Reflect.set(target, members[members.length - 1], build(c.graph));
    // Each case is one test within the runner's per-test limit, which a walk that grows with the
    // tree a value denotes (2^40 nodes) never meets.
    expectOutcome(() => operations.validate(c), c.expect);
  });
}
