/**
 * CRUDUI widget evaluator (framework-agnostic core) — markup 0, evaluation only.
 *
 * This is the value-computation half of the former fields.ts: it derives the
 * per-widget ATTRIBUTE values, CONTENT strings, item classification (static vs
 * dynamic {model} source), and inline script text for one leaf field, WITHOUT
 * emitting any markup. The React/Vue/Svelte adapters consume the returned
 * `WidgetModel` and assemble the real element tree (JSX / h() / .svelte) — none
 * of them recompute a single value.
 *
 * What it inherits unchanged from fields.ts:
 *  - the data-attr trio (data-name/data-rule-name/data-default) via util.ts
 *    leafName/ruleNameForPath/phpString,
 *  - the main-node class base + resolved design.class,
 *  - placeholder/prepend/append CONTENT via t() over LocalizedText,
 *  - behavior → opaque on-event attrs (no minify, no expr eval),
 *  - options.* chrome settings → data-* values,
 *  - items source classification: static array | choice list | value-label map → [key,label][];
 *    dynamic { model, ... } → STUB (never enumerated, no fabricated options),
 *  - value formatting (date/datetime), applyDefaultString display value.
 *
 * No meta key outside the role slots is read; no markup string is built; eval is
 * never called.
 */

import { formatDateValue } from './date';
import {
  applyDefaultString,
  cleanStr,
  elementId,
  conditionText,
  controlId,
  isRecord,
  joinClass,
  jsString,
  leafName,
  phpString,
  phpTruthy,
  ruleNameForPath,
  styleString,
  toBracketNotationWithPrefix,
} from './util';
import type { ResolvedDesign } from './design';
import { choiceAppearances, choiceGroups, choicePairs, isChoiceList } from './choice-list';
import type { Translate } from './content';
import { conditionEditor, type ConditionEditorModel } from './condition-editor';
import type { FormMessages } from './messages';

/** Inputs every widget evaluator needs for one leaf field. */
export interface WidgetCtx {
  /** Stable DOM identifier prefix. */
  idPrefix?: string;
  /** The composed (single-spec) field node. */
  spec: Record<string, unknown>;
  /** The field's current value. */
  value: unknown;
  /** Dot path within the form. */
  path: string;
  /** Positions of repeated rows in the path, derived from form structure. */
  rowSegments?: readonly number[];
  /** Optional name/id prefix. */
  keyPrefix?: string;
  /** Resolved design appearance for this field. */
  design: ResolvedDesign;
  /** Declared attributes of the control (`design.attributes`) in declaration order. */
  attributes?: Attrs;
  /** Content translator (active language). */
  t: Translate;
  /** Interface messages of the form language, for the controls a widget writes itself. */
  messages?: FormMessages;
}

/** Flat attribute bag (exact HTML attribute names, lowercase). */
export type Attrs = Record<string, string>;

/** A prepend/append affix span (content + optional class/style). */
export interface Affix {
  /** Translated affix text. */
  text: string;
  /** CSS class. */
  class?: string;
  /** Inline style. */
  style?: string;
}

/** One static option for select/choice/multichoice/search. */
export interface OptionModel {
  /** Submitted value. */
  value: string;
  /** Display label (translated). */
  label: string;
  /** Selected/checked for the current value. */
  selected: boolean;
  /** This option equals the spec default (choice data-is-default). */
  isDefault: boolean;
  /** DOM id for the paired input (choice/multichoice). */
  id?: string;
  /** Label class of the choice (choice list `class`), present only when declared. */
  className?: string;
  /** Label inline style of the choice (choice list `style`), present only when declared. */
  style?: string;
  /** Input attributes of the choice (choice list `attributes`), present only when declared. */
  attributes?: Attrs;
  /** Group of a select option inside a choice list group, present only for such an option. */
  group?: OptionGroupModel;
}

/** The group of a select option (docs/spec/form-markup.md, "Choice groups"). */
export interface OptionGroupModel {
  /** Zero-based position of the group in the choice list; options of one group share it. */
  index: number;
  /** Display label of the group (translated). */
  label: string;
}

/** A run of consecutive options: the options of one group, or options outside groups. */
export interface OptionSection {
  /** Group of the options, absent for options outside groups. */
  group?: OptionGroupModel;
  /** Options in list order. */
  options: OptionModel[];
}

/**
 * Split options into runs of consecutive options with the same group, in list order. A renderer
 * writes a section with a group as one `optgroup` element and the other options directly.
 */
export function optionSections(options: readonly OptionModel[]): OptionSection[] {
  const sections: OptionSection[] = [];
  for (const option of options) {
    const last = sections[sections.length - 1];
    if (last && option.group && last.group?.index === option.group.index) last.options.push(option);
    else if (last && !option.group && !last.group) last.options.push(option);
    else sections.push(option.group ? { group: option.group, options: [option] } : { options: [option] });
  }
  return sections;
}

/** data-source-* descriptor for a dynamic `{model}` items stub. */
export type SourceAttrs = Attrs;

/**
 * The fully-evaluated, markup-free description of one leaf widget. A field
 * adapter renders the element tree from THIS — it computes nothing.
 */
