# Test execution
<!-- doc-id: docs-operations-testing -->

[한국어](testing.ko.md).

Run from the repository root. A checkout first runs `make install-tools TOOLS=npm`, which installs the npm of
`devEngines.packageManager` with the copied installer of `scripts/kit/bootstrap`, and `make install-packages`, which installs
`package-lock.json` with that npm, the package `@polyspec/kit` included; until then no other target runs. Every tool runs at
the release that the checkout records (`docs/operations/package-build.md`, "Runtime and dependency versions"): `make install` installs the
recorded npm, the npm and Composer dependencies, the Rust toolchain of `rust-toolchain.toml`, the
crates of every Cargo.lock with the OrderedJSON checkout of the comparison (`make crudui-install-crates`) and
the phpDocumentor release that `scripts/install-phpdocumentor.mts` checks by its SHA-256,
and the tools of the checkout are installed at their recorded releases by kit (K854).
Install the tools that the checkout declares (npm, Go, uv and Python, alint, ruff, vulture, golangci-lint, deadcode,
Composer with PHPCS and PHPStan, cargo-audit) into the checkout with `make install-tools`
(`node_modules/@polyspec/kit/dist/install-tools.mjs`; `TOOLS="go cargoAudit"` names the tools to install, and a workflow job installs only the ones it uses), which never changes the tools of the
machine; make puts their commands in `var/tools/bin` first on `PATH`, and a shell that runs npm
itself puts them there with `export PATH="$PWD/var/tools/bin:$PATH"`. `.npmrc` sets `strict-allow-scripts`, so
`make install-packages` fails on an install script that `allowScripts` of `package.json` does not approve. Install the PHP package's Composer dependencies,
and make PHP, Go and Cargo available on `PATH`, with `php-fpm` and `nginx` for the PHP record
servers of the comparison example (Debian and Ubuntu:
`php8.x-fpm` and `nginx`, with `php-fpm` linked to the versioned binary). Build JavaScript packages before
checking their compiled exports.

The release profile of the cross-check console's Rust validator program uses `strip = "none"`.
This keeps release builds independent of the toolchain's optional `rust-objcopy`/`libLLVM.dylib`
strip pairing; a build must not leave a strip warning after reporting a successful binary.
Every crate that declares a release profile sets `strip = "none"`;
`tests/build/rust-release-profile.test.mts`, run by `npm run test:runtimes`, fails otherwise.

During development, run only the unit tests that own the change: its Red and Green cases.
End-to-end checks (browsers, containers, the form comparison, the native and cross-check suites,
full builds), `make owner-check` and the full run run in CI on the push to `main`, and no rule
requires a local check before a push or a commit; the pre-push hook only refuses a push while a
checklist task is `[~]` (below).

Every step of the workflows runs a make target: the installs (`make install-tools`, which installs
the Rust toolchain of `rust-toolchain.toml` too, `make install-packages`, `make crudui-install-composer`,
`make crudui-install-crates`, `make crudui-install-browsers BROWSERS="..."`), each
check (`make crudui-test-runtimes`, `make lint`, `make crudui-test-forms` and the others of `CI_COMMANDS`), so the
recipes start every tool with the offline settings, `$(NPM)` and the toolchains of the checkout.
`tests/build/ci-local.test.mts` fails for a step that starts node, npm, npx, cargo, go, php,
composer, rustup, python3 or sh without make.

`CI_TARGETS` of the Makefile lists the targets of the workflow in its order; `tests/build/ci-local.test.mts` fails
when the list differs from `.github/workflows/ci.yml`.

