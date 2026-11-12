/** Evaluate prepared form fields, values and conditions into the node grammar. */

import {
  controlId,
  getValueByPath,
  isRecord,
  joinClass,
  jsString,
  parsePathString,
  styleString,
  toBracketNotationWithPrefix,
} from './util';
import { declaredAttributes, resolveDesign, type ResolvedDesign } from './design';
import { makeContext } from './expr';
import { FormInputError } from '@polyspec/crudui-validator';
import { groupChoices, isGroupSource } from '@polyspec/crudui-validator/internal';
import { UnsupportedFieldTypeError } from './errors';
import { CHOICE_LIST_EXPECTED, checkChoiceAppearance, choicePairs, isChoiceList } from './choice-list';
import type { Translate } from './content';
import { formatCount, type FormMessages } from './messages';
import { evalWidget, WIDGET_CANONICAL, WIDGET_LAYOUTS, type WidgetCtx, type WidgetModel } from './widget';
import type { FormFieldTemplate } from './form';

/** Behavior when a field `type` has no registered widget. */
export type UnsupportedMode = 'throw' | 'marker';

/** Per-build state threaded through the recursive tree builder. */
export interface BuildState {
  /** Stable DOM identifier prefix. */
  idPrefix: string;
  /** The root form data (the expr engine's formData). */
  data: Record<string, unknown>;
  /** Optional name/id prefix. */
  keyPrefix?: string;
  /** Content translator (active language). */
  t: Translate;
  /** Interface text (active language). */
  messages: FormMessages;
  /** Unsupported-type handling (default 'throw' — never silent). */
  unsupported: UnsupportedMode;
  /** Repeated path segment positions, independent of their key encoding. */
  rowSegments?: readonly number[];
  /** One-based positions of the enclosing repeated rows. */
  rowNumbers?: readonly number[];
  /** Number of enclosing rows with a sticky header. */
  stickyDepth?: number;
  /** Row paths rendered collapsed. */
  collapsed?: ReadonlySet<string>;
  /** Layout of the field nodes from the enclosing groups (docs/spec/schema.md, Layout). */
  layout?: 'inline';
}

/** A surfaced unsupported-type marker (only in 'marker' mode). */
export interface UnsupportedVM {
  /** Unsupported field discriminator. */
  unsupported: true;
  /** Requested widget type. */
  type: string;
}

/** Node kinds of the form grammar; each is a `crudui-node--{kind}` modifier. */
export type NodeKind = 'field' | 'group' | 'collection' | 'row' | 'lang' | 'lang-item';

/** Row and collection operations in control order. */
export type RowActionName = 'move-up' | 'move-down' | 'add-row' | 'copy-row' | 'remove-row';

/** One control button. */
export interface ActionVM {
  /** Operation name (`data-crudui-action`). */
  name: RowActionName;
  /** Accessible label. */
  label: string;
  /** Whether the operation is unavailable for the current data. */
  disabled: boolean;
}

/** Where row controls are rendered. */
export type ControlsPlacement = 'header' | 'footer' | 'outline';

/** A group of controls for one row or empty collection. */
export interface ControlsVM {
  /** Rendering position. */
  placement: ControlsPlacement;
  /** Accessible group name. */
  label: string;
  /** Buttons in control order. */
  actions: ActionVM[];
}

/** Header parts of a node (`crudui-node__header`). */
export interface NodeHeader {
  /** Header class (`design.label`). */
  className: string;
  /** Header inline style (`design.label`). */
  style?: string;
  /** Label text (`__label`). */
  label?: string;
  /** Control identifier the label targets; absent renders a span. */
  labelFor?: string;
  /** Description text (`__description`). */
  description?: string;
  /** Row number (`__number`). */
  number?: string;
  /** Row title (`__title`) or language section title. */
  title?: string;
  /** Collapsed row summary (`__summary`). */
  summary?: string;
  /** Collection row count (`__count`). */
  count?: string;
}

/** Body slot of a node (`crudui-node__body`). */
export interface NodeBody {
  /** Body class (`design.group` for groups and group rows). */
  className: string;
  /** Body inline style. */
  style?: string;
  /** Body identifier targeted by a row toggle. */
  id?: string;
}

/** A standalone checkbox or switcher whose caption is its own label. */
export interface CheckboxVM {
  /** Control identifier. */
  id: string;
  /** Submission name. */
  name: string;
  /** Control class. */
  className: string;
  /** Checked state from the bound data. */
  checked: boolean;
  /** `switch` for a switcher field (docs/spec/form-markup.md, Switches); absent for a checkbox. */
  role?: 'switch';
  /** Caption text; absent when an inline layout writes the label in the node header. */
  caption?: string;
  /** Declared attributes (`design.attributes`), present only when declared. */
  attributes?: Record<string, string>;
}

