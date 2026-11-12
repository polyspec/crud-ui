# List rendering fixtures
<!-- doc-id: tests-fixtures-list-render-readme -->

[한국어](README.ko.md).

`cases.json` holds the shared list layout cases of the Rust core in the case form of binding's generated tests (G-5): the
group `cases` lists the cases of `build_list and render_list`, and each case gives `id`, `name`, `note`, `requirements`, the arguments
`spec` and `rows` and the record `options` with every field (`files`, `basepath`, `language`, `data`, `page`,
`total`), and either `expected_html` or `raises` with its `kind`, `status`, `category` and optional `message`. `spec`,
every row, every file and `data` are values of `json_value`, written as `{ "kind", "value" }` as in the
[validation fixtures](../validate/README.md). The suites of React, Vue, Svelte and the legacy renderers read the copy
under `legacy/tests/fixtures`.
The group `row_shapes` holds the cases whose rows are no list, which the type of `rows` cannot give; the contract does
not name it.

These cases check table and card layouts, column formats, the list description before the
actions, actions, visibility, empty rows and pagination markup, the input errors and the declaration errors of the
[display format declarations](../../../docs/spec/display-formats.md#declarations). Each case supplies the display rows;
the renderer does not query a database.

## Comparisons

The framework layout tests compare normalized list bodies with `expected_html`.
They use the [form HTML normalizer](../form-render/README.md#normalization).
The string renderers (React's server rendering and the HTML renderer) write image preload
links before the list; [`preload-links.mjs`](../preload-links.mts) removes them, so these body
expectations cover the list body only. This comparison does not establish equality of
complete original HTML.

The [native generator suite](../../../legacy/tests/native-generators/README.md) uses the same
inputs and compares complete original HTML of every string renderer with React, including
image preload links. It does not remove resource hints or normalize attributes and CSS.

The cases are read by the list conformance tests in
[React](../../../packages/react/src/tests/list-render.conformance.test.ts),
[Vue](../../../packages/vue/tests/list-render.conformance.test.mjs),
[Svelte](../../../packages/svelte/tests/list-render.conformance.test.mjs) and the
[HTML renderer](../../../legacy/packages/html/src/list-conformance.test.ts).
Composition error cases require the recorded error code.

## Authoring

`cases.json` is data that is edited directly. [`generate.mts`](generate.mts) wrote it from the React renderer in the
form of the legacy copy; it is a tool of the legacy implementations and is not run.
