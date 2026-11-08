# Development
<!-- doc-id: agents -->

The working principles of crudui are [PRINCIPLES.md](PRINCIPLES.md), its own copy of the principles that `@polyspec/kit`
ships as an example; this file states only the rules of crudui.

## Tests and runs

- Own: Each test case has its own timeout; a whole suite has none. Every test reports its start, its completion, its result
  and its elapsed time. A long operation (a build, an install, a toolchain setup, a browser close, a server stop, a whole
  suite) prints step logs and has no time limit: its result is judged from its observed outcome and errors. A test that
  runs for tens of minutes, or that prints only its start and its end, is a defect.
  Enforced by: none, a guided rule: each test's own review holds it.
- Refines P20: During development only the unit tests that own the change run. The full suite runs exactly once after
  every item of the active checklists, including `docs/plans/kit-standard/checklist.md`, is complete, and never after
  each change or item. Long operations run in the
  background and report their progress. A failure gets a task like any other defect.
  Enforced by: none, which unit tests a developer runs before a commit is a procedure that no check reads.
- Own: A push happens only when no task of the checklist is `[~]`, neither in a pushed commit nor in the working tree.
  Enforced by: none, no hook or CI job checks a push since K804.
- Own: While the version is 0.x there is no pull request, merge queue or GitHub ruleset. Work is committed locally, one
  checklist row per commit, and the owning unit tests pass before the row becomes `[o]`. `main` is pushed once, when
  development tasks and local candidate preparation are complete and no task is active. Candidate preparation runs before
  CI with current sibling sources and is not postponed until CI or a separate permission. A tag is created only after
  the CI check `ci-passed` and the push check `push-gate`
  succeeded for the commit on `main`; a release is made from that tag (`docs/operations/repository.md`).
  Enforced by: none, the order of pushes and tags is a procedure that no check reads.

## Tools and dependencies

- Own: PHP 8.4 and later are allowed. A verification record states the PHP version that actually ran.
  Enforced by: none, the supported PHP range is the repository rule.

- Own: The shared tools are the installed package `@polyspec/kit`, pinned by the root manifest and lock. Before the
  first make invocation, native npm reads the exact npm release from `packageManager` and runs the locked install
  (`docs/operations/package-build.md`). The `Makefile` holds every recipe that this repository runs; each recipe of a kit
  utility starts it from the installed package (`node_modules/@polyspec/kit`) with explicit arguments. After installation,
  `make install-tools TOOLS=npm` and `make install-packages` prepare the checkout tools and packages. The settings of the
  tools are the files of this repository that each tool reads: `.npmrc`, the `[settings]` and `[env]` of `mise.toml`,
  `ruff.toml`, `phpcs.xml.dist`, `phpstan.dist.neon`, `.golangci.yml`, `clippy.toml` with the `[workspace.lints]` of each
  `Cargo.toml`, `.oxlintrc.json` and `knip.json`. The CI workflows, the bootstrap action and `config/layout.kit.yml` are
  files of this repository too, taken from the examples of kit. Code imports kit modules through package exports.
  Enforced by: none, which recipes and tool settings the repository holds is its own design.
- Own: Every tool runs at the exact release that the checkout records (`mise.toml` with `mise.lock`, `rust-toolchain.toml`,
  `config/toolchain.json`, `packageManager` of `package.json`). An image is named by its digest, its Debian packages by a
  snapshot date, an action by its commit SHA and a browser by the build that the locked package pins. No run queries a
  registry for a latest release or a channel, and no tool installs another release on its own
  (`RUSTUP_AUTO_INSTALL=0`, `GOTOOLCHAIN=local`). A tool of the repository is installed into the checkout (`var/tools` by
  `make install-tools`), never into the machine. While the polyspec versions are 0.0.x, a development checkout links the
  installed polyspec packages to their source as `docs/operations/local-links.md` of kit describes; links are never committed.
  Enforced by: none, the recorded releases are installed by kit (K854); no check reads them any more.
