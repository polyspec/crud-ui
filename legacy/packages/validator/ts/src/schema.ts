/**
 * CRUDUI Field Type Definitions (canonical, reference)
 *
 * Single source of truth for the CRUDUI field model, mechanized from
 * docs/spec/schema.md (the specification contract) and docs/spec/expressions.md
 * (the expression engine).
 *
 * These types are a reference model for the canonical shape; runtime parsing/validation is built
 * on top of them, not in this file.
 *
 * Model invariants enforced here:
 * - Role slots `validate`/`design`/`behavior`/`options` are polymorphic:
 *   `false` (off) | `{}`/`true` (on, `true` is shorthand for `{}`) | `{ ...spec }`.
 * - Dependency isolation: type-dependent keys live under `options`; structure-
 *   dependent keys live under `multiple`/`lang`/`items` themselves.
 * - `design` exposes a per-DOM-node appearance map (show/class/style/label/
 *   wrapper/group/prepend) — which node a style targets is visible in the key.
 * - Every evaluated value is an expression or a condition map; the condition
 *   map default key is the always-true `true` (no convention symbols like `_`).
 * - Composition via `$ref`/`$patch` (resolution order `$ref` → `$patch` →
 *   single spec → field layer).
 * - Condition-only meta keys (display_switch/display_target/if/when/show_if/…),
 *   magic tokens (`_`), and the directives $after/$before/$merge/$remove
 *   do NOT exist in this model (G1). A schema layer rejects every forbidden key
 *   globally — one level below every slot and bucket, not just at top level
 *   (open buckets via `propertyNames`, closed shapes via
 *   `additionalProperties: false`). See `FORBIDDEN_META_KEYS`.
 *
 * Round-trip: these types fix the canonical JSON shape, so a CRUDUI document parsed
 * with `JSON.parse` (key order preserved by the engine) and re-serialized is
 * identical. The polymorphic slots/buckets (`false`|`{}`|`true`) and the
 * declaration-ordered condition map / `properties` survive the round trip. The
 * adjacent `types.roundtrip.test.ts` proves it. The Go/Rust siblings carry the
 * custom (de)serialization that preserves the same shapes.
 */

import type { MessagesSpec } from './types';

// ============================================================================
// Expression & Condition Map (G1 / expressions.md §2, §8)
// ============================================================================

/**
 * A single restricted-DSL expression string (expressions.md §2): paths
 * (`.`/`..`/`*`), comparisons, logic, `in`/`not in`, ternary `?:`, parentheses,
 * literals. No arithmetic, functions, methods, regex, or `eval`. A bare ternary
 * `"...?...:..."` is the shorthand of a condition map (same semantics).
 */
export type Expression = string;

/**
 * Declaration-ordered condition map (expressions.md §8). Each key is an
 * Expression (§2 grammar); keys are evaluated top-to-bottom and the value of the
 * first truthy key is returned. If none match, the value of the `true` key (the
 * always-true default) is used; if absent, `null`. The default key is always
 * literal `true` — convention symbols such as `_` are forbidden (R4).
 *
 * The condition map is a thin wrapper that calls the engine repeatedly; it is
 * not a separate parser.
 */
export type ConditionMap<V = unknown> = {
  /** Default (else) branch: the always-true condition. */
  true?: V;
  /** Expression key → value returned when that expression is the first truthy. */
  [expression: string]: V | undefined;
};

/**
 * An evaluated value: either a single Expression or a ConditionMap. Used by
 * `design.show`/`design.class`/`design.style`, conditional `validate.*`, etc.
 * The call site fixes the expected result type (boolean for `show`, string for
 * `class`/`style`, …).
 */
export type Evaluated<V = unknown> = V | Expression | ConditionMap<V>;

/**
 * Multilingual content map (G3 content translation): a value translated per
 * language by the spec author, e.g. `{ ko: 'Email label', en: 'Email' }`. Distinct
 * from `lang` (G3 input multilingualism, a structural dimension). An empty
 * language slot may be `null` (no value — identical to absent; no render/validate
 * effect, SPEC §2 G3).
 */