/** One evaluated node of the recursive form grammar. */
export interface NodeVM {
  /** Node kind. */
  kind: NodeKind;
  /** Data path relative to the form root (field, group, collection and lang nodes). */
  path?: string;
  /** Row key (row nodes). */
  key?: string;
  /** Language code (lang-item nodes). */
  lang?: string;
  /** Root class (`design.wrapper`). */
  className: string;
  /** Root inline style (`design.wrapper`). */
  style?: string;
  /** Root declared attributes (`design.wrapper.attributes`), present only when declared. */
  attributes?: Record<string, string>;
  /** Whether `design.show` hides the node. */
  hidden: boolean;
  /** Header slot, present only with content. */
  header?: NodeHeader;
  /** Body slot. */
  body: NodeBody;
  /** Row or empty collection controls. */
  controls?: ControlsVM;
  /** Collection item kind. */
  item?: 'field' | 'group';
  /** Whether a row body contains child nodes that can be collapsed. */
  collapsible?: boolean;
  /** Whether a collapsible row is expanded. */
  expanded?: boolean;
  /** Accessible label of the row toggle. */
  toggleLabel?: string;
  /** Whether the row header sticks while scrolling. */
  sticky?: boolean;
  /** Number of enclosing sticky row headers. */
  stickyDepth?: number;
  /** Widget of a field, scalar row or language item. */
  widget?: WidgetModel | UnsupportedVM;
  /** Standalone checkbox or switcher. */
  checkbox?: CheckboxVM;
  /** Child nodes in the body. */
  children?: NodeVM[];
}

// ---------------------------------------------------------------------------
// Multiple and language settings
// ---------------------------------------------------------------------------

/** Evaluated controls and limits for a repeated field. */
interface MultipleSettings {
  /** Rows come only from the data: missing data is zero rows and no row control renders. */
  only: boolean;
  min?: number;
  max?: number;
  copy: boolean;
  sortable: boolean;
  title?: string;
  controls: ControlsPlacement;
  header: 'static' | 'sticky';
}

function resolveMultiple(spec: Record<string, unknown>): MultipleSettings | null {
  const m = spec.multiple;
  if (m === true) return { only: false, copy: false, sortable: false, controls: 'header', header: 'static' };
  if (m === 'only') return { only: true, copy: false, sortable: false, controls: 'header', header: 'static' };
  if (!isRecord(m)) return null;
  const o = m;
  return {
    only: o.only === true,
    ...(typeof o.min === 'number' ? { min: o.min } : {}),
    ...(typeof o.max === 'number' ? { max: o.max } : {}),
    copy: o.copy === true,
    sortable: o.sortable === true,
    ...(typeof o.title === 'string' ? { title: o.title } : {}),
    controls: o.controls === 'footer' || o.controls === 'outline' ? o.controls : 'header',
    header: o.header === 'sticky' ? 'sticky' : 'static',
  };
}

const DEFAULT_LANGS = ['ko', 'en', 'ja', 'zh'];

interface LangSettings {
  langs: string[];
  frame: boolean;
  title?: unknown;
  groupClass?: string;
}

function resolveLang(spec: Record<string, unknown>): LangSettings | null {
  const l = spec.lang;
  if (l === undefined || l === false) return null;
  if (l === true) return { langs: DEFAULT_LANGS, frame: true };
  if (isRecord(l)) {
    const o = l;
    const only = o.only;
    return {
      langs:
        Array.isArray(only) && only.length > 0 && only.every((lang): lang is string => typeof lang === 'string') ? only : DEFAULT_LANGS,
      frame: o.frame !== false,
      title: o.title,
      groupClass: typeof o.group_class === 'string' ? o.group_class : undefined,
    };
  }
  return null;
}

/** Row keys of a keyed collection. Missing data has one initial row, or none in a data-only collection. */
function rowKeys(value: unknown, path: string, only: boolean): string[] {
  if (value === undefined) return only ? [] : ['__0000000000000__'];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FormInputError(`Repeated data must be a keyed object: ${path}`);
  }
  return Object.keys(value);
}

/** Present group data, including a repeated group row, must be an object. */
function checkGroupData(value: unknown, path: string): void {
  if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) {
    throw new FormInputError(`Group data must be an object: ${path}`);
  }
}

// ---------------------------------------------------------------------------
// Node parts
// ---------------------------------------------------------------------------

