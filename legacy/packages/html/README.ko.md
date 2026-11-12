# @polyspec/crudui-generator-html
<!-- doc-id: packages-generator-html-readme -->
<!-- source-sha256: f836dd954664f15c085d91eda76dc20dfc9ddc2864e89029b0f66dfd98897101 -->

[English](README.md).

CRUDUI 폼 인스턴스와 목록·상세를 프레임워크 없이 HTML로 렌더링합니다.

```ts
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderForm } from '@polyspec/crudui-generator-html';

const template = compileForm({ type: 'group', properties: { name: { type: 'text' } } });
const form = createForm(template, { name: 'Example' });
const html = renderForm(form);
```

renderer는 평가된 core 모델을 소비하고 HTML을 반환합니다. `renderForm(form, options)`은
[완전한 폼](../../../docs/spec/form-runtime.ko.md#완전한-폼)을 씁니다. `options.action`이 있으면 `form` 요소와
`options.hidden` input을 만들고 `options.formErrors`와 `options.errors`를 배치합니다. 옵션이 없으면
`crudui-form` 블록을 반환합니다. 브라우저 이벤트를 연결하거나 데이터를 검증하거나 레코드를 로드하지
않습니다. 브라우저 편집이 필요하면 마크업을 삽입한 뒤 `crudui-form` 요소에
`@polyspec/crudui-generator-core`의 `connectForm`을 사용합니다.

데이터를 `bindForm`으로 직접 관리할 때는
`renderFormView(bindForm(template, data, options), bindButtons(template, data, options), formMessages(language), renderOptions, formDescription(template, options))`로
같은 마크업을, `renderOutlineView`와 `renderDataPanel`로 구조 맵과 데이터 보기를 렌더링합니다.

`renderList(spec, rows, { layout: 'table' | 'card' })`는 평가된 목록을 렌더링합니다.
`renderDetail(spec, record)`는 전달한 레코드 하나를 읽기 전용 상세로 렌더링합니다.
`renderOutline(form)`과 `renderData(form)`는 폼 인스턴스의 구조 맵과 데이터 보기를 렌더링합니다.
패키지 진입점은 이 여덟 렌더 함수입니다.

- [런타임 계약](../../../docs/spec/form-runtime.ko.md)
- [폼 작업](../../../docs/operations/forms.ko.md)

## 블록 마크업

- `crudui-outline`: `__header` 폼 컨트롤과 `__body` 노드를 가진 구조 맵입니다.
- `crudui-data`: `__header`와 `pre` `__body`를 가진 현재 데이터 보기입니다.

## 렌더링한 마크업의 스크립트

렌더링한 마크업의 스크립트는 모든 렌더러(HTML, React, Vue, Svelte)의 폼, 목록, 상세에서 그
마크업이 처음 나타날 때 한 번 실행됩니다.

- 서버에서 렌더링한 마크업: 브라우저가 페이지를 파싱하면서 스크립트를 실행합니다. 하이드레이션은
  파싱한 노드를 유지하고 스크립트를 다시 실행하지 않습니다.
- 클라이언트에서 렌더링한 마크업, 새 행, 새 목록 행: 마크업을 삽입할 때, 그 마크업의 나머지가 자리를
  잡은 뒤 스크립트가 실행되므로 스크립트는 뒤따르는 컨트롤을 찾습니다.
- 다시 그리기, 같은 값의 데이터 로드, 행 이동, 스크립트 텍스트 변경은 유지한 스크립트를 다시
  실행하지 않습니다.

## 다시 그려도 컨트롤 유지

- 다시 그려도 폼, 목록, 상세의 컨트롤, 버튼, 스크립트, 스타일, 원시 내용 노드를 모두 유지하고,
  Chromium, Firefox, WebKit에서 각 스크립트가 마크업이 처음 나타날 때 한 번 실행되는지 확인합니다.
