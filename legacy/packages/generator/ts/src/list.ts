/** Evaluate list declarations and supplied records for framework renderers. */

import { FormInputError, type FileLoader } from '@polyspec/crudui-validator';
import { checkedComposition, composeProperties, MemoryLoader, scanForbiddenKeys } from '@polyspec/crudui-validator/internal';
import { checkArgumentText, DISPLAY_OPTIONS } from './input-text';
import { makeTranslate, type Language } from './content';
import { LIST_MESSAGES } from './interface-messages';
import { resolveDesign, type ResolvedDesign } from './design';
import { evalFlag, makeContext } from './expr';
import { parsePathString, getValueByPath, isRecord } from './util';
import {
  normalizeFormat,
  renderCell,
  type CellFormatModel,
  type CellDisplay,
  type CellRenderCtx,
} from './cell';
import { checkDisplayDeclarations, type DisplayPaths } from './display-declaration';

// ---------------------------------------------------------------------------
// view model shapes
// ---------------------------------------------------------------------------

/** A resolved list column header (markup-free). */
export interface ColumnVM {
  /** Stable column key (the column's name in the columns map). */
  key: string;
  /** Value path read from each row (the column `field`, '' when absent). */
  field: string;
  /** Translated header label (defaults to the column key). */
  label: string;
  /** Normalized cell format applied to every cell in this column. */
  format: CellFormatModel;
  /** Sort-allowed declaration (read-only; real sort is the server's job). */
  sortable: boolean;
  /** Resolved column-level design (evaluated against the build context). */
  design: ResolvedDesign;
}

/** A resolved cell within one row. */
export interface CellVM {
  /** The column's normalized format (shared shape with ColumnVM.format). */
  format: CellFormatModel;
  /** Raw value read from the injected row by the column `field` path; `null` when the row has none. */
  value: unknown;
  /** Display payload from the cell renderer (string or structured). */
  display: CellDisplay;
  /** Cell design resolved against THIS row (condition maps may read the row). */
  design: ResolvedDesign;
}

/** A resolved row: one cell per visible column. */
export interface RowVM {
  /** Cells in visible column order. */
  cells: CellVM[];
}

/** Resolved pagination declaration with the caller's current page and total. */
export interface PaginationVM {
  /** false when paging is off. */
  enabled: boolean;
  /** Declared number of rows per page. */
  perPage?: number;
  /** Declared pagination mode. */
  mode?: string;
  /** Current page from the `page` option, never derived from the rows. */
  page?: number;
  /** Total record count from the `total` option. */
  total?: number;
  /** Number of available pages; one page is retained for an empty result. */
  pageCount?: number;
  /** The previous, numbered and next buttons of enabled paging, in order. */
  buttons?: PaginationButtonVM[];
}

/**
 * One pagination button. A renderer chooses the button's text by its role (‹, the page number,
 * ›); `label` is its accessible name from the list interface messages.
 */
export interface PaginationButtonVM {
  /** What the button does. */
  role: 'previous' | 'page' | 'next';
  /** The page the button selects. */
  page: number;
  /** Accessible name in the display language. */
  label: string;
  /** true for the current page's button. */
  current: boolean;
  /** true when the button cannot be used. */
  disabled: boolean;
}

/** The list interface text of a display language: the table's entry for it, else English. */
function listMessages(language: string): (typeof LIST_MESSAGES)[keyof typeof LIST_MESSAGES] {
  return Object.entries(LIST_MESSAGES).find(([name]) => name === language)?.[1] ?? LIST_MESSAGES.en;
}

/**
 * The active sort direction of a column ('asc' or 'desc'), or undefined. A column matches the declared `sort` by its
 * `field` or its `key`; the sorted column carries `data-sort-dir`, so the declared sort is visible. The list is read-only:
 * the server applies the real ORDER BY.
 */
export function sortDir(vm: ListViewModel, col: ColumnVM): 'asc' | 'desc' | undefined {
  const sort = vm.sort;
  return sort && (sort.field === col.field || sort.field === col.key) ? sort.dir : undefined;
}

/** Return a bounded page-number window so a large total cannot allocate an unbounded DOM. */
export function paginationPages(page: number, pageCount: number): number[] {
  if (pageCount <= 0) return [];
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  return [...new Set([1, Math.max(1, page - 1), page, Math.min(pageCount, page + 1), pageCount])].sort((a, b) => a - b);
}

/** Resolved sort declaration. */
export interface SortVM {
  /** Data field to sort. */
  field: string;
  /** Sort direction. */
  dir: 'asc' | 'desc';
}