function nodeRoot(
  kind: NodeKind,
  path: string,
  design: ResolvedDesign,
  spec: Record<string, unknown>
): Pick<NodeVM, 'kind' | 'path' | 'className' | 'style' | 'attributes' | 'hidden'> {
  const style = styleString(design.wrapper.style);
  const attributes = declaredAttributes(spec.design, path).wrapper;
  return {
    kind,
    path,
    className: design.wrapper.class,
    ...(style ? { style } : {}),
    ...(Object.keys(attributes).length ? { attributes } : {}),
    hidden: !design.show,
  };
}

/** Header with the given parts, or undefined when every part is empty. */
function nodeHeader(parts: Omit<NodeHeader, 'className' | 'style'>, design?: ResolvedDesign): NodeHeader | undefined {
  const present = Object.entries(parts).filter(([, value]) => value !== undefined && value !== '');
  if (!present.length) return undefined;
  const style = design ? styleString(design.label.style) : undefined;
  return { className: design?.label.class ?? '', ...(style ? { style } : {}), ...Object.fromEntries(present) };
}

function nodeBody(className = '', style?: string, id?: string): NodeBody {
  const resolved = styleString(style);
  return { className, ...(resolved ? { style: resolved } : {}), ...(id ? { id } : {}) };
}

function action(name: RowActionName, label: string, disabled: boolean): ActionVM {
  return { name, label, disabled };
}

function labelTarget(widget: WidgetModel | UnsupportedVM): string | undefined {
  if ('unsupported' in widget) return undefined;
  return widget.extra?.file?.id ?? widget.attrs.id;
}

// ---------------------------------------------------------------------------
// Leaf widget evaluation and unsupported-type result
// ---------------------------------------------------------------------------

function buildWidget(
  declared: Record<string, unknown>,
  value: unknown,
  path: string,
  design: ResolvedDesign,
  state: BuildState
): WidgetModel | UnsupportedVM {
  // A group source lists the rows of its group in the data as a choice list (docs/spec/schema.md,
  // Choices from a repeated group); compilation has checked the source.
  const spec = isGroupSource(declared.items)
    ? { ...declared, items: groupChoices(declared.items, state.data) }
    : declared;
  const type = jsString(spec.type ?? '');
  if (isChoiceList(spec.items)) {
    // Only the choices of a choice or multichoice field declare their appearance, and only the
    // choice list of a select field has groups.
    const appearance = WIDGET_LAYOUTS[type.toLowerCase()] === 'choices';
    const groups = WIDGET_CANONICAL[type.toLowerCase()] === 'select';
    if (!choicePairs(spec.items, appearance, groups)) {
      throw new FormInputError(`Invalid items at ${path}: expected ${CHOICE_LIST_EXPECTED}`);
    }
    if (appearance) checkChoiceAppearance(spec.items, path);
  }
  const ctx: WidgetCtx = {
    spec,
    value,
    path,
    keyPrefix: state.keyPrefix,
    idPrefix: state.idPrefix,
    design,
    attributes: declaredAttributes(spec.design, path).control,
    t: state.t,
    messages: state.messages,
    rowSegments: state.rowSegments,
  };
  const model = evalWidget(type, ctx);
  if (model) return model;
  if (state.unsupported === 'throw') {
    throw new UnsupportedFieldTypeError(type, path);
  }
  return { unsupported: true, type };
}

// ---------------------------------------------------------------------------
// Node tree builder
// ---------------------------------------------------------------------------

/** Build the node for one already-composed field spec. */
export function buildField(
  spec: Record<string, unknown>,
  path: string,
  state: BuildState,
  children: readonly FormFieldTemplate[]
): NodeVM {
  const design = resolveDesign(spec.design, makeContext(parsePathString(path), state.data, state.rowSegments));
  const label = spec.label ? state.t(spec.label) : undefined;
  const description = spec.description ? state.t(spec.description) : undefined;
  const multiple = resolveMultiple(spec);
  if (multiple) return buildCollection(spec, path, design, label, description, multiple, state, children);
  if (spec.type === 'group') return buildGroup(spec, path, design, label, description, state, children);
  const lang = resolveLang(spec);
  if (lang) return buildLang(spec, path, design, label, description, lang, state);
  return buildLeaf(spec, path, design, label, description, state);
}

