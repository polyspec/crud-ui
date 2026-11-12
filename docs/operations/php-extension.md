# PHP extension
<!-- doc-id: docs-operations-php-extension -->

[한국어](php-extension.ko.md).
Implementation, verification and publication are recorded in
[feature status](../features.md).

## Scope and modules

The `crudui` PHP extension provides form generation and validation in the PHP
process. Its package is `legacy/packages/php-ext`; its Composer manifest records the version.
The extension implements the form generator and validator in C.

Generation separates structure compilation, data binding, form instances and
HTML rendering. Generation and validation share composition and expressions.
Both execute inside the PHP process. The extension does not require a Node
process, a validation executable or a PHP implementation of either operation.
It does not require Cargo, rustc, Rust source or a Rust library. The C module uses
the Zend extension API to register the common classes, converts PHP values
directly to ordered engine values and reports engine errors through the common
PHP exceptions. Value conversion does not serialize data or start another
process.

## Public classes and loading

The PHP packages and extension provide the same public classes:
`Polyspec\Crudui\Generator`, `Polyspec\Crudui\Validator` and `Polyspec\Crudui\Form`.
Method names, parameter names, types, defaults, return values and exception types
are identical. API calls do not change with the implementation.

`ComposeLoadError::getCompositionTrace()` returns the original composition path
entries. The exception stores them separately from PHP's exception call stack;
`getTrace()` retains its standard PHP meaning.

`FormError` and `ComposeLoadError` accept an optional fourth `?Throwable $previous` argument, defaulting to `null`.
The third argument remains the form path or composition trace. `getPrevious()` returns the supplied cause in both
implementations. Wrapping a PHP input, rule or composition failure preserves its previous exception and stable error fields.

| Process configuration | Class implementation |
| --- | --- |
| The `crudui` extension is loaded | The extension registers the public classes during module initialization. PHP uses these classes without invoking Composer for them. |
| The extension is not loaded and the PHP packages' Composer autoloader is registered | Composer loads the PHP classes when first used. |
| Neither implementation is available | Class loading fails. |

Installing the extension file does not load it; PHP must enable it at startup.
The PHP packages use class autoloading and do not include public class definitions
through Composer's `files` setting. They do not redeclare loaded native classes.
There is no runtime dispatcher, class alias or separate native namespace.
Errors from a loaded implementation are returned or raised by that implementation;
they do not select another implementation.

Both implementations can be installed together. A process uses one implementation
of these classes. PHP and native comparisons run in separate processes, explicitly
disabling or enabling the extension. Each test target checks class provenance with
reflection; a missing extension fails the native test target.

## Forms

The extension follows the [form runtime contract](../spec/form-runtime.md), including
keyed nested collections, defaults, labels, selection values and display rules.

| API | Operation |
| --- | --- |
| `Polyspec\Crudui\Generator::compileForm(spec, options)` | Compile a data-independent, JSON-serializable form template. |
| `Polyspec\Crudui\Generator::bindForm(template, data, options)` | Evaluate field models without modifying the template or data. |
| `new Polyspec\Crudui\Form(template, data, options)` | Create an independent form instance. |
| `$form->setData(data)` | Replace instance data and reevaluate fields. |
| `$form->getData()` | Return detached submission data. |
| `$form->addRow`, `copyRow`, `removeRow`, `moveRow`, `rekeyRow` | Apply the row operations defined by the form runtime. |
| `Polyspec\Crudui\Generator::renderForm(form, options)` | Return the instance's [complete form](../spec/form-runtime.md#complete-form) HTML. |
| `Polyspec\Crudui\Generator::sequenceRowKey(seq)` | Format a saved sequence as a row key. |

Compilation accepts the same `files`, `basepath` and `keyPrefix` inputs as the
shared compiler. Binding and instances accept `language`, `idPrefix`,
`keyPrefix` and `unsupported`. Templates have the same JSON structure as
templates compiled in JavaScript and can be cached before record data exists.

HTML generation covers the supported field types and layout families. It
preserves the shared names, identifiers, classes, visibility, options and
control values. The host provides the HTML `form` element and submission.
Browser editing and events use the browser form runtime. PHP form generation
does not execute browser scripts or simulate browser events.

For identical template, data, options and row keys, initial data and later
`setData` calls produce identical HTML and submission data. Repeated injection
and record restoration preserve this equality. The cached template is unchanged.
The generated template and submission data also work with React, Vue and Svelte.

List generation follows the same list specification and table/card output
contract as the JavaScript renderers. `Polyspec\Crudui\Generator::buildList` returns the
evaluated list model, and `Polyspec\Crudui\Generator::renderList` receives a list
specification, display rows and rendering options.

## Validation and PHP values