export type LangMap = Record<string, string | null>;

/**
 * Field content text that may be a plain string or a per-language LangMap (G3).
 * Empty content is omitted or `null` — `null` is identical to absent and has no
 * render/validate effect (SPEC §2 G3).
 */
export type LocalizedText = string | LangMap | null;

/**
 * Composition reference: one file path, or a list of paths resolved in
 * declaration order where a later path overrides an earlier one. A path may
 * select a fragment of a file as `(file.yml).key`.
 */
export type Reference = string | string[];


/**
 * Polymorphic role-slot value (SPEC G2). `false` turns the slot off (and
 * nullifies composed inheritance); `true` is the shorthand for `{}` (default
 * on); an object carries the slot's settings.
 */
export type Slot<T> = false | true | T;

// ============================================================================
// Field Spec (top-level — structure / identity / content + role slots)
// ============================================================================

/**
 * CRUDUI field specification. Top level holds only first-class keys (SPEC §3 B):
 * structure/identity, content, and the four role slots. All non-first-class
 * detail is pushed under its dependency target (§3 C). A schema layer closes the
 * top level (`additionalProperties: false`) and rejects every `FORBIDDEN_META_KEYS`
 * entry here and one level below every slot/bucket.
 */
export interface FieldSpec {
  // -- Identity / structure (first-class) --

  /**
   * Identity — the field type (e.g. `email`, `group`, `multiple`). The type is
   * the definer/validator of the `options` slot.
   */
  type: string;
  /** Structure / identity — field name (serialization key). */
  name?: string;
  /** Content — field label (LangMap when multilingual, G3). */
  label?: LocalizedText;
  /**
   * Structure — default value. The evaluator references it when a path does not
   * resolve (expressions.md §5 Path).
   */
  default?: unknown;
  /**
   * Structure — child field map (group/object). Entry point for `$ref`/`$patch`
   * composition.
   */
  properties?: Properties;
  /**
   * Structure — option source. Static array, or a dynamic
   * `{ model, method, table, relations }` source. A dependency-isolation bucket and first-class.
   */
  items?: Items;
  /**
   * Structure — repeated rows (`true` = on). A dependency-isolation bucket and
   * first-class. Row identity at RUNTIME is a server PK carried in the submitted
   * data, not a build-time spec field — `MultipleSettings` has no `id` key. See
   * `Multiple`.
   */
  multiple?: Multiple;
  /**
   * Structure — input multilingual dimension (the field value is per-language,
   * G3). A dependency-isolation bucket and first-class.
   */
  lang?: Lang;

  // -- Content (first-class) --

  /** Content — description (may be multilingual). */
  description?: LocalizedText;
  /** Content — placeholder (may be multilingual). */
  placeholder?: LocalizedText;
  /** Content — text rendered before the input. */
  prepend?: LocalizedText;
  /** Content — text rendered after the input. */
  append?: LocalizedText;
  /** Content — help text (may be multilingual). */
  help?: LocalizedText;
  /** Content — control text of a button or action field (may be multilingual). */
  content?: LocalizedText;

  // -- Role slots (first-class, polymorphic) --

  /** Role slot — validation (SPEC §3 common-role distribution). */
  validate?: Slot<ValidateSlot>;
  /** Error message overrides by rule name, beside the rules they belong to. */
  messages?: MessagesSpec;
  /**
   * Role slot — appearance = visibility + per-node external appearance map, with the attributes
   * the field declares for its control and node root.
   */
  design?: Slot<FieldDesignSlot>;
  /**
   * Role slot — behavior (opaque script, NOT routed through the expression
   * engine). `false` nullifies composed inheritance.
   */
  behavior?: Slot<BehaviorSlot>;
  /**
   * Role slot — type-dependent settings (the type defines and validates them;
   * the core stays uninvolved).
   */
  options?: Slot<OptionsSlot>;

  // -- Form root declarations --

  /** Form buttons rendered in the form footer. Honored on the form root only. */
  buttons?: FormButton[];
  /** Submission target kept unchanged in the template. Honored on the form root only. */
  action?: FormAction;

  // -- Composition (SPEC §5) --