/** A resolved list or detail action. */
export interface ActionVM {
  /** Action key (the action's name in the actions map). */
  key: string;
  /** Translated action label (defaults to the action key). */
  label: string;
  /** Normalized action format (usually link), when present. */
  format?: CellFormatModel;
  /**
   * Event attribute names mapped to their opaque scripts (preserved verbatim), when present:
   * the declared `behavior` member names, or `onclick` for a script action, whose button runs
   * its script when it is clicked.
   */
  behavior?: Record<string, string>;
  /** Resolved action design, when present. */
  design?: ResolvedDesign;
}

/** The fully-evaluated, markup-free description of a list (SPEC §9.3). */
export interface ListViewModel {
  /** Visible columns (declaration order; `design.show:false` columns dropped). */
  columns: ColumnVM[];
  /** Resolved rows (one cell per visible column). */
  rows: RowVM[];
  /** Pagination declaration with the current page and total. */
  pagination: PaginationVM;
  /** Current sort declaration, or undefined when none. */
  sort?: SortVM;
  /** Resolved list actions (declaration order). */
  actions: ActionVM[];
  /** The declared empty-list text, or the interface message when none is declared. */
  empty: string;
  /** The translated list description; empty text when none is declared. */
  description: string;
  /** Resolved list-container design. */
  design: ResolvedDesign;
}

// ---------------------------------------------------------------------------
// options
// ---------------------------------------------------------------------------

/** Options for building a list view model. */
export interface BuildListOptions {
  /** Active content language (default 'ko'). */
  language?: Language;
  /**
   * List-level form data for column-visibility expressions (e.g.
   * `design.show: '.admin'` on a column). NOT the rows — rows are the separate argument.
   */
  data?: Record<string, unknown>;
  /** Current page supplied by the caller: absent, null or an integer from 1 to `Number.MAX_SAFE_INTEGER`. */
  page?: number | null;
  /** Total record count supplied by the caller: absent, null or an integer from 0 to `Number.MAX_SAFE_INTEGER`. */
  total?: number | null;
  /** $ref file set for composition (virtual in-memory loader). */
  files?: Record<string, Record<string, unknown>>;
  /** A custom loader (overrides `files`). */
  loader?: FileLoader;
  /** Basepath for relative $ref. */
  basepath?: string;
}

// ---------------------------------------------------------------------------
// resolution helpers
// ---------------------------------------------------------------------------


function resolveSortable(
  sortable: unknown,
  ctx: ReturnType<typeof makeContext>
): boolean {
  if (sortable === undefined || sortable === null) return false;
  if (typeof sortable === 'boolean') return sortable;
  // An Expression → evaluated as a condition against the list context.
  return evalFlag(sortable, ctx);
}

/** A page or total option: absent or null, or a safe integer of at least `min`. */
function countOption(value: unknown, min: number): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= min);
}

/**
 * The pagination model, in member order: enabled, then for enabled paging perPage, mode and
 * page with their defaults, the supplied total and pageCount. Disabled paging keeps only the
 * supplied page and total.
 */
function resolvePagination(
  pagination: unknown, page: number | null | undefined, total: number | null | undefined, language: string,
): PaginationVM {
  const enabled = pagination === true || isRecord(pagination);
  const vm: PaginationVM = { enabled };
  const declared = isRecord(pagination) ? pagination : {};
  const perPage = typeof declared.per_page === 'number' ? declared.per_page : 20;
  const currentPage = page ?? 1;
  if (enabled) {
    vm.perPage = perPage;
    vm.mode = typeof declared.mode === 'string' ? declared.mode : 'pages';
    vm.page = currentPage;
  } else if (page !== undefined && page !== null) {
    vm.page = page;
  }
  // `+ 0` writes negative zero as 0, as every runtime does.
  if (total !== undefined && total !== null) vm.total = total + 0;
  if (enabled) {
    const pageCount = vm.total === undefined ? 0 : Math.max(1, Math.ceil(vm.total / perPage));
    vm.pageCount = pageCount;
    // Without a total the current page is 1; a page after the last page selects the last page.
    const current = pageCount > 0 ? Math.min(pageCount, currentPage) : 1;
    const messages = listMessages(language);
    vm.buttons = [
      { role: 'previous', page: Math.max(1, current - 1), label: messages.previousPage, current: false, disabled: current <= 1 || pageCount === 0 },
      ...paginationPages(current, pageCount).map((value): PaginationButtonVM => ({
        role: 'page', page: value, label: messages.page.replace('{page}', String(value)), current: value === current, disabled: value === current,
      })),
      { role: 'next', page: pageCount > 0 ? Math.min(pageCount, current + 1) : 1, label: messages.nextPage, current: false, disabled: pageCount === 0 || current >= pageCount },
    ];
  }
  return vm;
}

function resolveSort(sort: unknown): SortVM | undefined {
  if (!isRecord(sort)) return undefined;
  const field = typeof sort.field === 'string' ? sort.field : '';
  if (!field) return undefined;
  const dir = sort.dir === 'desc' ? 'desc' : 'asc';
  return { field, dir };
}

