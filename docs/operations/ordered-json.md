# Verify JSON document order
<!-- doc-id: docs-operations-ordered-json -->

[한국어](ordered-json.ko.md). The [form runtime contract](../spec/form-runtime.md)
defines the required data shapes and order. [Feature status](../features.md)
records verification separately from runtime deployment.

The record servers of the [form comparison](form-comparison.md) read and write JSON with the installed
[OrderedJSON](https://github.com/polyspec/ordered-json) packages. The private root Composer project installs OrderedJSON
from the packages.json repository of its release, records it in `composer.lock` and loads it through
`vendor/autoload.php`. In development, `make link` links the installed package folders to a checkout that `.links` declares;
CRUDUI never reads another repository's source tree by path.
OrderedJSON tests its processor; CRUDUI tests package integration through `examples/form-comparison/src/json.test.mjs`,
`FormJsonTest.php` of `servers/php`, `json_test.go` of the Go server and the Rust server's JSON tests. These check member
order, numeric keys, keyed rows, empty types and rejection of numbers outside the form data range.

The transport modules of the form comparison use the processor for JSON requests, responses and repository
files. The processor returns `Value`
nodes; its JavaScript object members are a `Map`, while the form session accepts
record data. Numeric member order would be lost if these maps were converted to
ordinary JavaScript objects; the form conversion rejects such a change. Existing delimited 13-character row keys are not
integer index properties and retain their insertion order in the current session.

The form and JSON transmission choices run the same validator and repository.
The [form checks](testing.md#forms-and-reports) cover runtime integration: the record-store
HTTP contract sends multipart, URL-encoded and JSON saves and invalid requests to every record
server, and the canonical flow check types into and saves the form of every server, client and
initialization and reloads the list.
