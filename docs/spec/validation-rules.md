# Validation rules
<!-- doc-id: docs-spec-validation-rules -->

[한국어](validation-rules.ko.md).

Fields declare rules under `validate`. The [schema contract](schema.md)
defines field structure; [validation APIs](../operations/validation.md) define
entry points, load failures and input failures.

## Registered rules

- **CUVR-001** `required`: `true` requires a supplied, nonempty value.
- **CUVR-002** `email`, `url`: Boolean enablement of the corresponding format check.
- **CUVR-003** `minlength`, `maxlength`: Integer minimum or maximum length; see [values](#values).
- **CUVR-004** `rangelength`: `[minimum, maximum]` length; see [values](#values).
- **CUVR-005** `number`, `digits`: Boolean enablement of the [numeric](#values) or digit-only check.
- **CUVR-006** `min`, `max`: Inclusive numeric lower or upper bound.
- **CUVR-007** `range`: Inclusive `[minimum, maximum]` numeric bounds.
- **CUVR-008** `step`: Numeric increment counted from 0.
- **CUVR-009** `match`, `pattern`: Whole-value [pattern](#patterns); both names use the same rule implementation.
- **CUVR-010** `equalTo`, `notEqual`: Field comparison; the rule receives its reference or literal parameter unchanged.
- **CUVR-011** `in`: [Membership](#values) in a list, comma-separated string or map.
- **CUVR-012** `date`, `dateISO`: Boolean enablement of date format checks.
- **CUVR-058** `date`: A value is a date when it is a string whose trimmed text (CUVR-019) is `YYYY-MM-DD`,
  `YYYY/MM/DD`, `MM/DD/YYYY` or `DD/MM/YYYY` and names a calendar day that exists (the day fits its month, and
  February 29 only in a leap year), or an RFC 3339 date-time `YYYY-MM-DDTHH:MM:SS` followed by `Z`, `+HH:MM` or
  `-HH:MM`, with no fraction, whose date is a calendar day and whose time is valid (hours 00 to 23, minutes and
  seconds 00 to 59, offset hours 00 to 23 and offset minutes 00 to 59). A slash form is a date when either the
  month-first or the day-first reading names a calendar day. A number, a date-time without an offset and any other
  text are not dates; the text of a JavaScript or PHP date parser is not a date unless it has one of these layouts.
- **CUVR-059** `dateISO`: A value is an ISO date when it is a string whose trimmed text (CUVR-019) is `YYYY-MM-DD`
  and names a calendar day that exists. Other layouts, numbers and other values are not ISO dates.
- **CUVR-013** `enddate`: Start-date field path; a parsed end date must not precede the parsed start date.
- **CUVR-014** `mincount`, `maxcount`: Minimum or maximum collection size.
- **CUVR-015** `unique`: Uniqueness check, optionally using a reference or filter parameter.
- **CUVR-016** `accept`: File extension or MIME-type parameter, a comma-separated string or a list of such strings.
  A string value is a file name or a MIME type, an object value is a file (`type` or `mimeType`, `name` or
  `filename`), and a list value holds files that each match. A list member that is not an object and a value of
  another type do not satisfy the rule and fail it.
- **CUVR-066** `conditionTree`: `true` or `judge`; the value is a [condition tree](#condition-trees), with judged
  text only under `judge`.
- **CUVR-071** `reference`: The value names an id that the data declares at the field the parameter names; see
  [references](#references).
- **CUVR-075** `containedIn`: Field path; a string value must occur as a substring of the string value of the referenced
  field, which resolves as the reference of `equalTo` does. A value or a referenced value that is not a string fails the rule.
- **CUVR-077** `typeFrom`: Field path; the value of the referenced field, which resolves as the reference of `equalTo` does,
  names the type that the value must have: `bool` a boolean, `int` a finite number without a fractional part, and `enum` a
  string. A referenced value that is missing or names no such type fails the rule.
- **CUVR-079** `minFrom`, `maxFrom`: Field path; the value must be a finite number at or above (`minFrom`) or at or below
  (`maxFrom`) the value of the referenced field, which resolves as the reference of `equalTo` does. A value that is not a
  finite number fails; a referenced value that is missing or `null` declares no bound and the rule passes, and one that is
  present but not a finite number fails.

The [TypeScript registry](../../packages/validator/ts/src/rules/index.ts) defines
built-in names. `crudui describe` derives its catalog from this registry;
see the [CLI procedure](../operations/cli.md). Every runtime has the same built-in rules and
no way to register others. A `validate` or `messages` key that is not one of these names fails the
load with `UNKNOWN_RULE` (see [parameter errors](#parameter-errors)); names are compared exactly,
so `equalto` is not `equalTo`.

## Evaluation

Rules run in declaration order and stop at the first failure for each field.

- **CUVR-093** `hiddenPaths(spec, data)` returns the data paths that the `hidden` member of the validation result
  holds for the same specification and data: the specification is composed without files and checked as
  `validate` checks it, the data is an object, data of another shape inside it is read as missing, and the
  data limits are not measured. The browser form binding reads it to show and hide fields.
- **CUVR-090** A field whose data has no member is validated with the value `null`: a missing value and `null`
  are both no value, as a form that submits nothing for an empty control. `required` fails both, every other
  rule skips them as empty values, and the error's `value` is `null`. The data itself keeps the difference
  (CURP-025).
- **CUVR-091** A specification whose composed root has no object `properties` fails as an input failure after
  composition — Code: `INVALID_FORM_INPUT`; Message: `A form spec must be a group with properties`; an empty
  location. A specification is never read as a form without fields (CUVR-088).
- **CUVR-092** In the JSON text entries, an `options.files` that is not an object fails with `INVALID_FORM_INPUT`
  and `Files must be an object`, and an `options.basepath` that is not a string with `Basepath must be a
  string`, both with an empty location, after the input text checks.
A resolved `false` or `null` parameter disables the rule. A rule name that is
not registered is a load failure whatever its parameter, so a misspelled rule never
disables validation silently; the meta-schema rejects the same names.

A `number` field runs the implicit `number` check before other rules unless it
declares that rule explicitly. Nonfinite numeric inputs fail numeric validation.

- **CUVR-017** **Visibility.** A field whose `design.show` resolves to `false` against the data being
  validated is hidden. The rules of a hidden field and of every field it contains are not
  evaluated — `required`, collection counts and all others — and it reports no error. Its value
  is neither changed nor removed: the data keeps it, and conditions and references elsewhere read
  it as it is, so a value kept while its field is hidden is validated again once the data shows the
  field. `design.show` resolves like a conditional parameter (a boolean, an expression or a
  condition map, in the field's row context); only a resolved `false` hides, so a field without
  `design.show`, with a condition map that selects nothing, or with a string that is not a valid
  expression (a literal) is visible. The shape of the data is an
  input contract and is checked for hidden fields too. Visibility
  depends on the data alone, so a server reaches the same result as the form that showed it.

The validation result holds, besides `valid` and `errors`, the member `hidden`: the data paths of
the fields whose `design.show` resolves to `false` against the data, in declaration order, each
field of a group row under the row's key and the fields inside a hidden field included, the list
that the [browser binding](../../packages/form-binding/README.md#display) reads with `hiddenPaths`. A path names the
field and everything it contains, so a server that stores the data can leave the values at these
paths unstored; the validator changes no value. For the fields below, the data
`{ "is_display": 0, "display": { "code": "abc1" } }` gives `hidden` the list `["display"]`.

```yaml
is_display: { type: text }
display:
  type: group
  design: { show: ".is_display == 1" }
  properties:
    code: { type: text, validate: { required: true } }
```

Form data contains only fields declared in the corresponding `properties` map. This applies to
the root, each group and each repeated group row, including hidden groups. A condition or rule
reference to data must name a declared field. Unknown object members fail as input errors before
field rules run; the first unknown member is chosen in code point order at each object.

A single-choice field is a field of type `select`, `dropdown`, `selectbox`, `choice` or `radio`
whose `lang` is absent, `false` or `null`. It holds one value: its present data, and each row value
of a repeated single-choice field, is a string, a number, a boolean or `null`. An array or an
object there, including an empty one, is an input error with the message
`Choice data must be a single value: {path}`; a field that holds several choices uses
`multichoice`, `checkboxes` or `checkcontainer`. Like the other data-shape checks it applies to
hidden fields. Fields are checked in declaration order, the field before its rows, and rows in
sorted key order.

## Keyed maps

A field that declares `multiple.keys` is a [keyed map](schema.md#keyed-maps): its rows exist only
under the ids of the repeated group that its reference names.

- **CUVR-069** Each key of the field's data must be a row key of the data of the named group. The
  reference is resolved as the `enddate` parameter is resolved, in the row context of the field, so a
  keyed map inside a row of a repeated group reads the group's data around that row. Group data that
  is missing, `null` or not an object has no ids. A key that is not an id is an input error with code
  `INVALID_FORM_INPUT`, an empty location and the message `Row key is not an id of {reference}: {path}`,
  where `{reference}` is the declared reference and `{path}` is the data path of the row, row keys
  included. The rows of a keyed map come only from the data and the form offers no control that adds
  or removes one, so a key outside the group is data that no form produces, as an undeclared member
  is. Like the other data-shape checks it applies to hidden fields. A field's keys are checked after
  its keyed-object check and before its single-choice check and its rows, in code point order of
  the keys.
- **CUVR-070** A `multiple.keys` that does not name a repeated group by the rule of the
  [schema](schema.md#keyed-maps), including a value that is not a string, fails the load with code
  `INVALID_FORM_INPUT`, an empty location and the message
  `Invalid multiple.keys at {path}: expected a reference to a repeated group`, where `{path}` is the
  field's declaration path. It is checked with the declared parameters
  ([parameter errors](#parameter-errors)), after the field's `messages` keys and before the fields it
  contains, for hidden fields too.

For the [schema example](schema.md#keyed-maps), the data
`{ "characters": { "c1": { "name": "Ann", "relation_notes": { "c2": "Brother" } }, "c2": { "name": "Ben" } }, "facts": { "f1": { "truth": "The will is forged", "holders": { "c1": "knows", "c3": "suspects" } } } }`
fails with `Row key is not an id of ..characters: facts.f1.holders.c3`.

## Values

Every runtime applies these definitions; the rules below use no other notion of
whitespace, emptiness or text.

- **CUVR-018** **Unicode data** is Unicode 16.0.0 as recorded in
  [`contracts/unicode-properties.json`](../../contracts/unicode-properties.json), which
  `scripts/generate-unicode-properties.mts` writes from the property ranges of
  `@unicode/unicode-16.0.0`. Every runtime embeds that table and uses no other Unicode data, so every
  runtime classifies every code point the same way.

- **CUVR-019** **Whitespace** is exactly the code points with the Unicode `White_Space` property:
  U+0009–U+000D, U+0020, U+0085, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029,
  U+202F, U+205F and U+3000. U+0000, U+180E, U+200B and U+FEFF are not whitespace.
  **Trimming** removes leading and trailing whitespace and nothing else.

- **CUVR-020** **Empty values** are a missing value, `null`, a string that is empty after
  trimming, an empty array and an empty object. `0` and `false` are supplied values.
  `required` fails on an empty value. Every other rule except `mincount` and
  `maxcount` passes an empty value without evaluating it; collection-count rules
  evaluate empty collections. A repeated field or group whose data is missing is an empty
  collection. Requiredness and collection limits are separate; see
  [empty collections](empty-collections.md).

- **CUVR-080** The value of the [placeholder option](schema.md#choice-lists) of a select or search
  field with no option ([CUSC-080](schema.md#choice-lists)) is the empty string, an empty value: a
  submitted placeholder fails `required` when the field declares it, and every other rule except
  `mincount` and `maxcount` passes it without evaluating it, `in` with an empty member set included.

- **CUVR-021** **Canonical text** of a scalar is: a string itself; `true` as `1` and `false` as
  `0`; a finite number as ECMAScript `Number.prototype.toString` writes its double value (the
  shortest text that reads back as the same double, with an exponent when the
  magnitude is at least 10^21 or below 10^-6, and `0` for negative zero). An integer is first
  converted to the nearest double, so `9007199254740993` is written `9007199254740992`.

- **CUVR-022** **Length** rules (`minlength`, `maxlength`, `rangelength`) count the Unicode code
  points of a scalar's canonical text, untrimmed. Their limits are integers from 0
  to 9007199254740991; `rangelength` requires minimum ≤ maximum. An array or object
  value has no canonical text and fails a length rule, `pattern` and `match`.

- **CUVR-023** **Numbers.** A value is numeric when it is a finite number, or a string that after trimming is
  *numeric text* whose value is finite. Numeric text is the HTML valid floating-point number: an
  optional `-`, then digits, digits followed by `.` and digits, or `.` and digits, then optionally
  `e` or `E`, an optional `-` or `+` and digits (`^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$`);
  its value is the nearest double. `+1`, `1.`, hexadecimal, `Infinity`, `NaN`, separators and
  non-ASCII digits are not numeric text, and text whose value overflows is not numeric. Booleans,
  `null`, arrays and objects are not numeric.

- **CUVR-024** `number` passes a numeric value.
- **CUVR-025** `min`, `max` and `range` pass a numeric value that is not below the minimum and not above the
  maximum; `step` passes a numeric value that is an integer multiple of the step, counted from 0.
  A value that is not numeric fails these rules. Multiples are decided exactly: the value and the
  step are read as the decimal numbers their canonical texts write, without a tolerance, so
  `0.3` is a multiple of `0.1` and `0.30000000000000004` is not.
- **CUVR-026** `digits` passes a string or a number whose canonical text (a string trimmed) consists only of
  ASCII digits; booleans and other values fail.
- **CUVR-027** `mincount` and `maxcount` count the elements of an array or the keys of an object; a missing
  value, `null` and a string that is empty after trimming count 0, and any other scalar counts 1.
- **CUVR-028** A message shows a numeric parameter as its canonical text. Every `{0}` and `{1}` of a default or
  declared message is replaced when the rule has that parameter; a placeholder for a parameter the
  rule does not have stays as written.

- **CUVR-029** **Membership** (`in`) takes its members from a list (each element as is), a
  [choice list](schema.md#choice-lists) (the `value` of each choice, inside
  [groups](schema.md#choice-groups) included), a comma-separated string
  (split at U+002C, each item trimmed) or a map (its keys). A list is a choice list when one of its
  elements is an object that has a `value` member or a `choices` member; it is checked first by the
  choice list rules (each element a choice with only `value` and `label` members or a group with only
  `label` and a non-empty `choices` list of such choices, a string or finite number `value`, no two
  values in the list with the same canonical text) and then its values are checked as members in
  written order, so a field can declare the same choice list as `items` and `in`.
  Members are strings, numbers or booleans; a member of another type and a member whose
  canonical text is empty after trimming are declaration errors; members are checked in order,
  each for its type before its emptiness. An empty list and an empty map declare an empty member
  set, which is valid and matches no value: a field with no choices passes an empty
  value and fails every other value. A string always has at least one item, so a blank string is
  an empty member. A
  string value is trimmed; an array value passes when every element passes, an empty element
  (including an empty array or object) passes as an empty value does, and a non-empty array or
  object element fails. A value matches a member
  when their canonical texts are the same code points, or when both are numeric with equal
  values. List elements and map keys are read as they are, so a member with surrounding whitespace
  is not numeric text. Case, Unicode normalization and text that is not numeric never match.

- **CUVR-060** **Choices from a repeated group.** A field whose `items` is a
  [group source](schema.md#choices-from-a-repeated-group) runs an implicit `in` check before its
  declared rules. Its members are the values of the choices that the source gives for the data
  being validated, and a value matches them as a value matches the members of `in`: an empty value
  passes, an array value passes when every element passes, and a value that matches no choice
  fails. The failure is reported with the rule `in` and its message, which `messages.in`
  overrides. A declared `in` runs as declared after the implicit check. The rows of a hidden group
  give choices like any other rows, because a hidden field keeps its value
  ([visibility](#evaluation)).
  The members are read from the data at each validation, so a validation after a change of the
  source rows checks the choices that the form lists after that change
  ([choices from a repeated group](schema.md#choices-from-a-repeated-group)); the browser validation
  binding validates the data of its controls, whose choices are the ones it shows.
- **CUVR-087** **A repeated value of a group source.** When the implicit check of CUVR-060 reads the
  choices of a group source, before it compares the value, it reads the rows of the group in data
  order, and a row whose choice value has the canonical text of an earlier row's value is an input
  error with code `INVALID_FORM_INPUT`, an empty location and the message
  `Group source value repeats an earlier row: {value} at {path}`, where `{value}` is the canonical
  text and `{path}` is the data path of the repeating row's `{value}` field, row key included, such
  as `characters.c4.id` ([schema](schema.md#choices-from-a-repeated-group), CUSC-090). The first
  repeat fails. Only rows that give a choice (CUSC-063) are compared, so a blank or non-scalar value
  repeats nothing. A hidden field is not validated, so it reads no choices and runs no such check.
- **CUVR-085** **Literal choices of a group source.** The members of the implicit `in` check of a
  group source with `choices` (CUSC-089) are the values of its literal choices followed by the values
  of the choices of its rows, one set, and a value passes when it matches one of them as for `in`.
  The choices are read before the field's rules run; a row whose value has the canonical text of a
  literal choice fails the validation with the input failure `INVALID_FORM_INPUT`, an empty location
  and the message `Group source value repeats a literal choice at {path}: {value}` (CUSC-089), so the
  set never holds a value twice.

## Condition trees

- **CUVR-067** `conditionTree` passes a value that is a [condition tree](schema.md#condition-trees) (CUSC-072 to
  CUSC-075). The parameter `true` permits groups and field comparisons; `judge` permits judged text as well,
  so under `true` a value that holds a `judge` condition at any level fails. Every other value fails: a
  string, a number, a boolean, a list, an object of another form, an object with a member that its form
  does not have, and a tree deeper than 32 levels. An empty value passes as for every other rule
  (CUVR-020), so `{}` and `null` pass and `required` refuses them. A runtime reads at most 32 levels of the
  value, whatever its depth, and the rule's default message is `Please enter a valid condition.`

## References

`reference` takes the declaration path of a field of the same form: the property names from the
root joined with `.`, without row keys, as a parameter error names its location. For the fields
below, `facts.id` names the field `id` of the rows of the repeated group `facts`, and the value of
`secrets.fact_id` in each row must be the `id` of one of the facts.

```yaml
facts:
  type: group
  multiple: true
  properties:
    id: { type: text, validate: { required: true, unique: true } }
secrets:
  type: group
  multiple: true
  properties:
    fact_id: { type: text, validate: { reference: facts.id } }
```

- **CUVR-072** **Ids.** The ids of a declaration path are the values of the named field in the data being
  validated. The path is followed from the data root: a group's data is an object of its fields, and
  the data of a repeated field is a keyed object whose members are its rows, so every row of every
  repeated field on the path is read, and every row value of the named field when it is itself
  repeated. Data of another shape at a step, and a missing value, hold no ids. A string, a number or
  a boolean whose canonical text is not empty after trimming is an id; an empty value, an array and
  an object are not ids. A field hidden by `design.show` keeps its values (CUVR-017), so they are
  ids as well.
- **CUVR-073** **Matching.** A value passes `reference` when it is a member of the ids under the
  [membership](#values) rules of `in` (CUVR-029), the ids being the members of a list: a string
  value is trimmed, a value matches an id with the same canonical text or with an equal numeric
  value, and an array value passes when every element passes. An empty value passes without
  evaluation (CUVR-020). When the data declares no id, every other value fails.

The ids of a declaration path are collected once per validation, whatever number of values
`reference` checks against them.

## Patterns

`pattern` and `match` require the **whole** canonical text of the value to match,
as an HTML `pattern` attribute does. A pattern uses the CRUDUI pattern language,
a regular language that every runtime recognizes and matches itself, with the same
result and a matching time proportional to the value's length times the pattern's size:

- **CUVR-030** Literal: Any Unicode scalar value except `\ ^ $ . | ? * + ( ) [ ] { }`
- **CUVR-031** Escape: `\` followed by one of `^ $ \ . * + ? ( ) [ ] { } | / -`; `\t \n \r \f \v`; `\xHH`; `\u{H…}` (1–6 hexadecimal digits, a scalar value)
- **CUVR-032** Class shorthand: `\d` = `[0-9]`, `\w` = `[0-9A-Za-z_]`, `\s` = whitespace, and `\D \W \S` as their complements
- **CUVR-033** Any character: `.` = any code point except U+000A
- **CUVR-034** Bracket class: `[…]` or `[^…]` with at least one member; members are literals, escapes, `\d`, `\w`, `\s`, properties and ranges `a-z` whose endpoints are single code points in non-descending order; inside a class only `[`, `]`, `\` and a `-` that is neither first nor last are escaped
- **CUVR-035** Unicode property: `\p{X}` or `\P{X}` with a general category (`L Lu Ll Lt Lm Lo M Mn Mc Me N Nd Nl No P Pc Pd Ps Pe Pi Pf Po S Sm Sc Sk So Z Zs Zl Zp C Cc Cf Co`), or `\p{Script=Name}` / `\P{Script=Name}` with a script (the Unicode `Script` property) named in the Unicode data
- **CUVR-036** Group: `(…)`, `(?:…)`, `(?<name>…)` with a unique name matching `[A-Za-z_][A-Za-z0-9_]*`; groups nest at most 100 deep
- **CUVR-037** Quantifier: `*`, `+`, `?`, `{n}`, `{n,}`, `{n,m}` (decimal digits, n ≤ m ≤ 1000) after an atom or group, optionally followed by `?`
- **CUVR-038** Alternation: `|`
- **CUVR-039** Anchor: `^` as the first character and `$` as the last; they add nothing to a whole match

An alternative or a group may be empty, and a pattern may consist of anchors alone; only the
empty pattern is rejected. A lazy quantifier matches the same values as its greedy form, because
only the whole value is matched. `C` is `Cc`, `Cf`, `Co`, the surrogates and the unassigned code
points; a property's complement contains every code point outside it.

- **CUVR-040** **Size.** The size of a pattern is at most 1000. An atom (a literal, an escape, a shorthand, `.`,
  a class or a property) has size 1; a sequence or an alternation has the sum of its parts' sizes;
  a quantified item has its item's size times its maximum, or times its minimum plus one when it is
  unbounded (`*` and `+` count 1 and 2 times).

Anything else is outside the language, including backreferences, lookaround,
inline flags, case-insensitive matching, word boundaries, POSIX classes, possessive
or repeated quantifiers, `\uHHHH`, octal and control escapes, and the empty pattern.
Delimiters have no meaning: `/x/i` matches the text `/x/i`. A pattern parameter is
a string, `false` or `null`.

## Parameter errors

A parameter outside these definitions is a load failure, and so is a rule name that is not a
registered rule. Rule names and parameters are checked after composition and the forbidden-key
scan, fields in declaration order, each field's `validate` rules in declaration order (a rule's
name before its parameter) and then its `messages` keys in declaration order, all before the
fields it contains, and the first failure is reported. A `messages` key names the rule whose
message it overrides; it may name a registered rule the field does not declare, such as the
implicit `number` check. Names are checked for hidden fields and fields without data too. Its location
is the field's declaration path: the property names from the root joined with `.`,
without row keys. Every runtime reports the same code and message:

- **CUVR-041** `validate` or `messages` key that is not a registered rule — Code: `UNKNOWN_RULE`; Message: `Unknown rule: {name}`
- **CUVR-094** `validate` that is neither an object nor `false`, which turns the field's rules off, checked before its rules — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid validate at {path}: expected an object`. A field's rules are never skipped because their member has another type.
- **CUVR-089** `messages` that is not an object, or a `messages` member whose value is not a string, checked after the member's key — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid messages.{rule} at {path}: expected a string` (`Invalid messages at {path}: expected an object` for the whole member). A message is never skipped: an override that is not text would fall back to the default without a sign.
- **CUVR-042** `minlength`, `maxlength` limit — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid {rule} parameter: expected an integer from 0 to 9007199254740991`
- **CUVR-043** `rangelength` limits — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum`
- **CUVR-044** `number`, `digits` limit — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid {rule} parameter: expected true or false`
- **CUVR-045** `min`, `max` limit — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid {rule} parameter: expected a finite number`
- **CUVR-046** `range` limits — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum`
- **CUVR-047** `step` — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid step parameter: expected a finite number above 0`
- **CUVR-048** `mincount`, `maxcount` limit — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid {rule} parameter: expected an integer from 0 to 9007199254740991`
- **CUVR-049** `in` members of another type — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid in parameter: expected a list, a comma-separated string or a map`
- **CUVR-050** `in` choice list with another member, a group without choices, a `value` that is not a string or finite number, or two values with the same canonical text — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid in parameter: expected value and label pairs with distinct string or number values`
- **CUVR-051** `in` member that is not a string, number or boolean — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid in parameter: members must be strings, numbers or booleans`
- **CUVR-052** `in` with an empty member — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid in parameter: members must not be empty`
- **CUVR-053** `pattern`, `match` of another type — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid {rule} parameter: expected a pattern string`
- **CUVR-054** `equalTo`, `enddate` that is not a string — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid {rule} parameter: expected a field reference string`
- **CUVR-076** `containedIn` that is not a string — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid containedIn parameter: expected a field reference string`
- **CUVR-078** `typeFrom` that is not a string — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid typeFrom parameter: expected a field reference string`
- **CUVR-081** `minFrom`, `maxFrom` that is not a string — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid {rule} parameter: expected a field reference string`
- **CUVR-055** `notEqual` that is not a string, number or boolean — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid notEqual parameter: expected a string, number or boolean`
- **CUVR-095** `accept` that is neither a string nor a list of strings — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid accept parameter: expected a string or a list of strings`. The rule is never skipped because its parameter has another type.
- **CUVR-056** `unique` that is not a boolean or a string — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid unique parameter: expected true, false or a string`
- **CUVR-074** `reference` that is not a string, or a string that is not the declaration path of a field of the form whose type is not `group` and whose `lang` is absent, `false` or `null` — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid reference parameter: expected the declaration path of a field`
- **CUVR-057** `pattern`, `match` outside the language — Code: `INVALID_RULE_PATTERN`; Message: `Invalid {rule} pattern: {reason} at {offset}`
- **CUVR-068** `conditionTree` other than `true`, `false`, `null` and `judge` — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid conditionTree parameter: expected true, false or judge`
- **CUVR-061** A [group source](schema.md#choices-from-a-repeated-group) that breaks its rules, checked in the order that compilation checks it and before the field's `validate` rules — Code: `INVALID_RULE_PARAMETER`; Message: the message of compilation (CUSC-064 to CUSC-068), whose `{path}` is the field's declaration path
- **CUVR-086** A `choices` of a group source that breaks its rules (CUSC-089), checked after the rest of the group source — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid items.choices at {path}: expected value and label pairs with distinct string or number values`, whose `{path}` is the field's declaration path

The pattern `{reason}` is one of `empty pattern`, `unexpected character`,
`unsupported construct`, `invalid escape`, `invalid class`, `invalid range`,
`invalid property`, `invalid quantifier`, `unterminated group`,
`unterminated class`, `invalid group name`, `duplicate group name`, `nesting too deep` and
`pattern too large`. An escape
not listed in the language is an `invalid escape`, and a `(?` group other than
`(?:` and `(?<name>` is an `unsupported construct`. `{offset}` is the code-point
index where the invalid construct starts (the backslash of an escape, the `(` of a
group, the `[` of a class, the first character of a quantifier or range); for an
unterminated group or class it is the length of the pattern. A quantifier character
(`* + ? {`) that does not follow an atom or group, a bound above 1000 and a minimum above the
maximum are an `invalid quantifier`. Inside a bracket class, `\D`, `\W` and `\S`, an empty
class, a nested `[` and an unescaped `-` that is neither first, last nor a range operator are an
`invalid class` at the `[`; a class is read left to right, so such a member is reported when
it is read, even where it would end a range; a range endpoint that is a set rather than a single
code point, and a descending range, are an `invalid range` at the first
endpoint; an escape or property inside a class keeps its own reason at its backslash. A `(?<`
group that is not a lookbehind (`(?<=`, `(?<!`) and has no valid name closed by `>` is an
`invalid group name` at the `(`. `^` or `$`
anywhere but the first or last character (a pattern of one `^` or `$` is an anchor) and a
surrogate code point are an `unexpected character`. The group that opens the 101st nesting level
is `nesting too deep` at its `(`. A pattern whose size exceeds 1000 is `pattern too large` at 0,
checked after the rest of the pattern is valid.

Parameters are checked when the specification loads, including every literal a condition map or
a ternary can select, whether or not it is selected. A string that is not a valid [expression](expressions.md) is a literal.
Only a value computed from the data is checked when it is selected: the result of a plain condition
expression (`false` disables the rule, `true` is checked as the parameter) and a ternary branch
that is a path or a condition, which happens before the empty-value skip. A runtime
never skips a pattern rule and never warns. It does not hand patterns to a regular-expression
engine: it recognizes the pattern with this grammar and matches it with its own linear-time
matcher over the Unicode data.

Repeated scalar fields apply `required`, `unique`, `mincount` and `maxcount` to
the collection and other rules to each element. Nested repeated groups retain
their row keys in error paths. The [form runtime](form-runtime.md) defines row
identity and order.

`unique` compares values as `equalTo` does. A string equals only a string with the same code
points, a number only the same number, and a boolean or `null` only itself; a value never equals
a value of another type, so `1` differs from `"1"`. A list equals a list of the same values in the
same order, and an object equals an object with the same member names and values in any member
order, such as a language value. An empty value (empty after White_Space trimming) takes no part.
On a repeated field the collection fails when two values are the same; on a field inside a
repeated group each row fails whose value is the same as that of an earlier row, and a filter
condition is evaluated once per row. The check takes time linear in the number of values.

## Data limits

The form root may bound the data it accepts with `dataLimits` ([schema](schema.md), CUSC-087), read
from the given specification as `buttons` and `action` are. A breach is an input failure of the
request, never a field error.

- **CUVR-082** After the rule names and parameters are checked and before any rule runs, validation
  measures the data as the [value limits](input-text.md#value-limits) measure a value: its levels as
  CUIT-022 counts them and its nodes as CUIT-021 counts them. Data that nests more levels than
  `depth` fails; otherwise data that holds more nodes than `values` fails. The failure has code
  `INVALID_FORM_INPUT`, message `Submitted data exceeds the {limit} limit of {n}`, where `{limit}` is
  `depth` or `values` and `{n}` is that limit, and an empty location.
- **CUVR-083** A missing `dataLimits`, or a missing member of it, takes the default: `depth` 64 and
  `values` 100000.
- **CUVR-084** A `dataLimits` that is not an object, that has a member other than `depth` and
  `values`, whose `depth` is not an integer from 1 to 256 or whose `values` is not an integer from 1
  to 1000000 fails the load after the forbidden-key scan and before the rule names and parameters
  are checked — Code: `INVALID_RULE_PARAMETER`; Message: `Invalid dataLimits parameter: expected depth from 1 to 256 and values from 1 to 1000000`; location: the empty path.

## Conditional parameters

```yaml
type: group
properties:
  email:
    type: email
    validate:
      required: ".enabled"
      email: true
  amount:
    type: text
    validate:
      min: ".premium ? 10 : 1"
```

Conditional parameters use the [expression contract](expressions.md). A condition
map selects the first matching value, or its `true` default. Ternary expressions
return the selected branch value.

`equalTo`, `notEqual`, `unique`, `enddate`, `accept`, `match`, `pattern`, `in` and `conditionTree`
`equalTo`, `notEqual`, `unique`, `enddate`, `reference`, `accept`, `match`, `pattern` and `in`
receive parameters unchanged for their own processing. In particular,
`enddate: period.start` references a field; it is not a boolean condition.
An object or a list given to `equalTo`, `notEqual`, `unique`, `enddate` or `reference` is therefore
not a condition map but a [parameter error](#parameter-errors).
For `enddate`, `.start` resolves a sibling field and `..start` resolves one
group level above, using the common field-reference resolver.
Membership maps are value sets, not condition maps. The parameter `judge` of `conditionTree` is a
literal, not a path, and an object given to `conditionTree` is a parameter error.

`design.show` decides whether a field's rules run; see [visibility](#evaluation). A condition in
`validate.required` makes a visible field optional.

## Errors and verification

- **CUVR-088** `validate(spec, data)` reads a specification that is an object. Another specification,
  such as a list, a string or a number, fails after the root data check and before composition with
  an input failure: code `INVALID_FORM_INPUT`, message `Form specification must be an object` and an
  empty location. A specification is never read as a form without fields.

Each error contains the field path, field name, failing rule, message and value
when available. Custom messages use the declared rule name, including the
distinction between `match` and `pattern`. Defaults are defined by the rule
implementations. The [fixture contract](../operations/test-fixtures.md) defines expected
results and failure records.

Run all four validator package suites using the [testing procedure](../operations/testing.md).
Record actual results in [feature status](../features.md); a rule name appearing
in every registry does not prove all inputs behave identically.
