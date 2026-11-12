# Expression grammar
<!-- doc-id: docs-spec-expressions -->

[한국어](expressions.ko.md).

This contract defines condition expressions and value-returning ternaries in
TypeScript, PHP, Go and Rust. Expressions used by design settings and conditional
validation use the same token, AST and evaluation contract. Behavior scripts are
page JavaScript and are not evaluated by this engine.

## 0. Processing

The lexer converts source text to tokens. The parser converts tokens to an AST.
The evaluator receives the AST, form data and the current field path. PHP, Go and
Rust provide these stages as well as TypeScript. Evaluation does not use `eval`.

## 1. Tokens

- **CUXP-001** `DOT` — Pattern: `.`; Example: `.field`
- **CUXP-002** `DOT_DOT` — Pattern: two or more dots; Example: `..field`
- **CUXP-003** `ASTERISK` — Pattern: `*`; Example: `items.*.name`
- **CUXP-004** `IDENTIFIER` — Pattern: `[A-Za-z_][A-Za-z0-9_]*`; Example: `status`
- **CUXP-005** `STRING` — Pattern: single or double quoted text; Example: `'active'`
- **CUXP-006** `NUMBER` — Pattern: integer or decimal; Example: `42`
- **CUXP-007** `BOOLEAN` — Pattern: `true` or `false`; Example: `true`
- **CUXP-008** `NULL` — Pattern: `null`; Example: `null`
- **CUXP-009** `EQ NE` — Pattern: `==` `!=`; Example: `.status == active`
- **CUXP-010** `GT GE LT LE` — Pattern: `>` `>=` `<` `<=`; Example: `.count > 0`
- **CUXP-011** `AND OR NOT` — Pattern: `&&` `||` `!`; Example: `!.enabled`
- **CUXP-012** `IN NOT_IN` — Pattern: `in` `not in`; Example: `.country in [US, CA]`
- **CUXP-013** `QUESTION COLON` — Pattern: `?` `:`; Example: `.enabled ? 'yes' : 'no'`
- **CUXP-014** `LPAREN RPAREN` — Pattern: `(` `)`; Example: `(.a || .b)`
- **CUXP-015** `LBRACKET RBRACKET COMMA` — Pattern: `[` `]` `,`; Example: `[US, CA]`
- **CUXP-016** `WHITESPACE` — Pattern: whitespace, omitted from output; Example: space
- **CUXP-017** `EOF` — Pattern: end of input; Example: end of input

- **CUXP-024** The lexer reads the source as characters (Unicode scalar values), never as bytes. A
  `STRING` holds the characters between its quotes: `\n`, `\t` and `\r` are a line feed, a tab and a
  carriage return, and a backslash before any other character is that character, so `'Zürich'` is
  `Zürich` and `'\é'` is `é`. A character that starts no token is one `INVALID` token whose text is
  that character.

## 2. Grammar

The parser accepts one comparison per comparison expression. Parentheses group
logical expressions. Ternary branches may contain further ternaries.

```ebnf
expression = ternary ;
ternary = logic_or [ "?" ternary ":" ternary ] ;
logic_or = logic_and { "||" logic_and } ;
logic_and = negation { "&&" negation } ;
negation = "!" negation | comparison ;
comparison = primary [ ( "==" | "!=" | ">" | ">=" | "<" | "<=" ) compare_value
                       | ( "in" | "not in" ) value_list ] ;
primary = path | literal | "(" logic_or ")" ;
path = [ dots ] IDENTIFIER { "." ( IDENTIFIER | NUMBER | "*" ) } ;
dots = "." { "." } ;
compare_value = primary | IDENTIFIER ;
value_list = "[" value { "," value } "]" | value { "," value } ;
value = literal | IDENTIFIER ;
literal = STRING | NUMBER | BOOLEAN | NULL ;
```

On the right side of a comparison, a bare identifier is a string. An identifier
followed by a dot is a path; a leading dot also identifies a path. Thus
`.status == active` compares with a string and `.a < .b` compares field values.

Ternary branch strings must be quoted. An unquoted branch identifier is a data
path, so `.vip ? gold : plain` reads fields named `gold` and `plain`.

An expression's AST is at most 64 nodes deep, counted from the root to the
deepest leaf. Every parenthesis, negation, ternary and operator adds a level:
`((.a))` is three levels deep and `.a || .b || .c` three as well, because the
chain is a left-nested `Binary` pair. A deeper expression is a parse error with
the message `Expression is nested more than 64 levels deep`; the parser stops at
the limit, so no input can exhaust its stack or the evaluator's.

## 3. Precedence

From lowest to highest:

1. **CUXP-018** `?:`, right associative
2. **CUXP-019** `||`
3. **CUXP-020** `&&`
4. **CUXP-021** `!`, applied to the following comparison or negation
5. **CUXP-022** `== != > >= < <= in not in`, one comparison
6. **CUXP-023** Paths, literals and parenthesized logical expressions

For example, `!.a == .b` means `!(.a == .b)`.

## 4. AST

