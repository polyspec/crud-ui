# Shared expression fixtures
<!-- doc-id: tests-fixtures-expr-readme -->

[한국어](README.ko.md).

TypeScript, PHP, Go, Rust and the PHP extension load `cases.json`. Each case
contains an expression, expected tokens and AST, and data contexts with expected
boolean and value results. A rejected case contains only `name`, `expr`,
`requirements` and `error`, the first line of the parse error message; the PHP extension, which
reports no message, checks that the expression does not parse. The [expression contract](../../../docs/spec/expressions.md) defines
semantics. Source positions are excluded from token and AST comparison.

Each case lists in `requirements` the ids of the [expression contract](../../../docs/spec/expressions.md) that it
tests: an id is listed when the case contains the token type, the whitespace or the tree node that the id defines
(CUXP-001 to CUXP-017 by token, CUXP-016 by whitespace, CUXP-018 to CUXP-023 by tree node). The case
`path-sibling-truthy` also lists CURP-001 of the [runtime packages](../../../docs/spec/runtime-packages.md): every
implementation evaluates expressions.

Tokens contain `type`, `value` and `literal`. Whitespace is omitted and the final
token is `EOF`. AST fields are:

| Node | Fields |
| --- | --- |
| Ternary | `type`, `condition`, `trueValue`, `falseValue` |
| Binary | `type`, `operator`, `left`, `right` |
| Unary | `type`, `operator`, `operand` |
| In | `type`, `negated`, `value`, `list` |
| Path | `type`, `relative`, `levelsUp`, `segments` |
| Literal | `type`, `valueType`, `value` |
| Group | `type`, `expression` |

A path segment has type `identifier` with a string value, `wildcard` without a
value, or `index` with a numeric value. Data contexts contain `data`, optional
`currentPath`, optional `rowKeys` (the zero-based positions of the row keys in
`currentPath`), expected `value` and expected `truthy`.

The cases cover relative and wildcard paths, comparisons, membership, an array
or an object compared with a scalar, two arrays or two objects compared as JSON
values, the text of a boolean in a string comparison, logical
precedence, nested ternaries, path comparisons, boolean conversion, an unclosed
list, and the nesting limit: groups, negations, a chain and ternaries exactly at
64 levels, each one level over it, and an expression 10,000 groups deep. Empty
arrays and objects are true in a condition; required-input validation is separate.
Condition-map keys are tested as expressions; these cases do not prove map-order
resolution by themselves. The data of two cases writes the number 1 as `1.0`, which
a runtime may decode to another type than `1` and must still compare by value; no
case holds an empty object or an object whose keys are `0`, `1`, …, which PHP
decodes as an array.

Regenerate from the repository root after building the packages:

```sh
node legacy/packages/validator/ts/scripts/generate-expr-cases.mts > tests/fixtures/expr/cases.json
```

The generator records actual TypeScript tokens, ASTs and results, except that a
data context with `expected` records the result the contract states, so the
fixture also judges the TypeScript engine. Review generated
changes against the contract and run every language suite and the PHP extension
engine test. Do not update
expected results solely to make a failed implementation pass.
