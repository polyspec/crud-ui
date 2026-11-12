# 검증 고정 데이터
<!-- doc-id: tests-fixtures-validate-readme -->
<!-- source-sha256: 731d60c0fc1fb4c34c732f895b7ddb2eca753de68c15c8db1d83ad6bced39dfb -->

[English](README.md).

`cases.json`은 binding 생성 시험의 case 형식(G-5)으로 Rust 코어의 공유 폼 검증 사례를 담습니다. group `cases`가 사례를
나열하고, 각 사례는 `id`, `name`, `note`, `requirements`, `validate`의 인수 `spec`, `data`, `files`를 담은 선택적인
`options`, 그리고 `expected` 또는 `raises`를 제공합니다. `spec`, `data`와 모든 파일은 `json_value` 값이며
`{ "kind", "value" }`로 씁니다(`null`, `bool`, 리터럴을 텍스트로 담은 `number`, `text`, `list`, `[이름, 값]` 쌍을 순서대로 담은
`map`). `expected`는 `{ valid, errors, hidden }` 전체 결과이며 모든 오류는 `path`, `field`, `rule`, `message`, `value`를
가집니다. `raises`는 `{ kind, status, category, message, at }`입니다. `kind`는 실패 코드의 소문자이고, 합성 실패의 `at`은
합성 경로를 `.`으로 이은 값이며 입력 실패의 `at`은 빈 문자열입니다. legacy 구현은
[legacy/tests/fixtures/validate](../../../legacy/tests/fixtures/validate/README.ko.md) 아래 사본을 그 사본의 형식으로 읽습니다.

규칙 안의 상대·부모·필드 경로, 삼항식과 조건맵 제한값, 조건부 필수 입력, 키를 가진 그룹과 스칼라, 반복
필드 경로, `unique`, `mincount`, `equalTo`, `containedIn`, `typeFrom`, `minFrom`, `maxFrom`, `equalTo`·`containedIn`·`typeFrom`·`minFrom`·`maxFrom`·`enddate`·`notEqual`·`unique` 매개변수의 형식, 정규식과 `accept` 값, 번역한 라벨과 빈 라벨을 가진 선택지
포함 검사, `in` 멤버인 선택 목록과 그 매개변수 오류, 어떤 값과도 일치하지 않는 빈 멤버 집합, 멤버 순서, 합성한 명세, 필드별 첫 오류, 선언한 규칙 이름 기준의 메시지 재정의, 등록되지 않은
규칙 이름(`validate`와 `messages`, 중첩 행 경로, 숨긴 필드, 검사 순서), 형식 규칙을 건너뛰는 빈 값, 제출
데이터의 형태를 검사합니다.
참조 사례는 `reference`를 검사합니다. 선언 경로 위 모든 행에서 가져온 id, 그 id와의 포함 여부 일치, 숨긴 필드의
id, id가 없는 form, 매개변수 오류를 확인합니다.
데이터의 한도와 그 매개변수, 제출 데이터의 형태를 검사합니다.
데이터 형태 사례는 루트·그룹·반복 그룹 행의 미선언 멤버와, 숨긴 필드를 포함해 단일 선택 필드나 그
행의 값인 배열 또는 객체를 거부하며 조건식이 참조하는 필드는 각 명세에 선언합니다. 표시 여부 사례는 `design.show`(행 문맥의 표현식, 조건맵
또는 `false`)로 숨긴 필드가 자신과 포함한 모든 필드의 규칙을 건너뛰고, 다른 규칙은 유지한 값을 그대로
읽으며, 세 단계 전환에서 필드를 다시 보이면 유지한 값을 다시 검증하는지 확인합니다. `multiple: only`
사례는 데이터 행의 행별 검증과, 행이 없지만 `required`와 `mincount`에는 실패하는 데이터 없음 상태를
확인합니다. 그룹 소스 사례는 필드가 반복 그룹의 행에서 가져오는 선택지를 확인합니다. 정규 텍스트나 숫자 값으로
일치하는 값, 선택지가 되지 않는 행, 데이터가 없는 그룹, 선언한 규칙보다 먼저 실행하는 암묵적 `in` 검사,
숨겨진 그룹의 행, 그룹 소스의 로드 실패를 다룹니다. combined items 사례는 리터럴 선택지가 있는 그룹 소스를 확인합니다:
리터럴 값과 행 값의 한 집합, 리터럴 선택지를 반복하는 행의 경로와 값으로의 거부, `choices`의 로드 실패입니다. multiple 형태 사례는 불리언, `only`, 객체가 아닌 `multiple`이
필드의 선언 경로에서, 그 규칙보다 먼저 로드에 실패하는지 확인합니다. placeholder 사례는 option이 없는 select나 search 필드의 placeholder option이 주는 빈 값이
`required`에서 실패하고 다른 모든 규칙을 통과하는지 확인합니다. 실패 사례는 `REF_FILE_NOT_FOUND`, `INVALID_RULE_PARAMETER`, `INVALID_RULE_PATTERN`,
`UNKNOWN_RULE`, `INVALID_FORM_INPUT`을 사용합니다. [테스트 고정 데이터 계약](../../../docs/operations/test-fixtures.ko.md)이
형식을 설명합니다.

