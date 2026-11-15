import React from 'react';
import { act, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { buildDetail, buildList } from '@polyspec/crudui-generator-core';
import { List } from '../components/List';
import { Detail } from '../components/Detail';
import { exerciseViewRerender, type ViewModel } from '../../../../tests/fixtures/view-session/rerender.mts';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

it('keeps list and detail nodes across re-renders', async () => {
  const element = document.createElement('div');
  document.body.append(element);
  let view: { rerender: (node: React.ReactElement) => void; unmount: () => void } | undefined;
  const show = ({ kind, layout, spec, data }: ViewModel) => {
    // A list shows rows and a detail one record (tests/fixtures/view-session/rerender.mts).
    if ((kind === 'list') !== Array.isArray(data)) throw new TypeError(`a ${kind} view takes ${kind === 'list' ? 'rows' : 'one record'}`);
    const node = Array.isArray(data)
      ? <List key={`list-${layout}`} vm={buildList(spec, data)} layout={layout} />
      : <Detail key="detail" vm={buildDetail(spec, data)} />;
    act(() => {
      if (view) view.rerender(node);
      else view = render(node, { container: element });
    });
  };
  try {
    await provesConformance({ features: ['updateView'], fixture: 'tests/fixtures/view-session/rerender.mts', runtime: 'react', case: 'exerciseViewRerender' }, () =>
      exerciseViewRerender({ element, show, expect, flush: async () => { await act(async () => {}); } }));
  } finally { view?.unmount(); element.remove(); }
});
