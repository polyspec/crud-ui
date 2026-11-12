# View function fixtures
<!-- doc-id: tests-fixtures-view-functions-readme -->

[한국어](README.ko.md).

`cases.json` holds calls of the view functions of [form runtime](../../../../docs/spec/form-runtime.md). A case has `name`,
`note`, `requirements`, `op`, `args` and `expected`, which is `{ result }` or `{ error }`. A view is `{ collapsed }`, the
list of collapsed row paths. `op` is `initialView`, `toggleRowView`, `removeRowView`, `rekeyRowView`, `collapsibleRows`
and `setAllExpandedView` (the last two take `spec` and `data`, compile and bind them, and use the nodes) or
`bindCollapsed`, which binds `spec` and `data` with the option `collapsed` (`null` for no option) and returns the row
paths of the fields that are collapsed.

The cases are generated from the TypeScript reference; see [form state](../form-state/README.md).
