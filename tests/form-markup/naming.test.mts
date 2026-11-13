// Naming rules of the form markup (docs/spec/form-markup.md), checked on every
// rendered fixture: class shape, allowed names, modifiers with their block, and
// the containment of parts and child nodes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFragment } from 'parse5';

import { readFileSync } from 'node:fs';

import { caseGroup, caseValue } from '../case-values.mts';
import { readJson, type JTDSchemaType } from '../json.mts';

/** A case of a render fixture; a case without expected HTML expects an error. */
interface RenderCase { name: string; expected_html?: string; spec?: unknown }
/** A case of the outline fixture. */
interface OutlineCase { name: string; expected_outline_html: string; expected_data_html: string; spec?: unknown }
const renderCases: JTDSchemaType<RenderCase[]> = {
  elements: { properties: { name: { type: 'string' } }, optionalProperties: { expected_html: { type: 'string' }, spec: {} }, additionalProperties: true },
};
const outlineCases: JTDSchemaType<OutlineCase[]> = {
  elements: {
    properties: { name: { type: 'string' }, expected_outline_html: { type: 'string' }, expected_data_html: { type: 'string' } },
    optionalProperties: { spec: {} },
    additionalProperties: true,
  },
};
/** A node of a parsed fragment: an element has attributes and children, text and comments have neither. */
interface MarkupNode { nodeName: string; attrs?: { name: string; value: string }[]; childNodes?: MarkupNode[] }

function read<Case>(path: string, schema: JTDSchemaType<Case[]>): Case[] {
  return readJson(new URL(path, import.meta.url), schema);
}
/** The cases of every group of a file in the case form of binding (G-5), with the specification decoded. */
function readGroups(path: string): RenderCase[] {
  const document: unknown = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  if (typeof document !== 'object' || document === null) throw new Error(`${path} holds no object of case groups`);
  return Object.keys(document).flatMap(group => caseGroup(document, group))
    .map(item => ({ ...item, name: String(item.name), ...(typeof item.expected_html === 'string' ? { expected_html: item.expected_html } : {}), spec: caseValue(item.spec) }));
}
const rendered = (item: RenderCase): item is RenderCase & { expected_html: string } => Boolean(item.expected_html);
const fixtures: [label: string, html: string, spec: unknown][] = [
  ...read('../fixtures/form-render/cases.json', renderCases).filter(rendered).map((item): [string, string, unknown] => [`form-render/${item.name}`, item.expected_html, item.spec]),
  ...readGroups('../fixtures/list-render/cases.json').filter(rendered).map((item): [string, string, unknown] => [`list-render/${item.name}`, item.expected_html, item.spec]),
  ...readGroups('../fixtures/detail-render/cases.json').filter(rendered).map((item): [string, string, unknown] => [`detail-render/${item.name}`, item.expected_html, item.spec]),
  ...read('../fixtures/form-outline/cases.json', outlineCases).flatMap((item): [string, string, unknown][] => [
    [`form-outline/${item.name}/outline`, item.expected_outline_html, item.spec],
    [`form-outline/${item.name}/data`, item.expected_data_html, item.spec],
  ]),
];

/** Class tokens a spec declares: every class-shaped word of its string values, including quoted words in expressions. */
function declaredTokens(spec: unknown): Set<string> {
  const tokens = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string') for (const token of value.split(/[^A-Za-z0-9_-]+/)) tokens.add(token);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(spec);
  return tokens;
}

// N1/N4: blocks, their elements and their modifiers.
const blocks: Record<string, { elements: string[]; modifiers: string[] }> = {
  node: { elements: ['header', 'header-container', 'body', 'footer', 'label', 'description', 'number', 'title', 'summary', 'count'], modifiers: ['field', 'group', 'collection', 'row', 'lang', 'lang-item', 'sticky', 'framed', 'inline', 'line'] },
  form: { elements: ['description', 'body', 'footer'], modifiers: [] },
  controls: { elements: [], modifiers: [] },
  action: { elements: [], modifiers: ['text'] },
  outline: { elements: ['header', 'body'], modifiers: [] },
  data: { elements: ['header', 'body'], modifiers: [] },
  widget: { elements: ['affix', 'button', 'output'], modifiers: ['search', 'range', 'condition', 'unsupported'] },
  condition: { elements: ['group', 'mode', 'list', 'item', 'comparison', 'field', 'op', 'value', 'judge', 'text', 'error'], modifiers: [] },
  input: { elements: [], modifiers: ['select', 'file', 'range', 'condition', 'switch'] },
  choices: { elements: ['input', 'label'], modifiers: ['multiple'] },
  list: { elements: ['description', 'table', 'heading', 'heading-label', 'sort', 'cell', 'cards', 'card', 'card-label', 'card-value', 'empty', 'actions', 'action', 'pagination', 'pagination-prev', 'pagination-page', 'pagination-next'], modifiers: [] },
  detail: { elements: ['actions', 'action', 'field', 'label', 'value'], modifiers: [] },
  value: { elements: [], modifiers: ['text', 'date', 'number', 'choice-label', 'badge', 'link', 'bool', 'image', 'html'] },
  badge: { elements: [], modifiers: [] },
  bool: { elements: [], modifiers: ['text', 'check', 'icon'] },
};
// Classes a renderer writes besides the crudui grammar: validation and editor hooks.
const hooks = new Set(['valid-target', 'valid-target-async', 'tinymcearea', 'summernote', 'contentjs', 'tuiarea']);
const name = '[a-z]+(?:-[a-z]+)*';
const shape = new RegExp(`^crudui-(${name})(?:__(${name})|--(${name}))?$`);
const parts = new Set(['label', 'description', 'number', 'title', 'summary', 'count']);

