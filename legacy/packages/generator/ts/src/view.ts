/** Row view state rules of form instances, also exported for data kept outside a form instance. */

import type { NodeVM } from './viewmodel';

/** View state kept outside record data; it is never submitted or serialized with the data. */
export interface ViewState {
  /** Row paths (`{collection}.{key}`) rendered collapsed. */
  readonly collapsed: ReadonlySet<string>;
}

/** The initial view: every row expanded. Replacing the record returns to it. */
export function initialView(): ViewState {
  return { collapsed: new Set() };
}

/** Whether `path` is the row path `rowPath` or lies inside that row. */
function rowPathContains(rowPath: string, path: string): boolean {
  return path === rowPath || path.startsWith(`${rowPath}.`);
}

/** Row paths (`{collection}.{key}`) of every collapsible row in evaluated nodes. */
export function collapsibleRows(nodes: readonly NodeVM[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.kind === 'collection') {
      for (const row of node.children ?? []) {
        if (row.collapsible) out.push(`${node.path}.${row.key}`);
        collapsibleRows(row.children ?? [], out);
      }
    } else {
      collapsibleRows(node.children ?? [], out);
    }
  }
  return out;
}

/** Expand a collapsed row or collapse an expanded one. */
export function toggleRowView(view: ViewState, rowPath: string): ViewState {
  const collapsed = new Set(view.collapsed);
  if (!collapsed.delete(rowPath)) collapsed.add(rowPath);
  return { collapsed };
}

/** Expand every row, or collapse every collapsible row of the evaluated nodes. */
export function setAllExpandedView(nodes: readonly NodeVM[], expanded: boolean): ViewState {
  return { collapsed: new Set(expanded ? [] : collapsibleRows(nodes)) };
}

/** Drop the collapsed state of a removed row and its descendants. */
export function removeRowView(view: ViewState, rowPath: string): ViewState {
  return { collapsed: new Set([...view.collapsed].filter(path => !rowPathContains(rowPath, path))) };
}

/** Move the collapsed state of a rekeyed row and its descendants to the new row path. */
export function rekeyRowView(view: ViewState, oldPath: string, newPath: string): ViewState {
  const rename = (path: string) => rowPathContains(oldPath, path) ? newPath + path.slice(oldPath.length) : path;
  return { collapsed: new Set([...view.collapsed].map(rename)) };
}