  /**
   * Base inheritance (file/path). The parser expands it first — an unresolved
   * `$ref` cannot be loaded.
   */
  $ref?: Reference;
  /**
   * Change directive (add/remove/replace, JSON Patch style). Supports deep-path
   * set, e.g. `'field.validate.required': '.other'`.
   */
  $patch?: PatchDirective;
}

/**
 * A range field (docs/spec/schema.md, Range fields): a number chosen on a slider whose bounds and
 * increment are the literal `range` and `step` rules; the minimum is a multiple of the step.
 */
export interface RangeFieldSpec extends FieldSpec {
  /** The range type. */
  type: 'range';
  /** Validation with the required literal bounds and step of the slider. */
  validate: ValidateSlot & {
    /** Inclusive `[minimum, maximum]` of the slider. */
    range: [number, number];
    /** Increment of the slider, a finite number above 0. */
    step: number;
  };
}

/** One form button. A button or link needs text; a link needs href. */
export interface FormButton {
  /** Button type; a link renders an anchor. */
  type: 'submit' | 'reset' | 'button' | 'link';
  /** Button text; submit and reset default to interface text. */
  text?: LocalizedText;
  /** Submitted name. */
  name?: string;
  /** Submitted value. */
  value?: string;
  /** Link target. */
  href?: string;
  /** Button appearance. */
  design?: Slot<DesignSlot>;
  /** Opaque behavior scripts. */
  behavior?: Slot<BehaviorSlot>;
}

/** Submission target of the form, kept unchanged in the template. */
export interface FormAction {
  /** HTTP method. */
  method?: string;
  /** Submission URL. */
  url?: string;
  /** Submission encoding. */
  enctype?: string;
}

/**
 * Child field map (group/object). A `$ref`/`$patch` composition entry may sit
 * alongside named child fields; the parser expands composition first, then the
 * field layer.
 */
export type Properties = {
  /** Base inheritance for the whole child map. */
  $ref?: Reference;
  /** Composition change directive for the child map. */
  $patch?: PatchDirective;
} & {
  [fieldName: string]: FieldSpec | string | PatchDirective | undefined;
};

/**
 * Composition change directive ($patch). Deep paths map to values
 * (set/replace); the resolution order is `$ref` → `$patch` → single spec →
 * field layer.
 */
export interface PatchDirective {
  /** Deep-path key (e.g. `'field.validate.required'`) → patched value. */
  [path: string]: unknown;
}

// ============================================================================
// validate slot (polymorphic — value may be expression / condition map)
// ============================================================================

/**
 * Validation rules (SPEC §3 `slots.validate`). Each value may be an
 * expression/condition map, expressing conditional validation without a separate
 * key (e.g. `required: '.subscribe'`, `email: true`) — the condition is the
 * value's expression (G1), never a separate key.
 *
 * The named members are every built-in rule, with the parameter shapes the
 * meta-schema declares; `false` or `null` disables a rule. `equalTo`, `containedIn`, `typeFrom`, `minFrom`, `maxFrom`, `notEqual`,
 * `unique`, `enddate`, `reference`, `accept`, `match`, `pattern`, `in` and `conditionTree` receive their
 * parameter unchanged, so they take no condition map. No other rule name exists:
 * the meta-schema rejects it and the runtime fails the load with `UNKNOWN_RULE`.
 */
