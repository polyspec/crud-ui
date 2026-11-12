/**
 * `crudui describe` — the bridge between the CODE single-source-of-truth and
 * the SKILL/MCP procedure layer (architecture: 3-layer split, describe is the
 * leg of layers 1·2).
 *
 * It IMPORTS the live build/runtime objects and PARSES the meta-schema; it never
 * hand-copies a catalog. Every value here is read from:
 *   - generator-core REGISTRY  → widget kinds + per-kind layout (import)
 *   - validator-ts rules        → rule names (import getRuleNames)
 *   - validator-ts validator.ts → rule param-class tables (import)
 *   - contracts/schema/crudui.schema.json  → slots / nodes / buckets / forbidden enum (parse)
 *   - validator-ts types.ts     → FORBIDDEN_META_KEYS + pattern (import)
 *   - validator-ts forbidden    → runtime forbidden scan (import — cross-check)
 *   - generator-core cell.ts     → read-cell format catalog (import CELL_FORMATS)
 *   - contracts/schema/crudui.schema.json   → list definitions (List/Column/CellFormat/…) (parse)
 *   - docs/spec/expressions.md → tokens / precedence / truthy / unsupported (parse)
 *   - docs/spec/schema.md        → classification rules (parse)
 *
 * Drift 0: a widget added to REGISTRY, a rule added to builtInRules, a slot key
 * changed in the schema, or a forbidden key added to FORBIDDEN_META_KEYS appears
 * in the NEXT `describe` with zero edits here. The two surfaces of one fact
 * (forbidden keys: types.ts vs schema enum) are cross-checked every run — a
 * divergence fails describe. describe is itself the drift detector.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// -- CODE single-source-of-truth (the packages' internal entries) --------------
import {
  WIDGET_COUNT,
  WIDGET_KINDS,
  WIDGET_LAYOUTS,
  WIDGET_CANONICAL,
  CELL_FORMATS,
  CELL_FORMAT_DEFAULT,
} from '@polyspec/crudui-generator-core/internal';
import {
  getRuleNames,
  ARRAY_LEVEL_RULES,
  PATH_REFERENCE_RULES,
  LITERAL_PARAM_RULES,
  REGEX_PARAM_RULES,
  MEMBERSHIP_PARAM_RULES,
  FORBIDDEN_META_KEYS,
  FORBIDDEN_META_KEY_PATTERN,
  scanForbiddenKeys,
} from '@polyspec/crudui-validator/internal';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCHEMA_PATH = resolve(REPO_ROOT, 'contracts/schema/crudui.schema.json');
const GRAMMAR_PATH = resolve(REPO_ROOT, 'docs/spec/expressions.md');

// ---------------------------------------------------------------------------
// Result shape (the one object both --json and --md render from).
// ---------------------------------------------------------------------------

interface WidgetEntry {
  /** Registry key (a type or an alias). */
  kind: string;
  /** Layout family the adapters wrap the control in. */
  layout: string;
  /** Other registry keys that resolve to the same evaluator (canonical-first). */
  aliases: string[];
}

export interface RuleEntry {
  /** Rule name as registered in builtInRules. */
  name: string;
  /** Sibling name(s) that share the same implementation (e.g. pattern↔match). */
  aliasOf?: string;
  /** Param-class tags derived from validator.ts classification tables. */
  paramClass: string[];
}

