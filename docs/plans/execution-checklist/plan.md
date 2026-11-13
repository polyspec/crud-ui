# Wave background
<!-- doc-id: docs-plans-waves -->

[한국어](plan.ko.md).

Each section holds the dependencies and the background of one wave of [the execution checklist](checklist.md), whose wave heading links it.

## Wave 1

Depends on: none. `@polyspec/crudui-generator-core/crudui.css` is the only stylesheet of the CRUDUI blocks, and it has no rule for a narrow viewport: no test opens a form, a list or a detail at the width of a phone. A page styled with Tailwind CSS cannot build the CRUDUI styles with its Tailwind build and theme. CRUDUI ships its own stylesheet and a Tailwind version, and either one styles the CRUDUI blocks.

## Wave 2

Depends on: none. The rules of AGENTS ran the full suite when a feature was complete and let a long operation replace its timeout with step logs. CI jobs that run the suites carry a job timeout of 10 to 30 minutes over every test. The benchmark driver test compiles the Go and Rust drivers inside a test with a 600-second limit. The build readiness wait of the tree verification reads its state file every second, and its tests compare wall-clock time with limits. The PHPUnit mode of `scripts/run-tests.mjs` counts class and data provider suites as passed tests and drops every line that is not a TeamCity message.

## Wave 3

Depends on: none. Runs of different checkouts use the same resources: fixed directories under `/tmp`, the Playwright image of the Linux style check, the comparison deployment and the `dist` directories that the package builds empty and that other repositories pack. A run can replace or reset such a resource while another run uses it. A resource that one run can own gets a directory or name of that run; a resource that is single gets a holder lock: one holder at a time, a refusal that names the holder's checkout, pid and process start time, and a release by the holder.

## Wave 4

Depends on: none. The checklist wrote task state markers in its How to use legend and in the text of C2.1-2, so a tool that counted the markers of the file counted tasks in progress that do not exist. No check read the checklist outside the task states.

## Wave 5

Depends on: none. CI has failed on every push since 2026-09-25 while `make ci` passed locally on the same trees. The local full run starts in a working tree with the build output of earlier runs and compiles C with Apple clang on macOS; CI starts each job from a fresh checkout and compiles with GCC on Linux. A failed step skipped the later checks of its job, and a failed prerequisite of `make crudui-test-native` skipped the native suites, so one CI run did not show every failure, and the conformance check reported missing evidence without the suite that should have written it.

## Wave 6

Depends on: none. AGENTS and the testing guide state that a push happens only when every active task is done, and nothing enforced it: a push with a task in progress reached GitHub, where CI runs the full suite on the pushed tree. Git does not version hooks, and `core.hooksPath` is a setting of each clone, so a hook works only where a clone installed it, and `git push --no-verify` or another clone passes without it. GitHub cannot refuse a push by the content of a file; a workflow fails after the push is accepted. A ruleset of a branch can require a check that passed on the pushed commit, so a commit can reach `main` only after its check passed on another branch.

## Wave 7

Depends on: none. Results depended on the date, the machine or the order of runs: dry runs of make whose output differs between GNU Make 3.81 and 4, release channels instead of exact toolchain versions, runs that pass without a test case or a command, chains that stop at the first failed suite, checks that read output another command left behind, outputs written in place while another run reads them, ports probed before use, an install that replaces the machine npm, failures without the command, path or limit, no mechanical choice of the owning checks of a change, and a process tree that is killed but not awaited. Defects of this kind are fixed as a class in every repository, with one rule per class in AGENTS.

## Wave 8

Depends on: none. A field or a group declares `design.show` with a condition on another field, and the five validators skip every rule of a hidden field and of everything it contains, so a branch that a parent value switches off has no required field. Four gaps remain. The browser binding validates with the current data but keeps the `hidden` attribute that the server wrote, so a field appears or disappears only after a new page, rules of a visible field are skipped and errors stay on hidden nodes. A relative path that moves up from a field of a repeated group counts the row key as a level of its own, so `..x` in a row reads a member of the collection instead of a field beside it, and the result depends on the shape of the key. A server cannot tell which submitted values belong to hidden fields. The Rust validator resolves a `design.show` string as an expression without the expression check of the other runtimes. A parent switches its children by the `design.show` of the children, a hidden branch is not validated and not changed, and these gaps are closed in all runtimes with shared cases.

