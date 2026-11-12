/**
 * Reference cases written from docs/spec/validation-rules.md ("References", "Parameter errors").
 * Every result record and failure record is written from the specification with the default rule
 * messages, never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type WrittenCase } from './visibility.mts';

interface ErrorRecord { path: string; field: string; rule: string; message: string; value: unknown }

/** The error of `reference` at a data path; the field is the last path segment. */
function error(path: string, value: unknown): ErrorRecord {
  const message = DEFAULT_MESSAGES.reference;
  if (message === undefined) throw new Error('No default message for reference');
  return { path, field: path.slice(path.lastIndexOf('.') + 1), rule: 'reference', message, value };
}

const result = (...errors: ErrorRecord[]) => ({ valid: errors.length === 0, errors });

interface FailureCase { name: string; note: string; spec: Record<string, unknown>; data: Record<string, unknown>; expectFailure: { code: string; message: string; at: string } }

const parameterText = 'Invalid reference parameter: expected the declaration path of a field';

/** The repeated group `facts`, whose rows declare the ids `id`, and the field `names`, which has `lang`. */
const factFields = {
  facts: { type: 'group', multiple: true, properties: { id: { type: 'text' } } },
  names: { type: 'text', lang: true },
};

/** A form whose field `pick` declares `reference` with `param`, which the load refuses. */
function refused(name: string, note: string, param: unknown): FailureCase {
  return {
    name, note,
    spec: { type: 'group', properties: { ...factFields, pick: { type: 'text', validate: { reference: param } } } },
    data: { pick: 'apple' },
    expectFailure: { code: 'INVALID_RULE_PARAMETER', message: parameterText, at: 'pick' },
  };
}

/** The repeated group `items`, whose rows hold the ids of the matching case. */
const items = { type: 'group', multiple: true, properties: { id: { type: 'text' } } };
const referencing = (type = 'text') => ({ type, validate: { reference: 'items.id' } });

