// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { patchContent } from './patch';
import { present } from './test-support';

function root(html: string) {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element;
}

describe('patchContent keeps the nodes the new markup still contains', () => {
  test('controls, their live values and focus survive a render', () => {
    const element = root('<label for="a">A</label><input id="a" name="form[a]" value="1">');
    document.body.append(element);
    const input = present(element.querySelector('input'), 'the input');
    input.value = 'typed';
    input.focus();
    patchContent(element, '<label for="a">Name</label><input id="a" name="form[a]" value="2" class="changed">');
    expect(element.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('typed');
    expect(input.getAttribute('value')).toBe('2');
    expect(input.className).toBe('changed');
    expect(element.querySelector('label')?.textContent).toBe('Name');
    element.remove();
  });

  test('keyed rows move, disappear and appear by their key', () => {
    const row = (key: string, text: string) => `<div data-crudui-row-key="${key}"><input name="form[rows][${key}][v]" value="${text}"></div>`;
    const element = root(row('a', 'A') + row('b', 'B') + row('c', 'C'));
    const [a, b, c] = Array.from(element.children);
    patchContent(element, row('c', 'C') + row('a', 'A') + row('d', 'D'));
    const rows = Array.from(element.children);
    expect(rows.map(node => node.getAttribute('data-crudui-row-key'))).toEqual(['c', 'a', 'd']);
    expect(rows[0]).toBe(c);
    expect(rows[1]).toBe(a);
    expect(rows).not.toContain(b);
    expect(element.innerHTML).toBe(row('c', 'C') + row('a', 'A') + row('d', 'D'));
  });

  test('checkboxes and radio buttons of one name are matched by value', () => {
    const choices = (values: string[]) => values.map(value => `<input type="checkbox" name="form[tags][]" value="${value}">`).join('');
    const element = root(choices(['x', 'y']));
    const [x, y] = Array.from(element.querySelectorAll('input'));
    patchContent(element, choices(['y', 'x']));
    expect(Array.from(element.querySelectorAll('input'))).toEqual([y, x]);
  });

  test('removed attributes, changed text and a different element are applied', () => {
    const element = root('<p class="old" hidden>Before</p><span>kept</span>');
    const paragraph = element.firstElementChild;
    patchContent(element, '<p>After</p><strong>kept</strong>');
    expect(element.firstElementChild).toBe(paragraph);
    expect(element.innerHTML).toBe('<p>After</p><strong>kept</strong>');
  });

  test('the result is the new markup', () => {
    const element = root('<ul><li>1</li><li>2</li><li>3</li></ul><p id="x">x</p>');
    const next = '<p id="x" data-a="1">y</p><ul><li>2</li></ul>';
    patchContent(element, next);
    expect(element.innerHTML).toBe(next);
  });

  test('a script runs once when its markup first appears, never again on a patch', () => {
    // A script runs in the document's own global, so it records its runs in the document.
    const runs = { get scriptRuns() { return (document.body.dataset.scriptRuns ?? '').split(' ').filter(Boolean); } };
    delete document.body.dataset.scriptRuns;
    const script = (text: string) => `<script nonce="">document.body.dataset.scriptRuns = (document.body.dataset.scriptRuns ?? '') + ' ${text}'</script>`;
    const row = (key: string, text: string) => `<div data-crudui-row-key="${key}">${script(key + ':' + text)}</div>`;
    const element = document.createElement('div');
    document.body.append(element);
    patchContent(element, row('a', '1'));
    expect(runs.scriptRuns).toEqual(['a:1']);
    const first = present(element.querySelector('script'), 'the first script');
    expect(first.getAttribute('nonce')).toBe('');
    patchContent(element, row('a', '1'));
    patchContent(element, row('b', '1') + row('a', '2'));
    expect(element.querySelector('[data-crudui-row-key="a"] script')).toBe(first);
    expect(first.textContent).toContain('a:2');
    expect(runs.scriptRuns).toEqual(['a:1', 'b:1']);
    patchContent(element, row('a', '2') + row('b', '1') + script('top'));
    expect(runs.scriptRuns).toEqual(['a:1', 'b:1', 'top']);
    expect(element.innerHTML).toBe(row('a', '2') + row('b', '1') + script('top'));
    element.remove();
  });

  test('an inserted script runs after the whole markup is in place', () => {
    delete document.body.dataset.scriptRuns;
    const element = document.createElement('div');
    document.body.append(element);
    const probe = `<script>document.body.dataset.scriptRuns = document.getElementById('later') ? 'found' : 'missing'</script>`;
    patchContent(element, `<div>${probe}</div><p id="later"></p>`);
    expect(document.body.dataset.scriptRuns).toBe('found');
    element.remove();
  });
});
