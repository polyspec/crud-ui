# 목록과 상세 개발과 검증
<!-- doc-id: docs-operations-displays -->
<!-- source-sha256: 7bea483dd562462fe3cfdd7d8a04a860f78d313c049bc169a3a1e20cd0fd919b -->

[English](displays.md). [표시 형식](../spec/display-formats.ko.md)은 각 형식, 허용 입력과
마크업을 정의합니다. [명세 구조](../spec/schema.ko.md)는 목록과 상세 필드와
멤버 순서를 정의합니다.

## 목록과 상세

목록과 상세는 읽기 전용 표시입니다. 목록은 `columns`를 선언하고 행 배열을 받으며, 상세는
`fields`를 선언하고 레코드 하나를 받습니다. 데이터는 렌더링 전에 조회, 필터링, 정렬,
페이지 분할되어 행이나 레코드로 전달됩니다. 생성기는 데이터베이스에 접근하지 않으며 행에서
현재 페이지나 전체 수를 계산하지 않습니다.

각 런타임은 두 단계를 제공합니다.

- 모델 함수는 선언을 합성하고 조건과 외형을 평가하며 콘텐츠를 번역하고 모든 값을 형식화합니다.
  상세 모델은 `{ fields, actions, design }`입니다.
- 렌더 함수는 모델을 만든 뒤 모델에서 HTML을 작성합니다.

