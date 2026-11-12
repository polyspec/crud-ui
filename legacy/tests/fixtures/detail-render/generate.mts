/**
 * Generates the shared CRUDUI detail-render fixtures.
 *
 * The read sister of legacy/tests/fixtures/list-render/generate.mts. It produces `cases.json`: one case
 * per detail render scenario, `{ name, note, spec, record, options?, expected_html?,
 * expectError? }`. The `expected_html` is the NORMALIZED output of the React reference renderer
 * (`renderDetail`) — never hand-written. Every other renderer must reproduce it after the
 * shared normalizer, and every native generator must reproduce the raw bytes.
 *
 * The record is INJECTED in the fixture; a detail never queries data.
 *
 * Do not edit `cases.json` by hand — regenerate:
 *   node legacy/tests/fixtures/detail-render/generate.mts \
 *     > legacy/tests/fixtures/detail-render/cases.json
 */

import { renderDetail } from '@polyspec/crudui-generator-react/server';
import { normalizeHtml } from '../form-render/normalize.mts';
import { withoutPreloadLinks } from '../preload-links.mts';

/**
 * A detail case. Its specification, record and options are JSON values as every runtime reads them from the fixture; a
 * case that a runtime rejects holds a value of another JSON type, so they are unknown, and renderDetail checks them at run
 * time.
 */
interface DetailFixtureCase {
  name: string;
  note: string;
  spec: unknown;
  record?: unknown;
  options?: unknown;
  expected_html?: string;
  expectError?: { code: string; message: string };
}

/** One person record reused across scenarios. */
const ADA = {
  id: 7,
  name: '<Ada & Lin>',
  status: 'active',
  joined: '2026-01-02T09:00:00',
  score: 1234567.5,
  admin: 1,
  avatar: '/img/ada.png',
  notes: '<b>bold</b>',
  jointablename: { id: 107 },
  join: { join: { name: '<Ada & Lin>' } },
};

