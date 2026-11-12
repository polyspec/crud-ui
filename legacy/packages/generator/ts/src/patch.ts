/**
 * Replace an element's content with rendered markup while keeping every existing node that the
 * new markup still contains. A string renderer re-renders the whole form after each change;
 * patching keeps the focused control, its text selection and an input method composition, as
 * the framework renderers do.
 *
 * Nodes match by kind and element name, and elements by their identity: a row key, a field
 * path, an id, or a control name with its value for checkboxes and radio buttons. Unkeyed nodes
 * match in order. Attributes are set to those of the new markup; control values and checked states
 * are live properties, which `connectForm().sync()` sets from the form.
 *
 * A script runs once, when its markup first appears: each script in inserted markup becomes a new
 * script element once the whole markup is in place, and the browser runs it when it is connected,
 * so a script finds the controls that follow it. A kept script never runs again: a parsed or
 * cloned script never runs, and changing a started script's text does not run it.
 */
export function patchContent(element: Element, html: string): void {
  const template = element.ownerDocument.createElement('template');
  template.innerHTML = html;
  const scripts: Array<[Comment, Element]> = [];
  patchChildren(element, template.content, scripts);
  for (const [mark, script] of scripts) mark.replaceWith(freshScript(script));
}

/** Whether a node is an element. */
function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

/** Whether a node is a template element, whose children are those of its content. */
function isTemplate(node: Node): node is HTMLTemplateElement {
  return node.nodeName === 'TEMPLATE';
}

function identity(node: Node): string | undefined {
  if (!isElement(node)) return undefined;
  const element = node;
  const row = element.getAttribute('data-crudui-row-key');
  if (row !== null) return `row:${row}`;
  const path = element.getAttribute('data-field-path');
  if (path !== null) return `path:${path}`;
  if (element.id) return `id:${element.id}`;
  const name = element.getAttribute('name');
  if (name === null) return undefined;
  const type = element.getAttribute('type');
  return type === 'checkbox' || type === 'radio' ? `name:${name}:${element.getAttribute('value') ?? ''}` : `name:${name}`;
}

/** A new script element with the attributes and text of a parsed one; it runs when connected. */
function freshScript(script: Element): Element {
  const fresh = script.ownerDocument.createElement('script');
  for (const { name, value } of Array.from(script.attributes)) fresh.setAttribute(name, value);
  fresh.textContent = script.textContent;
  return fresh;
}

/**
 * Imported markup with each script held aside behind a comment until the whole markup is in
 * place; a comment never runs, while some engines run an imported script.
 */
function imported(node: Node, scripts: Array<[Comment, Element]>): Node {
  if (!isElement(node)) return node;
  const element = node;
  const hold = (script: Element) => {
    const mark = element.ownerDocument.createComment('');
    scripts.push([mark, script]);
    return mark;
  };
  if (element.nodeName === 'SCRIPT') return hold(element);
  for (const script of Array.from(element.querySelectorAll('script'))) script.replaceWith(hold(script));
  return element;
}

const sameKind = (current: Node, next: Node) => current.nodeType === next.nodeType && current.nodeName === next.nodeName;

function patchChildren(parent: Element | DocumentFragment, source: Node, scripts: Array<[Comment, Element]>): void {
  const unused: Node[] = Array.from(parent.childNodes);
  const keyed = new Map<string, Node>();
  for (const node of unused) {
    const key = identity(node);
    if (key !== undefined && !keyed.has(key)) keyed.set(key, node);
  }
  let position: Node | null = parent.firstChild;
  for (const next of Array.from(source.childNodes)) {
    const key = identity(next);
    let current: Node | undefined;
    if (key !== undefined) {
      const candidate = keyed.get(key);
      if (candidate && sameKind(candidate, next)) current = candidate;
    } else {
      current = unused.find(node => identity(node) === undefined && sameKind(node, next));
    }
    if (current) {
      unused.splice(unused.indexOf(current), 1);
      if (key !== undefined) keyed.delete(key);
      if (current !== position) parent.insertBefore(current, position);
      else position = position.nextSibling;
      patchNode(current, next, scripts);
    } else {
      parent.insertBefore(imported(parent.ownerDocument.importNode(next, true), scripts), position);
    }
  }
  for (const node of unused) node.parentNode?.removeChild(node);
}

function patchNode(current: Node, next: Node, scripts: Array<[Comment, Element]>): void {
  if (!isElement(current) || !isElement(next)) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  const element = current;
  const source = next;
  for (const { name } of Array.from(element.attributes)) {
    if (!source.hasAttribute(name)) element.removeAttribute(name);
  }
  for (const { name, value } of Array.from(source.attributes)) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  const content = (node: Element) => (isTemplate(node) ? node.content : node);
  patchChildren(content(element), content(source), scripts);
}
