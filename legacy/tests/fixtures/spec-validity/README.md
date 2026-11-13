# Specification validity fixtures
<!-- doc-id: tests-fixtures-spec-validity-readme -->

[한국어](README.ko.md).

`cases.json` cases share one shape with the other structure validity families
([form](README.md), [list](../list-validity/README.md) and
[detail](../detail-validity/README.md)): `{ name, note, spec, files?, expect, reason?, engine }`.

- `expect` is the meta-schema result for the form entry point of the [meta-schema](../../../../contracts/schema/crudui.schema.json), `"ok"` or `"fail"`.
- `reason` is present only on a `"fail"` case and is required there. It names an Ajv keyword that
  must appear among the errors.
- `engine` is the runtime structure validation result. `"pass"` means no load failure and the result
  `{ valid: true, errors: [] }`; `{ code, at }` is the load failure code and the composition trace
  joined with `.`.
- `files` is the composition file set that every runtime test passes to the engine. The
  meta-schema reads `spec` alone.

The two results are independent. Every test applies every member it owns: no test classifies
cases itself or supplies its own files. [`check-schema.mts`](../../../../scripts/check-schema.mts), run by
`npm run spec:schema`, asserts this shape for all three families before it checks `expect` and
`reason`.

The accepted cases check a plain specification, a conditional requiredness expression, a condition
map with a `true` default key, deep nesting, choice labels in several languages, empty labels and
content, per-language overrides, root `buttons` and `action`, `multiple: only` in its string and
object forms, which loads with empty data because missing data has no row, and a choice list under
`items` and `in`, and a structured condition editor with `options.fields`. The rejected cases place a
forbidden key (`if`, `when`, `show_if`, `display_switch`, `display_target`, `seqtokey`, `_` or an
`x`-prefixed key) at the top of a field, under a role slot or an open settings object, in a design
node, in a nested child, inside an array element, in a base inherited through `$ref`, and in a
root button or action; these cases have the runtime code `FORBIDDEN_META_KEY`. Two rejected cases
break the choice list rules: `err-items-choice-list-extra-member` passes the runtime structure check,
which does not read `items`, and `err-in-choice-list-boolean-value` fails with `INVALID_RULE_PARAMETER`.

`err-after-compose-ref-base-leak` fails the meta-schema with
`required` because its `spec` is a bare `$ref`.

## Comparisons

The [form meta-schema test](../../../packages/validator/ts/src/form-metaschema.conformance.test.ts)
and `check-schema.mts` compile the meta-schema and check `expect` and `reason`.

The runtime tests run the complete form load path (composition, forbidden-key scan and validation)
with empty data and the case `files`, and compare `engine`; the message is not compared. Runtime
checks are the forbidden-key conformance tests in
[TypeScript](../../../packages/validator/ts/src/forbidden-scan.conformance.test.ts),
[PHP](../../../packages/validator/php/tests/Validate/ForbiddenScanConformanceTest.php),
[Go](../../../packages/validator/go/validator/validate/forbidden_scan_conformance_test.go) and
[Rust](../../../../packages/validator/rust/tests/spec_validity_conformance.rs), the
[PHP extension engine test](../../../packages/php-ext/tests/engine/engine.test.mjs) and the
[PHP extension runner](../../../packages/php-ext/tests/ValidateReport.php). The Rust structure result is
`Ok(ValidationResult)` with `valid` and `errors`.

## Regeneration

There is no generator; the cases are written by hand. Keep `expect` and `reason` consistent with the
form meta-schema and `engine` consistent with composition and the forbidden-key scan of every
runtime. Because the data is empty, an `engine: "pass"` case must not declare a rule that fails on
empty data. A case that uses `$ref` must carry every referenced file in `files`. Run the meta-schema
check and every test after changing a case.
