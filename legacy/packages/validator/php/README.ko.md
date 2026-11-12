# CRUDUI PHP 검증기
<!-- doc-id: packages-validator-php-readme -->
<!-- source-sha256: 49574dc3f713ff671f8a4597d5068831afbb4ba2b3a71421f338843d31f89441 -->

[English](README.md).

PHP에서 명세를 합성하고, 표현식을 평가하고, 데이터를 검증합니다.

```sh
composer install
composer test --working-dir=legacy/packages/validator/php
```

## 공개 API

```php
require 'vendor/autoload.php';

use Polyspec\Crudui\Validator;

$spec = json_decode('{"type":"group","properties":{"name":{"type":"text","validate":{"required":true}}}}');
$result = Validator::validate($spec, ['name' => 'Ada']);
assert($result->valid);
```

`Validator::validate($spec, $data, $options)`는 명세를 합성하고, 지원하지 않는
메타데이터를 검사하고, 제출한 데이터를 검증합니다. `Validator::validateList`는
목록 명세의 합성과 메타데이터를 검사하며 행 데이터는 검증하지 않습니다.
`Validator::validateDetail`은 루트와 `fields` 맵의 `$ref`, `$patch`를 포함한 상세
명세의 합성과 메타데이터를 검사하며 레코드 데이터는 검증하지 않습니다. 두 메서드
모두 로드에 성공하면 `{ valid: true, errors: [] }`를 반환합니다.
옵션은 `files` 객체와 `basepath`를 받습니다. 합성 실패는
`Polyspec\Crudui\Validator\Compose\ComposeLoadError`를 발생시킵니다. 형태가 잘못된 제출
데이터는 코드 `INVALID_FORM_INPUT`인 `Polyspec\Crudui\Validator\Validate\FormInputError`를
발생시킵니다.
`getCompositionTrace()`는 명세 경로를 반환하고, `getTrace()`는 예외 스택을
반환합니다.

결과와 오류 항목은 `stdClass` 객체입니다. `errors`는 `path`, `field`, `rule`,
`message`, `value`를 포함하는 레코드 배열입니다. 연관 PHP 배열과 `stdClass`는
객체이며 연속된 PHP 배열은 배열입니다. 빈 객체는 `new stdClass()`를 사용합니다.
오류 값을 포함하여 중첩 객체, 배열과 `null`을 구분합니다. 잘못된 UTF-8 문자열과
객체 키는 검증 전에 `InvalidArgumentException`을 발생시킵니다.

공개 클래스는 `Polyspec\Crudui\Validator`입니다. 네이티브 확장이 클래스를 등록하면
PHP는 해당 구현을 사용하며, 그렇지 않으면 Composer가 PHP 클래스를 자동으로
로드합니다. [PHP API 계약](../../../../docs/operations/php-extension.ko.md)이 메서드 일치와
로딩 동작을 정의합니다. 내부 합성과 표현식 모듈은
[PHP 생성기](../../generator/php/README.ko.md)와 공유합니다.

`composer test`는 저장소 테스트 실행기로 합성, 표현식, 현재 검증, 필드 모델, 규칙,
공개 심볼 문서 검사를 실행하며 모든 테스트를 경과 시간과 함께 출력합니다.
[기능 상태](../../../../docs/features.ko.md)는 현재 검증과 게시 상태를 구분하여 기록합니다.
