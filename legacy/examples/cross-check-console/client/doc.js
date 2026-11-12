/**
 * Spec-syntax doc shown in the collapsible side panel. Mirrors the CRUDUI
 * semantics the engine enforces (role slots, condition maps, compose,
 * lang, design node map). Each entry uses a fixture that the conformance checks
 * execute.
 */

/** @type {{ title: string, body: string }[]} */
export const docSections = [
  {
    title: '역할 슬롯 (role slots)',
    body:
      'CRUDUI 필드는 관심사를 슬롯으로 분리한다. ' +
      'validate(검증 규칙), design(show/class/style 표현식 → 마크업), ' +
      'behavior(opaque passthrough), options(buildForm 옵션). ' +
      '한 필드가 여러 슬롯을 동시에 가질 수 있다.',
  },
  {
    title: '조건맵 (condition map)',
    body:
      '{ ".vip": 10, "true": 1 } 은 선언 순서대로 first-truthy 평가한다. ' +
      '".vip" 가 truthy 면 10, 아니면 fallback "true" 가 1 을 준다. ' +
      'resolveConditionMap 의 "true" 는 항상 마지막 fallback. ' +
      '출처: validate/cases.json condition-map-min-vip.',
  },
  {
    title: '합성 ($ref / $patch)',
    body:
      'compose 패스가 $ref/$patch 를 단일 스펙으로 확장한다. ' +
      '미해결 $ref 는 로드 실패이지 valid:false 가 아니다 — ' +
      '4언어 failure{code:REF_FILE_NOT_FOUND, message, at}, 4렌더러 error 로 표면화. ' +
      '출처: form-render compose-ref-unresolved-load-error.',
  },
  {
    title: '언어 (options.language)',
    body:
      'options.language(ko/en) 가 label/text i18n 맵을 평가한다. ' +
      '동일 스펙·다른 언어 = 다른 HTML. ' +
      '상단 KO/EN 토글이 이 값을 렌더 요청 options 로 전달한다.',
  },
  {
    title: 'design 노드맵 (show)',
    body:
      'design.show 표현식이 truthy 면 표시, falsy 면 wrapper 에 ' +
      'style="display: none" 을 달되 DOM 은 유지한다(non-removal 계약). ' +
      '제거가 아니라 숨김. 출처: form-render design-show-expr-falsy.',
  },
  {
    title: '독립 검증',
    body:
      '콘솔은 임의 입력을 HTTP gateway로 전송하고 validate와 renderForm(SSR)을 호출한다. ' +
      '자동 검사는 같은 CRUDUI 함수를 vitest, go test, cargo test, PHP worker로 호출한다. ' +
      '두 경로에 같은 입력을 전달하면 같은 결과를 반환해야 한다. ' +
      'raw 토글은 원시 결과를 표시하며 fixture export는 확인한 차이를 회귀 검사 입력으로 저장한다.',
  },
];

/**
 * List-tab doc — the read-side spec syntax (columns / format / search / paging).
 * Each entry uses a list-render fixture that the conformance checks execute.
 *
 * @type {{ title: string, body: string }[]}
 */