function buildLeaf(
  spec: Record<string, unknown>,
  path: string,
  design: ResolvedDesign,
  label: string | undefined,
  description: string | undefined,
  state: BuildState
): NodeVM {
  const fieldType = jsString(spec.type ?? '');
  const value = getValueByPath(state.data, path);
  const declaredRoot = nodeRoot('field', path, design, spec);
  // A field node of an inline layout is one row of a label column and a control column.
  const root = state.layout === 'inline'
    ? { ...declaredRoot, className: joinClass('crudui-node--inline', declaredRoot.className) }
    : declaredRoot;
  if (fieldType === 'checkbox' || fieldType === 'switcher') {
    const id = controlId(state.idPrefix, path);
    // An inline layout writes the label in the label column of the header instead of the caption.
    const headerLabel = state.layout === 'inline' && label ? label : undefined;
    const header = nodeHeader(headerLabel ? { label: headerLabel, labelFor: id, description } : { description }, design);
    const attributes = declaredAttributes(spec.design, path).control;
    // A switcher is a checkbox input announced and drawn as a switch.
    const switcher = fieldType === 'switcher';
    return {
      ...root,
      ...(header ? { header } : {}),
      body: nodeBody(),
      checkbox: {
        id,
        name: toBracketNotationWithPrefix(path, state.keyPrefix),
        className: joinClass('valid-target', switcher ? 'crudui-input crudui-input--switch' : '', design.main.class),
        checked: value === true || value === 1 || value === '1' ||
          (value === undefined && (spec.default === true || spec.default === 1 || spec.default === '1')),
        ...(switcher ? { role: 'switch' as const } : {}),
        ...(headerLabel ? {} : { caption: label ?? '' }),
        ...(Object.keys(attributes).length ? { attributes } : {}),
      },
    };
  }
  const widget = buildWidget(spec, value, path, design, state);
  if (fieldType === 'hidden') return { ...root, body: nodeBody(), widget };
  const labelFor = label ? labelTarget(widget) : undefined;
  const header = nodeHeader({ label, ...(labelFor ? { labelFor } : {}), description }, design);
  return { ...root, ...(header ? { header } : {}), body: nodeBody(), widget };
}

/** The `design.layout` a group declares; compilation has checked the value. */
function declaredLayout(spec: Record<string, unknown>): string | undefined {
  const design = spec.design;
  if (!isRecord(design)) return undefined;
  const layout = design.layout;
  return typeof layout === 'string' ? layout : undefined;
}

/** The state of a group's children: a declared layout replaces the inherited one, and a line ends it. */
function layoutState(state: BuildState, layout: string | undefined): BuildState {
  if (layout === undefined) return state;
  const next: BuildState = { ...state };
  delete next.layout;
  return layout === 'inline' ? { ...next, layout: 'inline' } : next;
}

function buildGroup(
  spec: Record<string, unknown>,
  path: string,
  design: ResolvedDesign,
  label: string | undefined,
  description: string | undefined,
  state: BuildState,
  templates: readonly FormFieldTemplate[]
): NodeVM {
  checkGroupData(getValueByPath(state.data, path), path);
  const header = nodeHeader({ label, description }, design);
  const layout = declaredLayout(spec);
  const root = nodeRoot('group', path, design, spec);
  // A line group is one row in an inline layout, and its children take no inline layout.
  const modifiers = layout === 'line' ? [state.layout === 'inline' ? 'crudui-node--inline' : '', 'crudui-node--line'] : [];
  return {
    ...root,
    className: joinClass(...modifiers, root.className),
    ...(header ? { header } : {}),
    body: nodeBody(design.group.class, design.group.style),
    children: buildChildren(path, layoutState(state, layout), templates),
  };
}

function buildCollection(
  spec: Record<string, unknown>,
  path: string,
  design: ResolvedDesign,
  label: string | undefined,
  description: string | undefined,
  settings: MultipleSettings,
  state: BuildState,
  templates: readonly FormFieldTemplate[]
): NodeVM {
  const keys = rowKeys(getValueByPath(state.data, path), path, settings.only);
  const item = spec.type === 'group' ? 'group' : 'field';
  const full = settings.max !== undefined && keys.length >= settings.max;
  const rowsState = item === 'group' ? layoutState(state, declaredLayout(spec)) : state;
  const rows = keys.map((key, index) => buildRow(spec, path, key, index, keys.length, item, label, settings, rowsState, templates));
  const header = nodeHeader({ label, description, count: formatCount(state.messages.count, keys.length) }, design);
  return {
    ...nodeRoot('collection', path, design, spec),
    ...(header ? { header } : {}),
    body: nodeBody(),
    item,
    ...(keys.length === 0 && !settings.only ? {
      controls: {
        placement: 'footer',
        label: state.messages.collectionControls,
        actions: [action('add-row', state.messages.addRow, full)],
      },
    } : {}),
    children: rows,
  };
}

