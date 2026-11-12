# 상세 유효성 고정 데이터
<!-- doc-id: tests-fixtures-detail-validity-readme -->
<!-- source-sha256: 80ecf9402ccffa41156992a4326a23d997e1e9dfaed663f40617a1d839b66117 -->

[English](README.md).

`cases.json`의 사례는 다른 구조 유효성 고정 데이터([폼](../spec-validity/README.ko.md),
[목록](../list-validity/README.ko.md), [상세](README.ko.md))와 같은
`{ name, note, spec, files?, expect, reason?, engine }` 형태를 사용합니다.

- `expect`는 [메타 스키마](../../../contracts/schema/crudui.schema.json)의 `#/definitions/Detail`에 대한 메타 스키마 결과인 `"ok"` 또는 `"fail"`입니다.
- `reason`은 `"fail"` 사례에만 있으며 그 사례에는 반드시 있어야 합니다. 오류 중에 나타나야 하는 Ajv
  키워드를 지정합니다.
- `engine`은 런타임 구조 검증 결과입니다. `"pass"`는 로드 실패가 없고 결과가 `{ valid: true, errors: [] }`임을
  뜻하며, `{ code, at }`은 로드 실패 코드와 합성 경로를 `.`으로 이은 값입니다.
- `files`는 모든 런타임 사용처가 엔진에 전달하는 합성 파일 묶음입니다. 메타 스키마는 `spec`만 읽습니다.

두 결과는 서로 독립적입니다. 모든 사용처는 자신이 담당하는 모든 멤버를 적용하며, 사례를 스스로 분류하거나
자체 파일을 제공하는 사용처는 없습니다. `npm run spec:schema`로 실행하는
[`check-schema.mts`](../../../scripts/check-schema.mts)는 `expect`와 `reason`을 확인하기 전에 세 고정
데이터 모두의 형태를 검사합니다.

필드의 `sortable`과 자체 `fields`가 없는 루트 `$ref`는 메타 스키마에서 실패하고 런타임을 통과하며,
해석되지 않는 `$ref`는 메타 스키마를 통과하고 런타임에서 실패합니다. `$patch`로 들어온 금지 키는 둘 모두에서
실패합니다.

기본 상세, 상세 동작, 합성한 필드, 필드 키·동작 이름·필드·형식 옵션·상세 루트의 금지 키, 상세 동작의
알 수 없는 키, 필드의 `show_if`, 해석되지 않는 `fields` 참조를 검사합니다. 런타임 코드는 `FORBIDDEN_META_KEY`와 `REF_FILE_NOT_FOUND`입니다.

## 비교

[상세 메타 스키마 검사](../../../legacy/packages/validator/ts/src/detail-metaschema.conformance.test.ts)와
`check-schema.mts`는 상세 진입점을 컴파일해 `expect`와 `reason`을 확인합니다.

런타임 검사는 `spec`을 `files`와 함께 검증하고 레코드 데이터는 읽지 않으며 `engine`과 비교합니다. Rust 구조
API는 `"pass"`에 대해 `{ valid: true, errors: [] }`에 해당하는 `Ok(())`를 반환합니다.
교차 검증 콘솔은 모든 사례를 다섯 검증기 프로세스에 보내며, 각 프로세스는 깨끗한 결과와 함께 종료 코드
`0`, 또는 `{ error, code, at }`과 함께 종료 코드 `2`로 끝나고 모두 같은 결과, 코드, 위치를 내야 합니다.

[TypeScript](../../../legacy/packages/validator/ts/src/validate-detail/validate-detail.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Validate/DetailValidateConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/validate/detail_conformance_test.go),
[Rust](../../../packages/validator/rust/tests/detail_validity_conformance.rs)의 상세 검증 검사,
[PHP 확장 엔진 검사](../../../legacy/packages/php-ext/tests/engine/engine.test.mjs),
[PHP 확장 실행기](../../../legacy/packages/php-ext/tests/ValidateReport.php), 교차 검증 콘솔의
[상세 실행기 검사](../../../legacy/examples/cross-check-console/server/validate-detail-runner.test.mjs)와
[검증기 프로세스 검사](../../../legacy/examples/cross-check-console/server/validator-processes.test.mjs)가 런타임
사용처입니다.

[렌더 유효성 검사](../../../legacy/packages/generator/ts/src/display-validity.test.ts)는 모든 사례를
`buildDetail`로 만듭니다. `expect`가 `"ok"`이고 `engine`이 `"pass"`인 사례만 만들어지고, `engine` 실패는
렌더 실패와 같으며, 그 밖의 사례는 `INVALID_FORM_INPUT`으로 실패합니다
([표시 형식 선언](../../../docs/spec/display-formats.ko.md#선언)).

## 재생성

생성기는 없으며 사례는 직접 작성합니다. `expect`와 `reason`은 메타 스키마의 상세 정의와, `engine`은 모든
런타임의 합성 및 금지 키 검사와 일치해야 합니다. 합성 사례는 참조하는 모든 파일을 `files`에 담아야 합니다.
사례를 변경한 뒤 메타 스키마 검사와 모든 런타임 사용처를 실행합니다.
