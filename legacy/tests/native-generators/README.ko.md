# 네이티브 생성기 적합성 검사
<!-- doc-id: tests-native-generators-readme -->
<!-- source-sha256: b2d80b4119627a0ca731396fc10863acbdfe3b8b6f71d746d7f13aed9da5da9c -->

[English](README.md).

검사기는 JavaScript 기준 구현(React 서버 렌더링), JavaScript HTML 렌더러, PHP, Go, Python,
PHP 네이티브 확장을 실행합니다. 네이티브 모듈의
절대 파일 경로가 필요합니다. 대상 누락, 프로세스 실패, 잘못된 응답, 비교 실패가
있으면 명령이 실패합니다. 보고서는 사용할 수 없는 대상을 별도로 기록하고,
실행 가능한 대상의 검사를 계속하여 실제 결과를 수집합니다.

검사기는 legacy 구현의 도구이며 고정 사본 `legacy/tests/fixtures`를 읽습니다. Rust 대상은 없습니다. Rust 코어는 그 사본을
고정한 뒤 바뀐 규칙을 따르므로 사본 위에서 낸 결과는 사본이 기록한 결과가 아니고, 거기서 비교해도 어느 쪽에 대해서도 알 수
있는 것이 없습니다. Rust 코어는 자기 시험이 `tests/fixtures`로 검사합니다.

```sh
node scripts/require-current-build.mts
composer install
node node_modules/@polyspec/kit/scripts/kit/run-tests.mts node -- legacy/tests/native-generators/protocol.test.mts
node legacy/tests/native-generators/run.mts \
  --extension /absolute/path/to/crudui.so \
  --report .git/native-generators/report.json
```

## 진행 상황, 시간 예산, 선택 실행

검사기는 실행 중에 자신의 상태를 보고합니다. 모든 줄에 시작 이후 경과 시간이
붙습니다. 먼저 입력을 해시하고 build 단계를 실행합니다. 선택한 대상의 Go
프로그램을 한 번 빌드하며, 빌드 도구의 출력과 빌드 중 5초마다의 줄을 출력하고 시간
한도는 두지 않습니다. 이어서 probe가 각 PHP 대상의 PHP 프로그램을 확인합니다. 그다음 각
검사는 시작 줄, 실행 중 5초마다의 줄, 소요 시간과 함께 결과를 출력하는 하나의 test입니다.
모든 대상의 검사는 서로 독립된 프로세스이므로 하나의 pool에서 기기의 processor 수
(`os.availableParallelism()`)만큼 동시에 실행합니다. 이어서 각 대상의 통과 수를 출력합니다.

```
[    0.6s] inputs: 744 files hashed (0.6s)
[    0.7s] targets: javascript, html, php, go, python, php-native
[    0.8s] ▶ build: go program
[    1.5s] ✔ build: go program (0.7s)
[    2.1s] checks: 4428 checks of 6 targets, 11 at a time
[    2.1s] ▶ javascript › form-fixture:text-with-nul
[    2.6s] ✔ javascript › form-fixture:text-with-nul (0.5s)
[  199.3s] go: 738/738 checks passed
```

각 검사에는 그룹에서 가장 느린 검사의 측정값으로 정한 시간 예산이 있습니다. 폼
고정 사례, 폼 인스턴스, 타임존 사례는 20초(단독 측정값 385ms, 335ms, 282ms)이고 나머지
그룹은 10초(측정값 130ms 미만)입니다. 예산을 넘긴 검사는 그 검사가 시작한 모든
프로세스와 함께 중단되고 검사 id와 함께 보고되며 실행을 실패로 만듭니다. 다른 검사는
계속 실행하므로 멈춘 검사 하나가 보고서 전체를 막지 않습니다. 빌드는 검사가 아니라 장기
작업이므로 예산이 없고 종료 상태가 결과를 정합니다.

한 대상이나 한 영역을 개발하는 동안에는 해당 검사만 실행합니다. 전체 검사는 변경이
끝난 뒤 한 번 실행합니다. 아래 명령은 차례대로 Python 대상만, Go와 네이티브 PHP 대상의
목록·상세 검사만, id에 `lang`이 들어 있는 폼 고정 사례만 실행합니다. `*`는 임의의
문자열과 일치합니다.

```sh
node legacy/tests/native-generators/run.mts --extension /absolute/crudui.so --target python
node legacy/tests/native-generators/run.mts --extension /absolute/crudui.so \
  --target go,php-native --check list,detail
node legacy/tests/native-generators/run.mts --extension /absolute/crudui.so \
  --check 'form-fixture:*lang*'
```

