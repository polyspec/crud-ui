# 데이터 검증
<!-- doc-id: docs-operations-validation -->
<!-- source-sha256: ccbec356ec72807ceba47f89a638315ddbe3b4df7b06f4a5f32881d8e17a7117 -->

[English](validation.md).

클라이언트와 서버는 같은 스펙으로 데이터를 검증합니다. 필드는 검증 규칙에
`validate`를 사용합니다. 스펙의 선언 형식은 [스키마 절차](schema-validation.ko.md)로
별도 검증합니다. [스키마 계약](../spec/schema.ko.md)은 조합과 허용 필드를 정의합니다.

먼저 의존성을 설치하고 JavaScript 패키지를 빌드합니다. JavaScript와 PHP 예제는
저장소 루트에서 실행하며 Go와 Rust는 아래에 설명한 모듈 설정을 사용합니다.
각 언어 예제는 필수 이메일에 빈 값을 제공하며 `valid`가 false인지 검사합니다.

## TypeScript와 JavaScript

패키지 루트는 `validate(spec, data, options?)`를 export합니다. 옵션은 조합에
필요한 `files`, `loader`, `basepath`를 받습니다. 로더를 지정하면 메모리 파일
집합보다 우선합니다.

```js
import { validate } from '@polyspec/crudui-validator';

const spec = {
  type: 'group',
  properties: { email: { type: 'email', validate: { required: true, email: true } } },
};
const result = validate(spec, { email: '' });
if (result.valid || result.errors[0]?.rule !== 'required') {
  throw new Error('Expected required validation failure');
}
```

## PHP

`Polyspec\Crudui\Validator::validate`은 스펙, 데이터, 선택적 가상 파일,
선택적 로더와 기준 경로를 받습니다. 결과는 `valid`, `errors`, `toArray()`를 제공합니다.

```php
<?php
require 'vendor/autoload.php';

use Polyspec\Crudui\Validator;

$spec = [
    'type' => 'group',
    'properties' => [
        'email' => ['type' => 'email', 'validate' => ['required' => true, 'email' => true]],
    ],
];
$result = Validator::validate($spec, ['email' => '']);
if ($result->valid || $result->errors[0]['rule'] !== 'required') {
    throw new RuntimeException('Expected required validation failure');
}
```

## Go

`validator/validate` 패키지는 순서를 보존한 스펙 값에 `Validate`, JSON 바이트에
`ValidateJSON`을 제공합니다. `ValidateJSON`은 스펙 바이트, 데이터 바이트,
가상 파일 바이트와 기준 경로를 받습니다. 예제는 `legacy/packages/validator/go` 모듈에서
실행합니다. 결과는 `Valid`와 `Errors`를 제공합니다.

```go
package main

import (
    "fmt"
    "github.com/polyspec/crudui/packages/validator/go/validator/validate"
)

func main() {
    spec := []byte(`{"type":"group","properties":{"email":{"type":"email","validate":{"required":true,"email":true}}}}`)
    result, err := validate.ValidateJSON(spec, []byte(`{"email":""}`), nil, "")
    if err != nil {
        panic(err)
    }
    if result.Valid || len(result.Errors) == 0 || result.Errors[0].Rule != "required" {
        panic(fmt.Errorf("expected required validation failure"))
    }
}
```

## Rust

크레이트 루트는 `validate`와 `ValidateOptions`를 export합니다. 옵션은 가상 파일,
로더와 기준 경로를 받습니다. 예제는 `polyspec-crud-ui-validator` 크레이트와
`serde_json` 의존성을 사용해 실행합니다.

```rust
use polyspec_crud_ui_validator::{validate, ValidateOptions};
use serde_json::json;

fn main() {
    let spec = json!({
        "type": "group",
        "properties": {"email": {"type": "email", "validate": {"required": true, "email": true}}}
    });
    let result = validate(&spec, &json!({"email": ""}), &ValidateOptions::default())
        .expect("specification should load");
    assert!(!result.valid);
    assert_eq!(result.errors[0].rule, "required");
}
```

## 브라우저 검증

