# Wave 배경
<!-- doc-id: docs-plans-waves -->
<!-- source-sha256: 7ebdbe1ae74ed3c49f9364bbe1a1055cd1ca1ab662e647d7913ad997368d20ea -->

[English](plan.md).

각 section은 [execution checklist](checklist.ko.md)의 wave 하나의 의존과 배경을 적으며, checklist의 wave 제목이 이 section을 link한다.

## Wave 1

의존: 없음. `@polyspec/crudui-generator-core/crudui.css`는 CRUDUI block의 유일한 stylesheet이고, 좁은 viewport를 위한 rule이 없다. form, list, detail을 phone 폭으로 여는 test도 없다. Tailwind CSS로 꾸미는 page는 CRUDUI style을 그 Tailwind build와 theme으로 build할 수 없다. CRUDUI는 고유 stylesheet와 Tailwind 버전을 함께 내고, 둘 중 어느 것이든 CRUDUI block을 꾸민다.

## Wave 2

의존: 없음. AGENTS의 rule은 feature가 끝날 때마다 full suite를 실행하게 했고, 긴 작업은 step log로 timeout을 대신하게 했다. suite를 실행하는 CI job은 모든 test 위에 10~30분의 job timeout을 둔다. benchmark driver test는 Go와 Rust driver를 test 안에서 600초 한도로 compile한다. tree verification의 build readiness 대기는 state file을 1초마다 읽고, 그 test는 wall-clock 시간을 한도와 비교한다. `scripts/run-tests.mjs`의 PHPUnit mode는 class와 data provider suite를 통과한 test로 세고, TeamCity message가 아닌 줄을 모두 버린다.

## Wave 3

의존: 없음. 다른 checkout의 실행이 같은 resource를 쓴다: `/tmp` 아래의 고정 directory, Linux style check의 Playwright image, comparison deployment, 그리고 package build가 비우고 다른 repository가 pack하는 `dist` directory. 한 실행이 다른 실행이 쓰는 resource를 바꾸거나 초기화할 수 있다. 한 실행이 소유할 수 있는 resource는 그 실행의 directory나 이름을 받고, 하나뿐인 resource는 holder lock을 받는다: 한 번에 한 holder, holder의 checkout, pid, process 시작 시각을 밝히는 거부, holder에 의한 해제.

## Wave 4

의존: 없음. checklist가 사용법의 범례와 C2.1-2의 문장에 작업 상태 표시를 적었으므로, file의 표시를 세는 도구가 존재하지 않는 진행 중 작업을 셌다. 작업 상태 밖의 checklist를 읽는 검사가 없었다.

## Wave 5

의존: 없음. CI는 2026-09-25부터 모든 push에서 실패했고, 같은 tree에서 local `make ci`는 통과했다. local full run은 이전 실행의 build 결과물이 있는 working tree에서 시작하고 macOS의 Apple clang으로 C를 compile한다. CI는 각 job을 새 checkout에서 시작하고 Linux의 GCC로 compile한다. 실패한 step은 그 job의 이후 검사를 건너뛰게 했고, `make crudui-test-native`의 실패한 prerequisite는 native suite를 건너뛰게 했으므로, CI 실행 한 번이 모든 실패를 보여 주지 않았고 conformance 검사는 그것을 써야 했던 suite 없이 빠진 evidence를 보고했다.

## Wave 6

의존: 없음. AGENTS와 testing 안내는 모든 진행 중 작업이 끝났을 때만 push한다고 정하지만, 이를 강제하는 것이 없었다. 진행 중 작업이 있는 push가 GitHub에 도달했고, GitHub의 CI는 push된 tree에서 full suite를 실행한다. Git은 hook을 version 관리하지 않고 `core.hooksPath`는 clone마다의 설정이므로, hook은 그것을 설치한 clone에서만 동작하며 `git push --no-verify`나 다른 clone은 hook 없이 push한다. GitHub은 file의 내용으로 push를 거부할 수 없고, workflow는 push가 받아들여진 뒤에 실패한다. branch의 ruleset은 push된 commit에서 통과한 check를 요구할 수 있으므로, commit은 다른 branch에서 그 check를 통과한 뒤에만 `main`에 도달할 수 있다.

## Wave 7

의존: 없음. 날짜, machine, 실행 순서에 따라 달라지는 결과가 있었다. GNU Make 3.81과 4에서 출력이 다른 make dry run, 정확한 toolchain version 대신 release channel, test case나 명령 없이 통과하는 실행, 처음 실패한 suite에서 멈추는 연결, 다른 명령이 남긴 출력을 읽는 검사, 다른 실행이 읽는 동안 제자리에 쓰는 출력, 사용 전에 확인한 port, machine npm을 바꾸는 설치, 명령, 경로, 한도가 없는 실패, 변경의 소유 검사를 기계적으로 고르지 않는 것, 죽이지만 기다리지 않는 process tree다. 이런 종류의 결함은 모든 repository에서 class로 고치고, AGENTS에 class마다 규칙 하나를 둔다.

## Wave 8