`--target`은 `javascript`, `html`, `php`, `go`, `python`, `php-native`를 받습니다.
`--check`는 그룹 이름(`form-fixture`, `list`, `detail`, `number`, `instance`,
`request`, `reject`, `compile-reject`, `member-order`, `bindForm-option-reject`,
`form-option-reject`, `bindForm-shape-reject`, `form-shape-reject`, `dates`, `text`), 전체
검사 id, `*`를 포함한 패턴을 받습니다. 두 옵션 모두 쉼표로 여러 값을 지정할 수 있고
여러 번 쓸 수 있습니다. 어떤 검사와도 일치하지 않는 선택은 실패하며, 보고서에
선택 내용을 기록하므로 선택 실행을 전체 실행으로 오인하지 않습니다.

검사기의 build 단계가 Go 실행 파일을 빌드합니다. `PHP`, `GO`, `CARGO`로 해당 설치 명령을
지정할 수 있습니다. 확장은 네이티브 `Polyspec\Crudui\Generator`, `Polyspec\Crudui\Validator`,
`Polyspec\Crudui\Form` 클래스를 등록해야 합니다. Reflection으로 세 클래스가 네이티브
PHP에서는 내부 클래스이고 순수 PHP에서는 사용자 정의 클래스인지 확인합니다.
PHP 메서드 서명과 수명 검사는 별도로 관리합니다. 검사 중 소스와 빌드 산출물의
해시가 유지되어야 하며 보고서는 시작과 종료 시점의 입력 목록을 기록합니다.
소스 디렉터리를 직접 읽으므로 Git이 필요하지 않습니다. `--source-commit` 또는
`CRUDUI_SOURCE_COMMIT`으로 선택적인 소스 커밋을 기록할 수 있으며 해시
비교에는 영향을 주지 않습니다.

폼 사례 185개는 전체 컴파일 템플릿과 바인딩 모델을 비교합니다. JavaScript가
각 대상의 템플릿을 바인딩하고 각 대상이 JavaScript의 템플릿을 바인딩합니다.
바인딩에는 합성 로더나 파일을 제공하지 않습니다.
명세 멤버 순서와 컨트롤 속성 순서를 비교하고, 모델은 멤버 순서까지 비교합니다. 목록 사례 157개는 이미지
리소스 힌트를 포함한 원본 HTML 문자열을 비교하고, 입력 오류와 선언 오류 사례는 코드, 메시지, 위치를
비교합니다. 기존 정규화된 레이아웃 검사는 별도로 유지합니다.
[상세 사례](../fixtures/detail-render/README.ko.md) 62개는
런타임이 제공하는 두 수준을 모두 비교합니다. 멤버 순서를 포함한 `buildDetail` 모델과
이미지 리소스 힌트를 포함한 `renderDetail` 원본 HTML입니다. 오류 사례는 두 수준에서
코드, 메시지, 위치를 비교합니다. [완전한 폼 사례](../fixtures/form-complete/README.ko.md) 28개는 원본 HTML을
명세가 쓰는 바이트와 비교하고, 옵션 오류는 코드, 메시지, 위치를 비교합니다.

추가 사례는 시퀀스 5, 7, 1 순서의 키 기반 데이터, 지정 컬렉션의 추가, 순서 변경,
저장 키 교체, 거부된 연산, 빈 컬렉션, 명시적 null, 선택 값, 클래스, CSS, 주입 및
복원 후 원본 HTML을 비교합니다. 각 주입 사례는 빈 레코드로 시작하여 데이터를
두 번 적용하고 각 결과를 초기 데이터로 생성한 결과와 비교합니다. 숫자 사례에는 JavaScript 결과만을 기준으로
삼지 않고 명시적인 소수 출력 기대값을 지정합니다. 잘못된 연산은 데이터, 필드,
HTML, 리비전을 유지해야 합니다.

`multiple: only` 컬렉션은 데이터 순서의 데이터 행만 가지며, 데이터가 없으면 행이 0개이고, 행 컨트롤을
렌더링하지 않으며, 이 컬렉션에 대한 각 행 연산은 데이터와 HTML을 그대로 둔 채 `INVALID_FORM_INPUT`과
`Rows of variants come only from data`로 실패해야 합니다. `design.show`로 숨긴 그룹은 숨긴 동안 설정한
값을 포함해 값을 유지하고, 다시 보이면 그 값을 렌더링해야 합니다. 이 기대값은 JavaScript와의 비교에
더해 검사기 안에 명세에서 작성했습니다. 컴파일은 불리언, `only`, 객체가 아닌 `multiple`, 불리언이 아닌
`multiple.only`, 그리고 `only: true`와 함께 쓴 `min`, `max`, `copy`, `sortable`, `controls`,
`onclick`을 알 수 없는 키로 거부합니다.

날짜 사례는 UTC, Asia/Seoul, America/Los_Angeles에서 실행합니다. 검사기는 `TZ`와
PHP의 `date.timezone`을 모두 설정하고 날짜/날짜시간/목록의 명시적 UTC 기대값을
비교합니다. 초기 데이터, 빈 인스턴스 주입, 비우기, 복원을 검사하며 잘못된 달력
값과 지원하지 않는 문자열은 원래 값을 유지해야 합니다.