export interface WidgetModel {
  /** Resolved field type (registry key). */
  kind: string;
  /** Layout family for the adapter (how to wrap the control). */
  layout:
    | 'widget' // prepend? + control + append? inside .crudui-widget
    | 'bare' // control alone (password/hidden/datetime)
    | 'host-script' // control + trailing <script> chrome (editors/tagify)
    | 'choices' // radios/checkboxes inside .crudui-choices
    | 'file' // image/file/cover file-input cluster inside .crudui-widget
    | 'display' // dummy/dummy-input/image-viewer display-only
    | 'search' // select2 host: style?/script + .crudui-widget--search
    | 'range' // prepend? + range input + output + append? inside .crudui-widget--range
    | 'condition' // prepend? + textarea + structured condition editor or its error + append? inside .crudui-widget--condition
    | 'button'; // button/action: a button element with its content
  /** Main control element name ('input'|'select'|'textarea'|'div'|'button'). */
  tag?: 'input' | 'select' | 'textarea' | 'div' | 'button';
  /** Main control attributes (lowercase HTML names). Empty for file/cover. */
  attrs: Attrs;
  /** Textarea/dummy text content, range output text and button content (already display-resolved). */
  text?: string;
  /** RAW html for a display widget (dummy/image-viewer) — passes unescaped. */
  rawHtml?: string;
  /** Static options (select/choice/multichoice/search). */
  options?: OptionModel[];
  /** The structured condition editor, or its named error (layout `condition`). */
  condition?: ConditionEditorModel;
  /** Dynamic source stub descriptor (data-source-* attrs), or null when static. */
  source?: SourceAttrs | null;
  /** Prepend affix (content + design.prepend node). */
  prepend?: Affix;
  /** Append affix (content). */
  append?: Affix;
  /** Per-option label class (choice/multichoice). */
  itemLabelClass?: string;
  /** Inline script chrome text (editors/tagify/search). */
  script?: string;
  /** Inline style chrome text (search hide_searching). */
  styleChrome?: string;
  /**
   * Secondary attrs (image readonly display input, file input, choice option input shared attrs
   * and the declared option attributes `option`).
   */
  extra?: Record<string, Attrs>;
}

// ---------------------------------------------------------------------------
// Shared value primitives
// ---------------------------------------------------------------------------

function bracketName(ctx: WidgetCtx): string {
  return toBracketNotationWithPrefix(ctx.path, ctx.keyPrefix);
}

/** The data-name/data-rule-name/data-default attribute trio as a flat bag. */
function dataAttrs(ctx: WidgetCtx): Attrs {
  return {
    'data-name': leafName(ctx.path, ctx.rowSegments),
    'data-rule-name': ruleNameForPath(ctx.path, ctx.rowSegments),
    'data-default': phpString(ctx.spec.default),
  };
}

/** Main-node class: base + resolved design.class (the element slot). */
function mainClass(ctx: WidgetCtx, base: string): string {
  return joinClass(base, ctx.design.main.class);
}

/** Resolved design.style for the main node (canonical), or undefined. */
function mainStyle(ctx: WidgetCtx): string | undefined {
  return styleString(ctx.design.main.style);
}

/** The style attribute of a style string, none when it is empty. */
function styleAttr(style: string | undefined): Attrs {
  return style ? { style } : {};
}

/** Prepend affix from LocalizedText prepend + design.prepend node. */
function prependAffix(ctx: WidgetCtx): Affix | undefined {
  const content = ctx.spec.prepend;
  if (content === undefined || content === null || content === '') return undefined;
  const text = ctx.t(content);
  if (!text) return undefined;
  return {
    text,
    class: joinClass('crudui-widget__affix', ctx.design.prepend.class),
    style: styleString(ctx.design.prepend.style),
  };
}

/** The one option of a select or search field with no option: value '' and the untranslated text select (CUSC-080). */
function placeholderOption(): OptionModel {
  return { value: '', label: 'select', selected: false, isDefault: false };
}

/** Append affix from LocalizedText append (no dedicated design node). */
function appendAffix(ctx: WidgetCtx): Affix | undefined {
  const content = ctx.spec.append;
  if (content === undefined || content === null || content === '') return undefined;
  const text = ctx.t(content);
  if (!text) return undefined;
  return { text, class: 'crudui-widget__affix' };
}

/** placeholder attribute value, or '' when absent/empty. */
function placeholder(ctx: WidgetCtx): string {
  const p = ctx.spec.placeholder;
  if (p === undefined || p === null || p === '') return '';
  return ctx.t(p);
}

/**
 * Behavior slot → opaque on-event attributes (verbatim, no minify, no expr eval,
 * no event→onchange transform). `behavior: false/true` nullifies the slot.
 */
function behaviorAttrs(ctx: WidgetCtx): Attrs {
  const b = ctx.spec.behavior;
  if (!isRecord(b)) return {};
  const out: Attrs = {};
  for (const [action, entry] of Object.entries(b)) {
    let script: string | undefined;
    if (typeof entry === 'string') script = entry;
    else if (isRecord(entry) && typeof entry.script === 'string') {
      script = entry.script;
    }
    if (script) out[action] = script;
  }
  return out;
}

/** A single behavior script for one action (or ''). */
function behaviorScript(ctx: WidgetCtx, action: string): string {
  const b = ctx.spec.behavior;
  if (!isRecord(b)) return '';
  const entry = b[action];
  if (typeof entry === 'string') return entry;
  if (isRecord(entry) && typeof entry.script === 'string') {
    return entry.script;
  }
  return '';
}

/** Read one options.* value as a string, or undefined when absent. */
function optStr(ctx: WidgetCtx, key: string, fallback?: string): string | undefined {
  const o = ctx.spec.options;
  if (isRecord(o)) {
    const v = o[key];
    if (v !== undefined && v !== null) return phpString(v);
  }
  return fallback;
}

/** A required options.* value with a default (always a string). */
function optWith(ctx: WidgetCtx, key: string, fallback: string): string {
  return optStr(ctx, key, fallback) ?? fallback;
}

