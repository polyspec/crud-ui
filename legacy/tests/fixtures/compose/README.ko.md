# 합성 고정 데이터
<!-- doc-id: tests-fixtures-compose-readme -->
<!-- source-sha256: 2057ce83c3bec539d728b6d60ebe8ba397993307e7b235c7bb12896b1dd709b0 -->

[English](README.md).

`cases.json`은 TypeScript, PHP, PHP 확장, Go, Rust가 공유하는 `$ref`·`$patch` 합성 사례입니다. 각 사례는
`name`, `note`, `requirements`(명세 스키마의 합성 요구사항 CUSC-007; 사례 `ref-inherit-base`는 모든 구현이 합성하므로
`docs/spec/runtime-packages.md`의 CURP-001도 나열), `input`, 그리고 `expected` 또는
`code`를 가진 `expectError`를 제공합니다. `input`은
`entry`, 선택적인 `files`, 선택적인 `kind`(기본값 `properties`, 또는 `spec`), 선택적인 `basepath`를
가집니다.

참조 상속, 경로를 지정한 참조, 여러 참조의 순서, 중첩 참조, 형제 키 덮어쓰기, 명세 수준 참조,
`basepath` 기준 상대 참조, 값을 설정·추가·교체·삭제하는 패치, 참조와 패치의 적용 순서를 검사합니다. 오류
사례는 `REF_FILE_NOT_FOUND`, `REF_FORMAT_ERROR`, `REF_DETECT_KEY_NOT_FOUND`, `REF_CYCLE`,
`PATCH_REMOVE_TARGET_MISSING`, `PATCH_PATH_CONFLICT`, `REF_VALUE_TYPE`을 다룹니다.
[명세 구조](../../../../docs/spec/schema.ko.md)가 합성을 정의합니다.

## 비교

성공 사례는 전개한 명세를 `expected`와 비교합니다. 배열은 순서를 유지합니다. TypeScript·Go·PHP 검사는
객체 멤버를 위치가 아니라 이름으로 비교하며, Go·Rust·PHP는 숫자를 값으로 비교합니다. TypeScript 검사는
`$ref`와 `$patch`가 남지 않았는지, 결과를 다시 합성해도 그대로인지도 확인합니다. 오류 사례는 기록된
`code`의 합성 로드 오류를 요구하며 메시지와 위치는 비교하지 않습니다.

[TypeScript](../../../packages/validator/ts/src/compose.conformance.test.ts),
[PHP](../../../packages/validator/php/tests/Compose/ComposeConformanceTest.php),
[Go](../../../packages/validator/go/validator/compose/conformance_test.go),
[Rust](../../../../packages/validator/rust/tests/compose_conformance.rs)의 합성 적합성 검사와
[PHP 확장 계약 검사](../../../packages/php-ext/tests/contract/compose.test.mjs)가 사용합니다.

## 재생성

패키지를 빌드한 후 저장소 루트에서 실행합니다.

```sh
node legacy/packages/validator/ts/scripts/generate-compose-cases.mts > legacy/tests/fixtures/compose/cases.json
```

생성기는 TypeScript 합성 엔진을 실행해 결과를 기록합니다. 이름이 `err-`로 시작하는 사례는 실패해야 하고
나머지 사례는 성공해야 하며, 그렇지 않으면 생성이 중단됩니다. 변경을 반영하기 전에 명세와 비교하여 검토하고
모든 사용처를 실행합니다. 재생성만으로 검증이 완료되지는 않습니다.
