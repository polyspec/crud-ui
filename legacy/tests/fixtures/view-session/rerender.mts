import type { ExpectStatic } from 'vitest';

/** Re-rendering read-only lists and details through each framework's public components. */
const listSpec = {
  columns: {
    name: { field: 'name', label: 'Name' },
    bio: { field: 'bio', label: 'Bio', format: { type: 'html' } },
  },
  actions: { edit: { label: 'Edit', format: { type: 'link', href: '/edit' } }, remove: 'void 0' },
};

const detailSpec = {
  fields: {
    name: { field: 'name', label: 'Name' },
    bio: { field: 'bio', label: 'Bio', format: { type: 'html' } },
  },
};

/** A record the views show. */
type ViewRecord = {
  name: string;
  bio: string;
};

/** A view model that `show` renders: a list of rows with its layout, or a detail of one record. */
export interface ViewModel {
  kind: 'list' | 'detail';
  layout: 'table' | 'card' | undefined;
  spec: typeof listSpec | typeof detailSpec;
  data: ViewRecord | ViewRecord[];
}

/** What a framework test hands the re-render scenario. */
export interface ViewRerenderCase {
  element: HTMLElement;
  show: (model: ViewModel) => void | Promise<void>;
  expect: ExpectStatic;
  flush: () => Promise<void>;
}

const record = (note: string): ViewRecord => ({ name: 'Ada', bio: `<b>Lead</b> <i>${note}</i>` });

/**
 * Show a list as a table and as cards, and a detail, then show each again from a new model with
 * the same content and from a model whose raw HTML changed. Every element node stays; changed
 * raw HTML is patched into the nodes it still contains. `show({ kind, layout, spec, data })`
 * renders or updates the view inside `element` from a new model: `kind` is `list` (with
 * `layout`, rows in `data`) or `detail` (a record in `data`).
 */
export async function exerciseViewRerender({ element, show, expect, flush }: ViewRerenderCase): Promise<void> {
  const views: Array<[kind: ViewModel['kind'], layout: ViewModel['layout'], model: (note: string) => Pick<ViewModel, 'spec' | 'data'>]> = [
    ['list', 'table', note => ({ spec: listSpec, data: [record(note)] })],
    ['list', 'card', note => ({ spec: listSpec, data: [record(note)] })],
    ['detail', undefined, note => ({ spec: detailSpec, data: record(note) })],
  ];
  for (const [kind, layout, model] of views) {
    await show({ kind, layout, ...model('first') });
    await flush();
    const nodes = () => Array.from(element.querySelectorAll('*'));
    const initial = nodes();
    expect(initial.filter(node => node.tagName === 'B')).toHaveLength(1);
    if (kind === 'list') expect(element.querySelectorAll('.crudui-list__action > *')).toHaveLength(2);
    const kept = () => {
      const current = nodes();
      expect(current).toHaveLength(initial.length);
      expect(current.filter((node, index) => node !== initial[index]).map(node => node.outerHTML)).toEqual([]);
    };
    await show({ kind, layout, ...model('first') });
    await flush();
    kept();
    await show({ kind, layout, ...model('second') });
    await flush();
    kept();
    expect(element.querySelector('i')?.textContent).toBe('second');
  }
}
