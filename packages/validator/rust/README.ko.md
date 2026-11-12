# CRUDUI Rust 검증기
<!-- doc-id: packages-validator-rust-readme -->
<!-- source-sha256: 2a8713d3baec8bb9f94c2a4a2ac0b57707a82a43dff912f78506ae2cac645be2 -->

[English](README.md).

`polyspec-crud-ui-validator` 패키지 버전은 `0.0.7`입니다. 라이브러리이며 명령을 설치하지
않습니다.

## API

```rust
use polyspec_crud_ui_validator::{validate, validate_detail, validate_list, ValidateOptions};

let result = validate(&spec, &data, &ValidateOptions::default())?;
```

- `validate(&spec, &data, &ValidateOptions)`는 폼 명세를 구성하고 금지 키와 검증
  규칙 매개변수를 검사한 다음 `data`를 검증합니다. `valid`, `errors`, 그리고
  `design.show`가 숨기는 필드의 데이터 경로인 `hidden`을 가진 `ValidationResult`를 반환하며, 각 오류는 `path`, `field`, `rule`, `message`,
  `value`를 포함합니다.
- `validate_list(&spec, &ValidateListOptions)`는 목록 구조를,
  `validate_detail(&spec, &ValidateDetailOptions)`는 `fields` 맵을 포함한 상세
  구조를 검사합니다. 둘 다 깨끗한 구조에 `Ok(())`를 반환합니다.

옵션은 `$ref`용 가상 파일 집합 `files`, `loader`, 상대 참조용 `basepath`를
받습니다. `validate`는 합성 실패나 금지 키 실패에 `Err(ValidateError::Load)`를,
형태가 잘못된 데이터에 코드 `INVALID_FORM_INPUT`의 `Err(ValidateError::Input)`을
반환하고, 구조 검사는 `ComposeLoadError`를 `Err`로 반환합니다. 실패는 데이터 검증
결과가 아닙니다. [검증 절차](../../../docs/operations/validation.ko.md)가 모든 언어의
사용법을 보여 줍니다.

## 입력 텍스트와 공유 값

`polyspec_crud_ui_validator::text::JsonText`는 텍스트를 바꾸지 않고 JSON 문서를 읽으므로,
짝이 없는 surrogate 이스케이프가 검사에 그대로 보입니다. JSON 텍스트가 쓸 수 없는 두
변형이 있습니다. `JsonText::Shared(Arc<JsonText>)`는 한 값을 여러 부모에 둡니다.
`JsonText::Link(Weak<JsonText>)`는 자기를 담고 있는 공유 값으로 되돌아가는 링크이며,
자기 자신을 담는 값을 만듭니다. 공유 값과 링크는 자체 노드가 아닙니다. 그 값이 가리키는
각 방문이 노드 하나로 세어지므로, 노드 한도(1,000,000)와 중첩 한도(512)가 공유 컨테이너를
가진 값의 모든 순회를 제한합니다. TypeScript와 Go 런타임이 세는 방식과 같습니다. 값의 첫
실패가 그 오류를 정하며, 순회는 순서상 먼저 닿는 실패를 보고합니다. 자기 자신을 담는 값은
fixture의 value-graph 사례처럼 `Arc::new_cyclic`으로 만듭니다.

## 검사

저장소 루트에서 실행합니다.

```sh
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml --test list_validity_conformance
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml --test detail_validity_conformance
```
