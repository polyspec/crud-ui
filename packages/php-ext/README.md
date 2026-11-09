# Native PHP generation and validation
<!-- doc-id: packages-php-ext-readme -->

[한국어](README.ko.md).

The `polyspec_crudui` extension provides `Polyspec\Crudui\Generator`, `Polyspec\Crudui\Validator` and
`Polyspec\Crudui\Form` in the PHP process. The C module registers the PHP classes and
converts PHP values directly to its ordered value model.

The [PHP API specification](../../docs/operations/php-extension.md) defines methods,
loading, data types and exceptions. When enabled, the extension's classes are
available before Composer autoloading. With the extension disabled, Composer
loads the PHP packages. Each process uses one implementation.

## Build and verification

Build from the complete repository with 64-bit PHP 8.4 or later, its development
tools (`phpize` and `php-config`) and a C compiler. Linux and macOS are supported
build targets. macOS builds target 11.0 or later. `make build-php-ext` builds
the extension with `phpize` into `var/php-ext/polyspec_crudui.so`, in a copy of
the package that keeps `composer.json` beside `src/`, so that `src/config.m4`
takes the version of the extension from `composer.json`.

The `pattern` and `match` rules use no regular-expression library: the engine
recognizes CRUDUI patterns and matches them itself in linear time over the Unicode
data it embeds (`src/unicode_data.c`, which `make php-ext-tables` generates from
`contracts/unicode-properties.json` before each build; the file is not tracked). The build needs no
PCRE2 files or `pkg-config`.

Run from the repository root:

```sh
make build-php-ext
composer install
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts phpunit --cwd packages/php-ext
npm run build
node tests/native-generators/run.mts \
  --extension "$(pwd)/var/php-ext/polyspec_crudui.so" \
  --report .git/native-generators/report.json
```

The API checks execute PHP with the extension disabled, the extension without
Composer, and the extension with Composer. They inspect class provenance and
method signatures, conversion, exceptions, cloning, row operations and repeated
instance creation. Validation uses shared form and list validity fixtures.
Generator conformance checks the extension separately from the PHP package.

`src/polyspec_crudui.stub.php` defines native PHP signatures. Regenerate
`src/polyspec_crudui_arginfo.h` with the PHP development tools after changing the stubs:

```sh
/absolute/path/to/php -n /absolute/path/to/php-build/gen_stub.php \
  packages/php-ext/src/polyspec_crudui.stub.php
```

Both external paths must be regular files from the same PHP development
installation. The build does not create or retain a local PHP build-tool copy.

The generated header is committed; PHP classes are not declared by including the
stub file. Cached templates are ordinary JSON objects. Native `Form` instances
are not PHP-serializable; cache the template and persist `getData()` instead.

## HTTP example

The PHP example loads the extension and calls its public classes:

```sh
CRUDUI_DATA_FILE=/absolute/path/to/record.json \
  php -n -d "extension=$(pwd)/var/php-ext/polyspec_crudui.so" \
  -S 127.0.0.1:8080 packages/generator/php/examples/index.php
```

The example renders HTML, validates a form submission and stores accepted data
as JSON. It requires an explicit record path. Package build and HTTP verification
are distinct from publication; current results are in
[feature status](../../docs/features.md).
