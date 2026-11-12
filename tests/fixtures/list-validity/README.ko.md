# 목록 유효성 고정 데이터
<!-- doc-id: tests-fixtures-list-validity-readme -->
<!-- source-sha256: 26a9bcc788346cccda2195b69241cc16fd9941d7a678fed5f62b34ca726d7cc6 -->

[English](README.md).

`cases.json`은 binding 생성 시험의 case 형식(G-5)으로 사례를 담습니다. group `cases`가 사례를 나열하고, 각 사례는
`{ id, name, note, spec, options?, expect, reason?, raises?, requirements? }`입니다. `spec`과 모든 파일은 `json_value` 값이며
[검증 고정 데이터](../validate/README.ko.md)처럼 `{ "kind", "value" }`로 씁니다. 다른 구조 유효성 고정 데이터인
[폼](../spec-validity/README.ko.md)은 평범한 `spec`, `files`, `engine`을 가진 자기 형식을 유지합니다.

- `expect`는 [메타 스키마](../../../contracts/schema/crudui.schema.json)의 `#/definitions/List`에 대한 메타 스키마 결과인 `"ok"` 또는 `"fail"`입니다.
- `reason`은 `"fail"` 사례에만 있으며 그 사례에는 반드시 있어야 합니다. 오류 중에 나타나야 하는 Ajv
  키워드를 지정합니다.
- `raises`는 `validate_list`의 런타임 구조 검증 실패인 `{ kind, status, category, at }`이며, 소문자 로드 실패 코드와 합성 경로를
  `.`으로 이은 값입니다. `raises`가 없는 사례는 로드 실패가 없고 결과가 `{ valid: true, errors: [] }`입니다.
- `options.files`는 모든 런타임 사용처가 엔진에 전달하는 합성 파일 묶음입니다. 메타 스키마는 `spec`만 읽습니다.

두 결과는 서로 독립적입니다. 모든 사용처는 자신이 담당하는 모든 멤버를 적용하며, 사례를 스스로 분류하거나
자체 파일을 제공하는 사용처는 없습니다. `npm run spec:schema`로 실행하는
[`check-schema.mts`](../../../scripts/check-schema.mts)는 `expect`와 `reason`을 확인하기 전에 세 고정
데이터 모두의 형태를 검사합니다.

`columns` 누락, 알 수 없는 `sort` 키, 잘못된 `pagination.mode`처럼 메타 스키마만 거부하는 형태는
`raises`가 없습니다.

허용 사례는 최소 열, 모든 셀 형식, 축약형과 불리언 형식, 정렬, 페이지 나누기, 동작, 빈 상태와 디자인,
설명, 합성한 열, 합성한 검색 폼을 검사합니다. 거부 사례는 열 누락, 콘텐츠가 아닌 설명, 금지 키와 `x`로 시작하는 열 키, 열·정렬·
페이지 나누기·동작·목록 루트의 알 수 없는 키, 형식 옵션 안의 금지 키, 잘못된 열거값, 잘못된 형식 값을
다룹니다.

## 비교

[목록 메타 스키마 검사](../../../legacy/packages/validator/ts/src/list-metaschema.conformance.test.ts)와
`check-schema.mts`는 목록 진입점을 컴파일해 `expect`와 `reason`을 확인합니다.

런타임 검사는 `spec`을 `options.files`와 함께 검증하고 행은 읽지 않으며 `raises`와 비교합니다. Rust 구조 API는
`"pass"`에 대해 `{ valid: true, errors: [] }`에 해당하는 `Ok(())`를 반환합니다.
교차 검증 콘솔은 모든 사례를 다섯 검증기 프로세스에 보내며, 각 프로세스는 깨끗한 결과와 함께 종료 코드
`0`, 또는 `{ error, code, at }`과 함께 종료 코드 `2`로 끝나고 모두 같은 결과, 코드, 위치를 내야 합니다.

[TypeScript](../../../legacy/packages/validator/ts/src/validate-list/validate-list.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Validate/ListValidateConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/validate/list_conformance_test.go),
[Rust](../../../packages/validator/rust/tests/list_validity_conformance.rs)의 목록 검증 검사,
[PHP 확장 엔진 검사](../../../legacy/packages/php-ext/tests/engine/engine.test.mjs),
[PHP 확장 실행기](../../../legacy/packages/php-ext/tests/ValidateReport.php), 교차 검증 콘솔의
[목록 실행기 검사](../../../legacy/examples/cross-check-console/server/validate-list-runner.test.mjs)와
[검증기 프로세스 검사](../../../legacy/examples/cross-check-console/server/validator-processes.test.mjs)가 런타임
사용처입니다.

[렌더 유효성 검사](../../../legacy/packages/generator/ts/src/display-validity.test.ts)는 모든 사례를
`buildList`로 만듭니다. `expect`가 `"ok"`이고 `raises`가 없는 사례만 만들어지고, `raises`의 실패는
렌더 실패와 같으며, 그 밖의 사례는 `INVALID_FORM_INPUT`으로 실패합니다
([표시 형식 선언](../../../docs/spec/display-formats.ko.md#선언)).

## 재생성

생성기는 없으며 사례는 직접 작성합니다. `expect`와 `reason`은 메타 스키마의 목록 정의와, `raises`는 모든
런타임의 합성 및 금지 키 검사와 일치해야 합니다. 합성 사례는 참조하는 모든 파일을 `files`에 담아야 합니다.
사례를 변경한 뒤 메타 스키마 검사와 모든 런타임 사용처를 실행합니다.
