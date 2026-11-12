# 폼 마크업
<!-- doc-id: docs-spec-form-markup -->
<!-- source-sha256: 8f4238f2a7938ca8f6421bdb9593b9587eaa2396156ec7612c09b38f68072591 -->

[English](form-markup.md). 이 문서는 평가된 폼 노드의 렌더링 방식을 정의합니다.
React, Vue, Svelte, HTML 렌더러와 네이티브 렌더러는 같은 마크업을 생성합니다.
데이터, 행 작업과 뷰 상태는 [폼 런타임](form-runtime.ko.md)에서 정의합니다.

## 클래스 이름

클래스 이름은 세 형태 중 하나이며 구분자마다 의미가 하나입니다.

- **CUMK-001** `crudui-{block}` — 의미: 블록: 독립 구성 요소; 예: `crudui-node`, `crudui-controls`
- **CUMK-002** `crudui-{block}__{element}` — 의미: 요소(`__`): 해당 블록 안에만 존재하는 부분; 예: `crudui-node__header`, `crudui-node__label`
- **CUMK-003** `crudui-{block}--{modifier}` — 의미: 수식자(`--`): 블록의 종류 또는 변형; 예: `crudui-node--row`, `crudui-node--sticky`

이름 안의 단어는 하이픈 하나로 잇습니다(`lang-item`). 수식자는 항상 기반 블록
클래스와 함께 씁니다(`class="crudui-node crudui-node--row"`). 요소 이름은 한
단계만 쓰며 요소에는 수식자를 두지 않습니다. 클래스는 스타일만 담당합니다.
브라우저 동작은 아래의 data·ARIA 속성만 읽고 클래스를 읽지 않습니다.
예외 하나는 경계가 정해져 있습니다. [브라우저 검증](form-runtime.ko.md#브라우저-검증) 바인딩은 자신이
교체하는 슬롯을 클래스 `crudui-form__body`, `crudui-form__errors`, `crudui-node__body`,
`crudui-node__errors`로 찾습니다. 이 슬롯에는 data·ARIA 속성이 없기 때문입니다. 바인딩의 소스가 다른
클래스를 가리키면 바인딩의 테스트가 실패합니다. 렌더러가 이 슬롯에 data 속성을 쓰면 이 예외는
끝납니다.
위젯도 같은 형태를 따릅니다. 렌더러가 그 밖에 쓰는 클래스는 규칙이 값을 검사하는 컨트롤을 표시하는
`valid-target`, 동적 소스를 가진 select를 표시하는 `valid-target-async`
([브라우저 검증](form-runtime.ko.md#브라우저-검증) 참조), 에디터 호스트 `tinymcearea`, `summernote`,
`contentjs`, `tuiarea`, 그리고 스펙이 `design`으로 선언한 클래스뿐입니다.

## 블록과 속성

- **CUMK-004** `crudui-form`: 비어 있지 않은 루트 설명의 `crudui-form__description` 문단, 폼 오류마다 `crudui-form__error` 문단을 담은 `crudui-form__errors`, `crudui-form__body`, 폼 버튼을 담은 `crudui-form__footer`를 가진 폼 루트입니다.
- **CUMK-005** `crudui-node`: 데이터 노드 하나입니다. 종류는 아래와 같습니다.
- **CUMK-006** `crudui-controls`: `role="group"`과 접근성 이름을 가진 버튼 묶음입니다.
- **CUMK-007** `crudui-action`: 버튼입니다. `data-crudui-action`을 가진 조작, 폼 버튼, [버튼 필드](#버튼-필드)의 버튼이 이에 해당합니다. `crudui-action--text`는 레이블을 텍스트로 표시합니다.
- 구조 맵(`crudui-outline`)과 현재 데이터 보기(`crudui-data`)는 TypeScript HTML 렌더러의 블록이며, `packages/html/README.ko.md`에 문서화되어 있습니다.
- 구조 조건 편집기(`crudui-condition`)는 구조 조건 필드의 위젯 안 블록이며 [구조 조건 편집기](#구조-조건-편집기)에 정의합니다(CUMK-067, CUMK-068).
- **CUMK-010** `crudui-widget`: 앞뒤 텍스트 `__affix`, 파일 위젯의 `__button`, 범위 위젯의 `__output`을 가진 컨트롤입니다. `--search`는 검색 select를, `--range`는 범위 컨트롤을, `--condition`은 [구조 조건 편집기](#구조-조건-편집기)를 담고, `--unsupported`는 위젯이 없는 유형을 표시합니다.
- **CUMK-011** `crudui-input`: 기본 input, textarea, select입니다. select는 `--select`, 파일 입력은 `--file`, 범위 입력은 `--range`, [조건 필드](#조건-필드)의 textarea는 `--condition`, [스위치](#스위치)의 체크박스 input은 `--switch`를 가집니다.
- **CUMK-012** `crudui-choices`: 라디오(choice) 또는 체크박스(multichoice) 선택지입니다. 각 `__input` 뒤에 `__label`이 오고, `--multiple`은 체크박스 선택지를 줄바꿈합니다. 각 선택지는 자신의 레이블 class와 style, input 속성을 더할 수 있습니다([선택지 외형](#선택지-외형)).

- **CUMK-013** `data-field-path`: field·group·collection·lang 노드와 구조 맵 행의 데이터 경로
- **CUMK-014** `data-crudui-row-key`: row 노드의 행 키
- **CUMK-015** `data-lang`: lang-item 노드의 언어 코드
- **CUMK-016** `data-crudui-action`: 버튼의 작업
- **CUMK-017** `hidden`: `design.show`가 false인 노드, 접힌 행 본문, 펼친 행의 요약
- **CUMK-018** `aria-expanded`, `aria-controls`: 행 토글 상태와 제어하는 본문
- **CUMK-019** `step="any"`: 모든 숫자 컨트롤(`number`, `integer`, `float`, `decimal`), 아래 참조
- **CUMK-069** control 값의 숫자는 그 [정규 텍스트](validation-rules.ko.md#값)로 씁니다: 같은 double로
  다시 읽히는 가장 짧은 텍스트

버튼의 컬렉션 경로는 버튼 자신 또는 가장 가까운 상위 `[data-field-path]`입니다.
행 키는 그 요소 안에서 가장 가까운 `[data-crudui-row-key]`이며, 없으면 작업은
컬렉션에 적용됩니다.

검증 규칙은 네이티브 제약 속성으로 쓰지 않으며, 유효성은
[검증 규칙](validation-rules.ko.md)이 결정합니다. 숫자 컨트롤은 `step="any"`를 가져
네이티브 제약 검증이 모든 숫자를 받아들입니다. 이 속성이 없으면 기본 step 1이 `value`
속성에서부터 세어지므로, `2886.5` 같은 저장 값이 있으면 모든 정수가 step 불일치가 됩니다.
증가 단위는 `step` 규칙이 맡습니다. [범위 컨트롤](#범위-필드)만 예외입니다.

## 노드

모든 데이터 노드는 `crudui-node`와 종류 수식자 하나, 그리고 이 순서의 `crudui-node__header`,
`crudui-node__body`, `crudui-node__errors`, `crudui-node__footer` 슬롯을 가집니다. 헤더는 내용이
있을 때만, 오류 슬롯은 오류가 있을 때만(메시지마다 `crudui-node__error` 문단 하나,
[완전한 폼](form-runtime.ko.md#완전한-폼) 참고), 푸터는 컨트롤이 있을 때만 출력합니다. 자식 노드는 본문에만, 헤더 부품은 헤더에만,
컨트롤은 헤더 또는 푸터에만 둡니다. `design.wrapper`는 노드 루트, `design.label`은
헤더, `design.group`은 group과 group 행의 본문 및 choice·multichoice 필드의 `crudui-choices` 요소,
`design.class`는 컨트롤,
`design.prepend`는 위젯 prepend에 적용합니다.

- **CUMK-020** `field` — 헤더: `__label`, `__description`; 본문: 위젯. inline [배치](#배치)에서 노드에 `crudui-node--inline`이 붙습니다
- **CUMK-021** `group` — 헤더: `__label`, `__description`; 본문: 자식 노드. line 배치를 선언하면 노드에 `crudui-node--line`이, inline 배치 안에서는 `crudui-node--inline`도 붙습니다
- **CUMK-022** `collection` — 헤더: `__label`, `__description`, `__count`; 본문: row 노드. 행이 없으면 푸터에 `add-row` 컨트롤
- **CUMK-023** `row` — 헤더: 토글, `__label`, `__number`, `__title`, `__summary`, 컨트롤; 본문: 스칼라 행의 위젯 또는 group 행의 자식 노드
- **CUMK-024** `lang` — 헤더: `__label`, `__description`, `__title`(`lang.title`); 본문: lang-item 노드. `lang.frame`이 true(기본값)이면 노드에 `crudui-node--framed`가 붙습니다
- **CUMK-025** `lang-item` — 헤더: 언어 코드를 담은 `__label`; 본문: 위젯

본문에 레이블 대상 컨트롤이 정확히 하나이면 레이블은 그 컨트롤을 가리키는 `label`
요소이고, 아니면 `span`입니다. 체크박스와 스위처 캡션은 본문 안 입력 자신의
레이블이며 헤더에는 설명만 둡니다. 단, inline [배치](#배치)에서는 헤더가 레이블을 가집니다. `hidden` 필드에는 헤더가 없습니다. `language: 'en'`으로 출력한 행은 다음과 같습니다.

```html
<div class="crudui-node crudui-node--row" data-crudui-row-key="__0000000000001__">
  <div class="crudui-node__header">
    <button type="button" class="crudui-action" data-crudui-action="toggle-row"
      aria-expanded="true" aria-controls="crudui:companies.__0000000000001__:body" aria-label="Expand or collapse"></button>
    <span class="crudui-node__label">Company</span>
    <span class="crudui-node__number">1</span>
    <span class="crudui-node__title">ACME</span>
    <span class="crudui-node__summary" hidden="">Nested rows: 2</span>
    <div class="crudui-controls" role="group" aria-label="Row controls">…</div>
  </div>
  <div class="crudui-node__body" id="crudui:companies.__0000000000001__:body">…</div>
</div>
```

## 선언한 속성

필드는 `design.attributes`로 컨트롤의 속성을, `design.wrapper.attributes`로 노드 루트의 속성을
선언합니다([스키마](schema.ko.md#선언한-속성)). 컨트롤은 `design.class`가 적용되는 요소입니다. 위젯의
input, select, textarea, image·file·cover 필드의 파일 input, 표시 필드(`dummy`, `image-viewer`)의
`div`, button 또는 action 필드의 버튼, 체크박스와 스위처의 input이 컨트롤입니다. `design.class`가 선택지 레이블에
적용되는 choice와 multichoice 필드에서는 모든 선택지 input이 컨트롤입니다. `lang`을 가진 필드는 모든
언어 항목의 컨트롤에, 반복 스칼라 필드는 모든 행의 컨트롤에 컨트롤 속성을 씁니다. `field`, `group`,
`collection`, `lang` 노드의 루트가 wrapper 속성을 받으며 `row`와 `lang-item` 노드는 받지 않습니다.
동적 선택지 원천은 선택지 input을 렌더링하지 않으므로 컨트롤 속성도 쓰지 않습니다.

모델은 선언한 속성을 선언 순서로 가집니다.

- **CUMK-026** 노드 모델은 `style` 다음, `hidden` 앞의 `attributes`로 가집니다.
- **CUMK-027** 체크박스 모델은 `caption` 다음의 `attributes`로 가집니다.
- **CUMK-028** 위젯 모델은 컨트롤의 속성 목록인 `attrs`에, `file` 배치에서는 `extra.file`에 덧붙입니다. `choices`
  배치는 `extra.input` 다음의 `extra.option`에 둡니다.

각 멤버는 선언에 속성이 하나 이상 있을 때만 존재합니다. 모든 렌더러는 CRUDUI가 그 요소에 쓰는 속성 다음에
선언한 속성을 선언 순서로 씁니다. 노드 루트에서는 `hidden` 다음에, behavior 속성을 가진 선택지
input에서는 `data-is-default`와 `checked` 다음에 씁니다. React의 서버 렌더링이 기준 직렬화이므로 기준의
두 가지 배치가 적용됩니다. behavior 속성이 없는 컨트롤은 속성 목록 다음에 `style`을 쓰고, behavior
속성이 없는 `input`은 `name`, `checked`, `value`를 마지막에 씁니다. 예를 들어
`design.attributes: { data-setting: theme, aria-describedby: theme-help }`를 가진 text 필드는
다음을 씁니다.

```html
<input type="text" class="valid-target crudui-input" data-name="theme" data-rule-name="theme"
  data-default="" id="crudui:theme" data-setting="theme" aria-describedby="theme-help"
  name="theme" value=""/>
```

## 배치

group은 `design.layout`으로 필드의 배치를 선언합니다([스키마](schema.ko.md#배치)). 노드 모델은
`crudui-node--framed`를 쓰는 것과 같이 배치를 루트 클래스(`className`)의 앞, `design.wrapper` 클래스 앞에
modifier로 씁니다.

- **CUMK-029** inline 배치의 field 노드는 `crudui-node--inline`을 가집니다.
- **CUMK-030** `line`을 선언한 group은 `crudui-node--line`을 가지며, group이 inline 배치 안에 있으면 그 앞에
  `crudui-node--inline`을 가집니다.

스타일시트는 inline 노드를 레이블 열(`--crudui-label-width`)과 컨트롤 열의 grid로 배치합니다. 헤더는 상자를
갖지 않으므로(`display: contents`) 레이블은 레이블 열에, 설명은 컨트롤 열의 본문 아래에 놓이고 오류가 그
뒤에 옵니다. 따라서 헤더 둘레에 상자를 그리는 `design.label`의 class나 style은 그릴 상자가 없습니다.
레이블은 높이가 컨트롤 하나 이상이며 텍스트를 컨트롤의 첫 줄 가운데에 맞추고, 체크박스와 스위처 필드의
본문은 높이가 컨트롤 하나이며 input을 가운데에 맞춥니다. line group은 본문의 자식
노드를 줄바꿈되는 한 행에 둡니다. 각 자식은 내용만큼의 너비를 가지며, 남은 너비를 차지할 자식은
`design.wrapper.style: "flex: 1"`을 선언합니다. 스키마의 예는 다음을 씁니다.

```html
<div class="crudui-node crudui-node--field crudui-node--inline" data-field-path="appearance.theme">
  <div class="crudui-node__header"><label class="crudui-node__label"
    for="crudui:appearance.theme">Theme</label><p class="crudui-node__description">Applies to every
    window.</p></div>
  <div class="crudui-node__body">…</div>
</div>
<div class="crudui-node crudui-node--group crudui-node--inline crudui-node--line"
  data-field-path="appearance.font">
  <div class="crudui-node__header"><span class="crudui-node__label">Font</span></div>
  <div class="crudui-node__body"><div class="crudui-node crudui-node--field"
    data-field-path="appearance.font.family">…</div>…</div>
</div>
```

inline 배치에서 레이블을 가진 `checkbox` 또는 `switcher` 필드는 다른 필드와 같이 레이블을 헤더에
씁니다. 레이블은 input을 가리키는 `label` 요소이고 그 뒤에 설명이 옵니다. 체크박스 모델에는 `caption`
멤버가 없으므로 본문에는 input만 있고 input이 컨트롤 열의 시작에 놓입니다. 레이블이 없는 체크박스와
스위처 필드, 그리고 inline 배치 밖의 모든 체크박스와 스위처 필드는 본문의 캡션 레이블을 유지합니다.
inline group `look` 안에서 레이블 `Sync`와 설명 `Keeps every window in step.`을 가진 스위처 `sync`는 다음을
씁니다.

```html
<div class="crudui-node crudui-node--field crudui-node--inline" data-field-path="look.sync">
  <div class="crudui-node__header"><label class="crudui-node__label" for="crudui:look.sync">Sync</label><p
    class="crudui-node__description">Keeps every window in step.</p></div>
  <div class="crudui-node__body"><input class="valid-target crudui-input crudui-input--switch"
    id="crudui:look.sync" type="checkbox" role="switch" name="look[sync]" value="1"/></div>
</div>
```

## 선택지 외형

choice·multichoice 필드의 선택지는 `class`, `style`, `attributes`를 선언할 수 있습니다
([스키마](schema.ko.md#선택지-외형)). 선택지의 레이블은 레이블 클래스(`crudui-choices__label`과
`design.class`) 다음에 class를, class 다음에 style을 받습니다. 선택지의 input은 필드의 컨트롤 속성 다음에
속성을 받으며, 둘 다에 선언한 이름은 필드 속성의 위치를 유지하고 선택지의 값을 가집니다.
`crudui-choices` 요소는 자신의 클래스 다음에 `design.group`의 class를, 그리고 `design.group`의 style을
받습니다. option 모델은 `id` 다음에 `className`, `style`, `attributes` 멤버를 가지며 각각 선언했을 때만
존재합니다. `style`은 design style과 같이 정규화합니다. 데이터 `accent: green`으로 스키마의 예는 다음을
씁니다.

```html
<div class="crudui-choices swatches"><input data-name="accent" data-rule-name="accent" type="radio"
  autoComplete="off" class="valid-target crudui-choices__input" id="crudui:accent:0"
  data-is-default="" aria-label="Blue accent" name="accent" value="blue"/><label
  for="crudui:accent:0" class="crudui-choices__label swatch"
  style="--swatch-bg:#1d4ed8"><span>Blue</span></label><input data-name="accent"
  data-rule-name="accent" type="radio" autoComplete="off" class="valid-target crudui-choices__input"
  id="crudui:accent:1" data-is-default="" name="accent" checked="" value="green"/><label
  for="crudui:accent:1" class="crudui-choices__label swatch"
  style="--swatch-bg:#15803d"><span>Green</span></label></div>
```

## 선택지 그룹

select 필드의 선택 목록은 그룹을 가질 수 있습니다([스키마](schema.ko.md#선택지-그룹)). select는 option을
작성한 순서대로 씁니다. 일반 선택지는 `option` 요소로, 그룹의 선택지는 그룹의 번역된 라벨을 `label` 속성으로
가진 `optgroup` 요소 하나 안의 `option` 요소로 씁니다. 동작 속성이 있는 select도 원시 마크업에 그룹을 같은
방식으로 씁니다. 그룹 안 선택지의 option 모델은 다른 멤버 뒤에 `group` 멤버를 가지며, 이 멤버는 `items`에서
그룹의 0부터 시작하는 위치인 `index`와 번역된 라벨인 `label`을 가진 객체입니다. 렌더러는 한 그룹에 속하거나
그룹 밖에 있는 연속된 option의 묶음을 씁니다. 데이터가 `region: eu-north`이면 스키마의 예는 다음을 씁니다.

```html
<div class="crudui-widget"><select name="region" class="valid-target crudui-input crudui-input--select"
  data-name="region" data-rule-name="region" data-default="" id="crudui:region"><option
  value="auto">Automatic</option><optgroup label="Europe"><option value="eu-west">West</option><option
  value="eu-north" selected="">North</option></optgroup><optgroup label="Asia"><option
  value="ap-east">East</option></optgroup></select></div>
```

## 범위 필드

`range` 필드([스키마](schema.ko.md#범위-필드))는 `crudui-widget crudui-widget--range` 위젯을 렌더링합니다.
앞 텍스트, `range` 유형의 `input`, 그 input을 위한 `crudui-widget__output` `output` 요소, 단위를 나타내는
뒤 텍스트로 이루어집니다. input은 `valid-target crudui-input crudui-input--range` 클래스와 `min`, `max`,
`step` 속성을 가지며, 값은 `validate.range`와 `validate.step`의 정규 텍스트입니다. 이들은 네이티브 속성으로
쓰는 유일한 검증 매개변수입니다. 슬라이더는 이 값 없이 위치를 갖지 못하고, 슬라이더가 제공하는 모든 위치는
`range`와 `step` 규칙을 통과합니다. output은 폼을 렌더링할 때의 값을 표시하며, `connectForm`처럼 변경 뒤
다시 렌더링하는 렌더러가 새 값을 표시합니다. 빈 값은 빈 `value`로 쓰며 브라우저는 이를 범위의 가운데에
표시하고, output은 비어 있습니다.

위젯 모델은 배치 `range`, 태그 `input`, input 속성인 `attrs`, output 텍스트인 `text`를 가집니다.
`default: 50`, `append: "%"`, `validate: { range: [0, 100], step: 5 }`를 가진 `volume` 필드는 다음을 씁니다.

```html
<div class="crudui-widget crudui-widget--range"><input type="range" min="0" max="100" step="5"
  class="valid-target crudui-input crudui-input--range" data-name="volume" data-rule-name="volume"
  data-default="50" id="crudui:volume" name="volume" value="50"/><output
  class="crudui-widget__output" for="crudui:volume">50</output><span
  class="crudui-widget__affix">%</span></div>
```

## 조건 필드

`condition` 필드([스키마](schema.ko.md#조건-필드))는 `textarea` 필드의 위젯을 렌더링합니다.
`crudui-widget` 안에 앞 텍스트, `textarea`, 뒤 텍스트가 놓입니다. textarea는
`valid-target crudui-input crudui-input--condition` 클래스 뒤에 `design.class`의 클래스를 가지고,
`rows="5"`와 `data-crudui-value="json"`을 가집니다. `data-crudui-value`는 브라우저 바인딩에 그 텍스트가
JSON 텍스트임을 표시합니다([조건 값](form-runtime.ko.md#조건-값)). 그 뒤에 textarea의 style, 이벤트 속성,
데이터 속성이 옵니다. 텍스트는 필드 값의 조건 텍스트이고, 데이터에 필드 값이 없으면 `default`의 조건
텍스트입니다. `data-default`는 `default`의 조건 텍스트입니다.

- **CUMK-066** 값의 조건 텍스트: 문자열은 그 자신이고, `null`과 없는 값은 비어 있으며, 그 밖의 값은
  ECMAScript의 `JSON.stringify`가 들여쓰기 없이 쓰는 JSON 텍스트입니다. 그 텍스트에는 공백이 없고, 객체의
  멤버를 데이터 순서로 쓰며, 숫자를 ECMAScript `Number::toString`의 가장 짧은 형태로 쓰고, `true`, `false`,
  `null`을 씁니다. 숫자는 ECMAScript가 그 숫자로 읽는 double이므로(CURP-028) 정수 `9007199254740993`은
  `9007199254740992`로 씁니다. 문자열은 큰따옴표 안에 씁니다. `"`와 `\`는 백슬래시로 이스케이프하고, U+0008, U+0009,
  U+000A, U+000C, U+000D는 `\b`, `\t`, `\n`, `\f`, `\r`로 쓰며, U+0020 미만의 다른 문자와 짝이 없는
  서로게이트는 `\u`와 소문자 16진수 네 자리로 쓰고, 그 밖의 문자는 그대로 씁니다.

위젯 모델은 배치 `widget`, 태그 `textarea`, textarea 속성인 `attrs`, 조건 텍스트인 `text`를 가집니다.
스타일시트는 텍스트를 고정폭 글꼴로 씁니다.
라벨 `Pass condition`, `validate: { required: true, conditionTree: judge }`, 데이터
`{ "any": [{ "field": "clues.size", "op": "ge", "value": 2 }, { "judge": "Jian finds it." }] }`를 가진
`pass` 필드는 다음을 씁니다.

```html
<div class="crudui-widget"><textarea name="pass" class="valid-target crudui-input crudui-input--condition"
  rows="5" data-crudui-value="json" data-name="pass" data-rule-name="pass" data-default=""
  id="crudui:pass">{&quot;any&quot;:[{&quot;field&quot;:&quot;clues.size&quot;,&quot;op&quot;:&quot;ge&quot;,&quot;value&quot;:2},{&quot;judge&quot;:&quot;Jian finds it.&quot;}]}</textarea></div>
```

### 구조 조건 편집기

`design.editor: structured`인 조건 필드([스키마](schema.ko.md#구조-조건-편집기))는 위젯
`crudui-widget crudui-widget--condition`을 씁니다. 그 안에는 앞 텍스트, 값을 가지며 폼이 제출하는 조건
필드의 textarea, 트리의 편집기, 뒤 텍스트가 있습니다.

- **CUMK-067** 편집기가 보여 주는 값(CUSC-086)은 textarea를 속성 `hidden`과 함께 쓰고, 그다음
  `<div class="crudui-condition" data-condition-for="{id}">`를 씁니다. `{id}`는 textarea의 id이며, 그 안에
  루트 조건이 있습니다. 각 조건은 트리 안 조건의 JSON Pointer(RFC 6901)인 `data-condition-path`를 가집니다.
  루트는 빈 포인터이고, 그룹의 위치 `{n}`에 있는 조건은 그룹의 포인터, `/`, `all`이나 `any`, `/`, `{n}`입니다.
  그룹은 `<fieldset class="crudui-condition__group">`이며, 옵션 `all`과 `any`(그룹의 mode가 선택됨)의
  `<select class="crudui-condition__mode" data-condition-part="mode">`, 목록 순서로 조건을 담은
  `<li class="crudui-condition__item">`의 `<ol class="crudui-condition__list">`, 그리고 버튼
  `add-comparison`, `add-group`, `add-judge`(`conditionTree: judge`에서만), 루트 아래에서는 `remove`를
  가집니다. 비교는 `<div class="crudui-condition__comparison">`이며, 필드 컨트롤, `op` 값 여덟 개(CUSC-085,
  비교의 op가 선택됨)의 `<select class="crudui-condition__op" data-condition-part="op">`, 값의 조건
  텍스트(CUMK-066)를 값으로 가진 `<input class="crudui-condition__value" data-condition-part="value">`,
  버튼 `remove`를 가집니다. 필드 컨트롤은 필드를 값으로 가진
  `<input class="crudui-condition__field" data-condition-part="field">`이거나, `options.fields`가 있으면 그
  이름들을 그 순서로 가진 `<select class="crudui-condition__field" data-condition-part="field">`입니다. 비교의
  필드가 선택되고, 그 이름들에 없으면 자기 옵션으로 맨 앞에 씁니다. 판정 텍스트는 텍스트를 가진
  `<input class="crudui-condition__text" data-condition-part="judge">`와 버튼 `remove`의
  `<div class="crudui-condition__judge">`입니다. 각 버튼은 동작의 화면 문구(`conditionAddComparison`,
  `conditionAddGroup`, `conditionAddJudge`, `conditionRemove`)를 가진 `<button type="button"
  class="crudui-action crudui-action--text" data-condition-action="{action}">`이고, mode select는
  `conditionMode`의 `aria-label`을 가집니다. 편집기 컨트롤에는 `name`이 없으므로 폼은 textarea만 제출합니다.
- **CUMK-068** 편집기가 보여 주지 않는 값(CUSC-086)은 `hidden`이 없는 textarea 앞에 화면 문구
  `conditionInvalid`의 `<p class="crudui-condition__error" role="alert">`를 쓰고, 편집기는 쓰지 않습니다.
  `{path}`는 필드의 데이터 경로입니다.

구조 필드의 위젯 모델은 layout `condition`을 가지며 `condition`을 더합니다. `{ for, judge, fields, labels, root }`에서
`for`는 textarea id, `judge`는 판정 텍스트를 제공하는지 여부, `fields`는 `options.fields`의 목록 또는 `null`,
`labels`는 컨트롤의 화면 문구 `{ mode, addComparison, addGroup, addJudge, remove }`, `root`는 루트 노드입니다.
또는 오류 텍스트가 있는 `{ for, error }`입니다. 노드는 `{ kind: "group", path, mode, items }`, 값 텍스트가 있는
`{ kind: "comparison", path, field, op, value }`, 또는 `{ kind: "judge", path, text }`입니다. `options.fields:
[clues.size]`이고 데이터가 `{ "all": [{ "field": "clues.size", "op": "ge", "value": 2 }] }`인 필드
`opens_when`은 영어로 다음을 씁니다.

```html
<div class="crudui-widget crudui-widget--condition"><textarea name="opens_when" class="valid-target
  crudui-input crudui-input--condition" rows="5" data-crudui-value="json" data-name="opens_when"
  data-rule-name="opens_when" data-default="" id="crudui:opens_when" hidden="">{&quot;all&quot;:[…]}</textarea><div
  class="crudui-condition" data-condition-for="crudui:opens_when"><fieldset class="crudui-condition__group"
  data-condition-path=""><select class="crudui-condition__mode" data-condition-part="mode"
  aria-label="Condition mode"><option value="all" selected="">all</option><option value="any">any</option></select><ol
  class="crudui-condition__list"><li class="crudui-condition__item"><div class="crudui-condition__comparison"
  data-condition-path="/all/0"><select class="crudui-condition__field" data-condition-part="field"><option
  value="clues.size" selected="">clues.size</option></select><select class="crudui-condition__op"
  data-condition-part="op"><option value="eq">eq</option>…<option value="ge" selected="">ge</option>…</select><input
  class="crudui-condition__value" data-condition-part="value" value="2"><button type="button"
  class="crudui-action crudui-action--text" data-condition-action="remove">Remove</button></div></li></ol><button
  type="button" class="crudui-action crudui-action--text" data-condition-action="add-comparison">Add condition</button><button
  type="button" class="crudui-action crudui-action--text" data-condition-action="add-group">Add group</button></fieldset></div></div>
```

## 스위치

`switcher` 필드는 스위치를 렌더링합니다. 노드 모델은 체크박스 필드의 `checkbox` 모델에 `checked` 다음의
`role: "switch"` 멤버를 더해 가지며, 컨트롤 class는 `valid-target crudui-input crudui-input--switch`
다음에 `design.class`의 class가 옵니다. 체크박스 필드에는 `role` 멤버가 없고, 컨트롤 class는
`valid-target` 다음에 `design.class`의 class가 옵니다. 스위치의 input은 `type="checkbox"`를 유지하므로 폼이
체크박스처럼 제출하고 바인딩하며, `role="switch"`를 가지므로 보조 기술이 켜짐 또는 꺼짐으로 알립니다. 모든
렌더러는 `type` 다음에 `role`을, `role` 다음에 선언한 속성을 씁니다. 캡션은 체크박스와 같이 input 자신의
레이블이며, inline [배치](#배치)에서는 예외입니다. 레이블 `Sync`와 데이터 `sync: true`를 가진 필드 `sync`는 다음을 씁니다.

```html
<div class="crudui-node__body"><input class="valid-target crudui-input crudui-input--switch"
  id="crudui:sync" type="checkbox" role="switch" name="sync" checked="" value="1"/><label
  for="crudui:sync">Sync</label></div>
```

스타일시트는 input을 시작 쪽에 둥근 thumb가 있는 트랙으로 그립니다. 트랙은 `--crudui-control-border`
테두리와 `--crudui-subtle` 배경을, thumb는 `--crudui-surface` 색을 가집니다. 스위치가 켜지면 트랙은
`--crudui-accent` 테두리와 배경을 가지고 thumb는 끝 쪽에 있습니다. 포커스된 스위치는 2px
`--crudui-accent` 윤곽선을 가집니다.

## 버튼 필드

`button` 필드와 그 별칭 `action`은 노드 본문에 `button` 요소 하나를 렌더링합니다. 버튼은 `type="button"`,
`crudui-action crudui-action--text` 다음에 `design.class`의 class가 오는 class, `design.style`의 style,
컨트롤의 `id`, `behavior`의 이벤트 속성, 선언한 속성을 이 순서로 가지며, 필드의 `content` 텍스트를
이스케이프한 내용으로 가집니다. `onclick` 같은 `behavior` 스크립트는 다른 모든 컨트롤과 같이 버튼의 이벤트
속성이므로 클릭하면 실행됩니다. CRUDUI는 이 필드에 스크립트, 숨은 input, `name`을 쓰지 않으며 필드는 값을
제출하지 않습니다. 이벤트 속성이 없는 버튼은 `style`을 마지막에 쓰고, 이벤트 속성을 가진 버튼은 모든
컨트롤과 같이 선언된 대로 속성을 씁니다([선언한 속성](#선언한-속성)).

위젯 모델은 배치 `button`, 태그 `button`, 버튼 속성인 `attrs`, 내용 텍스트인 `text`를 가집니다. 레이블을
가진 필드에는 레이블이 버튼을 대상으로 하는 헤더가 있습니다. 레이블이 없는 필드에는 헤더가 없으며, inline
[배치](#배치)에서 그 버튼은 다른 모든 컨트롤과 같이 컨트롤 열의 시작에 놓입니다. 스타일시트는 버튼을 내용만큼
넓고 다른 컨트롤만큼 높게(`--crudui-control-height`) 만듭니다. 레이블 `Sync`, 내용 `Run now`,
`behavior: { onclick: "sync()" }`를 가진 필드 `run`은 다음을 씁니다.

```html
<div class="crudui-node crudui-node--field" data-field-path="run"><div class="crudui-node__header"><label
  class="crudui-node__label" for="crudui:run">Sync</label></div><div class="crudui-node__body"><button
  type="button" class="crudui-action crudui-action--text" id="crudui:run"
  onclick="sync()">Run now</button></div></div>
```

## 행

- **CUMK-031** 번호는 상위 행들의 1부터 시작하는 위치를 `.`으로 연결합니다.
- **CUMK-032** `multiple.title`은 값이 행 제목이 되는 직속 자식을 지정합니다. 값이 비어 있으면
  이름 없음 문구를 표시합니다.
- **CUMK-033** group 행은 접을 수 있습니다. 요약은 행 본문에 직접 있는 컬렉션들의 행 수 합계를
  표시하고, 컬렉션이 없으면 접힘 문구를 표시합니다. 스칼라 행에는 토글, 제목, 요약이
  없습니다.
- **CUMK-034** `multiple: only` 컬렉션의 행에는 행 컨트롤이 없으며 구조 맵에도 표시하지 않습니다.
- **CUMK-035** 컨트롤 순서는 `move-up`·`move-down`(`multiple.sortable`), `add-row`,
  `copy-row`(`multiple.copy`), `remove-row`입니다. 첫 행의 `move-up`과 마지막 행의
  `move-down`은 사용할 수 없습니다. 행 수가 `multiple.max`에 도달하면 `add-row`와
  `copy-row`를, `multiple.min` 이하이면 `remove-row`를 사용할 수 없습니다.
- **CUMK-036** 폼과 구조 맵의 모든 조작 버튼(`data-crudui-action`)은 사용할 수 없는 조작을
  `disabled`가 아니라 `aria-disabled="true"`로 표시합니다. 버튼은 포커스를 받을 수 있고
  클릭해도 아무 일도 하지 않습니다. 포커스된 컨트롤이 비활성화되면 Chromium은 포커스를
  유지하고 WebKit은 해제하므로, `disabled`를 쓰면 포커스가 브라우저와 렌더링 시점에 따라
  달라집니다. 필드 컨트롤의 `disabled`는 선언된 데이터 상태이며 제출에서 제외되므로 그대로
  씁니다.
- **CUMK-037** `multiple.controls`는 행 컨트롤을 행 `header`(기본) 또는 `footer`에 둡니다.
  `outline`이면 행 컨트롤은 구조 맵 줄로 옮겨집니다. 빈 컬렉션의 추가 컨트롤은 행
  컨트롤이 아니므로 컬렉션 푸터에 남습니다.
- **CUMK-038** `multiple.header: sticky`는 `crudui-node--sticky`를 추가하고, 행 루트 스타일이
  `--crudui-sticky-depth`를 상위 고정 행의 수로 설정합니다. 행의 고정선은 그 수에
  `--crudui-node-header-height`에서 행 테두리 한 겹(`--crudui-row-border`)을 뺀 값을 곱한
  값입니다. 고정 행은 CSS만으로 동작하므로 폼이 스크롤되는 곳이 페이지, 프레임, 스크롤 박스
  어디든 같게 동작합니다. 헤더 컨테이너는 고정선에 고정되고 테두리를 포함해 정확히 헤더
  높이이며 줄바꿈하지 않습니다(긴 제목은 줄임표). 헤더 아래의 선은 컨테이너 안에 있는 헤더
  자신의 아래쪽 테두리이므로, 고정된 컨테이너는 바로 위 컨테이너의 선 위에 놓이고 고정된
  단계들은 그 테두리 한 겹을 함께 씁니다. 고정 행은 자신의 위쪽 테두리를 갖지 않습니다.
  카드의 위쪽 선은 고정되는 박스인 헤더 컨테이너 안에서 그려지고, 컨테이너가 고정되는
  동안에는 사라져 바로 위 컨테이너의 선이 이음매가 됩니다. 고정선에 닿는 행은 자기 선을 같은
  위치에 놓으므로, 행이 머무는 어느 위치에서나 이음매는 테두리 한 겹이고 무엇도 덮지
  않습니다. 단계 레이블은 `scroll-state(stuck: top)` 컨테이너 쿼리로 컨테이너가 고정된
  동안에만 보이고, 카드의 위쪽 선은 그동안 사라집니다. scroll-state 쿼리를 지원하지 않는
  브라우저(Firefox, Safari)에서는 `connectForm`이 sticky 위치 지정으로 헤더 컨테이너가 행
  위쪽에서 밀려난 동안 `data-crudui-stuck`을 붙이고, 스타일시트가 이 속성으로 레이블을
  표시하고 카드의 위쪽 선을 숨깁니다. 스크립트가 바꾸는 것은 이 속성뿐이며, 레이아웃을 위해
  행을 측정하거나 스크롤 위치를 옮기지 않습니다. 고정 행 안의 컨트롤은 그 위에 고정되는
  헤더만큼의 위쪽 스크롤 여백(`--crudui-sticky-cover`, 고정선에 헤더 높이 하나를 더한 값)을,
  모든 폼 컨트롤은 푸터 높이만큼의 아래쪽 스크롤 여백을 가집니다. 바인딩이 포커스를 옮길 때는
  스크롤 없이 포커스한 뒤 컨트롤을 필요한 만큼만 보이게 스크롤하므로(`scrollIntoView`,
  `block: 'nearest'`) 모든 엔진에서 이 여백이 지켜져 컨트롤이 이들에 가리지 않습니다.

  sticky 노드는 헤더를 `crudui-node__header-container`로 감쌉니다. 이 래퍼가
  sticky scroll-state 컨테이너이며 카드의 위쪽 선을 담고, `crudui-node__header`는 헤더
  콘텐츠의 레이아웃과 그 아래의 선을 담당합니다. 래퍼가 sticky 배경과 상단 라운드를
  담당합니다. 헤더의 하위 요소에 상태 기반 스타일을 적용하면서 헤더 슬롯의 의미를 바꾸지
  않으려면 이 래퍼가 필요합니다.

## 폼 버튼

스펙은 루트의 `buttons`로 폼 버튼을 선언합니다. `buttons`는 `{ type, text, name, value,
href, design, behavior }` 목록이고 `type`은 `submit`, `reset`, `button`, `link` 중 하나입니다.
`buttons`가 없는 스펙은 제출 버튼 하나를 가집니다. `text`가 없는 제출·초기화 버튼은 유형의
인터페이스 문구를 표시하고, button과 link는 `text`가, link는 `href`가 필요합니다.
`action`(`method`, `url`, `enctype`)은 제출 대상이며 템플릿에 보존합니다. `renderForm`은 이를
[완전한 폼](form-runtime.ko.md#완전한-폼)의 `form` 요소에 씁니다.
두 키는 폼 루트에 속합니다.

모든 폼은 `crudui-form__footer`로 끝나며, 폼 작업 문구를 접근 가능한 이름으로 가진
`crudui-controls` 그룹 하나를 담습니다. `bindButtons(template, data, options)`가 버튼을
평가하고(디자인 클래스와 스타일은 필드 디자인 규칙을 따름), `formButtonsHtml(buttons)`가 유일한
마크업 생성기입니다. link는 `a`, 나머지 유형은 `button` 요소이며 속성 순서는 `type`, `class`,
`style`, `name`, `value`, `href`, `onclick`입니다. 푸터는 고정 행 헤더가 위에 붙듯 스크롤 영역
하단에 `--crudui-form-footer-height` 높이로 붙습니다.

## 구조 맵과 현재 데이터 보기

구조 맵의 규칙은 하나입니다. 맵의 한 줄은 폼의 행 하나입니다. `buildOutline(nodes)`은
폼의 행과 각 행에 중첩된 행을 반환하므로 맵은 폼과 똑같이 중첩되며, 컬렉션·개수·빈
컬렉션은 행이 아니므로 폼에만 남습니다. 각 행은 번호와 제목을 담은 `select-row` 버튼을
가집니다. 중첩된 행 본문은
한 단계 들여씁니다. 헤더에는 `expand-all`,
`collapse-all`, `undo`, `redo`를 둡니다(각 방향의 이력이 없으면 사용할 수 없음). React, Vue, Svelte는
`Outline`과 `DataView`를, `bindForm`으로 직접 관리하는 데이터에는
상태 없는 `OutlineView`와 `DataPanel`(Vue: `outlineVNode`, `dataVNode`)을, HTML 렌더러는 `renderOutline(form)`과 `renderData(form)`, `bindForm`용
`renderOutlineView(state, messages)`와 `renderDataPanel(data, messages)`를 제공합니다.
네 렌더러 모두 공유 [구조 맵 사례](../../tests/fixtures/form-outline/cases.json)를 재현합니다. `connectForm`은 폼 안의 작업을 실행합니다.
`connectOutline(element, form, formElement)`는 구조 맵의 작업을 실행하고, `select-row`
버튼이 가리키는 폼 행의 첫 컨트롤에 포커스하고, 그 컨트롤을 고정 헤더와 푸터에 가리지 않게 스크롤합니다.

## 화면 문구

- **CUMK-065** 모든 구현은 `contracts/interface-messages.json`에서 생성한 소스를 담고, 담은 문구가 파일과 다르면 테스트가 실패하므로 모든 구현이 같은 문구를 사용합니다.

컨트롤 레이블, 개수, 요약은 `ko`, `en`, `ja`, `zh` 문구 표 하나,
[`contracts/interface-messages.json`](../../contracts/interface-messages.json)에서
가져옵니다. 모든 구현은 이 파일에서 생성한 소스를 담고, 담은 문구가 파일과 다르면
테스트가 실패하므로 모든 구현이 같은 문구를 사용합니다. 작성자는 이 문구를 바꾸지
않습니다. 비어 있는 행 제목처럼 데이터에 딸린 문구는 작성자가 선언합니다
([스키마](schema.ko.md) 참고). 바인딩은 문자열이 아닌 언어를 `Language must be a string`으로,
그다음 문자열이 아닌 `keyPrefix`·`idPrefix`를 `{name} must be a string`으로, 그다음
`throw`나 `marker`가 아닌 `unsupported`를 `unsupported must be throw or marker`로,
그다음 그 밖의 언어를 `Unsupported language: {language}`로 거부합니다. 없거나 null인
옵션은 기본값을 씁니다.

## 스타일

`@polyspec/crudui-generator-core/crudui.css`는 폼에 필요한 유일한 스타일시트로 슬롯 배치, 행 카드,
위젯, 컨트롤 아이콘, 고정 헤더, 구조 맵, 현재 데이터 보기를 정의합니다. box-sizing과
`[hidden]` 요소 숨김을 포함한 모든 규칙은 crudui 블록 범위 안에 있으며 페이지 스타일이나 CSS
프레임워크에 기대지 않습니다. 페이지는 자기 레이아웃만 스타일링하고 crudui 블록 안은 건드리지
않습니다.

폼, 구조 맵, 현재 데이터 보기, 목록, 상세는 `--crudui-*` 사용자 정의 속성 한 벌을 공유합니다.
규칙 하나 `:where(.crudui-form, .crudui-outline, .crudui-data, .crudui-list, .crudui-detail)`가
명시도 0으로 기본값을 선언하고, 다른 규칙은 색을 쓰지 않습니다. 페이지는 블록을 선택해 속성을
정하는 규칙으로 블록의 테마를 정합니다. 예: `.crudui-form, .crudui-list { --crudui-accent: … }`.
이 규칙은 스타일시트 순서와 관계없이 기본값보다 우선합니다.

- `--crudui-*` 사용자 지정 속성과 기본값, 쓰임은 스타일시트 `crudui.css`와 함께 `packages/generator/ts/README.ko.md`에 문서화되어 있습니다.

`--crudui-node-header-height`, `--crudui-row-padding`, `--crudui-row-border`,
`--crudui-form-footer-height`는 고정 행과 폼 바닥글의 크기를 정합니다(위 참조).
`tests/style-properties.test.mts`는 속성 규칙, 규칙이 읽는 모든 속성이 선언되었는지, 다른 규칙이
색을 쓰지 않는지 검사합니다.

### Viewport 폭

`crudui.css`는 360 CSS pixel 이상의 모든 viewport 폭에서 모든 block을 배치합니다. viewport 폭
360과 1280에서, 공유 render fixture(`tests/fixtures/form-render`, `form-complete`, `list-render`,
`detail-render`)의 모든 case의 expected HTML을 `crudui.css`만 있는 page에 두었을 때 문서의 가로
overflow가 생기지 않습니다. 곧 document element의 scroll width가 viewport 폭보다 크지 않습니다.
모든 control(`input`, `select`, `textarea`, `button`)과 모든 action은 viewport 안에 있습니다. 다만
list의 table처럼 스스로 가로로 scroll하는 element(`overflow-x`가 `auto`나 `scroll`) 안은 viewport보다
넓을 수 있습니다. list는
스스로 가로로 scroll하므로, 넓은 table이 page를 넓히지 않습니다. `tests/viewport.test.mts`는 Chromium,
Firefox, WebKit에서 모든 case를 두 폭으로 검사합니다.

### Tailwind CSS

Tailwind CSS 4로 꾸미는 page는 `tailwindcss` 뒤에 `@polyspec/crudui-generator-core/crudui.css`를
cascade layer `components`로 import합니다: `@import "@polyspec/crudui-generator-core/crudui.css" layer(components);`.
`crudui.css`의 rule은 그 layer 안에서 바뀌지 않으므로, 더 뒤의 layer `utilities`에 있는 page의 utility class가
CRUDUI rule보다 우선합니다. markup은 같습니다. 이 stylesheet에서 생성된 복사본은 없습니다. page는
`crudui.css`와 같이 `--crudui-*` property로 block의 theme을 정합니다. 예를 들어 Tailwind theme의 색을 쓸
수 있습니다: `.crudui-form, .crudui-list { --crudui-accent: var(--color-indigo-600); }`.

최신 stable Tailwind CSS의 theme과 utility로 compile하고 다른 stylesheet가 없을 때,
그 import는 viewport 폭 360과 1280에서 모든 공유 render fixture의 expected HTML의 모든
element에 `crudui.css`와 같은 computed style(custom property 제외)을 줍니다.
`tests/tailwind-styles.test.mts`가 Chromium, Firefox, WebKit에서 둘을 비교합니다.

## 목록·상세 마크업

표시 결과도 폼 결과와 같은 블록·요소·수식자 문법을 사용합니다. 목록 루트는
`crudui-list`이고 설명, 표, 제목, 셀, 카드, 빈 상태, 동작과 페이지 이동은 각각
`crudui-list__description`, `crudui-list__table`, `crudui-list__heading`, `crudui-list__cell`,
`crudui-list__cards`, `crudui-list__card`, `crudui-list__empty`,
`crudui-list__actions`, `crudui-list__action`, `crudui-list__pagination`을
사용합니다. 페이징 탐색에는 `crudui-list__pagination-prev`,
`crudui-list__pagination-page`, `crudui-list__pagination-next` 버튼이 포함됩니다.
각 버튼은 `data-page`를 가지며 현재 페이지는 `aria-current="page"`와 비활성화를
사용합니다. 첫 페이지의 이전 버튼과 마지막 페이지의 다음 버튼은 비활성화됩니다.
매우 큰 전체 수에서도 무한한 DOM을 만들지 않도록 페이지 번호는 제한된 범위로
출력합니다. 상세 루트는 `crudui-detail`이고 필드마다
`crudui-detail__field`, `crudui-detail__label`, `crudui-detail__value`를
사용합니다. 상세의 동작은 `crudui-detail` 요소 앞의 `crudui-detail__actions`에 동작마다
`crudui-detail__action` 하나로 씁니다([표시 형식](display-formats.ko.md#마크업)).

표시 값은 모두 `crudui-value`와 닫힌 형식 수식자
`crudui-value--text`, `--date`, `--number`, `--choice-label`, `--badge`,
`--link`, `--bool`, `--image`, `--html`을 함께 가집니다. 배지 변형은 클래스명이
아닌 데이터이므로 변형이 있으면 `crudui-badge`에
`data-crudui-variant`를 기록합니다. 불리언 표시는 `crudui-bool`과 닫힌
`--text`, `--check`, `--icon` 수식자를 사용하고
`data-crudui-state="true|false"`를 기록합니다. CSS는 이 속성을 스타일링할 수
있으며 스크립트는 표시 클래스로 동작을 추론하지 않고 선언된 데이터와 ARIA
속성을 읽습니다.

## 기준 폼에서 채택하지 않은 동작

이 문법의 기준이 된 폼과 다음을 의도적으로 다르게 정했습니다.

1. TypeScript 렌더러의 준비와 스크롤 동작(렌더링 후 동기화, scroll과 resize에서 애니메이션 프레임당 최대 한 번 표시되는 고정 헤더)은 `packages/generator/ts/README.ko.md`에 문서화되어 있습니다.

2. **CUMK-057** 펼침 상태는 레코드 데이터가 아닌 뷰 상태입니다.
3. **CUMK-058** 행은 배열 위치가 아닌 키로 식별합니다.
4. **CUMK-059** 깊이에 제한이 없으며 깊이별 컴포넌트 대신 재귀 노드 하나를 사용합니다.
5. **CUMK-060** `multiple.max`를 적용합니다.
6. **CUMK-061** 되돌리기는 모든 데이터 변경을 기록하며 같은 경로의 연속 입력을 병합합니다.
7. **CUMK-062** 고정 헤더와 레이블은 CSS만으로 동작합니다. 스크롤 위치를 따르는 스크립트가 없으므로
   스크롤하는 동안 아무것도 실행하거나 렌더링하지 않습니다.
8. **CUMK-063** 행에는 번호 하나만 표시하며 별도 위치 표기는 없습니다.
9. **CUMK-064** 배치 옵션은 설정 패널이 아닌 명세에 선언합니다.
