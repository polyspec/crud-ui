# CRUDUI PHP 생성기
<!-- doc-id: packages-generator-php-readme -->
<!-- source-sha256: e1173b619b2a72c2efb2b1324b9f9da33b4f7b105059638b933e5b101fb60be4 -->

[English](README.md).

재사용할 폼 구조를 컴파일하고, 레코드 데이터를 주입하고, 키가 있는 행을 편집하고,
PHP에서 폼·목록·읽기 전용 상세를 렌더링합니다. 렌더링과 검증은 PHP 프로세스에서 실행합니다.

## 설치와 검증

저장소 루트에서 실행합니다.

```sh
composer install
composer test --working-dir=legacy/packages/generator/php
```

Composer 경로 저장소는 인접 패키지의 `polyspec/crudui-validator`를 `vendor/`에 link합니다.
64비트 PHP 8.4 이상과 `mbstring`이 필요합니다. 개발 검사는 DOM을 포함하여
PHPUnit이 사용하는 확장도 필요합니다.

## 폼 API

```php
require 'vendor/autoload.php';

use Polyspec\Crudui\Form;
use Polyspec\Crudui\Generator;

$spec = json_decode('{"type":"group","properties":{"name":{"type":"text","label":"Name"}}}');
$template = Generator::compileForm($spec, ['keyPrefix' => 'form']);
$cache = json_encode($template, JSON_THROW_ON_ERROR);

$initial = new Form($template, ['name' => 'Ada']);
$injected = new Form(json_decode($cache, false, 512, JSON_THROW_ON_ERROR));
$injected->setData(['name' => 'Ada']);
assert(Generator::renderForm($initial) === Generator::renderForm($injected));
echo Generator::renderForm($initial);
```

컴파일은 `files`, `basepath`, `keyPrefix`를 받습니다. 데이터 바인딩과 인스턴스는
`language`, `idPrefix`, `keyPrefix`, `unsupported`를 받습니다. 한 문서에 여러
폼을 표시할 때는 서로 다른 `idPrefix`를 사용합니다.

`Generator::bindForm($template, $data, $options)`는 평가한 필드 모델을 반환합니다.
`Generator::renderForm($form)`은 HTML `form` 요소를 제외한 HTML을 반환합니다.
`Generator::renderList($spec, $rows, $options)`는 전달한 행을 `options.layout`으로 선택한
`table` 또는 `card` 구조로 렌더링합니다.
`Generator::buildList($spec, $rows, $options)`는 렌더링에 사용하는 평가한 목록 모델을 반환합니다.
`Generator::renderDetail($spec, $record, $options)`은 전달한 레코드 하나를 읽기 전용 상세로
렌더링하고, `Generator::buildDetail($spec, $record, $options)`은 렌더러가 사용하는 마크업 없는
상세 모델을 반환합니다. `Generator::buildOutline($nodes)`는 평가된 node의 구조 지도 행을 반환합니다. 어느 렌더링 메서드도 다른 데이터를 읽지 않습니다. 호스트가 전송
처리, 스타일과 필드에 선언한 브라우저 통합을 제공합니다.

날짜와 날짜·시간 입력, 목록 날짜 표시는 UTC를 사용합니다. 명시적인 오프셋은
표시 전에 변환하고, 오프셋 없는 타임스탬프는 UTC로 해석합니다.
유효하지 않거나 지원하지 않는 날짜 문자열과 원본 인스턴스 데이터는 변경하지 않습니다.

`Form`은 `getTemplate`, `getFields`, `getDescription`(인스턴스 언어로 번역한 루트 설명),
`getRevision`, `getData`, `getValue`, `setData`, `setValue`, `addRow`, `copyRow`, `removeRow`,
`moveRow`, `rekeyRow`를 제공합니다. 반환값은 독립된 복사본입니다. 잘못된 작업은 데이터, 필드와
리비전을 변경하지 않습니다.

```php
$companySpec = json_decode('{"type":"group","properties":{"companies":{"type":"group","multiple":true,"properties":{"name":{"type":"text"}}}}}');
$form = new Form(Generator::compileForm($companySpec), ['companies' => new stdClass()]);
$key = Generator::sequenceRowKey(42);
$form->addRow('companies', ['key' => $key, 'value' => ['name' => 'Example']]);
$form->copyRow('companies', $key, ['key' => 'new-company']);
$form->moveRow('companies', 'new-company', 0);
$form->rekeyRow('companies', 'new-company', Generator::sequenceRowKey(43));
```