export const REFERENCE_CASES: Array<WrittenCase | FailureCase> = [
  {
    name: 'reference-row-ids',
    note: 'the ids of facts.id are the id of every row of facts; a row of secrets passes with one of them, fails with another value and passes when empty.',
    spec: {
      type: 'group',
      properties: {
        facts: { type: 'group', multiple: true, properties: { id: { type: 'text' } } },
        secrets: { type: 'group', multiple: true, properties: { fact_id: { type: 'text', validate: { reference: 'facts.id' } } } },
      },
    },
    data: {
      facts: { __f1__: { id: 'apple' }, __f2__: { id: 'pear' } },
      secrets: { __s2__: { fact_id: 'plum' }, __s1__: { fact_id: 'pear' }, __s3__: { fact_id: '' } },
    },
    expected: result(error('secrets.__s2__.fact_id', 'plum')),
  },
  {
    name: 'reference-nested-rows-and-repeated-target',
    note: 'a path through two repeated groups reads every row of both; a repeated scalar field gives every row value as an id.',
    spec: {
      type: 'group',
      properties: {
        chapters: {
          type: 'group', multiple: true,
          properties: { scenes: { type: 'group', multiple: true, properties: { code: { type: 'text' } } } },
        },
        aliases: { type: 'text', multiple: true },
        scene: { type: 'text', validate: { reference: 'chapters.scenes.code' } },
        alias: { type: 'text', validate: { reference: 'aliases' } },
        other_alias: { type: 'text', validate: { reference: 'aliases' } },
      },
    },
    data: {
      chapters: { __c1__: { scenes: { __a__: { code: 's1' } } }, __c2__: { scenes: { __b__: { code: 's2' } } } },
      aliases: { __x__: 'Kim', __y__: 'Lee' },
      scene: 's2',
      alias: 'Lee',
      other_alias: 'Park',
    },
    expected: result(error('other_alias', 'Park')),
  },
  {
    name: 'reference-membership-matching',
    note: 'a value matches an id as a value matches a member of in: numeric text equals a number id, a string value is trimmed, an id is read as it is, true is the id 1, an array or object is no id, and an array value passes when every element passes.',
    spec: {
      type: 'group',
      properties: {
        items,
        number_text: referencing(),
        number_fraction: referencing(),
        padded: referencing(),
        spaced: referencing(),
        flag: referencing(),
        listed: referencing(),
        picks: referencing('multichoice'),
        bad_picks: referencing('multichoice'),
      },
    },
    data: {
      items: {
        __1__: { id: 7 }, __2__: { id: 'pear' }, __3__: { id: ' x ' }, __4__: { id: true }, __5__: { id: ['q'] }, __6__: { id: '' }, __7__: { id: null },
      },
      number_text: '7',
      number_fraction: '7.0',
      padded: ' pear ',
      spaced: 'x',
      flag: '1',
      listed: 'q',
      picks: ['pear', '7'],
      bad_picks: ['pear', 'plum'],
    },
    expected: result(error('spaced', 'x'), error('listed', 'q'), error('bad_picks', ['pear', 'plum'])),
  },
  {
    name: 'reference-no-ids',
    note: 'with no data at the path there is no id: a value fails and an empty value passes.',
    spec: {
      type: 'group',
      properties: {
        facts: { type: 'group', multiple: true, properties: { id: { type: 'text' } } },
        pick: { type: 'text', validate: { reference: 'facts.id' } },
        blank: { type: 'text', validate: { reference: 'facts.id' } },
      },
    },
    data: { pick: 'apple', blank: '  ' },
    expected: result(error('pick', 'apple')),
  },
  {
    name: 'reference-hidden-ids',
    note: 'a hidden field keeps its values, so its rows still give ids; its own rules do not run.',
    spec: {
      type: 'group',
      properties: {
        show_facts: { type: 'text' },
        facts: {
          type: 'group', multiple: true, design: { show: '.show_facts == 1' },
          properties: { id: { type: 'text' }, note: { type: 'text', validate: { required: true } } },
        },
        pick: { type: 'text', validate: { reference: 'facts.id' } },
      },
    },
    data: { show_facts: '0', facts: { __f1__: { id: 'apple', note: '' } }, pick: 'apple' },
    expected: result(),
    hidden: ['facts'],
  },
  {
    name: 'reference-parameter-false',
    note: 'a false parameter disables the rule.',
    spec: { type: 'group', properties: { ...factFields, pick: { type: 'text', validate: { reference: false } } } },
    data: { pick: 'apple' },
    expected: result(),
  },
  refused('reference-parameter-number', 'a parameter is a string.', 5),
  refused('reference-parameter-list', 'a list is no declaration path.', ['facts.id']),
  refused('reference-parameter-condition-map', 'reference receives its parameter unchanged, so an object is no condition map.', { '.pick == 1': 'facts.id' }),
  refused('reference-parameter-undeclared', 'the path names no declared field.', 'facts.code'),
  refused('reference-parameter-group', 'the path names a group.', 'facts'),
  refused('reference-parameter-lang', 'the path names a field with lang.', 'names'),
  refused('reference-parameter-row-key', 'a declaration path has no row keys.', 'facts.__f1__.id'),
  refused('reference-parameter-relative', 'a declaration path starts at the root.', '.id'),
  {
    name: 'reference-parameter-in-row',
    note: 'the location of a refused parameter is the declaration path of its field.',
    spec: {
      type: 'group',
      properties: {
        facts: { type: 'group', multiple: true, properties: { id: { type: 'text' } } },
        secrets: { type: 'group', multiple: true, properties: { fact_id: { type: 'text', validate: { reference: 'facts.name' } } } },
      },
    },
    data: { secrets: { __s1__: { fact_id: 'apple' } } },
    expectFailure: { code: 'INVALID_RULE_PARAMETER', message: parameterText, at: 'secrets.fact_id' },
  },
];
