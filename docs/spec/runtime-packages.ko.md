# 런타임 패키지
<!-- doc-id: docs-spec-runtime-packages -->
<!-- source-sha256: 4c10213cad07e1b7ae50168dd741572641562e77805304f7f94709e04d10caa9 -->

[English](runtime-packages.md).
구현과 검증 결과는 [기능 상태](../features.ko.md)에 기록합니다.

## 필수 기능

- **CURP-001** 모든 구현(JavaScript/TypeScript, PHP 라이브러리, PHP 네이티브 확장, Go, Rust, Python)은 조합과 표현식, 폼 컴파일과 바인딩, 폼 HTML·목록·상세 렌더링, 검증을 제공합니다.

서버 언어는 JavaScript 서버를 시작하거나 다른 언어의
실행 파일을 호출하지 않고 폼·목록·상세를 렌더링할 수 있어야 합니다.

이 항목은 완료된 구현이 아니라 요구사항을 정의합니다. PHP 확장은 컴파일된
라이브러리를 공유할 수 있지만 두 작업 모두 PHP 프로세스 안에서 실행합니다.
PHP 패키지와 확장은 같은 공개 클래스를 구현합니다. 활성화된 확장은
PHP 코드 실행 전에 해당 클래스를 등록하고, 그렇지 않으면 Composer가
PHP 구현을 자동 로드합니다. [PHP API 계약](../operations/php-extension.ko.md)은 로딩과
메서드 동일성을 정의합니다. 비교 검사는 PHP와 네이티브 PHP를 별도
프로세스에서 실행하고 실제 실행된 구현을 확인합니다. 네이티브 모듈이
없으면 네이티브 대상 검사는 실패합니다.

## API 동작

이름은 각 언어의 명명 규칙을 따릅니다. 동작과 결과는 같으며 필드 명세에
런타임 선택자를 추가하지 않습니다.

- **CURP-006** 구조 컴파일 — JavaScript: `compileForm`; PHP 라이브러리: `Generator::compileForm`; Go: `CompileForm`; Rust: `compile_form`; PHP 네이티브: `Generator::compileForm`
- **CURP-007** 데이터 바인딩 — JavaScript: `bindForm`; PHP 라이브러리: `Generator::bindForm`; Go: `BindForm`; Rust: `bind_form`; PHP 네이티브: `Generator::bindForm`
- **CURP-008** 버튼 바인딩 — JavaScript: `bindButtons`; PHP 라이브러리: `Generator::bindButtons`; Go: `BindButtons`; Rust: `bind_buttons`; PHP 네이티브: `Generator::bindButtons`
- **CURP-009** 버튼 렌더링 — JavaScript: `formButtonsHtml`; PHP 라이브러리: `Generator::formButtonsHtml`; Go: `FormButtonsHTML`; Rust: `form_buttons_html`; PHP 네이티브: `Generator::formButtonsHtml`
- **CURP-010** 인스턴스 생성 — JavaScript: `createForm`; PHP 라이브러리: `new Form`; Go: `NewForm`; Rust: `Form::new`; PHP 네이티브: `new Form`
- **CURP-011** 데이터 교체 — JavaScript: `setData`; PHP 라이브러리: `$form->setData`; Go: `SetData`; Rust: `set_data`; PHP 네이티브: `$form->setData`
- **CURP-012** 데이터 조회 — JavaScript: `getData`; PHP 라이브러리: `$form->getData`; Go: `GetData`; Rust: `get_data`; PHP 네이티브: `$form->getData`
- **CURP-013** 폼 렌더링 — JavaScript: `renderForm`; PHP 라이브러리: `Generator::renderForm`; Go: `RenderForm`; Rust: `render_form`; PHP 네이티브: `Generator::renderForm`
- **CURP-014** 목록 모델 생성 — JavaScript: `buildList`; PHP 라이브러리: `Generator::buildList`; Go: `BuildList`; Rust: `build_list`; PHP 네이티브: `Generator::buildList`
- **CURP-015** 목록 렌더링 — JavaScript: `renderList`; PHP 라이브러리: `Generator::renderList`; Go: `RenderList`; Rust: `render_list`; PHP 네이티브: `Generator::renderList`
- **CURP-016** 상세 모델 생성 — JavaScript: `buildDetail`; PHP 라이브러리: `Generator::buildDetail`; Go: `BuildDetail`; Rust: `build_detail`; PHP 네이티브: `Generator::buildDetail`
- **CURP-017** 상세 렌더링 — JavaScript: `renderDetail`; PHP 라이브러리: `Generator::renderDetail`; Go: `RenderDetail`; Rust: `render_detail`; PHP 네이티브: `Generator::renderDetail`
- **CURP-018** 검증 — JavaScript: `validate`; PHP 라이브러리: `Validator::validate`; Go: `Validate`; Rust: `validate`; PHP 네이티브: `Validator::validate`

