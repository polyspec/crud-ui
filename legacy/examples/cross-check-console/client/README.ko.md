# 교차 검증 콘솔 — client
<!-- doc-id: legacy-examples-cross-check-console-client-readme -->
<!-- source-sha256: 1add88088fd534e7b910f3d1d60aff7e5aadc00b48d8837c7b9b94f892b72af3 -->

[English](README.md).

교차 검증 gateway를 구동하는, 빌드가 없는 단일 페이지 콘솔입니다. 일반 ES
module로 되어 있습니다. 실행 시 의존성은 `js-yaml` 하나이며 CDN에서 importmap으로
불러옵니다(오프라인으로 실행하려면 로컬 사본을 `./vendor/js-yaml.mjs`에 두고 importmap에
추가합니다). bundler도 transpile 단계도 없으며, gateway가 이 디렉터리를
`/`에서 정적으로 제공합니다.

## 하는 일

콘솔은 gateway의 여섯 endpoint 위에 세 탭(form, list, detail)을 가집니다. 각
탭은 임의의 spec과 data(또는 list-spec과 rows, 또는 detail-spec과 record)를 자기 endpoint들에
병렬로 보내고, 일치 여부를 스스로 판정하며, 그 판정을 다시 확인할 수 있도록
원본 응답을 보여 줍니다.

form 탭:

- `POST /api/validate` `{spec, data, files?, basepath?}` → 4개 언어의 CRUDUI FORM
  검증(`js` / `php` / `go` / `rust`). 각 항목은 다음과 같습니다.
  `{lang, ok, valid, errors[{path,field,rule,message,value}], ms, failure}`.
  `failure` `{code, message, at}`(해소되지 않은 `$ref`, 금지된 key, 형태가
  잘못된 data)는 `valid:false`와 구별됩니다.
- `POST /api/render` `{spec, data, options}` → 3개 framework의 CRUDUI FORM SSR
  (`react` / `vue` / `svelte`). 각 항목은 다음과 같습니다.
  `{fw, ok, html, normalized, ms, error}`. `error`는
  `REF_FILE_NOT_FOUND` / `UNSUPPORTED_FIELD_TYPE`을 담습니다.

list 탭:

- `POST /api/validate-list` `{listSpec, files?, basepath?}` → 4개 언어의 CRUDUI list
  구조 검증(compose → forbidden-scan; rows는 없습니다. list에는 data가 없습니다).
  `/api/validate`에 대응하는 검증 endpoint입니다. 항목별 envelope와 멱등성
  matrix가 같고, 금지된 meta key는 같은 `failure`로 나타나며, 문제가 없는 구조는
  `valid:true`입니다.
- `POST /api/render-list` `{listSpec, rows, options}` → 주입한 rows에 대한
  3개 framework의 CRUDUI list SSR. 항목별 envelope와 parity matrix는
  `/api/render`와 같습니다. columns / format / pagination은 선언하며, rows는 별도의
  JSON 편집기입니다(DB에 의존하지 않습니다).
- `POST /api/render` `{spec:<listSpec.search>, …}` → 포함된 `search` slot은
  form-spec이며, 같은 form endpoint로 렌더링하여 그것이 바뀌지 않고 왕복함을
  증명합니다. list 렌더러는 `search` slot을 무시하므로 form endpoint가 받는 것은
  같은 spec 객체입니다.

detail 탭:

- `POST /api/validate-detail` `{detailSpec, files?, basepath?}` → 4개 언어의 CRUDUI
  detail 구조 검증(compose → forbidden-scan; record는
  검증하지 않습니다). 항목별 envelope와 멱등성 matrix는 `/api/validate`와 같습니다.
- `POST /api/render-detail` `{detailSpec, record, options}` → 주입한 record 하나에 대한
  3개 framework의 CRUDUI detail SSR. 항목별 envelope와 parity matrix는
  `/api/render`와 같습니다. React의 image preload link는 비교 전에 제거합니다.

