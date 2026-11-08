# 개발
<!-- doc-id: agents -->
<!-- source-sha256: 030afb5d960a8b84244753befb893f63919ad19cfc673b97a364fc1e7267bbce -->

crudui의 작업 원칙은 `@polyspec/kit`이 예시로 담은 원칙의 crudui 사본인 [PRINCIPLES.md](PRINCIPLES.ko.md)이며,
이 file은 crudui의 규칙만 적습니다.

## 테스트와 실행

- Own: 각 test case는 자기 timeout을 가지며, suite 전체의 timeout은 없습니다. 모든 test는 시작, 완료, 결과와 경과 시간을
  스스로 보고합니다. 긴 작업(build, install, toolchain 설정, browser 종료, server 중지, suite 전체)은 상세한 step 로그를
  출력하며 시간 제한이 없습니다. 결과는 관측된 outcome과 error로 판단합니다. 수십 분 동안 실행되거나 시작과 끝만
  출력하는 test는 결함입니다.
  Enforced by: none, 안내 규칙: 각 test의 review가 지킨다.
- Refines P20: 개발 중에는 바뀐 것을 소유한 unit test만 실행합니다. 전체 suite는 활성 checklist의 모든 항목을 완료한 뒤
  정확히 한 번 실행하며, 활성 checklist에는 `docs/plans/kit-standard/checklist.md`가 포함됩니다. 수정이나 개별 항목마다
  실행하지 않습니다. 긴 작업은 background에서 실행하고 진행 상태를
  보고합니다. 실패는 다른 결함과 같이 작업으로 올립니다.
  Enforced by: none, commit 전에 어떤 unit test를 실행하는지는 어떤 검사도 읽지 않는 절차입니다.
- Own: push는 push되는 commit에도 working tree에도 checklist의 `[~]` 작업이 없을 때만 합니다.
  Enforced by: none, K804 이후 어떤 hook이나 CI job도 push를 검사하지 않습니다.
- Own: version이 0.x인 동안에는 pull request, merge queue, GitHub ruleset이 없습니다. 작업은 로컬에서 commit하며 commit마다
  checklist 행 하나를 담고, 소유한 unit test가 통과해야 그 행이 `[o]`가 됩니다. 개발 작업과 로컬 candidate 준비를 완료하고 활성 작업이 없을 때 `main`을 한 번 push합니다.
  Candidate 준비는 현재 sibling source로 CI 전에 수행하며 CI나 별도 허가를 기다리며 미루지 않습니다.
  tag는 commit에 대해 CI check `ci-passed`와 push check `push-gate`가 성공한 뒤에만 만들며, release는
  그 tag에서 만듭니다(`docs/operations/repository.md`).
  Enforced by: none, push와 tag의 순서는 어떤 검사도 읽지 않는 절차입니다.

## 도구와 의존성

- Own: PHP 8.4 이상을 허용합니다. 검증 기록은 실제 실행한 PHP 버전을 적습니다.
  Enforced by: none, 지원하는 PHP 범위는 저장소 규칙입니다.

- Own: 공유 도구는 root manifest와 lock이 고정한 설치 package `@polyspec/kit`입니다. 첫 make 실행 전에 native npm이
  `packageManager`에서 정확한 npm release를 읽고 잠긴 설치를 실행합니다(`docs/operations/package-build.md`). `Makefile`은
  이 저장소가 실행하는 recipe를 모두 담으며, kit utility의 recipe는 그 utility를 설치 package(`node_modules/@polyspec/kit`)에서
  명시적인 인자로 시작합니다. 설치 뒤 `make install-tools TOOLS=npm`과 `make install-packages`가 checkout 도구와 package를
  준비합니다. 도구의 설정은 각 도구가 읽는 이 저장소의 파일입니다: `.npmrc`, `mise.toml`의 `[settings]`와 `[env]`,
  `ruff.toml`, `phpcs.xml.dist`, `phpstan.dist.neon`, `.golangci.yml`, `clippy.toml`과 각 `Cargo.toml`의
  `[workspace.lints]`, `.oxlintrc.json`, `knip.json`. CI workflow, bootstrap action, `config/layout.kit.yml`도 kit의 예제에서
  가져온 이 저장소의 파일입니다. 코드는 package export를 통해 kit module을 import합니다.
  Enforced by: none, 저장소가 어떤 recipe와 도구 설정을 두는지는 저장소의 설계입니다.
