# Validator processes
<!-- doc-id: examples-cross-check-console-validators-readme -->

[한국어](README.ko.md).

The cross-check console runs each language's validator in its own process. These programs are that
process boundary. They belong to the console and its tests. No package publishes them, and
the packages provide the validator library functions instead.

| Process | Program | Library entry points |
| --- | --- | --- |
| JavaScript | `js/validate.mjs` | `validate`, `validateList` and `validateDetail` of `@polyspec/crudui-validator` |
| PHP | `php/validate.php` | `Polyspec\Crudui\Validator::validate`, `validateList` and `validateDetail` |
| PHP extension | `php -d extension=… php/validate.php` | the same PHP program, served by the extension's classes |
| Go | `go/` (module with its own `go.mod`) | `validate.ValidateJSON`, `ValidateListJSON` and `ValidateDetailJSON` |
| Rust | `rust/` (crate `polyspec-crudui-cross-check-validator`) | `polyspec_crud_ui_validator::validate`, `validate_list` and `validate_detail` |
| Python | `python/validate.py` | `validate`, `validateList` and `validateDetail` of `polyspec.crudui.validator` |

`npm run build:validators` in `../server` builds the Go program to `var/build/cross-check-console/go-validate` of the root and the Rust
program to `rust/target/release/polyspec-crudui-cross-check-validator`. The JavaScript program imports the
built `@polyspec/crudui-validator` package. The PHP program loads the Composer autoloader of
`legacy/packages/validator/php`. The Python program imports `polyspec.crudui.validator` installed in
the environment `var/python` that `make crudui-install-python` makes, whose Python the gateway runs. A deployment can name
other Go, Rust and Python executables with `CRUDUI_CROSS_CHECK_GO_VALIDATOR`, `CRUDUI_CROSS_CHECK_RUST_VALIDATOR` and
`CRUDUI_PYTHON`.

## Request

Standard input carries one JSON object:

```json
{ "spec": {}, "data": {}, "files": {}, "basepath": "", "mode": "form" }
```

Only `spec` is required. The default `mode` is `form`, which validates `data`. An omitted `data`
member validates `{}`. The `list` and `detail` modes check the specification structure and ignore
`data`. Absent or `null` `files` and `basepath` mean none.

## Response

Each program writes one JSON line to standard output and exits with one of three statuses:

| Exit | Output | Meaning |
| --- | --- | --- |
| `0` | exactly `{ "valid", "errors", "hidden" }` in `form` mode and exactly `{ "valid", "errors" }` in the `list` and `detail` modes; each error has `path`, `field`, `rule`, `message` and `value`, and `hidden` lists the data paths of the hidden fields in the validator's order | a validation result |
| `2` | exactly `{ "error", "code", "at" }` | a load failure (`ComposeLoadError`) or an input failure (`INVALID_FORM_INPUT`); `at` is the composition trace joined with `.`, or empty for an input failure |
| `1` | exactly `{ "error" }` | a malformed request |

A malformed request fails the first of these rules, checked in this order:

| Rule | Message |
| --- | --- |
| standard input is UTF-8 and valid JSON | `Request must be valid JSON` |
| the request is an object | `Request must be an object` |
| `spec` is an object | `Request spec must be an object` |
| `mode` is absent, `form`, `list` or `detail` | `Unsupported validation mode` |
| `files` is absent, `null` or an object | `Request files must be an object` |
| every `files` member is an object | `Request files must contain objects` |
| `basepath` is absent, `null` or a string | `Request basepath must be a string` |

In form mode, `data` that is present and not an object, `null` included, is the input failure
`Form data must be an object` (exit `2`).

A request may write an unpaired surrogate as a JSON escape, such as `"\ud800"`. Each program
decodes it without replacing it, so the validator reports the [input text](../../../docs/spec/input-text.md)
failure (exit `2`) of the specification, a file, the data or the base path, in the validator's
order and after the rules above. The PHP and Python programs apply the text rules that precede the data
shape rule itself when `data` is not an object, because their APIs take only an object.

## Tests

`requests.json` lists request cases. Each case has `name`, `note`, the raw standard input
`input` and `expected: { exit, output }`, where `output` is the complete JSON object written to
standard output. `scripts/check-schema.mts` checks the specification of every accepted request
against the meta-schema.

[`../server/validator-processes.test.mjs`](../server/validator-processes.test.mjs) runs the six
processes on every request case and on every case of
[`tests/fixtures/validate`](../../../tests/fixtures/validate/README.md),
[`tests/fixtures/list-validity`](../../../tests/fixtures/list-validity/README.md) and
[`tests/fixtures/detail-validity`](../../../tests/fixtures/detail-validity/README.md), and
requires the expected exit status and complete response from each process. List and detail
failures compare `code` and `at`; each engine writes its own non-empty message.

```sh
npm test --prefix examples/cross-check-console/server -- validator-processes
```