모든 endpoint는 항상 HTTP 200으로 응답합니다. 실패한 검증이나 없는 `$ref`는
data이며 HTTP 오류가 아닙니다. `{error}` envelope는 전송과
서버의 장애(4xx/5xx)에만 씁니다.

## 시작할 때의 화면

- 헤더: `form` / `list` / `detail` 탭 버튼, 탭별 예제 선택기(form: basic /
  complex / edge-ref / edge-unsupported / mismatch-slot; list: list-basic /
  list-search-conditional; detail: detail-basic / detail-design /
  detail-condition-hidden / detail-edge-forbidden / detail-edge-record), KO/EN 언어 전환(→ `options.language`),
  `unsupported` 선택기(`throw` / `marker`, form 탭에만 있음), `raw` 전환, 문서
  버튼, fixture 내보내기 버튼. 탭별 헤더 컨트롤은 `data-tab`으로 나타나거나 숨겨집니다.

form 탭:

- 왼쪽: YAML spec 편집기와 JSON data 편집기이며, 각각 초록색/빨간색 파싱 badge를 가집니다.
  파싱이 실패하면 실행 버튼이 비활성화됩니다.
- `검증 + 렌더 실행` 버튼 → `/api/validate`와 `/api/render`에 대한 `Promise.all`.
- 검증 matrix: 4개 열(lang + ms), valid/invalid badge, 오류 목록
  (`field: message (rule)`), `failure`에 대한 code, message, 위치가 있는 `FAILURE`
  badge. 4개 언어가 모두 일치하면
  초록색 `4언어 멱등 일치` badge를 보이고, 그렇지 않으면 빨간색 `결과 불일치!`, 언어별 차이
  표, 어긋난 열의 빨간색 테두리를 보입니다.
- 렌더 matrix: 3개 열, sandbox가 적용된 `srcdoc` iframe 미리보기, 원본
  HTML source로의 전환, `error`에 대한 빨간색 `ERROR` badge. 정규화한 HTML이 일치하면 초록색 `3프레임워크 parity 일치`
  badge를 보이고, 그렇지 않으면 빨간색 badge, 차이 표, 빨간색 테두리를 보입니다.

list 탭(위에서 아래로: 검증 → search → list, form 탭과 같은 배치):

- 왼쪽: list-spec YAML 편집기와 주입할 rows의 JSON 편집기이며, 각각 파싱
  badge를 가집니다(rows badge는 행의 수를 보입니다). 파싱이 실패하면 list 실행이 비활성화됩니다.
- `list 렌더 실행` 버튼 → `/api/validate-list`와
  `/api/render-list`에 대한 `Promise.all`이며, search slot이 선언되어 있으면
  `listSpec.search`의 `/api/render`를 더합니다.
- list 검증 matrix: form 탭과 같은 4개 언어 멱등성 matrix이며,
  list 구조에 대한 것입니다(data 단계 없음; 금지된 key → code와 위치가 있는 `FAILURE` 칸).
- search 폼 matrix: 포함된 `search` form-spec을
  `/api/render`로 렌더링하며(form 재사용) 같은 3개 framework parity matrix에 보입니다.
  list-spec에 `search` slot이 없으면 실행하지 않았다는 안내를 보입니다.
- list 렌더 matrix: `/api/render-list`에 대한 같은 3개 framework parity matrix이며,
  렌더링한 표(columns / format / pagination)를 react / vue / svelte에 걸쳐 보입니다.

detail 탭(위에서 아래로: 검증 → 렌더):

- 왼쪽: detail-spec YAML 편집기와 record JSON 편집기이며, 각각 파싱 badge를 가집니다.
  파싱이 실패하면 실행이 비활성화됩니다. record 편집기는 어떤 JSON 값이든 받아
  그대로 보내므로, 객체가 아닌 record는 렌더러의
  `INVALID_FORM_INPUT` 칸을 보입니다.
- `detail 검증 + 렌더 실행` 버튼 → `/api/validate-detail`과
  `/api/render-detail`에 대한 `Promise.all`.
