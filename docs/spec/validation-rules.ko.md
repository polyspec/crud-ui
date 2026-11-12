# 검증 규칙
<!-- doc-id: docs-spec-validation-rules -->
<!-- source-sha256: ddf9e411c209b710e3eb4ae429f57be86c3720f7db5e16a4fa6ba52d55866083 -->

[English](validation-rules.md).

필드는 `validate` 아래에 규칙을 선언합니다. [스키마 계약](schema.ko.md)은
필드 구조를, [검증 API](../operations/validation.ko.md)는 진입점과 로드 실패,
입력 실패를 정의합니다.

## 등록 규칙

- **CUVR-001** `required`: `true`는 비어 있지 않은 입력값을 요구합니다.
- **CUVR-002** `email`, `url`: 해당 형식 검사를 불리언으로 활성화합니다.
- **CUVR-003** `minlength`, `maxlength`: 길이의 정수 최소 또는 최대입니다. [값](#값)을 참고합니다.
- **CUVR-004** `rangelength`: 길이의 `[최소, 최대]`입니다. [값](#값)을 참고합니다.
- **CUVR-005** `number`, `digits`: [숫자](#값) 검사 또는 숫자 문자만 허용하는 검사를 불리언으로 활성화합니다.
- **CUVR-006** `min`, `max`: 경계를 포함하는 숫자 하한 또는 상한입니다.
- **CUVR-007** `range`: 경계를 포함하는 숫자 범위 `[최소, 최대]`입니다.
- **CUVR-008** `step`: 0부터 세는 숫자 증분입니다.
- **CUVR-009** `match`, `pattern`: 값 전체에 대한 [패턴](#패턴)이며 두 이름은 같은 규칙 구현을 사용합니다.
- **CUVR-010** `equalTo`, `notEqual`: 필드 비교이며 참조 또는 리터럴 매개변수를 그대로 받습니다.
- **CUVR-011** `in`: 목록, 쉼표 문자열, 맵에 대한 [포함](#값) 여부입니다.
- **CUVR-012** `date`, `dateISO`: 날짜 형식 검사를 불리언으로 활성화합니다.
- **CUVR-058** `date`: 값이 trim한 텍스트(CUVR-019)가 `YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY` 또는 `DD/MM/YYYY`이며 존재하는 calendar 날짜를 가리키는 문자열입니다(날짜는 그 달에 맞아야 하고, 2월 29일은 윤년에만). 또는 `Z`, `+HH:MM` 또는 `-HH:MM` offset이 붙고 fraction이 없는 RFC 3339 date-time `YYYY-MM-DDTHH:MM:SS`이며, 날짜는 calendar 날짜이고 시각은 유효합니다(시 00에서 23, 분과 초 00에서 59, offset 시 00에서 23, offset 분 00에서 59). 슬래시 형식은 월-일 또는 일-월 중 어느 읽기로든 calendar 날짜이면 날짜입니다. 숫자, offset이 없는 date-time, 그 밖의 텍스트는 날짜가 아닙니다. JavaScript나 PHP date parser가 읽는 텍스트도 이 layout 중 하나가 아니면 날짜가 아닙니다.
- **CUVR-059** `dateISO`: 값이 trim한 텍스트(CUVR-019)가 `YYYY-MM-DD`이며 존재하는 calendar 날짜를 가리키는 문자열일 때만 ISO 날짜입니다. 다른 layout, 숫자, 그 밖의 값은 ISO 날짜가 아닙니다.
- **CUVR-013** `enddate`: 시작일 필드 경로이며 파싱한 종료일은 파싱한 시작일보다 이전일 수 없습니다.
- **CUVR-014** `mincount`, `maxcount`: 컬렉션 크기의 최소 또는 최대입니다.
- **CUVR-015** `unique`: 고유성 검사이며 선택적으로 참조 또는 필터 매개변수를 사용합니다.
- **CUVR-016** `accept`: 파일 확장자 또는 MIME 타입 매개변수입니다.
- **CUVR-066** `conditionTree`: `true` 또는 `judge`이며, 값은 [조건 트리](#조건-트리)이고 판정 문장은 `judge`에서만
  허용됩니다.
- **CUVR-071** `reference`: 값은 매개변수가 가리키는 필드에서 데이터가 선언한 id를 가리킵니다.
  [참조](#참조)를 봅니다.
- **CUVR-075** `containedIn`: 필드 경로입니다. 문자열 값은 참조한 필드의 문자열 값 안에 부분 문자열로 들어 있어야 하며, 참조는
  `equalTo`의 참조처럼 해석합니다. 값이나 참조한 값이 문자열이 아니면 규칙이 실패합니다.
- **CUVR-077** `typeFrom`: 필드 경로입니다. `equalTo`의 참조처럼 해석한 참조 필드의 값이 값이 가져야 할 타입을 이름 붙입니다.
  `bool`은 boolean, `int`는 소수 부분이 없는 유한한 수, `enum`은 문자열입니다. 참조한 값이 없거나 이런 타입을 이름 붙이지 않으면
  규칙이 실패합니다.
- **CUVR-079** `minFrom`, `maxFrom`: 필드 경로입니다. 값은 `equalTo`의 참조처럼 해석한 참조 필드의 값 이상(`minFrom`)이거나
  이하(`maxFrom`)인 유한한 수여야 합니다. 유한한 수가 아닌 값은 실패합니다. 참조한 값이 없거나 `null`이면 경계가 선언되지 않아
  규칙이 통과하고, 있지만 유한한 수가 아니면 실패합니다.

[TypeScript 등록부](../../packages/validator/ts/src/rules/index.ts)는 기본 규칙 이름을
정의합니다. `crudui describe`는 이 등록부에서 목록을 생성합니다.
[CLI 절차](../operations/cli.ko.md)를 참고합니다. 모든 런타임은 같은 기본 규칙을 가지며 다른 규칙을
등록하는 방법은 없습니다. 이 이름이 아닌 `validate` 또는 `messages` 키는 `UNKNOWN_RULE`로 로드에
실패합니다([매개변수 오류](#매개변수-오류) 참고). 이름은 정확히 비교하므로 `equalto`는 `equalTo`가 아닙니다.

## 평가

- **CUVR-093** `hiddenPaths(spec, data)`는 같은 명세와 데이터의 검증 결과 `hidden`이 담는 데이터 경로를 돌려줍니다.
  명세는 파일 없이 합성하고 `validate`처럼 검사하며, 데이터는 객체이고, 그 안의 다른 모양 데이터는 없는 것으로
  읽으며, 데이터 한도는 재지 않습니다. 브라우저 폼 바인딩이 필드를 보이고 숨기려고 읽습니다.
- **CUVR-090** 데이터에 멤버가 없는 필드는 값 `null`로 검증합니다. 빈 컨트롤에 아무것도 보내지 않는 폼처럼 없는 값과
  `null`은 둘 다 값이 없는 것입니다. `required`는 둘 다 실패시키고, 다른 규칙은 빈 값으로 건너뛰며, 오류의 `value`는
  `null`입니다. 데이터 자체는 그 차이를 유지합니다(CURP-025).
- **CUVR-091** 합성한 루트에 객체인 `properties`가 없는 명세는 합성 뒤 입력 실패입니다 — 코드: `INVALID_FORM_INPUT`;
  메시지: `A form spec must be a group with properties`; 빈 위치. 명세를 필드 없는 폼으로 읽지 않습니다(CUVR-088).
- **CUVR-092** JSON 텍스트 진입점에서 객체가 아닌 `options.files`는 `INVALID_FORM_INPUT`와 `Files must be an object`로,
  문자열이 아닌 `options.basepath`는 `Basepath must be a string`으로, 입력 텍스트 검사 뒤에 빈 위치로 실패합니다.

규칙은 선언 순서대로 실행하며 필드별 첫 실패에서 중단합니다. 해석된 매개변수가
`false` 또는 `null`이면 규칙을 비활성화합니다. 등록되지 않은 규칙 이름은 매개변수와 관계없이
로드 실패이므로 철자가 틀린 규칙이 검증을 조용히 끄는 일은 없습니다. 메타 스키마도 같은 이름을 거부합니다.

`number` 필드는 해당 규칙을 명시적으로 선언하지 않았으면 다른 규칙보다 먼저
암묵적인 `number` 검사를 실행합니다. 비유한 숫자 입력은 숫자 검증에 실패합니다.

- **CUVR-017** **표시 여부.** 검증하는 데이터에 대해 `design.show`가 `false`로 해석되는 필드는 숨겨진 필드입니다.
  숨겨진 필드와 그 필드에 포함된 모든 필드의 규칙은 `required`와 컬렉션 개수 규칙을 포함해 평가하지 않으며
  오류를 보고하지 않습니다. 값은 바꾸거나 제거하지 않습니다. 데이터는 값을 유지하고 다른 조건과 참조도 그
  값을 그대로 읽으므로, 필드가 숨겨진 동안 유지한 값은 데이터가 필드를 다시 보이게 하면 다시 검증합니다.
  `design.show`는 조건부 매개변수처럼(불리언, 표현식, 조건 맵을 필드의 행 문맥에서) 해석하며,
  `false`로 해석될 때만 숨기므로 `design.show`가 없거나, 조건 맵이 아무것도 선택하지 않거나, 유효한 표현식이
  아닌 문자열(리터럴)인 필드는 보이는 필드입니다. 데이터 모양은 입력 계약이므로 숨겨진 필드에도 검사합니다. 표시 여부는 데이터만으로 결정하므로 서버는 폼을 표시한
  화면과 같은 결론을 냅니다.

검증 결과는 `valid`와 `errors` 외에 `hidden` 멤버를 가집니다. 이 멤버는 `design.show`가 데이터에 대해
`false`로 결정되는 필드의 데이터 경로를 선언 순서로 담으며, 그룹 행의 필드는 행 키 아래 경로를 가지고, 숨은
필드 안의 필드도 포함합니다. 이 목록은 [브라우저 바인딩](../../packages/form-binding/README.ko.md#표시)이 `hiddenPaths`로 읽는
목록과 같습니다. 경로는 그 필드와 그 안의 모든 것을 가리키므로, 데이터를 저장하는 서버는 이 경로의 값을
저장하지 않을 수 있습니다. 검증기는 값을 바꾸지 않습니다. 아래 필드에서 데이터
`{ "is_display": 0, "display": { "code": "abc1" } }`는 `hidden`에 목록 `["display"]`를 줍니다.

```yaml
is_display: { type: text }
display:
  type: group
  design: { show: ".is_display == 1" }
  properties:
    code: { type: text, validate: { required: true } }
```

폼 데이터에는 해당 `properties` 맵에 선언한 필드만 포함합니다. 루트, 모든 그룹과 반복 그룹의
각 행에 적용하며 숨겨진 그룹에도 적용합니다. 조건식이나 규칙에서 참조하는 데이터도 선언한 필드여야
합니다. 선언되지 않은 객체 멤버는 필드 규칙을 실행하기 전에 입력 오류이며 각 객체에서는 코드 포인트
순서로 첫 멤버를 선택합니다.

단일 선택 필드는 `lang`이 없거나 `false` 또는 `null`인 `select`, `dropdown`, `selectbox`, `choice`,
`radio` 형식의 필드입니다. 이 필드는 값 하나를 가집니다. 존재하는 데이터와 반복 단일 선택 필드의 각 행
값은 문자열, 숫자, 불리언 또는 `null`입니다. 그 자리의 배열이나 객체는 비어 있어도
`Choice data must be a single value: {path}` 메시지의 입력 오류입니다. 여러 선택지를 가지는 필드는
`multichoice`, `checkboxes`, `checkcontainer`를 사용합니다. 다른 데이터 모양 검사처럼 숨겨진 필드에도
적용합니다. 필드는 선언 순서로, 필드를 행보다 먼저, 행은 정렬한 키 순서로 검사합니다.

## 키 맵

`multiple.keys`를 선언한 필드는 [키 맵](schema.ko.md#키-맵)입니다. 그 행은 참조가 가리키는 반복
그룹의 id 아래에만 존재합니다.

- **CUVR-069** 필드 데이터의 각 키는 가리키는 그룹 데이터의 행 키여야 합니다. 참조는 `enddate`
  매개변수처럼 필드의 행 문맥에서 해석하므로, 반복 그룹의 행 안에 있는 키 맵은 그 행을 둘러싼 그룹의
  데이터를 읽습니다. 그룹 데이터가 없거나 `null`이거나 객체가 아니면 id가 없습니다. id가 아닌 키는
  코드 `INVALID_FORM_INPUT`, 빈 위치, 메시지 `Row key is not an id of {reference}: {path}`의 입력
  오류입니다. `{reference}`는 선언한 참조이고 `{path}`는 행 키를 포함한 행의 데이터 경로입니다. 키 맵의
  행은 데이터에서만 오고 폼은 행을 추가하거나 제거하는 컨트롤을 제공하지 않으므로, 그룹 밖의 키는
  선언되지 않은 멤버처럼 어떤 폼도 만들지 않는 데이터입니다. 다른 데이터 모양 검사처럼 숨겨진 필드에도
  적용합니다. 필드의 키는 키 객체 검사 다음, 단일 선택 검사와 행보다 먼저, 키의 코드 포인트 순서로
  검사합니다.
- **CUVR-070** [스키마](schema.ko.md#키-맵)의 규칙대로 반복 그룹을 가리키지 않는 `multiple.keys`는
  문자열이 아닌 값을 포함해 코드 `INVALID_FORM_INPUT`, 빈 위치, 메시지
  `Invalid multiple.keys at {path}: expected a reference to a repeated group`로 로드에 실패합니다.
  `{path}`는 필드의 선언 경로입니다. 선언한 매개변수와 함께([매개변수 오류](#매개변수-오류)) 필드의
  `messages` 키 다음, 필드가 포함한 필드보다 먼저 검사하며 숨겨진 필드도 검사합니다.

[스키마 예](schema.ko.md#키-맵)에서 데이터
`{ "characters": { "c1": { "name": "Ann", "relation_notes": { "c2": "Brother" } }, "c2": { "name": "Ben" } }, "facts": { "f1": { "truth": "The will is forged", "holders": { "c1": "knows", "c3": "suspects" } } } }`는
`Row key is not an id of ..characters: facts.f1.holders.c3`로 실패합니다.

## 값

모든 런타임은 다음 정의를 적용하며, 아래 규칙은 이 밖의 공백·빈 값·텍스트 개념을 쓰지 않습니다.

- **CUVR-018** **Unicode 데이터**는 [`contracts/unicode-properties.json`](../../contracts/unicode-properties.json)에 기록된
  Unicode 16.0.0입니다. `scripts/generate-unicode-properties.mts`가 `@unicode/unicode-16.0.0`의 property 범위에서
  이 표를 만듭니다. 모든 런타임은 이 표를 내장하고 다른 Unicode 데이터를 쓰지 않으므로 모든
  코드 포인트를 똑같이 분류합니다.

- **CUVR-019** **공백**은 Unicode `White_Space` 속성을 가진 코드 포인트뿐입니다. U+0009–U+000D, U+0020,
  U+0085, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000입니다.
  U+0000, U+180E, U+200B, U+FEFF는 공백이 아닙니다. **다듬기**는 앞뒤 공백만 제거합니다.

- **CUVR-020** **빈 값**은 값 없음, `null`, 다듬은 뒤 비는 문자열, 빈 배열, 빈 객체입니다. `0`과 `false`는
  입력된 값입니다. `required`는 빈 값에서 실패합니다. `mincount`와 `maxcount`를 제외한 다른
  규칙은 빈 값을 평가하지 않고 통과시키며, 컬렉션 개수 규칙은 빈 컬렉션도 평가합니다. 데이터가 없는 반복 필드나 그룹은 빈 컬렉션입니다. 필수 입력과
  컬렉션 제한은 별도입니다. [빈 컬렉션](empty-collections.ko.md)을 참고합니다.

- **CUVR-080** option이 없는 select나 search 필드의 [placeholder option](schema.ko.md#선택-목록)
  ([CUSC-080](schema.ko.md#선택-목록)) 값은 빈 문자열이며 빈 값입니다. 제출된 placeholder는 필드가
  `required`를 선언하면 `required`에서 실패하고, `mincount`와 `maxcount`를 제외한 다른 규칙은 빈 멤버
  집합의 `in`을 포함하여 이 값을 평가하지 않고 통과시킵니다.

- **CUVR-021** **스칼라의 정규 텍스트**는 문자열이면 그 문자열, `true`는 `1`, `false`는 `0`, 유한한 숫자는
  그 double 값을 ECMAScript `Number.prototype.toString`이 쓰는 텍스트입니다. 즉 같은 double로 다시 읽히는 가장
  짧은 텍스트이며, 크기가 10^21 이상이거나 10^-6 미만이면 지수를 쓰고 음수 0은 `0`입니다. 정수는 먼저 가장
  가까운 double로 바꾸므로 `9007199254740993`은 `9007199254740992`로 씁니다.

- **CUVR-022** **길이** 규칙(`minlength`, `maxlength`, `rangelength`)은 스칼라의 정규 텍스트를 다듬지 않고
  Unicode 코드 포인트 수로 셉니다. 제한값은 0부터 9007199254740991까지의 정수이며
  `rangelength`는 최소 ≤ 최대여야 합니다. 배열이나 객체 값은 정규 텍스트가 없으므로 길이 규칙, `pattern`, `match`에 실패합니다.

- **CUVR-023** **숫자.** 유한한 수이거나, 다듬은 뒤 값이 유한한 *숫자 텍스트*인 문자열은 숫자 값입니다. 숫자 텍스트는
  HTML의 유효한 부동소수점 수입니다. 선택적인 `-` 다음에 숫자, 숫자와 `.`과 숫자, 또는 `.`과 숫자가 오고,
  선택적으로 `e`나 `E`, 선택적인 `-`나 `+`, 숫자가 옵니다
  (`^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$`). 그 값은 가장 가까운 double입니다. `+1`,
  `1.`, 16진수, `Infinity`, `NaN`, 구분 기호, ASCII가 아닌 숫자는 숫자 텍스트가 아니며, 값이 넘치는 텍스트는
  숫자가 아닙니다. 불리언, `null`, 배열, 객체는 숫자가 아닙니다.

- **CUVR-024** `number`는 숫자 값을 통과시킵니다.
- **CUVR-025** `min`, `max`, `range`는 최솟값보다 작지 않고 최댓값보다 크지 않은 숫자 값을 통과시키며, `step`은 0부터
  센 간격의 정수배인 숫자 값을 통과시킵니다. 숫자가 아닌 값은 이 규칙들에 실패합니다. 배수 여부는 값과
  간격을 정규 텍스트가 쓰는 10진수로 읽어 허용 오차 없이 정확히 판정하므로 `0.3`은 `0.1`의 배수이고
  `0.30000000000000004`는 아닙니다.
- **CUVR-026** `digits`는 정규 텍스트(문자열은 다듬은 뒤)가 ASCII 숫자로만 이루어진 문자열이나 수를 통과시키며, 불리언과
  그 밖의 값은 실패합니다.
- **CUVR-027** `mincount`와 `maxcount`는 배열의 원소나 객체의 키를 셉니다. 값 없음, `null`, 다듬으면 비는 문자열은 0개,
  그 밖의 스칼라는 1개입니다.
- **CUVR-028** 메시지는 숫자 매개변수를 정규 텍스트로 표시합니다. 기본 메시지와 선언한 메시지의 `{0}`과 `{1}`은 규칙에
  해당 매개변수가 있으면 모두 치환하고, 규칙에 없는 매개변수의 자리 표시자는 쓴 그대로 둡니다.

- **CUVR-029** **포함**(`in`)은 목록(각 원소 그대로), [선택 목록](schema.ko.md#선택-목록)([그룹](schema.ko.md#선택지-그룹)
  안을 포함한 각 선택지의 `value`), 쉼표
  문자열(U+002C로 나누고 각 항목을 다듬음), 맵(키)에서 멤버를 얻습니다. 원소 중 하나가 `value` 멤버나 `choices`
  멤버가 있는 객체인 목록은 선택 목록입니다. 선택 목록은 먼저 선택 목록 규칙(각 원소는 `value`와 `label` 멤버만
  있는 선택지이거나 `label`과 그런 선택지가 하나 이상인 `choices` 목록만 있는 그룹, 문자열이나 유한한
  숫자인 `value`, 목록 안에서 정규 텍스트가 같은 값이 둘 없음)으로 검사하고 그다음 그 값을 작성한 순서대로
  멤버로 검사하므로, 필드는 같은
  선택 목록을 `items`와 `in`에 선언할 수 있습니다. 멤버는 문자열, 숫자, 불리언이며 그 밖의 형식인 멤버와 정규 텍스트를 다듬으면 비는 멤버는
  선언 오류이며, 멤버는 순서대로 각각 형식을 먼저, 빈 값 여부를 다음에 검사합니다. 빈 목록과 빈 맵은 빈 멤버
  집합을 선언합니다. 빈 멤버 집합은 유효하며 어떤 값과도 일치하지 않으므로 선택지가 없는 필드는 빈 값을 통과시키고
  그 밖의 모든 값을 실패시킵니다. 문자열에는 항목이 항상 하나 이상 있으므로 공백뿐인 문자열은 빈 멤버입니다. 문자열 값은 다듬고, 배열
  값은 모든 원소가 통과해야 통과합니다. 빈 원소(빈 배열·빈 객체 포함)는 빈 값처럼 통과하고 비어 있지 않은 배열이나 객체
  원소는 실패합니다. 값과 멤버의 정규 텍스트가
  같은 코드 포인트이거나, 둘 다 숫자이고 값이 같으면 일치합니다. 목록 원소와 맵 키는 그대로 읽으므로 앞뒤에
  공백이 있는 멤버는 숫자 텍스트가 아닙니다. 대소문자, Unicode 정규화, 숫자가 아닌
  텍스트는 일치하지 않습니다.

- **CUVR-060** **반복 그룹의 선택지.** `items`가 [그룹 소스](schema.ko.md#반복-그룹의-선택지)인 필드는
  선언한 규칙보다 먼저 암묵적인 `in` 검사를 실행합니다. 멤버는 검증하는 데이터에서 소스가 내는 선택지의
  값이며, 값은 `in`의 멤버와 일치하는 방식으로 이 멤버와 일치합니다. 빈 값은 통과하고, 배열 값은 모든 원소가
  통과해야 통과하며, 어떤 선택지와도 일치하지 않는 값은 실패합니다. 실패는 규칙 `in`과 그 메시지로 보고하며,
  `messages.in`이 메시지를 바꿉니다. 선언한 `in`은 암묵적 검사 다음에 선언대로 실행합니다. 숨겨진 필드도
  값을 유지하므로([표시 여부](#평가)) 숨겨진 그룹의 행도 다른 행처럼 선택지가 됩니다.
  멤버는 검증할 때마다 데이터에서 읽으므로, 소스 행이 바뀐 뒤의 검증은 그 변경 뒤에 폼이 나열하는 선택지를
  검사합니다([반복 그룹의 선택지](schema.ko.md#반복-그룹의-선택지)). 브라우저 검증 바인딩은 자신이 보여 주는
  선택지를 가진 컨트롤의 데이터를 검증합니다.
- **CUVR-087** **그룹 소스의 반복된 값.** CUVR-060의 암묵적 검사가 그룹 소스의 선택지를 읽을 때, 값을
  비교하기 전에 그룹의 행을 데이터 순서로 읽으며, 선택지 값이 앞선 행 값의 정규 텍스트와 같은 행은 코드
  `INVALID_FORM_INPUT`, 빈 위치, 메시지 `Group source value repeats an earlier row: {value} at {path}`의 입력
  오류입니다. `{value}`는 정규 텍스트이고 `{path}`는 반복하는 행의 `{value}` 필드 데이터 경로(행 key 포함,
  예: `characters.c4.id`)입니다([스키마](schema.ko.md#반복-그룹의-선택지), CUSC-090). 첫 반복이 실패합니다.
  선택지가 되는 행(CUSC-063)만 비교하므로 비어 있거나 스칼라가 아닌 값은 아무것도 반복하지 않습니다.
  숨겨진 필드는 검증하지 않으므로 선택지를 읽지 않고 이 검사도 실행하지 않습니다.
- **CUVR-085** **그룹 소스의 리터럴 선택지.** `choices`가 있는 그룹 소스(CUSC-089)의 암묵적 `in` 검사 멤버는
  리터럴 선택지의 값 다음에 행 선택지의 값이 오는 하나의 집합이며, 값이 `in`처럼 그중 하나와 일치하면 통과합니다.
  선택지는 필드의 규칙보다 먼저 읽으며, 값의 정규 텍스트가 리터럴 선택지와 같은 행은 입력 실패
  `INVALID_FORM_INPUT`, 빈 위치, 메시지 `Group source value repeats a literal choice at {path}: {value}`(CUSC-089)로
  검증에 실패하므로, 집합은 한 값을 두 번 갖지 않습니다.

## 조건 트리

- **CUVR-067** `conditionTree`는 [조건 트리](schema.ko.md#조건-트리)(CUSC-072부터 CUSC-075)인 값을 통과시킵니다.
  매개변수 `true`는 group과 필드 비교를 허용하고, `judge`는 판정 문장도 허용합니다. 따라서 `true`에서는
  어느 단계에든 `judge` 조건이 있는 값이 실패합니다. 그 밖의 모든 값은 실패합니다. 문자열, 숫자, boolean,
  목록, 다른 형태의 객체, 그 형태에 없는 멤버가 있는 객체, 32단계보다 깊은 트리가 그렇습니다. 빈 값은 다른
  모든 규칙처럼 통과하므로(CUVR-020) `{}`와 `null`은 통과하고 `required`가 거부합니다. runtime은 값의 깊이와
  관계없이 값을 최대 32단계까지만 읽으며, 이 규칙의 기본 메시지는 `Please enter a valid condition.`입니다.

## 참조

`reference`는 같은 form의 한 필드의 선언 경로를 받습니다. 선언 경로는 매개변수 오류가 위치를 나타낼 때처럼 root부터의
property 이름을 `.`로 이은 것이며 행 키는 넣지 않습니다. 아래 필드에서 `facts.id`는 repeated group `facts`의 행에 있는
필드 `id`를 가리키고, 각 행의 `secrets.fact_id` 값은 facts 중 하나의 `id`여야 합니다.

```yaml
facts:
  type: group
  multiple: true
  properties:
    id: { type: text, validate: { required: true, unique: true } }
secrets:
  type: group
  multiple: true
  properties:
    fact_id: { type: text, validate: { reference: facts.id } }
```

- **CUVR-072** **Id.** 선언 경로의 id는 검증하는 데이터에서 그 필드가 가진 값입니다. 경로는 데이터 root부터 따라갑니다.
  group의 데이터는 그 필드들의 객체이고 repeated 필드의 데이터는 멤버가 행인 키 객체이므로, 경로 위 모든 repeated 필드의
  모든 행을 읽고, 가리킨 필드 자체가 repeated이면 그 모든 행 값을 읽습니다. 한 단계에서 다른 형태인 데이터와 없는 값에는
  id가 없습니다. 정규 텍스트가 다듬은 뒤 비어 있지 않은 문자열·숫자·불리언이 id이고, 빈 값·배열·객체는 id가 아닙니다.
  `design.show`로 숨겨진 필드도 값을 유지하므로(CUVR-017) 그 값도 id입니다.
- **CUVR-073** **일치.** 값이 `in`의 [포함 여부](#값) 규칙(CUVR-029)에서 id를 목록의 멤버로 삼아 멤버이면 `reference`를
  통과합니다. 문자열 값은 다듬고, 정규 텍스트가 같거나 숫자 값이 같은 id와 일치하며, 배열 값은 모든 원소가 통과해야
  통과합니다. 빈 값은 평가하지 않고 통과합니다(CUVR-020). 데이터에 id가 하나도 없으면 그 밖의 모든 값이 실패합니다.

선언 경로의 id는 `reference`가 그 id와 비교하는 값의 수와 관계없이 검증 한 번에 한 번 모읍니다.

## 패턴

`pattern`과 `match`는 HTML `pattern` 속성처럼 값의 정규 텍스트 **전체**가 일치해야 합니다. 패턴은 CRUDUI
패턴 언어를 사용합니다. 이 언어는 모든 런타임이 직접 인식하고 매칭하는 정규 언어이며, 결과가 같고 매칭 시간은
값 길이와 패턴 크기의 곱에 비례합니다.

- **CUVR-030** 리터럴: `\ ^ $ . | ? * + ( ) [ ] { }`를 제외한 모든 Unicode 스칼라 값
- **CUVR-031** 이스케이프: `\` 뒤의 `^ $ \ . * + ? ( ) [ ] { } | / -` 중 하나, `\t \n \r \f \v`, `\xHH`, `\u{H…}`(16진수 1–6자리, 스칼라 값)
- **CUVR-032** 클래스 약칭: `\d` = `[0-9]`, `\w` = `[0-9A-Za-z_]`, `\s` = 공백, `\D \W \S`는 각각의 여집합
- **CUVR-033** 임의 문자: `.` = U+000A를 제외한 모든 코드 포인트
- **CUVR-034** 대괄호 클래스: 멤버가 하나 이상인 `[…]` 또는 `[^…]`. 멤버는 리터럴, 이스케이프, `\d`, `\w`, `\s`, 속성, 끝점이 단일 코드 포인트이고 내림차순이 아닌 범위 `a-z`입니다. 클래스 안에서는 `[`, `]`, `\`, 처음이나 끝이 아닌 `-`만 이스케이프합니다
- **CUVR-035** Unicode 속성: 일반 분류(`L Lu Ll Lt Lm Lo M Mn Mc Me N Nd Nl No P Pc Pd Ps Pe Pi Pf Po S Sm Sc Sk So Z Zs Zl Zp C Cc Cf Co`)의 `\p{X}` 또는 `\P{X}`, Unicode 데이터에 있는 스크립트(Unicode `Script` 속성)의 `\p{Script=Name}` 또는 `\P{Script=Name}`
- **CUVR-036** 그룹: `(…)`, `(?:…)`, 고유하고 `[A-Za-z_][A-Za-z0-9_]*`에 맞는 이름의 `(?<name>…)`. 그룹은 최대 100단계까지 중첩합니다
- **CUVR-037** 수량자: 원자나 그룹 뒤의 `*`, `+`, `?`, `{n}`, `{n,}`, `{n,m}`(10진 숫자, n ≤ m ≤ 1000), 뒤에 `?`를 붙일 수 있음
- **CUVR-038** 선택: `|`
- **CUVR-039** 앵커: 첫 문자의 `^`와 마지막 문자의 `$`. 전체 일치에서는 의미를 더하지 않습니다

선택지와 그룹은 비어 있을 수 있고 패턴이 앵커만으로 이루어질 수도 있습니다. 거부하는 것은 빈 패턴뿐입니다.
값 전체만 매칭하므로 게으른 수량자는 탐욕적 수량자와 같은 값에 일치합니다. `C`는 `Cc`, `Cf`, `Co`,
서로게이트, 미배정 코드 포인트이며, 속성의 여집합은 그 속성 밖의 모든 코드 포인트입니다.

- **CUVR-040** **크기.** 패턴의 크기는 1000 이하입니다. 원자(리터럴, 이스케이프, 약칭, `.`, 클래스, 속성)의 크기는 1이고,
  연속과 선택은 구성 요소 크기의 합이며, 수량자가 붙은 항목은 항목 크기에 최댓값을, 상한이 없으면 최솟값 더하기
  1을 곱합니다(`*`는 1배, `+`는 2배).

그 밖의 구성은 언어에 속하지 않습니다. 역참조, 전후방 탐색, 인라인 플래그, 대소문자 무시, 단어 경계,
POSIX 클래스, 소유·중첩 수량자, `\uHHHH`, 8진수·제어 문자 이스케이프, 빈 패턴이 해당합니다.
구분자는 의미가 없어 `/x/i`는 텍스트 `/x/i`에 일치합니다. 패턴 매개변수는 문자열, `false`, `null`입니다.

## 매개변수 오류

이 정의를 벗어난 매개변수와 등록된 규칙이 아닌 규칙 이름은 로드 실패입니다. 규칙 이름과 매개변수는
조합과 금지 키 검사 다음에 검사합니다. 필드는 선언 순서로, 필드의 `validate` 규칙은 선언 순서로(규칙마다
이름을 매개변수보다 먼저), 이어서 그 필드의 `messages` 키를 선언 순서로 검사하며, 모두 그 필드가 포함한
필드보다 먼저 검사하고 첫 실패를 보고합니다. `messages` 키는 메시지를 재정의할 규칙의 이름이며, 암묵적인
`number` 검사처럼 필드가 선언하지 않은 등록 규칙을 가리킬 수 있습니다. 숨겨진 필드와 데이터가 없는 필드의
이름도 검사합니다. 위치는 필드의 선언 경로, 즉 루트부터의 속성 이름을
`.`로 이은 값이며 행 키를 포함하지 않습니다. 모든 런타임은 같은 코드와 메시지를 보고합니다.

- **CUVR-041** 등록된 규칙이 아닌 `validate` 또는 `messages` 키 — 코드: `UNKNOWN_RULE`; 메시지: `Unknown rule: {name}`
- **CUVR-094** 객체가 아닌 `validate`(규칙보다 먼저 검사) — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid validate at {path}: expected an object`. 멤버의 타입이 달라서 필드의 규칙을 건너뛰는 일은 없습니다.
- **CUVR-089** 객체가 아닌 `messages`, 또는 값이 문자열이 아닌 `messages` 멤버(멤버의 키 다음에 검사) — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid messages.{rule} at {path}: expected a string`(멤버 전체는 `Invalid messages at {path}: expected an object`). 메시지를 건너뛰지 않습니다. 텍스트가 아닌 재정의는 아무 표시 없이 기본 메시지로 돌아가기 때문입니다.
- **CUVR-042** `minlength`, `maxlength` 제한값 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid {rule} parameter: expected an integer from 0 to 9007199254740991`
- **CUVR-043** `rangelength` 제한값 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid rangelength parameter: expected [minimum, maximum] integers with minimum not above maximum`
- **CUVR-044** `number`, `digits` 매개변수 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid {rule} parameter: expected true or false`
- **CUVR-045** `min`, `max` 제한값 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid {rule} parameter: expected a finite number`
- **CUVR-046** `range` 제한값 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum`
- **CUVR-047** `step` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid step parameter: expected a finite number above 0`
- **CUVR-048** `mincount`, `maxcount` 제한값 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid {rule} parameter: expected an integer from 0 to 9007199254740991`
- **CUVR-049** 다른 형식의 `in` 멤버 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid in parameter: expected a list, a comma-separated string or a map`
- **CUVR-050** 다른 멤버, 선택지가 없는 그룹, 문자열이나 유한한 숫자가 아닌 `value`, 정규 텍스트가 같은 두 값이 있는 `in` 선택 목록 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid in parameter: expected value and label pairs with distinct string or number values`
- **CUVR-051** 문자열·숫자·불리언이 아닌 `in` 멤버 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid in parameter: members must be strings, numbers or booleans`
- **CUVR-052** 빈 멤버가 있는 `in` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid in parameter: members must not be empty`
- **CUVR-053** 다른 형식의 `pattern`, `match` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid {rule} parameter: expected a pattern string`
- **CUVR-054** 문자열이 아닌 `equalTo`, `enddate` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid {rule} parameter: expected a field reference string`
- **CUVR-076** 문자열이 아닌 `containedIn` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid containedIn parameter: expected a field reference string`
- **CUVR-078** 문자열이 아닌 `typeFrom` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid typeFrom parameter: expected a field reference string`
- **CUVR-081** 문자열이 아닌 `minFrom`, `maxFrom` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid {rule} parameter: expected a field reference string`
- **CUVR-055** 문자열·숫자·불리언이 아닌 `notEqual` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid notEqual parameter: expected a string, number or boolean`
- **CUVR-056** 불리언이나 문자열이 아닌 `unique` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid unique parameter: expected true, false or a string`
- **CUVR-074** 문자열이 아니거나, type이 `group`이 아니고 `lang`이 없거나 `false`·`null`인 form 필드의 선언 경로가 아닌 `reference` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid reference parameter: expected the declaration path of a field`
- **CUVR-057** 언어에 속하지 않는 `pattern`, `match` — 코드: `INVALID_RULE_PATTERN`; 메시지: `Invalid {rule} pattern: {reason} at {offset}`
- **CUVR-068** `true`, `false`, `null`, `judge`가 아닌 `conditionTree` — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid conditionTree parameter: expected true, false or judge`
- **CUVR-061** 규칙을 어기는 [그룹 소스](schema.ko.md#반복-그룹의-선택지). 컴파일과 같은 순서로, 필드의 `validate` 규칙보다 먼저 검사합니다 — 코드: `INVALID_RULE_PARAMETER`; 메시지: 컴파일의 메시지(CUSC-064에서 CUSC-068)이며 `{path}`는 필드의 선언 경로입니다
- **CUVR-086** 규칙(CUSC-089)을 어기는 그룹 소스의 `choices`. 그룹 소스의 나머지 다음에 검사합니다 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid items.choices at {path}: expected value and label pairs with distinct string or number values`이며 `{path}`는 필드의 선언 경로입니다

패턴의 `{reason}`은 `empty pattern`, `unexpected character`, `unsupported construct`,
`invalid escape`, `invalid class`, `invalid range`, `invalid property`, `invalid quantifier`,
`unterminated group`, `unterminated class`, `invalid group name`, `duplicate group name`, `nesting too deep`,
`pattern too large` 중 하나입니다. 언어에 없는 이스케이프는
`invalid escape`이고, `(?:`와 `(?<name>`이 아닌 `(?` 그룹은 `unsupported construct`입니다. `{offset}`은
잘못된 구성이 시작하는 코드 포인트 위치(이스케이프의 역슬래시, 그룹의 `(`, 클래스의 `[`, 수량자나 범위의
첫 문자)이며, 닫히지 않은 그룹이나 클래스는 패턴의 길이입니다. 원자나 그룹 뒤에 오지 않은 수량자 문자
(`* + ? {`), 1000을 넘는 한도, 최댓값보다 큰 최솟값은 `invalid quantifier`입니다. 대괄호 클래스 안의 `\D`,
`\W`, `\S`, 빈 클래스, 중첩된 `[`, 처음·끝·범위 연산자가 아닌 이스케이프 없는 `-`는 `[` 위치의
`invalid class`입니다. 클래스는 왼쪽부터 읽으므로 이런 멤버는 범위의 끝점 자리에 있어도 읽는 순간 보고합니다.
단일 코드 포인트가 아닌 집합인 범위 끝점과 내림차순 범위는 첫 끝점 위치의 `invalid range`이고, 클래스 안의
이스케이프나 속성 오류는 그 역슬래시 위치에서 자기 사유를 유지합니다. 후방 탐색(`(?<=`, `(?<!`)이 아니면서 유효한
이름이 `>`로 닫히지 않은 `(?<` 그룹은 `(` 위치의 `invalid group name`입니다. 처음이나 끝이 아닌 `^`와 `$`(`^`나 `$` 한 글자 패턴은 앵커),
서로게이트 코드 포인트는 `unexpected character`입니다. 101번째 중첩 단계를 여는 그룹은 그 `(` 위치의
`nesting too deep`입니다. 크기가 1000을 넘는 패턴은 위치 0의 `pattern too large`이며, 나머지가 모두 유효할 때
검사합니다.

매개변수는 스펙을 로드할 때 검사하며, 조건 맵이나 삼항식이 선택할 수 있는 모든 리터럴도 선택 여부와 관계없이
이때 검사합니다. 유효한 [표현식](expressions.ko.md)이 아닌 문자열은 리터럴입니다. 데이터에서 계산한 값만 선택될 때 검사합니다. 단순 조건식의 결과(`false`는 규칙을 끄고 `true`는 매개변수로
검사)와 경로나 조건인 삼항식 분기가 해당하며, 선택은 빈 값 건너뛰기보다 먼저 일어납니다. 런타임은 패턴 규칙을 건너뛰거나 경고하지 않습니다. 패턴을 정규식 엔진에 넘기지 않고, 이 문법으로
인식한 뒤 Unicode 데이터 위에서 자체 선형 시간 매처로 매칭합니다.

반복 스칼라 필드는 `required`, `unique`, `mincount`, `maxcount`를 컬렉션에 적용하고
다른 규칙을 각 원소에 적용합니다. 중첩 반복 그룹은 오류 경로에 행 키를 유지합니다.
[폼 런타임](form-runtime.ko.md)은 행 식별과 순서를 정의합니다.

`unique`는 `equalTo`와 같은 방식으로 값을 비교합니다. 문자열은 코드 포인트가 같은 문자열과만, 숫자는 같은
숫자와만, 불리언과 `null`은 자기 자신과만 같습니다. 타입이 다른 값은 같지 않으므로 `1`과 `"1"`은 다릅니다.
목록은 같은 값을 같은 순서로 가진 목록과 같고, 객체는 언어 값처럼 항목 순서와 관계없이 같은 이름과 값을 가진
객체와 같습니다. White_Space로 trim한 뒤 비어 있는 값은 비교에 참여하지 않습니다. 반복 필드에서는 두 값이
같으면 컬렉션이 실패하고, 반복 그룹 안의 필드에서는 앞선 행과 값이 같은 각 행이 실패하며, 필터 조건은 행마다
한 번 평가합니다. 검사 시간은 값 개수에 비례합니다.

## 데이터 한도

폼 루트는 `dataLimits`([스키마](schema.ko.md), CUSC-087)로 받아들일 데이터를 제한할 수 있으며, 이 값은
`buttons`·`action`처럼 주어진 명세에서 읽습니다. 한도를 넘으면 필드 오류가 아니라 요청의 입력 실패입니다.

- **CUVR-082** 규칙 이름과 매개변수를 검사한 뒤 어떤 규칙보다 먼저, 검증은 [값 한도](input-text.ko.md#값-한도)가
  값을 재는 방식으로 데이터를 잽니다. 단계는 CUIT-022처럼, 노드는 CUIT-021처럼 셉니다. `depth`보다 많은
  단계로 중첩된 데이터가 실패하고, 그렇지 않으면 `values`보다 많은 노드를 가진 데이터가 실패합니다. 실패의
  코드는 `INVALID_FORM_INPUT`, 메시지는 `Submitted data exceeds the {limit} limit of {n}`이며 `{limit}`은
  `depth` 또는 `values`, `{n}`은 그 한도이고, 위치는 비어 있습니다.
- **CUVR-083** `dataLimits`가 없거나 그 멤버가 없으면 기본값을 씁니다: `depth` 64, `values` 100000.
- **CUVR-084** 객체가 아니거나, `depth`와 `values` 이외의 멤버를 가지거나, `depth`가 1부터 256까지의
  정수가 아니거나, `values`가 1부터 1000000까지의 정수가 아닌 `dataLimits`는 금지 키 검사 뒤, 규칙 이름과
  매개변수 검사 전에 로드에 실패합니다 — 코드: `INVALID_RULE_PARAMETER`; 메시지: `Invalid dataLimits parameter: expected depth from 1 to 256 and values from 1 to 1000000`; 위치: 빈 경로.

## 조건부 매개변수

```yaml
type: group
properties:
  email:
    type: email
    validate:
      required: ".enabled"
      email: true
  amount:
    type: text
    validate:
      min: ".premium ? 10 : 1"
```

조건부 매개변수는 [표현식 계약](expressions.ko.md)을 사용합니다. 조건맵은 첫 번째로
일치한 값 또는 `true` 기본값을 선택합니다. 삼항식은 선택한 분기의 값을 반환합니다.

`equalTo`, `notEqual`, `unique`, `enddate`, `accept`, `match`, `pattern`, `in`, `conditionTree`는
자체 처리를 위해 매개변수를 그대로 받습니다. 특히 `enddate: period.start`는
불리언 조건이 아니라 필드 참조입니다. 따라서 `equalTo`, `notEqual`, `unique`,
`enddate`에 준 객체나 목록은 조건맵이 아니라 [매개변수 오류](#매개변수-오류)입니다.
포함 여부 검사 맵은 조건맵이 아닌 값 집합입니다. `conditionTree`의 매개변수 `judge`는 경로가 아닌
리터럴이며, `conditionTree`에 준 객체는 매개변수 오류입니다.
`equalTo`, `notEqual`, `unique`, `enddate`, `reference`, `accept`, `match`, `pattern`, `in`은
자체 처리를 위해 매개변수를 그대로 받습니다. 특히 `enddate: period.start`는
불리언 조건이 아니라 필드 참조입니다. 따라서 `equalTo`, `notEqual`, `unique`,
`enddate`, `reference`에 준 객체나 목록은 조건맵이 아니라 [매개변수 오류](#매개변수-오류)입니다.
포함 여부 검사 맵은 조건맵이 아닌 값 집합입니다.

`enddate`의 `.start`는 형제 필드, `..start`는 한 그룹 위의 필드를 공통 필드 참조
해석기로 조회합니다.

`design.show`는 필드의 규칙 실행 여부를 결정합니다. [표시 여부](#평가)를 참고합니다.
`validate.required`의 조건은 보이는 필드를 선택 입력으로 만듭니다.

## 오류와 검증

- **CUVR-088** `validate(spec, data)`는 객체인 명세를 읽습니다. 목록, 문자열, 숫자 같은 다른 명세는 루트
  데이터 검사 뒤, 합성 전에 입력 실패로 끝납니다. 코드는 `INVALID_FORM_INPUT`, 메시지는
  `Form specification must be an object`, 위치는 비어 있습니다. 명세를 필드 없는 폼으로 읽지 않습니다.

각 오류는 필드 경로·필드 이름·실패 규칙·메시지를 포함하고 값이 있으면 값도
포함합니다. 사용자 지정 메시지는 `match`와 `pattern`을 구분해 선언한 규칙 이름을
사용합니다. 기본 메시지는 규칙 구현에 정의합니다.
[사례 계약](../operations/test-fixtures.ko.md)은 기대 결과와 실패 기록을 정의합니다.

[테스트 절차](../operations/testing.ko.md)로 네 검증기 패키지 검사를 모두 실행합니다.
실제 결과는 [기능 상태](../features.ko.md)에 기록합니다. 모든 등록부에 같은 규칙
이름이 있다는 사실은 모든 입력의 동작이 같다는 증거가 아닙니다.
