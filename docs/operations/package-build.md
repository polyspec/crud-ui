# Package builds
<!-- doc-id: docs-operations-package-build -->

[Korean](package-build.ko.md).

Package builds produce JavaScript, public TypeScript declarations and declared
stylesheets from the same source. JavaScript retains each package's declared
CommonJS and ES module formats. TypeScript generates declarations from the public
entry and its imports, with the package's strict compiler options and
`noEmitOnError`. Tests are checked separately from distributable declarations.

Test configuration files declare the module format used by their loader. A Vitest
configuration that uses ES module syntax uses an `.mts` or `.mjs` extension, or a
closest `package.json` with `"type": "module"`. A package that publishes CommonJS
`.js` files retains its CommonJS package type and uses `.mts` for an ES module
Vitest configuration. An ES module Vite configuration resolves paths from
`import.meta.dirname`; it does not use the CommonJS-only `__dirname` binding.
Configuration checks discover source files from the extracted repository tree and
do not require Git metadata. They exclude generated and dependency directories.

The declaration compiler does not receive deprecated module-resolution options
from the JavaScript bundler. Build commands do not suppress type errors or create
substitute declarations. A clean build removes preceding output before producing
the next package artifacts. Watch commands regenerate declarations after a
successful JavaScript build.

Every named type referenced by a public TypeScript declaration is exported from
the package entry point and included in the generated API reference. The API
reference covers each package's public `"."` entry; the `./internal` entries of
generator-core and the validator are built beside it with shared chunks in both module formats, so both
entries use one copy of each module, and it is not documented as public API. API Extractor
checks each package with the copied `config/api-extractor.kit.json` (`make lint-ts`): an undocumented export
(`ae-undocumented`) and a public declaration that references an unexported type (`ae-forgotten-export`) are errors, and
the public API equals the committed report `etc/<package>.api.md`, so API generation and the documentation check fail on
them. The documentation pipeline does not suppress references to unexported public types.

Generated output is not tracked in Git. Svelte's `.svelte-kit` directory is
temporary packaging output; `src` is the build input and `dist` is the published
output. A build must succeed without a preceding `.svelte-kit` directory.
Compiled Go CLI executables are generated from source and excluded from Git.
A CLI is built before use.

Repository Make targets may prepend tool directories to `PATH`. Each recipe
command that depends on an added directory explicitly supplies the expanded
`PATH` when invoking the tool. The tool must resolve from that directory when
Make's process started without it.
Rust recipes do not add a Cargo proxy directory to `PATH`. They use the shared
Rust command entry point, which executes the regular Cargo, rustc and rustdoc
files selected by the toolchain record.

Repository Node.js build and test entry points resolve Rust tools through one
shared rule. An invocation may declare absolute Cargo, rustc and rustdoc paths.
Otherwise, the entry point uses the Cargo, rustc and rustdoc that `PATH` names: the
shims of mise put the toolchain that `rust-toolchain.toml` pins on `PATH`. The
entry point resolves each name to the absolute path that the shell finds, runs
`cargo --version`, `rustc --version` and `rustdoc --version` on those paths, and
requires each to report its tool. The working directory of the Cargo command must
be an absolute directory that is not a symbolic link and is canonical. Missing,
mismatched or unverifiable tools fail before a build starts. The entry point
executes the resolved Cargo path, sets `RUSTC` and `RUSTDOC` to the resolved
compiler paths, and does not substitute Rust commands from any other source.

The specification CLI runs its TypeScript source through `tsx`. Its generator
imports load the validator through the public package entry, so local commands
and CI tests build the validator before running the CLI. Dependency installation
alone does not generate that package output.

## Package names

The packages follow the naming of the polyspec repositories, as template and hyper do:

