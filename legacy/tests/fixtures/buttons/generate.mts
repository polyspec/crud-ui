/**
 * Writes the cases of the form buttons: `bindButtons` evaluates the buttons of a template for a record, and
 * `formButtonsHtml` renders evaluated buttons as markup. The TypeScript reference writes every expectation; no
 * implementation writes one by hand. Run from the checkout root:
 *
 *   node legacy/tests/fixtures/buttons/generate.mts
 *
 * A bind case is `{ name, note, requirements, operation: "bindButtons", spec | template, data, options, expected }`:
 * the runner compiles `spec` with compileForm and passes the result, or passes `template` as it is, a value that is not
 * a compiled template. An html case is `{ name, note, requirements, operation: "formButtonsHtml", buttons, expected }`.
 * `expected` is `{ result }` or `{ error: { code, message } }`. Attributes keep their output order.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '@polyspec/crudui-generator-core';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
interface Case { name: string; note: string; requirements: string[]; [key: string]: Json }

/** The reference functions take the values of a case as they are, invalid ones included, so they are called untyped. */
const bindButtons = (template: unknown, data: unknown, options: unknown): unknown =>
  Reflect.apply(core.bindButtons, undefined, [template, data, options]);
const compileForm = (spec: unknown): unknown => Reflect.apply(core.compileForm, undefined, [spec]);
const formButtonsHtml = (buttons: unknown): unknown => Reflect.apply(core.formButtonsHtml, undefined, [buttons]);

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, 'cases.json');

const root = (extra: Record<string, unknown>): Record<string, unknown> => ({
  type: 'group',
  properties: { name: { type: 'text' } },
  ...extra,
});
const DECLARED = {
  action: { method: 'post', url: '/save' },
  buttons: [
    { type: 'submit', name: '__submitted__', value: 'go', text: { ko: '저장하기', en: 'Save now' }, design: { class: 'primary' } },
    { type: 'reset' },
    { type: 'button', text: 'Cancel', behavior: { onclick: 'history.back()' } },
    { type: 'link', text: 'List', href: '../?a=1&b="2"' },
  ],
};

/** The reference result of one case: the buttons, or the error that the reference raises. */
function observe(run: () => unknown): Json {
  try {
    const text: string = JSON.stringify(run() ?? null);
    const parsed: unknown = JSON.parse(text);
    return { result: toJson(parsed) };
  } catch (error) {
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'ERROR';
    return { error: { code, message: error instanceof Error ? error.message : String(error) } };
  }
}

/** Narrows a parsed JSON value; the reference results are JSON values, so anything else is a failure of the generator. */
function toJson(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => toJson(item));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)]));
  }
  throw new Error('A reference result is no JSON value');
}

const cases: Case[] = [];
function bind(name: string, note: string, spec: Record<string, unknown>, data: Json, options: Json): void {
  const expected = observe(() => bindButtons(compileForm(spec), data, options));
  cases.push({ name, note, requirements: ['CURP-008'], operation: 'bindButtons', spec: toJson(spec), data, options, expected });
}
function bindTemplate(name: string, note: string, template: Json, options: Json): void {
  const expected = observe(() => bindButtons(template, {}, options));
  cases.push({ name, note, requirements: ['CURP-008'], operation: 'bindButtons', template, data: {}, options, expected });
}
function html(name: string, note: string, buttons: Json): void {
  const expected = observe(() => formButtonsHtml(buttons));
  cases.push({ name, note, requirements: ['CURP-009'], operation: 'formButtonsHtml', buttons, expected });
}

// Binding: the buttons of a spec for a record, in the language of the options.
bind('default-submit-only', 'A spec without buttons has one submit button with the interface text of its type.',
  root({}), {}, { language: 'en' });
bind('declared-buttons-en', 'Declared buttons keep their order, text, design, behavior and link.',
  root(DECLARED), {}, { language: 'en' });
bind('declared-buttons-ko', 'The interface text of the submit and reset buttons follows the language option.',
  root(DECLARED), {}, { language: 'ko' });
bind('declared-buttons-ja', 'The Japanese language option gives the interface text of the reset button.',
  root(DECLARED), {}, { language: 'ja' });
