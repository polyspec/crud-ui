# 테스트 사례
<!-- doc-id: docs-operations-test-fixtures -->
<!-- source-sha256: 10a4756c26cac16e68cb1656221d56bed02eaf453255fffc369a7cb27a1cdffe -->

[English](test-fixtures.md).

고정 사례는 입력과 기대 동작을 정의합니다. 형식은 검사하는 계약에 따라 다릅니다.

| 위치 | 계약 |
| --- | --- |
| `tests/fixtures/validate/cases.json` | 검증 결과와 조합 실패. |
| `tests/fixtures/compose/` | 참조와 패치 조합. |
| `tests/fixtures/expr/` | 토큰·AST·표현식 평가. |
| `tests/fixtures/form-render/` | 기대 폼 렌더링. |
| `tests/fixtures/form-session/` | 공통 폼 입력과 상호작용 시나리오. |
| `tests/fixtures/view-session/` | 공통 목록과 상세 다시 그리기 시나리오. |
| `tests/fixtures/text-validity/` | 모든 연산의 [입력 텍스트](../spec/input-text.ko.md) 실패. |

## 검증

검증 사례 파일은 배열입니다. 각 항목은 `name`, `spec`, `data`를 포함하며 선택적인
`files`는 조합 입력을 제공합니다. `note`는 사례를 설명합니다. `expected`는 전체
`{ valid, errors, hidden }` 결과를 포함합니다. 로드 또는 입력 실패 사례는 대신
`expectFailure: { code, message, at }`를 사용하며 각 사례는 둘 중 하나만
선언합니다. 로드 실패의 `at`은 조합 경로를 `.`으로 연결한 값이고 입력 실패의
`at`은 빈 문자열입니다.

```json
{
  "name": "supplied-name",
  "spec": {
    "type": "group",
    "properties": { "name": { "type": "text", "validate": { "required": true } } }
  },
  "data": { "name": "Example" },
  "expected": { "valid": true, "errors": [] }
}
```

[TypeScript 적합성 검사](../../legacy/packages/validator/ts/src/validate.conformance.test.ts)는
전체 결과 또는 실패 기록을 엄격하게 비교합니다. 기대값을 정확히 하나 선언하지 않은
항목은 거부합니다. PHP·C PHP 확장·Go·Rust의 패키지 검사와 CLI 검사도 같은 검증
사례 파일을 사용합니다. `tests/fixtures/validate/generate.mts`가 TypeScript 엔진으로
사례 파일을 생성하므로 `cases.json`을 직접 수정하지 않고 다시 생성합니다.

## 사례 추가와 검토

검사하는 계약에 해당하는 위치에 사례를 추가합니다. 동작을 설명하는 식별자와
해당 동작을 재현하는 입력을 사용합니다. 기대 결과는 명세에서 결정하며 실패한
구현에 맞추기 위해 변경하지 않습니다. 계약이 바뀌면 기대 결과와 구현을 함께 검토합니다.

생성된 기대 결과도 직접 작성한 기대 결과와 동일하게 검토합니다. 생성만으로
정확성이 증명되지는 않습니다. 생성된 사례를 관련 구현에서 실행하고 현재 결과를
[기능 상태](../features.ko.md)에 기록합니다. 검사 수와 배포 결과는 사례 형식
계약에 포함하지 않습니다.

후보 아카이브에서 실행하는 검사는 운영체제 임시 디렉터리 아래에 쓰기 가능한 검사
데이터를 생성합니다. 검사는 해당 디렉터리를 정규 절대 경로 하나로 해석하고 일반 경로
구성 요소만 사용합니다. 후보 검사는 Git 메타데이터를 요구하지 않으며 추출한 소스
디렉터리 아래에 임시 검사 데이터를 쓰지 않습니다. 각 검사는 고유 디렉터리를 생성하고
검사 완료 후 제거합니다.

[폼 검사](testing.ko.md#폼과-보고서)는 렌더링·DOM·스타일·입력 상태·정본 흐름
검사를 별도로 실행합니다.
