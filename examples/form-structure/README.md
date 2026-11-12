# Form structure preview
<!-- doc-id: examples-form-structure-readme -->

[한국어](README.ko.md).

This example is a local Vite preview of a five-level reference form: companies,
stores, departments, teams and members. Every level is a repeated group with a
sticky header, a row title and move controls; stores, teams and members can also
be copied. The form declares a cancel link and a save button.

The page has three columns:

- **Structure map** — `renderOutline` output from `@polyspec/crudui-generator-html`,
  connected with `connectOutline`. It expands or collapses every row, undoes and
  redoes changes, and focuses the first control of a selected row in the form.
- **Form** — `renderForm` output, connected with `connectForm` for input and row
  operations such as add, copy, move and remove.
- **Data** — `renderData` output showing the current form data.

`main.js` compiles the specification with `compileForm`, creates the form with
`createForm` in Korean and renders the three views again on every form change.
The form, structure map and data view take every style from
`legacy/packages/generator/ts/styles/crudui.css`; the inline style in `index.html`
only lays out the columns.

| File | Contents |
| --- | --- |
| [spec.yml](spec.yml) | Form specification |
| [data.json](data.json) | Initial keyed data with saved row keys |
| [index.html](index.html) | Page layout and mount points |
| [main.js](main.js) | Compilation, rendering and connection |

## Run

The preview imports the built `@polyspec/crudui-generator-core` and
`@polyspec/crudui-generator-html` packages, and the core package imports the built
`@polyspec/crudui-validator`, so build them first. From the repository root:

```sh
npm install
npm run build
npx vite examples/form-structure
```

Open the URL Vite prints, by default http://localhost:5173/. Rebuild the packages
after changing their sources.

This preview runs on the local Vite development server only. It is not deployed
and has no server that receives the save button.
