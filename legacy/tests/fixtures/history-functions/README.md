# History function fixtures
<!-- doc-id: tests-fixtures-history-functions-readme -->

[한국어](README.ko.md).

`cases.json` holds calls of the history functions of [form runtime](../../../../docs/spec/form-runtime.md). A case has
`name`, `note`, `requirements`, `op`, `args` and `expected`, which is `{ result }` or `{ error }`. A history is
`{ entries, redoEntries, lastPath? }`. `op` is `emptyHistory`, `recordChange` (`args` are the history, the previous
record and the path or `null`), `undoChange` and `redoChange` (the history and the current record) or `canUndoRedo`,
which returns the list of `canUndo` and `canRedo`.

The cases are generated from the TypeScript reference; see [form state](../form-state/README.md).
