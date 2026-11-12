# validator-go
<!-- doc-id: packages-validator-go-readme -->

[한국어](README.ko.md).

Go validator for the crudui system. The `validator` packages compose a
specification, reject forbidden keys and validate data, in conformance with the
JavaScript, PHP and Rust implementations.

## API

```go
import "github.com/polyspec/crudui/packages/validator/go/validator/validate"

result, err := validate.ValidateJSON(specJSON, dataJSON, files, basepath)
```

- `validate.ValidateJSON(spec, data []byte, files map[string][]byte, basepath string)`
  composes the form specification, rejects forbidden keys and validates `data`.
  It returns a `ValidationResult` with `Valid`, `Errors` and `Hidden`, the data paths of the fields
  that `design.show` hides; each error has
  `path`, `field`, `rule`, `message` and `value`.
- `validate.ValidateListJSON(spec, files, basepath)` composes a list
  specification and rejects forbidden keys. A list has no rows, so a clean load
  is a valid result.
- `validate.ValidateDetailJSON(spec, files, basepath)` performs the same structure
  check for a detail specification, including its `fields` map.

`files` maps `$ref` keys to JSON documents and `basepath` resolves relative
references. An unresolved `$ref` or `$patch` or a forbidden key returns a
`*compose.ComposeLoadError`; root, group or repeated data with the wrong shape
returns a `*validate.FormInputError` with code `INVALID_FORM_INPUT`. A failure is
returned as the error, never as an invalid result. The
[validation procedure](../../../../docs/operations/validation.md) shows usage in every
language.

## Test

From the repository root:

```sh
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts go --cwd legacy/packages/validator/go -- ./...               # full suite
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts go --cwd legacy/packages/validator/go -- ./validator/...     # CRUDUI conformance
```
