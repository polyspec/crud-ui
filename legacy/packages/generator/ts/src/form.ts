import { FormInputError, type FileLoader } from '@polyspec/crudui-validator';
import { isEmptyValue } from '@polyspec/crudui-validator/internal';
import {
  checkOptionText, checkedComposition, composeProperties, groupSourceFailure, isMultiple, isNumberRange, isStep, MemoryLoader,
} from '@polyspec/crudui-validator/internal';
import { checkDeclaredAttributes } from './design';
import { checkBindText } from './input-text';
import { makeTranslate, type Language } from './content';
import { DEFAULT_FORM_BUTTONS, FORM_BUTTON_TYPES } from './buttons';
import { formMessages } from './messages';
import { checkFormTemplate } from './template-shape';
import { buildField, type BuildState, type NodeVM, type UnsupportedMode } from './viewmodel';
import { isPlainRecord, isRecord } from './util';

/** A data-independent field blueprint. Repeated children are stored just once. */
export interface FormFieldTemplate {
  /** Property name relative to the parent group. */
  readonly name: string;
  /** Composed field settings without nested properties. */
  readonly spec: Readonly<Record<string, unknown>>;
  /** Nested field definitions, stored once for repeated groups. */
  readonly children: readonly FormFieldTemplate[];
}

/** JSON-serializable, immutable form structure. Safe to share between records. */
export interface FormTemplate {
  /** Template format identifier. */
  readonly kind: 'crudui/form-template';
  /** Optional root prefix for input names. */
  readonly keyPrefix?: string;
  /** Top-level field definitions. */
  readonly fields: readonly FormFieldTemplate[];
  /** Form buttons in declaration order; one submit button when the spec declares none. */
  readonly buttons: readonly Readonly<Record<string, unknown>>[];
  /** Submission target declared by the spec, kept unchanged in the template. */
  readonly action?: Readonly<Record<string, unknown>>;
  /** Root description content as declared by the spec, translated when the form is rendered. */
  readonly description?: unknown;
}

/** Composition inputs used only when preparing a template. */
export interface CompileFormOptions {
  /** Documents available to composition references. */
  files?: Record<string, Record<string, unknown>>;
  /** Composition document loader. */
  loader?: FileLoader;
  /** Directory used to resolve relative references. */
  basepath?: string;
  /** Root prefix for input names. */
  keyPrefix?: string;
}

/** Per-instance data and presentation; never stored in the shared template. */
export interface BindFormOptions {
  /** Stable DOM identifier prefix; use distinct values for forms in one document. */
  idPrefix?: string;
  /** Content and interface language, defaulting to Korean. */
  language?: Language;
  /** Instance input prefix overriding the template prefix. */
  keyPrefix?: string;
  /** Unsupported widget handling. */
  unsupported?: UnsupportedMode;
  /** Row paths (`{collection}.{key}`) rendered collapsed; omitted renders every row expanded. */
  collapsed?: ReadonlySet<string>;
}

/** Copy JSON-shaped values, retaining browser File/Blob and other opaque values. */
export function copyFormValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copyFormValue);
  if (isPlainRecord(value)) return copyFormRecord(value);
  return value;
}

/** Copy a JSON object, its members as `copyFormValue` copies them. */
export function copyFormRecord(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copyFormValue(v)]));
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}


/** A string, or a condition map: a non-empty object. */
function conditionValue(value: unknown): boolean {
  return typeof value === 'string' || (isRecord(value) && Object.keys(value).length > 0);
}

/** A child that renders one scalar value: not repeated, not a group and not a language field. */
function scalarChild(child: unknown): boolean {
  if (!isRecord(child)) return false;
  const repeated = child.multiple === true || child.multiple === 'only' || isRecord(child.multiple);
  const lang = child.lang === true || isRecord(child.lang);
  return child.type !== 'group' && !('properties' in child) && !repeated && !lang;
}

