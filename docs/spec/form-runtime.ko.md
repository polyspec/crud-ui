# 폼 구조와 데이터 바인딩
<!-- doc-id: docs-spec-form-runtime -->
<!-- source-sha256: 8a4aa83d30a2920753aae625b5d5c2d94cbf50b457bfc60a65d47956af93e6c3 -->

이 문서는 폼 런타임 계약을 정의합니다. [English](form-runtime.md).
구현과 검증 상태는 [기능 상태](../features.ko.md)에 기록합니다.

## 구조

`compileForm(spec, options)`는 합성을 처리하고 레코드 데이터 없이 불변 폼
템플릿을 생성합니다. 템플릿은 필드 정의와 중첩 그룹별 하위 정의를 한 번씩
포함합니다. 반복 그룹에 예제 행을 제공할 필요가 없습니다.
템플릿은 JSON으로 직렬화하고 여러 폼 인스턴스에서 재사용할 수 있습니다.

`bindForm(template, data, options)`는 값, 언어와 표시 조건을 평가합니다.
템플릿과 데이터를 변경하지 않고 [폼 마크업](form-markup.ko.md)에서 정의한 노드 뷰
모델을 반환합니다. 합성 파일을 다시
로드하지 않습니다. 평가한 값과 표시 조건은 인스턴스 상태이므로 공용 템플릿
캐시에 저장하면 안 됩니다.

- **CURT-092** `bindForm`, `bindButtons`, `createForm`은 `compileForm`이 만드는 형태와 정확히 같은
  템플릿만 받습니다. 그 밖의 값은 `INVALID_FORM_INPUT`, 메시지
  `Unsupported form template`, 빈 위치로 실패합니다. 템플릿은 `kind`
  (`crudui/form-template`), `fields`(필드 템플릿 목록), `buttons`(객체 목록), 선택
  항목인 `keyPrefix`(문자열), `action`(객체), `description`(모든 값)만 멤버로 갖는 객체이며,
  `version` 멤버는 없습니다. `compileForm`은 멤버를 `kind`, `keyPrefix`, `fields`, `buttons`,
  `action`, `description` 순서로 쓰며, 루트가 `description`을 선언하면 그 값을 `description`으로
  씁니다. 각 필드 템플릿은 문자열 `name`, 객체 `spec`, 필드 템플릿 목록
  `children`만 정확히 갖습니다. `spec`과 버튼의 내용은 다시 검사하지 않습니다.
  JavaScript에서 값이 `undefined`인 멤버는 없는 멤버이고, PHP에서 연관 배열은
  객체, 빈 배열과 리스트 배열은 목록입니다. 노드 모델은 [폼 마크업](form-markup.ko.md)이
정한 멤버 순서를 지키며, 모든 런타임에서 위젯 모델의 멤버는 `kind`, `layout`,
`tag`, `attrs`, `text`, `rawHtml`, `source`, `options`, `itemLabelClass`,
`script`, `styleChrome`, `prepend`, `append`, `extra`, `condition` 순서이고
`extra`에서는 `display`가 `file`보다, `input`이 `option`보다 앞섭니다.

