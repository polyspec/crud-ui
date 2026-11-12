/**
 * Generates shared CRUDUI list-render fixtures for three frameworks (SPEC §9).
 *
 * The read sister of packages/react/scripts/generate-form-render-cases.mts. It produces
 * `cases.json`: one case per list render scenario. Each case is
 * `{ name, note, spec, rows, options?, expected_html?, expectError? }`. The
 * `expected_html` is the NORMALIZED output of the React CRUDUI LIST reference
 * generator (`renderList`) — never hand-written. The Vue/Svelte CRUDUI list
 * generators must reproduce the SAME `expected_html` after the shared normalizer
 * (legacy/tests/fixtures/form-render/normalize.mts — reused verbatim, SPEC §9 plan).
 *
 * DB-agnostic (SPEC §9): `rows` are INJECTED in the fixture; search/sort/
 * pagination are DECLARED only. The renderer never touches a DB.
 *
 * Do not edit `cases.json` by hand — regenerate:
 *   node legacy/tests/fixtures/list-render/generate.mts \
 *     > legacy/tests/fixtures/list-render/cases.json
 */

import { renderList } from '@polyspec/crudui-generator-react/server';
import { normalizeHtml } from '../form-render/normalize.mts';
import { withoutPreloadLinks } from '../preload-links.mts';

/**
 * A list case. Its specification, rows and options are JSON values as every runtime reads them from the fixture; a case
 * that a runtime rejects holds a value of another JSON type, so they are unknown, and renderList checks them at run time.
 */
interface ListFixtureCase {
  name: string;
  note: string;
  spec: unknown;
  rows: unknown;
  options?: unknown;
  expected_html?: string;
  expectError?: { code: string; message?: string };
}

/** Two representative people rows reused across catalog scenarios. */
const PEOPLE = [
  {
    id: 1,
    name: 'Ada',
    status: 'active',
    joined: '2026-01-02T09:00:00',
    score: 1234567.5,
    admin: 1,
    avatar: '/img/ada.png',
    jointablename: { id: 101 },
    join: { join: { name: 'Ada' } },
  },
  {
    id: 2,
    name: 'Lin',
    status: 'blocked',
    joined: '2026-03-15T12:00:00',
    score: 42,
    admin: 0,
    avatar: '/img/lin.png',
    jointablename: { id: 102 },
    join: { join: { name: 'Lin' } },
  },
];

