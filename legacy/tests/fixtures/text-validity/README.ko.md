# 입력 텍스트 픽스처
<!-- doc-id: tests-fixtures-text-validity-readme -->
<!-- source-sha256: 048dbac18922262d8fbbc97fcf67e3330f763054087b9a215b5b8837fceea40d -->

[English](README.md).

이 케이스들은 [입력 텍스트](../../../../docs/spec/input-text.ko.md) 규칙을 정의합니다. 명세, 합성 파일,
호출자 데이터의 모든 문자열과 객체 멤버 이름은 유니코드 스칼라 값의 나열이며, 연산은 다른 검사보다
먼저 그 밖의 텍스트를 거부합니다.

각 디렉터리에는 연산 하나의 `cases.json`이 있습니다. 연산은 `validate`, `validateList`,
`validateDetail`, `compileForm`, `bindForm`, `createForm`, `buildList`, `buildDetail`입니다. 파일은
쌍이 없는 서로게이트를 `"\ud800"` 같은 이스케이프로 쓴 JSON 텍스트입니다. 단독 하위 서로게이트와
순서가 뒤바뀐 `"\udc00\ud800"`도 문자열 값, 멤버 이름, 배열, 중첩 행, 합성 파일, 옵션에 들어
있습니다. 이 이스케이프를 바꾸거나 거부하는 디코더로는 파일을 읽을 수 없으므로, 각 테스트는 명세가
해당 런타임에 지정한 디코더로 읽습니다.

케이스는 `name`, `note`, `expect`와 연산의 입력을 가집니다. [입력 텍스트](../../../../docs/spec/input-text.ko.md)의 requirement를 시험하는 케이스는 `requirements`에 id를 나열합니다.

- `spec`, 그리고 검증 연산의 `files`
- `data`(검증, 바인딩, 인스턴스), `rows`(목록), `record`(상세)
- `options`. 생성 연산의 합성 파일은 `files` 멤버에 둡니다
- `template`. `spec`에서 컴파일한 템플릿 대신 JSON 텍스트로 주는 템플릿입니다
- `action`. 생성한 폼에 대한 `{ method, args }` 호출 하나이며, 그 결과가 기대값입니다

`expect`는 실패 `{ code, message, at }`이거나 통과하는 케이스의 결과입니다. `validate`는 검증 결과
`{ valid, errors, hidden }`, `validateList`와 `validateDetail`은 `{ valid, errors }`, 생성 연산은
`"pass"`입니다. 올바른 서로게이트 쌍과 U+E000부터 U+FFFF까지의
문자를 쓴 케이스는 올바른 텍스트가 통과하는지, 멤버가 코드 포인트 순서를 따르는지 확인합니다.

## 값 그래프

`value-graphs.json`에는 값 한도 케이스가 있습니다. 값을 그 값이 나타내는 트리로 순회할 때 노드는
최대 1,000,000개, 중첩은 최대 512단계이며, 자기 자신을 담는 값은 한도를 넘습니다. JSON 텍스트는
컨테이너를 공유할 수 없으므로 각 케이스는 값 그래프를 `graph`에 기술합니다. 각 테스트는 자기
컨테이너로 그래프를 만들어 케이스의 `validate` 입력에서 `graph.at` 위치에 둡니다. 이 경로는 `spec`,
`files`, `data` 중 하나로 시작합니다. 모양은 다음과 같습니다.

- `doubled`: `leaf`를 이전 값을 두 번 담는 목록에 넣기를 `size`번 반복한 값
- `chain`: `leaf`를 `size`겹의 목록에 넣은 값
- `flat`: `leaf`인 항목 `size`개를 담은 목록 하나
- `self-twice`: 멤버 `self`와 `again`이 객체 자신인 객체. PHP에서는 자기 자신에 대한 참조 두 개를
  담은 배열입니다

Native 경계에서 허용되는 case는 `dataLimits.depth` 512 또는 `dataLimits.values` 1000000을 선언하므로 더 작은 기본 submission budget이 native value limit 검사를 먼저 거부하지 않습니다.

모든 케이스는 실행기의 테스트별 제한 시간 안에서 테스트 하나로 실행됩니다. 값이 나타내는 트리에 비례해
커지는 순회(40단계 공유 목록이면 2^40개 노드)는 그 안에 끝나지 않습니다. 절대 시간 기준은 기계 속도에 따라
달라지므로 단언하지 않습니다.
TypeScript, PHP, Go, PHP 확장 테스트가 실행합니다. Rust 값은 노드를 소유해 공유할 수 없으므로 Rust는
실행하지 않습니다.

## 사례를 읽는 테스트

검증 연산은 [TypeScript](../../../legacy/packages/validator/ts/src/text/text-validity.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Validate/TextValidityConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/validate/text_conformance_test.go),
[Rust](../../../../packages/validator/rust/tests/text_validity_conformance.rs) 테스트,
[API 테스트](../../../legacy/packages/php-ext/tests/ApiTest.php)가 실행하는
[PHP 확장 러너](../../../legacy/packages/php-ext/tests/ValidateReport.php), 그리고 모든 케이스를 다섯 검증
프로세스에 보내는 교차 검증 콘솔
[검증 프로세스 테스트](../../../../examples/cross-check-console/server/validator-processes.test.mjs)가
실행합니다.

생성 연산은 [generator core 테스트](../../../legacy/packages/generator/ts/src/input-text.test.ts)가
프로세스 안에서 실행하고, [네이티브 생성기 스위트](../../../../tests/native-generators/README.ko.md)가 모든
프로그램으로 실행하며 JavaScript, PHP, Go, Rust, PHP 확장 런타임의 증거를 기록합니다.

UTF-8이 아닌 바이트 문자열은 JSON 텍스트로 쓸 수 없습니다. PHP, Go, Rust 디코더, PHP 확장 테스트가
직접 검사하고, 프로그램은 UTF-8이 아닌 표준 입력을 거부합니다.

## 케이스 변경

케이스는 직접 작성합니다. 케이스마다 기대값을 하나 두고, 변경한 뒤에는 모든 테스트를 실행합니다.
