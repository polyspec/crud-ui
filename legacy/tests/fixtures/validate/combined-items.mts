/**
 * Cases of a group source with literal choices, written from docs/spec/schema.md (CUSC-089) and
 * docs/spec/validation-rules.md (CUVR-085, CUVR-086): the literal choices and the choices of the rows are one set, a row that
 * repeats a literal choice is refused by path and value, and a `choices` outside its rules fails the load. Every record is
 * written from the specification with the default rule messages, never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type FailingCase, type WrittenCase } from './visibility.mts';

interface ErrorRecord { path: string; field: string; rule: string; message: string; value: unknown }

/** The `in` failure of the field at `path`. */
const inError = (path: string, value: unknown): ErrorRecord =>
  ({ path, field: path.slice(path.lastIndexOf('.') + 1), rule: 'in', message: DEFAULT_MESSAGES.in ?? '', value });

/** A repeated group of characters, each with an id and a name. */
const characters = { type: 'group', multiple: true, properties: { id: { type: 'text' }, name: { type: 'text' } } };

/** A form of characters and the fields `fields` beside them. */
const form = (fields: Record<string, unknown>) => ({ type: 'group', properties: { characters, ...fields } });

/** A group source of the character ids with the literal choices `choices`. */
const source = (choices: unknown) => ({ from: 'characters.*.id', label: 'name', choices });

const PLAYER = [{ value: 'player', label: 'Player' }];

/** The load failure of the literal choices of the field `lead`. */
const choicesFailure = (name: string, note: string, choices: unknown): FailingCase => ({
  name, note,
  spec: form({ lead: { type: 'select', items: source(choices) } }),
  data: {},
  expectFailure: {
    code: 'INVALID_RULE_PARAMETER',
    message: 'Invalid items.choices at lead: expected value and label pairs with distinct string or number values',
    at: 'lead',
  },
});

/** The input failure of a row value that repeats a literal choice. */
const repeated = (path: string, value: string) =>
  ({ code: 'INVALID_FORM_INPUT', message: `Group source value repeats a literal choice at ${path}: ${value}`, at: '' });

export const COMBINED_ITEMS_CASES: Array<WrittenCase | FailingCase> = [
  {
    name: 'combined-items-one-set',
    note: 'The literal choice player and the character ids are one set: a value passes when it is either, and fails when it is neither.',
    spec: form({
      lead: { type: 'select', items: source(PLAYER) },
      second: { type: 'select', items: source(PLAYER) },
      third: { type: 'radio', items: source(PLAYER) },
      cast: { type: 'multichoice', items: source(PLAYER) },
      extras: { type: 'checkboxes', items: source(PLAYER) },
    }),
    data: {
      characters: { c1: { id: 'hero', name: 'Hero' }, c2: { id: 7, name: 'Seven' } },
      lead: 'player', second: '7.0', third: 'nobody', cast: ['player', 'hero'], extras: ['player', 'villain'],
    },
    expected: { valid: false, errors: [inError('third', 'nobody'), inError('extras', ['player', 'villain'])] },
  },
  {
    name: 'combined-items-without-rows',
    note: 'A group without data leaves the literal choices: player passes and a character id fails.',
    spec: form({ lead: { type: 'select', items: source(PLAYER) }, second: { type: 'select', items: source(PLAYER) } }),
    data: { lead: 'player', second: 'hero' },
    expected: { valid: false, errors: [inError('second', 'hero')] },
  },
  {
    name: 'combined-items-row-repeats-choice',
    note: 'A row whose id is the literal choice player would give the value twice, so validation refuses it by the row path and the value.',
    spec: form({ lead: { type: 'select', items: source(PLAYER) } }),
    data: { characters: { c1: { id: 'hero', name: 'Hero' }, c2: { id: 'player', name: 'Player' } }, lead: 'hero' },
    expectFailure: repeated('characters.c2.id', 'player'),
  },
  {
    name: 'combined-items-row-repeats-number-choice',
    note: 'The comparison is by canonical text: a row id written as the text 7 repeats the literal choice 7.',
    spec: form({ lead: { type: 'select', items: source([{ value: 7, label: 'Seven' }]) } }),
    data: { characters: { c1: { id: '7', name: 'Seven' } }, lead: '7' },
    expectFailure: repeated('characters.c1.id', '7'),
  },
  choicesFailure('combined-items-choices-not-list', 'choices is a list.', 'player'),
  choicesFailure('combined-items-choices-extra-member', 'A literal choice has only value and label.', [{ value: 'player', label: 'Player', class: 'x' }]),
  choicesFailure('combined-items-choices-missing-label', 'A literal choice has a label.', [{ value: 'player' }]),
  choicesFailure('combined-items-choices-boolean', 'A literal value is a string or a finite number.', [{ value: true, label: 'Yes' }]),
  choicesFailure('combined-items-choices-duplicate', 'Two literal values with the same canonical text are refused.', [{ value: 1, label: 'One' }, { value: '1', label: 'Uno' }]),
];

/** The requirements each case tests. */
export const COMBINED_ITEMS_REQUIREMENTS: Record<string, string[]> = {
  'combined-items-one-set': ['CUSC-089', 'CUVR-085'],
  'combined-items-without-rows': ['CUSC-089', 'CUVR-085'],
  'combined-items-row-repeats-choice': ['CUSC-089', 'CUVR-085'],
  'combined-items-row-repeats-number-choice': ['CUSC-089', 'CUVR-085'],
  'combined-items-choices-not-list': ['CUSC-089', 'CUVR-086'],
  'combined-items-choices-extra-member': ['CUSC-089', 'CUVR-086'],
  'combined-items-choices-missing-label': ['CUSC-089', 'CUVR-086'],
  'combined-items-choices-boolean': ['CUSC-089', 'CUVR-086'],
  'combined-items-choices-duplicate': ['CUSC-089', 'CUVR-086'],
};
