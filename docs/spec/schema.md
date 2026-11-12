# Specification structure
<!-- doc-id: docs-spec-schema -->

[한국어](schema.ko.md). This document defines field and list declarations.
Form instances, repeated row keys and caching are defined in
[form runtime](form-runtime.md). Implementation and deployment status are
recorded in [features](../features.md).

## Package API

CRUDUI starts at package version `0.0.1`. File names, public APIs and internal
identifiers describe their roles without implementation-generation markers.
Package roots expose the current validator and form renderers, including the
framework-independent `@polyspec/crudui-generator-html` renderer. Replaced versioned
paths have no compatibility aliases.

The machine-readable contract is maintained in
[`contracts/schema/crudui.schema.json`](../../contracts/schema/crudui.schema.json). It validates
form, list and detail declaration shapes. `make docs-schema` checks this source against
shared fixtures without generating or replacing its rules.

## Member order

A specification is JSON data. JavaScript receives it as plain objects, which list member names
that are array indexes (the decimal integers from 0 to 4294967294 written without leading zeros)
first in ascending numeric order and all other names in the order they were written. Every
runtime uses this order for every object in a specification: fields in `properties`, list columns,
detail fields, `items` value-to-label maps, the keys of every bucket, condition maps, composition files and
the objects composition produces, and compiled templates. "Declaration order" in these documents
means this order. For example, `properties` written as `b`, `10`, `a` compile, render and validate
in the order `10`, `b`, `a` in every runtime.

