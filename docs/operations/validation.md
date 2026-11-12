# Data validation
<!-- doc-id: docs-operations-validation -->

[한국어](validation.ko.md).

Validate data with the same specification on the client and server. Fields use
`validate` for rules. Validate the specification's declaration shape separately
with the [schema procedure](schema-validation.md). The
[schema contract](../spec/schema.md) defines composition and accepted fields.

Install dependencies and build the JavaScript packages first. JavaScript and PHP
examples run from the repository root; Go and Rust use the module setup described
below. Each language example supplies an empty required email and expects `valid` to be
false.

## TypeScript and JavaScript

The package root exports `validate(spec, data, options?)`. Options accept `files`,
`loader` and `basepath` for composition. A supplied loader takes precedence over
the in-memory file set.

```js
import { validate } from '@polyspec/crudui-validator';

const spec = {
  type: 'group',
  properties: { email: { type: 'email', validate: { required: true, email: true } } },
};
const result = validate(spec, { email: '' });
if (result.valid || result.errors[0]?.rule !== 'required') {
  throw new Error('Expected required validation failure');
}
```

## PHP

`Polyspec\Crudui\Validator::validate` accepts the specification, data,
optional virtual files, an optional loader and a base path. Its result exposes
`valid`, `errors` and `toArray()`.

```php
<?php
require 'vendor/autoload.php';

use Polyspec\Crudui\Validator;

$spec = [
    'type' => 'group',
    'properties' => [
        'email' => ['type' => 'email', 'validate' => ['required' => true, 'email' => true]],
    ],
];
$result = Validator::validate($spec, ['email' => '']);
if ($result->valid || $result->errors[0]['rule'] !== 'required') {
    throw new RuntimeException('Expected required validation failure');
}
```

## Go

The `validator/validate` package provides `Validate` for an ordered specification value
and `ValidateJSON` for JSON bytes. `ValidateJSON` accepts specification bytes,
data bytes, virtual-file bytes and a base path. Run the example in the
`legacy/packages/validator/go` module. Its result exposes `Valid` and `Errors`.

```go
package main

import (
    "fmt"
    "github.com/polyspec/crudui/packages/validator/go/validator/validate"
)

func main() {
    spec := []byte(`{"type":"group","properties":{"email":{"type":"email","validate":{"required":true,"email":true}}}}`)
    result, err := validate.ValidateJSON(spec, []byte(`{"email":""}`), nil, "")
    if err != nil {
        panic(err)
    }
    if result.Valid || len(result.Errors) == 0 || result.Errors[0].Rule != "required" {
        panic(fmt.Errorf("expected required validation failure"))
    }
}
```

## Rust

The crate root exports `validate` and `ValidateOptions`. Options accept virtual
files, a loader and a base path. Run the example with the `polyspec-crud-ui-validator`
crate and `serde_json` dependencies.

```rust
use polyspec_crud_ui_validator::{validate, ValidateOptions};
use serde_json::json;

fn main() {
    let spec = json!({
        "type": "group",
        "properties": {"email": {"type": "email", "validate": {"required": true, "email": true}}}
    });
    let result = validate(&spec, &json!({"email": ""}), &ValidateOptions::default())
        .expect("specification should load");
    assert!(!result.valid);
    assert_eq!(result.errors[0].rule, "required");
}
```

## Browser validation

Validate a server-rendered form in the browser with the specification the server validates it
with, so a user sees errors before the request is sent. The
[browser validation contract](../spec/form-runtime.md#browser-validation) defines the data, the
error markup and the timing. The server still validates every submission it receives.

1. Render the complete form on the server with `renderForm(form, { action, ... })`, from a
   template compiled with a `keyPrefix`.
2. Send the specification with the page, for example as JSON in a
   `<script type="application/json">` element. The binding calls `validate(spec, data)` without
   files or a loader, so send the specification with its composition resolved.
3. Bind the parsed `form` element with the same key prefix and the page's texts:

```js
import { bindForm } from '@polyspec/crudui-form-binding';

const texts = { 'email.required': 'Enter your email address.', invalid: 'Check the marked fields.' };
const spec = JSON.parse(document.querySelector('#member-spec').textContent);
const binding = bindForm(document.querySelector('#member-form'), spec, {
  keyPrefix: 'form',
  message: (error) => texts[`${error.field}.${error.rule}`] ?? error.message,
  formErrors: (result) => (result.valid ? [] : [texts.invalid]),
});
```

The binding validates a changed field when it loses focus and on every later change, and the whole
form on submit; an invalid form is not sent and focus moves to its first invalid control. Send a
form from script with `form.requestSubmit()`: `form.submit()` fires no `submit` event, so the
binding does not validate it. Call `binding.dispose()` before the page removes the form.
The binding also shows and hides the fields and groups that declare `design.show` as the data
changes ([display](../../packages/form-binding/README.md#display)), without changing a value;
`hiddenPaths(spec, data)` of `@polyspec/crudui-validator` returns the hidden paths for other scripts.

Run the binding checks, including the check in Chromium, Firefox and WebKit, from the repository
root:

```sh
make crudui-test-form-binding
```

## Results and failures

A validation result contains `valid`, a boolean, `errors`, a flat error list, and `hidden`, the
data paths of the fields that `design.show` hides ([visibility](../spec/validation-rules.md#evaluation)).
Each error identifies `path`, `field`, `rule` and `message`, with `value` when available. A
required-input failure is a validation result. A server that stores the submitted data can leave
the values at the `hidden` paths, and everything below them, unstored.

Two failures produce no validation result. A missing composition reference, a
forbidden schema key, a rule name that is not registered (`UNKNOWN_RULE`) or a rule
parameter outside its definition
([parameter errors](../spec/validation-rules.md#parameter-errors)) is a load failure
(`ComposeLoadError`). Submitted data with
the wrong shape is an input failure (`FormInputError`, code `INVALID_FORM_INPUT`):

| Data | Message |
| --- | --- |
| Root data that is not an object, checked before composition | `Form data must be an object` |
| A specification that is not an object, checked after the root data and before composition (CUVR-088) | `Form specification must be an object` |
| Present group data or a repeated group row that is not an object | `Group data must be an object: {path}` |
| Present repeated data that is not a keyed object | `Repeated data must be a keyed object: {path}` |
| An object member in root, group or repeated group row data without a declared field | `Unknown form data field: {path}` |
| An array or object as the value of a [single-choice field](../spec/validation-rules.md#evaluation) or of one of its rows | `Choice data must be a single value: {path}` |

Missing group or repeated data is not a failure. JavaScript and PHP throw the
failure; Go returns it as an error; Rust returns `Err(ValidateError)`. Every
implementation reports the same code, message and location: a load failure's
location is its composition trace joined with `.`, and an input failure's location
is empty. Do not convert a failure into a validation result.

The packages provide these library functions; no package installs a validation
command. The cross-check console compares the four implementations by running each
one in its own process through small programs that call the same functions; its
[validator processes](../../legacy/examples/cross-check-console/validators/README.md)
document that request and response contract.

A field that `design.show` hides for the submitted data is not validated, and its value stays in
the data; see [visibility](../spec/validation-rules.md#evaluation). Which
values to store is decided from the same data. A condition in `validate.required` makes a visible field
optional; see the [expression contract](../spec/expressions.md).

Data validation does not implement HTTP decoding, persistence or transport order.
Follow the [ordered JSON procedure](ordered-json.md) and
[form checks](testing.md#forms-and-reports) for those operations.
Complete symbol references are generated with `make docs-api`; see the
[documentation procedure](documentation.md).
