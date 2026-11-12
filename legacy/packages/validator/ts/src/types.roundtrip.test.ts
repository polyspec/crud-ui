/**
 * CRUDUI reference-type round-trip + invariant tests.
 *
 * The CRUDUI deliverable here is the canonical TypeScript reference type
 * (`FieldSpec`). These tests pin the canonical JSON shape the type describes:
 *
 *  - Round-trip identity: a CRUDUI document typed as `FieldSpec`, parsed with
 *    JSON.parse and re-serialized with JSON.stringify, is byte-identical. This
 *    covers the polymorphic slots/buckets (false | {} | true), the
 *    declaration-ordered condition map and `properties`, the design node map,
 *    items polymorphism, language maps, and $ref/$patch composition. JSON.parse
 *    preserves insertion order for string keys, so declaration order survives —
 *    the Go (custom UnmarshalJSON / order-preserving PropertyMap) and Rust
 *    (serde untagged + preserve_order) siblings carry the equivalent guarantee.
 *  - Type assignability: each shape compiles against `FieldSpec` (the type IS
 *    the schema for the reference layer), imported from the package entry,
 *    which exports the authoring types; `types.test-d.ts` holds the type
 *    assertions, which the typecheck mode of Vitest checks.
 *  - Forbidden meta keys: the canonical enumeration and the `x{key}` pattern are
 *    pinned so tooling can assert global rejection.
 */

import assert from 'node:assert/strict';
import { describe, it, expect } from 'vitest';
import type { FieldSpec } from './index';
import { isRecord } from './record';
import { FORBIDDEN_META_KEYS, FORBIDDEN_META_KEY_PATTERN } from './internal';

/** Parse → re-serialize and assert byte identity (canonical round trip). */
function roundTrip(json: string): void {
  const value: unknown = JSON.parse(json);
  expect(JSON.stringify(value)).toBe(json);
}

describe('FieldSpec round-trip (canonical JSON shape)', () => {
  it('round-trips a full field covering every first-class key and role slot', () => {
    // Key order is the canonical declaration order; round trip must preserve it.
    const json = JSON.stringify({
      type: 'email',
      name: 'contact_email',
      label: { ko: '이메일', en: 'Email' },
      default: '',
      properties: { first: { type: 'text' }, second: { type: 'text' } },
      items: { model: 'User', method: 'all' },
      multiple: { min: 1, max: 5, copy: true, sortable: true, title: 'first', controls: 'footer', header: 'sticky' },
      lang: { mode: 'append', only: ['ko', 'en'] },
      description: 'desc',
      placeholder: 'you@example.com',
      prepend: '@',
      append: '.com',
      help: { ko: '도움말', en: 'Help' },
      validate: { required: '.subscribe', email: true, match: '.+' },
      design: {
        show: '.subscribe',
        class: { '.vip': 'gold', true: 'plain' },
        style: 'color:red',
        label: { class: 'lbl' },
        wrapper: { class: 'wrap', style: 'margin:0' },
        group: { class: 'grp' },
        prepend: { class: 'pre' },
      },
      behavior: { onchange: 'doChange()', onclick: { script: 'go()', label: 'Go' } },
      options: { checkbox_label: 'agree', max_tags: 3, marker_draggable: true },
      $ref: 'Base.yml',
      $patch: { 'field.validate.required': '.other' },
    });
    roundTrip(json);
  });

  it('round-trips the three polymorphic slot shapes: false | {} | true', () => {
    roundTrip(JSON.stringify({ type: 'text', behavior: false }));
    roundTrip(JSON.stringify({ type: 'text', validate: {} }));
    roundTrip(JSON.stringify({ type: 'text', design: true }));
    roundTrip(JSON.stringify({ type: 'text', options: false }));
  });

  it('round-trips the polymorphic structure dimensions: false | {} | true', () => {
    roundTrip(JSON.stringify({ type: 'group', multiple: false }));
    roundTrip(JSON.stringify({ type: 'group', multiple: true }));
    roundTrip(JSON.stringify({ type: 'group', multiple: { max: 2 } }));
    roundTrip(JSON.stringify({ type: 'group', multiple: 'only' }));
    roundTrip(JSON.stringify({ type: 'group', multiple: { only: true, title: 'name', header: 'sticky' } }));
    roundTrip(JSON.stringify({ type: 'text', lang: true }));
    roundTrip(JSON.stringify({ type: 'text', lang: { mode: 'append' } }));
  });

  it('preserves condition-map declaration order with the literal `true` default key', () => {
    const field = {
      type: 'text',
      design: { show: { '.a': true, '.b': false, true: false } },
    } satisfies FieldSpec;
    const json = JSON.stringify(field);
    const value: unknown = JSON.parse(json);
    assert(isRecord(value) && isRecord(value.design) && isRecord(value.design.show), 'the field has a condition map show');
    expect(Object.keys(value.design.show)).toEqual(['.a', '.b', 'true']);
    expect(JSON.stringify(value)).toBe(json);
  });

  it('round-trips items in both polymorphic shapes (static array | dynamic source)', () => {
    roundTrip(JSON.stringify({ type: 'select', items: ['a', 'b', 'c'] }));
    roundTrip(JSON.stringify({ type: 'select', items: { table: 't', relations: {} } }));
  });

  it('round-trips a single-ternary expression (condition-map shorthand)', () => {
    roundTrip(JSON.stringify({ type: 'text', design: { show: '.subscribe ? true : false' } }));
  });
});

describe('FieldSpec round-trip of a range field', () => {
  it('round-trips a range field with its literal bounds and step (docs/spec/schema.md, Range fields)', () => {
    const volume = { type: 'range', name: 'volume', append: '%', validate: { range: [0, 100], step: 5 } } as const;
    roundTrip(JSON.stringify(volume));
  });
});

describe('forbidden meta keys (global rejection contract)', () => {
  it('pins the canonical forbidden enumeration', () => {
    expect(FORBIDDEN_META_KEYS).toEqual([
      'display_switch',
      'display_target',
      'if',
      'when',
      'show_if',
      '_',
      'seqtokey',
      '__13hex__',
      '$after',
      '$before',
      '$merge',
      '$remove',
      'xclass',
      'xstyle',
    ]);
  });

  it('matches the `x{key}` comment family by pattern (x-strip premise)', () => {
    expect(FORBIDDEN_META_KEY_PATTERN.test('xclass')).toBe(true);
    expect(FORBIDDEN_META_KEY_PATTERN.test('xnote')).toBe(true);
    expect(FORBIDDEN_META_KEY_PATTERN.test('class')).toBe(false);
  });

  it('a bare `x` is NOT a comment — pattern matches runtime isXCommentKey (length > 1)', () => {
    // The single authority is forbidden-scan.ts isXCommentKey (x + ≥1 char). A
    // lone `x` is a real one-char field name, so the pattern must reject it too.
    expect(FORBIDDEN_META_KEY_PATTERN.test('x')).toBe(false);
  });
});
