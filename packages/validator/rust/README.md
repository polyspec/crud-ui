# CRUDUI Rust validator
<!-- doc-id: packages-validator-rust-readme -->

[한국어](README.ko.md).

The `polyspec-crud-ui-validator` package is version `0.0.7`. It is a library; it installs
no command.

## API

```rust
use polyspec_crud_ui_validator::{validate, validate_detail, validate_list, ValidateOptions};

let result = validate(&spec, &data, &ValidateOptions::default())?;
```

- `validate(&spec, &data, &ValidateOptions)` composes the form specification,
  checks forbidden keys and validation-rule parameters and validates `data`. It
  returns a `ValidationResult` with `valid`, `errors` and `hidden`, the data paths of the fields
  that `design.show` hides; each error contains
  `path`, `field`, `rule`, `message` and `value`.
- `validate_list(&spec, &ValidateListOptions)` checks list structure and
  `validate_detail(&spec, &ValidateDetailOptions)` checks detail structure,
  including the `fields` map. Both return `Ok(())` for a clean structure.

Options accept `files`, a virtual file set for `$ref`, a `loader` and a
`basepath` for relative references. `validate` returns
`Err(ValidateError::Load)` for a composition or forbidden-key failure and
`Err(ValidateError::Input)` with code `INVALID_FORM_INPUT` for data with the wrong
shape; the structure checks return the `ComposeLoadError` as `Err`. A failure is
not a data validation result. The
[validation procedure](../../../docs/operations/validation.md) shows usage in every
language.

## Input text and shared values

`polyspec_crud_ui_validator::text::JsonText` reads a JSON document without replacing
any text, so an unpaired surrogate escape stays visible to the checks. Two variants
are not written by JSON text: `JsonText::Shared(Arc<JsonText>)` places one value in
several parents, and `JsonText::Link(Weak<JsonText>)` links back to a shared value that
contains it, which makes a value that contains itself. A shared or linked value is no
node of its own: each visit of the value it denotes counts as one node, so the node
limit (1,000,000) and the nesting limit (512) bound every walk, as the TypeScript and Go
runtimes count them. The first failure of a value decides its error, and a walk
reports the failure it reaches first in walk order. A value that contains itself is
built with `Arc::new_cyclic`, as the value-graph cases of the fixture are.

## Checks

From the repository root:

```sh
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml --test list_validity_conformance
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml --test detail_validity_conformance
```
