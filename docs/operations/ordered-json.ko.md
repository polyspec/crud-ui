# JSON 문서 순서 검증
<!-- doc-id: docs-operations-ordered-json -->
<!-- source-sha256: 458b6def8e9d67e9113f72b9ff14a2a4294db236e79bd17958732ce59bd25b1d -->

[English](ordered-json.md). [폼 런타임 계약](../spec/form-runtime.ko.md)은 필요한
데이터 형태와 순서를 정의합니다. [기능 상태](../features.ko.md)는 검증과 런타임
배포를 구분해 기록합니다.

[폼 비교](form-comparison.ko.md)의 레코드 서버는 설치한 [OrderedJSON](https://github.com/polyspec/ordered-json)
package로 JSON을 읽고 씁니다. Private root Composer project는 OrderedJSON을 release의 packages.json 저장소에서
설치하고 `composer.lock`에 기록하며 `vendor/autoload.php`로 load합니다. 개발에서는 `make link`가 설치한 package folder를
`.links`가 선언한 checkout에 연결합니다. CRUDUI는 다른 저장소의 source tree를 경로로 읽지 않습니다.
OrderedJSON은 처리기를 test하며 CRUDUI는 `examples/form-comparison/src/json.test.mjs`, `servers/php`의 `FormJsonTest.php`,
Go 서버의 `json_test.go`, Rust 서버의 JSON test로 package 연동을 검사합니다. 이 검사는 member order, numeric key,
keyed row, empty type과 form data 범위 밖 숫자의 거부를 확인합니다.

폼 비교의 전송 모듈은 JSON 요청·응답과 저장소 파일에 이 처리기를 사용합니다. 처리기는 `Value` 노드를 반환하며,
JavaScript 객체 멤버는 `Map`입니다. 폼 세션은 일반 객체 데이터를 받습니다.
이 맵을 일반 JavaScript 객체로 변환하면 숫자 형태 멤버의 순서가 변경되므로
폼 변환은 그런 변경을 거부합니다.
현재 구분자를 포함한 13자리 행 키는 정수 인덱스 속성이 아니므로 기존 세션에서도
삽입 순서를 유지합니다.

폼과 JSON 전송은 같은 검증기와 저장소를 실행합니다. 런타임 연동은
[폼 검사](testing.ko.md#폼과-보고서)가 확인합니다. 레코드 저장소 HTTP 계약은 multipart, URL-encoded, JSON
저장과 잘못된 요청을 모든 레코드 서버에 보내고, 정본 흐름 검사는 모든 서버·클라이언트·초기화 방식의
폼에 입력하고 저장한 뒤 목록을 다시 불러옵니다.
