# 완전한 폼 고정 데이터
<!-- doc-id: tests-fixtures-form-complete-readme -->
<!-- source-sha256: 0f490bd1248c430d570a223a8937564aeef2a1d123d0435eecefad25eccdaef7 -->

[English](README.md).

`cases.json`은 [완전한 폼](../../../../docs/spec/form-runtime.ko.md#완전한-폼)의 공유 사례입니다. 폼 요소,
숨은 input, 폼 오류, 노드 오류를 쓰는 `renderForm(form, render)`를 다룹니다. 각 사례는 `name`, `note`,
`spec`, `data`, 바인딩 `options`, 렌더 옵션 `render`, 그리고 `expected_html` 또는
`expectError`(`{ code, message }`)를 가집니다.

`expected_html`은 [`tests/fixtures/form-complete/generate.mts`](../../../../tests/fixtures/form-complete/generate.mts)에서 명세로부터 작성하며 렌더링하지 않습니다. 노드와
footer 마크업은 form-render 고정 데이터가 정의한 마크업이고, 폼 요소, 숨은 input, 오류 요소는 명세가
정한 위치에 둡니다. 사례는 속성과 텍스트 이스케이프, 템플릿 action과 그 멤버, 폼 오류 앞의 루트 설명과 `null` 설명, 숨은 input 순서, 차단한
JavaScript URL, 빈 옵션, 폼 요소 없는 오류, 폼 오류 순서, 컬렉션·행·그룹·필드·숨긴 필드 오류, 검사
순서에 따른 모든 옵션 실패를 다룹니다.

테스트는 정확한 바이트를 비교합니다. React 서버 렌더링
([`form-complete.conformance.test.ts`](../../../../packages/react/src/tests/form-complete.conformance.test.ts)),
HTML renderer
([`form-complete.conformance.test.ts`](../../../packages/html/src/form-complete.conformance.test.ts)),
그리고 [네이티브 생성기 검사](../../native-generators/README.ko.md)를 통한 PHP, PHP 확장, Go, Rust
생성기입니다. Vue
([`form-complete.conformance.test.mjs`](../../../../packages/vue/tests/form-complete.conformance.test.mjs))와
Svelte
([`form-complete.conformance.test.mjs`](../../../../packages/svelte/tests/form-complete.conformance.test.mjs))는
자체 직렬화를 쓰므로 공유 정규화 뒤에 비교합니다.

이 폴더는 legacy 구현이 읽는 case의 사본이며([AGENTS.md](../../../../AGENTS.ko.md)) `cases.json`은 직접 고칩니다. legacy 구현이 차이 시험의 기준으로 남는 동안, `docs/spec`의 규칙을 바꾸는 변경은 legacy 구현과 함께 이 사례도 바꿉니다. 공유 fixture `tests/fixtures/form-complete`의 생성기는 [`tests/fixtures/form-complete/generate.mts`](../../../../tests/fixtures/form-complete/generate.mts)입니다.
