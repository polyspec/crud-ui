# Examples
<!-- doc-id: docs-operations-examples -->

[한국어](examples.ko.md).

Current examples use unversioned public APIs. `legacy/examples/cross-check-console`
compares validation and rendering results across implementations. Form usage is
defined in [form operations](forms.md).

The canonical local example entry is the root page of the public server. It is one
page for one customer record: List → Detail → Form → Save → List refresh. Its list, detail and
form use one record specification and one shared fixture of 45 records, and every selectable
server (JavaScript, PHP, PHP extension, Go and Rust) keeps its own persistent store of those
records behind one HTTP contract. With SSR the selected server renders the stage into the initial
document; with CSR the selected client (HTML, React, Vue or Svelte) renders it in the browser from
that server's JSON. The form mode (`bindForm` or `createForm`) is selectable, and a save returns
to the same list page with a saved notice. The
[form verification contract](form-comparison.md#record-resource) defines the record resource,
the page and its check of all 40 server, client and initialization combinations.

The benchmark screens `/benchmark-console/` and `/benchmark/` are separate from that page. They
compare server-side and client-side form rendering for every native server and framework with
the nested companies scenario, and run the render and validation matrices. `/displays/` is not a
route.

Current examples cover all three specification kinds, not only forms. The Go, PHP and Rust
package examples render a form, a list and a detail from one example record set, and the PHP
example runs unchanged with the PHP extension. The cross-check console compares form, list and
detail rendering and validation across implementations. List and detail displays follow the
[display formats](../spec/display-formats.md).

The console accepts a validator response only when the process terminates with
the expected exit status and emits a JSON object matching the response contract.
Data validation uses exit status `0`, boolean `valid` and an `errors` array.
Each error has string `path`, `field`, `rule` and `message` members and a `value`
member. `valid` is true exactly when the error array is empty. Missing fields,
invalid types, contradictory results, process errors and signals fail comparison;
the console does not fill missing fields or convert invalid values.

Load and input failures are checked separately from data results. Every validator
CLI exits with `2` and returns exactly the members `error` and `code` as nonempty
strings and `at` as a string. The console records them as
`failure: { code, message, at }` and compares the complete record across languages.
A failure response with another exit status, missing or additional members, or
malformed values fails comparison.

Reusable form inspection checks are maintained under `tests/form-inspector/`.

Frontend examples import repository-local specifications during the example
build. The resulting static build includes its form specifications.
