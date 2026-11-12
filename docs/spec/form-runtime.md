# Form structure and data binding
<!-- doc-id: docs-spec-form-runtime -->

This document defines the form runtime contract. [한국어](form-runtime.ko.md).
Implementation and verification status are recorded in [features](../features.md).

## Structure

`compileForm(spec, options)` resolves composition and creates an immutable form
template without record data. The template contains field definitions and one
child definition per nested group. Repeated groups do not require example rows.
The template can be serialized as JSON and reused by multiple form instances.

`bindForm(template, data, options)` evaluates values, language and display
conditions. It returns node view models, defined by the [form markup](form-markup.md),
without modifying the template or data.
It does not load composition files. Evaluated values and display conditions are
instance state and must not be stored in a shared template cache.

- **CURT-092** `bindForm`, `bindButtons` and `createForm` accept only a template that has exactly
  the shape `compileForm` produces; any other value fails with `INVALID_FORM_INPUT`,
  message `Unsupported form template` and an empty location. The template is an
  object whose only members are `kind` (`crudui/form-template`), `fields` (a list
  of field templates), `buttons` (a list of objects), an optional `keyPrefix`
  (a string), an optional `action` (an object) and an optional `description` (any
  value); a template has no `version` member. `compileForm` writes the members in the
  order `kind`, `keyPrefix`, `fields`, `buttons`, `action`, `description`, and writes
  `description` with the root's declared `description` when the root declares one. Each field template has exactly a string `name`, an object `spec` and a
  field template list `children`. The contents of `spec` and of the buttons are
  not checked again. In JavaScript a member whose value is `undefined` is absent;
  in PHP an associative array is an object and an empty or list array is a list.
Node models keep the member order the [form markup](form-markup.md) defines, and
every widget model lists its members in the order `kind`, `layout`, `tag`,
`attrs`, `text`, `rawHtml`, `source`, `options`, `itemLabelClass`, `script`,
`styleChrome`, `prepend`, `append`, `extra`, `condition`, with `display` before
`file` and `input` before `option` in `extra`, in every runtime.

`createForm(template, data, options)` creates an editable instance.
`Form` renders the instance in React, Vue or Svelte. `renderForm(instance, options)`
renders that same instance on the server as a [complete form](#complete-form); the
`Form` components accept the same `options`. Without `options.action` the host owns the
HTML `form` element and handles submission. Data defaults and row identity are prepared by the instance
before either renderer runs. Field-only rendering is an internal operation. `setData(data)`
replaces the record after mounting, including previously edited input values.
The template remains unchanged. `getData()` returns detached submission data.
- **CURT-093** `getValue(path)` returns a detached copy of the value at the data path `path`, or
  absence when the data holds no value there. The data holds no value at a path when one of its
  segments names no member of the object reached so far, names no item of the list reached so far
  (an item is named by its index written in decimal without a sign or a leading zero), or follows a
  value that is neither an object nor a list. A member whose value is `null` gives `null`, never
  absence (CURP-025). JavaScript returns `undefined` for absence; a runtime without such a value
  returns its absent value (Rust `None`).
The React `Form` accepts `renderButtons={false}` when its host owns submission
controls; this renders the CRUDUI fields without the declared form-button footer.

The template and browser HTML, CSS and JavaScript can be served as static files.
The browser can mount a form before requesting record data; server-side rendering
is not required. For the same template, record and language, creating a instance
with data and injecting that data after mounting must produce identical form
HTML, classes, computed styles, visibility, control state and submitted fields.
Repeated injection of the same data must preserve that result. The same user
actions must produce the same state and submissions under the same row-key inputs.
Removing a resolved inline style must remove the `style` attribute when no
declarations remain. Data injection must not leave attributes from an earlier
record. Replacing data with another record and restoring it must restore the
same elements, attributes, control values and visibility.
Attribute order is not part of this contract: frameworks and browser engines create
attributes in different orders, so the bindings never rearrange attributes and these
comparisons use the parsed DOM.

The string renderers are React's server rendering (`renderForm` and `renderList` of
`@polyspec/crudui-generator-react/server`), the HTML renderer (`@polyspec/crudui-generator-html`) and the PHP, PHP
extension, Go and Rust generators. For the same instance or list they produce the same bytes.
React's server rendering is the reference, so its serialization is the format: attribute
names such as `readOnly` and `autoComplete`, void elements closed with `/>`, an input's
`name`, `checked` and `value` after its other attributes, a `style` attribute as
`property:value` joined by `;` with a repeated property in its first position holding its
last value, and the list's image preload links. The native generation check compares every
string renderer with the reference byte for byte.