const SCENARIOS: DetailFixtureCase[] = [
  {
    name: 'text-with-nul',
    note: 'a NUL character in a label and in a value is written like any other character.',
    spec: { fields: { v: { field: 'v', label: 'A\u0000B' } } },
    record: { v: 'x\u0000y' },
    options: { language: 'en' },
  },
  {
    name: 'basic-fields',
    note: 'plain text fields with translated labels; values are escaped.',
    spec: {
      fields: {
        name: { field: 'name', label: { ko: '이름', en: 'Name' } },
        status: { field: 'status', label: { ko: '상태', en: 'Status' } },
      },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'basic-fields-korean',
    note: 'the same declaration in Korean selects the Korean labels.',
    spec: {
      fields: {
        name: { field: 'name', label: { ko: '이름', en: 'Name' } },
        status: { field: 'status', label: { ko: '상태', en: 'Status' } },
      },
    },
    record: ADA,
    options: { language: 'ko' },
  },
  {
    name: 'format-date',
    note: 'date format applies the declared pattern.',
    spec: { fields: { joined: { field: 'joined', label: 'Joined', format: { type: 'date', pattern: 'YYYY-MM-DD' } } } },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'format-number',
    note: 'number format with decimals, thousands and a translated prefix.',
    spec: {
      fields: {
        score: { field: 'score', label: 'Score', format: { type: 'number', decimals: 2, thousands: true, prefix: { en: '$' } } },
      },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'format-badge',
    note: 'badge format maps the value to a variant.',
    spec: {
      fields: { status: { field: 'status', label: 'Status', format: { type: 'badge', map: { active: 'success' } } } },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'format-choice-label',
    note: 'choice-label format looks the value up in the declared items.',
    spec: { fields: { grade: { field: 'grade', label: 'Grade', format: { type: 'choice-label', items: { A: 'Apple' } } } } },
    record: { grade: 'A' },
    options: { language: 'en' },
  },
  {
    name: 'format-choice-label-choice-list',
    note: 'choice-label format looks the value up in a choice list by the canonical text of each value.',
    spec: { fields: { answer: { field: 'answer', label: 'Answer', format: { type: 'choice-label', items: [{ value: 1, label: 'Yes' }, { value: 0, label: 'No' }] } } } },
    record: { answer: 0 },
    options: { language: 'en' },
  },
  {
    name: 'format-link',
    note: 'link format interpolates explicit tokens and preserves literal domain and extension text.',
    spec: { fields: { name: { field: 'name', label: 'Name', format: { type: 'link', href: 'https://example.com/users/{=jointablename.id}/{=join.join.name}.pdf', target: '_blank' } } } },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'format-bool',
    note: 'bool format as check, icon and text.',
    spec: {
      fields: {
        check: { field: 'admin', label: 'Check', format: { type: 'bool', as: 'check', labels: { true: 'Yes', false: 'No' } } },
        icon: { field: 'admin', label: 'Icon', format: { type: 'bool', as: 'icon', labels: { true: 'Yes', false: 'No' } } },
        text: { field: 'admin', label: 'Text', format: { type: 'bool', labels: { true: 'Yes', false: 'No' } } },
      },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'format-image',
    note: 'image format interpolates an explicit alt token and preserves a literal extension.',
    spec: { fields: { avatar: { field: 'avatar', label: 'Avatar', format: { type: 'image', width: 40, height: 40, alt: '{=name}.png' } } } },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'format-image-empty-size',
    note: 'a declared null width and height write empty size attributes.',
    spec: { fields: { avatar: { field: 'avatar', label: 'Avatar', format: { type: 'image', width: null, height: null } } } },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'format-text-truncate-code-points',
    note: 'truncate counts Unicode code points, keeps the integer part of the limit and applies only a number.',
    spec: {
      fields: {
        emoji: { field: 'emoji', label: 'Emoji', format: { type: 'text', truncate: 2 } },
        hangul: { field: 'hangul', label: 'Hangul', format: { type: 'text', truncate: 3 } },
        fraction: { field: 'plain', label: 'Fraction', format: { type: 'text', truncate: 2.9 } },
        below: { field: 'short', label: 'Below', format: { type: 'text', truncate: 0.5 } },
        text: { field: 'plain', label: 'Text', format: { type: 'text', truncate: '2' } },
      },
    },
    record: { emoji: 'a😀bc', hangul: '가나다라마', plain: 'abcd', short: 'abc' },
    options: { language: 'en' },
  },
  {
    name: 'reject-number-decimals-above-range',
    note: 'decimals above 100 are rejected.',
    spec: { fields: { n: { field: 'n', label: 'N', format: { type: 'number', decimals: 101 } } } },
    record: { n: 1 },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Number decimals must be between 0 and 100' },
  },
  {
    name: 'reject-number-decimals-below-range',
    note: 'negative decimals are rejected.',
    spec: { fields: { n: { field: 'n', label: 'N', format: { type: 'number', decimals: -1 } } } },
    record: { n: 1 },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Number decimals must be between 0 and 100' },
  },
  {
    name: 'format-html',
    note: 'html format writes the declared markup without escaping.',
    spec: { fields: { notes: { field: 'notes', label: 'Notes', format: { type: 'html' } } } },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'missing-value',
    note: 'a field whose path is absent from the record renders an empty cell.',
    spec: { fields: { missing: { field: 'missing', label: 'Missing' } } },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'design-wrapper-and-cell',
    note: 'the detail design styles the container and a field design styles its cell.',
    spec: {
      design: { wrapper: { class: 'card', style: 'padding:4px' } },
      fields: { name: { field: 'name', label: 'Name', design: { class: 'strong', style: 'color:red' } } },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'condition-hidden-field',
    note: 'a field hidden by its condition is not rendered.',
    spec: {
      fields: {
        name: { field: 'name', label: 'Name' },
        secret: { field: 'status', label: 'Secret', design: { show: false } },
      },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'composed-fields',
    note: 'fields resolved from a referenced file.',
    spec: { fields: { $ref: 'shared.json' } },
    record: ADA,
    options: { language: 'en', files: { 'shared.json': { properties: { name: { field: 'name', label: 'Name' } } } } },
  },
  {
    name: 'empty-fields',
    note: 'a declaration with no fields renders an empty container.',
    spec: { fields: {} },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'actions',
    note: 'detail actions precede the definition list: a link-format action is an a element, a script string and a script object are buttons that hold their scripts in onclick and an empty action object is a button with its name; labels are translated and escaped.',
    spec: {
      fields: { name: { field: 'name', label: 'Name' } },
      actions: {
        edit: { label: { ko: '수정', en: 'Edit <&>' }, format: { type: 'link', href: '/members/7/edit', target: '_self' } },
        remove: 'confirmDelete(this)',
        archive: { label: { en: 'Archive' }, script: 'archive(this)' },
        back: {},
      },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'action-behavior-events',
    note: 'a behavior member is the event attribute: each declared script or script object is written once under its member name, on a button and on a link.',
    spec: {
      fields: { name: { field: 'name', label: 'Name' } },
      actions: {
        edit: { label: { en: 'Edit' }, format: { type: 'link', href: '/members/7/edit' }, behavior: { onclick: 'track(this)' } },
        remove: { label: { en: 'Remove' }, behavior: { onclick: { label: { en: 'Remove' }, script: 'confirmDelete(this)' }, onload: 'prepare(this)' } },
      },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'actions-with-image',
    note: 'the image preload links of a string renderer precede the actions, and the actions precede the definition list.',
    spec: {
      design: { wrapper: { class: 'card' } },
      actions: { edit: { label: 'Edit', format: { type: 'link', href: '/members/7/edit' } } },
      fields: { avatar: { field: 'avatar', label: 'Avatar', format: { type: 'image', alt: 'Avatar' } } },
    },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'actions-empty',
    note: 'an empty actions object writes no actions element.',
    spec: { fields: { name: { field: 'name', label: 'Name' } }, actions: {} },
    record: ADA,
    options: { language: 'en' },
  },
  {
    name: 'reject-non-object-specification',
    note: 'a declaration that is not an object is rejected.',
    spec: [],
    record: ADA,
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Detail specification must be an object' },
  },
  {
    name: 'reject-missing-fields',
    note: 'a declaration without fields is rejected.',
    spec: {},
    record: ADA,
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Detail specification must declare fields' },
  },
  {
    name: 'content-values',
    note: 'a choice label in format items is an open value: a label that is not a string or a language map with a non-empty string entry is empty text.',
    spec: {
      fields: {
        choiceNumber: { field: 'a', label: 'C', format: { type: 'choice-label', items: { a: 3 } } },
        choiceNumberEntry: { field: 'b', label: 'D', format: { type: 'choice-label', items: { b: { en: 3, ko: '가' } } } },
        choiceList: { field: 'a', label: 'E', format: { type: 'choice-label', items: { a: ['x'] } } },
        linkTextEmpty: { field: 'name', label: 'LE', format: { type: 'link', href: '/u', text: '' } },
      },
    },
    record: { n: 5, yes: true, a: 'a', b: 'b', name: 'Ada', img: 'data:image/png;base64,AA==' },
    options: { language: 'en' },
  },
  {
    name: 'list-options-ignored',
    note: 'the list-only page, total and layout options are neither checked nor used by a detail.',
    spec: { fields: { name: { field: 'name', label: 'Name' } } },
    record: ADA,
    options: { page: 0, total: -1, layout: 'grid' },
  },
  {
    name: 'reject-specification-before-record',
    note: 'the specification rule is checked before the record rule.',
    spec: [],
    record: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Detail specification must be an object' },
  },
  {
    name: 'reject-record-before-fields',
    note: 'argument shapes are checked before the declaration: the record rule precedes the fields rule.',
    spec: {},
    record: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Detail record must be an object' },
  },
  {
    name: 'reject-record-before-context',
    note: 'the record rule is checked before the context rule.',
    spec: { fields: { name: { field: 'name', label: 'Name' } } },
    record: [],
    options: { data: [] },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Detail record must be an object' },
  },
  {
    name: 'reject-field-design-node-key',
    note: 'a design node key that the schema does not list is rejected at its field path.',
    spec: { fields: { name: { field: 'name', label: 'Name', design: { label: { text: 'x' } } } } },
    record: ADA,
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid design.label.text at fields.name: unknown key' },
  },
  {
    name: 'reject-detail-design-node-value',
    note: "the detail's own design node must be an object.",
    spec: { design: { wrapper: 'box' }, fields: { name: { field: 'name', label: 'Name' } } },
    record: ADA,
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid design.wrapper at detail: expected an object' },
  },
  {
    name: 'reject-array-context',
    note: 'a data option that is not an object is rejected.',
    spec: { fields: { name: { field: 'name', label: 'Name' } } },
    record: ADA,
    options: { data: [] },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Detail context must be an object' },
  },
  {
    name: 'reject-non-object-record',
    note: 'a record that is not an object is rejected.',
    spec: { fields: { name: { field: 'name', label: 'Name' } } },
    record: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Detail record must be an object' },
  },  // Declaration shape: every runtime rejects the same invalid declaration with the same error.
  {
    name: 'reject-root-ref-without-fields',
    note: 'a root $ref is not composed, so a specification without its own fields declares none.',
    spec: { $ref: 'base-detail.yml' },
    record: ADA,
    options: { files: { 'base-detail.yml': { properties: { fields: { name: { field: 'name' } } } } } },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Detail specification must declare fields' },
  },
  {
    name: 'reject-forbidden-field-key',
    note: 'a forbidden key in a field fails the forbidden-key scan.',
    spec: { fields: { name: { field: 'name', show_if: '.admin' } } },
    record: ADA,
    expectError: { code: 'FORBIDDEN_META_KEY', message: 'forbidden meta key "show_if" at fields.name.show_if' },
  },
  {
    name: 'reject-forbidden-root-key',
    note: 'a forbidden root key fails the scan before the declaration rules.',
    spec: { fields: { name: { field: 'name' } }, if: '.admin' },
    record: ADA,
    expectError: { code: 'FORBIDDEN_META_KEY', message: 'forbidden meta key "if" at if' },
  },
  ...([
    ['reject-number-fields', 'fields are an object.', { fields: 5 }, 'Invalid fields at detail: expected an object'],
    ['reject-unknown-root-key', 'a detail root member that the schema does not list is rejected.', { fields: { name: { field: 'name' } }, sort: { field: 'name' } }, 'Invalid sort at detail: unknown key'],
    ['reject-root-ref', 'a root $ref beside the fields is not composed.', { fields: { name: { field: 'name' } }, $ref: 'base.yml' }, 'Invalid $ref at detail: expected composition inside fields'],
    ['reject-field-not-object', 'each field is an object.', { fields: { name: 5 } }, 'Invalid name at fields: expected an object'],
    ['reject-field-sortable', 'a detail field does not declare sorting.', { fields: { name: { field: 'name', sortable: true } } }, 'Invalid sortable at fields.name: unknown key'],
    ['reject-field-path', 'the field path is a string.', { fields: { name: { field: ['name'] } } }, 'Invalid field at fields.name: expected a string'],
    ['reject-field-label', 'a label is content.', { fields: { name: { field: 'name', label: true } } }, 'Invalid label at fields.name: expected a string, a language map or null'],
    ['reject-field-format', 'a format is a boolean, a string or an object.', { fields: { name: { field: 'name', format: 5 } } }, 'Invalid format at fields.name: expected a boolean, a string or an object'],
    ['reject-field-format-items', 'a choice list value is a string or a finite number.', { fields: { name: { field: 'name', format: { type: 'choice-label', items: [{ value: null, label: 'None' }] } } } }, 'Invalid format.items at fields.name: expected value and label pairs with distinct string or number values'],
    ['reject-field-format-alt', 'an image alternative text is content.', { fields: { name: { field: 'name', format: { type: 'image', alt: 5 } } } }, 'Invalid format.alt at fields.name: expected a string, a language map or null'],
    ['reject-actions', 'actions are an object.', { fields: { name: { field: 'name' } }, actions: [] }, 'Invalid actions at detail: expected an object'],
    ['reject-action-ref', 'actions are not composed.', { fields: { name: { field: 'name' } }, actions: { $ref: 'actions.yml' } }, 'Invalid $ref at actions: unknown key'],
    ['reject-action', 'an action is a script or an object.', { fields: { name: { field: 'name' } }, actions: { edit: 5 } }, 'Invalid edit at actions: expected a script or an object'],
    ['reject-action-unknown-key', 'an action object holds label, format, behavior and design.', { fields: { name: { field: 'name' } }, actions: { edit: { label: 'Edit', onclick: 'x()' } } }, 'Invalid onclick at actions.edit: unknown key'],
    ['reject-script-action-format', 'a script action holds label and script.', { fields: { name: { field: 'name' } }, actions: { edit: { script: 'x()', format: 'link' } } }, 'Invalid format at actions.edit: unknown key'],
    ['reject-action-label', 'an action label is content.', { fields: { name: { field: 'name' } }, actions: { edit: { label: 1 } } }, 'Invalid label at actions.edit: expected a string, a language map or null'],
    ['reject-action-format', 'an action format follows the format rules.', { fields: { name: { field: 'name' } }, actions: { edit: { format: { type: 'link', href: 1 } } } }, 'Invalid format.href at actions.edit: expected a string or a condition map'],
    ['reject-action-behavior-entry', 'a behavior entry is a script or an object.', { fields: { name: { field: 'name' } }, actions: { edit: { behavior: { onclick: 1 } } } }, 'Invalid behavior.onclick at actions.edit: expected a script or an object'],
    ['reject-action-design', 'an action design follows the design rules.', { fields: { name: { field: 'name' } }, actions: { edit: { design: { color: 'red' } } } }, 'Invalid design.color at actions.edit: unknown key'],
    ['reject-fields-before-actions', 'the fields are checked before the actions.', { actions: [], fields: { name: 5 } }, 'Invalid name at fields: expected an object'],
    ['reject-design-before-actions', 'the own design is checked before the actions.', { actions: [], design: { color: 'red' }, fields: { name: { field: 'name' } } }, 'Invalid design.color at detail: unknown key'],
    ['reject-list-description', 'a detail does not declare a description.', { fields: { name: { field: 'name' } }, description: 'Member' }, 'Invalid description at detail: unknown key'],
    ['reject-root-key-before-design', 'root members are checked before the own design.', { design: { color: 'red' }, fields: { name: { field: 'name' } }, empty: 'None' }, 'Invalid empty at detail: unknown key'],
  ] as const).map(([name, note, spec, message]): DetailFixtureCase => ({
    name,
    note,
    spec: spec,
    record: ADA,
    expectError: { code: 'INVALID_FORM_INPUT', message },
  })),  {
    name: 'field-path-dotted',
    note: 'a field path reads the nested record value at the dotted path (CUDF-001).',
    spec: { fields: { company: { field: 'company.name', label: 'Company' } } },
    record: { company: { name: 'Acme' } },
    options: { language: 'en' },
  },
  {
    name: 'format-true-and-false-are-text',
    note: 'a format of true or false is the text display (CUDF-004).',
    spec: { fields: { name: { field: 'name', label: 'Name', format: true }, status: { field: 'status', label: 'Status', format: false } } },
    record: { name: 'Ada', status: 'active' },
    options: { language: 'en' },
  },
  {
    name: 'format-string-type-date',
    note: 'a format given as a string is that display type with no settings (CUDF-005): the date display.',
    spec: { fields: { joined: { field: 'joined', label: 'Joined', format: 'date' } } },
    record: { joined: '2026-01-02' },
    options: { language: 'en' },
  },
  {
    name: 'format-link-href-condition',
    note: 'an href condition map selects the link by the first true condition (CUDF-020).',
    spec: { fields: { name: { field: 'name', label: 'Name', format: { type: 'link', href: { 'name == "Ada"': '/ada', true: '/other' } } } } },
    record: { name: 'Ada' },
    options: { language: 'en' },
  },
  {
    name: 'format-link-javascript-url',
    note: 'a javascript: href is replaced with a URL that throws (CUDF-023).',
    spec: { fields: { name: { field: 'name', label: 'Name', format: { type: 'link', href: 'javascript:alert(1)' } } } },
    record: { name: 'Ada' },
    options: { language: 'en' },
  },
  {
    name: 'reject-field-unknown-key-before-format',
    note: 'a field checks its unknown keys in member order before its known members (CUDF-038).',
    spec: { fields: { name: { field: 'name', format: 1, color: 'x' } } },
    record: ADA,
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid color at fields.name: unknown key' },
  },

];

const cases = SCENARIOS.map((scenario) => {
  if (scenario.expectError) return scenario;
  // The cases are the JSON of every language, called as a JavaScript caller does (Reflect.apply): a case that renders may
  // still hold members outside the TypeScript options, such as the list members layout, page and total.
  const rendered: unknown = Reflect.apply(renderDetail, undefined, [scenario.spec, scenario.record ?? {}, scenario.options ?? {}]);
  if (typeof rendered !== 'string') throw new Error(`renderDetail returned no HTML for ${scenario.name}`);
  const html = withoutPreloadLinks(rendered);
  return { ...scenario, expected_html: normalizeHtml(html) };
});

const REQUIREMENTS: Record<string, readonly string[]> = {
  "text-with-nul": ["CUDF-045", "CUDF-047"],
  "basic-fields": ["CUDF-045", "CUDF-047", "CURP-001"],
  "basic-fields-korean": ["CUDF-045", "CUDF-047"],
  "format-date": ["CUDF-006", "CUDF-008", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-083"],
  "format-number": ["CUDF-006", "CUDF-009", "CUDF-016", "CUDF-018", "CUDF-019", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-050", "CUDF-083"],
  "format-badge": ["CUDF-006", "CUDF-010", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-051", "CUDF-052", "CUDF-084"],
  "format-choice-label": ["CUDF-006", "CUDF-012", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-054", "CUDF-083"],
  "format-choice-label-choice-list": ["CUDF-006", "CUDF-012", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-054", "CUDF-055", "CUDF-083"],
  "format-link": ["CUDF-006", "CUDF-011", "CUDF-022", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-053", "CUDF-085"],
  "format-bool": ["CUDF-006", "CUDF-013", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-086"],
  "format-image": ["CUDF-006", "CUDF-014", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-050", "CUDF-087"],
  "format-image-empty-size": ["CUDF-006", "CUDF-014", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-087"],
  "format-text-truncate-code-points": ["CUDF-006", "CUDF-007", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-083"],
  "format-html": ["CUDF-006", "CUDF-015", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-088"],
  "missing-value": ["CUDF-045", "CUDF-047"],
  "design-wrapper-and-cell": ["CUDF-041", "CUDF-045", "CUDF-047"],
  "condition-hidden-field": ["CUDF-045", "CUDF-047"],
  "actions": ["CUDF-041", "CUDF-045", "CUDF-047", "CUDF-062", "CUDF-064", "CUDF-065", "CUDF-066", "CUDF-067", "CUDF-068", "CUDF-069"],
  "action-behavior-events": ["CUDF-041", "CUDF-045", "CUDF-047", "CUDF-062", "CUDF-064", "CUDF-066", "CUDF-068", "CUDF-069", "CUDF-070", "CUDF-071", "CUDF-072", "CUDF-073", "CUDF-074", "CUDF-075"],
  "actions-with-image": ["CUDF-006", "CUDF-014", "CUDF-041", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-050", "CUDF-062", "CUDF-064", "CUDF-066", "CUDF-068", "CUDF-069", "CUDF-087"],
  "actions-empty": ["CUDF-041", "CUDF-045", "CUDF-047"],
  "reject-non-object-specification": ["CUDF-032"],
  "reject-missing-fields": ["CUDF-034"],
  "content-values": ["CUDF-006", "CUDF-011", "CUDF-012", "CUDF-021", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-050", "CUDF-053", "CUDF-054", "CUDF-083", "CUDF-085"],
  "list-options-ignored": ["CUDF-045", "CUDF-047"],
  "reject-specification-before-record": ["CUDF-032"],
  "reject-record-before-fields": ["CUDF-033"],
  "reject-record-before-context": ["CUDF-033"],
  "reject-field-design-node-key": ["CUDF-045"],
  "reject-array-context": ["CUDF-035"],
  "reject-non-object-record": ["CUDF-033"],
  "reject-root-ref-without-fields": ["CUDF-034"],
  "reject-unknown-root-key": ["CUDF-041"],
  "reject-field-not-object": ["CUDF-043"],
  "reject-field-sortable": ["CUDF-045"],
  "reject-field-path": ["CUDF-046"],
  "reject-field-label": ["CUDF-047"],
  "reject-field-format": ["CUDF-048"],
  "reject-field-format-items": ["CUDF-055"],
  "reject-field-format-alt": ["CUDF-050"],
  "reject-actions": ["CUDF-062"],
  "reject-action-ref": ["CUDF-063"],
  "reject-action": ["CUDF-064"],
  "reject-action-unknown-key": ["CUDF-065", "CUDF-066"],
  "reject-script-action-format": ["CUDF-065", "CUDF-066"],
  "reject-action-label": ["CUDF-047", "CUDF-068"],
  "reject-action-format": ["CUDF-053"],
  "reject-action-behavior-entry": ["CUDF-072"],
  "reject-action-design": ["CUDF-065", "CUDF-066", "CUDF-076"],
  "reject-fields-before-actions": ["CUDF-043"],
  "reject-design-before-actions": ["CUDF-037", "CUDF-041"],
  "reject-list-description": ["CUDF-041"],
  "reject-root-key-before-design": ["CUDF-036", "CUDF-041"],
  "field-path-dotted": ["CUDF-001", "CUDF-045", "CUDF-047"],
  "format-true-and-false-are-text": ["CUDF-002", "CUDF-004", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-083"],
  "format-string-type-date": ["CUDF-002", "CUDF-005", "CUDF-008", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-083"],
  "format-link-href-condition": ["CUDF-002", "CUDF-011", "CUDF-020", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-053", "CUDF-085"],
  "format-link-javascript-url": ["CUDF-002", "CUDF-011", "CUDF-023", "CUDF-045", "CUDF-047", "CUDF-048", "CUDF-085"],
  "reject-field-unknown-key-before-format": ["CUDF-038", "CUDF-045"],
};

/** The requirement ids that each case tests (docs/spec); a case that tests none keeps no requirements member. */
function withRequirements<T extends { name: string; note: string }>(c: T): T & { requirements?: readonly string[] } {
  const ids = [...(REQUIREMENTS[c.name] ?? []), 'CURP-017'];
  return Object.assign({ name: c.name, note: c.note, requirements: ids }, c);
}
process.stdout.write(`${JSON.stringify(cases.map(withRequirements), null, 2)}\n`);
