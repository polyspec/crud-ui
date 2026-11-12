# CRUDUI Go 생성기
<!-- doc-id: packages-generator-go-readme -->
<!-- source-sha256: ecf59c7e791390df4c01c3334e076a82bb11cda5d56d7238062f95c6f9f3ad21 -->

[English](README.md).

Go 패키지는 폼 템플릿 컴파일, 데이터 바인딩, 키 기반 행 관리, 폼·목록·상세 HTML
렌더링을 제공합니다. 생성은 Go에서 실행하며 명세 합성과 표현식 평가를 Go
검증기와 공유합니다.

## 사용

```go
import generator "github.com/polyspec/crudui/packages/generator/go"

spec := generator.NewObject("type", "group", "properties",
    generator.NewObject("name", generator.NewObject("type", "text", "label", "Name")))
template, err := generator.CompileForm(spec, generator.CompileOptions{})
if err != nil { return err }
form, err := generator.NewForm(template,
    generator.NewObject("name", "Ada"), generator.BindOptions{Language: "en"})
if err != nil { return err }
html, err := generator.RenderForm(form, nil)
```

`CompileForm`은 레코드 데이터 없이 합성을 처리합니다. 템플릿은 `encoding/json`으로
직렬화하고 `FormTemplate`으로 디코딩할 수 있습니다. `BindForm`은 템플릿이나
레코드를 변경하지 않고 폼 문법의 노드 모델(`field`, `group`, `collection`, `row`,
`lang`, `lang-item`)을 반환합니다. `BindOptions.Language`는 내용과 컨트롤 문구의
언어이며 `ko`(기본값), `en`, `ja`, `zh`만 허용합니다. `NewForm`은 템플릿과
레코드를 복사하여 인스턴스를 생성합니다.

