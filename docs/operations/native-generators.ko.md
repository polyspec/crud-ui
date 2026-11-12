# 네이티브 생성기 검사
<!-- doc-id: docs-operations-native-generators -->
<!-- source-sha256: d6418d890e93e1ef9095eca58c2d93e438b8e3ea4a7001bae6a17c0eb9ede8c1 -->

[English](native-generators.md).

명령은 저장소 루트에서 실행합니다. PHP, Go, Rust는 독립적인 폼과 목록 생성기를
제공합니다. PHP 확장은 공용 PHP 클래스를 사용하고 네이티브 코드로 폼 생성과 검증을
실행합니다. [런타임 계약](../spec/runtime-packages.ko.md)은 필요한 동작과 비교를
정의합니다.

## 로컬 빌드와 검사

동일한 설치의 `php-config`와 개발 헤더를 갖춘 64비트 PHP를 사용합니다. 순수 PHP와
확장 모두 PHP 8.4 이상이 필요하며 CI는 PHP 8.4를 검사합니다. Composer, Node, Go, Cargo, C
컴파일러를 설치합니다. 아래 컨테이너는 필요한 Linux 빌드 도구를 제공합니다.

```sh
make install-tools TOOLS=npm
make install-packages
make install-tools
export PATH="$PWD/var/tools/bin:$PATH"
npm ci --strict-allow-scripts
composer install --no-interaction --prefer-dist
make crudui-test-native
make docs-check
```

`make crudui-test-native`는 JavaScript 패키지를 빌드한 다음 확장을 빌드하고 로드하며,
생성기 패키지 검사 및 JavaScript 기준 구현(React 서버 렌더링), JavaScript HTML 렌더러, PHP,
Go, Rust, 네이티브 PHP 비교를 실행합니다. CI가 세 job으로 실행하는 세 부분으로 이루어집니다.
`make crudui-test-php-engine`은 확장의 C 엔진을 C 컴파일러와 그 sanitizer로 컴파일해 검사하며 PHP가 필요 없습니다.
`make crudui-test-native-generators`는 Go·Rust 생성기 검사, 프로토콜·위젯 검사, JavaScript·HTML·Go·Rust 대상의
공용 검사를 실행하며 PHP가 필요 없습니다. `make crudui-test-php-api`는 확장을 빌드하고 로드한 뒤 API 검사,
PHP 생성기 검사, PHP·네이티브 PHP 대상의 공용 검사를 실행하며, CI에서는 PHP 릴리스마다 한 번 실행합니다.
각 런타임은 패키지의 공개 API를 호출하는
[`legacy/tests/native-generators/programs`](../../legacy/tests/native-generators/README.ko.md#프로그램)의
프로그램으로 응답하며, 패키지는 라이브러리만 배포합니다.
`make build-php-ext`는 `phpize`로 `legacy/packages/php-ext/src`의 extension을
`var/php-ext/polyspec_crudui.so`에 빌드합니다. `PATH`의 `phpize`와 `php-config`가 PHP 릴리스를
정하며, job은 `setup-php`의 `tools: phpize, php-config`로 이를 설치합니다.

PHP API 검사는 Composer 클래스, Composer 없는 확장, Composer를 함께 사용하는
확장의 세 프로세스를 실행합니다. 리플렉션은 실제 클래스 구현과 모든 공개 메서드
서명을 검사합니다. 공용 생성기 검사는 템플릿, 평가된 필드, 데이터, 행 동작, 원본
HTML과 각 거부의 코드·메시지·위치 전체를 비교합니다. 실행 전후 입력 해시를 기록하고
입력이 변경되면 실패합니다.

기본 보고서는 Git 디렉터리의 `native-generators/report.json`(JavaScript, HTML, Go, Rust 대상)과
`native-generators/report-php.json`(PHP, 네이티브 PHP 대상)이며 `git rev-parse --git-path`로
결정하므로 worktree에서도 동작합니다. `NATIVE_REPORT`와 `PHP_NATIVE_REPORT`로 다른 보고서 경로를 지정합니다.
`make crudui-test-php-api`는 어떤 PHP 검사보다 먼저 `legacy/packages/generator/php`의 검증기 복사본을 다시 설치하므로
PHP 검사가 소스보다 오래된 복사본을 읽지 않습니다. 통과한 실행은 임시 빌드 디렉터리를 삭제합니다. 실패한
실행은 디렉터리를 남기고 경로를 출력하며 보고서의 `buildDirectory`에 기록합니다. [검사 절차](../../legacy/tests/native-generators/README.ko.md)는
명시적인 확장 경로를 사용하는 직접 실행과 비교 프로토콜을 설명합니다. 실행 파일이나
네이티브 클래스가 없거나 응답 형식이 잘못되면 검사가 실패합니다.

브라우저 위젯 검사는 Chromium에서 생성된 선택자와 콜백을 실행합니다. 호스트 편집기
함수는 전달된 선택자와 인수를 검사합니다. 외부 편집기 구현을 설치하거나 검증하는
검사는 아닙니다.

## HTTP와 브라우저 검증

패키지 예제는 각 언어의 라이브러리 사용을 보여 줍니다.
[폼 비교](form-comparison.ko.md)는 JavaScript, PHP, 네이티브 PHP, Go, Rust 레코드 서버와
HTML, React, Vue, Svelte 클라이언트를 정의합니다. 그 레코드 저장소 HTTP 계약은 multipart, URL-encoded,
JSON 저장과 잘못된 요청을 모든 서버에 보내고, 저장한 레코드를 재시작 뒤에도 다시 읽습니다
([폼 검사](testing.ko.md#폼과-보고서)).

브라우저에서 생성한 폼과 PHP, Go, Rust 검증 엔드포인트만으로는 서버 렌더링이
확인되지 않습니다. 서버 렌더링 결과에는 컴파일, 바인딩, 렌더링을 실행한 런타임을
기록해야 합니다. 정확한 소스, 검사 결과와 배포는 [기능 상태](../features.ko.md)에
구분해서 기록합니다.
