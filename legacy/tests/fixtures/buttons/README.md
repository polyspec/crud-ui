# Form button fixtures
<!-- doc-id: tests-fixtures-buttons-readme -->

[한국어](README.ko.md).

These cases define the form buttons of [form markup](../../../../docs/spec/form-markup.md#form-buttons): `bindButtons`
evaluates the buttons of a template for a record, and `formButtonsHtml` renders evaluated buttons as markup. The
TypeScript reference writes every expectation (`generate.mts`); no implementation writes one by hand.

`cases.json` holds one list of cases. Each case has `name`, `note`, `requirements` and `operation`:

- `bindButtons` (CURP-008): `spec` is compiled with `compileForm` before the call, or `template` is passed as it is, a
  value that is not a compiled template; `data` is the record (`{}` when absent) and `options` the bind options.
  The runner reports a compile failure of `spec` as the failure of the case.
- `formButtonsHtml` (CURP-009): `buttons` is the list passed as it is.

`expected` is `{ result }` or `{ error: { code, message } }`. A result of `bindButtons` lists the buttons, each as
`{ type, tag, text, attrs }`, with the attributes in output order; a result of `formButtonsHtml` is the markup string.

Every runner compares the two results with the expectation of the case: the buttons as ordered JSON, the markup as a
string, and the error by its code and message.

Run `node legacy/tests/fixtures/buttons/generate.mts` from the checkout root to regenerate the cases.
