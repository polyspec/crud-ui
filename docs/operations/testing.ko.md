# 테스트 실행
<!-- doc-id: docs-operations-testing -->
<!-- source-sha256: 31aa5e53fdc09b2c481f329ae6fd0609c42a279893da070023db0add563299ac -->

[English](testing.md).

저장소 루트에서 실행합니다. checkout은 먼저 `make install-tools TOOLS=npm`으로 `scripts/kit/bootstrap`의 copy된 installer가
`packageManager`의 npm을 설치하게 하고, `make install-packages`로 그 npm이 package `@polyspec/kit`을 포함한 `package-lock.json`을
설치하게 합니다. 그 전에는 다른 target이 실행되지 않습니다. 모든 도구는 checkout이 기록한 release로 실행됩니다(`docs/operations/package-build.ko.md`,
"런타임과 의존성 버전"). `make install`은 기록한 npm, npm과 Composer 의존성, `rust-toolchain.toml`의 Rust toolchain, comparison의 OrderedJSON checkout과
모든 Cargo.lock의 crate(`make crudui-install-crates`),
`scripts/install-phpdocumentor.mts`가 SHA-256으로 검사하는 phpDocumentor release를 설치하고, 도구는 kit이 기록된 release로 설치합니다(K854: 도구 검사 삭제).
`make install-tools`(`node_modules/@polyspec/kit/dist/install-tools.mjs`. `TOOLS="go cargoAudit"`가 설치할 도구를 지정하며, workflow job은 쓰는 도구만 설치합니다)로 checkout이 선언한 도구(npm, Go, uv와 Python, alint, ruff, vulture, golangci-lint, deadcode, PHPCS와 PHPStan을 포함한 Composer, cargo-audit)를
checkout에 설치하며, 이 명령은 machine의 도구를 바꾸지 않습니다. make는 `var/tools/bin`의 명령을
`PATH`의 맨 앞에 두고, npm을 직접 실행하는 shell은 `export PATH="$PWD/var/tools/bin:$PATH"`로 그렇게
합니다. `.npmrc`가 `strict-allow-scripts`를 설정하므로 `make install-packages`는 `package.json`의 `allowScripts`가 승인하지 않은
install script에서 실패합니다. PHP 패키지의
Composer 의존성을 설치하며 PHP·Go·Cargo를 `PATH`에서 실행할 수 있게 합니다. 비교 예제의 PHP 레코드
서버에는 `php-fpm`과 `nginx`도 필요합니다(Debian·Ubuntu:
`php8.x-fpm`과 `nginx`, 그리고 버전이 붙은 실행 파일을 가리키는 `php-fpm` 링크).
컴파일된 export를 검사하기 전에 JavaScript 패키지를 빌드합니다.

교차 검증 콘솔의 Rust 검증기 프로그램 릴리스 프로필은 `strip = "none"`을 사용합니다. 릴리스
빌드가 toolchain의 선택적 `rust-objcopy`·`libLLVM.dylib` 조합에 의존하지 않게 하며, 바이너리를
성공으로 보고한 뒤 strip 경고를 남기지 않게 합니다.
릴리스 프로필을 선언한 모든 크레이트는 `strip = "none"`을 설정하며,
`npm run test:runtimes`가 실행하는 `tests/build/rust-release-profile.test.mts`가 이를 검사합니다.

개발하는 동안에는 바뀐 것을 소유한 unit test, 곧 그 Red와 Green case만 실행합니다. end-to-end 검사(browser,
container, form comparison, native와 cross-check suite, 전체 build), `make owner-check`, 전체 실행은 `main`으로의 push의
CI에서 실행하며, push나 commit 전에 local 검사를 요구하는 규칙은 없습니다. pre-push hook은 checklist 작업이 `[~]`인
동안 push를 거부할 뿐입니다(아래).

workflow의 모든 step은 make 대상을 실행합니다. 설치(`rust-toolchain.toml`의 Rust toolchain도 설치하는 `make install-tools`,
`make install-packages`, `make crudui-install-composer`, `make crudui-install-crates`, `make crudui-install-browsers BROWSERS="..."`), 도구 검사
각 검사(`make crudui-test-runtimes`, `make lint`, `make crudui-test-forms`와 `CI_COMMANDS`의 나머지)가
그렇습니다. 그래서 recipe는 모든 도구를 offline 설정, `$(NPM)`, checkout의 toolchain으로 시작합니다.
`tests/build/ci-local.test.mts`는 make 없이 node, npm, npx, cargo, go, php, composer, rustup, python3, sh를 시작하는 step에서
실패합니다.

