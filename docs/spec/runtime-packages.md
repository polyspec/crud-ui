# Runtime packages
<!-- doc-id: docs-spec-runtime-packages -->

[한국어](runtime-packages.ko.md).
Implementation and verification are recorded in [feature status](../features.md).

## Required capabilities

- **CURP-001** Every implementation (JavaScript/TypeScript, PHP library, PHP native extension, Go, Rust and Python) provides composition and expressions, form compilation and binding, form HTML, list and detail rendering, and validation.

A server language can render forms without starting a JavaScript server or invoking another language's executable.

This item defines a requirement, not completed implementation. The PHP extension
may share compiled libraries, but both operations execute inside the PHP process.
PHP packages and the extension implement the same public classes. An enabled
extension registers those classes before any script runs; otherwise,
Composer autoloads the PHP implementation. The [PHP API contract](../operations/php-extension.md)
defines loading and method equality. Comparison tests run PHP and native PHP in
separate processes and verify which implementation actually executed. An
unavailable native module fails the native test target.

## API operations

Names use each language's naming convention. The operations and results remain
the same; no runtime selector is embedded in a field specification.

- **CURP-006** Compile structure — JavaScript: `compileForm`; PHP library: `Generator::compileForm`; Go: `CompileForm`; Rust: `compile_form`; PHP native: `Generator::compileForm`
- **CURP-007** Bind data — JavaScript: `bindForm`; PHP library: `Generator::bindForm`; Go: `BindForm`; Rust: `bind_form`; PHP native: `Generator::bindForm`
- **CURP-008** Bind buttons — JavaScript: `bindButtons`; PHP library: `Generator::bindButtons`; Go: `BindButtons`; Rust: `bind_buttons`; PHP native: `Generator::bindButtons`
- **CURP-009** Render buttons — JavaScript: `formButtonsHtml`; PHP library: `Generator::formButtonsHtml`; Go: `FormButtonsHTML`; Rust: `form_buttons_html`; PHP native: `Generator::formButtonsHtml`
- **CURP-010** Create instance — JavaScript: `createForm`; PHP library: `new Form`; Go: `NewForm`; Rust: `Form::new`; PHP native: `new Form`
- **CURP-011** Replace data — JavaScript: `setData`; PHP library: `$form->setData`; Go: `SetData`; Rust: `set_data`; PHP native: `$form->setData`
- **CURP-012** Read data — JavaScript: `getData`; PHP library: `$form->getData`; Go: `GetData`; Rust: `get_data`; PHP native: `$form->getData`
- **CURP-013** Render form — JavaScript: `renderForm`; PHP library: `Generator::renderForm`; Go: `RenderForm`; Rust: `render_form`; PHP native: `Generator::renderForm`
- **CURP-014** Build list — JavaScript: `buildList`; PHP library: `Generator::buildList`; Go: `BuildList`; Rust: `build_list`; PHP native: `Generator::buildList`
- **CURP-015** Render list — JavaScript: `renderList`; PHP library: `Generator::renderList`; Go: `RenderList`; Rust: `render_list`; PHP native: `Generator::renderList`
- **CURP-016** Build detail — JavaScript: `buildDetail`; PHP library: `Generator::buildDetail`; Go: `BuildDetail`; Rust: `build_detail`; PHP native: `Generator::buildDetail`
- **CURP-017** Render detail — JavaScript: `renderDetail`; PHP library: `Generator::renderDetail`; Go: `RenderDetail`; Rust: `render_detail`; PHP native: `Generator::renderDetail`
- **CURP-018** Validate — JavaScript: `validate`; PHP library: `Validator::validate`; Go: `Validate`; Rust: `validate`; PHP native: `Validator::validate`

Every runtime builds the same detail model and writes the same detail HTML. The
[shared detail fixture](../../tests/fixtures/detail-render/README.md) is compared at both
levels in JavaScript, the HTML renderer, the PHP library, Go, Rust and the PHP extension:
the `buildDetail` model with its member order, and the `renderDetail` HTML byte for byte
with React's server rendering.

Both PHP implementations use the classes `Polyspec\Crudui\Generator`,
`Polyspec\Crudui\Validator` and `Polyspec\Crudui\Form`. The
[PHP API contract](../operations/php-extension.md) defines the common methods and
loading order. The extension registers these classes when enabled. Without the
extension, Composer autoloads the PHP classes. Examples use the same calls in
both configurations; comparison tests use separate PHP processes and verify
class provenance and method signatures.

## Shared contracts and separate responsibilities

All runtimes implement the same [schema](schema.md), [expressions](expressions.md),
[validation rules](validation-rules.md), [form runtime](form-runtime.md) and
[input text](input-text.md) rules.
Within each runtime, generation and validation reuse composition and expression
evaluation. Rendering does not redefine requiredness or validation rules.

1. **CURP-019** Compilation resolves references and prepares the complete form structure
   without record data. The output can be serialized and cached.
2. **CURP-020** An instance owns record values, defaults, row identities and row operations.
   Instances do not modify shared templates.
3. **CURP-021** Binding evaluates field values, localization and design against instance data.
4. **CURP-022** Rendering creates HTML from evaluated fields. Validation receives submitted
   record data and reports validation or specification errors.

