# CRUDUI PHP generator
<!-- doc-id: packages-generator-php-readme -->

[한국어](README.ko.md).

Compile reusable form structures, bind record data, edit keyed rows and render
forms, lists or read-only details in PHP. Rendering and validation run in the PHP process.

## Install and verify

From the repository root:

```sh
composer install
composer test --working-dir=legacy/packages/generator/php
```

The Composer path repository links `polyspec/crudui-validator` from the adjacent
package into `vendor/`. 64-bit PHP 8.4 or newer and `mbstring` are required.
Development tests also require the extensions used by PHPUnit, including DOM.

## Form API

```php
require 'vendor/autoload.php';

use Polyspec\Crudui\Form;
use Polyspec\Crudui\Generator;

$spec = json_decode('{"type":"group","properties":{"name":{"type":"text","label":"Name"}}}');
$template = Generator::compileForm($spec, ['keyPrefix' => 'form']);
$cache = json_encode($template, JSON_THROW_ON_ERROR);

$initial = new Form($template, ['name' => 'Ada']);
$injected = new Form(json_decode($cache, false, 512, JSON_THROW_ON_ERROR));
$injected->setData(['name' => 'Ada']);
assert(Generator::renderForm($initial) === Generator::renderForm($injected));
echo Generator::renderForm($initial);
```

Compilation accepts `files`, `basepath` and `keyPrefix`. Binding and instances
accept `language`, `idPrefix`, `keyPrefix` and `unsupported`. Use distinct
`idPrefix` values when multiple forms appear in one document.

`Generator::bindForm($template, $data, $options)` returns evaluated field models.
`Generator::renderForm($form)` returns HTML without an HTML `form` element.
`Generator::renderList($spec, $rows, $options)` renders supplied rows in the `table`
or `card` layout selected by `options.layout`.
`Generator::buildList($spec, $rows, $options)` returns the same evaluated list model used by rendering.
`Generator::renderDetail($spec, $record, $options)` renders one supplied record as a
read-only detail, and `Generator::buildDetail($spec, $record, $options)` returns the
markup-free detail model the renderer uses. `Generator::buildOutline($nodes)` returns the structure map rows of evaluated nodes. Neither rendering method reads other
data. The host provides submission handling, styles and browser integrations declared by
fields.

Date and datetime controls and list date formatting use UTC. Explicit offsets
are converted before display; timestamps without offsets are interpreted in UTC.
Invalid or unsupported date strings and the original instance data remain unchanged.

`Form` provides `getTemplate`, `getFields`, `getDescription` (the root description translated
for the instance language), `getRevision`, `getData`, `getValue`, `setData`, `setValue`, `addRow`,
`copyRow`, `removeRow`, `moveRow` and `rekeyRow`.
Returned values are detached copies. Invalid operations leave data, fields and
revision unchanged.

```php
$companySpec = json_decode('{"type":"group","properties":{"companies":{"type":"group","multiple":true,"properties":{"name":{"type":"text"}}}}}');
$form = new Form(Generator::compileForm($companySpec), ['companies' => new stdClass()]);
$key = Generator::sequenceRowKey(42);
$form->addRow('companies', ['key' => $key, 'value' => ['name' => 'Example']]);
$form->copyRow('companies', $key, ['key' => 'new-company']);
$form->moveRow('companies', 'new-company', 0);
$form->rekeyRow('companies', 'new-company', Generator::sequenceRowKey(43));
```

Repeated data is an object keyed by row identity. Missing repeated data creates
one row; an explicit empty `stdClass` creates zero rows. Sequential PHP arrays
are JSON arrays. Associative PHP arrays and `stdClass` are objects. Returned
records and templates are `stdClass`; lists are arrays. Nested empty arrays,
empty objects and `null` remain distinct. Numeric row keys are rejected; use
`sequenceRowKey` to format database sequences.

At a JSON boundary, decode with `json_decode($json, false, 512, JSON_THROW_ON_ERROR)`.
The `true` associative mode loses the distinction between an empty object and an
array, and can also make an object with sequential numeric keys appear to be a
list. Use `new stdClass()` for an explicit empty object. An associative array is
accepted for an object argument, and an empty array for an empty root object argument,
whose type is fixed by its API.

Composition failures raise `Polyspec\Crudui\Validator\Compose\ComposeLoadError`.
Its `getCompositionTrace()` returns specification paths separately from the
exception stack returned by `getTrace()`.
Generation failures raise `Polyspec\Crudui\FormError`; `getErrorCode()` and `getPath()`
return the error code and field path. Unsupported fields use
`UNSUPPORTED_FIELD_TYPE`; other invalid generation input uses `INVALID_FORM_INPUT`.
Invalid public argument types raise `TypeError`.
Invalid UTF-8 strings and object keys are rejected before form state changes.

## PHP example

```sh
CRUDUI_DATA_FILE=/tmp/crudui-php-example.json php -S 127.0.0.1:8082 -t legacy/packages/generator/php/examples
```

The example declares a form, a list and a detail specification for the same
record and serves three pages from one stored record file:

| Page | URL | Output |
| --- | --- | --- |
| Form | `http://127.0.0.1:8082/` | `Generator::renderForm`; accepts a native form submission, validates it, stores a valid record as JSON at the explicit path and reloads it |
| List | `http://127.0.0.1:8082/?view=list` | `Generator::renderList` with the stored record as its only row (no rows before the first save); the name links to the detail page, the level uses `choice-label` and the note is truncated `text` |
| Detail | `http://127.0.0.1:8082/?view=detail` | `Generator::renderDetail` of the stored record; the email is a `mailto:` link and the level uses `choice-label` |

Every page takes its styles from `crudui.css`. The same file runs unchanged when
the `crudui` extension is loaded, for example with
`-d "extension=$(pwd)/legacy/packages/php-ext/modules/crudui.so"`. It does not provide
browser row editing or an ordered JSON HTTP endpoint.

## Conformance

The [native conformance suite](../../../../tests/native-generators/README.md) compares
complete templates and models, original form and list HTML, injection, row
operations and retained state after failures across runtimes.

The [form contract](../../../../docs/spec/form-runtime.md),
[PHP API contract](../../../../docs/operations/php-extension.md) and
[runtime requirements](../../../../docs/spec/runtime-packages.md) define shared
behavior. [Feature status](../../../../docs/features.md) records verification and
publication separately.
