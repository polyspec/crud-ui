// @vitest-environment jsdom
/**
 * The shared read-only view scenario over the HTML renderer: the page patches each newly
 * rendered list or detail into the page with `patchContent`.
 */
import { expect, test } from 'vitest';
import { patchContent } from '@polyspec/crudui-generator-core';
import { renderDetail, renderList } from './index';
// @ts-expect-error Shared view assertions across all renderers.
import { exerciseViewRerender } from '../../../tests/fixtures/view-session/rerender.mts';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

interface View { kind: 'list' | 'detail'; layout?: 'table' | 'card'; spec: Record<string, unknown>; data: never }

test('keeps list and detail nodes across re-renders', async () => {
  const element = document.createElement('div');
  document.body.append(element);
  try {
    await provesConformance({ features: ['updateView', 'patchContent'], fixture: 'legacy/tests/fixtures/view-session/rerender.mts', runtime: 'javascript-dom', case: 'exerciseViewRerender' }, () =>
      exerciseViewRerender({
        element, expect, flush: async () => {},
        show: ({ kind, layout, spec, data }: View) => patchContent(element, kind === 'list'
          ? renderList(spec, data, { layout })
          : renderDetail(spec, data)),
      }));
  } finally { element.remove(); }
});
