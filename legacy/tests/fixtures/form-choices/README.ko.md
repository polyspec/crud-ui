# 폼 선택지 고정 데이터
<!-- doc-id: tests-fixtures-form-choices-readme -->
<!-- source-sha256: 4d1fbebf496d73916c799c57c90bde2bb5fc133ddc891f7463279d03e38b3a50 -->

[English](README.md).

`cases.json`은 필드가 반복 그룹에서 선택지를 가져오는 폼 인스턴스의 세션을 모든 구현을 위해 담습니다
([반복 그룹의 선택지](../../../../docs/spec/schema.ko.md#반복-그룹의-선택지)). 소스 행이 바뀔 때마다 다음 뷰가 나열하는
선택지가 바뀌고, 선택지가 바뀌어도 값은 바뀌지 않습니다. 필드의 데이터 경로를 받는 step `choices`는 그 필드 노드의 각
선택지의 `value`와 `label`을 관찰합니다. case 형식, 관찰, 재생성은 [폼 상태](../form-state/README.ko.md)에 설명합니다.