| Language | Name |
|---|---|
| npm | `@polyspec/crudui-<name>`: `@polyspec/crudui-cli`, `@polyspec/crudui-form-binding`, `@polyspec/crudui-generator-core`, `@polyspec/crudui-generator-html`, `@polyspec/crudui-generator-react`, `@polyspec/crudui-generator-svelte`, `@polyspec/crudui-generator-vue`, `@polyspec/crudui-validator`; the private workspace root is `@polyspec/crudui-workspace` |
| Composer | `polyspec/crudui-generator` and `polyspec/crudui-validator`, with the PHP namespace `Polyspec\Crudui\`: the classes `Polyspec\Crudui\Generator`, `Polyspec\Crudui\Validator`, `Polyspec\Crudui\Form` and `Polyspec\Crudui\FormError`, the internal namespaces `Polyspec\Crudui\Generator\` and `Polyspec\Crudui\Validator\`; the PHP extension registers the same classes |
| Rust | the crates `polyspec-crudui-generator` and `polyspec-crudui-validator`, with the libraries `polyspec_crudui_generator` and `polyspec_crudui_validator` |
| Go | the modules `github.com/polyspec/crudui/packages/generator/go` and `github.com/polyspec/crudui/packages/validator/go` |

The programs of `examples/`, `tests/` and `tools/` follow the same convention: the private npm package
`@polyspec/crudui-cross-check-console`, the crates `polyspec-crudui-cross-check-validator`,
`polyspec-crudui-form-comparison`, `polyspec-crudui-native-generator` and `polyspec-crudui-bench` with binaries of the
same names, and for each `go.mod` the module `github.com/polyspec/crudui/<directory>`.

`tests/build/package-names.test.mts` requires these names and fails for a maintained file that names a package
by an earlier form; the changelog, the checklist and the wave descriptions keep the names that their entries recorded.

## Acceptance

- `npm ci --strict-allow-scripts` installs the pinned dependencies, and `npm run build` executes the
  declared validator and generator builds in dependency order.
- The validator, generator-core, generator-html and generator-react load through their public
  CommonJS and ES module exports without importing package source paths.
- `@polyspec/crudui-form-binding` loads only through its ES module export. Its declarations are in ES
  module format, and neither Node.js nor TypeScript resolves the package for a CommonJS project.
- `@polyspec/crudui-generator-vue` declares `"type": "module"` and loads through its ES module and
  CommonJS exports. Its declarations are in ES module format and their relative imports name `.js`
  files, so strict `NodeNext` ES module and CommonJS projects compile against them.
- `@polyspec/crudui-generator-svelte` loads through its `svelte` export. Its declarations are in ES module
  format, and their relative imports name `.js` files or `.svelte` files. A strict `NodeNext` ES
  module project compiles against them when an import of a `.svelte` file resolves to the
  `.svelte.d.ts` declaration beside it, as the Svelte toolchain resolves it.
- Strict install projects resolve public types and their complete declaration imports.
- Install verification installs every package that `contracts/features.json` records, and
  repeated builds compare the output of every one of them; a check whose package list differs
  from that record fails.
- Install verification packs each workspace from its package directory. The
  `pack --json` result of the recorded npm release contains exactly one package record.
  The record reports the same package name and one archive filename.
- React's exported stylesheet exists and matches its declared source stylesheet.
- Repeated builds preserve the public API and produce the same artifacts for
  unchanged inputs.

These checks cover package generation and installation. Form control behavior,
validation conformance, SSR and browser interaction retain their separate tests.

Dependency resolution uses the version constraints declared in package manifests.
The lock file records the resolved dependency graph, including optional native
packages for supported platforms. Clean installations use
`npm ci --strict-allow-scripts`; package and
install checks run against the resolved graph before verification is recorded.
Installation runs dependency lifecycle scripts. Each independently installed
dependency graph records required script approvals as exact package versions in
the `allowScripts` field of that graph's root package manifest. Name-only and
version-range approvals are not accepted. A clean install uses npm's strict
approval check and fails before installation when any lifecycle script is not
covered by an exact approval.
Workspace packages use the root lock file and do not maintain package-level lock
files.
The root development dependencies include the shared test runner so that testing
integrations installed at the root can resolve it through normal module lookup.
Every repository-root Node.js entry point invoked by a build or test target
declares each directly imported third-party package in the root manifest. A
workspace package is available through the root workspace declaration. A
transitive dependency or a dependency declared only by another workspace does
not satisfy a root entry point.
Repository-root test commands may load modules below `examples/`. The root
manifest declares every third-party package imported by those modules, and one
clean root installation provides those dependencies. Tests do not depend on an
ignored nested `node_modules` directory. The cross-check renderer resolves Vite
and the Svelte Vite plugin by package specifier; it does not construct a path
inside `node_modules`.

Dependency updates are prepared and verified locally. The repository does not
schedule dependency update pull requests. Updated manifests and lock files are
verified together with the relevant package and documentation checks.
Composer path repositories for repository-local packages keep Composer's default link: `vendor/` links each local
package to its source directory, and the package's own `composer.json` declares its autoload, so no copy can fall
behind its source. What a release ships is proved by the install of the release archives
(`make release-consumer`), not by a copy in the development `vendor/`.
Composer reads the version declared by each local package and resolves the development profile's compatible requirements. The selected native lock and installed metadata record that actual source version.

## Runtime and dependency versions

Every tool that builds, installs or checks the repository runs at one exact
version that the checkout records, locally and in CI,
so the same tree gives the same result on every date and machine. A newer
release is adopted by changing its record, which the checks then require
everywhere. Releases are chosen when the record changes: runtimes that publish an
LTS channel use their latest active LTS release, Node.js its newest even-numbered
stable major designated as the active or next LTS release, and other tools their
latest stable release supported by the project. Pre-release versions are excluded
unless a specification explicitly requires one. No run queries a registry for the
latest release of a channel, and no tool installs another version on its own.

Before the first `make`, install the root lock with native npm at the release declared in `packageManager`:

```sh
npm_config_cache="$PWD/var/bootstrap/npm-cache" npm exec --yes --package="$(node -p 'require("./package.json").packageManager.split("+")[0]')" -- npm ci --ignore-scripts
```

This command installs `@polyspec/kit`, whose utilities the recipes of the Makefile run: from
`node_modules/@polyspec/kit/dist` of the packed release, or from the sources of a kit checkout that `.links` links. The
Makefile holds every recipe that it runs; kit includes none and writes no file of this
repository. CI runs this bootstrap after setup-node and before its first make command. The bootstrap npm cache
belongs to the checkout at `var/bootstrap/npm-cache`.

- `node` of `mise.toml` records the exact Node.js release, which `make install-tools TOOLS=npm` installs into
  `var/tools` with mise and `var/tools/bin/node` runs; CI's setup-node reads it only to start that bootstrap (kit K171).
- `packageManager` of the root `package.json` records the exact npm release,
  because the npm that installs, packs and runs the scripts changes their results,
  as the `pack --json` report changed from an array in npm 11 to an object in
  npm 12. `make install-tools` (`node_modules/@polyspec/kit/dist/install-tools.mjs`) installs exactly
  that release into the ignored directory `var/tools/npm` of the checkout and never
  into the machine, whose npm every other checkout uses. The Makefile puts
  `var/tools/bin` first on `PATH`. After the native bootstrap, CI starts repository tools through make targets.
- The kit of the checkout, `@polyspec/kit`, pins one release of each toolchain (Node.js 26.12.0, Python 3.14, PHP 8.4,
  Go 1.27.2, Rust 1.99.0, TypeScript 7.0.2), and the declarations and manifest floors are the recorded releases of the checkout
  that is not the pin: `node` of `mise.toml`, `engines.node` of every `package.json` (`>=26.12.0`), `require.php` of every
  `composer.json` (`>=8.4`), `requires-python` of every `pyproject.toml` (`>=3.14`), the `go` line of every `go.mod`
  (`1.27.2`, with no `toolchain` line), `rust-version` of every Cargo package and `typescript` of every manifest and
  lock. A deviation is an entry of `exceptions` in `config/toolchain.json` with its scope, reason and retry condition:
  `packages/svelte` keeps TypeScript 6.0.3, because svelte-check and `@sveltejs/package` require the
  TypeScript 6 API.
- `mise.toml` records the exact Go release, the pin of kit, and `make install-tools` installs it with mise at the digest of
  `mise.lock`, in CI too; the `go` line of every `go.mod` is that release, and
  `GOTOOLCHAIN=local`, which the Makefile and CI set, keeps go from downloading another toolchain. The Go modules of
  the repository, and the Go module of the OrderedJSON checkout of the comparison, resolve each other through the root
  `go.work`; no `go.mod` names a `replace`.
- `rust-toolchain.toml` records the exact Rust release with the profile `minimal`
  and the components `rustfmt` and `clippy`. The Makefile and CI set
  `RUSTUP_AUTO_INSTALL=0`, so a cargo without the installed toolchain fails with
  rustup's message instead of installing it; `make install` and CI install it
  with `rustup toolchain install --no-self-update`.
- `config/toolchain.json` records the tested PHP minor releases in `php`, the
  minor release of Python, which runs the Python packages and their suites in `var/python`
  (`make crudui-install-python`), in `python`, compared like PHP, the exact Composer release in `composer`
  (an object with `version` and the SHA-256 of its phar), the `go.mod` whose `go` line is the Go release in `go`, the
  exact releases and digests of uv and the Python build, alint, ruff, vulture, golangci-lint and deadcode, the exact
  cargo-audit release in `cargoAudit`, the fields
  that the tools of kit read. PHP is pinned by its minor release, because
  setup-php cannot install the same patch as every other tool of the checkout: the checks compare the
  major and minor of the running PHP, and the patch that a run ran on is its
  evidence, which `node_modules/@polyspec/kit/dist/check-toolchain.mjs` prints and
  `var/full-run.json` records with the other running releases.
- The recorded releases are installed by kit (K854: the tool check is removed; a tool that is missing fails the target that uses it).

The repository tracks no container definition: Linux runs on the CI runners. Package lock files
record resolved package versions; they do not select a runtime release.

GitHub-hosted CI runs on `ubuntu-24.04` and names every action by the commit SHA
of one release, with the release in a comment. Native report upload uses
`actions/upload-artifact` 7, whose action runtime is Node.js 24. An action that
declares a deprecated Node.js runtime is not accepted even when the runner
replaces that runtime during execution.

The browser checks run Chrome and Firefox at the builds that the locked
`puppeteer` pins and WebKit at the build that the locked `playwright` pins;
`node scripts/install-browsers.mts <chrome|firefox|webkit>...` installs them, and
no browser of the machine or of a release channel is used. Linux CI browser jobs
keep the cache of Puppeteer in `.tools/puppeteer` of the checkout
(`PUPPETEER_CACHE_DIR`) and install the set-user-ID sandbox helper of that
Chrome at `/usr/local/sbin/chrome-devel-sandbox`, which `CHROME_DEVEL_SANDBOX`
names. Before tests start, a preflight requires the browser and every parent path
component to be regular filesystem entries with no symbolic-link resolution. The
preflight launches Chrome without sandbox-disabling arguments and requires
`chrome://sandbox` to report `You are adequately sandboxed.` This status requires
a namespace or SUID first layer, PID and network namespaces, and Seccomp-BPF. Any
failed condition fails the job. A failed sandbox condition names the evaluation
or the `chrome://sandbox` row, its reported value and the required value. CI
browser checks do not use `--no-sandbox` or `--disable-setuid-sandbox`.