모든 런타임은 같은 상세 모델을 만들고 같은 상세 HTML을 씁니다.
[공용 상세 고정 데이터](../../tests/fixtures/detail-render/README.ko.md)를 JavaScript, HTML 렌더러,
PHP 라이브러리, Go, Rust, PHP 확장에서 두 수준으로 비교합니다. 멤버 순서를 포함한 `buildDetail`
모델과, React 서버 렌더링과 바이트 단위로 같은 `renderDetail` HTML입니다.

두 PHP 구현 모두 `Polyspec\Crudui\Generator`, `Polyspec\Crudui\Validator`,
`Polyspec\Crudui\Form` 클래스를 사용합니다.
[PHP API 계약](../operations/php-extension.ko.md)은 공용 메서드와 로딩 순서를
정의합니다. 활성화된 확장은 이 클래스를 등록합니다. 확장이 없으면
Composer가 PHP 클래스를 자동 로드합니다. 예제는 두 설정에서 같은 호출을
사용하며 비교 검사는 별도 PHP 프로세스에서 클래스 구현과 메서드
시그니처를 확인합니다.

## 공용 계약과 책임 분리

모든 런타임은 같은 [스키마](schema.ko.md), [표현식](expressions.ko.md),
[검증 규칙](validation-rules.ko.md), [폼 런타임](form-runtime.ko.md),
[입력 텍스트](input-text.ko.md) 규칙을 구현합니다. 각 런타임의 생성과 검증은 조합과 표현식 계산을 재사용합니다.
렌더링에서 필수 입력 여부나 검증 규칙을 다시 정의하지 않습니다.

1. **CURP-019** 컴파일은 레코드 데이터 없이 참조를 해석하고 전체 폼 구조를 준비합니다.
   출력은 직렬화하고 캐싱할 수 있습니다.
2. **CURP-020** 인스턴스는 레코드 값, 기본값, 행 식별자, 행 작업을 관리합니다.
   인스턴스는 공용 템플릿을 수정하지 않습니다.
3. **CURP-021** 바인딩은 인스턴스 데이터로 필드 값, 번역, 디자인을 계산합니다.
4. **CURP-022** 렌더링은 계산된 필드로 HTML을 생성합니다. 검증은 전송된 레코드 데이터를
   받아 검증 오류나 명세 오류를 반환합니다.