Makefile의 `CI_TARGETS`는 workflow의 대상을 그 순서대로 나열합니다. `tests/build/ci-local.test.mts`는 이 목록이
`.github/workflows/ci.yml`과 다르면 실패합니다.

실패는 이후 검사를 멈추지 않으므로 한 번의 실행이 모든 실패를 보고합니다. 각 CI job은 검사를 한 step,
`make ci-targets TARGETS="..."`로 실행하고 이것은 모든 대상을 끝까지 실행하며, 그 step은 `if: ${{ !cancelled() }}`를
가지므로 실패한 준비 단계가 그 job의 검사를 건너뛰게 하지 않습니다. `tests/build/ci-local.test.mts`는 그것이 없는
검사 단계마다 작업과 단계를 적고 실패합니다. make는 처음 실패한
prerequisite에서 멈추므로 Makefile 대상은 테스트를 실행하는 대상을 prerequisite로 두지 않습니다.
`make crudui-test-native`와 `make docs-check`처럼 여러 테스트 대상을 실행하는 대상은 각각을
`$(MAKE) <target> || status=1`로 실행하고 모은 상태로 끝납니다. make는 처음 실패한 recipe 줄에서도 멈추므로,
대상의 첫 검사를 실행하는 recipe 줄은 그 대상의 마지막 줄이며 `make docs-check-documents`와 `make format-check`처럼
각 검사를 `|| status=1`로 실행하고 `exit $$status`로 끝납니다. build나 install 같은 그 앞의 준비 줄은 여전히 대상을
멈추며, `make docs-verify-idempotent`처럼 뒤 단계가 앞 단계의 결과를 읽는 `&&` 연결은 하나의 검사입니다.
package script와 CI step도 같은 규칙을 따릅니다. 독립된 여러 검사는 `status=0; <check> || status=1; ...; exit $status`로
실행하며, `npm run test:forms`와 `npm run test:form-comparison:pipeline`은 `node scripts/require-current-build.mts || exit 1`
뒤에 그렇게 합니다. `&&` 연결은 검사 뒤에 단계를 두지 않습니다.
`scripts/run-contract-tests.mts`는 앞의 명령이 실패한 뒤에도 선언된 모든 명령을 실행하고 마지막 명령 뒤에 실패합니다.

CI workflow는 `main`으로의 push와 수동 실행(`workflow_dispatch`)마다 이 대상을 job에서 실행합니다. 전체 suite는 다른 곳에서
실행하지 않습니다([PRINCIPLES.md](../../PRINCIPLES.ko.md), Verification).

native suite는 세 CI job에서 실행되므로 어떤 job도 다른 runtime이 필요한 suite를 기다리지 않습니다.
`php-engine`은 Node.js와 C compiler로 `make crudui-test-php-engine`을 한 번, `native-generators`는
`make crudui-test-native-generators`와 `make crudui-test-bench`를 한 번 실행하고, `php-api`는 workflow의 모든 setup-php step이 읽는
`.php-version`의 PHP minor에서 `make crudui-test-php-api`를 한 번 실행합니다. `make crudui-test-native`는 세 대상을 한 명령으로 실행합니다
(`docs/operations/native-generators.ko.md`).

npm package를 설치하는 모든 job은 npm을 설치하기 전에 `actions/cache`로 `~/.npm`을 key
`npm-<system>-<architecture>-<package-lock.json의 hash>`로 복원하고 저장하며, `setup-node`는 아무것도 cache하지
않습니다. 그 cache는 먼저 끝난 job의 npm 디렉터리를, npm package를 설치하지 않는 job의 것도 저장했으므로 이후 모든
job이 700 byte를 복원했습니다. 실행은 자기 ref와 `main`의 cache를 읽으므로 `.github/workflows/pages.yml`이 `main`에서
같은 key로 저장한 cache를 이후의 모든 실행이 씁니다. `Swatinem/rust-cache`의 Cargo cache는 job, Rust
toolchain, workspace의 Cargo lock으로 된 key를 가지며, job id마다 그런 key가 하나입니다.

