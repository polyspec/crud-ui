# Form template shape

<!-- doc-id: tests-fixtures-template-shape-readme -->

[한국어](README.ko.md).

These cases define the form template shape of [form structure](../../../../docs/spec/form-runtime.md) (CURT-092): `bindForm`,
`bindButtons` and `createForm` accept only a template that has exactly the shape `compileForm` produces. Any other value
fails with `INVALID_FORM_INPUT`, message `Unsupported form template`, and an empty location.

`cases.json` holds, for each of the three operations, a template that `compileForm` writes, a template with the optional
members `keyPrefix`, `action` and `description`, and one refusal for each shape violation: a missing or unknown member, a
member of the wrong type, a field without `children`, a field with an unknown member, a button that is not an object, a
`kind` other than `crudui/form-template`, a null `keyPrefix` and a string `action`. Each case has `name`, `note`,
`requirements` (CURT-092), `operation`, `template`, `data`, `options` and `expect`: `"pass"`, or `{ code, message, at }` with
`at` empty.

The TypeScript reference writes every expectation, through `generate.mts`:

    node legacy/tests/fixtures/template-shape/generate.mts

The JSON Pointers of `decodeFormTemplate` are not in these cases. That decoder is a TypeScript API, and its pointers are checked
by the TypeScript tests of `decode-template.test.ts`.

## Changing cases

Change `generate.mts` and run it again; do not edit `cases.json` by hand. Run every runner after a change.
