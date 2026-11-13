# CRUDUI documentation pipeline.
#
# User entry point for all documentation generation. npm scripts, API Extractor and API Documenter,
# cargo doc, and go doc are building blocks invoked from here.
#
# Everything is idempotent: generation targets clean before they generate, and
# the generators emit deterministic output (no timestamps, no commit hashes, no
# machine-absolute paths). `make docs` run twice yields identical output.

.DEFAULT_GOAL := help
# The tools of this checkout: `make install-tools TOOLS=npm` installs mise and the node and npm of mise.toml into var/tools/bin,
# and `make install-tools` installs the tools of mise.lock into var/tools/mise. var/tools/bin and the shims of mise come first
# on PATH, so every command of make finds them. The tools of the machine are never changed.
TOOLS_DIR := $(CURDIR)/var/tools
# kit 0.0.98's run-tests dropped NODE_TEST_CONTEXT, so a node --test that a recipe starts from inside a node test runs as
# its own run, not as a child of that test (kit K1094); no recipe passes it on.
unexport NODE_TEST_CONTEXT
export PATH := $(CURDIR)/var/tools/mise/shims:$(PATH)
export PATH := $(CURDIR)/var/tools/bin:$(PATH)
# GNU Make 3.81 looks up the program of a recipe line without shell syntax on the PATH that make started with, not on the
# exported one, so every recipe starts npm by its path (tests/build/tool-path.test.mts).
NPM := $(CURDIR)/var/tools/bin/npm
# The exact toolchains of the checkout (docs/operations/package-build.md): rustup runs the toolchain of rust-toolchain.toml and
# never installs one on the first cargo, which fails with rustup's message naming `rustup toolchain install`; go runs the
# installed release and never downloads the toolchain of a go.mod. `make install` installs them.
export RUSTUP_AUTO_INSTALL := 0
export GOTOOLCHAIN := local
# Builds resolve this repository's unpublished module versions through its declared workspace.
build-go crudui-install-go-modules: export GOWORK := $(CURDIR)/go.work
# A check reads no network (docs/operations/package-build.md, "Offline checks"): every recipe and the scripts that it starts
# run cargo, go, npm and Composer offline, so a missing download fails at once instead of reaching a registry in one run
# and not in another. The targets that download, install-tools, crudui-install-crates
# and the downloads of install run their commands with $(ONLINE); a missing crate fails cargo, which make
# crudui-install-crates fetches.
export CARGO_NET_OFFLINE := true
export GOPROXY := off
export npm_config_offline := true
export COMPOSER_DISABLE_NETWORK := 1
ONLINE := env -u CARGO_NET_OFFLINE -u GOPROXY -u npm_config_offline -u COMPOSER_DISABLE_NETWORK
.PHONY: crudui-test-generator-go crudui-test-generator-rust crudui-test-generator-js crudui-test-cross-language-equivalence help release-assets install crudui-install crudui-install-go-modules crudui-install-composer crudui-install-python crudui-install-phpdocumentor crudui-install-browsers check-ci-browser crudui-test-runtimes crudui-test-dependencies crudui-build crudui-lint crudui-docs-check build lint typecheck crudui-test-validator-js crudui-test-validator-php crudui-test-validator-go crudui-test-validator-rust crudui-test-validator-python crudui-test-generator-python crudui-test-cross-check manifest-test require-build crudui-test-cli manifest-check manifest-docs-check crudui-test-forms crudui-test-form-comparison crudui-test-form-comparison-pipeline crudui-test-form-comparison-checks crudui-test-form-comparison-browser crudui-test-form-comparison-summary crudui-test-packages crudui-test-build crudui-test-build-repeat crudui-test-inspector crudui-test-bench check-conformance crudui-install-crates crudui-install-svelte-tools docs docs-api docs-schema docs-web docs-dev docs-preview docs-clean docs-check docs-check-documents docs-check-libs docs-verify-idempotent bench bench-fixtures bench-js bench-php bench-go bench-rust crudui-test-php-engine crudui-test-native-generators crudui-test-php-api crudui-test-native crudui-test-validators crudui-test-form-binding conformance format-check records-check
.NOTPARALLEL: docs docs-web docs-dev docs-preview docs-check docs-verify-idempotent release-assets release-candidate-assets

# ---- The recipes of the kit utilities ------------------------------------------------------------------------------------
# The utilities of the installed @polyspec/kit (docs/operations/package-build.md): the packed release holds them in dist, and a
# kit checkout that .links links holds their sources, which Node runs with its type stripping outside node_modules. This
# Makefile holds the recipes that run them; kit includes none (docs/spec/utilities-and-recipes.md of kit).
KIT_PACKAGE := $(CURDIR)/node_modules/@polyspec/kit
ifneq ($(wildcard $(KIT_PACKAGE)/scripts/kit/run-tests.mts),)
KIT := $(realpath $(KIT_PACKAGE))/scripts/kit
KIT_EXT := mts
else
KIT := $(KIT_PACKAGE)/dist
KIT_EXT := mjs
endif
# The mise of var/tools keeps its data, cache, state and configuration there and reads the mise.toml of the checkout as its global
# configuration, whose [settings] and [env] set how mise and uv behave; the shims of var/tools/mise/shims need these to find the
# tools of this checkout from any folder.
export MISE_DATA_DIR := $(TOOLS_DIR)/mise
export MISE_CACHE_DIR := $(TOOLS_DIR)/mise/cache
export MISE_STATE_DIR := $(TOOLS_DIR)/mise/state
export MISE_CONFIG_DIR := $(TOOLS_DIR)/mise/config
export MISE_GLOBAL_CONFIG_FILE := $(CURDIR)/mise.toml
export MISE_GLOBAL_CONFIG_ROOT := $(CURDIR)
MISE_ENVIRONMENT := MISE_DATA_DIR MISE_CACHE_DIR MISE_STATE_DIR MISE_CONFIG_DIR MISE_GLOBAL_CONFIG_FILE MISE_GLOBAL_CONFIG_ROOT
NODE := $(TOOLS_DIR)/bin/node
ALINT := $(TOOLS_DIR)/mise/shims/alint
# The first install of a checkout runs the bootstrap of kit with the Node.js of the machine, before var/tools holds one.
BOOTSTRAP_NODE := node

.PHONY: install install-kit install-tools install-packages install-link kit-install-symbols kit-install-declared toolchain-lock
# install: the mise, node and npm of mise.toml, package-lock.json, the tools of mise.lock and the declared symbol extractors
# (install-kit), then the steps of this repository (crudui-install), then the links of .links.
install: crudui-install ## Install the declared tools, the npm, Composer, Python and Cargo dependencies and phpDocumentor, then link; ONLINE
	$(MAKE) --no-print-directory install-link

install-kit: ## Install the mise, node and npm of mise.toml, package-lock.json, the tools of mise.lock and the symbol extractors of config/toolchain.json into var/tools; ONLINE
	$(MAKE) --no-print-directory install-tools TOOLS=npm
	$(MAKE) --no-print-directory install-packages
	$(MAKE) --no-print-directory install-tools
	$(MAKE) --no-print-directory kit-install-declared

# The home and the cache of the Composer that install-tools and install-symbols run, the folders of var/tools that kit 0.0.98
# set (kit K1095).
COMPOSER_TOOL_ENV = COMPOSER_HOME=$(CURDIR)/var/tools/composer/home COMPOSER_CACHE_DIR=$(CURDIR)/var/tools/composer/cache
# TOOLS=npm is the first step of a checkout: the bootstrap of kit imports only Node.js built-ins.
install-tools: ## Install all locked tools of mise.lock, or the tool names of TOOLS; TOOLS=npm runs the bootstrap; ONLINE
ifeq ($(TOOLS),npm)
	$(ONLINE) $(BOOTSTRAP_NODE) $(KIT)/bootstrap/bootstrap.$(KIT_EXT)
else
	$(COMPOSER_TOOL_ENV) $(ONLINE) $(NODE) $(KIT)/install-tools.$(KIT_EXT) --no-self-update $(TOOLS)
endif

# npm ci reads allow-remote and strict-allow-scripts from .npmrc. The tools project of packages/svelte has its own lock.
install-packages: hooks ## Install package-lock.json with the npm of var/tools, then the tools project of packages/svelte; ONLINE
	$(ONLINE) $(NPM) ci
	$(MAKE) --no-print-directory crudui-install-svelte-tools

install-link: ## Link the packages to the checkouts of .links after every install of make install; PROJECT and RUNTIME select
	$(NODE) $(KIT)/link.$(KIT_EXT) link$(if $(PROJECT), --project $(PROJECT))$(if $(RUNTIME), --runtime $(RUNTIME))

kit-install-symbols: ## Install the symbol extractors of EXTRACTORS="go php"; their tools are installed first; ONLINE
	$(COMPOSER_TOOL_ENV) $(ONLINE) $(NODE) $(KIT)/install-symbols.$(KIT_EXT) $(EXTRACTORS)

kit-install-declared: ## Install the symbol extractors that config/toolchain.json declares; ONLINE
	$(COMPOSER_TOOL_ENV) $(ONLINE) $(NODE) $(KIT)/install-symbols.$(KIT_EXT) --declared