요청하면 `make owner-check`는 바뀐 경로를 소유한 검사를 실행합니다. 경로는 commit되지 않은 변경과 새 file,
`PATHS`의 경로, 또는 `BASE` 뒤에 바뀐 경로입니다. `config/owner-checks.json`은 경로 glob마다 그것을 소유한 make 대상,
root npm script, workspace와 package directory의 test script, node test file을, 검사마다 그것이 읽는 경로(`inputs`)를
밝힙니다. `node_modules/@polyspec/kit/dist/owner-check.mjs`는 어떤 규칙도 소유하지 않는 경로, 경로가 없는 glob, full suite 대상, 알 수 없는
script나 test, 그리고 경로의 규칙이 그 검사를 고르지 않는데 검사가 읽는 경로에 대해 어떤 검사보다 먼저 실패합니다. 고른
모든 검사를 하나가 실패한 뒤에도 실행하며 full suite는 실행하지 않습니다. `make owner-validate`는 repository의 선언을 확인하고,
polyspec/kit의 `tests/kit/owner-check.test.mts`는 선택과 거부를 확인합니다.

Makefile 대상의 명령을 읽는 test는 `tests/build/make-dry-run.mts`의 `makeDryRun`을 실행합니다. 이것은 `MAKEFLAGS=w`를 설정하고
상위 make의 `MAKELEVEL`, `GNUMAKEFLAGS`, `MAKEFILES`, `MFLAGS`를 지운 채 `make --no-print-directory -n <target>`을 실행하므로,
GNU Make 3.81과 GNU Make 4는 다른 make 안에서도 명령만 출력합니다. `tests/build/make-dry-run.test.mts`는 그 밖의 make dry run에 대해
실패합니다.

push는 checklist에 `[~]` 작업이 없을 때만 합니다. 추적되는 pre-push hook `.githooks/pre-push`는 Git이 push하는 ref와 함께
`make push-gate-hook`(`node node_modules/@polyspec/kit/dist/push-gate.mjs hook`)을 실행합니다. 이 검사는 push되는 모든 commit의 checklist(`git show <sha>:docs/plans/execution-checklist/checklist.md`)와
working tree의 checklist를 읽고, 그중 하나에 진행 중인 작업이 있으면 status 1로 push를 거부합니다. 이 검사는 그런 작업마다 file, ID, 제목을 push되는
ref와 commit 또는 `working tree`와 함께 출력하고, push를 막는 상태(`[~]`)와 막지 않는 상태(`[ ]`, `[o]`, `[!]`)를 밝힙니다. 작업을 완료하거나, 그 원인과
재시도 조건과 함께 `[!]`로 표시합니다. checklist가 없는 push commit, 잘못된 hook 입력 줄, 읽을 수 없는 checklist, Git 오류도 그 원인을 적으며 push를
거부합니다. 삭제되는 ref는 commit을 push하지 않으므로 working tree만으로 검사합니다.

`config/checklist.json`은 이 저장소의 Git hook을 나열하지 않습니다. `make install-packages`가 먼저 실행하는 `make hooks`
(`node node_modules/@polyspec/kit/dist/git-hooks.mjs install`)는 changelog와 checklist의 merge driver를 선언하며, `make hooks-check`는
그중 하나라도 선언되지 않았으면 실패합니다.

