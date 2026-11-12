# 표시 형식
<!-- doc-id: docs-spec-display-formats -->
<!-- source-sha256: d7ecccf53cde5fdaa4b0fd1876f4a1a85ae4786ecbf64f36650d0ab9099cac8b -->

[English](display-formats.md).

목록과 상세는 레코드 값을 보여 줄 뿐 편집하지 않습니다. 목록 열과 상세 필드는 값을 어떻게 표시할지 `format`으로
선언합니다. 이 문서는 선언할 수 있는 모든 형식, 목록과 상세가 받는 입력, 출력하는 마크업을 정의합니다. 모든
런타임(JavaScript, HTML 렌더러, PHP, PHP 확장, Go, Rust)은 이 규칙을 그대로 따르며, 공용
[목록](../../tests/fixtures/list-render/README.ko.md)과 [상세](../../tests/fixtures/detail-render/README.ko.md)
고정 데이터가 모든 런타임에서 각 규칙을 검사합니다. 여기에 정의하지 않은 표시 형식은 계약에 포함되지 않습니다.

## 값을 표시하는 과정

1. **CUDF-001** 열이나 필드의 `field` 경로(예: `name`, `company.name`)로 행이나 레코드에서 값을 읽습니다. 모델은 이 값을
   `value`로 유지하며, 레코드에 없는 경로는 `null`입니다.
2. **CUDF-002** `format`이 값을 `display` 모델로 바꿉니다. 문자열이거나, `badge`, `link`, `bool`, `image`, `html`은 구조화된
   값입니다.
3. **CUDF-003** 렌더러는 `display`만으로 마크업을 씁니다. 레코드를 다시 읽지 않습니다.

형식은 선언형 데이터입니다. 한 언어로 작성한 함수는 다른 언어에서 똑같이 실행할 수 없으므로 가공 함수(콜백)는
없습니다. 별도 로직이 필요한 값은 미리 계산해 레코드에 담아 전달하고, 이미
만든 마크업은 `html` 형식을 사용합니다.

```yaml
columns:
  name:   { field: name, label: { ko: 이름, en: Name }, format: { type: link, href: /users/{=id} } }
  score:  { field: score, format: { type: number, decimals: 2, thousands: true, prefix: { en: '$' } } }
  joined: { field: joined, format: { type: date, pattern: YYYY-MM-DD } }
  status: { field: status, format: { type: badge, map: { active: success, blocked: danger } } }
```

`field`와 `sort.field`는 앞에 점을 붙이지 않는 점 구분 데이터 경로입니다. 표시 토큰은
`{=path}` 형식을 사용합니다. 이 하나의 경로 모델은 객체 멤버와 연관 배열 키를 같은 방식으로
읽으며, `=`는 표시 치환임을 명확히 하여 URL과 파일 확장자의 점이 경로로 오인되지 않게 합니다.

## 형식 선언

- **CUDF-004** 생략, `true`, `false`: `text`
- **CUDF-005** `date` 같은 문자열: 설정 없는 해당 형식
- **CUDF-006** 객체: 객체의 `type`(없거나 비어 있으면 `text`)과 객체의 설정

