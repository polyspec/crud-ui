# CRUDUI contract manifest
<!-- doc-id: contracts-readme -->

[한국어](README.ko.md).

[`features.json`](features.json) connects each feature with its owner package,
input, output, state changes, errors, support matrix, tests and documentation.
The manifest does not copy widget or validation catalogs. Those catalogs remain
derived from the live registries and schema.

[`generator-cases.json`](generator-cases.json) and [`validator-cases.json`](validator-cases.json) are the contract
cases of the members of the interface contracts (`packages/<component>/rust/interface.json`) whose fixtures in
`tests/fixtures` are a rule corpus of another form: sessions of steps, field maps or specifications that an instance
renders. Each group, named after its member, calls the member once per case with the arguments that the case names by
their parameter names, each `json_value` written as `{ "kind", "value" }` (binding G-5): a few cases that succeed and one
case for each kind that the member raises, under `raises`. A case of an operation with a file loader gives the loader as a callback fixture, `{ "callback": { "file_loader.normalize": [<row>], "file_loader.load": [<row>] } }`: a row answers the call that has its `args` with its `result`, or with `raise`, the error that the loader raises for a file that does not exist (CURP-032); the validator has these cases, and those of the generator wait until a case can give a callback of another contract. A case of a failure of the environment, which no argument gives, names the failure that the test feature of the
core injects in `inject` (`random_source`: the random source fails, with the feature `random-failure-test`). They are no copy of the rule corpus, which stays in
`tests/fixtures`, and the Rust test `contract_cases` of each crate runs them at the boundary.

Validate the manifest from the repository root:

```sh
npm run manifest:check
```

The check verifies the manifest shape, package paths, package entries, fixture
links, test links and document links.

Each package lists under `entries` every JavaScript entry of its `package.json`
`exports` map (`"."` and any other code subpath; stylesheets and `package.json`
are not code) with a `visibility` and the exact list of its value exports in
code-unit order; types are not listed. A `public` entry is public API. An
`internal` entry serves CRUDUI's own packages only and is unsupported for
any other import. `npm run manifest:check` builds the packages when their build
is not current, and the check reads the value exports of each entry from its
built ES module files, where types are already erased, with
[es-module-lexer](https://github.com/guybedford/es-module-lexer): an
`export * from` is followed to the module that Node's resolution gives for its
specifier, and a re-export such as `export { default as Widget } from
'./Widget.svelte'` gives its name without loading that module. A CommonJS build
of the entry, such as that of a `require` condition, has no module syntax and is
not read. The check fails when:

- a `package.json` code entry has no manifest entry, or a manifest entry has no
  `package.json` code entry;
- a built file of a `package.json` code entry is missing, or the entry has no ES
  module file;
- the value exports differ from the declared list in either direction, or the
  list is not sorted;
- a function named in an implemented feature's `signature` is not in the public
  `"."` list of its owner;
- an error class named in an implemented feature's `errors` (a name ending in
  `Error`) is neither a JavaScript built-in error nor in the public `"."` list of
  a CRUDUI package;
- a file outside the code of the CRUDUI packages under `packages/` imports an
  `internal` entry. Examples, tests, documents and package READMEs use public
  entries only;
- a file of a package under `packages/` imports a file of another package by a
  relative path (in an import, export, `require`, dynamic import or Vitest module
  mock). A package uses another package only through its entries by name.

[`tests/build/contract-manifest.test.mts`](../tests/build/contract-manifest.test.mts)
proves each failure on a synthetic repository, and `npm run manifest:check`
runs the check on this repository. The CLI can print the same contract
for tools that need a compact machine-readable or Markdown description.

## Interface messages

[`interface-messages.json`](interface-messages.json) holds the interface text of
every supported language: form control labels, counts and summaries
([form markup](../docs/spec/form-markup.md#interface-messages)). It is the only
place the text is written. Each runtime embeds a source generated from it by its
own script and has a test that fails when the embedded text differs from the file;
after editing the file, run every runtime's script:

- TypeScript: the build of `legacy/packages/generator/ts`, whose prebuild script writes the untracked `src/interface-messages.ts`
- Go: `go generate` in `legacy/packages/generator/go`
- Rust: `node packages/generator/rust/tools/generate-interface-messages.mjs`
- PHP: `make php-tables`, which writes the untracked `src/Internal/InterfaceMessages.php` of `legacy/packages/generator/php`
- PHP extension: `node legacy/packages/php-ext/tools/generate-interface-messages.mjs`
