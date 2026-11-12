# PHP 확장
<!-- doc-id: docs-operations-php-extension -->
<!-- source-sha256: 2e3d816c75fcd01d5c8b7dbc728da180c06e11a773a8ba774ae5f433fc9ef5bb -->

[English](php-extension.md).
구현, 검증, 패키지 게시 상태는 [기능 상태](../features.ko.md)에 기록합니다.

## 범위와 모듈

`crudui` PHP 확장은 PHP 프로세스에서 폼 생성과 검증을 제공합니다.
패키지 경로는 `legacy/packages/php-ext`이며 Composer manifest가 버전을 기록합니다.
확장은 C로 폼 생성기와 검증기를 구현합니다.

생성은 구조 컴파일, 데이터 바인딩, 폼 인스턴스, HTML 렌더링을 분리합니다.
생성과 검증은 조합과 표현식을 공유합니다. 두 기능 모두 PHP 프로세스 안에서
실행합니다. 확장 실행에는 Node 프로세스, 검증 실행 파일, PHP로 구현한
생성기나 검증기가 필요하지 않습니다. Cargo, rustc, Rust 소스나 Rust
라이브러리도 필요하지 않습니다. C 모듈은 Zend 확장 API로 공통 클래스를
등록하고 PHP 값을 순서 있는 엔진 값으로 직접 변환하며 공통 PHP 예외로 엔진
오류를 전달합니다. 값 변환은 데이터를 직렬화하거나 다른 프로세스를 시작하지
않습니다.

## 공개 클래스와 로딩

PHP 패키지와 확장은 같은 공개 클래스를 제공합니다.
`Polyspec\Crudui\Generator`, `Polyspec\Crudui\Validator`, `Polyspec\Crudui\Form`을 사용합니다.
메서드 이름, 매개변수 이름, 타입, 기본값, 반환값, 예외 타입이 같습니다.
구현에 따라 API 호출이 바뀌지 않습니다.

`ComposeLoadError::getCompositionTrace()`는 원래 조합 경로 항목을 반환합니다.
예외는 이 정보를 PHP 예외 호출 스택과 별도로 저장합니다.
`getTrace()`는 PHP의 기본 동작을 유지합니다.

`FormError`와 `ComposeLoadError`는 기본값이 `null`인 네 번째 선택 인자 `?Throwable $previous`를 받습니다.
세 번째 인자는 기존 form path 또는 composition trace를 유지합니다. 두 구현의 `getPrevious()`는 전달한 원인을 반환합니다.
PHP 입력, rule 또는 composition 실패를 감쌀 때 기존 원인 예외와 안정된 오류 필드를 보존합니다.

| 프로세스 설정 | 클래스 구현 |
| --- | --- |
| `crudui` 확장 로드됨 | 확장은 모듈 초기화에서 공개 클래스를 등록합니다. PHP는 해당 클래스에 Composer를 호출하지 않고 등록된 클래스를 사용합니다. |
| 확장 로드 안 됨, PHP 패키지의 Composer 자동 로더 등록됨 | Composer는 처음 사용할 때 PHP 클래스를 로드합니다. |
| 두 구현 모두 사용 불가 | 클래스 로딩이 실패합니다. |

확장 파일을 설치하는 것만으로는 로드되지 않으며 PHP 시작 시 활성화해야
합니다. PHP 패키지는 클래스 자동 로딩을 사용하고 Composer의 `files`
설정으로 공개 클래스 정의를 포함하지 않습니다. 로드된 네이티브 클래스를
재선언하지 않습니다. 런타임 선택 코드, 클래스 별칭, 별도 네이티브
네임스페이스를 추가하지 않습니다. 로드된 구현의 오류는 해당 구현에서
반환하거나 예외로 처리하며 다른 구현으로 전환하지 않습니다.

두 구현을 함께 설치할 수 있습니다. 한 프로세스는 이 클래스들의 구현
하나를 사용합니다. PHP와 네이티브 비교는 확장을 명시적으로 비활성화하거나
활성화한 별도 프로세스에서 실행합니다. 각 검사 대상은 리플렉션으로 클래스
구현을 확인하며 확장이 없으면 네이티브 대상 검사는 실패합니다.

## 폼