export interface ValidateSlot {
  /** Requires a supplied, nonempty value when enabled. */
  required?: Evaluated<boolean | null>;
  /** Requires a syntactically valid email address when enabled. */
  email?: Evaluated<boolean | null>;
  /** Requires a valid URL when enabled. */
  url?: Evaluated<boolean | null>;
  /** Requires a finite number when enabled. */
  number?: Evaluated<boolean | null>;
  /** Requires digits only when enabled. */
  digits?: Evaluated<boolean | null>;
  /** Requires a valid date when enabled. */
  date?: Evaluated<boolean | null>;
  /** Requires a YYYY-MM-DD date when enabled. */
  dateISO?: Evaluated<boolean | null>;
  /** Minimum string length. */
  minlength?: Evaluated<number | false | null>;
  /** Maximum string length. */
  maxlength?: Evaluated<number | false | null>;
  /** Minimum and maximum string length. */
  rangelength?: Evaluated<[number, number] | false | null>;
  /** Numeric lower bound. */
  min?: Evaluated<number | false | null>;
  /** Numeric upper bound. */
  max?: Evaluated<number | false | null>;
  /** Numeric lower and upper bounds. */
  range?: Evaluated<[number, number] | false | null>;
  /** Numeric increment. */
  step?: Evaluated<number | false | null>;
  /** Minimum collection size. */
  mincount?: Evaluated<number | false | null>;
  /** Maximum collection size. */
  maxcount?: Evaluated<number | false | null>;
  /** Regular expression the value must match. */
  match?: string | false | null;
  /** Same rule as `match`. */
  pattern?: string | false | null;
  /** Field whose value must be equal. */
  equalTo?: string | false | null;
  /** Field whose string value must contain the string value (CUVR-075). */
  containedIn?: string | false | null;
  /** Field whose value names the type of the value: bool, int or enum (CUVR-077). */
  typeFrom?: string | false | null;
  /** Field whose value is the inclusive lower bound of the value (CUVR-079). */
  minFrom?: string | false | null;
  /** Field whose value is the inclusive upper bound of the value (CUVR-079). */
  maxFrom?: string | false | null;
  /** Dot-prefixed field reference or literal value the input must differ from. */
  notEqual?: string | number | boolean | null;
  /** Start-date field the end date must not precede. */
  enddate?: string | false | null;
  /** Declaration path of the field whose values are the ids the value must name. */
  reference?: string | false | null;
  /** Uniqueness; a string names an item field or a filter condition. */
  unique?: boolean | string | null;
  /** Accepted file extensions or MIME types. */
  accept?: string | string[] | false | null;
  /** Allowed values: comma-separated string, list, choice list with groups, or value-to-label map. */
  in?: string | Array<string | number | boolean | null> | Array<ChoicePair | ChoiceGroup> | Record<string, LangMap | string | null> | false | null;
  /** A condition tree; `judge` also permits judged text (validation-rules.md, "Condition trees"). */
  conditionTree?: true | 'judge' | false | null;
}

// ============================================================================
// design slot (appearance = visibility + per-DOM-node appearance map, R8)
// ============================================================================

/**
 * Per-node appearance: `class`/`style` for one DOM node. Both values are
 * evaluated (expression or condition map) and yield strings.
 */
export interface DesignNode {
  /** CSS class for this node (evaluated → string). */
  class?: Evaluated<string>;
  /** Inline style for this node (evaluated → string). */
  style?: Evaluated<string>;
}

/**
 * Appearance slot = visibility condition (`show`) + per-DOM-node appearance map
 * (R8). `class`/`style` target the main (input) node; `label`/`wrapper`/`group`/
 * `prepend` target their respective nodes — which node a style targets is
 * visible in the key.
 */
export interface DesignSlot {
  /** Visibility condition (evaluated → boolean). */
  show?: Evaluated<boolean>;
  /** Main (input) node class (evaluated → string). */
  class?: Evaluated<string>;
  /** Main (input) node inline style (evaluated → string). */
  style?: Evaluated<string>;
  /** Label node appearance. */
  label?: DesignNode;
  /** Wrapper node appearance. */
  wrapper?: DesignNode;
  /** Body appearance of a group or group row, and of the choices of a choice or multichoice field. */
  group?: DesignNode;
  /** Prepend node appearance. */
  prepend?: DesignNode;
}

/**
 * Attributes a form field declares for an element: a `data-*` or `aria-*` name that crudui does
 * not write, to a literal string value (docs/spec/schema.md, Declared attributes).
 */
export type DeclaredAttributes = Record<string, string>;

/** The wrapper node of a form field: appearance and the attributes of the node root. */
export interface FieldWrapperNode extends DesignNode {
  /** Attributes written on the node root after the attributes crudui writes. */
  attributes?: DeclaredAttributes;
}