의존: 없음. 필드나 그룹은 다른 필드에 대한 조건으로 `design.show`를 선언하고, 검증기 다섯 개는 숨은 필드와 그 안의 모든 규칙을 건너뛰므로, 부모 값이 끈 가지에는 필수 필드가 없다. 빈 곳이 넷 남아 있다. 브라우저 바인딩은 현재 데이터로 검증하지만 서버가 쓴 `hidden` 속성을 유지하므로, 필드는 새 페이지에서만 나타나거나 사라지고, 보이는 필드의 규칙이 건너뛰어지며, 숨은 노드에 오류가 남는다. 반복 그룹의 필드에서 위로 올라가는 상대 경로는 행 키를 별도의 단계로 세므로, 행 안의 `..x`는 옆의 필드 대신 collection의 멤버를 읽고, 결과가 키의 모양에 따라 달라진다. 서버는 제출된 값 중 어느 것이 숨은 필드의 값인지 알 수 없다. Rust 검증기는 `design.show` 문자열을 다른 런타임의 expression 검사 없이 expression으로 결정한다. 부모는 자식의 `design.show`로 자식을 전환하고, 숨은 가지는 검증하지도 바꾸지도 않으며, 이 빈 곳은 모든 런타임에서 공유 사례와 함께 메운다.

## Wave 9

의존: 없음. polyspec 저장소는 패키지 이름을 조직 이름으로 짓는다. template은 `polyspec/template`과 namespace `Polyspec\Template\`, `@polyspec/template-workspace`, crate `polyspec-template`을, hyper는 `polyspec/hyper`, `Polyspec\Hyper\`, `@polyspec/hyper`를 쓴다. CRUDUI는 npm 패키지를 `@crudui/*`로, Composer 패키지를 `crudui/generator`와 `crudui/validator`로, PHP 클래스를 `CRUDUI\` 아래에, crate를 `crudui-generator`와 `crudui-validator`로 지었으므로, polyspec 패키지에는 두 규칙이 섞여 있었다. CRUDUI는 template과 hyper의 규칙을 따른다.

## Wave 10

의존: 없음. 폼 비교는 OrderedJSON을 `polyspec/ordered-json`의 tag `v0.0.3`에서 받고 그 tree의 package 이름을 쓴다. version 0.1까지 polyspec 저장소는 다른 polyspec 저장소에 그 저장소의 GitHub tag로 의존한다.

## Wave 11

의존: 없음. 모든 변경은 pull request와 merge queue로 `main`에 들어가므로 `main`의 모든 commit은 필수 check를 통과했다. release는 `main` commit의 tag `vX.Y.Z`, 하위 디렉터리의 Go module이면 `<디렉터리>/vX.Y.Z`이고, maintainer가 version을 정하는 pull request 다음에 tag를 만들며 pull request는 tag를 싣지 않는다. ruleset `main`은 check `push-gate`와 CI workflow의 완료 check `ci-passed` 하나를 요구하므로 CI job을 추가하거나 이름을 바꿔도 ruleset은 바뀌지 않는다. 변경 기록은 다음 release의 변경을 `## Unreleased` 아래에 두고, release pull request가 그 section 이름을 `## X.Y.Z`로 바꾼다.

## Wave 12

의존: 없음. CI workflow에서 가장 긴 job이 check `ci-passed`가 끝나는 때를 정한다. job `Native generation and PHP API`는 matrix의 두 PHP release마다 모든 native suite를 실행했고, 거기에는 matrix의 PHP release가 필요 없는 PHP 확장의 C 엔진 test, JavaScript, HTML, Go, Rust 대상의 생성기, benchmark driver도 들어 있었다. `setup-node`의 cache는 모든 job에서 npm package 700 byte를 복원했다.

## Wave 13

의존: 없음. 저장소는 TypeScript, Go, PHP, PHP 확장, Rust로 구현을 이름한다. Python이 같은 자격으로 합류한다. PEP 420 namespace `polyspec` 아래 `polyspec-crudui-validator`와 `polyspec-crudui-generator`를 내놓고 표준 라이브러리만 쓰며, 단위 test는 `unittest`, 결과는 모든 구현이 같게 답하는 `tests/fixtures`의 공통 fixture로 검증한다. Python 3.11이 가장 오래된 지원 release이고 `.python-version`은 최신 안정 release를 이름할 것이다. 이 파일은 C13.1-6이 아직 완료되지 않아 아직 없다.

## Wave 14

의존: 없음. 저장소는 모든 polyspec 저장소가 공유하는 도구를 polyspec/kit v0.0.4의 vendored copy(`scripts/kit`, `tests/kit`, `kit.json`, `.kit/kit.lock.json`)로 가져오고, 다른 저장소와 `config/*.json`에서만 다르다. kit이 제공하는 이 저장소의 도구(dependency review와 그 검사, toolchain install과 check, test runner, push 검사, full-run guard, holder lock, document와 owner check, CI report 도구, release 도구)는 제거한다. 0.x workflow에는 pull request, merge queue, ruleset이 없다. 작업은 row마다 로컬에서 commit하고, 모든 row가 `[o]`일 때 `main`을 한 번 push하며, tag는 main CI의 `ci-passed`가 성공한 뒤에만 만든다.

## Wave 15

의존: 없음. AGENTS의 경로 규칙은 모든 경로에서 symbolic link를 거부했고, 그 규칙이 이 저장소가 만드는 것에만 적용된다고 적지 않았다. 그래서 symbolic link를 만드는 생태계의 표준 도구, 예를 들어 Python 환경에 쓰는 uv가 이 규칙에 걸릴 수 있었다. AGENTS는 외부 도구와 라이브러리를 다시 만들지 않고 있는 그대로 쓴다는 내용도 적지 않았다.

## Wave 16

의존: 없음. validator와 generator는 언어마다 구현이 하나씩 있었다. Rust crate가 코어가 되고 binding이 그 인터페이스 계약에서 언어 package를 생성한다. 예전 언어 구현은 바인딩이 하나씩 대체할 때까지 `legacy/`에 남는다.