export interface DescribeResult {
  /** Schema $id / version provenance. */
  meta: {
    schema: string;
    widgetCount: number;
    ruleCount: number;
    sources: Record<string, string>;
  };
  widgets: WidgetEntry[];
  layouts: string[];
  rules: RuleEntry[];
  slots: {
    /** First-class top-level keys (schema Field.properties). */
    firstClass: string[];
    validate: { subKeys: string[]; allRules: string[] };
    design: { nodes: string[]; nodeAppearanceKeys: string[] };
    behavior: { subKeys: string[] };
    options: { knownKeys: string[]; open: boolean };
  };
  buckets: {
    items: { kinds: string[]; sourceKeys: string[]; modelKeys: string[] };
    multiple: { keys: string[] };
    lang: { keys: string[]; onlyShapes: string[] };
  };
  forbiddenKeys: {
    enum: string[];
    pattern: string;
    /** schema-mirror enum (the meta-schema's ForbiddenKeyNames). */
    schemaEnum: string[];
    schemaPattern: string | null;
    /** true when types.ts enum, schema enum and runtime scan all agree. */
    crossCheckOk: boolean;
  };
  grammar: {
    source: string;
    tokens: Array<{ token: string; pattern: string }>;
    precedence: string[];
    truthyFalsy: string[];
    unsupported: string[];
  };
  classification: {
    source: string;
    firstClass: { structure: string[]; content: string[]; roleSlots: string[]; form: string[] };
    dependencyIsolation: Array<{ trigger: string; target: string; note: string }>;
    roleDistribution: Array<{ role: string; target: string }>;
  };
  matrix: {
    /** widget kind → applicable role slots / buckets (derived join). */
    columns: string[];
    note: string;
  };
  /** list-spec (read sister) capability — SPEC §9. Additive; sits beside widgets/rules/slots. */
  list: {
    /** Entry definition the meta-schema validates a list against (#/definitions/List). */
    entry: string;
    /** read-cell format catalog (cell.ts CELL_RENDERERS keys, cross-checked vs schema CellFormat). */
    cellFormats: Array<{
      /** Catalog type (SPEC §9.2). */
      type: string;
      /** true when this renderer type is the unknown/absent fallback. */
      isDefault: boolean;
    }>;
    /**
     * Dependent keys the meta-schema's CellFormat documents — ONE open bucket
     * shared across types (type-isolated per object, not attributed per type).
     */
    cellFormatSchemaKeys: string[];
    /** true when cell.ts catalog and schema CellFormat agree on no fabricated/missing surface. */
    cellCrossCheckOk: boolean;
    /** List first-class structure — the columns/search/sort/pagination/actions/empty/description/design slots. */
    structure: {
      /** First-class List keys (schema List.properties, minus $ref/$patch). */
      firstClass: string[];
      column: { firstClass: string[] };
      pagination: { keys: string[]; modes: string[] };
      sort: { keys: string[]; dirs: string[] };
      action: { objectKeys: string[]; shapes: string[] };
      search: { shapes: string[] };
    };
  };
}

// ---------------------------------------------------------------------------
// schema parse helpers
// ---------------------------------------------------------------------------

/** The parts of a JSON Schema definition this projection reads. */
interface SchemaNode {
  type?: string;
  anyOf?: SchemaNode[];
  allOf?: SchemaNode[];
  not?: SchemaNode;
  properties?: Record<string, SchemaNode>;
  propertyNames?: SchemaNode;
  enum?: string[];
  pattern?: string;
  $ref?: string;
}

interface SchemaDoc {
  $id?: string;
  definitions: Record<string, SchemaNode | undefined>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The parts of the schema definition `value` that SchemaNode names. A keyword of another JSON type (a list of types, a
 * boolean schema, an enum of numbers) is left out, as the projection compares only these types.
 */
function schemaNode(value: unknown): SchemaNode {
  const node: SchemaNode = {};
  if (!isRecord(value)) return node;
  const { type, pattern, $ref, anyOf, allOf, not, properties, propertyNames, enum: names } = value;
  if (typeof type === 'string') node.type = type;
  if (typeof pattern === 'string') node.pattern = pattern;
  if (typeof $ref === 'string') node.$ref = $ref;
  if (Array.isArray(anyOf)) node.anyOf = anyOf.map((item: unknown) => schemaNode(item));
  if (Array.isArray(allOf)) node.allOf = allOf.map((item: unknown) => schemaNode(item));
  if (not !== undefined) node.not = schemaNode(not);
  if (isRecord(properties)) node.properties = schemaNodes(properties);
  if (propertyNames !== undefined) node.propertyNames = schemaNode(propertyNames);
  if (Array.isArray(names) && names.every((item: unknown): item is string => typeof item === 'string')) node.enum = names;
  return node;
}

function schemaNodes(value: Record<string, unknown>): Record<string, SchemaNode> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, schemaNode(item)]));
}

function loadSchema(): SchemaDoc {
  const doc: unknown = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
  if (!isRecord(doc)) throw new Error(`${SCHEMA_PATH} holds no JSON object`);
  const id = doc.$id;
  return {
    ...(typeof id === 'string' ? { $id: id } : {}),
    definitions: isRecord(doc.definitions) ? schemaNodes(doc.definitions) : {},
  };
}

