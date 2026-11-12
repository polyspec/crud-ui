# Detail validity fixtures
<!-- doc-id: tests-fixtures-detail-validity-readme -->

[한국어](README.ko.md).

`cases.json` holds its cases in the case form of binding's generated tests (G-5): the group `cases` lists them, and
each case is `{ id, name, note, spec, options?, expect, reason?, raises?, requirements? }`. `spec` and every file are
values of `json_value`, written as `{ "kind", "value" }` as in the [validation fixtures](../validate/README.md). The
other structure validity family, [form](../spec-validity/README.md), keeps its own form with a plain `spec`, `files` and
`engine`.

- `expect` is the meta-schema result for `#/definitions/Detail` in the [meta-schema](../../../contracts/schema/crudui.schema.json), `"ok"` or `"fail"`.
- `reason` is present only on a `"fail"` case and is required there. It names an Ajv keyword that
  must appear among the errors.
- `raises` is the runtime structure validation failure of `validate_detail`: `{ kind, status, category, at }`, the load failure
  code in lower case and the composition trace joined with `.`. A case without `raises` has no load failure and the
  result `{ valid: true, errors: [] }`.
- `options.files` is the composition file set that every runtime test passes to the engine. The
  meta-schema reads `spec` alone.

The two results are independent. Every test applies every member it owns: no test classifies
cases itself or supplies its own files. [`check-schema.mts`](../../../scripts/check-schema.mts), run by
`npm run spec:schema`, asserts this shape for all three families before it checks `expect` and
`reason`.

`sortable` on a field and a root `$ref` without its own `fields` fail the meta-schema and pass the
runtime, while an unresolved `$ref` passes the meta-schema and fails the runtime. A forbidden key
introduced by `$patch` fails both.

These cases check a basic detail, detail actions, composed fields, forbidden keys as a field key,
as an action name, on a field, in format options and at the detail root, an unknown key on a detail
action, `show_if` on a field and an unresolved `fields` reference.
The runtime codes are `FORBIDDEN_META_KEY` and `REF_FILE_NOT_FOUND`.

## Comparisons

The [detail meta-schema test](../../../legacy/packages/validator/ts/src/detail-metaschema.conformance.test.ts)
and `check-schema.mts` compile the detail entry point and check `expect` and `reason`.

The runtime tests validate `spec` with `files`, read no record data and compare `raises`. The Rust
structure API returns `Ok(())` for `"pass"`, its equivalent of `{ valid: true, errors: [] }`. The
cross-check console sends every case to its five validator processes, which exit `0` with the clean
result or `2` with `{ error, code, at }`, and requires the same result, code and location from each.

The cases are read at runtime by the detail validation tests in
[TypeScript](../../../legacy/packages/validator/ts/src/validate-detail/validate-detail.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Validate/DetailValidateConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/validate/detail_conformance_test.go),
[Rust](../../../packages/validator/rust/tests/detail_validity_conformance.rs), the
[PHP extension engine test](../../../legacy/packages/php-ext/tests/engine/engine.test.mjs), the
[PHP extension runner](../../../legacy/packages/php-ext/tests/ValidateReport.php) and the cross-check console
[detail runner test](../../../legacy/examples/cross-check-console/server/validate-detail-runner.test.mjs) and
[validator process test](../../../legacy/examples/cross-check-console/server/validator-processes.test.mjs).

The [render validity test](../../../legacy/packages/generator/ts/src/display-validity.test.ts) builds
every case with `buildDetail`: a case builds only when `expect` is `"ok"` and it has no `raises`, the
failure of `raises` is also the render failure, and any other case fails with `INVALID_FORM_INPUT`
([display format declarations](../../../docs/spec/display-formats.md#declarations)).

## Regeneration

There is no generator; the cases are written by hand. Keep `expect` and `reason` consistent with the
detail definitions in the meta-schema, and `raises` consistent with composition and the forbidden-key
scan of every runtime. A composed case must carry every referenced file in `files`. Run the
meta-schema check and every runtime test after changing a case.