- Own: The configuration of this repository is `config/*.json` (`toolchain`, `dependency-policy`, `dependency-review`,
  `checklist`, `documents`, `generated`, `owner-checks`, `rebuild`, `release`) and `config/layout.yml`, which name the
  exceptions of `config/layout.kit.yml`, each with its reason.
  Enforced by: `make layout-check`

## Layout, documents and changes

- Refines S5: Keep contracts in `docs/spec/`, implementation and deployment status in `docs/features.md`, procedures in
  `docs/operations/`, planned tasks with their verification and completion in `docs/plans/<plan>/checklist.md`, and
  actual changes in `CHANGELOG.md`. Every change belongs to a task of the checklist; add the task before the work when it
  is missing.
  Enforced by: `make layout-check`
- Own: Each completed feature is recorded in `CHANGELOG.md` and `CHANGELOG.ko.md` in the commit that completes it, as an entry
  `### <date> — <title> (<task ID>)` at the top of the section `## Unreleased`. Uncommitted changes stay within one feature.
  Enforced by: none, `make records-check` is run by hand and no hook or CI job reaches it.
- Own: Every path has an owner in `config/owner-checks.json`, with the paths that each check reads. A new path gets its owner in
  that file in the same change.
  Enforced by: `make owner-validate`
- Own: Write comments, documentation, change records and user-facing text as direct descriptions of current behavior. Name the
  subject, operation, target and result; state a necessary cause in one sentence. Do not use metaphors, personification or
  conversational wording. Do not record external source, copying or adaptation history. Name an external project only when
  its identity, API or path is required by the current contract or procedure.
  Enforced by: none, `make records-check` is run by hand and no hook or CI job reaches it.
- Own: Keep personal preferences and conversation context outside the repository.
  Enforced by: none, which context belongs outside the repository is a judgement.

## Design

- Own: Separate structure compilation, instance data, rendering and validation.
  Enforced by: none, the separation is a design judgement.
- Own: Record the repository paths that this repository creates relative to the repository. Runtime code resolves repository
  inputs from its declared root or module location, either declaratively (a path named in a tracked file) or by discovery
  (a stated discovery rule). Require an explicit path or one authoritative discovery record for external inputs. In what
  this repository creates, reject symbolic links, missing records and ambiguous discovery results. Links that an outside
  tool creates are accepted as that tool behaves.
  Enforced by: none, the path rules are a design judgement.
- Own: Generated files are never tracked in Git. This covers dependency installs (`node_modules/`, `vendor/`, virtual
  environments), build output (`dist/`, `target/`, `*.tsbuildinfo`), caches, test run artifacts and tool downloads
  (`var/`). The tracked exceptions are the lock files (`package-lock.json`, `composer.lock`, `Cargo.lock`, uv locks,
  `mise.lock`), the committed generated documents that this file names, and test fixtures. A new generator adds its
  ignore entry in the same commit.
  Enforced by: `make layout-check`

## Checklist

- Own: A withdrawn task is classified by its current cause. A conditional decision names its retry condition and a
  local candidate review in `docs/plans/release-readiness/`; it is reconsidered before candidate CI. An earlier impossible
  or bypassed state does not make that decision permanent or complete the candidate review.
  Enforced by: none, classification and candidate review are procedures.

- Own: `docs/plans/execution-checklist/checklist.md` groups tasks under linked Wave headings. Checklist tables use the
  columns ID, Task, Deliverables, Verification and State. A base task ID has the form `C<wave>.<number>`; sub-items
  follow P24. The state marker appears only at the start of the State cell. Each plan's `plan.md` holds its dependencies.
  Enforced by: `make docs-check`
- Own: A received instruction is classified first: a task of the checklist, a rule of this file, or an answer only. Unless the
  instruction states that it is urgent, record it as a task with its priority and continue the task in progress. Rules
  belong in this file, never in the checklist or the changelog.
  Enforced by: none, the triage of an instruction is a judgement.

