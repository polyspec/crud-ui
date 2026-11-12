# Native generation checks
<!-- doc-id: docs-operations-native-generators -->

[한국어](native-generators.ko.md).

Run commands from the repository root. PHP, Go and Rust provide independent form
and list generators. The PHP extension uses the common PHP classes and performs
generation and validation in native code. The [runtime contract](../spec/runtime-packages.md)
defines the required operations and comparisons.

## Local build and tests

Use a 64-bit PHP installation with `php-config` and matching development headers.
Pure PHP and the extension require PHP 8.4 or later; CI tests PHP 8.4.
Install Composer, Node, Go, Cargo and a C compiler. The container below provides
a complete Linux toolchain.

```sh
make install-tools TOOLS=npm
make install-packages
make install-tools
export PATH="$PWD/var/tools/bin:$PATH"
npm ci --strict-allow-scripts
composer install --no-interaction --prefer-dist
make crudui-test-native
make docs-check
```

`make crudui-test-native` builds the JavaScript packages, builds and loads the extension,
runs generator package tests and compares the JavaScript reference (React server rendering),
the JavaScript HTML renderer, PHP, Go, Rust and native PHP. It runs three parts, which CI runs
in three jobs: `make crudui-test-php-engine` compiles and tests the C engine of the extension with the C
compiler and its sanitizers and needs no PHP; `make crudui-test-native-generators` runs the Go and Rust
generator tests, the protocol and widget tests and the shared suite for the JavaScript, HTML, Go
and Rust targets and needs no PHP; `make crudui-test-php-api` builds and loads the extension and runs its
API tests, the PHP generator tests and the shared suite for the PHP and native PHP
targets, in CI once for each PHP release. Each runtime answers through
a program in [`tests/native-generators/programs`](../../tests/native-generators/README.md#programs)
that calls its package's public API; the packages publish libraries only.
`make build-php-ext` builds the extension with `phpize` from `legacy/packages/php-ext/src`
into `var/php-ext/polyspec_crudui.so`; the `phpize` and `php-config` on `PATH` select
the PHP release, which the job installs with `tools: phpize, php-config` of
`setup-php`.

The PHP API check uses three separate processes: Composer classes, the extension
without Composer, and the extension with Composer. Reflection verifies the actual
class implementation and all public method signatures. The shared generator
suite compares templates, evaluated fields, data, row operations, original HTML
and each rejection's complete code, message and location. It records hashes
before and after execution and fails if an input changes.

The default reports are `native-generators/report.json` of the JavaScript, HTML, Go and Rust
targets and `native-generators/report-php.json` of the PHP and native PHP targets in the Git
directory, resolved with `git rev-parse --git-path`, so they also work in a worktree.
`NATIVE_REPORT` and `PHP_NATIVE_REPORT` select other report paths. Before any PHP check,
`make crudui-test-php-api` reinstalls the validator copy in
`legacy/packages/generator/php`, so the PHP checks never load a copy older than its source. A passing run removes its temporary build directory. A failing
run keeps it, prints its path and records it as `buildDirectory` in the report. The [suite procedure](../../tests/native-generators/README.md)
describes direct invocation with an explicit extension path and the comparison
protocol. Missing executables, missing native classes and malformed responses
fail the checks.

Browser widget checks execute generated selectors and callbacks in Chromium.
Host editor functions verify their received selectors and arguments; these tests
do not install or verify the external editor implementations.

## HTTP and browser verification

Package examples demonstrate each language's library. The
[form comparison](form-comparison.md) defines the JavaScript, PHP, native PHP, Go and Rust
record servers with the HTML, React, Vue and Svelte clients. Its record-store HTTP contract sends
multipart, URL-encoded and JSON saves and invalid requests to every server and reads the saved
records back, also after a restart ([form checks](testing.md#forms-and-reports)).

A browser-generated form with a PHP, Go or Rust validation endpoint does not
establish server rendering. A server rendering result must identify the runtime
that compiled, bound and rendered it. Record the exact source, test results and
deployment separately in [feature status](../features.md).
