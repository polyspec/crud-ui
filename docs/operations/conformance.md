# Conformance evidence
<!-- doc-id: docs-operations-conformance -->

[한국어](conformance.ko.md).

[`contracts/features.json`](../../contracts/features.json) is the standard every runtime is
measured against. Each feature declares its supported runtimes (`pass`) and the shared fixtures that prove it.
The manifest's `fixtures` list registers every fixture: a `cases.json` family, or a module fixture with its declared `cases` or the module
export that lists them.

Fixture applicability is explicit when a family exercises only some implementations. A fixture's `runtimes` lists
its actual execution runtimes; without it every supported runtime remains required. `featureCases` maps each owning
feature to its exact case names when a family tests several operations. Every case must belong to a feature, every
owning feature must select cases, and every supported feature runtime must still have applicable cases. Unknown
runtimes, unknown cases and empty selections fail the check.

`featureRuntimes` restricts one owning feature to the fixture runtimes in which that operation actually runs. An omitted
feature keeps the fixture's default runtime coverage. Each override must select nonempty runtimes supported by that
feature and allowed by the fixture. Python outline cases compile and bind their template before building the outline;
other outline checks record only the target operations that they execute.

A `support-module` entry names its actual shared module and the registered case fixtures in `supports` that execute
through it. It declares no invented case and supplies no passing evidence. Each supported fixture must be registered
and proven by a feature; the module file must exist. The form-state registration module supports the state fixture units.

## Runtime keys

| Key | Implementation |
| --- | --- |
| `javascript` | `@polyspec/crudui-validator` and the `@polyspec/crudui-generator-core` model |
| `javascript-html` | the `@polyspec/crudui-generator-html` string renderer |
| `javascript-dom` | the `@polyspec/crudui-generator-core` DOM binding over `@polyspec/crudui-generator-html` markup |
| `react`, `vue`, `svelte` | the framework packages |
| `php`, `go`, `rust`, `python` | the server libraries |
| `php-native` | the PHP C extension |

JavaScript has two keys for server output because its model and its string renderer are separate
packages; PHP, Go and Rust ship both in one library and prove model and HTML features under one
key.

## Evidence

A test that runs a shared fixture case records one line for each feature the case proves:
`{"feature", "fixture", "runtime", "case", "passed"}`. `passed` is true only when every assertion
of that case succeeded. The recorders are
[`tests/conformance/evidence.mts`](../../tests/conformance/evidence.mts),
the class `Polyspec\Crudui\Conformance\Evidence` of
[`tests/conformance/php/Evidence.php`](../../tests/conformance/php/Evidence.php), the Go package
`legacy/packages/validator/go/testsupport/conformance` and the Rust test module `tests/common`. They write only when
`CRUDUI_CONFORMANCE_EVIDENCE` names a directory.

[`scripts/check-conformance.mts`](../../scripts/check-conformance.mts) reads that directory and
fails when:

- a supported runtime has no evidence, or failing evidence, for a case of a fixture its feature
  names;
- evidence exists for a feature, fixture, runtime or case the standard does not declare, such as
  a test for a runtime outside the fixture applicability, or a case assigned to another operation;
- a directory under `tests/fixtures` has no registered fixture, or a registered case fixture is
  proven by no feature;
- a feature names a fixture that is not a registered case fixture.

The optional `phpExtensions` field records the PHP modules requested by the runner, relative to the repository root.
A generator PHP source run and an extension run are separate suite commands even when their case arguments match.
Suite status describes command execution only; passing case evidence still comes from the test's actual runtime.

## Suite runs

A missing case does not tell whether its suite failed, did not finish or did not run, so each run of
a suite that records evidence also leaves a run record in `runs/` of the evidence directory:
[`tests/conformance/run-suite.mts`](../../tests/conformance/run-suite.mts) for the test command of a suite that it
starts through `node_modules/@polyspec/kit/dist/run-tests.mjs` and
[`tests/native-generators/run.mts`](../../tests/native-generators/run.mts) for itself, through
[`tests/conformance/runs.mts`](../../tests/conformance/runs.mts). A record
`{"program", "tool", "cwd", "args", "started", "status"}` is written with `status` `null` when the run
starts and again with the exit status when its process exits, so a stopped run keeps `null`. The
Python suites run through `run-suite.mts` too, with the Python of the environment `var/python` that
`make crudui-install-python` makes, and record their evidence with the package `polyspec.crudui.conformance` of
[`tests/conformance/python`](../../tests/conformance/python/pyproject.toml).

`evidenceSuites` of the check declares each suite with the command that runs it and the runtimes it
proves. For each feature, fixture and runtime with missing or failing evidence, the check names every
suite that proves the runtime with its state: `did not run` when no record matches its command,
`did not finish` when a record has no status, `ended with failure (exit <status>)` or `passed`. The
latest record of each matching command decides, and a suite run by several commands takes the worst
state of them. Every runtime that a feature supports is proven by a declared suite.

Server runtimes are compared byte for byte with the JavaScript reference output by
[`tests/native-generators/run.mts`](../../tests/native-generators/run.mts); client renderers are
compared with the fixture's normalized HTML, where only differences a framework itself causes are
normalized.

CI runs `make crudui-test-cross-language-equivalence` in the independent `cross-language-equivalence` job.
It compares JavaScript, HTML, Go, Rust, Python, PHP and the native PHP extension without waiting for language unit jobs.
The job prepares its own build and dependencies and uploads both comparison reports and conformance evidence.
Both `conformance` and `ci-passed` require this job.

`make conformance` clears the directory, runs every suite that records evidence and runs the
check. CI uploads each job's evidence under an artifact name of its own and runs the check once
over all of it: the conformance job downloads each artifact into a directory of its own, and the
check reads the evidence files and the `runs/` records of the directory and of its subdirectories,
so no file of one job replaces a file of the same name from another job.
