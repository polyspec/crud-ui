/**
 * list-spec read cell renderer (framework-agnostic core) — markup 0, the ONE
 * new surface list-spec adds over form-spec (SPEC §9.2). It is the read-side
 * symmetric of widget.ts: where a write widget turns a field `type`+`options`
 * into an INPUT control model, a read cell turns a column `format` (type +
 * isolated dependent keys) into a DISPLAY model — never an input.
 *
 * What it REUSES (no second engine): the same condition/expression engine
 * (expr.ts evalAppearance — for `href` condition maps), the same i18n translator
 * (content.ts makeTranslate — for badge labels, link/bool text, number affixes,
 * choice-label items), and the same Items classification policy as widget.ts
 * (static map/array → enumerated; dynamic `{ model, ... }` → preserved, never
 * fabricated). The catalog (SPEC §9.2): text/date/number/badge/link/
 * choice-label/bool/image/html.
 *
 * `cell.display` is a plain string for text/date/number/choice-label/html, and a
 * STRUCTURED value for badge (variant+label), link (href+text+target), image
 * (src+alt+size), bool (label+as) — the adapter assembles the element, it
 * recomputes nothing. The raw `cell.value` (read from the injected row by the
 * column `field` path) is kept beside `display` for debug/sort/key. eval is
 * never called.
 */

import { FormInputError } from '@polyspec/crudui-validator';
import { choicePairs, isChoiceList } from './choice-list';
import type { PathContext } from '@polyspec/crudui-validator';
import { evalAppearance } from './expr';
import type { Translate } from './content';
import { getValueByPath, isRecord, phpString } from './util';
import { formatDateValue } from './date';

/** A resolved cell format: the catalog type + its isolated dependent keys. */
export interface CellFormatModel {
  /** Catalog type (SPEC §9.2). Defaults to 'text'. */
  type: string;
  /** The original (composed) format object — opaque dependents pass through. */
  options: Record<string, unknown>;
}

/** A badge display: a CSS/variant token plus its translated label. */
export interface BadgeDisplay {
  /** Display type. */
  kind: 'badge';
  /** Variant token from the value→variant map (e.g. 'success', 'danger'). */
  variant: string;
  /** Translated label for the value (defaults to the value itself). */
  label: string;
}

/** A link display: resolved href + text + target. */
export interface LinkDisplay {
  /** Display type. */
  kind: 'link';
  /** href with explicit `{=field}` interpolation applied (condition map resolved). */
  href: string;
  /** Translated link text (defaults to the cell value). */
  text: string;
  /** Optional link target (`_blank`, …). */
  target?: string;
}

/** An image display: resolved src + alt + size. */
export interface ImageDisplay {
  /** Display type. */
  kind: 'image';
  /** Image source (the cell value). */
  src: string;
  /** Translated alt text with explicit `{=field}` interpolation. */
  alt: string;
  /** Image width. */
  width?: string;
  /** Image height. */
  height?: string;
}

/** A boolean display: the chosen label + the requested form. */
export interface BoolDisplay {
  /** Display type. */
  kind: 'bool';
  /** The resolved boolean. */
  value: boolean;
  /** Translated true/false label. */
  label: string;
  /** Display form: 'text' | 'icon' | 'check' (default 'text'). */
  as: string;
}

/** A raw-html display: passed through unescaped by the adapter. */
export interface HtmlDisplay {
  /** Display type. */
  kind: 'html';
  /** Raw HTML markup (NOT escaped — the adapter must dangerouslySetInnerHTML). */
  html: string;
}

/** The display payload a cell renderer emits: a string or a structured value. */
export type CellDisplay =
  | string
  | BadgeDisplay
  | LinkDisplay
  | ImageDisplay
  | BoolDisplay
  | HtmlDisplay;

// ---------------------------------------------------------------------------
// format normalization (CellFormat polymorphism — false|true|string|{object})
// ---------------------------------------------------------------------------

/**
 * Normalize a polymorphic `CellFormat` into `{ type, options }`. `false`/
 * `true`/absent → plain text; a bare string → that type with no dependents; an
 * object → its `type` (default 'text') plus the object as dependent options.
 */
export function normalizeFormat(format: unknown): CellFormatModel {
  if (format === undefined || format === null || format === false || format === true) {
    return { type: 'text', options: {} };
  }
  if (typeof format === 'string') {
    return { type: format || 'text', options: {} };
  }
  if (isRecord(format)) {
    const o = format;
    const type = typeof o.type === 'string' && o.type ? o.type : 'text';
    return { type, options: o };
  }
  return { type: 'text', options: {} };
}

