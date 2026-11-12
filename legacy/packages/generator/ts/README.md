# @polyspec/crudui-generator-core
<!-- doc-id: packages-generator-core-readme -->

[한국어](README.ko.md).

Framework-independent form compilation, editable sessions and list evaluation.

```ts
import { compileForm, createForm } from '@polyspec/crudui-generator-core';

const template = compileForm({
  type: 'group', properties: { name: { type: 'text' } },
});
const session = createForm(template);
session.setData({ name: 'Example' });
```

Compile once per shared template and create a session per form instance.
Use `bindForm(template, data)` to evaluate fields without creating an editable session.

The package entry is the public API: form compilation and binding (`compileForm`,
`bindForm`, `bindButtons`, `formButtonsHtml`), form instances (`createForm`, `FormInstance`,
`createRowKey`, `sequenceRowKey`, `formMessages`), view state and history functions, list,
detail and structure-map models (`buildList`, `buildDetail`, `buildOutline`), browser binding
(`connectForm`, `connectOutline`, `connectStickyHeaders`, `patchContent`, `resolveAction`,
`runAction`) and the errors it throws (`ComposeLoadError`, `FormInputError`,
`UnsupportedFieldTypeError`). The stylesheet is `@polyspec/crudui-generator-core/crudui.css`.

`@polyspec/crudui-generator-core/internal` holds helpers shared by CRUDUI's renderer packages. It is not
public API and changes with the renderers.

- [Runtime contract](../../../../docs/spec/form-runtime.md)
- [Setup, nested rows and verification](../../../../docs/operations/forms.md)
- [Feature status](../../../../docs/features.md)

Run `npm run test:forms` from the repository root to build and test all adapters.

## Stylesheet custom properties

- `--crudui-text` — Default: `#111827`; Use: text color of every block
- `--crudui-muted` — Default: `#6b7280`; Use: descriptions, counts, affixes, detail labels
- `--crudui-border` — Default: `#e5e7eb`; Use: borders of rows, lists, details and actions
- `--crudui-surface` — Default: `#ffffff`; Use: background of controls, rows and actions
- `--crudui-subtle` — Default: `#f9fafb`; Use: background of row headers, list headings, affixes and read-only controls
- `--crudui-accent` — Default: `#1d4ed8`; Use: focus outlines, the selected choice and the track of an on switch
- `--crudui-error` — Default: `#b91c1c`; Use: text of form and node errors
- `--crudui-on-accent` — Default: `#ffffff`; Use: text of the selected choice
- `--crudui-action-text` — Default: `#374151`; Use: text and icon color of actions
- `--crudui-action-size` — Default: `1.75rem`; Use: width and height of an icon action, height of a text action
- `--crudui-control-border` — Default: `var(--crudui-border)`; Use: borders of controls, affixes, widget buttons and choices
- `--crudui-control-height` — Default: `2.25rem`; Use: minimum height of controls and choices
- `--crudui-radius` — Default: `0.375rem`; Use: corner radius of controls, affixes, choices and actions
- `--crudui-submit-background` — Default: `var(--crudui-surface)`; Use: background of the submit button of the form footer
- `--crudui-submit-border` — Default: `var(--crudui-border)`; Use: border color of the submit button of the form footer
- `--crudui-submit-text` — Default: `var(--crudui-action-text)`; Use: text color of the submit button of the form footer
- `--crudui-label-width` — Default: `10rem`; Use: width of the label column of an inline layout

## Readiness and scroll

Readiness polling and time-based scroll locks are replaced by synchronization after rendering. Sticky headers are marked stuck on scroll and resize events, measured at most once per animation frame, for rows of any height.