function resolveActions(
  actions: unknown,
  t: ReturnType<typeof makeTranslate>
): ActionVM[] {
  if (!isRecord(actions)) return [];
  const out: ActionVM[] = [];
  for (const [key, raw] of Object.entries(actions)) {
    if (typeof raw === 'string') {
      // A script string: a button that runs the script when it is clicked.
      out.push({ key, label: key, behavior: { onclick: raw } });
      continue;
    }
    if (!isRecord(raw)) throw new FormInputError(`Invalid ${key} at actions: expected a script or an object`);
    const declared = raw;
    const label = declared.label !== undefined ? t(declared.label) : key;
    // An action object with a script is the object form of a script action.
    if (typeof declared.script === 'string') {
      out.push({ key, label, behavior: { onclick: declared.script } });
      continue;
    }
    const action: ActionVM = { key, label };
    if (declared.format !== undefined) action.format = normalizeFormat(declared.format);
    if (isRecord(declared.behavior)) {
      const beh: Record<string, string> = {};
      for (const [ev, scr] of Object.entries(declared.behavior)) {
        if (typeof scr === 'string') beh[ev] = scr;
        else if (isRecord(scr) && typeof scr.script === 'string') beh[ev] = scr.script;
      }
      if (Object.keys(beh).length > 0) action.behavior = beh;
    }
    out.push(action);
  }
  return out;
}

// ---------------------------------------------------------------------------
// the builder
// ---------------------------------------------------------------------------

/** The list layout option: absent or null selects `table`, and any value other than `table` or `card` fails. */
function listLayout(layout: unknown): 'table' | 'card' {
  if (layout === undefined || layout === null) return 'table';
  if (layout === 'table' || layout === 'card') return layout;
  throw new FormInputError('List layout must be table or card');
}

/** Check the input text and the list input rules in the order every runtime uses; returns the checked loader. */
function checkListInput(
  listSpec: Record<string, unknown>,
  rows: Array<Record<string, unknown>>,
  options: BuildListOptions
): FileLoader | undefined {
  // Input text is checked first (docs/spec/input-text.md).
  const loader = checkedComposition(listSpec, options);
  checkArgumentText([['rows', rows]], options, DISPLAY_OPTIONS);
  // List input, checked in the order every runtime uses (docs/spec/display-formats.md).
  if (!isRecord(listSpec)) throw new FormInputError('List specification must be an object');
  if (!Array.isArray(rows)) throw new FormInputError('List rows must be an array');
  if (rows.some((row) => !isRecord(row))) throw new FormInputError('List rows must be objects');
  if (!Object.prototype.hasOwnProperty.call(listSpec, 'columns')) {
    throw new FormInputError('List specification must declare columns');
  }
  if (options.data !== undefined && options.data !== null && !isRecord(options.data)) {
    throw new FormInputError('List context must be an object');
  }
  if (!countOption(options.page, 1)) throw new FormInputError('List page must be a positive integer');
  if (!countOption(options.total, 0)) throw new FormInputError('List total must be a nonnegative integer');
  return loader;
}

/**
 * Compose a list spec and build its `ListViewModel`. `rows` are injected (no DB
 * access); each cell value is read from a row by the column `field` path. Invalid
 * input fails with the messages in the display format specification, and an
 * unresolved `$ref` throws `ComposeLoadError` (never a silent render).
 */
export function buildList(
  listSpec: Record<string, unknown>,
  rows: Array<Record<string, unknown>> = [],
  options: BuildListOptions = {}
): ListViewModel {
  const loader = checkListInput(listSpec, rows, options);
  return buildDisplay(listSpec, rows, loader ? { ...options, loader } : options, { own: 'list', members: 'columns' });
}

/**
 * Build the list model of a renderer. The `layout` option is an input rule: it is checked after
 * the other input rules and before composition and the declarations.
 */
export function buildListLayout(
  listSpec: Record<string, unknown>,
  rows: Array<Record<string, unknown>>,
  options: BuildListOptions & { layout?: unknown }
): { vm: ListViewModel; layout: 'table' | 'card' } {
  const loader = checkListInput(listSpec, rows, options);
  const layout = listLayout(options.layout);
  return { vm: buildDisplay(listSpec, rows, loader ? { ...options, loader } : options, { own: 'list', members: 'columns' }), layout };
}

/** Options for list rendering. */
export interface RenderListOptions extends BuildListOptions {
  /** Table (default) or stacked-card layout. */
  layout?: 'table' | 'card';
}

/**
 * Compose a list specification, evaluate supplied rows and render list HTML. Throws `ComposeLoadError` when a
 * composition reference cannot be resolved.
 */
export type RenderList = (
  listSpec: Record<string, unknown>,
  rows?: Array<Record<string, unknown>>,
  options?: RenderListOptions,
) => string;

