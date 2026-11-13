# Package build checks
<!-- doc-id: tests-build-readme -->

[한국어](README.ko.md).

Run from the repository root:

```sh
npm ci --strict-allow-scripts
npm run test:runtimes
npm run test:dependencies
npm run build
npm run test:build
npm run test:build:repeat
npm run test:packages
```

`test:runtimes` requires one exact release of every tool: Rust in
`rust-toolchain.toml`, the PHP minors in `config/toolchain.json`, and Node.js, Go, Python and Composer in `mise.toml`;
The recorded releases of the tools are the declarations and manifest floors to be
the pins of kit. Every CI job runs on `ubuntu-24.04`, names its actions by
commit SHA, sets up the recorded releases and checks the tools it set up; the checkout tracks
no container definition; no browser of a release channel or of the machine is used.
`devEngines.packageManager` of `package.json` records one exact npm release;
the check fails when the running npm or a workflow step
selects another release, and `make install-tools` installs it into `var/tools` of the checkout.
`tests/build/tool-path.test.mts` fails when a script, a make target or a CI step installs npm into the machine,
or when make or a CI job does not put `var/tools/bin` first on `PATH`. The runtime checks run repository Rust Node.js entry points without
Cargo on the process `PATH`. Each entry point must resolve Cargo, rustc and
rustdoc from one toolchain record and supply the resolved compiler paths to
Cargo.

`test:dependencies` rejects invalid, missing and conflicting installed packages.
For every tracked npm lock file, it also rejects moderate, high and critical
advisories, unapproved lifecycle scripts and script approvals that do not name an
exact package version.

`test:runtimes` also runs the contract manifest check on synthetic repositories and on this
repository: every package entry is declared with its exact value exports and visibility, and only
CRUDUI package code imports an internal entry.

`test:build` loads validator, generator-core, generator-html and generator-react through their
public CommonJS and ESM exports, and generator-core's internal entry in both formats. It compiles strict NodeNext type projects with
`skipLibCheck: false` against the declarations of validator, generator-core, generator-html,
generator-react, generator-vue, generator-svelte and form-binding, checks the complete declaration graph and verifies React's
exported stylesheet. Invalid public types must prevent declaration emission in
all four TypeScript package configurations. It also checks that each script that runs other
commands stops a command that never ends, with its whole process group, at the command's limit
([command limits](../../docs/operations/testing.md#commands-of-long-operations)).

`test:bench` checks that the JavaScript, PHP, Go and Rust benchmark drivers and
`benchmarks/validators/run.js` accept and reject the iteration counts of
`benchmarks/validators/iteration-arguments.json` by one rule with one message. It needs PHP, Go
and Rust; the native generation job of CI runs it. It first builds the packages and then the Go and
Rust drivers with `benchmarks/validators/build-drivers.mjs`, which streams each build's output and prints its
result with its elapsed time, without a time limit; the test runs the built drivers, and each of its
tests has the 30-second timeout of the test runner.

`test:build:repeat` runs the complete build twice with `scripts/repeat-build.mts`, a logged step
without a time limit that reads the path and SHA-256 digest of every output file of the published
packages after each build and fails with every file that differs between its two builds; it keeps no
record between runs. The test covers the package list and the comparison without a build, each test
within the 30-second timeout of the test runner.

`test:packages` builds and packs the packages, installs them into a separate
install project, compiles all framework types, builds the install project and runs
its three form components in a browser. These checks do not replace form
validation, persistence or the full interaction matrix.