/** Keys of the buckets the schema closes; any other key in them is rejected. */
const CLOSED_BUCKET_KEYS: Record<string, readonly string[]> = {
  multiple: ['only', 'min', 'max', 'copy', 'sortable', 'title', 'controls', 'header', 'onclick', 'keys'],
  lang: ['mode', 'only', 'name', 'key', 'frame', 'title', 'group_class'],
  design: ['show', 'class', 'style', 'label', 'wrapper', 'group', 'prepend'],
  node: ['class', 'style'],
  fieldDesign: ['show', 'class', 'style', 'attributes', 'label', 'wrapper', 'group', 'prepend'],
  conditionDesign: ['show', 'class', 'style', 'attributes', 'editor', 'label', 'wrapper', 'group', 'prepend'],
  groupDesign: ['show', 'class', 'style', 'attributes', 'layout', 'label', 'wrapper', 'group', 'prepend'],
  fieldWrapper: ['class', 'style', 'attributes'],
  behavior: ['onchange', 'onclick', 'onload'],
};

/** Keys `multiple` accepts beside `only: true`. */
const ONLY_MULTIPLE_KEYS: readonly string[] = ['only', 'title', 'header', 'keys'];

/** Whether an object has its own member. */
function has(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** Fail a declaration at `path` for an invalid member. */
function fail(path: string, key: string, expected: string): never {
  throw new FormInputError(`Invalid ${key} at ${path}: expected ${expected}`);
}

/** Fail a declaration at `path` for a member of `object` that `allowed` does not list. */
function closed(path: string, object: Record<string, unknown>, name: string, allowed: readonly string[]): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) throw new FormInputError(`Invalid ${name}.${key} at ${path}: unknown key`);
  }
}

/**
 * Reject an unknown key or a wrong value type in one field's `multiple`, `lang`, `design` and
 * `behavior` declarations. Within a bucket, unknown keys are checked in declaration order before
 * the values.
 */
function checkDeclarations(spec: Record<string, unknown>, path: string, field = true): void {
  // Buttons and the submission target belong to the form, not to a field.
  for (const key of ['buttons', 'action']) {
    if (has(spec, key)) fail(path, key, 'the form root');
  }
  if (has(spec, 'multiple')) {
    const multiple = spec.multiple;
    if (typeof multiple !== 'boolean' && multiple !== 'only' && !isRecord(multiple)) {
      fail(path, 'multiple', 'a boolean, only or an object');
    }
    if (isRecord(multiple)) {
      closed(path, multiple, 'multiple', CLOSED_BUCKET_KEYS.multiple);
      if (has(multiple, 'only') && typeof multiple.only !== 'boolean') fail(path, 'multiple.only', 'a boolean');
      // Rows of a data-only collection come from the data: row limits and row controls do not apply.
      if (multiple.only === true) {
        for (const key of Object.keys(multiple)) {
          if (!ONLY_MULTIPLE_KEYS.includes(key)) throw new FormInputError(`Invalid multiple.${key} at ${path}: unknown key`);
        }
      }
      // A keyed map is a data-only collection; validation resolves its reference (docs/spec/schema.md, Keyed maps).
      if (has(multiple, 'keys')) {
        if (multiple.only !== true) fail(path, 'multiple.keys', 'multiple.only: true');
        if (typeof multiple.keys !== 'string') fail(path, 'multiple.keys', 'a reference to a repeated group');
      }
      for (const key of ['min', 'max']) {
        if (has(multiple, key) && typeof multiple[key] !== 'number') fail(path, `multiple.${key}`, 'a number');
      }
      for (const key of ['copy', 'sortable']) {
        if (has(multiple, key) && typeof multiple[key] !== 'boolean') fail(path, `multiple.${key}`, 'a boolean');
      }
      if (has(multiple, 'title')) {
        if (spec.type !== 'group') fail(path, 'multiple.title', 'a repeated group');
        const properties = isRecord(spec.properties) ? spec.properties : {};
        if (typeof multiple.title !== 'string' || !has(properties, multiple.title) || !scalarChild(properties[multiple.title])) {
          fail(path, 'multiple.title', 'the name of a direct child field without multiple, properties or lang');
        }
      }
      if (has(multiple, 'controls') && !(typeof multiple.controls === 'string' && ['header', 'footer', 'outline'].includes(multiple.controls))) {
        fail(path, 'multiple.controls', 'header, footer or outline');
      }
      if (has(multiple, 'header') && !(typeof multiple.header === 'string' && ['static', 'sticky'].includes(multiple.header))) {
        fail(path, 'multiple.header', 'static or sticky');
      }
    }
  }
  if (has(spec, 'lang') && typeof spec.lang !== 'boolean' && !isRecord(spec.lang)) {
    fail(path, 'lang', 'a boolean or an object');
  }
  if (isRecord(spec.lang)) closed(path, spec.lang, 'lang', CLOSED_BUCKET_KEYS.lang);
  if (isRecord(spec.lang) && has(spec.lang, 'only')) {
    const only = spec.lang.only;
    const codes = Array.isArray(only) && only.every(code => typeof code === 'string');
    if (!codes && !isRecord(only)) fail(path, 'lang.only', 'a list of language codes or an object');
  }
  if (has(spec, 'design')) checkDesignDeclaration(spec.design, path, field, field ? groupLayouts(spec) : undefined, field && isConditionType(spec.type));
  if (isRecord(spec.behavior)) closed(path, spec.behavior, 'behavior', CLOSED_BUCKET_KEYS.behavior);
  if (field && typeof spec.type === 'string' && spec.type.toLowerCase() === 'range') checkRangeDeclaration(spec, path);
  if (field && isConditionType(spec.type)) checkConditionDeclaration(spec, path);
  else if (field && isRecord(spec.options) && has(spec.options, 'fields')) failConditionFields(path);
}