- Own: 모든 도구는 checkout이 기록한 정확한 release로 실행합니다(`mise.toml`과 `mise.lock`, `rust-toolchain.toml`,
  `config/toolchain.json`, `package.json`의 `packageManager`). image는 digest로, Debian package는 snapshot 날짜로, action은
  commit SHA로, browser는 잠근 package가 고정한 build로 지정합니다. 어떤 실행도 최신 release나 channel을 registry에
  묻지 않으며, 도구는 스스로 다른 release를 설치하지 않습니다(`RUSTUP_AUTO_INSTALL=0`, `GOTOOLCHAIN=local`). 저장소의
  도구는 checkout 안(`make install-tools`의 `var/tools`)에 설치하며 machine에는 설치하지 않습니다. polyspec 버전이 0.0.x인
  동안 개발 checkout은 kit의 `docs/operations/local-links.md`가 설명하는 대로 설치된 polyspec package를 소스에 링크하며,
  링크는 커밋하지 않습니다.
  Enforced by: none, 기록된 release는 kit이 설치한다(K854); 이를 읽는 검사는 더 이상 없다.
- Own: 이 저장소의 설정은 `config/*.json`(`toolchain`, `dependency-policy`, `dependency-review`, `checklist`, `documents`,
  `generated`, `owner-checks`, `rebuild`, `release`)과 `config/layout.yml`입니다. `config/layout.yml`은 `config/layout.kit.yml`의 예외를 각각의
  이유와 함께 적습니다.
  Enforced by: `make layout-check`

## 구성, 문서와 변경

- Refines S5: 계약은 `docs/spec/`, 구현과 배포 상태는 `docs/features.md`, 절차는 `docs/operations/`, 계획된 작업과 검증·완료는
  `docs/plans/<plan>/checklist.md`, 실제 변경은 `CHANGELOG.md`에 둡니다. 모든 변경은 checklist의 작업에 속하며, 작업이
  없으면 일을 시작하기 전에 작업을 추가합니다.
  Enforced by: `make layout-check`
- Own: 완료된 기능은 그 기능을 완료하는 commit에서 `CHANGELOG.md`와 `CHANGELOG.ko.md`에 기록하며, 항목은 section
  `## Unreleased`의 맨 위에 `### <date> — <title> (<task ID>)` 형식으로 둡니다. 커밋하지 않은 변경은 기능 하나 안에 둡니다.
  Enforced by: none, `make records-check`는 손으로 실행하며 어떤 hook이나 CI job도 닿지 않습니다.
- Own: 모든 경로는 `config/owner-checks.json`에 owner가 있으며, 각 검사가 읽는 경로도 그 파일에 적습니다. 새 경로는 같은
  변경에서 그 파일에 owner를 추가합니다.
  Enforced by: `make owner-validate`
- Own: 주석, 문서, 변경 기록과 사용자에게 보이는 문구는 현재 동작을 직접 설명합니다. 주체, 동작, 대상과 결과를 밝히고, 필요한
  원인은 한 문장으로 적습니다. 비유, 의인화와 구어체를 쓰지 않습니다. 외부 출처, 복사나 각색 이력을 기록하지 않습니다.
  외부 프로젝트는 현재 계약이나 절차가 그 정체, API 또는 경로를 요구할 때만 이름을 적습니다.
  Enforced by: none, `make records-check`는 손으로 실행하며 어떤 hook이나 CI job도 닿지 않습니다.
- Own: 개인 선호와 대화 맥락은 저장소 밖에 보관합니다.
  Enforced by: none, 어떤 맥락이 저장소 밖에 속하는지는 판단입니다.

## 설계