반복 데이터는 행 식별자를 키로 사용하는 객체입니다. 반복 데이터가 없으면
행 하나를 생성하며, 명시적인 빈 `stdClass`는 행을 생성하지 않습니다. 연속된
PHP 배열은 JSON 배열입니다. 연관 PHP 배열과 `stdClass`는 객체입니다. 반환하는
레코드와 템플릿은 `stdClass`이며 목록은 배열입니다. 중첩된 빈 배열, 빈 객체와
`null`을 구분합니다. 숫자 행 키는 거부합니다. 데이터베이스 시퀀스는
`sequenceRowKey`로 변환합니다.

JSON 경계에서는 `json_decode($json, false, 512, JSON_THROW_ON_ERROR)`로
decode해야 합니다. `true` 연관 배열 모드는 빈 객체와 배열의 구분을 잃고,
연속된 숫자 키를 가진 객체도 목록처럼 만들 수 있습니다. 명시적인 빈 객체에는
`new stdClass()`를 사용합니다. 객체 인수에는 연관 배열을, API가 루트 객체 타입을 정한
인수에는 빈 배열을 빈 루트 객체로 전달할 수 있습니다.

합성 실패는 `Polyspec\Crudui\Validator\Compose\ComposeLoadError`를 발생시킵니다.
`getCompositionTrace()`는 `getTrace()`가 반환하는 예외 스택과 별도로
명세 경로를 반환합니다.
생성 실패는 `Polyspec\Crudui\FormError`를 발생시키며, `getErrorCode()`와 `getPath()`가
오류 코드와 필드 경로를 반환합니다. 지원하지 않는 필드는
`UNSUPPORTED_FIELD_TYPE`, 그 외 잘못된 생성 입력은 `INVALID_FORM_INPUT`을 사용합니다.
잘못된 공개 인수 타입은 `TypeError`를 발생시킵니다.
잘못된 UTF-8 문자열과 객체 키는 폼 상태를 변경하기 전에 거부합니다.

## PHP 예제

```sh
CRUDUI_DATA_FILE=/tmp/crudui-php-example.json php -S 127.0.0.1:8082 -t legacy/packages/generator/php/examples
```

예제는 같은 레코드에 대한 폼, 목록, 상세 명세를 선언하고 저장된 레코드 파일 하나로
세 페이지를 제공합니다.

| 페이지 | URL | 출력 |
| --- | --- | --- |
| 폼 | `http://127.0.0.1:8082/` | `Generator::renderForm`. 일반 폼 전송을 수신하고 검증한 뒤 유효한 레코드를 명시한 경로에 JSON으로 저장하고 다시 조회합니다 |
| 목록 | `http://127.0.0.1:8082/?view=list` | 저장된 레코드를 유일한 행으로 쓰는 `Generator::renderList`(처음 저장하기 전에는 행이 없음). 이름은 상세 페이지 링크, 수준은 `choice-label`, 메모는 잘린 `text`입니다 |
| 상세 | `http://127.0.0.1:8082/?view=detail` | 저장된 레코드의 `Generator::renderDetail`. 이메일은 `mailto:` 링크, 수준은 `choice-label`입니다 |

모든 페이지는 `crudui.css`에서 스타일을 가져옵니다. 같은 파일은 `crudui` 확장을
불러온 경우(예: `-d "extension=$(pwd)/legacy/packages/php-ext/modules/crudui.so"`)에도 수정 없이
실행됩니다. 브라우저 행 편집과 순서 보존 JSON HTTP 엔드포인트는 제공하지 않습니다.

## 공통 검사

[네이티브 공통 검사](../../../tests/native-generators/README.ko.md)는 런타임별 전체
템플릿과 모델, 폼과 목록 HTML 원문, 데이터 주입, 행 작업과 실패 후 보존한
상태를 비교합니다.

[폼 계약](../../../../docs/spec/form-runtime.ko.md),
[PHP API 계약](../../../../docs/operations/php-extension.ko.md),
[런타임 요구사항](../../../../docs/spec/runtime-packages.ko.md)이 공통 동작을 정의합니다.
[기능 상태](../../../../docs/features.ko.md)는 검증과 게시 상태를 구분하여 기록합니다.