/** A DYNAMIC items source is a `{ model, ... }` descriptor (DB-backed). */
function isDynamicItemsSource(items: unknown): items is Record<string, unknown> {
  return isRecord(items) && 'model' in items;
}

/**
 * Static items → [key,label] entries. Dynamic source → [] (never enumerate). Binding has checked a
 * choice list and accepted appearance members only for a choice or multichoice field and groups
 * only for a select field.
 */
function itemEntries(items: unknown): Array<[string, unknown]> {
  if (items === null || items === undefined) return [];
  if (isChoiceList(items)) return choicePairs(items, true, true) ?? [];
  if (Array.isArray(items)) return items.map((v, i) => [String(i), v]);
  if (isRecord(items)) {
    if (isDynamicItemsSource(items)) return [];
    return Object.entries(items);
  }
  return [];
}

/** data-source-* attrs for a dynamic items stub (opaque descriptor passthrough). */
function dynamicSourceAttrs(items: Record<string, unknown>): SourceAttrs {
  return {
    'data-source-model': phpString(items.model),
    'data-source-method': items.method !== undefined ? phpString(items.method) : '',
    'data-source-table': items.table !== undefined ? phpString(items.table) : '',
    'data-source-relations':
      'relations' in items ? JSON.stringify(items.relations ?? []) : '[]',
  };
}

/** accept attr: validate.accept (or options.accept), default fallback. */
function acceptAttr(ctx: WidgetCtx, fallback: string): string {
  const validate = ctx.spec.validate;
  if (isRecord(validate)) {
    const a = validate.accept;
    if (typeof a === 'string' && a) return a;
  }
  return optWith(ctx, 'accept', fallback);
}

/** image/file/cover size + preview constraints → data-* attrs. */
function sizeAttrs(ctx: WidgetCtx): Attrs {
  return {
    'data-max-width': optWith(ctx, 'max_width', '0'),
    'data-min-width': optWith(ctx, 'min_width', '0'),
    'data-max-height': optWith(ctx, 'max_height', '0'),
    'data-min-height': optWith(ctx, 'min_height', '0'),
    'data-preview-max-width': optWith(ctx, 'preview_max_width', '0'),
    'data-preview-max-height': optWith(ctx, 'preview_max_height', '0'),
  };
}

function nl2br(s: string): string {
  return s.replace(/(\r\n|\n\r|\r|\n)/g, '<br />$1');
}

// ---------------------------------------------------------------------------
// per-widget evaluators (kind → WidgetModel)
// ---------------------------------------------------------------------------

interface EvaluatorContext extends WidgetCtx {
  controlId: string;
}

type Evaluator = (ctx: EvaluatorContext) => WidgetModel;

function scriptString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function textLike(inputType: string): Evaluator {
  return (ctx) => {
    const displayValue = applyDefaultString(ctx.value, ctx.spec.default);
    const attrs: Attrs = {
      type: inputType,
      name: bracketName(ctx),
      value: displayValue,
      ...(inputType === 'number' ? { step: 'any' } : {}),
      class: mainClass(ctx, 'valid-target crudui-input'),
      ...(placeholder(ctx) ? { placeholder: placeholder(ctx) } : {}),
      ...styleAttr(mainStyle(ctx)),
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
    };
    return {
      kind: inputType,
      layout: 'widget',
      tag: 'input',
      attrs,
      prepend: prependAffix(ctx),
      append: appendAffix(ctx),
    };
  };
}

/**
 * A range input with the bounds and the step of its required `validate.range` and `validate.step`
 * (docs/spec/form-markup.md, Range fields); compilation has checked them.
 */
const range: Evaluator = (ctx) => {
  const displayValue = applyDefaultString(ctx.value, ctx.spec.default);
  const validate = (ctx.spec.validate ?? {}) as { range?: [number, number]; step?: number };
  const [minimum, maximum] = validate.range ?? [];
  return {
    kind: 'range',
    layout: 'range',
    tag: 'input',
    attrs: {
      type: 'range',
      name: bracketName(ctx),
      value: displayValue,
      min: String(minimum),
      max: String(maximum),
      step: String(validate.step),
      class: mainClass(ctx, 'valid-target crudui-input crudui-input--range'),
      ...styleAttr(mainStyle(ctx)),
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
    },
    text: displayValue,
    prepend: prependAffix(ctx),
    append: appendAffix(ctx),
  };
};

const password: Evaluator = (ctx) => ({
  kind: 'password',
  layout: 'bare',
  tag: 'input',
  attrs: {
    type: 'password',
    name: bracketName(ctx),
    value: phpString(ctx.value),
    class: mainClass(ctx, 'valid-target crudui-input'),
    ...styleAttr(mainStyle(ctx)),
    ...dataAttrs(ctx),
  },
});

const textarea: Evaluator = (ctx) => ({
  kind: 'textarea',
  layout: 'widget',
  tag: 'textarea',
  text: applyDefaultString(ctx.value, ctx.spec.default),
  attrs: {
    name: bracketName(ctx),
    class: mainClass(ctx, 'valid-target crudui-input'),
    rows: '5',
    ...styleAttr(mainStyle(ctx)),
    ...behaviorAttrs(ctx),
    ...dataAttrs(ctx),
  },
  prepend: prependAffix(ctx),
  append: appendAffix(ctx),
});

/**
 * A condition field: a textarea holding the condition text of its tree, marked for the browser
 * bindings that decode it (docs/spec/form-markup.md, Condition fields).
 */