- Own: 구조 컴파일, 인스턴스 데이터, 렌더링과 검증을 분리합니다.
  Enforced by: none, 분리는 설계 판단입니다.
- Own: 이 저장소가 만드는 저장소 경로는 저장소 기준 상대 경로로 기록합니다. 실행 코드는 저장소 입력을 선언된 root나 module
  위치에서 해석하며, 추적되는 파일에 적힌 경로나 명시된 탐색 규칙으로 찾습니다. 외부 입력은 명시적 경로나 권위 있는 탐색
  기록 하나를 요구합니다. 이 저장소가 만드는 결과에서는 symbolic link, 누락된 기록과 모호한 탐색 결과를 거부합니다. 외부
  도구가 만드는 link는 그 도구의 동작대로 받아들입니다.
  Enforced by: none, 경로 규칙은 설계 판단입니다.
- Own: 생성 파일은 Git에 추적하지 않습니다. 여기에는 의존성 설치(`node_modules/`, `vendor/`, 가상 환경), build 결과(`dist/`,
  `target/`, `*.tsbuildinfo`), cache, test 실행 산출물과 도구 다운로드(`var/`)가 포함됩니다. 추적하는 예외는 lock 파일
  (`package-lock.json`, `composer.lock`, `Cargo.lock`, uv lock, `mise.lock`), 이 파일이 이름을 밝힌 생성 문서, test
  fixture뿐입니다. 새 generator는 같은 commit에서 ignore 항목을 추가합니다.
  Enforced by: `make layout-check`

## Checklist

- Own: 철회한 작업은 현재 원인에 따라 분류합니다. 조건부 결정은 재시도 조건과 `docs/plans/release-readiness/`의 candidate
  로컬 검토를 명시하고 candidate CI 전에 재검토합니다. 이전 불가 또는 우회 상태는 결정을 영구화하거나 candidate 검토를
  완료하지 않습니다.
  Enforced by: none, 분류와 candidate 검토는 절차입니다.

- Own: `docs/plans/execution-checklist/checklist.md`는 연결된 Wave 제목 아래에 작업을 묶습니다. Checklist 표는 ID, Task,
  Deliverables, Verification, State 열을 사용합니다. 기본 작업 ID는 `C<wave>.<number>` 형식이며 하위 항목은 P24를
  따릅니다. 상태 표시는 State 셀의 맨 앞에만 둡니다. 각 plan의 `plan.md`는 해당 의존 관계를 담습니다.
  Enforced by: `make docs-check`
- Own: 지시를 받으면 먼저 checklist의 작업인지, 이 파일의 규칙인지, 답변만 필요한지 분류합니다. 지시가 긴급하다고 밝히지 않았다면
  우선순위를 붙인 작업으로 기록하고 진행 중인 작업을 계속합니다. 규칙은 checklist나 changelog가 아니라 이 파일에 둡니다.
  Enforced by: none, 지시의 분류는 판단입니다.

## 멱등성

같은 tree는 어느 날짜와 어느 machine에서도 같은 결과를 내며, 실패한 실행은 무엇이 어떤 이유로 실패했는지 보여줍니다.

- Own: 입력: 검사는 자신이나 선언된 준비(`require-current-build`를 거친 build, 다시 설치한 복사본, 자기 기록)가 같은 실행에서
  만든 출력만 읽으며, 다른 명령이나 다른 실행이 남긴 것은 읽지 않습니다.
  Enforced by: none, 검사의 읽기 대상은 `config/owner-checks.json`에 선언하고 거기서 검토합니다.
- Own: 게시: 다른 실행이 읽을 수 있는 공유 출력은 그 실행의 경로에 쓴 뒤 제자리로 rename합니다.
  Enforced by: none, 게시 경로는 설계 판단입니다.
- Own: 실패: 독립된 모든 검사는 앞의 검사가 실패한 뒤에도 실행하며(`|| status=1`과 `exit $status`), 실행은 마지막 검사 뒤에 모든
  실패와 함께 끝납니다. `&&`는 뒤 단계가 앞 단계의 출력을 읽는 단계만 잇습니다.
  Enforced by: `make lint-ts`