서버가 렌더링한 폼을 서버가 검증할 때 쓰는 스펙으로 브라우저에서 검증하면 사용자는 요청을 보내기 전에
오류를 봅니다. [브라우저 검증 계약](../spec/form-runtime.ko.md#브라우저-검증)이 데이터, 오류 마크업,
시점을 정의합니다. 서버는 받은 모든 제출을 계속 검증합니다.

1. `keyPrefix`로 컴파일한 템플릿에서 서버가 `renderForm(form, { action, ... })`으로 완전한 폼을
   렌더링합니다.
2. 스펙을 페이지와 함께 보냅니다. 예를 들어 `<script type="application/json">` 요소에 JSON으로
   넣습니다. 바인딩은 파일이나 로더 없이 `validate(spec, data)`를 호출하므로 합성을 해석한 스펙을
   보냅니다.
3. 같은 키 접두사와 페이지 문구로 파싱된 `form` 요소를 연결합니다.

```js
import { bindForm } from '@polyspec/crudui-form-binding';

const texts = { 'email.required': 'Enter your email address.', invalid: 'Check the marked fields.' };
const spec = JSON.parse(document.querySelector('#member-spec').textContent);
const binding = bindForm(document.querySelector('#member-form'), spec, {
  keyPrefix: 'form',
  message: (error) => texts[`${error.field}.${error.rule}`] ?? error.message,
  formErrors: (result) => (result.valid ? [] : [texts.invalid]),
});
```

바인딩은 바뀐 필드를 포커스를 잃을 때와 그 뒤의 모든 변경에서 검증하고, 제출할 때 폼 전체를
검증합니다. 유효하지 않은 폼은 보내지 않으며 포커스는 첫 번째 유효하지 않은 컨트롤로 옮겨 갑니다.
스크립트로 폼을 보낼 때는 `form.requestSubmit()`을 씁니다. `form.submit()`은 `submit` 이벤트를
발생시키지 않으므로 바인딩이 검증하지 않습니다. 페이지가 폼을 제거하기 전에 `binding.dispose()`를
호출합니다.
바인딩은 데이터가 바뀌면 `design.show`를 선언한 필드와 그룹도 값을 바꾸지 않고 보이거나 숨깁니다
([표시](../../packages/form-binding/README.ko.md#표시)). `@polyspec/crudui-validator`의 `hiddenPaths(spec, data)`는 다른 스크립트에
숨은 경로를 반환합니다.

Chromium, Firefox, WebKit 검사를 포함한 바인딩 검사는 저장소 루트에서 실행합니다.

```sh
make crudui-test-form-binding
```

## 결과와 실패

검증 결과는 불리언 `valid`, 오류 목록 `errors`, `design.show`가 숨기는 필드의 데이터 경로
`hidden`([표시 여부](../spec/validation-rules.ko.md#평가))을 포함합니다. 각 오류는 `path`, `field`,
`rule`, `message`를 명시하며 값이 있으면 `value`를 포함합니다. 필수 입력 실패는 검증 결과입니다.
제출된 데이터를 저장하는 서버는 `hidden` 경로와 그 아래의 값을 저장하지 않을 수 있습니다.

두 가지 실패는 검증 결과를 만들지 않습니다. 조합 참조가 없거나, 금지된 스키마 키가
있거나, 등록되지 않은 규칙 이름(`UNKNOWN_RULE`)이나 정의를 벗어난 규칙 매개변수
([매개변수 오류](../spec/validation-rules.ko.md#매개변수-오류))가 있으면 로드
실패(`ComposeLoadError`)입니다. 형태가 잘못된 제출 데이터는 입력
실패(`FormInputError`, 코드 `INVALID_FORM_INPUT`)입니다.

| 데이터 | 메시지 |
| --- | --- |
| 객체가 아닌 루트 데이터(합성 전에 검사) | `Form data must be an object` |
| 객체가 아닌 명세(루트 데이터 뒤, 합성 전에 검사, CUVR-088) | `Form specification must be an object` |
| 값이 있지만 객체가 아닌 그룹 데이터 또는 반복 그룹 행 | `Group data must be an object: {path}` |
| 값이 있지만 키 기반 객체가 아닌 반복 데이터 | `Repeated data must be a keyed object: {path}` |
| 루트·그룹·반복 그룹 행 데이터에서 선언된 필드가 없는 객체 멤버 | `Unknown form data field: {path}` |
| [단일 선택 필드](../spec/validation-rules.ko.md#평가)나 그 행의 값인 배열 또는 객체 | `Choice data must be a single value: {path}` |

그룹 또는 반복 데이터가 없는 것은 실패가 아닙니다. JavaScript와 PHP는 실패를
예외로 발생시키고, Go는 오류로 반환하며, Rust는 `Err(ValidateError)`를 반환합니다.
모든 구현은 같은 코드, 메시지, 위치를 보고합니다. 로드 실패의 위치는 조합 경로를
`.`으로 연결한 값이고 입력 실패의 위치는 빈 문자열입니다. 실패를 검증 결과로
변환하지 않습니다.

패키지는 이 라이브러리 함수를 제공하며, 어떤 패키지도 검증 명령을 설치하지 않습니다.
교차 검증 콘솔은 같은 함수를 호출하는 작은 프로그램으로 각 구현을 별도 프로세스에서 실행해 네
구현을 비교합니다. 그 요청과 응답 계약은 콘솔의
[검증기 프로세스](../../examples/cross-check-console/validators/README.ko.md) 문서에 있습니다.

제출된 데이터에 대해 `design.show`가 숨기는 필드는 검증하지 않으며 그 값은 데이터에 남습니다.
[표시 여부](../spec/validation-rules.ko.md#평가)를 참고합니다. 저장할 값은 같은
데이터로 결정합니다. `validate.required`의 조건은 보이는 필드를 선택 입력으로 만듭니다.
[표현식 계약](../spec/expressions.ko.md)을 참고합니다.

데이터 검증은 HTTP 디코딩, 저장 또는 전송 순서를 구현하지 않습니다.
해당 작업은 [ordered JSON 절차](ordered-json.ko.md)와
[폼 검사](testing.ko.md#폼과-보고서)를 따릅니다. 전체 심볼 참조는
`make docs-api`로 생성합니다. [문서 절차](documentation.ko.md)를 참고합니다.