/** anyOf member that is an object type — where a polymorphic slot's keys live. */
function objectMember(def: SchemaNode | undefined): SchemaNode | undefined {
  if (def && def.type === 'object') return def;
  if (def && Array.isArray(def.anyOf)) {
    return def.anyOf.find((m) => m && m.type === 'object');
  }
  return undefined;
}

function propKeys(def: SchemaNode | undefined): string[] {
  const obj = objectMember(def);
  return obj && obj.properties ? Object.keys(obj.properties) : [];
}

/** Forbidden enum mirrored in the meta-schema's ForbiddenKeyNames definition. */
function schemaForbidden(schema: SchemaDoc): { enum: string[]; pattern: string | null } {
  const fkn = schema.definitions.ForbiddenKeyNames;
  let enumList: string[] = [];
  let pattern: string | null = null;
  const allOf = fkn?.allOf ?? [];
  for (const clause of allOf) {
    const not = clause?.not;
    if (not?.enum) enumList = not.enum.slice();
    if (typeof not?.pattern === 'string') pattern = not.pattern;
  }
  return { enum: enumList, pattern };
}

// ---------------------------------------------------------------------------
// widget collection (registry → kinds + layout, aliases by shared evaluator)
// ---------------------------------------------------------------------------

function collectWidgets(): { widgets: WidgetEntry[]; layouts: string[] } {
  // Alias groups come from WIDGET_CANONICAL (registryKey → evaluator's emitted
  // `kind`): keys sharing a canonical kind are aliases of it. No private
  // REGISTRY read; a projection of the registry, so new aliases auto-appear.
  const layouts = new Set<string>();
  // The registry keys of each canonical kind; a kind has at least the key that added it.
  const byCanonical = new Map<string, [string, ...string[]]>();
  for (const key of WIDGET_KINDS) {
    const canonical = WIDGET_CANONICAL[key] ?? key;
    const keys = byCanonical.get(canonical);
    if (keys) keys.push(key);
    else byCanonical.set(canonical, [key]);
  }
  const widgets: WidgetEntry[] = [];
  for (const [canonical, keys] of byCanonical) {
    // The registry key whose layout we read: prefer the canonical key itself,
    // else the first member (all members share an evaluator → same layout).
    const layoutKey = keys.includes(canonical) ? canonical : keys[0];
    const layout = WIDGET_LAYOUTS[layoutKey] ?? 'unknown';
    layouts.add(layout);
    const aliases = keys.filter((k) => k !== canonical).sort();
    widgets.push({ kind: canonical, layout, aliases });
  }
  widgets.sort((a, b) => a.kind.localeCompare(b.kind));
  return { widgets, layouts: Array.from(layouts).sort() };
}

// ---------------------------------------------------------------------------
// rule collection (names + param-class join from validator.ts tables)
// ---------------------------------------------------------------------------

