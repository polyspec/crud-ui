/**
 * Type assertions of the authoring types (docs/spec/schema.md), imported from the package entry. The typecheck mode of
 * Vitest (`test.typecheck` of vitest.config.mts) checks them with tsc and tsconfig.json; a runtime run does not
 * evaluate them.
 */

import { describe, expectTypeOf, it } from 'vitest';
import type { FieldSpec, Items, Lang, Multiple, RangeFieldSpec } from './index';

describe('FieldSpec type assignability (the type is the reference schema)', () => {
  it('accepts the canonical shapes for slots and buckets', () => {
    expectTypeOf<false>().toMatchTypeOf<FieldSpec['behavior']>();
    expectTypeOf<true>().toMatchTypeOf<FieldSpec['validate']>();
    expectTypeOf<{ show: string }>().toMatchTypeOf<NonNullable<FieldSpec['design']>>();
    expectTypeOf<Multiple>().toMatchTypeOf<NonNullable<FieldSpec['multiple']>>();
    expectTypeOf<Lang>().toMatchTypeOf<NonNullable<FieldSpec['lang']>>();
    expectTypeOf<Items>().toMatchTypeOf<NonNullable<FieldSpec['items']>>();
  });

  it('accepts keys only beside only: true (docs/spec/schema.md, Keyed maps)', () => {
    expectTypeOf<{ only: true; keys: string }>().toMatchTypeOf<Multiple>();
    expectTypeOf<{ keys: string }>().not.toMatchTypeOf<Multiple>();
    expectTypeOf<{ only: false; keys: string }>().not.toMatchTypeOf<Multiple>();
    expectTypeOf<{ only: true; min: number }>().not.toMatchTypeOf<Multiple>();
  });

  it('describes a range field with its literal bounds and step (docs/spec/schema.md, Range fields)', () => {
    expectTypeOf<{ type: 'range'; validate: { range: [number, number]; step: number } }>()
      .toMatchTypeOf<RangeFieldSpec>();
    expectTypeOf<RangeFieldSpec>().toMatchTypeOf<FieldSpec>();
    expectTypeOf<{ type: 'range'; validate: { range: [number, number] } }>().not.toMatchTypeOf<RangeFieldSpec>();
    expectTypeOf<{ type: 'range'; validate: { step: number } }>().not.toMatchTypeOf<RangeFieldSpec>();
    expectTypeOf<{ type: 'range' }>().not.toMatchTypeOf<RangeFieldSpec>();
  });
});