잘못된 입력은 `INVALID_FORM_INPUT` 코드와 [입력](../spec/display-formats.ko.md)에 나열한
메시지로 실패합니다. 해석할 수 없는 합성 참조와 금지 키는 `ComposeLoadError`로 실패합니다.
[선언 규칙](../spec/display-formats.ko.md#선언)을 따르지 않는 선언은 `INVALID_FORM_INPUT`으로 실패하므로,
목록과 상세는 문서화된 형태의 명세에서만 렌더링됩니다.

## 옵션

| 옵션 | JavaScript와 PHP | Go | Rust | 상세 |
| --- | --- | --- | --- | --- |
| 콘텐츠 언어, 기본값 `ko` | `language` | `Language` | `language` | 사용 |
| 표시 조건식의 컨텍스트 | `data` | `Data` | `data` | 사용 |
| 현재 페이지 | `page` | `Page` | `page` | 무시 |
| 전체 레코드 수 | `total` | `Total` | `total` | 무시 |
| `table` 또는 `card` 레이아웃 | `layout`(렌더 전용) | `Layout` | `layout` | 무시 |
| 합성 파일 | `files` | `Files` | `files` | 사용 |
| 참조 기준 경로 | `basepath` | `Basepath` | `basepath` | 사용 |
| 합성 로더 | `loader`(JavaScript 전용) | `Loader` | `loader` | 사용 |

상세는 `page`, `total`, `layout`을 검사하지도 사용하지도 않습니다. TypeScript의
`BuildDetailOptions` 타입에는 이 옵션이 없습니다. Go `DetailOptions`는 `ListOptions`와 같은
타입이고, Rust `DetailOptions`도 `ListOptions`와 같은 타입입니다.

## JavaScript

`@polyspec/crudui-generator-core`는 `buildList(spec, rows, options)`와
`buildDetail(spec, record, options)`를 내보냅니다. `@polyspec/crudui-generator-html`은
`renderList(spec, rows, options)`와 `renderDetail(spec, record, options)`를 내보내며, 이 함수는
목록이나 상세 앞에 이미지 preload 링크를 쓴 HTML 문자열을 반환합니다. `@polyspec/crudui-validator`는
`validateList(spec, options)`와 `validateDetail(spec, options)`를 내보냅니다.

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

React, Vue, Svelte 패키지는 `buildList`와 `buildDetail`을 다시 내보내고 서버 렌더링과
컴포넌트를 제공합니다.

| 패키지 | 서버 렌더링 | 컴포넌트 |
| --- | --- | --- |
| `@polyspec/crudui-generator-react/server` | `renderList`와 `renderDetail`이 문자열을 반환 | `@polyspec/crudui-generator-react`의 `<List vm layout />`, `<Detail vm />` |
| `@polyspec/crudui-generator-vue` | `renderList`와 `renderDetail`이 Promise를 반환 | `List(vm, layout)`와 `Detail(vm)`이 VNode를 반환 |
| `@polyspec/crudui-generator-svelte` | `renderList`와 `renderDetail`이 문자열을 반환 | `vm`, `layout` 속성을 받는 `List`, `vm` 속성을 받는 `Detail` |

컴포넌트는 `buildList`나 `buildDetail`로 만든 모델을 받습니다. 렌더 함수는 HTML 렌더러와 같은
옵션을 받습니다.

## PHP와 PHP 확장

`Polyspec\Crudui\Generator::buildList($spec, $rows, $options)`는 평가한 목록 모델을 반환하고, `Polyspec\Crudui\Generator::renderList($spec, $rows, $options)`는 행을 렌더링하며,
`Generator::renderDetail($spec, $record, $options)`는 레코드 하나를 렌더링하며,
`Generator::buildDetail($spec, $record, $options)`는 상세 모델을 반환합니다. `Polyspec\Crudui\Validator::validateList($spec, $options)`와
`Validator::validateDetail($spec, $options)`는 구조를 검증합니다. 생성 옵션은 `language`,
`data`, `page`, `total`, `layout`, `files`, `basepath`이고 검증 옵션은 `files`와 `basepath`입니다.
예제는 저장소 루트에서 실행합니다.

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

`crudui` 확장은 같은 `Polyspec\Crudui\Generator`, `Polyspec\Crudui\Validator` 클래스와 메서드를 등록합니다.
`php -d "extension=$(pwd)/var/php-ext/polyspec_crudui.so"`처럼 확장을 로드해도 같은 코드가
같은 HTML과 모델을 반환합니다. [PHP API 계약](php-extension.ko.md)은 어떤 PHP 값이
객체인지 정의합니다.

## Go

`github.com/polyspec/crudui/packages/generator/go` 패키지는
`BuildList(spec, rows, ListOptions)`, `RenderList(spec, rows, ListOptions)`,
`BuildDetail(spec, record, DetailOptions)`, `RenderDetail(spec, record, DetailOptions)`를
제공합니다. 명세, 행, 레코드는 `*generator.Object` 값입니다. `ListOptions` 필드는 `Language`,
`Data`, `Page`, `Total`, `Files`, `Loader`, `Basepath`, `Layout`이며, `Data`, `Page`, `Total`,
`Layout`은 디코딩한 값을 받아 입력 규칙으로 검사합니다. `validator/validate` 패키지는
`Options`(`Files`, `Basepath`)를 받는 `ValidateList`와 `ValidateDetail`, JSON 바이트를 받는
`ValidateListJSON`과 `ValidateDetailJSON`을 제공합니다. 구조 실패는 오류로 반환됩니다.

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

생성기와 검증기 모듈을 require하는 모듈에서 실행합니다.

## Rust

`polyspec-crud-ui-generator` 크레이트는 `build_list`, `render_list`, `build_detail`, `render_detail`,
`ListOptions`, `DetailOptions`를 내보냅니다. `ListOptions` 필드는 `files`, `loader`, `basepath`,
`language`, `data`, `page`, `total`, `layout`이며, `data`, `page`, `total`, `layout`은 JSON 값이고
기본 언어는 `ko`입니다. `polyspec-crud-ui-validator` 크레이트는 `ValidateListOptions`를 받는
`validate_list`와 `ValidateDetailOptions`(`files`, `loader`, `basepath`)를 받는
`validate_detail`을 내보냅니다. 구조 실패는 `Err(ComposeLoadError)`입니다.

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

`serde_json`은 `preserve_order` 기능과 함께 사용합니다.

## 구조 검증

구조 검증은 목록이나 상세 선언을 합성하고 금지 키를 거부합니다. 행이나 레코드는 검증하지
않습니다. 유효한 구조는 JavaScript와 PHP에서 `{ valid: true, errors: [] }`, Go에서 유효한
`ValidationResult`를 반환하고 Rust에서는 `Ok(())`를 반환합니다. 합성 실패와 금지 키 실패는
`ComposeLoadError`이며, JavaScript와 PHP는 이를 던지고 Go는 오류로, Rust는 `Err`로 반환합니다.
모델 함수와 렌더 함수는 `columns`, `fields`, `search` 선언에 같은 합성과 금지 키 스캔을 실행한 뒤 선언
규칙을 검사합니다.

## 예제

| 예제 | 목록과 상세 |
| --- | --- |
| [Go 서버](../../packages/generator/go/examples/server/main.go) | `/`는 폼을, `/list`는 저장된 레코드를 `RenderList`로, `/detail`은 `RenderDetail`로 렌더링합니다. |
| [PHP 페이지](../../packages/generator/php/examples/index.php) | `/`는 폼을, `?view=list`는 저장된 레코드를 `Generator::renderList`로, `?view=detail`은 `Generator::renderDetail`로 렌더링합니다. 이 파일은 PHP 구현과 확장에서 모두 실행됩니다. |
| [Rust 프로그램](../../packages/generator/rust/examples/form.rs) | 폼을 렌더링하고 각 회사 행을 목록 행으로 바꿔 `render_list`로 목록을, `render_detail`로 회사별 상세를 렌더링한 뒤 HTML 문서 하나를 출력합니다. |
| [교차 검사 콘솔](../../examples/cross-check-console/README.md) | 목록 탭은 4개 언어로 목록 구조를 검증하고 React, Vue, Svelte로 행을 렌더링합니다. 상세 탭은 4개 언어로 상세 구조를 검증하고 세 프레임워크로 레코드를 렌더링합니다. |

```sh
(cd packages/generator/go && go run ./examples/server -data /tmp/crudui-go-record.json)
CRUDUI_DATA_FILE=/tmp/crudui-php-example.json php -S 127.0.0.1:8082 -t packages/generator/php/examples
cargo run --locked --manifest-path packages/generator/rust/Cargo.toml --example form
```

Go 서버는 `127.0.0.1:8087`에서 수신합니다. Go와 PHP 예제는 레코드 하나를 저장하므로 목록에는
그 레코드가 유일한 행으로 표시되고, 처음 저장하기 전에는 행이 없습니다. 각 페이지와 형식은
패키지 README에 설명되어 있습니다.

## 검사

공유 fixture가 모든 런타임의 기대 결과를 정의합니다.

| Fixture | 내용 |
| --- | --- |
| [`list-render`](../../tests/fixtures/list-render/README.ko.md) | 명세, 행, 옵션과 기대 목록 HTML 또는 오류 |
| [`detail-render`](../../tests/fixtures/detail-render/README.ko.md) | 명세, 레코드, 옵션과 기대 상세 HTML 또는 오류 |
| [`list-validity`](../../tests/fixtures/list-validity/README.ko.md) | 목록 선언과 구조 검증 결과 |
| [`detail-validity`](../../tests/fixtures/detail-validity/README.ko.md) | 상세 선언과 구조 검증 결과 |

```sh
npm run test:forms
make crudui-test-native
(cd examples/cross-check-console/server && npm test)
make docs-check
```

`test:forms`는 React, Vue, Svelte, HTML 렌더러의 목록과 상세 적합성 테스트를 실행하며, 이 테스트는
정규화한 본문을 렌더 fixture와 비교합니다. `make crudui-test-native`는 PHP, Go, Rust 패키지 테스트와
[네이티브 생성기 테스트 모음](../../tests/native-generators/README.ko.md)을 실행하며, 이 모음은
JavaScript, HTML 렌더러, PHP, PHP 확장, Go, Rust의 원본 목록과 상세 HTML 전체와 상세 모델을
비교합니다. 콘솔 테스트 모음은 Go와 Rust 검증기 프로그램을 빌드하고 목록과 상세 엔드포인트를
포함한 게이트웨이를 테스트합니다.

저장소 루트에서 각 검증기의 구조 검증 사례를 실행합니다.

```sh
npm test -w @polyspec/crudui-validator -- src/validate-list/validate-list.conformance.test.ts src/validate-detail/validate-detail.conformance.test.ts
COMPOSER_VENDOR_DIR=../../../vendor node node_modules/@polyspec/kit/dist/run-tests.mjs phpunit --cwd packages/validator/php -- --filter 'ListValidateConformanceTest|DetailValidateConformanceTest'
node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd packages/validator/go -- ./validator/validate -run 'TestValidateListMatchesFixture|TestValidateDetailMatchesFixture'
node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml --test list_validity_conformance --test detail_validity_conformance
```

현재 결과는 [기능 상태](../features.ko.md)와 [변경 기록](../../CHANGELOG.ko.md)에 기록합니다.
