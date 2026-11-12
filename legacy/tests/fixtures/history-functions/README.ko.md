# 이력 함수 고정 데이터
<!-- doc-id: tests-fixtures-history-functions-readme -->
<!-- source-sha256: d3b586da4d14ffe5dd7318d3f3a40fd728478e2897cd0bbea9a2eecf93729954 -->

[English](README.md).

`cases.json`은 [폼 런타임](../../../../docs/spec/form-runtime.ko.md)의 이력 함수 호출을 담습니다. case는 `name`, `note`,
`requirements`, `op`, `args`, 그리고 `{ result }` 또는 `{ error }`인 `expected`를 가집니다. 이력은
`{ entries, redoEntries, lastPath? }`입니다. `op`는 `emptyHistory`, `recordChange`(`args`는 이력, 이전 레코드,
경로 또는 `null`), `undoChange`와 `redoChange`(이력과 현재 레코드), 또는 `canUndo`와 `canRedo`의 목록을 반환하는
`canUndoRedo`입니다.

case는 TypeScript reference에서 생성합니다. [폼 상태](../form-state/README.ko.md)를 참고합니다.