/** Whether a declared type is the condition field type. */
function isConditionType(type: unknown): boolean {
  return typeof type === 'string' && type.toLowerCase() === 'condition';
}

/** Reject `options.fields` outside a structured condition field or with names that break its rule (CUSC-084). */
function failConditionFields(path: string): never {
  throw new FormInputError(`Invalid options.fields at ${path}: expected distinct field names of a structured condition editor`);
}

/**
 * Reject a condition field whose `validate.conditionTree` is not the literal `true` or `judge`
 * (docs/spec/schema.md, Condition fields): every value of the field is checked as a condition tree.
 */
function checkConditionDeclaration(spec: Record<string, unknown>, path: string): void {
  const parameter = isRecord(spec.validate) ? spec.validate.conditionTree : undefined;
  if (parameter !== true && parameter !== 'judge') {
    throw new FormInputError(`Invalid validate.conditionTree at ${path}: expected true or judge`);
  }
  // The editor (docs/spec/schema.md, Structured condition editor): design.editor is text or structured
  // (CUSC-083), and options.fields belongs to a structured editor (CUSC-084).
  const editor = isRecord(spec.design) && has(spec.design, 'editor') ? spec.design.editor : 'text';
  if (editor !== 'text' && editor !== 'structured') fail(path, 'design.editor', 'text or structured');
  if (isRecord(spec.options) && has(spec.options, 'fields')) {
    const fields: unknown = spec.options.fields;
    const list: unknown[] = Array.isArray(fields) ? fields : [];
    const names = list.filter((name): name is string => typeof name === 'string' && !isEmptyValue(name));
    const valid = Array.isArray(fields) && names.length === list.length && new Set(names).size === names.length;
    if (editor !== 'structured' || !valid) failConditionFields(path);
  }
}

/**
 * Reject a range field without literal bounds and a literal step whose multiple the minimum is
 * (docs/spec/schema.md, Range fields): the slider moves from the minimum in steps.
 */
function checkRangeDeclaration(spec: Record<string, unknown>, path: string): void {
  const validate = isRecord(spec.validate) ? spec.validate : {};
  if (!isNumberRange(validate.range)) {
    throw new FormInputError(`Invalid validate.range at ${path}: expected [minimum, maximum] finite numbers with minimum not above maximum`);
  }
  if (!isStep(validate.step)) throw new FormInputError(`Invalid validate.step at ${path}: expected a finite number above 0`);
  if (!isMultiple(validate.range[0], validate.step)) {
    throw new FormInputError(`Invalid validate.range at ${path}: expected a minimum that is a multiple of validate.step`);
  }
}

/**
 * The `design.layout` values a group field accepts (docs/spec/schema.md, Layout): a repeated group
 * has no line, and a field that is not a group has no layout.
 */
function groupLayouts(spec: Record<string, unknown>): readonly string[] | undefined {
  if (spec.type !== 'group') return undefined;
  const repeated = spec.multiple === true || spec.multiple === 'only' || isRecord(spec.multiple);
  return repeated ? ['stacked', 'inline'] : ['stacked', 'inline', 'line'];
}

