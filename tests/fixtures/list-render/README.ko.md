# 목록 렌더링 고정 데이터
<!-- doc-id: tests-fixtures-list-render-readme -->
<!-- source-sha256: a2e1d962c3fc43500e3d2b6cce34646e6b88a4dd356501397139a19582436466 -->

[English](README.md).

`cases.json`은 binding 생성 시험의 case 형식(G-5)으로 Rust 코어의 공유 목록 레이아웃 사례를 담습니다. group `cases`가
`build_list`와 `render_list`의 사례를 나열하고, 각 사례는 `id`, `name`, `note`, `requirements`, 인수 `spec`, `rows`, 모든 필드(`files`,
`basepath`, `language`, `data`, `page`, `total`)를 적은 레코드 `options`, 그리고 `expected_html` 또는 `kind`, `status`,
`category`, 선택적인 `message`를 가진 `raises`를 제공합니다. `spec`, 각 행, 모든 파일과 `data`는 `json_value` 값이며
[검증 고정 데이터](../validate/README.ko.md)처럼 `{ "kind", "value" }`로 씁니다. React, Vue, Svelte와 legacy 렌더러의 suite는
`legacy/tests/fixtures` 아래 사본을 읽습니다.
group `row_shapes`는 `rows`가 목록이 아니어서 `rows`의 타입으로 줄 수 없는 사례를 담으며, 계약은 이 group을 가리키지 않습니다.

테이블과 카드 레이아웃, 열 형식, 동작 앞의 목록 설명, 동작, 표시 여부, 빈 행, 페이지 이동 마크업, 입력 오류,
[표시 형식 선언](../../../docs/spec/display-formats.ko.md#선언)의 선언 오류를 검사합니다. 표시할 행은 사례가 제공합니다. 렌더러는
데이터베이스를 조회하지 않습니다.

## 비교

프레임워크 레이아웃 검사는 정규화한 목록 본문을 `expected_html`과 비교합니다.
[폼 HTML 정규화기](../form-render/README.ko.md#정규화)를 사용합니다. 문자열
렌더러(React 서버 렌더링과 HTML 렌더러)는 목록 앞에 이미지 preload 링크를 쓰며,
[`preload-links.mjs`](../preload-links.mts)가 이를 제거하므로 본문 기대값은 목록 본문만 다룹니다.
이 비교로 전체 원본 HTML의 동일성을 확인할 수는 없습니다.

[네이티브 생성기 검사](../../../legacy/tests/native-generators/README.ko.md)는 같은 입력으로 모든 문자열
렌더러의 이미지 preload 링크를 포함한 전체 원본 HTML을 React와 비교합니다. 리소스 힌트를
제거하거나 속성과 CSS를 정규화하지 않습니다.

[React](../../../packages/react/src/tests/list-render.conformance.test.ts),
[Vue](../../../packages/vue/tests/list-render.conformance.test.mjs),
[Svelte](../../../packages/svelte/tests/list-render.conformance.test.mjs),
[HTML 렌더러](../../../legacy/packages/html/src/list-conformance.test.ts)의
목록 적합성 검사가 사용합니다. 합성 오류 사례는 기록된 오류 코드를 확인합니다.

## 작성

`cases.json`은 직접 고치는 데이터입니다. [`generate.mts`](generate.mts)는 React 렌더러로 legacy 사본의 형식으로 이 파일을
썼습니다. 이 생성기는 legacy 구현의 도구이며 실행하지 않습니다.
