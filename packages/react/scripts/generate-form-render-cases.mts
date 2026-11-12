/**
 * Generates tests/fixtures/form-render/cases.json, the shared form rendering cases of the React,
 * Vue and Svelte generators. Runs the React CRUDUI generator (the reference) over the scenarios of
 * scenario-form-render-cases.ts and the widget cases below and normalizes its output through the
 * shared normalizer; the cases of written-form-render-cases.ts carry `expected_html` written from
 * the specification. The cases follow the scenarios, then the widget and written cases, each in
 * source order; a widget or written case takes the place of the scenario of the same name. The
 * three-framework comparison then verifies that every generator reproduces the same normalized
 * output.
 *
 * Run: node_modules/.bin/tsx packages/react/scripts/generate-form-render-cases.mts
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ComposeLoadError, compileForm, type BindFormOptions, type CompileFormOptions } from '@polyspec/crudui-generator-core';
import { renderFields } from '../src/internal/renderFields';
import { normalizeHtml } from '../../../legacy/tests/fixtures/form-render/normalize.mts';
import { SCENARIOS } from './scenario-form-render-cases';
import { WRITTEN_CASES } from './written-form-render-cases';
import { GROUP_SOURCE_CASES, GROUP_SOURCE_REQUIREMENTS } from './group-source-form-render-cases';
import { CONDITION_EDITOR_CASES, CONDITION_EDITOR_REQUIREMENTS } from './condition-editor-form-render-cases';

const __dirname = dirname(fileURLToPath(import.meta.url));
const casesPath = resolve(__dirname, '../../../legacy/tests/fixtures/form-render/cases.json');

interface FixtureCase {
  name: string;
  note: string;
  spec: Record<string, unknown>;
  data?: Record<string, unknown>;
  /** The typed options of a scenario, or the options object of a widget or written case. */
  options?: BindFormOptions & CompileFormOptions | Record<string, unknown>;
  expected_html?: string;
  expectError?: { code: string; message: string };
}

/** Wrap a single field spec in a root group (matches the fixture shape). */
function group(field: Record<string, unknown>): Record<string, unknown> {
  const [first] = Object.entries(field);
  if (!first) throw new Error('a field spec names one field');
  const [name, spec] = first;
  return { type: 'group', properties: { [name]: spec } };
}

// Declare a case with an automatically computed expected_html value.
function pass(
  name: string,
  note: string,
  spec: Record<string, unknown>,
  data?: Record<string, unknown>,
  options?: Record<string, unknown>
): FixtureCase {
  const html = renderFields(compileForm(spec, options), { ...options, ...(data === undefined ? {} : { data }) });
  return {
    name,
    note,
    spec,
    ...(data ? { data } : {}),
    ...(options ? { options } : {}),
    expected_html: normalizeHtml(html),
  };
}

/**
 * The error that rendering a case throws, with its code and message; a render that throws nothing, or an error without a
 * string code, fails. The code is read from the error, not by its class: the generator package and the React renderer can
 * load separate copies of the class UnsupportedFieldTypeError.
 */
function thrownError(name: string, render: () => unknown): { error: Error; code: string; message: string } {
  let threw = false;
  let thrown: unknown;
  try {
    render();
  } catch (e) {
    threw = true;
    thrown = e;
  }
  if (!threw) throw new Error(`${name}: expected an error, but the case rendered`);
  if (thrown instanceof Error && 'code' in thrown && typeof thrown.code === 'string') {
    return { error: thrown, code: thrown.code, message: thrown.message };
  }
  throw new Error(`${name}: expected an error with a string code, got ${String(thrown)}`);
}