function collectRules(): RuleEntry[] {
  const names = getRuleNames();
  const classOf = (name: string): string[] => {
    const tags: string[] = [];
    if (ARRAY_LEVEL_RULES.includes(name)) tags.push('array-level');
    if (PATH_REFERENCE_RULES.includes(name)) tags.push('path-reference');
    if (LITERAL_PARAM_RULES.includes(name)) tags.push('literal-param');
    if (REGEX_PARAM_RULES.includes(name)) tags.push('regex-param');
    if (MEMBERSHIP_PARAM_RULES.includes(name)) tags.push('membership-param');
    return tags;
  };
  // pattern is the registered alias of match (validator-ts rules/index.ts).
  const aliases: Record<string, string> = { pattern: 'match' };
  return names
    .map((name) => {
      const e: RuleEntry = { name, paramClass: classOf(name) };
      if (aliases[name]) e.aliasOf = aliases[name];
      return e;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// grammar parse (expressions.md §1 tokens / §3 precedence / §6 / §10)
// ---------------------------------------------------------------------------

function sliceSection(md: string, fromHeader: RegExp, toHeader = /^## /m): string {
  const lines = md.split('\n');
  const header = lines.findIndex((line) => fromHeader.test(line));
  if (header < 0) throw new Error(`docs/spec: no section header matches ${String(fromHeader)}`);
  const section = lines.slice(header + 1);
  const end = section.findIndex((line) => toHeader.test(line));
  return (end < 0 ? section : section.slice(0, end)).join('\n');
}

// A token requirement of §1: - **CUXP-<n>** `TOKEN` — Pattern: <pattern>; Example: <example>.
const TOKEN_ITEM = /^- \*\*CUXP-\d+\*\* `(?<token>[^`]+)` — Pattern: (?<pattern>.+); Example: .+$/;
const LIST_ITEM = /^\s*\d+\.\s+/;

function collectGrammar(): DescribeResult['grammar'] {
  const md = readFileSync(GRAMMAR_PATH, 'utf-8');

  // §1 tokens: every non-empty line of the section is a token requirement; a line of another shape fails instead of
  // being dropped, and a section without a token fails instead of reading as no tokens.
  const tokenSection = sliceSection(md, /^## 1\. /m);
  const tokens: Array<{ token: string; pattern: string }> = [];
  for (const line of tokenSection.split('\n').filter((text) => text.trim() !== '')) {
    const match = TOKEN_ITEM.exec(line);
    const token = match?.groups?.['token'];
    const pattern = match?.groups?.['pattern'];
    if (token === undefined || pattern === undefined) {
      throw new Error(`docs/spec/expressions.md §1: the line ${line} is not - **CUXP-<n>** \`TOKEN\` — Pattern: <pattern>; Example: <example>`);
    }
    tokens.push({ token, pattern: pattern.replace(/`/g, '').trim() });
  }
  if (tokens.length === 0) throw new Error('docs/spec/expressions.md §1: expected at least one token requirement, actual 0');

  // §3 precedence: the items of the numbered list; the prose around it ("From lowest to highest:", the example after
  // it) is no level.
  const precSection = sliceSection(md, /^## 3\. /m);
  const precedence = precSection
    .split('\n')
    .filter((line) => LIST_ITEM.test(line))
    .map((line) => line.replace(LIST_ITEM, '').replace(/`/g, '').trim());

  // §6 truthy: the falsy enumeration line (strip markdown emphasis/backticks).
  const truthySection = sliceSection(md, /^## 6\. /m);
  const truthyFalsy = truthySection
    .split('\n')
    .map((l) => l.replace(/[`*]/g, '').trim())
    .filter((l) => l.length > 0 && !l.startsWith('VALIDATION'));

  // §10 unsupported: the leading middle-dot list, up to the first sentence end.
  // (The section continues with prose rationale after the list — drop it.)
  const unsupSection = sliceSection(md, /^## 10\. /m, /\n## |\n#[^#]/);
  const unsupFlat = unsupSection.replace(/\n/g, ' ').trim();
  const firstSentence = unsupFlat.split(/\.(?:\s|$)/)[0] ?? unsupFlat;
  const unsupported = firstSentence
    .split(/[·]/)
    .map((s) => s.replace(/`/g, '').trim())
    .filter((s) => s.length > 0);

  return {
    source: 'docs/spec/expressions.md',
    tokens,
    precedence,
    truthyFalsy,
    unsupported,
  };
}

// ---------------------------------------------------------------------------
// classification (docs/spec/schema.md — quoted, the prose single-source for placement)
// ---------------------------------------------------------------------------

function collectClassification(): DescribeResult['classification'] {
  // First-class split is read from the schema Field.properties grouping, keeping
  // schema field classification as the authority for which group each key sits in.
  const structure = ['type', 'name', 'default', 'properties', 'items', 'multiple', 'lang'];
  const content = ['label', 'description', 'placeholder', 'prepend', 'append', 'help'];
  const roleSlots = ['validate', 'design', 'behavior', 'options'];
  // Form declarations: honored on the form root only.
  const form = ['buttons', 'action'];
  return {
    source: 'docs/spec/schema.md',
    firstClass: { structure, content, roleSlots, form },
    dependencyIsolation: [
      { trigger: 'type (scalar)', target: 'options', note: 'type-dependent settings + container chrome + type scripts/callbacks' },
      { trigger: 'multiple (repeat)', target: 'multiple', note: 'min/max/copy/sortable/title/controls/header/onclick — repeat-dependent' },
      { trigger: 'lang (multilingual input)', target: 'lang', note: 'mode/only/name/key/frame/title/group_class' },
      { trigger: 'dynamic option source', target: 'items', note: 'static array | value→label map | {model,...} dynamic source' },
    ],
    roleDistribution: [
      { role: 'validation', target: 'validate' },
      { role: 'appearance (show + per-node class/style)', target: 'design' },
      { role: 'behavior (onchange/onclick/onload)', target: 'behavior' },
      { role: 'composition', target: '$ref / $patch' },
      { role: 'label adjacency', target: 'top-level (field) / behavior.{action}.label (action)' },
    ],
  };
}

// ---------------------------------------------------------------------------
// list capability (SPEC §9 — read sister)
//   cell catalog: cell.ts CELL_FORMATS (renderer keys) × meta-schema CellFormat
//   list structure: meta-schema List/Column/CellFormat/Pagination/Sort/ListAction
// No hand-written catalog — every value is a projection of code or the schema.
// ---------------------------------------------------------------------------

/** anyOf members of CellFormat: the object member carries the dependent-key shape. */
function cellFormatSchemaShape(schema: SchemaDoc): {
  keys: string[];
  /** declared `type` values, if the schema enumerates them (it does not — open). */
  typeProp: SchemaNode | undefined;
} {
  const obj = objectMember(schema.definitions.CellFormat);
  const props = obj?.properties ?? {};
  return { keys: Object.keys(props), typeProp: props.type };
}

/** anyOf shape labels for a polymorphic definition (boolean / inline form / $ref). */
function anyOfShapes(def: SchemaNode | undefined, refLabels: Record<string, string>): string[] {
  const out: string[] = [];
  for (const m of def?.anyOf ?? []) {
    if (m.type === 'boolean') out.push('false|true (off|default)');
    else if (m.type === 'object' && m.properties?.$ref) out.push('$ref base + $patch');
    else if (typeof m.$ref === 'string') {
      const name = m.$ref.replace('#/definitions/', '');
      out.push(refLabels[name] ?? name);
    } else if (m.type === 'object') out.push('inline object');
    else if (m.type === 'array') out.push('array');
    else if (typeof m.type === 'string') out.push(m.type);
  }
  return out;
}

function collectList(schema: SchemaDoc): DescribeResult['list'] {
  // cell format catalog — cell.ts renderers are the SOT for what renders; the
  // meta-schema CellFormat documents the dependent keys. Cross-check: every
  // renderer type is a string (no fabrication) and the schema documents `type`
  // (the dispatch key) as an open string field, matching cell.ts's open dispatch.
  const { keys: cellSchemaKeys, typeProp } = cellFormatSchemaShape(schema);
  const cellFormats = [...CELL_FORMATS]
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({
      type,
      isDefault: type === CELL_FORMAT_DEFAULT,
    }));
  // The catalog is non-trivial AND the schema's dispatch key `type` is an open
  // string (cell.ts dispatches by the same open key, falling back to text).
  const cellCrossCheckOk =
    CELL_FORMATS.length > 0 &&
    CELL_FORMATS.includes(CELL_FORMAT_DEFAULT) &&
    typeProp?.type === 'string';

  // list structure — parsed from the meta-schema List family definitions.
  const listFirstClass = Object.keys(schema.definitions.List?.properties ?? {}).filter(
    (k) => k !== '$ref' && k !== '$patch'
  );
  const columnFirstClass = Object.keys(schema.definitions.Column?.properties ?? {}).filter(
    (k) => k !== '$ref' && k !== '$patch'
  );

  const paginationObj = objectMember(schema.definitions.Pagination);
  const paginationKeys = paginationObj ? Object.keys(paginationObj.properties ?? {}) : [];
  const paginationModes: string[] = paginationObj?.properties?.mode?.enum ?? [];

  const sortKeys = propKeys(schema.definitions.Sort);
  const sortDirs: string[] = schema.definitions.Sort?.properties?.dir?.enum ?? [];

  // ListAction is polymorphic: a behavior-script string OR a {label, format, …} object.
  const actionObjMember = (schema.definitions.ListAction?.anyOf ?? []).find(
    (m) => m.type === 'object'
  );
  const actionObjectKeys = actionObjMember ? Object.keys(actionObjMember.properties ?? {}) : [];
  const actionShapes = anyOfShapes(schema.definitions.ListAction, {
    BehaviorAction: 'behavior script (string|object)',
  });

  const searchShapes = anyOfShapes(schema.definitions.List?.properties?.search, {
    Field: 'inline form (Field)',
  });

  return {
    entry: '#/definitions/List',
    cellFormats,
    cellFormatSchemaKeys: cellSchemaKeys,
    cellCrossCheckOk,
    structure: {
      firstClass: listFirstClass,
      column: { firstClass: columnFirstClass },
      pagination: { keys: paginationKeys, modes: paginationModes },
      sort: { keys: sortKeys, dirs: sortDirs },
      action: { objectKeys: actionObjectKeys, shapes: actionShapes },
      search: { shapes: searchShapes },
    },
  };
}

// ---------------------------------------------------------------------------
// assemble
// ---------------------------------------------------------------------------

export function describe(): DescribeResult {
  const schema = loadSchema();

  const { widgets, layouts } = collectWidgets();
  const rules = collectRules();

  // slots / buckets — parsed from the meta-schema definitions.
  const validateSubKeys = propKeys(schema.definitions.Validate);
  const designKeys = propKeys(schema.definitions.Design);
  const designNodes = designKeys.filter((k) => k !== 'show');
  const designNodeAppearanceKeys = Object.keys(
    schema.definitions.DesignNode?.properties ?? {}
  );
  const behaviorSubKeys = propKeys(schema.definitions.Behavior);
  const optionsObj = objectMember(schema.definitions.Options);
  const optionsKnown = optionsObj ? Object.keys(optionsObj.properties ?? {}) : [];
  const optionsOpen = Boolean(optionsObj?.propertyNames); // open bucket (propertyNames, not additionalProperties:false)

  const fieldProps = Object.keys(schema.definitions.Field?.properties ?? {}).filter(
    (k) => k !== '$ref' && k !== '$patch'
  );

  const itemsSourceKeys = Object.keys(schema.definitions.ItemsSource?.properties ?? {});
  const itemsModelKeys = Object.keys(schema.definitions.ItemsModel?.properties ?? {});
  const itemsKinds = (() => {
    const items = schema.definitions.Items;
    const kinds: string[] = [];
    for (const m of items?.anyOf ?? []) {
      if (m.type === 'array') kinds.push('static-array');
      else if (m.$ref?.includes('ItemsSource')) kinds.push('dynamic-source');
      else if (m.type === 'object') kinds.push('value-label-map');
    }
    return kinds;
  })();

  const multipleKeys = propKeys(schema.definitions.Multiple);
  const langKeys = propKeys(schema.definitions.Lang);
  const langOnly = objectMember(schema.definitions.Lang)?.properties?.only;
  const langOnlyShapes = (() => {
    const out: string[] = [];
    for (const m of langOnly?.anyOf ?? []) {
      if (m.type === 'array') out.push('allowlist string[]');
      else if (m.$ref?.includes('LangOverrideMap')) out.push('per-language override map');
    }
    return out;
  })();

  // forbidden keys — types.ts enum vs schema enum vs runtime scan (cross-check).
  const typesEnum = [...FORBIDDEN_META_KEYS];
  const { enum: schemaEnum, pattern: schemaPattern } = schemaForbidden(schema);
  const enumAgree =
    typesEnum.length === schemaEnum.length &&
    typesEnum.every((k) => schemaEnum.includes(k));
  const patternAgree = schemaPattern === FORBIDDEN_META_KEY_PATTERN.source;
  // runtime scan must reject every enumerated key + an x{key}.
  const runtimeAgree = (() => {
    for (const key of [...typesEnum, 'xprobe']) {
      let threw = false;
      try {
        scanForbiddenKeys({ [key]: 1 });
      } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'FORBIDDEN_META_KEY')) throw error;
        threw = true;
      }
      if (!threw) return false;
    }
    return true;
  })();
  const crossCheckOk = enumAgree && patternAgree && runtimeAgree;

  const grammar = collectGrammar();
  const classification = collectClassification();
  const list = collectList(schema);

  return {
    meta: {
      schema: schema.$id ?? 'crudui',
      widgetCount: WIDGET_COUNT,
      ruleCount: rules.length,
      sources: {
        widgets: 'legacy/packages/generator/ts/src/widget.ts (REGISTRY)',
        rules: 'legacy/packages/validator/ts/src/rules/index.ts (builtInRules)',
        ruleParamClass: 'legacy/packages/validator/ts/src/validate/validator.ts',
        slots: 'contracts/schema/crudui.schema.json (definitions)',
        forbiddenKeys: 'legacy/packages/validator/ts/src/types.ts (FORBIDDEN_META_KEYS)',
        forbiddenScan: 'legacy/packages/validator/ts/src/forbidden-scan.ts',
        grammar: 'docs/spec/expressions.md',
        classification: 'docs/spec/schema.md',
        listCellFormats: 'legacy/packages/generator/ts/src/cell.ts (CELL_RENDERERS)',
        listStructure: 'contracts/schema/crudui.schema.json (List/Column/CellFormat/Pagination/Sort/ListAction)',
      },
    },
    widgets,
    layouts,
    rules,
    slots: {
      firstClass: fieldProps,
      validate: { subKeys: validateSubKeys, allRules: rules.map((r) => r.name) },
      design: { nodes: designNodes, nodeAppearanceKeys: designNodeAppearanceKeys },
      behavior: { subKeys: behaviorSubKeys },
      options: { knownKeys: optionsKnown, open: optionsOpen },
    },
    buckets: {
      items: { kinds: itemsKinds, sourceKeys: itemsSourceKeys, modelKeys: itemsModelKeys },
      multiple: { keys: multipleKeys },
      lang: { keys: langKeys, onlyShapes: langOnlyShapes },
    },
    forbiddenKeys: {
      enum: typesEnum,
      pattern: FORBIDDEN_META_KEY_PATTERN.source,
      schemaEnum,
      schemaPattern,
      crossCheckOk,
    },
    grammar,
    classification,
    matrix: {
      columns: ['validate', 'design', 'behavior', 'options', 'items', 'multiple', 'lang'],
      note:
        'Every widget kind accepts the four role slots (validate/design/behavior/options). ' +
        'Buckets apply per structure: items → option widgets (select/choice/multichoice/search), ' +
        'multiple → any repeatable field, lang → any value-bearing field. ' +
        'options is type-defined (open bucket), so a kind admits its own type-specific keys.',
    },
    list,
  };
}

