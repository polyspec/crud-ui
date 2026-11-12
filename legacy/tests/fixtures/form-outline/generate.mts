/**
 * Generates shared structure map and data view fixtures.
 *
 * Each case is `{ name, note, spec, data, options, canUndo, canRedo,
 * expected_outline_html, expected_data_html, expected_outline_rows }`. The expected HTML is the
 * normalized static markup of the React reference components `OutlineView` and
 * `DataPanel`, never hand-written. The HTML, Vue and Svelte renderers must
 * reproduce it after the shared normalizer (`../form-render/normalize.mts`) for
 * the nodes that `bindForm(compileForm(spec), data, options)` returns.
 *
 * `expected_outline_rows` is `buildOutline(bindForm(compileForm(spec), data, options))`, which every implementation
 * of `buildOutline` reproduces for the nodes of its own `bindForm`.
 *
 * Do not edit `cases.json` by hand. Regenerate:
 *   node legacy/tests/fixtures/form-outline/generate.mts
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bindForm, buildOutline, compileForm, formMessages } from '@polyspec/crudui-generator-core';
import { DataPanel, OutlineView } from '@polyspec/crudui-generator-react';
import { normalizeHtml } from '../form-render/normalize.mts';

interface OutlineCase {
  name: string;
  note: string;
  spec: Record<string, unknown>;
  data: Record<string, unknown>;
  options: { language: 'ko' | 'en' | 'ja' | 'zh' };
  canUndo: boolean;
  canRedo: boolean;
  expected_outline_html?: string;
  expected_data_html?: string;
  expected_outline_rows?: unknown;
  requirements?: string[];
}

const k1 = '__0000000000001__';
const k2 = '__0000000000002__';

function teams(controls?: 'outline'): Record<string, unknown> {
  const placement = controls ? { controls } : {};
  return {
    type: 'group',
    properties: {
      teams: {
        type: 'group',
        label: { ko: '팀', en: 'Team', ja: 'チーム', zh: '团队' },
        multiple: { min: 1, max: 3, sortable: true, copy: true, title: 'name', ...placement },
        properties: {
          name: { type: 'text', label: 'Name' },
          members: {
            type: 'group',
            label: { ko: '멤버', en: 'Member', ja: 'メンバー', zh: '成员' },
            multiple: { title: 'name', ...placement },
            properties: { name: { type: 'text' } },
          },
        },
      },
    },
  };
}

const data = {
  teams: {
    [k1]: { name: 'Sales <b> & "quotes"', members: { [k1]: { name: 'Kim' }, [k2]: { name: '' } } },
    [k2]: { name: '', members: {} },
  },
};

/**
 * The structure map of rows in a `multiple: only` collection, written from docs/spec/form-markup.md:
 * those rows have no row controls in the map, and missing data is zero rows.
 */
const ONLY_ROWS_OUTLINE = '<div class="crudui-outline"><div class="crudui-outline__header"><div aria-label="Form controls" class="crudui-controls" role="group"><button class="crudui-action crudui-action--text" data-crudui-action="expand-all" type="button">Expand all</button><button class="crudui-action crudui-action--text" data-crudui-action="collapse-all" type="button">Collapse all</button><button aria-disabled="true" class="crudui-action crudui-action--text" data-crudui-action="undo" type="button">Undo</button><button aria-disabled="true" class="crudui-action crudui-action--text" data-crudui-action="redo" type="button">Redo</button></div></div><div class="crudui-outline__body"><div class="crudui-node crudui-node--row" data-crudui-row-key="__0000000000001__" data-field-path="sections"><div class="crudui-node__header"><button class="crudui-action crudui-action--text" data-crudui-action="select-row" type="button"><span class="crudui-node__number">1</span><span class="crudui-node__title">First</span></button><div aria-label="Row controls" class="crudui-controls" role="group"><button aria-label="Add" class="crudui-action" data-crudui-action="add-row" type="button"></button><button aria-label="Remove" class="crudui-action" data-crudui-action="remove-row" type="button"></button></div></div><div class="crudui-node__body"><div class="crudui-node crudui-node--row" data-crudui-row-key="__opt_b2__" data-field-path="sections.__0000000000001__.variants"><div class="crudui-node__header"><button class="crudui-action crudui-action--text" data-crudui-action="select-row" type="button"><span class="crudui-node__number">1.1</span><span class="crudui-node__title">Blue</span></button></div></div><div class="crudui-node crudui-node--row" data-crudui-row-key="__opt_a1__" data-field-path="sections.__0000000000001__.variants"><div class="crudui-node__header"><button class="crudui-action crudui-action--text" data-crudui-action="select-row" type="button"><span class="crudui-node__number">1.2</span><span class="crudui-node__title">Red</span></button></div></div></div></div><div class="crudui-node crudui-node--row" data-crudui-row-key="__0000000000002__" data-field-path="sections"><div class="crudui-node__header"><button class="crudui-action crudui-action--text" data-crudui-action="select-row" type="button"><span class="crudui-node__number">2</span><span class="crudui-node__title">Second</span></button><div aria-label="Row controls" class="crudui-controls" role="group"><button aria-label="Add" class="crudui-action" data-crudui-action="add-row" type="button"></button><button aria-label="Remove" class="crudui-action" data-crudui-action="remove-row" type="button"></button></div></div></div></div></div>';

