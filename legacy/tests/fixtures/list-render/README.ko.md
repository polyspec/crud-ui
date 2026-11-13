# 목록 렌더링 고정 데이터
<!-- doc-id: tests-fixtures-list-render-readme -->
<!-- source-sha256: 202f6b8262417da1196ba997a67cf1b17383323674b22ed27764c52082284086 -->

[English](README.md).

`cases.json`은 React, Vue, Svelte, HTML 렌더러의 공용 목록 레이아웃 사례입니다. 각 사례는
`name`, `spec`, `rows`, 선택적인 `options`, 그리고 `expected_html` 또는
`expectError`를 제공합니다.

테이블과 카드 레이아웃, 열 형식, 동작 앞의 목록 설명, 동작, 표시 여부, 빈 행, 페이지 이동 마크업, 입력 오류,
[표시 형식 선언](../../../../docs/spec/display-formats.ko.md#선언)의 선언 오류를 검사합니다. 표시할 행은 사례가 제공합니다. 렌더러는
데이터베이스를 조회하지 않습니다.

## 비교

프레임워크 레이아웃 검사는 정규화한 목록 본문을 `expected_html`과 비교합니다.
[폼 HTML 정규화기](../form-render/README.ko.md#정규화)를 사용합니다. 문자열
렌더러(React 서버 렌더링과 HTML 렌더러)는 목록 앞에 이미지 preload 링크를 쓰며,
[`preload-links.mjs`](../preload-links.mts)가 이를 제거하므로 본문 기대값은 목록 본문만 다룹니다.
이 비교로 전체 원본 HTML의 동일성을 확인할 수는 없습니다.

[네이티브 생성기 검사](../../native-generators/README.ko.md)는 같은 입력으로 모든 문자열
렌더러의 이미지 preload 링크를 포함한 전체 원본 HTML을 React와 비교합니다. 리소스 힌트를
제거하거나 속성과 CSS를 정규화하지 않습니다.

[React](../../../../packages/react/src/tests/list-render.conformance.test.ts),
[Vue](../../../../packages/vue/tests/list-render.conformance.test.mjs),
[Svelte](../../../../packages/svelte/tests/list-render.conformance.test.mjs),
[HTML 렌더러](../../../packages/html/src/list-conformance.test.ts)의
목록 적합성 검사가 사용합니다. 합성 오류 사례는 기록된 오류 코드를 확인합니다.

## 재생성

이 폴더는 legacy 구현이 읽는 case의 고정 사본이며([AGENTS.md](../../../../AGENTS.ko.md)) `cases.json`을 다시 쓰지 않습니다. 공유 fixture `tests/fixtures/list-render`의 생성기는 [`tests/fixtures/list-render/generate.mts`](../../../../tests/fixtures/list-render/generate.mts)입니다.