# mise lock with the mise of var/tools/bin: uv and python first, whose Python then locks the pypi: tools (UV_PYTHON).
TOOLCHAIN_LOCK_PLATFORMS := linux-x64,linux-arm64,macos-arm64,macos-x64,windows-x64,windows-arm64
toolchain-lock: ## Write mise.lock with mise lock for each platform of TOOLCHAIN_LOCK_PLATFORMS; ONLINE
	@test -x $(TOOLS_DIR)/bin/mise || { echo "[toolchain-lock] $(TOOLS_DIR)/bin/mise is missing; run make install-tools TOOLS=npm" >&2; exit 1; }
	$(ONLINE) $(TOOLS_DIR)/bin/mise lock uv python --global --platform $(TOOLCHAIN_LOCK_PLATFORMS)
	$(ONLINE) $(TOOLS_DIR)/bin/mise install --locked uv python
	UV_PYTHON="$$($(TOOLS_DIR)/bin/mise which python3)" $(ONLINE) $(TOOLS_DIR)/bin/mise lock --global --platform $(TOOLCHAIN_LOCK_PLATFORMS)

.PHONY: hooks hooks-check twin-merge
# The declaration of make hooks (kit K1099): no hook,
# the merges of the changelogs and checklists (kit K354) and their drivers, which run twin-merge of this checkout.
TWIN_MERGE_DRIVER := make --no-print-directory twin-merge MERGE="%O %A %B %P"
HOOK_DECLARATION := --merge 'CHANGELOG.md=kit-changelog' --merge 'CHANGELOG.ko.md=kit-twin' \
	--merge 'docs/plans/*/checklist.md=kit-checklist' --merge 'docs/plans/*/checklist.ko.md=kit-twin' \
	--driver 'kit-twin=$(TWIN_MERGE_DRIVER)' --driver 'kit-changelog=$(TWIN_MERGE_DRIVER)' --driver 'kit-checklist=$(TWIN_MERGE_DRIVER)'
# make hooks declares the merge drivers of the changelogs and checklists, which run make twin-merge; config/checklist.json lists
# no Git hook of this repository.
hooks: ## Declare the merge drivers of the changelogs and checklists
	$(NODE) $(KIT)/git-hooks.$(KIT_EXT) install $(HOOK_DECLARATION)

hooks-check: ## Fail while a merge driver of make hooks is not declared
	$(NODE) $(KIT)/git-hooks.$(KIT_EXT) check $(HOOK_DECLARATION)

twin-merge: ## The merge driver of a changelog, a checklist and their Korean twins; git runs it with MERGE="<base> <ours> <theirs> <path>"
	@$(NODE) $(KIT)/twin-merge.$(KIT_EXT) $(MERGE)

.PHONY: layout-check docs-check rules-check owner-check owner-validate rebuild-check language-check duplication-check suppression-check
layout-check: ## Check the folder layout against config/layout.yml with the alint of mise.toml, the ignored install folders and the tracked generated files; offline
	@test -x $(ALINT) || { echo "layout-check: $(ALINT) is missing; run make install-tools"; exit 1; }
	$(ALINT) check --config config/layout.yml --color never --compact .
	$(NODE) $(KIT)/generated-files.$(KIT_EXT) installs var package.json=node_modules pyproject.toml=.venv composer.json=vendor
	$(NODE) $(KIT)/generated-files.$(KIT_EXT) tracked --binary ELF --binary Mach-O --binary PE

# The document check of kit (config/documents.json, config/checklist.json) and crudui-docs-check run each whatever the other's status.
docs-check: ## Check the documents of config/documents.json and the checklists, then crudui-docs-check; offline
	@status=0; \
	$(NODE) $(KIT)/check-documents.$(KIT_EXT) --checklist-place --private-path /Users/ --private-path /home/ --kit-rows || status=1; \
	$(MAKE) --no-print-directory crudui-docs-check || status=1; \
	exit $$status

# The rules of this repository are those of PRINCIPLES.md, its own copy of the principles of kit, and of AGENTS.md.
rules-check: ## Check that every rule of PRINCIPLES.md and AGENTS.md names a check that a CI workflow runs; offline
	$(NODE) $(KIT)/check-rules.$(KIT_EXT)

# The owner checks run the checks of the changed paths (config/owner-checks.json), some of which run cargo; make -k skips
# them while a crate is missing.
owner-check: ## Run the checks of the changed paths (config/owner-checks.json); PATHS="a b" or BASE=<revision> selects the paths
	$(NODE) $(KIT)/owner-check.$(KIT_EXT) --every-path $(if $(PATHS),--paths "$(PATHS)") $(if $(BASE),--base $(BASE))

owner-validate: ## Check that config/owner-checks.json owns every tracked path and names only existing checks; offline
	$(NODE) $(KIT)/owner-check.$(KIT_EXT) --every-path --validate

# The tool sources of rebuild-check, the values that kit 0.0.98 fixed (kit K1080): the scripts and generators, each glob quoted.
REBUILD_SOURCES := --source 'scripts/**/*.{mts,mjs,cjs,js,ts,py,php,sh,mk}' --source 'packages/*/{scripts,tools,bin}/**/*.{mts,mjs,cjs,js,ts,py,php,sh,mk}' --source 'packages/*/*/{scripts,tools,bin}/**/*.{mts,mjs,cjs,js,ts,py,php,sh,mk}' --source '**/*_generate.go' --source '**/*.generate.{mts,mjs,cjs,js,ts,py,php,sh,mk}' --source 'benchmarks/**/*.{mts,mjs,cjs,js,ts,py,php,sh,mk}' --source 'examples/**/*.{mts,mjs,cjs,js,ts,py,php,sh,mk}' --source 'tests/fixtures/*/generate.*'
# The files among the sources that are no tool source (kit K1080): the .d.ts declarations and the tests.
REBUILD_EXCLUDES := --exclude '**/*.d.ts' --exclude '*/**/{test,tests}/**' --exclude 'test/**' --exclude 'tests/**/{*_generate.go,*.generate.*}' --exclude '**/*.{test,spec}.{js,jsx,ts,tsx,cjs,cts,mjs,mts}' --exclude '**/{*_test.go,test_*.py,*_test.py,*Test.php}'
rebuild-check: ## Check that every tool of config/rebuild.json has its class; offline
	$(NODE) $(KIT)/rebuild-check.$(KIT_EXT) $(REBUILD_SOURCES) $(REBUILD_EXCLUDES)

language-check: ## Fail on Hangul in a comment, an identifier, a message or a test name of the code; offline
	$(NODE) $(KIT)/language-check.$(KIT_EXT) --forbid '\p{Script=Hangul}'

duplication-check: ## Fail on a piece of 6 lines or more of code that exists twice outside the folders of config/duplication.json; offline
	$(NODE) $(KIT)/duplication-check.$(KIT_EXT)

suppression-check: ## Fail on a suppression of a lint finding that states no reason; offline
	$(NODE) $(KIT)/suppression-check.$(KIT_EXT)

.PHONY: php-ext-tables php-tables python-tables lint test build-go build-php build-python build-rust build-ts test-go test-php test-python test-rust test-ts lint-go lint-php lint-python lint-rust lint-ts build-php-ext lint-php-ext test-php-ext production-dependencies-check
# build, test and lint run the target <task>-<runtime> of each runtime (go, php, php-ext, python, ts of legacy/packages and rust of packages), after
# the steps of this repository that are their prerequisites (kit K1106).
build: ## Run build-<runtime> for every runtime of packages/; offline
	$(MAKE) --no-print-directory build-go build-php build-php-ext build-python build-rust build-ts
test: ## Run test-<runtime> for every runtime of packages/; offline
	$(MAKE) --no-print-directory test-go test-php test-php-ext test-python test-rust test-ts
lint: ## Run lint-<runtime> for every runtime of packages/; offline
	$(MAKE) --no-print-directory lint-go lint-php lint-php-ext lint-python lint-rust lint-ts

# The build of each package of a runtime with the build of its ecosystem; a PHP library has none (kit K1106).
build-go: ## Build each Go package with go build; offline
	$(NODE) $(KIT)/runtime-targets.$(KIT_EXT) build --roots legacy/packages/generator/go legacy/packages/validator/go -- $(GO) build ./...
build-php: ## A PHP library has no build step; offline
build-python: python-tables ## Build each Python package with uv build; offline
	$(NODE) $(KIT)/runtime-targets.$(KIT_EXT) build --roots legacy/packages/generator/python legacy/packages/validator/python -- $(UV) build
build-rust: ## Build each Rust package with cargo build; offline
	$(NODE) $(KIT)/runtime-targets.$(KIT_EXT) build --roots packages/generator/rust packages/validator/rust -- cargo build --locked
build-ts: require-build ## Build each TypeScript package with tsc after the build of the packages, which writes their tables; offline
	$(NODE) $(KIT)/runtime-targets.$(KIT_EXT) build --roots legacy/packages/generator/ts legacy/packages/validator/ts -- node_modules/.bin/tsc -p tsconfig.build.json

