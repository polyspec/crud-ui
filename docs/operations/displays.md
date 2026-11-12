# List and detail development and verification
<!-- doc-id: docs-operations-displays -->

[한국어](displays.ko.md). [Display formats](../spec/display-formats.md) define each format, the
accepted input and the markup. The [specification structure](../spec/schema.md#lists) defines
list and detail fields and [member order](../spec/schema.md#member-order).

## Lists and details

A list and a detail are read-only displays. A list declares `columns` and receives an array of
rows; a detail declares `fields` and receives one record. The rows or the record are queried, filtered,
sorted and paginated before they are passed in. The generators do not access a
database and do not derive a page or a total from the rows.

Each runtime provides two levels:

- A model function composes the declaration, evaluates conditions and appearance, translates
  content and formats every value. A detail model is `{ fields, actions, design }`.
- A render function builds the model and writes HTML from it.

Invalid input fails with code `INVALID_FORM_INPUT` and the messages listed under
[input](../spec/display-formats.md#input). An unresolved composition reference and a forbidden key
fail with `ComposeLoadError`. A declaration that does not follow the
[declaration rules](../spec/display-formats.md#declarations) fails with `INVALID_FORM_INPUT`, so a
list or detail is rendered only from a specification of the documented shape.

## Options

| Option | JavaScript and PHP | Go | Rust | Detail |
| --- | --- | --- | --- | --- |
| Content language, default `ko` | `language` | `Language` | `language` | used |
| Context for visibility expressions | `data` | `Data` | `data` | used |
| Current page | `page` | `Page` | `page` | ignored |
| Total record count | `total` | `Total` | `total` | ignored |
| `table` or `card` layout | `layout` (render only) | `Layout` | `layout` | ignored |
| Composition files | `files` | `Files` | `files` | used |
| Base path for references | `basepath` | `Basepath` | `basepath` | used |
| Composition loader | `loader` (JavaScript only) | `Loader` | `loader` | used |

A detail neither checks nor uses `page`, `total` and `layout`. In TypeScript,
`BuildDetailOptions` omits them from the type. Go `DetailOptions` is the same type as
`ListOptions`, and Rust `DetailOptions` is the same type as `ListOptions`.

## JavaScript

`@polyspec/crudui-generator-core` exports `buildList(spec, rows, options)` and
`buildDetail(spec, record, options)`. `@polyspec/crudui-generator-html` exports
`renderList(spec, rows, options)` and `renderDetail(spec, record, options)`, which return HTML
strings with image preload links before the list or detail. `@polyspec/crudui-validator` exports
`validateList(spec, options)` and `validateDetail(spec, options)`.

```js
import { buildDetail, buildList } from '@polyspec/crudui-generator-core';
import { renderDetail, renderList } from '@polyspec/crudui-generator-html';
import { validateDetail, validateList } from '@polyspec/crudui-validator';

const listSpec = {
  pagination: true,
  columns: {
    name: { field: 'name', label: { ko: '이름', en: 'Name' } },
    joined: { field: 'joined', label: 'Joined', format: { type: 'date', pattern: 'YYYY-MM-DD' } },
  },
};
const rows = [{ name: 'Ada', joined: '2026-01-02T09:30:00Z' }];
validateList(listSpec);
const listModel = buildList(listSpec, rows, { language: 'en', page: 1, total: 1 });
const listHtml = renderList(listSpec, rows, { language: 'en', page: 1, total: 1, layout: 'card' });

const detailSpec = { fields: { name: { field: 'name', label: 'Name' } } };
validateDetail(detailSpec);
const detailModel = buildDetail(detailSpec, rows[0], { language: 'en' });
const detailHtml = renderDetail(detailSpec, rows[0], { language: 'en' });
```

The React, Vue and Svelte packages re-export `buildList` and `buildDetail` and provide
server rendering and components:

| Package | Server rendering | Components |
| --- | --- | --- |
| `@polyspec/crudui-generator-react/server` | `renderList` and `renderDetail` return strings | `<List vm layout />`, `<Detail vm />` from `@polyspec/crudui-generator-react` |
| `@polyspec/crudui-generator-vue` | `renderList` and `renderDetail` return promises | `List(vm, layout)` and `Detail(vm)` return VNodes |
| `@polyspec/crudui-generator-svelte` | `renderList` and `renderDetail` return strings | `List` with `vm` and `layout` props, `Detail` with a `vm` prop |

A component receives a model built with `buildList` or `buildDetail`. The render functions
take the same options as the HTML renderer.

## PHP and the PHP extension

`Polyspec\Crudui\Generator::buildList($spec, $rows, $options)` returns the evaluated list model. `Polyspec\Crudui\Generator::renderList($spec, $rows, $options)` renders rows,
`Generator::renderDetail($spec, $record, $options)` renders one record and
`Generator::buildDetail($spec, $record, $options)` returns the detail model. `Polyspec\Crudui\Validator::validateList($spec, $options)` and
`Validator::validateDetail($spec, $options)` validate structure. Generation options are
`language`, `data`, `page`, `total`, `layout`, `files` and `basepath`; validation options are
`files` and `basepath`. Run the example from the repository root:

```php
<?php
require 'vendor/autoload.php';

use Polyspec\Crudui\Generator;
use Polyspec\Crudui\Validator;

$listSpec = json_decode('{"pagination":true,"columns":{"name":{"field":"name","label":"Name"}}}', false, 512, JSON_THROW_ON_ERROR);
$rows = [json_decode('{"name":"Ada"}', false, 512, JSON_THROW_ON_ERROR)];
Validator::validateList($listSpec);
$listHtml = Generator::renderList($listSpec, $rows, ['language' => 'en', 'page' => 1, 'total' => 1, 'layout' => 'card']);

$detailSpec = json_decode('{"fields":{"name":{"field":"name","label":"Name"}}}', false, 512, JSON_THROW_ON_ERROR);
Validator::validateDetail($detailSpec);
$detailModel = Generator::buildDetail($detailSpec, $rows[0], ['language' => 'en']);
$detailHtml = Generator::renderDetail($detailSpec, $rows[0], ['language' => 'en']);
```

The `crudui` extension registers the same `Polyspec\Crudui\Generator` and `Polyspec\Crudui\Validator` classes and
methods. The same code returns the same HTML and models with the extension loaded, for example
with `php -d "extension=$(pwd)/var/php-ext/polyspec_crudui.so"`. The
[PHP API contract](php-extension.md) defines which PHP values are objects.

## Go

The `github.com/polyspec/crudui/packages/generator/go` package provides
`BuildList(spec, rows, ListOptions)`, `RenderList(spec, rows, ListOptions)`,
`BuildDetail(spec, record, DetailOptions)` and `RenderDetail(spec, record, DetailOptions)`.
Specifications, rows and records are `*generator.Object` values. `ListOptions` has the fields
`Language`, `Data`, `Page`, `Total`, `Files`, `Loader`, `Basepath` and `Layout`; `Data`, `Page`,
`Total` and `Layout` accept decoded values and are checked by the input rules. The
`validator/validate` package provides `ValidateList` and `ValidateDetail` with `Options`
(`Files`, `Basepath`), and `ValidateListJSON` and `ValidateDetailJSON` for JSON bytes. A
structure failure is returned as an error.

```go
package main

import (
	"fmt"

	generator "github.com/polyspec/crudui/packages/generator/go"
	"github.com/polyspec/crudui/packages/validator/go/validator/validate"
)

func object(source string) *generator.Object {
	decoded, err := generator.DecodeJSON([]byte(source))
	if err != nil {
		panic(err)
	}
	return decoded.(*generator.Object)
}

func main() {
	listSpec := object(`{"pagination":true,"columns":{"name":{"field":"name","label":"Name"}}}`)
	if _, err := validate.ValidateList(listSpec, validate.Options{}); err != nil {
		panic(err)
	}
	rows := []*generator.Object{generator.NewObject("name", "Ada")}
	listHTML, err := generator.RenderList(listSpec, rows, generator.ListOptions{
		Language: "en", Page: 1, Total: 1, Layout: "card",
	})
	if err != nil {
		panic(err)
	}

	detailSpec := object(`{"fields":{"name":{"field":"name","label":"Name"}}}`)
	if _, err := validate.ValidateDetail(detailSpec, validate.Options{}); err != nil {
		panic(err)
	}
	detailModel, err := generator.BuildDetail(detailSpec, rows[0], generator.DetailOptions{Language: "en"})
	if err != nil {
		panic(err)
	}
	detailHTML, err := generator.RenderDetail(detailSpec, rows[0], generator.DetailOptions{Language: "en"})
	if err != nil {
		panic(err)
	}
	fmt.Println(listHTML, detailHTML, detailModel.Len())
}
```

Run it in a module that requires the generator and validator modules.

## Rust

The `polyspec-crud-ui-generator` crate exports `build_list`, `render_list`, `build_detail`,
`render_detail`, `ListOptions` and `DetailOptions`. `ListOptions` has the fields `files`,
`loader`, `basepath`, `language`, `data`, `page`, `total` and `layout`; `data`, `page`, `total`
and `layout` are JSON values, and the default language is `ko`. The `polyspec-crud-ui-validator` crate
exports `validate_list` with `ValidateListOptions` and `validate_detail` with
`ValidateDetailOptions` (`files`, `loader`, `basepath`). A structure failure is
`Err(ComposeLoadError)`.

```rust
use polyspec_crud_ui_generator::{build_detail, render_detail, render_list, DetailOptions, ListOptions};
use polyspec_crud_ui_validator::{validate_detail, validate_list, ValidateDetailOptions, ValidateListOptions};
use serde_json::json;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let list_spec = json!({"pagination": true, "columns": {"name": {"field": "name", "label": "Name"}}});
    validate_list(&list_spec, &ValidateListOptions::default())?;
    let rows = vec![json!({"name": "Ada"})];
    let list_html = render_list(
        &list_spec,
        &rows,
        &ListOptions {
            language: "en".into(),
            page: json!(1),
            total: json!(1),
            layout: json!("card"),
            ..Default::default()
        },
    )?;

    let detail_spec = json!({"fields": {"name": {"field": "name", "label": "Name"}}});
    validate_detail(&detail_spec, &ValidateDetailOptions::default())?;
    let options = DetailOptions {
        language: "en".into(),
        ..Default::default()
    };
    let detail_model = build_detail(&detail_spec, &rows[0], &options)?;
    let detail_html = render_detail(&detail_spec, &rows[0], &options)?;
    println!("{list_html}\n{detail_html}\n{}", detail_model["fields"][0]["key"]);
    Ok(())
}
```

Use `serde_json` with the `preserve_order` feature.

## Structure validation

Structure validation composes a list or detail declaration and rejects forbidden keys. It does
not validate rows or a record. A valid structure returns `{ valid: true, errors: [] }` in
JavaScript and PHP and a valid `ValidationResult` in Go; Rust returns `Ok(())`. A composition or
forbidden-key failure is a `ComposeLoadError`: JavaScript and PHP throw it, Go returns it as the
error and Rust returns it as `Err`. The model and render functions run the same composition and
forbidden-key scan on the `columns`, `fields` and `search` declarations and then check the
declaration rules.

## Examples

| Example | List and detail |
| --- | --- |
| [Go server](../../legacy/packages/generator/go/examples/server/main.go) | `/` renders the form, `/list` renders the stored record with `RenderList` and `/detail` renders it with `RenderDetail`. |
| [PHP pages](../../legacy/packages/generator/php/examples/index.php) | `/` renders the form, `?view=list` renders the stored record with `Generator::renderList` and `?view=detail` with `Generator::renderDetail`. The file runs with the PHP implementation or the extension. |
| [Rust program](../../packages/generator/rust/examples/form.rs) | Renders a form, turns each company row into a list row, renders the list with `render_list` and each company with `render_detail`, and prints one HTML document. |
| [Cross-check console](../../legacy/examples/cross-check-console/README.md) | The list tab validates list structure in four languages and renders rows in React, Vue and Svelte. The detail tab validates detail structure in four languages and renders a record in the three frameworks. |

```sh
(cd legacy/packages/generator/go && go run ./examples/server -data /tmp/crudui-go-record.json)
CRUDUI_DATA_FILE=/tmp/crudui-php-example.json php -S 127.0.0.1:8082 -t legacy/packages/generator/php/examples
cargo run --locked --manifest-path packages/generator/rust/Cargo.toml --example form
```

The Go server listens on `127.0.0.1:8087`. The Go and PHP examples store one record, so the
list has that record as its only row, and no rows before the first save. The package READMEs
describe each page and its formats.

## Checks

Shared fixtures define the expected results in every runtime:

| Fixture | Content |
| --- | --- |
| [`list-render`](../../tests/fixtures/list-render/README.md) | Specification, rows, options and the expected list HTML or error |
| [`detail-render`](../../tests/fixtures/detail-render/README.md) | Specification, record, options and the expected detail HTML or error |
| [`list-validity`](../../tests/fixtures/list-validity/README.md) | List declarations and their structure validation results |
| [`detail-validity`](../../tests/fixtures/detail-validity/README.md) | Detail declarations and their structure validation results |

```sh
npm run test:forms
make crudui-test-native
(cd legacy/examples/cross-check-console/server && npm test)
make docs-check
```

`test:forms` runs the list and detail conformance tests of React, Vue, Svelte and the HTML
renderer, which compare normalized bodies with the render fixtures. `make crudui-test-native` runs the
PHP, Go and Rust package tests and the
[native generator suite](../../legacy/tests/native-generators/README.md), which compares complete
original list and detail HTML and detail models from JavaScript, the HTML renderer, PHP, the PHP
extension, Go and Rust. The console suite builds the Go and Rust validator programs and tests the
gateway, including the list and detail endpoints.

Run the structure validation cases of each validator from the repository root:

```sh
npm test -w @polyspec/crudui-validator -- src/validate-list/validate-list.conformance.test.ts src/validate-detail/validate-detail.conformance.test.ts
COMPOSER_VENDOR_DIR=../../../vendor node node_modules/@polyspec/kit/dist/run-tests.mjs phpunit --cwd legacy/packages/validator/php -- --filter 'ListValidateConformanceTest|DetailValidateConformanceTest'
node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd legacy/packages/validator/go -- ./validator/validate -run 'TestValidateListMatchesFixture|TestValidateDetailMatchesFixture'
node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml --test list_validity_conformance --test detail_validity_conformance
```

Record current results in [features](../features.md) and [changelog](../../CHANGELOG.md).