/**
 * Reject an unknown key or a wrong value type in one `design` declaration at `path`. Form fields,
 * form buttons, list and detail specifications, their columns and fields share this rule; only a
 * form field (`field`) accepts `attributes` and `wrapper.attributes`, and only a group field
 * accepts `layout`, one of `layouts`.
 */
export function checkDesignDeclaration(design: unknown, path: string, field = false, layouts?: readonly string[], condition = false): void {
  if (typeof design !== 'boolean' && !isRecord(design)) fail(path, 'design', 'a boolean or an object');
  if (isRecord(design)) {
    const keys = layouts ? CLOSED_BUCKET_KEYS.groupDesign
      : condition ? CLOSED_BUCKET_KEYS.conditionDesign : field ? CLOSED_BUCKET_KEYS.fieldDesign : CLOSED_BUCKET_KEYS.design;
    closed(path, design, 'design', keys);
    if (has(design, 'show') && typeof design.show !== 'boolean' && !conditionValue(design.show)) {
      fail(path, 'design.show', 'an expression, a boolean or a condition map');
    }
    for (const key of ['class', 'style']) {
      if (has(design, key) && !conditionValue(design[key])) fail(path, `design.${key}`, 'a string or a condition map');
    }
    if (has(design, 'attributes')) checkDeclaredAttributes(design.attributes, 'design.attributes', path);
    if (layouts && has(design, 'layout') && !(typeof design.layout === 'string' && layouts.includes(design.layout))) {
      fail(path, 'design.layout', layouts.length === 3 ? 'stacked, inline or line' : 'stacked or inline');
    }
    for (const node of ['label', 'wrapper', 'group', 'prepend']) {
      if (!has(design, node)) continue;
      const value = design[node];
      if (!isRecord(value)) fail(path, `design.${node}`, 'an object');
      const nodeKeys = field && node === 'wrapper' ? CLOSED_BUCKET_KEYS.fieldWrapper : CLOSED_BUCKET_KEYS.node;
      closed(path, value, `design.${node}`, nodeKeys);
      for (const key of ['class', 'style']) {
        if (has(value, key) && !conditionValue(value[key])) {
          fail(path, `design.${node}.${key}`, 'a string or a condition map');
        }
      }
      if (has(value, 'attributes')) {
        checkDeclaredAttributes(value.attributes, `design.${node}.attributes`, path);
      }
    }
  }
}

/** Reject a wrong root `action` or `buttons` declaration. */
function checkFormDeclarations(spec: Record<string, unknown>): void {
  if (has(spec, 'action')) {
    const action = spec.action;
    if (!isRecord(action)) fail('form', 'action', 'an object');
    for (const key of ['method', 'url', 'enctype']) {
      if (has(action, key) && typeof action[key] !== 'string') {
        fail('form', `action.${key}`, 'a string');
      }
    }
  }
  if (!has(spec, 'buttons')) return;
  const buttons: unknown = spec.buttons;
  if (!Array.isArray(buttons)) fail('form', 'buttons', 'a list of buttons');
  // A button type without interface text needs declared text.
  const texts = formMessages('ko');
  buttons.forEach((button: unknown, index) => {
    const key = `buttons.${index}`;
    if (!isRecord(button)) fail('form', key, 'an object');
    const declared = button;
    const type = FORM_BUTTON_TYPES.find(name => name === declared.type);
    if (type === undefined) fail('form', `${key}.type`, 'submit, reset, button or link');
    for (const name of ['name', 'value', 'href']) {
      if (has(declared, name) && typeof declared[name] !== 'string') fail('form', `${key}.${name}`, 'a string');
    }
    if (!has(texts, type) && !has(declared, 'text')) fail('form', `${key}.text`, 'content for this button type');
    if (declared.type === 'link' && !has(declared, 'href')) fail('form', `${key}.href`, 'a link target');
    checkDeclarations(declared, `form.${key}`, false);
  });
}