/** Fail unless the thrown error has the recorded code and message. */
function requireError(name: string, expected: { code: string; message: string }, actual: { code: string; message: string }): void {
  if (actual.code !== expected.code || actual.message !== expected.message) {
    throw new Error(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify({ code: actual.code, message: actual.message })}`);
  }
}

// Declare an expected-error case without expected_html, after the render throws the recorded code and message.
function err(name: string, note: string, spec: Record<string, unknown>, code: string, message: string): FixtureCase {
  const thrown = thrownError(name, () => renderFields(compileForm(spec), {}));
  requireError(name, { code, message }, thrown);
  return { name, note, spec, expectError: { code, message } };
}

const G = (props: Record<string, unknown>) => ({ type: 'group', properties: props });

const NEW: FixtureCase[] = [
  // ---- A. REGRESSION — explicit per-type minimal cases (registered emitters) --
  pass('password-bare', 'password → BARE input (no input-group), no behavior, value not default-filled.',
    G({ pw: { type: 'password', label: { ko: '비밀번호' } } }), {}, { language: 'ko' }),
  pass('password-with-data', 'password with data → value rendered (no input-group).',
    G({ pw: { type: 'password', label: { ko: '비밀번호' } } }), { pw: 'secret' }, { language: 'ko' }),
  pass('textarea-rows5', 'textarea → rows=5, input-group envelope.',
    G({ memo: { type: 'textarea', label: { ko: '메모' } } }), {}, { language: 'ko' }),
  pass('textarea-with-data', 'textarea with data → escaped text content.',
    G({ memo: { type: 'textarea', label: { ko: '메모' } } }), { memo: 'a<b>c' }, { language: 'ko' }),
  pass('integer-alias', 'integer alias → type=number input.',
    G({ qty: { type: 'integer', label: { ko: '수량' } } }), {}, { language: 'ko' }),
  pass('float-alias', 'float alias → type=number input.',
    G({ rate: { type: 'float', label: { ko: '비율' } } }), { rate: 1.5 }, { language: 'ko' }),
  pass('decimal-alias', 'decimal alias → type=number input.',
    G({ amt: { type: 'decimal', label: { ko: '금액' } } }), {}, { language: 'ko' }),
  pass('string-alias', 'string alias → type=text input.',
    G({ nm: { type: 'string', label: { ko: '이름' } } }), { nm: 'x' }, { language: 'ko' }),
  pass('dropdown-alias', 'dropdown alias → select with static items.',
    G({ sel: { type: 'dropdown', label: { ko: '선택' }, items: { a: { ko: '가' }, b: { ko: '나' } } } }),
    { sel: 'b' }, { language: 'ko' }),
  pass('hidden-no-label', 'hidden → bare input, label omitted by renderer.',
    G({ tok: { type: 'hidden', label: { ko: '토큰' }, default: 'd' } }), {}, { language: 'ko' }),
  pass('select-with-data', 'select static items + selected value.',
    G({ s: { type: 'select', label: { ko: '선택' }, items: { x: { ko: '엑스' }, y: { ko: '와이' } } } }),
    { s: 'y' }, { language: 'ko' }),
  pass('email-bare', 'email → minimal input-group leaf (data-attr trio), no value.',
    G({ em: { type: 'email', label: { ko: '이메일' } } }), {}, { language: 'ko' }),
  pass('email-with-data', 'email with value → value rendered verbatim.',
    G({ em: { type: 'email', label: { ko: '이메일' } } }), { em: 'a@b.com' }, { language: 'ko' }),
  pass('checkbox-bare', 'checkbox → input with its own caption label in the node body, value=1, no value.',
    G({ agree: { type: 'checkbox', label: { ko: '동의' } } }), {}, { language: 'ko' }),
  pass('checkbox-with-data', 'checkbox with value 1 renders checked.',
    G({ agree: { type: 'checkbox', label: { ko: '동의' } } }), { agree: 1 }, { language: 'ko' }),
  pass('switcher-bare', 'switcher → a checkbox input with role=switch and the switch class, its caption in the node body, no value.',
    G({ on: { type: 'switcher', label: { ko: '켜기' } } }), {}, { language: 'ko' }),

  // ---- B. NEW WIDGETS — empty + with-data (high-freq first) ------------------
  pass('choice-empty', 'choice/radio btn-group, no value → no checked, data-attr trio per input.',
    G({ c: { type: 'choice', label: { ko: '선택' }, items: { a: { ko: '가' }, b: { ko: '나' } } } }),
    {}, { language: 'ko' }),
  pass('choice-with-data', 'choice with value → checked on matching radio; data-is-default on default.',
    G({ c: { type: 'choice', label: { ko: '선택' }, default: 'a', items: { a: { ko: '가' }, b: { ko: '나' } } } }),
    { c: 'b' }, { language: 'ko' }),
  pass('radio-alias', 'radio alias → choice markup.',
    G({ r: { type: 'radio', label: { ko: '라디오' }, items: { y: { ko: '예' }, n: { ko: '아니오' } } } }),
    { r: 'y' }, { language: 'ko' }),
  pass('multichoice-empty', 'multichoice/checkboxes btn-group, no value.',
    G({ m: { type: 'multichoice', label: { ko: '복수' }, items: { a: { ko: '가' }, b: { ko: '나' } } } }),
    {}, { language: 'ko' }),
  pass('multichoice-with-data', 'multichoice with array value → checked on selected.',
    G({ m: { type: 'multichoice', label: { ko: '복수' }, items: { a: { ko: '가' }, b: { ko: '나' }, c: { ko: '다' } } } }),
    { m: ['a', 'c'] }, { language: 'ko' }),
  pass('checkboxes-alias', 'checkboxes alias → multichoice markup.',
    G({ cb: { type: 'checkboxes', label: { ko: '체크' }, items: { x: { ko: '엑스' } } } }),
    { cb: ['x'] }, { language: 'ko' }),
  pass('dummy-empty', 'dummy display div, no value → empty.',
    G({ d: { type: 'dummy', label: { ko: '더미' } } }), {}, { language: 'ko' }),
  pass('dummy-with-data', 'dummy with value → div text (nl2br applied).',
    G({ d: { type: 'dummy', label: { ko: '더미' } } }), { d: 'hello' }, { language: 'ko' }),
  pass('dummy-items-lookup', 'dummy with items map → value looked up to label.',
    G({ d: { type: 'dummy', label: { ko: '더미' }, items: { a: '가', b: '나' } } }), { d: 'b' }, { language: 'ko' }),
  pass('html-alias', 'html alias → dummy markup.',
    G({ h: { type: 'html', label: { ko: 'HTML' } } }), { h: 'raw' }, { language: 'ko' }),
  pass('static-alias', 'static alias → dummy markup.',
    G({ st: { type: 'static', label: { ko: '정적' } } }), { st: 'txt' }, { language: 'ko' }),
  pass('dummy-input-empty', 'dummy-input always-readonly, form-control base (no rule trio).',
    G({ di: { type: 'dummy-input', label: { ko: '읽기' } } }), {}, { language: 'ko' }),
  pass('dummy-input-with-data', 'dummy-input with value, readonly.',
    G({ di: { type: 'dummy-input', label: { ko: '읽기' } } }), { di: 'ro' }, { language: 'ko' }),
  pass('date-empty', 'date input-group, no value.',
    G({ dt: { type: 'date', label: { ko: '날짜' } } }), {}, { language: 'ko' }),
  pass('date-with-data', 'date with YYYY-MM-DD value passthrough.',
    G({ dt: { type: 'date', label: { ko: '날짜' } } }), { dt: '2026-06-14' }, { language: 'ko' }),
  pass('datetime-empty', 'datetime-local BARE input (no input-group), no value.',
    G({ dtm: { type: 'datetime', label: { ko: '일시' } } }), {}, { language: 'ko' }),
  pass('datetime-with-data', 'datetime-local with value normalized to :00 seconds.',
    G({ dtm: { type: 'datetime', label: { ko: '일시' } } }), { dtm: '2026-06-14T10:30' }, { language: 'ko' }),
  pass('datetime-local-alias', 'datetime-local alias → datetime markup.',
    G({ dl: { type: 'datetime-local', label: { ko: '일시' } } }), { dl: '2026-06-14T10:30:45' }, { language: 'ko' }),
  pass('image-empty', 'image two-input file widget, empty-data branch.',
    G({ img: { type: 'image', label: { ko: '이미지' } } }), {}, { language: 'ko' }),
  pass('image-options', 'image with options size constraints + accept → data-* attrs.',
    G({ img: { type: 'image', label: { ko: '이미지' },
      options: { max_width: 800, min_width: 100, preview_max_width: 200 } } }), {}, { language: 'ko' }),
  pass('button-empty', 'button → a button element with the content text, no script and no hidden input.',
    G({ b: { type: 'button', label: { ko: '버튼' }, content: { ko: '실행' } } }), {}, { language: 'ko' }),
  pass('action-alias', 'action alias → the button element with the onclick behavior attribute.',
    G({ a: { type: 'action', label: { ko: '액션' }, content: { ko: '저장' }, behavior: { onclick: 'doSave()' } } }),
    {}, { language: 'ko' }),
  pass('search-empty', 'search/autocomplete select2 host, no items → placeholder option.',
    G({ sc: { type: 'search', label: { ko: '검색' } } }), {}, { language: 'ko' }),
  pass('search-static-items', 'search with static items → options built.',
    G({ sc: { type: 'search', label: { ko: '검색' }, items: { a: { ko: '가' }, b: { ko: '나' } } } }),
    { sc: 'a' }, { language: 'ko' }),
  pass('autocomplete-alias', 'autocomplete alias → search markup.',
    G({ ac: { type: 'autocomplete', label: { ko: '자동' } } }), {}, { language: 'ko' }),
  pass('tinymce-empty', 'tinymce textarea + init script, defaults rows=3 height=300.',
    G({ tm: { type: 'tinymce', label: { ko: '에디터' } } }), {}, { language: 'ko' }),
  pass('tinymce-options', 'tinymce with options height/rows/fileserver.',
    G({ tm: { type: 'tinymce', label: { ko: '에디터' }, options: { height: 500, rows: 10, fileserver: 'cdn' } } }),
    { tm: '<p>x</p>' }, { language: 'ko' }),
  pass('wysiwyg-alias', 'wysiwyg alias → tinymce markup.',
    G({ wy: { type: 'wysiwyg', label: { ko: '위지윅' } } }), {}, { language: 'ko' }),

  // freq-0 family reps
  pass('file-empty', 'file widget empty-data branch (image family).',
    G({ f: { type: 'file', label: { ko: '파일' } } }), {}, { language: 'ko' }),
  pass('cover-empty', 'cover empty-data branch (single file input).',
    G({ cv: { type: 'cover', label: { ko: '커버' } } }), {}, { language: 'ko' }),
  pass('cover-simple-alias', 'cover-simple alias → cover markup.',
    G({ cs: { type: 'cover-simple', label: { ko: '커버심플' } } }), {}, { language: 'ko' }),
  pass('image-viewer-empty', 'image-viewer no value → Korean empty literal kept verbatim.',
    G({ iv: { type: 'image-viewer', label: { ko: '뷰어' } } }), {}, { language: 'ko' }),
  pass('image-viewer-with-data', 'image-viewer array value → img per row + options.height.',
    G({ iv: { type: 'image-viewer', label: { ko: '뷰어' }, options: { height: 120 } } }),
    { iv: ['/a.png', '/b.png'] }, { language: 'ko' }),
  pass('selectbox-alias', 'selectbox → select variant (reuses select emitter).',
    G({ sb: { type: 'selectbox', label: { ko: '셀렉트박스' }, items: { a: { ko: '가' } } } }),
    { sb: 'a' }, { language: 'ko' }),
  pass('checkcontainer-alias', 'checkcontainer → multichoice variant.',
    G({ cc: { type: 'checkcontainer', label: { ko: '컨테이너' }, items: { a: { ko: '가' } } } }),
    { cc: ['a'] }, { language: 'ko' }),
  pass('summernote-empty', 'summernote textarea + init script, rows=5.',
    G({ sn: { type: 'summernote', label: { ko: '서머노트' } } }), {}, { language: 'ko' }),
  pass('editorjs-empty', 'editorjs host textarea + init script.',
    G({ ej: { type: 'editorjs', label: { ko: '에디터JS' } } }), {}, { language: 'ko' }),
  pass('tui-empty', 'tui host textarea + init script.',
    G({ tu: { type: 'tui', label: { ko: 'TUI' } } }), {}, { language: 'ko' }),
  pass('tagify-empty', 'tagify text host + init script.',
    G({ tg: { type: 'tagify', label: { ko: '태그' } } }), {}, { language: 'ko' }),
  pass('tagify2-server', 'tagify2 with options.server (ajax variant).',
    G({ tg2: { type: 'tagify2', label: { ko: '태그2' }, options: { server: '/api/tags', max_tags: 5 } } }),
    {}, { language: 'ko' }),

  // ---- C. DESIGN-SLOT coverage per widget ------------------------------------
  pass('choice-design-label-class', 'design.main.class → choice per-item LABEL class.',
    G({ c: { type: 'choice', label: { ko: '선택' }, items: { a: { ko: '가' } },
      design: { class: 'btn-lg' } } }), { c: 'a' }, { language: 'ko' }),
  pass('tinymce-design-class', 'design.main.class → tinymce textarea class.',
    G({ tm: { type: 'tinymce', label: { ko: '에디터' }, design: { class: 'tall' } } }), {}, { language: 'ko' }),
  pass('image-design-class', 'design.main.class → image file-input class.',
    G({ img: { type: 'image', label: { ko: '이미지' }, design: { class: 'big-file' } } }), {}, { language: 'ko' }),
  pass('date-design-prepend', 'date design.prepend.class + prepend content.',
    G({ dt: { type: 'date', label: { ko: '날짜' }, prepend: { ko: '📅' }, design: { prepend: { class: 'pre' } } } }),
    {}, { language: 'ko' }),
  pass('choice-design-show-false', 'design.show:false → node hidden attribute; choice inner present.',
    G({ c: { type: 'choice', label: { ko: '선택' }, items: { a: { ko: '가' } }, design: { show: false } } }),
    {}, { language: 'ko' }),

  // ---- D. DYNAMIC ITEMS STUB -------------------------------------------------
  pass('select-dynamic-stub', 'select dynamic items {model} → placeholder option + data-source-*, NO fabricated options.',
    G({ s: { type: 'select', label: { ko: '선택' },
      items: { model: 'User', method: 'getList', table: 'users', relations: ['role'] } } }), {}, { language: 'ko' }),
  pass('choice-dynamic-stub', 'choice dynamic items {model} → empty btn-group + dynamic-items comment.',
    G({ c: { type: 'choice', label: { ko: '선택' },
      items: { model: 'Cat', table: 'cats' } } }), {}, { language: 'ko' }),
  pass('multichoice-dynamic-stub', 'multichoice dynamic items {model} → empty btn-group + comment.',
    G({ m: { type: 'multichoice', label: { ko: '복수' },
      items: { model: 'Tag', table: 'tags' } } }), {}, { language: 'ko' }),
  pass('text-float-value', 'a float control value is written as its canonical text, the shortest text of its double.',
    G({ ratio: { type: 'text', label: 'Ratio' } }), { ratio: 0.30000000000000004 }, { language: 'en' }),
  pass('search-dynamic-stub', 'search dynamic items {model} → keeps placeholder option + data-source-*.',
    G({ sc: { type: 'search', label: { ko: '검색' },
      items: { model: 'Doc', method: 'find', table: 'docs', relations: [] } } }), {}, { language: 'ko' }),
  pass('search-dynamic-relations-numbers', 'search dynamic items whose relations hold numbers → data-source-relations writes each number as Number.prototype.toString does: the shortest round trip, the exponent form from 1e21 and below 1e-6, and the digits of an integer beyond 64 bits.',
    G({ sc: { type: 'search', label: { ko: '검색' },
      items: { model: 'Doc', method: 'find', table: 'docs', relations: [
        0.30000000000000004, 1e21, 1e-7, 100000000000000000000, 1.7976931348623157e308, 5e-324, -2.5e-8, { weight: 1.5e-7 },
      ] } } }), {}, { language: 'ko' }),
  pass('search-dynamic-relations-text', 'search dynamic items whose relations hold <, & and U+2028 in strings → data-source-relations writes them as JSON.stringify does, unescaped, and the attribute escapes them.',
    G({ sc: { type: 'search', label: { ko: '검색' },
      items: { model: 'Doc', method: 'find', table: 'docs', relations: ['a<b', 'x&y', 'line\u2028end', { 'q<': '<&>' }] } } }), {}, { language: 'ko' }),
  pass('select-dynamic-relations-object', 'an empty object of relations is written as its JSON text {}, not [].',
    G({ s: { type: 'select', label: 'Pick', items: { model: 'User', relations: {} } } }), {}, { language: 'en' }),
  pass('select-dynamic-relations-text', 'an empty string of relations is written as its JSON text "", not [].',
    G({ s: { type: 'select', label: 'Pick', items: { model: 'User', relations: '' } } }), {}, { language: 'en' }),

  // ---- D2. EMPTY SELECT PLACEHOLDER (CUSC-080) -------------------------------
  pass('select-no-items-placeholder', 'select without items → one option, value "" and text select, untranslated in English; the field value selects nothing.',
    G({ s: { type: 'select', label: 'Pick' } }), { s: 'x' }, { language: 'en' }),
  pass('select-empty-array-placeholder', 'select with an empty items array → the placeholder option.',
    G({ s: { type: 'select', label: { ko: '선택' }, items: [] } }), {}, { language: 'ko' }),
  pass('dropdown-empty-map-placeholder', 'dropdown with an empty items map → the placeholder option.',
    G({ d: { type: 'dropdown', label: 'Size', items: {} } }), {}, { language: 'en' }),
  pass('selectbox-one-choice-no-placeholder', 'selectbox with one choice → that option and no placeholder option.',
    G({ s: { type: 'selectbox', label: 'One', items: { a: 'A' } } }), {}, { language: 'en' }),

  // ---- E. FALLBACK SURFACING -------------------------------------------------
  err('unsupported-type-throws', 'unregistered type under default throw → UnsupportedFieldTypeError.',
    G({ x: { type: 'totally-unknown-widget', label: { ko: '미지원' } } }), 'UNSUPPORTED_FIELD_TYPE',
    'Unsupported field type "totally-unknown-widget" at "x"'),
  pass('unsupported-type-marker', 'options.unsupported:marker → data-unsupported-type div + HTML comment.',
    G({ x: { type: 'totally-unknown-widget', label: { ko: '미지원' } } }), {}, { unsupported: 'marker', language: 'ko' }),

  // ---- F. BEHAVIOR PASSTHROUGH per widget ------------------------------------
  pass('choice-behavior-passthrough', 'choice behavior onchange/onclick → verbatim attrs on each input (no minify, no eval).',
    G({ c: { type: 'choice', label: { ko: '선택' }, items: { a: { ko: '가' }, b: { ko: '나' } },
      behavior: { onchange: 'onCh(this)', onclick: 'onCl(this)' } } }), { c: 'a' }, { language: 'ko' }),
  pass('datetime-behavior-passthrough', 'datetime behavior onchange → verbatim onchange attr.',
    G({ dtm: { type: 'datetime', label: { ko: '일시' }, behavior: { onchange: 'dtChange()' } } }),
    {}, { language: 'ko' }),
  pass('button-behavior-onclick', 'button behavior onclick → an onclick attribute on the button element, verbatim.',
    G({ b: { type: 'button', label: { ko: '버튼' }, content: { ko: '실행' },
      behavior: { onclick: 'window.run() && go()' } } }), {}, { language: 'ko' }),

  // ---- G. DECLARED ATTRIBUTES (docs/spec/form-markup.md, Declared attributes) --
  pass('control-attributes-text', 'design.attributes on a text input after its crudui attributes and design.wrapper.attributes on the node root after its class and path.',
    G({ theme: { type: 'text', label: 'Theme', design: { class: 'wide', style: 'color: red',
      attributes: { 'data-setting': 'theme', 'aria-describedby': 'theme-help' },
      wrapper: { class: 'row', style: 'margin: 0', attributes: { 'data-section': 'look', 'aria-label': 'Look & feel' } } } } }),
    { theme: 'dark' }, { language: 'en' }),
  pass('control-attributes-hidden-node', 'design.wrapper.attributes follow the hidden attribute of a node that design.show hides.',
    G({ theme: { type: 'text', label: 'Theme', design: { show: false, wrapper: { attributes: { 'data-section': 'look' } } } } }),
    {}, { language: 'en' }),
  pass('control-attributes-behavior', 'design.attributes on a text input with a behavior attribute follow the behavior and id attributes.',
    G({ theme: { type: 'text', label: 'Theme', behavior: { onchange: 'save(this)' }, design: { attributes: { 'data-setting': 'theme' } } } }),
    { theme: 'dark' }, { language: 'en' }),
  pass('control-attributes-select-textarea', 'design.attributes on a select and a textarea, each before its style.',
    G({ size: { type: 'select', label: 'Size', items: { s: 'Small', l: 'Large' }, design: { style: 'width: 5em', attributes: { 'data-setting': 'size' } } },
      memo: { type: 'textarea', label: 'Memo', design: { attributes: { 'aria-describedby': 'memo-help' } } } }),
    { size: 'l', memo: 'x' }, { language: 'en' }),
  pass('control-attributes-checkbox', 'design.attributes on a checkbox input and a switcher input before name, checked and value.',
    G({ dark: { type: 'checkbox', label: 'Dark', design: { attributes: { 'data-setting': 'dark' }, wrapper: { attributes: { 'data-section': 'look' } } } },
      sync: { type: 'switcher', label: 'Sync', design: { attributes: { 'aria-describedby': 'sync-help' } } } }),
    { dark: true }, { language: 'en' }),
  pass('control-attributes-choices', 'design.attributes on every option input of a choice and a multichoice field, after their crudui attributes.',
    G({ mode: { type: 'choice', label: 'Mode', items: { a: 'Auto', m: 'Manual' }, design: { attributes: { 'data-setting': 'mode' } } },
      days: { type: 'multichoice', label: 'Days', items: { mo: 'Mon', tu: 'Tue' }, design: { attributes: { 'data-setting': 'days', 'aria-describedby': 'days-help' } } } }),
    { mode: 'm', days: ['tu'] }, { language: 'en' }),
  pass('control-attributes-choice-behavior', 'design.attributes on option inputs with behavior attributes follow data-is-default and checked.',
    G({ mode: { type: 'choice', label: 'Mode', items: { a: 'Auto', m: 'Manual' }, behavior: { onchange: 'save(this)' }, design: { attributes: { 'data-setting': 'mode' } } },
      days: { type: 'multichoice', label: 'Days', items: { mo: 'Mon' }, behavior: { onchange: 'save(this)' }, design: { attributes: { 'data-setting': 'days' } } } }),
    { mode: 'a', days: ['mo'] }, { language: 'en' }),
  pass('control-attributes-dynamic-choice', 'A dynamic choice source renders no option input and no control attributes; the node root keeps its wrapper attributes.',
    G({ mode: { type: 'choice', label: 'Mode', items: { model: 'Mode', table: 'modes' }, design: { attributes: { 'data-setting': 'mode' }, wrapper: { attributes: { 'data-section': 'look' } } } } }),
    {}, { language: 'en' }),
  pass('control-attributes-file-display-button', 'design.attributes on the file input of an image field, the div of a dummy field, the button of an action field and the select of a search field.',
    G({ photo: { type: 'image', label: 'Photo', design: { attributes: { 'data-setting': 'photo' } } },
      shown: { type: 'dummy', label: 'Shown', design: { class: 'note', style: 'color: gray', attributes: { 'aria-live': 'polite' } } },
      run: { type: 'button', label: 'Run', content: 'Run', design: { attributes: { 'data-setting': 'run' } } },
      pick: { type: 'search', label: 'Pick', items: { a: 'A' }, design: { attributes: { 'data-setting': 'pick' } } } }),
    { shown: 'Ready' }, { language: 'en' }),
  pass('control-attributes-rows-lang-group', 'design.attributes on every row control of a repeated scalar field and every language control; wrapper attributes on the collection, lang and group roots and none on row or lang-item nodes.',
    G({ tags: { type: 'text', label: 'Tags', multiple: true, design: { attributes: { 'data-setting': 'tags' }, wrapper: { attributes: { 'data-section': 'tags' } } } },
      title: { type: 'text', label: 'Title', lang: { only: ['en', 'ko'] }, design: { attributes: { 'data-setting': 'title' }, wrapper: { attributes: { 'data-section': 'title' } } } },
      look: { type: 'group', label: 'Look', design: { wrapper: { attributes: { 'aria-label': 'Look' } } }, properties: { size: { type: 'number', label: 'Size' } } } }),
    { tags: { __opt_a1__: 'x', __opt_b2__: 'y' }, title: { en: 'Hi', ko: '안녕' } }, { language: 'en' }),

  // ---- H. RANGE FIELDS (docs/spec/form-markup.md, Range fields) ----------------
  pass('range-default-unit', 'range → a range input with min, max and step from validate.range and validate.step, an output with the default value and the append affix as the unit.',
    G({ volume: { type: 'range', label: 'Volume', default: 50, append: '%', validate: { range: [0, 100], step: 5 } } }),
    {}, { language: 'en' }),
  pass('range-bound-fraction', 'range with fractional bounds and step, a prepend affix and a bound value written in the input and the output.',
    G({ balance: { type: 'range', label: 'Balance', prepend: 'L', validate: { range: [-1.5, 1.5], step: 0.25 } } }),
    { balance: -0.75 }, { language: 'en' }),
  pass('range-empty', 'range without a default or data → an empty value and an empty output.',
    G({ level: { type: 'range', label: 'Level', validate: { required: true, range: [2, 10], step: 2 } } }),
    {}, { language: 'en' }),
  pass('range-behavior-design', 'range with a behavior attribute, design.class, design.style and declared attributes → the raw input and the output.',
    G({ volume: { type: 'range', label: 'Volume', default: 50, append: 'dB', validate: { range: [0, 100], step: 10 },
      behavior: { onchange: 'save(this)' }, design: { class: 'wide', style: 'width: 8rem', attributes: { 'data-setting': 'volume' } } },
      gain: { type: 'range', validate: { range: [0, 1], step: 0.1 }, design: { style: 'width: 4rem', attributes: { 'aria-label': 'Gain' } } } }),
    { gain: '0.3' }, { language: 'en' }),

  // ---- H2. CONDITION FIELDS (docs/spec/form-markup.md, Condition fields) -------
  pass('condition-tree-data', 'condition → a textarea marked data-crudui-value="json" holding the JSON text of the tree: members in data order, the escapes of JSON.stringify and ECMAScript number texts.',
    G({ pass: { type: 'condition', label: 'Pass', validate: { required: true, conditionTree: 'judge' } } }),
    { pass: { any: [
      { all: [{ field: 'clues.size', op: 'ge', value: 2 }, { op: 'in', value: ['a', 0.5, -1e-7, 1e21, true], field: 'mood' }] },
      { judge: 'Jian says "yes" \\ no\n\ttab \u0001 \u001f \u007f 한글   <b>&amp;</b>' },
    ] } }, { language: 'en' }),
  pass('condition-default', 'condition without data → the JSON text of default as the text and as data-default.',
    G({ opens_when: { type: 'condition', label: 'Opens when', default: { all: [{ field: 'episodes.e1.status', op: 'eq', value: 'passed' }] }, validate: { conditionTree: true } } }),
    {}, { language: 'en' }),
  pass('condition-text-and-empty', 'condition with a string value → the string itself, with null → an empty text, without data or default → an empty text.',
    G({ typed: { type: 'condition', label: 'Typed', validate: { conditionTree: true } },
      cleared: { type: 'condition', label: 'Cleared', validate: { conditionTree: true } },
      absent: { type: 'condition', label: 'Absent', validate: { conditionTree: 'judge' } } }),
    { typed: '{"all": [', cleared: null }, { language: 'en' }),
  pass('condition-behavior-design', 'condition with affixes, a behavior attribute, design.class, design.style and declared attributes → the textarea of a textarea field with the condition class.',
    G({ gate: { type: 'condition', label: 'Gate', prepend: 'if', append: 'then', validate: { conditionTree: true },
      behavior: { onchange: 'save(this)' }, design: { class: 'wide', style: 'width: 20rem', attributes: { 'data-setting': 'gate' } } } }),
    { gate: { all: [] } }, { language: 'en' }),

  // ---- I. CHOICE APPEARANCE (docs/spec/form-markup.md, Choice appearance) ------
  pass('choice-appearance-swatches', 'choice items with class, style and attributes → the label class after the label classes, the label style, the input attributes after the control attributes; design.group on the choices element.',
    G({ accent: { type: 'choice', label: 'Accent', design: { class: 'large', attributes: { 'data-setting': 'accent' }, group: { class: 'swatches', style: 'display: grid; gap: 4px' } },
      items: [
        { value: 'blue', label: 'Blue', class: 'swatch', style: '--swatch-bg: #1d4ed8', attributes: { 'aria-label': 'Blue accent' } },
        { value: 'green', label: 'Green', class: ' swatch  swatch--dark ', style: '--swatch-bg: #15803d; outline: 1px solid red' },
        { value: 'plain', label: 'Plain' },
      ] } }),
    { accent: 'green' }, { language: 'en' }),
  pass('choice-appearance-multichoice-override', 'multichoice items: a choice attribute named like a control attribute keeps its position and takes the choice value; the choices style without a class.',
    G({ days: { type: 'multichoice', label: 'Days', design: { attributes: { 'data-setting': 'days', 'aria-describedby': 'days-help' }, group: { style: 'display: flex' } },
      items: [
        { value: 'mo', label: 'Mon', attributes: { 'aria-describedby': 'mo-help', 'data-day': '1' } },
        { value: 'tu', label: 'Tue', style: 'font-weight: bold' },
      ] } }),
    { days: ['tu'] }, { language: 'en' }),
  pass('choice-appearance-behavior', 'choice items with appearance and a behavior attribute → the raw inputs with the choice attributes and the raw label style.',
    G({ accent: { type: 'radio', label: 'Accent', behavior: { onchange: 'go(this)' }, design: { attributes: { 'data-setting': 'accent' } },
      items: [
        { value: 'blue', label: 'Blue', class: 'swatch', style: '--swatch-bg: #1d4ed8', attributes: { 'aria-label': 'Blue accent', 'data-setting': 'blue' } },
        { value: 'red', label: 'Red', class: 'swatch' },
      ] } }),
    { accent: 'blue' }, { language: 'en' }),

  // ---- J. LAYOUT (docs/spec/form-markup.md, Layout) ----------------------------
  pass('inline-layout-fields', 'an inline group → crudui-node--inline on every field node before the wrapper class; a checkbox and a switcher with a label write the label and the description in the header and the input alone in the body; a checkbox without a label keeps its caption; buttons with and without a label.',
    G({ look: { type: 'group', label: 'Look', design: { layout: 'inline', wrapper: { class: 'section' } }, properties: {
      theme: { type: 'select', label: 'Theme', description: 'Applies to every window.', items: { light: 'Light', dark: 'Dark' }, design: { wrapper: { class: 'wide' } } },
      sync: { type: 'switcher', label: 'Sync', description: 'Keeps every window in step.' },
      agree: { type: 'checkbox', label: 'Agree', design: { attributes: { 'data-setting': 'agree' } } },
      bare: { type: 'checkbox' },
      run: { type: 'button', label: 'Sync now', content: 'Run' },
      go: { type: 'button', content: 'Go' },
      note: { type: 'text' },
    } },
    outside: { type: 'checkbox', label: 'Outside' } }),
    { look: { sync: true, agree: 1 } }, { language: 'en' }),
  pass('inline-layout-line-stacked', 'a line group in an inline group → crudui-node--inline crudui-node--line and plain child fields; a nested group inherits inline; a stacked group ends it; a lang field in an inline group; a line group outside an inline layout.',
    G({ look: { type: 'group', label: 'Look', design: { layout: 'inline' }, properties: {
      font: { type: 'group', label: 'Font', design: { layout: 'line' }, properties: { family: { type: 'text', label: 'Family' }, size: { type: 'number', label: 'Size', design: { wrapper: { style: 'flex: 1' } } } } },
      nested: { type: 'group', properties: { deep: { type: 'checkbox', label: 'Deep' } } },
      plain: { type: 'group', design: { layout: 'stacked' }, properties: { flat: { type: 'switcher', label: 'Flat' } } },
      names: { type: 'text', label: 'Names', lang: { only: ['en', 'ko'] } },
    } },
    actions: { type: 'group', design: { layout: 'line' }, properties: { a: { type: 'text', label: 'A' }, b: { type: 'text', label: 'B' } } } }),
    { look: { font: { family: 'Mono', size: 12 }, names: { en: 'Hi', ko: '안녕' } } }, { language: 'en' }),
  pass('inline-layout-repeated', 'an inline repeated group → the fields of its rows have crudui-node--inline; the collection and row nodes do not.',
    G({ rows: { type: 'group', label: 'Rows', multiple: true, design: { layout: 'inline' }, properties: { name: { type: 'text', label: 'Name' }, on: { type: 'switcher', label: 'On' } } } }),
    { rows: { __opt_a1__: { name: 'x', on: '1' } } }, { language: 'en' }),

  // ---- K. CHOICE GROUPS (docs/spec/form-markup.md, Choice groups) --------------
  pass('choice-groups-select', 'select items with plain choices and groups in written order → options and optgroup elements with the translated group label; the selected value inside a group.',
    G({ region: { type: 'select', label: 'Region', items: [
      { value: 'auto', label: 'Automatic' },
      { label: { en: 'Europe', ko: '유럽' }, choices: [{ value: 'eu-west', label: 'West' }, { value: 'eu-north', label: { en: 'North', ko: '북부' } }] },
      { value: 7, label: 'Seven' },
      { label: 'Asia', choices: [{ value: 'ap-east', label: 'East' }] },
    ] } }),
    { region: 'eu-north' }, { language: 'en' }),
  pass('choice-groups-only-groups', 'dropdown and selectbox items made only of groups → optgroup elements alone; the Korean group label.',
    G({ zone: { type: 'dropdown', label: 'Zone', items: [{ label: { en: 'Europe', ko: '유럽' }, choices: [{ value: 1, label: 'One' }, { value: 2, label: 'Two' }] }] },
      pick: { type: 'selectbox', label: 'Pick', items: [{ label: 'A', choices: [{ value: 'a', label: 'A' }] }, { label: 'B', choices: [{ value: 'b', label: 'B' }] }] } }),
    { zone: 2 }, { language: 'ko' }),
  pass('choice-groups-behavior', 'a select with groups and a behavior attribute → the raw select with its optgroup elements.',
    G({ region: { type: 'select', label: 'Region', behavior: { onchange: 'go(this)' }, items: [
      { value: 'auto', label: 'Automatic' },
      { label: 'Europe <west>', choices: [{ value: 'eu-west', label: 'West & more' }] },
    ] } }),
    { region: 'eu-west' }, { language: 'en' }),
];

// Cases whose expected HTML is written from the specification, not rendered.
NEW.push(...WRITTEN_CASES, ...GROUP_SOURCE_CASES, ...CONDITION_EDITOR_CASES);

void group; // (kept for ad-hoc use)

/** The rendered case of a scenario, or its error case after the render throws the recorded ComposeLoadError code and message. */
function scenario(c: (typeof SCENARIOS)[number]): FixtureCase {
  if (c.expectError) {
    const thrown = thrownError(c.name, () => renderFields(compileForm(c.spec, c.options), { ...c.options, data: c.data }));
    if (!(thrown.error instanceof ComposeLoadError)) {
      throw new Error(`${c.name}: expected ComposeLoadError, got ${String(thrown.error)}`);
    }
    requireError(c.name, c.expectError, thrown);
    return { name: c.name, note: c.note, spec: c.spec, data: c.data, options: c.options, expectError: c.expectError };
  }
  const html = renderFields(compileForm(c.spec, c.options), { ...c.options, data: c.data });
  return { name: c.name, note: c.note, spec: c.spec, data: c.data, options: c.options, expected_html: normalizeHtml(html) };
}

// The scenarios in their order, then the widget and written cases in theirs; a widget or written case takes the
// place of the scenario of the same name.
const cases = new Map(SCENARIOS.map(scenario).map((c) => [c.name, c]));
for (const c of NEW) cases.set(c.name, c);

const REQUIREMENTS: Record<string, readonly string[]> = {
  ...GROUP_SOURCE_REQUIREMENTS,
  ...CONDITION_EDITOR_REQUIREMENTS,
  "design-show-expr-falsy": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-017"],
  "design-show-condmap-non-admin": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-017"],
  "design-node-map-4nodes": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010"],
  "group-class-condmap-has-data": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-013", "CUMK-021"],
  "group-class-condmap-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-013", "CUMK-021"],
  "multiple-leaf-two-rows": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-014", "CUMK-016", "CUMK-022", "CUMK-023", "CUMK-058", "CUMK-063"],
  "multiple-leaf-empty-placeholder": ["CUEC-002", "CUEC-004", "CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-014", "CUMK-016", "CUMK-022", "CUMK-023", "CUMK-058", "CUMK-063"],
  "multiple-settings-bucket": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-014", "CUMK-016", "CUMK-022", "CUMK-023", "CUMK-036", "CUMK-058", "CUMK-063", "CUSC-044"],
  "multiple-group-rows": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-013", "CUMK-014", "CUMK-016", "CUMK-017", "CUMK-018", "CUMK-022", "CUMK-023", "CUMK-033", "CUMK-058", "CUMK-063"],
  "lang-default-langs": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-015", "CUMK-024", "CUMK-025"],
  "lang-settings-only-frame-off": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-015", "CUMK-024", "CUMK-025", "CUMK-032"],
  "group-nested-properties": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-013", "CUMK-021", "CURP-001"],
  "nested-empty-collections-keep-sibling-order": ["CUEC-001", "CUMK-001", "CUMK-002", "CUMK-003", "CURP-027"],
  "collection-shown-by-condition": ["CUEC-006", "CUMK-001", "CUMK-002", "CUMK-003"],
  "collection-hidden-by-condition": ["CUEC-006", "CUMK-001", "CUMK-002", "CUMK-003"],
  "scalar-multiple-empty-object-has-no-rows": ["CUEC-001", "CUEC-004", "CUMK-001", "CUMK-002", "CUMK-003"],
  "multiple-nested-depth-three": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-013", "CUMK-014", "CUMK-016", "CUMK-017", "CUMK-018", "CUMK-022", "CUMK-023", "CUMK-031", "CUMK-033", "CUMK-058", "CUMK-059", "CUMK-063"],
  "multiple-max-reached-disables-add": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-014", "CUMK-016", "CUMK-022", "CUMK-023", "CUMK-036", "CUMK-058", "CUMK-060", "CUMK-063", "CUSC-043"],
  "textarea-rows5": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "textarea-with-data": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "integer-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-019"],
  "float-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-019"],
  "decimal-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-019"],
  "dropdown-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "select-with-data": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "switcher-bare": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "choice-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "choice-with-data": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "radio-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "multichoice-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "multichoice-with-data": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "checkboxes-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "image-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "image-options": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "button-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-007"],
  "action-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-007"],
  "search-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011", "CUSC-080"],
  "search-static-items": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "autocomplete-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011", "CUSC-080"],
  "tinymce-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "tinymce-options": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "wysiwyg-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "file-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "cover-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "cover-simple-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "selectbox-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "checkcontainer-alias": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "summernote-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "editorjs-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "tui-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "choice-design-label-class": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "tinymce-design-class": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "image-design-class": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "date-design-prepend": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010"],
  "choice-design-show-false": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012", "CUMK-017"],
  "select-dynamic-stub": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUSC-080"],
  "choice-dynamic-stub": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "multichoice-dynamic-stub": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "search-dynamic-stub": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011", "CUSC-080"],
  "search-dynamic-relations-numbers": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "search-dynamic-relations-text": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "text-float-value": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUMK-069"],
  "select-dynamic-relations-object": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUSC-088"],
  "select-dynamic-relations-text": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUSC-088"],
  "choice-behavior-passthrough": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "button-behavior-onclick": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-007"],
  "control-attributes-text": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-026", "CUMK-028"],
  "control-attributes-hidden-node": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-017", "CUMK-026"],
  "control-attributes-behavior": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-028"],
  "control-attributes-select-textarea": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUMK-028"],
  "control-attributes-checkbox": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUMK-026", "CUMK-027"],
  "control-attributes-choices": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012", "CUMK-028"],
  "control-attributes-choice-behavior": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012", "CUMK-028"],
  "control-attributes-dynamic-choice": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012", "CUMK-026", "CUMK-028"],
  "control-attributes-file-display-button": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-007", "CUMK-010", "CUMK-011", "CUMK-028"],
  "control-attributes-rows-lang-group": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-013", "CUMK-014", "CUMK-015", "CUMK-016", "CUMK-019", "CUMK-021", "CUMK-022", "CUMK-023", "CUMK-024", "CUMK-025", "CUMK-026", "CUMK-028", "CUMK-058", "CUMK-063"],
  "range-default-unit": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "range-bound-fraction": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "range-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "range-behavior-design": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011", "CUMK-028"],
  "condition-tree-data": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011", "CUMK-066"],
  "condition-default": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011", "CUMK-066"],
  "condition-text-and-empty": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011", "CUMK-066"],
  "condition-behavior-design": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011", "CUMK-028", "CUMK-066"],
  "choice-appearance-swatches": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012", "CUMK-028"],
  "choice-appearance-multichoice-override": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012", "CUMK-028"],
  "choice-appearance-behavior": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012", "CUMK-028"],
  "inline-layout-fields": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-007", "CUMK-011", "CUMK-013", "CUMK-020", "CUMK-021", "CUMK-027", "CUMK-029", "CUMK-064"],
  "inline-layout-line-stacked": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-011", "CUMK-013", "CUMK-015", "CUMK-019", "CUMK-020", "CUMK-021", "CUMK-024", "CUMK-025", "CUMK-029", "CUMK-030", "CUMK-064"],
  "inline-layout-repeated": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-011", "CUMK-013", "CUMK-014", "CUMK-016", "CUMK-017", "CUMK-018", "CUMK-020", "CUMK-022", "CUMK-023", "CUMK-029", "CUMK-033", "CUMK-058", "CUMK-063", "CUMK-064"],
  "select-no-items-placeholder": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUSC-080"],
  "select-empty-array-placeholder": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUSC-080"],
  "dropdown-empty-map-placeholder": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUSC-080"],
  "selectbox-one-choice-no-placeholder": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUSC-080"],
  "choice-groups-select": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "choice-groups-only-groups": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "choice-groups-behavior": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "layout-on-field": ["CUSC-017"],
  "layout-on-form-root": ["CUSC-017"],
  "layout-on-form-button": ["CUSC-017"],
  "layout-unknown-value": ["CUSC-018"],
  "layout-condition-map": ["CUSC-018"],
  "layout-line-repeated": ["CUSC-019"],
  "choice-appearance-class-list": ["CUSC-023"],
  "choice-appearance-style-map": ["CUSC-023"],
  "choice-appearance-attributes-text": ["CUSC-024"],
  "choice-appearance-event-attribute": ["CUSC-025"],
  "choice-appearance-owned-attribute": ["CUSC-025"],
  "choice-appearance-number-attribute": ["CUSC-023", "CUSC-026"],
  "range-without-rules": ["CUSC-008"],
  "range-reversed-bounds": ["CUSC-008"],
  "range-reference-bounds": ["CUSC-008"],
  "range-three-bounds": ["CUSC-008"],
  "range-without-step": ["CUSC-009"],
  "range-zero-step": ["CUSC-009"],
  "range-conditional-step": ["CUSC-009"],
  "range-minimum-off-step": ["CUSC-010"],
  "condition-without-rule": ["CUSC-070"],
  "condition-rule-false": ["CUSC-070"],
  "condition-rule-other-text": ["CUSC-070"],
  "condition-rule-condition-map": ["CUSC-070"],
  "control-attributes-not-object": ["CUSC-011"],
  "control-attributes-event-name": ["CUSC-012"],
  "control-attributes-uppercase-name": ["CUSC-012"],
  "control-attributes-bare-prefix": ["CUSC-012"],
  "control-attributes-owned-name": ["CUSC-012"],
  "control-attributes-names-before-values": ["CUSC-012"],
  "control-attributes-value-type": ["CUSC-013"],
  "root-description": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-004"],
  "root-description-fallback-language": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-004"],
  "multiple-only-group-rows": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-013", "CUMK-014", "CUMK-016", "CUMK-017", "CUMK-018", "CUMK-019", "CUMK-022", "CUMK-023", "CUMK-033", "CUMK-034", "CUMK-058", "CUMK-063"],
  "multiple-only-object-title-sticky": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-013", "CUMK-014", "CUMK-016", "CUMK-017", "CUMK-018", "CUMK-022", "CUMK-023", "CUMK-032", "CUMK-033", "CUMK-034", "CUMK-038", "CUMK-058", "CUMK-062", "CUMK-063"],
  "multiple-only-missing-data": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-022", "CUMK-034"],
  "multiple-only-empty-data": ["CUEC-001", "CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-022", "CUMK-034"],
  "multiple-only-scalar-rows": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-014", "CUMK-022", "CUMK-023", "CUMK-034", "CUMK-058", "CUMK-063"],
  "design-show-hidden-group-keeps-values": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-013", "CUMK-014", "CUMK-016", "CUMK-017", "CUMK-021", "CUMK-022", "CUMK-023", "CUMK-058", "CUMK-063"],
  "design-show-row-parent-on": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-013", "CUMK-014", "CUMK-016", "CUMK-017", "CUMK-018", "CUMK-019", "CUMK-022", "CUMK-023", "CUMK-033", "CUMK-034", "CUMK-058", "CUMK-063"],
  "design-show-row-parent-off": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-005", "CUMK-006", "CUMK-007", "CUMK-013", "CUMK-014", "CUMK-016", "CUMK-017", "CUMK-018", "CUMK-019", "CUMK-022", "CUMK-023", "CUMK-033", "CUMK-034", "CUMK-058", "CUMK-063"],
  "number-any-step": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-019"],
  "choice-list-select-order": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011"],
  "choice-list-index-labels": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-011", "CUSC-022"],
  "choice-list-choice-default": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "choice-list-multichoice-mixed-values": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-012"],
  "choice-list-search-order": ["CUMK-001", "CUMK-002", "CUMK-003", "CUMK-010", "CUMK-011"],
  "key-prefix-option-names": ["CUMK-001", "CUMK-002", "CUMK-003", "CURT-025"],
  "text-with-nul": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-show-expr-truthy": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-show-condmap-admin": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-class-condmap-main": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-class-ternary": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-false-slot-off": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "compose-ref-patch": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "content-langmap-with-show": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "content-langmap-en": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "behavior-opaque-passthrough": ["CUMK-001", "CUMK-002", "CUMK-003", "CUSC-005"],
  "password-bare": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "password-with-data": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "string-alias": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "hidden-no-label": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "email-bare": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "email-with-data": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "checkbox-bare": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "checkbox-with-data": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "dummy-empty": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "dummy-with-data": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "dummy-items-lookup": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "html-alias": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "static-alias": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "dummy-input-empty": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "dummy-input-with-data": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "date-empty": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "date-with-data": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "datetime-empty": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "datetime-with-data": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "datetime-local-alias": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "image-viewer-empty": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "image-viewer-with-data": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "tagify-empty": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "tagify2-server": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "unsupported-type-marker": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "datetime-behavior-passthrough": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "root-description-empty": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-show-literal-identifier-visible": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-show-literal-string-visible": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-show-condition-map-without-selection": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-class-literal-string": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "design-style-literal-string": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "choice-list-dummy-label": ["CUMK-001", "CUMK-002", "CUMK-003"],
  "multiple-min-reached-disables-remove": ["CUSC-043"],
  "stacked-layout-group": ["CUSC-016"],
  "multiple-controls-header": ["CUSC-046"],
  "multiple-controls-footer": ["CUSC-046"],
  "multiple-controls-outline": ["CUSC-046"],
  "lang-values-keep-language-whatever-display": ["CUSC-039"],
  "keyed-map-scalar-rows": ["CUMK-034", "CUSC-076", "CUSC-078"],
  "keyed-map-without-only": ["CUSC-078"],
  "keyed-map-only-false": ["CUSC-078"],
  "keyed-map-keys-not-string": ["CUSC-078"],
};

/** The requirement ids that each case tests (docs/spec); a case that tests none keeps no requirements member. */
function withRequirements<T extends { name: string; note: string }>(c: T): T & { requirements?: readonly string[] } {
  const ids = REQUIREMENTS[c.name];
  if (ids === undefined) return c;
  return Object.assign({ name: c.name, note: c.note, requirements: ids }, c);
}
writeFileSync(casesPath, JSON.stringify([...cases.values()].map(withRequirements), null, 2) + '\n', 'utf8');
process.stdout.write(`cases=${cases.size}\n`);
