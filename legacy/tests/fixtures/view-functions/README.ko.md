# 뷰 함수 고정 데이터
<!-- doc-id: tests-fixtures-view-functions-readme -->
<!-- source-sha256: cdbc5b080fd5ff0ec951bbaced03faa33c3521829c4fb2360bbb7d6a7703b414 -->

[English](README.md).

`cases.json`은 [폼 런타임](../../../../docs/spec/form-runtime.ko.md)의 뷰 함수 호출을 담습니다. case는 `name`, `note`,
`requirements`, `op`, `args`, 그리고 `{ result }` 또는 `{ error }`인 `expected`를 가집니다. 뷰는 접은 행 경로 목록인
`{ collapsed }`입니다. `op`는 `initialView`, `toggleRowView`, `removeRowView`, `rekeyRowView`, `collapsibleRows`,
`setAllExpandedView`(뒤의 둘은 `spec`과 `data`를 compile하고 bind해 그 노드를 씁니다) 또는 `spec`과 `data`를 옵션
`collapsed`(옵션이 없으면 `null`)로 bind해 접힌 필드의 행 경로를 반환하는 `bindCollapsed`입니다.

case는 TypeScript reference에서 생성합니다. [폼 상태](../form-state/README.ko.md)를 참고합니다.
