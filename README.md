# CRUDUI
<!-- doc-id: readme -->

[한국어](README.ko.md).

CRUDUI defines forms, lists, details and validation in YAML or JavaScript objects. A shared
core compiles form structure before data is available. React, Vue and Svelte
render editable instances. The framework-independent HTML renderer provides
form and list HTML without a UI framework. PHP, Go, Rust and Python provide form and list rendering and
validation in their own processes. A PHP extension provides the same public PHP
classes using native generation and validation.

## Start

Run from the repository root:

```sh
npm_config_cache="$PWD/var/bootstrap/npm-cache" npm exec --yes --package="$(node -p 'require("./package.json").packageManager.split("+")[0]')" -- npm ci --ignore-scripts
make install-tools TOOLS=npm
make install-packages
make install-tools
export PATH="$PWD/var/tools/bin:$PATH"
npm ci --strict-allow-scripts
npm run build
npm run test:forms
```

See [form setup and usage](docs/operations/forms.md) for compiling, caching,
mounting and injecting data.

## Documentation

[Online documentation](https://polyspec.github.io/crudui/) provides the English
and Korean guides, specifications and generated API references.

- [Specification structure](docs/spec/schema.md)
- [Display formats](docs/spec/display-formats.md)
- [Canonical examples](docs/operations/examples.md)
- [List and detail development](docs/operations/displays.md)
- [Form runtime contract](docs/spec/form-runtime.md)
- [Runtime packages and APIs](docs/spec/runtime-packages.md)
- [Native PHP package](legacy/packages/php-ext/README.md)
- [Feature and deployment status](docs/features.md)
- [Development and verification](docs/operations/forms.md)
- [Documentation maintenance](docs/operations/documentation.md)
- [Changes](CHANGELOG.md)
- [Development rules](AGENTS.md)

Run `make docs-check` to check documentation and `make docs` to generate API
references, schema and the documentation web. Test success and deployment status
are recorded separately.
