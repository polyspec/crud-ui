import type { JsonObject } from './protocol.mts';

/** One form instance scenario: the specification, the data and the actions applied in order. */
export interface FormScenario {
  name: string;
  spec: JsonObject;
  data: JsonObject;
  compileOptions?: JsonObject;
  options?: JsonObject;
  rejectAll?: boolean;
  actions: Array<{ method: string; args: unknown[] }>;
}

export const row = (sequence: number): string => `__${String(sequence).padStart(13, '0')}__`;
const five = row(5), seven = row(7), one = row(1), fortyTwo = row(42);
export const companySpec = {
  type: 'group',
  properties: {
    companies: {
      type: 'group', label: { en: 'Companies', ko: '회사' }, multiple: { copy: true, sortable: true, max: 4 },
      properties: {
        name: { type: 'text', label: 'Company name', default: 'New company' },
        stores: {
          type: 'group', label: 'Stores', multiple: { copy: true, sortable: true },
          properties: {
            name: { type: 'text', label: 'Store name', default: 'New store', prepend: 'Store' },
            active: { type: 'checkbox', label: 'Active' },
            memo: { type: 'textarea', label: 'Memo', design: { show: '.active', wrapper: { class: ".active ? 'enabled' : 'disabled'" } } },
            choices: { type: 'multichoice', items: { z: 'Z', a: 'A', q: 'Q' }, default: [] },
          },
        },
      },
    },
  },
};
export const companyData = {
  companies: {
    [five]: { name: 'Five', stores: { [five]: { name: 'Same key in nested scope', active: true, memo: '<five> & "quoted"', choices: ['q', 'z'] } } },
    [seven]: { name: 'Seven', stores: {} },
    [one]: { name: 'One', stores: { [fortyTwo]: { name: 'Forty two', active: false, memo: 'Hidden text', choices: [] } } },
  },
};
const displaySpec = {
  type: 'group', properties: {
    active: { type: 'checkbox', label: 'Active' },
    text: { type: 'text', label: 'Text "label"', description: 'Description \'one\'', default: 'default', design: { class: ".active ? 'active' : ''", style: { '.active': 'color: red; color: blue; --text: "a;b:c"; background: url("data:x;y:z")', true: '' }, wrapper: { style: { '.active': 'border:1px solid red', true: '' } } } },
    content: { type: 'textarea', label: 'Content' },
    languages: { type: 'text', lang: { only: ['en', 'ko'], title: 'Languages' } },
    choice: { type: 'choice', items: { z: 'Z', a: 'A' } },
    many: { type: 'multichoice', items: { z: 'Z', a: 'A', q: 'Q' } },
    hidden: { type: 'hidden' },
  },
};
const displayData = { active: true, text: 'One & "two"', content: '\n<content> \'quoted\'', languages: { en: 'English', ko: '한국어' }, choice: 'a', many: ['q', 'z'], hidden: '' };
const replacedDisplay = { active: false, text: '', content: '', languages: { en: '', ko: '' }, choice: 'z', many: [], hidden: null };

