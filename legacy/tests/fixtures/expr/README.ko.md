# 공통 표현식 고정 사례
<!-- doc-id: tests-fixtures-expr-readme -->
<!-- source-sha256: 42e5deb9d3eb83dfa013de11be0a0ecda38e7a8bbbfb3bc3382f323e450dddfe -->

[English](README.md).

TypeScript·PHP·Go·Rust와 PHP 확장은 `cases.json`을 불러옵니다. 각 사례는
표현식, 기대 토큰·AST, 기대 불리언·값 결과를 포함한 데이터 컨텍스트를
제공합니다. 거부 사례는 `name`, `expr`, `requirements`, 파싱 오류 메시지의 첫 줄인 `error`만
포함하며 메시지를 보고하지 않는 PHP 확장은 파싱에 실패하는지 확인합니다.
[표현식 계약](../../../../docs/spec/expressions.ko.md)이 의미를 정의합니다.
토큰·AST 비교에서는 소스 위치를 제외합니다.

각 사례는 `requirements`에 자기가 시험하는 [표현식 계약](../../../../docs/spec/expressions.ko.md)의 id를 나열합니다.
사례가 그 id가 정의하는 토큰 종류·공백·트리 노드를 포함하면 그 id를 나열합니다(토큰은 CUXP-001~CUXP-017, 공백은
CUXP-016, 트리 노드는 CUXP-018~CUXP-023). 사례 `path-sibling-truthy`는 [런타임 패키지](../../../../docs/spec/runtime-packages.ko.md)의
CURP-001도 나열합니다: 모든 구현이 표현식을 평가합니다.

토큰은 `type`, `value`, `literal`을 포함합니다. 공백은 제외하며 마지막 토큰은
`EOF`입니다. AST 필드는 다음과 같습니다.

| 노드 | 필드 |
| --- | --- |
| Ternary | `type`, `condition`, `trueValue`, `falseValue` |
| Binary | `type`, `operator`, `left`, `right` |
| Unary | `type`, `operator`, `operand` |
| In | `type`, `negated`, `value`, `list` |
| Path | `type`, `relative`, `levelsUp`, `segments` |
| Literal | `type`, `valueType`, `value` |
| Group | `type`, `expression` |

경로 세그먼트는 문자열 값을 가진 `identifier`, 값이 없는 `wildcard`, 숫자 값을
가진 `index` 타입입니다. 데이터 컨텍스트는 `data`, 선택적인 `currentPath`,
선택적인 `rowKeys`(`currentPath`에서 행 키의 0부터 시작하는 위치), 기대 `value`, 기대
`truthy`를 포함합니다.

사례는 상대·와일드카드 경로, 비교, 포함 검사, 스칼라와 비교하는 배열이나 객체,
JSON 값으로 비교하는 두 배열이나 두 객체, 문자열 비교에서 불리언의 텍스트,
논리 우선순위, 중첩 삼항식,
경로 비교, 불리언 변환, 닫히지 않은 목록, 중첩 한도를 검사합니다. 한도
사례는 괄호·부정·연쇄·삼항식이 정확히 64 단계인 식, 각각 한 단계를 넘는 식,
괄호 10,000 겹의 식입니다. 빈 배열과 객체는 조건에서 참이며 필수
입력 검증은 별개입니다. 조건맵 키를 표현식으로 검사하지만 이 사례만으로
맵의 순서에 따른 선택을 증명하지는 않습니다. 두 사례의 데이터는 숫자 1을
`1.0`으로 쓰며, 런타임은 이를 `1`과 다른 타입으로 decode할 수 있지만 값으로
비교해야 합니다. 어떤 사례도 PHP가 배열로 decode하는 빈 객체나 key가 `0`, `1`, …인
객체를 갖지 않습니다.

패키지를 빌드한 후 저장소 루트에서 다시 생성합니다.

```sh
node legacy/packages/validator/ts/scripts/generate-expr-cases.mts > legacy/tests/fixtures/expr/cases.json
```

생성기는 실제 TypeScript 토큰·AST·결과를 기록합니다. 다만 `expected`가 있는
데이터 컨텍스트는 계약이 정한 결과를 기록하므로 이 픽스처는 TypeScript 엔진도
판정합니다. 생성된 변경을 계약과
대조하고 모든 언어 테스트와 PHP 확장 엔진 테스트를 실행합니다. 실패한 구현을 통과시키기 위한
목적으로만 기대 결과를 변경하면 안 됩니다.