# The unit tests of a runtime with CASES=<pattern>, the name filter of its runner, with the runner arguments that kit 0.0.98
# passed (kit K1094, K1106): one go test over the modules of go.work, one test at a time in cargo and the 30 s test timeout of vitest.
test-go: ## Run the unit tests of the Go modules with CASES=<pattern>; offline
	$(NODE) $(KIT)/runtime-targets.$(KIT_EXT) test --runner go --roots legacy/packages/generator/go legacy/packages/validator/go -- -count=1 -timeout=0
test-php: php-tables ## Run the unit tests of each PHP package with CASES=<pattern>; offline
	$(NODE) $(KIT)/runtime-targets.$(KIT_EXT) test --runner php --roots legacy/packages/generator/php legacy/packages/validator/php
test-python: python-tables ## Run the unit tests of each Python package with CASES=<pattern>; offline
	PYTHONUNBUFFERED=1 NO_COLOR=1 PYTHON_COLORS=0 $(NODE) $(KIT)/runtime-targets.$(KIT_EXT) test --runner python --roots $(PYTHON_ROOTS) --venv .venv
test-rust: ## Run the unit tests of each Rust package with CASES=<pattern> and the test features (random-failure-test); offline
	$(NODE) $(KIT)/runtime-targets.$(KIT_EXT) test --runner cargo --roots packages/generator/rust packages/validator/rust -- --all-features -- --test-threads=1
test-ts: require-build ## Run the unit tests of each TypeScript package with CASES=<pattern>; offline
	$(NODE) $(KIT)/runtime-targets.$(KIT_EXT) test --runner vitest --roots legacy/packages/generator/ts legacy/packages/validator/ts -- --testTimeout=30000 --hookTimeout=30000

lint-python: python-tables ## Lint the Python: ruff with ruff.toml, and vulture on each package; offline
	$(NODE) $(KIT)/lint-python.$(KIT_EXT)

lint-php: php-tables ## Lint the PHP: phpcs with phpcs.xml.dist, and PHPStan with phpstan.dist.neon on each Composer package; offline
	$(NODE) $(KIT)/lint-php.$(KIT_EXT) --memory-limit=-1

# lint-rust lints the core crates: kit runs clippy --workspace, and the binding crates, which need make bindings first, are
# excluded and linted by lint-bindings.
BINDING_COMPONENTS := validator generator
BINDING_CRATES := $(foreach component,$(BINDING_COMPONENTS),polyspec-crud-ui-$(component)-node polyspec-crud-ui-$(component)-python polyspec-crud-ui-$(component)-php-ext polyspec-crud-ui-$(component)-wasm polyspec-crud-ui-$(component)-go)
lint-rust: ## Lint the Rust: cargo clippy in each Cargo workspace with the [workspace.lints] of its Cargo.toml and clippy.toml
	$(NODE) $(KIT)/lint-rust.$(KIT_EXT) --locked $(foreach crate,$(BINDING_CRATES),--exclude $(crate))

# binding is not yet a package that package-lock.json pins; until it is, BINDING names the cli (packages/ts/src/cli.ts) of
# a binding checkout, and the targets refuse to run without it. bindings writes the generated folders of
# packages/<component>/ts, packages/<component>/python and packages/<component>/php-ext, which Git ignores; bindings-check
# runs the contract check of each component, which also compares the package skeletons with what binding scaffold writes.
.PHONY: bindings bindings-check lint-bindings test-bindings
BINDING ?=
bindings: ## Write the generated folders of the binding packages with BINDING=<cli of binding>
	@test -n "$(BINDING)" || { echo "bindings: set BINDING to the cli of binding"; exit 1; }
	@status=0; for component in $(BINDING_COMPONENTS); do $(NODE) $(BINDING) generate --contract $(CURDIR)/packages/$$component/rust/interface.json || status=1; done; exit $$status
bindings-check: ## Check the interface contract of each component with BINDING=<cli of binding>
	@test -n "$(BINDING)" || { echo "bindings-check: set BINDING to the cli of binding"; exit 1; }
	@status=0; for component in $(BINDING_COMPONENTS); do $(NODE) $(BINDING) check $(CURDIR)/packages/$$component/rust/interface.json || status=1; done; exit $$status
lint-bindings: bindings ## Lint the binding crates after make bindings
	cargo clippy --locked $(foreach crate,$(BINDING_CRATES),-p $(crate)) --all-targets -- -D warnings
test-bindings: bindings ## Run the tests of the binding crates after make bindings
	cargo test --locked $(foreach crate,$(BINDING_CRATES),-p $(crate))

lint-go: ## Lint the Go: golangci-lint with .golangci.yml, and deadcode -test, in each Go module; offline once the modules are downloaded
	$(NODE) $(KIT)/lint-go.$(KIT_EXT)

# Production imports are resolved from each package's own runtime dependencies.
# catch-check refuses a catch without a statement, which no-empty of oxlint passes when the block holds a comment.
lint-ts: require-build production-dependencies-check ## Lint the TypeScript: oxlint with .oxlintrc.json, knip with knip.json, API Extractor in each package with an api-extractor.json, and catch-check; offline
	@status=0; \
	$(NODE) $(KIT)/lint-ts.$(KIT_EXT) || status=1; \
	$(NODE) $(KIT)/catch-check.$(KIT_EXT) || status=1; \
	exit $$status
production-dependencies-check:
	$(NODE) node_modules/knip/bin/knip.js --config config/knip-production.json --production --strict --include unlisted --no-progress --no-config-hints

# The C tables of legacy/packages/php-ext are untracked build output of contracts/ (P34): php-ext-tables writes them, and each target
# that reads the sources of the extension depends on it.
php-ext-tables: ## Write legacy/packages/php-ext/src/unicode_data.c and interface_messages.c from contracts/; offline
	$(NODE) legacy/packages/php-ext/tools/generate-unicode-data.mjs
	$(NODE) legacy/packages/php-ext/tools/generate-interface-messages.mjs
# The PHP tables of legacy/packages/validator/php and legacy/packages/generator/php are untracked build output of contracts/ (P34):
# php-tables writes them with the generators of scripts/ of their packages, each target that reads the PHP sources of those
# packages depends on it, and the release runs it for the Composer archive of each package (config/release.json).
php-tables: ## Write legacy/packages/validator/php/src/Values/UnicodeData.php and legacy/packages/generator/php/src/Internal/InterfaceMessages.php from contracts/; offline
	php legacy/packages/validator/php/scripts/generate-unicode-data.php
	php legacy/packages/generator/php/scripts/generate-interface-messages.php
# The Python tables of legacy/packages/validator/python and legacy/packages/generator/python are untracked build output of contracts/ (P34):
# python-tables writes them with the generators of scripts/ of their packages and the Python of mise.toml, each target that
# reads the Python sources of those packages depends on it, and the release runs it for the wheel of each package
# (config/release.json).
python-tables: ## Write unicode_data.py of legacy/packages/validator/python and interface_messages.py of legacy/packages/generator/python from contracts/; offline
	$(PYTHON) legacy/packages/validator/python/scripts/generate_unicode_data.py
	$(PYTHON) legacy/packages/generator/python/scripts/generate_interface_messages.py
# The PHP extension of legacy/packages/php-ext: one build with phpize, the check of its names and stub, and its declaration and unit tests.
# Its build and check read the PHP libraries (--library), so they depend on php-tables too.
build-php-ext: php-ext-tables php-tables ## Build legacy/packages/php-ext with phpize into var/php-ext/polyspec_crudui.so after the arginfo check; ONLINE
	$(ONLINE) $(NODE) $(KIT)/php-extension.$(KIT_EXT) build --extension legacy/packages/php-ext --build-dir var/php-ext --skip vendor --skip node_modules --library legacy/packages/generator/php --library legacy/packages/validator/php

lint-php-ext: php-ext-tables php-tables ## Check the names, the one stub and the stub hash of the arginfo header of legacy/packages/php-ext; offline
	$(NODE) $(KIT)/php-extension.$(KIT_EXT) check --extension legacy/packages/php-ext --build-dir var/php-ext --skip vendor --skip node_modules --library legacy/packages/generator/php --library legacy/packages/validator/php

test-php-ext: build-php-ext ## Compare the declarations of the built extension with the PHP library, then run its unit tests with CASES=<pattern>; offline
	$(NODE) $(KIT)/php-extension.$(KIT_EXT) test --extension legacy/packages/php-ext --build-dir var/php-ext --skip vendor --skip node_modules --library legacy/packages/generator/php --library legacy/packages/validator/php -- --roots legacy/packages/generator/php legacy/packages/php-ext legacy/packages/validator/php

.PHONY: kit-gates-static kit-gates-runtime-ts kit-gates-runtime-php kit-gates-runtime-python kit-gates-runtime-go kit-gates-runtime-rust kit-gates-runtime-php-ext
# The gates of this repository, in the partitions that the jobs of .github/workflows/ci-pipeline.yml run. A partition runs each
# of its gates whatever the status of the others, so one run names every gate that fails.
STATIC_GATES := layout-check docs-check rules-check owner-validate rebuild-check language-check duplication-check suppression-check
# make -k runs them past failures; the make line has no @, since rules-check reads it as a make call.
kit-gates-static: ## Run the shared gates, each past the failures of the others
	$(MAKE) --no-print-directory -k $(STATIC_GATES) || { echo "[kit-gates-static] a shared gate failed" >&2; exit 1; }
	@echo "[kit-gates-static] every shared gate passed"
