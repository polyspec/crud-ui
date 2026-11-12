# Repository
<!-- doc-id: docs-operations-repository -->

[한국어](repository.ko.md).

How a change reaches `main`, which workflows run and how a release is made while the version is 0.x. There is no pull
request, merge queue or GitHub ruleset: work is committed locally, one checklist row per commit, and the maintainer
pushes `main`.

## Checkout bootstrap

Before running make, install the root lock with the exact npm release declared in `packageManager`, using the
[native npm bootstrap](package-build.md#runtime-and-dependency-versions). The Makefile then includes the bootstrap of the
installed `@polyspec/kit` package. Its source or packed commands run without requiring a sibling kit checkout. Bootstrap
files belong to the installed package and are not repository copies. Every workflow job that runs make performs this
installation before its first make command.

## Publishing main

Runtime policy tests run in four independent GitHub Actions shards; each shard records its own results.

Each development task is committed with its changelog entry when its owning unit tests pass, and the row becomes `[o]`.
Rejected original tasks retain their documented cause. Complete the [local candidate preparation](../plans/release-readiness/plan.md),
merge every completed development branch into local `main`, and finish its local verification before pushing for CI.
Candidate preparation is not bypassed while waiting for CI or a separate permission. `main` is pushed when preparation
is complete and no task is active:

```sh
git push origin main
```

The pre-push hook `.githooks/pre-push` refuses the push while a row is `[~]`, and the job `push-gate` of
`.github/workflows/push-gate.yml` fails for a pushed commit that has such a row
([push check](testing.md)). The push starts `.github/workflows/ci.yml`, which runs the full suite in its jobs; its last
job `ci-passed` needs every other job and fails unless each of them succeeded. The other jobs read no result of the job `kit` and
start together with it. A tag is created only after `ci-passed` and
`push-gate` succeeded for the commit that it names. A branch or worktree of an agent is named
`{type}/{shortname}-{task ID}` and `{project}-{shortname}-{task ID}` and is removed as soon as it is merged into `main`.

The workflows are:

- `.github/workflows/ci.yml` on a push to `main` and on a manual run (`workflow_dispatch`); a later push never cancels the
  run of an earlier commit, because a release requires the checks of its own commit;
- `.github/workflows/push-gate.yml` on every push to a branch, never on a tag;
- `.github/workflows/pages.yml` on a push to `main` and on a manual run: it builds the documentation web and deploys it to
  the environment `github-pages`, which deploys only from `main`;
- `.github/workflows/dependency-review.yml` on its schedule and on a manual run;
- `.github/workflows/release.yml` on a pushed tag `v*` or `**/v*` ([releases](#releases)).

No other workflow exists (`tests/build/ci-local.test.mts`). The settings of the repository on GitHub (the Pages source
**GitHub Actions**, the environment `github-pages`) are set in the GitHub interface; no command of this repository
applies them.

## Releases

A release is a tag of a commit of `main`: `vX.Y.Z` for the repository, or `<directory>/vX.Y.Z` for the Go module of
that directory (`legacy/packages/generator/go` and `legacy/packages/validator/go`), whose module path is
`github.com/polyspec/crudui/<directory>` (`tests/build/package-names.test.mts`). Every commit of `main` passed the full
suite of CI before the tag, so the release runs no test again. Only the maintainer creates and pushes a tag. The
packages, the manifests that a tag covers and the Go modules are declared in `config/release.json`
(`node_modules/@polyspec/kit/dist/schema/release.schema.json`).

The native PHP extension is built from the complete repository. Its `legacy/packages/php-ext/composer.json` is a version-only
manifest in `config/release.json`, so a version change updates the version that `src/config.m4` reads without adding a
Composer archive or a platform-specific binary to the published assets.

1. Before candidate CI, prepare the version of every manifest that `config/release.json` lists (`package.json`, the
   `composer.json` of `packages/`, `Cargo.toml`, `pyproject.toml`) and every dependency on this repository's packages.
   Regenerate native locks, consumer declarations and the versioned sections of both changelogs. The version preparation
   and all completed development changes reach local `main` before CI.
2. Complete C18.1 of the [local preparation checklist](../plans/release-readiness/checklist.md) with current sibling
   sources, the native dependency managers and the candidate's owning checks. Any local package or consumer artifacts
   are built from the current merged source snapshot and consumed in the same run. This preparation creates no tag and
   checks out no previous release. An older OrderedJSON archive is not a substitute for the current sibling source.
3. After local preparation is complete, push `main` for CI. When `ci.yml` succeeds on that exact commit, the maintainer
   dispatches the release with the id of that run and the version:

   ```sh
   gh workflow run release.yml -f run=<id of the successful ci.yml run of main> -f version=X.Y.Z
   ```

   `make release-tag` creates `vX.Y.Z` and the tag `<directory>/vX.Y.Z` of every Go module on that run's commit, as annotated
   tags, and refuses a tag elsewhere or a lightweight one. No tag push starts a run (K911); a Go module tag has no run of its
   own and creates no archive.
4. `.github/workflows/release.yml` runs on that dispatch with the token permission `contents: write`. The workflow is the
   copy of kit. It installs the kit package through native npm before make. After the setup steps (`make install-tools
   TOOLS=npm`, `make install-packages`, `make release-tools`, which installs the tools that `config/release.json` needs, and
   `make release-tools-path`) its steps run through make in this order; the steps take the tag from the input `version`:
   - `make release-tag` requires a successful run `run` of `ci.yml` on `main` whose commit is on `origin/main`, and creates
     or passes the tags of the commit (see step 3);
   - `make release-versions` requires the version of the tag in every manifest that `config/release.json` lists, the
     module path of every Go module, and the section `## X.Y.Z` of `CHANGELOG.md` and `CHANGELOG.ko.md`; it fails with the
     file and both versions;
   - `make release-assets` runs `make build` and writes the archives of the packages of `config/release.json` to
     `var/release/assets`: `npm pack` of every npm package that is released and `git archive` of every Composer package
     directory as a zip, each named `<package>-<language>-<version>.<extension>` with `@scope/` and `vendor/` written
     `scope-` and `vendor-` and the language `npm` or `php` (`@polyspec/crudui-validator` is
     `polyspec-crudui-validator-npm-X.Y.Z.tgz`, `polyspec/crudui-validator` is `polyspec-crudui-validator-php-X.Y.Z.zip`).
     An archive installs beside the other archives without the repository tree. The published manifests are the package
     manifests of `packages/`, packed unchanged (see "Package manifests and development resolution"). The step fails
     with each packed manifest that differs from its package manifest or that names a dependency of the scope
     `@polyspec` or the vendor `polyspec` by anything but an exact version. Each Python package of `config/release.json`
     is a wheel, built by the `pythonBackend` of `config/toolchain.json` (kit K29, K166, C14.44); the generator requires
     the validator of the same release, `polyspec-crudui-validator==X.Y.Z`, whose wheel is an asset beside it. A crate is
     not released as an archive; it is consumed by git tag. A Go module tag builds and attaches nothing;
   - `make release-publish` creates the release of the tag as a draft with the archives and the section `## X.Y.Z` as
     its notes; a draft of an earlier run is replaced. GitHub accepts a release body of at most 125000 characters; a
     longer section is replaced by one line that links the section of `CHANGELOG.md` at the tag;
   - `make release-proof TAG=<tag>` proves the draft from outside the checkout: its assets, the consumer installs of
     `config/release.json` (see below), the git-tag installs and the Go modules;
   - `make release-undraft TAG=<tag>` makes the draft public, only after the proof passed. A failed step leaves the
     release a draft and fails the run.

The tests of polyspec/kit (`tests/kit/release.test.mts` and `tests/kit/release-go-tags.test.mts`) check the tool with command fakes.
`make release-coverage`
requires every `package.json`, `composer.json`, `Cargo.toml`, `pyproject.toml` and `go.mod` of the repository to be
classified in `config/release.json`.

`make release-consumer TAG=vX.Y.Z` (`node_modules/@polyspec/kit/dist/release-consumer.mjs`), which a developer runs after
`make release-assets` and the release proof runs on the draft, installs the archives of the tag from `var/release/assets` as a consumer
does, in a new temporary directory outside the repository with empty npm and Composer caches. The committed projects are
`tests/release-install/npm` (`package.json` with the tarballs as `file:` dependencies, and `package-lock.json`) and
`tests/release-install/composer` (`composer.json` with explicit package repositories whose dist URLs name the local zip archives, and `composer.lock`); the
scope `@polyspec` points at the unreachable registry `http://127.0.0.1:9/`. The polyspec packages come only from the
archives; a third-party package is downloaded only as its lock pins it, by its exact version and digest. Every installed
package is required at the version of the tag, and the smoke command of `consumers` in `config/release.json` runs in the
installed project. A Go module tag releases no archive, so nothing is installed for it.
`make release-consumer-lock` writes the manifests and locks of the version from the archives, with each polyspec archive
locked by name and version, without `integrity` in npm and with an empty `shasum` in Composer.
Before the first release of the version the files name the archives of an earlier version; step 2 writes them.

### Package manifests and development resolution

The `package.json` and `composer.json` of each published package of `packages/` is the manifest that its archive
publishes. It names every dependency of the scope `@polyspec` or the vendor `polyspec` by its exact version, and a
`composer.json` declares its `version`, which an `artifact` repository reads, and no `repositories`.

Development resolution is in the two root manifests, which are never published:

- the root `package.json` (`@polyspec/crudui-workspace`, private) lists `packages/*` under `workspaces`; npm links a
  workspace package whose version satisfies the exact version that another package requires, and
  `package-lock.json` records the links. A package of another polyspec repository is supplied only at this root:
  `@polyspec/ordered-json` is the root dev dependency of the release asset `polyspec-ordered-json-0.0.25.tgz` of the tag
  `v0.0.25` of `polyspec/ordered-json`, pinned by its URL and integrity like `@polyspec/kit`, and `make link` links it
  to a checkout that `.links` declares;
- the private root `composer.json` declares path repositories for `legacy/packages/validator/php` and `legacy/packages/generator/php`,
  with native symlinks and configuration references, and the packages.json repository of the OrderedJSON release. The
  CRUDUI packages use the checkout's exact version; the OrderedJSON constraint accepts its 0.0.x release. `composer.lock`
  records the selected source versions, requirements and autoload. PHPUnit, PHP checks and PHP servers load the
  installed packages through `vendor/autoload.php`.

`make crudui-test-dependencies` validates the root `composer.json` and its lock with `composer validate --strict`, and each
published `composer.json` with `composer validate --no-check-lock`, since a published package has no lock.


### Local source installation

The npm source folders are connected with native `npm link --no-save --package-lock=false`. The release manifest and
lock remain unchanged; source edits are immediately visible through the installed links. Compiled packages need their
native build after source changes.

The private Composer project uses the canonical `composer.json` and `composer.lock`; no separate local profile is
selected. Composer links this checkout's PHP packages and the declared OrderedJSON sibling source into `vendor/` and
owns their installed records and autoload. The install refreshes `polyspec/*` path packages and their dependencies
through native Composer resolution, without aliases, metadata rewrites or published archive downloads.

```sh
make crudui-install-composer
make crudui-local-composer-check
```

The declared sibling checkout must exist before installation; a CI job using this development project must provide it.
The lock changes when source resolution changes. PHP 8.4 and later are supported; Composer resolves development
dependencies against PHP 8.4.27. Windows installations use the 8.4.27-1 package rebuild, whose runtime reports 8.4.27.
The `.php-version` file selects the 8.4 minor for the shared installer. The platform check validates the installed source
requirements. Release archive consumer projects remain separate from this private development project.

### Installing the release archives

A consumer downloads the archives that it needs from the GitHub Release of a tag and installs them together, without a
registry:

- npm: list every tarball in `package.json` as a `file:` dependency, then run `npm install`. A dependency that an
  archive declares at an exact version is satisfied by the tarball of that package installed beside it.

  ```json
  {
    "dependencies": {
      "@polyspec/crudui-generator-html": "file:vendor/polyspec-crudui-generator-html-npm-X.Y.Z.tgz",
      "@polyspec/crudui-generator-core": "file:vendor/polyspec-crudui-generator-core-npm-X.Y.Z.tgz",
      "@polyspec/crudui-validator": "file:vendor/polyspec-crudui-validator-npm-X.Y.Z.tgz"
    }
  }
  ```

- Composer: put the zips in one directory and name it in an `artifact` repository; the zips resolve each other by name
  and version. A `package` repository entry per zip URL works the same way.

  ```json
  {
    "require": { "polyspec/crudui-generator": "X.Y.Z" },
    "repositories": [
      { "type": "path", "url": "vendor/polyspec" }
    ]
  }
  ```

  A `package` repository entry for one zip:

  ```json
  {
    "type": "package",
    "package": {
      "name": "polyspec/crudui-validator",
      "version": "X.Y.Z",
      "dist": { "type": "zip", "url": "https://github.com/polyspec/crudui/releases/download/vX.Y.Z/polyspec-crudui-validator-php-X.Y.Z.zip" },
      "autoload": { "psr-4": { "Polyspec\\Crudui\\Validator\\": "src/", "Polyspec\\Crudui\\": "src/Public/" } }
    }
  }
  ```
