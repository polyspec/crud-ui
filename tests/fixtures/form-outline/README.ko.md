# 구조 지도와 데이터 보기 고정 데이터
<!-- doc-id: tests-fixtures-form-outline-readme -->
<!-- source-sha256: 5f7c8d54164b403f12aa6815128e3eed7a7cc4a7dffb91f04adb7b970c05aad7 -->

[English](README.md).

`cases.json`은 React, HTML 렌더러, Vue, Svelte가 공유하는 구조 지도와 데이터 보기 사례입니다. 각 사례는
`name`, `note`, `spec`, `data`, `language`를 가진 `options`, `canUndo`, `canRedo`, `expected_outline_html`,
`expected_data_html`, 그리고 `buildOutline(bindForm(compileForm(spec), data, options))`이 반환하는 행인
`expected_outline_rows`를 제공합니다.

실행 취소가 가능한 상태의 최상위·중첩 행 지도, `controls: outline`으로 지도에 둔 행 조작 버튼과 폼에 남는
빈 컬렉션 조작 버튼, 제목 없는 행, 반복 필드가 없는 폼, 감싸는 행은 조작 버튼을 유지하면서 지도에 행
조작 버튼이 없는 `multiple.only` 컬렉션의 행, 데이터 보기에서 이스케이프한 마크업 문자, 한국어·
영어·일본어·중국어 인터페이스 메시지를 검사합니다. [폼 마크업](../../../docs/spec/form-markup.ko.md)이 두
보기를 정의합니다.

## 비교

사례의 필드는 `bindForm(compileForm(spec), data, options)`입니다. 각 렌더러는 `{ fields, canUndo, canRedo }`로
구조 지도를, `data`로 데이터 보기를 그리고 [폼 HTML 정규화기](../form-render/README.ko.md#정규화)로 둘 다
정규화하며, 결과는 `expected_outline_html`, `expected_data_html`과 정확히 같아야 합니다. React는
`OutlineView`와 `DataPanel`, HTML 렌더러는 `renderOutlineView`와 `renderDataPanel`, Vue는 서버 렌더러로
`outlineVNode`와 `dataVNode`, Svelte는 `svelte/server`로 `OutlineView`와 `DataPanel`을 렌더링합니다.
Rust 테스트 `native_outline_fixture`, Go 테스트 `TestOutlineFixture`, PHP `OutlineTest`, Python
`tests/test_outline.py`와 native generator conformance의 outline 검사는 각 구현의 `buildOutline`을 자체 `bindForm`의
node에 적용한 결과와 `expected_outline_rows`를 비교합니다.

[React](../../../packages/react/src/tests/outline.conformance.test.tsx),
[Vue](../../../packages/vue/tests/outline.conformance.test.mjs),
[Svelte](../../../packages/svelte/tests/outline.conformance.test.mjs),
[HTML 렌더러](../../../legacy/packages/html/src/outline.conformance.test.ts)의 구조 지도 적합성 검사가
사용합니다. [폼 마크업 이름 검사](../../form-markup/naming.test.mts)는 두 기대 HTML의 클래스 이름을
확인합니다.

## 재생성

패키지를 빌드한 뒤 저장소 루트에서 실행합니다.

```sh
node tests/fixtures/form-outline/generate.mts
npm run test:forms
```

생성기는 React `OutlineView`와 `DataPanel`의 정규화한 정적 마크업으로 `cases.json`을 직접 씁니다. 사례에
선언한 구조 지도(`outline-only-rows-en`)는 명세에서 작성하며 작성한 그대로 둡니다. 변경을
반영하기 전에 명세와 비교하여 검토합니다. 재생성만으로 검증이 완료되지는 않습니다.
