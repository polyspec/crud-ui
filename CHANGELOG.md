# Changes
<!-- doc-id: changelog -->

## Unreleased

### 2026-11-01 — Adopt kit 0.0.86 and ordered-json 0.0.16 (C17.108)

- crudui is on kit 0.0.86 and ordered-json 0.0.16, whose release assets carry the packer's file name (P39); `config/release.json` declares the product and the runtime of every package, `ci.yml` is named `ci` for the release workflow of kit, and the package-name test no longer reads a product of `release.json` as an old crate name.

### 2026-10-31 — Test only the workflows of crudui (C17.107)

- The workflow tests read only `ci.yml` and `pages.yml`; the copies of kit, `ci-pipeline.yml` and `release.yml`, which kit-check holds equal to the installed kit, are left out through `isVendored`, so a kit release no longer changes a crudui test. The release-input test is removed.

### 2026-10-31 — Read the kit 0.0.84 workflows in the build tests (C17.105-1)

- The build tests read the workflows that kit 0.0.84 copies: the bootstrap line is matched whole, `npm@$version` read from `devEngines.packageManager` counts as the recorded npm, the sidecar manifests under `.mise/locks` are not crudui packages, and the release dispatch takes only the run (K924). Main CI run 41200932267 failed runtime shards 1 and 2 on them.

### 2026-10-31 — Adopt kit 0.0.84 (C17.105)

- kit 0.0.84 is the pinned release: package.json declares npm 12.2.0 in `devEngines.packageManager` (K938) and mise.toml declares `npm:npm` with its mise.lock entry and the sidecar lock under `.mise/locks/npm-npm/12.2.0`; the CI bootstrap runs that npm outside the checkout with `--prefix`; `config/generated.json` lists the two Go tables as `tracked` with their reasons; the CI steps no longer call `kit-install-php-arginfo`, which kit 0.0.81 removed (K930).

### 2026-10-31 — Check the arguments of the OrderedJSON package-folder script (C17.104)

- `scripts/ordered-json-package.mts` checks its two arguments before it uses them, so the root typecheck of the build job passes; main CI run 41177855445 failed on its types.

### 2026-10-31 — Class the OrderedJSON package-folder script for rebuild-check (C17.103)

- `scripts/ordered-json-package.mts` is classed as policy in `config/rebuild.json`, since PIE defines no record of its package folder; the kit job of main CI run 41176818702 failed rebuild-check on it, and the runtime tests and conformance evidence that depend on that job were skipped.

### 2026-10-31 — Record the OrderedJSON package folder in a script of its own (C17.102)

- The record of the PIE package folder of ordered-json-ext is `scripts/ordered-json-package.mts`, not an inline node script of the Makefile, so the offline test no longer reads its line as a download; main CI run 41167701052 failed shard 3/4 on that line.

### 2026-10-31 — Run the OrderedJSON PIE test in the runtime checks (C17.101)

- `tests/build/ordered-json-pie.test.mts` is in the runtime test command, so every node:test file of `tests/build` runs in a project command; main CI run 41167701052 failed shard 2/4 because the file was not listed.

### 2026-10-31 — Remove the TypeScript 6.0.3 exception of the toolchain file (C17.100)

- config/toolchain.json no longer carries the TypeScript 6.0.3 exception of packages/svelte, since kit K953 deletes the version machinery that read it and the file accepts only rust nightly exceptions; the package.json pins of packages/svelte stay.

### 2026-10-31 — Remove the unread npm field and restamp the KO changelog (C17.98-1)

- RecordedToolchain of tests/build/runtime-version-policy.test.mts no longer reads an npm field, the second packageManager parser of the audit; the KO twin of CHANGELOG.md is restamped with make documents-stamp.

### 2026-10-31 — Restore the released 0.0.9 entries and state the 0.0.81 wording (C17.96-1)

- The two released 0.0.9 entries that named pie-build are back at their published text; the wording of the Unreleased entry and the row says kit main removes pie-build (K931), to be released in 0.0.81.

### 2026-10-31 — Declare the sha512 digest of npm 12.2.0 in packageManager (C17.98)

- package.json's packageManager is npm@12.2.0+sha512.<hex>, the digest of the registry's dist.integrity, which the bootstrap of kit main requires (K933). It needs no kit pin change.

### 2026-10-31 — Record the publication of 0.0.9 (C17.97)

- Release run 41090852507 took CI run 41086677097 of db740a10. The tag v0.0.9 is annotated (bb3dbf85) on db740a10, and the GitHub Release is public, not a draft, with 12 assets.

### 2026-10-31 — Build the OrderedJSON php-ext with PIE directly, not kit's pie-build (C17.96)

- `make ordered-json-ext` empties var/pie/polyspec/ordered-json-php-ext, runs `pie repository:add` and `pie build` there, and records the install-path of the one installed.json entry in var/ordered-json-package. kit main removes pie-build (K931), to be released in 0.0.81, so the recipe no longer calls it.

## 0.0.9

### 2026-10-31 — The lint-coverage test asserts the Svelte lint of make lint, not kit's lint-ts (C17.91-2)

- tests/build/lint-coverage.test.mts asserts that make lint runs the Svelte ESLint, the second test that the C17.91 rule missed; the CI build-lint job is asserted by ci-local (C17.91-1).

### 2026-10-30 — Install PIE in the target that builds the OrderedJSON php-ext, and fail when the build fails (C17.93)

- `make ordered-json-ext` installs the PIE of http:pie first (`make install-pie`, `install-tools TOOLS=pie`), so no job that builds the package can forget it, and writes the output of pie-build to a file, so a failed build fails the target.
### 2026-10-30 — build-lint runs the Svelte lint, not kit's lint task that repeats the shared gates (C17.91-1)

- ci.yml's build-lint job runs crudui-lint (the Svelte lint) instead of `lint`, whose recipe is kit's lint task and runs lint-<runtime> of every runtime, which repeats the gates of kit's pipeline; the K870 test asserts it.

### 2026-10-30 — Lint the Svelte components only; kit's lint-ts gate runs the TypeScript (C17.91)

- `make lint` runs the ESLint of the Svelte workspace only; the CI pipeline of kit runs lint-ts once, as its ts runtime gate, so the build-lint job no longer repeats it.

### 2026-10-30 — Adopt @polyspec/kit 0.0.79: one CI pipeline, release by run id, PIE through kit (C17.90)

- The @polyspec/kit pin is 0.0.79. kit-sync brings ci-pipeline.yml and the 0.0.79 release.yml, and removes gates.yml. ci.yml calls the pipeline as its job `kit`, and the repository jobs follow it with `needs: kit`.
- `make release-tag` creates the tags on the commit of a successful ci.yml run, and the dispatch names that run and the version. config/release.json no longer lists checks.
- `make ordered-json-ext` builds the OrderedJSON php-ext with kit's pie-build (K915) and records its folder in var/ordered-json-package, which the local record servers read.

### 2026-10-30 — Name the Python CI job validator · Python like the other validator jobs (C17.89)

- The job of ci.yml that runs the Python validator and generator suites is named validator · Python, as the JavaScript, PHP, Go and Rust validator jobs are named.

### 2026-10-30 — Adopt @polyspec/kit 0.0.78 (C17.88)

- The @polyspec/kit pin of package.json and package-lock.json is the 0.0.78 release tgz, which carries K909, K916 and K918. make kit-sync writes the vendored PRINCIPLES copies as 0.0.78 writes them, and kit-inject-check passes against the installed 0.0.78.

### 2026-10-30 — Restore the vendored PRINCIPLES copies to kit's text (C17.87)

- PRINCIPLES.md and PRINCIPLES.ko.md are kit's copies again (make kit-sync), so kit-inject-check passes; the S10 line names kit's `make test-php`.

### 2026-10-30 — Rename the source PHP suites target so kit's test-php runs unchanged (C17.86)

- `make crudui-test-php-source` replaces the test-php recipe of the Makefile, which overrode kit's test-php; CI runs it in the validator-php job and CI_TARGETS names it.

### 2026-10-30 — Build the OrderedJSON php-ext before the form-comparison browser and record checks (C17.85)

- The form-comparison targets that start the local stack depend on ordered-json-ext, so a fresh checkout builds var/pie/<version> before it reads it.

### 2026-10-30 — Key the PIE work directory by the OrderedJSON version (C17.84)

- PIE_WORK is var/pie/<version>, so a later version never meets the repository that an older one added to the same working directory.

### 2026-10-30 — Read the release OrderedJSON php-ext that PIE builds into var/pie (C17.84)

- The release record servers read the OrderedJSON php-ext package that PIE fetches and builds from the packages.json repository with make ordered-json-ext, not the old var/ordered-json-php-ext path.

### 2026-10-30 — Drop the phpunit option that kit no longer has from the generator suite (C17.83)

- The php-api suite of the generator no longer passes --without-library to PHPUnit, which rejects it, so the conformance evidence of the generator PHP extension suite is recorded.

### 2026-10-30 — Assert the CI install branch before reading it, so typecheck passes (C17.82)

- dependency-health asserts the CI branch match is defined before reading its group, which makes make typecheck pass in CI.

### 2026-10-30 — Align the stale ci-local assertions with main (C17.77)

- The ci-local assertions that main already failed are removed (kit internals) or aligned to the current workflows (push-gate.yml is gone; the release checks are ci-passed).

### 2026-10-30 — Unify the OrderedJSON release to 0.0.14 (C17.81)

- crudui pins OrderedJSON 0.0.14 from its packages.json release in composer.json, locks it in composer.lock and the Rust form server, and names 0.0.14 in the release docs.

### 2026-10-30 — Read the CI OrderedJSON version with a regex that matches (C17.80)

- The CI provider step reads the version of OrderedJSON from the packages.json URL with a single-backslash regex, so every CI job clones the release tag and none is empty.

### 2026-10-30 — Remove the prepare-commit-msg hook that kit K892 orphans (C17.78)

- The commit hook of prepare-commit-msg is removed; kit no longer has its target, and every commit of the repository runs again.

### 2026-10-30 — Adopt kit 0.0.77 in the second batch (C17.74)

- crudui pins the released @polyspec/kit 0.0.77 asset, links the kit and OrderedJSON from the main checkout, and drops toolchain-check, the shared gates that CI repeats, release-assets-fetch, cargo-downloads-check and link-state-check.

### 2026-10-30 — Check the canonical Composer project through its release packages.json (C17.75)

- The dependency-health test checks that the canonical Composer project resolves polyspec/ordered-json from its release packages.json and declares no path repository outside the checkout.

### 2026-10-30 — Read the CI install branch of Composer from the Makefile text (C17.68)

- The dependency-health test reads the CI branch of crudui-install-composer from the Makefile instead of running it with the CI identity, so no test impersonates CI.

### 2026-10-30 — Remove the leftover reference-transaction references (C17.59)

- No file or reference of the reference-transaction hook (K801) remains in the checkout; the hooks that make hooks writes are pre-commit, commit-msg and prepare-commit-msg.

### 2026-10-30 — Remove the leftover python backend declarations (C17.60)

- No pythonBackend, dependency-policy.json or python backend declaration remains; the kit that removed them no longer checks them.

### 2026-10-30 — Remove the leftover release-consumer and release-proof adoption (C17.61)

- The release-consumer tests and the release-proof adoption are gone; the release fixtures and offline checks pass.

### 2026-10-30 — Remove the leftover commit-rule consumer state (C17.63)

- No pre-merge-commit hook, commit-identity declaration or commits-check target remains; make hooks writes only pre-commit.

### 2026-10-30 — Remove the leftover make release-versions step (C17.64)

- The release workflow no longer runs make release-versions.

### 2026-10-30 — Remove the unlink target from the offline downloads list (C17.62)

- The offline-checks test no longer counts unlink as a download target: the kit runs it offline, so it lifts nothing.

### 2026-10-30 — Resolve the ordered-json tag of the form-comparison Rust server offline (C17.71)

- The Rust form-comparison server pins ordered-json by tag v0.0.13 and the lock by its commit, and config/release-assets.json declares ordered-json 0.0.13, so cargo resolves the same source as the sibling checkout.

### 2026-10-30 — Resolve ordered-json from its release packages.json (C17.57)

- The root Composer project no longer links ordered-json from a path outside the repository; it resolves polyspec/ordered-json 0.0.13 from the release packages.json, and make link links the installed folder to the sibling checkout for development.

### 2026-10-30 — Escape the raw placeholders of the execution checklist (C17.73)

- The execution checklist shows its placeholders as code, so the site renders the timeout line of C7.8 instead of dropping its `<command>`.

### 2026-10-30 — Keep the input failure of a repeated literal choice (C17.69)

- The PHP extension keeps the input failure of a repeated literal choice as the previous exception of the form error.

### 2026-10-30 — Keep the parameter and syntax causes of an invalid pattern (C17.70)

- The PHP extension keeps the invalid parameter and its pattern syntax error as the previous exceptions of the load error.

### 2026-10-30 — Adopt kit 0.0.75 (C17.72)

- crudui pins the released @polyspec/kit 0.0.75 asset and its lock; kit-sync finds no change to the workflows of that version.

### 2026-10-30 — Adopt kit 0.0.74 (C17.67)

- crudui pins the released /kit 0.0.74 asset and its lock; kit-sync writes the CI and release workflows and the kit-owned documents of that version.

### 2026-10-30 — Remove references to the four deleted kit targets (C17.58)

- crudui no longer names dependency-policy-check, dependency-policy-mutation-check, dependency-review or composer-provider-entries, which kit deleted; the files that existed only for them are removed.

### 2026-10-30 — Remove enforcement references to deleted targets (C17.66)

- PRINCIPLES.md and AGENTS.md name no deleted target or hook as enforcement: commits-check, pre-push, pre-merge-commit, dependency-policy-check and push-gate; a rule that no check reads says `none`.

### 2026-10-30 — Remove the owner-check globs of deleted files (C17.65)

- config/owner-checks.json no longer names config/commit-identity.json or tests/release-install/**, which C17.63 and C17.61 deleted; owner-validate owns every tracked path.

### 2026-10-29 — Finalize the 0.0.9 candidate with scoped Kit gates (C18.13-6)

- Kit 0.0.63 builds the current candidate archives, and clean external consumers install and check all 11 packages. Native Composer consumer records use explicit local zip package metadata. Final release metadata preserves the mandatory complete candidate CI and public release proof.

### 2026-10-29 — Ignore native Go executable outputs (C18.13-7)

- Native Go module executables are ignored at their exact generated paths on Unix and Windows. Source files remain visible, and candidate archives retain the clean committed-source requirement.

### 2026-10-29 — Scope provider source links to each runtime (C18.13-5)

- Kit 0.0.63 forwards each runtime into native source linking. Runtime jobs prepare and link their own ecosystems, while full parity retains complete linking. Native regression checks use real Git manifests and preserve full-link dependency requirements.

### 2026-10-29 — Verify selected toolchain environments (C18.13-4)

- Selected Node/npm and Go environments pass the published Kit verifier without PHP arginfo. Extension build preparation retains its pinned generator and parser requirements. Final isolated candidate CI remains required before publication.

### 2026-10-29 — Scope every application workflow installation (C18.13-3)

- Documentation, push verification and dependency review workflows declare only their required tools. Push verification uses Node and npm without PHP. A native regression rejects whole-environment installation calls in all application-owned workflows.

### 2026-10-28 — Preserve native PHP exception causes (C18.13-2)

- PHP form and composition errors preserve caught causes through optional previous-exception constructor arguments. The C extension exposes matching signatures, retains causes for the exception lifetime and rejects invalid cause types. Error codes, messages, form paths and composition traces keep their existing values.

### 2026-10-28 — Prepare the 0.0.9 release candidate (C18.13-1)

- Release manifests and internal dependencies declare 0.0.9. Native package managers lock the candidate inputs, and release consumer fixtures install the archives built from the current source.

### 2026-10-28 — Prepare independent language CI with selected locked tools (C18.12)

- CI installs only the Kit 0.0.61 tool selectors required by each job. Go and Rust jobs own both validator and generator suites; JavaScript generator units run separately. Cross-language comparisons prepare their own complete environments. PHP extension fixtures and native parser lint receive explicit prerequisites, and CI Composer installation follows the lock without updating it.

### 2026-10-28 — Record the build-only dependency advisory decision (C18.12-3)

- The dependency review preserves its existing npm severity threshold. The unpatched low-severity deepmerge advisory remains visible in raw audit results and is limited to trusted Svelte build configuration; no advisory exception or dependency override is added.

### 2026-10-28 — Prepare scheduled dependency review correctly (C18.12-2)

- Dependency review installs the declared PHP before its tool installation and performs that installation once. Its application target clears the CI target selection before invoking the shared review command; explicit local dependency version targets remain supported.

### 2026-10-28 — Define scoped CI environment preparation (C18.12-1)

- The CI preparation plan specifies each job's tools, native locked inputs, independent build responsibilities and selective installation acceptance checks. Release 0.0.8 remains published; scoped installation adoption is tracked separately.

### 2026-10-28 — Run cross-language comparisons independently (C18.11)

- CI runs generator equivalence in an independent job for JavaScript, HTML, Go, Rust, Python, PHP and the native PHP extension. Language unit jobs retain their tests. The comparison job prepares its own inputs, uploads both reports and evidence, and is required by conformance and final CI checks.

### 2026-10-27 — Publish CRUDUI 0.0.8 (C18.10)

- Release v0.0.8 publishes 11 package archives from commit `47612fe4297203d46232646eba8365a6fbda43ef` after successful CI and push checks. The release workflow installs and checks all 11 archives outside the checkout before publication. Both Go module tags identify the same commit.

## 0.0.8

### 2026-10-27 — Restore native untimed suite defaults (C18.10-30)

- Native Node suites use the default unlimited aggregate duration. Validation fixture preparation and pipeline suites retain every individual case deadline and assertion.

### 2026-10-27 — Isolate service children from test flags (C18.10-29)

- IPC services use their declared runtime arguments and application environment. Parent test instrumentation flags and test context do not propagate to service processes.

### 2026-10-27 — Canonicalize parallel pipeline reset evidence (C18.10-28)

- Pipeline reports order reset records by the declared server identities and require every identity exactly once. Completion order does not change valid evidence, and missing, duplicate or unknown reset records remain visible and fail validation.

### 2026-10-27 — Keep pipeline suites untimed (C18.10-27)

- Pipeline suite aggregates have no time limit. Store reset and flow cases retain their existing individual deadlines and concurrency, so suite duration does not stop a healthy stack before the remaining cases execute.

### 2026-10-27 — Select the qualified Rust Unicode parity test (C18.10-25)

- Rust Unicode parity selects the fully qualified native test identifier with its exact filter, so the declared data check executes instead of matching zero cases.

### 2026-10-27 — Canonicalize parallel pipeline report records (C18.10-26)

- Pipeline reports order every combination record by its declaration after parallel execution. Missing, duplicate and unknown identities still fail completeness validation, and invalid records remain in the report.

### 2026-10-27 — Build the PHP extension before parity execution (C18.10-24)

- Native PHP extension parity waits for the extension build before loading any extension binding.

### 2026-10-27 — Compile native fixtures before timed assertions (C18.10-22)

- Native validation and binding programs compile in setup operations. Locale execution reuses the current run validation program, and sanitizer flags, runtime assertions and case time limits remain unchanged.

### 2026-10-27 — Separate Rust model tests from contract documentation (C18.10-23)

- Rust field model tests use a native child test module with the same test identities and assertions. Parity declarations classify that test module independently of production contract documentation.

### 2026-10-27 — Prepare native archives for every release-mode stack check (C18.10-21)

- Summary and direct form comparison checks fetch the pinned OrderedJSON native archives before starting their release-mode stacks. Local source mode keeps its declared provider resolution.

### 2026-10-27 — Declare native source and fixture layout exceptions (C18.10-20)

- Layout validation permits the declared external OrderedJSON source, the exact PHP fixture helpers and the shared Go evidence writer. Other root Composer path repositories retain repository-local resolution checks.

### 2026-10-27 — Prepare native caches before release builds (C18.10-19)

- Release and candidate archive targets download the declared Cargo and Go dependencies before building package output. Go downloads resolve through the declared repository workspace, and archive preparation preserves download-before-build ordering under parallel Make.

### 2026-10-27 — Adopt Kit 0.0.60 (C18.10-18)

- The development tool dependency and native npm lock pin the Kit 0.0.60 release archive. Shared principles match the published package, and local development resolves polyspec dependencies through native source links.

### 2026-10-27 — Prepare current candidate archives and consumer locks (C18.10-17)

- Candidate archives build current package output before packing. Native npm and Composer regenerate consumer locks from those archives, and clean external consumers install and smoke-check all eleven release packages.

### 2026-10-27 — Declare actual outline and rendering evidence scopes (C18.10-16)

- Fixture declarations identify the existing browser group source checks, rendered button operations and JavaScript outlines. Feature-specific runtime applicability records Python outline compilation and binding without claiming those operations in other runtimes.

### 2026-10-27 — Declare the fixture recorder result type (C18.10-15)

- The Rust fixture recorder declares the discarded result type required by the lint policy.

### 2026-10-27 — Update PHPUnit to the patched release (C18.10-14)

- Composer locks select PHPUnit 13.4.4 and the dependency review records the current native lock graph.

### 2026-10-27 — Regenerate current feature contracts (C18.10-13)

- Feature contract documents describe the current manifest commands and fixture declarations.

### 2026-10-27 — Keep the structure fixture inventory exact (C18.10-12)

- The structure fixture inventory includes every current valid schema case and retains all invalid cases.

### 2026-10-27 — Align fixture contexts with engine inputs (C18.10-11)

- Native engine fixtures initialize the complete validation context and link the condition tree implementation.

### 2026-10-27 — Normalize invalid UTF-8 request errors (C18.10-10)

- Native JavaScript and HTML requests with invalid UTF-8 return the public invalid input error.

### 2026-10-27 — Include field data limits in the Rust model (C18.10-9)

- The public Rust field model preserves schema data limits and rejects invalid limit representations.

### 2026-10-27 — Prepare current CI commands and assets (C18.10-8)

- CI jobs install the declared providers and hooks, use the canonical Go workspace and prepare release-mode server assets.

### 2026-10-27 — Record fixture applicability and actual runtime evidence (C18.10-7)

- Fixture declarations identify supported runtimes, operation-specific cases and shared support modules. Existing fixture units record actual results through the shared recorders, including native PHP execution. Suite records distinguish PHP source and extension runs. The default cross-product checks remain and reject missing or invalid applicability and evidence.

### 2026-10-27 — Compile native fixture programs before timed assertions (C18.10-6)

- Shared validation and unique-rule programs compile as setup operations. Tests execute only programs produced by that run and retain their existing assertions and time limits.

### 2026-10-27 — Resolve composed fixture inputs and centralize slot classes (C18.10-5)

- Parity rendering and binding receive the same resolved fixture specification. Unsupported field types remain explicitly unrenderable, and slot classes are read only by the slot module.

### 2026-10-27 — Validate packed versions against the root manifest (C18.10-4)

- Package installation checks require the exact root manifest version for each published package.

### 2026-10-27 — Native report fixtures load their declared decoder dependency (C18.10-3)

- The native report child loads FixtureJson and its selected OrderedJSON dependency without loading the CRUDUI library autoloader.

### 2026-10-27 — Prepare CI toolchains and native dependency scopes (C18.10-2)

- Every full tool installation prepares PHP first. Workspace version replacements resolve unpublished internal Go modules locally, and native Go package discovery selects every package that contains tests. JavaScript validation prepares compiled public entries before import checks. GNU Make environment verification accepts the exact target-specific declaration format of Make 3 and Make 4.

### 2026-10-27 — Prepare CRUDUI 0.0.8 publication (C18.10)

- The release candidate records version 0.0.8 with Kit 0.0.59, OrderedJSON 0.0.10 and the PHP 8.4.27 development baseline. Runtime CI tests use four independent shards. Publication requires successful checks for the candidate commit.

### 2026-10-27 — Build Go release sources through the declared workspace (C18.10-1)

- Go package builds use the repository workspace for unpublished internal module versions. Release consumers keep their isolated module resolution.

### 2026-10-27 — Update the released polyspec dependencies and CI test execution (C18.9)

- The root manifest and native locks pin Kit 0.0.59 and OrderedJSON 0.0.10. OrderedJSON PHP archives use the declared release digests, and CI prepares their tagged source for native development dependencies. Rust JSON conversion validates UTF-8 byte strings for object keys and values. Runtime CI tests run in four independent shards with separate reports. Test commands resolve the installed Kit public CLI export for source and packaged installations. PHP source tests include both public and internal suites without test prerequisites.

### 2026-10-27 — Set the PHP development baseline to 8.4.27 (C18.8)

- Composer platform declarations and native locks use PHP 8.4.27 for development and release consumer resolution. Windows installations use the 8.4.27-1 package rebuild. The library requirement remains PHP 8.4 and later; the shared installer selects the 8.4 minor.

### 2026-10-27 — Adopt kit 0.0.56 (C18.7)

- The root development dependency and npm lock pin the published kit 0.0.56 archive with its SHA-512 integrity. Native npm links retain the current kit and OrderedJSON source checkouts. Shared principles are synchronized with the installed kit source.
- Make reads the installed package bootstrap. Each own CI Make job installs the locked package with the declared npm first. Svelte 5.57.3, PostCSS 8.5.32 and typescript-eslint 8.72.1 resolve through the existing compatible requirements. The release consumer declares the fsevents 2.3.3 script approval, and the Rust API fixture includes its operation logger.
- The linked kit source accepts native Composer development path locks after K696. The dependency-health and Rust entry-point owner tests pass all 27 cases; link-state and kit-copy validation pass. The committed npm lock retains published kit 0.0.56; its archive predates K696.

### 2026-10-26 — Keep native Composer preparation internal (C18.1-8)

- Record-server setup calls its native Composer preparation helper internally. The helper has no external callers and is no longer exported. All TypeScript lint steps pass without an unused-export exception.

### 2026-10-26 — Keep operation logs separate from test results (C18.1-7)

- Workspace builds, API generation, browser installation and repeated builds report operation steps, failures, elapsed times and heartbeats without reading or writing test-result metadata. Regression fixtures verify that enclosing test results survive successful and failed child commands. Native command fixtures represent an undefined working directory explicitly.

### 2026-10-26 — Compare contract versions with workspace metadata (C18.1-6)

- The feature manifest checker reads the root package version instead of requiring an earlier literal version. It accepts the current candidate and rejects a mismatched contract version with the expected and actual values. Candidate checklist translations retain the same task order.

### 2026-10-26 — Complete local candidate preparation (C18.1)

- Candidate preparation uses current local provider sources, native dependency records and the reviewed compatible toolchain. Every candidate preparation task is complete. Current npm, Composer and Python archives pass isolated installation checks, and native PHP uses its own Composer profile. Shared configuration copies match the installed kit source. CI and publication remain separate operations.

### 2026-10-26 — Dependency checks discover native Go workspaces (C18.1-5-1)

- Dependency review and policy checks use native Go workspace discovery. A module-specific workspace retains local provider modules alongside repository modules, and other modules discover the tracked root workspace. Release consumers retain GOWORK=off. Native Go reports the generator, validator and OrderedJSON modules as local main modules.

### 2026-10-26 — Dependency checks use the declared Go workspace (C18.1-5)

- Dependency review and dependency policy checks resolve repository Go modules through the tracked root go.work. Candidate module versions remain local workspace members rather than registry dependencies. Release consumer verification continues with GOWORK disabled. Native make environment tests verify both scopes.

### 2026-10-26 — Python build tools use reviewed patch releases (C18.1-4)

- The generator, validator and conformance helper declare setuptools 84.2.1 as their build backend. The toolchain records the backend wheel SHA-256 and Ruff 0.17.2 with native mise platform locks. The exact backend wheel passes hash verification, the helper builds offline, and the recorded Ruff and runtime checks pass.

### 2026-10-26 — The default Composer project installs current sources (C18.1-1)

- The private root Composer manifest and native lock resolve CRUDUI 0.0.8 and the current OrderedJSON 0.0.10 sibling source through path symlinks with configuration references. The default PHP install refreshes these source packages without a release download. The duplicate local manifest and lock are removed, and the existing Composer check validates the canonical project. Native installed records, PHP 8.4.26 platform requirements, selected dependency checks and the FormJson test pass with PHPUnit 13.4.3.

### 2026-10-26 — Every candidate npm archive has a consumer smoke check (C18.1-2)

- The release consumer installs all seven npm archives with locked framework and build dependencies. The Svelte consumer builds the installed package with Vite and the Svelte plugin, then checks its component and rendering exports. The npm and Composer consumer locks name the current 0.0.8 archives; clean consumer installs and smoke checks pass for all eleven npm, Composer and Python packages.

### 2026-10-26 — Local native servers use the declared current provider (C18.1-3)

- Local PHP and Rust preparation selects the OrderedJSON checkout declared in `config/local-providers.json`; PHP extension source, module name and version come from provider Composer metadata. Native PHP uses a separate locked Composer application and PHPUnit profile that excludes source SDK libraries. Pure PHP retains its source profile. Runtime mode checks require the selected native extension identity.

### 2026-10-26 — Complete the current documentation-tool candidate review (C18.2)

- The pre-CI documentation review retains the directly managed latest patched Markdown parser, 15.0.3. Fresh stable and next VitePress archives still embed the affected reference parser. The rebuild record states the current registry channels, archive digests, parser selection and completed candidate decision.

### 2026-10-26 — React 19.3.1 runs client widget scripts after rendering (C18.3)

- React and React DOM use 19.3.1. Client widget scripts run from an effect beside an inert template and remain in the DOM until unmount; later renders preserve their nodes without executing them again. Server output and hydration retain script elements. The React dependency exceptions are removed. React owner tests and client/server script checks in Chromium, Firefox and WebKit pass.

### 2026-10-26 — Candidate npm dependencies use current compatible versions (C18.4)

- The npm locks select current compatible patch and minor releases for browser tooling, YAML, DOM, Vite, Vitest and lint tools. The Svelte tools retain TypeScript 6.0.3 because their current peer ranges exclude TypeScript 7. Local PHP verification uses the current OrderedJSON source through its native development profile. Selected owning tests, Svelte type checking and lint pass.

### 2026-10-26 — Prepare version 0.0.8 for candidate verification (C18.5)

- Release manifests and internal dependencies name 0.0.8. npm, Cargo, uv and the local Composer profile refresh their workspace locks. The feature manifest and consumer declarations use the candidate version, and the existing change records form the 0.0.8 section. No tag is created.

### 2026-10-26 — PHP implementation units have a separate source suite (C18.6)

- PHP source runs select public and source-internal suites, while extension runs select every public case with no PHP library sources. Mixed classes retain public assertions and separate helper assertions. Native PHPUnit listings preserve all original cases and prove scope coverage. Fixture decoding uses the public OrderedJSON API, and shared native expression and composition bindings remain unchanged.


### 2026-10-26 — Shared kit configuration uses tracked regular files (C17.56-2)

- The shared principles, editor configuration and command settings are regular files synchronized by kit-sync. The managed workflows match the current installed kit source. Source package installation folders remain native links. The kit configuration check, document pairs and selected workflow trigger checks pass.

### 2026-10-26 — Native source installation inputs remain explicit (C17.56-1)

- The application declares the lint commands needed after native npm source linking, retaining their existing locked versions. Composer local path references use native configuration hashes so unrelated repository commits do not change its source lock. The reviewed release dependency locks contain no advisories.

### 2026-10-26 — Native development installs use current sibling sources (C17.56)

- Composer local development selects composer.local.json and its native lock, resolves compatible 0.0.x source packages and records their actual versions. The default archive manifest and lock remain unchanged. Installed-version checks reject stale source metadata. The Composer command variable preserves the native manifest selector, and Knip checks resolve the installed kit dependency through Node package metadata.

### 2026-10-26 — Conditional withdrawals retain a candidate checkpoint (C17.52-1)

- Conditional tool and dependency decisions have a candidate-stage checklist with a cause and retry condition. Development completion does not complete the publication review. Repository procedures distinguish accepted terminal decisions from deferred candidate checks, and the PHP extension policy coverage record names its completed verification.

### 2026-10-26 — Terminal checklist decisions and release inputs are reviewed (C17.52)

- The checklist states the current grounds for retained dependency declarations and tool choices. The dependency review records no advisories across 17 locks, and the withdrawn sprintf-js exception is removed. The native PHP extension manifest participates in version updates. Release coverage, manifest versions and selected owning checks pass; release publication still requires the commit checks.

### 2026-10-26 — Unicode contract uses packaged property ranges (C16.13-1)

- The Unicode contract reads the property ranges of @unicode/unicode-16.0.0 at its locked release. The stored UCD files and parser are removed. Unicode 16.0.0, all 35 general categories, all 170 scripts and every code point range remain unchanged.

### 2026-10-26 — Document the evaluated documentation-site parser releases (C16.8-1)

- Documentation build tools reference their rebuild record. The checked Markdown renderer remains in use because both evaluated VitePress distributions embed the reference parser without the security fix. Routes, link checks and development-server behavior remain covered by their owning units.

### 2026-10-26 — HTTP forwarding filters connection headers in both directions (C16.29-1)

- The form comparison removes request headers named by Connection before forwarding and preserves target routing, early responses, structured upstream failures and upload cancellation. The forwarding unit tests cover these behaviors. The rebuild record compares the Node.js adapter with http-proxy and records the current implementation.

### 2026-10-26 — The Go toolchain matches the linked module minimum (C17.54)

- The recorded Go toolchain and workspace require Go 1.27.3. mise.lock pins its archives on all four platforms. The linked comparison module graph resolves with the recorded toolchain, and the runtime-version policy checks pass.

### 2026-10-26 — Dependencies use patched npm and Tokio versions (C17.53)

- The npm lock selects fast-uri 3.1.9, undici 8.12.3, zod 4.6.7 and markdown-it 15.0.3, including markdown-it 14.3.3 for the nested dependency. The Rust form comparison lock selects Tokio 1.53.3. The npm audit reports no vulnerabilities, and the Rust audit of the comparison lock reports no vulnerabilities or warnings. Selected dependency graph, JSON shape, documentation rendering and Rust server tests pass.

### 2026-10-26 — Rust fixture readers match errors explicitly (C17.38-1)

- Rust fixture readers use explicit Result matching for file reads and JSON parsing. Failures retain the fixture path and underlying error, and the selected Clippy checks use the repository configuration. The diagnostic example names the same error handling form.

### 2026-10-26 — Model round-trip checks describe implementation coverage (C17.10-2)

- PHP and Go FieldSpec round-trip checks describe their implementation-specific serialization. Shared validation fixtures retain coverage of the data limit declaration and validation requirements. Test names, assertions and selection remain unchanged.

### 2026-10-26 — The internal URL export is declared in the contract manifest (C17.40-1)

- The generator core internal entry declares sanitizeUrl in the contract manifest. The generated feature documents include the same export, and the manifest export and generated-document checks pass.

### 2026-10-26 — The completed checklist fixes are integrated (C17.47)

- The integrated changes preserve the selected owner checks for rendering, validation budgets, native dispatch, API errors, source documentation and test preparation. English and Korean task records and change entries match. PHP source changes select the source documentation unit. The full-run result and its conformance evidence limitation are recorded in docs/features.md.

### 2026-10-26 — Runtime checks use declared tool paths and the dry-run helper (C17.36-1)

- The make dry-run helper reads target-specific variables with the make database option. Runtime checks resolve the test runner path and extension from make and the bootstrap path from the Makefile include. The offline target checks classify the local PHP arginfo generator as offline.

### 2026-10-26 — Root fixture checks use installed package APIs (C17.37)

- Text-validity fixtures call the installed validator and generator APIs, and decode accepted templates with decodeFormTemplate. The validator text helper test uses the same installed API for its loader check. The button fixture declares its four evaluated buttons as a tuple, and the validation fixture declares its generated records explicitly. The root TypeScript check passes without compiling package implementation sources under the root configuration.

### 2026-10-26 — PHP generation failures retain their API error type (C17.49)

- The API parity report checks invalid mixed button inputs as FormError with INVALID_FORM_INPUT and the declared list message. Choice-source failures from the validator are converted to FormError with the same code and message before leaving the generator API. The report compares both extension loading modes with the PHP library.

### 2026-10-26 — Native graph checks declare submission budgets (C17.10-1)

- The native graph boundary fixtures declare depth 512 or 1000000 values, and the 200000-row Go uniqueness test declares its submission value budget. Their graph sizes, expected outcomes and the default submission limits remain unchanged. PHP measures checked trees depth-first without retaining all sibling nodes. The PHP and Go field models retain dataLimits, including omitted members and empty declarations.

### 2026-10-26 — Rust fixture failures name their paths and causes (C17.38)

- The Rust generator fixture readers retain the fixture path and the original error for file reads and JSON parsing. The buttons, complete forms, form state, form rendering, list rendering, detail rendering and validity test targets pass all 604 cases.

### 2026-10-26 — Cross-check inputs use the native build and fixture requirements (C17.39)

- The native PHP process test reads var/php-ext/polyspec_crudui.so by default and preserves the PHP_EXTENSION override. Validation fixture export preserves explicit requirement IDs in order and writes an empty requirement list for an unannotated draft. The exporter retains validation results, hidden paths and failure records.

### 2026-10-26 — Display renderers replace JavaScript link URLs (C17.40)

- Vue and Svelte list and detail renderers replace JavaScript link URLs with the throwing URL required by CUDF-023. The internal URL serializer also handles form actions and HTML attributes. Display models retain their declared href values.

### 2026-10-26 — The CLI manifest test checks the complete package table (C17.41)

- The CLI manifest test compares every package entry, visibility and value export with the current contract as one exact table. A fixture verifies public and internal entries, export order and an empty export list.

### 2026-10-26 — Go button contract checks select their owning package (C17.42)

- The bindButtons and formButtonsHtml verification commands select the Go generator package containing TestButtonsSuite. All 22 shared button cases run, and the commands do not select the example server package, which has no matching button test.

### 2026-10-26 — Condition fallback textareas stay inside the viewport (C17.43)

- The stylesheet applies joined borders and the negative joining margin only to widgets arranged as flex controls with affixes. Structured condition widgets keep independent borders and zero joining margin, so fallback textareas remain inside narrow and wide viewports in Chromium, Firefox and WebKit.

### 2026-10-26 — PHP server fixtures use the declared PHP installation (C17.44)

- The PHP server unit fixtures place php-config and PHP-FPM at the paths resolved from the launcher module. Each test waits for launcher shutdown before removing its sandbox, including readiness failures and failed cleanup.

### 2026-10-26 — Python native checks dispatch structure map requests (C17.45)

- The Python native generator program forwards buildOutline requests and their evaluated nodes to Generator.buildOutline. The five shared outline cases now execute through the native program without an unknown-operation failure.

### 2026-10-26 — Condition editor identifiers preserve apostrophes (C17.35-1)

- The PHP extension writes the condition wrapper identifier with the same raw attribute escaping as the shared renderer. The existing tree fixture uses an idPrefix containing an apostrophe and the exact HTML comparison passes.

### 2026-10-26 — HTML condition widgets use the shared raw serializer (C17.35-2)

- The HTML renderer uses the core condition widget serializer for the textarea, editor tree, error and affixes. Its structured condition widgets have the same attribute order, void element spelling and escaping as the React renderer.

### 2026-10-26 — Native PHP record storage uses standard score conversion (C17.46)

- The PHP record store converts validated decimal score text with PHP numeric conversion and preserves finite-number checks. It does not load the validator NumberValue implementation class in the native extension process. The native process assertion remains enabled; the score tests use the customer specification to retain decimal acceptance and radix refusal.

### 2026-10-26 — Native condition editors write raw HTML consistently (C17.35-3)

- PHP, Go, Rust and Python serialize structured condition editors with raw text and attributes. Their textareas preserve JSON quotes, their editor inputs use HTML void tags, and their condition nodes, errors and affixes use the same escaping as the shared renderer.

### 2026-10-26 — PHP engine fixtures compile repeated scalar arrays compactly (C17.48)

- The C fixture emitter builds a repeated scalar array with a loop and separately owned clones while preserving its length and every value. The validation programs link references.c. The 50,000-row uniqueness fixtures declare sufficient submitted-data budgets. The selected shared validation, uniqueness, scalar-array and undefined-behavior checks pass without changing compiler flags or time limits.

### 2026-10-26 — The PHP extension exposes every condition editor message (C17.50)

- The PHP extension Form::getMessages result includes conditionMode, conditionAddComparison, conditionAddGroup, conditionAddJudge, conditionRemove and conditionInvalid from its generated interface table. The public result matches the complete interface-message contract in Korean, English, Japanese and Chinese.

### 2026-10-26 — PHP source documentation checks run with documentation tooling (C17.51)

- The documentation tooling units check the source provenance and class and public-method documentation of both PHP packages in source PHP processes. The checker rejects native classes in place of source declarations, classes from another file and missing documentation. The PHP library runtime test trees contain no source documentation tests, and their former parity-internal declarations are removed.

### 2026-10-26 — Production imports require runtime dependencies (C17.15-1)

- The production dependency check runs Knip on each workspace source entry with strict production dependency resolution. Its fixture rejects an import declared only in devDependencies and accepts dependencies and peerDependencies. The CLI declares ajv, ajv-formats and js-yaml as runtime dependencies. The check runs with lint-ts and resolves the open dependency finding of C17.15.

### 2026-10-26 — PHP verification records retain measured versions (C16.168)

- The verification records state PHP 8.4 and later as the supported range and distinguish the selected CI toolchain from that range. The dated PHP 8.5.10 measurements remain historical evidence and do not claim verification of the current tree.

### 2026-10-26 — The PHP extension renders structured condition HTML consistently (C17.35)

- The C renderer writes the structured condition editor as raw HTML: textarea text retains quotes, editor inputs use HTML void tags, and editor text and affixes use the same escaping as the shared renderer. The comparison tests pass all 11 cases, including the three previously failing rendering checks.

### 2026-10-26 — Build checks read current kit ownership and package imports (C17.36)

- Build checks read the source tools and configuration of kit, include the PHP extension contract tests, and exclude the paths that kit owns from repository-specific rules. Native test file patterns expand to existing files; import checks use the module lexer and resolve each imported package subpath. npm checks the locked graph and the installed local package links separately.

### 2026-10-26 — The php-ext test source lists link rule_condition_tree.c and canonical.c (C17.33)

- The php-ext comparison and contract tests compile the sources that the widget and the number text need (rule_condition_tree.c, canonical.c), so they link again. The comparison divergence that the link now shows is C17.34.

### 2026-10-26 — crudui names the sources of kit, not its dist (C17.34)

- C17.34 is done (C17.34): the npm scripts, the verification commands of contracts/features.json and config/dependency-policy.json, composer.json, the READMEs and the build tests name node_modules/@polyspec/kit/scripts/kit/<tool>.mts and $(KIT)/<tool>.$(KIT_EXT), which kit runs since K613, instead of its dist, which kit K646 stops building; scripts/test-commands.mts recognises the source runner. Red: tests/build/ci-local.test.mts found no tool of kit in the Makefile; green after the change.

### 2026-10-26 — A group source combines literal choices with the rows of its group (C17.31)

- C17.31 is done (C17.31): a group source declares choices, literal value and label pairs that are listed before the rows of its group and checked with them as one set by the implicit in check, such as the audience player beside the character ids (docs/spec/schema.md CUSC-089, docs/spec/validation-rules.md CUVR-085); a row whose value repeats a literal choice fails with INVALID_FORM_INPUT and names its row path and value, in validation and in binding, and a choices outside its rules fails compilation and the load (CUVR-086); in TypeScript, PHP, the PHP extension, Go, Rust and Python. Red: make parity-check UNITS="validate form-render" failed the 9 validate and 3 form-render cases in every implementation; green after the change.

### 2026-10-26 — A repeated group source value fails validation (C17.32)

- C17.32 is done (C17.32): a row of a group source whose value repeats that of an earlier row no longer drops silently in validation; the implicit in check fails with INVALID_FORM_INPUT and Group source value repeats an earlier row: {value} at {path} (CUSC-090, CUVR-087) in TypeScript, PHP, Go, Rust, Python and the C engine of the PHP extension, and rendering lists the value once. Red: make parity-check UNITS="validate form-render" failed group-source-repeated-value and group-source-repeated-number in every validator; green after the change.

### 2026-10-26 — A group source refuses a field that holds a boolean (C17.19)

- C17.19 is done (C17.19): compilation and validation refuse a group source whose from or label names a checkbox or switcher field, whose data is true or false and would give no choice or label, with Invalid items.{member} at {path}: {field} holds a boolean, expected a field whose values are strings or numbers (CUSC-068), in TypeScript, PHP, Go, Rust, Python and the C engine of the PHP extension. Red: the new validate and form-render cases failed in every implementation; green after the change.

### 2026-10-26 — config/rebuild.json lists only tracked tools and classes each one (C17.30)

- The rebuild entries of kit K614 for files that no longer exist are removed, and the group-source form-render tool is classed as policy like its siblings; rebuild-check passes.

### 2026-10-26 — A structured condition editor (C17.25)

- C17.25 is done (C17.25): a condition field declares design.editor text or structured and, under a structured editor, options.fields, the distinct field names that a comparison offers (docs/spec/schema.md, CUSC-083 to CUSC-086). Under a structured editor every generator renders the textarea hidden and, after it, a view of the condition tree: groups as fieldsets with their mode select, comparisons with their field, op and value controls, judged texts under conditionTree judge, and buttons that add a comparison, a group or a judged text and remove a condition (docs/spec/form-markup.md, CUMK-067). A value that the editor cannot show keeps the textarea visible after a named error that names conditionTree and the field path (CUMK-068). connectForm rewrites the tree through these controls and buttons (docs/spec/form-runtime.md, Condition values). TypeScript, the HTML, React, Vue and Svelte renderers, PHP, the PHP extension, Go, Rust and Python implement it. Red: make parity-check UNITS="form-render spec-validity" exit 2 at 976c214b; green: every implementation passes 241 of 241 form-render cases and 37 of 37 spec-validity cases.

### 2026-10-26 — The Makefile runs kit tools through $(KIT_EXT) (C17.29)

- The ten recipe lines that ran $(KIT)/<tool>.mjs now run $(KIT)/<tool>.$(KIT_EXT), so the checks follow kit sources as .mts (K613).

### 2026-10-25 — Choices from a repeated group follow the source rows in the browser (C17.15)

- C17.15 is done (C17.15): docs/spec/schema.md states CUSC-071: a form instance lists the choices of a group source from its current data after every change, and listing them changes no value. The new form-state family tests/fixtures/form-choices, whose step `choices` observes the options of a field node, tests it in the TypeScript, Go, Python, Rust, PHP and PHP extension implementations (unit form-choices). The React, Vue, Svelte and HTML renderer forms run the shared module tests/fixtures/form-session/group-source.mts. The browser validation binding of packages/form-binding renders the body of each field with a group source again from the data of its controls with the HTML renderer and patchContent when it binds and after every input or change, keeps each selected value that is still a choice, and takes the options language and idPrefix. The Svelte widget patch selects the options that its markup marks when the patch removed a selected option, so a select whose choice is gone selects none instead of the first option. Red: the form-binding choices test failed 4 of 5 and the Svelte session test showed the first option selected after the selected source row was removed; green after the change.

### 2026-10-25 — C17.4 adds the reference rule (C17.4)

- C17.4 is done (C17.4): the rule reference takes the declaration path of a field, such as facts.id; its ids are the non-empty scalar values of that field in every row on the path, hidden fields included, and a value passes under the membership rules of in; a parameter that is not a string, or that names no declared field, a group or a field with lang, fails the load with INVALID_RULE_PARAMETER (docs/spec/validation-rules.md, CUVR-071 to CUVR-074). TypeScript, PHP, the PHP extension, Go, Rust and Python implement it, and the meta-schema, the CLI explain labels and the TypeScript API report name it. Red: on e198dba8 make docs-check failed in scripts/check-schema.mts, whose meta-schema rejected the reference of the case reference-row-ids, and make parity-check UNITS="validate" passed 341 of 356 cases in every implementation, failing the 15 reference cases; green: docs-check passes and every implementation passes 356 of 356.

### 2026-10-25 — crudui follows kit K614 and K621 (C17.28)

- The kit-sync copies are deleted: the Makefile includes kit-bootstrap from the kit checkout, config/php-lint is gone, PRINCIPLES.md, PRINCIPLES.ko.md, .editorconfig and .claude/settings.json are tracked symlinks into kit, and the owner-check globs of the deleted paths are removed. The hook files of make hooks are committed.

### 2026-10-25 — C17.27 writes a float control value as its canonical text in the PHP extension (C17.27)

- C17.27 is done (C17.27): the PHP extension writes a float control value as its canonical text, the shortest text that reads back as the same double, through ps_number_text instead of %.15g, so 0.30000000000000004 is no longer written 0.3 (docs/spec/form-markup.md CUMK-069). The case text-float-value of tests/fixtures/form-render passes in every generator.

### 2026-10-25 — C17.26 writes the relations JSON text in Python (C17.26)

- C17.26 is done (C17.26): the Python generator writes data-source-relations as the JSON text of the relations value and writes [] only for a missing or null value, so {} and "" are no longer written as [] (docs/spec/schema.md CUSC-088). The cases select-dynamic-relations-object and select-dynamic-relations-text of tests/fixtures/form-render pass in every generator.

### 2026-10-25 — C17.22 refuses at load a multiple that is not a boolean, only or an object (C17.22)

- C17.22 is done (C17.22): every validator (TypeScript, PHP, the PHP extension, Go, Rust and Python) refuses at load a field whose multiple is present and is not a boolean, only or an object, null and a list included, with INVALID_RULE_PARAMETER, the message Invalid multiple at {path}: expected a boolean, only or an object and the field's declaration path, before its group source and its rules (docs/spec/schema.md CUSC-081). Red: make parity-check UNITS="validate" failed the five refusal cases in every validator; green after the change.

### 2026-10-25 — Keyed maps whose keys are the row keys of another repeated group (C17.3)

- C17.3 is done (C17.3): a field declares a keyed map with `multiple.keys` beside `only: true`, a field reference written as the `enddate` parameter that names a repeated group of the form; the ids of the group are its row keys (docs/spec/schema.md, Keyed maps, CUSC-076 to CUSC-078). Every validator (TypeScript, PHP, the PHP extension, Go, Rust and Python) fails the load with `Invalid multiple.keys at {path}: expected a reference to a repeated group` when the reference names no repeated group (CUVR-070), and fails the input with `Row key is not an id of {reference}: {path}` when a key of the data is not a row key of the group read in the row context of the field, checking keys in code point order (CUVR-069); before, `multiple: only` took any keys. The typed FieldSpec of the Rust validator reads `multiple` as `false`, `true`, `only` or a settings object, and refuses `keys` without `only: true`; the TypeScript `MultipleSettings` is the union of the row settings and the data settings. Every generator accepts `keys` beside `only: true` and refuses it otherwise or when it is not a string; the meta-schema and the TypeScript type declare it. The shared cases are tests/fixtures/validate/keyed-maps.mts, four form-render cases and `ok-multiple-keys` of spec-validity; config/parity.json cites the ids in the units validate, form-render and spec-validity. Red: `make parity-check UNITS="validate form-render spec-validity"` exit 2 with validate 362 of 387 and form-render 209 of 213 cases in every implementation; green: exit 0, every unit holds in every implementation.

### 2026-10-25 — The form-render and validate count tests follow cases.json (C17.23)

- C17.23 is done (C17.23): the form-render suite tests of Go, Rust and Python and the Python validate test no longer assert the hand-typed totals 154, 59, 209, 425, 229 and 196, which each row that added shared cases had to raise; each asserts that both kinds of case occur and that the result and failure cases together are every case of its cases.json, so a case that a later row adds needs no edit of the test and a case that records neither or both kinds fails. Red: make text-absent found the totals in the four files; green after the change.

### 2026-10-25 — C17.10 bounds the submitted data (C17.10)

- C17.10 is done (C17.10): a form root declares dataLimits: { depth, values }, 64 levels and 100000 nodes by default, and validation fails data beyond a limit with INVALID_FORM_INPUT and `Submitted data exceeds the {limit} limit of {n}` before any rule runs; a depth outside 1 to 512, values outside 1 to 1000000 or another member fails the load with INVALID_RULE_PARAMETER (docs/spec/validation-rules.md CUVR-082 to CUVR-084, docs/spec/schema.md CUSC-087). The nineteen cases of tests/fixtures/validate/data-limits.mts pass in TypeScript, PHP, the PHP extension, Go, Rust and Python.

### 2026-10-25 — C17.7 reads range bounds from data (C17.7)

- C17.7 is done (C17.7): a field declares minFrom or maxFrom: <field reference>, and its value must be a finite number at or above or at or below the value of the referenced field; a missing or null bound declares none, a present bound that is not a finite number fails, and a parameter that is not a reference string fails the load (docs/spec/validation-rules.md CUVR-079, CUVR-081). The ten cases of tests/fixtures/validate/bounds-from.mts pass in TypeScript, PHP, the PHP extension, Go, Rust and Python.

### 2026-10-25 — C17.6 adds the typeFrom rule (C17.6)

- C17.6 is done (C17.6): a field declares typeFrom: <field reference>, and the value of the referenced field names the type of the value: bool a boolean, int a finite number without a fractional part, enum a string; a missing or other type fails, and a parameter that is not a reference string fails the load (docs/spec/validation-rules.md CUVR-077, CUVR-078). The eleven cases of tests/fixtures/validate/type-from.mts pass in TypeScript, PHP, the PHP extension, Go, Rust and Python.

### 2026-10-25 — C17.5 adds the containedIn rule (C17.5)

- C17.5 is done (C17.5): a field declares containedIn: <field reference>, and its string value must occur in the string value of the referenced field, which resolves as the reference of equalTo does; a value or a referenced value that is not a string fails, and a parameter that is not a reference string fails the load (docs/spec/validation-rules.md CUVR-075, CUVR-076). The eight cases of tests/fixtures/validate/contained-in.mts pass in TypeScript, PHP, the PHP extension, Go, Rust and Python.

### 2026-10-25 — C17.24 writes data-source-relations as JSON.stringify does (C17.24)

- C17.24 is done (C17.24): every implementation writes the relations of a dynamic choice descriptor into data-source-relations as JSON.stringify writes them, each number through its own Number.prototype.toString writer (ps_number_text, Numbers::string, number_string, numberString, util::number_string) and each string with only the quote, the backslash and the control characters escaped; docs/spec/schema.md states the rule, including -0 as 0. The PHP extension had written floats with %.15g, PHP json_encode 1.0e+21 and an escaped U+2028, Python 1e-07, Rust 1e21 and Go -0 and escaped <, & and U+2028. list.c of the PHP extension drops its second number writer shortest_number for ps_number_text. The shared form-render cases search-dynamic-relations-numbers and search-dynamic-relations-text hold the numbers and the strings. Red: make parity-check UNITS="form-render" and the PHP extension comparison test failed on the new cases; green after the change.

### 2026-10-25 — Choices from a repeated group follow the source rows in the browser (C17.15)

- C17.15 is done (C17.15): docs/spec/schema.md states CUSC-071: a form instance lists the choices of a group source from its current data after every change, and listing them changes no value. The new form-state family tests/fixtures/form-choices, whose step `choices` observes the options of a field node, tests it in the TypeScript, Go, Python, Rust, PHP and PHP extension implementations (unit form-choices). The React, Vue, Svelte and HTML renderer forms run the shared module tests/fixtures/form-session/group-source.mts. The browser validation binding of packages/form-binding renders the body of each field with a group source again from the data of its controls with the HTML renderer and patchContent when it binds and after every input or change, keeps each selected value that is still a choice, and takes the options language and idPrefix. The Svelte widget patch selects the options that its markup marks when the patch removed a selected option, so a select whose choice is gone selects none instead of the first option. Red: the form-binding choices test failed 4 of 5 and the Svelte session test showed the first option selected after the selected source row was removed; green after the change.

### 2026-10-25 — C17.2 takes the choices of a field from a repeated group (C17.2)

- C17.2 is done (C17.2): a choice field declares items { from: group.*.field, label } and lists the rows of that repeated group of the same form as its choices, in data order (docs/spec/schema.md CUSC-061 to CUSC-067); compilation and the validator load refuse a group source that breaks its rules, and the validator checks a value against the choices with an implicit in check before the declared rules (docs/spec/validation-rules.md CUVR-060, CUVR-061), in TypeScript, PHP, the PHP extension, Go, Rust and Python. Red: make parity-check UNITS="validate form-render" failed the 16 validate and 8 form-render group-source cases; green after the change.

### 2026-10-25 — C17.12 compares the message of the form-render failure cases (C17.12)

- C17.12 is done (C17.12): the form-render failure cases compare the raised code and message with the whole expectError record in all six bindings (ts, php, php-extension, go, rust, python), so a wrong message or a record without a message fails; the Go suites read the Message of a composition error, whose Error prefixes the code. docs/spec/form-runtime.md states the UNSUPPORTED_FIELD_TYPE message `Unsupported field type "{type}" at "{path}"`, and the fixture generator records and checks the message of every error case, adding the messages of compose-ref-unresolved-load-error and unsupported-type-throws. Red: make parity-check UNITS="form-render" failed on the two cases without a message; green after the change.

### 2026-10-25 — The Go generator returns coded form input errors (C17.21)

- C17.21 is done (C17.21): every failure of the Go generator that is no composition failure and no unsupported field is a `validate.FormInputError` with the code `INVALID_FORM_INPUT`, and the Go suites read the code from the error (ComposeLoadError, UnsupportedFieldTypeError or FormInputError) and fail on an error that carries none, instead of labelling every other error `INVALID_FORM_INPUT`. Red: parity-check of form-render failed in Go with 152 of 201 cases; green after the change.

### 2026-10-25 — The empty select placeholder is a rule (C17.14)

- C17.14 is done (C17.14): docs/spec/schema.md states as CUSC-080 that a select or search field with no option (no `items`, an empty array, an empty map or a dynamic source) writes exactly one `<option value="">select</option>`, untranslated and never selected, and docs/spec/validation-rules.md states as CUVR-080 that its value is an empty value, with the Korean twins. The form-render and validate fixtures test it, the parity units form-render and validate cite both requirements, and each of the six implementations builds the option in one constructor that cites CUSC-080; the output is unchanged. Red: parity-declarations-check failed with CUSC-080 and CUVR-080 untraced; green after the cases.

### 2026-10-25 — C17.17 reads the grammar tokens of describe from the token requirements (C17.17)

- C17.17 is done (C17.17): crudui describe reads the tokens of docs/spec/expressions.md section 1 from the requirements CUXP-001 to CUXP-017, which C16.56 made bullets, instead of table rows that the section no longer holds; a line of another shape or a section without a token fails. The row runs the list-describe test of packages/cli, which make test-ts does not reach. Red: list-describe.test failed with 0 tokens; green after the change.

### 2026-10-25 — C17.20 derives the coverage counts of the native tests from cases.json (C17.20)

- C17.20 is done (C17.20): the comparison tests of packages/php-ext/tests/comparison assert that each engine program reports every case it read from the form-render, list-render and detail-render cases.json, instead of the hand-typed totals 188, 162, 137, 157, 17, 28 and 62; the expression and composition tests drop their totals 74, 129 and 20, since they run one test for each case; and tests/native-generators/run.mts replaces its totals 188, 157, 5 and 62 with the suite check fixture-coverage, which fails when a selected case of the form-render, list-render, form-outline or detail-render cases.json has no check of an available target. A case that a program or the suite drops fails. The binding comparison test leaves to the compilation test every case that compilation rejects with a CRUDUI error, of any code, and asserts that each such case expects an error. Red: the comparison test failed with 201 !== 188 and run.mts with 201 !== 188; green after the change.

### 2026-10-25 — A condition field edits a condition tree in every renderer (C17.18)

- C17.18 is done (C17.18): `docs/spec/schema.md` defines the `condition` field, which holds a condition tree and requires the literal rule `validate.conditionTree` true or judge (CUSC-070). `docs/spec/form-markup.md` defines its control: the textarea of a textarea field with the class `crudui-input--condition`, the marker `data-crudui-value="json"` and the condition text of its value, the JSON.stringify text of a value that is no string (CUMK-066). `docs/spec/form-runtime.md` states how `connectForm` and the browser validation of `@polyspec/crudui-form-binding` decode the text back into the tree, and how a server reads a submitted text. The TypeScript generator, and so React, Vue, Svelte and the HTML renderer, and the Go, PHP, PHP extension, Rust and Python generators render it, and the meta-schema requires its rule. The form-render cases `condition-*`, the spec-validity case `ok-condition-field` and the validate case `condition-field-values` test it, and the units form-render, spec-validity and validate cite the new requirements. Red: `make parity-check UNITS="form-render spec-validity validate"` failed the new cases in every implementation before the change; green after the change.

### 2026-10-25 — C17.16 checks each shared case in the php-ext engine test (C17.16)

- C17.16 is done (C17.16): the shared validation test of packages/php-ext/tests/engine/engine.test.mjs asserts that the engine program reports one result for each case of the validate, spec-validity, list-validity and detail-validity cases.json, instead of the hand-typed totals 318 and 385; a case that the program drops fails the test. The row runs that test, which make test-php-ext CASES=engine does not reach. Red: the test failed with 341 !== 318; green after the change.

### 2026-10-25 — Catch clauses name the error they handle (C17.13)

- Each of the 33 catch clauses that had no binding now binds the error and narrows it to the error that means its outcome (SyntaxError for JSON parse, TypeError for a malformed URL or form body, ENOENT or exit code 1 for a missing file or command, ParseError for a condition, FORBIDDEN_META_KEY and INVALID_FORM_INPUT where those are the outcome), and rethrows the rest. The catch-check of lint-ts passes.

### 2026-10-25 — Catch clauses name the error they handle (C17.13)

- Each of the 33 catch clauses that had no binding now binds the error and narrows it to the error that means its outcome (SyntaxError for JSON parse, TypeError for a malformed URL or form body, ENOENT or exit code 1 for a missing file or command, ParseError for a condition, FORBIDDEN_META_KEY and INVALID_FORM_INPUT where those are the outcome), and rethrows the rest. The catch-check of lint-ts passes.

### 2026-10-25 — The rule conditionTree checks nested conditions in six implementations (C17.1)

- C17.1 is done (C17.1): `docs/spec/schema.md` defines condition trees (CUSC-072 to CUSC-075): a JSON value that a field holds as data, made of groups `{all: [...]}` and `{any: [...]}`, field comparisons `{field, op, value}` with the operators eq, ne, lt, le, gt, ge, in and has, and judged text `{judge}`, at most 32 levels deep. `docs/spec/validation-rules.md` registers the rule `conditionTree` (CUVR-066, CUVR-067), whose parameter `true` permits groups and field comparisons and `judge` judged text as well, and its parameter error (CUVR-068); the rule receives its parameter unchanged. The TypeScript, PHP, PHP extension, Go, Rust and Python validators, the meta-schema, the specification types and the CLI carry the rule. `tests/fixtures/validate/condition-tree.mts` writes 17 cases into `cases.json`, and the validate unit of `config/parity.json` cites the new requirements. Red: `make parity-check UNITS="validate"` failed the 17 cases (341 of 358 passed) in every implementation without the rule; green after the change.

### 2026-10-23 — C17.11-1 reads the tools of a worktree from its main checkout (C17.11-1)

- C17.11-1 is done (C17.11-1): check-doc-coverage.test requires the extends of the kit package that C17.11 brought; gen-api-docs takes phpDocumentor from the tools of the main checkout and keeps its cache in the checkout; UV, GO and COMPOSER name $(KIT_TOOLS). Red: check-doc-coverage.test failed; green after the change.

### 2026-10-23 — C17.11 syncs kit and routes the sources to their lints (C17.11)

- C17.11 is done (C17.11): make kit-sync brings the changed copies of kit and removes the retired lint configurations (kit K514); each api-extractor.json extends the configuration of the kit package; the owner rules route each language to its lint and duplication-check (kit K534) and name no removed file; the eleven catches without a statement (kit K537) now narrow, report or observe their failure. Red: make kit-check failed; green after the change.

### 2026-10-22 — C16.173 is dropped under the user's rule of no version-pin work (C16.173)

- C16.173 is dropped (C16.173): user 2026-10-22: no version-pin work; the cross-repository version alignment (S4) is removed in kit K448.

### 2026-10-22 — C16.172 is dropped under the user's rule of no version-pin work (C16.172)

- C16.172 is dropped (C16.172): user 2026-10-22: no version-pin work; the cross-repository version alignment (S4) is removed in kit K448.

### 2026-10-22 — C16.169 is dropped under the user's rule of no version-pin work (C16.169)

- C16.169 is dropped (C16.169): user 2026-10-22: no version-pin work; the cross-repository version alignment (S4) is removed in kit K448.

### 2026-10-22 — C16.29 is dropped under the user's rule of no version-pin work (C16.29)

- C16.29 is dropped (C16.29): user 2026-10-22: no version-pin work; the cross-repository version alignment (S4) is removed in kit K448.

### 2026-10-22 — C16.13 is dropped under the user's rule of no version-pin work (C16.13)

- C16.13 is dropped (C16.13): user 2026-10-22: no version-pin work; the cross-repository version alignment (S4) is removed in kit K448.

### 2026-10-22 — C16.8 is dropped under the user's rule of no version-pin work (C16.8)

- C16.8 is dropped (C16.8): user 2026-10-22: no version-pin work; the cross-repository version alignment (S4) is removed in kit K448.

### 2026-10-22 — C16.171 is dropped under the link rule (C16.171)

- C16.171 is dropped (C16.171): the user's link rule keeps the tracked composer.json and Makefile as they are; the vendor polyspec packages are links.

### 2026-10-22 — C16.170 is dropped under the link rule (C16.170)

- C16.170 is dropped (C16.170): the user's link rule keeps the tracked files as they are; the install folders of crudui main are links.

### 2026-10-22 — C16.45 is dropped under the link rule (C16.45)

- C16.45 is dropped (C16.45): the user's link rule keeps the tracked lock as its release record, so the tracked-lock rewrite that the row waited for (K439-3-x) has no work left.

### 2026-10-21 — The sprintf-js advisory exception names both of its paths (C16.169-1)

- The advisory exception of sprintf-js (npm advisory 1241202, GHSA-hp3w-g68c-fv3c, medium) in `config/dependency-policy.json` names both paths that bring sprintf-js 1.0.3 in (C16.169-1): the direct development dependency `@microsoft/api-documenter` 7.30.18, which `scripts/gen-api-docs.mts` runs with fixed arguments, and `@microsoft/api-extractor` 7.59.4 of `@polyspec/kit`, both through `@rushstack/ts-command-line` 5.3.17 and argparse 1.0.10; the reason said the only path was kit's. No sprintf-js release fixes the advisory (vulnerable <= 1.1.3, the latest), so its removal (C16.169) joins the coordinated dependency batch. Red: `make text-absent` of the old sentence exit 2 on e9d3accc; green: exit 0.

### 2026-10-21 — The unit pool of the form comparison runs its units as node:test tests (C16.28-1)

- Each unit of `check.mjs` (the browser phases) and `check-pipeline.mjs` (the store resets and the 40 combinations) is a node:test test registered by `unitTest` of `src/unit-pool.mjs`, with its own timeout (`browserUnitLimitsMs`, `pipelineUnitLimitMs`); the outcome (`passed`, `failed` or `timed-out`) and the duration are recorded in the report, and `runUnit` and `runUnits` are removed (C16.28-1). Both files are node:test files that `local-verification.mjs` runs with `node --test` and that receive their origin, server and report file through the environment. `pipelineReport` moves to `src/pipeline-flow.mjs`, so that importing the pipeline no longer registers its tests. `src/unit-pool.mjs` keeps `runOperation`, which has no node:test equivalent (the browser start and close keep their start, heartbeat and result lines), and `measuredLimitMs`. The per-unit start and heartbeat lines are dropped, since node:test prints each test's result when it ends; `config/rebuild.json` classes `unit-pool.mjs` as policy. Red: `make text-absent FILE=examples/form-comparison/check.mjs TEXT="runUnit("` exit 2 and the owner tests (`unit-pool.test.mjs`, `check-verification.test.mjs`) exit 1 with 7 failed on the HEAD source; green: the six commands of the Verification exit 0, with 11 node:test tests passing. The browser checks were not run locally; `node --check` and `make lint-ts` pass.

### 2026-10-21 — The go outline cases are reported by name (C16.165-3)

- `TestOutlineFixture` of `packages/generator/go/outline_test.go` runs each case of `tests/fixtures/form-outline/cases.json` as the subtest `TestOutlineFixture/<case>`, with the same assertions (C16.165-3); C16.165 had left it a loop with no subtest, so `make parity-check UNITS=form-outline` read none of its five cases. Red: that check reports `R3 not-executed form-outline go` (0 of 5) on 14a3b7b2; green: 5 of 5 cases passed and no go R3 line.

### 2026-10-21 — The form comparison runs its steps through runCommand of kit (C16.28)

- `runStep` of examples/form-comparison/src/step-runner.mjs runs each step through `runCommand` of `@polyspec/kit/run-command` with its output piped and printed line by line with the step id (`onLine`); the process-group spawn, the output prefixing and `stopStepsOnSignal` (which kit's runCommand replaces) are removed, and local-verification.mjs no longer calls it; `killProcessTree` and the heartbeat stay (C16.28). Red: `make text-absent` of `spawn(step.command` in step-runner.mjs exits 2 with the stale text, and `grep` of `@polyspec/kit/run-command` exits 1; green: step-runner.test.mjs 9 passed, `make rebuild-check` exits 0.

### 2026-10-21 — The go bindings of the text units and the expression fixture report each case by name (C16.165)

- The go bindings of text-compile-form, text-bind-form, text-create-form, text-build-list, text-build-detail, text-validity-validate, text-validity-validate-list and text-validity-validate-detail each run as a test function of their own, and the expression fixture reports each entry as one subtest, so `make parity-check` reports every case of these units as executed for go (C16.165-1, C16.165-2). Red: `make parity-check UNITS="text-compile-form text-bind-form text-create-form text-build-list text-build-detail text-validity-validate text-validity-validate-list text-validity-validate-detail expr"` on 094317cc: the go lines report the cases as not executed or not in the suite; green: each go binding passes every case, with no go R3 line (C16.165).

### 2026-10-21 — The go validator text and expression units report each case by name (C16.165-2)

- packages/validator/go/validator/validate/text_conformance_test.go: TestInputTextMatchesFixture keeps the three fixtures as subtests; the new functions TestInputTextValidate, TestInputTextValidateList and TestInputTextValidateDetail run one fixture each through runTextFixture, whose subtests are the bare case names. packages/validator/go/validator/expr/conformance_test.go: each expression entry runs its stages (tokens, ast, evaluation) in its own subtest body instead of nested subtests, and a stage that fails reports with t.Errorf and returns, so the later stages still run as before. config/parity.json binds text-validity-validate, text-validity-validate-list and text-validity-validate-detail to their own functions (C16.165-2). Red: `make parity-check UNITS="text-validity-validate text-validity-validate-list text-validity-validate-detail expr"` exit 2 on 094317cc, with the go lines `R3 not-executed text-validity-validate go ...: not executed: pass-paired-surrogates, ...` and `R3 not-executed expr go ...: not in the suite: path-sibling-truthy/tokens, ...`; green: the go lines `exit 0` with 21, 6, 5 and 74 of 21, 6, 5 and 74 cases passed, and no go R3 line.

### 2026-10-21 — The go input text units report each case by name (C16.165-1)

- packages/generator/go/input_text_test.go: TestInputTextCases keeps the five fixtures as subtests; the new functions TestInputTextCompileForm, TestInputTextBindForm, TestInputTextCreateForm, TestInputTextBuildList and TestInputTextBuildDetail run one fixture each through runTextCases, whose subtests are the bare case names; config/parity.json binds the units text-compile-form, text-bind-form, text-create-form, text-build-list and text-build-detail to their own function (C16.165-1). Red: `make parity-check UNITS="text-compile-form text-bind-form text-create-form text-build-list text-build-detail"` exit 2, with the go lines `R3 not-executed <unit> go packages/generator/go/input_text_test.go: not executed: pass-paired-surrogates, ...; not in the suite: compileForm/pass-paired-surrogates, ...`; green: the go lines `exit 0`, 7, 17, 15, 11 and 6 of 7, 17, 15, 11 and 6 cases passed, and no go R3 line (exit 2 remains from the ts and rust lines of the same units).

### 2026-10-21 — The python test files of the case reports are formatted (C16.157-8)

- The python test files that the case-reporting rows changed are formatted as ruff format writes them (C16.157-8): `packages/generator/python/tests/test_outline.py` (the `assertEqual` of the outline rows) and `packages/validator/python/tests/test_text_validity.py` (the count of the validateDetail fixture); no assertion changes. Red: `make lint-python` exit 1, `ruff format --check .` reports both files as `would be reformatted` (2 files would be reformatted); green: `make lint-python` exit 0, every step passed.

### 2026-10-21 — The python template-shape binding of the generator reports each case by name (C16.157-7)

- The python binding of the unit template-shape reports each case by its bare name (C16.157-7): `packages/generator/python/tests/test_template_shape.py` gives the unit a test class with one test method per case, which runs its operation on the template (createRecords cases bind each record from the serialized template), as before; the fixture count stays in `TestTemplateShapeFixtureCount`, and `config/parity.json` runs the binding with `var/python/bin/python` and its class. Red: `make -s parity-check UNITS="template-shape"` reports the python R3 `not executed` line for template-shape (0 of 44 cases passed); green: the same check reports `template-shape python` 44 of 44 cases passed and no python R3 line.

### 2026-10-21 — The python text-validity bindings of the generator report each case by name (C16.157-6)

- The python bindings of the units text-compile-form, text-bind-form, text-create-form, text-build-list and text-build-detail report each case by its bare name (C16.157-6): `packages/generator/python/tests/test_text_validity.py` gives each unit a test class with one test method per case, which runs the same outcome and error-class assertions as before (createForm runs its recorded action on the instance); the fixture counts stay in `TestGeneratorTextValidityFixtureCounts`, and `config/parity.json` runs each binding with `var/python/bin/python` and its class. Red: `make -s parity-check UNITS="text-compile-form text-bind-form text-create-form text-build-list text-build-detail"` reports python R3 `not executed` lines for the five units (for example `R3 not-executed text-bind-form python`, 0 of 17 cases passed); green: the same check reports every case passed (7 of 7, 17 of 17, 15 of 15, 11 of 11 and 6 of 6) and no python R3 line.

### 2026-10-21 — The python render bindings of the generator report each case by name (C16.157-5)

- The python bindings of the units form-complete, list-render and detail-render report each case by its bare name (C16.157-5): `packages/generator/python/tests/test_render.py` gives each unit a test class with one test method per case; the list and detail cases run `assert_render` and the form-complete cases compare the bytes, as before; the fixture counts stay in `TestRenderFixtureCounts`, and `config/parity.json` runs each binding with `var/python/bin/python` and its class. Red: `make -s parity-check UNITS="form-complete list-render detail-render"` reports python R3 `not executed` lines for the three units (for example `R3 not-executed list-render python`, 0 of 165 cases passed); green: the same check reports every case passed (form-complete 28 of 28, list-render 165 of 165, detail-render 68 of 68) and no python R3 line.

### 2026-10-21 — The python outline binding of the generator reports each case by name (C16.157-4)

- The python binding of the unit form-outline reports each case by its bare name (C16.157-4): `packages/generator/python/tests/test_outline.py` gives the unit a test class with one test method per case, which compiles, binds and builds the outline and compares the rows with the recorded ones, as before; the fixture count stays in `TestOutlineFixtureCount`, and `config/parity.json` runs the binding with `var/python/bin/python` and its class. Red: `make -s parity-check UNITS="form-outline"` reports the python R3 `not executed` line for form-outline (0 of 5 cases passed); green: the same check reports `form-outline python` 5 of 5 cases passed and no python R3 line.

### 2026-10-21 — The python compose binding of the validator reports each case by name (C16.157-3)

- The python binding of the unit compose reports each case by its bare name (C16.157-3): `packages/validator/python/tests/test_compose.py` gives the unit a test class with one test method per case, which composes the entry and compares the composed map with sorted member names (a result case) or checks the recorded `ComposeLoadError` code (an error case), as before; the declarations and fixture counts stay in `TestComposeFixtureCounts`, and `config/parity.json` runs the binding with `var/python/bin/python` and its class. Red: `make -s parity-check UNITS="compose"` reports the python R3 `not executed` line for compose (0 of 20 cases passed); green: the same check reports `compose python` 20 of 20 cases passed and no python R3 line.

### 2026-10-21 — The python structure-validity bindings of the validator report each case by name (C16.157-2)

- The python bindings of the units list-validity, detail-validity and spec-validity report each case by its bare name (C16.157-2): `packages/validator/python/tests/test_structure_validity.py` gives each unit a test class with one test method per case, which runs `assert_load` (a clean specification returns the clean result, a failing one raises the recorded code and trace, as before); the declarations and fixture counts stay in `TestStructureValidityFixtureCounts`, and `config/parity.json` runs each binding with `var/python/bin/python` and its class. Red: `make -s parity-check UNITS="list-validity detail-validity spec-validity"` reports python R3 `not executed` lines for the three units (for example `R3 not-executed spec-validity python`, 0 of 34 cases); green: the same check reports list-validity 20 of 20, detail-validity 13 of 13 and spec-validity 34 of 34 cases passed and no python R3 line.
- C16.157-2 is closed: its Verification passes on the tree of its commit, which had kept the row at `[~]` (C16.157-2).

### 2026-10-21 — The python text-validity bindings of the validator report each case by name (C16.157-1)

- The python bindings of the units text-validity-validate, text-validity-validate-list, text-validity-validate-detail and text-validity-value-graphs report each case by its bare name (C16.157-1): `add_case_tests` in `packages/validator/python/tests/conformance.py` takes the fixture file name, and `packages/validator/python/tests/test_text_validity.py` gives each unit a test class with one test method per case that runs the same assertions; the fixture counts stay in `TestTextValidityFixtureCounts`, and `config/parity.json` runs each binding with `var/python/bin/python` and its class. Red: `make -s parity-check UNITS="text-validity-validate text-validity-validate-list text-validity-validate-detail text-validity-value-graphs"` reports python R3 `not executed` lines for the four units (for example `R3 not-executed text-validity-validate python`, 0 of 21 cases); green: the same check reports every case of the four units passed (21 of 21, 6 of 6, 5 of 5 and 12 of 12) and no python R3 line.

### 2026-10-21 — The validity fixtures are bound to every generator (C16.167)

- config/parity.json declares list-render-validity over tests/fixtures/list-validity and detail-render-validity over tests/fixtures/detail-validity, with six bindings each: the TypeScript files display-validity.test.ts and detail-display-validity.test.ts (over validity-outcome.ts), validity_render_test.go (Go), test_render_validity.py and test_detail_render_validity.py (Python, with conformance.check_validity), validity_render.rs (Rust), and ListRenderValidityTest.php and DetailRenderValidityTest.php (PHP and the native extension, with ValidityOutcome.php) (C16.167). Each case is refused with its recorded engine failure or with INVALID_FORM_INPUT (CUDF-036 to CUDF-062, docs/spec/display-formats.md), or builds. Red: `sh -c 'make -s parity-check UNITS="list-render-validity detail-render-validity" > var/pc-C16.167.log 2>&1'` exit 2 (the bindings do not exist). Green: the same command exit 0, 198 cases passed; every generator already refused these cases, so no implementation changed.

### 2026-10-21 — The validate fixture is written by its generator (C16.166)

- `tests/fixtures/validate/generate.mts` writes the two CUSC-038 expression cases that `cases.json` held by hand (`expression-scalar-equals-array-is-false`, `expression-zero-equals-empty-array-is-false`; `EXPRESSION_CASES`), with their expectation from the reference validator, which equals the hand-written one (valid, no error). Their citations now also name CURP-018 and CURP-022, as every generated case does, so `tests/fixtures/validate/cases.json` changes in those two citation lists only (C16.166). Red: `sh -c 'var/tools/bin/node tests/fixtures/validate/generate.mts > var/validate-cases.json && cmp -s var/validate-cases.json tests/fixtures/validate/cases.json'` exit 1 (the two cases are missing from the output); green: the same command exits 0.

### 2026-10-21 — The parity declaration holds with no finding (C16.3)

- Every unit of config/parity.json holds in every implementation and cites the spec requirements its tests name: no profile, native-only symbol or exclusion is left, and `make parity-declarations-check` reports no finding with kit 0.0.54 linked to its checkout (C16.3).

### 2026-10-21 — The parity declaration holds with no finding (C16.46-1)

- config/parity.json keeps the TypeScript-only packages and the tooling tests outside the implementation roots, and the C engine test of the extension has its place (the engine tests internal, the contract tests bound with the node runner, K422): `make parity-declarations-check` reports no finding (C16.46-1).

### 2026-10-21 — The parity declaration holds with no finding (C16.46)

- config/parity.json declares the implementations, the tooling roots and the comparators of crudui with no finding of `make parity-declarations-check`: the units, requirement ids and test moves it waited for are done (C16.46).

### 2026-10-21 — The parity declaration holds with no finding (C16.57)

- Every requirement id of docs/spec is cited by a unit whose tests name it: `make parity-declarations-check` reports no finding on main after C16.146..C16.158 (no R4, R13, R14 or R15 line), so the row is done. Red: the check exit 2 on 1788f7ca (five R5 lines of the Unicode tests); green: exit 0 (C16.57).

### 2026-10-21 — The PRINCIPLES copies follow kit K431 (C16.164)

- `make kit-sync` rewrites `PRINCIPLES.md` and `PRINCIPLES.ko.md` from the linked kit (C16.164): kit K431 added to P-rules that a comment or document that a change makes stale is corrected in that commit, and one found later is a sub-item whose Verification is `make text-absent FILE=<path> TEXT=<stale text>`. Red: `make kit-check` exit 2 on aaa19888 (both copies differ); green: exit 0.

### 2026-10-21 — config/rebuild.json classes the shared adapter entries of the form comparison (C16.163)

- `config/rebuild.json` declares `examples/form-comparison/src/adapters/view-entries.ts`, which C16.58-27 added, as a policy module of the form comparison example (C16.163); without a class, `make rebuild-check` failed on main. Red: `make rebuild-check` exit 2 on ffb7d22a ("the tool has no class in config/rebuild.json"); green: exit 0.

### 2026-10-21 — The install check accepts the kit of a linked checkout (C16.162)

- `tests/build/runtime-version-policy.test.mts` ("make installs nothing on its own and make install installs the Rust toolchain") finds the install-tools step of `make install` under `node_modules/@polyspec/kit/dist` or `../kit/dist` (C16.162): in a checkout whose kit is linked to its sibling checkout (make link), KIT is `../kit/dist`, so the test failed in every linked checkout although make install ran kit's install-tools. Red: the test file exit 1 on 53d11cac; green: exit 0.

### 2026-10-21 — The CI toolchain rule admits the phpize and php-config of setup-php (C16.161)

- `tests/build/runtime-version-policy.test.mts` ("every CI job sets up the recorded toolchains and checks the tools it set up") accepts the setup-php input `tools: phpize, php-config` beside `tools: none` (C16.161). C16.9 builds the extension with phpize and gave five CI jobs that build it `tools: phpize, php-config`, the build tools of the PHP that setup-php installs, but kept the rule that setup-php installs no tool, so the test failed on main. setup-php still installs no Composer: make install-tools installs the Composer of mise.toml. Red: that test exit 1 on 77c77235 naming the five jobs; green: exit 0.

### 2026-10-21 — make crudui-test-php-engine runs the contract tests of the PHP extension (C16.160)

- `crudui-test-php-engine` of the Makefile runs `packages/php-ext/tests/contract/*.test.mjs` with the engine and comparison tests (C16.160). C16.57-3-1 and C16.57-3-2 added `compose.test.mjs` and `expr.test.mjs` there as the php-extension bindings of the units `compose` and `expr`, but no project command ran them, which `tests/build/test-commands.test.mts` ("every node:test file runs in a project command") refuses. Red: that test exit 1 on d68d71c6 naming the two files; green: exit 0.

### 2026-10-21 — The PHP bindings of the text-validity units report every case (C16.159)

- The PHP tests of the eight text-validity units split by unit, so that each binding reports its cases by their bare names: `packages/validator/php/tests/Validate/TextValidityConformanceTest.php` runs `testValidateInputTextMatchesFixture`, `testValidateListInputTextMatchesFixture` and `testValidateDetailInputTextMatchesFixture`, and `packages/generator/php/tests/InputTextTest.php` runs `testCompileFormCase`, `testBindFormCase`, `testCreateFormCase`, `testBuildListCase` and `testBuildDetailCase` (the data providers key each data set by its case name). The sixteen php and php-extension bindings of the units in `config/parity.json` name these methods. The 88 data sets and their assertions are unchanged (21, 6, 5, 7, 17, 15, 11 and 6 cases). Red: the Verification fails on d68d71c6, every php and php-extension binding of the units reports `0 of N cases passed` with an R3 line; green: exit 0, every php and php-extension binding reports `N of N cases passed`.

### 2026-10-21 — The python bindings report each case of their units by name (C16.157)

- The python bindings of the units buttons, validate, form-render, form-view, form-history, form-actions, view-functions and expr report each case by name (C16.157): `add_case_tests` in `packages/generator/python/tests/conformance.py` and `packages/validator/python/tests/conformance.py` gives a class one test method `test_<case>` per case, `packages/generator/python/tests/test_buttons.py`, `test_form_render.py`, `test_form_state.py` and `packages/validator/python/tests/test_expr.py`, `test_validate.py` run the same assertions per case, and the fixture counts stay in their own test classes. `config/parity.json` runs the python implementation with `var/python/bin/python` (the venv of the packages) and names the test class of each binding (C16.157). Red: `make -s parity-check UNITS="buttons validate form-render form-view expr form-history form-actions view-functions"` on d68d71c6 exits 1, with python R3 `not executed` lines for each unit (for example `R3 not-executed validate python ... exited with 1`); green: exit 0, every python unit reports all its cases passed (validate 341 of 341, form-render 201 of 201, buttons 22 of 22, expr 74 of 74, form-view 3 of 3, form-history 5 of 5, form-actions 20 of 20, view-functions 11 of 11) and no `R3 not-executed <unit> python` line.

### 2026-10-21 — The list messages that the extension embeds are checked (C16.100-2)

- The php-extension binding of the feature unit `interface-messages` (CUMK-065) is the node contract test `packages/php-ext/tests/contract/interface-messages.test.mjs`, which compiles `interface_messages.c` and compares the form and the list messages of every language with `contracts/interface-messages.json`; it reads the tables through `TABLES` and `fieldName` of `packages/php-ext/tools/generate-interface-messages.mjs`, now exported, and no public PHP accessor is added (C16.100-2). The PHP library binding keeps `InterfaceMessagesConformanceTest.php`. Red: `InterfaceMessagesConformanceTest.php` passed (OK, 5 tests) and reads only `Form::getMessages()`, so no test checked the list messages; green: the new contract test exits 0 (var/c16100-node.log) and `make -s parity-declarations-check` exits 0 (var/pd-C16.100-2.log).

### 2026-10-21 — The Unicode data of the six implementations is checked against its contract (C16.113)

- The feature unit `unicode-data` (CUVR-018) binds the Unicode tests of ts (`packages/validator/ts/src/unicode/properties.unit.test.ts`), php (`UnicodeDataTest::testEmbeddedDataEqualsTheContract`), go (`TestUnicodeDataMatchesContract`), rust (`embedded_data_matches_the_contract`), python (`test_unicode_data.py`) and the php-extension, whose new node contract test `packages/php-ext/tests/contract/unicode-data.test.mjs` compiles the C tables of `unicode_data.c` and the White_Space check of `whitespace.c` and compares them with `contracts/unicode-properties.json`; the check moved out of `packages/php-ext/tests/engine/engine.test.mjs` (C16.113). The values unit `packages/validator/ts/src/values/values.unit.test.ts` is declared internal. Red: `make -s parity-declarations-check` exit 2 with five `R5 undeclared-test` lines; green: exit 0 with no finding, and the node contract test exit 0.

### 2026-10-21 — The scripts run their commands through the kit runner (C16.10)

- `scripts/run-command.mts` is removed: its users import `@polyspec/kit/run-command` (`scripts/repeat-build.mts`, `scripts/run-contract-tests.mts`, `scripts/gen-api-docs.mts`, `scripts/install-browsers.mts`, `scripts/require-current-build.mts`, `benchmarks/validators/build-drivers.mjs`, `benchmarks/validators/run.js` and `tests/native-generators/run.mts`), and its test `tests/build/run-command.test.mts` leaves `npm run test:build` with it, since kit owns the runner. `config/rebuild.json` drops its `replaced` entry, and `config/owner-checks.json`, `tests/build/rust-node-entry-points.test.mts` and `scripts/gen-api-docs.test.mts` drop the removed file. The output limit fails with kit's message, `wrote more than its output limit; stopped its process group`, which no longer prints the byte count; no caller printed that count. Red: `sh -c 'test ! -e scripts/run-command.mts && ! git grep -qE "run-command\.mts" -- scripts benchmarks tests config package.json && make rebuild-check'` exit 1 on HEAD (the file is present); green: the same command exit 0; `scripts/gen-api-docs.test.mts` 8 passed, `tests/build/rust-node-entry-points.test.mts` 7 passed, `tests/build/offline-checks.test.mts` 2 passed, `tests/build/install-browsers.test.mts` 3 passed.

### 2026-10-21 — The shared text helpers pass lint and name no requirement in their internal test (C16.158-7) (C16.158-7)

- The shared text-validity helpers (tests/fixtures/text-validity/cases.mts and input-text.mts) import their package modules by .ts path, which the nodenext root tsconfig needs, and drop an unused export; the internal test text-validity.conformance.test.ts no longer names CUIT-041, which parity-declarations-check reports as R16 for an internal test. Red: `make -s parity-declarations-check` exit 2, `R16 internal-contract ts packages/validator/ts/src/text/text-validity.conformance.test.ts`; green: that finding is gone, and `make lint-ts` exits 0.

### 2026-10-21 — The template-shape unit has one ts case per test (C16.158-6) (C16.158-6)

- The ts binding of template-shape (C16.158-6) reports each case of tests/fixtures/template-shape by its name: the case loop of template-shape.test.ts is outside the describe of the unit's own tests, so each case is a top-level test named by the case. Red: `make -s parity-check UNITS="template-shape"` exit 1, `R3 not-executed template-shape ts` with the case names (bindForm-compiled, ...); green: exit 0, 44 of 44 cases passed.

### 2026-10-21 — The html form, list and detail units have one ts case per test (C16.158-5) (C16.158-5)

- The ts bindings of form-outline, form-complete, list-render and detail-render (C16.158-5) report each case by its name: the case groups of outline.conformance.test.ts, list-conformance.test.ts and detail-conformance.test.ts are top-level tests named by the case, and form-complete.conformance.test.ts runs the renderFormView check of a case inside the test of that case, so no case name repeats. Red: `make -s parity-check UNITS="form-outline form-complete list-render detail-render"` exit 1, `R3 not-executed <unit> ts` with the case names; green: exit 0, form-outline 5 of 5, form-complete 28 of 28, list-render 165 of 165, detail-render 68 of 68 cases passed.

### 2026-10-21 — The validator list, detail and spec units have one ts case per test (C16.158-4) (C16.158-4)

- The ts bindings of list-validity, detail-validity and spec-validity (C16.158-4) report each case by its name: the case groups of validate-list.conformance.test.ts, validate-detail.conformance.test.ts and forbidden-scan.conformance.test.ts are top-level tests named by the case, and their describe wrappers are gone; the meta-check of each file stays nested. Red: `make -s parity-check UNITS="list-validity detail-validity spec-validity"` exit 1, `R3 not-executed <unit> ts` with the case names; green: exit 0, list-validity 20 of 20, detail-validity 13 of 13, spec-validity 34 of 34 cases passed.

### 2026-10-21 — The input text units have one ts test file each (C16.158-3)

- The ts bindings of text-compile-form, text-bind-form, text-create-form, text-build-list and text-build-detail (C16.158-3) are one test file each: `packages/generator/ts/src/text-compile-form.test.ts`, `text-bind-form.test.ts`, `text-create-form.test.ts`, `text-build-list.test.ts` and `text-build-detail.test.ts`. The shared case code is `tests/fixtures/text-validity/input-text.mts`; `packages/generator/ts/src/input-text.test.ts` keeps the unit tests of the form buttons and the loader documents, declared internal in `config/parity.json`. This sub-row also deletes `packages/validator/ts/src/text/text-validity-cases.ts`, a stale copy of the helper that C16.158-2 committed by mistake (it broke the validator typecheck). Red: `make -s parity-check UNITS="text-compile-form text-bind-form text-create-form text-build-list text-build-detail"` exit 1, `R3 not-executed <unit> ts` with the case names; green: exit 0, compile-form 7 of 7, bind-form 17 of 17, create-form 15 of 15, build-list 11 of 11, build-detail 6 of 6 cases passed.

### 2026-10-21 — The text-validity units have one ts test file each (C16.158-2)

- The ts bindings of text-validity-validate, text-validity-validate-list, text-validity-validate-detail and text-validity-value-graphs (C16.158-2) are one test file each: `packages/validator/ts/src/text/text-validity-validate.conformance.test.ts`, `text-validity-validate-list.conformance.test.ts`, `text-validity-validate-detail.conformance.test.ts` and `text-validity-value-graphs.conformance.test.ts`. The shared case code is `tests/fixtures/text-validity/cases.mts`, and `text-validity.conformance.test.ts` keeps the unit tests of the text helpers, declared internal in `config/parity.json`. Red: `make -s parity-check UNITS="text-validity-validate text-validity-validate-list text-validity-validate-detail text-validity-value-graphs"` exit 1, `R3 not-executed <unit> ts` with the case names of each unit; green: exit 0, validate 21 of 21, validate-list 6 of 6, validate-detail 5 of 5, value-graphs 12 of 12 cases passed.

### 2026-10-21 — The form-state units have one ts test file each (C16.158-1)

- The ts bindings of form-view, form-history, form-actions and view-functions (C16.158-1) are one test file each: `packages/generator/ts/src/form-history.test.ts`, `packages/generator/ts/src/form-actions.test.ts` and `packages/generator/ts/src/view-functions.test.ts` are new, `packages/generator/ts/src/form-state.test.ts` holds the form-view cases only, and `tests/fixtures/form-state/units.mts` registers the cases of each family as top-level tests named by the case. `config/parity.json` points the three new bindings at their files. Red: `make -s parity-check UNITS="form-view form-history form-actions view-functions"` exit 1, `R3 not-executed form-history ts`, `form-actions ts` and `view-functions ts` with their case names; green: exit 0, form-view 3 of 3, form-history 5 of 5, form-actions 20 of 20, view-functions 11 of 11 cases passed.

### 2026-10-21 — The ts bindings of five units report each case by name (C16.158)

- The TypeScript bindings of the units `buttons`, `validate`, `form-render`, `form-view` and `expr` report each case as a top-level vitest test named by the case (C16.158): `packages/generator/ts/src/buttons.conformance.test.ts`, `packages/validator/ts/src/validate.conformance.test.ts`, `packages/html/src/conformance.test.ts`, `packages/generator/ts/src/form-state.test.ts` (the form-view cases only; form-history, form-actions and view-functions stay nested under their describe) and `packages/validator/ts/src/expr.conformance.test.ts` drop their describe wrappers, and the form-render view and framework assertions of one case run in one test. Red: `make -s parity-check UNITS="buttons validate form-render form-view expr"` exit 1; `R3 not-executed <unit> ts` for buttons, validate, form-render, form-view and expr (`not executed: default-submit-only, ...`, `not executed: enddate-relative-path-2026-01-01, ...`, `not executed: text-with-nul, ...`, `not executed: toggle-row-collapses-and-expands, ...`, `not executed: path-sibling-truthy, ...`). Green: the same command exit 0, every ts binding of the five units reports `N of N cases passed` (buttons 22, validate 341, form-render 201, form-view 3, expr 74), and `grep "R3 not-executed [^ ]+ ts "` finds nothing.

### 2026-10-21 — The Rust bindings of the eighteen units report each case by name (C16.156-1)

- C16.156-1 is closed: the Rust bindings of the eighteen units (text-validity-validate, -list, -detail, value-graphs, list-validity, detail-validity, spec-validity, compose, form-complete, list-render, detail-render, form-outline, interface-messages, and the five text-form units) report every fixture case by name, with no rust R3 line; its Verification passes (C16.156-1). The sub-rows C16.156-1-1 to C16.156-1-5 hold the changes.

### 2026-10-21 — The Rust value graphs run all twelve cases, with shared values (C16.156-1-3)

- The Rust `JsonText` takes the shared values of the value-graph fixture: `JsonText::Shared(Arc<JsonText>)` places a value in several parents and `JsonText::Link(Weak<JsonText>)` makes a value that contains itself (`packages/validator/rust/src/text.rs`, documented in `packages/validator/rust/README.md` and `README.ko.md`). Every visit of a shared value counts as one node, and the checks (`check_specification`, `check_inputs`, `to_value`, `shape`, `invalid_path`) follow the TypeScript walk: a quick walk, then the ordered walk that reports the first failure, each with its own node and nesting limit. The runner `packages/validator/rust/tests/text_validity_conformance.rs` builds the eight shapes of the graph description (`doubled`, `self-twice` with `Arc::new_cyclic`, `chain`, `flat`) and places them in `spec`, `data` or `files` (C16.156-1-3). Red: `make -s parity-check UNITS="text-validity-value-graphs"` on 7a6f8d25 exit 2, eight of twelve cases not executed (shared-list-within-limits, shared-list-beyond-node-limit, shared-list-invalid-leaf, data-self-reference-twice, spec-self-reference-twice, files-shared-list-beyond-node-limit, text-before-later-limit, limit-before-later-text); green: 12 of 12 cases passed for the rust binding, no rust R3 line, validity suite 47 of 47, input_text 56 of 56 and template_shape 44 of 44 pass.

### 2026-10-21 — The own symbols of the rust text units are closed (C16.156-1-2)

- C16.156-1-2 is closed; its Verification passes on 54b82580 (the eight text units run under their own symbols, with no rust R3 line). Its commit held the checklist at `[~]`; this entry records the closure (C16.156-1-2).

### 2026-10-21 — The Rust interface-messages test is named by its native id (C16.156-1-5)

- The Rust binding of interface-messages names its test by the native name that cargo reports, `messages::tests::embedded_messages_match_the_contract` (the test of `packages/generator/rust/src/messages/mod.rs`, in its `tests` module), in config/parity.json, so that the feature id matches the test that runs; the test itself is unchanged. `packages/generator/rust/src/tests.rs` is declared as an internal test file of the Rust generator in config/parity.json, since its remaining unit tests were covered only by the removed fixture binding (C16.156-1-5). Red: `make -s parity-check UNITS="interface-messages"` exit 1 on b79bf13d, the rust binding reported as not executed; green: exit 0 for the rust binding, 1 of 1 ids passed, no rust R3 line, and `make -s parity-declarations-check` reports no rust finding.

### 2026-10-21 — The Rust outline fixture runs as an integration test with one trial per case (C16.156-1-4)

- The outline fixture test of the Rust generator moves from the library unit tests (`packages/generator/rust/src/tests.rs`, `native_outline_fixture`) to the integration test `packages/generator/rust/tests/form_outline.rs`, a `harness = false` target in `packages/generator/rust/Cargo.toml`, with one trial per case named `native_outline_fixture::<case>`; the binding of form-outline in config/parity.json points at it. The check of each case is unchanged, and the other unit tests of `src/tests.rs` stay (C16.156-1-4). Red: `make -s parity-check UNITS="form-outline"` exit 1 on 54b82580, the rust binding reports not executed for its five cases; green: exit 0 for the rust binding, 5 of 5 cases passed, no rust R3 line.

### 2026-10-21 — The eight Rust text units each run under their own symbol (C16.156-1-2)

- The Rust bindings of the eight text units give each unit its own symbol, so that each binding's filter selects only its unit's trials: the validate trio (validate, validateList, validateDetail) runs under `input_text_validate`, `input_text_validate_list` and `input_text_validate_detail` (`packages/validator/rust/tests/text_validity_conformance.rs`, one trial per case of each family, named `<symbol>::<case>`), and the five text-form units run under `text_compile_form`, `text_bind_form`, `text_create_form`, `text_build_list` and `text_build_detail` (`packages/generator/rust/tests/input_text.rs`). The eight `symbol` entries of config/parity.json name them. `text_validity_conformance.rs` becomes a `harness = false` target in `packages/validator/rust/Cargo.toml`; its unit tests (json_text_* and value_graph_limits) stay as trials, and the assertions are unchanged (C16.156-1-2). Red: `make -s parity-check UNITS="text-validity-validate text-validity-validate-list text-validity-validate-detail text-compile-form text-bind-form text-create-form text-build-list text-build-detail"` exit 2, every rust binding of those units reports `not executed` (or "not in the suite" for the shared symbols); green: exit 0 with no rust R3 line, 21/21, 6/6, 5/5, 7/7, 17/17, 15/15, 11/11, 6/6 cases passed.

### 2026-10-21 — The Rust bindings of seven units report each case by name (C16.156-1-1)

- The Rust bindings of list-validity, detail-validity, spec-validity and compose (`packages/validator/rust/tests/list_validity_conformance.rs`, `detail_validity_conformance.rs`, `spec_validity_conformance.rs`, `compose_conformance.rs`) and of form-complete, list-render and detail-render (`packages/generator/rust/tests/form_complete.rs`, `list_render.rs`, `detail_render.rs`) run one libtest-mimic trial per fixture case, named `<symbol>::<case>`; the `[[test]]` targets of the two `Cargo.toml` files are `harness = false`. The case checks are unchanged (C16.156-1-1). Red: `make -s parity-check UNITS="list-validity detail-validity spec-validity compose form-complete list-render detail-render"` exit 2 with a rust R3 not-executed line for each of the seven units; green: the same command has no rust R3 line and every rust case passes (list-validity 20/20, detail-validity 13/13, spec-validity 34/34, compose 20/20, form-complete 28/28, list-render 165/165, detail-render 68/68).

### 2026-10-21 — The Rust bindings of five units report each case by name (C16.156)

- The Rust bindings of the units buttons, validate, form-render, form-view and expr run each fixture case as its own test named `<symbol>::<case>`, so `make parity-check` reads the case names: `packages/validator/rust/tests/validate_conformance.rs` and `expr_conformance.rs` (the unit checks of expr too), `packages/generator/rust/tests/form_state.rs` (also the form-history, form-actions and view-functions symbols of that file), `form_render.rs` and `buttons.rs` use `libtest-mimic` with `harness = false` in their `Cargo.toml` (`[[test]]` targets; the validator crate gets `libtest-mimic` 0.8.2 as dev-dependency, the version the generator lock resolves, and `packages/validator/rust/Cargo.lock` adds only its transitive packages). The assertions are unchanged (C16.156). Red: `make -s parity-check UNITS="buttons validate form-render form-view expr"` exit 2, R3 `not-executed` for rust in validate (341 cases), form-view (3), form-render (201), buttons (22) and expr (74); green: exit 0, every rust binding of the five units passes all its cases (341/341, 3/3, 201/201, 22/22, 74/74) and no rust R3 line remains.

### 2026-10-21 — The composition and expression part of CURP-001 is cited (C16.150-1)

- The units `compose` and `expr`, which landed after C16.150 was written, cite CURP-001 (C16.150-1): the case `ref-inherit-base` of `tests/fixtures/compose/cases.json` and the case `path-sibling-truthy` of `tests/fixtures/expr/cases.json` name it, written by their generators (`packages/validator/ts/scripts/generate-compose-cases.mts` and `generate-expr-cases.mts` take the extra `requirements` of a case), and the fixture READMEs say so. CURP-001 is now cited for all four capabilities. Red: the Verification exit 1 on 1fe05704; green: exit 0 (both generators reproduce their fixtures, and both units and one case each name CURP-001).

### 2026-10-21 — The php record server runs the php-fpm of the PHP that built its modules (C16.62)

- `examples/form-comparison/servers/php/main.mjs` starts the php-fpm of the PHP that built the modules (the `php-config` of `var/tools/bin`, the PHP of `.php-version`) from the `sbin` of its installation, in `phpFpmPath()`, instead of `php-fpm` from PATH; a missing php-fpm fails with the path it looked for (C16.62). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH node node_modules/@polyspec/kit/dist/run-tests.mjs node -- examples/form-comparison/record-stores.test.mjs` exit 1, 104 passed, 26 failed; the php-ext store fails with "ordered_json: Unable to initialize module" because the php-fpm on PATH (`/opt/homebrew/sbin/php-fpm`, PHP 8.5) loads modules built for API 20240924 of PHP 8.4; green: exit 0, 130 passed, 0 failed.

### 2026-10-21 — The generator tests that no binding runs have a place (C16.155)

- The six generator test files that no binding ran are declared in `config/parity.json`: five TypeScript files as internal tests of the `ts` implementation and one PHP file as an internal test of the `php` implementation (C16.155). No test file changed, and no file is bound, because each file's cases are either a browser runtime behaviour, an internal helper, or a second test of a contract whose suite already has a binding in its implementation.

| File | Decision | Reason |
|---|---|---|
| packages/generator/ts/src/display-validity.test.ts | internal (ts) | render acceptance of the list-validity and detail-validity cases through buildList and buildDetail; the validator bindings of those suites run the same cases |
| packages/generator/ts/src/dom-sync.test.ts | internal (ts) | browser runtime: connectForm writes the server render values into live controls; no README section documents it yet (docs/spec/form-runtime.md) |
| packages/generator/ts/src/expr.test.ts | internal (ts) | evalAppearance, evalShow and evalFlag are TypeScript helpers; the expression language is tested by the shared expr suite |
| packages/generator/ts/src/form.test.ts | internal (ts) | TypeScript form API and its declaration messages; the row contract is tested by form-actions and form-view through form-state.test.ts |
| packages/generator/ts/src/patch.test.ts | internal (ts) | browser runtime documented in packages/html/README.md (Keeping controls across re-renders, Scripts in rendered markup) |
| packages/generator/php/tests/Internal/InterfaceMessagesTest.php | internal (php) | the generated PHP source equals the output of its generator script; the message contract is the interface-messages unit |

Red: `make item-red ID=C16.155 BEFORE=69bd6b3b` exit 1 with the six `R5 undeclared-test` lines of the files above; green: the Verification exits 0, the six lines are gone, no line appears, and the findings of `make parity-declarations-check` go from 61 to 55.
### 2026-10-21 — CUDF-003 is cited whole by the list-render case whose markup shows the display (C16.153)

- `tests/fixtures/list-render/generate.mts` cites CUDF-003 on the case `format-number`, whose column is formatted (raw `1234567.5` is written as `$1,234,567.50`), so its markup shows that the renderer wrote the display and not the record (C16.153); `tests/fixtures/list-render/cases.json` gets the one requirement, and `config/parity.json` cites CUDF-003 in the list-render unit. Red: `make item-red ID=C16.153` exit 0, the Verification fails on aee613a9 with the R13 line `untraced-requirement: docs/spec/display-formats.md defines CUDF-003`; green: the six list-render runners pass the fixture (TypeScript `list-conformance.test.ts`, Go `TestListRenderSuite` 166 passed, Python `test_render.py` 3 passed, Rust `list_render` 1 passed, PHP and PHP extension `ListRenderConformanceTest` 166 tests OK), and `make -s parity-declarations-check` loses only the CUDF-003 line (60 findings before, 59 after).

### 2026-10-21 — CURP-025 is cited whole by a form-actions case that the six runners pass (C16.152)

- `tests/fixtures/form-state/generate.mts` adds the session `record-keeps-member-order-and-distinct-empty-values` (CURP-025, C16.152): a `setData` whose members and rows are not in the order of the spec, with an absent `members`, an empty object, an empty array (refused), a null value and a later edit. The case shows each clause of CURP-025: the member order is kept (the runners compare the JSON text of the data), arrays stay arrays (a list is refused), absent, null, `{}` and `[]` stay distinct, and no identity or order field appears in the data. `tests/fixtures/form-actions/cases.json` is regenerated, and `config/parity.json` cites CURP-025 in the form-actions unit. Red: `make item-red ID=C16.152` exit 0, the Verification fails on 907530ff with the R13 line `untraced-requirement: docs/spec/runtime-packages.md defines CURP-025`; green: the TypeScript (`src/form-state.test.ts`, 39 passed), Go (`TestFormActions`, ok), Python (`tests/test_form_state.py`, 4 passed), Rust (`--test form_state`, 4 passed), PHP (`FormStateTest`, 39 tests OK) and PHP extension (`make test-php-ext CASES="FormStateTest"`, 39 tests OK) runners pass; `make -s parity-declarations-check` loses the CURP-025 line and no other line (61 findings before, 60 after).

### 2026-10-21 — The form-view and form-history cases equal their generator (C16.154)

- `tests/fixtures/form-state/generate.mts` cites CUMK-057 by the three view sessions and CUMK-061 by the four history sessions, the citations that main had written by hand into `tests/fixtures/form-view/cases.json` and `tests/fixtures/form-history/cases.json`; `session()` writes the `requirements` of each case sorted, as main lists them, so a regeneration reproduces the files of main (C16.154). The requirement order of `set-data-restarts-history-and-view` and of the cases of `tests/fixtures/form-actions/cases.json` changes; their content does not. Red: `sh -c 'node tests/fixtures/form-state/generate.mts && git diff --exit-code -- tests/fixtures/form-view/cases.json tests/fixtures/form-history/cases.json tests/fixtures/form-actions/cases.json'` exit 1, the regeneration drops CUMK-061 from four cases of form-history and reorders the requirements; green: exit 0 on the regenerated files, and `make -s parity-declarations-check` prints the same lines as before the change.

### 2026-10-21 — The browser binding item moves to the form binding package (C16.151)

- `docs/spec/runtime-packages.md` and its Korean twin: CURP-023 (browser binding applies user input and row actions; server runtimes do not implement browser focus, selection or scroll behavior) leaves the numbered list of CURP-019 to CURP-022, which now has four items, and is linked from the spec to the "Browser validation" section of `packages/form-binding/README.md` (C16.151). Its English and Korean text is kept verbatim in `packages/form-binding/README.md` and `README.ko.md`, and the id is removed from both documents. Path 2: the only runtime with a browser binding is the TypeScript form binding package.
- Tests: no test is declared internal. `packages/form-binding` is a tools root of `config/parity.json` (ecosystem), not a root of the `ts` implementation, so the kit rejects an internal glob that names its tests ("lies outside the roots of ts"), and those tests cite no requirement id; the focus tests of `packages/form-binding/tests/binding.test.ts` and `browser.test.ts` are outside the parity contract (C16.151).

| Id | Path | Reason |
| --- | --- | --- |
| CURP-023 | 2 (one runtime by nature) | only the TypeScript browser runtime (`packages/form-binding`) applies user input and row actions in a browser; server runtimes have no browser focus, selection or scroll behavior |

Red: `sh -c 'make -s parity-declarations-check > var/pd-C16.151.log 2>&1; ! grep -E "R13 untraced-requirement: .* defines CURP-023," var/pd-C16.151.log'` exit 1, one R13 line for CURP-023, 56 findings (on 9ec2ffc4); green: exit 0, no CURP-023 line, 55 findings, the only line that disappeared; `check-documents` passes; `make lint-ts` exit 0 (C16.151).

### 2026-10-21 — Six runtimes provide the runtime capabilities of one neutral item (C16.150)

- `docs/spec/runtime-packages.md` and its Korean twin: the five items CURP-001 to CURP-005, one per implementation with the same four capabilities, become one neutral CURP-001 that every implementation provides (JavaScript/TypeScript, PHP library, PHP native extension, Go, Rust and Python); CURP-002 to CURP-005 are removed, and the paragraph before the list says that a server language renders forms without another runtime (C16.150). Path 1 for every removed id: each implementation has the four capabilities in its own form (Python through packages/generator/python and packages/validator/python). CURP-001 is cited by the suite units `text-compile-form` (case `pass-paired-surrogates`), `text-bind-form` (`pass-paired-surrogates`), `form-render` (`group-nested-properties`), `list-render` (`basic-columns`), `detail-render` (`basic-fields`) and `validate` (`property-member-order`), and each of these cases lists it in `requirements`; the generators `tests/fixtures/list-render/generate.mts`, `tests/fixtures/detail-render/generate.mts`, `packages/react/scripts/generate-form-render-cases.mts` and `tests/fixtures/validate/generate.mts` carry the ids of those cases. `tests/fixtures/validate/cases.json` is edited by hand for that one id, because the generator does not reproduce that file (its case `expression-scalar-equals-array-is-false` is not generated).
- Composition and expressions are not cited yet: no compose or expression unit is on main. The compose and expression units cite CURP-001 when they land; the integrator adds it to them then (C16.150).

| Id | Path | Reason |
| --- | --- | --- |
| CURP-001 to CURP-005 | 1 (native integration) | every implementation has the same four capabilities in its own form, so one neutral item replaces the five per-implementation items |

Red: `sh -c 'make -s parity-declarations-check > var/pd-C16.150.log 2>&1; ! grep -E "R13 untraced-requirement: .* defines CURP-00[1-5]," var/pd-C16.150.log'` exit 1, five R13 lines (CURP-001 to CURP-005 defined and cited by no unit), 61 findings; green: exit 0, no line with CURP-001 to CURP-005 remains, 56 findings, and `check-documents` passes (C16.150).
### 2026-10-21 — Duplication is 0: the last ten clones of make duplication-check are shared (C16.58)

- The ten clones that `make duplication-check` reported on main are gone (C16.58): the Go number text of the form-comparison server uses `validate.CanonicalNumber` (C16.58-25); the PHP record store parses number text with NumberValue (C16.58-26); the TypeScript adapters take mountView and hydrateView from view-entries.ts (C16.58-27); the C expression values share their parse and release steps (C16.58-28); the C row view operations share one list copy (C16.58-29); the React collection scenarios share their spec (C16.58-30). Red: `make duplication-check` exit 2 with 10 clones on 69bd6b3b (item-red BEFORE, exit 0); green: `make duplication-check` exit 0 on this commit, `make lint-go`, `make lint-php`, `make lint-ts` and `make lint-php-ext` pass.

### 2026-10-21 — The React form render scenarios share the spec of the two collection cases (C16.58-30)

- packages/react/scripts/scenario-form-render-cases.ts: `collectionShownByVisible` states the spec of the collection that a `visible` member shows or hides, and the cases `collection-shown-by-condition` and `collection-hidden-by-condition` take it as their `spec` (C16.58-30). The fixture tests/fixtures/form-render/cases.json is unchanged by the generator. Red: `make duplication-check` lists scenario-form-render-cases.ts [394:81 - 402:21] = [407:119 - 415:21] (item-red exit 0, the grep of the Verification fails on main); green: that grep exit 0, the generator leaves cases.json unchanged (`git diff --exit-code`, exit 0), `make lint-ts` 0 errors.

### 2026-10-21 — The C row view operations toggle and remove rows through one list copy (C16.58-29)

- packages/php-ext/src/view.c: `rows_without` copies the collapsed rows and leaves out those a predicate names (`drops_same_row` for the toggle, `drops_row_inside` for the removal), so `ps_toggle_row_view` and `ps_remove_row_view` share the copy (C16.58-29). The toggle still appends the row when it was not in the list, and the failures are unchanged. Red: `make duplication-check` lists view.c [144:29 - 150:39] = [177:29 - 183:39] (item-red exit 0, the grep of the Verification fails on main); green: that grep exit 0, `make test-php-ext` with the CASES of the row 544 passed (FormStateTest covers both operations).

### 2026-10-21 — The C expression values share the parse and release steps (C16.58-28)

- packages/php-ext/src/expression.c: `parsed_source` holds the tokens and the tree of an expression; `parse_source` returns it and `free_parsed_source` releases it, so `ps_expression_value` and `ps_expression_truth` share their parse and release steps (C16.58-28). Red: `make duplication-check` lists expression.c [750:30 - 756:66] = [761:25 - 767:66] (item-red exit 0, the grep of the Verification fails on main); green: that grep exit 0, `make test-php-ext` with the CASES of the row 544 passed. The CASES of the Verification use `|` as the alternation: the escaped `\|` of the earlier sub-rows selects no test in this runner.

### 2026-10-21 — The TypeScript form-comparison adapters take mountView and hydrateView from one module (C16.58-27)

- New examples/form-comparison/src/adapters/view-entries.ts: `viewEntries(start)` returns the typed `mountView` and `hydrateView` over one start function, so the signatures are stated once, by type (C16.58-27). The eight adapters (bind-form and create-form for html, svelte, vue and react) replace their copies of the two export functions with `export const { mountView, hydrateView } = viewEntries(start);`. adapter-completion.test.mjs no longer matches the copied signatures in the adapter sources: it checks that each adapter imports viewEntries from ./view-entries.ts and exports mountView and hydrateView from it, which tsc checks through the type. This changes what the test checks; the adapter behaviour is unchanged. Red: `make duplication-check` lists the clones of bind-form-html.ts, create-form-html.ts and the svelte and vue adapters (item-red exit 0, the grep of the Verification fails on main); green: that grep exit 0, adapter-completion.test.mjs 3 passed, svelte-dispose.test.mjs 2 passed, `make lint-ts` 0 errors.

### 2026-10-21 — The PHP form-comparison record store parses number text with the validator's NumberValue (C16.58-26)

- `RecordStore::number` of examples/form-comparison/servers/php/src/RecordStore.php calls `Polyspec\Crudui\Validator\Support\NumberValue::parseString` instead of its own copy of the radix rounding (C16.58-26). The literal `Infinity`, `+Infinity` and `-Infinity` keep the message `Expected a number` of the copy, which NumberValue reads as infinite numbers; a non-finite number of another text keeps `Expected a finite number`. Behaviour is unchanged: 9038 inputs of var/php-number-compare.php give the same results before and after. The Go and Rust record servers answer those literals with `Expected a finite score` and the TypeScript server accepts them, so the PHP messages are not aligned with them in this change. Red: `make duplication-check` lists the clone RecordStore.php [150-156] = NumberValue.php [28-34] (item-red exit 0, the grep of the Verification fails on main); green: that grep exit 0, `make duplication-check` finds 8 clones, the phpunit tests FormShapeTest and FormJsonTest 2 passed, NumberValueTest 20 passed; `make lint-php` exit 0.

### 2026-10-21 — The Go form-comparison server writes numbers with the validator's canonical number text (C16.58-25)

- The Go validator exports `CanonicalNumber` (packages/validator/go/validator/validate): the former unexported `canonicalNumber` of value_text.go, renamed with its call sites in value_number.go, rules.go and rule_length.go; value_test.go now calls the exported name, so the test of the public helper stands in the library (C16.58-25). The form-comparison Go server drops its copy of the same algorithm (`numberText` and `abs` of json.go) and calls `validate.CanonicalNumber` in json.go, records.go and records_test.go. Red: `make duplication-check` exit 2 with 10 clones, the go clone json.go [179-193] = value_text.go [59-73] among them; the example tests (11 passed) and `TestCanonicalNumber|TestCanonicalText` of the validator exit 0 before the change; after the rename the test built with `undefined: CanonicalNumber`. Green: the same tests exit 0 (validator 2 passed, example 11 passed), `make lint-go` 0 issues, and the go clone is gone from `make duplication-check`.

### 2026-10-21 — make install of a fresh worktree runs to its end (C16.149)

- `crudui-install` of the Makefile runs `install-link` after `crudui-install-python` and `crudui-install-composer` and before `crudui-install-phpdocumentor` (C16.149). composer install writes `vendor/composer/platform_check.php` from the tracked `composer.lock`, which demands PHP 8.5 for the released polyspec/ordered-json 0.0.9, and the link that writes the check for the PHP 8.4.1 of `.php-version` ran only at the end of `make install`, so `make worktree-setup` stopped at phpDocumentor with "Composer detected issues in your platform". Red: the order check of `make -n crudui-install` exit 1 on 379832f3; green: exit 0, and `make install-link` then `make crudui-install-phpdocumentor` install phpDocumentor 3.10.0 in the worktree.

### 2026-10-21 — The remaining compose and expression tests of the validators have a place (C16.57-3-3)

- The six test files that the parity check reported as no binding and no internal entry get one (`config/parity.json`). The TypeScript `packages/validator/ts/src/compose/patch.test.ts` and `ref.test.ts`, the PHP `packages/validator/php/tests/Compose/PatchTest.php` and `RefTest.php`, and the Go `packages/validator/go/validator/compose/order_test.go`, `expr/engine_test.go` and `expr/recognize_test.go` test rules of one implementation's own functions (applyPatch, the Patch and Ref classes, the ordered map, the condition map and the recognizer), which the shared compose and expr suites check only through their cases; each is an `internal` entry with its reason (C16.57-3-3). Red: `make -s parity-declarations-check` reported the six files as R5 undeclared-test (the red record has 18 R5 lines in all, six of them these files); green: no R5 line of these files remains, and the owner tests pass (vitest 23, phpunit 24, go -run of the compose and expr packages).

### 2026-10-21 — The composition suite is declared and bound in the six implementations (C16.57-3-2)

- The composition fixture `tests/fixtures/compose/cases.json` is the suite unit `compose`, bound in ts, php, go, rust, python and php-extension (`config/parity.json`). Each case names the requirement CUSC-007 of `docs/spec/schema.md`: the generator `packages/validator/ts/scripts/generate-compose-cases.mts` writes `requirements` into every case, and the fixture is regenerated (only the added keys differ). The TypeScript binding `packages/validator/ts/src/compose.conformance.test.ts` runs each case as a top-level test named by the case, so the parity check reads the cases by name (C16.57-3-2). Red: `make -s parity-declarations-check` exit 1 with `R4 undeclared-suite tests/fixtures/compose/cases.json`; green: that line is gone, and the six binding commands pass (vitest 20, phpunit 20, go 21, cargo 1, python 4, node 20 of 20 cases).

### 2026-10-21 — The expression suite runs in the C engine of the PHP extension (C16.57-3-1)

- The C engine of the PHP extension is bound to the expr suite with the node runner (K422). `packages/php-ext/tests/contract/expr.test.mjs` compiles the engine sources once and reports each case of `tests/fixtures/expr/cases.json` as a test of its own; the expression and composition contract tests move out of `packages/php-ext/tests/engine/engine.test.mjs` into `packages/php-ext/tests/contract/` (the composition file is bound by C16.57-3-2), and `config/parity.json` adds the binding of unit `expr` and the contract glob (C16.57-3-1). Red: `make -s parity-declarations-check` exit 1 with `R2 missing-binding expr php-extension`; green: that check prints no R2 line for expr, and `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- packages/php-ext/tests/contract/expr.test.mjs` passes 74 of 74 cases.

### 2026-10-21 — CURT-055 is cited by the session that covers it whole; CURT-054 is withdrawn from the form state citation (C16.146-1)

Corrects the citations of C16.146. A case is cited only for a requirement it tests whole.

- CURT-055 (reject invalid operations atomically; permit adding after deleting all rows) is now cited by `delete-every-row-then-add-one-with-min-zero` (form-actions): with no minimum row count an unknown row fails and changes nothing, every row is deleted, and adding one row gives a row with empty values. The earlier `invalid-removal-leaves-data-and-adding-continues` session keeps its cases but no longer cites CURT-055, because its shared minimum of one team means it cannot delete every row.
- CURT-054 (apply a saved sequence key and update field names and rule paths) is withdrawn from the citation and from the form-actions unit. The session `rekey-moves-the-edits-to-the-new-keys` observes the data after a rekey, but the form state format observes no rule path: its observations hold results, errors, data, revisions, the undo flags and the collapsed rows, and no step lists the validation errors or the field paths. Observing them would need a new step in all six runners, so CURT-054 is reported as untraced again.

The form state runners of all six implementations pass once: TypeScript, Go, Python, Rust, PHP, the PHP extension and its engine test.

### 2026-10-21 — The form state sessions cite three acceptance criteria; the copy rule moves to the form comparison example (C16.146)

Decision table for the six acceptance criteria that C16.141 reported (CURT-050 to CURT-056):

| Requirement | Decision | Where | Reason |
| --- | --- | --- | --- |
| CURT-050 (prepare nested fields, serialize the template, bind independent records) | reported, still untraced | none | the sessions bind one record per instance and read no serialized template; a case needs a format that binds two records from one serialized template |
| CURT-052 (copy a store when its key equals its company key) | path 2 | `examples/form-comparison/README.md` (Copying a store), both languages | an acceptance of the form comparison example, not a library rule |
| CURT-053 (edit, reorder, remove and add rows without stale values) | cited | `edit-reorder-remove-and-add-rows-keep-no-stale-values` (form-actions) | the observed data shows each row with its own values and an added row starts empty |
| CURT-054 (apply a saved sequence key and update field names and rule paths) | cited | `rekey-moves-the-edits-to-the-new-keys` (form-actions) | the observed data shows the rekeyed row and member under the new keys and an edit under the new path; the session observes data, not the rule paths of the fields, so the rule-path part is not observed |
| CURT-055 (reject invalid operations atomically; permit adding after deleting all rows) | cited | `invalid-removal-leaves-data-and-adding-continues` (form-actions) | an unknown row and a removal below the minimum fail and leave the data unchanged; adding follows. The shared spec keeps one team as its minimum, so the session cannot delete every row |
| CURT-056 (the shared validation fixture cases through four languages, one idempotent signature) | path 2 (prose) | the spec, as an unnumbered paragraph | the test process, which no test checks as a requirement |

The added sessions are the only new cases: `tests/fixtures/form-actions/cases.json` grows by three, and no existing case
changes. The form-actions unit cites CURT-053, CURT-054 and CURT-055. Every runner of the form state suites passes once
(TypeScript, Go, Python, Rust, PHP, the PHP extension and its engine test).
### 2026-10-21 — Records bound from one serialized template are independent (C16.147)

- The template-shape fixture gets two cases that bind records from one serialized template: `create-two-records-from-serialized-template` and `create-three-records-independent`. The compiled template resolves a composition file (`$ref` in a repeated group) before any record exists, serializes to JSON, and each record is bound from that template alone, with no composition file given to the binding. Each record reads its own values; in the three-record case the third binding reads what the first one read. CURT-050 is cited on both cases and in the unit `template-shape`.
- All six runners run the two cases: the TypeScript, Go, Rust, PHP (with the extension) and Python runners compare the values that each binding reads with the expectation, which the TypeScript reference computed.

### 2026-10-21 — The form state validation observation is closed (C16.148)

- The stack C16.148 is complete: its six rows observe the validation errors in every form state runner and cite CURT-054 through the rekey session.

### 2026-10-21 — The form state sessions observe the validation errors, and CURT-054 is cited whole (C16.148)

- The six form state runners run a `validate` step that observes the validator's errors with their data paths. The rekey session of CURT-054 shows that the errors follow the new keys, and the form-actions unit cites CURT-054 through it.

### 2026-10-21 — CURT-054 is cited whole by the validation rekey session (C16.148-6)

- The form-actions unit cites CURT-054. The session `rekey-moves-validation-errors-to-the-new-paths` observes the validator's errors before a team and a member are rekeyed and after them, so the errors follow the new keys: the rule paths of the fields are observed as the data paths of the errors. The session runs in all six form state runners.
- This completes the C16.146 correction: CURT-054 is cited by a case that tests the requirement whole, not by the rekey session without observation that C16.146 cited.

### 2026-10-21 — The PHP form state test runs the validate step in the library and in the extension (C16.148-5)

- `packages/generator/php/tests/FormStateTest.php` runs the `validate` step of the form state sessions through `Validator::validate`: the validity and each error's data path, field name, rule and message are observed in the validator's order. The PHP library and the PHP extension run the same test.

### 2026-10-21 — The Rust form state runner runs the validate step (C16.148-4)

- `packages/generator/rust/tests/form_state.rs` runs the `validate` step of the form state sessions: the validator runs on the session's specification and the current record, and each error's path, field, rule and message is observed in the validator's order.

### 2026-10-21 — The Python form state runner runs the validate step (C16.148-3)

- `packages/generator/python/tests/test_form_state.py` runs the `validate` step of the form state sessions: the validator runs on the session's specification and the current record, and each error's path, field, rule and message is observed in the validator's order.

### 2026-10-21 — The Go form state runner runs the validate step (C16.148-2)

- `packages/generator/go/form_state_test.go` runs the `validate` step of the form state sessions: the validator runs on the session's specification and the current record (decoded into the map the validator reads), and each error's path, field, rule and message is observed in the validator's order.

### 2026-10-21 — The form state sessions observe the validation errors with their data paths (C16.148-1)

- `tests/fixtures/form-state/harness.mts` has a `validate` step: it runs the validator on the session's specification and the current data, and observes `valid` and each error's data path, field name, rule and message, in validator order.
- `tests/fixtures/form-state/generate.mts` adds `rekey-moves-validation-errors-to-the-new-paths` (CURT-054): a required member with no name is reported at its data path, and after its team and member are rekeyed the same error is reported at the new paths. Its citation of CURT-054 comes with the stack's last row.
- The other five form state runners do not implement the `validate` step yet; they are red until their rows of this stack land.

### 2026-10-21 — CUIT-041 has a Python entry (C16.140-2)

- The table of CUIT-041 gets a Python entry, which names the classes that the Python packages raise, checked in the sources: validation raises `ComposeLoadError` (`compose_errors.py`) for a load failure and `FormInputError` (`errors.py`) for an input failure; generation raises the same `ComposeLoadError` for a load failure, as the validator package does when it composes a specification, and `FormError` (`generator/errors.py`) for an input failure. The owner decided that the spec, not the runners, carried the gap: the Python runners already assert these types.

### 2026-10-21 — CUIT-041 keeps the meaning of the items it replaced (C16.140-1)

- CUIT-041 now states the table of the error types as its content: each implementation reports a load failure and an input failure with the error types that its entry names. The entries are the old items CUIT-032 to CUIT-036: JavaScript; PHP and the extension; Go, where generation reports an error with the message; and Rust, where a load failure is `ComposeLoadError` in `ValidateError::Load` or `FormError`, and an input failure is `FormInputError` in `ValidateError::Input` or `FormError`. The rule no longer says that the two failures are distinct types, which the old items did not say. The Rust generator reports `FormError` for both, as its entry allows; its runner names CUIT-041.

### 2026-10-21 — The error types of the input text are one requirement, CUIT-041, that every implementation asserts (C16.140)

- Path 1 (native integration) for CUIT-032 to CUIT-036: the five items named each language's error types, and they are rewritten once as CUIT-041, a load failure and an input failure are distinct error types of each implementation. The table of each language's types follows as a description; the old ids are gone from `docs/spec/input-text.md` and its Korean twin, and from every case and unit that cited them.
- Cases and units: the validate, validateList, validateDetail and value-graphs fixtures and the four validator units cite CUIT-041 in place of CUIT-032, CUIT-033 and CUIT-035.
- Runners (each asserts the native class of every failure, and passes): the TypeScript validator and generator (`ComposeLoadError`, `FormInputError`); the PHP validator and generator and the PHP extension (`ComposeLoadError`, `FormInputError` in validation and `FormError` in generation); the Go validator (`*compose.ComposeLoadError`, `*FormInputError`) and generator (the load type of invalid text); the Rust validator (`ValidateError::Load`, `ValidateError::Input`); the Python validator (`ComposeLoadError`, `FormInputError`) and generator (`FormError` in generation).
- Rust generator: unchanged, and not fulfilled. Its generation operations return `FormError` for every failure, and the `From<ComposeLoadError>` impl keeps the load kind only in the code `INVALID_TEXT`, so a load failure and an input failure are not distinct error types of the Rust generator. The neutral rule requires either a second error type for load failures or a documented exception; the owner decides which.

### 2026-10-21 — The untraced CUSC requirements have shared cases (C16.144)

Decision table for the eight untraced CUSC ids of `docs/spec/schema.md` (decision = the case that tests the sentence; each case is run by every runner of its suite):

| Requirement | Decision | Case (suite) | Why it tests the sentence |
|---|---|---|---|
| CUSC-005 behavior: event scripts kept without expression evaluation | cited | `behavior-opaque-passthrough` (form-render) | The `onchange` value is kept verbatim, and the expression engine is not applied to it. |
| CUSC-016 stacked: the label above the control | new | `stacked-layout-group` (form-render) | A group that declares `design.layout` stacked lays its label above its controls. |
| CUSC-022 an array of labels keeps the written order with indexes | cited | `choice-list-index-labels` (form-render) | Its items are an array of labels, kept in written order with the indexes as values. The sentence was already covered by this case. |
| CUSC-038 conditions by the expression parser, not JavaScript | new | `expression-scalar-equals-array-is-false`, `expression-zero-equals-empty-array-is-false` (validate) | `'a' == .tags` is false for `tags: ['a']` and `0 == .tags` is false for an empty array (docs/spec/expressions.md). JavaScript loose equality gives true for both, so the note is not required. |
| CUSC-039 language input values independent of the display language | new | `lang-values-keep-language-whatever-display` (form-render) | Each language input shows the value written for its language, whatever the display language. |
| CUSC-043 multiple.min and multiple.max | cited (max) and new (min) | `multiple-max-reached-disables-add` (cited, max); `multiple-min-reached-disables-remove` (new, min) | Both sides are covered, so CUSC-043 is cited on both cases. |
| CUSC-044 multiple.copy and multiple.sortable | cited | `multiple-settings-bucket` (form-render) | The move-up, move-down and copy-row controls are shown for `sortable` and `copy`. |
| CUSC-046 multiple.controls header, footer or outline | new | `multiple-controls-header`, `multiple-controls-footer`, `multiple-controls-outline` (form-render) | Each value places the row controls where the sentence says. |

The parity units `form-render` and `validate` list the ids. The generator table of `packages/react/scripts/generate-form-render-cases.mts` cites them, and `tests/fixtures/form-render/cases.json` is regenerated: the six new cases are added and the four cited cases gain `requirements` members only. The Go, Rust and Python form-render runners and the Python validate runner assert the new case counts (150 result cases, 201 cases; 202 result cases in validate). Red: `make item-red ID=C16.144` on a3ef53a5, the R13 grep for these ids fails before the fix.

Runs: each runner of the two suites was run once with its owner selection and exited 0. Validate: ts, php, php extension, go, rust, python. Form-render: ts, go, python, php, php extension, rust. Lint: `make lint-ts`, `lint-go`, `lint-rust` and `lint-python` on the changed languages.

### 2026-10-21 — The class naming, view-state and history requirements are cited by their cases (C16.145)

Decision table for the untraced CUMK ids (decision = the cases that test the requirement and cite it):

| Requirement | Decision | Cases that test it |
|---|---|---|
| CUMK-001 `crudui-{block}`, CUMK-002 `crudui-{block}__{element}`, CUMK-003 `crudui-{block}--{modifier}` (class naming) | cited | The 144 form-render cases whose expected markup carries the class names (all of them carry blocks, elements and modifiers). `packages/react/scripts/generate-form-render-cases.mts` lists them, and `tests/fixtures/form-render/cases.json` is regenerated with only the `requirements` members changed. The unit `form-render` lists the three ids. |
| CUMK-057 (expansion is view state, not record data) | cited | The three form-view cases: `toggle-row-collapses-and-expands`, `set-all-expanded-collapses-every-collapsible-row`, `row-removal-drops-and-rekey-moves-view`. The unit `form-view` lists the id. |
| CUMK-061 (undo records every data change and merges consecutive edits of one path) | cited | The four form-history cases: `undo-and-redo-restore-the-record`, `same-path-edits-share-one-record`, `a-change-after-undo-clears-redo`, `history-keeps-100-records`. The unit `form-history` lists the id. |

Red: `make item-red ID=C16.145` on a3ef53a5, the R13 grep for these ids fails before the fix. Green: the same grep is empty after the fix (the parity findings go from 115 to 77). `make lint-ts` passes. The TypeScript owner tests of form-render, form-view and form-history run on the changed fixtures.

### 2026-10-21 — The two schema requirements that state no check are prose (C16.143)

Decision table for the untraced CUSC ids of `docs/spec/schema.md` (path = where the text goes):

| Requirement | Decision | Reason |
|---|---|---|
| CUSC-037 (keep structure, content, validation, appearance and widget options separate) | prose, id removed | A design principle; no test can check it. It stays in the spec as a plain sentence. |
| CUSC-040 (compare shared validation cases in four languages and SSR output in three frameworks; verify editable form behavior with mounted views) | prose, id removed | Describes the test process; no test can check it. It stays in the spec as a plain sentence. |

The acceptance criteria keep CUSC-036, 038 and 039. The other untraced CUSC ids (005, 016, 022, 043, 044, 046) are reported in C16.144 rather than changed here. Red: `make item-red ID=C16.143` on 8eac4a0a, the R13 grep for `defines CUSC-037|CUSC-040` fails before the fix. Green: the same grep is empty after the fix. `make docs-check` passes.

### 2026-10-21 — The copies of kit name no check that only kit has (C16.139)

- `PRINCIPLES.md` and `PRINCIPLES.ko.md` are the copies of kit at 0.0.54 with K359-2 (`f9f80e60`, "Name no check that only kit has"): P10 no longer names `tests/kit/worktree-setup.test.mts`, which only kit holds, so `make rules-check` no longer reports that the file does not exist (C16.139). Red: `make rules-check` exit 2 on 0afab14d, `PRINCIPLES.md:44: tests/kit/worktree-setup.test.mts does not exist`. Green: `make rules-check`, `make kit-check`, `make layout-check` and `make link-state-check` exit 0.

### 2026-10-21 — The untraced form-markup requirements are placed or reported (C16.142)

Decision table for the 25 untraced CUMK ids of `docs/spec/form-markup.md` (path 1 = native integration, path 2 = one runtime by nature, moved to that package's documentation and cited by no unit):

| Requirement | Path | Where / reason |
|---|---|---|
| CUMK-039..055 (`--crudui-*` custom properties with defaults and uses) | 2 | `packages/generator/ts/README.md`. Only `packages/generator/ts/styles/crudui.css` defines them. |
| CUMK-056 (readiness and scroll sync, sticky headers once per animation frame) | 2 | `packages/generator/ts/README.md`. Only `packages/generator/ts/src/dom.ts` uses `requestAnimationFrame`. |
| CUMK-008 `crudui-outline`, CUMK-009 `crudui-data` (block markup) | 2 | `packages/html/README.md`. Only the TypeScript HTML renderer and its styles emit these blocks. |
| CUMK-001/002/003 (BEM class naming) | report | Every generator emits the BEM class names. This is an every-implementation contract that needs a shared case, not moved. |
| CUMK-057 (expansion is view state), CUMK-061 (undo records every data change) | report | View and history functions exist in every generator. This needs shared form-view and history-function fixtures, not moved. |

The spec keeps a pointer to each moved block. The moved text has no requirement id and stays in English and Korean. Red: `make parity-declarations-check` on 0afab14d, R13 `untraced-requirement` for the CUMK-039..056, 008 and 009 ids. Green: the R13 grep (`defines CUMK-039..056|CUMK-008|CUMK-009`) is empty. `make docs-check` and `make lint-ts` pass.
### 2026-10-21 — The browser runtime text leaves the spec for the packages that have the runtime (C16.141)

Decision table for the 35 untraced CURT requirements of docs/spec/form-runtime.md (path 2 is the one-runtime rule of the
scope brief: the text moves to the documentation of the package that has the runtime, is kept, and its id goes away; path
1, a native integration, applies to none of these):

| Requirement | Decision | Where the text is kept | Reason |
| --- | --- | --- | --- |
| CURT-026, CURT-027 (`message`, `formErrors` options) | path 2 | `packages/form-binding/README.md` (Browser validation) | the browser binding's options; a server runtime has no binding |
| CURT-028 to CURT-034 (`bindForm` binding errors) | path 2 | the same | errors of the browser binding only |
| CURT-035 to CURT-038 (control values read from the form) | path 2 | the same (Data) | reading the controls of a DOM form; no other runtime has a DOM |
| CURT-039 to CURT-042 (control name errors) | path 2 | the same (Data) | names of DOM controls, decoded as a browser submission sends them |
| CURT-043 to CURT-046 (validation timing, submit, focus, re-render) | path 2 | the same (Timing) | events of the browser; a server cannot receive them |
| CURT-047 to CURT-049 (scripts run once in rendered markup) | path 2 | `packages/html/README.md` (Scripts in rendered markup) | only a browser runs a script; the HTML renderer writes the markup |
| CURT-051 (mount each framework view before data) | path 2 | `packages/react`, `packages/vue`, `packages/svelte` README (Framework views) | framework views exist only in the TypeScript packages |
| CURT-057, CURT-058 (pointer, keyboard and native input events in framework views) | path 2 | the same (Framework views) | the same reason: framework event handling in the browser |
| CURT-059 (keep controls across re-renders; scripts once in Chromium, Firefox, WebKit) | path 2 | `packages/html/README.md` (Keeping controls across re-renders) | browser behaviour of the rendered markup |
| CURT-060 (bind a server-rendered form in the browser) | path 2 | `packages/form-binding/README.md` (Acceptance of the browser binding) | the browser binding's acceptance |
| CURT-050 (prepare nested fields, serialize the template, bind independent records) | reported | none | a contract of every implementation as written; needs shared cases |
| CURT-052 (copy a store when its key equals its company key) | reported | none | an acceptance example of the form comparison, not a rule of the library; the owner decides whether it is a requirement |
| CURT-053 (edit, reorder, remove and add rows without stale values) | reported | none | a contract of every implementation as written; the form state sessions test the row operations, and the citation needs a case row |
| CURT-054 (saved sequence key and rule paths) | reported | none | a contract of every implementation as written; needs cases of rekey and rule paths |
| CURT-055 (reject invalid operations atomically; add after deleting all rows) | reported | none | a contract of every implementation as written; needs cases of failing operations |
| CURT-056 (every shared validation case through four languages, one idempotent signature) | reported | none | a contract of every implementation as written; the validate suite already runs six runners |

The moved text keeps its wording without the requirement ids. The spec keeps one pointer per moved section, and the
`keyPrefix` option (CURT-025), which no moved id depends on, stays in the spec. No test cites a moved id: the browser tests
of `packages/form-binding` are in an ecosystem root that parity does not check, so their declaration is not needed.

### 2026-10-21 — The generated Go tables are declared generated-file exceptions (C16.136)

- `config/generated.json`: the exceptions `packages/generator/go/interface_messages.go` and `packages/validator/go/validator/validate/unicode_data.go` declare the two Go tables that `go generate` writes from `contracts/interface-messages.json` and `contracts/unicode-properties.json` (C16.136). A Go module ships them, because `go get` runs no generator (S6), so they are tracked on purpose. The other languages' generated tables carry no generated-file header, and so are not flagged. The schema allows globs only, so the reason is recorded here. Red: `make layout-check` exit 2 on 2bf1b1b5, `has a generated-file header (Code generated ... DO NOT EDIT)` for both files. Green: `make layout-check` exit 0, `no tracked file is generated`.

### 2026-10-21 — The PHP and Go generators assert the error type of each generation failure (C16.138)

- The PHP runner of the input text cases asserts that each generation failure is a `ComposeLoadError` for invalid text and a `FormError` for a refused input (CUIT-034); the PHP extension runs the same test. The Go runner asserts that a failure of invalid text is a `*compose.ComposeLoadError` and that no other failure is (CUIT-035). The Rust generator returns `FormError` for every generation failure, so its type is fixed by the signature; the Rust runner is unchanged.

### 2026-10-21 — The compiled templates of the form template shape cite CURP-019 and CURP-024 (C16.137)

- The `compiled` cases of `tests/fixtures/template-shape` cite CURP-024 (a template compiled by one runtime is bound by another) and CURP-019 (a compiled template serializes): the reference's serialized compiled template is bound by every runtime. The unit `template-shape` cites both ids; each runner names them.

### 2026-10-21 — The benchmark driver of the Go validator is a tools root (C16.126)

- `config/parity.json` declares `benchmarks` a tools root, the harness of the validator benchmarks, which times the validators and tests no contract. The Go test of its driver, `benchmarks/validators/go/main_test.go`, is no longer reported as a misplaced test (R6).

### 2026-10-21 — The build cases and the form state root case cite their runtime requirements (C16.57-16)
### 2026-10-21 — make install-link links the Python packages of the repository without a hand-set environment (C16.135)

- `Makefile`: `install-link` (kit's recipe, which runs `link.mjs link --siblings`) gets `UV_PROJECT_ENVIRONMENT := $(PYTHON_VENV)` as a target-specific export, the variable that kit's link reads for the Python environment (`link.mjs` line 563), so `make install` links the packages of `var/python` made by `crudui-install-python` (C16.135). Red: `env -u UV_PROJECT_ENVIRONMENT make install-link` exit 2, `NOT linked python ... no environment`. Green: the same command exit 0 and `make link-state-check` exit 0.
- The link state after the fresh `make install-packages` of C16.134 is restored by `make install-link` with `UV_PROJECT_ENVIRONMENT=$(PYTHON_VENV)`, which exits 0; `make link-state-check` exits 0 after it (C16.134).
- The buildList cases of `tests/fixtures/text-validity/buildList` (11 cases) cite CURP-014 (`buildList`), and the buildDetail cases of `tests/fixtures/text-validity/buildDetail` (6 cases) cite CURP-016 (`buildDetail`): every case runs its operation. The form state root case `set-data-rejects-a-root-that-is-not-an-object` cites CURP-026, since its list root is no object in PHP (the caller states the type, and the list fails explicitly).
- `tests/fixtures/form-actions/cases.json` is regenerated from its generator. Besides CURP-026, the session cases that the C16.57-14 generator already cites with CURP-020 now carry that id in the committed file. The units of `config/parity.json` cite the three ids.

### 2026-10-21 — make install-packages installs the svelte tools after its npm ci and links nothing (C16.134)

- Kit K428 (kit 76e340de) runs the targets of `INSTALL_PACKAGES_EXTRA` after the npm ci of `install-packages`; the `Makefile` sets `INSTALL_PACKAGES_EXTRA := crudui-install-svelte-tools`, and `make install` links after them through `install-link`. The svelte recipe no longer runs `make link` (and its `UV_PROJECT_ENVIRONMENT`), `crudui-install` no longer names `crudui-install-svelte-tools` (it stays only as an extra of `install-packages`), and the CI steps that C16.117 added (the Python install and the svelte step) are removed from the jobs, which now get the svelte tools from `make install-packages`. The copies of kit are synced from kit 0.0.54 (`make kit-sync`: `scripts/kit/kit-bootstrap.mk` with the extra targets, the `install-npm.mts` comment, and PRINCIPLES P10 and P36 to P38 of that kit). The test `install-packages installs the svelte tools after its npm ci and runs no link` of `tests/build/ci-local.test.mts` replaces C16.117's test (C16.134). Red: the new test fails on 03403a2f (the install-packages dry run names no svelte tools). Green: `make link-state-check` exit 0, the ci-local test 18 passed, `make kit-check` exit 0, and a fresh `make install-packages` in a fresh worktree exits 0 with the svelte tools installed.

### 2026-10-21 — The explicit empty collections are cited by the suites, and their unit test is internal (C16.57-17)

- `tests/fixtures/text-validity/bindForm/cases.json` gains eight rejections of collection data that is not a keyed object (an array, a list of text, null or text, for a repeated group and a repeated scalar): `INVALID_FORM_INPUT`, `Repeated data must be a keyed object: items` (CUEC-003). All six bindForm runners pass them.
- `tests/fixtures/form-state/generate.mts` gains `visibility-hides-and-shows-rows-without-changing-data`: a show condition hides and shows a repeated collection, and the observed data stays the same after every step (CUEC-006). `tests/fixtures/form-render/cases.json` gains `collection-shown-by-condition` and `collection-hidden-by-condition` (CUEC-006), and `scalar-multiple-empty-object-has-no-rows` (CUEC-001, CUEC-004) with the nested sibling case of the previous row. The runners count the new cases.
- `packages/generator/ts/src/empty-collections.test.ts` is declared internal of ts: every assertion of the file is now the behaviour of a cited case in form-render, form-actions and text-bind-form.

### 2026-10-21 — The form render cases cite the explicit empty collections of nested rows (C16.57-17)

- `tests/fixtures/form-render/cases.json` gains two cases through `packages/react/scripts/scenario-form-render-cases.ts`, rendered by the React reference: `nested-empty-collections-keep-sibling-order` (explicit empty nested collections, sibling rows keep their keys and data order; CUEC-001, CURP-027) and `scalar-multiple-empty-object-has-no-rows` (an explicit empty object for a repeated scalar gives zero rows; CUEC-001, CUEC-004). The Go, Python and Rust runners count the new result cases; `config/parity.json` cites CURP-027 in the form-render unit.
- `packages/generator/ts/src/empty-collections.test.ts` stays undeclared: its non-keyed `bindForm` rejection (CUEC-003) and the visibility assertion that keeps the data unchanged (CUEC-006) have no cited case, so the file is not yet declared internal.

### 2026-10-21 — The form template shape is a suite unit of six generators (C16.133)

- `config/parity.json` declares the suite unit `template-shape` over `tests/fixtures/template-shape`, citing CURT-092, bound in the TypeScript, Go, Rust, PHP, PHP extension and Python generators.
- `packages/generator/ts/src/decode-template.test.ts` is internal to TypeScript: the JSON Pointers of `decodeFormTemplate` are a TypeScript API, so no other implementation checks them. The Go test of the shape is now a binding and no longer internal.

### 2026-10-21 — The Python generator runs every case of the template shape fixture (C16.132)

- `packages/generator/python/tests/test_template_shape.py` runs each case of `tests/fixtures/template-shape` through `Generator.bindForm`, `Generator.bindButtons` or `Generator.createForm`, one subtest per case; it asserts the 42 cases. A refusal must be the `FormError` with the code, the message and the empty location that the case records.

### 2026-10-21 — The PHP generator and its extension run every case of the template shape fixture (C16.131)

- `packages/generator/php/tests/TemplateShapeTest.php` runs each case of `tests/fixtures/template-shape` through `Generator::bindForm`, `Generator::bindButtons` or `Form`, one PHPUnit case per fixture case; it asserts the 42 cases. It passes under the PHP extension (`make test-php-ext CASES=TemplateShapeTest`).

### 2026-10-21 — The Rust generator runs every case of the template shape fixture (C16.130)

- `packages/generator/rust/tests/template_shape.rs` decodes each case's template with `FormTemplate::from_json` and runs its `bindForm`, `bindButtons` or `createForm` operation, one trial per case of `tests/fixtures/template-shape`; the test asserts the 42 cases. The inline table of shape violations in `src/tests.rs` is gone; a round-trip test of the declared and compiled templates remains.

### 2026-10-21 — The Go generator runs every case of the template shape fixture (C16.129)

- `packages/generator/go/template_shape_test.go` decodes each case's template with the Go decoder and runs its `bindForm`, `bindButtons` or `createForm` operation, one subtest per case of `tests/fixtures/template-shape`; the test asserts the 42 cases. Its inline table is gone; the widget member order test remains.

### 2026-10-21 — The TypeScript generator runs every case of the template shape fixture (C16.128)

- `packages/generator/ts/src/template-shape.test.ts` runs each case of `tests/fixtures/template-shape` through `bindForm`, `bindButtons` and `createForm`: a case that passes must not throw, and a refusal must be a `FormInputError` with the code, the message and the empty location that the case states. Its inline table of shape violations is gone; the widget member order and the two checks of the button type and the absent member remain.

### 2026-10-21 — The form template shape is requirement CURT-092 (C16.127)

- `docs/spec/form-runtime.md` states the shape that `bindForm`, `bindButtons` and `createForm` accept as the requirement CURT-092; its Korean twin states the same rule.
- `tests/fixtures/template-shape` holds 42 cases generated by the TypeScript reference: for each of the three operations, a compiled template, a template with the optional members, and each of the twelve shape violations refused with `INVALID_FORM_INPUT`, `Unsupported form template` and an empty location.

### 2026-10-21 — The PHP extension's API test is internal to it (C16.126-1)

- `config/parity.json` declares `packages/php-ext/tests/ApiTest.php` internal to php-extension. Its API-equality test and its value-limit test check what only PHP has: the extension's API report against the library's, and a recursive PHP array that the extension must refuse. Its fixture comparison is covered by the validate and text-validity units. The check no longer reports the file as R5 undeclared-test.

### 2026-10-21 — A fresh make install-packages no longer runs the link (C16.117)

- `make install-packages` only installs (kit K246-2): the Makefile no longer makes `crudui-install-svelte-tools` its prerequisite, which ran before kit's `npm ci` in a fresh worktree and failed on the missing `node_modules/@polyspec/kit` (C16.117). `crudui-install-svelte-tools` installs the svelte tools and links after that install, and `crudui-install` runs it after `install-kit`, `crudui-install-composer` and `crudui-install-python`, since kit's link needs the Python environment of `var/python`; the link passes `UV_PROJECT_ENVIRONMENT=$(PYTHON_VENV)` to `make link`. The CI jobs that ran `make install-packages` now run `make crudui-install-python` and then `make crudui-install-svelte-tools` (the `ci-passed` job runs neither), which costs one Python install per such job. Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/ci-local.test.mts` exit 1, the new test `install-packages only installs; the svelte tools link after their install` fails, its dry run of install-packages names the link. Green: `make link-state-check` exit 0 and the same ci-local test 18 passed.

### 2026-10-21 — The runtime requirements that the suites test are cited by their cases (C16.57-14)

- The render and outline families cite the runtime operations that their cases run: `tests/fixtures/form-complete` cites CURP-013 (`renderForm`), `tests/fixtures/list-render` CURP-015 (`renderList`), `tests/fixtures/detail-render` CURP-017 (`renderDetail`), and `tests/fixtures/form-outline` CURP-006 (`compileForm`), CURP-007 (`bindForm`) and CURP-021 (binding evaluates the fields against the record). The form state sessions (`form-view`, `form-history`, `form-actions`) cite CURP-020, since each session creates an instance that owns its record and row operations. The units of `config/parity.json` cite the same ids.
- Every runner of the extended suites passes once: the TypeScript, Go, Python, Rust and PHP library runners, and the PHP extension runner.
- Still uncited, with the reason for each. CURP-001 to CURP-005 are the per-language rows that name four capabilities each: the validation and composition parts are run by the validate suite, but no single suite runs all capabilities in all five runtimes, and the ruling on per-capability citation decides them. CURP-008 and CURP-009 (`bindButtons`, `formButtonsHtml`): no suite runs them, and adding them means a new operation in six runners. CURP-014 and CURP-016 (`buildList`, `buildDetail`): only the text-validity cases run them, and those files wait for C16.111. CURP-019 (a compiled template serializes and caches): no suite compares the compile output as serialized text. CURP-023 (browser binding): only the JavaScript browser runtime has it, so it is a single-implementation requirement and waits for the ruling. CURP-024 (a template compiled by one runtime is bound by another): no suite binds a template that another runtime compiled, and it waits for C16.111. CURP-025 (ordered JSON transport): the procedure is tested in the ordered-json repository. CURP-026 (the PHP array is an object or a list): cited by the PHP root case of the form state sessions when the errors branch (C16.57-13) lands on main.

### 2026-10-21 — The Python validator binds the value-graph cases of the text-validity fixtures (C16.57-15-1)

- `config/parity.json`: the unit `text-validity-value-graphs` binds the Python runner `packages/validator/python/tests/test_text_validity.py`, whose `test_value_graph_cases` runs the 12 cases of `value-graphs.json` through the public validator, so the parity check no longer reports the missing Python binding (R2) (C16.57-15-1). The Python runner passed every case before the binding: no Python defect was found. Red: `make item-red ID=C16.57-15-1` on the base, the R2 grep exits 1. Green: the same grep exits 0; `python -m unittest tests.test_text_validity` 4 OK, including the value graph cases; `make lint-python` exit 0.

### 2026-10-21 — The text-validity units of the input-text limits cite the ids of their cases (C16.57-15)

- `config/parity.json`: the units `text-validity-validate`, `text-validity-validate-list` and `text-validity-validate-detail` cite CUIT-032, CUIT-033 and CUIT-035 for their failure cases, and the suite unit `text-validity-value-graphs` for `tests/fixtures/text-validity/value-graphs.json` cites CUIT-021, CUIT-022, CUIT-029 to CUIT-033 and CUIT-035, with the bindings of the TypeScript, PHP, PHP extension, Go and Rust runners that read the file; the Python runner does not read it, so R2 reports its missing binding (C16.57-15). Red: the record on HEAD, `make item-red ID=C16.57-15 BEFORE=HEAD`: the grep Verification exits 1, since R13 names these ids as untraced. Green: `make item-test ID=C16.57-15`, the grep exits 0 once the units cite the ids.

### 2026-10-21 — The input-text cases cite the limit and error-type requirements they test (C16.57-15)

- `tests/fixtures/text-validity/value-graphs.json` cases carry a `requirements` array: the node and nesting limits CUIT-021 and CUIT-022, the failure of a value beyond them CUIT-029 to CUIT-031, and the error classes of the validation runners CUIT-032, CUIT-033 and CUIT-035, which map each failure through the class of the TypeScript, PHP and Go runner (C16.57-15). The failing cases of `validate`, `validateList` and `validateDetail` cite CUIT-032, CUIT-033 and CUIT-035 for the same reason (C16.57-15). Red: the requirements of CUIT-021, CUIT-022, CUIT-029 to CUIT-033 and CUIT-035 were cited by no case. Green: `node node_modules/@polyspec/kit/dist/run-tests.mjs vitest --cwd packages/validator/ts -- src/text/text-validity.conformance.test.ts` 53 passed; the PHP validator `TextValidityConformanceTest.php` 45 passed; `make test-php-ext CASES=TextValidityConformanceTest` exit 0, 45 passed; the Python `tests.test_text_validity` 4 OK; the Go `validator/validate` text fixtures 48 passed; the Rust `text_validity_conformance` 5 passed. Not cited, and reported: CUIT-034 (PHP generation errors) and the generation part of CUIT-035 and CUIT-036 (the native generator runner checks the code, the message and the location of a generation failure, not its class); CUIT-036 for validation, since the Rust runner maps each failure by its code and checks the load class in one case only; CUIT-029 to CUIT-031 for the options and rows arguments, which the value-graph cases cannot build (they place a graph only under `spec`, `files` or `data`).

### 2026-10-21 — The form button cases are a parity suite, and the button contracts name their fixtures and runners (C16.124)

- `config/parity.json` declares the suite `buttons` over `tests/fixtures/buttons/cases.json` with six runners (TypeScript, Go, Python, Rust, PHP and the PHP extension). Its requirements are CURP-008 (`bindButtons`) and CURP-009 (`formButtonsHtml`), which every case of the suite cites. The attributes of the buttons (CUMK-006 and CUMK-007) are not cited: no case's expected output carries the footer group, so no case meets the condition for those ids.
- `contracts/features.json` names the fixture and the runners of `bindButtons` and `formButtonsHtml`, and their errors as `FormInputError`, the class that the TypeScript reference raises (the entries listed `TypeError`). `manifest:docs` regenerated the feature-contract pages, and `manifest:check` passes.

### 2026-10-21 — The PHP library and the extension run the form button cases and refuse a button of an unknown type and a value that is no list (C16.123)

- `packages/generator/php/tests/ButtonsConformanceTest.php` runs the 22 cases of `tests/fixtures/buttons` through the PHP library; `make test-php-ext CASES='ButtonsConformanceTest'` runs them through the extension. Each observation equals its expectation as JSON text, so the attribute order is checked.
- `Generator::bindButtons` refuses a button whose type is none of submit, reset, button and link with `Invalid button type: <type>`; the extension does the same. `Generator::formButtonsHtml` and the extension take their buttons as any value and refuse a value that is no list with `Form buttons must be a list`, instead of a PHP TypeError.

### 2026-10-21 — The Rust generator runs the form button cases and refuses a button of an unknown type and a value that is no list (C16.122)

- `packages/generator/rust/tests/buttons.rs` runs the 22 cases of `tests/fixtures/buttons`: `bind_buttons` and `form_buttons_html` observations must equal the expectations as JSON text, so the attribute order is checked.
- `bind_buttons` refuses a button whose type is none of submit, reset, button and link with `Invalid button type: <type>`, as the TypeScript reference does. `form_buttons_html` takes its buttons as a JSON value and refuses a value that is no list with `Form buttons must be a list`. The native generator program passes the request value to it.

### 2026-10-21 — The Python generator runs the form button cases and refuses a button of an unknown type (C16.121)

- `packages/generator/python/tests/test_buttons.py` runs the 22 cases of `tests/fixtures/buttons`: `bindButtons` and `formButtonsHtml` observations must equal the expectations as JSON text, so the attribute order is checked.
- `bindButtons` refuses a button whose type is none of submit, reset, button and link with `Invalid button type: <type>` when its template was given without compiling, as the TypeScript reference does; before, the assertion of the compile step was the only check.

### 2026-10-21 — The Go generator runs the form button cases and refuses a button of an unknown type and a value that is no list (C16.120)

- `packages/generator/go/buttons_conformance_test.go` runs the 22 cases of `tests/fixtures/buttons`: `BindButtons` and `FormButtonsHTML` observations must equal the expectations as JSON text, so the attribute order is checked.
- `FormButtonsHTML` takes its buttons as `any` and refuses a value that is no list with `Form buttons must be a list`, as the TypeScript reference does. `BindButtons` refuses a button whose type is none of link, submit, button and reset with `Invalid button type: <type>`, the message of the reference.

### 2026-10-21 — The TypeScript generator runs the form button cases (C16.119)

- `packages/generator/ts/src/buttons.conformance.test.ts` runs the 22 cases of `tests/fixtures/buttons`: each `bindButtons` and `formButtonsHtml` observation must equal its expectation as JSON text, so the attribute order is checked.

### 2026-10-21 — The form button cases are written by the TypeScript reference (C16.118)

- `tests/fixtures/buttons` holds 22 cases of `bindButtons` (CURP-008) and `formButtonsHtml` (CURP-009): the default submit button, the declared buttons in four languages, the link href kept verbatim, localized text, the refusals of a template, a button type, and a language option, and the markup of the buttons with their attributes in order, their escaping, and the refusals of a list, an entry, a tag, an attribute and a class. `generate.mts` writes `cases.json` from the TypeScript reference, and the README names the command.
- `config/rebuild.json` and `config/knip-entries.json` register the generator like the other fixture generators.

### 2026-10-21 — make hooks-check runs in the CI checks, and AGENTS.md rules name their checks (C16.44)

- `make rules-check` once failed for the rule that `make hooks-check` runs at no point that cannot be skipped. The earlier cause, that `make ci-targets` with TARGETS skipped a later invocation, was fixed by kit (da0d0e07, K312).
- `.github/workflows/ci.yml` runs `make hooks-check` in the first job, in its `make ci-targets TARGETS` list, and `CI_TARGETS` in the Makefile lists it after `typecheck` (the same order as the workflow), so the rule reaches it.

### 2026-10-21 — The layout check accepts the Go test of the native program and the Composer vendor folders (C16.115)

- `config/layout.yml`: the S9 exception of the native Go program covers its test file `tests/native-generators/programs/go/main_test.go` with main.go's reason, the test of the program that drives the Go generator (C16.115). The per-package `.gitignore` files of `config/php-lint`, `packages/generator/php`, `packages/php-ext`, `packages/validator/php` and `tests/release-install/composer` ignore `/vendor/`, the Composer install that K372's generated-files check requires (C16.115). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make layout-check` exit 2: `main_test.go` is S9 infrastructure in TypeScript, and the vendor folders are not ignored (K372). The root link files `composer.link.json` and `composer.link.lock` that `kit link` writes (K304-1) are git-ignored; a read-only `alint` run on the main checkout names only `main_test.go`, and in this worktree the files were moved aside before the check (regenerated by `make link`). Green: the same command exit 0.

### 2026-10-21 — The copies of kit follow kit 0.0.54 (C16.112)

- The copies of kit are `.oxlintrc.json` (preserve-caught-error, K334), `phpcs.xml.dist` (Generic.PHP.NoSilencedErrors, K334), `PRINCIPLES.md` and `PRINCIPLES.ko.md` (the gate `suppression-check`, K334), `scripts/kit/bootstrap/install-mise.mts` (the shared installs of a worktree, K387, and the trust of the global config root, K397-1), `config/commit-identity.json` (the commit identity, K405), and the generated hook `.githooks/prepare-commit-msg` (K380-2, K380-3), which `make kit-sync` and `make hooks` bring; they are the copies of kit at 9b8b4444 (0.0.54) (C16.112). The Makefile adds `suppression-check` to `CHECK_TARGETS` (K334) and links after the svelte tools install (K349). The gates needed fixes in the code: 16 Rust `#[allow]` attributes are one line each with their reason (the gate reads one line), the Python `noqa` and two `eslint-disable` lines state their reason in its form, `FormTest.php` reads `loadHTML` with libxml's errors instead of `@`, and `scripts/repository-files.mts` gives its new error its cause. Checks: `make kit-check`, `make suppression-check`, `make lint-php`, `make lint-ts`, `make lint-rust`, `make lint-python` and the owner test of `repository-files.mts` exit 0. `make link-state-check` still reports 17 merged branches left in other worktrees (`make worktree-prune`), and `make layout-check` and `make rules-check` report findings that main has (the link files at the root and `tests/native-generators/programs/go/main_test.go` of C16.79; `AGENTS.md:18` of C16.68).
- `config/layout.kit.yml` declares the link outputs `composer.link.json` and `composer.link.lock` as root files (K423, kit 03c3c405), so a linked worktree passes `make layout-check` as main does, and `config/owner-checks.json` owns `config/commit-identity.json` with the other copies of kit (C16.112).

### 2026-10-21 — The extension API test finds the built module and its report calls match the API (C16.116)

- `packages/php-ext/tests/ApiTest.php` looks for the extension where `make build-php-ext` writes it (`var/php-ext/polyspec_crudui.so`, the default that the Makefile sets for `PHP_EXTENSION`), not in `packages/php-ext/modules`.
- `packages/php-ext/tests/ApiReport.php` passes an array as the options of `renderDetail` (the API types them `array`), expects an empty detail specification to fail with `Detail specification must be an object` (an empty array is no object, as the library and the extension both report), and no longer accepts an empty `data` option for `renderList` (the display rule of C16.87 makes an empty array no object there).

### 2026-10-21 — The form state suites cite the binding data errors CURT-001 to CURT-003 (C16.57-13)

- The form state sessions of `tests/fixtures/form-state/generate.mts` gain three cases in `tests/fixtures/form-actions/cases.json` for the root, group row and repeated value messages of `setData`, and the PHP library and extension pass them through the fix C16.57-13-1 (`Form data must be an object` instead of a PHP TypeError).

### 2026-10-21 — PHP form data that is no object fails with the binding message, not a TypeError (C16.57-13-1)

- The PHP library and the extension take form data as `mixed` in `Form::__construct`, `Form::setData`, `Generator::bindForm` and `Generator::bindButtons`. A `stdClass`, an associative array or the empty array is an object, and a non-empty list array or a value of any other type fails with `INVALID_FORM_INPUT` and `Form data must be an object` (CURT-001), where it used to raise a PHP TypeError. The shared check is `Value::formData` in `packages/generator/php/src/Internal/Value.php` and `form_data_object` in `packages/php-ext/src/crudui.c`; the stub and `polyspec_crudui_arginfo.h` declare the parameters as `mixed`.
- `docs/spec/form-runtime.md` and `form-runtime.ko.md` state this rule where binding rejects data.
- This completes C16.57-13: the PHP `FormStateTest` runs its three new binding cases (CURT-001 to CURT-003) and passes, and `packages/php-ext/tests/ApiReport.php` expects the binding failure instead of a TypeError for `null` data.

### 2026-10-21 — The form state sessions test the binding data errors of setData (C16.57-13)

- `tests/fixtures/form-state/generate.mts` gains three sessions that replace the record with data that the binding rejects: a root that is a text, `null` or a list (CURT-001, `Form data must be an object`), a group row that is a text (CURT-002, `Group data must be an object: teams.{key}`), and a repeated value that is a list or a text (CURT-003, `Repeated data must be a keyed object: teams`). The reference records the code `INVALID_FORM_INPUT` and the message, and the record and the history stay as they were. `tests/fixtures/form-actions/cases.json` gains these three cases (9 to 12), and the `form-actions` unit of `config/parity.json` cites CURT-001, CURT-002 and CURT-003.
- The PHP extension engine test of form state lists `history.c` and `view.c` among its sources, which the form functions link against.
- Red: the PHP library `Form::setData` raises a PHP TypeError for a text or `null`, because its parameter is typed `array|stdClass`. That defect is registered as C16.57-13-1.

### 2026-10-21 — The TypeScript choice-group and hidden-path unit tests are internal (C16.114)

- `config/parity.json` declares `packages/validator/ts/src/choice-groups.test.ts` and `packages/validator/ts/src/hidden-paths.test.ts` internal to TypeScript. The validate suite covers their assertions through `tests/fixtures/validate`: the choice-group cases cover CUVR-011 and CUVR-050, and the hidden cases cover the `hidden` member of CUVR-017 and CUSC-055, with `input-root-data-not-object` for the non-object data error. The check no longer reports them as R5 undeclared-test.

### 2026-10-21 — The TypeScript files pass oxlint (C16.107-1)

- The TypeScript files that `make lint-ts` reported are fixed in the code, with no rule change, comment or exclusion (C16.107-1): the unused declarations and the unused import of `scripts/check-doc-coverage.test.mts`, `scripts/php-doc-coverage.test.mts`, `scripts/check-schema.mts` and `scripts/package-install-pack.mts` are removed; `scripts/test-commands.mts` types the value of `JSON.parse` as `unknown`, so the shape guard narrows it; `tests/fixtures/form-state/generate.mts` reads a step argument through a type guard, and compares the row action name as a string. The fixtures that the generator writes are unchanged. The findings come from `no-unused-vars` (oxlint's default correctness rule, not changed by kit), from `no-base-to-string` and `no-unsafe-type-assertion` of the copied `.oxlintrc.json` (kit K170, 2026-10-15, which applies the type-aware rules to TypeScript), and from the scripts that main merged on 2026-10-21 (C16.11-3, C16.57-10). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make lint-ts` exit 2 with 10 oxlint problems, every other step passing (the first run without `make crudui-build` reported the typecheck of the unbuilt packages). Green: the same command exit 0; the owner tests `scripts/check-doc-coverage.test.mts`, `scripts/php-doc-coverage.test.mts`, `scripts/json-schema.test.mts` and `tests/build/package-install-pack.test.mts` pass. `tests/build/test-commands.test.mts` has one failing test, `no Makefile target takes a target that runs tests as a prerequisite` (`docs-check: crudui-docs-check`), which fails with the HEAD scripts too.

### 2026-10-21 — The PHP files pass the phpcs line-length rule (C16.107)

- The PHP files that `make lint-php` reported are wrapped to 120 characters (C16.107): the docblocks and comments of `packages/generator/php/src/Form.php` (`normalizeFields`), `src/Internal/Lists.php`, the tests `DetailRenderConformanceTest.php`, `ListRenderConformanceTest.php`, `FormCompleteConformanceTest.php`, `LayoutTree.php`, `DetailTest.php`, `DisplayRulesTest.php`, `packages/php-ext/tests/ApiReport.php`, `packages/validator/php/tests/Validate/TextValidityConformanceTest.php` and `UniqueValuesTest.php`; the code of each line is split without a change of its value (the regular expression of `TextValidityConformanceTest` is concatenated at its `|`). The rule is kit's PSR-12 of `phpcs.xml.dist` (kit K77, 2026-10-13); the lines come from files that main merged on 2026-10-20 and 2026-10-21 (C16.70, C16.87, C16.89 to C16.97), so phpcs found them when they landed. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make lint-php` exit 2, 30 Generic.Files.LineLength warnings in 17 files. Green: the same command exit 0; the owner tests `DisplayRulesTest`, `DetailTest`, `DetailRenderConformanceTest`, `ListRenderConformanceTest`, `FormCompleteConformanceTest` and `FormTest` pass 305 tests, `TextValidityConformanceTest` and `UniqueValuesTest` pass 48 tests, and `packages/php-ext/tests/ApiReport.php` exits 0.

### 2026-10-21 — The validity units bind the engine tests of TypeScript and declare its meta-schema tests internal (C16.106)

- This replaces the binding choice that C16.57-7 kept. The TypeScript binding of list-validity and detail-validity is now the engine test `validate-list.conformance.test.ts` and `validate-detail.conformance.test.ts`, as the other five implementations bind their engine tests; the TypeScript binding of spec-validity stays on the forbidden-scan engine test.
- `list-metaschema.conformance.test.ts`, `detail-metaschema.conformance.test.ts` and `form-metaschema.conformance.test.ts` are internal to TypeScript: they check the meta-schema of the TypeScript CLI against `contracts/schema` with Ajv, and no other implementation checks the meta-schema.
- `packages/validator/ts/src/text/json.test.ts` is internal to TypeScript as the unit tests of its specification parser, as C16.99 declared the Rust tests.

### 2026-10-21 — The TypeScript and Python test files of a shared suite are internal (C16.105)

- `config/parity.json` declares 23 test files internal, 22 TypeScript and 1 Python, each with a reason that names the shared suite and the unit that cover its behaviour. The 14 generator files are internal under form-render, list-render, detail-render and form-complete, except `css.test.ts`, which is internal to its implementation alone; the 8 validator files are internal under validate, except `types.roundtrip.test.ts`, which is internal to its implementation alone; `packages/validator/python/tests/test_pattern_states.py` is internal under validate.
- The check no longer reports these 23 files as R5 undeclared-test. The 26 TypeScript and Python files that remain are compose, expr, interface-messages and unicode-data files, or gaps of the classification in the scratchpad, and stay for later rows.

### 2026-10-21 — The Go input text runner handles each type assertion of its fixture reads (C16.108-1)

- `packages/generator/go/input_text_test.go` passes `t` to its option and argument readers. An option or argument of an unexpected type fails the case by name, and an absent or null value is the default, so no `ok` value is dropped and `errcheck` reports no finding.

### 2026-10-21 — The generator cases of the input text fixtures name their requirements, and five suite units bind them (C16.111)

- The five generator case files of `tests/fixtures/text-validity` (`compileForm`, `bindForm`, `createForm`, `buildList` and `buildDetail`) name the requirements that each case tests in `requirements`: CUIT-010 for `compileForm`, CUIT-011 for `bindForm` and for the `createForm` cases without an action, CUIT-012 for `buildList`, CUIT-013 for `buildDetail`, and CUIT-014 to CUIT-020 for the `createForm` actions by method.
- `config/parity.json` declares one suite unit for each case file, with the six bindings of the TypeScript and Python generator tests, the Go, PHP, PHP extension and Rust runners. The requirements CUIT-010 to CUIT-020 are now cited by a unit, so the check no longer reports them as untraced.

### 2026-10-21 — The Rust generator runs every case of the text-validity fixtures (C16.110)

- `packages/generator/rust/tests/input_text.rs` runs the 48 cases of the five generator fixtures of `tests/fixtures/text-validity` through the public generator API, one libtest-mimic trial per case. A case's members are read with `polyspec_crudui_validator::text::JsonText`, which keeps unpaired surrogates, and each operation checks its text in the order of `docs/spec/input-text.md` through the generator's `text` checks before the members are decoded into values.

### 2026-10-21 — The PHP generator runs every case of the text-validity fixtures (C16.109)

- `packages/generator/php/tests/InputTextTest.php` runs the 48 cases of the five generator fixtures of `tests/fixtures/text-validity` through the public `Generator` and `Form` classes, one PHPUnit case per fixture case (`testGeneratorCase`). The cases are read with `JsonText`, which keeps unpaired surrogates as text that is not valid UTF-8. The test passes under the PHP extension (`make test-php-ext CASES=InputTextTest`).

### 2026-10-21 — The Go generator runs every case of the text-validity fixtures (C16.108)

- `packages/generator/go/input_text_test.go` runs the 48 cases of the five generator fixtures of `tests/fixtures/text-validity` (`compileForm`, `bindForm`, `createForm` with its action, `buildList` and `buildDetail`) through the public generator API, one subtest per case. The cases are read with `compose.DecodeOrdered` and `compose.DecodeRawMembers`, which keep unpaired surrogates as text that is not valid UTF-8.
- A template that a case gives as JSON text is checked as decoded text before it is decoded into a `FormTemplate`, as `CheckBindText` documents. A template with invalid text in a member name therefore reports the text failure, not the template shape.

### 2026-10-21 — The Rust generator and validator check their embedded contracts with include_str (C16.58-13)

- `packages/generator/rust/src/messages/mod.rs` and `packages/validator/rust/src/validate/unicode/mod.rs` embed their contract with `include_str!` in the test that compares it with the embedded tables, instead of each reading the file at run time with the same path, read and parse preamble (C16.58-13). A missing or malformed contract still fails the test, now at compile time or with the same parse panic. The duplication check drops the clone of the two preambles. Red: `make duplication-check` exit 2, 35 clones, among them the preamble clone between the two test modules (`packages/generator/rust/src/messages/mod.rs` 134-140 against `packages/validator/rust/src/validate/unicode/mod.rs` 76-82); green: `embedded_data_matches_the_contract` (validator) and `embedded_messages_match_the_contract` (generator) each pass 1 test, and `rustfmt --check` reports nothing for both files.

### 2026-10-21 — The validator decodes the members of a JSON object with one walker (C16.58-12)

- `packages/validator/go/validator/types.go` gains `objectOpen`, `objectEntries` and `objectEntry`, which token-walk a JSON object into its members in document order. `orderedRawObject` (a repeated key keeps its first place and its last value, and a non-object is an error) and `objectMembers` (a non-object yields no members, every member is kept) both use them and keep their own rules (C16.58-12). The duplication check drops the clone between the two functions. Red: `make duplication-check` exit 2, 35 clones, among them the `types.go` clone (lines 991-998 against 1320-1327); green: the validator's selected owner tests (`TestRoundTrip`, `TestForbidden`, `TestXComment`, `TestNonCanonical`, `TestClosed`, `TestDesign`, `TestValidateExtra`, `TestNested`, `TestRule`, `TestTopLevel`, `TestOptions`, 19 passed) exit 0; `go vet ./validator` exit 0; `gofmt -l` reports nothing.

### 2026-10-21 — The form-comparison Rust server shares its lock opener and its test fixtures (C16.58-10)

- `examples/form-comparison/servers/rust/src/repository.rs` gains `open_lock`, which opens the lock file of a store file; `Repository::transaction` and `Store::locked` in `records.rs` both use it (C16.58-10). `tests.rs` gains `react_repository` for the repository of the React create form, and `post_native` for its native form submission, which four tests repeated (`Repository` literals and form POST blocks). The duplication check drops the Rust clones of the example (38 before, 35 after; the count includes the change of C16.58-9). Red: `make duplication-check` exit 2, 38 clones, among them the three example Rust clones; green: the same check exit 2 with 35 clones and none of them in these files; the Rust owner tests (`tests::`, 18 passed) exit 0. `rustfmt --check` reports no difference in `repository.rs` and `tests.rs`; the one difference of `records.rs` (in `specs`) is at HEAD too.

### 2026-10-21 — The form-comparison scripts and frame share the entry guard, the native form fields and the result payload (C16.58-9)

- `examples/form-comparison/src/entry-point.mjs` (new) holds the guard that runs `main` when a script is the entry point, and `check-pipeline.mjs` and `local-verification.mjs` call it. `src/native-fields.mjs` (new) holds the native form fields of a submission, and `check-servers.mjs` and `src/frame.mjs` build their submissions with it. `src/unit-pool.mjs` builds the value and error part of a unit and of an operation result with one `resultPayload` (C16.58-9); the key order of each result is unchanged. The duplication check drops those clones (41 before, 38 after). Red: `make duplication-check` exit 2, 41 clones, among them the guard, the native fields and the result payload; green: the same check exit 2 with 38 clones, none of them in these files; the owner tests `src/unit-pool.test.mjs` (7 passed), `check-servers.test.mjs` (4 passed) and `check-verification.test.mjs` (8 passed) exit 0.
- `config/rebuild.json` classes `examples/form-comparison/src/entry-point.mjs` and `native-fields.mjs` as policy modules of the form comparison example, as its other modules are (C16.58-9).

### 2026-10-21 — The form-comparison stage pages share the binding evaluation of their form (C16.58-8)

- `examples/form-comparison/src/form-views.ts` gains `evaluateBinding`, which binds a template to record data and the view state, and `pages/stage-svelte.svelte.ts` and `pages/stage-vue.ts` use it instead of their own copy of the same evaluation (C16.58-8). The duplication check drops that clone (42 clones before, 41 after). The pages behave the same. Red: `make duplication-check` exit 2, 42 clones, the stage clone between the two pages; green: the same check exit 2 with 41 clones and no stage clone; `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- examples/form-comparison/public/pipeline.test.mjs` exit 0, 9 passed; `node examples/form-comparison/build.mjs <absolute dir>` bundles the pages. The mount and hydrate wrappers of the adapters stay: `src/adapter-completion.test.mjs` requires each adapter to declare them with their own signatures.

### 2026-10-21 — The PHP table generators share the reader of their contract and the writer of their source (C16.58-7)

- `scripts/generator-contract.php` gains `crudui_generate`, which reads `contracts/<name>.json`, builds its source and prints or writes it, as every table generator does. `packages/generator/php/scripts/generate-interface-messages.php` and `packages/validator/php/scripts/generate-unicode-data.php` now call it with their table builder, and their shared header and the `--stdout` line are one copy (C16.58-7). The duplication check drops the PHP header clone that the two scripts shared (43 clones before, 42 after). Output: `php <script> --stdout` prints the same bytes as before for both generators, and the generated `src/Internal/InterfaceMessages.php` and `src/Values/UnicodeData.php` are unchanged. Red: `make duplication-check` exit 2, 43 clones, the PHP header clone between the two scripts; green: the same check exit 2 with 42 clones, the scripts clone gone; `phpunit` of `tests/Internal/InterfaceMessagesTest.php` and `tests/Values/UnicodeDataTest.php` pass.

### 2026-10-21 — The Tailwind stylesheet is the native CSS import of crudui.css into the layer components (C16.12)

- `packages/generator/ts/styles/crudui.tailwind.css` and `packages/generator/ts/scripts/write-tailwind-styles.mjs` are removed: a page imports `@polyspec/crudui-generator-core/crudui.css` with `layer(components)` after `tailwindcss`, which CSS and Tailwind CSS 4 provide natively (C16.12). The package no longer exports `./crudui.tailwind.css`, and `test:forms` no longer runs the script. `tests/tailwind-styles.test.mts` compiles the same import of `crudui.css` into the layer `components`. The compiled CSS is the same: the test's input compiles to 21,286 bytes both before and after, and the two outputs have no differing line. `config/rebuild.json` drops the entry of the script; `docs/spec/form-markup(.ko).md`, `docs/operations/forms(.ko).md` and `docs/features(.ko).md` describe the import. Red: the compiled CSS of the generated file and of the import, compared as the build of the package, were the same. Green: `make rebuild-check` exit 0 and `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/tailwind-styles.test.mts` exit 0, 1363 passed.

### 2026-10-21 — The date and dateISO rules accept the layouts that CUVR-058 and CUVR-059 list in all six implementations (C16.57-12-2)

- `docs/spec/validation-rules.md` gains CUVR-058 (`date`) and CUVR-059 (`dateISO`). A `date` value is a string, trimmed (CUVR-019), that is `YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY` or `DD/MM/YYYY` with calendar validity, or an RFC 3339 `YYYY-MM-DDTHH:MM:SS` date-time with `Z` or a `±HH:MM` offset (no fraction, valid ranges); numbers and date-times without an offset are not dates. A `dateISO` value is a trimmed `YYYY-MM-DD` calendar day only. `docs/spec/validation-rules.ko.md` carries the same text.
- The TypeScript, Go, Python, PHP and Rust validators, and the PHP extension in `packages/php-ext/src/validation.c`, apply those rules. Go's `dateISO` trims its input as CUVR-019 says. Go's unused `parseExactDate` is removed.
- `tests/fixtures/validate/generate.mts` gains 18 cases that cover each layout, calendar validity, offsets, numbers and trimming. `cases.json` has 339 cases, which adds the 18 new cases and changes no existing expectation. Three existing date cases gain CUVR-058 and CUVR-059 in `requirements`.
- Red evidence: before this change the PHP extension failed the new date cases, and the Go `dateISO`, Python and PHP date rules disagreed with the spec. Green: the TypeScript conformance test runs 340 cases, the Go `TestValidateMatchesFixture` runs 340 cases, the Python `test_validate.py` passes 3 tests, the Rust `validate_conformance` passes 1 test, the PHP library `ValidateConformanceTest` passes, and the PHP extension passes 373 tests.
- `config/parity.json` unit `validate` cites CUVR-058 and CUVR-059.

### 2026-10-21 — The C form row operations read their collection from one scope struct (C16.58-24)

- `packages/php-ext/src/form.c` gains `row_scope`, which holds the path, the field, the rows and the error of a row operation's collection, and `open_row_scope`, which fills it and reports whether the operation may go on. Its `needs_options` flag checks the options of a row to add or copy, which the other row operations do not take. `add_row`, `copy_row`, `remove_row` and `move_row` open their collection with it and read the collection from the struct (C16.58-24). The helpers `open_collection` and `open_row_collection` are gone. The expression and view pairs stay: their two callers share only a prologue and a short tail, and a helper would change each caller's shape without making it clearer. The English entry of C16.58-18 now reads correctly, and its clone count is corrected to 16 `php-ext` clones before that commit (the Korean twin too). The duplication check drops the `form.c` pair (21 before, 19 after; `php-ext` clones from 6 to 4). Red: `make duplication-check` exit 2, 21 clones; green: the same check exit 2 with 19 clones, two of them in `php-ext` (expression.c and view.c, left as above); `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed; `make lint-php-ext` exit 0.
- The button type check of `packages/php-ext/src/binding.c`, which C16.123 added, reads the type with the shared `text_member` of `engine_internal.h` (C16.58-24).

### 2026-10-21 — The C list and number text share the scientific mantissa of a number (C16.58-23)

- `packages/php-ext/src/engine_internal.h` gains `ps_append_mantissa`, which appends the first digit of a number and, when there are more, a point and the rest. `list.c` and `number_text.c` use it in their scientific forms; each keeps its own exponent text, which differs (C16.58-23). The duplication check drops the clone of the two mantissa blocks (22 before, 21 after; `php-ext` clones from 4 to 3). Red: `make duplication-check` exit 2, 22 clones, among them the mantissa block of `list.c` against `number_text.c`; green: the same check exit 2 with 21 clones; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-21 — The C composition, expression and row view entries share their steps (C16.58-22)

- `packages/php-ext/src/compose.c` gains `compose_entry`, the composition of a properties or a spec input with the files of its context; `ps_compose_properties` and `ps_compose_spec` call it with their composer. `expression.c` gains `parse_source`, the tokenize and parse step that `ps_expression_value` and `ps_expression_truth` share. `view.c` gains `row_input`, the collapsed list and row check of a row operation, which `ps_toggle_row_view` and `ps_remove_row_view` use (C16.58-22). The duplication check drops those three clones (27 before, 22 after; `php-ext` clones from 8 to 5). Red: `make duplication-check` exit 2, 27 clones, among them the composition, expression and row view pairs; green: the same check exit 2 with 22 clones; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-21 — The C list rendering and building check their input through one function (C16.58-21)

- `packages/php-ext/src/list.c` gains `check_list_input`, the input checks of a list in the order the shared rules give (the specification, the rows and each row, the columns, the options and their context, the page and the total). `render_list_view` and `build_list_view` call it and keep their own steps after it (C16.58-21). The duplication check drops the two clones of those checks (25 before, 23 after; `php-ext` clones from 8 to 6). Red: `make duplication-check` exit 2, 25 clones, among them the two list input check blocks of `list.c`; green: the same check exit 2 with 23 clones; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-21 — The C widget builders hand their source and options to their model through one helper (C16.58-20)

- `packages/php-ext/src/widget.c` gains `attach_source_options`, which gives the source and the options to the model they belong to: each is set only while the build is still ok, and is released from the builder only once set. The three widget builders that repeated that sequence use it (C16.58-20). The duplication check drops the clones of those sequences (27 before, 25 after; `php-ext` clones from 10 to 8). Red: `make duplication-check` exit 2, 27 clones, among them the three source and options sequences of `widget.c`; green: the same check exit 2 with 25 clones; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-21 — The C extension opens the collection of a row operation, reports an unknown row and commits a change through one set of helpers (C16.58-19)

- `packages/php-ext/src/form.c` gains `open_collection` and `open_row_collection` (the collection of a row operation; the second also requires the options to be an object), `unknown_row` (the failure of a key that the collection does not hold) and `finish_change` (the result of a change whose data and view must both be built). `add_row`, `copy_row`, `remove_row`, `move_row`, `rekey_row` and `toggle_row` use them instead of their own copies (C16.58-19). The duplication check drops the clones of those blocks (29 before, 27 after; `php-ext` clones from 12 to 10). Red: `make duplication-check` exit 2, 29 clones, among them the collection, unknown-row and commit blocks of `form.c`; green: the same check exit 2 with 27 clones; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-21 — The C extension parses the arguments of its shared PHP methods and runs their operations through one tail (C16.58-18)

- `packages/php-ext/src/crudui.c` gains three macros, `CRUDUI_PARSE_TEMPLATE_DATA_OPTIONS`, `CRUDUI_PARSE_SPEC_OPTIONS` and `CRUDUI_PARSE_PATH_KEY`, which declare and parse the arguments that several methods share (a template, data and options; a specification and options; a path and a key), and `run_operation`, the tail that runs an operation with its options and releases its three values. `call_three` and `call_display` use the tail (C16.58-18). The duplication check drops the clones of those blocks (33 before, 29 after in the whole repository; the `php-ext` clones from 16 to 12, counted from the commits before it). Red: `make duplication-check` exit 2, 33 clones, among them the `crudui.c` argument blocks and the operation tails; green: the same check exit 2 with 29 clones and none of them in `crudui.c`; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-21 — The C extension compares and multiplies its exact decimal numbers through one set of word helpers (C16.58-17)

- `packages/php-ext/src/bignum_internal.h` (new) holds `bignum_compare` and `bignum_mul_add`, the word arithmetic of the exact decimal conversions. `canonical.c` and `number_text.c` keep their `big_compare`, `big_mul_small` and `big_mul_add` as wrappers around them: `canonical.c` marks its overflow when a carry does not fit, and `number_text.c` ignores that case as before (C16.58-17). The duplication check drops the two clones of the comparison and of the multiply loop (35 before, 33 after). Red: `make duplication-check` exit 2, 35 clones, among them the comparison and the multiply copies of `canonical.c` and `number_text.c`; green: the same check exit 2 with 33 clones; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-21 — The C extension reads typed members and sets members through one set of helpers (C16.58-16)

- `packages/php-ext/src/engine_internal.h` gains `text_member` (the text of a member, empty for a missing or non-string member), `bool_member` (a member that is true), `set_string`, `set_text` and `set_owned_value` (set a member from a string, a text, or an owned value, which the caller gives up). `binding.c`, `widget.c`, `list.c`, `render.c` and `design.c` use them instead of their own copies; `text_member` replaces the file-local `string_member`, whose name `rule_in.c` already uses for another signature (C16.58-16). The duplication check drops the clones among those copies (37 before, 35 after). Red: `make duplication-check` exit 2, 37 clones, among them the `string_member`, `set_string`, `set_text` and `set_owned` copies; green: the same check exit 2 with 35 clones; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-21 — The C extension reads the members of its values through one set of helpers (C16.58-15)

- `packages/php-ext/src/engine_internal.h` gains three `static inline` helpers: `member` (a member of an object, NULL for any other value), `children_of` (the children list of a node) and `text_of` (the text of a string value). The eight C sources that each defined `member`, and the two that defined `children_of` and `text_of` (`outline.c`, `view.c`), use them instead of their own copies (C16.58-15). The duplication check drops the clones among those copies (43 before, 37 after; 26 php-ext clones before, 20 after). Red: `make duplication-check` exit 2, 43 clones, the `member`, `children_of` and `text_of` copies among them; green: the same check exit 2 with 37 clones; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'` builds the extension with no warning and runs 510 tests with 1367 assertions, all passed.

### 2026-10-20 — The empty-collection and action-design rules that the rendering cases test are cited (C16.57-11)

- The rendering cases name the empty-collection and display requirements they test (C16.57-11): `tests/fixtures/form-render` `multiple-only-empty-data` cites CUEC-001 (an explicit empty object gives zero rows), `multiple-leaf-empty-placeholder` cites CUEC-002 (missing data gives the initial row) and CUEC-004 (an empty collection renders its add-row control), generated through `packages/react/scripts/generate-form-render-cases.mts`; `tests/fixtures/list-render` and `tests/fixtures/detail-render` `reject-action-design` cite CUDF-076 (an action design failure), generated through their `generate.mts`. The units form-render, list-render and detail-render list the new ids. Only the `requirements` members changed. Owner tests: ts `conformance.test.ts`, `list-conformance.test.ts` and `detail-conformance.test.ts` 549 passed; Go `TestFormRenderSuite|TestListRenderSuite|TestDetailRenderSuite` 413 passed; Python `test_form_render` and `test_render` 8 passed; Rust `form_render`, `list_render` and `detail_render` passed; PHP library `RenderingConformanceTest`, `ListRenderConformanceTest` and `DetailRenderConformanceTest` passed. Red: `make parity-declarations-check` reports 155 R13 lines; green: 151 R13 lines, and no new finding line. The ids still untraced in the four specs are listed with their reason: CUIT-010 to 020 (the compileForm, bindForm, createForm, buildList and buildDetail operations, and the form operations): their hand-written cases in `tests/fixtures/text-validity` are identified, but those five operations have no unit, and no implementation test reads them, so citing them would not clear the check; CUIT-021 and 022 (node and nesting limits) and CUIT-030 and 031 (the recursive-value message) have no case; CUIT-029 and CUIT-032 to 036 (error codes and per-language error types) are not tested by a case. CUDF-001 to 005, 020, 023 and 036 to 039 need list or detail cases with dotted field paths, boolean and string formats, condition-map links, javascript URLs and processing order, which these generators do not declare yet. CUEC-007 (keyed editable sessions) belongs to the state suites. CUVR-012 (date and dateISO enablement) has no validate case with a date rule.

### 2026-10-20 — docs-check runs the doc-coverage gate through the DOCS_CHECKS hook (C16.94)

- The Makefile of crudui adds the doc-coverage gate with `DOCS_CHECKS += crudui-docs-check` instead of the prerequisite `docs-check: crudui-docs-check` (C16.94), so kit's docs-check runs check-documents and every target of the hook, each regardless of the others. `scripts/test-commands.mts` follows the hook (`makeHooks`, `ProjectDeclarations.hooks`) so that `make docs-check` still reaches the test runner through the hooked targets, and `tests/build/test-commands.test.mts` gets a fixture for it (a hooked target that runs tests, and one that does not). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/test-commands.test.mts` exit 1 on "no Makefile target takes a target that runs tests as a prerequisite"; green: exit 0, 16 passed. `make -n docs-check` names check-documents and crudui-docs-check and prints no overriding warning.

### 2026-10-20 — The interface messages of every implementation equal the contract, under CUMK-065 (C16.100)

- `docs/spec/form-markup.md` states the requirement as item CUMK-065 (every implementation embeds a source generated from `contracts/interface-messages.json`, and a test fails when the embedded text differs). `config/parity.json` declares the feature unit `interface-messages` citing CUMK-065 with six bindings: the TypeScript test, the Go test, the Rust test in `messages/mod.rs`, the Python test `tests/test_interface_messages.py` (new; it compares the `FORM` and `LIST` tables with the contract), and the PHP test `InterfaceMessagesConformanceTest.php` (new; it uses only the public API, `Generator::compileForm` and `Form::getMessages()`, for each contract language), which the PHP extension runs too (C16.100). Red: the parity check had no CUMK-065 binding and the TypeScript, Go, Rust and Python contract tests were unbound (`R5 undeclared-test`). Green: `make parity-declarations-check` 303 findings before, 300 after; three R5 lines leave (Go, Rust, TypeScript), no line is added. The extension run `make test-php-ext CASES=InterfaceMessagesConformanceTest` exits 0 (5 passed) and the library run passes too. The public API returns the form table only, so the list table (`LIST`) is compared in the Python test and in the Go and TypeScript tests, not by the PHP test: no public PHP method returns the list messages, and adding one is a contract change that needs its own decision.

### 2026-10-20 — The Go test files that test no shared suite are declared internal (C16.102)

- `config/parity.json` declares 23 Go test files of the `go` implementation `internal`: 16 that test a rule or a rendering that a shared suite covers (their suite unit or the validate unit is named in the reason) and 7 that test only Go internals (the Go ordered-object decoder, the Go template shape, the Go loader wrapper, the Go FieldSpec round trip, and the two documentation gates and the example server) (C16.102). No internal file names a requirement id, so R16 is clean. Red: `make parity-declarations-check` exit 2 with 303 findings, 31 of them `R5 undeclared-test go`. Green: exit 2 with 280 findings; 23 R5 lines leave, none is added (only the total changes). Eight R5 lines remain: the two compose and expr conformance tests (waiting for the compose and expr units, ruling C16.81), the interface-messages test (bound by C16.100), the Unicode data contract test and the Go byte-level text check (gaps; candidate rows), and the compose order test and the expr engine and recognition tests (pending those units). The verification cell asserts that no declared file appears in an R5 line.

### 2026-10-20 — The PHP test files that test no shared suite are declared internal (C16.104)

- `config/parity.json` declares 24 PHP test files of the `php` implementation `internal`: 16 that test a rule or rendering a shared suite covers (the reason names the suite and its unit: form-render, list-render, validate, form-view, form-history and form-actions), and 8 that test only PHP internals or the documentation gates (C16.104). No internal file names a requirement id, so R16 is clean. Left out: Compose/PatchTest.php and Compose/RefTest.php (their shared suite, compose, has no unit yet, C16.81), ComposeConformanceTest.php and ExprConformanceTest.php (C16.81), Internal/InterfaceMessagesTest.php (C16.100), InputTextTest.php and Values/UnicodeDataTest.php (gaps), and packages/php-ext/tests/ApiTest.php, whose API-equality test with the library has no shared suite (a partial gap, reported). Red: `make parity-declarations-check` exit 2 with 303 findings, 31 of them `R5 undeclared-test php`. Green: exit 2 with 279 findings; the 24 declared R5 lines leave, none is added. The verification cell asserts that no declared path appears in an R5 php line.

### 2026-10-20 — The Rust date rule rejects the text that the reference rejects (C16.57-12-1)

- `packages/validator/rust/src/validate/rules.rs` `is_valid_date` accepts a string only when it is one of the explicit date layouts that the Go and Python validators accept (`YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, and the RFC 3339 timestamp `YYYY-MM-DDTHH:MM:SS` with `Z` or an offset), each with a calendar date that exists (C16.57-12-1). The permissive fallback that accepted any other non-empty string is removed from the validity check only; `enddate` keeps its own parser. The unit test `date_rule_accepts_only_the_explicit_layouts` in the same file pins the layouts, and the conformance case `date-rule-rejects-text-that-is-no-date` (C16.57-12) now passes. Red: `cargo test --locked --manifest-path packages/validator/rust/Cargo.toml --test validate_conformance` exit 101, `1/321 validate mismatch(es)`: `[date-rule-rejects-text-that-is-no-date]` gave `valid: true` where the reference gives `valid: false` with the `date` rule; green: exit 0, `1 passed`; the whole crate `cargo test` exits 0 (108 unit tests and the integration targets), and `make lint-rust` exits 0.

### 2026-10-20 — The display, date and session rules that the cases did not test are written as cases (C16.57-12)

- The rendering suites gain cases through their generators (C16.57-12): `tests/fixtures/list-render` `field-path-dotted` (CUDF-001), `format-true-and-false-are-text` (CUDF-004), `format-string-type-date` (CUDF-005), `format-link-href-condition` (CUDF-020), `format-link-javascript-url` (CUDF-023), `reject-root-sort-before-pagination` (CUDF-036), `reject-column-unknown-key-before-format` (CUDF-038) and `reject-search-before-sort` (CUDF-039); `tests/fixtures/detail-render` the same display cases and `reject-field-unknown-key-before-format` (CUDF-038). `tests/fixtures/validate` gains `date-rule-rejects-text-that-is-no-date`, `dateiso-rule-accepts-iso-date` and `dateiso-rule-rejects-other-format` (CUVR-012); `tests/fixtures/form-actions` gains `explicit-empty-collection-gets-keyed-rows` (CUEC-007, a session that adds a row to an explicit empty object, through the extended session helper of `tests/fixtures/form-state/generate.mts`). Each case cites its ids, and the existing cases that test CUDF-037 (`reject-list-design-before-columns`, `reject-design-before-actions`) and CUDF-036 (`reject-root-key-before-design`) cite them too. The totals of the runners are updated: list 165, detail 68, validate 321 (Python result cases 182). Owner tests: list and detail: ts 233, Go 235, Python 3, Rust 2, PHP library 235, PHP extension 235 (`make test-php-ext`); validate: ts 322, Go 322, Python 3, PHP library 321, PHP extension 355; Rust validate fails on one case (below); form-actions: ts 29, Go 11, Python 4, Rust 4, PHP 29. Red: `make parity-declarations-check` on main reports 155 R13 lines; green: 143 R13 lines, and no new finding line. Defect: the Rust validator reports `date-rule-rejects-text-that-is-no-date` valid, where the reference reports the `date` rule failure on `not a date` (`is_valid_date` in `packages/validator/rust/src/validate/rules.rs` accepts strings that the JavaScript Date parser rejects); it is registered as C16.57-12-1 and is not fixed in this row. CUDF-003 stays uncited: it says that a renderer writes markup from the display model only, which the output of a case cannot show.

### 2026-10-20 — The PHP extension runs the rendering conformance suites through the public API (C16.97)

- `packages/generator/php/tests/RenderingConformanceTest.php` builds each form with `new Form` and `Generator::renderForm` and compares the layout through the trait `LayoutTree.php` (its own style reading, so no internal class is loaded); `ListRenderConformanceTest.php` and `DetailRenderConformanceTest.php` compare the bodies with `LayoutTree::withoutPreloads`. The five rendering files run under `make test-php-ext` (C16.97). The placeholder row of missing repeated data has the fixed key `__0000000000000__` again (`Form.php` `normalizeFields`, `form.c` `normalize_fields`), and only a row that `addRow` creates gets a fresh key below it (the `fresh` flag), as the form-render suite records. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES='RenderingConformanceTest|OutlineTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest'` exit 2, refused: a library source was loaded (`Internal/Buttons.php` and others), and the placeholder case `multiple-leaf-empty-placeholder` fails with a random key. Green: that command exit 0, 443 passed; the library run of the same files exit 0, 443 OK; the form-state regression `FormStateTest|FormTest|HistoryFunctionsTest|DisplayRulesTest` exit 0 under the extension and the library.

### 2026-10-20 — The row operations and the keyPrefix option of the runtime are cited by their cases (C16.57-10)

- The state cases name the row-operation requirements they test (C16.57-10): `tests/fixtures/form-history` `undo-and-redo-restore-the-record` cites CURT-004 (`addRow` with a supplied key), `tests/fixtures/form-actions` `run-action-add-and-copy-row` cites CURT-005 (`copyRow` regenerates the keys of the copied row and its nested rows, `$1` and `$2`), `run-action-move-row` cites CURT-007 (`moveRow` keeps the keys and values), and `tests/fixtures/form-view` `row-removal-drops-and-rekey-moves-view` cites CURT-006 (`removeRow` removes only the selected row) and CURT-008 (`rekeyRow` regenerates descendant paths); the generator is `tests/fixtures/form-state/generate.mts`. `tests/fixtures/form-render` gains `key-prefix-option-names` through `packages/react/scripts/scenario-form-render-cases.ts`, whose reference output names every control `form[…]` (CURT-025). The units form-view, form-history, form-actions and form-render list the new ids. Owner tests: ts `form-state.test.ts` 28, Go `TestFormView|TestFormHistory|TestFormActions` 20, Python `test_form_state` 4, Rust `form_state` 4, PHP `FormStateTest` 28; ts `conformance.test.ts` 330, Go `TestFormRenderSuite` 192, Python `test_form_render` 5, Rust `form_render` 1, PHP `RenderingConformanceTest` 191 (library). Red: `make parity-declarations-check` reports 161 R13 lines in all, 44 of them CURT ids; green: 155 R13 lines, 38 of them CURT ids, and no new finding line. The 38 CURT ids still untraced are listed with their reason: CURT-001 to 003 (data-error messages; no case fails with them, and the reference generator writes only composition errors); CURT-026 to 049 (function options, bindForm on a DOM form element, control values and names, validation timing and submit, and hydration: the TypeScript browser runtime only); CURT-050 (a preparation order), 051 (mounting a framework view), 052 (an example store) and 056 (the verification process that the validate unit runs, not a case); CURT-053 to 055 (each case tests part of the requirement, so none is cited); CURT-057, 058, 059 and 060 (pointer, keyboard, native input events, re-render and per-browser scripts, and the server-rendered bind in a browser: TypeScript only).

### 2026-10-20 — The Rust JsonText unit tests are internal; the repeated-member rule has no six-implementation suite (C16.99)

- `config/parity.json` declares `packages/validator/rust/src/text.rs` an `internal` test of the Rust implementation, with the reason that it holds the unit tests of the Rust JsonText parser (input-text.md, JSON text). The repeated-member rule of that section has no requirement id and binds only the TypeScript specification parser (`parseJsonDocument`, which rejects a repeated decoded name at every depth, escaped names included, and which the CLI reads JSON specifications with) and the Rust JsonText parser, so it is no six-implementation suite; a shared text-validity case would need an error record that the spec does not define (C16.99). The TypeScript parser was checked and rejects the escaped name (`packages/validator/ts/src/text/json.test.ts`), so no defect was found. Red: `make parity-declarations-check` exit 2 with 285 findings, 4 of them `R5 undeclared-test rust`. Green: exit 2 with 284 findings; only the rust R5 line for text.rs left the output (the count line changed), no R16 finding, 3 R5 lines remain (messages/mod.rs, compose_conformance.rs, expr_conformance.rs). `node node_modules/@polyspec/kit/dist/run-tests.mjs vitest --cwd packages/validator/ts -- src/text/json.test.ts` exit 0, 2 passed.

### 2026-10-20 — The Rust test files of the shared contracts are declared internal, and the conformance helper is a support file (C16.98)

- The verification of C16.98 counts the four rust R5 lines that remain in `make parity-declarations-check` (C16.98): the item closes with this line, since the change itself is in the commit before.
- `config/parity.json` declares 23 Rust test files as `internal` of the `rust` implementation, each with a reason that names its module and its contract (for the rows covered by a shared suite: the suite unit; for Rust-only internals: what they test), and `packages/validator/rust/tests/common/**` as a `support` glob, since it holds no test (C16.98). Red: `make parity-declarations-check` exit 2 with 309 findings, 28 of them `R5 undeclared-test rust`. Green: exit 2 with 285 findings; 24 lines left the output (23 R5 and the count line), none was added, and 4 R5 lines remain for `packages/generator/rust/src/messages/mod.rs`, `packages/validator/rust/src/text.rs`, `packages/validator/rust/tests/compose_conformance.rs` and `packages/validator/rust/tests/expr_conformance.rs` (C16.99, C16.100, and the compose and expr units of C16.81). No internal id is named, so R16 is clean.

### 2026-10-20 — The PHP extension reads a signed radix number text as the library does (C16.90)

- `packages/php-ext/src/list.c` (`parse_number`): a text with a sign before a radix prefix, such as `-0x10`, is no number, so a number cell keeps its text as the library does; the unsigned forms `0x10` and `0b101` still read as numbers. `DisplayRulesTest::testSignedRadixTextIsNoNumber` (C16.90) uses only `Generator::renderList`. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES=DisplayRulesTest` exit 2, the new test fails (the extension renders `-16.00`); the library run exit 0, 23 OK. Green: the extension run exit 0, 23 passed; the library run exit 0, 23 OK.

### 2026-10-20 — The PHP extension reads a non-finite page or total option as the library does (C16.89)

- `packages/php-ext/src/crudui.c` (`counts_for_conversion`, `call_display`): a display option `page` or `total` that is INF or NAN is given the rule of the option, as the library does (CUDF-029, CUDF-030), instead of failing in the value converter with `Unsupported PHP value: float`; the caller's array is not changed, and rows or data keep their message. `DisplayRulesTest::testNonFiniteCountsFailWithTheirRules` (C16.89) covers `buildList` and `renderList`. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES=DisplayRulesTest` exit 2, 2 failed (`testPageAndTotalAreSafeIntegers` with `Unsupported PHP value: float`, and the new test); the library run of `DisplayRulesTest` exit 0, 22 OK. Green: the extension run exit 0, 22 passed, and the library run exit 0, 22 OK.

### 2026-10-20 — The form markup rules that the rendering cases test are cited (C16.57-9)

- `tests/fixtures/form-render/cases.json` gains two cases through `packages/react/scripts/scenario-form-render-cases.ts`, rendered by the React reference (C16.57-9): `multiple-nested-depth-three`, three collections nested in one another (CUMK-059), and `multiple-max-reached-disables-add`, two rows at `multiple.max` 2 whose add-row and copy-row controls are `aria-disabled` (CUMK-060). `generate-form-render-cases.mts` carries the requirement table of the cases, now with CUMK-005, 031, 058, 059, 060, 062, 063 and 064 on the cases that show their markup. The unit form-render of `config/parity.json` cites them. The runners count the cases: the Go, Rust and Python result counts are 139, and the Python total is 190; their owner tests pass (ts 328, Go 191, Rust 1, Python 5). The PHP library passes all 190 cases of `RenderingConformanceTest` (phpunit). `make test-php-ext` refuses the run, because the test loads library-internal classes (`Internal\Buttons`, `Value`, `Messages`) that the extension does not provide, so the php-extension binding of form-render is not verified by it. Red: `make parity-declarations-check` on main reports 317 findings (R13 168, R4 7, R5 141, R6 1); green: 309 findings (R13 161, R4 7, R5 140, R6 1), with no new finding line. The 25 CUMK ids still untraced are the class-naming rules CUMK-001 to 003, the outline and data classes CUMK-008 and 009 (their cases compare the HTML in the TypeScript runner only), the 17 CSS variables CUMK-039 to 055 (no case carries CSS), and CUMK-056, 057 and 061 (polling, expansion view state and undo, which the markup suites do not test).

### 2026-10-20 — The ci-local test expects the engine and comparison paths of the PHP engine command (C16.95)

- `tests/build/ci-local.test.mts` expects the PHP engine command of `make crudui-test-native` to run `packages/php-ext/tests/engine/engine.test.mjs` and `packages/php-ext/tests/comparison/comparison.test.mjs`, as the recipe does since the split of the engine test (C16.48), and keeps its exact-command check; the two regexes after it are unchanged and pass (C16.95). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/ci-local.test.mts` exit 1, with `the native suites run in three jobs, each once, and make crudui-test-native runs all three` failing on the one-path regex. Green: the same command exit 0.

### 2026-10-20 — The rendering and outline suites are declared as parity units (C16.83)

- `config/parity.json` declares the units form-render, form-complete, list-render, detail-render and form-outline, each with the bindings of ts, go, python, php, php-extension and rust (where the runner exists) and the requirement ids that its cases test (C16.83). `packages/html` is a root of the ts implementation, with the eight markup-rule tests and the two browser session tests declared internal. `docs/spec/runtime-packages.md` gives the TypeScript implementation its requirement CURP-028. The cases of the five suites name their requirement ids in a `requirements` member, generated by tests/fixtures/*/generate.mts and packages/react/scripts/generate-form-render-cases.mts; only that member changed. Red: `make parity-declarations-check` on main reports 420 findings (R13 259, R4 12, R5 148, R6 1); green: 317 findings (R13 168, R4 7, R5 141, R6 1). The Rust form-render runner (tests/form_render.rs, from C16.88) is one test, `form_render_cases_reproduce_the_normalized_layout_or_the_failure`, which runs all 188 cases, so one binding runs every case. Owner test: `vitest` of the five html conformance files, 587 passed, 0 failed.
- The rust implementation of `config/parity.json` declares `packages/generator/rust/tests/support/**` as its support files: the module that the rendering runners share is no test (C16.83).

### 2026-10-20 — The last scripts read their JSON without scripts/values.mts, which is removed (C16.11-4, C16.11)

- `scripts/check-ci-browser.mts`, `scripts/docs-web/cli.mts`, `scripts/docs-web/server.mts`, `scripts/install-browsers.mts` take their error text inline, and `tests/build/ci-local.test.mts` and `tests/build/public-packages.test.mts` check their objects and string arrays through ajv shapes from `scripts/json-schema.mts` (C16.11-4). `scripts/values.mts` is removed, with its `replaced` entry in `config/rebuild.json` and its path in `config/owner-checks.json`, so the scripts read JSON through ajv schemas only (C16.11). Red: `make rebuild-check` exit 0 with `scripts/values.mts` present and `replaced` (21 callers). Green: `make rebuild-check` exit 0; the rest of the family's node tests were checked in their families. `tests/build/public-packages.test.mts` needs the built packages of the checkout: in a fresh worktree five of its checks fail on the missing `dist` outputs, and on main all pass. `tests/build/ci-local.test.mts` fails `the native suites run in three jobs` on main too.
- `config/owner-checks.json` owns `scripts/json-schema.mts` and `scripts/json-schema.test.mts` with the rule that owned `scripts/values.mts`, whose tests add `scripts/json-schema.test.mts` and `tests/build/install-lock.test.mts` (C16.11-4).

### 2026-10-20 — The schema, conformance, test-command and doc-coverage scripts read their JSON through ajv shapes (C16.11-3)

- `scripts/check-schema.mts`, `scripts/check-conformance.mts`, `scripts/test-commands.mts`, `scripts/check-doc-coverage.test.mts` and `scripts/php-doc-coverage.test.mts` check their objects, arrays, strings and string arrays through shapes from `scripts/json-schema.mts` instead of `scripts/values.mts` (C16.11-3). Each caller keeps its refusals and messages; a refused value names its label and the JSON Pointer of the wrong value. `Makefile` runs `scripts/json-schema.test.mts` with the other script tests, which `tests/build/test-commands.test.mts` requires of every node:test file. Red: the family read through `scripts/values.mts`. Green: `node scripts/check-schema.mts` exit 0 (608 checks, as on main); `scripts/check-doc-coverage.test.mts`, `scripts/php-doc-coverage.test.mts` and `scripts/json-schema.test.mts` pass; `tests/build/test-commands.test.mts` passes except `no Makefile target takes a target that runs tests as a prerequisite`, which fails on main too (the `docs-check` target).

### 2026-10-20 — The package and repository readers read their JSON through ajv shapes (C16.11-2)

- `scripts/repository-files.mts` checks the kit.copies of @polyspec/kit's package.json through an ajv shape, `scripts/package-install-pack.mts` checks the npm pack report and the source package.json through shapes, `scripts/check-contract-manifest.mts` checks the exports maps and package.json files through shapes, `scripts/features-manifest.mts` checks the schema object through a shape, and `scripts/check-packages.mts` reads its package.json, lock and version files through shapes (C16.11-2). Each refusal of a caller keeps its condition and its own message; where a shape refuses a value, the message names the file and the JSON Pointer of the wrong value (`shapeDetail`). Red: the family read through `scripts/values.mts`. Green: `tests/build/package-install-pack.test.mts`, `tests/build/repository-files.test.mts`, `tests/build/contract-manifest.test.mts`, `tests/build/install-lock.test.mts` and `scripts/json-schema.test.mts` pass together with 25 tests; `make rebuild-check` exit 0. `scripts/check-packages.mts` runs the install project, so its change is checked by the TypeScript compiler only, and by the `make test:packages` gate.

### 2026-10-20 — The install lock reads its shapes through ajv schemas (C16.11-1)

- `scripts/json-schema.mts` is the shared shape check of the scripts: a schema states the shape, ajv validates the value, and a value of another shape fails with an Error that names its file and the JSON Pointer of the wrong value (`shapeOf`, `checkedShape`, `readShape`, `shapeDetail`); `scripts/json-schema.test.mts` checks the message. `scripts/install-lock.mts` gives its guards `isLockEntry`, `isLockPackages` and `isPackedManifest` as ajv shapes instead of checks through `scripts/values.mts`, with the same accepted values (C16.11-1). `config/rebuild.json` classifies the new script as an ajv ecosystem tool. Red: `make rebuild-check` exit 0 with `scripts/values.mts` still a `replaced` entry; green: `make rebuild-check` exit 0, `tests/build/install-lock.test.mts` 5 passed, `scripts/json-schema.test.mts` 2 passed.

### 2026-10-20 — The schema suites cite the CUSC requirements that their cases test (C16.57-7)

- `tests/fixtures/spec-validity`, `list-validity` and `detail-validity` cases carry a `requirements` array, written by hand (these suites have no generator): the cases of the runtime `engine` expectation cite the CUSC items of the structure, content, design, choice, multiple, lang, buttons and action keys that they accept or reject (CUSC-001 to CUSC-004, CUSC-006, CUSC-007, CUSC-008 to CUSC-011, CUSC-014, CUSC-015, CUSC-020, CUSC-021, CUSC-023, CUSC-024, CUSC-026, CUSC-041, CUSC-042, CUSC-045, CUSC-047 to CUSC-051, CUSC-053 to CUSC-060, and CUSC-027 to CUSC-035 in the list cell formats) (C16.57-7). `tests/fixtures/validate/generate.mts` adds CUSC-003, CUSC-008 to CUSC-010, CUSC-052 and CUSC-055 to the `REQUIREMENTS` map, and `tests/fixtures/validate/cases.json` is regenerated from it. `config/parity.json` declares the suite units `spec-validity`, `list-validity` and `detail-validity` with six bindings each (ts, php, php-extension, go, rust and python), and the `validate` unit lists the new ids. The `compose` suite is not declared: its PHP test loads PHP library sources, so the PHP extension run refuses it, and a unit without the php-extension binding would fail R2. Red: `make parity-declarations-check` exit 2 with 514 findings, 60 R13 findings for CUSC-001 to CUSC-060 and 3 R4 findings for the spec, list and detail validity files; green: exit 2 with 454 findings, 16 R13 findings (CUSC-005, CUSC-012, CUSC-013, CUSC-016 to CUSC-019, CUSC-022, CUSC-025, CUSC-037 to CUSC-040, CUSC-043, CUSC-044, CUSC-046), no R4 for the three files, and no R14 or R15. The `engine` expectation is run by all six bindings, but the meta-schema `expect` of those suites is run only by the TypeScript `form-metaschema` and `detail-metaschema` tests, so the CUSC items that only the meta-schema checks (for example the design.attributes name refusal, CUSC-012) are not cited. Owner tests: ts forbidden-scan 35 passed, validate-list 22, validate-detail 14, validate 319; php ForbiddenScanConformanceTest 34, ListValidateConformanceTest 20, DetailValidateConformanceTest 14, ValidateConformanceTest 318; php extension ForbiddenScanConformanceTest 34, ListValidateConformanceTest 20, DetailValidateConformanceTest 14; go forbidden-scan, validate-list, validate-detail 70 subtests and validate and compose 340 subtests with no failure; rust spec_validity, list_engine, detail_engine, validate and compose each 1 passed. python tests.test_structure_validity 9 passed. The units `list-validity` and `detail-validity`, which C16.57-8 declared first, keep its TypeScript bindings, the meta-schema tests `list-metaschema` and `detail-metaschema` (a unit binds each implementation once, R12), and add these CUSC ids to its CUDF ids; on top of C16.57-8 the check reports 420 findings (259 R13, 12 R4, 148 R5, 1 R6).

### 2026-10-20 — The make-tool-path test reads the kit directory that the Makefile uses (C16.91)

- `tests/build/make-tool-path.test.mts` asks make for the value of `KIT` (a probe makefile that prints `$(KIT)`, read with the repository Makefile) and expects the Rust test command under that directory, instead of `node_modules/@polyspec/kit/dist`. The check that the Rust tests run through `run-tests.mjs` is unchanged (C16.91). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/make-tool-path.test.mts` exit 1, with the one test `crudui-test-native runs the Rust tests through the test runner` failing (the Makefile runs `../kit/dist/run-tests.mjs` in this linked checkout). Green: the same command exit 0, 5 of 5 pass.

### 2026-10-20 — The Rust command entry point uses the toolchain that PATH pins, and tool-resolution.mts is removed (C16.41)

- `scripts/run-rust-command.mts` runs the cargo, rustc and rustdoc that PATH names (the shims of mise put the toolchain that `rust-toolchain.toml` pins first), verifies each one's version output, and sets `RUSTC` and `RUSTDOC` to their absolute paths; `scripts/tool-resolution.mts` is removed with its rustup discovery, and its `replaced` entry leaves `config/rebuild.json` with the file (C16.41). The owner-check path list, the test lists of the doc-coverage, API-doc, run-command and entry-point tests drop the removed file; `tests/build/make-tool-path.test.mts` and `tests/build/rust-node-entry-points.test.mts` test the PATH toolchain instead of a fake rustup. `docs/operations/package-build.md` and `.ko.md` describe the new rule. Red: `make rebuild-check > var/red.log 2>&1` exit 0, with `scripts/tool-resolution.mts` present as `replaced` with the reason "item C16.41 registers the replacement". Green: `make rebuild-check` exit 0 with the entry gone; `tests/build/rust-node-entry-points.test.mts` 7 passed, `tests/build/run-command.test.mts` 9 passed, `scripts/check-doc-coverage.test.mts` 13 passed, `scripts/gen-api-docs.test.mts` 8 passed; `tests/build/make-tool-path.test.mts` 4 of 5 pass, and its `crudui-test-native runs the Rust tests through the test runner` fails on the main checkout too, because the Makefile runs kit from `../kit` and the test expects `node_modules/@polyspec/kit` (a worktree layout difference, not this change). The TypeScript files type-check with the repository compiler.

### 2026-10-20 — The Rust generator runs the shared form-render, list-render and detail-render suites (C16.88)

- `packages/generator/rust/tests/form_render.rs`, `list_render.rs` and `detail_render.rs` run every case of the three suites with the Rust generator, as `test_render.py` does: a result case is compared as a normalized layout tree (`tests/support/mod.rs`, the `html_tree` of the Python runner, without preload links for lists and details), and a failure case must raise the recorded code (and message for lists and details). The counts are asserted: 137 results and 51 failures for form-render, 157 list cases and 62 detail cases. `packages/generator/rust/src/instance.rs` gives missing repeated data the initial row `__0000000000000__` (CUEC-002) instead of a fresh key, and only a row that an operation creates gets a fresh key (`normalize_fields` and `normalize_row` take `fresh`, as the Python and TypeScript references do); `tests/form_complete.rs` (C16.84) changes only its unwrap calls to `match`, to satisfy the disallowed `Result::unwrap_or_else` rule (C16.88). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml form_render` exit 1 with `multiple-leaf-empty-placeholder` rendering the row key `__b8532f96c45a1__` where the case expects `__0000000000000__`; green: `form_render` exit 0 (2 passed), `list_render` exit 0 (1 passed), `detail_render` exit 0 (2 passed), `form_complete` exit 0, the unit tests `tests` exit 0 (41 passed), and `--test form_state --test history_functions` exit 0 (17 passed); the crate clippy command exits 0. Mutation checks changed one expected value in each family in a temporary copy of its fixture, each runner failed (exit 1), and each fixture was restored.

### 2026-10-20 — The Rust generator runs the shared form-complete suite (C16.84)

- `packages/generator/rust/tests/form_complete.rs` renders each of the 28 cases of `tests/fixtures/form-complete/cases.json` with `compile_form`, `Form::new` and `render_form`, using the case options and render options: a case with `expected_html` must render the same bytes, and a case with `expectError` must fail with the recorded code and message (C16.84). Red: the test was not in the tree, so the row records no red; the mutation check replaced one `expected_html` with another value in a temporary copy of the fixture, and `form_complete` failed (exit 1), then the fixture was restored. Green: `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml form_complete` exit 0, 1 passed, with all 28 cases compared; no generator defect was found.

### 2026-10-20 — The Go generator runs the shared form-complete, list-render and detail-render suites (C16.86)

- `packages/generator/go/form_complete_suite_test.go` (new) runs the 28 cases of `tests/fixtures/form-complete/cases.json` through `RenderForm` with the case's render options; `list_render_suite_test.go` runs the 157 cases of `list-render` and `detail_render_suite_test.go` the 62 cases of `detail-render`, comparing each result body without its image preload links as the shared normalized layout, and each failure case by its recorded code and message (C16.86). `form_render_suite_test.go` `renderFormCase` takes the render options. The list and detail input rules follow CUDF-025 and CUDF-033: `RenderList`, `BuildList` take `rows any` and `RenderDetail`, `BuildDetail` take `record any` (decoded values; `[]*Object` is still accepted), so a rows value that is no array fails with `List rows must be an array` (`list.go` `listRows`), a record that is no object fails with `Detail record must be an object` before the fields check, and a nil record no longer becomes an empty object (`detail.go` `BuildDetail`). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd packages/generator/go -- -run 'TestFormCompleteSuite|TestListRenderSuite|TestDetailRenderSuite'` exit 1, 7 of 250 subtests failed (`reject-record-before-fields`, `reject-record-before-context`, `reject-non-object-record`, `reject-object-rows`, `reject-rows-before-columns`); green: exit 0, 250 subtests pass, and the 27 tests of the files that call the changed API pass (89 subtests), `go vet` exit 0.

### 2026-10-20 — The PHP generator and the PHP extension run the shared list-render and detail-render suites (C16.87)

- `packages/generator/php/tests/ListRenderConformanceTest.php` and `DetailRenderConformanceTest.php` (new, with the trait `LayoutTree.php`) run the 157 list and 62 detail cases; the PHP library and the extension now check the argument shapes of `renderList`, `buildList`, `renderDetail` and `buildDetail` in argument order (`Generator`, `Internal/Lists.php`, `Internal/Details.php`, `polyspec_crudui.stub.php`, `polyspec_crudui_arginfo.h`, `crudui.c`): a list array, the empty array included, is no object, a value of another type fails with its rule's message, and `data` is an object option. The earlier PHP callers that passed `[]` as a record, a specification or `data` are updated (`DisplayRulesTest`, `DetailTest`, `ApiReport.php`), and the native PHP program passes the decoded JSON values to the library. The rule is in `docs/spec/display-formats.md` (C16.87). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs phpunit --cwd packages/generator/php -- tests/ListRenderConformanceTest.php tests/DetailRenderConformanceTest.php` exit 1, 13 of 221 failed (`reject-string-specification` a TypeError, `reject-array-specification`, `reject-array-context`, `reject-record-before-context` and others); green: that run exit 0, 221 OK, and `make test-php-ext CASES=ListRenderConformanceTest|DetailRenderConformanceTest` exit 0, 221 passed.

### 2026-10-20 — The PHP generator and the PHP extension run the shared form-complete suite (C16.85)

- `packages/generator/php/tests/FormCompleteConformanceTest.php` (new) renders the 28 cases of `tests/fixtures/form-complete/cases.json` with `Generator::compileForm`, `new Form` and `Generator::renderForm`, and compares the output with `expected_html` byte for byte; a case with `expectError` must raise a `FormError` with the recorded code and message. The file uses only the public API, so the native PHP extension runs it too (`make test-php-ext`) (C16.85). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs phpunit --cwd packages/generator/php -- tests/FormCompleteConformanceTest.php` exit 1, the file did not exist and the run was refused without a selection; `make test-php-ext CASES=FormCompleteConformanceTest` exit 2, `selects no test`; green: both exit 0, phpunit 29 tests and 45 assertions OK, and the extension run passes the same 29 tests.

### 2026-10-20 — The Go generator runs the shared form-render suite (C16.82)

- `packages/generator/go/form_render_suite_test.go` (new) runs the 188 cases of `tests/fixtures/form-render/cases.json` through the Go generator: the 137 result cases compile, bind and render, and their HTML is compared with the recorded HTML as the layout that the shared normalizer `tests/fixtures/form-render/normalize.mts` gives (run by node with tsx), and the 51 failure cases must raise the recorded code (C16.82). `instance.go` gives the initial row of missing repeated data the key `__0000000000000__` and a fresh key only to a row that `AddRow` creates (`normalizeFields`, `normalizeRow` take `fresh`), as the Python and TypeScript references do; before, `NewForm` drew a random key, so a new instance rendered a different form (`multiple-leaf-empty-placeholder`). Red: `go test -run TestFormRenderSuite` exit 1, 1 of 188 subtests failed (`multiple-leaf-empty-placeholder`: a new instance renders a different form); green: exit 0, 188 subtests pass, and `go test -run Test ./...` exit 0 with `golangci-lint run` exit 0 and 0 issues.

### 2026-10-20 — The list and detail validity suites cite the display requirements they test (C16.57-8)

- `tests/fixtures/list-validity/cases.json` and `tests/fixtures/detail-validity/cases.json` carry the `requirements` of their cases (7 and 4 cases with CUDF ids), and `config/parity.json` declares the units `list-validity` and `detail-validity` with the six bindings of their tests (C16.57-8). Red: `make parity-declarations-check` reported 88 `R13` findings for `CUDF-001` to `CUDF-088` and an `R4` finding for each validity file; green: 53 CUDF ids remain untraced, 24 of them in CUDF-024 to CUDF-082 (`CUDF-024`, `025`, `026`, `028` to `031`, `033`, `035` to `039`, `042`, `063`, `065`, `067`, `070` to `076`) and 29 outside it (the display model and the rendering ids); the `R4` findings of the two units are gone. The owner tests of the bindings pass in `make item-test`: ts 35, php 20 and 14, `make test-php-ext` 34 with the extension, go 35 and rust 4; python is blocked because `var/python` is not a virtual environment (C16.57-8).
- `scripts/check-schema.mts` accepts the `requirements` member of a structure-validity case, a nonempty array that names each id once (C16.57-8). Red: `make land` refused the branch at docs-check, `list-validity:ok-minimal-columns: unknown member requirements`; green: `node scripts/check-schema.mts` exits 0 with 608 specification checks.

### 2026-10-20 — runAction holds in every implementation (C16.50)

- With the support values reduced to pass (C16.54), `make divergence-check` exits 0 and names no runAction entry, so runAction is implemented in php, go, rust, php-native and python as `contracts/features.json` declares (C16.50). Red: before C16.54 the check failed on the supportValues entry; green: exit 0.

### 2026-10-20 — contracts/features.json has no partial and unsupported support values (C16.54)

- `contracts/features.json` declares `supportValues` as `pass` only, and `contracts/features.schema.json` accepts only `pass` for a `supportValues` entry and for a feature `support` value (C16.54). `scripts/features-manifest.mts` types `SupportValue` as `pass`; `scripts/check-conformance.mts` requires the cases of each `pass` runtime and no longer has the partial branch or the unsupported reason; `tests/build/conformance-evidence.test.mts` drops the partial-runtime test and reads an undeclared runtime in place of an unsupported one; `tests/build/contract-manifest.test.mts` uses the new manifest values. The feature `status` enum keeps `partial`, which is a different field. Red: `make divergence-check` exit 2, with `contracts/features.json` naming the `partial` and `unsupported` supportValues (lines 408-409); green: exit 0, with no supportValues entry named, and the two build tests and `make manifest-docs-check` exit 0 (14 and 9 tests passed).

### 2026-10-20 — runAction is declared in php, go, rust, php-native and python (C16.50)

- `contracts/features.json` sets the support of `runAction` to `pass` for `php`, `go`, `rust`, `php-native` and `python` (C16.50), adds their form-actions tests to its tests list and the go, python, rust and php verification commands; the Verification cell of the row now names the manifest test, the manifest docs check and the divergence check. The generated feature contract pages follow. Red: `make divergence-check` exit 2, with `contracts/features.json` naming `runAction` unsupported in those five implementations; green: the check names no entry of `runAction`. The python, rust and php commands pass here; the go command passes when run as `go test -run TestFormActions` in the module, but the runner's mise call reports the worktree's `mise.toml` as untrusted. The php-native support is declared without a php-ext run, as for C16.51 and C16.52.

### 2026-10-20 — The validator text-validity suites cite the input text requirements CUIT-001 to CUIT-009 and CUIT-023 to CUIT-028, CUIT-037 to CUIT-040 (C16.57-5)

- `tests/fixtures/text-validity/validate`, `validateList` and `validateDetail` cases carry a `requirements` array, written by hand because these vector files are not generated: a case with an unpaired surrogate escape, and the valid pair case, cite CUIT-001 to CUIT-004 and the decoders CUIT-037 to CUIT-040; a case expecting `INVALID_TEXT` cites CUIT-023 to CUIT-025; a case expecting the input failure `Text must be Unicode scalar values: {name}` cites CUIT-026 to CUIT-028; the ordering cases cite CUIT-005 and CUIT-006, the `basepath` case CUIT-007, and every case of `validate` cites CUIT-008, of `validateList` and `validateDetail` CUIT-009 (C16.57-5). `config/parity.json` declares three suite units, `text-validity-validate`, `text-validity-validate-list` and `text-validity-validate-detail`, with the six bindings: ts (`text-validity.conformance.test.ts`), php and php-extension (`TextValidityConformanceTest::testInputTextMatchesFixture`), go (`TestInputTextMatchesFixture`), rust (`input_text_matches_fixture`) and python (`test_text_validity.py`). Red: `make parity-declarations-check` exit 2 with 548 findings, 40 R13 findings for CUIT-001 to CUIT-040 and 3 R4 findings for the three cases files; green: exit 2 with 521 findings, 21 R13 findings for CUIT-010 to CUIT-022 and CUIT-029 to CUIT-036, 0 R4 for the three files, and 0 R14, R15 or R2 for the new units. Not cited, no suite runs them with six bindings: CUIT-010 to CUIT-020 and the generator operations (`compileForm`, `bindForm`, `createForm`, `buildList`, `buildDetail`), which only the TypeScript and Python generators run in their own tests; CUIT-021, CUIT-022, CUIT-029 to CUIT-031 (value-graphs.json, which the Rust validator does not run by design); CUIT-032 to CUIT-036 (the error types of each runtime, which no shared case records). The R5 finding for `packages/generator/python/tests/test_text_validity.py` and the R2 finding of form-actions are not of this row. Owner tests through `make item-test`: ts vitest `text-validity.conformance.test.ts` 53 passed; rust `input_text_matches_fixture` 1 passed; python `tests.test_text_validity` 4 passed; PHP library `TextValidityConformanceTest` 45 passed; PHP extension `make test-php-ext CASES='TextValidityConformanceTest'` 45 passed; go `TestInputTextMatchesFixture` 33 subtests passed.

### 2026-10-20 — The runtime package requirements that the shared suites test are cited by their units (C16.57-6)

- `tests/fixtures/validate/generate.mts` cites `CURP-018` (the validate operation) and `CURP-022` (validation of record data and its errors) on every case of `tests/fixtures/validate/cases.json`; `tests/fixtures/form-state/generate.mts` cites `CURP-010` (create instance) and `CURP-012` (read data) on every session, `CURP-011` (replace data) on the sessions with a `setData` step and `CURP-027` (row keys and row operations) on the sessions with a row operation, in `form-view`, `form-history` and `form-actions`; `config/parity.json` cites them in the units `validate`, `form-view`, `form-history` and `form-actions`, and gives `form-actions` its `php-extension` binding, the `FormStateTest` action sessions that the extension runs (C16.57-6). Red: `make parity-declarations-check` reported 27 `R13` findings for `CURP-001` to `CURP-027` and one `R2` finding, `form-actions` without a `php-extension` binding; green: 21 `CURP` ids remain untraced (`CURP-001` to `CURP-009`, `CURP-013` to `CURP-017`, `CURP-019` to `CURP-021`, `CURP-023` to `CURP-026`), the six cited ids are cited, and the `R2` finding is gone; the owner tests of every binding pass (`make item-test`: validate 319 vitest and go cases, 1 cargo, 3 python, 318 phpunit; form-state 28 vitest, 20 go, 4 cargo, 4 python; `FormStateTest|ValidateConformanceTest` under the extension 352 and 28 passed) (C16.57-6).

### 2026-10-20 — The PHP extension runs the form actions: resolveAction and runAction (C16.50-5)

- `packages/php-ext/src/actions.c` (new) implements `ps_resolve_action` and `ps_run_action` with the eleven action names of the PHP library: a run applies each operation through `ps_form_apply` (`add-row`, `copy-row`, `remove-row`, `toggle-row`, `move-up`, `move-down`, `expand-all`, `collapse-all`, `undo`, `redo`), so a failing operation leaves the form unchanged, and `crudui.c` adds `Generator::resolveAction` and `Generator::runAction`, declared in `polyspec_crudui.stub.php` and `polyspec_crudui_arginfo.h` (C16.50-5). Red: `make test-php-ext CASES='FormStateTest'` exited 2 at the declaration step, with `Generator::resolveAction` and `Generator::runAction` missing ("extension none"); green: `make lint-php-ext` exit 0 and `make test-php-ext CASES='FormStateTest'` exit 0, with the generator suite running 28 tests under the extension, including the nine form-action sessions (`resolve-action-names` through `run-action-unknown-name`); the validator and php-ext libraries have no case selected by CASES (C16.50-5).

### 2026-10-20 — The expression suite is cited by a unit whose tests name the CUXP requirements (C16.57-3)

- `packages/validator/ts/scripts/generate-expr-cases.mts` records in each case of `tests/fixtures/expr/cases.json` a `requirements` list: the CUXP ids of docs/spec/expressions.md whose token type (CUXP-001 to CUXP-017), whitespace (CUXP-016) or tree node (CUXP-018 to CUXP-023) the case contains; a rejected case lists the ids of its tokens. `config/parity.json` declares the suite unit `expr` over that file, with CUXP-001 to CUXP-023 and the bindings ts, go, python, rust and php. It has no php-extension binding: the extension registers no expression API, so `make test-php-ext CASES='ExprConformanceTest'` loads the `Expr` sources of the PHP library and the kit refuses the run; the parity check keeps that R2 finding until row C16.81 settles the expression API of the extension (C16.57-3). Red: `make parity-declarations-check` exit 2 with 603 findings, of which 23 are R13 for CUXP-001 to CUXP-023 and 1 is R4 for `tests/fixtures/expr/cases.json`. Green: exit 2 with 576 findings on the main of this commit, of which 0 are R13, R4, R14 or R15 for these ids, and 1 is R2 for the php-extension of `expr`. Owner tests (`make item-test`): ts 74 passed; go `TestExpressionMatchesFixture` 283 passed; python `tests.test_expr` 4 passed; rust `expr_conformance` 4 passed; phpunit `ExprConformanceTest.php` 78 passed. CUXP-010 is cited by the GT, GE and LT cases; no case contains `<=`, so the LE token is untested.

### 2026-10-20 — The validate suite cites the validation rule requirements CUVR-001 to CUVR-011 and CUVR-013 to CUVR-057 (C16.57-4)

- `tests/fixtures/validate/generate.mts` writes the `requirements` of 270 cases of `cases.json` from its `REQUIREMENTS` map: a case cites a rule when one of its expected errors reports that rule (CUVR-001 to CUVR-011, CUVR-013 to CUVR-016), a parameter message or an error code of the spec (CUVR-041 to CUVR-057), a hidden field (CUVR-017), or a case whose name and note state the construct it tests (CUVR-018 to CUVR-040); the map also keeps CUEC-003, CUEC-005 and CUEC-006 (C16.57-4). `config/parity.json` adds the 56 cited ids to the requirements of the `validate` unit. CUVR-012 (`date`, `dateISO`) has no case in any suite and is not cited; CUVR-002 cites the `email` cases only, because no case uses `url`. The list-validity, detail-validity and spec-validity suites test the shape of a specification (keys, forbidden members, layout), not the rules, so they cite nothing and get no unit here. Red: `make parity-declarations-check` exit 2 with 603 findings, 57 R13 findings for CUVR-001 to CUVR-057; green: exit 2 with 547 findings, 1 R13 finding (CUVR-012), and 0 R14 and 0 R15 for the validate unit. The R13 findings of CUEC-001, CUEC-002, CUEC-004 and CUEC-007 and the R2 and R6 findings of other rows are unchanged. Owner tests: ts vitest `validate.conformance.test.ts` 319 passed; rust `validate_matches_fixture` 1 passed; python `tests.test_validate` 3 passed; PHP library `ValidateConformanceTest` 318 passed; go `TestValidateMatchesFixture` run as `mise exec -- go test -v` in packages/validator/go, 318 subtests and the parent passed. The php-extension binding is not run: it needs C16.70 on main.

### 2026-10-20 — The validate suite cites the empty-collection requirements CUEC-003, CUEC-005 and CUEC-006 (C16.57-2)

- `tests/fixtures/validate/generate.mts` names nine cases of `cases.json` in its `REQUIREMENTS` map and writes their `requirements`: `input-repeated-group-array`, `input-repeated-scalar-null`, `input-nested-repeated-array` and `visibility-hidden-data-shape` cite CUEC-003; `multiple-only-missing-data-required`, `multiple-only-missing-data-mincount` and `multiple-only-missing-data-valid` cite CUEC-005; `visibility-hidden-group-descendants` and `visibility-hidden-value-still-read` cite CUEC-006. `config/parity.json` declares the suite unit `validate` over `tests/fixtures/validate/cases.json` with the requirements of its scope and six bindings: ts, go, rust and python run the cases, and php and php-extension name the PHP library test `ValidateConformanceTest::testValidateMatchesFixture` (C16.57-2). Red: `make parity-declarations-check` exit 2 with 650 findings, 3 R13 findings for CUEC-003, CUEC-005 and CUEC-006 and 1 R4 finding for `tests/fixtures/validate/cases.json`; green: exit 2 with 641 findings, 0 R13 for those ids, 0 R4 for validate, 0 R15 and 0 R14; the remaining R2 (history-functions, php-extension) and R6 are not of this row. CUEC-001, CUEC-002, CUEC-004 and CUEC-007 are not cited: they need a bindForm suite that all six implementations run. Owner tests: ts vitest `validate.conformance.test.ts` 319 passed; go `TestValidateMatchesFixture` 318 subtests passed, run as `mise exec -- go test` in packages/validator/go, because the kit runner failed to load the worktree mise.toml; rust `validate_matches_fixture` 1 passed; python `tests.test_validate` 3 passed; PHP library `ValidateConformanceTest` 318 passed. The php-extension binding is not run here: it loads Support/JsonText.php and does not pass under the extension until row C16.70 fixes the validator tests.

### 2026-10-20 — The form-state suites are cited by units whose tests name them (C16.57-1)

- `config/parity.json` declares four suite units over `tests/fixtures/{form-view,form-history,form-actions,view-functions}/cases.json`, each with the requirements its cases list: CURT-009, 010, 066, 067, 068, 073, 074 and 075; CURT-011, 012, 061 to 065 and 067; CURT-011, 012 and 081 to 091; CURT-068 to 075. Each unit binds ts, go, python, rust and php, and the three families that the PHP extension runs also bind php-extension; form-actions has no php-extension binding, because the extension has no `resolveAction` or `runAction`. `history-functions` gains the php-extension binding and CURT-062, which its cases list (C16.57-1). Red: `make parity-declarations-check` exit 2 with 650 findings, of which 29 are R13 for these families' ids, 4 are R4 for the four cases files, and 1 is R2 for the php-extension of `history-functions`. Green: exit 2 with 612 findings; 0 R13, 0 R4, 0 R14 and 0 R15 for these families, and 1 R2 left, the missing php-extension binding of form-actions, which is reported. Owner tests: vitest `src/form-state.test.ts` 28 passed; go `-run 'TestFormActions|TestFormHistory|TestFormView|TestViewFunctions'` 32 passed; python `tests.test_form_state` 4 passed; rust `--test form_state` 4 passed; phpunit `tests/FormStateTest.php` 28 passed and `tests/HistoryFunctionsTest.php` 13 passed; php-extension (PHP 8.4, `var/php-ext/polyspec_crudui.so` loaded): the three method filters of FormStateTest pass 19 tests and the nine form-actions sessions fail on the missing `resolveAction`, and HistoryFunctionsTest passes 13.

### 2026-10-20 — formHistory is declared in php, go, rust, php-native and python (C16.52)

- `contracts/features.json` sets the support of `formHistory` to `pass` for `php`, `go`, `rust`, `php-native` and `python` (C16.52), adds their history tests to its tests list, and adds the go, python, rust and php verification commands (C16.52-2..11 on main). The generated feature contract pages follow. Red: `make divergence-check` exit 2, with `contracts/features.json` naming `formHistory` unsupported in those five implementations; green: the check names no entry of `formHistory`. Here the python and rust verification commands pass (`tests.test_form_history`, `--test history_functions`); the go command is not reproduced because the worktree's `mise.toml` is reported as untrusted by the runner, and the php command because the Composer dependencies require PHP 8.5 or newer. The php-native support is declared without a php-ext run for the same PHP reason.

### 2026-10-20 — viewState is declared in php-native (C16.51)

- `contracts/features.json` sets the support of `viewState` for `php-native` to `pass` (C16.51): every implementation now holds the view state, the PHP extension included, from C16.51-7 (f6b52795). The generated feature contract pages follow. Red: `make divergence-check` exit 2, with `contracts/features.json` naming `viewState` as unsupported for `php-native`; green: the check names no entry of `viewState`, and the remaining findings belong to other rows. The php-ext verification of `FormStateTest` could not run in this worktree because the Composer dependencies require PHP 8.5 or newer, so it is not added to the verification list.

### 2026-10-20 — The PHP validator contract tests load no internal class of the library (C16.70)

- `packages/validator/php/tests/Validate/TextValidityConformanceTest.php` decodes its fixtures with a private `decodeFixture` built on `json_decode` (an unpaired surrogate escape is rewritten to a private-use code point and restored), so it no longer uses `Support\JsonText`, and its direct checks of the internal `Support\Text` and `Support\JsonText` move to `packages/validator/php/tests/Validate/TextInternalsTest.php`, which loads the PHP sources and runs against the library only (P32, C16.70). `packages/validator/php/tests/Validate/UniqueValuesTest.php` checks the rows of one validation through `Validator::validate` instead of the internal `Validate\Validator`. The `assertFalse(isInternal())` guard that asserted the pure PHP runtime is removed from the conformance tests and from `PublicApiTest` (S10: a library test does not branch on the extension; the kit's `test-php-ext` checks that no library source is loaded). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES='TextValidityConformanceTest'` with the previous test file exit 2, `A source of the PHP library was loaded, so the run did not test the extension: .../packages/validator/php/src/Support/JsonText.php`; green: the seven CASES `ValidateConformanceTest|ListValidateConformanceTest|DetailValidateConformanceTest|ForbiddenScanConformanceTest|MessagePlaceholderTest|UniqueValuesTest|TextValidityConformanceTest` exit 0 with 440 passed and no source loaded, the library PHPUnit run of the changed files OK (444 tests).

### 2026-10-20 — The Go native program rejects a wrong-typed member (C16.79)

- `tests/native-generators/programs/go` reads the request members as the Rust program does (C16.79): `compileOptions` and `optionText` return `basepath`, `keyPrefix`, `language` and the `files` object as an input error when they are not text or an object, an absent member stays absent, `stringArg` and `addOptions` report a wrong-typed or missing action argument, and `main_test.go` (new) shows each case. Red: `go test -run Test ./...` exit 1, the wrong-typed `basepath`, `keyPrefix`, `files` and `language` returned no error, and the `getValue` argument reported `Invalid form path: `; green: exit 0, `go build` exit 0, and `golangci-lint run` exit 0 with `0 issues`.

### 2026-10-20 — The copies of kit follow kit f7c1f10c (C16.80)

- `scripts/kit/kit-bootstrap.mk` and `scripts/kit/bootstrap/install-mise.mts` are the copies of kit at 0b74e988, which holds f7c1f10c (K354, K394, K386, K348-1, K360-2, K349-2, K390-1, K392-1, K393), written by `make kit-sync`; `make hooks` installs the hooks and their merge settings (C16.80). Red: `make kit-check` exited 2 with 1 copy that differs (`scripts/kit/kit-bootstrap.mk`); green: it passes.

### 2026-10-20 — The native generator Go program handles its hidden errors (C16.67-5)

- `tests/native-generators/programs/go/main.go` checks the errors that the kit lint reports (C16.67-5): `obj` and `str` read a value of another type as nil or the empty string through an `ok` check, which each caller already reports or reads as absent, `run` reads the method of an action with `str`, and `errorObject` finds the `ComposeLoadError` and `UnsupportedFieldTypeError` with `errors.As`. Behaviour does not change, because the library returns both error types unwrapped. Red: `golangci-lint run --config=../../../../.golangci.yml ./...` exited 1 with `5 issues` (errcheck 3, errorlint 2); green: exit 0 with `0 issues`, and `go build -o /dev/null ./...` exits 0 (the program has no Go test; the conformance suite runs it).

### 2026-10-20 — The offline-checks test lists the online targets that the installed kit defines (C16.7-8-1)

- `tests/build/offline-checks.test.mts` takes the online targets of kit from the `kit.mk` of the installed `@polyspec/kit` (`KIT_ONLINE`, the targets whose recipe runs `$(ONLINE)`) in addition to its list `KIT_DOWNLOADS`, so the newer kit's `worktree-setup` (K348) is listed as the online target it is (C16.7-8-1). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/offline-checks.test.mts` with kit linked exit 1, `the Makefile runs cargo, go, npm and Composer offline, and only the install targets lift it` with `+ 'worktree-setup'`; green: the same command with kit linked exit 0.

### 2026-10-20 — make lint-ts passes again (C16.73)

- `tests/build/offline-checks.test.mts` drops the unused import `makeDryRun` and `packages/php-ext/tests/engine/support.mjs` drops the unused import `test` (oxlint), `examples/form-comparison/src/local-servers.mjs` makes the constant `orderedJsonExtensionDirectory` local (knip, unused export left by C16.69), and `config/knip-entries.json` declares the entries `src/index.ts` and `src/server.ts` of `packages/react`, whose `./server` export names the type `RenderListOptions` that knip reported unused; the type is the option type of the public `renderList`, as the svelte and vue entries re-export it (C16.73). Red: `make lint-ts` exit 2, `oxlint: failed` with 2 findings (`no-unused-vars` at `tests/build/offline-checks.test.mts:15` and `packages/php-ext/tests/engine/support.mjs:7`) and `knip: failed` with 2 findings (`orderedJsonExtensionDirectory` at `examples/form-comparison/src/local-servers.mjs:23`, `RenderListOptions` at `packages/react/src/server.ts:12`); green: `make lint-ts` exit 0, the engine tests of `packages/php-ext/tests/engine/engine.test.mjs` 27 passed, `examples/form-comparison/src/local-servers.test.mjs` 6 passed, `packages/react` vitest `entry-boundary` and `list-render.conformance` 262 passed.

### 2026-10-20 — The PHP extension Form keeps its undo history: undo, redo, canUndo and canRedo (C16.52-11)

- `packages/php-ext/src/form.c` gives each form instance an undo history (`history` in `struct ps_form`, built by `history.c`): `commit` records the previous record with the dotted path of a value edit (`setValue`, `dotted_path`) or a null path for a row operation (`addRow`, `moveRow`, `copyRow`, `removeRow`, `rekeyRow`); `replace_data` (`setData`) restarts the history; undo and redo replace the record through `step_form` and `install` and keep the view; `canUndo` and `canRedo` return the history queries. `crudui.c` adds the methods `Form::undo`, `redo`, `canUndo` and `canRedo`, and `polyspec_crudui.stub.php` and `polyspec_crudui_arginfo.h` declare them (C16.52-11). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES='FormStateTest|HistoryFunctionsTest'` exited 2 at the declaration step with the four missing methods Form undo, redo, canUndo and canRedo; green: `make lint-php-ext` exit 0 and the same command exit 0 with the generator suite running 32 tests under the extension (FormStateTest and HistoryFunctionsTest, including the five form-history sessions); the validator and php-ext libraries are skipped because CASES selects no case in them (K390) (C16.52-11).

### 2026-10-20 — The Rust appearance parses an expression once and evaluates it without a fallback (C16.77)

- `packages/generator/rust/src/design.rs` `appearance` matches the parse of a string once: a ternary and a condition expression are evaluated by `Evaluator::evaluate_value` on the parsed node, and a string that does not parse stays literal text; the helper `expression_value` with its `unwrap_or(false)` is removed. `packages/generator/rust/src/tests.rs` gains `appearance_string_that_does_not_parse_stays_literal_text` and `appearance_ternary_gives_the_branch_value` (C16.77). The Rust evaluator reports no error (a path the data lacks gives null), so no evaluation error exists to return, unlike the Python and Go generators (b396f53e, 9e4be128); a failure injection needs a change of the validator crate and is not in this row. Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml appearance` on main: the appearance tests pass before and after (3 passed, the old test included), so the row records no red; green: exit 0, `appearance` 3 passed, `--test form_state --test history_functions` 17 passed, and the crate clippy run exit 0.

### 2026-10-20 — runAction rejects a name that is none of the eleven actions (C16.78)

- `docs/spec/form-runtime.md` adds CURT-091: `runAction` of a target whose `name` is none of the eleven actions fails with `INVALID_FORM_INPUT` and `Unknown action: {name}` and changes nothing (C16.78). `packages/generator/ts/src/actions.ts` `runAction` checks the name first and throws that error; it used to fall into the move branch. `packages/generator/rust/src/actions.rs` adds `ActionTarget::named`, which fails with that error for an unknown name, and `packages/generator/rust/tests/form_state.rs` builds its targets through it instead of unwrapping the name. `tests/fixtures/form-state/generate.mts` adds the session `run-action-unknown-name`, and `tests/fixtures/form-actions/cases.json` is regenerated from it. Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs vitest --cwd packages/generator/ts -- src/form-state.test.ts` with the old `actions.ts` exit 1, 27 passed and 1 failed (`run-action-unknown-name`); green: exit 0, 28 passed, 0 failed. Go, Python (`tests.test_form_state`, 4 passed) and Rust (`--test form_state`, 4 passed) already return the same message and pass the new case.

### 2026-10-20 — PHP sources and examples pass the phpcs line length rule (C16.75)

- `packages/generator/php/src/Internal/History.php` rewraps the docblocks of `record`, `undo` and `redo` to 120 columns, and `examples/form-comparison/servers/php` rewraps the docblocks of `api.php` and `src/ApiServer.php` and a comment of `tests/FormGenerationTest.php`, without changing code (C16.75). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make lint-php` exit 2, phpcs: 8 Generic.Files.LineLength.TooLong warnings (History.php 11, 12, 27, 57, 78; api.php 5; ApiServer.php 17; FormGenerationTest.php 291); green: exit 0, and phpunit `tests/HistoryFunctionsTest.php` 13 passed, form-comparison `tests/FormGenerationTest.php` 9 passed.

### 2026-10-20 — The form comparison Rust server handles the hidden errors that the kit lint reports (C16.67-14)

- `examples/form-comparison/servers/rust/src` handles the clippy findings of `Result::ok`, `Result::unwrap_or` and `map_err_ignore`: `main.rs` `media_type` returns an error for a Content-Type that is not text instead of reading it as absent, and `generation.rs` and `records.rs` use it; `records.rs` `positive_decimal` keeps its fallback (text beyond `u64` is beyond every page) on the smallest item with a reason, and `companies` and the spec and score reads return their errors with the cause; `json.rs` names the parse error of a JSON number; `tests.rs` `stored_bytes` treats a missing store file as empty and fails the test on any other read error, so the store-unchanged check no longer passes when the file cannot be read (C16.67-14). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason` exit 101 with 11 findings (6 `Result::ok`, 1 `Result::unwrap_or`, 4 `map_err` wildcards); green: exit 0, and `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo ... tests::` passes 18 of 18. The benchmark test failed on the first run, because the store file it reads is absent in the fixture and `.ok()` had hidden the read error; the test now expects that absence.

### 2026-10-20 — The cross-check validator process checks the errors it does not check (C16.67-4)

- `examples/cross-check-console/validators/go/main.go` checks the basepath assertion of `parseRequest` and returns the request message `Request basepath must be a string` when it fails, and it states the invariant of the `json.Marshal` calls of `fatal` and `failure` in a panic with its message (C16.67-4). Behaviour does not change: each assertion holds for every request that reaches it. Red: `golangci-lint run --config=../../../../.golangci.yml ./...` exited 1 with `3 issues` (errcheck 3); green: exit 0 with `0 issues`, and `go build -o /dev/null ./...` exits 0 (the module has no test).

### 2026-10-20 — The Python files that ruff format reports are formatted (C16.74)

- `packages/generator/python` is formatted as `ruff format` requires (C16.74): `src/polyspec/crudui/generator/form.py` wraps the `_normalize_row` signature and one dictionary key expression, and `tests/test_form_state.py` joins one `assertEqual` call onto a line. Only the layout changed. Red: `ruff format --check --config ruff.toml .` exit 1 with `2 files would be reformatted`; green: exit 0 with `250 files already formatted`, `make lint-python` exit 0, and `tests.test_form_state` gives `4 passed, 0 failed`.

### 2026-10-20 — ordered-json is consumed by version 0.0.9 (C16.69)

- The root `package.json` declares `@polyspec/ordered-json` as the release asset `polyspec-ordered-json-npm-0.0.9.tgz` of the tag `v0.0.9` by its URL, pinned in `package-lock.json` with its SHA-512 integrity like `@polyspec/kit`, instead of `file:` to the clone of `.form-comparison/sources`; `config/release-assets.json` declares the PHP extension zip `polyspec-ordered-json-extension-php-0.0.9.zip` by its sha256 with `unpack` to `var/ordered-json-php-ext`, and `examples/form-comparison/src/local-servers.mjs` builds the `ordered_json` PHP extension from the unpacked `src/` (`orderedJsonExtensionDirectory`, `orderedJsonCopyArguments`, `orderedJsonExtension`). The self-made clone is removed: `examples/form-comparison/src/ordered-json-source.mjs`, `examples/form-comparison/src/ordered-json-source.test.mjs` and `examples/form-comparison/install-ordered-json.mjs` are deleted, with the make target `crudui-install-ordered-json` and its prerequisites of `install-packages` and `crudui-install-crates`, the `taggedNpmPackages` key of `config/dependency-policy.json`, and the paths of `config/rebuild.json` and `config/owner-checks.json` (C16.69). Tests removed: `tests/build/dependency-health.test.mts` "config/dependency-policy.json records the OrderedJSON tag that the comparison installs", `tests/build/atomic-publish.test.mts` publication "the OrderedJSON checkout", and `tests/build/offline-checks.test.mts` "make install-packages starts the node of the checkout before kit is installed" and "the OrderedJSON installer imports no package, since it runs before make install-packages". Tests changed: `tests/build/dependency-health.test.mts` "npm installs only registry packages, linked directories and the kit release asset..." allows the `@polyspec/ordered-json` release asset too, and `examples/form-comparison/src/local-servers.test.mjs` "the copy of the unpacked OrderedJSON extension source..." reads `<extension>/src` instead of the checkout. Red: `node ../kit/dist/link.mjs check ../crudui ../kit ../ordered-json` exit 1 with `NOT linked npm @polyspec/ordered-json (not recorded by npm query: .../node_modules/@polyspec/ordered-json)`; green: exit 0 with `linked npm @polyspec/ordered-json -> .../ordered-json/packages/js`, `go -run Test ./...` of `examples/form-comparison/servers/go` exit 0, `examples/form-comparison/src/local-servers.test.mjs` exit 0, `make rebuild-check` and `make owner-validate` exit 0, and the build tests pass with kit unlinked (`dependency-health`, `atomic-publish`, `offline-checks`).

### 2026-10-20 — The Rust generator handles the hidden errors of the kit lint (C16.67-13)

- `packages/generator/rust/src/date.rs` reads the digit runs that its expressions capture with an invariant message (`CAPTURED_DIGITS`), `design.rs` keeps the reference fallback of a condition expression that does not evaluate (false, as `expr.ts` reads it) in the two helpers `expression_flag` and `expression_value`, `instance.rs` checks the position of `move_row` before converting it, `list.rs` keeps a text that is no index as a label (`choice-label`) and propagates an error of `pagination.per_page` in `pagination_model`, `number.rs` keeps the reference reading of a text that is no number in `decimal`, `util.rs` keeps the path lookup of a segment that is no index, `messages/mod.rs` and `tests.rs` replace `unwrap_or_else` with a `match` of the same behaviour, and `tests.rs` gains `pagination_per_page_that_is_no_integer_is_an_error` (C16.67-13). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason` exit 101 with 21 findings in the library (`Result::ok`, `Result::unwrap_or`, `Result::unwrap_or_else`) and 24 in its unit tests; green: exit 0, and `tests` 39 passed, `date` 2, `design` 3, `list` 6, `number` 2, `messages` 1, `--test form_state --test history_functions` 17 passed.

### 2026-10-20 — The Go generator returns the evaluation error of an appearance ternary (C16.72)

- `packages/generator/go` returns the evaluation error of an appearance or show ternary instead of rendering an empty string (C16.72): `design.go` `evalAppearance`, `evalShow`, `resolveParameter`, `resolveNode` and `resolveDesign` return `(…, error)`, and the callers in `bind.go`, `buttons.go` and `list.go` return it; a string that does not parse stays literal text. `display_design_test.go` `TestAppearanceErrorsAreNotHidden` injects the failure through the `evaluateValue` variable and shows that `NewForm` returns it. Red: `go test -run TestAppearanceErrorsAreNotHidden` exit 1, `panic: expr: evaluating "1 > 0 ? 'btn-a' : 'btn-b'" after a successful parse: injected evaluation failure`; green: exit 0, and `go test -run Test ./...` gives `161 passed, 0 failed`, with `golangci-lint run` exit 0.

### 2026-10-20 — The native Rust generator program handles the hidden error that the kit lint reports (C16.67-9)

- `tests/native-generators/programs/rust/src/main.rs` `main` no longer discards the error of reading standard input: a `std::io::ErrorKind::InvalidData` error (input that is not UTF-8) keeps the message `Request must be valid JSON`, and any other read failure is returned as `Cannot read the request: <error>` (C16.67-9). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason` exit 101 with 1 finding (`map_err` wildcard pattern at src/main.rs:340); green: exit 0, `cargo build --locked` of the crate exits 0, and non-UTF-8 standard input still prints the same error with exit 1.

### 2026-10-20 — The benchmark validator driver handles its hidden errors (C16.67-3)

- `benchmarks/validators/go` returns the errors of `loadFixture` and `benchSpec` (a fixture that is not JSON, a spec that is not a JSON object, a spec without properties) instead of panicking, and `main` prints them and exits 1; the JSON encoding of a report in `main` is an invariant with its message; `main_test.go` checks the wrong-input cases (C16.67-3). Red: `golangci-lint run` exited 1 with `3 issues` (errcheck 3), and `go test -run Test ./...` did not build: `assignment mismatch: 3 variables but loadFixture returns 2 values`; green: exit 0 with `0 issues`, and `go test -run Test ./...` gave `5 passed, 0 failed`.

### 2026-10-20 — The copies of kit follow kit f9eb43dd (C16.71)

- `scripts/kit/kit-bootstrap.mk`, `config/layout.kit.yml` and the new commit-msg hook `.githooks/commit-msg` are the copies of kit at f9eb43dd (K348, K385, K384, K360-1, K383, K380, K382, K375), written by `make kit-sync` and `make hooks` (C16.71). Red: `make kit-check` exited 2 with 2 copies that differ (`scripts/kit/kit-bootstrap.mk`, `config/layout.kit.yml`); green: it passes. `make link-check` still names `@polyspec/ordered-json` (row C16.69) and the Python environment `var/python`, which `make link-check` is not given.

### 2026-10-20 — The Python generator has resolveAction and runAction (C16.50-2)

- `packages/generator/python/src/polyspec/crudui/generator/actions.py` adds `resolveAction` and `runAction` over the eleven form actions of CURT-081 to CURT-090, exposed as `Generator.resolveAction` and `Generator.runAction`; `form.py` keys the default row of a repeated field that the data omits with `__0000000000000__` at construction, `setData` and `setValue` (CUEC-002) and with a fresh key inside a row that `addRow` creates, as the TypeScript reference and the `form-actions` sessions do; `tests/test_form_state.py` runs the `form-actions` sessions with the history flags in `TestFormActions` (C16.50-2). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs python --venv var/python --cwd packages/generator/python -- tests.test_form_state` exit 1, 7 of the 8 `form-actions` sessions failing on the observed result (the two functions stubbed to return None); green: exit 0, 4 passed, 0 failed.

### 2026-10-20 — The Rust record server of the form comparison builds with the view option (C16.51-5-1)

- `render` of `examples/form-comparison/servers/rust/src/generation.rs` sets the `BindOptions` member `collapsed` that C16.51-5 added to null, the initial view with every row expanded (CURT-068), and its test `compilation_and_cached_rendering_use_rust_and_preserve_order` asserts that every collapsible row of the rendered fields is expanded (C16.51-5-1). Red: `cargo test compilation_and_cached_rendering` of the server ended with `error[E0063]: missing field collapsed in initializer of BindOptions` and ran no test; green: 1 passed.

### 2026-10-20 — The cross-check console Rust validator handles the hidden error that the kit lint reports (C16.67-8)

- `examples/cross-check-console/validators/rust/src/main.rs` `write_line` serializes the JSON line with `expect` and an invariant message, instead of `Result::unwrap_or_else` with a fallback `"{}"` that would print a wrong line (C16.67-8). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason` exit 101 with 1 finding (`Result::unwrap_or_else` at src/main.rs:210); green: exit 0, and `cargo build --locked` of the crate exits 0.

### 2026-10-20 — The form-comparison Go server handles its hidden errors (C16.67-2)

- `examples/form-comparison/servers/go` checks or returns every error that the kit lint reports (C16.67-2): `repository.go` returns an error when the stored form state has another type (`storedRows`, `sortedRows`, `owned`, `checkParent`, `allocate`, `loadData`, `save`) instead of an unchecked assertion; `records.go` returns the errors of `submission`, `submittedForm`, `saveRecord`, `formText` and `recordView`, and `storedRecord` states the invariant that `checkRecords` establishes; `form.go` compares the end of a multipart body with `errors.Is` and checks the member names of `fieldsOf`; `json.go` checks the errors of `Members`, `Items`, `NumberLiteral` and the `Atoi` of `numberText`; `main.go` and `generator.go` log a failed response write and find the form input error with `errors.As`; the tests use the `objectOf`, `arrayOf`, `textOf`, `mustEncode` and `mustRead` helpers, which fail with `t.Fatal`. Red: `golangci-lint run --config=../../../../.golangci.yml ./...` exited 1 with `66 issues` (errcheck 64, errorlint 2); green: exit 0 with `0 issues`, and `go test -run Test ./...` gave `16 passed, 0 failed`.

### 2026-10-20 — The Go generator handles its hidden errors (C16.67-12)

- `packages/generator/go` checks or returns every error that the kit lint reports (C16.67-12): `bind.go` reads `design.layout`, `group_class` and the `unsupported` option with checked assertions and returns a non-string value as an error; `buttons.go` returns the error of a button `behavior` script from `bindButtons`, `BindButtons` and `RenderForm`; `instance.go` checks the path of every row operation and `Form.Template` now returns `(*FormTemplate, error)` with the clone error; `design.go` evaluates an expression it has parsed through `evaluateParsed`; `date.go` and `number.go` read digit runs with invariant messages, and `date.go` reads an unmatched optional group as 0; `widget.go` states the `json.Marshal` and `Encode` calls as invariants; `choice_list.go`, `form_render.go`, `list.go`, `template.go`, `value.go` and `examples/server/main.go` use checked assertions, `copyObject`, `orderedObject`, `plainObject` and `errors.As`; the tests fail with `t.Fatal` on the error of their fixture. Red: `golangci-lint run` exited 1 with `74 issues` (errcheck 73, errorlint 1); green: exit 0 with `0 issues`, and `go test -run Test ./...` gave `160 passed, 0 failed`.

### 2026-10-20 — The Rust native generator program builds with the i64 row index (C16.50-3-1)

- The `moveRow` operation of `tests/native-generators/programs/rust/src/main.rs` reads its index as an `i64` and keeps refusing a negative or non-integer index with `Row position must be a nonnegative integer`, since C16.50-3 changed `Form::move_row` to take an `i64` (C16.50-3-1). Red: `cargo build --locked --manifest-path tests/native-generators/programs/rust/Cargo.toml` exited 101 with `error[E0308]: mismatched types` (expected `i64`, found `usize`) at `main.rs:147`; green: exit 0.

### 2026-10-20 — The Rust generator has resolveAction and runAction (C16.50-3)

- `packages/generator/rust/src/actions.rs` adds `resolve_action`, `run_action` and the types `ActionName`, `ActionInput`, `ActionTarget`, `ActionResult` and `FocusTarget` over the eleven form actions of CURT-081 to CURT-090, `packages/generator/rust/src/instance.rs` takes a signed position in `move_row` so that a position before the first row fails with the reference message, and `packages/generator/rust/tests/form_state.rs` runs the `form-actions` sessions with the history flags in `form_actions_sessions_equal_the_recorded_observations`, whose `perform` handles `resolveAction` and `runAction` (C16.50-3). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml --test form_state` exit 1, 3 passed and 1 failed; the `form-actions` session `resolve-action-names` fails at step 0 with the API stubbed to zero values; green: exit 0, 4 passed, 0 failed.

### 2026-10-20 — The Rust benchmark handles the hidden errors that the kit lint reports (C16.67-7)

- `benchmarks/validators/rust/main.rs` handles the clippy findings of `Result::unwrap_or_else` and `Result::ok`: `load_fixture` and `bench_spec` return `Result<_, String>` with the same read and parse messages, `main` stops the bench with that message as before (a bad fixture still exits 101), and `count_argument` parses the digits that its filter has already checked, with an invariant message (C16.67-7). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason` exit 101 with 3 findings (`Result::unwrap_or_else` at main.rs:36 and :38, `Result::ok` at main.rs:109); green: exit 0, and a bad fixture still exits 101 with the same message.

### 2026-10-20 — The Rust validator handles the hidden errors that the kit lint reports (C16.67-6)

- `packages/validator/rust` handles the clippy findings of `Result::ok`, `Result::unwrap_or`, `Result::unwrap_or_else` and `map_err_ignore`: `expr/lexer.rs` returns an error for a number text that does not parse (such as `1e`) instead of reading it as 0, `text.rs` checks hex digits before reading them and reads the expression of a JSON string with an invariant message, `validate/rules.rs` and `validate/numeric.rs` read digits and numeric text with an invariant message, `validate/visibility.rs` evaluates the node it has already parsed, and the conformance tests and unit tests fail with the read or parse error of their fixture (C16.67-6). The fallbacks that the JS reference defines stay, each on its smallest item with a reason: the condition that does not parse is false (`expr/condition_map.rs` `key_holds`, `validate/validator.rs`, `validate/rules.rs` `item_passes_condition`), the value that does not parse is false (`validate/validator.rs` `evaluate_expression_value`), a non-numeric string is None (`expr/evaluator.rs` `js_number`), and a JSON number that serde_json rejects is invalid input (`text.rs` `number_value`). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason` exit 101 with 23 findings in the library and its unit tests (7 `Result::ok`, 10 `Result::unwrap_or`, 5 `Result::unwrap_or_else`, 1 `map_err_ignore`), and 18 more in the integration tests, which cargo reports once the library compiles; green: exit 0, and the tests of the filters `expr`, `text`, `compose`, `validate`, `types` (1, 12, 23, 46, 23 passed) and of the seven changed conformance test binaries pass.

### 2026-10-20 — config/generated.json declares the generated paths, and the pre-commit hook runs its check (C16.68)

- `config/generated.json` declares the generated globs of crudui (`var/**`, `dist.next/**`, `**/.phpunit.cache/**`, the `go.work` files that `make link` writes, ...) with an empty `exceptions` list; `config/owner-checks.json` gives it and `clippy.toml` an owner; `AGENTS.md` and `AGENTS.ko.md` name `generated` among the configuration files; `make hooks` writes `.githooks/pre-commit` (kit K362) (C16.68). Red: `make hooks-check` exit 2, `config/generated.json does not exist, and the pre-commit hook needs it`; green: `make hooks-check` exit 0 and `make owner-validate` exit 0.

### 2026-10-20 — The Go validator handles its hidden errors (C16.67-1)

- `packages/validator/go` checks or returns every error that the kit lint reports (C16.67-1): `types.go` returns the decoder error of `rejectForbiddenKeys` and `objectMembers` and checks the object keys of `orderedRawObject` and `objectMembers`; `expr/lexer.go` turns a malformed number into an invalid token; `validate/validator.go` returns the shape error of `collectHidden` and reads the repeated and group data through `objectValue`; `validate/rules.go` encodes unique keys without an unchecked `json.Marshal`; the conformance tests use `errors.As` and fail with `t.Fatal`. Red: `golangci-lint run` exited 1 with `72 issues` (errcheck 63, errorlint 7, nilerr 2); green: exit 0 with `0 issues`, and `go test -run Test ./...` gave `825 passed, 0 failed`.

### 2026-10-20 — The Go generator has resolveAction and runAction (C16.50-1)

- `packages/generator/go/actions.go` adds `ResolveAction`, `RunAction` and the types `ActionInput`, `ActionTarget`, `ActionResult` and `FocusTarget` over the eleven form actions of CURT-081 to CURT-090, and `packages/generator/go/form_state_test.go` runs the `form-actions` sessions with the history flags in `TestFormActions`, whose `performStep` handles `resolveAction` and `runAction` (C16.50-1). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd packages/generator/go -- -run 'TestFormActions|TestFormHistory|TestFormView' .` exit 1, 11 passed and 8 failed, 7 of the 8 `form-actions` sessions fail on the observed result (the API stubbed with zero values); green: exit 0, 19 passed, 0 failed.

### 2026-10-20 — Appearance ternaries propagate evaluation errors (C16.67-11)

- `appearance` in `packages/generator/python/src/polyspec/crudui/generator/design.py` checks that a string parses with `_parses` instead of catching the errors of a ternary evaluation in an `except` that passes, so an evaluation error of a ternary propagates and is no longer swallowed; `TestAppearanceErrorsAreNotHidden` in `packages/generator/python/tests/test_form_render.py` injects the error and checks that it propagates, and checks that a string outside the grammar stays literal text (C16.67-11). Red: `ruff check` of `design.py` exit 1 with the S110 finding, and `run-tests.mjs python ... -- tests.test_form_render` exit 1, 4 passed and 1 failed (`ZeroDivisionError not raised`); green: ruff exit 0, and `tests.test_render` and `tests.test_form_render` exit 0, 8 passed.

### 2026-10-20 — The Rust form instance keeps its undo history (C16.52-9)

- `Form` in `packages/generator/rust/src/instance.rs` keeps the undo history of its record with the pure functions of `history.rs`: `undo` and `redo` (CURT-011, CURT-012), `can_undo` and `can_redo` (CURT-061). `set_value` records a change with its path, `add_row`, `copy_row`, `move_row`, `remove_row` and `rekey_row` record one without a path, and `set_data` restarts the history (C16.52-9). `packages/generator/rust/tests/form_state.rs` runs the `form-history` sessions with the history flags (C16.52-9). Red: `cargo test --test form_state` did not compile, `no method named undo` (four E0599 errors: undo, redo, can_undo, can_redo), exit 1; green: `form_state` and `history_functions` pass 16 tests, `form_history_sessions_equal_the_recorded_observations` among them, exit 0.

### 2026-10-20 — The Go form instance keeps its undo history (C16.52-7)

- `Form` in `packages/generator/go/instance.go` keeps a `History` of records in the field `history` and has `Undo`, `Redo`, `CanUndo` and `CanRedo`; `commitView` records every data change with the path of a value edit, `SetData` restarts the history, and `TestFormHistory` in `packages/generator/go/form_state_test.go` runs the `form-history` sessions with the history flags (C16.52-7). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd packages/generator/go -- -run 'TestFormHistory|TestFormView|TestHistoryFunctions' .` exit 1, 18 passed and 6 failed, the history sessions fail with `unknown step undo`; green: exit 0, 24 passed, 0 failed.

### 2026-10-20 — The Python form instance keeps its undo history (C16.52-8)

- `packages/generator/python/src/polyspec/crudui/generator/form.py` gives `Form` the methods `undo`, `redo`, `canUndo` and `canRedo` over the pure functions of `history.py`; `setValue` records its path, `setData` clears the history, and the undo and redo steps change `revision` without changing the view state (C16.52-8). `packages/generator/python/tests/test_form_state.py` runs the `form-history` sessions with the history flags beside the `form-view` sessions. Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs python --venv var/python --cwd packages/generator/python -- tests.test_form_state tests.test_form_history` exit 1, 5 of 16 tests failed (`AttributeError: 'Form' object has no attribute 'canUndo'`); green: exit 0, 16 passed, 0 failed.

### 2026-10-20 — The Python validator's date parser names its layout fallback (C16.67-10)

- `packages/validator/python/src/polyspec/crudui/validator/rules.py` has `_strptime_layout`, which returns None for a value that has another layout, and `_parse_date` tries every accepted layout through it, so no `try`/`except` block continues or passes silently (C16.67-10). Red: `ruff check --config ruff.toml rules.py` exit 1, 2 findings S112 `try`-`except`-`continue` at lines 455 and 460; `tests.test_validate` 3 passed and `tests.test_text_validity` 4 passed; green: ruff exit 0 (`All checks passed!`), both test modules pass (3 and 4 passed).

### 2026-10-20 — Add view state and history to the extension (C16.51-7)

- The PHP extension registers `Generator::initialView`, `collapsibleRows`, `setAllExpandedView`, `toggleRowView`, `removeRowView`, `rekeyRowView`, `emptyHistory`, `recordChange`, `canUndo`, `canRedo`, `undoChange` and `redoChange` (`packages/php-ext/src/crudui.c`, `view.c`, `history.c`), `Form::toggleRow` and `Form::setAllExpanded` (`form.c`, `crudui.c`), the view of each form instance (`form.c`), and the `bindForm` option `collapsed` (`binding.c`), with the stub and arginfo of the extension (C16.51-7). Red: `make test-php-ext CASES='FormStateTest|HistoryFunctionsTest'` reported the extension differs from the PHP library: 14 missing methods (`Form::setAllExpanded`, `Form::toggleRow`, and 12 `Generator` view and history methods); green: `make lint-php-ext` exits 0; `make test-php-ext CASES='FormStateTest|HistoryFunctionsTest'` exits 0, with the declaration step passing, the generator suite running 27 tests under the extension (FormStateTest 14, HistoryFunctionsTest 13) and passing, and the validator and php-ext libraries skipped because CASES selects no case in them (K390) (C16.51-7). The earlier run of `FormTest|OutlineTest|RenderingConformanceTest` passed 215 generator tests (C16.51-7).

### 2026-10-20 — The PHP generator runs the form actions (C16.50-4)

- `Generator::resolveAction` and `Generator::runAction` in `packages/generator/php/src/Generator.php` resolve an action button's target and run the eleven actions on a `Form` (CURT-081 to CURT-090), with the result `focus` shaped as in the TypeScript reference; `packages/generator/php/tests/FormStateTest.php` runs the shared `form-actions` sessions (C16.50-4). Red: `phpunit tests/FormStateTest.php` exit 1, `Failures: 7` with the stub methods returning null; green: `tests/FormStateTest.php` exit 0, `OK (27 tests, 294 assertions)`, and `tests/DocCoverageTest.php` exit 0, `OK (1 test, 64 assertions)`.

### 2026-10-20 — The PHP form instance keeps its undo history (C16.52-10)

- `Form` in `packages/generator/php/src/Form.php` has `undo()`, `redo()`, `canUndo()` and `canRedo()`, keeps the history with `Generator::recordChange`, `undoChange` and `redoChange`, and `setData` restarts it; `packages/generator/php/tests/FormStateTest.php` runs the shared `form-history` sessions with the `canUndo` and `canRedo` flags (C16.52-10). Red: `phpunit tests/FormStateTest.php` exit 1, `Errors: 5` with `Call to undefined method Polyspec\Crudui\Form::undo()` and `::canUndo()`; green: `tests/FormStateTest.php` exit 0, `OK (19 tests, 254 assertions)`, and `tests/DocCoverageTest.php` exit 0, `OK (1 test, 62 assertions)`.

### 2026-10-20 — The adapters take the list and detail renderers and the action and widget root markup from the core (C16.58-4)

- `@polyspec/crudui-generator-core` has `listRenderer`, `detailRenderer`, `sortDir`, `actionHtml`, `isUnsupported` and `widgetRootHtml` in its internal entry and the types `RenderList`, `RenderListOptions`, `RenderDetail` and `AnyWidget` in its public entry; `renderList` and `renderDetail` of React and Svelte, `sortDir` and `actionHtml` of the Vue and Svelte lists and `AnyWidget`, `isUnsupported` and `widgetRootRaw` of the React, Vue and Svelte widgets use them, and `contracts/features.json` declares the six internal names (C16.58-4). Red: `make duplication-check` found 40 clones, 6 of them between `packages/react/src/server.ts`, `packages/svelte/src` and `packages/vue/src/components`; green: 34 clones, none in the adapters, and the list, detail and form render conformance tests pass in React (811), Vue (786) and Svelte (786).

### 2026-10-20 — The contract manifest declares the internal raw markup exports of generator-core (C16.64)

- The entry `./internal` of `@polyspec/crudui-generator-core` in `contracts/features.json` declares the 13 raw markup helpers that the React, Vue and Svelte adapters import since C16.27 (`affixHtml`, `choiceLabelClass`, `choicesHtml`, `escAttr`, `escText`, `groupButtonHtml`, `hasEventAttr`, `rawControl`, `rawElement`, `rawOptions`, `rawVoid`, `searchHtml`, `serializeAttrs`), and `docs/operations/feature-contracts.md` lists them (C16.64). Red: `make manifest-check` exited 2 with `"./internal": exported but not declared` and those 13 names; green: it passes with 21 features, 7 packages with 10 entries and 26 fixture links.

### 2026-10-20 — The repository-writing test accepts gate, the term of kit (C16.65-1)

- `tests/docs/repository-writing.test.mts` no longer discourages the word gate, which is the term of kit for its checks (PRINCIPLES P31, `make kit-gates`, `.github/workflows/gates.yml`), and states that reason beside its list (C16.65-1). Red: the test ended `5 passed, 1 failed` with 34 findings `acceptance-check metaphor: "gate"`, the first `CHANGELOG.ko.md:149`; green: `6 passed, 0 failed`.

### 2026-10-20 — The PHP generator has the history functions (C16.52-6)

- `Generator::emptyHistory`, `recordChange`, `canUndo`, `canRedo`, `undoChange` and `redoChange` of `packages/generator/php` (rules in `src/Internal/History.php`) follow CURT-062, CURT-063 and CURT-076 to CURT-080 over a history object `{entries, redoEntries, lastPath?}`; an undo or a redo with nothing to restore throws `FormError` with `INVALID_FORM_INPUT` and `Nothing to undo` or `Nothing to redo`. `HistoryFunctionsTest` runs the 13 cases of `tests/fixtures/history-functions/cases.json` as data sets named by the case, and `config/parity.json` binds it to the unit `history-functions`; green: 13 of 13 pass (run with PHP 8.5, because the vendor directory of the main checkout requires it). The row stays `[~]` until the verification command runs in a checkout with a vendor directory.
- Under PHP 8.4.26, the pinned minor, with the linked vendor, `HistoryFunctionsTest` passes its 13 cases after the rebase onto main (C16.52-6).

### 2026-10-20 — The Rust generator has the history functions (C16.52-5)

- `packages/generator/rust/src/history.rs` defines `History<T>` (`entries`, `redo_entries`, `last_path`) and `empty_history`, `record_change`, `can_undo`, `can_redo`, `undo_change` and `redo_change` as CURT-062, CURT-063 and CURT-076 to CURT-080 state them; an undo or a redo with nothing to restore returns a `FormError` with `INVALID_FORM_INPUT` and `Nothing to undo` or `Nothing to redo`. The test target `history_functions` (`harness = false`, with `libtest-mimic` as a dev-dependency, so that a test is named by the case, such as `history_functions::empty-history`) runs the 13 cases of `tests/fixtures/history-functions/cases.json`, and `config/parity.json` binds it to the unit `history-functions`; red: the test did not compile without the functions, green: 13 of 13 pass, and `clippy -D warnings` and `rustfmt` report nothing for the new files. The review record of `config/dependency-review.json` still has to record the new lock of the crate.

### 2026-10-20 — The Go generator has the history functions (C16.52-4)

- `packages/generator/go/history.go` defines `History[T]` (`Entries`, `RedoEntries`, `LastPath`) and `EmptyHistory`, `RecordChange`, `CanUndo`, `CanRedo`, `UndoChange` and `RedoChange` as CURT-062, CURT-063 and CURT-076 to CURT-080 state them: a value edit on the path of the last edit shares its entry, each direction keeps 100 records, and an undo or a redo with nothing to restore returns the error `Nothing to undo` or `Nothing to redo`. `TestHistoryFunctions` runs the 13 cases of `tests/fixtures/history-functions/cases.json` as subtests named by the case, and `config/parity.json` binds it to the unit `history-functions`; red: the test did not compile without the functions, green: 13 of 13 pass and the other tests of the package pass.

### 2026-10-20 — The TypeScript test of history-functions is a binding (C16.52-3)

- `packages/generator/ts/src/history-functions.test.ts` runs the 13 cases of `tests/fixtures/history-functions/cases.json` as top-level tests named by the case, and `config/parity.json` binds it to the unit `history-functions`; `form-state.test.ts` keeps the other function and session families. Go has no history function yet, so the declaration still lacks the bindings of php, php-extension, go and rust; red: the unit had no TypeScript binding, green: 13 of 13 pass.

### 2026-10-20 — The Python generator has the history functions (C16.52-2)

- `Generator.emptyHistory`, `recordChange`, `canUndo`, `canRedo`, `undoChange` and `redoChange` of `packages/generator/python` follow CURT-063 and CURT-076 to CURT-080: a history is `{entries, redoEntries, lastPath?}`, a value edit on the path of the last edit shares its entry, each direction keeps 100 records, and an undo or a redo with nothing to restore raises `FormError` with `INVALID_FORM_INPUT` and `Nothing to undo` or `Nothing to redo`. `config/parity.json` declares the unit `history-functions` over `tests/fixtures/history-functions/cases.json` with the binding `packages/generator/python/tests/test_form_history.py`; red: the 13 cases failed with a missing method, green: 13 of 13 pass, and `ruff` and `vulture` report nothing. The other implementations get their binding in the sub-items that implement `formHistory` there (C16.52).

### 2026-10-20 — View state in the PHP generator (C16.51-6)

- The PHP generator has the view functions `initialView`, `toggleRowView`, `collapsibleRows`, `setAllExpandedView`, `removeRowView` and `rekeyRowView` on `Generator`, the `bindForm` option `collapsed`, `Form::toggleRow` and `Form::setAllExpanded`; `removeRow`, `rekeyRow` and `setData` change the view and a view change leaves the revision. `viewState` is `pass` for PHP in `contracts/features.json`. Red: `FormStateTest` failed in every `form-view` and `view-functions` case (`Call to undefined method Form::toggleRow()`, `Generator::collapsibleRows()`). Green: its 14 cases pass with the 28 tests of `FormTest`, `DocCoverageTest` and `OutlineTest`, and `phpstan` passes.
- Under PHP 8.4.26, the pinned minor, with the linked vendor, `FormStateTest` passes its 14 cases after the rebase onto main (C16.51-6).

### 2026-10-20 — View state in the Rust generator (C16.51-5)

- The Rust generator has `ViewState` and the view functions `initial_view`, `toggle_row_view`, `collapsible_rows`, `set_all_expanded_view`, `remove_row_view` and `rekey_row_view`, the `BindOptions` member `collapsed`, `Form::toggle_row` and `Form::set_all_expanded`; `remove_row`, `rekey_row` and `set_data` change the view and a view change leaves the revision. `set_value` commits the record without restarting the view; it had called `set_data`. `viewState` is `pass` for Rust in `contracts/features.json`. Red: `tests/form_state.rs` did not compile (`unresolved imports` of the view functions, no method `toggle_row`). Green: its two tests pass and the 37 unit tests and clippy with `-D warnings` still pass.

### 2026-10-20 — View state in the Python generator (C16.51-4)

- The Python generator has the view functions `initialView`, `toggleRowView`, `collapsibleRows`, `setAllExpandedView`, `removeRowView` and `rekeyRowView` on `Generator`, the `bindForm` option `collapsed`, `Form.toggleRow` and `Form.setAllExpanded`; `removeRow`, `rekeyRow` and `setData` change the view and a view change leaves the revision. `viewState` is `pass` for Python in `contracts/features.json`. Red: `tests.test_form_state` failed in every case of `form-view` and `view-functions` before the change. Green: its two tests pass, with `make lint-python`.

### 2026-10-20 — View state in the Go generator (C16.51-3)

- The Go generator has `ViewState`, `InitialView`, `ToggleRowView`, `CollapsibleRows`, `SetAllExpandedView`, `RemoveRowView` and `RekeyRowView`, the `BindOptions` member `Collapsed`, `Form.ToggleRow` and `Form.SetAllExpanded`; `RemoveRow`, `RekeyRow` and `SetData` change the view and a view change leaves the revision. `collection` no longer rejects a data-only collection; `editableCollection` does for the row operations. `viewState` is `pass` for Go in `contracts/features.json`. Red: `TestFormView` and `TestViewFunctions` did not compile (`form.ToggleRow undefined`, `undefined: ViewState`). Green: the 16 cases pass.

### 2026-10-20 — View sessions without history flags (C16.51-2)

- The sessions of `form-view` have no `canUndo` and `canRedo` in their observations, so that an implementation that has view state and no history runs them; `form-history` and `form-actions` keep them. Red: a Go form with view state and no history failed the `rekeyRow` step of `form-view` on `canUndo`. Green: the 40 cases of `src/form-state.test.ts` pass.

### 2026-10-20 — Neutral rules and shared cases of view state, history and actions (C16.51-1)

- `docs/spec/form-runtime.md` defines `CURT-061` to `CURT-090`: the snapshot flags, the history limit and merge rules, the view rules, the option `collapsed` of `bindForm`, the view and history functions, `resolveAction({ action, path?, key? })` and the eleven actions of `runAction`. The fixture families `form-view`, `form-history`, `form-actions`, `view-functions` and `history-functions` hold the cases that `tests/fixtures/form-state/generate.mts` writes from the TypeScript reference, with generated row keys named `$1`, `$2`. `resolveAction` of TypeScript takes the values of the neutral rule or a DOM button. Red: `src/form-state.test.ts` failed with `ENOENT` for `tests/fixtures/form-view/cases.json`. Green: its 40 cases pass in the TypeScript package.

### 2026-10-20 — The go.work of scripts/go is ignored by Git (C16.63-1)

- `.gitignore` ignores the `go.work` that `make link` writes beside the Go module `scripts/go`, which C16.58-5 added (C16.63-1). Red: `node node_modules/@polyspec/kit/dist/link.mjs link . ../kit ../ordered-json` exited 1 with `scripts/go/go.work is not ignored by Git in its repository`; green: it exits 0 and links every polyspec package.

### 2026-10-20 — The copies of kit follow the kit-sync (C16.67)

- `.golangci.yml`, `ruff.toml`, `clippy.toml`, `PRINCIPLES.md` and `scripts/kit/kit-bootstrap.mk` are the copies of kit after K334, K336, K353 and K355 (C16.67). Red: `make kit-check` named the 6 copies that differ; green: it passes. The hidden errors that the new lint configuration reports are the next rows: `make lint-python` fails at `ruff check .`, `make lint-go` at 6 of 14 steps and `make lint-rust` at 6 of 6.

### 2026-10-20 — buildOutline is implemented in every implementation (C16.49)

- `buildOutline` is `pass` in php, go, rust, php-native and python in `contracts/features.json`, with the Go, Rust, PHP, PHP extension and Python generators and the declaration of C16.49-1 to C16.49-7 (C16.49). Red: `make divergence-check` reported 5 `unsupported` entries of `buildOutline`; green: it reports none, 17 divergences remain.

### 2026-10-20 — The Korean changelog follows the English one after the rebase (C16.66)

- `CHANGELOG.ko.md` lists the seven entries of C16.49-1 to C16.49-7 in the order of `CHANGELOG.md` and holds one `source-sha256` marker, after the rebase of `feat/outline-C16.49` onto main (C16.66). Red: `tests/docs/changelog.test.mts` ended `2 passed, 2 failed` (`must list the same dated entries in the same order`) and `check-documents` named 3 markers; green: `4 passed, 0 failed` and `check-documents` passes.

### 2026-10-20 — The cross-check console shares its JSON parser, its download, its matrix column and its request reader (C16.58-6)

- `parseJsonText`, `downloadJson`, `matrixColumn` of `client/app.js` and `readBodyAndSpec` of `server/server.mjs` replace the copies of the data and record parsers, of the two fixture downloads, of the validate and render columns, and of the body and specification reading of six endpoints (C16.58-6). Red: `make duplication-check` reported 40 clones before; green: 37 clones after, and the targeted check passes (24 passed).

### 2026-10-20 — buildOutline in every implementation (C16.49-7)

- The feature contract declares buildOutline passing in the PHP, Go, Rust, php-native and Python implementations, with their tests. (C16.49-7)

### 2026-10-20 — Python generator buildOutline (C16.49-6)

- The Python generator has Generator.buildOutline, tested against the shared form-outline fixture. (C16.49-6)

### 2026-10-20 — PHP extension buildOutline (C16.49-5)

- The php-native extension has Generator::buildOutline, built by the C engine, answering the form-outline fixture like the other generators. (C16.49-5)

### 2026-10-20 — The PHP generator has buildOutline (C16.49-4)

- `Generator::buildOutline(array $nodes)` returns the rows of the form for the nodes that `bindForm` returns, as `stdClass` entries in the member order of the shared cases, and the PHP program of the native generator protocol answers the operation (C16.49-4). Red: the PHP program answered `Unknown generator operation` for the 5 cases of the group `outline`; green: 5 of 5 pass, `OutlineTest` passes 5 cases, and the documentation coverage test passes.

### 2026-10-20 — The Rust program answers buildOutline (C16.49-3)

- The Rust program of the native generator protocol answers `buildOutline` with `build_outline` of the generator (C16.49-3). Red: it answered `Unknown generator operation` for the 5 cases of the group `outline`; green: 5 of 5 pass and `make lint-rust` passes.

### 2026-10-20 — The native generator protocol has buildOutline, and the Go generator has BuildOutline (C16.49-2)

- The protocol of `tests/native-generators` has the operation `buildOutline` (request `nodes`, response the rows of `OutlineRow`), the JavaScript dispatcher answers it with `buildOutline`, and the group `outline` sends the nodes of `bindForm` for each case of `tests/fixtures/form-outline/cases.json` to every program and compares the rows with the reference in member order and with `expected_outline_rows`; the Go generator provides `BuildOutline(nodes)` and the Go program answers the operation (C16.49-2). Red: the Go program answered `Unknown generator operation` for the 5 cases; green: 5 of 5 pass, `TestOutlineFixture` passes, `make lint-go` passes.

### 2026-10-20 — The structure map cases carry the rows of buildOutline, and Rust has build_outline (C16.49-1)

- The cases of `tests/fixtures/form-outline/cases.json` carry `expected_outline_rows`, the rows that `buildOutline(bindForm(compileForm(spec), data, options))` returns, written by the generator of the fixture, and the Rust generator provides `build_outline(nodes)`, which returns the same rows for the nodes of its own `bind_form` (C16.49-1). Red: `native_outline_fixture` did not compile, `build_outline` being missing; green: it passes for the 5 cases, and `make lint-rust` passes.

### 2026-10-20 — The PHP and Go table generators share one reader of a contract and one writer of a generated source (C16.58-5)

- `scripts/generator-contract.php` is the reader and writer of the PHP generators and the module `scripts/go` (`tablegen`, `interfacemessages`, `unicodedata`) replaces `interface_messages_generate.go` and `unicode_data_generate.go`, which `go generate` runs through the workspace; the generated interface message tables of PHP and Python are excluded from `duplication-check` as `generated:`; the S9 exceptions, the rebuild classes, the owner rule and the release note of `scripts/go` are in the configuration (C16.58-5). Red: `make duplication-check` reported 44 clones before; green: 40 clones after, and the targeted check passes (generated tables identical).

### 2026-10-20 — The scenarios of the React form render cases share their repeated specifications (C16.58-3)

- `emailShownBySubscribe` and `groupClassByItems` hold the specifications that four and two scenarios of `packages/react/scripts/scenario-form-render-cases.ts` repeated; the generated `cases.json` is unchanged (C16.58-3). Red: `make duplication-check` reported 53 clones before; green: 50 clones after, and the targeted check passes (generator output unchanged).

### 2026-10-20 — The Rust text validators of a list and a detail are defined by one macro (C16.58-2)

- `validate_list_text` and `validate_detail_text` of `packages/validator/rust/src/text.rs` are defined by the macro `structure_text_validator!` (C16.58-2). Red: `make duplication-check` reported 54 clones before; green: 53 clones after, and the targeted check passes (8 passed).

### 2026-10-20 — The documentation link rewriters share one markdown-it attribute rewriter (C16.58-1)

- `rewriteAttribute` of `scripts/documentation-links.mts` wraps a markdown-it renderer rule for the repository links, the docs links and the image sources; the clone between `scripts/docs-web/build.mts` and `scripts/documentation-links.mts` is gone (C16.58-1). Red: `make duplication-check` reported 55 clones before; green: 54 clones after, and the targeted check passes (18 passed).

### 2026-10-20 — The go.work files of make link are ignored (C16.63)

- `.gitignore` ignores `go.work.sum` and the `go.work` beside each Go module of the repository (`benchmarks/validators/go`, `tests/native-generators/programs/go`, `examples/cross-check-console/validators/go`, `examples/form-comparison/servers/go`, `packages/validator/go`, `packages/generator/go`); the `go.work` of the root stays tracked (C16.63). Red: `node node_modules/@polyspec/kit/dist/link.mjs link ../ordered-json` stopped at `benchmarks/validators/go/go.work is not ignored by Git`; green: the Go link of `github.com/polyspec/ordered-json/packages/go` is written to `examples/form-comparison/servers/go/go.work` and `git status` shows no new file.

### 2026-10-20 — createForm is `pass` in python (C16.53)

- `contracts/features.json` declares `createForm` as `pass` for `python`: the native generator checks of the Python target record all 15 cases of `tests/fixtures/text-validity/createForm/cases.json` and all 14 cases of `tests/native-generators/cases.mts`, and `scripts/check-conformance.mts` reports no missing case of `createForm` for python with `pass`; the generated feature pages follow (C16.53). Red: `make divergence-check` reported the `partial` entry; green: it reports none.

### 2026-10-20 — The php-ext run executes every test of the php run (C16.55)

- The two tests of `examples/form-comparison/servers/php/tests/FormGenerationTest.php` that constructed the PHP library under `#[Group('php')]` construct it in a child PHP process without the extensions, so they run in the php mode and in the php-ext mode; `local-verification.mjs` and `check-verification.test.mjs` no longer pass `--exclude-group php` (C16.55). Red: the php-ext leg left 2 of the 9 tests out; green: the suite runs 9 tests and 75 assertions in the php mode and 9 tests and 75 assertions in the php-ext mode, `check-verification.test.mjs` passes (8) and `make divergence-check` reports no `--exclude-group`.

### 2026-10-20 — A neutral rule for the native value mapping (C16.61)

- `docs/spec/runtime-packages.md` states in `CURP-026` that each implementation maps the form value model to the native types of its language and back without losing the difference between an empty object and an empty array, between a missing member and `null`, the order of object members or the type of a scalar; the PHP array-or-object mapping is the PHP binding of that rule, and the other paragraphs of the section became the rules `CURP-024`, `CURP-025` and `CURP-027` (C16.61). Red: no requirement stated the mapping; green: `CURP-026` is defined and `check-documents` passes. Its tests in the six implementations are the work of C16.57.

### 2026-10-20 — The record servers build the OrderedJSON module (C16.60)

- `prepareRecordServers` copies the contents of `packages/php-ext/src` of the OrderedJSON checkout into the build directory with `orderedJsonCopyArguments`; `path.join` had dropped the trailing `/.` of the source, so `cp -R` put the directory inside the destination and `phpize` found no `config.m4` (C16.60). Red: `examples/form-comparison/record-stores.test.mjs` ended `0 passed, 130 failed` at `7cafb4fb^` and at `HEAD` with `ordered-json-phpize: failed (exit 1)`; green: the new test of `local-servers.test.mjs` passes (6 passed) and the record-stores run is `78 passed, 52 failed`: the js, go and rust stores pass and the 52 failures are the php and php-ext stores, which load `vendor/polyspec/ordered-json` that the Composer link item installs.

### 2026-10-20 — docs/spec holds only the rules of the implementations (C16.59)

- `conformance`, `examples`, `test-fixtures`, `package-build`, `feature-contracts`, `form-comparison` and `php-extension` moved from `docs/spec` to `docs/operations` with their Korean twins, and every link, path and doc id that named them follows; `runtime-packages` keeps in `docs/spec` the required capabilities, the API operations, the shared contracts and the data rules, now with the ids `CURP-n`, and its package map and verification are `docs/operations/runtime-packages.md`; `empty-collections` states its rules as the ids `CUEC-n` (C16.59). Red: `docs/spec` held 9 documents without a requirement id, 8 of them for tooling or the extension; green: every document of `docs/spec` defines requirements, `make parity-declarations-check` reports 422 R13 findings and `check-documents` passes.

### 2026-10-20 — Requirement ids in docs/spec (C16.56)

- The contract documents `display-formats`, `expressions`, `form-markup`, `form-runtime`, `input-text`, `schema` and `validation-rules` of `docs/spec` define 392 requirements, each a list item that begins with `**CU<document>-<n>**` (`CUDF`, `CUXP`, `CUMK`, `CURT`, `CUIT`, `CUSC`, `CUVR`; the prefix `CU` is used by no other polyspec repository): every top-level rule bullet, every definition paragraph that begins with a bold term in `validation-rules`, and every row of a rule table, which became one bullet; the Korean twins carry the same ids, and `requirements.pattern` of `config/parity.json` is `CU(DF|XP|MK|RT|IT|SC|VR)-[0-9]{3}` (C16.56). The documents that describe the repository tooling or the example servers (`conformance`, `examples`, `test-fixtures`, `package-build`, `feature-contracts`, `form-comparison`, `runtime-packages`, `php-extension`) define no requirement, since no contract behaviour of the six implementations is stated in them. Red: `make parity-declarations-check` reported that the pattern matches no requirement; green: it reports 392 R13 findings, one for each id that no unit cites yet (item C16.57).

### 2026-10-20 — The engine tests are internal tests of php-extension (C16.48-1)

- The `tests` and `internal` globs of the C engine tests belong to the implementation `php-extension`; the implementation `php-extension-engine` that C16.48 declared is removed, since it existed only to hold them (C16.48-1). Red: `php-extension-engine` was an implementation with no unit; green: `make parity-declarations-check` reports the declaration of `php-extension` with the internal glob. It still reports R6 for `packages/php-ext/tests/engine/engine.test.mjs`, because kit's R6 file check (`scripts/kit/parity-units.mts`, the `patterns` filter) does not leave out the files that an `internal` glob selects; it is a kit defect that is reported, not worked around.

### 2026-10-20 — Adopt the divergence, link-state and bypass gates and the internal tests (C16.48)

- `CHECK_TARGETS` lists `divergence-check`, `link-state-check` and `bypass-check`; the reasons of `config/duplication.json` and of the `tools` roots of `config/parity.json` begin with a kind that kit defines; `packages/php-ext/tests/engine/engine.test.mjs` is split into `packages/php-ext/tests/comparison/comparison.test.mjs`, which holds only the checks of the native engine against the TypeScript reference and is the comparator, and the C engine tests, which are the `internal` tests of the implementation `php-extension-engine` with a reason; the shared helpers are `packages/php-ext/tests/engine/support.mjs`, and the comma locale is chosen by the locale list instead of the platform (C16.48). Red: `make kit-check` reported 2 findings, `make divergence-check` named the unkinded reasons and `process.platform` in the engine test; green: `make kit-check` passes, the two engine test files pass (27 and 11 tests), `make parity-declarations-check` reports 0 R6. `make divergence-check` still reports the `partial` and `unsupported` entries of `contracts/features.json` and `--exclude-group` in two example scripts, which are the next items.

### 2026-10-20 — The moved C engine test runs green (C16.47-1)

- `packages/php-ext/tests/engine/engine.test.mjs` runs from its new folder with the relative paths of C16.47 and passes (C16.47-1). Green: `node --test` reports 38 passed, 0 failed, 0 timed out, 0 skipped.

### 2026-10-20 — The C engine test moves into its implementation (C16.47)

- `packages/php-ext/tests/engine.test.mjs` moved to `packages/php-ext/tests/engine/engine.test.mjs` and the folder is a comparator of `config/parity.json`, with an owner rule for that file (C16.47). Red: `make parity-declarations-check` reported 1 R6 finding; green: it reports 0.

### 2026-10-20 — The link-metadata-check gate in CHECK_TARGETS (C16.43)

- `CHECK_TARGETS` lists `link-metadata-check`, the gate that kit K305 added to `kit-gates`, and the principle files follow the current text of kit (C16.43). Red: `make kit-check` exit 1 (`CHECK_TARGETS runs no link-metadata-check`); green: exit 0.

### 2026-10-20 — The link-check gate in CHECK_TARGETS (C16.42)

- `CHECK_TARGETS` lists `link-check`, a gate that kit added to `kit-gates`, and `make kit-sync` brought the principle files to the current text of kit (C16.42). Red: `make kit-check` exit 1 (`CHECK_TARGETS runs no link-check`, and the two principle files differ); green: exit 0.

### 2026-10-20 — The PHP extension builds with phpize (C16.9)

- `make build-php-ext` of kit builds `polyspec_crudui.so` with `phpize`, `configure` and `make` into `var/php-ext`; `scripts/php-extension-builder.mts`, `build-crudui-php-extension.mts`, `build-ordered-json-php-extension.mts` and the builder test are removed; `crudui-build`, `crudui-test-php-api` and the CI targets use `build-php-ext`; the CI jobs install `phpize` and `php-config` through `setup-php` instead of naming a `php-config` file; the local form-comparison run builds the OrderedJSON module with `phpize` in a copy of its source; the version of the module comes from `composer.json` through `config.m4` (C16.9). Red: the test `The PHP module builds with phpize through the build-php-ext target of kit` failed against the Makefile that built with the script; green: it passes with `make lint-php-ext`, `ApiTest` (4) against the phpize build, and the CI, test-command, atomic-publish and offline-check tests. `make test-php-ext` compares the declarations of the extension with both libraries and passes that step; its unit-test step runs the PHPUnit files of the libraries with the extension loaded, 422 of which fail because they require the pure PHP runtime, which belongs to the parity item.

### 2026-10-20 — The Rust generator test in a project command (C16.38-1)

- `tests/build/rust-generators.test.mts` is listed in the `test:runtimes` script of `package.json`, so a project command runs it (C16.38-1). Red: `every node:test file runs in a project command` of `test-commands.test.mts` failed naming that file; green: that test passes.

### 2026-10-20 — The S10 layout of the PHP extension (C16.40)

- The extension is named `polyspec_crudui` (the module entry, the `--ri` name, `extension_loaded('polyspec_crudui')` and the module file `polyspec_crudui.so`); its one stub and its arginfo header lie in `packages/php-ext/src/` as `polyspec_crudui.stub.php` and `polyspec_crudui_arginfo.h`; `packages/php-ext/composer.json` names it `polyspec/crudui-php-ext`; `packages/php-ext/src/config.m4` declares it with its sources and takes its version from `../composer.json`; and the exception of `config/layout.yml` for the old stub place is gone (kit K293) (C16.40). Red: `make lint-php-ext` exit 1 with 4 findings (composer.json, stub place, config.m4, missing stub); green: exit 0, `make layout-check` passes and `ApiTest` (4) passes against the module that the builder of `scripts/` builds under the new name.

### 2026-10-20 — A path is no Composer package name (C16.7-13)

- The pattern of `tests/build/package-names.test.mts` for the old Composer package names `crudui/validator` and `crudui/generator` no longer matches the same words inside a path such as `polyspec/crudui/validator/...` (C16.7-13). Red: `no maintained file names a package by a form before the convention` failed with 3 names, in `config/duplication.json` and in the rows of the kit-standard checklist, which name Python files under `polyspec/crudui/validator/`; green: the test passes.

### 2026-10-20 — The gates of kit in CHECK_TARGETS (C16.7-12)

- `CHECK_TARGETS` of the Makefile lists the 21 gates of `kit-gates` that this checkout runs (kit K289), and `make kit-sync` brought `PRINCIPLES.md` and `PRINCIPLES.ko.md` to the text of the installed kit (the S10 text for a repository with more than one PHP library, `make plan-split`, and the requirements of a directory suite) (C16.7-12). Red: `make kit-check` exit 1 with 22 findings (20 gates missing from `CHECK_TARGETS`, 2 principle files differing); green: exit 0.

### 2026-10-20 — No fullSuite target in the owner checks (C16.7-11)

- `config/owner-checks.json` drops `fullSuite`, whose only entry `ci` I removed from the Makefile with the local full run (C16.7-3), so the owner check no longer names a target that does not exist (C16.7-11). Red: `make owner-validate` exit 1 (`fullSuite names ci, which is not a target`); green: exit 0 (`owns every tracked path`).

### 2026-10-20 — Shared helpers in the Rust generator (C16.39)

- `bindable_language` checks the record and the template and reads the language for `bind_buttons` and `bind_ordered`; the fixture test calls `settled` for the form and the list cases; `generateTable` writes both message tables of the Rust generator tool; and the `written` helper of the tests builds the ordered object with `Map::from_iter` (C16.39). Red: `make duplication-check` listed 5 clones in the Rust generator and the validator's compose tests; green: the generator clones are gone, 1 remains between `tests.rs` and `compose.rs` of the validator (the one-line `written` helper of two crates, which share no test crate); `native_fixture_records`, `bind`, the two generator tool tests and `make lint-rust` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — The Rust generators and their contracts (C16.38)

- `packages/generator/rust/tools/generate-interface-messages.mjs` and `packages/validator/rust/tools/generate-unicode-properties.mjs` read `contracts/` two folders too high (`packages/contracts/...`) since the packages moved to components and ports, so neither could run; both now read `../../../contracts`, and `tests/build/rust-generators.test.mts` runs each from the folder of its crate and requires its output to stay byte for byte as committed (C16.38). Red: the test failed with `ENOENT` for `packages/contracts/interface-messages.json` and for the unicode contract; green: both tests pass, with the generated sources unchanged.

### 2026-10-20 — Shared preload link and object test in the PHP generator (C16.37)

- `Rendering::imagePreload` writes the preload link of an image display for `Details` and `Lists`, and `Value::isObject` is the one test of what a declaration takes for an object, which `DisplayDeclaration` and `Template` each held (C16.37). Red: `make duplication-check` listed 2 clones in `packages/generator/php` outside the generator script; green: none; `RenderingConformanceTest` (188), `DetailTest` (10), `DisplayRulesTest` (21), `FormTest` (22), `DocCoverageTest` and `make lint-php` pass. The output is unchanged, so the red is the clone list.

### 2026-10-20 — Shared helpers in the Go generator (C16.36)

- `checkedBinding` checks the template, the record and the options of `BindForm` and `BindButtons`; `preloadLinks` writes the image preload links of a list and a detail; `splitRowSuffix` serves `leafName` and `ruleName`; `invalidMember` and `unknownMember` serve the declaration checks; `checkLabelAndFormat` serves the display and action declarations; and `asNumber` calls `expr.NumberValue` of the validator instead of holding its type switch (C16.36). Red: `make duplication-check` listed 7 clones in `packages/generator/go`; green: 1 remains, the generator program `interface_messages_generate.go` against the one of the validator (shared generator code, a later item); the 112 package tests and `make lint-go` pass. The behaviour is unchanged (`asNumber` also reads `uintptr`, as `expr.NumberValue` does), so the red is the clone list.

### 2026-10-20 — Shared helpers in the TypeScript generator core (C16.35)

- `actionClick` builds the click handler of the action buttons for `connectForm` and `connectOutline`; `has`, `fail` and `closed` check the declarations of a form, a field and a design; `splitRowSuffix` serves `leafName` and `ruleNameForPath`; `fileWidget` builds `image`, `file` and `cover`; `choiceOptions` builds the options of `choice` and `multichoice`; and `probeRegistry` reads `WIDGET_LAYOUTS` and `WIDGET_CANONICAL` (C16.35). Red: `make duplication-check` listed 6 clones in `packages/generator/ts`; green: none; the 305 tests of the package, the Vue and Svelte conformance tests on the rebuilt core, and `make lint-ts` pass. The output is unchanged, so the red is the clone list.

### 2026-10-20 — One layering function in the Python validator and a null patch rejected everywhere (C16.34)

- `_layer_members` layers the members of a node for `compose_properties`, `compose_spec`, `compose_root` and the nested expansion of a `$ref`, and `_validate_structure` serves `validateList` and `validateDetail` (C16.34). The copies disagreed about `{"$patch": null}`: `compose_properties` raised `PATCH_SHAPE` as the TypeScript, PHP and Rust engines do at every entry, while `compose_spec` and `compose_root` ignored it; now every entry raises it. Red: `tests.test_compose.TestNullPatch` failed for `compose_spec` and `compose_root` (2 of 3 sub-tests) and `make duplication-check` listed 3 clones in `packages/validator/python`; green: the test and the 4 compose, 9 structure validity and 3 validate tests pass, no clone remains, and `make lint-python` passes.

### 2026-10-20 — Shared reference resolver, type names and structure text in the Rust validator (C16.33)

- `reference_resolver` gives `expand_properties` and `expand_spec` the resolution of a `$ref` from the options, `json_type::js_type_of` is the one `typeof` bucket that `kind_of` and the expression engine use, `structure_text` reads the input of `validate_list_text` and `validate_detail_text`, and the composition tests call `composed` (C16.33). Red: `make duplication-check` listed 4 clones in `packages/validator/rust`; green: 1 remains, the signature of the two public functions `validate_list_text` and `validate_detail_text` (`text.rs` lines 672-678 and 685-691), and the `compose` (23), `validate` (46), `text` (12) and `expr` (1) tests and `make lint-rust` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — Own docblocks for the twin PHP methods (C16.32)

- `Expression::evaluate` and `evaluateValue`, `Nfa::matches` and `WholeMatchPattern::matches`, `Patch::setDeepPath` and `removeDeepPath`, `Validator::runImplicitNumber` and `applyRules` each had the docblock of the other; every one now says what it returns and throws and how it differs from its twin, and `Public\Validator::validateList` and `validateDetail` pass the names of their maps to `validateComposition` instead of closures with the same head (C16.32). Red: `make duplication-check` listed 5 clones in `packages/validator/php`; green: none; the list (20), detail (14), text validity (46), validate (318), expression (78), patch (17), compose (20) and doc coverage tests and `make lint-php` pass.

### 2026-10-20 — Shared slot shapes and structure validation in the Go validator (C16.31)

- `shapeLiteral` writes the null, false or true literal of a polymorphic slot for `ValidateSlot`, `DesignSlot`, `BehaviorSlot` and `OptionsSlot` (each reports its shape by a `shape` method), and `validateStructure` composes, expands and forbidden-scans a list or a detail, so `ValidateList` and `ValidateDetail` state only their field map and the members that are specific to a list (C16.31). Red: `make duplication-check` listed 4 clones in `packages/validator/go`; green: none, 748 Go tests and `make lint-go` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — Base classes for the PHP rules with a parameter (C16.30)

- `ParameterRule` reads and checks the parameter before it looks at the value; `FlagRule` (`Digits`, `Number`), `NumericRule` (`Max`, `Min`, `Range`, `Step`), `LengthRule` (`MaxLength`, `MinLength`, `RangeLength`) and `CountRule` (`MaxCount`, `MinCount`) add what their kind shares through `MeasuredRule`, so each rule states only its parameter and its comparison (C16.30). Red: `make duplication-check` listed 14 clones among these rules; green: none, `ValidateConformanceTest` (318), `RuleParametersTest` (10), `DocCoverageTest`, `make lint-php` and the PHP doc coverage pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — The rebuild classes by layout (C16.7-10)

- `config/rebuild.json` has no `paths` (kit K286 finds the tool sources by the layout of the repository) and classes the 98 sources that the layout adds: the copies of the bootstrap of kit, the benchmark programs, the cross-check console, the form comparison and form structure examples, the CLI entry and the ESLint configuration of the Svelte components; `step-runner.mjs`, `unit-pool.mjs` and `forward.mjs` of the form comparison are `replaced`, with the items C16.28 and C16.29 (C16.7-10). Red: `make rebuild-check` exit 1 (`paths` rejected by the schema, then 98 sources without a class); green: exit 0.

### 2026-10-20 — The raw control markup in the core (C16.27)

- `@polyspec/crudui-generator-core/internal` exports the raw control markup that the React, Vue and Svelte adapters each held a copy of: `escAttr`, `escText`, `serializeAttrs`, `rawVoid`, `rawElement`, `rawOptions`, `affixHtml`, `rawControl`, `choiceLabelClass`, `groupButtonHtml`, `choicesHtml`, `searchHtml` and `hasEventAttr` (`src/raw-markup.ts`); the adapters import them (C16.27). The Svelte test for an event attribute is now the `on` plus a letter of the other two adapters, not any name that starts with `on`. Red: `make duplication-check` listed 12 clones among the `raw.ts` and widget files of the three adapters; green: those are gone (118 clones remain in total), the Vue and Svelte form rendering conformance tests (463 each) and the other conformance tests of both pass, and `make lint-ts` passes. The output is unchanged, so the red is the clone list.

### 2026-10-20 — Shared composition layering, literal reader and rule shapes in the TypeScript validator (C16.26)

- `layerMembers` (`compose/layer.ts`) layers the members of a node for `composeProperties`, `composeSpec`, `composeRoot` and `expandNestedRefs`; `ConditionParser.matchLiteral` reads a literal token; `parameterRule`, `flagRule` and `formatRule` (`rules/factories.ts`) hold the parameter check, the empty-value skip and the message choice that `max`, `min`, `range`, `step`, `maxlength`, `minlength`, `rangelength`, `maxcount`, `mincount`, `digits`, `number`, `date`, `dateISO`, `url`, `email`, `enddate` and `equalTo` each spelled out (C16.26). Red: `make duplication-check` listed 10 clones in `packages/validator/ts`; green: none; 465 conformance and unit tests and `make lint-ts` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — Shared functions in the Rust validator (C16.25)

- `compose::members` holds `layer_members` (the `$ref` base, later members and `$patch`) and `kind_of`, which `compose`, `ref_` and `patch` each held a copy of; `file_accepted` serves both file shapes of the `accept` rule; `numbers_equal` serves the two equalities; `validate_field_rules` takes an `element_level` flag instead of a copy (`validate_element_rules`); and `list_or_detail_input` reads the input of `validate_list_text` and `validate_detail_text` (C16.25). Red: `make duplication-check` listed 11 clones in `packages/validator/rust`; green: 4 remain (function heads and a type-name match), the `compose` (23), `validate` (46), `text` (12) and `expr` (1) tests and `make lint-rust` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — Every tool source in config/rebuild.json (C16.7-9)

- `paths` of `config/rebuild.json` also selects the tool folders of the Rust ports (`packages/*/*/tools`), the Go generators (`*_generate.go`), the number-text generator of the PHP tests, the benchmark build and fixture scripts, the two build and install scripts of the examples and the fixture generators `tests/fixtures/*/generate.mts`, and each of the 15 new tools has its class: 12 `policy` (single-source table and fixture generators) and 3 `ecosystem`; the `comment` names the groups that are tests or example product and are not tools (C16.7-9). Red: `make rebuild-check` exit 1 with 15 tools without a class; green: exit 0.

### 2026-10-20 — Shared field walk, rule switch-off and composition input in the Go validate package (C16.24)

- `fieldDeclarations` yields the field declarations of a properties map, `ruleOff` tests the parameter that switches a rule off, and `composeInput` prepares the specification, loader and options for `Validate`, `ValidateList` and `ValidateDetail`, in place of the copies in `params.go`, `validator.go`, `rules.go`, `list.go`, `detail.go` and `index.go` (C16.24). Red: `make duplication-check` listed 6 clones in `validate/`; green: 1 remains (the head of `ValidateList` and `ValidateDetail`), 762 Go tests and `make lint-go` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — Ordered objects through two helpers in the Go validator (C16.23)

- `marshalOrdered` writes the members of a map in the order of its keys and `decodeOrdered` reads them back with their first-occurrence order, in place of the copies in the `MarshalJSON` and `UnmarshalJSON` of `PropertyMap`, `Content`, `ConditionMap`, `Messages`, `DeclaredAttributes` and `Items`; the error texts for a value that is not an object are unchanged (C16.23). Red: `make duplication-check` listed 11 clones of the ordered-object code in `types.go`; green: 4 other clones of that file remain and these are gone, 759 Go tests and `make lint-go` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — One path reader in the Go validator (C16.22)

- `expr.ValueAtSegments` reads the value at concrete path segments; `Evaluator.getValueByPath` and the `validate` package call it instead of each holding a copy (C16.22). Red: `make duplication-check` listed 1 clone of 24 lines between `expr/evaluator.go` and `validate/helpers.go`; green: none, 369 Go tests of `expr` and `validate` and `make lint-go` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — The generated Go and TypeScript tables in the duplication exclusions (C16.21)

- `config/duplication.json` excludes `packages/validator/go/validator/validate/unicode_data.go` (written by `unicode_data_generate.go`) and `packages/validator/ts/src/unicode/properties.ts` (written by `generate-unicode-properties.mjs`) from `contracts/unicode-properties.json`, each with its reason (C16.21). Red: `make duplication-check` listed 168 clones, 10 of them in these two files; green for this item: 158 clones remain.

### 2026-10-20 — The clone count of C16.15 (C16.15-1)

- The entry of C16.15 says that `make duplication-check` listed 7 clones in `src/Compose`, not 9: four started in `Compose.php` and three in `Patch.php` (C16.15-1). Red: the entry said 9 where the first run of the item listed 7 rows; green: the entry says 7.

### 2026-10-20 — The online targets in the offline-checks test (C16.7-8)

- `tests/build/offline-checks.test.mts` expects the targets that run with `$(ONLINE)` as the `kit.mk` of kit 0.0.54 defines them: `php-ext-arginfo` and `unlink` run online, `release-tools` and `release-backend` no longer do (C16.7-8). Red: `the Makefile runs cargo, go, npm and Composer offline, and only the install targets lift it` failed with those four names; green: all 4 tests of the file pass.

### 2026-10-20 — The release workflow triggers in the ci-local test (C16.7-7)

- `tests/build/ci-local.test.mts` expects the triggers of `.github/workflows/release.yml` as `@polyspec/kit` copies it: tags `v*` and `**/v*`, and a manual run that names the tag (C16.7-7). Red: `each workflow declares exactly its triggers` failed on `release.yml`, which declares `workflow_dispatch` with the input `tag`; green: all 17 tests of `ci-local.test.mts` pass.

### 2026-10-20 — The Makefile without the local full run (C16.7-3)

- The targets `ci`, `check` and `conformance-reset`, `CHECK_TARGETS` and their help lines are removed: they started `full-run.mjs`, which kit 0.0.54 does not ship (kit K240). `CI_TARGETS` stays as the list that `tests/build/ci-local.test.mts` keeps equal to the workflow, and a new test of that file requires every `$(KIT)/<tool>.mjs` of the Makefile to exist in the installed package; the lint test, the dry-run test and the cargo-offline test no longer name the removed targets (C16.7-3). Red: the new test failed with `full-run.mjs` missing and `make check` ended with Error 1 (`Cannot find module full-run.mjs`); green: the new test, `CI_TARGETS lists every checking command`, `a CI job runs every lint target of kit`, `a workflow command missing from CI_TARGETS` and `a dry run under a parent make` pass (5 tests).

### 2026-10-20 — The gates workflow in the ci-local test (C16.7-6)

- `tests/build/ci-local.test.mts` expects `.github/workflows/gates.yml`, the workflow that `make kit-sync` copies from `@polyspec/kit`, with its triggers (pull requests, pushes to `main`, a manual run) (C16.7-6). Red: `each workflow declares exactly its triggers` failed because `gates.yml` was an unexpected file; green: it passes.

### 2026-10-20 — The install targets in the ci-local test (C16.7-5)

- The preparation pattern of `tests/build/ci-local.test.mts` accepts a `make` line of `install-` and `crudui-install-` targets, the names that K246 gave the install targets of the Makefile and the workflow (C16.7-5). Red: 4 tests failed because every `make crudui-install-*` step counted as a checking command (`make ci runs every checking command`, `every job runs its checks through make ci-targets`, `every checking step of the CI workflow runs after an earlier failure`, `a workflow command missing from make ci is reported`); green: the same 4 tests pass.

### 2026-10-20 — The testing guide stamp (C16.7-4)

- `docs/operations/testing.ko.md` carries the sha256 of `testing.md` after C16.7-2 changed both together and its twin was compared with the English text (C16.7-4). Red: `check-documents.mjs` reported 1 revision finding; green: 81 document pairs pass.

### 2026-10-20 — The CI-only rule in AGENTS and the testing guide (C16.7-2)

- `AGENTS.md` and `docs/operations/testing.md` (and their Korean twins) state that the full suite runs only in CI, as PRINCIPLES.md says: the rule about `make ci`, `make crudui-check`, the full-run guard and `make rerun-failed` is removed, and `CI_TARGETS` is described as the list of the workflow (C16.7-2). Red: both documents described a local full run of kit's `full-run.mjs`, which kit 0.0.54 does not have (`make rules-check` and `check-documents` passed, so the check is the removed text: `git grep` for `rerun-failed` and `full-run` in the two files counted 16 lines); green: no line. The Makefile targets that still call `full-run.mjs` are item C16.7-3.

### 2026-10-20 — Shared guards of the PHP string and reference rules (C16.20)

- `Rules\StringRule` holds the switch-off and string guard of `Email`, `Url` and `DateISO`, and `Rules\ReferenceRule` the switch-off and field lookup of `EndDate` and `EqualTo`; each rule keeps only what decides its result (C16.20). Red: `make duplication-check` listed 5 clones between `Date`, `DateISO`, `Email`, `Url`, `EndDate` and `EqualTo`; green: none of them, and `ValidateConformanceTest` (318), `DocCoverageTest`, `FieldSpecTest` (17) and `make lint-php` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — Shared rule application in the PHP data validator (C16.19)

- `Validate\Validator::applyRules` runs rules until one fails and records its error; the array-level, element-level, field and implicit `number` rules all use it, `validateFieldRules` takes an `elementLevel` flag instead of a second copy (`validateElementRules`), and `fieldsOf` yields the field declarations of a properties map once (C16.19). Red: `make duplication-check` listed 4 clones in `Validate/Validator.php`; green: 1 remains (the docblock and signature of `runImplicitNumber` and `applyRules`), and `ValidateConformanceTest` (318), `PublicApiTest` (8), `MessagePlaceholderTest` (6) and `make lint-php` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — One reader for the pair of a range parameter (C16.18)

- `Numeric::orderedPair` reads a `[minimum, maximum]` parameter with the reader of its members; `Numeric::range` and `LengthLimit::range` pass `finite` and `integer` (C16.18). Red: `make duplication-check` listed 1 clone between `Values/LengthLimit.php` and `Values/Numeric.php`; green: none, `NumericTest` (31), `ValuesTest` (34), `RuleParametersTest` and `make lint-php` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — One composition validation for list and detail (C16.17)

- `Validator::validateComposition` checks the text, composes the root and the named maps and scans for forbidden members once; `validateList` and `validateDetail` name only their maps (C16.17). Red: `make duplication-check` listed 1 clone in `Public/Validator.php`; green: none, the list (20), detail (14) and text validity (46) conformance tests and `make lint-php` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — One literal reader in the PHP expression parser (C16.16)

- `Parser::literal` consumes a string, number or boolean token as a `LiteralNode`, which `parsePrimary` and `parseValueListItem` each spelled out three times (C16.16). Red: `make duplication-check` listed 2 clones in `Expr/Parser.php`; green: none, `ExprConformanceTest` (78) and `make lint-php` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — One module for the composition members (C16.15)

- `Compose\Members` holds the layering of the members of a node (`$ref` base, later members, `$patch`), the shallow merge, the plain-object test, the `UNDEFINED` sentinel and the shape-keeping rebuild of a member, which `Compose`, `Ref` and `Patch` each held a copy of (C16.15). Red: `make duplication-check` listed 7 clones in `src/Compose` (`Compose`/`Ref`/`Patch`); green: 1 remains (the docblock and signature of `setDeepPath` and `removeDeepPath`), and `ComposeConformanceTest` (20), `PatchTest` (17), `RefTest` (7) and `make lint-php` pass. The behaviour is unchanged, so the red is the clone list.

### 2026-10-20 — The owner check without rerun-failed (C16.7-1)

- `config/owner-checks.json` lists only `ci` in `fullSuite`: kit K240 removed the local full run and its `rerun-failed` target (C16.7-1). Red: `make owner-validate` exit 1 (`fullSuite names rerun-failed, which is not a target`); green: exit 0 (`owns every tracked path`). C16.7-2 rewrites the rules of AGENTS.md that still describe the local full run.

### 2026-10-20 — The duplication exclusions (C16.14)

- `config/duplication.json` excludes the Unicode tables that `generate-unicode-data.mjs`, `generate_unicode_data.py` and `generate-unicode-data.php` write from `contracts/unicode-properties.json`, and the tests (`tests/**`, `packages/*/tests/**`, `packages/*/*/tests/**`, `*.test.*`, `*_test.go`), each with its reason; `examples/**` stays under the check (C16.14). Red: `make duplication-check` exit 2 with 428 clones; green for this item: 183 clones remain (c 19, go 28, javascript 10, php 53, python 3, rust 17, typescript 53), which later items remove.

### 2026-10-20 — The classes of the tools of the repository (C16.7)

- `config/rebuild.json` gives each tool of `scripts/`, `packages/*/scripts` and `packages/php-ext/tools` its class: 13 tools are `ecosystem`, 17 `policy` (single-source table generators, fixture generators and polyspec contract checks), 6 `record` with the rebuild records `docs/rebuild/test-commands.md`, `build-stamp.md`, `install-lock.md` and `install-phpdocumentor.md`, and 14 `replaced`, whose replacement items are C16.8 (VitePress), C16.9 (phpize, held for S10), C16.10 (the process-group runner of kit), C16.11 (ajv schemas), C16.12 (the CSS layer import) and C16.13 (`@unicode/unicode-16.0.0`) (C16.7). Red: `make rebuild-check` exit 2 (`config/rebuild.json does not exist`); green: exit 0.

### 2026-10-20 — No empty catch in the PHP generator (C16.6)

- `Design::appearance` calls `Expression::parse` only for a string that `Design::parses` accepts, so a string that is not an expression stays literal text without a swallowed exception, and the row-limit test of `FormTest` records the rejection it asserts instead of catching it silently (C16.6). Red: `make lint-php` exit 2 (`Generic.CodeAnalysis.EmptyStatement.DetectedCatch` at `Design.php:96` and `FormTest.php:257`); green: `make lint-php` exit 0, and FormTest (22), DisplayRulesTest (21), ButtonsTest (18) and RenderingTest (3) pass.

### 2026-10-20 — The docs folder without .site (C16.5)

- `docs/` holds only the folders K245 allows: the orphaned `docs/.site/` build output is removed together with its exclusions in `scripts/docs-web/build.mts` and `watch.mts`, their tests and `docs/operations/documentation.md` (C16.5). Red: `make layout-check` exit 2 (`docs/.site: docs-folders: K245`), and the two docs tests failed with the exclusions removed; green: `make layout-check` exit 0, 17 docs tests passed.

### 2026-10-20 — The Korean checklist revision (C16.4)

- The Korean checklist of the kit-standard plan is reviewed against `checklist.md` and carries the sha256 of its source (C16.4). Red: `check-documents.mjs` reported one revision finding; green: no finding.

### 2026-10-19 — The kit standard 0.0.54 (C16.1)

- CI calls only targets that exist, with the PHP 8.4 tools, and the platform tests run on every platform instead of being skipped (C16.2).
- The repository follows the working principles and the standards S1 to S10 of `@polyspec/kit` 0.0.54: each plan is a folder `docs/plans/<plan>/` with `plan.md` and `checklist.md`; the execution checklist and its wave notes moved to `docs/plans/execution-checklist/`; `AGENTS.md` and `AGENTS.ko.md` keep only the rules of this repository, each with its `Enforced by:` line.
- PHP is pinned to 8.4: the requirements of the packages are `>=8.4`, and the Composer platform of `config/php-lint` is `8.4.1`, as the root `composer.json` is.
- `make records-check` no longer runs `crudui-docs-check`, so no target of `records-check`, `crudui-docs-check` and `docs-check-documents` reaches itself.
- The test folders of `packages/cli`, `packages/svelte`, `packages/vue` and `packages/react`, and the test folder of the Vue source, are named `tests`; the README of `docs/` duplicates `docs/index.md` and is removed.
- The generated form template validator drops the schema constants and the parent arguments that its code never reads.
- The Python validator catches the named exceptions of the expression parser, and the Rust benchmarks and the cross-check console no longer discard a `Result`.

### 2026-10-15 — The local links of 0.0.x (C14.51)

- `AGENTS.md` and `AGENTS.ko.md` state that while polyspec versions are 0.0.x, development checkouts link installed polyspec packages to their source as `docs/plans/local-links.md` of kit describes, and that links are never committed (C14.51).

### 2026-10-15 — The browser tests without file watching (C14.47)

- The Vite dev servers of the browser tests `form-styles`, `widget-scripts` and `widget-script-runs` watch no file (`server.watch: null`), so a change of a tsconfig file under the checkout, such as those that mise writes under `var/tools`, no longer reloads a page in the middle of a check (C14.47).

### 2026-10-15 — The cross-check console engine without a browser dependency scan (C14.46)

- The Vite server of the SSR engine of the cross-check console discovers no browser dependency (`optimizeDeps.noDiscovery`), so its cold start no longer crawls every HTML file of the checkout for over a minute and its first render no longer times out (C14.46).

### 2026-10-15 — The render options decoder (C14.50)

- `@polyspec/crudui-generator-core` exports `decodeFormRenderOptions(value)`, which checks parsed render options with the check that every renderer runs and returns them as `FormRenderOptions`, and `FormRenderOptionsError`, the `FormInputError` that it and the renderers throw with the JSON Pointer of the invalid member in `pointer`; the messages are unchanged (C14.50).

### 2026-10-15 — The grammar rows of crudui describe (C14.42)

- `crudui describe` reads every row of the token table of `docs/spec/expressions.md` and fails on a malformed row or a missing section instead of skipping it; the `LPAREN RPAREN` row, whose example held an unescaped `||`, now gives the pattern `( )` (C14.42).

## 0.0.7

### 2026-10-15 — kit 0.0.53 (C14.48)

- crudui pins `@polyspec/kit` 0.0.53, whose release workflow runs `make kit-check` before any release step, whose kit-check requires the `.php-version` that crudui declares, and whose release proof checks that a release lists each sibling wheel instead of comparing its draft URL (kit K191, K193, K195) (C14.48).

## 0.0.6

### 2026-10-15 — The Python packages as wheels (C14.44)

- The Python packages `polyspec-crudui-validator` and `polyspec-crudui-generator` are released as wheels, built by the `pythonBackend` setuptools 84.0.0 of `config/toolchain.json` (kit K29, K166), and no longer installed by git subdirectory pin. The generator requires the validator wheel of the same release by its release URL, which the uv workspace resolves to the validator of the checkout and `make python-lock` leaves out of the lock (K190). `make release-pins` and `scripts/release-pins.mts` are removed (C14.44).

### 2026-10-15 — The PHP of .php-version (C14.45)

- `.php-version` holds the PHP minor of crudui, 8.5, and every setup-php step of the workflows reads it, so the release workflow of kit sets up that PHP for the release proof instead of keeping the PHP of the runner. The PHP API and PHP validator jobs have no PHP matrix any more (C14.45).

### 2026-10-15 — kit 0.0.51 (C14.41)

- crudui pins `@polyspec/kit` 0.0.51 and takes `es-module-lexer` 3.0.4. `config/knip-entries.json` declares the binaries go, php and make that the scripts and tests run, and keeps the generated form template validator out of knip and oxlint with an `ignore` entry instead of a disable comment (kit K172, K176); `install-ordered-json` starts node by the `$(NODE)` that `kit-bootstrap.mk` now defines before the package is installed (K185) (C14.41).

### 2026-10-15 — The command line and the generator tests type-checked (C14.39, C14.40)

- `packages/cli` has a strict tsconfig, which its `typecheck` script and `make typecheck` run (C14.39).
- The tests of `packages/generator/ts` import the shared form session scenario with its types, without `@ts-expect-error` (C14.40).

### 2026-10-15 — The form template validator without ajv at run time (C14.38)

- `@polyspec/crudui-generator-core` validates in `decodeFormTemplate` with ajv's standalone validation code of `contracts/schema/form-template.schema.json`, which `make form-template-validator` generates and `make build` checks; the package no longer depends on ajv and compiles no code at run time, so a Content-Security-Policy without `unsafe-eval` allows it (C14.38).

### 2026-10-15 — The form template decoder (C14.37)

- `@polyspec/crudui-generator-core` exports `decodeFormTemplate(value)`, which checks the parsed JSON of a compiled form template against `contracts/schema/form-template.schema.json` with ajv and returns it as a `FormTemplate`, and `FormTemplateError`, the `FormInputError` that it throws with the JSON Pointer of the first invalid member in `pointer`. The package depends on ajv (C14.37).

### 2026-10-15 — kit 0.0.48 (C14.36)

- crudui pins `@polyspec/kit` 0.0.48. Each checkout runs the Node.js 26.12.0 of `mise.toml`, which `make install-tools TOOLS=npm` installs into `var/tools` with mise; `.node-version` is gone, and `engines.node` of every `package.json` is `>=26.12.0`. Each recipe of the Makefile starts node, go and Composer by their absolute paths (`$(NODE)`, `$(GO)`, `$(COMPOSER)`), and the workflows pin actions/checkout v7.0.1, actions/setup-node v7.1.0 and shivammathur/setup-php 2.40.0 by full SHA (kit K169, K171) (C14.36).

### 2026-10-15 — The TypeScript without casts (C14.12)

- The TypeScript passes the lint of kit 0.0.47 without type assertions, `any` or non-null assertions (kit K155, K156, K157). `@polyspec/crudui-generator-core`: `Translate` takes its text as `unknown`, as it already returned the fallback for any value that is no localized text, and a declared attribute whose value is no string fails with a `FormInputError` that names its path. `@polyspec/crudui-validator`: the `accept` rule reads only the string members of a file object, where a file whose `type` or `name` is no string crashed `validate`. `@polyspec/crudui-form-binding`: `bindForm` throws a `TypeError` for a form of a document without a window before it changes the form (C14.12).

### 2026-10-15 — kit 0.0.47 (C14.35)

- crudui pins `@polyspec/kit` 0.0.47, whose oxlint fails a non-null assertion and applies its type-aware rules to TypeScript files only (kit K156, K170); the Svelte tools take `@sveltejs/package` 3.0.1 (C14.35).

### 2026-10-15 — OrderedJSON 0.0.9 (C14.34)

- The form comparison reads and writes JSON with OrderedJSON 0.0.9 in every language: the Composer package from the release zip `polyspec-ordered-json-php-0.0.9.zip`, the Go module `github.com/polyspec/ordered-json/packages/go` v0.0.9, the Rust crate of the tag `v0.0.9`, and the npm package and PHP extension of the checkout of `v0.0.9`, whose packages lie in `packages/` (C14.34).

### 2026-10-15 — The php-ext leg of the form comparison suite (C14.33)

- The local verification of the form comparison runs the PHPUnit suite of the PHP server in the php-ext mode too, with both extension modules loaded through the repeatable `--php-extension` of kit (K165) and without the group `php`; the test helper `PhpProcess` moves to the namespace `Polyspec\CruduiTestSupport\`, outside the classes that a php-ext run requires internal (C14.33).

### 2026-10-15 — kit 0.0.46 (C14.32)

- crudui pins `@polyspec/kit` 0.0.46. kit allows the root `composer.json` and `composer.lock` of a Composer monorepo in its layout, so `config/layout.yml` no longer names them (K167).

### 2026-10-15 — PHP programs on Composer and PHPUnit (C14.30)

- The root `composer.json` requires `polyspec/crudui-validator` and `polyspec/crudui-generator` through path repositories with Composer's default link, so each package loads by its own autoload; `scripts/php-package-autoload.php`, which registered an autoloader, and the reinstall of the validator copy are gone, and the documentation check is the class `Polyspec\Crudui\Docs\DocCoverage` (C14.30).
- The PHP record server of the form comparison is the PSR-4 namespace `Polyspec\Crudui\FormComparison\` in `examples/form-comparison/servers/php`, with the entry `servers/php/api.php`; it reads JSON with `polyspec/ordered-json` 0.0.3 from the release zip that `config/release-assets.json` pins. In php-ext every CRUDUI class must be internal to the extension, checked before each response, instead of no Composer autoloader (C14.30).
- The PHP check scripts of the form comparison and of `packages/php-ext` are PHPUnit suites (`servers/php/tests`, `packages/php-ext/tests/ApiTest.php`); five PHP programs keep their functions as closures, so no PHP file declares symbols beside its side effects (C14.30).

### 2026-10-15 — Contract manifest exports from the built modules (C14.10-1)

- `scripts/check-contract-manifest.mts` reads the value exports of each package entry from its built ES module files with es-module-lexer, a declared devDependency, following each `export * from` to the module that Node's resolution gives; the TypeScript 7 API (`typescript/unstable/sync`), its virtual file system and the `.svelte` declaration stub are gone. `npm run manifest:check` builds the packages first when their build is not current, and the check fails when a built file of an entry is missing or an entry has no ES module file (C14.10-1).

### 2026-10-15 — No make install-rust (C14.26)

- `make install-rust` is gone: `make install-tools` of kit installs the Rust toolchain of `rust-toolchain.toml` since K151, so the workflows run only `make install-tools`, and each Cargo cache step follows it, so the toolchain exists for the key of the cache (C14.26).

### 2026-10-15 — Equality of arrays and objects in expressions (C14.25)

- `==`, `!=` and `in` compare two arrays or two objects as JSON values in every port: two arrays with equal elements in the same order and two objects with the same keys and equal values in any key order are equal, numbers by value, and an array never equals an object; TypeScript and Python had compared them by identity, Go had never found them equal, and PHP and Rust had compared an integer and a fraction such as `1` and `1.0` as different. An array that a path without a wildcard names is one value, where TypeScript, PHP, Go and Python had taken it as the candidates of a wildcard. In a string comparison the C engine of the PHP extension writes a boolean as `true` or `false`, as the other ports do, where it wrote `1` and the empty text; shared vectors check each rule (C14.25).

### 2026-10-15 — Type tests of the validator (C14.24)

- The Vitest suite of `packages/validator/ts` runs in the typecheck mode of Vitest too, so the `expectTypeOf` assertions of the authoring types, now in `src/types.test-d.ts`, are checked with `tsc`; a runtime run had not evaluated them (C14.24).

### 2026-10-15 — Bundled benchmark console in the spec (C14.23)

- The form-comparison spec states that the modules of `public/` are served as they are and that the build bundles the benchmark console with the source modules it imports, so no source module is copied to the public directory; the Chromium case loads the module that the page script imports from `public/` instead of `frame-readiness.mjs` of `src/` (C14.23).

### 2026-10-15 — Public authoring types (C14.22)

- `@polyspec/crudui-validator` exports the authoring types of a specification from its entry: `FieldSpec`, `RangeFieldSpec`, `ValidateSlot`, `DesignSlot`, `Items`, `Multiple`, `Lang`, `ConditionMap` and every type that they name, each documented, as docs/spec/schema.md defines them (C14.22).

### 2026-10-15 — Benchmark console pointer guard (C14.21)

- The benchmark console of the form comparison stops a capture and does not compare the frames while the pointer is over one of them, as its spec requires; no page had called the guard since the console moved out of the main page.

### 2026-10-15 — Form comparison imports (C14.20)

- The form comparison resolves `#adapter`, `#stage`, `#html` and the component aliases through the subpath imports of the root `package.json`, with a condition per frame and stage build, instead of Vite and esbuild aliases; the benchmark console is bundled from the sources and `record-view.mjs` lives in `public/`, so every import resolves in the source tree and when served (C14.20).

### 2026-10-15 — kit 0.0.45 (C14.19)

- crudui pins `@polyspec/kit` 0.0.45, whose knip ignores the binaries of the pinned runtimes and reads the `binaries` and `workspaces` of `config/knip-entries.json`, which declares the files that make, a test, a page or a tool runs by path and the workspaces with their entries and ignored dependencies. The dependencies that nothing uses, `debug` of the root, `@testing-library/user-event` of the React package and `parse5` of the Vue and Svelte packages, are removed; `puppeteer-core` and `vue`, which the browser install script and the form comparison import, are declared (C14.19).

### 2026-10-15 — Go modules (C14.18)

- The Go modules resolve without the ignored clone of ordered-json: `go.work` uses only the modules of the checkout, the modules require each other at pseudo-versions of main until the next release tags `packages/{validator,generator}/go`, the form-comparison Go server requires `github.com/polyspec/ordered-json/go` v0.0.3, and `make install-go-modules` (part of `make install`) downloads the modules that the workspace requires, so the Go checks stay offline; govulncheck of mise.toml reviews the new Go lock (C14.18).

### 2026-10-15 — Rule parameters (C14.15)

- The parameters of `equalTo` and `enddate` (a field reference string), `notEqual` (a string, number or boolean) and `unique` (true, false or a string) are checked when the specification loads, in every language, and fail with `INVALID_RULE_PARAMETER`; an object or a list was taken as a value and reached the rule.

### 2026-10-15 — Documentation web (C14.14)

- The Pages workflow builds the documentation web again: the API pages that API Documenter writes, with level-two headings only, are taken as they are and titled by their first heading; a written page keeps exactly one level-one heading (C14.14).

### 2026-10-15 — Defects found by the lint (C14.16)

- The expression `==`, `!=` and `in` of the TypeScript and Python validators compare an array or an object with a scalar as the PHP, Go, Rust and C evaluators do, with no number and the empty text: `.o == '[object Object]'` with an object and `'a' == .tags` with `['a']` were true there alone; the spec states it and shared vectors check it.
- The PHP server of the form comparison reports a failure to stop, such as a socket directory it cannot remove, and exits with status 1; the rejection was unhandled and crashed the process.
- The Svelte adapters of the form comparison wait for `unmount` of each component when they are disposed; dispose returned before the unmount finished.
- The browser binding of generator-core writes the value of a text, date, checkbox or radio control as the server render does, the PHP string of the value: `true` is `1`, and `false`, an array and an object are empty, where it wrote `true`, `false` and `[object Object]`.

### 2026-10-15 — Svelte component exports (C14.12)

- `@polyspec/crudui-generator-core` exports the types `Translate` and `SourceAttrs`, which its public types `NodeVM` and `WidgetModel` already named, and documents `DetailFieldVM`; the TSDoc of the validator and the form binding parses as TSDoc (C14.12).
- `@polyspec/crudui-generator-svelte` exports each component as a documented Svelte 5 `Component<XProps>` and its props type `XProps` by name (`FormProps`, `ListProps`, `DetailProps`, `NodeProps`, `ControlsProps`, `WidgetProps`, `OutlineProps`, `OutlineViewProps`, `DataViewProps`, `DataPanelProps`). The type alias of the Svelte 4 instance, `type X = ReturnType<typeof X>`, which svelte-package wrote undocumented for each component, is no longer exported; the type of an instance is `ReturnType<typeof X>` (C14.12).

### 2026-10-15 — kit 0.0.44 (C14.13)

- crudui pins `@polyspec/kit` 0.0.44: `make install-tools` installs the Rust toolchain of `rust-toolchain.toml` before a CI job runs cargo, API Extractor no longer reports `ae-missing-release-tag`, oxlint allows the registrations of node:test, ruff keeps its cache in `var/ruff`, and `config/layout.yml` adds `.npmrc`, `composer.json` and `composer.lock` to the root files of kit instead of repeating its list. The review of the lock takes `puppeteer` 25.14.0, `playwright` 1.64.1 and `tsup` 9.0.0.

### 2026-10-14 — Folders of kit's layout (C14.7)

- The packages follow S5: a component with ports holds a folder per runtime. Old → new folder (published names stay):

  | Old | New |
  |---|---|
  | `packages/validator-go`, `-php`, `-python`, `-rust`, `-ts` | `packages/validator/go`, `php`, `python`, `rust`, `ts` |
  | `packages/generator-go`, `-php`, `-python`, `-rust` | `packages/generator/go`, `php`, `python`, `rust` |
  | `packages/generator-core` | `packages/generator/ts` |
  | `packages/generator-html`, `-react`, `-vue`, `-svelte` | `packages/html`, `react`, `vue`, `svelte` |

- The Go modules are `github.com/polyspec/crudui/packages/validator/go` and `github.com/polyspec/crudui/packages/generator/go`, so their tags are `packages/validator/go/vX.Y.Z` and `packages/generator/go/vX.Y.Z`.
- A Python project that installs a package of crudui from a git tag names the new folder as its `subdirectory` from the next release on: consumer's `pyproject.toml` files name `packages/validator-python` and `packages/generator-python` at v0.0.5, and name `packages/validator/python` and `packages/generator/python` with the next tag. `make release-pins` requires the subdirectory of a pin to be a package folder of the checkout.
- The meta-schema is `contracts/schema/crudui.schema.json` (its `$id` follows), the validator benchmark is `benchmarks/validators`, and phpDocumentor installs into `var/tools/phpdocumentor` with `scripts/install-phpdocumentor.mts`. `config/layout.yml` declares the root files `.npmrc`, `composer.json` and `composer.lock`, the cross-language folders of `tests/`, and the components of `packages/`.
- Every crate is a workspace of its own that denies unsafe code and an allow attribute without a reason, and the record server of the comparison takes OrderedJSON from the tag of its repository.
- The infrastructure of `scripts/` and `tests/` is TypeScript: the JavaScript modules there are `.mts` files that `make typecheck` checks with the strict root `tsconfig.json`, and the React generator of the form-render cases moved to `packages/react/scripts`. `config/layout.yml` names the files that drive or serve one other language. The public `form-snapshot.mjs` of the comparison and the page of the inspector test take `form-snapshot.mts` with its types stripped by `stripTypeScriptTypes` of Node.js.

### 2026-10-14 — Latest stable dependencies (C14.8, C14.3-1)

- `make dependency-review UPDATE=1` took the latest stable releases: vitest 5.0.4, @types/node 26.6.5, vue 3.5.44, postcss 8.5.30, @testing-library/user-event 14.6.8 and phpunit 13.4.2. React stays at 19.2.8 by its exception (C5.8-2-1), and the tools project of `packages/generator-svelte` keeps TypeScript 6.0.3 by a new exception of `config/dependency-policy.json`, the one that `config/toolchain.json` declares.
- svelte is declared once, by `packages/generator-svelte`; its tools project installs it as the peer of its tools, which the scripts start with `npm exec --prefix tools`.
- generator-core, form-binding and cli have no `test` script: `make test-cli`, `make test-form-binding`, `test:forms` and the verification commands of `contracts/features.json` run `run-tests.mjs vitest --cwd packages/<name>` from the root, since the run-tests of kit takes its root from the working directory.

### 2026-10-14 — Tool tests of tests/build on TypeScript 7 (C14.10)

- `scripts/check-contract-manifest.mjs` reads the value exports of each entry with the program and checker of the TypeScript 7 API (`typescript/unstable/sync`), whose virtual file system hides node_modules and gives a `.svelte` component its declaration. `tests/build/public-packages.test.mjs` compiles its consumer fixtures with `tsc --noEmit` of TypeScript 7, whose exit status is the result: `public-types.mts` and `public-types.cts` with the Node.js resolution, `public-types-svelte.mts` with the bundler resolution of a Svelte project, and `module-only-require.cts`, which a CommonJS project cannot compile; `tsc --listFilesOnly` shows that the program reads only the declarations of dist, package.json gives the module format, and the declaration builds are checked with `tsc --showConfig` and a failing build.
- `PathContext` is a public type of `@polyspec/crudui-validator`: the public API of generator-core names it, and it is no longer imported from the internal entry.
- The tests name the tools of kit by `node_modules/@polyspec/kit/dist`, and the lock test of the Composer reinstall recognizes the holder-lock of kit that a script resolves.

### 2026-10-14 — kit 0.0.42 (C14.11)

- `@polyspec/kit` is pinned at 0.0.42 with the integrity of the published file. `mise.lock` locks the tools of `mise.toml` for linux-arm64 and macos-x64 too, and the copied bootstrap writes `var/tools/go.mod`, so `./...` of a Go module of the checkout does not walk the Go that mise installs.

### 2026-10-14 — TypeScript API with API Extractor and API Documenter (C14.5)

- Each TypeScript package checks its public API with API Extractor through an `api-extractor.json` that extends the copied `config/api-extractor.kit.json`, and commits its report `etc/<package>.api.md`; an undocumented export and a reference to an unexported type are errors of `make lint-ts`. `scripts/check-doc-coverage.mjs` checks Go, Rust and PHP, and `scripts/gen-api-docs.mjs` writes the TypeScript pages with API Documenter from the doc model of API Extractor. TypeDoc and its configurations are removed.
- The root declares TypeScript 7.0.2; npm installs the TypeScript 6.0.3 of `packages/generator-svelte` with svelte-check, `@sveltejs/package`, svelte2tsx and typescript-eslint in that workspace.

### 2026-10-14 — TypeScript lint of kit instead of ESLint (C14.4)

- `make lint` runs `make lint-ts` of kit (oxlint with the copied `.oxlintrc.json`, knip and API Extractor) and the Svelte lint of `packages/generator-svelte`, the one workspace that keeps ESLint, with eslint-plugin-svelte and typescript-eslint for its components. The root `eslint.config.mjs`, the ESLint packages of the root and of the other workspaces and their `lint` scripts are removed, and so is the rule `crudui/no-await-after-test-registration`: kit runs node:test without `--test-force-exit`, which dropped a test registered after a top-level `await`.
- `tests/build/lint-coverage.test.mjs` requires `make lint` to run both lints and each to fail on a planted violation.

### 2026-10-14 — Shared tools from the package @polyspec/kit (C14.3)

- The shared tools are the package `@polyspec/kit`, which `make install-tools TOOLS=npm` and `make install-packages` install before any other target; the vendored `scripts/kit`, `tests/kit`, `kit.json` and `.kit/kit.lock.json` are removed. The Makefile includes the copy `scripts/kit/kit-bootstrap.mk` and runs every kit tool as `$(KIT)/<tool>.mjs`; `make check` runs the checks of kit (`CHECK_TARGETS`) through the guard of the full run; every workflow job installs the npm of `packageManager` and the packages first. Code imports `@polyspec/kit/<module>` and resolves its own root; the tests of kit behavior are kit's.
- `make kit-sync` writes the copies of `kit.copies` (the bootstrap, the release workflow, `PRINCIPLES.md`, `config/layout.kit.yml`, the lint configurations); `config/layout.yml` holds the layout map of crudui, and `config/toolchain.json` declares uv and Python, alint, ruff, vulture, golangci-lint, deadcode and Composer with its digest.
- The floors are the pins of kit: Node.js 26.11.1, PHP `>=8.5` with the Composer platform 8.5.0, Python `>=3.14`, Go 1.27.2 without `toolchain` lines, Rust 1.99.0 and TypeScript 7.0.2; `packages/generator-svelte` keeps TypeScript 6.0.3 as a declared exception. The CI matrices run PHP 8.5 and Python 3.14. The Go modules resolve each other through the root `go.work` instead of `replace`, and `.npmrc` sets `strict-allow-scripts`.

### 2026-10-12 — Standard tools of each ecosystem are used as they are (C15.1)

- `AGENTS.md` and `AGENTS.ko.md` state that an existing outside tool or library is used as it is and not rebuilt, with uv for Python interpreters, environments and locks and Composer for PHP dependencies, and that the symbolic links such a tool creates are accepted. The path rule applies to what this repository creates, and it names the declarative and discovery resolution of paths. `make documents-check` exits 0.

### 2026-10-09 — Owner of the release pin script (C13.1-23-1)

- `config/owner-checks.json` names `scripts/release-pins.mjs` with the target `release-pins` and the test `tests/build/python-git-pins.test.mjs`; `make owner-validate` exits 0. The check was added with C13.1-23 without this owner.

### 2026-10-09 — Dependencies at their latest stable release with exact install approvals (C13.1-38)

- `package.json` declares `puppeteer` ^25.13.0, `playwright` ^1.64.0 and `vite` 8.3.4, and `allowScripts` approves `puppeteer@25.13.0`, `esbuild@0.27.7` and `esbuild@0.28.2` by exact version. `make dependency-policy-check` exits 0 (no newer stable release without an exception), and `tests/build/dependency-health.test.mjs` passes, including `tracked npm dependency graphs approve every install script by exact version`.

### 2026-10-09 — npm lock records the workspace packages at the release version (C13.1-37)

- The workspace entries of `package-lock.json` and the root entry name the version of `package.json` (0.0.5); a check over the lock finds no mismatch. `node scripts/kit/run-tests.mjs node -- tests/build/dependency-health.test.mjs` passes (exit 0), including the test `the dependencies match their recorded review, without a registry query`.

### 2026-10-09 — Dependency review record of the release locks (C13.1-36)

- `config/dependency-review.json` records the review of 87 registry dependencies and 8 locks with no advisory. `make dependency-policy-check` and `make dependency-policy-mutation-check` exit 0. The review reports no newer stable release without an exception: the four React exceptions remain, and the raises of puppeteer, playwright and vite are on main (C13.1-38).

### 2026-10-09 — Package files carry the release version of this repository (C13.1-34)

- The version of the release is set in every manifest that `config/release.json` lists, in their locks, in the git pin of `packages/generator-python`, in `contracts/features.json` and in the module version of `packages/php-ext`. The release of this repository is 0.0.5 (74fd5956); version 0.0.4 was never tagged, so the package files are not set back to it. `make release-pins TAG=v0.0.5` and `make release-coverage` exit 0, and `tests/build/contract-manifest.test.mjs` passes. The section `## 0.0.4` of the change logs stays below `## 0.0.5`, and no tag `v0.0.4` exists locally or on origin.

### 2026-10-09 — CI job python sets up node and checks the recorded toolchain (C13.1-30)

- The job `python` of `.github/workflows/ci.yml` sets up the Node.js release of `.node-version`, and `make toolchain-check TOOLS="node python"` runs in the leg that records the minor 3.14. The test `every CI job sets up the recorded toolchains and checks the tools it set up` of `tests/build/runtime-version-policy.test.mjs` passes (exit 0).

### 2026-10-09 — Python docstrings name modules by dotted names (C13.1-29)

- The docstrings of `packages/generator-python/scripts/generate_interface_messages.py` and `packages/validator-python/scripts/generate_unicode_data.py` name the Python modules by their dotted names, not the `src/polyspec/crudui/...` paths, and `tests/build/package-names.test.mjs` passes (exit 0) with the other package-name tests.

### 2026-10-09 — Native generator command of make-tool-path names python (C13.1-28)

- `make test-native` runs `tests/native-generators/run.mjs --target javascript,html,go,rust,python`, and the test `tests/build/make-tool-path.test.mjs` expects that command. `node scripts/kit/run-tests.mjs node -- tests/build/make-tool-path.test.mjs` passes with `tests/build/package-names.test.mjs` and `tests/build/runtime-version-policy.test.mjs` (exit 0).

### 2026-10-09 — Python 3.11 imports the validator and generator modules (C13.1-27)

- The annotations of `packages/validator-python/src/polyspec/crudui/validator/resolver.py` import `Node` from `parser` and define the alias `Context` above their use. On Python 3.11.16, `PYTHONPATH=src python -m unittest discover -s tests -p "test_*.py"` passes in `packages/validator-python` (23 tests) and in `packages/generator-python` (11 tests), exit 0.

### 2026-10-09 — Pull request of the Python branch is opened and merged (C13.1-26)

- `gh pr list -R polyspec/crudui --state all --head feat/python-C13.1` lists pull request #1, `feat(python): Add the Python validator and generator (#C13.1)`, in the state MERGED. The row asked for the pull request to be open, and it has been merged since, so its literal open-state check cannot hold now; the pull request was opened and merged to main.

### 2026-10-09 — Consumer project of the npm archives names the release version (C13.1-35)

- `tests/release-install/npm/package.json` named the version 0.0.4 in its own version field, which `make release-consumer-lock` keeps as committed, while its dependencies named the archives of 0.0.5. The field is set to 0.0.5, and `tests/build/release-fixtures.test.mjs` requires it to equal the version of `package.json`, so a release that leaves it behind fails `make test-runtimes`. The archives of 0.0.5 install and pass their smoke commands (`make release-consumer TAG=...` on a local tag, exit 0).

### 2026-10-09 — Release unit tests run in a CI job with their tools (C13.1-25)

- The release unit tests are the vendored tests of polyspec/kit (`make kit-test`). The CI job `build, lint and types` runs `make kit-test` after `test-ordered-json`, because the tests call go, php and cargo, which that job sets up; `make ci` lists `kit-test` in the same order. The job `python` sets up no go, php or cargo, so it does not run them. `tests/build/ci-local.test.mjs` requires one job to run `make kit-test` with those tools.

### 2026-10-09 — Release order of the Python git pins in AGENTS (C13.1-24)

- `AGENTS.md` and `AGENTS.ko.md` state that the tag `vX.Y.Z` is created only after the release commit is on `main`, because the git pins of `packages/generator-python` name that tag, and that `make release-pins` requires the pins to name the tag.

### 2026-10-09 — Stale git pins of the Python packages fail the release check (C13.1-23)

- `make release-pins TAG=...` (`scripts/release-pins.mjs`) fails for a git pin `polyspec/crudui@vX.Y.Z` in a `pyproject.toml` that names another version than the tag, and prints the file, the pin and the tag. `make release-versions` runs it first. `tests/build/python-git-pins.test.mjs` proves the failing and the passing tags.

## 0.0.5

### 2026-10-09 — Release 0.0.5 (C14.2)

- The version is 0.0.5 in every manifest of `config/release.json` and in its locks, in the git pin of `packages/generator-python`, in `contracts/features.json` and in the module version of `packages/php-ext`. The section of the earlier version 0.0.4, which no tag released, stays below. The consumer projects of `tests/release-install` name the archives of 0.0.5, and the review record `config/dependency-review.json` is written for the locks of 0.0.5. `docs/operations/repository.md` pushes `vX.Y.Z` together with the tags of the two Go modules, and the run of a Go module tag builds and installs no archive.

### 2026-10-09 — Test of the local pipeline stack names the hook module of kit (C14.1-10)

- `examples/form-comparison/src/local-servers.test.mjs` requires the import of `setup` and `teardown` from `scripts/kit/test-hooks.mjs`. The files already imported it since C14.1-2, but the pattern of the test named the removed `scripts/test-progress/hooks.mjs`, so the CI job `Form comparison runner regressions` failed; the other parts of that job (the library and the browser checks) passed.

### 2026-10-09 — Push check on branch pushes only (C14.1-9)

- `push-gate.yml` starts on pushes to branches (`branches: ['**']`) and no longer on a tag push, which left a `push-gate` check run that had not completed on the tagged commit. `tests/build/ci-local.test.mjs` requires every workflow with a push trigger except `release.yml` to filter branches and `release.yml` to be the only one that starts on tags.

### 2026-10-09 — Policy and tool selection with kit v0.0.8 (C14.1-8)

- `config/dependency-policy.json` names `composer.json` without `./`, and `pythonManifests` names the `pyproject.toml` of `packages/validator-python` and `packages/generator-python`; their build requirement `setuptools==84.0.0` is at its latest release, so the review records 87 registry dependencies and 8 locks with no advisory. `make dependency-policy-check` and `make dependency-policy-mutation-check` pass.
- The workflow jobs install the tools with `make install-tools TOOLS="npm"`, and `make install-node-modules` installs npm only; the dependency review job installs the Rust toolchain and then `npm cargoAudit`. The Rust toolchain step before the tool install is not needed.

### 2026-10-09 — Vendored tools of polyspec/kit v0.0.8 (C14.1-7)

- The vendored files are those of the tag `v0.0.8`. The mutation check copies every tracked manifest and lock, the policy schema accepts a root `composer.json` and `pyproject.toml`, `make install-tools TOOLS="..."` installs only the named tools, and `make documents-stamp` writes the `source-sha256` markers.

### 2026-10-09 — Owner check of kit and the rules of the 0.x workflow (C14.1-6)

- `config/owner-checks.json` declares the owner of every tracked path (`make owner-validate`), with owners for the vendored copy (`make kit-check`, `make kit-test`), the configuration files and `scripts/repository-files.mjs`; the target `owner-check` takes `cargo-downloads-check` as a prerequisite. `scripts/owner-check.mjs`, `scripts/owner-checks.json` and the test of the owner check are removed.
- The PHP suites run the PHPUnit of the root `vendor/` through `COMPOSER_VENDOR_DIR=../../vendor` in the Composer scripts and the make targets, because `scripts/kit/run-tests.mjs phpunit` reads `<cwd>/vendor` by default; `composer.lock` records the changed script of `packages/validator-php`.
- `AGENTS.md` and `AGENTS.ko.md` state that `main` is pushed once, when every checklist row is `[o]`, that a tag is created after the CI check `ci-passed` succeeded for the commit, that the shared tools are vendored copies of polyspec/kit that change only in polyspec/kit, and that the repository differs from the other repositories only in `config/*.json`. The rules of the pull request, the merge queue and the ruleset are removed.

### 2026-10-09 — Release tool and 0.x workflows (C14.1-5)

- `config/release.json` declares the 9 archives of the release (7 npm packages as `<package>-npm-<version>.tgz`, 2 Composer packages as `<package>-php-<version>.zip`), the manifests that a tag covers, the Go modules `packages/generator-go` and `packages/validator-go`, the consumer projects `tests/release-install/npm` and `tests/release-install/composer`, and the install of the two crates and two Python packages from the tag. `make release-assets` builds the packages first, and `release.yml` runs `make release-consumer` between the archives and the release. `scripts/release.mjs`, `scripts/release-install.mjs` and their tests are removed; `tests/build/python-git-pins.test.mjs` requires every git pin on this repository in a `pyproject.toml` to name the version of `package.json`. The consumer projects `tests/release-install/npm` and `tests/release-install/composer` name the 0.0.4 archives in the form of the kit (the `artifact` repository `artifacts`, archive names with the language, `polyspec/crudui-validator` as a smoke package so that no zip hash is locked): `release-assets`, `release-consumer-lock` and `release-consumer` wrote and checked them in a scratch clone with a local tag, which this repository does not hold.
- The repository has no pull request, merge queue or ruleset while the version is 0.x: `ci.yml` runs on a push to `main` and on a manual run and never cancels the run of an earlier commit, and `push-gate.yml` runs on every push. `.github/repository.json`, `scripts/github-repository.mjs` and `tests/build/github-repository.test.mjs` are removed. `docs/operations/repository.md` describes the push of `main`, the workflows and the release.
- The CI target `release-install-head`, which installed the archives of `HEAD` before a tag existed, is removed: `scripts/kit/release.mjs assets` builds the archives of an existing tag only, and `make release-consumer` runs in the release workflow before the release is created.

### 2026-10-09 — Document check and commit message rules of kit (C14.1-4)

- `config/documents.json` selects the Markdown documents of the repository (75 pairs), the status table of `docs/features.md` and `CHANGELOG.md`; `config/commits.json` declares the types, the 50 characters of a subject and the 72 characters of a body line. Each English document and its Korean twin hold the marker `<!-- doc-id: <path of the English file> -->`, and the Korean twin holds `<!-- source-sha256: <sha256 of the English file> -->`, which `scripts/generate-feature-contract-docs.mjs` writes for the generated feature contract pages. `scripts/check-documents.mjs`, `scripts/checklist-markers.mjs` and its test are removed.
- The check found four differences between the English and the Korean documents, which are corrected: the code blocks of `examples/cross-check-console/README.md` named three frameworks and the old README link, the Korean release command named `<main의 commit>`, a link text of `docs/spec/form-markup.ko.md` broke across a line, and `tests/build/README` linked two headings that do not exist.

### 2026-10-09 — Push check, full run and CI report tools of kit (C14.1-3)

- `config/checklist.json` declares `docs/plans/execution-checklist.md` with its Korean twin and the hook `pre-push`; `.githooks/pre-push` is the hook that `make hooks` writes (`scripts/kit/git-hooks.mjs`) and runs `scripts/kit/push-gate.mjs`. `make ci` starts `scripts/kit/full-run.mjs` with `conformance-reset`, which removes the conformance evidence of earlier runs, and the make targets of `CI_TARGETS`; a full run no longer runs in a fresh clone of the commit.
- `scripts/package-dist.mjs` and the record servers of the form comparison take the lock of `var/locks` from `scripts/kit/holder-lock.mjs`, whose commands are `run` and `clear`; the lock of the user account (`userLockFile`) is removed. `scripts/push-gate.mjs`, `scripts/full-run.mjs`, `scripts/holder-lock.mjs`, `scripts/ci-targets.mjs`, `scripts/ci-passed.mjs`, `scripts/target-report.mjs` and their tests are removed.

### 2026-10-09 — Toolchain, dependency and test runner tools of kit (C14.1-2)

- `config/toolchain.json` follows `scripts/kit/schema/toolchain.schema.json`; `make install-tools` installs npm, Go and cargo-audit into `var/tools`, and the Makefile puts `var/tools/bin` first on `PATH`. `scripts/install-npm.mjs`, `scripts/checkout-npm.mjs`, `scripts/check-toolchain.mjs`, `scripts/check-cargo-downloads.mjs` and `scripts/install-cargo-audit.mjs` are removed.
- `config/dependency-policy.json` follows the kit shape: `composerPlatforms` names `./composer.json` with PHP `8.4.1` (the lowest PHP release that the locked PHPUnit 13.4.1 supports; `config.platform.php` of `composer.json` and `platform-overrides` of `composer.lock` record it), `taggedNpmPackages` names the OrderedJSON tag `v0.0.3`, and the four React exceptions keep their reason and removal condition. `make dependency-review RECORD=1` wrote `config/dependency-review.json` for the npm, Composer and Cargo locks: 85 registry dependencies and 8 locks, no advisory and the same versions as before. The six Go modules require only modules of the checkout through `replace`, so they add no Go dependency. `scripts/dependency-state.mjs`, `scripts/dependency-review.mjs` and `scripts/check-dependencies.mjs` are removed.
- `scripts/kit/run-tests.mjs` and `scripts/kit/test-progress.mjs` replace `scripts/run-tests.mjs` and `scripts/test-progress`; `tests/conformance/run-suite.mjs` starts the runner for the suites of `scripts/check-conformance.mjs` and leaves their run record. ESLint and the repository rules do not read the vendored copy (`scripts/repository-files.mjs`).

### 2026-10-09 — Vendored tools of polyspec/kit v0.0.4 (C14.1-1)

- `kit.json`, `.kit/kit.lock.json`, `scripts/kit` and `tests/kit` hold the files of the tag `v0.0.4`, and the Makefile includes `scripts/kit/kit.mk`. `make kit-sync KIT_TAG=v0.0.4` wrote the lock and printed `unchanged` on the second run; `make kit-test` passed 322 of 322 tests.

- C13.1-38: the dependencies are at their latest stable release (puppeteer 25.13.0, playwright 1.64.0, vite 8.3.4), their install scripts are approved by exact version, and the review record is written again.
- C13.1-37: the npm lock records the repository packages at 0.0.4 in its dependency entries, as the version bump requires.

### 2026-10-09 — Dependency review record of the 0.0.4 locks (C13.1-36)

- `config/dependency-review.json` records the sha256 of the eight locks that the version bump changed, with no advisory. The review reports four newer stable releases without an exception (`puppeteer`, `playwright` and `vite`); they are raised in a separate change.

### 2026-10-09 — Consumer fixture locks of 0.0.4 (C13.1-35)

- `tests/release-install` names the 0.0.4 archives in its `package.json`, `package-lock.json`, `composer.json` and `composer.lock`. `make release-install-lock` wrote them from the archives of `make release-assets TAG=v0.0.4 RELEASE_COMMIT=HEAD`, so the consumer install check reads the archives of the version of `package.json`.

## 0.0.4

### 2026-10-09 — Stale git pins in the release version check (C13.1-23)

- `scripts/release.mjs` rejects a `pyproject.toml` whose git pin `polyspec/crudui@vX.Y.Z` names a version other than the release version. The problem names the file, the pin and the tag, so `make release-versions` fails before the tag of a Python package release is created.

### 2026-10-08 — Evidence of partial runtimes in the conformance check (C13.1-32)

- `scripts/check-conformance.mjs` accepts the recorded cases of a `partial` runtime: each recorded case must pass, and no case is required. A case outside the fixture of a partial runtime is still reported. The CI job `conformance evidence against the standard` no longer rejects the Python evidence of `createForm`.

### 2026-10-08 — Python conformance suites in the evidence check (C13.1-31)

- `scripts/check-conformance.mjs` declares the suites `validator Python` and `generator Python`, which run through `tests/conformance/runner.py` and prove the runtime `python`. The test `every runtime that a feature supports is proven by a declared suite` passes.

### 2026-10-08 — Python suite run records with the runner exit status (C13.1-33)

- `tests/conformance/runner.py` runs the unittest suite of one test directory and writes its run record with the program `tests/conformance/runner.py` and the exit status of the suite. The make targets `test-validator-python` and `test-generator-python` run it, so the run record of each Python suite is no longer `did not finish`.
- `tests/conformance/runs.py` takes the program, tool, directory and arguments of a run from its caller, and `tests/conformance/evidence.py` no longer records a run at import.

### 2026-10-08 — Stale-pin check deferred to the version-bump pull request (C13.1-23)

- The release check of stale git pins in `pyproject.toml` is not added to `feat/python-C13.1`. The pin `v0.0.4` of `packages/generator-python` names a tag that is created after the version-bump pull request merges, so the check belongs to that pull request. The row C13.1-23 is open and waits for it.

### 2026-10-08 — Node.js setup and Python matrix in the python CI job (C13.1-30)

- The CI job `python` sets up the Node.js release of `.node-version` and checks `node python` with `make toolchain-check`, because its `make ci-targets` run needs Node.js. The toolchain policy test accepts the lowest `requires-python` minor (3.11) as a matrix leg beside the recorded minor.

### 2026-10-08 — Python module names in the generator script docstrings (C13.1-29)

- The docstrings of `packages/generator-python/scripts/generate_interface_messages.py` and `packages/validator-python/scripts/generate_unicode_data.py` name their modules by dotted names, so the package-name rule passes in the CI job `build, lint and types`.

### 2026-10-08 — Python target in the native command of the make-tool-path test (C13.1-28)

- `tests/build/make-tool-path.test.mjs` expects the target list `javascript,html,go,rust,python` of `make test-native`, the list that the Makefile runs, so the test passes in the CI job `build, lint and types`.

### 2026-10-08 — Python 3.11 import of the validator resolver (C13.1-27)

- `packages/validator-python/src/polyspec/crudui/validator/resolver.py` imports the alias `Node` from `parser` and defines the alias `Context` above the annotations that name it, so Python 3.11 imports the module. The CI job `python` failed on 3.11 with `NameError: name 'Node' is not defined`. The validator and generator suites pass on Python 3.11.

### 2026-10-08 — Python implementation of the validator and the generator (C13.1)

- `polyspec-crudui-validator` and `polyspec-crudui-generator` are implemented in Python with the standing of the other language implementations: the shared fixtures run in the Python unit tests with evidence, the feature contracts state the Python support, the CI workflow runs the Python suites in a `python` job, and both packages pass `mypy --strict`.

### 2026-10-08 — Done marker of C13.1-11 restored (C13.1-22)

- The status cell of C13.1-11 holds the done marker in both checklists, and `scripts/check-documents.mjs` passes, exit 0.

### 2026-10-08 — Type hints of the Python packages (C13.1-17)

- Every public definition of `packages/validator-python` and `packages/generator-python` has parameter and return types: the AST count of public definitions without annotations is 0 in both packages. Both packages pass `mypy --strict` with exit 0.

### 2026-10-08 — Type hints of the generator package initializer and the strict check of both packages (C13.1-17-11)

- The `Generator` operations and their helpers have parameter and return types. `mypy --strict` exits 0 on both `packages/validator-python/src` (15 files) and `packages/generator-python/src` (21 files). The validator suite passes 23 tests and the generator suite 11 tests.

### 2026-10-08 — Type hints of the form module (C13.1-17-10)

- The module `form` of `packages/generator-python` has parameter and return types with no `mypy --strict` error. The generator unit tests pass (11 tests), and the native Python checks exit 0.

### 2026-10-08 — Type hints of the binding module (C13.1-17-9)

- The module `binding` of `packages/generator-python` has parameter and return types with no `mypy --strict` error. The generator unit tests pass (11 tests), and the native Python checks exit 0.

### 2026-10-08 — Type hints of the details and form render modules (C13.1-17-8)

- The modules `details` and `form_render` of `packages/generator-python` have parameter and return types with no `mypy --strict` error. The generator unit tests pass (11 tests), and the native Python checks exit 0.

### 2026-10-08 — Type hints of the lists module (C13.1-17-7)

- The module `lists` of `packages/generator-python` has parameter and return types with no `mypy --strict` error. The generator unit tests pass (11 tests), and the native Python checks pass 741 cases, exit 0.

### 2026-10-08 — Type hints of the widget module (C13.1-17-6)

- The module `widget` of `packages/generator-python` has parameter and return types with no `mypy --strict` error. A date or date-time value that is not a string is no longer passed to the date parser; it stays the value of the control. The generator unit tests pass: 11 tests.

### 2026-10-08 — Type hints of the rendering and display declaration modules (C13.1-17-5)

- The modules `rendering` and `display_declaration` of `packages/generator-python` have parameter and return types with no `mypy --strict` error. The generator unit tests pass: 11 tests.

### 2026-10-08 — Type hints of the buttons and choice list modules (C13.1-17-4)

- The modules `buttons` and `choice_list` of `packages/generator-python` have parameter and return types with no `mypy --strict` error. The generator unit tests pass: 11 tests.

### 2026-10-08 — Type hints of the value, design and template modules (C13.1-17-3)

- The modules `value`, `design` and `template` of `packages/generator-python` have parameter and return types with no `mypy --strict` error. The generator unit tests pass: 11 tests.

### 2026-10-08 — Type hints of the foundation generator modules (C13.1-17-2)

- The modules `errors`, `messages`, `input_text`, `numbers`, `dates` and `style` of `packages/generator-python` have parameter and return types with no `mypy --strict` error. The generator unit tests pass: 11 tests.

### 2026-10-08 — Type hints of the validator package (C13.1-17-1)

- Every function of `packages/validator-python/src` has parameter and return types, and the package passes `mypy --strict` with exit 0 (15 source files). The validator unit tests pass: 23 tests. The changes are committed under C13.1-17.

### 2026-10-08 — Generator behavior kept from an earlier session (C13.1-21)

- The generator modules `binding`, `lists`, `value`, `widget`, `__init__`, `dates` and `style` carry the behavior left uncommitted by an earlier session, committed apart from their type annotations. At this state the generator unit tests pass (11 tests) and `node tests/native-generators/run.mjs --target python` reports 741 passed, exit 0.

### 2026-10-08 — Python job in the CI workflow (C13.1-7)

- The `python` job of the CI workflow has a matrix of 3.11 and the recorded release 3.14, runs the validator and generator unit tests through make targets listed in `CI_COMMANDS`, preserves the conformance evidence of the recorded release, and is needed by `conformance` and `ci-passed`. The CI command mapping test passes 15 tests, exit 0. The job itself runs in CI after the push.

### 2026-10-08 — CI mapping test of the native command with the Python target (C13.1-7-3)

- The CI mapping test pins the native generator command of `make test-native-generators` with the python target. `tests/build/ci-local.test.mjs` passes 15 tests, exit 0.

### 2026-10-08 — Python version and feature support of the packages (C13.1-6)

- `.python-version` names Python 3.14 and the recorded toolchain names the same release; the CI workflow sets up 3.14 for the Python job; the owner checks map `.python-version` and the Python package paths; the feature contracts give the Python support of each feature (C13.1-6-1). `make toolchain-check TOOLS=python` exit 0, `make test-ordered-json` exit 0, `tests/build/contract-manifest.test.mjs` 12 passed. `tests/build/runtime-version-policy.test.mjs` fails in this environment on the npm version (`make install-npm` installs the recorded release) and on the Rust toolchain on PATH, not on the Python version.

### 2026-10-08 — Python support of the feature contracts (C13.1-6-1)

- The feature contracts give the Python support of each feature from the recorded evidence: 12 features `pass` (every case of their JSON fixtures has a passing Python record, 0 mismatches), `createForm` is `partial`, four outline and session features are `unsupported` and four client-side features are not applicable. The feature documents and the README pairs name the Python packages; `scripts/check-documents.mjs` passes, exit 0.

### 2026-10-08 — State markers kept out of the record text (C13.1-20)

- The records of C13.1-10 and C13.1-11 write the state markers as words, and `scripts/check-documents.mjs` passes its 53 document pairs, exit 0.

### 2026-10-08 — Python program in the native generator checks (C13.1-7-2)

- The native generator checks run the Python program: `node tests/native-generators/run.mjs --target python` reports 741 passed, exit 0. `make test-native-generators` includes the python target; in this environment that make target stops at its cargo prerequisite check before the checks run.

### 2026-10-08 — Form.setData rejects data that is not an object (C13.1-19)

- `Form.setData` fails with `INVALID_FORM_INPUT` and `Form data must be an object` for data that is not an object. The native generator checks of the Python target pass: 741 passed, exit 0, including `action-failure-keeps-state`.

### 2026-10-08 — Conformance evidence of the Python unit tests (C13.1-7-1)

- The Python unit tests record the conformance evidence of each shared case they run: 1637 records, none failed. Records are written only when CRUDUI_CONFORMANCE_EVIDENCE names a directory.

### 2026-10-08 — Python validator in the cross-check console (C13.1-5)

- The cross-check console runs the Python validator process beside the JavaScript, PHP, Go and Rust processes, and its request comparison requires the five to agree. The server test suite passes: 1267 tests, exit 0.

### 2026-10-08 — Records name commits by checklist id (C13.1-18)

- The records of C13.1-1, C13.1-2, C13.1-3, C13.1-4, C13.1-10 and C13.1-11 name each commit by the checklist id of the task it implements.

### 2026-10-08 — PHP extension built for the architecture of its PHP executable (C13.1-16)

- The PHP extension builder reads the architecture of the PHP executable with
  `lipo -archs` and passes it with `-arch` to the compile and link commands.
  The builder fails when the linked module has another architecture.
  Red: the architecture unit test failed on the missing export. Green: the
  architecture unit test passes (5 tests in `tests/build/php-extensions.test.mjs`),
  `make build-php-extension` builds an arm64 module that loads, and the
  cross-check vitest suite passes: 1267 tests, including the `php-native` process.

### 2026-10-08 — Scope of the form-outline fixture for Python (C13.1-15)

- The row C13.1 declares `tests/fixtures/form-outline` out of scope of the Python
  validator and generator: the reference products of C13.1 do not read it.

### 2026-10-08 — Python version file in the wave plans (C13.1-14)

- The wave plans state that `.python-version` does not exist until C13.1-6 is done.

### 2026-10-08 — Validator test file count in the checklist (C13.1-13)

- The row C13.1-2 counts the five validator test files that `discover` selects
  with the pattern `test_*.py`.

### 2026-10-08 — Validator public names in the shared camelCase surface (C13.1-12)

- `polyspec.crudui.validator` exports `validateList`, `validateDetail` and
  `hiddenPaths`, the names of the shared surface, in place of `validate_list`,
  `validate_detail` and `hidden_paths`. The validator unit tests pass: 23 tests.

### 2026-10-08 — Recorded facts of the committed Python history (C13.1-11)

- The rows C13.1-1, C13.1-3 and C13.1-4 record that no commit adds a `[~]` line
  for C13.1-1 to C13.1-4 before its `[o]`, the committer of the commits
  the C13.1-1 fix commit, the C13.1-3 package commit and the C13.1-4 test commit, and the body of the C13.1-1 fix commit, which
  describes the names before its fix.

### 2026-10-08 — Recorded import cause of the committed Python trees (C13.1-10)

- The rows C13.1-2 and C13.1-4 record that the test directory of
  `packages/validator-python` and of `packages/generator-python` was added by
  the commit that verifies it. Before those commits the directory does not
  exist, and the discover command raises `ImportError: Start directory is not
  importable`.

### 2026-10-08 — Dependencies of the Python generator (C13.1-9)

- `packages/generator-python` no longer declares `polyspec-ordered-json`: no
  generator module imports it. It declares `polyspec-crudui-validator` by the
  tag URL `v0.0.4` of this repository, `packages/validator-python`, because
  the generator imports `polyspec.crudui.validator` at run time.

### 2026-10-08 — Python generator defects found in the review (C13.1-8)

- `Form` binds the one initial row of missing repeated data under the key
  `__0000000000000__`, as `bindForm` and the `empty-collections` contract
  state, instead of a random row key. Red: the `multiple-leaf-empty-placeholder`
  case failed with the key `__0a592ccb0f808__`. Green: the form-render test
  passes all 137 result cases through `createForm` and `renderForm`.
- The text-validity test reads `FormError.path` as the `at` member of a
  generation failure.
- The conformance normalizer has no branch whose two arms are the same.
- The unit tests of `packages/generator-python` pass: 11 tests.

### 2026-10-08 — The Python generator on the shared fixtures (C13.1-4)

- The unit tests of `packages/generator-python` read the shared fixtures and
  compare every case with the recorded expectation: `form-render` (188: 137
  results as parsed normalized trees and 51 failures), `list-render` (157),
  `detail-render` (62), `form-complete` (28) and the `compileForm` (7),
  `bindForm` (9), `createForm` (15), `buildList` (11) and `buildDetail` (6)
  files of `text-validity`.

### 2026-10-08 — The Python generator package (C13.1-3)

- `packages/generator-python` publishes `polyspec-crudui-generator` as the
  namespace package `polyspec.crudui.generator` for Python 3.11 and newer, over
  `polyspec-crudui-validator`: template compilation, field binding, buttons,
  the form instance with its row operations, list and detail models, the
  widget, style and rendering internals and the value helpers. `Generator`
  exposes `compileForm`, `bindForm`, `bindButtons`, `formButtonsHtml`,
  `createForm`, `renderForm`, `renderList`, `buildList`, `renderDetail`,
  `buildDetail`, `sequenceRowKey` and `createRowKey` beside `Form` and
  `FormError`.
- The validator text module gains the message-returning `specificationFailure`,
  `inputFailure` and `optionEntries` helpers, which the generator wraps in its
  `FormError` of code `INVALID_FORM_INPUT`.

### 2026-10-08 — The Python validator on the shared fixtures (C13.1-2)

- The unit tests of `packages/validator-python` read the shared fixtures and reproduce every
  recorded case: `validate` (309: 178 results and 131 failures with `code`, `message` and `at`),
  `expr` (54), `compose` (20), `spec-validity` (34), `list-validity` (20), `detail-validity` (13)
  and the `validate`, `validateList` and `validateDetail` files of `text-validity` with the 12
  value graphs built with shared and self-containing containers.

### 2026-10-08 — The Python validator package (C13.1-1)

- `packages/validator-python` publishes `polyspec-crudui-validator` as the namespace package
  `polyspec.crudui.validator` for Python 3.11 and newer, with the standard library only: the
  composition engine, the forbidden-key scan, the input text and value limit checks, the pattern
  language recognizer and matcher over the Unicode 16.0.0 data of the contract, the condition
  parser, the path resolver, the value definitions with the ECMAScript number text, the 24
  validation rules and the field traversal.
- `validate`, `hiddenPaths`, `validateList` and `validateDetail` answer the shared results;
  `ComposeLoadError` and `FormInputError` carry the failure codes and traces of the other
  implementations.

### 2026-10-07 — Ports of the system for the form comparison runs (C11.6-5)

- `make test-form-comparison-browser` and `make test-form-comparison-summary` start every server on a port of the
  system, so runs at the same time do not collide; `FORM_ADDRESS` and `--address` of `local-verification.mjs` are
  removed.
- The browser summary requires the scheme and host of its origin in every report, without the port, and the source
  identity of the same tree.

### 2026-10-07 — The archive install check of a Go module tag (C11.6-4)

- `make release-install-check` takes the tag of the release: for a Go module tag `<directory>/vX.Y.Z`, which releases
  no archive, it names the tag and installs nothing, and for a tag `vX.Y.Z` it installs the archives of the tag.

## 0.0.3

### 2026-10-07 — The browser checks of each form server in a CI job of its own (C11.6-3)

- The CI job `form-comparison-browser` runs the browser checks of the form comparison in one job per server (`php`,
  `php-ext`, `go`, `rust`) with `make test-form-comparison-browser`; each job has the runner to itself and uploads the
  report of its server.
- The CI job `form-comparison-checks` runs after them with `make test-form-comparison-summary`: the PHP modes,
  generation, persistence, the canonical flow, the browser summary of the four reports, typing and the evidence, each
  once. `local-verification.mjs` takes `--servers`, `--browser-reports` and `--address`; the checks, reports and limits
  are unchanged, and `make test-form-comparison-checks` still runs every check in one run.

### 2026-10-07 — OrderedJSON from the released tag v0.0.3 (C11.6-2)

- The comparison takes OrderedJSON from the tag `v0.0.3` of `polyspec/ordered-json`: `orderedJsonVersion` of
  `examples/form-comparison/src/ordered-json-source.mjs` is 0.0.3 and `make install-ordered-json` checks out `v0.0.3`.
- The Rust record server, its `Cargo.lock`, the `package-lock.json` entry of `@polyspec/ordered-json`, the processor
  check of `tests/ordered-json`, the documents and `config/dependency-review.json` name 0.0.3.

### 2026-10-07 — The install of the release archives in CI (C11.6-1)

- The CI job `build-lint` runs `make release-install-head`: it writes the archives of `HEAD` at the version of
  `package.json` as `make release-assets` writes them and installs them from the consumer fixtures of
  `tests/release-install` with `scripts/release-install.mjs check`, so a broken archive fails CI before a tag. The
  release workflow keeps `make release-install-check`.

### 2026-10-07 — Published manifests that install outside the repository (C11.5)

- The published manifests are the package manifests of `packages/`, packed unchanged. Each names every dependency of
  the scope `@polyspec` and the vendor `polyspec` by its exact version; `packages/generator-php/composer.json` and
  `packages/validator-php/composer.json` declare their `version` and no `repositories`.
- Development resolution is in the root `composer.json` (`polyspec/crudui-workspace`, never published): a `path`
  repository of `packages/validator-php`, the generator sources by `autoload`, and `composer.lock` and `vendor/` at the
  root, which PHPUnit, the PHP checks and the PHP servers load. `scripts/php-package-autoload.php` loads the classes of
  the tested package from its source directory.
- `make release-assets` fails with each packed manifest that differs from its package manifest, names such a
  dependency by a URL, a path, a git source, a range or a development version, or is a `composer.json` with
  `repositories` or without `version`; `tests/build/release.test.mjs` applies the same check to the published
  manifests of the repository.
- `make release-install-check`, a step of the release workflow before the release is created, installs the archives
  from the consumer fixtures of `tests/release-install` in a temporary directory outside the repository: `npm ci` with
  an empty cache and the scope `@polyspec` on an unreachable registry, and `composer install` from an `artifact`
  repository with an empty `COMPOSER_HOME` and `COMPOSER_CACHE_DIR`. `make release-install-lock` regenerates the
  fixture locks from the archives.
- `docs/operations/repository.md` states the install of the release archives with npm and Composer and the
  development resolution.

## 0.0.2

### 2026-10-07 — OrderedJSON from the released tag v0.0.2 (C11.4-2)

- The comparison takes OrderedJSON from the tag `v0.0.2` of `polyspec/ordered-json`, which has a GitHub Release:
  `orderedJsonVersion` of `examples/form-comparison/src/ordered-json-source.mjs` is 0.0.2 and
  `make install-ordered-json` checks out `v0.0.2`.
- The Rust record server, its `Cargo.lock`, the `package-lock.json` entry of `@polyspec/ordered-json`, the processor
  check of `tests/ordered-json`, the documents and `config/dependency-review.json` name 0.0.2.

### 2026-10-07 — Dependency review of the 0.0.2 locks (C11.4-1)

- `config/dependency-review.json` records the review of the 9 locks with the 0.0.2 entries of the packages of the
  repository, written by `make dependency-review RECORD=1`; it found no newer stable release without an exception and
  no advisory, and `make test-dependencies` compares the checkout with it.

### 2026-10-07 — Release notes within the body limit of GitHub (C11.3)

- `make release-publish` writes the section `## X.Y.Z` of `CHANGELOG.md` as the release notes when it has at most
  125000 characters, the limit of a GitHub release body, and otherwise one line that links the section of
  `CHANGELOG.md` at the tag, `https://github.com/polyspec/crudui/blob/<tag>/CHANGELOG.md#<version without dots>`.
- `tests/build/release.test.mjs` requires a section of exactly 125000 characters kept whole and a longer one written
  as the line, for a tag `vX.Y.Z` and a Go module tag.

## 0.0.1

### 2026-10-07 — No container definition for the native suites (C7.20-3)

- `tests/containers/native.Containerfile`, `.dockerignore`, the Apple container procedure of the native generators and
  the container-build rules of the package build specification are removed; the CI jobs `php-engine`,
  `native-generators` and `php-api` run the native suites on their Linux runners.
- `tests/build/runtime-version-policy.test.mjs` fails for a tracked container definition, and a case of
  `tests/docs/repository-writing.test.mjs` fails for a document, other than the checklists and the change logs, whose
  code runs the container CLI of macOS or another container CLI.

### 2026-10-07 — Linux style checks on the CI runner (C7.20-2)

- `make test-form-styles-linux`, `make remove-form-styles-image` and `scripts/test-form-styles-linux.sh` are removed;
  the CI job `form-runtime` runs the stylesheet layout checks on its Linux runner with the pinned Chromium, Firefox and
  WebKit builds.
- A case of `tests/docs/repository-writing.test.mjs` fails for a tracked tool, a Makefile line or a workflow that
  invokes the container CLI of macOS or another container CLI.

### 2026-10-07 — Form comparison checks against a local stack in CI (C7.20-1)

- `make test-form-comparison-checks` (`examples/form-comparison/local-verification.mjs`) starts the four native record
  servers and the public server as local processes on ports of 127.0.0.1 that the system assigns and runs against them
  the PHP processor modes, the generation, persistence and canonical flow checks, the browser checks of the four
  servers with their interaction checks, the browser aggregate and the typing check; it checks the evidence of every
  report and stops the servers. The CI job `form-comparison-checks` runs it, and `ci-passed` needs it.
- `check-servers.mjs` takes `--origin`, `--data` and `--report`, and the unit tests of the checks run in the source
  suite again.
- The scenario check `serverInvalid` of the comparison frame expects the `detail` paths that the validator reports
  hidden for a store whose `enabled` is off.

### 2026-10-07 — Comparison checks without a container tool of a development machine (C7.20)

- `make deploy`, `make deploy-verify` and `make deploy-watch` are removed with the code that served only them: the
  Compose definition of the comparison service, its supervisor and toolchain image, the source watcher, the tree
  verification with the checks that only it ran, the container runtime resolution, the build targets, their tests and
  the operations page of the deployment. `make test-form-comparison` and `make test-form-comparison-pipeline` keep
  their standard: they start every record server as a local process on a free port of 127.0.0.1, compare the servers
  and stop them. The form comparison specification keeps the record resource, the canonical page and the canonical
  flow check, and the testing procedure describes the form checks.
- A case of `tests/docs/repository-writing.test.mjs` fails for a tracked file, other than the checklists and the change
  logs, that names a container tool of a development machine.

### 2026-10-07 — npm cache by package-lock.json (C12.1-2)

- Every job of the CI, Pages and release workflows that installs the npm packages restores and saves `~/.npm` with
  `actions/cache` under the key of the runner system, its architecture and the hash of `package-lock.json`, before it
  installs npm; `setup-node` caches nothing, because its cache saved the npm directory of the job that finished first,
  also of a job that installs no npm package, and every job restored 700 bytes.

### 2026-10-07 — Native suites in three CI jobs (C12.1-1)

- The native suites run in three CI jobs: `php-engine` runs `make test-php-engine`, the C engine tests of the PHP
  extension, once with Node.js and the C compiler; `native-generators` runs `make test-native-generators`, the Go and
  Rust generator tests, the protocol and widget tests and the shared suite of the JavaScript, HTML, Go and Rust
  targets, and `make test-bench` once; `php-api` runs `make test-php-api`, the build of `crudui.so`, its builder and API
  tests, the PHP generator tests and the shared suite of the PHP and native PHP targets, for PHP 8.4 and 8.5.
  `make test-native` runs the three targets, and `PHP_NATIVE_REPORT` names the report of the PHP targets.
- The job `conformance` downloads the evidence artifact of each job into a directory of its own, and
  `scripts/check-conformance.mjs` reads the evidence and the run records of the directory and its subdirectories, so
  no evidence file of one job replaces a file of the same name from another.

### 2026-10-07 — Release steps, Go module tags and archives (C11.1-4)

- `.github/workflows/release.yml` runs on the tags `v*` and `**/v*`: in a tag filter `*` does not match `/`, so
  `**/v*` covers the Go module tags `packages/<directory>/vX.Y.Z`. The job sets `TAG: ${{ github.ref_name }}` and ends
  with `make release-verify`, `make release-versions`, `make release-assets` and `make release-publish`, whose recipes
  pass the tag as `"$$TAG"`; `make release-assets` runs `make build`, and a Go module tag builds and attaches nothing.
- The release assets are npm tarballs and Composer zips only. A crate is not released as an archive; it is consumed by
  git tag, because `cargo package` rewrites git dependencies into crates.io requirements that do not resolve.
  `tests/build/release.test.mjs` lists how a tag releases each package file of `packages/`.

### 2026-10-07 — GitHub Releases from tags of main (C11.1-3)

- `.github/workflows/release.yml` runs on a pushed tag `vX.Y.Z` or `<directory>/vX.Y.Z`: `make release-verify` requires
  the commit on `main` and its check runs `push-gate` and `ci-passed` concluded `success`, `make release-versions` the
  version of the tag in every package file that the tag covers and the section `## X.Y.Z` of `CHANGELOG.md`;
  `make release-assets` writes the npm and Composer archives of `packages/`, named `<package>-<version>.<extension>`;
  `make release-publish` creates the GitHub Release with that section as its notes and the archives. A Go module tag
  has no archive.
- AGENTS and `docs/operations/repository.md` state the release procedure: the version-bump pull request, the tag of the
  merged commit by the maintainer and the release workflow.

### 2026-10-07 — One completion check of the CI workflow (C11.1-2)

- The last job `ci-passed` of `.github/workflows/ci.yml` needs every other job, runs under `if: ${{ always() }}` and
  runs `make ci-passed RESULTS='${{ toJSON(needs) }}'`, which fails unless every needed job has the result `success`;
  a failed, cancelled or skipped job fails it.
- The ruleset `main` of `.github/repository.json` requires exactly the checks `push-gate` and `ci-passed`, so a new or
  renamed CI job needs no change of the ruleset.

### 2026-10-07 — Changes of the coming release under Unreleased (C11.1-1)

- `CHANGELOG.md` and `CHANGELOG.ko.md` start with the section `## Unreleased`, which holds every entry as a heading
  `### <date> — <title> (<task ID>)`; the release of X.Y.Z names that section `## X.Y.Z` and writes a new empty
  `## Unreleased` above it.
- `tests/docs/changelog.test.mjs` requires `## Unreleased` as the first section, every other section `## X.Y.Z` and
  older than the one above it, every entry inside a section, and the same sections and entries in both files.

### 2026-10-07 — One installed version of each npm package (C5.8-11)

- `make dependency-review UPDATE=1` runs `npm dedupe` after its npm updates, so a package that one version satisfies
  is installed at one version after a workspace raised it.
- The dependency graph check fails for a package that `package-lock.json` installs at two versions when one of them
  satisfies every range of the packages loading either copy.
- The lock installs magic-string 1.4.3 for `@sveltejs/vite-plugin-svelte` and the hoisted undici-types 8.9.0 for
  `@types/jsdom`; the review records the lock.

### 2026-10-07 — Hidden paths in the cross-check form export (C8.3-6)

- The validator processes of the cross-check console answer a form with `{ valid, errors, hidden }`, as `validate` of
  each validator returns it, and a list or detail with `{ valid, errors }`. The gateway requires `hidden` of a form
  result, returns it with each language result of `POST /api/validate` and compares it in order across the languages.
- The fixture export of the form tab writes `expected` as `{ valid, errors, hidden }`, with the errors and hidden paths
  in the order of the validator, so an exported case has the shape of `tests/fixtures/validate/cases.json`;
  `server/fixture-export.test.mjs` compares exported cases with the shared cases.

### 2026-10-07 — Build, encoding and dependency review of the OrderedJSON tag (C10.3)

- The OrderedJSON PHP module is compiled from the C sources that the `config.m4` of the tag checkout declares, and
  PHP loads it as `ordered_json`; a failed command reports the output in which PHP writes a startup failure.
- An encoded form string writes every code unit outside printable ASCII as a `\u` escape, as OrderedJSON `v0.0.1`
  writes a constructed string.
- The dependency check requires `@polyspec/ordered-json` to be linked to the tag checkout at the version of the tag. No
  npm manifest declares a URL or Git dependency, and `.npmrc` sets `allow-remote=none` and `allow-git=none`.
- js-yaml 5.4.3, vite 8.3.3 and svelte 5.57.2; the review records every lock.

### 2026-10-07 — Exact workflow triggers (C6.2-1)

- `.github/workflows/ci.yml` runs on every pull request, merge group and manual run (`workflow_dispatch`),
  `.github/workflows/push-gate.yml` on every push outside `gh-readonly-queue/**`, pull request and merge group,
  `.github/workflows/pages.yml` on a push to `main` and a manual run, and `.github/workflows/dependency-review.yml` on its
  schedule and a manual run; no other workflow exists.
- `tests/build/ci-local.test.mjs` requires the `on:` block of each workflow exactly and no other workflow.

### 2026-10-07 — OrderedJSON from the tag v0.0.1 (C10.2)

- The comparison takes OrderedJSON from the tag `v0.0.1` of `polyspec/ordered-json`: `make install-ordered-json`
  checks out the commit of the tag, keeps a checkout at that commit without tracked changes and replaces any other
  one, and the local pipeline refuses a checkout at another commit than the tag, naming the tag.
- Until version 0.1, a polyspec repository depends on another polyspec repository through a GitHub tag of it.

### 2026-10-07 — Program names of the polyspec convention (C9.2)

- The programs of `examples/`, `tests/` and `tools/` follow the package naming: the cross-check console server is the
  npm package `@polyspec/crudui-cross-check-console`, the crates and binaries are `polyspec-crudui-cross-check-validator`,
  `polyspec-crudui-form-comparison`, `polyspec-crudui-native-generator` and `polyspec-crudui-bench`, and the Go benchmark
  driver is the module `github.com/polyspec/crudui/tools/bench/go`.
- `tests/build/package-names.test.mjs` requires the convention of every tracked `package.json`, `composer.json`,
  `Cargo.toml` and `go.mod`.

### 2026-10-06 — OrderedJSON from the branch main (C10.1)

- The comparison takes OrderedJSON from the branch `main` of `polyspec/ordered-json`: `make install-ordered-json`
  checks out its head, the root `package.json` names `@polyspec/ordered-json` from that checkout, and the record
  servers use the PHP namespace `Polyspec\OrderedJson`, the Go module `github.com/polyspec/ordered-json/go` and the
  crate `polyspec-ordered-json`.

### 2026-10-06 — PHP API pages of the polyspec namespace (C9.1-1)

- The API documentation requires the phpDocumentor pages of `Polyspec\Crudui\`
  (`classes/Polyspec-Crudui-Generator.html` and the pages of `Validator`, `Form` and `FormError`), so
  `make docs-check-documents` passes again; the package name check refuses the page form `CRUDUI-`.

### 2026-10-06 — Package names of the polyspec repositories (C9.1)

- The packages follow the naming of template and hyper: the npm packages are `@polyspec/crudui-*`
  (`@polyspec/crudui-validator`, `@polyspec/crudui-generator-html` and the others), the Composer
  packages `polyspec/crudui-generator` and `polyspec/crudui-validator` with the PHP namespace
  `Polyspec\Crudui\`, also for the classes of the PHP extension, and the crates
  `polyspec-crudui-generator` and `polyspec-crudui-validator`. Imports, `use` statements and
  dependencies name the new packages; the earlier names are gone.

### 2026-10-06 — Hidden paths in the documents of the validation result (C8.3-5)

- The READMEs of the TypeScript, Go and Rust validators, the PHP extension specification, the
  fixture specification and the README of the shared validation cases state the form validation
  result as `valid`, `errors` and `hidden`.

### 2026-10-06 — Native form fixture inventory of 188 cases (C8.4-1)

- The native generator suite expects the 188 form cases of `tests/fixtures/form-render/cases.json`,
  with the row parent and literal identifier cases of `design.show`, and runs each of them on every
  native target.

### 2026-10-06 — One response of the cross-check validator processes (C8.3-4)

- The PHP validator process of the cross-check console writes `{ valid, errors }` for a form, as
  the other processes do and `validators/README.md` states, and the input text cases expect that
  response from every process.

### 2026-10-06 — Hidden paths in the record saves of the form comparison (C8.3-3)

- Every record server of the form comparison answers a save with the validator's result as
  `validation`, `valid`, `errors` and `hidden` unchanged: the JavaScript server no longer replaces a
  passed result with `{ valid: true, errors: [] }`, and the Go and Rust servers add `hidden` to the
  result that they build, also in the response of the benchmark save and validation.
- The record contract expects `hidden` in every save and validation response, and the save of
  record 24 names the notes of the unchecked store in it.

### 2026-10-06 — Public types of the validation results (C8.3-2)

- The public type check of the built packages assigns the results of `validateList` and
  `validateDetail` to `ListValidationResult` and reads `hidden` of the `ValidationResult` of
  `validate`, in ESM and in CommonJS.

### 2026-10-06 — Public build test of hiddenPaths (C8.1-1)

- The public build test expects `hiddenPaths` among the exports of `@crudui/validator`, as
  `contracts/features.json` declares it, and checks its result through the built ESM and CommonJS
  entries.

### 2026-10-06 — Documented validation result type (C8.3-1)

- The interface `ValidationResult` of `@crudui/validator` has its own documentation comment, and
  `ListValidationResult` has one comment, so the documentation coverage of `validator-ts` passes
  again.

### 2026-10-06 — Changes reach main through pull requests and the merge queue (C6.2)

- Every change reaches `main` through a pull request and the merge queue: publish a branch with `git
  push`, `gh pr create` and `gh pr merge --auto --rebase`. The ruleset `main`, now declared in
  `.github/repository.json` and applied by `make github-settings`, requires a pull request, the merge
  queue with the method `REBASE`, a linear history and the checks of `push-gate` and of every CI job;
  the settings enable auto-merge and delete merged branches. CI runs on pull requests and merge
  groups, and `.github/workflows/pages.yml` deploys the documentation web of `main`.

### 2026-10-06 — Shared cases of display switching (C8.5)

- Shared validation cases fix the server result of display switching in the five validators: a
  group subtree with its required fields switched by a sibling, two nested groups switched by the
  same value, and groups inside repeated rows switched by their row and by the value beside the
  collection.

### 2026-10-06 — Rust visibility like the other runtimes (C8.4)

- The Rust validator, and the Rust renderer that uses its visibility, resolve `design.show` as a
  conditional parameter: a string is an expression only when it is a condition expression that
  parses completely, so `enabled` is a literal that shows the field, and a ternary gives its branch
  value, so a branch `0` is not false.

### 2026-10-06 — Hidden paths in the validation result (C8.3)

- The validation result of the five validators holds `hidden`, the data paths of the fields whose
  `design.show` resolves to false, so a server can leave the values of a hidden branch unstored; the
  results of `validateList` and `validateDetail` keep `{ valid, errors }`, which the TypeScript
  validator names `ListValidationResult` and the Go validator `ListValidationResult`.

### 2026-10-06 — A row is one level of a relative path (C8.2)

- A relative path, a conditional parameter and a field reference (`equalTo`, `notEqual`,
  `enddate`) treat a row of a repeated field as one level in the five validators and the eight
  renderers: in a field of a group row `..x` reads the field beside the collection whatever the
  row key is, and a field named with digits is not a row key. The runtimes pass the positions of
  the row keys with the path; a bare field reference resolves as `.name`.

### 2026-10-06 — Live display in the browser binding (C8.1)

- The browser binding sets the `hidden` attribute of every node from its `design.show` against
  the current data when it binds and after every change, removes the errors of a node that becomes
  hidden and of the nodes inside it, and changes no value; `hiddenPaths(spec, data)` of
  `@crudui/validator` returns the hidden paths.

### 2026-10-06 — One CI run per ref (C7.19)

- A new push to a ref cancels the CI run of its previous push; the push check still runs for every
  pushed commit.

### 2026-10-06 — Full run in a fresh clone (C5.7)

- `make ci` runs its commands in `var/full-run/clone`, a fresh clone of the committed commit after
  `make install`, so no ignored output of the working tree reaches a check.

### 2026-10-06 — Stub stall closed with its evidence (C7.13)

- The 30 s stall of the stub programs did not recur in 12 CI runs and 3 local runs; their first
  executions took up to 81 ms on Linux and up to 979 ms on macOS, and the logging stays.

### 2026-10-06 — Offline package install (C7.16-1)

- The install project of `npm run test:packages` installs with `npm ci --offline` from a lock that
  `scripts/install-lock.mjs` derives from the root lock, so it installs the releases of the root lock
  and resolves no range against a registry.

### 2026-10-06 — A report for every CI job (C7.18)

- Every CI job runs its checks with `make ci-targets`, which runs each target to its end, and uploads
  the log of each target with a summary of the first failure lines of each failed one, which also goes
  to the job summary.

### 2026-10-06 — Checklist wording (C7.15-1)

- The rows C7.15 and C7.16 describe the pre-push hook and the documentation job without the word
  that the writing check refuses, which failed the documentation job of CI.

### 2026-10-06 — CI through make (C7.17)

- Every step of the workflows runs a make target, so the offline settings, the checkout npm and the
  downloads check of the Makefile apply to CI: the install targets, `make toolchain-check TOOLS=...`
  and one target for each checking command, which `make ci` runs in the same order.

### 2026-10-06 — Offline checks (C7.16)

- The Makefile runs cargo, go, npm and Composer offline, and only the install targets and the
  dependency review download. `make install-crates` downloads the crates of every Cargo.lock, and a
  target that runs cargo fails first with the lock and `run make install` when a crate is missing.
  The comparison pipeline reads the OrderedJSON checkout of `make install-ordered-json` instead of
  fetching it.

### 2026-10-06 — Unit tests in development, every other check in CI (C7.15)

- Development runs the unit tests that own a change; end-to-end checks, `make owner-check` and
  `make ci` run in CI after the push, and no rule requires a local check before a commit or a push.
  The pre-push hook still refuses a push while a checklist task is in progress.

### 2026-10-06 — RustSec advisories of the Cargo locks (C5.8-1)

- The dependency review reads the advisories of the six Cargo locks from RustSec with cargo-audit
  0.22.2, which `make install` installs into `.tools/cargo-audit`, and records each lock with its sha256;
  `npm run test:dependencies` fails for a Cargo lock changed after its review or with an advisory at it.

### 2026-10-06 — Dependency review (C5.8)

- `npm run test:dependencies` compares the dependencies with the review recorded in
  `config/dependency-review.json` instead of running `npm audit` against the registry, so the same tree
  gives the same result on every day. `make dependency-review` asks the registries for newer stable
  releases and advisories, `RECORD=1` records the review and `UPDATE=1` updates first; a scheduled
  workflow runs it every day. React 19.2.8 is kept by a recorded exception (C5.8-2-1), and
  typescript-eslint moves to 8.71.1, the release that the first review found.

### 2026-10-06 — PHPUnit 13 (C5.8-10)

- validator-php and generator-php test with PHPUnit 13.4.1, and their 18 data providers are declared
  with the attribute `#[DataProvider(...)]`, since PHPUnit 12 removed the `@dataProvider` annotation.
  Both suites run the same 763 and 311 cases as with PHPUnit 10.5.

### 2026-10-06 — Checks that read the files of the checkout (C7.14)

- ESLint ignores every path that Git ignores, and the checks that walked the tree with their own lists
  of skipped directory names read the tracked files through `scripts/tracked-files.mjs`: a copy of a
  `dist` under the ignored `var/` failed `npm run lint`, and a stray file under an ignored directory
  could change the other checks. `tests/build/tracked-files.test.mjs` fails for a new list of skipped
  directory names.

### 2026-10-06 — jest-dom 7 (C5.8-9)

- generator-react tests with `@testing-library/jest-dom` 7.0.1; it stayed at 6.9.1 because 6.10.0 was
  deprecated as a minor release with breaking changes, which 7 publishes as a major.

### 2026-10-06 — @sveltejs/package 3 (C5.8-8)

- generator-svelte packages its components with `@sveltejs/package` 3.0.0; the 57 files of its `dist`
  are identical to those of 2.5.8.

### 2026-10-06 — Node.js type definitions of the running major (C5.8-7)

- The six TypeScript workspaces use `@types/node` 26.6.4, the major of the recorded Node.js 26.8.1;
  they described Node.js 25. `tests/build/runtime-version-policy.test.mjs` fails for an `@types/node`
  range of another major than `.node-version`.

### 2026-10-06 — js-yaml 5 with the YAML 1.2 core schema (C5.8-6)

- The cli and the cross-check console use js-yaml 5.4.2 through its named `load` export. Its default
  schema is the YAML 1.2 core schema, as the `yaml` package of `scripts/check-schema.mjs` reads it: a
  date-like value stays a string and `<<` is a plain key, where js-yaml 4 read a `Date` and merged. A
  case of each path pins it.

### 2026-10-06 — jsdom 30 in the whole tree (C5.8-5)

- The root and generator-react use jsdom 30.1.2, the release of form-binding, so one major of jsdom
  runs in the tree instead of 29.1.1 beside 30.1.2.

### 2026-10-06 — Failed Vitest hooks named from the events of Vitest (C5.8-4-1)

- The Vitest reporter prints `<hook name> hook of <entity> started and failed` for a hook that started
  and did not end before its file or suite failed, and the runner case asserts the hook name and the
  failed entities instead of the message of Vitest, whose wording changed from Vitest 4 to 5. Vitest
  5.0.3 sends no `onHookEnd` for a failed hook and batches its events, so neither the elapsed time nor
  the failure kind is asserted.

### 2026-10-06 — The first execution time of test stubs logged (C7.13-1)

- The stub cases of `tests/build/checkout-npm.test.mjs` and `tests/build/install-browsers.test.mjs` log
  the elapsed time of the first execution of each stub, so a recurrence of the 30 s stall of C7.13,
  which waits for that evidence, explains itself.

### 2026-10-06 — Python pinned by its minor release (C7.12)

- `config/toolchain.json` records Python 3.9, which runs the tests of `tests/ordered-json`, and
  `node scripts/check-toolchain.mjs python` compares the running major and minor and prints the patch.
  The build-lint job of CI sets it up with `actions/setup-python` by commit SHA and runs
  `make test-ordered-json`, which `make ci` runs too; no command ran those tests before C7.9.

### 2026-10-06 — PHP pinned by its minor release (C7.2-3)

- `config/toolchain.json` records the PHP minors 8.4 and 8.5, and `node scripts/check-toolchain.mjs`
  compares the major and minor of the running PHP with them; setup-php and Homebrew cannot install the
  same patch, so the exact patch record failed on one of them. The patch of a run is evidence: the
  check prints the running release of every tool and `var/full-run.json` records them. The container
  images keep their exact tags with digests. The local check now covers PHP, which closes C7.2-1.

### 2026-10-06 — The Chrome sandbox helper installed by one command (C7.2-4)

- `scripts/install-browsers.mjs` installs the sandbox helper with `sudo install -o root -g root -m 4755
  <chrome_sandbox> /usr/local/sbin/chrome-devel-sandbox`. It put `install` twice into the command, so
  every browser job of CI failed at the browser installation and Chrome aborted without its helper.

### 2026-10-05 — The owner check before every commit (C7.9)

- `make owner-check` runs the checks that `scripts/owner-checks.json` declares as owners of the changed
  paths: make targets, root npm scripts, the test scripts of workspaces and package directories and
  node test files, never the full suite. It fails before any check for a path without an owner, a
  glob without a path, a full-suite target, an unknown script or test, and a path that a check reads
  (`inputs`) when no rule of the path selects that check; every selected check runs after an earlier
  one failed. AGENTS makes it the check before a commit, since the owning checks of a change were
  chosen by hand. `make test-ordered-json` runs the Python unit tests of `tests/ordered-json`, which no
  command ran, and `make install` installs phpDocumentor, which `make docs-check` reads.

### 2026-10-05 — Failures that name what failed and why (C7.8)

- A test that outlives its timeout prints its elapsed time, its limit and the command that the runner
  stops; the other limits of the checks name their command, limit and elapsed time too.
  `scripts/run-tests.mjs` reports a tool that cannot start with its path, the error and the command
  that installs it instead of ending on an unhandled error; a Go package that ran no test case is
  reported as `ran no test case` instead of passed. Every file read of the Rust programs and tests
  names the path and the error; `tests/build/failure-messages.test.mjs` fails for a read that drops
  them.

### 2026-10-05 — A stopped process tree is gone when the stop ends (C7.10)

- `killProcessTree` of the form comparison step runner resolves when the step's process has exited
  and its output pipes have closed, which happens when every process that holds them has ended; it
  returned right after it sent SIGKILL, so a later step could meet a process of the stopped one. When
  the output stays open after the kill, a process outside the tree holds it and the stop fails with
  that cause. The local server test waits for the end of a Unix socket connection instead of a FIFO,
  whose blocking open kept the test file alive beyond its timeout when the stand-in did not start.

### 2026-10-05 — Servers on the ports they take, and locked shared steps (C7.11)

- Every server of the form comparison binds its address, port 0 included, and names the address it
  took on its readiness line `CRUDUI_READY {server} {host}:{port}`; the PHP launcher passes its bound
  socket to nginx, which reads it from the variable `NGINX`. The local stacks start every server on
  `127.0.0.1:0` and reach it on the announced address; `freePort` probed a port and released it to a
  later process, which another process could take in between.
- The reinstall of the generator-php vendor runs under the checkout lock `composer-generator-php` in
  make, the local servers and the comparison build, and the guard of `make ci` holds the checkout
  lock `full-run`, so two runs of one checkout never reinstall or decide from one record at once.

### 2026-10-05 — Shared outputs published by rename (C7.6)

- The PHP extension builder compiles into a directory of its process, links `<module>.so.<pid>`, loads
  and checks it and renames it to the module path; it removed `.build` and `modules` first and linked
  in place, so a PHP process could load a missing or partial module. The OrderedJSON checkout is made
  beside its directory and renamed into place. Every package build writes into `dist.next`
  (`CRUDUI_DIST`) and `scripts/package-dist.mjs` replaces `dist` with it under the `dist` lock, so a
  reader never sees the `dist` that `tsup --clean` emptied; a failed build leaves `dist`. The build
  stamp of `require-current-build` is written and renamed. `tests/build/atomic-publish.test.mjs` keeps
  every shared output on that form.

### 2026-10-05 — Checks that read only what they or their preparation create (C7.5)

- `make test-php-extension` reinstalls the validator copy of generator-php before its tests, which
  load that vendor directory; only `make test-native-suites` refreshed it. `test:build` runs
  `require-current-build` before the tests that load the packages through their exports.
  `scripts/repeat-build.mjs` compares its own two builds and fails with every file that differs; its
  test read the records that only that script wrote. `scripts/run-rust-command.mjs` refuses a
  `CARGO_TARGET_DIR` outside the checkout of its directory, because cargo judges freshness by
  modification times and reuses the outputs of another checkout.

### 2026-10-05 — Every check of a script after a failure (C7.4)

- `test:forms`, `test:form-comparison`, `test:form-comparison:pipeline`, `docs:check:all`, the `test`
  script of generator-svelte and the `typecheck` script of form-binding run each independent check
  with `|| status=1` and exit with the collected status; they chained the checks with `&&`, so the
  first failure skipped the others. `test:form-comparison:build` is removed and each form comparison
  suite runs `require-current-build` for the packages it reads. CI and `make ci` run `npm run
  test:build` and `npm run test:build:repeat` as two commands. `scripts/run-contract-tests.mjs` runs
  every declared command and fails after the last one. `tests/build/test-commands.test.mjs` fails
  for a package script or a CI step that stops at a failing check.

### 2026-10-05 — Runs that check nothing fail (C7.3)

- `scripts/run-tests.mjs` fails a go, cargo or phpunit run and the Vitest reporter fails a vitest run
  in which no test case passed, failed or ran out of time, with `ran no test case`;
  `scripts/run-contract-tests.mjs` fails with `ran no command` when the selected features declare no
  verification command. Such runs passed while they checked nothing.
- The PHP check of the container definitions reads the `php` stages and the `php8.N-*` packages and
  fails on an empty list; it iterated over the `FROM php:` stages, of which there were none, while
  both images installed the Debian PHP 8.4. Both images now take PHP from the `php` image of the
  recorded 8.5.11 and Composer from the `composer` 2.10.3 image, each by digest, and the PHP
  extension builds use `/usr/local/bin/php-config`.
### 2026-10-05 — One visible page for the Tailwind style checks (C5.11)

- `tests/tailwind-styles.test.mjs` computes the styles of `crudui.css` and of the Tailwind version in
  one page per engine and width, which holds both stylesheets and applies one with its `media`. The
  test opened two pages in one browser, the first page was hidden in Chromium and Firefox, and under
  memory pressure a call on the hidden Chromium page waited up to 44.2 s on page-ins, past the timeout
  of a case. Each call now fails unless its page is visible and only the requested stylesheet applies.

### 2026-10-05 — The toolchain image test with the digest stages (C7.2-2)

- `examples/form-comparison/check-toolchain.test.mjs` requires the stages of the comparison image as
  the recorded releases with their digests. C7.2 changed the stages and was committed while this test
  still required the release lines.

### 2026-10-05 — Exact toolchain versions everywhere (C7.2)

- The specification records exact versions instead of release channels, which made the toolchain of
  a run depend on its date. `.node-version` is 26.8.1, `.go-version` 1.27.0 with a `toolchain` line in
  every `go.mod`, `rust-toolchain.toml` 1.98.1 with `rustfmt` and `clippy`, and
  `config/toolchain.json` records PHP 8.4.26 and 8.5.11, Composer 2.10.3 and the SHA-256 of the Linux
  Node.js archive. The Makefile, CI and the images set `RUSTUP_AUTO_INSTALL=0` and
  `GOTOOLCHAIN=local`; `make install` installs the npm, the dependencies and the Rust toolchain, and
  `node scripts/check-toolchain.mjs` fails for a tool at another version with the record, the expected
  and the running version and the fix; every CI job runs it for the tools it set up.
- CI runs on `ubuntu-24.04` with every action named by the commit SHA of a release; container stages
  name their images by tag and digest and install Debian packages from the snapshot of 2026-10-05.
  Chrome and Firefox run at the builds that puppeteer pins and WebKit at the build of playwright
  (`node scripts/install-browsers.mjs`), in CI with the sandbox helper of that Chrome; the Linux style
  check downloads the Node.js archive of `.node-version` and checks its SHA-256.
  `scripts/run-contract-tests.mjs` runs `sh -c` instead of a login shell.

### 2026-10-05 — The checkout npm module in the copies of the tests (C7.7-1)

- `tests/build/rust-node-entry-points.test.mjs` and `tests/build/run-command.test.mjs` copy
  `scripts/checkout-npm.mjs` with the scripts that import it since C7.7, which failed to load
  without it in their temporary checkouts.

### 2026-10-05 — npm of the checkout, not of the machine (C7.7)

- `node scripts/install-npm.mjs` installs the npm release of `packageManager` into the ignored
  `.tools/npm` of the checkout with `npm install --prefix` into a temporary directory that it renames
  into place, and never runs `npm install --global`. It replaced the npm of the machine, which every
  repository uses, and broke the `npm ci` of another repository. The Makefile exports
  `PATH` with `.tools/npm/node_modules/.bin` first and starts npm in its recipes as `$(NPM)`, because
  GNU Make 3.81 looks up a recipe program without shell syntax on the `PATH` it started with; every
  script that starts npm calls `useCheckoutNpm` of `scripts/checkout-npm.mjs`, and every CI job adds
  the directory to `GITHUB_PATH` before its first npm command. `tests/build/checkout-npm.test.mjs`
  fails for any other form.

### 2026-10-05 — Make dry runs that read the same on every make (C7.1)

- Tests read the commands of a Makefile target through `makeDryRun` of `tests/build/make-dry-run.mjs`,
  which runs `make --no-print-directory -n` with `MAKEFLAGS=w` and without the variables of a parent
  make. GNU Make 4 inside another make printed `Entering directory` lines around the commands, so
  `tests/build/full-run.test.mjs` failed there. `tests/build/make-dry-run.test.mjs` fails for a dry
  run of make outside the helper.

### 2026-10-05 — React kept at 19.2.8 (C5.8-2-1)

- React and React DOM are pinned to 19.2.8. React 19.3.0 reports a browser error for the `<script>`
  elements of widget scripts that the React renderer renders, so the React cases of
  `tests/widget-script-runs.test.mjs` failed in three browsers after C5.8-2 raised React. The update
  is retried when the React renderer runs widget scripts without `<script>` elements in client
  rendering.

### 2026-10-05 — Vitest 5 (C5.8-4)

- The root and the eight workspaces test with Vitest 5.0.3. Vitest 5 prints a failed hook with the
  `Error:` prefix of its stack, and the runner case for a timed-out Vitest hook accepts it.

### 2026-10-05 — TypeScript 7 for the workspace compilers (C5.8-3)

- The seven TypeScript workspaces build and type-check with TypeScript 7.0.2. typescript-eslint,
  typedoc, svelte-check and `@sveltejs/package` declare peer ranges below 7, so they keep the
  TypeScript 6.0.3 that npm installs at the root as their peer.

### 2026-10-05 — Dependencies at the latest release of their major (C5.8-2)

- 19 npm dependencies of the root and workspace manifests and PHPUnit in both Composer packages are
  raised to the latest stable release of their locked major, among them `puppeteer` 25.12.0,
  `eslint` 10.12.0, `react` and `react-dom` 19.3.0, `vite` 8.3.2 and PHPUnit 10.5.66. Each
  manifest keeps its range operator, the `react` overrides follow the direct ranges, and the install
  script approval names `puppeteer@25.12.0`. `@testing-library/jest-dom` stays at 6.9.1 because its
  publisher deprecated 6.10.0 as a minor release with breaking changes.

### 2026-10-05 — One npm release locally, in CI and in the images (C5.2-2)

- `packageManager` of `package.json` records npm 12.2.0, and `node scripts/install-npm.mjs`
  installs exactly that release. Every CI job runs it before npm, and the native test and comparison
  images install the same release. CI ran `npm i -g npm@latest`, so its npm changed with the
  registry: npm 12 broke a test that passed with npm 11 locally.
  `tests/build/runtime-version-policy.test.mjs` fails when the running npm, a workflow step or a
  container definition selects another release.

### 2026-10-05 — Every check of a recipe after a failure (C5.10)

- `make docs-check-documents` and `make format-check` run every check of their recipes with
  `|| status=1` and exit with the collected status. Make stops at the first recipe line that fails,
  so a failing `npm run manifest:check` skipped the other document checks, the documentation tests
  and the documentation build, and the first Rust crate that differed from rustfmt skipped the
  other crates and gofmt. `tests/build/test-commands.test.mjs` fails for a recipe line after the
  first check of its target, for `|| exit` in a check and for a check that does not set `status=1`.

### 2026-10-05 — Every registered node:test case runs or its file fails (C5.9)

- `scripts/run-tests.mjs` preloads `scripts/test-progress/load-check.mjs` into every `node:test`
  file's process, which fails a file whose process ends before its module finished evaluating, and
  the node reporter fails a file that reports no case. The lint rule
  `crudui/no-await-after-test-registration` of `scripts/lint/node-test-rules.mjs` rejects a
  top-level `await` after the first `node:test` registration. `node --test --test-force-exit` ends
  a file's process when its known tests end, and `packages/php-ext/tests/engine.test.mjs`
  registered tests after top-level `await`s: a case before the first `await` ran alone, and with
  `--test-name-pattern` the file passed while no case ran. engine.test now reads its fixtures
  synchronously and imports the Unicode data generator statically.

### 2026-10-05 — The npm pack report of npm 12 (C5.2-1)

- The dist lock test of `tests/build/shared-resources.test.mjs` reads the `npm pack` report through
  `packReport` of `scripts/package-install-pack.mjs`, which reads the array of npm 11 and the
  object keyed by package name of npm 12, and fails with the expected archive count and package
  name. With npm 12, which CI installs as the latest npm, the test failed with `TypeError: object
  is not iterable`, which does not say what was expected.

### 2026-10-05 — Pushes refused while a task is in progress (C6.1)

- The tracked pre-push hook `.githooks/pre-push` runs `node scripts/push-gate.mjs hook`, which
  reads the checklist of every pushed commit and of the working tree with `activeItems` of
  `scripts/full-run.mjs` and refuses the push while a task is `[~]`, naming each task with its ID
  and title, the reason and the remedy. A pushed commit without the checklist, a Git error and an
  error of the check also refuse the push. Before, a push with a task in progress reached GitHub.
- Every `make` run sets `core.hooksPath` to `.githooks`; `make hooks` installs and checks the
  hook, `make hooks-check` fails while it is not installed, and the guard of `make ci` refuses
  while it is not installed.
- The job `push-gate` of `.github/workflows/push-gate.yml` runs `node scripts/push-gate.mjs commit`
  on every pushed commit and pull request and fails for a commit with a task in progress, without
  the checklist or without the executable hook, so a push past the hook fails it.

### 2026-10-05 — A comma locale written with warnings (C5.6)

- The engine tests report the build of the comma locale on Linux by its result: `localedef -c`
  exits with status 1 when it writes the locale with warnings, and the step printed
  `comma locale: compiling: failed (1)` before its test passed. Status 1 with a written
  `LC_NUMERIC` is now reported as `wrote the locale with warnings (exit 1)`, and any other status
  other than 0 fails the build. A case of `packages/php-ext/tests/engine.test.mjs` runs the build
  with a stub `localedef`.

### 2026-10-05 — The suites behind missing conformance evidence (C5.5)

- `scripts/check-conformance.mjs` names, for each feature, fixture and runtime with missing or
  failing evidence, every suite that proves the runtime with its state: did not run, did not
  finish, ended with failure and its exit status, or passed. `scripts/run-tests.mjs` and
  `tests/native-generators/run.mjs` write a run record to `runs/` of the evidence directory through
  `tests/conformance/runs.mjs`, with the status null at the start and the exit status at the exit,
  and `evidenceSuites` declares each suite with its command and runtimes. The check reported
  `185 missing` for each runtime when the native suite did not run and did not say why. The count
  of evidence files no longer includes the `runs` directory.

### 2026-10-05 — One compiler command for the engine tests (C5.4)

- Every C program of `packages/php-ext/tests/engine.test.mjs` compiles through
  `compileAndRunEngineProgram`, which links the math library. The template and value tests wrote
  their own compiler commands, and the template test, without `-lm`, failed on Linux with
  `undefined reference to 'log10'`; macOS has the math functions in its system library. A case of
  the file fails when the file holds more than one compiler command or when that command does not
  link `-lm`.

### 2026-10-05 — Character constants in long C strings (C5.3)

- `cString` of `packages/php-ext/tests/engine.test.mjs` writes each byte of a value longer than
  4000 bytes as a character constant with an octal escape. It wrote the bytes as integers, so a
  UTF-8 byte above 127 initialized a `char`, and GCC failed the render fixtures with
  `-Werror=overflow`; Apple clang accepts both forms. A case of the file fails for an integer above
  127 in the initializer and decodes the constants back to the bytes of the value.

### 2026-10-05 — A dist lock test without build output (C5.2)

- `tests/build/shared-resources.test.mjs` checks the `dist` lock on a fixture package that it
  builds and packs in a temporary checkout. CI runs `npm run test:runtimes` before `npm run build`,
  and the test failed with `ENOENT` on `packages/generator-html/dist`, while a local run read the
  `dist` of an earlier build. In a worktree without build output the test failed before the change
  and passes after it.

### 2026-10-05 — Every check after a failure (C5.1)

- Every workflow step that runs a checking command has `if: ${{ !cancelled() }}`, and `make
  test-native` and `make docs-check` run each of their test targets with `$(MAKE) <target> ||
  status=1` and exit with the collected status. CI skipped Lint, Type-check, the
  dependency check and the benchmark drivers after one failed step, and `make test-native` stopped
  at its failed prerequisite `test-php-extension`, so `tests/native-generators/run.mjs` wrote
  neither its report nor its conformance evidence. `tests/build/ci-local.test.mjs` fails with the
  job and step of a checking step without the condition, `tests/build/test-commands.test.mjs`
  fails for a Makefile target that takes a target that runs tests as a prerequisite, and
  `tests/build/make-tool-path.test.mjs` runs `make test-native` with a failing PHP extension test
  command. The native import check of `tests/build/dependency-health.test.mjs` read only the recipe
  lines of `test-native` and checked an empty list; it follows prerequisites and `$(MAKE)` targets
  and fails for an empty list.

### 2026-10-05 — A checklist of headings and task tables (C4.1-2)

- The execution checklist holds only headings and task tables, and `scripts/check-documents.mjs`
  fails for any other line with its file, line and column. The checklist held a translation link, a
  paragraph on its content, the How to use rules and a paragraph of dependencies and background
  under each wave, and no check told such text from tasks. The rules are in AGENTS, and the
  dependencies and the background of the waves are in `docs/plans/waves.md`, which each wave heading
  links. The case of `scripts/checklist-markers.test.mjs` failed before the change.

### 2026-10-05 — Task list states as state markers (C4.1-1)

- `scripts/check-documents.mjs` also fails for an x or a capital X between brackets in the
  execution checklist that is not the state of a task row, because a Markdown reader takes these
  forms as task list states. The case of `scripts/checklist-markers.test.mjs` failed before the
  change, because the check reported neither form.

### 2026-10-05 — Task state markers only as task states (C4.1)

- A task state marker appears in the execution checklist only as the state of a task row, at the
  start of its last cell. The legend of the checklist and the text of C2.1-2 wrote markers in inline
  code, so a tool that counted markers counted tasks in progress that do not exist.
  `scripts/check-documents.mjs` now fails for any other marker in both languages and names its
  file, line and column; the legend is removed, AGENTS defines the states, and the texts name states
  in words. `scripts/checklist-markers.test.mjs` failed with `ERR_MODULE_NOT_FOUND` before the
  change, and its fixture passed the former document check.

### 2026-10-05 — Guard of the full run (C2.1-2)

- `make ci` starts the guard `scripts/full-run.mjs` before any command. AGENTS states that the full
  suite runs exactly once, when every active task is done, and nothing enforced it: `make ci`
  started its commands with a task in progress, with uncommitted changes and on a tree it had
  already verified. The guard prints its decision with the reason and refuses while a checklist task
  is `[~]`, listing each active ID with its task, while tracked changes are uncommitted, and when
  `var/full-run.json` records a full run of the current tree, naming that run. It runs each command
  of `CI_COMMANDS` to its end and writes the record before and after each command, so a stopped run
  stays `incomplete`. `make rerun-failed` reruns only the commands of the current tree that did not
  pass and keeps the conformance evidence of those that passed. `tests/build/full-run.test.mjs`
  failed with `ERR_MODULE_NOT_FOUND` before the change; its 11 cases pass with stub commands after
  it.

### 2026-10-05 — Local servers stopped at the exit of their test process (C2.19)

- The local stack of the form comparison tests stops the process groups of the servers it started
  when its test process exits without stopping them. A pipeline test whose stop hook timed out and
  whose process was forced to exit left its record servers running for hours.

### 2026-10-05 — Change signal of every deployment (C2.10-2)

- `make deploy` signals the supervisor before it waits for the build in either mode: containerctl
  also reuses an unchanged container whose supervisor started from an earlier checkout.

### 2026-10-05 — Service port answered from the supervisor's start (C2.13-3)

- The comparison supervisor listens on port 8080 from its start and answers 503 with the build
  state until it hands the port to the public server. containerctl checks the service port within
  one minute of the container start; without the healthcheck that C2.13-2 removed, a first build of
  empty volumes outlasted that minute and `make deploy` failed at the connection.

### 2026-10-05 — Change signal of a reusing deployment (C2.10-1)

- `make deploy` signals the running supervisor before it waits for the build when it reuses the
  container, so a new commit is compared without the source watcher; it waited on the previous
  commit's ready state. `make deploy-watch` stops at `SIGINT` or `SIGTERM` with a line that says
  how many signals it delivered.

### 2026-10-05 — Reuse of a routed comparison container (C2.18-1)

- The deployment reuses a running comparison container only when containerctl routes
  `crudui.test` to it; otherwise it applies the definition with containerctl. A changed route was
  never applied because the image of the running container matched.

### 2026-10-05 — Route of the comparison service under x-containerctl (C2.18)

- The Compose definition of the comparison service lists its domain under
  `x-containerctl.domains`, and the deployment check reads the `domains` and `urls` of
  `containerctl status --json`. containerctl routes only those domains, so the
  `containerctl.domain` label left the service internal and `make deploy` failed at the route.

### 2026-10-05 — Chromium of the comparison image (C2.17)

- The comparison toolchain image installs `chromium` and `chromium-sandbox`
  `154.0.8037.92-1~deb13u1`. Debian replaced the pinned `153.0.8010.47-2~deb13u1`, so the image
  build of `make deploy` failed.

### 2026-10-05 — Steps of the form comparison without limits (C2.13-2)

- A step of the form comparison runs to its end and is decided by its exit status: the step
  runner rejects a total or inactivity limit, and the build targets, the verification checks,
  the local builds, the host verification and the deployment steps hold none. The Compose
  definition declares no healthcheck, whose budget bounded the first build; the deployment waits
  for the build state of the checkout instead. The Git calls of the source comparison and of the
  OrderedJSON checkout hold no timeout. The units inside a check keep their own limits.

### 2026-10-05 — Process tree stops of exited groups (C2.16)

- `killProcessTree` of the form comparison completes when the group of the stopped process holds
  only exited processes: a group signal answered with EPERM, as macOS answers for a group whose
  processes have exited but are not yet reaped, leaves nothing to stop. The stop failed with
  `kill EPERM` after it had killed the tree.

### 2026-10-05 — Source changes published from the host (C2.10)

- The form comparison supervisor compares the mounted repository at every `SIGUSR2` instead of
  once per second. The host's source watcher `source-events.mjs` (`make deploy-watch`) subscribes
  to the file events of the working tree and for every event runs `source-changed.mjs` in the
  container, which signals the process id the supervisor records in `state/supervisor.pid`.
  Signals during a comparison, and events during a delivery, make one more run after it
  (`src/change-requests.mjs`). The heartbeat that rewrote the state file every 15 seconds is
  removed. `tests/build/test-commands.test.mjs` fails on a program that sleeps or runs an interval
  that prints no progress line.

### 2026-10-05 — PHP record server ready on its processes' lines (C2.15)

- `servers/php/main.mjs` is ready when PHP-FPM writes `NOTICE: ready to handle connections` and
  nginx, at the `notice` log level, writes `start worker processes`, and copies their standard
  error. It tried a connection every 20 ms and failed after a start limit of 10 seconds.

### 2026-10-05 — Waits of the form comparison without limits (C2.13-1)

- The build readiness wait has no inactivity or step limit: it ends when this source is ready,
  fails on a failed cycle or a state file that cannot be watched, read or parsed, and prints every
  new step and a line every 15 seconds. The supervisor publishes `progress` without `limitMs`. A
  process start waits for its readiness event without the 30-second limit and prints a line every
  15 seconds. The browser start and close of the browser and pipeline checks run through
  `runOperation` without a limit; the units of a browser report keep their limits.

### 2026-10-05 — Failed version commands fail the benchmark (C2.14)

- `tools/bench/run.js` fails with the command, its failure and its output when a version command
  fails or prints no version, and `results.md` records the versions of the tools of the backends
  that ran. A failed version was recorded as `unavailable` and an empty one as `unknown`, and the
  versions of all four tools were queried for every run.

### 2026-10-05 — Package builds and packs under the lock of dist (C3.5)

- Every built package's build script is `node ../../scripts/package-dist.mjs build '<command>'`,
  which holds the checkout lock `dist-<package folder>` for the whole build. `tsup --clean` and
  `svelte-package` empty `dist` first, so a concurrent pack that ran during a build read an empty or partly written `dist`. `node scripts/package-dist.mjs pack <package
  directory> <destination directory>` checks under the same lock that `dist` holds output and runs
  `npm pack`, printing its JSON report; the package install check packs through it.
- On Linux, `scripts/holder-lock.mjs` reads the start time of a process from `/proc/<pid>/stat`
  and the boot time of `/proc/stat`, since the toolchain image of the comparison, which builds the
  packages, has no `ps`; other systems use `ps`.

### 2026-10-05 — A holder lock of the comparison deployment (C3.4)

- `make deploy` and `make deploy-verify` take the user-wide holder lock `form-comparison-deployment`
  before any other step and release it when they exit. The deployment is one Compose project
  `crudui` with its container and its volumes for the user account, and a deployment from another
  checkout replaced it while a verification ran. A held lock refuses the run with the
  holder's checkout, pid and process start time. `holdUntilExit` of `scripts/holder-lock.mjs`
  releases a lock at process exit, also after `process.exit` from a signal handler.
  `examples/form-comparison/check-deployment-lock.test.mjs` runs in
  `npm run test:form-comparison:source`.

### 2026-10-05 — A kept Playwright image under a holder lock (C3.3)

- `make test-form-styles-linux` keeps the Playwright image. A run that pulled the image removed it
  at its exit, also while a run of another checkout still used it. The container now
  runs under the user-wide holder lock of the image, so a second run is refused with the holder's
  checkout, pid and process start time. `make remove-form-styles-image` removes the image under the
  same lock and is refused while a check runs. `node scripts/holder-lock.mjs user-lock-file <name>`
  prints the path of a user-wide lock.

### 2026-10-05 — Holder locks of single resources (C3.2)

- `scripts/holder-lock.mjs` holds a resource that only one run may use at a time. The lock file's
  record names the checkout, the pid and the process start time of the holder, the time and the
  command; it is written completely and linked to the lock path, so the lock is taken atomically.
  A held lock refuses with the holder's record. A lock whose holder process no longer runs, or
  whose pid belongs to a process with another start time, is reported and kept until
  `node scripts/holder-lock.mjs remove-dead <lock file>` removes it; the command refuses a running
  holder. Only the holder releases the lock. `hold` runs a command while holding the lock. Locks of
  one checkout are under `var/locks/`, locks that every checkout shares under
  `~/.local/state/crudui/locks/`. `tests/build/holder-lock.test.mjs` runs in `npm run test:runtimes`.

### 2026-10-05 — A snapshot directory per documentation run (C3.1)

- `make docs-verify-idempotent` writes its two snapshots and their difference to a directory that
  the run creates with `mktemp -d` and removes at its exit. It used the fixed paths
  `/tmp/crudui-docs-run1`, `/tmp/crudui-docs-run2` and `/tmp/crudui-docs-diff.txt`, which a run of
  another checkout removed and rewrote during the comparison.
  `tests/build/shared-resources.test.mjs`, run by `npm run test:runtimes`, fails on a Makefile line
  with a fixed path under `/tmp`.

### 2026-10-05 — Stage steps that meet through a pipe (C2.9-1)

- The two steps of one stage in the step runner test open the two ends of a named pipe, so the
  stage ends only when both run at the same time. They waited for each other's file through a
  directory watch, whose event stream on macOS starts late and lost a file in 4 of 10 runs.

### 2026-10-05 — Setup contract of the local pipeline stack (C2.7-2)

- `check-verification.test.mjs` checks that the pipeline and record store tests start and stop
  their stack and browser through `setup` and `teardown` of `scripts/test-progress/hooks.mjs` and
  register no hook of their own. It required the `browser-start` and `browser-close` limits that
  C2.7-1 removed from the pipeline test.

### 2026-10-05 — Readiness wait on the state file itself (C2.4-1)

- The readiness wait of the form comparison watches the build state file itself
  (`watchStateFile`), whose watch is registered when it returns, and at every replacement watches
  the new file before it reads. It watched the file's directory, whose event stream on macOS starts
  after `fs.watch` returns, so a replacement made right after the wait started could be lost; the
  real-file case failed in 5 of 10 loaded runs and passes in 20 of 20.

### 2026-10-05 — One test per render case in the viewport and Tailwind checks (C2.11)

- `tests/viewport.test.mjs` and `tests/tailwind-styles.test.mjs` open the pages of each engine and
  width in a setup of a suite and run every one of the 432 shared render cases as its own test with
  the runner's timeout of 30 seconds. Each engine and width ran all cases inside one test with a
  timeout of 300 or 600 seconds and printed only its start and end.

### 2026-10-05 — Reproducible build in a logged step (C2.12)

- `npm run test:build:repeat` builds the packages twice with `scripts/repeat-build.mjs`, a logged
  step without a time limit that records the path and SHA-256 digest of every output file of the
  published packages after each build. `tests/build/reproducible-build.test.mjs` compares the two
  records with each other and with the current output under the 30-second timeout of each test; it
  ran both builds inside one test case through a blocking `execFileSync` under 120 seconds.

### 2026-10-05 — Native generator checks in one pool (C2.8)

- `tests/native-generators/run.mjs` builds the Go and Rust programs once in a build step before
  any check, with the output of the build tool, a line every five seconds and no time limit; the
  preparation budgets of 300 and 900 seconds and the 30-second limit of every process are removed.
  A probe checks each PHP program within a check budget. The checks of every target run in one pool,
  `os.availableParallelism()` at a time, each as its own test with its budget and its signal in its
  asynchronous context. The 738 checks of each target ran one after another, and the javascript,
  html, php and php-native targets start an interpreter for every request, so the suite took 962.5
  seconds, almost all in checks; the same 4428 checks now pass in 199.8 seconds.

### 2026-10-05 — Setups without a hook timeout (C2.7-1)

- `scripts/test-progress/hooks.mjs` replaces `scripts/test-progress/teardown.mjs` and adds `setup`,
  a `before` hook of a file, a suite or a test with the timeout `Infinity` that ends when its
  launch, start or compile settles and prints its start, a line every five seconds and its end.
  The setup hooks of the style, Tailwind, viewport, widget script, form inspector, pipeline and
  record store tests use it; they held limits of 60 or 120 seconds, the browser start limit or the
  30-second timeout that node:test gives a hook without its own. The browser job test launches its
  browser once in a setup instead of inside tests of 10 or 30 seconds, and connects to it a second
  time with the one-second protocol timeout its protocol timeout tests need. The Vitest `beforeAll`
  hooks of the cross-check console server and the form binding have the timeout `Infinity`.

### 2026-10-05 — Causal checks instead of elapsed-time bounds (C2.9)

- No test bounds an elapsed time; `tests/build/test-commands.test.mjs` fails on an `assert.ok` that
  compares an elapsed time with anything but 0. The runner timeout and hook cases of
  `tests/build/run-tests.test.mjs` run a test or hook that never settles through a spawn that does
  not block the event loop, so only the runner's timeout ends them. The readiness, health, stop,
  timeout and stall cases of the form comparison end only by the stop under test, the two steps of
  one stage each end only when the other's file exists, and the oversized save relies on its 413 and
  the case's own timeout. Ten assertions bounded the wall-clock time between 0.5 and 20 seconds.

### 2026-10-05 — Teardowns without a hook timeout (C2.7)

- `teardown` of `scripts/test-progress/teardown.mjs` registers a browser close, a server stop or a
  directory removal as an `after` hook of a file or of a test with the timeout `Infinity`. It ends
  when its close resolves or its process exits, fails the file with its error, and prints its
  start, a line every five seconds and its end with the elapsed time. The teardown hooks of the
  pipeline browser test, the form inspector test, the record store test, the browser job test, the
  style, viewport, Tailwind and widget script tests and the documentation server test use it; the
  Vitest `afterAll` hooks of the cross-check console server and the form binding have the timeout
  `Infinity`. node:test gave a hook without its own timeout the test timeout, so on a loaded
  machine the server stop of the pipeline test ran out of its 10 seconds and the browser close of
  the inspector test out of 30 seconds while every test passed. `tests/build/teardown.test.mjs`
  runs a teardown of 1.5 seconds under a test timeout of one second.

### 2026-10-05 — Commands of long operations without a limit (C2.3-1)

- `scripts/run-command.mjs` replaces `scripts/bounded-command.mjs`. It runs a command to its exit
  without a time limit, takes the exit status as the result, and stops the processes the command
  left in its process group when it exits, so a process that holds an output pipe cannot hold the
  caller. The package build of `scripts/require-current-build.mjs`, the tools of
  `scripts/gen-api-docs.mjs`, the declared commands of `scripts/run-contract-tests.mjs`, the drivers
  and version queries of `tools/bench/run.js` and the driver builds of `tools/bench/build-drivers.mjs`
  have no limit of 600 or 30 seconds, and `CRUDUI_COMMAND_LIMIT_SECONDS` is removed.
  `build-drivers.mjs` streams the compiler output with its step lines. With the former module and a
  one-second limit, each script failed on a command that ends after 1.2 seconds;
  `tests/build/run-command.test.mjs` replaces `tests/build/bounded-commands.test.mjs` and checks the
  stop of a left-behind child through the close of the script's output instead of a bound on time.

### 2026-10-05 — CI without time limits (C2.2-1)

- The CI workflow has no `timeout-minutes`. A step runs tests, whose cases hold their own timeouts
  in `scripts/run-tests.mjs`, or a long operation (checkout, toolchain setup, install, build, lint,
  type check, upload, deployment), which prints its logs and has no time limit; no job has a limit
  over its steps. C2.2 had given 84 such steps a limit of 5 or 10 minutes and kept the limits of the
  `deploy-docs` and `conformance` jobs. `tests/build/test-commands.test.mjs` fails on a job or a
  step with `timeout-minutes`; it required one on every step that runs no tests.

### 2026-10-05 — Long operations without a timeout (C2.1-1)

- AGENTS gives a long operation (a build, an install, a toolchain setup, a browser close, a server
  stop, a whole suite) detailed step logs and no timeout, no inactivity limit included; its result
  and errors decide its success or failure, and the event of its result ends it. Each test case
  keeps its own timeout. The rule of C2.1 gave a long operation step logs in addition to its own
  timeout, so a normal run that took longer than its limit failed.

### 2026-10-05 — Build readiness on change events (C2.4)

- `readyBuild` of `examples/form-comparison/verify-tree.mjs` reads the build state file at its
  start and at every change event of the file's directory (`fs.watch`); it reread the file every
  second. A timer runs only when an inactivity or step limit ends or a progress line is due. The
  clock, the watch and the read are parameters, and the readiness tests of
  `check-verification.test.mjs` change the state with explicit events and a fake clock instead of
  a file rewritten every 20 ms and bounds on wall-clock time. With the event loop blocked 350 ms
  of every 400 ms, the former cases failed and the new ones pass.

### 2026-10-05 — Built benchmark drivers in the driver test (C2.3)

- `npm run test:bench` builds the packages, then the Go and Rust benchmark drivers with
  `tools/bench/build-drivers.mjs`, which prints each build with its elapsed time and stops it at
  600 seconds with its process group. `tests/build/bench-drivers.test.mjs` runs the built drivers
  (`tools/bench/drivers.mjs` names them) and each of its tests has the 30-second timeout of the
  test runner; the accepted case compiled the drivers through `go run` and `cargo run` under a
  600-second timeout. `tests/build/test-commands.test.mjs` fails when the test sets its own timeout
  or runs a driver through `run`, and `tests/build/bounded-commands.test.mjs` stops a driver build
  that never ends at its limit.

### 2026-10-05 — CI time limits of setup steps only (C2.2)

- No CI job that runs tests and no step that runs tests has `timeout-minutes`; the test runner
  bounds each test. Every other step of such a job (checkout, toolchains, installs, builds,
  uploads) has a limit of 5 or 10 minutes, and a job without tests keeps its job limit.
  `tests/build/test-commands.test.mjs` follows npm scripts, Composer scripts and Makefile targets
  to find the steps that run tests and fails on a limit over them; it required a job limit before
  and listed 13 jobs when the case was added. `test:form-comparison:pipeline` builds through
  `scripts/require-current-build.mjs`, which bounds the build.

### 2026-10-05 — PHPUnit counts of the test runner (C2.5)

- The PHPUnit mode of `scripts/run-tests.mjs` counts only tests. A `testSuiteFinished` message
  carries no location, so the finish of a test class or a data provider method was counted as a
  passed test: the validator-php run reported 804 passed tests where PHPUnit ran 763, and now
  reports 763. Lines that are not TeamCity messages, such as `Test file "..." not found` and the
  summary with its warnings, are printed; they were dropped. `tests/build/run-tests.test.mjs`
  failed on both before the change.

### 2026-10-05 — Test rules of the repository (C2.1)

- AGENTS runs only the Red and Green tests that own a change while a task is in development, and
  the full suite exactly once, when every active task of the checklist is done; it ran the full
  suite at each completed feature. A long operation prints step logs in addition to its own
  timeout; the rule let the step logs replace the timeout. `make docs-check` runs only when a
  document or a public API document changed, and the Verification column of the checklist names
  the commands that own a task. The checklist lists wave 2.

### 2026-10-04 — Export of the Tailwind version (C1.5)

- `@crudui/generator-core` exports `./crudui.tailwind.css`. The feature status lists
  `viewport-widths` and `tailwind-styles`, and the operations document states the viewport and
  Tailwind tests and the regeneration after a change of `crudui.css`. The full suite (`make ci`)
  passes; its first run failed `npm run lint` and `npm run test:runtimes` on the new tests and
  script, which C1.4-1 corrected.

### 2026-10-04 — Tailwind version of the styles (C1.4)

- `packages/generator-core/styles/crudui.tailwind.css` holds the rules of `crudui.css` in the
  cascade layer `components`. `packages/generator-core/scripts/write-tailwind-styles.mjs` writes it,
  and its `--check` mode, part of `npm run test:forms`, fails when the committed file differs; it
  failed before the file existed. `tests/tailwind-styles.test.mjs` compiles the file with the theme
  and the utilities of Tailwind CSS 4.3.3 and compares the computed styles with `crudui.css` for the
  432 shared render cases at 360 and 1280 px in Chromium, Firefox and WebKit: no element differs.
  It failed with `Can't resolve` before the file existed. Tailwind CSS and `@tailwindcss/node` 4.3.3
  are development dependencies of the repository.

### 2026-10-04 — Specification of the Tailwind version (C1.3)

- The form markup contract specifies `crudui.tailwind.css`: the rules of `crudui.css` inside the
  cascade layer `components` of Tailwind CSS 4, generated from `crudui.css` and checked against
  it, with the same computed styles as `crudui.css` at 360 and 1280 px. The task first required a
  second stylesheet written with `@apply`; it is amended, because two hand-written copies of the
  rules could differ. The file is not implemented yet (C1.4).

### 2026-10-04 — Lists that fit a narrow viewport (C1.2)

- `.crudui-list` scrolls horizontally on its own, so a table wider than the viewport, such as the
  list case `format-number-shortest` with its long numbers, no longer widens the page. At 360 CSS
  pixels that case made the document 408 to 428 px wide in Chromium, Firefox and WebKit.
  `tests/viewport.test.mjs` places the expected HTML of the 432 cases of the shared render
  fixtures in a page with `crudui.css` at 360 and 1280 px in the three engines and requires no
  horizontal overflow of the document and every control and action inside the viewport; it failed
  on that case before the change.

### 2026-10-04 — Viewport widths of the stylesheet (C1.1)

- The form markup contract states the viewport widths of `crudui.css`: at 360 and 1280 CSS
  pixels the expected HTML of every shared render fixture causes no horizontal overflow of the
  document, and every control and action lies within the viewport except inside an element that
  scrolls horizontally on its own. The stylesheet had no rule for a narrow viewport.

### 2026-10-04 — NodeNext declarations of the Svelte renderer

- `@crudui/generator-svelte` declares `"type": "module"`, and the public type test
  (`tests/build/public-packages.test.mjs`) did not compile the package. The test now resolves the
  package for the ES module fixture to `dist/index.d.ts` in ES module format and compiles `Form`
  and `renderForm` in the ES module fixture (`tests/build/public-types.mts`). Its compiler host
  resolves an import of a `.svelte` file to the `.svelte.d.ts` declaration beside it, as the
  Svelte toolchain resolves it.
- The extended test failed with `TS2835: Relative import paths need explicit file extensions in
  ECMAScript imports` in `dist/components/Widget.svelte.d.ts`, which imported `./widget`. The
  relative imports of the package's `.svelte` and `.ts` source files now name `.js` files. The
  published JavaScript and Svelte files differ only in these import paths.

### 2026-10-04 — NodeNext declarations of the Vue renderer

- `@crudui/generator-vue` declares `"type": "module"`, so TypeScript reads its declarations as ES
  modules, but their relative imports had no file extension. A strict `NodeNext` project failed
  with `TS2834: Relative import paths need explicit file extensions in ECMAScript imports` in
  `dist/index.d.ts`. The public type test (`tests/build/public-packages.test.mjs`) did not compile
  the package, so no check reported the error.
- The test now resolves the package for the ES module fixture to `dist/index.d.ts` in ES module
  format, and compiles `Form`, `renderForm` and `AnyWidget` in the ES module fixture
  (`tests/build/public-types.mts`) and the CommonJS fixture (`tests/build/public-types.cts`). The
  relative imports of the package source now name `.js` files. The JavaScript output of the
  `import` and `require` exports is byte-identical to the output before the change.

### 2026-10-04 — Release checks of the browser validation binding

- The package install check (`scripts/check-packages.mjs`), the public package test
  (`tests/build/public-packages.test.mjs`) and the reproducible build test
  (`tests/build/reproducible-build.test.mjs`) did not include `@crudui/form-binding`, so a release
  did not pack, install, type-check or rebuild it. The install check and the reproducible build
  test now fail when their package list differs from the packages of `contracts/features.json`,
  and both include the package. The install project imports `bindForm` and binds a form rendered
  by `renderForm`, and its browser check submits the empty form and requires the required error
  and the focus on the control.
- The public package test showed that TypeScript resolved the package's declarations for a
  CommonJS project although Node.js has no CommonJS entry, and that the declarations were in
  CommonJS format for an ES module. The package now declares `"type": "module"` and only an
  `import` export with its types, and its relative imports name `.js` files, so the ES module
  declarations resolve under `NodeNext`. The test requires the import export to load from `dist`
  with the exports of the contract, rejects a CommonJS resolution in Node.js and TypeScript, and
  type-checks `bindForm` in the ES module install fixture.
- The declaration build test now covers every published package with a `tsconfig.build.json` and
  fails when one is missing; it adds `@crudui/form-binding` and `@crudui/generator-html`, which
  had the same declaration build and was not checked.
- The browser check of the binding (`packages/form-binding/tests/browser.test.ts`) ran only in
  Chromium, while the other browser checks run in Chromium, Firefox and WebKit. It now runs the
  same case in the three engines through `tests/browser-engines.mjs`, with
  `tests/browser-engines.d.mts` as its types, and a local HTTP server serves the page and records
  each submission instead of Playwright routes, which Puppeteer does not have. The case passes in
  the three engines. CI no longer installs the Playwright Chromium, which no check uses, and the
  package no longer declares `playwright`.

### 2026-10-04 — Browser validation of server-rendered forms

- `@crudui/form-binding` (`packages/form-binding`) validates a server-rendered complete form in the
  browser with the specification the server validates it with. A form rendered on the server was
  validated only after a request, so a user saw errors only after the round trip.
- `bindForm(form, spec, options)` builds the data from the named controls inside the form's nodes as
  a native submission sends them and a server decodes them: strings, CRLF line breaks, `[]` names
  as lists, rows keyed by their row keys, and no member for an unchecked checkbox, an empty choice,
  a select without a selected option or a collection without rows. File, disabled and node-less
  controls take no part, and errors of a node that contains a file control are left to the server.
- It validates a changed node when its control loses focus and on every later change, and the whole
  form on submit and on `validate()`. It writes the `crudui-node__errors` and `crudui-form__errors`
  markup that `renderForm` writes for the same errors, replaces server-rendered errors at the first
  validation of their node, and sets and removes `aria-invalid` on the controls of each written
  node. It sets `novalidate`, so the browser's constraint validation does not stop a submission
  first.
- An invalid submission is cancelled in the capture phase of the window with `preventDefault()` and
  `stopImmediatePropagation()`, so no other submit listener such as htmx sends a request, and focus
  moves to the first invalid control. `options.message` and `options.formErrors` supply the texts.
- The specification defines the binding in [form runtime](docs/spec/form-runtime.md#browser-validation);
  [form markup](docs/spec/form-markup.md#class-names) records the one class exception: the binding
  finds the error slots by four classes, and a test of the package fails when its source names
  another class.
- The package tests run through `make test-form-binding` and `npm run test:forms`: data collection
  of every control kind, timing, submission, focus, `aria-invalid` and options in jsdom; the error
  markup of 59 invalid cases of the shared validation fixture equals `renderForm`'s; and a
  Chromium check through Playwright shows an error after leaving a changed field, sends no request
  for an invalid submission and submits the corrected form. CI installs the Playwright Chromium
  with WebKit.

### 2026-10-04 — Choice groups

- The choice list of a `select`, `dropdown` or `selectbox` field may contain groups, each a label
  and one or more value and label pairs, mixed with plain choices in written order. A list is a
  choice list when an element has a `value` or a `choices` member. Values stay distinct across the
  whole list; binding rejects an empty group, another member, a nested group, appearance members
  and a group in any other field, and the `choice-label` format rejects a group.
- An option model inside a group has the member `group` with the group's index in `items` and its
  translated label. Every renderer writes the choices of a group inside an `optgroup` element, on
  the raw path of a select with behavior attributes too.
- The `in` rule of the TypeScript, PHP, PHP extension, Go and Rust validators takes the values inside
  groups as members and rejects a malformed group with `INVALID_RULE_PARAMETER`.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust pass the shared form
  cases `choice-groups-*` and the list case `reject-format-items-choice-group`; the five validators
  pass the shared validation cases `value-in-choice-groups*`. The PHP extension engine test counts
  the current fixture inventory and links the units the engine programs use.

### 2026-10-04 — Choice appearance

- A choice in the choice list of a `choice` or `multichoice` field may declare `class` and `style`
  for its label and `attributes` for its input, with the declared attribute rules, and the field's
  `design.group` applies to the `crudui-choices` element. Binding rejects these members in the
  choice lists of other fields and a class or style that is not a string or attributes that break
  the rules with `INVALID_FORM_INPUT`.
- An option model has `className`, `style` and `attributes` after `id`. Every renderer writes the
  choice class after the label classes as single-spaced tokens, its style on the label and its
  attributes after the field's control attributes; a name declared in both keeps the field's
  position and takes the choice's value.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust write the appearance in
  the shared form cases `choice-appearance-*` and reject the nine written appearance cases.

### 2026-10-04 — Range fields

- A `range` field renders a `crudui-widget crudui-widget--range` widget: the prepend affix, a range
  input with `min`, `max` and `step` from its literal `validate.range` and `validate.step`, a
  `crudui-widget__output` output with the current value and the append affix as the unit.
  `compileForm` requires both rules as literal values and a minimum that is a multiple of the step,
  decided exactly as the `step` rule decides it, and fails with `INVALID_FORM_INPUT` otherwise.
- The validators check a range field with its `range` and `step` rules.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust write the range widget
  in the shared form cases `range-*` and reject the eight written range cases; the TypeScript, PHP,
  PHP extension, Go and Rust validators pass the shared validation case `range-field-values`.

### 2026-10-04 — Inline and line layouts

- A group declares `design.layout`: `inline` makes every field node inside it one row of a label
  column of `--crudui-label-width` and a control column with the control, the description and the
  errors; `line` places the group's child nodes side by side; `stacked` ends an inherited inline
  layout. A group without the declaration inherits the layout of the enclosing group, and a
  repeated group applies `inline` to the fields of its rows. `compileForm` rejects the member on
  another field, a form button and the form root, another value and `line` on a repeated group
  with `INVALID_FORM_INPUT`.
- The node model writes `crudui-node--inline` and `crudui-node--line` at the start of the root
  class. In an inline layout a checkbox or switcher field with a label writes the label in the
  header and the input alone in the body.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust write the layout in
  the shared form cases `inline-layout-*` and reject the six written layout cases. The typed
  specification models of the PHP, Go and Rust validators accept `design.layout`.

### 2026-10-04 — Declared attributes of controls and nodes

- A form field declares `data-*` and `aria-*` attributes for its control with `design.attributes`
  and for its node root with `design.wrapper.attributes`. `compileForm` rejects a value that is not
  an object, a name outside the rule or written by CRUDUI and a value that is not a string with
  `INVALID_FORM_INPUT`; form buttons, lists, details and the label, group and prepend nodes reject
  the member as an unknown key.
- The node model has the wrapper attributes after `style`, the checkbox model after `caption`, and
  a widget model appends the control attributes to `attrs`, to `extra.file` of a file layout or
  keeps them in `extra.option` of a choices layout. Every renderer writes them after the attributes
  CRUDUI writes, with the placements of React's server rendering.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust write them in the
  shared form cases `control-attributes-*`. The JSON Schema, the TypeScript types and the typed
  specification models of the PHP, Go and Rust validators accept the declarations.

### 2026-10-04 — Button fields render as buttons

- A `button` or `action` field renders one `button` element with `type="button"`, the class
  `crudui-action crudui-action--text` and the `design.class` class, the `design.style` style, the
  control id, the behavior event attributes and the declared attributes, and the escaped `content`
  text. A behavior `onclick` script is an `onclick` attribute of the button. The field writes no
  jQuery click script, no hidden input and no `name`, and submits no value.
- The widget model has the tag `button` and the content as `text`; the `buttonText` member and the
  `init_script` option are removed.
- The stylesheet makes the button as wide as its content and as high as the other controls.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust write the button in
  the shared form cases `button-empty`, `action-alias`, `button-behavior-onclick` and
  `control-attributes-file-display-button`.

### 2026-10-04 — Switcher fields render as switches

- A `switcher` field renders a switch: its checkbox model has `role: "switch"` after `checked` and
  the control class `valid-target crudui-input crudui-input--switch` before the `design.class`
  class, and every renderer writes `role="switch"` after `type="checkbox"` and the declared
  attributes after `role`. The input submits and binds as a checkbox. A `checkbox` field keeps its
  markup.
- The stylesheet draws the switch as a track with a round thumb from the accent, border, subtle and
  surface properties, measured in Chromium, Firefox and WebKit.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust write the switch in the
  shared form cases `switcher-bare` and `control-attributes-checkbox`.

### 2026-10-02 — Script actions run on click

- A list or detail script action writes its script in `onclick` of its button, so the script runs
  when the button is clicked. It wrote the script in `on{name}`, for example `onremove` for the
  action `remove`, an event that a button never fires, so the script never ran. Its action model
  is `{ key, label, behavior: { onclick: script } }`.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust write `onclick` in the
  shared list cases `actions-toolbar` and `action-script-object` and the detail case `actions`.
- `tests/widget-script-runs.test.mjs` clicks a list script action twice in Chromium, Firefox and
  WebKit for the HTML, React, Vue and Svelte renderers, rendered in the browser and rendered on
  the server and hydrated, and requires one run of its script per click.

### 2026-10-02 — Hook failures are printed with their file

- The test runner prints every failure of a `node --test` or Vitest run with its test file and
  elapsed time, including a hook that fails or runs out of time. `node --test` reports a timed-out
  after hook of a file only as a failure without a test completion, so the reporter printed every
  test as passed and a passing summary while the tool exited with 1.
- Under `node --test` the failed hook of a file is printed as `{file} › hook` with its cause, and
  the file is printed as failed. Under Vitest each suite is a group, so a failed hook of a suite is
  printed on the suite line with its cause, and a hook error is printed with its message, which
  the stack of a timed-out hook does not hold.
- The summary line names the failed groups, for example `2 passed, 0 failed, 0 timed out,
  0 skipped, 3 groups failed`.
- `tests/build/run-tests.test.mjs`, run by `npm run test:runtimes`, runs a timed-out after hook of
  a file under `node --test` and of a file and a suite under Vitest.

### 2026-10-02 — Linear-time checks read no clock

- The linear-time checks of the validators and of the PHP extension engine read no clock. They
  compared elapsed times with a limit or with each other, so they failed under a machine load
  average of 28 to 38 and passed alone, and `make conformance` and `make ci` did not end with
  status 0 in one full run.
- The JavaScript checks count reads: a getter on each row value and each repeated value fails a
  read beyond the reads of the same value among ten values, and a counting `codePointAt` fails a
  second read of a text position. The PHP, Go and Rust checks and the PHP extension engine
  fixtures validate, parse, match or order inputs that a linear implementation ends within seconds
  and a quadratic or exponential one does not end before the test's timeout. A Rust test that
  measured `serde_json::to_value` instead of the rule is removed.
- PHPUnit sets no time limit of its own in the validator and the generator packages, so the test
  runner's timeout of 30 seconds is the only limit of a PHP test.
- `tests/build/validator-test-clocks.test.mjs`, run by `npm run test:runtimes`, fails when a
  validator test or a PHP extension engine fixture reads a clock.
- The form comparison check that 500 request generators are constructed without deployment-size
  work compared their elapsed time with 250 ms and failed with 994 ms under load; it now requires
  them to end within the 10-second limit of its PHP process.
- The PHP extension engine tests have budgets of 120 seconds, and 300 seconds with a sanitizer,
  instead of 30 and 60 seconds: the values fixture took 23.7 seconds at a load average of 45, and
  its sanitized run did not end within 54 seconds at a load average of 107.
- The stylesheet layout checks close their three browsers within a hook limit of 120 seconds;
  the close exceeded the default limit of 30 seconds at a load average of 100 and failed
  `npm run test:forms` after all 61 checks passed.

### 2026-10-02 — Action behavior members are event attributes

- A list or detail action writes each declared `behavior` member as the attribute of that name:
  `behavior.onclick` writes `onclick`. Every renderer prefixed `on` to the member name, so
  `behavior: { onclick: … }` wrote `ononclick`, an attribute that no browser runs.
- The action model holds the event attribute name as each `behavior` key. A script action keeps
  its script under `on{name}`, so a script action writes the same `on{name}` attribute as before,
  and its model key is now `on{name}` instead of `{name}`.
- React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust render the shared
  list and detail case `action-behavior-events`, a link and a button with string and object
  entries.

### 2026-10-02 — Form and list descriptions and detail actions

- The `crudui-form` block writes the translated root `description` as
  `<p class="crudui-form__description">` before the form errors and the body. A form root accepted
  `description`, but no renderer wrote it, so a declared description was not shown. The compiled
  template keeps the declared value as its optional last member `description`, every template
  shape check accepts it, `formDescription(template, options)` returns the translated text, and
  `renderFormView` takes it as its fifth argument. An absent or empty description writes nothing.
- A list declares `description` content. The list model has the translated `description` after
  `empty`, and a non-empty description is the first child of `crudui-list`, a
  `crudui-list__description` paragraph before the actions. The check runs after `empty` and before
  `pagination` and fails with `Invalid description at list: expected a string, a language map or
  null`.
- A detail declares `actions` with the list action rules and models; its messages name `detail`
  where a list message names `list`. The detail model is `{ fields, actions, design }`, and a
  detail with actions writes `crudui-detail__actions` with one `crudui-detail__action` per action
  before the `dl.crudui-detail` element and after the image preload links. A detail without actions
  writes the same markup as before.
- The JSON Schema accepts the list `description` and the detail `actions`, the stylesheet styles
  the new elements, and React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust
  render the shared form, complete form, list and detail cases.

### 2026-10-02 — Choice lists keep their written order

- `items` accepts a choice list, an array of `{ "value": …, "label": … }` objects whose choices
  keep the list order for any values. A value-to-label map lists integer-like values first in
  ascending order, so `{ "1": "Yes", "0": "No" }` showed No before Yes and choices with numeric
  values could not keep a written order. The map and the array of labels keep their meaning; the
  schema contract states which form to use for which order.
- An `items` array is a choice list when one of its elements is an object with a `value` member.
  Every element then has only `value` and `label`, every value is a string or a finite number, and
  no two values have the same canonical text. Binding a field whose choice list breaks a rule fails
  with `INVALID_FORM_INPUT` and `Invalid items at {path}: expected value and label pairs with
  distinct string or number values`; the `choice-label` format fails with the same text for
  `format.items`, and `in` fails with `INVALID_RULE_PARAMETER` and `Invalid in parameter: expected
  value and label pairs with distinct string or number values`.
- Select, choice, multichoice and search fields list the pairs in list order, a dummy field and
  the `choice-label` format display the label of the value, and `in` takes the values as members,
  so a field declares the same choice list as `items` and `in`. The JSON Schema defines
  `ChoiceList`, and `crudui explain` lists the pairs in list order.
- The HTML renderer, React, Vue, Svelte, PHP, the PHP extension, Go and Rust render the shared
  choice list cases, and JavaScript, PHP, the PHP extension, Go and Rust validate them.

### 2026-10-02 — Form connection compares sanitized defaults

- `connectForm` compares a text control with its rendered default after the browser sanitizes
  that default as it sanitizes a value. Chromium reads a datetime default `2026-09-09T00:00:00`
  as `2026-09-09T00:00`, so the connection read every such control as an edit and replaced
  the instance value with the browser's form of it.
- The browser timezone case of the widget script checks covers it in Chromium.

### 2026-10-02 — renderForm writes the complete form

- `renderForm(form, options)` writes the complete form that a server sends, so the server
  writes no part of a form. `options.action` adds a `form` element with `action`, `encType` and
  `method` taken from the option or the template's `action`; `options.hidden` adds hidden inputs
  inside it, outside the `crudui-form` element that `connectForm` synchronizes;
  `options.formErrors` adds a `crudui-form__errors` element before the body; `options.errors`
  places each message in a `crudui-node__errors` slot after the body of the node with that data
  path, and validation result errors are accepted unchanged. Options outside the contract fail
  with `INVALID_FORM_INPUT`. Without options the output is the `crudui-form` block as before.
- JavaScript (`@crudui/generator-html`, React, Vue and Svelte with an `options` prop on `Form`),
  PHP (`Generator::renderForm($form, $options)`), the PHP extension, Go
  (`RenderForm(form, options)`) and Rust (`render_form(&form, options)`) write the same markup.
  Go and Rust callers pass `nil` or `None` for the `crudui-form` block alone.
- The stylesheet colors errors with the new `--crudui-error` property.
- The shared complete form cases are compared byte for byte in React, the HTML renderer, PHP,
  the PHP extension, Go and Rust, and after normalization in Vue and Svelte.

### 2026-10-02 — A single-choice field rejects a list

- A field of type `select`, `dropdown`, `selectbox`, `choice` or `radio` without `lang` holds one
  value. Validation fails with `INVALID_FORM_INPUT` and `Choice data must be a single value:
  {path}` when its data, or a row of a repeated one, is an array or an object, hidden fields
  included. Validation previously accepted a list such as `["q", "r"]` and checked `in` for each
  element, so a submitted list passed as a single choice.
- JavaScript, PHP, the PHP extension, Go and Rust run the shared list, empty list, object,
  hidden, repeated row, group row, declaration order and accepted value cases.

### 2026-10-02 — An empty membership list allows no value

- An `in` rule with an empty list or an empty map is valid and matches no value, so a field
  whose choice list is empty passes an empty value and fails every other value. The rule
  previously failed the load with `INVALID_RULE_PARAMETER`, so such a field could not be
  checked. A blank string and an empty member remain parameter errors.
- The JSON Schema accepts an empty `in` list and map.
- JavaScript, PHP, the PHP extension, Go and Rust run the shared empty list, empty map and
  required cases.

### 2026-10-01 — Form connection keeps values entered before it

- `connectForm` reads every control that differs from its rendered default before it
  synchronizes the controls, so values that a visitor entered into server markup before the
  client connected the form remain in the control and in the form session.
- The HTML renderer form session case enters text into server markup before the connection
  and verifies the controls and the session values.

### 2026-09-26 — React component and server entries have separate exports

- `@crudui/generator-react` exports React components without loading `react-dom/server`.
  `@crudui/generator-react/server` exports `renderForm`, `renderList` and `renderDetail` for
  string rendering. The component entry does not export those functions.
- React package cases and the installed package check verify both entries and their
  CJS and ESM exports.

### 2026-09-26 — Rust validator declares its license

- The Rust validator manifest declares MIT, the license declared by the project, so dependency
  license checks can read the validator's license directly.

### 2026-09-26 — Form validation rejects undeclared submitted fields

- Form validation fails with `INVALID_FORM_INPUT` when root, group or repeated group row data
  contains a member without a declared field. It reports the first unknown member in code point
  order at that object. Condition inputs are declared as fields in the shared cases.
- JavaScript, PHP, the PHP extension, Go and Rust run the same root, group and row cases.

### 2026-09-26 — Rust JSON text validation retains object member values

- Rust JSON text conversion associates each object member name with its own value and keeps
  declaration order at every depth. Reversed associations previously let required and length
  rules pass on the wrong input.
- Rust cases check direct validation and nested object conversion.

### 2026-09-26 — Documentation build excludes generated site files

- The documentation builder and source watcher exclude generated `docs/.site/` files. A generated
  Rust documentation license has Markdown syntax without a page heading and must remain an asset.
- Documentation build and watcher cases check the exclusion.

### 2026-09-26 — JSON specification readers reject repeated member names

- The specification JSON reader rejects repeated decoded object member names before validation,
  including names written with different escape sequences. Repeated names otherwise replace input
  without an error. The CLI and Rust JSON text parser use this rule.
- Parser, CLI and Rust cases cover nested objects, arrays, escaped names and valid documents.

### 2026-09-25 — The stylesheet themes lists and details and exposes its colors and sizes

- `crudui.css` declares the defaults of the `--crudui-*` custom properties in one rule with zero
  specificity, `:where(.crudui-form, .crudui-outline, .crudui-data, .crudui-list, .crudui-detail)`.
  Before, the rule selected only the form, the structure map and the data view, so a list or a
  detail outside a form read undefined properties, and a page could override the properties only
  with a rule that came after the stylesheet.
- New properties: `--crudui-on-accent` (text of the selected choice, before `#ffffff` in the
  rule), `--crudui-action-text` (actions, before `#374151`), `--crudui-action-size`,
  `--crudui-control-border`, `--crudui-control-height`, `--crudui-radius` and the submit button
  properties `--crudui-submit-background`, `--crudui-submit-border` and `--crudui-submit-text`.
  Their defaults keep the rendered sizes and colors. No other rule writes a color
  ([form markup](docs/spec/form-markup.md#styles)).
- `tests/style-properties.test.mjs`, part of `npm run test:forms`, checks the property rule, that
  every property a rule reads is declared and that no other rule writes a color.

### 2026-09-24 — The CI browser preflight names the failed sandbox condition

- `scripts/check-ci-browser.mjs` fails an inadequate `chrome://sandbox` evaluation with
  `Chrome sandbox evaluation is "<value>"; expected "You are adequately sandboxed."` and an
  inadequate row with `Chrome sandbox row "<row>" is "<value>"; expected ...`. Before, the
  preflight used the assertion message generated by Node.js, which inserts color codes between
  the characters of the compared text, so the error did not contain the required status and
  `tests/build/ci-browser.test.mjs` failed.
- `tests/build/ci-browser.test.mjs` checks the error for each required sandbox row.

### 2026-09-24 — Lists and details reject invalid declarations at render

- `buildList`, `buildDetail`, `renderList` and `renderDetail` in JavaScript, the HTML renderer,
  PHP, the PHP extension, Go and Rust check the list and detail declaration shape
  ([display format declarations](docs/spec/display-formats.md#declarations)). A list without
  `columns` fails with `List specification must declare columns`; `columns` or `fields` that are
  not an object, an unknown root, column, field, sort or action key, a root `$ref` or `$patch`, and
  a wrong value type of `field`, `label`, `format` and its typed settings, `sortable`, `search`,
  `sort`, an action or `empty` fail with `INVALID_FORM_INPUT`. Before, such a specification, for
  example `{ "columns": 5 }`, rendered an empty list.
- The renderers compose a list `search` with `$ref` or `$patch` and scan the composed
  specification for forbidden keys as `validateList` and `validateDetail` do, so a forbidden key
  fails with `FORBIDDEN_META_KEY` at its path.
- A `null` format fails; absent, `true` and `false` select `text`.
- An action object with `script` renders as a script action with its translated label.
- `renderList` in JavaScript checks the `layout` option before composition and the declarations,
  as every other runtime does. The internal entry of `@crudui/generator-core` exports
  `buildListLayout` in place of `listLayout`.
- The shared list and detail render fixtures define the declaration error cases, and every
  runtime runs them through the native generator suite. The list and detail validity cases are
  also built by `buildList` and `buildDetail`.

### 2026-09-22 — Choice inputs pass pointer activation to their labels

- Visually hidden radio and checkbox inputs now retain a native hit target with transparent
  rendering, so both direct input activation and their associated visible labels work without
  changing keyboard focus or native form semantics. Browser automation and mouse users can
  therefore activate every choice through the same accessible controls.

### 2026-09-19 — Hardened responses, one selection source, reported Vue errors

- Every response of the public server now carries `X-Content-Type-Options: nosniff`, every JSON
  body escapes `<`, `>` and `&` as Unicode escapes, and a 405 answers with an `Allow` header
  naming the methods the target accepts (`GET` on a page, `GET, HEAD` on a file). A hostile
  request value reflected in an error can therefore not close a script or comment element under
  any content-type interpretation. `src/server-responses.test.mjs` starts the public server and
  checks the headers, the `Allow` answers and the escaped reflection.
- The page selection defaults were defined twice, in `src/record-view.mjs` and in `server.mjs`,
  and nothing bound the copies together. `server.mjs` now takes every default from
  `src/record-view.mjs`, so the server and the page cannot drift.
- The document names its whole selection in `<html data-pipeline-selection="…">` and the page
  script fails before rendering when any member differs from the URL selection; it checked only
  `initialization` before, so a stale document of another server could hydrate foreign stage
  markup whose form action points at another server.
- A Vue component or render error raised inside the canonical page's Vue application now fails
  the page as a script error like every other view's failure, through `src/vue-errors.mjs`; Vue
  logged it to the console and continued before.

### 2026-09-19 — The record form shows a failed save

- The canonical page's form submitted its fields and handled 200 and 422, but a failed request or
  another answer left the page without a message: the promise rejected with no handler, the page
  stayed as it was, and only the browser console showed anything. The submit handling now lives in
  `examples/form-comparison/src/save-form.mjs` with its own jsdom tests: a failed request, a
  non-JSON answer or an answer outside 200 and 422 shows `<div id="save-errors" role="alert">`
  before the form with the page language's save-failed text and the failure, keeps the entered
  values, and leaves the form submittable again. `docs/operations/form-comparison.md` states the
  behavior.

### 2026-09-19 — One source for the interface text

- The interface text was copied by hand into the TypeScript, Go, Rust, PHP and PHP extension
  generators, and nothing checked that the copies agreed: the Korean undo label was 실행취소 in
  TypeScript and 되돌리기 in the four others, and only TypeScript had the redo label.
  `contracts/interface-messages.json` is now the only place the text is written. Each runtime
  embeds a source its own script generates from it, and a test fails when the embedded text
  differs from the file. The extension's generated table sets every field by name and the
  generator fails when the contract's keys differ from the C struct's fields.
- List pagination buttons were named "Previous page", "Next page" and "Page N" in English in
  every language, and each renderer chose ‹ and › by comparing those names, so the names could not
  be translated without breaking the buttons. The resolved pagination model now lists its buttons
  with a role (`previous`, `page`, `next`), page, label, current and disabled; renderers choose
  the text by role, and the labels come from the contract's `list` table in the display language,
  or English for a language the table lacks.
- A list with no rows and no declared `empty` showed an empty box. It now shows the `list` table's
  `emptyList` text in the display language; a declared text, even an empty one, is used as
  declared.
- `make deploy` checked the deployed health right after a commit had changed the servers, while
  the supervisor inside the container was still rebuilding them, and failed with 503; and the
  verification accepted a build that was ready for the previous checkout and failed only at its
  end. Both now wait inside the container until the supervisor has built this checkout's source
  identity, under the build steps' own limits and the inactivity limit.
- A `node --test` or Vitest run that printed a passing summary and then ended on a signal or a
  nonzero exit code failed the step without a line saying why. `run-tests.mjs` now prints a
  failure line naming the signal or exit code.

### 2026-09-19 — Compare unique values as JSON values, bound caches and Rust value limits

- `unique` compared values differently across runtimes: TypeScript and PHP took the text `"[1]"`
  for the list `[1]`, TypeScript and the extension let object member order count, PHP let `1`
  and `1.0` differ and wrote floats with fourteen digits, so `0.1 + 0.2` equalled `0.3`.
  `unique` now compares values as `equalTo` does, by the JSON value they denote: strings by code
  points, numbers by exact value, no value equal to one of another type, lists in order and
  object members in any order at every depth. Fifteen shared cases state it, and every runtime
  passes them.
- A field declaring `unique` inside a repeated group compared each row with every earlier row and
  evaluated the filter condition for each pair. Every runtime now walks the rows once per
  validation, evaluating the filter once per row; tests compare n and 4n rows. The Rust test
  also found that reading a value by path copied the whole row collection for every row; path
  reads now borrow the value.
- The parsed-expression caches of the Go and PHP validators had no bound, so a long-running PHP-FPM
  worker grew with every distinct expression. Both keep at most 1,000 expressions and evict the
  least recently used, as the TypeScript validator does.
- The Rust validator did not apply the value limits, and its JSON text reader stopped at 127
  levels. It applies 1,000,000 nodes and 512 levels like the other runtimes, converts deep text
  without recursion, and runs every value-limit case it can build from owned values.
- The public server's forwarder stopped reading an upload once a server had answered it early, as
  nginx answers an oversized body with 413, and passed on the server's `Connection: close`; the
  client's connection then closed while it was still sending, and a few requests in a hundred
  failed with EPIPE instead of reading the 413. The forwarder now reads and discards the rest of
  the body and keeps hop-by-hop headers to the server's connection; a test forwards forty
  oversized uploads to a server that answers early as nginx does.

### 2026-09-18 — Bound loops and costs that inputs control

- The PHP record servers ran on PHP's built-in server, which reads a whole request body before
  it runs the script, so they took any body a client declared while the other servers stop at
  2 MiB. They now run on PHP-FPM behind nginx, the way PHP runs in production
  (`examples/form-comparison/servers/php/main.mjs`): nginx ends a body above 2 MiB with the
  contract's JSON 413 before PHP reads it and passes `/api/` requests to `api.php` over FastCGI.
  The container image installs `php8.4-fpm` and `nginx`, CI adds nginx to the record-store job
  (setup-php provides `php-fpm`), and the filter for the built-in server's access lines is removed. PHP-FPM logs to a file in
  its run directory and copies every message to standard error (`-O`), because a container's
  standard error is a pipe that `/dev/stderr` cannot reopen.
- nginx answered an oversized body from its headers and closed the connection while the client
  was still sending, and the public server's forwarder then cut the 413 it had already received
  (one request in thirty failed with EPIPE). nginx now reads and discards the rest of such a body
  within ten seconds (`lingering_close always`), the forwarder keeps an answer a server has given
  whatever happens to the rest of the upload, and the benchmark routes' 413 names the JSON
  processor as every other benchmark response of a PHP server does.
- A cycle that failed before its restarts left servers that never started, and the next cycle
  restarted only what its sources changed, so those servers stayed down. Every cycle now also
  starts each supervised process that is not running.
- The toolchain image pinned a Chromium release Debian no longer serves, so the image could not be
  built; it pins the current `153.0.8010.47-2~deb13u1`.
- A caller value that shares a container, such as a PHP list built as `$v = [$v, $v]` forty
  times or a JavaScript or Go list holding the same list twice, made the input text walk and the
  PHP value copies take time that doubled with every level, and a PHP array holding two
  references to itself never finished in the extension. The walk only skipped a container
  already on its path and stopped at 512 levels. Every runtime that takes such values, the
  JavaScript, PHP, PHP extension and Go libraries, now walks a value as the tree it denotes and
  stops at the value limits: 1,000,000 nodes and 512 levels of arrays and objects. A value beyond
  them, including every value that contains itself, fails with `INVALID_FORM_INPUT` and
  `Recursive or excessively nested value: {name}`, in the order of the input text checks.
  JavaScript and Go had accepted a value that contains itself.
- The PHP value copies and the extension's value conversion apply the same limits to every value
  they convert, so members that no check walks are bounded too.
- The shared cases `tests/fixtures/text-validity/value-graphs.json` build shared and
  self-containing values in each of those runtimes; each case, copy and shape is one test within the
  runner's per-test limit, which a walk over the 2^40 nodes of a shared list never meets.
- The benchmark drivers took their iteration counts unchecked: `--iters 1e20` looped without end in
  PHP, and `0`, `-1`, `1.5` or `abc` ran a meaningless or failing loop. `tools/bench/run.js` and the
  JavaScript, PHP, Go and Rust drivers now accept one to eight decimal digits, `--iters` from 1 and
  `--warmup` from 0 up to 10000000, and reject anything else before loading a validator, with one
  message and exit status 2. The shared cases in `tools/bench/iteration-arguments.json`
  run against every driver (`npm run test:bench`, in the native generation job of CI).
- The JavaScript driver loaded the `Validator` class from the public entry, which no longer
  exports it, and failed on every run; it loads it from the internal entry.
- `run.js` stopped only the process it started at its limit, so the `go run` and cargo programs
  under it kept running. Every driver, `npm run manifest:test`'s declared commands, the build of
  `scripts/require-current-build.mjs` and each tool of `scripts/gen-api-docs.mjs` now run in their
  own process group with a limit (`scripts/bounded-command.mjs`); at the limit the whole group
  stops, a process that ignores SIGTERM included, and each command prints its elapsed time.
  `CRUDUI_COMMAND_LIMIT_SECONDS` replaces the limit.
- The benchmark's Rust crate stripped its release build and printed the toolchain's strip warning;
  it keeps its artifacts unstripped like every crate with a release profile, which
  `tests/build/rust-release-profile.test.mjs` now requires.
- An expression's syntax tree is at most 64 levels deep in every runtime; a deeper one is a
  parse error with one message. Deep parentheses had exhausted the TypeScript parser's stack and
  aborted the Rust process, and every other runtime accepted any depth. Shared expression cases
  check each construct at the limit, one level over it and 10,000 levels deep.
- The PHP extension freed a list item twice when an `in [` list was not closed, which aborted the
  process; the unclosed list is a shared rejected expression case.
- Reading JSON text in Rust and inserting object members in the PHP extension found a repeated
  member name by comparing it with every earlier one, so 80,000 members took about six seconds.
  Both find it through a hash index, and the extension orders array index names by sorting.
- The `unique` rule in the PHP extension ran its filter condition for every pair of rows and
  compared every pair; the PHP validator searched a list for every value. Both now take time
  proportional to the rows. Timing tests compare four times the input against the base size.
- The tree verification's build wait counted the supervisor's heartbeat as build progress, so a
  hung build step whose heartbeat kept renewing held it forever. Progress is now the step (cycle,
  target and step, with the limit the step holds): one step holds the wait at most its own limit
  plus the inactivity limit, and the heartbeat only shows that the supervisor is alive.
- Every wait of the supervisor holds a limit: a child's readiness, each health request, and each
  stop, which sends `SIGKILL` to the whole process tree after the termination grace, so a server
  that ignores `SIGTERM` can no longer hold a restart, a reload or the shutdown.
- The JavaScript record server kept reading a body over 2 MiB until the end or its request
  timeout. It now answers 413 as soon as the body passes the limit, reads no further and closes
  the connection, as the Go and Rust servers do; a shared contract case sends an oversized body
  that never ends.
- The tests that removed rows until none were left now run at most the starting count of passes
  and require each pass to remove one row.

### 2026-09-18 — Accept the form data the library produces

- Form data leaves out a field that holds no value, such as an untouched field of a new row, and
  the servers answered 400 to such a JSON submission, so the benchmark's JSON save of a new row
  failed. Every server now completes absent members as empty values in JSON and native
  submissions alike and requires only `id`; a store file is still never completed.
- The contract saves the data the library itself produces: `getData()` after the row operations
  for JSON, and what a browser submits from the rendered form for the native form. Hand-written
  submissions had hidden the mismatch.
- Every server takes the benchmark request through the same rule as the record save: exactly
  `form` in JSON, exactly `form[...]` and the completion field in a native form. The Rust server
  had accepted other members in both, the Go server in both and the PHP servers in JSON.

### 2026-09-18 — Show the repeated companies form in the canonical record

- The canonical page's form had become seven flat fields when list, detail and form were joined
  into one customer record, and the repeated form was left only on the benchmark screen. The
  customer record now carries `companies`: companies, their stores and their departments with
  row copy, sorting and limits, sticky row headers, notes shown only while a store is enabled,
  titles in Korean and English, and required names. The benchmark form takes this group from the
  same specification file, so it is declared once.
- The 45 seeded records differ in their numbers of companies, stores and departments, and some
  stores are disabled while their notes keep their text.
- Every server stores and returns the rows with their keys and order, completes a native
  submission's unchecked checkbox and empty collections, rejects a malformed row with 400 and an
  invalid one with 422, and keeps a hidden store's notes. The contract adds nested save,
  validation and shape cases, and the canonical flow unchecks a store, adds a department and
  checks what the server stored.
- Every server checks its store file by the same rule: records with exactly the fixture's members
  in order, a numeric `score`, text scalars and `companies` in the form's shape, checked by the
  server's one companies shape function. A malformed or unreadable file answers 500 on list,
  record, view and save and is kept byte for byte; reset replaces any store file with the fixture.

### 2026-09-17 — Link the canonical page from list to saved list on every server and client

- The public root is one canonical page: list → detail → form → save → refreshed list, for the
  `js`, `php`, `php-ext`, `go` and `rust` servers, the `html`, `react`, `vue` and `svelte` clients,
  CSR and SSR, and `bindForm` and `createForm`. The iframe stage, the `/api/pipeline/*` routes and
  the constant records they served are removed. Every link carries the whole selection; under SSR
  the stage comes from the selected server and the client takes it over, under CSR the client
  renders it with its own components ([canonical page](docs/operations/form-comparison.md#canonical-page)).
- Every server owns a persistent store `records-{server}.json` seeded from one fixture of 45
  customer records, and implements one HTTP contract (`/api/records`, `/api/records/{id}`,
  `/api/records/reset`, `/api/records/view/{view}`) with the same status codes, messages and
  member order. Saves accept exactly the rendered form's fields or exactly the JSON member `form`,
  validate with the server's own validator and never change the store on failure; writes are
  serialized and replace the file atomically; an unreadable store answers 500 and is kept. Path
  segments are compared as written, and view queries are read in their fixed member order.
- `record-stores.test.mjs` runs the 16 contract cases against all five servers built from the
  checkout, and `pipeline.browser.mjs` runs the 40 flow combinations in a browser against a local
  stack; `npm run test:form-comparison:pipeline` and the CI job `form-comparison-pipeline` run both.
- Checks made of units have no total limit any more: a step stops when it prints no progress line
  for 45 seconds, and every unit limit is three times its slowest measurement. The build readiness
  wait reads the supervisor's build state file, which reports progress while a cycle builds,
  instead of one request to the public server with a 600-second limit; `/api/source` is removed.
- `scripts/run-tests.mjs` printed `✔` with no tests when a tool failed before running any, such
  as a Rust compile error; the summary now fails and names the tool's exit code.
- The Vue adapter replaced a control's element whenever its markup changed, so a number input
  lost its caret and typing `9104` stored `4019`; the React and Svelte adapters replaced some
  controls and the button group the same way. Each adapter now writes the markup once and patches
  later markup in place with `patchContent`, keeping every element node; server output is
  unchanged. The shared form-session fixture `typing.mjs` checks node identity, focus, caret and
  typed order in all four adapters.
- React, Vue and Svelte replaced list and detail `html` content on every render; they now patch it
  in place as the forms do, and the shared view fixture `rerender.mjs` checks node identity. No
  adapter ran a widget script on a client render or for a new row, because browsers never run
  scripts inserted as markup or cloned. `patchContent` now inserts a fresh script element once the
  new markup is in place, so every script runs exactly once when its markup first appears and never
  again; `tests/widget-script-runs.test.mjs` checks this in Chromium, Firefox and WebKit for all
  four adapters, client and server rendering. React's server output stays the byte reference:
  `byte-reference.test.ts` requires it to equal the HTML renderer's output for every shared case.
- Number controls (`number`, `integer`, `float`, `decimal`) now carry `step="any"` in every
  runtime. Without it the browser counted the default step from the rendered value, so after a
  stored `2886.5` a typed `9102` was a step mismatch and the form would not submit; the `step` rule
  of the CRUDUI validator decides increments. The shared form case `number-any-step` checks it, and
  the canonical page submits with the browser's constraint validation on.
- The comparison build's `composer` target ran only `composer install`, which keeps the
  validator's path-repository copy while the lock is unchanged, so a deployment served an old
  validator copy and the PHP server failed its startup check. The target now reinstalls the copy.
- Two browser checks of the deployed verification had not followed the code: the interaction
  check looked for row actions directly under the row, although the row header sits in a header
  container, and the benchmark frame still expected a field hidden by its specification to keep its
  rules. Both follow the current markup and rule; `check-interaction.test.mjs` now finds the row
  actions in rendered markup.
- The initialization report's `mounted` stage did not reset the repository and load the column's
  frame document again, as the specification says, so the server-rendered column showed whatever an
  earlier check had stored. Each column now resets the record and loads its frame again.
- A change to a supervisor module stopped the comparison container: the supervisor started its
  successor and exited, and as the init process's only child its exit ended the container. It now
  replaces its own process image and keeps its process id.
- The PHP extension wrote list numbers such as `30` as `3e+1`, and the PHP extension and the Go
  generator grouped `1e+21` as `1e,+21`. Both now write numbers as JavaScript does; the shared list
  case `format-number-shortest` checks every runtime.

### 2026-09-17 — Remove the Linux style-check image a run pulled

`make test-form-styles-linux` needs the Playwright image of the pinned version, about 10 GB. A run
that pulled the image now removes it when it ends, successful or not, and leaves an image that was
already present; the testing procedure describes the command.

### 2026-09-17 — Lint every JavaScript, TypeScript and Svelte source

- `npm run lint` ran `eslint packages` and its configuration skipped every `.js` and `.mjs` file,
  every test and every Svelte component, so examples, tests, scripts, tools and the root
  configuration were never linted, in CI or in `make ci`. It now runs `eslint .`, and
  `eslint.config.mjs` applies the package rule set to every JavaScript, TypeScript, Vue and Svelte
  source, ignoring only generated or installed output. Per-file settings state where code runs
  (browser, Node with browser callbacks, CommonJS scripts, Svelte components); `eslint-plugin-svelte`
  and `globals` are added as development dependencies ([lint](docs/operations/testing.md#lint)).
- `tests/build/lint-coverage.test.mjs`, run by `npm run test:build`, fails when a tracked source is
  outside the lint command's paths or not linted by the configuration.
- The problems the wider lint found are fixed: unused imports, variables and parameters; errors
  rethrown without their `cause`; needless regular expression escapes and repeated spaces; array
  holes in the PHP extension's C helper list and the native generator check budgets; number
  literals that did not keep their written value (`9007199254740993` and `9.999999999999999` are
  written as the values they already had); `any` in tests; `console.log` in scripts that print
  through standard output; a Svelte `{#each}` without a key and an effect that read its dependency
  as a bare expression. The unused root script `capture-react.js` is removed.
- The Svelte generator's `{@html}` output and the heading slug's control character class are
  exempt from their rules only on those lines, with the reason written beside each.

### 2026-09-17 — Reject rule names that are not registered rules

- A `validate` key that is not a registered rule was skipped, so a misspelled rule silently turned
  its check off, and the schema kept other rule names open for rules no runtime can register any
  more. Such a name is now the load failure `UNKNOWN_RULE` with the message `Unknown rule: {name}`
  at the field's declaration path, whatever its parameter, in every validator and the PHP
  extension. A `messages` key names the rule whose message it overrides, so a `messages` key that
  is not a registered rule fails the same way; it may still name a registered rule the field does
  not declare. Names are checked with the parameters: fields in declaration order, a field's rules
  (each name before its parameter) and then its `messages` keys, before the fields it contains
  ([parameter errors](docs/spec/validation-rules.md#parameter-errors)).
- The schema's `validate` and `messages` accept the registered rule names only, and
  `scripts/check-schema.mjs` checks both lists against the rule registry. The PHP `FieldSpec`, Go
  `FieldSpec` and Rust `FieldSpec` models close `validate` and `messages` the same way and gain the
  `content` and `messages` keys they lacked; each checks its keys against the schema.
- `match` and `pattern` used the other name's custom message in JavaScript, Go and Rust when their
  own was missing. Every runtime now reads a custom message under the declared rule name only, as
  PHP and the PHP extension already did.
- The shared case `unregistered-rule-skipped` is replaced by twelve cases written from the
  specification, including nested row paths, hidden fields, check order and `messages`, and one
  case for the `match` and `pattern` messages; the shared validation cases grow to 250.

### 2026-09-17 — Compare generated field models with member order in the comparison example

- The generation check of `examples/form-comparison` compared object member order only in
  attributes, extra settings and record data, so the deployed comparison could accept field models
  whose member order differed between runtimes. It now uses the order-strict `equalModels` and
  `equalOrdered` of `tests/native-generators/protocol.mjs` instead of its own copies, so every
  runtime's models must have the same member order at every depth.
- `check-generation.test.mjs` shows that rendered forms whose models, widgets or data differ only
  in member order are rejected.

### 2026-09-17 — Reject text that is not Unicode scalar values in every runtime

- Text in specifications and data is a sequence of Unicode scalar values
  ([input text](docs/spec/input-text.md)). An unpaired surrogate in a JavaScript string, bytes
  that are not UTF-8 in a PHP, Go or C string, and an unpaired surrogate escape in JSON text are
  rejected before any other check of `validate`, `validateList`, `validateDetail`,
  `compileForm`, `bindForm`, `bindButtons`, `createForm`, the form instance methods,
  `buildList`, `buildDetail` and their render operations. Go no longer replaces them with U+FFFD,
  and PHP and Rust no longer fail at JSON decoding with a different error.
- A specification or composition file failure is the load failure `INVALID_TEXT` located at the
  path of the text; any other argument or option fails with `INVALID_FORM_INPUT` and the message
  `Text must be Unicode scalar values: {name}`. Member names count as text, and members are
  checked in code point order of their names.
- Go's `compose.DecodeOrdered`, `generator.DecodeJSON` and `ValidateJSON` keep the text for the
  check, PHP adds `CRUDUI\Validator\Support\JsonText`, Rust adds `crudui_validator::text` and
  `crudui_generator::text`, and the PHP extension checks PHP values before converting them.
- The new family `tests/fixtures/text-validity` holds one case file per operation. The validators,
  the PHP extension, the cross-check console's five processes and the native generator programs
  run it and record conformance evidence; the programs reject standard input that is not UTF-8.

### 2026-09-17 — Read appearance strings that are not complete expressions as literal text

- `design.class`, `design.style` and the other appearance settings follow the rule `design.show`
  already follows: a string is an expression only when it parses completely under the expression
  grammar, and any other string is literal text. A class such as `modal fade in show` or a style
  such as `font-family: Made in Script` was evaluated as a failing expression and dropped; it is now
  rendered as written in the JavaScript, PHP, Go and Rust generators and the PHP extension.
- Two written form cases cover the literal class and style strings; the shared form cases grow to
  103.

### 2026-09-17 — Hidden fields, data-only rows and one numeric reading in every runtime

- A field whose `design.show` resolves to `false` against the data is hidden: validation skips its
  rules and every rule inside it, reports no error for it, and keeps its value, so a setting switched
  off keeps its values and is validated again when it is switched back on. Only a resolved `false`
  hides; a condition map that selects nothing and a string that is not a complete expression are
  visible. The data shape is still checked for hidden fields. Forms decide visibility with the same
  rule and keep hidden values in the instance and in `getData()`.
- A list column's `sortable` may be a condition map, as the generators already read it; a map that
  selects nothing is not sortable.
- `multiple: only` (the same as `multiple.only: true`) declares rows that exist only in the data: the
  data's keys are the rows, missing data has no row, the form renders no row controls and no add-row
  control, and every row operation fails with `Rows of {path} come only from data`. It combines with
  `title` and `header`; compilation reports the other keys and wrong values with the messages in
  [schema](docs/spec/schema.md).
- Missing data of a repeated field or group is an empty collection, so `required` and the count
  rules apply to it.
- Numbers are read one way: numeric text is the HTML valid floating-point number (no `+`, no
  trailing dot, exponents allowed) with a finite value. `min`, `max`, `range` and `step` fail values
  that are not numeric; `step` decides multiples exactly on the decimal texts, counted from 0;
  `digits` reads the canonical text; counts give arrays their length, objects their key count,
  missing, null and blank values 0 and other scalars 1; `in` compares numeric members with the same
  reading and reads list members as written. Numeric and count parameters are checked like length
  limits (`INVALID_RULE_PARAMETER`). Messages print parameters as canonical text and replace every
  placeholder of a parameter the rule has.
- Removed: the per-runtime number parsers (`is_numeric`, `strconv.ParseFloat`, `str::parse`,
  `strtod`, `parseFloat` fallbacks), the step tolerance and rounding, and the C engine's
  locale-dependent number reading and writing, which is replaced by exact conversions tested under a
  comma-decimal locale. The PHP packages' tests fail on any warning, notice or deprecation.
- The shared validation cases grow to 238, with new form, list, structure-map and session cases, and
  `examples/product-forms` shows an option-combination form and a large product form in the current
  grammar, validated and rendered by a test.

### 2026-09-17 — Accept only the compiled template shape and order widget members

- `bindForm`, `bindButtons` and form instances in every runtime (JavaScript, PHP library and
  extension, Go, Rust) accept only a template with exactly the shape `compileForm` produces:
  `kind`, `fields`, `buttons`, an optional string `keyPrefix` and an optional object `action`,
  and field templates with exactly `name`, `spec` and `children`. Any other value fails with
  `INVALID_FORM_INPUT` and `Unsupported form template`. Rust reads templates through
  `FormTemplate::from_json`, which its `Deserialize` implementation uses.
- Widget models list their members in one order in every runtime, and a file widget's `extra`
  has `display` before `file`. The native generator comparison checks member order and 69
  template shape requests; the form runtime and PHP extension specifications say so.

### 2026-09-17 — Scroll a moved focus the same way in every engine

- The CI job "Form instances and data injection" failed in WebKit on Linux: after an Add row
  action the new row's input ended below the sticky footer (709 px against a 644 px limit in a
  700 px page, and the same 65 px in a scrolling box and a frame). Measured in the Playwright
  image, `focus()` in that engine scrolls a far control without keeping to its scroll margins
  (its bottom 9 px past the view, and from below its top 9 px above the view, under the pinned
  headers), while `scrollIntoView({ block: 'nearest' })` keeps to them.
- `connectForm` and `connectOutline` no longer leave scrolling to focus. When they move focus to
  a row, they focus with `preventScroll` and then scroll the control into view only as far as
  needed with `scrollIntoView({ block: 'nearest', inline: 'nearest' })`, so the stylesheet's
  scroll margins keep it clear of the sticky headers and the footer in Chromium, Firefox and
  WebKit on macOS and Linux. The form markup and form runtime specifications say so.
- `make test-form-styles-linux` (`scripts/test-form-styles-linux.sh`) runs the stylesheet layout
  checks on Linux as the CI runner does, in the Playwright image of the pinned version, through
  `container` on macOS or another container CLI; it is not part of `make ci`.

### 2026-09-17 — Check the stylesheet layout in WebKit

- `tests/form-styles.test.mjs` runs its sticky header, level label, seam, row card and focus
  scenarios in WebKit as well as Chromium and Firefox. One engine adapter launches each browser
  (Puppeteer for Chromium and Firefox, Playwright for WebKit) and every engine runs the same
  scenario code. A browser that cannot start fails the run with the reason.
- WebKit on macOS does not focus a button on a pointer press. The focus scenario measures the
  engine's convention with a plain button and requires the restored focus to match it: the toggle
  without visible focus where the press focuses it, nothing focused where it does not. Chromium
  and Firefox are required to focus, and WebKit on macOS not to.
- `playwright` is a root development dependency, and the CI job that runs `npm run test:forms`
  installs WebKit with `npx playwright install --with-deps webkit` and has a 15 minute limit.

### 2026-09-17 — Run the CI workflow locally and fix what its first run found

- `make ci` runs every checking command of `.github/workflows/ci.yml` in order and checks the
  conformance evidence; `tests/build/ci-local.test.mjs` fails when the list differs from the workflow.
- The CI workflow failed three ways: the root package did not declare
  `@crudui/validator`, which the form-comparison example imports; the PHP validator called
  `ctype_digit` and `ctype_xdigit`, which a PHP build without ctype lacks; and the PHP extension's
  engine test initialized static tables with compound literals, which GCC rejects under `-pedantic`.
  The dependency is declared, the PHP pattern parser compares characters directly, and the tables
  use brace initializers. `tests/build/php-extensions.test.mjs` fails when a PHP package uses an
  optional extension (mbstring, ctype, iconv, intl, bcmath, gmp, sodium, dom) without requiring it.

### 2026-09-17 — Declare the repository settings and deploy through make

- `.github/repository.json` declares the GitHub repository settings: homepage, repository features
  and merge methods, the Actions policy and default workflow permissions, vulnerability alerts and
  automated security fixes, the Pages build type and the `github-pages` environment, which deploys
  only from `main`. `make github-settings` applies only what differs and reads the settings again;
  `make github-settings-check` fails when a setting differs. `tests/build/github-repository.test.mjs`
  checks both against an in-memory repository. See [repository settings](docs/operations/repository.md).
- `make deploy` and `make deploy-verify` run the comparison-service deployment and its verification;
  the verification procedure names them.

### 2026-09-17 — Keep command programs out of the published packages

The per-language validator and generator programs were only the process boundary of the
cross-check console and the native generator suite, yet they shipped inside the packages
(`packages/validator-go/cmd/validate`, `packages/validator-php/bin/validate.php`, the Rust
`validate` and `generate` binaries, `packages/generator-go/cmd/generate`,
`packages/generator-php/bin/generate.php`). The packages provide the library functions only.

- The validator programs are in `examples/cross-check-console/validators` and the generator
  programs in `tests/native-generators/programs`, each calling only its package's public API with
  the same request, response and exit status. The console runs every shared validation, list and
  detail case and 45 request cases through all five validator processes; the native suite sends 60
  shared request checks to every generator program.
- Those shared checks found differing boundary behaviour, now one rule: every program answers
  `Request must be valid JSON`, `Request must be an object`, `Options must be an object`,
  `Actions must be an array` and `Unknown generator operation`; a non-object `spec` is
  `A form spec must be a group with properties`, a non-object `template` is
  `Unsupported form template`, and a malformed action is the step error `Invalid form action`.
  `bindButtons` checked the template kind after reading its buttons and threw a `TypeError`; it now
  reports `Unsupported form template`.
- The `validatorCli` feature is removed from the package contract. `tests/build/public-packages.test.mjs`
  fails when a published package declares or contains a command program (`bin` in `package.json`
  or `composer.json`, a PHP file with `#!`, `package main` in a Go module, `[[bin]]`, `src/bin` or
  `src/main.rs` in a Rust crate).
- `make format-check` covers new files that are not yet committed and skips deleted ones.

### 2026-09-17 — Remove the legacy layer

The legacy layer kept an old field model (`rules`, `messages`, `display_switch`/`display_target`)
running beside CRUDUI, but it reproduced no fixed old behaviour: the TypeScript legacy validator ran
on the current rule registry, so its results moved with every current rule change. The layer was a
compatibility and migration path, and its examples were not run by CI. It is removed completely,
with no alias, fallback or replacement entry.

- The legacy validators are gone: `@crudui/validator/legacy` (the `./legacy` export and its build
  entry), `CRUDUI\Validator\Legacy`, the Go `validator/legacy` package and `cmd/validate-legacy`, and
  the Rust `legacy` module and `validate-legacy` binary. Code only they used goes with them: the
  TypeScript `RulesSpec` type, the PHP `Rules\Unique` rule and six unused `PathResolver` methods, the
  Go `LegacyKeyMap`, the PHP `FieldSpec::ABSORBS_LEGACY` table with `canonicalFor()`, and the Rust
  `regex` dependency.
- The legacy translator (`translateFromLegacy`, `roundtripLegacy`) and its corpus scripts
  (`scripts/corpus-legacy-*.mts`) are removed, together with the `translateLegacy` and
  `validateLegacy` features and the `tests/fixtures/legacy-validate` and `tests/fixtures/translate`
  fixtures, and the earlier-model specifications in `tests/fixtures/specs`.
- `examples/legacy` is removed with its Compose file, PHP, Go, Rust and Node API servers,
  applications and shared specifications, and with `npm run docs:check:servers`,
  `make docs-check-servers` and the scripts that checked those servers' documentation.
- The four-language legacy comparison (`tests/runner`) and its CI job are removed. Root `npm test`
  now runs the test script of every workspace package.
- `scripts/check-schema.mjs` no longer checks legacy corpora. It fails when a tracked YAML file is
  not a specification it checks or a CLI test fixture.
- The validator benchmark's `contact` specification was a legacy `rules` declaration, which the
  current validators do not read, so it measured forms without rules. It is now generated as a
  current `validate` declaration, and the 80-field case is named `large`. The Go and Rust benchmark
  drivers handle the error the validator constructors now return.
- `docs/spec/legacy-schema.md` and `docs/spec/legacy-visibility.md` are removed, and the testing,
  schema, fixture, example and feature documents describe only the current layer.

### 2026-09-17 — Package entries declared with their exact exports

`contracts/features.json` listed a few names per package, and the manifest check only looked for
each name somewhere in the package source. generator-core's entry exported 64 values, the React, Vue
and Svelte entries re-exported core functions, and renderers reached core helpers through the
public entry. Each package now declares under `entries` every JavaScript entry of its `package.json`
`exports` with its visibility (`public` or `internal`) and its exact value exports; `exports` is
removed. `npm run manifest:check` reads the value exports with the TypeScript compiler and fails on
an undeclared or missing entry or export, on a signature function outside the owner's public entry,
and on an internal entry imported outside CRUDUI package code;
`tests/build/contract-manifest.test.mjs` proves each failure. The generated feature contract page
lists every entry.

- `@crudui/generator-core` exports the public API: the feature operations, `FormInstance`,
  `createRowKey`, `sequenceRowKey`, `formMessages`, `collapsibleRows`, `canUndo`, `canRedo`,
  `redoChange`, `resolveAction`, `connectStickyHeaders` and the error classes. `listLayout`,
  `paginationPages` and `parseStyle` move to the new `@crudui/generator-core/internal` entry for the
  renderers. The entry no longer exports `resolveDesign`, `evalShow`, `evalAppearance`,
  `makeContext`, `makeTranslate`, `rowPathContains`, `HISTORY_LIMIT`, `FORM_BUTTON_TYPES`,
  `DEFAULT_FORM_BUTTONS`, `LANGUAGES`, `formatCount`, the widget and cell catalogs, `renderCell` or
  `normalizeFormat`.
- `@crudui/generator-react`, `@crudui/generator-vue` and `@crudui/generator-svelte` export only their
  components and render functions. Import `compileForm`, `createForm`, `buildList`, `buildDetail`,
  the row keys and the error classes from `@crudui/generator-core`. They no longer depend on
  `@crudui/validator`.
- The `formHistory`, `viewState` and `runAction` signatures name every function of the feature;
  features that listed the nonexistent `FormError` list `FormInputError`.

### 2026-09-17 — PHP 8.4 and later, tested on every declared line

The PHP packages declared `^8.2`, but CI ran them only on PHP 8.4 and 8.5, and the rendering
conformance test needs PHP 8.4's HTML5 parser. `crudui/validator` and `crudui/generator` now require
`^8.4`, and the validator job runs on PHP 8.4 and 8.5 like the native job.
`tests/build/runtime-version-policy.test.mjs` fails when a Composer manifest declares another range,
when a job that tests a PHP package does not cover every line of the declared range, or when a PHP
container is not on the newest tested line.

### 2026-09-17 — One definition of values and patterns in every validator

The JavaScript, PHP, PHP extension, Go and Rust validators disagreed on whitespace, on what a
length counts, on `in` and on what a pattern means. `docs/spec/validation-rules.md` now defines
them once, and every validator applies that definition:

- Whitespace is exactly the Unicode `White_Space` set; trimming removes nothing else. `required`
  fails on a missing value, `null`, a blank string, an empty array or an empty object, and every
  other rule except `mincount` and `maxcount` passes those values.
- The canonical text of a scalar is the string itself, `1`/`0` for booleans, and the ECMAScript
  text of a number. Length rules count its code points; an array or object fails them. Limits are
  integers from 0 to 9007199254740991, and `rangelength` needs minimum ≤ maximum.
- `in` takes list elements as they are, comma items trimmed, or map keys; it compares canonical
  text or equal decimal values, and an array value passes when every element passes.
- `pattern` and `match` match the whole value in the CRUDUI pattern language (`\d`, `\w`, `\s` are
  ASCII digits, word characters and whitespace; `.` excludes only U+000A; general categories and
  scripts). Delimiters such as `/x/i` are plain text. Every validator recognizes the pattern itself
  and matches it with its own linear-time matcher instead of a regular-expression engine: JavaScript's
  backtracking took 148 seconds for `(?:[^\n]*a){12}c` on 60 characters, Rust's engine needed
  43 MB and 4.4 seconds for `\p{L}{1000}`, PCRE2 and Rust lacked scripts or `\p{Cs}`, and the
  engines disagreed on the letters of 4,644 code points. A pattern has at most size 1000 and 100
  nested groups.
- Unicode data comes from one table, `contracts/unicode-properties.json`, generated from the
  Unicode 16.0.0 files in `contracts/unicode/` by `scripts/generate-unicode-properties.mjs`; every
  validator embeds it and a test fails when the table is stale.
- A parameter outside these definitions fails the load with `INVALID_RULE_PARAMETER` or
  `INVALID_RULE_PATTERN` (with the reason and the code-point offset) at the field's declaration
  path; a limit chosen by a condition is checked when it is chosen.
- The schema describes the same parameter shapes. The shared validation cases grow from 64 to 174
  and run in all five validators.
- Removed: delimiter handling in patterns, partial matches, translation to regular-expression
  engines, language trimming functions and integer casts of length limits.

### 2026-09-17 — Expose form buttons in every runtime

The feature standard declared `bindButtons` and `formButtonsHtml` for every server runtime, but only
JavaScript exposed them. The PHP library and the PHP extension add `Generator::bindButtons` and
`Generator::formButtonsHtml`, Go adds `BindButtons` and `FormButtonsHTML`, and Rust adds
`bind_buttons` and `form_buttons_html`; each generator command-line adapter serves both operations.
They return the same ordered button objects and the same markup as JavaScript, and they check the
same input: `formButtonsHtml` accepts only a list of evaluated buttons (`tag` `a` or `button`,
string `text`, and `attrs` with string values of `type`, `class`, `style`, `name`, `value`, `href`
or `onclick`) and otherwise fails with `Form buttons must be a list` or
`Form buttons must be evaluated button objects`. The native runner compares both operations for
every form fixture and the rejected shapes in every runtime.

### 2026-09-17 — Enforce the test command standard

- Every test runs through `node scripts/run-tests.mjs <node|vitest|go|cargo|phpunit>`. The runner
  prints each test as it starts, a line every five seconds while it runs, and its result with the
  elapsed time, and it gives every test its own timeout (30 seconds unless a command declares
  another). node and Vitest stop a test at its timeout; for Go, Rust and PHPUnit the runner stops
  the tool when a test outlives it. `scripts/test-progress/progress.mjs` writes the lines; the
  native generator runner, the legacy comparison, the package install check, the contract command
  runner, the build freshness check, the CI browser check and the conformance check print through
  it.
- `tests/build/test-commands.test.mjs` fails when a package, Composer, Makefile, CI or feature
  verification command calls a test tool directly, when a CI job has no `timeout-minutes`, when a
  test command starts a script that does not print through the shared lines, when no command runs
  a `node:test` file, and when a TypeScript package has no `typecheck` or CI does not run
  `npm run typecheck`. Three test files that no command ran now run in `test:form-comparison:source`
  and `test:build`.
- CI jobs have their own time limits. The `current` jobs, which repeated subsets of the unit jobs,
  are removed. Each suite that records conformance evidence uploads it, and a final job checks all
  of it. The form inspector runs as `npm run test:inspector`.
- Removed old paths: the `test:current`, `test:list`, `test:watch`, `test:coverage` and
  `test:client` package scripts, the Composer `test:current` script, `tests/package.json`, the
  unused `tests/runner/run-js.ts`, `run-php.php` and `tests/runner/go`, and the `docs-check-all`
  alias. The PHP extension API comparison is the `node:test` file
  `packages/php-ext/tests/api.test.mjs`; `make build-php-extension` only builds, and
  `make test-php-extension` runs the engine, builder and API tests. The package install check runs
  its commands asynchronously, and its step limits were reduced to about ten times their measured
  durations.
- `npm run typecheck` checks every TypeScript package, including Vue; a React outline test that did
  not pass `canRedo` now does.

### 2026-09-17 — Check conformance evidence against the feature standard

`contracts/features.json` is the one standard: each feature declares its supporting runtimes and
the shared fixtures that prove it, and the manifest registers every fixture. Tests record one
evidence line per fixture case and feature (`tests/conformance/evidence.mjs`, `evidence.php`, the
Go package `validator/internal/conformance` and the Rust test module `tests/common`), and
`scripts/check-conformance.mjs` fails on a missing or failing case of a supported runtime, on
evidence for an undeclared or unsupported runtime, on an unregistered fixture family and on a
registered fixture no feature proves. `make conformance` runs every recording suite and the check.
[Conformance evidence](docs/operations/conformance.md) describes the runtime keys and the rules; it
replaces the substring checks of `contracts/conformance-matrix.json` and
`tests/build/conformance-coverage.test.mjs`, which are removed.

The standard now declares `buildList`, `validateList`, `validatorCli` and `translateLegacy`, adds the
spec-validity fixture to `validate`, proves `createForm` with the native instance scenarios, and
declares the DOM session features for the bindings that run them. Measuring against it found and
closed these gaps:

- The native runner compares the form HTML of all 92 form fixtures byte for byte and the list model
  of every list fixture in every server runtime.
- The PHP extension runs the validator CLI fixture.
- The HTML DOM binding runs the shared session scenarios; it had never run them.
- The native runner's protocol accepted a list model only with a `sort` member, although a list
  without a sort declaration has none.
- The feature verification command of `createForm` ran a fixture module with no tests.

### 2026-09-17 — Keep rendered nodes in the HTML renderer and show sticky labels everywhere

- `patchContent(element, html)` from `@crudui/generator-core` replaces an element's content with new
  markup and keeps every node the markup still contains (matched by row key, field path, id, or a
  control name and value). Each HTML renderer re-render is patched into the page with it, so
  the focused control, its selection and an input method composition survive, as they do in the
  framework renderers; the HTML DOM binding now passes the shared initialization scenario that
  requires the same control element after repeated data injection.
- The level label in a sticky row header is hidden by default and shown inside
  `@container scroll-state(stuck: top)`. The previous rule hid it inside
  `scroll-state(not (stuck: top))`, which Firefox and Safari ignore, so those browsers showed the
  label at all times. There, `connectStickyHeaders(element)` (used by `connectForm`) sets
  `data-crudui-stuck` while sticky positioning moves a header from the top of its row, and marks a
  header again when a render drops the attribute; Chromium, which supports the query, connects
  nothing. The Chromium checks run with and without scroll-state support in a page, a scrolling box
  and a frame, and assert that Chromium never receives the attribute.

### 2026-09-17 — Render the same pagination in every server runtime

The PHP library, the PHP extension, Go and Rust rendered pagination differently from JavaScript:
the PHP library wrote `disabled="1"` and did not clamp the page to the last page, and all four
listed pages 1 to 7 instead of the bounded window. Every runtime now follows one rule: every page
up to seven pages, otherwise the first, previous, current, next and last page; without a total the
current page is 1; a page after the last page selects the last page. The list model has the same
members in the same order everywhere (`enabled`, then `perPage`, `mode` and `page` with their
defaults, the supplied `total`, and `pageCount`). A `pagination` declaration is checked like
`design`: a boolean or an object with `per_page` (an integer from 1) and `mode` (`pages`,
`offset`, `cursor` or `none`); the schema's `per_page` is an integer of at least 1. The list
fixture grew from 42 to 57 cases with the boundary pages and the declaration errors, and the
native runner compares the pagination model of enabled, declared and disabled paging.

### 2026-09-17 — Repair the failing CI jobs

The last three pushes failed CI. The Svelte header and node components had whitespace between
sibling blocks, which Svelte kept as text; they are written without it again. The root package
now declares `@crudui/generator-html`, which the form comparison example imports, and the form
comparison source suite builds it. The PHP extension API test expected the old pagination markup.
Rust and Go sources that did not match `rustfmt` and `gofmt` are formatted.

### 2026-09-16 — Add bidirectional form history

- Form instances now expose `redo()` and snapshots report `canRedo`.
- Outline controls now render both undo and redo with direction-specific availability.
- A new data change after undo clears the redo history.

### 2026-09-16 — Render CRUDUI pagination controls in CSR and SSR

- List renderers now emit previous, numbered and next page buttons from the shared pagination model.
- The resolved current page defaults to 1, exposes `aria-current="page"`, and disables boundary controls.
- The pipeline example now uses CRUDUI pagination output for both SSR and CSR; its manual page navigation was removed.
- The pipeline page documents the injected `page` and `total` contract beside the runtime controls.

### 2026-09-16 — Put sticky state on the header container

Sticky nodes now render a `crudui-node__header-container` around their header in
every renderer. The wrapper owns `position: sticky` and `container-type: scroll-state`,
so header descendants can respond to the wrapper's stuck state without changing the
header slot or its own styles.

### 2026-09-16 — A sticky seam is one border wide wherever a row rests

A sticky row has no top border of its own. Its card top edge is drawn inside the header
container, the box that pins, and goes while the container is stuck, when the line of the
container above is the seam; the `scroll-state(stuck: top)` query hides it, and in browsers
without scroll-state queries the `data-crudui-stuck` marking does, as it shows the level label.
The line under a header is the header's own bottom border, inside the container, and the sticky
line is the depth times the header height less one row border (`--crudui-row-border`), so a
pinned container lands on the line of the container above it and a row arriving on the line puts
its own edge there too. The top border used to be on the row, where it scrolled with the row and
stood one border below that line, drawing the seam as two borders at the position where a row
meets it. The layout checks assert the line, the missing row border and the edge in both states,
with the query and with the marking.

### 2026-09-16 — Exercise every validator fixture in the cross-check gateway

The cross-check gateway test now executes all 64 shared form-validation fixtures through
JavaScript, PHP, Go and Rust. Its idempotency signature treats JSON object member order inside
an error value as non-semantic while preserving array order. The previous single-case smoke test
missed the Go keyed-scalar `unique` response-order difference.

The gateway now also executes all 92 form-render fixtures through HTML, React, Svelte and Vue;
the public-instance placeholder case checks parity and its generated row-key contract because
its random identity cannot equal the bindForm fixture's fixed bytes. List and detail fixture
coverage remains complete.

The Rust validator release profile now explicitly disables Cargo's debuginfo strip step. This
prevents the build from depending on a toolchain-local `rust-objcopy`/`libLLVM.dylib` pairing that
could emit a warning after producing a nominally successful binary.

Added an executable conformance matrix. It checks that declared pass targets, shared fixture
counts, gateway test links and native operations remain complete. The matrix check runs in
`test:runtimes`, so a missing test or unsupported execution path fails mechanically.

### 2026-09-16 — Keep framework container markers out of content comparisons

The form comparison now compares each view container's rendered contents while preserving
framework-owned container markers. Vue adapters retain Vue's `data-v-app` marker after CSR mount;
the comparison no longer requires adapters to remove it.

### 2026-09-16 — Isolate and stabilize initialization comparisons

The benchmark resets the CSR repository before its initialization stages and uses the same
deterministic generated-row sequence for the `added` stage in both columns. Vue hydration now
passes the hydration flag to its mount operation, and the comparison preserves Vue's CSR marker
outside the rendered-content contract.

### 2026-09-16 — Publish the benchmark run source identity

The benchmark job result now includes the source identity read from `/source.json`. The server
report can therefore validate the complete tree identity before accepting its child reports.

### 2026-09-16 — Publish initialization source identity under the verifier contract

The dedicated benchmark now stores the frame's complete source identity in the initialization
report's `source` field. It no longer labels that object as `commit`, so report policy can compare
initialization, scenario and server identities consistently.

### 2026-09-16 — Make browser validation input clearing deterministic

The browser verifier now uses the input element's standard selection API before deleting its value.
It no longer depends on Chromium's platform-sensitive multi-click or key-combination behavior.

### 2026-09-16 — Preserve canonical pagination metadata in native adapters

The PHP, Go and Rust pipeline adapters now forward the canonical `page` and `total` options to
their renderers. A page containing five rows therefore still reports the canonical total of 45.

### 2026-09-16 — Preserve benchmark query selection and accept the mounted initialization stage

The benchmark-console redirect now preserves its query string, so each verifier job reaches the
selected server and framework. The frame initialization contract explicitly accepts the `mounted`
stage published by the browser runtime. The full current-tree browser verification remains failed
because its validation and source-identity checks did not pass; no passing result is claimed.

### 2026-09-16 — Make the canonical example use CRUDUI-generated pipeline features

The previous root implementation was incorrect: parent-side stage buttons and hand-written list
and detail markup simulated navigation without exercising CRUDUI list links, detail links, form
submission or persistence. The canonical example now renders list and detail output through the
CRUDUI renderer and uses real HTTP navigation. The old simulation path is removed rather than
retained as a compatibility path.

### 2026-09-16 — Run comparison verification on the benchmark entry

Browser verification now opens `/benchmark-console/`, where the comparison console owns its
readiness and job API. The canonical root remains the page pipeline and is not
required to expose benchmark internals.

### 2026-09-16 — Remove retired public route artifacts during builds

Persistent build volumes now remove the retired `public/displays/` output before copying current
public assets. This prevents an older generated route from remaining accessible after the source
directory is deleted.

### 2026-09-16 — Make the root example a single CRUD pipeline

The public root now presents List → Detail → Form → Save → List refresh in one page, with links
between the stages and explicit client, server and CSR/SSR selectors. The benchmark entry is
separate at `/benchmark/`. The obsolete `/displays/` route and its public files were removed.

### 2026-09-16 — Reuse the existing comparison container during source sync

The comparison deployment now separates first-time bootstrap from source synchronization. A
running container with the expected image and exact mounts is inspected and reused; normal source
changes do not call `containerctl down`, recreate the container, or reconnect build, cache, data,
or results volumes. The public pipeline forwards list and detail rendering to the selected native
PHP, PHP extension, Go, or Rust generator instead of rendering those requests in Node.

### 2026-09-16 — Correct the canonical display entry and renderer scope

The first `/displays/` implementation exposed the internal Cross-Check Console as the public
entry. That was incorrect. `/displays/` now serves a user-facing List/Detail page that renders
the framework-independent HTML output through the same public process. Cross-check render
matrices now include HTML alongside React, Vue and Svelte, so parity covers four renderers.

### 2026-09-15 — Add the canonical list and detail entry

The canonical `crudui.test` entry now links to `/displays/`, which serves the user-facing list and
detail example through the same public process as the form comparison. The internal Cross-Check
Console is not exposed as the canonical display page.

### 2026-09-15 — Use the shared allocator for empty native button text

The PHP extension now creates omitted button content with its shared string allocator, so
strict GCC builds do not depend on the non-standard `strdup` declaration.

The deployed comparison tree then passed 450 generation, 120 persistence and
7,008 browser checks with zero failures.

### 2026-09-15 — Fix the native optional list input path

The PHP extension now initializes and validates the optional `buildList` rows argument before
calling the shared operation, so GCC's required warnings do not reject the native build.

### 2026-09-15 — Install the pinned OrderedJSON JavaScript package

The comparison build now copies the pinned monorepo `js/` package into its build-tree
`node_modules` before building frames, so all five runtimes use the same revision.

### 2026-09-15 — Remove the obsolete validator benchmark

The unused TypeScript benchmark that exercised the legacy validator and silently
substituted a small specification has been removed. `make bench` is the only
repository benchmark and requires its explicit shared fixture inputs.

### 2026-09-15 — Define display markup and validation error order

List and detail renderers now use the documented `crudui-list` and `crudui-detail`
block grammar. Format kinds use `crudui-value--TYPE`; badge variants and boolean
state use data attributes. Validation traverses keyed object entries in sorted key
order for the same first-error result in all five implementations, while data and
rendered row order retain input member order.

### 2026-09-15 — Use explicit ORM display paths

Display substitutions now use `{=path}`; legacy `{.path}` substitutions are removed. List and
detail `field` and `sort.field` paths no longer have a leading dot, so object members and
associative-array keys use one path contract. The naming change makes ORM relationship paths
explicit and prevents literal URL or file-extension dots from being parsed as substitutions.

### 2026-09-15 — Remove the field button text fallback

Button and action fields now read control text only from `content`; the old field
`text` fallback has been removed from all five generators.

### 2026-09-15 — Pin the OrderedJSON comparison source to the updated commit

The comparison source remains version `0.0.1` and uses a clean
`polyspec/ordered-json` checkout.

### 2026-09-15 — Exclude operator-local editor settings from comparison source

Comparison source identity and synchronization exclude operator-local editor settings.

[한국어](CHANGELOG.ko.md).

### 2026-09-15 — Pin the OrderedJSON comparison source to its monorepo

The form-comparison supervisor and cross-language checker now use one immutable
`polyspec/ordered-json` commit. JavaScript, Go, PHP, PHP extension and Rust are
verified as package directories within that checkout; submodule revisions and
submodule updates are no longer part of the source contract.

### 2026-09-15 — Report progress and enforce per-test limits in verification runners

The native generator, PHP extension engine, package, and PHPUnit verification
runners now report active work with elapsed time and stop an individual check at
its own measured timeout. Native checks can select targets and checks, and package
builds are reused only when their source and output digests still match.

### 2026-09-15 — Use GitHub-compatible documentation heading anchors

The documentation web now generates heading anchors without adding an underscore
to headings that start with a digit. Repository-relative document links therefore
use the same fragments as GitHub source pages. The web build test and the package
build specification in English and Korean record this rule.

### 2026-09-15 — Check every repository specification meant to be valid against the meta-schema

`scripts/check-schema.mjs` checked the validity cases only, so specifications the repository relies
on as valid failed the meta-schema without any check noticing. Each failure was decided from the
specification documents and all runtimes:

- Field `messages` is read by every validator as plain strings but was missing from the closed
  `Field` definition; the schema declares it.
- The rendering cases `button-empty`, `action-alias` and `button-behavior-onclick` failed on the field
  key `content`, the control text of the `button` and `action` widgets that every generator reads;
  the schema declares it.
- `$ref` accepts a string or a list of strings in every runtime (`compose:ref-multiple-order`), while
  the schema declared a string; one `Reference` definition applies at every composition position.
- Six validation cases and one list composition file declared child fields without the required
  `type`; they declare `type: text` and their expected results are unchanged.
- The compose cases marked merge sources with a `from:` key that is not a field key; they use
  `label:` for the same purpose.
- The console example `list-search-conditional` wrote `pagination.perPage` where every runtime reads
  `per_page`, and put its select choices under `options` where every runtime reads `items`, so the
  select rendered empty.
- Condition maps: every runtime evaluates non-default keys in order and falls back to the `true`
  value, then `null`; the field specification wrongly said the `true` key is required and now states
  the rule `docs/spec/expressions.md` already gave.
- A large example specification had two duplicate YAML keys, which the benchmark fixture
  generator hid by parsing with `uniqueKeys: false`; the duplicates are removed with an identical
  parse result and the generator parses strictly, leaving the benchmark fixtures byte-identical.
  `examples/legacy/basic-form.yml` did not parse because of an unquoted value and is quoted.

The detail rendering case `content-values` intentionally declares a non-string language map entry to
test the runtime rule that skips it, and is registered with that reason. The legacy specifications in
`tests/fixtures/specs` and `examples/legacy` use the legacy field model, so the check requires them to
parse without duplicate keys and to fail the current meta-schema.

The check covers every fixture family's form, list and detail specifications except cases that expect
an input or composition failure, composition files as the fragment their `$ref` selects, compose
entries, validator CLI requests, form session specifications, `examples/form-structure`, the console
examples and the specifications embedded in the Go, PHP and Rust package examples: 371 checks pass.
Changing `per_page` back to `perPage`, removing a composition file's `type` or making the exempt case
valid each failed the check. The regenerated cases, the TypeScript conformance files that read them
(175 tests) and type checking, the Go validate and compose packages, the PHP compose and validation
filters (144 tests), the Rust fixture tests and the documentation tests passed.

### 2026-09-15 — Type every validation rule and reject forbidden keys at every depth in the meta-schema

The validators register 24 rules (`pattern` shares `match`), while the form meta-schema declared only
`required`, `email` and `match`, and applied the forbidden key names only where it listed an object's
property names. Values it left open were not scanned: a `_` key inside a `validate.max` condition map,
a forbidden key inside an `options.items` element and a forbidden key added by a detail field's
`$patch` passed the meta-schema and were rejected only by the runtime scan; those three cases were
recorded as meta-schema passes.

The meta-schema declares every registered rule. Boolean switches accept a boolean, an expression or a
condition map; numeric rules a number, an expression or a condition map; `range` and `rangelength` two
numbers, an expression or a condition map; `false` or `null` disables any rule. Rules whose parameter
every engine passes unchanged accept only their literal shapes: `match`, `pattern`, `equalTo` and
`enddate` a string, `notEqual` a scalar, `unique` a boolean or string, `accept` a string or list of
strings and `in` a comma string, a list of scalars or a value-to-label map. `validate` stays open, as
the [field specification](docs/spec/schema.md) states, so other rule names are accepted. Every value the
meta-schema leaves open uses one recursive definition whose objects must have allowed key names at
every depth; a schema walk found 38 untyped positions before the change and none after. A condition
map for `match` was accepted before, while TypeScript and Go skip a non-string pattern, so such a
declaration silently disabled the check; it is now rejected, and no specification in the repository
used it. The TypeScript `ValidateSlot` type lists the same rules and the CLI description names the open
bucket.

The three cases record `expect: "fail"` with reason `propertyNames`. Comparing 368 specifications in
the fixtures, `examples/form-structure` and `tests/fixtures/specs` against the previous meta-schema
changed only those three and accepted none newly. `scripts/check-schema.mjs` passed 103 checks, the
four TypeScript meta-schema and forbidden-scan conformance files passed 77 tests, the CLI suite passed
37 tests, and the documentation writing and fixture README tests and lint passed.

### 2026-09-15 — Give every shared fixture family a README in both languages

Six more fixture families under `tests/fixtures` had no README: compose, form-outline, form-session,
specs, translate and validate. Each has `README.md` and `README.ko.md` stating the case fields, what
the cases check, how results are compared, the tests that read them, and either the regeneration command or the
files kept by hand. `tests/docs/fixture-readmes.test.mjs` checks that every family has both files,
that they link to each other and that every relative link resolves; it failed before the READMEs were
written. The list and detail operations document links the validity READMEs instead of their case
files. The translate generator header repeated a word and a Makefile comment described the
documentation check with "now"; both are corrected. The documentation tests (25) and
`make docs-check` passed.

### 2026-09-15 — Hold every runtime to one structure validity case contract

The form specification cases recorded only the engine result, as `expect: "ok"` or
`{error_code, at_path}`, while the list and detail cases recorded the meta-schema result in `expect`
and `reason` and the engine result in `engine`. The tests read different fields.
`scripts/check-schema.mjs` did not run the form cases against the meta-schema. The Go list test ignored
the cases' `engine` and `files`: it classified cases with its own forbidden key list and composed them
with its own files, whose contents differed from the cases. The TypeScript detail meta-schema test did
not read the fixture, so no detail `reason` was checked. For form cases, TypeScript, Go, PHP, Rust and
the PHP extension did not require the `{valid: true, errors: []}` result they required for list and
detail cases.

The three families share one shape: `name`, `note`, `spec`, optional `files`, `expect` (`ok` or `fail`
against the family's meta-schema), `reason` (the ajv keyword, present exactly when `expect` is `fail`)
and `engine` (`"pass"` for `{valid: true, errors: []}`, or the load failure `code` and `at`). The three
fixture READMEs state the contract. `check-schema.mjs` checks the shape of every case and then `expect`
and `reason`; TypeScript has a form meta-schema test and its detail test reads the fixture; TypeScript,
Go, PHP, Rust and the PHP extension read `engine` and `files` from each case and require the clean result
for `pass`. Three passing form cases declared `required: true` and returned `required` errors on empty
data; they declare `required: false` and keep the keys the forbidden key scan walks. Two error cases,
`err-magic-underscore-default-key` and `err-inside-array-element`, pass the form meta-schema because it
does not type `validate.max` or `options.items`; they are recorded as `expect: "ok"` until the
meta-schema is corrected.

Changing a list case's `engine`, or putting a forbidden key in its composition file, made the Go and
Rust tests fail. `check-schema.mjs` passed 103 checks, and TypeScript (1,677 tests), PHP (1,539), the Go
and Rust suites, the PHP extension validation of 115 cases and the gateway suite (204) passed.

### 2026-09-15 — Give every example a README in both languages

`examples/form-structure` had no README and the cross-check console had no Korean README, so the
preview's purpose and start command were written nowhere. Every directory under `examples/` has
`README.md` and `README.ko.md` that link to each other, and `tests/docs/example-readmes.test.mjs`
checks both files, their links to each other and every relative link; it failed before the READMEs
were written. The form structure README gives `npm run build` followed by
`npx vite examples/form-structure`. That command served the page, its modules, the specification, the
data and `crudui.css`, and a headless browser rendered 57 nodes with the stored names. The console
README gives the Rust command its build script runs, `cargo build --locked --release --bin validate`.
The example README and writing tests passed.

### 2026-09-15 — Show lists and details in the package examples and document their operation

The package examples rendered forms only, no operations document described lists and details, and
the four documentation indexes listed different documents. The [examples contract](docs/operations/examples.md)
now requires current examples to cover forms, lists and details. The Go server example serves `/list`
and `/detail` beside the form from its stored record, the PHP example serves `?view=list` and
`?view=detail`, and the Rust example prints a form, a list and details rendered from one record. The
[list and detail operations](docs/operations/displays.md) document describes the build, render and
validation functions of JavaScript, the frameworks, PHP and the PHP extension, Go and Rust, their
options, the examples and the checks. The four documentation indexes list the same documents, and
the examples index lists every example.

The React, Vue and Svelte READMEs told readers to pass a `session` prop to `Form` and to call
`bindForm(template, data)`; `Form` takes a `form` prop and none of the three packages exports
`bindForm`. They also omitted lists, details and server rendering. Each README now shows the `form`
prop, `renderForm`, `List`, `Detail`, `renderList` and `renderDetail` with their return types
(strings in React and Svelte, promises in Vue), and the Svelte README states that the package loads
through a Svelte-aware bundler.

The Go example tests passed. The Rust example ran and printed three form blocks, one list and two
details. The PHP example served the three pages; after a record was saved through the form, the list
linked its name to the detail and the detail linked the email with `mailto:`. The JavaScript, PHP,
Go and Rust code blocks of the operations document ran, and the React and Vue README snippets
rendered their data from the built packages.

### 2026-09-15 — Render and validate details in the cross-check console

The console compared form and list rendering and validated lists and details, but it could not
render a detail. It now fans a detail specification and one record out to React, Vue and Svelte
through `POST /api/render-detail`, runs every shared detail case in its suite, and offers a detail
tab that validates and renders together. The console removed React preload links with its own
pattern while the conformance checks use the shared helper; it now uses that helper. The client
README described a list load failure as a `LOAD-ERROR` cell, which the page shows as `FAILURE`.
The gateway suite passed 204 tests.

### 2026-09-15 — Check list and detail designs as form designs are checked

Lists and details have no compile step, so an unknown `design` key in a list, a column, a detail or a
field was ignored in every runtime; the detail case fixed earlier today styled its cell with such a
key for that reason. The [display formats](docs/spec/display-formats.md#input) now check the
declarations after the input rules and composition with the form declaration rule and messages, at
the paths `list`, `columns.{name}`, `detail` and `fields.{name}`, the own design before its columns or
fields. JavaScript, Go, Rust, PHP and the PHP extension share one design declaration check between
forms, lists and details. Five shared list and detail cases cover unknown keys, value types and the
order.

This change and the member order change below edited the same list, detail and template functions in
Go and Rust at the same time, so they are recorded in one commit.

Both changes were verified together; the results follow the member order entry.

### 2026-09-15 — Use one member order for specification objects in every runtime

JavaScript receives a specification as plain objects, which list array-index member names such as
`10` first in ascending numeric order; PHP, the PHP extension, Go and Rust kept the order in which
members were written. Measuring the six targets with fields written `b`, `10`, `a` showed JavaScript
compiling, rendering and validating them as `10`, `b`, `a` and every other runtime as `b`, `10`, `a`,
and the same split for list columns, detail fields, `items` value maps and the unknown key a closed
bucket reports. The [field specification](docs/spec/schema.md#member-order) now defines this order
for every object in a specification, in composition files, composition results and compiled
templates, while record data keeps the order in which it arrives. Go, Rust, PHP and the PHP extension
reorder specification inputs, loaded composition documents and composition results, and bind
reorders the templates it receives.

Writing the shared cases exposed two defects. Cases generated through JavaScript objects already
held their members in JavaScript order, so they could not fail in any runtime, and Rust compares
maps without member order; those cases were removed. The validation cases now keep the written
order as JSON text, a composed case checks a patched index name, and the native runner sends raw
JSON text for fields, composed fields, `items`, list columns, detail fields and unknown-key reporting,
judging order from arrays, HTML and messages. The JavaScript validator also left an error's `value`
undefined when the field was absent, so the member disappeared from JSON while Go, PHP and Rust
wrote `null`; every error now carries `value`, `null` when absent.

The native comparison passed 259 checks in each of JavaScript, the HTML renderer, PHP, Go, Rust
and the PHP extension (1,555 checks, inputs unchanged during the run). The PHP extension engine
test passed 24 tests; its address sanitizer test runs only on Linux. The PHP generator passed 195
tests, and the PHP API passed 642 checks in each of three configurations and 115 validation cases in
each implementation. `npm run test:forms` passed core 112, HTML 257, React 425, Vue 396 and Svelte
393 and 10 tests. The validators passed TypeScript 1,677 tests, PHP 1,539 tests and the Go and Rust
suites, the gateway suite passed 204 tests, and build, lint, formatting, the documentation tests
(25) and the documentation web checks passed. The working tree for these checks also held changes
committed after this one.

### 2026-09-15 — Lint every TypeScript package without warnings

`npm run lint` covered only the validator, HTML renderer and React sources, so the core, Vue, Svelte
and CLI packages and the validator benchmarks were never linted, and warnings did not fail the
command. It now lints `packages` with `--max-warnings 0`. The wider scope reported 14 problems in
sources and 3 in the benchmarks: the CLI schema projection read JSON Schema through `any` and kept an
unused parameter, the date parser assigned an initial zone it never read, the Vue form imported `h`
without using it, the Svelte widget escaped `/` in template strings, and the benchmarks imported an
unused type and defined a path parsing benchmark that never ran. The CLI reads schema definitions
through one typed node, the unused code is removed and the path benchmark runs with the other parsing
benchmarks. The benchmarks report to the console, so `no-console` is off for them, and `.svelte-kit`,
`target` and `vendor` outputs are ignored.

Lint passed with no warnings, and the CLI (37 tests), core (112) and Svelte (393 and 10) suites
passed. The validator benchmarks are still outside type checking and measure the legacy validator;
that remains open.

### 2026-09-15 — Import the Vue server renderer through the vue peer dependency

`@crudui/generator-vue` imported `@vue/server-renderer`, a development dependency outside its declared
`vue` peer dependency. The build did not treat it as external, so the built entry carried a 2.2 MB
bundled copy whose ES module had no named exports, and `renderForm`, `renderList` and `renderDetail`
failed from the built package with `renderToString is not a function`. The package imports
`vue/server-renderer`, which the peer dependency provides, and no longer declares the development
dependency; the built ES module entry is 24 KB.

The packed install check rendered forms only in a browser build, so server rendering was never run
from an installed package. It now renders a form, a list and a detail from the installed React and
Vue packages through both `import` and `require`, and from the Svelte package through Vite
`ssrLoadModule`. With the old import the check failed with the same error. React imports
`react-dom/server` and Svelte imports `svelte/server`, both covered by their peer dependencies. The
Vue suite passed 396 tests and `npm run test:packages` passed.

### 2026-09-15 — Keep Korean heading anchors on the documentation web

The documentation web built heading ids from NFKD text. NFKD decomposes Hangul syllables into jamo,
so a Korean heading such as `목록 모델` received an id that no Korean fragment link could match.
Heading ids are composed again after combining marks are removed: Hangul keeps its syllables and
accented Latin letters still lose their marks. The web build test covers a Korean heading, a
fragment link to it and `Café`. The web build suite passed 11 tests.

### 2026-09-15 — Compare expected PHP signatures without losing empty objects

Candidate verification stopped in the PHP modes check with `Public PHP and extension
signatures must match`, although both PHP implementations declare the same methods. The check
decoded the expected signatures as associative arrays, which turns an empty object default into
an empty array; the detail methods declare `record = new stdClass()`, so the
expected `{}` became `[]` and no longer matched the reflected `{}`. The check now decodes the
expected signatures as objects and compares them exactly. Locally, the pure PHP signatures written
and read back as objects compared equal, and the associative round trip reproduced the mismatch.

### 2026-09-15 — Reject unknown keys in the buckets the schema closes

The schema closes `multiple`, `lang`, `design`, its nodes and `behavior`, but form compilation
stated that it did not check unknown keys there, and the typed models disagreed with the schema
and with each other: Rust kept unknown keys in all eight buckets, TypeScript opened `multiple` and
`lang`, Go silently dropped unknown keys everywhere except `options`, including rules in the open
`validate` bucket. A misspelled key such as `multiple.maximum` or `design.label.text` therefore
did nothing and reported nothing.

Every form compiler now rejects such a key with `Invalid {bucket}.{key} at {path}: unknown key`,
checking a bucket's keys in declaration order before its values, in the order `buttons` and
`action`, `multiple`, `lang`, `design` and its nodes, and `behavior`. The typed models follow the
schema per bucket: closed buckets reject unknown keys, and `validate`, `options` and dynamic
`items` sources keep them. Go's compiler returned early when a field had no design, which would
have skipped the behavior check; Go's typed `validate` now keeps unknown rules.

Checking every tracked specification against the rule found one shared detail case,
`design-wrapper-and-cell`, that styled its cell with a `design.main` key no runtime reads, so the
case never exercised cell styling; it now declares `design.class` and `design.style`.

Six shared compile rejection cases cover each bucket, a design node and the precedence of an unknown
key over a value error. `make test-native` passed 247 of 247 checks in each of the six targets (1483
including input checks). Validator tests passed in JavaScript (1642), Go, PHP (1529) and Rust (73);
the console suite passed 166 of 166; the meta-schema check passed 80 fixture checks; test:forms,
lint, format-check, manifest:test, test:docs and docs-check passed.

### 2026-09-15 — Build and install what checks run before running them

Three findings recorded during the form structure work stayed open because they needed a rule,
and one shared case contradicted the schema:
- `make test-native` wrote its report to `.git/native-generators`, which cannot be created in a Git
  worktree, where `.git` is a file. The report path now comes from `git rev-parse --git-path`, the
  same path in a normal checkout.
- The cross-check console tests run the Go and Rust validator programs from fixed paths and never
  checked that they matched the sources; today a missing Rust program failed 23 tests locally, and
  earlier runs used programs older than their sources. The console's `npm test` now builds both
  programs first, and CI no longer builds them in a separate step.
- generator-php installs the validator as a copy, as the package build rules require, and the copy
  does not follow later source changes; the native checks twice ran against a stale copy today.
  `make test-native` now reinstalls the copy before any check loads it.
- The forbidden-key case `ok-plain-spec` gave `design.label` a string, which the schema and the form
  compiler reject; it now declares a label class.

`make test-native` reinstalled the copy, wrote its report through the Git path and passed 241 of 241
checks in each of the six targets (1447 including input checks). The console suite built both
validator programs through `pretest` and passed 166 of 166. The forbidden-key cases passed in
JavaScript (24), Go, PHP (23), Rust and the PHP extension (585 API checks in each of three
configurations, 113 validation cases, engine 24 with one existing skip). test:forms, lint,
format-check, manifest:test, test:docs and docs-check passed.

### 2026-09-15 — Enforce the detail input order and keep the rules in the libraries

The display format specification lists the detail input rules in order, but every shared detail
case broke one rule at a time, so the order was never checked. Adding cases that break two rules
at once showed that the JavaScript protocol adapter of the native runner, and the Go and PHP
generator commands, checked the record themselves before calling the library. With an invalid
specification and an invalid record they reported the record, while the libraries report the
specification. The JavaScript adapter also turned a `null` record into an empty object, which no
other runtime does.

The adapters could not simply defer to the libraries: the Go and PHP detail signatures take the
record as an object, so a non-object record can only be rejected where JSON is decoded, and the
documented order put the `fields` rule before the record rule. Instead of copying the `fields`
rule into every adapter, the rule order now follows one principle that the list rules already
followed: argument shapes in argument order (specification, record), then the declaration
(`fields`), then options (`data`). The JavaScript, Rust, PHP and C libraries check in that order,
the JavaScript adapter passes the decoded record unchanged, and the Go command checks the record
only for an object specification. Three shared cases break two rules each.

The detail cases grew to 28. `make test-native` passed 241 of 241 checks in each of the six
targets (1447 including input checks).

### 2026-09-15 — Validate detail specifications in every language

`validateDetail` existed only in JavaScript, its feature was recorded as partial, and the shared
detail validity cases were two meta-schema cases that no engine read. Go, PHP, the PHP extension
and Rust now validate a detail specification as JavaScript does: compose the root and the
`fields` map, then reject a forbidden meta key anywhere as a load failure. The shared cases grew
to ten, each declaring the engine verdict (`pass` or a code and location) next to the meta-schema
verdict, and every language, its command-line adapter and the cross-check console
(`/api/validate-detail`) run them.

Writing the cases corrected two expectations: the meta-schema requires `fields`
on a root that only references a base, and it does not read inside `$patch`, so a forbidden key
added by a patch passes the meta-schema and fails in the engine.

Two divergences surfaced on the way:
- The validator command-line adapters handled `mode` differently: JavaScript and Rust ran form
  validation for any unknown value, Go failed with its own message, and PHP failed with
  `Unsupported validation mode` but, like Go, would have read `"mode": null` as absent. Every
  adapter now accepts an absent `mode` (form) or `form`, `list` or `detail`, and fails any other
  value, `null` included, with `{"error": "Unsupported validation mode"}` and exit 1.
- JavaScript composed a list root and a detail root with two copies of the same function that
  differed in whether own keys written before `$ref` survive. Both validators now share one
  root composition, the list behavior.

Measuring the adapters with malformed requests then showed that only form data handling was
shared. Invalid JSON, a non-object request and a missing or non-object `spec` produced four
different messages (Go and PHP printed their parser or type errors), Go checked `mode` before
`spec`, and a non-object `files`, a non-object file member or a non-string `basepath` was ignored
by JavaScript and Rust but rejected by Go and PHP with their own messages. Every adapter now checks
the request in one order with one message per rule (valid JSON, an object request, an object
`spec`, a supported `mode`, an object `files` with object members, a string `basepath`), and the
shared [command-line request cases](examples/cross-check-console/validators/README.md) run in all four
languages through the cross-check console tests. PHP's own command-line tests sent `files` as a
JSON array and now send an object.

JavaScript validator tests passed 1642 of 1642, Go validator packages passed, Rust 73 of 73, PHP
1528 of 1528, and the PHP extension engine tests passed 24 with one existing skip; the PHP API
check passed 585 checks in each of three configurations and 113 validation cases in each
implementation. The cross-check console suite passed 166 of 166, including the ten detail
validity cases and nineteen request cases in all four languages. The meta-schema check passed 80
fixture checks, `make test-native` passed 238 of 238 in each of six targets, and lint,
format-check, test:forms, manifest:test, test:docs and docs-check passed.

### 2026-09-15 — Resolve content text by one rule in every runtime

The schema defines content as a string or a language map whose entries are strings, but no
specification said how a runtime turns it into text, and measuring the six targets with values
outside that shape found five behaviors:
- A number entry in a language map (`prefix: { en: 7 }`) was used as text by JavaScript, PHP, the
  PHP extension and Go, and skipped by Rust, which fell back to the next language.
- A choice label that is a number (`items: { a: 3 }`) was written as `3` everywhere, while every
  other content setting given a number wrote empty text.
- A language map entry that is an object was written as `[object Object]` by JavaScript.
- The HTML renderer failed with `value.replace is not a function` for a link text, badge or bool
  label whose language map entry is a number, because the JavaScript translator returned the
  number.
- The C extension used the cell value as link text when `text` was `0` or `false`; every other
  runtime wrote empty text and falls back to the cell value only for absent, `null` or empty
  `text`.

The [field specification](docs/spec/schema.md#fields) now states the rule, which Rust already
followed: a string is itself, a language map yields the first non-empty string among its entry for
the display language, `en`, `ko` and its first key, and any other value is empty text. The
translators of JavaScript, PHP, the PHP extension and Go follow it, choice labels use it in every
runtime, and the C extension's link text falls back only as the others do. The translator also
resolves form content, so form labels follow the same rule. The shared detail case
`content-values` covers each behavior.

The detail cases grew to 25. `make test-native` passed 238 of 238 checks in each of the six
targets (1429 including input checks), and the measurement script for format details reported the
same result in all six targets.

### 2026-09-15 — Replace the list pageMeta option with page and total, and give JavaScript input errors their code

The list option `pageMeta` carried the caller's current page and total record count, but its name
said neither, and its members had no value rule: any value became a `data-page` or `data-total`
attribute, and shared cases covered numbers only. Lists now take two options, `page` (an integer
from 1) and `total` (an integer from 0), both at most 9007199254740991, the largest integer every
runtime represents exactly. Other values fail with `List page must be a positive integer` or
`List total must be a nonnegative integer`, checked after `data` and before `layout`. `pageMeta`
is removed, and PHP no longer lists it among the fixed object options.

Adding the rule exposed another divergence: a detail passes its options to the list engine, so
JavaScript, Go and the Rust library would have rejected an invalid `page` in detail options, while
the PHP library dropped them and the C extension never read them. A detail now takes only
`data`, `language`, `files` and `basepath` and neither checks nor uses `page`, `total` or
`layout` in any runtime; the shared detail case `list-options-ignored` enforces it.

CI failed in the cross-check console gateway job.
The JavaScript generators threw input errors as plain `TypeError` without a code, so the gateway
classified them as `RENDER_ERROR` while every other runtime reports `INVALID_FORM_INPUT`. The
native runner had not shown this because its JavaScript adapter filled in `INVALID_FORM_INPUT`
for any error without a code. Every generator-core input error is now the validator's
`FormInputError`, exported from generator-core, the adapter records a missing code as
`INTERNAL_ERROR`, and the gateway compares error messages as well as codes. The gateway also
replaced rows that are not an array with an empty list before rendering; it now passes them
unchanged. Its description of the layout option still named per-framework keys that no longer
exist and now states the single `layout` key.

Removing the adapter default showed that the JavaScript form instance also threw code-less
`Error` and `RangeError` for invalid row operations (an unknown or duplicate row key, the minimum
or maximum row count, an invalid position, an invalid sequence and an empty undo history), which
every other runtime reports as `INVALID_FORM_INPUT`. They are now `FormInputError` as well. The C
extension wrote `A sequence must contain 1-13 decimal digits` with a hyphen where every other
runtime writes an en dash; it now matches.

The list cases grew to 39 and the detail cases to 24. `make test-native` passed 237 of 237 checks
in each of the JavaScript, HTML, PHP, Go, Rust and PHP extension targets (1423 including input
checks), and the gateway suite passed 135 of 135 with the Go and Rust validator commands rebuilt.

### 2026-09-15 — Document display formats and hold every runtime to one input rule

The formats a list column or detail field can declare were described only by the schema and
the implementations. [Display formats](docs/spec/display-formats.md) now lists each format, its
options and defaults, the input rules with their messages and the markup, and the documentation
the documentation web publishes it under Specification.

Measuring the six targets against that document found divergences and defects no shared case
covered:
- Invalid list input failed differently in each runtime. A non-object specification, rows that
  are not an array or not objects, a non-object `data` or `pageMeta` option, and an unknown
  `layout` were rejected by some runtimes, silently replaced by defaults in others, or rejected
  with different messages. Every runtime now checks them in one order with one message, and an
  absent or `null` option uses its default.
- Every runtime counted `truncate` in UTF-16 code units, so a limit could cut an emoji in half,
  and JavaScript and Go also applied a numeric string. Every runtime now counts code points,
  applies only a number, uses its integer part and requires at least 1.
- JavaScript did not check the `decimals` range, and the runtimes that did check it did not
  share a message; PHP, for one, failed with `Decimal places must be between 0 and 100`. Every
  runtime now fails with `Number decimals must be between 0 and 100`.
- No runtime rejected a detail `data` option that is not an object. Every runtime now fails with
  `Detail context must be an object`.
- The Rust library took `pageMeta` as a map and `layout` as a string, so those two rules lived
  only in its command-line adapter, and its shared-case test replaced invalid rows with an empty
  list. Rust now takes both options as values and checks them in the library, as Go does. In Go
  and Rust, whose signatures take rows as a sequence, the rows rule applies where decoded JSON
  becomes that sequence; the specification states this.

The list cases grew to 31 and the detail cases to 23, each rule with its own case, and the native
runner compares error messages for cases that declare one. The JavaScript, HTML, PHP, Go, Rust
and PHP extension targets passed 228 of 228 checks each (1369 including input checks). The
measurement scripts for list input (14 inputs) and format details (19 inputs) reported the same
result in all six targets.

### 2026-09-15 — Keep contract verification commands to package checks

CI failed in the form instance job: `npm run manifest:test` runs every
verification command in the contract manifest, and the detail contracts declared `make test-native` for
`buildDetail` and `renderDetail`. That job has no native PHP toolchain, so building the extension
stopped at `Path contains a symbolic link: /usr/bin/php-config`. Every other contract declares
only package checks; native comparison is recorded through the runner in `tests` and runs in its
own CI jobs, which passed.

The two detail contracts now declare only their package checks, like the others. The core detail
test and the HTML and React detail conformance tests passed through `run-contract-tests.mjs`,
and `make docs-check` and `npm run test:docs` passed.

### 2026-09-15 — Enforce detail views at the same level in every runtime

Detail views existed in JavaScript and Go only, and nothing compared their output. Three
commits added PHP and Rust detail rendering and raw-HTML detail cases to the native runner,
and PHP JSON boundary documentation. They left four gaps: the runner compared HTML only, the C
extension had no detail operations although the runner sent it every case, the JavaScript
renderers kept their own substring tests, and the commit messages described their content only in
part. This change and the preceding one record their implementation and documentation.

Measuring every runtime found three divergences no check had seen:
- For a path the record does not have, JavaScript left the cell's `value` out, Go wrote `{}`,
  Rust wrote `null`, and PHP left it out, so its detail model raised an undefined-property
  warning. A cell's `value` is now `null` when the row has none and the member is always
  present, in lists and details alike; rendered HTML does not change.
- For a declared `null` image width or height, the C extension left both attributes out where
  every other runtime writes `width=""` and `height=""`. It now matches.
- Every PHP API reads an empty PHP array as the empty root object, as the PHP API contract
  states, but the detail methods of the PHP library and the extension rejected it. They now
  follow the contract; the PHP command-line adapter still rejects a JSON array, as every
  runtime does.

The rule is enforced at both levels a runtime exposes. `tests/fixtures/detail-render/cases.json`
holds 19 cases generated from React. React, Vue, Svelte and the HTML renderer run it as
conformance tests in place of their own substring tests. The native runner sends every case to
JavaScript, the HTML renderer, the PHP library, Go, Rust and the PHP extension as `buildDetail`,
whose model must match with its member order, and as `renderDetail`, whose HTML must match byte
for byte, image preload links included. The C extension implements both operations on the cell
code its list path now shares. Every runtime rejects a declaration that is not an object, a
declaration without `fields` and a record that is not an object with the same messages.

Two findings stay open. The C extension still uses the cell value as link text when `text` is
`0` or `false`, which the schema does not accept. Detail specification validation
(`validateDetail`) exists in JavaScript only, so the detail feature stays in progress.

`make test-native` passed 1,285 of 1,285 checks with every target available; each of the six
targets passed 214 of 214. The PHP generator passed 173 tests. The extension passed 396 API checks in each of three
configurations and 24 engine tests, with one Linux-only test skipped. React, Vue, Svelte and the
HTML renderer each passed the 19 detail conformance cases, the Go and Rust generator tests
passed, and `npm run lint`, `npm run test:docs`, the core, React and HTML type checks,
`make docs-check` and `npm run test:forms` passed.

### 2026-09-15 — Share the preload link helper between list and detail fixtures

Framework conformance compares a rendered list without the image preload links that React's
server rendering and the HTML renderer write before it; the native generator suite compares the
complete HTML. That rule was implemented in `tests/fixtures/list-render/list-body.mjs` under the
list-specific name `listBody`. Detail fixtures follow the same rule, so the helper is now
`withoutPreloadLinks` in `tests/fixtures/preload-links.mjs`, used by the list fixture generator
and the React and HTML list conformance tests.

Regenerating the list fixture produced identical bytes, and the React and HTML list conformance
tests passed.

### 2026-09-15 — Build generator-core with its declared library

Every CI job failed in `npm run build`: `detail.ts` called `Object.hasOwn`,
which the package's declared TypeScript library does not include. That commit was described as
a changelog wording fix, but staging every change also committed unfinished detail work: the
detail model's input checks (a declaration that is not an object, a declaration without
`fields` and a record that is not an object each fail with their own message), their tests and
the generator script for a shared detail fixture, without its cases. 

The own-property check now uses `Object.prototype.hasOwnProperty.call`. The detail input checks
stay: they are correct and tested, and the remaining detail work follows as its own change.
`npm run build`, `npm run lint`, `npm run test:docs`, `make docs-check` and the core detail
tests passed.

### 2026-09-15 — Keep the script URL expression through lint

CI failed on the HTML renderer: `no-control-regex` rejected the script-URL expression the
HTML renderer takes from the reference renderer, which skips the control characters a URL may
hide between the letters of the scheme. 

The expression stays as the reference renderer writes it, with the rule disabled on that line
and a comment saying why the control characters are deliberate. `npm run lint` passes and the
HTML renderer passed 207 tests.

### 2026-09-15 — Record the candidate verification of the server-rendered frame

Candidate verification passed. Generation verification passed 450 of 450
results across 899 HTTP requests, which now include the built frame document, the SSR form
HTML with its record payload and ten rejected SSR queries per combination. Each PHP mode
passed 62 generation checks and the repository checks. Every server browser run passed 1,752
of 1,752 checks, and the aggregate passed 7,008 checks with zero failures: 1,216 scenario
checks, 5,376 initialization comparisons, 320 interaction checks, 32 mount-before-load checks
and 64 frame-document checks. PHP completed in 340,871 milliseconds, the PHP extension in
306,669, Go in 276,126 and Rust in 265,581, all below the 900,000 millisecond limit.

The feature record now states these results, the source archive digest and the image digest.

### 2026-09-15 — Apply the rendered-node rule to the column comparison

Candidate verification failed again for Vue, 16 of 168 comparisons in each Vue initialization
report: the hydrated column kept the server's style attribute text
(`--crudui-sticky-depth:0`) while the mounted column carried the block Vue computes
(`--crudui-sticky-depth: 0;`). The specification already states that a style attribute is
compared as the CSS object model serializes its declarations, and that rendering anchors are
left out, but only the frame's hydration check implemented that rule; the page compared raw
attribute text. React normalizes the attribute while hydrating and the HTML renderer writes
the same markup in both columns, so only Vue exposed the gap.

The rule is now one function, `renderedNodes`, in the shared form inspector: it removes the
comments and empty text frameworks keep as anchors and rewrites every style attribute as its
declaration block. The frame's hydration check and the page's column comparison both use it.

The form inspector tests passed 20 tests.

### 2026-09-15 — Compare what the view containers hold

Candidate verification of the frame document change failed for Vue in both rendering paths:
18 of 168 comparisons in each Vue initialization report, with the first difference on the form
view element itself. The `csr` column's container carried `data-v-app=""` and the `ssr`
column's did not. Vue writes that attribute in `createApp().mount()` and not in the
`createSSRApp()` mount that hydrates, so it records how the column started rather than what was
rendered; the earlier comparison never saw it because both columns mounted.

The comparison now covers what the view containers hold, through `renderedViews`, instead of
the containers themselves, which belong to the page. Hydration is still enforced, and more
strictly than before: the SSR frame requires the taken-over form DOM to be unchanged and, for
React, Vue and the HTML renderer, every server-rendered element to survive. The specification
records the Vue mark and where hydration is enforced.

The form inspector tests passed 19 tests.

### 2026-09-15 — State which runtimes implement detail views

The runtime operation table named `Generator::buildDetail`, `build_detail` and their render
counterparts for the PHP library, Rust and the PHP extension. None of those six symbols
exists: detail views are implemented in the JavaScript packages and in Go only, which is what
the feature contract already records (`buildDetail` and `renderDetail` are `partial`, with
PHP, Rust and PHP native `unsupported`).

The table now marks an unimplemented operation with an em dash and says what detail views
lack: the shared fixtures, the renderer conformance tests and the native byte-equality run
cover forms and lists, so nothing compares JavaScript and Go detail output. The four
JavaScript renderers each assert three substrings of their own inline specification, and the
only shared detail fixture holds two specification-validity cases with no record and no
expected HTML.

`make docs-check` passed.

### 2026-09-15 — Load the public browser modules with their imports

Candidate verification of the frame document change failed in the container: the source check
that loads the public frame readiness module in Chromium read the file and imported it from a
`data:` URL, so the shared browser matrix import it now carries could not resolve
(`Failed to resolve module specifier "./runtime-paths.mjs"`). The check had passed only while
every public module was a single file, and the import was added without extending it.

The check now serves the public modules over HTTP, as the deployment does, and loads the
module from a document of that origin, so the whole import graph is exercised, including the
JSON matrix. It also asserts the module's three exports. A frame that cannot initialize now
publishes the reason to the page instead of never publishing readiness, and the page fails
with that reason instead of waiting for the no-progress limit.

The four Chromium source checks passed, comparison source checks passed 150 tests and
`make docs-check` passed.

### 2026-09-15 — Serve the SSR column as a server-rendered frame document

The comparison page's `ssr` column was not server-rendered. Its frame document contained an
empty form view, the browser requested `render`, wrote the returned HTML into the page and
mounted the framework over it, so the first paint came from JavaScript in both columns. The
static-document check required that empty view, so the contract enforced the opposite of
server rendering. The separate SSR document the servers did serve was a page of its own with a
link, a native form and per-server provenance, which the comparison never loaded.

The `ssr` action now serves the frame document itself. Its query is exactly `lang`, `server`
and `initialization=ssr`, each once, and every other query is rejected with one message. The
server reads the built frame page, which must contain exactly one `<html>` start tag, one
empty `<div id="form-view"></div>` and one `</body>`, and returns that page with three
insertions and no other change: the language on the html start tag, the form rendered from the
stored record in the form view, and the record with generator provenance in a
`<script type="application/json" id="crudui-ssr">` before the body end tag, with `<`, `>` and
`&` escaped. PHP, the PHP extension, Go and Rust implement the same rule and the same two
error messages.

The frame document separates the server-rendered form from the browser-only tools:
`#form-view`, `#outline-view` and `#data-view`. Every adapter offers `mountView` and
`hydrateView` and declares what hydration does with the server nodes. React hydrates with
`hydrateRoot`, reports its commit from an effect of the hydrated tree instead of waiting, and
fails on a recoverable error; Vue hydrates with `createSSRApp`; the HTML renderer keeps the
markup and connects the form and structure map bindings. Svelte replaces the nodes: its
hydration reads the `<!--[-->` markers only its own server renderer writes, so it clears the
container and mounts, which the adapter declares and the specification records. The SSR frame
reads its record from the payload, requires the taken-over form DOM to be unchanged, and for
an adapter that adopts nodes requires every server-rendered element to survive. The `mounted`
initialization stage is now the document itself: the page resets the record and loads the
column's document again, so both columns start through their own path.

The checks follow the same contract from one module. `frame-document.mjs` reads a frame
document, removes an SSR document's three insertions and returns the built page; the frame
build, the browser check and the generation check all use it. Browser verification records
both initialization documents of every rendering path and framework, 16 per server, and
compares the pages behind all four servers by SHA-256. Generation verification adds the built
frame document, the payload record and provenance, and ten rejected SSR queries per
combination that every server must reject with the same message: 450 results and 899 requests.
The operations document's generation and aggregate totals were stale (290 results, 411
requests, 912 scenario checks); they now state the current totals.

Comparison source checks passed 149 tests and `make docs-check` passed.

### 2026-09-15 — Render only grammar nodes in Vue components

Measured in jsdom, Vue `createSSRApp` hydration of the server markup for the shared session
form replaced the input elements and reported 40 mismatches: the server markup had no node
where Vue expected a comment. The Vue node and structure map builders passed `null` for an
absent header, footer, number, title, row controls or nested body, and Vue renders a `null`
child as a placeholder comment. The shared comparisons remove comments before comparing, so
the extra nodes were never reported.

The builders now add no child for an absent part. After the change, hydrating the same
markup kept every element with no mismatch, and the rendered form, structure map and data view
contained no comment node on the `createForm` path (empty, after injection and with every row
collapsed) or the `bindForm` path. `npm test -w @crudui/generator-vue` passed 342 tests.

### 2026-09-15 — Make the HTML renderer match the string renderer format

The string renderers were meant to produce the same bytes, but the check never included the
HTML renderer: the native generation check compared PHP, the PHP extension, Go and Rust with
React's server rendering only. Compared byte for byte over the 90 form fixtures, the HTML
renderer differed from React in 60, in input attribute order, attribute name case
(`readonly`, `autocomplete`), void element closing, `style` text and text escaping; it also
wrote no list image preload links and escaped `>` in attribute values differently. The runtime
contract did not say which renderers the byte rule covers.

The contract now names the string renderers (React's server rendering, the HTML renderer and
the PHP, PHP extension, Go and Rust generators), makes React's server rendering the reference
and lists its format. The HTML renderer writes that format: escaping, React attribute names,
an input's `style`, `name`, `checked` and `value` last, void elements closed with `/>`, `style`
as `property:value` joined by `;`, blocked script URLs, a doubled leading newline in a
textarea, raw attributes for controls with event attributes, raw list actions and list image
preload links. The native generation check runs the HTML renderer as a sixth target through
`javascript.mjs --renderer html`, so the rule is enforced for every string renderer. The list
layout tests of React and the HTML renderer and the list fixture generator share
`list-body.mjs`, which removes the preload links before normalization, instead of separate
copies; regenerating the list fixtures produced identical bytes.

`make test-native` passed 1171 checks (195 for each of JavaScript, the HTML renderer, PHP,
Go, Rust and native PHP). `npm run test:forms` passed (core 110, HTML 207, React 352, Vue 342,
Svelte 339 and 10, Chromium 17), `npm run test:form-comparison:source` passed 141 and `:browser`
4, and `make docs-check` passed.

### 2026-09-15 — Write float fixture values as C double literals

`make test-native` stopped in the PHP extension engine test "list rendering has no undefined
behavior findings": the generated C fixture wrote `ps_float_value(1000000000000000100)`, and
Apple clang 21 rejected the implicit integer-to-double conversion that changes the value to
1000000000000000128 (`-Wimplicit-const-int-float-conversion` with `-Werror`). The same check
passed on 2026-09-14; Xcode 27 was installed on 2026-09-15 and `xcode-select` now selects its
clang 21 instead of the Command Line Tools 16.2 compiler. The value comes from the native
number case 1000000000000000128, which JavaScript prints as `1000000000000000100`.

The fixture writer emitted a number outside the safe integer range as JavaScript prints it,
so an integral value became a C integer literal. It now writes a C double literal, adding
`.0` to an integral value; C reads the literal as the same nearest double. The engine test
passed 22 tests; the address sanitizer test is skipped outside Linux by its declared
platform condition and runs in the Linux CI job.

### 2026-09-15 — Keep the comparison page on one screen

After deployment, real Safari pressed Expand all inside the left frame, moved the
pointer to the page header and ran the repeated injection comparison for PHP, React and
bindForm. It stopped with the pointer message after three comparisons instead of matching
168/168. Recorded while it ran: the page stayed at scroll 0 through `saved`; when the `copied`
stage moved focus to the new row, Safari scrolled the page to 602 px, the left frame's top
moved from 602 px to 0 under the resting pointer, and the frame's document element matched
`:hover`. The frames were stacked, each one viewport tall, in a scrolling page, so any focus
move could bring a frame under a pointer that the person had placed outside the frames.

The page now fits one screen and never scrolls. The title, controls, notes, comparison
results, source details and report form a panel limited to 45% of the viewport height that
scrolls inside, and the two frames share the rest side by side (stacked halves at 1000 px and
below), each scrolling inside. Measured with the page's markup and stylesheet, long results
and 3,000 px frame documents in Chromium and Playwright WebKit at 1680×1100 and 900×700: the
page is not scrollable, both frames lie inside the viewport, focusing a control at the bottom
of each frame scrolls that frame (2,474 px and 2,862 px) and leaves the page at 0, and a
pointer on the header is over neither frame. The comparison contract describes the layout.

`npm run test:form-comparison:source` passed 141 and `:browser` 4, and `make docs-check`
passed. On the deployed page, real Safari pressed Expand all inside the left frame,
moved the pointer to the page header and ran the repeated injection comparison for PHP, React
and bindForm: 168/168 matched. With the pointer resting over the left frame, the comparison
stopped with the pointer message and produced no result.

### 2026-09-15 — Capture comparisons only while the pointer is outside the frames

After deployment, real Safari driven by safaridriver repeated the procedure that
reproduced the focus outline difference: a real pointer press on Expand all inside the left
frame, then the repeated injection comparison for PHP, React and bindForm. The focused
control and its `:focus-visible` state were now equal in every stage, but the comparison
failed 7 of 168 on CSS, `copy-removed` through `restored`. The differing property was a
button's `background-color`: `rgb(249, 250, 251)`, the `.crudui-action:hover` background, in
the left column, where the pointer rested, and transparent or white in the right column.

A pointer rests over one frame only. In Chromium, Playwright WebKit and Safari, the frame's
document element matches `:hover` exactly while the pointer is over that frame. No page style
keeps `:hover` out of a frame in every browser: in Safari, `pointer-events: none` on the
iframes left the hover in place, and a transparent element covering the iframe, although it
was the topmost element at the pointer, cleared the hover only until the pointer moved from
the top-level document. Playwright WebKit also restored the hover after a move under both.

The comparison page now captures a column only while the pointer is outside both frames
(`src/frame-pointer.mjs`). When the pointer is over a frame, the comparison stops without a
result and asks to move the pointer outside the frames and compare again, and the list shown
after loading gives the same message instead of comparing. No style is removed from the
comparison. A Chromium check moves the pointer from the page onto a frame and back and reads
the frame's state each time.

`npm run test:form-comparison:source` passed 141 and `:browser` 4, and `make docs-check`
passed.

### 2026-09-15 — Set whether scripted focus is visible

In Safari, the repeated injection comparison for PHP, React and bindForm on the deployed
page failed `expanded-all`, `undone`, `empty` and `restored` on CSS only: focus was on
the same button in both columns, but the left column showed no focus outline and the right
column showed the `:focus-visible` outline. Real Safari driven by safaridriver passed 168/168
four times, once with the comparison started by a real pointer press. After a real pointer
press on Expand all inside the left frame, the comparison failed 8 of 168: `copy-removed`
through `restored` differed on CSS, and the stage records showed the focused control matching
`:focus-visible` in the right column and not in the left.

Measured in Chromium, Playwright WebKit and Safari: after a pointer press focuses a button, a
scripted `focus()` on another control does not match `:focus-visible`, and `focus({ focusVisible
})` decides it in all three. The bindings restored focus with `focus({ preventScroll: true })`
and moved it with `focus()`, and the comparison stages focused controls with `focus()`, so
pointer input earlier in one frame changed only that column.

The bindings now set visibility explicitly. `connectForm` records whether the focused control
matches `:focus-visible` and restores it with that visibility; focus moved to a row or an Add
button after an action, or to a row selected in the structure map, is visible, because the
move relocates the user. The comparison page's bindForm controller follows the same rule, and
the comparison stages focus controls with `focusVisible: true`, as a keyboard user does. The
runtime and comparison contracts state both rules. A Chromium check in the page, box and frame
hosts presses a toggle with the pointer, restores it without visible focus, restores a visibly
focused toggle with visible focus, and presses Add with the pointer to move visible focus to
the new row. Without the `connectForm` change it fails in all three hosts on the visibly
focused toggle; with it all pass.

`npm run test:forms` passed (core 110, HTML 207, React 352, Vue 342, Svelte 339 and 10,
Chromium 17), `npm run test:form-comparison:source` passed 141 and `:browser` 3, and `make
docs-check` passed.

### 2026-09-14 — State that the comparison storage lock covers one browser

While a Playwright WebKit comparison ran against the deployment, a check in Safari
did not finish, so the two runs shared the saved records although each page held its own
storage lock. The lock from `navigator.locks` belongs to one browser. The comparison
contract now states that other browsers, other people and automated runs against the same
deployment read and replace the records without it, so checks from different browsers must
not run at the same time. The servers keep one record store per server, rendering path and
framework; separating stores per run was considered and not adopted.

### 2026-09-14 — Mark unavailable actions with aria-disabled

In Safari, the repeated injection comparison on the deployed page reported
`restored` with CSS and focus differences: the left column kept focus, with its focus
outline, on the disabled Undo button, and the right column had no focus. It did not
reproduce in Chrome (React, bindForm, PHP: 168/168), in Playwright WebKit for all eight PHP
combinations (168/168 each), or in a complete Safari run (96 reports, 0 failed).

The `undone` stage focuses Undo and presses it; with the history empty, every renderer then
wrote `disabled` on that button. Measured in Playwright: a focused button that becomes
disabled keeps focus in Chromium, while WebKit clears focus at the next rendering update.
Either button replaced by an equal disabled button loses focus. "Undoing keeps the focused
action button" therefore depended on the browser and on whether WebKit's focus clearing ran
before or after the frame re-rendered and restored focus.

Every action button, in the form and the structure map, now marks an unavailable action with
`aria-disabled="true"` instead of `disabled`, in the HTML, React, Vue and Svelte renderers and
the Go, PHP, Rust and PHP extension generators. The button stays focusable and a click on it
does nothing: `connectForm`, `connectOutline` and the comparison page's bindForm controller
read `aria-disabled`, and the stylesheet styles `[aria-disabled='true']`. Field controls keep
`disabled`, which is declared data state. The shared form render and structure map fixtures
were regenerated; their only change is this attribute. The markup naming check rejects
`disabled` and any `aria-disabled` value other than `true` on action buttons, and the shared
DOM scenario checks that an unavailable Move up button keeps focus and changes nothing when
clicked.

`npm run test:forms` passed (core 110, HTML 207, React 352, Vue 342, Svelte 339 and 10,
Chromium 14), `make test-native` passed 976/976, the Go generator tests, the Rust generator
tests (20 and 4), the PHP generator tests (163), `npm run test:form-comparison:source` (141)
and `:browser` (3), `make docs-check` and `make format-check` passed.

On the deployed page, measured with Playwright for both frames of every framework and
rendering path on PHP, the Undo button starts with `aria-disabled="true"` and no `disabled`.
Focused and activated by a scripted click, as the `undone` stage does, or by Enter, Undo keeps
focus in Chromium and WebKit after the history empties and several rendering updates pass. A
mouse click on any button leaves focus on the body in WebKit, including Expand all, which
changes no data; that is WebKit's mouse behaviour, the same in both columns, and not a
rendering result.

### 2026-09-14 — Run one comparison storage operation at a time

On the deployed page, pressing Run checks in the left and right frames at the same
time failed several checks in both frames with "Check error". Run in one frame alone, the
same checks passed 19/19. Both frames, the page and every tab of the origin read and replace
the same saved records, but each frame and the page guarded only itself with its own
`running` flag, and the page's repeated injection comparison had no guard. The two runs reset
and saved over each other's records.

Operations started from the page now change the records only while they hold one origin lock
through `navigator.locks` (`src/storage-lock.mjs`): frame buttons, form submission, the
comparison button and the complete check. An operation started while another holds the lock
does not run and reports that another check or save is running. The checks that the complete
check and the verifier call directly run inside the operation that already holds the lock. A
frame that is running its own checks still ignores its other buttons, so their messages do
not replace the result list being written.

`npm run test:form-comparison:source` passed 141 tests, including the lock's two tests,
`npm run test:form-comparison:browser` passed 3 and `make docs-check` passed.

### 2026-09-14 — Query the collection again after an empty-collection addition

The candidate run, the first to build and run the HTML frames, passed generation
(386 results, 547 requests) and then failed 4 of the 1,744 PHP checks: the `empty` scenario
of the HTML renderer on both rendering paths and both transports reported "add into empty
collection: expected 1, actual 0". The run stopped there, so the other servers did not run.
The scenario held the collection element it found before pressing Add and counted rows in it
afterwards. React, Vue and Svelte keep that element, but the HTML renderer writes new markup
on every change, so the held element was detached. The runtime contract already allows rendering to replace
elements, so the scenario was wrong: `addEmpty` now receives a function that finds the
collection and queries it again after the addition renders, as the scenario's
`departmentWrapper` already did. The scenario's other helpers use elements only before the
action they perform.

That run used a separate git worktree of the commit, because candidate preparation refuses to
start in a checkout with uncommitted changes.
`npm run test:form-comparison:source` passed 139 tests.

### 2026-09-14 — Add Go detail model and SSR rendering

The Go generator now provides `BuildDetail` and `RenderDetail`, reusing the
existing ordered display and composition path used by `BuildList`. The command
adapter accepts a single object record for the `renderDetail` operation.

### 2026-09-14 — Add Svelte detail rendering

The Svelte generator now exports the shared read-only `Detail` component and
`renderDetail` SSR entry point. Its display branches consume the core detail
model and preserve the existing raw HTML display boundary.

### 2026-09-14 — Add Vue detail rendering

The Vue generator now exports the shared `Detail` component and asynchronous
`renderDetail` SSR entry point. It consumes the core detail model and the
existing list cell display mapping.

### 2026-09-14 — Add React detail rendering

The React generator now exports the shared `Detail` component and
`renderDetail`, reading the core detail model and existing cell display
components. The output remains read-only and performs no data access or
duplicate display evaluation.

### 2026-09-14 — Add the CRUDUI detail specification and shared read model

CRUDUI now defines a `Detail` declaration with ordered read-only display fields.
The core exports `buildDetail`, which delegates composition, conditions,
localization and display formats to the existing list engine, and the HTML
generator exports `renderDetail`. The TypeScript validator and schema checks
cover the new entry point. Other runtime generators remain incomplete and the
feature is recorded as partial.

### 2026-09-14 — Compare the HTML renderer on the comparison page

The comparison page rendered the client columns with React, Vue and Svelte only;
`@crudui/generator-html`, the framework-independent renderer, was never part of the
browser matrix. `html` is now the fourth framework in `runtime-paths.json`, so the
servers accept its routes and render its SSR documents, and every check covers it.

- `create-form-html.ts` renders `renderForm`, `renderOutline` and `renderData` into the
  frame, connects one `connectForm` binding (which runs both the form's and the
  structure map's actions) before its rendering subscription, and renders again and
  synchronizes on every change. `bind-form-html.ts` renders `renderFormView`,
  `renderOutlineView` and `renderDataPanel` from `bindForm`. The frame build resolves
  `#html` to the renderer source, and the page offers HTML in its framework selector
  and names it in its introduction and README.
- Tests that wrote matrix numbers now derive them: the generation test uses the exported
  generation totals, the interaction test multiplies the matrix by its five actions, and
  the runtime-path test compares the combination counts with the matrix.
- The comparison specification states the new sizes: 64 scenario and 32 initialization
  reports; per server a job of 24 reports (16 scenario, 8 initialization), 80
  interaction, 8 mount-before-load and 8 static-document checks; an aggregate of
  1,216 scenario checks, 5,376 initialization comparisons, 320 interaction, 32 mount
  and 32 static-document checks; and generation verification of 386 results, 547
  requests and 32 combinations. Two errors in that text are corrected with it: the
  aggregate still said 4,608 initialization comparisons although the categories had been reduced
  to seven, and it named the mount-before-load frame `inject`, the
  column name that `csr` replaced. The runtime package and native generator
  documents name the HTML renderer among the browser targets.

`make format-check`, `npm run test:form-comparison` (source 139, library 10, browser
job 3), `npm run test:runtimes` (20), `make docs-check`, the Go server tests and the Rust
server tests (4) passed. The frames, including the HTML frames, are built and run
against the four servers only by the candidate verification.

### 2026-09-14 — Render a bindForm form with the HTML renderer

React, Vue and Svelte render a form owned through `bindForm` with the
stateless `FormFields`, but `@crudui/generator-html` could render a form only from a
`createForm` instance (`renderForm(form)`); its structure map and data view already had
stateless `renderOutlineView` and `renderDataPanel`. `renderFormView(fields, buttons,
messages)` now renders the `crudui-form` block from `bindForm`, `bindButtons` and
`formMessages`, and `renderForm` uses it, so the markup is built in one place. The
README and the form runtime specification describe it.

The HTML renderer's conformance test renders every renderable form fixture through this
path as well. That includes the missing-data case the instance path skips, because
`bindForm` gives missing repeated data its fixed row key. `npm test -w
@crudui/generator-html` passed 206 tests (116 before, plus 90 bindForm cases),
`npm run build -w @crudui/generator-html` succeeded and `make docs-check` passed.

### 2026-09-14 — Correct the runtime contract on attribute order

The form runtime specification still required the restored HTML string to match
"including attribute order" and said the shared DOM binding places a checkbox's `checked`
attribute last. That criterion had been corrected, and the code that enforced it
had been removed, but the contract text was left unchanged. The specification now states
the corrected rule: attribute order is not part of the contract, the bindings never
rearrange attributes, the comparisons use the parsed DOM, and the string renderers'
byte-identical HTML is checked separately.

`make docs-check` passed.

### 2026-09-14 — Derive the browser report counts from the matrix

After the browser matrix moved to one file, the server report policy still wrote its
report counts as numbers: 18 reports in a browser job, 12 scenario reports, 6
initialization reports, 60 interaction checks and 6 mount-before-load and static-document
checks, and `check.mjs` started each job at 18. Adding a framework would have made every
number wrong. The policy now checks each count against the combination functions it
already uses to check the report keys, and `browserJobReportCount()` (scenario reports
plus initialization reports) gives the job size to `check.mjs` and the report test.

`npm run test:form-comparison:source` passed 139 tests.

### 2026-09-14 — Define the comparison browser matrix once

The comparison page's servers, rendering paths, frameworks, transports, initializations
and API actions were written in `runtime-paths.mjs` and again in the browser report
policy, the candidate verification, readiness and startup checks, the frame, the
deployment health check, the PHP API and generator, and the Go and Rust servers and
their tests. Adding a renderer meant finding every list; the framework-independent HTML
renderer was never added to the comparison, partly because of this.

The matrix is now defined once in `examples/form-comparison/src/runtime-paths.json`.
`runtime-paths.mjs` imports it and every JavaScript check uses its exports. The build
publishes the file next to `spec.json`. The Go server (`newServer`) and the Rust server
(`Server::load`) read it once at startup and build their API routes from it, so a
cached-template render still reads no files; their tests load the same file. The PHP
API validates routes with `browserMatrix()` in the new `matrix.php`, and the PHP
generation test iterates it. `FormGeneration::document()` no longer repeats the rendering
path and framework check the API route already makes; a first version that read the
matrix inside `FormGeneration` broke the request-construction checks, which must not
read files, and was replaced by the separate function.

`npm run test:form-comparison` (source 139, library 10, browser job 3), the Go server
tests, the Rust server tests (4), `php -l` for the changed PHP files and `make format-check`
passed; `browserMatrix()` read the rendering paths, frameworks and actions from the file.

### 2026-09-14 — Keep one form snapshot module

`form-snapshot.mjs` and its test existed twice with identical content:
`tests/form-inspector/` (the original) and a copy in `examples/form-comparison/src/`. A
change had to be made in both, and the comparison suite ran the copy's test while CI's
native job ran the original's. The copy and its test are removed. The comparison frame
imports the original, the comparison build publishes the original to the page, and
`test:form-comparison:source` runs the original test, so local checks and the comparison
CI job keep covering it.

`node --test tests/form-inspector/form-snapshot.test.mjs` passed 18 tests and
`npm run test:form-comparison` passed with the original in its source checks.

### 2026-09-14 — Compare browser DOM without attribute order and remove the code that forced it

Running the comparison page's complete check in Safari failed `ssr/restoration`
and `csr/restoration` in the `html` category for Vue with `bindForm` on all four servers,
while every other category, including the parsed DOM, passed. The only difference was one
checkbox: mounted as `checked="" value="1"`, restored as `value="1" checked=""`. The
candidate verification had passed because it runs Chromium only.

The criterion was wrong, not the forms. Serialized HTML exposes the order in which
attributes were created, which the framework and the browser engine decide; attribute
order is not part of the DOM. To satisfy it, three places rearranged attributes for the
test alone and assumed Chromium's order: `connectForm`'s `sync()` moved `checked` last,
the comparison `bindForm` controller recorded and restored each control's attribute
order, and React's `resolvedStyleProps` placed `style` after the rendered attributes.
The corrected rule: string renderers (PHP, the PHP extension, Go, Rust and the HTML
renderer) stay byte-identical, which the generation checks verify; DOM built in a browser
must match as parsed DOM (elements, attribute names and values, text, child order) on any
path and engine; no code rearranges the DOM to satisfy a comparison.

- The initialization comparisons drop the `html` category (seven categories, 168 results
  per report); `formSnapshot` still records the HTML as evidence. The shared
  initialization test compares the snapshot without it, and React's style test compares
  nodes with `isEqualNode`.
- Removed the three attribute-order routines and the controller test that fixed a
  checkbox's attribute order.
- The expected browser totals were written as numbers in the deployment check and two
  tests (456, 2304, 5,808), so the category change left a stale total. They are now
  computed once by `expectedBrowserSections()` in `browser-report-policy.mjs` from the
  browser matrix, and the deployment check and tests use it.

`make format-check`, `npm run test:forms` (core 108, HTML 116, React 350, Vue 341,
Svelte 338 and 10 client tests, 14 Chromium and naming checks),
`npm run test:form-comparison` (source 139, library 10, browser job 3),
`npm run test:build` (9), `npm run test:dependencies` (12), `npm run test:runtimes` (20)
and `make docs-check` passed.

### 2026-09-14 — Build the validator before generator-core in the form comparison checks

The next `main` CI run failed the same job again, one step earlier: building
`@crudui/generator-core` stopped with `Cannot find module '@crudui/validator'`, because
generator-core's declarations import the validator package, which had not been built.
The previous check removed only `packages/generator-core/dist`, so a local validator
build hid it. `test:form-comparison:source` now runs `build:validator` before building
generator-core, the same order `test:forms` uses. With both `packages/validator-ts/dist`
and `packages/generator-core/dist` removed, `npm run test:form-comparison:source` built
both packages and passed 140 tests.

### 2026-09-14 — Run the form suite's Chromium checks with the sandboxed CI Chrome

The same `main` CI run also failed the "Form instances and data injection" job: the six
Chromium style checks that this branch added to `npm run test:forms` could not launch
the browser ("No usable sandbox!"). That job was not a browser job before, so it used
Puppeteer's downloaded Chrome, which has no usable sandbox on the Ubuntu runners, while
the other browser jobs select the regular Chrome at `/opt/google/chrome/chrome`, skip
the Puppeteer download and verify the sandbox with `scripts/check-ci-browser.mjs`. The
job now does the same, and the CI policy test that lists the browser jobs includes it
and checks that `tests/form-styles.test.mjs` never disables the sandbox. Against the
previous workflow the policy test failed with the three missing settings of
`form-runtime`; with the change `npm run test:runtimes` passed 20 tests.

### 2026-09-14 — Build generator-core before the form comparison source checks

After the merge into `main`, the CI job "Form comparison runner regressions" failed:
`examples/form-comparison/src/bind-form-controller.test.mjs` could not load
`@crudui/generator-core/dist/index.mjs`. The comparison `bindForm` controller has used
generator-core's view-state and history functions since this branch, and that CI job
runs `npm run test:form-comparison` on a clean checkout without building packages. It
passed locally only because an earlier build had left `dist` in place.
`test:form-comparison:source` now builds `@crudui/generator-core`, the only package the
comparison sources import, before running, as `test:forms` builds its packages.

With `packages/generator-core/dist` removed, `npm run test:form-comparison:source`
built the package and passed 140 tests.

### 2026-09-14 — Record the screen-sized frame candidate run and its deployment

`node examples/form-comparison/candidate-verification.mjs` passed: PHP, the
PHP extension, Go and Rust each passed 1,452 checks with no failure, and the browser
verification recorded 5,808 checks with no failure. `node
examples/form-comparison/comparison-deployment.mjs --commit <commit>…` deployed it at
`https://crudui.test/` and passed the identical reapplication. In a 798 px browser
window the frame is 798 px tall and the SSR and CSR columns match 8/8. With the page
scrolled to the frame and the frame scrolled by 700 px, the company header is at the
top of the screen on its 0 px line and the store header at 39 px on its 38.5 px line,
both showing their level labels, while the department and Busan headers, not stuck,
hide theirs. A measurement taken right after scrolling, before the page rendered,
still read the labels as hidden; measured again after rendering they showed.

### 2026-09-14 — Size the comparison frames to the screen

After sticky rows became CSS only, the comparison page still behaved differently from a
page. The cause was its layout, not script: each frame was fixed at 1,450 px on a
798 px screen, so the page and the frame both scrolled, and the frame's top edge,
where sticky headers pin, left the screen as soon as the page scrolled. A scrolling box
taller than the screen behaves the same way. Each frame is now `100vh` tall, so its
scroll area is exactly what the viewer sees. Two comments that still said the scroll
position decides the current row (`actions.ts`, `instance.ts`) were corrected; the only
script left around scrolling is focusing a row's control after an action or a map
selection.

The generator-core tests (108) and `npm run test:form-comparison:source` (140) passed.

### 2026-09-14 — Record the CSS-only sticky candidate run and its deployment

`node examples/form-comparison/candidate-verification.mjs` passed. PHP,
the PHP extension, Go and Rust each passed 1,452 checks with no failure, and the
browser verification recorded 5,808 checks with no failure. Earlier runs had stopped:
one failed in the React SSR takeover of sticky rows and one on a Chromium
screenshot error, both fixed or superseded by later commits, and the first run of
this tree failed while building the image because the disk was full. The container
image builder held about 75 GB of build cache from the repeated candidate builds;
`container prune`, `container image prune --all` and deleting the builder (which
rebuilds its cache on the next build) left 83 GiB free, and the running containers
and volumes were not touched. `node examples/form-comparison/comparison-deployment.mjs
--commit <commit>…` deployed it at `https://crudui.test/` and passed the identical
reapplication. In a browser the SSR and CSR columns match 8/8, each frame has four
sticky rows and no `data-crudui-stuck`, `data-crudui-current` or published lengths,
and after scrolling the SSR frame the company header sits on its line with its label
shown while the not yet stuck Busan header hides its label.

### 2026-09-14 — Make sticky rows CSS only and remove scroll measuring

Sticky rows did not behave the same in a frame as in a page because the browser
binding measured the scroll position in script: `connectRows` decided which rows were
stuck and current from bounding rectangles, published lengths for a computed space
after the form, and `alignRow` scrolled rows with `scrollIntoView`, which also scrolls
every enclosing document. Each fix to one of those calculations (the scroll container,
the content after the form) exposed another place where the reference was wrong. Sticky rows now use only what CSS
can do.

- Removed: `connectRows`, `RowTracking`, `markOutline`, `alignRow`, the
  `data-crudui-stuck` and `data-crudui-current` attributes, the `crudui-current` event,
  the structure map's `aria-current` marking, the published
  `--crudui-scroll-height` and `--crudui-form-end-*` lengths, the space after the form,
  the current row border and the rule that showed `controls: outline` on the current
  map line only (map lines now always show their controls). The jsdom stand-in for
  `scrollIntoView` and the takeover comparisons' exclusions for those attributes are
  gone with them, and `contracts/features.json` no longer lists the three functions.
- `crudui.css`: sticky headers still stack on `--crudui-sticky-depth` lines; the level
  label shows only while its header is stuck, through a `scroll-state(stuck: top)`
  container query; controls in a sticky row keep a top scroll margin of the headers
  pinned above them (`--crudui-sticky-cover`) and every form control a bottom scroll
  margin of the footer.
- Moving to a row after a row operation or a structure map selection focuses its
  control, and the browser scrolls it into view (Chromium centres it); the same code
  runs in `connectForm`, `connectOutline` and the comparison `bindForm` controller.
- The Chromium style checks run every case in a page, in a scrolling box and in a
  frame: stacked headers on their lines with labels only while stuck, and focus after
  adding a row and after a map selection clear of the pinned headers and the footer.

`make format-check`, `npm run test:forms` (core 108, HTML 116, React 350, Vue 341,
Svelte 338 and 10 client tests), `npm run test:form-comparison:source` (140),
`npm run test:build`, `npm run test:dependencies`, `make docs-check` and the Chromium
style checks (6: two in each host) passed. The last `make docs-check` run first failed
because the disk was full while rebuilding the Rust crates; after removing the stopped
candidate container, image and directory it passed.

### 2026-09-14 — Take over sticky rows identically in React

A candidate run failed in `browser-php`: the SSR takeover in React
differed on the first sticky row, whose style the server writes as
`--crudui-sticky-depth:0` and React as `--crudui-sticky-depth: 0;`. The local shared
takeover test had not caught it because its specification had no sticky rows; only the comparison example declared sticky rows.

- A `style` attribute is a CSS declaration block, so the takeover comparison, in the
  comparison frame and in `compareServerTakeover`, compares it as the CSS object model
  serializes its declarations.
- The shared form session specification declares sticky rows for companies and stores,
  so the React, Vue and Svelte form tests render and compare them.
- That exposed an earlier React fault: `resolvedStyleProps` removed and
  re-added the style attribute each time React called its ref, on every render, so a
  re-rendered row's style moved after the `data-crudui-current` attribute the browser
  binding had written, and a form given its data later differed in raw HTML from one
  created with it. The style attribute is now placed after the rendered attributes
  only when an element first connects, and later declarations replace it in place.

`make format-check`, `npm run test:forms` (core 108, HTML 116, React 350, Vue 341,
Svelte 338 and 10 client tests), `npm run test:form-comparison:source`,
`npm run test:build`, `npm run test:dependencies`, `make docs-check` and the Chromium
style checks (5) passed.

### 2026-09-14 — Count the content after the form in the trailing space

The trailing space after the form ignored the content that already follows the form in
its scroll container. In the comparison frame, where the results follow the form, it
added 1,037 px (the 1,448 px frame less the 362 px end-row extent and the 49 px footer),
leaving a blank area between the form and the results, and the end row scrolled past
its line by the height of that content. The rule now subtracts the content after the
form, apart from the form's own margin, measured by `connectRows` and published as
`--crudui-form-end-after`, and never goes below zero. Scrolling stops with the end row
on its line when the content after the form is shorter than the space it needs, and
longer content scrolls into view with no space added. The documentation no longer
describes the limit as exact only when nothing follows the form.

Two Chromium checks cover it: 60 px of content after a form in a scrolling box, where
the end row stopped 60 px past its line before the change (27 px against 87 px), and
600 px of content, where no space is added and the content scrolls to its end.

### 2026-09-14 — Apply the sticky rules in any scroll container and declare sticky rows in the comparison example

The comparison page showed no sticky headers because its example specification did
not declare `multiple.header: sticky`; the local preview declared it, so the same
generator behaved differently between the two examples. Checking why exposed a fault
that would appear wherever a form sits in a scrolling box, a dialog or a frame rather
than the page: `crudui.css` computed the trailing space after the form from `100vh`,
the page viewport, while the sticky headers follow their scroll container, and
`connectRows` treated an ancestor as the scroll container only while its content
already overflowed, unlike `position: sticky`. In a 420 px scrolling box inside a
700 px page, scrolling went on until the end row was 193 px above the box instead of
stopping with it on its 87 px line.

- `connectRows` resolves the scroll container as `position: sticky` does (the nearest
  ancestor whose vertical overflow is `auto` or `scroll`, otherwise the document) and
  publishes its height as `--crudui-scroll-height` with the two end-row lengths;
  `crudui.css` uses it in place of `100vh`. The SSR takeover comparisons leave it out
  with the other binding state. A DOM without `scrollingElement`, such as jsdom, uses
  its root element as the document scroller, and the comparison controller test's
  stand-in document has a root element like a real one.
- The comparison example declares `header: sticky` and `title: name` for companies,
  stores and departments, so every server and framework renders and compares sticky
  rows.
- A Chromium check mounts a form in a scrolling box and verifies stuck headers on
  their lines, no scroll pull-back, the end row stopping on its line and being current,
  and the published height. Before the change it failed with the end row at −193 px
  against its 87 px line.

### 2026-09-13 — Record the passing SSR/CSR candidate run and its deployment

`node examples/form-comparison/candidate-verification.mjs` passed. PHP,
the PHP extension, Go and Rust each passed 1,452 checks with no failure, including
192 initialization comparisons per server, rendering path and framework with the SSR
takeover. The browser verification recorded 5,808 checks with no failure. The first
run stopped during image construction because the disk was full; the Go
build cache and temporary check directories were removed and the same commit was run
again. `node examples/form-comparison/comparison-deployment.mjs --commit <commit>…`
deployed it at `https://crudui.test/` and passed the identical reapplication. In a
browser the page shows the SSR and CSR columns (side by side above 1,000 px wide)
with 8/8 comparisons matching for PHP, React and bindForm.

### 2026-09-13 — Use the SSR and CSR column names in the browser interaction checks

A candidate run failed in `browser-php` before any interaction ran: the
interaction check still looked for the frame with `initialization=data`, and the initial
mount check still looked for `initialization=inject`, the column names that `ssr` and `csr` replaced.
The interaction check now uses the `ssr` frame, the initial mount check the `csr` frame,
and the report test fixture the `ssr` column. These checks run only inside the candidate
container, so the local source checks (140 passed) did not reveal the old names.

### 2026-09-13 — Restore the React form session tests removed with the legacy UI

An earlier change deleted `packages/generator-react/src/__tests__/Form.test.tsx` together with
the legacy FormBuilder test in the same file, so React stopped running the shared
initialization, session DOM, control and focus scenarios that Vue and Svelte run. The
file is restored without the legacy test and also runs `compareServerTakeover`.
React passes 350 tests.

### 2026-09-13 — Make Vue and Svelte take over server-rendered forms without changing them

The first candidate run failed in the SSR column. Vue keeps comment nodes as
anchors for conditional blocks, and Svelte 5 kept the whitespace between sibling
elements of its templates as text nodes, left empty text anchors, and did not write the
`value` attribute of inputs, the text of textareas or the `checked` attribute of
checkboxes into the browser DOM. Comments and empty text render nothing, so the takeover
comparison leaves them out in the comparison frame and in a new shared test,
`compareServerTakeover`, which the Vue and Svelte form tests run against the HTML
renderer's output for the same session. The Svelte templates are written without
whitespace between sibling nodes, and inputs, textareas and checkboxes set both the
server attribute or text and `defaultValue`/`defaultChecked`, so Svelte's server output
and its browser DOM equal the other renderers'.

`make format-check`, `npm run test:forms` (core 108, HTML 116, Vue 341, Svelte 338 and
10 client tests), `npm run test:form-comparison:source`,
`npm run test:build`, `npm run test:dependencies`, `make docs-check` and `svelte-check`
passed. The candidate verification is recorded in a separate entry.

### 2026-09-13 — Compare server-side and client-side rendering on the comparison page

The comparison page showed two client-side columns, "create with data" and "mount,
then inject data", so it never showed that the server languages and the browser
frameworks render the same form. The columns are now SSR and CSR. In the SSR column
(`initialization=ssr`) the selected server (PHP, the PHP extension, Go or Rust)
renders the form with the saved record, the frame places that HTML in the page, and
the selected framework takes the form over with the same template and data; the
takeover must leave the parsed form DOM (every element, attribute value, text and
comment) unchanged, apart from the state the browser binding writes
(`data-crudui-stuck`, `data-crudui-current` and the end-row lengths). The first
candidate run compared serialized HTML and failed only on attribute order: React sets
an input's `type`, `value` and `name` after its other attributes. Attribute order is
not part of the DOM, and the string renderers' byte-identical HTML stays covered by the
generation checks, so the takeover compares the parsed DOM.
The CSR column (`initialization=csr`) mounts the form without data and injects the
record. Every stage is then compared between the columns as before. The comparison
labels, the SSR document links, the frame readiness and typing checks and the
documentation use the new names.

The form comparison source checks passed 140, the Go and Rust comparison server tests
passed, and `make docs-check` passed. The SSR takeover itself runs only in the
four-server candidate verification, recorded in a separate entry.

### 2026-09-13 — Record the passing four-server candidate runs for crudui.css and the legacy removal

`node examples/form-comparison/candidate-verification.mjs` passed for form
styling with `crudui.css` alone and for the tree after removing the legacy UI paths
and fixing the build and dependency checks). In each run PHP, the PHP extension, Go
and Rust passed 1,452 checks with no failure, the browser verification recorded
5,808 checks with no failure, and the command returned status 0.

### 2026-09-13 — Fix the build and dependency checks that CI runs

`npm run test:build` and `npm run test:dependencies` were failing, and the form
suites used during this work did not run them:

- `tests/build/public-types.mts` and `public-types.cts` still named `FieldShape` and
  `MultipleSettings`, which the node view model removed. They now name the current
  public types `NodeVM` and `ButtonVM`.
- The form comparison controller imports `@crudui/generator-core`,
  but the root package did not declare it. The root package now declares the
  workspace package as a development dependency.
- `tests/build/package-install-pack.test.mjs` passed paths that do not exist, while
  `packPackage` reads the source manifest to check the package name.
  The tests now write a manifest in a temporary directory.

`npm run test:build`, `npm run test:dependencies` and `npm run test:runtimes` passed,
as did every `tests/build` and `tests/docs` test (67).

### 2026-09-13 — Remove the Bootstrap-based legacy UI paths

The legacy form components and the earlier rendering comparisons were
built on Bootstrap and are replaced by the node grammar and `crudui.css`. They are
removed rather than kept beside the current path:

- `@crudui/generator-react/legacy`, `@crudui/generator-vue/legacy` and
  `@crudui/generator-svelte/legacy` with their sources, the React
  `@crudui/generator-react/styles.css` stylesheet, and the tests that exercised them
  (16 React tests, the Vue and Svelte parity tests and captures, the Svelte legacy
  component test);
- the earlier demo, playground and rendering-comparison examples and `react-usage.tsx`, with their
  compose services and README entries;
- `tests/cross-framework`,
  the CI parity job, whose Vue and
  Svelte steps repeated the form-render job;
- the `lucide-react` and `yaml` dependencies of the React, Vue and Svelte packages,
  which only the legacy components used.

The legacy specification translation and validators (`@crudui/validator/legacy`
and its PHP, Go and Rust counterparts), the legacy validation API examples and their
shared specifications stay: they validate data and render nothing. The public
package test now checks that `@crudui/generator-core/crudui.css` is the only exported
stylesheet.

After the removal `npm run build`, `npm run lint` and the Svelte type check passed.
generator-core and HTML still passed 108 and 116 tests; React, Vue and Svelte passed
347, 341 and 338 (358, 7 and 11 fewer: the removed legacy tests), the Svelte client
10 and the Node checks 11. The form comparison source checks passed 140, the new
stylesheet export check passed, and `make docs-check` passed after the legacy schema
and visibility documents stopped linking the removed React sources. The same run
showed that the declaration compile check in `tests/build/public-packages.test.mjs`
and two dependency and pack checks were already failing; the next entry fixes them.

### 2026-09-13 — Style a form with crudui.css alone: widgets use the crudui grammar instead of Bootstrap

Widget markup still used the Bootstrap vocabulary
(`form-control`, `form-select`, `input-group`, `input-group-text`, `btn`,
`btn-group`, `btn-check`, `btn-switch`, `flex-wrap`, a `data-toggle="buttons"`
attribute, and `p-0 border-0` on an unframed language group), and the core
stylesheet did not style any of it. The preview loaded Bootstrap from a CDN and the
comparison page styled the controls inside `#view`, so a form looked right only with
styles from outside the library. Widgets now follow the class grammar in all five
implementations and eight renderers: `crudui-widget` with `__affix`, `__button`,
`--search` and `--unsupported`; `crudui-input` with `--select` and `--file`;
`crudui-choices` with `__input`, `__label` and `--multiple`; an action widget button
is `crudui-action crudui-action--text`; and a framed language group is
`crudui-node--framed`. The widget model layouts `input-group` and `btn-group` are
now `widget` and `choices`. The only other classes a renderer writes are the
validation hooks `valid-target` and `valid-target-async`, the editor hosts and the
classes a spec declares, and the naming check now fails on any other class.

The core stylesheet is `@crudui/generator-core/crudui.css` (the `./styles.css` export
is removed). It styles every widget, and every rule is scoped to a crudui block,
including box sizing and hiding `[hidden]` elements. Pages style only their own
layout: the preview keeps its layout in the page and no longer loads Bootstrap, the
comparison page stylesheet no longer styles anything inside `#view`, and the SSR
documents of the comparison servers load `crudui.css`. The Go and PHP package
examples also take the form styles from `crudui.css` and no longer append their own
submit button, which duplicated the form footer's.

`make format-check` passed. generator-core, HTML, React, Vue and Svelte passed 108,
116, 705, 348 and 349 tests with the regenerated form-render and structure map
fixtures, the Svelte client 10, and the Node checks 11, including the naming check
that rejects classes outside the grammar. `make test-native` passed all 976 generator
checks (195 per implementation) with PHP API checks 361 per configuration and 103
validation cases. The comparison Go and Rust server tests, the comparison source
checks 140 and its Chromium checks 3, and `make docs-check` passed. In Chrome the
preview loads two stylesheets, its own layout and `crudui.css`, and renders inputs,
selects, textareas, checkboxes, language frames, the structure map and the footer
buttons without Bootstrap.

### 2026-09-13 — Format every Rust crate and Go file, and check it with `make format-check`

No check ran rustfmt or gofmt, so formatting drifted: five Rust crates had 62
rustfmt differences (54 in generator-rust, including code from the recent form
changes) and two Go files had gofmt differences. `tests/runner/go/run_test.go`
repeated its import alias (`validator validator "…"`) and did not compile at all.
All crates and files are now formatted and the import is fixed. `make format-check`
runs `cargo fmt --check` for every tracked `Cargo.toml` through the shared Rust
command entry point and `gofmt -l` for every tracked Go file, and fails on any
difference. The comparison Rust server test that compiles the spec by reference now
keeps `buttons` on the root, as the comparison checks do.

`make format-check` passed. generator-rust passed 20 and 4 tests, validator-rust
all its test targets, the comparison Rust server 4, `go test` for the legacy Go
validator and the Go test runner passed, the legacy Rust API and the Rust bench
built, and `make test-native` passed all 976 generator checks.

### 2026-09-13 — Record the passing four-server candidate run for the buttons and scrolling changes

`node examples/form-comparison/candidate-verification.mjs --ref <commit>` passed:
PHP, the PHP extension, Go and Rust each passed 1,452 checks with no failure, the
browser verification recorded 5,808 checks with no failure, and the command returned
status 0. It covers the form buttons, the naming and DOM scenario checks,
rendering nothing while scrolling and the two comparison fixes
the earlier runs found: one run failed in the PHP generation test
and the next failed in the reference compilation check; both are fixed.

### 2026-09-13 — Scrolling renders nothing: the current row is no longer instance state

Scrolling past a row made it current, and `connectForm` then called
`selectRow`, which published a new snapshot. The views re-render on every
snapshot, so each row boundary crossed while scrolling replaced the whole form, the
structure map and the data view, and restored the focused control and its text
selection. With a control focused, the scroll was pulled back toward it. The
selection existed only to mark the map, so it is removed rather than guarded:
`FormInstance.selectRow`, the snapshot and view state `selection`, `RowSelection`,
`selectRowView` and `OutlineRow.current` are gone, and `setAllExpandedView` takes
only the nodes and the expansion. `connectRows(element)` tracks only form rows (map
rows carry their own `data-field-path`) and dispatches `crudui-current` when another
row becomes current. The new `markOutline(outline, form)` sets `aria-current` on the
map row of the form's current row; `connectOutline` calls it on that event and
whenever the map is rendered again, and the comparison `bindForm` controller calls it
for its map. `select-row` changes no state: `runAction` returns the row to move to and
the binding aligns it. With `multiple.controls: outline` the map renders every row's
controls and the stylesheet shows those of the current row.

The Chromium style checks now render the structure map next to the form and assert
that scrolling through the rows renders nothing and that the map marks exactly the
current form row at every step. A puppeteer probe of the preview, with two members
added and a control focused, measured one or two full renders per scroll gesture
before the change and none after it. generator-core, HTML, React, Vue and Svelte
passed 108, 116, 705, 348 and 349 tests with the regenerated structure map fixture,
the Svelte client 10, the Node checks (normalizer, styles and naming) 11, the form
comparison source checks 140 and its Chromium checks 3, and `make docs-check` passed.

### 2026-09-13 — Check the markup naming rules and the collapse and undo DOM paths

The class naming rules of the form markup (N1–N3: `crudui-{block}`,
`__{element}`, `--{modifier}` with its block, parts inside a node header, nodes
inside a body) were documented but not checked. `tests/form-markup/naming.test.mjs`
now checks every `crudui-` class in the form render and structure map fixtures
against the allowed blocks, elements and modifiers, and rejects five broken samples;
`npm run test:forms` runs it. The shared DOM scenario also collapses and expands
every row, checking each toggle's `aria-expanded` and the `hidden` body it names
with `aria-controls`, and undoes an edit, checking the control and instance values.

The naming check passed 2 tests, and React, Vue and Svelte ran the extended scenario
in their 705, 348 and 349 passing tests.

### 2026-09-13 — Form buttons in a pinned footer, and the space after the form outside it

Specs declare form buttons at the root (`buttons`, with a submission `action`), but
the schema rejected them and compilation kept only `properties`, so declared save,
cancel and back buttons disappeared. Buttons are now part of the form contract in
all five implementations. `buttons` is a list of `{ type: submit | reset | button |
link, text, name, value, href, design, behavior }`; a spec without `buttons` gets one
submit button. Submit and reset default to interface text; a button or link needs
`text` and a link needs `href`. `action` (`method`, `url`, `enctype`) is kept in the
template. Both are rejected below the form root. The template
carries `buttons` and `action`, `bindButtons` evaluates them and the snapshot holds
them, and every renderer puts them in `crudui-form__footer`, one controls group whose
markup comes from `formButtonsHtml`. The footer pins to the bottom of the scroll
container at `--crudui-form-footer-height`, as sticky row headers pin to the top. The
JSON schema, the four validators, the CLI and the legacy translator accept the
declarations.

The row at the end of the form now reaches its line through space outside the form
instead of a minimum height inside the last row, which left a blank inside nested
cards. `connectRows` publishes two measured lengths on the connected element (the
extent from that row's top to the end of the form content, and its aligned top), and
the stylesheet gives `.crudui-form` a bottom margin of the viewport less those lengths
and the footer. Publishing on the form element itself let a re-render drop the
margin and pull the scroll back; the connected element is never replaced.

The form comparison servers (PHP, PHP extension, Go, Rust) appended their own
`_form_complete` submit button after the rendered form, which now rendered a second
submit button in its footer. The comparison spec, and the specs of the Go, Rust and
PHP generation tests, declare that button instead, the servers no longer append one,
and the generation checks require exactly one submit button in the document. The
first four-server candidate run of this change failed in the PHP generation test,
whose own spec did not yet declare the button. The second failed in the generation
check that compiles the published spec through a reference: it put the whole spec,
buttons included, in the referenced file, and composition takes only its fields, so
the referenced template got the default button. The frames compile through the
servers the same way, so their templates silently dropped the declared button too.
Both now keep the root declarations on the root and reference only the fields.

Validation passed: generator-core, HTML, React, Vue and Svelte passed 108, 116, 705,
348 and 349 tests, the Svelte client 10, the normalizer 6 and the Chromium style
checks 3. `make test-native` passed all 976 generator checks, with 361 PHP API checks
per configuration and 103 validation cases. The JSON schema passed 70 checks, the
TypeScript and PHP validators 1629 and 1461, the Rust validator 62, the Go validator
and the CLI 37. The PHP extension engine passed 22 tests, the cross-check console 117,
the form comparison source checks 140 and its Chromium checks 3, the Go and Rust
comparison server tests passed, and `make docs-check` passed. In Chrome the end row
stopped 0.2px from its line without a minimum height, and the space after the form was
a 200px margin outside it.

### 2026-09-13 — Show only form rows in the structure map

The structure map repeated every level twice: a collection line with its count
(for example "Stores 2") and then the row lines, each with its own guide line, and
it listed empty collections. It now follows one rule: one line per form row.
`buildOutline` returns `OutlineRow[]`, each row with the rows nested in it, so the
map nests exactly as the form does; `OutlineCollection` is removed. Collections,
counts and empty collections are not rows and stay in the form, and a nested row
body indents one step without guide lines. With `multiple.controls: outline`, row
controls still move to the selected row's map line, but an empty collection's Add
control is not a row control and now always stays in the collection footer in all
five implementations.

generator-core passed its typecheck and 104 tests; the HTML, React, Vue and Svelte
suites passed 116, 705, 348 and 349 with the regenerated structure map fixture;
form comparison source checks passed 140; and `make test-native` passed 976 generator
checks after the empty collection placement change in all five implementations. In
Chrome the map lists only rows with one indentation step per level. The four-server
candidate run for the previous change passed 1,452 checks per server
(5,808 browser checks) with no failure.

### 2026-09-13 — Align rows to their sticky line and follow the scroll with the current row

Sticky rows now follow rules derived from one value instead of computed offsets.
The row root carries `--crudui-sticky-depth` (moved from the header style in all
five implementations), and its sticky line is that depth times the header height.
The header pins on the line; the row's `scroll-margin-top` puts the header on the
line, so `alignRow` is `scrollIntoView({ block: 'start' })`; and the last row is at
least the viewport below its aligned top, so scrolling ends exactly when its header
reaches the line. An earlier draft of this change added one viewport of trailing
space, which let the page scroll past that point; it is not kept.

One rule decides the current row: the scroll position. `connectRows` marks rows
whose top reached their line (`data-crudui-stuck` on sticky rows) and the current
row, the last such row (`data-crudui-current`, with a highlighted border); the
selected row and the structure map follow it. Moving to a row after a row operation
or from the structure map scrolls it to its line. Focus no longer selects or scrolls,
and the bindings no longer restore scroll positions. A draft that also aligned the
row of a newly focused control, and restored captured scroll positions after
rendering, pulled the page back to the focused row when the user scrolled to the end
with an input focused elsewhere; both are removed. The comparison page controller
uses the same core functions.

`npm run test:forms` passed core 104, HTML 116, React 705, Vue 348, Svelte 349, ten
normalizer checks and nine node checks, including three Chromium checks: stacking at
exact header heights, the current row following the scroll with focus elsewhere, and
the end row stopping exactly at its line with no blank inside rows. Form comparison
source checks passed 140 and its Chromium checks 3. `make test-native` passed 976
generator checks after the depth moved to the row root in all five implementations.
`make docs-check` passed. In Chrome, with focus in the company name, wheel scrolling
reached the end without any backward jump, kept the focus, made 판교점 current and
stopped its top 0.2px from its aligned position.

### 2026-09-13 — Stack sticky row headers at their exact height

Sticky row headers (`multiple.header: sticky`) stack by offsetting each level by
`--crudui-node-header-height`, but a header's real height was its padding, content
and bottom border: 45px against a 44px offset in the reference preview, and more
when a long title or the controls wrapped. Each pinned level overlapped the one
above. A sticky header now has exactly that height, border included, never wraps,
and truncates a long title, so pinned levels meet without overlap. A stuck header
gets a solid background and a shadow, and its level label still shows only while
it is stuck. Stuck detection used an IntersectionObserver with thresholds 0 and 1,
which never fires for a row taller than the viewport, so the outermost pinned
level showed no label. `connectForm` now marks a header stuck when it has left its
natural place at the top of its row, measured on scroll and resize at most once
per animation frame. A Chromium check, `tests/form-styles.test.mjs`, runs in
`npm run test:forms` because jsdom has no layout. The form-structure preview declares sticky headers on all five
levels, which it did not before, so the sequential pinning was not visible there.

`npm run test:forms` passed core 104, HTML 116, React 705, Vue 348, Svelte 349, ten
normalizer checks and seven node checks, including the new Chromium check. That
check timed out waiting for the outermost stuck header before the detection change.
In Chrome the preview pinned all five levels in order with their labels and no
overlap.

### 2026-09-13 — Fix comparison checks that failed the four-server candidate run

The first candidate run of the initialization comparison failed 36 of 1,452 PHP
checks, and the other servers did not run. The empty-collection scenario step
excluded the Add button of a collection inside a row; that condition came from
the recursive node change. The bindForm controller focused the new row before
scrolling it, so the selection render restored the earlier scroll positions and
left the input outside the frame. It now scrolls first, like core. The createForm
checks asserted that the main page does not scroll, which contradicts the row
focus rule for a 1,450px frame; the checks now require the focused input to be
visible in both the frame viewport and the main page viewport. The local source
and Chromium suites do not run these checks; only candidate verification does.

The candidate run then passed: PHP, the PHP extension, Go and Rust each
passed 1,452 checks with no failure, 5,808 browser checks in total, and the command
returned status 0.

### 2026-09-13 — Compare the two initialization paths side by side

The form comparison page now puts the two initialization paths in two columns:
the left frame creates the form with its data, and the right frame mounts an
empty form and then injects the data. The API choice (bindForm or createForm)
moved to a selector, next to the server, framework and language selectors.
Both columns run the same stages with the same fixed row keys: mounting,
repeated injection, hiding and restoring data, editing, saving, reloading,
copying, moving, removing, adding, saving the new row, emptying, restoring,
and the structure map's expand all, collapse all and undo. The columns run
one after the other because both save to the same record, and each right
stage is compared with the stored left stage. Raw HTML, DOM, control state,
fields, computed CSS, submitted data, focus and save responses are compared
without normalization. The list at the top updates as each stage completes.
The frames load the grammar stylesheet, so computed CSS reflects the real
styles. The in-frame initialization check is removed.

The bindForm path now supports the same actions as createForm (toggle, select,
expand all, collapse all, undo) with the same view state, history and focus
rules. generator-core exports those rules as pure view-state and history
functions, which the form instance and the bindForm controller both use. Both
paths render the structure map and the data view in their frames. React, Vue
and Svelte provide stateless `OutlineView` and `DataPanel` (Vue: `outlineVNode`,
`dataVNode`), and the HTML renderer adds `renderOutlineView` and
`renderDataPanel`. A shared fixture, `tests/fixtures/form-outline/cases.json`,
holds the React markup for four languages, top-level and nested selection,
`controls: outline` and data escaping, and all four renderers reproduce it. The
feature contract manifest records the view-state and history functions and the
new fixture.

`make test-native` passed 976 generator checks (195 per implementation), 361
PHP API checks per configuration and 100 validation cases in each PHP
implementation. `npm run test:forms` passed core 104, HTML 116, React 705, Vue
348, Svelte 349 and ten normalizer checks. The structure map fixture passed four
cases in each of the four renderers. Form comparison source checks passed 140
and the Chromium checks passed 3. `make docs-check` passed after documenting the
`UndoResult` type, a type-only change made after the native run. The full
candidate run with the four servers had not run when this change was committed.

### 2026-09-13 — Move focus to the affected row after row operations

Row operations previously kept the active control, its text selection and the
scroll positions, and a pointer press on a row button was prevented from moving
focus. The runtime now follows the focus rule of the reference form: adding or
copying focuses the new row, moving focuses the moved row, and removing focuses
the previous row, then the next row, then the enclosing row, then the collection's
Add button. Focus goes to the row's first enabled visible input, or to its toggle
or Add button, and the row scrolls only as far as needed. Toggling, selecting and
undoing keep the focused control, including a focused action button. Pointer and
keyboard activation behave the same. `runAction` returns `{ focus }` for the row
that receives focus, or `undefined` when the target is incomplete.

generator-core passed its typecheck and 102 tests. `npm run test:forms` passed
HTML 112, React 701, Vue 344, Svelte 345 and ten normalizer checks, with the shared
DOM scenario asserting the focused row after add, remove, copy, move, toggle and
removal of the last row. jsdom does not implement scrolling, so the tests stub
`scrollIntoView`. In Chrome, the form-structure preview focused the new row after
an add and the previous row after a removal. Instrumenting the calls showed the
row scrolls before focus, which prevents scrolling elements that a synchronous
re-render replaces. The automation tab did not scroll the window, so actual
viewport placement was not measured there. The comparison page focus checks move
to the same rule in the next change.

### 2026-09-13 — Render forms as recursive nodes with row cards

Every form renderer (HTML, React, Vue, Svelte, PHP, Go, Rust and the C PHP
extension) now produces one recursive node grammar instead of per-shape wrappers.
Each field, group, collection, row, language field and language item is a
`crudui-node` with `__header`, `__body` and `__footer` slots. Kinds are modifiers
(`crudui-node--row`), and behavior reads only `data-field-path`,
`data-crudui-row-key`, `data-lang`, `data-crudui-action`, `hidden` and ARIA
attributes. `bindForm` returns `NodeVM[]` with the same JSON model in every
implementation. The [form markup](docs/spec/form-markup.md) specification defines
the grammar and records the reference-form behavior that was not adopted.

- **Row cards:** rows show a hierarchical number, an optional title from
  `multiple.title`, and a count or nested-row summary. Move, add, copy and remove
  controls come in a fixed order, with disabled states computed from `min`, `max`
  and position in every renderer; the browser no longer adjusts them after
  rendering. `multiple.controls` (`header`, `footer`, `outline`) and
  `multiple.header` (`static`, `sticky`) are declared in the JSON schema, the four
  validators and the CLI.
- **Messages:** control labels, counts and summaries come from one ko/en/ja/zh
  table shared by all implementations.
- **Runtime:** form instances keep collapsed rows, the selected row and an undo
  history (100 entries, consecutive edits of one path merged) outside the record
  data. `buildOutline`, `connectOutline`, `resolveAction` and `runAction` are
  exported. React, Vue and Svelte provide `Outline` and `DataView`, and the HTML
  renderer provides `renderOutline` and `renderData`.
- **Styles:** `@crudui/generator-core/styles.css` holds the grammar styles.
- **Input rules** in all five implementations: `lang` must be a boolean or an
  object and `lang.only` a list of language-code strings or an object, at
  compilation. Binding rejects, in order, a non-string language, a non-string
  `keyPrefix` or `idPrefix`, an `unsupported` other than `throw` or `marker`, and
  an unsupported language. Previously TypeScript crashed on `lang: null`, the C
  extension read past its default language list for non-string `only` entries,
  and TypeScript treated any `unsupported` string other than `throw` as marker
  mode while PHP threw.
- **API changes:** Go `BindOptions.Language`, `IDPrefix`, `KeyPrefix` and
  `Unsupported` are `any`, `KeyPrefixProvided` is removed, and an empty `IDPrefix`
  is used as given. Rust `BindOptions` string options are JSON values.

`examples/form-structure` is a local preview of a five-level reference form.
The form comparison page, the shared DOM scenario and the cross-check console
now select by attributes.

`make test-native` passed 976 generator checks (195 per implementation plus the
unchanged-input check), 361 PHP API checks per configuration and 100 validation
cases in each PHP implementation, after reinstalling the copied PHP validator. `npm run test:forms` passed core 101, HTML 112, React 701, Vue 344,
Svelte 345 and ten normalizer checks. Form comparison source checks passed 137,
the cross-check console passed 117 after rebuilding the Go and Rust validator
binaries, and `make docs-check` passed.

### 2026-09-13 — Remove check directories after passing runs

`tests/native-generators/run.mjs` created a `crudui-native-generators-*` build
directory on every run and never removed it. `scripts/check-packages.mjs` left a
145 MB `crudui-install-*` project after every run. Repeated runs helped fill the
disk. A passing run now removes its directory. A failing run keeps it, prints its
path, and records it in the report (`buildDirectory`) or with `failure.log`. The
other test files already removed their temporary directories.

`make test-native` passed 886 checks and left no build directory.
`npm run test:packages` passed and left no install project. `make docs-check`
passed.

### 2026-09-13 — Reject wrong multiple and design value types at compilation

Form compilation in TypeScript, PHP, Go, Rust and the C PHP extension previously
ignored a wrong value type in `multiple` and `design`: row settings with the wrong
type were dropped, and an invalid design became an empty design. Compilation now
rejects them with `INVALID_FORM_INPUT` and `Invalid {key} at {path}: expected
{expected}`, where `{path}` is the field's structural path. `multiple` must be a
boolean or an object, with numeric `min` and `max` and boolean `copy` and
`sortable`. `design` must be a boolean or an object. Its `show` must be an
expression, a boolean or a condition map. Its `class` and `style` and those of the
`label`, `wrapper`, `group` and `prepend` nodes must be strings or condition maps,
and the nodes must be objects. A condition map is a non-empty object, as the JSON
schema requires. Unknown keys in these buckets are not checked. The schema
specification documents the rules.

The C template builds messages with a local helper because its engine tests link
only the value, error and composition modules. The native suite adds eight
compile rejections compared as complete records.

`make test-native` passed 886 generator checks (177 per implementation), 361 PHP
API checks per configuration and 100 validation cases in each PHP implementation.
generator-core passed its typecheck and 89 tests; `npm run test:forms` and
`make docs-check` passed.

### 2026-09-13 — Reject generator data with the wrong shape at its full path

`bindForm` and editable instances in TypeScript, PHP, Go, Rust and the C PHP
extension now apply the validators' data shape rules. Root data that is not an
object fails with `Form data must be an object`. A present group value or
repeated group row that is not an object fails with `Group data must be an
object: {path}`. A present repeated value that is not a keyed object fails with
`Repeated data must be a keyed object: {path}`. `{path}` is the full data path,
including row keys; instances previously reported only the field name, and
`bindForm` did not check group data. `addRow` checks a supplied group row value
at `{collection}.{key}`. The form runtime specification documents the rules and
check order. The form comparison controller's copy of instance normalization
uses the same messages and has a test for them.

The native suite checks eight data shapes through both `bindForm` and instances,
and the rejected-operation scenario adds nested `setValue` and `addRow` cases.

`make test-native` passed 846 generator checks (169 per implementation), 361 PHP
API checks per configuration and 100 validation cases in each PHP implementation.
generator-core passed its typecheck and 88 tests, the form comparison controller
passed 5 tests, and `npm run test:forms` and `make docs-check` passed.

### 2026-09-13 — Compare generator error messages across implementations

The native generator suite compared only error code and location, and its README
allowed messages to differ by language. That contradicts the requirement that all
implementations behave identically, so the rule now requires matching code,
message and location. Rejected form inputs are compared as complete records
against JavaScript.

The stricter comparison found 12 existing differences, now fixed:

- The PHP, Go and Rust generator CLIs reported non-object `data` as `Data must be
  an object`, `Group data must be an object` and `data must be an object`. All now
  report `Form data must be an object`.
- Go and Rust worded unsupported field types differently. Both now report
  `Unsupported field type "{type}" at "{path}"`.
- Go named `SequenceRowKey` in the invalid row key message; it now names
  `sequenceRowKey` like the other implementations.

`make test-native` passed 786 generator checks, 361 PHP API checks per
configuration and 100 validation cases in each PHP implementation.

### 2026-09-13 — Report validator load and input failures identically

The TypeScript, PHP, C PHP extension, Go and Rust validators reject submitted
data with the wrong shape as an input failure instead of skipping it or
converting it. Root data must be an object (`Form data must be an object`),
checked before composition. A present group value or repeated group row must be
an object (`Group data must be an object: {path}`). A present repeated value must
be a keyed object (`Repeated data must be a keyed object: {path}`). Each language
has `FormInputError` with code `INVALID_FORM_INPUT` and an empty location; Rust
returns `ValidateError::Load` or `ValidateError::Input`. Keyed rows are traversed
in sorted key order everywhere.

All four validator CLIs now share one process contract. A result exits 0 with
`{valid, errors}`, a load or input failure exits 2 with exactly
`{error, code, at}`, and a malformed request exits 1 with `{error}`. Before this
change, TypeScript and Go exited 1 without `at`, and PHP exited 0 with a
`rule: "compose"` error. Validation fixtures replace `expectLoadError: {code}`
with `expectFailure: {code, message, at}` and add six input-failure cases. Former
array-row cases use keyed rows. The fixture generator now contains the seven
end-date cases that had been added only to `cases.json`, so they are
no longer dropped on regeneration. The cross-check console compares the complete
`failure` record. The comparison and example servers answer an input failure with
HTTP 400.

Comparing complete records exposed a Go-only divergence. Go list validation
prefixed forbidden-key locations with `list.`, and a Go test pinned that
prefix. The shared list fixture and the other implementations use
`columns.<name>`, so Go now does too.

The C extension's allocation-failure fixture uses keyed rows, which need 4 and 3
allocations. Engine fixtures now emit only the C helpers they call. Before
testing, the ignored Go and Rust CLI binaries used by the console were rebuilt,
and generator-php's copied validator was reinstalled; all three predated the
source changes.

TypeScript validator 1618, PHP validator 1458, `go test ./...`, `cargo test` and
cross-check console 117 tests passed. `make test-native` passed 786 generator
checks, 361 PHP API checks per configuration and 100 validation cases in each PHP
implementation. `make docs-check` passed.

### 2026-09-13 — Bind repeated rows from keyed objects only

`bindForm` in TypeScript, PHP, Go, Rust and the C PHP extension creates repeated
rows only from keyed objects. Missing collection data creates one row keyed
`__0000000000000__`. An array, null or scalar collection fails with
`INVALID_FORM_INPUT` and the message `Repeated data must be a keyed object:
{path}`. Field paths no longer carry `#N` array-position segments, so the
position helpers were removed from all five implementations. Go's unused
`rowPosition` function was removed. The shared form fixture uses keyed data, and
the HTML conformance suite now includes the former array cases.

`npm run test:forms` passed (core 88, HTML 112, React 701, Vue 344, Svelte 345,
normalizer 10). `make test-native` passed 786 generator checks, including new
checks that require identical rejection code, message and path in all five
implementations. `make docs-check` passed.

### 2026-09-13 — Align repeated-row declarations across schema, validators and CLI

`multiple.min` is declared in the TypeScript, Go and Rust specification models,
accepted by the PHP `multiple` bucket and reported by `crudui explain` and
`crudui describe`. The PHP bucket previously rejected `min`, although the JSON
schema and form runtime define it. `multiple.copy` is a boolean in the JSON
schema; the object form had no runtime meaning. Model comments describe keyed
row identity instead of hidden identifiers and array order.

Schema checks (58 cases), TypeScript validator tests (1606), PHP validator
tests (1446), Go and Rust validator tests, CLI tests (37) and `make docs-check`
passed.

### 2026-09-13 — Add framework-independent HTML rendering and executable feature contracts

`@crudui/generator-html` renders current form and list view models as HTML
fragments without framework dependencies. It supports table and card lists,
current field shapes, widget layouts, escaping rules and raw display content;
browser event binding remains in `@crudui/generator-core`.

`contracts/features.json` now records package exports, feature contracts,
fixtures, test files, support status and verification commands. The manifest
schema and path checker reject missing links. `manifest:test` executes the
declared verification commands, and feature contract pages are generated from
the manifest. CI runs the manifest checks and commands before form tests.

The HTML renderer passed 110 package tests, including 87 form conformance cases
and 20 list conformance cases. Public package exports, declarations, install
builds, API documentation and `make docs-check` passed. The package is not
deployed.

### 2026-09-12 — Publish static documentation through GitHub Pages

The documentation build supports `DOCS_BASE_PATH` and generates explicit static
HTML links for English, Korean and API documents. Development, preview and 404
pages use the same URL prefix. CI checks documentation,
then deploys the generated documentation web to `https://polyspec.github.io/crudui/` from
`main`.

`make docs-check` and `make docs-verify-idempotent` passed with
`DOCS_BASE_PATH=/crudui/`. Browser checks passed for desktop and mobile layouts,
Korean navigation, stylesheets and nested 404 pages.

### 2026-09-11 — Name the comparison deployment command explicitly

The local comparison deployment entry point is now named
`examples/form-comparison/comparison-deployment.mjs`. Verification procedures,
examples and tests use the explicit comparison deployment name.

### 2026-09-11 — Make native C fixtures compile with Linux toolchains

`packages/php-ext/tests/engine.test.mjs` now links `libm` when compiling native
fixtures and emits cleanup statements separately from guard clauses. The C
engine fixtures compile with the warning-as-error settings used by the PHP 8.4
and 8.5 CI jobs.

### 2026-09-11 — Build JavaScript prerequisites before native tests

`make test-native` now builds the workspace JavaScript packages before running
the C extension engine tests. The native test target provides the built React
generator package required by the engine rendering fixtures in a clean checkout.

### 2026-09-11 — Complete the independent C PHP extension

The PHP extension now implements its form and validation engine in C. The
engine owns ordered values and performs composition, expression evaluation,
template compilation, data binding, form and list rendering, validation, row
operations and PHP value conversion inside the extension process. The package
no longer contains a Cargo manifest, Cargo lock file or Rust source. The direct
builder compiles the complete C source set, and the form-comparison extension
stage no longer copies a Rust toolchain. The comparison generator check hashes
the root package lock file used by the candidate source archive.

The C engine checks passed 29 of 30 tests on macOS, with the Linux-only address
sanitizer test skipped. The module build and load succeeded; PHP API checks
passed 352 cases in each of three configurations and validation passed 94 cases
in each implementation. `make test-native` passed with 766/766 generator
checks, 19 protocol checks, all PHP, Go and Rust package checks, and the widget
and timezone checks. `npm run test:form-comparison` passed 136 source, 10
library and 3 browser-job checks. `make docs-check` passed. The extension and
comparison service are not deployed.

### 2026-09-11 — Render form fields in C

The C extension renders evaluated form fields as server HTML. The renderer
supports leaf, group, repeated and language field structures and all current
widget layouts. It preserves control attribute order, opaque event attributes,
raw display content and script and style elements. Text, attributes, URL values
and final CSS properties use the current rendering rules. Rendering does not
change the evaluated field models.

Focused C checks matched exact HTML for all 90 successful shared form fixtures
and two additional escaping and CSS cases. The same cases passed with strict C11
compiler warnings and undefined-behavior instrumentation. These changes are not
deployed.

### 2026-09-11 — Bind form fields in C

The C extension binds compiled templates to record data without changing either
input. Binding resolves presentation rules, translated content, repeated rows,
language fields, checkbox state and widget models. Explicit empty arrays and
objects produce zero repeated rows, while an omitted repeated value produces one
initial row. Unsupported field types return `UNSUPPORTED_FIELD_TYPE` unless the
caller selects the explicit marker result.

The widget implementation generates complete button and editor scripts and keeps
ordered model members. Focused C checks matched the complete ordered field models
for all 91 compilable shared form fixtures, confirmed input immutability and
completed the same cases with undefined-behavior instrumentation. These changes
are not deployed.

### 2026-09-11 — Evaluate form expressions in C

The C extension resolves object and array paths and evaluates literals, relative
paths, wildcards, comparisons, membership, boolean operations and ternary
expressions. Condition maps select the first matching declaration and use an
explicit `true` entry as the default. The implementation uses standard C11.

The focused C check passed all 38 shared expression specifications and their 77
evaluation cases with strict compiler warnings. The cases cover expression
values and boolean results. These changes are not deployed.

### 2026-09-11 — Compile form templates in C

The C extension composes explicit in-memory files, applies ordered references and
patches, detects reference cycles and returns composition error codes and traces.
Form compilation produces data-independent templates containing the template
kind, optional key prefix and recursively compiled fields. Field specifications
do not retain nested `properties`.

Focused C checks passed all 20 shared composition cases and compiled all 92 shared
form fixtures with the same ordered templates or errors as the JavaScript
implementation. The C sources compile with strict C11 warnings. These changes are
not deployed.

### 2026-09-11 — Add the C extension value model

The C extension engine stores nulls, booleans, integers, finite numbers, UTF-8
strings, arrays and ordered objects without PHP or Rust data structures. Values
own their strings, object keys and children. Copy, replacement and removal keep
object declaration order and produce independent values. Invalid UTF-8 and
nonfinite numbers are rejected.

The focused C test verifies ordering, replacement, deep copies, arrays, UTF-8 and
numeric equality. It passed with strict C11 compiler warnings and undefined
behavior checks. The macOS memory inspector reported zero leaks. The independent
C extension source check excludes declared build output and continues to reject
Rust source and Cargo files in the package. These changes are not deployed.

### 2026-09-11 — Use the Node.js 24 artifact action

Native PHP 8.4 and 8.5 CI jobs upload their comparison reports with
`actions/upload-artifact@v7`. This action declares the Node.js 24 runtime. The
previous action declared Node.js 20, so GitHub-hosted runners replaced its runtime
and reported a deprecation warning. Report names, paths, hidden-file inclusion and
missing-file failure behavior remain unchanged.

The CI configuration regression suite requires the current artifact action and
passed all four checks. These changes are not deployed.

### 2026-09-11 — Enforce npm 12 and sandboxed Chrome CI

The npm dependency policy permits a URL dependency only when the root manifest
declares it directly and pins it to an immutable source revision. Dependency
verification rejects URL dependencies introduced by another dependency. Package
install verification reads the current npm 12 `pack --json` report and requires
exactly one report for the requested package and archive.

Linux browser CI uses the regular Chrome file at `/opt/google/chrome/chrome` and
disables Puppeteer's browser download. The preflight rejects symbolic links in the
browser path, launches Chrome without sandbox-disabling arguments and requires
`chrome://sandbox` to confirm the active first-layer, PID, network and Seccomp-BPF
sandboxes. Both browser CI jobs complete this preflight before starting tests.

A GitHub Actions run completed all 20 jobs successfully.
The run includes package install, public export and type, repeated build, browser
inspector and CSS, form-comparison regression, documentation coverage and PHP 8.4
and 8.5 native generation and PHP API checks. No job failed or was cancelled.
These changes are not deployed.

### 2026-09-11 — Verify clean CI installations

Repository-root form-comparison and cross-check commands declare their direct
JavaScript dependencies in the root manifest. Form comparison uses the root npm
graph, and the cross-check renderer resolves Vite and the Svelte plugin by package
name. Package install verification packs each package from its own directory and
requires one archive result.

The form-comparison CI job installs PHP 8.5 and the validator and generator
Composer graphs before running the complete suite. Native PHP matrix jobs pass
the regular versioned `php-config` path for the selected PHP release. Artifact
upload runs only after native verification creates the report.

A clean source archive passed 136 form-comparison source checks, ten generator
construction checks and three Chromium browser checks. Package install export,
type, production build and three-framework browser verification passed. Public
package checks passed nine cases, repeated builds passed one case, and the form
inspector passed 18 unit and six browser CSS checks. Cross-check rendering passed
33 cases. These changes are not deployed.

### 2026-09-11 — Preserve Svelte editable controls

The Svelte generator renders ordinary input and textarea controls as stable DOM
elements. Session value updates retain each element, focus and text selection.
Controls with string `on*` behavior attributes and controls that require exact
specialized HTML remain on the raw serialization path.

The browser connection formats date and datetime values from the current form
instance before updating live controls. Initial data and later injection use the
same value conversion.

Regression checks cover text, email, number, password, textarea, date and datetime
controls. The Svelte SSR and HTML comparison suite passed 345 checks, the mounted
browser suite passed ten checks, the generator core passed 86 checks and
`svelte-check` reported zero errors and warnings. This change is not deployed.

The complete `make test-native` command returned status 0. The run passed 11
extension build checks, 160 PHP generator tests, all Go package tests, 20 Rust
generator tests, 352 PHP API checks in each of three configurations, 94 validation
cases in each PHP implementation, 19 protocol checks, the 766/766 generator report
and five Chromium widget and timezone checks. The generator report SHA-256 is
`16ab371b3691429ca4e2c1a3eaa3c35fb7209861abd5759f16efea6c1a19aa5d`.

### 2026-09-11 — Verify explicit browser and PHP inputs

The Chromium widget check disables Vite dependency discovery and optimizes only
the five declared React and CRUDUI packages. It fails on page exceptions, HTTP
error responses, failed requests and `console.error` messages during every test
phase. The five widget and timezone checks passed.

The PHP form server reads the `crudui/validator` installation directory from
the selected generator vendor's `composer/installed.php`. Other registered
Composer installations do not affect package selection. The directory must be
inside the selected vendor directory. Every path component and loaded class file
must be regular, and the installed validator file must match the candidate source
file. A missing or malformed selected record, an external path or a changed
package copy fails construction.
The startup health check accepts `Generator` and `Form` only from the generator
source directory and `Validator` only from the selected Composer package copy.
It rejects the repository validator source path. A rejected health response
reports the server and the first response field that failed verification.

The PHP source and construction suite passed ten checks. Five hundred verified
constructions completed within the 250 millisecond limit. The PHP and PHP
extension integration check passed 125 generation checks in each mode together
with JSON conversion, storage, validation, public signature and processor-mode
checks. The form comparison build command passed 131 source checks and ten
construction checks.

Candidate source tests create writable fixtures under the canonical operating
system temporary directory. Every temporary path component must be a regular
directory and must not be a symbolic link. Candidate tests do not require Git
metadata or write under the extracted source directory. The candidate fixture
location regression check and all ten PHP construction checks passed.

### 2026-09-11 — Build PHP extensions directly

One PHP extension builder compiles and loads the CRUDUI and OrderedJSON
modules. Separate entry points declare each module's sources, outputs, platform
libraries and load checks. Candidate images use both entry points and do not run
`phpize`, Autoconf or libtool.

The builder resolves regular `php-config`, C compiler, Cargo and rustc files
before compilation. It rejects relative paths, symbolic links, missing or
ambiguous tools and mismatched PHP installations. Rustup identifies the regular
Cargo and rustc files in one selected toolchain. Cargo receives the regular
rustc and linker paths explicitly. Generated path cleanup validates every
declared target before removal and does not follow symbolic links.

The direct builds loaded both modules on PHP 8.5.10. The combined process called
both modules successfully. The PHP API check passed 352 checks in each of three
configurations and 94 validation cases in each implementation. Six builder and
entry-point regression checks passed.

### 2026-09-11 — Use explicit browser completion signals

The form-comparison runner subscribes to the main-page and frame readiness
messages before navigation. The interaction and typing verifiers reserve each UI
operation before activation and await that operation's completion. React and
Svelte complete synchronous updates with `flushSync`; Vue publishes `nextTick`
completion. The verifiers read DOM results only after renderer completion. They
do not use periodic DOM reads, network-idle inference or fixed rendering delays.

The documentation development server registers its recursive file-system
subscription before the initial build. It excludes generated `docs/.web/`
events, serializes rebuilds and combines source events received during one build
into one additional build. A build failure is reported and the next source event
can request another build. A file-system subscription failure closes the server
with status 1.

The candidate verification procedure runs one commit-specific lifecycle command.
The command prepares and builds the candidate, subscribes to its readiness file
before startup, runs the HTTP and browser checks sequentially and retains only
verified deployment evidence. The procedure does not use a sleep interval or a
readiness retry loop.

The form-comparison source suite passed 129 checks, the generator construction
performance suite passed four checks and the browser job suite passed one check.
The documentation suite passed 15 checks. A development-server check returned
HTTP status 200, rebuilt once for one source event and returned status 0 after
`SIGINT`.

### 2026-09-11 — Resolve the native Cargo command path

The `test-native` target supplies its expanded `PATH` when it starts Cargo. GNU
Make 3.81 now resolves Cargo from the directory added by the Makefile when that
directory is absent from Make's startup environment. A regression check runs the
target with simulated commands and places Cargo only in the added directory.

The regression check and all eight runtime policy checks passed. The complete
`make test-native` command returned status 0 with PHP 8.5.10 and passed 160 PHP
tests, all Go package tests, 20 Rust tests, 19 protocol checks, the 766/766
generator report and three Chromium widget and timezone checks.

### 2026-09-11 — Verify local comparison deployment

The repository verifies candidate metadata, generation, persistence, browser
reports, the exact local image tag and image digest before generating the local
comparison Compose file. Deployment preserves existing data without overwriting
different files. HTTPS verification uses the explicit containerctl certificate
authority and checks the source commit, route, certificate, data mount, stored
files and response bytes. A second identical application must leave every checked
value unchanged.

Successful deployment removes candidate containers, candidate directories, raw
reports, screenshots, previous deployment results and local comparison images
that the deployed service does not use. Eleven deployment cleanup checks and all
96 form-comparison source checks passed.

The checks include failed and stale evidence, exact report totals, deterministic
Compose output, data preservation, certificate authority loading, identical
reapplication changes and cleanup path boundaries. Deployment has not been
performed for this change.

### 2026-09-10 — Declare native test dependencies

Repository-root build and test entry points declare every directly imported
third-party package in the root manifest. The dependency check reads the Node.js
entry points executed by `make test-native` and rejects undeclared imports. The
widget script check resolves Vite 8.2.2 from the root dependency instead of a
transitive installation.

All six dependency checks passed. The complete `make test-native` command returned
status 0 with PHP 8.5.10 and passed 160 PHP tests, all Go package tests, 20 Rust
tests, 19 protocol checks, the 766/766 generator report and three Chromium widget
and timezone checks.

### 2026-09-10 — Enforce dependency install-script approvals

Each independently installed npm graph records exact-version approvals for all
dependency lifecycle scripts. Workspace packages use the root lock file. Clean
installs in CI and container builds use `--strict-allow-scripts` and fail before
installation when an approval is missing.

The dependency checks passed five of five tests across every tracked lock file.
The three browser examples built successfully, the parity suite passed seven
of seven tests, the runtime policy and package-build suites passed seven of seven
tests each, and the complete documentation check passed.

### 2026-09-10 — Current candidate verification

The cross-framework lock files resolve the current package
releases allowed by their manifests. Clean `npm ci` and `npm audit` runs reported
zero vulnerabilities. The cross-framework comparison passed 14 of 14 checks.

The candidate built image
`localhost/crudui-form-comparison:<commit>` with index digest
`sha256:7842bd0a40f1e51d4c975008a9b5bdaf6d148e9faba05e68faf3a935b02fe2c7`.
Image construction passed 81 source checks and four library checks. Runtime
verification passed both PHP modes, 290 generation and SSR checks across 411 HTTP
requests, 120 persistence and validation checks, and three Ordered JSON checks.

Browser verification passed 312 checks for each server and 1,248 checks in total.
PHP completed in 213,288 milliseconds, the PHP extension in 206,475 milliseconds,
Go in 200,691 milliseconds and Rust in 200,500 milliseconds. The aggregate records
`complete: true`, `passed: true`, `failedChecks: 0` and
`performancePassed: true`. Packages and the comparison service were not deployed.

### 2026-09-10 — Complete public TypeScript API types

Package entry points export every named type referenced by their public
TypeScript declarations. Form and list validation use one public file-set type.
TypeDoc validation warnings now fail API generation and documentation coverage.
Two unexported-type regression checks, six public declaration checks and the
isolated five-package install check passed.

### 2026-09-10 — Selected runtime channels

`.node-version`, CI and Node.js container stages select Node.js 26 as the next
LTS release line without fixing a patch release. `.go-version`, CI and Go
container stages select the Go 1.27 stable release line. Rust CI and container
stages select the stable Rust channel. CI installs the current stable npm
release. All six runtime policy checks passed. Package lock files continue to
record resolved package versions.

### 2026-09-10 — Four-server candidate verification

The candidate image verifies one committed source archive before extraction and
runs the complete source suite as the unprivileged user before starting PHP, the
PHP extension, Go and Rust servers. Image construction passed 81 source checks
and four library checks. Runtime verification passed the Chromium process check,
290 generation and SSR checks across 411 HTTP requests, 120 persistence checks
and all PHP processor-mode and Ordered JSON checks.

The browser aggregate passed 960 scenario checks, 240 interaction checks, 24
mount-before-load checks and 24 static-document checks. Every server completed
below the 900,000 millisecond limit. The aggregate recorded zero failures and
`passed: true`. Packages and the comparison service were not deployed.

### 2026-09-09 — CI package and documentation checks

The documentation CI job installs both PHP package dependency graphs before
running `make docs-check`. A package and browser job packs the five JavaScript
packages into an isolated install project, verifies public exports, declarations and
styles, compares repeated build outputs, and runs the form inspector unit and
Chromium CSS checks.

The package install, public build, reproducible build and form inspector checks
passed locally. Native PHP output through the three framework browsers remains a
separate comparison-environment verification and was not established by this CI
change. No remote CI run or deployment was performed.

### 2026-09-09 — Current and retained comparison documentation

The feature status now separates implemented native packages from the pending
four-server integration. The verification procedure requires an explicit library
path and commit, distinguishes the current PHP, PHP extension, Go and Rust targets
from retained comparison modes, and documents the two native modules, generation
checks and SSR routes. Browser use of serialized server-compiled templates is
implemented; seven focused unit tests, the complete Go server package, four Rust
server tests and 12 React, Vue and Svelte frame production builds passed locally.
The candidate image's complete four-server HTTP, browser and storage verification
remains pending and not deployed. The retained running image was not replaced.

### 2026-09-09 — OrderedJSON implementation submodules

The processor checker uses the pinned OrderedJSON common repository and all five
implementation submodules. It uses the current registry API, PHP namespace and
extension name, and rejects changed sources, malformed output and incomplete
results. Reports record source, fixture and module hashes.

The official processor checks passed 575 cases; the CRUDUI checks passed all
50 cases. Five checker unit tests passed and two invalid source inputs were
rejected. These results verify JSON processing, not browser or storage integration.

### 2026-09-09 — Native form generators and common PHP APIs

PHP, Go and Rust provide form compilation, data binding, editable instances,
form and list HTML, CLI adapters and HTTP examples. The CRUDUI PHP extension
registers the same Generator, Form and Validator classes as the PHP packages.
Its C binding converts PHP values directly to statically linked Rust engines.
The implementations share ordered value conversion, UTC date rendering, CSS
declaration handling and widget control contracts.

The shared suite passed 153 checks for each of five implementations and one
input-hash check: 766 passed, zero failed. PHP API checks passed 352 cases in each
of three process configurations; PHP and native validation passed 94 cases each.
Form package tests, package install checks and documentation checks passed.

The full `make test-native` command passed in a new non-root Linux arm64 image
built from the current source snapshot. It rebuilt and loaded the extension, ran
the PHP, Go and Rust package tests, repeated the PHP API and validation checks,
passed all 19 protocol checks and all three Chromium widget and timezone checks,
and produced another complete 766/766 generator report. The image index digest is
`sha256:0612f157880aa4bd9ff05a64dc6044969d0736117164cafec466e45d53c64c02`;
the report SHA-256 is
`3f8a91ccbbdaf72c116f2749aa4b6f5cee0975567f6edcbe1372e602cdcf7442`
and the run-log SHA-256 is
`378f4e3a63a88823b3a15b88859237332c27d36f43ee89bd62f9ad03cd38b0b1`.
This establishes native package verification, not the separate four-server
comparison integration. No package publication or comparison deployment was
performed.

### 2026-09-09 — Validator CLI responses

The comparison console checks process exit status, JSON response types, all
five error fields and consistency between validity and errors. It preserves
returned values instead of filling missing fields or coercing invalid types.
Specification load failures must match the CLI's documented response and exit
status. Process failures and malformed responses fail comparison.

Eight initial regressions failed before the fix. All 116 console tests passed,
including 35 response checks and execution of the four language CLIs.
`make docs-check` passed. These are local checks; no deployment was performed.

### 2026-09-09 — Runtime package contracts

The runtime contract defines form generation, SSR and validation requirements
for JavaScript, PHP, Go, Rust and the PHP extension. The PHP API contract specifies
common `CRUDUI\Generator`, `CRUDUI\Validator` and `CRUDUI\Form` classes,
extension registration before Composer class loading, and matching methods.
The implementation proposal maps packages, source coverage and required checks.
Feature status distinguishes these requirements from implemented packages.

The comparison documentation identifies native JSON parsing separately from
native CRUDUI generation and validation. `make docs-check` passed.

### 2026-09-09 — Legacy translation identifiers

Internal translation variables describe the translated field or schema value.
The naming contract covers file names, public APIs and internal identifiers.
The validator package build, all 1,606 validator tests and `make docs-check` passed.

### 2026-09-09 — CLI dependency build

CLI CI builds the validator package before running tests. Local instructions
include the same prerequisite, and documentation checks include the CLI README
and its Korean translation.

Removing validator output reproduced the missing-package failure. Rebuilding it
passed all 37 CLI tests, the four documented commands and two failure exit-code
checks. `make docs-check` passed.

### 2026-09-09 — Dependency update procedure

Scheduled dependency update pull requests are disabled. Dependency updates are
prepared locally and include the applicable package and documentation checks.
`make docs-check` passed.

### 2026-09-09 — Comparison environment verification

All four HTTP targets passed 120 current browser scenarios and 30 current
interaction checks each, with no page errors. The image installs locked PHP dependencies and passed 240 HTTP checks and PHP
processor-mode checks. The external Compose environment serves local HTTPS
through `containerctl`; repeated `up` calls passed eight state and response
comparisons. English and Korean procedures describe the environment lifecycle.

### 2026-09-09 — Dependency installation and generated outputs

PHP CI jobs install dependencies from `composer.lock`. The PHP `vendor/`
directory and the compiled Go CLI executable are excluded from Git. Package CI
jobs build all required form packages, and the legacy comparison job runs its
regression checks. CI comments and step labels describe the commands actually run.

A clean Composer installation reproduced all 26 dependency versions and source
references. PHP passed 1,418 tests; four-language legacy comparison passed 1,074
cases; the cross-check console passed 81 tests. Documentation checks passed.

### 2026-09-09 — Public API descriptions

Public form and list API comments describe the current operations and error
results. The runtime contract uses form-instance terminology; legacy validator
examples import the explicit legacy entry. Removed an unused Vue type import and a reference to a nonexistent
options type. The five edited files produce identical executable JavaScript.
Package exports, strict install types, production rendering and repeat-build
checks passed.

### 2026-09-09 — End-date field references

TypeScript, PHP and Rust preserve `enddate` field-reference parameters, matching
Go. Dotted start-date paths no longer become boolean conditions that skip date
comparison. TypeScript and PHP use the common resolver for relative references.
The earlier-end-date regressions failed before the fixes. Seven shared cases
verify absolute, sibling and parent references and dates before, equal to and
after the referenced date. TypeScript
passed 1,606 tests, PHP passed 1,418 tests, and Go and Rust package suites passed.

The current rule contract is maintained in English and Korean under `docs/spec/`.
It replaces the mixed current/legacy rule document and separates registration,
parameter evaluation and verification evidence.

### 2026-09-09 — Legacy comparison correctness

The comparison runner loads the explicit JavaScript legacy entry and rebuilds
selected Go and Rust legacy executables. It rejects process failures, unreadable
suites and results that differ from fixture expectations. Source-loading and
developer-home fallbacks are removed. Two failure regressions failed before the
fix and passed afterward. All four implementations passed 1,074 legacy cases.
Default test commands include the runner regressions. English and Korean testing
instructions distinguish current conformance from legacy comparison.

### 2026-09-09 — Test fixture contract

The English and Korean fixture contract distinguishes current validation,
composition, expressions, rendering and legacy cases. It documents complete
validation results separately from load failures and removes outdated counts
from the format specification. The current and legacy TypeScript conformance
checks passed 1,124 cases. Documentation checks and the strict web build passed.

### 2026-09-09 — CLI composition failures and documentation

`check` reports unresolved composition instead of checking uncomposed input as a
substitute. The missing-reference regression failed before the fix and passed
afterward; all 37 CLI tests passed. The English and Korean CLI guide describes
the four registered commands. Package descriptions no longer list unimplemented
commands, and the unimplemented MCP proposal is removed.

### 2026-09-09 — Schema documentation consolidation

Current schema and expression contracts use their existing authoritative documents.
A separate English and Korean legacy schema describes the explicit legacy field
model. The duplicate root schema and condition-parser documents are removed;
references use the appropriate current or legacy contract. The legacy example
passed valid-input and custom required-message checks.

### 2026-09-09 — Legacy visibility contract

The English and Korean legacy visibility contract separates validator conditions
from renderer presentation. It documents map-form renderer processing and links
to the current schema's independent visibility and validation settings. The
duplicate visibility guide is removed. The selected TypeScript legacy
display-switch checks passed 84 cases.

### 2026-09-09 — Documentation web navigation

The web uses English navigation with a Korean index link. Generated API navigation
includes the shared generator core. Documentation checks, the strict web build
and generated navigation destination checks passed.

### 2026-09-09 — Data validation guide

The validation guide documents the current JavaScript, PHP, Go and Rust entry
points with `validate` rules. It separates schema loading, input failures,
visibility and transport processing. The outdated API guide is removed and
navigation uses the English guide with a Korean translation. All four code
examples executed successfully and detected the expected required-input failure.

### 2026-09-09 — Svelte generated output

Git excludes Svelte's temporary `.svelte-kit` output. The 117 generated files are
removed from tracking. Building without the preceding directory passed, as did
packaged exports, install type checking, the production build and browser checks
for React, Vue and Svelte.

### 2026-09-09 — Public API documentation generation

API generation fails when a required tool fails or its output is missing.
TypeScript checks all five public package entries, including Svelte component
declarations. Go documents all validator packages. Rust and PHP HTML references
are included in the static web. The documentation procedure specifies required
tools; the duplicate procedure is removed.

Eight generator failure tests, documentation checks, Svelte's 345 server tests
and 3 mounted tests passed. Two complete documentation generations produced
identical output, including native HTML assets. The strict web build passed.

### 2026-09-09 — Documentation link validation

The web checks internal links during builds. TypeDoc generates relative links
and package index pages. Existing repository files outside the web resolve to
GitHub source URLs; missing files fail. Five link tests run in `make docs-check`.
The strict web build, document checks and generated HTML link checks passed.

### 2026-09-09 — Maintained documentation navigation

The documentation web links to the maintained expression contract. Documentation maintenance
instructions identify the current example index checked by `make docs-check`.
The document checks and static web build passed.

### 2026-09-09 — Shared AST evaluation for ternary parameters

Form appearance and TypeScript, PHP, Go and Rust validation parameters evaluate
complete ternary ASTs. Selected field paths, nested true branches and quoted
escapes no longer use separate string parsers. Three form regressions and one
validation regression failed before the fix and passed afterward. Six shared
validation cases cover path-valued and nested limits. Existing validation results
and expected form HTML remain unchanged. The class-name fixture now quotes its
string branches.

The expression contract is maintained in English and Korean under `docs/spec/`.
It documents current boolean conversion separately from required-input validation,
operator precedence and condition-map defaults. CLI descriptions use this contract.
All four validator suites, all form suites, 36 CLI tests and documentation checks
passed. These results do not update the preserved external browser comparison.

### 2026-09-09 — Current API and fixture descriptions

Console documentation uses the current rendering API name. Composition and
rendering fixture descriptions state their behavior without implementation-version
labels. All 23 targeted composition tests passed; fixture inputs and expected
results are unchanged.

### 2026-09-09 — Repository-local form inspection and JSON order checks

Package tests use repository-local
form inspection and JSON order checks. All 50 JSON order cases and the complete
form test suite passed.

### 2026-09-09 — Reusable form inspector

The form inspector and its Node and browser checks are maintained under
`tests/form-inspector/`. Framework initialization tests use that module directly.
All 18 Node checks and six browser checks passed after relocation.

### 2026-09-09 — Bundled example specifications and nested data

The Bootstrap example includes product and repeated-form specifications in its
static build. Controlled pages apply complete form data instead of assigning
dotted paths as top-level keys. The example build and browser checks for
contact, registration, product and repeated forms passed, including nested
product data and rejection of an unintended dotted key.

### 2026-09-09 — Controlled legacy React updates

Legacy form change notifications execute outside React state updater functions.
Consecutive field changes preserve prior values and notify the controlled parent
once per change. The regression failed before the fix. All 692 React tests and
the package build passed after the fix.

### 2026-09-09 — Legacy example layout and builds

Legacy examples use `examples/legacy`. Imports, package references, build contexts,
tests and documentation use the relocated paths. Container builds install and
build the complete workspace through package commands. PHP integration classes
use individual PSR-4 files. The Node example lock file reflects current manifests.

Local frontend builds, Go tests, Rust compilation, five PHP API checks and Node
HTTP valid/invalid cases passed. Composer strict PSR-4 generation and documentation
checks passed. Linux images for the frontend examples, Node, PHP, Go and Rust built.
All four server images passed valid and invalid HTTP cases. PHP Apache routing
and its document root passed. Frontend browser verification remains pending.

### 2026-09-09 — Repeated-field schema

The declaration schema accepts `multiple.min` and describes collection-key row
identity without hidden fields. Schema validation passed 56 fixtures, including
minimum-count acceptance and rejection of a nonnumeric minimum.

### 2026-09-09 — Current comparison image

The comparison image builds the library source with normal dependency
installation. The image installs the browser archive extractor and resolves
native JavaScript build dependencies through the workspace lock file.
The local comparison environment runs PHP, PHP extension, Go and Rust.
All 240 HTTP checks and PHP processor-mode checks passed. Browser comparison
is in progress for this source and dependency graph.

### 2026-09-09 — Dependency installation and package checks

The workspace lock file resolves declared dependency ranges and includes native
packages for supported platforms. The root declares Vitest for shared test
integration. npm install-script approvals identify reviewed package versions.
The isolated install project uses normal installation with the same script approvals.

Clean installation, public package checks (5), repeated build comparison (1),
install types, production compilation and three-framework browser checks passed.
Form checks passed: core 26, React 691, Vue 344, Svelte 345 and 3 mounted checks,
and 6 HTML normalizer checks. JavaScript validation passed 1,579 tests.
These results do not establish deployment of the comparison environment.

### 2026-09-09 — Field error descriptions

Unsupported field errors identify the field type and path. Current test names
use unversioned operation names. Core checks passed: 26 tests. Documentation
checks passed.

### 2026-09-09 — Independent PHP extension target

PHP extension execution uses a separate process, repository and server identifier.
The native processor is required in extension mode and prohibited in PHP mode.
Server and browser checks include PHP extension as a fourth target.

An isolated container passed 240 HTTP checks across four targets, including
processor-mode assertions. Both PHP codec modes and rejection of missing or
unexpected extensions passed. Full extension browser verification remains pending.
The main comparison container has not yet been replaced with this image.

### 2026-09-09 — Empty collection browser checks

Browser checks locate the collection containing the focused button through its
field wrapper. The current renderer no longer uses wrapper name attributes.
All 18 current empty-collection checks passed across three servers, three
frameworks and both transports. The PHP run passed all six current initialization
comparisons and 30 current-runtime pointer/keyboard interaction checks
(108 across all comparison modes), with no page errors.
Retained source HTML differences remain recorded as failures.

### 2026-09-09 — Shared SSR comparison instance

The cross-check console creates one form instance for the three renderers.
Generated row keys are identical across framework outputs when repeat data is
missing. Console checks passed: 81 tests, including the generated-key comparison.

### 2026-09-09 — Comparison server entries

Current PHP, Go and Rust servers use unversioned validator entries. Retained
Go and Rust servers build from a pinned server-source archive. The comparison
container uses the library source. All 180 HTTP persistence checks passed.
Browser lifecycle verification is in progress. No package was published.

### 2026-09-09 — Comparison browser entries

Comparison browser builds select current and retained source entries explicitly.
Current collection checks use field paths. The build requires an explicit
absolute workspace path. All twelve browser bundles built successfully.
Server integration and lifecycle verification remain pending; the running
comparison environment has not been replaced.

### 2026-09-09 — Public declaration builds

TypeScript package builds generate JavaScript with the bundler and declarations
with the TypeScript compiler. Public entries include the declared legacy exports.
Declaration compilation uses `noEmitOnError` and no deprecated-option suppression.
Watch commands regenerate declarations after successful JavaScript builds.

Verification: clean installation and the full build passed. Five public package
checks passed, including strict ESM/CommonJS type resolution, stylesheet output
and rejection of invalid public declarations. Two complete builds produced
identical output paths and SHA-256 digests. An isolated package install passed
type checking, production build and three-framework browser checks. Runtime
source files were unchanged by this build change. Packages were not published.

### 2026-09-08 — Form instances and input controls

The form API prepares templates with `compileForm`, creates editable instances
with `createForm`, renders `Form` components and accepts an instance in
`renderForm`. List renderers use the same `layout` option. Native controls have
stable, scoped label identifiers; multiple-choice controls submit arrays.
Field containers use `data-field-path` instead of a submission name.
Svelte packages include generated component declarations. Package dependencies
use the `0.0.1` package version. Validation comparisons fail when a required
engine fails, is missing or returns duplicate results.

Verification: 1,409 form tests, 1,579 JavaScript validator tests, 1,392 PHP tests,
Go and Rust tests, 42 console tests, 18 inspector tests, Svelte type checking,
package install compilation/build and documentation checks passed.
The running comparison container has not been updated to this source.

### 2026-09-08 — Record restoration HTML

The shared DOM binding places an existing `checked` attribute after the input's
other attributes. Initial rendering and record restoration now use the same
attribute order without replacing the input. The shared regression compares the
complete restored HTML and verifies that checkbox elements remain unchanged.

Verification: the stricter regression failed in React and Vue before the fix.
Generator builds, all 1,405 generator tests and 18 inspector tests passed after
the fix. The source passed all 360 current-runtime scenarios across 18
server/framework/transport combinations. All 3,024 initialization, repeated
injection and restoration category comparisons passed, including 378 exact HTML
comparisons. The 24 previous restoration differences are resolved.

All 324 actual interactions, 36 mount-before-load checks, 36 static documents,
180 HTTP checks, 36 typing cases and six Chrome CSS detection checks passed.
Korean React and English Vue checks through Rust verified the inspector button,
all 168 categories per run and exact JSON/HTML downloads. No browser page errors
occurred. The complete matrix records 1,290 passed and 150 failed scenarios;
all remaining failures belong to retained sources and match their previous results.

An intermediate run recorded an additional CSS failure after a progress-monitor
connection changed the browser viewport. The monitor was removed, the viewport
change was reproduced separately, and the full matrix was rerun at 1680 × 1100
without an additional connection. Both runs and previous reports are retained.
All 2,160 exported HTML snapshots match the recorded strings. Deployment: the
local container uses the verified source; all 52 example files, the DOM binding source and
served metadata match the verified source. No package was published.

### 2026-09-08 — Form initialization inspector

Added initial-data creation and post-mount injection comparison using the parsed
browser DOM, unmodified HTML, live/default controls, ordered fields, computed CSS,
focus and saved records. The inspector retains category failures and continues
through repeated injection, record replacement and the same row actions. The
example provides a separate check button and downloadable HTML and evidence.
Static HTML responses are checked independently from mounting before data loads.
React now removes the empty style attribute when resolved inline styles are removed.

Verification: generator builds, 1,405 generator tests, 18 inspector tests and six
Chrome CSS detection checks passed. At 15:35 UTC, all three API servers completed
72 reports containing 1,440 scenario results: 1,278 passed and 162 failed.
Current-runtime initial-data/post-mount comparisons passed in all 18 combinations
at 15 stages. Repeated injection passed, including raw HTML. Record restoration
retained 24 raw HTML attribute-order differences in React and Vue; all current
DOM, CSS, control, data, focus and persistence comparisons passed. Earlier
renderer differences remain recorded. Each server runner returned status 1.

All 324 interactions, 36 mount-before-load checks, 36 static HTML checks, 180 HTTP
checks, 36 typing cases and 54 bilingual UI selections passed. No browser page
errors occurred. Exported 2,160 stage snapshots and retained the stopped 42-report
run. Browser protocol calls now execute one API server at a time. Complete report
JSON omits indentation because the indented DOM records exceed the runtime string
limit; snapshot content is unchanged. Deployment is the local Apple container at
`localhost:4317`; no package publication or remote deployment.

### 2026-09-07 — Empty collection merge

Merged the empty-collection correction into `main`, retaining stable row keys and
focus handling. Empty collection Add buttons have an accessible label in React,
Vue and Svelte. Six regression tests cover explicit empty values, missing data,
visibility and nested row order. The tests use the current root group contract.

The pinned correction source is included in `main` history, so preparing the
comparison from a full clone does not require a separate branch.

Verification: generator builds and 1,402 tests passed (core 25, React 689,
Vue 342, Svelte 345 and Svelte client 1). The regression tests use `compileForm`
and `bindForm`. Deployment: no package publication; the local comparison
continues to use its existing pinned sources.

### 2026-09-07 — PHP, Go and Rust form persistence

Added independent Go and Rust servers alongside PHP for native form and JSON
submission, existing CRUDUI validation, atomic JSON storage and hierarchy reload.
Each server and source revision uses its own repository. Go and Rust binaries
compile against the displayed validator revision. Node serves browser assets and
forwards request bytes. Shared fixtures define identical stored records.

The page selects the server and retains that selection when changing language.
Form fields follow the string contract, and multilingual titles accept the
specified `ko` and `en` fields. Invalid structures, reset requests, oversized
requests and invalid required values are rejected without changing records.

The 13:47 UTC browser report contains 72 reports and 1,368 scenario results.
Corrected original and current runtime each passed 19/19 for PHP, Go and Rust in
React, Vue and Svelte with both form and JSON transmission. All 324 interaction
checks and 36 mount-before-load checks passed with no browser page errors.
Unchanged original keyed diagnostics remain 17/19 and array diagnostics 15/19;
the complete runner returned status 1 for the 108 retained diagnostic failures.
All 180 shared HTTP checks, 36 typing checks, 54 bilingual UI selections,
JavaScript/PHP conversion checks, PHP repository checks, Go static analysis,
Rust Clippy and `make docs-check` passed. Earlier failed reports were preserved.

Deployment: local Apple container at `localhost:4317`, using PHP 8.4.24,
Go 1.27.0, Rust 1.98.0 and Node 26.8.1. No package publication or remote deployment.

### 2026-09-07 — Original-controller typing

The original example controller could overwrite newer input with an earlier
rendered value and temporarily lose focus when a framework replaced an input.
It now cancels superseded input renders and restores values and focus immediately
after React, Vue or Svelte commits the DOM. The fixed two-frame delay was removed.

Verification at 13:41 UTC: all 36 native keyboard cases passed across four
comparison variants, three frameworks and 0/10/50 ms character intervals.
Immediate and settled text, focus and caret checks passed; no browser page errors
occurred. Library source snapshots are unchanged. Deployment is the local Apple
container at `localhost:4317`; no package or remote deployment was published.

### 2026-09-07 — Form comparison naming

Applied consistent CRUDUI example names to paths, source, documentation and
container commands.
Comparison library and test files retain their original content. Previous data,
reports and source archives were preserved outside the working tree.

Verification at 12:21 UTC: corrected original and current runtime each passed
19/19 in React, Vue and Svelte for both form and JSON transmission. All 108
interaction checks, 12 mount-before-load checks, JavaScript/PHP conversion checks,
both repository checks and `make docs-check` passed. No browser page errors
occurred. Unchanged original keyed diagnostics remain 17/19 and array diagnostics
15/19; the full runner returns status 1 for those recorded failures.
Deployment: local Apple container at `localhost:4317`; no package publication or
remote deployment.

### 2026-09-07 — Form and ordered JSON transmission

Each form can select native multipart or JSON transmission. Both formats run
the same existing JavaScript/PHP validation and repository save. The JSON path
uses ordered-json for requests, responses and storage files. Separate
transport modules convert its values to form records while preserving the
13-character keys, document order and empty collection types. The container
build includes the pinned source and displays its archive hash.

Added complete lifecycle checks for both transmission choices, identical-data
storage comparisons and malformed JSON rejection. Actual browser requests verify
the selected Content-Type and JSON shape. Invalid browser values block both
formats; invalid direct requests preserve stored records. Required/optional and
display rules continue to use the existing validators.

Verification at 11:35 UTC: corrected original and current runtime each passed
19/19 in React, Vue and Svelte for both formats. All 108 real interaction checks,
12 mount-before-load checks, JavaScript/PHP conversion checks and both repository
checks passed. JavaScript, PHP, Go and Rust validation conformance and
`make docs-check` passed. No browser page errors occurred. Unchanged original
keyed diagnostics remain 17/19 and array diagnostics 15/19 in both formats;
their existing failures remain recorded and the complete runner returns status 1.
Deployment: local Apple container at `localhost:4317`; no package publication or
remote deployment. Comparison sources and previous reports remain available.

### 2026-09-07 — JSON processor contract verification

Added a reproducible check against ordered-json for document member
order, nested 13-character row data and empty collection types. All five
implementations passed ten transport fixtures and the processor's 115 common
cases. The fixtures verify JSON representation; browser behavior and runtime JSON
integration did not change. The local comparison remains available.

### 2026-09-07 — Empty collection correction and browser validation

- Added the corrected original source to the primary comparison with the current
  runtime. The unchanged original keyed and array diagnostics remain
  selectable with their actual failures.
- Connected the existing JavaScript validator before user submission. Invalid
  values stop transmission and display field errors; reload clears obsolete errors.
  PHP independently validates the same rules. No validator rules changed.
- Verified optional blank department storage, hidden required-field failures,
  empty collection visibility, nested and complete deletion, re-addition,
  native/JSON persistence, sibling IDs and parent relationships.
- Added real typing, invalid/valid request counts and empty-collection keyboard
  focus checks. Frame scenarios run sequentially to avoid focus interference.
  The runner preserves prior reports and screenshots before writing new results.

Verification at 10:15 UTC: both primary implementations passed 17/17 in React,
Vue and Svelte. All 54 interactions, 12 mount-before-load checks and both PHP
repository checks passed; no browser page errors occurred. The unchanged original
keyed diagnostic remains 15/17 and the array diagnostic remains 13/17, so the
complete runner returns status 1. Existing shared validation cases passed in
TypeScript, PHP, Go and Rust. `make docs-check` passed.
Deployment: local Apple container at `localhost:4317`; packages not published.

### 2026-09-07 — Focus during native typing

Ignore unchanged input/change events before capturing focus. A native change
event during input replacement previously cleared the pending focus state in
Vue and Svelte, so typing stopped after the first character.

Verification: full Chrome checks retained the complete typed value and input
focus in React, Vue and Svelte. Shared mounted DOM checks and core type checking
passed. Deployment: local comparison environment; packages not published.

### 2026-09-07 — Focus after adding to an empty collection

The browser binding identifies the empty collection's Add button by its wrapper.
After the first row replaces that button, it restores focus to the Add button in
the same collection with `preventScroll`.

Verification: the shared mounted DOM scenario and real Chrome empty-collection
keyboard checks passed in React, Vue and Svelte; core type checking passed.
Deployment: local comparison environment; packages not published.

### 2026-09-07 — Focus during row operations

Row button pointer activation preserves input focus. DOM synchronization restores
text selection and ancestor scroll positions with `preventScroll`. Keyboard
activation retains focus on an existing button. Generator builds and mounted DOM
checks passed in React, Vue and Svelte. Real browser pointer and keyboard checks
passed in all three frameworks. Deployment: running in the local form comparison example;
packages not published.

### 2026-09-07 — Browser comparison and PHP persistence

- Added an Apple container environment for React, Vue, Svelte and PHP at
  `localhost:4317`, with exact original and current Git source snapshots.
- Added a primary comparison using identical 13-character keyed data. The original
  public functions use an example row controller and cached binding; the current
  runtime uses its library session. Original library source remains unchanged.
- Added original-public-function cache preparation with `composeProperties`,
  serialized structure restoration and `buildField` binding. Both keyed adapters
  read a composition reference once and reject further loading after preparation.
- Added native PHP parsing, revision-specific validation, atomic JSON persistence,
  parent ownership, scoped saved-key application, deletion and independent reload.
  Invalid or truncated requests preserve stored records.
- Added ID order `[5, 7, 1]`, insertion as ID 8 and subtree copying as ID 9.
  Keyed JSON uses document member order without additional order or identity
  fields. Editing document order changes stored and rendered order.
- Separated populated row-operation fixtures from explicit empty-collection checks.
  The comparison preserves empty-rendering failures without filtering generated rows.
- Mounted each form before its initial PHP data request. Browser request inspection
  checks that nested inputs exist before the request continues.
- Retained the earlier hidden-field array diagnostic as a selectable example.
  Its hidden fields and lack of cached binding are example configuration choices.
- Added pointer, keyboard and checkbox checks, manual controls, data inspection,
  downloadable results, raw error details and matching English/Korean documents.
  Failure explanations identify example configuration and original renderer behavior.
- The browser runner returns status 1 for any failed check, incomplete result or
  browser error. Recorded diagnostic failures remain failures.

Verification: in each framework, the current runtime passed 17/17 scenarios,
original keyed binding passed 15/17, and the retained array diagnostic passed
13/17. Original keyed failures both concern explicit empty-collection rendering.
Cache binding passed in both keyed examples. All 27 interaction checks, nine
mount-before-load checks and both PHP repository checks passed. No browser page
errors occurred. The comparison runner returned status 1 for recorded failures.
[Feature status](docs/features.md) records the current code's results.
Deployment: local Apple container; packages not published and no remote deployment.

### 2026-09-07 — Compiled forms and 13-character row keys

- Added immutable, JSON-cacheable form templates and separate data binding.
- Added editable sessions with late data injection and scoped nested row addition,
  copying, removal, ordering and saved sequence key updates. New row keys contain
  13 hexadecimal characters; saved sequence keys contain 13 padded decimal digits.
- Connected native inputs and row buttons in React, Vue and Svelte. Corrected
  checkbox data rendering, explicit empty defaults, formatted date synchronization
  and React FormBuilder data prop replacement.
- Extended keyed scalar and group collection validation in four languages, with
  five shared cases for error paths, uniqueness and minimum count.
- Removed the combined `buildForm` entry and obsolete render aliases. SSR source
  functions accept compiled templates.
- Updated form contracts and usage documents with English and Korean versions.
  Added link, translation and status checks and included generator-core API
  documentation in the existing coverage check. Removed outdated form-key and
  schema documents after consolidating current contracts under `docs/spec/`.
- Replaced developer checkout paths with repository-relative imports or required
  external input paths. Corrected fixture regeneration to update existing cases.

Verification: core 19 tests; React 689; Vue 342; Svelte 345 SSR/unit and 1 mounted
DOM test; TypeScript validator 1,579; PHP conformance 61; Go and Rust shared
validation conformance passed. These runs include 43 shared CRUDUI validation cases.
Console SSR 32 tests, CLI 35 tests, lint, type checking and `make docs-check`
passed. API generation, schema generation and the documentation web build
passed. Deployment: not deployed.

### 2026-09-07 — Schema generation

Removed the unnecessary `ignoreDeprecations: "6.0"` compiler setting because the
schema generator's bundled TypeScript compiler rejects it. TypeScript type
checking, schema generation with three example checks, and the documentation
web build passed. Deployment: not deployed.