export const formScenarios: FormScenario[] = [
  {
    name: 'keyed-order-and-scoped-operations', spec: companySpec, data: companyData,
    compileOptions: { keyPrefix: 'form' }, options: { idPrefix: 'scope one', language: 'en' },
    actions: [
      { method: 'addRow', args: [`companies.${five}.stores`, { key: '__abc0123456789__', afterKey: five, value: { name: 'Added store', active: true, memo: 'Added', choices: ['a'] } }] },
      { method: 'setValue', args: [`companies.${five}.stores.__abc0123456789__.name`, 'Edited store'] },
      { method: 'rekeyRow', args: [`companies.${five}.stores`, '__abc0123456789__', fortyTwo] },
      { method: 'moveRow', args: ['companies', one, 0] },
      { method: 'removeRow', args: ['companies', seven] },
      { method: 'addRow', args: ['companies', { key: '__company00001__', afterKey: five, value: { name: 'Added company', stores: {} } }] },
      { method: 'setData', args: [companyData] },
      { method: 'setData', args: [companyData] },
    ],
  },
  {
    name: 'rejected-operations-preserve-state', spec: companySpec, data: companyData,
    compileOptions: { keyPrefix: 'form' }, options: { language: 'en' },
    rejectAll: true,
    actions: [
      { method: 'addRow', args: ['companies', { key: five }] },
      { method: 'addRow', args: ['companies', { key: '5' }] },
      { method: 'addRow', args: ['companies', { key: 'new_company', afterKey: 'unknown' }] },
      { method: 'moveRow', args: ['companies', five, 99] },
      { method: 'rekeyRow', args: ['companies', five, seven] },
      { method: 'removeRow', args: ['companies', 'unknown'] },
      { method: 'setValue', args: ['companies', []] },
      { method: 'setData', args: [{ companies: null }] },
      { method: 'setValue', args: ['__proto__.companies', {}] },
      { method: 'addRow', args: ['companies', { value: null, key: 'null_company' }] },
      { method: 'setValue', args: [`companies.${five}.stores`, []] },
      { method: 'setValue', args: [`companies.${five}.stores.${five}`, 'Store'] },
      { method: 'addRow', args: [`companies.${five}.stores`, { key: row(99), value: 'Store' }] },
    ],
  },
  {
    name: 'injection-clears-and-restores-control-and-style-state', spec: displaySpec, data: displayData,
    compileOptions: { keyPrefix: 'form' }, options: { idPrefix: 'form-one', language: 'en' },
    actions: [{ method: 'setData', args: [replacedDisplay] }, { method: 'setData', args: [displayData] }, { method: 'setData', args: [displayData] }],
  },
  {
    name: 'empty-scalar-collection-explicit-null-and-default',
    spec: { type: 'group', properties: { tags: { type: 'text', multiple: true, default: 'new' } } }, data: { tags: {} },
    actions: [{ method: 'addRow', args: ['tags', { key: 'explicit_null', value: null }] }, { method: 'removeRow', args: ['tags', 'explicit_null'] }, { method: 'addRow', args: ['tags', { key: 'default_row' }] }],
  },
  {
    name: 'collection-minimum-and-maximum',
    spec: { type: 'group', properties: { tags: { type: 'text', multiple: { min: 1, max: 2 }, default: '' } } }, data: { tags: { first: 'a' } },
    actions: [{ method: 'removeRow', args: ['tags', 'first'] }, { method: 'addRow', args: ['tags', { key: 'second' }] }, { method: 'addRow', args: ['tags', { key: 'third' }] }],
  },
  {
    name: 'explicit-empty-instance-prefix', spec: { type: 'group', properties: { name: { type: 'text' } } }, data: { name: 'Ada' },
    compileOptions: { keyPrefix: 'form' }, options: { keyPrefix: '' }, actions: [],
  },
  {
    name: 'explicit-null-does-not-apply-default',
    spec: { type: 'group', properties: { text: { type: 'text', default: 'default' }, display: { type: 'dummy', default: 'default' } } },
    data: { text: null, display: null }, actions: [],
  },
  {
    name: 'composition-removal-preserves-empty-object-default',
    spec: { type: 'group', properties: { value: { type: 'text', $patch: { 'default.x': 1, remove: ['default.x'] } } } },
    data: {}, actions: [{ method: 'setData', args: [{}] }],
  },
];

// docs/spec/schema.md and docs/spec/form-runtime.md: `multiple: only` rows come only from the data.
const onlySpec = {
  type: 'group',
  properties: {
    variants: {
      type: 'group', label: 'Variants', multiple: { only: true, title: 'name' },
      properties: { name: { type: 'text', label: 'Name' }, price: { type: 'number', label: 'Price' } },
    },
  },
};
const onlyRowOperations = [
  { method: 'addRow', args: ['variants', {}] },
  { method: 'addRow', args: ['variants', { key: '__opt_c3__', value: { name: 'Added', price: 3 } }] },
  { method: 'copyRow', args: ['variants', '__opt_b2__'] },
  { method: 'removeRow', args: ['variants', '__opt_a1__'] },
  { method: 'moveRow', args: ['variants', '__opt_a1__', 0] },
  { method: 'rekeyRow', args: ['variants', '__opt_b2__', '__opt_d4__'] },
];
formScenarios.push(
  {
    name: 'only-collection-rows-come-from-data', spec: onlySpec,
    data: { variants: { __opt_b2__: { name: 'Blue', price: 2 }, __opt_a1__: { name: 'Red', price: 1 } } },
    options: { language: 'en' }, rejectAll: true, actions: onlyRowOperations,
  },
  {
    name: 'only-collection-missing-data-has-no-rows', spec: onlySpec, data: {},
    options: { language: 'en' }, rejectAll: true, actions: onlyRowOperations.slice(0, 2),
  },
  {
    name: 'hidden-group-keeps-values',
    spec: { type: 'group', properties: {
      is_display: { type: 'text' },
      display: { type: 'group', design: { show: '.is_display == 1' }, properties: { code: { type: 'text' }, items: { type: 'text', multiple: true } } },
    } },
    data: { is_display: '1', display: { code: 'abc1', items: { __opt_a1__: 'row' } } },
    options: { language: 'en' },
    actions: [
      { method: 'setValue', args: ['is_display', '0'] },
      { method: 'setValue', args: ['display.code', 'kept'] },
      { method: 'setValue', args: ['is_display', '1'] },
    ],
  },
);