The `@polyspec/crudui-generator-html` package renders the same evaluated instance and list
models as HTML strings without React, Vue or Svelte. `renderForm(form, options)` returns
the [complete form](#complete-form); it is inserted into a page, which may then call
`connectForm` on its `crudui-form` element. `renderFormView(fields, buttons, messages,
options, description)` renders the same content from `bindForm`, `bindButtons` and
`formDescription(template, options)`, which returns the root description translated for
`options.language`, for data owned outside the instance, as React, Vue and Svelte provide
`FormFields`.

- **CUMK-073** `renderFormView(fields, buttons, messages, options, description)` writes the markup that `renderForm`
  writes for an instance with the same nodes, buttons and description and no template action. The Rust core
  writes it as `render_form_view(template, data, render, options)`: it takes a compiled template, never raw nodes,
  binds the nodes and buttons of `data` with the bind options `options`, as `bind_form` and `bind_buttons` do, and
  takes the root description and the interface text of the bound language; `render` holds the render options. The
  shape of the nodes is thus checked once, by compilation, and binding fails as `bind_form` fails.

`renderList(spec, rows, options)`
returns the declared table or card layout. The package performs no DOM binding,
validation, data loading or widget execution.

### Decoding a template

A template that crosses a JSON boundary, such as a template that a server writes into a page with `JSON.stringify` and
a client reads back with `JSON.parse`, is decoded with `decodeFormTemplate(value)` of
`@polyspec/crudui-generator-core` before it is used. The decoder checks the parsed value against
[`contracts/schema/form-template.schema.json`](../../contracts/schema/form-template.schema.json), the JSON Schema of the
shape above, with ajv's standalone validation code of that schema, which
`scripts/generate-form-template-validator.mts` writes before each build of the package, so the package loads no ajv and
compiles no code at run time; it returns the value as a `FormTemplate` unchanged. A value of another shape fails with a
`FormTemplateError`, a `FormInputError` with the code `INVALID_FORM_INPUT`, whose `pointer` is the JSON Pointer
(RFC 6901) of the first invalid member: the missing or extra member itself for a missing or unknown member, and the
empty string for the value itself. Its message is `Invalid form template at <pointer>: <rule>`, with `the root` in place
of the empty pointer.

## Row identity

Repeated data uses objects keyed by row identity. A key identifies a row only
within its parent collection. A row key is not an array position.

```text
form[companies][__0000000000001__][stores][__0000000000042__][name]
```

`sequenceRowKey(seq)` produces `__` + a decimal sequence padded to 13 digits +
`__`. It accepts decimal strings and nonnegative integers of at most 13 digits.
`createRowKey()` creates a random 13-character hexadecimal key with the same
delimiters. The runtime never decides whether a row is persisted by inspecting
the key. The server provides the correspondence after saving.

Instances preserve nonnumeric object key insertion order in memory. Native form
submission follows control order. Keyed JSON uses document member order as row
order, preserved through parsing, editing, persistence and serialization. Form
data contains no auxiliary order or identity fields. Numeric object keys and
keys containing path separators are rejected by editable instances. Callers use `sequenceRowKey` when
constructing data from database sequences. Field paths contain row keys only; no
path segment encodes an array position.

Form binding and editable instances reject data with the wrong shape. They do not
convert arrays or infer hidden identity fields. Each rejection has code
`INVALID_FORM_INPUT` and an empty location. `{path}` is the full data path,
including row keys:

- **CURT-001** Root data that is not an object: `Form data must be an object`
- **CURT-002** A present group value or group row that is not an object: `Group data must be an object: {path}`
- **CURT-003** A present repeated value that is not a keyed object: `Repeated data must be a keyed object: {path}`

In PHP, form data is an object when it is a `stdClass`, an associative array or the empty array (the empty object); a non-empty list array and a value of any other type are no object ([CURP-026](runtime-packages.md)) and fail with the CURT-001 message.

Missing group or repeated data is not a failure. Checks follow template field order,
depth first; a collection is checked before its rows, and rows follow data order.
`addRow` checks a supplied group row value at `{collection}.{key}`.

## Row operations

All operations receive the collection path relative to the form data root.

- **CURT-004** `addRow(path, { afterKey?, value?, key? })`: Insert one row with a new or supplied key.
- **CURT-005** `copyRow(path, key, { newKey?, afterKey? })`: Copy current values and generate new keys for the copied row and all nested repeated rows. The copy takes the key `newKey` when it is given and is inserted after the row `afterKey`, or after the copied row. The option is `newKey`, not `key`, because the bindings spread the options into named arguments beside the argument `key`.
- **CURT-006** `removeRow(path, key)`: Remove only the selected row.
- **CURT-007** `moveRow(path, key, index)`: Change order without changing row keys or values.
- **CURT-008** `rekeyRow(path, oldKey, newKey)`: Change one row key after saving; regenerate descendant field paths.

Copying preserves ordinary field values. Database identity is represented by row
keys; the runtime does not infer identity from fields named `id` or `*_seq`.
The same key may occur under different companies without affecting operation
scope. Key collisions, unknown rows and invalid positions fail without changing
the current data or view. `multiple.min` and `multiple.max` constrain row count.

Missing repeated data creates one editable row. Explicit `{}` means zero rows.
A collection declared `multiple: only` has exactly the rows its data holds, in data order and
under the data's keys; missing data means zero rows, and `addRow`, `copyRow`, `removeRow`,
`moveRow` and `rekeyRow` on it fail with `INVALID_FORM_INPUT` and the message
`Rows of {path} come only from data` without changing the data or view.
A field hidden by `design.show` keeps its value in the instance and in `getData()`; when the data
shows the field again, it shows that value.
Removing the last row leaves the collection's `add-row` control. Adding a row does not restore deleted
data. Default values apply only when input data is missing.
Rendering rules are defined in [empty collections](empty-collections.md).

## View state and history

An editable instance also owns view state and an undo history, separate from the
record. View state is never submitted or serialized with the data.

- **CURT-009** `toggleRow(path, key)`: Expand or collapse one row.
- **CURT-010** `setAllExpanded(expanded)`: Expand or collapse every collapsible row.
- **CURT-011** `undo()`: Restore the record before the last data change and make the reverted record redoable; fails when nothing can be undone.
- **CURT-012** `redo()`: Reapply the most recently undone data change; fails when nothing can be redone.

- **CURT-061** The snapshot reports `canUndo` and `canRedo`: whether `undo()` and `redo()` have a record to restore.
- **CURT-062** History keeps up to 100 records in each direction and drops the oldest record beyond that.
- **CURT-063** Consecutive `setValue` calls on the same path share one history record; every other data change adds one.
- **CURT-064** A data change after `undo()` clears the redo records.
- **CURT-065** `setData` restarts history and expands every row.
- **CURT-066** Removing a row drops the view state of the row and of the rows inside it; rekeying a row moves that state to the new key.
- **CURT-067** View changes do not change `revision`; data changes, `undo()` and `redo()` do.
- **CURT-068** The initial view, which server rendering uses, has every row expanded. `toggleRow` of an unknown row fails with `INVALID_FORM_INPUT` and `Unknown row: {key}`.
- **CURT-069** The `bindForm` option `collapsed`, a list of row paths `{collection}.{key}`, renders those collapsible rows collapsed (`expanded: false`) and every other row expanded.

The [form markup](form-markup.md) defines the structure map and data view.

A view is the ordered list `collapsed` of row paths without duplicates, in the order the rows were collapsed; a history is
`entries` and `redoEntries`, the records oldest first, and the path `lastPath` of the last value edit when it has one.
Every implementation exports these rules as functions over values that they do not change:

- **CURT-070** `initialView()` returns the view with no collapsed row.
- **CURT-071** `toggleRowView(view, rowPath)` expands a collapsed row and collapses an expanded one, appending a collapsed row last.
- **CURT-072** `collapsibleRows(nodes)` returns the row paths `{collection}.{key}` of every collapsible row of the evaluated nodes, depth first in node order.
- **CURT-073** `setAllExpandedView(nodes, expanded)` returns the view with no collapsed row when `expanded` is true, and otherwise the view that collapses `collapsibleRows(nodes)`.
- **CURT-074** `removeRowView(view, rowPath)` drops the row path and the paths inside that row.
- **CURT-075** `rekeyRowView(view, oldPath, newPath)` replaces the prefix `oldPath` of the row path and of the paths inside that row with `newPath`, keeping the order.
- **CURT-076** `emptyHistory()` returns the history with no record.
- **CURT-077** `recordChange(history, previous, path?)` appends `previous` to the entries unless `path` equals `lastPath`, keeps the last 100 entries, clears `redoEntries` and sets `lastPath` to `path` when it is given.
- **CURT-078** `canUndo(history)` is true when the history has an entry, and `canRedo(history)` when it has a redo entry.
- **CURT-079** `undoChange(history, current)` returns the history without its last entry, with `current` appended to `redoEntries` (the last 100) and without `lastPath`, and the last entry as the record; an empty history fails with `INVALID_FORM_INPUT` and `Nothing to undo`.
- **CURT-080** `redoChange(history, current)` returns the history with `current` appended to the entries (the last 100) and without its last redo entry, and that redo entry as the record; a history without a redo entry fails with `INVALID_FORM_INPUT` and `Nothing to redo`.

An action is one of `move-up`, `move-down`, `add-row`, `copy-row`, `remove-row`, `toggle-row`, `select-row`,
`expand-all`, `collapse-all`, `undo` and `redo`. A target is `{ name, path?, key? }`, with the collection path `path` and
the row key `key`; a focus is `{ path, key? }`, and a result is `{ focus? }`.

- **CURT-081** `resolveAction({ action, path?, key? })` returns the target whose `name` is `action`, with `path` and `key` only when they are not empty, and no target when `action` is none of the eleven actions. A browser binding reads `action` from the attribute `data-crudui-action` of a button, `path` from the attribute `data-field-path` of its nearest element that has one and `key` from the attribute `data-crudui-row-key` of its nearest element that has one inside that element.
- **CURT-082** `runAction(form, target)` runs `expand-all` and `collapse-all` as `setAllExpanded(true)` and `setAllExpanded(false)`, and `undo` and `redo` as `undo()` and `redo()`, each returning a result without focus.
- **CURT-083** Every other action returns no result and changes nothing when `path` is missing; every action except `add-row` does the same when `key` is missing.
- **CURT-084** `add-row` runs `addRow(path)`, after the row `key` when it is given, and returns the focus on the new row.
- **CURT-085** `copy-row` runs `copyRow(path, key)` and returns the focus on the new row.
- **CURT-086** `remove-row` runs `removeRow(path, key)` and returns the focus on the previous row, then on the next row, then on the collection (`path` without `key`).
- **CURT-087** `toggle-row` runs `toggleRow(path, key)` and returns a result without focus.
- **CURT-088** `select-row` changes nothing and returns the focus on the row `key`.
- **CURT-089** `move-up` and `move-down` run `moveRow(path, key, index)` with the index one before or after the row and return the focus on the moved row.
- **CURT-090** An action whose operation fails fails with the error of that operation and leaves the instance as it was.
- **CURT-091** `runAction(form, target)` of a target whose `name` is none of the eleven actions fails with `INVALID_FORM_INPUT` and the message `Unknown action: {name}` and changes nothing.

## Rendering and validation

Input names and wrapper identifiers include the actual row keys. Rule paths
replace repeated segments with `[]`, based on the form definition rather than a
key pattern. For the example above the rule path is `companies[][stores][][name]`.

The shared runtime manages data and row operations. Browser event binding handles
native input changes and row buttons. Framework adapters render view models and
synchronize browser input properties after updates. Data binding updates text,
textarea, selection, checkbox, language fields and conditional display.
When `connectForm` connects, it first reads every control that a visitor changed in the
rendered markup, then writes the instance values into the controls. A text control is changed
when its value differs from its rendered default after the browser sanitizes that default as it
sanitizes a value, so a value the browser writes in another form, such as a datetime without
zero seconds, is not a change.

Native typing preserves focus and text selection when rendering replaces an
input element. A duplicate change event with the same value must not replace
the pending focus state.
Each native input event updates the form instance before the framework renders
the next view. Consecutive input events preserve the value accepted by every
preceding event. After rendering completes, the active control value, instance
value and revision represent the last input event. Replacing a control during
rendering must not interrupt the active editing sequence.

A row operation moves focus to the row it affects, whether a pointer or the
keyboard activated it. Adding or copying focuses the new row and moving focuses
the moved row. Removing focuses the previous row, then the next row, then the
enclosing row, then the collection's Add button. Focus goes to the row's first
enabled visible input, or to its toggle or Add button when it has none.

Moving to a row, after a row operation or from the structure map, is focusing that
row's control (or the Add button of an emptied collection) without scrolling and then
scrolling it into view only as far as needed (`scrollIntoView` with
`block: 'nearest'`), so the stylesheet's scroll margins keep it clear of the sticky
headers and the footer in every engine. Scrolling on focus is left to no browser:
WebKit on Linux does not keep to the margins. No script follows the scroll position, and the
bindings never restore scroll positions. Toggling, selecting and undoing keep the
focused control, including a focused action button, without scrolling.

The bindings set whether a focus they give is visible (`focus({ focusVisible })`)
instead of leaving it to the browser, which decides a scripted focus from earlier
pointer input in the document. A restored control keeps the visibility its focus had;
focus moved to a row or an Add button is visible, because the move relocates the user.

Validation receives the submitted keyed data. Repeated group and scalar fields
preserve their keys in error paths. Collection rules (`required`, `unique`,
`mincount`, `maxcount`) inspect the collection; other scalar rules inspect each
entry. Object entries are validated in sorted key order in all five validation
implementations. This ordering applies only to error traversal; form data and
rendered or submitted row order retain the data member order. Form state does
not retain validation errors; pages validate the current data and pass the
returned errors to `renderForm` as `options.errors`.

### Condition values

A browser holds the tree of a [condition field](schema.md#condition-fields) as the text of its
control, the `textarea` marked `data-crudui-value="json"` ([form markup](form-markup.md#condition-fields)).
The browser bindings read that control as its decoded value: a text that is a JSON text (RFC 8259) is
the value it parses to, and any other text, the empty text included, is that text as a string, which
`conditionTree` refuses unless it is empty. `connectForm` sets the decoded value with `setValue`, so
`getData()` returns the tree as an object. It writes the condition text of the instance value into
the control only when the condition text of the decoded control value differs from it, so a text that
a visitor types keeps its whitespace while it decodes to the instance value. The browser validation
of a server-rendered form (`bindForm` of `@polyspec/crudui-form-binding`) builds the data with the
same decoded value. A native submission sends the text, and a server decodes the text of the field
by the same rule with its JSON reader before it validates the data, so `conditionTree` checks the tree
that the browser checked.

`connectForm` edits the tree of a [structured editor](form-markup.md#structured-condition-editor)
through its controls and buttons. It finds the field by `data-condition-for`, takes the tree from the
instance value (an empty value is `{ "all": [] }`), changes the condition at `data-condition-path`
and sets the new tree with `setValue`; the renderer then writes the editor of the new tree, and the
textarea text follows the instance value as above. A `mode` change renames the member of the group
to `all` or `any` and keeps its list. A `field`, `op`, `value` or `judge` change sets that member;
the value text is read as a condition value is read, and an `op` change to `in` makes a value that is
not a list the list of that value, or `[]` when the value is empty, while a change from `in` makes a
list its first member, or `""` when it is empty. `add-comparison` appends
`{ "field": …, "op": "eq", "value": "" }` with the first name of `options.fields`, or `""`, as the
field; `add-group` appends `{ "all": [] }`; `add-judge` appends `{ "judge": "" }`; and `remove` takes
the condition out of its group.

## Complete form

`renderForm(form, options)` renders the complete form that a server sends: the form element,
the hidden fields, the entered values, the errors and the form buttons. The
entered values are the instance data and the buttons are the template's form buttons, so no
other part of the form is written. Every member of `options` is optional, and
`renderForm(form)` equals `renderForm(form, {})`, which writes the `crudui-form` block alone.

Every render that writes the `crudui-form` block, in every renderer, writes the root
`description` of the template translated with the [content rule](schema.md#fields) for the form
language. When that text is not empty, it is the first child of `crudui-form`:
`<p class="crudui-form__description">` with the escaped text, before `crudui-form__errors` and
`crudui-form__body`. An absent description or an empty translated text writes nothing. A form
instance returns that text as `description` in JavaScript and `getDescription()` in PHP.

- **CURT-013** `action` — Value: Object with string `method`, `url` and `enctype`, each optional; Markup: A `form` element around the hidden fields and the `crudui-form` block, with the attributes `action`, `encType` and `method` in that order, as React's serialization writes them. Each attribute takes this object's member (`url` for `action`, `enctype` for `encType`), or the member of the template's `action` when this object has none, and is omitted when neither has it. The `action` attribute follows the URL rule of [markup and styles](#markup-and-styles).
- **CURT-014** `hidden` — Value: Object of string values; Markup: One `<input type="hidden" name="{name}" value="{value}"/>` per member, in member order, inside the `form` element before the `crudui-form` block. It requires `action`.
- **CURT-015** `formErrors` — Value: List of strings; Markup: A `crudui-form__errors` element in `crudui-form` after the description and before `crudui-form__body`, with one `crudui-form__error` paragraph per text in list order. An empty list writes nothing.
- **CURT-016** `errors` — Value: List of objects with string `path` and `message`; Markup: Each message as a `crudui-node__error` paragraph in the `crudui-node__errors` slot of the node whose data path is `path`, in list order.

The data path of a field, group, collection or lang node is its `data-field-path`; the data path
of a row is its collection's path, `.` and its row key. A lang-item node has no data path of its
own. A validation result error (`path`, `field`, `rule`, `message`, `value`) is accepted
unchanged; only `path` and `message` are read. Each text is either the message of
the validation result or another message for the field and rule, and other texts serve errors that
belong to the whole form. Hidden inputs stay outside `crudui-form` because `connectForm`
synchronizes every named control inside that element with the instance data.

Options fail with `INVALID_FORM_INPUT`, an empty location and the first of these messages, in
this order:

- **CURT-017** A value that is not an object: `Render options must be an object`
- **CURT-018** A member other than `action`, `hidden`, `formErrors` and `errors`, the first in member order: `Unknown render option: {name}`
- **CURT-019** `action` that is not an object whose members are among `method`, `url` and `enctype` and are strings: `action must be an object with string method, url and enctype`
- **CURT-020** `hidden` that is not an object of strings: `hidden must be an object of strings`
- **CURT-021** `hidden` without `action`: `hidden requires action`
- **CURT-022** `formErrors` that is not a list of strings: `formErrors must be a list of strings`
- **CURT-023** `errors` that is not a list of objects with string `path` and `message`: `errors must be a list of objects with string path and message`
- **CURT-024** The first error in list order whose path names no node: `Unknown error path: {path}`

PHP reads an options array as an object, an empty array as an empty object or an empty list, and
a list array as a list. Go and Rust take the options as an ordered JSON object.

Options that cross a JSON boundary, such as the `render` member of a page state that a client reads back with
`JSON.parse`, are decoded with `decodeFormRenderOptions(value)` of `@polyspec/crudui-generator-core`. It runs the checks of
the table above up to `errors`, the same check that every renderer runs before it places the errors on the nodes, and
returns the options; the path of an error is checked only when a form renders them. A value outside the contract fails
with a `FormRenderOptionsError`, a `FormInputError` with the code `INVALID_FORM_INPUT` and the message of the table,
whose `pointer` is the JSON Pointer (RFC 6901) of the invalid member: the unknown member itself, the member `action`,
`hidden`, `formErrors` or `errors`, or the first invalid item of a list, such as `/errors/1`; the empty string is the
value itself. The renderers throw the same error.

## Browser validation

The browser binding that validates a server-rendered form in the browser with the rules the server applies is specified in [its package documentation](../../packages/form-binding/README.md#browser-validation). Its `keyPrefix` option is:

- **CURT-025** `keyPrefix` — Value: String; Use: The `keyPrefix` the form was compiled with; it is the first segment of every control name. Absent means no prefix.

## Cache and execution limits

The reusable cache artifact is the compiled form structure. A filled HTML string
contains record values and evaluated conditions and is not a reusable template.
The view model is rebuilt when data changes; the runtime does not promise that
DOM nodes remain unchanged when a row identity changes.

Scripts and external editor integrations declared by a field are separate from
native data binding.

The scripts of rendered markup are specified in [the HTML package documentation](../../packages/html/README.md#scripts-in-rendered-markup).

Browsers never run a script that was parsed as a fragment (`innerHTML`, a `<template>`) or
cloned, so every renderer inserts each new script as a new script element. `patchContent` does
this for the HTML renderer, and the framework renderers write raw markup through it. React keeps
its own script element for the widget script chrome, which its server output needs byte for
byte; after a client render it runs a new script element with the same attributes and text next
to it and removes it. The rule is checked in Chromium, Firefox and WebKit, because jsdom runs
cloned scripts.

A list or detail rendered again from a new model (`updateView`) keeps every element node its new
markup still contains, including `html` cells and values: a page of the HTML renderer patches
the new markup with `patchContent`, and the React, Vue and Svelte list and detail components patch
their raw content the same way. The shared view fixture `tests/fixtures/view-session/rerender.mts`
checks this in all four renderers.

Browser file inputs cannot be filled from a saved string.
The form runtime does not save records, assign database sequences or deploy an
installation.

## Acceptance criteria

1. **CURT-050** Prepare all nested fields before record data exists, serialize the template,
   and bind independent records without reloading composition files.
2. **CURT-053** Edit, reorder, remove and add rows without restoring stale values.
3. **CURT-054** Apply a saved sequence key and update field names and rule paths correctly.
4. **CURT-055** Reject invalid operations atomically and permit adding after deleting all rows.

The criteria for the framework views, for the nodes that a re-render keeps, and for the browser binding are in the documentation of their packages ([React](../../packages/react/README.md#framework-views), [Vue](../../packages/vue/README.md#framework-views), [Svelte](../../packages/svelte/README.md#framework-views), [HTML](../../packages/html/README.md#keeping-controls-across-re-renders), [form binding](../../packages/form-binding/README.md#acceptance-of-the-browser-binding)).

Every shared validation fixture case is verified through JavaScript, PHP, Go and Rust, and the four languages must produce one idempotent result signature. Object member order inside an error value is not semantic; array order remains semantic.

The copy rule of the form comparison example is in [its README](../../examples/form-comparison/README.md#copying-a-store).

## Input labels and selection

Each native input has a stable DOM identifier derived from its full field path
and the instance `idPrefix`.

- **CURT-094** The default `idPrefix` is `crudui`.

Pages rendering multiple
forms in one document provide distinct prefixes; SSR and browser rendering use
the same prefix. Identifiers do not encode or submit additional record data.
Single-control labels use `for`; checkbox and radio captions target their own
input. Group headings do not target an unrelated input.
Widget scripts use the same resolved identifier as their control. CSS selectors
escape the identifier with `CSS.escape`; direct DOM lookup uses
`document.getElementById`. Search initialization and its generated CSS use the
same container class. String arguments in scripts use JSON string escaping and
escape `<`, U+2028 and U+2029. Every widget derives rule paths from the structural
row positions, including choices, file controls and search.
Multiple-choice inputs use an array submission name and preserve every selected
value through injection, editing and submission. An empty selection is an empty
array in instance data.

List rendering uses `renderList(spec, rows, { layout })`; `layout` is `table`
(default) or `card` in every framework.

Field containers use `data-field-path` for the data path relative to the form
root. Only actual controls use `name` for submission. Browser row operations
resolve the nearest field container and do not depend on a generated title.

A field whose `items` is an invalid [choice list](schema.md#choice-lists) fails binding with
`INVALID_FORM_INPUT` before its type is evaluated.

Unsupported field types produce `UnsupportedFieldTypeError` with code
`UNSUPPORTED_FIELD_TYPE` and the message `Unsupported field type "{type}" at "{path}"`,
where `{type}` is the declared field type and `{path}` the field's data path; the message names no
version-specific renderer.

## HTML serialization

### Date values

Date controls, datetime controls and list date formatting use UTC. A timestamp
with an explicit offset is converted to UTC; a date or datetime without an
offset is interpreted in UTC. Rendering does not depend on the PHP, server or
browser timezone. Datetime controls display seconds and do not remove an offset
before converting its timestamp. Instance data retains the supplied value.

Accepted input forms are `YYYY-MM-DD`, `YYYY-MM-DD[T ]HH:mm`, optional seconds
and fractional seconds, ISO timestamps with `Z` or `+/-HH:mm`, and RFC 2822 dates
with an explicit timezone. Invalid or unsupported date strings remain unchanged
in the field model or list display. Date validity remains a validation concern.
RFC dates accept an optional weekday, a one- or two-digit day, an English
three-letter month, a four-digit year, hours and minutes with optional seconds,
and a numeric `+/-HHMM` offset or `UT`, `GMT`, `EST`, `EDT`, `CST`, `CDT`, `MST`,
`MDT`, `PST`, `PDT`. English names are case-insensitive and separators use spaces
or tabs. A supplied weekday must match the calendar date. Comments, folded lines,
two-digit years and military zones are not accepted. ISO inputs do not trim
surrounding whitespace. Calendar dates, clock values and offsets must be valid.
Tests compare UTC, Asia/Seoul and America/Los_Angeles, including date changes
across midnight and initial data versus subsequent injection.

### Markup and styles

Server renderers preserve the complete evaluated models. Native form and list
HTML follow React static markup, including escaped attributes and image preload
links for actual image elements. Resource hints follow first-use source order,
exclude empty and `data:` sources, and are deduplicated by source. Raw HTML
content is not parsed to produce resource hints. Normal `href` and `src`
attributes reject the JavaScript URL scheme with the same blocked URL output;
explicit raw content retains its declared handling.

Inline CSS parsing separates declarations only at top-level semicolons and the
first top-level colon. Quoted text, escapes, comments and nested parentheses,
brackets and braces remain part of their declaration values. Rendering must not
truncate data URLs or quoted values. Browser styles apply `!important` as a CSS
priority. Field models retain declaration order and values; comparisons must not
remove CSS differences.
