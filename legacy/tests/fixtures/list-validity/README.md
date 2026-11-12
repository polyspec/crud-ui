# List validity fixtures
<!-- doc-id: tests-fixtures-list-validity-readme -->

[한국어](README.ko.md).

`cases.json` cases share one shape with the other structure validity families
([form](../spec-validity/README.md), [list](README.md) and
[detail](../detail-validity/README.md)): `{ name, note, spec, files?, expect, reason?, engine }`.

- `expect` is the meta-schema result for `#/definitions/List` in the [meta-schema](../../../../contracts/schema/crudui.schema.json), `"ok"` or `"fail"`.
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

A shape that only the meta-schema rejects, such as missing `columns`, an unknown `sort` key or an
invalid `pagination.mode`, has `engine: "pass"`.

The accepted cases check minimal columns, every cell format, shorthand and boolean formats, sort,
pagination, actions, the empty state and design, a description, composed columns and a composed
search form. The rejected cases cover missing columns, a description that is not content, forbidden and `x`-prefixed column keys, unknown keys on a
column, sort, pagination, an action and the list root, a forbidden key in format options, invalid
enum values and a malformed format value.

## Comparisons

The [list meta-schema test](../../../legacy/packages/validator/ts/src/list-metaschema.conformance.test.ts)
and `check-schema.mts` compile the list entry point and check `expect` and `reason`.

The runtime tests validate `spec` with `files`, read no rows and compare `engine`. The Rust structure
API returns `Ok(())` for `"pass"`, its equivalent of `{ valid: true, errors: [] }`. The
cross-check console sends every case to its five validator processes, which exit `0` with the clean
result or `2` with `{ error, code, at }`, and requires the same result, code and location from each.

The cases are read at runtime by the list validation tests in
[TypeScript](../../../legacy/packages/validator/ts/src/validate-list/validate-list.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Validate/ListValidateConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/validate/list_conformance_test.go),
[Rust](../../../../packages/validator/rust/tests/list_validity_conformance.rs), the
[PHP extension engine test](../../../legacy/packages/php-ext/tests/engine/engine.test.mjs), the
[PHP extension runner](../../../legacy/packages/php-ext/tests/ValidateReport.php) and the cross-check console
[list runner test](../../../../examples/cross-check-console/server/validate-list-runner.test.mjs) and
[validator process test](../../../../examples/cross-check-console/server/validator-processes.test.mjs).

The [render validity test](../../../legacy/packages/generator/ts/src/display-validity.test.ts) builds
every case with `buildList`: a case builds only when `expect` is `"ok"` and `engine` is `"pass"`, an
`engine` failure is also the render failure, and any other case fails with `INVALID_FORM_INPUT`
([display format declarations](../../../../docs/spec/display-formats.md#declarations)).

## Regeneration

There is no generator; the cases are written by hand. Keep `expect` and `reason` consistent with
the list definitions in the meta-schema, and `engine` consistent with composition and the
forbidden-key scan of every runtime. A composed case must carry every referenced file in `files`.
Run the meta-schema check and every runtime test after changing a case.
