/**
 * CRUDUI design-slot resolver — appearance = visibility (`show`) + per-DOM-node
 * appearance map (R8). SPEC §3 common-role distribution; mirrors
 * validator-ts/src/types.ts:258 DesignSlot.
 *
 * All appearance lives in this one slot's node map. No other meta key
 * (element_class/label_class/group_class/wrapper_class/prepend_class/
 * display_switch/display_target/style) is read here — the renderer derives EVERY
 * appearance value from `design` alone.
 *
 * Slot polymorphism (Slot<DesignSlot>, types.ts:90):
 *   - design === false → slot OFF: every node appearance is empty, show stays
 *     true (turning appearance off does not hide the field).
 *   - design === true / {} → default ON: no appearance, show true.
 *   - design === { ...map } → per-node appearance + optional show.
 *
 * Each appearance value (`show`/`class`/`style`, and each node's `class`/`style`)
 * is an `Evaluated` value resolved through the shared expr engine (expr.ts) —
 * literal, expression, or condition map. eval is never called.
 */

import { FormInputError } from '@polyspec/crudui-validator';
import type { PathContext } from '@polyspec/crudui-validator';
import { evalShow, evalAppearance } from './expr';
import { isRecord } from './util';

/** Resolved class+style for one DOM node. */
export interface ResolvedNode {
  /** Class string for the node ('' when none). */
  class: string;
  /** Inline style string for the node ('' when none). */
  style: string;
}

/** Fully resolved design for one field at render time. */
export interface ResolvedDesign {
  /** Visibility (false → wrapper carries `display: none`, DOM kept). */
  show: boolean;
  /** Main (input) node appearance. */
  main: ResolvedNode;
  /** Header (`crudui-node__header`) appearance. */
  label: ResolvedNode;
  /** Node root (`crudui-node`) appearance. */
  wrapper: ResolvedNode;
  /** Group body (`crudui-node__body`) appearance. */
  group: ResolvedNode;
  /** Prepend affix (`crudui-widget__affix`) appearance. */
  prepend: ResolvedNode;
}

const EMPTY_NODE: ResolvedNode = { class: '', style: '' };

function emptyDesign(): ResolvedDesign {
  return {
    show: true,
    main: { ...EMPTY_NODE },
    label: { ...EMPTY_NODE },
    wrapper: { ...EMPTY_NODE },
    group: { ...EMPTY_NODE },
    prepend: { ...EMPTY_NODE },
  };
}

/** Resolve a `DesignNode` ({ class, style }) against the eval context. */
function resolveNode(
  node: unknown,
  ctx: PathContext
): ResolvedNode {
  if (!isRecord(node)) {
    return { ...EMPTY_NODE };
  }
  const n = node;
  return {
    class: 'class' in n ? evalAppearance(n.class, ctx) : '',
    style: 'style' in n ? evalAppearance(n.style, ctx) : '',
  };
}

/**
 * Resolve a `Slot<DesignSlot>` into a `ResolvedDesign`. `false`/`true`/`{}` are
 * the no-appearance cases (show stays true); an object yields per-node values.
 */
export function resolveDesign(
  design: unknown,
  ctx: PathContext
): ResolvedDesign {
  // false (off) / true / undefined → default: no appearance, shown.
  if (design === false || design === true || design === undefined || design === null) {
    return emptyDesign();
  }
  if (!isRecord(design)) {
    return emptyDesign();
  }
  const d = design;
  return {
    show: 'show' in d ? evalShow(d.show, ctx) : true,
    main: {
      class: 'class' in d ? evalAppearance(d.class, ctx) : '',
      style: 'style' in d ? evalAppearance(d.style, ctx) : '',
    },
    label: resolveNode(d.label, ctx),
    wrapper: resolveNode(d.wrapper, ctx),
    group: resolveNode(d.group, ctx),
    prepend: resolveNode(d.prepend, ctx),
  };
}

/** Attributes a form field declares (docs/spec/schema.md, Declared attributes). */
export interface DeclaredAttributes {
  /** `design.attributes`: attributes of the field's control. */
  control: Record<string, string>;
  /** `design.wrapper.attributes`: attributes of the field's node root. */
  wrapper: Record<string, string>;
}

/**
 * A copy of the declared attributes `value` at `key` of the node at `path`, none when it is absent. Compilation has checked
 * them; a template that did not come from compileForm, such as decoded JSON, fails here as compilation fails.
 */
export function attributeCopy(value: unknown, key: string, path: string): Record<string, string> {
  if (value === undefined) return {};
  checkDeclaredAttributes(value, key, path);
  return { ...value };
}

/**
 * The declared attributes of the field design of the node at `path` in declaration order; a design without them yields
 * empty objects.
 */
export function declaredAttributes(design: unknown, path: string): DeclaredAttributes {
  if (!isRecord(design)) return { control: {}, wrapper: {} };
  const wrapper = isRecord(design.wrapper) ? design.wrapper.attributes : undefined;
  return { control: attributeCopy(design.attributes, 'design.attributes', path), wrapper: attributeCopy(wrapper, 'design.wrapper.attributes', path) };
}

/**
 * Names of a `data-*` or `aria-*` attribute: lowercase letters, digits, `-`, `_` and `.` after the
 * prefix, starting with a letter or a digit.
 */
const DECLARED_ATTRIBUTE_NAME = /^(?:data|aria)-[a-z0-9][a-z0-9._-]*$/;
/** Prefixes of attribute names crudui writes on a control or a node root. */
const OWNED_ATTRIBUTE_PREFIXES: readonly string[] = ['data-crudui-', 'data-source-'];
/** Attribute names crudui writes on a control or a node root. */
const OWNED_ATTRIBUTE_NAMES: readonly string[] = [
  'data-field-path', 'data-lang', 'data-name', 'data-rule-name', 'data-default', 'data-is-default',
  'data-type', 'data-height', 'data-upload-server', 'data-fileserver', 'data-server', 'data-max-tags',
  'data-keyword-min-length', 'data-delay', 'data-api-server', 'data-max-width', 'data-min-width',
  'data-max-height', 'data-min-height', 'data-preview-max-width', 'data-preview-max-height',
  'data-unsupported-type',
];

/** Reject declared attributes at `key` that are not an object of permitted names to strings. */
export function checkDeclaredAttributes(attributes: unknown, key: string, path: string): asserts attributes is Record<string, string> {
  if (!isRecord(attributes)) {
    throw new FormInputError(`Invalid ${key} at ${path}: expected an object`);
  }
  for (const name of Object.keys(attributes)) {
    if (!DECLARED_ATTRIBUTE_NAME.test(name) || OWNED_ATTRIBUTE_NAMES.includes(name) ||
        OWNED_ATTRIBUTE_PREFIXES.some(prefix => name.startsWith(prefix))) {
      throw new FormInputError(`Invalid ${key}.${name} at ${path}: expected a data-* or aria-* name that crudui does not write`);
    }
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (typeof value !== 'string') throw new FormInputError(`Invalid ${key}.${name} at ${path}: expected a string`);
  }
}
