# Detail rendering fixtures
<!-- doc-id: tests-fixtures-detail-render-readme -->

[한국어](README.ko.md).

`cases.json` contains the shared read-only detail cases for every string renderer and every
framework renderer. Each case provides `name`, `note`, `spec`, `record`, optional `options`, and
either `expected_html` or `expectError` with its `code` and `message`.

These cases check translated labels, every cell format, an absent value, the detail and field
designs, a hidden field, composed fields, an empty declaration, the detail actions before the
definition list and after the image preload links, the input errors and the
declaration errors of the [display format declarations](../../../../docs/spec/display-formats.md#declarations).
Each case supplies the record; the renderer does not query data.

`content-values` declares choice labels in `format.items`, which the declaration rules leave open,
as numbers, a language map with a number and an array; every runtime resolves each such label to
empty text ([specification structure](../../../../docs/spec/schema.md)).

## Comparisons

The framework conformance tests compare the normalized detail body with `expected_html`, using
the [form HTML normalizer](../form-render/README.md#normalization). The string renderers
(React's server rendering and the HTML renderer) write image preload links before the detail;
[`preload-links.mjs`](../preload-links.mts) removes them, so the body expectations cover the
detail body only. Error cases require the recorded message.

The [native generator suite](../../../../tests/native-generators/README.md) sends every case to every
runtime at both levels a runtime exposes: `buildDetail` must return the same model with members
in the same order, and `renderDetail` must return the same complete original HTML as React,
image preload links included. A field's `value` is `null` when the record has no value at its
path.

The cases are read by the detail conformance tests in
[React](../../../../packages/react/src/tests/detail-render.conformance.test.ts),
[Vue](../../../../packages/vue/src/tests/detail-render.conformance.test.ts),
[Svelte](../../../../packages/svelte/tests/detail-render.conformance.test.mjs) and the
[HTML renderer](../../../legacy/packages/html/src/detail-conformance.test.ts).

## Regeneration

Run from the repository root:

```sh
node legacy/tests/fixtures/detail-render/generate.mts \
  > legacy/tests/fixtures/detail-render/cases.json
```

The generator derives normalized detail bodies from React. Review changes against the
specification before accepting them. Regeneration alone is not verification.