`createForm(template, data, options)`는 편집 인스턴스를 생성합니다.
`Form`은 React, Vue, Svelte에서 인스턴스를 렌더링합니다. `renderForm(instance, options)`는
같은 인스턴스를 서버에서 [완전한 폼](#완전한-폼)으로 렌더링하며 `Form` 컴포넌트도 같은 `options`를
받습니다. `options.action`이 없으면 호스트가 HTML `form` 요소를 관리하며, 제출 처리는
페이지가 맡습니다. 인스턴스는 두 렌더링 경로를 실행하기 전에 기본값과 행 키를
준비합니다. 필드 목록만 렌더링하는 기능은 내부 동작입니다.
`setData(data)`는 마운트 후 레코드를 교체하며, 사용자가 편집한 입력값도
교체합니다. 템플릿은 변경하지 않습니다. `getData()`는 제출 데이터의 복사본을
반환합니다.
- **CURT-093** `getValue(path)`는 데이터 경로 `path`에 있는 값의 복사본을 돌려주고, 데이터가 그 경로에 값을
  갖지 않으면 부재를 돌려줍니다. 경로의 한 마디가 지금까지 도달한 객체의 어떤 멤버도 가리키지 않거나,
  지금까지 도달한 목록의 어떤 항목도 가리키지 않거나(항목은 부호와 앞자리 0 없이 십진수로 쓴 인덱스로
  가리킵니다), 객체도 목록도 아닌 값 뒤에 오면 데이터는 그 경로에 값을 갖지 않습니다. 값이 `null`인
  멤버는 부재가 아니라 `null`입니다(CURP-025). JavaScript는 부재로 `undefined`를 돌려주고, 그런 값이 없는
  런타임은 자기 부재 값(Rust `None`)을 돌려줍니다.
React `Form`은 호스트가 제출 컨트롤을 소유할 때 `renderButtons={false}`를
받을 수 있으며, 선언된 form 버튼 footer 없이 CRUDUI 필드를 렌더링합니다.

템플릿과 브라우저 HTML, CSS, JavaScript는 정적 파일로 제공할 수 있습니다.
브라우저는 레코드 데이터를 요청하기 전에 폼을 마운트할 수 있으며 SSR은 필요하지
않습니다. 같은 템플릿·레코드·언어를 사용하면 생성 시 데이터를 전달한 폼과 마운트 후
데이터를 주입한 폼의 HTML, 클래스, 계산된 스타일, 표시 여부, 컨트롤 상태와 제출
필드가 같아야 합니다. 같은 데이터를 반복 주입해도 이 결과를 유지해야 합니다.
같은 행 키 입력과 사용자 조작은 같은 상태와 제출 결과를 생성해야 합니다.
인라인 스타일을 제거하여 선언이 남지 않으면 `style` 속성도 제거해야 합니다.
데이터 주입 후 이전 레코드의 속성이 남으면 안 됩니다. 다른 레코드로 교체한 후
복원하면 요소, 속성, 컨트롤 값과 표시 여부가 같아야 합니다.
속성 순서는 이 계약에 포함되지 않습니다. 프레임워크와 브라우저 엔진은 속성을 서로 다른
순서로 만들므로 바인딩은 속성을 재배치하지 않고, 이 비교는 파싱한 DOM을 사용합니다.

문자열 렌더러는 React 서버 렌더링(`@polyspec/crudui-generator-react/server`의 `renderForm`, `renderList`),
HTML 렌더러(`@polyspec/crudui-generator-html`), PHP, PHP 확장, Go, Rust 생성기입니다. 같은 인스턴스나
목록에서 이들은 같은 바이트를 만듭니다. React 서버 렌더링이 기준이므로 그 직렬화가 형식입니다.
`readOnly`, `autoComplete` 같은 속성 이름, `/>`로 닫는 빈 요소, 다른 속성 뒤에 오는 input의
`name`, `checked`, `value`, 반복된 속성은 처음 위치에 마지막 값을 두고 `property:value`를 `;`로
이은 `style` 속성, 목록의 이미지 사전 로드 링크가 여기에 포함됩니다. 네이티브 생성 검사는 모든
문자열 렌더러를 기준과 바이트 단위로 비교합니다.

`@polyspec/crudui-generator-html` 패키지는 React, Vue, Svelte 없이 같은 평가 인스턴스와
목록 모델을 HTML 문자열로 렌더링합니다. `renderForm(form, options)`은
[완전한 폼](#완전한-폼)을 반환합니다. 이를 페이지에 삽입한 뒤 그 `crudui-form`
요소에 `connectForm`을 호출할 수 있습니다. `renderFormView(fields, buttons, messages, options,
description)`는 React, Vue, Svelte의 `FormFields`처럼, 직접 관리하는 데이터를 위해
`bindForm`, `bindButtons`와 `options.language`로 번역한 루트 설명을 반환하는
`formDescription(template, options)`로 같은 내용을 렌더링합니다.

- **CUMK-073** `renderFormView(fields, buttons, messages, options, description)`는 같은 노드·버튼·설명을 가지고 템플릿
  action이 없는 인스턴스에 `renderForm`이 쓰는 마크업을 씁니다. Rust 코어는 `render_form_view(template, data,
  render, options)`로 씁니다. 원시 노드가 아니라 컴파일한 템플릿을 받고, `bind_form`과 `bind_buttons`처럼 바인딩 옵션
  `options`로 `data`의 노드와 버튼을 바인딩하며, 바인딩한 언어의 루트 설명과 인터페이스 텍스트를 씁니다. `render`는
  렌더 옵션입니다. 따라서 노드 형태는 컴파일에서 한 번만 검사하고, 바인딩은 `bind_form`과 같이 실패합니다.

`renderList(spec, rows, options)`는 선언된
table 또는 card layout을 반환합니다. 이 패키지는 DOM 연결, 검증, 데이터 로드,
위젯 실행을 수행하지 않습니다.

### 템플릿 디코딩

JSON 경계를 넘는 템플릿, 예를 들어 서버가 `JSON.stringify`로 페이지에 쓰고 클라이언트가 `JSON.parse`로 다시 읽는
템플릿은 사용하기 전에 `@polyspec/crudui-generator-core`의 `decodeFormTemplate(value)`로 디코딩합니다. 디코더는 파싱한
값을 위 형태의 JSON Schema인 [`contracts/schema/form-template.schema.json`](../../contracts/schema/form-template.schema.json)에
대해 그 스키마의 ajv standalone 검증 코드로 검사합니다. 이 코드는
`scripts/generate-form-template-validator.mts`가 패키지를 빌드할 때마다 먼저 쓰므로, 패키지는 실행 중에 ajv를
읽지 않고 코드를 컴파일하지 않습니다. 디코더는 그 값을 바꾸지 않고 `FormTemplate`으로 돌려줍니다. 다른 형태의 값은 `FormTemplateError`로
실패합니다. 이 오류는 코드가 `INVALID_FORM_INPUT`인 `FormInputError`이며, `pointer`는 첫 번째로 잘못된 멤버의 JSON
Pointer(RFC 6901)입니다. 없거나 알 수 없는 멤버는 그 멤버 자신을, 값 자체는 빈 문자열을 가리킵니다. 메시지는
`Invalid form template at <pointer>: <rule>`이며, 빈 pointer 자리에는 `the root`를 씁니다.

## 행 식별자

반복 데이터는 행 식별자를 키로 사용하는 객체입니다. 키는 해당 부모 컬렉션
안에서 행을 식별합니다. 행 키는 배열 위치가 아닙니다.

```text
form[companies][__0000000000001__][stores][__0000000000042__][name]
```

`sequenceRowKey(seq)`는 `__` + 십진수 seq를 13자리까지 0으로 채운 값 + `__`를
생성합니다. 최대 13자리의 십진수 문자열과 음수가 아닌 정수를 받습니다.
`createRowKey()`는 같은 구분자로 감싼 13자리 임의의 16진수 키를 생성합니다.

- **CURT-095** 시스템 난수 원천의 실패는 입력 실패가 아닙니다. `createRowKey`, 그리고 이것으로 키를 만드는 `addRow`, `copyRow`, 행을 추가하거나
  복사하는 동작은 `RANDOM_UNAVAILABLE`(kind `random_unavailable`, category io)과 메시지 `Unable to generate a row key: {cause}`로
  실패하며 아무것도 바꾸지 않습니다.

런타임은 키의 내용으로 저장 여부를 판단하지 않습니다. 서버가 저장 후 키의
대응 관계를 제공합니다.

인스턴스는 메모리에서 숫자가 아닌 객체 키의 삽입 순서를 유지합니다. 네이티브 폼 제출은
컨트롤 순서를 따릅니다. 키 기반 JSON은 문서 멤버 순서를 행 순서로 사용하며 파싱,
편집, 영속 저장, 직렬화에서 그 순서를 유지합니다. 폼 데이터에는 별도 순서 필드나
식별자 필드가 없습니다. 편집 인스턴스는 숫자만으로 구성된 객체 키와
경로 구분자가 포함된 키를 거부합니다. 호출자는 DB seq로 데이터를 구성할 때
`sequenceRowKey`를 사용합니다. 필드 경로에는 행 키만 들어가며 배열 위치를
나타내는 경로 세그먼트는 없습니다.

폼 바인딩과 편집 인스턴스는 형태가 잘못된 데이터를 거부합니다. 배열을 변환하거나
숨긴 식별자 필드를 추론하지 않습니다. 모든 거부는 코드 `INVALID_FORM_INPUT`와 빈
위치를 사용합니다. `{path}`는 행 키를 포함한 전체 데이터 경로입니다.

- **CURT-001** 객체가 아닌 루트 데이터: `Form data must be an object`
- **CURT-002** 값이 있지만 객체가 아닌 그룹 값 또는 그룹 행: `Group data must be an object: {path}`
- **CURT-003** 값이 있지만 키 기반 객체가 아닌 반복 값: `Repeated data must be a keyed object: {path}`

PHP에서 폼 데이터는 `stdClass`, 연관 배열 또는 빈 배열(빈 객체)일 때 객체입니다. 비어 있지 않은 목록 배열과 그 밖의 타입의 값은 객체가 아니며([CURP-026](runtime-packages.ko.md)) CURT-001 메시지로 실패합니다.

그룹 또는 반복 데이터가 없는 것은 실패가 아닙니다. 검사는 템플릿 필드 순서를 깊이
우선으로 따르며, 컬렉션을 행보다 먼저 검사하고 행은 데이터 순서를 따릅니다.
`addRow`는 제공한 그룹 행 값을 `{collection}.{key}` 경로에서 검사합니다.

## 행 작업

모든 작업은 폼 데이터 루트 기준의 컬렉션 경로를 받습니다.

- **CURT-004** `addRow(path, { afterKey?, value?, key? })`: 새 키 또는 지정한 키로 행 하나를 추가합니다.
- **CURT-005** `copyRow(path, key, { newKey?, afterKey? })`: 현재 값을 복사하고 복사한 행과 모든 중첩 반복 행의 키를 새로 생성합니다. 복사본은 `newKey`가 있으면 그 키를 갖고, 행 `afterKey` 뒤에, 없으면 복사한 행 뒤에 들어갑니다. 바인딩이 옵션을 인수 `key` 옆의 이름 있는 인수로 펼치므로 옵션 이름은 `key`가 아니라 `newKey`입니다.
- **CURT-006** `removeRow(path, key)`: 지정한 행만 제거합니다.
- **CURT-007** `moveRow(path, key, index)`: 행 키와 값을 유지하며 순서를 변경합니다.
- **CURT-008** `rekeyRow(path, oldKey, newKey)`: 저장 후 행 키 하나를 변경하고 하위 필드 경로를 다시 생성합니다.

복사는 일반 필드 값을 유지합니다. DB 식별자는 행 키로 표현합니다. 런타임은
`id`나 `*_seq`라는 필드명으로 식별자를 추론하지 않습니다. 서로 다른 회사 아래에
같은 키가 있어도 작업 범위는 변경되지 않습니다. 키 충돌, 없는 행, 잘못된 위치는
현재 데이터와 화면을 변경하지 않고 실패합니다. `multiple.min`과 `multiple.max`는
행 개수를 제한합니다.

반복 데이터가 없으면 편집 가능한 행 하나를 생성합니다. 명시적인 `{}`는 행이
0개라는 뜻입니다. `multiple: only`로 선언한 컬렉션은 데이터에 있는 행만 데이터 순서와 데이터 키로
가지며, 데이터가 없으면 행이 0개입니다. 이 컬렉션에 대한 `addRow`, `copyRow`, `removeRow`, `moveRow`,
`rekeyRow`는 데이터와 화면을 바꾸지 않고 `INVALID_FORM_INPUT`과 메시지
`Rows of {path} come only from data`로 실패합니다. `design.show`가 숨긴 필드는 인스턴스와
`getData()`에 값을 유지하며, 데이터가 필드를 다시 보이게 하면 그 값을 표시합니다. 마지막 행을 제거해도 컬렉션의 `add-row` 컨트롤은 유지합니다. 행을 추가할 때
삭제한 데이터를 복원하지 않습니다. 기본값은 입력 데이터가 없을 때만 적용합니다.
출력 규칙은 [빈 컬렉션](empty-collections.ko.md)에 정의합니다.

## 뷰 상태와 이력

편집 인스턴스는 레코드와 별도로 뷰 상태와 되돌리기 이력을 가집니다. 뷰 상태는
제출하거나 데이터와 함께 직렬화하지 않습니다.

- **CURT-009** `toggleRow(path, key)`: 행 하나를 펼치거나 접습니다.
- **CURT-010** `setAllExpanded(expanded)`: 접을 수 있는 모든 행을 펼치거나 접습니다.
- **CURT-011** `undo()`: 마지막 데이터 변경 이전 레코드로 복원하고 되돌린 레코드를 실행복귀 대상으로 만들며, 되돌릴 이력이 없으면 실패합니다.
- **CURT-012** `redo()`: 가장 최근에 실행취소한 데이터 변경을 다시 적용하며, 실행복귀할 이력이 없으면 실패합니다.

- **CURT-061** 스냅샷은 `canUndo`와 `canRedo`를 제공합니다. `undo()`와 `redo()`가 복원할 레코드가 있는지입니다.
- **CURT-062** 이력은 양방향에 각각 최대 100개 레코드를 보관하고 그보다 오래된 레코드는 버립니다.
- **CURT-063** 같은 경로에 연속한 `setValue` 호출은 이력 레코드 하나를 공유하고, 그 밖의 데이터 변경은 레코드 하나를 추가합니다.
- **CURT-064** `undo()` 뒤의 데이터 변경은 실행복귀 레코드를 지웁니다.
- **CURT-065** `setData`는 이력을 새로 시작하고 모든 행을 펼칩니다.
- **CURT-066** 행을 제거하면 그 행과 그 안의 행의 뷰 상태를 버리고, 행 키를 바꾸면 그 상태를 새 키로 옮깁니다.
- **CURT-067** 뷰 변경은 `revision`을 바꾸지 않고, 데이터 변경과 `undo()`, `redo()`는 바꿉니다.
- **CURT-068** 서버 렌더링이 쓰는 초기 뷰는 모든 행이 펼쳐져 있습니다. 알 수 없는 행의 `toggleRow`는 `INVALID_FORM_INPUT`과 `Unknown row: {key}`로 실패합니다.
- **CURT-069** `bindForm` 옵션 `collapsed`는 행 경로 `{collection}.{key}`의 목록이며, 그 접을 수 있는 행을 접힌 상태(`expanded: false`)로, 나머지 행을 펼친 상태로 렌더링합니다.

구조 맵과 현재 데이터 보기는 [폼 마크업](form-markup.ko.md)에서 정의합니다.

뷰는 중복 없이 행을 접은 순서대로 둔 행 경로의 순서 있는 목록 `collapsed`이고, 이력은 오래된 것부터 둔 레코드
`entries`와 `redoEntries`, 그리고 마지막 값 편집이 있으면 그 경로 `lastPath`입니다.
모든 구현은 이 규칙을 받은 값을 바꾸지 않는 함수로 export합니다.

- **CURT-070** `initialView()`는 접은 행이 없는 뷰를 반환합니다.
- **CURT-071** `toggleRowView(view, rowPath)`는 접은 행을 펼치고 펼친 행을 접으며, 접은 행은 맨 뒤에 추가합니다.
- **CURT-072** `collapsibleRows(nodes)`는 평가된 노드에서 접을 수 있는 모든 행의 행 경로 `{collection}.{key}`를 노드 순서의 깊이 우선으로 반환합니다.
- **CURT-073** `setAllExpandedView(nodes, expanded)`는 `expanded`가 참이면 접은 행이 없는 뷰를, 아니면 `collapsibleRows(nodes)`를 접은 뷰를 반환합니다.
- **CURT-074** `removeRowView(view, rowPath)`는 그 행 경로와 그 행 안의 경로를 버립니다.
- **CURT-075** `rekeyRowView(view, oldPath, newPath)`는 행 경로와 그 행 안의 경로의 접두사 `oldPath`를 `newPath`로 바꾸고 순서를 유지합니다.
- **CURT-076** `emptyHistory()`는 레코드가 없는 이력을 반환합니다.
- **CURT-077** `recordChange(history, previous, path?)`는 `path`가 `lastPath`와 같지 않으면 `previous`를 entries에 추가하고, 마지막 100개 entry만 유지하며, `redoEntries`를 비우고, `path`가 있으면 `lastPath`를 `path`로 설정합니다.
- **CURT-078** `canUndo(history)`는 이력에 entry가 있으면, `canRedo(history)`는 redo entry가 있으면 참입니다.
- **CURT-079** `undoChange(history, current)`는 마지막 entry를 뺀 이력, `current`를 `redoEntries`에 추가한(마지막 100개) 이력, `lastPath` 없음, 그리고 그 마지막 entry를 레코드로 반환하며, 빈 이력은 `INVALID_FORM_INPUT`과 `Nothing to undo`로 실패합니다.
- **CURT-080** `redoChange(history, current)`는 `current`를 entries에 추가하고(마지막 100개) 마지막 redo entry를 뺀 이력과 그 redo entry를 레코드로 반환하며, redo entry가 없는 이력은 `INVALID_FORM_INPUT`과 `Nothing to redo`로 실패합니다.

작업은 `move-up`, `move-down`, `add-row`, `copy-row`, `remove-row`, `toggle-row`, `select-row`,
`expand-all`, `collapse-all`, `undo`, `redo` 중 하나입니다. 대상은 `{ name, path?, key? }`이며 `path`는 컬렉션 경로,
`key`는 행 키입니다. 포커스는 `{ path, key? }`이고 결과는 `{ focus? }`입니다.

- **CURT-081** `resolveAction({ action, path?, key? })`는 `name`이 `action`인 대상을 반환하며 `path`와 `key`는 비어 있지 않을 때만 담고, `action`이 열한 작업 중 하나가 아니면 대상이 없습니다. 브라우저 바인딩은 버튼의 `data-crudui-action` 속성에서 `action`을, 가장 가까운 `data-field-path` 속성을 가진 요소에서 `path`를, 그 요소 안에서 가장 가까운 `data-crudui-row-key` 속성을 가진 요소에서 `key`를 읽습니다.
- **CURT-082** `runAction(form, target)`는 `expand-all`과 `collapse-all`을 `setAllExpanded(true)`와 `setAllExpanded(false)`로, `undo`와 `redo`를 `undo()`와 `redo()`로 실행하고 각각 포커스 없는 결과를 반환합니다.
- **CURT-083** 그 밖의 작업은 `path`가 없으면 결과가 없고 아무것도 바꾸지 않으며, `add-row`를 제외한 모든 작업은 `key`가 없을 때도 같습니다.
- **CURT-084** `add-row`는 `key`가 있으면 그 행 뒤에 `addRow(path)`를 실행하고 새 행의 포커스를 반환합니다.
- **CURT-085** `copy-row`는 `copyRow(path, key)`를 실행하고 새 행의 포커스를 반환합니다.
- **CURT-086** `remove-row`는 `removeRow(path, key)`를 실행하고 이전 행, 다음 행, 컬렉션(`key` 없는 `path`) 순서로 포커스를 반환합니다.
- **CURT-087** `toggle-row`는 `toggleRow(path, key)`를 실행하고 포커스 없는 결과를 반환합니다.
- **CURT-088** `select-row`는 아무것도 바꾸지 않고 행 `key`의 포커스를 반환합니다.
- **CURT-089** `move-up`과 `move-down`은 행의 한 칸 앞 또는 뒤 인덱스로 `moveRow(path, key, index)`를 실행하고 이동한 행의 포커스를 반환합니다.
- **CURT-090** 작업이 실행하는 연산이 실패하면 그 연산의 오류로 실패하고 인스턴스는 그대로입니다.
- **CURT-091** `name`이 열한 개 작업 중 어느 것도 아닌 target의 `runAction(form, target)`은 `INVALID_FORM_INPUT`과 `Unknown action: {name}` 메시지로 실패하고, 아무것도 바꾸지 않습니다.

## 렌더링과 검증

입력 이름과 래퍼 식별자는 실제 행 키를 포함합니다. 규칙 경로는 키의 패턴이
아닌 폼 정의를 기준으로 반복 부분을 `[]`로 변환합니다. 위 예제의 규칙 경로는
`companies[][stores][][name]`입니다.

공통 런타임은 데이터와 행 작업을 관리합니다. 브라우저 이벤트 바인딩은 기본
입력 요소의 변경과 행 버튼을 처리합니다. 프레임워크 어댑터는 뷰 모델을 렌더링하고
갱신 후 브라우저 입력 속성을 동기화합니다. 데이터 바인딩은 텍스트, textarea,
선택, 체크박스, 언어별 필드와 조건부 표시를 갱신합니다.
`connectForm`은 연결할 때 먼저 방문자가 렌더된 마크업에서 바꾼 모든 컨트롤을 읽은 뒤 인스턴스 값을
컨트롤에 씁니다. 텍스트 컨트롤은 렌더된 기본값을 브라우저가 값처럼 정규화한 결과와 현재 값이 다를 때
바뀐 것입니다. 따라서 0초를 생략한 datetime처럼 브라우저가 다른 형태로 쓴 값은 변경이 아닙니다.

실제 타이핑 중 렌더링으로 input 요소가 교체되어도 포커스와 텍스트 선택을 유지합니다.
같은 값의 중복 change 이벤트는 복원 대기 중인 포커스 상태를 변경하지 않습니다.
각 기본 입력 이벤트는 프레임워크가 다음 화면을 렌더링하기 전에 폼 인스턴스를
갱신합니다. 연속 입력 이벤트는 앞선 각 이벤트에서 반영한 값을 유지합니다. 렌더링이
완료되면 활성 입력값, 인스턴스 값, revision은 마지막 입력 이벤트를 나타냅니다.
렌더링 중 입력 요소를 교체해도 진행 중인 편집은 중단되지 않아야 합니다.

행 작업은 포인터와 키보드 중 무엇으로 실행했든 작업 대상 행으로 포커스를 옮깁니다.
추가나 복사는 새 행으로, 이동은 이동한 행으로 포커스를 옮깁니다. 제거는 이전 행, 다음
행, 상위 행, 컬렉션의 추가 버튼 순으로 포커스를 옮깁니다. 포커스는 행의 첫 번째 활성
표시 입력으로 가고, 입력이 없으면 행의 펼치기/접기 또는 추가 버튼으로 갑니다.

행 작업 뒤나 구조 맵에서 어떤 행으로 이동하는 것은 그 행의 컨트롤(비워진 컬렉션이면 추가
버튼)에 스크롤 없이 포커스한 뒤 그 컨트롤을 필요한 만큼만 보이게 스크롤하는 것입니다
(`scrollIntoView`, `block: 'nearest'`). 그래서 모든 엔진에서 스타일시트의 스크롤 여백이 고정
헤더와 푸터에 가리지 않게 합니다. 포커스에 따른 스크롤은 브라우저에 맡기지 않습니다. Linux의
WebKit은 그 여백을 지키지 않습니다. 스크롤 위치를 따르는
스크립트는 없고, 바인딩은 스크롤 위치를 복원하지 않습니다. 펼치기/접기, 선택, 되돌리기는
포커스를 받은 작업 버튼을 포함해 현재 포커스를 스크롤 없이 유지합니다.

바인딩은 자신이 주는 포커스의 표시 여부를 브라우저에 맡기지 않고 `focus({ focusVisible })`로
정합니다. 브라우저는 스크립트 포커스의 표시 여부를 그 문서의 이전 포인터 입력으로 정하기
때문입니다. 복원한 컨트롤은 원래 포커스의 표시 여부를 유지하고, 행이나 추가 버튼으로 옮긴
포커스는 사용자의 위치를 옮기므로 표시합니다.

검증기는 키가 포함된 제출 데이터를 받습니다. 반복 그룹과 단일 값 필드는 오류
경로에서 키를 유지합니다. 컬렉션 규칙(`required`, `unique`, `mincount`, `maxcount`)은
컬렉션을 검사하고, 나머지 단일 값 규칙은 각 항목을 검사합니다. 다섯 검증 구현 모두
객체 항목을 키의 정렬 순서로 검증합니다. 이 순서는 오류 순회에만 적용하며 폼 데이터와
렌더링·제출 행 순서는 데이터 멤버 순서를 유지합니다. 폼 상태는 검증 오류를 보관하지
않습니다. 현재 데이터를 검증한 결과의 오류를 `renderForm`의
`options.errors`로 전달합니다.

### 조건 값

브라우저는 [조건 필드](schema.ko.md#조건-필드)의 트리를 컨트롤의 텍스트로 가집니다. 그 컨트롤은
`data-crudui-value="json"`으로 표시한 `textarea`입니다([폼 마크업](form-markup.ko.md#조건-필드)). 브라우저
바인딩은 그 컨트롤을 디코딩한 값으로 읽습니다. JSON 텍스트(RFC 8259)인 텍스트는 그것을 파싱한 값이고,
빈 텍스트를 포함한 그 밖의 텍스트는 그 텍스트인 문자열입니다. `conditionTree`는 빈 문자열이 아닌 그런
문자열을 거부합니다. `connectForm`은 디코딩한 값을 `setValue`로 설정하므로 `getData()`는 트리를 객체로
돌려줍니다. `connectForm`은 컨트롤 값을 디코딩한 값의 조건 텍스트가 인스턴스 값의 조건 텍스트와 다를 때만
인스턴스 값의 조건 텍스트를 컨트롤에 씁니다. 그래서 방문자가 입력한 텍스트는 인스턴스 값으로 디코딩되는
동안 그 공백을 유지합니다. 서버가 렌더링한 폼의 브라우저 검증(`@polyspec/crudui-form-binding`의 `bindForm`)은
같은 디코딩한 값으로 데이터를 만듭니다. 네이티브 제출은 텍스트를 보내고, 서버는 데이터를 검증하기 전에
같은 규칙으로 필드의 텍스트를 자신의 JSON 리더로 디코딩합니다. 따라서 `conditionTree`는 브라우저가 검사한
트리를 검사합니다.

`connectForm`은 [구조 편집기](form-markup.ko.md#구조-조건-편집기)의 트리를 그 컨트롤과 버튼으로 편집합니다.
`data-condition-for`로 필드를 찾고, 인스턴스 값에서 트리를 가져오며(빈 값은 `{ "all": [] }`),
`data-condition-path`의 조건을 바꾸고, 새 트리를 `setValue`로 설정합니다. 그러면 렌더러가 새 트리의 편집기를
쓰고, textarea 텍스트는 위와 같이 인스턴스 값을 따릅니다. `mode` 변경은 그룹의 멤버 이름을 `all`이나 `any`로
바꾸고 목록을 유지합니다. `field`, `op`, `value`, `judge` 변경은 그 멤버를 설정합니다. 값 텍스트는 조건 값을
읽는 규칙으로 읽고, `in`으로의 `op` 변경은 목록이 아닌 값을 그 값의 목록으로, 값이 비면 `[]`로 만들며,
`in`에서의 변경은 목록을 그 첫 멤버로, 목록이 비면 `""`로 만듭니다. `add-comparison`은 `options.fields`의 첫
이름이나 `""`를 필드로 하는 `{ "field": …, "op": "eq", "value": "" }`를 덧붙이고, `add-group`은
`{ "all": [] }`를, `add-judge`는 `{ "judge": "" }`를 덧붙이며, `remove`는 그 조건을 그룹에서 뺍니다.

## 완전한 폼

`renderForm(form, options)`는 서버가 보내는 완전한 폼을 렌더링합니다. 폼 요소, 숨은
필드, 입력한 값, 오류, 폼 버튼이 여기에 포함됩니다. 입력한 값은 인스턴스 데이터이고 버튼은 템플릿의
폼 버튼이므로 폼의 어떤 부분도 따로 쓰지 않습니다. `options`의 모든 멤버는 선택이며
`renderForm(form)`은 `crudui-form` 블록만 쓰는 `renderForm(form, {})`와 같습니다.

모든 렌더러에서 `crudui-form` 블록을 쓰는 모든 렌더링은 템플릿의 루트 `description`을 폼 언어로
[콘텐츠 규칙](schema.ko.md#필드)에 따라 번역해 씁니다. 그 텍스트가 비어 있지 않으면
`crudui-form`의 첫 자식으로, 이스케이프한 텍스트를 담은 `<p class="crudui-form__description">`을
`crudui-form__errors`와 `crudui-form__body` 앞에 씁니다. 설명이 없거나 번역한 텍스트가 비어 있으면
아무것도 쓰지 않습니다. 폼 인스턴스는 그 텍스트를 JavaScript에서는 `description`으로, PHP에서는
`getDescription()`으로 반환합니다.

- **CURT-013** `action` — 값: 각각 선택인 문자열 `method`, `url`, `enctype`을 가진 객체; 마크업: 숨은 필드와 `crudui-form` 블록을 감싸는 `form` 요소이며 React 직렬화와 같이 속성 순서는 `action`, `encType`, `method`입니다. 각 속성은 이 객체의 멤버(`action`에는 `url`, `encType`에는 `enctype`)를, 이 객체에 없으면 템플릿 `action`의 멤버를 사용하고 둘 다 없으면 생략합니다. `action` 속성은 [마크업과 스타일](#마크업과-스타일)의 URL 규칙을 따릅니다.
- **CURT-014** `hidden` — 값: 문자열 값을 가진 객체; 마크업: 멤버마다 `<input type="hidden" name="{name}" value="{value}"/>` 하나를 멤버 순서로 `form` 요소 안의 `crudui-form` 블록 앞에 씁니다. `action`이 필요합니다.
- **CURT-015** `formErrors` — 값: 문자열 목록; 마크업: `crudui-form` 안에서 설명 뒤, `crudui-form__body` 앞에 두는 `crudui-form__errors` 요소이며 문구마다 `crudui-form__error` 문단 하나를 목록 순서로 담습니다. 빈 목록은 아무것도 쓰지 않습니다.
- **CURT-016** `errors` — 값: 문자열 `path`와 `message`를 가진 객체 목록; 마크업: 각 메시지를 데이터 경로가 `path`인 노드의 `crudui-node__errors` 슬롯에 `crudui-node__error` 문단으로 목록 순서대로 씁니다.

필드, 그룹, 컬렉션, lang 노드의 데이터 경로는 그 `data-field-path`이고 행의 데이터 경로는 컬렉션
경로, `.`, 행 키를 이은 값입니다. lang-item 노드는 자기 데이터 경로가 없습니다. 검증 결과의 오류
(`path`, `field`, `rule`, `message`, `value`)를 그대로 받을 수 있으며 `path`와 `message`만 읽습니다.
각 문구는 검증 결과의 메시지나 필드와 규칙에 대한 다른 메시지일 수 있고, 폼
전체에 속한 오류에는 별도 문구를 받습니다. `connectForm`은 `crudui-form` 안의 이름 있는 모든 컨트롤을
인스턴스 데이터와 동기화하므로 숨은 input은 `crudui-form` 밖에 둡니다.

옵션은 `INVALID_FORM_INPUT`, 빈 위치, 다음 메시지 중 첫 번째로 이 순서에 따라 실패합니다.

- **CURT-017** 객체가 아닌 값: `Render options must be an object`
- **CURT-018** `action`, `hidden`, `formErrors`, `errors` 이외의 멤버 중 멤버 순서로 첫 번째: `Unknown render option: {name}`
- **CURT-019** 멤버가 `method`, `url`, `enctype` 중 하나이고 문자열인 객체가 아닌 `action`: `action must be an object with string method, url and enctype`
- **CURT-020** 문자열 객체가 아닌 `hidden`: `hidden must be an object of strings`
- **CURT-021** `action` 없는 `hidden`: `hidden requires action`
- **CURT-022** 문자열 목록이 아닌 `formErrors`: `formErrors must be a list of strings`
- **CURT-023** 문자열 `path`와 `message`를 가진 객체 목록이 아닌 `errors`: `errors must be a list of objects with string path and message`
- **CURT-024** 목록 순서로 첫 번째인, 경로가 어떤 노드도 가리키지 않는 오류: `Unknown error path: {path}`

PHP는 옵션 배열을 객체로, 빈 배열을 빈 객체나 빈 목록으로, list 배열을 목록으로 읽습니다. Go와
Rust는 옵션을 순서 있는 JSON 객체로 받습니다.

client가 `JSON.parse`로 다시 읽는 페이지 state의 `render` 멤버처럼 JSON 경계를 넘는 옵션은
`@polyspec/crudui-generator-core`의 `decodeFormRenderOptions(value)`로 디코딩합니다. 이 함수는 위 표의 검사를 `errors`까지
실행하며, 이는 모든 renderer가 오류를 노드에 두기 전에 실행하는 같은 검사입니다. 그리고 옵션을 돌려줍니다. 오류의 경로는
폼이 그것을 렌더링할 때만 검사합니다. 계약 밖의 값은 `FormRenderOptionsError`로 실패합니다. 이 오류는 코드가
`INVALID_FORM_INPUT`이고 메시지가 표의 메시지인 `FormInputError`이며, `pointer`는 잘못된 멤버의 JSON Pointer(RFC 6901)입니다.
알 수 없는 멤버 자신, 멤버 `action`, `hidden`, `formErrors`, `errors`, 또는 `/errors/1`처럼 목록의 첫 번째 잘못된 항목을 가리키며,
빈 문자열은 값 자체입니다. renderer는 같은 오류를 던집니다.

## 브라우저 검증

이 바인딩의 계약은 [패키지 문서](../../packages/form-binding/README.ko.md#브라우저-검증)에 정의되어 있습니다. `keyPrefix` 옵션은 다음과 같습니다:

- **CURT-025** `keyPrefix` — 값: 문자열; 용도: 폼을 컴파일할 때 쓴 `keyPrefix`이며 모든 컨트롤 이름의 첫 세그먼트입니다. 없으면 접두사가 없습니다.

## 캐시와 실행 범위

재사용하는 캐시 대상은 컴파일한 폼 구조입니다. 값이 채워진 HTML 문자열은
레코드 값과 평가된 조건을 포함하므로 재사용할 템플릿이 아닙니다. 데이터가
변경되면 뷰 모델을 다시 생성합니다. 행 식별자가 변경될 때 DOM 요소가 유지되는
것을 보장하지 않습니다.

필드에 선언한 스크립트와 외부 편집기 연동은 기본 입력 바인딩과 별도입니다.

렌더링한 마크업의 스크립트는 [HTML 패키지 문서](../../legacy/packages/html/README.ko.md#렌더링한-마크업의-스크립트)에 정의되어 있습니다.

브라우저는 조각으로 파싱했거나(`innerHTML`, `<template>`) 복제한 스크립트를 실행하지 않으므로 모든
렌더러는 새 스크립트를 새 script 요소로 삽입합니다. HTML 렌더러에서는 `patchContent`가 이를 수행하고,
프레임워크 렌더러는 원시 마크업을 `patchContent`로 씁니다. React는 서버 출력이 바이트 단위로 필요로 하는
위젯 스크립트 요소를 직접 유지하고, 클라이언트 렌더링 뒤 같은 속성과 텍스트를 가진 새 script 요소를 그
옆에서 실행한 다음 제거합니다. jsdom은 복제한 스크립트를 실행하므로 이
규칙은 Chromium, Firefox, WebKit에서 확인합니다.

새 모델로 다시 렌더링한 목록이나 상세(`updateView`)는 `html` 셀과 값을 포함해 새 마크업에 여전히 있는
모든 요소 노드를 유지합니다. HTML 렌더러의 새 마크업은 `patchContent`로 반영되고, React,
Vue, Svelte의 목록·상세 컴포넌트도 원시 내용을 같은 방식으로 반영합니다. 공유 보기 사례
`tests/fixtures/view-session/rerender.mts`가 네 렌더러에서 이를 검사합니다.

브라우저 파일 입력은 저장한 문자열로 채울 수 없습니다. 폼 런타임은 레코드 저장,
DB seq 발급이나 배포를 수행하지 않습니다.

## 인수 기준

1. **CURT-050** 레코드 데이터가 없을 때 모든 중첩 필드를 준비하고 템플릿을 직렬화한 후,
   합성 파일을 다시 로드하지 않고 독립된 레코드를 바인딩합니다.
2. **CURT-053** 편집·정렬·제거·추가 작업에서 이전 값을 복원하지 않습니다.
3. **CURT-054** 저장한 seq 키를 적용하고 입력 이름과 규칙 경로를 올바르게 갱신합니다.
4. **CURT-055** 잘못된 작업은 상태를 변경하지 않고 실패하며, 모든 행을 제거한 뒤에도 추가할 수 있습니다.

프레임워크 화면, 다시 그리기가 유지하는 노드, 브라우저 바인딩의 인수 기준은 해당 패키지 문서에 있습니다([React](../../packages/react/README.ko.md#프레임워크-화면), [Vue](../../packages/vue/README.ko.md#프레임워크-화면), [Svelte](../../packages/svelte/README.ko.md#프레임워크-화면), [HTML](../../legacy/packages/html/README.ko.md#다시-그려도-컨트롤-유지), [폼 바인딩](../../packages/form-binding/README.ko.md#브라우저-바인딩-인수-기준)).

공용 검증 fixture의 모든 사례를 JavaScript, PHP, Go, Rust로 실행하며, 네 언어는 하나의 멱등 결과 서명을 내야 합니다. 오류 값 내부의 객체 멤버 순서는 의미가 없고 배열 순서는 의미가 있습니다.

form 비교 예제의 복사 규칙은 [예제 README](../../examples/form-comparison/README.ko.md#스토어-복사)에 있습니다.

## 입력 라벨과 선택값

각 기본 입력은 전체 필드 경로와 인스턴스의 `idPrefix`(CURT-094)로
생성한 고정 DOM 식별자를 사용합니다. 한 문서에 여러 폼을 표시하는 page는
서로 다른 접두사를 지정하고 SSR과 브라우저에서 같은 접두사를 사용합니다.
식별자는 추가 레코드 데이터를 표현하거나 전송하지 않습니다.
단일 입력 라벨은 `for`로 연결하고 체크박스와 라디오 제목은 해당 입력을 대상으로
합니다. 그룹 제목을 관련 없는 입력과 연결하지 않습니다.
위젯 스크립트는 입력과 같은 식별자를 사용합니다. CSS 선택자는
`CSS.escape`로 식별자를 이스케이프하고 직접 DOM 조회에는
`document.getElementById`를 사용합니다. 검색 초기화와 생성된 CSS는
같은 컨테이너 클래스를 사용합니다. 스크립트의 문자열 인수는 JSON 문자열
이스케이프와 `<`, U+2028, U+2029 이스케이프를 적용합니다. 선택, 파일,
검색을 포함한 모든 위젯은 구조상의 행 위치로 규칙 경로를 생성합니다.
복수 선택 입력은 배열 전송 이름을 사용하고 주입·편집·전송에서 선택값 전체를
유지합니다. 선택하지 않은 경우 인스턴스 데이터는 빈 배열입니다.

- **CURT-094** 기본 `idPrefix`는 `crudui`입니다.

목록 렌더링은 `renderList(spec, rows, { layout })`를 사용합니다. 모든 프레임워크에서
`layout`은 `table`(기본값) 또는 `card`입니다.

필드 컨테이너는 폼 루트 기준 데이터 경로를 `data-field-path`에 저장합니다.
실제 입력만 전송용 `name`을 사용합니다. 브라우저 행 조작은 가장 가까운 필드
컨테이너를 사용하며 생성된 제목에 의존하지 않습니다.

`items`가 잘못된 [선택 목록](schema.ko.md#선택-목록)인 필드는 타입을 평가하기 전에 `INVALID_FORM_INPUT`으로
바인딩에 실패합니다.

지원하지 않는 필드 타입은 코드 `UNSUPPORTED_FIELD_TYPE`의
`UnsupportedFieldTypeError`를 메시지 `Unsupported field type "{type}" at "{path}"`로 발생시킵니다.
`{type}`은 선언된 필드 타입이고 `{path}`는 필드의 데이터 경로이며, 메시지는 버전별 렌더러
이름을 쓰지 않습니다.

## HTML 직렬화

### 날짜 값

날짜 입력, 날짜와 시간 입력, 목록 날짜 표시는 UTC를 사용합니다. 명시적인 오프셋이
있는 타임스탬프는 UTC로 변환하고, 오프셋 없는 날짜와 시간은 UTC로 해석합니다.
렌더링은 PHP, 서버, 브라우저의 시간대에 의존하지 않습니다. 날짜와 시간 입력은
초까지 표시하며 타임스탬프를 변환하기 전에 오프셋을 제거하지 않습니다.
인스턴스 데이터는 전달받은 값을 유지합니다.

입력 형식은 `YYYY-MM-DD`, `YYYY-MM-DD[T ]HH:mm`과 선택적인 초·소수 초,
`Z` 또는 `+/-HH:mm`이 있는 ISO 타임스탬프, 명시적인 시간대가 있는 RFC 2822
날짜를 허용합니다. 잘못되거나 지원하지 않는 날짜 문자열은 필드 모델이나 목록
표시에서 그대로 유지합니다. 날짜의 유효성은 검증 규칙이 검사합니다.
RFC 날짜는 선택적인 요일, 한 자리 또는 두 자리 일, 영문 세 글자 월, 네 자리 연도,
시·분과 선택적인 초, 숫자 `+/-HHMM` 오프셋 또는 `UT`, `GMT`, `EST`, `EDT`,
`CST`, `CDT`, `MST`, `MDT`, `PST`, `PDT`를 허용합니다. 영문 이름의 대소문자는
구분하지 않고 공백이나 탭으로 항목을 구분합니다. 요일이 있으면 실제 날짜와 일치해야
합니다. 주석, 접힌 줄, 두 자리 연도, 군용 시간대는 허용하지 않습니다. ISO 입력의
앞뒤 공백은 제거하지 않습니다. 날짜, 시각, 오프셋은 유효한 값이어야 합니다.
UTC, Asia/Seoul, America/Los_Angeles에서 자정을 통과하는 날짜 변환과 초기
데이터·후속 주입을 비교합니다.

### 마크업과 스타일

서버 렌더러는 계산된 전체 모델을 유지합니다. 네이티브 폼과 목록 HTML은
이스케이프한 속성과 실제 이미지 요소의 preload 링크를 포함해 React 정적
마크업을 따릅니다. 리소스 힌트는 source의 최초 사용 순서를 유지하고,
빈 source와 `data:` source를 제외하며 source 중복을 제거합니다.
리소스 힌트를 생성하기 위해 원시 HTML 내용을 파싱하지 않습니다.
일반 `href`와 `src` 속성은 JavaScript URL 스킴을 거부하고 같은 차단 URL을
출력합니다. 명시적 원시 내용에는 해당 처리 규칙을 유지합니다.

인라인 CSS 파싱은 최상위 세미콜론과 첫 번째 최상위 콜론에서만 선언을
구분합니다. 따옴표 안의 텍스트, 이스케이프, 주석, 중첩 괄호·대괄호·중괄호는
해당 선언 값의 일부로 유지합니다. 렌더링은 데이터 URL이나 따옴표 안의 값을
잘라내면 안 됩니다. 브라우저 스타일은 `!important`를 CSS 우선순위로
적용합니다. 필드 모델은 선언 순서와 값을 유지하며, 비교에서 CSS 차이를
제거하면 안 됩니다.