function compileFields(properties: Record<string, unknown>, root: Record<string, unknown>, parent = ''): FormFieldTemplate[] {
  return Object.entries(properties).flatMap(([name, raw]) => {
    if (!isRecord(raw)) return [];
    const path = parent ? `${parent}.${name}` : name;
    checkDeclarations(raw, path);
    // A group source is checked after the other declarations of the field (docs/spec/schema.md,
    // Choices from a repeated group).
    const sourceFailure = groupSourceFailure(raw, path, root);
    if (sourceFailure !== undefined) throw new FormInputError(sourceFailure);
    const { properties: children, ...spec } = raw;
    return [{
      name,
      spec,
      children: isRecord(children) ? compileFields(children, root, path) : [],
    }];
  });
}

/** The buttons of a form root that checkFormDeclarations has checked: the declared list, else the default buttons. */
function formButtons(buttons: unknown): readonly Readonly<Record<string, unknown>>[] {
  if (buttons === undefined) return DEFAULT_FORM_BUTTONS;
  if (!Array.isArray(buttons) || !buttons.every(isRecord)) throw new FormInputError('Invalid buttons at form: expected a list of buttons');
  return buttons;
}

/** Compose and prepare the entire form before any record data exists. */
export function compileForm(
  rootSpec: Record<string, unknown>,
  options: CompileFormOptions = {}
): FormTemplate {
  // Input text is checked first (docs/spec/input-text.md).
  const checkedLoader = checkedComposition(rootSpec, options);
  checkOptionText(options, ['basepath', 'keyPrefix']);
  if (rootSpec.type !== 'group' || !isRecord(rootSpec.properties)) {
    throw new FormInputError('A form spec must be a group with properties');
  }
  checkFormDeclarations(rootSpec);
  // The form root takes no layout; a group field declares it (docs/spec/schema.md, Layout).
  if (isRecord(rootSpec.design) && Object.prototype.hasOwnProperty.call(rootSpec.design, 'layout')) {
    throw new FormInputError('Invalid design.layout at form: unknown key');
  }
  const properties = composeProperties(
    rootSpec.properties,
    checkedLoader ?? new MemoryLoader(options.files ?? {}),
    options.basepath ? { basepath: options.basepath } : {}
  );
  const root = copyFormRecord(properties);
  return freezeTree({
    kind: 'crudui/form-template' as const,
    keyPrefix: options.keyPrefix,
    fields: compileFields(root, root),
    buttons: formButtons(rootSpec.buttons).map(copyFormRecord),
    ...(isRecord(rootSpec.action) ? { action: copyFormRecord(rootSpec.action) } : {}),
    ...(Object.prototype.hasOwnProperty.call(rootSpec, 'description') ? { description: copyFormValue(rootSpec.description) } : {}),
  });
}

/**
 * The root description of a template translated for `options.language` (default Korean) by the
 * content rule; empty text when the template has none. The `crudui-form` block writes it first
 * when it is not empty.
 */
export function formDescription(template: FormTemplate, options: { language?: Language } = {}): string {
  checkBindText(template, {}, options);
  checkFormTemplate(template);
  const language = options.language ?? 'ko';
  if (typeof language !== 'string') throw new FormInputError('Language must be a string');
  return makeTranslate(language)(template.description);
}

/** Bind fresh data to a cached structure. No loader, composition or template mutation. */
export function bindForm(
  template: FormTemplate,
  data: Record<string, unknown> = {},
  options: BindFormOptions = {}
): NodeVM[] {
  checkBindText(template, data, options);
  checkFormTemplate(template);
  const language = options.language ?? 'ko';
  // Callers can pass decoded JSON; each text option is a string when present.
  if (typeof language !== 'string') throw new FormInputError('Language must be a string');
  for (const name of ['keyPrefix', 'idPrefix'] as const) {
    const value: unknown = options[name];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new FormInputError(`${name} must be a string`);
    }
  }
  const unsupported: unknown = options.unsupported;
  if (unsupported !== undefined && unsupported !== null && unsupported !== 'throw' && unsupported !== 'marker') {
    throw new FormInputError('unsupported must be throw or marker');
  }
  const state: BuildState = {
    data,
    idPrefix: options.idPrefix ?? 'crudui',
    t: makeTranslate(language),
    messages: formMessages(language),
    keyPrefix: options.keyPrefix ?? template.keyPrefix,
    unsupported: options.unsupported ?? 'throw',
    ...(options.collapsed ? { collapsed: options.collapsed } : {}),
  };
  return template.fields.map(field => buildField(field.spec, field.name, state, field.children));
}
