# CRUDUI Go generator
<!-- doc-id: packages-generator-go-readme -->

[한국어](README.ko.md).

The Go package compiles form templates, binds data, manages keyed rows, and
renders form, list and detail HTML. Generation executes in Go and shares specification
composition and expression evaluation with the Go validator.

## Use

```go
import generator "github.com/polyspec/crudui/packages/generator/go"

spec := generator.NewObject("type", "group", "properties",
    generator.NewObject("name", generator.NewObject("type", "text", "label", "Name")))
template, err := generator.CompileForm(spec, generator.CompileOptions{})
if err != nil { return err }
form, err := generator.NewForm(template,
    generator.NewObject("name", "Ada"), generator.BindOptions{Language: "en"})
if err != nil { return err }
html, err := generator.RenderForm(form, nil)
```

`CompileForm` resolves composition without record data. The template can be
serialized with `encoding/json` and decoded into `FormTemplate`. `BindForm`
returns the node models of the form grammar (`field`, `group`, `collection`,
`row`, `lang` and `lang-item`) without modifying the template or record.
`BindOptions.Language` selects content and control text: `ko` (default), `en`,
`ja` or `zh`; other languages are rejected.
`NewForm` creates an instance with a detached template and record.

`Form.SetData` replaces a record. `GetData`, `GetValue`, `Fields` and `Template`
return detached values. `SetValue` updates one field. Row operations are
`AddRow`, `CopyRow`, `RemoveRow`, `MoveRow` and `RekeyRow`; collection paths are
relative to the record root. A failed operation preserves record data, field
models and revision. `RenderForm` renders the current instance without changing it; a nil
options value writes the `crudui-form` block, and an options object makes it the
[complete form](../../../../docs/spec/form-runtime.md#complete-form).

`BuildList` returns list models. `RenderList` accepts `ListOptions.Layout` as
`table` or `card`. List data is supplied by the caller; generation does not query
a database. Built-in image cells produce deduplicated preload links in first-use
order. Raw HTML content does not create resource links.

`BuildDetail` and `RenderDetail` consume one supplied record and return or render
ordered read-only fields. They reuse the list display formatter and never query
other data.

Date controls, datetime controls and date list cells use UTC. Accepted ISO and
RFC 2822 values are parsed by one strict parser; invalid or unsupported strings
remain unchanged. Rendering converts explicit offsets and retains original
instance data. Datetime controls include seconds.

## Ordered values

Objects use `*generator.Object`, the shared insertion-ordered object type. Build
them with `NewObject(key, value, ...)` or decode with `DecodeJSON`. Arrays use
`[]any`; `nil` is JSON null. Native unordered maps and recursive values are rejected.
The example's validation map is a separate lookup-only value; stored data retains
its ordered representation.

Repeated fields use keyed objects. `SequenceRowKey(42)` returns
`__0000000000042__`; `CreateRowKey()` generates a random 13-character hexadecimal
key. Keys remain scoped to their parent collection. Missing repeated data creates
one default row; an explicit empty object creates zero rows. Arrays and null
cannot replace a repeated collection.

`AddRowOptions.Value` supplies row data. Set `ValueProvided: true` when supplying
an explicit null scalar row; leaving both fields unset applies field defaults.
`Key` sets a row key and `AfterKey` selects its insertion position.

Set `CompileOptions.KeyPrefixProvided` when compiling with an explicit empty
`KeyPrefix`. `BindOptions` fields are `nil` for their defaults: `IDPrefix`
`crudui`, `Language` `ko`, the template's `KeyPrefix` and `Unsupported` `throw`.
A present value must be a string, and `Unsupported` must be `throw` or `marker`;
other values are rejected. Compilation without a prefix and an explicit empty
instance prefix (`KeyPrefix: ""`) both omit that name segment.

## Run and verify

From the repository root:

```sh
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts go --cwd legacy/packages/generator/go -- ./...
go -C legacy/packages/generator/go run ./examples/server -data /tmp/crudui-go-record.json
```

The example renders a form, a list and a detail from one record set: the record stored
in the `-data` file. It declares a form specification (name, email and an optional
joined date), a list specification and a detail specification for that record, and
every page takes its styles from `crudui.css`.

- `http://127.0.0.1:8087/` is the form. Go compiles the template once, renders the
  stored record, validates submitted form or JSON data, saves a valid record to the
  explicit JSON file and reloads it.
- `/list` renders the stored records with `RenderList`. The example stores one record,
  so the list has that record as its only row, or no rows before the first save. The
  name is a `link` to the detail page, the email is `text` and the joined date uses
  the `date` format.
- `/detail` renders the stored record with `RenderDetail`: the name as `text`, the
  email as a `mailto:` `link` and the joined date as `date`. Before the first save it
  shows an empty record.

`/template` returns the reusable template and `/data` returns the stored record. The
example uses three scalar fields; it does not provide the React, Vue and Svelte
comparison matrix.

```sh
curl -H 'Content-Type: application/json' \
  --data '{"name":"Ada","email":"ada@example.test","joined":"2026-01-02"}' \
  http://127.0.0.1:8087/
curl http://127.0.0.1:8087/list
curl http://127.0.0.1:8087/detail
```

The [native conformance suite](../../../tests/native-generators/README.md) compares this
package with the other runtimes through a program that calls its public API.
