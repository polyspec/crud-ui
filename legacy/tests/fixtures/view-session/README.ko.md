# 화면 세션 시나리오
<!-- doc-id: tests-fixtures-view-session-readme -->
<!-- source-sha256: 9da72639f970711c3638ccc9df4acc38477ac58d5dc300a0cf95cfcae71eb776 -->

[English](README.md).

이 묶음은 `cases.json` 대신 공용 모듈을 둡니다. 각 렌더러의 테스트는 마운트한 요소에 목록이나 상세를
보여 주는 `show` 함수를 `expect`, 렌더링을 기다리는 `flush` 함수와 함께 넘깁니다.

- [`rerender.mts`](rerender.mts)는 `listSpec`, `detailSpec`, `exerciseViewRerender`를 내보냅니다.
  이름과 `html` 셀이 있는 목록을 표와 카드로, 상세를 한 번씩 보여 주며, 목록에는 링크 작업과 동작
  작업이 있습니다. 각 화면을 같은 내용의 새 모델과 `html` 값이 바뀐 모델로 다시 보여 주고, 매번 같은
  요소 노드가 유지되고 바뀐 텍스트가 유지한 노드 안에 들어가는지 확인합니다.

[HTML](../../../packages/html/src/view-session.test.ts),
[React](../../../../packages/react/src/tests/View.test.tsx),
[Vue](../../../../packages/vue/tests/view-session.test.mjs),
[Svelte](../../../../packages/svelte/tests/view-session.client.mjs) 테스트가 이를 실행합니다.
HTML 테스트는 새로 렌더링한 마크업을 `patchContent`로 요소에 반영합니다.