const condition: Evaluator = (ctx) => {
  const value = ctx.value === undefined ? ctx.spec.default : ctx.value;
  const model: WidgetModel = {
    kind: 'condition',
    layout: 'widget',
    tag: 'textarea',
    text: conditionText(value),
    attrs: {
      name: bracketName(ctx),
      class: mainClass(ctx, 'valid-target crudui-input crudui-input--condition'),
      rows: '5',
      'data-crudui-value': 'json',
      ...styleAttr(mainStyle(ctx)),
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
      'data-default': conditionText(ctx.spec.default),
    },
    prepend: prependAffix(ctx),
    append: appendAffix(ctx),
  };
  const design = ctx.spec.design;
  if (!(isRecord(design) && design.editor === 'structured')) return model;
  // A structured editor (docs/spec/form-markup.md, Structured condition editor): the textarea keeps the
  // value, hidden while the editor shows it (CUMK-067), visible with a named error otherwise (CUMK-068).
  const messages = ctx.messages;
  if (!messages) throw new Error('a structured condition editor needs the interface messages of the form');
  const options = ctx.spec.options;
  const names: unknown = isRecord(options) ? options.fields : undefined;
  const fields = Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : null;
  const validate = ctx.spec.validate;
  const judge = isRecord(validate) && validate.conditionTree === 'judge';
  const editor = conditionEditor(value, {
    for: ctx.controlId,
    judge,
    fields,
    labels: {
      mode: messages.conditionMode,
      addComparison: messages.conditionAddComparison,
      addGroup: messages.conditionAddGroup,
      addJudge: messages.conditionAddJudge,
      remove: messages.conditionRemove,
    },
    error: messages.conditionInvalid.replace('{path}', ctx.path),
  });
  model.layout = 'condition';
  model.condition = editor;
  if (!('error' in editor)) model.attrs.hidden = '';
  return model;
};

const select: Evaluator = (ctx) => {
  const items = ctx.spec.items;
  const effectiveValue = (() => {
    const v = phpString(ctx.value);
    return ctx.value === undefined ? phpString(ctx.spec.default) : v;
  })();

  if (isDynamicItemsSource(items)) {
    return {
      kind: 'select',
      layout: 'widget',
      tag: 'select',
      attrs: {
        name: bracketName(ctx),
        class: mainClass(ctx, 'valid-target crudui-input crudui-input--select valid-target-async'),
        ...dynamicSourceAttrs(items),
        ...styleAttr(mainStyle(ctx)),
        ...behaviorAttrs(ctx),
        ...dataAttrs(ctx),
      },
      source: dynamicSourceAttrs(items),
      options: [placeholderOption()],
      prepend: prependAffix(ctx),
      append: appendAffix(ctx),
    };
  }

  const entries = itemEntries(items);
  const groups = isChoiceList(items) ? choiceGroups(items) : [];
  const options: OptionModel[] =
    entries.length === 0
      ? [placeholderOption()]
      : entries.map(([key, val], index) => {
          const group = groups[index];
          return {
            value: key,
            label: ctx.t(val) || phpString(val),
            selected: effectiveValue === key,
            isDefault: false,
            ...(group ? { group: { index: group.index, label: ctx.t(group.label) || phpString(group.label) } } : {}),
          };
        });

  return {
    kind: 'select',
    layout: 'widget',
    tag: 'select',
    attrs: {
      name: bracketName(ctx),
      class: mainClass(ctx, 'valid-target crudui-input crudui-input--select'),
      ...styleAttr(mainStyle(ctx)),
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
    },
    source: null,
    options,
    prepend: prependAffix(ctx),
    append: appendAffix(ctx),
  };
};

const hidden: Evaluator = (ctx) => ({
  kind: 'hidden',
  layout: 'bare',
  tag: 'input',
  attrs: {
    type: 'hidden',
    name: bracketName(ctx),
    value: applyDefaultString(ctx.value, ctx.spec.default),
    class: mainClass(ctx, 'valid-target'),
    ...dataAttrs(ctx),
  },
});

/** The choices element: its classes, then the class and style of `design.group`. */
function choicesAttrs(ctx: WidgetCtx, base: string): Attrs {
  const style = styleString(ctx.design.group.style);
  return { class: joinClass(base, ctx.design.group.class), ...(style ? { style } : {}) };
}

/** The options of a choice from its items: the label of each item, its appearance and the id, selection and default that `of` gives it. */
function choiceOptions(
  items: unknown,
  ctx: EvaluatorContext,
  of: { id: (index: number) => string; selected: (value: string) => boolean; isDefault: (value: string) => boolean }
): OptionModel[] {
  const appearances = isChoiceList(items) ? choiceAppearances(items, ctx.path) : [];
  return itemEntries(items).map(([key, label], index) => {
    const value = String(key);
    return {
      value,
      label: ctx.t(label) || phpString(label),
      selected: of.selected(value),
      isDefault: of.isDefault(value),
      id: of.id(index),
      ...appearances[index],
    };
  });
}