/** The design slot of a form field: the design slot with declared attributes and a group's layout. */
export interface FieldDesignSlot extends DesignSlot {
  /** Attributes written on the field's control after the attributes crudui writes. */
  attributes?: DeclaredAttributes;
  /**
   * Layout of the fields inside a group field (docs/spec/schema.md, Layout); other fields and the
   * form root reject it, and a repeated group has no `line`.
   */
  layout?: 'stacked' | 'inline' | 'line';
  /** Wrapper node appearance and attributes. */
  wrapper?: FieldWrapperNode;
}

// ============================================================================
// behavior slot (opaque scripts — NOT routed through the expression engine)
// ============================================================================

/**
 * A behavior entry: an opaque client-JS script string, or `{ script, label }`
 * where the action label sits adjacent (`behavior.{action}.label`).
 */
export type BehaviorEntry =
  | string
  | {
      /** Opaque client-JS passed through verbatim (not parsed by the engine). */
      script?: string;
      /** Action label, adjacent to the action it modifies. */
      label?: LocalizedText;
    };

/**
 * Common (all-type) behavior scripts (SPEC §4). Values are opaque client JS
 * passed through verbatim and never routed through the expression engine.
 * `behavior: false` nullifies composed inheritance.
 */
export interface BehaviorSlot {
  /** Change handler (opaque script). */
  onchange?: BehaviorEntry;
  /** Click handler (opaque script). */
  onclick?: BehaviorEntry;
  /** Load handler (opaque script). */
  onload?: BehaviorEntry;
  /** Index signature for additional opaque action handlers. */
  [action: string]: BehaviorEntry | undefined;
}

// ============================================================================
// options slot (type-dependent — the type defines & validates; core uninvolved)
// ============================================================================

/**
 * Type-dependent settings (dependency isolation: type → `options`). Defined and
 * validated by the field's type; the core does not interpret them, so a new
 * widget leaves the core unchanged. Container-type chrome and type-dependent
 * scripts/callbacks live here too. The listed keys are common examples; the
 * index signature admits any type-specific key.
 */
export interface OptionsSlot {
  /** Minimum keyword length (e.g. autocomplete trigger). */
  keyword_min_length?: number;
  /** Whether the map marker is draggable. */
  marker_draggable?: boolean;
  /** Map zoom level. */
  zoom?: number;
  /** Geometry type (e.g. point/line/polygon). */
  geometry_type?: string;
  /** Maximum number of tags. */
  max_tags?: number;
  /** Label rendered next to a checkbox. */
  checkbox_label?: LocalizedText;
  /** Label for the "on" state of a toggle. */
  on_label?: LocalizedText;
  /** Container chrome — collapse state. */
  collapse?: boolean;
  /** Container chrome — expand state. */
  expend?: boolean;
  /** Container chrome — show a total count. */
  view_total?: boolean;
  /** Container chrome — stepper UI. */
  stepper?: boolean;
  /** Message shown when blank/empty. */
  blank_message?: LocalizedText;
  /** Type-dependent callback (e.g. select2). */
  callback?: string;
  /** Type-dependent event config (e.g. datetime). */
  event?: unknown;
  /** Index signature — any type-specific option key. */
  [option: string]: unknown;
}

// ============================================================================
// items bucket (option source — static array | dynamic source, polymorphic)
// ============================================================================

/**
 * Nested model descriptor of a dynamic source (`items.model` second shape): the
 * source is a relational query, not a single model name, of the
 * shape (`model: { table, relations, keys }`). Structure only — this fixes the
 * declared shape of a query descriptor; building the query and running it is the
 * runtime's job, out of scope here (SPEC §6 R1: types preserve, validation
 * blocks; never model runtime resolution into the type).
 */
export interface ItemsModel {
  /** Primary table the rows are drawn from. */
  table?: string;
  /** Join/relation descriptors (each row links a related table to a column pair). */
  relations?: unknown[];
  /** Display-key descriptors (which fields compose each row's option label). */
  keys?: unknown[];
  /** Index signature — any further source-query descriptor key (preserved, never dropped). */
  [key: string]: unknown;
}

