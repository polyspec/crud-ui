# 폼 템플릿 형태

<!-- doc-id: tests-fixtures-template-shape-readme -->
<!-- source-sha256: 6b93f2d858e0a7931969966c6ab3e93f7c9652fb2c26076a36636d84bed0adbf -->

[English](README.md).

이 case들은 [폼 구조](../../../../docs/spec/form-runtime.ko.md)(CURT-092)의 폼 템플릿 형태를 정의합니다. `bindForm`,
`bindButtons`, `createForm`은 `compileForm`이 만드는 형태와 정확히 같은 템플릿만 받습니다. 그 밖의 값은
`INVALID_FORM_INPUT`, 메시지 `Unsupported form template`, 빈 위치로 실패합니다.

`cases.json`은 세 operation마다 `compileForm`이 쓰는 템플릿, 선택 멤버 `keyPrefix`, `action`, `description`을 가진 템플릿,
그리고 형태 위반마다 하나의 거부 case를 담습니다. 위반은 없거나 알 수 없는 멤버, 잘못된 type의 멤버, `children`이 없는
필드, 알 수 없는 멤버를 가진 필드, 객체가 아닌 버튼, `crudui/form-template`이 아닌 `kind`, null `keyPrefix`, 문자열 `action`입니다.
각 case는 `name`, `note`, `requirements`(CURT-092), `operation`, `template`, `data`, `options`, `expect`를 가집니다.
`expect`는 `"pass"`이거나 `at`이 빈 `{ code, message, at }`입니다.

모든 expectation은 TypeScript 기준 구현이 [`tests/fixtures/template-shape/generate.mts`](../../../../tests/fixtures/template-shape/generate.mts)로 씁니다.

`decodeFormTemplate`의 JSON Pointer는 이 case에 없습니다. 그 decoder는 TypeScript API이며, pointer는
`decode-template.test.ts`의 TypeScript test가 검사합니다.

## case 바꾸기

이 폴더는 legacy 구현이 읽는 case의 사본이며([AGENTS.md](../../../../AGENTS.ko.md)) `cases.json`은 직접 고칩니다. legacy 구현이 차이 시험의 기준으로 남는 동안, `docs/spec`의 규칙을 바꾸는 변경은 legacy 구현과 함께 이 사례도 바꿉니다. 공유 fixture `tests/fixtures/template-shape`의 생성기는 [`tests/fixtures/template-shape/generate.mts`](../../../../tests/fixtures/template-shape/generate.mts)입니다.