export const listDocSections = [
  {
    title: '컬럼 (columns)',
    body:
      'list-spec 의 columns 맵이 표의 열을 선언한다. ' +
      '각 열은 field(점으로 구분한 경로, 예 "name") 로 행에서 값을 뽑고, label(문자열 또는 ko/en i18n 맵) 로 헤더를 붙인다. ' +
      'rows 는 주입(injected)이다 — list-spec 은 컬럼만 선언하고 DB 를 모른다. ' +
      '출처: list-render basic-columns.',
  },
  {
    title: '포맷 (format)',
    body:
      'column.format 이 셀 표현을 결정한다. ' +
      'date(pattern:"YYYY-MM-DD"), number(decimals/thousands/prefix), badge(map:{값→색}), ' +
      'bool(true/false 라벨, as:check), choice-label, link, image, html. ' +
      'html 포맷만 verbatim innerHTML 경계다. ' +
      '출처: list-render format-date/number/badge/bool.',
  },
  {
    title: '조건 컬럼 (design.show)',
    body:
      'column.design.show 표현식이 falsy 면 그 열은 행에서 비워진다(헤더는 유지, 값 미표시). ' +
      'design.show ".admin" 은 admin 이 truthy 인 행에서만 secret 값을 노출한다. ' +
      'options.data 와 행 값이 표현식 평가에 들어간다. ' +
      '출처: list-render column-show-expr-hidden/visible.',
  },
  {
    title: '검색폼 (search = form-spec)',
    body:
      'list-spec.search 슬롯은 그 자체가 form-spec(type:group + properties) 이다. ' +
      'list 탭은 이 슬롯을 form 탭과 동일한 /api/render 로 렌더해 리스트 위에 띄운다 — form-spec 재사용 실증. ' +
      'list 렌더러는 이 슬롯을 읽지 않는다(columns/sort/pagination/empty/actions 만 소비) — ' +
      'search 를 넣어도 list parity 는 불변. KO/EN 토글이 search 라벨에도 동일 적용된다.',
  },
  {
    title: '페이징·정렬 (선언만)',
    body:
      'pagination(per_page)·sort 는 선언적 메타다 — list-spec 은 페이지·정렬 UI 와 메타를 표면화할 뿐 ' +
      '실제 적용(쿼리)은 호출자 몫이다. options.page(현재 페이지)·options.total(전체 레코드 수)이 페이지 표시를 채운다.' +
      '출처: list-render pagination-display/sort-display.',
  },
  {
    title: 'list parity (왜 4렌더러가 한 문자열로 모이는가)',
    body:
      '같은 list-spec·같은 주입 rows 면 react/vue/svelte 의 normalizeHtml 결과가 한 개로 모여야 parity. ' +
      'React의 SSR resource hint(<link rel="preload">)는 비교 전에 제거한다. ' +
      'layout 옵션은 세 프레임워크 모두 같은 키 layout(table 또는 card)을 사용한다. ' +
      '미해결 $ref 는 로드 실패(REF_FILE_NOT_FOUND)로 표면화되지 silent skip 이 아니다.',
  },
];

/**
 * Detail-tab doc — the read-only detail specification (fields / record / design / errors).
 * Each entry uses a detail-render or detail-validity fixture that the conformance checks execute.
 *
 * @type {{ title: string, body: string }[]}
 */
export const detailDocSections = [
  {
    title: '필드 (fields)',
    body:
      '상세 스펙은 fields 맵을 선언한다. ' +
      '각 필드는 목록 셀과 같은 읽기 전용 표시 계약인 field(점-경로)·label·format·design 을 사용한다. ' +
      '정렬·페이지 처리·동작은 선언하지 않는다. 필드 순서는 docs/spec/schema.md "Member order"(멤버 순서) 규칙을 따른다. ' +
      '출처: detail-render basic-fields.',
  },
  {
    title: '레코드 (record, 주입)',
    body:
      '레코드 하나를 스펙과 별도로 전달한다 — 렌더러는 다른 데이터를 조회하지 않는다. ' +
      '필드 경로에 값이 없으면 value 는 null 이다. ' +
      '객체가 아닌 레코드는 INVALID_FORM_INPUT("Detail record must be an object")로 세 프레임워크 모두 실패한다. ' +
      '출처: detail-render missing-value, reject-record-before-fields.',
  },
  {
    title: '외형·조건 (design)',
    body:
      '루트 design.wrapper 가 상세 컨테이너의 class/style 을, 필드 design 이 그 셀의 class/style 을 정한다. ' +
      '필드 design.show 가 falsy 면 그 필드는 렌더되지 않는다. ' +
      '출처: detail-render design-wrapper-and-cell, condition-hidden-field.',
  },
  {
    title: '구조 검증 (/api/validate-detail)',
    body:
      '4언어 검증기 프로세스가 mode:detail 로 루트와 fields 맵을 합성한 뒤 금지 메타 키를 검사한다. 레코드는 검증하지 않는다. ' +
      'show_if 같은 금지 키는 valid:false 가 아니라 failure{code:FORBIDDEN_META_KEY, at:"fields.name.show_if"} 이다. ' +
      '미해결 fields $ref 는 REF_FILE_NOT_FOUND. ' +
      '출처: detail-validity red-show-if-on-field, red-unresolved-fields-ref.',
  },
  {
    title: 'detail parity',
    body:
      '같은 스펙·같은 레코드면 react/vue/svelte 의 normalizeHtml 결과가 한 개로 모여야 parity. ' +
      'React 의 SSR 이미지 preload 링크(<link rel="preload">)는 목록과 똑같이 비교 전에 제거한다. ' +
      '오류 사례는 세 프레임워크가 같은 code 로 실패해야 일치다.',
  },
];
