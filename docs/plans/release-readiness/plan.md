<!-- doc-id: plan-release-readiness -->
# Local release candidate preparation

[한국어](plan.ko.md)

## Preparation order

C18.1–C18.10 of the [checklist](checklist.md) are complete. C18.12 completes scoped CI environments; C18.13 prepares publication of 0.0.9.
CRUDUI 0.0.8 is public from its release commit,
which passed full CI, push checks and all three tag release workflows.
The release workflow installed and checked all 11 archives outside the checkout before publication.

## Current decisions

- C16.8: C18.2 completes the current parser decision. Fresh stable and next VitePress distributions still contain the
  affected parser; the directly managed current markdown-it 15.0.3 parser includes the fix. The renderer remains in use
  for this candidate. The rebuild record's maintenance trigger does not defer the current candidate decision.
- C16.173: C18.3 supports current React and React DOM without the widget-script exception and retains script execution
  and server hydration verification.
- C16.45, C16.170 and C16.171: Native package managers resolve the current local sources. The root Composer declaration
  and lock select the current sibling packages; a duplicate archive-compatibility profile is not part of local preparation.
- C16.169: Current advisory review determines applicable findings. A withdrawn advisory does not require a version bump
  and does not exempt the current dependency graph from security verification.
- C18.4 prepares current npm dependencies and supported Svelte peers. C18.5 aligns version 0.0.8 declarations and native
  locks. C18.6 separates PHP source-only helper tests from the extension runtime tests.

## Accepted decisions

C16.13 is implemented by C16.13-1. C16.29-1 corrects forwarding and records the application-specific requirements that
retain the current adapter. C16.65 removes an invalid vocabulary restriction. C16.172 leaves constraint selection to
Composer rather than matching another repository's exact declaration. These decisions do not remove the current
source dependency, package or consumer checks.

## Completion

Record the prepared source commit, review date, evaluated versions, native package-manager results and consumer results.
Build any local candidate artifacts from the current merged source snapshot and consume only artifacts made in that run.
Complete the remaining local corrections with their owning checks and merge every completed development branch into local
`main`. C18.1 becomes complete only after this preparation and its local verification finish.

Successful CI remains a condition of later publication, not a reason to leave local preparation bypassed. A later change
requires its owning verification and the publication checks of the resulting commit. Future maintenance triggers remain
separate from the completed decision for this candidate.


## Scoped CI environment preparation (C18.12)

Kit 0.0.63 provides selective `make install-tools TOOLS="..."` installation. Each CI job declares its required tools
and prepares its own locked dependencies and builds. PHP extension jobs explicitly prepare the pinned arginfo parser.
The root release asset and native lock must select that release together. The local source link remains a development input.

Every job bootstraps the locked npm and installs its required npm packages. The table lists additional tools and inputs.
Tool aliases and transitive installation dependencies must match the released Kit interface; application code does not install toolchains.

| Job | Additional environment | Locked inputs and owned operations |
| --- | --- | --- |
| validator-js, cli | None | npm lock; build the required JavaScript packages, then run the selected suite |
| validator-php | PHP and Composer | root Composer lock and declared source providers; install, then run the PHP validator suite |
| validator-go | Go | go.work and native module sums; download modules, then build and test the Go validator and generator |
| validator-rust | Rust | rust-toolchain.toml and Cargo locks; fetch crates, then build and test the Rust validator and generator offline |
| python | Python and uv | uv.lock and workspace build declarations; synchronize the locked environment, then run both Python suites |
| cross-language-equivalence | Go, Rust, PHP, Composer, Python and uv, with PHP extension build support | own native dependency installs, current JavaScript and extension builds, then both generator comparison commands |
| cross-check-console | Go, Rust, PHP, Composer, Python and uv, with PHP extension build support | own native dependency installs and program builds, then shared validator comparisons and benchmark driver regressions |
| native-generators | Pinned Chrome | JavaScript protocol and widget unit suites; Go and Rust generator suites run in their language jobs |
| php-api | PHP and Composer, with PHP extension build support | locked Composer install, current extension build and PHP unit suites |
| php-engine | C compiler and sanitizers | current JavaScript fixture build and native engine compilation; verify whether any PHP execution remains before removing its setup |
| form-runtime, package-browser | Pinned browsers | npm lock, required JavaScript builds and the browser builds pinned by their packages |
| form-comparison | PHP, Composer and pinned Chrome | regression cases and their actual PHP inputs |
| form-comparison-pipeline, form-comparison-browser, form-comparison-checks | Go, Rust, PHP, Composer, nginx and pinned Chrome | independent native stack preparation and pinned release inputs; summary also reads the declared browser reports |
| docs-coverage | Go, Rust, PHP, Composer and declared documentation tools | native API documentation builds and document checks |
| runtime-tests, build-lint | Every tool actually exercised by the selected checks | runtime policy, dependency verification and cross-language linting; split language lints before narrowing their installation scope |
| conformance, ci-passed | None | conformance reads isolated evidence artifacts; final CI evaluates every required job result |
| Dependency review workflow | Tools required by each declared dependency graph and its audit command | online registry review; prepare PHP before any selected PHP tool installation and keep target selection separate from dependency version targets |