A failure never stops the later checks, so one run reports every failure. Each CI job runs its
checks in one step, `make ci-targets TARGETS="..."`, which runs every target to its end, and that
step has `if: ${{ !cancelled() }}`, so a failed preparation does not skip the checks of its job;
`tests/build/ci-local.test.mts` fails with the job and the step of each checking step without it. A Makefile target never takes a target that runs tests as a prerequisite, because
make stops at the first prerequisite that fails; a target that runs several test targets, such as
`make crudui-test-native` and `make docs-check`, runs each with `$(MAKE) <target> || status=1` and exits
with the collected status. Make also stops at the first recipe line that fails, so the recipe line
that runs the first check of a target is its last line and runs each check with `|| status=1`,
ending with `exit $$status`, as `make docs-check-documents` and `make format-check` do. Preparation
lines before it, such as a build or an install, still stop the target, and a chain joined by `&&`
whose later steps read the result of the earlier ones, as in `make docs-verify-idempotent`, is one
check. A package script and a CI step follow the same rule: several independent checks run as
`status=0; <check> || status=1; ...; exit $status`, as `npm run test:forms` and
`npm run test:form-comparison:pipeline` do after `node scripts/require-current-build.mts || exit 1`,
and an `&&` chain puts no step after a check.
`scripts/run-contract-tests.mts` runs every declared command, also after an earlier one failed, and
fails after the last one.

The CI workflow runs these targets in its jobs on each push to `main` and each manual run (`workflow_dispatch`); the
full suite runs nowhere else ([PRINCIPLES.md](../../PRINCIPLES.md), Verification).

The native suites run in three CI jobs, so no job waits for a suite that another runtime needs:
`php-engine` runs `make crudui-test-php-engine` once with Node.js and the C compiler, `native-generators`
runs `make crudui-test-native-generators` and `make crudui-test-bench` once, and `php-api` runs `make crudui-test-php-api`
once on the PHP minor of `.php-version`, which every setup-php step of the workflows reads. `make crudui-test-native` runs the three targets in one command
(`docs/operations/native-generators.md`).

Every job that installs the npm packages restores and saves `~/.npm` with `actions/cache` under the
key `npm-<system>-<architecture>-<hash of package-lock.json>` before it installs npm, and `setup-node`
caches nothing: its cache saved the npm directory of the job that finished first, also of a job that
installs no npm package, and every later job restored 700 bytes. A run reads the caches of its own
ref and of `main`, so the cache that `.github/workflows/pages.yml` saves on `main` under the same key
serves every later run. The Cargo cache of `Swatinem/rust-cache` has a key of its
job, the Rust toolchain and the Cargo locks of its workspaces; each job id has one such key.

On request, `make owner-check` runs the checks that own the changed paths: the uncommitted
changes and new files, the paths of `PATHS`, or the paths changed since `BASE`. `config/owner-checks.json`
names, for globs of paths, the make targets, the root npm scripts, the test scripts of workspaces and
package directories and the node test files that own them, and for a check the paths that it reads
(`inputs`). `node_modules/@polyspec/kit/dist/owner-check.mjs` fails before any check runs for a path that no rule owns, a glob
without a path, a target of the full suite, an unknown script or test, and a path that a check reads
when no rule of the path selects that check; it runs every selected check, also after one failed, and
never the full suite. `make owner-validate` checks the declaration of the repository, and `tests/kit/owner-check.test.mts` of polyspec/kit
checks the selection and the refusals.

A test that reads the commands of a Makefile target runs `makeDryRun` of
`tests/build/make-dry-run.mts`: `make --no-print-directory -n <target>` with `MAKEFLAGS=w` and without
`MAKELEVEL`, `GNUMAKEFLAGS`, `MAKEFILES` and `MFLAGS` of a parent make, so GNU Make 3.81 and GNU Make 4,
also inside another make, print only the commands. `tests/build/make-dry-run.test.mts` fails for a dry
run of make outside it.

A push happens only when no task of the checklist is `[~]`. The tracked pre-push hook
`.githooks/pre-push` runs `make push-gate-hook` (`node node_modules/@polyspec/kit/dist/push-gate.mjs hook`) with the refs that Git pushes. The check
reads the checklist of every pushed commit (`git show <sha>:docs/plans/execution-checklist/checklist.md`) and
of the working tree, and refuses the push with status 1 while one of them has a task in progress.
It prints the file, the ID and the title of each such task with the pushed ref and commit or
`working tree`, and states which states block a push (`[~]`) and which do not (`[ ]`, `[o]`, `[!]`);
complete the task, or mark it `[!]` with its cause and retry condition. A pushed commit without the
checklist, a malformed line of the hook input, a checklist that cannot be read and a Git error also
refuse the push, naming the cause; a deleted ref pushes no commit and is checked by the working tree
alone.

