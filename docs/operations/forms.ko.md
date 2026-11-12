# 폼 개발과 검증
<!-- doc-id: docs-operations-forms -->
<!-- source-sha256: 804502b13fcebec41345ea973bf7def992229f5b01b4692824c4313a4c865efc -->

[English](forms.md). 계약은 [폼 런타임](../spec/form-runtime.ko.md)에 정의합니다.

## 설치

저장소 루트에서 명령을 실행합니다. Node.js와 npm을 설치한 후 실행합니다.

```sh
make install-tools TOOLS=npm
make install-packages
make install-tools
export PATH="$PWD/var/tools/bin:$PATH"
npm ci --strict-allow-scripts
npm run build
```

의존성을 갱신할 때는 npm으로 패키지 선언의 버전 범위를 해석하고 잠금 파일을
갱신합니다. 결과 의존성 그래프를 검토하고 아래 검사를 실행합니다.
설치 스크립트 변경을 검토하고 `npm install-scripts approve <package>`로 독립
그래프의 루트 `allowScripts` 필드에 정확한 버전을 기록합니다.
기존 설치에서 새로 승인한 스크립트를 실행하려면 `npm rebuild`를 실행합니다.

4개 언어 검증에는 Composer 의존성을 설치한 PHP, Go, Rust가 필요합니다.
`legacy/packages/validator/php`에서 `composer install`로 PHP 의존성을 설치합니다.
로컬에 이 도구들이 있으면 컨테이너는 필요하지 않습니다.

## 데이터 로드 전 구성

```tsx
import { compileForm, createForm, sequenceRowKey } from '@polyspec/crudui-generator-core';
import { Form } from '@polyspec/crudui-generator-react';

const template = compileForm({
  type: 'group',
  properties: {
    stores: {
      type: 'group', multiple: { copy: true, sortable: true },
      properties: { name: { type: 'text', validate: { required: true } } },
    },
  },
}, { keyPrefix: 'form' });
const cached = JSON.stringify(template);
const form = createForm(JSON.parse(cached));

function StoreForm() {
  return <Form form={form} />;
}

form.setData({ stores: { [sequenceRowKey(42)]: { name: 'Store' } } });
const copied = form.copyRow('stores', sequenceRowKey(42));
form.rekeyRow('stores', copied, sequenceRowKey(43));
const submission = form.getData();
```

공유 캐시에는 템플릿을 저장하고 렌더링할 폼마다 독립적인 폼 인스턴스를 생성합니다.
레코드 로드가 완료되면 `setData`를 호출합니다. Vue와 Svelte도 `form` 속성을
받습니다. 프레임워크 패키지는 동일한 코어 함수를 제공합니다.
React는 `@polyspec/crudui-generator-react/server`에서 SSR용 `renderForm(form)`을 내보냅니다.
Vue와 Svelte는 패키지 진입점에서 렌더 함수를 내보내며 Vue는 Promise를 반환합니다.
`$ref` 파일은 렌더링 전에 컴파일합니다.

