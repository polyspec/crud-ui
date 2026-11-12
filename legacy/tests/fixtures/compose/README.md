# Composition fixtures
<!-- doc-id: tests-fixtures-compose-readme -->

[한국어](README.ko.md).

`cases.json` contains the shared `$ref` and `$patch` composition cases for TypeScript, PHP, the
PHP extension, Go and Rust. Each case provides `name`, `note`, `requirements` (the composition requirement CUSC-007 of the
`docs/spec/schema.md` specification; the case `ref-inherit-base` also lists CURP-001 of `docs/spec/runtime-packages.md`,
since every implementation composes), `input`, and either `expected` or `expectError` with its `code`. `input` has `entry`, optional `files`, optional `kind`
(`properties` by default, or `spec`) and optional `basepath`.

These cases check reference inheritance, path references, the order of several references, nested
references, sibling overrides, a specification-level reference, a reference relative to
`basepath`, patches that set, add, replace and remove values, and the order in which references
and patches apply. Error cases cover `REF_FILE_NOT_FOUND`, `REF_FORMAT_ERROR`,
`REF_DETECT_KEY_NOT_FOUND`, `REF_CYCLE`, `PATCH_REMOVE_TARGET_MISSING`, `PATCH_PATH_CONFLICT` and
`REF_VALUE_TYPE`. The [specification structure](../../../../docs/spec/schema.md) defines composition.

## Comparisons

A success case compares the expanded specification with `expected`. Arrays keep their order. The
TypeScript, Go and PHP tests compare object members by name rather than by position, and Go, Rust
and PHP compare numbers by value. The TypeScript test also requires that no `$ref` or `$patch`
remains and that composing the result again returns it unchanged. An error case requires a
composition load error with the recorded `code`; the message and location are not compared.

The cases are read by the composition conformance tests in
[TypeScript](../../../legacy/packages/validator/ts/src/compose.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Compose/ComposeConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/compose/conformance_test.go),
[Rust](../../../../packages/validator/rust/tests/compose_conformance.rs) and the
[PHP extension contract test](../../../legacy/packages/php-ext/tests/contract/compose.test.mjs).

## Regeneration

Run from the repository root after building the packages:

```sh
node legacy/packages/validator/ts/scripts/generate-compose-cases.mts > legacy/tests/fixtures/compose/cases.json
```

The generator runs the TypeScript composition engine and records its output. A case whose name
starts with `err-` must fail and every other case must succeed, or generation stops. Review
changes against the specification and run every test that reads them before accepting them. Regeneration
alone is not verification.
