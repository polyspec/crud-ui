# 입력 텍스트
<!-- doc-id: docs-spec-input-text -->
<!-- source-sha256: 51baa1f63b246ceab85a4e85c032cbc839b22441f166754ab42760650e8af6b7 -->

[English](input-text.md).

명세와 데이터의 텍스트는 유니코드 스칼라 값의 나열입니다. 코드 포인트 U+0000부터 U+D7FF까지와
U+E000부터 U+10FFFF까지입니다. 모든 런타임은 아래 규칙을 같은 연산에서 같은 순서와 같은 실패로
적용합니다. 규칙을 어긴 텍스트는 거부합니다. U+FFFD 같은 문자로 바꾸지 않고 결과로 넘기지도
않습니다.

## 잘못된 텍스트

- **CUIT-001** JavaScript 문자열: 상위·하위 쌍을 이루지 않는 서로게이트 코드 유닛
- **CUIT-002** PHP, Go, C 문자열: UTF-8이 아닌 바이트. 인코딩된 서로게이트, 과잉 길이 형식, U+10FFFF를 넘는 값을 포함합니다
- **CUIT-003** Rust `String`: 없음. 이 타입은 유니코드 스칼라 값만 담습니다
- **CUIT-004** JSON 텍스트: `"\ud800"`이나 순서가 뒤바뀐 `"\udc00\ud800"`처럼 쌍을 이루지 않는 서로게이트의 `\u` 이스케이프

규칙은 모든 깊이의 모든 문자열 값과 객체 멤버 이름에 적용합니다. 숫자, 불리언, `null`에는 텍스트가
없습니다.

## 연산과 순서

각 연산은 인수 형태 검사를 포함한 다른 모든 검사보다 먼저 텍스트를 검사합니다. 검사 순서는
다음과 같습니다.

1. **CUIT-005** 명세, 이어서 명세가 읽는 합성 파일.
2. **CUIT-006** 나머지 인수. 표의 순서를 따릅니다.
3. **CUIT-007** 옵션. 이름의 코드 포인트 순서를 따릅니다.

- **CUIT-008** `validate` — 명세: `spec`, `files`; 나머지 인수: `data`; 옵션: `basepath`
- **CUIT-009** `validateList`, `validateDetail` — 명세: `spec`, `files`; 옵션: `basepath`
- **CUIT-010** `compileForm` — 명세: `spec`, `files`; 옵션: `basepath`, `keyPrefix`
- **CUIT-011** `bindForm`, `bindButtons`, `createForm` — 나머지 인수: `template`, `data`; 옵션: `idPrefix`, `keyPrefix`, `language`, `unsupported`
- **CUIT-012** `buildList`, `renderList` — 명세: `spec`, `files`; 나머지 인수: `rows`; 옵션: `basepath`, `data`, `language`, `layout`
- **CUIT-013** `buildDetail`, `renderDetail` — 명세: `spec`, `files`; 나머지 인수: `record`; 옵션: `basepath`, `data`, `language`, `layout`
- **CUIT-014** Form `setData` — 나머지 인수: `data`
- **CUIT-015** Form `setValue` — 나머지 인수: `path`, `value`
- **CUIT-016** Form `getValue` — 나머지 인수: `path`
- **CUIT-017** Form `addRow` — 나머지 인수: `path`; 옵션: `afterKey`, `key`, `value`
- **CUIT-018** Form `copyRow` — 나머지 인수: `path`, `key`; 옵션: `afterKey`, `key`
- **CUIT-019** Form `removeRow`, `moveRow` — 나머지 인수: `path`, `key`
- **CUIT-020** Form `rekeyRow` — 나머지 인수: `path`, `oldKey`, `newKey`

이름은 문서에 정의한 인수와 옵션 이름입니다. Go의 `KeyPrefix`나 Rust의 `key_prefix`처럼 런타임이
다르게 표기해도 같은 이름으로 보고합니다. 호출자가 주지 않은 옵션은 검사하지 않습니다. `files`
대신 사용자 정의 로더로 합성하는 연산은 로더가 문서를 반환할 때 그 문서를 검사합니다.

한 값 안에서는 배열 항목을 인덱스 순서로 방문합니다. 객체는 먼저 모든 멤버 이름을 검사하고, 이어서
멤버를 이름의 코드 포인트 순서로 방문합니다. 처음 찾은 실패를 보고합니다. 실패는 잘못된 텍스트이거나
값 한도를 넘은 값입니다.