## Wave 9

Depends on: none. The polyspec repositories name their packages after the organization: template publishes `polyspec/template` with the namespace `Polyspec\Template\`, `@polyspec/template-workspace` and the crate `polyspec-template`, and hyper `polyspec/hyper`, `Polyspec\Hyper\` and `@polyspec/hyper`. CRUDUI named its npm packages `@crudui/*`, its Composer packages `crudui/generator` and `crudui/validator`, its PHP classes under `CRUDUI\` and its crates `crudui-generator` and `crudui-validator`, so the polyspec packages followed two conventions. CRUDUI follows the convention of template and hyper.

## Wave 10

Depends on: none. The form comparison takes OrderedJSON from the tag `v0.0.3` of `polyspec/ordered-json` and uses the package names of that tree. Until version 0.1, a polyspec repository depends on another polyspec repository through a GitHub tag of it.

## Wave 11

Depends on: none. Every change reaches `main` through a pull request and the merge queue, so every commit of `main` passed the required checks. A release is a tag `vX.Y.Z` of a commit of `main`, or `<directory>/vX.Y.Z` for a Go module in a subdirectory; the maintainer creates the tag after the pull request that sets the version, and no pull request carries a tag. The ruleset `main` requires the check `push-gate` and one completion check `ci-passed` of the CI workflow, so a new or renamed CI job needs no change of the ruleset. The change log keeps the changes of the coming release under `## Unreleased`, which the release pull request names `## X.Y.Z`.

## Wave 12

Depends on: none. The longest job of the CI workflow decides when the check `ci-passed` concludes. The job `Native generation and PHP API` ran every native suite for each of the two PHP releases of its matrix, also the C engine tests of the PHP extension, the generators of the JavaScript, HTML, Go and Rust targets and the benchmark drivers, which need no PHP release of the matrix. The cache of `setup-node` restored 700 bytes of npm packages in every job.

## Wave 13

Depends on: none. The repository names its implementations in TypeScript, Go, PHP, the PHP extension and Rust. Python joins them with the same standing: `polyspec-crudui-validator` and `polyspec-crudui-generator` under the PEP 420 namespace `polyspec`, the standard library only, `unittest` for the unit tests and the shared fixtures of `tests/fixtures` for the results, which every implementation answers identically. Python 3.11 is the oldest supported release and `.python-version` will name the newest stable one; the file does not exist yet, because C13.1-6 is not done.

## Wave 14

Depends on: none. The repository takes the tools that every polyspec repository shares from polyspec/kit v0.0.4 as vendored copies in `scripts/kit` and `tests/kit` (`kit.json`, `.kit/kit.lock.json`) and differs from the other repositories only in `config/*.json`. The tools of this repository that kit provides are removed: the dependency review and its check, the toolchain install and check, the test runner, the push check, the full-run guard, the holder lock, the document and owner checks, the CI report tools and the release tool. The 0.x workflow has no pull request, merge queue or ruleset: work is committed locally per row, `main` is pushed once when every row is `[o]`, and a tag is created only after the main CI check `ci-passed` succeeded.

## Wave 15

Depends on: none. The path rule of AGENTS rejected symbolic links in every path without stating that it governs only what this repository creates, so the standard tool of an ecosystem that creates symbolic links, such as uv for a Python environment, would be rejected by it. AGENTS did not state that outside tools and libraries are used as they are and not rebuilt.

## Wave 19

Depends on: none. The validator and the generator had one implementation per language. The Rust crates become the cores, and binding generates the language packages from their interface contracts; the former language implementations stay under `legacy/` until each binding replaces one.