// ---------------------------------------------------------------------------
// items classification (the SAME policy as widget.ts — static vs dynamic model)
// ---------------------------------------------------------------------------

/** A DYNAMIC items source is a `{ model, ... }` descriptor (preserved, not read). */
function isDynamicItemsSource(items: unknown): items is Record<string, unknown> {
  return isRecord(items) && 'model' in items;
}

/** Static items → a value→label lookup. Dynamic source → empty (never enumerate). */
function itemsLookup(items: unknown): Record<string, unknown> {
  if (items === null || items === undefined) return {};
  if (Array.isArray(items)) {
    const out: Record<string, unknown> = {};
    items.forEach((v, i) => {
      out[String(i)] = v;
    });
    return out;
  }
  if (isRecord(items)) {
    if (isDynamicItemsSource(items)) return {};
    return items;
  }
  return {};
}

// ---------------------------------------------------------------------------
// scalar formatting helpers
// ---------------------------------------------------------------------------

function truthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '' && value !== '0' && value !== 'false';
  return value !== null && value !== undefined && value !== '';
}

/**
 * Keep the first `limit` Unicode code points and append an ellipsis. Only a number limit applies;
 * its integer part must be at least 1, and a character is never split.
 */
function truncate(s: string, n: unknown): string {
  const limit = typeof n === 'number' ? Math.trunc(n) : Number.NaN;
  const characters = Array.from(s);
  if (!Number.isFinite(limit) || limit < 1 || characters.length <= limit) return s;
  return characters.slice(0, limit).join('') + '…';
}

/** Format supported date values using UTC date parts. */
function formatDate(value: unknown, pattern: unknown): string {
  const pat = typeof pattern === 'string' && pattern ? pattern : 'YYYY-MM-DD';
  return formatDateValue(phpString(value), pat);
}

