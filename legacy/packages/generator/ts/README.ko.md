# @polyspec/crudui-generator-core
<!-- doc-id: packages-generator-core-readme -->
<!-- source-sha256: fef3959995efa68b8c737b17716243a2b7bbd560182668962c92c8660355b0d5 -->

[English](README.md).

프레임워크에 의존하지 않는 폼 컴파일, 편집 세션, 목록 평가를 제공합니다.

```ts
import { compileForm, createForm } from '@polyspec/crudui-generator-core';

const template = compileForm({
  type: 'group', properties: { name: { type: 'text' } },
});
const session = createForm(template);
session.setData({ name: 'Example' });
```

공유 템플릿마다 한 번 컴파일하고 폼 인스턴스마다 세션을 생성합니다.
편집 세션 없이 필드를 평가하려면 `bindForm(template, data)`를 사용합니다.

패키지 진입점은 공개 API입니다. 폼 컴파일과 바인딩(`compileForm`, `bindForm`,
`bindButtons`, `formButtonsHtml`), 폼 인스턴스(`createForm`, `FormInstance`, `createRowKey`,
`sequenceRowKey`, `formMessages`), 보기 상태와 이력 함수, 목록·상세·구조 맵 모델(`buildList`,
`buildDetail`, `buildOutline`), 브라우저 연결(`connectForm`, `connectOutline`,
`connectStickyHeaders`, `patchContent`, `resolveAction`, `runAction`), API가 던지는
오류(`ComposeLoadError`, `FormInputError`, `UnsupportedFieldTypeError`)를 내보냅니다. 스타일시트는
`@polyspec/crudui-generator-core/crudui.css`입니다.

`@polyspec/crudui-generator-core/internal`은 CRUDUI 렌더러 패키지가 공유하는 도우미입니다. 공개 API로
지원하지 않으며 렌더러와 함께 바뀝니다.

- [런타임 계약](../../../../docs/spec/form-runtime.ko.md)
- [설치, 중첩 행, 검증](../../../../docs/operations/forms.ko.md)
- [기능 상태](../../../../docs/features.ko.md)

저장소 루트에서 `npm run test:forms`로 모든 어댑터를 빌드하고 테스트합니다.

## 스타일시트 사용자 지정 속성

- `--crudui-text` — 기본값: `#111827`; 쓰임: 모든 블록의 글자색
- `--crudui-muted` — 기본값: `#6b7280`; 쓰임: 설명, 개수, 접사, 상세 레이블
- `--crudui-border` — 기본값: `#e5e7eb`; 쓰임: 행, 목록, 상세, 동작의 테두리
- `--crudui-surface` — 기본값: `#ffffff`; 쓰임: 컨트롤, 행, 동작의 배경
- `--crudui-subtle` — 기본값: `#f9fafb`; 쓰임: 행 헤더, 목록 제목 칸, 접사, 읽기 전용 컨트롤의 배경
- `--crudui-accent` — 기본값: `#1d4ed8`; 쓰임: 포커스 윤곽선, 선택된 선택지, 켜진 스위치의 트랙
- `--crudui-error` — 기본값: `#b91c1c`; 쓰임: 폼 오류와 노드 오류의 텍스트
- `--crudui-on-accent` — 기본값: `#ffffff`; 쓰임: 선택된 선택지의 글자색
- `--crudui-action-text` — 기본값: `#374151`; 쓰임: 동작의 글자와 아이콘 색
- `--crudui-action-size` — 기본값: `1.75rem`; 쓰임: 아이콘 동작의 너비와 높이, 글자 동작의 높이
- `--crudui-control-border` — 기본값: `var(--crudui-border)`; 쓰임: 컨트롤, 접사, 위젯 버튼, 선택지의 테두리
- `--crudui-control-height` — 기본값: `2.25rem`; 쓰임: 컨트롤과 선택지의 최소 높이
- `--crudui-radius` — 기본값: `0.375rem`; 쓰임: 컨트롤, 접사, 선택지, 동작의 모서리 반지름
- `--crudui-submit-background` — 기본값: `var(--crudui-surface)`; 쓰임: 폼 바닥글 제출 버튼의 배경
- `--crudui-submit-border` — 기본값: `var(--crudui-border)`; 쓰임: 폼 바닥글 제출 버튼의 테두리 색
- `--crudui-submit-text` — 기본값: `var(--crudui-action-text)`; 쓰임: 폼 바닥글 제출 버튼의 글자색
- `--crudui-label-width` — 기본값: `10rem`; 쓰임: inline 배치의 레이블 열 너비

## 준비와 스크롤

준비 폴링과 시간 기반 스크롤 잠금 대신 렌더링 후 동기화를 사용합니다. 고정 헤더의 고정 상태는 scroll과 resize 이벤트에서 애니메이션 프레임당 최대 한 번 측정하며, 행 높이와 관계없이 동작합니다.