브라우저 바인딩은 사용자 입력과 행 작업을 적용하며, [폼 바인딩 패키지](../../packages/form-binding/README.ko.md#브라우저-검증)에 문서화되어 있습니다.

서버 렌더링과 정적 배포를 모두 지원합니다. 폼은 서버에서
데이터와 함께 렌더링하거나 브라우저에서 캐시 구조를 로드한 뒤 데이터를
주입할 수 있습니다. 어느 구성도 스키마, 레코드 구조, 검증 규칙을
변경하지 않습니다.

## 데이터와 상호 운용

- **CURP-024** 컴파일된 템플릿은 런타임마다 같은 JSON 계약을 사용합니다. 한 런타임이
  컴파일한 템플릿을 다른 런타임에서 변경 없이 바인딩할 수 있습니다.
  템플릿 필드 순서와 키 기반 레코드 순서를 유지합니다. 순서 없는 호스트
  언어 맵으로 손실된 선언 순서나 행 순서를 추정하면 안 됩니다.
- **CURP-025** [순서 보존 JSON 절차](../operations/ordered-json.ko.md)는 전송 검증을
  정의합니다. 순서 보존 JSON 객체 항목은 순서 있는 런타임 객체로 변환하고,
  배열은 배열로 유지합니다. 누락 값, `null`, 빈 객체, 빈 배열을 구분합니다.
  런타임 변환은 식별자나 순서 필드를 추가하지 않습니다.
- **CURP-026** 각 구현은 폼 값 모델을 자기 언어의 네이티브 타입으로, 또 그 반대로 옮길 때 빈 객체와
  빈 배열의 차이, 없는 항목과 `null`의 차이, 객체 항목의 순서, 스칼라의 타입을 잃지 않습니다.
  PHP 배열처럼 언어가 배열과 객체에 타입 하나만 두면 호출자가 어느 쪽인지 밝히며,
  어떤 네이티브 타입도 정확히 담지 못하는 값은 명시적으로 실패합니다.
- **CURP-027** 반복 행 키는 부모 컬렉션 안에서 행을 식별합니다. 모든 구현은 저장된
  시퀀스, 신규 키, 순서, 지정된 범위의 행 작업에 폼 런타임 계약을 적용합니다.
  유효하지 않은 작업은 데이터와 계산된 필드를 모두 변경하지 않습니다.
- **CURP-028** 명세, 템플릿, 데이터, 옵션의 숫자는 ECMAScript Number입니다. 곧 ECMAScript `JSON.parse`가
  그 텍스트로 읽는 double입니다. 그래서 크기가 2^53을 넘는 정수는 모든 비교와 런타임이 쓰는 모든
  텍스트(정규 텍스트 CUVR-021, 조건 텍스트 CUMK-066, 컨트롤 값 CUMK-069, 목록 셀, JSON 텍스트)에서 가장
  가까운 double이며, `9007199254740993`은 `9007199254740992`와 같고 그렇게 씁니다. 모든 문자열
  렌더러의 기준인 React의 서버 렌더링이 이런 double에서 이 텍스트를 씁니다. JSON 읽기가 더 넓은 정수를
  유지하는 런타임은 비교하거나 쓰기 전에 그 정수를 가장 가까운 double로 바꿉니다.
- **CURP-029** 폼 인스턴스(`createForm`)는 데이터, 보기 상태, 되돌리기 기록을 가지며, `snapshot()`은 현재
  상태의 계산된 필드, 계산된 버튼, `revision`, `canUndo`, `canRedo`를 돌려줍니다. 리스너 등록
  (`subscribe`)은 규칙의 연산이 아닙니다. 인스턴스를 React, Vue, Svelte로 렌더링하는 브라우저 층이
  인스턴스를 호출하고, 성공한 연산마다 자기 리스너에 알리고, `snapshot()`을 다시 읽습니다. 인스턴스는
  리스너를 갖지 않고 호스트 코드를 호출하지 않습니다.
- **CURP-030** 바인딩은 명세, 템플릿, 데이터, 옵션의 모든 JSON 값을 polyspec-json `Value`로 넘기고, Rust 코어는 공개
  경계(각 crate의 `boundary`)에서 그런 값을 받고 줍니다. 들어오는 값은 그 인수로서 입력 텍스트 규칙(CUIT-021~CUIT-031,
  연산의 인수 이름)으로 검사한 뒤, 멤버를 순서대로, 각 숫자를 ECMAScript가 그 토큰으로 읽는 double로 읽습니다(CURP-028).
  나가는 값은 멤버를 순서대로, 각 숫자를 그 double의 `Number::toString`으로 씁니다. 256단계보다 깊이 중첩된 나가는 값은
  `INVALID_FORM_INPUT`와 `Recursive or excessively nested value: result`로 실패하고, 들어오는 값은 CUIT-029~CUIT-031대로
  실패합니다.

## 구현 패키지

TypeScript 구현은 generator core(`@polyspec/crudui-generator-core`,
`packages/generator/ts`), validator(`@polyspec/crudui-validator`, `packages/validator/ts`),
그리고 계산된 필드를 HTML로 쓰는 HTML renderer(`@polyspec/crudui-generator-html`,
`packages/html`)로 구성됩니다. React, Vue, Svelte adapter는 같은 model을 각자 네이티브로
그리며, 그 구현의 integration으로 시험합니다.