## 비교

모든 사용처는 검증기를 실행해 결과 또는 실패 기록 전체를 비교합니다. `errors` 배열은 순서대로 비교합니다.
Go·Rust·PHP는 숫자를 값으로 비교하므로 `5`와 `5.0`은 같습니다.
[PHP 확장 실행기](../../../legacy/packages/php-ext/tests/ValidateReport.php)는 JSON 문자열을 비교하므로 멤버 순서도
비교합니다. 실패 사례는 `code`, `message`, `at`을 정확히 비교하며, 모든 사례는 `expected`와
`raises` 중 정확히 하나를 선언해야 합니다. [빈 collection](../../../docs/spec/empty-collections.ko.md) 또는 [검증 규칙](../../../docs/spec/validation-rules.ko.md)의 requirement를 시험하는 case는 `requirements`에 id를 나열합니다.

교차 검증 콘솔의 검증기 프로세스는 각 사례를 표준 입력으로 받습니다. 결과 사례는 종료 코드 `0`과 함께
결과를 표준 출력에 쓰고, 실패 사례는 종료 코드 `2`와 함께 `{ error, code, at }`을 씁니다.

[TypeScript](../../../legacy/packages/validator/ts/src/validate.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Validate/ValidateConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/validate/conformance_test.go),
[Rust](../../../packages/validator/rust/tests/validate_conformance.rs)의 검증 적합성 검사,
[PHP 확장 엔진 검사](../../../legacy/packages/php-ext/tests/engine/engine.test.mjs)와
PHP 검증기와 네이티브 검증기를 실행하는 [PHP 확장 API 검사](../../../legacy/packages/php-ext/tests/ApiTest.php),
모든 사례를 다섯 검증기 프로세스에 보내는 교차 검증 콘솔의
[검증기 프로세스 검사](../../../legacy/examples/cross-check-console/server/validator-processes.test.mjs)와
네 언어 결과를 비교하는 [검증 실행기 검사](../../../legacy/examples/cross-check-console/server/validate-runner.test.mjs)가
사용합니다.

## 작성

`cases.json`은 직접 고치는 데이터입니다. TypeScript 런타임이 기준이던 동안에는 TypeScript 생성기 `generate.mts`와 그
모듈이 legacy 사본의 형식으로 이 파일을 썼습니다. 이들은 legacy 구현의 도구이며 실행하지 않습니다. 어떤 프로그램도
기대값을 생성하지 않으며, 케이스가 결과를 시험하는 Rust 코어도 기대값을 쓰지 않습니다.