`null`을 포함한 그 밖의 값은 [선언](#선언)에서 정한 대로 실패합니다.

아래 표에 없는 형식은 값을 `text`로 표시하고, 선언한 형식 이름은 셀 클래스에 유지합니다.

값은 다음과 같이 텍스트로 읽습니다. `null`이나 없는 값은 빈 문자열, `true`는 `1`, `false`는 빈 문자열,
객체나 배열은 빈 문자열이며, 숫자는 가장 짧은 십진 표현을 사용합니다.

콘텐츠를 받는 설정(`prefix`, `suffix`, `text`, `true`, `false`, `alt`, 뱃지와 선택 라벨)은 문자열이나
`{ ko: 이름, en: Name }` 같은 언어 맵을 받으며, [콘텐츠 규칙](schema.ko.md)으로 표시 언어의 텍스트가 됩니다.
언어 맵은 표시 언어, `en`, `ko`, 첫 키 순서에서 처음으로 비어 있지 않은 문자열 항목을 쓰고, 숫자를 포함한 그 밖의
값은 빈 텍스트입니다.

## 형식

- **CUDF-007** `text` — 설정: `truncate`; 표시: 값을 텍스트로 표시합니다.
- **CUDF-008** `date` — 설정: `pattern`; 표시: 값을 UTC 날짜로 표시합니다.
- **CUDF-009** `number` — 설정: `decimals`, `thousands`, `prefix`, `suffix`; 표시: 값을 숫자로 표시합니다.
- **CUDF-010** `badge` — 설정: `map`; 표시: 변형과 라벨을 가진 뱃지입니다.
- **CUDF-011** `link` — 설정: `href`, `target`, `text`; 표시: 링크입니다.
- **CUDF-012** `choice-label` — 설정: `items`; 표시: 값의 라벨입니다.
- **CUDF-013** `bool` — 설정: `true`, `false`, `as`; 표시: 참이나 거짓 라벨입니다.
- **CUDF-014** `image` — 설정: `width`, `height`, `alt`; 표시: 값을 원본으로 하는 이미지입니다.
- **CUDF-015** `html` — 설정: 없음; 표시: 이스케이프하지 않은 마크업입니다.

### text

`truncate`는 표시 길이를 제한합니다. 숫자만 적용하며 그 정수 부분이 제한입니다. 제한이 1 이상이고 텍스트의
유니코드 코드 포인트 수가 제한보다 많으면 앞에서부터 제한까지의 코드 포인트를 남기고 `…`(U+2026)을 붙입니다.
문자를 쪼개지 않습니다. 제한이 없거나 숫자가 아니거나(숫자 문자열 포함) 1보다 작으면 전체 텍스트를 표시합니다.

### date

값은 [날짜 값 규칙](form-runtime.ko.md)으로 해석하고 UTC로 표시합니다. `pattern`의 `YYYY`(연), `MM`(월),
`DD`(일), `HH`(24시간제 시), `mm`(분), `ss`(초) 토큰을 바꾸고 나머지 문자는 유지합니다.

- **CUDF-090** 비어 있지 않은 `pattern`이 없는 날짜 형식은 패턴 `YYYY-MM-DD`를 씁니다.
- **CUDF-091** `validateList`와 `validateDetail`은 조합 전에 명세를 CUDF-024와 CUDF-032로 검사합니다. 객체가 아닌 목록이나 상세
  명세는 `INVALID_FORM_INPUT`와 그 규칙의 메시지로 실패하며, 멤버가 없는 선언으로 통과시키지 않습니다.
 지원하는 날짜가 아닌 값은 그대로 표시합니다.

### number

숫자 값은 그대로 사용하고, 문자열은 JavaScript `Number` 규칙으로 변환합니다. 앞뒤 공백은 무시하며 `0x`, `0b`,
`0o` 접두사를 읽습니다. 유한한 숫자로 변환되지 않는 값은 그대로 표시합니다.

- **CUDF-016** `decimals`는 소수 자릿수를 정합니다. 숫자여야 하며, 소수인 자릿수는 0 방향으로 버린 결과가 0 이상 100
  이하여야 하고, 그렇지 않으면 목록이나 상세가 `Number decimals must be between 0 and 100`로 실패합니다.
  정확한 이진 값을 가장 가까운 표현으로 반올림하며 중간값은 0에서 먼 쪽으로 올리므로, `2.5`는 `3`, `-2.5`는
  `-3`, 소수 둘째 자리의 `1.005`는 `1.00`입니다. 숫자가 아닌 `decimals`는 무시합니다.
- **CUDF-017** `decimals`가 없으면 가장 짧은 십진 표현을 사용하며, 아주 크거나 작은 값은 `1e+21`, `1e-7`처럼 지수 표기를
  사용합니다.
- **CUDF-018** `thousands: true`는 정수 부분을 `,`로 묶습니다.
- **CUDF-019** `prefix`와 `suffix`는 숫자 앞뒤에 씁니다.

### badge

`map`은 값을 변형에 대응시킵니다. 문자열 변형이면 뱃지는 그 변형을 갖고 값이 라벨입니다. 언어 맵이면 번역한
텍스트가 변형이자 라벨입니다. `map`에 없는 값은 변형 없는 뱃지로 표시하고 값을 라벨로 씁니다.

### link

- **CUDF-020** `href`는 문자열이거나 [표현식 규칙](expressions.ko.md)으로 결정하는 조건 맵입니다. `href`의 명시적
  `{=path}` 토큰만 레코드의 해당 경로 값으로 바꿉니다. `{=field}`는 셀 값이며, 레코드에 없는 경로는 셀 값으로 바꿉니다.
  중괄호 밖의 텍스트는 리터럴입니다.
- **CUDF-021** `text`는 링크 문구입니다. `text`가 없거나 `null`이거나 비어 있으면 셀 값이 문구입니다.
- **CUDF-022** `target`은 비어 있지 않은 문자열일 때 씁니다.
- **CUDF-023** `javascript:` 주소는 React 서버 렌더링과 같이 오류를 던지는 주소로 바꿉니다.

### choice-label

`items`는 값에서 라벨로의 맵, 인덱스가 값인 배열, [선택 목록](schema.ko.md#선택-목록) 중 하나입니다.
값의 라벨을 표시하며, 선택 목록에서는 `value`의 정규 텍스트가 값과 같은 쌍의 라벨입니다. 동적 원천
(`{ model: … }`)은 렌더러가 읽지 않으며, 라벨이 없는 값은 그대로 표시합니다.

### bool

값이 `false`, `0`, `null`, 없음, 빈 문자열, `"0"`, `"false"`이면 거짓이고 그 밖에는 참입니다. `true`와
`false`는 각 상태의 라벨이며, 라벨이 없으면 `true`나 `false`를 표시합니다. `as`는 `text`(기본값), `icon`,
`check` 중 하나를 선택합니다.

### image

값이 이미지 원본입니다. `alt`는 번역하고 링크와 같이 명시적 `{=path}` 토큰을 바꾸며, `alt`가 없으면 대체 텍스트는
비어 있습니다. 선언한 `width`와 `height`는 텍스트로 쓰고, `null`로 선언하면 빈 속성을 씁니다. 원본이 비어 있지
않고 `data:`로 시작하지 않는 이미지는 preload 링크도 추가합니다. 아래 마크업 절을 참고하세요.

### html

값을 이스케이프하지 않고 마크업으로 씁니다. 이 형식은 그 마크업의 안전성을 검사하지 않습니다.

## 입력

목록은 명세, 행, 옵션을 받고, 상세는 명세, 레코드 하나, 옵션을 받습니다. 잘못된 입력은 코드
`INVALID_FORM_INPUT`, 아래 메시지, 빈 위치로 실패합니다. PHP에서 호출자는 객체를 `stdClass` 또는 연관 배열로 나타냅니다. 빈 배열을 포함한 목록 배열은 객체가 아니며([CURP-026](runtime-packages.ko.md)), 다른 타입의 값은 그 규칙의 메시지로 실패합니다.

- **CUDF-024** 목록 명세 — 규칙: 객체; 메시지: `List specification must be an object`
- **CUDF-025** 목록 행 — 규칙: 배열; 메시지: `List rows must be an array`
- **CUDF-026** 각 목록 행 — 규칙: 객체; 메시지: `List rows must be objects`
- **CUDF-027** 목록 명세 — 규칙: `columns` 선언; 메시지: `List specification must declare columns`
- **CUDF-028** 목록 `data` 옵션 — 규칙: 객체; 메시지: `List context must be an object`
- **CUDF-029** 목록 `page` 옵션 — 규칙: 1부터 9007199254740991까지의 정수; 메시지: `List page must be a positive integer`
- **CUDF-030** 목록 `total` 옵션 — 규칙: 0부터 9007199254740991까지의 정수; 메시지: `List total must be a nonnegative integer`
- **CUDF-031** 목록 `layout` 옵션 — 규칙: `table` 또는 `card`; 메시지: `List layout must be table or card`
- **CUDF-032** 상세 명세 — 규칙: 객체; 메시지: `Detail specification must be an object`
- **CUDF-033** 상세 레코드 — 규칙: 객체; 메시지: `Detail record must be an object`
- **CUDF-034** 상세 명세 — 규칙: `fields` 선언; 메시지: `Detail specification must declare fields`
- **CUDF-035** 상세 `data` 옵션 — 규칙: 객체; 메시지: `Detail context must be an object`

상세는 `data`, `language`, `files`, `basepath` 옵션을 받습니다. 목록 전용 옵션 `page`, `total`, `layout`은
검사하지도 사용하지도 않습니다.
`buildList`는 `layout`을 읽지 않습니다. `renderList`는 다른 목록 입력 규칙 다음, 조합 전에 이 옵션을
검사합니다.

규칙은 인자 형태를 인자 순서대로 먼저 검사하고, 그다음 선언, 마지막으로 옵션을 검사합니다. 옵션이 없거나 `null`이면 기본값을 씁니다. 빈 컨텍스트, 현재 페이지 없음, 전체 수 없음, `table` 레이아웃입니다.
`page`는 현재 페이지, `total`은 전체 레코드 수입니다. 둘 다 호출자가 제공하고 생성기는 행에서 계산하지 않으며,
명세가 `pagination`을 켠 목록은 이를 `data-page`와 `data-total`로 출력합니다. 이전·페이지 번호·다음
버튼도 출력하며 해석된 페이지 기본값은 1이고 현재 버튼에는 `aria-current="page"`와 `disabled`를
지정합니다. 해석된 페이지 모델은 이 버튼들을 `buttons`에 담고, 각 버튼은 `role`(`previous`, `page`,
`next`), `page`, `label`, `current`, `disabled`를 가집니다. 렌더러는 버튼의 글자를 역할로 고르고
(`‹`, 페이지 번호, `›`) `label`을 `aria-label`로 씁니다. 레이블은
[화면 문구](form-markup.ko.md#화면-문구)의 `list` 표(`previousPage`, `nextPage`, `{page}`를 페이지
번호로 바꾼 `page`)에서 표시 언어의 항목을 쓰고, 표에 그 언어가 없으면 영어 항목을 씁니다. 행이 없는
목록은 선언한 `empty` 문구를 보여 주고, `empty`가 없거나 `null`이면 같은 방식으로 고른 표의
`emptyList`를 보여 줍니다. 상한은 모든 런타임이 정확히
표현하는 가장 큰 정수이며, `2.0`처럼 정수 값인 수는 정수 `2`입니다. 여러
입력이 잘못되었으면 표 순서에서 처음 실패한 규칙을 보고합니다. Go와 Rust 라이브러리 시그니처는 행을 시퀀스로
받으므로, 두 언어에서 행 규칙은 해석한 JSON을 그 시퀀스로 바꾸는 곳에서 적용되고 나머지 규칙은 라이브러리가
검사합니다.

### 선언

렌더러는 목록의 `columns` 맵, 상세의 `fields` 맵, 그리고 `$ref`나 `$patch`를 가진 목록의 `search`
선언을 `validateList`, `validateDetail`과 같은 방식으로 조합합니다. 명세 루트는 조합하지 않습니다.
조합 전에 `columns`는 객체여야 하고(`Invalid columns at list: expected an object`) `fields`도
객체여야 합니다(`Invalid fields at detail: expected an object`). 조합 실패는 해당 코드와 위치를 가진
로드 오류입니다. 조합 후 렌더러는 검증기의 스캔으로 조합된 명세에서 금지 키를 찾고, 검증기와 같이 키 경로에서
로드 오류 `FORBIDDEN_META_KEY`로 실패합니다.

그다음 선언을 검사합니다. 처음 실패한 규칙은 `INVALID_FORM_INPUT`, 아래 메시지, 빈 위치로 실패합니다.
알 수 없는 키는 `Invalid {key} at {path}: unknown key`로, 형식이 틀린 값은
`Invalid {key} at {path}: expected {expected}`로 실패합니다. 검사 순서는 다음과 같습니다.

1. **CUDF-036** 루트 멤버를 멤버 순서대로 검사합니다.
2. **CUDF-037** 자체 `design`을 경로 `list` 또는 `detail`로 검사합니다.
3. **CUDF-038** 각 열이나 필드를 [멤버 순서](schema.ko.md)대로 검사합니다. 타입, 멤버 순서대로 알 수 없는 키, 그다음
   `field`, `label`, `format`, `design`, `sortable`을 경로 `columns.{이름}` 또는 `fields.{이름}`으로
   검사합니다.
4. **CUDF-039** 목록은 `search`, `sort`, `actions`(각 동작을 멤버 순서대로, 경로 `actions.{이름}`), `empty`,
   `description`, `pagination`을 경로 `list`로 검사합니다. 상세는 `actions`(각 동작을 멤버
   순서대로, 경로 `actions.{이름}`)를 경로 `detail`로 검사합니다.

`design`은 [폼 선언 규칙](schema.ko.md)을 그대로 따릅니다. 콘텐츠는 문자열, 언어 맵(멤버가 하나 이상이고 각
멤버가 문자열이나 `null`인 객체), `null` 중 하나입니다. 조건 맵은 멤버가 하나 이상인 객체입니다.

- **CUDF-040** 목록 루트 멤버 — 허용 값: `columns`, `search`, `sort`, `pagination`, `actions`, `empty`, `description`, `design`; 실패 메시지: `Invalid {key} at list: unknown key`
- **CUDF-041** 상세 루트 멤버 — 허용 값: `fields`, `actions`, `design`; 실패 메시지: `Invalid {key} at detail: unknown key`
- **CUDF-042** 루트 `$ref`, `$patch` — 허용 값: 없음: 조합은 `columns`나 `fields`에 둡니다; 실패 메시지: `Invalid $ref at list: expected composition inside columns`, `Invalid $patch at detail: expected composition inside fields`
- **CUDF-043** 열이나 필드 — 허용 값: 객체; 실패 메시지: `Invalid {name} at columns: expected an object`, `Invalid {name} at fields: expected an object`
- **CUDF-044** 열 멤버 — 허용 값: `field`, `label`, `format`, `design`, `sortable`; 실패 메시지: `Invalid {key} at columns.{name}: unknown key`
- **CUDF-045** 필드 멤버 — 허용 값: `field`, `label`, `format`, `design`; 실패 메시지: `Invalid {key} at fields.{name}: unknown key`
- **CUDF-046** `field` — 허용 값: 문자열; 실패 메시지: `Invalid field at {path}: expected a string`
- **CUDF-047** `label` — 허용 값: 콘텐츠; 실패 메시지: `Invalid label at {path}: expected a string, a language map or null`
- **CUDF-048** `format` — 허용 값: 불리언, 문자열, 객체; 실패 메시지: `Invalid format at {path}: expected a boolean, a string or an object`
- **CUDF-049** `format.type`, `format.pattern`, `format.target`, `format.as` — 허용 값: 문자열; 실패 메시지: `Invalid format.{key} at {path}: expected a string`
- **CUDF-050** `format.prefix`, `format.suffix`, `format.text`, `format.true`, `format.false`, `format.alt` — 허용 값: 콘텐츠; 실패 메시지: `Invalid format.{key} at {path}: expected a string, a language map or null`
- **CUDF-051** `format.map` — 허용 값: 객체; 실패 메시지: `Invalid format.map at {path}: expected an object`
- **CUDF-052** 각 `format.map` 라벨 — 허용 값: 콘텐츠; 실패 메시지: `Invalid format.map.{value} at {path}: expected a string, a language map or null`
- **CUDF-053** `format.href` — 허용 값: 문자열 또는 조건 맵; 실패 메시지: `Invalid format.href at {path}: expected a string or a condition map`
- **CUDF-054** `format.items` — 허용 값: 배열 또는 객체; 실패 메시지: `Invalid format.items at {path}: expected an array or an object`
- **CUDF-055** `format.items` 선택 목록 — 허용 값: [선택 목록](schema.ko.md#선택-목록)의 쌍; 실패 메시지: `Invalid format.items at {path}: expected value and label pairs with distinct string or number values`
- **CUDF-056** `sortable` — 허용 값: 불리언, 식, 조건 맵; 실패 메시지: `Invalid sortable at {path}: expected a boolean, an expression or a condition map`
- **CUDF-057** `search` — 허용 값: 불리언 또는 객체; 실패 메시지: `Invalid search at list: expected a boolean or an object`
- **CUDF-058** `sort` — 허용 값: 객체; 실패 메시지: `Invalid sort at list: expected an object`
- **CUDF-059** `sort` 멤버 — 허용 값: `field`, `dir`; 실패 메시지: `Invalid sort.{key} at list: unknown key`
- **CUDF-060** `sort.field` — 허용 값: 문자열; 실패 메시지: `Invalid sort.field at list: expected a string`
- **CUDF-061** `sort.dir` — 허용 값: `asc` 또는 `desc`; 실패 메시지: `Invalid sort.dir at list: expected asc or desc`
- **CUDF-062** `actions` — 허용 값: 객체; 실패 메시지: `Invalid actions at list: expected an object`, `Invalid actions at detail: expected an object`
- **CUDF-063** 이름이 `$ref`나 `$patch`인 동작 — 허용 값: 없음: 동작은 조합하지 않습니다; 실패 메시지: `Invalid $ref at actions: unknown key`
- **CUDF-064** 동작 — 허용 값: 스크립트 문자열 또는 객체; 실패 메시지: `Invalid {name} at actions: expected a script or an object`
- **CUDF-065** `script`가 있는 동작의 멤버 — 허용 값: `label`, `script`; 실패 메시지: `Invalid {key} at actions.{name}: unknown key`
- **CUDF-066** 그 밖의 동작 객체의 멤버 — 허용 값: `label`, `format`, `behavior`, `design`; 실패 메시지: `Invalid {key} at actions.{name}: unknown key`
- **CUDF-067** 동작 `script` — 허용 값: 문자열; 실패 메시지: `Invalid script at actions.{name}: expected a string`
- **CUDF-068** 동작 `label` — 허용 값: 콘텐츠; 실패 메시지: `Invalid label at actions.{name}: expected a string, a language map or null`
- **CUDF-069** 동작 `format` — 허용 값: 위의 `format` 규칙; 실패 메시지: `Invalid format at actions.{name}: …`
- **CUDF-070** 동작 `behavior` — 허용 값: 불리언 또는 객체; 실패 메시지: `Invalid behavior at actions.{name}: expected a boolean or an object`
- **CUDF-071** `behavior` 멤버 — 허용 값: `onchange`, `onclick`, `onload`; 실패 메시지: `Invalid behavior.{key} at actions.{name}: unknown key`
- **CUDF-072** `behavior` 항목 — 허용 값: 스크립트 문자열 또는 객체; 실패 메시지: `Invalid behavior.{event} at actions.{name}: expected a script or an object`
- **CUDF-073** `behavior` 항목 멤버 — 허용 값: `label`, `script`; 실패 메시지: `Invalid behavior.{event}.{key} at actions.{name}: unknown key`
- **CUDF-074** `behavior` 항목 `label` — 허용 값: 콘텐츠; 실패 메시지: `Invalid behavior.{event}.label at actions.{name}: expected a string, a language map or null`
- **CUDF-075** `behavior` 항목 `script` — 허용 값: 문자열; 실패 메시지: `Invalid behavior.{event}.script at actions.{name}: expected a string`
- **CUDF-076** 동작 `design` — 허용 값: `design` 규칙; 실패 메시지: `Invalid design… at actions.{name}: …`
- **CUDF-077** `empty` — 허용 값: 콘텐츠; 실패 메시지: `Invalid empty at list: expected a string, a language map or null`
- **CUDF-078** `description` — 허용 값: 콘텐츠; 실패 메시지: `Invalid description at list: expected a string, a language map or null`

그 밖의 `format` 설정(`truncate`, `decimals`, `thousands`, `width`, `height`, 표에 없는 설정)은 어떤
값이든 받습니다. 이 설정의 키에도 금지 키 스캔은 적용됩니다. `search` 객체의 멤버는 폼 선언입니다. 목록 모델은
이를 사용하지 않으며, [폼 컴파일](schema.ko.md)과 메타 스키마가 검사합니다.

`script`가 있는 동작은 스크립트 문자열과 같은 스크립트 동작입니다. 모델은
`{ key, label, behavior: { onclick: script } }`이며, `label`은 번역한 값이고 `label`이 없으면 동작
이름입니다. 스크립트 동작은 button이고 button은 `click`을 발생시키므로, 스크립트는 button을 누를 때
실행됩니다. 다른 동작 객체의 모델은 `{ key, label, format?, behavior? }`이며, `behavior`는 선언한
`behavior` 멤버 이름마다 그 스크립트 문자열 또는 객체 항목의 `script`를 멤버 순서대로 담습니다.
스크립트가 있는 항목이 없으면 `behavior`는 없습니다. 모델의 `behavior` 키는 event attribute 이름입니다.

상세는 목록과 같은 규칙, 경로, 메시지로 `actions`를 선언하며, 메시지에서 목록의 `list` 자리에
`detail`을 씁니다(`Invalid actions at detail: expected an object`). 각 동작은 같은 모델로 해석합니다.

`pagination`은 마지막에 경로 `list`로 검사합니다.

- **CUDF-079** `pagination` — 허용 값: 불리언 또는 객체; 실패 메시지: `Invalid pagination at list: expected a boolean or an object`
- **CUDF-080** 객체의 멤버 — 허용 값: `per_page` 또는 `mode`; 실패 메시지: `Invalid pagination.{key} at list: unknown key`
- **CUDF-081** `per_page` — 허용 값: 1부터 9007199254740991까지의 정수; 실패 메시지: `Invalid pagination.per_page at list: expected a positive integer`
- **CUDF-082** `mode` — 허용 값: `pages`, `offset`, `cursor`, `none`; 실패 메시지: `Invalid pagination.mode at list: expected pages, offset, cursor or none`

해석된 페이지네이션 모델의 멤버 순서는 `enabled`, 페이지네이션이 켜진 경우의 `perPage`·
`mode`·`page`(CUDF-089), 제공된 `total`, 켜진 경우의 `pageCount`입니다. 꺼진 경우에는
제공된 `page`와 `total`만 남습니다. 페이지 번호는 7페이지까지 모두 표시하고, 그보다 많으면 첫·이전·현재·다음·
마지막 페이지를 표시합니다. 전체 수가 없으면 현재 페이지는 1이고, 마지막 페이지보다 큰 페이지는 마지막 페이지를
선택합니다.

- **CUDF-089** 켜진 페이지네이션은 `per_page`가 없으면 `perPage` 20, `mode`가 없으면 `pages`, 제공된 페이지가 없으면 페이지 1을
  씁니다. 제공된 전체 수가 없으면 `pageCount`는 0입니다.

PHP에서는 [PHP API 계약](../operations/php-extension.ko.md)이 어떤 PHP 값이 객체인지 정합니다. 루트 객체 인수와 고정 객체
옵션 `data`, `files`에는 빈 PHP 배열을 받고, 중첩 값은 타입을 유지합니다.

## 마크업

- **CUDF-083** text, date, number, choice-label — 목록 표 셀: `crudui-list__cell crudui-value crudui-value--TYPE` 안의 이스케이프한 텍스트; 상세 값: `crudui-detail__value crudui-value crudui-value--TYPE` 안의 이스케이프한 텍스트
- **CUDF-084** badge — 목록 표 셀: 선택적인 `data-crudui-variant`를 가진 `span.crudui-badge`; 상세 값: `dd` 안에 같은 마크업
- **CUDF-085** link — 목록 표 셀: `href`와 선택적인 `target`을 가진 `a`; 상세 값: `dd` 안에 같은 마크업
- **CUDF-086** bool — 목록 표 셀: `data-crudui-state`와 필요한 `aria-label`을 가진 `span.crudui-bool crudui-bool--text`, `--icon` 또는 `--check`; 상세 값: `dd` 안에 같은 마크업
- **CUDF-087** image — 목록 표 셀: `src`, `alt`, 선언한 `width`와 `height`를 가진 `img`; 상세 값: `dd` 안에 같은 마크업
- **CUDF-088** html — 목록 표 셀: 이스케이프하지 않은 마크업; 상세 값: `dd` 안에 같은 마크업

상세는 `dl.crudui-detail`이며 필드마다 `dt.crudui-detail__label`과 값을 담은
`div.crudui-detail__field`를 둡니다. 목록 루트는 `crudui-list`이며 설명, 표, 제목, 셀, 카드,
빈 상태, 동작과 페이지 이동은 해당 `crudui-list__*` 요소를 사용합니다. 문자열 렌더러는
목록이나 상세 앞에 이미지 preload 링크 `<link rel="preload" as="image" href="…"/>`를 처음 사용한 순서로 중복 없이
씁니다.

번역한 `description`이 비어 있지 않은 목록은 그 텍스트를 이스케이프해
`<p class="crudui-list__description">`에 담아 `crudui-list`의 첫 자식으로, `crudui-list__actions`
앞에 씁니다. 빈 설명은 아무것도 쓰지 않습니다.

동작이 있는 목록은 `<div class="crudui-list__actions">` 안에 동작마다 멤버 순서대로
`<span class="crudui-list__action" data-action="{key}">`를 쓰며, 형식 타입이 `link`인 동작은 `a`
요소를, 다른 동작은 `<button type="button">`을 담습니다. 이 요소는 동작 모델의 `behavior` 키마다
그 키를 이름으로 하고 스크립트를 값으로 하는 attribute를 하나 가집니다. 스크립트 동작은
`onclick`을, 선언한 `behavior.onload`는 `onload`를 씁니다. 동작이 있는 상세는
`<div class="crudui-detail__actions">` 안에 동작마다 목록 동작과 같은 내부 `a` 또는 `button`
요소를 담은 `<span class="crudui-detail__action" data-action="{key}">`를 쓰며, 이 요소는
`dl.crudui-detail` 요소 앞, 문자열 렌더러의 이미지 preload 링크 뒤에 둡니다. 동작이 없는 상세는
preload 링크와 `dl.crudui-detail` 요소만 씁니다.
