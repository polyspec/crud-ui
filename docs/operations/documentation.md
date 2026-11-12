# Documentation maintenance
<!-- doc-id: docs-operations-documentation -->

[한국어](documentation.ko.md).

| Location | Content |
| --- | --- |
| `README.md` | Project introduction, minimum setup and document links. |
| `docs/spec/` | Approved structures, contracts, rules and acceptance criteria. |
| `docs/features.md` | Implementation, verification evidence and deployment status. |
| `docs/operations/` | Current setup, execution, deployment and verification procedures. |
| `CHANGELOG.md` | Actual behavior changes and verification results. |
| `docs/plans/` | Proposals awaiting approval; remove after incorporation into the specification. |
| `AGENTS.md` | Development procedures and required checks. |

Each subject has a document for each supported language. Update the language
versions in the same change and compare their meaning. Store personal
preferences and conversation context outside Git.

Documentation navigation uses English and includes a Korean document index. API navigation
includes the validator, shared generator core and all three framework packages,
plus Go, Rust and PHP references.

Update the specification before changing direction. Mark unfinished behavior in
the feature table. Update implementation status, verification evidence and the
changelog with the behavior change. Test results apply only to the code tested;
they do not establish deployment.

Run `make docs-check` for API documentation, local links, required translations
and feature status fields. Run `make docs` to generate API references, schema and
the documentation web. Automated checks do not establish content accuracy;
review the relevant source and tests before recording a result.

`npm run docs:dev` registers a recursive file-system subscription under `docs/`
before the initial build. It excludes generated `docs/.web/` events, serializes
rebuilds and combines source events received during one build into one additional
build. A build failure is reported and a later source event can request another
build. A file-system subscription failure closes the server with status 1. The
development server does not scan source files on an interval.

The documentation web build checks internal links. Fix invalid source or
generated links instead of disabling the link check for the whole web.
API Documenter generates relative links and an `index` page for each TypeScript package.
Relative links to repository files outside `docs/` are checked for file existence
and rendered as GitHub source links on the web. Document sources retain their
repository-relative links. A missing repository file fails the build.

API generation requires API Extractor, API Documenter, Go, Cargo and phpDocumentor. For each TypeScript package, API
Extractor checks the public API against the committed report `etc/<package>.api.md` and writes its doc model to
`var/api-model/<package>`, and API Documenter writes the Markdown pages of that model to `docs/api/<package>`. A tool failure or
missing output fails generation; the generator does not replace failed output
with a success page. PHP documentation uses `var/tools/phpdocumentor/phpDocumentor.phar`.

`make crudui-install-phpdocumentor` installs phpDocumentor 3.10.0 and checks it by its SHA-256. Go, Cargo and PHP must be
available on `PATH`; PHP requires the mbstring extension.

```sh
make crudui-install-phpdocumentor
make docs
make docs-verify-idempotent
```

TypeScript references describe the five public package entries. Svelte uses its
built declarations, including `Form`. Native PHP and Rust HTML is included in the web under `docs/public/api/`. The repeated
generation check compares those assets, Markdown references and the schema.
Go references include every package under `validator/`, including composition,
expressions and validation.

Use repository-relative paths in scripts and documents. External source tools
must require an explicit input path. They must not depend on another project's
checkout or a developer's home directory.

`make docs-check` (`node_modules/@polyspec/kit/dist/check-documents.mjs`, `config/documents.json`) checks every
Markdown document of the repository except
`legacy/examples/cross-check-console/client/README.md` and `benchmarks/validators/README.md`. Each English document
has a Korean twin `.ko.md`, and both files hold the same marker `<!-- doc-id: <id> -->`, where the
id is the path of the English file without `.md`, in lowercase, with `-` between words. The Korean
file also holds `<!-- source-sha256: <sha256> -->`, the sha256 of the English file: after a change
to an English document, review the Korean twin and run `make documents-stamp`, which
sets the marker of every Korean file to the sha256 of its English file. The check compares explicit section anchors, fenced code blocks
(info string and content), relative links and anchors, the feature status table
(`docs/features.md`) and `CHANGELOG.md`; prose equivalence requires review.

## GitHub Pages

The documentation URL is `https://polyspec.github.io/crudui/`. The repository's
Pages publishing source is **GitHub Actions**. [CI](../../.github/workflows/ci.yml)
runs `make docs-check` with `DOCS_BASE_PATH=/crudui/`, uploads `docs/.web/dist`,
and deploys it to the `github-pages` environment. A `main` push or manual CI run
on `main` publishes the web.

Preview the published path from the repository root:

```sh
DOCS_BASE_PATH=/crudui/ npm run docs:preview
```

Open `http://127.0.0.1:4173/crudui/`. Confirm the GitHub deployment result and
the public index, a Korean page, an API entry and the stylesheet before updating
[deployment status](../features.md).

## Repository writing

Maintained documentation, comments, change records and user-visible text describe
current behavior directly. Each statement names the component, operation, target
and result. A necessary cause is stated in one sentence. Test results use
`passes` and `fails`, and acceptance checks use `check` or `verification`.

These records do not use metaphors, personification, color-coded test status,
informal conversation or implementation-origin history. They do not identify
an external project unless its identity, API or
path is required to run the current operation. Language versions provide the same
information.

`npm run test:docs` checks maintained Markdown, source comments and descriptive
fixture text for the defined writing rules. External dependencies, generated
references retain their original contents and are
excluded from this check.