## Idempotency

The same tree gives the same result on every date and machine, and a failed run shows what failed and why.

- Own: Inputs: a check reads only outputs that it or its declared preparation creates in the same run (a build through
  `require-current-build`, a reinstalled copy, its own records), never the leftover of another command or run.
  Enforced by: none, the reads of a check are declared in `config/owner-checks.json` and reviewed there.
- Own: Publication: a shared output that another run may read is written to a path of its run and renamed into place.
  Enforced by: none, the publication path is a design judgement.
- Own: Failures: every independent check runs after an earlier one failed (`|| status=1` and `exit $status`), and the run fails
  after the last one with each failure; `&&` joins only steps whose later step reads the output of the earlier.
  Enforced by: `make lint-ts`
- Own: Messages: every failure states the expected value, the actual value and the error of the tool, with the command, the
  path and the limit concerned; a timeout names the command, its limit and the elapsed time.
  Enforced by: none, the wording of a message is a judgement.
- Own: Empty selections: a run, a selection or a check list that checks nothing fails (`ran no test case`, `ran no command`,
  an empty list of a check).
  Enforced by: none, each runner reports an empty selection by its own rule.
- Own: Processes: a run starts its processes in a group of their own, stops the whole tree and waits until it is gone, and
  releases what it holds in `finally`.
  Enforced by: none, the process handling is reviewed in the code of each run.
- Own: Assertions: a test asserts the structured result of an external tool (its exit status, report, events), never its
  human-readable output, whose wording changes with its version, its locale or a parent process. The commands of a
  Makefile target are read only through `makeDryRun` of `tests/build/make-dry-run.mts`.
  Enforced by: none, a guided rule: each test's own review holds it.
- Own: Shared resources: a resource that runs share is held by a lease (holder-lock of `@polyspec/kit`), or each run uses a
  directory, name or port of its own. A port is taken by the server that listens on it (port 0) and announced, never
  probed before.
  Enforced by: none, the lease use is reviewed in the code of each run.

# Releases

- Own: A release is a tag of a commit of `main`, which passed the full suite of CI: `vX.Y.Z` for the repository,
  `<directory>/vX.Y.Z` for the Go module of that directory. Only the maintainer creates, moves or pushes a tag; the release
  dispatch names the id of a successful run of `.github/workflows/ci.yml` on `main`, and `make release-tag` creates the tags on
  that run's commit.
  Enforced by: `make release-tag`
- Own: Before candidate CI, the commit `chore(release): Release X.Y.Z (#<task ID>)` prepares the candidate: it sets the version of every manifest that `config/release.json` lists (`package.json`, `Cargo.toml`,
  `pyproject.toml`, the `composer.json` of `packages/`), and of every dependency on a package of the repository, to X.Y.Z,
  and renames `## Unreleased` of `CHANGELOG.md` and `CHANGELOG.ko.md` to `## X.Y.Z` below a new empty `## Unreleased`.
  Enforced by: `make release-tag`
- Own: After local preparation and successful CI checks for that commit, the maintainer tags it and pushes the tag. `.github/workflows/release.yml` runs
  `make release-tools`, `make release-tag`, `make release-versions`, `make release-assets`, `make release-publish`,
  `make release-proof` and `make release-undraft` (the release tool of `@polyspec/kit`). It takes the run id of a successful
  `ci.yml` run on `main`, the version in every manifest of the tag and the section
  `## X.Y.Z`; it creates the GitHub Release as a draft with that section as its notes and the archives of `packages/`,
  proves the draft from outside the checkout and then makes it public. A section over 125000 characters, the limit of a
  release body, is replaced by one line that links the section of `CHANGELOG.md` at the tag. A crate is not released as an
  archive; it is consumed by git tag. A Go module tag builds and attaches nothing (`docs/operations/repository.md`).
  Enforced by: `make release-tag`