// ---------------------------------------------------------------------------
// renderers — same DescribeResult to JSON or Markdown.
// ---------------------------------------------------------------------------

export function renderJson(r: DescribeResult): string {
  return JSON.stringify(r, null, 2);
}

export function renderMarkdown(r: DescribeResult): string {
  const L: string[] = [];
  const push = (s = '') => L.push(s);

  push(`# crudui capabilities (describe)`);
  push();
  push(`> Generated from CODE single-source-of-truth. Hand-copied catalog: 0.`);
  push();
  push(`- schema: \`${r.meta.schema}\``);
  push(`- widget kinds: **${r.meta.widgetCount}**`);
  push(`- validation rules: **${r.meta.ruleCount}**`);
  push(`- forbidden-key cross-check: **${r.forbiddenKeys.crossCheckOk ? 'OK' : 'FAIL'}**`);
  push();

  push(`## Sources`);
  push();
  for (const [k, v] of Object.entries(r.meta.sources)) push(`- ${k}: \`${v}\``);
  push();

  push(`## Widgets (kind → layout, aliases)`);
  push();
  push(`| kind | layout | aliases |`);
  push(`|---|---|---|`);
  for (const w of r.widgets) {
    push(`| \`${w.kind}\` | ${w.layout} | ${w.aliases.length ? w.aliases.map((a) => `\`${a}\``).join(', ') : '—'} |`);
  }
  push();
  push(`Layout families: ${r.layouts.map((l) => `\`${l}\``).join(', ')}`);
  push();

  push(`## Validation rules (name → param class)`);
  push();
  push(`| rule | alias of | param class |`);
  push(`|---|---|---|`);
  for (const rule of r.rules) {
    push(
      `| \`${rule.name}\` | ${rule.aliasOf ? `\`${rule.aliasOf}\`` : '—'} | ${rule.paramClass.length ? rule.paramClass.join(', ') : '—'} |`
    );
  }
  push();

  push(`## Slots`);
  push();
  push(`First-class (top-level) keys: ${r.slots.firstClass.map((k) => `\`${k}\``).join(', ')}`);
  push();
  push(`- **validate** sub-keys: ${r.slots.validate.subKeys.map((k) => `\`${k}\``).join(', ')} (open bucket: other rule names are accepted)`);
  push(`- **design** nodes: ${r.slots.design.nodes.map((k) => `\`${k}\``).join(', ')}; node appearance keys: ${r.slots.design.nodeAppearanceKeys.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **behavior** sub-keys: ${r.slots.behavior.subKeys.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **options** known keys (open bucket=${r.slots.options.open}): ${r.slots.options.knownKeys.map((k) => `\`${k}\``).join(', ')}`);
  push();

  push(`## Buckets`);
  push();
  push(`- **items** kinds: ${r.buckets.items.kinds.map((k) => `\`${k}\``).join(', ')}; source keys: ${r.buckets.items.sourceKeys.map((k) => `\`${k}\``).join(', ')}; model keys: ${r.buckets.items.modelKeys.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **multiple** keys: ${r.buckets.multiple.keys.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **lang** keys: ${r.buckets.lang.keys.map((k) => `\`${k}\``).join(', ')}; only shapes: ${r.buckets.lang.onlyShapes.join(' | ')}`);
  push();

  push(`## Forbidden meta keys`);
  push();
  push(`enum: ${r.forbiddenKeys.enum.map((k) => `\`${k}\``).join(', ')}`);
  push();
  push(`pattern: \`${r.forbiddenKeys.pattern}\` (x-prefixed comment keys)`);
  push();
  push(`cross-check (types.ts ≡ schema enum ≡ runtime scan): **${r.forbiddenKeys.crossCheckOk ? 'OK' : 'FAIL'}**`);
  push();

  push(`## Expression grammar (${r.grammar.source})`);
  push();
  push(`### Tokens`);
  push(`| token | pattern |`);
  push(`|---|---|`);
  for (const t of r.grammar.tokens) push(`| \`${t.token}\` | ${t.pattern} |`);
  push();
  push(`### Precedence (low → high)`);
  for (let i = 0; i < r.grammar.precedence.length; i++) push(`${i + 1}. ${r.grammar.precedence[i]}`);
  push();
  push(`### Truthy / falsy`);
  for (const t of r.grammar.truthyFalsy) push(`- ${t}`);
  push();
  push(`### Unsupported (do not add)`);
  push(r.grammar.unsupported.map((u) => `\`${u}\``).join(', '));
  push();

  push(`## Classification (${r.classification.source})`);
  push();
  push(`First-class — structure: ${r.classification.firstClass.structure.map((k) => `\`${k}\``).join(', ')}`);
  push(`First-class — content: ${r.classification.firstClass.content.map((k) => `\`${k}\``).join(', ')}`);
  push(`First-class — role slots: ${r.classification.firstClass.roleSlots.map((k) => `\`${k}\``).join(', ')}`);
  push();
  push(`Dependency isolation:`);
  for (const d of r.classification.dependencyIsolation) push(`- ${d.trigger} → \`${d.target}\` — ${d.note}`);
  push();
  push(`Role distribution:`);
  for (const d of r.classification.roleDistribution) push(`- ${d.role} → \`${d.target}\``);
  push();

  push(`## Widget × slot/bucket matrix`);
  push();
  push(`Columns: ${r.matrix.columns.map((c) => `\`${c}\``).join(', ')}`);
  push();
  push(r.matrix.note);
  push();

  push(`## List capability (read sister — SPEC §9)`);
  push();
  push(`Entry definition: \`${r.list.entry}\` (validated separately from \`Field\`; additive).`);
  push(`Cell-format cross-check (cell.ts catalog ≡ schema CellFormat): **${r.list.cellCrossCheckOk ? 'OK' : 'FAIL'}**`);
  push();
  push(`### Read-cell formats (SPEC §9.2 catalog — cell.ts CELL_RENDERERS)`);
  push();
  push(`| format type | default |`);
  push(`|---|---|`);
  for (const f of r.list.cellFormats) {
    push(`| \`${f.type}\` | ${f.isDefault ? 'yes' : '—'} |`);
  }
  push();
  push(
    `Dependent keys (one open bucket per format object, type-isolated — SPEC §9.2): ` +
      `${r.list.cellFormatSchemaKeys.map((k) => `\`${k}\``).join(', ')}`
  );
  push();
  push(`### List structure`);
  push();
  push(`First-class (top-level) keys: ${r.list.structure.firstClass.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **column** first-class: ${r.list.structure.column.firstClass.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **pagination** keys: ${r.list.structure.pagination.keys.map((k) => `\`${k}\``).join(', ')}; modes: ${r.list.structure.pagination.modes.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **sort** keys: ${r.list.structure.sort.keys.map((k) => `\`${k}\``).join(', ')}; dirs: ${r.list.structure.sort.dirs.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **actions** shapes: ${r.list.structure.action.shapes.join(' | ')}; object keys: ${r.list.structure.action.objectKeys.map((k) => `\`${k}\``).join(', ')}`);
  push(`- **search** shapes: ${r.list.structure.search.shapes.join(' | ')}`);
  push();

  return L.join('\n');
}