Every Git-tracked npm lock file is a maintained dependency graph. The root
installation must make `npm ls --all` return status 0 without invalid, missing or
conflicting dependencies. The root lock file holds one version of a package wherever
one version satisfies the ranges: `tests/build/dependency-health.test.mts` fails for a
package that the lock file installs at two versions when one of them satisfies every
range that the packages loading either copy declare, each package loading the copy in
the nearest `node_modules` upward from its location. `npm ci --dry-run --strict-allow-scripts` must succeed
for each graph.
npm installs a package from the npm registry, from a workspace or from a checkout
directory that a make target installs. The root manifest pins `@polyspec/kit` and
`@polyspec/ordered-json` by the URLs of their release assets, every package of the lock
file records its SHA-512 integrity, and `.npmrc` sets `allow-remote=root` and
`allow-git=none`, so npm accepts only the URLs that the root manifest names and rejects a
URL or Git source that a dependency introduces.
A tool with no secure compatible stable release is replaced. Dependency overrides
and audit exclusions do not satisfy these checks. Unused build and documentation
dependencies are removed.

### Dependency review

Dependencies are judged by the state known at their review, never by a registry
query of a check, so one tree gives one result at any time. The review covers the
registry dependencies: the `dependencies` and `devDependencies` of the root
`package.json` and of each workspace, and the `require` and `require-dev` of the
Composer manifests that `composerPlatforms` of `config/dependency-policy.json` names
(the development root `composer.json`, whose lock resolves `packages/validator/php` and `packages/generator/php`) and the
`build-system.requires` pins of the Python manifests that `pythonManifests` names (`packages/validator/python` and
`packages/generator/python`). Peer dependencies, URL
dependencies, packages of this repository and Composer platform requirements are
outside the review by definition. A polyspec package taken from a GitHub tag is the
release of that tag: the check requires the root manifest to link it to the checkout of
the tag, the checkout to have the version of the tag and the lock file to record that
version. `make dependency-review` (`node_modules/@polyspec/kit/dist/dependency-review.mjs`) asks the registries for
the latest stable release of each registry dependency that its publisher has not
deprecated, and for the advisories of `package-lock.json` (moderate, high and
critical), of each `composer.lock` (every advisory and abandoned package) and of
every Cargo lock of the checkout, which cargo-audit reads from the RustSec advisory
database (every vulnerability and every unmaintained, unsound or yanked crate).
`make install-tools` installs the cargo-audit release of `config/toolchain.json` into
`var/tools/cargo-audit`. The Go modules of the checkout require only modules of
the checkout through `replace`, so the review records no Go dependency and no `go.sum`.
`RECORD=1` writes the review with the sha256 of each lock to
`config/dependency-review.json`, and `UPDATE=1` first raises each newer dependency
in its manifest, keeping its range operator, and after the npm updates runs
`npm dedupe`, because `npm install --workspace` keeps the release that the root
installs and adds the raised release beside it. The scheduled workflow
`.github/workflows/dependency-review.yml` runs the review every day; no check and
no gating CI job runs it.