hook이 없는 clone이나 hook을 건너뛴 push도 GitHub에 도달합니다. `.github/workflows/push-gate.yml`의 job `push-gate`는 branch로의 모든 push에서 실행되어,
push된 commit을 checkout하고 `make ci-targets TARGETS="push-gate-commit records-check"`를 실행합니다. `make push-gate-commit`
(`node node_modules/@polyspec/kit/dist/push-gate.mjs commit HEAD`)은 그 commit의 checklist에 진행 중인 작업이 있을 때, commit에 checklist가 없을 때, commit이
`.githooks/pre-push`를 실행 가능한 file(mode `100755`)로 추적하지 않을 때 실패하며, 거부 내용을 progress line으로, 각 줄을 error
annotation으로, 그리고 job summary에 출력합니다. `make records-check`는 `make docs-check`
(`node_modules/@polyspec/kit/dist/check-documents.mjs`, `config/documents.json`)와 link, changelog, 문장, example과 fixture README test를 실행하며, Node.js만 필요하고
network와 이력을 읽지 않습니다. 그래서 문서나 checklist 규칙을 어긴 commit은 release가 요구하는 check에 실패합니다([저장소](repository.ko.md#main-게시)).
`make docs-check-documents`는 나머지 문서 검사와 함께 `make records-check`를 실행합니다.

개별 명령은 다음과 같습니다.

```sh
composer install
npm run build
npm test --workspace @polyspec/crudui-validator
composer --working-dir=packages/validator/php test
node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd packages/validator/go -- ./...
node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/validator/rust/Cargo.toml
npm test --workspace @polyspec/crudui-cli
npm run test:forms
npm run test:packages
make docs-check
```

검증기 패키지 검사는
[사례 계약](test-fixtures.ko.md)의 공통 사례를 실행합니다. 구현 간 일치뿐
아니라 기대 검증 결과 또는 전체 실패 기록을 비교합니다. 패키지 검사는 export 파일,
선언·설치 컴파일·프로덕션 렌더링을 확인합니다. PHP 검사는 개발 root의 `composer install`이 설치하는 root `vendor/`의 PHPUnit을
실행합니다. `node_modules/@polyspec/kit/dist/run-tests.mjs phpunit`은 `--cwd`이거나 그 위에 있고 PHPUnit을 가진 가장 가까운 Composer project의
PHPUnit을 실행하며, `packages/`의 모든 package에서는 root입니다(kit K186).

## 린트

`make lint`는 kit의 `make lint-ts`와 `packages/svelte`의 Svelte lint를 실행합니다. CI의 빌드·린트·타입 작업이
이를 호출합니다. `make lint-ts`는 copy된 `.oxlintrc.json`으로 Git이 무시하지 않는
모든 file에 oxlint를(oxlint-tsgolint로 type-aware, warning 거부), copy된 `knip.json`으로 root에서 knip을, `api-extractor.json`을
가진 각 package에서 API Extractor를 실행합니다. oxlint에는 Svelte 규칙이 없으므로 `npm run lint -w @polyspec/crudui-generator-svelte`가
그 package의 component에 eslint-plugin-svelte를 쓰는 ESLint를 실행하며(`packages/svelte/eslint.config.js`), 그 TypeScript
script는 typescript-eslint가 그 package의 TypeScript 6으로 parse합니다. 규칙은 적용되지 않는 줄에서만, 규칙 이름과 이유를 적은
비활성화 주석으로 끕니다.

`npm run test:build`가 실행하는 `tests/build/lint-coverage.test.mts`는 `make lint`가 두 lint를 모두 실행하기를 요구하고, copy된
설정의 oxlint가 심어 둔 위반에서 실패하지 않거나 Svelte lint가 심어 둔 raw HTML tag에서 실패하지 않으면 실패합니다.

## 테스트 실행기

모든 테스트는 `node_modules/@polyspec/kit/dist/run-tests.mjs`로 실행합니다.

```sh
node node_modules/@polyspec/kit/dist/run-tests.mjs <node|vitest|go|cargo|phpunit> [--cwd <directory>] [--] [<arguments>]
```

실행기는 각 테스트의 시작, 실행 중임을 알리는 줄, 결과와 경과 시간을 출력합니다. 실행기는
시간 제한을 두지 않으며, 도구를 실행하고 그 출력과 exit code를 그대로 전합니다. 패키지
스크립트, Composer 스크립트, Makefile 대상은 이 실행기를 통해서만 테스트 도구를 호출합니다.
PHPUnit은 `--teamcity`로 실행합니다. 실행기는 TeamCity test를 하나씩 세고 test class나 data provider
method는 세지 않으며, 없는 test file에 대한 오류나 warning을 담은 요약처럼 TeamCity message가 아닌
줄을 모두 출력합니다.

`node:test` 파일에 등록된 모든 case는 실행되거나 파일이 실패합니다. 두 검사가 이를 지킵니다.

- 실행기는 모든 test 파일의 process에 `node_modules/@polyspec/kit/dist/test-exit-deadline.mjs`를 preload합니다. test가 모두
  끝났는데도 test timeout 동안 살아 있는 process는 test가 열어 둔 handle을 붙잡고 있으며, 그 handle을 적고 파일을
  실패시킵니다. 그래서 leak이 실행을 붙잡지 못하고, module이 top-level `await` 뒤에 등록하는 test 전에 process를 끝내는
  `--test-force-exit`는 쓰지 않습니다.
- 통과, 실패, skip 중 어떤 case도 보고하지 않은 파일은 `the file ran no test case`로 실패합니다.
  `--test-name-pattern`이 그 파일의 test를 하나도 고르지 않을 때가 그렇습니다.

polyspec/kit의 test는 두 검사를 파일로 실행합니다.

실행의 모든 실패는 test 파일과 경과 시간과 함께 출력되며, 테스트 밖의 실패도 포함합니다. 실패하거나
제한 시간을 넘긴 hook과 test 파일의 오류가 그렇습니다. hook이 실패한 파일이나 suite는 그 안의 모든
테스트가 통과해도 실패로 출력됩니다. 요약 줄은 실패한 group 수를 표시하므로, 모든 테스트가 통과하고 도구가
0이 아닌 코드로 끝난 실행은 그 코드의 원인이 된 실패를 보여 줍니다.
polyspec/kit의 `tests/kit/run-tests.test.mts`가 이 경우들을 실행합니다.

setup(browser launch, server start, stylesheet compile, build)과 teardown(browser close, server stop,
directory 삭제)은 test case가 아니라 장기 작업입니다. `node:test` 파일은 `node_modules/@polyspec/kit/dist/test-hooks.mjs`의
`setup`과 `teardown`으로 이를 등록하며, 이는 timeout이 `Infinity`인 파일, suite, test 하나(`{ context: t }`)의
`before`나 `after` hook입니다. 각각은 작업이 끝나면(browser가 launch되고, server가 listen하고, close가
resolve되고, process가 종료되면) 끝나고, 그 오류는 파일을 실패시키며, 시작, 실행 중 5초마다의 줄, 경과
시간과 함께 끝을 출력합니다. Vitest setup이나 teardown은 timeout이 `Infinity`인 `beforeAll`이나 `afterAll`
hook입니다. test는 browser를 launch하지 않고 setup이 launch한 browser의 page를 엽니다.
polyspec/kit의 test는 setup이나 teardown이 test timeout보다 오래 걸리는 파일을 실행합니다.

type assertion(`expectTypeOf`)은 `*.test-d.ts` 파일에 있고, Vitest의 typecheck mode(package의 Vitest 설정에서
`enabled: true`인 `test.typecheck`)가 runtime test와 같은 실행에서 `tsc`와 package의 `tsconfig.json`으로 이를
검사합니다. runtime test 파일은 `expectTypeOf`를 평가하지 않습니다. `packages/validator/ts`는 이렇게 작성 type을
검사합니다(`src/types.test-d.ts`).

## 시간과 부하

테스트는 경과 시간을 제한값이나 다른 경과 시간과 비교하지 않습니다. 기계의 부하가 경과 시간을
바꾸기 때문입니다. 대신 원인을 확인합니다. event, 예상한 경로만 만드는 결과, 또는 시험 대상 code가
멈추지 않으면 끝나지 않는 작업을 test 자신의 timeout 아래에서 확인합니다.
`tests/build/test-commands.test.mts`는 경과 시간에 한도를 두는 assertion에서 실패합니다. 연산이 선형 시간에 끝나는지 확인하는 검사는 다음 둘 중 하나를 합니다.

- 결정적인 양을 셉니다. JavaScript test runner는 동기 작업을 멈출 수 없으므로 validator의
  JavaScript 검사는 getter로 데이터 읽기를, 세는 `codePointAt`으로 텍스트 읽기를 세고, 선형 순회의
  읽기 수를 넘는 첫 읽기에서 실패합니다.
- 이차 시간이나 지수 시간 구현은 테스트 제한 시간 안에 끝나지 않고 선형 구현은 몇 초 안에 끝나는
  큰 입력을 실행합니다. PHP, Go, Rust validator 검사와 PHP extension engine fixture가 이렇게 합니다.

`npm run test:runtimes`가 실행하는 `tests/build/validator-test-clocks.test.mts`는 validator
테스트나 PHP extension engine fixture가 시계를 읽으면 실패합니다.

`npm run test:runtimes`가 실행하는 `tests/build/test-commands.test.mts`는 다음 경우에
실패합니다.

- 패키지 스크립트, Composer 스크립트, Makefile 대상, CI 단계가 테스트 도구를 직접 호출합니다.
- CI 작업이나 단계에 `timeout-minutes`가 있습니다. 단계는 테스트나 장기 작업(checkout, toolchain
  setup, install, build, lint나 type check, upload, deployment)을 실행합니다. 실행기가 테스트 단계의
  각 test case를 제한하고, 장기 작업은 log를 출력하며 시간 한도를 두지 않습니다. 단계의 명령이
  `node_modules/@polyspec/kit/dist/run-tests.mjs`를 호출하거나 npm script, Composer script, Makefile 대상을 거쳐 테스트 명령이나
  실행기에 닿으면 그 단계는 테스트를 실행합니다.
- 테스트 명령이 시작하는 스크립트가 `node_modules/@polyspec/kit/dist/test-progress.mjs`로 출력하지 않습니다.
- 어떤 프로젝트 명령도 실행하지 않는 `node:test` 파일이 있습니다.
- TypeScript 패키지에 `typecheck` 스크립트가 없거나 CI가 `npm run typecheck`를 실행하지 않습니다.
- Makefile 대상이 테스트를 실행하는 대상을 prerequisite로 둡니다.
- 대상의 첫 검사를 실행하는 줄 뒤에 recipe 줄이 있거나, 검사가 `|| exit`로 recipe를 끝내거나, 그 줄의 검사가 다음
  검사 전에 `status=1`을 설정하지 않습니다.
- package script나 CI step이 `&&` 연결에서 검사 뒤에 단계를 두거나, 여러 검사 중 하나가 모은 상태로 끝나기 전에
  `status=1`을 설정하지 않습니다.

## 장기 작업의 명령

다른 명령을 실행하는 스크립트는 `@polyspec/kit/run-command`로 각 명령을 끝까지 실행합니다.
`npm run manifest:test`의 선언된 명령(`scripts/run-contract-tests.mts`), `scripts/require-current-build.mts`의
패키지 빌드, `scripts/gen-api-docs.mts`의 각 도구 명령, `benchmarks/validators/run.js`의 각 벤치마크 드라이버,
`benchmarks/validators/build-drivers.mjs`의 각 드라이버 빌드가 대상입니다. 명령에는 시간 한도가 없습니다. 명령의
종료가 명령을 끝내고 종료 상태가 결과를 정하며, 스크립트는 명령과 경과 시간을 출력합니다. 명령은 자기
프로세스 그룹에서 시작하고, 명령이 끝나면 그룹에 남긴 프로세스를 멈추므로 출력 pipe를 열어 둔
프로세스가 스크립트를 붙잡지 못합니다. 중단된 스크립트는 실행 중인 명령을 멈춥니다.
이 실행기와 그 테스트는 `@polyspec/kit`에 있으며, 이 저장소의 스크립트는 그것을 import만 합니다.

`make conformance`는 적합성 근거를 기록하는 모든 테스트 모음을 실행하고 그 근거를 기능
계약과 대조합니다. [적합성 근거](conformance.ko.md)를 참고합니다.

## 루트 테스트 명령

루트 `npm test`는 모든 워크스페이스 패키지의 테스트 스크립트를
(`npm test --workspaces --if-present`) 각각 테스트 실행기로 실행합니다. 생성기 검사가
빌드 결과를 읽으므로 JavaScript 패키지를 먼저 빌드합니다.

```sh
npm run build
npm test
```

## 폼과 보고서

`npm run test:inspector`는 폼 스냅샷과 브라우저 검사기 테스트를 실행하며, 검사하는 폼을 바꾸지 않고
HTML 원문, 파싱한 DOM, 계산된 스타일, 실제 입력 상태를 비교합니다.
`npm run test:form-comparison:pipeline`은 이 트리에서 다섯 레코드 서버(`make ordered-json-ext`가 PIE로 빌드하고 `var/ordered-json-package`에 기록한
OrderedJSON PHP 확장 소스, 두 PHP 확장, Go 바이너리, Rust 바이너리)를 빌드하고, 각 서버를 127.0.0.1의 빈 포트에서
로컬 프로세스로 시작하고, 다섯 서버 모두에 레코드 저장소 HTTP 계약을 실행하고, Go·Rust 서버 테스트를 실행한
뒤, 그 로컬 구성에서 서버·클라이언트·초기화 방식 40개 조합의 정본 List → Detail → Form → Save → List
refresh 검사를 실행합니다. `php-config`가 있는 PHP, Composer, Go, Rust, Chrome이 필요합니다.
`npm run test:form-comparison:checks`(`make crudui-test-form-comparison-checks`)는 같은 로컬 구성을 시작하고, 그
구성에 PHP 처리 모드, 생성·저장·정본 흐름 검사, 네이티브 서버 네 개의 브라우저 검사와 상호작용 검사,
브라우저 집계, 입력 검사를 실행하고, 근거를 확인한 뒤 서버를 멈춥니다
([로컬 검증](form-comparison.ko.md#로컬-검증)). `make crudui-test-form-comparison-browser`(`FORM_SERVERS`
서버의 브라우저 검사, 보고서는 `FORM_BROWSER_REPORTS`)와 `make crudui-test-form-comparison-summary`(그 보고서를 쓰는
나머지 검사)는 같은 검사를 CI가 실행하는 두 부분으로 실행하며, 앞의 것은 서버마다 CI 작업 하나에서 실행합니다.
[폼 비교](form-comparison.ko.md)가 레코드 리소스, 페이지와 그 검사들을 정의합니다. JSON 순서와 HTTP
저장·로드 검사는 검증기 패키지 테스트와 별도입니다.

`npm run test:forms`는 호스트에서 Chromium, Firefox, WebKit의 스타일시트 배치와 스타일시트의
사용자 정의 속성(`tests/style-properties.test.mts`)을 검사합니다.
CI job `form-runtime`은 같은 검사를 Linux runner `ubuntu-24.04`에서 `make crudui-install-browsers`가 설치한,
Puppeteer가 고정한 Chromium·Firefox build와 Playwright가 고정한 WebKit build로 실행합니다. Linux에서만
드러나는 엔진 차이는 그 job에서 보입니다.

[기능 상태](../features.ko.md)에 리비전·명령·결과·배포 상태를 기록합니다. 테스트
결과는 실제로 실행한 코드와 입력에 적용됩니다. 검사 수만으로 범위나 배포가
증명되지는 않습니다.

## 보고서

모든 CI job은 각 실패의 이유를 남깁니다. `make ci-targets TARGETS="..."`(`node_modules/@polyspec/kit/dist/ci-targets.mjs`)는 각 대상을
`make -k <target>`로 끝까지, 앞의 대상이 실패한 뒤에도 실행하고, 그 출력을 출력하며
`var/report/ci-targets/targets/<target>.log`에 씁니다. `summary.md`는 각 대상을 결과와 시간과 함께, 실패한 대상마다 그
첫 실패 줄과 log를 밝히며(`node_modules/@polyspec/kit/dist/target-report.mjs`), 같은 글이 GitHub Actions의 job summary로 갑니다. 실행은 lock
`var/report/ci-targets.lock`을 잡으므로 두 실행이 한 보고서를 쓰지 않고, 대상이 실패하면 status 1로 끝납니다. 각 job은
`var/report/ci-targets`를 artifact `report-<job>`으로 `if: ${{ !cancelled() }}`와
`if-no-files-found: error`로 올립니다. `tests/build/ci-local.test.mts`는 `make ci-targets` 밖에서 검사를 실행하거나
보고서를 올리지 않는 job에서 실패하고, polyspec/kit의 `tests/kit/ci.test.mts`는 실패하는 probe 대상과 통과하는 probe
대상을 실행해 두 log, summary의 실패 줄, job summary를 확인합니다.

## 함께 쓰는 resource

다른 checkout의 실행이 한 기기에서 동시에 실행됩니다. 한 실행이 소유할 수 있는 resource는 그
실행을 위해 만듭니다: `mktemp -d`나 `mkdtemp`의 임시 directory, operating system이 정하는 port, 실행의
식별자를 담은 이름입니다. 기기나 checkout에 하나뿐인 resource는 `node_modules/@polyspec/kit/dist/holder-lock.mjs`의 holder lock
아래에서 씁니다.

- 한 번에 한 실행만 lock을 잡습니다. lock file은 holder의 record를 담습니다: lock을 잡은 code의
  checkout, pid, 그 process의 시작 시각, lock을 잡은 시각, command, random token입니다. record는 전용
  file에 모두 쓴 뒤 lock path로 link하고, lock이 있으면 link가 실패하므로, lock은 atomic하게 잡히고
  읽는 쪽은 일부만 쓰인 record를 보지 않습니다.
- lock이 잡혀 있으면 실행은 holder의 record와 함께 실패합니다.
- holder process가 더 이상 실행되지 않거나 그 pid가 시작 시각이 다른 process의 것이 된 lock은 record와
  함께 보고하고 남겨 둡니다. `node node_modules/@polyspec/kit/dist/holder-lock.mjs clear <lock file>`로 명시적으로
  지우며, 이 command는 실행 중인 holder를 거부합니다.
- holder만 lock을 해제합니다. 해제는 먼저 record의 token을 확인합니다.
- `node node_modules/@polyspec/kit/dist/holder-lock.mjs run <lock file> -- <command>`는 lock을 잡은 채 command를 실행하고,
  SIGINT, SIGTERM, SIGHUP을 전달하며, command가 끝나면 lock을 해제하고 그 status로 끝납니다. 획득과
  해제를 출력합니다.

한 checkout의 resource lock은 그 checkout의 `var/locks/<name>.lock`이며, lock file은 절대 경로로 줍니다.
polyspec/kit의 `tests/kit/holder-lock.test.mts`는 record, 거부, 동시 실행, holder가 더 이상 실행되지 않는 lock의 제거, 해제를 확인합니다.

| Resource | 한 실행의 사용 |
|---|---|
| `make docs-verify-idempotent`의 snapshot | `mktemp -d`의 directory, 실행이 끝날 때 지움 |
| build되는 각 package의 `dist` | checkout lock `dist-<package folder>`, package build 전체와 모든 pack이 잡음; build는 `dist.next`에 쓰고 그것으로 `dist`를 바꿈 |
| build stamp, PHP module과 그 build 기록, OrderedJSON checkout | 실행의 경로에 쓴 뒤 제자리로 rename(`tests/build/atomic-publish.test.mts`) |

build되는 모든 package의 build script는 `node ../../scripts/package-dist.mts build '<command>'`이고,
package `dist` lock 아래에서 build command를 실행합니다. command는 `CRUDUI_DIST`가 가리키는 `dist.next`에 쓰고,
완료된 build는 rename 두 번으로 `dist`를 바꾸므로, build 중에 `dist`를 읽는 test나 program은 이전 output이나 새
output을 보며 비워진 directory는 보지 않습니다. 실패한 build는 `dist`를 그대로 둡니다. `node scripts/package-dist.mts pack
<package directory> <destination directory>`는 같은 lock 아래에서 `dist`에 output이 있는지 확인하고
`npm pack`을 실행하며, 그 JSON report를 standard output에 출력합니다. package install check와 CRUDUI
archive를 설치하는 repository는 이것으로 pack하므로, build가 비운 `dist`를 읽는 pack은 없습니다.
Linux에서 lock은 process 시작 시각을 `/proc`에서 읽습니다. 최소 container image에는 `ps`가 없기
때문입니다.

`npm run test:runtimes`가 실행하는 `tests/build/shared-resources.test.mts`는 documentation,
`dist` 행을 확인합니다. `dist` lock은 임시 checkout에서 build하는 fixture package로 확인하므로 저장소의 build
결과물을 읽지 않고 `npm run build`보다 먼저 실행됩니다.

## PHP source와 extension test 범위

각 PHP library는 `public`과 `php-source-internal` PHPUnit suite를 선언한다. 기본 suite는 `public`이며 extension은 PHP
library source-load guard를 활성화하고 실행한다. 구현 helper를 호출하는 test는 source suite에 유지한다. 혼합 test class는 공개 API
assertion을 public suite에 남기고 helper assertion을 source class로 분리한다.

Source Composer test script는 두 suite를 모두 선택한다. PHP validator CI entry는 해당 script를 사용하고 PHP API CI entry는
generator의 두 suite를 선택하며 `make crudui-test-php-source`는 source-internal suite를 포함한다. 공개 extension 실행은 모든 public case를
유지한다. 공유 expression과 composition fixture 검사는 PHP source binding과 별도의 native C engine binding을 유지한다.
Contract requirement와 fixture case를 제거하지 않는다.

`npm run test:php-scope`는 native PHPUnit XML case 목록으로 public과 source-internal case ID가 겹치지 않으며 합집합이 전체
발견 case와 같고 기본 선택이 전체 public 선택과 같음을 검증한다. 같은 unit이 source entry 명령도 검사한다. Fixture JSON은
`tests/php/FixtureJson.php`에서 공개 OrderedJSON API를 사용하여 extension process에 PHP 구현 helper를 로드하지 않고 고립
surrogate 입력을 보존한다.