`Polyspec\Crudui\Validator::validate(spec, data, options)` validates submitted data and returns
`valid`, `errors` and `hidden`, the data paths of the fields that `design.show` hides
([evaluation](../spec/validation-rules.md#evaluation)). Error entries preserve `path`, `field`, `rule`, `message`
and `value`. `Polyspec\Crudui\Validator::validateList(spec, options)` checks a list specification and
`Polyspec\Crudui\Validator::validateDetail(spec, options)` checks a detail specification.
Composition inputs use an explicit `files` map and `basepath`.
Specification, composition and data-shape failures raise exceptions; they are not
validation results. Validation uses the shared rules and conformance cases.

Composition errors use `Polyspec\Crudui\Validator\Compose\ComposeLoadError`. Submitted data
with the wrong shape raises `Polyspec\Crudui\Validator\Validate\FormInputError`, constructed
with `message`; `getErrorCode()` returns `INVALID_FORM_INPUT`. A non-empty
sequential root array raises it before composition; the
[validation procedure](validation.md) defines the messages. Generator
operation errors use `Polyspec\Crudui\FormError`, constructed with `errorCode`, `message`
and optional `path`; `getErrorCode()` and `getPath()` return the operation details.
Unsupported fields use `UNSUPPORTED_FIELD_TYPE`; other invalid form operations
use `INVALID_FORM_INPUT`. A failure while constructing a supported field uses
`INTERNAL_ERROR`. PHP argument type violations raise `TypeError`.

PHP scalar types are preserved. Sequential PHP arrays represent JSON arrays;
associative arrays and `stdClass` represent objects. Use `stdClass` for an
explicit empty object. An empty array is accepted for an empty root object
argument, whose type is fixed by its API, except the specification, rows, record and `data` of the
list and detail displays: there a list array is no object ([display formats](../spec/display-formats.md#input)).
Nested values retain their type.
At a JSON input boundary, use `json_decode($json, false, 512, JSON_THROW_ON_ERROR)`;
associative mode cannot preserve empty objects and can make objects with
sequential numeric keys appear as arrays. Associative arrays remain valid for
internal API calls when the caller already knows that the value is an object.
`json_decode` refuses JSON text with an unpaired surrogate escape. To report the
[input text](../spec/input-text.md) failure instead, decode with
`Polyspec\Crudui\Validator\Support\JsonText::decode`, which returns the same values and keeps
that text for the check.
The fixed object options `files` and `data` also accept an empty PHP array.
Returned record objects and cached templates use `stdClass`; lists use arrays.
Object member order and row keys survive conversion in both directions.
Returned templates and form, node, widget and button models keep the library's
member order.
Unsupported PHP values and recursive structures fail explicitly. Strings and
member names that are not valid UTF-8, and values beyond the value limits, fail
as the [input text](../spec/input-text.md) rule defines, before any other check of the
method. A converted value that no check walks and that passes the same limits
fails with `Recursive or excessively nested PHP value`: an
`InvalidArgumentException` from validation and a `Polyspec\Crudui\FormError` with code
`INVALID_FORM_INPUT` from generation.

The extension does not introduce hidden identity or ordering fields. Form
transport and ordered JSON transport submit the same keyed records. JSON parsing
and serialization are independent of form generation and validation.

## Acceptance criteria

The extension build command removes configuration and output generated by an
earlier build before compiling the current source with the current PHP
development headers. Repeated builds do not reuse generated configuration or
output and do not require those generated paths to be writable. Cleanup is
limited to generated configuration and build output. It retains the tracked PHP
test sources in `legacy/packages/php-ext/tests`. The build command creates every output
directory before compilation starts.

The build command uses `php-config` metadata to compile and link the C module
directly. The extension package contains no Cargo manifest, Cargo lock file or
Rust source. The build does not discover or execute Cargo, rustc or rustdoc and
does not link a Rust library. It does not invoke `phpize`, Autoconf or libtool. An
explicitly declared tool path must be absolute and identify one regular
executable. The path and each parent component must not be a symbolic link. When
a tool path is omitted, discovery selects one regular executable with no
symbolic-link path component before the build starts. An invalid explicit path,
missing tool or ambiguous discovery result fails the build; the build does not
select a different tool after a failure. The PHP binary, development metadata and
headers must describe the same PHP installation.
Each explicit tool path is declared through either its command argument or its
environment variable. Declaring the same input through both interfaces fails
before compilation.

Debian-derived Linux builds read the installed `gcc` package record, require one
installed versioned compiler dependency, follow its one installed target compiler
dependency and select that package's one regular target compiler file. They do not
execute an unversioned compiler link. Matrix builds pass the regular versioned
`php-config` file for the selected PHP release. macOS builds read one installed
Homebrew PHP formula record when `php-config` is not declared.

Linux builds create one shared object and link the platform dynamic-loading, math
and thread libraries. macOS builds create one bundle, allow PHP symbols to resolve
when the module loads, link iconv and Core Foundation, and apply the declared
minimum macOS version to C compilation and linking. Generated configuration,
objects and the module output must contain only regular files and directories.
The build fails if any generated path is a symbolic link.

1. Build and load the extension on PHP with its development headers. Run the same
   API calls with the extension enabled and disabled. With Composer
   registered in both processes, use PHP reflection to verify native class
   registration or PHP class autoloading and compare all public method signatures.
   Also verify native execution without the PHP packages installed.
2. Run the shared composition, expression, form and validation cases against
   native code. Compare template and field models with the JavaScript generator.
3. Generate all supported field layouts and compare parsed HTML, attributes,
   CSS, visibility and control state with the existing renderers.
4. Compare initial data, later injection, repeated injection and restoration
   using exact HTML and data equality within the native renderer.
5. Test nested copying, insertion, removal, reordering and saved sequence keys,
   including explicit empty collections and failed atomic operations.
6. Provide an executable PHP extension example that generates forms, accepts
   form and ordered JSON requests, validates them and reloads stored records.
7. Verify React, Vue and Svelte with the native PHP target, including browser
   input, focus, row operations and both data initialization paths.
8. Run the checks in CI and record results separately from package publication.
