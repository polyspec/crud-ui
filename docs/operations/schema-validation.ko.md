# 스키마 검증
<!-- doc-id: docs-operations-schema-validation -->
<!-- source-sha256: 7d4630585c7e95d7ebf0ffa14da7ebc55ac8c3b8d957ea9a3d257db2f2116c74 -->

[English](schema-validation.md).

npm 의존성을 설치한 후 저장소 루트에서 `make docs-schema`를 실행합니다.
명령은 Ajv로 `contracts/schema/crudui.schema.json`을 컴파일하고 공유 폼·목록 고정 데이터를
검사합니다. 스키마가 잘못되었거나 사례 결과가 다르면 실패합니다.
스키마와 기대 결과를 수정하지 않습니다.

`scripts/check-schema.mts`는 저장소에서 유효해야 하는 모든 명세를 메타 스키마로
검사합니다. 모든 고정 데이터 계열의 폼·목록·상세 명세, 각 합성 파일을 그 `$ref`가
선택하는 조각으로, `examples`와 `packages/*/examples`의 모든 예제 명세, 폼 세션 명세,
교차 검증 콘솔의 검증기 프로세스가 받아들이는 요청의 명세가 대상입니다. 입력 실패나
합성 실패를 기대하는 사례는 그런 명세가 아니므로 건너뜁니다. 의도적으로 스키마 밖에 있는 명세는 이유와 함께 스크립트에
기록하고 실패를 단언하므로, 면제가 조용히 남을 수 없습니다. 추적하는 모든 YAML 파일은
키 중복 없이 파싱되어야 하고, 스크립트가 검사하는 명세나 CLI 자체 테스트의 고정 데이터여야
합니다. 따라서 검사하지 않는 YAML 명세가 남지 않습니다.

JSON Schema는 허용하는 선언 형태를 정의합니다.
`legacy/packages/validator/ts/src/schema.ts`의 TypeScript 선언은 이에 대응하는 작성용
타입을 제공하며, `@polyspec/crudui-validator`의 entry가 이를 export하고 API report
`etc/crudui-validator.api.md`가 이를 나열합니다. 선언 계약을 변경하면 둘을 함께 수정하고 검증기 테스트,
CLI 검사와 `make docs-schema`를 실행합니다. `make docs-clean`은 스키마 파일을
보존합니다.
