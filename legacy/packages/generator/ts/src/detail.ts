/** Build the read-only detail model from the shared list display engine. */

import { FormInputError } from '@polyspec/crudui-validator';
import { checkedComposition } from '@polyspec/crudui-validator/internal';
import { buildDisplay, type ActionVM, type BuildListOptions, type CellVM } from './list';
import { checkArgumentText, DISPLAY_OPTIONS } from './input-text';
import type { ResolvedDesign } from './design';

/** One field of a detail view model: a list cell with its key and its translated label. */
export interface DetailFieldVM extends CellVM {
  /** Stable field key from the detail declaration. */
  key: string;
  /** Translated field label. */
  label: string;
}

/** Complete evaluated, markup-free detail model. */
export interface DetailViewModel {
  /** Ordered read-only fields. */
  fields: DetailFieldVM[];
  /** Resolved detail actions in declaration order; empty when none are declared. */
  actions: ActionVM[];
  /** Resolved detail-container design. */
  design: ResolvedDesign;
}

/** Options for building a detail view model: the list options without the list-only `page` and `total`. */
export type BuildDetailOptions = Omit<BuildListOptions, 'page' | 'total'>;

/**
 * Compose a detail specification, evaluate one supplied record and return
 * display cells. Detail delegates field composition, conditions, localization
 * and cell formatting to the list engine; it queries no data.
 */
export function buildDetail(
  detailSpec: Record<string, unknown>,
  record: Record<string, unknown> = {},
  options: BuildDetailOptions = {},
): DetailViewModel {
  // Input text is checked first (docs/spec/input-text.md).
  const loader = checkedComposition(detailSpec, options);
  checkArgumentText([['record', record]], options, DISPLAY_OPTIONS);
  if (detailSpec === null || typeof detailSpec !== 'object' || Array.isArray(detailSpec)) {
    throw new FormInputError('Detail specification must be an object');
  }
  // Argument shapes in argument order, then the declaration, then options.
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new FormInputError('Detail record must be an object');
  }
  if (!Object.prototype.hasOwnProperty.call(detailSpec, 'fields')) {
    throw new FormInputError('Detail specification must declare fields');
  }
  const context = options.data;
  if (context !== undefined && context !== null && (typeof context !== 'object' || Array.isArray(context))) {
    throw new FormInputError('Detail context must be an object');
  }
  // Page and total are list-only options: a detail neither checks nor uses them.
  const vm = buildDisplay(
    detailSpec,
    [record],
    { ...options, ...(loader ? { loader } : {}), page: null, total: null },
    { own: 'detail', members: 'fields' },
  );
  const row = vm.rows[0];
  return {
    fields: vm.columns.map((column, index) => ({
      key: column.key,
      label: column.label,
      ...row?.cells[index],
    })),
    actions: vm.actions,
    design: vm.design,
  };
}

/** Compose, evaluate and render one read-only detail without data access. */
export type RenderDetail = (
  detailSpec: Record<string, unknown>,
  record?: Record<string, unknown>,
  options?: BuildDetailOptions,
) => string;

/** The detail renderer of a framework: the core builds the model, `render` writes the framework's HTML of it. */
export function detailRenderer(render: (vm: DetailViewModel) => string): RenderDetail {
  return (detailSpec, record = {}, options = {}) => render(buildDetail(detailSpec, record, options));
}
