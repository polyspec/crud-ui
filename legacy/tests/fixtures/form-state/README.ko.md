# 폼 상태 고정 데이터 (공유 module)
<!-- doc-id: tests-fixtures-form-state-readme -->
<!-- source-sha256: fe3ac874261b397f76dcf84db3f3b246a5bcd315970e5b372a300d39a9f8652a -->

[English](README.md).

이 폴더는 여섯 고정 데이터 family의 reference와 generator를 담습니다. [폼 뷰](../form-view/README.ko.md),
[폼 이력](../form-history/README.ko.md), [폼 작업](../form-actions/README.ko.md), [폼 선택지](../form-choices/README.ko.md),
[뷰 함수](../view-functions/README.ko.md), [이력 함수](../history-functions/README.ko.md)입니다. 앞의 넷은 모든 구현이
공유하는 폼 인스턴스의 세션으로 뷰 상태, 되돌리기 이력, `resolveAction`과 `runAction`의 작업, 그룹 소스의 선택지를 담습니다. case는 `name`, `note`, `requirements`([폼 런타임](../../../../docs/spec/form-runtime.ko.md)에서 test하는
id), `spec`, `data`, 목록 `steps`, 그리고 step마다 하나씩 있는 목록 `expected`를 가집니다.

step은 `{ op, args }`입니다. `op`는 폼 인스턴스의 method(`addRow`, `copyRow`, `removeRow`, `moveRow`, `rekeyRow`,
`setValue`, `setData`, `toggleRow`, `setAllExpanded`, `undo`, `redo`)이거나 같은 이름의 함수를 `args[0]`으로 호출하는
`runAction` 또는 `resolveAction`이거나, 명세와 `getData()`에 대한 검증기의 `valid`와 각 오류의 `path`, `field`, `rule`,
`message`를 반환하는 `validate`이거나, 폼 필드에서 깊이 우선으로 찾은 경로 `args[0]`의 필드 노드가 가진 각 선택지의
`value`와 `label`을 반환하는 `choices`입니다. step 뒤에 구현은 다음 객체를 보고합니다.

- `result`: step이 반환한 값이며 값이 없으면 `null`, 아무것도 반환하지 않는 method는 없습니다.
- `error`: step이 일으킨 오류의 `{ code, message }`.
- `data`, `revision`, `canUndo`, `canRedo`: 폼의 `getData()`, revision, 이력 flag. `form-view` 세션에는 `canUndo`와 `canRedo`가 없어 이력이 없는 구현도 실행할 수 있습니다.
- `collapsed`: 폼 필드에서 `collapsible`이 참이고 `expanded`가 거짓인 행의 행 경로 `{collection}.{key}`이며 필드 순서의 깊이 우선입니다.

case가 `spec`, `data`, `steps`에 쓰지 않은 행 키는 작업이 생성한 키입니다. 관찰은 그 키를 `result`, `data`, `collapsed`에
처음 나타나는 순서로 문자열과 객체 키에서 `$1`, `$2`로 부르므로 모든 구현이 자기 관찰을 `expected`와 비교할 수 있습니다.

## 비교

TypeScript test [form-state.test.ts](../../../legacy/packages/generator/ts/src/form-state.test.ts)는 package 소스에서
[harness.mts](harness.mts)의 reference를 실행하고, 다른 구현은 같은 step을 자기 폼에서 실행합니다.
뷰 함수와 이력 함수의 case는 뷰와 이력의 순수 함수를 호출합니다.

## 재생성

`cases.json`을 손으로 고치지 않습니다. 기대 관찰은 TypeScript reference의 출력입니다.

```
node legacy/tests/fixtures/form-state/generate.mts
```

이 script는 여섯 family의 `cases.json`을 씁니다.
