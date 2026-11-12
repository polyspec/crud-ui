import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeHtml } from './normalize.mts';

test('HTML attribute names are case insensitive, values and IDs are not', () => {
  assert.equal(normalizeHtml('<input autoComplete="off" readOnly>'), normalizeHtml('<input autocomplete="off" readonly="readonly">'));
  assert.notEqual(normalizeHtml('<input id="A" value="A">'), normalizeHtml('<input id="a" value="a">'));
  assert.notEqual(normalizeHtml('<input className="x">'), normalizeHtml('<input class="x">'));
});
test('quoted angle brackets and scripts are parsed without rewriting values', () => {
  const html = '<input value="a>b"><script>if (a < b) run("x>y");</script>';
  assert.equal(normalizeHtml(html), html);
});
test('textarea and preformatted whitespace remain significant', () => {
  assert.notEqual(normalizeHtml('<textarea> a  b </textarea>'), normalizeHtml('<textarea>a b</textarea>'));
  assert.equal(normalizeHtml('<pre>  a\n b </pre>'), '<pre>  a\n b </pre>');
});
test('SVG attribute case is preserved by the HTML parser', () => {
  assert.match(normalizeHtml('<svg viewBox="0 0 10 10"></svg>'), /viewBox="0 0 10 10"/);
});
test('CSS strings with semicolons and URL data remain intact', () => {
  const html = `<div style="font-family: 'a;b'; color:red"></div>`;
  assert.equal(normalizeHtml(html), `<div style="font-family: 'a;b'; color: red"></div>`);
});
test('distinct row keys, input paths and hidden states remain different', () => {
  assert.notEqual(normalizeHtml('<input name="rows[__0000000000001__][name]">'), normalizeHtml('<input name="rows[__0000000000007__][name]">'));
  assert.notEqual(normalizeHtml('<div style="display:none"></div>'), normalizeHtml('<div></div>'));
});
