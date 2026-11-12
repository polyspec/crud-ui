# Detail rendering fixtures
<!-- doc-id: tests-fixtures-detail-render-readme -->

[한국어](README.ko.md).

`cases.json` holds the shared read-only detail cases of the Rust core in the case form of binding's generated tests (G-5): the
group `cases` lists the cases of `build_detail and render_detail`, and each case gives `id`, `name`, `note`, `requirements`, the arguments
`spec` and `record` and the record `options` with every field (`files`, `basepath`, `language`, `data`, `page`,
`total`), and either `expected_html` or `raises` with its `kind`, `status`, `category` and optional `message`. `spec`,
every record, every file and `data` are values of `json_value`, written as `{ "kind", "value" }` as in the
[validation fixtures](../validate/README.md). The suites of React, Vue, Svelte and the legacy renderers read the copy
under `legacy/tests/fixtures`.

These cases check translated labels, every cell format, an absent value, the detail and field
designs, a hidden field, composed fields, an empty declaration, the detail actions before the
definition list and after the image preload links, the input errors and the
declaration errors of the [display format declarations](../../../docs/spec/display-formats.md#declarations).
Each case supplies the record; the renderer does not query data.

`content-values` declares choice labels in `format.items`, which the declaration rules leave open,
as numbers, a language map with a number and an array; every runtime resolves each such label to
empty text ([specification structure](../../../docs/spec/schema.md)).

## Comparisons

The framework conformance tests compare the normalized detail body with `expected_html`, using
the [form HTML normalizer](../form-render/README.md#normalization). The string renderers
(React's server rendering and the HTML renderer) write image preload links before the detail;
[`preload-links.mjs`](../preload-links.mts) removes them, so the body expectations cover the
detail body only. Error cases require the recorded message.

The [native generator suite](../../../legacy/tests/native-generators/README.md) sends every case to every
runtime at both levels a runtime exposes: `buildDetail` must return the same model with members
in the same order, and `renderDetail` must return the same complete original HTML as React,
image preload links included. A field's `value` is `null` when the record has no value at its
path.

The cases are read by the detail conformance tests in
[React](../../../packages/react/src/tests/detail-render.conformance.test.ts),
[Vue](../../../packages/vue/src/tests/detail-render.conformance.test.ts),
[Svelte](../../../packages/svelte/tests/detail-render.conformance.test.mjs) and the
[HTML renderer](../../../legacy/packages/html/src/detail-conformance.test.ts).

## Authoring

`cases.json` is data that is edited directly. [`generate.mts`](generate.mts) wrote it from the React renderer in the
form of the legacy copy; it is a tool of the legacy implementations and is not run.