function buildRow(
  spec: Record<string, unknown>,
  collectionPath: string,
  key: string,
  index: number,
  count: number,
  item: 'field' | 'group',
  label: string | undefined,
  settings: MultipleSettings,
  state: BuildState,
  templates: readonly FormFieldTemplate[]
): NodeVM {
  const messages = state.messages;
  const rowPath = `${collectionPath}.${key}`;
  const rowDesign = resolveDesign(spec.design, makeContext(parsePathString(rowPath), state.data, [...(state.rowSegments ?? []), parsePathString(collectionPath).length]));
  const numbers = [...(state.rowNumbers ?? []), index + 1];
  const sticky = settings.header === 'sticky';
  const rowState: BuildState = {
    ...state,
    rowSegments: [...(state.rowSegments ?? []), parsePathString(collectionPath).length],
    rowNumbers: numbers,
    stickyDepth: (state.stickyDepth ?? 0) + (sticky ? 1 : 0),
  };
  const row = {
    kind: 'row' as const,
    key,
    className: '',
    hidden: false,
    // Rows of a data-only collection have no row controls.
    ...(settings.only ? {} : { controls: rowControls(settings, messages, index, count) }),
    ...(sticky ? { sticky: true, stickyDepth: state.stickyDepth ?? 0 } : {}),
  };
  const number = numbers.join('.');
  if (item === 'field') {
    return {
      ...row,
      header: { className: '', ...(label ? { label } : {}), number },
      body: nodeBody(),
      widget: buildWidget(spec, getValueByPath(state.data, rowPath), rowPath, rowDesign, rowState),
    };
  }
  checkGroupData(getValueByPath(state.data, rowPath), rowPath);
  const children = buildChildren(rowPath, rowState, templates);
  const nested = children.filter(child => child.kind === 'collection');
  const summary = nested.length
    ? formatCount(messages.children, nested.reduce((total, child) => total + (child.children?.length ?? 0), 0))
    : messages.collapsed;
  let title: string | undefined;
  if (settings.title !== undefined) {
    const value = getValueByPath(state.data, `${rowPath}.${settings.title}`);
    title = value === undefined || value === null || value === '' ? messages.untitled : jsString(value);
  }
  return {
    ...row,
    header: { className: '', ...(label ? { label } : {}), number, ...(title !== undefined ? { title } : {}), summary },
    body: nodeBody(rowDesign.group.class, rowDesign.group.style, `${controlId(state.idPrefix, rowPath)}:body`),
    collapsible: true,
    expanded: !state.collapsed?.has(rowPath),
    toggleLabel: messages.toggleRow,
    children,
  };
}

function rowControls(settings: MultipleSettings, messages: FormMessages, index: number, count: number): ControlsVM {
  const full = settings.max !== undefined && count >= settings.max;
  const actions: ActionVM[] = [];
  if (settings.sortable) {
    actions.push(action('move-up', messages.moveUp, index === 0), action('move-down', messages.moveDown, index === count - 1));
  }
  actions.push(action('add-row', messages.addRow, full));
  if (settings.copy) actions.push(action('copy-row', messages.copyRow, full));
  actions.push(action('remove-row', messages.removeRow, settings.min !== undefined && count <= settings.min));
  return { placement: settings.controls, label: messages.rowControls, actions };
}

function buildChildren(
  path: string,
  state: BuildState,
  templates: readonly FormFieldTemplate[]
): NodeVM[] {
  return templates.map(field =>
    buildField(field.spec, `${path}.${field.name}`, state, field.children));
}

function buildLang(
  spec: Record<string, unknown>,
  path: string,
  design: ResolvedDesign,
  label: string | undefined,
  description: string | undefined,
  lang: LangSettings,
  state: BuildState
): NodeVM {
  const title = lang.title ? state.t(lang.title) : '';
  const header = nodeHeader({ label, description, title }, design);
  const root = nodeRoot('lang', path, design, spec);
  return {
    ...root,
    // A framed language group is a node modifier; the stylesheet draws the frame around its body.
    className: joinClass(lang.frame ? 'crudui-node--framed' : '', root.className),
    ...(header ? { header } : {}),
    body: nodeBody(joinClass(lang.groupClass)),
    children: lang.langs.map((code) => {
      const langPath = `${path}.${code}`;
      const langDesign = resolveDesign(spec.design, makeContext(parsePathString(langPath), state.data, state.rowSegments));
      return {
        kind: 'lang-item' as const,
        lang: code,
        className: '',
        hidden: false,
        header: { className: '', label: code },
        body: nodeBody(),
        widget: buildWidget(spec, getValueByPath(state.data, langPath), langPath, langDesign, state),
      };
    }),
  };
}
