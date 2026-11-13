# 폼 렌더링 고정 사례
<!-- doc-id: tests-fixtures-form-render-readme -->
<!-- source-sha256: 003a0a779086e6dfc1d7c80223b014508cc577984f3c0a155d9dd50b6a1fe472 -->

[English](README.md).

React·Vue·Svelte 레이아웃 일치 검사는 `cases.json`을 공유합니다. 각 사례는
이름, 명세, 선택적 데이터와 옵션, `expected_html` 또는 `expectError`를
포함합니다. 생성기는 정규화한 출력을 비교하거나 기록된 오류를 확인합니다. `expectError`는 `code`와
`message`를 담고, 모든 binding이 둘 다 비교합니다.

이 사례는 내부 `renderFields`의 평가와 렌더링 경로를 검사합니다. 외형, 조건,
합성, 번역 콘텐츠, 언어 입력, 반복과 위젯 출력을 포함하며, `multiple: only` 컬렉션(행 컨트롤 없이
데이터 키로 렌더링하는 행, 헤더와 빈 본문만 있고 행 추가 컨트롤이 없는 비어 있거나 데이터가 없는
컬렉션), 값을 유지하는 숨긴 그룹, select·choice·multichoice·search·dummy 필드의 선택 목록과 잘못된 선택
목록의 바인딩 실패, select·multichoice 필드가 반복 그룹의 행에서 가져오는 옵션과 그룹 소스의 컴파일 실패, 행보다 먼저 나열되는 그룹 소스의 리터럴 선택지와 그것을 반복하는 행의 바인딩 실패, option이 없는 select나 search 필드의 placeholder option, 보여 주지 않는 값의 이름 있는 오류와 `design.editor`, `options.fields`의 컴파일 실패를 포함한 구조 조건 편집기, `crudui-form` 블록의 첫 자식인 번역한 루트 설명도 검사합니다. 반복 사례
데이터는 [폼 런타임](../../../../docs/spec/form-runtime.ko.md)에 정의된 키 기반
컬렉션을 사용합니다.

## 정규화

`normalize.mts`는 parse5로 HTML을, PostCSS로 인라인 스타일을 파싱합니다.
속성을 정렬하고 HTML 불리언 속성과 CSS 선언을 정규화하며 주석, 빈 class/style
속성, 서식 보존 요소 밖의 공백만 있는 텍스트 노드를 제거합니다.
`pre`, `textarea`, `script`, `style` 내부 텍스트는 보존합니다. 필드 이름,
행 키, ID, 값과 숨김 상태는 마스킹하지 않습니다.

정규화한 레이아웃의 일치는 HTML 원문의 일치를 증명하지 않습니다.
[폼 검사기](../../../../tests/form-inspector/form-snapshot.mts)는 초기 데이터와
나중 주입의 HTML 원문, DOM, CSS, 입력과 런타임 상태를 별도로 비교합니다.

## 생성과 검증

패키지를 빌드한 후 저장소 루트에서 실행합니다.

```sh
node_modules/.bin/tsx packages/react/scripts/generate-form-render-cases.mts
npm run test:forms
```

생성 스크립트는 React 내부 `renderFields` 함수를 레이아웃 기준으로 사용하고
출력을 정규화합니다. 이 스크립트는 [`scenario-form-render-cases.ts`](../../../../packages/react/scripts/scenario-form-render-cases.ts)의 시나리오와 위젯 사례를
렌더링하고 [`written-form-render-cases.ts`](../../../../packages/react/scripts/written-form-render-cases.ts)의 사례를 추가합니다. 후자의 `expected_html`은 명세에서 작성하며 렌더링으로 만들지 않습니다.
사례는 시나리오, 그 뒤 위젯 사례와 작성한 사례의 순서이며 각각 source의 순서를 따르고, 같은 이름의 위젯 사례나 작성한 사례는 시나리오의 자리를 대신합니다.
적용 전에 생성된 변경을 검토해야 하며 재생성만으로 정확성을 확인할 수는 없습니다.
세 프레임워크의 일치 검사가 모두 통과해야 합니다.
