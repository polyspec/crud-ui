# CRUDUI Rust 생성기
<!-- doc-id: packages-generator-rust-readme -->
<!-- source-sha256: 021920c7fc766e7b6eae1a973b1182cca3e4300602e511afe48922b6a2841356 -->

[English](README.md).

`polyspec-crud-ui-generator`는 Rust 프로세스에서 폼 구조를 컴파일하고, 순서를 유지하는
레코드 데이터를 바인딩하고, 폼 인스턴스를 관리하고, 폼·목록·읽기 전용 상세 HTML을 렌더링합니다.
스펙 조합과 표현식에는 `polyspec-crud-ui-validator`를 사용합니다.

## 사용

패키지 버전은 `0.0.7`입니다. 저장소 개발 중에는 각 패키지 디렉터리의 명시적 경로로
생성기와 검증기를 추가합니다. 생성기의 Cargo 매니페스트는 검증기 의존성을 선언합니다.

```rust
use polyspec_crud_ui_generator::{compile_form, render_form, BindOptions, CompileOptions, Form};
use serde_json::json;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let spec = json!({"type": "group", "properties": {
        "name": {"type": "text", "label": "Name"}
    }});
    let template = compile_form(&spec, &CompileOptions::default())?;
    let cached = serde_json::to_vec(&template)?;
    let mut form = Form::new(serde_json::from_slice(&cached)?, &json!({}), BindOptions::default())?;
    form.set_data(&json!({"name": "Ada"}))?;
    let html = render_form(&form, None)?;
    println!("{html}");
    Ok(())
}
```

`compile_form`은 파싱된 조합 문서 `files`, 명시적 `loader`, `basepath`,
`key_prefix`를 받습니다. `bind_form`은 로더 호출이나 레코드 변경 없이 캐시된
템플릿을 평가합니다. `BindOptions`에는 `language`(`ko`, `en`, `ja`, `zh`),
`id_prefix`, `key_prefix`, `unsupported`(`throw` 또는 `marker`)가 JSON 값으로
있습니다. null은 기본값을 쓰고, 그 밖의 문자열이 아닌 값은 거부됩니다. 호스트가 HTML `form` 요소를
제공하고 요청을 처리합니다. 렌더링은 브라우저 스크립트를 실행하지 않습니다.

`Form`은 `set_data`, `get_data`, `set_value`, `get_value`, `add_row`, `copy_row`,
`remove_row`, `move_row`, `rekey_row`를 제공합니다. `fields`는 평가된 모델을
반환하고 `revision`은 성공한 갱신 횟수를 반환합니다. 실패한 연산은 데이터, 모델,
갱신 횟수를 변경하지 않습니다. 입력과 행 키가 같으면 초기 데이터, 나중 주입,
레코드 복원의 HTML이 같습니다.
폼을 복제하면 데이터와 모델이 독립적인 인스턴스를 생성합니다. `FormError`는
고정된 `code`, `message`, `at`와 원래 조합 `trace`를 제공합니다. 일반 인스턴스
오류의 trace는 빈 배열입니다.

레코드 객체에는 `preserve_order`를 활성화한 `serde_json`을 사용합니다. 반복
레코드는 숫자 전용 키가 아닌 행 키를 사용하는 객체입니다. `sequence_row_key`는
1~13자리 십진 문자열을 받고 `create_row_key`는 운영체제 난수 생성기를 사용합니다.
컬렉션이 누락되면 행 하나를 생성하고 명시적 빈 객체는 빈 상태를 유지합니다.
배열과 null을 컬렉션으로 변환하지 않습니다. 추가할 행의 값이 누락된 경우와 명시적
null인 경우를 구분합니다.

`build_list`는 목록 모델을 반환합니다. `render_list`는 표시할 행과 `ListOptions`를
받으며 `layout`은 `table` 또는 `card`입니다. 목록 조합, 번역, 표시 조건, 셀 형식,
정렬 선언, 액션, 페이지 정보는 공통 목록 계약을 사용합니다. 생성기는 데이터베이스
레코드를 조회하거나 정렬하지 않습니다.

`build_detail`과 `render_detail`은 전달한 레코드 하나를 읽고 목록 표시 엔진을 재사용하며,
어느 연산도 다른 데이터를 조회하지 않습니다.

날짜 컨트롤, 날짜·시간 컨트롤, 목록 날짜 셀은 같은 UTC 파서를 사용합니다. 명시적
오프셋은 UTC로 변환하고 오프셋이 없는 값은 UTC로 해석합니다. 날짜·시간 컨트롤은
초를 표시합니다. 지원하지 않거나 유효하지 않은 날짜 문자열과 인스턴스 데이터는
입력값을 유지합니다. 허용 형식은 [폼 런타임](../../../docs/spec/form-runtime.ko.md)에
정의되어 있습니다.

## 예제와 검사

저장소 루트에서 다음 명령을 실행합니다.

```sh
cargo run --locked --manifest-path packages/generator/rust/Cargo.toml --example form
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml
cargo clippy --locked --all-targets --manifest-path packages/generator/rust/Cargo.toml -- -D warnings
node packages/generator/rust/verify-fixtures.mjs
make docs-check
```

[예제](examples/form.rs)는 레코드 세트 하나로 폼, 목록, 상세를 렌더링합니다. 중첩
폼을 컴파일하고 직렬화한 후 회사와 매장 키가 있는 데이터를 주입하고, 초기 HTML과
주입 HTML을 비교하고, 레코드를 검증합니다. 이어서 같은 레코드의 회사 행을 표시
행(행 키, 이름, 매장 수)으로 바꾸어 `render_list`로 렌더링하고(이름은 해당 회사
상세로 가는 `link`, 행 키는 `text`, 매장 수는 `badge`), 회사마다 `render_detail`로
상세를 렌더링합니다(`text`와 접미사가 있는 `number`). 목록 링크, 배지, 상세 마크업을
검증하고 폼, 목록, 상세 구역이 있는 HTML 문서 하나를 출력합니다. 생성과 검증은
Rust에서 실행합니다. 브라우저 이벤트 연동과 HTTP 저장은 별도 검사 대상입니다.

픽스처 검사기는 저장소의 JavaScript 개발 의존성 설치와 Cargo가 필요합니다.
Cargo가 `PATH`에 없으면 `CARGO`에 실행 파일의 명시적 경로를 설정합니다. 모든 공통
폼·목록 픽스처에서 JavaScript 템플릿, 모델, React SSR 원본 HTML 전체를 비교합니다.
템플릿 멤버 순서와 컨트롤 속성 순서도 비교합니다. 폼 픽스처의 정규화 레이아웃 검사는
유지하며 네이티브 목록 검사는 이미지 리소스 링크를 포함한 전체 HTML을 사용합니다.
폼 인스턴스 검사는 초기 데이터, 반복 주입, 복원을 비교합니다. `generate` 바이너리는
공통 JSON 비교 프로토콜을 제공하고 요청, 컴파일,
바인딩 실패 시 0이 아닌 종료 코드를 반환합니다.

공통 요구사항과 검증·게시 상태는 [폼 런타임](../../../docs/spec/form-runtime.ko.md),
[런타임 패키지 계약](../../../docs/spec/runtime-packages.ko.md),
[기능 상태](../../../docs/features.ko.md)를 확인합니다.
