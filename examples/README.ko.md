# CRUDUI 예제
<!-- doc-id: examples-readme -->
<!-- source-sha256: 5b302c2d74ef344ff9025a496aae6b774787a4b7f530174c9819b387e73d4d9f -->

[English](README.md).

| 예제 | 용도 |
| --- | --- |
| [교차 검사 콘솔](cross-check-console/) | JavaScript·PHP·Go·Rust의 폼·목록·상세 검증 비교와 React·Vue·Svelte의 폼·목록·상세 렌더링 비교 |
| [폼 비교 페이지](form-comparison/) | PHP·PHP 확장·Go·Rust를 통한 중첩 키 폼 검증과 React·Vue·Svelte·HTML 렌더러 초기화 경로의 나란한 비교 |
| [폼 구조 미리보기](form-structure/) | HTML 렌더러로 렌더링한 5단계 기준 폼과 구조 개요, 데이터 패널의 로컬 Vite 미리보기 |
| [상품 폼](product-forms/) | 생성된 조합(`multiple: only`)과 `design.show`로 전환하는 영역이 있는 옵션 폼, 이를 합성한 대형 상품 폼, 이를 검증하고 렌더링하는 테스트 |
| [Go 패키지 예제](../legacy/packages/generator/go/examples/server/main.go) | 저장된 레코드 하나로 렌더링하는 폼·목록·상세 페이지 |
| [PHP 패키지 예제](../legacy/packages/generator/php/examples/index.php) | PHP 구현이나 확장에서 저장된 레코드 하나로 렌더링하는 폼·목록(`?view=list`)·상세(`?view=detail`) 페이지 |
| [Rust 패키지 예제](../packages/generator/rust/examples/form.rs) | 레코드 하나로 렌더링한 폼·목록·상세를 담은 HTML 문서 하나 |

[목록과 상세 절차](../docs/operations/displays.ko.md)는 패키지 예제의 목록·상세 출력과 실행
명령을 설명합니다. [폼 검사](../docs/operations/testing.ko.md#폼과-보고서)가 브라우저·서버 비교를
실행합니다. 검증과 배포 상태는
[기능 상태](../docs/features.ko.md)에 기록합니다.