/**
 * Dynamic option source (dependency isolation: dynamic items → `items` sub).
 * Collects the source descriptor in one place.
 *
 * STRUCTURE ONLY. This type fixes the declared shape of a dynamic source; it
 * does NOT load options. The supported shape (`type: search`) is a
 * `model` (a name string OR a nested `{ table, relations, keys }` query) plus a
 * sibling `api_server` (a runtime HTTP-endpoint function reference) plus a
 * placeholder static `items`. None of `model`/`api_server`/`items` is resolved
 * here — the runtime calls `api_server`, runs the `model` query, and replaces
 * the placeholder. Runtime resolution is out of scope (SPEC §6 R1).
 */
export interface ItemsSource {
  /**
   * Data model the options are loaded from. Either a model-name string OR a
   * nested `{ table, relations, keys }` relational query.
   */
  model?: string | ItemsModel;
  /** Method on the model invoked to fetch option rows. */
  method?: string;
  /** Table the options are loaded from (top-level shorthand of `model.table`). */
  table?: string;
  /** Relation descriptors used when loading options. */
  relations?: unknown;
  /**
   * Runtime HTTP-endpoint function reference (an opaque source-callback string,
   * e.g. `"function() { return '/admin/user/search'; }"`). Preserved verbatim;
   * the engine never calls it — invoking the endpoint is runtime, out of scope.
   */
  api_server?: string;
  /**
   * Placeholder static `items` that coexists with the dynamic source: the
   * pre-fetch choices the UI shows before `api_server`/`model` resolve (often the
   * empty `[]` or a single `{ "": "Select" }` prompt). A static array or a
   * value→label map; the runtime replaces it with the fetched rows.
   */
  items?: StaticItem[] | ChoiceList | ItemLabelMap;
  /**
   * Index signature — any further source descriptor key (preserved, never
   * dropped; a forbidden meta key is rejected by the schema layer one level
   * below the bucket, not by widening this type — SPEC §6 R1).
   */
  [key: string]: unknown;
}

/**
 * Option source: an array of labels whose indexes are the values, a choice list
 * (`ChoiceList`), a static value→label map (`ItemLabelMap`) or a dynamic
 * `ItemsSource` (docs/spec/schema.md, "Languages and choices").
 */
export type Items = StaticItem[] | ChoiceItems | ItemLabelMap | ItemsSource;

/**
 * One choice of a choice list (docs/spec/schema.md, "Choice lists"). The option value is
 * the canonical text of `value`; the list order is the display order for any values.
 */
export interface ChoicePair {
  /** Option value: a string or a finite number, distinct by canonical text in its list. */
  value: string | number;
  /** Display label of the value. */
  label: ItemLabel;
}

/** Choices in list order for any values. */
export type ChoiceList = ChoicePair[];

/**
 * One choice of a field's `items` (docs/spec/schema.md, "Choice appearance"). In a choice or
 * multichoice field it may declare the appearance of its label and input; binding rejects these
 * members in other fields.
 */
export interface ChoiceItem extends ChoicePair {
  /** Class of the choice's label, after the label classes. */
  class?: string;
  /** Inline style of the choice's label. */
  style?: string;
  /** Attributes written on the choice's input after the field's control attributes. */
  attributes?: DeclaredAttributes;
}

/**
 * A group of choices in a choice list (docs/spec/schema.md, "Choice groups"). Only the choice list
 * of a select field and the `in` rule accept groups; binding rejects a group in other fields.
 */
export interface ChoiceGroup {
  /** Display label of the group. */
  label: ItemLabel;
  /** One or more choices of the group in list order; their values are distinct across the list. */
  choices: ChoicePair[];
}

/** The choices and groups of a field's `items` in list order. */
export type ChoiceItems = Array<ChoiceItem | ChoiceGroup>;

/**
 * A static option label (display only). A plain string or a per-language LangMap
 * (G3 content translation); the option VALUE is the map key, the label is just
 * for display, so the label never participates in membership. Empty label may be
 * `null` (SPEC §2 G3).
 */
export type ItemLabel = LocalizedText;

