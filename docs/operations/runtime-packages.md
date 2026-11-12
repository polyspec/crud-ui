# Runtime package map and verification
<!-- doc-id: docs-operations-runtime-packages -->

[한국어](runtime-packages.ko.md).
Implementation and verification are recorded in [feature status](../features.md). The rules every package follows are in the [runtime packages](../spec/runtime-packages.md) contract.

## Package map

| Package | Implementation responsibility | Reuse |
| --- | --- | --- |
| `legacy/packages/generator/ts` | JavaScript templates, instances and evaluated models | JavaScript composition and expression modules |
| `packages/react`, `generator-vue`, `generator-svelte` | Framework integration, browser operation and rendering | Shared JavaScript generator |
| `legacy/packages/html` | Framework-independent JavaScript form, list and detail HTML rendering | Shared JavaScript generator |
| `packages/form-binding` | [Browser validation](../spec/form-runtime.md#browser-validation) of a server-rendered form | JavaScript validator |
| `legacy/packages/generator/php` | PHP template compilation, data binding, form, list and detail HTML | PHP composition and expression modules |
| `legacy/packages/generator/go` | Go template compilation, data binding, form, list and detail HTML | Go composition and expression modules |
| `packages/generator/rust` | Rust template compilation, data binding, form, list and detail HTML | Rust composition and expression modules |
| `legacy/packages/php-ext` | PHP native generation and validation | The same public classes as the PHP packages; generation and validation execute in native code |
| `packages/validator/*` | Data and specification validation | Existing language rule implementations and shared cases |

Each server generator is a library that can run in its own language's HTTP
process. CLI adapters are test and example entry points; they are not the library
implementation. Go rendering does not depend on Rust, PHP or Node at runtime.
PHP rendering does not require its native extension. Rust rendering does not
require the PHP host.

`@polyspec/crudui-generator-react` exports components without loading `react-dom/server`.
`@polyspec/crudui-generator-react/server` exports `renderForm`, `renderList` and
`renderDetail` for server-only string rendering. The component entry does not
export those server functions.

## Verification

Generation and validation have separate checks for every runtime. Successful
validation does not establish generation or SSR support. A comparison records
the implementation that actually compiled, bound, rendered and validated each
request.

Cross-runtime checks compare complete compiled templates, bound field models,
record data and validation results. HTML checks compare field names, identifiers,
attributes, text, classes, CSS, visibility and control state. Differences are
retained and reported; removing identifiers, values or hidden fields from a
comparison cannot establish equality.

For the same template, record, language and supplied row keys, initial data and
later injection must produce identical HTML and submitted data. Repeated injection
and record restoration must preserve that equality. Browser checks verify these
paths in React, Vue, Svelte and the HTML renderer, including edits, labels, multiple
selections, row actions, focus, selection and scrolling. SSR integration requires its
own checks; client rendering with a non-JavaScript validation server does not verify SSR.

HTTP examples cover PHP, PHP native, Go and Rust independently with all four browser
renderers: four server targets by React, Vue, Svelte and the HTML renderer. Each target tests
form and ordered JSON submission, validation, persistence and reload. Core
JavaScript generation and validation remain part of the shared conformance suite.
An omitted runtime, process failure, malformed response or missing expectation
fails the comparison.
