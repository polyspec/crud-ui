<!-- doc-id: rebuild-test-commands -->
# Rebuild record: test-commands

[한국어](test-commands.ko.md)

Verdict: **none fits**; crudui keeps its own implementation. Measured on 2026-10-20.

## Covers

- `scripts/test-commands.mts`

## Requirement

Every test the project runs goes through the run-tests tool of `@polyspec/kit`, which prints each test as it starts, passes or
fails and stops a test that outlives its timeout. `tests/build/test-commands.test.mts` needs to find, in the Makefile, the
scripts of `package.json` and the steps of the CI workflows, every command that calls a test tool directly, every Makefile
target that takes a test target as a prerequisite, and every CI time limit over a test step.

## Tools evaluated

| Tool | State | Verdict |
|---|---|---|
| kit 0.0.54 (`test-markers-check`, `ci-targets`, `parity`) | installed | `test-markers-check` reads the test files, `ci-targets` runs targets and `parity` reads the units of the implementations; none reads the commands of a Makefile, a package script or a workflow for a direct call of a test tool |
| actionlint, shellcheck | not installed | check the syntax of workflows and shell, not which tool a command runs |
| ESLint, knip | installed | read JavaScript sources and manifests, not the commands of a Makefile or a workflow |

## Why none fits

No tool reads the commands of the Makefile, the package scripts and the workflow steps for the rule that tests run only through
the run-tests tool. The rule is a polyspec rule (S3), so kit is its owner.

## Retry condition

Replace this implementation when kit provides the check; the question whether kit owns it is open with the conductor.