### Adoption verification

- Bootstrap uses the npm release of packageManager; selected tools retain mise.lock, rust-toolchain.toml and declared hashes.
- A fresh language job installs only its selected tools and required dependencies. An unrelated PHP, Go, Rust or Python setup is absent.
- Required build steps run in that job. Native test commands may perform their own compilation, and no job downloads another language job's build output.
- The two comparison jobs start without language-job dependencies and prepare every runtime they compare in their own environment.
- Repeating installation with the same inputs reuses the correct versions and preserves the selected installed state.
- Dependency installation is online and locked. CI Composer installation does not update the lock; local source refresh remains a separate operation.
- Checks retain the offline environment and auto-install prohibitions. Missing caches fail instead of enabling network fallback.
- Conformance and final CI require all relevant results. Only evidence summaries wait for the evidence-producing jobs.
- Owning workflow and Make tests run during the change. The complete suite runs once after all active checklist items finish.


## Build dependency advisory review (C18.12-3)

GHSA-gcqx-w48m-w2h4 affects deepmerge 4.3.1, used by the Svelte Vite plugin to merge trusted repository build configuration.
The advisory has low severity and no patched release. The published runtime packages do not depend on deepmerge.
The existing dependency review records npm moderate, high and critical findings; this threshold remains unchanged.
The raw npm audit still reports the low finding and its dependent plugin. No exception or package override is added.


## 0.0.9 candidate verification (C18.13-1)

The candidate archives contain the committed source of C18.13-2. Native package managers resolved 0.0.9 inputs,
and clean external consumers installed and checked all 11 archives. Go workspace resolution selects seven local modules;
all six Cargo locks retain the external package versions and checksums. PHP verification ran on 8.4.27, with 36 source
cases and two native constructor cases passing. Publication requires successful CI for the final candidate commit.


## Kit 0.0.63 integration verification (C18.13-4, C18.13-5)

The root manifest and native lock select the published Kit 0.0.63 asset. `config/ci.json` declares shared, six runtime
and full parity preparation through the provider interface. Native planning, schema and ownership checks pass.
Selected `node npm` and `node npm go` checks pass with PHP arginfo absent; its installation is restored after the probe.

The provider runtime workflow passes its runtime into native source linking. A real mixed-language Git fixture proves
TypeScript links without foreign tools, while full linking retains its Go requirement. Make and workflow runtime
forwarding and the native CI plan are verified by the owning tests. Complete isolated candidate CI and release proof
remain mandatory under C18.13. The actual consumer CI result is reported to [Kit issue 14](https://github.com/polyspec/kit/issues/14).


## Final candidate inputs (C18.13-6)

Kit 0.0.63 built all 11 archives from the source snapshot of C18.13-7. Clean consumer installs and the 20 release/manifest
owner cases passed. Native consumer metadata names local zip archives through explicit package repositories.
The final source metadata and consumer records reach main before the complete candidate CI and publication checks.
