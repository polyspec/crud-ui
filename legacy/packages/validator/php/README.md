# CRUDUI PHP validator
<!-- doc-id: packages-validator-php-readme -->

[한국어](README.ko.md).

Compose specifications, evaluate expressions and validate data in PHP.

```sh
composer install
composer test --working-dir=legacy/packages/validator/php
```

## Public API

```php
require 'vendor/autoload.php';

use Polyspec\Crudui\Validator;

$spec = json_decode('{"type":"group","properties":{"name":{"type":"text","validate":{"required":true}}}}');
$result = Validator::validate($spec, ['name' => 'Ada']);
assert($result->valid);
```

`Validator::validate($spec, $data, $options)` composes the specification, scans
for unsupported metadata and validates submitted data. `Validator::validateList`
checks list specification composition and metadata; it does not validate rows.
`Validator::validateDetail` checks detail specification composition, including
`$ref` and `$patch` on the root and the `fields` map, and metadata; it does not
validate a record. Both return `{ valid: true, errors: [] }` on a clean load.
Options accept a `files` object and `basepath`. Composition failures raise
`Polyspec\Crudui\Validator\Compose\ComposeLoadError`. Submitted data with the wrong shape
raises `Polyspec\Crudui\Validator\Validate\FormInputError` with code `INVALID_FORM_INPUT`.
`getCompositionTrace()` returns the specification paths; `getTrace()` returns
the exception stack.

Results and error entries are `stdClass` objects. `errors` is an array of
`path`, `field`, `rule`, `message` and `value` records. Associative PHP arrays and
`stdClass` represent objects; sequential PHP arrays represent arrays. Empty
objects require `new stdClass()`. Nested objects, arrays and `null` remain
distinct, including error values. Invalid UTF-8 strings and object keys raise
`InvalidArgumentException` before validation.

The public class is `Polyspec\Crudui\Validator`. If the native extension registers the
class, PHP uses that implementation; otherwise Composer autoloads the PHP class.
The [PHP API contract](../../../../docs/operations/php-extension.md) defines method equality
and loading behavior. Internal composition and expression modules are shared
with the [PHP generator](../../generator/php/README.md).

`composer test` runs composition, expression, current validation, field-model,
rule and public symbol documentation tests through the repository test
runner, which prints every test with its elapsed time. [Feature status](../../../../docs/features.md)
records current verification separately from publication.