/** The list renderer of a framework: the core builds the model, `render` writes the framework's HTML of it. */
export function listRenderer(render: (vm: ListViewModel, layout: 'table' | 'card') => string): RenderList {
  return (listSpec, rows = [], options = {}) => {
    const { vm, layout } = buildListLayout(listSpec, rows, options);
    return render(vm, layout);
  };
}

/**
 * Build a list or detail display model from checked input. The member map named by `paths`
 * (`columns` or `fields`) and a list `search` with `$ref` or `$patch` are composed, the composed
 * specification is scanned for forbidden keys, and its declarations are checked.
 */
export function buildDisplay(
  spec: Record<string, unknown>,
  rows: Array<Record<string, unknown>>,
  options: BuildListOptions,
  paths: DisplayPaths
): ListViewModel {
  const t = makeTranslate(options.language ?? 'ko');
  const loader = options.loader ?? new MemoryLoader(options.files ?? {});
  const composeOpts = options.basepath ? { basepath: options.basepath } : {};
  const listData = options.data ?? {};

  // Stage 2: compose the member map (expands $ref/$patch at map + per-member).
  const rawMembers = spec[paths.members];
  if (!isRecord(rawMembers)) throw new FormInputError(`Invalid ${paths.members} at ${paths.own}: expected an object`);
  const columns = composeProperties(rawMembers, loader, composeOpts);
  const search = spec.search;
  const composeSearch = paths.own === 'list' && isRecord(search) &&
    (Object.prototype.hasOwnProperty.call(search, '$ref') || Object.prototype.hasOwnProperty.call(search, '$patch'));
  const composedSearch = composeSearch ? composeProperties(search, loader, composeOpts) : search;
  // The composed specification keeps the member order of the declared one.
  const listSpec: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(spec)) {
    listSpec[key] = key === paths.members ? columns : key === 'search' ? composedSearch : value;
  }
  // The forbidden-key scan and then the declarations, as the display format specification orders them.
  scanForbiddenKeys(listSpec);
  checkDisplayDeclarations(listSpec, paths);

  // List-level context for column-visibility expressions (over listData).
  const listCtx = makeContext([], listData);

  // Stages 3–4: resolve every column header (drop columns hidden by design.show).
  const columnVMs: ColumnVM[] = [];
  for (const [key, member] of Object.entries(columns)) {
    if (!isRecord(member)) throw new FormInputError(`Invalid ${paths.members}.${key} at ${paths.own}: expected an object`);
    const raw = member;
    const colCtx = makeContext([], listData);
    const colDesign = resolveDesign(raw.design, colCtx);
    if (!colDesign.show) continue; // condition-hidden column → omitted (G1).
    columnVMs.push({
      key,
      field: typeof raw.field === 'string' ? raw.field : '',
      label: raw.label !== undefined ? t(raw.label) : key,
      format: normalizeFormat(raw.format),
      sortable: resolveSortable(raw.sortable, listCtx),
      design: colDesign,
    });
  }

  // Re-read the composed column specs by key (for per-cell design re-evaluation).
  const colSpecs = columnVMs.map((c) => columns[c.key]);

  // Rows: one cell per visible column, value read by the column field path.
  const rowVMs: RowVM[] = rows.map((row) => {
    const cells: CellVM[] = columnVMs.map((col, i) => {
      const value = col.field ? getValueByPath(row, col.field) : undefined;
      // Per-cell expr context: the row is the formData, the field path is current.
      const cellExpr = makeContext(
        col.field ? parsePathString(col.field) : [],
        row
      );
      const cellDesign = resolveDesign(designOf(colSpecs[i]), cellExpr);
      const renderCtx: CellRenderCtx = { row, expr: cellExpr, t };
      return {
        format: col.format,
        // A model is JSON: a path absent from the row is `null`, and the member is always present.
        value: value === undefined ? null : value,
        display: renderCell(col.format, value, renderCtx),
        design: cellDesign,
      };
    });
    return { cells };
  });

  return {
    columns: columnVMs,
    rows: rowVMs,
    pagination: resolvePagination(listSpec.pagination, options.page, options.total, options.language ?? 'ko'),
    sort: resolveSort(listSpec.sort),
    actions: resolveActions(listSpec.actions, t),
    // An absent or null empty uses the interface message; a declared text is used as declared.
    empty: listSpec.empty === undefined || listSpec.empty === null
      ? listMessages(options.language ?? 'ko').emptyList : t(listSpec.empty),
    description: t(listSpec.description),
    design: resolveDesign(listSpec.design, listCtx),
  };
}

/** The design that a column specification declares. */
function designOf(spec: unknown): unknown {
  return isRecord(spec) ? spec.design : undefined;
}

/** A column `field` is an Expression path; a leading `.` means root-relative. */
