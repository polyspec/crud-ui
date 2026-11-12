# Form rendering fixtures
<!-- doc-id: tests-fixtures-form-render-readme -->

[한국어](README.ko.md).

`cases.json` is shared by the React, Vue and Svelte layout conformance tests.
Each case contains a name, specification, optional data and options, and either
`expected_html` or `expectError`. The generators compare normalized output or
require the recorded error: an `expectError` holds the `code` and the `message`, and every
binding compares both.

These fixtures exercise the internal `renderFields` evaluation and rendering
path. They cover appearance, conditions, composition, translated content,
language inputs, repetition and widget output, including `multiple: only` collections (rows under
their data keys without row controls, and an empty or missing collection with its header, an empty
body and no add-row control) a hidden group that keeps its values, and choice lists in select, choice, multichoice, search and
dummy fields with the binding failures of invalid choice lists, the options that a select or
multichoice field takes from the rows of a repeated group with the compilation failures of a group
source, the literal choices of a group source listed before its rows and the binding failure of a row that repeats
one, the placeholder option of a select or search field with no option, the structured condition editor with the
named error of a value that it does not show and the compilation failures of `design.editor` and `options.fields`,
and the translated root description
as the first child of the `crudui-form` block. Repeated fixture data uses keyed
collections as defined in the [form runtime](../../../../docs/spec/form-runtime.md).

## Normalization

`normalize.mts` parses HTML with parse5 and inline styles with PostCSS. It sorts
attributes, canonicalizes HTML boolean attributes and CSS declarations, removes
comments and empty class/style attributes, and removes whitespace-only text
nodes outside preformatted elements. Text within `pre`, `textarea`, `script` and
`style` is preserved. Field names, row keys, IDs, values and hidden states are
not masked.

Normalized layout equality does not establish original HTML equality. The
[form inspector](../../../../tests/form-inspector/form-snapshot.mts)
compares original HTML, DOM, CSS, controls and runtime state separately for
initial data and later injection.

## Generation and verification

Run from the repository root after building the packages:

```sh
node_modules/.bin/tsx packages/react/scripts/generate-form-render-cases.mts
npm run test:forms
```

The generation script uses React's internal `renderFields` helper as the layout
reference and normalizes its output. It renders the scenarios of
[`scenario-form-render-cases.ts`](../../../../packages/react/scripts/scenario-form-render-cases.ts) and the widget
cases, and adds the cases in [`written-form-render-cases.ts`](../../../../packages/react/scripts/written-form-render-cases.ts), whose `expected_html` is
written from the specification and never rendered. The cases follow the scenarios, then the widget and written cases, each in source order; a widget or written case takes the place of the scenario of the same name. Review generated changes before accepting them; regeneration alone is not
a correctness check. All three framework conformance suites must pass.
