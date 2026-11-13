# 기능 상태
<!-- doc-id: docs-features -->
<!-- source-sha256: 9423c2b689bbe56b0a644889058dddb18f4e38c225ca398eb4b58998c04272cb -->

[English](features.md). 계약은 [명세](spec/form-runtime.ko.md)에 정의합니다.
테스트와 배포를 별도로 기록합니다. `pending`은 통과 결과가 아닙니다.

| ID | 기능 | 구현 | 검증 | 배포 | 근거 |
| --- | --- | --- | --- | --- | --- |
| condition-trees | 필드 값이 all, any, 필드 비교, 판정 문장으로 이루어진 조건 트리인지 여섯 검증기에서 검사하는 `conditionTree` 규칙 | implemented | passed | not-deployed | [조건 트리](spec/schema.ko.md#조건-트리), [검증 규칙](spec/validation-rules.ko.md#조건-트리), [공유 사례](../tests/fixtures/validate/condition-tree.mts) |
| condition-control | textarea가 조건 트리를 JSON 텍스트로 담는 `condition` 필드를 여덟 렌더러가 렌더링하고, `connectForm`과 브라우저 검증이 트리로 다시 디코딩하며, 필수 `conditionTree` 규칙이 검사한다 | implemented | passed | not-deployed | [명세](spec/schema.ko.md#조건-필드), [폼 마크업](spec/form-markup.ko.md#조건-필드), [조건 값](spec/form-runtime.ko.md#조건-값); [공유 폼 사례](../packages/react/scripts/generate-form-render-cases.mts) `condition-*`가 React, Vue, Svelte, HTML 렌더러, PHP, PHP 확장, Go, Rust, Python을 비교함; [공유 검증 사례](../tests/fixtures/validate/condition-field.mts) `condition-field-values`; `connectForm`([사례](../legacy/packages/generator/ts/src/dom-sync.test.ts))과 `@polyspec/crudui-form-binding`([데이터 사례](../packages/form-binding/tests/data.test.ts))의 브라우저 디코딩 |
| condition-editor | `condition` 필드의 구조 편집기(`design.editor: structured`): 모든 렌더러가 숨긴 textarea 뒤에 조건 트리의 화면으로 쓰고, 보여 줄 수 없는 값은 이름 있는 오류와 보이는 textarea로 쓰며, `connectForm`이 그 컨트롤과 버튼을 트리에 적용한다 | implemented | passed | not-deployed | [명세](spec/schema.ko.md#구조-조건-편집기), [폼 마크업](spec/form-markup.ko.md#구조-조건-편집기), [조건 값](spec/form-runtime.ko.md#조건-값); [공유 폼 사례](../packages/react/scripts/condition-editor-form-render-cases.ts) `condition-editor-*`와 `condition-fields-*`가 React, Vue, Svelte, HTML 렌더러, PHP, PHP 확장, Go, Rust, Python을 비교함; [공유 명세 사례](../tests/fixtures/spec-validity/cases.json) `ok-condition-editor`; `connectForm`의 편집기 편집([사례](../legacy/packages/generator/ts/src/condition-editor.test.ts)) |
| control-attributes | 필드 컨트롤과 노드에 선언한 `attributes`를 여덟 렌더러가 속성으로 쓰며, 이름은 `data-*`와 `aria-*`로 제한한다 | implemented | passed | not-deployed | [명세](spec/schema.ko.md#선언한-속성), [폼 마크업](spec/form-markup.ko.md#선언한-속성); `@polyspec/crudui-generator-core`([모델과 검사 사례](../legacy/packages/generator/ts/src/declared-attributes.test.ts)), `@polyspec/crudui-generator-html`([바이트 사례](../legacy/packages/html/src/declared-attributes.test.ts)), React([바이트 사례](../packages/react/src/tests/declared-attributes.test.ts)), JSON Schema, PHP, Go, Rust 검증기의 타입 명세 모델; [공유 폼 사례](../packages/react/scripts/generate-form-render-cases.mts) `control-attributes-*`가 React, Vue, Svelte, HTML 렌더러, PHP, PHP 확장, Go, Rust를 비교함 |
| switch-control | `switcher` 필드를 여덟 렌더러가 체크 상자와 다른 스위치(`role="switch"`)로 렌더링한다 | implemented | passed | not-deployed | [폼 마크업](spec/form-markup.ko.md#스위치); `@polyspec/crudui-generator-core`([모델 사례](../legacy/packages/generator/ts/src/switch-control.test.ts)), `@polyspec/crudui-generator-html`([바이트 사례](../legacy/packages/html/src/switch-control.test.ts)), React([바이트 사례](../packages/react/src/tests/switch-control.test.ts)), Vue([사례](../packages/vue/tests/switch-control.test.mjs)), Svelte([사례](../packages/svelte/tests/switch-control.test.mjs)), 스타일시트([브라우저 검사](../tests/form-styles.test.mts)), 그리고 공유 폼 사례 `switcher-bare`, `control-attributes-checkbox`로 [네이티브 검사](../legacy/tests/native-generators/README.ko.md)를 통과한 PHP, PHP 확장, Go, Rust에 구현됨 |
| range-control | `range` 필드를 여덟 렌더러가 범위, 단계, 현재 값을 가진 슬라이더로 렌더링하고 검증기 다섯 개가 검증한다 | implemented | passed | not-deployed | [명세](spec/schema.ko.md#범위-필드), [폼 마크업](spec/form-markup.ko.md#범위-필드); `@polyspec/crudui-generator-core`([모델과 검사 사례](../legacy/packages/generator/ts/src/range-control.test.ts)), `@polyspec/crudui-generator-html`([바이트 사례](../legacy/packages/html/src/range-control.test.ts)), 스타일시트, JSON Schema에 구현됨; 기존 `range`와 `step` 규칙이 값을 검증함([TypeScript 사례](../legacy/packages/validator/ts/src/range-field.test.ts), [공유 검증 사례](../tests/fixtures/validate/numeric-rules.mts) `range-field-values`); [공유 폼 사례](../packages/react/scripts/generate-form-render-cases.mts) `range-*`가 React, Vue, Svelte와 [네이티브 검사](../legacy/tests/native-generators/README.ko.md)의 PHP, PHP 확장, Go, Rust를 비교함 |
| button-control | `button` 필드를 여덟 렌더러가 내용과 속성을 가진 `button` 요소로, 스크립트 없이 렌더링한다 | implemented | passed | not-deployed | [폼 마크업](spec/form-markup.ko.md#버튼-필드); `@polyspec/crudui-generator-core`([모델 사례](../legacy/packages/generator/ts/src/button-control.test.ts)), `@polyspec/crudui-generator-html`([바이트 사례](../legacy/packages/html/src/button-control.test.ts)), React([바이트 사례](../packages/react/src/tests/button-control.test.ts), [스크립트 검사](../tests/widget-scripts.test.mts)), Vue([사례](../packages/vue/tests/button-control.test.mjs)), Svelte([사례](../packages/svelte/tests/button-control.test.mjs)), 스타일시트([브라우저 레이아웃 검사](../tests/form-styles.test.mts)), 그리고 공유 폼 사례 `button-empty`, `action-alias`, `button-behavior-onclick`, `control-attributes-file-display-button`으로 [네이티브 검사](../legacy/tests/native-generators/README.ko.md)를 통과한 PHP, PHP 확장, Go, Rust에 구현됨 |
| choice-appearance | 선택 필드의 선택지마다 class와 style을 여덟 렌더러가 적용하여, 선택 필드를 견본 격자로 렌더링할 수 있다 | implemented | passed | not-deployed | [명세](spec/schema.ko.md#선택지-외형), [폼 마크업](spec/form-markup.ko.md#선택지-외형); `@polyspec/crudui-generator-core`([모델과 검사 사례](../legacy/packages/generator/ts/src/choice-appearance.test.ts)), `@polyspec/crudui-generator-html`([바이트 사례](../legacy/packages/html/src/choice-appearance.test.ts)), JSON Schema에 구현됨; [공유 폼 사례](../packages/react/scripts/generate-form-render-cases.mts) `choice-appearance-*`가 React, Vue, Svelte와 [네이티브 검사](../legacy/tests/native-generators/README.ko.md)의 PHP, PHP 확장, Go, Rust를 비교함 |
| display-switching | 브라우저 바인딩이 부모 값에 따른 `design.show`로 필드와 그룹을 보이고 숨기며, 상대 경로는 반복 행을 한 단계로 다루고, 검증 결과는 숨은 경로를 담으며, 검증기 다섯 개가 조건부 필수 필드의 공유 사례를 통과한다 | implemented | pending | not-deployed | [표시](../packages/form-binding/README.ko.md#표시), [표시 여부](spec/validation-rules.ko.md#평가), [상대 경로](spec/expressions.ko.md#5-평가); [바인딩 사례](../packages/form-binding/tests/display.test.ts), [숨은 경로 사례](../legacy/packages/validator/ts/src/hidden-paths.test.ts), [공유 검증 사례](../tests/fixtures/validate/visibility.mts) `switch-*`, `visibility-row-parent-*`, `visibility-show-literal-identifier`, [공유 expression 사례](../legacy/packages/validator/ts/scripts/generate-expr-cases.mts) `path-row-*`, [공유 폼 사례](../packages/react/scripts/written-form-render-cases.ts) `design-show-row-parent-*`. native와 브라우저 비교는 CI에서 실행한다 |
| choice-groups | `select` 필드의 선택 목록에 있는 그룹 항목을 여덟 렌더러가 옵션을 가진 `optgroup` 요소로 렌더링하고, 검증기 다섯 개의 `in`이 그룹 안의 값을 필드의 선택지로 받는다 | implemented | passed | not-deployed | [명세](spec/schema.ko.md#선택지-그룹), [폼 마크업](spec/form-markup.ko.md#선택지-그룹); `@polyspec/crudui-generator-core`([모델과 검사 사례](../legacy/packages/generator/ts/src/choice-groups.test.ts)), `@polyspec/crudui-generator-html`([바이트 사례](../legacy/packages/html/src/choice-groups.test.ts)), React([바이트와 컴포넌트 사례](../packages/react/src/tests/choice-groups.test.tsx)), Vue([사례](../packages/vue/tests/choice-groups.test.mjs)), Svelte([사례](../packages/svelte/tests/choice-groups.test.mjs)), TypeScript 검증기의 `in`([사례](../legacy/packages/validator/ts/src/choice-groups.test.ts)), 그 타입, JSON Schema에 구현됨; [공유 폼 사례](../packages/react/scripts/generate-form-render-cases.mts) `choice-groups-*`, 목록 사례 `reject-format-items-choice-group`, [공유 검증 사례](../tests/fixtures/validate/value-rules.mts) `value-in-choice-groups*`가 구현을 비교함; [네이티브 검사](../legacy/tests/native-generators/README.ko.md)의 PHP, PHP 확장, Go, Rust 렌더러와 PHP, PHP 확장, Go, Rust 검증기를 포함함 |
| inline-layout | 각 필드의 레이블과 컨트롤을 한 줄에 두는 폼 배치를 여덟 렌더러가 제공한다 | implemented | passed | not-deployed | [명세](spec/schema.ko.md#배치), [폼 마크업](spec/form-markup.ko.md#배치); `@polyspec/crudui-generator-core`([모델과 검사 사례](../legacy/packages/generator/ts/src/inline-layout.test.ts)), `@polyspec/crudui-generator-html`([바이트 사례](../legacy/packages/html/src/inline-layout.test.ts)), 스타일시트([브라우저 배치 검사](../tests/form-styles.test.mts)), JSON Schema에 구현됨; inline 배치의 헤더에 쓰는 체크박스와 스위처 필드의 레이블은 노드 모델과 React([서버와 컴포넌트 사례](../packages/react/src/tests/inline-layout.test.tsx)), Vue([사례](../packages/vue/tests/inline-layout.test.mjs)), Svelte([사례](../packages/svelte/tests/inline-layout.test.mjs))에 구현됨; [공유 폼 사례](../packages/react/scripts/generate-form-render-cases.mts) `inline-layout-*`와 작성된 레이아웃 사례 여섯 개가 여덟 렌더러를 비교함; PHP, PHP 확장, Go, Rust는 [네이티브 검사](../legacy/tests/native-generators/README.ko.md)에서 통과함 |
| collection-controls | 현재 행 계약 밖의 제안: 행 컨트롤의 선언된 글과 속성, 마지막 행 뒤의 추가 컨트롤을 여덟 렌더러가 렌더링한다 | not-started | pending | not-deployed | [폼 마크업](spec/form-markup.ko.md#행) |
| validator-responses | 검증기 프로세스 상태와 완전한 응답 검사 | implemented | passed | not-deployed | [응답 검사](../legacy/examples/cross-check-console/server/validate-response.test.mjs), [검증기 프로세스 사례](../legacy/examples/cross-check-console/validators/README.ko.md) |
| php-api | 동일한 메서드를 제공하는 PHP와 확장의 공통 클래스 | implemented | passed | not-deployed | [PHP API 계약](operations/php-extension.ko.md) |
| generator-php | PHP 폼 생성과 SSR | implemented | passed | not-deployed | [런타임 계약](spec/runtime-packages.ko.md) |
| generator-go | Go 폼 생성과 SSR | implemented | passed | not-deployed | [런타임 계약](spec/runtime-packages.ko.md) |
| generator-rust | Rust 폼 생성과 SSR | implemented | passed | not-deployed | [런타임 계약](spec/runtime-packages.ko.md) |
| generator-python | Python 폼 생성, 목록과 상세 렌더링, Python 프로그램의 native generator 검사 | implemented | passed | not-deployed | [런타임 계약](spec/runtime-packages.ko.md) |
| validator-python | Python 폼·목록·상세 검증, 공통 fixture의 합성과 표현식 규칙 | implemented | passed | not-deployed | [런타임 계약](spec/runtime-packages.ko.md) |
| generator-html | 프레임워크 독립 폼·목록 HTML 렌더링 | implemented | passed | not-deployed | [기능 계약](operations/feature-contracts.ko.md) |
| php-extension | PHP 네이티브 폼 생성과 검증 | implemented | passed | not-deployed | [확장 계약](operations/php-extension.ko.md) |
| server-template-browser | 서버에서 컴파일한 직렬화 템플릿으로 현재 keyed 브라우저 인스턴스 생성 | implemented | passed | not-deployed | [로컬 검증](operations/form-comparison.ko.md#로컬-검증)(`make crudui-test-form-comparison-checks`, CI 작업 `form-comparison-browser`): [`check.mjs`](../examples/form-comparison/check.mjs)의 초기화 보고서 |
| native-generation-integration | 현재 네 서버의 생성·SSR·전송·저장·브라우저 통합 | implemented | passed | not-deployed | [로컬 검증](operations/form-comparison.ko.md#로컬-검증)(`make crudui-test-form-comparison-checks`, CI 작업 `form-comparison-browser`와 `form-comparison-checks`): [`check-generation.mjs`](../examples/form-comparison/check-generation.mjs), [`check-servers.mjs`](../examples/form-comparison/check-servers.mjs), [`check-pipeline.mjs`](../examples/form-comparison/check-pipeline.mjs), [`check.mjs`](../examples/form-comparison/check.mjs) |
| expressions | 공통 표현식 문법과 불리언 변환 | implemented | passed | not-deployed | [표현식 계약](spec/expressions.ko.md) |
| cli | 목록·정적 검사·스펙 설명 | implemented | passed | not-deployed | [CLI 절차](operations/cli.ko.md) |
| unique-json-members | 명세 JSON 텍스트에서 반복된 디코딩 객체 멤버 이름 거부 | implemented | passed | not-deployed | [입력 텍스트 계약](spec/input-text.ko.md), [파서 테스트](../legacy/packages/validator/ts/src/text/json.test.ts) |
| json-text-values | Rust 검증에서 JSON 객체 멤버 이름, 값과 순서 유지 | implemented | passed | not-deployed | [입력 텍스트 계약](spec/input-text.ko.md), [Rust 텍스트 사례](../packages/validator/rust/tests/text_validity_conformance.rs) |
| viewport-widths | `crudui.css`로 모든 공유 render case가 360과 1280 CSS pixel viewport에 맞고, list는 넓은 table을 스스로 scroll한다 | implemented | passed | not-deployed | [Viewport 폭](spec/form-markup.ko.md#viewport-폭), [viewport test](../tests/viewport.test.mts) |
| tailwind-styles | Tailwind CSS layer `components`로 import한 `crudui.css`(생성 file 없음), computed style이 같다 | implemented | passed | not-deployed | [Tailwind CSS](spec/form-markup.ko.md#tailwind-css), [비교 test](../tests/tailwind-styles.test.mts) |
| complete-form | 여덟 문자열 렌더러에서 폼 요소, 숨은 input, 폼·노드 오류를 가진 완전한 폼 | implemented | passed | not-deployed | [완전한 폼](spec/form-runtime.ko.md#완전한-폼), [공유 사례](../tests/fixtures/form-complete/README.ko.md) |
| choice-lists | 값에 관계없이 작성한 순서를 유지하는 값과 라벨 쌍의 선택 목록. 여덟 폼 renderer, 다섯 표시 renderer, 다섯 검증기, CLI | implemented | passed | not-deployed | [선택 목록](spec/schema.ko.md#선택-목록), [폼 사례](../packages/react/scripts/written-form-render-cases.ts), [검증 사례](../tests/fixtures/validate/value-rules.mts) |
| display-descriptions-actions | 여덟 renderer에서 폼 루트와 목록의 설명, 상세 동작 | implemented | passed | not-deployed | [표시 형식](spec/display-formats.ko.md#마크업), [완전한 폼](spec/form-runtime.ko.md#완전한-폼), [목록 사례](../tests/fixtures/list-render/README.ko.md), [상세 사례](../tests/fixtures/detail-render/README.ko.md) |
| action-event-attributes | 여덟 renderer에서 목록과 상세 동작의 `behavior` 멤버를 event attribute로 한 번 씀 | implemented | passed | not-deployed | [표시 형식](spec/display-formats.ko.md#마크업), [목록 사례](../tests/fixtures/list-render/README.ko.md), [상세 사례](../tests/fixtures/detail-render/README.ko.md) |
| script-action-click | 여덟 renderer와 세 브라우저에서 목록과 상세의 스크립트 동작이 button을 누를 때 스크립트를 실행 | implemented | passed | not-deployed | [표시 형식](spec/display-formats.ko.md#마크업), [목록 사례](../tests/fixtures/list-render/README.ko.md), [상세 사례](../tests/fixtures/detail-render/README.ko.md), [브라우저 사례](../tests/widget-script-runs.test.mts) |
| browser-validation | 서버가 렌더링한 폼을 서버의 스펙으로 브라우저에서 검증: 제출이 보내는 대로 이름 있는 컨트롤에서 만든 데이터, `renderForm`의 오류 마크업, `aria-invalid`, 바뀐 필드가 포커스를 잃을 때와 제출할 때의 검증, 다른 submit 리스너보다 먼저 유효하지 않은 제출 취소 | implemented | passed | not-deployed | [브라우저 검증](spec/form-runtime.ko.md#브라우저-검증), [동등성 사례](../packages/form-binding/tests/parity.test.ts), [Chromium, Firefox, WebKit 브라우저 사례](../packages/form-binding/tests/browser.test.ts), [공개 패키지 검사](../tests/build/public-packages.test.mts), [설치 검사](../scripts/check-packages.mts), [재현 가능한 빌드](../tests/build/reproducible-build.test.mts) |
| test-hook-failures | 실패하거나 제한 시간을 넘긴 hook을 포함해 `node --test`와 Vitest 실행의 모든 실패를 test 파일과 경과 시간과 함께 출력 | implemented | passed | not-deployed | [테스트 실행기](operations/testing.ko.md#테스트-실행기) |
| load-independent-checks | 시계를 읽지 않는 validator와 PHP extension engine의 선형 시간 검사 | implemented | passed | not-deployed | [시간과 부하](operations/testing.ko.md#시간과-부하), [시계 검사](../tests/build/validator-test-clocks.test.mts) |
| single-choice-data | 다섯 검증기에서 단일 선택 필드 값인 배열이나 객체 거부 | implemented | passed | not-deployed | [검증 규칙](spec/validation-rules.ko.md#평가), [공유 사례](../tests/fixtures/validate/value-rules.mts) |
| empty-membership | 다섯 검증기에서 어떤 값과도 일치하지 않는 빈 `in` 목록·맵 | implemented | passed | not-deployed | [검증 규칙](spec/validation-rules.ko.md#값), [공유 사례](../tests/fixtures/validate/value-rules.mts) |
| declared-form-data | 모든 그룹 단계에서 선언되지 않은 제출 필드 거부 | implemented | passed | not-deployed | [검증 계약](operations/validation.ko.md), [공유 사례](../tests/fixtures/validate/cases.json) |
| form-controls | 라벨, 복수 선택 배열과 필드 컨테이너 경로 | implemented | passed | not-deployed | [공유 입력 검사](../tests/fixtures/form-session/controls.mts) |
| package-exports | 패키지 export, 분리된 React 컴포넌트·서버 진입점, 타입 선언과 설치 프로덕션 빌드 | implemented | passed | not-deployed | [설치 검사](../scripts/check-packages.mts), [React 진입점 검사](../packages/react/src/tests/entry-boundary.test.ts) |
| package-install | 플랫폼 의존성 해석과 정상 설치 스크립트 | implemented | passed | not-deployed | [npm ci / test:packages](operations/package-build.ko.md) |
| package-build | 독립적인 공개 타입 선언 컴파일 | implemented | passed | not-deployed | [빌드 검사](../tests/build/README.ko.md), [공개 타입 검사](../tests/build/public-packages.test.mts) |
| package-api | 초기 패키지 API와 버전 메타데이터 | implemented | passed | not-deployed | [API 계약](spec/schema.ko.md) |
| form-template | 데이터와 독립된 폼 템플릿과 JSON 캐시 | implemented | passed | not-deployed | [코어 테스트](../legacy/packages/generator/ts/src/form.test.ts) |
| form-initialization | 초기 데이터·반복 주입·레코드 복원 | implemented | passed | not-deployed | [런타임 계약](spec/form-runtime.ko.md) |
| form-inspector | 파싱한 DOM·HTML 원문·CSS·상태 비교와 차이 보존 | implemented | passed | not-deployed | [검사기 테스트](../tests/form-inspector/form-snapshot.test.mts) |
| form-rows | 중첩 행 작업 범위와 저장 후 seq 키 적용 | implemented | passed | not-deployed | [코어 테스트](../legacy/packages/generator/ts/src/form.test.ts) |
| form-empty-rendering | 병합 런타임의 명시적인 빈 컬렉션 출력 | implemented | passed | not-deployed | [빈 컬렉션 검사](../legacy/packages/generator/ts/src/empty-collections.test.ts) |
| form-browser | 세 프레임워크의 데이터 주입과 행 작업 | implemented | passed | not-deployed | [공용 DOM 사례](../tests/fixtures/form-session/scenario.mts) |
| form-typing | 안정적인 편집 컨트롤의 기본 입력 갱신, 포커스와 렌더러 완료 | implemented | passed | not-deployed | [로컬 검증](operations/form-comparison.ko.md#로컬-검증)(`make crudui-test-form-comparison-checks`, CI 작업 `form-comparison-checks`): [`check-typing.mjs`](../examples/form-comparison/check-typing.mjs) |
| form-empty-focus | 빈 컬렉션의 첫 행 생성 후 포커스 | implemented | passed | not-deployed | [공통 DOM 사례](../tests/fixtures/form-session/scenario.mts) |
| form-focus | 행 작업 후 대상 행으로 포커스 이동 | implemented | passed | not-deployed | [로컬 검증](operations/form-comparison.ko.md#로컬-검증)(`make crudui-test-form-comparison-checks`, CI 작업 `form-comparison-browser`): [`check-interaction.mjs`](../examples/form-comparison/check-interaction.mjs)의 상호작용 검사 |
| form-markup | 다섯 구현의 재귀 폼 노드, 목록·상세 표시 블록, 행 카드, 인터페이스 문구 | implemented | passed | not-deployed | [폼 마크업](spec/form-markup.ko.md), [표시 형식](spec/display-formats.ko.md) |
| crudui-details | 읽기 전용 상세 명세, 모델, 프레임워크 독립 HTML 렌더링과 구조 검증 | implemented | passed | not-deployed | [명세](spec/schema.ko.md), [표시 형식](spec/display-formats.ko.md), [기능 계약](operations/feature-contracts.ko.md), [공용 상세 고정 데이터](../tests/fixtures/detail-render/README.ko.md), [네이티브 비교](../legacy/tests/native-generators/README.ko.md), [상세 검증 사례](../tests/fixtures/detail-validity/cases.json) |
| form-view-state | 레코드 데이터와 분리된 행 접기, 병합 실행취소·실행복귀 이력 | implemented | passed | not-deployed | [노드 테스트](../legacy/packages/generator/ts/src/node.test.ts) |
| display-declarations | JavaScript, HTML 렌더러, PHP, PHP 확장, Go, Rust의 렌더링 시 목록·상세 선언 검사 | implemented | passed | not-deployed | [표시 형식 선언](spec/display-formats.ko.md#선언), [공용 목록 고정 데이터](../tests/fixtures/list-render/README.ko.md), [공용 상세 고정 데이터](../tests/fixtures/detail-render/README.ko.md), [네이티브 비교](../legacy/tests/native-generators/README.ko.md), [렌더 유효성 검사](../legacy/packages/generator/ts/src/display-validity.test.ts) |
| form-outline | 구조 맵과 현재 데이터 보기 | implemented | passed | not-deployed | [폼 마크업](spec/form-markup.ko.md) |
| form-initialization-comparison | 데이터와 함께 생성한 폼과 마운트 후 주입한 폼의 단계별 좌우 비교 | implemented | passed | not-deployed | [폼 비교](operations/form-comparison.ko.md) |
| keyed-validation | 네 언어의 키를 유지하는 그룹·단일 값 검증 | implemented | passed | not-deployed | [공용 검증 사례](../tests/fixtures/validate/cases.json) |
| docs-check | 문서 검사와 이벤트 기반 개발 빌드 | implemented | passed | not-deployed | [문서 관리 절차](operations/documentation.ko.md) |
| docs-pages | 영어·한국어·API 페이지를 제공하는 정적 문서 | implemented | passed | deployed | [페이지 검사](../tests/docs/web-build.test.mts), [게시 절차](operations/documentation.ko.md), [게시 웹](https://polyspec.github.io/crudui/) |

## 2026-09-19 비교 검증

2026-09-19에 비교 배포 검증이 5분 20초 만에 실패 0건으로 끝났습니다.
PHP, PHP 확장, Go, Rust가 생성 450개, 저장
120개, 브라우저 7,008개 검사를 통과했고, 정본 흐름은 서버 다섯 개, 클라이언트 네 개, 두 초기화의 40개
조합을 모두 통과했으며 실패는 없었습니다. 검증은 기본값이 아닌 레코드를 담은 저장소에서 시작했으므로 모든
초기화 열은 자기가 초기화한 레코드를 불러왔습니다. 모든 브라우저 보고서와 단계는 각자의 제한 안에 완료했고
검증 후 컨테이너의 좀비 프로세스 수는 0개였습니다. 공개 루트는 목록, 상세, 폼, 저장, 갱신된 목록으로
이어지는 정본 페이지이며 별도 벤치마크 화면은 `/benchmark-console/`입니다. 정본 목록은 45개 레코드를
20·20·5개 세 페이지로 제공합니다. 페이지 수준 SSR에는 선택한 서버의 목록, 상세 또는 폼 마크업이 포함되고
CSR에는 선택한 클라이언트가 채우는 단계 셸만 포함됩니다. 초기화 비교는 프레임워크가 소유한 컨테이너 표시를
보존하고 렌더링된 컨테이너 내용만 비교합니다. Vue의 `data-v-app`도 제거하지 않습니다.

PHP 8.4 이상을 지원합니다. `.php-version`은 CI toolchain을 선택하며 지원하는 PHP 버전의 상한을 정하지 않습니다. 날짜가 있는 검증 section은 해당 실행의 버전과 결과를 기록합니다. 과거 PHP 8.5.10 측정값을 유지하며 이 기록은 현재 tree를 검증하지 않습니다.

## Checklist 검증

2026-10-26에 PHP 8.4.26에서 전체 실행 39개 target을 완료했으며 20개가 통과하고 19개가 실패했습니다.
Report는 `var/report/final-checklist/record.json`입니다. 실패의 수정과 소유 검사는 [kit 표준 checklist](plans/kit-standard/checklist.ko.md)에 기록합니다.

이 실행은 `CRUDUI_CONFORMANCE_EVIDENCE`를 선언하지 않아 conformance 집계에 사용할 증거 directory가 없습니다. 전체 실행은 수정 전 실패를 기록하며 수정한 통합 tree를 검증하지 않습니다. 수정은 선택한 소유 검사로 검증합니다. Extension 전체 library 실행은 PHP 구현 전용 helper 파일도 로드했으므로 해당 내부 test에 대한 extension-only 결과를 입증하지 않습니다.

## Release 준비

2026-10-26 검토는 기존 불가 checklist 10개 행을 현재 원인에 따라 분류합니다. Unicode data는 잠긴 Unicode package를
사용합니다. HTTP forwarding adapter는 양방향 connection-specific header를 제거합니다. 검토한 VitePress distribution은
영향받는 parser를 내장하므로 문서 renderer는 직접 관리하는 Markdown parser를 유지합니다.
[문서](rebuild/documentation-web.ko.md)와 [HTTP forwarding](rebuild/http-forward.ko.md) 기록은 요구, 검토한 도구와 재검토
조건을 설명합니다.

Native package manager는 로컬 준비에서 현재 sibling source를 선택합니다. Composer는 하나의 root 선언과 lock을 사용하고
선언한 제약 내에서 PHPUnit을 선택합니다. React와 React DOM 19.3.1은 inert template을 렌더링한 뒤 effect에서 client widget
script를 실행합니다. Server rendering과 hydration은 script element를 유지하며 React dependency-policy exception은 제거합니다.
철회된 sprintf-js advisory는 package update를 요구하지 않습니다.

갱신한 dependency review는 registry dependency 87개와 lock 13개를 검토하며 보안 advisory가 없습니다. npm lock은 수정된
Markdown, URI, HTTP client와 schema package를 선택하며 Rust comparison server lock은 Tokio 1.53.3을 선택합니다.
Go 1.27.3은 linked module의 최소 버전을 충족하며 advisory scan을 실행할 수 있습니다.

Release 설정은 native PHP extension manifest를 version-only로 분류합니다. C18.5는 CI 전에 version 0.0.8 manifest,
내부 의존성과 native lock을 준비합니다. Package coverage와 version 검사는 publication과 구분합니다. Release에는 해당
commit의 `ci-passed`와 `push-gate` 성공이 필요하며 로컬 준비와 소유 unit 검사는 그 결과를 입증하지 않습니다.

C18.1–C18.10의 [릴리즈 준비 checklist](plans/release-readiness/checklist.ko.md)는 완료했습니다.
현재 source 의존성과 consumer 검증, 전체 CI, tag 검증과 공개 archive 설치 검증을 통과했습니다.

## 로컬 source 개발

설치한 npm과 Composer polyspec package는 현재 sibling source로 해석합니다. Root Composer 선언과 native lock은 실제
로컬 package version을 설명합니다. 로컬 준비는 package manager가 설치한 autoload를 통해 현재 OrderedJSON source의
순서, 값과 빈 type을 검증합니다. 과거 공개 OrderedJSON archive로 대체하거나 두 번째 archive compatibility 설치 profile을
유지하지 않습니다. C18.1은 candidate CI 전에 최종 native validation, platform과 consumer 결과를 기록합니다.

## 표시 선언 검증

2026-09-24에 표시 선언 변경의 작업 트리가 macOS arm64, PHP 8.5.10, Node.js 26.8.1, Go 1.27.0,
Rust 1.98.0에서 다음 검사를 통과했습니다.

- 네이티브 생성기 검사는 JavaScript, HTML 렌더러, PHP, Go, Rust, 네이티브 PHP 각각에서 목록 사례 142개와
  상세 사례 44개를 포함한 596개 검사를 통과했습니다(합계 3,576개, 실패 0개).
- 폼 패키지는 core 247, HTML 406, React 794, Vue 597, Svelte 590개와 마운트한 Svelte 14개 검사를
  통과했고, node 폼 검사는 57개와 24개를 통과했습니다. 생성기 패키지는 PHP 249, Go 116, Rust 36개 검사를, PHP 확장 검사는 46개
  검사를 통과했습니다. 주소 새니타이저 검사는 Linux에서 실행합니다.
- 교차 검증 콘솔 1,039개, 명세 CLI 38개, 폼 비교 소스 검사 194개, 그 Go·Rust 서버 14개와 18개,
  `npm run manifest:test` 명령 21개, `npm run test:packages` 7단계, `npm run test:runtimes` 65개 검사를
  통과했습니다. `npm run spec:schema`, `npm run lint`, `npm run typecheck`, `make format-check`,
  `make docs-check`도 통과했습니다.

## 네이티브 패키지 검증

2026-09-17에 작업 트리는 PHP 8.5.10, Node.js 26.8.1, Go 1.27.0, Rust 1.98.1을 쓰는 macOS arm64에서
`make ci`를 통과했습니다. `make ci`는 CI 워크플로의 모든 검사 명령을 실행하고 적합성 증거를
`contracts/features.json`과 비교합니다.

- 검증기는 JavaScript 580개, PHP 698개, Go 587개, Rust 111개 검사를 통과했으며, 각각 공용 검증
  사례 250개 전체와 검증·생성 연산의 공용 입력 텍스트 사례 80개를 포함합니다. PHP 확장 검사는 42개를
  통과했으며 주소 새니타이저 검사는 Linux에서 실행합니다.
- 공용 생성기 보고서는 JavaScript, HTML 렌더러, PHP, Go, Rust, 네이티브 PHP에서 각각 501개 검사를
  통과했고(합계 3,006개, 실패 0개) 실행 중 입력이 바뀌지 않았습니다. 생성기 패키지는 PHP 240개, Go 115개,
  Rust 35개 검사를 통과했습니다.
- 교차 검증 콘솔은 검사 914개를 통과했으며, 공용 검증·목록·상세·입력 텍스트 사례 전체와 요청 사례를 다섯
  검증기 프로세스로 보냅니다.
- 폼 패키지는 core 216개, HTML 308개, React 502개, Vue 472개, Svelte 467개와 마운트한 Svelte 검사 12개를
  통과했고, 명세 CLI는 38개, Node 폼 검사는 Chromium·Firefox·WebKit의 스타일시트 배치를 포함해 54개를
  통과했습니다. 폼 비교 소스 검사 149개, 저장소 전체 `npm run lint`(문제 0건), 패키지 설치 검사 7단계, `make format-check`가 통과했습니다.
- Linux 툴체인 이미지에서 PHP 확장 엔진은 주소 새니타이저와 쉼표 소수점 로캘 실행을 포함해 33개 검사를
  통과했습니다. Chromium·Firefox·WebKit의 Linux 스타일시트 검사는 폼 검사를 실행하는 CI 작업에서
  실행합니다.

적합성은 증거로 검사합니다. 공용 fixture를 실행하는 모든 검사가 통과한 기능·fixture 사례·런타임을
기록하고, `make conformance`(와 CI의 마지막 작업)가 그 증거를 `contracts/features.json`과 비교합니다.
지원한다고 선언한 런타임에 선언된 사례마다 통과 기록이 없으면 실패합니다. 기준은
[적합성](operations/conformance.ko.md)에 정의되어 있습니다. 패키지 공개는 아래에 기록합니다.
Native PHP extension은 version-only release component입니다.

## 보존 폼 비교 결과

보존 외부 `https://crudui.test/` 환경은 이전 라이브러리 트리를 사용하며
PHP·네이티브 JSON 파싱을 사용하는 PHP·Go·Rust를 독립적인 HTTP 대상으로 실행합니다.
HTTP 검사 240개와 PHP 처리 모드 검사가 모두 통과했습니다.

두 PHP 대상은 모두 PHP 검증기를 사용합니다. 이 보존 결과는 현재 CRUDUI
네이티브 폼 생성이나 검증 통합을 증명하지 않습니다.

| 서버 | 시나리오 | 상호작용 | 페이지 오류 |
| --- | --- | --- | --- |
| PHP | 120/120 통과 | 30/30 통과 | 0 |
| 네이티브 JSON 파싱을 사용하는 PHP | 120/120 통과 | 30/30 통과 | 0 |
| Go | 120/120 통과 | 30/30 통과 | 0 |
| Rust | 120/120 통과 | 30/30 통과 | 0 |

각 대상은 React·Vue·Svelte의 폼 전송과 ordered JSON 전송을 검사합니다.
보고서는 초기 데이터, 나중 주입, 반복 주입, 레코드 복원, HTML 원문, DOM,
CSS, 입력 상태와 행 연산을 포함합니다. 근거는 외부 비교 작업 공간의
`.form-comparison/results-<revision>/report-<server>.json`에 저장합니다.
보고서 메타데이터는 소스 리비전을 기록합니다. 상호작용 검사 전체 108개는 비교 모드 네 가지의
합계이며 그중 30개가 현재 구현에 해당합니다.

라이브러리 트리와 검증한 트리 사이의 TypeScript 파일 5개는 API 주석과 사용하지 않는 타입 import만
변경했으며 실행 JavaScript는 동일합니다. 생성된 PHP 의존성과 Go 실행 파일은
Git에서 제거했습니다. 새 이미지는 같은 잠금 버전의 PHP 의존성을 설치하고
서버 실행 파일을 소스에서 빌드합니다.

보존된 비교 구현에는 진단 실패가 있습니다. 실패는 보고서에 유지되며 전체
비교 실행기는 0이 아닌 상태로 종료합니다. 현재 구현의 통과가 보존된 구현의
통과를 의미하지 않습니다. 이전 보고서는 현재 의존성 그래프를 검증하지 않습니다.

## 배포

[CRUDUI 0.0.8](https://github.com/polyspec/crudui/releases/tag/v0.0.8)은 패키지 archive 11개와 함께 공개했습니다.
0.0.8의 release commit은 전체 CI와 push 검사를 통과했습니다.
Release workflow는 공개 전에 checkout 밖에서 archive 11개를 모두 설치하고 검사했습니다.
두 Go module tag도 같은 commit을 가리킵니다.
표는 서버별로 완료된 최신 검사를 기록합니다.
네 서버의 브라우저 검사가 완료되었습니다. 보존된 비교 구현의 실패는 보고서에 유지합니다.

TypeScript·Go·Rust·PHP API 생성과 엄격한 정적 웹 빌드가 통과했습니다.
전체 문서를 두 번 생성한 API 문서·네이티브 HTML 자산·스키마 출력은 동일했습니다.
생성 실패 검사 8개와 폼 원문 검사기 18개가 통과했습니다.

## PHP test 범위 검증

2026-10-26 PHP 8.4.26 source 실행은 generator 859개와 validator 985개 case를 모두 통과했다. 빌드한 extension의 공개 실행은
PHP library source-load guard를 활성화하고 generator 841개와 validator 633개 case를 모두 통과했다. Native expression 및
composition engine unit은 94개 case를 통과했다. Native PHPUnit XML 목록은 혼합 class 3개 분리 전후 원래 case ID를 모두
보존하며 scope unit은 source와 public 선택의 완전성을 검증한다. 이 소유 결과는 앞선 extension 전체 실행의 test 범위 문제를
수정하며 전체 candidate CI 검증을 대신하지 않는다.


## CI 환경별 설치

Kit 0.0.63은 CI job마다 선택한 잠긴 도구를 설치합니다. Go와 Rust job은 각각 validator와 generator suite를 실행하고
JavaScript generator unit은 분리 실행합니다. 언어 간 generator와 validator 비교는 언어별 job을 기다리지 않고 전체
필요 환경을 자체 준비합니다. PHP extension job은 arginfo를 명시적으로 준비하고 CI Composer 설치는 lock을 갱신하지
않고 따릅니다. Conformance는 격리된 evidence를 읽으며 최종 CI는 모든 필수 결과를 요구합니다.
