# 런타임 패키지 구성과 검증
<!-- doc-id: docs-operations-runtime-packages -->
<!-- source-sha256: e6d2498f9298ff19b43372e70f88d5139d72055ea2f894d47eabd5863a384b66 -->

[English](runtime-packages.md).
구현과 검증 결과는 [기능 상태](../features.ko.md)에 기록합니다. 모든 패키지가 따르는 규칙은 [런타임 패키지](../spec/runtime-packages.ko.md) 계약에 있습니다.

## 패키지 구성

| 패키지 | 구현 책임 | 재사용 |
| --- | --- | --- |
| `legacy/packages/generator/ts` | JavaScript 템플릿, 인스턴스, 계산된 모델 | JavaScript 조합과 표현식 모듈 |
| `packages/react`, `generator-vue`, `generator-svelte` | 프레임워크 통합, 브라우저 동작, 렌더링 | 공용 JavaScript 생성기 |
| `legacy/packages/html` | 프레임워크에 독립적인 JavaScript 폼·목록·상세 HTML 렌더링 | 공용 JavaScript 생성기 |
| `packages/form-binding` | 서버가 렌더링한 폼의 [브라우저 검증](../spec/form-runtime.ko.md#브라우저-검증) | JavaScript 검증기 |
| `legacy/packages/generator/php` | PHP 템플릿 컴파일, 데이터 바인딩, 폼·목록·상세 HTML | PHP 조합과 표현식 모듈 |
| `legacy/packages/generator/go` | Go 템플릿 컴파일, 데이터 바인딩, 폼·목록·상세 HTML | Go 조합과 표현식 모듈 |
| `packages/generator/rust` | Rust 템플릿 컴파일, 데이터 바인딩, 폼·목록·상세 HTML | Rust 조합과 표현식 모듈 |
| `legacy/packages/php-ext` | PHP 네이티브 생성과 검증 | PHP 패키지와 같은 공개 클래스이며 생성과 검증을 네이티브 코드에서 실행 |
| `packages/validator/*` | 데이터와 명세 검증 | 기존 언어별 검증 규칙 구현과 공용 사례 |

각 서버 생성기는 해당 언어의 HTTP 프로세스에서 실행할 수 있는
라이브러리입니다. CLI 어댑터는 검사와 예제의 진입점이며 라이브러리 구현이
아닙니다. Go 렌더링은 실행 시 Rust, PHP, Node에 의존하지 않습니다.
PHP 렌더링은 네이티브 확장을 필수로 요구하지 않습니다. Rust 렌더링은
PHP 호스트를 요구하지 않습니다.

`@polyspec/crudui-generator-react`는 `react-dom/server`를 불러오지 않고 컴포넌트를
내보냅니다. `@polyspec/crudui-generator-react/server`는 서버 전용 문자열 렌더링 함수
`renderForm`, `renderList`, `renderDetail`을 내보냅니다. 컴포넌트 진입점은
이 서버 함수를 내보내지 않습니다.

## 검증

런타임마다 생성과 검증을 별도로 검사합니다. 검증 성공은 생성이나 SSR
지원을 증명하지 않습니다. 비교 결과에는 각 요청을 실제로 컴파일, 바인딩,
렌더링, 검증한 구현을 기록합니다.

런타임 간 검사는 컴파일된 전체 템플릿, 바인딩한 필드 모델, 레코드 데이터,
검증 결과를 비교합니다. HTML 검사는 필드 이름, 식별자, 속성, 텍스트,
클래스, CSS, 표시 상태, 입력 상태를 비교합니다. 차이는 보존하고 보고합니다.
비교에서 식별자, 값, 숨겨진 필드를 제거하여 동일성을 증명하면 안 됩니다.

템플릿, 레코드, 언어, 지정된 행 키가 같으면 초기 데이터와 이후 주입은
동일한 HTML과 전송 데이터를 생성해야 합니다. 반복 주입과 레코드 복원에도
동일성을 유지해야 합니다. 브라우저 검사는 React, Vue, Svelte, HTML 렌더러에서 편집,
라벨, 복수 선택, 행 작업, 포커스, 선택 영역, 스크롤을 포함해 이 경로들을
검증합니다. SSR 통합은 별도 검사가 필요합니다. JavaScript가 아닌 검증
서버와 클라이언트 렌더링을 함께 실행해도 SSR을 검증한 것은 아닙니다.

HTTP 예제는 PHP, PHP 네이티브, Go, Rust 각각을 네 브라우저 렌더러와
검사합니다. 서버 네 종류와 React, Vue, Svelte, HTML 렌더러의 조합입니다. 각 대상은
폼 및 순서 보존 JSON 전송, 검증, 저장, 재로드를 검사합니다. JavaScript
코어의 생성과 검증도 공용 적합성 검사에 포함합니다. 런타임 누락, 프로세스
실패, 잘못된 응답, 기대 결과 누락은 비교 실패로 처리합니다.