- Own: 메시지: 모든 실패는 기대한 값, 실제 값과 도구의 오류를 명령, 경로와 제한과 함께 밝힙니다. 시간 제한은 명령, 제한과 경과
  시간을 밝힙니다.
  Enforced by: none, 메시지의 문구는 판단입니다.
- Own: 빈 선택: 아무것도 검사하지 않는 실행, 선택이나 검사 목록은 실패합니다(`ran no test case`, `ran no command`, 검사 목록이 비어
  있음).
  Enforced by: none, 각 runner는 빈 선택을 자기 규칙으로 보고합니다.
- Own: process: 실행은 process를 자기 group에서 시작하고, tree 전체를 멈추며 사라질 때까지 기다리고, `finally`에서 보유한
  자원을 놓습니다.
  Enforced by: none, process 처리는 각 실행의 코드에서 검토합니다.
- Own: 단언: test는 외부 도구의 구조화된 결과(exit status, report, event)를 단언하며, 버전, locale이나 부모 process에 따라 문구가
  바뀌는 사람이 읽는 출력은 단언하지 않습니다. Makefile target의 명령은 `tests/build/make-dry-run.mts`의 `makeDryRun`으로만
  읽습니다.
  Enforced by: none, 안내 규칙: 각 test의 review가 지킨다.
- Own: 공유 자원: 실행들이 함께 쓰는 자원은 lease(`@polyspec/kit`의 holder-lock)로 보유하거나, 각 실행이 자기 directory, 이름이나
  port를 씁니다. port는 listen하는 server가 port 0으로 잡아 알려 주며, 미리 확인하지 않습니다.
  Enforced by: none, lease 사용은 각 실행의 코드에서 검토합니다.

# Release

- Own: release는 CI의 전체 suite를 통과한 `main`의 commit에 붙인 tag입니다. 저장소 전체는 `vX.Y.Z`, 그 directory의 Go module은
  `<directory>/vX.Y.Z`를 씁니다. tag는 maintainer만 만들고, 옮기고, push합니다. release dispatch는 `main`에서 성공한
  `.github/workflows/ci.yml` run의 id를 받고, `make release-tag`가 그 run의 commit에 tag를 만듭니다.
  Enforced by: `make release-tag`
- Own: Candidate CI 전에 commit `chore(release): Release X.Y.Z (#<task ID>)`이 candidate를 준비합니다. 이 commit은 `config/release.json`이 적은 manifest(`package.json`, `Cargo.toml`, `pyproject.toml`, `packages/`의 `composer.json`)와
  저장소 package에 대한 모든 의존성의 version을 X.Y.Z로 설정하고, `CHANGELOG.md`와 `CHANGELOG.ko.md`의 `## Unreleased`를
  `## X.Y.Z`로 바꾸며 그 아래에 빈 `## Unreleased`를 새로 둡니다.
  Enforced by: `make release-tag`
- Own: 로컬 준비와 해당 commit의 CI 검사가 성공한 뒤 maintainer가 그 commit에 tag를 달아 push합니다. `.github/workflows/release.yml`은 `make release-tools`,
  `make release-tag`, `make release-versions`, `make release-assets`, `make release-publish`, `make release-proof`,
  `make release-undraft`(`@polyspec/kit`의 release 도구)를 실행합니다. 이 workflow는 `main`에서 성공한 `ci.yml` run의 id,
  모든 manifest의 tag version, `## X.Y.Z` section이 있음을 요구합니다. GitHub
  Release를 draft로 만들어 그 section을 notes로 두고 `packages/`의 archive를 붙이며, checkout 바깥에서 draft를 검증한 뒤 공개합니다.
  release 본문의 한도인 125000자를 넘는 section은 tag 시점의 `CHANGELOG.md` section으로 연결하는 한 줄로 바꿉니다. crate는
  archive로 배포하지 않으며 git tag로 사용합니다. Go module tag는 아무것도 build하거나 첨부하지 않습니다
  (`docs/operations/repository.md`).
  Enforced by: `make release-tag`