const choice: Evaluator = (ctx) => {
  const name = bracketName(ctx);
  const items = ctx.spec.items;
  const dataName = leafName(ctx.path, ctx.rowSegments);
  const dataRuleName = ruleNameForPath(ctx.path, ctx.rowSegments);
  const onchange = behaviorScript(ctx, 'onchange');
  const onclick = behaviorScript(ctx, 'onclick');
  const onAttrs: Attrs = {
    ...(onchange ? { onchange } : {}),
    ...(onclick ? { onclick } : {}),
  };
  const labelClass = joinClass('crudui-choices__label', ctx.design.main.class);

  if (isDynamicItemsSource(items)) {
    return {
      kind: 'choice',
      layout: 'choices',
      attrs: {
        ...choicesAttrs(ctx, 'crudui-choices'),
        ...dynamicSourceAttrs(items),
      },
      source: dynamicSourceAttrs(items),
      options: [],
      itemLabelClass: labelClass,
    };
  }

  const defaultStr =
    ctx.spec.default !== undefined &&
    ctx.spec.default !== null &&
    !Array.isArray(ctx.spec.default)
      ? phpString(ctx.spec.default)
      : null;
  const effectiveValue = (() => {
    const v = phpString(ctx.value);
    return ctx.value === undefined ? defaultStr ?? '' : v;
  })();
  const idPrefix = elementId('choice', ctx.path);
  const options = choiceOptions(items, ctx, {
    id: (index) => `${idPrefix}-${index + 1}`,
    selected: (value) => effectiveValue === value,
    isDefault: (value) => defaultStr !== null && defaultStr === value,
  });

  return {
    kind: 'choice',
    layout: 'choices',
    attrs: choicesAttrs(ctx, 'crudui-choices'),
    source: null,
    options,
    itemLabelClass: labelClass,
    extra: {
      // per-input shared attrs (name + data trio + onchange/onclick).
      input: {
        name,
        'data-name': dataName,
        'data-rule-name': dataRuleName,
        ...onAttrs,
      },
    },
  };
};

const multichoice: Evaluator = (ctx) => {
  const bracketBase = bracketName(ctx);
  const name = `${bracketBase}[]`;
  const items = ctx.spec.items;
  const dataName = leafName(ctx.path, ctx.rowSegments);
  const dataRuleName = ruleNameForPath(ctx.path, ctx.rowSegments);
  const onchange = behaviorScript(ctx, 'onchange');
  const labelClass = joinClass('crudui-choices__label', ctx.design.main.class);

  if (isDynamicItemsSource(items)) {
    return {
      kind: 'multichoice',
      layout: 'choices',
      attrs: {
        ...choicesAttrs(ctx, 'crudui-choices crudui-choices--multiple'),
        ...dynamicSourceAttrs(items),
      },
      source: dynamicSourceAttrs(items),
      options: [],
      itemLabelClass: labelClass,
    };
  }

  let selectedValues: string[];
  if (Array.isArray(ctx.value)) selectedValues = (ctx.value as unknown[]).map(String);
  else if (ctx.value) selectedValues = [jsString(ctx.value)];
  else selectedValues = [];
  if (
    ctx.value === undefined &&
    ctx.spec.default !== undefined &&
    ctx.spec.default !== null
  ) {
    selectedValues = Array.isArray(ctx.spec.default)
      ? (ctx.spec.default as unknown[]).map((d) => phpString(d))
      : [phpString(ctx.spec.default)];
  }

  const idPrefix = `mchoice-${cleanStr(name)}`;
  const options = choiceOptions(items, ctx, {
    id: (index) => `${idPrefix}${index + 1}`,
    selected: (value) => selectedValues.includes(value),
    isDefault: () => false,
  });

  return {
    kind: 'multichoice',
    layout: 'choices',
    attrs: choicesAttrs(ctx, 'crudui-choices crudui-choices--multiple'),
    source: null,
    options,
    itemLabelClass: labelClass,
    extra: {
      input: {
        name,
        'data-name': dataName,
        'data-rule-name': dataRuleName,
        ...(onchange ? { onchange } : {}),
      },
    },
  };
};

const date: Evaluator = (ctx) => {
  const rawValue = applyDefaultString(ctx.value, ctx.spec.default);
  return {
    kind: 'date',
    layout: 'widget',
    tag: 'input',
    attrs: {
      type: 'date',
      name: bracketName(ctx),
      value: formatDateValue(rawValue, 'YYYY-MM-DD'),
      class: mainClass(ctx, 'valid-target crudui-input'),
      ...styleAttr(mainStyle(ctx)),
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
    },
    prepend: prependAffix(ctx),
    append: appendAffix(ctx),
  };
};

const datetime: Evaluator = (ctx) => {
  const rawValue = applyDefaultString(ctx.value, ctx.spec.default);
  return {
    kind: 'datetime',
    layout: 'bare',
    tag: 'input',
    attrs: {
      type: 'datetime-local',
      name: bracketName(ctx),
      value: formatDateValue(rawValue, 'YYYY-MM-DDTHH:mm:ss'),
      class: mainClass(ctx, 'valid-target crudui-input'),
      ...styleAttr(mainStyle(ctx)),
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
    },
  };
};

const dummy: Evaluator = (ctx) => {
  let v: unknown = ctx.value === undefined ? ctx.spec.default : ctx.value;
  const items = ctx.spec.items;
  if (isChoiceList(items)) {
    const text = phpString(v);
    const pair = (choicePairs(items) ?? []).find(([value]) => value === text);
    if (pair) v = pair[1];
  } else if (
    isRecord(items) &&
    !isDynamicItemsSource(items)
  ) {
    const looked = items[phpString(v)];
    if (looked !== undefined) v = looked;
  }
  const textVal = phpString(v);
  // RAW html passthrough — value goes through nl2br only (not escaped).
  const rawHtml = phpTruthy(textVal) ? nl2br(textVal) : textVal;
  const attrs: Attrs = {
    ...(ctx.design.main.class ? { class: ctx.design.main.class } : {}),
    ...styleAttr(styleString(ctx.design.main.style)),
  };
  return {
    kind: 'dummy',
    layout: 'display',
    tag: 'div',
    rawHtml,
    attrs,
  };
};