`config/checklist.json` lists no Git hook of this repository. `make hooks`
(`node node_modules/@polyspec/kit/dist/git-hooks.mjs install`), which `make install-packages` runs first, declares the
merge drivers of the changelogs and checklists, and `make hooks-check` fails while one of them is not declared.

A clone without the hook, or a push that skips it, still reaches GitHub. The job `push-gate` of
`.github/workflows/push-gate.yml` runs on every push to a branch, checks out the pushed commit and runs
`make ci-targets TARGETS="push-gate-commit records-check"`. `make push-gate-commit`
(`node node_modules/@polyspec/kit/dist/push-gate.mjs commit HEAD`) fails while the checklist of that commit has a task in
progress, when the commit has no checklist and when it does not track `.githooks/pre-push` as an
executable file (mode `100755`); it prints the refusal through the progress lines, each line as an
error annotation, and in the job summary. `make records-check` runs `make docs-check`
(`node_modules/@polyspec/kit/dist/check-documents.mjs`, `config/documents.json`) and the link, changelog, writing, example and fixture README
tests, which need Node.js alone and read neither the network nor the history, so a commit that breaks the document or
checklist rules fails the check that a release requires ([Repository](repository.md#publishing-main)).
`make docs-check-documents` runs `make records-check` with the rest of its document checks.

The individual commands are:

```sh
composer install
npm run build
npm test --workspace @polyspec/crudui-validator
composer --working-dir=legacy/packages/validator/php test
node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd legacy/packages/validator/go -- ./...
node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml
npm test --workspace @polyspec/crudui-cli
npm run test:forms
npm run test:packages
make docs-check
```

Validator package suites run the shared fixtures described in the
[fixture contract](test-fixtures.md). The PHP suites run the PHPUnit of the root `vendor/`, which
`composer install` of the development root installs: `node_modules/@polyspec/kit/dist/run-tests.mjs phpunit` runs the PHPUnit of
the nearest Composer project at or above `--cwd` that has one, the root for every package of `packages/` (kit K186).
Compare the expected validation result or complete failure record, not only
agreement between implementations. Package checks verify exported files, declarations,
install compilation and production rendering.

## Lint

`make lint` runs `make lint-ts` of kit and the Svelte lint of `packages/svelte`; CI's build, lint and types
job calls it. `make lint-ts` runs oxlint with the copied `.oxlintrc.json`
(type-aware through oxlint-tsgolint, warnings denied) over every file that Git does not ignore, knip from the root with the
copied `knip.json`, and API Extractor in each package with an `api-extractor.json`. oxlint has no Svelte rules, so
`npm run lint -w @polyspec/crudui-generator-svelte` runs ESLint with eslint-plugin-svelte on the components of that
package (`packages/svelte/eslint.config.js`), whose TypeScript scripts typescript-eslint parses with the
TypeScript 6 of that package. A rule is turned off only for the lines where it does not apply, with a disable comment that
names the rule and gives the reason.

`tests/build/lint-coverage.test.mts`, run by `npm run test:build`, requires `make lint` to run both lints, and fails
unless oxlint with the copied configuration fails on a planted violation and the Svelte lint fails on a planted raw HTML
tag.

## Test runner

Every test runs through `node_modules/@polyspec/kit/dist/run-tests.mjs`:

```sh
node node_modules/@polyspec/kit/dist/run-tests.mjs <node|vitest|go|cargo|phpunit> [--cwd <directory>] [--] [<arguments>]
```

The runner prints each test's start, a line while it is still running, its result and its
elapsed time. It sets no time limit: it runs the tool and passes its output and exit code through.
Package scripts, Composer scripts and Makefile targets call test tools only through this runner.
PHPUnit runs with `--teamcity`: the runner counts each TeamCity test, never a test class or a data
provider method, and prints every line that is not a TeamCity message, such as an error about a
missing test file or the summary with its warnings.

Every registered case of a `node:test` file runs, or the file fails. Two checks hold it:

- The runner preloads `node_modules/@polyspec/kit/dist/test-exit-deadline.mjs` into every test file's process. A
  process whose tests have all ended but that stays alive for the test timeout holds a handle that a test left open; it
  names those handles and fails its file, so a leak cannot hold the run, and no `--test-force-exit` ends a process
  before a test that the module registers after a top-level `await`.
- A file that reports no case, neither passed, failed nor skipped, fails with `the file ran no test
  case`, for example when `--test-name-pattern` selects none of its tests.

The tests of polyspec/kit run files for both checks.

Every failure of a run is printed with its test file and elapsed time, including a failure outside
a test: a hook that fails or runs out of time and an error of a test file. A file or a suite whose
hook fails is printed as failed, even when every test in it passed. The summary line names the
failed groups, so a run whose tests all passed and whose tool exits with a nonzero code shows the
failure that caused the code. `tests/kit/run-tests.test.mts` of polyspec/kit runs these cases.

A setup (a browser launch, a server start, a stylesheet compile, a build) and a teardown (a
browser close, a server stop, a directory removal) are long operations, not test cases. A
`node:test` file registers them with `setup` and `teardown` of `node_modules/@polyspec/kit/dist/test-hooks.mjs`, a
`before` or `after` hook of the file, of a suite or of one test (`{ context: t }`) with the timeout
`Infinity`: each ends when its operation settles (the browser launched, the server listens, the
close resolved, the process exited), its error fails the file, and it prints its start, a line
every five seconds while it runs and its end with the elapsed time. A Vitest setup or teardown is a
`beforeAll` or `afterAll` hook with the timeout `Infinity`. A test opens pages of a browser that a
setup launched instead of launching one. The tests of polyspec/kit run files whose setup or teardown outlasts the
test timeout.

A type assertion (`expectTypeOf`) lives in a `*.test-d.ts` file, which the typecheck mode of Vitest
(`test.typecheck` with `enabled: true` in the Vitest configuration of the package) checks with `tsc` and the
`tsconfig.json` of the package in the same run as the runtime tests; a runtime test file does not evaluate
`expectTypeOf`. `legacy/packages/validator/ts` checks the authoring types this way (`src/types.test-d.ts`).

## Time and load

A test never compares an elapsed time with a limit or with another elapsed time, because the
load of the machine changes elapsed time. It checks the cause instead: an event, a result that only
the expected path produces, or an operation that never ends unless the code under test stops it,
under the test's own timeout. `tests/build/test-commands.test.mts` fails on an assertion that bounds
an elapsed time. A check that an operation takes linear time does one of
two things:

- It counts a deterministic quantity. The JavaScript checks of the validator count reads of the
  data with getters and of the text with a counting `codePointAt`, and fail at the first read
  beyond the reads of a linear walk, because a JavaScript test runner cannot stop synchronous work.
- It runs an input so large that a quadratic or exponential implementation does not end before
  the test's timeout, while the linear implementation ends within a few seconds. The PHP, Go and
  Rust validator checks and the PHP extension engine fixtures do this.

`tests/build/validator-test-clocks.test.mts`, run by `npm run test:runtimes`, fails when a
validator test or a PHP extension engine fixture reads a clock.

`tests/build/test-commands.test.mts`, run by `npm run test:runtimes`, fails when:

- a package script, Composer script, Makefile target or CI step calls a test tool directly;
- a CI job or step has `timeout-minutes`. A step runs tests or a long operation (a checkout, a
  toolchain setup, an install, a build, a lint or type check, an upload, a deployment). The runner
  bounds each test case of a test step; a long operation prints its logs and has no time limit. A
  step runs tests when its command calls `node_modules/@polyspec/kit/dist/run-tests.mjs` or reaches, through npm scripts,
  Composer scripts and Makefile targets, a test command or the runner;
- a script that a test command starts does not print through `node_modules/@polyspec/kit/dist/test-progress.mjs`;
- a `node:test` file is run by no project command;
- a TypeScript package has no `typecheck` script, or CI does not run `npm run typecheck`.
- a Makefile target takes a target that runs tests as a prerequisite;
- a recipe line follows the line that runs the first check of its target, a check ends the recipe
  with `|| exit`, or a check of that line does not set `status=1` before the next check;
- a package script or a CI step puts a step after a check in an `&&` chain, or runs several checks
  of which one does not set `status=1` before the command exits with the collected status.

## Commands of long operations

A script that runs other commands runs each of them to its end through `@polyspec/kit/run-command`:
the declared commands of `npm run manifest:test` (`scripts/run-contract-tests.mts`), the package
build of `scripts/require-current-build.mts`, each tool command of `scripts/gen-api-docs.mts`, each
benchmark driver of `benchmarks/validators/run.js` and each driver build of `benchmarks/validators/build-drivers.mjs`.
A command has no time limit: its exit ends it and its exit status decides the result, and the
script prints the command with its elapsed time. The command starts in its own process group; when
it exits, the processes it left in the group are stopped, so a process that keeps an output pipe
open cannot hold the script. An interrupted script stops its running commands.
The runner and its tests belong to `@polyspec/kit`; a script of this repository only imports it.

`make conformance` runs every suite that records conformance evidence and checks that evidence
against the feature contract; see [conformance evidence](conformance.md).

## Root test command

Root `npm test` runs the test script of every workspace package
(`npm test --workspaces --if-present`), each through the test runner. Build the
JavaScript packages first; the generator suites read the built output.

```sh
npm run build
npm test
```

## Forms and reports

`npm run test:inspector` runs the form snapshot and browser inspector tests, which compare raw HTML,
parsed DOM, computed styles and live control state without modifying the inspected form.
`npm run test:form-comparison:pipeline` builds the five record servers from this tree (the
OrderedJSON PHP extension package that PIE built (`make ordered-json-ext`, recorded in `var/ordered-json-package`), both PHP extensions, the Go binary
and the Rust binary), starts each one as a local process on a free port of 127.0.0.1, runs the
record-store HTTP contract against all five, runs the Go and Rust server tests and runs the
canonical List → Detail → Form → Save → List refresh check for all 40 server, client and
initialization combinations against that local stack; it needs PHP with `php-config`, Composer, Go,
Rust and Chrome. `npm run test:form-comparison:checks` (`make crudui-test-form-comparison-checks`) starts
the same local stack and runs the PHP processor modes, the generation, persistence and canonical
flow checks, the browser checks of the four native servers with their interaction checks, the
browser aggregate and the typing check against it, checks the evidence and stops the servers
([local verification](form-comparison.md#local-verification)). `make crudui-test-form-comparison-browser`
(the browser checks of the servers of `FORM_SERVERS`, reports in `FORM_BROWSER_REPORTS`) and
`make crudui-test-form-comparison-summary` (every other check, with those reports) run the same checks in
the two parts that CI runs, the first in one CI job per server. The
[form comparison](form-comparison.md) defines the record resource, the page and those
checks. JSON order and HTTP save/load checks are separate from validator package tests.

`npm run test:forms` checks the stylesheet layout in Chromium, Firefox and WebKit on the host and
the custom properties of the stylesheet (`tests/style-properties.test.mts`).
The CI job `form-runtime` runs the same checks on its Linux runner, `ubuntu-24.04`, with the
Chromium and Firefox builds that Puppeteer pins and the WebKit build that Playwright pins, installed
by `make crudui-install-browsers`; an engine difference on Linux shows in that job.

Record the revision, commands, results and deployment status in
[feature status](../features.md). A test result applies to the code and inputs
actually executed. Test counts alone do not establish coverage or deployment.

## Reports

Every CI job leaves the reason of each failure. `make ci-targets TARGETS="..."`
(`node_modules/@polyspec/kit/dist/ci-targets.mjs`) runs each target as `make -k <target>` to its end, also after an earlier
target failed, prints its output and writes it to `var/report/ci-targets/targets/<target>.log`;
`summary.md` names each target with its result and time and, for each failed target, its first
failure lines and its log (`node_modules/@polyspec/kit/dist/target-report.mjs`), and the same text goes to the job summary of
GitHub Actions. The run holds the lock `var/report/ci-targets.lock`, so two runs never write one
report, and ends with status 1 when a target failed. Each job uploads `var/report/ci-targets` as the
artifact `report-<job>` under `if: ${{ !cancelled() }}` with
`if-no-files-found: error`. `tests/build/ci-local.test.mts` fails for a job that runs a check outside
`make ci-targets` or uploads no report, and `tests/kit/ci.test.mts` of polyspec/kit runs a failing and a
passing probe target and finds both logs, the failure line in the summary and the job summary.

## Shared resources

Runs of different checkouts run on one machine at the same time. A resource that one
run can own is created for that run: a temporary directory from `mktemp -d` or `mkdtemp`, a port
the operating system assigns, or a name that contains the run's identity. A resource that is single
for the machine or the checkout is used under a holder lock of `node_modules/@polyspec/kit/dist/holder-lock.mjs`:

- One run holds the lock at a time. The lock file holds the holder's record: the checkout of the
  code that took it, the pid, the start time of that process, the time the lock was taken, the
  command and a random token. The record is written completely to a private file and linked to the
  lock path, and the link fails when the lock exists, so the lock is taken atomically and a reader
  never sees a partial record.
- A run that finds the lock held fails with the holder's record.
- A lock whose holder process no longer runs, or whose pid now belongs to a process with another
  start time, is reported with its record and kept. Remove it explicitly with
  `node node_modules/@polyspec/kit/dist/holder-lock.mjs clear <lock file>`, which refuses a running holder.
- Only the holder releases the lock; the release checks the token of the record first.
- `node node_modules/@polyspec/kit/dist/holder-lock.mjs run <lock file> -- <command>` runs a command while holding the
  lock, passes SIGINT, SIGTERM and SIGHUP to it, releases the lock when it exits and exits with its
  status. It prints the acquisition and the release.

The lock of a resource of one checkout is `var/locks/<name>.lock` in that checkout, and a lock file
is given as an absolute path. `tests/kit/holder-lock.test.mts` of polyspec/kit checks the record, the refusal,
concurrent runs and the removal of a lock whose holder no longer runs, and the release.

| Resource | Use by one run |
|---|---|
| Snapshots of `make docs-verify-idempotent` | A directory from `mktemp -d`, removed at the run's exit |
| `dist` of each built package | Checkout lock `dist-<package folder>`, held by the package's whole build and by every pack; the build writes `dist.next` and replaces `dist` with it |
| The build stamp, the PHP modules and their build records, the OrderedJSON checkout | Written to a path of the run and renamed into place (`tests/build/atomic-publish.test.mts`) |

The build script of every built package is `node ../../scripts/package-dist.mts build '<command>'`,
which runs the build command under the package's `dist` lock. The command writes into `dist.next`,
which `CRUDUI_DIST` names, and a complete build replaces `dist` with two renames, so a test or a
program that reads `dist` during a build finds the previous output or the new one, never an emptied
directory; a failed build leaves `dist` as it was. `node scripts/package-dist.mts pack
<package directory> <destination directory>` checks under the same lock that `dist` holds output
and runs `npm pack`, whose JSON report it prints on standard output; the package install check and
repositories that install CRUDUI archives pack through it, so a pack never reads a `dist` that a
build has emptied. On Linux the lock reads the start time of a process from `/proc`, since minimal
container images have no `ps`.

`tests/build/shared-resources.test.mts`, run by `npm run test:runtimes`, checks the documentation
and `dist` rows; it checks the `dist` lock on a fixture package that it builds in a temporary
checkout, so it reads no build output of the repository and runs before `npm run build`.

## PHP source and extension test scopes

Each PHP library declares a `public` PHPUnit suite and a `php-source-internal` suite. The default suite is `public`, which
the extension runs with the PHP library source-load guard enabled. Tests that call implementation helpers remain in the source
suite. A mixed test class keeps public API assertions in the public suite and moves helper assertions into a source class.

The source Composer test scripts select both suites. The PHP validator CI entry uses that script, the PHP API CI entry
selects both generator suites, and `make crudui-test-php-source` includes the source-internal suites. Public extension runs retain every
public case. Shared expression and composition fixture checks retain their PHP source bindings and their separate native
C engine bindings. No contract requirement or fixture case is removed.

`npm run test:php-scope` asks native PHPUnit for XML case listings and verifies that public and source-internal case IDs
are disjoint, their union equals all discovered cases, and the default equals the complete public selection. The same unit
checks the source entry commands. Fixture JSON uses the public OrderedJSON API through `tests/php/FixtureJson.php`, so
unpaired surrogate inputs are preserved without loading a PHP implementation helper into the extension process.
