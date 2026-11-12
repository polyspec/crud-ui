# Display formats
<!-- doc-id: docs-spec-display-formats -->

[한국어](display-formats.ko.md).

Lists and details show record values; they do not edit them. A list column or a detail field
declares how its value is displayed with `format`. This page defines every declarable format,
the input a list or detail accepts and the markup it writes. Every runtime (JavaScript, the HTML
renderer, PHP, the PHP extension, Go and Rust) follows these rules exactly; the shared
[list](../../tests/fixtures/list-render/README.md) and
[detail](../../tests/fixtures/detail-render/README.md) fixtures check each rule in every runtime.
A display format that is not defined here is not part of the contract.

## How a value is displayed

1. **CUDF-001** The column or field `field` path (for example `name` or `company.name`) reads the value from
   the row or record. The model keeps it as `value`; a path the record does not have is `null`.
2. **CUDF-002** `format` turns the value into the `display` model: a string, or a structured value for
   `badge`, `link`, `bool`, `image` and `html`.
3. **CUDF-003** A renderer writes markup from `display` only. It does not read the record again.

A format is declarative data. There is no formatting callback, because a function written in one
language cannot run identically in the others. A value that needs other logic is computed
beforehand and supplied in the record; markup that is already produced uses
the `html` format.

```yaml
columns:
  name:   { field: name, label: { ko: 이름, en: Name }, format: { type: link, href: /users/{=id} } }
  score:  { field: score, format: { type: number, decimals: 2, thousands: true, prefix: { en: '$' } } }
  joined: { field: joined, format: { type: date, pattern: YYYY-MM-DD } }
  status: { field: status, format: { type: badge, map: { active: success, blocked: danger } } }
```

`field` and `sort.field` are dot-separated data paths without a leading dot. A display token uses
the `{=path}` form. This single path model reads object members and associative-array keys in the
same way; the `=` identifies a display substitution and prevents dots in literal URLs and file
extensions from being interpreted as paths.

## Declaring a format

- **CUDF-004** absent, `true` or `false`: `text`
- **CUDF-005** a string, such as `date`: that type with no settings
- **CUDF-006** an object: its `type` (`text` when absent or empty) with the object's settings

