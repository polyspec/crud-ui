# 명세 유효성 고정 데이터
<!-- doc-id: tests-fixtures-spec-validity-readme -->
<!-- source-sha256: 9136883b9935fecc579d83345c84ba96a1b9690e0b8a41eeea2ac297f518d411 -->

[English](README.md).

`cases.json`의 사례는 다른 구조 유효성 고정 데이터([폼](README.ko.md),
[목록](../list-validity/README.ko.md), [상세](../detail-validity/README.ko.md))와 같은
`{ name, note, spec, files?, expect, reason?, engine }` 형태를 사용합니다.

- `expect`는 [메타 스키마](../../../../contracts/schema/crudui.schema.json)의 폼 진입점에 대한 메타 스키마 결과인 `"ok"` 또는 `"fail"`입니다.
- `reason`은 `"fail"` 사례에만 있으며 그 사례에는 반드시 있어야 합니다. 오류 중에 나타나야 하는 Ajv
  키워드를 지정합니다.
- `engine`은 런타임 구조 검증 결과입니다. `"pass"`는 로드 실패가 없고 결과가 `{ valid: true, errors: [] }`임을
  뜻하며, `{ code, at }`은 로드 실패 코드와 합성 경로를 `.`으로 이은 값입니다.
- `files`는 모든 런타임 사용처가 엔진에 전달하는 합성 파일 묶음입니다. 메타 스키마는 `spec`만 읽습니다.

두 결과는 서로 독립적입니다. 모든 사용처는 자신이 담당하는 모든 멤버를 적용하며, 사례를 스스로 분류하거나
자체 파일을 제공하는 사용처는 없습니다. `npm run spec:schema`로 실행하는
[`check-schema.mts`](../../../../scripts/check-schema.mts)는 `expect`와 `reason`을 확인하기 전에 세 고정
데이터 모두의 형태를 검사합니다.

허용 사례는 기본 명세, 조건부 필수 입력 표현식, `true` 기본 키를 가진 조건맵, 깊은 중첩, 여러 언어의 선택지
라벨, 비어 있는 라벨과 내용, 언어별 재정의, 루트의 `buttons`와 `action`, 그리고 문자열과 객체 형태의
`multiple: only`, `items`와 `in`의 선택 목록, `options.fields`가 있는 구조 조건 편집기를 검사합니다. 데이터가 없으면 행이 없으므로 빈 데이터로 로드됩니다. 거부 사례는 금지 키
(`if`, `when`, `show_if`, `display_switch`, `display_target`, `seqtokey`, `_`, `x`로 시작하는 키)를 필드
최상위, 역할 슬롯이나 열린 설정 객체 아래, 디자인 노드, 중첩한 자식, 배열 요소 안, `$ref`로 상속한 기반
명세, 루트 버튼과 동작에 둡니다. 이 사례의 런타임 코드는 `FORBIDDEN_META_KEY`입니다. 두 거부 사례는 선택
목록 규칙을 어깁니다. `err-items-choice-list-extra-member`는 `items`를 읽지 않는 런타임 구조 검사를
통과하고, `err-in-choice-list-boolean-value`는 `INVALID_RULE_PARAMETER`로 실패합니다.

`err-after-compose-ref-base-leak`는 `spec`이 `$ref`만 가지므로 메타 스키마에서 `required`로 실패합니다.

## 비교

[폼 메타 스키마 검사](../../../legacy/packages/validator/ts/src/form-metaschema.conformance.test.ts)와
`check-schema.mts`는 메타 스키마를 컴파일해 `expect`와 `reason`을 확인합니다.

런타임 검사는 빈 데이터와 사례의 `files`로 전체 폼 로드 과정(합성, 금지 키 검사, 검증)을 실행해 `engine`과
비교하며 메시지는 비교하지 않습니다.
[TypeScript](../../../legacy/packages/validator/ts/src/forbidden-scan.conformance.test.ts),
[PHP](../../../legacy/packages/validator/php/tests/Validate/ForbiddenScanConformanceTest.php),
[Go](../../../legacy/packages/validator/go/validator/validate/forbidden_scan_conformance_test.go),
[Rust](../../../../packages/validator/rust/tests/spec_validity_conformance.rs)의 금지 키 적합성 검사,
[PHP 확장 엔진 검사](../../../legacy/packages/php-ext/tests/engine/engine.test.mjs),
[PHP 확장 실행기](../../../legacy/packages/php-ext/tests/ValidateReport.php)가 런타임 사용처입니다. Rust 구조 결과는
`valid`와 `errors`를 가진 `Ok(ValidationResult)`입니다.

## 재생성

생성기는 없으며 사례는 직접 작성합니다. `expect`와 `reason`은 폼 메타 스키마와, `engine`은 모든 런타임의
합성 및 금지 키 검사와 일치해야 합니다. 데이터가 비어 있으므로 `engine: "pass"` 사례는 빈 데이터에서
실패하는 규칙을 선언하지 않습니다. `$ref`를 사용하는 사례는 참조하는 모든 파일을 `files`에 담아야 합니다.
사례를 변경한 뒤 메타 스키마 검사와 모든 사용처를 실행합니다.