확장은 키 기반 중첩 컬렉션, 기본값, 라벨, 선택 값, 표시 규칙을 포함한
[폼 런타임 계약](../spec/form-runtime.ko.md)을 따릅니다.

| API | 동작 |
| --- | --- |
| `Polyspec\Crudui\Generator::compileForm(spec, options)` | 데이터 없이 JSON으로 직렬화할 수 있는 폼 템플릿을 컴파일합니다. |
| `Polyspec\Crudui\Generator::bindForm(template, data, options)` | 템플릿과 데이터를 수정하지 않고 필드 모델을 계산합니다. |
| `new Polyspec\Crudui\Form(template, data, options)` | 독립적인 폼 인스턴스를 생성합니다. |
| `$form->setData(data)` | 인스턴스 데이터를 교체하고 필드를 다시 계산합니다. |
| `$form->getData()` | 복사된 전송 데이터를 반환합니다. |
| `$form->addRow`, `copyRow`, `removeRow`, `moveRow`, `rekeyRow` | 폼 런타임에 정의된 행 작업을 수행합니다. |
| `Polyspec\Crudui\Generator::renderForm(form, options)` | 인스턴스의 [완전한 폼](../spec/form-runtime.ko.md#완전한-폼) HTML을 반환합니다. |
| `Polyspec\Crudui\Generator::sequenceRowKey(seq)` | 저장된 시퀀스를 행 키로 변환합니다. |

컴파일은 공용 컴파일러와 같은 `files`, `basepath`, `keyPrefix` 입력을
받습니다. 바인딩과 인스턴스는 `language`, `idPrefix`, `keyPrefix`,
`unsupported`를 받습니다. 템플릿은 JavaScript에서 컴파일한 템플릿과
같은 JSON 구조를 사용하며 레코드 데이터 없이 캐싱할 수 있습니다.

HTML 생성은 지원하는 필드 타입과 레이아웃을 모두 포함합니다. 공용 이름,
식별자, 클래스, 표시 상태, 옵션, 입력 값을 유지합니다. 호스트는 HTML
`form` 요소와 전송 처리를 제공합니다. 브라우저 편집과 이벤트는 브라우저
폼 런타임을 사용합니다. PHP 폼 생성은 브라우저 스크립트를 실행하거나
브라우저 이벤트를 모의 실행하지 않습니다.

템플릿, 데이터, 옵션, 행 키가 같으면 초기 데이터와 이후 `setData` 호출은
동일한 HTML과 전송 데이터를 생성합니다. 반복 주입과 레코드 복원에도
동일성이 유지됩니다. 캐싱한 템플릿은 변경하지 않습니다.
생성된 템플릿과 전송 데이터는 React, Vue, Svelte에서도 동작합니다.

목록 생성은 JavaScript 렌더러와 같은 목록 명세와 표·카드 출력 계약을
따릅니다. `Polyspec\Crudui\Generator::buildList`는 평가한 목록 모델을 반환하고,
`Polyspec\Crudui\Generator::renderList`는 목록 명세, 표시할 행, 렌더링 옵션을 받습니다.

## 검증과 PHP 값

`Polyspec\Crudui\Validator::validate(spec, data, options)`는 전송 데이터를 검증하고
`valid`, `errors`, 그리고 `design.show`가 숨기는 필드의 데이터 경로인 `hidden`을
반환합니다([평가](../spec/validation-rules.ko.md#평가)). 오류 항목은 `path`, `field`, `rule`,
`message`, `value`를 유지합니다. `Polyspec\Crudui\Validator::validateList(spec, options)`는
목록 명세를, `Polyspec\Crudui\Validator::validateDetail(spec, options)`는 상세 명세를 검사합니다. 조합 입력은 명시적인 `files` 맵과 `basepath`를
사용합니다. 명세, 조합, 데이터 형태 실패는 예외를 발생시키며 검증 결과로
처리하지 않습니다. 검증은 공용 규칙과 적합성 검사 사례를 사용합니다.

조합 오류는 `Polyspec\Crudui\Validator\Compose\ComposeLoadError`를 사용합니다. 형태가
잘못된 제출 데이터는 `message`로 생성하는
`Polyspec\Crudui\Validator\Validate\FormInputError`를 발생시키며 `getErrorCode()`는
`INVALID_FORM_INPUT`을 반환합니다. 비어 있지 않은 순차 루트 배열은 합성 전에 이
예외를 발생시킵니다. 메시지는 [검증 절차](validation.ko.md)에서
정의합니다.
생성기 동작 오류는 `errorCode`, `message`, 선택적 `path`로 생성하는
`Polyspec\Crudui\FormError`를 사용하며 `getErrorCode()`와 `getPath()`가 동작의
오류 정보를 반환합니다. 지원하지 않는 필드는 `UNSUPPORTED_FIELD_TYPE`,
그 밖의 잘못된 폼 작업은 `INVALID_FORM_INPUT`을 사용합니다. 지원하는 필드를
생성하는 중 실패하면 `INTERNAL_ERROR`를 사용합니다. PHP 인수 타입 위반은
`TypeError`를 발생시킵니다.

PHP 스칼라 타입을 유지합니다. 순차 PHP 배열은 JSON 배열을 나타내고,
연관 배열과 `stdClass`는 객체를 나타냅니다. 명시적인 빈 객체에는
`stdClass`를 사용합니다. API가 루트 객체 타입을 정한 인수에는 빈 배열을
빈 루트 객체로 허용합니다. 다만 목록과 상세 표시의 명세, 행, 레코드, `data`에서는 목록 배열이
객체가 아닙니다([표시 형식](../spec/display-formats.ko.md#입력)). 중첩 값은 타입을 유지합니다.
JSON 입력 경계에서는 `json_decode($json, false, 512, JSON_THROW_ON_ERROR)`를
사용해야 합니다. 연관 배열 모드는 빈 객체를 보존할 수 없고, 연속된 숫자 키를
가진 객체를 배열처럼 만들 수 있습니다. 호출자가 이미 값이 객체임을 알고 있는
내부 API 호출에서는 연관 배열을 계속 사용할 수 있습니다.
`json_decode`는 쌍이 없는 서로게이트 이스케이프가 있는 JSON 텍스트를 거부합니다. 대신
[입력 텍스트](../spec/input-text.ko.md) 실패를 보고하려면 같은 값을 반환하고 그 텍스트를 검사용으로
보존하는 `Polyspec\Crudui\Validator\Support\JsonText::decode`로 디코딩합니다.
객체로 정해진 옵션 `files`, `data`에도 빈 PHP 배열을 허용합니다.
반환하는 레코드 객체와 캐시 템플릿은 `stdClass`를 사용하고 목록은 배열을
사용합니다. 양방향 변환에서 객체 항목 순서와 행 키를 유지합니다.
반환하는 템플릿과 폼, 노드, 위젯, 버튼 모델은 라이브러리와 같은 멤버 순서를 유지합니다.
지원하지 않는 PHP 값과 순환 구조는 명시적으로 실패합니다. 올바른 UTF-8이 아닌 문자열과
멤버 이름, 값 한도를 넘은 값은 메서드의 다른 검사보다 먼저 [입력 텍스트](../spec/input-text.ko.md)
규칙대로 실패합니다. 어떤 검사도 순회하지 않는 변환 값이 같은 한도를 넘으면
`Recursive or excessively nested PHP value`로 실패합니다. 검증에서는
`InvalidArgumentException`, 생성에서는 코드가 `INVALID_FORM_INPUT`인 `Polyspec\Crudui\FormError`입니다.

확장은 숨김 식별자나 순서 필드를 추가하지 않습니다. 폼 전송과 순서 보존
JSON 전송은 같은 키 기반 레코드를 전송합니다. JSON 파싱과 직렬화는
폼 생성 및 검증과 별개입니다.

## 인수 기준

확장 빌드 명령은 이전 빌드가 생성한 설정과 산출물을 제거한 뒤 현재 PHP 개발
헤더로 현재 소스를 컴파일합니다. 반복 빌드는 생성된 설정이나 산출물을 재사용하지
않으며 해당 생성 경로의 쓰기 권한을 요구하지 않습니다. 정리 범위는 생성된 설정과
빌드 산출물로 제한하며 `legacy/packages/php-ext/tests`의 추적 PHP 테스트 소스를 유지합니다.
빌드 명령은 컴파일을 시작하기 전에 모든 출력 디렉터리를 생성합니다.

빌드 명령은 `php-config` 메타데이터를 사용해 C 모듈을 직접 컴파일하고 연결합니다.
확장 패키지는 Cargo manifest, Cargo 잠금 파일과 Rust 소스를 포함하지 않습니다.
빌드는 Cargo, rustc, rustdoc을 탐색하거나 실행하지 않고 Rust 라이브러리를 연결하지
않습니다. `phpize`, Autoconf, libtool을 실행하지 않습니다.
명시한 도구 경로는 절대경로이며 정규 실행 파일 하나를 식별해야 합니다. 해당 경로와
각 상위 경로 구성요소는 심볼릭 링크가 아니어야 합니다. 도구 경로를 생략하면 빌드 시작
전에 심볼릭 링크 경로 구성요소가 없는 정규 실행 파일 하나를 발견합니다. 잘못된 명시
경로, 누락된 도구, 모호한 발견 결과가 있으면 빌드에 실패하며 작업 실패 후 다른 도구를
선택하지 않습니다. PHP 바이너리, 개발 메타데이터, 헤더는 같은 PHP 설치를 나타내야
합니다.
각 명시적 도구 경로는 명령 인수와 환경 변수 중 한 인터페이스에서만 선언합니다. 같은
입력을 두 인터페이스에 모두 선언하면 컴파일 전에 실패합니다.

Debian 계열 Linux 빌드는 설치된 `gcc` 패키지 기록을 읽고 설치된 versioned compiler
의존성 하나를 요구하며, 이 패키지의 설치된 target compiler 의존성 하나를 확인하고 해당
패키지의 정규 target compiler 파일 하나를 선택합니다. 버전이 없는 컴파일러 링크는
실행하지 않습니다. 매트릭스 빌드는 선택한 PHP 릴리스의 정규 `php-config` 파일을
전달합니다. macOS 빌드는 `php-config`를 명시하지 않으면 설치된 Homebrew PHP formula
기록 하나를 읽습니다.

Linux 빌드는 공유 객체 하나를 생성하고 플랫폼의 동적 로딩·수학·스레드 라이브러리를
연결합니다. macOS 빌드는 번들 하나를 생성하고 모듈 로드 시 PHP 심볼을 해석하며 iconv와
Core Foundation을 연결합니다. 선언한 최소 macOS 버전을 C 컴파일과 연결에 동일하게
적용합니다. 생성한 설정·객체·모듈 출력은 정규 파일과 디렉터리만 포함해야
합니다. 생성 경로가 심볼릭 링크이면 빌드에 실패합니다.

1. PHP 개발 헤더로 확장을 빌드하고 로드합니다. 확장을 활성화한 경우와
   비활성화한 경우에 같은 API 호출을 실행합니다. 두 프로세스 모두
   Composer를 등록하고 PHP 리플렉션으로 네이티브 클래스 등록 또는 PHP
   클래스 자동 로딩을 확인하며 모든 공개 메서드 시그니처를 비교합니다.
   PHP 패키지 없이도 네이티브 실행을 검사합니다.
2. 공용 조합, 표현식, 폼, 검증 사례를 네이티브 코드로 실행합니다.
   템플릿과 필드 모델을 JavaScript 생성기와 비교합니다.
3. 지원하는 모든 필드 레이아웃을 생성하고 파싱한 HTML, 속성, CSS,
   표시 상태, 입력 상태를 기존 렌더러와 비교합니다.
4. 네이티브 렌더러에서 초기 데이터, 이후 주입, 반복 주입, 복원의 HTML과
   데이터가 정확히 같은지 검사합니다.
5. 명시적인 빈 컬렉션과 실패 시 원자성을 포함하여 중첩 복사, 삽입, 제거,
   순서 변경, 저장된 시퀀스 키를 검사합니다.
6. 폼을 생성하고, 폼 및 순서 보존 JSON 요청을 수신하고, 검증하고,
   저장된 레코드를 다시 로드하는 실행 가능한 PHP 확장 예제를 제공합니다.
7. 네이티브 PHP 대상에서 React, Vue, Svelte의 브라우저 입력, 포커스,
   행 작업과 두 데이터 초기화 경로를 검증합니다.
8. CI에서 검사하고 패키지 게시와 구분하여 결과를 기록합니다.
