/**
 * Cases of the choices that a field takes from a repeated group of the same form, written from
 * docs/spec/schema.md ("Choices from a repeated group") and docs/spec/validation-rules.md
 * ("Values", "Parameter errors"). Every result record is written from the specification with the
 * default rule messages, never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type FailingCase, type WrittenCase } from './visibility.mts';

interface ErrorRecord { path: string; field: string; rule: string; message: string; value: unknown }

/** The `in` failure of the field at `path`; the field is the last path segment. */
function inError(path: string, value: unknown, message = DEFAULT_MESSAGES.in ?? ''): ErrorRecord {
  return { path, field: path.slice(path.lastIndexOf('.') + 1), rule: 'in', message, value };
}

const result = (...errors: ErrorRecord[]) => ({ valid: errors.length === 0, errors });

/** A repeated group of characters, each with an id and a name. */
const characters = { type: 'group', multiple: true, properties: { id: { type: 'text' }, name: { type: 'text' } } };

/** A form of characters and the fields `fields` beside them. */
const form = (fields: Record<string, unknown>, group: Record<string, unknown> = characters) =>
  ({ type: 'group', properties: { characters: group, ...fields } });

/** Rows of characters: hero, the number 7 written as a number, a blank id and a sidekick. */
const cast = {
  c1: { id: 'hero', name: 'Hero' },
  c2: { id: 7, name: 'Seven' },
  c3: { id: ' ', name: 'Blank' },
  c4: { id: 'sidekick', name: 'Sidekick' },
};

/** The input failure of a row that repeats the value `value` of an earlier row, at the data path `path`. */
const repeatFailure = (value: string, path: string) =>
  ({ code: 'INVALID_FORM_INPUT', message: `Group source value repeats an earlier row: ${value} at ${path}`, at: '' });

/** A load failure of the group source of the field at `at`. */
const sourceFailure = (name: string, note: string, fields: Record<string, unknown>, at: string, message: string,
  group: Record<string, unknown> = characters): FailingCase =>
  ({ name, note, spec: form(fields, group), data: {}, expectFailure: { code: 'INVALID_RULE_PARAMETER', message, at } });

/** The characters group with a checkbox field active and a switcher field on, each of which holds a boolean. */
const flaggedCharacters = { ...characters, properties: { ...characters.properties, active: { type: 'checkbox' }, on: { type: 'switcher' } } };
const BOOLEAN_FIELD = (member: string, path: string, field: string) =>
  `Invalid items.${member} at ${path}: ${field} holds a boolean, expected a field whose values are strings or numbers`;

const FROM_FIELD = (path: string) => `Invalid items.from at ${path}: expected a choice field without lang`;
const FROM_PATH = (path: string) => `Invalid items.from at ${path}: expected {group}.*.{field} for a field of a repeated group outside repeated groups`;
const LABEL = (path: string) => `Invalid items.label at ${path}: expected the name of a direct child field of the group without multiple, properties or lang`;