/** Number format: decimals + thousands grouping; prefix/suffix are i18n content. */
function formatNumber(
  value: unknown,
  opts: Record<string, unknown>,
  t: Translate
): string {
  const n = typeof value === 'number' ? value : Number(phpString(value));
  if (!Number.isFinite(n)) return phpString(value);
  // Only a number applies; its integer part must be between 0 and 100.
  const decimals = typeof opts.decimals === 'number' ? Math.trunc(opts.decimals) : undefined;
  if (decimals !== undefined && !(decimals >= 0 && decimals <= 100)) {
    throw new FormInputError('Number decimals must be between 0 and 100');
  }
  let body = decimals !== undefined ? n.toFixed(decimals) : String(n);
  if (opts.thousands) {
    const [intPart, frac] = body.split('.');
    const grouped = (intPart ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    body = frac !== undefined ? `${grouped}.${frac}` : grouped;
  }
  const prefix = opts.prefix !== undefined ? t(opts.prefix) : '';
  const suffix = opts.suffix !== undefined ? t(opts.suffix) : '';
  return `${prefix}${body}${suffix}`;
}

/**
 * Interpolate explicit `{=field}` references in a template against the current row.
 * Text outside braces remains literal.
 */
function interpolate(
  template: string,
  row: Record<string, unknown>,
  cellValue: unknown
): string {
  return template.replace(/\{=[A-Za-z_][\w.]*\}/g, (token) => {
    const path = token.slice(2, -1);
    if (path === 'field') return phpString(cellValue);
    const v = getValueByPath(row, path);
    return v === undefined ? phpString(cellValue) : phpString(v);
  });
}

// ---------------------------------------------------------------------------
// the cell renderer (CellFormat + raw value → CellDisplay)
// ---------------------------------------------------------------------------

/** Inputs the cell renderer needs to produce one cell's display value. */
export interface CellRenderCtx {
  /** The whole injected row (for `{=path}` interpolation in href/alt). */
  row: Record<string, unknown>;
  /** Expr engine context for the cell's `field` path (href condition maps). */
  expr: PathContext;
  /** Active-language translator. */
  t: Translate;
}

/**
 * One cell renderer: a function that turns a raw value + the format's isolated
 * dependent keys (`o`) + render context into a `CellDisplay`.
 */
export type CellRenderer = (
  value: unknown,
  o: Record<string, unknown>,
  ctx: CellRenderCtx
) => CellDisplay;

/**
 * The read-cell format catalog AS DATA — the ONE table `renderCell` dispatches
 * over. This map is the single source of truth for the format catalog (SPEC
 * §9.2): `describe`'s list capability reads `CELL_FORMATS` (its keys), and the
 * renderer below dispatches by the same keys. Adding a renderer here surfaces a
 * new format in BOTH places with zero edits elsewhere (drift 0 — the read-side
 * symmetric of widget.ts `REGISTRY`). `text` is also the unknown-type fallback.
 */
export const CELL_RENDERERS: Readonly<Record<string, CellRenderer>> = {
  text: (value, o) => {
    const s = phpString(value);
    return o.truncate !== undefined ? truncate(s, o.truncate) : s;
  },

  date: (value, o) => formatDate(value, o.pattern),

  number: (value, o, ctx) => formatNumber(value, o, ctx.t),

  badge: (value, o, ctx) => {
    const map = isRecord(o.map) ? o.map : {};
    const key = phpString(value);
    // map is value→variant; the variant may be an i18n label (LangMap). A
    // plain-string variant is a style token and the value text is the label;
    // an i18n-object variant resolves to a string used as BOTH variant + label.
    const raw = key in map ? map[key] : undefined;
    if (typeof raw === 'object' && raw !== null) {
      const resolved = ctx.t(raw);
      return { kind: 'badge', variant: resolved, label: resolved };
    }
    return { kind: 'badge', variant: raw === undefined ? '' : phpString(raw), label: key };
  },

  link: (value, o, ctx) => {
    const rawHref = o.href;
    let hrefTemplate: string;
    if (typeof rawHref === 'string') {
      hrefTemplate = rawHref;
    } else if (rawHref && typeof rawHref === 'object') {
      // condition map → shared expr engine resolves the winning branch.
      hrefTemplate = evalAppearance(rawHref, ctx.expr);
    } else {
      hrefTemplate = '';
    }
    const href = interpolate(hrefTemplate, ctx.row, value);
    const text =
      o.text !== undefined && o.text !== null && o.text !== ''
        ? ctx.t(o.text)
        : phpString(value);
    const out: LinkDisplay = { kind: 'link', href, text };
    if (typeof o.target === 'string' && o.target) out.target = o.target;
    return out;
  },

  'choice-label': (value, o, ctx) => {
    const key = phpString(value);
    if (isChoiceList(o.items)) {
      const pair = (choicePairs(o.items) ?? []).find(([text]) => text === key);
      return pair ? ctx.t(pair[1]) : key;
    }
    const lookup = itemsLookup(o.items);
    if (key in lookup) {
      // A choice label is content: a string or a language map.
      return ctx.t(lookup[key]);
    }
    // dynamic {model} source or unknown key → preserve the raw code (never fabricate).
    return key;
  },

  bool: (value, o, ctx) => {
    const b = truthy(value);
    const labelSource = b ? o.true : o.false;
    const label =
      labelSource !== undefined && labelSource !== null
        ? ctx.t(labelSource)
        : b
        ? 'true'
        : 'false';
    const as = typeof o.as === 'string' && o.as ? o.as : 'text';
    return { kind: 'bool', value: b, label, as };
  },

  image: (value, o, ctx) => {
    // src is the raw cell value (a URL/path) — NOT an interpolation template.
    const src = phpString(value);
    const alt =
      o.alt !== undefined && o.alt !== null
        ? interpolate(ctx.t(o.alt), ctx.row, value)
        : '';
    const out: ImageDisplay = { kind: 'image', src, alt };
    if (o.width !== undefined) out.width = phpString(o.width);
    if (o.height !== undefined) out.height = phpString(o.height);
    return out;
  },

  html: (value) => ({ kind: 'html', html: phpString(value) }),
};

/**
 * The read-cell format catalog (SPEC §9.2) — a projection of `CELL_RENDERERS`'s
 * keys. NOT a hand-copied list: a renderer added above appears here, in
 * `renderCell`'s dispatch, and in `describe`'s list capability with zero edits
 * (drift 0). The read-side symmetric of `WIDGET_KINDS`.
 */
export const CELL_FORMATS: readonly string[] = Object.keys(CELL_RENDERERS);

/** The fallback format an unknown/absent `type` resolves to (also a catalog member). */
export const CELL_FORMAT_DEFAULT = 'text';

/**
 * Render one cell: dispatch on the normalized format type via `CELL_RENDERERS`
 * and produce the display payload. Unknown types fall back to text (never throw
 * out of render).
 */
export function renderCell(
  format: CellFormatModel,
  value: unknown,
  ctx: CellRenderCtx
): CellDisplay {
  const renderer = CELL_RENDERERS[format.type] ?? CELL_RENDERERS[CELL_FORMAT_DEFAULT];
  return renderer(value, format.options, ctx);
}
