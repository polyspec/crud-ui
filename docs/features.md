# Feature status
<!-- doc-id: docs-features -->

[한국어](features.ko.md). Contracts are defined in [spec](spec/form-runtime.md).
Tests and deployment are recorded separately. `pending` is not a passing result.

| ID | Feature | Implementation | Verification | Deployment | Evidence |
| --- | --- | --- | --- | --- | --- |
| condition-trees | The rule `conditionTree`, which checks that a field value is a condition tree of all, any, field comparisons and judged text, in six validators | implemented | passed | not-deployed | [Condition trees](spec/schema.md#condition-trees), [validation rule](spec/validation-rules.md#condition-trees), [shared cases](../tests/fixtures/validate/condition-tree.mts) |
| condition-control | A `condition` field whose textarea holds its condition tree as JSON text, rendered by eight renderers, decoded back into the tree by `connectForm` and the browser validation, and checked by its required `conditionTree` rule | implemented | passed | not-deployed | [Specification](spec/schema.md#condition-fields), [form markup](spec/form-markup.md#condition-fields), [condition values](spec/form-runtime.md#condition-values); the [shared form cases](../packages/react/scripts/generate-form-render-cases.mts) `condition-*` compare React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go, Rust and Python; [shared validation case](../tests/fixtures/validate/condition-field.mts) `condition-field-values`; browser decoding in `connectForm` ([cases](../legacy/packages/generator/ts/src/dom-sync.test.ts)) and `@polyspec/crudui-form-binding` ([data cases](../packages/form-binding/tests/data.test.ts)) |
| condition-editor | A structured editor of a `condition` field (`design.editor: structured`) that every renderer writes as a view of the condition tree after its hidden textarea, with a named error and the visible textarea for a value it cannot show, and whose controls and buttons `connectForm` applies to the tree | implemented | passed | not-deployed | [Specification](spec/schema.md#structured-condition-editor), [form markup](spec/form-markup.md#structured-condition-editor), [condition values](spec/form-runtime.md#condition-values); the [shared form cases](../packages/react/scripts/condition-editor-form-render-cases.ts) `condition-editor-*` and `condition-fields-*` compare React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go, Rust and Python; [shared spec case](../tests/fixtures/spec-validity/cases.json) `ok-condition-editor`; the editor edits of `connectForm` ([cases](../legacy/packages/generator/ts/src/condition-editor.test.ts)) |
| control-attributes | Declared `attributes` of a field's control and its node written as attributes in eight renderers, limited to `data-*` and `aria-*` names | implemented | passed | not-deployed | [Specification](spec/schema.md#declared-attributes), [form markup](spec/form-markup.md#declared-attributes); `@polyspec/crudui-generator-core` ([model and check cases](../legacy/packages/generator/ts/src/declared-attributes.test.ts)), `@polyspec/crudui-generator-html` ([byte cases](../legacy/packages/html/src/declared-attributes.test.ts)), React ([byte cases](../packages/react/src/tests/declared-attributes.test.ts)), the JSON Schema and the typed specification models of the PHP, Go and Rust validators; the [shared form cases](../packages/react/scripts/generate-form-render-cases.mts) `control-attributes-*` compare React, Vue, Svelte, the HTML renderer, PHP, the PHP extension, Go and Rust |
| switch-control | A `switcher` field rendered as a switch (`role="switch"`) distinct from a checkbox in eight renderers | implemented | passed | not-deployed | [Form markup](spec/form-markup.md#switches); `@polyspec/crudui-generator-core` ([model cases](../legacy/packages/generator/ts/src/switch-control.test.ts)), `@polyspec/crudui-generator-html` ([byte cases](../legacy/packages/html/src/switch-control.test.ts)), React ([byte case](../packages/react/src/tests/switch-control.test.ts)), Vue ([case](../packages/vue/tests/switch-control.test.mjs)), Svelte ([case](../packages/svelte/tests/switch-control.test.mjs)), the stylesheet ([browser check](../tests/form-styles.test.mts)), and PHP, the PHP extension, Go and Rust in the [native suite](../tests/native-generators/README.md) with the shared form cases `switcher-bare` and `control-attributes-checkbox` |
| range-control | A `range` field rendered as a slider with its bounds, step and current value in eight renderers and validated in five validators | implemented | passed | not-deployed | [Specification](spec/schema.md#range-fields), [form markup](spec/form-markup.md#range-fields); implemented in `@polyspec/crudui-generator-core` ([model and check cases](../legacy/packages/generator/ts/src/range-control.test.ts)), `@polyspec/crudui-generator-html` ([byte cases](../legacy/packages/html/src/range-control.test.ts)), the stylesheet and the JSON Schema; the existing `range` and `step` rules validate the value ([TypeScript cases](../legacy/packages/validator/ts/src/range-field.test.ts), [shared validation case](../tests/fixtures/validate/numeric-rules.mts) `range-field-values`); the [shared form cases](../packages/react/scripts/generate-form-render-cases.mts) `range-*` compare React, Vue, Svelte and, in the [native suite](../tests/native-generators/README.md), PHP, the PHP extension, Go and Rust |
| button-control | A `button` field rendered as a `button` element with its content and attributes and no script in eight renderers | implemented | passed | not-deployed | [Form markup](spec/form-markup.md#button-fields); `@polyspec/crudui-generator-core` ([model cases](../legacy/packages/generator/ts/src/button-control.test.ts)), `@polyspec/crudui-generator-html` ([byte cases](../legacy/packages/html/src/button-control.test.ts)), React ([byte cases](../packages/react/src/tests/button-control.test.ts), [script check](../tests/widget-scripts.test.mts)), Vue ([cases](../packages/vue/tests/button-control.test.mjs)), Svelte ([cases](../packages/svelte/tests/button-control.test.mjs)), the stylesheet ([browser layout check](../tests/form-styles.test.mts)), and PHP, the PHP extension, Go and Rust in the [native suite](../tests/native-generators/README.md) with the shared form cases `button-empty`, `action-alias`, `button-behavior-onclick` and `control-attributes-file-display-button` |
| choice-appearance | A class and style for each choice of a choice field in eight renderers, so a choice field can render as a grid of swatches | implemented | passed | not-deployed | [Specification](spec/schema.md#choice-appearance), [form markup](spec/form-markup.md#choice-appearance); implemented in `@polyspec/crudui-generator-core` ([model and check cases](../legacy/packages/generator/ts/src/choice-appearance.test.ts)) and `@polyspec/crudui-generator-html` ([byte cases](../legacy/packages/html/src/choice-appearance.test.ts)) and the JSON Schema; the [shared form cases](../packages/react/scripts/generate-form-render-cases.mts) `choice-appearance-*` compare React, Vue, Svelte and, in the [native suite](../tests/native-generators/README.md), PHP, the PHP extension, Go and Rust |
| display-switching | Fields and groups shown by the `design.show` of their parent values in the browser binding, relative paths that treat a repeated row as one level, the hidden paths in the validation result and shared cases of conditional required fields in five validators | implemented | pending | not-deployed | [Display](../packages/form-binding/README.md#display), [visibility](spec/validation-rules.md#evaluation), [relative paths](spec/expressions.md#5-evaluation); the [binding cases](../packages/form-binding/tests/display.test.ts), the [hidden path cases](../legacy/packages/validator/ts/src/hidden-paths.test.ts), the [shared validation cases](../tests/fixtures/validate/visibility.mts) `switch-*`, `visibility-row-parent-*` and `visibility-show-literal-identifier`, the [shared expression cases](../legacy/packages/validator/ts/scripts/generate-expr-cases.mts) `path-row-*` and the [shared form cases](../packages/react/scripts/written-form-render-cases.ts) `design-show-row-parent-*`; the native and browser comparisons run in CI |
| choice-groups | Group entries in the choice list of a `select` field rendered as `optgroup` elements with their options in eight renderers, and the values inside groups accepted as the field's choices by `in` in five validators | implemented | passed | not-deployed | [Specification](spec/schema.md#choice-groups), [form markup](spec/form-markup.md#choice-groups); implemented in `@polyspec/crudui-generator-core` ([model and check cases](../legacy/packages/generator/ts/src/choice-groups.test.ts)), `@polyspec/crudui-generator-html` ([byte cases](../legacy/packages/html/src/choice-groups.test.ts)), React ([byte and component cases](../packages/react/src/tests/choice-groups.test.tsx)), Vue ([cases](../packages/vue/tests/choice-groups.test.mjs)), Svelte ([cases](../packages/svelte/tests/choice-groups.test.mjs)), the TypeScript validator's `in` ([cases](../legacy/packages/validator/ts/src/choice-groups.test.ts)), its types and the JSON Schema; the [shared form cases](../packages/react/scripts/generate-form-render-cases.mts) `choice-groups-*`, the list case `reject-format-items-choice-group` and the [shared validation cases](../tests/fixtures/validate/value-rules.mts) `value-in-choice-groups*` compare the implementations, including PHP, the PHP extension, Go and Rust in the [native suite](../tests/native-generators/README.md) and the PHP, PHP extension, Go and Rust validators |
| inline-layout | A form layout that places each field's label and control on one row in eight renderers | implemented | passed | not-deployed | [Specification](spec/schema.md#layout), [form markup](spec/form-markup.md#layout); implemented in `@polyspec/crudui-generator-core` ([model and check cases](../legacy/packages/generator/ts/src/inline-layout.test.ts)), `@polyspec/crudui-generator-html` ([byte cases](../legacy/packages/html/src/inline-layout.test.ts)), the stylesheet ([browser layout check](../tests/form-styles.test.mts)) and the JSON Schema; the label of a checkbox or switcher field in the header of an inline layout is implemented in the node model and in React ([server and component cases](../packages/react/src/tests/inline-layout.test.tsx)), Vue ([cases](../packages/vue/tests/inline-layout.test.mjs)) and Svelte ([cases](../packages/svelte/tests/inline-layout.test.mjs)); the [shared form cases](../packages/react/scripts/generate-form-render-cases.mts) `inline-layout-*` and six written layout cases compare the eight renderers, including PHP, the PHP extension, Go and Rust in the [native suite](../tests/native-generators/README.md) |
| collection-controls | Proposal outside the current row contract: declared texts and attributes of row controls and an add control after the last row in eight renderers | not-started | pending | not-deployed | [Form markup](spec/form-markup.md#rows) |
| validator-responses | Validator process status and complete response checks | implemented | passed | not-deployed | [Response tests](../examples/cross-check-console/server/validate-response.test.mjs), [Validator process cases](../examples/cross-check-console/validators/README.md) |
| php-api | Common PHP and extension classes with identical methods | implemented | passed | not-deployed | [PHP API contract](operations/php-extension.md) |
| generator-php | PHP form generation and SSR | implemented | passed | not-deployed | [Runtime contract](spec/runtime-packages.md) |
| generator-go | Go form generation and SSR | implemented | passed | not-deployed | [Runtime contract](spec/runtime-packages.md) |
| generator-rust | Rust form generation and SSR | implemented | passed | not-deployed | [Runtime contract](spec/runtime-packages.md) |
| generator-python | Python form generation, list and detail rendering, and the native generator checks of the Python program | implemented | passed | not-deployed | [Runtime contract](spec/runtime-packages.md) |
| validator-python | Python validation of forms, lists and details, the composition and expression rules of the shared fixtures | implemented | passed | not-deployed | [Runtime contract](spec/runtime-packages.md) |
| generator-html | Framework-independent form and list HTML rendering | implemented | passed | not-deployed | [Feature contract](operations/feature-contracts.md) |
| php-extension | Native PHP form generation and validation | implemented | passed | not-deployed | [Extension contract](operations/php-extension.md) |
| server-template-browser | Current keyed browser instances from serialized server-compiled templates | implemented | passed | not-deployed | [Local verification](operations/form-comparison.md#local-verification) (`make crudui-test-form-comparison-checks`, CI job `form-comparison-browser`): the initialization reports of [`check.mjs`](../examples/form-comparison/check.mjs) |
| native-generation-integration | Current four-server generation, SSR, transport, persistence and browser integration | implemented | passed | not-deployed | [Local verification](operations/form-comparison.md#local-verification) (`make crudui-test-form-comparison-checks`, CI job `form-comparison-browser` and `form-comparison-checks`): [`check-generation.mjs`](../examples/form-comparison/check-generation.mjs), [`check-servers.mjs`](../examples/form-comparison/check-servers.mjs), [`check-pipeline.mjs`](../examples/form-comparison/check-pipeline.mjs) and [`check.mjs`](../examples/form-comparison/check.mjs) |
| expressions | Shared expression grammar and boolean conversion | implemented | passed | not-deployed | [Expression contract](spec/expressions.md) |
| cli | Catalog, static checks and specification descriptions | implemented | passed | not-deployed | [CLI procedure](operations/cli.md) |
| unique-json-members | Reject repeated decoded JSON member names in specification text | implemented | passed | not-deployed | [Input text contract](spec/input-text.md), [parser tests](../legacy/packages/validator/ts/src/text/json.test.ts) |
| json-text-values | Preserve JSON object member names, values and order during Rust validation | implemented | passed | not-deployed | [Input text contract](spec/input-text.md), [Rust text cases](../packages/validator/rust/tests/text_validity_conformance.rs) |
| viewport-widths | Every shared render case fits viewports of 360 and 1280 CSS pixels with `crudui.css`, a list scrolling a wide table on its own | implemented | passed | not-deployed | [Viewport widths](spec/form-markup.md#viewport-widths), [viewport test](../tests/viewport.test.mts) |
| tailwind-styles | `crudui.css` imported into the Tailwind CSS layer `components` (no generated file), with the same computed styles | implemented | passed | not-deployed | [Tailwind CSS](spec/form-markup.md#tailwind-css), [comparison test](../tests/tailwind-styles.test.mts) |
| complete-form | Complete form with form element, hidden inputs, form and node errors in eight string renderers | implemented | passed | not-deployed | [Complete form](spec/form-runtime.md#complete-form), [shared cases](../tests/fixtures/form-complete/README.md) |
| choice-lists | Choice lists of value and label pairs in written order for any values, in eight form renderers, five display renderers, five validators and the CLI | implemented | passed | not-deployed | [Choice lists](spec/schema.md#choice-lists), [form cases](../packages/react/scripts/written-form-render-cases.ts), [validation cases](../tests/fixtures/validate/value-rules.mts) |
| display-descriptions-actions | Form root and list descriptions and detail actions in eight renderers | implemented | passed | not-deployed | [Display formats](spec/display-formats.md#markup), [complete form](spec/form-runtime.md#complete-form), [list cases](../tests/fixtures/list-render/README.md), [detail cases](../tests/fixtures/detail-render/README.md) |
| action-event-attributes | List and detail action `behavior` members written once as their event attributes in eight renderers | implemented | passed | not-deployed | [Display formats](spec/display-formats.md#markup), [list cases](../tests/fixtures/list-render/README.md), [detail cases](../tests/fixtures/detail-render/README.md) |
| script-action-click | A list or detail script action runs its script on the click of its button in eight renderers and three browsers | implemented | passed | not-deployed | [Display formats](spec/display-formats.md#markup), [list cases](../tests/fixtures/list-render/README.md), [detail cases](../tests/fixtures/detail-render/README.md), [browser case](../tests/widget-script-runs.test.mts) |
| browser-validation | Browser validation of a server-rendered form with the specification of the server: data from the named controls as a submission sends it, the error markup of `renderForm`, `aria-invalid`, validation when a changed field loses focus and on submit, and cancellation of an invalid submission before other submit listeners | implemented | passed | not-deployed | [Browser validation](spec/form-runtime.md#browser-validation), [parity cases](../packages/form-binding/tests/parity.test.ts), [browser case in Chromium, Firefox and WebKit](../packages/form-binding/tests/browser.test.ts), [public package checks](../tests/build/public-packages.test.mts), [install check](../scripts/check-packages.mts), [reproducible build](../tests/build/reproducible-build.test.mts) |
| test-hook-failures | Every failure of a `node --test` or Vitest run, a failed or timed-out hook included, printed with its test file and elapsed time | implemented | passed | not-deployed | [Test runner](operations/testing.md#test-runner) |
| load-independent-checks | Linear-time checks of the validators and the PHP extension engine that read no clock | implemented | passed | not-deployed | [Time and load](operations/testing.md#time-and-load), [clock check](../tests/build/validator-test-clocks.test.mts) |
| single-choice-data | Reject an array or object as the value of a single-choice field in five validators | implemented | passed | not-deployed | [Validation rules](spec/validation-rules.md#evaluation), [shared cases](../tests/fixtures/validate/value-rules.mts) |
| empty-membership | An empty `in` list or map that matches no value in five validators | implemented | passed | not-deployed | [Validation rules](spec/validation-rules.md#values), [shared cases](../tests/fixtures/validate/value-rules.mts) |
| declared-form-data | Reject undeclared submitted fields in form data at every group level | implemented | passed | not-deployed | [Validation contract](operations/validation.md), [shared cases](../tests/fixtures/validate/cases.json) |
| form-controls | Labels, multiple choice arrays and field container paths | implemented | passed | not-deployed | [Shared control assertions](../tests/fixtures/form-session/controls.mts) |
| package-exports | Packaged exports, separate React component and server entries, type declarations and install production build | implemented | passed | not-deployed | [Install check](../scripts/check-packages.mts), [React entry check](../packages/react/src/tests/entry-boundary.test.ts) |
| package-install | Resolved dependencies and normal installation | implemented | passed | not-deployed | [npm ci / test:packages](operations/package-build.md) |
| package-build | Independent public declaration compilation | implemented | passed | not-deployed | [Build checks](../tests/build/README.md), [public type check](../tests/build/public-packages.test.mts) |
| package-api | Initial package API and version metadata | implemented | passed | not-deployed | [API contract](spec/schema.md) |
| form-template | Data-independent form templates and JSON caching | implemented | passed | not-deployed | [Core tests](../legacy/packages/generator/ts/src/form.test.ts) |
| form-initialization | Initial data, repeated injection and record restoration | implemented | passed | not-deployed | [Runtime contract](spec/form-runtime.md) |
| form-inspector | Parsed DOM, raw HTML, CSS and state comparison with retained differences | implemented | passed | not-deployed | [Inspector tests](../tests/form-inspector/form-snapshot.test.mts) |
| form-rows | Scoped nested row operations and saved sequence keys | implemented | passed | not-deployed | [Core tests](../legacy/packages/generator/ts/src/form.test.ts) |
| form-empty-rendering | Explicit empty collection rendering in the merged runtime | implemented | passed | not-deployed | [Empty collection tests](../legacy/packages/generator/ts/src/empty-collections.test.ts) |
| form-browser | Data injection and row actions in three frameworks | implemented | passed | not-deployed | [Shared DOM scenario](../tests/fixtures/form-session/scenario.mts) |
| form-typing | Native input updates with stable editable controls, focus and renderer completion | implemented | passed | not-deployed | [Local verification](operations/form-comparison.md#local-verification) (`make crudui-test-form-comparison-checks`, CI job `form-comparison-checks`): [`check-typing.mjs`](../examples/form-comparison/check-typing.mjs) |
| form-empty-focus | Focus after an empty collection creates its first row | implemented | passed | not-deployed | [Shared DOM scenario](../tests/fixtures/form-session/scenario.mts) |
| form-focus | Focus movement to the affected row after row operations | implemented | passed | not-deployed | [Local verification](operations/form-comparison.md#local-verification) (`make crudui-test-form-comparison-checks`, CI job `form-comparison-browser`): the interaction checks of [`check-interaction.mjs`](../examples/form-comparison/check-interaction.mjs) |
| form-markup | Recursive form nodes, list/detail display blocks, row cards and interface messages in five implementations | implemented | passed | not-deployed | [Form markup](spec/form-markup.md), [display formats](spec/display-formats.md) |
| crudui-details | Read-only detail specification, model, framework-independent HTML rendering and structure validation | implemented | passed | not-deployed | [Specification](spec/schema.md), [display formats](spec/display-formats.md), [feature contract](operations/feature-contracts.md), [shared detail fixture](../tests/fixtures/detail-render/README.md), [native comparison](../tests/native-generators/README.md), [detail validity cases](../tests/fixtures/detail-validity/cases.json) |
| form-view-state | Row collapse and merged undo/redo history outside record data | implemented | passed | not-deployed | [Node tests](../legacy/packages/generator/ts/src/node.test.ts) |
| display-declarations | List and detail declaration checks at render in JavaScript, the HTML renderer, PHP, the PHP extension, Go and Rust | implemented | passed | not-deployed | [Display format declarations](spec/display-formats.md#declarations), [shared list fixture](../tests/fixtures/list-render/README.md), [shared detail fixture](../tests/fixtures/detail-render/README.md), [native comparison](../tests/native-generators/README.md), [render validity test](../legacy/packages/generator/ts/src/display-validity.test.ts) |
| form-outline | Structure map and current data view | implemented | passed | not-deployed | [Form markup](spec/form-markup.md) |
| form-initialization-comparison | Side-by-side stage comparison of forms created with data and forms injected after mounting | implemented | passed | not-deployed | [Form comparison](operations/form-comparison.md) |
| keyed-validation | Key-preserving group and scalar validation in four languages | implemented | passed | not-deployed | [Shared validation cases](../tests/fixtures/validate/cases.json) |
| docs-check | Document checks and event-driven development rebuilds | implemented | passed | not-deployed | [Documentation procedure](operations/documentation.md) |
| docs-pages | Static documentation with English, Korean and API pages | implemented | passed | deployed | [Page tests](../tests/docs/web-build.test.mts), [publication procedure](operations/documentation.md), [published web](https://polyspec.github.io/crudui/) |

## Comparison verification of 2026-09-19

On 2026-09-19 the comparison deployment verification ran in 5m20s with zero failures.
PHP, PHP extension, Go and Rust
passed 450 generation checks, 120 persistence checks and 7,008 browser checks, and the canonical
flow passed all 40 combinations of five servers, four clients and both initializations, with zero
failures. The run started from repositories holding non-default records, so every initialization
column loaded its own reset record. Every browser report and phase completed within its own limit,
and the container reported zero zombie processes after verification. The public root is the
canonical page: list, detail, form, save and refreshed list; the separate benchmark screen is
`/benchmark-console/`. The 45-record canonical list uses three pages of 20, 20 and 5 records.
Page-level SSR contains the selected server's list, detail or form markup, while CSR contains only
the stage shell that the selected client fills. Initialization comparison preserves
framework-owned container markers and compares rendered container contents; Vue's `data-v-app` is
not removed.

PHP 8.4 and later are supported. `.php-version` selects the CI toolchain; it does not set an upper bound on supported PHP releases. The dated verification sections record the versions and results of those runs. Their historical PHP 8.5.10 measurements remain unchanged and do not verify the current tree.

## Checklist verification

On 2026-10-26, a full run on PHP 8.4.26 completed 39 targets: 20 passed and 19 failed.
The report is `var/report/final-checklist/record.json`. The failures are tracked with their corrections and owning checks in the [kit standard checklist](plans/kit-standard/checklist.md).

The run did not declare `CRUDUI_CONFORMANCE_EVIDENCE`, so its conformance aggregation has no evidence directory. The full run records failures before the corrections; it does not verify the combined corrected tree. The corrections are verified by their selected owning checks. The extension-wide library run also loaded PHP implementation-only helper files, so it does not establish an extension-only result for those internal tests.

## Release preparation

The 2026-10-26 review classifies the ten impossible checklist rows by their current cause. Unicode data uses the locked
Unicode package. The HTTP forwarding adapter filters connection-specific headers in both directions. The documentation
renderer retains a directly managed Markdown parser because the evaluated VitePress distributions embed the affected
parser. The [documentation](rebuild/documentation-web.md) and [HTTP forwarding](rebuild/http-forward.md) records state
the requirements, evaluated tools and retry conditions.

Native package managers select current sibling sources for local preparation. Composer uses one root declaration and
lock and selects PHPUnit within its declared constraint. React and React DOM 19.3.1 run client widget scripts from an effect after
rendering an inert template; server rendering and hydration retain script elements. The React dependency-policy exceptions
are removed. The withdrawn sprintf-js advisory does not require a package update.

The refreshed dependency review covers 88 registry dependencies and 14 locks and records no security advisories.
The npm locks select patched Markdown, URI, HTTP client and schema packages, and the Rust comparison server lock selects
Tokio 1.53.3. Go 1.27.3 satisfies the linked module's minimum and permits its advisory scan.

The release configuration classifies the native PHP extension manifest as version-only. C18.5 prepares version 0.0.8
manifests, internal dependencies and native locks before CI. Package coverage and version checks are separate from
publication. A release still requires successful `ci-passed` and `push-gate` checks on its commit; local preparation and
owning unit checks do not establish that result.

The [release preparation checklist](plans/release-readiness/checklist.md), C18.1–C18.10, is complete.
Current source dependency and consumer checks, full CI, tag verification and public archive installation checks passed.

## Local source development

Installed npm and Composer polyspec packages resolve to current sibling sources. Root Composer declarations and the
native lock describe the actual local package versions. Local preparation verifies the current OrderedJSON source,
including its order, values and empty types, through the package manager's installed autoload. It does not substitute an
older public OrderedJSON archive or maintain a second archive-compatibility installation profile. C18.1 records the final
native validation, platform and consumer results before candidate CI.

## Display declaration verification

On 2026-09-24 the working tree of the display declaration change passed on macOS arm64 with PHP
8.5.10, Node.js 26.8.1, Go 1.27.0 and Rust 1.98.0:

- The native generator suite passed 596 checks in each of JavaScript, the HTML renderer, PHP, Go,
  Rust and native PHP (3,576 in total, zero failed), including the 142 list and 44 detail cases.
- The form packages passed core 247, HTML 406, React 794, Vue 597, Svelte 590 and 14 mounted
  Svelte checks, and the node form checks passed 57 and 24. The generator packages passed 249 PHP, 116 Go and 36 Rust
  tests, and the PHP extension suite passed 46 tests; its address-sanitizer test runs on Linux.
- The cross-check console passed 1,039 tests, the specification CLI 38, the form-comparison source
  suite 194, its Go and Rust servers 14 and 18, `npm run manifest:test` 21 commands,
  `npm run test:packages` seven steps and `npm run test:runtimes` 65 tests. `npm run spec:schema`,
  `npm run lint`, `npm run typecheck`, `make format-check` and `make docs-check` passed.

## Native package verification

On 2026-09-17 the working tree passed `make ci`, which runs every checking command of the CI
workflow and checks the conformance evidence against `contracts/features.json`, on macOS arm64 with
PHP 8.5.10, Node.js 26.8.1, Go 1.27.0 and Rust 1.98.1:

- The validators passed 580 JavaScript, 698 PHP, 587 Go and 111 Rust tests, each including all 250
  shared validation cases, and the 80 shared input-text cases across the validation and generation
  operations. The PHP extension suite passed 42 tests; its address-sanitizer test runs on Linux.
- The shared generator report passed 501 checks in each of JavaScript, the HTML renderer, PHP, Go,
  Rust and native PHP (3,006 in total, zero failed), and its inputs did not change during the run.
  The generator packages passed 240 PHP, 115 Go and 35 Rust tests.
- The cross-check console passed 914 tests, which send every shared validation, list, detail and
  input-text case and the request cases through all five validator processes.
- The form packages passed core 216, HTML 308, React 502, Vue 472, Svelte 467 and twelve mounted
  Svelte checks; the specification CLI passed 38; the node form checks passed 54, including the
  stylesheet layout in Chromium, Firefox and WebKit. The form-comparison source suite passed 149
  checks, `npm run lint` reported no problem across the repository, the package install check seven steps, and `make format-check` passed.
- In the Linux toolchain image the PHP extension engine passed 33 tests, including the
  address-sanitizer and comma-decimal-locale runs. The Linux stylesheet checks in Chromium, Firefox
  and WebKit run in the CI job that runs the form tests.

Conformance is checked from evidence. Every suite that runs a shared fixture records which feature,
fixture case and runtime passed, and `make conformance` (and the final CI job) compares that evidence
with `contracts/features.json`: a supported runtime without a passing record for every declared case
fails. [Conformance](operations/conformance.md) defines the standard. Package publication is recorded below;
the native PHP extension remains a version-only release component.

## Retained form comparison results

The retained external environment at `https://crudui.test/` uses an earlier library tree,
with PHP, PHP with native JSON parsing, Go and Rust as separate HTTP targets.
All 240 HTTP checks and PHP processor-mode enforcement passed.
Both PHP targets use the PHP validator. These retained results do not verify the
current native CRUDUI form generation or validation integration.

| Server | Scenarios | Interactions | Page errors |
| --- | --- | --- | --- |
| PHP | 120/120 passed | 30/30 passed | 0 |
| PHP with native JSON parsing | 120/120 passed | 30/30 passed | 0 |
| Go | 120/120 passed | 30/30 passed | 0 |
| Rust | 120/120 passed | 30/30 passed | 0 |

Each target covers React, Vue and Svelte with form and ordered JSON transport.
Reports include initial data, later injection, repeated injection, record
restoration, raw HTML, DOM, CSS, control state and row operations. Evidence is
stored in the external comparison workspace under
`.form-comparison/results-<revision>/report-<server>.json`.
Report metadata records source revisions. A total of 108 interaction checks includes all four comparison
modes; 30 belong to the current implementation.

Between the library tree and the verified tree, five TypeScript files changed
only API comments and an unused type import; their executable JavaScript is identical. Generated PHP
dependencies and the Go binary were removed from Git. The new image installs the
same locked PHP dependency versions and builds the server binaries from source.

Retained comparison implementations have diagnostic failures. Their failures
remain in the reports and cause the complete comparison runner to return a
nonzero status. A passing current implementation does not make those retained
implementations pass. Earlier reports do not verify the current dependency graph.

## Deployment

[CRUDUI 0.0.8](https://github.com/polyspec/crudui/releases/tag/v0.0.8) is public with 11 package archives.
Commit `47612fe4297203d46232646eba8365a6fbda43ef` passed full CI and push checks.
The release workflow installed and checked all 11 archives outside the checkout before publication.
Both Go module tags identify the same commit.
The table records completed browser checks for all four servers.
Retained implementation failures remain in the reports.

TypeScript, Go, Rust and PHP API generation and the strict static web build
passed. Two complete generations produced identical API documentation, native
HTML assets and schema output. Eight generator failure tests passed, and the raw
form inspector passed 18 cases.

## PHP test scope verification

On 2026-10-26, PHP 8.4.26 source runs passed all 859 generator and 985 validator cases. Public runs against the built
extension passed all 841 generator and 633 validator cases with the PHP library source-load guard enabled. Native
expression and composition engine units passed 94 cases. Native PHPUnit XML listings preserve all original case IDs
across the three mixed-class splits, and the scope unit verifies complete source and public selections. These owning
results correct the earlier extension-wide test-scope limitation; they do not replace full candidate CI verification.


## Scoped CI environments

Kit 0.0.63 installs each CI job's selected locked tools. Go and Rust jobs run their own validator and generator suites;
JavaScript generator units run separately. Cross-language generator and validator comparisons prepare their own complete
environments without waiting for language jobs. PHP extension jobs prepare arginfo explicitly, and CI Composer installation
uses the lock without updates. Conformance consumes the isolated evidence; final CI requires all mandatory results.