export const GROUP_SOURCE_CASES: Array<WrittenCase | FailingCase> = [
  {
    name: 'group-source-select-members',
    note: 'A field whose items take the ids of the character rows passes a value that is one of them, by canonical text or numeric value, and an empty value; a label, a blank id and an unknown id are no choices.',
    spec: form({
      roles: { type: 'group', multiple: true, properties: { character: { type: 'select', items: { from: 'characters.*.id', label: 'name' } } } },
      lead: { type: 'radio', items: { from: 'characters.*.id' } },
    }),
    data: {
      characters: cast,
      roles: { r1: { character: 'hero' }, r2: { character: '7.0' }, r3: { character: 'Hero' }, r4: { character: '' }, r5: { character: ' ' } },
      lead: 'villain',
    },
    expected: result(inError('roles.r3.character', 'Hero'), inError('lead', 'villain')),
  },
  {
    name: 'group-source-multichoice-members',
    note: 'Every element of a multichoice value is one of the choices.',
    spec: form({
      cast: { type: 'multichoice', items: { from: 'characters.*.id' } },
      extras: { type: 'checkboxes', items: { from: 'characters.*.id' } },
    }),
    data: { characters: cast, cast: ['hero', 7], extras: ['hero', 'villain'] },
    expected: result(inError('extras', ['hero', 'villain'])),
  },
  {
    name: 'group-source-without-rows',
    note: 'A group without data has no choices: a value fails and an empty value passes.',
    spec: form({ lead: { type: 'select', items: { from: 'characters.*.id' } }, second: { type: 'select', items: { from: 'characters.*.id' } } }),
    data: { lead: 'hero', second: '' },
    expected: result(inError('lead', 'hero')),
  },
  {
    name: 'group-source-before-declared-rules',
    note: 'The implicit in check runs before the declared rules: an empty value passes it and fails required, messages.in replaces its message, and a declared in runs after it.',
    spec: form({
      lead: { type: 'select', items: { from: 'characters.*.id' }, validate: { required: true } },
      second: { type: 'select', items: { from: 'characters.*.id' }, messages: { in: 'Pick a character.' } },
      third: { type: 'select', items: { from: 'characters.*.id' }, validate: { in: ['hero', 'villain'] } },
      fourth: { type: 'select', items: { from: 'characters.*.id' }, validate: { in: ['villain'] } },
    }),
    data: { characters: cast, lead: '', second: 'nobody', third: 'villain', fourth: 'hero' },
    expected: result(
      { path: 'lead', field: 'lead', rule: 'required', message: DEFAULT_MESSAGES.required ?? '', value: '' },
      inError('second', 'nobody', 'Pick a character.'),
      inError('third', 'villain'),
      inError('fourth', 'hero'),
    ),
  },
  {
    name: 'group-source-hidden-group',
    note: 'The rows of a hidden group give choices, because a hidden field keeps its value.',
    spec: form({ flag: { type: 'text' }, lead: { type: 'select', items: { from: 'characters.*.id' } } },
      { ...characters, design: { show: '.flag == 1' } }),
    data: { flag: '0', characters: cast, lead: 'hero' },
    hidden: ['characters'],
    expected: result(),
  },
  sourceFailure('group-source-unknown-member', 'A group source has only from and label, checked in declaration order before the field.',
    { lead: { type: 'text', items: { from: 5, labels: 'name' } } }, 'lead', 'Invalid items.labels at lead: unknown key'),
  sourceFailure('group-source-text-field', 'Only a choice field takes a group source.',
    { lead: { type: 'text', items: { from: 'characters.*.id' } } }, 'lead', FROM_FIELD('lead')),
  sourceFailure('group-source-lang-field', 'A choice field with lang takes no group source.',
    { lead: { type: 'select', lang: true, items: { from: 'characters.*.id' } } }, 'lead', FROM_FIELD('lead')),
  sourceFailure('group-source-from-without-rows', 'from names the rows of the group with *.',
    { lead: { type: 'select', items: { from: 'characters.id' } } }, 'lead', FROM_PATH('lead')),
  sourceFailure('group-source-from-not-text', 'from is a string.',
    { lead: { type: 'select', items: { from: ['characters', '*', 'id'] } } }, 'lead', FROM_PATH('lead')),
  sourceFailure('group-source-from-not-repeated', 'The group of from is repeated.',
    { meta: { type: 'group', properties: { id: { type: 'text' } } }, lead: { type: 'select', items: { from: 'meta.*.id' } } }, 'lead', FROM_PATH('lead')),
  sourceFailure('group-source-from-inside-rows', 'The group of from is not inside a repeated group, so the form has one set of its rows.',
    {
      acts: { type: 'group', multiple: true, properties: { scenes: { type: 'group', multiple: true, properties: { id: { type: 'text' } } } } },
      lead: { type: 'select', items: { from: 'acts.scenes.*.id' } },
    }, 'lead', FROM_PATH('lead')),
  sourceFailure('group-source-from-missing-field', 'The field of from is a direct child of the group.',
    { lead: { type: 'select', items: { from: 'characters.*.code' } } }, 'lead', FROM_PATH('lead')),
  sourceFailure('group-source-from-repeated-field', 'The field of from is not repeated.',
    { roles: { type: 'group', multiple: true, properties: { tags: { type: 'text', multiple: true }, pick: { type: 'select', items: { from: 'roles.*.tags' } } } } },
    'roles.pick', FROM_PATH('roles.pick')),
  sourceFailure('group-source-label-missing', 'label names a direct child field of the group.',
    { lead: { type: 'select', items: { from: 'characters.*.id', label: 'title' } } }, 'lead', LABEL('lead')),
  sourceFailure('group-source-label-group', 'The label field is not a group.',
    { roles: { type: 'group', multiple: true, properties: { id: { type: 'text' }, meta: { type: 'group', properties: { x: { type: 'text' } } } } },
      lead: { type: 'select', items: { from: 'roles.*.id', label: 'meta' } } }, 'lead', LABEL('lead')),
  sourceFailure('group-source-from-boolean-field', 'The field of from holds no boolean: a checkbox field is refused after the path of from.',
    { lead: { type: 'select', items: { from: 'characters.*.active', label: 'name' } } }, 'lead', BOOLEAN_FIELD('from', 'lead', 'characters.active'), flaggedCharacters),
  sourceFailure('group-source-label-boolean-field', 'The label field holds no boolean: a switcher field is refused after the name of label.',
    { lead: { type: 'select', items: { from: 'characters.*.id', label: 'on' } } }, 'lead', BOOLEAN_FIELD('label', 'lead', 'characters.on'), flaggedCharacters),
  {
    name: 'group-source-repeated-value',
    note: 'A row whose id repeats the id of an earlier row is an input error that names the canonical text and the data path of the repeating row; two blank ids repeat nothing.',
    spec: form({ lead: { type: 'select', items: { from: 'characters.*.id' } } }),
    data: { characters: { c1: { id: 'hero' }, c2: { id: ' ' }, c3: { id: ' ' }, c4: { id: 'hero' } }, lead: 'hero' },
    expectFailure: repeatFailure('hero', 'characters.c4.id'),
  },
  {
    name: 'group-source-repeated-number',
    note: 'The number 7 and the text 7 have the same canonical text, so the second row repeats the first.',
    spec: form({ lead: { type: 'select', items: { from: 'characters.*.id' } } }),
    data: { characters: { c1: { id: 7 }, c2: { id: '7' } }, lead: '' },
    expectFailure: repeatFailure('7', 'characters.c2.id'),
  },
  {
    name: 'group-source-repeated-value-hidden-field',
    note: 'A hidden field is not validated, so it reads no choices and its repeated source rows fail nothing.',
    spec: form({ flag: { type: 'text' }, lead: { type: 'select', items: { from: 'characters.*.id' }, design: { show: '.flag == 1' } } }),
    data: { flag: '0', characters: { c1: { id: 'hero' }, c2: { id: 'hero' } }, lead: 'hero' },
    hidden: ['lead'],
    expected: result(),
  },
];

