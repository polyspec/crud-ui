# @polyspec/crudui-validator
<!-- doc-id: packages-validator-ts-readme -->

[한국어](README.ko.md).

Validate CRUDUI form data and check list and detail specifications in
JavaScript and TypeScript.

## Public API

The package root exports:

- `validate(spec, data, options?)` composes the form specification, rejects
  forbidden keys and validates `data`. It returns `{ valid, errors, hidden }`, where `hidden`
  lists the data paths of the fields that `design.show` hides; each error
  has `path`, `field`, `rule`, `message` and `value`. A field whose
  `design.show` resolves to `false` is hidden and its rules, and those of every
  field it contains, are skipped (their data shape is still checked); missing repeated data is an empty collection.
- `validateList(spec, options?)` composes a list specification and rejects
  forbidden keys. A list has no submitted data, so a clean load returns
  `{ valid: true, errors: [] }`.
- `validateDetail(spec, options?)` performs the same structure check for a detail
  specification, including its `fields` map.
- `ComposeLoadError` for an unresolved `$ref` or `$patch`, a forbidden key and a
  rule parameter outside the definitions.
- `FormInputError` (code `INVALID_FORM_INPUT`) for root data that is not an
  object, group data that is not an object and repeated data that is not a keyed
  object.

Options accept `files`, a virtual file set for `$ref`, `loader`, an object with
`normalize(path, basepath)` and `load(key)` that takes precedence over `files`,
and `basepath` for relative references. The option and result types are
exported with the functions.

The authoring types of a specification are exported as types: `FieldSpec` for a
field or a form root, `RangeFieldSpec` for a range field, and the types that they
name (`ValidateSlot`, `DesignSlot`, `Items`, `Multiple`, `Lang`, `ConditionMap`
and the rest), as [docs/spec/schema.md](../../../../docs/spec/schema.md) defines
them.

A load or input failure is thrown, never returned as `valid: false`. The
[validation procedure](../../../../docs/operations/validation.md) shows usage in every
language.

The `@polyspec/crudui-validator/internal` entry serves CRUDUI's own packages and is not
public API. The package installs no command.

## Test

From the repository root:

```sh
npm test -w @polyspec/crudui-validator                  # full suite (vitest)
npm test -w @polyspec/crudui-validator -- conformance   # conformance test files only
```
