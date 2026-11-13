# Cross-Check Console — client
<!-- doc-id: legacy-examples-cross-check-console-client-readme -->

[한국어](README.ko.md).

Single-page, no-build console that drives the cross-check gateway. Plain ES
modules; the only runtime dependency is `js-yaml`, loaded via importmap from a
CDN (drop a local copy at `./vendor/js-yaml.mjs` and add it to the importmap to
run offline). No bundler, no transpile step — the gateway serves this directory
statically at `/`.

## What it does

The console has three tabs (form, list, detail) over the gateway's six endpoints. Each
tab flows arbitrary spec + data (or list-spec + rows, or detail-spec + record) through its endpoints in
parallel, then judges agreement itself and exposes the raw responses so its own
judgement can be re-checked.

form tab:

- `POST /api/validate` `{spec, data, files?, basepath?}` → 4-language CRUDUI FORM
  validation (`js` / `php` / `go` / `rust`). Each entry:
  `{lang, ok, valid, errors[{path,field,rule,message,value}], ms, failure}`.
  `failure` `{code, message, at}` (unresolved `$ref`, forbidden key, data with
  the wrong shape) is distinct from `valid:false`.
- `POST /api/render` `{spec, data, options}` → 3-framework CRUDUI FORM SSR
  (`react` / `vue` / `svelte`). Each entry:
  `{fw, ok, html, normalized, ms, error}`. `error` carries
  `REF_FILE_NOT_FOUND` / `UNSUPPORTED_FIELD_TYPE`.

list tab:

- `POST /api/validate-list` `{listSpec, files?, basepath?}` → 4-language CRUDUI list
  STRUCTURE validation (compose → forbidden-scan; no rows — a list has no data).
  The validate sister of `/api/validate`: SAME per-entry envelope and idempotency
  matrix, a forbidden meta key surfaces as the SAME `failure`, a clean structure
  is `valid:true`.
- `POST /api/render-list` `{listSpec, rows, options}` → 3-framework CRUDUI list SSR
  over the INJECTED rows. SAME per-entry envelope and parity matrix as
  `/api/render`. Columns / format / pagination are declared; rows are a separate
  JSON editor (DB-agnostic).
- `POST /api/render` `{spec:<listSpec.search>, …}` → the embedded `search` slot IS
  a form-spec, rendered through the SAME form endpoint to prove it round-trips
  unchanged. The list renderers ignore the `search` slot, so the SAME spec object
  is what the form endpoint receives.

detail tab:

- `POST /api/validate-detail` `{detailSpec, files?, basepath?}` → 4-language CRUDUI
  detail STRUCTURE validation (compose → forbidden-scan; the record is not
  validated). SAME per-entry envelope and idempotency matrix as `/api/validate`.
- `POST /api/render-detail` `{detailSpec, record, options}` → 3-framework CRUDUI
  detail SSR over one INJECTED record. SAME per-entry envelope and parity matrix
  as `/api/render`; React's image preload links are stripped before comparison.

Every endpoint always answers HTTP 200; a failed validation or a missing `$ref`
is data, not an HTTP error. The `{error}` envelope is reserved for transport /
server faults (4xx/5xx).

## On screen at startup

- Header: `form` / `list` / `detail` tab buttons, a per-tab example selector (form: basic /
  complex / edge-ref / edge-unsupported / mismatch-slot; list: list-basic /
  list-search-conditional; detail: detail-basic / detail-design /
  detail-condition-hidden / detail-edge-forbidden / detail-edge-record), KO/EN language toggle (→ `options.language`),
  `unsupported` selector (`throw` / `marker`, form tab only), `raw` toggle, doc
  button, fixture-export button. Per-tab header controls are gated by `data-tab`.

form tab:

- Left: YAML spec editor + JSON data editor, each with a green/red parse badge.
  A parse failure disables the run button.
- `검증 + 렌더 실행` button → `Promise.all` over `/api/validate` + `/api/render`.
- Validate matrix: 4 columns (lang + ms), valid/invalid badge, error list
  (`field: message (rule)`), `FAILURE` badge with code, message and location for
  `failure`. A green
  `4언어 멱등 일치` badge when all 4 agree; red `결과 불일치!` + per-lang diff
  table + red borders on the divergent columns otherwise.