`make dependency-policy-check` (`node_modules/@polyspec/kit/dist/check-dependency-policy.mjs`) reads only the files of the checkout
and reports each finding with its rule and fix; `make dependency-policy-mutation-check` requires
the check to reject each known mutation of a copy of the dependency files; `make crudui-test-dependencies` runs both and
`npm run test:dependencies`.
It fails when a lock changed after its review, a registry dependency has no review
entry or is locked at another version than its review recorded, a registry
dependency is older than the latest stable release of its review without an
exception, an exception names a dependency at its latest release, a lock had an
advisory at its review, `package-lock.json` does not record a manifest, a package
of this repository is not required at its own version, or `composer validate
--strict` without a network finds a Composer lock that is not current, or a Composer manifest whose
`config.platform.php` or lock `platform-overrides` differs from the `php` of its entry in `composerPlatforms` (`8.4.1`,
the lowest PHP release that the locked PHPUnit supports). An
exception of `config/dependency-policy.json` names its ecosystem, manifest and
package and declares a reproduced reason, a removal condition and verification
commands.

### Offline checks

A check reads no network. The Makefile exports `CARGO_NET_OFFLINE=true`,
`GOPROXY=off`, `npm_config_offline=true` and `COMPOSER_DISABLE_NETWORK=1` for every
recipe and the commands that it starts; only the download targets `install`, `install-tools`,
`crudui-install-crates` and
`dependency-review`, and the lock of the consumer projects of the release archives
`release-consumer-lock`, which downloads the
third-party packages that their locks pin, lift them with `$(ONLINE)`; `release-consumer` lifts the settings itself. `make crudui-install-crates` downloads the
crates of every Cargo.lock with `cargo fetch --locked`, and `make install` runs it, so no target runs a separate check of
them. `make ordered-json-ext` builds the PHP extension of the OrderedJSON release that `composer.lock` installs, from the
packages.json repository of `composer.json`; the comparison pipeline reads that build and fails when it is missing;
it downloads nothing. The Go module of the comparison servers requires the OrderedJSON module at `v0.0.24`, which `GOPROXY=off`
reads from the module cache.

