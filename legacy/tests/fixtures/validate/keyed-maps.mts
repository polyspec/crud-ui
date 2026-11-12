/**
 * Keyed map cases written from docs/spec/validation-rules.md ("Keyed maps") and docs/spec/schema.md
 * ("Keyed maps"): the keys of a field that declares multiple.keys are the row keys of the repeated
 * group its reference names, and a reference that names no repeated group fails the load.
 *
 * Each case carries its complete result or failure record, written from the specification, never
 * from a runtime's answer.
 */

import type { FailingCase, WrittenCase } from './visibility.mts';

const G = (properties: Record<string, unknown>) => ({ type: 'group', properties });

/** A data-only repeated scalar field whose keys are the ids that `keys` names. */
const keyed = (keys: unknown, type = 'text') => ({ type, multiple: { only: true, keys } });

/** The example of docs/spec/schema.md, "Keyed maps". */
const story = G({
  characters: {
    type: 'group',
    multiple: true,
    properties: {
      name: { type: 'text' },
      relation_notes: keyed('..characters'),
    },
  },
  facts: {
    type: 'group',
    multiple: true,
    properties: {
      truth: { type: 'text' },
      holders: { type: 'select', items: { knows: 'Knows', suspects: 'Suspects' }, multiple: { only: true, keys: '..characters' } },
    },
  },
});

const cast = { c1: { name: 'Ann', relation_notes: { c2: 'Brother' } }, c2: { name: 'Ben' } };
const pass = { valid: true, errors: [] };
const inputFailure = (message: string) => ({ code: 'INVALID_FORM_INPUT', message, at: '' });
const notAnId = (reference: string, path: string) => inputFailure(`Row key is not an id of ${reference}: ${path}`);
const badReference = (path: string) => inputFailure(`Invalid multiple.keys at ${path}: expected a reference to a repeated group`);

/** A root field `notes` whose `multiple.keys` is `keys`, beside the repeated group `people` and the group `meta`. */
const referenceSpec = (keys: unknown) => G({
  people: { type: 'group', multiple: true, properties: { name: { type: 'text' }, items: { type: 'group', multiple: true, properties: { n: { type: 'text' } } } } },
  meta: { type: 'group', properties: { title: { type: 'text' }, tags: { type: 'text', multiple: true } } },
  notes: keyed(keys),
});