/**
 * Static value→label map (SPEC §2 G3): the key is the option value (the
 * membership target), the entry is its display label — a string or a LangMap,
 * e.g. `{ "0": { ko: 'Off label', en: 'Off' }, "1": { ko: 'On label', en: 'On' } }`.
 * The label is display-only; a LangMap label is NOT a membership value.
 */
export type ItemLabelMap = Record<string, ItemLabel>;

/** A label of an array whose indexes are the values. */
export type StaticItem = ItemLabel;

// ============================================================================
// multiple bucket (repeated rows — multiple-dependent keys live under it)
// ============================================================================

/**
 * Repeated-row settings (dependency isolation: multiple-dependent → `multiple`
 * sub). `true` is the bare default (repetition on, no settings); `only`, the
 * same as `{ only: true }`, declares rows that exist only in the data; an object
 * carries the repetition settings.
 *
 * Row identity is not a `multiple` field. Repeated data is an object keyed by
 * row identity, and object member order is row order; the specification has no
 * hidden identity or order field (see docs/spec/form-runtime.md).
 *
 * The named keys are the canonical `dependency_buckets.multiple.keys`
 * (`only`/`min`/`max`/`copy`/`sortable`/`title`/`controls`/`header`/`onclick`/`keys`). Other
 * spellings such as `multiple_max`, `sortable*` or `add_buttons` are not
 * recognition keys (R2 anti-duplication, R4 no magic tokens).
 */
export type Multiple = boolean | 'only' | MultipleSettings;

/**
 * Repeated-row settings object (kept under `multiple`): the settings of rows that the form adds and
 * removes, or of rows that exist only in the data.
 */
export type MultipleSettings = MultipleRowSettings | MultipleDataSettings;

/** Settings of rows that the form adds, removes, copies and moves. */
export interface MultipleRowSettings {
  /** Absent or `false`: the rows are not only in the data. */
  only?: false;
  /** A keyed map needs `only: true` (docs/spec/schema.md, Keyed maps). */
  keys?: never;
  /** Minimum number of rows. */
  min?: number;
  /** Maximum number of rows. */
  max?: number;
  /** Whether rows provide a copy control. */
  copy?: boolean;
  /** Whether rows are sortable. */
  sortable?: boolean;
  /** Direct child field of a repeated group whose value titles each row. */
  title?: string;
  /** Position of row controls. */
  controls?: 'header' | 'footer' | 'outline';
  /** Whether row headers stay visible while scrolling. */
  header?: 'static' | 'sticky';
  /** Row-level click handler (opaque script). */
  onclick?: string;
}

/**
 * Settings of rows that exist only in the data: the data keys are the rows and the form offers no
 * row controls; only `title`, `header` and `keys` accompany `only: true`.
 */
export interface MultipleDataSettings {
  /** The rows exist only in the data. */
  only: true;
  /**
   * Field reference to a repeated group whose row keys are the only keys of this keyed map
   * (docs/spec/schema.md, Keyed maps).
   */
  keys?: string;
  /** Direct child field of a repeated group whose value titles each row. */
  title?: string;
  /** Whether row headers stay visible while scrolling. */
  header?: 'static' | 'sticky';
  /** Row limits do not apply to rows that come from the data. */
  min?: never;
  /** Row limits do not apply to rows that come from the data. */
  max?: never;
  /** Rows that come from the data have no copy control. */
  copy?: never;
  /** Rows that come from the data are not moved. */
  sortable?: never;
  /** Rows that come from the data have no row controls. */
  controls?: never;
  /** Rows that come from the data have no row controls. */
  onclick?: never;
}

// ============================================================================
// lang bucket (input multilingual dimension — lang-dependent keys live under it)
// ============================================================================

/**
 * Input multilingual settings (dependency isolation: lang-dependent → `lang`
 * sub). `true` is the bare default. An object carries the dimension settings,
 * including the language-group chrome (`frame`/`title`/`group_class`).
 */
export type Lang = boolean | LangSettings;

