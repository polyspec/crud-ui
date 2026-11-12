# Validation fixtures
<!-- doc-id: tests-fixtures-validate-readme -->

[한국어](README.ko.md).

`cases.json` contains the shared form validation cases for TypeScript, PHP, the PHP extension, Go
and Rust. Each case provides `name`, `note`, `spec`, `data`, optional `files`, and either
`expected` or `expectFailure`. `expected` is the complete `{ valid, errors, hidden }` result, and every
error has `path`, `field`, `rule`, `message` and `value`. `expectFailure` is
`{ code, message, at }`: a composition failure's `at` is its trace joined with `.`, and an input
failure's `at` is empty.

These cases check relative, parent and field paths in rules, ternary and condition-map limits,
conditional requiredness, keyed groups and scalars, repeated-field paths, `unique`, `mincount`,
`equalTo`, `containedIn`, `typeFrom`, `minFrom`, `maxFrom`, the parameter types of `equalTo`, `containedIn`, `typeFrom`, `minFrom`, `maxFrom`, `enddate`, `notEqual` and `unique`, regular expression and `accept` values, choice membership with translated and empty
labels, choice lists as `in` members and their parameter errors, empty member sets that match no value, member order, composed specifications, the first error per field, message overrides under
the declared rule name, rule names that are not registered (in `validate` and `messages`, at
nested row paths, for hidden fields and in check order), empty values that skip format rules, and
the shape of submitted data. The
reference cases check `reference`: ids taken from every row on a declaration path, membership
matching against them, ids of hidden fields, a form without ids and the parameter errors. The
nested row paths, for hidden fields and in check order), empty values that skip format rules, the
limits of submitted data and their parameter, and the shape of submitted data. The
data-shape cases reject undeclared members at the root, in groups and in repeated group rows,
and an array or object as the value of a single-choice field or of its rows, hidden fields
included; fields referenced by conditions are declared in each specification. The
visibility cases check that a field hidden by `design.show` (an expression, a condition map or
`false`, in its row context) skips all of its rules and those of every field it contains, while
other rules still read its kept value, and a three-step toggle that validates kept values again
once the field is shown. The `multiple: only` cases check per-row validation of data rows and
missing data that has no row but still fails `required` and `mincount`. The group source cases check
the choices that a field takes from the rows of a repeated group: values that match by canonical text
or numeric value, rows that give no choice, a group without data, the implicit `in` check before the
declared rules, the rows of a hidden group and the load failures of a group source. The combined items cases check a group
source with literal choices: one set of literal and row values, a row that repeats a literal choice refused by its path and
value, and the load failures of `choices`. The multiple shape cases check that a
`multiple` that is not a boolean, `only` or an object fails the load at the declaration path of its field, before its rules. The placeholder case checks
that the empty value of the placeholder option of a select or search field with no option fails
`required` and passes every other rule. Failure cases use `REF_FILE_NOT_FOUND`, `INVALID_RULE_PARAMETER`, `INVALID_RULE_PATTERN`,
`UNKNOWN_RULE` and `INVALID_FORM_INPUT`. The
[test fixture contract](../../../docs/operations/test-fixtures.md) describes the format.

## Comparisons

Each test runs the validator and compares the complete result or failure record. The `errors`
array is compared in order. Go, Rust and PHP compare numbers by value, so `5` and `5.0` are equal.
The [PHP extension runner](../../../legacy/packages/php-ext/tests/ValidateReport.php) compares JSON text, so
member order is compared there as well. A failure case compares `code`, `message` and `at`
exactly, and every case must declare exactly one of `expected` and `expectFailure`. A case that tests a requirement of
[empty collections](../../../docs/spec/empty-collections.md) or of [validation rules](../../../docs/spec/validation-rules.md)
lists its ids in `requirements`; `generate.mts` names those
cases in its `REQUIREMENTS` map, which is how they are added.

The cross-check console's validator processes receive each case on standard input. A result case
exits `0` with the result on standard output; a failure case exits `2` with `{ error, code, at }`.

The cases are read by the validation conformance tests in
[TypeScript](../../../legacy/packages/validator/ts/src/validate.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Validate/ValidateConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/validate/conformance_test.go) and
[Rust](../../../packages/validator/rust/tests/validate_conformance.rs); the
[PHP extension engine test](../../../legacy/packages/php-ext/tests/engine/engine.test.mjs) and the
[PHP extension API test](../../../legacy/packages/php-ext/tests/ApiTest.php), which runs the PHP and native
validators; and the cross-check console
[validator process test](../../../examples/cross-check-console/server/validator-processes.test.mjs),
which sends every case to the five validator processes, and its
[validation runner test](../../../examples/cross-check-console/server/validate-runner.test.mjs),
which compares the four language results.

## Regeneration

Run from the repository root:

```sh
node tests/fixtures/validate/generate.mts > tests/fixtures/validate/cases.json
```

The generator runs the TypeScript validator and records each result or failure record, except
for two groups written from the specification: [`value-rules.mts`](value-rules.mts) states each
field's outcome, and [`visibility.mts`](visibility.mts) states the complete result record. Both use
the default rule messages in `visibility.mts`.
Specifications that the generator holds as JSON text keep their member order in `cases.json`.
Review changes against the specification and run every test that reads them before accepting them.
Regeneration alone is not verification.

## Authoring

`cases.json` is data that is edited directly. The TypeScript generator `generate.mts` wrote it while the TypeScript
runtime was the reference; once that runtime is a legacy runtime, no program generates the expected values, and the
Rust core, whose results the cases test, never writes them.
