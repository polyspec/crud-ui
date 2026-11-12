# Input text
<!-- doc-id: docs-spec-input-text -->

[한국어](input-text.ko.md).

Text in specifications and data is a sequence of Unicode scalar values: code points
U+0000 to U+D7FF and U+E000 to U+10FFFF. Every runtime applies the rule below at the same
operations, in the same order, with the same failures. Text that breaks it is rejected. It is
never replaced, for example with U+FFFD, and never passed on to a result.

## Invalid text

- **CUIT-001** JavaScript string: A surrogate code unit that is not part of a high and low pair
- **CUIT-002** PHP, Go and C string: Bytes that are not UTF-8, including an encoded surrogate, an overlong form and a value above U+10FFFF
- **CUIT-003** Rust `String`: None; the type holds only Unicode scalar values
- **CUIT-004** JSON text: A `\u` escape of a surrogate that is not part of a high and low pair, such as `"\ud800"` or the reversed pair `"\udc00\ud800"`

The rule covers every string value and every object member name at any depth. Numbers,
booleans and `null` hold no text.

## Operations and order

Each operation checks its text before any other check, including the argument shape checks.
It checks, in this order:

1. **CUIT-005** The specification, then the composition files it reads.
2. **CUIT-006** Its other arguments, in the order of the table.
3. **CUIT-007** Its options, in code point order of their names.

- **CUIT-008** `validate` — Specification: `spec`, `files`; Other arguments: `data`; Options: `basepath`
- **CUIT-009** `validateList`, `validateDetail` — Specification: `spec`, `files`; Options: `basepath`
- **CUIT-010** `compileForm` — Specification: `spec`, `files`; Options: `basepath`, `keyPrefix`
- **CUIT-011** `bindForm`, `bindButtons`, `createForm` — Other arguments: `template`, `data`; Options: `idPrefix`, `keyPrefix`, `language`, `unsupported`
- **CUIT-012** `buildList`, `renderList` — Specification: `spec`, `files`; Other arguments: `rows`; Options: `basepath`, `data`, `language`, `layout`
- **CUIT-013** `buildDetail`, `renderDetail` — Specification: `spec`, `files`; Other arguments: `record`; Options: `basepath`, `data`, `language`, `layout`
- **CUIT-014** Form `setData` — Other arguments: `data`
- **CUIT-015** Form `setValue` — Other arguments: `path`, `value`
- **CUIT-016** Form `getValue` — Other arguments: `path`
- **CUIT-017** Form `addRow` — Other arguments: `path`; Options: `afterKey`, `key`, `value`
- **CUIT-018** Form `copyRow` — Other arguments: `path`, `key`; Options: `afterKey`, `key`
- **CUIT-019** Form `removeRow`, `moveRow` — Other arguments: `path`, `key`
- **CUIT-020** Form `rekeyRow` — Other arguments: `path`, `oldKey`, `newKey`

The names are the documented argument and option names; each runtime's own spelling, such as
`KeyPrefix` in Go or `key_prefix` in Rust, reports the same name. An option that the caller does
not give is not checked. An operation that composes with a custom loader instead of `files`
checks each document when the loader returns it.

Within one value the check visits array items in index order. For an object it first checks
every member name, then visits the members in code point order of their names. The first
failure found is reported: invalid text, or a value beyond the value limits.

## Value limits

The check walks each value as the JSON tree it denotes, and the same walk bounds it. A JavaScript
array or object, a PHP array or object and a Go map, slice or ordered object can appear at more
than one place of one value: through sharing, through a PHP reference, or because it contains
itself. The walk visits such a container at every place, as the tree holds it there. A value is
beyond its limits when:

- **CUIT-021** it holds more than 1,000,000 nodes, where each array, object, string, number, boolean and
  `null` of the tree is a node, the value itself included; or
