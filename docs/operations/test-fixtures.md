# Test fixtures
<!-- doc-id: docs-operations-test-fixtures -->

[한국어](test-fixtures.ko.md).

Fixtures define inputs and expected behavior. Their format depends on the tested
contract.

| Location | Contract |
| --- | --- |
| `tests/fixtures/validate/cases.json` | Validation results and composition failures. |
| `tests/fixtures/compose/` | Reference and patch composition. |
| `tests/fixtures/expr/` | Tokens, ASTs and expression evaluation. |
| `tests/fixtures/form-render/` | Expected form rendering. |
| `tests/fixtures/form-session/` | Shared form controls and interaction scenarios. |
| `tests/fixtures/view-session/` | Shared list and detail re-render scenarios. |
| `tests/fixtures/text-validity/` | [Input text](../spec/input-text.md) failures of every operation. |

## Validation

The validation fixture is an array. Each entry has `name`, `spec` and `data`;
optional `files` supplies composition inputs. `note` describes the case.
`expected` contains the complete `{ valid, errors, hidden }` result. A load or input
failure case instead uses `expectFailure: { code, message, at }`; each case
declares exactly one of the two. A load failure's `at` is its composition trace
joined with `.`, and an input failure's `at` is empty.

```json
{
  "name": "supplied-name",
  "spec": {
    "type": "group",
    "properties": { "name": { "type": "text", "validate": { "required": true } } }
  },
  "data": { "name": "Example" },
  "expected": { "valid": true, "errors": [] }
}
```

The [TypeScript conformance test](../../legacy/packages/validator/ts/src/validate.conformance.test.ts)
compares the complete result or failure record strictly. It also rejects entries
without exactly one expectation. PHP, the C PHP extension, Go and Rust consume the
same validation fixture in their package suites and CLI checks.
`tests/fixtures/validate/generate.mts` produces the fixture from the TypeScript
engine; regenerate it instead of editing `cases.json`.

## Adding and reviewing cases

Place a case under the contract it tests. Use a descriptive identifier and include
the input that demonstrates the behavior. Derive expected results from the
specification; do not change them merely to match a failing implementation.
If the contract changes, review the expectation and implementation together.

Generated expectations require the same review as handwritten expectations.
Generation alone does not prove correctness. Run the relevant implementations
against the resulting fixture and record current results in
[feature status](../features.md). Counts and deployment results do not belong in
the fixture format contract.

Tests executed from a candidate archive create writable scratch fixtures under
the operating system temporary directory. They resolve that directory to one
canonical absolute path and use only regular path components. Candidate tests do
not require Git metadata and do not write scratch fixtures under the extracted
source directory. Each test creates a unique directory and removes it after the
test completes.

The [form checks](testing.md#forms-and-reports) run the separate rendering, DOM,
style, control-state and canonical flow checks.
