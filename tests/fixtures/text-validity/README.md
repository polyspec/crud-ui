# Input text fixtures
<!-- doc-id: tests-fixtures-text-validity-readme -->

[한국어](README.ko.md).

These cases define the [input text](../../../docs/spec/input-text.md) rule: every string and
object member name of a specification, a composition file and caller data is a sequence of
Unicode scalar values, and an operation rejects any other text before its other checks.

Each directory holds the `cases.json` of one operation: `validate`, `validateList`,
`validateDetail`, `compileForm`, `bindForm`, `createForm`, `buildList` and `buildDetail`. The
files are JSON text that writes unpaired surrogates as escapes, such as `"\ud800"`, a lone low
surrogate and the reversed pair `"\udc00\ud800"`, in string values, member names, arrays, nested
rows, composition files and options. A decoder that replaces or refuses these escapes cannot read
the files; each test reads them with the decoder the specification names for its runtime.

A case has `name`, `note` and `expect`, and the inputs of its operation; a case that tests a requirement of
[input text](../../../docs/spec/input-text.md) lists its ids in `requirements`:

- `spec`, and `files` for the validation operations;
- `data` (validation, binding and instances), `rows` (lists) or `record` (details);
- `options`, whose `files` member holds the composition files of the generation operations;
- `template`, a template given as JSON text instead of the one compiled from `spec`;
- `action`, one `{ method, args }` call on a created form, whose result is the expectation.

`expect` is the failure `{ code, message, at }`, or the result of a case that passes: the
validation result `{ valid, errors, hidden }` for `validate`, `{ valid, errors }` for
`validateList` and `validateDetail`, and `"pass"` for the generation operations. Cases with valid surrogate pairs and characters from U+E000 to U+FFFF
check that valid text passes and that members follow code point order.

## Value graphs

`value-graphs.json` holds the cases of the value limits: a value walked as the tree it denotes
holds at most 1,000,000 nodes and nests at most 256 levels, and a value that contains itself is
beyond them. JSON text cannot share a container, so each case describes its value graph in
`graph`, and each test builds it with its own containers and places it at `graph.at`, a path
that starts with `spec`, `files` or `data`, in the case's `validate` inputs. The shapes are:

- `doubled`: `leaf` in a list that holds the previous value twice, `size` times over;
- `chain`: `leaf` in `size` nested lists;
- `flat`: one list of `size` items that are `leaf`;
- `self-twice`: an object whose members `self` and `again` are the object itself, a PHP array
  that holds two references to itself.

The accepted native boundary cases declare `dataLimits.depth` 256 or `dataLimits.values` 1000000, so the smaller default submission budget does not preempt the native value limit.

Every case runs as one test within the runner's per-test limit; a walk that grows with the tree a
value denotes (2^40 nodes for a shared list forty levels deep) does not finish within it. Wall-clock
thresholds are not asserted, since a machine's speed would decide them.
The TypeScript, PHP, Go and PHP extension tests run them. A Rust value owns its nodes and
cannot share one, so the Rust core tests run the cases whose value is a tree (`flat` and `chain`),
and the cases of `doubled` and `self-twice` are cases of the walk of the bindings
([CUIT-042](../../../docs/spec/input-text.md#value-limits)).

## Tests that read the cases

The validation operations are run by the
[TypeScript](../../../packages/validator/ts/src/text/text-validity.conformance.test.ts),
[PHP](../../../packages/validator/php/tests/Validate/TextValidityConformanceTest.php),
[Go](../../../packages/validator/go/validator/validate/text_conformance_test.go) and
[Rust](../../../packages/validator/rust/tests/text_validity_conformance.rs) tests, the
[PHP extension runner](../../../packages/php-ext/tests/ValidateReport.php) through its
[API test](../../../packages/php-ext/tests/ApiTest.php), and the cross-check console
[validator process test](../../../examples/cross-check-console/server/validator-processes.test.mjs),
which sends every case to the five validator processes.

The generation operations are run in process by the
[generator core test](../../../packages/generator/ts/src/input-text.test.ts) and through every
program by the [native generator suite](../../native-generators/README.md), which records the
evidence of the JavaScript, PHP, Go, Rust and PHP extension runtimes.

Byte strings that are not UTF-8 cannot be written in JSON text. The PHP, Go, Rust decoder and PHP
extension tests check them directly, and the programs reject standard input that is not UTF-8.

## Changing cases

The cases are written by hand. Keep one expectation per case and run every test after a
change.