bind('declared-buttons-zh', 'The Chinese language option gives the interface text of the reset button.',
  root(DECLARED), {}, { language: 'zh' });
bind('record-does-not-change-buttons', 'The buttons do not depend on the record.',
  root(DECLARED), { name: 'Ada' }, { language: 'en' });
bind('link-href-is-kept-verbatim', 'A link keeps its href text, quotes and ampersands unchanged in the buttons.',
  root({ buttons: [{ type: 'link', text: 'Open', href: '/a?x=1&y="2"' }] }), {}, { language: 'en' });
bind('localized-text-object', 'A text object is chosen by the language option.',
  root({ buttons: [{ type: 'button', text: { ko: '확인', en: 'OK' } }] }), {}, { language: 'ko' });
bind('button-without-text-fails', 'A button that declares no text fails at compile time.',
  root({ buttons: [{ type: 'button' }] }), {}, { language: 'en' });
bindTemplate('template-not-compiled', 'A value that is not a compiled form template is refused before its buttons are read.',
  { kind: 'other' }, { language: 'en' });
const reshaped: unknown = JSON.parse(JSON.stringify(compileForm(root({ buttons: [{ type: 'button', text: 'x' }] }))));
if (typeof reshaped === 'object' && reshaped !== null && 'buttons' in reshaped && Array.isArray(reshaped.buttons)) {
  const buttons: unknown[] = reshaped.buttons;
  const first: unknown = buttons[0];
  if (typeof first === 'object' && first !== null) Object.assign(first, { type: 'other' });
}
bindTemplate('template-with-unknown-button-type', 'A compiled button whose type is no form button type is refused.',
  toJson(reshaped), { language: 'en' });
bind('language-not-a-string', 'A language option that is not a string is refused.', root({}), {}, { language: 1 });

// Markup: each evaluated button is an element with its attributes in the order type, class, style, name, value,
// href and onclick.
const EVALUATED: [Json, Json, Json, Json] = [
  { type: 'submit', tag: 'button', text: 'Save', attrs: { type: 'submit', class: 'crudui-action crudui-action--text' } },
  { type: 'link', tag: 'a', text: 'List', attrs: { class: 'crudui-action crudui-action--text', href: '/items?a=1&b="2"' } },
  { type: 'button', tag: 'button', text: 'Hi <b>&', attrs: {
    type: 'button', class: 'crudui-action crudui-action--text wide', style: 'color: red', onclick: 'go("x")' } },
  { type: 'reset', tag: 'button', text: 'Reset', attrs: { type: 'reset', class: 'crudui-action crudui-action--text', name: 'r', value: 'v' } },
];
html('html-empty-list', 'No buttons give an empty string.', []);
html('html-one-submit', 'One submit button is a button element with its type first.', [EVALUATED[0]]);
html('html-link-and-buttons', 'A link is an a element with the href attribute after the class; the other types are button elements.',
  EVALUATED);
html('html-attributes-in-order', 'The attributes of a button follow the order type, class, style, name, value, href, onclick.',
  [EVALUATED[2], EVALUATED[3]]);
html('html-escapes-text-and-attributes', 'The text and the attribute values are escaped, the quotes in an attribute included.',
  [{ type: 'button', tag: 'button', text: '<&>', attrs: { type: 'button', class: 'crudui-action', onclick: 'a"b' } }]);
html('html-not-a-list', 'Something other than a list of buttons is refused.', {});
html('html-null-entry', 'An entry that is no button object is refused.', [null]);
html('html-tag-not-element', 'An element that is neither a link nor a button is refused.',
  [{ type: 'submit', tag: 'div', text: 'x', attrs: { type: 'submit', class: 'crudui-action' } }]);
html('html-attribute-not-allowed', 'An attribute outside the button attributes is refused.',
  [{ type: 'submit', tag: 'button', text: 'x', attrs: { type: 'submit', class: 'crudui-action', onmouseover: 'x' } }]);
html('html-class-not-a-string', 'A class that is not a string is refused.',
  [{ type: 'submit', tag: 'button', text: 'x', attrs: { type: 'submit', class: 1 } }]);

const body = `${JSON.stringify(cases, null, 2)}\n`;
writeFileSync(output, body);
console.log(`wrote ${cases.length} cases to ${output}`);
