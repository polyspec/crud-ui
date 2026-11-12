# 상세 렌더링 고정 데이터
<!-- doc-id: tests-fixtures-detail-render-readme -->
<!-- source-sha256: 935c98c761ac5a6192643ea6ed4bd16a53b5a9971d650d708744dec57becad3a -->

[English](README.md).

`cases.json`은 binding 생성 시험의 case 형식(G-5)으로 Rust 코어의 공유 읽기 전용 상세 사례를 담습니다. group `cases`가
`build_detail`와 `render_detail`의 사례를 나열하고, 각 사례는 `id`, `name`, `note`, `requirements`, 인수 `spec`, `record`,
모든 필드(`files`, `basepath`, `language`, `data`, `page`, `total`)를 적은 레코드 `options`, 그리고 `expected_html` 또는
`kind`, `status`, `category`, 선택적인 `message`를 가진 `raises`를 제공합니다. `spec`, 레코드, 모든 파일과 `data`는
`json_value` 값이며 [검증 고정 데이터](../validate/README.ko.md)처럼 `{ "kind", "value" }`로 씁니다. React, Vue, Svelte와
legacy 렌더러의 suite는 `legacy/tests/fixtures` 아래 사본을 읽습니다.

번역한 라벨, 모든 셀 형식, 레코드에 없는 값, 상세와 필드 디자인, 숨긴 필드, 조합한 필드, 필드가 없는
선언, 이미지 preload 링크 뒤와 정의 목록 앞의 상세 동작, 입력 오류, [표시 형식 선언](../../../docs/spec/display-formats.ko.md#선언)의 선언 오류를 검사합니다.
레코드는 사례가 제공하며 렌더러는 데이터를 조회하지 않습니다.

`content-values`는 선언 규칙이 열어 둔 `format.items`의 선택 라벨을 숫자, 숫자를 가진 언어 맵, 배열로
선언하고, 모든 런타임이 이런 라벨을 빈 텍스트로 해석하는지 검사합니다
([명세 구조](../../../docs/spec/schema.ko.md)).

## 비교

프레임워크 적합성 검사는 [폼 HTML 정규화기](../form-render/README.ko.md#정규화)로 정규화한 상세 본문을
`expected_html`과 비교합니다. 문자열 렌더러(React 서버 렌더링과 HTML 렌더러)는 상세 앞에 이미지
preload 링크를 쓰며, [`preload-links.mjs`](../preload-links.mts)가 이를 제거하므로 본문 기대값은 상세
본문만 다룹니다. 오류 사례는 기록된 메시지를 확인합니다.

[네이티브 생성기 검사](../../../legacy/tests/native-generators/README.ko.md)는 모든 사례를 모든 런타임에 두 수준으로
보냅니다. `buildDetail`은 멤버 순서까지 같은 모델을, `renderDetail`은 이미지 preload 링크를 포함해
React와 같은 전체 원본 HTML을 반환해야 합니다. 필드의 `value`는 레코드의 해당 경로에 값이 없으면
`null`입니다.

[React](../../../packages/react/src/tests/detail-render.conformance.test.ts),
[Vue](../../../packages/vue/src/tests/detail-render.conformance.test.ts),
[Svelte](../../../packages/svelte/tests/detail-render.conformance.test.mjs),
[HTML 렌더러](../../../legacy/packages/html/src/detail-conformance.test.ts)의 상세 적합성 검사가
사용합니다.

## 작성

`cases.json`은 직접 고치는 데이터입니다. [`generate.mts`](generate.mts)는 React 렌더러로 legacy 사본의 형식으로 이 파일을
썼습니다. 이 생성기는 legacy 구현의 도구이며 실행하지 않습니다.
