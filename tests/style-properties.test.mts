// Custom properties of the core stylesheet (@polyspec/crudui-generator-core/crudui.css): one rule with
// zero specificity declares every themable property for every crudui block, and no other rule
// writes a color, so a page themes the form, structure map, data view, list and detail by setting
// the properties on the blocks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../legacy/packages/generator/ts/styles/crudui.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Every rule with a declaration block: its selector, its declarations and its depth in at-rules. */
function rules(text: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '{') {
      stack.push(text.slice(start, index).trim());
      start = index + 1;
    } else if (char === '}') {
      const selector = stack.pop();
      assert.ok(selector !== undefined, 'the stylesheet has unbalanced braces');
      const body = text.slice(start, index).trim();
      if (!selector.startsWith('@')) found.push({ selector, body });
      start = index + 1;
    }
  }
  assert.equal(stack.length, 0, 'the stylesheet has unbalanced braces');
  return found;
}

const blocks = ['.crudui-form', '.crudui-outline', '.crudui-data', '.crudui-list', '.crudui-detail'];
// The themable properties and their defaults.
const defaults = {
  '--crudui-text': '#111827',
  '--crudui-muted': '#6b7280',
  '--crudui-border': '#e5e7eb',
  '--crudui-surface': '#ffffff',
  '--crudui-subtle': '#f9fafb',
  '--crudui-accent': '#1d4ed8',
  '--crudui-on-accent': '#ffffff',
  '--crudui-action-text': '#374151',
  '--crudui-action-size': '1.75rem',
  '--crudui-control-border': 'var(--crudui-border)',
  '--crudui-control-height': '2.25rem',
  '--crudui-radius': '0.375rem',
  '--crudui-submit-background': 'var(--crudui-surface)',
  '--crudui-submit-border': 'var(--crudui-border)',
  '--crudui-submit-text': 'var(--crudui-action-text)',
};
const all = rules(source);
const declarations = (body: string): Record<string, string> => Object.fromEntries(body.split(';').map(part => part.trim()).filter(Boolean)
  .map(part => [part.slice(0, part.indexOf(':')).trim(), part.slice(part.indexOf(':') + 1).trim()]));
const tokenRules = all.filter(rule => '--crudui-text' in declarations(rule.body));

test('one rule with zero specificity declares the themable properties of every block', () => {
  assert.equal(tokenRules.length, 1, 'exactly one rule declares --crudui-text');
  const [rule] = tokenRules;
  assert.ok(rule);
  const match = /^:where\(([^()]*)\)$/.exec(rule.selector);
  assert.ok(match, `the rule selector ${rule.selector} is one :where() list`);
  // The group is not optional: a match has it.
  const [, list] = match;
  assert.ok(list !== undefined);
  assert.deepEqual(list.split(',').map(item => item.trim()), blocks);
  const declared = declarations(rule.body);
  for (const [name, value] of Object.entries(defaults)) assert.equal(declared[name], value, name);
});

test('every custom property that a rule reads is declared', () => {
  const declared = new Set(all.flatMap(rule => Object.keys(declarations(rule.body))).filter(name => name.startsWith('--')));
  // The renderer writes the depth of a sticky row in its style attribute; the rules read it with a default.
  declared.add('--crudui-sticky-depth');
  // The group is not optional: every match has it.
  const read = [...source.matchAll(/var\((--[a-z-]+)/g)].map(match => match[1]).filter(name => name !== undefined);
  assert.deepEqual([...new Set(read.filter(name => !declared.has(name)))], []);
});

test('no rule except the property rule writes a color', () => {
  const colors: string[] = [];
  for (const rule of all) {
    if (tokenRules.includes(rule)) continue;
    const text = rule.body.replace(/url\([^)]*\)/g, '');
    for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(|(?<![-\w])(?:white|black)(?![-\w])/g)) colors.push(`${rule.selector}: ${match[0]}`);
  }
  assert.deepEqual(colors, []);
});

test('the controls, choices and actions read the size properties', () => {
  const body = (selector: string) => all.filter(rule => rule.selector === selector).map(rule => declarations(rule.body));
  assert.deepEqual(body('.crudui-input').map(d => [d['min-height'], d['border'], d['border-radius']]),
    [['var(--crudui-control-height)', '1px solid var(--crudui-control-border)', 'var(--crudui-radius)']]);
  assert.deepEqual(body('.crudui-choices__label').map(d => [d['min-height'], d['border-radius']]), [['var(--crudui-control-height)', 'var(--crudui-radius)']]);
  assert.deepEqual(body('.crudui-action').map(d => [d.width, d.height, d['border-radius'], d.color]),
    [['var(--crudui-action-size)', 'var(--crudui-action-size)', 'var(--crudui-radius)', 'var(--crudui-action-text)']]);
  assert.deepEqual(body(".crudui-form__footer .crudui-action--text[type='submit']").map(d => [d.background, d['border-color'], d.color]),
    [['var(--crudui-submit-background)', 'var(--crudui-submit-border)', 'var(--crudui-submit-text)']]);
});