Any other value, `null` included, fails as the [declarations](#declarations) define.

A type that is not in the table below displays the value as `text` and keeps the declared type
name in the cell class.

Values are read as text in this way: `null` or an absent value is empty, `true` is `1`, `false` is
empty, an object or array is empty, and a number uses the shortest decimal representation.

Settings that accept content (`prefix`, `suffix`, `text`, `true`, `false`, `alt` and badge or
choice labels) accept a string or a language map such as `{ ko: 이름, en: Name }`, resolved to the
display language by the [content rule](schema.md#fields): a language map uses its first non-empty
string entry for the language, `en`, `ko` and its first key, and any other value, a number
included, is empty text.

## Formats

- **CUDF-007** `text` — Settings: `truncate`; Display: The value as text.
- **CUDF-008** `date` — Settings: `pattern`; Display: The value formatted as a UTC date.
- **CUDF-009** `number` — Settings: `decimals`, `thousands`, `prefix`, `suffix`; Display: The value formatted as a number.
- **CUDF-010** `badge` — Settings: `map`; Display: A badge with a variant and a label.
- **CUDF-011** `link` — Settings: `href`, `target`, `text`; Display: A link.
- **CUDF-012** `choice-label` — Settings: `items`; Display: The label of the value.
- **CUDF-013** `bool` — Settings: `true`, `false`, `as`; Display: A true or false label.
- **CUDF-014** `image` — Settings: `width`, `height`, `alt`; Display: An image of the value.
- **CUDF-015** `html` — Settings: none; Display: The value as unescaped markup.

### text

`truncate` limits the displayed length. Only a number applies, and its integer part is the limit.
When the limit is at least 1 and the text has more Unicode code points than the limit, the first
code points up to the limit are kept and `…` (U+2026) is appended. A character is never split. A
limit that is absent, not a number (a numeric string included) or below 1 displays the whole
text.

### date

The value is parsed with the [date value rules](form-runtime.md#date-values) and shown in UTC.
`pattern` replaces the tokens `YYYY` (year), `MM` (month), `DD` (day), `HH` (hour, 24-hour),
`mm` (minute) and `ss` (second); other characters are kept.

- **CUDF-090** A date format without a nonempty `pattern` takes the pattern `YYYY-MM-DD`.
- **CUDF-091** `validateList` and `validateDetail` check the specification against CUDF-024 and CUDF-032 before its
  composition: a list or detail specification that is not an object fails with `INVALID_FORM_INPUT` and the message of
  that rule, and is never passed as a declaration without members.

A value that is not a supported date is displayed unchanged.

### number

A number value is used as is; a string is converted with the JavaScript `Number` rules, so
surrounding whitespace is ignored and `0x`, `0b` and `0o` prefixes are read. A value that does not
convert to a finite number is displayed unchanged.

- **CUDF-016** `decimals` fixes the number of decimal places. It must be a number; a fractional count is
  truncated toward zero, and the result must be between 0 and 100, otherwise the list or detail
  fails with `Number decimals must be between 0 and 100`. The exact binary value is rounded to the
  nearest representation with ties away from zero, so `2.5` is `3`, `-2.5` is `-3` and `1.005`
  with two decimals is `1.00`. A `decimals` value that is not a number is ignored.
- **CUDF-017** Without `decimals`, the shortest decimal representation is used; very large or very small
  values use exponent notation, such as `1e+21` and `1e-7`.
- **CUDF-018** `thousands: true` groups the integer digits with `,`.
- **CUDF-019** `prefix` and `suffix` are written before and after the number.

### badge

`map` maps a value to a variant. For a string variant, the badge has that variant and the value
is the label. For a language map, the translated text is both the variant and the label. A value
that `map` does not contain produces a badge without a variant, labelled with the value.

### link

- **CUDF-020** `href` is a string or a condition map resolved with the [expression rules](expressions.md).
  Each explicit `{=path}` token in `href` is replaced with the record value at that path; `{=field}` is the
  cell value, and a path the record does not have is replaced with the cell value. Text outside braces is literal.
- **CUDF-021** `text` is the link text. When `text` is absent, `null` or empty, the cell value is the text.
- **CUDF-022** `target` is written when it is a non-empty string.
- **CUDF-023** A `javascript:` URL is replaced with a URL that throws, as React's server rendering does.

### choice-label

`items` is a map from value to label, an array whose indexes are the values or a
[choice list](schema.md#choice-lists). The label of the value is displayed; in a choice list it is
the label of the pair whose `value` has the canonical text of the value. A dynamic source (`{ model: … }`) is not read by the renderer, and a value
without a label is displayed unchanged.

### bool

The value is false when it is `false`, `0`, `null`, absent, the empty string, `"0"` or `"false"`,
and true otherwise. `true` and `false` are the labels for each state; without a label the text is
`true` or `false`. `as` selects `text` (the default), `icon` or `check`.

### image

The value is the image source. `alt` is translated and explicit `{=path}` tokens in it are replaced as in a
link; without `alt` the alternative text is empty. A declared `width` or `height` is written as
text, and a declared `null` writes an empty attribute. An image with a non-empty source that does
not start with `data:` also adds a preload link; see [Markup](#markup).

### html

The value is written as markup without escaping; the renderer does not check the safety of
that markup.

## Input

A list receives a specification, rows and options; a detail receives a specification, one record
and options. Invalid input fails with code `INVALID_FORM_INPUT`, the message below and an empty
location. In PHP the caller states an object with a `stdClass` or an associative array: a list array,
the empty array included, is no object ([CURP-026](runtime-packages.md)), and a value of any other type
fails with the message of its rule.

- **CUDF-024** list specification — Rule: an object; Message: `List specification must be an object`
- **CUDF-025** list rows — Rule: an array; Message: `List rows must be an array`
- **CUDF-026** each list row — Rule: an object; Message: `List rows must be objects`
- **CUDF-027** list specification — Rule: declares `columns`; Message: `List specification must declare columns`
- **CUDF-028** list `data` option — Rule: an object; Message: `List context must be an object`
- **CUDF-029** list `page` option — Rule: an integer from 1 to 9007199254740991; Message: `List page must be a positive integer`
- **CUDF-030** list `total` option — Rule: an integer from 0 to 9007199254740991; Message: `List total must be a nonnegative integer`
- **CUDF-031** list `layout` option — Rule: `table` or `card`; Message: `List layout must be table or card`
- **CUDF-032** detail specification — Rule: an object; Message: `Detail specification must be an object`
- **CUDF-033** detail record — Rule: an object; Message: `Detail record must be an object`
- **CUDF-034** detail specification — Rule: declares `fields`; Message: `Detail specification must declare fields`
- **CUDF-035** detail `data` option — Rule: an object; Message: `Detail context must be an object`

A detail takes the `data`, `language`, `files` and `basepath` options. It neither checks nor uses
the list-only `page`, `total` and `layout` options.
`buildList` does not read `layout`; `renderList` checks it after the other list input rules and
before composition.

The rules check argument shapes in argument order first, then the declaration, then options.
An option that is absent or `null` uses its default: an empty context, no current page, no total
and the `table` layout. `page` is the current page and `total` the total record count; the caller
supplies both, the generator derives neither from the rows, and a list whose specification
enables `pagination` writes them as `data-page` and `data-total`. It also emits previous,
numbered and next buttons; the resolved page defaults to 1 and the current button carries
`aria-current="page"` and `disabled`. The resolved pagination model lists these buttons in
`buttons`, each with its `role` (`previous`, `page` or `next`), `page`, `label`, `current` and
`disabled`. A renderer chooses a button's text by its role — `‹`, the page number, `›` — and
writes `label` as its `aria-label`. The labels come from the `list` table of the
[interface messages](form-markup.md#interface-messages) (`previousPage`, `nextPage`, and `page`
with `{page}` replaced by the page number) for the display language, or the English entry when
the table has no entry for that language. A list with no rows shows its declared `empty` text; an
absent or null `empty` shows the table's `emptyList` for the display language, chosen the same
way. The upper bound is the largest
integer every runtime represents exactly; an integral value such as `2.0` is the integer `2`. When several inputs are invalid, the first failing rule in the table order is
reported. The Go and Rust library signatures take rows as a sequence, so in those languages the
rows rule applies where decoded JSON becomes that sequence; every other rule is checked by the
library.

### Declarations

A renderer composes the `columns` map of a list or the `fields` map of a detail, and the `search`
declaration of a list when it holds `$ref` or `$patch`, as `validateList` and `validateDetail` do.
It does not compose the specification root. Before composition, `columns` must be an object
(`Invalid columns at list: expected an object`) and `fields` must be an object
(`Invalid fields at detail: expected an object`). A composition failure is a load error with its
code and location. After composition the renderer scans the composed specification for forbidden
keys with the validator scan and fails with the load error `FORBIDDEN_META_KEY` at the key's path,
as the validators do.

The declarations are then checked. The first failing rule fails with `INVALID_FORM_INPUT`, the
message below and an empty location. An unknown key fails with `Invalid {key} at {path}: unknown key`
and a value of the wrong type with `Invalid {key} at {path}: expected {expected}`. The checks run in
this order:

1. **CUDF-036** The root members in member order.
2. **CUDF-037** The own `design`, at path `list` or `detail`.
3. **CUDF-038** Each column or field in [member order](schema.md#member-order): its type, its unknown keys in
   member order, then `field`, `label`, `format`, `design` and `sortable`, at path
   `columns.{name}` or `fields.{name}`.
4. **CUDF-039** For a list: `search`, `sort`, `actions` (each action in member order, at path
   `actions.{name}`), `empty`, `description` and `pagination`, at path `list`. For a detail:
   `actions` (each action in member order, at path `actions.{name}`), at path `detail`.

`design` follows the [form declaration rules](schema.md#fields) exactly. Content is a string, a
language map (an object with at least one member, each a string or `null`) or `null`. A condition
map is an object with at least one member.

- **CUDF-040** a list root member — Accepted value: `columns`, `search`, `sort`, `pagination`, `actions`, `empty`, `description` or `design`; Failure message: `Invalid {key} at list: unknown key`
- **CUDF-041** a detail root member — Accepted value: `fields`, `actions` or `design`; Failure message: `Invalid {key} at detail: unknown key`
- **CUDF-042** a root `$ref` or `$patch` — Accepted value: none: composition belongs in `columns` or `fields`; Failure message: `Invalid $ref at list: expected composition inside columns`, `Invalid $patch at detail: expected composition inside fields`
- **CUDF-043** a column or field — Accepted value: an object; Failure message: `Invalid {name} at columns: expected an object`, `Invalid {name} at fields: expected an object`
- **CUDF-044** a column member — Accepted value: `field`, `label`, `format`, `design` or `sortable`; Failure message: `Invalid {key} at columns.{name}: unknown key`
- **CUDF-045** a field member — Accepted value: `field`, `label`, `format` or `design`; Failure message: `Invalid {key} at fields.{name}: unknown key`
- **CUDF-046** `field` — Accepted value: a string; Failure message: `Invalid field at {path}: expected a string`
- **CUDF-047** `label` — Accepted value: content; Failure message: `Invalid label at {path}: expected a string, a language map or null`
- **CUDF-048** `format` — Accepted value: a boolean, a string or an object; Failure message: `Invalid format at {path}: expected a boolean, a string or an object`
- **CUDF-049** `format.type`, `format.pattern`, `format.target`, `format.as` — Accepted value: a string; Failure message: `Invalid format.{key} at {path}: expected a string`
- **CUDF-050** `format.prefix`, `format.suffix`, `format.text`, `format.true`, `format.false`, `format.alt` — Accepted value: content; Failure message: `Invalid format.{key} at {path}: expected a string, a language map or null`
- **CUDF-051** `format.map` — Accepted value: an object; Failure message: `Invalid format.map at {path}: expected an object`
- **CUDF-052** each `format.map` label — Accepted value: content; Failure message: `Invalid format.map.{value} at {path}: expected a string, a language map or null`
- **CUDF-053** `format.href` — Accepted value: a string or a condition map; Failure message: `Invalid format.href at {path}: expected a string or a condition map`
- **CUDF-054** `format.items` — Accepted value: an array or an object; Failure message: `Invalid format.items at {path}: expected an array or an object`
- **CUDF-055** a `format.items` choice list — Accepted value: pairs as in [choice lists](schema.md#choice-lists); Failure message: `Invalid format.items at {path}: expected value and label pairs with distinct string or number values`
- **CUDF-056** `sortable` — Accepted value: a boolean, an expression or a condition map; Failure message: `Invalid sortable at {path}: expected a boolean, an expression or a condition map`
- **CUDF-057** `search` — Accepted value: a boolean or an object; Failure message: `Invalid search at list: expected a boolean or an object`
- **CUDF-058** `sort` — Accepted value: an object; Failure message: `Invalid sort at list: expected an object`
- **CUDF-059** a `sort` member — Accepted value: `field` or `dir`; Failure message: `Invalid sort.{key} at list: unknown key`
- **CUDF-060** `sort.field` — Accepted value: a string; Failure message: `Invalid sort.field at list: expected a string`
- **CUDF-061** `sort.dir` — Accepted value: `asc` or `desc`; Failure message: `Invalid sort.dir at list: expected asc or desc`
- **CUDF-062** `actions` — Accepted value: an object; Failure message: `Invalid actions at list: expected an object`, `Invalid actions at detail: expected an object`
- **CUDF-063** an action named `$ref` or `$patch` — Accepted value: none: actions are not composed; Failure message: `Invalid $ref at actions: unknown key`
- **CUDF-064** an action — Accepted value: a script string or an object; Failure message: `Invalid {name} at actions: expected a script or an object`
- **CUDF-065** a member of an action with `script` — Accepted value: `label` or `script`; Failure message: `Invalid {key} at actions.{name}: unknown key`
- **CUDF-066** a member of another action object — Accepted value: `label`, `format`, `behavior` or `design`; Failure message: `Invalid {key} at actions.{name}: unknown key`
- **CUDF-067** action `script` — Accepted value: a string; Failure message: `Invalid script at actions.{name}: expected a string`
- **CUDF-068** action `label` — Accepted value: content; Failure message: `Invalid label at actions.{name}: expected a string, a language map or null`
- **CUDF-069** action `format` — Accepted value: the `format` rules above; Failure message: `Invalid format at actions.{name}: …`
- **CUDF-070** action `behavior` — Accepted value: a boolean or an object; Failure message: `Invalid behavior at actions.{name}: expected a boolean or an object`
- **CUDF-071** a `behavior` member — Accepted value: `onchange`, `onclick` or `onload`; Failure message: `Invalid behavior.{key} at actions.{name}: unknown key`
- **CUDF-072** a `behavior` entry — Accepted value: a script string or an object; Failure message: `Invalid behavior.{event} at actions.{name}: expected a script or an object`
- **CUDF-073** a `behavior` entry member — Accepted value: `label` or `script`; Failure message: `Invalid behavior.{event}.{key} at actions.{name}: unknown key`
- **CUDF-074** a `behavior` entry `label` — Accepted value: content; Failure message: `Invalid behavior.{event}.label at actions.{name}: expected a string, a language map or null`
- **CUDF-075** a `behavior` entry `script` — Accepted value: a string; Failure message: `Invalid behavior.{event}.script at actions.{name}: expected a string`
- **CUDF-076** action `design` — Accepted value: the `design` rules; Failure message: `Invalid design… at actions.{name}: …`
- **CUDF-077** `empty` — Accepted value: content; Failure message: `Invalid empty at list: expected a string, a language map or null`
- **CUDF-078** `description` — Accepted value: content; Failure message: `Invalid description at list: expected a string, a language map or null`

Other `format` settings (`truncate`, `decimals`, `thousands`, `width`, `height` and settings that
the table does not name) accept any value; the forbidden-key scan still applies to their keys.
The members of a `search` object are form declarations: the list model does not use them, and
[form compilation](schema.md#fields) and the meta-schema check them.

An action with `script` is a script action, as a script string is: its model is
`{ key, label, behavior: { onclick: script } }`, with `label` translated or the action name when
`label` is absent. A script action is a button, and a button fires `click`, so its script runs
when the button is clicked. Another action object has the model `{ key, label, format?, behavior? }`, whose
`behavior` maps each declared `behavior` member name to its script string or to the `script` of
its object entry, in member order; it is absent when no entry has a script. A `behavior` key of
the model is the event attribute name.

A detail declares `actions` with the same rules, paths and messages as a list, with `detail`
where a list message has `list` (`Invalid actions at detail: expected an object`), and resolves
each action to the same model.

`pagination` is checked last, at path `list`:

- **CUDF-079** `pagination` — Accepted value: a boolean or an object; Failure message: `Invalid pagination at list: expected a boolean or an object`
- **CUDF-080** a member of the object — Accepted value: `per_page` or `mode`; Failure message: `Invalid pagination.{key} at list: unknown key`
- **CUDF-081** `per_page` — Accepted value: an integer from 1 to 9007199254740991; Failure message: `Invalid pagination.per_page at list: expected a positive integer`
- **CUDF-082** `mode` — Accepted value: `pages`, `offset`, `cursor` or `none`; Failure message: `Invalid pagination.mode at list: expected pages, offset, cursor or none`

The resolved pagination model has its members in this order: `enabled`; for enabled paging
`perPage`, `mode` and `page` (CUDF-089); the supplied `total`;
and for enabled paging `pageCount`. Disabled paging keeps only the supplied `page` and `total`.

- **CUDF-089** Enabled paging without `per_page` takes `perPage` 20, without `mode` the mode `pages`, and without a
  supplied page the page 1; without a supplied total `pageCount` is 0.

The page-number window holds every page up to seven pages, and otherwise the first, previous,
current, next and last page. Without a total the current page is 1; a page after the last page
selects the last page.

In PHP, the [PHP API contract](../operations/php-extension.md) decides which PHP values are objects: an empty
PHP array is accepted for a root object argument and for the fixed object options `data` and
`files`, while nested values keep their type.

## Markup

- **CUDF-083** text, date, number, choice-label — List table cell: escaped text in `crudui-list__cell crudui-value crudui-value--TYPE`; Detail value: escaped text in `crudui-detail__value crudui-value crudui-value--TYPE`
- **CUDF-084** badge — List table cell: `span.crudui-badge` with optional `data-crudui-variant`; Detail value: the same inside the `dd`
- **CUDF-085** link — List table cell: `a` with `href` and optional `target`; Detail value: the same inside the `dd`
- **CUDF-086** bool — List table cell: `span.crudui-bool crudui-bool--text`, `--icon` or `--check`, with `data-crudui-state` and the applicable `aria-label`; Detail value: the same inside the `dd`
- **CUDF-087** image — List table cell: `img` with `src`, `alt`, and declared `width` and `height`; Detail value: the same inside the `dd`
- **CUDF-088** html — List table cell: the markup, unescaped; Detail value: the same inside the `dd`

A detail is a `dl.crudui-detail` with one `div.crudui-detail__field` per field, each holding
`dt.crudui-detail__label` and the value. A list root is `crudui-list`; its description, table,
headings, cells, cards, empty state, actions and pagination use the corresponding
`crudui-list__*` elements. The string renderers write the image preload links
`<link rel="preload" as="image" href="…"/>` before the list or detail, in first-use order and
without duplicates.

A list whose translated `description` is not empty writes it as escaped text in
`<p class="crudui-list__description">` as the first child of `crudui-list`, before
`crudui-list__actions`. An empty description writes nothing.

A list with actions writes `<div class="crudui-list__actions">` with one
`<span class="crudui-list__action" data-action="{key}">` per action in member order, holding an
`a` element for an action whose format type is `link` and a `<button type="button">` for any
other action. That element has one attribute per `behavior` key of the action model, named by the
key and holding the script: a script action writes `onclick`, and a declared
`behavior.onload` writes `onload`. A detail with actions writes `<div class="crudui-detail__actions">` holding one
`<span class="crudui-detail__action" data-action="{key}">` per action with the same inner `a` or
`button` element that a list action writes, before the `dl.crudui-detail` element and after the
image preload links of the string renderers. A detail without actions writes only the preload links and the
`dl.crudui-detail` element.
