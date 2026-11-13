# Form session scenarios
<!-- doc-id: tests-fixtures-form-session-readme -->

[한국어](README.ko.md).

This family contains shared modules instead of `cases.json`. Each framework test mounts its own
form and passes it with `expect` and a `flush` function that waits for rendering.

- [`scenario.mts`](scenario.mts) exports a nested repeated form `spec`, its `data`, the row keys
  `companyKey`, `storeKey` and `otherStoreKey`, `storesPath` and `exerciseSessionDom`. The company
  key and a store key are deliberately equal, so a replacement must be scoped by path.
  `exerciseSessionDom` loads data into a mounted form and checks an empty value over a default, a
  date-time shown as a date, editing, adding, removing, copying and moving rows with focus after
  each action, an unavailable action with `aria-disabled`, collapsing and expanding rows through
  `aria-controls`, undo, rekeying a row, a field hidden by a checkbox condition, a record injected
  over edited controls, and focus after the last row is removed and an empty collection gets a row.
- [`controls.mts`](controls.mts) exports `controlSpec` and `exerciseControls`, which check label
  targets, multiple choice arrays, native `FormData`, restored records and unique element IDs.
- [`initialization.mts`](initialization.mts) exports `compareServerTakeover` and
  `compareInitialization`.
- [`data-rows.mts`](data-rows.mts) exports `onlySpec`, `onlyData` and `exerciseOnlyRows`, which
  checks that a `multiple: only` collection without data has zero rows and no row controls, that
  it holds exactly the data rows under their keys after `setData`, and that `addRow`, `copyRow`,
  `removeRow`, `moveRow` and `rekeyRow` fail with `INVALID_FORM_INPUT` and
  `Rows of variants come only from data` without changing the data or the view. It also exports
  `visibilitySpec`, `visibilityData` and `exerciseHiddenValues`, which hides and shows a group by
  clicking the checkbox its `design.show` reads and checks that the group's values stay in the
  controls and in `getData()`, including a value set while it is hidden.
- [`typing.mts`](typing.mts) exports `typingSpec`, `installWidgetHost` and `exerciseTyping`.
  `installWidgetHost(document)` gives the document the helpers widget scripts call and records
  each call; a test installs it before mounting the form. `exerciseTyping` types into number,
  text, textarea and behavior-bearing text controls one character at a time, moves the caret, and
  picks a select option, a radio button and a checkbox. After every re-render it requires the
  same control, button, script, style and raw display element nodes, the focus on the edited
  control, the typed order, the caret and the form values, and that each widget script ran once.

- [`group-source.mts`](group-source.mts) exports `sourceSpec`, `sourceData` and `exerciseGroupSource`, which checks
  that a select and a multichoice field whose `items` is a
  [group source](../../../../docs/spec/schema.md#choices-from-a-repeated-group) show the rows of the source group after a
  typed label, an added row with a typed value, a removed row, undo, a rekeyed and moved row and `setData`, and that no
  step changes the values of the fields.

## Comparisons

The scenario and control checks assert through the `expect` the framework test passes.
`compareServerTakeover` renders the session with the HTML renderer's `renderForm` and requires the
framework form to have the same parsed DOM, ignoring comments, empty text nodes and attribute order
and comparing `style` attributes as the CSS object model serializes them. `compareInitialization`
compares a form created with data against a mounted form that receives the same data three times
through `setData`: the state from the [form inspector](../../../../tests/form-inspector/form-snapshot.mts)
without serialized HTML, the JSON of `getData()` and an unchanged `template`. It then changes and
restores a value in both forms and requires equal states and the same checkbox elements.

The [React](../../../../packages/react/src/tests/Form.test.tsx),
[Vue](../../../../packages/vue/tests/form-session.test.mjs) and
[Svelte](../../../../packages/svelte/tests/form-session.client.mjs) form tests and the
[HTML renderer session test](../../../packages/html/src/form-session.test.ts) use every
module. The [core form test](../../../packages/generator/ts/src/form.test.ts) uses the scenario
`spec`, `data`, row keys and `storesPath`.

## Regeneration

There is no generator; the modules are written by hand. A change applies to every framework at
once. Keep `spec` and `data` consistent with the assertions, keep the arguments the framework tests
pass (`element`, `session` or `form`, `expect` and `flush`), and keep the exports the core form
test imports.