/** The requirements each case tests. */
export const GROUP_SOURCE_REQUIREMENTS: Record<string, string[]> = {
  'group-source-select-members': ['CUSC-061', 'CUSC-062', 'CUSC-063', 'CUVR-060'],
  'group-source-repeated-value': ['CUSC-063', 'CUSC-090', 'CUVR-087'],
  'group-source-repeated-number': ['CUSC-090', 'CUVR-087'],
  'group-source-repeated-value-hidden-field': ['CUVR-087'],
  'group-source-multichoice-members': ['CUSC-061', 'CUSC-063', 'CUVR-060'],
  'group-source-without-rows': ['CUSC-063', 'CUVR-060'],
  'group-source-before-declared-rules': ['CUVR-060'],
  'group-source-hidden-group': ['CUVR-060'],
  'group-source-unknown-member': ['CUSC-064', 'CUVR-061'],
  'group-source-text-field': ['CUSC-065', 'CUVR-061'],
  'group-source-lang-field': ['CUSC-065', 'CUVR-061'],
  'group-source-from-without-rows': ['CUSC-061', 'CUSC-066', 'CUVR-061'],
  'group-source-from-not-text': ['CUSC-066', 'CUVR-061'],
  'group-source-from-not-repeated': ['CUSC-061', 'CUSC-066', 'CUVR-061'],
  'group-source-from-inside-rows': ['CUSC-061', 'CUSC-066', 'CUVR-061'],
  'group-source-from-missing-field': ['CUSC-061', 'CUSC-066', 'CUVR-061'],
  'group-source-from-repeated-field': ['CUSC-061', 'CUSC-066', 'CUVR-061'],
  'group-source-label-missing': ['CUSC-062', 'CUSC-067', 'CUVR-061'],
  'group-source-label-group': ['CUSC-062', 'CUSC-067', 'CUVR-061'],
  'group-source-from-boolean-field': ['CUSC-061', 'CUSC-068', 'CUVR-061'],
  'group-source-label-boolean-field': ['CUSC-062', 'CUSC-068', 'CUVR-061'],
};