/** The fixture matrix (one entry per §9 list scenario). */
const SCENARIOS: ListFixtureCase[] = [
  // --- basic columns + the §9.2 cell catalog (date/number/badge/choice/link/bool) ---
  {
    name: 'basic-columns',
    note: 'plain text columns + i18n headers; two injected rows → table body.',
    spec: {
      columns: {
        name: { field: 'name', label: { ko: '이름', en: 'Name' } },
        status: { field: 'status', label: { ko: '상태', en: 'Status' } },
      },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },
  {
    name: 'format-date',
    note: 'date format → pattern applied to the cell value (§9.2).',
    spec: {
      columns: { joined: { field: 'joined', label: 'Joined', format: { type: 'date', pattern: 'YYYY-MM-DD' } } },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },
  {
    name: 'format-number',
    note: 'number format → decimals + thousands + i18n prefix affix (§9.2).',
    spec: {
      columns: {
        score: {
          field: 'score',
          label: 'Score',
          format: { type: 'number', decimals: 2, thousands: true, prefix: { en: '$' } },
        },
      },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },
  {
    name: 'format-number-shortest',
    note: 'number format without decimals → the shortest round-trip text in plain notation between 1e-6 and 1e21 (§9.2).',
    spec: {
      columns: {
        value: { field: 'value', label: 'Value', format: { type: 'number' } },
        grouped: { field: 'value', label: 'Grouped', format: { type: 'number', thousands: true } },
      },
    },
    rows: ['30', 100, '1200.5', 0.00001, '-0', 1e21, 1.5e-7, '123456789012345680000', 0.1, -4500]
      .map(value => ({ value })),
    options: { language: 'en' },
  },
  {
    name: 'format-badge',
    note: 'badge format → span.badge.badge-<variant> from the value→variant map (§9.2).',
    spec: {
      columns: {
        status: {
          field: 'status',
          label: 'Status',
          format: { type: 'badge', map: { active: 'success', blocked: 'danger' } },
        },
      },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },
  {
    name: 'format-choice-label',
    note: 'choice-label format → static code→label lookup (§9.2).',
    spec: {
      columns: {
        grade: { field: 'grade', label: 'Grade', format: { type: 'choice-label', items: { A: 'Apple', B: 'Banana' } } },
      },
    },
    rows: [{ grade: 'A' }, { grade: 'B' }],
    options: { language: 'en' },
  },
  {
    name: 'format-choice-label-choice-list',
    note: 'choice-label format looks the value up in a choice list by the canonical text of each value; a value without a pair is displayed unchanged.',
    spec: {
      columns: {
        answer: { field: 'answer', label: 'Answer', format: { type: 'choice-label', items: [{ value: 1, label: 'Yes' }, { value: 0, label: { en: 'No', ko: '아니요' } }] } },
      },
    },
    rows: [{ answer: 1 }, { answer: '0' }, { answer: 2 }],
    options: { language: 'en' },
  },
  {
    name: 'format-link',
    note: 'link format → <a> with explicit {=field}-interpolated href, literal domain and extension, + target (§9.2).',
    spec: {
      columns: {
        name: { field: 'name', label: 'Name', format: { type: 'link', href: 'https://example.com/users/{=jointablename.id}/{=join.join.name}.pdf', target: '_blank' } },
      },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },
  {
    name: 'format-bool',
    note: 'bool format as=check → glyph host carrying the i18n label (§9.2).',
    spec: {
      columns: {
        admin: { field: 'admin', label: 'Admin', format: { type: 'bool', true: 'Yes', false: 'No', as: 'check' } },
      },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },
  {
    name: 'format-image',
    note: 'image format → <img> with src + explicit {=field} alt, literal extension, + size (§9.2).',
    spec: {
      columns: {
        avatar: { field: 'avatar', label: 'Avatar', format: { type: 'image', width: 40, height: 40, alt: 'avatar {=name}.png' } },
      },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },
  {
    name: 'format-html',
    note: 'html format → the ONE sanctioned raw passthrough (verbatim, no wrapper) (§9.2).',
    spec: { columns: { bio: { field: 'bio', label: 'Bio', format: { type: 'html' } } } },
    rows: [{ bio: '<b data-x="1">bold</b>' }],
    options: { language: 'en' },
  },

  // --- conditional column visibility (expression, G1) ---
  {
    name: 'column-show-expr-hidden',
    note: "design.show '.admin' falsy → the column is dropped from header AND every row (G1).",
    spec: {
      columns: {
        name: { field: 'name', label: 'Name' },
        secret: { field: 'secret', label: 'Secret', design: { show: '.admin' } },
      },
    },
    rows: [{ name: 'Ada', secret: 'TOPSECRET' }],
    options: { language: 'en', data: { admin: false } },
  },
  {
    name: 'column-show-expr-visible',
    note: "design.show '.admin' truthy → the column is kept (G1).",
    spec: {
      columns: {
        name: { field: 'name', label: 'Name' },
        secret: { field: 'secret', label: 'Secret', design: { show: '.admin' } },
      },
    },
    rows: [{ name: 'Ada', secret: 'visible' }],
    options: { language: 'en', data: { admin: true } },
  },
  {
    name: 'column-show-map-without-selection',
    note: 'A design.show condition map that selects nothing leaves the column visible: only a resolved false hides.',
    spec: {
      columns: {
        name: { field: 'name', label: 'Name' },
        secret: { field: 'secret', label: 'Secret', design: { show: { '.admin': false } } },
      },
    },
    rows: [{ name: 'Ada', secret: 'visible' }],
    options: { language: 'en', data: { admin: false } },
  },
  {
    name: 'column-show-literal-string',
    note: 'A design.show string that is not a valid expression is a literal and leaves the column visible.',
    spec: {
      columns: {
        name: { field: 'name', label: 'Name' },
        secret: { field: 'secret', label: 'Secret', design: { show: '.admin == (' } },
      },
    },
    rows: [{ name: 'Ada', secret: 'visible' }],
    options: { language: 'en', data: { admin: false } },
  },

  // --- i18n headers (ko vs en) over the SAME spec ---
  {
    name: 'i18n-header-ko',
    note: 'i18n header resolves to ko under language:ko.',
    spec: {
      columns: {
        name: { field: 'name', label: { ko: '이름', en: 'Name' } },
        status: { field: 'status', label: { ko: '상태', en: 'Status' } },
      },
    },
    rows: PEOPLE,
    options: { language: 'ko' },
  },
  {
    name: 'i18n-header-en',
    note: 'i18n header resolves to en under language:en (same spec as -ko).',
    spec: {
      columns: {
        name: { field: 'name', label: { ko: '이름', en: 'Name' } },
        status: { field: 'status', label: { ko: '상태', en: 'Status' } },
      },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },

  // --- sort display (declared only — read-only marker, DB applies the real ORDER BY) ---
  {
    name: 'sort-display',
    note: 'sortable column + declared sort → data-sortable + data-sort-dir on the matching <th>.',
    spec: {
      columns: {
        name: { field: 'name', label: 'Name', sortable: true },
        status: { field: 'status', label: 'Status' },
      },
      sort: { field: 'name', dir: 'asc' },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },
  {
    name: 'sortable-map-without-selection',
    note: 'A sortable condition map that selects nothing is false: the column is not sortable (a map selecting a true value is).',
    spec: {
      columns: {
        name: { field: 'name', label: 'Name', sortable: { '.admin': true } },
        status: { field: 'status', label: 'Status', sortable: { '.admin': false, true: true } },
      },
    },
    rows: PEOPLE,
    options: { language: 'en', data: { admin: false } },
  },

  // --- pagination display (declared + injected meta; DB-agnostic) ---
  {
    name: 'pagination-display',
    note: 'pagination declared + supplied page and total → <nav class=crudui-list__pagination> data attrs.',
    spec: {
      columns: { name: { field: 'name', label: 'Name' } },
      pagination: { per_page: 20, mode: 'pages' },
    },
    rows: PEOPLE,
    options: { language: 'en', page: 2, total: 99 },
  },
  {
    name: 'pagination-empty-first-page',
    note: 'page 1 with total 0 is valid, and the largest safe integer page is accepted.',
    spec: {
      columns: { name: { field: 'name', label: 'Name' } },
      pagination: true,
    },
    rows: [],
    options: { language: 'en', page: 9007199254740991, total: 0 },
  },
  {
    name: 'pagination-page-beyond-last',
    note: 'a page after the last page marks the last page current and disables both boundary controls.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, pagination: true },
    rows: [],
    options: { language: 'en', page: 2, total: 0 },
  },
  {
    name: 'pagination-middle-window',
    note: 'more than seven pages render the first, previous, current, next and last page numbers.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, pagination: true },
    rows: [],
    options: { language: 'en', page: 50, total: 2000 },
  },
  {
    name: 'pagination-largest-window',
    note: 'the largest safe integer page and total clamp to the last page of a bounded window.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, pagination: true },
    rows: [],
    options: { language: 'en', page: 9007199254740991, total: 9007199254740991 },
  },
  {
    name: 'pagination-without-total',
    note: 'without a total no page numbers render and both boundary controls are disabled.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, pagination: true },
    rows: [],
    options: { language: 'en', page: 1 },
  },
  {
    name: 'pagination-page-without-total',
    note: 'without a total the current page is the first page, whatever page is supplied.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, pagination: true },
    rows: [],
    options: { language: 'en', page: 5 },
  },

  // --- design appearance on a column header (resolveDesign reuse) ---
  {
    name: 'design-column-class-style',
    note: 'column design class/style reaches the <th> verbatim (form-spec design reuse).',
    spec: {
      columns: { name: { field: 'name', label: 'Name', design: { class: 'text-right', style: 'width: 40%' } } },
    },
    rows: PEOPLE,
    options: { language: 'en' },
  },

  // --- empty content ---
  // --- interface text of pagination and of an undeclared empty list, per display language ---
  ...(['ko', 'ja', 'zh', 'fr'] as const).map(language => ({
    name: `pagination-labels-${language}`,
    note: `pagination button names come from the ${language === 'fr' ? 'English list messages (fr is not in the table)' : `${language} list messages`}; the buttons show ‹, the page number and ›.`,
    spec: { columns: { name: { field: 'name', label: 'Name' } }, pagination: { per_page: 1 } },
    rows: PEOPLE,
    options: { language, page: 2, total: 3 },
  })),
  ...(['ko', 'en', 'ja', 'zh'] as const).map(language => ({
    name: `empty-undeclared-${language}`,
    note: `no rows and no declared empty → the ${language} emptyList interface message.`,
    spec: { columns: { name: { field: 'name', label: 'Name' } } },
    rows: [],
    options: { language },
  })),
  {
    name: 'empty-declared-null',
    note: 'a null empty is the same as no declaration → the emptyList interface message.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, empty: null },
    rows: [],
    options: { language: 'ko' },
  },
  {
    name: 'empty-declared-blank',
    note: 'a declared empty text is used as declared, even when it is empty.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, empty: '' },
    rows: [],
    options: { language: 'en' },
  },
  {
    name: 'empty-message',
    note: 'no rows → the translated empty message, no <table>.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, empty: { ko: '데이터 없음', en: 'No data' } },
    rows: [],
    options: { language: 'en' },
  },

  // --- actions toolbar (behavior reuse: link format + bare behavior script) ---
  {
    name: 'actions-toolbar',
    note: 'link-format action → <a>; a script action → <button> whose onclick attribute holds the script.',
    spec: {
      columns: { name: { field: 'name', label: 'Name' } },
      actions: {
        edit: { label: { en: 'Edit' }, format: { type: 'link', href: '/edit' } },
        remove: 'confirmDelete(this)',
      },
    },
    rows: [{ name: 'Ada' }],
    options: { language: 'en' },
  },

  {
    name: 'action-behavior-events',
    note: 'a behavior member is the event attribute: each declared script or script object is written once under its member name, on a button and on a link.',
    spec: {
      columns: { name: { field: 'name', label: 'Name' } },
      actions: {
        edit: { label: { en: 'Edit' }, format: { type: 'link', href: '/edit' }, behavior: { onclick: 'track(this)' } },
        remove: { label: { en: 'Remove' }, behavior: { onclick: { label: { en: 'Remove' }, script: 'confirmDelete(this)' }, onload: 'prepare(this)' } },
      },
    },
    rows: [{ name: 'Ada' }],
    options: { language: 'en' },
  },

  // --- description (the first child of the list, before the actions) ---
  {
    name: 'description-before-actions',
    note: 'a translated description is the first child of the list, before the actions; its text is escaped.',
    spec: {
      columns: { name: { field: 'name', label: 'Name' } },
      description: { ko: '회원 <목록>', en: 'Members <& staff>' },
      actions: { edit: { label: { en: 'Edit' }, format: { type: 'link', href: '/edit' } } },
    },
    rows: [{ name: 'Ada' }],
    options: { language: 'en' },
  },
  {
    name: 'description-card-without-actions',
    note: 'a description without actions precedes the card layout.',
    spec: { description: 'All members', columns: { name: { field: 'name', label: 'Name' } } },
    rows: [{ name: 'Ada' }],
    options: { language: 'en', layout: 'card' },
  },
  {
    name: 'description-empty-rows',
    note: 'a description precedes the empty state of a list without rows.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, description: 'All members' },
    rows: [],
    options: { language: 'en' },
  },
  {
    name: 'description-empty-text',
    note: 'an empty description and a null description write nothing.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, description: '' },
    rows: [{ name: 'Ada' }],
    options: { language: 'en' },
  },
  {
    name: 'description-null',
    note: 'a null description writes nothing.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, description: null },
    rows: [{ name: 'Ada' }],
    options: { language: 'en' },
  },

  // --- card layout ---
  {
    name: 'card-layout',
    note: 'card layout → one .crudui-list__card article per row with label:value pairs, no <table>.',
    spec: {
      columns: {
        name: { field: 'name', label: { en: 'Name' } },
        status: { field: 'status', label: { en: 'Status' }, format: { type: 'badge', map: { active: 'success', blocked: 'danger' } } },
      },
    },
    rows: PEOPLE,
    options: { language: 'en', layout: 'card' },
  },

  // --- compose: $ref base + $patch overlay on the columns map (shared engine) ---
  {
    name: 'compose-ref-patch',
    note: '$ref base columns + $patch overlay (the SAME compose engine as form-spec).',
    spec: {
      columns: {
        $ref: 'base-columns.yml',
        $patch: { extra: { field: 'extra', label: 'Extra' } },
      },
    },
    rows: [{ id: 7, extra: 'E' }],
    options: {
      language: 'en',
      files: { 'base-columns.yml': { properties: { id: { field: 'id', label: 'ID', sortable: true } } } },
    },
  },

  // An unresolved $ref returns a load error instead of a table.
  {
    name: 'unresolved-ref-error',
    note: 'unresolved $ref → ComposeLoadError (render FAILS, never valid).',
    spec: { columns: { $ref: 'missing.yml' } },
    rows: [],
    options: { files: {} },
    expectError: { code: 'REF_FILE_NOT_FOUND' },
  },
  {
    name: 'text-with-nul',
    note: 'a NUL character in a label and in a value is written like any other character.',
    spec: { columns: { v: { field: 'v', label: 'A\u0000B' } } },
    rows: [{ v: 'x\u0000y' }],
    options: { language: 'en' },
  },
  // Pagination declaration: the same value types and keys are rejected everywhere.
  ...([
    ['reject-pagination-null', 'a null pagination is neither a boolean nor an object.', null, 'Invalid pagination at list: expected a boolean or an object'],
    ['reject-pagination-string', 'a string pagination is neither a boolean nor an object.', 'pages', 'Invalid pagination at list: expected a boolean or an object'],
    ['reject-pagination-unknown-key', 'an undeclared pagination member is rejected.', { per_page: 20, size: 10 }, 'Invalid pagination.size at list: unknown key'],
    ['reject-pagination-per-page-zero', 'rows per page start at 1.', { per_page: 0 }, 'Invalid pagination.per_page at list: expected a positive integer'],
    ['reject-pagination-per-page-fraction', 'rows per page are an integer.', { per_page: 2.5 }, 'Invalid pagination.per_page at list: expected a positive integer'],
    ['reject-pagination-per-page-null', 'a null per_page is not a count.', { per_page: null }, 'Invalid pagination.per_page at list: expected a positive integer'],
    ['reject-pagination-per-page-unsafe', 'rows per page stay within the safe integer range.', { per_page: 9007199254740992 }, 'Invalid pagination.per_page at list: expected a positive integer'],
    ['reject-pagination-mode-unknown', 'the mode is one of the declared modes.', { mode: 'infinite' }, 'Invalid pagination.mode at list: expected pages, offset, cursor or none'],
    ['reject-pagination-mode-empty', 'an empty mode is not a declared mode.', { mode: '' }, 'Invalid pagination.mode at list: expected pages, offset, cursor or none'],
  ] as const).map(([name, note, pagination, message]): ListFixtureCase => ({
    name,
    note,
    spec: { columns: { name: { field: 'name', label: 'Name' } }, pagination },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message },
  })),
  {
    name: 'pagination-declared-defaults',
    note: 'a declared mode keeps the default of 20 rows per page.',
    spec: { columns: { name: { field: 'name', label: 'Name' } }, pagination: { mode: 'offset' } },
    rows: [],
    options: { language: 'en', total: 41 },
  },
  // List input: every runtime rejects the same invalid input with the same message.
  {
    name: 'reject-array-specification',
    note: 'a specification that is not an object is rejected.',
    spec: [],
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List specification must be an object' },
  },
  {
    name: 'reject-string-specification',
    note: 'a string specification is rejected.',
    spec: 'list',
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List specification must be an object' },
  },
  {
    name: 'reject-object-rows',
    note: 'rows that are not an array are rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: {},
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List rows must be an array' },
  },
  {
    name: 'reject-scalar-row',
    note: 'a row that is not an object is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [1],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List rows must be objects' },
  },
  {
    name: 'reject-array-row',
    note: 'a row that is an array is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [[]],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List rows must be objects' },
  },
  {
    name: 'reject-array-context',
    note: 'a data option that is not an object is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { data: [] },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List context must be an object' },
  },
  {
    name: 'reject-context-before-page',
    note: 'the data rule is checked before the page rule.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { data: [], page: 0 },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List context must be an object' },
  },
  {
    name: 'reject-string-page',
    note: 'a page that is not a number is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { page: '2' },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List page must be a positive integer' },
  },
  {
    name: 'reject-zero-page',
    note: 'a page below 1 is rejected, before the total and layout rules.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { page: 0, total: -1, layout: 'grid' },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List page must be a positive integer' },
  },
  {
    name: 'reject-fractional-page',
    note: 'a page that is not an integer is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { page: 1.5 },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List page must be a positive integer' },
  },
  {
    name: 'reject-unsafe-page',
    note: 'a page above the largest safe integer is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { page: 9007199254740992 },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List page must be a positive integer' },
  },
  {
    name: 'reject-negative-total',
    note: 'a total below 0 is rejected, before the layout rule.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { total: -1, layout: 'grid' },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List total must be a nonnegative integer' },
  },
  {
    name: 'reject-fractional-total',
    note: 'a total that is not an integer is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { total: 2.5 },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List total must be a nonnegative integer' },
  },
  {
    name: 'reject-boolean-total',
    note: 'a total that is not a number is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { total: true },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List total must be a nonnegative integer' },
  },
  {
    name: 'reject-unknown-layout',
    note: 'a layout other than table or card is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { layout: 'grid' },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List layout must be table or card' },
  },
  {
    name: 'reject-number-layout',
    note: 'a layout that is not a string is rejected.',
    spec: { columns: { name: { field: 'name' } } },
    rows: [],
    options: { layout: 5 },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List layout must be table or card' },
  },
  // Declarations: design follows the form declaration rules, checked after input and composition.
  {
    name: 'reject-column-design-unknown-key',
    note: 'a column design key that the schema does not list is rejected at its column path.',
    spec: { columns: { name: { field: 'name', design: { main: { class: 'x' } } } } },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid design.main at columns.name: unknown key' },
  },
  {
    name: 'reject-list-design-before-columns',
    note: "the list's own design is checked before its columns.",
    spec: { design: { color: 'red' }, columns: { name: { field: 'name', design: { main: {} } } } },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid design.color at list: unknown key' },
  },
  {
    name: 'reject-column-design-value',
    note: 'a column design value of the wrong type is rejected with the form message.',
    spec: { columns: { name: { field: 'name', design: { show: 1 } } } },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid design.show at columns.name: expected an expression, a boolean or a condition map' },
  },
  {
    name: 'action-script-object',
    note: 'an action object with script is a script action: its label is translated and its button holds the script in onclick.',
    spec: {
      columns: { name: { field: 'name', label: 'Name' } },
      actions: { remove: { label: { en: 'Remove' }, script: 'confirmDelete(this)' } },
    },
    rows: [{ name: 'Ada' }],
    options: { language: 'en' },
  },
  // Declaration shape: every runtime rejects the same invalid declaration with the same error.
  {
    name: 'reject-missing-columns',
    note: 'a list specification declares columns.',
    spec: { sort: { field: 'name', dir: 'asc' } },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List specification must declare columns' },
  },
  {
    name: 'reject-rows-before-columns',
    note: 'the rows argument is checked before the columns declaration.',
    spec: {},
    rows: {},
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List rows must be an array' },
  },
  {
    name: 'reject-columns-before-context',
    note: 'the columns declaration is checked before the options.',
    spec: {},
    rows: [],
    options: { data: [] },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List specification must declare columns' },
  },
  {
    name: 'reject-root-ref-without-columns',
    note: 'a root $ref is not composed, so a specification without its own columns declares none.',
    spec: { $ref: 'base-list.yml' },
    rows: [],
    options: { files: { 'base-list.yml': { properties: { columns: { name: { field: 'name' } } } } } },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List specification must declare columns' },
  },
  {
    name: 'reject-context-before-columns-shape',
    note: 'the options are checked before the columns value.',
    spec: { columns: 5 },
    rows: [],
    options: { data: [] },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List context must be an object' },
  },
  {
    name: 'reject-layout-before-composition',
    note: 'the layout option is an input rule: renderList checks it before composition; buildList does not read it.',
    spec: { columns: { $ref: 'missing.yml' } },
    rows: [],
    options: { files: {}, layout: 'grid' },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List layout must be table or card' },
  },
  {
    name: 'reject-layout-before-declarations',
    note: 'renderList checks the layout option before the declarations.',
    spec: { columns: { name: { field: 'name' } }, limit: 10 },
    rows: [],
    options: { layout: 'grid' },
    expectError: { code: 'INVALID_FORM_INPUT', message: 'List layout must be table or card' },
  },
  {
    name: 'reject-columns-before-composition',
    note: 'columns that are not an object fail before the search declaration is composed.',
    spec: { columns: 5, search: { $ref: 'missing.yml' } },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid columns at list: expected an object' },
  },
  {
    name: 'reject-search-unresolved-ref',
    note: 'a search declaration with $ref is composed as validateList composes it.',
    spec: { columns: { name: { field: 'name' } }, search: { $ref: 'missing.yml' } },
    rows: [],
    options: { files: {} },
    expectError: { code: 'REF_FILE_NOT_FOUND', message: '$ref file not found: missing.yml' },
  },
  {
    name: 'search-composed',
    note: 'a search declaration with $ref and $patch is composed; the list model does not use search.',
    spec: {
      columns: { name: { field: 'name', label: 'Name' } },
      search: { $ref: 'search.yml', $patch: { remove: ['q'] } },
    },
    rows: [{ name: 'Ada' }],
    options: { language: 'en', files: { 'search.yml': { properties: { q: { type: 'text' }, r: { type: 'text' } } } } },
  },
  {
    name: 'reject-forbidden-key-in-composed-search',
    note: 'the scan reads the composed search declaration.',
    spec: { columns: { name: { field: 'name' } }, search: { $ref: 'search.yml' } },
    rows: [],
    options: { files: { 'search.yml': { properties: { q: { type: 'text', show_if: '.admin' } } } } },
    expectError: { code: 'FORBIDDEN_META_KEY', message: 'forbidden meta key "show_if" at search.q.show_if' },
  },
  {
    name: 'reject-forbidden-column-name',
    note: 'a forbidden key used as a column name fails the forbidden-key scan.',
    spec: { columns: { name: { field: 'name' }, display_switch: { field: 'x' } } },
    rows: [],
    expectError: { code: 'FORBIDDEN_META_KEY', message: 'forbidden meta key "display_switch" at columns.display_switch' },
  },
  {
    name: 'reject-forbidden-format-key',
    note: 'the forbidden-key scan reaches format settings that the declaration rules leave open.',
    spec: { columns: { name: { field: 'name', format: { type: 'badge', if: '.admin' } } } },
    rows: [],
    expectError: { code: 'FORBIDDEN_META_KEY', message: 'forbidden meta key "if" at columns.name.format.if' },
  },
  {
    name: 'reject-forbidden-patched-column-key',
    note: 'the scan reads the composed columns, including a patched column.',
    spec: { columns: { $ref: 'base.yml', $patch: { extra: { field: 'extra', when: '.admin' } } } },
    rows: [],
    options: { files: { 'base.yml': { properties: { name: { field: 'name' } } } } },
    expectError: { code: 'FORBIDDEN_META_KEY', message: 'forbidden meta key "when" at columns.extra.when' },
  },
  {
    name: 'reject-forbidden-root-key-before-unknown-key',
    note: 'the scan runs before the declaration rules.',
    spec: { limit: 10, columns: { name: { field: 'name' } }, xnote: 'n' },
    rows: [],
    expectError: { code: 'FORBIDDEN_META_KEY', message: 'forbidden meta key "xnote" at xnote' },
  },
  ...([
    ['reject-unknown-root-key', 'a list root member that the schema does not list is rejected.', { columns: { name: { field: 'name' } }, limit: 10 }, 'Invalid limit at list: unknown key'],
    ['reject-root-key-before-design', 'root members are checked before the own design.', { design: { color: 'red' }, columns: { name: { field: 'name' } }, limit: 10 }, 'Invalid limit at list: unknown key'],
    ['reject-root-ref', 'a root $ref beside the columns is not composed.', { columns: { name: { field: 'name' } }, $ref: 'base.yml' }, 'Invalid $ref at list: expected composition inside columns'],
    ['reject-root-patch', 'a root $patch is not composed.', { columns: { name: { field: 'name' } }, $patch: { empty: 'None' } }, 'Invalid $patch at list: expected composition inside columns'],
    ['reject-null-columns', 'columns are an object.', { columns: null }, 'Invalid columns at list: expected an object'],
    ['reject-array-columns', 'columns are an object.', { columns: [{ field: 'name' }] }, 'Invalid columns at list: expected an object'],
    ['reject-string-column', 'each column is an object.', { columns: { name: 'text' } }, 'Invalid name at columns: expected an object'],
    ['reject-null-column', 'a null column is not a column.', { columns: { name: null } }, 'Invalid name at columns: expected an object'],
    ['reject-column-unknown-key', 'a column member that the schema does not list is rejected.', { columns: { name: { field: 'name', width: 3 } } }, 'Invalid width at columns.name: unknown key'],
    ['reject-column-unknown-key-before-field', 'unknown column keys are checked before the member values.', { columns: { name: { field: 5, width: 3 } } }, 'Invalid width at columns.name: unknown key'],
    ['reject-column-field', 'the field path is a string.', { columns: { name: { field: 5 } } }, 'Invalid field at columns.name: expected a string'],
    ['reject-column-label', 'a label is content.', { columns: { name: { field: 'name', label: 5 } } }, 'Invalid label at columns.name: expected a string, a language map or null'],
    ['reject-column-label-empty-map', 'a language map has at least one member.', { columns: { name: { field: 'name', label: {} } } }, 'Invalid label at columns.name: expected a string, a language map or null'],
    ['reject-column-label-map-value', 'a language map holds strings or null.', { columns: { name: { field: 'name', label: { en: 5 } } } }, 'Invalid label at columns.name: expected a string, a language map or null'],
    ['reject-column-order', 'columns are checked in member order.', { columns: { first: { label: 5 }, second: { field: 5 } } }, 'Invalid label at columns.first: expected a string, a language map or null'],
    ['reject-format-array', 'a format is a boolean, a string or an object.', { columns: { name: { field: 'name', format: ['date'] } } }, 'Invalid format at columns.name: expected a boolean, a string or an object'],
    ['reject-format-null', 'a null format is not a format.', { columns: { name: { field: 'name', format: null } } }, 'Invalid format at columns.name: expected a boolean, a string or an object'],
    ['reject-format-type', 'the format type is a string.', { columns: { name: { field: 'name', format: { type: 5 } } } }, 'Invalid format.type at columns.name: expected a string'],
    ['reject-format-pattern', 'a date pattern is a string.', { columns: { name: { field: 'name', format: { type: 'date', pattern: 1 } } } }, 'Invalid format.pattern at columns.name: expected a string'],
    ['reject-format-target', 'a link target is a string.', { columns: { name: { field: 'name', format: { type: 'link', href: '/', target: 1 } } } }, 'Invalid format.target at columns.name: expected a string'],
    ['reject-format-as', 'a boolean display mode is a string.', { columns: { name: { field: 'name', format: { type: 'bool', as: true } } } }, 'Invalid format.as at columns.name: expected a string'],
    ['reject-format-prefix', 'a number prefix is content.', { columns: { name: { field: 'name', format: { type: 'number', prefix: 1 } } } }, 'Invalid format.prefix at columns.name: expected a string, a language map or null'],
    ['reject-format-true-label', 'a boolean label is content.', { columns: { name: { field: 'name', format: { type: 'bool', true: [] } } } }, 'Invalid format.true at columns.name: expected a string, a language map or null'],
    ['reject-format-map', 'a badge map is an object.', { columns: { name: { field: 'name', format: { type: 'badge', map: 'success' } } } }, 'Invalid format.map at columns.name: expected an object'],
    ['reject-format-map-label', 'each badge map label is content.', { columns: { name: { field: 'name', format: { type: 'badge', map: { active: 1 } } } } }, 'Invalid format.map.active at columns.name: expected a string, a language map or null'],
    ['reject-format-href', 'a link href is a string or a condition map.', { columns: { name: { field: 'name', format: { type: 'link', href: 1 } } } }, 'Invalid format.href at columns.name: expected a string or a condition map'],
    ['reject-format-href-empty-map', 'a condition map has at least one member.', { columns: { name: { field: 'name', format: { type: 'link', href: {} } } } }, 'Invalid format.href at columns.name: expected a string or a condition map'],
    ['reject-format-items', 'choice items are an array or an object.', { columns: { name: { field: 'name', format: { type: 'choice-label', items: 'A' } } } }, 'Invalid format.items at columns.name: expected an array or an object'],
    ['reject-format-items-choice-list', 'a choice list element has only value and label.', { columns: { name: { field: 'name', format: { type: 'choice-label', items: [{ value: 1, label: 'Yes', note: 'x' }] } } } }, 'Invalid format.items at columns.name: expected value and label pairs with distinct string or number values'],
    ['reject-format-items-choice-group', 'a choice list of the choice-label format has no groups.', { columns: { name: { field: 'name', format: { type: 'choice-label', items: [{ label: 'Europe', choices: [{ value: 'eu-west', label: 'West' }] }] } } } }, 'Invalid format.items at columns.name: expected value and label pairs with distinct string or number values'],
    ['reject-format-items-duplicate', 'choice list values are distinct.', { columns: { name: { field: 'name', format: { type: 'choice-label', items: [{ value: '0', label: 'No' }, { value: 0, label: 'Zero' }] } } } }, 'Invalid format.items at columns.name: expected value and label pairs with distinct string or number values'],
    ['reject-sortable', 'sortable is a boolean, an expression or a condition map.', { columns: { name: { field: 'name', sortable: 1 } } }, 'Invalid sortable at columns.name: expected a boolean, an expression or a condition map'],
    ['reject-sortable-empty-map', 'a sortable condition map has at least one member.', { columns: { name: { field: 'name', sortable: {} } } }, 'Invalid sortable at columns.name: expected a boolean, an expression or a condition map'],
    ['reject-design-before-sortable', 'a column design is checked before sortable.', { columns: { name: { field: 'name', sortable: 1, design: { show: 1 } } } }, 'Invalid design.show at columns.name: expected an expression, a boolean or a condition map'],
    ['reject-search', 'search is a boolean or an object.', { columns: { name: { field: 'name' } }, search: 'q' }, 'Invalid search at list: expected a boolean or an object'],
    ['reject-sort', 'sort is an object.', { columns: { name: { field: 'name' } }, sort: [] }, 'Invalid sort at list: expected an object'],
    ['reject-sort-unknown-key', 'sort holds field and dir.', { columns: { name: { field: 'name' } }, sort: { field: 'name', dir: 'asc', nulls: 'last' } }, 'Invalid sort.nulls at list: unknown key'],
    ['reject-sort-field', 'the sort field is a string.', { columns: { name: { field: 'name' } }, sort: { field: 5 } }, 'Invalid sort.field at list: expected a string'],
    ['reject-sort-dir', 'the sort direction is asc or desc.', { columns: { name: { field: 'name' } }, sort: { field: 'name', dir: 'sideways' } }, 'Invalid sort.dir at list: expected asc or desc'],
    ['reject-sort-before-pagination', 'sort is checked before pagination.', { columns: { name: { field: 'name' } }, pagination: 'pages', sort: { dir: 'up' } }, 'Invalid sort.dir at list: expected asc or desc'],
    ['reject-actions', 'actions are an object.', { columns: { name: { field: 'name' } }, actions: [] }, 'Invalid actions at list: expected an object'],
    ['reject-action-ref', 'actions are not composed.', { columns: { name: { field: 'name' } }, actions: { $ref: 'actions.yml' } }, 'Invalid $ref at actions: unknown key'],
    ['reject-action', 'an action is a script or an object.', { columns: { name: { field: 'name' } }, actions: { edit: 5 } }, 'Invalid edit at actions: expected a script or an object'],
    ['reject-action-unknown-key', 'an action object holds label, format, behavior and design.', { columns: { name: { field: 'name' } }, actions: { edit: { label: 'Edit', onclick: 'x()' } } }, 'Invalid onclick at actions.edit: unknown key'],
    ['reject-script-action-format', 'a script action holds label and script.', { columns: { name: { field: 'name' } }, actions: { edit: { script: 'x()', format: 'link' } } }, 'Invalid format at actions.edit: unknown key'],
    ['reject-script-action-script', 'an action script is a string.', { columns: { name: { field: 'name' } }, actions: { edit: { script: 1 } } }, 'Invalid script at actions.edit: expected a string'],
    ['reject-action-label', 'an action label is content.', { columns: { name: { field: 'name' } }, actions: { edit: { label: 1 } } }, 'Invalid label at actions.edit: expected a string, a language map or null'],
    ['reject-action-format', 'an action format follows the format rules.', { columns: { name: { field: 'name' } }, actions: { edit: { format: { type: 'link', href: 1 } } } }, 'Invalid format.href at actions.edit: expected a string or a condition map'],
    ['reject-action-behavior', 'behavior is a boolean or an object.', { columns: { name: { field: 'name' } }, actions: { edit: { behavior: 'x()' } } }, 'Invalid behavior at actions.edit: expected a boolean or an object'],
    ['reject-action-behavior-key', 'behavior holds onchange, onclick and onload.', { columns: { name: { field: 'name' } }, actions: { edit: { behavior: { onhover: 'x()' } } } }, 'Invalid behavior.onhover at actions.edit: unknown key'],
    ['reject-action-behavior-entry', 'a behavior entry is a script or an object.', { columns: { name: { field: 'name' } }, actions: { edit: { behavior: { onclick: 1 } } } }, 'Invalid behavior.onclick at actions.edit: expected a script or an object'],
    ['reject-action-behavior-entry-key', 'a behavior entry object holds label and script.', { columns: { name: { field: 'name' } }, actions: { edit: { behavior: { onclick: { script: 'x()', event: 'y' } } } } }, 'Invalid behavior.onclick.event at actions.edit: unknown key'],
    ['reject-action-behavior-label', 'a behavior entry label is content.', { columns: { name: { field: 'name' } }, actions: { edit: { behavior: { onclick: { label: 1, script: 'x()' } } } } }, 'Invalid behavior.onclick.label at actions.edit: expected a string, a language map or null'],
    ['reject-action-behavior-script', 'a behavior entry script is a string.', { columns: { name: { field: 'name' } }, actions: { edit: { behavior: { onclick: { script: 1 } } } } }, 'Invalid behavior.onclick.script at actions.edit: expected a string'],
    ['reject-action-design', 'an action design follows the design rules.', { columns: { name: { field: 'name' } }, actions: { edit: { design: { color: 'red' } } } }, 'Invalid design.color at actions.edit: unknown key'],
    ['reject-empty', 'the empty text is content.', { columns: { name: { field: 'name' } }, empty: 0 }, 'Invalid empty at list: expected a string, a language map or null'],
    ['reject-empty-before-pagination', 'empty is checked before pagination.', { columns: { name: { field: 'name' } }, pagination: 'pages', empty: 0 }, 'Invalid empty at list: expected a string, a language map or null'],
    ['reject-description', 'the description is content.', { columns: { name: { field: 'name' } }, description: 5 }, 'Invalid description at list: expected a string, a language map or null'],
    ['reject-description-language-map', 'a language map description holds strings or null.', { columns: { name: { field: 'name' } }, description: { en: 5 } }, 'Invalid description at list: expected a string, a language map or null'],
    ['reject-empty-before-description', 'empty is checked before the description.', { columns: { name: { field: 'name' } }, description: 5, empty: 0 }, 'Invalid empty at list: expected a string, a language map or null'],
    ['reject-description-before-pagination', 'the description is checked before pagination.', { columns: { name: { field: 'name' } }, pagination: 'pages', description: 5 }, 'Invalid description at list: expected a string, a language map or null'],
    ['reject-actions-before-description', 'actions are checked before the description.', { columns: { name: { field: 'name' } }, description: 5, actions: [] }, 'Invalid actions at list: expected an object'],
  ] as const).map(([name, note, spec, message]): ListFixtureCase => ({
    name,
    note,
    spec: spec,
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message },
  })),
  {
    name: 'layout-null-selects-table',
    note: 'a null layout selects the table layout, as an absent layout does.',
    spec: { columns: { name: { field: 'name', label: 'Name' } } },
    rows: PEOPLE,
    options: { language: 'en', layout: null },
  },  {
    name: 'field-path-dotted',
    note: 'a column field path reads the nested record value at the dotted path (CUDF-001).',
    spec: { columns: { company: { field: 'company.name', label: 'Company' } } },
    rows: [{ company: { name: 'Acme' } }],
    options: { language: 'en' },
  },
  {
    name: 'format-true-and-false-are-text',
    note: 'a format of true or false is the text display (CUDF-004).',
    spec: { columns: { name: { field: 'name', label: 'Name', format: true }, status: { field: 'status', label: 'Status', format: false } } },
    rows: [{ name: 'Ada', status: 'active' }],
    options: { language: 'en' },
  },
  {
    name: 'format-string-type-date',
    note: 'a format given as a string is that display type with no settings (CUDF-005): the date display.',
    spec: { columns: { joined: { field: 'joined', label: 'Joined', format: 'date' } } },
    rows: [{ joined: '2026-01-02' }],
    options: { language: 'en' },
  },
  {
    name: 'format-link-href-condition',
    note: 'an href condition map selects the link by the first true condition (CUDF-020).',
    spec: { columns: { name: { field: 'name', label: 'Name', format: { type: 'link', href: { 'name == "Ada"': '/ada', true: '/other' } } } } },
    rows: [{ name: 'Ada' }, { name: 'Lin' }],
    options: { language: 'en' },
  },
  {
    name: 'format-link-javascript-url',
    note: 'a javascript: href is replaced with a URL that throws (CUDF-023).',
    spec: { columns: { name: { field: 'name', label: 'Name', format: { type: 'link', href: 'javascript:alert(1)' } } } },
    rows: [{ name: 'Ada' }],
    options: { language: 'en' },
  },
  {
    name: 'reject-root-sort-before-pagination',
    note: 'root members are checked in member order: sort before pagination (CUDF-036).',
    spec: { sort: 1, pagination: 'x', columns: { name: { field: 'name' } } },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid sort at list: expected an object' },
  },
  {
    name: 'reject-column-unknown-key-before-format',
    note: 'a column checks its unknown keys in member order before its known members (CUDF-038).',
    spec: { columns: { name: { field: 'name', format: 1, color: 'x' } } },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid color at columns.name: unknown key' },
  },
  {
    name: 'reject-search-before-sort',
    note: 'a list checks search, sort, actions, empty, description and pagination in that order (CUDF-039).',
    spec: { search: 5, sort: 1, columns: { name: { field: 'name' } } },
    rows: [],
    expectError: { code: 'INVALID_FORM_INPUT', message: 'Invalid search at list: expected a boolean or an object' },
  },

];