/**
 * Per-language override map (one of the two `lang.only` shapes, SPEC §3 C):
 * `{ ja: { validate: … }, en: { validate: … } }`. The key is a language code,
 * the value is the role-slot override (`validate`/`design`/`behavior`/`options`)
 * applied to that language's input only. Distinct from the allowlist `string[]`:
 * the allowlist restricts which languages render, the override map redefines
 * slots per language.
 */
export interface LangOverride {
  /** Validation rules for this language input. */
  validate?: Slot<ValidateSlot>;
  /** Appearance settings for this language input. */
  design?: Slot<DesignSlot>;
  /** Event scripts for this language input. */
  behavior?: Slot<BehaviorSlot>;
  /** Widget options for this language input. */
  options?: Slot<OptionsSlot>;
}
/** Per-language overrides indexed by language code. */
export type LangOverrideMap = Record<string, LangOverride>;

/** Input multilingual settings object (kept under `lang`). */
export interface LangSettings {
  /** Expansion mode (e.g. append). */
  mode?: string;
  /**
   * Two shapes (SPEC §3 C): a language allowlist `['ko', 'en']` (`string[]`)
   * OR a per-language override map `{ ja: { validate: … } }`
   * (`LangOverrideMap`). The allowlist restricts the rendered languages; the
   * override map redefines role slots per language.
   */
  only?: string[] | LangOverrideMap;
  /** Name override for the language group. */
  name?: string;
  /** Key override for the language group. */
  key?: string;
  /** Whether the language frame is shown. */
  frame?: boolean;
  /** Language-group title. */
  title?: LocalizedText;
  /** Language-group CSS class. */
  group_class?: string;
}

// ============================================================================
// Forbidden meta keys (assertion-only — present for documentation & tooling)
// ============================================================================

/**
 * Meta keys forbidden by the CRUDUI model (canonical `forbidden_meta_keys`):
 * condition-only meta keys (`display_switch`/`display_target`/`if`/`when`/
 * `show_if`), the magic default sigil `_`, the composition directives
 * `$after`/`$before`/`$merge`/`$remove` (`$patch` is the only overlay), and the
 * appearance keys `xclass`/`xstyle` (the design node map replaces them). They
 * must NOT appear anywhere in a CRUDUI spec.
 *
 * Global rejection (not just top level): a schema layer rejects these keys one
 * level below every slot and bucket too — open buckets (`options`, etc.) use
 * `propertyNames: { not: { enum: [...forbidden...] } }` to admit type-specific
 * extension while still blocking every forbidden key. Closed shapes use
 * `additionalProperties: false`.
 *
 * `x{key}` (an `x`-prefixed comment key, e.g. `xclass`/`xstyle`/`xnote`) is also
 * forbidden in the canonical model, but it is a PATTERN, not a literal, so it is
 * not enumerated here. Premise: the meta-schema strips every `x`-prefixed key
 * (x-strip) BEFORE validating the canonical spec — an `x{key}` is rejected from
 * the canonical document, but the reason is that it is a stripped comment, not a
 * recognized field. Tooling matches it with `^x` rather than this enum.
 *
 * This constant exists so tooling can assert these keys' absence — it never
 * widens the model.
 */
export const FORBIDDEN_META_KEYS = [
  'display_switch',
  'display_target',
  'if',
  'when',
  'show_if',
  '_',
  'seqtokey',
  '__13hex__',
  '$after',
  '$before',
  '$merge',
  '$remove',
  'xclass',
  'xstyle',
] as const;

/**
 * Pattern for the forbidden `x{key}` comment family (x-strip premise above).
 * The meta-schema strips matches before canonical validation; tooling rejects
 * any key matching this in a canonical document.
 *
 * `x` + at least one more char (`/^x[\s\S]/`) — NOT a bare `x`. This matches the
 * runtime authority `forbidden-scan.ts isXCommentKey` (`length > 1`) exactly,
 * including keys with an embedded newline (`.` excludes `\n`; `[\s\S]` does not):
 * a lone `x` is a real one-char field name, not a disabled comment. The metaschema
 * `ForbiddenKeyNames` pattern uses the same `^x[\s\S]` — one truth, three surfaces.
 */
export const FORBIDDEN_META_KEY_PATTERN = /^x[\s\S]/;
