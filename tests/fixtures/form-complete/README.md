# Complete form fixtures
<!-- doc-id: tests-fixtures-form-complete-readme -->

[한국어](README.ko.md).

`cases.json` holds the shared cases of the [complete form](../../../docs/spec/form-runtime.md#complete-form):
`renderForm(form, render)` with the form element, hidden inputs, form errors and node errors.
Each case has `name`, `note`, `spec`, `data`, binding `options`, the render options `render`, and
either `expected_html` or `expectError` (`{ code, message }`).

`expected_html` is written from the specification in [`generate.mts`](generate.mts) and never
rendered: the node and footer markup is the markup the form-render fixture defines, and the form
element, the hidden inputs and the error elements are placed where the specification places them.
The cases cover attribute and text escaping, the template action and its members, the root
description before the form errors and a null description, hidden input order, the blocked JavaScript URL, empty options, errors without a form element, form error order,
collection, row, group, field and hidden field errors, and every option failure in check order.

The tests compare the exact bytes: React's server rendering
([`form-complete.conformance.test.ts`](../../../packages/react/src/tests/form-complete.conformance.test.ts)),
the HTML renderer
([`form-complete.conformance.test.ts`](../../../legacy/packages/html/src/form-complete.conformance.test.ts))
and the PHP, PHP extension, Go and Rust generators through the
[native generator suite](../../../legacy/tests/native-generators/README.md). Vue
([`form-complete.conformance.test.mjs`](../../../packages/vue/tests/form-complete.conformance.test.mjs))
and Svelte
([`form-complete.conformance.test.mjs`](../../../packages/svelte/tests/form-complete.conformance.test.mjs))
compare after the shared normalization, because they write their own serialization.

Regenerate from the repository root and review the change against the specification:

```sh
node tests/fixtures/form-complete/generate.mts > tests/fixtures/form-complete/cases.json
```