export const numberCases = [
  { value: 2.5, decimals: 0, expected: '3' },
  { value: -2.5, decimals: 0, expected: '-3' },
  { value: 1.005, decimals: 2, expected: '1.00' },
  { value: 2.675, decimals: 2, expected: '2.67' },
  { value: -0.001, decimals: 2, expected: '-0.00' },
  { value: -0, decimals: 2, expected: '0.00' },
  { value: 1e21, decimals: 2, expected: '1e+21' },
  { value: 1000000000000000128, decimals: 0, expected: '1000000000000000128' },
  { value: 1.25, decimals: 1, expected: '1.3' },
  { value: 1e-7, expected: '1e-7' },
  { value: '0x10', decimals: 2, expected: '16.00' },
  { value: '0b101', expected: '5' },
  { value: '0o17', expected: '15' },
  { value: '0xbeddbd88a491d408d0415072f52b9a13fda', expected: '1.0391742914815888e+42' },
  { value: '\ufeff\u00a0 1.25\u2028', expected: '1.25' },
  { value: 1.25, decimals: '1', expected: '1.25' },
  { value: 2.5, decimals: -0.5, expected: '3' },
];

export const imageCase = {
  name: 'image-preload-order-deduplication-and-raw-content',
  spec: { columns: { image: { field: 'image', format: 'image' }, raw: { field: 'raw', format: 'html' } } },
  rows: [{ image: '/b.png', raw: '<img src="/raw.png">' }, { image: '/a.png' }, { image: '/b.png' }, { image: 'data:image/png;base64,AA==' }],
};
export const urlCase = {
  name: 'ordinary-javascript-url-rejection',
  spec: { columns: { link: { field: 'name', format: { type: 'link', href: ' \u0000JaVaScRiPt:alert(1)', text: 'Open' } }, image: { field: 'url', format: 'image' } } },
  rows: [{ name: 'One', url: 'j\na\tv\rascript:alert(1)' }],
};

const widgetKinds = ['text', 'email', 'number', 'password', 'textarea', 'select', 'hidden', 'choice', 'multichoice', 'date', 'datetime', 'dummy', 'dummy-input', 'image', 'file', 'cover', 'image-viewer', 'search', 'tinymce', 'summernote', 'editorjs', 'tui', 'button', 'tagify', 'tagify2'];
const widgetProperties: Record<string, JsonObject> = {}, widgetData: JsonObject = {};
for (const kind of widgetKinds) {
  widgetProperties[kind] = { type: kind, label: `${kind} "label"`, description: 'Description', items: { z: 'Z "label"', a: 'A' }, prepend: 'Before', append: 'After', design: { class: 'custom', style: 'color:red; color:blue; --content:"a;b:c"', prepend: { style: 'color:red; color:blue' } } };
  widgetData[kind] = kind === 'multichoice' ? ['z', 'a'] : kind === 'image-viewer' ? ['/one.png', '/two.png'] : kind === 'date' ? '2026-09-09' : kind === 'datetime' ? '2026-09-09T12:34:56' : 'z';
}
formScenarios.push({ name: 'all-widget-layouts-original-html', spec: { type: 'group', properties: widgetProperties }, data: widgetData, options: { idPrefix: 'all-controls', language: 'en' }, actions: [{ method: 'setData', args: [widgetData] }] });
const behaviorProperties: Record<string, JsonObject> = {}, behaviorData: JsonObject = {};
for (const kind of ['text', 'textarea', 'date', 'datetime', 'choice', 'multichoice', 'select', 'file', 'tinymce', 'tagify', 'search']) {
  behaviorProperties[kind] = { ...widgetProperties[kind], behavior: { onchange: "window.changed('value');" } };
  behaviorData[kind] = widgetData[kind];
}
formScenarios.push({ name: 'opaque-behavior-keeps-original-control-attributes', spec: { type: 'group', properties: behaviorProperties }, data: behaviorData, options: { idPrefix: 'behavior', language: 'en' }, actions: [] });