const dummyInput: Evaluator = (ctx) => {
  const displayValue = applyDefaultString(ctx.value, ctx.spec.default);
  return {
    kind: 'dummy-input',
    layout: 'widget',
    tag: 'input',
    attrs: {
      type: 'text',
      name: bracketName(ctx),
      value: displayValue,
      readonly: '',
      class: mainClass(ctx, 'crudui-input'),
      ...(placeholder(ctx) ? { placeholder: placeholder(ctx) } : {}),
      ...styleAttr(mainStyle(ctx)),
      'data-default': phpString(ctx.spec.default),
    },
    prepend: prependAffix(ctx),
    append: appendAffix(ctx),
  };
};

/**
 * The file widgets: the file control with the accepted types, behind a read-only display control and a button for
 * `image` and `file`, alone for `cover`, whose file name is the `name` member of its bracket name.
 */
function fileWidget(ctx: EvaluatorContext, kind: 'image' | 'file' | 'cover', acceptDefault: string, display: boolean): WidgetModel {
  const name = bracketName(ctx);
  const accept = acceptAttr(ctx, acceptDefault);
  const fileClass = joinClass('valid-target crudui-input crudui-input--file', ctx.design.main.class);
  return {
    kind,
    layout: 'file',
    attrs: {},
    prepend: prependAffix(ctx),
    extra: {
      ...(display ? { display: { type: 'text', class: 'crudui-input', value: '', readonly: '' } } : {}),
      file: {
        type: 'file',
        class: fileClass,
        ...sizeAttrs(ctx),
        name: display ? name : `${name}[name]`,
        'data-name': leafName(ctx.path, ctx.rowSegments),
        'data-rule-name': ruleNameForPath(ctx.path, ctx.rowSegments),
        ...behaviorAttrs(ctx),
        ...(display ? { value: '' } : {}),
        accept,
      },
    },
  };
}

const image: Evaluator = (ctx) => fileWidget(ctx, 'image', 'image/*', true);

const file: Evaluator = (ctx) => fileWidget(ctx, 'file', '*/*', true);

const cover: Evaluator = (ctx) => fileWidget(ctx, 'cover', 'image/*', false);

const imageViewer: Evaluator = (ctx) => {
  const height = optWith(ctx, 'height', '');
  const v = ctx.value;
  const wrapCls = ctx.design.main.class;
  let rawHtml: string;
  if (Array.isArray(v) && v.length > 0) {
    const heightAttr = height ? ` height="${height}"` : '';
    rawHtml = (v as unknown[])
      .map((row) => `<img src="${phpString(row)}"${heightAttr}>`)
      .join('');
  } else {
    // Hardcoded Korean empty literal — kept verbatim (it is not translated).
    rawHtml = '이미지가 없습니다.';
  }
  const attrs: Attrs = wrapCls ? { class: wrapCls } : {};
  return {
    kind: 'image-viewer',
    layout: 'display',
    tag: 'div',
    rawHtml,
    attrs,
  };
};

const search: Evaluator = (ctx) => {
  const name = bracketName(ctx);
  const id = ctx.controlId;
  const items = ctx.spec.items;
  const keywordMinLength = optWith(ctx, 'keyword_min_length', '2');
  const delay = optWith(ctx, 'delay', '250');
  const apiServer = optWith(ctx, 'api_server', '');
  // An absent option is not '', so hide_searching defaults to true.
  const hideSearching = optStr(ctx, 'hide_searching') !== '';
  const onchange = behaviorScript(ctx, 'onchange');

  const effectiveValue = (() => {
    const v = phpString(ctx.value);
    return ctx.value === undefined ? phpString(ctx.spec.default) : v;
  })();

  const dynamic = isDynamicItemsSource(items);
  const options: OptionModel[] = [];
  if (!dynamic && items !== undefined && items !== null) {
    for (const [key, label] of itemEntries(items)) {
      const value = String(key);
      options.push({
        value,
        label: ctx.t(label) || phpString(label),
        selected: effectiveValue === value,
        isDefault: false,
      });
    }
  }
  if (options.length === 0) {
    options.push(placeholderOption());
  }

  const sourceAttrs = dynamic ? dynamicSourceAttrs(items) : null;
  const selectClass = mainClass(
    ctx,
    dynamic
      ? 'valid-target crudui-input crudui-input--select valid-target-async'
      : 'valid-target crudui-input crudui-input--select'
  );

  const selectAttrs: Attrs = {
    class: selectClass,
    ...styleAttr(mainStyle(ctx)),
    name,
    'data-keyword-min-length': keywordMinLength,
    'data-delay': delay,
    'data-api-server': apiServer,
    ...sourceAttrs,
    'data-name': leafName(ctx.path, ctx.rowSegments),
    'data-rule-name': ruleNameForPath(ctx.path, ctx.rowSegments),
    id,
    ...(onchange ? { onchange } : {}),
    'data-default': phpString(ctx.spec.default),
  };

  const callback = optStr(ctx, 'callback');
  const callbackJs = callback ? `$(document.getElementById(${scriptString(id)})).on('select2:select', ${callback});` : '';
  const containerClass = `${id}_select2`;
  const styleChrome = hideSearching
    ? `[class~=${scriptString(containerClass)}] .loading-results { display: none; }`
    : '';
  const script = `$(function() {select2(CSS.escape(${scriptString(id)}), ${scriptString(keywordMinLength)}, ${scriptString(delay)}, ${scriptString(containerClass)});${callbackJs}});`;

  return {
    kind: 'search',
    layout: 'search',
    tag: 'select',
    attrs: selectAttrs,
    source: sourceAttrs,
    options,
    prepend: prependAffix(ctx),
    append: appendAffix(ctx),
    script,
    styleChrome,
  };
};

