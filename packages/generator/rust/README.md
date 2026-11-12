# CRUDUI Rust generator
<!-- doc-id: packages-generator-rust-readme -->

[한국어](README.ko.md).

`polyspec-crud-ui-generator` compiles form structure, binds ordered record data, manages
form instances and renders form, list and read-only detail HTML inside a Rust process. It reuses
`polyspec-crud-ui-validator` for specification composition and expressions.

## Use

The package version is `0.0.7`. During repository development, add the generator
and validator with explicit paths to their package directories. The generator's
Cargo manifest declares its validator dependency.

```rust
use polyspec_crud_ui_generator::{compile_form, render_form, BindOptions, CompileOptions, Form};
use serde_json::json;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let spec = json!({"type": "group", "properties": {
        "name": {"type": "text", "label": "Name"}
    }});
    let template = compile_form(&spec, &CompileOptions::default())?;
    let cached = serde_json::to_vec(&template)?;
    let mut form = Form::new(serde_json::from_slice(&cached)?, &json!({}), BindOptions::default())?;
    form.set_data(&json!({"name": "Ada"}))?;
    let html = render_form(&form, None)?;
    println!("{html}");
    Ok(())
}
```

`compile_form` accepts parsed composition `files`, an explicit `loader`, a
`basepath` and a `key_prefix`. `bind_form` evaluates cached templates without a
loader or record mutation. `BindOptions` contains `language` (`ko`, `en`, `ja`
or `zh`), `id_prefix`, `key_prefix` and `unsupported` (`throw` or `marker`) as
JSON values; null uses the default and any other non-string is rejected. The host provides the HTML
`form` element and handles requests; rendering does not execute browser scripts.

`Form` provides `set_data`, `get_data`, `set_value`, `get_value`, `add_row`,
`copy_row`, `remove_row`, `move_row` and `rekey_row`. `fields` returns evaluated
models and `revision` counts successful updates. Failed operations leave data,
models and the revision unchanged. Initial data, later injection and record
restoration produce identical HTML for identical input and row keys.
Cloning a form creates an independent instance with detached data and models.

`build_list` and `render_list` consume supplied rows. `build_detail` and
`render_detail` consume one supplied record and reuse the list display engine;
neither operation queries other data.
`FormError` provides a stable `code`, `message`, `at` and the original composition
`trace`; ordinary instance errors have an empty trace.

Record objects use `serde_json` with `preserve_order`. Repeated records use
objects with nonnumeric row keys. `sequence_row_key` accepts a decimal string of
one to thirteen digits; `create_row_key` uses the operating system random source.
Missing collections create one row; explicit empty objects remain empty.
Arrays and null values are not converted into collections. Omitted added-row
values and explicit null values remain distinct.

`build_list` returns a list model. `render_list` accepts display rows and
`ListOptions`; its `layout` is `table` or `card`. List composition, localization,
visibility, cell formatting, declared sorting, actions and pagination use the
shared list contract. The generator does not query or sort database records.

Date controls, datetime controls and list date cells use the same UTC parser.
Explicit offsets are converted to UTC; values without offsets use UTC. Datetime
controls display seconds. Unsupported or invalid date strings and instance data
retain their supplied values. The accepted forms are defined in the
[form runtime](../../../docs/spec/form-runtime.md#date-values).

## Example and checks

Run these commands from the repository root:

```sh
cargo run --locked --manifest-path packages/generator/rust/Cargo.toml --example form
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml
cargo clippy --locked --all-targets --manifest-path packages/generator/rust/Cargo.toml -- -D warnings
node legacy/tests/rust-generator-fixtures/verify-fixtures.mjs
make docs-check
```

The [example](examples/form.rs) renders a form, a list and a detail from one record
set. It compiles and serializes a nested form, injects keyed company and store data,
compares initial and injected HTML and validates the record. It then turns each
company row of the same record into a display row (row key, name and store count),
renders them with `render_list` (the name as a `link` to that company's detail, the
row key as `text` and the store count as a `badge`) and renders each company with
`render_detail` (`text` and a `number` with a suffix). It asserts the list link, badge
and detail markup and prints one HTML document with the form, list and detail
sections. Its generation and validation execute in Rust. Browser event integration
and HTTP persistence are separate checks.

The fixture checker requires the repository's installed JavaScript development
dependencies and Cargo. Set `CARGO` to an explicit executable path when Cargo is
not on `PATH`. It compares all shared form and list fixtures against complete
JavaScript templates, models and original React SSR HTML. Template member order
and control attribute order are compared. Form fixtures also retain their
normalized layout checks; native list checks use complete HTML, including image
resource hints. Form instance tests compare initial data, repeated injection and
restoration. The `generate` binary provides the shared JSON comparison
protocol and returns nonzero on request, compilation or binding failure.

See the [form runtime](../../../docs/spec/form-runtime.md),
[runtime package contract](../../../docs/spec/runtime-packages.md) and
[feature status](../../../docs/features.md) for shared requirements and verification
and publication status.
