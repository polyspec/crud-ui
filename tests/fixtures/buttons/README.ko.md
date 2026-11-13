# 폼 버튼 fixture
<!-- doc-id: tests-fixtures-buttons-readme -->
<!-- source-sha256: bfcef6be3cbd07e9b467c8999376d0feec8104e50648eead827c01242b2d1891 -->

[English](README.md).

이 case들은 [폼 마크업](../../../docs/spec/form-markup.ko.md#폼-버튼)의 폼 버튼을 정의합니다. `bindButtons`는 template의
버튼을 record에 대해 평가하고, `formButtonsHtml`은 평가한 버튼을 마크업으로 렌더링합니다. TypeScript reference가 모든
기대값을 씁니다(`generate.mts`). 어떤 구현도 기대값을 손으로 쓰지 않습니다.

`cases.json`은 case 목록 하나입니다. 각 case는 `name`, `note`, `requirements`, `operation`을 가집니다.

- `bindButtons`(CURP-008): 호출 전에 `spec`을 `compileForm`으로 컴파일하거나, 컴파일된 template이 아닌 값을 `template`으로
  그대로 넘깁니다. `data`는 record(없으면 `{}`), `options`는 바인드 옵션입니다. runner는 `spec`의 컴파일 실패를 case의
  실패로 보고합니다.
- `formButtonsHtml`(CURP-009): `buttons` 목록을 그대로 넘깁니다.

`expected`는 `{ result }` 또는 `{ error: { code, message } }`입니다. `bindButtons`의 결과는 버튼 목록이며, 각 버튼은
`{ type, tag, text, attrs }`이고 속성은 출력 순서입니다. `formButtonsHtml`의 결과는 마크업 문자열입니다.

모든 runner는 두 결과를 기대값과 비교합니다. 버튼은 순서가 있는 JSON으로, 마크업은 문자열로, 오류는 코드와 메시지로
비교합니다.

checkout 루트에서 `node tests/fixtures/buttons/generate.mts`를 실행하면 case를 다시 생성합니다.
