# Form markup
<!-- doc-id: docs-spec-form-markup -->

[한국어](form-markup.ko.md). This document defines how evaluated form nodes are
rendered. React, Vue, Svelte, the HTML renderer and the native renderers produce
the same markup. Data, row operations and view state are defined in the
[form runtime](form-runtime.md).

## Class names

A class name has one of three forms. Each separator has one meaning.

- **CUMK-001** `crudui-{block}` — Meaning: Block: an independent component; Example: `crudui-node`, `crudui-controls`
- **CUMK-002** `crudui-{block}__{element}` — Meaning: Element (`__`): a part that exists only inside its block; Example: `crudui-node__header`, `crudui-node__label`
- **CUMK-003** `crudui-{block}--{modifier}` — Meaning: Modifier (`--`): a kind or variant of the block; Example: `crudui-node--row`, `crudui-node--sticky`

Words inside a name are joined by one hyphen (`lang-item`). A modifier is always
used together with its block class (`class="crudui-node crudui-node--row"`).
An element name has one level; elements have no modifiers. Classes carry style
only: browser behavior reads the data and ARIA attributes below, never classes.
One exception has a fixed boundary: the [browser validation](form-runtime.md#browser-validation)
binding finds the slots it replaces by the classes `crudui-form__body`, `crudui-form__errors`,
`crudui-node__body` and `crudui-node__errors`, because these slots carry no data or ARIA
attribute. A test of the binding fails when its source names another class. The exception ends
when the renderers write a data attribute on these slots.
Widgets follow the same forms; the only other classes a renderer writes are
`valid-target`, which marks the controls whose values the rules check, and
`valid-target-async`, which marks a select with a dynamic source (see
[browser validation](form-runtime.md#browser-validation)), the editor
hosts `tinymcearea`, `summernote`, `contentjs` and `tuiarea`, and the classes a
spec declares in `design`.

## Blocks and attributes

- **CUMK-004** `crudui-form`: Form root with the `crudui-form__description` paragraph of a non-empty root description, `crudui-form__errors` holding a `crudui-form__error` paragraph per form error, `crudui-form__body` and `crudui-form__footer` holding the form buttons.
- **CUMK-005** `crudui-node`: One data node; see the kinds below.
- **CUMK-006** `crudui-controls`: A button group with `role="group"` and an accessible name.
- **CUMK-007** `crudui-action`: A button: an action with `data-crudui-action`, a form button or the button of a [button field](#button-fields); `crudui-action--text` shows its label as text.
- The structure map (`crudui-outline`) and the current data view (`crudui-data`) are blocks of the TypeScript HTML renderer, documented in `packages/html/README.md`.
- The structured condition editor (`crudui-condition`) is a block of the widget of a structured condition field, defined in [structured condition editor](#structured-condition-editor) (CUMK-067, CUMK-068).
- **CUMK-010** `crudui-widget`: A control with its `__affix` prepend and append texts, a file widget's `__button` and a range widget's `__output`; `--search` holds a search select, `--range` holds a range control, `--condition` holds a [structured condition editor](#structured-condition-editor) and `--unsupported` marks a type without a widget.
- **CUMK-011** `crudui-input`: A native input, textarea or select; `--select` for a select, `--file` for a file input, `--range` for a range input, `--condition` for the textarea of a [condition field](#condition-fields) and `--switch` for the checkbox input of a [switch](#switches).
- **CUMK-012** `crudui-choices`: Radio (choice) or checkbox (multichoice) options: each `__input` is followed by its `__label`; `--multiple` wraps checkbox options. Each choice may add its own label class and style and input attributes ([choice appearance](#choice-appearance)).

- **CUMK-013** `data-field-path`: Data path of field, group, collection and lang nodes, and of structure-map rows
- **CUMK-014** `data-crudui-row-key`: Row key of a row node
- **CUMK-015** `data-lang`: Language code of a lang-item node
- **CUMK-016** `data-crudui-action`: Operation of a button
- **CUMK-017** `hidden`: `design.show` is false; a collapsed row body; the summary of an expanded row
- **CUMK-018** `aria-expanded`, `aria-controls`: Row toggle state and the controlled body
- **CUMK-019** `step="any"`: Every number control (`number`, `integer`, `float`, `decimal`); see below
- **CUMK-069** A number in a control value is written as its [canonical text](validation-rules.md#values):
  the shortest text that reads back as the same double

A button's collection path is the nearest `[data-field-path]` at or above it. Its
row key is the nearest `[data-crudui-row-key]` inside that element; without one
the action applies to the collection.

Validation rules are not written as native constraint attributes; the
[validation rules](validation-rules.md) decide validity. A number control carries
`step="any"` so native constraint validation accepts every number: without it the
default step of 1 counts from the `value` attribute, and a stored value such as
`2886.5` would make every whole number a step mismatch. The `step` rule owns
increments. A [range control](#range-fields) is the one exception.

## Nodes

Every data node is `crudui-node` with one kind modifier and the slots
`crudui-node__header`, `crudui-node__body`, `crudui-node__errors` and `crudui-node__footer`, in
that order. The header is present only with content, the errors slot only with errors (one
`crudui-node__error` paragraph per message, see [complete form](form-runtime.md#complete-form))
and the footer only with controls. Child nodes are
placed only in the body, header parts only in the header, and controls only in
the header or footer. `design.wrapper` applies to the node root, `design.label`
to the header, `design.group` to the body of a group or group row and to the `crudui-choices`
element of a choice or multichoice field, `design.class`
to the control and `design.prepend` to the widget prepend.

- **CUMK-020** `field` — Header: `__label` and `__description`; Body: Widget; the node has `crudui-node--inline` in an inline [layout](#layout)
- **CUMK-021** `group` — Header: `__label` and `__description`; Body: Child nodes; the node has `crudui-node--line` when it declares the line layout, and also `crudui-node--inline` in an inline layout
- **CUMK-022** `collection` — Header: `__label`, `__description` and `__count`; Body: Row nodes; the footer holds the `add-row` control when there are no rows
- **CUMK-023** `row` — Header: Toggle, `__label`, `__number`, `__title`, `__summary`, controls; Body: Widget of a scalar row, or child nodes of a group row
- **CUMK-024** `lang` — Header: `__label`, `__description` and `__title` (`lang.title`); Body: lang-item nodes; the node has `crudui-node--framed` when `lang.frame` is true (the default)
- **CUMK-025** `lang-item` — Header: `__label` with the language code; Body: Widget

A label is a `label` element targeting the control when the body has exactly one
label target; otherwise it is a `span`. A checkbox or switcher caption is the
input's own label inside the body, and its header holds only a description, except in an inline
[layout](#layout), where the header holds the label. A
`hidden` field has no header. A row with `language: 'en'`:

```html
<div class="crudui-node crudui-node--row" data-crudui-row-key="__0000000000001__">
  <div class="crudui-node__header">
    <button type="button" class="crudui-action" data-crudui-action="toggle-row"
      aria-expanded="true" aria-controls="crudui:companies.__0000000000001__:body" aria-label="Expand or collapse"></button>
    <span class="crudui-node__label">Company</span>
    <span class="crudui-node__number">1</span>
    <span class="crudui-node__title">ACME</span>
    <span class="crudui-node__summary" hidden="">Nested rows: 2</span>
    <div class="crudui-controls" role="group" aria-label="Row controls">…</div>
  </div>
  <div class="crudui-node__body" id="crudui:companies.__0000000000001__:body">…</div>
</div>
```

## Declared attributes

A field declares attributes for its control with `design.attributes` and for its node root with
`design.wrapper.attributes` ([schema](schema.md#declared-attributes)). The control is the element
that `design.class` targets: the input, select or textarea of a widget, the file input of an
image, file or cover field, the `div` of a display field (`dummy`, `image-viewer`), the button of
a button or action field and the input of a checkbox or switcher. For a choice or multichoice field, whose
`design.class` targets the option labels, the control is every option input. A field with `lang`
writes the control attributes on the control of every language item, and a repeated scalar field
on the control of every row. The root of a `field`, `group`, `collection` or `lang` node takes the
wrapper attributes; `row` and `lang-item` nodes take none. A dynamic choice source renders no
option input and therefore no control attributes.

The models carry the declared attributes in declaration order:

- **CUMK-026** A node model has them as `attributes` after `style` and before `hidden`.
- **CUMK-027** A checkbox model has them as `attributes` after `caption`.
- **CUMK-028** A widget model appends them to the attribute list of its control: `attrs`, or `extra.file` for a
  `file` layout. A `choices` layout keeps them in `extra.option` after `extra.input`.

Each member is present only when the declaration has at least one attribute. Every renderer writes
the declared attributes after the attributes CRUDUI writes on the element, in declaration order:
after `hidden` on a node root, and after `data-is-default` and `checked` on an option input that
has behavior attributes. React's server rendering is the reference serialization, so two
placements of the reference apply: a control without behavior attributes writes `style` after
the attribute list, and an `input` without behavior attributes writes `name`, `checked` and
`value` last. For example, a text field with `design.attributes: { data-setting: theme,
aria-describedby: theme-help }` writes:

```html
<input type="text" class="valid-target crudui-input" data-name="theme" data-rule-name="theme"
  data-default="" id="crudui:theme" data-setting="theme" aria-describedby="theme-help"
  name="theme" value=""/>
```

## Layout

A group declares the layout of its fields with `design.layout` ([schema](schema.md#layout)). The
node model writes the layout as modifiers at the start of the root class (`className`), before the
`design.wrapper` class, as it writes `crudui-node--framed`:

- **CUMK-029** A field node in an inline layout has `crudui-node--inline`.
- **CUMK-030** A group that declares `line` has `crudui-node--line`, preceded by `crudui-node--inline` when the
  group is in an inline layout.

The stylesheet lays an inline node out as a grid of the label column (`--crudui-label-width`) and the
control column. The header takes no box (`display: contents`), so the label is in the label column
and the description in the control column below the body, followed by the errors; a class or style
of `design.label` that draws a box around the header therefore has no box to draw on. The label is
at least one control high and centers its text on the first line of the control, and the body of a
checkbox or switcher field is one control high and centers its input. A line group places
the child nodes of its body in one wrapping row; each child is as wide as its content, and a child
declares `design.wrapper.style: "flex: 1"` to take the remaining width. The example of the schema
writes:

```html
<div class="crudui-node crudui-node--field crudui-node--inline" data-field-path="appearance.theme">
  <div class="crudui-node__header"><label class="crudui-node__label"
    for="crudui:appearance.theme">Theme</label><p class="crudui-node__description">Applies to every
    window.</p></div>
  <div class="crudui-node__body">…</div>
</div>
<div class="crudui-node crudui-node--group crudui-node--inline crudui-node--line"
  data-field-path="appearance.font">
  <div class="crudui-node__header"><span class="crudui-node__label">Font</span></div>
  <div class="crudui-node__body"><div class="crudui-node crudui-node--field"
    data-field-path="appearance.font.family">…</div>…</div>
</div>
```

In an inline layout, a `checkbox` or `switcher` field with a label writes the label in the header,
as every other field does: a `label` element targeting the input, followed by the description. Its
checkbox model has no `caption` member, so the body holds the input alone and the input starts the
control column. A checkbox or switcher field without a label, and every checkbox or switcher field
outside an inline layout, keeps the caption label in the body. A switcher `sync` with the label
`Sync` and the description `Keeps every window in step.` in the inline group `look` writes:

```html
<div class="crudui-node crudui-node--field crudui-node--inline" data-field-path="look.sync">
  <div class="crudui-node__header"><label class="crudui-node__label" for="crudui:look.sync">Sync</label><p
    class="crudui-node__description">Keeps every window in step.</p></div>
  <div class="crudui-node__body"><input class="valid-target crudui-input crudui-input--switch"
    id="crudui:look.sync" type="checkbox" role="switch" name="look[sync]" value="1"/></div>
</div>
```

## Choice appearance

A choice of a choice or multichoice field may declare `class`, `style` and `attributes`
([schema](schema.md#choice-appearance)). The label of the choice takes the class after its label
classes (`crudui-choices__label` and `design.class`) and the style after the class. The input of the
choice takes the attributes after the field's control attributes; a name declared in both keeps the
position of the field's attribute and takes the choice's value. The `crudui-choices` element takes
the class of `design.group` after its own classes and the style of `design.group`. An option model
has the members `className`, `style` and `attributes` after `id`, each present only when declared;
`style` is normalized as a design style is. With the data `accent: green`, the example of the schema
writes:

```html
<div class="crudui-choices swatches"><input data-name="accent" data-rule-name="accent" type="radio"
  autoComplete="off" class="valid-target crudui-choices__input" id="crudui:accent:0"
  data-is-default="" aria-label="Blue accent" name="accent" value="blue"/><label
  for="crudui:accent:0" class="crudui-choices__label swatch"
  style="--swatch-bg:#1d4ed8"><span>Blue</span></label><input data-name="accent"
  data-rule-name="accent" type="radio" autoComplete="off" class="valid-target crudui-choices__input"
  id="crudui:accent:1" data-is-default="" name="accent" checked="" value="green"/><label
  for="crudui:accent:1" class="crudui-choices__label swatch"
  style="--swatch-bg:#15803d"><span>Green</span></label></div>
```

## Choice groups

The choice list of a select field may contain groups ([schema](schema.md#choice-groups)). The
select writes the options in written order: a plain choice as an `option` element, and the
choices of a group as the `option` elements of one `optgroup` element whose `label` attribute is
the translated label of the group. A select with behavior attributes writes the groups in its raw
markup the same way. An option model of a choice inside a group has the member `group` after its
other members, an object with `index`, the zero-based position of the group in `items`, and
`label`, the translated label; the renderers write the runs of consecutive options of one group or
outside groups. With the data `region: eu-north`, the example of the schema writes:

```html
<div class="crudui-widget"><select name="region" class="valid-target crudui-input crudui-input--select"
  data-name="region" data-rule-name="region" data-default="" id="crudui:region"><option
  value="auto">Automatic</option><optgroup label="Europe"><option value="eu-west">West</option><option
  value="eu-north" selected="">North</option></optgroup><optgroup label="Asia"><option
  value="ap-east">East</option></optgroup></select></div>
```

## Range fields

A `range` field ([schema](schema.md#range-fields)) renders a `crudui-widget crudui-widget--range`
widget: the prepend affix, an `input` of type `range`, a `crudui-widget__output` `output` element
for that input and the append affix, which names the unit. The input has the class
`valid-target crudui-input crudui-input--range` and the `min`, `max` and `step` attributes, the
canonical texts of `validate.range` and `validate.step`. They are the only validation parameters
written as native attributes: a slider has no positions without them, and every position it
offers passes the `range` and `step` rules. The output shows the value the form was rendered with;
a renderer that renders again after a change, as `connectForm` does, shows the new value. An empty
value is written as an empty `value`, which the browser shows at the middle of the bounds, and an
empty output.

The widget model has the layout `range`, the tag `input`, the input attributes as `attrs` and the
output text as `text`. A field `volume` with `default: 50`, `append: "%"` and
`validate: { range: [0, 100], step: 5 }` writes:

```html
<div class="crudui-widget crudui-widget--range"><input type="range" min="0" max="100" step="5"
  class="valid-target crudui-input crudui-input--range" data-name="volume" data-rule-name="volume"
  data-default="50" id="crudui:volume" name="volume" value="50"/><output
  class="crudui-widget__output" for="crudui:volume">50</output><span
  class="crudui-widget__affix">%</span></div>
```

## Condition fields

A `condition` field ([schema](schema.md#condition-fields)) renders the widget of a `textarea` field:
the prepend affix, a `textarea` and the append affix inside `crudui-widget`. The textarea has the
class `valid-target crudui-input crudui-input--condition` followed by the class of `design.class`,
`rows="5"` and `data-crudui-value="json"`, which marks its text as a JSON text for the browser
bindings ([condition values](form-runtime.md#condition-values)); then come the style, the event
attributes and the data attributes of a textarea. Its text is the condition text of the field value,
or of `default` when the data has no value for the field, and `data-default` is the condition text of
`default`:

- **CUMK-066** The condition text of a value: a string is itself, `null` and an absent value are empty, and any
  other value is its JSON text as ECMAScript's `JSON.stringify` writes it without indentation. That
  text has no whitespace, writes the members of an object in their data order, writes a number in the
  shortest form of ECMAScript's `Number::toString` and writes `true`, `false` and `null`. A number is
  the double that ECMAScript reads for it (CURP-028), so the integer `9007199254740993` is written
  `9007199254740992`. A string is in
  double quotes: `"` and `\` are escaped by a backslash; U+0008, U+0009, U+000A, U+000C and U+000D
  are written as `\b`, `\t`, `\n`, `\f` and `\r`; every other character below U+0020 and every
  unpaired surrogate is written as `\u` and four lowercase hexadecimal digits; and every other
  character is written as itself.

The widget model has the layout `widget`, the tag `textarea`, the textarea attributes as `attrs` and
the condition text as `text`. The stylesheet writes the text in a monospace font. A field `pass` with the label `Pass condition`,
`validate: { required: true, conditionTree: judge }` and the data
`{ "any": [{ "field": "clues.size", "op": "ge", "value": 2 }, { "judge": "Jian finds it." }] }`
writes:

```html
<div class="crudui-widget"><textarea name="pass" class="valid-target crudui-input crudui-input--condition"
  rows="5" data-crudui-value="json" data-name="pass" data-rule-name="pass" data-default=""
  id="crudui:pass">{&quot;any&quot;:[{&quot;field&quot;:&quot;clues.size&quot;,&quot;op&quot;:&quot;ge&quot;,&quot;value&quot;:2},{&quot;judge&quot;:&quot;Jian finds it.&quot;}]}</textarea></div>
```

### Structured condition editor

A condition field with `design.editor: structured` ([schema](schema.md#structured-condition-editor))
writes the widget `crudui-widget crudui-widget--condition`. It holds the prepend affix, the textarea
of a condition field, which keeps the value and is what a form submits, the editor of the tree and
the append affix:

- **CUMK-067** A value that the editor shows (CUSC-086) writes the textarea with the attribute `hidden`
  and then `<div class="crudui-condition" data-condition-for="{id}">`, where `{id}` is the id of the
  textarea, holding the root condition. Each condition carries `data-condition-path`, the JSON
  Pointer (RFC 6901) of the condition in the tree: the root is the empty pointer and the condition at
  position `{n}` of a group is the pointer of the group, `/`, `all` or `any`, `/` and `{n}`. A group
  is `<fieldset class="crudui-condition__group">` with a
  `<select class="crudui-condition__mode" data-condition-part="mode">` of the options `all` and `any`
  (the mode of the group selected), an `<ol class="crudui-condition__list">` whose
  `<li class="crudui-condition__item">` hold its conditions in list order, and the buttons
  `add-comparison`, `add-group`, `add-judge` (only under `conditionTree: judge`) and, below the root,
  `remove`. A comparison is `<div class="crudui-condition__comparison">` with the field control, a
  `<select class="crudui-condition__op" data-condition-part="op">` of the eight `op` values (CUSC-085,
  the op of the comparison selected), an
  `<input class="crudui-condition__value" data-condition-part="value">` whose value is the condition
  text (CUMK-066) of the value, and the button `remove`. The field control is
  `<input class="crudui-condition__field" data-condition-part="field">` with the field as its value,
  or, with `options.fields`, `<select class="crudui-condition__field" data-condition-part="field">` of
  those names in their order, the field of the comparison selected and, when it is not among them,
  written first as its own option. A judged text is `<div class="crudui-condition__judge">` with
  `<input class="crudui-condition__text" data-condition-part="judge">` holding the text and the button
  `remove`. Each button is `<button type="button" class="crudui-action crudui-action--text"
  data-condition-action="{action}">` with the interface message of its action (`conditionAddComparison`,
  `conditionAddGroup`, `conditionAddJudge`, `conditionRemove`), and the mode select has the
  `aria-label` of `conditionMode`. No editor control has a `name`, so a form submits the textarea alone.
- **CUMK-068** A value that the editor does not show (CUSC-086) writes, before the textarea, which keeps
  no `hidden`, `<p class="crudui-condition__error" role="alert">` with the interface message
  `conditionInvalid`, whose `{path}` is the data path of the field, and writes no editor.

The widget model of a structured field has the layout `condition` and adds `condition`:
`{ for, judge, fields, labels, root }`, where `for` is the textarea id, `judge` whether judged text is
offered, `fields` the list of `options.fields` or `null`, `labels` the interface messages
`{ mode, addComparison, addGroup, addJudge, remove }` of the controls, and `root` the root node, or
`{ for, error }` with the error text. A node is
`{ kind: "group", path, mode, items }`, `{ kind: "comparison", path, field, op, value }` with the
value text, or `{ kind: "judge", path, text }`. A field `opens_when` with `options.fields:
[clues.size]` and the data `{ "all": [{ "field": "clues.size", "op": "ge", "value": 2 }] }` writes, in
English:

```html
<div class="crudui-widget crudui-widget--condition"><textarea name="opens_when" class="valid-target
  crudui-input crudui-input--condition" rows="5" data-crudui-value="json" data-name="opens_when"
  data-rule-name="opens_when" data-default="" id="crudui:opens_when" hidden="">{&quot;all&quot;:[…]}</textarea><div
  class="crudui-condition" data-condition-for="crudui:opens_when"><fieldset class="crudui-condition__group"
  data-condition-path=""><select class="crudui-condition__mode" data-condition-part="mode"
  aria-label="Condition mode"><option value="all" selected="">all</option><option value="any">any</option></select><ol
  class="crudui-condition__list"><li class="crudui-condition__item"><div class="crudui-condition__comparison"
  data-condition-path="/all/0"><select class="crudui-condition__field" data-condition-part="field"><option
  value="clues.size" selected="">clues.size</option></select><select class="crudui-condition__op"
  data-condition-part="op"><option value="eq">eq</option>…<option value="ge" selected="">ge</option>…</select><input
  class="crudui-condition__value" data-condition-part="value" value="2"><button type="button"
  class="crudui-action crudui-action--text" data-condition-action="remove">Remove</button></div></li></ol><button
  type="button" class="crudui-action crudui-action--text" data-condition-action="add-comparison">Add condition</button><button
  type="button" class="crudui-action crudui-action--text" data-condition-action="add-group">Add group</button></fieldset></div></div>
```

## Switches

A `switcher` field renders a switch. Its node model has the `checkbox` model of a checkbox field
with the member `role: "switch"` after `checked`, and the control class
`valid-target crudui-input crudui-input--switch` followed by the class of `design.class`. A
checkbox field has no `role` member and the control class `valid-target` followed by the class of
`design.class`. The input of a switch keeps `type="checkbox"`, so the form submits and binds it as
a checkbox, and has `role="switch"`, so assistive technology announces it as on or off. Every
renderer writes `role` after `type` and the declared attributes after `role`. The caption is the
input's own label, as for a checkbox, except in an inline [layout](#layout). A field `sync` with the label `Sync` and the data
`sync: true` writes:

```html
<div class="crudui-node__body"><input class="valid-target crudui-input crudui-input--switch"
  id="crudui:sync" type="checkbox" role="switch" name="sync" checked="" value="1"/><label
  for="crudui:sync">Sync</label></div>
```

The stylesheet draws the input as a track with a round thumb at its start: the track has the
`--crudui-control-border` border and the `--crudui-subtle` background, and the thumb has the
`--crudui-surface` color. When the switch is on, the track has the `--crudui-accent` border and
background and the thumb is at its end. A focused switch has a 2px `--crudui-accent` outline.

## Button fields

A `button` field, or its alias `action`, renders one `button` element in the node body. The button
has `type="button"`, the class `crudui-action crudui-action--text` followed by the class of
`design.class`, the style of `design.style`, the `id` of the control, the event attributes of
`behavior` and the declared attributes, in that order, and the `content` text of the field as its
escaped content. A `behavior` script, such as `onclick`, is an event attribute of the button as it
is of every other control, so a click runs it; CRUDUI writes no script, no hidden input and no
`name` for the field, and the field submits no value. A button without event attributes writes its
`style` last, and a button with event attributes is written with its attributes as declared, as
every control is ([declared attributes](#declared-attributes)).

The widget model has the layout `button`, the tag `button`, the button attributes as `attrs` and
the content text as `text`. A field with a label has a header whose label targets the button. A
field without a label has no header, and in an inline [layout](#layout) its button starts the
control column as every other control does. The stylesheet makes the button as wide as its content
and as high as the other controls (`--crudui-control-height`). A field `run` with the label
`Sync`, the content `Run now` and `behavior: { onclick: "sync()" }` writes:

```html
<div class="crudui-node crudui-node--field" data-field-path="run"><div class="crudui-node__header"><label
  class="crudui-node__label" for="crudui:run">Sync</label></div><div class="crudui-node__body"><button
  type="button" class="crudui-action crudui-action--text" id="crudui:run"
  onclick="sync()">Run now</button></div></div>
```

## Rows

- **CUMK-031** The number joins the one-based positions of the enclosing rows with `.`.
- **CUMK-032** `multiple.title` names a direct child whose value becomes the row title. An
  empty value shows the untitled message.
- **CUMK-033** Group rows are collapsible. The summary counts the rows of the collections
  directly in the row body, or shows the collapsed message when there are none.
  Scalar rows have no toggle, title or summary.
- **CUMK-034** Rows of a `multiple: only` collection have no row controls, and the structure map shows none
  for them.
- **CUMK-035** Controls follow this order: `move-up` and `move-down` (`multiple.sortable`),
  `add-row`, `copy-row` (`multiple.copy`) and `remove-row`. `move-up` is unavailable
  on the first row and `move-down` on the last. `add-row` and `copy-row` are
  unavailable when the row count reaches `multiple.max`; `remove-row` when it is at
  or below `multiple.min`.
- **CUMK-036** Every action button (`data-crudui-action`), in the form and in the structure map,
  marks an unavailable action with `aria-disabled="true"`, never `disabled`. It stays
  focusable and a click on it does nothing. A focused control that becomes disabled
  keeps focus in Chromium and loses it in WebKit, so `disabled` would make focus
  depend on the browser and on rendering timing. Field controls keep `disabled`,
  which is declared data state and excludes the field from submission.
- **CUMK-037** `multiple.controls` places row controls in the row `header` (default) or
  `footer`. With `outline` the row controls move to the structure map lines; an
  empty collection's Add control is not a row control and stays in the collection
  footer.
- **CUMK-038** `multiple.header: sticky` adds `crudui-node--sticky`, and the row root style sets
  `--crudui-sticky-depth` to the number of enclosing sticky rows. The row's sticky
  line is that depth times `--crudui-node-header-height` less one row border
  (`--crudui-row-border`). Sticky rows are CSS only, so they behave the same wherever
  the form scrolls: in a page, a frame or a scrolling box. The header container pins
  on the line and has exactly the header height, border included, without wrapping
  (a long title is truncated). The line under a header is the header's own bottom
  border, inside the container, so a pinned container lands on the line of the
  container above it and pinned levels share that one border. A sticky row has no top
  border of its own: its card top edge is drawn inside the header container, the box
  that pins, and goes while the container is stuck, when the line of the container
  above is the seam. A row arriving on the line puts its own edge on that same line,
  so a seam is one border wide wherever a row rests and nothing is covered. The level
  label shows, and the card top edge goes, only while the container is stuck, by a
  `scroll-state(stuck: top)` container query. In a browser without scroll-state
  queries (Firefox, Safari), `connectForm` sets `data-crudui-stuck` on a header
  container while sticky positioning moves it from the top of its row, and the
  stylesheet shows the label and hides the card top edge from that attribute. That
  attribute is the only thing a script changes; it never measures rows for layout or
  moves a scroll position. A control inside a sticky row has a top scroll margin of
  the headers pinned above it (`--crudui-sticky-cover`, the line plus one header
  height), and every form control has a bottom scroll margin of the footer height. When
  a binding moves focus it focuses without scrolling and then scrolls the control into
  view only as far as needed (`scrollIntoView` with `block: 'nearest'`), which keeps to
  those margins in every engine, so the control lands clear of them.

  A sticky node wraps its header in `crudui-node__header-container`. The wrapper is
  the sticky scroll-state container and holds the card top edge; `crudui-node__header`
  remains the header content and draws the line under it. The wrapper supplies the
  sticky background and top radius while the header supplies its content layout. This
  wrapper is required so state-dependent styles target header descendants without
  changing the header's semantic slot.

## Form buttons

A spec declares form buttons at its root with `buttons`, a list of `{ type, text,
name, value, href, design, behavior }` where `type` is `submit`, `reset`, `button` or
`link`. A spec without `buttons` has one submit button. Submit and reset buttons
without `text` show the interface text for their type; a button or link needs `text`,
and a link needs `href`. `action` (`method`, `url`, `enctype`) is the submission
target, kept in the template; `renderForm` writes it on the `form` element of the
[complete form](form-runtime.md#complete-form). Both belong to the form root.

Every form ends with `crudui-form__footer`, one `crudui-controls` group whose
accessible name is the form actions text. `bindButtons(template, data, options)`
evaluates the buttons (design classes and styles follow the field design rules), and
`formButtonsHtml(buttons)` is the only markup builder: a link is an `a`, the other
types are `button` elements, with attributes in the order `type`, `class`, `style`,
`name`, `value`, `href`, `onclick`. The footer pins to the bottom of its scroll
container at `--crudui-form-footer-height`, as sticky row headers pin to the top.

## Structure map and data view

The structure map has one rule: one line per form row. `buildOutline(nodes)`
returns the form's rows, each with the rows nested in it, so the map nests exactly
as the form does; collections, counts and empty collections are not rows and stay in
the form. Each row has a `select-row` button with its number and title. A nested row body indents
one step. Its header holds `expand-all`, `collapse-all`, `undo` and `redo`
(each unavailable when its direction has no history). React, Vue and Svelte provide `Outline`
and `DataView`, and the stateless `OutlineView` and `DataPanel` (Vue: `outlineVNode`
and `dataVNode`) for data owned through `bindForm`; the HTML renderer provides `renderOutline(form)` and
`renderData(form)`, and `renderOutlineView(state, messages)` and
`renderDataPanel(data, messages)` for the same data. All four renderers
reproduce the shared [structure map fixture](../../tests/fixtures/form-outline/cases.json). `connectForm` runs actions in the form.
`connectOutline(element, form, formElement)` runs structure-map actions and focuses
the first control of the form row a `select-row` button names and scrolls it into
view clear of the sticky headers and the footer.

## Interface messages

- **CUMK-065** Every implementation embeds a source generated from `contracts/interface-messages.json` and a test fails when the embedded text differs from it, so every implementation uses the same text.

Control labels, counts and summaries come from one message table for `ko`, `en`,
`ja` and `zh`, [`contracts/interface-messages.json`](../../contracts/interface-messages.json).
Every implementation embeds a source generated from that file and a test fails when
the embedded text differs from it, so every implementation uses the same text.
Authors do not override this text; text that belongs to the data, as a row title
that is empty, is declared by the author (see [schema](schema.md)). Binding rejects a language that is not a
string with `Language must be a string`, then a present `keyPrefix` or `idPrefix`
that is not a string with `{name} must be a string`, then an `unsupported` other
than `throw` or `marker` with `unsupported must be throw or marker`, then any other
language with `Unsupported language: {language}`.

- **CUMK-070** An absent or null binding option uses its default: `language` `ko`, `idPrefix` `crudui`
  (CURT-094), no `keyPrefix` beyond the template's, `unsupported` `throw` and no collapsed row.

## Styles

`@polyspec/crudui-generator-core/crudui.css` is the only stylesheet a form needs: slot
layout, row cards, widgets, control icons, sticky headers, the structure map and the
data view. Every rule is scoped to a crudui block, including box sizing and hiding
`[hidden]` elements, and none depends on page styles or a CSS framework. The page
styles its own layout and nothing inside the crudui blocks.

The form, structure map, data view, list and detail share one set of `--crudui-*`
custom properties. One rule, `:where(.crudui-form, .crudui-outline, .crudui-data,
.crudui-list, .crudui-detail)`, declares their defaults with zero specificity, and no
other rule writes a color. A page themes the blocks with a rule that selects them and
sets the properties, for example `.crudui-form, .crudui-list { --crudui-accent: … }`;
the rule overrides the defaults in any stylesheet order.

- The `--crudui-*` custom properties with their defaults and uses are documented, with the stylesheet `crudui.css`, in `packages/generator/ts/README.md`.

`--crudui-node-header-height`, `--crudui-row-padding`, `--crudui-row-border` and
`--crudui-form-footer-height` size the sticky rows and the form footer (see above).
`tests/style-properties.test.mts` checks the property rule, that every property a rule
reads is declared and that no other rule writes a color.

### Viewport widths

`crudui.css` lays out every block at any viewport width from 360 CSS pixels. At the viewport
widths 360 and 1280, the expected HTML of every case of the shared render fixtures
(`tests/fixtures/form-render`, `form-complete`, `list-render` and `detail-render`), placed in a
page with `crudui.css` and no other stylesheet, causes no horizontal overflow of the document:
the scroll width of the document element is not greater than the viewport width. Every control
(`input`, `select`, `textarea`, `button`) and every action lies within the viewport, except
inside an element that scrolls horizontally on its own (`overflow-x` `auto` or `scroll`), such
as the table of a list, whose content may be wider than the viewport. A list scrolls
horizontally on its own, so a wide table does not widen the page. `tests/viewport.test.mts`
checks every case at both widths in Chromium, Firefox and WebKit.

### Tailwind CSS

A page styled with Tailwind CSS 4 imports `@polyspec/crudui-generator-core/crudui.css` into the
cascade layer `components`, after `tailwindcss`: `@import "@polyspec/crudui-generator-core/crudui.css" layer(components);`.
The rules of `crudui.css` lie unchanged in that layer, so a utility class of the page, which lies in
the later layer `utilities`, overrides a CRUDUI rule. The markup is the same. No copy of the
stylesheet is generated. A page themes the blocks with the
`--crudui-*` properties, as with `crudui.css`, for example with the colors of its Tailwind theme:
`.crudui-form, .crudui-list { --crudui-accent: var(--color-indigo-600); }`.

Compiled with the theme and the utilities of the latest stable Tailwind CSS and no other
stylesheet, that import gives every element of the expected HTML of every shared render
fixture the same computed style, without custom properties, as `crudui.css` at the viewport widths
360 and 1280. `tests/tailwind-styles.test.mts` compares them in Chromium, Firefox and WebKit.

## List and detail markup

Display output uses the same block/element/modifier grammar as form output. A list
root is `crudui-list`; its description, table, headings, cells, cards, empty state, actions
and pagination use `crudui-list__description`, `crudui-list__table`, `crudui-list__heading`,
`crudui-list__cell`, `crudui-list__cards`, `crudui-list__card`, `crudui-list__empty`,
`crudui-list__actions`, `crudui-list__action` and `crudui-list__pagination`.
A pagination navigation contains buttons with `crudui-list__pagination-prev`,
`crudui-list__pagination-page` and `crudui-list__pagination-next`. Each button has
`data-page`; the current page has `aria-current="page"` and is disabled. The first
and last boundary controls are disabled. The renderer emits a bounded page-number
window for very large totals.
A detail root is `crudui-detail`; each field uses `crudui-detail__field`,
`crudui-detail__label` and `crudui-detail__value`. The actions of a detail are written before
the `crudui-detail` element in `crudui-detail__actions`, with one `crudui-detail__action` per
action ([display formats](display-formats.md#markup)).

Every displayed value also carries `crudui-value` and the closed format modifier
`crudui-value--text`, `--date`, `--number`, `--choice-label`, `--badge`, `--link`,
`--bool`, `--image` or `--html`. Badge variants are data, not class names:
`crudui-badge` carries `data-crudui-variant` when a variant is present. Boolean
presentation uses `crudui-bool` with the closed `--text`, `--check` or `--icon`
modifier and `data-crudui-state="true|false"`. CSS may style these attributes;
scripts must read the declared data and ARIA attributes, never infer behavior from
presentation classes.

## Behavior not adopted from the reference form

The reference form that motivated this grammar differs in these deliberate ways:

1. The readiness and scroll behaviour of the TypeScript renderer (synchronization after rendering; sticky headers marked on scroll and resize at most once per animation frame) is documented in `packages/generator/ts/README.md`.

2. **CUMK-057** Expansion is view state, not record data.
3. **CUMK-058** Rows are identified by keys, not array positions.
4. **CUMK-059** Depth is unlimited; one recursive node replaces per-depth components.
5. **CUMK-060** `multiple.max` is enforced.
6. **CUMK-061** Undo records every data change and merges consecutive edits of one path.
7. **CUMK-062** Sticky headers and their labels are CSS only; no script follows the scroll
   position, so nothing runs or renders while scrolling.
8. **CUMK-063** A row shows one number; there is no separate position counter.
9. **CUMK-064** Layout options are declared in the specification, not chosen in a panel.