formScenarios.push({
  name: 'repeated-and-language-controls-retain-behavior',
  spec: { type: 'group', properties: {
    dates: { type: 'datetime', multiple: true, behavior: { onchange: 'window.changed();' } },
    editors: { type: 'tinymce', multiple: true, behavior: { onchange: 'window.changed();' } },
    translated: { type: 'datetime', lang: { only: ['en', 'ko'] }, behavior: { onchange: 'window.changed();' } },
  } },
  data: { dates: { date_row: '2026-09-09T12:00:00' }, editors: { editor_row: 'Text' }, translated: { en: '2026-09-09T12:00:00', ko: '2026-09-09T12:00:00' } },
  actions: [],
});

export const dateCases = [
  { value: '2026-09-09', date: '2026-09-09', datetime: '2026-09-09T00:00:00' },
  { value: '2026-09-09T01:02', date: '2026-09-09', datetime: '2026-09-09T01:02:00' },
  { value: '2026-09-09 01:02:03.987654321123', date: '2026-09-09', datetime: '2026-09-09T01:02:03' },
  { value: '2026-09-09T01:02:03Z', date: '2026-09-09', datetime: '2026-09-09T01:02:03' },
  { value: '2026-09-09T00:30:00+09:00', date: '2026-09-08', datetime: '2026-09-08T15:30:00' },
  { value: '2026-12-31T23:30:00-02:30', date: '2027-01-01', datetime: '2027-01-01T02:00:00' },
  { value: 'Wed, 09 Sep 2026 01:02:03 +0900', date: '2026-09-08', datetime: '2026-09-08T16:02:03' },
  { value: '9 sep 2026 01:02 GMT', date: '2026-09-09', datetime: '2026-09-09T01:02:00' },
  { value: 'Wed, 09 Sep 2026 01:02:03 est', date: '2026-09-09', datetime: '2026-09-09T06:02:03' },
  { value: '0000-01-01T00:00:00+01:00', date: '-0001-12-31', datetime: '-0001-12-31T23:00:00' },
  { value: '9999-12-31T23:30:00-01:00', date: '10000-01-01', datetime: '10000-01-01T00:30:00' },
  { value: '2024-02-29T23:59:59.999999999Z', date: '2024-02-29', datetime: '2024-02-29T23:59:59' },
  ...[
    '2026-02-30', '2026-02-30T12:00:00Z', '2026-09-09T24:00',
    '2026-09-09T23:60:00', '2026-09-09T23:59:60Z',
    '2026-09-09T01:02:03+24:00', '2026-09-09T01:02:03+09:60',
    '2026-09-09T01:02:03+09:00:01', '2026-09-09T01:02:03Z trailing',
    'Tue, 09 Sep 2026 01:02:03 +0000', 'Wed, 09 Sep 2026 01:02:03',
    'Wed, 09 Sep 26 01:02:03 GMT', 'Wed, 09 Sep 2026 01:02:03 CET',
    'yesterday', '2026/09/09', ' 2026-09-09',
  ].map(value => ({ value, date: value, datetime: value })),
];
export const dateFormSpec: { type: string; properties: Record<string, JsonObject> } = { type: 'group', properties: {} };
export const dateFormData: Record<string, string> = {};
for (const [index, item] of dateCases.entries()) {
  dateFormSpec.properties[`date${index}`] = { type: 'date' };
  dateFormSpec.properties[`datetime${index}`] = { type: 'datetime' };
  dateFormData[`date${index}`] = dateFormData[`datetime${index}`] = item.value;
}
export const dateListSpec = { columns: { value: { field: 'value', format: { type: 'date', pattern: 'YYYY-MM-DD HH:mm:ss' } } } };