const CASES: OutlineCase[] = [
  {
    name: 'outline-rows-ko',
    note: 'Korean map of top-level and nested rows with undo available; data view escapes markup characters.',
    requirements: ['CUMK-031', 'CUMK-032'],
    spec: teams(),
    data,
    options: { language: 'ko' },
    canUndo: true,
    canRedo: false,
  },
  {
    name: 'outline-controls-in-map-en',
    note: 'controls: outline puts every row\'s controls in the map, where the stylesheet shows those of the current row; empty collection controls stay in the form.',
    requirements: ['CUMK-031', 'CUMK-032', 'CUMK-035', 'CUMK-037'],
    spec: teams('outline'),
    data,
    options: { language: 'en' },
    canUndo: false,
    canRedo: false,
  },
  {
    name: 'outline-untitled-rows-ja',
    note: 'Japanese map with row controls in the map; untitled rows show the untitled message.',
    requirements: ['CUMK-031', 'CUMK-032', 'CUMK-035', 'CUMK-037'],
    spec: teams('outline'),
    data,
    options: { language: 'ja' },
    canUndo: false,
    canRedo: false,
  },
  {
    name: 'outline-no-collections-zh',
    note: 'Chinese map for a form without repeated fields has controls and an empty body.',
    spec: { type: 'group', properties: { title: { type: 'text', label: 'Title' } } },
    data: { title: 'Plain' },
    options: { language: 'zh' },
    canUndo: false,
    canRedo: false,
  },
  {
    name: 'outline-only-rows-en',
    note: 'Rows of a multiple.only collection appear in the map under their data keys without row controls, while the enclosing rows keep theirs; the second section has no data for the collection and so no nested rows.',
    requirements: ['CUMK-031', 'CUMK-032', 'CUMK-034', 'CUMK-035', 'CUMK-037'],
    spec: {
      type: 'group',
      properties: {
        sections: {
          type: 'group',
          label: 'Section',
          multiple: { title: 'name', controls: 'outline' },
          properties: {
            name: { type: 'text' },
            variants: {
              type: 'group',
              label: 'Variant',
              multiple: { only: true, title: 'name' },
              properties: { name: { type: 'text' } },
            },
          },
        },
      },
    },
    data: {
      sections: {
        [k1]: { name: 'First', variants: { __opt_b2__: { name: 'Blue' }, __opt_a1__: { name: 'Red' } } },
        [k2]: { name: 'Second' },
      },
    },
    options: { language: 'en' },
    canUndo: false,
    canRedo: false,
    expected_outline_html: ONLY_ROWS_OUTLINE,
  },
];

for (const item of CASES) {
  const messages = formMessages(item.options.language);
  const fields = bindForm(compileForm(item.spec), item.data, item.options);
  item.expected_outline_rows = buildOutline(fields);
  if (item.expected_outline_html === undefined) {
    const state = { fields, canUndo: item.canUndo, canRedo: item.canRedo };
    item.expected_outline_html = normalizeHtml(renderToStaticMarkup(React.createElement(OutlineView, { state, messages })));
  }
  item.expected_data_html = normalizeHtml(renderToStaticMarkup(React.createElement(DataPanel, { data: item.data, messages })));
}

// Every case compiles its specification and binds its record (CURP-006, CURP-007) and the binding evaluates the fields against the record (CURP-021).
for (const item of CASES) item.requirements = [...(item.requirements ?? []), 'CURP-006', 'CURP-007', 'CURP-021'];

const output = resolve(dirname(fileURLToPath(import.meta.url)), 'cases.json');
writeFileSync(output, JSON.stringify(CASES, null, 2) + '\n');
process.stdout.write(`form-outline: ${CASES.length} cases\n`);
