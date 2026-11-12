# 폼 구조 미리보기
<!-- doc-id: examples-form-structure-readme -->
<!-- source-sha256: 2d121b54393660f702eb4eaed3b7c01258a68840d87b50a2048d9441ba889e66 -->

[English](README.md).

이 예제는 회사, 스토어, 부서, 팀, 멤버로 이어지는 5단계 기준 폼의 로컬 Vite
미리보기입니다. 모든 단계는 고정 헤더, 행 제목, 이동 컨트롤을 갖춘 반복 그룹이며
스토어, 팀, 멤버는 복사도 할 수 있습니다. 폼은 취소 링크와 저장 버튼을 선언합니다.

페이지는 세 열로 구성됩니다.

- **구조 맵** — `@polyspec/crudui-generator-html`의 `renderOutline` 출력을 `connectOutline`으로
  연결합니다. 모든 행을 펼치거나 접고, 변경을 실행취소·실행복귀하며, 선택한 행의 첫 컨트롤로
  폼 안의 포커스를 옮깁니다.
- **폼** — `renderForm` 출력을 `connectForm`으로 연결해 입력과 추가·복사·이동·제거
  같은 행 조작을 처리합니다.
- **데이터** — 현재 폼 데이터를 보여 주는 `renderData` 출력입니다.

`main.js`는 `compileForm`으로 명세를 컴파일하고 `createForm`으로 한국어 폼을 만든
뒤 폼이 바뀔 때마다 세 화면을 다시 렌더링합니다. 폼, 구조 맵, 데이터 화면의 스타일은
모두 `legacy/packages/generator/ts/styles/crudui.css`에서 가져오며, `index.html`의 인라인
스타일은 열 배치만 담당합니다.

| 파일 | 내용 |
| --- | --- |
| [spec.yml](spec.yml) | 폼 명세 |
| [data.json](data.json) | 저장된 행 키를 가진 초기 keyed 데이터 |
| [index.html](index.html) | 페이지 배치와 마운트 위치 |
| [main.js](main.js) | 컴파일, 렌더링, 연결 |

## 실행

미리보기는 빌드된 `@polyspec/crudui-generator-core`와 `@polyspec/crudui-generator-html` 패키지를
가져오고 core 패키지는 빌드된 `@polyspec/crudui-validator`를 가져오므로 먼저 빌드합니다.
저장소 루트에서 실행합니다.

```sh
npm install
npm run build
npx vite examples/form-structure
```

Vite가 출력하는 URL을 엽니다. 기본값은 http://localhost:5173/ 입니다. 패키지 소스를
바꾸면 다시 빌드합니다.

이 미리보기는 로컬 Vite 개발 서버에서만 실행합니다. 배포하지 않으며 저장 버튼을
받는 서버도 없습니다.
