# validator-go
<!-- doc-id: packages-validator-go-readme -->
<!-- source-sha256: 6104260d1fad8146f6df37d68eb2204d68a1191e44fd4223b7da31af4a2b8c90 -->

[English](README.md).

crudui 시스템의 Go 검증기입니다. `validator` 패키지는 명세를 조합하고 금지 키를
거부한 뒤 데이터를 검증하며, JavaScript·PHP·Rust 구현과 같은 적합성 사례를
통과합니다.

## API

```go
import "github.com/polyspec/crudui/packages/validator/go/validator/validate"

result, err := validate.ValidateJSON(specJSON, dataJSON, files, basepath)
```

- `validate.ValidateJSON(spec, data []byte, files map[string][]byte, basepath string)`는
  폼 명세를 조합하고 금지 키를 거부한 뒤 `data`를 검증합니다. `Valid`, `Errors`,
  그리고 `design.show`가 숨기는 필드의 데이터 경로인 `Hidden`을 가진 `ValidationResult`를 반환하며, 각 오류는 `path`, `field`,
  `rule`, `message`, `value`를 가집니다.
- `validate.ValidateListJSON(spec, files, basepath)`는 목록 명세를 조합하고 금지
  키를 거부합니다. 목록에는 행이 없으므로 깨끗하게 로드되면 유효한 결과입니다.
- `validate.ValidateDetailJSON(spec, files, basepath)`는 상세 명세와 그 `fields`
  맵에 같은 구조 검사를 수행합니다.

`files`는 `$ref` 키를 JSON 문서에 대응시키고 `basepath`는 상대 참조를 해석합니다.
해석되지 않은 `$ref`/`$patch`나 금지 키는 `*compose.ComposeLoadError`를, 형태가
잘못된 루트·그룹·반복 데이터는 코드 `INVALID_FORM_INPUT`의
`*validate.FormInputError`를 반환합니다. 실패는 유효하지 않은 결과가 아니라 오류로
반환됩니다. [검증 절차](../../../../docs/operations/validation.ko.md)가 모든 언어의
사용법을 보여 줍니다.

## 테스트

저장소 루트에서 실행합니다.

```sh
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts go --cwd legacy/packages/validator/go -- ./...               # full suite
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts go --cwd legacy/packages/validator/go -- ./validator/...     # CRUDUI conformance
```