The node types are `Ternary`, `Binary`, `Unary`, `In`, `Path`, `Literal` and
`Group`. Paths contain identifier, wildcard or numeric-index segments. Shared
fixtures compare semantic fields, excluding source positions. Tokens include
`type`, `value` and `literal`; token streams omit whitespace and end with `EOF`.
The [shared fixture format](../../tests/fixtures/expr/README.md) defines the
serialized fields used in cross-language checks.

## 5. Evaluation

Condition evaluation returns a boolean. Value evaluation returns the selected
branch value for a ternary, including nested ternaries; other expressions return
their boolean condition result. A condition map returns its selected value as
stored. A literal path outside a ternary does not return raw form data.
A string in a conditional setting is an expression only when it parses
completely under this grammar; any other string is a literal value.

Logical operators short circuit. Membership uses the same equality operation as
`==`; `not in` negates membership. Equality compares matching scalar types
directly; different scalar types use numeric conversion when both convert,
otherwise string comparison. Compared with a scalar, an array or an object has
no number and the empty text: `.o == '[object Object]'` and
`.o in '[object Object]'` are false for an object, `'a' == .tags` is false for
`tags: ['a']`, `0 == .tags` is false for an empty array, and `'' == .tags` is
true for any array. In that string comparison the text of a boolean is `true` or
`false`: `.f == 'true'` is true for `f: true`, and `.f == .tags` is false for
`f: false` and any array.

Two arrays or two objects are equal when they hold the same JSON value. Two arrays
have the same length and equal elements in the same order; two objects have the
same set of keys and equal values under each key, in any key order. Elements and
member values are compared as JSON values without conversion: values of different
types are unequal, numbers are equal by value (`1` equals `1.0`), strings by their
characters, and `null` equals `null`. An array never equals an object or `null`.
An array that a path without a wildcard names is one value, not the candidates of
a wildcard: `.a == .b` compares the two arrays, and `.tags in a, b` is false for
`tags: ['a']`.

- **CUXP-025** Relational comparisons convert both sides to numbers. A string uses its leading
  numeric part, or zero when no number is available. This condition conversion is separate from
  numeric validation rules.

A relative `.field` resolves beside the current field. `..field` moves one parent
level further; each additional dot moves one additional level. A row of a repeated
field is one level: its row key and the name of its collection are left together.
In a field of a group row, `.field` reads a field of the same row and `..field` the
field beside the collection; for a value of a repeated field, `.field` reads the
field beside the collection. The evaluator receives with the current path the
positions of its row keys, which the runtime that builds the path knows from the
specification, so a segment is a row key only at such a position, whatever its
text: `__0000000000001__`, `7` and `r1` resolve alike, and a field named `7` is not
a row key. An unprefixed path resolves from the data root.

| Current path | Row keys | `.x` | `..x` |
| --- | --- | --- | --- |
| `a.b` | none | `a.x` | `x` |
| `items.__k__.name` | `__k__` | `items.__k__.x` | `x` |
| `group.items.7.name` | `7` | `group.items.7.x` | `group.x` |
| `tags.__k__` (a value of the repeated field `tags`) | `__k__` | `x` | `x`: the root has no parent |
 Missing values are false in a condition.
Default field values are prepared by form binding; the expression evaluator does
not load a specification to find defaults.

This conversion answers a condition; it does not determine whether required
input exists. The `required` rule rejects empty arrays and objects. Numeric zero
and boolean false are valid supplied values for that rule. Collection count and
visibility are separate contracts; see [empty collections](empty-collections.md).

## 6. Boolean conversion

`null`, a missing value, `false`, numeric zero and the empty string are false.
Nonempty strings, including `"0"` and `"false"`, are true. Arrays and objects,
including empty arrays and empty objects, are true.

## 7. Wildcards

A path such as `items.*.name` resolves repeated entries. The default evaluation
uses current row indexes when the field context supplies them. Otherwise the
remaining wildcard resolves candidate values, and a comparison succeeds when
any candidate matches. TypeScript also exposes explicit `ANY` and `ALL`
strategies to its path evaluator; those options are not part of the shared
expression facade.

## 8. Condition maps

Condition maps evaluate non-default keys in declaration order and return the
first matching value. The literal key `true` supplies the default only after all
other conditions fail, regardless of its position. With no match and no default,
the result is null.

```yaml
class:
  ".status == 'active'": status-active
  ".status == 'pending'": status-pending
  true: status-default
```

Map values are returned without expression evaluation. Each non-default key uses
the same parser and evaluator as a standalone condition.

## 9. Verification

All four languages and the PHP extension load the same expression fixtures and
compare token streams, serialized ASTs, boolean results and value results. A
rejected expression is compared by its parse error message; the extension, which
reports no message, only fails to parse it. The fixture generator records
TypeScript output; conformance tests rerun every implementation against those
expectations. Generation alone does not establish correctness. Expected semantics
must agree with this contract. Implementation and test results belong in
[feature status](../features.md).

## 10. Unsupported operations

Arithmetic · function calls · method calls · regular-expression evaluation · assignment · bitwise operations · slash-prefixed root paths · eval.

A validation rule can accept a regular-expression parameter independently of the
expression engine. Behavior scripts remain separate from condition evaluation.