The browser binding, which applies user input and row actions, is documented in the
[form binding package](../../packages/form-binding/README.md#browser-validation).

Server rendering and static delivery are both supported.
Rendering can use data on the server, or load a cached structure in the
browser and inject data later. Neither configuration changes the schema, record
structure or validation rules.

## Data and interoperability

- **CURP-024** Compiled templates share one JSON contract across runtimes. A template compiled
  by one runtime can be bound by another without modification. Template field order
  and keyed record order are preserved. An unordered host-language map cannot be
  used to infer a lost declaration or row order.
- **CURP-025** The [ordered JSON procedure](../operations/ordered-json.md) defines transport
  verification. Ordered JSON object members become ordered runtime objects;
  arrays remain arrays. Absent values, `null`, empty objects and empty arrays remain
  distinct. Runtime conversion does not introduce identity or ordering fields.
- **CURP-026** Each implementation maps the form value model to the native types of its
  language and back without losing the difference between an empty object and an empty array,
  between a missing member and `null`, the order of object members or the type of a scalar.
  Where the language has one type for both an array and an object, such as a PHP array, the
  caller states which it is, and a value that no native type can carry exactly fails explicitly.
- **CURP-027** Repeated row keys identify rows within their parent collection. Saved sequences,
  new keys, ordering and scoped row operations follow the form runtime contract in
  every implementation. Invalid operations leave both data and evaluated fields
  unchanged.
- **CURP-028** A number of a specification, a template, data or an option is an ECMAScript Number:
  the double that ECMAScript's `JSON.parse` reads for its text. An integer whose magnitude is beyond
  2^53 is therefore the nearest double in every comparison and in every text that a runtime writes
  (canonical text CUVR-021, condition text CUMK-066, control values CUMK-069, list cells and JSON
  text), so `9007199254740993` equals and is written as `9007199254740992`. React's server
  rendering, the reference of every string renderer, writes these texts from such doubles; a runtime
  whose JSON reader keeps a wider integer converts it to the nearest double before it compares or
  writes it.
- **CURP-029** The form instance (`createForm`) holds the data, the view state and the undo history,
  and its `snapshot()` returns the evaluated fields, the evaluated buttons, `revision`, `canUndo` and
  `canRedo` of the current state. Registering a listener (`subscribe`) is not an operation of the
  rules: a browser layer that renders the instance with React, Vue or Svelte calls the instance,
  notifies its listeners after each operation that succeeded, and reads `snapshot()` again; the
  instance keeps no listener and calls no host code.
- **CURP-030** The bindings pass every JSON value of a specification, a template, data or an option as an
  polyspec-json `Value`, and the Rust core takes and gives such values at its public boundary (`boundary` of each
  crate). A value that enters is checked as its argument by the input text rules (CUIT-021 to CUIT-031, with the
  argument name of the operation), then read with its members in their order and each number as the double that
  ECMAScript reads for its token (CURP-028). A value that leaves is written with its members in their order and
  each number as `Number::toString` writes its double. A value that leaves nested deeper than 256 levels fails with
  `INVALID_FORM_INPUT` and `Recursive or excessively nested value: result`; a value that enters fails as CUIT-029 to
  CUIT-031 state.
- **CURP-031** An operation that composes takes its files from a file loader in the operation of the same name with
  the suffix `_with_loader` (`validate_with_loader`, `validate_list_with_loader`, `validate_detail_with_loader` of the
  validator; `compile_form_with_loader`, `build_list_with_loader`, `render_list_with_loader`,
  `build_detail_with_loader` and `render_detail_with_loader` of the generator). The loader is the callback
  `file_loader` of the validator: `normalize(path, basepath)` gives the key of a referenced file and `load(key)` gives
  its document as a polyspec-json `Value`. Each document is checked when the loader returns it, as a file of `files`
  under its key (CUIT-023, CUSC-092). `files` given with a loader fail with `INVALID_FORM_INPUT` and
  `Files and a loader are both given`. A failure of the loader ends the operation and reaches the caller unchanged; the
  operation reads nothing from the loader after it.
- **CURP-032** A file loader reports that no file exists at a key by failing `load` with the error of a composition
  load failure of the validator (`compose_load_error`) and the kind `ref_file_not_found`; only the loader knows that
  the file does not exist. The operation then fails as it does for a file that `files` does not hold:
  `REF_FILE_NOT_FOUND` with the message `$ref file not found: <key>` and the trace of that key. It reads neither the
  message nor the trace of the error that the loader gave. The interface contract of the validator names the class in
  `errors.recognize` of `file_loader.load`, and each operation with the suffix `_with_loader` names
  `REF_FILE_NOT_FOUND` among the kinds that it raises. In Rust the loader returns `Failure::Kind` with a
  `ValidateError::Load` whose code is `RefFileNotFound`. An error of that class with another kind, an error of another
  class and a failure of `normalize` are failures of the loader (CURP-031).
- **CURP-033** The failure of a generator operation is the structure `FormError`: its code, its message, its form path
  and its composition trace, which every code has, so that a variant per code would repeat them. The kinds of the
  interface contract of the generator are variants of the code (`FormErrorCode`), not of the structure, and
  `FormError::code` gives the code of a failure; it is the function that the contract names as the projection from the
  error to its code. Not implemented: the contracts do not name the projection, the nested path of a composition code
  inside `FormErrorCode::Compose` or the mutable borrow of the form of `run_action`, because the contract schema of
  binding has no member for them.

## Implementation packages

The TypeScript implementation consists of the generator core
(`@polyspec/crudui-generator-core`, `legacy/packages/generator/ts`), the validator
(`@polyspec/crudui-validator`, `legacy/packages/validator/ts`) and the HTML renderer
(`@polyspec/crudui-generator-html`, `legacy/packages/html`), which writes the evaluated fields as
HTML. The React, Vue and Svelte adapters render the same model natively and are tested as
integrations of that implementation.