- Render matrix: 3 columns, sandboxed `srcdoc` iframe preview, toggle to raw
  HTML source, red `ERROR` badge for `error`. Green `3프레임워크 parity 일치`
  badge when normalized HTML agrees; red + diff table + red borders otherwise.

list tab (top-down: validate → search → list, mirroring the form tab):

- Left: list-spec YAML editor + injected-rows JSON editor, each with a parse
  badge (rows badge shows the row count); a parse failure disables the list run.
- `list 렌더 실행` button → `Promise.all` over `/api/validate-list` +
  `/api/render-list`, plus `/api/render` of `listSpec.search` when a search slot
  is declared.
- List validate matrix: the SAME 4-language idempotency matrix as the form tab,
  over the list STRUCTURE (no data pass; forbidden key → `FAILURE` cell with code and location).
- Search-form matrix: the embedded `search` form-spec rendered through
  `/api/render` (form reuse) in the SAME 3-framework parity matrix; an idle note
  when the list-spec has no `search` slot.
- List render matrix: the SAME 3-framework parity matrix over `/api/render-list`,
  the rendered table (columns / format / pagination) across react / vue / svelte.

detail tab (top-down: validate → render):

- Left: detail-spec YAML editor + record JSON editor, each with a parse badge; a
  parse failure disables the run. The record editor accepts any JSON value and
  sends it verbatim, so a non-object record shows the renderers'
  `INVALID_FORM_INPUT` cells.
- `detail 검증 + 렌더 실행` button → `Promise.all` over `/api/validate-detail` +
  `/api/render-detail`.
- Detail validate matrix: the SAME 4-language idempotency matrix (a forbidden meta
  key → `FAILURE` cell with code and location).
- Detail render matrix: the SAME 3-framework parity matrix, the rendered definition
  list across react / vue / svelte.

shared:

- `raw` toggle: every cell shows the server's verbatim JSON entry, so the
  console's idempotent/parity verdict can be audited against the source data.
- Collapsible doc panel: per-tab CRUDUI syntax summary (form: role slots, condition
  maps, compose, lang, design node map; list: columns / format / search /
  pagination; detail: fields / record / design / structure validation / parity),
  plus the independent-verification rationale.

## Features

- Three tabs (form, list, detail) over the six endpoints; the panels never share DOM.
- Matrix view (form: 4× validate + 3× render; list: 4× validate + 3× search
  render + 3× list render; detail: 4× validate + 3× detail render).
- Self-computed idempotent (4 langs) + parity (3 frameworks) badges, derived
  from the raw per-entry results — not the server's own verdict. Undetermined
  (null) when fewer than two langs/frameworks ran, distinct from a mismatch.
- `raw` toggle to bypass the console's judgement and read source responses.
- In-page per-tab doc panel.
- Form examples quoted from `legacy/tests/fixtures/{validate,form-render}/cases.json` and
  list examples from `legacy/tests/fixtures/list-render/cases.json`, detail examples from
  `legacy/tests/fixtures/{detail-render,detail-validity}/cases.json` (no invented
  shapes), including edge cases that should fail uniformly across all
  languages/frameworks and an empty "intentional-divergence" slot.
- Fixture export (per tab): serializes the current run into the matching
  `cases.json` shape, one case per language/framework — form validate
  `{name,note,spec,data,expected:{valid,errors,hidden}}`, form-render
  `{name,note,spec,data,options,expected_html}`, and list
  `{name,note,spec,rows,options,expected_html|expected_error}`, and detail
  `{name,note,spec,record,options,expected_html|expectError}`. Paste an exported
  divergent case to the automated checks (the shared `legacy/tests/fixtures/*/cases.json`
  conformance suites)
  to retain it as a regression test.

## Run

The gateway serves this directory statically. From the console root:

```
node ../server/server.mjs      # serves client/ at http://localhost:<port>/
```

Then open `http://localhost:<port>/`. For a split deploy, pass the gateway
origin: `http://localhost:5173/?api=http://localhost:8020`.

## Independent verification

The console and the automated conformance checks call the same CRUDUI functions
(`validate`, `renderForm`) through DIFFERENT call stacks:
the console uses the HTTP gateway with free-form live input, while the checks use
vitest / go test / cargo test / php worker with fixed fixtures. Same input must
yield the same result — when it does not, a wrapper bug surfaces. The `raw`
toggle keeps the console's own verdict auditable, and fixture export feeds live
differences into the fixed conformance suite.