중첩 복사는 실제 생성한 모든 키, 복사 값, 행 순서, 변경하지 않은 기존 레코드를
검사합니다. 생성한 레코드를 그대로 JavaScript와 두 번째 네이티브 인스턴스에
제공하여 전체 모델과 원본 HTML을 비교합니다. 무작위 키를 치환하거나 식별자,
값, 속성, HTML을 제거하여 비교하지 않습니다.

## 프로그램

각 런타임은 이 검사기 옆의 프로그램 하나로 응답합니다. 어떤 패키지도 이 프로그램을
배포하지 않으며, 각 프로그램은 해당 패키지의 공개 API만 호출합니다.

| 대상 | 프로그램 | 라이브러리 |
| --- | --- | --- |
| `javascript`, `html` | [`javascript.mts`](javascript.mts)(`--renderer html`은 HTML 렌더러 선택) | `@polyspec/crudui-generator-core`와 `@polyspec/crudui-generator-react` 또는 `@polyspec/crudui-generator-html` |
| `php`, `php-native` | [`programs/php/generate.php`](programs/php/generate.php) | `legacy/packages/generator/php`의 Composer 오토로더로 불러온 `polyspec/crudui-generator`. 확장을 불러오면 확장의 클래스 |
| `go` | [`programs/go`](programs/go/main.go)(자체 `go.mod`를 가진 모듈) | `legacy/packages/generator/go` |

검사기는 Go 프로그램을 빌드 디렉터리에 빌드합니다. 형식과 정적 검사는 다음과 같습니다.

```sh
gofmt -l legacy/tests/native-generators/programs/go
go -C legacy/tests/native-generators/programs/go vet ./...
```

각 프로그램은 표준 입력으로 JSON 값 하나를 받습니다. 연산은 `compileForm`, `bindForm`,
`bindButtons`, `formButtonsHtml`, `form`, `renderForm`, `renderList`, `buildList`, `buildDetail`,
`renderDetail`입니다. `renderForm`은 `template`, `data`, `options`로 인스턴스를 만들고 완전한 폼인
`renderForm(form, render)`를 반환합니다. 성공 응답은 종료 상태 0을 사용합니다. 최상위 연산 오류는
`{ "error": { "code", "message", "at" } }`이며 종료 상태 1을 사용합니다. 라이브러리를
호출하기 전에 JSON이 모든 입력의 타입을 정하며, 경계 실패는 모두 `at`이 빈
`INVALID_FORM_INPUT`입니다.

| 입력 | 메시지 |
| --- | --- |
| 표준 입력이 UTF-8이 아니거나 JSON 값 하나가 아님 | `Request must be valid JSON` |
| 요청이 객체가 아님 | `Request must be an object` |
| `options`가 있고 객체가 아님 | `Options must be an object` |
| `data`가 있고 객체가 아님 | `Form data must be an object` |
| `operation`이 어떤 연산도 아님 | `Unknown generator operation` |
| `compileForm`의 `spec`이 객체가 아님 | `A form spec must be a group with properties` |
| `bindForm`, `bindButtons`, `form`의 `template`이 컴파일된 템플릿 형태와 정확히 같지 않음 | `Unsupported form template` |
| `form`의 `actions`가 있고 배열이 아님 | `Actions must be an array` |

객체가 아니거나 폼 메서드를 지정하지 않았거나 `args` 배열이 없는 폼 액션은 해당 단계에서
`Invalid form action`으로 실패합니다. 액션 실패는 모두 해당 단계에 기록하고 실행을
계속합니다. `request` 검사는 같은 표준 입력을 모든 프로그램에 전달하고 JavaScript
결과나 그 오류 코드, 메시지, 위치를 요구합니다. 오류 코드, 메시지, 위치와 유지한
상태는 모든 구현에서 일치해야 합니다.

`text` 검사는 [`legacy/tests/fixtures/text-validity`](../fixtures/text-validity/README.ko.md)의
`compileForm`, `bindForm`, `createForm`(케이스의 액션을 포함한 `form` 연산), `buildList`,
`buildDetail` 케이스를 모두 쌍이 없는 서로게이트 이스케이프가 있는 JSON 텍스트로 보내고, 케이스의
[입력 텍스트](../../../docs/spec/input-text.ko.md) 실패나 성공을 요구합니다. 각 프로그램은 디코딩하면서
그 텍스트를 보존합니다. JavaScript는 `JSON.parse`, PHP는 `JsonText::decode`, Go는
`generator.DecodeJSON`과 템플릿 디코딩 전의 `generator.CheckBindText`를 씁니다. 마지막 검사는 UTF-8이 아닌 표준 입력을 보냅니다.