const classesOf = (node: MarkupNode): string[] => (node.attrs?.find(attr => attr.name === 'class')?.value ?? '').split(/\s+/).filter(Boolean);
const has = (node: MarkupNode | undefined, token: string): boolean => node !== undefined && classesOf(node).includes(token);

function check(label: string, node: MarkupNode, parent: MarkupNode | undefined, slot?: string, declared = new Set<string>()): void {
  // Any other class is a validation or editor hook, or a class the spec declares (no CSS framework vocabulary).
  for (const token of classesOf(node).filter(token => !token.startsWith('crudui-'))) {
    assert.ok(hooks.has(token) || declared.has(token), `${label}: ${token} is neither a crudui class, a hook nor declared by the spec`);
  }
  const classes = classesOf(node).filter(token => token.startsWith('crudui-'));
  for (const token of classes) {
    const match = shape.exec(token);
    assert.ok(match, `${label}: ${token} is not crudui-{block}, crudui-{block}__{element} or crudui-{block}--{modifier}`);
    const [, block, element, modifier] = match;
    // The block group is not optional: a match has it.
    assert.ok(block !== undefined);
    const known = blocks[block];
    assert.ok(known, `${label}: unknown block ${block} in ${token}`);
    if (element) assert.ok(known.elements.includes(element), `${label}: unknown element ${token}`);
    if (modifier) {
      assert.ok(known.modifiers.includes(modifier), `${label}: unknown modifier ${token}`);
      assert.ok(classes.includes(`crudui-${block}`), `${label}: ${token} without its block crudui-${block}`);
    }
    // N3: parts belong to a node header (the nearest enclosing slot); a node sits directly in a body.
    if (block === 'node' && element !== undefined && parts.has(element)) {
      assert.equal(slot, 'crudui-node__header', `${label}: ${token} inside ${slot ?? 'no slot'}, not crudui-node__header`);
    }
  }
  if (classes.includes('crudui-node') && parent !== undefined) {
    assert.ok(['crudui-node__body', 'crudui-form__body', 'crudui-outline__body'].some(body => has(parent, body)),
      `${label}: crudui-node outside a body (parent ${classesOf(parent).join(' ') || parent.nodeName})`);
  }
  // An action button marks an unavailable action with aria-disabled="true", never disabled,
  // so it keeps focus in every browser.
  if (classes.includes('crudui-action')) {
    const attribute = (attr: string) => node.attrs?.find(item => item.name === attr)?.value;
    assert.equal(attribute('disabled'), undefined, `${label}: action button with disabled`);
    assert.ok([undefined, 'true'].includes(attribute('aria-disabled')), `${label}: aria-disabled="${attribute('aria-disabled')}" on an action button`);
  }
  const enclosing = classes.find(token => /^crudui-node__(header|body|footer)$/.test(token)) ?? slot;
  for (const child of node.childNodes ?? []) check(label, child, node.attrs ? node : parent, enclosing, declared);
}

test('the naming check rejects markup that breaks a rule', () => {
  for (const [broken, message] of [
    ['<div class="crudui-node crudui-node--row"><div class="crudui-node__body"><span class="crudui-node__title">x</span></div></div>', /inside crudui-node__body, not crudui-node__header/],
    ['<div class="crudui-node--row"></div>', /without its block crudui-node/],
    ['<div class="crudui-node"><div class="crudui-node__side"></div></div>', /unknown element crudui-node__side/],
    ['<div class="crudui-node"><div class="crudui-node__header"><div class="crudui-node crudui-node--field"></div></div></div>', /crudui-node outside a body/],
    ['<div class="crudui-node__header__label"></div>', /is not crudui-\{block\}/],
    ['<div class="crudui-widget"><input class="valid-target form-control"></div>', /form-control is neither a crudui class/],
    ['<button type="button" class="crudui-action" data-crudui-action="undo" disabled=""></button>', /action button with disabled/],
    ['<button type="button" class="crudui-action" data-crudui-action="undo" aria-disabled="false"></button>', /aria-disabled="false" on an action button/],
  ] satisfies [string, RegExp][]) {
    assert.throws(() => { for (const root of parseFragment(broken).childNodes) check('broken', root, undefined); }, message);
  }
});

test('every crudui class in the rendered fixtures follows the naming rules', () => {
  assert.ok(fixtures.length > 90, 'fixtures loaded');
  for (const [label, html, spec] of fixtures) {
    const declared = declaredTokens(spec);
    for (const root of parseFragment(html).childNodes) check(label, root, undefined, undefined, declared);
  }
});
