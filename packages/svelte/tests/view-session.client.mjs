import { mount, unmount, tick } from 'svelte';
import { writable } from 'svelte/store';
import { expect, it } from 'vitest';
import ViewHost from './ViewHost.svelte';
import { exerciseViewRerender } from '../../../tests/fixtures/view-session/rerender.mts';
import { provesConformance } from '../../../tests/conformance/evidence.mts';

it('keeps list and detail nodes across re-renders', async () => {
  const element = document.createElement('div');
  document.body.append(element);
  let source;
  let app;
  const show = (view) => {
    if (source) { source.set(view); return; }
    source = writable(view);
    app = mount(ViewHost, { target: element, props: { source } });
  };
  try {
    await provesConformance({ features: ['updateView'], fixture: 'tests/fixtures/view-session/rerender.mts', runtime: 'svelte', case: 'exerciseViewRerender' }, () =>
      exerciseViewRerender({ element, show, expect, flush: tick }));
  } finally { if (app) await unmount(app); element.remove(); }
});