- detail 검증 matrix: 같은 4개 언어 멱등성 matrix입니다(금지된 meta
  key → code와 위치가 있는 `FAILURE` 칸).
- detail 렌더 matrix: 같은 3개 framework parity matrix이며, 렌더링한 정의
  목록을 react / vue / svelte에 걸쳐 보입니다.

공통:

- `raw` 전환: 모든 칸이 서버의 JSON 항목을 그대로 보이므로,
  콘솔의 멱등성/parity 판정을 원본 data와 대조해 검사할 수 있습니다.
- 접을 수 있는 문서 패널: 탭별 CRUDUI 문법 요약(form: role slot, 조건
  맵, compose, lang, design 노드 맵; list: columns / format / search /
  pagination; detail: fields / record / design / 구조 검증 / parity)과
  독립 검증의 근거를 담습니다.

## 기능

- 여섯 endpoint 위의 세 탭(form, list, detail). 패널들은 DOM을 공유하지 않습니다.
- matrix 보기(form: 검증 4개 + 렌더 3개; list: 검증 4개 + search
  렌더 3개 + list 렌더 3개; detail: 검증 4개 + detail 렌더 3개).
- 콘솔이 스스로 계산한 멱등성(4개 언어)과 parity(3개 framework) badge. 이 badge는
  항목별 원본 결과에서 계산하며 서버의 판정을 쓰지 않습니다. 실행된 언어나 framework가
  둘보다 적으면 미정(null)이며, 이것은 불일치와 구별됩니다.
- 콘솔의 판정을 거치지 않고 원본 응답을 읽는 `raw` 전환.
- 페이지 안의 탭별 문서 패널.
- form 예제는 `legacy/tests/fixtures/{validate,form-render}/cases.json`에서,
  list 예제는 `legacy/tests/fixtures/list-render/cases.json`에서, detail 예제는
  `legacy/tests/fixtures/{detail-render,detail-validity}/cases.json`에서 인용합니다(지어낸
  형태는 없습니다). 모든 언어와 framework에서 똑같이 실패해야 하는
  경계 사례와 비어 있는 "intentional-divergence" slot을 포함합니다.
- fixture 내보내기(탭별): 현재 실행을 대응하는
  `cases.json` 형태로 직렬화하며, 언어나 framework마다 case 하나입니다. form 검증은
  `{name,note,spec,data,expected:{valid,errors,hidden}}`, form-render는
  `{name,note,spec,data,options,expected_html}`, list는
  `{name,note,spec,rows,options,expected_html|expected_error}`, detail은
  `{name,note,spec,record,options,expected_html|expectError}`입니다. 내보낸
  어긋난 case를 자동 검사(공유하는 `legacy/tests/fixtures/*/cases.json`
  일치 검사)에
  붙여 넣으면 회귀 시험으로 남습니다.

## 실행

gateway가 이 디렉터리를 정적으로 제공합니다. 콘솔 루트에서 실행합니다.

```
node ../server/server.mjs      # serves client/ at http://localhost:<port>/
```

그다음 `http://localhost:<port>/`를 엽니다. 분리 배포에서는 gateway의
origin을 넘깁니다: `http://localhost:5173/?api=http://localhost:8020`.

## 독립 검증

콘솔과 자동 일치 검사는 같은 CRUDUI 함수
(`validate`, `renderForm`)를 서로 다른 호출 경로로 호출합니다.
콘솔은 자유롭게 입력하는 실시간 입력으로 HTTP gateway를 쓰고, 검사는
고정된 fixture로 vitest / go test / cargo test / php worker를 씁니다. 같은 입력은
같은 결과를 내야 하며, 그렇지 않으면 wrapper의 결함이 드러납니다. `raw`
전환은 콘솔의 판정을 검사할 수 있게 하고, fixture 내보내기는 실시간으로 찾은
차이를 고정된 일치 검사에 넣습니다.