## Documentation web

The documentation web build reads Markdown from `docs/` after API reference
generation. Every written Markdown document must contain exactly one level-one
heading. A page that API Documenter writes, which starts with its marker comment
and has level-two headings only, is taken as the tool writes it, and its first
heading is its title. The heading becomes the document heading and the browser title is
`<heading> | CRUDUI`. `index.md` maps to the directory route; every other
Markdown filename maps to the same path with an `.html` suffix. The
build also creates a `404.html` page.

Heading anchors use the GitHub-compatible slug of the rendered heading text:
case is folded, punctuation and whitespace become hyphens, repeated hyphens
and boundary hyphens are removed, and a leading digit is not prefixed. Duplicate
heading slugs receive a numeric suffix. Relative document links use these
anchors, so a link fragment must match the generated slug.

Documentation-relative links use generated HTML routes. The build verifies every
local target and fragment. A relative link outside `docs/` requires an existing
repository file or directory and becomes a repository source link in generated
HTML. Files under `docs/public/` are copied to the web root. Missing targets,
missing fragments, duplicate routes and invalid document headings fail the
build.

The generated web contains navigation, the complete documentation sidebar,
per-page headings and responsive styles. English documents use `en-US` and
`.ko.md` documents use `ko-KR`. A clean build writes only deterministic
output to `docs/.web/dist/`; repeated builds from unchanged inputs must produce
identical files. Development and preview commands serve the same generated
output and return a nonzero status when the initial build fails.

`DOCS_BASE_PATH` sets the URL prefix for build, development and preview. It defaults
to `/` when omitted. Explicit values must start and end with `/` and contain only
letters, digits, `_` or `-` in each path segment. Invalid values fail the command.
Navigation, document links, images, styles and the 404 page use that prefix.
GitHub Pages publishes the checked web at `https://polyspec.github.io/crudui/`
after the CI documentation job succeeds on `main`.

## PHP dependencies

Each PHP package declares its runtime and test dependencies. The canonical private project uses `composer.json` and
`composer.lock`. `make crudui-install-composer` resolves this checkout's path packages and OrderedJSON from the
packages.json repository of its release; `make link` links it to a checkout that `.links` declares. Composer owns `vendor/`, native links, installed metadata and autoload;
no separate manifest selector is needed. `make crudui-local-composer-check` validates that project and its PHP platform.
The generated vendor directory is excluded from Git. Install source dependencies before PHP validation, tests or
documentation checks. Release archive consumer projects are independent of this development project.