서버는 [완전한 폼](../spec/form-runtime.ko.md#완전한-폼)을 보냅니다. 폼 요소, 숨은 필드, 입력한 값,
오류, 버튼이 한 번의 호출에서 나오므로 폼의 어떤 부분도 따로 쓰지 않습니다. 검증 결과의
오류를 그대로 전달하거나 자체 문구로 바꿔 전달합니다.

```ts
import { validate } from '@polyspec/crudui-validator';
import { renderForm } from '@polyspec/crudui-generator-html';

const result = validate(spec, submitted);
const form = createForm(template, submitted, { language: 'en' });
const html = renderForm(form, {
  action: { method: 'post', url: '/members' },
  hidden: { _csrf: token },
  formErrors: result.valid ? [] : ['Check the marked fields.'],
  errors: result.errors,
});
```

PHP는 같은 멤버로 `Generator::renderForm($form, $options)`를 호출하고, Go는 `RenderForm(form, options)`,
Rust는 `render_form(&form, Some(&options))`를 순서 있는 JSON 객체로 호출합니다. 브라우저 바인딩은
`form` 요소가 아니라 `crudui-form` 요소에 연결합니다. `connectForm`은 자기 요소 안의 이름 있는 모든
컨트롤을 인스턴스 데이터와 동기화합니다.

프레임워크에 독립적인 HTML은 동등한 renderer 패키지를 사용합니다.

```ts
import { connectForm, patchContent } from '@polyspec/crudui-generator-core';
import { renderForm, renderList } from '@polyspec/crudui-generator-html';

patchContent(host, renderForm(form));
const connection = connectForm(host, form);
form.subscribe(() => {
  patchContent(host, renderForm(form));
  connection.sync();
});
const listHtml = renderList(listSpec, rows, { layout: 'table' });
```

`patchContent`는 호스트의 내용을 새 마크업으로 바꾸되 새 마크업에도 있는 노드는 모두 유지합니다.
그래서 다시 그려도 포커스된 컨트롤, 선택 영역, 입력기 조합이 유지되며, 이어서 `connection.sync()`가
컨트롤의 현재 값을 설정합니다. 새 마크업의 스크립트는 그 마크업이 자리를 잡은 뒤 한 번 실행되고, 유지한
스크립트는 다시 실행되지 않습니다([스크립트 규칙](../spec/form-runtime.ko.md)). 클라이언트의 첫
마크업도 `patchContent`로 그립니다. `innerHTML`로 넣은 마크업의 스크립트는 실행되지 않습니다.
HTML renderer는 fragment를 반환하며 외부 `form` 요소를 만들거나 브라우저 이벤트를
연결하거나 데이터를 검증하거나 레코드를 로드하지 않습니다.

`@polyspec/crudui-validator`의 `validate(spec, submission)`로 원본 명세에 대해 `submission`을 검증합니다.
서버가 저장된 seq를 생성하면 해당 컬렉션 경로의 키를 변경합니다.
데이터 객체 전체에서 토큰을 치환하지 않습니다.

## 검사

```sh
npm run test:forms
npm test -w @polyspec/crudui-validator
make docs-check
```

서버 검증 사례는 저장소 루트에서 실행합니다.

```sh
COMPOSER_VENDOR_DIR=../../../vendor node node_modules/@polyspec/kit/dist/run-tests.mjs phpunit --cwd legacy/packages/validator/php -- --filter ValidateConformanceTest
node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd legacy/packages/validator/go -- ./validator/validate
node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml --test validate_conformance
```

`test:forms`는 현재 패키지를 빌드하고 코어, SSR, 마운트한 DOM 테스트를 실행합니다.
공유 DOM 시나리오는 지연 데이터 주입, 편집, 중첩 행 연산, 저장된 키, 체크박스,
날짜, 언어 필드, 조건부 표시를 검사합니다. DOM 테스트는 jsdom을 사용하며 외부
편집기나 브라우저 파일 선택기의 동작을 검증하지 않습니다.
`tests/form-styles.test.mts`는 `crudui.css`의 레이아웃을 Chromium, Firefox, WebKit에서
검사합니다. sticky 헤더 쌓임, 단계 레이블과 그 `data-crudui-stuck` 대체 경로, 테두리 한 겹의
이음매, 행 카드의 선, 포커스 스크롤을 페이지, 스크롤 상자, 프레임에서 각각 확인합니다. 모든
엔진이 같은 시나리오를 실행하며, Chromium과 Firefox는 Puppeteer로, WebKit은 Playwright로
구동하며, 각각 잠긴 package가 고정한 build를 씁니다. `node scripts/install-browsers.mts chrome firefox
webkit`이 그것들을 설치합니다(Linux에서는 WebKit에 `--with-deps`). 브라우저가 없으면 실행이 그것을 설치하는
명령과 함께 실패하며 어떤 엔진도 건너뛰지 않습니다. `packages/form-binding/tests/browser.test.ts`의
[브라우저 검증](validation.ko.md#브라우저-검증) 검사도 같은 세 엔진에서 실행합니다.
`tests/viewport.test.mts`는 공유 render case 432개의 expected HTML을 360과 1280 CSS pixel로 열어 문서의
가로 overflow가 없는지 확인하고, `tests/tailwind-styles.test.mts`는 `crudui.css`를 layer `components`로 import한 것을 Tailwind CSS로
compile해 `crudui.css`의 computed style과 같은지 확인합니다. 둘 다 같은 세 엔진에서 실행합니다.
`crudui.css`에서 생성되는 file은 없으므로, `crudui.css`를 바꿔도 함께 commit할 다른 file은 없습니다.
`tests/widget-script-runs.test.mts`는 같은 세 엔진에서 HTML, React, Vue, Svelte 렌더러를 브라우저에서
렌더링한 경우와 서버에서 렌더링한 뒤 하이드레이션한 경우로 스크립트 규칙을 실행합니다. 폼 행 스크립트와
`html` 목록 셀 스크립트는 첫 렌더링과 추가한 각 행에서 한 번 실행되고, 입력, 행 복사나 이동, 다시
로드, 목록 다시 그리기에서는 실행되지 않습니다. 목록 스크립트 동작의 스크립트는 그 button을 누를 때마다
실행됩니다.
현재 결과는 [기능 상태](../features.ko.md)와 [변경 기록](../../CHANGELOG.ko.md)에 기록합니다.

Svelte 패키지 빌드는 JavaScript, 전처리한 Svelte 컴포넌트, TypeScript 선언을
`dist`에 생성합니다. 공개 export는 패키지에 포함된 파일을 사용합니다.
패키지를 빌드하는 프로젝트는 브라우저 또는 SSR 대상에 맞게 컴포넌트를 컴파일합니다.

`npm run test:packages`는 JavaScript 패키지 전체를 빌드·패키징하고 별도 설치
프로젝트에 설치합니다. export 파일과 타입 선언을 검사하고 세 폼 컴포넌트를
사용하는 프로덕션 번들을 컴파일합니다. 설치 프로젝트는 `scripts/install-lock.mts`가 루트
`package-lock.json`에서 만든 lock으로 `npm ci --offline`을 실행해 설치합니다. 이 lock은 패키징한 패키지를
`file:` tarball로, npm이 설치 프로젝트에 resolve하는 모든 registry 패키지를 루트 lock 항목으로 담으므로, 설치 프로젝트는
`make install`의 npm cache에서 루트 lock의 release를 설치하고 registry에 range를 묻지 않습니다. 통과한 검사는 임시 설치 프로젝트를
삭제합니다. 실패한 검사는 `failure.log`와 함께 프로젝트를 남기고 경로를 출력합니다.

## 패키지 타입 선언 검사

JavaScript 번들러는 런타임 모듈을 생성합니다. TypeScript 컴파일러는 번들러와
별도로 공개 진입점에서 `noEmitOnError`를 적용해 선언을 생성합니다.
Svelte 컴포넌트와 선언은 패키지 컴파일러를 사용합니다.

```sh
npm run test:build
npm run test:build:repeat
npm run test:packages
```

검증 범위는 [패키지 빌드 계약](package-build.ko.md)과
[빌드 검사](../../tests/build/README.ko.md)에 정의합니다.