function editorTextarea(
  kind: string,
  baseClass: string,
  rowsDefault: string,
  buildAttrs: (ctx: WidgetCtx, id: string) => Attrs,
  buildScript: (ctx: WidgetCtx, id: string) => string
): Evaluator {
  return (ctx) => {
    const editorId = ctx.controlId;
    const displayValue = applyDefaultString(ctx.value, ctx.spec.default);
    const rows = optWith(ctx, 'rows', rowsDefault);
    return {
      kind,
      layout: 'host-script',
      tag: 'textarea',
      text: displayValue,
      attrs: {
        id: editorId,
        class: mainClass(ctx, baseClass),
        name: bracketName(ctx),
        rows,
        ...buildAttrs(ctx, editorId),
        ...behaviorAttrs(ctx),
        ...dataAttrs(ctx),
      },
      script: buildScript(ctx, editorId),
    };
  };
}

const tinymce: Evaluator = (ctx) => {
  const editorId = ctx.controlId;
  const rows = optWith(ctx, 'rows', '3');
  const height = optWith(ctx, 'height', '300');
  const upload = optWith(ctx, 'fileserver', 'upload');
  const displayValue = applyDefaultString(ctx.value, ctx.spec.default);
  return {
    kind: 'tinymce',
    layout: 'host-script',
    tag: 'textarea',
    text: displayValue,
    attrs: {
      id: editorId,
      class: mainClass(ctx, 'valid-target crudui-input tinymcearea'),
      name: bracketName(ctx),
      rows,
      'data-type': jsString(ctx.spec.type ?? 'tinymce'),
      'data-height': height,
      'data-upload-server': upload,
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
    },
    script: `$(function() {editor_tinymce('#'+CSS.escape(${scriptString(editorId)}), ${height}, ${scriptString(upload)}, false);});`,
  };
};

const summernote = editorTextarea(
  'summernote',
  'valid-target crudui-input summernote',
  '5',
  () => ({}),
  (ctx, id) => `$(function() {editor_summernote('#'+CSS.escape(${scriptString(id)}), ${scriptString(optWith(ctx, 'upload', 'upload'))});});`
);

const editorjs = editorTextarea(
  'editorjs',
  'valid-target crudui-input contentjs',
  '3',
  (ctx) => ({ 'data-fileserver': optWith(ctx, 'fileserver', '') }),
  (ctx, id) => `$(function() {editor_editorjs('#'+CSS.escape(${scriptString(id)}), ${scriptString(optWith(ctx, 'fileserver', ''))});});`
);

const tui = editorTextarea(
  'tui',
  'valid-target crudui-input tuiarea',
  '3',
  (ctx) => ({ 'data-fileserver': optWith(ctx, 'fileserver', '') }),
  (ctx, id) => `$(function() {editor_tui('#'+CSS.escape(${scriptString(id)}), ${scriptString(optWith(ctx, 'fileserver', ''))});});`
);

/** A button element with the content text; behavior scripts are its event attributes. */
const button: Evaluator = (ctx) => ({
  kind: 'button',
  layout: 'button',
  tag: 'button',
  attrs: {
    type: 'button',
    class: mainClass(ctx, 'crudui-action crudui-action--text'),
    ...styleAttr(mainStyle(ctx)),
    id: ctx.controlId,
    ...behaviorAttrs(ctx),
  },
  text: ctx.spec.content === undefined ? '' : ctx.t(ctx.spec.content),
});

const tagify: Evaluator = (ctx) => {
  const id = ctx.controlId;
  const maxTags = optWith(ctx, 'max_tags', '0');
  const displayValue = applyDefaultString(ctx.value, ctx.spec.default);
  return {
    kind: 'tagify',
    layout: 'host-script',
    tag: 'input',
    attrs: {
      type: 'text',
      id,
      class: mainClass(ctx, 'valid-target crudui-input'),
      name: bracketName(ctx),
      value: displayValue,
      'data-max-tags': maxTags,
      ...(placeholder(ctx) ? { placeholder: placeholder(ctx) } : {}),
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
    },
    script: `$(function() {editor_tagify('#'+CSS.escape(${scriptString(id)}), ${maxTags});});`,
  };
};

const tagify2: Evaluator = (ctx) => {
  const id = ctx.controlId;
  const maxTags = optWith(ctx, 'max_tags', '0');
  const server = optWith(ctx, 'server', '');
  const displayValue = applyDefaultString(ctx.value, ctx.spec.default);
  return {
    kind: 'tagify2',
    layout: 'host-script',
    tag: 'input',
    attrs: {
      type: 'text',
      id,
      class: mainClass(ctx, 'valid-target crudui-input'),
      name: bracketName(ctx),
      value: displayValue,
      'data-max-tags': maxTags,
      'data-server': server,
      ...(placeholder(ctx) ? { placeholder: placeholder(ctx) } : {}),
      ...behaviorAttrs(ctx),
      ...dataAttrs(ctx),
    },
    script: `$(function() {editor_tagify2('#'+CSS.escape(${scriptString(id)}), ${maxTags}, ${scriptString(server)});});`,
  };
};

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

