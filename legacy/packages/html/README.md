# @polyspec/crudui-generator-html
<!-- doc-id: packages-generator-html-readme -->

[한국어](README.ko.md).

Framework-independent HTML rendering for CRUDUI form instances, lists and details.

```ts
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from '@polyspec/crudui-generator-html';

const template = compileForm({ type: 'group', properties: { name: { type: 'text' } } });
const form = createForm(template, { name: 'Example' });
const html = renderForm(form);
```

The renderer consumes evaluated core models and returns HTML. `renderForm(form, options)` writes
the [complete form](../../../docs/spec/form-runtime.md#complete-form): with `options.action` it
creates the `form` element and the `options.hidden` inputs, and it places `options.formErrors`
and `options.errors`; without options it returns the `crudui-form` block. It does not bind
browser events, validate data or load records. Use `connectForm` from `@polyspec/crudui-generator-core`
on the `crudui-form` element after inserting the markup when browser editing is required.

Data owned outside a form instance through `bindForm` renders as the same markup with
`renderFormView(bindForm(template, data, options), bindButtons(template, data, options), formMessages(language), renderOptions, formDescription(template, options))`,
and the structure map and data view with `renderOutlineView` and `renderDataPanel`.

`renderList(spec, rows, { layout: 'table' | 'card' })` renders the evaluated list.
`renderDetail(spec, record)` renders one read-only detail from the supplied record.
`renderOutline(form)` and `renderData(form)` render the structure map and data view of a form
instance. These eight render functions are the package entry.

- [Runtime contract](../../../docs/spec/form-runtime.md)
- [Form operations](../../../docs/operations/forms.md)

## Block markup

- `crudui-outline`: Structure map with `__header` form controls and `__body` nodes.
- `crudui-data`: Current data view with `__header` and a `pre` `__body`.

## Scripts in rendered markup

A script in rendered markup runs once, when its markup first appears, in every renderer
(HTML, React, Vue and Svelte) and for forms, lists and details:

- Server-rendered markup: the browser runs the script while it parses the page. Hydration keeps
  the parsed nodes and never runs the script again.
- Client-rendered markup, a new row and a new list row: the script runs when its markup is
  inserted, after the rest of that markup is in place, so it finds the controls that follow it.
- A re-render, a data load with the same values, a moved row and a changed script text never run
  a kept script again.

## Keeping controls across re-renders

- Keep every control, button, script, style and raw content node of forms, lists and details
  across re-renders, and run each script once, when its markup first appears, in Chromium,
  Firefox and WebKit.
