import type { FormInstance } from '@polyspec/crudui-generator-core';
import { renderForm } from '@polyspec/crudui-generator-html';
import { data, companyKey, storeKey, required, type SessionCase } from './scenario.mts';
import { domSnapshot, formSnapshot } from '../../../../tests/form-inspector/form-snapshot.mts';

/**
 * Rendered form state compared between initialization paths: the parsed DOM and the live
 * control state, without serialized HTML, whose attribute order is not part of the DOM.
 */
function renderedState(element: HTMLFormElement) {
  const { html: _html, ...state } = formSnapshot(element, element);
  return state;
}

/** A form session mounted in a form element. */
interface MountedForm {
  session: FormInstance;
  element: HTMLFormElement;
}

/**
 * Parsed DOM of a rendered form without the nodes frameworks use as rendering anchors,
 * which render nothing: comments and empty text. Attribute order is not part of the DOM.
 */
function formDom(form: HTMLElement) {
  // A deep clone of an element is an element of the same kind, of the window of the form.
  const copy = form.cloneNode(true);
  const view = form.ownerDocument.defaultView;
  if (view === null || !(copy instanceof view.HTMLElement)) throw new Error('the clone of the form is no HTML element');
  // NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT
  const walker = copy.ownerDocument.createTreeWalker(copy, 4 | 128);
  const anchors: Node[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 8 || node.nodeValue === '') anchors.push(node);
  }
  for (const node of anchors) node.parentNode?.removeChild(node);
  // A style attribute is a CSS declaration block: compare its declarations as the CSS object
  // model serializes them, as React writes `name: value;` for the markup's `name:value`.
  for (const element of [copy, ...copy.querySelectorAll<HTMLElement | SVGElement>('[style]')]) {
    if (element.style.cssText === '') element.removeAttribute('style');
    else element.setAttribute('style', element.style.cssText);
  }
  return domSnapshot(copy);
}

/**
 * Server rendering taken over by a framework: the HTML renderer's markup, byte-identical
 * to the PHP, PHP extension, Go and Rust renderers, parsed as a server delivers it, must
 * equal the form the framework renders for the same session.
 */
export function compareServerTakeover({ element, session, expect }: Omit<SessionCase, 'flush'>): void {
  const server = element.ownerDocument.createElement('div');
  server.innerHTML = renderForm(session);
  expect(formDom(required(element.querySelector<HTMLElement>('.crudui-form'), 'the rendered form')))
    .toEqual(formDom(required(server.querySelector<HTMLElement>(':scope > *'), 'the server form')));
}

/** Compare initial records with repeated injection into an already mounted form. */
export async function compareInitialization({ initial, deferred, flush, expect }: Omit<SessionCase, 'element' | 'session'> & {
  initial: MountedForm;
  deferred: MountedForm;
}): Promise<void> {
  const before = JSON.stringify(initial.session.template);
  const expected = renderedState(initial.element);
  expect(deferred.element.querySelector('input')).toBeTruthy();
  for (let attempt = 0; attempt < 3; attempt++) {
    deferred.session.setData(data);
    await flush();
    expect(renderedState(deferred.element)).toEqual(expected);
    expect(JSON.stringify(deferred.session.getData())).toBe(JSON.stringify(initial.session.getData()));
    expect(JSON.stringify(deferred.session.template)).toBe(before);
  }
  const changed = structuredClone(data);
  const store: { enabled: number | string } = changed.companies[companyKey].stores[storeKey];
  store.enabled = '';
  const inputs = [initial, deferred].map(instance => instance.element.querySelector('input[type=checkbox]'));
  for (const instance of [initial, deferred]) instance.session.setData(changed);
  await flush();
  expect(renderedState(deferred.element)).toEqual(renderedState(initial.element));
  for (const instance of [initial, deferred]) instance.session.setData(data);
  await flush();
  const restored = renderedState(deferred.element);
  expect(restored).toEqual(renderedState(initial.element));
  expect(restored).toEqual(expected);
  for (const [index, instance] of [initial, deferred].entries()) {
    expect(instance.element.querySelector('input[type=checkbox]')).toBe(inputs[index]);
  }
}