const REGISTRY: Record<string, Evaluator> = {
  text: textLike('text'),
  string: textLike('text'),
  email: textLike('email'),
  number: textLike('number'),
  integer: textLike('number'),
  float: textLike('number'),
  decimal: textLike('number'),
  range,
  password,
  textarea,
  condition,
  select,
  dropdown: select,
  selectbox: select,
  hidden,
  choice,
  radio: choice,
  multichoice,
  checkboxes: multichoice,
  checkcontainer: multichoice,
  date,
  datetime,
  'datetime-local': datetime,
  dummy,
  html: dummy,
  static: dummy,
  'dummy-input': dummyInput,
  image,
  file,
  cover,
  'cover-simple': cover,
  'image-viewer': imageViewer,
  search,
  autocomplete: search,
  tinymce,
  wysiwyg: tinymce,
  summernote,
  editorjs,
  tui,
  button,
  action: button,
  tagify,
  tagify2,
};

/** Number of registered widget kinds (incl. aliases). */
export const WIDGET_COUNT = Object.keys(REGISTRY).length;

/**
 * Registered widget keys (every type + alias) — the registry's key set, NOT a
 * copied catalog. `describe`/`list-widgets` enumerate from THIS; adding a key to
 * `REGISTRY` extends it with zero edits elsewhere (drift 0).
 */
export const WIDGET_KINDS: readonly string[] = Object.keys(REGISTRY);

/** What `pick` reads from the model that each registry evaluator returns for a neutral context. */
function probeRegistry<T>(pick: (model: WidgetModel) => T): Record<string, T> {
  const node = { class: '', style: '' };
  const probeCtx: EvaluatorContext = {
    controlId: 'crudui:probe',
    spec: { type: 'probe' },
    value: undefined,
    path: 'probe',
    design: {
      show: true,
      main: { ...node },
      label: { ...node },
      wrapper: { ...node },
      group: { ...node },
      prepend: { ...node },
    },
    t: (v: unknown) => (typeof v === 'string' ? v : ''),
  };
  const out: Record<string, T> = {};
  for (const [key, evaluator] of Object.entries(REGISTRY)) {
    out[key] = pick(evaluator(probeCtx));
  }
  return out;
}

/**
 * `kind → layout family`, derived by running each registry evaluator once with a
 * neutral context and reading the `layout` it returns (a per-evaluator literal,
 * input-independent). This is a projection of the registry, not a hand table:
 * a new evaluator's layout is picked up automatically (drift 0).
 */
export const WIDGET_LAYOUTS: Readonly<Record<string, WidgetModel['layout']>> = (() => {
  return probeRegistry((model) => model.layout);
})();

/**
 * `registryKey → canonical kind`, where the canonical kind is the `kind` the
 * evaluator itself emits. Two keys mapping to the same evaluator share a
 * canonical kind, so this exposes alias groups WITHOUT reading the private
 * REGISTRY references (e.g. `dropdown`/`selectbox` → `select`). A projection of
 * the registry — new aliases surface automatically (drift 0).
 */
export const WIDGET_CANONICAL: Readonly<Record<string, string>> = (() => {
  return probeRegistry((model) => model.kind);
})();

/** Widget model members in their output order (docs/spec/form-runtime.md). */
const WIDGET_MEMBERS = [
  'kind', 'layout', 'tag', 'attrs', 'text', 'rawHtml', 'source', 'options',
  'itemLabelClass', 'script', 'styleChrome', 'prepend', 'append', 'extra', 'condition',
] as const satisfies readonly (keyof WidgetModel)[];
/** Every widget model member has an output position. */
type UnorderedWidgetMember = Exclude<keyof WidgetModel, (typeof WIDGET_MEMBERS)[number]>;
const everyWidgetMemberOrdered: [UnorderedWidgetMember] extends [never] ? true : never = true;
void everyWidgetMemberOrdered;

/** The widget with its members in output order. */
function orderedWidget(widget: WidgetModel): WidgetModel {
  const ordered: Partial<WidgetModel> = {};
  for (const name of WIDGET_MEMBERS) if (Object.prototype.hasOwnProperty.call(widget, name)) copyMember(ordered, widget, name);
  // The required members are in `ordered` already, so these keep their output positions.
  return { ...ordered, kind: widget.kind, layout: widget.layout, attrs: widget.attrs };
}

/** Copy one member of a widget. */
function copyMember<K extends keyof WidgetModel>(to: Partial<WidgetModel>, from: WidgetModel, name: K): void {
  to[name] = from[name];
}

/** Evaluate one leaf field to a markup-free WidgetModel, or undefined if unported. */
export function evalWidget(type: string, ctx: WidgetCtx): WidgetModel | undefined {
  const ev = REGISTRY[type.toLowerCase()];
  if (!ev) return undefined;
  const id = controlId(ctx.idPrefix ?? 'crudui', ctx.path);
  const widget = ev({ ...ctx, controlId: id });
  if (widget.tag && ['input', 'select', 'textarea'].includes(widget.tag)) {
    widget.attrs.id = id;
  }
  if (widget.extra?.file) widget.extra.file.id = id;
  if (widget.layout === 'choices') {
    for (const [index, option] of (widget.options ?? []).entries()) option.id = `${id}:${index}`;
  }
  // Declared control attributes follow the attributes crudui writes on the control.
  const attributes = ctx.attributes ?? {};
  if (Object.keys(attributes).length) {
    if (widget.layout === 'choices') {
      if (widget.extra?.input) widget.extra.option = { ...attributes };
    } else if (widget.extra?.file) {
      Object.assign(widget.extra.file, attributes);
    } else {
      Object.assign(widget.attrs, attributes);
    }
  }
  return orderedWidget(widget);
}
