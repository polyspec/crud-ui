# List rendering fixtures
<!-- doc-id: tests-fixtures-list-render-readme -->

[한국어](README.ko.md).

`cases.json` contains the shared list layout cases for React, Vue, Svelte and the HTML renderer.
Each case provides `name`, `spec`, `rows`, optional `options`, and either
`expected_html` or `expectError`.

These cases check table and card layouts, column formats, the list description before the
actions, actions, visibility, empty rows and pagination markup, the input errors and the declaration errors of the
[display format declarations](../../../../docs/spec/display-formats.md#declarations). Each case supplies the display rows;
the renderer does not query a database.

## Comparisons

The framework layout tests compare normalized list bodies with `expected_html`.
They use the [form HTML normalizer](../form-render/README.md#normalization).
The string renderers (React's server rendering and the HTML renderer) write image preload
links before the list; [`preload-links.mjs`](../preload-links.mts) removes them, so these body
expectations cover the list body only. This comparison does not establish equality of
complete original HTML.

The [native generator suite](../../native-generators/README.md) uses the same
inputs and compares complete original HTML of every string renderer with React, including
image preload links. It does not remove resource hints or normalize attributes and CSS.

The cases are read by the list conformance tests in
[React](../../../../packages/react/src/tests/list-render.conformance.test.ts),
[Vue](../../../../packages/vue/tests/list-render.conformance.test.mjs),
[Svelte](../../../../packages/svelte/tests/list-render.conformance.test.mjs) and the
[HTML renderer](../../../packages/html/src/list-conformance.test.ts).
Composition error cases require the recorded error code.

## Regeneration

This directory is the fixed copy of the cases that the legacy implementations read ([AGENTS.md](../../../../AGENTS.md)); its `cases.json` is not written again. The generator of the shared fixture `tests/fixtures/list-render` is [`tests/fixtures/list-render/generate.mts`](../../../../tests/fixtures/list-render/generate.mts).
