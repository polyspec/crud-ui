import { required, type FormCase, type FormControl } from './scenario.mts';

/** Typing into controls through each framework's public form component. */
export const typingSpec = {
  type: 'group',
  properties: {
    amount: { type: 'number', label: 'Amount' },
    title: { type: 'text', label: 'Title' },
    memo: { type: 'textarea', label: 'Memo' },
    code: { type: 'text', label: 'Code', behavior: { onchange: 'void 0' } },
    size: { type: 'select', label: 'Size', items: { s: 'Small', m: 'Medium' } },
    color: { type: 'choice', label: 'Color', items: { r: 'Red', g: 'Green' } },
    tags: { type: 'multichoice', label: 'Tags', items: { a: 'Alpha', b: 'Beta' } },
    notice: { type: 'dummy', label: 'Notice', default: '<b>Read</b> first' },
    body: { type: 'tinymce', label: 'Body' },
    lookup: { type: 'search', label: 'Lookup', items: { x: 'X' } },
  },
};

/**
 * Give a document the helpers widget scripts call, as a page that loads the editors does. Each
 * call is recorded in `document.body.dataset.widgetScriptRuns`; a script runs in the document's
 * own global, so the record is kept in the document.
 */
export function installWidgetHost(document: Document): void {
  const script = document.createElement('script');
  script.textContent = `(() => {
    const record = name => { document.body.dataset.widgetScriptRuns = ((document.body.dataset.widgetScriptRuns || '') + ' ' + name).trim(); };
    // jsdom has no CSS object model; the scripts escape identifiers with CSS.escape.
    window.CSS ??= { escape: value => value };
    window.$ = value => { if (typeof value === 'function') value(); return { on() {} }; };
    for (const name of ['editor_tinymce', 'editor_summernote', 'editor_editorjs', 'editor_tui', 'editor_tagify', 'editor_tagify2', 'select2']) {
      window[name] = () => record(name);
    }
  })()`;
  document.head.append(script);
  script.remove();
  delete document.body.dataset.widgetScriptRuns;
}

const widgetScriptRuns = (document: Document) => (document.body.dataset.widgetScriptRuns ?? '').split(' ').filter(Boolean);

/** Insert text at the caret of a control and report the edit as a browser does. */
async function insert(control: FormControl, text: string, flush: () => Promise<void>) {
  if (control.type === 'number') control.value += text;
  else if (control.tagName === 'SELECT') control.value = text;
  else {
    if (!('setRangeText' in control)) throw new TypeError(`${control.tagName} has no caret`);
    control.setRangeText(text, required(control.selectionStart, 'the caret'), required(control.selectionEnd, 'the caret'), 'end');
  }
  control.dispatchEvent(new (required(control.ownerDocument.defaultView, 'the window').Event)(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  await flush();
}

/**
 * Type one character at a time and pick choices. Every re-render keeps the element nodes, so a
 * number control, whose caret cannot be set, keeps the typed order, a text control keeps its
 * caret, a focused choice stays focused, and scripts, styles and raw display content stay. The
 * form is mounted after `installWidgetHost`; each widget script ran once and never runs again.
 */
export async function exerciseTyping({ element, form, expect, flush }: FormCase): Promise<void> {
  const document = element.ownerDocument;
  const nodes = () => Array.from(element.querySelectorAll<HTMLElement>('input, select, textarea, button, script, style, [data-field-path="notice"] b'));
  const initial = nodes();
  expect(initial.filter(node => node.tagName === 'SCRIPT').length).toBeGreaterThanOrEqual(2);
  expect(initial.some(node => node.tagName === 'STYLE')).toBe(true);
  expect(initial.some(node => node.tagName === 'B')).toBe(true);
  const kept = (control: Element) => {
    const current = nodes();
    expect(current).toHaveLength(initial.length);
    expect(current.filter((node, index) => node !== initial[index]).map(node => node.getAttribute('name') || node.outerHTML)).toEqual([]);
    expect(document.activeElement).toBe(control);
  };
  const control = <T extends Element = FormControl>(selector: string) => required(element.querySelector<T>(selector), selector);
  const ran = ['editor_tinymce', 'select2'];
  expect(widgetScriptRuns(document).sort()).toEqual(ran);

  const amount = control<HTMLInputElement>('input[name="amount"]');
  expect(amount.type).toBe('number');
  amount.focus();
  for (const digit of '9104') {
    await insert(amount, digit, flush);
    kept(amount);
  }
  expect(amount.value).toBe('9104');
  expect(String(form.getValue('amount'))).toBe('9104');

  for (const name of ['title', 'memo', 'code']) {
    const text = control<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
    text.focus();
    for (const character of 'abc') {
      await insert(text, character, flush);
      kept(text);
    }
    text.setSelectionRange(1, 1);
    await insert(text, 'X', flush);
    kept(text);
    expect([text.value, text.selectionStart, text.selectionEnd]).toEqual(['aXbc', 2, 2]);
    expect(form.getValue(name)).toBe('aXbc');
  }

  const size = control<HTMLSelectElement>('select[name="size"]');
  size.focus();
  await insert(size, 'm', flush);
  kept(size);
  expect(form.getValue('size')).toBe('m');

  const choices: Array<[selector: string, value: string | string[]]> = [['input[name="color"][value="g"]', 'g'], ['input[name="tags[]"][value="b"]', ['b']]];
  for (const [selector, value] of choices) {
    const choice = control<HTMLInputElement>(selector);
    choice.focus();
    choice.click();
    await flush();
    kept(choice);
    expect(choice.checked).toBe(true);
    expect(form.getValue(selector.includes('color') ? 'color' : 'tags')).toEqual(value);
  }
  expect(widgetScriptRuns(document).sort()).toEqual(ran);
}