kit-gates-runtime-ts: lint-ts ## Run the TypeScript gate
kit-gates-runtime-php: lint-php ## Run the PHP gate
kit-gates-runtime-python: lint-python ## Run the Python gate
kit-gates-runtime-go: lint-go ## Run the Go gate
kit-gates-runtime-rust: lint-rust ## Run the Rust gate
kit-gates-runtime-php-ext: ## Run the PHP extension gates, each past the failure of the other
	@status=0; \
	$(MAKE) --no-print-directory lint-php-ext || status=1; \
	$(MAKE) --no-print-directory test-php-ext || status=1; \
	exit $$status

.PHONY: ci-targets ci-passed kit-ci-plan kit-ci-setup kit-ci-context-prepare kit-ci-context-cleanup
CI_REPORT ?= var/report/ci-targets
ci-targets: ## Run TARGETS past failures and write CI_REPORT (logs, record.json, summary.md)
	$(NODE) $(KIT)/ci-targets.$(KIT_EXT) -k $(CI_REPORT) $(TARGETS)

ci-passed: ## Fail unless every job of RESULTS, the JSON of toJSON(needs), has the result success
	$(NODE) $(KIT)/ci-passed.$(KIT_EXT)

kit-ci-plan: ## Write the runtime, tool and target plan of config/ci.json to GITHUB_OUTPUT for .github/workflows/ci-pipeline.yml
	$(NODE) $(KIT)/ci-setup.$(KIT_EXT) --plan

kit-ci-setup: ## Run the setup targets of config/ci.json for GROUP=shared|runtime and RUNTIME=<runtime>
	$(NODE) $(KIT)/ci-setup.$(KIT_EXT) --setup $(GROUP) $(RUNTIME)

kit-ci-context-prepare: ## Run the context preparation target of config/ci.json for GROUP and RUNTIME, when it declares one
	$(NODE) $(KIT)/ci-setup.$(KIT_EXT) --context-prepare $(GROUP) $(RUNTIME)

kit-ci-context-cleanup: ## Run the context cleanup target of config/ci.json for GROUP and RUNTIME, when it declares one
	$(NODE) $(KIT)/ci-setup.$(KIT_EXT) --context-cleanup $(GROUP) $(RUNTIME)