## 값 한도

검사는 각 값을 그 값이 나타내는 JSON 트리로 순회하고, 같은 순회가 값의 크기를 제한합니다.
JavaScript 배열과 객체, PHP 배열과 객체, Go 맵, 슬라이스, 순서 있는 객체는 한 값의 여러 곳에 나타날
수 있습니다. 공유하거나, PHP 참조를 거치거나, 자기 자신을 담는 경우입니다. 순회는 이런 컨테이너를
트리가 담는 모든 곳에서 방문합니다. 다음 값은 한도를 넘은 값입니다.

- **CUIT-021** 노드가 1,000,000개보다 많은 값. 트리의 배열, 객체, 문자열, 숫자, 불리언, `null`이 각각 노드이며
  값 자신도 포함합니다
- **CUIT-022** 배열과 객체가 256단계보다 깊이 중첩된 값. 값 자신이 첫 단계입니다. 256은 JSON 읽기
  ([ordered-json](https://github.com/polyspec/ordered-json))의 읽기 한도이므로, 런타임이 받는 모든 값은 JSON 텍스트로 쓰고 다시 읽을 수 있습니다

자기 자신을 담는 값은 끝없이 중첩되므로 언제나 한도를 넘습니다. 순회는 순서상 첫 실패에서
멈추므로, 값이 어떤 트리를 나타내든 노드를 최대 1,000,001개만 방문합니다. 한도보다 먼저 만난
잘못된 텍스트는 잘못된 텍스트로, 먼저 넘은 한도는 한도로 보고합니다.

한도는 명세와 합성 파일을 포함한 모든 검사 대상 값에 적용하며, 값의 이름을 담은 입력 실패입니다.
사용자 정의 로더의 문서는 `files`로 부릅니다.

Go의 값 진입점은 노드를 공유할 수 있는 맵, 슬라이스, `*compose.OMap` 값을 받으므로 Go도
JavaScript, PHP와 같이 한도를 적용합니다. Rust 값인 `serde_json::Value`와
`polyspec_crudui_validator::text::JsonText`는 모든 노드를 소유합니다. 컨테이너를 공유하거나 자기 자신을 담을
수 없으므로 공유 컨테이너가 값에 두 번 나타날 수 없습니다. Rust 값 진입점은 노드와 단계를 셉니다. 순회
비용은 값을 만드는 비용을 넘지 않습니다.

- **CUIT-042** 언어 값은 바인딩을 거쳐 Rust 코어에 도달합니다. 바인딩의 언어 값 순회(바인딩의 `HostValue`
  순회)는 그 값이 나타내는 트리가 담는 대로 공유 컨테이너를 모든 자리에서, 자기 자신을 담는 컨테이너를
  끝없이 방문하고, 이 절의 순서에서 첫 실패에서 멈춥니다. Rust 코어는 트리만 받으므로 코어에는 노드를
  공유하는 값 타입이 없습니다.

PHP 라이브러리의 값 복사와 확장의 값 변환은 변환하는 모든 값에 같은 한도를 적용합니다. 어떤 검사도
순회하지 않는 멤버, 예를 들어 마크업이 읽지 않는 버튼 멤버도 포함합니다. 이때 실패는
[PHP 확장](../operations/php-extension.ko.md)의 값 실패 `Recursive or excessively nested PHP value`입니다.

## 실패

명세나 합성 파일의 실패는 합성 로드 실패입니다.

- **CUIT-023** 코드 `INVALID_TEXT`
- **CUIT-024** 메시지 `Text must be Unicode scalar values`
- **CUIT-025** 위치: 문자열의 경로를 `.`로 이은 값이며 배열 항목은 인덱스입니다. 잘못된 멤버 이름은 그 멤버를
  가진 객체에 위치합니다. 파일 안의 경로는 파일 이름으로 시작합니다. 잘못된 파일 이름과 명세 루트의
  잘못된 멤버 이름은 빈 경로에 위치합니다.

다른 인수나 옵션의 실패는 입력 실패입니다.

- **CUIT-026** 코드 `INVALID_FORM_INPUT`
- **CUIT-027** 메시지 `Text must be Unicode scalar values: {name}`. `{name}`은 인수 이름, 또는 `options.`와
  옵션 이름이며 그 뒤에 값 안의 경로가 붙습니다. 예: `data.rows.k1.name`, `options.data.admin`
- **CUIT-028** 빈 위치

값 한도를 넘은 값은 모든 인수와 옵션에서 입력 실패입니다.

- **CUIT-029** 코드 `INVALID_FORM_INPUT`
- **CUIT-030** 메시지 `Recursive or excessively nested value: {name}`. `{name}`은 `spec`, `files`, 인수 이름,
  또는 `options.`와 옵션 이름이며 경로는 붙지 않습니다
- **CUIT-031** 빈 위치

- **CUIT-041** 각 구현은 로드 실패와 입력 실패를 이 목록의 자기 항목이 적은 오류 타입으로 보고합니다:
  - JavaScript: 로드 실패는 `ComposeLoadError`, 입력 실패는 `FormInputError`입니다.
  - PHP와 PHP 확장: 검증에서 로드 실패는 `ComposeLoadError`, 입력 실패는 `FormInputError`입니다. 생성에서 로드 실패는
    `ComposeLoadError`, 입력 실패는 `FormError`입니다.
  - Go: 로드 실패는 `*compose.ComposeLoadError`입니다. 입력 실패는 검증에서 `*validate.FormInputError`, 생성에서는
    메시지를 담은 오류입니다.
  - Rust: 로드 실패는 `ValidateError::Load` 또는 `FormError` 안의 `ComposeLoadError`이고, 입력 실패는
    `ValidateError::Input` 또는 `FormError` 안의 `FormInputError`입니다.
  - Python: 검증에서 로드 실패는 `ComposeLoadError`, 입력 실패는 `FormInputError`입니다. 생성에서 로드 실패는
    `ComposeLoadError`, 입력 실패는 `FormError`입니다.
- **CUIT-037** JavaScript: `JSON.parse`는 각 이스케이프를 코드 유닛으로 보존합니다.
- **CUIT-038** Go: `compose.DecodeOrdered`, `generator.DecodeJSON`과 `ValidateJSON`, `ValidateListJSON`,
  `ValidateDetailJSON` 진입점은 이스케이프된 서로게이트를 3바이트로, UTF-8이 아닌 바이트를 그대로
  보존하므로 검사가 둘 다 보고합니다. `encoding/json`만 쓰면 둘 다 바뀝니다.
  `compose.DecodeRawMembers`는 값을 디코딩하지 않고 객체를 멤버로 나눕니다.
  `generator.CheckBindText`는 `FormTemplate` 디코딩 전에 디코딩된 템플릿을 검사합니다.
  `FormTemplate`의 JSON 인코딩은 잘못된 텍스트를 바꾸기 때문입니다.
- **CUIT-039** PHP: `Polyspec\Crudui\Validator\Support\JsonText::decode`는
  `json_decode($json, false, 512, JSON_THROW_ON_ERROR)`와 같은 값을 반환하고, 이스케이프된
  서로게이트를 3바이트로 보존합니다. 이 클래스는 의존성이 없습니다.
- **CUIT-040** Rust: `polyspec_crudui_validator::text::JsonText`는 ordered-json의 읽기로 아무것도 바꾸지 않고 텍스트를
  읽습니다. 반복된 멤버 이름은 거부하고, 짝 없는 서로게이트 이스케이프는 그 코드 단위로 유지합니다. Rust 코어가 쓰는
  JSON 텍스트의 문자열·숫자 토큰은 ordered-json의 쓰기에서 옵니다.
  `validate_text`, `validate_list_text`, `validate_detail_text`는 이 값으로 검증 진입점을 실행하고,
  `polyspec_crudui_generator::text`는 생성 진입점의 검사를 제공합니다.

JSON 텍스트는 UTF-8입니다. JSON 요청을 읽는 프로그램은 디코딩 전에 UTF-8이 아닌 입력을 잘못된
JSON으로 거부합니다.

## 공유 케이스

[`tests/fixtures/text-validity`](../../tests/fixtures/text-validity/README.ko.md)에는 연산마다
케이스 파일이 하나씩 있고, 공유하거나 자기 자신을 담는 값을 받는 런타임이 자기 컨테이너로 만드는
`value-graphs.json` 케이스가 있습니다. Rust 코어 시험은 값이 트리인 케이스(`flat`, `chain`)를 만들고,
공유하거나 자기 자신을 담는 값의 케이스(`doubled`, `self-twice`)는 바인딩 순회의 케이스입니다(CUIT-042).
JSON 텍스트로 전달할 수 없는 바이트 문자열은 바이트 문자열 런타임의
각 테스트가 검사합니다.