Arrays keep their written order; a [choice list](#choice-lists) declares choices whose values
are integer-like in their written order.

Record data keeps the order in which it arrives: form data, list rows, detail records and
`options.data` are never reordered, and [ordered JSON](../operations/ordered-json.md) preserves
numeric member names there.

## Fields

A form root is a `group` with a `properties` field map. Property names define
data paths. A field separates structure, content and behavior as follows:

- **CUSC-001** Structure — Keys: `type`, `name`, `default`, `properties`, `items`, `multiple`, `lang`; Contract: Define values, nested groups, choices and repetition.
- **CUSC-002** Content — Keys: `label`, `description`, `placeholder`, `prepend`, `append`, `help`, `content`; Contract: Accept text or a language map. `content` is the control text of a button or action field.
- **CUSC-003** Validation — Keys: `validate`, `messages`; Contract: `validate` defines rules; `messages` overrides a rule's error message by rule name.
- **CUSC-004** Appearance — Keys: `design`; Contract: Define visibility and styles for specific DOM nodes.
- **CUSC-005** Behavior — Keys: `behavior`; Contract: Preserve event scripts without expression evaluation.
- **CUSC-006** Type options — Keys: `options`; Contract: Store settings that apply to one widget type.
- **CUSC-007** Composition — Keys: `$ref`, `$patch`; Contract: Load, merge and modify field definitions before binding data.

Content is resolved to text for the display language in the same way in every runtime, for form
fields and for list and detail display settings alike. A string is itself. A language map yields
the first non-empty string among its entry for the display language, `en`, `ko` and its first key;
entries that are not strings are skipped. Any other value (a number, a boolean, an array, or a map
without such an entry) is empty text.

Dependent settings remain under their subject: repeated row settings under
`multiple`, language input settings under `lang`, widget settings under `options`
and dynamic choice descriptors under `items`. Role and structural settings can
use `false`, `true` or an object where the type definition permits them. `false`
disables a setting; `true` selects defaults. The
[TypeScript types](../../packages/validator/ts/src/schema.ts) define accepted
declaration shapes. Parsers preserve declared keys; validators reject forbidden
schema keys instead of silently discarding them.

```yaml
type: group
properties:
  email:
    type: email
    label: { en: Email, ko: 이메일 }
    validate: { required: true, email: true }
    design:
      show: ".enabled"
      class: { ".priority == 'high'": text-danger, true: "" }
```

### Range fields

A `range` field holds one number chosen on a slider. Its bounds and its increment are its
validation rules: `validate.range` is `[minimum, maximum]` and `validate.step` is the increment.
Both are required and both are literal values, not expressions or condition maps. The slider
moves from the minimum in steps, so the minimum is a multiple of the step and every position of
the slider passes both rules. Every validator checks the submitted value with these rules
([numbers](validation-rules.md#values)): a value passes when it is numeric, within the bounds and
a multiple of the step, and an empty value passes unless `required` is declared. `append` is the
unit written after the current value. The [form markup](form-markup.md#range-fields) defines the
control.

```yaml
volume:
  type: range
  label: Volume
  default: 50
  append: "%"
  validate: { range: [0, 100], step: 5 }
```

Compilation checks a range field after its `behavior` and fails with `INVALID_FORM_INPUT` and an
empty location. Multiples are decided exactly, as the `step` rule decides them.

- **CUSC-008** `validate.range` absent, or not two finite numbers with the minimum not above the maximum: `Invalid validate.range at {path}: expected [minimum, maximum] finite numbers with minimum not above maximum`
- **CUSC-009** `validate.step` absent, or not a finite number above 0: `Invalid validate.step at {path}: expected a finite number above 0`
- **CUSC-010** A minimum that is not a multiple of the step: `Invalid validate.range at {path}: expected a minimum that is a multiple of validate.step`

### Condition fields

A `condition` field holds one [condition tree](#condition-trees) as its data, and its control edits
the tree as JSON text. Its rule is `validate.conditionTree`, which is required and is the literal
`true` or `judge`, not an expression or a condition map: every value of the field is then checked as
a condition tree, with judged text only under `judge`. A required tree also declares `required`.
The [form markup](form-markup.md#condition-fields) defines the control, and the
[form runtime](form-runtime.md#condition-values) defines how a browser reads its text back into the
tree and how a server reads a submitted tree.

```yaml
pass:
  type: condition
  label: Pass condition
  validate: { required: true, conditionTree: judge }
```

Compilation checks a condition field after its `behavior` and fails with `INVALID_FORM_INPUT` and an
empty location:

- **CUSC-070** `validate.conditionTree` absent, or neither `true` nor `judge`: `Invalid validate.conditionTree at {path}: expected true or judge`

### Structured condition editor

A condition field may declare `design.editor`: `text`, the textarea of the
[form markup](form-markup.md#condition-fields), which is also the editor of a field without the
member, or `structured`, which edits the tree as nested controls
([structured editor](form-markup.md#structured-condition-editor)). A structured field may declare
`options.fields`, the field names that its comparisons choose from; without it the field of a
comparison is typed text.

```yaml
opens_when:
  type: condition
  label: Opens when
  validate: { conditionTree: true }
  design: { editor: structured }
  options: { fields: [episodes.e1.status, clues.size] }
```

Compilation checks these members after `validate.conditionTree` and fails with
`INVALID_FORM_INPUT` and an empty location:

- **CUSC-083** `design.editor` of a field that is not a condition field: `Invalid design.editor at {path}: unknown key`; and of a condition field, a value other than `text` or `structured`: `Invalid design.editor at {path}: expected text or structured`
- **CUSC-084** `options.fields` of a field that is not a structured condition field, or that is not a list of strings that are not empty after trimming and of which no two are equal: `Invalid options.fields at {path}: expected distinct field names of a structured condition editor`

The editor offers what the rule of the field accepts and shows the value without loss:

- **CUSC-085** The editor offers the eight `op` values of CUSC-073 in that order. It offers judged
  text, as a condition to add and as a condition that it shows, only under `conditionTree: judge`.
- **CUSC-086** The editor shows a value as controls when the value is an empty value, which it shows
  as an empty `all` group, or when the value is a condition tree that `conditionTree` of the field
  accepts after every empty `field` and every empty `judge` text is taken as filled, because a
  condition that the editor adds starts empty. It shows no other value as controls and does not
  replace it: the field writes its textarea, visible, with the condition text of the value, and a
  named error that names the rule and the data path of the field (CUMK-068), so the author corrects
  the text; the value stays the data of the field, and `conditionTree` reports it when the form is
  validated.

## Conditions and appearance

Conditions are values in the relevant setting. `design.show` controls visibility;
`design.class` and `design.style` apply to the main node. `design.label`,
`design.wrapper`, `design.group` and `design.prepend` target those nodes.
Condition maps select the value of the first matching expression. The literal key
`true` is the optional default, applied only after every other condition fails,
whatever its position; with no match and no default the result is null
([condition maps](expressions.md#8-condition-maps)). In every conditional
setting, including `design.show`, `design.class` and `design.style`, a string is
an expression only when it parses completely under the
[expression grammar](expressions.md); any other string is a literal, so
`class: "modal fade in show"` is class text. Dedicated conditional
metadata such as `show_if`, `display_switch`
and `display_target` is rejected in CRUDUI schemas.

### Declared attributes

A form field declares attributes of the elements CRUDUI renders for it: `design.attributes` for
its control and `design.wrapper.attributes` for its node root. The
[form markup](form-markup.md#declared-attributes) defines the elements and how renderers write
them. Each is an object of attribute name to string value; a value is literal text, not an
expression or a condition map. A name is `data-` or `aria-` followed by a lowercase letter or a
digit and then lowercase letters, digits, `-`, `_` or `.`. A name that CRUDUI writes on a control
or a node root is refused: `data-field-path`, `data-lang`, every name that starts with
`data-crudui-` or `data-source-`, `data-name`, `data-rule-name`, `data-default`,
`data-is-default`, `data-type`, `data-height`, `data-upload-server`, `data-fileserver`,
`data-server`, `data-max-tags`, `data-keyword-min-length`, `data-delay`, `data-api-server`,
`data-max-width`, `data-min-width`, `data-max-height`, `data-min-height`,
`data-preview-max-width`, `data-preview-max-height` and `data-unsupported-type`.

Only form fields accept attributes. A form button, list or detail design and the `label`,
`group` and `prepend` nodes reject `attributes` as an unknown key. Compilation checks
`design.attributes` after `design.class` and `design.style` and before the design nodes, and
`design.wrapper.attributes` after the wrapper's `class` and `style`. It checks every name in
declaration order and then every value, and fails with `INVALID_FORM_INPUT` and an empty location:

- **CUSC-011** Not an object: `Invalid design.attributes at {path}: expected an object`
- **CUSC-012** A name outside the rule or a refused name: `Invalid design.attributes.{name} at {path}: expected a data-* or aria-* name that crudui does not write`
- **CUSC-013** A value that is not a string: `Invalid design.attributes.{name} at {path}: expected a string`

Under the wrapper the key is `design.wrapper.attributes`.

### Layout

A `group` field declares the layout of the fields inside it with `design.layout`, a literal string,
not an expression or a condition map:

- **CUSC-014** `inline`: every field node inside the group, at any depth, is one row. The label column, whose
  width is `--crudui-label-width`, holds the label; the control column holds the control, the
  description below it and the errors. A field without a label leaves the label column empty, so
  the controls of all rows align. Group, collection and language nodes keep the stacked layout and
  pass the inline layout to the field nodes inside them. The rows of a repeated scalar field and
  the items of a language field are not field nodes and stay stacked.
- **CUSC-015** `line`: the child nodes of the group sit side by side on one line, for example a select followed
  by small buttons. In an inline layout the group is one row: its label is in the label column and
  the line in the control column. The child nodes of a line take no inline layout.
- **CUSC-016** `stacked`: the label above the control, the layout of a form without a declaration. A group
  declares it to end an inline layout it would inherit.

A group without `design.layout` inherits the layout of the enclosing group. A repeated group accepts
`stacked` and `inline`, which apply to the fields of its rows. The [form markup](form-markup.md#layout)
defines the output.

```yaml
appearance:
  type: group
  label: Appearance
  design: { layout: inline }
  properties:
    theme: { type: select, label: Theme, items: { light: Light, dark: Dark }, description: Applies to every window. }
    font:
      type: group
      label: Font
      design: { layout: line }
      properties:
        family: { type: select, items: { mono: Mono, sans: Sans } }
        size: { type: text }
```

Compilation checks `design.layout` after `design.attributes` and before the design nodes, and
fails with `INVALID_FORM_INPUT` and an empty location. The form root takes no layout: compilation
checks its `design.layout` after its `buttons`. The JSON Schema describes a field declaration, so it
checks the root as a group and leaves the root's layout to compilation.

- **CUSC-017** `design.layout` of a field that is not a group, of a form button or of the form root: `Invalid design.layout at {path}: unknown key`, where `{path}` is `form` for the root
- **CUSC-018** A value other than `stacked`, `inline` or `line`: `Invalid design.layout at {path}: expected stacked, inline or line`
- **CUSC-019** `line` on a repeated group: `Invalid design.layout at {path}: expected stacked or inline`

The [expression grammar](expressions.md) defines the tokenizer, parser
and evaluator. Supported expressions include relative paths, wildcards, lists,
comparison, logic, membership and conditional values. Arithmetic, function calls
and JavaScript evaluation are unsupported. Event scripts in `behavior` are opaque
strings; evaluating them is outside the expression engine.

## Condition trees

A condition tree is a JSON value that a field holds as its data: an application writes a
condition in it, such as the condition under which a step of a story opens, and evaluates it
itself. It is data, not a declaration: CRUDUI does not evaluate it, and it is separate from the
expressions and condition maps of the settings above. The rule
[`conditionTree`](validation-rules.md#condition-trees) checks that a value has this form. A
condition is an object of one of these forms, whose members may be written in any order:

- **CUSC-072** A group: `{ "all": [ … ] }` or `{ "any": [ … ] }`, an object whose only member is `all` or `any`
  and whose value is a list of conditions. The list may be empty.
- **CUSC-073** A field comparison: `{ "field": …, "op": …, "value": … }`, an object with exactly these three
  members. `field` is a string that is not empty after [trimming](validation-rules.md#values). `op` is
  one of `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in` and `has`. `value` is, for `in`, a list of strings,
  finite numbers and booleans, which may be empty, and for every other `op` a string, a finite number or
  a boolean.
- **CUSC-074** A judged text: `{ "judge": … }`, an object whose only member is `judge` and whose value is a
  string that is not empty after trimming. The application decides whether the text holds. A judged
  text is a condition only where the rule permits it.
- **CUSC-075** Depth: a condition tree is at most 32 levels deep. The root condition is level 1, and each
  condition in the list of a group is one level below the group. A deeper value is not a condition
  tree. The limit bounds the work of a check, so no value can exhaust the stack of a runtime, and it
  keeps a tree, which nests two levels of JSON (an object and its list) for each of its levels, with
  the form data around it, within the 128 levels of nesting that a JSON reader of a runtime takes by
  default (`serde_json` of Rust).

What a condition means (which data `field` names, how `op` compares, when a group holds) belongs
to the application that evaluates the tree.

```yaml
opens_when:
  type: textarea
  validate: { conditionTree: true }
pass:
  type: textarea
  validate: { required: true, conditionTree: judge }
```

The data `{ "opens_when": { "all": [{ "field": "episodes.e1.status", "op": "eq", "value": "passed" }] },
"pass": { "any": [{ "field": "clues.size", "op": "ge", "value": 2 }, { "judge": "Jian finds the
second recording." }] } }` passes both rules; a `judge` member in `opens_when` fails its rule.

## Languages and choices

Content translation and language input values are separate. Content uses maps
such as `{ en: Name, ko: 이름 }`. `lang` creates one value input per configured
language, with `only`, `frame`, `title` and `group_class` settings.

- **CUSC-091** Without `lang.only`, or with an empty `lang.only`, the languages are `ko`, `en`, `ja` and `zh`.

`items` can be a static array whose indexes are the values, a value-to-label map, a
[choice list](#choice-lists), a [group source](#choices-from-a-repeated-group) with `from` or a
dynamic source descriptor with `model`. Static labels can use
language maps. Generators preserve dynamic source settings; fetching records and executing
external widgets happen outside the generators.

### Choice lists

A choice list is an array of `{ "value": …, "label": … }` objects. Each `value` is a string or a
finite number, and the option value is its [canonical text](validation-rules.md#values): a string
itself and a number as `Number.prototype.toString` writes it. Each `label` is a label as in a
value-to-label map. The choices keep the order of the list for any values.

An `items` array is a choice list when one of its elements is an object that has a `value` member
or a `choices` member. Every element must then be an object whose only members are `value` and
`label`, besides the [appearance](#choice-appearance) members in a choice or multichoice field, or,
in a select field, a [group](#choice-groups); every `value` must be a string or a finite number,
and no two values in the list, inside groups included, may have the same canonical text. Binding a field
whose `items` is a choice list that breaks one of these rules fails with `INVALID_FORM_INPUT`, the
message `Invalid items at {path}: expected value and label pairs with distinct string or number values`
and an empty location, where `{path}` is the data path of the field. The check runs before the field
type is evaluated. Select, choice, multichoice and search fields list the pairs as options in list
order, and a dummy field displays the label of its value, as they do for a value-to-label map.
[`in`](validation-rules.md#values) and the [`choice-label` format](display-formats.md#choice-label)
accept the same choice list.

Choose the form by the required order:

- **CUSC-020** A value-to-label map lists its values in [member order](#member-order), so integer-like values
  come first in ascending numeric order: `{ "1": "Yes", "0": "No" }` displays No before Yes. Use a
  map when that order is the required order, for example for values that are not integer-like.
- **CUSC-021** A choice list keeps the written order for any values: `[{ "value": 1, "label": "Yes" },
  { "value": 0, "label": "No" }]` displays Yes before No. Use it when the values are integer-like or
  mixed and the written order is required.
- **CUSC-022** An array of labels keeps the written order with the indexes `0`, `1`, … as the values.

A select field (the types `select`, `dropdown` and `selectbox`) or a search field (the types
`search` and `autocomplete`) that has no option writes a placeholder option, so that its `select`
element is never empty:

- **CUSC-080** A select or search field whose `items` give no option (absent `items`, an empty
  array, an empty map, or a dynamic source descriptor with `model`, whose records the generators do
  not fetch) writes exactly one `option` element, whose value is the empty string and whose text is
  `select`: `<option value="">select</option>`. The text is the same in every display language and
  is not translated, and the option is never selected, whatever the value of the field. A field with
  at least one option writes no placeholder option. The value of the placeholder is an
  [empty value](validation-rules.md#values) ([CUVR-080](validation-rules.md#values)).

### Choice groups

The choice list of a select field (the types `select`, `dropdown` and `selectbox`) may contain group
entries. A group is an object whose only members are `label`, a label as in a value-to-label map,
and `choices`, a list of one or more `{ "value": …, "label": … }` choices. Groups and plain choices
may be mixed, and the options keep the written order: a plain choice is an option of the select and
the choices of a group are the options of one `optgroup` element, which the
[form markup](form-markup.md#choice-groups) defines. A group does not contain another group, and its
choices have no appearance members. The values of all choices, inside and outside groups, are the
choices of the field: they are distinct by canonical text across the whole list, the value of the
field selects the option with the same text in any group, and [`in`](validation-rules.md#values)
accepts the same list.

Binding a field whose choice list breaks one of these rules fails as described above: a group with
another member, without `label` or `choices`, with `choices` that is not a list or is an empty list,
or with a choice that breaks the choice rules, a value that repeats the canonical text of a value in
the same or another group or outside groups, and a group in a field that is not a select field. A
group in the choice list of the [`choice-label` format](display-formats.md#choice-label) fails as
another member of a choice does there.

```yaml
region:
  type: select
  label: Region
  items:
    - { value: auto, label: Automatic }
    - label: Europe
      choices:
        - { value: eu-west, label: West }
        - { value: eu-north, label: North }
    - label: Asia
      choices:
        - { value: ap-east, label: East }
  validate:
    in:
      - { value: auto, label: Automatic }
      - { label: Europe, choices: [{ value: eu-west, label: West }, { value: eu-north, label: North }] }
      - { label: Asia, choices: [{ value: ap-east, label: East }] }
```

### Choice appearance

A choice in the choice list of a choice or multichoice field (the types `choice`, `radio`,
`multichoice`, `checkboxes` and `checkcontainer`) may declare its appearance: `class` and `style`
are literal strings applied to the label of the choice, and `attributes` are
[declared attributes](#declared-attributes) written on the input of the choice. The field's
`design.group` (`class` and `style`) applies to the element that holds the choices. A page
can lay the choices out with these, for example as a grid of color swatches whose label reads a
custom property that each choice sets in `style`. The [form markup](form-markup.md#choice-appearance)
defines the output. The choice lists of other fields, of `in` and of the `choice-label` format have
only `value` and `label`, and another member fails as described above.

```yaml
accent:
  type: choice
  label: Accent
  items:
    - { value: blue, label: Blue, class: swatch, style: "--swatch-bg: #1d4ed8", attributes: { aria-label: Blue accent } }
    - { value: green, label: Green, class: swatch, style: "--swatch-bg: #15803d" }
  design:
    group: { class: swatches }
```

Binding checks the appearance after the choice list rules, choice by choice in list order and in
each choice `class`, `style` and then `attributes`, every name before every value. It fails with
`INVALID_FORM_INPUT` and an empty location; `{index}` is the zero-based position of the choice:

- **CUSC-023** A `class` or `style` that is not a string: `Invalid items.{index}.{member} at {path}: expected a string`
- **CUSC-024** `attributes` that is not an object: `Invalid items.{index}.attributes at {path}: expected an object`
- **CUSC-025** A name outside the rule or a refused name: `Invalid items.{index}.attributes.{name} at {path}: expected a data-* or aria-* name that crudui does not write`
- **CUSC-026** A value that is not a string: `Invalid items.{index}.attributes.{name} at {path}: expected a string`

### Choices from a repeated group

A choice field (the types `select`, `dropdown`, `selectbox`, `choice`, `radio`, `multichoice`,
`checkboxes` and `checkcontainer`) without `lang` may take its choices from the rows of a repeated
group of the same form, for example a role that names one of the characters the form declares.
Its `items` is then a group source: an object with the member `from` and the optional members
`label` and `choices`. An `items` object that has the member `from` is a group source and never a value-to-label
map; a map that needs the value `from` is written as a [choice list](#choice-lists).

```yaml
characters:
  type: group
  multiple: true
  properties:
    id: { type: text, validate: { required: true, unique: true } }
    name: { type: text }
roles:
  type: group
  multiple: true
  properties:
    character:
      type: select
      items: { from: characters.*.id, label: name }
```

- **CUSC-061** `from` is a path `{group}.*.{value}`. `{group}` is the property names from the root
  to a repeated group, joined with `.`, and no group on that path except the last is repeated, so
  the group has one set of rows for the whole form. `*` stands for the rows of the group, and
  `{value}` is the name of a direct child field of the group that is not repeated, not a group,
  has no `lang` and does not hold a boolean (CUSC-068). The field that declares the source may be inside that group or anywhere else in
  the form.
- **CUSC-062** `label` is the name of a direct child field of the same group that is not repeated,
  not a group, has no `lang` and does not hold a boolean (CUSC-068). Without `label` the label of a choice is its value.
- **CUSC-063** The choices are the rows of the group in the order of its data, read when the form is
  rendered or the data is validated. A row gives the choice whose value is the
  [canonical text](validation-rules.md#values) of its `{value}` field when that value is a string
  or a finite number whose canonical text is not empty after trimming; any other row gives no
  choice. A row whose canonical text is the same as that of an earlier row repeats it (CUSC-090).
  The label
  of a choice is the canonical text of the row's `label` field when that value is a string or a
  finite number whose canonical text is not empty after trimming, and otherwise the value of the
  choice. A group without data has no choices. The field lists these choices as it lists a
  [choice list](#choice-lists) of the same pairs.
- **CUSC-090** The values of the choices are distinct, as those of a choice list are. Rendering
  lists a repeated value once, as the choice of its first row, and validation refuses data in
  which the rows of the group repeat a value: an input error with `INVALID_FORM_INPUT`, an empty
  location and the message `Group source value repeats an earlier row: {value} at {path}`
  ([choices from a repeated group](validation-rules.md#values), CUVR-087). The rows of a group come
  from the data that a form submits, so a repeated value is data that the choices cannot express
  and validation reports it instead of choosing one of the rows.
- **CUSC-089** `choices` is a list of literal choices that join the choices of the rows, such as the
  audience `player` beside the ids of the characters: `{ "value": …, "label": … }` pairs as in a
  [choice list](#choice-lists), each with only these two members, a `value` that is a string or a
  finite number whose canonical text is not empty after trimming, as every choice of a row is, and a
  `label` as in a value-to-label map, no two values with the same canonical text.
  The choices of the field are the literal choices in written order, followed by the choices of the
  rows (CUSC-063). A row whose value has the canonical text of a literal choice would give that value
  twice, so it is refused, not dropped: when the choices are read, for a binding or a validation of
  the data, it fails with `INVALID_FORM_INPUT`, an empty location and the message
  `Group source value repeats a literal choice at {path}: {value}`, where `{path}` is the data path of
  the row's `{value}` field, such as `characters.c4.id`, and `{value}` its canonical text. Compilation
  checks `choices` last, after the type of the field that `label` names; a `choices` that breaks these
  rules fails with `Invalid items.choices at {path}: expected value and label pairs with distinct
  string or number values`.

  ```yaml
  audience:
    type: select
    items: { from: characters.*.id, label: name, choices: [{ value: player, label: Player }] }
  ```
- **CUSC-071** The choices follow the data. A form instance lists them from its current data after
  every change of that data (`setValue`, `setData`, `addRow`, `copyRow`, `removeRow`, `moveRow`,
  `rekeyRow`, `undo` and `redo`), so a change of a row of the source group, of its `{value}` field
  or of its `label` field changes the choices that the next view of the instance lists. Listing
  the choices changes no value: a value that no choice matches any more stays in the data, and
  validation reports it ([choices from a repeated group](validation-rules.md#values)).

A browser binding keeps the choices that the page shows equal to those of the data it holds. The
React, Vue and Svelte `Form` components and a page of the HTML renderer render every view of the
instance, so they show the choices of each change. The browser validation binding of a
server-rendered form ([form binding](../../packages/form-binding/README.md#choices-from-a-repeated-group))
renders the widget of each field with a group source again from the data of its controls when it
binds and after every `input` or `change` event, and keeps each selected value that is still a
choice selected; a value that is no longer a choice is held by no control, so its data lacks it as
a native submission does.

Every validator checks a value against these choices
([choices from a repeated group](validation-rules.md#values)). Compilation checks a group source
after the other declarations of the field (its `behavior` and a range field's rules included), in
this order: the members of `items` in declaration order, the field, `from`, the type of the field
that `from` names, `label`, the type of the field that `label` names and then `choices` (CUSC-089). It fails with
`INVALID_FORM_INPUT` and an empty location:

- **CUSC-064** A member other than `from`, `label` and `choices`: `Invalid items.{key} at {path}: unknown key`
- **CUSC-065** A field that is not a choice field or that has `lang`: `Invalid items.from at {path}: expected a choice field without lang`
- **CUSC-066** A `from` that is not a string of that form, or whose group or field breaks these rules: `Invalid items.from at {path}: expected {group}.*.{field} for a field of a repeated group outside repeated groups`
- **CUSC-067** A `label` that is not the name of such a field of the group: `Invalid items.label at {path}: expected the name of a direct child field of the group without multiple, properties or lang`
- **CUSC-068** A `from` or `label` that names a field that holds a boolean: `Invalid items.{member} at {path}: {field} holds a boolean, expected a field whose values are strings or numbers`, where `{member}` is `from` or `label` and `{field}` is the declaration path of the named field, such as `characters.active`. A field holds a boolean when its type stores a boolean as its value: the types `checkbox` and `switcher`, whose data is `true` or `false` ([checkbox fields](form-markup.md#declared-attributes), CUMK-027, and [switches](form-markup.md#switches)). The rows of such a field would give no choice or label (CUSC-063), so compilation refuses it rather than listing no choices. A type added later whose stored value is a boolean falls under this rule and is added to this sentence.

## Composition and validation

Composition resolves `$ref`, then applies `$patch`, then processes the resulting
field definitions. Missing references are load errors. Composition does not
depend on record values. Form compilation resolves composition once per template.

A `$ref` value is one file path or a list of file paths. A list resolves each path
in declaration order and merges the results, so a later path overrides an earlier
one on a shared key; an entry that is not a string is a load error. A path may
select a fragment of a file as `(file.yml).key`. A reference resolves to the field
map of the layer it selects, which is why a declaration whose root is a bare `$ref`
is that field map and not yet a specification.

The CLI static check also rejects unresolved composition. It does not treat
checking an uncomposed field as successful reference resolution.

Validators inspect `validate` rules and current data. The
[validation rules](validation-rules.md) describe rule semantics. Shared cases in
`tests/fixtures/expr`, `tests/fixtures/compose` and `tests/fixtures/validate`
compare the TypeScript, PHP, Go and Rust implementations. SSR comparisons and
mounted DOM tests verify different behavior and are recorded separately.

A field whose value names an entry of another field, such as the id of a row of another repeated
group, declares `validate.reference` with the declaration path of that field, for example
`reference: facts.id`. The [references](validation-rules.md#references) define the ids that the
data declares there and the check of the value.

## Lists

A list declares `columns`; row records are a separate `buildList(spec, rows,
options)` argument. Each column defines a `field` path, `label`, `format`,
`design` and optional `sortable`. Lists share composition, conditions, appearance
and content translation with forms. They use display cells instead of inputs.
A list without `columns` fails with `List specification must declare columns`, and the
[display format declarations](display-formats.md#declarations) define the checks of every list and
detail declaration.

- **CUSC-027** `text`: `truncate`
- **CUSC-028** `date`: `pattern`
- **CUSC-029** `number`: `decimals`, `thousands`, `prefix`, `suffix`
- **CUSC-030** `badge`: Value-to-variant `map` and translated labels
- **CUSC-031** `link`: `href`, `target`, `text`
- **CUSC-032** `choice-label`: `items`
- **CUSC-033** `bool`: `true` and `false` labels, `as`
- **CUSC-034** `image`: `width`, `height`, `alt`
- **CUSC-035** `html`: Unescaped display HTML

`format` accepts a type string or an object; absent, `false` and `true` select
text. Format-specific settings stay in that object. [Display formats](display-formats.md)
defines each format, the accepted list and detail input and the markup. `sort`, `pagination`,
`search` and `actions` declare page behavior. `empty` defines translated
empty-state content and `description` translated text shown before the list. The list model
is `{ columns, rows, pagination, sort, actions, empty, description, design }`: `sort` is absent
when no sort field is declared, and `description` is the translated `description`, empty text
when none is declared. The core does not query a database, filter records or apply
server pagination. The caller supplies the current page and the total record count. When
`pagination` is enabled, the resolved model defaults `perPage` to 20, `mode` to `pages`,
and `page` to 1 when omitted. It also supplies `pageCount` (0 without a total, otherwise at
least 1, also when the total is zero). `per_page` is an integer of at least 1, and the
[display rules](display-formats.md) define the declaration checks and the page-number window.
Every renderer emits previous, numbered and next page buttons. The current page
has `aria-current="page"` and is disabled; boundary previous/next buttons are disabled.
The buttons carry `data-page`; navigation and data fetching remain the caller's responsibility.

## Details

A detail declares `fields`; one record is supplied separately to
`buildDetail(spec, record, options)`. Each field uses the same read-only display
contract as a list cell: `field`, `label`, `format` and `design`. Detail fields
share composition, conditions, appearance, content translation and cell formats
with lists, but do not declare sorting or pagination. A detail declares `actions` as a list
does. `buildDetail` returns ordered display fields, the resolved actions and the evaluated
detail design; renderers consume that model and query no data.

The model is `{ fields, actions, design }`; `actions` has the list action models in member
order and is empty when the detail declares no actions. Each field has the members `key`, `label`, `format`,
`value`, `display` and `design`, in that order: the list cell of the one record, preceded
by its key and translated label. `value` is `null` when the record has no value at the
field path, as it is for a list cell. A declaration that is not an object fails with
`Detail specification must be an object`, a declaration without `fields` with `Detail
specification must declare fields`, and a record that is not an object with `Detail record
must be an object`. Every runtime returns the same model and the same errors, and every
string renderer writes the same detail HTML as React's server rendering, including image
preload links before the definition list.

## Acceptance criteria

1. **CUSC-036** Resolve composition before evaluating fields and report missing references.
2. **CUSC-038** Evaluate conditions with the expression parser, without JavaScript evaluation.
3. **CUSC-039** Preserve language input values independently of the display language.

The schema keeps structure, content, validation, appearance and widget options separate.
Shared validation cases are compared in four languages and SSR output in three frameworks,
and editable form behavior is verified with mounted views.

Repeated fields accept `multiple.min` and `multiple.max` as numeric row-count
limits, `multiple.copy` and `multiple.sortable` for row controls, `multiple.title`
for the child field whose value titles each row, `multiple.controls` for the
control position (default `header`) and `multiple.header` for static (default) or
sticky row headers. The [form markup](form-markup.md) defines their rendering.
`multiple: only`, the same as `multiple.only: true`, declares rows that exist only in the data:
the data's keys are the rows, missing data has no row, and the form offers no row controls or
row operations. `multiple.only` combines with `title`, `header` and `keys` and excludes `min`, `max`,
`copy`, `sortable`, `controls` and `onclick`. Compilation reports another string as
`Invalid multiple at {path}: expected a boolean, only or an object`, a non-boolean `only` as
`Invalid multiple.only at {path}: expected a boolean`, and an excluded key beside `only: true` as
`Invalid multiple.{key} at {path}: unknown key`.
Instance collection keys identify rows; the schema does not define hidden
identity fields. See [form runtime](form-runtime.md) for row operations.

Form compilation rejects a wrong value type in `multiple`, `lang` and `design` with
`INVALID_FORM_INPUT` and the message `Invalid {key} at {path}: expected
{expected}`. `{path}` is the field's structural path, such as `companies.name`.
A condition map is a non-empty object. A button or action field takes its control
text only from `content`; `text` is not a field compatibility key. A form without `buttons` has one submit
button; a `button` or `link` needs `text` and a `link` needs `href` (see the
[form markup](form-markup.md)).

- **CUSC-041** `multiple`: Boolean, `only` or object
- **CUSC-081** Validation refuses at load a field whose `multiple` is present and is not a boolean, the string `only` or an
  object, `null` and a list included, with `INVALID_RULE_PARAMETER`, the message
  `Invalid multiple at {path}: expected a boolean, only or an object` and the field's declaration path as its location and
  `{path}`. It checks fields in declaration order, each field before its children, and the `multiple` of a field before its
  group source and its rules ([parameter errors](validation-rules.md#parameter-errors)).
- **CUSC-042** `multiple.only`: Boolean
- **CUSC-043** `multiple.min`, `multiple.max`: Number
- **CUSC-044** `multiple.copy`, `multiple.sortable`: Boolean
- **CUSC-045** `multiple.title`: Name of a direct child of a repeated group that is not repeated, not a group and has no `lang`
- **CUSC-046** `multiple.controls`: `header`, `footer` or `outline`
- **CUSC-047** `multiple.header`: `static` or `sticky`
- **CUSC-048** `lang`: Boolean or object
- **CUSC-049** `lang.only`: List of language-code strings or object
- **CUSC-050** `design`: Boolean or object
- **CUSC-051** `content`: Text or a language map; the control text of a button or action field
- **CUSC-052** `messages`: Object of registered rule name to message string
- **CUSC-053** `buttons`: List of buttons (`type`: `submit`, `reset`, `button` or `link`); the form root only
- **CUSC-054** `action`: Object with string `method`, `url` and `enctype`; the form root only
- **CUSC-087** `dataLimits`: Object with integer `depth` (1 to 256) and `values` (1 to 1000000); the form root only ([data limits](validation-rules.md#data-limits))
- **CUSC-055** `design.show`: Expression, boolean or condition map
- **CUSC-056** `design.class`, `design.style`: String or condition map
- **CUSC-057** `design.label`, `design.wrapper`, `design.group`, `design.prepend`: Object
- **CUSC-058** `class` and `style` of those nodes: String or condition map
- **CUSC-059** `design.attributes`, `design.wrapper.attributes`: Object of a `data-*` or `aria-*` name to a string; form fields only ([declared attributes](#declared-attributes))
- **CUSC-060** `design.layout`: `stacked`, `inline` or `line`; group fields only ([layout](#layout))
- **CUSC-076** `multiple.keys`: Reference to a repeated group, beside `only: true` ([keyed maps](#keyed-maps))

Compilation checks fields in declaration order, each field before its children.
The schema closes `multiple`, `lang`, `design`, the design nodes and `behavior`: a key they do
not list fails with `Invalid {bucket}.{key} at {path}: unknown key` (for example
`Invalid design.label.text at name: unknown key`). Within a bucket, unknown keys are checked in
declaration order before the values. The order is `buttons` and `action`, `multiple`, `lang`,
`design` (then each node: `label`, `wrapper`, `group`, `prepend`) and `behavior`. `options`
and dynamic `items` sources stay open for type-specific settings; forbidden meta keys are
rejected everywhere. `validate` and `messages` keys are the registered rule names: the
meta-schema rejects any other name, and validation fails the load with `UNKNOWN_RULE`
([parameter errors](validation-rules.md#parameter-errors)). The meta-schema declares the parameter shapes of every registered
validation rule and rejects forbidden keys at every depth of every value it leaves open.

## Keyed maps

A keyed map is a data-only collection whose keys are the ids of another repeated group of the form,
for example the stance of each character on a fact, or a note on each other character. The ids of a
repeated group are its row keys: rows are identified by their keys
([form runtime](form-runtime.md#row-identity)), not by a field named `id`. A field declares a keyed
map with `multiple.keys` beside `only: true`; the field may be a repeated scalar field or a repeated
group.

```yaml
characters:
  type: group
  multiple: true
  properties:
    name: { type: text }
    relation_notes:
      type: text
      multiple: { only: true, keys: ..characters }
facts:
  type: group
  multiple: true
  properties:
    truth: { type: text }
    holders:
      type: select
      items: { knows: Knows, suspects: Suspects }
      multiple: { only: true, keys: ..characters }
```

- **CUSC-077** The value of `multiple.keys` is a field reference to the repeated group, written as the
  `enddate` parameter is written ([conditional parameters](validation-rules.md#conditional-parameters)):
  `.name` or a bare `name` names a field beside the declaring field, each further leading dot moves
  one field level up, a row key leaving with its collection, and a reference with a dot inside and no
  leading dot names a path from the form root. In the declaration the reference therefore leaves as
  many fields of the declaring field's declaration path as it has leading dots, a bare name one and a
  path from the root all of them, and then follows its names. It names a repeated group when it does not leave the form root, has no
  empty name and no `*`, every name but the last names a field of the group reached so far that is a
  group and is not repeated, and the last names a repeated group. In the example both references
  leave `relation_notes` or `holders` and the repeated group around it and name `characters`.
- **CUSC-078** Compilation checks `multiple.keys` after `multiple.only`: `keys` without `only: true`
  fails with `Invalid multiple.keys at {path}: expected multiple.only: true`, and a value that is not
  a string fails with `Invalid multiple.keys at {path}: expected a reference to a repeated group`,
  both with `INVALID_FORM_INPUT` and an empty location. Rendering does not read `keys`: the rows of
  the field are its data's rows. Validation resolves the reference and checks the data's keys
  ([keyed maps](validation-rules.md#keyed-maps)).

## Widget and source settings

`options` preserves settings for the corresponding widget. Declaration acceptance
does not mean that the core executes an external widget. Search uses
`keyword_min_length`; map descriptors use `marker_draggable`, `zoom` and
`geometry_type`; tags use `max_tags`. Label settings include `checkbox_label` and
`on_label`. Container settings include `collapse`, `expend`, `view_total`,
`stepper` and `blank_message`. `callback` and `event` preserve widget scripts.

Dynamic choice descriptors can specify `model`, `method`, `table`, `relations`,
`keys` and `api_server`. A nested `items` collection supplies initial static
choices. Queries and endpoint calls happen outside the generators. A generator writes `relations`
into `data-source-relations` as `JSON.stringify` writes it, each number as ECMAScript
`Number.prototype.toString` writes it, so `1e21` is `1e+21`, `100000000000000000000` keeps its
digits and `-0` is `0`.

- **CUSC-088** `relations` is written to `data-source-relations` as the JSON text of its value; a missing or
  null `relations` is written `[]`.

Language configuration accepts a `mode`, an `only` language list or override map,
and group `name`, `key`, `frame`, `title` and `group_class` settings. Language
overrides can change `validate`, `design`, `behavior` and `options`.