- **CUIT-022** it nests more than 256 levels of arrays and objects, the value itself being the first level. 256 is the
  reading limit of the JSON reader ([ordered-json](https://github.com/polyspec/ordered-json)), so every value that a runtime
  accepts can also be written and read as JSON text.

A value that contains itself nests without end, so it is always beyond them. The walk stops at
the first failure in its order, so it visits at most 1,000,001 nodes whatever tree a value
denotes. Invalid text that the walk meets before a limit is reported as invalid text, and a limit
that it passes first is reported as the limit.

The limits apply to every checked value, the specification and the composition files included,
as an input failure that names the value. A custom loader's document is named `files`.

Go's value entries take maps, slices and `*compose.OMap` values that can share nodes, so Go
applies the limits like JavaScript and PHP. A Rust value, a `serde_json::Value` or a
`polyspec_crud_ui_validator::text::JsonText`, owns each of its nodes: it cannot share a container
or contain itself, so a shared container cannot appear twice in a value. Rust's value entries count
nodes and levels: the walk costs no more than building it.

- **CUIT-042** A language value reaches the Rust core through a binding, whose walk of the language
  value (the `HostValue` walk of the bindings) visits a shared container at every place and a
  container that contains itself without end, as the tree that the value denotes holds it, and stops
  at the first failure in the order of this section. The Rust core receives only trees, so the core
  has no value type that shares a node.

The PHP library's value copies and the extension's value conversion apply the same limits to
every value they convert, including members that no check walks, such as a member of a button
that the markup does not read. There the failure is the value failure
`Recursive or excessively nested PHP value` of the [PHP extension](../operations/php-extension.md).

## Failures

A failure in the specification or a composition file is a composition load failure:

- **CUIT-023** code `INVALID_TEXT`;
- **CUIT-024** message `Text must be Unicode scalar values`;
- **CUIT-025** location: the path of the string joined with `.`, where an array item is its index. An invalid
  member name is located at the object that holds it. In a file, the path starts with the file
  name. An invalid file name, and an invalid member name of the specification root, are located
  at the empty path.

A failure in any other argument or option is an input failure:

- **CUIT-026** code `INVALID_FORM_INPUT`;
- **CUIT-027** message `Text must be Unicode scalar values: {name}`, where `{name}` is the argument name, or
  `options.` and the option name, followed by the path inside the value, for example
  `data.rows.k1.name` or `options.data.admin`;
- **CUIT-028** an empty location.

A value beyond the value limits is an input failure in every argument and option:

- **CUIT-029** code `INVALID_FORM_INPUT`;
- **CUIT-030** message `Recursive or excessively nested value: {name}`, where `{name}` is `spec`, `files`, the
  argument name, or `options.` and the option name, with no path;
- **CUIT-031** an empty location.

- **CUIT-041** Each implementation reports a load failure and an input failure with the error types that its entry of this
  list names:
  - JavaScript: a load failure is `ComposeLoadError`, and an input failure is `FormInputError`.
  - PHP and PHP extension: in validation a load failure is `ComposeLoadError`, and an input failure is `FormInputError`; in
    generation a load failure is `ComposeLoadError`, and an input failure is `FormError`.
  - Go: a load failure is `*compose.ComposeLoadError`; an input failure is `*validate.FormInputError` in validation and an
    error with the message in generation.
  - Rust: a load failure is `ComposeLoadError` in `ValidateError::Load` or `FormError`, and an input failure is
    `FormInputError` in `ValidateError::Input` or `FormError`.
  - Python: in validation a load failure is `ComposeLoadError`, and an input failure is `FormInputError`; in generation a
    load failure is `ComposeLoadError`, and an input failure is `FormError`.
- **CUIT-037** JavaScript: `JSON.parse` keeps each escape as a code unit.
- **CUIT-038** Go: `compose.DecodeOrdered`, `generator.DecodeJSON` and the `ValidateJSON`,
  `ValidateListJSON` and `ValidateDetailJSON` entries keep an escaped surrogate as its three
  bytes and keep bytes that are not UTF-8, so the check reports both. `encoding/json` alone
  replaces them. `compose.DecodeRawMembers` splits an object without decoding its values.
  `generator.CheckBindText` checks a decoded template before `FormTemplate` decoding, whose JSON
  encoding would replace invalid text.
- **CUIT-039** PHP: `Polyspec\Crudui\Validator\Support\JsonText::decode` returns what
  `json_decode($json, false, 512, JSON_THROW_ON_ERROR)` returns and keeps an escaped surrogate as
  its three bytes. The class has no dependencies.
- **CUIT-040** Rust: `polyspec_crud_ui_validator::text::JsonText` reads the text with the reader of ordered-json, which
  refuses a repeated member name and keeps an unpaired surrogate escape as its code unit, without replacing anything.
  The JSON texts that the Rust core writes take their string and number tokens from the writer of ordered-json.
  `validate_text`, `validate_list_text` and `validate_detail_text` run the validation entries
  over it, and `polyspec_crud_ui_generator::text` holds the checks of the generation entries.

JSON text is UTF-8. A program that reads a JSON request rejects input that is not UTF-8 as
invalid JSON before decoding it.

## Shared cases

[`tests/fixtures/text-validity`](../../tests/fixtures/text-validity/README.md) holds one case
file for each operation, and `value-graphs.json`, whose cases each runtime that takes shared or
self-containing values builds with its own containers. The Rust core tests build the cases whose
values are trees (`flat` and `chain`); the cases of shared and self-containing values (`doubled`
and `self-twice`) are cases of the bindings' walk (CUIT-042). Byte strings that JSON text cannot carry
are checked by each byte string runtime's own tests.
