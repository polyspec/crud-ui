# Structure map and data view fixtures
<!-- doc-id: tests-fixtures-form-outline-readme -->

[한국어](README.ko.md).

`cases.json` contains the shared structure map and data view cases for React, the HTML renderer,
Vue and Svelte. Each case provides `name`, `note`, `spec`, `data`, `options` with `language`,
`canUndo`, `canRedo`, `expected_outline_html`, `expected_data_html` and `expected_outline_rows`, the rows
that `buildOutline(bindForm(compileForm(spec), data, options))` returns.

These cases check the map of top-level and nested rows with undo available, row controls placed in
the map with `controls: outline` while empty collection controls stay in the form, untitled rows,
a form without repeated fields, rows of a `multiple.only` collection that have no row controls in
the map while their enclosing rows keep theirs, markup characters escaped in the data view, and the
interface messages in Korean, English, Japanese and Chinese. The [form markup](../../../../docs/spec/form-markup.md)
defines both views.

## Comparisons

The fields of a case are `bindForm(compileForm(spec), data, options)`. Each renderer draws the
structure map from `{ fields, canUndo, canRedo }` and the data view from `data`, normalizes both with the
[form HTML normalizer](../form-render/README.md#normalization) and must return exactly
`expected_outline_html` and `expected_data_html`. React renders `OutlineView` and `DataPanel`, the
HTML renderer `renderOutlineView` and `renderDataPanel`, Vue `outlineVNode` and `dataVNode` through
its server renderer, and Svelte `OutlineView` and `DataPanel` through `svelte/server`.

The Rust test `native_outline_fixture`, the Go test `TestOutlineFixture`, the PHP `OutlineTest`, the Python
`tests/test_outline.py` and the outline checks of the native generator conformance run compare the `buildOutline` of
each implementation with `expected_outline_rows` for the nodes of its own `bindForm`. The cases are read by the structure map conformance tests in
[React](../../../../packages/react/src/tests/outline.conformance.test.tsx),
[Vue](../../../../packages/vue/tests/outline.conformance.test.mjs),
[Svelte](../../../../packages/svelte/tests/outline.conformance.test.mjs) and the
[HTML renderer](../../../legacy/packages/html/src/outline.conformance.test.ts). The
[form markup naming test](../../../../tests/form-markup/naming.test.mts) checks the class names in both
expected HTML strings.

## Regeneration

Run from the repository root after building the packages:

```sh
node legacy/tests/fixtures/form-outline/generate.mts
npm run test:forms
```

The generator writes `cases.json` itself from the normalized static markup of React's
`OutlineView` and `DataPanel`; a structure map declared on a case (`outline-only-rows-en`) is
written from the specification and kept as written. Review changes against the specification before accepting them.
Regeneration alone is not verification.