function build(): ListFixtureCase[] {
  return SCENARIOS.map((c) => {
    if (c.expectError) {
      const { expected_html: _omit, ...rest } = c;
      void _omit;
      return rest;
    }
    // The cases are the JSON of every language, called as a JavaScript caller does (Reflect.apply): a case that renders may
    // still hold a value outside the TypeScript options, such as layout null, which renderList takes as the default.
    const html: unknown = Reflect.apply(renderList, undefined, [c.spec, c.rows, c.options ?? {}]);
    if (typeof html !== 'string') throw new Error(`renderList returned no HTML for ${c.name}`);
    const raw = withoutPreloadLinks(html);
    return { ...c, expected_html: normalizeHtml(raw) };
  });
}

const REQUIREMENTS: Record<string, readonly string[]> = {
  "basic-columns": ["CUDF-044", "CUDF-047", "CURP-001"],
  "format-date": ["CUDF-006", "CUDF-008", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-083"],
  "format-number": ["CUDF-003", "CUDF-006", "CUDF-009", "CUDF-016", "CUDF-018", "CUDF-019", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-050", "CUDF-083"],
  "format-number-shortest": ["CUDF-006", "CUDF-009", "CUDF-017", "CUDF-018", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-083"],
  "format-badge": ["CUDF-006", "CUDF-010", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-051", "CUDF-052", "CUDF-084"],
  "format-choice-label": ["CUDF-006", "CUDF-012", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-054", "CUDF-083"],
  "format-choice-label-choice-list": ["CUDF-006", "CUDF-012", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-054", "CUDF-055", "CUDF-083"],
  "format-link": ["CUDF-006", "CUDF-011", "CUDF-022", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-053", "CUDF-085"],
  "format-bool": ["CUDF-006", "CUDF-013", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-050", "CUDF-086"],
  "format-image": ["CUDF-006", "CUDF-014", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-050", "CUDF-087"],
  "format-html": ["CUDF-006", "CUDF-015", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-088"],
  "column-show-expr-hidden": ["CUDF-028", "CUDF-044", "CUDF-047"],
  "column-show-expr-visible": ["CUDF-028", "CUDF-044", "CUDF-047"],
  "column-show-map-without-selection": ["CUDF-028", "CUDF-044", "CUDF-047"],
  "column-show-literal-string": ["CUDF-028", "CUDF-044", "CUDF-047"],
  "i18n-header-ko": ["CUDF-044", "CUDF-047"],
  "i18n-header-en": ["CUDF-044", "CUDF-047"],
  "sort-display": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-056", "CUDF-058", "CUDF-059", "CUDF-060", "CUDF-061"],
  "sortable-map-without-selection": ["CUDF-028", "CUDF-044", "CUDF-047", "CUDF-056"],
  "pagination-display": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079", "CUDF-080", "CUDF-081", "CUDF-082"],
  "pagination-empty-first-page": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079"],
  "pagination-page-beyond-last": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079"],
  "pagination-middle-window": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079"],
  "pagination-largest-window": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079"],
  "pagination-without-total": ["CUDF-029", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079"],
  "pagination-page-without-total": ["CUDF-029", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079"],
  "design-column-class-style": ["CUDF-044", "CUDF-047"],
  "pagination-labels-ko": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079", "CUDF-080", "CUDF-081"],
  "pagination-labels-ja": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079", "CUDF-080", "CUDF-081"],
  "pagination-labels-zh": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079", "CUDF-080", "CUDF-081"],
  "pagination-labels-fr": ["CUDF-029", "CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079", "CUDF-080", "CUDF-081"],
  "empty-undeclared-ko": ["CUDF-044", "CUDF-047"],
  "empty-undeclared-en": ["CUDF-044", "CUDF-047"],
  "empty-undeclared-ja": ["CUDF-044", "CUDF-047"],
  "empty-undeclared-zh": ["CUDF-044", "CUDF-047"],
  "empty-declared-null": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-077"],
  "empty-declared-blank": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-077"],
  "empty-message": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-077"],
  "actions-toolbar": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-062", "CUDF-064", "CUDF-066", "CUDF-067", "CUDF-068", "CUDF-069"],
  "action-behavior-events": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-062", "CUDF-064", "CUDF-066", "CUDF-068", "CUDF-069", "CUDF-070", "CUDF-071", "CUDF-072", "CUDF-073", "CUDF-074", "CUDF-075"],
  "description-before-actions": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-062", "CUDF-064", "CUDF-066", "CUDF-068", "CUDF-069", "CUDF-078"],
  "description-card-without-actions": ["CUDF-031", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-078"],
  "description-empty-rows": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-078"],
  "description-empty-text": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-078"],
  "description-null": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-078"],
  "card-layout": ["CUDF-006", "CUDF-010", "CUDF-031", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-049", "CUDF-051", "CUDF-052", "CUDF-084"],
  "compose-ref-patch": ["CUDF-044"],
  "text-with-nul": ["CUDF-044", "CUDF-047"],
  "reject-pagination-null": ["CUDF-079"],
  "reject-pagination-string": ["CUDF-079"],
  "reject-pagination-unknown-key": ["CUDF-040", "CUDF-080"],
  "reject-pagination-per-page-zero": ["CUDF-081"],
  "reject-pagination-per-page-fraction": ["CUDF-081"],
  "reject-pagination-per-page-null": ["CUDF-081"],
  "reject-pagination-per-page-unsafe": ["CUDF-081"],
  "reject-pagination-mode-unknown": ["CUDF-082"],
  "reject-pagination-mode-empty": ["CUDF-082"],
  "pagination-declared-defaults": ["CUDF-030", "CUDF-040", "CUDF-044", "CUDF-047", "CUDF-079", "CUDF-080", "CUDF-082"],
  "reject-array-specification": ["CUDF-024"],
  "reject-string-specification": ["CUDF-024"],
  "reject-object-rows": ["CUDF-025"],
  "reject-scalar-row": ["CUDF-026"],
  "reject-array-row": ["CUDF-026"],
  "reject-array-context": ["CUDF-028"],
  "reject-context-before-page": ["CUDF-028"],
  "reject-string-page": ["CUDF-029"],
  "reject-zero-page": ["CUDF-029"],
  "reject-fractional-page": ["CUDF-029"],
  "reject-unsafe-page": ["CUDF-029"],
  "reject-negative-total": ["CUDF-030"],
  "reject-fractional-total": ["CUDF-030"],
  "reject-boolean-total": ["CUDF-030"],
  "reject-unknown-layout": ["CUDF-031"],
  "reject-number-layout": ["CUDF-031"],
  "reject-column-design-unknown-key": ["CUDF-044"],
  "reject-list-design-before-columns": ["CUDF-037", "CUDF-040"],
  "action-script-object": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-062", "CUDF-064", "CUDF-065", "CUDF-067", "CUDF-068"],
  "reject-missing-columns": ["CUDF-027"],
  "reject-rows-before-columns": ["CUDF-025"],
  "reject-columns-before-context": ["CUDF-027"],
  "reject-root-ref-without-columns": ["CUDF-027"],
  "reject-context-before-columns-shape": ["CUDF-028"],
  "reject-layout-before-composition": ["CUDF-031"],
  "reject-layout-before-declarations": ["CUDF-031"],
  "search-composed": ["CUDF-040", "CUDF-044", "CUDF-047", "CUDF-057"],
  "reject-unknown-root-key": ["CUDF-040"],
  "reject-root-key-before-design": ["CUDF-040"],
  "reject-root-ref": ["CUDF-042"],
  "reject-string-column": ["CUDF-043"],
  "reject-null-column": ["CUDF-043"],
  "reject-column-unknown-key": ["CUDF-044"],
  "reject-column-unknown-key-before-field": ["CUDF-044"],
  "reject-column-field": ["CUDF-046"],
  "reject-column-label": ["CUDF-047"],
  "reject-column-label-empty-map": ["CUDF-047"],
  "reject-column-label-map-value": ["CUDF-047"],
  "reject-column-order": ["CUDF-047"],
  "reject-format-array": ["CUDF-048"],
  "reject-format-null": ["CUDF-048"],
  "reject-format-type": ["CUDF-049"],
  "reject-format-pattern": ["CUDF-049"],
  "reject-format-target": ["CUDF-049"],
  "reject-format-as": ["CUDF-049"],
  "reject-format-prefix": ["CUDF-050"],
  "reject-format-true-label": ["CUDF-050"],
  "reject-format-map": ["CUDF-051"],
  "reject-format-map-label": ["CUDF-050", "CUDF-052"],
  "reject-format-href": ["CUDF-053"],
  "reject-format-href-empty-map": ["CUDF-053"],
  "reject-format-items": ["CUDF-054"],
  "reject-format-items-choice-list": ["CUDF-055"],
  "reject-format-items-choice-group": ["CUDF-055"],
  "reject-format-items-duplicate": ["CUDF-055"],
  "reject-sortable": ["CUDF-056"],
  "reject-sortable-empty-map": ["CUDF-056"],
  "reject-search": ["CUDF-057"],
  "reject-sort": ["CUDF-058"],
  "reject-sort-unknown-key": ["CUDF-040", "CUDF-059"],
  "reject-sort-field": ["CUDF-060"],
  "reject-sort-dir": ["CUDF-061"],
  "reject-sort-before-pagination": ["CUDF-061"],
  "reject-actions": ["CUDF-062"],
  "reject-action-ref": ["CUDF-063"],
  "reject-action": ["CUDF-064"],
  "reject-action-unknown-key": ["CUDF-065", "CUDF-066"],
  "reject-script-action-format": ["CUDF-065", "CUDF-066"],
  "reject-script-action-script": ["CUDF-067"],
  "reject-action-label": ["CUDF-047", "CUDF-068"],
  "reject-action-format": ["CUDF-053"],
  "reject-action-behavior": ["CUDF-070"],
  "reject-action-behavior-key": ["CUDF-065", "CUDF-066", "CUDF-071"],
  "reject-action-behavior-entry": ["CUDF-072"],
  "reject-action-behavior-entry-key": ["CUDF-065", "CUDF-066", "CUDF-071", "CUDF-073"],
  "reject-action-behavior-label": ["CUDF-074"],
  "reject-action-behavior-script": ["CUDF-075"],
  "reject-action-design": ["CUDF-065", "CUDF-066", "CUDF-076"],
  "reject-empty": ["CUDF-077"],
  "reject-empty-before-pagination": ["CUDF-077"],
  "reject-description": ["CUDF-078"],
  "reject-description-language-map": ["CUDF-078"],
  "reject-empty-before-description": ["CUDF-077"],
  "reject-description-before-pagination": ["CUDF-078"],
  "reject-actions-before-description": ["CUDF-062"],
  "layout-null-selects-table": ["CUDF-031", "CUDF-044", "CUDF-047"],
  "field-path-dotted": ["CUDF-001", "CUDF-044", "CUDF-047"],
  "format-true-and-false-are-text": ["CUDF-002", "CUDF-004", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-083"],
  "format-string-type-date": ["CUDF-002", "CUDF-005", "CUDF-008", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-083"],
  "format-link-href-condition": ["CUDF-002", "CUDF-011", "CUDF-020", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-053", "CUDF-085"],
  "format-link-javascript-url": ["CUDF-002", "CUDF-011", "CUDF-023", "CUDF-044", "CUDF-047", "CUDF-048", "CUDF-085"],
  "reject-root-sort-before-pagination": ["CUDF-036", "CUDF-058"],
  "reject-column-unknown-key-before-format": ["CUDF-038", "CUDF-044"],
  "reject-search-before-sort": ["CUDF-039", "CUDF-057"],
};

/** The requirement ids that each case tests (docs/spec); a case that tests none keeps no requirements member. */
function withRequirements<T extends { name: string; note: string }>(c: T): T & { requirements?: readonly string[] } {
  const ids = [...(REQUIREMENTS[c.name] ?? []), 'CURP-015'];
  return Object.assign({ name: c.name, note: c.note, requirements: ids }, c);
}
process.stdout.write(JSON.stringify(build().map(withRequirements), null, 2) + '\n');
