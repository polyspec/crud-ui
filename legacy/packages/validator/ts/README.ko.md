# @polyspec/crudui-validator
<!-- doc-id: packages-validator-ts-readme -->
<!-- source-sha256: c00202952cba1e9c23d80e167b21eb8ad955631d7c53c473bc5734a66236dbbb -->

[English](README.md).

JavaScript와 TypeScript에서 CRUDUI 폼 데이터를 검증하고 목록·상세 명세를
검사합니다.

## 공개 API

패키지 루트는 다음을 export합니다.

- `validate(spec, data, options?)`는 폼 명세를 조합하고 금지 키를 거부한 뒤
  `data`를 검증합니다. `{ valid, errors, hidden }`을 반환하며, `hidden`은 `design.show`가 숨기는
  필드의 데이터 경로 목록입니다. 각 오류는 `path`,
  `field`, `rule`, `message`, `value`를 포함합니다. `design.show`가 `false`로
  결정되는 필드는 숨겨지며 그 필드와 그 안의 모든 필드의 규칙을 건너뜁니다(데이터 형태는 계속 검사합니다).
  데이터가 없는 반복 필드는 빈 컬렉션입니다.
- `validateList(spec, options?)`는 목록 명세를 조합하고 금지 키를 거부합니다.
  목록에는 제출 데이터가 없으므로 정상적으로 로드되면
  `{ valid: true, errors: [] }`를 반환합니다.
- `validateDetail(spec, options?)`는 상세 명세의 `fields` 맵을 포함해 같은 구조
  검사를 수행합니다.
- `ComposeLoadError`는 해석되지 않은 `$ref`나 `$patch`, 금지 키, 정의를 벗어난
  규칙 매개변수에 사용합니다.
- `FormInputError`(코드 `INVALID_FORM_INPUT`)는 객체가 아닌 루트 데이터, 객체가
  아닌 그룹 데이터, 키 객체가 아닌 반복 데이터에 사용합니다.

옵션은 `$ref`용 가상 파일 집합 `files`, `files`보다 우선하며
`normalize(path, basepath)`와 `load(key)`를 가진 객체 `loader`, 상대 참조의 기준
경로 `basepath`를 받습니다. 옵션과 결과 타입은 함수와 함께 export됩니다.

명세의 작성용 타입은 type으로 export됩니다. 필드나 폼 루트에는 `FieldSpec`,
range 필드에는 `RangeFieldSpec`, 그리고 이것들이 가리키는 타입(`ValidateSlot`,
`DesignSlot`, `Items`, `Multiple`, `Lang`, `ConditionMap` 등)이
[docs/spec/schema.ko.md](../../../../docs/spec/schema.ko.md)가 정의하는 대로
제공됩니다.

로드 실패와 입력 실패는 예외로 던지며 `valid: false`로 반환하지 않습니다.
[검증 절차](../../../../docs/operations/validation.ko.md)는 모든 언어의 사용법을
보여 줍니다.

`@polyspec/crudui-validator/internal` 엔트리는 CRUDUI 자체 패키지용이며 공개
API가 아닙니다. 패키지는 명령을 설치하지 않습니다.

## 테스트

저장소 루트에서 실행합니다.

```sh
npm test -w @polyspec/crudui-validator                  # full suite (vitest)
npm test -w @polyspec/crudui-validator -- conformance   # conformance test files only
```