`Form.SetData`는 레코드를 교체합니다. `GetData`, `GetValue`, `Fields`, `Template`은
복사한 값을 반환합니다. `SetValue`는 필드 하나를 수정합니다. 행 연산은 `AddRow`,
`CopyRow`, `RemoveRow`, `MoveRow`, `RekeyRow`이며 컬렉션 경로는 레코드 루트를
기준으로 합니다. 연산이 실패하면 데이터, 필드 모델, 리비전이 유지됩니다.
`RenderForm`은 인스턴스를 변경하지 않고 현재 상태를 렌더링합니다. nil 옵션은 `crudui-form` 블록을 쓰고
옵션 객체는 이를 [완전한 폼](../../../../docs/spec/form-runtime.ko.md#완전한-폼)으로 만듭니다.

`BuildList`는 목록 모델을 반환합니다. `RenderList`의 `ListOptions.Layout`은 `table`
또는 `card`입니다. 호출자가 목록 데이터를 제공하며 생성기는 데이터베이스를
조회하지 않습니다. 기본 이미지 셀은 처음 사용하는 순서에 따라 중복 없는
preload 링크를 생성합니다. 원시 HTML 내용은 리소스 링크를 생성하지 않습니다.

`BuildDetail`과 `RenderDetail`은 전달한 레코드 하나를 읽고 순서가 있는 읽기 전용
필드를 반환하거나 렌더링합니다. 목록 표시 포맷터를 재사용하며 다른 데이터를
조회하지 않습니다.

날짜 컨트롤, 날짜시간 컨트롤, 날짜 목록 셀은 UTC를 사용합니다. 허용하는 ISO와
RFC 2822 값은 하나의 엄격한 파서로 처리하고 잘못되거나 지원하지 않는 문자열은
그대로 유지합니다. 렌더링은 명시적 offset을 변환하며 원래 인스턴스 데이터는
유지합니다. 날짜시간 컨트롤은 초를 포함합니다.

## 순서가 있는 값

객체는 공용 삽입 순서 객체 타입인 `*generator.Object`를 사용합니다.
`NewObject(key, value, ...)`로 생성하거나 `DecodeJSON`으로 디코딩합니다. 배열은
`[]any`, JSON null은 `nil`입니다. 순서가 없는 네이티브 맵과 순환 값은 거부합니다.
예제의 검증용 맵은 조회만 수행하는 별도 값이며 저장 데이터는 순서 표현을
유지합니다.

반복 필드는 키 기반 객체를 사용합니다. `SequenceRowKey(42)`는
`__0000000000042__`를 반환하고 `CreateRowKey()`는 무작위 13자리 16진수 키를
생성합니다. 키는 부모 컬렉션 안에서 식별자로 사용됩니다. 반복 데이터가 없으면
기본 행 하나를 생성하며 명시적인 빈 객체는 행 0개를 생성합니다. 배열과 null은
반복 컬렉션으로 사용할 수 없습니다.

`AddRowOptions.Value`는 행 데이터를 지정합니다. 스칼라 행의 명시적인 null을
지정하려면 `ValueProvided: true`를 설정합니다. 두 필드를 모두 생략하면 필드
기본값을 적용합니다. `Key`는 행 키, `AfterKey`는 삽입 위치를 지정합니다.

명시적으로 빈 `KeyPrefix`로 컴파일하려면 `CompileOptions.KeyPrefixProvided`를
설정합니다. `BindOptions` 필드는 `nil`이면 기본값을 사용합니다. `IDPrefix`는
`crudui`, `Language`는 `ko`, `KeyPrefix`는 템플릿 접두사, `Unsupported`는
`throw`입니다. 값을 지정하면 문자열이어야 하고 `Unsupported`는 `throw` 또는
`marker`여야 하며, 그 외 값은 거부합니다. 접두사 없이 컴파일하거나 인스턴스에
명시적인 빈 접두사(`KeyPrefix: ""`)를 지정하면 해당 이름 구간을 생략합니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts go --cwd legacy/packages/generator/go -- ./...
go -C legacy/packages/generator/go run ./examples/server -data /tmp/crudui-go-record.json
```

예제는 레코드 세트 하나, 즉 `-data` 파일에 저장한 레코드로 폼, 목록, 상세를
렌더링합니다. 이 레코드에 대한 폼 명세(이름, 이메일, 선택 항목인 가입일), 목록 명세,
상세 명세를 선언하며 모든 페이지는 `crudui.css`에서 스타일을 가져옵니다.

- `http://127.0.0.1:8087/`은 폼입니다. Go가 템플릿을 한 번 컴파일하고 저장한 레코드를
  렌더링합니다. 폼 또는 JSON 전송 데이터를 검증한 뒤 유효한 레코드를 명시적으로
  지정한 JSON 파일에 저장하고 다시 로드합니다.
- `/list`는 저장한 레코드를 `RenderList`로 렌더링합니다. 예제는 레코드 하나를
  저장하므로 목록의 행은 그 레코드 하나이고, 처음 저장하기 전에는 행이 없습니다.
  이름은 상세 페이지로 가는 `link`, 이메일은 `text`, 가입일은 `date` 형식입니다.
- `/detail`은 저장한 레코드를 `RenderDetail`로 렌더링합니다. 이름은 `text`, 이메일은
  `mailto:` `link`, 가입일은 `date`입니다. 처음 저장하기 전에는 빈 레코드를 표시합니다.

`/template`은 재사용할 템플릿을, `/data`는 저장한 레코드를 반환합니다. 예제는
스칼라 필드 세 개를 사용하며 React, Vue, Svelte 비교 행렬을 제공하지 않습니다.

```sh
curl -H 'Content-Type: application/json' \
  --data '{"name":"Ada","email":"ada@example.test","joined":"2026-01-02"}' \
  http://127.0.0.1:8087/
curl http://127.0.0.1:8087/list
curl http://127.0.0.1:8087/detail
```

[네이티브 공통 검사](../../../../tests/native-generators/README.ko.md)는 이 패키지의 공개 API를
호출하는 프로그램으로 다른 런타임과 결과를 비교합니다.