.PHONY: item-new item-edit item-state commit documents-stamp text-absent land worktree-setup link link-check unlink python-venv uv-install
# The texts of a row reach the plan utility unexpanded: each text that is set is passed as its raw value in single quotes.
raw_text = $(foreach v,$(1),$(if $(filter undefined,$(origin $(v))),,$(v)='$(subst ','\'',$(value $(v)))'))

item-new: ## Add the item ID to the checklist of PLAN and its Korean twin with TASK, TASK_KO, DELIVERABLES and VERIFICATION; offline
	$(call raw_text,TASK TASK_KO DELIVERABLES VERIFICATION) $(NODE) $(KIT)/plan.$(KIT_EXT) item-new

item-edit: ## Replace the cells of the item ID with TASK, TASK_KO, DELIVERABLES or VERIFICATION, or its cause and retry with CAUSE, RETRY, CAUSE_KO and RETRY_KO; offline
	$(call raw_text,TASK TASK_KO DELIVERABLES VERIFICATION CAUSE RETRY CAUSE_KO RETRY_KO) DONE_STAYS=1 $(NODE) $(KIT)/plan.$(KIT_EXT) item-edit

item-state: ## Move the item ID to STATE in both languages; offline
	$(NODE) $(KIT)/plan.$(KIT_EXT) item-state

commit: ## Commit the index for the item ID as TYPE(SCOPE): SUBJECT (#ID) with the body of BODY_FILE; offline
	$(NODE) $(KIT)/plan.$(KIT_EXT) commit

documents-stamp: ## Write the source-sha256 of each English document into the Korean twins of PATHS, or of the twins whose source moved; offline
	$(NODE) $(KIT)/documents-stamp.$(KIT_EXT) $(PATHS)

# FILE and TEXT reach the utility through its environment unexpanded, so a text may hold a backquote, a $ or a quote.
unexport TEXT
text-absent: export KIT_TEXT_ABSENT_FILE = $(value FILE)
text-absent: export KIT_TEXT_ABSENT_TEXT = $(value TEXT)
text-absent: ## Fail while the tracked file FILE holds the text TEXT, naming each line; offline
	$(NODE) $(KIT)/text-absent.$(KIT_EXT)

land: ## Land the branch BRANCH on main fast-forward and remove its worktree; offline
	$(NODE) $(KIT)/land.$(KIT_EXT) $(BRANCH) main

# The worktree of a row (kit K1107), as kit 0.0.98 made it: ../<main checkout>-<NAME>-<ID> on <TYPE or fix>/<NAME>-<ID> from main;
# a worktree without node_modules first gets npm ci of the npm of var/tools, then make install and make link-check run in it. The
# worktree runs its own tools in a make of its own (kit K858): the recipe drops the flags of this make and this var/tools from PATH.
WORKTREE_MAIN = $(patsubst %/.git,%,$(shell git rev-parse --path-format=absolute --git-common-dir))
WORKTREE_DECLARATION = --folder $(WORKTREE_MAIN)-$(NAME)-$(ID) --branch $(or $(TYPE),fix)/$(NAME)-$(ID) --base main --prepare 'test -d node_modules || PATH="$(KIT_TOOLS)/bin:$$PATH" $(NPM) ci --ignore-scripts' --make install --make link-check
WORKTREE_ENVIRONMENT = env -u MAKEFLAGS -u MFLAGS -u MAKELEVEL PATH="$$(printf '%s' "$$PATH" | awk -v RS=: -v ORS=: -v tools='$(KIT_TOOLS)' 'index($$0, tools) != 1' | sed 's/:$$//')"
worktree-setup: ## Create or reuse the row worktree NAME of the item ID from main, run make install in it, then make link-check; ONLINE
	$(ONLINE) $(WORKTREE_ENVIRONMENT) $(NODE) $(KIT)/worktree-setup.$(KIT_EXT) $(WORKTREE_DECLARATION)

link: ## Connect the development sources of .links through the native package managers; PROJECT and RUNTIME select; offline
	$(NODE) $(KIT)/link.$(KIT_EXT) link $(strip $(if $(PROJECT),--project $(PROJECT)) $(if $(RUNTIME),--runtime $(RUNTIME)))

link-check: ## Fail while the links differ from the link declaration .links; offline
	$(NODE) $(KIT)/link-check.$(KIT_EXT) $(if $(PROJECT),--project $(PROJECT))

unlink: ## Remove the links of PROJECT and the go.work files that link wrote; make install restores the locked installs; offline
	$(NODE) $(KIT)/link.$(KIT_EXT) unlink$(if $(PROJECT), --project $(PROJECT))$(if $(RUNTIME), --runtime $(RUNTIME))

python-venv: ## Make the virtual environment DIR from the python3 of mise.toml with its uv venv; offline
	@test -n "$(DIR)" || { echo "python-venv: DIR is required, for example make python-venv DIR=pkg/.venv"; exit 1; }
	$(NODE) $(KIT)/python-venv.$(KIT_EXT) $(DIR)

uv-install: ## Install the Python sources of DIR with one uv sync --locked and check the installed distributions; SYNC passes its flags
	UV_SYNC="--locked $(SYNC)" $(ONLINE) $(NODE) $(KIT)/uv-install.$(KIT_EXT) $(DIR)

# The release steps (config/release.json), which .github/workflows/release.yml runs in this order: release-tag, release-prepare,
# release-tools, release-tools-path, release-assets, release-publish, release-undraft.
.PHONY: release-prepare release-tools release-tools-path release-tag release-candidate release-assets release-candidate-assets release-publish release-undraft release-coverage
release-prepare:: ## Prepare what the release needs before release-tools; none
	@:

release-tools: ## Install the tools that config/release.json needs for the release; ONLINE
	$(ONLINE) $(NODE) $(KIT)/release-tools.$(KIT_EXT)

release-tools-path: ## Append var/tools/bin and the shims of mise to GITHUB_PATH and the environment of mise to GITHUB_ENV
	@test -n "$$GITHUB_PATH" || { echo 'release-tools-path: GITHUB_PATH is not set; run it in the release workflow between steps'; exit 1; }
	@test -n "$$GITHUB_ENV" || { echo 'release-tools-path: GITHUB_ENV is not set; run it in the release workflow between steps'; exit 1; }
	@echo "$(TOOLS_DIR)/mise/shims" >> "$$GITHUB_PATH"
	@echo "$(TOOLS_DIR)/bin" >> "$$GITHUB_PATH"
	@for name in $(MISE_ENVIRONMENT); do echo "$$name=$$(printenv $$name)"; done >> "$$GITHUB_ENV"

release-tag: ## Tag the commit of the successful CI run RUN with vX.Y.Z of its change log and the Go module tags; AUTO for the workflow_run start
	@test -n "$$RUN" || { echo "release-tag: RUN is required, for example make release-tag RUN=123"; exit 1; }
	RELEASE_MAIN=origin/main $(NODE) $(KIT)/release-run.$(KIT_EXT) tag "$$RUN"$(if $(AUTO), --auto)

release-candidate: ## Prepare the VERSION archives of the committed candidate before CI
	RELEASE_ASSETS=var/release/assets $(NODE) $(KIT)/release-run.$(KIT_EXT) prepare "$(VERSION)"

release-assets: ## Build the archive of every package of TAG and packages.json into var/release/assets; ONLINE
	@test -n "$$TAG" || { echo "release-assets: TAG is required, for example make release-assets TAG=v0.0.1"; exit 1; }
	RELEASE_ASSETS=var/release/assets $(ONLINE) $(NODE) $(KIT)/release.$(KIT_EXT) assets "$$TAG"

release-candidate-assets: ## Build the archive of every package from committed HEAD for VERSION into var/release/assets; ONLINE
	@test -n "$$VERSION" || { echo "release-candidate-assets: VERSION is required, for example make release-candidate-assets VERSION=0.0.1"; exit 1; }
	RELEASE_ASSETS=var/release/assets $(ONLINE) $(NODE) $(KIT)/release.$(KIT_EXT) candidate-assets "$$VERSION"

release-publish: ## Create the GitHub Release of TAG as a draft with the notes and the files of release-assets
	@test -n "$$TAG" || { echo "release-publish: TAG is required, for example make release-publish TAG=v0.0.1"; exit 1; }
	RELEASE_ASSETS=var/release/assets RELEASE_RECORDS=var/release $(NODE) $(KIT)/release.$(KIT_EXT) publish "$$TAG"

release-undraft: ## Make the draft release of TAG public
	@test -n "$$TAG" || { echo "release-undraft: TAG is required, for example make release-undraft TAG=v0.0.1"; exit 1; }
	RELEASE_RECORDS=var/release $(NODE) $(KIT)/release.$(KIT_EXT) undraft "$$TAG"

release-coverage: ## Require every package file of the checkout to be classified in config/release.json; offline
	$(NODE) $(KIT)/release.$(KIT_EXT) coverage

# The release builds the released versions, so its Go runs without the go.work of the links; the archive builds build the tree
# with the tracked go.work of this repository.
release-prepare release-tools release-tag release-publish release-undraft release-coverage: export GOWORK := off
release-assets release-candidate-assets: export GOWORK := $(CURDIR)/go.work

# Validator benchmark iteration counts (override on the command line, e.g.
# `make bench BENCH_ITERS=100000`).
BENCH_ITERS  ?= 50000
BENCH_WARMUP ?= 5000
PHP_EXTENSION ?= $(CURDIR)/var/php-ext/polyspec_crudui.so
# Reports live in the Git directory, which is a file-referenced directory in a worktree: NATIVE_REPORT of the JavaScript,
# HTML, Go and Python targets and PHP_NATIVE_REPORT of the PHP and native PHP targets of legacy/tests/native-generators/run.mts.
NATIVE_REPORT ?= $(shell git rev-parse --git-path native-generators/report.json)
PHP_NATIVE_REPORT ?= $(shell git rev-parse --git-path native-generators/report-php.json)
CONFORMANCE_EVIDENCE ?= $(abspath $(shell git rev-parse --git-path conformance-evidence))
# The virtual environment of the Python packages (S3): make crudui-install-python makes it from the Python of mise.toml with
# python-venv of kit and syncs the uv workspace of the root pyproject.toml into it, so the suites, the native generator
# program and the cross-check console import the installed packages and change no sys.path.
PYTHON_VENV := $(CURDIR)/var/python
# The roots of the Python packages that test-python runs: runtime-targets of kit runs each with the environment .venv of
# that root (--venv names a folder of each root), so crudui-install-python makes that environment in each root too.
PYTHON_ROOTS := legacy/packages/generator/python legacy/packages/validator/python
# install-link (kit) links the Python packages in the environment that crudui-install-python makes: kit's link reads
# UV_PROJECT_ENVIRONMENT, and without it the link finds no environment of the repository and fails (K360-2).
install-link link: export UV_PROJECT_ENVIRONMENT := $(PYTHON_VENV)
UV := $(TOOLS_DIR)/mise/shims/uv
# The python3 of mise.toml, which runs the table generators of the Python packages before the venv of PYTHON_VENV exists.
PYTHON := $(TOOLS_DIR)/mise/shims/python3
# The go and Composer of mise.toml, by the absolute paths of their shims: make 3.81 runs a recipe line without shell syntax
# from the PATH that make started with (kit K171).
GO := $(TOOLS_DIR)/mise/shims/go
COMPOSER_BIN := $(TOOLS_DIR)/mise/shims/composer
# The folder that make ordered-json-ext records for the local record servers (examples/form-comparison/src/local-servers.mjs).
ORDERED_JSON_PACKAGE_FILE := $(CURDIR)/var/ordered-json-package
# PIE is the shim of the http:pie of mise.toml, which install-pie installs (C17.93). Each build starts in an empty working
# directory of the package under var/pie (C17.96).
PIE := $(TOOLS_DIR)/mise/shims/pie
PIE_WORK := $(CURDIR)/var/pie/polyspec/ordered-json-php-ext

.PHONY: install-pie
install-pie: ## Install the PIE of mise.toml (http:pie) that the OrderedJSON build runs; ONLINE
	$(MAKE) --no-print-directory install-tools TOOLS=pie

# The OrderedJSON php-ext package of the release that composer.lock installs, from the packages.json repository of
# composer.json, built with PIE directly (C17.96, C18.22): PIE adds the repository and
# builds the package in an empty working directory, and the one installed.json entry of that build names the package folder,
# which the record servers read from ORDERED_JSON_PACKAGE_FILE. kit's pie-build is not used, since kit main removes it (K931), to be released in 0.0.81.
.PHONY: ordered-json-ext
ordered-json-ext: install-pie ## Build the OrderedJSON php-ext package of the release packages.json with PIE and record its folder (C17.84, C17.96); ONLINE
	@mkdir -p $(CURDIR)/var
	rm -rf $(PIE_WORK)
	mkdir -p $(PIE_WORK)
	@set -e; \
	version="$$($(NODE) -p 'JSON.parse(require("fs").readFileSync("composer.lock", "utf8")).packages.find(item => item.name === "polyspec/ordered-json").version')"; \
	packages="$$($(NODE) -p 'require("./composer.json").repositories.find(item => item.type === "composer").url')"; \
	PIE_WORKING_DIRECTORY=$(PIE_WORK) $(ONLINE) $(PIE) repository:add composer "$$packages" --no-interaction; \
	PIE_WORKING_DIRECTORY=$(PIE_WORK) $(ONLINE) $(PIE) build "polyspec/ordered-json-php-ext:$$version" --no-interaction
	@$(NODE) scripts/ordered-json-package.mts $(PIE_WORK) $(ORDERED_JSON_PACKAGE_FILE)
export CRUDUI_PYTHON := $(PYTHON_VENV)/bin/python
help: ## 타겟 설명
	@echo "CRUDUI docs — make targets:"
	@echo ""
	@echo "  make install               Install the recorded npm, the npm, Composer and Cargo dependencies, the Rust toolchain and phpDocumentor"
	@echo "  make crudui-install-crates        Download the crates of every Cargo.lock"
	@echo "  make install-tools         Install the npm, Go and cargo-audit releases that the checkout declares into var/tools"
	@echo "  make owner-check           Run the owner checks of the changed paths (config/owner-checks.json); PATHS or BASE select the paths"
	@echo "  make docs                  전체 문서 생성 (API doc 멀티언어 + JSON schema 검사 + 정적 웹)"
	@echo "  make docs-api              Generate API references for all languages"
	@echo "  make docs-schema           스펙 JSON Schema와 공유 고정 데이터 검사"
	@echo "  make docs-web             정적 웹 빌드 (docs/.web/dist)"
	@echo "  make docs-dev              문서 개발 서버"
	@echo "  make docs-preview          문서 빌드 결과 미리보기 서버"
	@echo "  make docs-clean            생성물 전부 제거 (docs/api, dist, target/doc)"
	@echo "  make docs-check            doc-coverage 게이트 (문서 + 라이브러리, 미문서화 시 RED)"
	@echo "  make docs-check-libs       라이브러리 packages/* 만 검사"
	@echo "  make docs-verify-idempotent  docs 를 2회 생성하고 diff 가 비는지 검증"
	@echo "  make build-php-ext                Build the native PHP module with phpize (kit)"
	@echo "  make crudui-test-php-engine       Test the C engine of the native PHP module with the C compiler and its sanitizers"
	@echo "  make crudui-test-native-generators  Test the Go generator and compare JavaScript, HTML, Go and Python generation"
	@echo "  make crudui-test-php-api          Build the native PHP module, test its PHP API and compare PHP and native PHP generation"
	@echo "  make crudui-test-native           Run crudui-test-php-engine, crudui-test-native-generators and crudui-test-php-api"
	@echo "  make crudui-test-validators       Test the JavaScript, PHP, Go and Rust validators"
	@echo "  make crudui-test-form-binding     Test the browser validation binding, its markup parity and three browsers"
	@echo "  make conformance           Run every conformance suite and check the evidence against the standard"
	@echo "  make format-check          Fail when any Rust crate or Go file is not formatted"
	@echo "  make records-check         The document and checklist rules that need Node.js alone"
	@echo ""
	@echo "CRUDUI validator benchmark — make targets:"
	@echo ""
	@echo "  make bench                 4언어(JS/PHP/Go/Rust) 처리량 비교 (ops/sec + avg µs 표 → benchmarks/validators/results.md)"
	@echo "  make bench-js              JS 검증기만 측정"
	@echo "  make bench-php             PHP 검증기만 측정"
	@echo "  make bench-go              Go 검증기만 측정"
	@echo "  make bench-rust            Rust 검증기만 측정"
	@echo "  make bench-fixtures        벤치 스펙+입력 fixture JSON 재생성"
	@echo "  (반복수 조절: make bench BENCH_ITERS=100000 BENCH_WARMUP=10000)"
	@echo "  주의: 절대시간은 머신 의존 — 같은 스펙 안에서 백엔드 간 비율만 비교하라."
	@echo ""

# The npm, Go and cargo-audit releases that the checkout declares into var/tools and the Rust toolchain of rust-toolchain.toml
# (install-tools), the dependencies of the lock files, the crates of every Cargo.lock, the OrderedJSON
# checkout of the comparison and the phpDocumentor release that scripts/install-phpdocumentor.mts checks by its SHA-256.
# PHP is installed at the minor of config/toolchain.json by the machine's package manager; Node.js, Python, Go and
# Composer are the tools of mise.toml in var/tools.

# crudui-install is the repository step of install: it runs after install-kit, the bootstrap of the tools and packages. composer install
# writes vendor/composer/platform_check.php from the tracked composer.lock, which demands the PHP of the released polyspec
# packages; install-link, which install runs again at its end, points them at the sibling checkouts and writes the check for the
# PHP of .php-version, so it runs before phpDocumentor, the first step that runs PHP, and after the Python install it needs.
crudui-install: install-kit crudui-install-python crudui-install-composer install-link crudui-install-crates crudui-install-go-modules crudui-install-phpdocumentor crudui-install-browsers

# The tools of packages/svelte that need the TypeScript 6 API (svelte-check, @sveltejs/package and the Svelte lint)
# are a project of their own outside the npm workspaces, so that no package that npm hoists to the root reaches the
# TypeScript 7 of the root (C14.4).
crudui-install-svelte-tools: ## Install the tools project of packages/svelte from its package-lock.json; ONLINE
	$(ONLINE) $(NPM) ci --prefix packages/svelte/tools --no-audit --no-fund

# The private root Composer project resolves this checkout's PHP packages and OrderedJSON from its packages.json repository.
# Composer owns the path links, autoload files and installed metadata. Updating the path packages refreshes their native
# metadata when a source manifest changes; make link replaces the installed OrderedJSON with a checkout that .links declares.
crudui-install-composer: php-tables ## Resolve and install the current local PHP source packages with Composer
ifeq ($(GITHUB_ACTIONS),true)
	$(ONLINE) $(COMPOSER_BIN) install --no-interaction --prefer-dist
else
	$(ONLINE) $(COMPOSER_BIN) update 'polyspec/*' --with-dependencies --no-interaction
endif

crudui-local-composer-check: ## Validate the canonical Composer manifest, lock and PHP platform requirements
	@status=0; \
	$(COMPOSER_BIN) validate --strict || status=1; \
	$(COMPOSER_BIN) check-platform-reqs || status=1; \
	exit $$status

crudui-install-python: python-tables ## Make the venv var/python and the venv .venv of each root of PYTHON_ROOTS and install the Python packages of the uv workspace into each in editable mode
	$(MAKE) --no-print-directory python-venv DIR=$(PYTHON_VENV)
	UV_PROJECT_ENVIRONMENT=$(PYTHON_VENV) $(MAKE) --no-print-directory uv-install DIR=. SYNC='--quiet --all-packages'
	@status=0; for root in $(PYTHON_ROOTS); do \
		$(MAKE) --no-print-directory python-venv DIR=$(CURDIR)/$$root/.venv && \
		UV_PROJECT_ENVIRONMENT=$(CURDIR)/$$root/.venv $(MAKE) --no-print-directory uv-install DIR=. SYNC='--quiet --all-packages' || status=1; \
	done; exit $$status

crudui-install-phpdocumentor: ## Install the phpDocumentor release that scripts/install-phpdocumentor.mts checks by its SHA-256
	$(ONLINE) $(NODE) scripts/install-phpdocumentor.mts

# The browsers that puppeteer and playwright pin (scripts/install-browsers.mts); BROWSERS names the browsers and options.
BROWSERS ?= chrome firefox webkit
crudui-install-browsers: ## Install the pinned browsers of BROWSERS (chrome firefox webkit) into the checkout
	$(ONLINE) $(NODE) scripts/install-browsers.mts $(BROWSERS)

check-ci-browser: ## Check that the pinned Chrome runs sandboxed
	$(NODE) scripts/check-ci-browser.mts

# The cargo of rust-toolchain.toml (rustup) fetches the crates of every tracked Cargo.lock here, the one recipe of cargo that is
# online; every other recipe runs cargo offline (CARGO_NET_OFFLINE) and reads only these crates.
crudui-install-crates: ## Download the crates of every Cargo.lock; ONLINE
	@set -e; for lock in $$(git ls-files -- '*Cargo.lock'); do $(ONLINE) cargo fetch --locked --manifest-path "$${lock%.lock}.toml"; done

# The modules that the Go workspace of go.work requires, downloaded into the module cache with go mod download at its
# root: the Go checks run with GOPROXY=off and read only that cache (C14.18). A CI job that runs Go runs it after make
# install-tools.
crudui-install-go-modules: ## Download the modules that the Go workspace requires; ONLINE
	@modules="$$($(ONLINE) $(GO) list -m -f '{{if not .Main}}{{.Path}}@{{.Version}}{{end}}' all)" || exit $$?; \
	printf '%s\n' "$$modules" | xargs $(ONLINE) $(GO) mod download

ifneq ($(LOCAL),1)
crudui-test-form-comparison-pipeline crudui-test-form-comparison-browser crudui-test-form-comparison-summary crudui-test-form-comparison-checks:
endif
# The targets that start the local form-comparison stack read the OrderedJSON php-ext that make ordered-json-ext records (C17.84, C17.90),
# so a fresh checkout builds it before them (C17.85).
crudui-test-form-comparison-pipeline crudui-test-form-comparison-browser crudui-test-form-comparison-summary crudui-test-form-comparison-checks: ordered-json-ext

# The checking commands of the CI workflow, one target each (CI_TARGETS).
crudui-test-runtimes: ## Exact runtime versions and test standards
	$(NPM) run test:runtimes
# The TypeScript tables are untracked build output of contracts/ (P34): the build script of legacy/packages/validator/ts writes
# src/unicode/properties.ts, and the build script of legacy/packages/generator/ts writes src/interface-messages.ts and
# src/form-template-validator.mjs, ajv's standalone validation code of contracts/schema/form-template.schema.json (C14.38),
# so the package has no runtime dependency on ajv and compiles no schema at run time. Each target that reads the sources
# of the two packages runs after that build (require-build).
build: crudui-build ## Build the JavaScript packages
crudui-build: require-build build-php-ext
# The TypeScript and JavaScript sources are linted by kit's gate lint-ts, which the CI pipeline runs once for the ts runtime
# (kit-gates-runtime-ts, C17.91). oxlint has no Svelte rules, so the components of packages/svelte are linted here by the
# ESLint of that workspace.
lint: crudui-lint ## Lint the Svelte components with the ESLint of their workspace; the TypeScript gate is lint-ts of kit
crudui-lint:
	$(NPM) run lint -w @polyspec/crudui-generator-svelte
# The root tsconfig.json checks the TypeScript of scripts/ and tests/ (S9 of kit) strictly. It sets skipLibCheck: the
# declarations that @tailwindcss/node 4.3.3 publishes import seven modules (./ast, ./candidate, ...) that the package does
# not ship, so a check of the declaration files of node_modules fails on that package and not on this code.
typecheck: require-build ## Type-check every TypeScript package, the TypeScript of scripts/ and tests/ with the root tsconfig.json, and the form comparison
	$(NPM) run typecheck
	node_modules/.bin/tsc -p tsconfig.json
	node_modules/.bin/tsc -p examples/form-comparison/src/tsconfig.json
crudui-test-validator-js: ## The TypeScript validator suite
	$(NODE) scripts/require-current-build.mts
	$(NPM) test -w @polyspec/crudui-validator
crudui-test-validator-php: php-tables ## The PHP validator suite
	$(COMPOSER_BIN) --working-dir=legacy/packages/validator/php test
crudui-test-validator-go: ## The Go validator suite
	@packages="$$($(GO) -C legacy/packages/validator/go list -f '{{if or .TestGoFiles .XTestGoFiles}}{{.ImportPath}}{{end}}' ./...)" || exit $$?; \
	test -n "$$packages" || { echo "crudui-test-validator-go: native Go discovery selected no test package" >&2; exit 1; }; \
	$(NODE) tests/conformance/run-suite.mts go --cwd legacy/packages/validator/go -- -count=1 -timeout=0 $$packages
crudui-test-validator-rust: ## The Rust validator suite
	$(NODE) tests/conformance/run-suite.mts cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml -- --test-threads=1
crudui-test-validator-python: python-tables ## The Python validator suite
	PYTHONUNBUFFERED=1 NO_COLOR=1 PYTHON_COLORS=0 $(NODE) tests/conformance/run-suite.mts python --venv $(PYTHON_VENV) --cwd legacy/packages/validator/python -- discover -s tests -t .
crudui-test-generator-python: python-tables ## The Python generator suite
	PYTHONUNBUFFERED=1 NO_COLOR=1 PYTHON_COLORS=0 $(NODE) tests/conformance/run-suite.mts python --venv $(PYTHON_VENV) --cwd legacy/packages/generator/python -- discover -s tests -t .
crudui-test-cross-check: python-tables ## The cross-check console gateway conformance
	$(NPM) test --prefix legacy/examples/cross-check-console/server
manifest-test: ## The verification commands of the feature contracts
	$(NPM) run manifest:test
require-build: ## Build the packages when their sources or output changed
	$(NODE) scripts/require-current-build.mts
crudui-test-cli: ## The command-line interface suite
	$(NODE) scripts/require-current-build.mts
	$(NODE) $(KIT)/run-tests.$(KIT_EXT) vitest --cwd packages/cli
manifest-check: ## The feature contract manifest
	$(NPM) run manifest:check
manifest-docs-check: ## The generated feature contract documents
	$(NPM) run manifest:docs:check
crudui-test-forms: ## Form instances, renderers and the browser checks
	$(NPM) run test:forms
crudui-test-form-comparison: ## The form comparison runner regressions
	$(NPM) run test:form-comparison
crudui-test-form-comparison-pipeline: ## The record stores and the canonical flow
	$(NPM) run test:form-comparison:pipeline
crudui-test-form-comparison-checks: ## The PHP modes, generation, persistence, flow, browser and typing checks against a local stack
	$(NPM) run test:form-comparison:checks
# The same checks in two parts, as CI runs them: crudui-test-form-comparison-browser runs the browser checks of the servers of
# FORM_SERVERS against a local stack and keeps their reports in FORM_BROWSER_REPORTS; crudui-test-form-comparison-summary runs
# every other check against a local stack of its own and summarizes those reports. Every public server takes a port of
# the system, so runs at the same time do not collide; the summary requires the scheme and host of every report.
FORM_SERVERS ?= php,php-ext,go,rust
FORM_BROWSER_REPORTS ?= $(CURDIR)/var/form-comparison/browser
crudui-test-form-comparison-browser: ## The browser checks of the servers of FORM_SERVERS against a local stack
	$(NPM) run test:form-comparison:checks -- --servers $(FORM_SERVERS) --results $(FORM_BROWSER_REPORTS)
crudui-test-form-comparison-summary: ## Every other check against a local stack, with the browser reports of FORM_BROWSER_REPORTS
	$(NPM) run test:form-comparison:checks -- --browser-reports $(FORM_BROWSER_REPORTS)
crudui-test-packages: ## The package install check
	$(NPM) run test:packages
crudui-test-build: ## The public builds
	$(NPM) run test:build
crudui-test-build-repeat: ## The reproducible build
	$(NPM) run test:build:repeat
crudui-test-inspector: ## The browser inspector
	$(NPM) run test:inspector
crudui-test-bench: ## The benchmark drivers
	$(NPM) run test:bench
check-conformance: ## The conformance evidence against contracts/features.json
	$(NODE) scripts/check-conformance.mts

docs: docs-clean docs-web ## 전체 문서 생성 (clean-then-generate)
	@echo "[make] docs: complete -> docs/.web/dist"

docs-api: php-tables ## 멀티언어 API doc
	$(NPM) run docs:api

docs-schema: ## 스펙 JSON Schema 검사
	$(NPM) run spec:schema

docs-web: ## 문서 정적 웹 빌드
	$(NPM) run docs:build

docs-dev: ## 문서 개발 서버
	$(NPM) run docs:dev

docs-preview: ## 문서 빌드 결과 미리보기 서버
	$(NPM) run docs:preview

# crudui-docs-check is the repository's doc-coverage gate (documents AND library packages; either arm RED → non-zero exit);
# make docs-check runs it after the document check of kit.
crudui-docs-check: ## doc-coverage 게이트 (문서 + 라이브러리, 미문서화 → 비0 exit)
	@status=0; \
	$(MAKE) --no-print-directory docs-check-documents || status=1; \
	$(MAKE) --no-print-directory docs-check-libs || status=1; \
	if [ $$status -eq 0 ]; then echo "[make] docs-check: documents and libraries passed"; fi; \
	exit $$status

# Every check runs even when an earlier one fails, so one run reports every failure.
docs-check-documents:
	@status=0; \
	$(NPM) run manifest:check || status=1; \
	$(NPM) run manifest:docs:check || status=1; \
	$(MAKE) --no-print-directory records-check || status=1; \
	$(NODE) $(KIT)/run-tests.$(KIT_EXT) node -- --test-concurrency=1 scripts/gen-api-docs.test.mts scripts/check-doc-coverage.test.mts scripts/php-doc-coverage.test.mts scripts/json-schema.test.mts || status=1; \
	$(NPM) run test:docs || status=1; \
	$(NPM) run docs:build || status=1; \
	exit $$status

docs-check-libs: php-tables ## 라이브러리 packages/* doc-coverage
	$(NPM) run docs:check

docs-clean: ## 생성물 전부 제거
	rm -rf docs/api docs/public/api
	rm -rf docs/.web
	rm -rf target/doc
	rm -rf var/phpdocumentor/cache
	@echo "[make] docs-clean: removed generated docs/api, dist, rustdoc, phpdoc cache"

# Generate twice and compare Markdown, native API assets and the schema. The snapshots and the
# difference go to a directory that this run creates with mktemp and removes at its exit, so
# runs of other checkouts do not overwrite them.
docs-verify-idempotent: ## docs 를 2회 생성하고 diff 가 비는지 검증
	@$(MAKE) docs-clean
	@runs=$$(mktemp -d -t crudui-docs-verify.XXXXXX) && trap 'rm -rf "$$runs"' EXIT && \
	snapshot() { mkdir "$$runs/$$1" && cp -R docs/api "$$runs/$$1/api" && \
		cp -R docs/public/api "$$runs/$$1/native-api" && cp -R docs/.web/dist "$$runs/$$1/docs" && \
		cp contracts/schema/crudui.schema.json "$$runs/$$1/crudui.schema.json"; } && \
	$(MAKE) docs-web && snapshot run1 && $(MAKE) docs-web && snapshot run2 && \
	if diff -r "$$runs/run1" "$$runs/run2" > "$$runs/diff.txt" 2>&1; then \
		echo "[make] docs-verify-idempotent: OK — two runs produced identical deterministic output"; \
	else \
		echo "[make] docs-verify-idempotent: FAILED — outputs differ:"; \
		cat "$$runs/diff.txt"; \
		exit 1; \
	fi

# ----------------------------------------------------------------------------
# Validator throughput benchmark (benchmarks/validators).
#
# Runs the four validators (JS/PHP/Go/Rust) over the same spec+input N times
# in-process and prints an ops/sec + avg-µs table, also written to
# benchmarks/validators/results.md. Absolute times are machine-dependent — compare
# backends RELATIVELY within one spec. See benchmarks/validators/README.md for the
# fairness method (startup excluded, same workload enforced, agreement gate).
# ----------------------------------------------------------------------------

bench-fixtures: ## 벤치 fixture JSON 재생성 (스펙 → spec/input JSON)
	$(NODE) benchmarks/validators/gen-fixtures.js

bench: bench-fixtures php-tables ## 4언어 검증기 처리량 비교
	$(NODE) benchmarks/validators/run.js --iters $(BENCH_ITERS) --warmup $(BENCH_WARMUP)

bench-js: bench-fixtures ## JS 검증기만 측정
	$(NODE) benchmarks/validators/run.js --only js --iters $(BENCH_ITERS) --warmup $(BENCH_WARMUP)

bench-php: bench-fixtures php-tables ## PHP 검증기만 측정
	$(NODE) benchmarks/validators/run.js --only php --iters $(BENCH_ITERS) --warmup $(BENCH_WARMUP)

bench-go: bench-fixtures ## Go 검증기만 측정
	$(NODE) benchmarks/validators/run.js --only go --iters $(BENCH_ITERS) --warmup $(BENCH_WARMUP)

bench-rust: bench-fixtures ## Rust 검증기만 측정
	$(NODE) benchmarks/validators/run.js --only rust --iters $(BENCH_ITERS) --warmup $(BENCH_WARMUP)

# Native unit suites and cross-language generator equivalence run in independent CI jobs.
# The aggregate target runs each part once and reports every failure.
crudui-test-php-engine: php-ext-tables
	$(NODE) scripts/require-current-build.mts
	$(NODE) tests/conformance/run-suite.mts node -- --test-concurrency=1 legacy/packages/php-ext/tests/engine/engine.test.mjs legacy/packages/php-ext/tests/contract/*.test.mjs legacy/packages/php-ext/tests/comparison/comparison.test.mjs

crudui-test-generator-go:
	$(NODE) tests/conformance/run-suite.mts go --cwd legacy/packages/generator/go -- -count=1 -timeout=0 -race ./...

crudui-test-generator-rust:
	$(NODE) tests/conformance/run-suite.mts cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml --features random-failure-test -- --test-threads=1

crudui-test-generator-js: require-build
	@status=0; \
	$(NODE) $(KIT)/run-tests.$(KIT_EXT) node -- --test-concurrency=1 legacy/tests/native-generators/protocol.test.mts || status=1; \
	$(NODE) $(KIT)/run-tests.$(KIT_EXT) node -- --test-concurrency=1 tests/widget-scripts.test.mts || status=1; \
	exit $$status

crudui-test-native-generators:
	@status=0; \
	$(MAKE) --no-print-directory crudui-test-generator-go || status=1; \
	$(MAKE) --no-print-directory crudui-test-generator-rust || status=1; \
	$(MAKE) --no-print-directory crudui-test-generator-js || status=1; \
	exit $$status

crudui-test-php-api: php-tables require-build build-php-ext
	@status=0; \
	PHP_EXTENSION="$(PHP_EXTENSION)" $(NODE) tests/conformance/run-suite.mts phpunit --cwd legacy/packages/php-ext || status=1; \
	$(NODE) tests/conformance/run-suite.mts phpunit --cwd legacy/packages/generator/php -- --testsuite public,php-source-internal || status=1; \
	$(NODE) tests/conformance/run-suite.mts phpunit --cwd legacy/packages/generator/php --php-extension "$(PHP_EXTENSION)" -- tests/FormStateTest.php tests/ButtonsConformanceTest.php tests/TemplateShapeTest.php tests/HistoryFunctionsTest.php || status=1; \
	exit $$status

# Compare every declared generator runtime independently of the language unit suites.
crudui-test-cross-language-equivalence: python-tables require-build build-php-ext
	@status=0; \
	$(NODE) legacy/tests/native-generators/run.mts --target javascript,html,go,python --report "$(NATIVE_REPORT)" || status=1; \
	$(NODE) legacy/tests/native-generators/run.mts --extension "$(PHP_EXTENSION)" --target php,php-native --report "$(PHP_NATIVE_REPORT)" || status=1; \
	exit $$status

crudui-test-native:
	@status=0; \
	$(MAKE) --no-print-directory crudui-test-php-engine || status=1; \
	$(MAKE) --no-print-directory crudui-test-native-generators || status=1; \
	$(MAKE) --no-print-directory crudui-test-cross-language-equivalence || status=1; \
	$(MAKE) --no-print-directory crudui-test-php-api || status=1; \
	exit $$status

crudui-test-validators: php-tables require-build
	@status=0; \
	$(NODE) tests/conformance/run-suite.mts vitest --cwd legacy/packages/validator/ts || status=1; \
	$(NODE) tests/conformance/run-suite.mts phpunit --cwd legacy/packages/validator/php -- --testsuite public,php-source-internal || status=1; \
	$(NODE) tests/conformance/run-suite.mts go --cwd legacy/packages/validator/go -- -count=1 -timeout=0 ./... || status=1; \
	$(NODE) tests/conformance/run-suite.mts cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml -- --test-threads=1 || status=1; \
	exit $$status

# The browser validation binding (docs/spec/form-runtime.md, "Browser validation"): data
# collection, timing, error markup parity with renderForm and the check in Chromium, Firefox and
# WebKit. It reads the built validator and renderers.
crudui-test-form-binding:
	$(NODE) scripts/require-current-build.mts
	$(NODE) $(KIT)/run-tests.$(KIT_EXT) vitest --cwd packages/form-binding

# Every suite that records conformance evidence, then the check of that evidence against
# contracts/features.json (docs/operations/conformance.md). Every suite runs even when an earlier one
# fails, so the check reports every gap; any failure fails the target.
conformance:
	rm -rf "$(CONFORMANCE_EVIDENCE)"
	@status=0; \
	export CRUDUI_CONFORMANCE_EVIDENCE="$(CONFORMANCE_EVIDENCE)"; \
	$(MAKE) --no-print-directory crudui-test-validators || status=1; \
	$(MAKE) --no-print-directory crudui-test-native || status=1; \
	$(NPM) run test:forms || status=1; \
	$(NPM) test --prefix legacy/examples/cross-check-console/server || status=1; \
	$(NODE) scripts/check-conformance.mts || status=1; \
	exit $$status

# Every Rust crate and Go file in the working tree (tracked, or new and not ignored) must match
# rustfmt and gofmt. Tracked files deleted from the working tree are skipped. Every crate and the Go
# files are checked even when an earlier check fails, so one run reports every difference.
WORKTREE_FILES = git ls-files --cached --others --exclude-standard $(1) | while read -r file; do [ -f "$$file" ] && echo "$$file"; done
format-check:
	@status=0; \
	for manifest in $$($(call WORKTREE_FILES,'*Cargo.toml')); do \
		$(NODE) scripts/run-rust-command.mts fmt --check --manifest-path "$$manifest" || status=1; \
	done; \
	unformatted="$$(gofmt -l $$($(call WORKTREE_FILES,'*.go')))"; \
	if [ -n "$$unformatted" ]; then echo "gofmt differences:"; echo "$$unformatted"; status=1; fi; \
	if [ $$status -eq 0 ]; then echo "[make] format-check: Rust crates and Go files are formatted"; fi; \
	exit $$status

# The document and checklist rules that need Node.js alone and read no network: the job push-gate runs them on every
# pushed commit. Both commands run even when the first fails.
records-check: ## Check the document pairs, links, changelog, writing and checklist rules with Node.js alone
	@status=0; \
	$(NODE) $(KIT)/run-tests.$(KIT_EXT) node -- --test-concurrency=1 scripts/documentation-links.test.mts tests/docs/changelog.test.mts tests/docs/repository-writing.test.mts tests/docs/example-readmes.test.mts tests/docs/fixture-readmes.test.mts || status=1; \
	exit $$status

# The release steps above run the release utilities of @polyspec/kit, in the order of .github/workflows/release.yml
# (docs/operations/repository.md, "Releases"). The
# archives of the npm packages hold their dist directories, so the packages are built before the archives are written.
release-assets release-candidate-assets: crudui-prepare-release-build build
.PHONY: crudui-prepare-release-build
crudui-prepare-release-build: crudui-install-crates crudui-install-go-modules

# Every target the CI workflow runs after installing tools and dependencies, in workflow order
# (tests/build/ci-local.test.mts keeps this list equal to .github/workflows/ci.yml).
CI_TARGETS = \
	crudui-test-runtimes \
	build \
	crudui-lint \
	typecheck \
	hooks-check \
	crudui-test-validator-js \
	crudui-test-validator-php \
	crudui-test-php-source \
	crudui-test-validator-go \
	crudui-test-generator-go \
	crudui-test-validator-rust \
	crudui-test-generator-rust \
	crudui-test-validator-python \
	crudui-test-generator-python \
	build-php-ext \
	crudui-test-cross-check \
	manifest-test \
	crudui-test-bench \
	require-build \
	crudui-test-cli \
	crudui-test-forms \
	crudui-test-form-comparison \
	crudui-test-form-comparison-pipeline \
	crudui-test-form-comparison-browser \
	crudui-test-form-comparison-summary \
	crudui-test-packages \
	crudui-test-build \
	crudui-test-build-repeat \
	crudui-test-inspector \
	crudui-test-php-engine \
	crudui-test-generator-js \
	crudui-test-php-api \
	crudui-test-cross-language-equivalence \
	check-conformance

# PHP source runs include public and implementation units; extension defaults remain public. Named apart from test-php,
# which runs the PHP tests of each PHP package with the runtime targets (C17.86).
crudui-test-php-source: php-tables
	@status=0; \
	$(NODE) $(KIT)/run-tests.$(KIT_EXT) phpunit --cwd legacy/packages/generator/php -- --testsuite public,php-source-internal $(if $(CASES),--filter "$$CASES") || status=1; \
	$(NODE) $(KIT)/run-tests.$(KIT_EXT) phpunit --cwd legacy/packages/validator/php -- --testsuite public,php-source-internal $(if $(CASES),--filter "$$CASES") || status=1; \
	exit $$status
