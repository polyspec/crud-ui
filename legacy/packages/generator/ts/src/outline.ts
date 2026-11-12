/** Structure map model derived from evaluated nodes: one entry per form row. */

import type { ControlsVM, NodeVM } from './viewmodel';

/** What a structure map renders: evaluated nodes and undo availability, such as a form snapshot. */
export interface OutlineState {
  /** Evaluated form nodes. */
  readonly fields: NodeVM[];
  /** Whether the undo control is enabled. */
  readonly canUndo: boolean;
  /** Whether the redo control is enabled. */
  readonly canRedo: boolean;
}

/** One row in the structure map. */
export interface OutlineRow {
  /** Collection data path. */
  path: string;
  /** Row key. */
  key: string;
  /** Row number text. */
  number?: string;
  /** Row title text. */
  title?: string;
  /** Row controls placed in the map (`multiple.controls: outline`); the map shows those of the current row. */
  controls?: ControlsVM;
  /** Rows nested in this row, in data order. */
  rows: OutlineRow[];
}

/** The rows under nodes, looking through every node that is not a collection. */
function rows(nodes: readonly NodeVM[] | undefined): OutlineRow[] {
  return (nodes ?? []).flatMap((node): OutlineRow[] => node.kind !== 'collection'
    ? rows(node.children)
    : (node.children ?? []).map((row): OutlineRow => ({
      path: node.path ?? '',
      key: row.key ?? '',
      ...(row.header?.number !== undefined ? { number: row.header.number } : {}),
      ...(row.header?.title !== undefined ? { title: row.header.title } : {}),
      ...(row.controls?.placement === 'outline' ? { controls: row.controls } : {}),
      rows: rows(row.children),
    })));
}

/** Build the structure map: the form's rows, nested as in the form. */
export function buildOutline(nodes: readonly NodeVM[]): OutlineRow[] {
  return rows(nodes);
}