export const KEYED_MAP_CASES: Array<WrittenCase | FailingCase> = [
  {
    name: 'keyed-map-ids',
    note: 'Every key of holders and of relation_notes is a row key of characters, read from a row of facts and of characters through ..characters.',
    spec: story,
    data: { characters: cast, facts: { f1: { truth: 'The will is forged', holders: { c1: 'knows', c2: 'suspects' } } } },
    expected: pass,
  },
  {
    name: 'keyed-map-key-not-an-id',
    note: 'The example of validation-rules.md: c3 is not a row key of characters.',
    spec: story,
    data: { characters: cast, facts: { f1: { truth: 'The will is forged', holders: { c1: 'knows', c3: 'suspects' } } } },
    expectFailure: notAnId('..characters', 'facts.f1.holders.c3'),
  },
  {
    name: 'keyed-map-key-not-an-id-in-own-group',
    note: 'relation_notes inside a row of characters reads the rows of characters around that row; c9 is none of them.',
    spec: story,
    data: { characters: { c1: { name: 'Ann', relation_notes: { c2: 'Brother', c9: 'Stranger' } }, c2: { name: 'Ben' } } },
    expectFailure: notAnId('..characters', 'characters.c1.relation_notes.c9'),
  },
  {
    name: 'keyed-map-sorted-key-order',
    note: 'Keys are checked in sorted key order: of z9 and c3, neither an id, c3 is reported.',
    spec: story,
    data: { characters: cast, facts: { f1: { holders: { z9: 'knows', c3: 'suspects' } } } },
    expectFailure: notAnId('..characters', 'facts.f1.holders.c3'),
  },
  {
    name: 'keyed-map-missing-group-data',
    note: 'Missing data of the named group has no ids, so any key fails.',
    spec: story,
    data: { facts: { f1: { holders: { c1: 'knows' } } } },
    expectFailure: notAnId('..characters', 'facts.f1.holders.c1'),
  },
  {
    name: 'keyed-map-null-group-data',
    note: 'null data of the named group has no ids; notes is declared first, so its keys are checked before the shape of people.',
    spec: G({ notes: keyed('.people'), people: { type: 'group', multiple: true, properties: { name: { type: 'text' } } } }),
    data: { people: null, notes: { p1: 'x' } },
    expectFailure: notAnId('.people', 'notes.p1'),
  },
  {
    name: 'keyed-map-empty-data',
    note: 'An empty keyed map has no key to check, and missing group data does not fail it.',
    spec: story,
    data: { facts: { f1: { holders: {} } } },
    expected: pass,
  },
  {
    name: 'keyed-map-empty-data-beside-a-key',
    note: 'An empty keyed map passes and the next row of facts is still checked: c9 of f2 is not a row key of the missing characters.',
    spec: story,
    data: { facts: { f1: { holders: {} }, f2: { holders: { c9: 'knows' } } } },
    expectFailure: notAnId('..characters', 'facts.f2.holders.c9'),
  },
  {
    name: 'keyed-map-code-point-key-order',
    note: 'Keys are checked in code point order: U+FF61 comes before U+1F600, which UTF-16 code unit order puts first.',
    spec: story,
    data: { characters: cast, facts: { f1: { holders: { '\u{1F600}': 'knows', '\uFF61': 'suspects' } } } },
    expectFailure: notAnId('..characters', 'facts.f1.holders.\uFF61'),
  },
  {
    name: 'keyed-map-bare-name',
    note: 'A bare name names the field beside the declaring field, as .name does.',
    spec: G({ people: { type: 'group', multiple: true, properties: { name: { type: 'text' } } }, notes: keyed('people') }),
    data: { people: { p1: { name: 'Ann' } }, notes: { p1: 'x', p2: 'y' } },
    expectFailure: notAnId('people', 'notes.p2'),
  },
  {
    name: 'keyed-map-root-path',
    note: 'A reference with a dot inside and no leading dot names a path from the form root, through a group that is not repeated.',
    spec: G({
      meta: { type: 'group', properties: { cast: { type: 'group', multiple: true, properties: { n: { type: 'text' } } } } },
      facts: { type: 'group', multiple: true, properties: { holders: keyed('meta.cast') } },
    }),
    data: { meta: { cast: { m1: { n: 'Ann' } } }, facts: { f1: { holders: { m1: 'x' } }, f2: { holders: { m2: 'y' } } } },
    expectFailure: notAnId('meta.cast', 'facts.f2.holders.m2'),
  },
  {
    name: 'keyed-map-repeated-group',
    note: 'A repeated group can be a keyed map: its rows are checked under the ids, and the fields of each row are validated.',
    spec: G({
      people: { type: 'group', multiple: true, properties: { name: { type: 'text' } } },
      stances: { type: 'group', multiple: { only: true, keys: '.people' }, properties: { stance: { type: 'text', validate: { required: true } } } },
    }),
    data: { people: { p1: { name: 'Ann' } }, stances: { p1: { stance: '' } } },
    expected: { valid: false, errors: [{ path: 'stances.p1.stance', field: 'stance', rule: 'required', message: 'This field is required.', value: '' }] },
  },
  {
    name: 'keyed-map-repeated-group-key-before-rows',
    note: 'The keys of a field are checked before its rows: the key failure is reported, not the shape of its row.',
    spec: G({
      people: { type: 'group', multiple: true, properties: { name: { type: 'text' } } },
      stances: { type: 'group', multiple: { only: true, keys: '.people' }, properties: { stance: { type: 'text' } } },
    }),
    data: { people: {}, stances: { p1: 'not a row' } },
    expectFailure: notAnId('.people', 'stances.p1'),
  },
  {
    name: 'keyed-map-keyed-object-first',
    note: 'The keyed-object check of the field comes before its keys.',
    spec: G({ people: { type: 'group', multiple: true, properties: { name: { type: 'text' } } }, notes: keyed('.people') }),
    data: { notes: 'x' },
    expectFailure: inputFailure('Repeated data must be a keyed object: notes'),
  },
  {
    name: 'keyed-map-before-single-choice',
    note: 'The keys of a single-choice field are checked before its single-choice check.',
    spec: G({ people: { type: 'group', multiple: true, properties: { name: { type: 'text' } } }, picks: keyed('.people', 'select') }),
    data: { picks: { p1: ['a'] } },
    expectFailure: notAnId('.people', 'picks.p1'),
  },
  {
    name: 'keyed-map-hidden-field',
    note: 'The keys of a hidden field are checked like the other data shapes.',
    spec: G({
      people: { type: 'group', multiple: true, properties: { name: { type: 'text' } } },
      notes: { type: 'text', design: { show: false }, multiple: { only: true, keys: '.people' } },
    }),
    data: { people: { p1: { name: 'Ann' } }, notes: { p2: 'x' } },
    expectFailure: notAnId('.people', 'notes.p2'),
  },
  {
    name: 'keyed-map-reference-not-a-string',
    note: 'A multiple.keys that is not a string names no repeated group.',
    spec: referenceSpec(5),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-not-repeated',
    note: 'meta is a group that is not repeated.',
    spec: referenceSpec('.meta'),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-repeated-scalar',
    note: 'meta.tags is repeated but is not a group.',
    spec: referenceSpec('meta.tags'),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-unknown-field',
    note: 'No field named cast is beside notes.',
    spec: referenceSpec('.cast'),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-through-repeated-group',
    note: 'people.items passes through the repeated group people, which has no row in the reference.',
    spec: referenceSpec('people.items'),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-above-root',
    note: '..people leaves notes and then one more field level, which the root field notes does not have.',
    spec: referenceSpec('..people'),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-wildcard',
    note: 'A reference has no wildcard.',
    spec: referenceSpec('.*'),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-empty-name',
    note: 'A reference has no empty name.',
    spec: referenceSpec('meta..title'),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-empty',
    note: 'An empty reference names no field.',
    spec: referenceSpec(''),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-after-messages',
    note: 'The reference is checked after the field messages keys: an unknown messages key is reported first.',
    spec: G({ notes: { type: 'text', multiple: { only: true, keys: '.cast' }, messages: { nope: 'x' } } }),
    data: {},
    expectFailure: { code: 'UNKNOWN_RULE', message: 'Unknown rule: nope', at: 'notes' },
  },
  {
    name: 'keyed-map-reference-with-messages',
    note: 'A field with valid messages keys still has its reference checked.',
    spec: G({ notes: { type: 'text', multiple: { only: true, keys: '.cast' }, messages: { required: 'Required.' } } }),
    data: {},
    expectFailure: badReference('notes'),
  },
  {
    name: 'keyed-map-reference-before-children',
    note: 'The reference of a repeated group is checked before the fields it contains.',
    spec: G({ stances: { type: 'group', multiple: { only: true, keys: '.cast' }, properties: { stance: { type: 'text', validate: { nope: true } } } } }),
    data: {},
    expectFailure: badReference('stances'),
  },
  {
    name: 'keyed-map-reference-nested-path',
    note: 'The message names the declaration path of the field, without row keys.',
    spec: G({ facts: { type: 'group', multiple: true, properties: { holders: keyed('.characters') } } }),
    data: {},
    expectFailure: badReference('facts.holders'),
  },
  {
    name: 'keyed-map-reference-hidden-field',
    note: 'The reference of a hidden field is checked too.',
    spec: G({ notes: { type: 'text', design: { show: false }, multiple: { only: true, keys: '.cast' } } }),
    data: {},
    expectFailure: badReference('notes'),
  },
];

/** The requirements each case tests. */
export const KEYED_MAP_REQUIREMENTS: Record<string, string[]> = Object.fromEntries(KEYED_MAP_CASES.map(c => [
  c.name,
  c.name.startsWith('keyed-map-reference-') ? ['CUSC-077', 'CUVR-070'] : ['CUSC-076', 'CUSC-077', 'CUVR-069'],
]));
