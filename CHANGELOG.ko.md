# 변경 기록
<!-- doc-id: changelog -->
<!-- source-sha256: 31e616bca68fd2666ac83de54f86285e82d8858b94319a4607844f6dda441ca3 -->

## Unreleased

### 2026-11-01 — kit 0.0.86과 ordered-json 0.0.16 채택 (C17.108)

- crudui는 릴리스 파일에 패커의 파일 이름을 쓰는(P39) kit 0.0.86과 ordered-json 0.0.16를 쓴다. `config/release.json`은 모든 패키지의 product와 runtime을 선언하고, `ci.yml`의 이름은 kit 릴리스 workflow를 위해 `ci`이며, 패키지 이름 테스트는 `release.json`의 product를 옛 crate 이름으로 읽지 않는다.

### 2026-10-31 — crudui의 workflow만 테스트한다 (C17.107)

- workflow 테스트는 `ci.yml`과 `pages.yml`만 읽는다. kit-check가 설치된 kit과 같음을 보장하는 kit 복사본 `ci-pipeline.yml`과 `release.yml`은 `isVendored`로 뺀다. 그래서 kit 릴리스가 crudui 테스트를 더 바꾸지 않는다. 릴리스 입력 테스트는 지운다.

### 2026-10-31 — build 테스트가 kit 0.0.84 workflow를 읽는다 (C17.105-1)

- build 테스트는 kit 0.0.84가 복사한 workflow를 읽는다. bootstrap 줄은 통째로 맞추고, `devEngines.packageManager`에서 읽은 `npm@$version`은 기록된 npm으로 보며, `.mise/locks` 아래의 보조 manifest는 crudui 패키지가 아니고, 릴리스 dispatch는 run 하나만 받는다(K924). main CI run 41200932267의 runtime shard 1과 2가 이 테스트에서 실패했다.

### 2026-10-31 — kit 0.0.84를 채택한다 (C17.105)

- kit 0.0.84가 고정된 릴리스다. package.json은 `devEngines.packageManager`에 npm 12.2.0을 선언하고(K938), mise.toml은 `npm:npm`과 그 mise.lock 항목, `.mise/locks/npm-npm/12.2.0`의 보조 lock을 선언한다. CI bootstrap은 그 npm을 `--prefix`로 checkout 밖에서 실행한다. `config/generated.json`은 Go 표 두 개를 이유와 함께 `tracked`로 적는다. CI 단계는 kit 0.0.81이 없앤 `kit-install-php-arginfo`(K930)를 더 부르지 않는다.

### 2026-10-31 — OrderedJSON 패키지 폴더 스크립트의 인자를 검사한다 (C17.104)

- `scripts/ordered-json-package.mts`는 두 인자를 쓰기 전에 검사한다. 그래서 build 작업의 루트 타입 검사가 통과한다. main CI 실행 41177855445는 이 파일의 타입에서 실패했다.

### 2026-10-31 — OrderedJSON 패키지 폴더 스크립트를 rebuild-check 분류에 넣는다 (C17.103)

- `scripts/ordered-json-package.mts`를 `config/rebuild.json`에 policy로 분류한다. PIE가 패키지 폴더 기록을 정의하지 않기 때문이다. main CI 실행 41176818702의 kit 작업은 이 파일에서 rebuild-check로 실패했고, 그 작업에 의존하는 런타임 테스트와 conformance 증거는 건너뛰어졌다.

### 2026-10-31 — OrderedJSON 패키지 폴더 기록을 전용 스크립트로 옮긴다 (C17.102)

- ordered-json-ext가 PIE 패키지 폴더를 기록하는 일은 Makefile의 인라인 node 스크립트가 아니라 `scripts/ordered-json-package.mts`가 한다. 그래서 오프라인 테스트가 그 줄을 다운로드 명령으로 읽지 않는다. main CI 실행 41167701052의 shard 3/4는 그 줄에서 실패했다.

### 2026-10-31 — OrderedJSON PIE 테스트를 런타임 검사에서 실행한다 (C17.101)

- `tests/build/ordered-json-pie.test.mts`를 런타임 테스트 명령에 넣어서 `tests/build`의 모든 node:test 파일이 프로젝트 명령으로 실행된다. main CI 실행 41167701052의 shard 2/4는 이 파일이 목록에 없어서 실패했다.

### 2026-10-31 — 도구 파일의 TypeScript 6.0.3 예외를 지운다 (C17.100)

- config/toolchain.json은 더 이상 packages/svelte의 TypeScript 6.0.3 예외를 담지 않는다. kit K953이 그것을 읽던 버전 장치를 지우고, 이 파일은 rust nightly 예외만 받는다. packages/svelte의 package.json 고정값은 그대로 둔다.

### 2026-10-31 — 읽히지 않는 npm 필드를 지우고 KO 변경 기록을 다시 찍는다 (C17.98-1)

- tests/build/runtime-version-policy.test.mts의 RecordedToolchain은 더 이상 npm 필드를 읽지 않는다. 감사가 찾은 두 번째 packageManager 파서다. CHANGELOG.md의 KO 쌍은 make documents-stamp로 다시 찍었다.

### 2026-10-31 — 릴리스된 0.0.9 항목을 되돌리고 0.0.81 문구를 적는다 (C17.96-1)

- pie-build를 적었던 릴리스된 0.0.9 항목 두 개를 공개된 문구로 되돌렸다. Unreleased 항목과 행의 문구는 kit main이 pie-build를 제거하며(K931) 0.0.81에 포함될 예정이라고 적는다.

### 2026-10-31 — packageManager에 npm@12.2.0의 sha512 다이제스트를 적는다 (C17.98)

- package.json의 packageManager는 npm@12.2.0+sha512.<hex>다. 이 값은 레지스트리의 dist.integrity이며, kit main의 bootstrap이 요구한다(K933). kit 핀 변경은 필요 없다.

### 2026-10-31 — 0.0.9 게시를 기록한다 (C17.97)

- release run 41090852507이 db740a10의 CI run 41086677097을 사용했다. tag v0.0.9는 db740a10에 annotated(bb3dbf85)로 달렸고, GitHub Release는 draft가 아닌 공개 상태이며 asset은 12개다.

### 2026-10-31 — kit의 pie-build 대신 PIE를 직접 실행해 OrderedJSON php-ext를 빌드한다 (C17.96)

- `make ordered-json-ext`는 var/pie/polyspec/ordered-json-php-ext를 비운 뒤 그 안에서 `pie repository:add`와 `pie build`를 실행하고, installed.json의 한 항목 install-path를 var/ordered-json-package에 기록한다. kit main이 pie-build를 제거하므로(K931) 0.0.81에 포함될 예정이고, 레시피는 더 이상 pie-build를 부르지 않는다.

## 0.0.9

### 2026-10-31 — lint-coverage test는 kit의 lint-ts가 아니라 make lint의 Svelte lint를 단언한다 (C17.91-2)

- tests/build/lint-coverage.test.mts는 make lint가 Svelte ESLint를 실행한다고 단언한다. C17.91 규칙이 놓친 두 번째 test다. CI build-lint job은 ci-local이 단언한다(C17.91-1).

### 2026-10-30 — OrderedJSON php-ext를 빌드하는 target이 PIE를 설치하고, 빌드가 실패하면 target도 실패한다 (C17.93)

- `make ordered-json-ext`는 먼저 http:pie의 PIE를 설치하고(`make install-pie`, `install-tools TOOLS=pie`), 그 패키지를 빌드하는 job이 설치를 잊을 수 없게 한다. pie-build의 출력은 파일에 쓰여서 빌드가 실패하면 target도 실패한다.
### 2026-10-30 — build-lint는 kit의 lint task가 아니라 Svelte lint만 실행한다 (C17.91-1)

- ci.yml의 build-lint job은 `lint` 대신 crudui-lint(Svelte lint)를 실행한다. `lint`의 recipe는 kit의 lint task라서 모든 runtime의 lint-<runtime>을 실행하며, kit pipeline의 gate를 중복한다. K870 test가 이를 단언한다.

### 2026-10-30 — Svelte 컴포넌트만 lint하고 TypeScript는 kit의 lint-ts gate가 실행한다 (C17.91)

- `make lint`는 Svelte workspace의 ESLint만 실행한다. kit의 CI pipeline이 ts runtime gate로 lint-ts를 한 번 실행하므로 build-lint job은 그것을 다시 실행하지 않는다.

### 2026-10-30 — @polyspec/kit 0.0.79를 채택한다: 하나의 CI pipeline, run id 기반 release, kit의 PIE 경로 (C17.90)

- @polyspec/kit 핀은 0.0.79다. kit-sync가 ci-pipeline.yml과 0.0.79의 release.yml을 가져오고 gates.yml을 지운다. ci.yml은 pipeline을 `kit` job으로 호출하고 저장소 job은 `needs: kit`로 그 뒤를 따른다.
- `make release-tag`는 성공한 ci.yml run의 commit에 tag를 만들고, dispatch는 그 run과 version을 받는다. config/release.json은 더 이상 checks를 적지 않는다.
- `make ordered-json-ext`는 kit의 pie-build(K915)로 OrderedJSON php-ext를 빌드하고 그 폴더를 var/ordered-json-package에 기록하며, 로컬 record server가 그것을 읽는다.

### 2026-10-30 — Python CI job를 다른 validator job과 같은 validator · Python 이름으로 바꾼다 (C17.89)

- ci.yml에서 Python validator와 generator suite를 실행하는 job을 JavaScript, PHP, Go, Rust validator job과 같은 validator · Python으로 이름 짓는다.

### 2026-10-30 — @polyspec/kit 0.0.78을 채택한다 (C17.88)

- package.json과 package-lock.json의 @polyspec/kit 핀은 K909, K916, K918을 담은 0.0.78 release tgz다. make kit-sync는 vendored PRINCIPLES 사본을 0.0.78이 쓰는 대로 쓰며, kit-inject-check는 설치된 0.0.78에 대해 통과한다.

### 2026-10-30 — vendored PRINCIPLES 사본을 kit 문구로 되돌린다 (C17.87)

- PRINCIPLES.md와 PRINCIPLES.ko.md는 다시 kit의 사본이다(make kit-sync). kit-inject-check가 통과하며, S10 줄은 kit의 `make test-php`를 가리킨다.

### 2026-10-30 — kit의 test-php가 그대로 실행되도록 source PHP suite 대상 이름을 바꾼다 (C17.86)

- `make crudui-test-php-source`가 kit test-php를 덮어쓰던 Makefile의 test-php 레시피를 대체한다. CI는 validator-php 작업에서 실행하고 CI_TARGETS가 이름을 지정한다.

### 2026-10-30 — form-comparison 브라우저와 기록 검사 전에 OrderedJSON php-ext를 빌드한다 (C17.85)

- 로컬 stack을 시작하는 form-comparison 대상이 ordered-json-ext에 의존하여, 새 체크아웃은 읽기 전에 var/pie/<version>을 빌드한다.

### 2026-10-30 — PIE 작업 디렉터리를 OrderedJSON 버전으로 나눈다 (C17.84)

- PIE_WORK는 var/pie/<version>이라, 이전 버전이 같은 작업 디렉터리에 추가한 저장소가 새 버전을 가리지 않는다.

### 2026-10-30 — 릴리스 OrderedJSON php-ext를 PIE가 var/pie에 빌드한 것에서 읽는다 (C17.84)

- 릴리스 레코드 서버는 옛 var/ordered-json-php-ext 대신 make ordered-json-ext가 packages.json 저장소에서 PIE로 받아 빌드한 OrderedJSON php-ext 패키지를 읽는다.

### 2026-10-30 — kit이 더 이상 없는 phpunit 옵션을 generator 검사에서 뺀다 (C17.83)

- php-api generator 검사는 PHPUnit이 거부하는 --without-library를 넘기지 않으므로 generator PHP 확장 검사의 적합성 증거가 기록된다.

### 2026-10-30 — CI 설치 분기 매치를 읽기 전에 정의되었다고 단언한다 (C17.82)

- dependency-health는 CI 분기 매치를 읽기 전에 정의되었음을 단언해, CI의 make typecheck가 통과한다.

### 2026-10-30 — main에서 이미 실패하던 ci-local 단언을 맞춘다 (C17.77)

- main에서 이미 실패하던 ci-local 단언을 kit 내부면 삭제하고, crudui 동작이면 현재 workflow에 맞춘다(push-gate.yml은 없어졌고 release 검사는 ci-passed다).

### 2026-10-30 — OrderedJSON 릴리스를 0.0.14로 통일한다 (C17.81)

- crudui는 composer.json의 packages.json 릴리스에서 OrderedJSON 0.0.14를 고정하고, composer.lock과 Rust form 서버 Cargo.lock에 잠그며, 릴리스 문서에 0.0.14를 적는다.

### 2026-10-30 — CI의 OrderedJSON 버전을 맞는 정규식으로 읽는다 (C17.80)

- CI provider 단계는 packages.json URL에서 OrderedJSON 버전을 한 번 쓴 백슬래시 정규식으로 읽어, 모든 CI job이 빈 버전 대신 릴리스 tag를 clone한다.

### 2026-10-30 — kit K892가 고아로 만든 prepare-commit-msg 훅을 제거한다 (C17.78)

- prepare-commit-msg 커밋 훅을 제거한다. kit에는 그 타깃이 없고, 저장소의 모든 커밋이 다시 돌아간다.

### 2026-10-30 — kit 0.0.77 2차 묶음을 채택한다 (C17.74)

- crudui는 공개된 @polyspec/kit 0.0.77 asset을 고정하고, 메인 체크아웃에서 kit과 OrderedJSON을 링크한다. toolchain-check, CI가 반복하던 공유 gate, release-assets-fetch, cargo-downloads-check, link-state-check를 제거한다.

### 2026-10-30 — canonical Composer 프로젝트를 릴리즈 packages.json으로 검사한다 (C17.75)

- dependency-health 테스트는 canonical Composer 프로젝트가 polyspec/ordered-json을 릴리즈 packages.json에서 해결하고, 저장소 밖을 가리키는 path 저장소를 선언하지 않음을 검사한다.

### 2026-10-30 — CI 설치 분기를 Makefile 본문에서 읽는다 (C17.68)

- dependency-health 테스트는 crudui-install-composer의 CI 분기를 CI 신원으로 실행하지 않고 Makefile 본문에서 읽는다. 어떤 테스트도 CI를 가장하지 않는다.

### 2026-10-30 — reference-transaction 잔여 참조를 제거한다 (C17.59)

- reference-transaction 훅(K801)의 파일과 참조가 저장소에 남아 있지 않다. make hooks가 쓰는 훅은 pre-commit, commit-msg, prepare-commit-msg다.

### 2026-10-30 — python 백엔드 잔여 선언을 제거한다 (C17.60)

- pythonBackend, dependency-policy.json, python 백엔드 선언이 남아 있지 않다. 그것들을 지운 kit은 더 이상 검사하지 않는다.

### 2026-10-30 — release 소비자와 release 증명 잔여 채택을 제거한다 (C17.61)

- release 소비자 테스트와 release 증명 채택이 없다. release fixture와 오프라인 검사가 통과한다.

### 2026-10-30 — commit 규칙 소비자 상태 잔여를 제거한다 (C17.63)

- pre-merge-commit 훅, commit-identity 선언, commits-check 대상이 남아 있지 않다. make hooks는 pre-commit만 쓴다.

### 2026-10-30 — make release-versions 단계 잔여를 제거한다 (C17.64)

- release 워크플로는 더 이상 make release-versions를 실행하지 않는다.

### 2026-10-30 — 오프라인 다운로드 목록에서 unlink 대상을 뺀다 (C17.62)

- offline-checks 테스트는 unlink를 다운로드 대상으로 세지 않는다. kit은 unlink를 오프라인으로 실행하므로 오프라인 설정을 풀지 않는다.

### 2026-10-30 — form-comparison Rust 서버가 ordered-json 태그를 오프라인으로 해석한다 (C17.71)

- form-comparison Rust 서버는 ordered-json을 태그 v0.0.13으로, lock은 그 커밋으로 고정하고, config/release-assets.json은 ordered-json 0.0.13을 선언하므로 cargo는 sibling checkout과 같은 소스를 해석한다.

### 2026-10-30 — ordered-json을 릴리즈 packages.json에서 해결한다 (C17.57)

- 루트 Composer 프로젝트는 저장소 밖의 path로 ordered-json을 연결하지 않고, polyspec/ordered-json 0.0.13을 릴리즈 packages.json에서 해결한다. 개발에서는 make link가 설치 폴더를 sibling checkout에 심볼릭 링크한다.

### 2026-10-30 — 실행 체크리스트의 날것 자리표시자를 코드로 표기한다 (C17.73)

- 실행 체크리스트는 자리표시자를 코드 표기로 보여 주므로, 사이트가 C7.8의 timeout 줄에서 `<command>`를 지우지 않는다.

### 2026-10-30 — 반복된 리터럴 선택지의 입력 실패를 유지한다 (C17.69)

- PHP 확장은 반복된 리터럴 선택지의 입력 실패를 form 오류의 이전 예외로 유지한다.

### 2026-10-30 — 잘못된 패턴의 매개변수와 구문 원인을 유지한다 (C17.70)

- PHP 확장은 잘못된 매개변수와 그 패턴 구문 오류를 load 오류의 이전 예외로 유지한다.

### 2026-10-30 — kit 0.0.75을 채택한다 (C17.72)

- crudui는 공개된 @polyspec/kit 0.0.75 asset과 그 lock을 고정한다. kit-sync는 그 버전의 workflow에 변경을 만들지 않는다.

### 2026-10-30 — kit 0.0.74을 채택한다 (C17.67)

- crudui는 공개된 /kit 0.0.74 asset과 그 lock을 고정한다. kit-sync는 그 버전의 CI와 release workflow 및 kit 소유 문서를 쓴다.

### 2026-10-30 — kit가 삭제한 네 target의 참조를 제거한다 (C17.58)

- crudui는 kit가 삭제한 dependency-policy-check, dependency-policy-mutation-check, dependency-review, composer-provider-entries를 더 이상 참조하지 않는다. 이들만을 위해 있던 파일은 제거한다.

### 2026-10-30 — 삭제된 target의 강제 참조를 제거한다 (C17.66)

- PRINCIPLES.md와 AGENTS.md는 삭제된 target이나 hook을 강제 수단으로 적지 않는다: commits-check, pre-push, pre-merge-commit, dependency-policy-check, push-gate. 도구가 읽지 않는 규칙은 `none`으로 적는다.

### 2026-10-30 — 삭제된 파일의 owner-check glob을 제거한다 (C17.65)

- config/owner-checks.json은 C17.63과 C17.61이 삭제한 config/commit-identity.json과 tests/release-install/**를 더 이상 가리키지 않는다. owner-validate는 추적되는 모든 경로를 소유한다.

### 2026-10-29 — 범위가 지정된 Kit gate로 0.0.9 후보를 확정한다 (C18.13-6)

- Kit 0.0.63은 현재 후보 archive를 빌드하고 깨끗한 외부 consumer는 package 11개를 모두 설치하고 검사한다. Native Composer consumer 기록은 명시적 로컬 zip package metadata를 사용한다. 최종 release metadata는 전체 candidate CI와 공개 release proof를 필수로 유지한다.

### 2026-10-29 — Native Go 실행 파일 생성물을 ignore한다 (C18.13-7)

- Unix와 Windows의 native Go module 실행 파일은 정확한 생성 경로에서 ignore한다. Source file은 계속 표시하며 candidate archive는 깨끗한 커밋 source 요구사항을 유지한다.

### 2026-10-29 — Provider source 연결 범위를 runtime별로 지정한다 (C18.13-5)

- Kit 0.0.63은 native source 연결에 각 runtime을 전달한다. Runtime job은 자체 ecosystem을 준비하고 연결하며 full parity는 전체 연결을 유지한다. Native 회귀 검사는 실제 Git manifest를 사용하고 전체 연결의 의존성 요구사항을 보존한다.

### 2026-10-29 — 선택한 toolchain 환경을 검증한다 (C18.13-4)

- 선택한 Node/npm과 Go 환경은 PHP arginfo 없이 공개 Kit 검사를 통과한다. Extension build 준비는 고정 generator와 parser 요구사항을 유지한다. 공개 전에 최종 격리 candidate CI를 통과해야 한다.

### 2026-10-29 — 모든 앱 workflow의 설치 범위를 지정한다 (C18.13-3)

- 문서, push 검증과 의존성 검토 workflow는 필요한 도구만 선언한다. Push 검증은 PHP 없이 Node와 npm을 사용한다. Native 회귀 검사는 앱 소유 모든 workflow에서 전체 환경 설치 호출을 거부한다.

### 2026-10-28 — Native PHP 원인 예외를 보존한다 (C18.13-2)

- PHP form과 composition 오류는 선택적인 원인 예외 생성자 인자로 잡은 원인을 보존한다. C extension은 같은 signature를 제공하고 예외 수명 동안 원인을 유지하며 잘못된 원인 type을 거부한다. 오류 code, message, form path와 composition trace는 기존 값을 유지한다.

### 2026-10-28 — 0.0.9 릴리즈 후보를 준비한다 (C18.13-1)

- Release manifest와 내부 의존성은 0.0.9를 선언한다. Native package manager는 후보 입력을 잠그며 release consumer fixture는 현재 source에서 빌드한 archive를 설치한다.

### 2026-10-28 — 선택한 잠긴 도구로 독립 언어 CI를 준비한다 (C18.12)

- CI는 job별로 필요한 Kit 0.0.61 도구만 선택 설치한다. Go와 Rust job은 각 validator와 generator suite를 담당하며 JavaScript generator unit은 분리 실행한다. 언어 간 비교는 전체 필요 환경을 자체 준비한다. PHP extension fixture와 native parser lint는 필수 입력을 명시적으로 준비하며 CI Composer 설치는 lock을 갱신하지 않고 따른다.

### 2026-10-28 — 빌드 전용 의존성 권고 판단을 기록한다 (C18.12-3)

- 의존성 검토는 기존 npm 심각도 기준을 유지한다. 패치가 없는 low 심각도 deepmerge 권고는 raw audit 결과에 유지되며 신뢰한 Svelte build 설정에 한정된다. 권고 예외나 의존성 override를 추가하지 않는다.

### 2026-10-28 — 정기 의존성 검토 준비를 수정한다 (C18.12-2)

- 의존성 검토는 도구 설치 전에 선언한 PHP를 준비하며 도구 설치를 한 번 실행한다. 앱 target은 공용 검토 명령 호출 전에 CI target 선택 값을 비운다. 로컬에서 명시한 의존성 version target은 계속 지원한다.

### 2026-10-28 — CI 환경별 설치 준비를 정의한다 (C18.12-1)

- CI 준비 계획은 job별 도구, native lock 입력, 독립 build 책임과 선택 설치 적용 검증 기준을 명시한다. Release 0.0.8은 공개 상태이며 설치 범위 적용은 별도 항목으로 관리한다.

### 2026-10-28 — 언어 간 비교를 독립 실행한다 (C18.11)

- CI는 JavaScript, HTML, Go, Rust, Python, PHP와 native PHP extension의 생성기 동등 검사를 독립 job으로 실행한다. 언어별 unit job은 기존 검사를 유지한다. 비교 job은 자체 입력을 준비하고 두 report와 evidence를 업로드하며 conformance와 최종 CI 검사의 필수 결과가 된다.

### 2026-10-27 — CRUDUI 0.0.8을 공개한다 (C18.10)

- Release v0.0.8은 CI와 push 검사를 통과한 commit `47612fe4297203d46232646eba8365a6fbda43ef`의 패키지 archive 11개를 공개한다. Release workflow는 공개 전에 checkout 밖에서 archive 11개를 모두 설치하고 검사한다. 두 Go module tag도 같은 commit을 가리킨다.

## 0.0.8

### 2026-10-27 — Native untimed suite 기본값을 복원한다 (C18.10-30)

- Native Node suite 전체 실행은 기본 무제한 시간을 사용한다. Validation fixture 준비와 pipeline suite는 모든 개별 case 제한시간과 assertion을 유지한다.

### 2026-10-27 — Service child에서 test flag를 분리한다 (C18.10-29)

- IPC service는 선언된 runtime argument와 application environment를 사용한다. 부모 test instrumentation flag와 test context는 service process에 전달하지 않는다.

### 2026-10-27 — 병렬 pipeline reset evidence를 기준 순서로 정렬한다 (C18.10-28)

- Pipeline report는 선언된 server identity 순서로 reset record를 정렬하고 각 identity가 정확히 한 번 존재하도록 검사한다. 완료 순서는 유효한 evidence를 바꾸지 않으며 누락, 중복 또는 알 수 없는 reset record는 report에 남아 검사에서 실패한다.

### 2026-10-27 — Pipeline suite 전체에는 시간 제한을 두지 않는다 (C18.10-27)

- Pipeline suite 전체에는 시간 제한을 두지 않는다. Store reset과 flow case는 기존 개별 제한시간과 동시 실행 수를 유지하여 suite 실행시간 때문에 남은 case 실행 전에 정상 stack이 중단되지 않도록 한다.

### 2026-10-27 — 정확한 Rust Unicode parity test를 선택한다 (C18.10-25)

- Rust Unicode parity는 exact filter에 완전한 native test identifier를 사용하여 선언된 data 검사를 실제로 실행한다.

### 2026-10-27 — 병렬 pipeline report record를 기준 순서로 정렬한다 (C18.10-26)

- Pipeline report는 병렬 실행 후 모든 combination record를 선언 순서로 정렬한다. 누락, 중복과 알 수 없는 identity는 완전성 검사에서 계속 실패하며 잘못된 record도 report에 남는다.

### 2026-10-27 — Parity 실행 전에 PHP extension을 빌드한다 (C18.10-24)

- Native PHP extension parity는 extension binding을 불러오기 전에 extension build 완료를 기다린다.

### 2026-10-27 — Timed assertion 전에 native fixture를 컴파일한다 (C18.10-22)

- Native validation과 binding program은 setup operation에서 컴파일한다. Locale 실행은 현재 run의 validation program을 재사용하며 sanitizer flag, runtime assertion과 case 제한시간은 유지한다.

### 2026-10-27 — Rust model test와 contract 문서를 분리한다 (C18.10-23)

- Rust field model test는 동일한 test identity와 assertion을 유지하며 native child test module을 사용한다. Parity 선언은 production contract 문서와 해당 test module을 별도로 분류한다.

### 2026-10-27 — 모든 release mode stack 검사에 native archive를 준비한다 (C18.10-21)

- Summary와 직접 form comparison 검사는 release mode stack을 시작하기 전에 고정된 OrderedJSON native archive를 내려받는다. 로컬 source mode는 선언된 provider 해석을 유지한다.

### 2026-10-27 — Native source와 fixture layout 예외를 선언한다 (C18.10-20)

- Layout 검사는 선언된 외부 OrderedJSON source, 정확한 PHP fixture helper와 공유 Go evidence writer를 허용한다. 다른 root Composer path repository는 저장소 내부 경로 해석 검사를 유지한다.

### 2026-10-27 — Release build 전에 native cache를 준비한다 (C18.10-19)

- Release와 candidate archive target은 package output을 빌드하기 전에 선언된 Cargo와 Go 의존성을 내려받는다. Go 다운로드는 선언된 저장소 workspace에서 해석하며 병렬 Make에서도 archive 준비는 다운로드 후 빌드 순서를 유지한다.

### 2026-10-27 — Kit 0.0.60을 반영한다 (C18.10-18)

- 개발 도구 의존성과 native npm lock은 Kit 0.0.60 release archive를 고정한다. 공유 원칙은 공개 package와 일치하며 로컬 개발은 native source link로 polyspec 의존성을 해석한다.

### 2026-10-27 — 현재 candidate archive와 consumer lock을 준비한다 (C18.10-17)

- Candidate archive는 pack 전에 현재 package output을 빌드한다. Native npm과 Composer는 해당 archive에서 consumer lock을 다시 생성하며 깨끗한 외부 consumer는 release package 11개를 설치하고 smoke 검사를 실행한다.

### 2026-10-27 — 실제 outline과 rendering evidence 범위를 선언한다 (C18.10-16)

- Fixture 선언은 기존 browser group source 검사, 렌더링한 button operation과 JavaScript outline을 식별한다. Feature별 runtime 적용 범위는 Python outline의 compilation과 binding을 기록하며 다른 runtime에서 해당 operation을 실행했다고 선언하지 않는다.

### 2026-10-27 — Rust fixture recorder는 lint policy에서 요구하는 버릴 결과의 type을 명시한다 (C18.10-15)

- Rust fixture recorder는 lint policy에서 요구하는 버릴 결과의 type을 명시한다.

### 2026-10-27 — Composer lock은 PHPUnit 13.4.4를 선택하고 dependency review는 현재 native lock graph를 기록한다 (C18.10-14)

- Composer lock은 PHPUnit 13.4.4를 선택하고 dependency review는 현재 native lock graph를 기록한다.

### 2026-10-27 — Feature contract 문서는 현재 manifest command와 fixture 선언을 설명한다 (C18.10-13)

- Feature contract 문서는 현재 manifest command와 fixture 선언을 설명한다.

### 2026-10-27 — Structure fixture 목록은 현재의 모든 유효 schema case와 기존 invalid case를 포함한다 (C18.10-12)

- Structure fixture 목록은 현재의 모든 유효 schema case와 기존 invalid case를 포함한다.

### 2026-10-27 — Native engine fixture는 전체 validation context를 초기화하고 condition tree 구현을 연결한다 (C18.10-11)

- Native engine fixture는 전체 validation context를 초기화하고 condition tree 구현을 연결한다.

### 2026-10-27 — 잘못된 UTF-8이 있는 native JavaScript와 HTML 요청은 공개 invalid input error를 반환한다 (C18.10-10)

- 잘못된 UTF-8이 있는 native JavaScript와 HTML 요청은 공개 invalid input error를 반환한다.

### 2026-10-27 — 공개 Rust field model은 schema data limit을 보존하고 잘못된 limit 표현을 거부한다 (C18.10-9)

- 공개 Rust field model은 schema data limit을 보존하고 잘못된 limit 표현을 거부한다.

### 2026-10-27 — CI job은 선언된 provider와 hook을 설치하고 기준 Go workspace를 사용하며 release mode server asset을 준비한다 (C18.10-8)

- CI job은 선언된 provider와 hook을 설치하고 기준 Go workspace를 사용하며 release mode server asset을 준비한다.

### 2026-10-27 — Fixture 적용 범위와 실제 runtime 증거를 기록한다 (C18.10-7)

- Fixture 선언은 지원 runtime, operation별 case와 공유 support module을 식별한다. 기존 fixture unit은 native PHP 실행을 포함해 공유 recorder로 실제 결과를 기록한다. Suite record는 PHP source와 extension 실행을 구분한다. 기본 cross-product 검사는 유지하며 누락되거나 잘못된 적용 범위와 증거를 거부한다.

### 2026-10-27 — 시간 제한 assertion 전에 native fixture program을 컴파일한다 (C18.10-6)

- 공유 validation과 unique-rule program을 setup operation에서 컴파일한다. Test는 해당 run에서 만든 program만 실행하며 기존 assertion과 제한시간을 유지한다.

### 2026-10-27 — Composition fixture 입력을 해석하고 slot class 처리를 모은다 (C18.10-5)

- Parity rendering과 binding은 동일하게 해석한 fixture specification을 받는다. 지원하지 않는 field type은 명시적으로 렌더 불가이며 slot class는 slot module에서만 읽는다.

### 2026-10-27 — Root manifest를 기준으로 packed version을 검증한다 (C18.10-4)

- Package 설치 검사는 각 공개 package에 root manifest의 정확한 version을 요구한다.

### 2026-10-27 — Native report fixture의 선언한 decoder 의존성을 로드한다 (C18.10-3)

- Native report child는 CRUDUI library autoloader 없이 FixtureJson과 선택한 OrderedJSON 의존성을 로드한다.

### 2026-10-27 — CI toolchain과 native 의존성 범위를 준비한다 (C18.10-2)

- 모든 전체 tool 설치 전에 PHP를 준비한다. Workspace version replacement는 미공개 internal Go module을 로컬에서 해석하며 native Go package discovery는 test가 있는 모든 package를 선택한다. JavaScript 검증은 import 검사 전에 compiled public entry를 준비한다. GNU Make 환경 검증은 Make 3와 Make 4의 정확한 target-specific 선언 형식을 허용한다.

### 2026-10-27 — CRUDUI 0.0.8 공개를 준비한다 (C18.10)

- Release candidate는 Kit 0.0.59, OrderedJSON 0.0.10 및 PHP 8.4.27 개발 기준과 함께 version 0.0.8을 기록한다. Runtime CI test는 네 개의 독립 shard를 사용한다. 공개에는 candidate commit의 검사 성공이 필요하다.

### 2026-10-27 — 선언한 workspace로 Go release source를 빌드한다 (C18.10-1)

- Go package 빌드는 미공개 internal module version을 repository workspace에서 해석한다. Release consumer의 module resolution은 격리를 유지한다.

### 2026-10-27 — 공개 polyspec 의존성과 CI test 실행을 갱신한다 (C18.9)

- Root manifest와 native lock은 Kit 0.0.59와 OrderedJSON 0.0.10을 고정한다. OrderedJSON PHP archive는 선언한 release digest를 사용하며 CI는 native 개발 의존성을 위해 해당 tag의 source를 준비한다. Rust JSON 변환은 object key와 value의 UTF-8 byte string을 검증한다. Runtime CI test는 report를 분리한 네 개의 독립 shard에서 실행한다. Test command는 source 및 packaged 설치에서 설치된 Kit public CLI export를 해석한다. PHP source test는 test prerequisite 없이 public 및 internal suite를 모두 실행한다.

### 2026-10-27 — PHP 개발 기준을 8.4.27로 설정한다 (C18.8)

- Composer platform 선언과 native lock은 PHP 8.4.27을 기준으로 개발 및 release consumer 의존성을 해석한다. Windows 설치는 8.4.27-1 package rebuild를 사용한다. Library 요구는 PHP 8.4 이상을 유지하며 shared installer는 8.4 minor를 선택한다.

### 2026-10-27 — kit 0.0.56을 반영한다 (C18.7)

- Root 개발 의존성과 npm lock은 공개된 kit 0.0.56 archive 및 SHA-512 integrity를 고정한다. Native npm 링크는 현재 kit과 OrderedJSON source checkout을 유지한다. 공유 principles는 설치된 kit source와 동기화한다.
- Make는 설치 package의 bootstrap을 읽으며 자체 CI의 Make job은 선언된 npm으로 locked package를 먼저 설치한다. Svelte 5.57.3, PostCSS 8.5.32와 typescript-eslint 8.72.1은 기존 호환 requirement로 해석한다. Release consumer에 fsevents 2.3.3 script 승인을 선언하고 Rust API fixture는 operation logger를 포함한다.
- 연결된 kit source는 K696 수정으로 native Composer development path lock을 허용한다. Dependency-health와 Rust entry-point 소유 test는 27개 모두 통과하고 link-state와 kit copy 검증도 통과한다. 커밋된 npm lock은 공개된 kit 0.0.56을 유지하며 해당 archive에는 K696 수정이 없다.

### 2026-10-26 — Native Composer 준비 함수를 내부에 둔다 (C18.1-8)

- Record-server setup은 native Composer 준비 함수를 내부에서 호출한다. 외부 호출자가 없는 함수의 export를 제거한다. Unused-export 예외 없이 TypeScript lint의 모든 단계가 통과한다.

### 2026-10-26 — 작업 로그와 test result를 분리한다 (C18.1-7)

- Workspace build, API 생성, browser 설치와 반복 build는 test-result metadata를 읽거나 쓰지 않고 작업 단계, 실패, 경과 시간과 heartbeat를 보고한다. 회귀 fixture는 child command의 성공과 실패 모두에서 상위 test result가 보존되는지 검증한다. Native command fixture는 정의되지 않은 working directory를 명시적으로 표현한다.

### 2026-10-26 — Contract version을 workspace metadata와 대조한다 (C18.1-6)

- Feature manifest 검사는 과거 literal version 대신 root package version을 읽는다. 현재 candidate를 허용하며 일치하지 않는 contract version에는 expected와 actual 값을 보고한다. Candidate checklist의 번역은 같은 task 순서를 유지한다.

### 2026-10-26 — 로컬 candidate 준비를 완료한다 (C18.1)

- Candidate 준비는 현재 로컬 provider source, native 의존성 기록과 검토한 호환 toolchain을 사용한다. Candidate 준비 작업을 모두 완료한다. 현재 npm, Composer와 Python archive는 격리된 설치 검사를 통과하며 native PHP는 별도 Composer profile을 사용한다. 공유 설정 복사본은 설치된 kit source와 일치한다. CI와 publication은 별도 작업이다.

### 2026-10-26 — Local native server는 선언한 현재 provider를 사용한다 (C18.1-3)

- Local PHP와 Rust 준비는 `config/local-providers.json`이 선언한 OrderedJSON checkout을 선택합니다. PHP extension source, module name과 version은 provider Composer metadata를 사용합니다. Native PHP는 source SDK library가 없는 별도 잠긴 Composer application·PHPUnit profile을 사용하며 pure PHP는 source profile을 유지합니다. Runtime mode 검사는 선택한 native extension identity를 요구합니다.


### 2026-10-26 — Dependency 검사가 native Go workspace를 발견한다 (C18.1-5-1)

- Dependency review와 policy 검사는 native Go workspace 발견을 사용한다. Module별 workspace는 저장소 module과 local provider module을 함께 유지하며 다른 module은 추적 root workspace를 발견한다. Release consumer는 GOWORK=off를 유지한다. Native Go는 generator, validator와 OrderedJSON module을 local main module로 보고한다.

### 2026-10-26 — Dependency 검사가 선언된 Go workspace를 사용한다 (C18.1-5)

- Dependency review와 dependency policy 검사는 추적 root go.work로 저장소 Go module을 해석한다. Candidate module version은 registry 의존성이 아닌 local workspace member로 유지한다. Release consumer 검증은 GOWORK를 끈 상태로 실행한다. Native make 환경 test는 두 범위를 검증한다.

### 2026-10-26 — Python build 도구가 검토한 patch release를 사용한다 (C18.1-4)

- Generator, validator와 conformance helper가 setuptools 84.2.1을 build backend로 선언한다. Toolchain은 backend wheel SHA-256과 Ruff 0.17.2의 native mise platform lock을 기록한다. 정확한 backend wheel의 hash 검증, helper의 offline build, 기록된 Ruff와 runtime 검사가 통과한다.

### 2026-10-26 — 기본 Composer project가 현재 source를 설치한다 (C18.1-1)

- Private root Composer manifest와 native lock은 configuration reference를 사용하는 path symlink로 CRUDUI 0.0.8과 현재 OrderedJSON 0.0.10 sibling source를 해석한다. 기본 PHP 설치는 release download 없이 source package를 갱신한다. 중복 local manifest와 lock을 제거하고 기존 Composer 검사는 canonical project를 검증한다. Native 설치 기록, PHP 8.4.26 platform 요구, 선택한 의존성 검사와 FormJson test가 PHPUnit 13.4.3으로 통과한다.

### 2026-10-26 — 모든 candidate npm archive에 consumer smoke 검사가 있다 (C18.1-2)

- Release consumer는 framework와 build 의존성을 lock으로 고정하여 npm archive 일곱 개를 모두 설치한다. Svelte consumer는 설치한 package를 Vite와 Svelte plugin으로 build한 뒤 component와 rendering export를 검사한다. npm과 Composer consumer lock은 현재 0.0.8 archive를 가리키며, npm·Composer·Python package 총 열한 개의 clean consumer 설치와 smoke 검사가 통과한다.

### 2026-10-26 — 현재 문서 도구 candidate 검토를 완료한다 (C18.2)

- CI 전 문서 검토는 직접 관리하는 최신 수정 Markdown parser 15.0.3을 유지합니다. 새 stable과 next VitePress archive에는 영향받는 reference parser가 남아 있습니다. Rebuild record는 현재 registry channel, archive digest, parser 선택과 완료된 candidate 결정을 기록합니다.

### 2026-10-26 — React 19.3.1이 렌더링 후 client widget script를 실행한다 (C18.3)

- React와 React DOM은 19.3.1을 사용한다. Client widget script는 inert template 옆에서 effect로 실행하고 unmount까지 DOM에 유지하며, 이후 render는 node를 보존하고 다시 실행하지 않는다. Server 출력과 hydration은 script element를 유지한다. React 의존성 예외를 제거한다. React 소유 test와 Chromium, Firefox, WebKit의 client/server script 검사가 통과한다.

### 2026-10-26 — Candidate npm 의존성은 현재 호환 version을 사용한다 (C18.4)

- npm lock은 browser 도구, YAML, DOM, Vite, Vitest와 lint 도구의 현재 호환 patch 및 minor version을 선택한다. Svelte 도구의 현재 peer 범위는 TypeScript 7을 지원하지 않아 TypeScript 6.0.3을 유지한다. 로컬 PHP 검증은 native 개발 profile로 현재 OrderedJSON source를 사용한다. 선택한 소유 test, Svelte typecheck와 lint가 통과한다.

### 2026-10-26 — Candidate 검증을 위해 version 0.0.8을 준비한다 (C18.5)

- Release manifest와 내부 의존성은 0.0.8을 명시합니다. npm, Cargo, uv와 local Composer profile은 workspace lock을 갱신하며 feature manifest와 consumer 선언은 candidate version을 사용합니다. 기존 변경 기록은 0.0.8 section에 둡니다. Tag는 생성하지 않습니다.

### 2026-10-26 — PHP 구현 unit을 별도 source suite로 실행한다 (C18.6)

- PHP source 실행은 public 및 source-internal suite를 선택하며 extension은 PHP library source 없이 모든 public case를 선택한다. 혼합 class는 공개 assertion을 유지하고 helper assertion을 분리한다. Native PHPUnit 목록은 원래 case를 모두 보존하고 범위 coverage를 증명한다. Fixture decode는 공개 OrderedJSON API를 사용하며 공유 native expression 및 composition binding은 유지한다.


### 2026-10-26 — 공유 kit 설정을 추적 일반 파일로 둔다 (C17.56-2)

- 공유 principles, editor 설정과 command 설정은 kit-sync가 동기화한 일반 파일이다. 관리 workflow는 현재 설치한 kit source와 일치한다. Source package 설치 폴더는 native 링크를 유지한다. Kit 설정 검사, 문서 쌍과 선택 workflow trigger 검사가 통과한다.

### 2026-10-26 — Native source 설치 입력을 명시적으로 유지한다 (C17.56-1)

- 앱은 native npm source 링크 뒤 필요한 lint 명령을 직접 선언하며 기존 lock version을 유지한다. Composer 로컬 path reference는 native 설정 hash를 사용하여 관련 없는 저장소 commit이 source lock을 바꾸지 않는다. 검토한 release dependency lock에는 advisory가 없다.

### 2026-10-26 — Native 개발 설치가 현재 sibling source를 사용한다 (C17.56)

- Composer 로컬 개발은 composer.local.json과 native lock을 선택하고 호환되는 0.0.x source package를 해석하여 실제 version을 기록한다. 기본 archive manifest와 lock은 유지한다. Installed-version 검사는 오래된 source metadata를 거부한다. Composer 명령 변수는 native manifest selector를 보존하며 Knip 검사는 Node package metadata로 설치한 kit의 의존성을 해석한다.

### 2026-10-26 — 조건부 철회는 candidate 재검토 단계를 유지한다 (C17.52-1)

- 조건부 도구 및 의존성 결정은 원인과 재시도 조건이 있는 candidate 단계 checklist를 갖는다. 개발 완료는 publication 검토를 완료하지 않는다. 저장소 절차는 수용한 종결 결정과 보류한 candidate 검사를 구분하며 PHP extension policy coverage 기록은 완료한 검증을 명시한다.

### 2026-10-26 — 종결 checklist 결정과 release 입력을 검토한다 (C17.52)

- Checklist는 유지하는 의존성 선언과 도구 선택의 현재 근거를 설명한다. Dependency review는 lock 17개에서 advisory가 없음을 기록하며 철회된 sprintf-js exception을 제거한다. Native PHP extension manifest는 version 갱신에 포함된다. Release coverage, manifest version과 선택한 소유 검사가 통과하며 release publication에는 해당 commit의 검사 성공이 필요하다.

### 2026-10-26 — Unicode contract가 package의 property 범위를 사용한다 (C16.13-1)

- Unicode contract는 잠긴 release의 @unicode/unicode-16.0.0에서 property 범위를 읽는다. 저장한 UCD 파일과 parser를 제거한다. Unicode 16.0.0, general category 35개, script 170개와 모든 code point 범위를 유지한다.

### 2026-10-26 — 검토한 문서 site parser release를 기록한다 (C16.8-1)

- 문서 build 도구는 rebuild record를 참조합니다. 검토한 두 VitePress distribution의 내장 reference parser에 보안 수정이 없어 검사된 Markdown renderer를 유지합니다. Route, link 검사와 development-server 동작은 소유 unit으로 검증합니다.

### 2026-10-26 — HTTP 전달이 양방향 연결 header를 제거한다 (C16.29-1)

- Form comparison은 전달 전에 Connection이 지정한 요청 header를 제거하며 target routing, 조기 응답, 구조화된 upstream 실패와 upload 취소를 보존한다. 전달 unit test는 이 동작을 검사한다. 재구현 기록은 Node.js adapter와 http-proxy를 비교하고 현재 구현을 설명한다.

### 2026-10-26 — Go toolchain이 linked module의 최소 버전과 일치한다 (C17.54)

- 기록한 Go toolchain과 workspace는 Go 1.27.3을 요구한다. mise.lock은 네 platform의 archive를 고정한다. 기록한 toolchain으로 linked comparison module graph를 해석하며 runtime-version policy 검사가 통과한다.

### 2026-10-26 — 의존성이 수정된 npm 및 Tokio 버전을 사용한다 (C17.53)

- npm lock은 fast-uri 3.1.9, undici 8.12.3, zod 4.6.7, markdown-it 15.0.3을 선택하며 중첩 의존성에는 markdown-it 14.3.3을 사용한다. Rust form comparison lock은 Tokio 1.53.3을 선택한다. npm audit은 취약점이 없음을 보고하며 comparison lock의 Rust audit은 취약점과 경고가 없음을 보고한다. 선택한 dependency graph, JSON shape, documentation rendering 및 Rust server test가 통과한다.

### 2026-10-26 — Rust fixture reader가 오류를 명시적으로 match한다 (C17.38-1)

- Rust fixture reader는 파일 읽기와 JSON parse에 명시적 Result match를 사용한다. 실패는 fixture 경로와 원래 오류를 보존하며 선택한 Clippy 검사는 저장소 설정을 사용한다. 진단 예시도 같은 오류 처리 형식을 설명한다.

### 2026-10-26 — 모델 round-trip 검사가 구현 coverage를 설명한다 (C17.10-2)

- PHP와 Go FieldSpec round-trip 검사는 구현별 직렬화를 설명한다. 공유 validation fixture는 data limit 선언과 검증 요구사항의 coverage를 유지한다. Test 이름, assertion과 선택은 유지한다.

### 2026-10-26 — Contract manifest가 내부 URL export를 선언한다 (C17.40-1)

- Generator core internal entry는 contract manifest에 sanitizeUrl을 선언한다. 생성된 feature 문서도 같은 export를 포함하며 manifest export 검사와 생성 문서 검사가 통과한다.

### 2026-10-26 — 완료된 checklist 수정을 통합한다 (C17.47)

- 통합 변경은 rendering, validation budget, native dispatch, API 오류, source 문서와 test 준비의 선택된 소유 검사를 유지한다. 영문·한국어 작업 기록과 변경 항목이 일치한다. PHP source 변경은 source 문서 unit을 선택한다. 전체 실행 결과와 conformance 증거 한계는 docs/features.md에 기록한다.

### 2026-10-26 — Runtime 검사가 선언된 tool 경로와 dry-run helper를 사용한다 (C17.36-1)

- Make dry-run helper는 make database 옵션으로 target별 변수를 읽는다. Runtime 검사는 test runner 경로와 확장자를 make에서 읽고 bootstrap 경로를 Makefile include에서 읽는다. Offline target 검사는 local PHP arginfo generator를 offline으로 분류한다.

### 2026-10-26 — Root fixture 검사가 설치된 package API를 사용한다 (C17.37)

- Text-validity fixture는 설치된 validator와 generator API를 호출하고 decodeFormTemplate으로 승인한 template을 decode한다. Validator text helper test도 loader 검사에 같은 설치 API를 사용한다. Button fixture는 평가한 button 네 개를 tuple로 선언하고 validation fixture는 생성 record의 타입을 명시한다. Root TypeScript 검사는 package 구현 source를 root configuration으로 compile하지 않고 통과한다.

### 2026-10-26 — PHP generation 실패가 API error type을 유지한다 (C17.49)

- API parity report가 잘못된 mixed button 입력을 INVALID_FORM_INPUT code와 선언된 list message를 가진 FormError로 검사한다. Validator의 choice-source 실패는 같은 code와 message를 유지한 FormError로 변환되어 generator API를 나간다. Report는 extension loading mode 두 가지를 PHP library와 비교한다.

### 2026-10-26 — Native graph 검사가 submission budget을 선언한다 (C17.10-1)

- Native graph 경계 fixture는 depth 512 또는 values 1000000을 선언하고 200000행 Go uniqueness test는 submission value budget을 선언한다. Graph 크기, 기대 결과와 기본 submission limit을 유지한다. PHP는 모든 sibling node를 보관하지 않고 검사된 tree를 depth-first로 측정한다. PHP와 Go field model은 생략된 member와 빈 선언을 포함한 dataLimits를 유지한다.

### 2026-10-26 — Rust fixture 오류가 경로와 원인을 명시한다 (C17.38)

- Rust generator fixture reader는 파일 읽기와 JSON parsing 실패에 fixture 경로와 원래 오류를 명시한다. buttons, complete forms, form state, form rendering, list rendering, detail rendering, validity test target의 604개 case가 모두 통과한다.

### 2026-10-26 — Cross-check 입력이 native build와 fixture requirement를 사용한다 (C17.39)

- Native PHP process test는 기본적으로 var/php-ext/polyspec_crudui.so를 읽으며 PHP_EXTENSION override를 유지한다. Validation fixture export는 명시한 requirement ID의 순서를 보존하고 미주석 draft에 빈 requirement 목록을 작성한다. Exporter는 validation 결과, hidden path와 failure record를 보존한다.

### 2026-10-26 — Display renderer가 JavaScript link URL을 대체한다 (C17.40)

- Vue와 Svelte의 list 및 detail renderer는 CUDF-023이 요구하는 throwing URL로 JavaScript link URL을 대체한다. 내부 URL serializer는 form action과 HTML attribute도 처리한다. Display model은 선언된 href 값을 유지한다.

### 2026-10-26 — CLI manifest test가 전체 package 표를 검증한다 (C17.41)

- CLI manifest test는 모든 package entry, visibility와 value export를 현재 contract의 표 전체와 정확히 비교한다. Fixture는 public과 internal entry, export 순서와 빈 export 목록을 검증한다.

### 2026-10-26 — Go button 계약 검사가 소유 package를 선택한다 (C17.42)

- bindButtons와 formButtonsHtml 검증 명령은 TestButtonsSuite가 있는 Go generator package를 선택한다. Shared button case 22개를 모두 실행하며 일치하는 button test가 없는 example server package는 선택하지 않는다.

### 2026-10-26 — Condition fallback textarea가 viewport 안에 배치된다 (C17.43)

- Stylesheet는 flex로 배치한 control과 affix widget에만 결합 border와 음수 결합 margin을 적용한다. 구조화된 condition widget는 독립된 border와 0의 결합 margin을 유지하여 Chromium, Firefox, WebKit의 좁고 넓은 viewport에서 fallback textarea가 viewport 안에 배치된다.

### 2026-10-26 — PHP server fixture가 선언된 PHP 설치 경로를 사용한다 (C17.44)

- PHP server unit fixture는 launcher module에서 해석하는 경로에 php-config와 PHP-FPM을 배치한다. 각 test는 readiness 실패와 cleanup 실패를 포함한 모든 결과에서 launcher 종료를 기다린 뒤 sandbox를 제거한다.

### 2026-10-26 — Python native 검사가 structure map 요청을 전달한다 (C17.45)

- Python native generator program이 buildOutline 요청과 평가된 node를 Generator.buildOutline으로 전달한다. 공유 outline 사례 5개가 unknown-operation 오류 없이 native program을 통해 실행된다.

### 2026-10-26 — Condition editor 식별자가 apostrophe를 보존한다 (C17.35-1)

- PHP extension은 condition wrapper 식별자에 shared renderer와 같은 raw attribute escaping을 적용한다. 기존 tree fixture는 apostrophe를 포함한 idPrefix를 사용하며 exact HTML 비교를 통과한다.

### 2026-10-26 — HTML condition widget이 공유 raw serializer를 사용한다 (C17.35-2)

- HTML renderer는 textarea, editor tree, error와 affix에 core condition widget serializer를 사용한다. Structured condition widget의 attribute 순서, void element 표기와 escaping은 React renderer와 일치한다.

### 2026-10-26 — Native PHP record 저장이 표준 score 변환을 사용한다 (C17.46)

- PHP record store는 검증된 decimal score text를 PHP numeric conversion으로 변환하며 finite-number 검사를 유지한다. Native extension process에서 validator NumberValue 구현 class를 읽지 않는다. Native process 검사를 유지하며 score test는 customer specification으로 decimal 허용과 radix 거부를 검증한다.

### 2026-10-26 — Native condition editor가 raw HTML을 일관되게 작성한다 (C17.35-3)

- PHP, Go, Rust, Python은 structured condition editor를 raw text와 attribute로 직렬화한다. Textarea는 JSON 따옴표를 유지하고 editor input은 HTML void tag를 사용하며 condition node, error, affix는 shared renderer와 같은 escaping을 적용한다.

### 2026-10-26 — PHP engine fixture가 반복 scalar array를 간결하게 컴파일한다 (C17.48)

- C fixture emitter는 loop와 개별 소유 clone으로 반복 scalar array를 만들며 길이와 모든 값을 보존한다. Validation program은 references.c를 link한다. 50,000-row uniqueness fixture는 충분한 submitted-data budget을 선언한다. Compiler flag와 시간 제한을 변경하지 않고 선택한 shared validation, uniqueness, scalar-array, undefined-behavior 검사가 통과한다.

### 2026-10-26 — PHP extension이 모든 condition editor message를 반환한다 (C17.50)

- PHP extension의 Form::getMessages 결과는 생성된 interface table의 conditionMode, conditionAddComparison, conditionAddGroup, conditionAddJudge, conditionRemove, conditionInvalid를 포함한다. 공개 결과는 Korean, English, Japanese, Chinese의 전체 interface-message contract와 일치한다.

### 2026-10-26 — PHP source 문서 검사를 문서 도구에서 실행한다 (C17.51)

- 문서 도구 unit은 source PHP process에서 두 PHP package의 source provenance와 class 및 public-method 문서를 검사한다. Checker는 source 선언 대신 로드된 native class, 다른 file의 class와 누락된 문서를 거부한다. PHP library runtime test tree는 source 문서 test를 포함하지 않으며 해당 parity-internal 선언을 제거한다.

### 2026-10-26 — Production import가 runtime dependency를 요구한다 (C17.15-1)

- Production dependency 검사는 각 workspace source entry에 Knip의 strict production dependency resolution을 적용한다. Fixture는 devDependencies에만 선언한 import를 거부하고 dependencies와 peerDependencies를 허용한다. CLI는 ajv, ajv-formats, js-yaml을 runtime dependency로 선언한다. 검사는 lint-ts와 함께 실행하며 C17.15의 미해결 dependency 사항을 해결한다.

### 2026-10-26 — PHP 검증 기록이 측정한 버전을 보존한다 (C16.168)

- 검증 기록은 PHP 8.4 이상을 지원 범위로 명시하고 선택한 CI toolchain을 지원 범위와 구분한다. 날짜가 있는 PHP 8.5.10 측정은 과거 증거로 유지하며 현재 tree의 검증을 주장하지 않는다.

### 2026-10-26 — PHP 확장이 구조화된 조건 편집기 HTML을 일관되게 렌더링한다 (C17.35)

- C renderer는 구조화된 condition editor를 raw HTML로 작성한다. textarea text의 따옴표를 유지하고, editor input에 HTML void tag를 사용하며, editor text와 affix에 shared renderer와 같은 escaping을 적용한다. comparison test 11개가 통과하며 이전에 실패한 rendering 검사 3개를 포함한다.

### 2026-10-26 — Build 검사가 현재 kit 소유 경로와 package import를 읽는다 (C17.36)

- Build 검사는 kit의 source tool과 configuration을 읽고 PHP extension contract test를 포함하며, kit 소유 경로를 저장소별 규칙에서 제외한다. Native test 파일 pattern은 존재하는 파일로 확장하고, import 검사는 module lexer로 읽은 각 package subpath를 실제 설치에서 해석한다. npm은 locked graph와 설치된 local package link를 각각 검사한다.

### 2026-10-26 — php-ext 테스트 소스 목록이 rule_condition_tree.c와 canonical.c를 링크한다 (C17.33)

- php-ext comparison과 contract 테스트가 위젯과 숫자 표기에 필요한 소스(rule_condition_tree.c, canonical.c)를 컴파일하여 다시 링크된다. 링크가 드러낸 comparison 차이는 C17.34다.

### 2026-10-26 — crudui는 kit의 dist가 아니라 소스를 가리킨다(C17.34)

- C17.34 완료(C17.34): npm script, contracts/features.json과 config/dependency-policy.json의 검증 명령, composer.json, README, build test가 kit의 dist 대신 kit이 K613부터 실행하는 node_modules/@polyspec/kit/scripts/kit/<tool>.mts와 $(KIT)/<tool>.$(KIT_EXT)를 가리킨다. kit K646은 dist 빌드를 멈춘다. scripts/test-commands.mts는 소스 runner를 알아본다. Red: tests/build/ci-local.test.mts가 Makefile에서 kit 도구를 찾지 못했다. 변경 뒤 통과한다.

### 2026-10-26 — 그룹 소스는 리터럴 선택지를 그룹의 행과 합친다(C17.31)

- C17.31 완료(C17.31): 그룹 소스는 choices를 선언하며, 이 리터럴 값과 라벨 쌍은 그룹의 행보다 먼저 나열되고 암묵적 in 검사에서 행과 하나의 집합으로 검사된다. 예를 들어 인물 id 옆의 청중 player가 그렇다(docs/spec/schema.md CUSC-089, docs/spec/validation-rules.md CUVR-085). 값이 리터럴 선택지를 반복하는 행은 검증과 바인딩에서 INVALID_FORM_INPUT으로 실패하며 그 행 경로와 값을 밝히고, 규칙을 어기는 choices는 컴파일과 로드에서 실패한다(CUVR-086). TypeScript, PHP, PHP extension, Go, Rust, Python에 구현했다. red: make parity-check UNITS="validate form-render"가 모든 구현에서 validate 9개와 form-render 3개 사례로 실패했고, 변경 뒤 green.

### 2026-10-26 — 반복된 그룹 소스 값은 검증에 실패한다(C17.32)

- C17.32 완료(C17.32): 값이 앞선 행의 값을 반복하는 그룹 소스의 행은 검증에서 더 이상 조용히 빠지지 않는다. 암묵적 in 검사가 INVALID_FORM_INPUT과 Group source value repeats an earlier row: {value} at {path}(CUSC-090, CUVR-087)로 실패하며, TypeScript, PHP, Go, Rust, Python과 PHP extension의 C engine이 모두 따른다. 렌더링은 그 값을 한 번 나열한다. red: make parity-check UNITS="validate form-render"가 모든 validator에서 group-source-repeated-value와 group-source-repeated-number로 실패했고, 변경 뒤 green.

### 2026-10-26 — 그룹 소스는 boolean을 담는 필드를 거부한다(C17.19)

- C17.19 완료(C17.19): from이나 label이 데이터가 true나 false여서 선택지도 라벨도 주지 않는 checkbox나 switcher 필드를 가리키는 그룹 소스를 컴파일과 검증이 Invalid items.{member} at {path}: {field} holds a boolean, expected a field whose values are strings or numbers(CUSC-068)로 거부한다. TypeScript, PHP, Go, Rust, Python과 PHP extension의 C engine이 모두 따른다. red: 새 validate와 form-render case가 모든 구현에서 실패했고, 변경 뒤 green.

### 2026-10-26 — config/rebuild.json은 추적된 도구만 적고 각 도구에 class를 붙인다 (C17.30)

- K614 이후 더 이상 없는 파일의 rebuild 항목을 지웠고, group-source form-render 도구는 형제 도구와 같이 policy로 분류했다. rebuild-check가 통과한다.

### 2026-10-26 — 구조 조건 편집기 (C17.25)

- C17.25 완료 (C17.25): condition 필드는 design.editor로 text 또는 structured를 선언하고, structured 편집기에서는 비교가 제시하는 서로 다른 필드 이름인 options.fields를 선언한다 (docs/spec/schema.md, CUSC-083~CUSC-086). structured 편집기에서 모든 생성기는 textarea를 숨기고 그 뒤에 조건 트리의 화면을 렌더링한다: 모드 select를 가진 fieldset 그룹, 필드·연산자·값 컨트롤을 가진 비교, conditionTree judge에서의 판정 텍스트, 그리고 비교·그룹·판정 텍스트를 추가하고 조건을 제거하는 버튼 (docs/spec/form-markup.md, CUMK-067). 편집기가 보여 줄 수 없는 값은 conditionTree와 필드 경로를 밝히는 이름 있는 오류 뒤에 textarea를 보이게 둔다 (CUMK-068). connectForm은 이 컨트롤과 버튼으로 트리를 다시 쓴다 (docs/spec/form-runtime.md, Condition values). TypeScript, HTML·React·Vue·Svelte 렌더러, PHP, PHP 확장, Go, Rust, Python이 구현한다. Red: make parity-check UNITS="form-render spec-validity" exit 2 at 976c214b; green: 모든 구현이 form-render 241/241, spec-validity 37/37 사례를 통과한다.

### 2026-10-26 — Makefile이 kit 도구를 $(KIT_EXT)로 실행한다 (C17.29)

- $(KIT)/<도구>.mjs를 실행하던 레시피 줄 열 개를 $(KIT)/<도구>.$(KIT_EXT)로 바꿨다. 검사는 이제 kit 소스를 .mts로 따른다 (K613).

### 2026-10-25 — 반복 그룹의 선택지가 브라우저에서 소스 행을 따른다(C17.15)

- C17.15 완료(C17.15): docs/spec/schema.md에 CUSC-071을 적는다. 폼 인스턴스는 변경마다 현재 데이터에서 그룹 소스의 선택지를 나열하며, 나열해도 값은 바뀌지 않는다. step `choices`로 필드 노드의 선택지를 관찰하는 새 form-state family tests/fixtures/form-choices가 TypeScript, Go, Python, Rust, PHP, PHP extension 구현에서 이를 test한다(unit form-choices). React, Vue, Svelte, HTML renderer 폼은 공유 module tests/fixtures/form-session/group-source.mts를 실행한다. packages/form-binding의 브라우저 검증 바인딩은 연결할 때와 input 또는 change마다 컨트롤의 데이터로 HTML renderer와 patchContent를 써서 그룹 소스가 있는 각 필드의 본문을 다시 렌더링하고, 아직 선택지인 선택된 값을 유지하며, option language와 idPrefix를 받는다. Svelte widget patch는 선택된 옵션을 지웠을 때 마크업이 표시한 옵션을 선택하므로, 선택지가 사라진 select는 첫 옵션 대신 아무것도 선택하지 않는다. red: form-binding choices test가 5개 중 4개 실패했고, Svelte session test는 선택된 소스 행을 지운 뒤 첫 옵션이 선택된 상태를 보였으며, 변경 뒤 green.

### 2026-10-25 — C17.4는 reference 규칙을 더한다(C17.4)

- C17.4 완료(C17.4): reference 규칙은 facts.id 같은 필드의 선언 경로를 받는다. 그 id는 경로 위 모든 행에서 그 필드가 가진, 비어 있지 않은 scalar 값이며 숨긴 필드의 값도 포함하고, 값은 in의 포함 여부 규칙으로 통과한다. 문자열이 아니거나 선언된 필드, group, lang이 있는 필드를 가리키지 않는 매개변수는 INVALID_RULE_PARAMETER로 load에 실패한다(docs/spec/validation-rules.md, CUVR-071~CUVR-074). TypeScript, PHP, PHP 확장, Go, Rust, Python이 구현하고 meta-schema, CLI explain 라벨, TypeScript API report가 이름을 싣는다. red: e198dba8에서 make docs-check가 scripts/check-schema.mts에서 실패했고(meta-schema가 사례 reference-row-ids의 reference를 거부), make parity-check UNITS="validate"는 모든 구현에서 356개 중 341개만 통과하고 reference 사례 15개에 실패했다. green: docs-check가 통과하고 모든 구현이 356개 중 356개를 통과한다.

### 2026-10-25 — crudui는 kit K614와 K621을 따른다 (C17.28)

- kit-sync 복사본을 지웠다. Makefile은 kit checkout의 kit-bootstrap을 include하고, config/php-lint를 지웠으며, PRINCIPLES.md, PRINCIPLES.ko.md, .editorconfig, .claude/settings.json은 kit으로 가는 추적 symlink가 되었다. 삭제된 경로의 owner-check 글롭을 뺐고, make hooks가 쓴 훅 파일을 커밋했다.

### 2026-10-25 — C17.27은 PHP 확장에서 float control 값을 정규 텍스트로 쓴다(C17.27)

- C17.27 완료(C17.27): PHP 확장은 float control 값을 %.15g 대신 ps_number_text로, 같은 double로 다시 읽히는 가장 짧은 텍스트인 정규 텍스트로 씁니다. 이제 0.30000000000000004를 0.3으로 쓰지 않습니다(docs/spec/form-markup.md CUMK-069). tests/fixtures/form-render의 text-float-value case는 모든 generator에서 통과합니다.

### 2026-10-25 — C17.26은 Python에서 relations의 JSON 텍스트를 쓴다(C17.26)

- C17.26 완료(C17.26): Python generator는 data-source-relations에 relations 값의 JSON 텍스트를 쓰고, 없거나 null인 값만 []로 씁니다. 이제 {}와 ""를 []로 쓰지 않습니다(docs/spec/schema.md CUSC-088). tests/fixtures/form-render의 select-dynamic-relations-object와 select-dynamic-relations-text case는 모든 generator에서 통과합니다.

### 2026-10-25 — C17.22는 불리언, only, 객체가 아닌 multiple을 로드할 때 거부한다(C17.22)

- C17.22 완료(C17.22): 모든 검증기(TypeScript, PHP, PHP extension, Go, Rust, Python)는 multiple이 있고 불리언, only, 객체가 아닌 필드(null과 목록 포함)를 로드할 때 그 그룹 소스와 규칙보다 먼저 INVALID_RULE_PARAMETER, 메시지 Invalid multiple at {path}: expected a boolean, only or an object, 필드의 선언 경로로 거부한다(docs/spec/schema.md CUSC-081). red: make parity-check UNITS="validate"가 모든 검증기에서 거부 사례 다섯 개로 실패했고, 변경 뒤 green.

### 2026-10-25 — 키가 다른 반복 그룹의 행 키인 키 맵(C17.3)

- C17.3 완료(C17.3): 필드는 `only: true` 옆의 `multiple.keys`로 키 맵을 선언합니다. 값은 `enddate` 매개변수처럼 쓰는 필드 참조이며 폼의 반복 그룹을 가리키고, 그룹의 id는 그 행 키입니다(docs/spec/schema.md, 키 맵, CUSC-076부터 CUSC-078). 모든 validator(TypeScript, PHP, PHP extension, Go, Rust, Python)는 참조가 반복 그룹을 가리키지 않으면 `Invalid multiple.keys at {path}: expected a reference to a repeated group`로 로드에 실패하고(CUVR-070), 데이터의 키가 필드의 행 문맥에서 읽은 그룹의 행 키가 아니면 `Row key is not an id of {reference}: {path}`로 입력에 실패하며 키는 코드 포인트 순서로 검사합니다(CUVR-069). 이전에는 `multiple: only`가 어떤 키든 받았습니다. Rust validator의 typed FieldSpec은 `multiple`을 `false`, `true`, `only` 또는 설정 객체로 읽고 `only: true` 없는 `keys`를 거부하며, TypeScript의 `MultipleSettings`는 행 설정과 데이터 설정의 union입니다. 모든 generator는 `only: true` 옆의 `keys`를 받고, 그 밖의 경우와 문자열이 아닌 값을 거부하며, meta-schema와 TypeScript 타입이 이를 선언합니다. 공유 case는 tests/fixtures/validate/keyed-maps.mts, form-render case 4개, spec-validity의 `ok-multiple-keys`이며, config/parity.json은 unit validate, form-render, spec-validity에서 이 id를 인용합니다. Red: `make parity-check UNITS="validate form-render spec-validity"`가 exit 2이며 모든 implementation에서 validate 387개 중 362개, form-render 213개 중 209개가 통과했습니다. Green: exit 0이며 모든 unit이 모든 implementation에서 성립합니다.

### 2026-10-25 — form-render와 validate 개수 test가 cases.json을 따른다(C17.23)

- C17.23 완료(C17.23): Go, Rust, Python의 form-render suite test와 Python validate test는 공유 case를 추가한 row마다 올려야 했던 손으로 적은 합계 154, 59, 209, 425, 229, 196을 더 이상 assert하지 않는다. 각 test는 두 종류의 case가 모두 있고 결과 case와 실패 case를 합하면 그 cases.json의 모든 case인지 assert하므로, 뒤의 row가 추가한 case에 test를 고칠 필요가 없고 어느 종류도 기록하지 않거나 둘 다 기록한 case는 실패한다. red: make text-absent가 네 파일에서 합계를 찾았고, 변경 뒤 green.

### 2026-10-25 — C17.10은 제출 데이터를 제한한다(C17.10)

- C17.10 완료(C17.10): 폼 루트는 dataLimits: { depth, values }를 선언하며 기본값은 64단계와 100000노드입니다. 검증은 한도를 넘은 데이터를 어떤 규칙보다 먼저 INVALID_FORM_INPUT과 `Submitted data exceeds the {limit} limit of {n}`으로 실패시킵니다. 1부터 512 밖의 depth, 1부터 1000000 밖의 values, 다른 멤버는 INVALID_RULE_PARAMETER로 로드에 실패합니다(docs/spec/validation-rules.md CUVR-082부터 CUVR-084, docs/spec/schema.md CUSC-087). tests/fixtures/validate/data-limits.mts의 열아홉 case는 TypeScript, PHP, PHP 확장, Go, Rust, Python에서 통과합니다.

### 2026-10-25 — C17.7은 범위 경계를 데이터에서 읽는다(C17.7)

- C17.7 완료(C17.7): 필드는 minFrom 또는 maxFrom: <필드 참조>를 선언하며, 그 값은 참조 필드 값 이상이거나 이하인 유한한 수여야 한다. 없거나 null인 경계는 경계를 선언하지 않고, 있지만 유한한 수가 아닌 경계는 실패하며, 참조 문자열이 아닌 매개변수는 로드에 실패한다(docs/spec/validation-rules.md CUVR-079, CUVR-081). tests/fixtures/validate/bounds-from.mts의 열 case는 TypeScript, PHP, PHP 확장, Go, Rust, Python에서 통과한다.

### 2026-10-25 — C17.6은 typeFrom 규칙을 더한다(C17.6)

- C17.6 완료(C17.6): 필드는 typeFrom: <필드 참조>를 선언하며, 참조 필드의 값이 값의 타입을 이름 붙인다. bool은 boolean, int는 소수 부분이 없는 유한한 수, enum은 문자열이다. 없거나 다른 타입이면 실패하고, 참조 문자열이 아닌 매개변수는 로드에 실패한다(docs/spec/validation-rules.md CUVR-077, CUVR-078). tests/fixtures/validate/type-from.mts의 열한 case는 TypeScript, PHP, PHP 확장, Go, Rust, Python에서 통과한다.

### 2026-10-25 — C17.5는 containedIn 규칙을 더한다(C17.5)

- C17.5 완료(C17.5): 필드는 containedIn: <필드 참조>를 선언하며, 그 문자열 값은 equalTo의 참조처럼 해석한 참조 필드의 문자열 값 안에 들어 있어야 한다. 값이나 참조한 값이 문자열이 아니면 실패하고, 참조 문자열이 아닌 매개변수는 로드에 실패한다(docs/spec/validation-rules.md CUVR-075, CUVR-076). tests/fixtures/validate/contained-in.mts의 여덟 case는 TypeScript, PHP, PHP 확장, Go, Rust, Python에서 통과한다.

### 2026-10-25 — C17.24는 data-source-relations를 JSON.stringify처럼 쓴다(C17.24)

- C17.24 완료(C17.24): 모든 구현은 동적 선택지 기술자의 relations를 JSON.stringify가 쓰는 대로 data-source-relations에 쓰고, 각 숫자는 자신의 Number.prototype.toString writer(ps_number_text, Numbers::string, number_string, numberString, util::number_string)로, 각 문자열은 따옴표, 역슬래시와 제어 문자만 escape해서 쓴다. docs/spec/schema.md는 -0을 0으로 쓰는 것을 포함해 이 규칙을 명시한다. PHP extension은 float을 %.15g로, PHP json_encode는 1.0e+21과 escape한 U+2028로, Python은 1e-07로, Rust는 1e21로, Go는 -0과 escape한 <, &, U+2028로 썼다. PHP extension의 list.c는 두 번째 숫자 writer인 shortest_number를 지우고 ps_number_text를 쓴다. 공유 form-render case search-dynamic-relations-numbers와 search-dynamic-relations-text가 숫자와 문자열을 담는다. red: make parity-check UNITS="form-render"와 PHP extension comparison test가 새 case에서 실패했고, 변경 뒤 green.

### 2026-10-25 — 반복 그룹의 선택지가 브라우저에서 소스 행을 따른다(C17.15)

- C17.15 완료(C17.15): docs/spec/schema.md에 CUSC-071을 적는다. 폼 인스턴스는 변경마다 현재 데이터에서 그룹 소스의 선택지를 나열하며, 나열해도 값은 바뀌지 않는다. step `choices`로 필드 노드의 선택지를 관찰하는 새 form-state family tests/fixtures/form-choices가 TypeScript, Go, Python, Rust, PHP, PHP extension 구현에서 이를 test한다(unit form-choices). React, Vue, Svelte, HTML renderer 폼은 공유 module tests/fixtures/form-session/group-source.mts를 실행한다. packages/form-binding의 브라우저 검증 바인딩은 연결할 때와 input 또는 change마다 컨트롤의 데이터로 HTML renderer와 patchContent를 써서 그룹 소스가 있는 각 필드의 본문을 다시 렌더링하고, 아직 선택지인 선택된 값을 유지하며, option language와 idPrefix를 받는다. Svelte widget patch는 선택된 옵션을 지웠을 때 마크업이 표시한 옵션을 선택하므로, 선택지가 사라진 select는 첫 옵션 대신 아무것도 선택하지 않는다. red: form-binding choices test가 5개 중 4개 실패했고, Svelte session test는 선택된 소스 행을 지운 뒤 첫 옵션이 선택된 상태를 보였으며, 변경 뒤 green.

### 2026-10-25 — C17.2는 필드의 선택지를 반복 그룹에서 가져온다(C17.2)

- C17.2 완료(C17.2): 선택 필드는 items { from: group.*.field, label }을 선언하고 같은 폼 반복 그룹의 행을 데이터 순서대로 선택지로 나열한다(docs/spec/schema.md CUSC-061에서 CUSC-067). 컴파일과 검증기 로드는 규칙을 어기는 그룹 소스를 거부하고, 검증기는 선언한 규칙보다 먼저 암묵적 in 검사로 값을 선택지와 대조한다(docs/spec/validation-rules.md CUVR-060, CUVR-061). TypeScript, PHP, PHP extension, Go, Rust, Python에 구현했다. red: make parity-check UNITS="validate form-render"가 validate 16개와 form-render 8개 group-source 사례에서 실패했고, 변경 뒤 green.

### 2026-10-25 — C17.12는 form-render 실패 case의 message를 비교한다(C17.12)

- C17.12 완료(C17.12): form-render 실패 case는 여섯 binding(ts, php, php-extension, go, rust, python) 모두에서 발생한 code와 message를 expectError 기록 전체와 비교하므로, 틀린 message나 message가 없는 기록은 실패한다. Go suite는 Error가 code를 앞에 붙이는 composition 오류의 Message를 읽는다. docs/spec/form-runtime.md는 UNSUPPORTED_FIELD_TYPE의 message `Unsupported field type "{type}" at "{path}"`를 명시하고, fixture 생성기는 모든 오류 case의 message를 기록하고 확인하며 compose-ref-unresolved-load-error와 unsupported-type-throws의 message를 추가한다. red: make parity-check UNITS="form-render"가 message 없는 두 case에서 실패했고, 변경 뒤 green.

### 2026-10-25 — Go 생성기는 코드가 있는 폼 입력 오류를 반환한다(C17.21)

- C17.21 완료(C17.21): 합성 실패도 미지원 필드도 아닌 Go 생성기의 모든 실패는 코드 `INVALID_FORM_INPUT`의 `validate.FormInputError`이고, Go suite는 다른 모든 오류에 `INVALID_FORM_INPUT` 라벨을 붙이는 대신 오류(ComposeLoadError, UnsupportedFieldTypeError, FormInputError)에서 코드를 읽으며 코드가 없는 오류에서 실패한다. red: form-render parity-check가 Go에서 201개 중 152개 case로 실패했고, 변경 뒤 green.

### 2026-10-25 — 빈 select의 placeholder는 규칙이다(C17.14)

- C17.14 완료(C17.14): docs/spec/schema.md는 CUSC-080으로 option이 없는 select나 search 필드(`items` 없음, 빈 배열, 빈 맵, 동적 소스)가 번역하지 않고 선택되지 않는 `<option value="">select</option>`을 정확히 하나 쓴다고 명시하고, docs/spec/validation-rules.md는 CUVR-080으로 그 값이 빈 값이라고 명시하며 한국어 twin도 같다. form-render와 validate fixture가 이를 검사하고, parity unit form-render와 validate가 두 요구사항을 인용하며, 여섯 구현은 각각 CUSC-080을 인용하는 하나의 constructor로 option을 만든다. 출력은 바뀌지 않는다. red: parity-declarations-check가 CUSC-080과 CUVR-080 미추적으로 실패했고, case 추가 뒤 green.

### 2026-10-25 — C17.17은 describe의 grammar token을 token 요구사항에서 읽는다(C17.17)

- C17.17 완료(C17.17): crudui describe는 docs/spec/expressions.md 1절의 token을 그 절에 더 이상 없는 표 행이 아니라 C16.56이 bullet로 만든 요구사항 CUXP-001부터 CUXP-017에서 읽고, 다른 모양의 줄이나 token이 없는 절은 실패한다. 이 row는 make test-ts가 닿지 않는 packages/cli의 list-describe test를 실행한다. red: list-describe.test가 token 0개로 실패했고, 변경 뒤 green.

### 2026-10-25 — C17.20은 native test의 coverage 개수를 cases.json에서 도출한다(C17.20)

- C17.20 완료(C17.20): packages/php-ext/tests/comparison의 comparison test는 손으로 적은 합계 188, 162, 137, 157, 17, 28, 62 대신, 각 engine program이 form-render, list-render, detail-render cases.json에서 읽은 case를 모두 보고하는지 assert한다. expression과 composition test는 case마다 test 하나를 실행하므로 합계 74, 129, 20을 지운다. tests/native-generators/run.mts는 합계 188, 157, 5, 62를 suite check fixture-coverage로 바꾸고, 이 check는 form-render, list-render, form-outline, detail-render cases.json의 선택된 case에 사용 가능한 target의 check가 없으면 실패한다. program이나 suite가 빠뜨린 case는 실패한다. binding comparison test는 compilation이 code와 관계없이 CRUDUI 오류로 거부하는 case를 모두 compilation test에 맡기고, 그런 case가 모두 오류를 기대하는지 assert한다. red: comparison test가 201 !== 188로, run.mts가 201 !== 188로 실패했고, 변경 뒤 green.

### 2026-10-25 — 조건 필드가 모든 렌더러에서 조건 트리를 편집한다 (C17.18)

- C17.18 완료 (C17.18): `docs/spec/schema.md`가 조건 트리를 담고 리터럴 규칙 `validate.conditionTree` true 또는 judge를 요구하는 `condition` 필드를 정의한다(CUSC-070). `docs/spec/form-markup.md`는 그 컨트롤을 정의한다. textarea 필드의 textarea이며 `crudui-input--condition` 클래스, `data-crudui-value="json"` 표시, 값의 조건 텍스트를 가지고, 문자열이 아닌 값의 조건 텍스트는 JSON.stringify 텍스트다(CUMK-066). `docs/spec/form-runtime.md`는 `connectForm`과 `@polyspec/crudui-form-binding`의 브라우저 검증이 텍스트를 트리로 다시 디코딩하는 방법과 서버가 제출된 텍스트를 읽는 방법을 정한다. TypeScript 생성기와 그것을 쓰는 React, Vue, Svelte, HTML 렌더러, 그리고 Go, PHP, PHP extension, Rust, Python 생성기가 이를 렌더링하고, meta-schema가 그 규칙을 요구한다. form-render case `condition-*`, spec-validity case `ok-condition-field`, validate case `condition-field-values`가 이를 검사하며, form-render, spec-validity, validate unit이 새 requirement를 인용한다. red: 변경 전 모든 구현에서 `make parity-check UNITS="form-render spec-validity validate"`가 새 case에 실패했고, 변경 뒤 green.

### 2026-10-25 — C17.16은 php-ext engine test에서 공유 case 각각을 검사한다(C17.16)

- C17.16 완료(C17.16): packages/php-ext/tests/engine/engine.test.mjs의 공유 validation test는 손으로 적은 합계 318과 385 대신, engine program이 validate, spec-validity, list-validity, detail-validity cases.json의 case마다 결과 하나를 보고하는지 assert하고, program이 빠뜨린 case는 test를 실패시킨다. 이 row는 make test-php-ext CASES=engine이 닿지 않는 그 test를 실행한다. red: test가 341 !== 318로 실패했고, 변경 뒤 green.

### 2026-10-25 — catch 절이 처리하는 오류를 명시한다 (C17.13)

- 바인딩이 없던 catch 절 33곳이 오류를 바인딩하고, 결과를 뜻하는 오류(JSON 파싱은 SyntaxError, 잘못된 URL이나 form 본문은 TypeError, 없는 파일이나 명령은 ENOENT 또는 종료 코드 1, 조건은 ParseError, 결과가 그것인 경우 FORBIDDEN_META_KEY와 INVALID_FORM_INPUT)로 좁히고 나머지는 다시 던진다. lint-ts의 catch-check가 통과한다.

### 2026-10-25 — catch 절이 처리하는 오류를 명시한다 (C17.13)

- 바인딩이 없던 catch 절 33곳이 오류를 바인딩하고, 결과를 뜻하는 오류(JSON 파싱은 SyntaxError, 잘못된 URL이나 form 본문은 TypeError, 없는 파일이나 명령은 ENOENT 또는 종료 코드 1, 조건은 ParseError, 결과가 그것인 경우 FORBIDDEN_META_KEY와 INVALID_FORM_INPUT)로 좁히고 나머지는 다시 던진다. lint-ts의 catch-check가 통과한다.

### 2026-10-25 — conditionTree 규칙이 여섯 구현에서 중첩 조건을 검사한다 (C17.1)

- C17.1 완료 (C17.1): `docs/spec/schema.md`가 조건 트리(CUSC-072부터 CUSC-075)를 정의한다. 필드가 데이터로 담는 JSON 값이며, group `{all: [...]}`와 `{any: [...]}`, 연산자 eq, ne, lt, le, gt, ge, in, has를 쓰는 필드 비교 `{field, op, value}`, 판정 문장 `{judge}`로 이루어지고 최대 32단계 깊이다. `docs/spec/validation-rules.md`는 `conditionTree` 규칙(CUVR-066, CUVR-067)을 등록한다. 매개변수 `true`는 group과 필드 비교를, `judge`는 판정 문장도 허용하며, 매개변수 오류(CUVR-068)가 있고 규칙은 매개변수를 그대로 받는다. TypeScript, PHP, PHP extension, Go, Rust, Python validator와 meta-schema, specification type, CLI가 이 규칙을 갖는다. `tests/fixtures/validate/condition-tree.mts`가 case 17개를 `cases.json`에 쓰고, `config/parity.json`의 validate unit이 새 requirement를 인용한다. red: 규칙이 없는 모든 구현에서 `make parity-check UNITS="validate"`가 17개 case에 실패했고(358개 중 341개 통과), 변경 뒤 green.

### 2026-10-23 — C17.11-1은 worktree의 도구를 main checkout에서 읽는다(C17.11-1)

- C17.11-1 완료(C17.11-1): check-doc-coverage.test가 C17.11이 가져온 kit 패키지의 extends를 요구하고, gen-api-docs는 phpDocumentor를 main checkout의 도구에서 가져오며 cache를 checkout에 두고, UV, GO, COMPOSER는 $(KIT_TOOLS)를 이름 붙인다. red: check-doc-coverage.test가 실패했고, 변경 뒤 green.

### 2026-10-23 — C17.11은 kit을 sync하고 source를 lint로 보낸다(C17.11)

- C17.11 완료(C17.11): make kit-sync가 kit의 바뀐 사본을 가져오고 은퇴한 lint 설정을 지운다(kit K514). 각 api-extractor.json은 kit 패키지의 설정을 extends하고, owner 규칙은 각 언어를 그 lint와 duplication-check로 보내며(kit K534) 지워진 파일을 이름 붙이지 않고, 문장이 없던 catch 열한 개(kit K537)는 이제 실패를 좁히거나 보고하거나 관찰한다. red: make kit-check가 실패했고, 변경 뒤 green.

### 2026-10-22 — 사용자 규칙(버전 고정 작업 없음)에 따라 C16.173를 버린다 (C16.173)

- C16.173를 버린다 (C16.173): 사용자 2026-10-22: 버전 고정 작업 없음; 저장소 간 버전 정렬(S4)은 kit K448에서 제거된다.

### 2026-10-22 — 사용자 규칙(버전 고정 작업 없음)에 따라 C16.172를 버린다 (C16.172)

- C16.172를 버린다 (C16.172): 사용자 2026-10-22: 버전 고정 작업 없음; 저장소 간 버전 정렬(S4)은 kit K448에서 제거된다.

### 2026-10-22 — 사용자 규칙(버전 고정 작업 없음)에 따라 C16.169를 버린다 (C16.169)

- C16.169를 버린다 (C16.169): 사용자 2026-10-22: 버전 고정 작업 없음; 저장소 간 버전 정렬(S4)은 kit K448에서 제거된다.

### 2026-10-22 — 사용자 규칙(버전 고정 작업 없음)에 따라 C16.29를 버린다 (C16.29)

- C16.29를 버린다 (C16.29): 사용자 2026-10-22: 버전 고정 작업 없음; 저장소 간 버전 정렬(S4)은 kit K448에서 제거된다.

### 2026-10-22 — 사용자 규칙(버전 고정 작업 없음)에 따라 C16.13를 버린다 (C16.13)

- C16.13를 버린다 (C16.13): 사용자 2026-10-22: 버전 고정 작업 없음; 저장소 간 버전 정렬(S4)은 kit K448에서 제거된다.

### 2026-10-22 — 사용자 규칙(버전 고정 작업 없음)에 따라 C16.8를 버린다 (C16.8)

- C16.8를 버린다 (C16.8): 사용자 2026-10-22: 버전 고정 작업 없음; 저장소 간 버전 정렬(S4)은 kit K448에서 제거된다.

### 2026-10-22 — 링크 규칙에 따라 C16.171을 버린다 (C16.171)

- C16.171을 버린다 (C16.171): 사용자의 링크 규칙은 추적 composer.json과 Makefile을 그대로 둔다; vendor의 polyspec 패키지는 링크다.

### 2026-10-22 — 링크 규칙에 따라 C16.170을 버린다 (C16.170)

- C16.170을 버린다 (C16.170): 사용자의 링크 규칙은 추적 파일을 그대로 둔다; crudui main의 설치 폴더는 링크다.

### 2026-10-22 — 링크 규칙에 따라 C16.45를 버린다 (C16.45)

- C16.45를 버린다 (C16.45): 사용자의 링크 규칙은 추적 lock을 릴리스 기록으로 두므로, 이 행이 기다리던 추적 lock 재작성(K439-3-x)에는 남은 작업이 없다.

### 2026-10-21 — sprintf-js advisory 예외가 두 경로를 모두 적는다 (C16.169-1)

- `config/dependency-policy.json`의 sprintf-js advisory 예외(npm advisory 1241202, GHSA-hp3w-g68c-fv3c, medium)가 sprintf-js 1.0.3을 들여오는 두 경로를 모두 적는다 (C16.169-1): `scripts/gen-api-docs.mts`가 고정 인자로 실행하는 직접 개발 의존성 `@microsoft/api-documenter` 7.30.18과 `@polyspec/kit`의 `@microsoft/api-extractor` 7.59.4이며, 둘 다 `@rushstack/ts-command-line` 5.3.17과 argparse 1.0.10을 거친다; 사유는 kit 경로만 있다고 적었다. advisory를 고친 sprintf-js가 없으므로(취약 범위 <= 1.1.3, 최신) 그 제거(C16.169)는 공동 의존성 일괄 갱신에 들어간다. Red: 옛 문장의 `make text-absent`가 e9d3accc에서 exit 2; green: exit 0.

### 2026-10-21 — form comparison의 unit pool은 unit을 node:test test로 실행한다 (C16.28-1)

- `check.mjs`의 browser phase와 `check-pipeline.mjs`의 store reset 및 40개 조합의 각 unit은 `src/unit-pool.mjs`의 `unitTest`가 등록하는 node:test test이며, 각자 제한 시간(`browserUnitLimitsMs`, `pipelineUnitLimitMs`)을 가진다. 결과(`passed`, `failed`, `timed-out`)와 소요 시간을 보고서에 기록하며, `runUnit`과 `runUnits`는 제거했다 (C16.28-1). 두 file은 `local-verification.mjs`가 `node --test`로 실행하는 node:test file이고, origin, server, 보고서 file을 환경 변수로 받는다. `pipelineReport`는 `src/pipeline-flow.mjs`로 옮겨, pipeline을 import해도 test가 등록되지 않게 했다. `src/unit-pool.mjs`에는 node:test에 대응이 없는 `runOperation`(브라우저 시작과 종료는 시작, heartbeat, 결과 줄을 유지한다)과 `measuredLimitMs`만 남겼다. unit별 시작 줄과 heartbeat 줄은 node:test가 각 test의 결과를 끝날 때 출력하므로 없앴고, `config/rebuild.json`은 `unit-pool.mjs`를 policy로 분류한다. Red: `make text-absent FILE=examples/form-comparison/check.mjs TEXT="runUnit("`가 exit 2로 실패하고, owner test(`unit-pool.test.mjs`, `check-verification.test.mjs`)가 HEAD source에서 7개 실패로 exit 1; green: Verification의 여섯 명령이 exit 0이며 node:test test 11개가 통과한다. browser check는 로컬에서 실행하지 않았고, `node --check`와 `make lint-ts`는 통과한다.

### 2026-10-21 — go outline case를 이름으로 보고한다 (C16.165-3)

- `packages/generator/go/outline_test.go`의 `TestOutlineFixture`가 `tests/fixtures/form-outline/cases.json`의 각 case를 같은 단언으로 subtest `TestOutlineFixture/<case>`로 실행한다 (C16.165-3); C16.165가 subtest 없는 반복으로 남겨 `make parity-check UNITS=form-outline`이 다섯 case 중 하나도 읽지 못했다. Red: 그 검사가 14a3b7b2에서 `R3 not-executed form-outline go`(5개 중 0)를 보고; green: 5개 중 5개 통과, go R3 줄 없음.

### 2026-10-21 — form comparison은 step을 kit의 runCommand로 실행한다 (C16.28)

- examples/form-comparison/src/step-runner.mjs의 `runStep`은 각 step을 `@polyspec/kit/run-command`의 `runCommand`로 실행하고, 출력을 pipe로 받아 step id를 붙여 한 줄씩 출력한다(`onLine`). process group spawn, 출력 prefix, kit의 runCommand가 대신하는 `stopStepsOnSignal`은 제거되었고 local-verification.mjs는 더 이상 이를 호출하지 않는다. `killProcessTree`와 heartbeat는 남는다 (C16.28). Red: step-runner.mjs의 `spawn(step.command` 존재를 `make text-absent`가 exit 2로 보고하고, `@polyspec/kit/run-command`의 `grep`은 exit 1; green: step-runner.test.mjs 9 passed, `make rebuild-check` exit 0.

### 2026-10-21 — text unit와 expr fixture의 go 바인딩이 케이스를 이름으로 보고한다 (C16.165)

- text-compile-form, text-bind-form, text-create-form, text-build-list, text-build-detail, text-validity-validate, text-validity-validate-list, text-validity-validate-detail unit의 go 바인딩은 각자의 테스트 함수로 실행되고, expr fixture는 항목마다 하위 테스트 하나로 보고하여, `make parity-check`가 go에서 이 unit들의 모든 케이스를 실행된 것으로 보고한다 (C16.165-1, C16.165-2). Red: 094317cc에서 `make parity-check UNITS="text-compile-form text-bind-form text-create-form text-build-list text-build-detail text-validity-validate text-validity-validate-list text-validity-validate-detail expr"`의 go 줄이 케이스를 실행되지 않음 또는 suite에 없음으로 보고; green: 각 go 바인딩이 모든 케이스를 통과하고 go R3 줄이 없다 (C16.165).

### 2026-10-21 — go validator의 text와 expr unit이 케이스를 이름으로 보고한다 (C16.165-2)

- packages/validator/go/validator/validate/text_conformance_test.go: TestInputTextMatchesFixture는 세 fixture를 하위 테스트로 계속 실행하고, 새 함수 TestInputTextValidate, TestInputTextValidateList, TestInputTextValidateDetail은 fixture 하나씩을 runTextFixture로 실행한다. 하위 테스트는 케이스의 기본 이름이다. packages/validator/go/validator/expr/conformance_test.go: 각 식 항목은 중첩 하위 테스트 대신 자기 테스트 본문에서 단계(tokens, ast, evaluation)를 차례로 확인하고, 실패한 단계는 t.Errorf로 보고한 뒤 반환하여 뒤 단계가 그대로 실행된다. config/parity.json은 text-validity-validate, text-validity-validate-list, text-validity-validate-detail unit을 각자의 함수에 묶는다 (C16.165-2). Red: `make parity-check UNITS="text-validity-validate text-validity-validate-list text-validity-validate-detail expr"` 094317cc에서 exit 2, go 줄 `R3 not-executed text-validity-validate go ...: not executed: pass-paired-surrogates, ...`와 `R3 not-executed expr go ...: not in the suite: path-sibling-truthy/tokens, ...`; green: go 줄 모두 `exit 0`, 케이스 21, 6, 5, 74개 모두 통과, go R3 줄 없음.

### 2026-10-21 — go input text unit가 케이스를 이름으로 보고한다 (C16.165-1)

- packages/generator/go/input_text_test.go: TestInputTextCases는 다섯 fixture를 하위 테스트로 계속 실행하고, 새 함수 TestInputTextCompileForm, TestInputTextBindForm, TestInputTextCreateForm, TestInputTextBuildList, TestInputTextBuildDetail은 fixture 하나씩을 runTextCases로 실행한다. runTextCases의 하위 테스트는 케이스의 기본 이름이다. config/parity.json은 text-compile-form, text-bind-form, text-create-form, text-build-list, text-build-detail unit을 각자의 함수에 묶는다 (C16.165-1). Red: `make parity-check UNITS="text-compile-form text-bind-form text-create-form text-build-list text-build-detail"` exit 2, go 줄 `R3 not-executed <unit> go packages/generator/go/input_text_test.go: not executed: pass-paired-surrogates, ...; not in the suite: compileForm/pass-paired-surrogates, ...`; green: go 줄 모두 `exit 0`, 케이스 7, 17, 15, 11, 6개 모두 통과, go R3 줄 없음 (같은 unit의 ts와 rust 줄로 exit 2가 남는다).

### 2026-10-21 — case 보고 파일의 python 테스트 파일이 포맷된다 (C16.157-8)

- case 보고 행에서 바뀐 python 테스트 파일이 ruff format이 쓰는 형식으로 맞춰졌다 (C16.157-8): `packages/generator/python/tests/test_outline.py`(outline 행의 `assertEqual`)와 `packages/validator/python/tests/test_text_validity.py`(validateDetail 픽스처 개수)이며, 검사 내용은 바뀌지 않았다. Red: `make lint-python`이 exit 1로 끝나며 `ruff format --check .`이 두 파일을 `would be reformatted`로 보고한다(2 files would be reformatted); green: `make lint-python`이 exit 0이고 모든 단계가 통과한다.

### 2026-10-21 — 생성기의 python template-shape 바인딩이 케이스를 이름으로 보고한다 (C16.157-7)

- template-shape 단위의 python 바인딩이 각 케이스를 그 이름으로 보고한다 (C16.157-7): `packages/generator/python/tests/test_template_shape.py`가 단위에 케이스당 테스트 메서드 하나를 가진 테스트 클래스를 두며, 각 메서드는 템플릿에 연산을 실행한다(createRecords 케이스는 직렬화된 템플릿에서 각 레코드를 바인딩한다, 이전과 같다). 픽스처 개수는 `TestTemplateShapeFixtureCount`에 둔다. `config/parity.json`은 바인딩을 `var/python/bin/python`과 그 클래스로 실행한다. Red: `make -s parity-check UNITS="template-shape"`가 template-shape에 python R3 `not executed` 줄을 보고한다 (0 of 44 cases passed); green: 같은 검사가 `template-shape python` 44 of 44 cases passed를 보고하고 python R3 줄이 없다.

### 2026-10-21 — 생성기의 python text-validity 바인딩이 케이스를 이름으로 보고한다 (C16.157-6)

- text-compile-form, text-bind-form, text-create-form, text-build-list, text-build-detail 단위의 python 바인딩이 각 케이스를 그 이름으로 보고한다 (C16.157-6): `packages/generator/python/tests/test_text_validity.py`가 단위마다 케이스당 테스트 메서드 하나를 가진 테스트 클래스를 두며, 같은 결과와 오류 클래스 검사를 실행한다(createForm은 기록된 action을 인스턴스에 실행한다, 이전과 같다). 픽스처 개수는 `TestGeneratorTextValidityFixtureCounts`에 둔다. `config/parity.json`은 각 바인딩을 `var/python/bin/python`과 그 클래스로 실행한다. Red: `make -s parity-check UNITS="text-compile-form text-bind-form text-create-form text-build-list text-build-detail"`가 다섯 단위에 python R3 `not executed` 줄을 보고한다 (예: `R3 not-executed text-bind-form python`, 0 of 17 cases passed); green: 같은 검사가 모든 케이스를 통과로 보고한다 (7 of 7, 17 of 17, 15 of 15, 11 of 11, 6 of 6)과 python R3 줄이 없다.

### 2026-10-21 — 생성기의 python 렌더 바인딩이 케이스를 이름으로 보고한다 (C16.157-5)

- form-complete, list-render, detail-render 단위의 python 바인딩이 각 케이스를 그 이름으로 보고한다 (C16.157-5): `packages/generator/python/tests/test_render.py`가 단위마다 케이스당 테스트 메서드 하나를 가진 테스트 클래스를 둔다. list와 detail 케이스는 `assert_render`를, form-complete 케이스는 바이트 비교를 실행한다(이전과 같다). 픽스처 개수는 `TestRenderFixtureCounts`에 둔다. `config/parity.json`은 각 바인딩을 `var/python/bin/python`과 그 클래스로 실행한다. Red: `make -s parity-check UNITS="form-complete list-render detail-render"`가 세 단위에 python R3 `not executed` 줄을 보고한다 (예: `R3 not-executed list-render python`, 0 of 165 cases passed); green: 같은 검사가 모든 케이스를 통과로 보고한다 (form-complete 28 of 28, list-render 165 of 165, detail-render 68 of 68)과 python R3 줄이 없다.

### 2026-10-21 — 생성기의 python outline 바인딩이 케이스를 이름으로 보고한다 (C16.157-4)

- form-outline 단위의 python 바인딩이 각 케이스를 그 이름으로 보고한다 (C16.157-4): `packages/generator/python/tests/test_outline.py`가 단위에 케이스당 테스트 메서드 하나를 가진 테스트 클래스를 두며, 각 메서드는 compile, bind, outline 생성을 실행하고 행을 기록된 행과 비교한다(이전과 같다). 픽스처 개수는 `TestOutlineFixtureCount`에 둔다. `config/parity.json`은 바인딩을 `var/python/bin/python`과 그 클래스로 실행한다. Red: `make -s parity-check UNITS="form-outline"`가 form-outline에 python R3 `not executed` 줄을 보고한다 (0 of 5 cases passed); green: 같은 검사가 `form-outline python` 5 of 5 cases passed를 보고하고 python R3 줄이 없다.

### 2026-10-21 — 검증기의 python compose 바인딩이 케이스를 이름으로 보고한다 (C16.157-3)

- compose 단위의 python 바인딩이 각 케이스를 그 이름으로 보고한다 (C16.157-3): `packages/validator/python/tests/test_compose.py`가 단위에 케이스당 테스트 메서드 하나를 가진 테스트 클래스를 두며, 각 메서드는 명세를 합성하여 정렬된 멤버 이름으로 합성된 map을 비교하거나(결과 케이스) 기록된 `ComposeLoadError` code를 검사한다(오류 케이스), 이전과 같다. 선언 검사와 픽스처 개수는 `TestComposeFixtureCounts`에 둔다. `config/parity.json`은 바인딩을 `var/python/bin/python`과 그 클래스로 실행한다. Red: `make -s parity-check UNITS="compose"`가 compose에 python R3 `not executed` 줄을 보고한다 (0 of 20 cases); green: 같은 검사가 `compose python` 20 of 20 cases passed를 보고하고 python R3 줄이 없다.

### 2026-10-21 — 검증기의 python 구조 검증 바인딩이 케이스를 이름으로 보고한다 (C16.157-2)

- C16.157-2를 닫는다: Verification이 그 커밋의 트리에서 통과하며, 그 커밋은 행을 `[~]`로 남겼다 (C16.157-2).
- list-validity, detail-validity, spec-validity 단위의 python 바인딩이 각 케이스를 그 이름으로 보고한다 (C16.157-2): `packages/validator/python/tests/test_structure_validity.py`가 단위마다 케이스당 테스트 메서드 하나를 가진 테스트 클래스를 두고, 각 메서드는 `assert_load`를 실행한다 (깨끗한 명세는 깨끗한 결과를, 실패하는 명세는 기록된 code와 trace의 오류를 낸다, 이전과 같다). 선언 검사와 픽스처 개수는 `TestStructureValidityFixtureCounts`에 둔다. `config/parity.json`은 각 바인딩을 `var/python/bin/python`과 그 클래스로 실행한다. Red: `make -s parity-check UNITS="list-validity detail-validity spec-validity"`가 세 단위에 python R3 `not executed` 줄을 보고한다 (예: `R3 not-executed spec-validity python`, 0 of 34 cases); green: 같은 검사가 모든 케이스를 통과로 보고한다 (list-validity 20 of 20, detail-validity 13 of 13, spec-validity 34 of 34)과 python R3 줄이 없다.

### 2026-10-21 — 검증기의 python text-validity 바인딩이 케이스를 이름으로 보고한다 (C16.157-1)

- text-validity-validate, text-validity-validate-list, text-validity-validate-detail, text-validity-value-graphs 단위의 python 바인딩이 각 케이스를 그 이름으로 보고한다 (C16.157-1): `packages/validator/python/tests/conformance.py`의 `add_case_tests`가 픽스처 파일 이름을 받고, `packages/validator/python/tests/test_text_validity.py`가 단위마다 케이스당 테스트 메서드 하나를 가진 테스트 클래스를 두어 같은 검증을 실행하며, 픽스처 개수는 `TestTextValidityFixtureCounts`에 둔다. `config/parity.json`은 각 바인딩을 `var/python/bin/python`과 그 클래스로 실행한다. Red: `make -s parity-check UNITS="text-validity-validate text-validity-validate-list text-validity-validate-detail text-validity-value-graphs"`가 네 단위에 python R3 `not executed` 줄을 보고한다 (예: `R3 not-executed text-validity-validate python`, 0 of 21 cases); green: 같은 검사가 네 단위의 모든 케이스를 통과로 보고하고 (21 of 21, 6 of 6, 5 of 5, 12 of 12) python R3 줄이 없다.

### 2026-10-21 — validity fixture가 모든 generator에 묶인다 (C16.167)

- config/parity.json은 tests/fixtures/list-validity 위의 list-render-validity와 tests/fixtures/detail-validity 위의 detail-render-validity를 각각 여섯 binding으로 선언한다(C16.167). TypeScript는 display-validity.test.ts와 detail-display-validity.test.ts(validity-outcome.ts 위), Go는 validity_render_test.go, Python은 test_render_validity.py와 test_detail_render_validity.py(conformance.check_validity), Rust는 validity_render.rs, PHP와 native extension은 ListRenderValidityTest.php와 DetailRenderValidityTest.php(ValidityOutcome.php)다. 각 case는 기록된 engine 실패로 거부되거나 INVALID_FORM_INPUT(CUDF-036~062, docs/spec/display-formats.md)으로 거부되거나 build된다. Red: `sh -c 'make -s parity-check UNITS="list-render-validity detail-render-validity" > var/pc-C16.167.log 2>&1'` exit 2(binding이 없다). Green: 같은 명령 exit 0, 198 case 통과. 모든 generator가 이미 이 case들을 거부하므로 구현은 바뀌지 않았다.

### 2026-10-21 — 검증 fixture를 생성기가 쓴다 (C16.166)

- `tests/fixtures/validate/generate.mts`가 `cases.json`에 손으로 적혀 있던 CUSC-038 expression 두 case(`expression-scalar-equals-array-is-false`, `expression-zero-equals-empty-array-is-false`; `EXPRESSION_CASES`)를 쓴다. 기대값은 reference validator에서 나오며 손으로 쓴 값(valid, 오류 없음)과 같다. 두 case의 citation에 이제 생성된 모든 case와 같이 CURP-018과 CURP-022가 들어가므로 `tests/fixtures/validate/cases.json`은 그 두 citation 목록만 바뀐다(C16.166). Red: `sh -c 'var/tools/bin/node tests/fixtures/validate/generate.mts > var/validate-cases.json && cmp -s var/validate-cases.json tests/fixtures/validate/cases.json'` exit 1(두 case가 출력에 없다); green: 같은 명령이 exit 0.

### 2026-10-21 — parity 선언이 발견 없이 성립한다 (C16.3)

- config/parity.json의 모든 unit이 모든 구현에서 성립하고 그 테스트가 명명하는 명세 요구사항을 인용한다: profile, native 전용 symbol, 제외가 남지 않았고, 링크된 kit 0.0.54로 `make parity-declarations-check`가 발견을 보고하지 않는다 (C16.3).

### 2026-10-21 — parity 선언이 발견 없이 성립한다 (C16.46-1)

- config/parity.json이 TypeScript 전용 패키지와 도구 테스트를 구현 root 밖에 두고, 확장의 C 엔진 테스트가 자리를 가진다(엔진 테스트는 internal, 계약 테스트는 node runner로 binding, K422): `make parity-declarations-check`가 발견을 보고하지 않는다 (C16.46-1).

### 2026-10-21 — parity 선언이 발견 없이 성립한다 (C16.46)

- config/parity.json이 crudui의 구현, 도구 root, 비교기를 `make parity-declarations-check`의 발견 없이 선언한다: 기다리던 unit, 요구사항 id, 테스트 이동이 끝났다 (C16.46).

### 2026-10-21 — parity 선언이 발견 없이 성립한다 (C16.57)

- docs/spec의 모든 요구사항 id를 그것을 명명하는 테스트의 unit이 인용한다: C16.146..C16.158 뒤 main에서 `make parity-declarations-check`가 발견을 보고하지 않으므로(R4, R13, R14, R15 줄 없음) 행이 끝났다. Red: 1788f7ca에서 exit 2(Unicode 테스트의 R5 다섯 줄); green: exit 0 (C16.57).

### 2026-10-21 — PRINCIPLES 사본이 kit K431을 따른다 (C16.164)

- `make kit-sync`가 링크된 kit에서 `PRINCIPLES.md`와 `PRINCIPLES.ko.md`를 다시 쓴다 (C16.164): kit K431은 변경으로 낡게 된 주석이나 문서를 그 커밋에서 고치고, 나중에 발견된 것은 Verification이 `make text-absent FILE=<path> TEXT=<stale text>`인 하위 항목으로 둔다는 규칙을 더했다. Red: `make kit-check`가 aaa19888에서 exit 2(두 사본이 다름); green: exit 0.

### 2026-10-21 — config/rebuild.json이 form comparison의 공유 adapter 진입점을 분류한다 (C16.163)

- `config/rebuild.json`이 C16.58-27이 추가한 `examples/form-comparison/src/adapters/view-entries.ts`를 form comparison 예제의 policy 모듈로 선언한다 (C16.163); 분류가 없어 main에서 `make rebuild-check`가 실패했다. Red: `make rebuild-check`가 ffb7d22a에서 exit 2("the tool has no class in config/rebuild.json"); green: exit 0.

### 2026-10-21 — 설치 검사가 링크된 checkout의 kit를 받아들인다 (C16.162)

- `tests/build/runtime-version-policy.test.mts`("make installs nothing on its own and make install installs the Rust toolchain")가 `make install`의 install-tools 단계를 `node_modules/@polyspec/kit/dist` 또는 `../kit/dist` 아래에서 찾는다 (C16.162): kit가 형제 checkout에 링크된(make link) checkout에서는 KIT가 `../kit/dist`이므로, make install이 kit의 install-tools를 실행했는데도 링크된 모든 checkout에서 테스트가 실패했다. Red: 테스트 파일이 53d11cac에서 exit 1; green: exit 0.

### 2026-10-21 — CI 도구 규칙이 setup-php의 phpize와 php-config를 허용한다 (C16.161)

- `tests/build/runtime-version-policy.test.mts`("every CI job sets up the recorded toolchains and checks the tools it set up")가 `tools: none` 외에 setup-php 입력 `tools: phpize, php-config`를 받아들인다 (C16.161). C16.9는 확장을 phpize로 빌드하며 그것을 빌드하는 CI job 다섯에 setup-php가 설치하는 PHP의 빌드 도구 `tools: phpize, php-config`를 주었지만, setup-php가 도구를 설치하지 않는다는 규칙은 그대로 두어 main에서 테스트가 실패했다. setup-php는 여전히 Composer를 설치하지 않는다: make install-tools가 mise.toml의 Composer를 설치한다. Red: 그 테스트가 77c77235에서 다섯 job을 명명하며 exit 1; green: exit 0.

### 2026-10-21 — make crudui-test-php-engine이 PHP 확장의 계약 테스트를 실행한다 (C16.160)

- Makefile의 `crudui-test-php-engine`이 엔진·비교 테스트와 함께 `packages/php-ext/tests/contract/*.test.mjs`를 실행한다 (C16.160). C16.57-3-1과 C16.57-3-2가 unit `compose`와 `expr`의 php-extension binding으로 그곳에 `compose.test.mjs`와 `expr.test.mjs`를 추가했지만 어떤 프로젝트 명령도 이를 실행하지 않아 `tests/build/test-commands.test.mts`("every node:test file runs in a project command")가 거부했다. Red: 그 테스트가 d68d71c6에서 두 파일을 명명하며 exit 1; green: exit 0.

### 2026-10-21 — text-validity 단위의 PHP 바인딩이 모든 사례를 보고한다 (C16.159)

- text-validity 단위 여덟 개의 PHP 테스트를 단위별로 나눈다 (C16.159): `packages/validator/php/tests/Validate/TextValidityConformanceTest.php`는 `testValidateInputTextMatchesFixture`, `testValidateListInputTextMatchesFixture`, `testValidateDetailInputTextMatchesFixture`를 실행하고, `packages/generator/php/tests/InputTextTest.php`는 `testCompileFormCase`, `testBindFormCase`, `testCreateFormCase`, `testBuildListCase`, `testBuildDetailCase`를 실행하며, 데이터 제공자는 각 데이터 세트를 사례 이름으로 키 짓는다. `config/parity.json`에서 단위들의 php와 php-extension 바인딩 열여섯 개가 이 메서드를 명명한다. 데이터 세트 88개(21, 6, 5, 7, 17, 15, 11, 6 사례)와 그 단언은 바뀌지 않는다. Red: Verification이 d68d71c6에서 실패하며, 단위의 모든 php와 php-extension 바인딩이 R3 줄과 함께 `0 of N cases passed`를 보고한다; green: exit 0, 모든 php와 php-extension 바인딩이 `N of N cases passed`를 보고한다.

### 2026-10-21 — python 바인딩이 각 단위의 케이스를 이름으로 보고한다 (C16.157)

- buttons, validate, form-render, form-view, form-history, form-actions, view-functions, expr 단위의 python 바인딩이 각 케이스를 이름으로 보고한다 (C16.157): `packages/generator/python/tests/conformance.py`와 `packages/validator/python/tests/conformance.py`의 `add_case_tests`가 클래스마다 케이스당 테스트 메서드 `test_<case>` 하나를 만들고, `test_buttons.py`, `test_form_render.py`, `test_form_state.py`, `test_expr.py`, `test_validate.py`가 케이스마다 같은 검증을 실행하며 픽스처 개수는 별도 테스트 클래스에 둔다. `config/parity.json`은 python 구현을 `var/python/bin/python`(패키지의 venv)으로 실행하고 각 바인딩의 테스트 클래스를 지정한다 (C16.157). Red: d68d71c6에서 `make -s parity-check UNITS="buttons validate form-render form-view expr form-history form-actions view-functions"`가 exit 1로 끝나며 각 단위의 python R3 `not executed` 줄이 남는다 (예: `R3 not-executed validate python ... exited with 1`); green: exit 0, 모든 python 단위가 자기 케이스를 전부 통과로 보고하고 (validate 341 of 341, form-render 201 of 201, buttons 22 of 22, expr 74 of 74, form-view 3 of 3, form-history 5 of 5, form-actions 20 of 20, view-functions 11 of 11) `R3 not-executed <단위> python` 줄이 없다.

### 2026-10-21 — 확장이 내장한 목록 메시지가 검사된다 (C16.100-2)

- 기능 unit `interface-messages`(CUMK-065)의 php-extension 바인딩은 node 계약 테스트 `packages/php-ext/tests/contract/interface-messages.test.mjs`가 된다. 이 테스트는 `interface_messages.c`를 컴파일해 모든 언어의 폼 메시지와 목록 메시지를 `contracts/interface-messages.json`과 비교하며, `packages/php-ext/tools/generate-interface-messages.mjs`의 `TABLES`와 `fieldName`을 (이제 export되어) 읽는다. 공개 PHP accessor는 추가하지 않는다 (C16.100-2). PHP 라이브러리 바인딩은 `InterfaceMessagesConformanceTest.php`를 유지한다. Red: `InterfaceMessagesConformanceTest.php`가 통과했고(OK, 5 tests) `Form::getMessages()`만 읽으므로 목록 메시지를 검사한 테스트가 없었다; green: 새 계약 테스트 exit 0 (var/c16100-node.log)과 `make -s parity-declarations-check` exit 0 (var/pd-C16.100-2.log).

### 2026-10-21 — 여섯 구현의 유니코드 데이터가 계약에 맞게 검사된다 (C16.113)

- 기능 unit `unicode-data`(CUVR-018)가 ts(`packages/validator/ts/src/unicode/properties.unit.test.ts`), php(`UnicodeDataTest::testEmbeddedDataEqualsTheContract`), go(`TestUnicodeDataMatchesContract`), rust(`embedded_data_matches_the_contract`), python(`test_unicode_data.py`)과 php-extension의 유니코드 테스트를 묶는다. php-extension의 새 node 계약 테스트 `packages/php-ext/tests/contract/unicode-data.test.mjs`는 `unicode_data.c`의 C 표와 `whitespace.c`의 White_Space 검사를 컴파일해 `contracts/unicode-properties.json`과 비교하며, 이 검사는 `packages/php-ext/tests/engine/engine.test.mjs`에서 옮겨 왔다 (C16.113). 값 unit `packages/validator/ts/src/values/values.unit.test.ts`는 내부 테스트로 선언된다. Red: `make -s parity-declarations-check`가 exit 2이며 `R5 undeclared-test` 줄 다섯 개; green: 지적 없이 exit 0이고 node 계약 테스트는 exit 0.

### 2026-10-21 — scripts의 명령은 kit의 runner로 실행한다 (C16.10)

- `scripts/run-command.mts`를 제거한다. 사용처는 `@polyspec/kit/run-command`를 import한다(`scripts/repeat-build.mts`, `scripts/run-contract-tests.mts`, `scripts/gen-api-docs.mts`, `scripts/install-browsers.mts`, `scripts/require-current-build.mts`, `benchmarks/validators/build-drivers.mjs`, `benchmarks/validators/run.js`, `tests/native-generators/run.mts`). 그 테스트 `tests/build/run-command.test.mts`는 `npm run test:build`에서 빠지며, runner와 그 테스트는 kit이 소유한다. `config/rebuild.json`은 `replaced` 항목을 버리고, `config/owner-checks.json`, `tests/build/rust-node-entry-points.test.mts`, `scripts/gen-api-docs.test.mts`는 제거된 파일을 뺀다. 출력 한도 실패는 kit의 메시지 `wrote more than its output limit; stopped its process group`를 쓰며, 더 이상 byte 수를 출력하지 않는다. 호출하는 스크립트 중 byte 수를 출력한 곳은 없었다. Red: HEAD에서 `sh -c 'test ! -e scripts/run-command.mts && ! git grep -qE "run-command\.mts" -- scripts benchmarks tests config package.json && make rebuild-check'` exit 1(파일이 남아 있다); green: 같은 명령 exit 0; `scripts/gen-api-docs.test.mts` 8 passed, `tests/build/rust-node-entry-points.test.mts` 7 passed, `tests/build/offline-checks.test.mts` 2 passed, `tests/build/install-browsers.test.mts` 3 passed.

### 2026-10-21 — 공유 text-validity 도우미(tests/fixtures/text-validity/cases.mts, input-text.mts)가 패키지 모듈을 .ts 경로로 import하도록 하고(nodenext 루트 tsconfig가 요구한다), 쓰이지 않는 export를 뺐다. internal 테스트 text-validity.conformance.test.ts는 더 이상 CUIT-041을 명명하지 않는다(parity-declarations-check의 R16). Red: `make -s parity-declarations-check` exit 2, `R16 internal-contract ts packages/validator/ts/src/text/text-validity.conformance.test.ts`; green: 그 finding이 사라졌고 `make lint-ts`는 exit 0. (C16.158-7)

- undefined

### 2026-10-21 — template-shape 단위의 ts 바인딩이 각 사례를 이름으로 보고한다 (C16.158-6): template-shape.test.ts의 사례 반복문이 단위 자체 테스트의 describe 밖으로 나가, 각 사례가 그 이름의 최상위 테스트다. Red: `make -s parity-check UNITS="template-shape"` exit 1, `R3 not-executed template-shape ts`와 사례 이름(bindForm-compiled 등); green: exit 0, 44 of 44 사례 통과. (C16.158-6)

- undefined

### 2026-10-21 — form-outline, form-complete, list-render, detail-render 단위의 ts 바인딩이 각 사례를 이름으로 보고한다 (C16.158-5): outline.conformance.test.ts, list-conformance.test.ts, detail-conformance.test.ts의 사례 묶음이 사례 이름의 최상위 테스트이며, form-complete.conformance.test.ts는 사례의 renderFormView 검증을 그 사례의 테스트 안에서 실행하여 사례 이름이 겹치지 않는다. Red: `make -s parity-check UNITS="form-outline form-complete list-render detail-render"` exit 1, `R3 not-executed <unit> ts`와 사례 이름; green: exit 0, form-outline 5 of 5, form-complete 28 of 28, list-render 165 of 165, detail-render 68 of 68 사례 통과. (C16.158-5)

- undefined

### 2026-10-21 — list-validity, detail-validity, spec-validity 단위의 ts 바인딩이 각 사례를 이름으로 보고한다 (C16.158-4): validate-list.conformance.test.ts, validate-detail.conformance.test.ts, forbidden-scan.conformance.test.ts의 사례 묶음이 사례 이름의 최상위 테스트이며 describe 감싸기가 없어졌고, 각 파일의 메타 검사는 중첩으로 남는다. Red: `make -s parity-check UNITS="list-validity detail-validity spec-validity"` exit 1, `R3 not-executed <unit> ts`와 사례 이름; green: exit 0, list-validity 20 of 20, detail-validity 13 of 13, spec-validity 34 of 34 사례 통과. (C16.158-4)

- undefined

### 2026-10-21 — input text 단위들이 각자 ts 테스트 파일을 가진다 (C16.158-3)

- text-compile-form, text-bind-form, text-create-form, text-build-list, text-build-detail의 ts 바인딩이 각자 테스트 파일을 가진다 (C16.158-3): `packages/generator/ts/src/text-compile-form.test.ts`, `text-bind-form.test.ts`, `text-create-form.test.ts`, `text-build-list.test.ts`, `text-build-detail.test.ts`. 공유 사례 코드는 `tests/fixtures/text-validity/input-text.mts`이며, `packages/generator/ts/src/input-text.test.ts`는 form 버튼과 loader 문서의 단위 테스트를 담고 `config/parity.json`에서 internal로 선언된다. 이 sub-row는 C16.158-2가 실수로 커밋한 도우미 사본 `packages/validator/ts/src/text/text-validity-cases.ts`(validator typecheck를 깨뜨렸다)를 삭제한다. Red: `make -s parity-check UNITS="text-compile-form text-bind-form text-create-form text-build-list text-build-detail"` exit 1, 각 단위의 `R3 not-executed <unit> ts`와 사례 이름; green: exit 0, compile-form 7 of 7, bind-form 17 of 17, create-form 15 of 15, build-list 11 of 11, build-detail 6 of 6 사례 통과.

### 2026-10-21 — text-validity 단위들이 각자 ts 테스트 파일을 가진다 (C16.158-2)

- text-validity-validate, text-validity-validate-list, text-validity-validate-detail, text-validity-value-graphs의 ts 바인딩이 각자 테스트 파일을 가진다 (C16.158-2): `packages/validator/ts/src/text/text-validity-validate.conformance.test.ts`, `text-validity-validate-list.conformance.test.ts`, `text-validity-validate-detail.conformance.test.ts`, `text-validity-value-graphs.conformance.test.ts`. 공유 사례 코드는 `tests/fixtures/text-validity/cases.mts`이며, `text-validity.conformance.test.ts`는 text 도우미의 단위 테스트를 담고 `config/parity.json`에서 internal로 선언된다. Red: `make -s parity-check UNITS="text-validity-validate text-validity-validate-list text-validity-validate-detail text-validity-value-graphs"` exit 1, 각 단위의 `R3 not-executed <unit> ts`와 사례 이름; green: exit 0, validate 21 of 21, validate-list 6 of 6, validate-detail 5 of 5, value-graphs 12 of 12 사례 통과.

### 2026-10-21 — form-state 단위들이 각자 ts 테스트 파일을 가진다 (C16.158-1)

- form-view, form-history, form-actions, view-functions의 ts 바인딩이 각자 테스트 파일을 가진다 (C16.158-1): `packages/generator/ts/src/form-history.test.ts`, `packages/generator/ts/src/form-actions.test.ts`, `packages/generator/ts/src/view-functions.test.ts`가 새로 생겼고, `packages/generator/ts/src/form-state.test.ts`는 form-view 사례만 담으며, `tests/fixtures/form-state/units.mts`가 각 family의 사례를 그 이름의 최상위 테스트로 등록한다. `config/parity.json`의 세 새 바인딩이 각자의 파일을 가리킨다. Red: `make -s parity-check UNITS="form-view form-history form-actions view-functions"` exit 1, form-history, form-actions, view-functions 각각의 `R3 not-executed <unit> ts`와 사례 이름; green: exit 0, form-view 3 of 3, form-history 5 of 5, form-actions 20 of 20, view-functions 11 of 11 사례 통과.

### 2026-10-21 — 다섯 unit의 ts 바인딩이 각 사례를 이름으로 보고한다 (C16.158)

- unit `buttons`, `validate`, `form-render`, `form-view`, `expr`의 TypeScript 바인딩이 각 사례를 그 이름의 최상위 vitest 테스트로 보고한다 (C16.158): `packages/generator/ts/src/buttons.conformance.test.ts`, `packages/validator/ts/src/validate.conformance.test.ts`, `packages/html/src/conformance.test.ts`, `packages/generator/ts/src/form-state.test.ts`(form-view 사례만; form-history, form-actions, view-functions는 describe 아래에 남는다), `packages/validator/ts/src/expr.conformance.test.ts`가 describe 감싸기를 없앴고, form-render는 한 사례의 view와 framework 검증을 한 테스트에서 실행한다. Red: `make -s parity-check UNITS="buttons validate form-render form-view expr"` exit 1; buttons, validate, form-render, form-view, expr 각각의 `R3 not-executed <unit> ts` (`not executed: default-submit-only, ...`, `not executed: enddate-relative-path-2026-01-01, ...`, `not executed: text-with-nul, ...`, `not executed: toggle-row-collapses-and-expands, ...`, `not executed: path-sibling-truthy, ...`). Green: 같은 명령 exit 0, 다섯 unit의 ts 바인딩 모두 `N of N cases passed` (buttons 22, validate 341, form-render 201, form-view 3, expr 74), `grep "R3 not-executed [^ ]+ ts "`는 아무것도 찾지 않는다.

### 2026-10-21 — 열여덟 unit의 Rust 바인딩이 각 사례를 이름으로 보고한다 (C16.156-1)

- C16.156-1이 닫힌다: 열여덟 unit(text-validity-validate, -list, -detail, value-graphs, list-validity, detail-validity, spec-validity, compose, form-complete, list-render, detail-render, form-outline, interface-messages, 다섯 text-form unit)의 Rust 바인딩이 fixture 사례마다 이름으로 보고하며 rust R3 줄이 없다. 그 Verification이 통과한다 (C16.156-1). 변경은 하위 행 C16.156-1-1부터 C16.156-1-5가 담는다.

### 2026-10-21 — Rust value graph가 공유 값을 포함해 사례 열두 개를 모두 실행한다 (C16.156-1-3)

- Rust `JsonText`가 value-graph fixture의 공유 값을 받는다. `JsonText::Shared(Arc<JsonText>)`는 한 값을 여러 부모에 두고, `JsonText::Link(Weak<JsonText>)`는 자기 자신을 담는 값을 만든다(`packages/validator/rust/src/text.rs`, `packages/validator/rust/README.md`와 `README.ko.md`에 기록). 공유 값의 각 방문이 노드 하나로 세어지며, 검사(`check_specification`, `check_inputs`, `to_value`, `shape`, `invalid_path`)는 TypeScript 순회를 따른다. 먼저 빠른 순회를 하고, 첫 실패를 보고하는 순서 순회를 하며, 두 순회 모두 노드 한도와 중첩 한도를 따로 센다. `packages/validator/rust/tests/text_validity_conformance.rs`의 runner는 graph 기술의 형태 네 가지(`doubled`, `Arc::new_cyclic`을 쓰는 `self-twice`, `chain`, `flat`)를 만들어 `spec`, `data`, `files`에 놓는다 (C16.156-1-3). Red: `make -s parity-check UNITS="text-validity-value-graphs"` 7a6f8d25에서 종료 코드 2, 열두 사례 중 여덟이 not executed; green: rust 바인딩 12/12 사례 통과, rust R3 줄 없음, validity 47/47, input_text 56/56, template_shape 44/44 통과.

### 2026-10-21 — Rust text unit의 고유 symbol이 닫힌다 (C16.156-1-2)

- C16.156-1-2가 닫힌다; 그 Verification은 54b82580에서 통과한다 (여덟 text unit이 고유 symbol로 실행되며 rust R3 줄이 없다). 그 commit은 checklist를 `[~]`로 담았으며, 이 항목이 닫힘을 기록한다 (C16.156-1-2).

### 2026-10-21 — Rust interface-messages test가 native id로 이름 붙는다 (C16.156-1-5)

- config/parity.json의 interface-messages Rust 바인딩이 cargo가 보고하는 native 이름 `messages::tests::embedded_messages_match_the_contract`(`packages/generator/rust/src/messages/mod.rs`의 `tests` module 안 test)으로 test를 가리켜, feature id가 실행되는 test와 맞는다. test 자체는 바뀌지 않는다. `packages/generator/rust/src/tests.rs`는 config/parity.json에서 Rust 생성기의 internal test 파일로 선언된다. 남은 unit test가 제거된 fixture 바인딩에만 덮여 있었기 때문이다 (C16.156-1-5). Red: `make -s parity-check UNITS="interface-messages"` b79bf13d에서 종료 코드 1, rust 바인딩이 not executed; green: rust 바인딩 종료 코드 0, 1/1 id 통과, rust R3 줄 없음, `make -s parity-declarations-check`에 rust 항목 없음.

### 2026-10-21 — Rust outline fixture가 사례마다 trial 하나로 통합 test에서 실행된다 (C16.156-1-4)

- Rust 생성기의 outline fixture 검사를 라이브러리 unit test(`packages/generator/rust/src/tests.rs`의 `native_outline_fixture`)에서 통합 test `packages/generator/rust/tests/form_outline.rs`로 옮긴다. `packages/generator/rust/Cargo.toml`의 `harness = false` target이며, 사례마다 `native_outline_fixture::<case>` 이름의 trial 하나를 쓴다. config/parity.json의 form-outline 바인딩이 이 파일을 가리킨다. 사례의 검사는 바뀌지 않으며, `src/tests.rs`의 다른 unit test는 그대로 남는다 (C16.156-1-4). Red: `make -s parity-check UNITS="form-outline"` 54b82580에서 종료 코드 1, rust 바인딩의 다섯 사례가 not executed; green: rust 바인딩의 종료 코드 0, 5/5 사례 통과, rust R3 줄 없음.

### 2026-10-21 — 여덟 Rust text unit이 각자의 symbol로 실행된다 (C16.156-1-2)

- 여덟 text unit의 Rust 바인딩이 unit마다 자기 symbol을 가져, 각 바인딩의 filter가 자기 unit의 test만 고른다. validate 세 unit(validate, validateList, validateDetail)은 `input_text_validate`, `input_text_validate_list`, `input_text_validate_detail`로 실행되고(`packages/validator/rust/tests/text_validity_conformance.rs`, 각 family의 사례마다 `<symbol>::<case>` 이름의 trial 하나), 다섯 text-form unit은 `text_compile_form`, `text_bind_form`, `text_create_form`, `text_build_list`, `text_build_detail`로 실행된다(`packages/generator/rust/tests/input_text.rs`). config/parity.json의 여덟 `symbol`이 그 이름을 적는다. `text_validity_conformance.rs`는 `packages/validator/rust/Cargo.toml`의 `harness = false` target이 되며, 그 unit test(json_text_*, value_graph_limits)는 trial로 남고 단언은 바뀌지 않는다 (C16.156-1-2). Red: `make -s parity-check UNITS="text-validity-validate text-validity-validate-list text-validity-validate-detail text-compile-form text-bind-form text-create-form text-build-list text-build-detail"` 종료 코드 2, 그 unit들의 rust 바인딩이 모두 `not executed`(공유 symbol은 "not in the suite") 보고; green: 종료 코드 0, rust R3 줄 없음, 21/21, 6/6, 5/5, 7/7, 17/17, 15/15, 11/11, 6/6 사례 통과.

### 2026-10-21 — 일곱 unit의 Rust 바인딩이 각 사례를 이름으로 보고한다 (C16.156-1-1)

- list-validity, detail-validity, spec-validity, compose unit의 Rust 바인딩(`packages/validator/rust/tests/list_validity_conformance.rs`, `detail_validity_conformance.rs`, `spec_validity_conformance.rs`, `compose_conformance.rs`)과 form-complete, list-render, detail-render unit의 Rust 바인딩(`packages/generator/rust/tests/form_complete.rs`, `list_render.rs`, `detail_render.rs`)이 fixture 사례마다 `libtest-mimic` trial 하나를 `<symbol>::<case>` 이름으로 실행한다. 두 `Cargo.toml`의 `[[test]]` target은 `harness = false`이다. 사례 검사는 바뀌지 않았다 (C16.156-1-1). Red: `make -s parity-check UNITS="list-validity detail-validity spec-validity compose form-complete list-render detail-render"` exit 2, 일곱 unit마다 rust R3 not-executed 줄; green: 같은 명령에 rust R3 줄이 없고 모든 rust 사례가 통과한다 (list-validity 20/20, detail-validity 13/13, spec-validity 34/34, compose 20/20, form-complete 28/28, list-render 165/165, detail-render 68/68).

### 2026-10-21 — 다섯 unit의 Rust 바인딩이 각 사례를 이름으로 보고한다 (C16.156)

- buttons, validate, form-render, form-view, expr unit의 Rust 바인딩이 fixture 사례마다 `<symbol>::<case>`라는 이름의 test를 따로 실행하므로 `make parity-check`가 사례 이름을 읽는다: `packages/validator/rust/tests/validate_conformance.rs`와 `expr_conformance.rs`(expr의 unit 검사도 포함), `packages/generator/rust/tests/form_state.rs`(그 파일의 form-history, form-actions, view-functions symbol도 포함), `form_render.rs`와 `buttons.rs`가 `libtest-mimic`을 쓰고 각 `Cargo.toml`에 `harness = false`인 `[[test]]` target을 둔다. validator crate는 생성기 lock이 해석하는 버전인 `libtest-mimic` 0.8.2를 dev-dependency로 얻으며, `packages/validator/rust/Cargo.lock`은 그 전이 패키지만 더한다. 단언은 바뀌지 않는다 (C16.156). Red: `make -s parity-check UNITS="buttons validate form-render form-view expr"` 종료 코드 2, validate(341 사례), form-view(3), form-render(201), buttons(22), expr(74)의 rust `not-executed` R3; green: 종료 코드 0, 다섯 unit의 모든 rust 바인딩이 사례를 모두 통과하고(341/341, 3/3, 201/201, 22/22, 74/74) rust R3 줄이 남지 않는다.

### 2026-10-21 — CURP-001의 합성과 표현식 부분이 인용된다 (C16.150-1)

- C16.150을 작성한 뒤 들어온 unit `compose`와 `expr`가 CURP-001을 인용한다 (C16.150-1): `tests/fixtures/compose/cases.json`의 사례 `ref-inherit-base`와 `tests/fixtures/expr/cases.json`의 사례 `path-sibling-truthy`가 그것을 명명하며, 생성기(`packages/validator/ts/scripts/generate-compose-cases.mts`와 `generate-expr-cases.mts`가 사례의 추가 `requirements`를 받는다)가 이를 쓰고 fixture README가 그렇게 적는다. 이제 CURP-001은 네 기능 모두에서 인용된다. Red: Verification이 1fe05704에서 exit 1; green: exit 0 (두 생성기가 fixture를 재현하고, 두 unit과 각 사례 하나가 CURP-001을 명명한다).

### 2026-10-21 — php 기록 서버가 자신의 모듈을 빌드한 PHP의 php-fpm을 실행한다 (C16.62)

- `examples/form-comparison/servers/php/main.mjs`가 PATH의 `php-fpm` 대신, 모듈을 빌드한 PHP(`.php-version`의 PHP, `var/tools/bin`의 `php-config`)의 설치 `sbin`에서 php-fpm을 실행한다 (`phpFpmPath()`). 찾는 php-fpm이 없으면 찾은 경로를 적어 실패한다 (C16.62). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH node node_modules/@polyspec/kit/dist/run-tests.mjs node -- examples/form-comparison/record-stores.test.mjs` 종료 코드 1, 104 passed, 26 failed; php-ext 저장소가 "ordered_json: Unable to initialize module"로 실패한다. PATH의 php-fpm(`/opt/homebrew/sbin/php-fpm`, PHP 8.5)이 PHP 8.4의 API 20240924로 빌드된 모듈을 불러오기 때문이다; green: 종료 코드 0, 130 passed, 0 failed.

### 2026-10-21 — 어떤 바인딩도 실행하지 않던 generator 테스트에 자리가 생긴다 (C16.155)

- 어떤 바인딩도 실행하지 않던 generator 테스트 파일 여섯 개를 `config/parity.json`에 선언한다. 다섯 개 TypeScript 파일은 `ts` 구현의 internal 테스트로, 한 개 PHP 파일은 `php` 구현의 internal 테스트로 선언한다 (C16.155). 테스트 파일은 바뀌지 않았고 어떤 파일도 바인딩되지 않았다. 각 파일의 case는 브라우저 런타임 동작, internal 헬퍼, 또는 이미 바인딩된 스위트가 맡은 계약의 두 번째 테스트이기 때문이다.

| 파일 | 결정 | 이유 |
|---|---|---|
| packages/generator/ts/src/display-validity.test.ts | internal (ts) | buildList와 buildDetail을 통한 list-validity와 detail-validity case의 render 수용. validator 바인딩이 같은 case를 실행한다 |
| packages/generator/ts/src/dom-sync.test.ts | internal (ts) | 브라우저 런타임: connectForm이 서버 render의 값을 live control에 쓴다. 이를 문서화한 README 절이 아직 없다 (docs/spec/form-runtime.md) |
| packages/generator/ts/src/expr.test.ts | internal (ts) | evalAppearance, evalShow, evalFlag는 TypeScript 헬퍼다. 표현식 언어는 공유 expr 스위트가 시험한다 |
| packages/generator/ts/src/form.test.ts | internal (ts) | TypeScript form API와 그 선언 메시지. row 계약은 form-state.test.ts를 통해 form-actions와 form-view가 시험한다 |
| packages/generator/ts/src/patch.test.ts | internal (ts) | packages/html/README.md에 문서화된 브라우저 런타임 (Keeping controls across re-renders, Scripts in rendered markup) |
| packages/generator/php/tests/Internal/InterfaceMessagesTest.php | internal (php) | 생성된 PHP 소스가 생성 스크립트의 출력과 같다. 메시지 계약은 interface-messages unit이다 |

Red: `make item-red ID=C16.155 BEFORE=69bd6b3b`가 exit 1로, 위 파일의 `R5 undeclared-test` 줄 여섯 개와 함께 실패한다. green: Verification이 exit 0으로 끝나고, 여섯 줄이 사라지며, 새 줄은 나타나지 않고, `make parity-declarations-check`의 findings가 61에서 55로 줄어든다.
### 2026-10-21 — CUDF-003은 display를 보이는 마크업을 가진 list-render case가 전부 인용한다 (C16.153)

- `tests/fixtures/list-render/generate.mts`가 case `format-number`에 CUDF-003을 인용한다 (C16.153). 그 열은 서식이 적용되어 원시 값 `1234567.5`가 `$1,234,567.50`으로 쓰이므로, 마크업이 레코드가 아니라 렌더러가 display를 썼음을 보인다. `tests/fixtures/list-render/cases.json`에 그 requirement가 하나 더해지며, `config/parity.json`의 list-render unit이 CUDF-003을 인용한다. Red: `make item-red ID=C16.153` exit 0, Verification이 aee613a9에서 실패하며 R13 줄 `untraced-requirement: docs/spec/display-formats.md defines CUDF-003`이 나온다. Green: 여섯 list-render runner가 fixture를 통과한다(TypeScript `list-conformance.test.ts`, Go `TestListRenderSuite` 166 passed, Python `test_render.py` 3 passed, Rust `list_render` 1 passed, PHP와 PHP 확장 `ListRenderConformanceTest` 166 tests OK). `make -s parity-declarations-check`는 CUDF-003 줄만 사라진다(변경 전 60 findings, 후 59 findings).

### 2026-10-21 — CURP-025는 여섯 runner가 통과하는 form-actions case가 전부 인용한다 (C16.152)

- `tests/fixtures/form-state/generate.mts`에 세션 `record-keeps-member-order-and-distinct-empty-values`를 추가한다 (CURP-025, C16.152). 명세의 순서와 다른 멤버와 행 순서, 없는 `members`, 빈 객체, 빈 배열(거부됨), null 값, 그 뒤의 편집을 가진 `setData`다. case는 CURP-025의 각 절을 보인다. 멤버 순서가 유지된다(runner가 데이터의 JSON 텍스트를 비교한다), 배열은 배열로 남는다(목록은 거부됨), 없음, null, `{}`, `[]`가 구분된다, 데이터에 identity나 순서 필드가 나타나지 않는다. `tests/fixtures/form-actions/cases.json`을 재생성하고, `config/parity.json`의 form-actions unit이 CURP-025를 인용한다. Red: `make item-red ID=C16.152` exit 0, Verification이 907530ff에서 실패하며 R13 줄 `untraced-requirement: docs/spec/runtime-packages.md defines CURP-025`이 나온다. Green: TypeScript(`src/form-state.test.ts`, 39 passed), Go(`TestFormActions`, ok), Python(`tests/test_form_state.py`, 4 passed), Rust(`--test form_state`, 4 passed), PHP(`FormStateTest`, 39 tests OK), PHP 확장(`make test-php-ext CASES="FormStateTest"`, 39 tests OK) runner가 모두 통과한다. `make -s parity-declarations-check`는 CURP-025 줄만 사라지고 다른 줄은 그대로다(변경 전 61 findings, 후 60 findings).

### 2026-10-21 — form-view와 form-history의 cases가 생성기와 같다 (C16.154)

- `tests/fixtures/form-state/generate.mts`가 세 view 세션에 CUMK-057을, 네 history 세션에 CUMK-061을 인용한다 (C16.154). main이 `tests/fixtures/form-view/cases.json`과 `tests/fixtures/form-history/cases.json`에 손으로 써 넣은 인용이다. `session()`은 각 case의 `requirements`를 main과 같이 정렬하여 쓰므로, 재생성이 main의 파일을 그대로 만든다. `set-data-restarts-history-and-view`의 requirements 순서와 `tests/fixtures/form-actions/cases.json`의 case 순서가 바뀌며, 내용은 바뀌지 않는다. Red: `sh -c 'node tests/fixtures/form-state/generate.mts && git diff --exit-code -- tests/fixtures/form-view/cases.json tests/fixtures/form-history/cases.json tests/fixtures/form-actions/cases.json'` exit 1, 재생성이 form-history의 네 case에서 CUMK-061을 빼고 requirements 순서를 바꾼다. Green: 재생성된 파일에서 exit 0이며, `make -s parity-declarations-check`의 출력 줄은 변경 전과 같다.

### 2026-10-21 — 브라우저 바인딩 항목이 폼 바인딩 패키지로 옮겨진다 (C16.151)

- `docs/spec/runtime-packages.md`와 한국어 쌍: CURP-023(브라우저 바인딩은 사용자 입력과 행 작업을 적용하며, 서버 런타임은 브라우저의 포커스, 선택 영역, 스크롤 동작을 구현하지 않는다)을 CURP-019부터 CURP-022까지의 번호 목록에서 뺐다. 이제 목록은 네 항목이며, 스펙은 `packages/form-binding/README.md`의 "Browser validation" 절로 링크한다 (C16.151). 영문과 한국어 본문은 `packages/form-binding/README.md`와 `README.ko.md`에 그대로 옮겼고, 두 문서에서 id를 뺐다. 경로 2: 브라우저 바인딩을 가진 런타임은 TypeScript 폼 바인딩 패키지 하나뿐이다.
- 테스트: 내부 테스트로 선언한 테스트는 없다. `packages/form-binding`은 `config/parity.json`의 tools root(ecosystem)이지 `ts` 구현의 root가 아니므로, kit는 그 테스트를 가리키는 internal glob을 "lies outside the roots of ts"로 거부한다. 그 테스트들은 requirement id를 인용하지 않으며, `packages/form-binding/tests/binding.test.ts`와 `browser.test.ts`의 포커스 테스트는 parity 계약 밖에 있다 (C16.151).

| id | 경로 | 이유 |
| --- | --- | --- |
| CURP-023 | 2 (본질상 한 런타임) | 브라우저에서 사용자 입력과 행 작업을 적용하는 것은 TypeScript 브라우저 런타임(`packages/form-binding`)뿐이며, 서버 런타임에는 브라우저 포커스, 선택 영역, 스크롤 동작이 없다 |

Red: `sh -c 'make -s parity-declarations-check > var/pd-C16.151.log 2>&1; ! grep -E "R13 untraced-requirement: .* defines CURP-023," var/pd-C16.151.log'` exit 1, CURP-023 R13 줄 하나, 56 findings (9ec2ffc4 기준); green: exit 0, CURP-023 줄 없음, 55 findings, 사라진 줄은 그 하나뿐; `check-documents` 통과; `make lint-ts` exit 0 (C16.151).

### 2026-10-21 — 여섯 런타임이 중립 항목 하나(CURP-001)의 런타임 능력을 제공한다 (C16.150)

- `docs/spec/runtime-packages.md`와 한국어 쌍: 구현마다 같은 네 능력을 가진 CURP-001부터 CURP-005까지의 다섯 항목을, 모든 구현(JavaScript/TypeScript, PHP 라이브러리, PHP 네이티브 확장, Go, Rust, Python)이 제공하는 중립 항목 CURP-001 하나로 바꿨다. CURP-002부터 CURP-005까지는 제거했고, 목록 앞 문단에 서버 언어가 다른 런타임 없이 폼을 렌더링한다는 문장을 두었다 (C16.150). 제거된 각 id는 경로 1(native 통합)이다: 각 구현이 같은 네 능력을 자기 형태로 가진다 (Python은 packages/generator/python과 packages/validator/python). CURP-001은 스위트 단위 `text-compile-form`(케이스 `pass-paired-surrogates`), `text-bind-form`(`pass-paired-surrogates`), `form-render`(`group-nested-properties`), `list-render`(`basic-columns`), `detail-render`(`basic-fields`), `validate`(`property-member-order`)가 인용하고, 각 케이스가 `requirements`에 이를 나열한다. 해당 케이스의 id는 `tests/fixtures/list-render/generate.mts`, `tests/fixtures/detail-render/generate.mts`, `packages/react/scripts/generate-form-render-cases.mts`, `tests/fixtures/validate/generate.mts`에 둔다. `tests/fixtures/validate/cases.json`은 그 id 하나만 손으로 고쳤다. 생성기가 그 파일을 재현하지 못하기 때문이다(케이스 `expression-scalar-equals-array-is-false`는 생성되지 않는다).
- 조합과 표현식은 아직 인용하지 않는다: main에 compose 또는 expression 단위가 없다. 그 단위가 들어올 때 CURP-001을 인용하며, 통합자가 그때 추가한다 (C16.150).

| id | 경로 | 이유 |
| --- | --- | --- |
| CURP-001부터 CURP-005까지 | 1 (native 통합) | 모든 구현이 같은 네 능력을 자기 형태로 가지므로, 구현별 다섯 항목을 중립 항목 하나로 대체한다 |

Red: `sh -c 'make -s parity-declarations-check > var/pd-C16.150.log 2>&1; ! grep -E "R13 untraced-requirement: .* defines CURP-00[1-5]," var/pd-C16.150.log'` exit 1, R13 줄 다섯 개(CURP-001부터 CURP-005까지 정의되고 어떤 단위도 인용하지 않음), 61 findings; green: exit 0, CURP-001부터 CURP-005까지의 줄이 남지 않음, 56 findings, `check-documents` 통과 (C16.150).
### 2026-10-21 — 중복은 0이다: make duplication-check가 보고한 마지막 clone 10개가 공유된다 (C16.58)

- `make duplication-check`가 main에서 보고한 clone 10개가 사라졌다(C16.58). Go form-comparison server의 number text는 `validate.CanonicalNumber`를 쓴다(C16.58-25). PHP record store는 NumberValue로 number text를 파싱한다(C16.58-26). TypeScript adapter는 mountView와 hydrateView를 view-entries.ts에서 받는다(C16.58-27). C expression 값들은 parse와 release 단계를 공유한다(C16.58-28). C row view 연산들은 하나의 list 복사를 공유한다(C16.58-29). React collection scenario는 spec을 공유한다(C16.58-30). Red: 기반 커밋 69bd6b3b에서 `make duplication-check`가 exit 2, clone 10개(item-red BEFORE, exit 0). Green: 이 커밋에서 `make duplication-check` exit 0, `make lint-go`, `make lint-php`, `make lint-ts`, `make lint-php-ext`가 통과한다.

### 2026-10-21 — React form render scenario의 두 collection case가 spec을 공유한다 (C16.58-30)

- packages/react/scripts/scenario-form-render-cases.ts: `collectionShownByVisible`이 `visible` member가 보이거나 숨기는 collection의 spec을 한 번 적고, `collection-shown-by-condition`과 `collection-hidden-by-condition` case가 이를 `spec`으로 받는다(C16.58-30). 생성기는 tests/fixtures/form-render/cases.json을 바꾸지 않는다. Red: `make duplication-check`가 scenario-form-render-cases.ts [394:81 - 402:21] = [407:119 - 415:21]을 나열한다(item-red exit 0, main에서 Verification의 grep이 실패). Green: 그 grep exit 0, 생성기가 cases.json을 바꾸지 않는다(`git diff --exit-code` exit 0), `make lint-ts` 0 errors.

### 2026-10-21 — C row view 연산이 하나의 list 복사로 row를 toggle하고 remove한다 (C16.58-29)

- packages/php-ext/src/view.c: `rows_without`가 접힌 row들을 복사하면서 predicate가 지정한 항목을 뺀다(toggle은 `drops_same_row`, 제거는 `drops_row_inside`). 그래서 `ps_toggle_row_view`와 `ps_remove_row_view`가 복사를 공유한다(C16.58-29). toggle은 list에 없던 row를 여전히 덧붙이고, 실패 경로는 그대로다. Red: `make duplication-check`가 view.c [144:29 - 150:39] = [177:29 - 183:39]를 나열한다(item-red exit 0, main에서 Verification의 grep이 실패). Green: 그 grep exit 0, CASES 조건의 `make test-php-ext`가 544 passed(FormStateTest가 두 연산을 다룬다).

### 2026-10-21 — C expression value 함수들이 parse와 release 단계를 공유한다 (C16.58-28)

- packages/php-ext/src/expression.c: `parsed_source`가 expression의 token과 tree를 담는다. `parse_source`가 이를 돌려주고 `free_parsed_source`가 해제하므로, `ps_expression_value`와 `ps_expression_truth`가 parse와 해제 단계를 공유한다(C16.58-28). Red: `make duplication-check`가 expression.c [750:30 - 756:66] = [761:25 - 767:66]을 나열한다(item-red exit 0, main에서 Verification의 grep이 실패). Green: 그 grep exit 0, CASES 조건의 `make test-php-ext`가 544 passed. Verification의 CASES는 대안(alternation)으로 `|`를 쓴다: 앞 sub-row들의 `\|`는 이 runner에서 test를 하나도 고르지 않는다.

### 2026-10-21 — TypeScript form-comparison adapter가 mountView와 hydrateView를 하나의 module에서 받는다 (C16.58-27)

- 새 파일 examples/form-comparison/src/adapters/view-entries.ts의 `viewEntries(start)`가 하나의 start 함수 위에 타입이 붙은 `mountView`와 `hydrateView`를 돌려준다. 서명은 타입으로 한 번만 적는다(C16.58-27). 여덟 adapter(html, svelte, vue, react의 bind-form과 create-form)는 두 export 함수의 사본을 `export const { mountView, hydrateView } = viewEntries(start);` 한 줄로 바꾼다. adapter-completion.test.mjs는 adapter 원문에서 복사된 서명을 더 이상 찾지 않는다. 대신 각 adapter가 ./view-entries.ts에서 viewEntries를 가져오고 mountView와 hydrateView를 export하는지 확인하며, 서명은 tsc가 타입으로 검사한다. 테스트가 확인하는 내용이 바뀌었고, adapter의 동작은 바뀌지 않았다. Red: `make duplication-check`가 bind-form-html.ts, create-form-html.ts, svelte와 vue adapter의 clone을 나열한다(item-red exit 0, main에서 Verification의 grep이 실패). Green: 그 grep exit 0, adapter-completion.test.mjs 3 passed, svelte-dispose.test.mjs 2 passed, `make lint-ts` 0 errors.

### 2026-10-21 — PHP form-comparison record store가 validator의 NumberValue로 number text를 파싱한다 (C16.58-26)

- examples/form-comparison/servers/php/src/RecordStore.php의 `RecordStore::number`가 자체 복사본 대신 `Polyspec\Crudui\Validator\Support\NumberValue::parseString`을 호출한다(C16.58-26). `Infinity`, `+Infinity`, `-Infinity` 문자열은 복사본과 같은 메시지 `Expected a number`를 유지하고(NumberValue는 이를 무한대 수로 읽는다), 그 밖의 비유한 수는 `Expected a finite number`를 유지한다. 동작은 바뀌지 않았다: var/php-number-compare.php의 입력 9038개가 변경 전후 같은 결과를 낸다. Go와 Rust record server는 이 literal에 `Expected a finite score`를, TypeScript server는 이를 받아들이므로, 이 변경으로 PHP 메시지가 그들과 맞춰진 것은 아니다. Red: `make duplication-check`가 clone RecordStore.php [150-156] = NumberValue.php [28-34]를 나열한다(item-red exit 0, main에서 Verification의 grep이 실패). Green: 그 grep exit 0, `make duplication-check`는 clone 8개를 찾는다, phpunit FormShapeTest와 FormJsonTest 2 passed, NumberValueTest 20 passed; `make lint-php` exit 0.

### 2026-10-21 — Go form-comparison 서버가 validator의 canonical number 함수로 number를 쓴다 (C16.58-25)

- Go validator가 `CanonicalNumber`를 export한다(packages/validator/go/validator/validate). value_text.go의 미공개 `canonicalNumber`를 이름만 바꿔 공개하고, 호출부를 value_number.go, rules.go, rule_length.go에서 함께 바꾸었다. value_test.go는 공개된 이름을 호출하므로 공개 helper의 테스트가 library에 남는다(C16.58-25). Go form-comparison 서버는 같은 알고리즘의 사본(json.go의 `numberText`와 `abs`)을 버리고 json.go, records.go, records_test.go에서 `validate.CanonicalNumber`를 호출한다. Red: `make duplication-check` exit 2, clone 10개(json.go [179-193] = value_text.go [59-73] 포함); 변경 전 example 테스트(11 passed)와 validator의 `TestCanonicalNumber|TestCanonicalText`는 exit 0이었고, 이름을 바꾼 뒤 테스트는 `undefined: CanonicalNumber`로 build되지 않았다. Green: 같은 테스트가 exit 0(validator 2 passed, example 11 passed), `make lint-go` 0 issues, `make duplication-check`에서 go clone이 사라졌다.

### 2026-10-21 — 새 worktree의 make install이 끝까지 실행된다 (C16.149)

- Makefile의 `crudui-install`이 `crudui-install-python`과 `crudui-install-composer` 뒤, `crudui-install-phpdocumentor` 앞에서 `install-link`를 실행한다 (C16.149). composer install은 추적되는 `composer.lock`에서 `vendor/composer/platform_check.php`를 쓰는데, 배포된 polyspec/ordered-json 0.0.9 때문에 PHP 8.5를 요구한다. `.php-version`의 PHP 8.4.1로 검사를 다시 쓰는 link는 `make install`의 끝에서만 실행되어, `make worktree-setup`이 phpDocumentor에서 "Composer detected issues in your platform"으로 멈췄다. Red: `make -n crudui-install`의 순서 검사가 379832f3에서 exit 1; green: exit 0, worktree에서 `make install-link` 뒤 `make crudui-install-phpdocumentor`가 phpDocumentor 3.10.0을 설치한다.

### 2026-10-21 — validator의 남은 compose와 expression test에 자리를 준다 (C16.57-3-3)

- parity 검사가 binding도 internal 항목도 없다고 보고한 test 파일 여섯 개에 자리를 줍니다(`config/parity.json`). TypeScript `packages/validator/ts/src/compose/patch.test.ts`와 `ref.test.ts`, PHP `packages/validator/php/tests/Compose/PatchTest.php`와 `RefTest.php`, Go `packages/validator/go/validator/compose/order_test.go`, `expr/engine_test.go`, `expr/recognize_test.go`는 한 implementation의 고유 함수(applyPatch, Patch와 Ref class, 순서가 있는 map, condition map, recognizer)의 규칙을 시험하며, 공유 compose와 expr suite는 그것을 case로만 검사합니다. 각 파일은 이유를 적은 `internal` 항목이 됩니다 (C16.57-3-3). Red: `make -s parity-declarations-check`가 이 여섯 파일을 R5 undeclared-test로 보고했습니다(red 기록은 R5 줄을 모두 18개 가지며, 그중 여섯이 이 파일들이다); green: 이 파일들의 R5 줄이 없고, owner test가 통과합니다 (vitest 23, phpunit 24, 두 package의 go -run).

### 2026-10-21 — 합성 suite를 선언하고 여섯 implementation에 binding한다 (C16.57-3-2)

- 합성 고정 데이터 `tests/fixtures/compose/cases.json`을 suite unit `compose`로 선언하고 ts, php, go, rust, python, php-extension에 binding한다(`config/parity.json`). 각 case는 `docs/spec/schema.md`의 요구사항 CUSC-007을 이름으로 밝히며, 생성기 `packages/validator/ts/scripts/generate-compose-cases.mts`가 모든 case에 `requirements`를 씁니다. 고정 데이터는 다시 생성했고 추가된 키만 달라집니다. TypeScript binding `packages/validator/ts/src/compose.conformance.test.ts`는 case마다 그 이름의 최상위 test로 실행하여 parity 검사가 case를 이름으로 읽게 합니다 (C16.57-3-2). Red: `make -s parity-declarations-check`가 exit 1이며 `R4 undeclared-suite tests/fixtures/compose/cases.json`을 냅니다; green: 그 줄이 없고, 여섯 binding 명령이 모두 통과합니다 (vitest 20, phpunit 20, go 21, cargo 1, python 4, node 20/20 case).

### 2026-10-21 — PHP extension의 C engine이 expression suite를 실행한다 (C16.57-3-1)

- PHP extension의 C engine을 K422에 따라 node runner로 expr suite에 binding한다. `packages/php-ext/tests/contract/expr.test.mjs`는 engine source를 한 번 컴파일하고 `tests/fixtures/expr/cases.json`의 case마다 자기 test로 결과를 보고한다. expression과 composition contract test는 `packages/php-ext/tests/engine/engine.test.mjs`에서 `packages/php-ext/tests/contract/`로 옮겼으며(composition 파일은 C16.57-3-2가 binding한다), `config/parity.json`이 unit `expr`의 binding과 contract glob을 더한다 (C16.57-3-1). Red: `make -s parity-declarations-check`가 exit 1이며 `R2 missing-binding expr php-extension` 줄을 낸다; green: 그 check에 expr의 R2 줄이 없고, `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- packages/php-ext/tests/contract/expr.test.mjs`가 74개 case를 모두 통과한다.

### 2026-10-21 — CURT-055는 그것을 전부 시험하는 세션이 인용하고, CURT-054는 form state 인용에서 철회된다 (C16.146-1)

C16.146의 인용을 바로잡습니다. case는 자기가 요구사항을 전부 시험할 때만 그 요구사항을 인용합니다.

- CURT-055(잘못된 작업의 원자적 거부; 모든 행 삭제 뒤 추가 가능)는 이제 `delete-every-row-then-add-one-with-min-zero`(form-actions)가 인용합니다. 최소 행 수가 없을 때 알 수 없는 행은 실패하며 아무것도 바꾸지 않고, 모든 행을 지운 뒤 한 행을 추가하면 빈 값의 행이 됩니다. 이전 `invalid-removal-leaves-data-and-adding-continues` 세션은 case를 유지하지만 CURT-055를 인용하지 않습니다. 공용 명세의 최소가 팀 한 개이므로 모든 행을 지울 수 없기 때문입니다.
- CURT-054(저장한 seq 키 적용, 필드 이름과 규칙 경로 갱신)는 인용과 form-actions unit에서 철회됩니다. `rekey-moves-the-edits-to-the-new-keys` 세션은 rekey 뒤의 데이터를 관찰하지만, form state 형식은 규칙 경로를 관찰하지 않습니다. 관찰값은 결과, 오류, 데이터, 개정 번호, 실행 취소 플래그, 접힌 행이며 검증 오류나 필드 경로를 나열하는 단계가 없습니다. 이를 관찰하려면 여섯 runner 모두에 새 단계가 필요하므로 CURT-054는 다시 미추적으로 보고합니다.

form state runner는 여섯 구현 모두 한 번씩 통과합니다. TypeScript, Go, Python, Rust, PHP, PHP extension과 engine 테스트입니다.

### 2026-10-21 — form state 세션이 인수 기준 세 개를 인용하고, 복사 규칙은 form 비교 예제로 옮겨진다 (C16.146)

C16.141이 보고한 인수 기준 여섯 개(CURT-050부터 CURT-056까지)에 대한 결정입니다.

| 요구사항 | 결정 | 위치 | 이유 |
| --- | --- | --- | --- |
| CURT-050 (중첩 필드 준비, 템플릿 직렬화, 독립 레코드 바인딩) | 보고, 미추적 유지 | 없음 | 세션은 인스턴스마다 레코드 하나를 바인딩하며 직렬화한 템플릿을 읽지 않습니다. 한 템플릿에서 레코드 두 개를 바인딩하는 case 형식이 필요합니다 |
| CURT-052 (스토어 키와 회사 키가 같으면 스토어 복사) | 경로 2 | `examples/form-comparison/README.ko.md`(스토어 복사), 두 언어 | 라이브러리 규칙이 아니라 form 비교 예제의 인수 기준입니다 |
| CURT-053 (편집·정렬·제거·추가 후 이전 값 없음) | 인용 | `edit-reorder-remove-and-add-rows-keep-no-stale-values`(form-actions) | 관찰된 데이터가 행마다 자기 값을 보이고, 추가한 행은 비어 있습니다 |
| CURT-054 (저장한 seq 키 적용, 필드 이름과 규칙 경로 갱신) | 인용 | `rekey-moves-the-edits-to-the-new-keys`(form-actions) | 관찰된 데이터가 rekey한 행과 멤버를 새 키 아래에 보이고, 새 경로로 편집한 값을 보입니다. 세션은 필드의 규칙 경로가 아니라 데이터를 관찰하므로 규칙 경로 부분은 관찰되지 않습니다 |
| CURT-055 (잘못된 작업의 원자적 거부; 모든 행 삭제 뒤 추가 가능) | 인용 | `invalid-removal-leaves-data-and-adding-continues`(form-actions) | 알 수 없는 행과 최소 행 수 아래의 제거가 실패하며 데이터를 바꾸지 않고, 이후 추가가 이어집니다. 공용 명세의 최소는 팀 한 개이므로 세션은 모든 행을 삭제할 수 없습니다 |
| CURT-056 (공용 검증 case를 네 언어로 실행하고 하나의 멱등 서명) | 경로 2(설명) | 명세, 번호 없는 문단 | 시험 절차이며 테스트가 요구사항으로 검사할 수 없습니다 |

추가된 세션이 유일한 새 case입니다. `tests/fixtures/form-actions/cases.json`은 세 개만 늘고 기존 case는 바뀌지 않습니다. form-actions unit은 CURT-053, CURT-054, CURT-055를 인용합니다. form state 제품군의 모든 runner(TypeScript, Go, Python, Rust, PHP, PHP extension과 engine 테스트)가 한 번씩 통과합니다.
### 2026-10-21 — 한 직렬화 템플릿에서 바인드한 레코드는 서로 독립이다 (C16.147)

- template-shape fixture에 한 직렬화 템플릿에서 레코드를 바인드하는 case 두 개를 더했습니다: `create-two-records-from-serialized-template`, `create-three-records-independent`. compile된 템플릿은 레코드가 생기기 전에 구성 파일(반복 그룹의 `$ref`)을 풀고, JSON으로 직렬화되며, 각 레코드는 구성 파일을 주지 않고 그 템플릿만으로 바인드합니다. 각 레코드는 자기 값을 읽고, 세 레코드 case에서는 세 번째 바인드가 첫 번째가 읽은 값을 읽습니다. CURT-050은 두 case와 unit `template-shape`에 인용됩니다.
- 여섯 runner가 두 case를 모두 실행합니다. TypeScript, Go, Rust, PHP(확장 포함), Python runner는 각 바인드가 읽은 값을 TypeScript 기준 구현이 계산한 기대값과 비교합니다.

### 2026-10-21 — form state 검증 관찰이 완료된다 (C16.148)

- 스택 C16.148이 완료됩니다. 여섯 행이 모든 form state runner에서 검증 오류를 관찰하고, rekey 세션을 통해 CURT-054를 인용합니다.

### 2026-10-21 — form state 세션이 검증 오류를 관찰하고 CURT-054를 전부 인용한다 (C16.148)

- 여섯 form state runner가 검증 오류를 데이터 경로와 함께 관찰하는 `validate` 단계를 실행합니다. CURT-054의 rekey 세션은 오류가 새 키를 따른다는 것을 보이며, form-actions unit은 이를 통해 CURT-054를 인용합니다.

### 2026-10-21 — 검증 rekey 세션이 CURT-054를 전부 인용한다 (C16.148-6)

- form-actions unit이 CURT-054를 인용합니다. `rekey-moves-validation-errors-to-the-new-paths` 세션은 팀과 멤버를 rekey하기 전과 뒤의 검증기 오류를 관찰하므로, 오류는 새 키를 따릅니다. 필드의 규칙 경로가 오류의 데이터 경로로 관찰됩니다. 이 세션은 여섯 form state runner 모두에서 실행됩니다.
- C16.146의 정정이 완료됩니다. CURT-054는 관찰이 없던 rekey 세션이 아니라 요구사항을 전부 시험하는 case가 인용합니다.

### 2026-10-21 — PHP form state 테스트가 library와 extension에서 validate 단계를 실행한다 (C16.148-5)

- `packages/generator/php/tests/FormStateTest.php`가 form state 세션의 `validate` 단계를 `Validator::validate`로 실행합니다. 유효성과 각 오류의 데이터 경로, 필드 이름, 규칙, 메시지가 검증기 순서대로 관찰됩니다. PHP library와 PHP extension이 같은 테스트를 실행합니다.

### 2026-10-21 — Rust form state runner가 validate 단계를 실행한다 (C16.148-4)

- `packages/generator/rust/tests/form_state.rs`가 form state 세션의 `validate` 단계를 실행합니다. 검증기는 세션의 명세와 현재 record로 실행되며, 각 오류의 경로, 필드, 규칙, 메시지가 검증기 순서대로 관찰됩니다.

### 2026-10-21 — Python form state runner가 validate 단계를 실행한다 (C16.148-3)

- `packages/generator/python/tests/test_form_state.py`가 form state 세션의 `validate` 단계를 실행합니다. 검증기는 세션의 명세와 현재 record로 실행되며, 각 오류의 경로, 필드, 규칙, 메시지가 검증기 순서대로 관찰됩니다.

### 2026-10-21 — Go form state runner가 validate 단계를 실행한다 (C16.148-2)

- `packages/generator/go/form_state_test.go`가 form state 세션의 `validate` 단계를 실행합니다. 검증기는 세션의 명세와 현재 record(검증기가 읽는 map으로 디코딩)로 실행되며, 각 오류의 경로, 필드, 규칙, 메시지가 검증기 순서대로 관찰됩니다.

### 2026-10-21 — form state 세션이 검증 오류를 데이터 경로와 함께 관찰한다 (C16.148-1)

- `tests/fixtures/form-state/harness.mts`에 `validate` 단계가 있습니다. 세션의 명세와 현재 데이터로 검증기를 실행하고, `valid`와 각 오류의 데이터 경로, 필드 이름, 규칙, 메시지를 검증기 순서대로 관찰합니다.
- `tests/fixtures/form-state/generate.mts`에 `rekey-moves-validation-errors-to-the-new-paths`(CURT-054)가 추가됩니다. 이름이 없는 필수 멤버의 오류는 데이터 경로에 보고되며, 팀과 멤버를 rekey한 뒤에는 같은 오류가 새 경로에 보고됩니다. CURT-054의 인용은 이 스택의 마지막 행에 옵니다.
- 나머지 다섯 form state runner는 아직 `validate` 단계를 구현하지 않으므로, 이 스택의 각 행이 land하기 전까지 red입니다.

### 2026-10-21 — CUIT-041에 Python 항목이 있다 (C16.140-2)

- CUIT-041의 표에 Python 항목을 더합니다. 이 항목은 Python 패키지가 던지는 클래스를 소스에서 확인해 적습니다. 검증은 로드 실패에 `ComposeLoadError`(`compose_errors.py`), 입력 실패에 `FormInputError`(`errors.py`)를 던집니다. 생성은 로드 실패에 validator 패키지가 명세를 구성할 때 던지는 같은 `ComposeLoadError`를, 입력 실패에 `FormError`(`generator/errors.py`)를 던집니다. 소유자는 이 공백이 runner가 아니라 명세에 있다고 정했습니다. Python runner는 이미 이 타입들을 검사합니다.

### 2026-10-21 — CUIT-041은 대체한 항목들의 뜻을 유지한다 (C16.140-1)

- CUIT-041은 오류 타입 표를 내용으로 가집니다. 각 구현은 로드 실패와 입력 실패를 자기 항목이 적은 오류 타입으로 보고합니다. 항목은 옛 CUIT-032부터 CUIT-036까지이며, JavaScript, PHP와 확장, Go(생성은 메시지를 담은 오류), Rust(로드 실패는 `ValidateError::Load` 또는 `FormError` 안의 `ComposeLoadError`, 입력 실패는 `ValidateError::Input` 또는 `FormError` 안의 `FormInputError`)입니다. 옛 항목이 말하지 않은 "두 실패는 서로 다른 타입"이라는 말은 요구사항에서 뺐습니다. Rust generator는 자기 항목이 허용하는 대로 두 실패를 모두 `FormError`로 보고하며, 그 runner는 CUIT-041을 이름으로 적습니다.

### 2026-10-21 — input text의 오류 타입은 모든 구현이 검사하는 하나의 요구사항 CUIT-041이다 (C16.140)

- CUIT-032부터 CUIT-036까지에 대한 경로 1(native 통합): 다섯 항목은 언어별 오류 타입을 적었고, 이를 CUIT-041 하나로 다시 씁니다. 로드 실패와 입력 실패는 각 구현의 서로 다른 오류 타입입니다. 언어별 타입 표는 설명으로 따릅니다. 옛 id는 `docs/spec/input-text.md`와 한국어 문서, 그리고 그 id를 인용하던 모든 case와 unit에서 없어졌습니다.
- case와 unit: validate, validateList, validateDetail, value-graphs fixture와 validator unit 네 개는 CUIT-032, CUIT-033, CUIT-035 대신 CUIT-041을 인용합니다.
- runner(각각 모든 실패의 native class를 검사하며 통과합니다): TypeScript validator와 generator(`ComposeLoadError`, `FormInputError`); PHP validator, generator, PHP extension(검증에서 `ComposeLoadError`, `FormInputError`, 생성에서 `FormError`); Go validator(`*compose.ComposeLoadError`, `*FormInputError`)와 generator(잘못된 text의 로드 타입); Rust validator(`ValidateError::Load`, `ValidateError::Input`); Python validator(`ComposeLoadError`, `FormInputError`)와 generator(생성의 `FormError`).
- Rust generator: 바뀌지 않았고 요구사항을 충족하지 않습니다. 생성 operation은 모든 실패에 `FormError`를 돌려주며, `From<ComposeLoadError>` 구현은 로드 종류를 code `INVALID_TEXT`에만 남기므로 Rust generator에서 로드 실패와 입력 실패는 서로 다른 오류 타입이 아닙니다. 중립 요구사항은 로드 실패용 두 번째 오류 타입이나 명시된 예외를 요구하며, 어느 쪽인지는 소유자가 정합니다.

### 2026-10-21 — 추적되지 않은 CUSC 요구사항에 공유 사례가 있습니다 (C16.144)

`docs/spec/schema.md`의 추적되지 않은 CUSC id 8개의 결정표입니다(결정은 해당 문장을 검증하는 사례, 각 사례는 해당 suite의 모든 runner가 실행합니다):

| 요구사항 | 결정 | 사례(suite) | 문장을 검증하는 이유 |
|---|---|---|---|
| CUSC-005 behavior: 이벤트 스크립트는 표현식 평가 없이 보존 | 인용 | `behavior-opaque-passthrough` (form-render) | `onchange` 값은 그대로 유지되며 표현식 엔진이 적용되지 않습니다. |
| CUSC-016 stacked: 레이블을 컨트롤 위에 둡니다 | 신규 | `stacked-layout-group` (form-render) | `design.layout`을 stacked로 선언한 group은 레이블을 컨트롤 위에 둡니다. |
| CUSC-022 레이블 배열은 작성 순서와 인덱스를 유지 | 인용 | `choice-list-index-labels` (form-render) | 항목이 작성 순서대로 유지되는 레이블 배열이며 인덱스가 값입니다. 이 사례가 이미 같은 문장을 검증합니다. |
| CUSC-038 조건은 JavaScript가 아닌 표현식 파서로 평가 | 신규 | `expression-scalar-equals-array-is-false`, `expression-zero-equals-empty-array-is-false` (validate) | `'a' == .tags`는 `tags: ['a']`에서 거짓이고, `0 == .tags`는 빈 배열에서 거짓입니다(docs/spec/expressions.md). JavaScript 느슨한 동등 비교는 둘 다 참이므로 메모는 필수가 아닙니다. |
| CUSC-039 언어별 입력값은 표시 언어와 독립 | 신규 | `lang-values-keep-language-whatever-display` (form-render) | 각 언어 입력은 표시 언어와 관계없이 그 언어로 작성된 값을 보여줍니다. |
| CUSC-043 multiple.min과 multiple.max | 인용(max)과 신규(min) | `multiple-max-reached-disables-add`(인용, max), `multiple-min-reached-disables-remove`(신규, min) | 양쪽을 모두 검증하므로 두 사례 모두에 CUSC-043을 인용합니다. |
| CUSC-044 multiple.copy와 multiple.sortable | 인용 | `multiple-settings-bucket` (form-render) | `sortable`과 `copy`에 대해 위로, 아래로, 행 복사 컨트롤이 표시됩니다. |
| CUSC-046 multiple.controls의 header, footer, outline | 신규 | `multiple-controls-header`, `multiple-controls-footer`, `multiple-controls-outline` (form-render) | 각 값이 문장대로 행 컨트롤의 위치를 정합니다. |

유닛 `form-render`와 `validate`가 id를 나열합니다. `packages/react/scripts/generate-form-render-cases.mts`의 표가 이를 인용하고, `tests/fixtures/form-render/cases.json`을 다시 생성했습니다. 새 사례 6개가 추가되고, 인용한 사례 4개는 `requirements` 멤버만 늘어납니다. Go, Rust, Python form-render runner와 Python validate runner가 새 사례 수(결과 150개, 전체 201개, validate 결과 202개)를 확인합니다. 빨강: a3ef53a5에서 `make item-red ID=C16.144`, 수정 전에는 이 id들의 R13 grep이 실패합니다.

실행: 두 suite의 각 runner를 한 번씩 소유자 선택으로 실행했고 모두 0으로 끝났습니다. Validate: ts, php, php 확장, go, rust, python. Form-render: ts, go, python, php, php 확장, rust. 린트: 변경된 언어에 대해 `make lint-ts`, `lint-go`, `lint-rust`, `lint-python`.

### 2026-10-21 — 클래스 이름 짓기, 뷰 상태, 기록 요구사항을 해당 사례가 인용합니다 (C16.145)

추적되지 않은 CUMK id의 결정표입니다(결정은 요구사항을 검증하고 인용하는 사례):

| 요구사항 | 결정 | 검증하는 사례 |
|---|---|---|
| CUMK-001 `crudui-{block}`, CUMK-002 `crudui-{block}__{element}`, CUMK-003 `crudui-{block}--{modifier}` (클래스 이름 짓기) | 인용 | 기대 마크업에 클래스 이름이 있는 form-render 사례 144개(블록, 요소, 수정자를 모두 가짐). `packages/react/scripts/generate-form-render-cases.mts`가 목록을 관리하며, `tests/fixtures/form-render/cases.json`은 `requirements` 멤버만 바뀐 상태로 다시 생성됩니다. 유닛 `form-render`가 세 id를 나열합니다. |
| CUMK-057 (펼침은 레코드 데이터가 아닌 뷰 상태) | 인용 | form-view 사례 3개: `toggle-row-collapses-and-expands`, `set-all-expanded-collapses-every-collapsible-row`, `row-removal-drops-and-rekey-moves-view`. 유닛 `form-view`가 id를 나열합니다. |
| CUMK-061 (실행 취소는 모든 데이터 변경을 기록하고 한 경로의 연속 편집을 합칩니다) | 인용 | form-history 사례 4개: `undo-and-redo-restore-the-record`, `same-path-edits-share-one-record`, `a-change-after-undo-clears-redo`, `history-keeps-100-records`. 유닛 `form-history`가 id를 나열합니다. |

빨강: a3ef53a5에서 `make item-red ID=C16.145`, 수정 전에는 이 id들의 R13 grep이 실패합니다. 초록: 수정 후 같은 grep이 비어 있습니다(parity 결과가 115에서 77로 줄어듭니다). `make lint-ts`가 통과합니다. form-render, form-view, form-history의 변경된 픽스처에 대해 TypeScript 소유자 테스트를 실행합니다.

### 2026-10-21 — 검사할 수 없는 두 스키마 요구사항은 평문입니다 (C16.143)

`docs/spec/schema.md`의 추적되지 않은 CUSC id 결정표입니다(결정은 해당 텍스트가 가는 곳):

| 요구사항 | 결정 | 이유 |
|---|---|---|
| CUSC-037 (구조, 콘텐츠, 검증, 외형, 위젯 옵션을 분리) | 평문, id 제거 | 설계 원칙이며 테스트로 확인할 수 없습니다. 스펙에 평문 문장으로 남습니다. |
| CUSC-040 (4개 언어의 공유 검증 사례와 3개 프레임워크의 SSR 출력 비교, 마운트한 뷰에서 편집 동작 검증) | 평문, id 제거 | 테스트 과정을 서술하며 테스트로 확인할 수 없습니다. 스펙에 평문 문장으로 남습니다. |

인수 기준에는 CUSC-036, 038, 039가 남습니다. 나머지 추적되지 않은 CUSC id(005, 016, 022, 043, 044, 046)는 이 행에서 바꾸지 않고 C16.144에서 다룹니다. 빨강: 8eac4a0a에서 `make item-red ID=C16.143`, 수정 전에는 `defines CUSC-037|CUSC-040` R13 grep이 실패합니다. 초록: 수정 후 같은 grep이 비어 있습니다. `make docs-check`가 통과합니다.

### 2026-10-21 — kit copy들이 kit에만 있는 check를 이름으로 대지 않는다 (C16.139)

- `PRINCIPLES.md`와 `PRINCIPLES.ko.md`는 K359-2(`f9f80e60`, "Name no check that only kit has")가 든 kit 0.0.54의 copy입니다. P10은 kit에만 있는 `tests/kit/worktree-setup.test.mts`를 더 이상 이름으로 대지 않으므로 `make rules-check`가 그 file이 없다고 보고하지 않습니다(C16.139). Red: 0afab14d에서 `make rules-check` exit 2, `PRINCIPLES.md:44: tests/kit/worktree-setup.test.mts does not exist`. Green: `make rules-check`, `make kit-check`, `make layout-check`, `make link-state-check` exit 0입니다.

### 2026-10-21 — 양식 마크업의 추적되지 않은 요구사항을 배치하거나 보고합니다 (C16.142)

`docs/spec/form-markup.md`의 추적되지 않은 CUMK 25개 id에 대한 결정표입니다(경로 1은 네이티브 통합, 경로 2는 한 런타임에만 해당하는 내용으로, 해당 패키지 문서로 옮기며 어떤 유닛도 인용하지 않습니다):

| 요구사항 | 경로 | 위치 / 이유 |
|---|---|---|
| CUMK-039..055 (`--crudui-*` 사용자 지정 속성과 기본값, 쓰임) | 2 | `packages/generator/ts/README.ko.md`. 이 속성들은 `packages/generator/ts/styles/crudui.css`에만 정의됩니다. |
| CUMK-056 (준비와 스크롤 동기화, 애니메이션 프레임당 한 번 표시되는 고정 헤더) | 2 | `packages/generator/ts/README.ko.md`. `requestAnimationFrame`은 `packages/generator/ts/src/dom.ts`에만 있습니다. |
| CUMK-008 `crudui-outline`, CUMK-009 `crudui-data` (블록 마크업) | 2 | `packages/html/README.ko.md`. 이 블록은 TypeScript HTML 렌더러와 그 스타일만 내보냅니다. |
| CUMK-001/002/003 (BEM 클래스 이름 짓기) | 보고 | 모든 생성기가 BEM 클래스 이름을 내보내므로 모든 구현이 지켜야 하는 계약입니다. 공유 케이스가 필요하며 옮기지 않았습니다. |
| CUMK-057 (펼침은 뷰 상태), CUMK-061 (실행 취소는 모든 데이터 변경을 기록) | 보고 | 뷰와 기록 함수가 모든 생성기에 있습니다. 공유 form-view와 history 함수 픽스처가 필요하며 옮기지 않았습니다. |

스펙에는 옮긴 각 블록의 포인터가 남아 있습니다. 옮긴 텍스트에는 요구사항 id가 없고 영어와 한국어로 유지됩니다. 빨강: 0afab14d에서 `make parity-declarations-check`의 R13 `untraced-requirement`가 CUMK-039..056, 008, 009 id에 대해 나옵니다. 초록: R13 grep(`defines CUMK-039..056|CUMK-008|CUMK-009`)이 비어 있습니다. `make docs-check`와 `make lint-ts`가 통과합니다.
### 2026-10-21 — 브라우저 런타임 문서가 명세에서 런타임을 가진 패키지로 옮겨진다 (C16.141)

범위 규칙(한 런타임의 특성)에 따라 `docs/spec/form-runtime.md`의 미추적 CURT 요구사항 35개에 대한 결정입니다. 경로 2는 본문을 런타임을 가진 패키지의 문서로 옮기고 보존하며 id를 제거하는 것이고, 경로 1(네이티브 통합)은 이 중 어느 것에도 적용되지 않습니다.

| 요구사항 | 결정 | 본문을 보존하는 곳 | 이유 |
| --- | --- | --- | --- |
| CURT-026, CURT-027 (`message`, `formErrors` 옵션) | 경로 2 | `packages/form-binding/README.ko.md`(브라우저 검증) | 브라우저 바인딩의 옵션이며 서버 런타임에는 바인딩이 없습니다 |
| CURT-028부터 CURT-034까지 (`bindForm` 바인딩 오류) | 경로 2 | 같은 곳 | 브라우저 바인딩만의 오류입니다 |
| CURT-035부터 CURT-038까지 (폼에서 읽는 컨트롤 값) | 경로 2 | 같은 곳(데이터) | DOM 폼의 컨트롤을 읽으며, 다른 런타임은 DOM이 없습니다 |
| CURT-039부터 CURT-042까지 (컨트롤 이름 오류) | 경로 2 | 같은 곳(데이터) | 브라우저 제출이 보내는 DOM 컨트롤 이름입니다 |
| CURT-043부터 CURT-046까지 (검증 시점, submit, 포커스, 다시 그리기) | 경로 2 | 같은 곳(시점) | 브라우저 이벤트이며 서버는 받을 수 없습니다 |
| CURT-047부터 CURT-049까지 (렌더링한 마크업의 스크립트는 한 번 실행) | 경로 2 | `packages/html/README.ko.md`(렌더링한 마크업의 스크립트) | 스크립트는 브라우저만 실행하며 HTML 렌더러가 마크업을 씁니다 |
| CURT-051 (데이터 로드 전 각 프레임워크 화면 마운트) | 경로 2 | `packages/react`, `packages/vue`, `packages/svelte` README(프레임워크 화면) | 프레임워크 화면은 TypeScript 패키지에만 있습니다 |
| CURT-057, CURT-058 (프레임워크 화면의 포인터, 키보드, 기본 입력 이벤트) | 경로 2 | 같은 곳(프레임워크 화면) | 브라우저의 프레임워크 이벤트 처리라는 같은 이유입니다 |
| CURT-059 (다시 그려도 컨트롤 유지; Chromium, Firefox, WebKit에서 스크립트 한 번 실행) | 경로 2 | `packages/html/README.ko.md`(다시 그려도 컨트롤 유지) | 렌더링한 마크업의 브라우저 동작입니다 |
| CURT-060 (브라우저에서 서버가 렌더링한 폼을 연결) | 경로 2 | `packages/form-binding/README.ko.md`(브라우저 바인딩 인수 기준) | 브라우저 바인딩의 인수 기준입니다 |
| CURT-050 (중첩 필드 준비, 템플릿 직렬화, 독립 레코드 바인딩) | 보고 | 없음 | 모든 구현이 작성된 대로 지키는 계약이며, 공유 case가 필요합니다 |
| CURT-052 (스토어 키가 회사 키와 같으면 스토어 복사) | 보고 | 없음 | form 비교 예제의 인수 예이며 라이브러리 규칙이 아닙니다. 요구사항인지는 소유자가 정합니다 |
| CURT-053 (편집·정렬·제거·추가 후 이전 값 없음) | 보고 | 없음 | 모든 구현이 지키는 계약입니다. form state 세션이 행 작업을 시험하지만 인용에는 case 행이 필요합니다 |
| CURT-054 (저장한 seq 키와 규칙 경로) | 보고 | 없음 | 모든 구현이 지키는 계약이며 rekey와 규칙 경로 case가 필요합니다 |
| CURT-055 (잘못된 작업은 원자적으로 거부; 모든 행 삭제 뒤 추가 가능) | 보고 | 없음 | 모든 구현이 지키는 계약이며 실패하는 작업 case가 필요합니다 |
| CURT-056 (공용 검증 case를 네 언어로 실행하고 하나의 멱등 서명) | 보고 | 없음 | 모든 구현이 지키는 계약입니다. validate 제품군이 여섯 runner로 이미 실행합니다 |

옮긴 본문은 요구사항 id 없이 그대로 보존됩니다. 명세에는 옮긴 절마다 안내 한 줄을 남겼으며, 옮긴 id에 의존하지 않는
`keyPrefix` 옵션(CURT-025)은 명세에 그대로 남았습니다. 옮긴 id를 인용하는 테스트는 없습니다. `packages/form-binding`의
브라우저 테스트는 parity가 검사하지 않는 생태계 루트에 있어 선언이 필요하지 않습니다.

### 2026-10-21 — 생성된 Go table은 생성 파일 예외로 선언한다 (C16.136)

- `config/generated.json`: 예외 `packages/generator/go/interface_messages.go`와 `packages/validator/go/validator/validate/unicode_data.go`는 `go generate`가 `contracts/interface-messages.json`과 `contracts/unicode-properties.json`에서 쓰는 두 Go table을 선언합니다(C16.136). `go get`은 generator를 실행하지 않으므로(S6) Go module이 이 파일들을 배포하며, 그래서 추적합니다. 다른 언어의 생성 table에는 생성 파일 header가 없어 표시되지 않습니다. schema는 glob만 허용하므로 이유는 여기에 기록합니다. Red: 2bf1b1b5에서 `make layout-check` exit 2, 두 파일 모두 `has a generated-file header (Code generated ... DO NOT EDIT)`. Green: `make layout-check` exit 0, `no tracked file is generated`.

### 2026-10-21 — PHP와 Go generator가 generation 실패마다 error type을 검사한다 (C16.138)

- input text case의 PHP runner는 generation 실패마다 잘못된 text는 `ComposeLoadError`, 거부된 입력은 `FormError`인지 검사합니다(CUIT-034). PHP extension도 같은 test를 실행합니다. Go runner는 잘못된 text의 실패가 `*compose.ComposeLoadError`이고 다른 실패는 그렇지 않은지 검사합니다(CUIT-035). Rust generator는 generation 실패를 모두 `FormError`로 돌려주므로 그 type은 signature가 정하며, Rust runner는 바뀌지 않았습니다.

### 2026-10-21 — form template shape의 compiled template은 CURP-019와 CURP-024를 인용한다 (C16.137)

- `tests/fixtures/template-shape`의 `compiled` case는 CURP-024(한 runtime이 compile한 template을 다른 runtime이 bind한다)와 CURP-019(compile된 template은 직렬화된다)를 인용합니다. reference가 직렬화한 compile 결과를 모든 runtime이 bind하기 때문입니다. unit `template-shape`은 두 id를 인용하며 각 runner가 그 id를 이름으로 적습니다.

### 2026-10-21 — Go validator의 benchmark driver는 tools root이다 (C16.126)

- `config/parity.json`은 `benchmarks`를 tools root로 선언합니다. 이는 validator를 측정하는 benchmark의 harness이며 어떤 contract도 검사하지 않습니다. 그 driver의 Go test인 `benchmarks/validators/go/main_test.go`는 더 이상 잘못 놓인 test(R6)로 보고되지 않습니다.

### 2026-10-21 — build case와 form state root case가 런타임 요구사항을 인용한다 (C16.57-16)
### 2026-10-21 — make install-link가 손으로 준 환경 없이 저장소의 Python 패키지를 link한다 (C16.135)

- `Makefile`: `install-link`(kit의 recipe, `link.mjs link --siblings` 실행)에 `UV_PROJECT_ENVIRONMENT := $(PYTHON_VENV)`를 target별 export로 줍니다. kit의 link가 Python 환경으로 읽는 변수이며(`link.mjs` 563행), 따라서 `make install`은 `crudui-install-python`이 만든 `var/python`의 패키지를 link합니다(C16.135). Red: `env -u UV_PROJECT_ENVIRONMENT make install-link`가 exit 2이며 `NOT linked python ... no environment`를 보고합니다. Green: 같은 명령 exit 0, `make link-state-check` exit 0입니다.
- C16.134의 새 `make install-packages` 뒤의 link 상태는 `UV_PROJECT_ENVIRONMENT=$(PYTHON_VENV)`를 준 `make install-link`로 복구되며 exit 0입니다. 그 뒤 `make link-state-check`가 exit 0입니다(C16.134).
- `tests/fixtures/text-validity/buildList`의 buildList case 11개는 CURP-014(`buildList`)를, `tests/fixtures/text-validity/buildDetail`의 buildDetail case 6개는 CURP-016(`buildDetail`)을 인용합니다. 모든 case가 자기 operation을 실행합니다. form state root case `set-data-rejects-a-root-that-is-not-an-object`는 CURP-026을 인용합니다. 목록 root는 PHP에서 객체가 아니므로(호출자가 타입을 밝히며, 목록은 명시적으로 실패합니다) 이 case가 그 대응을 시험합니다.
- `tests/fixtures/form-actions/cases.json`은 generator에서 다시 생성했습니다. CURP-026 외에, C16.57-14 generator가 이미 CURP-020으로 인용하는 session case들이 커밋된 파일에도 그 id를 갖게 됩니다. `config/parity.json`의 unit은 세 id를 인용합니다.

### 2026-10-21 — make install-packages는 npm ci 뒤 svelte 도구를 설치하고 link를 실행하지 않는다 (C16.134)

- kit K428(kit 76e340de)은 `install-packages`의 npm ci 뒤에 `INSTALL_PACKAGES_EXTRA`의 target을 실행합니다. `Makefile`은 `INSTALL_PACKAGES_EXTRA := crudui-install-svelte-tools`를 두며, `make install`은 그 뒤에 `install-link`로 link합니다. svelte recipe는 더 이상 `make link`(와 `UV_PROJECT_ENVIRONMENT`)를 실행하지 않고, `crudui-install`은 더 이상 `crudui-install-svelte-tools`를 이름으로 두지 않으며(`install-packages`의 extra로만 남음), C16.117이 추가한 CI step(Python 설치와 svelte step)은 job에서 제거되어 그 job들은 `make install-packages`로 svelte 도구를 받습니다. kit copy는 `make kit-sync`로 kit 0.0.54에서 동기화했습니다(`scripts/kit/kit-bootstrap.mk`의 extra target, `install-npm.mts`의 comment, 그 kit의 PRINCIPLES P10과 P36 ~ P38). `tests/build/ci-local.test.mts`의 `install-packages installs the svelte tools after its npm ci and runs no link` test가 C16.117의 test를 대체합니다(C16.134). Red: 새 test가 03403a2f에서 실패합니다(install-packages dry run에 svelte 도구가 없음). Green: `make link-state-check` exit 0, ci-local test 18 passed, `make kit-check` exit 0, 새 worktree의 fresh `make install-packages`가 exit 0이고 svelte 도구가 설치됩니다.

### 2026-10-21 — 명시적 빈 collection이 suite에 인용되고, 그 unit test는 internal입니다 (C16.57-17)

- `tests/fixtures/text-validity/bindForm/cases.json`에 키 기반 객체가 아닌 collection 데이터(반복 group과 반복 scalar에 대한 배열, text 목록, null, text)의 거부 case 여덟 개를 추가합니다. `INVALID_FORM_INPUT`과 `Repeated data must be a keyed object: items`(CUEC-003)입니다. bindForm runner 여섯 개가 모두 통과합니다.
- `tests/fixtures/form-state/generate.mts`에 `visibility-hides-and-shows-rows-without-changing-data`를 추가합니다. show 조건이 반복 collection을 숨기고 보이게 하며, 관찰된 데이터는 매 단계 같습니다(CUEC-006). `tests/fixtures/form-render/cases.json`에는 `collection-shown-by-condition`, `collection-hidden-by-condition`(CUEC-006)과 `scalar-multiple-empty-object-has-no-rows`(CUEC-001, CUEC-004)가 추가되며, 이전 행의 중첩 형제 case와 함께 runner의 개수가 갱신됩니다.
- `packages/generator/ts/src/empty-collections.test.ts`는 ts의 internal로 선언됩니다. 이 파일의 모든 단언은 form-render, form-actions, text-bind-form의 인용된 case가 시험하는 동작입니다.

### 2026-10-21 — form render case가 중첩 행의 명시적 빈 collection을 인용한다 (C16.57-17)

- `tests/fixtures/form-render/cases.json`에 case 두 개가 `packages/react/scripts/scenario-form-render-cases.ts`를 거쳐 React reference로 렌더링되어 추가되었습니다: `nested-empty-collections-keep-sibling-order`(명시적으로 빈 중첩 collection, 형제 행은 키와 데이터 순서를 유지함; CUEC-001, CURP-027)와 `scalar-multiple-empty-object-has-no-rows`(반복되는 scalar의 명시적 빈 객체는 행 0개; CUEC-001, CUEC-004)입니다. Go, Python, Rust runner는 새 결과 case를 셉니다. `config/parity.json`의 form-render unit은 CURP-027을 인용합니다.
- `packages/generator/ts/src/empty-collections.test.ts`는 아직 undeclared 상태입니다. 객체가 아닌 데이터의 `bindForm` 거부(CUEC-003)와 데이터를 바꾸지 않는 visibility 단언(CUEC-006)에 인용된 case가 없으므로, 파일을 internal로 선언하지 않았습니다.

### 2026-10-21 — 폼 템플릿 형태는 여섯 generator의 suite unit이다 (C16.133)

- `config/parity.json`은 `tests/fixtures/template-shape`를 읽는 suite unit `template-shape`을 선언합니다. 이 unit은 CURT-092를 인용하며 TypeScript, Go, Rust, PHP, PHP extension, Python generator에 binding됩니다.
- `packages/generator/ts/src/decode-template.test.ts`는 TypeScript의 internal입니다. `decodeFormTemplate`의 JSON Pointer는 TypeScript API이므로 다른 구현은 검사하지 않습니다. Go의 형태 test는 이제 binding이며 internal이 아닙니다.

### 2026-10-21 — Python generator가 template shape fixture의 모든 case를 실행한다 (C16.132)

- `packages/generator/python/tests/test_template_shape.py`는 `tests/fixtures/template-shape`의 case를 `Generator.bindForm`, `Generator.bindButtons`, `Generator.createForm`으로 실행하며 case마다 subtest 하나를 둡니다. 이 test는 case 42개를 확인합니다. 거부는 case가 기록한 code, 메시지, 빈 위치의 `FormError`여야 합니다.

### 2026-10-21 — PHP generator와 extension이 template shape fixture의 모든 case를 실행한다 (C16.131)

- `packages/generator/php/tests/TemplateShapeTest.php`는 `tests/fixtures/template-shape`의 case를 `Generator::bindForm`, `Generator::bindButtons`, `Form`으로 실행하며, fixture case마다 PHPUnit case 하나를 둡니다. 이 test는 case 42개를 확인하고, PHP extension 아래에서도 통과합니다(`make test-php-ext CASES=TemplateShapeTest`).

### 2026-10-21 — Rust generator가 template shape fixture의 모든 case를 실행한다 (C16.130)

- `packages/generator/rust/tests/template_shape.rs`는 case마다 `FormTemplate::from_json`으로 template을 decode하고 `bindForm`, `bindButtons`, `createForm` operation을 실행합니다. `tests/fixtures/template-shape`의 case마다 trial 하나이며, 이 test는 case 42개를 확인합니다. `src/tests.rs`의 inline 형태 위반 표는 없어졌고, 선언된 template과 compile된 template의 round trip test는 남습니다.

### 2026-10-21 — Go generator가 template shape fixture의 모든 case를 실행한다 (C16.129)

- `packages/generator/go/template_shape_test.go`는 case마다 Go decoder로 template을 decode하고 `bindForm`, `bindButtons`, `createForm` operation을 실행합니다. `tests/fixtures/template-shape`의 case마다 subtest 하나이며, 이 test는 case 42개를 확인합니다. inline table은 없어졌고 widget 멤버 순서 test는 남습니다.

### 2026-10-21 — TypeScript generator가 template shape fixture의 모든 case를 실행한다 (C16.128)

- `packages/generator/ts/src/template-shape.test.ts`는 `tests/fixtures/template-shape`의 case마다 `bindForm`, `bindButtons`, `createForm`을 실행합니다. 통과하는 case는 던지지 않아야 하고, 거부하는 case는 case가 정한 code, 메시지, 빈 위치의 `FormInputError`여야 합니다. inline 형태 위반 표는 없어졌으며, widget 멤버 순서와 버튼 type 및 없는 멤버에 대한 두 검사는 남습니다.

### 2026-10-21 — 폼 템플릿 형태는 requirement CURT-092이다 (C16.127)

- `docs/spec/form-runtime.md`는 `bindForm`, `bindButtons`, `createForm`이 받는 형태를 requirement CURT-092로 정합니다. 한국어 문서도 같은 규칙을 정합니다.
- `tests/fixtures/template-shape`는 TypeScript 기준 구현이 생성한 case 42개를 담습니다. 세 operation마다 `compileForm`의 템플릿, 선택 멤버가 있는 템플릿, 형태 위반 12개를 두며, 각 위반은 `INVALID_FORM_INPUT`, `Unsupported form template`, 빈 위치로 거부됩니다.

### 2026-10-21 — PHP extension의 API test는 그 extension의 internal이다 (C16.126-1)

- `config/parity.json`은 `packages/php-ext/tests/ApiTest.php`를 php-extension의 internal로 선언합니다. 이 파일의 API 동등성 test와 value-limit test는 PHP만 가진 것을 검사합니다. 즉 extension의 API report와 library의 API report의 비교, 그리고 extension이 거부해야 하는 재귀적 PHP 배열입니다. 그 fixture 비교는 validate와 text-validity unit이 덮습니다. 검사는 이 파일을 R5 undeclared-test로 더 이상 보고하지 않습니다.

### 2026-10-21 — fresh make install-packages는 더 이상 link를 실행하지 않는다 (C16.117)

- `make install-packages`는 설치만 합니다(kit K246-2). Makefile은 `crudui-install-svelte-tools`를 더 이상 prerequisite로 두지 않습니다. 그 target은 fresh worktree에서 kit의 `npm ci`보다 먼저 실행되어 `node_modules/@polyspec/kit`이 없어 실패했습니다(C16.117). `crudui-install-svelte-tools`는 svelte 도구를 설치한 뒤 link하며, kit의 link가 `var/python`의 Python 환경을 요구하므로 `crudui-install`은 그것을 `install-kit`, `crudui-install-composer`, `crudui-install-python` 뒤에 실행합니다. link는 `UV_PROJECT_ENVIRONMENT=$(PYTHON_VENV)`을 `make link`에 넘깁니다. `make install-packages`를 실행하던 CI job은 이제 `make crudui-install-python`과 `make crudui-install-svelte-tools`를 실행합니다(`ci-passed` job은 둘 다 실행하지 않음). 그 job마다 Python 설치 하나가 더해집니다. Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/ci-local.test.mts` exit 1, 새 test `install-packages only installs; the svelte tools link after their install`이 실패하며, install-packages의 dry run에 link가 나타납니다. Green: `make link-state-check` exit 0, 같은 ci-local test 18 passed.

### 2026-10-21 — 제품군이 시험하는 런타임 요구사항을 case가 인용한다 (C16.57-14)

- render와 outline 제품군은 자기 case가 실행하는 런타임 operation을 인용합니다. `tests/fixtures/form-complete`는 CURP-013(`renderForm`), `tests/fixtures/list-render`는 CURP-015(`renderList`), `tests/fixtures/detail-render`는 CURP-017(`renderDetail`), `tests/fixtures/form-outline`은 CURP-006(`compileForm`), CURP-007(`bindForm`), CURP-021(바인딩이 record에 대해 field를 평가함)을 인용합니다. form state 세션(`form-view`, `form-history`, `form-actions`)은 각 세션이 record와 row 작업을 소유하는 instance를 만들므로 CURP-020을 인용합니다. `config/parity.json`의 unit도 같은 id를 인용합니다.
- 확장된 제품군의 모든 runner가 한 번씩 통과합니다. TypeScript, Go, Python, Rust, PHP library runner와 PHP extension runner입니다.
- 아직 인용하지 않은 id와 그 이유입니다. CURP-001부터 CURP-005까지는 각각 네 가지 기능을 명시하는 언어별 행입니다. validation과 composition 부분은 validate 제품군이 시험하지만, 다섯 런타임에서 모든 기능을 함께 실행하는 제품군은 없으며, 기능별 인용에 대한 판정이 필요합니다. CURP-008과 CURP-009(`bindButtons`, `formButtonsHtml`)는 실행하는 제품군이 없고, 추가하려면 여섯 runner에 새 operation이 필요합니다. CURP-014와 CURP-016(`buildList`, `buildDetail`)은 text-validity case만 실행하며, 그 파일은 C16.111을 기다립니다. CURP-019(컴파일된 template의 직렬화와 캐시)는 직렬화된 컴파일 출력을 비교하는 제품군이 없습니다. CURP-023(브라우저 바인딩)은 JavaScript 브라우저 런타임만 가지는 단일 구현 요구사항이므로 판정을 기다립니다. CURP-024(한 런타임이 컴파일한 template을 다른 런타임이 바인딩함)는 그런 제품군이 없으며 C16.111을 기다립니다. CURP-025(ordered JSON 전송)는 ordered-json 저장소에서 시험합니다. CURP-026(PHP 배열이 객체인지 목록인지)은 C16.57-13이 main에 들어간 뒤 form state 세션의 PHP root case가 인용합니다.

### 2026-10-21 — Python validator가 text-validity의 value-graph case를 binding한다 (C16.57-15-1)

- `config/parity.json`: unit `text-validity-value-graphs`가 Python runner `packages/validator/python/tests/test_text_validity.py`를 binding합니다. 그 `test_value_graph_cases`는 `value-graphs.json`의 12개 case를 public validator로 실행하므로 parity check가 Python binding 부재(R2)를 더 이상 보고하지 않습니다(C16.57-15-1). Python runner는 binding 전에 모든 case를 통과했으므로 Python 결함은 없습니다. Red: 기본 상태에서 `make item-red ID=C16.57-15-1`, R2 grep이 exit 1입니다. Green: 같은 grep이 exit 0; `python -m unittest tests.test_text_validity` 4 OK(value graph case 포함); `make lint-python` exit 0입니다.

### 2026-10-21 — input-text limit의 text-validity unit이 그 case의 id를 인용한다 (C16.57-15)

- `config/parity.json`: unit `text-validity-validate`, `text-validity-validate-list`, `text-validity-validate-detail`은 실패 case의 CUIT-032, CUIT-033, CUIT-035를 인용하고, suite unit `text-validity-value-graphs`는 `tests/fixtures/text-validity/value-graphs.json`에 대해 CUIT-021, CUIT-022, CUIT-029 ~ CUIT-033, CUIT-035를 인용합니다. 이 unit은 그 file을 읽는 TypeScript, PHP, PHP extension, Go, Rust runner의 binding을 가집니다. Python runner는 그 file을 읽지 않으므로 R2가 그 binding의 부재를 보고합니다(C16.57-15). Red: HEAD에서의 record, `make item-red ID=C16.57-15 BEFORE=HEAD`: grep Verification이 exit 1입니다. R13이 이 id들을 인용되지 않은 것으로 보고하기 때문입니다. Green: `make item-test ID=C16.57-15`, unit이 id를 인용하면 grep이 exit 0입니다.

### 2026-10-21 — input-text case가 시험하는 limit와 오류 타입 요구를 인용한다 (C16.57-15)

- `tests/fixtures/text-validity/value-graphs.json`의 case는 `requirements` 배열을 가집니다. 노드와 중첩 limit CUIT-021과 CUIT-022, limit을 넘는 value의 실패 CUIT-029 ~ CUIT-031, 그리고 TypeScript, PHP, Go runner가 각 실패를 class로 대조하는 검증 오류 class CUIT-032, CUIT-033, CUIT-035입니다(C16.57-15). `validate`, `validateList`, `validateDetail`의 실패 case도 같은 이유로 CUIT-032, CUIT-033, CUIT-035를 인용합니다(C16.57-15). Red: CUIT-021, CUIT-022, CUIT-029 ~ CUIT-033, CUIT-035를 인용한 case가 없었습니다. Green: `node node_modules/@polyspec/kit/dist/run-tests.mjs vitest --cwd packages/validator/ts -- src/text/text-validity.conformance.test.ts` 53 passed; PHP validator `TextValidityConformanceTest.php` 45 passed; `make test-php-ext CASES=TextValidityConformanceTest` exit 0, 45 passed; Python `tests.test_text_validity` 4 OK; Go `validator/validate`의 text fixture 48 passed; Rust `text_validity_conformance` 5 passed. 인용하지 않았고 보고합니다: CUIT-034(PHP 생성 오류)와 CUIT-035, CUIT-036의 생성 부분(native generator runner는 생성 실패의 code, message, location을 검사하며 class는 검사하지 않음). CUIT-036은 검증 부분도 인용하지 않았습니다(Rust runner는 실패를 code로 대조하고, load class는 한 case에서만 검사함). CUIT-029 ~ CUIT-031은 options와 rows 인수에 대해 인용하지 않았습니다(value-graph case는 `spec`, `files`, `data` 아래에만 graph를 둘 수 있음).

### 2026-10-21 — form 버튼 case는 parity suite이고, 버튼 계약은 fixture와 runner를 적는다 (C16.124)

- `config/parity.json`은 `tests/fixtures/buttons/cases.json` 위에 suite `buttons`를 선언하며, runner는 여섯 개(TypeScript, Go, Python, Rust, PHP, PHP extension)입니다. 요구사항은 CURP-008(`bindButtons`)과 CURP-009(`formButtonsHtml`)이며, suite의 모든 case가 이를 인용합니다. 버튼의 속성(CUMK-006과 CUMK-007)은 인용하지 않습니다. 어떤 case의 기대 출력에도 footer 그룹이 없어서 그 id의 조건을 만족하는 case가 없습니다.
- `contracts/features.json`은 `bindButtons`와 `formButtonsHtml`의 fixture와 runner를 적고, 오류를 TypeScript reference가 던지는 클래스인 `FormInputError`로 적습니다(이전 항목은 `TypeError`). `manifest:docs`가 feature 계약 페이지를 다시 생성했고, `manifest:check`가 통과합니다.

### 2026-10-21 — PHP library와 extension이 form 버튼 case를 실행하고, 알 수 없는 타입의 버튼과 목록이 아닌 값을 거부한다 (C16.123)

- `packages/generator/php/tests/ButtonsConformanceTest.php`는 `tests/fixtures/buttons`의 case 22개를 PHP library로 실행하고, `make test-php-ext CASES='ButtonsConformanceTest'`는 extension으로 실행합니다. 각 관찰은 JSON 텍스트로 기대값과 같아야 하므로 속성 순서도 검사합니다.
- `Generator::bindButtons`는 submit, reset, button, link 중 어느 것도 아닌 타입의 버튼을 `Invalid button type: <type>`으로 거부하며, extension도 같습니다. `Generator::formButtonsHtml`과 extension은 버튼을 임의의 값으로 받고, 목록이 아닌 값을 PHP TypeError 대신 `Form buttons must be a list`로 거부합니다.

### 2026-10-21 — Rust generator가 form 버튼 case를 실행하고, 알 수 없는 타입의 버튼과 목록이 아닌 값을 거부한다 (C16.122)

- `packages/generator/rust/tests/buttons.rs`는 `tests/fixtures/buttons`의 case 22개를 실행합니다. `bind_buttons`와 `form_buttons_html`의 관찰은 JSON 텍스트로 기대값과 같아야 하므로 속성 순서도 검사합니다.
- `bind_buttons`는 submit, reset, button, link 중 어느 것도 아닌 타입의 버튼을 TypeScript reference처럼 `Invalid button type: <type>`으로 거부합니다. `form_buttons_html`은 버튼을 JSON 값으로 받고, 목록이 아닌 값을 `Form buttons must be a list`로 거부합니다. native generator 프로그램은 요청 값을 그대로 넘깁니다.

### 2026-10-21 — Python generator가 form 버튼 case를 실행하고, 알 수 없는 타입의 버튼을 거부한다 (C16.121)

- `packages/generator/python/tests/test_buttons.py`는 `tests/fixtures/buttons`의 case 22개를 실행합니다. `bindButtons`와 `formButtonsHtml`의 관찰은 JSON 텍스트로 기대값과 같아야 하므로 속성 순서도 검사합니다.
- `bindButtons`는 compile 없이 주어진 template의 버튼 타입이 submit, reset, button, link 중 어느 것도 아니면 `Invalid button type: <type>`으로 거부합니다(TypeScript reference와 같음). 이전에는 compile 단계의 assertion만 검사했습니다.

### 2026-10-21 — Go generator가 form 버튼 case를 실행하고, 알 수 없는 타입의 버튼과 목록이 아닌 값을 거부한다 (C16.120)

- `packages/generator/go/buttons_conformance_test.go`는 `tests/fixtures/buttons`의 case 22개를 실행합니다. `BindButtons`와 `FormButtonsHTML`의 관찰은 JSON 텍스트로 기대값과 같아야 하므로 속성 순서도 검사합니다.
- `FormButtonsHTML`은 버튼을 `any`로 받고, 목록이 아닌 값을 `Form buttons must be a list`로 거부합니다(TypeScript reference와 같음). `BindButtons`는 link, submit, button, reset 중 어느 것도 아닌 타입의 버튼을 reference 메시지 `Invalid button type: <type>`으로 거부합니다.

### 2026-10-21 — TypeScript generator가 form 버튼 case를 실행한다 (C16.119)

- `packages/generator/ts/src/buttons.conformance.test.ts`는 `tests/fixtures/buttons`의 case 22개를 실행합니다. 각 `bindButtons`와 `formButtonsHtml`의 관찰은 JSON 텍스트로 기대값과 같아야 하므로 속성 순서도 검사합니다.

### 2026-10-21 — form 버튼 case를 TypeScript reference가 쓴다 (C16.118)

- `tests/fixtures/buttons`는 `bindButtons`(CURP-008)와 `formButtonsHtml`(CURP-009)의 case 22개를 가집니다. 기본 submit 버튼, 네 언어의 선언된 버튼, 그대로 유지되는 link href, 지역화된 text, template, 버튼 타입, 언어 옵션의 거부, 속성이 순서대로 있는 버튼 마크업, 그 이스케이프, 목록, 항목, tag, 속성, class의 거부를 다룹니다. `generate.mts`가 TypeScript reference에서 `cases.json`을 쓰며, README가 명령을 적습니다.
- `config/rebuild.json`과 `config/knip-entries.json`은 다른 fixture generator와 같은 방식으로 generator를 등록합니다.

### 2026-10-21 — make hooks-check가 CI 검사에서 실행되고, AGENTS.md 규칙이 검사를 이름으로 든다 (C16.44)

- `make rules-check`는 `make hooks-check`가 건너뛸 수 없는 지점에서 실행되지 않는다는 규칙에서 실패했습니다. 앞선 원인, 즉 TARGETS를 준 `make ci-targets`가 뒤의 호출을 건너뛰던 문제는 kit(da0d0e07, K312)가 고쳤습니다.
- `.github/workflows/ci.yml`의 첫 job은 `make ci-targets TARGETS`에 `hooks-check`를 실행하고, Makefile의 `CI_TARGETS`도 `typecheck` 뒤에 같은 순서로 이를 적으므로 규칙이 이 실행에 닿습니다.

### 2026-10-21 — layout check가 native program의 Go test와 Composer vendor folder를 받아들인다 (C16.115)

- `config/layout.yml`: native Go program의 S9 exception이 그 test file `tests/native-generators/programs/go/main_test.go`를 main.go와 같은 이유로 덮습니다. 이 test는 Go generator를 구동하는 program의 test입니다(C16.115). `config/php-lint`, `packages/generator/php`, `packages/php-ext`, `packages/validator/php`, `tests/release-install/composer`의 `.gitignore`가 `/vendor/`를 무시합니다. K372의 generated-files 검사가 요구하는 항목입니다(C16.115). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make layout-check` exit 2. `main_test.go`는 TypeScript 기반의 S9 infrastructure로, vendor folder는 무시되지 않아 실패합니다(K372). `kit link`가 쓰는 root의 `composer.link.json`과 `composer.link.lock`은 git이 무시합니다(K304-1). main checkout에 대한 읽기 전용 `alint` 실행은 `main_test.go`만 보고합니다. 이 worktree에서는 검사 전에 두 file을 옮겼고, `make link`가 다시 만듭니다. Green: 같은 명령 exit 0.

### 2026-10-21 — kit copy들이 kit 0.0.54를 따른다 (C16.112)

- kit copy는 `.oxlintrc.json`(preserve-caught-error, K334), `phpcs.xml.dist`(Generic.PHP.NoSilencedErrors, K334), `PRINCIPLES.md`와 `PRINCIPLES.ko.md`(gate `suppression-check`, K334), `scripts/kit/bootstrap/install-mise.mts`(worktree의 공유 install, K387, 전역 설정 root의 신뢰, K397-1), `config/commit-identity.json`(commit identity, K405), 생성된 hook `.githooks/prepare-commit-msg`(K380-2, K380-3)입니다. 이 copy들은 kit 0.0.54(9b8b4444)의 것이며, `make kit-sync`와 `make hooks`가 가져옵니다(C16.112). Makefile은 `CHECK_TARGETS`에 `suppression-check`를 더하고(K334), svelte 도구 install 뒤에 link를 둡니다(K349). gate를 위해 코드를 고쳤습니다. Rust `#[allow]` 16곳은 줄마다 이유를 한 줄에 둡니다(gate는 한 줄을 읽습니다). Python `noqa`와 `eslint-disable` 2곳은 gate의 형식으로 이유를 적습니다. `FormTest.php`는 `@` 대신 libxml 오류 처리로 `loadHTML`을 읽고, `scripts/repository-files.mts`의 새 오류는 cause를 가집니다. 검사: `make kit-check`, `make suppression-check`, `make lint-php`, `make lint-ts`, `make lint-rust`, `make lint-python`과 `repository-files.mts`의 owner test가 exit 0입니다. `make link-state-check`는 다른 worktree에 남은 병합된 branch 17개를 보고하고(`make worktree-prune`), `make layout-check`와 `make rules-check`는 main이 가진 finding을 보고합니다(루트의 link file과 C16.79의 `tests/native-generators/programs/go/main_test.go`, C16.68의 `AGENTS.md:18`).
- `config/layout.kit.yml`은 link 출력 `composer.link.json`과 `composer.link.lock`을 root 파일로 선언하므로(K423, kit 03c3c405) link된 worktree도 main처럼 `make layout-check`를 통과하며, `config/owner-checks.json`은 `config/commit-identity.json`을 kit의 다른 사본과 함께 소유합니다(C16.112).

### 2026-10-21 — 확장 API 테스트가 빌드된 모듈을 찾고 보고서 호출이 API와 맞는다 (C16.116)

- `packages/php-ext/tests/ApiTest.php`는 `make build-php-ext`가 모듈을 쓰는 위치(Makefile이 `PHP_EXTENSION`으로 정하는 기본값인 `var/php-ext/polyspec_crudui.so`)에서 확장을 찾고, `packages/php-ext/modules`에서 찾지 않습니다.
- `packages/php-ext/tests/ApiReport.php`는 `renderDetail`의 옵션으로 배열을 전달하고(API는 `array`로 선언), 빈 상세 specification이 `Detail specification must be an object`로 실패하는 것을 기대하며(library와 extension이 모두 빈 배열을 객체가 아니라고 보고합니다), `renderList`의 빈 `data` 옵션을 더 이상 허용하지 않습니다(C16.87의 display 규칙은 그곳에서 빈 배열을 객체가 아니라고 봅니다).

### 2026-10-21 — form state suite가 바인딩 데이터 오류 CURT-001부터 CURT-003까지를 인용한다 (C16.57-13)

- `tests/fixtures/form-state/generate.mts`의 form state 세션이 `tests/fixtures/form-actions/cases.json`에 `setData`의 root, group row, 반복 값 메시지에 대한 case 세 개를 추가하며, PHP library와 extension은 수정 C16.57-13-1(TypeError 대신 `Form data must be an object`)을 통해 이를 통과합니다.

### 2026-10-21 — 객체가 아닌 PHP 폼 데이터는 TypeError가 아니라 바인딩 메시지로 실패한다 (C16.57-13-1)

- PHP library와 extension은 `Form::__construct`, `Form::setData`, `Generator::bindForm`, `Generator::bindButtons`에서 폼 데이터를 `mixed`로 받습니다. `stdClass`, 연관 배열, 빈 배열은 객체이며, 비어 있지 않은 목록 배열과 그 밖의 타입의 값은 `INVALID_FORM_INPUT`과 `Form data must be an object`(CURT-001)로 실패합니다. 이전에는 PHP TypeError가 발생했습니다. 공통 검사는 `packages/generator/php/src/Internal/Value.php`의 `Value::formData`와 `packages/php-ext/src/crudui.c`의 `form_data_object`이며, stub과 `polyspec_crudui_arginfo.h`는 매개변수를 `mixed`로 선언합니다.
- `docs/spec/form-runtime.md`와 `form-runtime.ko.md`는 바인딩이 데이터를 거부하는 곳에서 이 규칙을 적습니다.
- C16.57-13을 완료합니다: PHP `FormStateTest`가 새 바인딩 case(CURT-001부터 CURT-003)를 실행하고 통과하며, `packages/php-ext/tests/ApiReport.php`는 `null` 데이터에 TypeError 대신 바인딩 실패를 기대합니다.

### 2026-10-21 — form state 세션이 setData의 바인딩 데이터 오류를 시험한다 (C16.57-13)

- `tests/fixtures/form-state/generate.mts`에 바인딩이 거부하는 데이터로 record를 바꾸는 세션 세 개를 추가합니다. root가 text, `null` 또는 list인 경우(CURT-001, `Form data must be an object`), group row가 text인 경우(CURT-002, `Group data must be an object: teams.{key}`), 반복 값이 list 또는 text인 경우(CURT-003, `Repeated data must be a keyed object: teams`)입니다. reference는 코드 `INVALID_FORM_INPUT`과 메시지를 기록하며, record와 history는 그대로 남습니다. `tests/fixtures/form-actions/cases.json`에 이 case 세 개가 추가되며(9개에서 12개), `config/parity.json`의 `form-actions` unit이 CURT-001, CURT-002, CURT-003을 인용합니다.
- PHP extension의 form state engine 테스트는 form 함수가 링크하는 `history.c`와 `view.c`를 소스 목록에 포함합니다.
- Red: PHP library의 `Form::setData`는 매개변수 타입이 `array|stdClass`이므로 text나 `null`에 대해 PHP TypeError를 던집니다. 이 결함은 C16.57-13-1로 등록되었습니다.

### 2026-10-21 — TypeScript의 choice group과 hidden path unit test는 internal이다 (C16.114)

- `config/parity.json`은 `packages/validator/ts/src/choice-groups.test.ts`와 `packages/validator/ts/src/hidden-paths.test.ts`를 TypeScript의 internal로 선언합니다. 이들의 검사는 `tests/fixtures/validate`를 거쳐 validate suite가 덮습니다. choice group case는 CUVR-011과 CUVR-050을, hidden case는 CUVR-017과 CUSC-055의 `hidden` member를 덮고, 잘못된 data 형태 오류는 `input-root-data-not-object`가 덮습니다. 검사는 이들을 R5 undeclared-test로 더 이상 보고하지 않습니다.

### 2026-10-21 — TypeScript file이 oxlint를 통과한다 (C16.107-1)

- `make lint-ts`가 보고한 TypeScript file을 rule 변경, comment, 제외 없이 코드에서 고쳤습니다(C16.107-1). `scripts/check-doc-coverage.test.mts`, `scripts/php-doc-coverage.test.mts`, `scripts/check-schema.mts`, `scripts/package-install-pack.mts`의 쓰지 않는 선언과 import를 지웠고, `scripts/test-commands.mts`는 `JSON.parse`의 값을 `unknown`으로 적어 shape guard가 좁히게 했으며, `tests/fixtures/form-state/generate.mts`는 step 인수를 type guard로 읽고 행 action 이름을 string으로 비교합니다. generator가 쓰는 fixture는 바뀌지 않습니다. 발견은 `no-unused-vars`(oxlint의 기본 correctness rule, kit이 바꾸지 않음), 복사된 `.oxlintrc.json`의 `no-base-to-string`과 `no-unsafe-type-assertion`(kit K170, 2026-10-15, type-aware rule을 TypeScript에 적용)과, main이 2026-10-21에 합친 scripts(C16.11-3, C16.57-10)에서 왔습니다. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make lint-ts` exit 2, oxlint 10 problem(`make crudui-build`를 하지 않은 첫 실행은 빌드되지 않은 package의 typecheck도 실패했습니다). Green: 같은 명령 exit 0; owner test `scripts/check-doc-coverage.test.mts`, `scripts/php-doc-coverage.test.mts`, `scripts/json-schema.test.mts`, `tests/build/package-install-pack.test.mts`가 통과합니다. `tests/build/test-commands.test.mts`는 `no Makefile target takes a target that runs tests as a prerequisite`(`docs-check: crudui-docs-check`) 하나가 실패하며, HEAD scripts에서도 실패합니다.

### 2026-10-21 — PHP file이 phpcs 줄 길이 규칙을 통과한다 (C16.107)

- `make lint-php`가 보고한 PHP file들을 120자로 줄바꿈했습니다(C16.107). `packages/generator/php/src/Form.php`(`normalizeFields`), `src/Internal/Lists.php`, test `DetailRenderConformanceTest.php`, `ListRenderConformanceTest.php`, `FormCompleteConformanceTest.php`, `LayoutTree.php`, `DetailTest.php`, `DisplayRulesTest.php`, `packages/php-ext/tests/ApiReport.php`, `packages/validator/php/tests/Validate/TextValidityConformanceTest.php`, `UniqueValuesTest.php`의 docblock과 comment를 줄바꿈하고, 코드 줄은 값을 바꾸지 않고 나눴습니다(`TextValidityConformanceTest`의 정규식은 `|`에서 이어 붙입니다). 이 규칙은 kit의 PSR-12 `phpcs.xml.dist`(kit K77, 2026-10-13)이며, 줄은 main이 2026-10-20과 2026-10-21에 합친 file(C16.70, C16.87, C16.89 ~ C16.97)에서 왔습니다. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make lint-php` exit 2, 17 file의 Generic.Files.LineLength warning 30개. Green: 같은 명령 exit 0; owner test `DisplayRulesTest`, `DetailTest`, `DetailRenderConformanceTest`, `ListRenderConformanceTest`, `FormCompleteConformanceTest`, `FormTest`는 305 test, `TextValidityConformanceTest`와 `UniqueValuesTest`는 48 test가 통과하고, `packages/php-ext/tests/ApiReport.php`는 exit 0입니다.

### 2026-10-21 — validity unit가 TypeScript engine test에 묶이고 meta-schema test는 internal로 선언한다 (C16.106)

- C16.57-7이 남긴 binding 선택을 대체합니다. list-validity와 detail-validity의 TypeScript binding은 이제 engine test `validate-list.conformance.test.ts`와 `validate-detail.conformance.test.ts`이며, 다른 다섯 구현이 engine test를 binding하는 것과 같습니다. spec-validity의 TypeScript binding은 forbidden-scan engine test에 그대로 둡니다.
- `list-metaschema.conformance.test.ts`, `detail-metaschema.conformance.test.ts`, `form-metaschema.conformance.test.ts`는 TypeScript에 internal입니다. 이들은 TypeScript CLI의 meta-schema를 Ajv로 `contracts/schema`와 대조하며, 다른 구현은 meta-schema를 검사하지 않습니다.
- `packages/validator/ts/src/text/json.test.ts`는 C16.99가 Rust test를 선언한 것처럼 TypeScript 명세 parser의 unit test로서 TypeScript에 internal입니다.

### 2026-10-21 — 공유 suite가 덮는 TypeScript와 Python 테스트 파일은 internal이다 (C16.105)

- `config/parity.json`은 테스트 파일 23개를 internal로 선언합니다. TypeScript 22개와 Python 1개이며, 각 이유는 행동을 덮는 공유 suite와 unit의 이름을 적습니다. generator TypeScript 파일 14개는 form-render, list-render, detail-render, form-complete 아래에 있고, 다만 `css.test.ts`는 자기 구현 안에서만 쓰는 internal 파일입니다. validator TypeScript 파일 8개는 validate 아래에 있고, 다만 `types.roundtrip.test.ts`는 자기 구현 안에서만 쓰는 internal 파일입니다. `packages/validator/python/tests/test_pattern_states.py`는 validate 아래에 있습니다.
- 검사는 이 23개 파일을 R5 undeclared-test로 더 이상 보고하지 않습니다. 남은 TypeScript와 Python 파일 26개는 compose, expr, interface-messages, unicode-data 파일이거나 분류 기록의 gap이며, 뒤의 행에서 다룹니다.

### 2026-10-21 — Go input text runner가 fixture를 읽는 type assertion을 모두 처리한다 (C16.108-1)

- `packages/generator/go/input_text_test.go`는 option과 argument를 읽는 함수에 `t`를 넘깁니다. 예상과 다른 type의 option이나 argument는 case 이름과 함께 실패하고, 없거나 null인 값은 기본값이므로 `ok` 값을 버리지 않으며 `errcheck`가 보고하지 않습니다.

### 2026-10-21 — input text fixture의 generator case가 요구사항을 적고, 다섯 suite unit이 이를 binding한다 (C16.111)

- `tests/fixtures/text-validity`의 generator case 파일 다섯 개(`compileForm`, `bindForm`, `createForm`, `buildList`, `buildDetail`)는 각 case가 검사하는 요구사항을 `requirements`에 적습니다. `compileForm`은 CUIT-010, `bindForm`과 action이 없는 `createForm` case는 CUIT-011, `buildList`는 CUIT-012, `buildDetail`은 CUIT-013이며, `createForm`의 action case는 method에 따라 CUIT-014부터 CUIT-020까지입니다.
- `config/parity.json`은 case 파일마다 suite unit 하나를 선언하며, TypeScript와 Python generator test, Go, PHP, PHP extension, Rust runner의 여섯 binding을 둡니다. CUIT-010부터 CUIT-020까지는 이제 unit이 인용하므로 검사는 이를 추적되지 않은 요구사항으로 보고하지 않습니다.

### 2026-10-21 — Rust generator가 text-validity fixture의 모든 case를 실행한다 (C16.110)

- `packages/generator/rust/tests/input_text.rs`는 `tests/fixtures/text-validity`의 generator fixture 다섯 개의 case 48개를 public generator API로 실행하며, case마다 libtest-mimic trial 하나를 둡니다. case의 member는 unpaired surrogate를 보존하는 `polyspec_crudui_validator::text::JsonText`로 읽고, 각 operation은 member를 값으로 decode하기 전에 generator `text` 검사로 `docs/spec/input-text.md`의 순서대로 text를 먼저 검사합니다.

### 2026-10-21 — PHP generator가 text-validity fixture의 모든 case를 실행한다 (C16.109)

- `packages/generator/php/tests/InputTextTest.php`는 `tests/fixtures/text-validity`의 generator fixture 다섯 개의 case 48개를 public `Generator`와 `Form` class로 실행하며, fixture case마다 PHPUnit case 하나를 둡니다(`testGeneratorCase`). case는 `JsonText`로 읽으며, 이는 unpaired surrogate를 유효하지 않은 UTF-8 text로 보존합니다. test는 PHP extension 아래에서도 통과합니다(`make test-php-ext CASES=InputTextTest`).

### 2026-10-21 — Go generator가 text-validity fixture의 모든 case를 실행한다 (C16.108)

- `packages/generator/go/input_text_test.go`는 `tests/fixtures/text-validity`의 generator fixture 다섯 개(`compileForm`, `bindForm`, action이 있는 `createForm`, `buildList`, `buildDetail`)의 case 48개를 public generator API로 실행하며, case마다 subtest 하나를 둡니다. case는 `compose.DecodeOrdered`와 `compose.DecodeRawMembers`로 읽어 unpaired surrogate를 유효하지 않은 UTF-8 text로 보존합니다.
- case가 JSON text로 주는 template은 `FormTemplate`으로 decode하기 전에 decode된 text를 먼저 검사합니다(`CheckBindText`의 설명과 같습니다). 그래서 member 이름에 잘못된 text가 있는 template은 shape이 아니라 text 실패를 보고합니다.

### 2026-10-21 — Rust generator와 validator가 embed된 contract를 include_str로 검사한다 (C16.58-13)

- `packages/generator/rust/src/messages/mod.rs`와 `packages/validator/rust/src/validate/unicode/mod.rs`는 embed된 table과 비교하는 test에서 contract를 `include_str!`로 embed합니다. 각자 같은 path, read, parse preamble로 run time에 읽던 것을 대신합니다(C16.58-13). contract가 없거나 잘못되어도 test는 여전히 실패하며, 이제 compile 시점이거나 같은 parse panic으로 실패합니다. duplication check는 두 preamble의 clone을 없앴습니다. Red: `make duplication-check` exit 2, 35 clone(두 test module의 preamble clone 포함: `packages/generator/rust/src/messages/mod.rs` 134-140 행과 `packages/validator/rust/src/validate/unicode/mod.rs` 76-82 행); green: `embedded_data_matches_the_contract`(validator)와 `embedded_messages_match_the_contract`(generator)가 각각 1 test passed, 두 파일의 `rustfmt --check`는 아무것도 보고하지 않습니다.

### 2026-10-21 — validator가 JSON object의 member를 하나의 walker로 디코딩한다 (C16.58-12)

- `packages/validator/go/validator/types.go`에 `objectOpen`, `objectEntries`, `objectEntry`를 더했습니다. 이들은 JSON object를 문서 순서의 member로 token 단위 순회합니다. `orderedRawObject`(반복된 key는 첫 자리와 마지막 값을 갖고, object가 아니면 오류)와 `objectMembers`(object가 아니면 member가 없고, 모든 member를 유지)가 이것을 쓰며 각자의 규칙을 그대로 둡니다(C16.58-12). duplication check는 두 함수 사이의 clone을 없앴습니다. Red: `make duplication-check` exit 2, 35 clone(`types.go` 991-998 행과 1320-1327 행의 clone 포함); green: validator의 선택된 owner test(`TestRoundTrip`, `TestForbidden`, `TestXComment`, `TestNonCanonical`, `TestClosed`, `TestDesign`, `TestValidateExtra`, `TestNested`, `TestRule`, `TestTopLevel`, `TestOptions`, 19 passed) exit 0; `go vet ./validator` exit 0; `gofmt -l`은 아무것도 보고하지 않습니다.

### 2026-10-21 — form-comparison Rust server가 lock 열기와 test fixture를 공유한다 (C16.58-10)

- `examples/form-comparison/servers/rust/src/repository.rs`에 `open_lock`을 더했습니다. 이 함수는 store file의 lock file을 엽니다. `Repository::transaction`과 `records.rs`의 `Store::locked`가 모두 이것을 씁니다(C16.58-10). `tests.rs`에는 React create form의 repository를 만드는 `react_repository`와 그 native form 제출을 보내는 `post_native`를 더했고, 네 test가 되풀이하던 `Repository` literal과 form POST block을 대신합니다. duplication check는 example의 Rust clone을 없앴습니다(변경 전 38 clone, 후 35 clone; 수에는 C16.58-9의 변경이 포함됩니다). Red: `make duplication-check` exit 2, 38 clone(example Rust clone 세 개 포함); green: 같은 check가 exit 2, 35 clone이며 이 파일들에는 없습니다; Rust owner test(`tests::`, 18 passed)가 exit 0입니다. `rustfmt --check`는 `repository.rs`와 `tests.rs`에서 차이가 없고, `records.rs`의 차이(`specs`)는 HEAD에도 있습니다.

### 2026-10-21 — form-comparison script와 frame이 entry guard, native form field, 결과 payload를 공유한다 (C16.58-9)

- `examples/form-comparison/src/entry-point.mjs`(신규)는 script가 entry point일 때 `main`을 실행하는 guard를 담고, `check-pipeline.mjs`와 `local-verification.mjs`가 그것을 부릅니다. `src/native-fields.mjs`(신규)는 제출의 native form field를 담고, `check-servers.mjs`와 `src/frame.mjs`가 그것으로 제출을 만듭니다. `src/unit-pool.mjs`는 unit과 operation 결과의 value와 error 부분을 `resultPayload` 하나로 만들며, 각 결과의 key 순서는 바뀌지 않았습니다(C16.58-9). duplication check는 그 clone들을 없앴습니다(변경 전 41 clone, 후 38 clone). Red: `make duplication-check` exit 2, 41 clone(guard, native field, 결과 payload 포함); green: 같은 check가 exit 2, 38 clone이며 이 파일들에는 없습니다; owner test `src/unit-pool.test.mjs`(7 passed), `check-servers.test.mjs`(4 passed), `check-verification.test.mjs`(8 passed)가 exit 0입니다.
- `config/rebuild.json`은 `examples/form-comparison/src/entry-point.mjs`와 `native-fields.mjs`를 다른 module과 같이 form comparison example의 policy module로 분류합니다(C16.58-9).

### 2026-10-21 — form-comparison stage page들이 form의 binding 평가를 공유한다 (C16.58-8)

- `examples/form-comparison/src/form-views.ts`에 `evaluateBinding`을 더했습니다. 이 함수는 template을 record data와 view 상태에 bind합니다. `pages/stage-svelte.svelte.ts`와 `pages/stage-vue.ts`는 같은 평가를 각자 가지는 대신 이 함수를 씁니다(C16.58-8). duplication check는 그 clone을 없앴습니다(변경 전 42 clone, 후 41 clone). page의 동작은 같습니다. Red: `make duplication-check` exit 2, 42 clone(두 page 사이의 stage clone); green: 같은 check가 exit 2, 41 clone이며 stage clone이 없습니다; `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- examples/form-comparison/public/pipeline.test.mjs` exit 0, 9 passed; `node examples/form-comparison/build.mjs <절대 경로>`가 page를 bundle합니다. adapter의 mount와 hydrate wrapper는 남깁니다. `src/adapter-completion.test.mjs`가 각 adapter가 자기 signature로 그것을 선언하기를 요구하기 때문입니다.

### 2026-10-21 — PHP table generator들이 contract reader와 source writer를 공유한다 (C16.58-7)

- `scripts/generator-contract.php`에 `crudui_generate`를 더했습니다. 이 함수는 `contracts/<name>.json`을 읽고 source를 만들어 출력하거나 씁니다. 모든 table generator가 하던 일입니다. `packages/generator/php/scripts/generate-interface-messages.php`와 `packages/validator/php/scripts/generate-unicode-data.php`는 table builder를 넘겨 이 함수를 부르며, 둘이 공유하던 header와 `--stdout` 설명은 한 곳에만 있습니다(C16.58-7). duplication check는 두 script가 공유하던 PHP header clone을 없앴습니다(변경 전 43 clone, 후 42 clone). 출력: 두 generator의 `php <script> --stdout`은 전과 같은 byte를 출력하며, 생성된 `src/Internal/InterfaceMessages.php`와 `src/Values/UnicodeData.php`는 바뀌지 않았습니다. Red: `make duplication-check` exit 2, 43 clone(두 script 사이의 PHP header clone); green: 같은 check가 exit 2, 42 clone(script clone 없음); `tests/Internal/InterfaceMessagesTest.php`와 `tests/Values/UnicodeDataTest.php`의 `phpunit`이 통과합니다.

### 2026-10-21 — Tailwind stylesheet는 crudui.css를 components layer로 가져오는 CSS 기본 import이다 (C16.12)

- `packages/generator/ts/styles/crudui.tailwind.css`와 `packages/generator/ts/scripts/write-tailwind-styles.mjs`를 지웠습니다. page는 `tailwindcss` 뒤에 `@polyspec/crudui-generator-core/crudui.css`를 `layer(components)`로 import합니다. 이것은 CSS와 Tailwind CSS 4가 제공하는 기능입니다(C16.12). package는 더 이상 `./crudui.tailwind.css`를 export하지 않고, `test:forms`는 script를 실행하지 않습니다. `tests/tailwind-styles.test.mts`는 같은 `crudui.css` import를 layer `components`로 compile합니다. compile된 CSS는 같습니다: test 입력은 변경 전후 모두 21,286 byte로 compile되며 두 출력은 다른 줄이 없습니다. `config/rebuild.json`은 script의 항목을 뺐고, `docs/spec/form-markup.ko.md`, `docs/operations/forms.ko.md`, `docs/features.ko.md`는 그 import를 설명합니다. Red: 생성 file과 import의 compile 결과(package build로 비교)가 같았습니다. Green: `make rebuild-check` exit 0, `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/tailwind-styles.test.mts` exit 0, 1363 passed.

### 2026-10-21 — date와 dateISO 규칙은 CUVR-058과 CUVR-059가 나열한 layout을 여섯 구현 모두에서 받아들인다 (C16.57-12-2)

- `docs/spec/validation-rules.md`에 CUVR-058(`date`)과 CUVR-059(`dateISO`)를 추가합니다. `date` 값은 trim한(CUVR-019) 문자열이며, 달력상 유효한 `YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY` 또는 `DD/MM/YYYY`이거나, `Z` 또는 `±HH:MM` offset이 붙은 RFC 3339 `YYYY-MM-DDTHH:MM:SS` 날짜-시간(소수 초 없음, 유효한 범위)입니다. 숫자와 offset이 없는 날짜-시간은 날짜가 아닙니다. `dateISO` 값은 trim한 `YYYY-MM-DD` 달력 날짜만 받아들입니다. `docs/spec/validation-rules.ko.md`에도 같은 내용이 있습니다.
- TypeScript, Go, Python, PHP, Rust validator와 `packages/php-ext/src/validation.c`의 PHP extension이 위 규칙을 적용합니다. Go의 `dateISO`는 CUVR-019대로 입력을 trim합니다. Go에서 쓰지 않게 된 `parseExactDate`를 제거했습니다.
- `tests/fixtures/validate/generate.mts`에 layout, 달력 유효성, offset, 숫자, trim을 다루는 case 18개를 추가했습니다. `cases.json`은 339개 case가 되며, 기존 expectation은 바뀌지 않았습니다. 기존 date case 세 개의 `requirements`에 CUVR-058과 CUVR-059가 추가되었습니다.
- Red 근거: 이 변경 전에는 PHP extension이 새 date case에서 실패했고, Go `dateISO`와 Python, PHP date 규칙이 spec과 달랐습니다. Green: TypeScript conformance 테스트는 340개, Go `TestValidateMatchesFixture`는 340개, Python `test_validate.py`는 3개, Rust `validate_conformance`는 1개, PHP 라이브러리 `ValidateConformanceTest`는 통과, PHP extension은 373개 통과입니다.
- `config/parity.json`의 `validate` unit이 CUVR-058과 CUVR-059를 인용합니다.

### 2026-10-21 — C form row 작업이 collection을 하나의 scope struct에서 읽는다 (C16.58-24)

- `packages/php-ext/src/form.c`에 `row_scope`를 더했습니다. 이것은 row 작업 collection의 path, field, rows, error를 담으며, `open_row_scope`는 그것을 채우고 작업이 계속될 수 있는지 알립니다. 그 `needs_options` flag는 추가하거나 복사할 row의 options를 검사합니다. 다른 row 작업은 options를 받지 않습니다. `add_row`, `copy_row`, `remove_row`, `move_row`는 이것으로 collection을 열고 struct에서 collection을 읽습니다(C16.58-24). `open_collection`과 `open_row_collection`은 없어졌습니다. expression과 view의 쌍은 남겼습니다. 두 caller는 prologue와 짧은 tail만 공유하므로 helper를 두면 caller의 모양만 바뀌고 더 분명해지지 않습니다. C16.58-18의 영문 항목은 이제 올바르게 읽히며, 그 commit 전 `php-ext` clone 수를 16으로 고쳤습니다(국문 항목도 같습니다). duplication check는 `form.c` 쌍을 없앴습니다(변경 전 21 clone, 후 19 clone; `php-ext` clone은 6에서 4로 줄었습니다). Red: `make duplication-check` exit 2, 21 clone; green: 같은 check가 exit 2, 19 clone이며 그중 두 개는 `php-ext`(expression.c와 view.c, 위와 같이 남김); `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다. `make lint-php-ext` exit 0.
- C16.123이 더한 `packages/php-ext/src/binding.c`의 button type 검사는 `engine_internal.h`의 공유 `text_member`로 type을 읽습니다(C16.58-24).

### 2026-10-21 — C list와 number text가 숫자의 scientific mantissa를 공유한다 (C16.58-23)

- `packages/php-ext/src/engine_internal.h`에 `ps_append_mantissa`를 더했습니다. 이것은 숫자의 첫 자리를 덧붙이고, 자릿수가 더 있으면 점과 나머지를 덧붙입니다. `list.c`와 `number_text.c`는 scientific 형식에서 이것을 씁니다. 지수 text는 서로 달라서 각자 둡니다(C16.58-23). duplication check는 두 mantissa 블록의 clone을 없앴습니다(변경 전 22 clone, 후 21 clone; `php-ext` clone은 4에서 3으로 줄었습니다). Red: `make duplication-check` exit 2, 22 clone(`list.c`와 `number_text.c`의 mantissa 블록 포함); green: 같은 check가 exit 2, 21 clone; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-21 — C composition, expression, row view entry가 단계를 공유한다 (C16.58-22)

- `packages/php-ext/src/compose.c`에 `compose_entry`를 더했습니다. 이것은 properties 또는 spec input을 그 context의 files와 합성하며, `ps_compose_properties`와 `ps_compose_spec`은 자기 composer와 함께 이것을 부릅니다. `expression.c`에는 `parse_source`를 더했습니다. 이것은 `ps_expression_value`와 `ps_expression_truth`가 공유하는 tokenize와 parse 단계입니다. `view.c`에는 `row_input`을 더했습니다. 이것은 row 작업의 collapsed list와 row 검사이며, `ps_toggle_row_view`와 `ps_remove_row_view`가 씁니다(C16.58-22). duplication check는 세 clone을 없앴습니다(변경 전 27 clone, 후 22 clone; `php-ext` clone은 8에서 5로 줄었습니다). Red: `make duplication-check` exit 2, 27 clone(합성, expression, row view 쌍 포함); green: 같은 check가 exit 2, 22 clone; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-21 — C list 렌더링과 생성이 input을 하나의 함수로 검사한다 (C16.58-21)

- `packages/php-ext/src/list.c`에 `check_list_input`을 더했습니다. 이것은 공유 규칙의 순서(specification, rows와 각 row, columns, options와 그 context, page, total)로 list의 input을 검사합니다. `render_list_view`와 `build_list_view`는 이것을 부르고 그 뒤의 단계는 각자 둡니다(C16.58-21). duplication check는 두 input 검사 블록의 clone을 없앴습니다(변경 전 25 clone, 후 23 clone; `php-ext` clone은 8에서 6으로 줄었습니다). Red: `make duplication-check` exit 2, 25 clone(`list.c`의 두 input 검사 블록 포함); green: 같은 check가 exit 2, 23 clone; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-21 — C widget builder들이 source와 options를 model에 하나의 helper로 넘긴다 (C16.58-20)

- `packages/php-ext/src/widget.c`에 `attach_source_options`를 더했습니다. 이것은 source와 options를 그것이 속한 model에 넘기며, 각각은 build가 여전히 ok일 때만 설정되고 설정된 뒤에야 builder에서 해제됩니다. 그 순서를 되풀이하던 세 widget builder가 이것을 씁니다(C16.58-20). duplication check는 그 순서들의 clone을 없앴습니다(변경 전 27 clone, 후 25 clone; `php-ext` clone은 10에서 8로 줄었습니다). Red: `make duplication-check` exit 2, 27 clone(`widget.c`의 source와 options 순서 세 개 포함); green: 같은 check가 exit 2, 25 clone; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-21 — C extension이 row 작업의 collection을 열고, unknown row를 보고하며, change를 하나의 helper 집합으로 commit한다 (C16.58-19)

- `packages/php-ext/src/form.c`에 `open_collection`과 `open_row_collection`(row 작업의 collection을 열며, 뒤의 것은 options가 object일 것도 요구), `unknown_row`(collection이 갖지 않는 key의 실패), `finish_change`(data와 view가 모두 만들어져야 하는 change의 결과)를 더했습니다. `add_row`, `copy_row`, `remove_row`, `move_row`, `rekey_row`, `toggle_row`는 자기 복사본 대신 이것들을 씁니다(C16.58-19). duplication check는 그 블록들의 clone을 없앴습니다(변경 전 29 clone, 후 27 clone; `php-ext` clone은 12에서 10으로 줄었습니다). Red: `make duplication-check` exit 2, 29 clone(`form.c`의 collection, unknown-row, commit 블록 포함); green: 같은 check가 exit 2, 27 clone; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-21 — C extension이 공유 PHP method의 인수를 파싱하고 operation을 하나의 tail로 실행한다 (C16.58-18)

- `packages/php-ext/src/crudui.c`에 macro 세 개(`CRUDUI_PARSE_TEMPLATE_DATA_OPTIONS`, `CRUDUI_PARSE_SPEC_OPTIONS`, `CRUDUI_PARSE_PATH_KEY`)와 `run_operation`을 더했습니다. macro들은 여러 method가 공유하는 인수(template, data, options; specification과 options; path와 key)를 선언하고 파싱하며, `run_operation`은 options와 함께 operation을 실행하고 그 세 값을 해제하는 tail입니다. `call_three`와 `call_display`는 그 tail을 씁니다(C16.58-18). duplication check는 그 블록들의 clone을 없앴습니다(변경 전 33 clone, 후 29 clone; `php-ext` clone은 앞선 commit들과 합쳐 16에서 12로 줄었습니다). Red: `make duplication-check` exit 2, 33 clone(`crudui.c`의 인수 블록과 operation tail 포함); green: 같은 check가 exit 2, 29 clone이며 `crudui.c`에는 없습니다; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-21 — C extension이 정확한 decimal 수를 하나의 word helper 집합으로 비교하고 곱한다 (C16.58-17)

- `packages/php-ext/src/bignum_internal.h`(신규)는 정확한 decimal 변환의 word 연산인 `bignum_compare`와 `bignum_mul_add`를 담습니다. `canonical.c`와 `number_text.c`는 `big_compare`, `big_mul_small`, `big_mul_add`를 이것들의 wrapper로 남깁니다. `canonical.c`는 carry가 들어가지 않을 때 overflow를 표시하고, `number_text.c`는 전과 같이 그 경우를 무시합니다(C16.58-17). duplication check는 비교와 곱셈 loop의 두 clone을 없앴습니다(변경 전 35 clone, 후 33 clone). Red: `make duplication-check` exit 2, 35 clone(두 파일의 비교와 곱셈 복사본 포함); green: 같은 check가 exit 2, 33 clone; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-21 — C extension이 typed member를 읽고 설정하는 helper를 하나의 집합으로 공유한다 (C16.58-16)

- `packages/php-ext/src/engine_internal.h`에 `text_member`(member의 text, 없거나 string이 아니면 빈 text), `bool_member`(true인 member), `set_string`, `set_text`, `set_owned_value`(string, text, 또는 호출자가 넘기는 owned 값으로 member를 설정)를 더했습니다. `binding.c`, `widget.c`, `list.c`, `render.c`, `design.c`는 자기 복사본 대신 이것들을 씁니다. `text_member`는 파일 안의 `string_member`를 대신하며, 그 이름은 `rule_in.c`가 다른 signature로 이미 쓰고 있습니다(C16.58-16). duplication check는 그 복사본들 사이의 clone을 없앴습니다(변경 전 37 clone, 후 35 clone). Red: `make duplication-check` exit 2, 37 clone(`string_member`, `set_string`, `set_text`, `set_owned` 복사본 포함); green: 같은 check가 exit 2, 35 clone; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-21 — C extension이 값의 member를 하나의 helper 집합으로 읽는다 (C16.58-15)

- `packages/php-ext/src/engine_internal.h`에 `static inline` helper 세 개를 더했습니다. `member`(object의 member, object가 아니면 NULL), `children_of`(node의 children list), `text_of`(string 값의 text)입니다. `member`를 각자 정의하던 C source 여덟 개와, `children_of`와 `text_of`를 정의하던 `outline.c`, `view.c`는 자기 복사본 대신 이것들을 씁니다(C16.58-15). duplication check는 그 복사본들 사이의 clone을 없앴습니다(변경 전 43 clone, 후 37 clone; php-ext clone은 변경 전 26, 후 20). Red: `make duplication-check` exit 2, 43 clone(`member`, `children_of`, `text_of` 복사본 포함); green: 같은 check가 exit 2, 37 clone; `make test-php-ext CASES='RenderingConformanceTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest|OutlineTest|DisplayRulesTest|FormStateTest|HistoryFunctionsTest'`가 warning 없이 extension을 build하고 510 test(1367 assertion)를 모두 통과합니다.

### 2026-10-20 — 렌더링 case가 시험하는 빈 컬렉션과 action design 규칙을 인용한다 (C16.57-11)

- 렌더링 case가 시험하는 빈 컬렉션과 display requirement를 이름으로 밝힙니다(C16.57-11): `tests/fixtures/form-render`의 `multiple-only-empty-data`는 CUEC-001(명시된 빈 객체는 행 0개)을, `multiple-leaf-empty-placeholder`는 CUEC-002(데이터가 없으면 초기 행)와 CUEC-004(빈 컬렉션은 add-row control을 그림)를 인용하며, 이는 `packages/react/scripts/generate-form-render-cases.mts`로 생성됩니다. `tests/fixtures/list-render`와 `tests/fixtures/detail-render`의 `reject-action-design`은 CUDF-076(action design 실패)을 인용하며, 이는 각 `generate.mts`로 생성됩니다. form-render, list-render, detail-render unit이 새 id를 가집니다. 바뀐 것은 `requirements` member뿐입니다. Owner test: ts `conformance.test.ts`, `list-conformance.test.ts`, `detail-conformance.test.ts` 549 passed; Go `TestFormRenderSuite|TestListRenderSuite|TestDetailRenderSuite` 413 passed; Python `test_form_render`과 `test_render` 8 passed; Rust `form_render`, `list_render`, `detail_render` 통과; PHP 라이브러리 `RenderingConformanceTest`, `ListRenderConformanceTest`, `DetailRenderConformanceTest` 통과. Red: `make parity-declarations-check`는 R13 줄 155개를 보고합니다; green: R13 줄 151개이며 새 finding 줄은 없습니다. 네 명세에서 아직 추적되지 않은 id와 이유는 다음과 같습니다. CUIT-010에서 020(compileForm, bindForm, createForm, buildList, buildDetail 연산과 form 연산): `tests/fixtures/text-validity`의 수작업 case는 식별되었으나, 이 다섯 연산에는 unit이 없고 어떤 구현 test도 이를 읽지 않으므로 인용해도 check가 통과하지 않습니다. CUIT-021과 022(노드와 중첩 한계), CUIT-030과 031(재귀 값 message)은 case가 없습니다. CUIT-029와 CUIT-032에서 036(오류 code와 언어별 오류 타입)은 case가 시험하지 않습니다. CUDF-001에서 005, 020, 023, 036에서 039는 점 경로 필드, 불리언과 문자열 format, 조건 map 링크, javascript URL, 처리 순서를 담은 list 또는 detail case가 필요하며, 이 생성기들은 아직 선언하지 않습니다. CUEC-007(키가 있는 편집 세션)은 state suite에 속합니다. CUVR-012(date와 dateISO 활성화)는 date 규칙을 가진 validate case가 없습니다.

### 2026-10-20 — docs-check는 DOCS_CHECKS hook을 통해 doc-coverage gate를 실행한다 (C16.94)

- crudui의 Makefile은 doc-coverage gate를 prerequisite `docs-check: crudui-docs-check` 대신 `DOCS_CHECKS += crudui-docs-check`로 추가하여(C16.94), kit의 docs-check가 check-documents와 hook의 모든 target을 각각 독립적으로 실행하게 합니다. `scripts/test-commands.mts`는 hook을 따라가므로(`makeHooks`, `ProjectDeclarations.hooks`) `make docs-check`가 hook된 target을 통해 여전히 test runner에 닿고, `tests/build/test-commands.test.mts`에는 그 fixture(test를 실행하는 hook target과 실행하지 않는 것)가 추가됩니다. Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/test-commands.test.mts`가 "no Makefile target takes a target that runs tests as a prerequisite"에서 exit 1; green: exit 0, 16 passed. `make -n docs-check`는 check-documents와 crudui-docs-check를 명명하며 overriding 경고를 출력하지 않습니다.

### 2026-10-20 — 모든 implementation이 담은 interface message는 CUMK-065 아래 contract와 같다 (C16.100)

- `docs/spec/form-markup.md`는 요구사항을 항목 CUMK-065로 씁니다(모든 implementation은 `contracts/interface-messages.json`에서 생성한 소스를 담고, 담은 문구가 다르면 test가 실패합니다). `config/parity.json`은 CUMK-065를 인용하는 feature unit `interface-messages`를 여섯 binding과 함께 선언합니다. TypeScript test, Go test, `messages/mod.rs`의 Rust test, 새 Python test `tests/test_interface_messages.py`(`FORM`과 `LIST` 표를 contract와 비교), 새 PHP test `InterfaceMessagesConformanceTest.php`(공개 API `Generator::compileForm`과 `Form::getMessages()`만 써서 contract의 각 언어를 검사하며, PHP 확장도 실행합니다)입니다(C16.100). Red: parity check에는 CUMK-065 binding이 없었고 TypeScript, Go, Rust, Python contract test가 묶이지 않았습니다(`R5 undeclared-test`). Green: `make parity-declarations-check`는 전 303건에서 후 300건이 되었고, R5 세 줄(Go, Rust, TypeScript)이 빠졌으며 새 줄은 없습니다. 확장 실행 `make test-php-ext CASES=InterfaceMessagesConformanceTest`는 exit 0이며 5 passed이고, 라이브러리 실행도 통과합니다. 공개 API는 form 표만 돌려주므로 PHP test는 `LIST` 표를 검사하지 않습니다(Python, Go, TypeScript test가 검사합니다). list 메시지를 돌려주는 공개 PHP 메서드는 없으며, 추가하는 것은 계약 변경이라 따로 결정해야 합니다.

### 2026-10-20 — Go의 공유 suite를 시험하지 않는 test 파일은 internal로 선언한다 (C16.102)

- `config/parity.json`은 `go` implementation의 Go test 파일 23개를 `internal`로 선언합니다. 공유 suite가 다루는 규칙이나 렌더링을 시험하는 16개는 이유에 그 suite unit 또는 validate unit을 밝히고, Go 내부만 시험하는 7개는 Go ordered-object decoder, Go template shape, Go loader wrapper, Go FieldSpec round trip, 두 문서 gate와 예제 서버입니다(C16.102). internal 파일은 requirement id를 명시하지 않으므로 R16은 깨끗합니다. Red: `make parity-declarations-check`가 exit 2이며 finding 303건, 그중 `R5 undeclared-test go` 31건이었습니다. Green: exit 2이며 finding 280건입니다. R5 23건이 빠졌고 새 줄은 없습니다(총계만 바뀝니다). 남은 R5 8건은 compose와 expr conformance test(C16.81의 unit 대기), C16.100의 interface-messages test(바인딩됨), Unicode 데이터 contract test와 Go의 바이트 수준 text 검사(gap, 후보 row), compose order test와 expr engine·recognition test(unit 대기)입니다. verification cell은 선언한 파일이 R5 줄에 나오지 않음을 검사합니다.

### 2026-10-20 — 공유 suite를 시험하지 않는 PHP test 파일은 internal로 선언한다 (C16.104)

- `config/parity.json`은 `php` implementation의 PHP test 파일 24개를 `internal`로 선언합니다. 공유 suite가 다루는 규칙이나 렌더링을 시험하는 16개는 이유에 그 suite와 unit(form-render, list-render, validate, form-view, form-history, form-actions)을 밝히고, PHP 내부나 문서 gate만 시험하는 8개는 그 사실을 밝힙니다(C16.104). internal 파일은 requirement id를 명시하지 않으므로 R16은 깨끗합니다. 남긴 파일: Compose/PatchTest.php와 Compose/RefTest.php(공유 suite인 compose에 unit이 아직 없음, C16.81), ComposeConformanceTest.php와 ExprConformanceTest.php(C16.81), Internal/InterfaceMessagesTest.php(C16.100), InputTextTest.php와 Values/UnicodeDataTest.php(gap), packages/php-ext/tests/ApiTest.php(라이브러리와의 API 동등성 검사에 공유 suite가 없어 부분 gap으로 보고). Red: `make parity-declarations-check`가 exit 2이며 finding 303건, 그중 `R5 undeclared-test php` 31건이었습니다. Green: exit 2이며 finding 279건입니다. 선언한 R5 줄 24건이 빠졌고 새 줄은 없습니다. verification cell은 선언한 경로가 R5 php 줄에 나오지 않음을 검사합니다.

### 2026-10-20 — Rust date 규칙은 reference가 거부하는 text를 거부한다 (C16.57-12-1)

- `packages/validator/rust/src/validate/rules.rs`의 `is_valid_date`는 문자열을 Go와 Python validator가 받아들이는 명시적 날짜 layout 중 하나일 때만 받아들입니다(`YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, 그리고 `Z` 또는 offset이 붙은 RFC 3339 timestamp `YYYY-MM-DDTHH:MM:SS`). 각 날짜는 존재하는 calendar 날짜여야 합니다(C16.57-12-1). 그 밖의 비어 있지 않은 문자열을 받아들이던 permissive fallback은 유효성 검사에서만 제거했으며, `enddate`는 자체 parser를 유지합니다. 같은 파일의 unit test `date_rule_accepts_only_the_explicit_layouts`가 layout을 고정하고, conformance case `date-rule-rejects-text-that-is-no-date`(C16.57-12)는 이제 통과합니다. Red: `cargo test --locked --manifest-path packages/validator/rust/Cargo.toml --test validate_conformance`가 exit 101이며 `1/321 validate mismatch(es)`를 보고합니다: `[date-rule-rejects-text-that-is-no-date]`가 reference의 `date` 규칙 실패(`valid: false`) 대신 `valid: true`를 보고함; green: exit 0, `1 passed`; crate 전체 `cargo test`는 exit 0(unit test 108개와 integration target), `make lint-rust`는 exit 0입니다.

### 2026-10-20 — 시험하지 않던 display, date, session 규칙을 case로 작성한다 (C16.57-12)

- 렌더링 suite가 생성기를 통해 case를 얻습니다(C16.57-12). `tests/fixtures/list-render`는 `field-path-dotted`(CUDF-001), `format-true-and-false-are-text`(CUDF-004), `format-string-type-date`(CUDF-005), `format-link-href-condition`(CUDF-020), `format-link-javascript-url`(CUDF-023), `reject-root-sort-before-pagination`(CUDF-036), `reject-column-unknown-key-before-format`(CUDF-038), `reject-search-before-sort`(CUDF-039)를, `tests/fixtures/detail-render`는 같은 display case와 `reject-field-unknown-key-before-format`(CUDF-038)을 얻습니다. `tests/fixtures/validate`는 `date-rule-rejects-text-that-is-no-date`, `dateiso-rule-accepts-iso-date`, `dateiso-rule-rejects-other-format`(CUVR-012)을, `tests/fixtures/form-actions`는 `explicit-empty-collection-gets-keyed-rows`(CUEC-007, 확장된 `tests/fixtures/form-state/generate.mts`의 session helper로 명시적 빈 객체에 행을 추가하는 session)를 얻습니다. 각 case는 자신의 id를 인용하며, CUDF-037을 시험하는 기존 case(`reject-list-design-before-columns`, `reject-design-before-actions`)와 CUDF-036을 시험하는 `reject-root-key-before-design`도 인용합니다. Runner의 총계를 갱신했습니다: list 165, detail 68, validate 321(Python result case 182). Owner test: list와 detail: ts 233, Go 235, Python 3, Rust 2, PHP 라이브러리 235, PHP extension 235(`make test-php-ext`); validate: ts 322, Go 322, Python 3, PHP 라이브러리 321, PHP extension 355; Rust validate는 case 하나에서 실패합니다(아래); form-actions: ts 29, Go 11, Python 4, Rust 4, PHP 29. Red: main의 `make parity-declarations-check`는 R13 줄 155개를 보고합니다; green: R13 줄 143개이며 새 finding 줄은 없습니다. 결함: Rust validator는 `date-rule-rejects-text-that-is-no-date`를 valid로 보고하지만, reference는 `not a date`에 대해 `date` 규칙 실패를 보고합니다(`packages/validator/rust/src/validate/rules.rs`의 `is_valid_date`가 JavaScript Date parser가 거부하는 문자열을 받아들임); C16.57-12-1로 등록했으며 이 row에서 고치지 않습니다. CUDF-003은 cases의 출력으로 보일 수 없는 "renderer는 display model로만 markup을 씀"이므로 인용하지 않은 채 둡니다.

### 2026-10-20 — PHP extension은 public API만으로 rendering conformance suite를 실행한다 (C16.97)

- `packages/generator/php/tests/RenderingConformanceTest.php`는 `new Form`과 `Generator::renderForm`으로 form을 만들고, trait `LayoutTree.php`로 layout을 비교합니다(자체 style 해석을 쓰므로 내부 class를 load하지 않습니다). `ListRenderConformanceTest.php`와 `DetailRenderConformanceTest.php`는 `LayoutTree::withoutPreloads`로 body를 비교합니다. 다섯 rendering 파일이 `make test-php-ext`로 실행됩니다(C16.97). 누락된 반복 data의 placeholder row는 다시 고정 key `__0000000000000__`를 받고(`Form.php` `normalizeFields`, `form.c` `normalize_fields`), `addRow`가 만든 row 아래의 placeholder만 새 key를 받습니다(`fresh` flag). 형식 suite가 기록한 대로입니다. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES='RenderingConformanceTest|OutlineTest|FormCompleteConformanceTest|ListRenderConformanceTest|DetailRenderConformanceTest'` exit 2, 거부됨: 라이브러리 source(`Internal/Buttons.php` 등)가 load되었고, placeholder case `multiple-leaf-empty-placeholder`가 무작위 key로 실패. Green: 같은 명령 exit 0, 443 passed; 같은 파일의 라이브러리 실행 exit 0, 443 OK; form-state 회귀 `FormStateTest|FormTest|HistoryFunctionsTest|DisplayRulesTest`는 extension과 라이브러리 모두 exit 0입니다.

### 2026-10-20 — 런타임의 row 작업과 keyPrefix 옵션을 case가 인용한다 (C16.57-10)

- state case가 시험하는 row 작업 requirement를 이름으로 밝힙니다(C16.57-10): `tests/fixtures/form-history`의 `undo-and-redo-restore-the-record`는 CURT-004(공급된 key로 `addRow`)를, `tests/fixtures/form-actions`의 `run-action-add-and-copy-row`는 CURT-005(`copyRow`가 복사된 row와 중첩 row의 key를 `$1`, `$2`로 새로 만듦)를, `run-action-move-row`는 CURT-007(`moveRow`가 key와 값을 유지함)을, `tests/fixtures/form-view`의 `row-removal-drops-and-rekey-moves-view`는 CURT-006(`removeRow`가 선택된 row만 제거함)과 CURT-008(`rekeyRow`가 하위 path를 다시 만듦)을 인용합니다. 생성기는 `tests/fixtures/form-state/generate.mts`입니다. `tests/fixtures/form-render`에는 `packages/react/scripts/scenario-form-render-cases.ts`를 거친 `key-prefix-option-names`가 추가되며, 그 React 기준 출력은 모든 control을 `form[…]`으로 명명합니다(CURT-025). form-view, form-history, form-actions, form-render unit이 새 id를 가집니다. Owner test: ts `form-state.test.ts` 28, Go `TestFormView|TestFormHistory|TestFormActions` 20, Python `test_form_state` 4, Rust `form_state` 4, PHP `FormStateTest` 28; ts `conformance.test.ts` 330, Go `TestFormRenderSuite` 192, Python `test_form_render` 5, Rust `form_render` 1, PHP `RenderingConformanceTest` 191(라이브러리). Red: `make parity-declarations-check`는 form-runtime.md의 R13 줄 161개(전체, 그중 CURT id 44개)를 보고합니다; green: R13 줄 155개(그중 CURT id 38개)이며 새 finding 줄은 없습니다. 아직 추적되지 않은 CURT id 38개는 이유와 함께 나열합니다: CURT-001에서 003(데이터 오류 message; 이 message로 실패하는 case가 없고 기준 생성기는 구성 오류만 씀); CURT-026에서 049(함수 옵션, DOM form 요소에 대한 bindForm, control 값과 이름, 검증 시점과 submit, hydration: TypeScript 브라우저 런타임 전용); CURT-050(준비 순서), 051(framework view 마운트), 052(예제 store), 056(validate unit이 수행하는 검증 절차; case가 아님); CURT-053에서 055(각 case가 requirement의 일부만 시험하므로 인용하지 않음); CURT-057, 058, 059, 060(포인터, 키보드, 네이티브 입력 이벤트, 재렌더와 브라우저별 script, 브라우저에서 서버 렌더 바인딩: TypeScript 전용).

### 2026-10-20 — Rust JsonText 단위 test는 internal이며, 반복 member 규칙은 여섯 implementation suite가 아니다 (C16.99)

- `config/parity.json`은 `packages/validator/rust/src/text.rs`를 Rust implementation의 `internal` test로 선언하며, 이유는 Rust JsonText parser의 단위 test라는 것입니다(input-text.md, JSON text). 그 절의 반복 member 규칙에는 requirement id가 없고, TypeScript 명세 parser(`parseJsonDocument`, 이스케이프된 이름을 포함해 모든 깊이의 반복 decode 이름을 거부하며 CLI가 JSON 명세를 읽는 데 씁니다)와 Rust JsonText parser에만 묶이므로 여섯 implementation suite가 아닙니다. 명세가 정의하지 않은 error record가 필요하기 때문입니다(C16.99). TypeScript parser는 이스케이프된 이름을 거부함을 확인했으므로(`packages/validator/ts/src/text/json.test.ts`) 결함은 없었습니다. Red: `make parity-declarations-check`가 exit 2이며 finding 285건, 그중 `R5 undeclared-test rust` 4건이었습니다. Green: exit 2이며 finding 284건입니다. text.rs의 rust R5 줄만 빠졌고(요약 줄이 바뀝니다), R16 finding은 없으며, R5 3건이 남습니다(messages/mod.rs, compose_conformance.rs, expr_conformance.rs). 같은 명령 `node node_modules/@polyspec/kit/dist/run-tests.mjs vitest --cwd packages/validator/ts -- src/text/json.test.ts`는 exit 0이며 2 passed입니다.

### 2026-10-20 — Rust의 공유 contract 관련 test 파일은 internal로, 공용 conformance 도우미는 support 파일로 선언한다 (C16.98)

- C16.98의 verification은 `make parity-declarations-check`에 남은 rust R5 줄 4개를 센다(C16.98). 이 항목은 이 줄과 함께 닫히며, 변경 자체는 앞 commit에 있습니다.
- `config/parity.json`은 `rust` implementation의 `internal`로 Rust test 파일 23개를 선언하며, 각 항목에는 그 module과 contract를 밝히는 이유가 있습니다(공유 suite가 다루는 행은 suite unit을, Rust 전용 내부는 시험하는 내용을 씁니다). 또한 test를 담지 않는 `packages/validator/rust/tests/common/**`을 `support` glob으로 선언합니다(C16.98). Red: `make parity-declarations-check`가 exit 2이며 finding 309건, 그중 `R5 undeclared-test rust` 28건이었습니다. Green: exit 2이며 finding 285건입니다. 23건의 R5와 요약 줄이 빠졌고 새 줄은 없습니다. 남은 R5 4건은 `packages/generator/rust/src/messages/mod.rs`, `packages/validator/rust/src/text.rs`, `packages/validator/rust/tests/compose_conformance.rs`, `packages/validator/rust/tests/expr_conformance.rs`이며, 각각 C16.99, C16.100, C16.81의 compose와 expr unit에 속합니다. 내부 id를 명시한 파일은 없으므로 R16은 깨끗합니다.

### 2026-10-20 — PHP extension은 부호가 붙은 radix 숫자 text를 라이브러리와 같이 읽는다 (C16.90)

- `packages/php-ext/src/list.c`(`parse_number`): `-0x10`처럼 radix 접두사 앞에 부호가 붙은 text는 숫자가 아니므로, 숫자 셀은 라이브러리와 같이 그 text를 유지합니다. 부호 없는 `0x10`과 `0b101`은 여전히 숫자로 읽습니다. `DisplayRulesTest::testSignedRadixTextIsNoNumber`(C16.90)는 `Generator::renderList`만 씁니다. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES=DisplayRulesTest` exit 2, 새 test가 실패(extension은 `-16.00`을 렌더링); 라이브러리 실행 exit 0, 23 OK. Green: extension 실행 exit 0, 23 passed; 라이브러리 실행 exit 0, 23 OK입니다.

### 2026-10-20 — PHP extension은 유한하지 않은 page 또는 total 옵션을 라이브러리와 같이 읽는다 (C16.89)

- `packages/php-ext/src/crudui.c`(`counts_for_conversion`, `call_display`): 표시 옵션 `page` 또는 `total`이 INF나 NAN이면 값 변환기에서 `Unsupported PHP value: float`로 실패하는 대신 라이브러리와 같이 그 옵션의 규칙을 적용합니다(CUDF-029, CUDF-030). 호출자의 배열은 바뀌지 않으며, 행과 data는 그 메시지를 그대로 받습니다. `DisplayRulesTest::testNonFiniteCountsFailWithTheirRules`(C16.89)는 `buildList`와 `renderList`를 다룹니다. Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES=DisplayRulesTest` exit 2, 2개 실패(`testPageAndTotalAreSafeIntegers`는 `Unsupported PHP value: float`, 새 test); 라이브러리 실행 `DisplayRulesTest` exit 0, 22 OK. Green: extension 실행 exit 0, 22 passed; 라이브러리 실행 exit 0, 22 OK.

### 2026-10-20 — 렌더링 case가 시험하는 form markup 규칙을 인용한다 (C16.57-9)

- `tests/fixtures/form-render/cases.json`에 case 두 개가 `packages/react/scripts/scenario-form-render-cases.ts`를 거쳐 React reference로 렌더링되어 추가되었습니다(C16.57-9): `multiple-nested-depth-three`는 collection 세 개가 서로 중첩되는 case이고(CUMK-059), `multiple-max-reached-disables-add`는 `multiple.max` 2에 행 두 개가 있는 case로 add-row와 copy-row control이 `aria-disabled`입니다(CUMK-060). `generate-form-render-cases.mts`의 requirement table은 이제 해당 markup을 보이는 case에 CUMK-005, 031, 058, 059, 060, 062, 063, 064를 둡니다. `config/parity.json`의 form-render unit이 이를 인용합니다. Runner는 case 수를 셉니다: Go, Rust, Python 결과 수는 139이고 Python 전체 수는 190입니다. Owner test는 통과합니다(ts 328, Go 191, Rust 1, Python 5). PHP 라이브러리는 `RenderingConformanceTest`의 190개 case를 모두 통과합니다(phpunit). `make test-php-ext`는 이 test가 extension이 제공하지 않는 라이브러리 내부 class(`Internal\Buttons`, `Value`, `Messages`)를 로드하므로 실행을 거부하며, 그래서 form-render의 php-extension binding은 이 명령으로 검증되지 않습니다. Red: main의 `make parity-declarations-check`는 finding 317개(R13 168, R4 7, R5 141, R6 1)를 보고합니다; green: finding 309개(R13 161, R4 7, R5 140, R6 1)이며 새 finding 줄은 없습니다. 아직 추적되지 않은 CUMK id 25개는 class 이름 규칙 CUMK-001에서 003, outline과 data class CUMK-008과 009(이 case들의 HTML은 TypeScript runner만 비교합니다), CSS 변수 CUMK-039에서 055(case가 CSS를 싣지 않음), 그리고 CUMK-056, 057, 061(polling, expansion view state, undo: markup suite가 시험하지 않음)입니다.

### 2026-10-20 — ci-local test는 PHP engine 명령의 engine과 comparison 경로를 기대한다 (C16.95)

- `tests/build/ci-local.test.mts`는 `make crudui-test-native`의 PHP engine 명령이 engine test 분리(C16.48) 이후 recipe가 실행하는 `packages/php-ext/tests/engine/engine.test.mjs`와 `packages/php-ext/tests/comparison/comparison.test.mjs`를 실행한다고 기대하며, 정확한 명령 검사는 유지합니다. 그 뒤의 두 정규식은 그대로이며 통과합니다(C16.95). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/ci-local.test.mts`가 exit 1이었고, 한 경로만 기대하는 정규식 때문에 `the native suites run in three jobs, each once, and make crudui-test-native runs all three`가 실패했습니다. Green: 같은 명령 exit 0입니다.

### 2026-10-20 — 렌더링과 outline suite를 parity unit으로 선언한다 (C16.83)

- `config/parity.json`은 form-render, form-complete, list-render, detail-render, form-outline unit을 선언합니다. 각 unit은 존재하는 ts, go, python, php, php-extension, rust binding과 그 case가 시험하는 requirement id를 가집니다(C16.83). `packages/html`은 ts implementation의 root이며, markup 규칙 test 8개와 browser session test 2개는 internal로 선언합니다. `docs/spec/runtime-packages.md`는 TypeScript 구현에 requirement CURP-028을 부여합니다. 다섯 suite의 case는 `requirements` member에 id를 가지며, tests/fixtures/*/generate.mts와 packages/react/scripts/generate-form-render-cases.mts가 생성합니다. 바뀐 것은 그 member뿐입니다. Red: main의 `make parity-declarations-check`는 420 finding(R13 259, R4 12, R5 148, R6 1)을 보고합니다; green: 317 finding(R13 168, R4 7, R5 141, R6 1). Rust form-render runner(tests/form_render.rs, C16.88에서 옴)는 하나의 test `form_render_cases_reproduce_the_normalized_layout_or_the_failure`가 188개 case를 모두 실행하도록 바뀌었으므로, binding 하나가 모든 case를 실행합니다. Owner test: 다섯 html conformance file의 `vitest`, 587 passed, 0 failed.
- `config/parity.json`의 rust implementation은 `packages/generator/rust/tests/support/**`를 support 파일로 선언합니다. rendering runner들이 함께 쓰는 module은 test가 아닙니다(C16.83).

### 2026-10-20 — 남은 script는 scripts/values.mts 없이 JSON을 읽고 values.mts는 제거한다 (C16.11-4, C16.11)

- `scripts/check-ci-browser.mts`, `scripts/docs-web/cli.mts`, `scripts/docs-web/server.mts`, `scripts/install-browsers.mts`는 오류 문자열을 제자리에서 만들고, `tests/build/ci-local.test.mts`와 `tests/build/public-packages.test.mts`는 객체와 문자열 배열을 `scripts/json-schema.mts`의 ajv 형태로 검사합니다(C16.11-4). `scripts/values.mts`는 `config/rebuild.json`의 `replaced` 항목과 `config/owner-checks.json`의 경로와 함께 제거되므로, script는 JSON을 ajv schema로만 읽습니다(C16.11). Red: `make rebuild-check`가 exit 0이었고 `scripts/values.mts`는 호출자 21곳과 함께 남아 있었습니다. Green: `make rebuild-check` exit 0이며, 나머지 family의 node test는 각 family에서 확인했습니다. `tests/build/public-packages.test.mts`는 checkout의 빌드 산출물이 필요합니다. 새 worktree에서는 빌드되지 않은 `dist` 때문에 5개 검사가 실패하고, main에서는 모두 통과합니다. `tests/build/ci-local.test.mts`의 `the native suites run in three jobs` 검사는 main에서도 실패합니다.
- `config/owner-checks.json`은 `scripts/values.mts`를 소유하던 규칙으로 `scripts/json-schema.mts`와 `scripts/json-schema.test.mts`를 소유하며, 그 test에 `scripts/json-schema.test.mts`와 `tests/build/install-lock.test.mts`를 더합니다(C16.11-4).

### 2026-10-20 — schema, conformance, test-command, doc-coverage script는 JSON을 ajv 형태로 읽는다 (C16.11-3)

- `scripts/check-schema.mts`, `scripts/check-conformance.mts`, `scripts/test-commands.mts`, `scripts/check-doc-coverage.test.mts`, `scripts/php-doc-coverage.test.mts`는 객체, 배열, 문자열과 문자열 배열을 `scripts/values.mts` 대신 `scripts/json-schema.mts`의 형태로 검사합니다(C16.11-3). 호출자는 각 거부와 메시지를 유지하며, 거부된 값은 자신의 label과 잘못된 값의 JSON Pointer를 밝힙니다. `Makefile`은 `scripts/json-schema.test.mts`를 다른 script test와 함께 실행합니다. `tests/build/test-commands.test.mts`는 이를 모든 node:test 파일에 요구합니다. Red: 이 family는 `scripts/values.mts`로 읽었습니다. Green: `node scripts/check-schema.mts` exit 0(main과 같은 608건 검사), `scripts/check-doc-coverage.test.mts`, `scripts/php-doc-coverage.test.mts`, `scripts/json-schema.test.mts`가 통과합니다. `tests/build/test-commands.test.mts`는 `no Makefile target takes a target that runs tests as a prerequisite`를 제외하고 통과하며, 그 실패는 main에서도 납니다(`docs-check` target).

### 2026-10-20 — package와 repository reader는 JSON을 ajv 형태로 읽는다 (C16.11-2)

- `scripts/repository-files.mts`는 @polyspec/kit package.json의 kit.copies를 ajv 형태로 검사하고, `scripts/package-install-pack.mts`는 npm pack 보고와 원본 package.json을 형태로 검사하며, `scripts/check-contract-manifest.mts`는 exports map과 package.json을 형태로 검사하고, `scripts/features-manifest.mts`는 schema 객체를 형태로 검사하며, `scripts/check-packages.mts`는 package.json, lock과 버전 파일을 형태로 읽습니다(C16.11-2). 호출자의 각 거부는 조건과 고유 메시지를 유지하며, 형태가 값을 거부하면 메시지는 파일과 잘못된 값의 JSON Pointer를 밝힙니다(`shapeDetail`). Red: 이 family는 `scripts/values.mts`로 읽었습니다. Green: `tests/build/package-install-pack.test.mts`, `tests/build/repository-files.test.mts`, `tests/build/contract-manifest.test.mts`, `tests/build/install-lock.test.mts`, `scripts/json-schema.test.mts`가 함께 25건 통과하며, `make rebuild-check` exit 0입니다. `scripts/check-packages.mts`는 install project를 실행하므로 TypeScript 컴파일러로만 확인했고, `make test:packages` gate에서 검사됩니다.

### 2026-10-20 — install lock은 형태를 ajv schema로 읽는다 (C16.11-1)

- `scripts/json-schema.mts`는 scripts의 공통 형태 검사입니다. schema가 형태를 정하고 ajv가 값을 검증하며, 다른 형태의 값은 파일과 잘못된 값의 JSON Pointer를 밝히는 Error로 실패합니다(`shapeOf`, `checkedShape`, `readShape`, `shapeDetail`). `scripts/json-schema.test.mts`가 메시지를 검사합니다. `scripts/install-lock.mts`의 `isLockEntry`, `isLockPackages`, `isPackedManifest`는 `scripts/values.mts` 대신 ajv 형태로 주어지며 받아들이는 값은 같습니다(C16.11-1). `config/rebuild.json`은 새 script를 ajv ecosystem 도구로 분류합니다. Red: `make rebuild-check`가 exit 0이며 `scripts/values.mts`는 아직 `replaced` 항목입니다. Green: `make rebuild-check` exit 0, `tests/build/install-lock.test.mts` 5 passed, `scripts/json-schema.test.mts` 2 passed입니다.

### 2026-10-20 — schema suite들이 그 case가 시험하는 CUSC requirement를 인용한다 (C16.57-7)

- `tests/fixtures/spec-validity`, `list-validity`, `detail-validity`의 case는 손으로 쓴 `requirements` 배열을 가집니다(이 suite에는 generator가 없습니다). runtime `engine` 기대를 시험하는 case는 구조, 내용, design, choice, multiple, lang, 버튼과 action key를 받아들이거나 거부하는 CUSC 항목을 인용합니다(C16.57-7). `tests/fixtures/validate/generate.mts`는 `REQUIREMENTS` map에 CUSC-003, CUSC-008부터 CUSC-010, CUSC-052, CUSC-055를 추가하고 `cases.json`은 그 map에서 다시 생성됩니다. `config/parity.json`은 suite unit `spec-validity`, `list-validity`, `detail-validity`를 각각 여섯 binding(ts, php, php-extension, go, rust, python)과 함께 선언하며, `validate` unit은 새 id를 나열합니다. `compose` suite는 선언하지 않았습니다. 그 PHP test가 PHP 라이브러리 source를 읽어 PHP extension 실행이 거부하므로, php-extension binding이 없는 unit은 R2에 걸립니다. Red: `make parity-declarations-check`가 exit 2이며 finding 514건, CUSC-001부터 CUSC-060까지의 R13 60건, 세 validity 파일의 R4 3건이었습니다. Green: exit 2이며 finding 454건, R13 16건(CUSC-005, CUSC-012, CUSC-013, CUSC-016부터 CUSC-019, CUSC-022, CUSC-025, CUSC-037부터 CUSC-040, CUSC-043, CUSC-044, CUSC-046), 세 파일의 R4 0건, R14와 R15 0건입니다. 여섯 binding이 모두 `engine` 기대를 실행하지만, 그 suite의 meta-schema `expect`는 TypeScript의 `form-metaschema`와 `detail-metaschema` test만 실행하므로, meta-schema만 검사하는 CUSC 항목(예: design.attributes의 이름 거부, CUSC-012)은 인용하지 않았습니다. Owner test: ts, php, php-extension, go, rust를 실행했습니다(세부 수치는 영문 항목과 같습니다). python tests.test_structure_validity는 9개가 통과합니다. C16.57-8이 먼저 선언한 unit `list-validity`와 `detail-validity`는 그 TypeScript binding인 meta-schema test `list-metaschema`와 `detail-metaschema`를 유지하고(unit은 implementation마다 binding 하나, R12), 그 CUDF id에 이 CUSC id를 더합니다. C16.57-8 위에서 check는 finding 420건(R13 259, R4 12, R5 148, R6 1)을 보고합니다.

### 2026-10-20 — make-tool-path test는 Makefile이 쓰는 kit 디렉터리를 읽는다 (C16.91)

- `tests/build/make-tool-path.test.mts`는 make에게 `KIT` 값을 묻고(저장소 Makefile을 읽는 probe makefile이 `$(KIT)`를 출력합니다), Rust test 명령이 그 디렉터리 아래 있다고 기대합니다. `node_modules/@polyspec/kit/dist`를 가정하지 않습니다. Rust test가 `run-tests.mjs`를 거친다는 검사는 그대로입니다(C16.91). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/make-tool-path.test.mts`가 exit 1이었고 test `crudui-test-native runs the Rust tests through the test runner` 하나가 실패했습니다(연결된 checkout에서 Makefile은 `../kit/dist/run-tests.mjs`를 씁니다). Green: 같은 명령 exit 0, 5건 모두 통과합니다.

### 2026-10-20 — Rust 명령 진입점은 PATH가 고정한 toolchain을 쓰고 tool-resolution.mts는 제거한다 (C16.41)

- `scripts/run-rust-command.mts`는 PATH가 가리키는 cargo, rustc, rustdoc을 실행합니다(mise shim이 `rust-toolchain.toml`이 고정한 toolchain을 앞에 둡니다). 각 도구의 버전 출력을 확인하고, `RUSTC`와 `RUSTDOC`에는 절대경로를 설정합니다. `scripts/tool-resolution.mts`는 rustup 발견 로직과 함께 제거되며, 그 `replaced` 항목은 파일과 함께 `config/rebuild.json`에서 빠집니다(C16.41). owner-check의 경로 목록과 doc-coverage, API 문서, run-command, 진입점 test의 목록에서 제거된 파일을 뺐고, `tests/build/make-tool-path.test.mts`와 `tests/build/rust-node-entry-points.test.mts`는 가짜 rustup 대신 PATH의 toolchain을 시험합니다. `docs/operations/package-build.md`와 `.ko.md`는 새 규칙을 설명합니다. Red: `make rebuild-check > var/red.log 2>&1`이 exit 0이었고, `scripts/tool-resolution.mts`는 "item C16.41 registers the replacement" 사유의 `replaced`로 남아 있었습니다. Green: `make rebuild-check` exit 0이며 항목이 사라졌습니다. `tests/build/rust-node-entry-points.test.mts` 7 passed, `tests/build/run-command.test.mts` 9 passed, `scripts/check-doc-coverage.test.mts` 13 passed, `scripts/gen-api-docs.test.mts` 8 passed입니다. `tests/build/make-tool-path.test.mts`는 5개 중 4개가 통과하며, `crudui-test-native runs the Rust tests through the test runner`은 main checkout에서도 실패합니다(Makefile이 `../kit`에서 kit을 실행하는데 test는 `node_modules/@polyspec/kit`을 기대하는 worktree 배치 차이이며, 이 변경과 무관합니다). 변경한 TypeScript 파일은 저장소의 컴파일러로 타입 검사를 통과합니다.

### 2026-10-20 — Rust generator는 공유 form-render, list-render, detail-render suite를 실행한다 (C16.88)

- `packages/generator/rust/tests/form_render.rs`, `list_render.rs`, `detail_render.rs`는 세 suite의 모든 case를 `test_render.py`처럼 Rust generator로 실행합니다. 결과 case는 정규화된 layout tree로 비교하고(`tests/support/mod.rs`, Python runner의 `html_tree`; list와 detail은 preload link를 뺍니다), 실패 case는 기록된 code를 내야 합니다(list와 detail은 message도). 수는 form-render 결과 137건과 실패 51건, list-render 157건, detail-render 62건으로 assert합니다. `packages/generator/rust/src/instance.rs`는 누락된 반복 데이터에 초기 행 `__0000000000000__`을 주며(CUEC-002), 연산이 만든 행만 새 key를 받습니다(`normalize_fields`와 `normalize_row`가 `fresh`를 받으며, Python과 TypeScript reference와 같습니다). `tests/form_complete.rs`(C16.84)는 금지된 `Result::unwrap_or_else` 규칙을 맞추려고 unwrap 호출만 `match`로 바꿨습니다(C16.88). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml form_render` exit 1이며, `multiple-leaf-empty-placeholder`가 행 key `__b8532f96c45a1__`을 렌더링하고 case는 `__0000000000000__`을 기대했습니다. Green: `form_render` exit 0(2 passed), `list_render` exit 0(1 passed), `detail_render` exit 0(2 passed), `form_complete` exit 0, unit test `tests` exit 0(41 passed), `--test form_state --test history_functions` exit 0(17 passed), crate clippy 명령 exit 0입니다. 변이 검사는 각 family의 임시 복사본에서 expected 값 하나를 바꿨고, 각 runner가 실패(exit 1)한 뒤 fixture를 복원했습니다.

### 2026-10-20 — Rust generator는 공유 form-complete suite를 실행한다 (C16.84)

- `packages/generator/rust/tests/form_complete.rs`는 `tests/fixtures/form-complete/cases.json`의 case 28건을 각각 `compile_form`, `Form::new`, `render_form`으로 case의 options와 render options를 써서 렌더링합니다. `expected_html`을 가진 case는 같은 bytes를 써야 하고, `expectError`를 가진 case는 기록된 code와 message로 실패해야 합니다(C16.84). Red: 이 test는 트리에 없었으므로 red를 기록하지 않았습니다. 변이 검사는 임시 복사본의 fixture 하나의 `expected_html`을 다른 값으로 바꿔 `form_complete`가 실패함(exit 1)을 확인했고, 그 뒤 fixture를 복원했습니다. Green: `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml form_complete` exit 0, 1 passed이며 case 28건이 모두 비교되었습니다. generator 결함은 없었습니다.

### 2026-10-20 — Go generator는 공유 form-complete, list-render, detail-render suite를 실행한다 (C16.86)

- `packages/generator/go/form_complete_suite_test.go`(신규)는 `tests/fixtures/form-complete/cases.json`의 28개 case를 case의 render 옵션으로 `RenderForm`에 실행하고, `list_render_suite_test.go`는 `list-render`의 157개 case, `detail_render_suite_test.go`는 `detail-render`의 62개 case를 실행합니다. result body는 image preload link를 뺀 뒤 공유 normalizer가 만든 layout으로 비교하고, failure case는 기록된 code와 message로 확인합니다(C16.86). `form_render_suite_test.go`의 `renderFormCase`는 render 옵션을 받습니다. list와 detail의 입력 규칙은 CUDF-025와 CUDF-033을 따릅니다: `RenderList`, `BuildList`는 `rows any`를, `RenderDetail`, `BuildDetail`은 `record any`를 받으며(디코딩된 값; `[]*Object`도 그대로 받음), 배열이 아닌 rows는 `List rows must be an array`로(`list.go` `listRows`), 객체가 아닌 record는 fields 검사보다 먼저 `Detail record must be an object`로 실패하고, nil record는 더 이상 빈 객체가 되지 않습니다(`detail.go` `BuildDetail`). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd packages/generator/go -- -run 'TestFormCompleteSuite|TestListRenderSuite|TestDetailRenderSuite'` exit 1, 250 subtest 중 7개 실패(`reject-record-before-fields`, `reject-record-before-context`, `reject-non-object-record`, `reject-object-rows`, `reject-rows-before-columns`); green: exit 0이며 250 subtest가 통과하고, 변경된 API를 호출하는 파일의 27개 test(89 subtest)가 통과하며 `go vet` exit 0입니다.

### 2026-10-20 — PHP generator와 PHP extension은 공유 list-render와 detail-render suite를 실행한다 (C16.87)

- `packages/generator/php/tests/ListRenderConformanceTest.php`와 `DetailRenderConformanceTest.php`(신규, trait `LayoutTree.php`)는 list case 157개와 detail case 62개를 실행합니다. PHP 라이브러리와 extension은 `renderList`, `buildList`, `renderDetail`, `buildDetail`의 인수 모양을 인수 순서대로 검사합니다(`Generator`, `Internal/Lists.php`, `Internal/Details.php`, `polyspec_crudui.stub.php`, `polyspec_crudui_arginfo.h`, `crudui.c`). 빈 배열을 포함한 목록 배열은 객체가 아니고, 다른 타입의 값은 그 규칙의 메시지로 실패하며, `data`는 객체 옵션입니다. 명세, record, `data`에 `[]`를 넘기던 기존 PHP 호출자(`DisplayRulesTest`, `DetailTest`, `ApiReport.php`)를 고치고, 네이티브 PHP program은 디코딩한 JSON 값을 라이브러리에 그대로 넘깁니다. 규칙은 `docs/spec/display-formats.md`에 있습니다(C16.87). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs phpunit --cwd packages/generator/php -- tests/ListRenderConformanceTest.php tests/DetailRenderConformanceTest.php` exit 1, 221개 중 13개 실패(`reject-string-specification`은 TypeError, `reject-array-specification`, `reject-array-context`, `reject-record-before-context` 등); green: 같은 실행 exit 0, 221 OK, `make test-php-ext CASES=ListRenderConformanceTest|DetailRenderConformanceTest` exit 0, 221 passed.

### 2026-10-20 — PHP generator와 PHP extension은 공유 form-complete suite를 실행한다 (C16.85)

- `packages/generator/php/tests/FormCompleteConformanceTest.php`(신규)는 `tests/fixtures/form-complete/cases.json`의 28개 case를 `Generator::compileForm`, `new Form`, `Generator::renderForm`으로 렌더링하고 출력을 `expected_html`과 byte 단위로 비교합니다. `expectError` case는 기록된 code와 message의 `FormError`를 발생시켜야 합니다. 이 파일은 public API만 쓰므로 네이티브 PHP extension도 실행합니다(`make test-php-ext`) (C16.85). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs phpunit --cwd packages/generator/php -- tests/FormCompleteConformanceTest.php` exit 1, 파일이 없어 선택 없이 실행이 거부됨; `make test-php-ext CASES=FormCompleteConformanceTest` exit 2, `selects no test`; green: 두 명령 모두 exit 0이며, phpunit은 29 tests와 45 assertions가 OK이고 extension 실행도 같은 29 tests를 통과합니다.

### 2026-10-20 — Go generator는 공유 form-render suite를 실행한다 (C16.82)

- `packages/generator/go/form_render_suite_test.go`(신규)는 `tests/fixtures/form-render/cases.json`의 188개 case를 Go generator로 실행합니다. 137개 result case는 compile, bind, render하며 그 HTML은 공유 normalizer `tests/fixtures/form-render/normalize.mts`(tsx로 node가 실행)가 만든 layout과 비교하고, 51개 failure case는 기록된 code를 발생시켜야 합니다(C16.82). `instance.go`는 누락된 repeated data의 초기 row에 key `__0000000000000__`를 주고, `AddRow`가 만드는 row에만 fresh key를 줍니다(`normalizeFields`, `normalizeRow`가 `fresh`를 받음). Python과 TypeScript reference와 같습니다. 이전에는 `NewForm`이 임의 key를 뽑아 새 instance가 다른 form을 그렸습니다(`multiple-leaf-empty-placeholder`). Red: `go test -run TestFormRenderSuite`가 exit 1이며 188 subtest 중 1개가 실패(`multiple-leaf-empty-placeholder`: 새 instance가 다른 form을 그림); green: exit 0이며 188 subtest가 통과하고, `go test -run Test ./...` exit 0, `golangci-lint run` exit 0이며 0 issues.

### 2026-10-20 — list와 detail validity suite는 test하는 display 요구를 인용한다 (C16.57-8)

- `tests/fixtures/list-validity/cases.json`과 `tests/fixtures/detail-validity/cases.json`은 case의 `requirements`(CUDF id가 있는 case 각각 7개와 4개)를 가지며, `config/parity.json`은 unit `list-validity`와 `detail-validity`를 이 test의 binding 여섯 개와 함께 선언한다(C16.57-8). Red: `make parity-declarations-check`가 `CUDF-001`부터 `CUDF-088`까지 88개의 `R13`과 validity 파일마다 `R4`를 보고했다. Green: CUDF id 53개가 인용되지 않은 채 남으며, 그중 24개는 CUDF-024부터 CUDF-082까지(`CUDF-024`, `025`, `026`, `028`~`031`, `033`, `035`~`039`, `042`, `063`, `065`, `067`, `070`~`076`)이고 29개는 범위 밖(display model과 rendering id)이다. 두 unit의 `R4`는 사라졌다. `make item-test`에서 binding의 owner test가 통과한다: ts 35, php 20과 14, extension 아래 `make test-php-ext` 34, go 35, rust 4. python은 `var/python`이 virtual environment가 아니어서 막혀 있다(C16.57-8).
- `scripts/check-schema.mts`는 structure-validity case의 `requirements` 멤버를 받아들이며, 이 멤버는 각 id를 한 번씩 적은 비어 있지 않은 배열이다(C16.57-8). Red: `make land`가 docs-check에서 `list-validity:ok-minimal-columns: unknown member requirements`로 branch를 거부했다. Green: `node scripts/check-schema.mts`가 608개 specification check와 함께 exit 0이다.

### 2026-10-20 — runAction은 모든 implementation에서 성립한다 (C16.50)

- support value가 pass만 남은 뒤(C16.54) `make divergence-check`는 exit 0이고 runAction 항목을 보고하지 않으므로, `contracts/features.json`이 선언한 대로 runAction은 php, go, rust, php-native, python에 구현되어 있습니다(C16.50). Red: C16.54 이전에는 supportValues 항목에서 실패했고, green: exit 0입니다.

### 2026-10-20 — contracts/features.json에는 partial과 unsupported support 값이 없다 (C16.54)

- `contracts/features.json`은 `supportValues`를 `pass`만으로 선언하고, `contracts/features.schema.json`은 `supportValues` 항목과 feature `support` 값으로 `pass`만 받습니다(C16.54). `scripts/features-manifest.mts`는 `SupportValue`를 `pass`로 정의하고, `scripts/check-conformance.mts`는 `pass` runtime의 case만 요구하며 partial 분기와 unsupported 사유를 두지 않습니다. `tests/build/conformance-evidence.test.mts`는 partial runtime test를 빼고 unsupported runtime 대신 선언되지 않은 runtime을 읽으며, `tests/build/contract-manifest.test.mts`는 새 manifest 값을 씁니다. feature `status`의 `partial`은 다른 필드이므로 남깁니다. Red: `make divergence-check`가 exit 2이며 `contracts/features.json`이 supportValues의 `partial`과 `unsupported`(408-409행)를 명명; green: exit 0이며 supportValues entry를 명명하지 않고, 두 build test와 `make manifest-docs-check`가 exit 0(각각 14, 9 passed).

### 2026-10-20 — runAction을 php, go, rust, php-native, python에 선언한다 (C16.50)

- `contracts/features.json`에서 `runAction`의 support를 `php`, `go`, `rust`, `php-native`, `python`에 대해 `pass`로 바꾸고(C16.50), form-actions test를 tests 목록에, go, python, rust, php 검증 명령을 추가합니다. row의 Verification 셀은 manifest test, manifest docs check, divergence check를 명명합니다. 생성된 feature contract 문서가 이를 따릅니다. Red: `make divergence-check`가 exit 2이며 `contracts/features.json`이 다섯 implementation의 `runAction`을 unsupported로 명명; green: 이 check는 `runAction`의 entry를 명명하지 않습니다. python, rust, php 명령은 통과했고, go 명령은 module 안에서 `go test -run TestFormActions`로 통과하지만 runner의 mise 호출이 worktree의 `mise.toml`을 신뢰하지 않는다고 보고합니다. php-native support는 C16.51, C16.52와 같이 php-ext 실행 없이 선언했습니다.

### 2026-10-20 — validator text-validity suite는 입력 텍스트 requirement CUIT-001부터 CUIT-009, CUIT-023부터 CUIT-028, CUIT-037부터 CUIT-040까지를 인용한다 (C16.57-5)

- `tests/fixtures/text-validity/validate`, `validateList`, `validateDetail`의 case는 `requirements` 배열을 가지며, 이 vector 파일은 생성되지 않으므로 손으로 씁니다. 짝이 없는 surrogate escape를 가진 case와 유효한 짝 case는 CUIT-001부터 CUIT-004와 decoder인 CUIT-037부터 CUIT-040을, `INVALID_TEXT`를 기대하는 case는 CUIT-023부터 CUIT-025를, `Text must be Unicode scalar values: {name}` 입력 실패를 기대하는 case는 CUIT-026부터 CUIT-028을 인용합니다. 순서 case는 CUIT-005와 CUIT-006을, `basepath` case는 CUIT-007을 인용하며, `validate`의 모든 case는 CUIT-008, `validateList`와 `validateDetail`의 모든 case는 CUIT-009를 인용합니다(C16.57-5). `config/parity.json`은 suite unit 세 개, `text-validity-validate`, `text-validity-validate-list`, `text-validity-validate-detail`을 여섯 binding과 함께 선언합니다. ts(`text-validity.conformance.test.ts`), php와 php-extension(`TextValidityConformanceTest::testInputTextMatchesFixture`), go(`TestInputTextMatchesFixture`), rust(`input_text_matches_fixture`), python(`test_text_validity.py`)입니다. Red: `make parity-declarations-check`가 exit 2이며 finding 548건, CUIT-001부터 CUIT-040까지의 R13 40건과 세 cases 파일의 R4 3건이었습니다. Green: exit 2이며 finding 521건, CUIT-010부터 CUIT-022, CUIT-029부터 CUIT-036까지의 R13 21건, 세 파일의 R4 0건, 새 unit의 R14, R15, R2 0건입니다. 인용하지 않은 항목: CUIT-010부터 CUIT-020과 생성 연산(`compileForm`, `bindForm`, `createForm`, `buildList`, `buildDetail`)은 TypeScript와 Python generator만 자체 test로 실행하므로 여섯 binding을 선언할 수 없고, CUIT-021, CUIT-022, CUIT-029부터 CUIT-031은 value-graphs.json에 있으며 Rust validator가 설계상 실행하지 않고, CUIT-032부터 CUIT-036은 각 runtime의 error type이라 공유 case가 기록하지 않습니다. 이 row가 아닌 finding은 `packages/generator/python/tests/test_text_validity.py`의 R5와 form-actions의 R2입니다. Owner test는 `make item-test`로 실행했으며, ts vitest 53 passed, rust 1 passed, python 4 passed, PHP 라이브러리 45 passed, PHP extension(`make test-php-ext CASES='TextValidityConformanceTest'`) 45 passed, go `TestInputTextMatchesFixture` subtest 33건 passed입니다.

### 2026-10-20 — 공유 suite가 test하는 runtime package 요구는 그 unit이 인용한다 (C16.57-6)

- `tests/fixtures/validate/generate.mts`는 `tests/fixtures/validate/cases.json`의 모든 case에 `CURP-018`(validate 연산)과 `CURP-022`(record data 검증과 오류 보고)를 인용한다. `tests/fixtures/form-state/generate.mts`는 `form-view`, `form-history`, `form-actions`의 모든 session에 `CURP-010`(instance 생성)과 `CURP-012`(data 읽기)를, `setData` step이 있는 session에 `CURP-011`(data 교체)을, 행 연산이 있는 session에 `CURP-027`(행 key와 행 연산)을 인용한다. `config/parity.json`은 unit `validate`, `form-view`, `form-history`, `form-actions`에 이 id를 인용하고, `form-actions`에 `php-extension` binding을 준다. 이 binding은 extension이 실행하는 `FormStateTest`의 action session이다(C16.57-6). Red: `make parity-declarations-check`가 `CURP-001`부터 `CURP-027`까지 27개의 `R13`과 `form-actions`에 `php-extension` binding이 없는 `R2` 1개를 보고했다. Green: `CURP` id 21개가 여전히 인용되지 않는다(`CURP-001`~`CURP-009`, `CURP-013`~`CURP-017`, `CURP-019`~`CURP-021`, `CURP-023`~`CURP-026`). 인용된 id 6개와 `R2` finding의 제거를 확인했다. 모든 binding의 owner test가 통과한다(`make item-test`: validate는 vitest 319, go 319, cargo 1, python 3, phpunit 318; form-state는 vitest 28, go 20, cargo 4, python 4; extension 아래 `FormStateTest|ValidateConformanceTest`는 352와 28이 통과)(C16.57-6).

### 2026-10-20 — PHP extension이 form action을 실행한다: resolveAction과 runAction (C16.50-5)

- `packages/php-ext/src/actions.c`(새 파일)는 PHP library의 action 11개 이름으로 `ps_resolve_action`과 `ps_run_action`을 구현한다. 실행은 각 연산을 `ps_form_apply`로 적용하므로(`add-row`, `copy-row`, `remove-row`, `toggle-row`, `move-up`, `move-down`, `expand-all`, `collapse-all`, `undo`, `redo`) 실패한 연산은 form을 바꾸지 않는다. `crudui.c`는 `Generator::resolveAction`과 `Generator::runAction`을 추가하며, `polyspec_crudui.stub.php`와 `polyspec_crudui_arginfo.h`가 이를 선언한다(C16.50-5). Red: `make test-php-ext CASES='FormStateTest'`가 선언 단계에서 exit 2로 실패했고, `Generator::resolveAction`과 `Generator::runAction`이 누락("extension none")되어 있었다. Green: `make lint-php-ext`가 exit 0이고, `make test-php-ext CASES='FormStateTest'`도 exit 0이다. generator suite는 extension 위에서 28개 test를 실행하며, form action session 9개(`resolve-action-names`부터 `run-action-unknown-name`까지)를 포함해 통과한다. validator와 php-ext library에는 CASES가 고른 case가 없다(C16.50-5).

### 2026-10-20 — expression suite는 test가 CUXP 요구사항을 이름으로 밝히는 unit이 인용한다 (C16.57-3)

- `packages/validator/ts/scripts/generate-expr-cases.mts`가 `tests/fixtures/expr/cases.json`의 각 case에 `requirements` 목록을 기록합니다. docs/spec/expressions.md의 CUXP id 가운데, case가 그 id가 정의하는 토큰 종류(CUXP-001 ~ CUXP-017), 공백(CUXP-016), 트리 노드(CUXP-018 ~ CUXP-023)를 포함하는 것을 나열하며, 거부 case는 토큰에서 같은 방식으로 나열합니다. `config/parity.json`은 이 파일을 덮는 suite unit `expr`을 선언하며, CUXP-001 ~ CUXP-023과 ts, go, python, rust, php binding을 가집니다. php-extension binding은 없습니다: extension은 expression API를 등록하지 않으므로 `make test-php-ext CASES='ExprConformanceTest'`는 PHP library의 `Expr` 소스를 로드하고 kit가 그 실행을 거부합니다. parity check는 C16.81 행이 extension의 expression API를 정할 때까지 그 R2 finding을 유지합니다(C16.57-3). Red: `make parity-declarations-check`가 exit 2이고 finding 603건이며, 그중 CUXP-001 ~ CUXP-023에 대한 R13이 23건, `tests/fixtures/expr/cases.json`에 대한 R4가 1건입니다. Green: 이 커밋의 main에서 exit 2, finding 576건이며, 이 id들의 R13, R4, R14, R15는 0건이고 `expr`의 php-extension에 대한 R2가 1건입니다. Owner test(`make item-test`): ts 74 passed; go `TestExpressionMatchesFixture` 283 passed; python `tests.test_expr` 4 passed; rust `expr_conformance` 4 passed; phpunit `ExprConformanceTest.php` 78 passed. CUXP-010은 GT, GE, LT case가 인용하며, `<=`(LE)를 포함한 case가 없어 LE 토큰은 시험되지 않습니다.

### 2026-10-20 — validate suite는 검증 규칙 requirement CUVR-001부터 CUVR-011, CUVR-013부터 CUVR-057까지를 인용한다 (C16.57-4)

- `tests/fixtures/validate/generate.mts`는 `REQUIREMENTS` map에서 `cases.json`의 case 270건에 `requirements`를 씁니다. case는 기대 error가 그 규칙을 보고하면 CUVR-001부터 CUVR-011, CUVR-013부터 CUVR-016을, 명세의 parameter 메시지나 error code이면 CUVR-041부터 CUVR-057을, 숨겨진 필드이면 CUVR-017을 인용하며, 이름과 note가 시험하는 구성을 밝히는 case는 CUVR-018부터 CUVR-040을 인용합니다. map은 CUEC-003, CUEC-005, CUEC-006도 유지합니다(C16.57-4). `config/parity.json`은 인용한 id 56건을 `validate` unit의 requirements에 추가합니다. CUVR-012(`date`, `dateISO`)는 어느 suite에도 case가 없어 인용하지 않았고, CUVR-002는 `url` case가 없어 `email` case만 인용합니다. list-validity, detail-validity, spec-validity suite는 규칙이 아니라 명세의 형태(key, 금지 member, 배치)를 시험하므로 아무것도 인용하지 않으며 여기서 unit을 선언하지 않습니다. Red: `make parity-declarations-check`가 exit 2이며 finding 603건, 그중 CUVR-001부터 CUVR-057까지의 R13 57건이었습니다. Green: exit 2이며 finding 547건, R13은 CUVR-012 1건, validate unit의 R14와 R15는 0건입니다. CUEC-001, CUEC-002, CUEC-004, CUEC-007의 R13과 다른 row의 R2, R6 finding은 그대로입니다. Owner test: ts vitest `validate.conformance.test.ts` 319 passed, rust `validate_matches_fixture` 1 passed, python `tests.test_validate` 3 passed, PHP 라이브러리 `ValidateConformanceTest` 318 passed, go `TestValidateMatchesFixture`는 packages/validator/go에서 `mise exec -- go test -v`로 실행하여 subtest 318건과 상위 test가 통과했습니다. php-extension binding은 C16.70이 main에 들어온 뒤 실행해야 하므로 여기서 실행하지 않았습니다.

### 2026-10-20 — validate suite는 빈 collection requirement CUEC-003, CUEC-005, CUEC-006을 인용한다 (C16.57-2)

- `tests/fixtures/validate/generate.mts`는 `REQUIREMENTS` map에서 `cases.json`의 case 9건을 지정하고 그 `requirements`를 씁니다. `input-repeated-group-array`, `input-repeated-scalar-null`, `input-nested-repeated-array`, `visibility-hidden-data-shape`는 CUEC-003을, `multiple-only-missing-data-required`, `multiple-only-missing-data-mincount`, `multiple-only-missing-data-valid`는 CUEC-005를, `visibility-hidden-group-descendants`, `visibility-hidden-value-still-read`는 CUEC-006을 인용합니다. `config/parity.json`은 `tests/fixtures/validate/cases.json`의 suite unit `validate`를 선언하며, 범위의 requirement와 여섯 binding을 가집니다: ts, go, rust, python은 case를 실행하고, php와 php-extension은 PHP 라이브러리 test `ValidateConformanceTest::testValidateMatchesFixture`를 지정합니다(C16.57-2). Red: `make parity-declarations-check`가 exit 2이며 finding 650건이고, 그중 CUEC-003, CUEC-005, CUEC-006의 R13 3건과 `tests/fixtures/validate/cases.json`의 R4 1건이었습니다. Green: exit 2이며 finding 641건이고, 해당 id의 R13은 0건, validate의 R4는 0건, R15와 R14는 0건입니다. 남은 R2(history-functions, php-extension)와 R6은 이 row의 범위가 아닙니다. CUEC-001, CUEC-002, CUEC-004, CUEC-007은 여섯 implementation이 모두 실행하는 bindForm suite가 필요하므로 인용하지 않았습니다. Owner test: ts vitest `validate.conformance.test.ts` 319 passed, go `TestValidateMatchesFixture` 318 subtest passed(kit runner가 worktree의 mise.toml을 읽지 못해 packages/validator/go에서 `mise exec -- go test`로 실행), rust `validate_matches_fixture` 1 passed, python `tests.test_validate` 3 passed, PHP 라이브러리 `ValidateConformanceTest` 318 passed. php-extension binding은 여기서 실행하지 않았습니다. 이 binding은 Support/JsonText.php를 읽으므로 C16.70이 validator test를 고치기 전까지 extension에서 통과하지 않습니다.

### 2026-10-20 — form-state suite는 test가 이름을 밝히는 unit이 인용한다 (C16.57-1)

- `config/parity.json`이 `tests/fixtures/{form-view,form-history,form-actions,view-functions}/cases.json`을 덮는 suite unit 네 개를 선언하며, 각 unit은 case가 나열한 요구사항을 인용합니다. form-view는 CURT-009, 010, 066, 067, 068, 073, 074, 075, form-history는 CURT-011, 012, 061 ~ 065, 067, form-actions는 CURT-011, 012, 081 ~ 091, view-functions는 CURT-068 ~ 075입니다. 각 unit은 ts, go, python, rust, php binding을 가지며, PHP extension이 실행하는 세 family는 php-extension binding도 가집니다. form-actions는 extension에 `resolveAction`과 `runAction`이 없어 php-extension binding이 없습니다. `history-functions`에는 php-extension binding과, 그 case가 나열하는 CURT-062를 추가했습니다(C16.57-1). Red: `make parity-declarations-check`가 exit 2이고 finding 650건이며, 그중 이 family들의 id에 대한 R13이 29건, 네 cases 파일에 대한 R4가 4건, `history-functions`의 php-extension에 대한 R2가 1건입니다. Green: exit 2, finding 612건; 이 family의 R13, R4, R14, R15는 0건이고, 보고된 R2 1건(form-actions의 php-extension binding 누락)이 남습니다. Owner test: vitest `src/form-state.test.ts` 28 passed; go `-run 'TestFormActions|TestFormHistory|TestFormView|TestViewFunctions'` 32 passed; python `tests.test_form_state` 4 passed; rust `--test form_state` 4 passed; phpunit `tests/FormStateTest.php` 28 passed, `tests/HistoryFunctionsTest.php` 13 passed; php-extension(PHP 8.4, `var/php-ext/polyspec_crudui.so` 로드): FormStateTest의 세 method filter는 19 tests 통과, form-actions session 9건은 `resolveAction` 부재로 실패, HistoryFunctionsTest는 13 passed.

### 2026-10-20 — formHistory를 php, go, rust, php-native, python에 선언한다 (C16.52)

- `contracts/features.json`에서 `formHistory`의 support를 `php`, `go`, `rust`, `php-native`, `python`에 대해 `pass`로 바꾸고(C16.52), 해당 history test를 tests 목록에 추가하며, go, python, rust, php 검증 명령을 추가합니다(C16.52-2..11은 main에 있음). 생성된 feature contract 문서가 이를 따릅니다. Red: `make divergence-check`가 exit 2이며 `contracts/features.json`이 다섯 implementation의 `formHistory`를 unsupported로 명명; green: 이 check는 `formHistory`의 entry를 명명하지 않습니다. 이 worktree에서 python과 rust 검증 명령(`tests.test_form_history`, `--test history_functions`)은 통과했습니다. go 명령은 runner가 worktree의 `mise.toml`을 신뢰하지 않는다고 보고하여 재현하지 못했고, php 명령은 Composer 의존성이 PHP 8.5 이상을 요구하여 재현하지 못했습니다. php-native support는 같은 PHP 사유로 php-ext 실행 없이 선언했습니다.

### 2026-10-20 — viewState를 php-native에 선언한다 (C16.51)

- `contracts/features.json`에서 `viewState`의 `php-native` support를 `pass`로 바꿉니다(C16.51). 모든 implementation이 C16.51-7(f6b52795)부터 view state를 가지며 PHP extension도 포함됩니다. 생성된 feature contract 문서가 이를 따릅니다. Red: `make divergence-check`가 exit 2이며 `contracts/features.json`이 `viewState`의 `php-native`를 unsupported로 명명; green: 이 check는 `viewState`의 entry를 명명하지 않으며 남은 finding은 다른 row의 것입니다. 이 worktree에서는 Composer 의존성이 PHP 8.5 이상을 요구하여 php-ext의 `FormStateTest` 검증을 실행할 수 없었으므로 검증 목록에 추가하지 않았습니다.

### 2026-10-20 — PHP validator contract test는 library의 내부 class를 읽지 않는다 (C16.70)

- `packages/validator/php/tests/Validate/TextValidityConformanceTest.php`는 fixture를 private `decodeFixture`로 읽습니다. 이 함수는 `json_decode`로 읽고, unpaired surrogate escape를 private-use code point로 바꿨다가 복원하므로 `Support\JsonText`를 쓰지 않습니다. 내부 `Support\Text`와 `Support\JsonText`를 직접 검사하던 부분은 `packages/validator/php/tests/Validate/TextInternalsTest.php`로 옮겼고, 이 test는 PHP source를 읽으므로 library에서만 실행합니다(P32, C16.70). `packages/validator/php/tests/Validate/UniqueValuesTest.php`는 한 validation의 row를 내부 `Validate\Validator` 대신 `Validator::validate`로 검사합니다. pure PHP runtime을 가정하던 `assertFalse(isInternal())` 검사를 conformance test와 `PublicApiTest`에서 제거합니다(S10: library test는 extension에 따라 분기하지 않으며, kit의 `test-php-ext`가 library source가 읽히지 않았는지 검사합니다). Red: 이전 test 파일로 `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES='TextValidityConformanceTest'`가 exit 2이며 `A source of the PHP library was loaded, so the run did not test the extension: .../packages/validator/php/src/Support/JsonText.php`를 보고했습니다. Green: 일곱 CASES `ValidateConformanceTest|ListValidateConformanceTest|DetailValidateConformanceTest|ForbiddenScanConformanceTest|MessagePlaceholderTest|UniqueValuesTest|TextValidityConformanceTest`가 exit 0이고 440 passed이며 source가 읽히지 않았습니다. 변경한 파일의 library PHPUnit 실행은 OK(444 tests)입니다.

### 2026-10-20 — Go native program은 타입이 잘못된 member를 거부한다 (C16.79)

- `tests/native-generators/programs/go`는 요청 member를 Rust program과 같이 읽습니다(C16.79). `compileOptions`와 `optionText`는 `basepath`, `keyPrefix`, `language`와 `files` object가 text 또는 object가 아니면 입력 오류로 반환하고, 없는 member는 없는 채로 둡니다. `stringArg`와 `addOptions`는 타입이 잘못되었거나 없는 action 인자를 보고하며, `main_test.go`(신규)가 각 경우를 보입니다. Red: `go test -run Test ./...`가 exit 1이며, 잘못된 `basepath`, `keyPrefix`, `files`, `language`가 오류 없이 지나갔고 `getValue` 인자는 `Invalid form path: `로 보고되었습니다; green: exit 0, `go build` exit 0, `golangci-lint run` exit 0이며 `0 issues`.

### 2026-10-20 — kit 사본은 kit f7c1f10c를 따른다 (C16.80)

- `scripts/kit/kit-bootstrap.mk`와 `scripts/kit/bootstrap/install-mise.mts`는 `make kit-sync`가 쓴 0b74e988(f7c1f10c 포함)의 kit 사본이며(K354, K394, K386, K348-1, K360-2, K349-2, K390-1, K392-1, K393), `make hooks`가 hook과 그 merge 설정을 설치합니다(C16.80). Red: `make kit-check`가 다른 사본 1개(`scripts/kit/kit-bootstrap.mk`)로 exit 2였고, green: 통과합니다.

### 2026-10-20 — native generator Go 프로그램은 숨은 오류를 처리한다 (C16.67-5)

- `tests/native-generators/programs/go/main.go`는 kit lint가 보고하는 오류를 검사합니다 (C16.67-5). `obj`와 `str`은 다른 타입의 값을 `ok` 검사로 nil 또는 빈 문자열로 읽으며, 각 호출자는 이를 이미 오류로 보고하거나 부재로 읽습니다. `run`은 action의 method를 `str`로 읽고, `errorObject`는 `errors.As`로 `ComposeLoadError`와 `UnsupportedFieldTypeError`를 찾습니다. 라이브러리가 두 오류 타입을 감싸지 않고 반환하므로 동작은 바뀌지 않습니다. Red: `golangci-lint run --config=../../../../.golangci.yml ./...`가 `5 issues`(errcheck 3, errorlint 2)로 exit 1; green: exit 0이며 `0 issues`, `go build -o /dev/null ./...`는 exit 0입니다(이 프로그램에는 Go test가 없고 conformance suite가 실행합니다).

### 2026-10-20 — offline-checks test는 설치된 kit가 정의하는 online target을 나열한다 (C16.7-8-1)

- `tests/build/offline-checks.test.mts`는 kit의 online target을 목록 `KIT_DOWNLOADS`와 함께 설치된 `@polyspec/kit`의 `kit.mk`(`KIT_ONLINE`, recipe가 `$(ONLINE)`을 실행하는 target)에서 읽으므로, 새 kit의 `worktree-setup`(K348)이 그 online target으로 나열됩니다(C16.7-8-1). Red: kit를 link한 상태에서 `node node_modules/@polyspec/kit/dist/run-tests.mjs node -- tests/build/offline-checks.test.mts`가 exit 1이며 `the Makefile runs cargo, go, npm and Composer offline, and only the install targets lift it`가 `+ 'worktree-setup'`을 보고했습니다. Green: 같은 명령이 kit를 link한 상태에서 exit 0입니다.

### 2026-10-20 — make lint-ts가 다시 통과한다 (C16.73)

- `tests/build/offline-checks.test.mts`는 미사용 import `makeDryRun`을, `packages/php-ext/tests/engine/support.mjs`는 미사용 import `test`를 뺍니다(oxlint). `examples/form-comparison/src/local-servers.mjs`는 상수 `orderedJsonExtensionDirectory`를 모듈 안에만 둡니다(knip, C16.69가 남긴 미사용 export). `config/knip-entries.json`은 `packages/react`의 entry `src/index.ts`와 `src/server.ts`를 선언합니다. `./server` export가 knip이 미사용으로 보고한 타입 `RenderListOptions`를 이름으로 가지며, 이 타입은 공개 `renderList`의 option 타입이고 svelte와 vue entry도 같이 re-export합니다(C16.73). Red: `make lint-ts`가 exit 2이며, `oxlint: failed`는 finding 2건(`tests/build/offline-checks.test.mts:15`와 `packages/php-ext/tests/engine/support.mjs:7`의 `no-unused-vars`), `knip: failed`는 finding 2건(`examples/form-comparison/src/local-servers.mjs:23`의 `orderedJsonExtensionDirectory`, `packages/react/src/server.ts:12`의 `RenderListOptions`)을 보고했습니다. Green: `make lint-ts` exit 0, `packages/php-ext/tests/engine/engine.test.mjs` 27 passed, `examples/form-comparison/src/local-servers.test.mjs` 6 passed, `packages/react` vitest의 `entry-boundary`와 `list-render.conformance` 262 passed.

### 2026-10-20 — PHP extension Form은 undo history를 가진다: undo, redo, canUndo, canRedo (C16.52-11)

- `packages/php-ext/src/form.c`는 form instance마다 undo history를 가진다(`struct ps_form`의 `history`, `history.c`가 만든다). `commit`은 값 편집의 dotted path(`setValue`, `dotted_path`) 또는 행 작업의 null path(`addRow`, `moveRow`, `copyRow`, `removeRow`, `rekeyRow`)와 함께 이전 record를 기록한다. `replace_data`(`setData`)는 history를 다시 시작하고, undo와 redo는 `step_form`과 `install`로 record를 바꾸며 view를 유지한다. `canUndo`와 `canRedo`는 history 질의를 반환한다. `crudui.c`는 method `Form::undo`, `redo`, `canUndo`, `canRedo`를 추가하고, `polyspec_crudui.stub.php`와 `polyspec_crudui_arginfo.h`가 이를 선언한다(C16.52-11). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make test-php-ext CASES='FormStateTest|HistoryFunctionsTest'`가 선언 단계에서 exit 2로 실패했고, 누락된 method는 Form undo, redo, canUndo, canRedo 4개다. Green: `make lint-php-ext`가 exit 0이고, 같은 test 명령도 exit 0이며, generator suite가 extension 위에서 32개 test(FormStateTest와 HistoryFunctionsTest, form-history session 5개 포함)를 실행해 통과한다. validator와 php-ext library는 CASES가 test를 고르지 않아 건너뛴다(K390)(C16.52-11).

### 2026-10-20 — PHP extension이 view state와 history 함수를 등록한다 (C16.51-7)

- PHP extension은 `Generator::initialView`, `collapsibleRows`, `setAllExpandedView`, `toggleRowView`, `removeRowView`, `rekeyRowView`, `emptyHistory`, `recordChange`, `canUndo`, `canRedo`, `undoChange`, `redoChange`(`packages/php-ext/src/crudui.c`, `view.c`, `history.c`), `Form::toggleRow`, `Form::setAllExpanded`(`form.c`, `crudui.c`), form instance의 view(`form.c`), `bindForm` 옵션 `collapsed`(`binding.c`)를 등록하며, extension의 stub과 arginfo를 맞춘다(C16.51-7). Red: `make test-php-ext CASES='FormStateTest|HistoryFunctionsTest'`가 extension과 PHP library의 차이를 보고했다: method 14개 누락(`Form::setAllExpanded`, `Form::toggleRow`, `Generator`의 view와 history method 12개). Green: `make lint-php-ext`가 exit 0이고, `make test-php-ext CASES='FormStateTest|HistoryFunctionsTest'`가 exit 0이다. 선언 단계가 통과하고, generator suite는 extension 위에서 27개 test(FormStateTest 14, HistoryFunctionsTest 13)를 실행해 통과하며, validator와 php-ext library는 CASES가 test를 고르지 않아 건너뛴다(K390)(C16.51-7). 앞선 실행에서 generator의 `FormTest|OutlineTest|RenderingConformanceTest`는 215개 test를 통과했다(C16.51-7).

### 2026-10-20 — Rust appearance는 expression을 한 번 파싱하고 fallback 없이 평가한다 (C16.77)

- `packages/generator/rust/src/design.rs`의 `appearance`는 문자열의 파싱을 한 번만 대조합니다. ternary와 condition expression은 파싱된 node를 `Evaluator::evaluate_value`로 평가하고, 파싱되지 않는 문자열은 literal text로 남으며, `unwrap_or(false)`를 가진 헬퍼 `expression_value`는 제거됩니다. `packages/generator/rust/src/tests.rs`에 `appearance_string_that_does_not_parse_stays_literal_text`와 `appearance_ternary_gives_the_branch_value`가 추가됩니다(C16.77). Rust evaluator는 오류를 보고하지 않으므로(데이터에 없는 path는 null), Python과 Go(b396f53e, 9e4be128)와 달리 되돌려 줄 평가 오류가 없습니다. 실패 주입은 validator crate의 변경이 필요하며 이 row의 범위가 아닙니다. Red: main에서 `appearance` test는 변경 전후 모두 통과(3 passed, 기존 test 포함)하므로 red를 기록할 수 없습니다. Green: exit 0, `appearance` 3 passed, `--test form_state --test history_functions` 17 passed, crate clippy exit 0입니다.

### 2026-10-20 — runAction은 열한 개 작업 중 어느 것도 아닌 이름을 거부한다 (C16.78)

- `docs/spec/form-runtime.md`에 CURT-091을 추가했습니다. 이름이 열한 개 작업 중 어느 것도 아닌 target의 `runAction`은 `INVALID_FORM_INPUT`과 `Unknown action: {name}`으로 실패하고 아무것도 바꾸지 않습니다(C16.78). `packages/generator/ts/src/actions.ts`의 `runAction`은 이름을 먼저 검사해 그 오류를 던집니다. 이전에는 move 분기로 빠졌습니다. `packages/generator/rust/src/actions.rs`에 `ActionTarget::named`를 추가해 알 수 없는 이름에 그 오류를 내게 했고, `packages/generator/rust/tests/form_state.rs`는 이름을 unwrap하는 대신 이 함수로 target을 만듭니다. `tests/fixtures/form-state/generate.mts`에 session `run-action-unknown-name`을 추가했고 `tests/fixtures/form-actions/cases.json`은 이 파일로 다시 생성했습니다. Red: 이전 `actions.ts`로 `node node_modules/@polyspec/kit/dist/run-tests.mjs vitest --cwd packages/generator/ts -- src/form-state.test.ts`가 exit 1, 27 passed와 1 failed(`run-action-unknown-name`); green: exit 0, 28 passed, 0 failed. Go와 Python(`tests.test_form_state`, 4 passed), Rust(`--test form_state`, 4 passed)는 이미 같은 메시지를 내며 새 case를 통과합니다.

### 2026-10-20 — PHP 소스와 예제는 phpcs 줄 길이 규칙을 통과한다 (C16.75)

- `packages/generator/php/src/Internal/History.php`는 `record`, `undo`, `redo`의 docblock을 120열에 맞추어 다시 줄을 나누고, `examples/form-comparison/servers/php`는 `api.php`와 `src/ApiServer.php`의 docblock과 `tests/FormGenerationTest.php`의 주석을 다시 줄을 나누며, 코드는 바꾸지 않습니다(C16.75). Red: `PATH=/opt/homebrew/opt/php@8.4/bin:$PATH make lint-php`가 exit 2이며 phpcs에서 Generic.Files.LineLength.TooLong 경고 8건(History.php 11, 12, 27, 57, 78; api.php 5; ApiServer.php 17; FormGenerationTest.php 291)이었습니다. Green: exit 0이며, phpunit `tests/HistoryFunctionsTest.php` 13 passed, form-comparison `tests/FormGenerationTest.php` 9 passed입니다.

### 2026-10-20 — form comparison Rust server는 kit lint가 보고하는 숨은 오류를 처리한다 (C16.67-14)

- `examples/form-comparison/servers/rust/src`는 `Result::ok`, `Result::unwrap_or`, `map_err_ignore` clippy finding을 처리합니다. `main.rs`의 `media_type`은 텍스트가 아닌 Content-Type을 없는 값으로 읽는 대신 오류를 반환하고, `generation.rs`와 `records.rs`가 이를 사용합니다. `records.rs`의 `positive_decimal`은 fallback(`u64`를 넘는 text는 모든 page 밖이다)을 가장 작은 item에 이유와 함께 남기고, `companies`와 spec, score 읽기는 원인을 담아 오류를 반환합니다. `json.rs`는 JSON number의 parse 오류를 이름 붙여 보고합니다. `tests.rs`의 `stored_bytes`는 없는 store 파일을 빈 store로 보고 다른 읽기 실패는 test를 실패시키므로, 저장되지 않음 검사가 파일을 읽지 못해도 통과하지 않습니다(C16.67-14). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason`가 finding 11건(`Result::ok` 6, `Result::unwrap_or` 1, `map_err` wildcard 4)으로 exit 101이었습니다. Green: exit 0이며, `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo ... tests::`가 18건 중 18건 통과합니다. 첫 실행에서 benchmark test가 실패했는데, 그 test가 읽는 store 파일이 fixture에 없었고 `.ok()`가 읽기 오류를 가리고 있었기 때문입니다. 이제 test는 그 부재를 기대합니다.

### 2026-10-20 — cross-check validator process는 검사하지 않던 오류를 검사한다 (C16.67-4)

- `examples/cross-check-console/validators/go/main.go`는 `parseRequest`의 basepath assertion을 검사하고 실패하면 요청 메시지 `Request basepath must be a string`을 반환하며, `fatal`과 `failure`의 `json.Marshal` 호출이 지키는 invariant는 메시지와 함께 panic으로 명시합니다(C16.67-4). 동작은 바뀌지 않습니다. 각 assertion은 그 지점에 도달하는 모든 요청에 대해 성립합니다. Red: `golangci-lint run --config=../../../../.golangci.yml ./...`가 `3 issues`(errcheck 3)로 exit 1이었고; green: exit 0이며 `0 issues`, `go build -o /dev/null ./...`는 exit 0입니다(모듈에 test가 없습니다).

### 2026-10-20 — ruff format이 보고하는 Python 파일을 포맷한다 (C16.74)

- `packages/generator/python`을 `ruff format`이 요구하는 형식으로 맞춥니다(C16.74). `src/polyspec/crudui/generator/form.py`는 `_normalize_row` signature와 dictionary key 식을 줄바꿈하고, `tests/test_form_state.py`는 `assertEqual` 호출 한 개를 한 줄로 합칩니다. 바뀐 것은 layout뿐입니다. Red: `ruff format --check --config ruff.toml .`이 `2 files would be reformatted`로 exit 1; green: exit 0이며 `250 files already formatted`, `make lint-python` exit 0, `tests.test_form_state`는 `4 passed, 0 failed`.

### 2026-10-20 — ordered-json을 버전 0.0.9로 소비한다 (C16.69)

- 루트 `package.json`은 `@polyspec/ordered-json`을 tag `v0.0.9`의 release asset `polyspec-ordered-json-npm-0.0.9.tgz`로 URL에 적어 선언하고, `package-lock.json`이 `@polyspec/kit`처럼 SHA-512 integrity로 고정합니다. 이전에는 `.form-comparison/sources`의 clone으로 `file:` 연결했습니다. `config/release-assets.json`은 PHP 확장 zip `polyspec-ordered-json-extension-php-0.0.9.zip`을 sha256으로 고정하고 `unpack`으로 `var/ordered-json-php-ext`에 풀며, `examples/form-comparison/src/local-servers.mjs`는 풀린 `src/`에서 `ordered_json` PHP 확장을 빌드합니다(`orderedJsonExtensionDirectory`, `orderedJsonCopyArguments`, `orderedJsonExtension`). 자체 clone은 제거합니다. 삭제: `examples/form-comparison/src/ordered-json-source.mjs`, `examples/form-comparison/src/ordered-json-source.test.mjs`, `examples/form-comparison/install-ordered-json.mjs`. make target `crudui-install-ordered-json`과 `install-packages`, `crudui-install-crates`의 선행 조건, `config/dependency-policy.json`의 `taggedNpmPackages`, `config/rebuild.json`과 `config/owner-checks.json`의 경로를 제거합니다(C16.69). 제거한 test: `tests/build/dependency-health.test.mts`의 "config/dependency-policy.json records the OrderedJSON tag that the comparison installs", `tests/build/atomic-publish.test.mts`의 "the OrderedJSON checkout" 항목, `tests/build/offline-checks.test.mts`의 "make install-packages starts the node of the checkout before kit is installed"와 "the OrderedJSON installer imports no package, since it runs before make install-packages". 변경한 test: `tests/build/dependency-health.test.mts`의 "npm installs only registry packages, linked directories and the kit release asset..."은 `@polyspec/ordered-json`의 release asset도 허용하고, `examples/form-comparison/src/local-servers.test.mjs`의 "the copy of the unpacked OrderedJSON extension source..."는 checkout 대신 `<extension>/src`를 읽습니다. Red: `node ../kit/dist/link.mjs check ../crudui ../kit ../ordered-json`이 exit 1이며 `NOT linked npm @polyspec/ordered-json (not recorded by npm query: .../node_modules/@polyspec/ordered-json)`를 보고했습니다. Green: exit 0이며 `linked npm @polyspec/ordered-json -> .../ordered-json/packages/js`, `examples/form-comparison/servers/go`의 `go -run Test ./...` exit 0, `examples/form-comparison/src/local-servers.test.mjs` exit 0, `make rebuild-check`와 `make owner-validate` exit 0, kit 연결을 끈 상태에서 build test(`dependency-health`, `atomic-publish`, `offline-checks`) 통과.

### 2026-10-20 — Rust generator는 kit lint의 숨은 오류를 처리한다 (C16.67-13)

- `packages/generator/rust/src/date.rs`는 식이 캡처한 숫자 묶음을 invariant 메시지(`CAPTURED_DIGITS`)와 함께 읽고, `design.rs`는 평가되지 않는 condition expression을 false로 두는 reference fallback을 헬퍼 `expression_flag`와 `expression_value`에 유지하며(`expr.ts`가 읽는 대로), `instance.rs`의 `move_row`는 변환 전에 위치를 검사하고, `list.rs`는 인덱스가 아닌 텍스트를 `choice-label`의 label로 유지하며 `pagination_model`에서 `pagination.per_page`의 오류를 전파하고, `number.rs`는 `decimal`에서 숫자가 아닌 텍스트를 reference대로 읽고, `util.rs`는 인덱스가 아닌 segment의 path lookup을 유지하며, `messages/mod.rs`와 `tests.rs`는 같은 동작의 `match`로 `unwrap_or_else`를 바꾸고, `tests.rs`에 `pagination_per_page_that_is_no_integer_is_an_error`가 추가됩니다(C16.67-13). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason`가 library에서 finding 21건(`Result::ok`, `Result::unwrap_or`, `Result::unwrap_or_else`)과 unit test에서 24건으로 exit 101이었습니다. Green: exit 0이며, `tests` 39 passed, `date` 2, `design` 3, `list` 6, `number` 2, `messages` 1, `--test form_state --test history_functions` 17 passed입니다.

### 2026-10-20 — Go generator는 appearance ternary의 평가 오류를 반환한다 (C16.72)

- `packages/generator/go`는 appearance 또는 show ternary의 평가 오류를 빈 문자열로 그리는 대신 반환합니다(C16.72). `design.go`의 `evalAppearance`, `evalShow`, `resolveParameter`, `resolveNode`, `resolveDesign`은 `(…, error)`를 반환하고, `bind.go`, `buttons.go`, `list.go`의 호출자가 이를 반환합니다. 파싱되지 않는 문자열은 literal text로 남습니다. `display_design_test.go`의 `TestAppearanceErrorsAreNotHidden`은 `evaluateValue` 변수로 실패를 주입하고 `NewForm`이 이를 반환함을 보입니다. Red: `go test -run TestAppearanceErrorsAreNotHidden`이 exit 1이며 `panic: expr: evaluating "1 > 0 ? 'btn-a' : 'btn-b'" after a successful parse: injected evaluation failure`; green: exit 0이며, `go test -run Test ./...`는 `161 passed, 0 failed`, `golangci-lint run`은 exit 0.

### 2026-10-20 — native Rust generator program은 kit lint가 보고하는 숨은 오류를 처리한다 (C16.67-9)

- `tests/native-generators/programs/rust/src/main.rs`의 `main`은 표준 입력을 읽는 오류를 버리지 않습니다. `std::io::ErrorKind::InvalidData` 오류(UTF-8이 아닌 입력)는 `Request must be valid JSON` 메시지를 유지하고, 그 밖의 읽기 실패는 `Cannot read the request: <error>`로 반환합니다(C16.67-9). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason`가 finding 1건(src/main.rs:340의 `map_err` wildcard pattern)으로 exit 101이었습니다. Green: exit 0, crate의 `cargo build --locked`도 exit 0이며, UTF-8이 아닌 표준 입력은 같은 오류 메시지와 exit 1을 유지합니다.

### 2026-10-20 — benchmark validator driver는 숨은 오류를 처리한다 (C16.67-3)

- `benchmarks/validators/go`는 `loadFixture`와 `benchSpec`의 오류(JSON이 아닌 fixture, JSON object가 아닌 spec, properties가 없는 spec)를 panic 대신 반환하고, `main`은 이를 출력한 뒤 exit 1로 끝납니다. `main`의 report JSON 인코딩은 메시지와 함께 invariant로 명시합니다. `main_test.go`는 잘못된 입력 경우를 검사합니다(C16.67-3). Red: `golangci-lint run`이 `3 issues`(errcheck 3)로 exit 1이었고, `go test -run Test ./...`는 `assignment mismatch: 3 variables but loadFixture returns 2 values`로 빌드되지 않았습니다; green: exit 0이며 `0 issues`, `go test -run Test ./...`는 `5 passed, 0 failed`입니다.

### 2026-10-20 — kit 사본은 kit f9eb43dd를 따른다 (C16.71)

- `scripts/kit/kit-bootstrap.mk`, `config/layout.kit.yml`과 새 commit-msg hook `.githooks/commit-msg`는 `make kit-sync`와 `make hooks`가 쓴 f9eb43dd의 kit 사본입니다(K348, K385, K384, K360-1, K383, K380, K382, K375)(C16.71). Red: `make kit-check`가 다른 사본 2개(`scripts/kit/kit-bootstrap.mk`, `config/layout.kit.yml`)로 exit 2였고, green: 통과합니다. `make link-check`는 아직 `@polyspec/ordered-json`(C16.69 행)과, `make link-check`에 주어지지 않는 Python 환경 `var/python`을 보고합니다.

### 2026-10-20 — Python generator는 resolveAction과 runAction을 가진다 (C16.50-2)

- `packages/generator/python/src/polyspec/crudui/generator/actions.py`가 CURT-081 ~ CURT-090의 열한 개 form action에 대한 `resolveAction`과 `runAction`을 추가하고, 이를 `Generator.resolveAction`, `Generator.runAction`으로 노출합니다. `form.py`는 데이터가 생략한 repeated field의 기본 row를 생성자, `setData`, `setValue`에서는 `__0000000000000__`(CUEC-002)로, `addRow`가 만든 row 안에서는 TypeScript reference와 `form-actions` session처럼 fresh key로 만듭니다. `tests/test_form_state.py`의 `TestFormActions`는 history flag와 함께 `form-actions` session을 실행합니다(C16.50-2). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs python --venv var/python --cwd packages/generator/python -- tests.test_form_state` exit 1, `form-actions` session 8개 중 7개가 관찰 결과에서 실패(두 함수는 None을 반환하는 stub); green: exit 0, 4 passed, 0 failed.

### 2026-10-20 — form comparison의 Rust record server는 view 옵션과 함께 빌드된다 (C16.51-5-1)

- `examples/form-comparison/servers/rust/src/generation.rs`의 `render`는 C16.51-5가 추가한 `BindOptions` 멤버 `collapsed`를 null, 즉 모든 행이 펼쳐진 초기 뷰(CURT-068)로 두며, test `compilation_and_cached_rendering_use_rust_and_preserve_order`는 렌더된 field의 접을 수 있는 행이 모두 펼쳐져 있음을 확인합니다(C16.51-5-1). Red: 서버의 `cargo test compilation_and_cached_rendering`이 `error[E0063]: missing field collapsed in initializer of BindOptions`로 끝나 test를 하나도 실행하지 않았고, green: 1 passed입니다.

### 2026-10-20 — cross-check console Rust validator는 kit lint가 보고하는 숨은 오류를 처리한다 (C16.67-8)

- `examples/cross-check-console/validators/rust/src/main.rs`의 `write_line`은 JSON 줄을 직렬화할 때 `Result::unwrap_or_else`와 잘못된 줄을 출력할 fallback `"{}"` 대신 invariant 메시지를 담은 `expect`를 사용합니다(C16.67-8). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason`가 finding 1건(src/main.rs:210의 `Result::unwrap_or_else`)으로 exit 101이었습니다. Green: exit 0이며, crate의 `cargo build --locked`도 exit 0입니다.

### 2026-10-20 — form-comparison Go 서버는 숨은 오류를 처리한다 (C16.67-2)

- `examples/form-comparison/servers/go`는 kit lint가 보고하는 모든 오류를 검사하거나 반환합니다 (C16.67-2). `repository.go`는 저장된 form 상태의 타입이 다르면 unchecked assertion 대신 오류를 반환하고(`storedRows`, `sortedRows`, `owned`, `checkParent`, `allocate`, `loadData`, `save`), `records.go`는 `submission`, `submittedForm`, `saveRecord`, `formText`, `recordView`의 오류를 반환하며 `storedRecord`는 `checkRecords`가 세우는 invariant를 명시합니다. `form.go`는 multipart 본문의 끝을 `errors.Is`로 비교하고 `fieldsOf`의 member 이름을 검사합니다. `json.go`는 `Members`, `Items`, `NumberLiteral`과 `numberText`의 `Atoi` 오류를 검사하고, `main.go`와 `generator.go`는 응답 쓰기 실패를 로그에 남기며 form 입력 오류는 `errors.As`로 찾습니다. 테스트는 `objectOf`, `arrayOf`, `textOf`, `mustEncode`, `mustRead` 도우미를 쓰며 `t.Fatal`로 실패합니다. Red: `golangci-lint run --config=../../../../.golangci.yml ./...`가 `66 issues`(errcheck 64, errorlint 2)로 exit 1; green: exit 0이며 `0 issues`, `go test -run Test ./...`는 `16 passed, 0 failed`입니다.

### 2026-10-20 — Go generator는 숨은 오류를 처리한다 (C16.67-12)

- `packages/generator/go`는 kit lint가 보고한 오류를 모두 검사하거나 반환합니다(C16.67-12). `bind.go`는 `design.layout`, `group_class`, `unsupported` 옵션을 검사된 assertion으로 읽고 문자열이 아닌 값을 오류로 반환하며, `buttons.go`는 button `behavior` script의 오류를 `bindButtons`, `BindButtons`, `RenderForm`으로 반환합니다. `instance.go`는 모든 row 작업의 path를 검사하고 `Form.Template`은 clone 오류와 함께 `(*FormTemplate, error)`를 반환합니다. `design.go`는 이미 파싱한 expression을 `evaluateParsed`로 평가하고, `date.go`와 `number.go`는 digit run을 invariant 메시지와 함께 읽으며, `date.go`는 매칭되지 않은 선택 group을 0으로 읽습니다. `widget.go`의 `json.Marshal`과 `Encode` 호출은 invariant로 명시합니다. `choice_list.go`, `form_render.go`, `list.go`, `template.go`, `value.go`, `examples/server/main.go`는 검사된 assertion, `copyObject`, `orderedObject`, `plainObject`, `errors.As`를 씁니다. Test는 fixture의 오류에서 `t.Fatal`로 실패합니다. Red: `golangci-lint run`이 `74 issues`(errcheck 73, errorlint 1)로 exit 1; green: exit 0이며 `0 issues`, `go test -run Test ./...`는 `160 passed, 0 failed`.

### 2026-10-20 — Rust native generator program은 i64 row index로 빌드된다 (C16.50-3-1)

- C16.50-3이 `Form::move_row`가 `i64`를 받게 바꾸었으므로, `tests/native-generators/programs/rust/src/main.rs`의 `moveRow` 연산은 index를 `i64`로 읽고 음수나 정수가 아닌 index는 계속 `Row position must be a nonnegative integer`로 거부합니다(C16.50-3-1). Red: `cargo build --locked --manifest-path tests/native-generators/programs/rust/Cargo.toml`이 `main.rs:147`에서 `error[E0308]: mismatched types`(expected `i64`, found `usize`)로 exit 101이었고, green: exit 0입니다.

### 2026-10-20 — Rust generator는 resolveAction과 runAction을 가진다 (C16.50-3)

- `packages/generator/rust/src/actions.rs`는 CURT-081부터 CURT-090까지의 form action 11개에 대해 `resolve_action`, `run_action`과 타입 `ActionName`, `ActionInput`, `ActionTarget`, `ActionResult`, `FocusTarget`을 추가합니다. `packages/generator/rust/src/instance.rs`의 `move_row`는 부호 있는 위치를 받아 첫 행보다 앞의 위치를 reference와 같은 메시지로 실패시킵니다. `packages/generator/rust/tests/form_state.rs`는 history flag를 켠 `form-actions` session을 `form_actions_sessions_equal_the_recorded_observations`에서 실행하며, 그 `perform`은 `resolveAction`과 `runAction`을 처리합니다(C16.50-3). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs cargo -- --locked --manifest-path packages/generator/rust/Cargo.toml --test form_state`가 exit 1, 3 passed와 1 failed였고, API를 0 값으로 stub한 상태에서 `form-actions` session `resolve-action-names`가 step 0에서 실패했습니다. Green: exit 0, 4 passed, 0 failed.

### 2026-10-20 — Rust benchmark는 kit lint가 보고하는 숨은 오류를 처리한다 (C16.67-7)

- `benchmarks/validators/rust/main.rs`는 `Result::unwrap_or_else`와 `Result::ok` clippy finding을 처리합니다. `load_fixture`와 `bench_spec`은 같은 read 및 parse 메시지를 담은 `Result<_, String>`을 반환하고, `main`은 그 메시지로 bench를 멈춥니다(잘못된 fixture는 여전히 exit 101). `count_argument`는 filter가 이미 검사한 digit을 invariant 메시지와 함께 파싱합니다(C16.67-7). Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason`가 finding 3건(main.rs:36과 :38의 `Result::unwrap_or_else`, main.rs:109의 `Result::ok`)으로 exit 101이었습니다. Green: exit 0이며, 잘못된 fixture는 같은 메시지와 exit 101을 유지합니다.

### 2026-10-20 — Rust validator는 kit lint가 보고하는 숨은 오류를 처리한다 (C16.67-6)

- `packages/validator/rust`는 `Result::ok`, `Result::unwrap_or`, `Result::unwrap_or_else`, `map_err_ignore` clippy finding을 처리합니다. `expr/lexer.rs`는 파싱되지 않는 number text(예: `1e`)를 0으로 읽는 대신 오류로 반환하고, `text.rs`는 hex digit을 읽기 전에 검사하며 JSON 문자열의 expression을 invariant 메시지와 함께 읽고, `validate/rules.rs`와 `validate/numeric.rs`는 digit과 numeric text를 invariant 메시지와 함께 읽으며, `validate/visibility.rs`는 이미 파싱한 node를 평가하고, conformance test와 unit test는 fixture의 read 또는 parse 오류로 실패합니다(C16.67-6). JS reference가 정의한 fallback은 이유를 적은 채 가장 작은 item에 남깁니다. 파싱되지 않는 condition은 false(`expr/condition_map.rs`의 `key_holds`, `validate/validator.rs`, `validate/rules.rs`의 `item_passes_condition`), 파싱되지 않는 value는 false(`validate/validator.rs`의 `evaluate_expression_value`), 숫자가 아닌 문자열은 None(`expr/evaluator.rs`의 `js_number`), serde_json이 거부하는 JSON number는 invalid input(`text.rs`의 `number_value`)입니다. Red: `cargo clippy --workspace --all-targets --locked -- -D warnings -D unused_must_use -D clippy::let_underscore_must_use -D clippy::let_underscore_untyped -D clippy::map_err_ignore -D clippy::allow_attributes_without_reason`가 library와 unit test에서 finding 23건(`Result::ok` 7, `Result::unwrap_or` 10, `Result::unwrap_or_else` 5, `map_err_ignore` 1)으로 exit 101이었고, integration test에는 finding 18건이 더 있었으나 cargo는 library가 컴파일된 뒤에 보고합니다. Green: exit 0이며, filter `expr`, `text`, `compose`, `validate`, `types`의 test(1, 12, 23, 46, 23 passed)와 변경한 conformance test binary 7개가 통과합니다.

### 2026-10-20 — config/generated.json이 생성 경로를 선언하고, pre-commit hook이 그 검사를 실행한다 (C16.68)

- `config/generated.json`이 crudui의 생성 glob(`var/**`, `dist.next/**`, `**/.phpunit.cache/**`, `make link`가 쓰는 `go.work` 파일 등)을 빈 `exceptions`와 함께 선언하고, `config/owner-checks.json`이 이 파일과 `clippy.toml`에 owner를 주며, `AGENTS.md`와 `AGENTS.ko.md`가 설정 파일 목록에 `generated`를 적고, `make hooks`가 `.githooks/pre-commit`(kit K362)을 쓴다 (C16.68). Red: `make hooks-check` exit 2, `config/generated.json does not exist, and the pre-commit hook needs it`; green: `make hooks-check` exit 0, `make owner-validate` exit 0.

### 2026-10-20 — Go validator는 숨은 오류를 처리한다 (C16.67-1)

- `packages/validator/go`는 kit lint가 보고한 오류를 모두 검사하거나 반환한다(C16.67-1). `types.go`의 `rejectForbiddenKeys`와 `objectMembers`는 decoder 오류를 반환하고 `orderedRawObject`와 `objectMembers`는 object key의 타입을 검사하며, `expr/lexer.go`는 잘못된 숫자를 invalid token으로 만든다. `validate/validator.go`의 `collectHidden`은 형태 오류를 반환하고 repeated와 group 데이터는 `objectValue`로 읽으며, `validate/rules.go`는 검사하지 않은 `json.Marshal` 없이 unique key를 인코딩한다. conformance test는 `errors.As`를 쓰고 `t.Fatal`로 실패한다. Red: `golangci-lint run`이 `72 issues`(errcheck 63, errorlint 7, nilerr 2)로 exit 1; green: exit 0이며 `0 issues`, `go test -run Test ./...`는 `825 passed, 0 failed`.

### 2026-10-20 — Go generator는 resolveAction과 runAction을 가진다 (C16.50-1)

- `packages/generator/go/actions.go`는 `ResolveAction`, `RunAction`과 타입 `ActionInput`, `ActionTarget`, `ActionResult`, `FocusTarget`을 CURT-081부터 CURT-090까지의 열한 action 위에 추가하고, `packages/generator/go/form_state_test.go`의 `TestFormActions`가 `form-actions` session을 history 플래그와 함께 실행합니다. 이 test의 `performStep`은 `resolveAction`과 `runAction`을 처리합니다(C16.50-1). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd packages/generator/go -- -run 'TestFormActions|TestFormHistory|TestFormView' .` exit 1, 11 passed and 8 failed, 8 중 7개의 `form-actions` session이 관찰된 result에서 실패(API는 0값을 반환하는 stub); green: exit 0, 19 passed, 0 failed.

### 2026-10-20 — Appearance 삼항식은 평가 오류를 전파한다 (C16.67-11)

- `packages/generator/python/src/polyspec/crudui/generator/design.py`의 `appearance`는 삼항식 평가의 오류를 `except`에서 pass로 삼키는 대신 `_parses`로 문자열이 파싱되는지만 확인하므로, 삼항식의 평가 오류가 전파되며 더 이상 삼켜지지 않습니다. `packages/generator/python/tests/test_form_render.py`의 `TestAppearanceErrorsAreNotHidden`은 오류를 주입해 전파되는지 확인하고, 문법 밖의 문자열이 literal text로 남는지 확인합니다(C16.67-11). Red: `design.py`의 `ruff check`는 S110 finding과 함께 exit 1, `run-tests.mjs python ... -- tests.test_form_render`는 exit 1, 4 passed와 1 failed(`ZeroDivisionError not raised`); green: ruff exit 0, `tests.test_render`와 `tests.test_form_render`는 exit 0, 8 passed.

### 2026-10-20 — Rust form instance는 undo 이력을 가진다 (C16.52-9)

- `packages/generator/rust/src/instance.rs`의 `Form`은 `history.rs`의 순수 함수로 record의 undo 이력을 가진다: `undo`와 `redo`(CURT-011, CURT-012), `can_undo`와 `can_redo`(CURT-061). `set_value`는 path와 함께 변경을 기록하고, `add_row`, `copy_row`, `move_row`, `remove_row`, `rekey_row`는 path 없이 기록하며, `set_data`는 이력을 다시 시작합니다(C16.52-9). `packages/generator/rust/tests/form_state.rs`는 history flag와 함께 `form-history` session을 실행합니다(C16.52-9). Red: `cargo test --test form_state`가 컴파일되지 않았고(`no method named undo`, E0599 4건: undo, redo, can_undo, can_redo), exit 1; green: `form_state`와 `history_functions`가 test 16개를 통과하며 그중 `form_history_sessions_equal_the_recorded_observations`도 통과, exit 0.

### 2026-10-20 — Go form instance는 undo 이력을 가진다 (C16.52-7)

- `packages/generator/go/instance.go`의 `Form`은 record 이력을 필드 `history`에 가지며 `Undo`, `Redo`, `CanUndo`, `CanRedo`를 가집니다. `commitView`는 모든 data 변경을 이력에 기록하고 value 편집은 path와 함께 기록하며, `SetData`는 이력을 다시 시작하고, `packages/generator/go/form_state_test.go`의 `TestFormHistory`가 `form-history` session을 history 플래그와 함께 실행합니다(C16.52-7). Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs go --cwd packages/generator/go -- -run 'TestFormHistory|TestFormView|TestHistoryFunctions' .` exit 1, 18 passed and 6 failed, history session은 `unknown step undo`로 실패; green: exit 0, 24 passed, 0 failed.

### 2026-10-20 — Python form instance는 undo 이력을 유지한다 (C16.52-8)

- `packages/generator/python/src/polyspec/crudui/generator/form.py`의 `Form`에 `undo`, `redo`, `canUndo`, `canRedo`를 추가했고, `history.py`의 pure function을 사용합니다. `setValue`는 path를 기록하고, `setData`는 이력을 비우며, undo와 redo는 view 상태를 바꾸지 않고 `revision`만 올립니다(C16.52-8). `packages/generator/python/tests/test_form_state.py`는 `form-history` session을 history flag와 함께 `form-view` session 옆에서 실행합니다. Red: `node node_modules/@polyspec/kit/dist/run-tests.mjs python --venv var/python --cwd packages/generator/python -- tests.test_form_state tests.test_form_history` exit 1, 16개 중 5개 실패(`AttributeError: 'Form' object has no attribute 'canUndo'`); green: exit 0, 16 passed, 0 failed.

### 2026-10-20 — Python validator의 날짜 파서는 layout fallback을 명시한다 (C16.67-10)

- `packages/validator/python/src/polyspec/crudui/validator/rules.py`에 `_strptime_layout`을 두어 다른 layout인 값에는 None을 반환하게 하고, `_parse_date`가 허용된 layout을 모두 이 함수로 시도하므로 `try`/`except` 블록이 조용히 `continue`나 `pass`하지 않습니다(C16.67-10). Red: `ruff check --config ruff.toml rules.py`가 exit 1이며 finding 2건 S112 `try`-`except`-`continue`를 455행과 460행에서 보고했습니다. `tests.test_validate` 3 passed, `tests.test_text_validity` 4 passed. Green: ruff exit 0(`All checks passed!`), 두 test module 모두 통과(3, 4 passed).

### 2026-10-20 — PHP generator는 form action을 실행한다 (C16.50-4)

- `packages/generator/php/src/Generator.php`의 `Generator::resolveAction`과 `Generator::runAction`은 action 버튼의 target을 풀고 11개 action을 `Form`에서 실행하며(CURT-081부터 CURT-090까지), 결과 `focus`는 TypeScript reference와 같은 모양입니다. `packages/generator/php/tests/FormStateTest.php`는 공유 `form-actions` session을 실행합니다(C16.50-4). Red: `phpunit tests/FormStateTest.php` exit 1, stub method가 null을 돌려줄 때 `Failures: 7`; green: `tests/FormStateTest.php` exit 0, `OK (27 tests, 294 assertions)`, `tests/DocCoverageTest.php` exit 0, `OK (1 test, 64 assertions)`.

### 2026-10-20 — PHP form instance는 undo 이력을 가진다 (C16.52-10)

- `packages/generator/php/src/Form.php`의 `Form`은 `undo()`, `redo()`, `canUndo()`, `canRedo()`를 가지고, 이력을 `Generator::recordChange`, `undoChange`, `redoChange`로 유지하며, `setData`는 이력을 다시 시작합니다. `packages/generator/php/tests/FormStateTest.php`는 공유 `form-history` session을 `canUndo`와 `canRedo` flag와 함께 실행합니다(C16.52-10). Red: `phpunit tests/FormStateTest.php` exit 1, `Errors: 5`, `Call to undefined method Polyspec\Crudui\Form::undo()`와 `::canUndo()`; green: `tests/FormStateTest.php` exit 0, `OK (19 tests, 254 assertions)`, `tests/DocCoverageTest.php` exit 0, `OK (1 test, 62 assertions)`.

### 2026-10-20 — adapter는 list와 detail renderer, action과 widget root markup을 core에서 가져온다 (C16.58-4)

- `@polyspec/crudui-generator-core`는 internal 진입점에 `listRenderer`, `detailRenderer`, `sortDir`, `actionHtml`, `isUnsupported`, `widgetRootHtml`을, public 진입점에 type `RenderList`, `RenderListOptions`, `RenderDetail`, `AnyWidget`을 가지며, React와 Svelte의 `renderList`, `renderDetail`, Vue와 Svelte list의 `sortDir`, `actionHtml`, React, Vue, Svelte widget의 `AnyWidget`, `isUnsupported`, `widgetRootRaw`가 이를 쓰고, `contracts/features.json`이 internal 이름 6개를 선언합니다(C16.58-4). Red: `make duplication-check`가 clone 40건을 찾았고 그중 6건이 `packages/react/src/server.ts`, `packages/svelte/src`, `packages/vue/src/components` 사이에 있었습니다. Green: clone 34건이며 adapter에는 없고, list, detail, form render conformance test가 React(811), Vue(786), Svelte(786)에서 통과합니다.

### 2026-10-20 — contract manifest는 generator-core의 internal raw markup export를 선언한다 (C16.64)

- `contracts/features.json`에서 `@polyspec/crudui-generator-core`의 진입점 `./internal`은 C16.27 이후 React, Vue, Svelte adapter가 가져가는 raw markup helper 13개(`affixHtml`, `choiceLabelClass`, `choicesHtml`, `escAttr`, `escText`, `groupButtonHtml`, `hasEventAttr`, `rawControl`, `rawElement`, `rawOptions`, `rawVoid`, `searchHtml`, `serializeAttrs`)를 선언하고, `docs/operations/feature-contracts.md`가 이를 나열합니다(C16.64). Red: `make manifest-check`가 `"./internal": exported but not declared`와 그 13개 이름으로 exit 2였고, green: feature 21개, entry 10개를 가진 package 7개, fixture link 26개로 통과합니다.

### 2026-10-20 — repository-writing test는 kit 용어 gate를 허용한다 (C16.65-1)

- `tests/docs/repository-writing.test.mts`는 kit가 자기 검사를 부르는 용어인 gate(PRINCIPLES P31, `make kit-gates`, `.github/workflows/gates.yml`)를 더 이상 금지하지 않으며, 그 이유를 목록 옆에 적습니다(C16.65-1). Red: test가 `acceptance-check metaphor: "gate"` 34건(첫 번째는 `CHANGELOG.ko.md:149`)으로 `5 passed, 1 failed`로 끝났고, green: `6 passed, 0 failed`입니다.

### 2026-10-20 — PHP generator에 history 함수가 있다 (C16.52-6)

- `packages/generator/php`의 `Generator::emptyHistory`, `recordChange`, `canUndo`, `canRedo`, `undoChange`, `redoChange`(규칙은 `src/Internal/History.php`)는 history 객체 `{entries, redoEntries, lastPath?}`에 대해 CURT-062, CURT-063, CURT-076~CURT-080을 따른다. 복원할 것이 없는 실행취소나 실행복귀는 `INVALID_FORM_INPUT`과 `Nothing to undo` 또는 `Nothing to redo`인 `FormError`를 던진다. `HistoryFunctionsTest`는 `tests/fixtures/history-functions/cases.json`의 사례 13개를 사례 이름의 data set으로 실행하고, `config/parity.json`은 이를 unit `history-functions`에 묶는다. green: 13개 중 13개가 통과한다(main checkout의 vendor 디렉터리가 PHP 8.5를 요구하므로 PHP 8.5로 실행). vendor 디렉터리가 있는 checkout에서 verification 명령이 실행될 때까지 행은 `[~]`이다.
- main으로 rebase한 뒤 고정 minor인 PHP 8.4.26과 link된 vendor에서 `HistoryFunctionsTest`의 13개 case가 통과합니다(C16.52-6).

### 2026-10-20 — Rust generator에 history 함수가 있다 (C16.52-5)

- `packages/generator/rust/src/history.rs`는 `History<T>`(`entries`, `redo_entries`, `last_path`)와 `empty_history`, `record_change`, `can_undo`, `can_redo`, `undo_change`, `redo_change`를 CURT-062, CURT-063, CURT-076~CURT-080이 정한 대로 정의한다. 복원할 것이 없는 실행취소나 실행복귀는 `INVALID_FORM_INPUT`과 `Nothing to undo` 또는 `Nothing to redo`인 `FormError`를 돌려준다. test target `history_functions`(`harness = false`, dev-dependency `libtest-mimic`이 test를 `history_functions::empty-history`처럼 사례 이름으로 부른다)는 `tests/fixtures/history-functions/cases.json`의 사례 13개를 실행하고, `config/parity.json`은 이를 unit `history-functions`에 묶는다. red: 함수가 없어 test가 compile되지 않았고, green: 13개 중 13개가 통과하며 새 파일에 대해 `clippy -D warnings`와 `rustfmt`는 아무것도 보고하지 않는다. `config/dependency-review.json`의 review 기록은 crate의 새 lock을 아직 기록해야 한다.

### 2026-10-20 — Go generator에 history 함수가 있다 (C16.52-4)

- `packages/generator/go/history.go`는 `History[T]`(`Entries`, `RedoEntries`, `LastPath`)와 `EmptyHistory`, `RecordChange`, `CanUndo`, `CanRedo`, `UndoChange`, `RedoChange`를 CURT-062, CURT-063, CURT-076~CURT-080이 정한 대로 정의한다. 마지막 편집과 같은 경로의 값 편집은 항목을 공유하고, 각 방향은 기록 100개를 두며, 복원할 것이 없는 실행취소나 실행복귀는 오류 `Nothing to undo` 또는 `Nothing to redo`를 돌려준다. `TestHistoryFunctions`는 `tests/fixtures/history-functions/cases.json`의 사례 13개를 사례 이름의 subtest로 실행하고, `config/parity.json`은 이를 unit `history-functions`에 묶는다. red: 함수가 없어 test가 compile되지 않았고, green: 13개 중 13개가 통과하며 package의 다른 test도 통과한다.

### 2026-10-20 — history-functions의 TypeScript test는 binding이다 (C16.52-3)

- `packages/generator/ts/src/history-functions.test.ts`는 `tests/fixtures/history-functions/cases.json`의 사례 13개를 사례 이름의 최상위 test로 실행하고, `config/parity.json`은 이를 unit `history-functions`에 묶는다. `form-state.test.ts`는 나머지 함수와 session family를 유지한다. Go에는 아직 history 함수가 없어 선언에는 php, php-extension, go, rust의 binding이 아직 없다. red: unit에 TypeScript binding이 없었고, green: 13개 중 13개가 통과한다.

### 2026-10-20 — Python generator에 history 함수가 있다 (C16.52-2)

- `packages/generator/python`의 `Generator.emptyHistory`, `recordChange`, `canUndo`, `canRedo`, `undoChange`, `redoChange`는 CURT-063과 CURT-076~CURT-080을 따른다. 이력은 `{entries, redoEntries, lastPath?}`이고, 마지막 편집과 같은 경로의 값 편집은 항목을 공유하며, 각 방향은 기록 100개를 두고, 복원할 것이 없는 실행취소나 실행복귀는 `INVALID_FORM_INPUT`과 `Nothing to undo` 또는 `Nothing to redo`인 `FormError`를 일으킨다. `config/parity.json`은 `tests/fixtures/history-functions/cases.json`에 대한 unit `history-functions`를 선언하고 binding `packages/generator/python/tests/test_form_history.py`를 묶는다. red: 사례 13개가 없는 method로 실패했고, green: 13개 중 13개가 통과하며 `ruff`와 `vulture`는 아무것도 보고하지 않는다. 다른 구현의 binding은 그 구현에서 `formHistory`를 구현하는 하위 항목(C16.52)에서 더한다.

### 2026-10-20 — PHP generator의 뷰 상태 (C16.51-6)

- PHP generator는 `Generator`의 뷰 함수 `initialView`, `toggleRowView`, `collapsibleRows`, `setAllExpandedView`, `removeRowView`, `rekeyRowView`, `bindForm` 옵션 `collapsed`, `Form::toggleRow`, `Form::setAllExpanded`를 가지며, `removeRow`, `rekeyRow`, `setData`는 뷰를 바꾸고 뷰 변경은 revision을 바꾸지 않습니다. `contracts/features.json`에서 PHP의 `viewState`는 `pass`입니다. Red: `FormStateTest`가 `form-view`와 `view-functions`의 모든 case에서 실패했습니다(`Call to undefined method Form::toggleRow()`, `Generator::collapsibleRows()`). Green: 14개 case가 통과하고 `FormTest`, `DocCoverageTest`, `OutlineTest`의 28개 test와 `phpstan`도 통과합니다.
- main으로 rebase한 뒤 고정 minor인 PHP 8.4.26과 link된 vendor에서 `FormStateTest`의 14개 case가 통과합니다(C16.51-6).

### 2026-10-20 — Rust generator의 뷰 상태 (C16.51-5)

- Rust generator는 `ViewState`와 뷰 함수 `initial_view`, `toggle_row_view`, `collapsible_rows`, `set_all_expanded_view`, `remove_row_view`, `rekey_row_view`, `BindOptions`의 `collapsed`, `Form::toggle_row`, `Form::set_all_expanded`를 가지며, `remove_row`, `rekey_row`, `set_data`는 뷰를 바꾸고 뷰 변경은 revision을 바꾸지 않습니다. `set_value`는 `set_data`를 호출하던 것을 바꾸어 뷰를 새로 시작하지 않고 레코드를 commit합니다. `contracts/features.json`에서 Rust의 `viewState`는 `pass`입니다. Red: `tests/form_state.rs`가 compile되지 않았습니다(뷰 함수의 `unresolved imports`, `toggle_row` method 없음). Green: 두 test가 통과하고 unit test 37개와 `-D warnings`의 clippy도 통과합니다.

### 2026-10-20 — Python generator의 뷰 상태 (C16.51-4)

- Python generator는 `Generator`의 뷰 함수 `initialView`, `toggleRowView`, `collapsibleRows`, `setAllExpandedView`, `removeRowView`, `rekeyRowView`, `bindForm` 옵션 `collapsed`, `Form.toggleRow`, `Form.setAllExpanded`를 가지며, `removeRow`, `rekeyRow`, `setData`는 뷰를 바꾸고 뷰 변경은 revision을 바꾸지 않습니다. `contracts/features.json`에서 Python의 `viewState`는 `pass`입니다. Red: 변경 전에 `tests.test_form_state`가 `form-view`와 `view-functions`의 모든 case에서 실패했습니다. Green: 두 test가 통과하고 `make lint-python`도 통과합니다.

### 2026-10-20 — Go generator의 뷰 상태 (C16.51-3)

- Go generator는 `ViewState`, `InitialView`, `ToggleRowView`, `CollapsibleRows`, `SetAllExpandedView`, `RemoveRowView`, `RekeyRowView`, `BindOptions`의 `Collapsed`, `Form.ToggleRow`, `Form.SetAllExpanded`를 가지며, `RemoveRow`, `RekeyRow`, `SetData`는 뷰를 바꾸고 뷰 변경은 revision을 바꾸지 않습니다. `collection`은 더 이상 데이터 전용 컬렉션을 거부하지 않고 행 작업은 `editableCollection`이 거부합니다. `contracts/features.json`에서 Go의 `viewState`는 `pass`입니다. Red: `TestFormView`와 `TestViewFunctions`가 compile되지 않았습니다(`form.ToggleRow undefined`, `undefined: ViewState`). Green: 16개 case가 통과합니다.

### 2026-10-20 — 이력 flag 없는 뷰 세션 (C16.51-2)

- `form-view` 세션의 관찰에는 `canUndo`와 `canRedo`가 없어 뷰 상태가 있고 이력이 없는 구현도 실행할 수 있고, `form-history`와 `form-actions`는 그대로 가집니다. Red: 뷰 상태가 있고 이력이 없는 Go 폼이 `form-view`의 `rekeyRow` step을 `canUndo`에서 실패했습니다. Green: `src/form-state.test.ts`의 40개 case가 통과합니다.

### 2026-10-20 — 뷰 상태, 이력, 작업의 중립 규칙과 공유 case (C16.51-1)

- `docs/spec/form-runtime.ko.md`는 `CURT-061`부터 `CURT-090`을 정의합니다: 스냅샷 flag, 이력 한도와 병합 규칙, 뷰 규칙, `bindForm`의 옵션 `collapsed`, 뷰와 이력 함수, `resolveAction({ action, path?, key? })`, `runAction`의 열한 작업입니다. 고정 데이터 family `form-view`, `form-history`, `form-actions`, `view-functions`, `history-functions`는 `tests/fixtures/form-state/generate.mts`가 TypeScript reference에서 쓰는 case를 담고, 생성된 행 키는 `$1`, `$2`로 부릅니다. TypeScript `resolveAction`은 중립 규칙의 값 또는 DOM 버튼을 받습니다. Red: `src/form-state.test.ts`가 `tests/fixtures/form-view/cases.json`의 `ENOENT`로 실패했습니다. Green: TypeScript package에서 40개 case가 통과합니다.

### 2026-10-20 — scripts/go의 go.work는 Git이 무시한다 (C16.63-1)

- `.gitignore`는 C16.58-5가 추가한 Go 모듈 `scripts/go` 옆에 `make link`가 쓰는 `go.work`를 무시합니다(C16.63-1). Red: `node node_modules/@polyspec/kit/dist/link.mjs link . ../kit ../ordered-json`이 `scripts/go/go.work is not ignored by Git in its repository`로 exit 1이었고, green: exit 0으로 모든 polyspec package를 link합니다.

### 2026-10-20 — kit 사본이 kit-sync를 따른다 (C16.67)

- `.golangci.yml`, `ruff.toml`, `clippy.toml`, `PRINCIPLES.md`, `scripts/kit/kit-bootstrap.mk`는 K334, K336, K353, K355 이후의 kit 사본입니다(C16.67). Red: `make kit-check`가 다른 사본 6개를 보고했고, green: 통과합니다. 새 lint 설정이 보고하는 숨은 오류는 다음 행입니다: `make lint-python`은 `ruff check .`에서, `make lint-go`는 14단계 중 6단계에서, `make lint-rust`는 6단계 모두에서 실패합니다.

### 2026-10-20 — buildOutline은 모든 implementation에 구현되었다 (C16.49)

- `contracts/features.json`에서 `buildOutline`은 php, go, rust, php-native, python 모두 `pass`이며, Go, Rust, PHP, PHP 확장, Python generator와 C16.49-1부터 C16.49-7의 선언이 이를 뒷받침합니다(C16.49). Red: `make divergence-check`가 `buildOutline`의 `unsupported` 항목 5건을 보고했고, green: 보고하지 않으며 남은 divergence는 17건입니다.

### 2026-10-20 — 한국어 changelog가 rebase 뒤 영어 changelog를 따른다 (C16.66)

- `CHANGELOG.ko.md`는 `feat/outline-C16.49`를 main 위로 rebase한 뒤 C16.49-1부터 C16.49-7까지 일곱 항목을 `CHANGELOG.md`의 순서로 담고 `source-sha256` marker를 하나만 가집니다(C16.66). Red: `tests/docs/changelog.test.mts`가 `2 passed, 2 failed`(`must list the same dated entries in the same order`)였고 `check-documents`가 marker 3개를 보고했으며, green: `4 passed, 0 failed`이고 `check-documents`가 통과합니다.

### 2026-10-20 — 교차 검사 콘솔은 JSON parser, download, matrix column, request reader를 공유한다 (C16.58-6)

- `client/app.js`의 `parseJsonText`, `downloadJson`, `matrixColumn`과 `server/server.mjs`의 `readBodyAndSpec`가 data와 record parser, fixture download 두 개, validate와 render column, endpoint 여섯 개의 body와 specification 읽기의 사본을 대신합니다 (C16.58-6). Red: `make duplication-check`는 이전에 중복 40건을 보고했고, green: 이후 37건이며 대상 검사가 통과합니다(24 passed).

### 2026-10-20 — 모든 구현의 buildOutline (C16.49-7)

- 기능 계약은 PHP, Go, Rust, php-native, Python 구현의 buildOutline을 해당 테스트와 함께 통과로 선언합니다. (C16.49-7)

### 2026-10-20 — Python 생성기 buildOutline (C16.49-6)

- Python 생성기는 Generator.buildOutline을 가지며, 공유 form-outline fixture로 시험합니다. (C16.49-6)

### 2026-10-20 — PHP 확장 buildOutline (C16.49-5)

- php-native 확장은 C 엔진이 만드는 Generator::buildOutline을 가지며, 다른 생성기와 같이 form-outline fixture에 답합니다. (C16.49-5)

### 2026-10-20 — PHP 생성기에 buildOutline이 있습니다 (C16.49-4)

- `Generator::buildOutline(array $nodes)`는 `bindForm`이 반환한 node에 대해 공유 사례의 member 순서로 `stdClass` entry의 폼 행을 반환하고, native generator protocol의 PHP program이 이 operation에 답합니다 (C16.49-4). Red: PHP program이 group `outline`의 사례 5개에 `Unknown generator operation`으로 답함; green: 5개 모두 통과하고 `OutlineTest` 5 case와 문서 coverage test가 통과합니다.

### 2026-10-20 — Rust program이 buildOutline에 답합니다 (C16.49-3)

- native generator protocol의 Rust program은 생성기의 `build_outline`으로 `buildOutline`에 답합니다 (C16.49-3). Red: group `outline`의 사례 5개에 `Unknown generator operation`으로 답함; green: 5개 모두 통과하고 `make lint-rust`가 통과합니다.

### 2026-10-20 — native generator protocol은 buildOutline을 가지며 Go 생성기는 BuildOutline을 가집니다 (C16.49-2)

- `tests/native-generators`의 protocol은 operation `buildOutline`(요청 `nodes`, 응답은 `OutlineRow`의 행)을 가지고, JavaScript dispatcher는 `buildOutline`으로 답하며, group `outline`은 `tests/fixtures/form-outline/cases.json`의 각 사례에 대해 `bindForm`이 반환한 node를 모든 program에 보내 행을 reference와 member 순서까지, 그리고 `expected_outline_rows`와 비교합니다. Go 생성기는 `BuildOutline(nodes)`를 제공하고 Go program이 이 operation에 답합니다 (C16.49-2). Red: Go program이 사례 5개에 `Unknown generator operation`으로 답함; green: 5개 모두 통과, `TestOutlineFixture` 통과, `make lint-go` 통과.

### 2026-10-20 — 구조 지도 사례는 buildOutline의 행을 가지며 Rust에 build_outline이 있습니다 (C16.49-1)

- `tests/fixtures/form-outline/cases.json`의 사례는 `buildOutline(bindForm(compileForm(spec), data, options))`이 반환하는 행인 `expected_outline_rows`를 가지며(고정 데이터 생성기가 씀), Rust 생성기는 자체 `bind_form`의 node에 대해 같은 행을 반환하는 `build_outline(nodes)`를 제공합니다 (C16.49-1). Red: `build_outline`이 없어 `native_outline_fixture`가 compile되지 않음; green: 사례 5개에 통과하고 `make lint-rust`가 통과합니다.

### 2026-10-20 — PHP와 Go table generator는 contract reader와 생성 source writer를 하나씩 공유한다 (C16.58-5)

- `scripts/generator-contract.php`가 PHP generator의 reader와 writer이고, module `scripts/go`(`tablegen`, `interfacemessages`, `unicodedata`)가 `go generate`가 workspace로 실행하는 `interface_messages_generate.go`와 `unicode_data_generate.go`를 대신하며, PHP와 Python의 생성된 interface message table은 `generated:`로 `duplication-check`에서 제외하고, `scripts/go`의 S9 예외, rebuild 분류, owner 규칙, release 메모는 설정에 있습니다 (C16.58-5). Red: `make duplication-check`는 이전에 중복 44건을 보고했고, green: 이후 40건이며 대상 검사가 통과합니다(generated tables identical).

### 2026-10-20 — React form render case의 scenario는 반복되는 specification을 공유한다 (C16.58-3)

- `emailShownBySubscribe`와 `groupClassByItems`가 `packages/react/scripts/scenario-form-render-cases.ts`의 scenario 네 개와 두 개가 반복하던 specification을 담으며, 생성된 `cases.json`은 그대로입니다 (C16.58-3). Red: `make duplication-check`는 이전에 중복 53건을 보고했고, green: 이후 50건이며 대상 검사가 통과합니다(generator output unchanged).

### 2026-10-20 — 목록과 상세의 Rust text validator는 macro 하나로 정의한다 (C16.58-2)

- `packages/validator/rust/src/text.rs`의 `validate_list_text`와 `validate_detail_text`는 macro `structure_text_validator!`로 정의합니다 (C16.58-2). Red: `make duplication-check`는 이전에 중복 54건을 보고했고, green: 이후 53건이며 대상 검사가 통과합니다(8 passed).

### 2026-10-20 — 두 문서 link 재작성기는 markdown-it 속성 재작성기 하나를 공유한다 (C16.58-1)

- `scripts/documentation-links.mts`의 `rewriteAttribute`가 저장소 link, docs link, image source를 위한 markdown-it renderer rule을 감싸며, `scripts/docs-web/build.mts`와 `scripts/documentation-links.mts` 사이의 중복이 사라졌습니다 (C16.58-1). Red: `make duplication-check`는 이전에 중복 55건을 보고했고, green: 이후 54건이며 대상 검사가 통과합니다(18 passed).

### 2026-10-20 — make link의 go.work file은 무시한다 (C16.63)

- `.gitignore`는 `go.work.sum`과 저장소의 각 Go module 옆 `go.work`(`benchmarks/validators/go`, `tests/native-generators/programs/go`, `examples/cross-check-console/validators/go`, `examples/form-comparison/servers/go`, `packages/validator/go`, `packages/generator/go`)를 무시하고, root의 `go.work`는 계속 추적합니다(C16.63). Red: `node node_modules/@polyspec/kit/dist/link.mjs link ../ordered-json`이 `benchmarks/validators/go/go.work is not ignored by Git`에서 멈췄고, green: `github.com/polyspec/ordered-json/packages/go`의 Go link가 `examples/form-comparison/servers/go/go.work`에 쓰이고 `git status`에 새 file이 없습니다.

### 2026-10-20 — python의 createForm은 `pass`이다 (C16.53)

- `contracts/features.json`은 `python`의 `createForm`을 `pass`로 선언합니다. Python target의 native generator 검사는 `tests/fixtures/text-validity/createForm/cases.json`의 15개 case와 `tests/native-generators/cases.mts`의 14개 case를 모두 기록하고, `scripts/check-conformance.mts`는 `pass`인 python의 `createForm`에서 빠진 case를 보고하지 않으며, 생성된 feature 페이지가 따라갑니다(C16.53). Red: `make divergence-check`가 `partial` 항목을 보고했고, green: 보고하지 않습니다.

### 2026-10-20 — php-ext 실행은 php 실행의 모든 test를 실행한다 (C16.55)

- `examples/form-comparison/servers/php/tests/FormGenerationTest.php`에서 `#[Group('php')]`로 PHP library를 구성하던 test 두 개는 extension이 없는 자식 PHP process에서 library를 구성하므로 php mode와 php-ext mode에서 모두 실행되며, `local-verification.mjs`와 `check-verification.test.mjs`는 더 이상 `--exclude-group php`를 넘기지 않습니다(C16.55). Red: php-ext 단계는 9개 test 중 2개를 빼놓았고, green: suite가 php mode에서 9 tests, 75 assertions, php-ext mode에서 9 tests, 75 assertions를 실행하며 `check-verification.test.mjs`가 통과하고(8) `make divergence-check`는 `--exclude-group`을 보고하지 않습니다.

### 2026-10-20 — 네이티브 값 매핑의 중립 규칙 (C16.61)

- `docs/spec/runtime-packages.ko.md`는 `CURP-026`에서 각 구현이 폼 값 모델을 자기 언어의 네이티브 타입으로 또 그 반대로 옮길 때 빈 객체와 빈 배열의 차이, 없는 항목과 `null`의 차이, 객체 항목의 순서, 스칼라의 타입을 잃지 않는다고 서술합니다. PHP의 배열 또는 객체 매핑은 그 규칙의 PHP binding이며, 같은 절의 다른 문단은 규칙 `CURP-024`, `CURP-025`, `CURP-027`이 되었습니다(C16.61). Red: 매핑을 서술한 requirement가 없었고, green: `CURP-026`이 정의되고 `check-documents`가 통과합니다. 여섯 구현의 test는 C16.57의 일입니다.

### 2026-10-20 — record server가 OrderedJSON module을 빌드한다 (C16.60)

- `prepareRecordServers`는 OrderedJSON checkout의 `packages/php-ext/src` 내용을 `orderedJsonCopyArguments`로 build directory에 복사합니다. `path.join`이 source 끝의 `/.`을 없애 `cp -R`이 directory를 destination 안에 넣었고 `phpize`가 `config.m4`를 찾지 못했습니다(C16.60). Red: `examples/form-comparison/record-stores.test.mjs`는 `7cafb4fb^`와 `HEAD`에서 `ordered-json-phpize: failed (exit 1)`로 `0 passed, 130 failed`였고, green: `local-servers.test.mjs`의 새 test가 통과하고(6 passed) record-stores 실행은 `78 passed, 52 failed`입니다. js, go, rust store는 통과하고 실패 52건은 Composer link item이 설치할 `vendor/polyspec/ordered-json`을 읽는 php와 php-ext store입니다.

### 2026-10-20 — docs/spec에는 implementation의 규칙만 둔다 (C16.59)

- `conformance`, `examples`, `test-fixtures`, `package-build`, `feature-contracts`, `form-comparison`, `php-extension`은 한국어 짝과 함께 `docs/spec`에서 `docs/operations`로 옮겼고, 그것을 가리키는 모든 link, path, doc id가 따라갑니다. `runtime-packages`는 필수 기능, API 동작, 공용 계약, 데이터 규칙을 `docs/spec`에 두고 id `CURP-n`을 붙였으며, package 구성과 검증은 `docs/operations/runtime-packages.md`입니다. `empty-collections`는 규칙을 id `CUEC-n`으로 서술합니다(C16.59). Red: `docs/spec`에는 requirement id가 없는 문서가 9개 있었고 그중 8개는 tooling이나 extension에 대한 것이었으며, green: `docs/spec`의 모든 문서가 requirement를 정의하고 `make parity-declarations-check`는 R13 finding 422건을 보고하며 `check-documents`가 통과합니다.

### 2026-10-20 — docs/spec의 requirement id (C16.56)

- `docs/spec`의 contract 문서 `display-formats`, `expressions`, `form-markup`, `form-runtime`, `input-text`, `schema`, `validation-rules`는 `**CU<문서>-<n>**`으로 시작하는 list item인 requirement 392건을 정의합니다(`CUDF`, `CUXP`, `CUMK`, `CURT`, `CUIT`, `CUSC`, `CUVR`; 접두사 `CU`는 polyspec의 다른 repository가 쓰지 않습니다). 모든 최상위 규칙 bullet, `validation-rules`에서 굵은 용어로 시작하는 모든 정의 문단, 규칙 표의 모든 행이 대상이며 표는 행마다 bullet 하나가 되었고, 한국어 짝은 같은 id를 가지며, `config/parity.json`의 `requirements.pattern`은 `CU(DF|XP|MK|RT|IT|SC|VR)-[0-9]{3}`입니다(C16.56). repository tooling이나 example server를 설명하는 문서(`conformance`, `examples`, `test-fixtures`, `package-build`, `feature-contracts`, `form-comparison`, `runtime-packages`, `php-extension`)는 여섯 implementation의 contract 동작을 말하지 않으므로 requirement를 정의하지 않습니다. Red: `make parity-declarations-check`가 pattern이 requirement와 맞지 않는다고 보고했고, green: unit이 아직 인용하지 않는 id마다 R13 finding 392건을 보고합니다(다음 item C16.57).

### 2026-10-20 — engine test는 php-extension의 internal test이다 (C16.48-1)

- C engine test의 `tests`와 `internal` glob은 implementation `php-extension`에 속하며, 그것을 담기 위해서만 있던 C16.48의 implementation `php-extension-engine`은 없앴습니다 (C16.48-1). Red: `php-extension-engine`은 unit이 없는 implementation이었고, green: `make parity-declarations-check`는 internal glob을 가진 `php-extension`의 declaration을 보고합니다. kit의 R6 file 검사(`scripts/kit/parity-units.mts`, `patterns` filter)가 `internal` glob이 고른 file을 제외하지 않아 `packages/php-ext/tests/engine/engine.test.mjs`의 R6는 계속 보고되며, 이는 우회하지 않고 보고하는 kit 결함입니다.

### 2026-10-20 — divergence, link-state, bypass gate와 internal test를 채택한다 (C16.48)

- `CHECK_TARGETS`는 `divergence-check`, `link-state-check`, `bypass-check`를 담고, `config/duplication.json`과 `config/parity.json`의 `tools` root의 reason은 kit이 정의한 종류로 시작하며, `packages/php-ext/tests/engine/engine.test.mjs`는 native engine을 TypeScript reference와 비교하는 검사만 담아 comparator인 `packages/php-ext/tests/comparison/comparison.test.mjs`와, reason을 가진 implementation `php-extension-engine`의 `internal` test인 C engine test로 나뉘고, 공용 helper는 `packages/php-ext/tests/engine/support.mjs`이며, comma locale은 platform 대신 locale 목록으로 고릅니다 (C16.48). Red: `make kit-check`가 finding 2건을, `make divergence-check`가 종류 없는 reason과 engine test의 `process.platform`을 보고했고, green: `make kit-check`가 통과하고, 두 engine test file이 통과하며(27건과 11건), `make parity-declarations-check`가 R6 0건을 보고합니다. `make divergence-check`는 `contracts/features.json`의 `partial`과 `unsupported` 항목과 example script 두 곳의 `--exclude-group`을 계속 보고하며, 이는 다음 item입니다.

### 2026-10-20 — 옮겨진 C engine test가 green이다 (C16.47-1)

- `packages/php-ext/tests/engine/engine.test.mjs`는 C16.47의 상대 path로 새 folder에서 실행되어 통과합니다 (C16.47-1). Green: `node --test`가 통과 38, 실패 0, 시간 초과 0, 건너뜀 0을 보고합니다.

### 2026-10-20 — C engine test가 구현 안으로 옮겨진다 (C16.47)

- `packages/php-ext/tests/engine.test.mjs`는 `packages/php-ext/tests/engine/engine.test.mjs`로 옮겨지고, 그 folder는 `config/parity.json`의 comparator이며 그 file의 owner rule이 있습니다 (C16.47). Red: `make parity-declarations-check`가 R6 finding 1건을 보고했고, green: 0건을 보고합니다.

### 2026-10-20 — CHECK_TARGETS의 link-metadata-check gate (C16.43)

- `CHECK_TARGETS`는 kit K305가 `kit-gates`에 더한 gate `link-metadata-check`를 나열하고, principle file은 kit의 현재 text를 따릅니다 (C16.43). Red: `make kit-check` exit 1(`CHECK_TARGETS runs no link-metadata-check`), green: exit 0.

### 2026-10-20 — CHECK_TARGETS의 link-check gate (C16.42)

- `CHECK_TARGETS`는 kit이 `kit-gates`에 더한 gate `link-check`를 나열하고, `make kit-sync`는 principle file을 kit의 현재 text로 맞췄습니다 (C16.42). Red: `make kit-check` exit 1(`CHECK_TARGETS runs no link-check`, 두 principle file이 다름), green: exit 0.

### 2026-10-20 — phpize로 빌드하는 PHP extension (C16.9)

- kit의 `make build-php-ext`가 `polyspec_crudui.so`를 `phpize`, `configure`, `make`로 `var/php-ext`에 빌드합니다. `scripts/php-extension-builder.mts`, `build-crudui-php-extension.mts`, `build-ordered-json-php-extension.mts`와 builder test는 제거되고, `crudui-build`, `crudui-test-php-api`, CI target은 `build-php-ext`를 쓰며, CI job은 `php-config` file을 이름으로 부르는 대신 `setup-php`로 `phpize`와 `php-config`를 설치하고, local form-comparison 실행은 OrderedJSON module을 그 source의 사본에서 `phpize`로 빌드하며, module의 version은 `config.m4`를 통해 `composer.json`에서 가져옵니다 (C16.9). Red: `The PHP module builds with phpize through the build-php-ext target of kit` test가 script로 빌드하던 Makefile에 대해 실패했고, green: `make lint-php-ext`, phpize 빌드에 대한 `ApiTest`(4건), CI, test-command, atomic-publish, offline-check test와 함께 통과합니다. `make test-php-ext`는 extension의 선언을 두 library와 비교하는 단계를 통과하며, 그 unit-test 단계는 extension을 로드한 채 library의 PHPUnit file을 실행하는데 그중 422건이 순수 PHP runtime을 요구하여 실패하므로 parity item에 속합니다.

### 2026-10-20 — project 명령 안의 Rust generator test (C16.38-1)

- `tests/build/rust-generators.test.mts`를 `package.json`의 `test:runtimes` script에 나열하여 project 명령이 이를 실행합니다 (C16.38-1). Red: `test-commands.test.mts`의 `every node:test file runs in a project command`가 이 file을 이름으로 하여 실패했고, green: 그 test가 통과합니다.

### 2026-10-20 — PHP extension의 S10 layout (C16.40)

- extension의 이름은 `polyspec_crudui`입니다(module entry, `--ri` 이름, `extension_loaded('polyspec_crudui')`, module file `polyspec_crudui.so`). 하나뿐인 stub과 arginfo header는 `packages/php-ext/src/`에 `polyspec_crudui.stub.php`와 `polyspec_crudui_arginfo.h`로 있고, `packages/php-ext/composer.json`은 `polyspec/crudui-php-ext`로 이름을 정하며, `packages/php-ext/src/config.m4`는 source와 함께 extension을 선언하고 version을 `../composer.json`에서 가져오며, 옛 stub 위치에 대한 `config/layout.yml`의 예외는 없어집니다(kit K293) (C16.40). Red: `make lint-php-ext` exit 1, finding 4건(composer.json, stub 위치, config.m4, 없는 stub), green: exit 0, `make layout-check` 통과, `scripts/`의 builder가 새 이름으로 build한 module에 대해 `ApiTest`(4건) 통과.

### 2026-10-20 — path는 Composer package 이름이 아니다 (C16.7-13)

- `tests/build/package-names.test.mts`의 옛 Composer package 이름 `crudui/validator`와 `crudui/generator`에 대한 pattern은 `polyspec/crudui/validator/...` 같은 path 안의 같은 단어와 더는 맞지 않습니다 (C16.7-13). Red: `no maintained file names a package by a form before the convention`이 `config/duplication.json`과, `polyspec/crudui/validator/` 아래 Python file을 적은 kit-standard checklist의 행에서 이름 3건으로 실패했고, green: test가 통과합니다.

### 2026-10-20 — CHECK_TARGETS의 kit gate (C16.7-12)

- Makefile의 `CHECK_TARGETS`는 이 checkout이 실행하는 `kit-gates`의 gate 21개를 나열하고(kit K289), `make kit-sync`는 `PRINCIPLES.md`와 `PRINCIPLES.ko.md`를 설치된 kit의 text로 맞췄습니다(PHP library가 둘 이상인 저장소의 S10 text, `make plan-split`, directory suite의 requirement) (C16.7-12). Red: `make kit-check` exit 1, finding 22건(`CHECK_TARGETS`에 빠진 gate 20개, 다른 principle file 2개), green: exit 0.

### 2026-10-20 — owner 검사에 fullSuite target 없음 (C16.7-11)

- `config/owner-checks.json`은 `fullSuite`를 제거합니다. 유일한 항목 `ci`를 local 전체 실행과 함께 Makefile에서 제거했으므로(C16.7-3), owner 검사는 더는 없는 target을 이름으로 부르지 않습니다 (C16.7-11). Red: `make owner-validate` exit 1(`fullSuite names ci, which is not a target`), green: exit 0(`owns every tracked path`).

### 2026-10-20 — Rust generator의 공유 helper (C16.39)

- `bindable_language`는 `bind_buttons`와 `bind_ordered`를 위해 record와 template을 검사하고 language를 읽으며, fixture test는 form과 list case에 `settled`를 호출하고, `generateTable`은 Rust generator tool의 두 message table을 쓰며, test의 `written` helper는 `Map::from_iter`로 순서 있는 object를 만듭니다 (C16.39). Red: `make duplication-check`가 Rust generator와 validator의 compose test에서 clone 5건을 나열했고, green: generator의 clone은 없어지고 1건이 남으며(test crate를 공유하지 않는 두 crate의 한 줄짜리 `written` helper, `tests.rs`와 validator의 `compose.rs`), `native_fixture_records`, `bind`, generator tool test 2건, `make lint-rust`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — Rust generator와 contract (C16.38)

- `packages/generator/rust/tools/generate-interface-messages.mjs`와 `packages/validator/rust/tools/generate-unicode-properties.mjs`는 package를 component와 port로 옮긴 뒤 `contracts/`를 두 단계 높은 곳(`packages/contracts/...`)에서 읽어 둘 다 실행할 수 없었습니다. 이제 둘 다 `../../../contracts`를 읽고, `tests/build/rust-generators.test.mts`는 각 generator를 crate 폴더에서 실행하여 출력이 commit된 것과 바이트 단위로 같게 유지되도록 요구합니다 (C16.38). Red: test가 `packages/contracts/interface-messages.json`과 unicode contract의 `ENOENT`로 실패했고, green: 두 test가 통과하며 생성된 source는 바뀌지 않습니다.

### 2026-10-20 — PHP generator의 공유 preload link와 object 판별 (C16.37)

- `Rendering::imagePreload`는 `Details`와 `Lists`를 위해 image display의 preload link를 쓰고, `Value::isObject`는 `DisplayDeclaration`과 `Template`이 각자 두던, declaration이 object로 보는 것에 대한 하나의 판별입니다 (C16.37). Red: `make duplication-check`가 generator script를 제외한 `packages/generator/php`의 clone 2건을 나열했고, green: 없음. `RenderingConformanceTest`(188), `DetailTest`(10), `DisplayRulesTest`(21), `FormTest`(22), `DocCoverageTest`, `make lint-php`가 통과합니다. 출력은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — Go generator의 공유 helper (C16.36)

- `checkedBinding`은 `BindForm`과 `BindButtons`의 template, record, option을 검사하고, `preloadLinks`는 list와 detail의 image preload link를 쓰며, `splitRowSuffix`는 `leafName`과 `ruleName`을, `invalidMember`와 `unknownMember`는 declaration 검사를, `checkLabelAndFormat`은 display와 action declaration을 처리하고, `asNumber`는 type switch를 두는 대신 validator의 `expr.NumberValue`를 호출합니다 (C16.36). Red: `make duplication-check`가 `packages/generator/go`의 clone 7건을 나열했고, green: 1건이 남으며(generator program `interface_messages_generate.go`와 validator의 것, 공유 generator code로 이후 item), package test 112건과 `make lint-go`가 통과합니다. 동작은 바뀌지 않으므로(`asNumber`는 `expr.NumberValue`처럼 `uintptr`도 읽음) red는 clone 목록입니다.

### 2026-10-20 — TypeScript generator core의 공유 helper (C16.35)

- `actionClick`은 `connectForm`과 `connectOutline`을 위한 action button의 click handler를 만들고, `has`, `fail`, `closed`는 form, field, design의 declaration을 검사하며, `splitRowSuffix`는 `leafName`과 `ruleNameForPath`를, `fileWidget`은 `image`, `file`, `cover`를, `choiceOptions`는 `choice`와 `multichoice`의 option을, `probeRegistry`는 `WIDGET_LAYOUTS`와 `WIDGET_CANONICAL`을 처리합니다 (C16.35). Red: `make duplication-check`가 `packages/generator/ts`의 clone 6건을 나열했고, green: 없음. package의 test 305건, 다시 build한 core 위의 Vue와 Svelte conformance test, `make lint-ts`가 통과합니다. 출력은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — Python validator의 하나의 layering 함수와 모든 곳에서 거부되는 null patch (C16.34)

- `_layer_members`는 `compose_properties`, `compose_spec`, `compose_root`, `$ref`의 중첩 확장을 위해 node의 member를 layering하고, `_validate_structure`는 `validateList`와 `validateDetail`을 처리합니다 (C16.34). 사본들은 `{"$patch": null}`에 대해 서로 달랐습니다. `compose_properties`는 TypeScript, PHP, Rust engine이 모든 진입점에서 하는 것처럼 `PATCH_SHAPE`를 raise했으나 `compose_spec`과 `compose_root`는 무시했습니다. 이제 모든 진입점이 raise합니다. Red: `tests.test_compose.TestNullPatch`가 `compose_spec`과 `compose_root`에서 실패했고(sub-test 3건 중 2건), `make duplication-check`가 `packages/validator/python`의 clone 3건을 나열했으며, green: 이 test와 compose 4건, structure validity 9건, validate 3건이 통과하고 clone이 남지 않으며 `make lint-python`이 통과합니다.

### 2026-10-20 — Rust validator의 공유 reference resolver, type 이름, structure text (C16.33)

- `reference_resolver`는 `expand_properties`와 `expand_spec`에 option에서 `$ref`를 해석하는 방법을 주고, `json_type::js_type_of`는 `kind_of`와 expression engine이 쓰는 하나의 `typeof` bucket이며, `structure_text`는 `validate_list_text`와 `validate_detail_text`의 입력을 읽고, composition test는 `composed`를 호출합니다 (C16.33). Red: `make duplication-check`가 `packages/validator/rust`의 clone 4건을 나열했고, green: 1건이 남으며(공개 함수 `validate_list_text`와 `validate_detail_text`의 signature, `text.rs` 672-678줄과 685-691줄), `compose`(23), `validate`(46), `text`(12), `expr`(1) test와 `make lint-rust`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — 쌍을 이루는 PHP method의 고유한 docblock (C16.32)

- `Expression::evaluate`와 `evaluateValue`, `Nfa::matches`와 `WholeMatchPattern::matches`, `Patch::setDeepPath`와 `removeDeepPath`, `Validator::runImplicitNumber`와 `applyRules`는 서로의 docblock을 그대로 쓰고 있었습니다. 이제 각 method는 반환값, 예외, 짝과 다른 점을 적으며, `Public\Validator::validateList`와 `validateDetail`은 같은 머리를 가진 closure 대신 map 이름을 `validateComposition`에 넘깁니다 (C16.32). Red: `make duplication-check`가 `packages/validator/php`의 clone 5건을 나열했고, green: 없음. list(20), detail(14), text validity(46), validate(318), expression(78), patch(17), compose(20), doc coverage test와 `make lint-php`가 통과합니다.

### 2026-10-20 — Go validator의 공유 slot shape와 structure 검증 (C16.31)

- `shapeLiteral`은 `ValidateSlot`, `DesignSlot`, `BehaviorSlot`, `OptionsSlot`(각각 `shape` method로 자기 shape를 알림)의 다형 slot에 대한 null, false, true literal을 쓰고, `validateStructure`는 list나 detail을 composition, 확장, 금지 key scan하므로 `ValidateList`와 `ValidateDetail`은 field map과 list에만 있는 member만 적습니다 (C16.31). Red: `make duplication-check`가 `packages/validator/go`의 clone 4건을 나열했고, green: 없음. Go test 748건과 `make lint-go`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — parameter를 받는 PHP rule의 base class (C16.30)

- `ParameterRule`은 값을 보기 전에 parameter를 읽고 검사합니다. `FlagRule`(`Digits`, `Number`), `NumericRule`(`Max`, `Min`, `Range`, `Step`), `LengthRule`(`MaxLength`, `MinLength`, `RangeLength`), `CountRule`(`MaxCount`, `MinCount`)은 `MeasuredRule`을 통해 각 종류가 공유하는 부분을 더하므로, 각 rule은 자기 parameter와 비교만 적습니다 (C16.30). Red: `make duplication-check`가 이 rule들 사이의 clone 14건을 나열했고, green: 없음. `ValidateConformanceTest`(318), `RuleParametersTest`(10), `DocCoverageTest`, `make lint-php`, PHP doc coverage가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — layout으로 찾는 rebuild class (C16.7-10)

- `config/rebuild.json`에서 `paths`를 제거하고(kit K286이 저장소 layout으로 도구 source를 찾음) layout이 더한 98개 source를 분류합니다. kit bootstrap의 사본, benchmark program, cross-check console, form comparison과 form structure example, CLI entry, Svelte component의 ESLint 설정입니다. form comparison의 `step-runner.mjs`, `unit-pool.mjs`, `forward.mjs`는 `replaced`이며 item은 C16.28과 C16.29입니다 (C16.7-10). Red: `make rebuild-check` exit 1(schema가 `paths`를 거부하고, 이어서 class 없는 source 98개), green: exit 0.

### 2026-10-20 — core의 raw control markup (C16.27)

- `@polyspec/crudui-generator-core/internal`은 React, Vue, Svelte adapter가 각자 사본을 두던 raw control markup인 `escAttr`, `escText`, `serializeAttrs`, `rawVoid`, `rawElement`, `rawOptions`, `affixHtml`, `rawControl`, `choiceLabelClass`, `groupButtonHtml`, `choicesHtml`, `searchHtml`, `hasEventAttr`(`src/raw-markup.ts`)를 export하고, adapter가 이를 import합니다 (C16.27). Svelte의 event attribute 판별은 `on`으로 시작하는 모든 이름이 아니라 다른 두 adapter와 같이 `on` 뒤에 글자가 오는 이름입니다. Red: `make duplication-check`가 세 adapter의 `raw.ts`와 widget file 사이의 clone 12건을 나열했고, green: 없어지며(전체 clone 118건이 남음), Vue와 Svelte의 form rendering conformance test(각 463건)와 두 package의 다른 conformance test, `make lint-ts`가 통과합니다. 출력은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — TypeScript validator의 공유 composition layering, literal reader, rule 형태 (C16.26)

- `layerMembers`(`compose/layer.ts`)는 `composeProperties`, `composeSpec`, `composeRoot`, `expandNestedRefs`를 위해 node의 member를 layering하고, `ConditionParser.matchLiteral`은 literal token을 읽으며, `parameterRule`, `flagRule`, `formatRule`(`rules/factories.ts`)은 `max`, `min`, `range`, `step`, `maxlength`, `minlength`, `rangelength`, `maxcount`, `mincount`, `digits`, `number`, `date`, `dateISO`, `url`, `email`, `enddate`, `equalTo`가 각자 풀어 적던 parameter 검사, 빈 값 건너뛰기, message 선택을 담습니다 (C16.26). Red: `make duplication-check`가 `packages/validator/ts`의 clone 10건을 나열했고, green: 없음. conformance와 unit test 465건과 `make lint-ts`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — Rust validator의 공유 함수 (C16.25)

- `compose::members`는 `layer_members`(`$ref` base, 이후 member, `$patch`)와 `kind_of`를 담습니다. 이전에는 `compose`, `ref_`, `patch`가 각각 사본을 가졌습니다. `file_accepted`는 `accept` rule의 두 file 형태를, `numbers_equal`은 두 equality를 처리하고, `validate_field_rules`는 사본(`validate_element_rules`) 대신 `element_level` flag를 받으며, `list_or_detail_input`은 `validate_list_text`와 `validate_detail_text`의 입력을 읽습니다 (C16.25). Red: `make duplication-check`가 `packages/validator/rust`의 clone 11건을 나열했고, green: 4건이 남으며(함수 머리와 type 이름 match), `compose`(23), `validate`(46), `text`(12), `expr`(1) test와 `make lint-rust`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — config/rebuild.json의 모든 도구 source (C16.7-9)

- `config/rebuild.json`의 `paths`는 Rust port의 tool folder(`packages/*/*/tools`), Go generator(`*_generate.go`), PHP test의 number-text generator, benchmark의 build와 fixture script, example의 build와 install script 2개, fixture generator `tests/fixtures/*/generate.mts`도 선택하며, 새 도구 15개가 각각 class를 가집니다. `policy` 12개(single-source table과 fixture generator)와 `ecosystem` 3개입니다. `comment`는 test이거나 example product여서 도구가 아닌 묶음을 밝힙니다 (C16.7-9). Red: `make rebuild-check` exit 1, class 없는 도구 15개, green: exit 0.

### 2026-10-20 — Go validate package의 공유 field 순회, rule 해제, composition 입력 (C16.24)

- `fieldDeclarations`는 properties map의 field 선언을 yield하고, `ruleOff`는 rule을 해제하는 parameter를 판별하며, `composeInput`은 `Validate`, `ValidateList`, `ValidateDetail`을 위한 specification, loader, option을 준비합니다. `params.go`, `validator.go`, `rules.go`, `list.go`, `detail.go`, `index.go`의 사본을 대체합니다 (C16.24). Red: `make duplication-check`가 `validate/`의 clone 6건을 나열했고, green: 1건이 남으며(`ValidateList`와 `ValidateDetail`의 머리), Go test 762건과 `make lint-go`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — Go validator의 두 helper로 읽고 쓰는 ordered object (C16.23)

- `marshalOrdered`는 map의 member를 key 순서대로 쓰고 `decodeOrdered`는 처음 나온 순서로 다시 읽습니다. `PropertyMap`, `Content`, `ConditionMap`, `Messages`, `DeclaredAttributes`, `Items`의 `MarshalJSON`과 `UnmarshalJSON`에 있던 사본을 대체하며, object가 아닌 값의 오류 문구는 그대로입니다 (C16.23). Red: `make duplication-check`가 `types.go`의 ordered-object 코드 clone 11건을 나열했고, green: 이 file의 다른 clone 4건은 남고 이것들은 없어집니다. Go test 759건과 `make lint-go`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — Go validator의 하나의 path reader (C16.22)

- `expr.ValueAtSegments`는 구체적인 path segment의 값을 읽고, `Evaluator.getValueByPath`와 `validate` package가 각자 사본을 두는 대신 이를 호출합니다 (C16.22). Red: `make duplication-check`가 `expr/evaluator.go`와 `validate/helpers.go` 사이의 24줄 clone 1건을 나열했고, green: 없음. `expr`와 `validate`의 Go test 369건과 `make lint-go`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — duplication 제외 목록의 생성된 Go와 TypeScript table (C16.21)

- `config/duplication.json`은 `contracts/unicode-properties.json`에서 생성되는 `packages/validator/go/validator/validate/unicode_data.go`(`unicode_data_generate.go`가 씀)와 `packages/validator/ts/src/unicode/properties.ts`(`generate-unicode-properties.mjs`가 씀)를 각각의 이유와 함께 제외합니다 (C16.21). Red: `make duplication-check`가 clone 168건을 나열했고 그중 10건이 이 두 file에 있었으며, 이 item의 결과: clone 158건이 남습니다.

### 2026-10-20 — C16.15의 clone 수 (C16.15-1)

- C16.15의 항목은 `make duplication-check`가 `src/Compose`에서 9건이 아니라 7건을 나열했다고 적습니다. 4건은 `Compose.php`에서, 3건은 `Patch.php`에서 시작했습니다 (C16.15-1). Red: 항목은 9라고 적었으나 그 item의 첫 실행은 7줄을 나열했고, green: 항목이 7을 적습니다.

### 2026-10-20 — offline-checks test의 online target (C16.7-8)

- `tests/build/offline-checks.test.mts`는 `$(ONLINE)`으로 실행하는 target을 kit 0.0.54의 `kit.mk`가 정의한 대로 기대합니다. `php-ext-arginfo`와 `unlink`는 online으로 실행하고, `release-tools`와 `release-backend`는 더는 그렇지 않습니다 (C16.7-8). Red: `the Makefile runs cargo, go, npm and Composer offline, and only the install targets lift it`이 이 네 이름으로 실패했고, green: 이 file의 4건이 모두 통과합니다.

### 2026-10-20 — ci-local test의 release workflow trigger (C16.7-7)

- `tests/build/ci-local.test.mts`는 `@polyspec/kit`이 복사한 `.github/workflows/release.yml`의 trigger를 기대합니다. tag `v*`와 `**/v*`, 그리고 tag를 지정하는 수동 실행입니다 (C16.7-7). Red: `each workflow declares exactly its triggers`가 `workflow_dispatch`와 입력 `tag`를 선언한 `release.yml`에서 실패했고, green: `ci-local.test.mts`의 17건이 모두 통과합니다.

### 2026-10-20 — local 전체 실행이 없는 Makefile (C16.7-3)

- target `ci`, `check`, `conformance-reset`, `CHECK_TARGETS`와 그 help 줄을 제거합니다. 이들은 kit 0.0.54가 제공하지 않는 `full-run.mjs`를 시작했습니다(kit K240). `CI_TARGETS`는 `tests/build/ci-local.test.mts`가 workflow와 같게 유지하는 목록으로 남고, 이 file의 새 test는 Makefile의 모든 `$(KIT)/<tool>.mjs`가 설치된 package에 있어야 한다고 요구합니다. lint test, dry-run test, cargo-offline test는 제거된 target을 더는 이름으로 부르지 않습니다 (C16.7-3). Red: 새 test가 `full-run.mjs` 없음으로 실패했고 `make check`는 Error 1(`Cannot find module full-run.mjs`)로 끝났으며, green: 새 test, `CI_TARGETS lists every checking command`, `a CI job runs every lint target of kit`, `a workflow command missing from CI_TARGETS`, `a dry run under a parent make`가 통과합니다(5건).

### 2026-10-20 — ci-local test의 gates workflow (C16.7-6)

- `tests/build/ci-local.test.mts`는 `make kit-sync`가 `@polyspec/kit`에서 복사하는 `.github/workflows/gates.yml`을 trigger(pull request, `main`으로의 push, 수동 실행)와 함께 기대합니다 (C16.7-6). Red: `gates.yml`이 예상하지 못한 file이어서 `each workflow declares exactly its triggers`가 실패했고, green: 통과합니다.

### 2026-10-20 — ci-local test의 install target (C16.7-5)

- `tests/build/ci-local.test.mts`의 준비 pattern은 `install-`과 `crudui-install-` target의 `make` 줄을 받아들입니다. K246이 Makefile과 workflow의 install target에 붙인 이름입니다 (C16.7-5). Red: 모든 `make crudui-install-*` step이 검사 명령으로 세어져 test 4건이 실패했고(`make ci runs every checking command`, `every job runs its checks through make ci-targets`, `every checking step of the CI workflow runs after an earlier failure`, `a workflow command missing from make ci is reported`), green: 같은 4건이 통과합니다.

### 2026-10-20 — testing guide stamp (C16.7-4)

- C16.7-2가 두 문서를 함께 바꾼 뒤 한국어 문서를 영어 문서와 대조했고, `docs/operations/testing.ko.md`가 `testing.md`의 sha256을 담습니다 (C16.7-4). Red: `check-documents.mjs`가 revision finding 1건을 보고했고, green: 문서 쌍 81개가 통과합니다.

### 2026-10-20 — AGENTS와 testing guide의 CI 전용 규칙 (C16.7-2)

- `AGENTS.md`와 `docs/operations/testing.md`(와 한국어 쌍)는 PRINCIPLES.md대로 전체 suite가 CI에서만 실행된다고 적습니다. `make ci`, `make crudui-check`, full-run guard, `make rerun-failed`에 관한 규칙을 제거하고 `CI_TARGETS`는 workflow의 목록으로 설명합니다 (C16.7-2). Red: 두 문서가 kit 0.0.54에 없는 `full-run.mjs`의 local 전체 실행을 설명했고(`make rules-check`와 `check-documents`는 통과하므로 검사는 제거할 문장입니다: 두 파일에서 `rerun-failed`와 `full-run`을 `git grep`하면 16줄), green: 0줄. `full-run.mjs`를 아직 호출하는 Makefile target은 C16.7-3입니다.

### 2026-10-20 — PHP string rule과 참조 rule의 공유 guard (C16.20)

- `Rules\StringRule`은 `Email`, `Url`, `DateISO`의 해제와 string guard를, `Rules\ReferenceRule`은 `EndDate`와 `EqualTo`의 해제와 field 조회를 담습니다. 각 rule은 결과를 정하는 부분만 남깁니다 (C16.20). Red: `make duplication-check`가 `Date`, `DateISO`, `Email`, `Url`, `EndDate`, `EqualTo` 사이의 clone 5건을 나열했고, green: 해당 clone 없음. `ValidateConformanceTest`(318), `DocCoverageTest`, `FieldSpecTest`(17), `make lint-php`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — PHP data validator의 공유 rule 적용 (C16.19)

- `Validate\Validator::applyRules`는 하나가 실패할 때까지 rule을 실행하고 그 error를 기록합니다. array-level, element-level, field, 암묵 `number` rule이 모두 이를 쓰며, `validateFieldRules`는 두 번째 사본(`validateElementRules`) 대신 `elementLevel` flag를 받고, `fieldsOf`는 properties map의 field 선언을 한 번만 yield합니다 (C16.19). Red: `make duplication-check`가 `Validate/Validator.php`의 clone 4건을 나열했고, green: 1건이 남으며(`runImplicitNumber`와 `applyRules`의 docblock과 signature), `ValidateConformanceTest`(318), `PublicApiTest`(8), `MessagePlaceholderTest`(6), `make lint-php`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — range parameter의 pair를 읽는 하나의 reader (C16.18)

- `Numeric::orderedPair`는 `[minimum, maximum]` parameter를 member reader와 함께 읽고, `Numeric::range`와 `LengthLimit::range`는 각각 `finite`와 `integer`를 넘깁니다 (C16.18). Red: `make duplication-check`가 `Values/LengthLimit.php`와 `Values/Numeric.php` 사이의 clone 1건을 나열했고, green: 없음. `NumericTest`(31), `ValuesTest`(34), `RuleParametersTest`, `make lint-php`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — list와 detail이 쓰는 하나의 composition 검증 (C16.17)

- `Validator::validateComposition`은 text 검사, root와 지정된 map의 composition, 금지 member 검사를 한 번만 수행하고, `validateList`와 `validateDetail`은 자기 map만 지정합니다 (C16.17). Red: `make duplication-check`가 `Public/Validator.php`의 clone 1건을 나열했고, green: 없음. list(20), detail(14), text validity(46) conformance test와 `make lint-php`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — PHP expression parser의 literal reader 하나 (C16.16)

- `Parser::literal`은 string, number, boolean token을 `LiteralNode`로 소비합니다. 이전에는 `parsePrimary`와 `parseValueListItem`이 각각 풀어서 세 번씩 적었습니다 (C16.16). Red: `make duplication-check`가 `Expr/Parser.php`의 clone 2건을 나열했고, green: 없음. `ExprConformanceTest`(78)와 `make lint-php`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — 조합 member를 위한 하나의 module (C16.15)

- `Compose\Members`는 node member의 layering(`$ref` base, 이후 member, `$patch`), shallow merge, plain-object 판별, `UNDEFINED` sentinel, member의 shape 유지 rebuild를 담습니다. 이전에는 `Compose`, `Ref`, `Patch`가 각각 사본을 가졌습니다 (C16.15). Red: `make duplication-check`가 `src/Compose`의 clone 7건(`Compose`/`Ref`/`Patch`)을 나열했고, green: 1건이 남으며(`setDeepPath`와 `removeDeepPath`의 docblock과 signature), `ComposeConformanceTest`(20), `PatchTest`(17), `RefTest`(7), `make lint-php`가 통과합니다. 동작은 바뀌지 않으므로 red는 clone 목록입니다.

### 2026-10-20 — rerun-failed 없는 owner 검사 (C16.7-1)

- `config/owner-checks.json`의 `fullSuite`는 `ci`만 담습니다. kit K240이 local 전체 실행과 `rerun-failed` target을 제거했습니다 (C16.7-1). Red: `make owner-validate` exit 1 (`fullSuite names rerun-failed, which is not a target`), green: exit 0 (`owns every tracked path`). C16.7-2가 local 전체 실행을 아직 설명하는 AGENTS.md의 규칙을 다시 씁니다.

### 2026-10-20 — duplication 제외 목록 (C16.14)

- `config/duplication.json`은 `generate-unicode-data.mjs`, `generate_unicode_data.py`, `generate-unicode-data.php`가 `contracts/unicode-properties.json`에서 쓰는 Unicode table과 test(`tests/**`, `packages/*/tests/**`, `packages/*/*/tests/**`, `*.test.*`, `*_test.go`)를 각각의 이유와 함께 제외합니다. `examples/**`는 검사 대상으로 남습니다 (C16.14). Red: `make duplication-check` exit 2, clone 428건. 이 item의 결과: clone 183건이 남으며(c 19, go 28, javascript 10, php 53, python 3, rust 17, typescript 53), 이후 item이 제거합니다.

### 2026-10-20 — 저장소 도구의 class (C16.7)

- `config/rebuild.json`은 `scripts/`, `packages/*/scripts`, `packages/php-ext/tools`의 각 도구에 class를 지정합니다. `ecosystem` 13개, `policy` 17개(single-source table generator, fixture generator, polyspec contract 검사), `record` 6개(rebuild record `docs/rebuild/test-commands.md`, `build-stamp.md`, `install-lock.md`, `install-phpdocumentor.md`), `replaced` 14개이며, 대체 item은 C16.8(VitePress), C16.9(phpize, S10 때문에 보류), C16.10(kit의 process-group runner), C16.11(ajv schema), C16.12(CSS layer import), C16.13(`@unicode/unicode-16.0.0`)입니다 (C16.7). Red: `make rebuild-check` exit 2 (`config/rebuild.json does not exist`), green: exit 0.

### 2026-10-20 — PHP generator의 빈 catch 제거 (C16.6)

- `Design::appearance`는 `Design::parses`가 받아들이는 문자열에만 `Expression::parse`를 호출하므로, expression이 아닌 문자열은 삼킨 예외 없이 literal text로 남습니다. `FormTest`의 row 한도 test는 검증하려는 거부를 조용히 catch하는 대신 기록하여 assert합니다 (C16.6). Red: `make lint-php` exit 2 (`Design.php:96`과 `FormTest.php:257`의 `Generic.CodeAnalysis.EmptyStatement.DetectedCatch`), green: `make lint-php` exit 0, FormTest 22건, DisplayRulesTest 21건, ButtonsTest 18건, RenderingTest 3건 통과.

### 2026-10-20 — .site 없는 docs 폴더 (C16.5)

- `docs/`는 K245가 허용한 폴더만 담습니다. 더 이상 생성되지 않는 `docs/.site/` build 출력을 `scripts/docs-web/build.mts`와 `watch.mts`의 제외 조건, 그 test, `docs/operations/documentation.md`와 함께 제거합니다 (C16.5). Red: `make layout-check` exit 2 (`docs/.site: docs-folders: K245`), 제외 조건을 제거하면 docs test 2건이 실패했고, green: `make layout-check` exit 0, docs test 17건 통과.

### 2026-10-20 — 한국어 checklist revision (C16.4)

- kit-standard plan의 한국어 checklist를 `checklist.md`와 대조해 검토했고, 원문의 sha256을 담습니다 (C16.4). Red: `check-documents.mjs`가 revision finding 1건을 보고했고, green: finding이 없습니다.

### 2026-10-19 — kit 표준 0.0.54 (C16.1)

- CI는 존재하는 target만 PHP 8.4 도구로 호출하고, platform test는 skip하지 않고 모든 platform에서 실행한다 (C16.2).
- 저장소는 `@polyspec/kit` 0.0.54의 working principle과 표준 S1부터 S10까지를 따릅니다. 각 plan은 `docs/plans/<plan>/` 폴더이며 `plan.md`와 `checklist.md`를 둡니다. execution checklist와 wave 기록은 `docs/plans/execution-checklist/`로 옮겼습니다. `AGENTS.md`와 `AGENTS.ko.md`는 이 저장소의 규칙만 두며, 각 규칙에 `Enforced by:` 줄을 둡니다.
- PHP는 8.4로 고정합니다. package의 요구 조건은 `>=8.4`이며, `config/php-lint`의 Composer platform은 root `composer.json`과 같은 `8.4.1`입니다.
- `make records-check`는 더 이상 `crudui-docs-check`를 실행하지 않아, `records-check`, `crudui-docs-check`, `docs-check-documents` 중 어떤 target도 자기 자신에 닿지 않습니다.
- `packages/cli`, `packages/svelte`, `packages/vue`, `packages/react`의 test 폴더와 Vue source의 test 폴더는 `tests`라는 이름을 씁니다. `docs/`의 README는 `docs/index.md`와 중복되어 제거했습니다.
- 생성되는 form template 검증기는 코드가 읽지 않는 schema 상수와 부모 인수를 제거합니다.
- Python 검증기는 expression parser가 내는 이름 있는 예외만 잡고, Rust benchmark와 cross-check console은 `Result`를 버리지 않습니다.

### 2026-10-15 — 0.0.x의 local link (C14.51)

- `AGENTS.md`와 `AGENTS.ko.md`는 polyspec version이 0.0.x인 동안 개발 checkout이 kit의 `docs/plans/local-links.md`가 설명하는 대로 설치된 polyspec package를 그 source에 link하며 link는 commit하지 않는다고 적는다(C14.51).

### 2026-10-15 — 파일을 감시하지 않는 browser test (C14.47)

- browser test `form-styles`, `widget-scripts`, `widget-script-runs`의 Vite dev server는 어떤 파일도 감시하지 않으므로(`server.watch: null`), mise가 `var/tools` 아래에 쓰는 것 같은 checkout 아래의 tsconfig 파일 변경이 더 이상 검사 도중에 페이지를 다시 읽지 않는다(C14.47).

### 2026-10-15 — browser dependency scan 없는 cross-check console engine (C14.46)

- cross-check console의 SSR engine의 Vite server는 browser dependency를 찾지 않으므로(`optimizeDeps.noDiscovery`), cold start가 더 이상 1분 넘게 checkout의 모든 HTML 파일을 훑지 않고 첫 render가 timeout되지 않는다(C14.46).

### 2026-10-15 — render option decoder (C14.50)

- `@polyspec/crudui-generator-core`는 `decodeFormRenderOptions(value)`와 `FormRenderOptionsError`를 export한다. `decodeFormRenderOptions`는 파싱한 render option을 모든 renderer가 실행하는 검사로 검사하고 `FormRenderOptions`로 돌려주며, `FormRenderOptionsError`는 그것과 renderer가 잘못된 멤버의 JSON Pointer를 `pointer`에 담아 던지는 `FormInputError`다. 메시지는 바뀌지 않는다(C14.50).

### 2026-10-15 — crudui describe의 문법 행 (C14.42)

- `crudui describe`는 `docs/spec/expressions.md`의 token 표의 모든 행을 읽고, 잘못된 행이나 없는 section을 건너뛰지 않고 실패한다. 예시에 escape되지 않은 `||`가 있던 `LPAREN RPAREN` 행은 이제 pattern `( )`를 준다(C14.42).

## 0.0.7

### 2026-10-15 — kit 0.0.53 (C14.48)

- crudui는 `@polyspec/kit` 0.0.53을 pin한다. 그 release workflow는 어떤 release step보다 먼저 `make kit-check`를 실행하고, 그 kit-check는 crudui가 선언하는 `.php-version`을 요구하며, 그 release proof는 draft URL을 비교하는 대신 release가 각 sibling wheel을 나열하는지 확인한다(kit K191, K193, K195)(C14.48).

## 0.0.6

### 2026-10-15 — wheel인 Python package (C14.44)

- Python package `polyspec-crudui-validator`와 `polyspec-crudui-generator`는 `config/toolchain.json`의 `pythonBackend` setuptools 84.0.0으로 build한 wheel로 릴리스하며(kit K29, K166), 더 이상 git subdirectory pin으로 설치하지 않는다. generator는 같은 릴리스의 validator wheel을 그 릴리스 URL로 요구하며, uv workspace는 그것을 checkout의 validator로 풀고 `make python-lock`은 lock에서 뺀다(K190). `make release-pins`와 `scripts/release-pins.mts`는 지운다(C14.44).

### 2026-10-15 — .php-version의 PHP (C14.45)

- `.php-version`은 crudui의 PHP minor 8.5를 담고 workflow의 모든 setup-php step이 그것을 읽으므로, kit의 release workflow는 runner의 PHP를 유지하는 대신 release proof에 그 PHP를 설치한다. PHP API와 PHP validator job에는 더 이상 PHP matrix가 없다(C14.45).

### 2026-10-15 — kit 0.0.51 (C14.41)

- crudui는 `@polyspec/kit` 0.0.51을 pin하고 `es-module-lexer` 3.0.4를 받는다. `config/knip-entries.json`은 script와 테스트가 실행하는 binary go, php, make를 선언하고, 생성된 폼 템플릿 validator를 disable 주석 대신 `ignore` 항목으로 knip과 oxlint에서 뺀다(kit K172, K176). `install-ordered-json`은 `kit-bootstrap.mk`가 이제 패키지 설치 전에 정의하는 `$(NODE)`로 node를 시작한다(K185)(C14.41).

### 2026-10-15 — 타입 검사를 받는 명령줄과 생성기 테스트 (C14.39, C14.40)

- `packages/cli`는 엄격한 tsconfig를 가지며, 그 `typecheck` script와 `make typecheck`가 그것을 실행한다(C14.39).
- `packages/generator/ts`의 테스트는 공유 폼 세션 시나리오를 `@ts-expect-error` 없이 그 타입과 함께 import한다(C14.40).

### 2026-10-15 — 실행 중 ajv 없는 폼 템플릿 validator (C14.38)

- `@polyspec/crudui-generator-core`의 `decodeFormTemplate`은 `contracts/schema/form-template.schema.json`의 ajv standalone 검증 코드로 검사한다. `make form-template-validator`가 그것을 생성하고 `make build`가 검사한다. 패키지는 더 이상 ajv에 의존하지 않고 실행 중에 코드를 컴파일하지 않으므로, `unsafe-eval` 없는 Content-Security-Policy가 그것을 허용한다(C14.38).

### 2026-10-15 — 폼 템플릿 decoder (C14.37)

- `@polyspec/crudui-generator-core`는 `decodeFormTemplate(value)`와 `FormTemplateError`를 export한다. `decodeFormTemplate`은 컴파일된 폼 템플릿의 파싱한 JSON을 `contracts/schema/form-template.schema.json`에 대해 ajv로 검사하고 `FormTemplate`으로 돌려주며, `FormTemplateError`는 그것이 첫 번째로 잘못된 멤버의 JSON Pointer를 `pointer`에 담아 던지는 `FormInputError`다. 패키지는 ajv에 의존한다(C14.37).

### 2026-10-15 — kit 0.0.48 (C14.36)

- crudui는 `@polyspec/kit` 0.0.48을 pin한다. 각 checkout은 `mise.toml`의 Node.js 26.12.0을 실행하며, `make install-tools TOOLS=npm`이 그것을 mise로 `var/tools`에 설치한다. `.node-version`은 없어졌고, 모든 `package.json`의 `engines.node`는 `>=26.12.0`이다. Makefile의 각 recipe는 node, go, Composer를 절대 경로(`$(NODE)`, `$(GO)`, `$(COMPOSER)`)로 시작하고, workflow는 actions/checkout v7.0.1, actions/setup-node v7.1.0, shivammathur/setup-php 2.40.0을 전체 SHA로 pin한다(kit K169, K171)(C14.36).

### 2026-10-15 — cast 없는 TypeScript (C14.12)

- TypeScript가 type assertion, `any`, non-null assertion 없이 kit 0.0.47의 lint를 통과한다(kit K155, K156, K157). `@polyspec/crudui-generator-core`: `Translate`는 text를 `unknown`으로 받는다. 지역화된 text가 아닌 값에는 이미 fallback을 돌려주었기 때문이다. 값이 문자열이 아닌 선언된 attribute는 그 경로를 밝히는 `FormInputError`로 실패한다. `@polyspec/crudui-validator`: `accept` rule은 file 객체의 문자열 member만 읽는다. 전에는 `type`이나 `name`이 문자열이 아닌 file이 `validate`를 죽였다. `@polyspec/crudui-form-binding`: `bindForm`은 window가 없는 document의 form에 대해 form을 바꾸기 전에 `TypeError`를 던진다(C14.12).

### 2026-10-15 — kit 0.0.47 (C14.35)

- crudui는 `@polyspec/kit` 0.0.47을 pin한다. 그 oxlint는 non-null assertion을 실패시키고 type-aware rule을 TypeScript 파일에만 적용한다(kit K156, K170). Svelte 도구는 `@sveltejs/package` 3.0.1을 받는다(C14.35).

### 2026-10-15 — OrderedJSON 0.0.9 (C14.34)

- 폼 비교는 모든 언어에서 OrderedJSON 0.0.9로 JSON을 읽고 쓴다. release zip `polyspec-ordered-json-php-0.0.9.zip`의 Composer 패키지, Go module `github.com/polyspec/ordered-json/packages/go` v0.0.9, tag `v0.0.9`의 Rust crate, 그리고 패키지가 `packages/`에 있는 `v0.0.9` 체크아웃의 npm 패키지와 PHP 확장이다(C14.34).

### 2026-10-15 — 폼 비교 suite의 php-ext leg (C14.33)

- 폼 비교의 local verification은 PHP 서버의 PHPUnit suite를 php-ext 모드로도 실행한다. 두 확장 모듈은 kit의 반복 가능한 `--php-extension`(K165)으로 로드하고 group `php`는 뺀다. test helper `PhpProcess`는 php-ext 실행이 internal로 요구하는 class 밖의 namespace `Polyspec\CruduiTestSupport\`로 옮긴다(C14.33).

### 2026-10-15 — kit 0.0.46 (C14.32)

- crudui는 `@polyspec/kit` 0.0.46을 pin한다. kit이 layout에서 Composer monorepo의 root `composer.json`과 `composer.lock`을 허용하므로 `config/layout.yml`은 더 이상 그 둘을 이름 짓지 않는다(K167).

### 2026-10-15 — Composer와 PHPUnit 위의 PHP 프로그램 (C14.30)

- root `composer.json`은 Composer 기본 link를 쓰는 path 저장소로 `polyspec/crudui-validator`와 `polyspec/crudui-generator`를 요구하므로 각 패키지는 자신의 autoload로 로드된다. autoloader를 등록하던 `scripts/php-package-autoload.php`와 검증기 사본의 재설치는 없어졌고, 문서 검사는 class `Polyspec\Crudui\Docs\DocCoverage`이다(C14.30).
- 폼 비교의 PHP 레코드 서버는 `examples/form-comparison/servers/php`의 PSR-4 namespace `Polyspec\Crudui\FormComparison\`이고 진입점은 `servers/php/api.php`이며, `config/release-assets.json`이 고정하는 release zip의 `polyspec/ordered-json` 0.0.3으로 JSON을 읽는다. php-ext에서는 Composer autoloader가 없다는 조건 대신 모든 CRUDUI class가 확장의 내부 class여야 하며 각 응답 전에 이를 검사한다(C14.30).
- 폼 비교와 `packages/php-ext`의 PHP 검사 script는 PHPUnit suite(`servers/php/tests`, `packages/php-ext/tests/ApiTest.php`)이고, 다섯 PHP 프로그램은 함수를 closure로 두므로 어떤 PHP 파일도 side effect 옆에 symbol을 선언하지 않는다(C14.30).

### 2026-10-15 — 빌드된 모듈에서 읽는 계약 manifest export (C14.10-1)

- `scripts/check-contract-manifest.mts`는 각 패키지 진입점의 값 export를 선언한 devDependency인 es-module-lexer로 빌드된 ES module 파일에서 읽고, 각 `export * from`은 Node의 해석이 주는 모듈로 따라간다. TypeScript 7 API(`typescript/unstable/sync`), 그 가상 file system과 `.svelte` 선언 stub은 없어졌다. `npm run manifest:check`는 빌드가 최신이 아니면 먼저 패키지를 빌드하고, 검사는 진입점의 빌드된 파일이 없거나 진입점에 ES module 파일이 없으면 실패한다(C14.10-1).

### 2026-10-15 — make install-rust 없음 (C14.26)

- `make install-rust`는 없어진다. K151 이후 kit의 `make install-tools`가 `rust-toolchain.toml`의 Rust toolchain을 설치하므로 workflow는 `make install-tools`만 실행하고, 각 Cargo cache step은 cache key를 위해 toolchain이 있도록 그 뒤에 온다(C14.26).

### 2026-10-15 — 식에서 배열과 객체의 동등 비교 (C14.25)

- `==`, `!=`, `in`은 모든 port에서 두 배열이나 두 객체를 JSON 값으로 비교한다. 같은 원소를 같은 순서로 가진 두 배열과 key 순서와 관계없이 같은 key와 같은 값을 가진 두 객체는 같고, 숫자는 값으로 비교하며, 배열은 객체와 같지 않다. TypeScript와 Python은 이를 identity로 비교했고, Go에서는 결코 같지 않았으며, PHP와 Rust는 `1`과 `1.0` 같은 정수와 소수를 다르게 비교했다. wildcard 없는 경로가 가리키는 배열은 하나의 값이며, TypeScript, PHP, Go, Python은 이를 wildcard의 후보로 다뤘다. 문자열 비교에서 PHP extension의 C engine은 다른 port처럼 boolean을 `true`나 `false`로 쓰며, 이전에는 `1`과 빈 text를 썼다. 공유 vector가 각 규칙을 검사한다(C14.25).

### 2026-10-15 — validator의 type test (C14.24)

- `packages/validator/ts`의 Vitest suite는 Vitest의 typecheck mode로도 실행되므로, 이제 `src/types.test-d.ts`에 있는 작성 type의 `expectTypeOf` assertion이 `tsc`로 검사된다. runtime 실행은 이를 평가하지 않았다(C14.24).

### 2026-10-15 — spec의 bundle된 benchmark console (C14.23)

- form-comparison spec은 `public/`의 module이 그대로 제공되고 build가 benchmark console을 그것이 import하는 source module과 함께 bundle하므로 어떤 source module도 공개 디렉터리에 복사되지 않는다고 명시한다. Chromium case는 `src/`의 `frame-readiness.mjs` 대신 page script가 `public/`에서 import하는 module을 로드한다(C14.23).

### 2026-10-15 — 공개 작성 type (C14.22)

- `@polyspec/crudui-validator`는 명세의 작성 type을 entry에서 export한다. `FieldSpec`, `RangeFieldSpec`, `ValidateSlot`, `DesignSlot`, `Items`, `Multiple`, `Lang`, `ConditionMap`과 이것들이 가리키는 모든 type이 docs/spec/schema.md가 정의하는 대로 각각 문서와 함께 제공된다(C14.22).

### 2026-10-15 — benchmark console pointer guard (C14.21)

- form comparison의 benchmark console은 spec이 요구하는 대로 pointer가 비교 frame 위에 있으면 capture를 멈추고 frame을 비교하지 않는다. console이 main page 밖으로 옮겨간 뒤 어떤 page도 그 guard를 부르지 않았다.

### 2026-10-15 — Form comparison import (C14.20)

- form comparison은 `#adapter`, `#stage`, `#html`, component alias를 Vite와 esbuild alias 대신 frame·stage build마다 condition을 가진 root `package.json`의 subpath import로 resolve한다. benchmark console은 source에서 bundle되고 `record-view.mjs`는 `public/`에 있으므로 모든 import가 source tree와 서비스될 때 모두 resolve된다(C14.20).

### 2026-10-15 — kit 0.0.45 (C14.19)

- crudui는 `@polyspec/kit` 0.0.45를 pin한다. 그 knip은 pin된 런타임의 binary를 무시하고 `config/knip-entries.json`의 `binaries`와 `workspaces`를 읽으며, 이 파일은 make, test, page, 도구가 경로로 실행하는 파일과 workspace를 그 entry와 무시하는 의존성과 함께 선언한다. 아무것도 쓰지 않는 의존성인 root의 `debug`, React 패키지의 `@testing-library/user-event`, Vue와 Svelte 패키지의 `parse5`를 없애고, 브라우저 설치 script와 form comparison이 import하는 `puppeteer-core`와 `vue`를 선언한다(C14.19).

### 2026-10-15 — Go module (C14.18)

- Go module은 ordered-json의 무시되는 clone 없이 resolve된다. `go.work`는 checkout의 module만 쓰고, module들은 다음 release가 `packages/{validator,generator}/go`에 tag를 붙일 때까지 서로를 main의 pseudo-version으로 요구하며, form-comparison Go 서버는 `github.com/polyspec/ordered-json/go` v0.0.3을 요구한다. `make install-go-modules`(`make install`의 일부)는 workspace가 요구하는 module을 내려받으므로 Go 검사는 offline으로 남는다. mise.toml의 govulncheck가 새 Go lock을 검토한다(C14.18).

### 2026-10-15 — rule parameter (C14.15)

- `equalTo`와 `enddate`(field reference 문자열), `notEqual`(문자열, 숫자, boolean), `unique`(true, false, 문자열)의 parameter는 모든 언어에서 specification을 load할 때 검사되며 `INVALID_RULE_PARAMETER`로 실패한다. 객체나 목록이 값으로 받아져 rule에 닿았다.

### 2026-10-15 — Documentation web (C14.14)

- Pages workflow가 다시 문서 web을 build한다. API Documenter가 H2 제목만으로 쓰는 API page는 그대로 받아 그 첫 제목을 제목으로 삼고, 손으로 쓴 page는 H1 제목을 정확히 하나 유지한다(C14.14).

### 2026-10-15 — lint가 찾은 결함 (C14.16)

- TypeScript와 Python validator의 식 `==`, `!=`, `in`은 배열이나 객체를 스칼라와 비교할 때 PHP, Go, Rust, C evaluator처럼 숫자 없이 빈 text로 비교한다. 객체로 `.o == '[object Object]'`, `['a']`로 `'a' == .tags`가 그 둘에서만 참이었다. spec이 이를 적고 공유 vector가 검사한다.
- form comparison의 PHP 서버는 지울 수 없는 socket 디렉터리 같은 중지 실패를 보고하고 상태 1로 끝난다. 그 rejection은 처리되지 않아 process를 중단시켰다.
- form comparison의 Svelte adapter는 dispose될 때 각 컴포넌트의 `unmount`를 기다린다. dispose가 unmount가 끝나기 전에 반환했다.
- generator-core의 브라우저 binding은 text, date, checkbox, radio control의 값을 서버 render처럼 값의 PHP 문자열로 쓴다. `true`는 `1`이고 `false`, 배열, 객체는 빈 값이며, 이전에는 `true`, `false`, `[object Object]`를 썼다.

### 2026-10-15 — Svelte component exports (C14.12)

- `@polyspec/crudui-generator-core`는 공개 타입 `NodeVM`과 `WidgetModel`이 이미 이름 짓던 타입 `Translate`와 `SourceAttrs`를 내보내고 `DetailFieldVM`을 문서화한다. validator와 form binding의 TSDoc은 TSDoc으로 해석된다(C14.12).
- `@polyspec/crudui-generator-svelte`는 각 컴포넌트를 문서화된 Svelte 5 `Component<XProps>`로, 그 props 타입 `XProps`를 이름으로 내보낸다(`FormProps`, `ListProps`, `DetailProps`, `NodeProps`, `ControlsProps`, `WidgetProps`, `OutlineProps`, `OutlineViewProps`, `DataViewProps`, `DataPanelProps`). svelte-package가 컴포넌트마다 문서 없이 쓰던 Svelte 4 instance의 타입 별칭 `type X = ReturnType<typeof X>`는 더 이상 내보내지 않으며, instance의 타입은 `ReturnType<typeof X>`이다(C14.12).

### 2026-10-15 — kit 0.0.44 (C14.13)

- crudui는 `@polyspec/kit` 0.0.44를 pin한다. `make install-tools`는 CI job이 cargo를 실행하기 전에 `rust-toolchain.toml`의 Rust toolchain을 설치하고, API Extractor는 더 이상 `ae-missing-release-tag`를 보고하지 않으며, oxlint는 node:test 등록을 허용하고, ruff는 cache를 `var/ruff`에 두며, `config/layout.yml`은 kit의 목록을 반복하는 대신 kit의 root 파일에 `.npmrc`, `composer.json`, `composer.lock`을 더한다. lock의 검토는 `puppeteer` 25.14.0, `playwright` 1.64.1, `tsup` 9.0.0을 받는다.

### 2026-10-14 — kit layout의 폴더 (C14.7)

- package는 S5를 따른다. port를 가진 component는 runtime마다 폴더를 둔다. 이전 → 새 폴더(게시된 이름은 그대로):

  | 이전 | 새 폴더 |
  |---|---|
  | `packages/validator-go`, `-php`, `-python`, `-rust`, `-ts` | `packages/validator/go`, `php`, `python`, `rust`, `ts` |
  | `packages/generator-go`, `-php`, `-python`, `-rust` | `packages/generator/go`, `php`, `python`, `rust` |
  | `packages/generator-core` | `packages/generator/ts` |
  | `packages/generator-html`, `-react`, `-vue`, `-svelte` | `packages/html`, `react`, `vue`, `svelte` |

- Go module은 `github.com/polyspec/crudui/packages/validator/go`와 `github.com/polyspec/crudui/packages/generator/go`이므로 tag는 `packages/validator/go/vX.Y.Z`와 `packages/generator/go/vX.Y.Z`다.
- git tag에서 crudui package를 설치하는 Python 프로젝트는 다음 release부터 새 폴더를 `subdirectory`로 적는다. consumer의 `pyproject.toml`은 v0.0.5에서 `packages/validator-python`과 `packages/generator-python`을 적고, 다음 tag에서는 `packages/validator/python`과 `packages/generator/python`을 적는다. `make release-pins`는 pin의 subdirectory가 checkout의 package 폴더일 것을 요구한다.
- meta-schema는 `contracts/schema/crudui.schema.json`(그 `$id`도 따른다), validator benchmark는 `benchmarks/validators`이고, phpDocumentor는 `scripts/install-phpdocumentor.mts`로 `var/tools/phpdocumentor`에 설치한다. `config/layout.yml`은 root 파일 `.npmrc`, `composer.json`, `composer.lock`, `tests/`의 cross-language 폴더, `packages/`의 component를 선언한다.
- 모든 crate는 unsafe code와 이유 없는 allow attribute를 금지하는 자기 workspace이고, 비교의 record server는 OrderedJSON을 그 저장소의 tag에서 받는다.
- `scripts/`와 `tests/`의 infrastructure는 TypeScript다. 그곳의 JavaScript module은 `make typecheck`가 엄격한 root `tsconfig.json`으로 검사하는 `.mts` 파일이고, form-render 사례의 React 생성기는 `packages/react/scripts`로 옮겼다. `config/layout.yml`은 다른 한 언어를 구동하거나 돕는 파일을 적는다. 비교의 공개 `form-snapshot.mjs`와 inspector test의 page는 Node.js의 `stripTypeScriptTypes`로 type을 지운 `form-snapshot.mts`를 받는다.

### 2026-10-14 — 최신 stable 의존성 (C14.8, C14.3-1)

- `make dependency-review UPDATE=1`로 최신 stable release를 받았다: vitest 5.0.4, @types/node 26.6.5, vue 3.5.44, postcss 8.5.30, @testing-library/user-event 14.6.8, phpunit 13.4.2. React는 exception(C5.8-2-1)에 따라 19.2.8에 머물고, `packages/generator-svelte`의 tools 프로젝트는 `config/toolchain.json`이 선언한 것과 같은 `config/dependency-policy.json`의 새 exception으로 TypeScript 6.0.3을 유지한다.
- svelte는 `packages/generator-svelte`만 선언한다. tools 프로젝트는 이를 도구의 peer로 설치하고, script는 도구를 `npm exec --prefix tools`로 실행한다.
- generator-core, form-binding, cli에는 `test` script가 없다. kit의 run-tests는 root를 작업 디렉터리에서 정하므로 `make test-cli`, `make test-form-binding`, `test:forms`, `contracts/features.json`의 verification 명령은 root에서 `run-tests.mjs vitest --cwd packages/<name>`을 실행한다.

### 2026-10-14 — TypeScript 7에서의 tests/build 도구 test (C14.10)

- `scripts/check-contract-manifest.mjs`는 각 진입점의 값 export를 TypeScript 7 API(`typescript/unstable/sync`)의 program과 checker로 읽으며, 그 가상 file system은 node_modules를 숨기고 `.svelte` component에 선언을 준다. `tests/build/public-packages.test.mjs`는 consumer fixture를 TypeScript 7의 `tsc --noEmit`으로 compile하고 그 exit status가 결과다. `public-types.mts`와 `public-types.cts`는 Node.js resolution으로, `public-types-svelte.mts`는 Svelte 프로젝트의 bundler resolution으로 compile하고, `module-only-require.cts`는 CommonJS 프로젝트가 compile할 수 없음을 확인한다. `tsc --listFilesOnly`는 program이 dist의 선언만 읽음을 보이고, module format은 package.json에서 읽으며, 선언 build는 `tsc --showConfig`와 실패하는 build로 검사한다.
- `PathContext`는 `@polyspec/crudui-validator`의 public type이다. generator-core의 public API가 이를 쓰며, 더는 internal 진입점에서 import하지 않는다.
- test는 kit 도구를 `node_modules/@polyspec/kit/dist`로 적고, Composer reinstall의 lock test는 script가 resolve하는 kit의 holder-lock을 알아본다.

### 2026-10-14 — kit 0.0.42 (C14.11)

- `@polyspec/kit`은 게시된 파일의 integrity로 0.0.42에 pin한다. `mise.lock`은 `mise.toml`의 도구를 linux-arm64와 macos-x64에도 잠그고, 복사된 bootstrap은 `var/tools/go.mod`를 써서 checkout의 Go module의 `./...`가 mise가 설치한 Go를 걷지 않는다.

### 2026-10-14 — API Extractor와 API Documenter의 TypeScript API (C14.5)

- 각 TypeScript package는 copy된 `config/api-extractor.kit.json`을 extend하는 `api-extractor.json`으로 공개 API를 API Extractor로 검사하고 report `etc/<package>.api.md`를 commit합니다. 문서 없는 export와 export되지 않은 type의 참조는 `make lint-ts`의 error입니다. `scripts/check-doc-coverage.mjs`는 Go, Rust, PHP를 검사하고, `scripts/gen-api-docs.mjs`는 API Extractor의 doc model에서 API Documenter로 TypeScript page를 씁니다. TypeDoc과 그 설정은 지웠습니다.
- root는 TypeScript 7.0.2를 선언하고, npm은 `packages/generator-svelte`의 TypeScript 6.0.3을 svelte-check, `@sveltejs/package`, svelte2tsx, typescript-eslint와 함께 그 workspace에 설치합니다.

### 2026-10-14 — ESLint 대신 kit의 TypeScript lint (C14.4)

- `make lint`는 kit의 `make lint-ts`(copy된 `.oxlintrc.json`의 oxlint, knip, API Extractor)와 `packages/generator-svelte`의 Svelte lint를 실행합니다. 그 workspace만 자기 component를 위해 eslint-plugin-svelte와 typescript-eslint를 쓰는 ESLint를 유지합니다. 루트 `eslint.config.mjs`, 루트와 다른 workspace의 ESLint package와 `lint` script를 지웠고, 규칙 `crudui/no-await-after-test-registration`도 지웠습니다. kit은 top-level `await` 뒤에 등록한 test를 버리던 `--test-force-exit` 없이 node:test를 실행합니다.
- `tests/build/lint-coverage.test.mjs`는 `make lint`가 두 lint를 실행하고 각각이 심어 둔 위반에서 실패하기를 요구합니다.

### 2026-10-14 — package @polyspec/kit의 공유 도구 (C14.3)

- 공유 도구는 package `@polyspec/kit`이며, `make install-tools TOOLS=npm`과 `make install-packages`가 다른 어떤 target보다 먼저 설치합니다. vendor된 `scripts/kit`, `tests/kit`, `kit.json`, `.kit/kit.lock.json`은 지웠습니다. Makefile은 copy `scripts/kit/kit-bootstrap.mk`를 include하고 모든 kit 도구를 `$(KIT)/<tool>.mjs`로 실행합니다. `make check`는 kit의 검사(`CHECK_TARGETS`)를 full run의 guard로 실행하고, 모든 workflow job은 `packageManager`의 npm과 package를 먼저 설치합니다. code는 `@polyspec/kit/<module>`을 import하고 자기 root를 스스로 정하며, kit 동작의 test는 kit에 있습니다.
- `make kit-sync`는 `kit.copies`의 copy(bootstrap, release workflow, `PRINCIPLES.md`, `config/layout.kit.yml`, lint 설정)를 씁니다. `config/layout.yml`은 crudui의 layout map을 담고, `config/toolchain.json`은 uv와 Python, alint, ruff, vulture, golangci-lint, deadcode, digest를 가진 Composer를 선언합니다.
- 하한은 kit의 pin입니다. Node.js 26.11.1, Composer platform 8.5.0과 PHP `>=8.5`, Python `>=3.14`, `toolchain` 줄 없는 Go 1.27.2, Rust 1.99.0, TypeScript 7.0.2이며, `packages/generator-svelte`는 선언된 exception으로 TypeScript 6.0.3을 유지합니다. CI matrix는 PHP 8.5와 Python 3.14로 실행합니다. Go module은 `replace` 대신 루트 `go.work`로 서로를 찾고, `.npmrc`는 `strict-allow-scripts`를 설정합니다.

### 2026-10-12 — 각 생태계의 표준 도구를 있는 그대로 사용한다 (C15.1)

- `AGENTS.md`와 `AGENTS.ko.md`는 기존 외부 도구나 라이브러리를 다시 만들지 않고 있는 그대로 사용한다고 적는다. Python interpreter, environment, lock에는 uv를, PHP 의존성에는 Composer를 쓰며, 그 도구가 만드는 symbolic link는 받아들인다. 경로 규칙은 이 저장소가 만드는 것에 적용되고, 경로의 선언적 해석과 discovery 해석을 함께 적는다. `make documents-check`가 exit 0이다.

### 2026-10-09 — release pin script의 owner (C13.1-23-1)

- `config/owner-checks.json`은 `scripts/release-pins.mjs`를 대상 `release-pins`와 test `tests/build/python-git-pins.test.mjs`로 적는다. `make owner-validate`가 exit 0이다. 이 검사는 C13.1-23에서 owner 없이 더해졌다.

### 2026-10-09 — 의존성이 최신 stable release이고 install 스크립트가 정확한 version으로 승인된다 (C13.1-38)

- `package.json`은 `puppeteer` ^25.13.0, `playwright` ^1.64.0, `vite` 8.3.4를 선언하고, `allowScripts`는 `puppeteer@25.13.0`, `esbuild@0.27.7`, `esbuild@0.28.2`를 정확한 version으로 승인한다. `make dependency-policy-check`가 exit 0(예외 없는 최신 stable release 없음)이고, `tests/build/dependency-health.test.mjs`가 test `tracked npm dependency graphs approve every install script by exact version`을 포함해 통과한다.

### 2026-10-09 — npm lock이 workspace package를 release version으로 적는다 (C13.1-37)

- `package-lock.json`의 root와 workspace 항목은 `package.json`의 version(0.0.5)을 적는다. lock을 검사해 불일치가 없다. `node scripts/kit/run-tests.mjs node -- tests/build/dependency-health.test.mjs`가 exit 0으로 통과하며, test `the dependencies match their recorded review, without a registry query`를 포함한다.

### 2026-10-09 — release lock의 dependency review 기록 (C13.1-36)

- `config/dependency-review.json`은 advisory 없는 registry 의존성 87개와 lock 8개의 review를 기록한다. `make dependency-policy-check`와 `make dependency-policy-mutation-check`가 exit 0이다. review는 예외 없는 최신 stable release를 보고하지 않는다. React 예외 4개는 남고, puppeteer, playwright, vite의 상향은 main에 있다(C13.1-38).

### 2026-10-09 — 패키지 파일이 이 저장소의 release version을 적는다 (C13.1-34)

- release version은 `config/release.json`이 적은 모든 manifest와 그 lock, `packages/generator-python`의 git pin, `contracts/features.json`, `packages/php-ext`의 module version에 설정되어 있다. 이 저장소의 release는 0.0.5(74fd5956)다. version 0.0.4는 tag된 적이 없으므로 package 파일을 0.0.4로 되돌리지 않는다. `make release-pins TAG=v0.0.5`와 `make release-coverage`가 exit 0이고, `tests/build/contract-manifest.test.mjs`가 통과한다. change log의 `## 0.0.4` section은 `## 0.0.5` 아래에 남고, tag `v0.0.4`는 로컬에도 origin에도 없다.

### 2026-10-09 — CI job python이 node를 설치하고 기록된 toolchain을 검사한다 (C13.1-30)

- `.github/workflows/ci.yml`의 job `python`은 `.node-version`의 Node.js release를 설치하고, 3.14 leg에서 `make toolchain-check TOOLS="node python"`을 실행한다. `tests/build/runtime-version-policy.test.mjs`의 test `every CI job sets up the recorded toolchains and checks the tools it set up`이 exit 0으로 통과한다.

### 2026-10-09 — docstring이 Python 모듈을 dotted 이름으로 적는다 (C13.1-29)

- `packages/generator-python/scripts/generate_interface_messages.py`와 `packages/validator-python/scripts/generate_unicode_data.py`의 docstring은 Python 모듈을 `src/polyspec/crudui/...` 경로가 아닌 dotted 이름으로 적는다. `tests/build/package-names.test.mjs`가 다른 package 이름 검사와 함께 exit 0으로 통과한다.

### 2026-10-09 — make-tool-path 검사의 native 생성기 명령이 python을 포함한다 (C13.1-28)

- `make test-native`는 `tests/native-generators/run.mjs --target javascript,html,go,rust,python`을 실행하고, test `tests/build/make-tool-path.test.mjs`는 그 명령을 기대한다. `node scripts/kit/run-tests.mjs node -- tests/build/make-tool-path.test.mjs`는 `tests/build/package-names.test.mjs`, `tests/build/runtime-version-policy.test.mjs`와 함께 exit 0으로 통과한다.

### 2026-10-09 — Python 3.11이 validator와 generator 모듈을 import한다 (C13.1-27)

- `packages/validator-python/src/polyspec/crudui/validator/resolver.py`의 annotation은 `parser`에서 `Node`를 import하고, 사용 앞에서 alias `Context`를 정의한다. Python 3.11.16에서 `packages/validator-python`(23 test)과 `packages/generator-python`(11 test)의 `PYTHONPATH=src python -m unittest discover -s tests -p "test_*.py"`가 exit 0으로 통과한다.

### 2026-10-09 — Python 브랜치의 pull request가 열렸고 merge되었다 (C13.1-26)

- `gh pr list -R polyspec/crudui --state all --head feat/python-C13.1`는 pull request #1 `feat(python): Add the Python validator and generator (#C13.1)`을 상태 MERGED로 보여 준다. 이 행은 pull request가 열려 있을 것을 요구했지만 이후 merge되었으므로 열림 상태의 literal 검사는 지금 성립하지 않는다. pull request는 열린 뒤 main에 merge되었다.

### 2026-10-09 — 소비자 npm project가 release version을 적는다 (C13.1-35)

- `tests/release-install/npm/package.json`은 자신의 version 필드에 0.0.4를 적고 있었다. `make release-consumer-lock`은 commit된 그 필드를 유지하고, 의존성은 0.0.5 archive를 적고 있었다. 필드를 0.0.5로 고쳤고, `tests/build/release-fixtures.test.mjs`가 `package.json`의 version과 같기를 요구하므로 release가 이를 남겨 두면 `make test-runtimes`가 실패한다. 0.0.5 archive는 설치되고 smoke 명령을 통과한다(로컬 tag에서 `make release-consumer TAG=...`, exit 0).

### 2026-10-09 — release 단위 test를 필요한 도구가 있는 CI job에서 실행한다 (C13.1-25)

- release 단위 test는 polyspec/kit의 vendored test(`make kit-test`)다. CI job `build, lint and types`가 `test-ordered-json` 뒤에 `make kit-test`를 실행한다. test가 go, php, cargo를 부르고 그 job이 셋을 설치하기 때문이다. `make ci`의 `CI_TARGETS`도 같은 순서로 `kit-test`를 둔다. job `python`은 go, php, cargo를 설치하지 않으므로 이를 실행하지 않는다. `tests/build/ci-local.test.mjs`가 도구를 갖춘 한 job이 `make kit-test`를 실행할 것을 요구한다.

### 2026-10-09 — AGENTS의 Python git pin release 순서 (C13.1-24)

- `AGENTS.md`와 `AGENTS.ko.md`는 `packages/generator-python`의 git pin이 tag `vX.Y.Z`를 적으므로 release commit이 `main`에 있은 뒤에만 그 tag를 만들며, `make release-pins`가 pin이 tag를 적을 것을 요구한다고 적는다.

### 2026-10-09 — stale git pin가 release 검사에서 실패한다 (C13.1-23)

- `make release-pins TAG=...`(`scripts/release-pins.mjs`)는 tag와 다른 version을 적은 `pyproject.toml`의 git pin `polyspec/crudui@vX.Y.Z`에 대해 실패하며, file, pin, tag를 출력한다. `make release-versions`가 이를 먼저 실행한다. `tests/build/python-git-pins.test.mjs`가 실패하는 tag와 통과하는 tag를 확인한다.

## 0.0.5

### 2026-10-09 — 릴리스 0.0.5 (C14.2)

- `config/release.json`이 적은 모든 manifest와 그 lock, `packages/generator-python`의 git pin, `contracts/features.json`, `packages/php-ext`의 module version이 0.0.5이다. tag가 release하지 않은 앞선 version 0.0.4의 section은 아래에 남는다. `tests/release-install`의 사용자 project는 0.0.5 archive를 적고, review 기록 `config/dependency-review.json`은 0.0.5 lock으로 쓴다. `docs/operations/repository.md`는 `vX.Y.Z`를 두 Go module의 tag와 함께 push하도록 적고, Go module tag의 실행은 archive를 build하거나 설치하지 않는다.

### 2026-10-09 — 로컬 pipeline stack test가 kit의 hook module을 이름으로 쓴다 (C14.1-10)

- `examples/form-comparison/src/local-servers.test.mjs`는 `setup`과 `teardown`을 `scripts/kit/test-hooks.mjs`에서 import할 것을 요구한다. file은 C14.1-2부터 이미 그것을 import했지만 test의 pattern이 제거된 `scripts/test-progress/hooks.mjs`를 이름으로 써서 CI job `Form comparison runner regressions`가 실패했다. 그 job의 다른 부분(library와 browser 검사)은 통과했다.

### 2026-10-09 — branch push에서만 실행되는 push 검사 (C14.1-9)

- `push-gate.yml`은 branch로의 push(`branches: ['**']`)에서 시작하며 tag push에서는 시작하지 않는다. tag push는 tag가 가리키는 commit에 완료되지 않은 `push-gate` check run을 남겼다. `tests/build/ci-local.test.mjs`는 `release.yml`을 뺀 push trigger의 workflow가 모두 branch를 거르고, tag에서 시작하는 것은 `release.yml`뿐일 것을 요구한다.

### 2026-10-09 — kit v0.0.8의 policy와 도구 선택 (C14.1-8)

- `config/dependency-policy.json`은 `./` 없이 `composer.json`을 지정하고, `pythonManifests`는 `packages/validator-python`과 `packages/generator-python`의 `pyproject.toml`을 지정한다. 그 build 요구 `setuptools==84.0.0`은 최신 release이므로 review는 registry 의존성 87개와 lock 8개를 advisory 없이 기록한다. `make dependency-policy-check`와 `make dependency-policy-mutation-check`가 통과한다.
- workflow job은 `make install-tools TOOLS="npm"`로 도구를 설치하고 `make install-node-modules`는 npm만 설치하며, dependency review job은 Rust toolchain을 설치한 뒤 `npm cargoAudit`을 설치한다. 도구 설치 앞의 Rust toolchain step은 필요하지 않다.

### 2026-10-09 — polyspec/kit v0.0.8의 vendored 도구 (C14.1-7)

- vendored file은 tag `v0.0.8`의 것이다. mutation 검사는 추적되는 모든 manifest와 lock을 복사하고, policy schema는 root `composer.json`과 `pyproject.toml`을 받으며, `make install-tools TOOLS="..."`는 이름을 준 도구만 설치하고, `make documents-stamp`는 `source-sha256` marker를 쓴다.

### 2026-10-09 — kit의 owner 검사와 0.x workflow의 규칙 (C14.1-6)

- `config/owner-checks.json`은 추적되는 모든 경로의 owner를 선언하며(`make owner-validate`) vendored copy(`make kit-check`, `make kit-test`), 설정 file, `scripts/repository-files.mjs`의 owner를 둔다. 대상 `owner-check`는 `cargo-downloads-check`를 prerequisite로 가진다. `scripts/owner-check.mjs`, `scripts/owner-checks.json`, owner 검사의 test를 제거했다.
- PHP 검사는 `scripts/kit/run-tests.mjs phpunit`이 기본으로 `<cwd>/vendor`를 읽으므로, Composer script와 make 대상의 `COMPOSER_VENDOR_DIR=../../vendor`로 root `vendor/`의 PHPUnit을 실행한다. `composer.lock`은 바뀐 `packages/validator-php`의 script를 기록한다.
- `AGENTS.md`와 `AGENTS.ko.md`는 `main`을 checklist의 모든 row가 `[o]`일 때 한 번 push하고, tag는 commit에서 CI check `ci-passed`가 성공한 뒤에 만들며, 공유 도구는 polyspec/kit의 vendored copy로 polyspec/kit에서만 바뀌고, 이 저장소는 다른 저장소와 `config/*.json`에서만 다르다고 적는다. pull request, merge queue, ruleset의 규칙을 뺐다.

### 2026-10-09 — release 도구와 0.x workflow (C14.1-5)

- `config/release.json`은 release의 archive 9개(`<package>-npm-<version>.tgz`인 npm package 7개, `<package>-php-<version>.zip`인 Composer package 2개), tag가 덮는 manifest, Go module `packages/generator-go`와 `packages/validator-go`, 사용자 project `tests/release-install/npm`과 `tests/release-install/composer`, crate 2개와 Python package 2개를 tag에서 설치하는 것을 선언한다. `make release-assets`는 package를 먼저 build하고, `release.yml`은 archive와 release 사이에서 `make release-consumer`를 실행한다. `scripts/release.mjs`, `scripts/release-install.mjs`와 그 test를 제거했고, `tests/build/python-git-pins.test.mjs`는 `pyproject.toml`에서 이 저장소를 가리키는 모든 git pin이 `package.json`의 version을 적을 것을 요구한다. 사용자 project `tests/release-install/npm`과 `tests/release-install/composer`는 0.0.4 archive를 kit의 형태로 적는다(`artifact` repository `artifacts`, language가 붙은 archive 이름, zip hash를 lock하지 않도록 smoke package가 된 `polyspec/crudui-validator`). `release-assets`, `release-consumer-lock`, `release-consumer`가 이 저장소에 없는 로컬 tag를 가진 scratch clone에서 이를 쓰고 검사했다.
- version이 0.x인 동안 저장소에는 pull request, merge queue, ruleset이 없다. `ci.yml`은 `main`으로의 push와 수동 실행에서 실행되며 앞선 commit의 실행을 취소하지 않고, `push-gate.yml`은 모든 push에서 실행된다. `.github/repository.json`, `scripts/github-repository.mjs`, `tests/build/github-repository.test.mjs`를 제거했다. `docs/operations/repository.md`는 `main`의 push, workflow, release를 설명한다.
- tag가 생기기 전에 `HEAD`의 archive를 설치하던 CI 대상 `release-install-head`를 제거했다. `scripts/kit/release.mjs assets`는 이미 있는 tag의 archive만 build하고, `make release-consumer`는 release가 만들어지기 전에 release workflow에서 실행된다.

### 2026-10-09 — kit의 document 검사와 commit message 규칙 (C14.1-4)

- `config/documents.json`은 저장소의 Markdown 문서(75쌍), `docs/features.md`의 상태 table, `CHANGELOG.md`를 선택하고, `config/commits.json`은 type, subject 50자, body 한 줄 72자를 선언한다. 각 영어 문서와 한국어 twin은 marker `<!-- doc-id: <영어 file의 경로> -->`를 가지고, 한국어 twin은 `<!-- source-sha256: <영어 file의 sha256> -->`를 가지며, 생성되는 기능 계약 page의 marker는 `scripts/generate-feature-contract-docs.mjs`가 쓴다. `scripts/check-documents.mjs`, `scripts/checklist-markers.mjs`와 그 test를 제거했다.
- 검사가 영어 문서와 한국어 문서의 차이 네 곳을 찾았고 바로잡았다. `examples/cross-check-console/README.md`의 code block이 framework 3개와 옛 README link를 적고 있었고, 한국어 release 명령이 `<main의 commit>`이었으며, `docs/spec/form-markup.ko.md`의 link 글이 줄바꿈으로 끊겼고, `tests/build/README`가 없는 제목 두 곳을 link했다.

### 2026-10-09 — kit의 push 검사, 전체 실행, CI 보고 도구 (C14.1-3)

- `config/checklist.json`은 `docs/plans/execution-checklist.md`와 그 한국어 twin, hook `pre-push`를 선언한다. `.githooks/pre-push`는 `make hooks`가 쓰는 hook(`scripts/kit/git-hooks.mjs`)이며 `scripts/kit/push-gate.mjs`를 실행한다. `make ci`는 이전 실행의 적합성 증거를 지우는 `conformance-reset`과 `CI_TARGETS`의 make 대상을 가지고 `scripts/kit/full-run.mjs`를 시작하며, 전체 실행은 더 이상 commit의 새 clone에서 실행되지 않는다.
- `scripts/package-dist.mjs`와 form comparison의 record server는 `var/locks`의 lock을 `scripts/kit/holder-lock.mjs`에서 가져온다. 그 명령은 `run`과 `clear`이며, user account의 lock(`userLockFile`)은 제거했다. `scripts/push-gate.mjs`, `scripts/full-run.mjs`, `scripts/holder-lock.mjs`, `scripts/ci-targets.mjs`, `scripts/ci-passed.mjs`, `scripts/target-report.mjs`와 그 test를 제거했다.

### 2026-10-09 — kit의 toolchain, 의존성, test runner 도구 (C14.1-2)

- `config/toolchain.json`은 `scripts/kit/schema/toolchain.schema.json`을 따른다. `make install-tools`가 npm, Go, cargo-audit을 `var/tools`에 설치하고, Makefile은 `var/tools/bin`을 `PATH`의 맨 앞에 둔다. `scripts/install-npm.mjs`, `scripts/checkout-npm.mjs`, `scripts/check-toolchain.mjs`, `scripts/check-cargo-downloads.mjs`, `scripts/install-cargo-audit.mjs`를 제거했다.
- `config/dependency-policy.json`은 kit 형태를 따른다. `composerPlatforms`는 PHP `8.4.1`(잠긴 PHPUnit 13.4.1이 지원하는 가장 낮은 PHP release이며 `composer.json`의 `config.platform.php`와 `composer.lock`의 `platform-overrides`가 이를 기록한다)과 `./composer.json`을 지정하고, `taggedNpmPackages`는 OrderedJSON tag `v0.0.3`을 지정하며, React 예외 4개는 reason과 removal condition을 유지한다. `make dependency-review RECORD=1`이 npm, Composer, Cargo lock의 `config/dependency-review.json`을 썼다. registry 의존성 85개와 lock 8개이며 advisory는 없고 version은 이전과 같다. Go module 6개는 `replace`로 checkout의 module만 요구하므로 Go 의존성을 더하지 않는다. `scripts/dependency-state.mjs`, `scripts/dependency-review.mjs`, `scripts/check-dependencies.mjs`를 제거했다.
- `scripts/kit/run-tests.mjs`와 `scripts/kit/test-progress.mjs`가 `scripts/run-tests.mjs`와 `scripts/test-progress`를 대체한다. `tests/conformance/run-suite.mjs`는 `scripts/check-conformance.mjs`의 suite를 위해 runner를 시작하고 그 실행 기록을 남긴다. ESLint와 저장소 규칙은 vendored copy를 읽지 않는다(`scripts/repository-files.mjs`).

### 2026-10-09 — polyspec/kit v0.0.4의 vendored 도구 (C14.1-1)

- `kit.json`, `.kit/kit.lock.json`, `scripts/kit`, `tests/kit`가 tag `v0.0.4`의 파일을 담고, Makefile은 `scripts/kit/kit.mk`를 include한다. `make kit-sync KIT_TAG=v0.0.4`는 lock을 쓰고 두 번째 실행에서 `unchanged`를 출력했으며, `make kit-test`는 322개 test 중 322개가 통과했다.

- C13.1-38: 의존성이 최신 stable release(puppeteer 25.13.0, playwright 1.64.0, vite 8.3.4)이고, install 스크립트는 정확한 version으로 승인되었으며, 리뷰 기록을 다시 썼습니다.
- C13.1-37: npm lock이 저장소 패키지를 dependency 항목에서도 0.0.4로 기록합니다. version bump가 요구하는 대로입니다.

### 2026-10-09 — 0.0.4 lock의 dependency review 기록 (C13.1-36)

- `config/dependency-review.json`이 version bump로 바뀐 lock 8개의 sha256을 advisory 없이 기록한다. review는 exception이 없는 newer stable release 4개(`puppeteer`, `playwright`, `vite`)를 보고하며, 이들은 별도 변경에서 올린다.

### 2026-10-09 — 0.0.4 consumer fixture lock (C13.1-35)

- `tests/release-install`의 `package.json`, `package-lock.json`, `composer.json`과 `composer.lock`이 0.0.4 archive를 가리킨다. `make release-install-lock`이 `make release-assets TAG=v0.0.4 RELEASE_COMMIT=HEAD`의 archive에서 이 파일들을 썼으므로, consumer 설치 검사가 `package.json` version의 archive를 읽는다.

## 0.0.4

### 2026-10-09 — 릴리스 버전 검사의 오래된 git pin (C13.1-23)

- `scripts/release.mjs`는 git pin `polyspec/crudui@vX.Y.Z`가 릴리스 버전이 아닌 version을 가리키는 `pyproject.toml`을 거부한다. 문제는 파일, pin과 tag를 알리므로 Python package 릴리스의 tag가 만들어지기 전에 `make release-versions`가 실패한다.

### 2026-10-08 — conformance check의 partial 런타임 증거 (C13.1-32)

- `scripts/check-conformance.mjs`는 `partial` 런타임이 기록한 사례를 받아들인다. 기록된 사례마다 통과해야 하고 요구되는 사례는 없다. Fixture 밖의 사례는 여전히 보고한다. CI job `conformance evidence against the standard`는 `createForm`의 Python 증거를 더 이상 거부하지 않는다.

### 2026-10-08 — evidence 검사의 Python conformance suite (C13.1-31)

- `scripts/check-conformance.mjs`는 `tests/conformance/runner.py`로 실행되고 런타임 `python`을 증명하는 suite `validator Python`과 `generator Python`을 선언한다. Test `every runtime that a feature supports is proven by a declared suite`가 통과한다.

### 2026-10-08 — Python suite 실행 기록의 runner 종료 상태 (C13.1-33)

- `tests/conformance/runner.py`는 test directory 하나의 unittest suite를 실행하고, program이 `tests/conformance/runner.py`이며 suite의 종료 상태를 담은 실행 기록을 쓴다. make target `test-validator-python`과 `test-generator-python`이 이 runner를 실행하므로 각 Python suite의 실행 기록은 더 이상 `did not finish`로 남지 않는다.
- `tests/conformance/runs.py`는 실행의 program, tool, directory와 인자를 호출자에게서 받고, `tests/conformance/evidence.py`는 import할 때 실행을 기록하지 않는다.

### 2026-10-08 — 버전 bump pull request로 옮긴 오래된 pin 검사 (C13.1-23)

- `pyproject.toml`의 오래된 git pin을 검사하는 release 검사를 `feat/python-C13.1`에 추가하지 않는다. `packages/generator-python`의 pin `v0.0.4`가 가리키는 tag는 version bump pull request가 merge된 뒤에 만들어지므로, 검사는 그 pull request에 속한다. 행 C13.1-23은 열린 상태로 그 pull request를 기다린다.

### 2026-10-08 — python CI job의 Node.js 설정과 Python matrix (C13.1-30)

- CI job `python`은 `.node-version`의 Node.js release를 설정하고, `make ci-targets` 실행에 Node.js가 필요하므로 `make toolchain-check`로 `node python`을 검사한다. Toolchain policy test는 기록된 minor와 함께 `requires-python`의 가장 낮은 minor(3.11)를 matrix leg로 허용한다.

### 2026-10-08 — Python generator 스크립트 docstring의 module 이름 (C13.1-29)

- `packages/generator-python/scripts/generate_interface_messages.py`와 `packages/validator-python/scripts/generate_unicode_data.py`의 docstring은 module을 dotted 이름으로 적으므로, CI job `build, lint and types`에서 package 이름 규칙이 통과한다.

### 2026-10-08 — make-tool-path 테스트의 native 명령 Python target (C13.1-28)

- `tests/build/make-tool-path.test.mjs`는 `make test-native`가 실행하는 target 목록 `javascript,html,go,rust,python`을 기대하므로, CI job `build, lint and types`에서 테스트가 통과한다.

### 2026-10-08 — Python 3.11에서 validator resolver의 import (C13.1-27)

- `packages/validator-python/src/polyspec/crudui/validator/resolver.py`는 별칭 `Node`를 `parser`에서 import하고, 별칭 `Context`를 이를 이름으로 쓰는 타입 주석 위에서 정의하여 Python 3.11이 module을 import한다. CI job `python`은 3.11에서 `NameError: name 'Node' is not defined`로 실패했다. Validator와 generator suite는 Python 3.11에서 통과한다.

### 2026-10-08 — validator와 generator의 Python 구현 (C13.1)

- `polyspec-crudui-validator`와 `polyspec-crudui-generator`를 다른 언어 구현과 같은 자격으로 Python에 구현한다. 공통 fixture는 증거를 남기며 Python 단위 test에서 실행되고, 기능 계약은 Python 지원을 적고, CI 워크플로의 `python` job이 Python suite를 실행하며, 두 package는 `mypy --strict`를 통과한다.

### 2026-10-08 — C13.1-11의 완료 표기 복구 (C13.1-22)

- 두 체크리스트에서 C13.1-11의 상태 칸이 완료 표기를 담고, `scripts/check-documents.mjs`가 통과한다(종료 코드 0).

### 2026-10-08 — Python package의 타입 주석 (C13.1-17)

- `packages/validator-python`과 `packages/generator-python`의 모든 공개 정의에 매개변수와 반환 타입이 있다. 두 package의 공개 정의 중 주석이 없는 것의 AST 개수는 0이며, 두 package 모두 `mypy --strict`가 종료 코드 0으로 통과한다.

### 2026-10-08 — generator 패키지 초기화 module의 타입 주석과 두 package의 strict 검사 (C13.1-17-11)

- `Generator` 연산과 그 도우미에 매개변수와 반환 타입이 있다. `mypy --strict`가 `packages/validator-python/src`(파일 15개)와 `packages/generator-python/src`(파일 21개) 모두에서 종료 코드 0이다. validator suite는 test 23개, generator suite는 test 11개가 통과한다.

### 2026-10-08 — form module의 타입 주석 (C13.1-17-10)

- `packages/generator-python`의 module `form`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. generator 단위 test 11개가 통과하고, native Python 검사는 종료 코드 0이다.

### 2026-10-08 — binding module의 타입 주석 (C13.1-17-9)

- `packages/generator-python`의 module `binding`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. generator 단위 test 11개가 통과하고, native Python 검사는 종료 코드 0이다.

### 2026-10-08 — details와 form render module의 타입 주석 (C13.1-17-8)

- `packages/generator-python`의 module `details`, `form_render`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. generator 단위 test 11개가 통과하고, native Python 검사는 종료 코드 0이다.

### 2026-10-08 — lists module의 타입 주석 (C13.1-17-7)

- `packages/generator-python`의 module `lists`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. generator 단위 test 11개가 통과하고, native Python 검사 741건이 통과한다(종료 코드 0).

### 2026-10-08 — widget module의 타입 주석 (C13.1-17-6)

- `packages/generator-python`의 module `widget`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. 문자열이 아닌 날짜·날짜시각 값은 더 이상 날짜 파서에 넘기지 않고 control의 값으로 남는다. generator 단위 test 11개가 통과한다.

### 2026-10-08 — rendering과 display declaration module의 타입 주석 (C13.1-17-5)

- `packages/generator-python`의 module `rendering`, `display_declaration`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. generator 단위 test 11개가 통과한다.

### 2026-10-08 — buttons와 choice list module의 타입 주석 (C13.1-17-4)

- `packages/generator-python`의 module `buttons`, `choice_list`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. generator 단위 test 11개가 통과한다.

### 2026-10-08 — value, design, template module의 타입 주석 (C13.1-17-3)

- `packages/generator-python`의 module `value`, `design`, `template`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. generator 단위 test 11개가 통과한다.

### 2026-10-08 — generator 기초 module의 타입 주석 (C13.1-17-2)

- `packages/generator-python`의 module `errors`, `messages`, `input_text`, `numbers`, `dates`, `style`에 매개변수와 반환 타입이 있고 `mypy --strict` 오류가 없다. generator 단위 test 11개가 통과한다.

### 2026-10-08 — validator package의 타입 주석 (C13.1-17-1)

- `packages/validator-python/src`의 모든 함수에 매개변수와 반환 타입이 있으며, package는 `mypy --strict`를 종료 코드 0으로 통과한다(source 파일 15개). validator 단위 test 23개가 통과한다. 변경은 C13.1-17 아래 커밋되어 있다.

### 2026-10-08 — 이전 세션에서 유지한 generator 동작 (C13.1-21)

- generator module `binding`, `lists`, `value`, `widget`, `__init__`, `dates`, `style`은 이전 세션이 커밋하지 않은 동작을 타입 주석과 분리해 담는다. 이 상태에서 generator 단위 test 11개가 통과하고, `node tests/native-generators/run.mjs --target python`은 741건 통과, 종료 코드 0을 보고한다.

### 2026-10-08 — CI workflow의 Python job (C13.1-7)

- CI 워크플로의 `python` job은 3.11과 기록된 release 3.14의 matrix를 가지며, `CI_COMMANDS`에 적힌 make 대상으로 validator와 generator 단위 test를 실행하고, 기록된 release의 conformance 증거를 보존하며, `conformance`와 `ci-passed`가 필요로 한다. CI 명령 매핑 test가 15개 통과한다(종료 코드 0). job 자체는 push 후 CI에서 실행된다.

### 2026-10-08 — Python 대상을 포함한 native 명령의 CI 매핑 test (C13.1-7-3)

- CI 매핑 test는 Python 대상을 포함한 `make test-native-generators`의 native generator 명령을 고정한다. `tests/build/ci-local.test.mjs`가 test 15개를 통과한다(종료 코드 0).

### 2026-10-08 — 패키지의 Python 버전과 기능 지원 (C13.1-6)

- `.python-version`은 Python 3.14를 이르고, 기록된 toolchain도 같은 release를 적는다. CI 워크플로는 Python job에서 3.14를 설정하며, owner 검사는 `.python-version`과 Python package 경로를 짝짓고, 기능 계약은 기능마다 Python 지원을 적는다(C13.1-6-1). `make toolchain-check TOOLS=python` 종료 코드 0, `make test-ordered-json` 종료 코드 0, `tests/build/contract-manifest.test.mjs` 12건 통과. `tests/build/runtime-version-policy.test.mjs`는 이 환경에서 npm 버전(`make install-npm`이 기록된 release를 설치한다)과 PATH의 Rust toolchain으로 실패하며, Python 버전 때문이 아니다.

### 2026-10-08 — 기능 계약의 Python 지원 (C13.1-6-1)

- 기능 계약은 기록된 증거로 각 기능의 Python 지원을 적는다. 기능 12개는 `pass`다(JSON fixture의 모든 사례에 통과한 Python 기록이 있으며 불일치 0건). `createForm`은 `partial`, outline과 session 기능 4개는 `unsupported`, 클라이언트 전용 기능 4개는 해당 없음이다. 기능 문서와 README 짝은 Python package를 적으며, `scripts/check-documents.mjs`가 통과한다(종료 코드 0).

### 2026-10-08 — 기록 본문에서 상태 표기를 뺀다 (C13.1-20)

- C13.1-10과 C13.1-11의 기록은 상태 표기를 단어로 쓴다. `scripts/check-documents.mjs`가 문서 쌍 53개를 통과한다(종료 코드 0).

### 2026-10-08 — native generator 검사의 Python 프로그램 (C13.1-7-2)

- native generator 검사가 Python 프로그램을 실행한다. `node tests/native-generators/run.mjs --target python`은 741건 통과, 종료 코드 0을 보고한다. `make test-native-generators`에는 python 대상이 포함되며, 이 환경에서는 검사를 실행하기 전 cargo 사전 검사에서 멈춘다.

### 2026-10-08 — Form.setData가 객체가 아닌 데이터를 거부한다 (C13.1-19)

- `Form.setData`는 객체가 아닌 데이터에 대해 `INVALID_FORM_INPUT`과 `Form data must be an object`로 실패한다. Python 대상의 native generator 검사가 통과한다: 741건 통과, 종료 코드 0, `action-failure-keeps-state` 포함.

### 2026-10-08 — Python 단위 test의 conformance 증거 (C13.1-7-1)

- Python 단위 test는 실행하는 공통 사례마다 conformance 증거를 기록한다. 기록은 1637건이고 실패한 기록은 없다. CRUDUI_CONFORMANCE_EVIDENCE가 디렉터리를 가리킬 때만 기록한다.

### 2026-10-08 — cross-check console의 Python validator (C13.1-5)

- cross-check console은 Python validator 프로세스를 JavaScript, PHP, Go, Rust 프로세스와 함께 실행하며, 요청 비교는 다섯 프로세스의 일치를 요구한다. 서버 test 스위트가 1267개 test로 통과한다(종료 코드 0).

### 2026-10-08 — 기록이 커밋을 체크리스트 id로 가리킨다 (C13.1-18)

- C13.1-1, C13.1-2, C13.1-3, C13.1-4, C13.1-10, C13.1-11의 기록은 각 커밋을 구현하는 과제의 체크리스트 id로 가리킨다.

### 2026-10-08 — PHP 실행 파일의 아키텍처로 빌드하는 PHP 확장 (C13.1-16)

- PHP 확장 빌더는 PHP 실행 파일의 아키텍처를 `lipo -archs`로 읽어 컴파일과 링크
  명령에 `-arch`로 넘긴다. 링크된 module의 아키텍처가 다르면 빌더가 실패한다.
  Red: 아키텍처 단위 test가 없는 export로 실패했다. Green: 아키텍처 단위 test가
  통과하고(`tests/build/php-extensions.test.mjs` 5개), `make build-php-extension`이
  로드되는 arm64 module을 만들며, cross-check vitest가 1267개 test로 통과한다(`php-native`
  프로세스 포함).

### 2026-10-08 — Python의 form-outline fixture 범위 (C13.1-15)

- C13.1 행은 `tests/fixtures/form-outline`을 Python validator와 generator의 범위 밖이라고
  선언한다. C13.1의 기준 제품은 이를 읽지 않는다.

### 2026-10-08 — 웨이브 계획의 Python 버전 파일 (C13.1-14)

- 웨이브 계획은 `.python-version`이 C13.1-6이 완료될 때까지 없다고 적는다.

### 2026-10-08 — 체크리스트의 validator test 파일 수 (C13.1-13)

- C13.1-2 행은 패턴 `test_*.py`로 `discover`가 고르는 validator test 파일 다섯 개를 센다.

### 2026-10-08 — 공통 camelCase 표면의 validator 공개 이름 (C13.1-12)

- `polyspec.crudui.validator`는 `validate_list`, `validate_detail`, `hidden_paths` 대신
  공통 표면의 이름인 `validateList`, `validateDetail`, `hiddenPaths`를 내보낸다.
  validator 단위 test 23개가 통과한다.

### 2026-10-08 — 커밋된 Python 이력의 기록 사실 (C13.1-11)

- C13.1-1, C13.1-3, C13.1-4 행은 C13.1-1부터 C13.1-4까지 `[o]` 이전에 `[~]` 줄을
  추가한 커밋이 없다는 사실, 커밋 the C13.1-1 fix commit, the C13.1-3 package commit, the C13.1-4 test commit의 committer,
  수정 전의 이름을 설명하는 the C13.1-1 fix commit의 본문을 기록한다.

### 2026-10-08 — 커밋된 Python tree의 import 원인 기록 (C13.1-10)

- C13.1-2와 C13.1-4 행은 `packages/validator-python`과 `packages/generator-python`의
  test 디렉터리를 그 검증 커밋이 추가했다고 기록한다. 그 커밋 이전에는 디렉터리가
  없어, discover 명령이 `ImportError: Start directory is not importable`을 낸다.

### 2026-10-08 — Python generator의 의존성 (C13.1-9)

- `packages/generator-python`은 `polyspec-ordered-json`을 선언하지 않는다. 어떤
  generator module도 그것을 import하지 않는다. generator가 실행 시
  `polyspec.crudui.validator`를 import하므로 `polyspec-crudui-validator`를 이
  저장소의 `packages/validator-python`의 tag URL `v0.0.4`로 선언한다.

### 2026-10-08 — 검토에서 찾은 Python 생성기 결함 (C13.1-8)

- `Form`은 결측 반복 데이터의 초기 행 하나를 무작위 행 키 대신 `bindForm`과
  `empty-collections` 계약이 정한 키 `__0000000000000__`로 바인딩한다. Red: 사례
  `multiple-leaf-empty-placeholder`가 키 `__0a592ccb0f808__`로 실패했다. Green:
  form-render test가 137개 결과 사례를 `createForm`과 `renderForm`으로 통과한다.
- text-validity test는 생성 실패의 `at` 값을 `FormError.path`로 읽는다.
- conformance 정규화기에 양쪽 분기가 같은 분기가 없다.
- `packages/generator-python` 단위 test 11개가 통과한다.

### 2026-10-08 — 공통 fixture 위의 Python 생성기 (C13.1-4)

- `packages/generator-python`의 단위 test가 공통 fixture를 읽어 모든 사례를
  기록된 기대와 비교한다. `form-render`(188: 정규화 tree로 비교한 137개 결과와
  51개 실패), `list-render`(157), `detail-render`(62), `form-complete`(28),
  그리고 `text-validity`의 `compileForm`(7), `bindForm`(9), `createForm`(15),
  `buildList`(11), `buildDetail`(6) 파일.

### 2026-10-08 — Python 생성기 package (C13.1-3)

- `packages/generator-python`은 Python 3.11 이상에서
  `polyspec-crudui-validator` 위에 namespace package
  `polyspec.crudui.generator`로 `polyspec-crudui-generator`를 내놓는다.
  template compile, 필드 묶기, button, row 연산을 가진 form instance,
  list·detail model, widget·style·렌더링 내부, 값 helper로 이루어진다.
  `Generator`는 `compileForm`, `bindForm`, `bindButtons`, `formButtonsHtml`,
  `createForm`, `renderForm`, `renderList`, `buildList`, `renderDetail`,
  `buildDetail`, `sequenceRowKey`, `createRowKey`를 `Form`과 `FormError`와
  함께 내놓는다.
- 검증기 text module에 메시지를 반환하는 `specificationFailure`,
  `inputFailure`, `optionEntries` helper가 더해지며, 생성기는 이를 code
  `INVALID_FORM_INPUT`의 `FormError`로 감싼다.

### 2026-10-08 — 공통 fixture 위의 Python 검증기 (C13.1-2)

- `packages/validator-python`의 단위 test가 공통 fixture를 읽어 기록된 모든 사례를
  재현한다. `validate`(309: 178개 결과와 `code`·`message`·`at`를 가진 131개 실패),
  `expr`(54), `compose`(20), `spec-validity`(34), `list-validity`(20),
  `detail-validity`(13), 그리고 `text-validity`의 `validate`·`validateList`·
  `validateDetail` 파일과 공유·자기참조 container로 만든 12개 값 graph.

### 2026-10-08 — Python 검증기 package (C13.1-1)

- `packages/validator-python`은 Python 3.11 이상에서 표준 라이브러리만으로
  `polyspec-crudui-validator`를 namespace package `polyspec.crudui.validator`로 내놓는다.
  composition 엔진, 금지 key 검사, 입력 text·값 한도 검사, contract의 Unicode 16.0.0
  데이터 위의 pattern 언어 recognizer와 matcher, 조건 parser, 경로 resolver, ECMAScript
  숫자 text를 가진 값 정의, 24개 검증 rule, 필드 순회로 이루어진다.
- `validate`, `hiddenPaths`, `validateList`, `validateDetail`이 공통 결과를 내놓고
  `ComposeLoadError`와 `FormInputError`가 다른 구현과 같은 실패 code와 trace를 실었다.

### 2026-10-07 — form comparison 실행의 system port (C11.6-5)

- `make test-form-comparison-browser`와 `make test-form-comparison-summary`는 모든 서버를 system이 정한 port에서
  시작하므로 동시에 실행해도 충돌하지 않는다. `FORM_ADDRESS`와 `local-verification.mjs`의 `--address`는 제거되었다.
- 브라우저 요약은 모든 보고서에 port를 뺀 자기 origin의 scheme과 host, 그리고 같은 트리의 소스 식별자를 요구한다.

### 2026-10-07 — Go module tag의 archive 설치 검사 (C11.6-4)

- `make release-install-check`는 release의 tag를 받는다. archive를 release하지 않는 Go module tag
  `<directory>/vX.Y.Z`이면 그 tag를 밝히고 아무것도 설치하지 않으며, tag `vX.Y.Z`이면 그 tag의 archive를 설치한다.

## 0.0.3

### 2026-10-07 — 폼 서버마다 자기 CI 작업에서 실행하는 브라우저 검사 (C11.6-3)

- CI 작업 `form-comparison-browser`는 폼 비교의 브라우저 검사를 서버(`php`, `php-ext`, `go`, `rust`)마다 작업
  하나에서 `make test-form-comparison-browser`로 실행합니다. 각 작업은 runner를 혼자 쓰고 그 서버의 보고서를
  올립니다.
- CI 작업 `form-comparison-checks`는 그 뒤에 `make test-form-comparison-summary`로 PHP 처리 모드, 생성, 저장, 정본
  흐름, 보고서 네 개의 브라우저 집계, 입력, 근거를 각각 한 번 실행합니다. `local-verification.mjs`는
  `--servers`, `--browser-reports`, `--address`를 받습니다. 검사, 보고서, 한도는 바뀌지 않으며
  `make test-form-comparison-checks`는 여전히 모든 검사를 한 실행에서 실행합니다.

### 2026-10-07 — release된 tag v0.0.3의 OrderedJSON (C11.6-2)

- 비교는 OrderedJSON을 `polyspec/ordered-json`의 tag `v0.0.3`에서 받습니다.
  `examples/form-comparison/src/ordered-json-source.mjs`의 `orderedJsonVersion`은 0.0.3이고
  `make install-ordered-json`은 `v0.0.3`을 체크아웃합니다.
- Rust record server, 그 `Cargo.lock`, `@polyspec/ordered-json`의 `package-lock.json` 항목, `tests/ordered-json`의
  processor check, 문서, `config/dependency-review.json`은 0.0.3을 적습니다.

### 2026-10-07 — CI의 release archive 설치 (C11.6-1)

- CI job `build-lint`는 `make release-install-head`을 실행합니다. `package.json` version의 `HEAD` archive를
  `make release-assets`처럼 쓰고 `scripts/release-install.mjs check`로 `tests/release-install`의 사용자 fixture에서
  설치하므로, 깨진 archive는 tag 전에 CI에서 실패합니다. release workflow는 `make release-install-check`를 유지합니다.

### 2026-10-07 — 저장소 밖에서 설치되는 게시 manifest (C11.5)

- 게시되는 manifest는 `packages/`의 package manifest이며 바꾸지 않고 pack합니다. scope `@polyspec`와 vendor `polyspec`의
  의존성은 모두 정확한 version이고, `packages/generator-php/composer.json`과 `packages/validator-php/composer.json`은
  `version`을 선언하며 `repositories`는 없습니다.
- 개발 해석은 root `composer.json`(`polyspec/crudui-workspace`, 게시하지 않음)에 있습니다. `packages/validator-php`의
  `path` repository, `autoload`로 읽는 생성기 source, root의 `composer.lock`과 `vendor/`가 있으며 PHPUnit, PHP check,
  PHP server가 그것을 load합니다. `scripts/php-package-autoload.php`는 test하는 package의 class를 source 디렉터리에서
  load합니다.
- `make release-assets`는 package manifest와 다르거나, 그런 의존성을 URL, 경로, git 출처, 범위, 개발 version으로 적거나,
  `repositories`가 있거나 `version`이 없는 `composer.json`인 pack된 manifest를 하나씩 적어 실패하고,
  `tests/build/release.test.mjs`는 저장소의 게시되는 manifest에 같은 check를 적용합니다.
- release를 만들기 전 release workflow의 step인 `make release-install-check`는 저장소 밖 임시 디렉터리에서
  `tests/release-install`의 사용자 fixture로 archive를 설치합니다. 빈 cache와 닿지 않는 registry의 scope `@polyspec`로
  `npm ci`를, 빈 `COMPOSER_HOME`과 `COMPOSER_CACHE_DIR`로 `artifact` repository에서 `composer install`을 실행합니다.
  `make release-install-lock`은 archive에서 fixture lock을 다시 만듭니다.
- `docs/operations/repository.ko.md`는 npm과 Composer로 release archive를 설치하는 방법과 개발 해석을 적습니다.

## 0.0.2

### 2026-10-07 — release된 tag v0.0.2의 OrderedJSON (C11.4-2)

- 비교는 OrderedJSON을 GitHub Release가 있는 `polyspec/ordered-json`의 tag `v0.0.2`에서 받습니다.
  `examples/form-comparison/src/ordered-json-source.mjs`의 `orderedJsonVersion`은 0.0.2이고
  `make install-ordered-json`은 `v0.0.2`를 체크아웃합니다.
- Rust record server, 그 `Cargo.lock`, `@polyspec/ordered-json`의 `package-lock.json` 항목,
  `tests/ordered-json`의 processor 검사, 문서와 `config/dependency-review.json`은 0.0.2를 적습니다.

### 2026-10-07 — 0.0.2 lock의 dependency review (C11.4-1)

- `config/dependency-review.json`은 repository package의 0.0.2 항목을 가진 lock 9개의 review를 기록하며,
  `make dependency-review RECORD=1`이 썼습니다. 예외 없는 더 새 stable release와 advisory는 없고,
  `make test-dependencies`가 checkout을 이 기록과 비교합니다.

### 2026-10-07 — GitHub 본문 한도 안의 release notes (C11.3)

- `make release-publish`는 `CHANGELOG.md`의 section `## X.Y.Z`가 GitHub release 본문 한도인 125000자 이하이면
  release notes로 쓰고, 아니면 tag의 `CHANGELOG.md` section을 link하는 한 줄
  `https://github.com/polyspec/crudui/blob/<tag>/CHANGELOG.md#<점을 뺀 version>`을 씁니다.
- `tests/build/release.test.mjs`는 정확히 125000자인 section을 그대로, 더 긴 section을 한 줄로 쓰도록
  `vX.Y.Z` tag와 Go module tag에 대해 요구합니다.

## 0.0.1

### 2026-10-07 — native suite의 컨테이너 정의 제거 (C7.20-3)

- `tests/containers/native.Containerfile`, `.dockerignore`, native generator의 Apple container 절차, package build
  명세의 container build 규칙을 제거했습니다. CI job `php-engine`, `native-generators`, `php-api`가 native suite를
  Linux runner에서 실행합니다.
- `tests/build/runtime-version-policy.test.mjs`는 tracked 컨테이너 정의가 있으면 실패하고,
  `tests/docs/repository-writing.test.mjs`의 case는 checklist와 change log가 아닌 문서의 code가 macOS의 container
  container CLI를 실행하면 실패합니다.

### 2026-10-07 — CI runner의 Linux 스타일 검사 (C7.20-2)

- `make test-form-styles-linux`, `make remove-form-styles-image`, `scripts/test-form-styles-linux.sh`를 제거했습니다.
  CI job `form-runtime`이 스타일시트 배치 검사를 Linux runner에서 고정한 Chromium, Firefox, WebKit build로
  실행합니다.
- `tests/docs/repository-writing.test.mjs`의 case는 tracked tool, Makefile 줄, workflow가 macOS의 container CLI,
  다른 container CLI를 호출하면 실패합니다.

### 2026-10-07 — CI에서 로컬 구성에 대해 실행하는 폼 비교 검사 (C7.20-1)

- `make test-form-comparison-checks`(`examples/form-comparison/local-verification.mjs`)는 네이티브 레코드 서버 네 개와
  공개 서버를 시스템이 정한 127.0.0.1 port의 local process로 시작하고, 그 구성에 PHP 처리 모드, 생성·저장·정본 흐름
  검사, 서버 네 개의 브라우저 검사와 상호작용 검사, 브라우저 집계, 입력 검사를 실행합니다. 모든 보고서의 근거를
  확인한 뒤 서버를 멈춥니다. CI job `form-comparison-checks`가 이를 실행하고 `ci-passed`가 그 job을 필요로 합니다.
- `check-servers.mjs`는 `--origin`, `--data`, `--report`를 받고, 검사의 unit test가 다시 source suite에서 실행됩니다.
- 비교 프레임의 시나리오 검사 `serverInvalid`는 `enabled`가 꺼진 스토어에 대해 검증기가 숨김으로 보고하는 `detail`
  경로를 기대합니다.

### 2026-10-07 — 개발 기기의 container 도구 없는 비교 검사 (C7.20)

- `make deploy`, `make deploy-verify`, `make deploy-watch`와 이들만 쓰던 code를 제거했습니다. 비교 서비스의
  Compose 정의, 그 supervisor와 toolchain image, source watcher, tree verification과 그것만 실행한 검사, container
  runtime 해석, build target, 그 test와 배포 운영 문서가 대상입니다. `make test-form-comparison`과
  `make test-form-comparison-pipeline`은 기준을 유지합니다. 모든 레코드 서버를 127.0.0.1의 빈 port에서 local
  process로 시작하고, 서버를 비교한 뒤 멈춥니다. 폼 비교 명세는 레코드 리소스, 정본 페이지, 정본 흐름 검사를
  유지하고, 테스트 절차가 폼 검사를 설명합니다.
- `tests/docs/repository-writing.test.mjs`의 case는 checklist와 change log가 아닌 tracked file이 개발 기기의
  container 도구를 지명하면 실패합니다.

### 2026-10-07 — package-lock.json에 따른 npm cache (C12.1-2)

- CI, Pages, release workflow에서 npm package를 설치하는 모든 job은 npm을 설치하기 전에 `actions/cache`로
  `~/.npm`을 runner system, architecture, `package-lock.json` hash의 key로 복원하고 저장합니다. `setup-node`는
  아무것도 cache하지 않습니다. 그 cache는 먼저 끝난 job의 npm 디렉터리를, npm package를 설치하지 않는 job의
  것도 저장했으므로 모든 job이 700 byte를 복원했습니다.

### 2026-10-07 — 세 CI job의 native suite (C12.1-1)

- native suite는 세 CI job에서 실행됩니다. `php-engine`은 PHP 확장의 C 엔진 test인 `make test-php-engine`을
  Node.js와 C compiler로 한 번 실행하고, `native-generators`는 Go·Rust 생성기 test, protocol·widget test,
  JavaScript·HTML·Go·Rust 대상의 공용 suite인 `make test-native-generators`와 `make test-bench`를 한 번 실행하며,
  `php-api`는 `crudui.so` build, 그 builder·API test, PHP 생성기 test, PHP·네이티브 PHP 대상의 공용 suite인
  `make test-php-api`를 PHP 8.4와 8.5에서 실행합니다. `make test-native`는 세 대상을 실행하고,
  `PHP_NATIVE_REPORT`는 PHP 대상의 보고서를 지정합니다.
- job `conformance`는 각 job의 증거 artifact를 별도 디렉터리에 내려받고, `scripts/check-conformance.mjs`는
  디렉터리와 하위 디렉터리의 증거와 실행 기록을 읽으므로 한 job의 증거 파일이 다른 job의 같은 이름 파일을
  덮어쓰지 않습니다.

### 2026-10-07 — release step, Go module tag, archive (C11.1-4)

- `.github/workflows/release.yml`은 tag `v*`와 `**/v*`에서 실행됩니다. tag filter에서 `*`는 `/`와 맞지 않으므로
  `**/v*`가 Go module tag `packages/<디렉터리>/vX.Y.Z`를 덮습니다. job은 `TAG: ${{ github.ref_name }}`을 두고
  `make release-verify`, `make release-versions`, `make release-assets`, `make release-publish`로 끝나며, 그 recipe는
  tag를 `"$$TAG"`로 넘깁니다. `make release-assets`는 `make build`를 실행하고, Go module tag는 아무것도 build하거나
  첨부하지 않습니다.
- release asset은 npm tarball과 Composer zip뿐입니다. crate는 archive로 release하지 않고 git tag로 사용합니다.
  `cargo package`는 git 의존성을 해석되지 않는 crates.io 요구로 바꾸기 때문입니다. `tests/build/release.test.mjs`는
  tag가 `packages/`의 package 파일마다 어떻게 release하는지 적습니다.

### 2026-10-07 — main tag의 GitHub Release (C11.1-3)

- `.github/workflows/release.yml`은 push된 tag `vX.Y.Z` 또는 `<디렉터리>/vX.Y.Z`에서 실행됩니다. `make release-verify`는
  commit이 `main`에 있고 그 check run `push-gate`와 `ci-passed`가 `success`로 끝났기를, `make release-versions`는 tag가
  덮는 모든 package 파일의 version이 tag와 같고 `CHANGELOG.md`에 section `## X.Y.Z`가 있기를 요구합니다.
  `make release-assets`는 `packages/`의 npm, Composer archive를 `<package>-<version>.<확장자>` 이름으로 쓰고, `make release-publish`는
  그 section을 notes로, archive를 첨부해 GitHub Release를 만듭니다. Go module tag에는 archive가 없습니다.
- AGENTS와 `docs/operations/repository.md`는 version을 올리는 pull request, maintainer가 merge된 commit에 다는 tag,
  release workflow로 이루어진 release 절차를 적습니다.

### 2026-10-07 — CI workflow의 완료 check 하나 (C11.1-2)

- `.github/workflows/ci.yml`의 마지막 job `ci-passed`는 다른 모든 job을 needs로 두고 `if: ${{ always() }}`로
  실행되며 `make ci-passed RESULTS='${{ toJSON(needs) }}'`를 실행합니다. 이 target은 needs의 모든 job 결과가
  `success`가 아니면 실패하므로 실패, 취소, 건너뜀 job이 이 check를 실패시킵니다.
- `.github/repository.json`의 ruleset `main`은 정확히 check `push-gate`와 `ci-passed`를 요구하므로, CI job을
  추가하거나 이름을 바꿔도 ruleset은 바뀌지 않습니다.

### 2026-10-07 — 다음 release의 변경을 담는 Unreleased (C11.1-1)

- `CHANGELOG.md`와 `CHANGELOG.ko.md`는 section `## Unreleased`로 시작하고, 그 section은 모든 항목을 heading
  `### <날짜> — <제목> (<작업 ID>)`으로 담습니다. X.Y.Z release는 그 section 이름을 `## X.Y.Z`로 바꾸고 그 위에
  빈 `## Unreleased`를 새로 씁니다.
- `tests/docs/changelog.test.mjs`는 첫 section `## Unreleased`, 나머지 section이 모두 `## X.Y.Z`이고 위 section보다
  오래된 것, 모든 항목이 section 안에 있는 것, 두 파일의 section과 항목이 같은 것을 요구합니다.

### 2026-10-07 — npm package마다 하나의 설치 version (C5.8-11)

- `make dependency-review UPDATE=1`은 npm 갱신 뒤에 `npm dedupe`를 실행하므로, workspace가 올린 뒤에도 한 version이
  만족하는 package는 한 version으로 설치됩니다.
- 의존성 그래프 검사는 `package-lock.json`이 두 version으로 설치하는 package 가운데 한 version이 두 사본을 읽는
  package들의 모든 범위를 만족하는 package에서 실패합니다.
- 잠금 파일은 `@sveltejs/vite-plugin-svelte`에 magic-string 1.4.3을, `@types/jsdom`에 hoist된 undici-types 8.9.0을
  설치하며 review는 잠금 파일을 기록합니다.

### 2026-10-07 — cross-check 폼 내보내기의 숨은 경로 (C8.3-6)

- cross-check console의 검증기 process는 각 validator의 `validate`가 돌려주는 대로 폼에 `{ valid, errors, hidden }`,
  목록과 상세에 `{ valid, errors }`로 응답합니다. gateway는 폼 결과의 `hidden`을 요구하고 `POST /api/validate`의 각 언어
  결과에 담아 돌려주며 언어 사이에서 순서대로 비교합니다.
- 폼 탭의 fixture 내보내기는 `expected`를 오류와 hidden path를 validator의 순서대로 담은 `{ valid, errors, hidden }`으로
  써서 내보낸 사례가 `tests/fixtures/validate/cases.json` 형태를 가집니다. `server/fixture-export.test.mjs`는 내보낸
  사례를 공용 사례와 비교합니다.

### 2026-10-07 — OrderedJSON tag의 build, encoding, 의존성 review (C10.3)

- OrderedJSON PHP module은 tag checkout의 `config.m4`가 선언한 C source로 compile되고 PHP는 그것을 `ordered_json`으로
  load합니다. 실패한 명령은 PHP가 startup 실패를 쓰는 출력을 보고합니다.
- encode한 form 문자열은 OrderedJSON `v0.0.1`이 구성한 문자열을 쓰는 대로 출력 가능한 ASCII 밖의 모든 code unit을
  `\u` escape로 씁니다.
- 의존성 검사는 `@polyspec/ordered-json`이 tag checkout에 tag의 버전으로 연결될 것을 요구합니다. 어떤 npm 매니페스트도
  URL 또는 Git 의존성을 선언하지 않고 `.npmrc`는 `allow-remote=none`과 `allow-git=none`을 선언합니다.
- js-yaml 5.4.3, vite 8.3.3, svelte 5.57.2를 사용하며 review는 모든 lock을 기록합니다.

### 2026-10-07 — 정확한 workflow trigger (C6.2-1)

- `.github/workflows/ci.yml`은 모든 pull request, merge group, 수동 실행(`workflow_dispatch`)에서,
  `.github/workflows/push-gate.yml`은 `gh-readonly-queue/**` 밖의 모든 push, pull request, merge group에서,
  `.github/workflows/pages.yml`은 `main` push와 수동 실행에서, `.github/workflows/dependency-review.yml`은 일정과 수동
  실행에서 실행되며, 다른 workflow는 없습니다.
- `tests/build/ci-local.test.mjs`는 각 workflow의 `on:` block을 정확히 요구하고 다른 workflow가 없을 것을 요구합니다.

### 2026-10-07 — tag v0.0.1의 OrderedJSON (C10.2)

- 비교는 OrderedJSON을 `polyspec/ordered-json`의 tag `v0.0.1`에서 받습니다. `make install-ordered-json`은 tag의
  commit을 체크아웃하고, 그 commit에 있고 tracked change가 없는 체크아웃은 유지하며 다른 체크아웃은 교체하고, local
  pipeline은 tag와 다른 commit의 체크아웃을 tag를 밝히며 거부합니다.
- version 0.1까지 polyspec 저장소는 다른 polyspec 저장소에 그 저장소의 GitHub tag로 의존합니다.

### 2026-10-07 — polyspec 규칙의 프로그램 이름 (C9.2)

- `examples/`, `tests/`, `tools/`의 프로그램은 package 이름 규칙을 따릅니다. cross-check console server는 npm package
  `@polyspec/crudui-cross-check-console`이고, crate와 binary는 `polyspec-crudui-cross-check-validator`,
  `polyspec-crudui-form-comparison`, `polyspec-crudui-native-generator`, `polyspec-crudui-bench`이며, Go benchmark
  driver는 module `github.com/polyspec/crudui/tools/bench/go`입니다.
- `tests/build/package-names.test.mjs`는 추적하는 모든 `package.json`, `composer.json`, `Cargo.toml`, `go.mod`에 이
  규칙을 요구합니다.

### 2026-10-06 — branch main의 OrderedJSON (C10.1)

- 비교는 OrderedJSON을 `polyspec/ordered-json`의 branch `main`에서 받습니다. `make install-ordered-json`은 그
  head를 체크아웃하고, root `package.json`은 그 체크아웃의 `@polyspec/ordered-json`을 적으며, record server는 PHP
  namespace `Polyspec\OrderedJson`, Go module `github.com/polyspec/ordered-json/go`, crate
  `polyspec-ordered-json`을 씁니다.

### 2026-10-06 — polyspec namespace의 PHP API page (C9.1-1)

- API 문서는 `Polyspec\Crudui\`의 phpDocumentor page(`classes/Polyspec-Crudui-Generator.html`과
  `Validator`, `Form`, `FormError`의 page)를 요구하므로 `make docs-check-documents`가 다시 통과합니다.
  package 이름 검사는 page 형태 `CRUDUI-`를 거부합니다.

### 2026-10-06 — polyspec 저장소의 패키지 이름 (C9.1)

- 패키지는 template과 hyper의 이름 규칙을 따릅니다. npm 패키지는 `@polyspec/crudui-*`
  (`@polyspec/crudui-validator`, `@polyspec/crudui-generator-html` 등)이고, Composer 패키지는
  `polyspec/crudui-generator`와 `polyspec/crudui-validator`이며 PHP 확장의 클래스를 포함해 PHP namespace는
  `Polyspec\Crudui\`이고, crate는 `polyspec-crudui-generator`와 `polyspec-crudui-validator`입니다. import,
  `use` 문, 의존성은 새 패키지 이름을 쓰며, 이전 이름은 남지 않습니다.

### 2026-10-06 — 검증 결과 문서의 숨은 경로 (C8.3-5)

- TypeScript, Go, Rust 검증기의 README, PHP 확장 명세, fixture 명세, 공유 검증 사례의 README는 폼 검증 결과를
  `valid`, `errors`, `hidden`으로 적습니다.

### 2026-10-06 — 188개 사례의 native 폼 fixture 목록 (C8.4-1)

- native generator suite는 `design.show`의 행 부모 사례와 literal identifier 사례를 포함한
  `tests/fixtures/form-render/cases.json`의 폼 사례 188개를 기대하고, 각 사례를 모든 native target에서 실행합니다.

### 2026-10-06 — cross-check 검증기 process의 단일 응답 (C8.3-4)

- cross-check console의 PHP 검증기 process는 다른 process와 `validators/README.md`처럼 폼에 `{ valid, errors }`를
  쓰고, input text 사례는 모든 process에서 그 응답을 기대합니다.

### 2026-10-06 — form comparison 레코드 저장의 숨은 경로 (C8.3-3)

- form comparison의 모든 record server는 저장에 검증기 결과를 `valid`, `errors`, `hidden`을 바꾸지 않은 채
  `validation`으로 응답합니다. JavaScript server는 통과한 결과를 더 이상 `{ valid: true, errors: [] }`로 바꾸지 않고,
  Go와 Rust server는 자신이 만드는 결과에 `hidden`을 추가하며, 벤치마크 저장과 검증의 응답에도 추가합니다.
- record contract는 모든 저장과 검증 응답에서 `hidden`을 기대하고, 레코드 24의 저장은 그 안에서 체크 해제된
  스토어의 메모를 가리킵니다.

### 2026-10-06 — 검증 결과의 public type (C8.3-2)

- build된 package의 public type 검사는 ESM과 CommonJS에서 `validateList`와 `validateDetail`의 결과를
  `ListValidationResult`에 대입하고 `validate`의 `ValidationResult`에서 `hidden`을 읽습니다.

### 2026-10-06 — hiddenPaths의 public build test (C8.1-1)

- public build test는 `contracts/features.json`이 선언하는 대로 `@crudui/validator`의 export 중에 `hiddenPaths`를
  기대하고, build된 ESM과 CommonJS entry로 그 결과를 검사합니다.

### 2026-10-06 — 문서화한 검증 결과 type (C8.3-1)

- `@crudui/validator`의 interface `ValidationResult`가 자기 문서 주석을 가지고 `ListValidationResult`의 주석은 하나이므로,
  `validator-ts`의 문서 coverage가 다시 통과합니다.

### 2026-10-06 — pull request와 merge queue로 main에 도달하는 변경 (C6.2)

- 모든 변경은 pull request와 merge queue를 거쳐 `main`에 도달합니다. branch는 `git push`, `gh pr create`, `gh pr
  merge --auto --rebase`로 게시합니다. 이제 `.github/repository.json`에 선언하고 `make github-settings`로 적용하는
  ruleset `main`은 pull request, `REBASE` 방식의 merge queue, 선형 이력, `push-gate`와 모든 CI job의 check를
  요구하며, 설정은 auto-merge를 켜고 merge된 branch를 지웁니다. CI는 pull request와 merge group에서 실행되고,
  `.github/workflows/pages.yml`이 `main`의 문서 웹을 배포합니다.

### 2026-10-06 — 표시 전환의 공유 사례 (C8.5)

- 공유 검증 사례가 검증기 다섯 개에서 표시 전환의 서버 결과를 고정합니다. 형제가 전환하는 그룹 subtree와 그
  필수 필드, 같은 값이 전환하는 두 단계 중첩 그룹, 행과 collection 옆의 값이 전환하는 반복 행 안의 그룹입니다.

### 2026-10-06 — 다른 런타임과 같은 Rust 표시 여부 (C8.4)

- Rust 검증기와 그 표시 여부를 쓰는 Rust 렌더러는 `design.show`를 조건부 매개변수처럼 결정합니다. 문자열은
  완전히 파싱되는 condition expression일 때만 expression이므로 `enabled`는 필드를 보이는 리터럴이고, 삼항식은
  분기 값을 주므로 분기 `0`은 false가 아닙니다.

### 2026-10-06 — 검증 결과의 숨은 경로 (C8.3)

- 검증기 다섯 개의 검증 결과는 `design.show`가 false로 결정되는 필드의 데이터 경로 `hidden`을 담으므로,
  서버는 숨은 가지의 값을 저장하지 않을 수 있습니다. `validateList`와 `validateDetail`의 결과는
  `{ valid, errors }`를 유지하며, TypeScript와 Go 검증기는 이를 `ListValidationResult`라고 부릅니다.

### 2026-10-06 — 상대 경로에서 행은 한 단계 (C8.2)

- 상대 경로, 조건부 매개변수, 필드 참조(`equalTo`, `notEqual`, `enddate`)는 검증기 다섯 개와
  렌더러 여덟 개에서 반복 필드의 행을 한 단계로 다룹니다. 그룹 행의 필드에서 `..x`는 행 키가 무엇이든
  collection 옆의 필드를 읽고, 숫자 이름의 필드는 행 키가 아닙니다. 런타임은 경로와 함께 행 키의 위치를
  넘기며, 점이 없는 필드 참조는 `.name`으로 결정됩니다.

### 2026-10-06 — 브라우저 바인딩의 즉시 표시 (C8.1)

- 브라우저 바인딩은 바인딩할 때와 변경마다 현재 데이터에 대한 `design.show`로 모든 노드의 `hidden`
  속성을 쓰고, 숨게 된 노드와 그 안의 노드의 오류를 지우며, 값은 바꾸지 않습니다.
  `@crudui/validator`의 `hiddenPaths(spec, data)`는 숨은 경로를 반환합니다.

### 2026-10-06 — ref마다 CI 실행 하나 (C7.19)

- ref의 새 push는 이전 push의 CI 실행을 취소하고, push 검사는 여전히 push된 모든 commit에 실행됩니다.

### 2026-10-06 — 새 clone에서의 전체 실행 (C5.7)

- `make ci`는 `make install` 뒤의 commit된 commit의 새 clone인 `var/full-run/clone`에서 명령을 실행하므로, working
  tree의 무시되는 출력이 검사에 닿지 않습니다.

### 2026-10-06 — 근거와 함께 닫은 stub stall (C7.13)

- stub program의 30 s stall은 CI 실행 12번과 local 실행 3번에서 재발하지 않았습니다. 첫 실행은 Linux에서 최대 81 ms,
  macOS에서 최대 979 ms였고, 기록은 남습니다.

### 2026-10-06 — offline 패키지 설치 (C7.16-1)

- `npm run test:packages`의 설치 프로젝트는 `scripts/install-lock.mjs`가 루트 lock에서 만든 lock으로
  `npm ci --offline`을 실행해 설치하므로, 루트 lock의 release를 설치하고 registry에 range를 묻지 않습니다.

### 2026-10-06 — 모든 CI job의 보고서 (C7.18)

- 모든 CI job은 각 대상을 끝까지 실행하는 `make ci-targets`로 검사를 실행하고, 각 대상의 log와 실패한 대상마다의 첫
  실패 줄을 담은 summary를 올리며, summary는 job summary에도 갑니다.

### 2026-10-06 — checklist 문구 (C7.15-1)

- C7.15와 C7.16 행은 writing 검사가 거부하는 단어 없이 pre-push hook과 문서 job을 서술합니다. 그 단어는 CI의 문서
  job을 실패시켰습니다.

### 2026-10-06 — make를 거치는 CI (C7.17)

- workflow의 모든 step이 make 대상을 실행하므로 Makefile의 offline 설정, checkout npm, download 검사가 CI에 적용됩니다.
  설치 대상, `make toolchain-check TOOLS=...`, 검사 명령마다의 대상이 그것이며, `make ci`는 이를 같은 순서로 실행합니다.

### 2026-10-06 — offline 검사 (C7.16)

- Makefile은 cargo, go, npm, Composer를 offline으로 실행하고, install 대상과 의존성 review만 download합니다.
  `make install-crates`는 모든 Cargo.lock의 crate를 download하며, cargo를 실행하는 대상은 crate가 없으면 먼저 lock과
  `run make install`과 함께 실패합니다. comparison pipeline은 OrderedJSON checkout을 fetch하는 대신
  `make install-ordered-json`의 checkout을 읽습니다.

### 2026-10-06 — 개발은 unit test, 다른 모든 검사는 CI (C7.15)

- 개발은 변경을 소유한 unit test를 실행하고, end-to-end 검사, `make owner-check`, `make ci`는 push 뒤에 CI에서
  실행하며, commit이나 push 전에 local 검사를 요구하는 규칙은 없습니다. pre-push hook은 checklist 작업이 진행 중인
  동안 여전히 push를 거부합니다.

### 2026-10-06 — Cargo lock의 RustSec 보안 권고 (C5.8-1)

- 의존성 review는 `make install`이 `.tools/cargo-audit`에 설치하는 cargo-audit 0.22.2로 Cargo lock 6개의 보안
  권고를 RustSec에서 읽고 각 lock을 sha256과 함께 기록합니다. `npm run test:dependencies`는 review 뒤에 바뀌었거나
  review 때 보안 권고가 있던 Cargo lock에서 실패합니다.

### 2026-10-06 — 의존성 review (C5.8)

- `npm run test:dependencies`는 registry에 `npm audit`을 실행하는 대신 `config/dependency-review.json`에
  기록된 review와 의존성을 대조하므로, 같은 tree는 어느 날이든 같은 결과를 냅니다. `make dependency-review`는
  registry에 새 안정 release와 보안 권고를 묻고, `RECORD=1`은 review를 기록하며 `UPDATE=1`은 먼저 갱신합니다.
  예약된 workflow가 이를 매일 실행합니다. React 19.2.8은 기록된 예외로 유지되고(C5.8-2-1), typescript-eslint는
  첫 review가 찾은 8.71.1로 올라갑니다.

### 2026-10-06 — PHPUnit 13 (C5.8-10)

- validator-php와 generator-php는 PHPUnit 13.4.1로 test하고, PHPUnit 12가 `@dataProvider` annotation을 없앴으므로 data
  provider 18개를 attribute `#[DataProvider(...)]`로 선언합니다. 두 suite는 PHPUnit 10.5와 같은 763개, 311개 case를 실행합니다.

### 2026-10-06 — checkout의 file을 읽는 검사 (C7.14)

- ESLint는 Git이 무시하는 모든 경로를 무시하고, 건너뛸 directory 이름 목록을 각자 두고 tree를 돌던 검사는
  `scripts/tracked-files.mjs`로 추적된 file을 읽습니다. 무시되는 `var/` 아래의 `dist` 복사본은 `npm run lint`를 실패시켰고,
  무시되는 directory 아래의 남은 file이 다른 검사를 바꿀 수 있었습니다. `tests/build/tracked-files.test.mjs`는 건너뛸
  directory 이름 목록이 새로 생기면 실패합니다.

### 2026-10-06 — jest-dom 7 (C5.8-9)

- generator-react는 `@testing-library/jest-dom` 7.0.1로 test합니다. 6.10.0이 breaking change가 있는 minor로 deprecated되어
  6.9.1에 머물렀고, 7은 그 변경을 major로 게시합니다.

### 2026-10-06 — @sveltejs/package 3 (C5.8-8)

- generator-svelte는 `@sveltejs/package` 3.0.0으로 component를 package합니다. 그 `dist`의 57개 file은 2.5.8의 것과 같습니다.

### 2026-10-06 — 실행 major의 Node.js type 정의 (C5.8-7)

- TypeScript workspace 6개는 기록된 Node.js 26.8.1의 major인 `@types/node` 26.6.4를 씁니다. 이전에는 Node.js 25를
  기술했습니다. `tests/build/runtime-version-policy.test.mjs`는 `.node-version`과 다른 major의 `@types/node` range에 대해
  실패합니다.

### 2026-10-06 — YAML 1.2 core schema의 js-yaml 5 (C5.8-6)

- cli와 cross-check console은 이름 있는 `load` export로 js-yaml 5.4.2를 씁니다. 그 기본 schema는 `scripts/check-schema.mjs`의
  `yaml` package처럼 YAML 1.2 core schema입니다. 날짜 모양의 값은 문자열로 남고 `<<`는 평범한 key이며, js-yaml 4는 `Date`를
  읽고 병합했습니다. 각 경로의 case가 이것을 고정합니다.

### 2026-10-06 — tree 전체의 jsdom 30 (C5.8-5)

- root와 generator-react는 form-binding의 release인 jsdom 30.1.2를 쓰므로, tree에서 29.1.1과 30.1.2 대신 jsdom의 major 하나만
  실행됩니다.

### 2026-10-06 — Vitest event로 밝히는 실패한 Vitest hook (C5.8-4-1)

- Vitest reporter는 시작했고 그 file이나 suite가 실패하기 전에 끝나지 않은 hook에 대해 `<hook name> hook of <entity>
  started and failed`를 출력하고, runner case는 Vitest 4에서 5로 문구가 바뀐 Vitest message 대신 hook 이름과 실패한 entity를
  단언합니다. Vitest 5.0.3은 실패한 hook에 `onHookEnd`를 보내지 않고 event를 묶어 보내므로 경과 시간도 실패 종류도
  단언하지 않습니다.

### 2026-10-06 — 기록하는 test stub의 첫 실행 시간 (C7.13-1)

- `tests/build/checkout-npm.test.mjs`와 `tests/build/install-browsers.test.mjs`의 stub case는 각 stub 첫 실행의 경과
  시간을 기록하므로, 그 증거를 기다리는 C7.13의 30초 정지가 재발하면 스스로 설명됩니다.

### 2026-10-06 — minor 릴리스로 고정한 Python (C7.12)

- `config/toolchain.json`은 `tests/ordered-json`의 test를 실행하는 Python 3.9를 기록하고, `node scripts/check-toolchain.mjs
  python`은 실행 중인 major와 minor를 비교하고 patch를 출력합니다. CI의 build-lint job은 commit SHA로 지정한
  `actions/setup-python`으로 그것을 설치하고 `make test-ordered-json`을 실행하며, `make ci`도 그것을 실행합니다. C7.9 전에는
  어떤 명령도 그 test를 실행하지 않았습니다.

### 2026-10-06 — minor 릴리스로 고정한 PHP (C7.2-3)

- `config/toolchain.json`은 PHP minor 8.4와 8.5를 기록하고, `node scripts/check-toolchain.mjs`는 실행 중인 PHP의 major와
  minor를 그것과 비교합니다. setup-php와 Homebrew는 같은 patch를 설치할 수 없으므로 정확한 patch 기록은 둘 중 하나에서
  실패했습니다. 실행의 patch는 evidence입니다. 검사는 모든 도구의 실행 중인 release를 출력하고 `var/full-run.json`이
  그것을 기록합니다. container image는 digest가 있는 정확한 tag를 유지합니다. local 검사가 이제 PHP를 다루므로 C7.2-1이
  닫힙니다.

### 2026-10-06 — 명령 하나로 설치하는 Chrome sandbox helper (C7.2-4)

- `scripts/install-browsers.mjs`는 sandbox helper를 `sudo install -o root -g root -m 4755 <chrome_sandbox>
  /usr/local/sbin/chrome-devel-sandbox`로 설치합니다. 이전에는 명령에 `install`을 두 번 넣었으므로 CI의 모든 browser
  job이 browser 설치에서 실패했고 Chrome은 helper 없이 중단했습니다.

### 2026-10-05 — 모든 commit 전의 owner check (C7.9)

- `make owner-check`는 `scripts/owner-checks.json`이 바뀐 경로의 owner로 선언한 검사를 실행합니다. make 대상, root npm
  script, workspace와 package directory의 test script, node test file이며 full suite는 실행하지 않습니다. owner가 없는
  경로, 경로가 없는 glob, full suite 대상, 알 수 없는 script나 test, 그리고 경로의 규칙이 그 검사를 고르지 않는데 검사가
  읽는 경로(`inputs`)에 대해 어떤 검사보다 먼저 실패하고, 고른 모든 검사는 앞의 검사가 실패한 뒤에도 실행됩니다. 변경의
  소유 검사를 손으로 골랐으므로 AGENTS는 이것을 commit 전의 검사로 정합니다. `make test-ordered-json`은 어떤 명령도 실행하지
  않던 `tests/ordered-json`의 Python unit test를 실행하고, `make install`은 `make docs-check`가 읽는 phpDocumentor를 설치합니다.

### 2026-10-05 — 무엇이 왜 실패했는지 밝히는 실패 (C7.8)

- timeout을 넘긴 test는 경과 시간, 한도, runner가 멈추는 명령을 출력하고, 검사의 다른 한도도 명령, 한도, 경과 시간을
  밝힙니다. `scripts/run-tests.mjs`는 시작할 수 없는 tool을 처리되지 않은 오류로 끝나는 대신 그 경로, 오류, 설치 명령으로
  보고하고, test case를 실행하지 않은 Go package는 통과 대신 `ran no test case`로 보고합니다. Rust program과 test의 모든
  file 읽기는 경로와 오류를 밝히며, `tests/build/failure-messages.test.mjs`는 그것을 버리는 읽기에 대해 실패합니다.

### 2026-10-05 — 중지가 끝나면 사라진 process tree (C7.10)

- form comparison step runner의 `killProcessTree`는 step의 process가 끝나고 그 output pipe가 닫히면 끝나며, pipe는 그것을 가진
  모든 process가 끝나면 닫힙니다. 이전에는 SIGKILL을 보낸 직후 반환했으므로 다음 step이 멈춘 step의 process를 만날 수 있었습니다.
  kill 뒤에도 output이 열려 있으면 tree 밖의 process가 그것을 가진 것이고 중지는 그 원인으로 실패합니다. local server test는
  FIFO 대신 Unix socket 연결의 끝을 기다립니다. FIFO의 막히는 open은 stand-in이 시작하지 않으면 test file을 timeout 너머까지
  붙잡았습니다.

### 2026-10-05 — 자신이 잡은 port의 server와 lock된 공유 단계 (C7.11)

- form comparison의 모든 server는 port 0을 포함한 자기 주소에 bind하고 준비 줄 `CRUDUI_READY {server} {host}:{port}`에 잡은
  주소를 밝힙니다. PHP launcher는 bind한 socket을 nginx에 넘기고, nginx는 변수 `NGINX`에서 그것을 읽습니다. local stack은
  모든 server를 `127.0.0.1:0`에서 시작하고 알린 주소로 접근합니다. `freePort`는 port를 확인하고 나중 process에 넘겼으므로
  그 사이에 다른 process가 그것을 잡을 수 있었습니다.
- generator-php vendor의 다시 설치는 make, local server, 비교 build에서 checkout lock `composer-generator-php` 아래에서 실행되고,
  `make ci`의 guard는 checkout lock `full-run`을 잡으므로, 한 checkout의 두 실행은 동시에 다시 설치하거나 같은 record로 정하지
  않습니다.

### 2026-10-05 — rename으로 게시하는 공유 출력 (C7.6)

- PHP extension builder는 자기 process의 directory에 compile하고 `<module>.so.<pid>`로 link한 뒤 load하여 검사하고
  module 경로로 rename합니다. 이전에는 먼저 `.build`와 `modules`를 지우고 제자리에 link했으므로 PHP process가 없거나
  일부만 쓰인 module을 load할 수 있었습니다. OrderedJSON checkout은 그 directory 옆에 만든 뒤 제자리로 rename합니다.
  모든 package build는 `dist.next`(`CRUDUI_DIST`)에 쓰고 `scripts/package-dist.mjs`는 `dist` lock 아래에서 그것으로
  `dist`를 바꾸므로, 읽는 쪽은 `tsup --clean`이 비운 `dist`를 보지 않습니다. 실패한 build는 `dist`를 남깁니다.
  `require-current-build`의 build stamp는 쓴 뒤 rename합니다. `tests/build/atomic-publish.test.mjs`는 모든 공유 출력을
  그 형식으로 유지합니다.

### 2026-10-05 — 자신이나 준비 단계가 만든 것만 읽는 검사 (C7.5)

- `make test-php-extension`은 generator-php의 vendor directory를 load하는 test 전에 그 validator 복사본을 다시 설치합니다.
  이전에는 `make test-native-suites`만 그것을 새로 했습니다. `test:build`는 exports로 package를 load하는 test 전에
  `require-current-build`를 실행합니다. `scripts/repeat-build.mjs`는 자신의 두 build를 비교해 다른 모든 file과 함께
  실패합니다. 그 test는 그 script만 쓰는 기록을 읽었습니다. `scripts/run-rust-command.mjs`는 그 directory의 checkout 밖의
  `CARGO_TARGET_DIR`을 거부합니다. cargo는 수정 시각으로 최신 여부를 판단하므로 다른 checkout의 출력을 다시 씁니다.

### 2026-10-05 — 실패 뒤에도 실행되는 script의 모든 검사 (C7.4)

- `test:forms`, `test:form-comparison`, `test:form-comparison:pipeline`, `docs:check:all`, generator-svelte의 `test`
  script, form-binding의 `typecheck` script는 독립된 각 검사를 `|| status=1`로 실행하고 모은 상태로 끝납니다. 이전에는
  검사를 `&&`로 이었으므로 첫 실패가 나머지를 건너뛰게 했습니다. `test:form-comparison:build`는 제거되고 form comparison의
  각 suite는 자신이 읽는 package를 위해 `require-current-build`를 실행합니다. CI와 `make ci`는 `npm run test:build`와
  `npm run test:build:repeat`를 두 명령으로 실행합니다. `scripts/run-contract-tests.mjs`는 선언된 모든 명령을 실행하고
  마지막 명령 뒤에 실패합니다. `tests/build/test-commands.test.mjs`는 실패한 검사에서 멈추는 package script나 CI step에
  대해 실패합니다.

### 2026-10-05 — 아무것도 검사하지 않는 실행의 실패 (C7.3)

- `scripts/run-tests.mjs`는 test case가 하나도 통과, 실패, 시간 초과하지 않은 go, cargo, phpunit 실행을, Vitest
  reporter는 그런 vitest 실행을 `ran no test case`로 실패시킵니다. `scripts/run-contract-tests.mjs`는 선택한 feature가
  verification 명령을 선언하지 않으면 `ran no command`로 실패합니다. 이런 실행은 아무것도 검사하지 않고 통과했습니다.
- container 정의의 PHP 검사는 `php` 단계와 `php8.N-*` package를 읽고 빈 목록에 대해 실패합니다. 이전 검사는 두
  image가 Debian PHP 8.4를 설치하는 동안 하나도 없는 `FROM php:` 단계를 돌았습니다. 이제 두 image는 PHP를 기록한
  8.5.11의 `php` image에서, Composer를 `composer` 2.10.3 image에서 각각 digest로 받고, PHP extension build는
  `/usr/local/bin/php-config`를 씁니다.
### 2026-10-05 — Tailwind style 검사의 보이는 page 하나 (C5.11)

- `tests/tailwind-styles.test.mjs`는 `crudui.css`와 Tailwind 판의 style을 engine과 너비마다 page 하나에서 계산하며, 그
  page는 두 stylesheet를 담고 `media`로 하나를 적용합니다. test는 한 browser에서 page 둘을 열었고 첫 page는 Chromium과
  Firefox에서 hidden이었으며, memory 압박에서 hidden Chromium page의 호출은 page-in을 최대 44.2 s 기다려 case의 timeout을
  넘겼습니다. 이제 각 호출은 page가 보이고 요청한 stylesheet만 적용될 때만 진행합니다.

### 2026-10-05 — digest 단계를 받아들이는 toolchain image test (C7.2-2)

- `examples/form-comparison/check-toolchain.test.mjs`는 비교 image의 단계를 digest가 있는 기록한 release로 요구합니다.
  C7.2는 단계를 바꿨고, 이 test가 여전히 release 계열을 요구하는 동안 commit되었습니다.

### 2026-10-05 — 모든 곳의 정확한 toolchain version (C7.2)

- specification은 release channel 대신 정확한 version을 기록합니다. channel은 실행의 toolchain을 그 날짜에 따라
  달라지게 했습니다. `.node-version`은 26.8.1, `.go-version`은 모든 `go.mod`의 `toolchain` 줄과 함께 1.27.0,
  `rust-toolchain.toml`은 `rustfmt`, `clippy`와 함께 1.98.1이며, `config/toolchain.json`은 PHP 8.4.26과 8.5.11,
  Composer 2.10.3, Linux Node.js archive의 SHA-256을 기록합니다. Makefile, CI, image는 `RUSTUP_AUTO_INSTALL=0`과
  `GOTOOLCHAIN=local`을 설정하고, `make install`은 npm, 의존성, Rust toolchain을 설치하며,
  `node scripts/check-toolchain.mjs`는 다른 version의 도구에 대해 기록, 기대한 version과 실행 중인 version, 해결
  방법으로 실패합니다. 모든 CI job은 자신이 설치한 도구에 대해 그것을 실행합니다.
- CI는 `ubuntu-24.04`에서 실행되고 모든 action을 release의 commit SHA로 지정합니다. container 단계는 image를 tag와
  digest로 지정하고 2026-10-05 snapshot의 Debian package를 설치합니다. Chrome과 Firefox는 puppeteer가 고정한 build로,
  WebKit은 playwright의 build로 실행되며(`node scripts/install-browsers.mjs`), CI에서는 그 Chrome의 sandbox helper와
  함께 실행됩니다. Linux style 검사는 `.node-version`의 Node.js archive를 받아 SHA-256을 검사합니다.
  `scripts/run-contract-tests.mjs`는 login shell 대신 `sh -c`를 실행합니다.

### 2026-10-05 — test 복사본의 checkout npm module (C7.7-1)

- `tests/build/rust-node-entry-points.test.mjs`와 `tests/build/run-command.test.mjs`는 C7.7부터 그것을 import하는
  script와 함께 `scripts/checkout-npm.mjs`를 복사합니다. 그것이 없는 임시 checkout에서 script가 load에 실패했습니다.

### 2026-10-05 — machine이 아닌 checkout의 npm (C7.7)

- `node scripts/install-npm.mjs`는 `packageManager`의 npm release를 `npm install --prefix`로 임시 directory에
  설치한 뒤 제자리로 rename하여 checkout의 무시되는 `.tools/npm`에 두고, `npm install --global`은 실행하지 않습니다.
  이전에는 모든 repository가 쓰는 machine의 npm을 바꿨고 다른 repository의 `npm ci`를 깨뜨렸습니다.
  Makefile은 `.tools/npm/node_modules/.bin`을 맨 앞에 둔 `PATH`를 export하고, GNU Make 3.81이 shell 문법이 없는
  recipe program을 시작할 때의 `PATH`에서 찾으므로 recipe에서 npm을 `$(NPM)`으로 시작합니다. npm을 시작하는 모든
  script는 `scripts/checkout-npm.mjs`의 `useCheckoutNpm`을 호출하고, 모든 CI job은 첫 npm 명령 전에 그 directory를
  `GITHUB_PATH`에 더합니다. `tests/build/checkout-npm.test.mjs`는 다른 모든 형식에 대해 실패합니다.

### 2026-10-05 — 모든 make에서 같게 읽히는 make dry run (C7.1)

- test는 Makefile 대상의 명령을 `tests/build/make-dry-run.mjs`의 `makeDryRun`으로 읽습니다. 이것은 `MAKEFLAGS=w`를 설정하고
  상위 make의 변수를 지운 채 `make --no-print-directory -n`을 실행합니다. 다른 make 안의 GNU Make 4는 명령 앞뒤에
  `Entering directory` 줄을 출력했으므로 `tests/build/full-run.test.mjs`가 그곳에서 실패했습니다.
  `tests/build/make-dry-run.test.mjs`는 helper 밖의 make dry run에 대해 실패합니다.

### 2026-10-05 — 19.2.8에 둔 React (C5.8-2-1)

- React와 React DOM을 19.2.8로 고정합니다. React 19.3.0은 React renderer가 render하는 widget script의 `<script>` 요소에
  browser 오류를 보고하므로, C5.8-2가 React를 올린 뒤 `tests/widget-script-runs.test.mjs`의 React case가 세 browser에서
  실패했습니다. 갱신은 React renderer가 client render에서 `<script>` 요소 없이 widget script를 실행하게 되면 다시
  시도합니다.

### 2026-10-05 — Vitest 5 (C5.8-4)

- root와 workspace 8개는 Vitest 5.0.3으로 test합니다. Vitest 5는 실패한 hook을 stack의 `Error:` 접두어와 함께 출력하며,
  제한 시간을 넘긴 Vitest hook에 대한 runner case는 그 접두어를 받아들입니다.

### 2026-10-05 — workspace compiler의 TypeScript 7 (C5.8-3)

- TypeScript workspace 7개는 TypeScript 7.0.2로 build하고 type 검사를 합니다. typescript-eslint, typedoc, svelte-check,
  `@sveltejs/package`는 7보다 낮은 peer range를 선언하므로 npm이 root에 그 peer로 설치하는 TypeScript 6.0.3을 씁니다.

### 2026-10-05 — 자기 major의 최신 release로 올린 의존성 (C5.8-2)

- root와 workspace manifest의 npm 의존성 19개와 두 Composer package의 PHPUnit을 잠긴 major의 최신 stable release로
  올렸습니다. `puppeteer` 25.12.0, `eslint` 10.12.0, `react`와 `react-dom` 19.3.0, `vite` 8.3.2, PHPUnit 10.5.66이
  그 예입니다. 각 manifest는 range operator를 유지하고, `react` override는 direct range를 따르며, install script 승인은
  `puppeteer@25.12.0`을 밝힙니다. `@testing-library/jest-dom`은 게시자가 6.10.0을 breaking change가 있는 minor
  release로 deprecated했으므로 6.9.1에 남습니다.

### 2026-10-05 — local, CI, image의 하나의 npm release (C5.2-2)

- `package.json`의 `packageManager`는 npm 12.2.0을 기록하고, `node scripts/install-npm.mjs`는 정확히 그 release를
  설치합니다. 모든 CI job은 npm보다 먼저 이것을 실행하고, native test image와 비교 서비스 image는 같은 release를
  설치합니다. CI는 `npm i -g npm@latest`를 실행했으므로 그 npm이 registry에 따라 바뀌었고, npm 12가 local npm 11에서
  통과한 test를 깨뜨렸습니다. `tests/build/runtime-version-policy.test.mjs`는 실행 중인 npm, workflow step, container
  정의가 다른 release를 고르면 실패합니다.

### 2026-10-05 — 실패 뒤에도 실행하는 recipe의 모든 검사 (C5.10)

- `make docs-check-documents`와 `make format-check`는 recipe의 모든 검사를 `|| status=1`로 실행하고 모은 상태로 끝납니다.
  make는 처음 실패한 recipe 줄에서 멈추므로, `npm run manifest:check`가 실패하면 다른 문서 검사, 문서 test, 문서 build를
  건너뛰었고, rustfmt와 다른 첫 Rust crate는 다른 crate와 gofmt를 건너뛰게 했습니다. `tests/build/test-commands.test.mjs`는
  대상의 첫 검사 뒤의 recipe 줄, 검사의 `|| exit`, `status=1`을 설정하지 않는 검사에 대해 실패합니다.

### 2026-10-05 — 등록된 node:test case는 실행되거나 file이 실패합니다 (C5.9)

- `scripts/run-tests.mjs`는 모든 `node:test` file의 process에 `scripts/test-progress/load-check.mjs`를 preload하며, 이
  module은 module의 evaluation이 끝나기 전에 process가 끝난 file을 실패시킵니다. node reporter는 case를 하나도 보고하지
  않은 file을 실패시킵니다. `scripts/lint/node-test-rules.mjs`의 lint rule `crudui/no-await-after-test-registration`은 첫
  `node:test` 등록 뒤의 top-level `await`를 거부합니다. `node --test --test-force-exit`는 알려진 test가 끝나면 file의
  process를 끝내고, `packages/php-ext/tests/engine.test.mjs`는 top-level `await` 뒤에 test를 등록했으므로 첫 `await` 앞의
  case가 혼자 실행되었고 `--test-name-pattern`을 주면 case가 실행되지 않았는데 file이 통과했습니다. engine.test는 이제
  fixture를 동기로 읽고 Unicode data generator를 정적으로 import합니다.

### 2026-10-05 — npm 12의 npm pack report (C5.2-1)

- `tests/build/shared-resources.test.mjs`의 dist lock test는 `scripts/package-install-pack.mjs`의 `packReport`로
  `npm pack` report를 읽습니다. `packReport`는 npm 11의 배열과 npm 12의 package 이름을 key로 하는 object를 읽고, 기대한
  archive 수와 package 이름으로 실패합니다. CI가 최신 npm으로 설치하는 npm 12에서 test는 무엇을 기대했는지 말하지 않는
  `TypeError: object is not iterable`로 실패했습니다.

### 2026-10-05 — 작업이 진행 중인 동안 거부되는 push (C6.1)

- 추적되는 pre-push hook `.githooks/pre-push`는 `node scripts/push-gate.mjs hook`을 실행합니다. 이 entry는 push되는 모든
  commit과 working tree의 checklist를 `scripts/full-run.mjs`의 `activeItems`로 읽고, 작업이 `[~]`인 동안 각 작업의 ID와
  제목, 이유, 해결 방법을 적으며 push를 거부합니다. checklist가 없는 push commit, Git 오류, 검사 자체의 오류도 push를 거부합니다.
  이전에는 진행 중인 작업이 있는 push가 GitHub에 도달했습니다.
- 모든 `make` 실행은 `core.hooksPath`를 `.githooks`로 설정합니다. `make hooks`는 hook을 설치하고 검사하고,
  `make hooks-check`는 hook이 설치되지 않은 동안 실패하며, `make ci`의 guard는 hook이 설치되지 않은 동안 거부합니다.
- `.github/workflows/push-gate.yml`의 job `push-gate`는 push되는 모든 commit과 pull request에
  `node scripts/push-gate.mjs commit`을 실행하고, 진행 중인 작업이 있거나 checklist가 없거나 실행 가능한 hook이 없는 commit에
  실패하므로, hook을 거치지 않은 push는 이 job을 실패시킵니다.

### 2026-10-05 — 경고와 함께 쓰인 comma locale (C5.6)

- engine test는 Linux의 comma locale build를 그 결과로 보고합니다. `localedef -c`는 경고와 함께 locale을 쓰면 status 1로
  끝나고, step은 test가 통과하기 전에 `comma locale: compiling: failed (1)`을 출력했습니다. 이제 `LC_NUMERIC`이 쓰인
  status 1은 `wrote the locale with warnings (exit 1)`로 보고되고, 0이 아닌 다른 status는 build를 실패시킵니다.
  `packages/php-ext/tests/engine.test.mjs`의 case는 stub `localedef`로 build를 실행합니다.

### 2026-10-05 — 빠진 conformance evidence의 suite (C5.5)

- `scripts/check-conformance.mjs`는 evidence가 빠졌거나 실패한 기능, fixture, runtime마다 그 runtime을 증명하는 모든
  suite를 상태와 함께 적습니다. 상태는 실행되지 않음, 끝나지 않음, 종료 상태와 함께 실패로 끝남, 통과입니다.
  `scripts/run-tests.mjs`와 `tests/native-generators/run.mjs`는 `tests/conformance/runs.mjs`로 evidence directory의
  `runs/`에 시작할 때 상태 null, 끝날 때 종료 상태를 담은 실행 기록을 쓰고, `evidenceSuites`는 suite마다 명령과
  runtime을 선언합니다. 이전 검사는 native suite가 실행되지 않았을 때 runtime마다 `185 missing`을 보고했고 이유를 말하지
  않았습니다. evidence file 수는 더 이상 `runs` directory를 세지 않습니다.

### 2026-10-05 — engine test의 하나의 compiler 명령 (C5.4)

- `packages/php-ext/tests/engine.test.mjs`의 모든 C program은 math library를 link하는 `compileAndRunEngineProgram`으로
  compile됩니다. template test와 value test는 compiler 명령을 따로 썼고, `-lm`이 없는 template test는 Linux에서
  `undefined reference to 'log10'`로 실패했습니다. macOS는 math 함수를 system library에 둡니다. file의 case는 file에
  compiler 명령이 둘 이상이거나 그 명령이 `-lm`을 link하지 않으면 실패합니다.

### 2026-10-05 — 긴 C string의 문자 상수 (C5.3)

- `packages/php-ext/tests/engine.test.mjs`의 `cString`은 4000 byte보다 긴 값의 각 byte를 octal escape의 문자 상수로
  씁니다. 이전에는 byte를 정수로 써서 127보다 큰 UTF-8 byte가 `char`를 초기화했고, GCC는 render fixture를
  `-Werror=overflow`로 실패시켰습니다. Apple clang은 두 형식을 모두 받아들입니다. file의 case는 initializer에 127보다
  큰 정수가 있으면 실패하고 문자 상수를 값의 byte로 되돌려 비교합니다.

### 2026-10-05 — build 결과물 없이 실행하는 dist lock test (C5.2)

- `tests/build/shared-resources.test.mjs`는 임시 checkout에서 build하고 pack하는 fixture package로 `dist` lock을
  확인합니다. CI는 `npm run build`보다 먼저 `npm run test:runtimes`를 실행하고, test는
  `packages/generator-html/dist`에 대한 `ENOENT`로 실패했으며 local 실행은 이전 build의 `dist`를 읽었습니다. build
  결과물이 없는 worktree에서 test는 변경 전에 실패했고 변경 후 통과합니다.

### 2026-10-05 — 실패 뒤에도 실행하는 모든 검사 (C5.1)

- 검사 명령을 실행하는 모든 workflow step은 `if: ${{ !cancelled() }}`를 가지며, `make test-native`와 `make docs-check`는
  각 test 대상을 `$(MAKE) <target> || status=1`로 실행하고 모은 상태로 끝납니다. CI는 step 하나가 실패한 뒤
  Lint, Type-check, dependency 검사, benchmark driver를 건너뛰었고, `make test-native`는 실패한 prerequisite
  `test-php-extension`에서 멈춰 `tests/native-generators/run.mjs`가 report도 conformance evidence도 쓰지 않았습니다.
  `tests/build/ci-local.test.mjs`는 조건이 없는 검사 step의 job과 step을 적고 실패하고, `tests/build/test-commands.test.mjs`는
  test를 실행하는 대상을 prerequisite로 둔 Makefile 대상에 대해 실패하며, `tests/build/make-tool-path.test.mjs`는 PHP extension
  test 명령이 실패할 때 `make test-native`를 실행합니다. `tests/build/dependency-health.test.mjs`의 native import 검사는
  `test-native`의 recipe 줄만 읽어 빈 목록을 검사했습니다. 이제 prerequisite와 `$(MAKE)` 대상을 따라가고 빈 목록이면 실패합니다.

### 2026-10-05 — 제목과 작업 table만 둔 checklist (C4.1-2)

- execution checklist에는 제목과 작업 table만 있고, `scripts/check-documents.mjs`는 다른 줄에 대해 file, 줄, 열을 적고
  실패합니다. checklist에는 번역 link, 내용을 설명하는 문단, 사용법 규칙, wave마다 의존과 배경을 적은 문단이 있었고
  그런 문장을 작업과 구별하는 검사가 없었습니다. 규칙은 AGENTS에, wave의 의존과 배경은 각 wave 제목이 link하는
  `docs/plans/waves.md`에 있습니다. `scripts/checklist-markers.test.mjs`의 case는 변경 전에 실패했습니다.

### 2026-10-05 — 상태 표시로 다루는 task list 상태 (C4.1-1)

- `scripts/check-documents.mjs`는 execution checklist에서 작업 행의 상태가 아닌 대괄호 안의 x나 대문자 X에 대해서도
  실패합니다. Markdown reader가 이 형식을 task list 상태로 읽기 때문입니다. `scripts/checklist-markers.test.mjs`의
  case는 검사가 두 형식을 보고하지 않아 변경 전에 실패했습니다.

### 2026-10-05 — 작업 상태로만 쓰는 작업 상태 표시 (C4.1)

- 작업 상태 표시는 execution checklist에서 작업 행 마지막 칸 첫머리의 상태로만 쓰입니다. checklist의 범례와 C2.1-2의
  문장이 inline code로 표시를 적었으므로, 표시를 세는 도구가 존재하지 않는 진행 중 작업을 셌습니다. 이제
  `scripts/check-documents.mjs`는 두 언어에서 다른 표시에 대해 실패하고 그 file, 줄, 열을 적습니다. 범례는 없어졌고, AGENTS가
  상태를 정의하며, 문장은 상태를 말로 적습니다. `scripts/checklist-markers.test.mjs`는 변경 전 `ERR_MODULE_NOT_FOUND`로
  실패했고, 그 fixture는 이전 문서 검사를 통과했습니다.

### 2026-10-05 — 전체 실행의 guard (C2.1-2)

- `make ci`는 어떤 명령보다 먼저 guard `scripts/full-run.mjs`를 시작합니다. AGENTS는 전체 suite를 활성 작업이 모두 끝났을 때 정확히 한
  번 실행한다고 적지만 이를 강제하는 것이 없었습니다. `make ci`는 진행 중인 작업이 있을 때, 커밋되지 않은 변경이 있을 때, 이미 검증한 tree에서도 명령을
  시작했습니다. guard는 판단을 이유와 함께 출력하고, checklist 작업이 `[~]`이면 활성 ID를 작업과 함께 나열하며 거부하고, 추적 파일의 변경이 커밋되지
  않았으면 거부하고, `var/full-run.json`이 현재 tree의 전체 실행을 기록하고 있으면 그 실행을 밝히며 거부합니다. `CI_COMMANDS`의 각 명령을 끝까지
  실행하고 각 명령의 앞뒤에 record를 쓰므로 멈춘 실행은 `incomplete`로 남습니다. `make rerun-failed`는 현재 tree에서 통과하지 못한 명령만
  다시 실행하고 통과한 명령의 적합성 증거를 유지합니다. `tests/build/full-run.test.mjs`는 변경 전 `ERR_MODULE_NOT_FOUND`로 실패했고,
  변경 뒤 그 11개 case가 stub 명령으로 통과합니다.

### 2026-10-05 — test process 종료 시 멈추는 local server (C2.19)

- form comparison test의 local stack은 test process가 server를 멈추지 않고 종료하면 시작한 server의
  process group을 멈춥니다. stop hook이 시간 초과되고 process가 강제 종료된 pipeline test가 record
  server를 몇 시간 동안 남겼습니다.

### 2026-10-05 — 모든 배포의 변경 신호 (C2.10-2)

- `make deploy`는 어느 mode에서든 빌드를 기다리기 전에 supervisor에 신호합니다. containerctl도 이전
  checkout에서 시작한 supervisor의 바뀌지 않은 container를 재사용하기 때문입니다.

### 2026-10-05 — supervisor 시작부터 답하는 서비스 port (C2.13-3)

- comparison supervisor는 시작부터 port 8080에서 listen하고, 공개 서버에 port를 넘길 때까지 빌드 상태와
  함께 503으로 답합니다. containerctl은 container 시작 후 1분 안에 서비스 port를 확인하므로, C2.13-2가
  없앤 healthcheck 없이는 빈 볼륨의 첫 빌드가 그 1분을 넘겨 `make deploy`가 연결에서 실패했습니다.

### 2026-10-05 — 재사용하는 배포의 변경 신호 (C2.10-1)

- container를 재사용하는 `make deploy`는 빌드를 기다리기 전에 실행 중인 supervisor에 신호하므로, 새
  commit을 source 감시기 없이 비교합니다. 전에는 이전 commit의 ready 상태에서 기다렸습니다.
  `make deploy-watch`는 `SIGINT`나 `SIGTERM`에서 전달한 신호 수를 적은 줄과 함께 멈춥니다.

### 2026-10-05 — route된 comparison container의 재사용 (C2.18-1)

- 배포는 containerctl이 `crudui.test`를 route할 때만 실행 중인 comparison container를 재사용하고,
  아니면 containerctl로 정의를 적용합니다. 전에는 실행 중인 container의 image가 같아서 바뀐 route가
  적용되지 않았습니다.

### 2026-10-05 — x-containerctl 아래의 comparison service route (C2.18)

- comparison service의 Compose 정의는 domain을 `x-containerctl.domains`에 적고, 배포 검사는
  `containerctl status --json`의 `domains`와 `urls`를 읽습니다. containerctl은 그 domain만 route하므로
  `containerctl.domain` label은 service를 internal로 남겼고 `make deploy`가 route에서 실패했습니다.

### 2026-10-05 — comparison image의 Chromium (C2.17)

- comparison toolchain image는 `chromium`과 `chromium-sandbox` `154.0.8037.92-1~deb13u1`을 설치합니다.
  Debian이 고정한 `153.0.8010.47-2~deb13u1`을 교체해서 `make deploy`의 image build가 실패했습니다.

### 2026-10-05 — 한도 없는 form comparison step (C2.13-2)

- form comparison의 step은 끝까지 실행하고 종료 상태로 판정합니다. step runner는 전체 한도나 비활동
  한도를 거부하고, build target, verification 검사, local build, host verification, deployment step은
  한도를 가지지 않습니다. Compose 정의는 첫 build를 제한하던 예산의 healthcheck를 선언하지 않고,
  배포는 대신 checkout의 build 상태를 기다립니다. 소스 비교와 OrderedJSON checkout의 Git 호출에는
  timeout이 없습니다. 검사 안의 단위는 자기 한도를 유지합니다.

### 2026-10-05 — 종료된 group의 process tree 멈춤 (C2.16)

- form comparison의 `killProcessTree`는 멈춘 process의 group에 종료된 process만 남아 있어도
  완료합니다. macOS가 종료되었지만 아직 회수되지 않은 group에 답하는 EPERM은 멈출 것이 없음을
  뜻합니다. 전에는 tree를 kill한 뒤 `kill EPERM`으로 실패했습니다.

### 2026-10-05 — host에서 게시하는 source 변경 (C2.10)

- form comparison supervisor는 1초마다가 아니라 `SIGUSR2`마다 mount된 저장소를 비교합니다. host의
  source 감시기 `source-events.mjs`(`make deploy-watch`)는 working tree의 file event를 구독하고 event마다
  container 안에서 `source-changed.mjs`를 실행하며, 이는 supervisor가 `state/supervisor.pid`에 기록한
  process id에 신호합니다. 비교 중의 신호와 전달 중의 event는 그 뒤에 실행을 한 번 더 일으킵니다
  (`src/change-requests.mjs`). 15초마다 state file을 다시 쓰던 heartbeat는 없앴습니다.
  `tests/build/test-commands.test.mjs`는 sleep하거나 진행 줄을 출력하지 않는 interval을 실행하는
  program에서 실패합니다.

### 2026-10-05 — process 줄로 ready가 되는 PHP record server (C2.15)

- `servers/php/main.mjs`는 PHP-FPM이 `NOTICE: ready to handle connections`를, `notice` log level의
  nginx가 `start worker processes`를 쓰면 ready가 되고, 그 standard error를 복사합니다. 전에는 20 ms마다
  연결을 시도하고 10초 start 한도 뒤에 실패했습니다.

### 2026-10-05 — 한도 없는 form comparison 대기 (C2.13-1)

- build readiness 대기에는 비활동 한도와 step 한도가 없습니다. 이 source가 ready이면 끝나고, 실패한
  주기나 감시·읽기·해석할 수 없는 state file에서 실패하며, 새 step마다와 15초마다 줄을 출력합니다.
  supervisor는 `limitMs` 없이 `progress`를 게시합니다. process start는 30초 한도 없이 readiness
  event를 기다리며 15초마다 줄을 출력합니다. browser 검사와 pipeline 검사의 browser start와 close는
  `runOperation`으로 한도 없이 실행하고, browser report의 unit은 자기 한도를 유지합니다.

### 2026-10-05 — benchmark를 실패시키는 version 명령 실패 (C2.14)

- `tools/bench/run.js`는 version 명령이 실패하거나 version을 출력하지 않으면 명령, 실패, 출력과 함께
  실패하고, `results.md`는 실행된 backend의 도구 version을 기록합니다. 전에는 실패한 version을
  `unavailable`, 빈 출력을 `unknown`으로 기록했고, 모든 실행에서 네 도구의 version을 조회했습니다.

### 2026-10-05 — dist lock 아래의 package build와 pack (C3.5)

- build되는 모든 package의 build script는 `node ../../scripts/package-dist.mjs build '<command>'`이며,
  build 내내 checkout lock `dist-<package folder>`를 잡습니다. `tsup --clean`과 `svelte-package`는
  먼저 `dist`를 비우므로, build 도중에 실행된 동시 pack은 비었거나 일부만 쓰인
  `dist`를 읽었습니다. `node scripts/package-dist.mjs pack <package directory> <destination directory>`는
  같은 lock 아래에서 `dist`에 output이 있는지 확인하고 `npm pack`을 실행해 그 JSON report를 출력합니다.
  package install check는 이것으로 pack합니다.
- Linux에서 `scripts/holder-lock.mjs`는 process 시작 시각을 `/proc/<pid>/stat`과 `/proc/stat`의 boot
  시각에서 읽습니다. package를 build하는 comparison의 toolchain image에는 `ps`가 없기 때문입니다. 다른
  system은 `ps`를 씁니다.

### 2026-10-05 — comparison deployment의 holder lock (C3.4)

- `make deploy`와 `make deploy-verify`는 다른 step보다 먼저 user 범위 holder lock
  `form-comparison-deployment`를 잡고 끝날 때 해제합니다. deployment는 user account에 하나뿐인 Compose
  project `crudui`와 그 container, volume이며, 다른 checkout의 deployment가 verification
  도중에 그것을 바꿨습니다. 잡힌 lock은 holder의 checkout, pid, process 시작 시각과 함께 실행을
  거부합니다. `scripts/holder-lock.mjs`의 `holdUntilExit`는 process가 끝날 때, signal handler의
  `process.exit` 뒤에도 lock을 해제합니다. `examples/form-comparison/check-deployment-lock.test.mjs`는
  `npm run test:form-comparison:source`에서 실행됩니다.

### 2026-10-05 — holder lock 아래에서 유지하는 Playwright image (C3.3)

- `make test-form-styles-linux`는 Playwright image를 남겨 둡니다. 전에는 image를 받은 실행이 끝날 때,
  다른 checkout의 실행이 아직 image를 쓰는 동안에도 image를 지웠습니다. 이제 container는
  image의 user 범위 holder lock 아래에서 실행되므로, 두 번째 실행은 holder의 checkout, pid, process
  시작 시각과 함께 거부됩니다. `make remove-form-styles-image`는 같은 lock 아래에서 image를 지우고 check가
  실행되는 동안에는 거부됩니다. `node scripts/holder-lock.mjs user-lock-file <name>`은 user 범위 lock의
  path를 출력합니다.

### 2026-10-05 — 하나뿐인 resource의 holder lock (C3.2)

- `scripts/holder-lock.mjs`는 한 번에 한 실행만 쓸 수 있는 resource를 잡습니다. lock file의 record는
  holder의 checkout, pid, process 시작 시각, 시각과 command를 밝힙니다. record는 모두 쓴 뒤 lock path로
  link하므로 lock은 atomic하게 잡힙니다. 잡힌 lock은 holder의 record와 함께 거부합니다. holder process가
  더 이상 실행되지 않거나 pid가 시작 시각이 다른 process의 것인 lock은 보고하고,
  `node scripts/holder-lock.mjs remove-dead <lock file>`이 지울 때까지 남겨 둡니다. 이 command는 실행
  중인 holder를 거부합니다. holder만 lock을 해제합니다. `hold`는 lock을 잡은 채 command를 실행합니다.
  checkout 하나의 lock은 `var/locks/` 아래에, 모든 checkout이 함께 쓰는 lock은
  `~/.local/state/crudui/locks/` 아래에 있습니다. `tests/build/holder-lock.test.mjs`는
  `npm run test:runtimes`에서 실행됩니다.

### 2026-10-05 — documentation 실행마다 따로 쓰는 snapshot directory (C3.1)

- `make docs-verify-idempotent`는 두 snapshot과 그 차이를 실행이 `mktemp -d`로 만들고 끝날 때 지우는
  directory에 씁니다. 전에는 고정 path `/tmp/crudui-docs-run1`, `/tmp/crudui-docs-run2`,
  `/tmp/crudui-docs-diff.txt`를 써서, 다른 checkout의 실행이 비교 도중에 그것을 지우고 다시
  썼습니다. `npm run test:runtimes`가 실행하는 `tests/build/shared-resources.test.mjs`는 `/tmp` 아래의
  고정 path를 쓰는 Makefile 줄에서 실패합니다.

### 2026-10-05 — pipe로 만나는 stage step (C2.9-1)

- step runner test에서 한 stage의 두 step은 named pipe의 두 끝을 열므로, stage는 둘이 동시에 실행될
  때만 끝납니다. 전에는 directory watch로 서로의 file을 기다렸고, macOS에서 그 event stream은 늦게
  시작해 10번 중 4번 file을 잃었습니다.

### 2026-10-05 — local pipeline stack의 setup 계약 (C2.7-2)

- `check-verification.test.mjs`는 pipeline과 record store test가 `scripts/test-progress/hooks.mjs`의
  `setup`과 `teardown`으로 stack과 browser를 시작하고 멈추며 자기 hook을 등록하지 않는지 확인합니다.
  전에는 C2.7-1이 pipeline test에서 없앤 `browser-start`와 `browser-close` 한도를 요구했습니다.

### 2026-10-05 — state file 자체를 감시하는 readiness 대기 (C2.4-1)

- form comparison의 readiness 대기는 build state file 자체를 감시하며(`watchStateFile`), 그 watch는
  돌아올 때 등록되어 있고, 교체될 때마다 읽기 전에 새 file을 감시합니다. 전에는 file의 directory를
  감시했고, macOS에서 그 event stream은 `fs.watch`가 돌아온 뒤에 시작하므로 대기 시작 직후의 교체를
  잃을 수 있었습니다. 실제 file case는 부하에서 10번 중 5번 실패했고, 이제 20번 모두 통과합니다.

### 2026-10-05 — viewport와 Tailwind 검사의 render case별 test (C2.11)

- `tests/viewport.test.mjs`와 `tests/tailwind-styles.test.mjs`는 각 engine과 폭의 page를 suite의
  setup에서 열고, 432개 공유 render case를 각각 runner의 30초 timeout을 가진 test로 실행합니다. 전에는
  engine과 폭마다 모든 case를 300초나 600초 timeout의 test 하나 안에서 실행하고 시작과 끝만
  출력했습니다.

### 2026-10-05 — log를 남기는 단계의 재현 가능한 build (C2.12)

- `npm run test:build:repeat`는 `scripts/repeat-build.mjs`로 package를 두 번 build합니다. 이는 시간
  한도 없이 log를 남기는 단계로, 각 build 뒤에 공개 package의 모든 산출물 file 경로와 SHA-256을
  기록합니다. `tests/build/reproducible-build.test.mjs`는 두 기록을 서로, 그리고 현재 산출물과 각 test의
  30초 timeout 아래에서 비교합니다. 전에는 막는 `execFileSync`로 두 build를 120초 test case 하나 안에서
  실행했습니다.

### 2026-10-05 — 하나의 pool에서 실행하는 native generator check (C2.8)

- `tests/native-generators/run.mjs`는 어떤 check보다 먼저 build 단계에서 Go와 Rust 프로그램을 한 번
  build하며, build 도구의 출력, 5초마다의 줄과 함께 시간 한도 없이 실행합니다. 300초와 900초의 준비
  예산과 모든 process의 30초 한도는 없앴습니다. probe가 check 예산 안에서 각 PHP 프로그램을
  확인합니다. 모든 target의 check는 하나의 pool에서 `os.availableParallelism()`개씩 실행하며, 각각은
  자기 예산을 가진 하나의 test이고 그 signal은 비동기 context에 둡니다. 각 target의 check 738개가
  차례로 실행되었고 javascript, html, php, php-native target은 요청마다 interpreter를 시작하므로
  suite는 962.5초가 걸렸고 거의 모두 check에 들었습니다. 같은 4428개 check가 이제 199.8초에 통과합니다.

### 2026-10-05 — hook timeout 없는 setup (C2.7-1)

- `scripts/test-progress/hooks.mjs`가 `scripts/test-progress/teardown.mjs`를 대신하며 `setup`을
  더합니다. 이는 timeout이 `Infinity`인 파일, suite, test의 `before` hook으로, launch, start, compile이
  끝나면 끝나고 시작, 5초마다의 줄, 끝을 출력합니다. style, Tailwind, viewport, widget script, form
  inspector, pipeline, record store test의 setup hook이 이를 씁니다. 이 hook들은 60초나 120초 한도,
  browser start 한도, 또는 node:test가 자기 timeout 없는 hook에 주는 30초를 가졌습니다. browser job
  test는 10초나 30초 test 안이 아니라 setup에서 browser를 한 번 launch하고, protocol timeout test가
  필요로 하는 1초 protocol timeout으로 한 번 더 connect합니다. cross-check console
  server와 form binding의 Vitest `beforeAll` hook은 timeout `Infinity`를 가집니다.

### 2026-10-05 — 경과 시간 한도 대신 원인 확인 (C2.9)

- 어떤 test도 경과 시간에 한도를 두지 않습니다. `tests/build/test-commands.test.mjs`는 경과 시간을
  0이 아닌 값과 비교하는 `assert.ok`에서 실패합니다. `tests/build/run-tests.test.mjs`의 runner timeout
  case와 hook case는 끝나지 않는 test나 hook을 event loop를 막지 않는 spawn으로 실행하므로 runner의
  timeout만 그것을 끝냅니다. form comparison의 readiness, health, stop, timeout, stall case는 시험하는
  멈춤으로만 끝나고, 한 stage의 두 step은 서로의 file이 생겨야만 끝나며, 너무 큰 저장은 413과 case
  자신의 timeout에 의존합니다. assertion 10개가 wall-clock 시간을 0.5초에서 20초 사이로 제한했습니다.

### 2026-10-05 — hook timeout 없는 teardown (C2.7)

- `scripts/test-progress/teardown.mjs`의 `teardown`은 browser close, server stop, directory 삭제를
  timeout이 `Infinity`인 파일이나 test의 `after` hook으로 등록합니다. close가 resolve되거나 process가
  종료되면 끝나고, 오류로 파일을 실패시키며, 시작, 5초마다의 줄, 경과 시간과 함께 끝을 출력합니다.
  pipeline browser test, form inspector test, record store test, browser job test, style, viewport,
  Tailwind, widget script test, 문서 server test의 teardown hook이 이를 쓰고, cross-check console
  server와 form binding의 Vitest `afterAll` hook은 timeout `Infinity`를 가집니다. node:test는 자기
  timeout이 없는 hook에 test timeout을 주었으므로, 부하가 있는 기기에서 모든 test가 통과하는 동안
  pipeline test의 server stop이 10초를, inspector test의 browser close가 30초를 넘었습니다.
  `tests/build/teardown.test.mjs`는 1.5초 걸리는 teardown을 1초 test timeout으로 실행합니다.

### 2026-10-05 — 한도 없는 장기 작업의 명령 (C2.3-1)

- `scripts/run-command.mjs`가 `scripts/bounded-command.mjs`를 대신합니다. 명령을 시간 한도 없이
  종료까지 실행하고, 종료 상태를 결과로 삼으며, 명령이 끝나면 그 process group에 남긴 process를
  멈춥니다. 그래서 출력 pipe를 붙잡은 process가 호출자를 붙잡지 못합니다.
  `scripts/require-current-build.mjs`의 package build, `scripts/gen-api-docs.mjs`의 도구,
  `scripts/run-contract-tests.mjs`의 선언된 명령, `tools/bench/run.js`의 driver와 version 조회,
  `tools/bench/build-drivers.mjs`의 driver build에는 600초나 30초 한도가 없고,
  `CRUDUI_COMMAND_LIMIT_SECONDS`는 제거했습니다. `build-drivers.mjs`는 step 줄과 함께 compiler 출력을
  흘립니다. 이전 module과 1초 한도에서는 각 script가 1.2초 뒤에 끝나는 명령에서 실패했습니다.
  `tests/build/run-command.test.mjs`가 `tests/build/bounded-commands.test.mjs`를 대신하며, 남은 자식의
  멈춤을 시간 한도 대신 script 출력의 close로 확인합니다.

### 2026-10-05 — 시간 한도 없는 CI (C2.2-1)

- CI workflow에는 `timeout-minutes`가 없습니다. step은 test를 실행하거나(각 case는
  `scripts/run-tests.mjs`에서 자기 timeout을 가집니다) 장기 작업(checkout, toolchain setup, install,
  build, lint, type check, upload, deployment)을 실행하며, 장기 작업은 log를 출력하고 시간 한도를
  두지 않습니다. 어떤 job도 step 위에 한도를 두지 않습니다. C2.2는 이런 step 84개에 5분이나 10분
  한도를 두었고 `deploy-docs`와 `conformance` job의 한도를 남겼습니다.
  `tests/build/test-commands.test.mjs`는 `timeout-minutes`를 가진 job이나 step에서 실패합니다. 전에는
  test를 실행하지 않는 모든 step에 그것을 요구했습니다.

### 2026-10-05 — timeout 없는 장기 작업 (C2.1-1)

- AGENTS는 장기 작업(build, install, toolchain setup, browser close, server stop, 전체 suite)에
  상세 step log를 두고 timeout을 두지 않으며, 출력 없음 한도도 두지 않습니다. 그 결과와 오류가
  성공과 실패를 정하고, 결과의 event가 작업을 끝냅니다. 각 test case는 자기 timeout을 유지합니다.
  C2.1의 rule은 장기 작업에 자기 timeout에 더해 step log를 두게 해서, 한도보다 오래 걸린 정상
  실행이 실패했습니다.

### 2026-10-05 — 변경 event로 기다리는 build readiness (C2.4)

- `examples/form-comparison/verify-tree.mjs`의 `readyBuild`는 build state file을 시작할 때와 file
  directory의 변경 event(`fs.watch`)마다 읽습니다. 전에는 1초마다 다시 읽었습니다. timer는 inactivity
  한도나 step 한도가 끝나거나 진행 줄을 출력할 때에만 실행됩니다. clock, watch, read는 parameter이고,
  `check-verification.test.mjs`의 readiness test는 20 ms마다 다시 쓰는 file과 wall-clock 한도 대신
  명시적인 event와 fake clock으로 상태를 바꿉니다. event loop를 400 ms마다 350 ms씩 막으면 이전 case는
  실패했고 새 case는 통과합니다.

### 2026-10-05 — driver test에서 build된 benchmark driver 실행 (C2.3)

- `npm run test:bench`는 package를 build한 뒤 `tools/bench/build-drivers.mjs`로 Go와 Rust benchmark
  driver를 build합니다. 이 script는 각 build를 경과 시간과 함께 출력하고 600초에서 process group째
  멈춥니다. `tests/build/bench-drivers.test.mjs`는 build된 driver(`tools/bench/drivers.mjs`가 이름을
  정합니다)를 실행하고 각 test는 test runner의 30초 timeout을 가집니다. 전에는 accepted case가 600초
  timeout 아래에서 `go run`과 `cargo run`으로 driver를 compile했습니다. `tests/build/test-commands.test.mjs`는
  test가 자기 timeout을 두거나 `run`으로 driver를 실행하면 실패하고, `tests/build/bounded-commands.test.mjs`는
  끝나지 않는 driver build를 한도에서 멈춥니다.

### 2026-10-05 — setup step에만 두는 CI 시간 한도 (C2.2)

- test를 실행하는 CI job과 step에는 `timeout-minutes`가 없습니다. test runner가 각 test를
  제한합니다. 그런 job의 다른 step(checkout, toolchain, install, build, upload)은 5분이나 10분 한도를
  가지고, test가 없는 job은 job 한도를 유지합니다. `tests/build/test-commands.test.mjs`는 npm script,
  Composer script, Makefile 대상을 따라가 test를 실행하는 step을 찾고 그 위의 한도에서 실패합니다. 전에는
  job 한도를 요구했고, case를 더했을 때 13개 job을 나열했습니다. `test:form-comparison:pipeline`은 build를
  제한하는 `scripts/require-current-build.mjs`로 build합니다.

### 2026-10-05 — test runner의 PHPUnit 개수 (C2.5)

- `scripts/run-tests.mjs`의 PHPUnit mode는 test만 셉니다. `testSuiteFinished` message에는
  location이 없어서 test class나 data provider method의 끝이 통과한 test로 세어졌습니다.
  validator-php 실행은 PHPUnit이 763개를 실행했는데 804 passed를 보고했고, 이제 763을 보고합니다.
  `Test file "..." not found`나 warning을 담은 요약처럼 TeamCity message가 아닌 줄을 출력합니다. 전에는
  버려졌습니다. `tests/build/run-tests.test.mjs`는 변경 전에 두 가지 모두에서 실패했습니다.

### 2026-10-05 — 저장소의 test rule (C2.1)

- AGENTS는 작업을 개발하는 동안 바뀐 것을 소유한 Red와 Green test만 실행하고, full suite는
  checklist의 활성 작업이 모두 끝났을 때 정확히 한 번 실행합니다. 전에는 feature가 끝날 때마다
  full suite를 실행했습니다. 긴 작업은 자기 timeout에 더해 step log를 출력합니다. 전에는 step log가
  timeout을 대신했습니다. `make docs-check`는 문서나 공개 API 문서가 바뀌었을 때만 실행하고,
  checklist의 Verification 열은 작업을 소유한 명령을 적습니다. checklist에 wave 2를 적었습니다.

### 2026-10-04 — Tailwind 버전의 export (C1.5)

- `@crudui/generator-core`는 `./crudui.tailwind.css`를 export합니다. feature status에
  `viewport-widths`와 `tailwind-styles`를 적고, operations 문서에 viewport test와 Tailwind test, 그리고
  `crudui.css`를 바꾼 뒤의 재생성을 적었습니다. full suite(`make ci`)가 통과합니다. 첫 실행은 새 test와
  script에서 `npm run lint`와 `npm run test:runtimes`가 실패했고, C1.4-1이 고쳤습니다.

### 2026-10-04 — style의 Tailwind 버전 (C1.4)

- `packages/generator-core/styles/crudui.tailwind.css`는 `crudui.css`의 rule을 cascade layer
  `components`에 담습니다. `packages/generator-core/scripts/write-tailwind-styles.mjs`가 이 file을 쓰고,
  `npm run test:forms`에 들어 있는 그 `--check` mode는 커밋된 file이 다르면 실패합니다. file이 없을 때
  실패했습니다. `tests/tailwind-styles.test.mjs`는 이 file을 Tailwind CSS 4.3.3의 theme과 utility로
  compile하고, 공유 render case 432개를 Chromium, Firefox, WebKit에서 360과 1280 px로 열어 computed
  style을 `crudui.css`와 비교합니다. 다른 element는 없습니다. file이 없을 때는 `Can't resolve`로
  실패했습니다. Tailwind CSS와 `@tailwindcss/node` 4.3.3은 저장소의 development dependency입니다.

### 2026-10-04 — Tailwind 버전의 명세 (C1.3)

- form markup contract에 `crudui.tailwind.css`를 명세했습니다. `crudui.css`의 rule을 Tailwind CSS 4의
  cascade layer `components`에 담고, `crudui.css`에서 생성하고 그것과 대조하며, 360과 1280 px에서
  `crudui.css`와 같은 computed style을 줍니다. 작업은 처음에 `@apply`로 쓴 두 번째 stylesheet를
  요구했는데, 손으로 쓴 rule 두 벌은 서로 어긋날 수 있으므로 고쳤습니다. file은 아직 구현되지
  않았습니다(C1.4).

### 2026-10-04 — 좁은 viewport에 맞는 list (C1.2)

- `.crudui-list`는 스스로 가로로 scroll하므로, 긴 숫자를 담은 list case `format-number-shortest`처럼
  viewport보다 넓은 table이 더 이상 page를 넓히지 않습니다. 360 CSS pixel에서 그 case는 Chromium,
  Firefox, WebKit에서 문서를 408~428 px로 넓혔습니다. `tests/viewport.test.mjs`는 공유 render fixture의
  case 432개의 expected HTML을 `crudui.css`가 있는 page에 두고 세 engine에서 360과 1280 px로 열어,
  문서의 가로 overflow가 없고 모든 control과 action이 viewport 안에 있는지 확인합니다. 변경 전에는 그
  case에서 실패했습니다.

### 2026-10-04 — stylesheet의 viewport 폭 (C1.1)

- form markup contract에 `crudui.css`의 viewport 폭을 적었습니다. 360과 1280 CSS pixel에서 모든 공유
  render fixture의 expected HTML은 문서의 가로 overflow를 만들지 않고, 스스로 가로로 scroll하는
  element 안을 빼면 모든 control과 action이 viewport 안에 있습니다. stylesheet에는 좁은 viewport를 위한
  rule이 없었습니다.

### 2026-10-04 — Svelte 렌더러의 NodeNext 선언

- `@crudui/generator-svelte`는 `"type": "module"`을 선언하지만 공개 타입 테스트
  (`tests/build/public-packages.test.mjs`)가 이 패키지를 컴파일하지 않았습니다. 이제 테스트는 ES 모듈
  fixture에서 이 패키지가 ES 모듈 형식의 `dist/index.d.ts`로 해석되는지 검사하고, ES 모듈
  fixture(`tests/build/public-types.mts`)에서 `Form`과 `renderForm`을 컴파일합니다. 테스트의 컴파일러
  호스트는 Svelte 도구처럼 `.svelte` 파일 import를 그 옆의 `.svelte.d.ts` 선언으로 해석합니다.
- 확장한 테스트는 `./widget`을 import하는 `dist/components/Widget.svelte.d.ts`에서
  `TS2835: Relative import paths need explicit file extensions in ECMAScript imports` 오류로
  실패했습니다. 이제 패키지의 `.svelte`·`.ts` 소스 파일의 상대 import는 `.js` 파일을 가리킵니다.
  게시되는 JavaScript·Svelte 파일은 이 import 경로만 다릅니다.

### 2026-10-04 — Vue 렌더러의 NodeNext 선언

- `@crudui/generator-vue`는 `"type": "module"`을 선언하므로 TypeScript는 선언을 ES 모듈로 읽지만,
  선언의 상대 import에 파일 확장자가 없었습니다. 엄격한 `NodeNext` 프로젝트는 `dist/index.d.ts`에서
  `TS2834: Relative import paths need explicit file extensions in ECMAScript imports` 오류로
  실패했습니다. 공개 타입 테스트(`tests/build/public-packages.test.mjs`)가 이 패키지를 컴파일하지
  않았으므로 어떤 검사도 이 오류를 보고하지 않았습니다.
- 이제 테스트는 ES 모듈 fixture에서 이 패키지가 ES 모듈 형식의 `dist/index.d.ts`로 해석되는지
  검사하고, ES 모듈 fixture(`tests/build/public-types.mts`)와 CommonJS fixture
  (`tests/build/public-types.cts`)에서 `Form`, `renderForm`, `AnyWidget`을 컴파일합니다. 패키지
  소스의 상대 import는 이제 `.js` 파일을 가리킵니다. `import`·`require` export의 JavaScript 출력은
  변경 전 출력과 바이트 단위로 같습니다.

### 2026-10-04 — 브라우저 검증 바인딩의 릴리스 검사

- 패키지 설치 검사(`scripts/check-packages.mjs`), 공개 패키지 테스트
  (`tests/build/public-packages.test.mjs`), 재현 가능한 빌드 테스트
  (`tests/build/reproducible-build.test.mjs`)에 `@crudui/form-binding`이 없었으므로 릴리스가 이
  패키지를 패키징, 설치, 타입 검사, 재빌드하지 않았습니다. 설치 검사와 재현 가능한 빌드 테스트는
  패키지 목록이 `contracts/features.json`의 패키지와 다르면 실패하며, 두 검사 모두 이 패키지를
  포함합니다. 설치 프로젝트는 `bindForm`을 import해 `renderForm`이 렌더링한 폼을 연결하고, 브라우저
  검사는 빈 폼을 제출해 필수 입력 오류와 컨트롤의 포커스를 요구합니다.
- 공개 패키지 테스트에서 Node.js에는 CommonJS 진입점이 없는데도 TypeScript가 CommonJS 프로젝트에 이
  패키지의 선언을 해석하고, ES 모듈의 선언이 CommonJS 형식이라는 결함이 드러났습니다. 이제 패키지는
  `"type": "module"`과 타입을 포함한 `import` export만 선언하고, 상대 import는 `.js` 파일을 가리키므로
  ES 모듈 선언이 `NodeNext`에서 해석됩니다. 테스트는 import export가 `dist`에서 계약의 export로
  로드되는지 요구하고, Node.js와 TypeScript의 CommonJS 해석을 거부하며, ES 모듈 설치 fixture에서
  `bindForm`의 타입을 검사합니다.
- 선언 빌드 테스트는 이제 `tsconfig.build.json`이 있는 모든 게시 패키지를 다루고 하나라도 빠지면
  실패합니다. `@crudui/form-binding`과, 같은 선언 빌드를 가졌지만 검사되지 않던
  `@crudui/generator-html`을 추가합니다.
- 바인딩의 브라우저 검사(`packages/form-binding/tests/browser.test.ts`)는 Chromium에서만 실행되었고,
  다른 브라우저 검사는 Chromium, Firefox, WebKit에서 실행됩니다. 이제 같은 사례를
  `tests/browser-engines.mjs`로 세 엔진에서 실행하고, 타입은 `tests/browser-engines.d.mts`가
  제공합니다. Puppeteer에는 Playwright 라우트가 없으므로 로컬 HTTP 서버가 페이지를 제공하고 각 제출을
  기록합니다. 사례는 세 엔진에서 통과합니다. CI는 어떤 검사도 쓰지 않는 Playwright Chromium을 더 이상
  설치하지 않고, 패키지는 `playwright`를 더 이상 선언하지 않습니다.

### 2026-10-04 — 서버가 렌더링한 폼의 브라우저 검증

- `@crudui/form-binding`(`packages/form-binding`)은 서버가 렌더링한 완전한 폼을 서버가 검증할 때 쓰는
  스펙으로 브라우저에서 검증합니다. 서버에서 렌더링한 폼은 요청 뒤에만 검증되었으므로 사용자는 왕복이
  끝난 뒤에야 오류를 보았습니다.
- `bindForm(form, spec, options)`는 네이티브 제출이 보내고 서버가 디코딩하는 대로 폼 노드 안의 이름
  있는 컨트롤에서 데이터를 만듭니다. 값은 문자열이고 줄바꿈은 CRLF이며, `[]` 이름은 목록, 행은 행
  키를 키로 가지며, 선택되지 않은 체크박스, 비어 있는 선택지, 선택된 옵션이 없는 select, 행이 없는
  컬렉션은 멤버가 없습니다. 파일, 비활성, 노드 밖 컨트롤은 참여하지 않으며, 파일 컨트롤을 담은 노드의
  오류는 서버에 맡깁니다.
- 바뀐 노드는 컨트롤이 포커스를 잃을 때와 그 뒤의 모든 변경에서, 폼 전체는 제출할 때와 `validate()`
  호출에서 검증합니다. 같은 오류에 대해 `renderForm`이 쓰는 `crudui-node__errors`와
  `crudui-form__errors` 마크업을 쓰고, 서버가 렌더링한 오류는 그 노드를 처음 검증할 때 교체하며, 쓴
  노드의 컨트롤에 `aria-invalid`를 설정하고 제거합니다. `novalidate`를 설정하므로 브라우저의 제약
  검증이 먼저 제출을 멈추지 않습니다.
- 유효하지 않은 제출은 window의 캡처 단계에서 `preventDefault()`와 `stopImmediatePropagation()`으로
  취소되므로 htmx 같은 다른 submit 리스너가 요청을 보내지 않으며, 포커스는 첫 번째 유효하지 않은
  컨트롤로 옮겨 갑니다. `options.message`와 `options.formErrors`가 문구를 제공합니다.
- 스펙은 [폼 런타임](docs/spec/form-runtime.ko.md#브라우저-검증)에서 바인딩을 정의하고,
  [폼 마크업](docs/spec/form-markup.ko.md#클래스-이름)은 클래스 예외 하나를 기록합니다. 바인딩은 오류
  슬롯을 네 클래스로 찾고, 소스가 다른 클래스를 가리키면 패키지 테스트가 실패합니다.
- 패키지 테스트는 `make test-form-binding`과 `npm run test:forms`로 실행합니다. jsdom에서 모든 컨트롤
  종류의 데이터 수집, 시점, 제출, 포커스, `aria-invalid`, 옵션을 검사하고, 공유 검증 고정 데이터의
  유효하지 않은 사례 59개의 오류 마크업이 `renderForm`의 마크업과 같은지 검사하며, Playwright로
  Chromium에서 바뀐 필드를 벗어난 뒤 오류를 보이고 유효하지 않은 제출은 요청을 보내지 않으며 고친
  폼은 제출하는지 검사합니다. CI는 WebKit과 함께 Playwright Chromium을 설치합니다.

### 2026-10-04 — 선택지 그룹

- `select`, `dropdown`, `selectbox` 필드의 선택 목록은 레이블과 하나 이상의 값·레이블 쌍으로 이루어진
  그룹을 일반 선택지와 함께 쓴 순서대로 담을 수 있습니다. 요소에 `value`나 `choices` 멤버가 있으면 선택
  목록입니다. 값은 목록 전체에서 서로 다르며, 바인딩은 빈 그룹, 다른 멤버, 중첩 그룹, 모양 멤버, 다른
  필드의 그룹을 거부하고, `choice-label` 형식은 그룹을 거부합니다.
- 그룹 안의 옵션 모델은 `items`에서의 그룹 위치와 번역한 레이블을 담은 `group` 멤버를 가집니다. 모든
  렌더러는 그룹의 선택지를 `optgroup` 요소 안에 쓰며, behavior 속성이 있는 select의 raw 경로에서도
  같습니다.
- TypeScript, PHP, PHP extension, Go, Rust 검증기의 `in` 규칙은 그룹 안의 값을 멤버로 받고 잘못된
  그룹을 `INVALID_RULE_PARAMETER`로 거부합니다.
- React, Vue, Svelte, HTML 렌더러, PHP, PHP extension, Go, Rust는 공유 폼 case `choice-groups-*`와 목록
  case `reject-format-items-choice-group`을 통과하고, 검증기 다섯 개는 공유 검증 case
  `value-in-choice-groups*`를 통과합니다. PHP extension engine test는 현재 고정 데이터 수를 세고 engine
  프로그램이 쓰는 단위를 링크합니다.

### 2026-10-04 — 선택지 모양

- `choice`나 `multichoice` 필드의 선택 목록에 있는 선택지는 선언 속성 규칙에 따라 레이블의 `class`와
  `style`, input의 `attributes`를 선언할 수 있고, 필드의 `design.group`은 `crudui-choices` 요소에
  적용됩니다. 바인딩은 다른 필드의 선택 목록에 있는 이 멤버, 문자열이 아닌 class나 style, 규칙을 어긴
  attributes를 `INVALID_FORM_INPUT`으로 거부합니다.
- 옵션 모델은 `id` 뒤에 `className`, `style`, `attributes`를 가집니다. 모든 렌더러는 선택지 class를
  레이블 class 뒤에 공백 하나로 구분한 토큰으로, style을 레이블에, attributes를 필드 컨트롤 속성 뒤에
  쓰며, 양쪽에 선언한 이름은 필드 속성의 위치를 유지하고 선택지의 값을 가집니다.
- React, Vue, Svelte, HTML 렌더러, PHP, PHP extension, Go, Rust는 공유 폼 case `choice-appearance-*`에서
  모양을 쓰고 작성된 모양 case 아홉 개를 거부합니다.

### 2026-10-04 — range 필드

- `range` 필드는 `crudui-widget crudui-widget--range` widget을 렌더링합니다. prepend affix, 리터럴
  `validate.range`와 `validate.step`에서 온 `min`, `max`, `step`을 가진 range input, 현재 값을 보이는
  `crudui-widget__output` output, 단위인 append affix로 이루어집니다. `compileForm`은 두 규칙이 리터럴
  값이고 최솟값이 step의 배수이기를 `step` 규칙과 같은 정확한 판정으로 요구하며, 그렇지 않으면
  `INVALID_FORM_INPUT`으로 실패합니다.
- 검증기는 range 필드를 `range`와 `step` 규칙으로 검사합니다.
- React, Vue, Svelte, HTML 렌더러, PHP, PHP extension, Go, Rust는 공유 폼 case `range-*`에서 range
  widget을 쓰고 작성된 range case 여덟 개를 거부하며, TypeScript, PHP, PHP extension, Go, Rust 검증기는
  공유 검증 case `range-field-values`를 통과합니다.

### 2026-10-04 — inline 배치와 line 배치

- group은 `design.layout`을 선언합니다. `inline`은 그 안의 모든 필드 노드를 `--crudui-label-width`
  레이블 열과 컨트롤, 설명, 오류를 담는 컨트롤 열의 한 줄로 만들고, `line`은 group의 자식 노드를 나란히
  두며, `stacked`는 물려받은 inline 배치를 끝냅니다. 선언이 없는 group은 감싸는 group의 배치를
  물려받고, 반복 group은 행의 필드에 `inline`을 적용합니다. `compileForm`은 다른 필드, 폼 버튼, 폼 루트의
  멤버, 다른 값, 반복 group의 `line`을 `INVALID_FORM_INPUT`으로 거부합니다.
- 노드 모델은 루트 class 앞에 `crudui-node--inline`과 `crudui-node--line`을 씁니다. inline 배치에서
  레이블이 있는 checkbox나 switcher 필드는 레이블을 헤더에 쓰고 본문에는 input만 둡니다.
- React, Vue, Svelte, HTML 렌더러, PHP, PHP extension, Go, Rust는 공유 폼 case `inline-layout-*`에서
  배치를 쓰고 작성된 배치 case 여섯 개를 거부합니다. PHP, Go, Rust 검증기의 타입 명세 모델이
  `design.layout`을 받습니다.

### 2026-10-04 — 컨트롤과 노드의 선언 속성

- 폼 필드는 `design.attributes`로 컨트롤의 `data-*`, `aria-*` 속성을, `design.wrapper.attributes`로 노드
  루트의 속성을 선언합니다. `compileForm`은 객체가 아닌 값, 규칙 밖이거나 CRUDUI가 쓰는 이름, 문자열이
  아닌 값을 `INVALID_FORM_INPUT`으로 거부하며, 폼 버튼, 목록, 상세와 label, group, prepend 노드는 이
  멤버를 알 수 없는 키로 거부합니다.
- 노드 모델은 `style` 뒤에 wrapper 속성을, checkbox 모델은 `caption` 뒤에 속성을 가지며, widget 모델은
  컨트롤 속성을 `attrs`나 file 레이아웃의 `extra.file`에 덧붙이거나 choices 레이아웃의 `extra.option`에
  둡니다. 모든 렌더러는 CRUDUI가 쓰는 속성 뒤에 React 서버 렌더링의 배치로 이를 씁니다.
- React, Vue, Svelte, HTML 렌더러, PHP, PHP extension, Go, Rust는 공유 폼 case `control-attributes-*`에서
  이를 씁니다. JSON Schema, TypeScript 타입, PHP, Go, Rust 검증기의 타입 명세 모델이 선언을 받습니다.

### 2026-10-04 — button 필드는 button으로 렌더링됨

- `button` 또는 `action` 필드는 `type="button"`, class `crudui-action crudui-action--text`와
  `design.class` class, `design.style` style, 컨트롤 id, behavior event 속성, 선언 속성, 그리고
  escape한 `content` 텍스트를 가진 `button` 요소 하나를 렌더링합니다. behavior `onclick` 스크립트는
  button의 `onclick` 속성입니다. 필드는 jQuery click 스크립트, hidden input, `name`을 쓰지 않으며 값을
  제출하지 않습니다.
- widget 모델은 tag `button`과 내용 `text`를 가지며, `buttonText` 멤버와 `init_script` option은
  제거되었습니다.
- 스타일시트는 button을 내용만큼 넓고 다른 컨트롤만큼 높게 만듭니다.
- React, Vue, Svelte, HTML 렌더러, PHP, PHP extension, Go, Rust는 공유 폼 case `button-empty`,
  `action-alias`, `button-behavior-onclick`, `control-attributes-file-display-button`에서 button을
  씁니다.

### 2026-10-04 — switcher 필드는 스위치로 렌더링됨

- `switcher` 필드는 스위치를 렌더링합니다. checkbox 모델은 `checked` 뒤에 `role: "switch"`를 갖고, 컨트롤
  class는 `design.class` class 앞에 `valid-target crudui-input crudui-input--switch`를 가지며, 모든
  렌더러는 `type="checkbox"` 뒤에 `role="switch"`를, `role` 뒤에 선언 속성을 씁니다. input은 체크 상자로
  제출되고 바인딩됩니다. `checkbox` 필드의 마크업은 그대로입니다.
- 스타일시트는 accent, border, subtle, surface 속성으로 스위치를 둥근 thumb가 있는 track으로 그리며,
  Chromium, Firefox, WebKit에서 측정합니다.
- React, Vue, Svelte, HTML 렌더러, PHP, PHP extension, Go, Rust는 공유 폼 case `switcher-bare`와
  `control-attributes-checkbox`에서 스위치를 씁니다.

### 2026-10-02 — 스크립트 동작은 click에서 실행됨

- 목록과 상세의 스크립트 동작은 스크립트를 button의 `onclick`에 쓰므로, button을 누르면 스크립트가
  실행됩니다. 이전에는 스크립트를 `on{name}`에 썼습니다. 예를 들어 동작 `remove`는 button이 발생시키지
  않는 event인 `onremove`에 썼으므로 스크립트가 실행되지 않았습니다. 동작 모델은
  `{ key, label, behavior: { onclick: script } }`입니다.
- React, Vue, Svelte, HTML 렌더러, PHP, PHP extension, Go, Rust는 공유 목록 case `actions-toolbar`,
  `action-script-object`와 상세 case `actions`에서 `onclick`을 씁니다.
- `tests/widget-script-runs.test.mjs`는 Chromium, Firefox, WebKit에서 HTML, React, Vue, Svelte 렌더러를
  브라우저에서 렌더링한 경우와 서버에서 렌더링한 뒤 하이드레이션한 경우에 목록 스크립트 동작을 두 번
  누르고, 누를 때마다 스크립트가 한 번 실행되기를 요구합니다.

### 2026-10-02 — hook 실패는 파일과 함께 출력됨

- test runner는 실패하거나 제한 시간을 넘긴 hook을 포함해 `node --test`와 Vitest 실행의 모든 실패를
  test 파일과 경과 시간과 함께 출력합니다. `node --test`는 파일의 제한 시간을 넘긴 after hook을 테스트
  완료 없이 실패로만 보고하므로, reporter는 모든 테스트를 통과로, 요약을 통과로 출력했고 도구는 1로
  끝났습니다.
- `node --test`에서 파일의 실패한 hook은 원인과 함께 `{file} › hook`으로 출력되고, 그 파일은 실패로
  출력됩니다. Vitest에서 각 suite는 group이므로 suite의 실패한 hook은 원인과 함께 suite 줄에
  출력되며, hook 오류는 제한 시간을 넘긴 hook의 stack에 없는 message와 함께 출력됩니다.
- 요약 줄은 실패한 group을 표시합니다. 예: `2 passed, 0 failed, 0 timed out, 0 skipped,
  3 groups failed`.
- `npm run test:runtimes`가 실행하는 `tests/build/run-tests.test.mjs`는 `node --test`에서 파일의
  제한 시간을 넘긴 after hook을, Vitest에서 파일과 suite의 제한 시간을 넘긴 after hook을 실행합니다.

### 2026-10-02 — 선형 시간 검사는 시계를 읽지 않음

- validator와 PHP extension engine의 선형 시간 검사는 시계를 읽지 않습니다. 이 검사들은 경과 시간을
  제한값이나 서로와 비교하여 기계의 load average가 28에서 38일 때 실패하고 단독으로는 통과했으며,
  `make conformance`와 `make ci`가 한 번의 전체 실행에서 상태 0으로 끝나지 않았습니다.
- JavaScript 검사는 읽기를 셉니다. 각 행 값과 반복 값의 getter는 같은 값이 열 개 중에 있을 때의
  읽기 수를 넘는 읽기에서 실패하고, 세는 `codePointAt`은 텍스트 위치를 두 번째로 읽으면 실패합니다.
  PHP, Go, Rust 검사와 PHP extension engine fixture는 선형 구현이 몇 초 안에 끝내고 이차 시간이나
  지수 시간 구현이 테스트 제한 시간 안에 끝내지 못하는 입력을 검증, 해석, 매칭, 정렬합니다. 규칙
  대신 `serde_json::to_value`를 측정하던 Rust test는 제거했습니다.
- validator와 generator package의 PHPUnit은 자체 시간 제한을 두지 않으므로 test runner의 30초 제한
  시간이 PHP 테스트의 유일한 제한입니다.
- `npm run test:runtimes`가 실행하는 `tests/build/validator-test-clocks.test.mjs`는 validator
  테스트나 PHP extension engine fixture가 시계를 읽으면 실패합니다.
- request generator 500개를 배포 규모 작업 없이 생성하는지 확인하는 form comparison 검사는 경과 시간을
  250 ms와 비교하여 부하에서 994 ms로 실패했습니다. 이제 PHP process의 10초 제한 안에 끝나기를
  요구합니다.
- PHP extension engine test의 budget은 30초와 60초 대신 120초, sanitizer를 쓰면 300초입니다. values
  fixture는 load average 45에서 23.7초가 걸렸고, sanitizer 실행은 load average 107에서 54초 안에
  끝나지 않았습니다.
- stylesheet layout 검사는 세 browser를 120초 hook 제한 안에 닫습니다. load average 100에서 닫기가
  기본 제한 30초를 넘어 61개 검사가 모두 통과한 뒤 `npm run test:forms`가 실패했습니다.

### 2026-10-02 — 동작 behavior 멤버는 event attribute

- 목록과 상세 동작은 선언한 `behavior` 멤버를 각각 같은 이름의 attribute로 씁니다.
  `behavior.onclick`은 `onclick`을 씁니다. 모든 renderer가 멤버 이름 앞에 `on`을 붙여
  `behavior: { onclick: … }`가 어떤 브라우저도 실행하지 않는 `ononclick`을 썼습니다.
- 동작 모델은 각 `behavior` 키로 event attribute 이름을 가집니다. 스크립트 동작은 스크립트를
  `on{name}` 아래에 두므로 이전과 같은 `on{name}` attribute를 쓰며, 모델 키는 `{name}` 대신
  `on{name}`입니다.
- React, Vue, Svelte, HTML renderer, PHP, PHP extension, Go, Rust가 문자열 항목과 객체 항목을 가진
  링크와 버튼의 공유 목록·상세 case `action-behavior-events`를 렌더합니다.

### 2026-10-02 — 폼과 목록의 설명, 상세 동작

- `crudui-form` 블록은 번역한 루트 `description`을 폼 오류와 본문 앞의
  `<p class="crudui-form__description">`으로 씁니다. 폼 루트는 `description`을 받았지만 어떤 렌더러도
  쓰지 않아 선언한 설명이 표시되지 않았습니다. 컴파일한 템플릿은 선언한 값을 선택 항목인 마지막 멤버
  `description`으로 유지하고, 모든 템플릿 형태 검사가 이를 받으며, `formDescription(template, options)`가
  번역한 텍스트를 반환하고, `renderFormView`가 이를 다섯 번째 인수로 받습니다. 설명이 없거나 비어 있으면
  아무것도 쓰지 않습니다.
- 목록은 `description` 콘텐츠를 선언합니다. 목록 모델은 `empty` 뒤에 번역한 `description`을 가지며,
  비어 있지 않은 설명은 `crudui-list`의 첫 자식으로 동작 앞의 `crudui-list__description` 문단입니다.
  검사는 `empty` 뒤, `pagination` 앞에 실행하며 `Invalid description at list: expected a string, a
  language map or null`로 실패합니다.
- 상세는 목록 동작 규칙과 모델로 `actions`를 선언하며, 메시지에서 목록의 `list` 자리에 `detail`을
  씁니다. 상세 모델은 `{ fields, actions, design }`이고, 동작이 있는 상세는 이미지 preload 링크 뒤,
  `dl.crudui-detail` 요소 앞에 동작마다 `crudui-detail__action` 하나를 담은 `crudui-detail__actions`를
  씁니다. 동작이 없는 상세는 이전과 같은 마크업을 씁니다.
- JSON Schema가 목록 `description`과 상세 `actions`를 받고, 스타일시트가 새 요소의 스타일을 정하며,
  React, Vue, Svelte, HTML renderer, PHP, PHP 확장, Go, Rust가 공유 폼, 완전한 폼, 목록, 상세 사례를
  렌더링합니다.

### 2026-10-02 — 선택 목록이 작성한 순서를 유지

- `items`는 값에 관계없이 목록 순서를 유지하는 `{ "value": …, "label": … }` 객체의 배열인 선택 목록을
  받습니다. 값과 라벨의 맵은 정수 형태의 값을 오름차순으로 먼저 나열하므로 `{ "1": "Yes", "0": "No" }`가
  No를 Yes보다 먼저 보여 주었고, 숫자 값을 가진 선택지는 작성한 순서를 유지할 수 없었습니다. 맵과 라벨의
  배열은 의미를 유지하며, 스키마 계약은 어떤 순서에 어떤 형식을 쓰는지 정합니다.
- 원소 중 하나가 `value` 멤버가 있는 객체인 `items` 배열은 선택 목록입니다. 이때 모든 원소는 `value`와
  `label`만 가지고, 모든 값은 문자열이나 유한한 숫자이며, 정규 텍스트가 같은 값이 둘 없어야 합니다. 규칙을
  어긴 선택 목록을 가진 필드를 바인딩하면 `INVALID_FORM_INPUT`과 `Invalid items at {path}: expected value
  and label pairs with distinct string or number values`로 실패합니다. `choice-label` 형식은
  `format.items`에 같은 텍스트로 실패하고, `in`은 `INVALID_RULE_PARAMETER`와 `Invalid in parameter:
  expected value and label pairs with distinct string or number values`로 실패합니다.
- select, choice, multichoice, search 필드는 쌍을 목록 순서대로 나열하고, dummy 필드와 `choice-label`
  형식은 값의 라벨을 표시하며, `in`은 값을 멤버로 받으므로 필드는 같은 선택 목록을 `items`와 `in`에
  선언합니다. JSON Schema가 `ChoiceList`를 정의하고 `crudui explain`이 쌍을 목록 순서대로 나열합니다.
- HTML renderer, React, Vue, Svelte, PHP, PHP 확장, Go, Rust가 공유 선택 목록 사례를 렌더링하고,
  JavaScript, PHP, PHP 확장, Go, Rust가 이를 검증합니다.

### 2026-10-02 — 폼 연결이 정규화한 기본값과 비교

- `connectForm`은 텍스트 컨트롤을 브라우저가 값처럼 정규화한 렌더 기본값과 비교합니다. Chromium은
  datetime 기본값 `2026-09-09T00:00:00`을 `2026-09-09T00:00`으로 읽으므로 연결이 이런 컨트롤을 모두
  편집으로 읽고 인스턴스 값을 브라우저 형태로 바꿨습니다.
- 위젯 스크립트 검사의 브라우저 시간대 사례가 Chromium에서 이를 검사합니다.

### 2026-10-02 — renderForm이 완전한 폼을 씀

- `renderForm(form, options)`는 서버가 보내는 완전한 폼을 쓰므로 서버는 폼의 어떤 부분도 직접
  쓰지 않습니다. `options.action`은 옵션이나 템플릿 `action`에서 가져온 `action`, `encType`, `method`를
  가진 `form` 요소를 추가합니다. `options.hidden`은 그 안에, `connectForm`이 동기화하는 `crudui-form`
  요소 밖에 숨은 input을 추가합니다. `options.formErrors`는 본문 앞에 `crudui-form__errors` 요소를
  추가합니다. `options.errors`는 각 메시지를 해당 데이터 경로를 가진 노드의 본문 뒤
  `crudui-node__errors` 슬롯에 두며 검증 결과 오류를 그대로 받습니다. 계약 밖의 옵션은
  `INVALID_FORM_INPUT`으로 실패합니다. 옵션이 없으면 이전처럼 `crudui-form` 블록을 씁니다.
- JavaScript(`@crudui/generator-html`, `Form`에 `options` 속성을 가진 React·Vue·Svelte), PHP
  (`Generator::renderForm($form, $options)`), PHP 확장, Go(`RenderForm(form, options)`), Rust
  (`render_form(&form, options)`)가 같은 마크업을 씁니다. Go와 Rust 호출자는 `crudui-form` 블록만
  쓸 때 `nil`이나 `None`을 전달합니다.
- 스타일시트가 새 `--crudui-error` 속성으로 오류에 색을 입힙니다.
- 공유 완전한 폼 사례를 React, HTML renderer, PHP, PHP 확장, Go, Rust에서 바이트 단위로, Vue와
  Svelte에서 정규화 뒤에 비교합니다.

### 2026-10-02 — 단일 선택 필드가 목록을 거부

- `lang`이 없는 `select`, `dropdown`, `selectbox`, `choice`, `radio` 형식의 필드는 값 하나를 가집니다.
  그 데이터나 반복 필드의 행이 배열이나 객체이면 숨긴 필드도 포함해 검증이 `INVALID_FORM_INPUT`과
  `Choice data must be a single value: {path}`로 실패합니다. 이전에는 `["q", "r"]` 같은 목록을 받아
  각 원소에 `in`을 검사했으므로 제출한 목록이 단일 선택으로 통과했습니다.
- JavaScript, PHP, PHP 확장, Go, Rust가 공유하는 목록, 빈 목록, 객체, 숨긴 필드, 반복 행, 그룹 행,
  선언 순서, 허용 값 사례를 실행합니다.

### 2026-10-02 — 빈 포함 목록은 어떤 값도 허용하지 않음

- 빈 목록이나 빈 맵을 가진 `in` 규칙은 유효하며 어떤 값과도 일치하지 않습니다. 그래서 선택 목록이 빈
  필드는 빈 값을 통과시키고 그 밖의 모든 값을 실패시킵니다. 이전에는 이 규칙이 `INVALID_RULE_PARAMETER`로
  로드에 실패해 그런 필드를 검사할 수 없었습니다. 공백뿐인 문자열과 빈 멤버는 계속 매개변수 오류입니다.
- JSON Schema가 빈 `in` 목록과 맵을 받습니다.
- JavaScript, PHP, PHP 확장, Go, Rust가 공유하는 빈 목록, 빈 맵, 필수 입력 사례를 실행합니다.

### 2026-10-01 — 폼 연결 전에 입력한 값을 유지

- `connectForm`은 control을 동기화하기 전에 렌더된 기본값과 다른 control을 읽습니다. 그래서
  클라이언트가 폼을 연결하기 전에 방문자가 서버 markup에 입력한 값이 control과 폼 세션에 남습니다.
- HTML renderer 폼 세션 사례가 연결 전에 서버 markup에 텍스트를 입력하고 control과 세션 값을
  검증합니다.

### 2026-09-26 — React 컴포넌트와 서버 진입점의 export 분리

- `@crudui/generator-react`는 `react-dom/server`를 불러오지 않고 React 컴포넌트를 내보냅니다.
  `@crudui/generator-react/server`는 문자열 렌더링 함수 `renderForm`, `renderList`, `renderDetail`을
  내보냅니다. 컴포넌트 진입점은 이 함수를 내보내지 않습니다.
- React 패키지 사례와 설치된 패키지 검사는 두 진입점 및 CJS·ESM export를 검증합니다.

### 2026-09-26 — Rust 검증기가 라이선스를 선언

- Rust 검증기 매니페스트가 프로젝트에서 선언한 MIT 라이선스를 명시해 의존성 라이선스 검사가
  검증기의 라이선스를 직접 읽을 수 있습니다.

### 2026-09-26 — 폼 검증이 선언되지 않은 제출 필드를 거부

- 루트·그룹·반복 그룹 행 데이터에 선언된 필드가 없는 멤버가 있으면 폼 검증은
  `INVALID_FORM_INPUT`으로 실패합니다. 해당 객체에서 코드 포인트 순서의 첫 미선언 멤버를
  보고합니다. 공유 사례의 조건 입력은 필드로 선언합니다.
- JavaScript, PHP, PHP 확장, Go, Rust가 동일한 루트·그룹·행 사례를 실행합니다.

### 2026-09-26 — Rust JSON 텍스트 검증이 객체 멤버 값을 유지

- Rust JSON 텍스트 변환은 모든 깊이에서 객체 멤버 이름을 해당 값과 연결하고 선언 순서를
  유지합니다. 이전의 뒤바뀐 연결은 필수·길이 규칙이 잘못된 입력을 검사하게 했습니다.
- Rust 사례가 직접 검증과 중첩 객체 변환을 검사합니다.

### 2026-09-26 — 문서 빌드가 생성된 사이트 파일을 제외

- 문서 빌더와 소스 감시기는 생성된 `docs/.site/` 파일을 제외합니다. 생성된 Rust 문서의
  라이선스 파일은 페이지 제목이 없는 Markdown 문법을 가지며 자산으로 유지해야 합니다.
- 문서 빌드와 감시기 사례가 제외 동작을 검사합니다.

### 2026-09-26 — JSON 명세 리더가 반복된 멤버 이름을 거부

- 명세 JSON 리더는 다른 이스케이프 표기로 쓴 이름을 포함해 디코딩한 객체 멤버 이름이
  반복되면 검증 전에 오류로 처리합니다. 반복된 이름은 그렇지 않으면 오류 없이 입력을 교체합니다.
  CLI와 Rust JSON 텍스트 파서에 이 규칙을 적용합니다.
- 파서, CLI, Rust 사례가 중첩 객체, 배열, 이스케이프 이름과 유효한 문서를 검사합니다.

### 2026-09-25 — 스타일시트가 목록과 상세에 테마를 적용하고 색과 크기를 속성으로 공개

- `crudui.css`는 `--crudui-*` 사용자 정의 속성의 기본값을 명시도 0인 규칙 하나
  `:where(.crudui-form, .crudui-outline, .crudui-data, .crudui-list, .crudui-detail)`에 선언합니다.
  이전에는 이 규칙이 폼, 구조 맵, 현재 데이터 보기만 선택해서 폼 밖의 목록이나 상세는 정의되지 않은
  속성을 읽었고, 페이지는 스타일시트 뒤에 오는 규칙으로만 속성을 바꿀 수 있었습니다.
- 새 속성: `--crudui-on-accent`(선택된 선택지의 글자, 이전에는 규칙 안의 `#ffffff`),
  `--crudui-action-text`(동작, 이전에는 `#374151`), `--crudui-action-size`,
  `--crudui-control-border`, `--crudui-control-height`, `--crudui-radius`와 제출 버튼 속성
  `--crudui-submit-background`, `--crudui-submit-border`, `--crudui-submit-text`. 기본값은 그려지는
  크기와 색을 유지합니다. 다른 규칙은 색을 쓰지 않습니다([폼 마크업](docs/spec/form-markup.ko.md#스타일)).
- `npm run test:forms`에 포함된 `tests/style-properties.test.mjs`는 속성 규칙, 규칙이 읽는 모든
  속성이 선언되었는지, 다른 규칙이 색을 쓰지 않는지 검사합니다.

### 2026-09-24 — CI 브라우저 사전 검사가 실패한 sandbox 조건을 표시

- `scripts/check-ci-browser.mjs`는 적절하지 않은 `chrome://sandbox` 평가를
  `Chrome sandbox evaluation is "<value>"; expected "You are adequately sandboxed."`로, 적절하지
  않은 행을 `Chrome sandbox row "<row>" is "<value>"; expected ...`로 실패시킵니다. 전에는 사전
  검사가 Node.js가 생성한 assertion 메시지를 사용했습니다. 이 메시지는 비교한 문자열의 문자 사이에
  색상 코드를 넣으므로 오류에 필요한 상태 문구가 없었고 `tests/build/ci-browser.test.mjs`가
  실패했습니다.
- `tests/build/ci-browser.test.mjs`는 필요한 sandbox 행마다 오류를 검사합니다.

### 2026-09-24 — 목록과 상세가 렌더링 시 잘못된 선언을 거부

- JavaScript, HTML 렌더러, PHP, PHP 확장, Go, Rust의 `buildList`, `buildDetail`, `renderList`,
  `renderDetail`은 목록과 상세 선언의 형태를 검사합니다
  ([표시 형식 선언](docs/spec/display-formats.ko.md#선언)). `columns`가 없는 목록은
  `List specification must declare columns`로 실패하고, 객체가 아닌 `columns`나 `fields`, 알 수 없는
  루트·열·필드·정렬·동작 키, 루트 `$ref`와 `$patch`, 그리고 `field`, `label`, `format`과 형식이 정해진
  설정, `sortable`, `search`, `sort`, 동작, `empty`의 잘못된 값 형식은 `INVALID_FORM_INPUT`으로
  실패합니다. 전에는 `{ "columns": 5 }` 같은 명세가 빈 목록으로 렌더링됐습니다.
- 렌더러는 `$ref`나 `$patch`를 가진 목록 `search`를 합성하고, `validateList`와 `validateDetail`처럼
  합성된 명세에서 금지 키를 찾아 해당 경로에서 `FORBIDDEN_META_KEY`로 실패합니다.
- `null` 형식은 실패합니다. 생략, `true`, `false`는 `text`를 선택합니다.
- `script`가 있는 동작 객체는 번역한 라벨을 가진 스크립트 동작으로 렌더링됩니다.
- JavaScript `renderList`는 다른 런타임과 같이 `layout` 옵션을 합성과 선언 검사 전에 검사합니다.
  `@crudui/generator-core`의 내부 진입점은 `listLayout` 대신 `buildListLayout`을 내보냅니다.
- 공용 목록·상세 렌더링 고정 데이터가 선언 오류 사례를 정의하고, 모든 런타임이 네이티브 생성기
  검사로 이를 실행합니다. 목록·상세 유효성 사례도 `buildList`와 `buildDetail`로 만듭니다.

### 2026-09-22 — 선택 input의 포인터 입력을 label로 전달

- 시각적으로 숨긴 radio·checkbox input은 이제 투명하게 렌더링하면서 native hit target을
  유지합니다. 키보드 focus와 native form 의미를 바꾸지 않고 input 자체와 연결된 화면의
  label 모두 포인터 입력을 받을 수 있습니다. 따라서 브라우저 자동화와 마우스 사용자가
  같은 접근 가능한 control로 모든 선택지를 활성화할 수 있습니다.

### 2026-09-19 — 응답 경화, 하나의 선택 원본, Vue 오류 보고

- 공개 서버의 모든 응답이 이제 `X-Content-Type-Options: nosniff`를 가지고, 모든 JSON 본문은
  `<`, `>`, `&`를 유니코드 이스케이프로 적으며, 405는 대상이 받는 메서드를 적은 `Allow` 헤더로
  응답합니다(페이지는 `GET`, 파일은 `GET, HEAD`). 오류에 반영된 악성 요청 값이 어떤
  content-type 해석에서도 스크립트나 주석 요소를 닫을 수 없습니다.
  `src/server-responses.test.mjs`는 공개 서버를 시작해 헤더, `Allow` 응답, 이스케이프된 반영을
  검사합니다.
- 페이지 선택 기본값이 `src/record-view.mjs`와 `server.mjs` 두 곳에 정의돼 있었고 두 본사본을
  묶는 장치가 없었습니다. `server.mjs`는 모든 기본값을 `src/record-view.mjs`에서 가져와 서버와
  페이지가 어긋날 수 없습니다.
- 문서가 `<html data-pipeline-selection="…">`에 자기 전체 선택을 적고, 페이지 스크립트는 어떤
  멤버가 URL 선택과 다르면 렌더링 전에 실패합니다. 전에는 `initialization`만 검사해 다른
  서버의 오래된 문서가 저장 action이 그 서버를 가리키는 외부 단계 마크업을 넘겨받을 수
  있었습니다.
- 정본 페이지의 Vue app 안에서 컴포넌트나 렌더 함수가 오류를 내면 이제 다른 보기의
  실패처럼 페이지가 스크립트 오류로 실패합니다(`src/vue-errors.mjs`). 전에는 Vue가 콘솔에 적고
  계속 진행했습니다.

### 2026-09-19 — 레코드 폼이 저장 실패를 보여 줍니다

- 정본 페이지의 폼은 필드를 제출해 200과 422를 처리했지만, 요청 실패나 다른 응답에서는 아무
  메시지 없이 페이지가 그대로 남았습니다. 프라미스를 처리하는 핸들러가 없어 브라우저 콘솔에만
  기록되었습니다. 제출 처리를 `examples/form-comparison/src/save-form.mjs`로 옮기고 jsdom
  테스트를 두었습니다. 요청 실패, JSON이 아닌 응답, 200·422 외의 응답은 폼 앞에 페이지 언어의
  저장 실패 문구와 실패 내용을 담은 `<div id="save-errors" role="alert">`를 보여 주고, 입력 값을
  그대로 두며, 폼을 다시 제출할 수 있게 둡니다. `docs/operations/form-comparison.md`가 이 동작을
  규정합니다.

### 2026-09-19 — 화면 문구의 원본을 하나로

- 화면 문구는 TypeScript, Go, Rust, PHP, PHP 확장 생성기에 손으로 복사돼 있었고, 복사본이 같은지
  확인하는 장치가 없었습니다. 실행취소의 한국어 문구가 TypeScript에서는 실행취소, 나머지 넷에서는
  되돌리기였고, 실행복귀 문구는 TypeScript에만 있었습니다. 이제 문구는
  `contracts/interface-messages.json`에만 적습니다. 각 런타임은 자기 스크립트로 이 파일에서 생성한
  소스를 담고, 담은 문구가 파일과 다르면 테스트가 실패합니다. PHP 확장의 생성 표는 모든 필드를
  이름으로 채우고, 계약의 키와 C 구조체의 필드가 다르면 생성기가 실패합니다.
- 목록 페이지 버튼의 이름이 모든 언어에서 영어 "Previous page", "Next page", "Page N"이었고, 렌더러는
  이 이름을 비교해 ‹와 ›를 골랐습니다. 그래서 이름을 번역하면 버튼이 깨졌습니다. 이제 해석된 페이지
  모델이 버튼마다 역할(`previous`, `page`, `next`), 페이지, 레이블, 현재 여부, 비활성 여부를 담고,
  렌더러는 역할로 글자를 고릅니다. 레이블은 계약의 `list` 표에서 표시 언어의 항목을 쓰고, 표에 없는
  언어는 영어를 씁니다.
- 행이 없고 `empty`를 선언하지 않은 목록은 빈 상자를 보여 줬습니다. 이제 `list` 표의 `emptyList`
  문구를 표시 언어로 보여 주고, 선언한 문구는 비어 있더라도 선언한 그대로 씁니다.
- `make deploy`는 커밋으로 서버가 바뀐 직후, 컨테이너 안의 슈퍼바이저가 아직 서버를 다시 빌드하는
  동안 상태를 확인해 503으로 실패했습니다. 배포 검증은 이전 체크아웃으로 준비된 빌드를 받아들였다가
  마지막에야 실패했습니다. 이제 둘 다 컨테이너 안에서 슈퍼바이저가 이 체크아웃의 소스 식별자로
  빌드를 마칠 때까지, 빌드 단계별 한도와 무활동 한도 안에서 기다립니다.
- `node --test`나 Vitest가 통과 요약을 출력한 뒤 신호나 0이 아닌 종료 코드로 끝나면, 이유를 알리는 줄
  없이 단계가 실패했습니다. 이제 `run-tests.mjs`가 그 신호나 종료 코드를 실패 줄로 출력합니다.

### 2026-09-19 — unique를 JSON 값으로 비교, 캐시와 Rust 값 한도 제한

- `unique`는 런타임마다 값을 다르게 비교했습니다. TypeScript와 PHP는 텍스트 `"[1]"`을 목록 `[1]`로 보았고,
  TypeScript와 확장은 객체 항목 순서를 따졌으며, PHP는 `1`과 `1.0`을 다르게 보고 실수를 14자리로 적어
  `0.1 + 0.2`를 `0.3`과 같게 보았습니다. 이제 `unique`는 `equalTo`처럼 값이 나타내는 JSON 값으로 비교합니다.
  문자열은 코드 포인트로, 숫자는 정확한 값으로 비교하고, 타입이 다른 값은 같지 않으며, 목록은 순서대로,
  객체 항목은 모든 깊이에서 순서와 관계없이 비교합니다. 공유 사례 15개가 이를 정하고 모든 런타임이 통과합니다.
- 반복 그룹 안에서 `unique`를 선언한 필드는 각 행을 앞선 모든 행과 비교하고 쌍마다 필터 조건을 평가했습니다.
  이제 모든 런타임이 검증마다 행을 한 번 훑고 필터를 행마다 한 번 평가하며, 테스트가 n행과 4n행을 비교합니다.
  Rust 테스트는 경로로 값을 읽을 때마다 행 모음 전체를 복사하던 것도 찾아냈고, 이제 경로 읽기는 값을 빌려 씁니다.
- Go와 PHP 검증기의 식 캐시에는 한도가 없어 오래 도는 PHP-FPM 워커가 서로 다른 식마다 커졌습니다. 둘 다
  TypeScript 검증기처럼 식을 최대 1,000개만 두고 가장 오래 쓰지 않은 것부터 뺍니다.
- Rust 검증기는 값 한도를 적용하지 않았고 JSON 텍스트 읽기가 127단계에서 멈췄습니다. 이제 다른 런타임처럼
  노드 1,000,000개와 512단계를 적용하고, 깊은 텍스트를 재귀 없이 변환하며, 소유 값으로 만들 수 있는 값 한도
  사례를 모두 실행합니다.
- 공개 서버의 포워더는 서버가 업로드에 먼저 답하면(nginx가 너무 큰 본문에 413으로 답하듯) 나머지 본문을 더
  읽지 않았고 서버의 `Connection: close`를 그대로 넘겼습니다. 그래서 클라이언트가 아직 보내는 중에 연결이
  닫혀 백 번에 몇 번은 413을 읽지 못하고 EPIPE로 실패했습니다. 이제 포워더는 나머지 본문을 읽어 버리고
  홉 단위 헤더는 서버 쪽 연결에만 남깁니다. 테스트가 nginx처럼 먼저 답하는 서버로 큰 업로드 40개를 넘깁니다.

### 2026-09-18 — 입력이 좌우하는 반복과 비용 제한

- PHP 레코드 서버는 스크립트를 실행하기 전에 요청 본문 전체를 읽는 PHP 내장 서버에서 돌아서, 다른 서버가
  2 MiB에서 멈추는 동안 클라이언트가 선언한 본문을 모두 받았습니다. 이제 PHP를 운영 환경에서 실행하는
  방식대로 nginx 뒤의 PHP-FPM에서 돕니다(`examples/form-comparison/servers/php/main.mjs`). nginx는 2 MiB를
  넘는 본문을 PHP가 읽기 전에 계약의 JSON 413으로 끝내고 `/api/` 요청을 FastCGI로 `api.php`에 넘깁니다.
  컨테이너 이미지는 `php8.4-fpm`과 `nginx`를 설치하고, CI는 레코드 저장소 작업에 nginx를 더하며(`php-fpm`은
  setup-php가 제공), 내장
  서버의 접속 줄을 거르던 코드는 제거했습니다. 컨테이너의 표준 오류는 `/dev/stderr`로 다시 열 수 없는
  파이프이므로 PHP-FPM은 실행 디렉터리의 파일에 로그를 쓰고 모든 메시지를 표준 오류로도 보냅니다(`-O`).
- nginx는 너무 큰 본문에 헤더만 보고 응답한 뒤 클라이언트가 아직 보내는 중인 연결을 닫았고, 공개 서버의
  중계기는 이미 받은 413을 끊어 버렸습니다(서른 번에 한 번 EPIPE로 실패). 이제 nginx는 그런 본문의 나머지를
  10초 안에서 읽어 버리고(`lingering_close always`), 중계기는 서버가 준 응답을 업로드의 나머지와 관계없이
  유지하며, 벤치마크 경로의 413은 PHP 서버의 다른 벤치마크 응답처럼 JSON 처리기를 밝힙니다.
- 재시작 전에 실패한 주기는 한 번도 시작하지 않은 서버를 남겼고, 다음 주기는 소스가 바뀐 대상만 재시작해서
  그 서버가 계속 멈춰 있었습니다. 이제 모든 주기가 실행 중이 아닌 감독 대상 프로세스도 시작합니다.
- 도구 이미지가 Debian이 더 이상 제공하지 않는 Chromium 릴리스를 고정해 이미지를 빌드할 수 없었습니다. 현재
  `153.0.8010.47-2~deb13u1`을 고정합니다.
- `$v = [$v, $v]`를 마흔 번 반복한 PHP 목록이나 같은 목록을 두 번 담은 JavaScript, Go 목록처럼
  컨테이너를 공유하는 호출자 값은 입력 텍스트 순회와 PHP 값 복사의 시간을 단계마다 두 배로
  늘렸고, 자기 자신에 대한 참조 두 개를 담은 PHP 배열은 확장에서 끝나지 않았습니다. 순회는 현재
  경로에 있는 컨테이너만 건너뛰고 512단계에서 멈췄습니다. 이런 값을 받는 JavaScript, PHP, PHP 확장,
  Go 라이브러리는 이제 값을 그 값이 나타내는 트리로 순회하고 값 한도에서 멈춥니다. 한도는 노드
  1,000,000개와 배열·객체 512단계입니다. 자기 자신을 담는 값을 포함해 한도를 넘은 값은 입력 텍스트
  검사 순서대로 `INVALID_FORM_INPUT`과 `Recursive or excessively nested value: {name}`으로
  실패합니다. JavaScript와 Go는 자기 자신을 담는 값을 받아들였습니다.
- PHP 값 복사와 확장의 값 변환은 변환하는 모든 값에 같은 한도를 적용하므로, 어떤 검사도 순회하지
  않는 멤버도 제한됩니다.
- 공유 케이스 `tests/fixtures/text-validity/value-graphs.json`은 이 런타임들에서 공유하거나 자기
  자신을 담는 값을 만듭니다. 케이스마다 테스트 하나이며 실행기의 테스트별 제한 시간 안에 끝나야 하고, 공유 목록의 2^40개
  노드를 도는 순회는 이 제한을 넘깁니다.

- 벤치마크 드라이버는 반복 횟수를 검사하지 않았습니다. `--iters 1e20`은 PHP에서 끝나지 않았고,
  `0`, `-1`, `1.5`, `abc`는 의미 없거나 실패하는 반복을 실행했습니다. 이제 `tools/bench/run.js`와
  JavaScript·PHP·Go·Rust 드라이버는 1~8자리 10진수만, `--iters`는 1부터, `--warmup`은 0부터
  10000000까지 받고, 그 밖의 값은 검증기를 불러오기 전에 같은 메시지와 종료 상태 2로 거부합니다.
  `tools/bench/iteration-arguments.json`의 공유 사례를 모든 드라이버에 실행합니다
  (`npm run test:bench`, CI의 네이티브 생성 작업).
- JavaScript 드라이버는 더 이상 `Validator` 클래스를 내보내지 않는 공개 진입점에서 그 클래스를
  불러와 매번 실패했습니다. 이제 internal 진입점에서 불러옵니다.
- `run.js`는 제한 시간에 자신이 시작한 프로세스만 멈춰서 그 아래의 `go run`·cargo 프로그램이 계속
  실행되었습니다. 이제 모든 드라이버, `npm run manifest:test`의 선언된 명령,
  `scripts/require-current-build.mjs`의 빌드, `scripts/gen-api-docs.mjs`의 각 도구가 자기 프로세스
  그룹에서 제한 시간을 두고 실행됩니다(`scripts/bounded-command.mjs`). 제한 시간이 되면
  SIGTERM을 무시하는 프로세스까지 그룹 전체가 멈추며, 각 명령은 경과 시간을 출력합니다.
  `CRUDUI_COMMAND_LIMIT_SECONDS`가 제한 시간을 대신합니다.
- 벤치마크 Rust 크레이트는 릴리스 빌드를 strip해 도구의 strip 경고를 출력했습니다. 이제 릴리스 프로필을 가진 다른
  크레이트처럼 산출물을 strip하지 않으며, `tests/build/rust-release-profile.test.mjs`가 이를 요구합니다.

- 모든 런타임에서 표현식 구문 트리의 깊이는 최대 64 단계이며 더 깊은 표현식은 같은
  메시지의 파싱 오류입니다. 깊은 괄호가 TypeScript 파서의 스택을 소진하고 Rust 프로세스를
  중단시켰으며 다른 런타임은 깊이 제한이 없었습니다. 공통 표현식 사례가 구성 요소마다 한도,
  한도보다 한 단계 깊은 식, 10,000 단계의 식을 검사합니다.
- PHP 확장은 `in [` 목록이 닫히지 않으면 목록 항목을 두 번 해제해 프로세스를 중단시켰습니다.
  닫히지 않은 목록을 공통 거부 사례로 추가했습니다.
- Rust의 JSON 텍스트 읽기와 PHP 확장의 객체 멤버 추가는 반복된 멤버 이름을 앞선 모든 이름과
  비교해 찾았으므로 멤버 80,000개에 약 6초가 걸렸습니다. 두 곳 모두 해시 색인으로 찾으며
  확장은 배열 색인 이름을 정렬로 배치합니다.
- PHP 확장의 `unique` 규칙은 행의 모든 쌍마다 필터 조건을 실행하고 모든 쌍을 비교했으며 PHP
  검증기는 값마다 목록을 검색했습니다. 이제 두 곳 모두 행 수에 비례하는 시간이 걸립니다.
  시간 테스트는 기준 크기와 네 배 크기의 입력을 비교합니다.

- 트리 검증의 빌드 대기가 supervisor의 heartbeat를 빌드 진행으로 세어, heartbeat가 계속 갱신되는 멈춘
  빌드 단계가 대기를 끝없이 붙잡았습니다. 이제 진행은 단계(주기·대상·단계와 그 단계의 제한 시간)이며,
  한 단계는 자기 제한 시간에 무활동 제한을 더한 만큼만 대기를 붙잡고 heartbeat는 supervisor가 살아
  있음만 보입니다.
- supervisor의 모든 대기에 제한 시간이 있습니다. 하위 프로세스의 준비, 각 상태 요청, 그리고 각 중지가
  그렇고, 중지는 종료 유예 뒤 프로세스 트리 전체에 `SIGKILL`을 보내므로 `SIGTERM`을 무시하는 서버가
  재시작·재적재·종료를 더는 붙잡지 못합니다.
- JavaScript 레코드 서버는 2 MiB를 넘는 본문을 끝이나 요청 제한 시간까지 계속 읽었습니다. 이제 본문이
  제한을 넘는 즉시 413으로 응답하고 더 읽지 않으며 연결을 닫습니다. Go·Rust 서버와 같으며, 공유 계약
  사례가 끝나지 않는 큰 본문을 보냅니다.
- 행이 남지 않을 때까지 지우던 테스트는 이제 시작할 때의 개수만큼만 반복하고 매 반복에서 행이 하나
  지워졌음을 요구합니다.

### 2026-09-18 — 라이브러리가 만드는 폼 데이터 수용

- 폼 데이터는 새 행에서 건드리지 않은 칸처럼 값이 없는 필드를 빼는데, 서버가 그런 JSON 제출에 400으로
  응답해 벤치마크에서 새 행을 JSON으로 저장하면 실패했습니다. 이제 모든 서버가 JSON과 네이티브 제출 모두에서
  빠진 항목을 빈 값으로 채우고 `id`만 요구합니다. 저장 파일은 여전히 채우지 않습니다.
- 계약은 라이브러리가 직접 만든 데이터를 저장합니다. JSON은 행 작업 뒤의 `getData()`, 네이티브 폼은
  렌더링된 폼에서 브라우저가 제출하는 값입니다. 손으로 만든 제출이 이 불일치를 가리고 있었습니다.
- 모든 서버는 벤치마크 요청도 레코드 저장과 같은 규칙으로 받습니다. JSON은 정확히 `form`, 네이티브 폼은
  정확히 `form[...]`과 완료 필드입니다. Rust와 Go 서버는 두 형식 모두에서, PHP 서버는 JSON에서
  다른 항목도 받아들였습니다.

### 2026-09-18 — 정본 레코드에 반복 회사 폼 표시

- 목록·상세·폼을 고객 레코드 하나로 잇는 과정에서 정본 페이지의 폼이 평면 필드 7개가 되었고, 반복 폼은
  벤치마크 화면에만 남았습니다. 이제 고객 레코드는 `companies`를 가집니다. 회사·스토어·부서가 행 복사·
  정렬·개수 제한, 고정 행 머리, 스토어를 사용하는 동안만 보이는 메모, 한국어·영어 제목, 필수 이름과 함께
  들어갑니다. 벤치마크 폼은 같은 명세 파일에서 이 그룹을 가져오므로 한 번만 선언합니다.
- 초기 레코드 45개는 회사·스토어·부서 수가 서로 다르고, 일부 스토어는 사용이 꺼진 채 메모 문구를
  유지합니다.
- 모든 서버는 행을 키와 순서대로 저장하고 돌려주며, 네이티브 제출에서 빠진 체크박스와 빈 컬렉션을 채우고,
  형태가 잘못된 행은 400, 규칙을 어긴 행은 422로 응답하며, 숨겨진 스토어의 메모를 유지합니다. 계약에
  중첩 저장·검증·형태 사례를 더했고, 정본 흐름은 스토어 사용을 끄고 부서를 추가한 뒤 서버가 저장한 값을
  확인합니다.
- 모든 서버는 저장 파일을 같은 규칙으로 검사합니다. 레코드는 초기 데이터의 멤버를 같은 순서로 정확히
  가지고, `score`는 숫자, 나머지 스칼라는 문자열이며, `companies`는 서버의 단일 회사 형태 함수로 검사한
  폼의 형태입니다. 형태가 잘못되었거나 읽을 수 없는 파일은 목록·레코드·뷰·저장에 500으로 응답하고 바이트
  그대로 유지되며, 초기화는 어떤 저장 파일이든 초기 데이터로 바꿉니다.

### 2026-09-17 — 모든 서버와 클라이언트에서 목록부터 저장 후 목록까지 이어지는 정본 페이지

- 공개 루트는 목록 → 상세 → 폼 → 저장 → 갱신된 목록으로 이어지는 정본 페이지 하나입니다. `js`, `php`,
  `php-ext`, `go`, `rust` 서버, `html`, `react`, `vue`, `svelte` 클라이언트, CSR과 SSR, `bindForm`과
  `createForm`에서 동작합니다. iframe 단계, `/api/pipeline/*` 경로와 그 경로가 내주던 고정 레코드는
  제거했습니다. 모든 링크는 선택 전체를 가지며, SSR에서는 선택한 서버가 만든 단계를 클라이언트가 넘겨받고
  CSR에서는 클라이언트가 자기 컴포넌트로 렌더링합니다([정본 페이지](docs/operations/form-comparison.ko.md#정본-페이지)).
- 서버마다 고객 레코드 45개 고정 데이터 하나로 채우는 영속 저장소 `records-{server}.json`을 가지며,
  같은 상태 코드·메시지·항목 순서로 HTTP 계약 하나(`/api/records`, `/api/records/{id}`,
  `/api/records/reset`, `/api/records/view/{view}`)를 구현합니다. 저장은 렌더링된 폼의 필드만 또는 JSON
  항목 `form`만 받고, 서버 자신의 검증기로 검증하며, 실패하면 저장소를 바꾸지 않습니다. 쓰기는 직렬화되고
  파일을 원자적으로 교체하며, 읽을 수 없는 저장소는 500으로 응답하고 그대로 둡니다. 경로 조각은 쓴
  그대로 비교하고, 보기 질의는 정해진 항목 순서로 읽습니다.
- `record-stores.test.mjs`는 체크아웃에서 빌드한 다섯 서버 모두에 계약 사례 16개를 실행하고,
  `pipeline.browser.mjs`는 로컬 구성에 대해 브라우저에서 흐름 조합 40개를 실행합니다.
  `npm run test:form-comparison:pipeline`과 CI 작업 `form-comparison-pipeline`이 둘을 실행합니다.
- 단위로 이루어진 검사에는 이제 전체 제한 시간이 없습니다. 단계는 45초 동안 진행 줄을 출력하지 않으면
  멈추고, 단위마다 제한 시간은 가장 느린 측정값의 세 배입니다. 빌드 준비 대기는 공개 서버에 대한 600초
  제한의 요청 하나 대신, 주기가 빌드 중인 동안 진행을 보고하는 supervisor의 빌드 상태 파일을 읽습니다.
  `/api/source`는 제거했습니다.
- `scripts/run-tests.mjs`는 Rust 컴파일 오류처럼 도구가 테스트를 실행하기 전에 실패하면 테스트 없이 `✔`를
  출력했습니다. 이제 요약이 실패하고 도구의 종료 코드를 적습니다.
- Vue 어댑터는 마크업이 바뀔 때마다 컨트롤 요소를 교체해 숫자 입력이 커서를 잃었고, `9104`를 입력하면
  `4019`가 저장됐습니다. React와 Svelte 어댑터도 일부 컨트롤과 버튼 그룹을 같은 방식으로 교체했습니다.
  이제 각 어댑터는 마크업을 한 번 쓰고 이후 마크업은 `patchContent`로 제자리에서 갱신해 모든 요소 노드를
  유지하며, 서버 출력은 그대로입니다. 공유 폼 세션 사례 `typing.mjs`가 네 어댑터에서 노드 동일성, 포커스,
  커서, 입력 순서를 검사합니다.
- React, Vue, Svelte는 렌더링마다 목록과 상세의 `html` 내용을 교체했습니다. 이제 폼과 같이 제자리에서
  갱신하며, 공유 보기 사례 `rerender.mjs`가 노드 동일성을 검사합니다. 브라우저는 마크업으로 삽입되거나
  복제된 스크립트를 실행하지 않으므로, 어떤 어댑터도 클라이언트 렌더링이나 새 행에서 위젯 스크립트를
  실행하지 않았습니다. `patchContent`는 이제 새 마크업이 자리 잡은 뒤 새 스크립트 요소를 삽입하므로 모든
  스크립트는 마크업이 처음 나타날 때 정확히 한 번 실행되고 다시 실행되지 않습니다.
  `tests/widget-script-runs.test.mjs`가 Chromium, Firefox, WebKit에서 네 어댑터의 클라이언트·서버
  렌더링으로 이를 검사합니다. React 서버 출력은 계속 바이트 기준이며, `byte-reference.test.ts`가 모든 공유
  사례에서 HTML 렌더러 출력과 같은지 요구합니다.
- 숫자 컨트롤(`number`, `integer`, `float`, `decimal`)은 이제 모든 런타임에서 `step="any"`를 가집니다.
  이 속성이 없으면 브라우저가 렌더링된 값에서 기본 간격을 세어, 저장된 `2886.5` 다음에 입력한 `9102`가
  간격 불일치가 되어 폼이 제출되지 않았습니다. 간격은 CRUDUI 검증기의 `step` 규칙이 판단합니다. 공유 폼
  사례 `number-any-step`이 이를 검사하며, 정본 페이지는 브라우저의 제약 검증을 켠 채 제출합니다.
- 비교 빌드의 `composer` 대상은 `composer install`만 실행했는데, 이 명령은 잠금 파일이 그대로면 검증기의
  경로 저장소 사본을 유지하므로 배포가 오래된 검증기 사본을 쓰고 PHP 서버가 시작 검사에 실패했습니다. 이제
  대상이 사본을 다시 설치합니다.
- 배포 검증의 브라우저 검사 두 개가 코드를 따라가지 못했습니다. 상호작용 검사는 행 머리가 머리 컨테이너 안에
  있는데도 행 바로 아래에서 행 작업을 찾았고, 벤치마크 프레임은 명세로 숨긴 필드가 여전히 규칙을 가진다고
  기대했습니다. 둘 다 현재 마크업과 규칙을 따르며, `check-interaction.test.mjs`가 이제 렌더링된 마크업에서
  행 작업을 찾습니다.
- 초기화 보고서의 `mounted` 단계는 명세와 달리 저장소를 초기화하고 열의 프레임 문서를 다시 불러오지 않아,
  서버 렌더링 열이 앞선 검사가 저장한 데이터를 보여 줬습니다. 이제 열마다 레코드를 초기화하고 프레임을 다시
  불러옵니다.
- supervisor 모듈이 바뀌면 비교 컨테이너가 멈췄습니다. supervisor가 후속 프로세스를 띄우고 종료했는데, init
  프로세스의 유일한 자식이어서 그 종료가 컨테이너를 끝냈습니다. 이제 자기 프로세스 이미지를 교체해 프로세스
  ID를 유지합니다.
- PHP 확장은 `30` 같은 목록 숫자를 `3e+1`로 썼고, PHP 확장과 Go 생성기는 `1e+21`을 `1e,+21`로 묶었습니다.
  둘 다 이제 JavaScript와 같이 숫자를 쓰며, 공유 목록 사례 `format-number-shortest`가 모든 런타임을
  검사합니다.

### 2026-09-17 — Linux 스타일 검사가 받은 이미지 제거

`make test-form-styles-linux`는 고정된 버전의 Playwright 이미지(약 10GB)가 필요합니다. 이미지를 받은 실행은
이제 성공 여부와 관계없이 끝날 때 이미지를 지우고, 이미 있던 이미지는 남겨 둡니다. 테스트 절차 문서가 이
명령을 설명합니다.

### 2026-09-17 — 모든 JavaScript, TypeScript, Svelte 소스 린트

- `npm run lint`는 `eslint packages`를 실행했고 설정은 모든 `.js`·`.mjs` 파일, 모든 테스트, 모든 Svelte
  컴포넌트를 건너뛰었기 때문에, 예제, 테스트, 스크립트, 도구, 루트 설정은 CI에서도 `make ci`에서도 린트되지
  않았습니다. 이제 `eslint .`를 실행하며, `eslint.config.mjs`는 생성되거나 설치된 출력만 제외하고 모든
  JavaScript, TypeScript, Vue, Svelte 소스에 패키지 규칙 집합을 적용합니다. 파일별 설정은 코드가 실행되는
  환경(브라우저, 브라우저 콜백을 가진 Node, CommonJS 스크립트, Svelte 컴포넌트)만 나타내며,
  `eslint-plugin-svelte`와 `globals`를 개발 의존성으로 추가합니다([린트](docs/operations/testing.ko.md#린트)).
- `npm run test:build`가 실행하는 `tests/build/lint-coverage.test.mjs`는 추적되는 소스가 린트 명령의 경로
  밖에 있거나 설정이 그 소스를 린트하지 않으면 실패합니다.
- 넓어진 린트가 찾은 문제를 고칩니다. 사용하지 않는 import, 변수, 매개변수, `cause` 없이 다시 던진 오류,
  불필요한 정규식 이스케이프와 반복 공백, PHP 확장의 C 도우미 목록과 네이티브 생성기 검사 시간 한도의 배열
  구멍, 적은 값을 유지하지 못하는 숫자 리터럴(`9007199254740993`과 `9.999999999999999`는 이미 가지던 값으로
  적음), 테스트의 `any`, 표준 출력으로 출력하는 스크립트의 `console.log`, 키 없는 Svelte `{#each}`, 의존
  값을 단독 표현식으로 읽던 effect입니다. 사용하지 않는 루트 스크립트 `capture-react.js`를 삭제합니다.
- Svelte 생성기의 `{@html}` 출력과 제목 슬러그의 제어 문자 클래스는 해당 줄에서만 규칙에서 제외하고,
  각 줄 옆에 이유를 적습니다.

### 2026-09-17 — 등록된 규칙이 아닌 규칙 이름 거부

- 등록된 규칙이 아닌 `validate` 키는 건너뛰었기 때문에 철자가 틀린 규칙이 검사를 조용히 껐고, 스키마는
  더 이상 어떤 런타임도 등록할 수 없는 규칙을 위해 다른 규칙 이름을 열어 두었습니다. 이제 그런 이름은
  매개변수와 관계없이 모든 검증기와 PHP 확장에서 필드 선언 경로에 위치한 로드 실패 `UNKNOWN_RULE`이며
  메시지는 `Unknown rule: {name}`입니다. `messages` 키는 메시지를 재정의할 규칙의 이름이므로 등록된
  규칙이 아닌 `messages` 키도 같은 방식으로 실패하며, 필드가 선언하지 않은 등록 규칙은 여전히 가리킬 수
  있습니다. 이름은 매개변수와 함께 검사합니다. 필드는 선언 순서로, 필드의 규칙(규칙마다 이름을 매개변수보다
  먼저)과 이어서 `messages` 키를 그 필드가 포함한 필드보다 먼저 검사합니다
  ([매개변수 오류](docs/spec/validation-rules.ko.md#매개변수-오류)).
- 스키마의 `validate`와 `messages`는 등록된 규칙 이름만 허용하며, `scripts/check-schema.mjs`는 두 목록을
  규칙 등록부와 비교합니다. PHP `FieldSpec`, Go `FieldSpec`, Rust `FieldSpec` 모델도 `validate`와
  `messages`를 같은 방식으로 닫고, 빠져 있던 `content`와 `messages` 키를 추가하며, 각자 키를 스키마와
  비교합니다.
- JavaScript, Go, Rust의 `match`와 `pattern`은 자신의 사용자 메시지가 없으면 다른 이름의 메시지를
  사용했습니다. 이제 모든 런타임은 PHP와 PHP 확장처럼 선언한 규칙 이름으로만 사용자 메시지를 찾습니다.
- 공용 사례 `unregistered-rule-skipped`는 중첩 행 경로, 숨긴 필드, 검사 순서, `messages`를 포함해 명세로
  작성한 사례 12개로 바뀌고, `match`와 `pattern` 메시지 사례 1개가 추가되어 공용 검증 사례는 250개가
  됩니다.

### 2026-09-17 — 비교 예제에서 생성된 필드 모델을 멤버 순서까지 비교

- `examples/form-comparison`의 생성 검사는 속성, 추가 설정, 레코드 데이터에서만 객체 멤버 순서를
  비교했기 때문에, 배포된 비교가 런타임마다 멤버 순서가 다른 필드 모델을 통과시킬 수 있었습니다.
  이제 자체 사본 대신 `tests/native-generators/protocol.mjs`의 순서 엄격 `equalModels`와
  `equalOrdered`를 사용하므로, 모든 런타임의 모델은 모든 깊이에서 같은 멤버 순서를 가져야 합니다.
- `check-generation.test.mjs`는 모델, 위젯, 데이터가 멤버 순서만 다른 렌더링 폼이 거부됨을
  보여 줍니다.

### 2026-09-17 — 모든 런타임에서 유니코드 스칼라 값이 아닌 텍스트 거부

- 명세와 데이터의 텍스트는 유니코드 스칼라 값의 나열입니다
  ([입력 텍스트](docs/spec/input-text.ko.md)). JavaScript 문자열의 쌍이 없는 서로게이트, PHP·Go·C
  문자열의 UTF-8이 아닌 바이트, JSON 텍스트의 쌍이 없는 서로게이트 이스케이프는 `validate`,
  `validateList`, `validateDetail`, `compileForm`, `bindForm`, `bindButtons`, `createForm`, 폼
  인스턴스 메서드, `buildList`, `buildDetail`과 그 렌더링 연산의 다른 모든 검사보다 먼저 거부됩니다.
  Go는 더 이상 이를 U+FFFD로 바꾸지 않고, PHP와 Rust는 더 이상 JSON 디코딩에서 다른 오류로 실패하지
  않습니다.
- 명세나 합성 파일의 실패는 텍스트 경로에 위치한 로드 실패 `INVALID_TEXT`이고, 다른 인수나 옵션은
  `INVALID_FORM_INPUT`과 메시지 `Text must be Unicode scalar values: {name}`으로 실패합니다. 멤버
  이름도 텍스트이며 멤버는 이름의 코드 포인트 순서로 검사합니다.
- Go의 `compose.DecodeOrdered`, `generator.DecodeJSON`, `ValidateJSON`은 검사를 위해 텍스트를
  보존하고, PHP는 `CRUDUI\Validator\Support\JsonText`, Rust는 `crudui_validator::text`와
  `crudui_generator::text`를 추가하며, PHP 확장은 변환 전에 PHP 값을 검사합니다.
- 새 케이스 묶음 `tests/fixtures/text-validity`는 연산마다 케이스 파일을 하나씩 둡니다. 검증기, PHP
  확장, 교차 검증 콘솔의 다섯 프로세스, 네이티브 생성기 프로그램이 이를 실행하고 적합성 증거를
  기록하며, 프로그램은 UTF-8이 아닌 표준 입력을 거부합니다.

### 2026-09-17 — 완전한 표현식이 아닌 외형 문자열을 리터럴 텍스트로 읽기

- `design.class`, `design.style`과 다른 외형 설정은 `design.show`가 이미 따르는 규칙을 따릅니다.
  문자열은 표현식 문법으로 끝까지 파싱될 때만 표현식이고 그 밖의 문자열은 리터럴 텍스트입니다.
  `modal fade in show` 같은 클래스나 `font-family: Made in Script` 같은 스타일은 실패한 표현식으로
  평가되어 버려졌지만, 이제 JavaScript, PHP, Go, Rust 생성기와 PHP 확장에서 작성한 그대로
  렌더링됩니다.
- 작성한 폼 사례 두 개가 리터럴 클래스와 스타일 문자열을 다루며, 공유 폼 사례는 103개가 됩니다.

### 2026-09-17 — 모든 런타임의 숨김 필드, 데이터 전용 행, 하나의 숫자 해석

- 데이터에 대해 `design.show`가 `false`로 해석되는 필드는 숨겨진 필드입니다. 검증은 그 필드와 내부의 모든
  규칙을 건너뛰고 오류를 보고하지 않으며 값은 유지하므로, 꺼 둔 설정은 값을 유지하다가 다시 켜면 다시
  검증합니다. `false`로 해석될 때만 숨기며, 아무것도 선택하지 않는 조건 맵과 완전한 표현식이 아닌 문자열은
  보입니다. 숨겨진 필드도 데이터 모양은 검사합니다. 폼도 같은 규칙으로 표시 여부를 정하고 숨겨진 값을
  인스턴스와 `getData()`에 유지합니다.
- 목록 열의 `sortable`은 생성기가 이미 읽던 대로 조건 맵일 수 있으며, 아무것도 선택하지 않는 맵은 정렬할
  수 없음을 뜻합니다.
- `multiple.only: true`와 같은 `multiple: only`는 데이터에만 존재하는 행을 선언합니다. 데이터의 키가 행이고,
  데이터가 없으면 행이 없으며, 폼은 행 컨트롤과 행 추가 컨트롤을 렌더링하지 않고, 모든 행 연산은
  `Rows of {path} come only from data`로 실패합니다. `title`, `header`와 함께 쓰며, 그 밖의 키와 잘못된 값은
  [스키마](docs/spec/schema.ko.md)의 메시지로 컴파일 오류를 보고합니다.
- 반복 필드나 그룹의 데이터가 없으면 빈 컬렉션이므로 `required`와 개수 규칙이 적용됩니다.
- 숫자를 한 가지 방식으로 읽습니다. 숫자 텍스트는 값이 유한한 HTML 유효 부동소수점 수(`+`와 끝의 점은
  불가, 지수 허용)입니다. `min`, `max`, `range`, `step`은 숫자가 아닌 값에 실패하고, `step`은 10진 텍스트로
  0부터의 배수를 정확히 판정하며, `digits`는 정규 텍스트를 읽고, 개수 규칙은 배열의 길이, 객체의 키 수,
  값 없음·null·공백 값은 0, 그 밖의 스칼라는 1로 셉니다. `in`은 같은 방식으로 숫자 멤버를 비교하고 목록
  멤버는 쓴 그대로 읽습니다. 숫자·개수 매개변수는 길이 제한처럼 검사합니다(`INVALID_RULE_PARAMETER`).
  메시지는 매개변수를 정규 텍스트로 표시하고 규칙에 있는 매개변수의 자리 표시자를 모두 치환합니다.
- 제거: 런타임별 숫자 파서(`is_numeric`, `strconv.ParseFloat`, `str::parse`, `strtod`, `parseFloat` 대체
  경로), step 허용 오차와 반올림, C 엔진의 로캘 의존 숫자 읽기·쓰기(쉼표 소수점 로캘에서 검사하는 정확한
  변환으로 교체). PHP 패키지 검사는 경고, notice, deprecation이 하나라도 나오면 실패합니다.
- 공용 검증 사례는 238개로 늘었고 폼, 목록, 구조 맵, 세션 사례가 추가되었으며, `examples/product-forms`는
  옵션 조합 폼과 큰 상품 폼을 현재 문법으로 보여 주고 검사에서 검증·렌더링합니다.

### 2026-09-17 — 컴파일된 템플릿 형태만 받고 위젯 멤버 순서 통일

- 모든 런타임(JavaScript, PHP 라이브러리와 확장, Go, Rust)의 `bindForm`, `bindButtons`와 폼
  인스턴스는 `compileForm`이 만드는 형태와 정확히 같은 템플릿만 받습니다. `kind`, `fields`,
  `buttons`, 선택 항목인 문자열 `keyPrefix`와 객체 `action`만 있고, 필드 템플릿은 `name`,
  `spec`, `children`만 정확히 갖습니다. 그 밖의 값은 `INVALID_FORM_INPUT`과
  `Unsupported form template`으로 실패합니다. Rust는 `FormTemplate::from_json`으로 템플릿을
  읽고, `Deserialize` 구현도 이를 사용합니다.
- 모든 런타임에서 위젯 모델의 멤버 순서가 하나이고, 파일 위젯의 `extra`는 `display`가
  `file`보다 앞섭니다. 네이티브 생성기 비교는 멤버 순서와 템플릿 형태 요청 69개를 검사하며, 폼
  런타임과 PHP 확장 명세가 이를 설명합니다.

### 2026-09-17 — 옮긴 포커스를 모든 엔진에서 같게 스크롤

- CI 작업 "Form instances and data injection"이 Linux의 WebKit에서 실패했습니다. 행 추가 작업
  뒤 새 행의 입력이 고정 푸터 아래에 놓였습니다(700px 페이지에서 한계 644px에 대해 709px,
  스크롤 박스와 프레임에서도 같은 65px). Playwright 이미지에서 측정하니 그 엔진의 `focus()`는
  멀리 있는 컨트롤을 스크롤 여백을 지키지 않고 스크롤했고(아래쪽이 화면을 9px 넘고, 아래에서
  올라올 때는 위쪽이 화면 위로 9px 나가 고정 헤더에 가림), `scrollIntoView({ block: 'nearest' })`는
  여백을 지켰습니다.
- `connectForm`과 `connectOutline`은 더 이상 스크롤을 포커스에 맡기지 않습니다. 포커스를 행으로
  옮길 때 `preventScroll`로 포커스한 뒤 `scrollIntoView({ block: 'nearest', inline: 'nearest' })`로
  필요한 만큼만 컨트롤을 보이게 스크롤하므로, Chromium, Firefox, macOS와 Linux의 WebKit에서
  스타일시트의 스크롤 여백이 컨트롤을 고정 헤더와 푸터에 가리지 않게 합니다. 폼 마크업과 폼
  런타임 명세가 이를 설명합니다.
- `make test-form-styles-linux`(`scripts/test-form-styles-linux.sh`)는 고정된 버전의 Playwright
  이미지에서 macOS의 `container` 또는 다른 container CLI로 스타일시트 레이아웃 검사를 CI 러너처럼 Linux에서
  실행합니다. `make ci`에는 포함되지 않습니다.

### 2026-09-17 — WebKit에서 스타일시트 레이아웃 검사

- `tests/form-styles.test.mjs`가 sticky 헤더, 단계 레이블, 이음매, 행 카드, 포커스 시나리오를
  Chromium, Firefox와 함께 WebKit에서도 실행합니다. 엔진 어댑터 하나가 각 브라우저를
  실행하고(Chromium과 Firefox는 Puppeteer, WebKit은 Playwright) 모든 엔진이 같은 시나리오 코드를
  실행합니다. 브라우저를 시작할 수 없으면 이유와 함께 실행이 실패합니다.
- macOS의 WebKit은 포인터로 누른 버튼에 포커스를 주지 않습니다. 포커스 시나리오는 일반 버튼으로
  엔진의 규칙을 측정하고, 복원된 포커스가 그 규칙과 같기를 요구합니다. 누름이 포커스를 주는
  엔진에서는 보이는 포커스 없이 토글이, 주지 않는 엔진에서는 아무것도 포커스되지 않습니다.
  Chromium과 Firefox는 포커스를 주어야 하고, macOS의 WebKit은 주지 않아야 합니다.
- `playwright`가 루트 개발 의존성이 되었고, `npm run test:forms`를 실행하는 CI 작업은
  `npx playwright install --with-deps webkit`으로 WebKit을 설치하며 제한 시간은 15분입니다.

### 2026-09-17 — CI 워크플로를 로컬에서 실행하고 첫 실행에서 드러난 문제 수정

- `make ci`는 `.github/workflows/ci.yml`의 모든 검사 명령을 순서대로 실행하고 적합성 증거를
  검사합니다. `tests/build/ci-local.test.mjs`는 이 목록이 워크플로와 다르면 실패합니다.
- CI 워크플로가 세 가지로 실패했습니다. 루트 패키지가 폼 비교 예제가 가져오는
  `@crudui/validator`를 선언하지 않았고, PHP 검증기가 ctype 없는 PHP 빌드에는 없는 `ctype_digit`과
  `ctype_xdigit`을 호출했으며, PHP 확장 엔진 검사가 정적 표를 복합 리터럴로 초기화해 GCC가
  `-pedantic`에서 거부했습니다. 의존성을 선언하고, PHP 패턴 파서는 문자를 직접 비교하며, 표는 중괄호
  초기화를 씁니다. `tests/build/php-extensions.test.mjs`는 PHP 패키지가 선택 확장(mbstring, ctype,
  iconv, intl, bcmath, gmp, sodium, dom)을 요구하지 않고 쓰면 실패합니다.

### 2026-09-17 — 저장소 설정 선언과 make 배포

- `.github/repository.json`이 GitHub 저장소 설정을 선언합니다. 홈페이지, 저장소 기능과 병합 방식,
  Actions 허용 범위와 워크플로 기본 권한, 취약점 알림과 자동 보안 수정, Pages 빌드 방식, `main`에서만
  배포하는 `github-pages` 환경입니다. `make github-settings`는 다른 설정만 바꾸고 다시 읽으며,
  `make github-settings-check`는 설정이 다르면 실패합니다. `tests/build/github-repository.test.mjs`가
  메모리 안의 저장소로 두 명령을 검사합니다. [저장소 설정](docs/operations/repository.ko.md)을 참고합니다.
- `make deploy`와 `make deploy-verify`는 비교 서비스 배포와 그 검증을 실행하며, 검증 절차 문서도 이
  명령을 적습니다.

### 2026-09-17 — 배포 패키지에서 명령 프로그램 제외

언어별 검증기·생성기 프로그램은 교차 검증 콘솔과 native 생성기 검사의 프로세스 경계일 뿐인데 패키지
안에 들어 있었습니다(`packages/validator-go/cmd/validate`, `packages/validator-php/bin/validate.php`,
Rust `validate`·`generate` 실행 파일, `packages/generator-go/cmd/generate`,
`packages/generator-php/bin/generate.php`). 패키지는 라이브러리 함수만 제공합니다.

- 검증기 프로그램은 `examples/cross-check-console/validators`에, 생성기 프로그램은
  `tests/native-generators/programs`에 있으며, 각각 패키지의 공개 API만 호출하고 같은 요청·응답·종료
  상태를 유지합니다. 콘솔은 공용 검증·목록·상세 사례 전체와 요청 사례 45개를 다섯 검증기 프로세스로
  실행하고, native 검사는 공용 요청 검사 60개를 모든 생성기 프로그램에 보냅니다.
- 이 공용 검사로 드러난 경계 동작 차이를 한 규칙으로 맞췄습니다. 모든 프로그램이
  `Request must be valid JSON`, `Request must be an object`, `Options must be an object`,
  `Actions must be an array`, `Unknown generator operation`으로 답하고, 객체가 아닌 `spec`은
  `A form spec must be a group with properties`, 객체가 아닌 `template`은 `Unsupported form template`,
  잘못된 동작은 단계 오류 `Invalid form action`입니다. `bindButtons`는 버튼을 읽은 뒤 템플릿 종류를
  확인해 `TypeError`를 던졌으며, 이제 `Unsupported form template`를 보고합니다.
- 패키지 계약에서 `validatorCli` 기능을 제거했습니다. `tests/build/public-packages.test.mjs`는 배포
  패키지가 명령 프로그램을 선언하거나 포함하면 실패합니다(`package.json`이나 `composer.json`의 `bin`,
  `#!`로 시작하는 PHP 파일, Go 모듈의 `package main`, Rust 크레이트의 `[[bin]]`, `src/bin`,
  `src/main.rs`).
- `make format-check`는 아직 커밋하지 않은 새 파일도 검사하고 삭제된 파일은 건너뜁니다.

### 2026-09-17 — 레거시 계층 제거

레거시 계층은 이전 필드 모델(`rules`, `messages`, `display_switch`/`display_target`)을 CRUDUI와
나란히 실행했지만 고정된 이전 동작을 재현하지 않았습니다. TypeScript 레거시 검증기는 현재 규칙
레지스트리 위에서 실행되어 현재 규칙이 바뀔 때마다 결과도 바뀌었습니다. 이 계층은 호환·이전 경로였고,
예제는 CI에서 실행되지 않았습니다. 별칭, 대체 경로, 대체 진입점 없이 완전히 제거했습니다.

- 레거시 검증기를 제거했습니다. `@crudui/validator/legacy`(`./legacy` export와 빌드 진입점),
  `CRUDUI\Validator\Legacy`, Go `validator/legacy` 패키지와 `cmd/validate-legacy`, Rust `legacy`
  모듈과 `validate-legacy` 실행 파일입니다. 이들만 쓰던 코드도 함께 제거했습니다. TypeScript
  `RulesSpec` 타입, PHP `Rules\Unique` 규칙과 쓰이지 않는 `PathResolver` 메서드 여섯 개, Go
  `LegacyKeyMap`, PHP `FieldSpec::ABSORBS_LEGACY` 표와 `canonicalFor()`, Rust `regex` 의존성입니다.
- 레거시 변환기(`translateFromLegacy`, `roundtripLegacy`)와 말뭉치 스크립트
  (`scripts/corpus-legacy-*.mts`)를 제거했습니다. `translateLegacy`·`validateLegacy` 기능과
  `tests/fixtures/legacy-validate`·`tests/fixtures/translate` 고정 데이터도 함께 제거했습니다.
  `tests/fixtures/specs`의 이전 모델 명세도 제거했습니다.
- `examples/legacy`를 Compose 파일, PHP·Go·Rust·Node API 서버, 예제 프로그램, 공유 명세와 함께
  제거했습니다. 해당 서버의 문서를 검사하던 `npm run docs:check:servers`, `make docs-check-servers`,
  스크립트도 제거했습니다.
- 네 언어 레거시 비교(`tests/runner`)와 그 CI 작업을 제거했습니다. 루트 `npm test`는 이제 모든
  워크스페이스 패키지의 테스트 스크립트를 실행합니다.
- `scripts/check-schema.mjs`는 더 이상 레거시 말뭉치를 검사하지 않습니다. 추적하는 YAML 파일이
  자신이 검사하는 명세나 CLI 테스트 고정 데이터가 아니면 실패합니다.
- 검증기 벤치마크의 `contact` 명세는 현재 검증기가 읽지 않는 레거시 `rules` 선언이어서 규칙 없는
  폼을 측정했습니다. 이제 현재 `validate` 선언으로 생성하며, 80개 필드 사례의 이름은 `large`입니다.
  Go와 Rust 벤치마크 드라이버는 검증기 생성자가 이제 반환하는 오류를 처리합니다.
- `docs/spec/legacy-schema.md`와 `docs/spec/legacy-visibility.md`를 제거했고, 테스트·스키마·고정
  데이터·예제·기능 문서는 현재 계층만 설명합니다.

### 2026-09-17 — 패키지 진입점과 정확한 export 선언

`contracts/features.json`은 패키지마다 이름 몇 개만 적었고, manifest 검사는 각 이름이 패키지
소스 어딘가에 있는지만 확인했습니다. generator-core 진입점은 값 64개를 내보냈고, React·Vue·Svelte
진입점은 core 함수를 다시 내보냈으며, 렌더러는 공개 진입점으로 core 도우미를 가져왔습니다. 이제 각
패키지는 `entries`에 `package.json` `exports`의 모든 JavaScript 진입점을 공개 범위(`public` 또는
`internal`)와 정확한 값 export 목록으로 선언하며 `exports`는 제거했습니다. `npm run manifest:check`는
TypeScript 컴파일러로 값 export를 읽고, 선언되지 않았거나 없는 진입점·export, 담당 패키지 공개
진입점 밖의 signature 함수, CRUDUI 패키지 코드 밖에서 가져온 internal 진입점에서 실패합니다.
`tests/build/contract-manifest.test.mjs`가 각 실패를 증명합니다. 생성되는 기능 계약 페이지는 모든
진입점을 나열합니다.

- `@crudui/generator-core`는 공개 API를 내보냅니다. 기능 작업, `FormInstance`,
  `createRowKey`, `sequenceRowKey`, `formMessages`, `collapsibleRows`, `canUndo`, `canRedo`,
  `redoChange`, `resolveAction`, `connectStickyHeaders`, 오류 클래스입니다. `listLayout`,
  `paginationPages`, `parseStyle`은 렌더러용 새 진입점 `@crudui/generator-core/internal`로
  옮겼습니다. `resolveDesign`, `evalShow`, `evalAppearance`, `makeContext`, `makeTranslate`,
  `rowPathContains`, `HISTORY_LIMIT`, `FORM_BUTTON_TYPES`, `DEFAULT_FORM_BUTTONS`, `LANGUAGES`,
  `formatCount`, 위젯·셀 카탈로그, `renderCell`, `normalizeFormat`은 더 이상 내보내지 않습니다.
- `@crudui/generator-react`, `@crudui/generator-vue`, `@crudui/generator-svelte`는 자신의
  컴포넌트와 렌더 함수만 내보냅니다. `compileForm`, `createForm`, `buildList`, `buildDetail`, 행 키,
  오류 클래스는 `@crudui/generator-core`에서 가져옵니다. 세 패키지는 더 이상 `@crudui/validator`에
  의존하지 않습니다.
- `formHistory`, `viewState`, `runAction`의 signature는 기능의 모든 함수를 적습니다.
  존재하지 않는 `FormError`를 적었던 기능은 `FormInputError`를 적습니다.

### 2026-09-17 — PHP 8.4 이상, 선언한 모든 버전에서 검사

PHP 패키지는 `^8.2`를 선언했지만 CI는 PHP 8.4와 8.5에서만 실행했고, 렌더링 적합성 검사는 PHP 8.4의
HTML5 파서가 필요합니다. `crudui/validator`와 `crudui/generator`는 이제 `^8.4`를
요구하며, 검증기 작업도 native 작업처럼 PHP 8.4와 8.5에서 실행됩니다. `tests/build/runtime-version-policy.test.mjs`는 Composer 매니페스트가 다른 범위를 선언하거나,
PHP 패키지를 검사하는 작업이 선언 범위의 모든 버전을 다루지 않거나, PHP 컨테이너가 가장 최신 검사
버전이 아니면 실패합니다.

### 2026-09-17 — 모든 검증기의 값·패턴 정의 통일

JavaScript·PHP·PHP 확장·Go·Rust 검증기는 공백, 길이가 세는 대상, `in`, 패턴의 의미가 서로
달랐습니다. 이제 `docs/spec/validation-rules.md`가 이를 한 번 정의하고 모든 검증기가 그 정의를
따릅니다.

- 공백은 정확히 Unicode `White_Space` 집합이며 trim은 그 밖의 문자를 지우지 않습니다. `required`는
  값이 없거나 `null`, 공백뿐인 문자열, 빈 배열, 빈 객체이면 실패하고, `mincount`·`maxcount`를 제외한
  나머지 규칙은 이 값들을 통과시킵니다.
- 스칼라의 정규 텍스트는 문자열 자신, 불리언은 `1`/`0`, 숫자는 ECMAScript 표기입니다. 길이 규칙은
  그 코드 포인트 수를 세며 배열과 객체는 실패합니다. 한계값은 0부터 9007199254740991까지의 정수이고
  `rangelength`는 최솟값 ≤ 최댓값이어야 합니다.
- `in`은 목록 원소를 그대로, 쉼표 항목은 trim하여, 맵은 키를 멤버로 쓰며, 정규 텍스트가 같거나
  십진수 값이 같으면 일치합니다. 배열 값은 모든 원소가 통과해야 통과합니다.
- `pattern`과 `match`는 CRUDUI 패턴 언어로 값 전체를 매칭합니다(`\d`·`\w`·`\s`는 ASCII 숫자·단어
  문자·공백, `.`은 U+000A만 제외, 일반 분류와 스크립트). `/x/i` 같은 구분자는 일반 텍스트입니다. 모든
  검증기는 정규식 엔진 대신 패턴을 직접 인식하고 자체 선형 시간 매처로 매칭합니다. JavaScript의 백트래킹은
  60자에 `(?:[^\n]*a){12}c`를 매칭하는 데 148초가 걸렸고, Rust 엔진은 `\p{L}{1000}`에 43MB와 4.4초가
  필요했으며, PCRE2와 Rust는 일부 스크립트나 `\p{Cs}`가 없었고, 엔진들은 4,644개 코드 포인트의 문자 여부가
  서로 달랐습니다. 패턴 크기는 1000 이하, 그룹 중첩은 100단계 이하입니다.
- Unicode 데이터는 `scripts/generate-unicode-properties.mjs`가 `contracts/unicode/`의 Unicode 16.0.0 파일에서
  만든 표 `contracts/unicode-properties.json` 하나에서 가져옵니다. 모든 검증기가 이 표를 내장하며 표가 낡으면
  테스트가 실패합니다.
- 정의를 벗어난 매개변수는 필드 선언 경로에서 `INVALID_RULE_PARAMETER` 또는
  `INVALID_RULE_PATTERN`(사유와 코드 포인트 오프셋 포함)으로 로드에 실패합니다. 조건으로 선택되는
  한계값은 선택될 때 검사합니다.
- 스키마도 같은 매개변수 형태를 기술합니다. 공용 검증 사례는 64개에서 174개로 늘었고 다섯 검증기
  모두에서 실행됩니다.
- 제거: 패턴 구분자 처리, 부분 매칭, 정규식 엔진 번역, 언어별 trim 함수, 길이 한계의 정수 변환.

### 2026-09-17 — 모든 런타임의 폼 버튼 공개

기능 기준은 모든 서버 런타임에 `bindButtons`와 `formButtonsHtml`을 선언했지만 JavaScript만 공개하고
있었습니다. PHP 라이브러리와 PHP 확장은 `Generator::bindButtons`와 `Generator::formButtonsHtml`을, Go는
`BindButtons`와 `FormButtonsHTML`을, Rust는 `bind_buttons`와 `form_buttons_html`을 추가하며, 각 생성기
명령행 어댑터가 두 연산을 제공합니다. 모두 JavaScript와 같은 순서의 버튼 객체와 같은 마크업을 반환하고
같은 입력을 검사합니다. `formButtonsHtml`은 평가된 버튼 목록(`tag`가 `a` 또는 `button`, 문자열 `text`,
`type`, `class`, `style`, `name`, `value`, `href`, `onclick`의 문자열 값만 가진 `attrs`)만 받으며, 그렇지
않으면 `Form buttons must be a list` 또는 `Form buttons must be evaluated button objects`로 실패합니다.
native 실행기가 모든 폼 fixture에서 두 연산과, 모든 런타임에서 거부되는 형태를 비교합니다.

### 2026-09-17 — 테스트 명령 표준 강제

- 모든 테스트는 `node scripts/run-tests.mjs <node|vitest|go|cargo|phpunit>`로 실행합니다. 실행기는
  테스트마다 시작, 실행 중 5초마다 한 줄, 경과 시간을 포함한 결과를 출력하고 테스트마다 자체
  타임아웃(명령이 따로 선언하지 않으면 30초)을 적용합니다. node와 Vitest는 타임아웃에 테스트를
  멈추고, Go·Rust·PHPUnit은 테스트가 타임아웃을 넘기면 실행기가 도구를 멈춥니다.
  `scripts/test-progress/progress.mjs`가 이 줄을 쓰며, native 생성기 실행기, 레거시 비교, 패키지
  설치 검사, 계약 명령 실행기, 빌드 최신성 검사, CI 브라우저 검사, 적합성 검사가 이 모듈로
  출력합니다.
- `tests/build/test-commands.test.mjs`는 package, Composer, Makefile, CI, 기능 검증 명령이 테스트
  도구를 직접 호출할 때, CI 작업에 `timeout-minutes`가 없을 때, 테스트 명령이 공용 줄로 출력하지
  않는 스크립트를 실행할 때, 어떤 명령도 `node:test` 파일을 실행하지 않을 때, TypeScript 패키지에
  `typecheck`가 없거나 CI가 `npm run typecheck`를 실행하지 않을 때 실패합니다. 어떤 명령도 실행하지
  않던 테스트 파일 3개는 `test:form-comparison:source`와 `test:build`에서 실행합니다.
- CI 작업마다 자체 시간 제한이 있습니다. unit 작업의 일부를 반복하던 `current` 작업을 제거했습니다.
  적합성 증거를 기록하는 작업은 증거를 올리고 마지막 작업이 모든 증거를 검사합니다. 폼 인스펙터는
  `npm run test:inspector`로 실행합니다.
- 오래된 경로를 제거했습니다. 패키지 스크립트 `test:current`, `test:list`, `test:watch`,
  `test:coverage`, `test:client`, Composer `test:current`, `tests/package.json`, 사용되지 않던
  `tests/runner/run-js.ts`, `run-php.php`, `tests/runner/go`, `docs-check-all` 별칭입니다. PHP 확장
  API 비교는 `node:test` 파일 `packages/php-ext/tests/api.test.mjs`이고, `make build-php-extension`은
  빌드만 하며 `make test-php-extension`이 엔진·빌더·API 검사를 실행합니다. 패키지 설치 검사는
  명령을 비동기로 실행하며 단계별 제한을 측정 시간의 약 10배로 줄였습니다.
- `npm run typecheck`가 Vue를 포함한 모든 TypeScript 패키지를 검사하며, `canRedo`를 넘기지 않던
  React 개요 테스트를 고쳤습니다.

### 2026-09-17 — 기능 기준에 대한 적합성 증거 검사

`contracts/features.json`이 하나의 기준입니다. 각 기능은 지원 런타임과 그 기능을 증명하는 공용
fixture를 선언하고, 매니페스트는 모든 fixture를 등록합니다. 테스트는 fixture 사례와 기능마다 증거
한 줄을 기록하며(`tests/conformance/evidence.mjs`, `evidence.php`, Go 패키지
`validator/internal/conformance`, Rust 테스트 모듈 `tests/common`), `scripts/check-conformance.mjs`는
지원 런타임의 사례 증거가 없거나 실패했을 때, 선언되지 않았거나 지원하지 않는 런타임의 증거가 있을
때, 등록되지 않은 fixture 가족이 있을 때, 어떤 기능도 증명하지 않는 등록 fixture가 있을 때 실패합니다.
`make conformance`는 기록하는 모든 테스트와 검사를 실행합니다. [적합성 증거](docs/operations/conformance.ko.md)가
런타임 키와 규칙을 설명하며, 제거한 `contracts/conformance-matrix.json`과
`tests/build/conformance-coverage.test.mjs`의 문자열 검사를 대체합니다.

기준은 이제 `buildList`, `validateList`, `validatorCli`, `translateLegacy`를 선언하고, `validate`에 스펙
유효성 fixture를 더하며, `createForm`을 native 인스턴스 시나리오로 증명하고, DOM 세션 기능을 그
시나리오를 실행하는 바인딩에 선언합니다. 기준으로 측정해 다음 빈틈을 찾아 메웠습니다.

- native 실행기가 모든 서버 런타임에서 폼 fixture 92개의 폼 HTML을 바이트 단위로, 모든 목록 fixture의
  목록 모델을 비교합니다.
- PHP 확장이 검증기 CLI fixture를 실행합니다.
- HTML DOM 바인딩이 공용 세션 시나리오를 실행합니다. 이전에는 한 번도 실행하지 않았습니다.
- native 실행기 프로토콜이 `sort` 멤버가 있는 목록 모델만 받았지만, 정렬 선언이 없는 목록에는 그
  멤버가 없습니다.
- `createForm`의 기능 검증 명령이 테스트가 없는 fixture 모듈을 실행하고 있었습니다.

### 2026-09-17 — HTML 렌더러의 노드 유지와 모든 브라우저의 스티키 배지

- `@crudui/generator-core`의 `patchContent(element, html)`은 요소의 내용을 새 마크업으로 바꾸되 새
  마크업에도 있는 노드(행 키, 필드 경로, id, 컨트롤 이름과 값으로 대응)를 모두 유지합니다. HTML
  렌더러가 다시 그린 결과를 매번 이것으로 페이지에 패치하므로, 프레임워크 렌더러처럼 포커스된 컨트롤, 선택 영역,
  입력기 조합이 유지됩니다. HTML DOM 바인딩은 반복 데이터 주입 뒤에도 같은 컨트롤 요소를 요구하는
  공용 초기화 시나리오를 통과합니다.
- 스티키 행 헤더의 레벨 배지는 기본으로 숨기고 `@container scroll-state(stuck: top)` 안에서
  표시합니다. 기존 규칙은 `scroll-state(not (stuck: top))` 안에서 숨겼는데 Firefox와 Safari는 이 규칙을
  무시해 배지가 항상 보였습니다. 이 브라우저들에서는 `connectStickyHeaders(element)`(`connectForm`이
  사용)가 sticky 위치 지정으로 헤더가 행 위쪽에서 밀려난 동안 `data-crudui-stuck`을 붙이고, 다시 그려
  속성이 사라지면 다시 붙입니다. 쿼리를 지원하는 Chromium에서는 아무것도 연결하지 않습니다. Chromium
  검사가 scroll-state 지원·미지원 상태로 페이지, 스크롤 박스, 프레임에서 실행되며 Chromium에는 속성이
  붙지 않음을 확인합니다.

### 2026-09-17 — 모든 서버 런타임의 같은 페이지네이션

PHP 라이브러리, PHP 확장, Go, Rust가 JavaScript와 다른 페이지네이션을 출력했습니다. PHP 라이브러리는
`disabled="1"`을 쓰고 페이지를 마지막 페이지로 맞추지 않았으며, 네 런타임 모두 범위가 제한된 번호 대신
1~7페이지를 나열했습니다. 이제 모든 런타임이 하나의 규칙을 따릅니다. 7페이지까지는 모든 페이지, 그보다
많으면 첫·이전·현재·다음·마지막 페이지이며, 전체 수가 없으면 현재 페이지는 1이고, 마지막 페이지보다 큰
페이지는 마지막 페이지를 선택합니다. 목록 모델은 어디서나 같은 멤버를 같은 순서로 가집니다(`enabled`,
기본값이 적용된 `perPage`·`mode`·`page`, 제공된 `total`, `pageCount`). `pagination` 선언은 `design`처럼
검사합니다. 불리언이거나 `per_page`(1 이상의 정수)와 `mode`(`pages`, `offset`, `cursor`, `none`)를 가진
객체이며, 스키마의 `per_page`는 1 이상의 정수입니다. 목록 fixture는 경계 페이지와 선언 오류를 더해
42개에서 57개가 되었고, native 실행기가 켜짐·선언·꺼짐 상태의 페이지네이션 모델을 비교합니다.

### 2026-09-17 — 실패하던 CI 작업 복구

최근 세 번의 push가 CI에서 실패했습니다. Svelte 헤더와 노드 컴포넌트에 형제 블록 사이 공백이 있어
Svelte가 텍스트로 유지했으며, 공백 없이 다시 작성했습니다. 루트 패키지는 폼 비교 예제가 가져오는
`@crudui/generator-html`을 선언하고, 폼 비교 소스 검사가 이를 빌드합니다. PHP 확장 API 검사는 이전
페이지네이션 마크업을 기대하고 있었습니다. `rustfmt`와 `gofmt`에 맞지 않던 Rust·Go 소스를 정리했습니다.

### 2026-09-16 — 양방향 폼 이력 추가

- 폼 인스턴스는 `redo()`를 제공하고 스냅숏은 `canRedo`를 보고합니다.
- 개요 컨트롤은 실행 취소와 다시 실행을 방향별 사용 가능 여부와 함께 모두 렌더링합니다.
- 실행 취소 뒤에 새 데이터 변경이 생기면 다시 실행 이력을 비웁니다.

### 2026-09-16 — CSR과 SSR에서 CRUDUI 페이지 컨트롤 렌더링

- 목록 렌더러는 공용 페이지 모델에서 이전, 번호, 다음 페이지 버튼을 출력합니다.
- 결정된 현재 페이지의 기본값은 1이며 `aria-current="page"`를 표시하고 경계 컨트롤을 비활성화합니다.
- 파이프라인 예제는 SSR과 CSR 모두 CRUDUI 페이지 출력을 쓰며, 직접 만든 페이지 이동을 제거했습니다.
- 파이프라인 페이지는 주입되는 `page`와 `total` 계약을 런타임 컨트롤 옆에 설명합니다.

### 2026-09-16 — sticky 상태를 헤더 컨테이너에 두기

sticky 노드는 모든 렌더러에서 헤더를 감싸는 `crudui-node__header-container`를 렌더링합니다.
감싸는 요소가 `position: sticky`와 `container-type: scroll-state`를 가지므로, 헤더 슬롯이나 헤더 자체의
스타일을 바꾸지 않고도 헤더의 하위 요소가 감싸는 요소의 고정 상태에 반응할 수 있습니다.

### 2026-09-16 — 행이 머무는 어느 위치에서나 sticky 이음매는 테두리 한 겹

고정 행은 자신의 위쪽 테두리를 갖지 않습니다. 카드의 위쪽 선은 고정되는 박스인 헤더 컨테이너
안에서 그려지고, 컨테이너가 고정되는 동안에는 사라져 바로 위 컨테이너의 선이 이음매가 됩니다.
`scroll-state(stuck: top)` 쿼리가 이 선을 숨기고, scroll-state 쿼리를 지원하지 않는
브라우저에서는 단계 레이블을 표시하는 `data-crudui-stuck` 표시가 같은 방식으로 숨깁니다. 헤더
아래의 선은 컨테이너 안에 있는 헤더 자신의 아래쪽 테두리이고, 고정선은 깊이에 헤더 높이에서 행
테두리 한 겹(`--crudui-row-border`)을 뺀 값을 곱한 값이므로, 고정된 컨테이너는 위 컨테이너의
선 위에 놓이고 고정선에 닿는 행도 자기 선을 같은 위치에 놓습니다. 이전에는 이 테두리가 행에
있어 행과 함께 스크롤했고, 그 선의 테두리 한 겹 아래에 서면서 행이 고정선에 닿는 위치에서
이음매가 두 겹으로 그려졌습니다. 레이아웃 검사는 고정선, 행의 위쪽 테두리 없음, 두 상태의
위쪽 선을 쿼리와 표시 방식 모두에서 확인합니다.

### 2026-09-16 — 교차 검사 게이트웨이에서 모든 검증 fixture 실행

교차 검사 게이트웨이가 공용 폼 검증 fixture 64개를 JavaScript·PHP·Go·Rust 모두로
실행합니다. 멱등 서명은 오류 값 내부 JSON 객체 멤버 순서를 비의미적으로 처리하고 배열
순서는 보존합니다. 기존 단일 smoke 검사가 놓친 Go keyed-scalar `unique` 응답 순서 차이를
검증 범위에 포함했습니다.

게이트웨이는 폼 렌더 fixture 92개도 HTML·React·Svelte·Vue 모두로 실행합니다. public
instance placeholder 사례는 무작위 식별자가 bindForm fixture의 고정 바이트와 같을 수 없으므로
parity와 생성 행 키 계약을 검사합니다. 목록·상세 fixture 전체 실행 범위는 유지됩니다.

Rust validator 릴리스 프로필은 Cargo의 debuginfo strip 단계를 명시적으로 끕니다. 이 설정은
바이너리를 성공으로 처리한 뒤 toolchain 내부 `rust-objcopy`와 `libLLVM.dylib` 조합 실패를
경고로 남기는 환경 의존성을 제거합니다.

실행 가능한 적합성 검사 매트릭스를 추가했습니다. 지원한다고 선언한 대상, 공용 fixture 수,
gateway 검사 연결, native 연산 범위가 완전한지 검사하며, `test:runtimes`에 포함되어 누락된
검사나 지원되지 않는 실행 경로가 있으면 기계적으로 실패합니다.

### 2026-09-16 — 프레임워크 표시를 보존하는 초기화 비교

폼 비교가 각 뷰 컨테이너의 렌더링된 내용만 비교하고 프레임워크가 소유한 컨테이너 표시를
보존합니다. Vue 어댑터는 CSR 마운트 뒤 `data-v-app`를 제거하지 않습니다.

### 2026-09-16 — 초기화 비교를 격리하고 안정화

벤치마크가 CSR 초기화 단계를 시작하기 전에 저장소를 reset하고 두 열의 `added` 단계에서
같은 결정적 신규 행 순서를 사용합니다. Vue hydration은 mount 작업에 hydration 인자를
전달하고 비교기는 CSR의 프레임워크 표시를 렌더링 내용과 분리합니다.

### 2026-09-16 — 벤치마크 실행 소스 식별자 게시

벤치마크 작업 결과가 `/source.json`에서 읽은 소스 식별자를 포함합니다. 따라서 서버 보고서가
하위 보고서를 승인하기 전에 전체 트리 식별자를 검증할 수 있습니다.

### 2026-09-16 — 검증기 계약에 맞춰 초기화 소스 식별자 게시

전용 벤치마크가 프레임의 완전한 소스 식별자를 초기화 보고서의 `source` 필드에 기록합니다.
더 이상 그 객체를 `commit`으로 기록하지 않으므로 초기화·시나리오·서버 식별자를 일관되게
비교할 수 있습니다.

### 2026-09-16 — 브라우저 검증 입력 비우기를 결정적으로 변경

브라우저 검증기가 입력 요소의 표준 선택 API로 검증 입력을 선택한 뒤 값을 삭제합니다.
Chromium의 플랫폼에 따라 달라지는 다중 클릭이나 키 조합 동작에 더 이상 의존하지 않습니다.

### 2026-09-16 — 네이티브 어댑터에서 정본 페이지 메타데이터 보존

PHP·Go·Rust 파이프라인 어댑터가 정본의 `page`와 `total` 옵션을 각 렌더러에 전달합니다.
따라서 다섯 행인 마지막 페이지도 정본 전체 개수 45를 보고합니다.

### 2026-09-16 — 벤치마크 쿼리 선택과 마운트 초기화 단계 보존

benchmark-console redirect가 쿼리 문자열을 보존하므로 각 검증 작업이 선택한 서버와
프레임워크에 도달합니다. 프레임 초기화 계약은 브라우저 런타임이 게시하는 `mounted` 단계를
명시적으로 허용합니다. 현재 트리의 전체 브라우저 검증은 검증과 소스 식별자 검사에 실패했으므로
통과 결과로 기록하지 않습니다.

### 2026-09-16 — 정본 예제가 CRUDUI가 생성한 파이프라인 기능 사용

이전 루트 구현은 잘못되어 있었습니다. 부모 쪽 단계 버튼과 직접 작성한 목록·상세 마크업이 CRUDUI 목록
링크, 상세 링크, 폼 제출, 영속 저장을 거치지 않고 이동을 흉내 냈습니다. 정본 예제는 이제 목록과 상세
출력을 CRUDUI 렌더러로 렌더링하고 실제 HTTP 이동을 사용합니다. 예전 흉내 경로는 호환 경로로 남기지 않고
제거했습니다.

### 2026-09-16 — 비교 검증을 벤치마크 진입점에서 실행

브라우저 검증은 이제 비교 콘솔이 readiness와 작업 API를 소유하는 `/benchmark-console/`을
엽니다. 정본 루트는 페이지 파이프라인으로 유지하며 벤치마크 내부 계약을 노출하지
않습니다.

### 2026-09-16 — 빌드 중 폐기된 공개 경로 산출물 제거

지속되는 빌드 볼륨에서 현재 공개 자산을 복사하기 전에 폐기된 `public/displays/` 산출물을
제거합니다. 소스 디렉터리를 삭제한 뒤에도 이전 생성 경로가 남는 문제를 막습니다.

### 2026-09-16 — 루트 예제를 하나의 CRUD 파이프라인으로 구성

공개 루트가 List → Detail → Form → Save → List refresh를 한 페이지에서 제공하며 단계 간
링크와 클라이언트·서버·CSR/SSR 선택을 명시합니다. 벤치마크 진입점은 `/benchmark/`로
분리했습니다. 사용하지 않는 `/displays/` 경로와 공개 파일을 제거했습니다.

### 2026-09-16 — 소스 동기화 중 기존 비교 컨테이너 재사용

비교 배포는 최초 부트스트랩과 소스 동기화를 구분합니다. 기대한 이미지와 정확한 마운트로 실행 중인
컨테이너는 검사한 뒤 재사용하며, 일반적인 소스 변경은 `containerctl down`을 호출하거나 컨테이너를 다시
만들거나 빌드·캐시·데이터·결과 볼륨을 다시 연결하지 않습니다. 공개 파이프라인은 목록과 상세 렌더링을
Node에서 처리하지 않고 선택한 네이티브 PHP, PHP 확장, Go, Rust 생성기로 전달합니다.

### 2026-09-16 — 정본 표시 진입 화면과 렌더러 범위 수정

첫 `/displays/` 구현은 내부 Cross-Check Console을 공개 진입 화면으로 노출했습니다. 이는
잘못된 구현입니다. 이제 `/displays/`는 같은 public 프로세스에서 프레임워크 독립 HTML 결과를
표시하는 사용자용 목록·상세 화면을 제공합니다. 비교 매트릭스에도 React·Vue·Svelte와 함께
HTML을 포함하여 parity 대상이 네 렌더러가 되었습니다.

### 2026-09-15 — 정본 목록·상세 진입점 추가

정본 `crudui.test` 진입점이 `/displays/`로 연결됩니다. 이 경로는 폼 비교와 같은 public
프로세스에서 기존 목록·상세 검증 및 렌더링 콘솔을 제공하며 다른 서버나 배포를
만들지 않습니다.

### 2026-09-15 — 네이티브 빈 버튼 텍스트에 공용 할당기 사용

PHP 확장은 생략된 버튼 content를 공용 문자열 할당기로 생성하므로 엄격한 GCC 빌드가
비표준 `strdup` 선언에 의존하지 않습니다.

이후 비교 배포한 트리에서 생성 450개, 저장 120개, 브라우저 7,008개 검사를
실패 없이 통과했습니다.

### 2026-09-15 — 네이티브 선택 목록 입력 경로 수정

PHP 확장은 공유 연산을 호출하기 전에 선택적인 `buildList` rows 인자를 초기화하고 검증하므로
GCC의 필수 경고가 네이티브 빌드를 거부하지 않습니다.

### 2026-09-15 — 고정된 OrderedJSON JavaScript 패키지 설치

비교 빌드는 프레임을 빌드하기 전에 고정된 모노레포의 `js/` 패키지를 빌드 트리의
`node_modules`에 복사하므로 다섯 런타임이 같은 리비전을 사용합니다.

### 2026-09-15 — 오래된 검증 벤치마크 제거

레거시 검증기를 실행하고 작은 명세로 조용히 대체하던 사용하지 않는 TypeScript 벤치마크를
제거했습니다. 저장소 벤치마크는 `make bench` 하나이며 명시적인 공용 fixture 입력을 요구합니다.

### 2026-09-15 — 표시 마크업과 검증 오류 순서 정의

목록·상세 렌더러가 문서화한 `crudui-list`·`crudui-detail` 블록 문법을 사용합니다.
표시 형식은 `crudui-value--TYPE`를 사용하며 배지 변형과 불리언 상태는 데이터 속성으로
기록합니다. 다섯 검증 구현은 첫 오류 결과를 같게 하기 위해 키 기반 객체 항목을 키 정렬
순서로 순회합니다. 데이터와 렌더링 행 순서는 입력 멤버 순서를 유지합니다.

### 2026-09-15 — 명시적 ORM 표시 경로 사용

표시 치환을 `{=path}`로 통일하고 기존 `{.path}` 치환을 제거했습니다. 목록과 상세의
`field`와 `sort.field`에서 앞의 점을 제거하여 객체 멤버와 연관 배열 키가 하나의 경로 계약을
사용합니다. ORM 관계 경로를 명시하고 URL·파일 확장자의 점이 치환으로 해석되지 않도록 하기
위한 네이밍 변경입니다.

### 2026-09-15 — 필드 버튼 텍스트 fallback 제거

button·action 필드는 이제 `content`에서만 컨트롤 텍스트를 읽으며 다섯 생성기의
기존 필드 `text` fallback을 제거했습니다.

### 2026-09-15 — OrderedJSON 비교 소스를 변경된 커밋에 고정

비교 소스 버전은 `0.0.1`로 유지하고 깨끗한
`polyspec/ordered-json` checkout을 사용합니다.

### 2026-09-15 — 비교 소스에서 운영자 로컬 편집기 설정 제외

비교 source identity와 동기화에서 운영자 로컬 편집기 설정을 제외합니다.

[English](CHANGELOG.md).

### 2026-09-15 — OrderedJSON 비교 소스를 모노레포에 고정

form-comparison supervisor와 다언어 검증기가 이제 `polyspec/ordered-json`의
변경 불가능한 커밋 하나를 사용합니다. JavaScript, Go, PHP, PHP 확장, Rust는
하나의 체크아웃 안의 패키지 디렉터리로 검증하며, submodule 리비전과 submodule
갱신은 소스 계약에 포함하지 않습니다.

### 2026-09-15 — 검증 러너의 진행 상황을 출력하고 테스트별 제한을 적용

native 생성기, PHP 확장 엔진, 패키지 및 PHPUnit 검증 러너가 실행 중 작업과
경과 시간을 출력하고 각 검사를 자체 측정 제한 시간에 중단합니다. native
검사는 대상과 검사를 선택할 수 있으며 패키지 빌드는 소스·출력 digest가
일치할 때만 기존 결과를 재사용합니다.

### 2026-09-15 — GitHub와 호환되는 문서 제목 앵커 사용

문서 웹이 숫자로 시작하는 제목에 밑줄을 추가하지 않고 제목 앵커를
생성합니다. 따라서 저장소 상대 문서 링크가 GitHub 소스 페이지와 같은 조각을
사용합니다. 웹 빌드 테스트와 영·한 패키지 빌드 명세에 이 규칙을 기록했습니다.

### 2026-09-15 — 유효해야 하는 저장소의 모든 명세를 메타스키마로 검사

`scripts/check-schema.mjs`는 검증 사례만 검사했으므로 저장소가 유효하다고 의존하는 명세가 메타스키마를 통과하지
못해도 어떤 검사도 알아채지 못했습니다. 실패마다 명세 문서와 모든 런타임을 근거로 판정했습니다.

- 필드 `messages`는 모든 검증기가 평문 문자열로 읽지만 닫힌 `Field` 정의에 없었으므로 스키마에 선언했습니다.
- 렌더링 사례 `button-empty`, `action-alias`, `button-behavior-onclick`는 모든 생성기가 읽는 `button`, `action` 위젯의
  컨트롤 텍스트인 필드 키 `content`에서 실패했으므로 스키마에 선언했습니다.
- `$ref`는 모든 런타임에서 문자열 또는 문자열 목록을 받는데(`compose:ref-multiple-order`) 스키마는 문자열만
  선언했습니다. 이제 하나의 `Reference` 정의를 모든 조합 위치에 적용합니다.
- 검증 사례 여섯 개와 목록 조합 파일 하나가 필수 `type` 없이 자식 필드를 선언했으므로 `type: text`를 선언했고
  기대 결과는 그대로입니다.
- compose 사례는 필드 키가 아닌 `from:` 키로 병합 출처를 표시했으므로 같은 목적으로 `label:`을 사용합니다.
- 콘솔 예제 `list-search-conditional`은 모든 런타임이 `per_page`를 읽는 곳에 `pagination.perPage`를 쓰고, 모든
  런타임이 `items`를 읽는 곳에 select 선택지를 `options`로 두어 select가 비어 렌더링되었습니다.
- 조건 맵은 모든 런타임에서 기본이 아닌 키를 순서대로 평가하고 `true` 값, 그다음 `null`로 대체합니다. 필드 명세가
  `true` 키가 필수라고 잘못 적었으므로 `docs/spec/expressions.ko.md`가 이미 밝힌 규칙으로 고쳤습니다.
- 큰 예제 명세에는 중복 YAML 키가 두 곳 있었고 벤치 고정 데이터 생성기가 `uniqueKeys: false`로
  파싱해 이를 숨겼습니다. 파싱 결과가 같도록 중복을 제거하고 생성기가 엄격히 파싱하며, 벤치 고정 데이터는 바이트
  단위로 같습니다. `examples/legacy/basic-form.yml`은 따옴표 없는 값 때문에 파싱되지 않아 따옴표로 감쌌습니다.

상세 렌더링 사례 `content-values`는 문자열이 아닌 언어 맵 항목을 건너뛰는 런타임 규칙을 검사하려고 의도적으로 그런
항목을 선언하므로 사유와 함께 등록했습니다. `tests/fixtures/specs`와 `examples/legacy`의 레거시 명세는 레거시 필드
모델을 쓰므로 중복 키 없이 파싱되고 현재 메타스키마를 통과하지 않아야 합니다.

검사는 입력이나 조합 실패를 기대하는 사례를 제외한 모든 고정 데이터 계열의 폼, 목록, 상세 명세, `$ref`가 고르는 조각으로서의
조합 파일, compose 진입 명세, 검증기 CLI 요청, 폼 세션 명세, `examples/form-structure`, 콘솔 예제, Go·PHP·Rust 패키지
예제에 들어 있는 명세를 다루며 371건이 통과합니다. `per_page`를 `perPage`로 되돌리거나, 조합 파일의 `type`을 지우거나,
면제 사례를 유효하게 바꾸면 각각 검사가 실패했습니다. 재생성한 사례, 그 사례를 읽는 TypeScript 적합성 파일(175건)과
타입 검사, Go validate·compose 패키지, PHP compose·검증 필터(144건), Rust 사례 테스트, 문서 검사가 통과했습니다.

### 2026-09-15 — 메타스키마에서 모든 검증 규칙의 형식을 정하고 모든 깊이의 금지 키 거부

검증기는 규칙 24개(`pattern`은 `match`와 구현 공유)를 등록하지만 폼 메타스키마는 `required`, `email`, `match`만
선언했고, 객체의 속성 이름을 나열한 위치에서만 금지 키 이름을 적용했습니다. 형식을 정하지 않은 값은 검사하지 않아
`validate.max` 조건 맵 안의 `_` 키, `options.items` 요소 안의 금지 키, 상세 필드 `$patch`가 추가한 금지 키가 메타스키마를
통과하고 런타임 검사에서만 거부되었으며, 이 세 사례는 메타스키마 통과로 기록되어 있었습니다.

이제 메타스키마는 등록된 모든 규칙을 선언합니다. 불리언 스위치는 불리언, 표현식, 조건 맵을, 숫자 규칙은 숫자, 표현식,
조건 맵을, `range`와 `rangelength`는 숫자 두 개, 표현식, 조건 맵을 받고, `false`나 `null`은 어떤 규칙이든 끕니다. 모든
엔진이 매개변수를 그대로 넘기는 규칙은 리터럴 형식만 받습니다. `match`, `pattern`, `equalTo`, `enddate`는 문자열,
`notEqual`은 스칼라, `unique`는 불리언 또는 문자열, `accept`는 문자열 또는 문자열 목록, `in`은 쉼표 문자열, 스칼라 목록,
값-라벨 맵입니다. [필드 명세](docs/spec/schema.ko.md)대로 `validate`는 열린 버킷이므로 다른 규칙 이름도 받습니다.
메타스키마가 열어 둔 모든 값은 하나의 재귀 정의를 사용하며, 그 객체는 모든 깊이에서 허용된 키 이름만 가질 수 있습니다.
스키마를 순회하자 변경 전 형식이 없는 위치가 38곳, 변경 뒤 0곳이었습니다. `match`의 조건 맵은 이전에 허용되었지만
TypeScript와 Go는 문자열이 아닌 패턴을 건너뛰어 그런 선언은 검사를 조용히 꺼 버렸습니다. 이제 거부하며, 저장소의 어떤
명세도 그 형식을 쓰지 않았습니다. TypeScript `ValidateSlot` 타입은 같은 규칙을 나열하고 CLI 설명은 열린 버킷을
명시합니다.

세 사례는 `expect: "fail"`과 reason `propertyNames`를 기록합니다. 사례 파일, `examples/form-structure`,
`tests/fixtures/specs`의 명세 368개를 이전 메타스키마와 비교하자 세 사례만 바뀌었고 새로 허용된 명세는 없었습니다.
`scripts/check-schema.mjs`는 103건을 통과했고, TypeScript 메타스키마와 금지 키 적합성 파일 네 개는 77건, CLI 검사는
37건을 통과했으며, 문서 작성 검사, 사례 README 검사, 린트가 통과했습니다.

### 2026-09-15 — 모든 공용 사례 종류에 두 언어 README 제공

`tests/fixtures` 아래 사례 종류 중 compose, form-outline, form-session, specs, translate, validate 여섯 개에도
README가 없었습니다. 이제 각 종류에 사례 필드, 사례가 검사하는 내용, 결과 비교 방식, 사례를 읽는 테스트, 재생성 명령 또는 직접
관리하는 파일을 설명하는 `README.md`와 `README.ko.md`가 있습니다. `tests/docs/fixture-readmes.test.mjs`는 모든 종류에
두 파일이 있는지, 서로 링크하는지, 모든 상대 링크가 유효한지 검사하며, README를 쓰기 전에 실패했습니다. 목록과 상세
운영 문서는 사례 파일 대신 검증 사례 README를 링크합니다. translate 생성기 머리 주석의 반복 단어와 문서 검사를
"now"로 설명한 Makefile 주석을 바로잡았습니다. 문서 검사(25건)와 `make docs-check`가 통과했습니다.

### 2026-09-15 — 모든 런타임에 하나의 구조 검증 사례 계약 적용

폼 명세 사례는 엔진 결과만 `expect: "ok"` 또는 `{error_code, at_path}`로 기록했고, 목록과 상세 사례는 메타스키마
결과를 `expect`와 `reason`에, 엔진 결과를 `engine`에 기록했습니다. 테스트도 서로 다른 필드를 읽었습니다.
`scripts/check-schema.mjs`는 폼 사례를 메타스키마로 검사하지 않았습니다. Go 목록 테스트는 사례의 `engine`과 `files`를
무시하고, 자체 금지 키 목록으로 사례를 분류했으며, 사례와 내용이 다른 자체 파일로 조합했습니다. TypeScript 상세
메타스키마 테스트는 사례 파일을 읽지 않아 상세 `reason`을 검사하지 않았습니다. TypeScript, Go, PHP, Rust, PHP 확장은
목록과 상세 사례에는 `{valid: true, errors: []}` 결과를 요구했지만 폼 사례에는 요구하지 않았습니다.

이제 세 종류는 하나의 형태를 공유합니다. `name`, `note`, `spec`, 선택적 `files`, 해당 메타스키마 결과인 `expect`(`ok`
또는 `fail`), `expect`가 `fail`일 때만 있는 ajv 키워드 `reason`, 엔진 결과인 `engine`(`{valid: true, errors: []}`를
뜻하는 `"pass"` 또는 로드 실패의 `code`와 `at`)입니다. 세 사례 README가 이 계약을 설명합니다. `check-schema.mjs`는
모든 사례의 형태를 검사한 뒤 `expect`와 `reason`을 검사하고, TypeScript에는 폼 메타스키마 테스트가 추가되었으며 상세
테스트는 사례 파일을 읽습니다. TypeScript, Go, PHP, Rust, PHP 확장은 사례마다 `engine`과 `files`를 읽고 `pass`에는
오류 없는 결과를 요구합니다. 통과 폼 사례 세 개는 `required: true`를 선언해 빈 데이터에서 `required` 오류를 반환했으므로
`required: false`로 바꾸었고, 금지 키 검사가 순회하는 키는 그대로입니다. 오류 사례
`err-magic-underscore-default-key`와 `err-inside-array-element`는 메타스키마가 `validate.max`와 `options.items`의
형식을 정하지 않아 통과하므로, 메타스키마를 바로잡을 때까지 `expect: "ok"`로 기록합니다.

목록 사례의 `engine`을 바꾸거나 조합 파일에 금지 키를 넣으면 Go와 Rust 테스트가 실패했습니다. `check-schema.mjs`는
103건을 통과했고, TypeScript(1,677건), PHP(1,539건), Go와 Rust 검사, PHP 확장의 검증 사례 115건, 게이트웨이
검사(204건)가 통과했습니다.

### 2026-09-15 — 모든 예제에 두 언어 README 제공

`examples/form-structure`에는 README가 없었고 교차 검증 콘솔에는 한국어 README가 없어, 미리보기의 목적과 실행
명령이 어디에도 적혀 있지 않았습니다. 이제 `examples/` 아래 모든 디렉터리에 서로 링크하는 `README.md`와
`README.ko.md`가 있고, `tests/docs/example-readmes.test.mjs`가 두 파일, 서로 간 링크, 모든 상대 링크를 검사합니다.
이 테스트는 README를 쓰기 전에 실패했습니다. 폼 구조 README는 `npm run build` 뒤 `npx vite examples/form-structure`를
안내합니다. 이 명령은 페이지, 모듈, 명세, 데이터, `crudui.css`를 제공했고, 헤드리스 브라우저가 저장된 이름이 들어간
노드 57개를 렌더링했습니다. 콘솔 README는 빌드 스크립트가 실행하는 Rust 명령
`cargo build --locked --release --bin validate`를 안내합니다. 예제 README 검사와 문서 작성 검사가 통과했습니다.

### 2026-09-15 — 패키지 예제에서 목록과 상세를 보여 주고 운영 문서 작성

패키지 예제는 폼만 렌더링했고, 목록과 상세를 설명하는 운영 문서가 없었으며, 문서 색인 네 개가 서로 다른 문서를
나열했습니다. 이제 [예제 계약](docs/operations/examples.ko.md)은 현재 예제가 폼, 목록, 상세를 모두 다루도록 요구합니다. Go
서버 예제는 저장한 레코드로 폼과 함께 `/list`와 `/detail`을 제공하고, PHP 예제는 `?view=list`와 `?view=detail`을
제공하며, Rust 예제는 레코드 하나로 렌더링한 폼, 목록, 상세를 출력합니다. [목록과 상세 운영](docs/operations/displays.ko.md)
문서는 JavaScript, 프레임워크, PHP와 PHP 확장, Go, Rust의 생성, 렌더링, 검증 함수와 옵션, 예제, 검사를 설명합니다.
문서 색인 네 개는 같은 문서를 나열하고, 예제 색인은 모든 예제를 나열합니다.

React, Vue, Svelte README는 `Form`에 `session` 속성을 전달하고 `bindForm(template, data)`를 호출하라고 안내했지만,
`Form`은 `form` 속성을 받고 세 패키지 모두 `bindForm`을 내보내지 않습니다. 목록, 상세, 서버 렌더링도 빠져 있었습니다.
이제 각 README는 `form` 속성, `renderForm`, `List`, `Detail`, `renderList`, `renderDetail`과 반환 형식(React와 Svelte는
문자열, Vue는 프로미스)을 보여 주고, Svelte README는 패키지를 Svelte를 인식하는 번들러로 불러온다고 밝힙니다.

Go 예제 테스트가 통과했습니다. Rust 예제는 실행되어 폼 블록 세 개, 목록 하나, 상세 두 개를 출력했습니다. PHP 예제는
세 페이지를 제공했고, 폼으로 레코드를 저장한 뒤 목록은 이름을 상세로 링크했으며 상세는 이메일을 `mailto:`로
링크했습니다. 운영 문서의 JavaScript, PHP, Go, Rust 코드 블록이 실행되었고, React와 Vue README 예제는 빌드된
패키지에서 데이터를 렌더링했습니다.

### 2026-09-15 — 교차 검증 콘솔에서 상세 렌더링과 검증

콘솔은 폼과 목록 렌더링을 비교하고 목록과 상세를 검증했지만 상세를 렌더링하지 못했습니다. 이제
`POST /api/render-detail`로 상세 명세와 레코드 하나를 React, Vue, Svelte에 보내고, 모든 공용 상세 사례를 검사에서
실행하며, 검증과 렌더링을 함께 하는 상세 탭을 제공합니다. 콘솔은 React preload 링크를 자체 패턴으로 제거했고
적합성 검사는 공용 헬퍼를 사용했습니다. 이제 콘솔도 그 헬퍼를 사용합니다. 클라이언트 README는 목록 로드 실패를
`LOAD-ERROR` 셀로 설명했지만 페이지는 `FAILURE`로 표시합니다. 게이트웨이 검사는 204건을 통과했습니다.

### 2026-09-15 — 목록과 상세 design을 폼 design과 같이 검사

목록과 상세에는 컴파일 단계가 없어 목록, 열, 상세, 필드의 알 수 없는 `design` 키를 모든 런타임이 무시했고, 오늘 앞서
고친 상세 사례도 그래서 그런 키로 셀을 꾸몄습니다. 이제 [표시 형식](docs/spec/display-formats.ko.md)은 입력 규칙과 조합
뒤에 폼 선언 규칙과 메시지로 선언을 검사하며, 경로는 `list`, `columns.{name}`, `detail`, `fields.{name}`이고 자체
design을 열이나 필드보다 먼저 검사합니다. JavaScript, Go, Rust, PHP, PHP 확장은 폼, 목록, 상세가 하나의 design 선언
검사를 공유합니다. 공용 목록·상세 사례 다섯 건이 알 수 없는 키, 값 형식, 순서를 다룹니다.

이 변경과 아래 멤버 순서 변경은 Go와 Rust의 같은 목록, 상세, 템플릿 함수를 동시에 수정했으므로 하나의 커밋에 기록합니다.

두 변경은 함께 검증했으며 결과는 멤버 순서 항목 끝에 적습니다.

### 2026-09-15 — 모든 런타임에서 명세 객체에 하나의 멤버 순서 사용

JavaScript는 명세를 일반 객체로 받아 `10` 같은 배열 인덱스 멤버 이름을 먼저 숫자 오름차순으로 나열하고, PHP,
PHP 확장, Go, Rust는 작성한 순서를 유지했습니다. `b`, `10`, `a`로 작성한 필드로 여섯 대상을 측정하자
JavaScript는 `10`, `b`, `a`로, 나머지 런타임은 `b`, `10`, `a`로 컴파일, 렌더링, 검증했고, 목록 열, 상세 필드,
`items` 값 맵, 닫힌 버킷이 보고하는 알 수 없는 키도 같은 차이를 보였습니다. 이제 [필드 명세](docs/spec/schema.ko.md)가
명세 안의 모든 객체, 조합 파일, 조합 결과, 컴파일된 템플릿에 이 순서를 정하고, 레코드 데이터는 들어온 순서를
유지합니다. Go, Rust, PHP, PHP 확장은 명세 입력, 로드한 조합 문서, 조합 결과를 재정렬하고, 바인딩은 받은 템플릿을
재정렬합니다.

공용 사례를 작성하며 두 결함이 드러났습니다. JavaScript 객체로 생성한 사례는 멤버가 이미 JavaScript 순서여서 어떤
런타임에서도 실패할 수 없었고, Rust는 맵을 멤버 순서 없이 비교합니다. 이런 사례는 제거했습니다. 검증 사례는 이제
작성한 순서를 JSON 텍스트로 유지하고, 조합 사례가 패치로 추가한 인덱스 이름을 확인하며, 네이티브 러너는 필드, 조합
필드, `items`, 목록 열, 상세 필드, 알 수 없는 키 보고에 원본 JSON 텍스트를 보내고 배열, HTML, 메시지로 순서를
판정합니다. JavaScript 검증기는 필드가 없을 때 오류의 `value`를 undefined로 두어 JSON에서 멤버가 사라졌고 Go, PHP,
Rust는 `null`을 썼습니다. 이제 모든 오류가 `value`를 가지며 없으면 `null`입니다.

네이티브 비교는 JavaScript, HTML 렌더러, PHP, Go, Rust, PHP 확장에서 각각 259건을 통과했습니다(총 1,555건, 실행 중
입력 변경 없음). PHP 확장 엔진 테스트는 24건을 통과했고, 주소 검사기 테스트는 Linux에서만 실행됩니다. PHP 생성기는
195건, PHP API는 세 구성에서 각각 642건과 구현마다 검증 사례 115건을 통과했습니다. `npm run test:forms`는 core
112건, HTML 257건, React 425건, Vue 396건, Svelte 393건과 10건을 통과했습니다. 검증기는 TypeScript 1,677건,
PHP 1,539건과 Go, Rust 검사를 통과했고, 게이트웨이 검사는 204건을 통과했으며, 빌드, 린트, 포맷, 문서 검사(25건),
문서 웹 검사가 통과했습니다. 이 검사를 실행한 작업 트리에는 이 커밋 뒤에 커밋한 변경도 함께 있었습니다.

### 2026-09-15 — 모든 TypeScript 패키지를 경고 없이 린트

`npm run lint`는 검증기, HTML 렌더러, React 소스만 검사했으므로 core, Vue, Svelte, CLI 패키지와 검증기 벤치마크는
린트된 적이 없었고 경고도 명령을 실패시키지 않았습니다. 이제 `packages`를 `--max-warnings 0`으로 린트합니다. 넓힌
범위에서 소스 14건, 벤치마크 3건이 보고되었습니다. CLI 스키마 투영은 JSON Schema를 `any`로 읽고 쓰지 않는 매개변수를
유지했고, 날짜 파서는 읽지 않는 초기 zone을 대입했으며, Vue 폼은 `h`를 가져오고 쓰지 않았고, Svelte 위젯은 템플릿
문자열에서 `/`를 이스케이프했으며, 벤치마크는 쓰지 않는 타입을 가져오고 실행되지 않는 경로 파싱 벤치마크를 정의했습니다.
CLI는 하나의 타입 노드로 스키마 정의를 읽고, 쓰지 않는 코드는 제거했으며, 경로 벤치마크는 다른 파싱 벤치마크와 함께
실행됩니다. 벤치마크는 콘솔로 결과를 보고하므로 `no-console`을 끄고, `.svelte-kit`, `target`, `vendor` 출력은
제외합니다.

린트는 경고 없이 통과했고 CLI(37건), core(112건), Svelte(393건과 10건) 검사가 통과했습니다. 검증기 벤치마크는 여전히
타입 검사 밖에 있고 레거시 검증기를 측정하며, 이는 남은 작업입니다.

### 2026-09-15 — Vue 서버 렌더러를 vue 피어 의존성으로 가져오기

`@crudui/generator-vue`는 선언한 `vue` 피어 의존성 밖의 개발 의존성 `@vue/server-renderer`를 가져왔습니다. 빌드가
이를 외부 모듈로 다루지 않아 빌드된 진입점에 2.2MB 번들 사본이 들어갔고, 그 ES 모듈에는 이름 있는 내보내기가 없어
빌드된 패키지의 `renderForm`, `renderList`, `renderDetail`이 `renderToString is not a function`으로 실패했습니다.
이제 패키지는 피어 의존성이 제공하는 `vue/server-renderer`를 가져오고 개발 의존성을 선언하지 않으며, 빌드된 ES 모듈
진입점은 24KB입니다.

패키징한 설치 검사는 브라우저 빌드에서 폼만 렌더링했으므로 설치한 패키지로 서버 렌더링을 실행한 적이 없었습니다.
이제 설치한 React와 Vue 패키지에서 `import`와 `require`로, Svelte 패키지에서 Vite `ssrLoadModule`로 폼, 목록,
상세를 렌더링합니다. 이전 import에서는 검사가 같은 오류로 실패했습니다. React는 `react-dom/server`, Svelte는
`svelte/server`를 가져오며 둘 다 피어 의존성에 포함됩니다. Vue 검사는 396건을 통과했고 `npm run test:packages`가
통과했습니다.

### 2026-09-15 — 문서 웹에서 한국어 제목 앵커 유지

문서 웹은 NFKD로 정규화한 텍스트에서 제목 id를 만들었습니다. NFKD는 한글 음절을 자모로 분해하므로 `목록 모델`
같은 한국어 제목은 어떤 한국어 조각 링크와도 맞지 않는 id를 받았습니다. 이제 결합 부호를 제거한 뒤 다시 조합해 한글은
음절을 유지하고, 악센트가 있는 라틴 문자는 계속 부호를 잃습니다. 웹 빌드 테스트는 한국어 제목, 그 제목으로 가는
조각 링크, `Café`를 다룹니다. 웹 빌드 검사는 11건을 통과했습니다.

### 2026-09-15 — 빈 객체를 잃지 않고 기대 PHP 시그니처 비교

후보 검증은 두 PHP 구현이 같은 메서드를 선언하는데도 PHP 모드 검사에서
`Public PHP and extension signatures must match`로 멈췄습니다. 검사는 기대 시그니처를 연관 배열로 디코딩했고,
이 방식은 빈 객체 기본값을 빈 배열로 바꿉니다. 상세 메서드가 `record = new stdClass()`를 선언하므로
기대값 `{}`가 `[]`가 되어 리플렉션한 `{}`와 맞지 않았습니다. 이제 검사는 기대 시그니처를 객체로 디코딩해 그대로
비교합니다. 로컬에서 순수 PHP 시그니처를 객체로 쓰고 다시 읽으면 같았고, 연관 배열 왕복은 불일치를 재현했습니다.

### 2026-09-15 — 스키마가 닫은 버킷의 알 수 없는 키 거부

스키마는 `multiple`, `lang`, `design`과 그 노드, `behavior`를 닫지만, 폼 컴파일은 그 안의 알 수 없는 키를 검사하지
않는다고 명시했고 타입 모델은 스키마와도 서로와도 달랐습니다. Rust는 여덟 버킷 모두에 알 수 없는 키를 보존했고,
TypeScript는 `multiple`과 `lang`을 열었으며, Go는 `options`를 제외한 모든 곳에서, 열린 `validate` 버킷의 규칙까지
알 수 없는 키를 조용히 버렸습니다. 그래서 `multiple.maximum`이나 `design.label.text` 같은 잘못 쓴 키는 아무 효과도
보고도 없었습니다.

이제 모든 폼 컴파일러가 이런 키를 `Invalid {bucket}.{key} at {path}: unknown key`로 거부하며, 버킷 안에서는 값보다
먼저 선언 순서로 키를 검사하고 순서는 `buttons`와 `action`, `multiple`, `lang`, `design`과 그 노드, `behavior`입니다.
타입 모델은 버킷마다 스키마를 따라 닫힌 버킷은 알 수 없는 키를 거부하고 `validate`, `options`, 동적 `items` 원천은
보존합니다. Go 컴파일러는 디자인이 없는 필드에서 일찍 반환해 behavior 검사를 건너뛸 구조였고, Go의 타입 `validate`는
이제 알 수 없는 규칙을 보존합니다.

추적하는 모든 명세를 이 규칙으로 검사해 공용 상세 사례 `design-wrapper-and-cell`이 어떤 런타임도 읽지 않는
`design.main` 키로 셀을 꾸며 셀 스타일을 전혀 검사하지 못했다는 것을 찾았습니다. 이제 `design.class`와
`design.style`을 선언합니다.

공용 컴파일 거부 사례 여섯 건이 각 버킷, 디자인 노드, 값 오류보다 알 수 없는 키가 먼저 보고되는 순서를 다룹니다.
`make test-native`에서 여섯 대상이 각각 247건 중 247건을 통과했습니다(입력 불변 검사 포함 1483건). 검증기 검사는
JavaScript(1642건), Go, PHP(1529건), Rust(73건)에서 통과했고, 콘솔 검사는 166건 중 166건, 메타 스키마 검사는 80건을
통과했으며, test:forms, lint, format-check, manifest:test, test:docs, docs-check가 통과했습니다.

### 2026-09-15 — 검사가 실행하는 대상을 실행 전에 빌드하고 설치

폼 구조 작업 중 기록한 발견 세 가지는 규칙이 필요해 열려 있었고, 공용 사례 하나는 스키마와 맞지 않았습니다.
- `make test-native`는 보고서를 `.git/native-generators`에 썼는데, `.git`이 파일인 Git worktree에서는 이 경로를
  만들 수 없습니다. 이제 보고서 경로는 `git rev-parse --git-path`에서 오며 일반 체크아웃에서는 같은 경로입니다.
- 교차 검증 콘솔 검사는 Go와 Rust 검증기 프로그램을 고정 경로에서 실행하면서 소스와 맞는지 확인하지 않았습니다.
  오늘 Rust 프로그램이 없어 로컬에서 23건이 실패했고, 이전 실행은 소스보다 오래된 프로그램을 썼습니다. 이제
  콘솔의 `npm test`가 두 프로그램을 먼저 빌드하며, CI는 별도 단계로 빌드하지 않습니다.
- generator-php는 패키지 빌드 규칙대로 검증기를 복사본으로 설치하고, 복사본은 이후 소스 변경을 따라가지 않습니다.
  오늘 네이티브 검사가 두 번 오래된 복사본으로 실행되었습니다. 이제 `make test-native`가 어떤 검사가 읽기 전에
  복사본을 다시 설치합니다.
- 금지 키 사례 `ok-plain-spec`은 `design.label`에 문자열을 주었는데 스키마와 폼 컴파일러는 이를 거부합니다. 이제
  라벨 클래스를 선언합니다.

`make test-native`는 복사본을 다시 설치하고 Git 경로로 보고서를 쓰며 여섯 대상에서 각각 241건 중 241건을
통과했습니다(입력 불변 검사 포함 1447건). 콘솔 검사는 `pretest`로 두 검증기 프로그램을 빌드하고 166건 중 166건을
통과했습니다. 금지 키 사례는 JavaScript(24건), Go, PHP(23건), Rust, PHP 확장(세 구성에서 각각 API 585건, 검증
113건, 기존 건너뜀 하나와 함께 엔진 24건)에서 통과했습니다. test:forms, lint, format-check, manifest:test,
test:docs, docs-check가 통과했습니다.

### 2026-09-15 — 상세 입력 순서를 강제하고 규칙을 라이브러리에 유지

표시 형식 명세는 상세 입력 규칙을 순서대로 나열하지만 공용 상세 사례는 한 번에 규칙 하나만 어겨 순서가 검사된 적이
없었습니다. 규칙 두 개를 함께 어기는 사례를 추가하자 네이티브 러너의 JavaScript 프로토콜 어댑터와 Go, PHP 생성기
명령이 라이브러리를 호출하기 전에 레코드를 직접 검사한다는 것이 드러났습니다. 명세와 레코드가 모두 잘못되면 이들은
레코드를 보고했고 라이브러리는 명세를 보고합니다. JavaScript 어댑터는 `null` 레코드를 빈 객체로 바꾸기도 했는데,
다른 런타임은 그렇게 하지 않습니다.

어댑터가 단순히 라이브러리에 맡길 수는 없었습니다. Go와 PHP 상세 시그니처는 레코드를 객체로 받으므로 객체가 아닌
레코드는 JSON을 해석하는 곳에서만 거부할 수 있고, 문서의 순서는 `fields` 규칙이 레코드 규칙보다 앞섰습니다. 모든
어댑터에 `fields` 규칙을 복사하는 대신, 목록 규칙이 이미 따르던 원칙 하나로 순서를 정했습니다. 인자 형태를 인자
순서대로(명세, 레코드) 검사하고, 그다음 선언(`fields`), 마지막으로 옵션(`data`)을 검사합니다. JavaScript, Rust, PHP,
C 라이브러리가 이 순서로 검사하고, JavaScript 어댑터는 해석한 레코드를 그대로 넘기며, Go 명령은 명세가 객체일 때만
레코드를 검사합니다. 공용 사례 세 건이 각각 규칙 두 개를 어깁니다.

상세 사례는 28건입니다. `make test-native`에서 여섯 대상이 각각 241건 중 241건을 통과했습니다(입력 불변 검사
포함 1447건).

### 2026-09-15 — 모든 언어에서 상세 명세 검증

`validateDetail`은 JavaScript에만 있었고 기능 상태는 부분 구현이었으며, 공용 상세 검증 사례는 어떤 엔진도 읽지
않는 메타 스키마 사례 두 건이었습니다. 이제 Go, PHP, PHP 확장, Rust도 JavaScript처럼 상세 명세를 검증합니다.
루트와 `fields` 맵을 합성한 뒤 어디에 있든 금지 메타 키를 로드 실패로 거부합니다. 공용 사례는 열 건으로 늘었고,
사례마다 메타 스키마 판정과 함께 엔진 판정(`pass` 또는 코드와 위치)을 선언하며, 모든 언어와 명령행 어댑터,
교차 검증 콘솔(`/api/validate-detail`)이 이를 실행합니다.

사례를 작성하며 기대값 두 개를 바로잡았습니다. 기반 명세만 참조하는 루트에도 메타 스키마는
`fields`를 요구하고, `$patch` 안은 읽지 않으므로 패치가 추가한 금지 키는 메타 스키마를 통과하고 엔진에서
실패합니다.

그 과정에서 두 가지 차이가 드러났습니다.
- 검증기 명령행 어댑터가 `mode`를 서로 다르게 처리했습니다. JavaScript와 Rust는 알 수 없는 값이면 폼 검증을
  실행했고, Go는 자체 메시지로 실패했으며, PHP는 `Unsupported validation mode`로 실패했지만 Go처럼
  `"mode": null`을 생략으로 읽었을 것입니다. 이제 모든 어댑터는 `mode` 생략(폼)이나 `form`, `list`, `detail`만
  받고, `null`을 포함한 그 밖의 값은 `{"error": "Unsupported validation mode"}`와 종료 코드 1로 실패합니다.
- JavaScript는 목록 루트와 상세 루트를 같은 함수의 두 복사본으로 합성했고, 두 복사본은 `$ref` 앞에 쓴 자체 키가
  남는지가 달랐습니다. 이제 두 검증기는 목록 동작인 하나의 루트 합성을 공유합니다.

이어서 잘못된 요청으로 어댑터를 측정하자 폼 데이터 처리만 같았습니다. 잘못된 JSON, 객체가 아닌 요청, 없거나
객체가 아닌 `spec`은 네 가지 다른 메시지를 냈고(Go와 PHP는 파서나 타입 오류를 그대로 출력), Go는 `spec`보다
`mode`를 먼저 검사했으며, 객체가 아닌 `files`, 객체가 아닌 파일 항목, 문자열이 아닌 `basepath`를 JavaScript와
Rust는 무시했고 Go와 PHP는 각자의 메시지로 거부했습니다. 이제 모든 어댑터가 하나의 순서와 규칙별 하나의
메시지로 요청을 검사하고(올바른 JSON, 객체인 요청, 객체인 `spec`, 지원하는 `mode`, 항목이 객체인 객체 `files`,
문자열 `basepath`), 공용 [명령행 요청 사례](examples/cross-check-console/validators/README.ko.md)가 교차 검증 콘솔 검사로 네
언어에서 실행됩니다. PHP 자체 명령행 검사는 `files`를 JSON 배열로 보냈으며 이제 객체로 보냅니다.

JavaScript 검증기 검사 1642건 중 1642건, Go 검증기 패키지, Rust 73건 중 73건, PHP 1528건 중 1528건이 통과했고, PHP
확장 엔진 검사는 기존 건너뜀 하나와 함께 24건이 통과했습니다. PHP API 검사는 세 구성에서 각각 585건, 구현마다
검증 113건을 통과했습니다. 교차 검증 콘솔 검사는 네 언어의 상세 검증 사례 열 건과 요청 사례 열아홉 건을 포함해
166건 중 166건을 통과했습니다. 메타 스키마 검사는 80건을 통과했고, `make test-native`는 여섯 대상에서 각각
238건 중 238건을 통과했으며, lint, format-check, test:forms, manifest:test, test:docs, docs-check가 통과했습니다.

### 2026-09-15 — 모든 런타임에서 하나의 규칙으로 콘텐츠 텍스트 결정

스키마는 콘텐츠를 문자열이나 항목이 문자열인 언어 맵으로 정의하지만, 런타임이 이를 텍스트로 바꾸는 방법은
어느 명세에도 없었습니다. 그 형태를 벗어난 값으로 여섯 대상을 측정하자 다섯 가지 동작이 드러났습니다.
- 언어 맵의 숫자 항목(`prefix: { en: 7 }`)을 JavaScript, PHP, PHP 확장, Go는 텍스트로 썼고, Rust는 건너뛰고
  다음 언어로 넘어갔습니다.
- 숫자인 선택 라벨(`items: { a: 3 }`)은 모든 곳에서 `3`이었지만, 다른 콘텐츠 설정은 숫자를 받으면 빈 텍스트를
  썼습니다.
- JavaScript는 객체인 언어 맵 항목을 `[object Object]`로 썼습니다.
- 링크 문구, 뱃지, bool 라벨의 언어 맵 항목이 숫자이면 JavaScript 번역기가 숫자를 돌려주어 HTML 렌더러가
  `value.replace is not a function`으로 실패했습니다.
- C 확장은 `text`가 `0`이나 `false`이면 셀 값을 링크 문구로 썼습니다. 다른 모든 런타임은 빈 텍스트를 쓰며,
  `text`가 없거나 `null`이거나 빈 문자열일 때만 셀 값으로 대체합니다.

이제 [필드 명세](docs/spec/schema.ko.md)가 Rust가 이미 따르던 규칙을 정합니다. 문자열은 그대로이고, 언어 맵은
표시 언어 항목, `en`, `ko`, 첫 키 순서에서 처음으로 비어 있지 않은 문자열 항목이 되며, 그 밖의 값은 빈
텍스트입니다. JavaScript, PHP, PHP 확장, Go의 번역기가 이 규칙을 따르고, 모든 런타임의 선택 라벨이 이를 쓰며,
C 확장의 링크 문구는 다른 런타임과 같은 경우에만 대체합니다. 번역기는 폼 콘텐츠도 결정하므로 폼 라벨도 같은
규칙을 따릅니다. 공용 상세 사례 `content-values`가 각 동작을 다룹니다.

상세 사례는 25건입니다. `make test-native`에서 여섯 대상이 각각 238건 중 238건을 통과했고(입력 불변 검사 포함
1429건), 형식 세부 동작 측정 스크립트는 여섯 대상에서 같은 결과를 보고했습니다.

### 2026-09-15 — 목록 pageMeta 옵션을 page와 total로 바꾸고 JavaScript 입력 오류에 코드 부여

목록 옵션 `pageMeta`는 호출자가 주는 현재 페이지와 전체 레코드 수를 담았지만 이름이 둘 중 무엇도 말하지 않았고,
멤버에 값 규칙이 없어 어떤 값이든 `data-page`·`data-total` 속성이 되었으며 공용 사례는 숫자만 다뤘습니다. 이제
목록은 `page`(1 이상 정수)와 `total`(0 이상 정수) 두 옵션을 받고, 둘 다 모든 런타임이 정확히 표현하는 가장 큰
정수 9007199254740991 이하여야 합니다. 그 밖의 값은 `data` 다음, `layout` 앞에서 검사해
`List page must be a positive integer` 또는 `List total must be a nonnegative integer`로 실패합니다. `pageMeta`는
제거했고 PHP의 고정 객체 옵션 목록에서도 뺐습니다.

이 규칙을 넣으며 다른 차이도 드러났습니다. 상세는 옵션을 목록 엔진에 넘기므로 JavaScript, Go, Rust 라이브러리는
상세 옵션의 잘못된 `page`를 거부했을 것이고, PHP 라이브러리는 이를 제거했으며 C 확장은 읽지 않았습니다. 이제
모든 런타임에서 상세는 `data`, `language`, `files`, `basepath`만 받고 `page`, `total`, `layout`은 검사하지도
사용하지도 않으며, 공용 상세 사례 `list-options-ignored`가 이를 강제합니다.

교차 검증 콘솔 게이트웨이 CI 작업이 실패했습니다.
JavaScript 생성기는 입력 오류를 코드 없는 `TypeError`로 던져 게이트웨이가 `RENDER_ERROR`로 분류했고, 다른 모든
런타임은 `INVALID_FORM_INPUT`을 보고합니다. 네이티브 러너의 JavaScript 어댑터가 코드 없는 오류에
`INVALID_FORM_INPUT`을 채워 넣어 이 차이가 드러나지 않았습니다. 이제 generator-core의 모든 입력 오류는 검증기의
`FormInputError`이며 generator-core에서도 내보냅니다. 어댑터는 코드가 없으면 `INTERNAL_ERROR`로 기록하고,
게이트웨이는 코드와 함께 메시지도 비교합니다. 게이트웨이는 배열이 아닌 행을 렌더링 전에 빈 목록으로 바꾸고
있었는데, 이제 그대로 넘깁니다. 게이트웨이 설명은 더는 없는 프레임워크별 레이아웃 키를 적고 있어 단일
`layout` 키로 고쳤습니다.

어댑터 기본값을 없애자 JavaScript 폼 인스턴스도 잘못된 행 조작(없거나 중복된 행 키, 최소·최대 행 수, 잘못된
위치, 잘못된 시퀀스, 비어 있는 되돌리기 이력)에 코드 없는 `Error`와 `RangeError`를 던진다는 것이 드러났습니다.
다른 모든 런타임은 이를 `INVALID_FORM_INPUT`으로 보고합니다. 이제 이 오류들도 `FormInputError`입니다. C 확장은
`A sequence must contain 1-13 decimal digits`에 하이픈을 썼고 다른 런타임은 en dash를 씁니다. 이제 같습니다.

목록 사례는 39건, 상세 사례는 24건입니다. `make test-native`에서 JavaScript, HTML, PHP, Go, Rust, PHP 확장이
각각 237건 중 237건을 통과했고(입력 불변 검사 포함 1423건), Go·Rust 검증기 명령을 다시 빌드한 뒤 게이트웨이
검사가 135건 중 135건을 통과했습니다.

### 2026-09-15 — 표시 형식을 문서화하고 모든 런타임에 하나의 입력 규칙을 강제

목록 열과 상세 필드가 선언할 수 있는 형식은 스키마와 구현에만 드러나 있었습니다.
[표시 형식](docs/spec/display-formats.ko.md)은 형식마다 옵션과 기본값, 입력 규칙과 메시지, 마크업을 정리하며
문서 웹의 명세 항목에 게시됩니다.

이 문서를 기준으로 여섯 대상을 측정해 공용 사례가 다루지 않던 차이와 결함을 찾았습니다.
- 잘못된 목록 입력의 처리가 런타임마다 달랐습니다. 객체가 아닌 명세, 배열이 아니거나 객체가 아닌 행,
  객체가 아닌 `data`·`pageMeta` 옵션, 알 수 없는 `layout`을 어떤 런타임은 거부하고 어떤 런타임은 기본값으로
  바꿨으며, 거부하는 경우에도 메시지가 달랐습니다. 이제 모든 런타임이 한 순서, 한 메시지로 검사하고 없거나
  `null`인 옵션은 기본값을 씁니다.
- 모든 런타임이 `truncate`를 UTF-16 코드 단위로 세어 이모지가 반으로 잘릴 수 있었고, JavaScript와 Go는 숫자
  문자열도 적용했습니다. 이제 모든 런타임이 코드 포인트를 세고, 숫자에만 적용하며, 정수 부분을 쓰고 1 이상을
  요구합니다.
- JavaScript는 `decimals` 범위를 검사하지 않았고, 검사하던 런타임끼리도 메시지가 달랐습니다. 예를 들어 PHP는
  `Decimal places must be between 0 and 100`으로 실패했습니다. 이제 모두
  `Number decimals must be between 0 and 100`으로 실패합니다.
- 객체가 아닌 상세 `data` 옵션을 거부하는 런타임이 없었습니다. 이제 모두 `Detail context must be an object`로
  실패합니다.
- Rust 라이브러리는 `pageMeta`를 맵으로, `layout`을 문자열로 받아 두 규칙이 명령행 어댑터에만 있었고, 공용
  사례 검사는 잘못된 행을 빈 목록으로 바꿨습니다. 이제 Go처럼 두 옵션을 값으로 받아 라이브러리가 검사합니다.
  행을 시퀀스로 받는 Go와 Rust에서는 해석한 JSON을 그 시퀀스로 바꾸는 곳에서 행 규칙을 적용하며, 명세에 이를
  적었습니다.

목록 사례는 31건, 상세 사례는 23건으로 늘어 규칙마다 사례가 있고, 네이티브 러너는 메시지를 선언한 오류
사례의 메시지를 비교합니다. JavaScript, HTML, PHP, Go, Rust, PHP 확장이 각각 228건 중 228건을 통과했습니다(입력
불변 검사 포함 1369건). 목록 입력(14개)과 형식 세부 동작(19개) 측정 스크립트는 여섯 대상에서 같은 결과를
보고했습니다.

### 2026-09-15 — 계약 검증 명령을 패키지 검사로 유지

폼 인스턴스 CI 작업이 실패했습니다. `npm run manifest:test`는 계약 목록의 모든 검증 명령을
실행하는데, `buildDetail`과 `renderDetail`의 계약이 `make test-native`를 선언했습니다. 이 작업에는 네이티브 PHP
도구가 없어 확장 빌드가 `Path contains a symbolic link: /usr/bin/php-config`에서 멈췄습니다. 다른 모든 계약은
패키지 검사만 선언하며, 네이티브 비교는 `tests`의 러너로 기록하고 전용 CI 작업에서 실행합니다. 그 작업은
통과했습니다.

두 상세 계약도 다른 계약처럼 패키지 검사만 선언합니다. `run-contract-tests.mjs`로 코어 상세 검사와 HTML·React
상세 적합성 검사가 통과했고 `make docs-check`와 `npm run test:docs`가 통과했습니다.

### 2026-09-15 — 모든 런타임에서 상세 보기를 같은 수준으로 강제

상세 보기는 JavaScript와 Go에만 있었고 그 출력을 비교하는 검사가 없었습니다. 세 커밋이 PHP·Rust 상세 렌더링과 네이티브 러너의 원본 HTML 상세 사례, PHP JSON 경계 문서를
추가했습니다. 그 상태에는 네 가지 빈틈이 있었습니다. 러너는 HTML만 비교했고, 러너가 모든 사례를
보내는데도 C 확장에는 상세 연산이 없었으며, JavaScript 렌더러는 각자의 부분 문자열 검사를
유지했고, 커밋 메시지는 내용의 일부만 설명했습니다. 이번 변경과 직전 변경이 그 구현과 문서를 기록합니다.

모든 런타임을 측정해 어떤 검사도 보지 못한 차이 세 가지를 찾았습니다.
- 레코드에 없는 경로에서 JavaScript는 셀의 `value`를 생략했고, Go는 `{}`, Rust는 `null`을 썼으며,
  PHP는 생략해 상세 모델이 정의되지 않은 속성 경고를 냈습니다. 이제 행에 값이 없으면 셀의
  `value`는 `null`이고 멤버는 목록과 상세 모두에서 항상 있습니다. 렌더링된 HTML은 바뀌지 않습니다.
- 이미지의 `width`나 `height`를 `null`로 선언하면 다른 모든 런타임은 `width=""`, `height=""`를 쓰는데
  C 확장은 두 속성을 생략했습니다. 이제 같습니다.
- PHP API 계약대로 모든 PHP API는 빈 PHP 배열을 빈 루트 객체로 읽는데, PHP 라이브러리와 확장의 상세
  메서드는 이를 거부했습니다. 이제 계약을 따르며, PHP 명령행 어댑터는 모든 런타임과 마찬가지로 JSON
  배열을 계속 거부합니다.

규칙은 런타임이 제공하는 두 수준에서 모두 강제합니다. `tests/fixtures/detail-render/cases.json`에는
React에서 생성한 사례 19개가 있습니다. React, Vue, Svelte, HTML 렌더러는 각자의 부분 문자열 검사 대신
이를 적합성 검사로 실행합니다. 네이티브 러너는 모든 사례를 JavaScript, HTML 렌더러, PHP 라이브러리,
Go, Rust, PHP 확장에 `buildDetail`로 보내 멤버 순서까지 같은 모델을 요구하고, `renderDetail`로 보내
이미지 preload 링크를 포함해 바이트 단위로 같은 HTML을 요구합니다. C 확장은 목록 경로와 이제 공유하는
셀 코드 위에 두 연산을 구현합니다. 모든 런타임은 객체가 아닌 선언, `fields`가 없는 선언, 객체가 아닌
레코드를 같은 메시지로 거부합니다.

두 가지 발견 사항은 남아 있습니다. C 확장은 스키마가 허용하지 않는 `0`이나 `false`가 `text`일 때 여전히
셀 값을 링크 문구로 씁니다. 상세 명세 검증(`validateDetail`)은 JavaScript에만 있으므로 상세 기능은 진행
중으로 남습니다.

`make test-native`는 모든 대상이 사용 가능한 상태에서 검사 1,285개를 모두 통과했고 여섯 대상이 각각
214개를 통과했습니다. PHP 생성기 검사 173개가 통과했습니다. 확장은 세 구성마다 API 검사 396개와 엔진 검사 24개를 통과했고
Linux 전용 검사 1개는 건너뛰었습니다. React, Vue, Svelte, HTML 렌더러가 각각 상세 적합성 사례 19개를
통과했고, Go와 Rust 생성기 검사, `npm run lint`, `npm run test:docs`, 코어·React·HTML 타입 검사,
`make docs-check`, `npm run test:forms`가 통과했습니다.

### 2026-09-15 — 목록과 상세 고정 데이터가 preload 링크 도우미를 공유

프레임워크 적합성 검사는 React 서버 렌더링과 HTML 렌더러가 목록 앞에 쓰는 이미지 preload 링크를
제외하고 목록을 비교하며, 네이티브 생성기 검사는 전체 HTML을 비교합니다. 이 규칙은 목록 전용 이름인
`listBody`로 `tests/fixtures/list-render/list-body.mjs`에 구현되어 있었습니다. 상세 고정 데이터도 같은
규칙을 따르므로 도우미를 `tests/fixtures/preload-links.mjs`의 `withoutPreloadLinks`로 옮겼고, 목록
고정 데이터 생성기와 React·HTML 목록 적합성 검사가 이를 사용합니다.

목록 고정 데이터를 다시 생성해도 바이트가 같았고 React와 HTML 목록 적합성 검사가 통과했습니다.

### 2026-09-15 — generator-core를 선언한 라이브러리로 빌드

모든 CI 작업이 `npm run build`에서 실패했습니다. `detail.ts`가 패키지가 선언한
TypeScript 라이브러리에 없는 `Object.hasOwn`을 호출했습니다. 그 커밋은 변경 기록 문구 수정으로
설명했지만, 모든 변경을 스테이징하면서 진행 중이던 상세 작업도 함께 커밋했습니다. 상세 모델의 입력
검사(객체가 아닌 선언, `fields`가 없는 선언, 객체가 아닌 레코드가 각각 고유한 메시지로 실패), 그
검사, 공용 상세 픽스처의 생성 스크립트(사례 파일 없음)입니다. 스테이징한 내용을 검토하지 않고 빌드도
하지 않은 채 커밋한 제 잘못입니다.

자기 속성 검사는 이제 `Object.prototype.hasOwnProperty.call`을 사용합니다. 상세 입력 검사는 올바르고
검증되었으므로 유지하며, 남은 상세 작업은 별도 변경으로 이어갑니다. `npm run build`, `npm run lint`,
`npm run test:docs`, `make docs-check`, 코어 상세 검사가 통과했습니다.

### 2026-09-15 — 스크립트 URL 정규식을 lint에서 유지

CI가 HTML 렌더러에서 실패했습니다. 기준 렌더러에서 이식한 스크립트 URL 정규식을
`no-control-regex`가 거부했습니다. 이 정규식은 URL이 스킴 글자 사이에 숨길 수 있는 제어 문자를
건너뜁니다. 

정규식은 기준 렌더러가 쓰는 그대로 두고, 해당 줄에만 규칙을 끄면서 제어 문자가 의도된 것임을
주석으로 밝혔습니다. `npm run lint`가 통과하고 HTML 렌더러 검사 207개가 통과했습니다.

### 2026-09-15 — 서버 렌더링 프레임의 후보 검증 결과 기록

후보 검증이 통과했습니다. 생성 검증은 HTTP 요청 899개에서 결과 450개를 모두
통과했고, 여기에는 빌드된 프레임 문서, 레코드 페이로드가 있는 SSR 폼 HTML, 조합마다 거부해야 하는
SSR 쿼리 10개가 포함됩니다. PHP 두 모드는 각각 생성 검사 62개와 저장소 검사를 통과했습니다.
서버별 브라우저 실행은 1,752개를 모두 통과했고 집계는 실패 없이 7,008개를 통과했습니다. 시나리오
1,216개, 초기화 비교 5,376개, 상호작용 320개, 로드 전 마운트 32개, 프레임 문서 64개입니다. PHP는
340,871밀리초, PHP 확장은 306,669, Go는 276,126, Rust는 265,581밀리초로 모두 900,000밀리초
제한 이내였습니다.

기능 기록에 이 결과와 소스 아카이브 digest, 이미지 digest를 적었습니다.

### 2026-09-15 — 열 비교에 렌더링 노드 규칙 적용

후보 검증이 Vue에서 다시 실패했습니다. Vue 초기화 보고서마다 비교 168개 중 16개가 실패했고,
하이드레이션한 열은 서버의 style 속성 원문(`--crudui-sticky-depth:0`)을 유지한 반면 마운트한 열은
Vue가 계산한 선언 블록(`--crudui-sticky-depth: 0;`)을 가지고 있었습니다. 명세는 style 속성을 CSS
객체 모델이 직렬화한 선언으로 비교하고 렌더링 기준점 노드를 제외한다고 이미 적고 있었지만, 그
규칙은 프레임의 하이드레이션 검사에만 구현되어 있었고 페이지는 속성 원문을 비교했습니다. React는
하이드레이션하면서 속성을 정규화하고 HTML 렌더러는 두 열에 같은 마크업을 쓰므로 Vue에서만 이
공백이 드러났습니다.

이제 규칙은 공용 폼 인스펙터의 함수 하나(`renderedNodes`)입니다. 프레임워크가 기준점으로 두는
주석과 빈 텍스트를 제거하고 모든 style 속성을 선언 블록으로 다시 씁니다. 프레임의 하이드레이션
검사와 페이지의 열 비교가 모두 이 함수를 사용합니다.

폼 인스펙터 검사 20개가 통과했습니다.

### 2026-09-15 — 비교 대상을 뷰 컨테이너가 담은 것으로 정의

프레임 문서 변경의 후보 검증이 Vue 두 렌더링 경로에서 실패했습니다. Vue 초기화 보고서마다 비교
168개 중 18개가 실패했고 첫 차이는 폼 뷰 요소 자체였습니다. `csr` 열의 컨테이너에는
`data-v-app=""`이 있고 `ssr` 열에는 없었습니다. Vue는 이 속성을 `createApp().mount()`에서 쓰고
하이드레이션하는 `createSSRApp()` 마운트에서는 쓰지 않습니다. 즉 이 속성은 렌더링된 내용이 아니라
그 열이 어떻게 시작했는지를 기록합니다. 이전에는 두 열이 모두 마운트했기 때문에 드러나지
않았습니다.

이제 비교는 `renderedViews`로 뷰 컨테이너가 담고 있는 것을 대상으로 하며, 페이지에 속한 컨테이너
자체는 대상이 아닙니다. 하이드레이션은 이전보다 더 엄격하게 강제됩니다. SSR 프레임은 인계 후 폼
DOM이 그대로인지 확인하고, React·Vue·HTML 렌더러에서는 서버가 렌더링한 모든 요소가 남아 있는지
확인합니다. 명세에 Vue의 표시와 하이드레이션 강제 위치를 기록했습니다.

폼 인스펙터 검사 19개가 통과했습니다.

### 2026-09-15 — 상세 보기를 구현한 런타임을 사실대로 기술

런타임 동작 표는 PHP 라이브러리, Rust, PHP 확장에 `Generator::buildDetail`, `build_detail`과
렌더링 대응 심볼을 적어두고 있었습니다. 그 여섯 심볼은 존재하지 않습니다. 상세 보기는 JavaScript
패키지와 Go에만 구현되어 있고, 기능 계약도 이미 그렇게 기록하고 있습니다(`buildDetail`,
`renderDetail`이 `partial`이고 PHP·Rust·PHP 네이티브는 `unsupported`).

이제 표는 구현하지 않은 동작을 줄표로 표시하고, 상세 보기에 없는 것도 함께 적습니다. 공용 픽스처,
렌더러 적합성 검사, 네이티브 바이트 동일성 실행은 폼과 목록만 다루므로 JavaScript와 Go의 상세
출력을 비교하는 검사가 없습니다. JavaScript 렌더러 네 개는 각자의 인라인 명세로 부분 문자열 세
개만 단언하고, 유일한 공용 상세 픽스처에는 레코드도 기대 HTML도 없는 명세 유효성 사례 두 개만
있습니다.

`make docs-check`가 통과했습니다.

### 2026-09-15 — 공개 브라우저 모듈을 import까지 함께 로드

프레임 문서 변경의 후보 검증이 컨테이너에서 실패했습니다. 공개 프레임 준비 모듈을 Chromium에서
로드하는 소스 검사가 파일을 읽어 `data:` URL로 import했기 때문에, 이 모듈이 새로 가지게 된 공용
브라우저 행렬 import를 해석하지 못했습니다(`Failed to resolve module specifier
"./runtime-paths.mjs"`). 이 검사는 공개 모듈이 모두 단일 파일일 때만 통과했고, import가 추가될 때 검사는 넓혀지지 않았습니다.

이제 검사는 배포와 같은 방식으로 공개 모듈을 HTTP로 제공하고 같은 출처의 문서에서 모듈을
로드하므로, JSON 행렬을 포함한 import 그래프 전체를 확인합니다. 모듈의 export 세 개도 단언합니다.
또한 초기화할 수 없는 프레임은 준비 이벤트를 영영 게시하지 않는 대신 이유를 페이지에 게시하고,
페이지는 무진행 제한을 기다리지 않고 그 이유로 실패합니다.

Chromium 소스 검사 4개, 비교 소스 검사 150개, `make docs-check`가 통과했습니다.

### 2026-09-15 — SSR 열을 서버가 렌더링한 프레임 문서로 제공

비교 페이지의 `ssr` 열은 서버 렌더링이 아니었습니다. 프레임 문서에는 빈 폼 뷰만 있었고,
브라우저가 `render`를 요청해 받은 HTML을 페이지에 넣은 뒤 그 위에 프레임워크를 마운트했습니다.
두 열 모두 첫 화면이 JavaScript에서 나왔습니다. 정적 문서 검사가 그 빈 뷰를 요구했으므로 계약이
서버 렌더링의 반대를 강제하고 있었습니다. 서버가 제공하던 별도의 SSR 문서는 링크와 네이티브 폼,
서버별 출처를 담은 다른 페이지였고 비교 페이지는 그 문서를 불러오지 않았습니다.

이제 `ssr` 동작이 프레임 문서 자체를 제공합니다. 쿼리는 정확히 `lang`, `server`,
`initialization=ssr`이며 각각 한 번씩이고, 그 밖의 쿼리는 하나의 메시지로 거부합니다. 서버는
빌드된 프레임 문서를 읽습니다. 이 문서에는 `<html>` 시작 태그, 빈 `<div id="form-view"></div>`,
`</body>`가 각각 정확히 하나 있어야 하며, 응답은 그 문서에 세 가지만 삽입하고 나머지는 그대로 둔
것입니다. html 시작 태그의 언어, 폼 뷰 안에 저장 레코드로 렌더링한 폼, body 종료 태그 앞의
`<script type="application/json" id="crudui-ssr">`에 담은 레코드와 생성기 출처이며 `<`, `>`, `&`는
이스케이프합니다. PHP, PHP 확장, Go, Rust가 같은 규칙과 같은 오류 메시지 두 개를 구현합니다.

프레임 문서는 서버가 렌더링한 폼과 브라우저 전용 도구를 분리합니다. `#form-view`,
`#outline-view`, `#data-view`입니다. 모든 어댑터가 `mountView`와 `hydrateView`를 제공하고
하이드레이션이 서버 노드를 어떻게 다루는지 선언합니다. React는 `hydrateRoot`로 하이드레이션하고
대기 대신 하이드레이션된 트리의 effect로 커밋을 알리며 복구 가능 오류에서 실패합니다. Vue는
`createSSRApp`로 하이드레이션합니다. HTML 렌더러는 마크업을 유지하고 폼과 구조 맵 바인딩을
연결합니다. Svelte는 노드를 교체합니다. Svelte 하이드레이션은 자신의 서버 렌더러만 쓰는
`<!--[-->` 표시를 읽으므로 컨테이너를 비우고 마운트하며, 어댑터가 이를 선언하고 명세에
기록했습니다. SSR 프레임은 레코드를 페이로드에서 읽고, 인계 후 폼 DOM이 그대로인지 확인하며,
노드를 이어받는 어댑터에서는 서버가 렌더링한 모든 요소가 남아 있는지 확인합니다. 초기화 단계
`mounted`는 이제 문서 자체입니다. 페이지가 레코드를 초기화하고 해당 열의 문서를 다시 불러 두 열이
각자의 경로로 시작합니다.

검사는 같은 계약을 모듈 하나에서 따릅니다. `frame-document.mjs`는 프레임 문서를 읽고 SSR 문서의
세 삽입을 제거해 빌드 문서를 돌려줍니다. 프레임 빌드, 브라우저 검사, 생성 검사가 모두 이 모듈을
사용합니다. 브라우저 검증은 모든 렌더링 경로와 프레임워크의 초기화 문서 두 개, 서버당 16개를
기록하고 네 서버 문서 뒤의 빌드 문서를 SHA-256으로 비교합니다. 생성 검증은 빌드된 프레임 문서,
페이로드 레코드와 출처, 조합마다 모든 서버가 같은 메시지로 거부해야 하는 SSR 쿼리 10개를
추가했습니다. 결과 450개, 요청 899개입니다. 운영 문서의 생성·집계 수치는 오래되어 있었고
(결과 290개, 요청 411개, 시나리오 912개) 현재 수치로 정정했습니다.

비교 소스 검사 149개와 `make docs-check`가 통과했습니다.

### 2026-09-15 — Vue 컴포넌트가 문법 노드만 렌더링

jsdom에서 측정한 결과, 공용 세션 폼의 서버 마크업을 Vue `createSSRApp`로 하이드레이트하면 입력
요소가 교체되고 불일치 40건이 보고되었습니다. Vue가 주석을 기대하는 자리에 서버 마크업에는 노드가
없었습니다. Vue 노드와 구조 맵 빌더는 없는 헤더, 푸터, 번호, 제목, 행 컨트롤, 중첩 본문에 `null`을
넘겼고, Vue는 `null` 자식을 자리 표시 주석으로 렌더링합니다. 공용 비교는 비교 전에 주석을 제거하므로
이 추가 노드는 보고되지 않았습니다.

이제 빌더는 없는 부분에 자식을 추가하지 않습니다. 변경 후 같은 마크업을 하이드레이트하면 모든 요소가
유지되고 불일치가 없었으며, `createForm` 경로(비어 있을 때, 주입 후, 모든 행을 접은 후)와 `bindForm`
경로에서 렌더링한 폼, 구조 맵, 데이터 보기에 주석 노드가 없었습니다. `npm test -w
@crudui/generator-vue`가 테스트 342개를 통과했습니다.

### 2026-09-15 — HTML 렌더러를 문자열 렌더러 형식에 맞춤

문자열 렌더러는 같은 바이트를 만들어야 했지만 검사에는 HTML 렌더러가 없었습니다. 네이티브 생성
검사는 PHP, PHP 확장, Go, Rust만 React 서버 렌더링과 비교했습니다. 폼 고정 데이터 90개를 바이트
단위로 비교하면 HTML 렌더러는 60개에서 React와 달랐습니다. input 속성 순서, 속성 이름
대소문자(`readonly`, `autocomplete`), 빈 요소 닫기, `style` 텍스트, 텍스트 이스케이프가 달랐고
목록 이미지 preload 링크를 쓰지 않았으며 속성 값의 `>` 이스케이프도 달랐습니다. 런타임 계약은 바이트
규칙이 어느 렌더러에 적용되는지 밝히지 않았습니다.

이제 계약은 문자열 렌더러(React 서버 렌더링, HTML 렌더러, PHP, PHP 확장, Go, Rust 생성기)를 밝히고
React 서버 렌더링을 기준으로 삼아 그 형식을 나열합니다. HTML 렌더러는 이 형식을 씁니다. 이스케이프,
React 속성 이름, input의 `style`, `name`, `checked`, `value`를 마지막에 두기, `/>`로 닫는 빈 요소,
`property:value`를 `;`로 이은 `style`, 차단한 스크립트 URL, textarea의 앞 줄바꿈 중복, 이벤트 속성이
있는 컨트롤의 원본 속성, 원본 목록 동작, 목록 이미지 preload 링크입니다. 네이티브 생성 검사는
`javascript.mjs --renderer html`로 HTML 렌더러를 여섯 번째 대상으로 실행하므로 이 규칙이 모든 문자열
렌더러에 강제됩니다. React와 HTML 렌더러의 목록 레이아웃 검사와 목록 고정 데이터 생성기는 따로 두던
복사본 대신 정규화 전에 preload 링크를 제거하는 `list-body.mjs`를 함께 사용하며, 목록 고정 데이터를
재생성한 결과는 같은 바이트였습니다.

`make test-native`가 검사 1171개(JavaScript, HTML 렌더러, PHP, Go, Rust, 네이티브 PHP 각 195개)를
통과했습니다. `npm run test:forms`(core 110, HTML 207, React 352, Vue 342, Svelte 339·10, Chromium 17),
`npm run test:form-comparison:source` 141개와 `:browser` 4개, `make docs-check`가 통과했습니다.

### 2026-09-15 — 실수 고정 데이터 값을 C double 리터럴로 작성

`make test-native`가 PHP 확장 엔진 테스트 "list rendering has no undefined behavior findings"에서
멈췄습니다. 생성된 C 고정 데이터가 `ps_float_value(1000000000000000100)`을 썼고, Apple clang 21이
값을 1000000000000000128로 바꾸는 정수에서 double로의 암시적 변환을
거부했습니다(`-Wimplicit-const-int-float-conversion`, `-Werror`). 같은 검사는 2026-09-14에
통과했습니다. 2026-09-15에 Xcode 27이 설치되어 `xcode-select`가 Command Line Tools 16.2 컴파일러
대신 그 clang 21을 선택합니다. 값은 네이티브 숫자 사례 1000000000000000128에서 오며,
JavaScript는 이를 `1000000000000000100`으로 출력합니다.

고정 데이터 작성기는 안전한 정수 범위 밖의 숫자를 JavaScript 출력 그대로 썼으므로 정수값이 C
정수 리터럴이 되었습니다. 이제 C double 리터럴을 쓰며 정수값에는 `.0`을 붙입니다. C는 이
리터럴을 같은 가장 가까운 double로 읽습니다. 엔진 테스트는 22개가 통과했습니다. address
sanitizer 테스트는 선언된 플랫폼 조건에 따라 Linux 밖에서 건너뛰며 Linux CI 작업에서
실행됩니다.

### 2026-09-15 — 비교 페이지를 한 화면에 고정

배포 뒤 실제 Safari에서 왼쪽 프레임 안의 모두 펼치기를 누르고 포인터를 페이지 머리글로 옮긴 뒤
PHP, React, bindForm 반복 주입 비교를 실행했습니다. 168/168 대신 비교 3개 뒤에 포인터 안내로
멈췄습니다. 실행 중 기록을 보면 페이지는 `saved`까지 스크롤 0이었습니다. `copied` 단계가 새 행으로
포커스를 옮기자 Safari가 페이지를 602px로 스크롤했고, 왼쪽 프레임의 위쪽이 602px에서 0으로 올라와
멈춰 있던 포인터 아래에 왔으며, 그 프레임의 문서 요소가 `:hover`와 일치했습니다. 프레임은 각각 뷰포트
높이로 스크롤되는 페이지에 쌓여 있었으므로, 어떤 포커스 이동이든 사용자가 프레임 밖에 둔 포인터 아래로
프레임을 가져올 수 있었습니다.

이제 페이지는 한 화면에 들어가며 스크롤하지 않습니다. 제목, 컨트롤, 설명, 비교 결과, 소스 정보,
보고서는 뷰포트 높이의 45%로 제한한 패널로 묶여 그 안에서 스크롤하고, 두 프레임은 나머지를 좌우로
나눠(1000px 이하에서는 위아래 절반) 각자 안에서 스크롤합니다. 페이지의 마크업과 스타일시트에 긴 결과와
3,000px 높이의 프레임 문서를 넣어 Chromium과 Playwright WebKit의 1680×1100, 900×700에서 측정한 결과,
페이지는 스크롤할 수 없고, 두 프레임은 뷰포트 안에 있으며, 각 프레임 맨 아래 컨트롤에 포커스하면 그
프레임만 스크롤되고(2,474px, 2,862px) 페이지는 0에 머물며, 머리글 위의 포인터는 어느 프레임 위에도
있지 않았습니다. 비교 계약에 이 배치를 명시했습니다.

`npm run test:form-comparison:source` 141개와 `:browser` 4개, `make docs-check`가 통과했습니다. 배포된
페이지에서 실제 Safari로 왼쪽 프레임 안의 모두 펼치기를 누르고 포인터를 페이지 머리글로 옮긴
뒤 PHP, React, bindForm 반복 주입 비교를 실행한 결과 168/168 일치했습니다. 포인터를 왼쪽 프레임 위에
둔 채 시작하면 비교는 결과 없이 포인터 안내로 멈췄습니다.

### 2026-09-15 — 포인터가 프레임 밖에 있을 때만 비교를 캡처

배포 뒤, safaridriver로 실행한 실제 Safari에서 포커스 테두리 차이를 재현했던 절차를
반복했습니다. 왼쪽 프레임 안의 모두 펼치기를 실제 포인터로 누른 뒤 PHP, React, bindForm 반복 주입
비교를 실행했습니다. 이제 모든 단계에서 포커스된 컨트롤과 `:focus-visible` 상태는 같았지만 비교는
`copy-removed`부터 `restored`까지 CSS에서 168개 중 7개가 실패했습니다. 다른 속성은 버튼의
`background-color`였습니다. 포인터가 머문 왼쪽 열은 `.crudui-action:hover` 배경인
`rgb(249, 250, 251)`이고 오른쪽 열은 투명 또는 흰색이었습니다.

포인터는 한 프레임 위에만 있을 수 있습니다. Chromium, Playwright WebKit, Safari에서 프레임의 문서
요소는 포인터가 그 프레임 위에 있는 동안 정확히 `:hover`와 일치합니다. 모든 브라우저에서 프레임 안의
`:hover`를 막는 페이지 스타일은 없습니다. Safari에서 iframe의 `pointer-events: none`은 hover를 그대로
두었고, iframe을 덮는 투명한 요소는 포인터 위치의 최상위 요소였는데도 최상위 문서에서 포인터가
움직이기 전까지만 hover를 해제했습니다. Playwright WebKit도 두 방법 모두 포인터를 움직인 뒤 hover를
복원했습니다.

이제 비교 페이지는 포인터가 두 프레임 밖에 있을 때만 열을 캡처합니다(`src/frame-pointer.mjs`).
포인터가 프레임 위에 있으면 비교는 결과 없이 멈추고 포인터를 프레임 밖으로 옮긴 뒤 다시 비교하라고
알리며, 로드 뒤 표시하는 목록도 비교하지 않고 같은 안내를 표시합니다. 비교에서 제거하는 스타일은
없습니다. Chromium 검사는 포인터를 페이지에서 프레임으로, 다시 페이지로 옮기며 매번 프레임 상태를
읽습니다.

`npm run test:form-comparison:source` 141개와 `:browser` 4개, `make docs-check`가 통과했습니다.

### 2026-09-15 — 스크립트 포커스의 표시 여부를 명시

Safari에서 배포된 페이지의 PHP, React, bindForm 반복 주입 비교가 `expanded-all`,
`undone`, `empty`, `restored`에서 CSS만 실패했습니다. 두 열 모두 같은 버튼에 포커스가 있었지만
왼쪽 열은 포커스 테두리가 없고 오른쪽 열은 `:focus-visible` 테두리가 있었습니다. safaridriver로
실행한 실제 Safari는 네 번 168/168 통과했고, 그중 한 번은 실제 포인터로 비교를 시작했습니다. 왼쪽
프레임 안의 모두 펼치기를 실제 포인터로 누른 뒤에는 168개 중 8개가 실패했습니다. `copy-removed`부터
`restored`까지 CSS가 달랐고, 단계 기록은 포커스된 컨트롤이 오른쪽 열에서만 `:focus-visible`과
일치함을 보였습니다.

Chromium, Playwright WebKit, Safari에서 측정한 결과, 포인터로 버튼에 포커스된 뒤 다른 컨트롤에
스크립트로 `focus()`하면 `:focus-visible`과 일치하지 않으며, 세 브라우저 모두 `focus({ focusVisible
})`가 이를 결정합니다. 바인딩은 포커스를 `focus({ preventScroll: true })`로 복원하고 `focus()`로
옮겼으며, 비교 단계는 `focus()`로 컨트롤에 포커스했습니다. 따라서 한 프레임 안의 이전 포인터
입력이 그 열만 바꿨습니다.

이제 바인딩은 표시 여부를 명시합니다. `connectForm`은 포커스된 컨트롤이 `:focus-visible`과
일치하는지 기록하고 그 표시 여부로 복원합니다. 작업 뒤 행이나 추가 버튼으로, 또는 구조 맵에서
선택한 행으로 옮긴 포커스는 사용자의 위치를 옮기므로 표시합니다. 비교 페이지의 bindForm
컨트롤러도 같은 규칙을 따르고, 비교 단계는 키보드 사용자처럼 `focusVisible: true`로 컨트롤에
포커스합니다. 런타임과 비교 계약에 두 규칙을 명시했습니다. 페이지, 스크롤 박스, 프레임 호스트의
Chromium 검사는 포인터로 누른 펼치기/접기 버튼을 테두리 없이 복원하는지, 테두리가 보이게 포커스한
버튼을 테두리 있게 복원하는지, 포인터로 누른 추가가 새 행으로 보이는 포커스를 옮기는지 확인합니다.
`connectForm` 변경이 없으면 세 호스트 모두 테두리가 보이게 포커스한 버튼에서 실패하고, 변경이
있으면 모두 통과합니다.

`npm run test:forms`(core 110, HTML 207, React 352, Vue 342, Svelte 339·10, Chromium 17), `npm run
test:form-comparison:source` 141개와 `:browser` 3개, `make docs-check`가 통과했습니다.

### 2026-09-14 — 비교 저장소 잠금이 브라우저 하나에만 적용됨을 명시

Playwright WebKit 비교가 배포에 대해 실행되는 동안 Safari 검사가 끝나지 않았습니다. 각
페이지가 자기 저장소 잠금을 가졌어도 두 실행은 같은 저장 레코드를 썼습니다. `navigator.locks`의
잠금은 브라우저 하나에 속합니다. 이제 비교 계약은 같은 배포를 쓰는 다른 브라우저, 다른 사람, 자동화
실행이 잠금 없이 레코드를 읽고 교체하므로 서로 다른 브라우저의 검사를 동시에 실행하면 안 된다고
명시합니다. 서버는 서버·렌더링 경로·프레임워크마다 레코드 저장소 하나를 유지하며, 실행마다 저장소를
분리하는 안은 검토했지만 채택하지 않았습니다.

### 2026-09-14 — 사용할 수 없는 조작을 aria-disabled로 표시

Safari에서 배포된 페이지의 반복 주입 비교가 `restored`의 CSS와 포커스 차이를
보고했습니다. 왼쪽 열은 비활성화된 되돌리기 버튼에 포커스와 포커스 테두리가 남았고 오른쪽 열은
포커스가 없었습니다. Chrome(React, bindForm, PHP: 168/168), Playwright WebKit의 PHP 8개 조합(각
168/168), Safari 전체 실행(보고서 96개, 실패 0개)에서는 재현되지 않았습니다.

`undone` 단계는 되돌리기 버튼에 포커스하고 누릅니다. 이력이 비면 모든 렌더러가 그 버튼에
`disabled`를 썼습니다. Playwright로 측정한 결과, 포커스된 버튼이 비활성화되면 Chromium은 포커스를
유지하고 WebKit은 다음 렌더링 갱신에서 포커스를 해제합니다. 어느 엔진이든 같은 비활성 버튼으로
교체하면 포커스를 잃습니다. 따라서 "되돌리기는 포커스된 조작 버튼을 유지한다"는 결과가 브라우저에
따라, 그리고 WebKit의 포커스 해제가 프레임의 재렌더링·포커스 복원보다 먼저인지 나중인지에 따라
달라졌습니다.

이제 폼과 구조 맵의 모든 조작 버튼은 HTML·React·Vue·Svelte 렌더러와 Go·PHP·Rust·PHP 확장
생성기에서 사용할 수 없는 조작을 `disabled` 대신 `aria-disabled="true"`로 표시합니다. 버튼은
포커스를 받을 수 있고 클릭해도 아무 일도 하지 않습니다. `connectForm`, `connectOutline`, 비교
페이지의 bindForm 컨트롤러는 `aria-disabled`를 읽고, 스타일시트는 `[aria-disabled='true']`에
스타일을 적용합니다. 필드 컨트롤의 `disabled`는 선언된 데이터 상태이므로 그대로 둡니다. 공유 폼
렌더·구조 맵 픽스처를 재생성했고 바뀐 것은 이 속성뿐입니다. 마크업 명명 검사는 조작 버튼의
`disabled`와 `true`가 아닌 `aria-disabled` 값을 거부하고, 공유 DOM 시나리오는 사용할 수 없는
위로 이동 버튼이 포커스를 유지하며 클릭해도 아무것도 바꾸지 않는지 확인합니다.

`npm run test:forms`(core 110, HTML 207, React 352, Vue 342, Svelte 339·10, Chromium 14), `make
test-native` 976/976, Go 생성기 테스트, Rust 생성기 테스트(20·4), PHP 생성기 테스트(163), `npm run
test:form-comparison:source`(141)와 `:browser`(3), `make docs-check`, `make format-check`가
통과했습니다.

배포된 페이지에서 PHP 서버의 모든 프레임워크·렌더링 경로의 두 프레임을 Playwright로
측정했습니다. 되돌리기 버튼은 처음에 `aria-disabled="true"`이고 `disabled`가 없습니다. `undone`
단계처럼 포커스한 뒤 스크립트 클릭으로 누르거나 Enter로 누르면, 이력이 비고 렌더링 갱신이 여러 번
지난 뒤에도 Chromium과 WebKit 모두 되돌리기에 포커스가 남습니다. WebKit에서는 어떤 버튼이든 마우스로
클릭하면 포커스가 body로 가며, 데이터를 바꾸지 않는 모두 펼치기도 같습니다. 이는 두 열에서 같은
WebKit의 마우스 동작이며 렌더링 결과가 아닙니다.

### 2026-09-14 — 비교 저장소 작업을 한 번에 하나만 실행

배포된 페이지에서 왼쪽과 오른쪽 프레임의 검사 실행을 동시에 누르자 두 프레임 모두 여러
검사가 "검사 오류"로 실패했습니다. 한 프레임만 실행하면 같은 검사가 19/19 통과했습니다. 두 프레임과
페이지, origin의 모든 탭은 같은 저장 레코드를 읽고 교체하는데, 각 프레임과 페이지는 자기 `running`
플래그로 자신만 막았고 페이지의 반복 주입 비교에는 막는 장치가 없었습니다. 두 실행이 서로의 레코드를
초기화하고 덮어썼습니다.

이제 페이지에서 시작한 작업(프레임 버튼, 폼 제출, 비교 버튼, 전체 검사)은 `navigator.locks`의
origin 잠금 하나(`src/storage-lock.mjs`)를 가진 동안에만 레코드를 변경합니다. 다른 작업이 잠금을 가진
동안 시작한 작업은 실행되지 않고 다른 검사나 저장이 실행 중이라고 알립니다. 전체 검사와 검증기가 직접
호출하는 검사는 이미 잠금을 가진 작업 안에서 실행됩니다. 자기 검사를 실행 중인 프레임은 계속 다른
버튼을 무시하므로, 그 메시지가 작성 중인 결과 목록을 대체하지 않습니다.

`npm run test:form-comparison:source`가 잠금 테스트 2개를 포함한 141개, `npm run
test:form-comparison:browser`가 3개를 통과했고 `make docs-check`가 통과했습니다.

### 2026-09-14 — 빈 컬렉션 추가 뒤 컬렉션을 다시 조회

HTML 프레임을 처음 빌드해 실행한 후보 검증은 생성 검증(결과 386개, 요청 547개)을 통과한 뒤
PHP 검사 1,744개 중 4개에서 실패했습니다. 두 렌더링 경로와 두 전송 방식의 HTML 렌더러 `empty` 시나리오가
"add into empty collection: expected 1, actual 0"을 보고했습니다. 실행은 거기서 멈춰 다른 서버는 실행되지
않았습니다. 시나리오는 추가 버튼을 누르기 전에 찾은 컬렉션 요소를 붙잡아 두고 그 뒤 그 요소에서 행을
셌습니다. React, Vue, Svelte는 그 요소를 유지하지만 HTML 렌더러는 변경마다
새 마크업을 쓰므로 붙잡은 요소는 문서에서 떨어져 있었습니다. 런타임 계약은 이미 렌더링이 요소를 교체할 수
있다고 하므로 틀린 것은 시나리오였습니다. 이제 `addEmpty`는 컬렉션을 찾는 함수를 받아, 시나리오의
`departmentWrapper`처럼 추가가 렌더링된 뒤 다시 조회합니다. 시나리오의 다른 보조 함수는 수행하는 작업 전에만
요소를 사용합니다.

후보 준비는 커밋되지 않은 변경이 있는 checkout에서 시작을 거부하므로, 그 실행은 해당 커밋의 별도
git worktree에서 진행했습니다. `npm run test:form-comparison:source`가 테스트 139개를 통과했습니다.

### 2026-09-14 — Go 상세 모델과 SSR 렌더링 추가

Go 생성기가 `BuildList`에서 사용하는 기존 순서 보존 표시·합성 경로를 재사용하는
`BuildDetail`과 `RenderDetail`을 제공합니다. 명령 어댑터는 `renderDetail` 작업에
객체 레코드 하나를 받습니다.

### 2026-09-14 — Svelte 상세 렌더링 추가

Svelte 생성기가 공용 읽기 전용 `Detail` 컴포넌트와 `renderDetail` SSR 진입점을
제공합니다. 표시 분기는 코어 상세 모델을 소비하며 기존 raw HTML 표시 경계를
유지합니다.

### 2026-09-14 — Vue 상세 렌더링 추가

Vue 생성기가 공용 `Detail` 컴포넌트와 비동기 `renderDetail` SSR 진입점을
제공합니다. 코어 상세 모델과 기존 목록 셀 표시 매핑을 소비합니다.

### 2026-09-14 — React 상세 렌더링 추가

React 생성기가 공용 `Detail` 컴포넌트와 `renderDetail`을 제공합니다. 코어 상세
모델과 기존 셀 표시 컴포넌트를 소비하며, 출력은 읽기 전용이고 데이터 조회나
중복 표시 평가를 수행하지 않습니다.

### 2026-09-14 — CRUDUI 상세 명세와 공용 읽기 모델 추가

CRUDUI에 순서가 있는 읽기 전용 표시 필드를 갖는 `Detail` 선언을 추가했습니다.
코어는 기존 목록 엔진에 합성, 조건, 지역화, 표시 형식 처리를 위임하는
`buildDetail`을 제공하고 HTML 생성기는 `renderDetail`을 제공합니다. TypeScript
검증기와 스키마 검사가 새 진입점을 확인합니다. 다른 런타임 생성기는 아직
미완성이며 기능 상태는 partial로 기록했습니다.

### 2026-09-14 — 비교 페이지에서 HTML 렌더러 비교

비교 페이지는 클라이언트 열을 React, Vue, Svelte로만 렌더링했고, 프레임워크와 무관한 렌더러인
`@crudui/generator-html`은 브라우저 행렬에 포함된 적이 없었습니다. 이제 `html`이
`runtime-paths.json`의 네 번째 프레임워크이므로 서버가 그 경로를 받아 SSR 문서를 렌더링하고 모든
검사가 이를 포함합니다.

- `create-form-html.ts`는 프레임에 `renderForm`, `renderOutline`, `renderData`를 렌더링하고, 렌더링
  구독보다 먼저 `connectForm` 바인딩 하나(폼과 구조 맵의 작업을 모두 실행)를 연결하며, 변경마다 다시
  렌더링하고 동기화합니다. `bind-form-html.ts`는 `bindForm`으로 `renderFormView`, `renderOutlineView`,
  `renderDataPanel`을 렌더링합니다. 프레임 빌드는 `#html`을 렌더러 소스로 연결하고, 페이지는 프레임워크
  선택기에 HTML을 제공하며 소개문과 README에 이를 적습니다.
- 행렬 숫자를 적던 테스트가 이제 이를 계산합니다. 생성 테스트는 내보낸 생성 합계를, 상호작용 테스트는
  행렬에 다섯 동작을 곱한 값을, 런타임 경로 테스트는 행렬과 조합 수를 비교합니다.
- 비교 명세는 새 규모를 적습니다. 시나리오 보고서 64개와 초기화 보고서 32개, 서버마다 보고서 24개(시나리오
  16, 초기화 8)의 작업, 상호작용 80개, 로드 전 마운트 8개, 정적 문서 8개, 집계 시나리오 검사 1,216개, 초기화
  비교 5,376개, 상호작용 320개, 마운트 32개, 정적 문서 32개, 생성 검증 결과 386개, 요청 547개, 조합 32개입니다.
  이 문장의 오류 두 가지도 함께 바로잡았습니다. 범주를 일곱 개로 줄였는데도 집계는 초기화 비교
  4,608개라고 적었고, 로드 전 마운트 프레임을 `csr`로 바뀐 열 이름 `inject`로 불렀습니다.
  런타임 패키지와 네이티브 생성기 문서도 브라우저 대상에 HTML 렌더러를 적습니다.

`make format-check`, `npm run test:form-comparison`(소스 139, 라이브러리 10, 브라우저 작업 3),
`npm run test:runtimes`(20), `make docs-check`, Go 서버 테스트, Rust 서버 테스트 4개가 통과했습니다. HTML
프레임을 포함한 프레임은 후보 검증에서만 빌드되어 네 서버와 함께 실행됩니다.

### 2026-09-14 — HTML 렌더러로 bindForm 폼 렌더링

React, Vue, Svelte는 `bindForm`으로 관리하는 폼을 상태 없는 `FormFields`로 렌더링하지만,
`@crudui/generator-html`은 `createForm` 인스턴스로만 폼을 렌더링할 수 있었습니다(`renderForm(form)`).
구조 맵과 데이터 보기에는 이미 상태 없는 `renderOutlineView`와 `renderDataPanel`이 있었습니다. 이제
`renderFormView(fields, buttons, messages)`가 `bindForm`, `bindButtons`, `formMessages`로 `crudui-form`
블록을 렌더링하고 `renderForm`이 이를 사용하므로 마크업은 한 곳에서 만들어집니다. README와 폼 런타임
명세가 이를 설명합니다.

HTML 렌더러의 적합성 테스트는 렌더링 가능한 모든 폼 사례를 이 경로로도 렌더링합니다. `bindForm`은
누락된 반복 데이터에 고정 행 키를 주므로, 인스턴스 경로가 건너뛰는 누락 데이터 사례도 포함합니다.
`npm test -w @crudui/generator-html`이 테스트 206개(기존 116개와 bindForm 사례 90개)를 통과했고,
`npm run build -w @crudui/generator-html`이 성공했으며 `make docs-check`가 통과했습니다.

### 2026-09-14 — 속성 순서에 관한 런타임 계약 정정

폼 런타임 명세는 여전히 복원한 HTML 문자열이 "속성 순서까지" 같아야 하고 공통 DOM 바인딩이
checkbox의 `checked` 속성을 마지막에 둔다고 적고 있었습니다. 이는 이미 정정한 기준이며 이를
강제하던 코드도 그때 제거했지만 계약 문장은 바꾸지 않았습니다. 이제 명세는 정정한 규칙을 적습니다.
속성 순서는 계약에 포함되지 않고, 바인딩은 속성을 재배치하지 않으며, 비교는 파싱한 DOM을 사용하고,
문자열 렌더러의 바이트 단위 동일 HTML은 따로 검사합니다.

`make docs-check`가 통과했습니다.

### 2026-09-14 — 브라우저 보고서 개수를 행렬에서 계산

브라우저 행렬을 한 파일로 옮긴 뒤에도 서버 보고서 정책은 보고서 개수를 숫자로 적었습니다. 브라우저
작업의 보고서 18개, 시나리오 보고서 12개, 초기화 보고서 6개, 상호작용 검사 60개, 로드 전 마운트·정적
문서 검사 각 6개였고, `check.mjs`는 작업을 18로 시작했습니다. 프레임워크를 추가하면 모든 숫자가
틀리게 됩니다. 이제 정책은 보고서 키를 확인할 때 이미 쓰는 조합 함수로 각 개수를 확인하고,
`browserJobReportCount()`(시나리오 보고서와 초기화 보고서의 합)가 `check.mjs`와 보고서 테스트에 작업
크기를 줍니다.

`npm run test:form-comparison:source`가 테스트 139개를 통과했습니다.

### 2026-09-14 — 비교 브라우저 행렬을 한 곳에서 정의

비교 페이지의 서버, 렌더링 경로, 프레임워크, 전송 방식, 초기화 경로, API 작업이 `runtime-paths.mjs`에
적혀 있고, 브라우저 보고서 정책, 후보 검증·준비·시작 검사, 프레임, 배포 헬스체크, PHP API와 생성기,
Go·Rust 서버와 그 테스트에 다시 적혀 있었습니다. 렌더러를 추가하려면 모든 목록을 찾아야 했고,
프레임워크와 무관한 HTML 렌더러가 비교에 추가되지 않은 원인 중 하나였습니다.

이제 행렬은 `examples/form-comparison/src/runtime-paths.json` 한 곳에서 정의합니다.
`runtime-paths.mjs`가 이를 가져오고 모든 JavaScript 검사가 그 export를 사용합니다. 빌드는 이 파일을
`spec.json` 옆에 게시합니다. Go 서버(`newServer`)와 Rust 서버(`Server::load`)는 시작할 때 한 번 읽어
API 경로를 만들므로 캐시된 템플릿 렌더링은 여전히 파일을 읽지 않으며, 테스트도 같은 파일을 읽습니다.
PHP API는 새 `matrix.php`의 `browserMatrix()`로 경로를 검사하고 PHP 생성 테스트도 이를 순회합니다.
`FormGeneration::document()`는 API 경로가 이미 하는 렌더링 경로·프레임워크 검사를 반복하지 않습니다.
처음에는 `FormGeneration` 안에서 행렬을 읽었는데 파일을 읽지 않아야 하는 요청 생성 검사가 깨져, 별도
함수로 바꿨습니다.

`npm run test:form-comparison`(소스 139, 라이브러리 10, 브라우저 작업 3), Go 서버 테스트, Rust 서버
테스트 4개, 바꾼 PHP 파일의 `php -l`, `make format-check`가 통과했고, `browserMatrix()`가 파일에서 렌더링
경로·프레임워크·작업을 읽었습니다.

### 2026-09-14 — 폼 스냅숏 모듈 하나만 유지

`form-snapshot.mjs`와 그 테스트가 같은 내용으로 두 벌 있었습니다. 원본인 `tests/form-inspector/`와
`examples/form-comparison/src/`의 복사본입니다. 변경을 두 곳에 해야 했고, 비교 검사는 복사본 테스트를,
CI 네이티브 작업은 원본 테스트를 실행했습니다. 복사본과 그 테스트를 제거했습니다. 비교 프레임은
원본을 가져오고, 비교 빌드는 원본을 페이지에 게시하며, `test:form-comparison:source`가 원본 테스트를
실행하므로 로컬 검사와 비교 CI 작업이 계속 이를 확인합니다.

`node --test tests/form-inspector/form-snapshot.test.mjs`가 테스트 18개를 통과했고,
`npm run test:form-comparison`이 원본을 소스 검사에 포함해 통과했습니다.

### 2026-09-14 — 속성 순서 없이 브라우저 DOM을 비교하고 순서를 강제하던 코드 제거

비교 페이지의 전체 검사를 Safari로 실행하자 네 서버 모두 Vue `bindForm`의
`ssr/restoration`과 `csr/restoration`이 `html` 범주에서 실패했고, 파싱 DOM을 포함한 다른 범주는
모두 통과했습니다. 차이는 checkbox 하나였습니다. 마운트 때 `checked="" value="1"`, 복원 뒤
`value="1" checked=""`였습니다. 후보 검증은 Chromium만 실행하므로 통과했습니다.

틀린 것은 폼이 아니라 기준이었습니다. 직렬화한 HTML은 속성이 만들어진 순서를 드러내고, 그
순서는 프레임워크와 브라우저 엔진이 정하며, 속성 순서는 DOM의 일부가 아닙니다. 이 기준을
맞추려고 세 곳이 검사만을 위해 속성을 재배치하고 Chromium의 순서를 전제로 했습니다.
`connectForm`의 `sync()`는 `checked`를 맨 뒤로 옮겼고, 비교 `bindForm` 컨트롤러는 컨트롤마다
속성 순서를 기록해 복원했으며, React의 `resolvedStyleProps`는 `style`을 렌더링된 속성 뒤에
두었습니다. 정정한 규칙: 문자열 렌더러(PHP, PHP 확장, Go, Rust, HTML 렌더러)는 생성 검사가
확인하는 대로 바이트 단위로 같습니다. 브라우저에서 만든 DOM은 어떤 경로와 엔진에서도 파싱
DOM(요소, 속성 이름과 값, 텍스트, 자식 순서)이 같아야 합니다. 비교를 통과하려고 DOM을 재배치하는
코드는 두지 않습니다.

- 초기화 비교는 `html` 범주를 뺍니다(보고서마다 일곱 범주, 결과 168개). `formSnapshot`은 HTML을
  증거로 계속 기록합니다. 공유 초기화 테스트는 HTML을 뺀 스냅숏을 비교하고, React 스타일 테스트는
  `isEqualNode`로 노드를 비교합니다.
- 속성 순서를 다루던 세 루틴과 checkbox의 속성 순서를 고정하던 컨트롤러 테스트를 제거했습니다.
- 기대 브라우저 합계가 배포 검사와 테스트 두 곳에 숫자(456, 2304, 5,808)로 적혀 있어 범주 변경 뒤
  오래된 합계가 남았습니다. 이제 `browser-report-policy.mjs`의 `expectedBrowserSections()`가 브라우저
  행렬에서 한 번 계산하고 배포 검사와 테스트가 이를 사용합니다.

`make format-check`, `npm run test:forms`(core 108, HTML 116, React 350, Vue 341, Svelte 338과
클라이언트 10, Chromium·명명 검사 14), `npm run test:form-comparison`(소스 139, 라이브러리 10,
브라우저 작업 3), `npm run test:build`(9), `npm run test:dependencies`(12),
`npm run test:runtimes`(20), `make docs-check`가 통과했습니다.

### 2026-09-14 — 폼 비교 검사에서 generator-core보다 검증기를 먼저 빌드

다음 `main` CI 실행에서 같은 작업이 한 단계 앞에서 다시 실패했습니다. `@crudui/generator-core`
빌드가 `Cannot find module '@crudui/validator'`로 멈췄는데, generator-core의 선언이 빌드되지 않은
검증기 패키지를 가져오기 때문입니다. 이전 확인은 `packages/generator-core/dist`만 지웠으므로 로컬
검증기 빌드가 이를 가렸습니다. 이제 `test:form-comparison:source`는 `test:forms`와 같은 순서로
generator-core보다 먼저 `build:validator`를 실행합니다. `packages/validator-ts/dist`와
`packages/generator-core/dist`를 모두 지운 상태에서 `npm run test:form-comparison:source`가 두 패키지를
빌드하고 테스트 140개를 통과했습니다.

### 2026-09-14 — 폼 검사의 Chromium 검사를 CI 샌드박스 Chrome으로 실행

같은 `main` CI 실행에서 "Form instances and data injection" 작업도 실패했습니다. 이 브랜치가
`npm run test:forms`에 추가한 Chromium 스타일 검사 6개가 브라우저를 실행하지 못했습니다("No usable
sandbox!"). 그 작업은 전에는 브라우저 작업이 아니어서 Ubuntu 러너에서 쓸 수 있는 샌드박스가 없는
Puppeteer 다운로드 Chrome을 사용했고, 다른 브라우저 작업은 `/opt/google/chrome/chrome`의 일반 Chrome을
선택하고 Puppeteer 다운로드를 건너뛰며 `scripts/check-ci-browser.mjs`로 샌드박스를 확인합니다. 이제 그
작업도 같게 하며, 브라우저 작업을 나열하는 CI 정책 테스트는 이 작업을 포함하고
`tests/form-styles.test.mjs`가 샌드박스를 끄지 않는지도 확인합니다. 이전 워크플로에서 정책 테스트는
`form-runtime`의 빠진 설정 세 가지로 실패했고, 변경 후 `npm run test:runtimes`가 테스트 20개를
통과했습니다.

### 2026-09-14 — 폼 비교 소스 검사 전에 generator-core 빌드

`main`에 머지한 뒤 CI 작업 "Form comparison runner regressions"가 실패했습니다.
`examples/form-comparison/src/bind-form-controller.test.mjs`가
`@crudui/generator-core/dist/index.mjs`를 불러오지 못했습니다. 비교 `bindForm` 컨트롤러는 이
브랜치에서부터 generator-core의 뷰 상태·이력 함수를 사용하는데, 그 CI 작업은 패키지를 빌드하지 않은
깨끗한 체크아웃에서 `npm run test:form-comparison`을 실행합니다. 로컬에서는 이전 빌드가 `dist`를
남겨 두어서만 통과했습니다. 이제 `test:form-comparison:source`는 `test:forms`가 패키지를 빌드하듯,
비교 소스가 불러오는 유일한 패키지인 `@crudui/generator-core`를 먼저 빌드합니다.

`packages/generator-core/dist`를 지운 상태에서 `npm run test:form-comparison:source`가 패키지를
빌드하고 테스트 140개를 통과했습니다.

### 2026-09-14 — 화면 높이 프레임 후보 검증과 배포 기록

`node examples/form-comparison/candidate-verification.mjs`가 통과했습니다. PHP,
PHP 확장, Go, Rust가 각각 검사 1,452개를 실패 없이 통과했고, 브라우저 검증은 검사 5,808개를
실패 없이 기록했습니다. `node examples/form-comparison/comparison-deployment.mjs --commit
<commit>…`가 이를 `https://crudui.test/`에 배포하고 동일 재적용 검사를 통과했습니다. 798px
브라우저 창에서 프레임은 798px 높이이고 SSR과 CSR 열은 8/8 일치합니다. 페이지를 프레임까지
스크롤하고 프레임을 700px 스크롤하면 회사 헤더는 화면 맨 위 0px 고정선에, 스토어 헤더는 38.5px
고정선의 39px에 있으며 둘 다 단계 레이블을 보이고, 고정되지 않은 부서와 Busan 헤더는 레이블을
숨깁니다. 스크롤 직후 페이지가 렌더링되기 전에 잰 값은 레이블을 여전히 숨김으로 읽었고, 렌더링 뒤
다시 재자 표시되었습니다.

### 2026-09-14 — 비교 프레임 높이를 화면에 맞춤

고정 행이 CSS만으로 동작하게 된 뒤에도 비교 페이지는 일반 페이지와 다르게 동작했습니다. 원인은
스크립트가 아니라 배치였습니다. 각 프레임이 798px 화면에서 1,450px로 고정되어 페이지와 프레임이
모두 스크롤되었고, 고정 헤더가 붙는 프레임 위쪽 가장자리가 페이지를 스크롤하자마자 화면 밖으로
나갔습니다. 화면보다 긴 스크롤 박스도 같게 동작합니다. 이제 각 프레임은 `100vh` 높이이므로 스크롤
영역이 보는 화면과 같습니다. 스크롤 위치가 현재 행을 정한다고 남아 있던 주석 두 곳(`actions.ts`,
`instance.ts`)을 바로잡았습니다. 스크롤과 관련해 남은 스크립트는 작업이나 맵 선택 뒤 행의 컨트롤에
포커스하는 것뿐입니다.

generator-core 테스트(108)와 `npm run test:form-comparison:source`(140)가 통과했습니다.

### 2026-09-14 — CSS 전용 고정 행 후보 검증과 배포 기록

`node examples/form-comparison/candidate-verification.mjs`가 통과했습니다. PHP,
PHP 확장, Go, Rust가 각각 검사 1,452개를 실패 없이 통과했고, 브라우저 검증은 검사 5,808개를
실패 없이 기록했습니다. 앞선 실행은 멈췄습니다. 한 실행은 React의 고정 행 SSR 인계에서,
다른 실행은 Chromium 스크린샷 오류로 실패했고 둘 다 이후 커밋에서 고쳐지거나 대체되었으며,
이 트리의 첫 실행은 디스크가 가득 차 이미지 구성 중 실패했습니다. 컨테이너 이미지 빌더가 반복된
후보 빌드로 약 75GB의 빌드 캐시를 갖고 있었고, `container prune`, `container image prune --all`,
빌더 삭제(다음 빌드에서 캐시를 다시 만듦)로 83GiB를 확보했으며 실행 중인 컨테이너와 볼륨은
건드리지 않았습니다. `node examples/form-comparison/comparison-deployment.mjs --commit <commit>…`가
이를 `https://crudui.test/`에 배포하고 동일 재적용 검사를 통과했습니다. 브라우저에서 SSR과 CSR
열은 8/8 일치하고, 각 프레임은 고정 행 4개를 가지며 `data-crudui-stuck`, `data-crudui-current`,
게시 길이가 없고, SSR 프레임을 스크롤하면 회사 헤더가 고정선에 붙어 레이블을 보이며 아직 고정되지
않은 Busan 헤더는 레이블을 숨깁니다.

### 2026-09-14 — 고정 행을 CSS만으로 동작하게 하고 스크롤 측정 제거

고정 행이 프레임에서 페이지와 같게 동작하지 않은 것은 브라우저 바인딩이 스크롤 위치를 스크립트로
측정했기 때문입니다. `connectRows`가 경계 사각형으로 고정 행과 현재 행을 정하고 계산된 폼 뒤
여백을 위해 길이를 게시했으며, `alignRow`는 둘러싼 모든 문서까지 스크롤하는 `scrollIntoView`로
행을 스크롤했습니다. 그 계산 중 하나(스크롤 컨테이너, 폼 뒤 내용)를 고칠 때마다 기준이 틀린 다른
곳이 드러났습니다. 이제 고정 행은 CSS로 할 수 있는 것만 사용합니다.

- 제거: `connectRows`, `RowTracking`, `markOutline`, `alignRow`, `data-crudui-stuck`과
  `data-crudui-current` 속성, `crudui-current` 이벤트, 구조 맵의 `aria-current` 표시, 게시하던
  `--crudui-scroll-height`와 `--crudui-form-end-*` 길이, 폼 뒤 여백, 현재 행 테두리, 현재 맵 줄에만
  `controls: outline`을 보이던 규칙(맵 줄은 이제 항상 컨트롤을 보임). `scrollIntoView`의 jsdom
  대역과 인계 비교에서 그 속성을 빼던 처리도 함께 없어졌고, `contracts/features.json`은 세 함수를
  더 이상 나열하지 않습니다.
- `crudui.css`: 고정 헤더는 계속 `--crudui-sticky-depth` 고정선에 쌓입니다. 단계 레이블은
  `scroll-state(stuck: top)` 컨테이너 쿼리로 헤더가 고정된 동안에만 보입니다. 고정 행 안의
  컨트롤은 위에 고정되는 헤더만큼의 위쪽 스크롤 여백(`--crudui-sticky-cover`)을, 모든 폼 컨트롤은
  푸터만큼의 아래쪽 스크롤 여백을 가집니다.
- 행 작업 뒤나 구조 맵 선택으로 행에 이동하면 그 컨트롤에 포커스하고 브라우저가 보이게
  스크롤합니다(Chromium은 가운데에 둠). `connectForm`, `connectOutline`, 비교 페이지의 `bindForm`
  컨트롤러가 같은 방식을 씁니다.
- Chromium 스타일 검사는 모든 경우를 페이지, 스크롤 박스, 프레임에서 실행합니다. 고정선에 쌓인
  헤더와 고정된 동안에만 보이는 레이블, 행 추가와 맵 선택 뒤 고정 헤더와 푸터에 가리지 않는
  포커스를 확인합니다.

`make format-check`, `npm run test:forms`(core 108, HTML 116, React 350, Vue 341, Svelte 338과
클라이언트 10), `npm run test:form-comparison:source`(140), `npm run test:build`,
`npm run test:dependencies`, `make docs-check`, Chromium 스타일 검사 6개(환경마다 2개)가
통과했습니다. 마지막 `make docs-check`는 Rust 크레이트를 다시 빌드하다 디스크가 가득 차 먼저
실패했고, 멈춘 후보 컨테이너·이미지·디렉터리를 지운 뒤 통과했습니다.

### 2026-09-14 — React에서 고정 행을 동일하게 넘겨받기

한 후보 검증은 `browser-php`에서 실패했습니다. React의 SSR 인계가 첫 고정 행에서 달랐는데,
서버는 그 style을 `--crudui-sticky-depth:0`으로, React는 `--crudui-sticky-depth: 0;`으로 씁니다.
로컬 공유 인계 테스트는 스펙에 고정 행이 없어 이를 잡지 못했습니다. 고정 행은 비교 예제에만 선언되어 있었습니다.

- `style` 속성은 CSS 선언 블록이므로, 비교 프레임과 `compareServerTakeover`의 인계 비교는 CSS
  객체 모델이 직렬화한 선언으로 비교합니다.
- 공유 폼 세션 스펙이 회사와 스토어에 고정 행을 선언하므로 React, Vue, Svelte 폼 테스트가 이를
  렌더링하고 비교합니다.
- 이로써 이전부터 있던 React 결함이 드러났습니다. `resolvedStyleProps`는 React가 ref를 호출할
  때마다, 즉 렌더링마다 style 속성을 지우고 다시 추가했으므로, 다시 렌더링된 행의 style이 브라우저
  바인딩이 쓴 `data-crudui-current` 뒤로 옮겨졌고, 나중에 데이터를 받은 폼이 데이터와 함께 만든 폼과
  원시 HTML에서 달랐습니다. 이제 style 속성은 요소가 처음 연결될 때만 렌더링된 속성 뒤에 놓이고,
  이후 선언은 제자리에서 바뀝니다.

`make format-check`, `npm run test:forms`(core 108, HTML 116, React 350, Vue 341, Svelte 338과
클라이언트 10), `npm run test:form-comparison:source`, `npm run test:build`,
`npm run test:dependencies`, `make docs-check`, Chromium 스타일 검사 5개가 통과했습니다.

### 2026-09-14 — 폼 뒤 여백에 폼 뒤 내용 반영

폼 뒤 여백은 스크롤 컨테이너에서 이미 폼 뒤에 있는 내용을 무시했습니다. 결과 영역이 폼 뒤에
있는 비교 프레임에서는 1,037px(프레임 1,448px에서 끝 행 범위 362px와 푸터 49px를 뺀 값)을
더해 폼과 결과 사이에 빈 영역이 생겼고, 끝 행은 그 내용 높이만큼 고정선을 지나 스크롤되었습니다.
이제 규칙은 `connectRows`가 측정해 `--crudui-form-end-after`로 게시하는 폼 뒤 내용(폼 자신의
여백 제외)을 빼며 0보다 작아지지 않습니다. 폼 뒤 내용이 끝 행에 필요한 공간보다 짧으면 끝 행이
고정선에서 멈추고, 길면 여백을 더하지 않고 그 내용까지 스크롤됩니다. 문서는 더 이상 폼 뒤에
아무것도 없을 때만 한계가 정확하다고 설명하지 않습니다.

Chromium 검사 두 개가 이를 확인합니다. 스크롤 박스 안 폼 뒤에 60px 내용이 있으면 변경 전에는
끝 행이 고정선을 60px 지나쳤고(87px 대신 27px), 600px 내용이면 여백 없이 그 내용 끝까지
스크롤됩니다.

### 2026-09-14 — 모든 스크롤 컨테이너에 고정 규칙 적용, 비교 예제에 고정 행 선언

비교 페이지에 고정 헤더가 나오지 않은 것은 예제 스펙이 `multiple.header: sticky`를 선언하지
않았기 때문입니다. 로컬 미리보기는 선언했으므로 같은 생성기가 두 예제에서 다르게 동작했습니다.
원인을 확인하면서 폼이 페이지가 아닌 스크롤 박스, 대화상자, 프레임 안에 있을 때 드러날 결함을
찾았습니다. `crudui.css`는 폼 뒤 여백을 페이지 뷰포트인 `100vh`로 계산했지만 고정 헤더는 자신의
스크롤 컨테이너를 따르고, `connectRows`는 `position: sticky`와 달리 내용이 이미 넘칠 때만 조상을
스크롤 컨테이너로 취급했습니다. 700px 페이지 안 420px 스크롤 박스에서는 끝 행이 87px 고정선에서
멈추지 않고 박스 위 193px까지 스크롤되었습니다.

- `connectRows`는 `position: sticky`와 같은 방식으로 스크롤 컨테이너(세로 overflow가 `auto`
  또는 `scroll`인 가장 가까운 조상, 없으면 문서)를 정하고 그 높이를 끝 행 두 길이와 함께
  `--crudui-scroll-height`로 게시합니다. `crudui.css`는 `100vh` 대신 이 값을 씁니다. SSR 인계
  비교는 다른 바인딩 상태와 함께 이 값을 뺍니다. jsdom처럼 `scrollingElement`가 없는 DOM은 루트
  요소를 문서 스크롤 요소로 쓰고, 비교 컨트롤러 테스트의 대역 문서도 실제 문서처럼 루트 요소를
  가집니다.
- 비교 예제는 회사, 스토어, 부서에 `header: sticky`와 `title: name`을 선언하므로 모든 서버와
  프레임워크가 고정 행을 렌더링하고 비교합니다.
- Chromium 검사가 스크롤 박스 안에 폼을 마운트해 고정선 위 고정 헤더, 스크롤 되돌림 없음, 끝 행이
  고정선에서 멈추고 현재 행이 됨, 게시된 높이를 확인합니다. 변경 전에는 끝 행이 87px 고정선 대신
  −193px에 있어 실패했습니다.

### 2026-09-13 — SSR/CSR 후보 검증 통과와 배포 기록

`node examples/form-comparison/candidate-verification.mjs`가 통과했습니다. PHP,
PHP 확장, Go, Rust가 각각 검사 1,452개를 실패 없이 통과했고, 여기에는 서버·렌더링 경로·
프레임워크마다 SSR 인계를 포함한 초기화 비교 192개가 들어 있습니다. 브라우저 검증은 검사
5,808개를 실패 없이 기록했습니다. 첫 실행은 디스크가 가득 차 이미지 구성 중에
멈췄고, Go 빌드 캐시와 임시 검사 디렉터리를 지운 뒤 같은 커밋으로 다시 실행했습니다.
`node examples/form-comparison/comparison-deployment.mjs --commit <commit>…`가 이를
`https://crudui.test/`에 배포하고 동일 재적용 검사를 통과했습니다. 브라우저에서 페이지는 SSR과
CSR 열(너비 1,000px 초과 시 좌우)을 보여 주며 PHP·React·bindForm에서 비교 8/8이 일치합니다.

### 2026-09-13 — 브라우저 상호작용 검사에 SSR·CSR 열 이름 사용

한 후보 검증은 상호작용이 실행되기 전에 `browser-php`에서 실패했습니다. 상호작용 검사는
여전히 `initialization=data` 프레임을, 초기 마운트 검사는 `initialization=inject` 프레임을
찾았는데, 이는 `ssr`과 `csr`로 바뀐 열 이름입니다. 이제 상호작용 검사는 `ssr` 프레임, 초기 마운트
검사는 `csr` 프레임, 보고서 테스트 픽스처는 `ssr` 열을 사용합니다. 이 검사들은 후보 컨테이너
안에서만 실행되므로 로컬 소스 검사(140개 통과)는 옛 이름을 드러내지 못했습니다.

### 2026-09-13 — 레거시 UI와 함께 삭제된 React 폼 세션 테스트 복원

앞선 변경이 레거시 FormBuilder 테스트와 함께 같은 파일의
`packages/generator-react/src/__tests__/Form.test.tsx` 전체를 삭제해, Vue와 Svelte가 실행하는
공유 초기화·세션 DOM·컨트롤·포커스 시나리오를 React는 실행하지 않게 되었습니다. 레거시 테스트를
뺀 파일을 복원하고 `compareServerTakeover`도 실행합니다. React는 테스트 350개를 통과합니다.

### 2026-09-13 — Vue와 Svelte가 서버 렌더링 폼을 바꾸지 않고 넘겨받기

첫 후보 검증은 SSR 열에서 실패했습니다. Vue는 조건 블록의 기준점으로 주석 노드를
두고, Svelte 5는 템플릿 형제 요소 사이 공백을 텍스트 노드로 남기고 빈 텍스트 기준점을 두었으며
input의 `value` 속성, textarea 텍스트, checkbox의 `checked` 속성을 브라우저 DOM에 쓰지
않았습니다. 주석과 빈 텍스트는 아무것도 그리지 않으므로, 비교 프레임과 새 공유 테스트
`compareServerTakeover`의 인계 비교에서 뺍니다. Vue·Svelte 폼 테스트는 같은 세션의 HTML
렌더러 출력과 이 테스트로 비교합니다. Svelte 템플릿은 형제 노드 사이 공백 없이 작성하고, input·
textarea·checkbox는 서버용 속성·텍스트와 `defaultValue`/`defaultChecked`를 함께 설정해 Svelte의
서버 출력과 브라우저 DOM이 다른 렌더러와 같습니다.

`make format-check`, `npm run test:forms`(core 108, HTML 116, Vue 341, Svelte 338과 클라이언트
10), `npm run test:form-comparison:source`, `npm run test:build`,
`npm run test:dependencies`, `make docs-check`, `svelte-check`가 통과했습니다. 후보 검증은 별도
항목에 기록합니다.

### 2026-09-13 — 비교 페이지에서 서버 렌더링과 클라이언트 렌더링 비교

비교 페이지는 "데이터와 함께 생성"과 "마운트 후 데이터 주입"이라는 두 클라이언트 열을 보여
주었으므로, 서버 언어와 브라우저 프레임워크가 같은 폼을 렌더링한다는 점을 드러내지
못했습니다. 이제 두 열은 SSR과 CSR입니다. SSR 열(`initialization=ssr`)에서는 선택한
서버(PHP, PHP 확장, Go, Rust)가 저장 레코드로 폼을 렌더링하고, 프레임이 그 HTML을 페이지에
넣은 뒤 선택한 프레임워크가 같은 템플릿과 데이터로 폼을 넘겨받습니다. 넘겨받은 뒤에도 파싱한
폼 DOM(모든 요소, 속성 값, 텍스트, 주석)은 브라우저 바인딩이 쓰는 상태(`data-crudui-stuck`,
`data-crudui-current`, 끝 행 길이)를 제외하고 바뀌지 않아야 합니다. 첫 후보 검증은 직렬화한
HTML을 비교했고 속성 순서에서만 실패했습니다. React는 input의 `type`, `value`, `name`을 다른 속성
뒤에 설정합니다. 속성 순서는 DOM의 일부가 아니고 문자열 렌더러의 바이트 동일 HTML은 생성 검사가
계속 확인하므로, 인계 검사는 파싱한 DOM을 비교합니다. CSR 열(`initialization=csr`)은 데이터 없이 폼을 마운트한 뒤
레코드를 주입합니다. 이후 모든 단계는 전과 같이 두 열 사이에서 비교합니다. 비교 이름, SSR
문서 링크, 프레임 준비·타이핑 검사와 문서가 새 이름을 사용합니다.

폼 비교 소스 검사 140개와 Go·Rust 비교 서버 테스트, `make docs-check`가 통과했습니다. SSR
인계 자체는 네 서버 후보 검증에서만 실행되며 별도 항목에 기록합니다.

### 2026-09-13 — crudui.css와 레거시 제거의 네 서버 후보 검증 통과 기록

`node examples/form-comparison/candidate-verification.mjs`가 `crudui.css`만으로 폼
스타일링한 트리와 레거시 UI 경로 제거, 빌드·의존성 검사 수정 후의 트리에서 통과했습니다. 두 실행
모두 PHP, PHP 확장, Go, Rust가 각각 검사 1,452개를 실패 없이 통과했고, 브라우저 검증은 검사
5,808개를 실패 없이 기록했으며 명령은 상태 0을 반환했습니다.

### 2026-09-13 — CI가 실행하는 빌드·의존성 검사 수정

`npm run test:build`와 `npm run test:dependencies`가 실패하고 있었으며, 이번 작업에서 사용한
폼 검사 묶음은 이를 실행하지 않았습니다.

- `tests/build/public-types.mts`와 `public-types.cts`는 노드 뷰모델이 제거한 `FieldShape`와
  `MultipleSettings`를 여전히 참조했습니다. 이제 현재 공개 타입 `NodeVM`과 `ButtonVM`을
  참조합니다.
- 폼 비교 컨트롤러는 `@crudui/generator-core`를 import하지만 루트 패키지가 이를
  선언하지 않았습니다. 이제 루트 패키지가 워크스페이스 패키지를 개발 의존성으로 선언합니다.
- `tests/build/package-install-pack.test.mjs`는 존재하지 않는 경로를 넘겼는데, `packPackage`는
  패키지 이름을 확인하려고 원본 manifest를 읽습니다. 이제 테스트가 임시 디렉터리에
  manifest를 만듭니다.

`npm run test:build`, `npm run test:dependencies`, `npm run test:runtimes`와 `tests/build`,
`tests/docs`의 테스트 67개가 모두 통과했습니다.

### 2026-09-13 — Bootstrap 기반 레거시 UI 경로 제거

레거시 폼 컴포넌트와 이전 렌더링 비교는 Bootstrap 위에 만들어졌고, 노드 문법과
`crudui.css`로 대체되었습니다. 현재 경로 옆에 두지 않고 제거합니다.

- `@crudui/generator-react/legacy`, `@crudui/generator-vue/legacy`,
  `@crudui/generator-svelte/legacy`와 그 소스, React `@crudui/generator-react/styles.css`
  스타일시트, 이를 검사하던 테스트(React 테스트 16개, Vue·Svelte 패리티 테스트와 캡처, Svelte
  레거시 컴포넌트 테스트)
- 이전 데모·플레이그라운드·렌더링 비교 예제, `react-usage.tsx`와 해당 compose 서비스,
  README 항목
- `tests/cross-framework`,
  Vue·Svelte 단계가 form-render 작업을 반복하던 CI parity 작업
- 레거시 컴포넌트만 쓰던 React, Vue, Svelte 패키지의 `lucide-react`, `yaml` 의존성

레거시 명세 번역과 검증기(`@crudui/validator/legacy`와 PHP, Go, Rust 대응 구현), 레거시 검증 API
예제와 공유 명세는 데이터를 검증할 뿐 렌더링하지 않으므로 남깁니다. 공개 패키지 테스트는 이제
`@crudui/generator-core/crudui.css`가 유일하게 export되는 스타일시트인지 확인합니다.

제거 후 `npm run build`, `npm run lint`, Svelte 타입 검사가 통과했습니다. generator-core와
HTML은 계속 테스트 108, 116개를 통과했고, React, Vue, Svelte는 347, 341, 338개(제거한 레거시
테스트만큼 358, 7, 11개 감소), Svelte 클라이언트는 10개, Node 검사는 11개를 통과했습니다. 폼
비교 소스 검사 140개와 새 스타일시트 export 검사가 통과했고, 구형 스키마·표시 문서가 제거한
React 소스를 더 이상 링크하지 않게 한 뒤 `make docs-check`가 통과했습니다. 같은 실행에서
`tests/build/public-packages.test.mjs`의 선언 컴파일 검사와 의존성·pack 검사 두 개가 이미 실패하고
있었음이 드러났으며, 다음 항목에서 고칩니다.

### 2026-09-13 — crudui.css만으로 폼 스타일링: 위젯은 Bootstrap 대신 crudui 문법 사용

위젯 마크업은 Bootstrap 어휘(`form-control`, `form-select`,
`input-group`, `input-group-text`, `btn`, `btn-group`, `btn-check`, `btn-switch`,
`flex-wrap`, `data-toggle="buttons"` 속성, 테두리 없는 언어 그룹의 `p-0 border-0`)를 그대로
썼고, core 스타일시트는 이를 전혀 스타일링하지 않았습니다. 미리보기는 CDN에서 Bootstrap을
불러왔고 비교 페이지는 `#view` 안의 컨트롤을 직접 스타일링했으므로, 폼은 라이브러리 밖의
스타일이 있어야 제대로 보였습니다. 이제 위젯은 다섯 구현과 여덟 렌더러 모두에서 클래스 문법을
따릅니다. `__affix`, `__button`, `--search`, `--unsupported`를 가진 `crudui-widget`, `--select`와
`--file`을 가진 `crudui-input`, `__input`, `__label`, `--multiple`을 가진 `crudui-choices`이고,
action 위젯 버튼은 `crudui-action crudui-action--text`, 테두리 있는 언어 그룹은
`crudui-node--framed`입니다. 위젯 모델 layout `input-group`과 `btn-group`은 `widget`과
`choices`가 되었습니다. 렌더러가 그 밖에 쓰는 클래스는 검증 훅 `valid-target`,
`valid-target-async`, 에디터 호스트, 스펙이 선언한 클래스뿐이며, 명명 검사는 그 외 클래스가
나오면 실패합니다.

core 스타일시트는 `@crudui/generator-core/crudui.css`입니다(`./styles.css` export는 제거).
모든 위젯을 스타일링하고, box-sizing과 `[hidden]` 요소 숨김을 포함한 모든 규칙이 crudui 블록
범위 안에 있습니다. 페이지는 자기 레이아웃만 스타일링합니다. 미리보기는 레이아웃을 페이지 안에
두고 더 이상 Bootstrap을 불러오지 않으며, 비교 페이지 스타일시트는 `#view` 안을 스타일링하지
않고, 비교 서버의 SSR 문서는 `crudui.css`를 불러옵니다. Go와 PHP 패키지 예제도 폼 스타일을
`crudui.css`에서 가져오며, 폼 푸터의 제출 버튼과 중복되던 자체 제출 버튼을 더 이상 붙이지 않습니다.

`make format-check`가 통과했습니다. 다시 생성한 폼 렌더링·구조 맵 사례로 generator-core, HTML,
React, Vue, Svelte가 테스트 108, 116, 705, 348, 349개를, Svelte 클라이언트가 10개, 문법 밖 클래스를
거부하는 명명 검사를 포함한 Node 검사가 11개를 통과했습니다. `make test-native`가 생성기 검사
976개(구현별 195개), 구성별 PHP API 검사 361개, 검증 사례 103개를 통과했습니다. 비교 Go·Rust 서버
테스트, 비교 소스 검사 140개와 Chromium 검사 3개, `make docs-check`가 통과했습니다. Chrome에서
미리보기는 자기 레이아웃과 `crudui.css` 두 스타일시트만 불러오며 Bootstrap 없이 입력, select,
textarea, 체크박스, 언어 테두리, 구조 맵, 푸터 버튼을 그립니다.

### 2026-09-13 — 모든 Rust 크레이트와 Go 파일 포맷 정리, `make format-check`로 검사

rustfmt나 gofmt를 실행하는 검사가 없어 포맷이 어긋나 있었습니다. Rust 크레이트 다섯 개에
rustfmt 차이 62곳(최근 폼 변경 코드를 포함해 generator-rust에 54곳), Go 파일 두 개에 gofmt 차이가
있었습니다. `tests/runner/go/run_test.go`는 import 별칭을 두 번 적어(`validator validator "…"`)
아예 컴파일되지 않았습니다. 모든 크레이트와 파일을 정리하고 import를 고쳤습니다. `make
format-check`는 추적 중인 모든 `Cargo.toml`에 대해 공용 Rust 명령 진입점으로 `cargo fmt --check`를,
추적 중인 모든 Go 파일에 대해 `gofmt -l`을 실행하고 차이가 있으면 실패합니다. 스펙을 참조로
컴파일하는 비교 Rust 서버 테스트도 비교 검사처럼 `buttons`를 루트에 둡니다.

`make format-check`가 통과했습니다. generator-rust가 테스트 20개와 4개를, validator-rust가 모든
테스트 대상을, 비교 Rust 서버가 4개를 통과했고, 레거시 Go 검증기와 Go 테스트 러너의 `go test`가
통과했으며, 레거시 Rust API와 Rust 벤치가 빌드되었고, `make test-native`가 생성기 검사 976개를
모두 통과했습니다.

### 2026-09-13 — 버튼·스크롤 변경의 네 서버 후보 검증 통과 기록

`node examples/form-comparison/candidate-verification.mjs --ref <commit>`가 통과했습니다.
PHP, PHP 확장, Go, Rust가 각각 검사 1,452개를 실패 없이 통과했고, 브라우저 검증은 검사 5,808개를
실패 없이 기록했으며 명령은 상태 0을 반환했습니다. 이 검증은 폼 버튼, 명명·DOM 시나리오
검사, 스크롤 중 렌더링 없음, 앞선 검증이 찾은 비교 페이지 수정 두 건을
포함합니다. 한 검증은 PHP 생성 테스트에서, 다음 검증은 참조
컴파일 검사에서 실패했고 둘 다 수정했습니다.

### 2026-09-13 — 스크롤은 아무것도 렌더링하지 않음: 현재 행은 더 이상 인스턴스 상태가 아님

스크롤로 행을 지나면 그 행이 현재 행이 되고, `connectForm`이 `selectRow`를 호출해 새
스냅숏을 게시했습니다. 화면은 스냅숏마다 다시 렌더링되므로, 스크롤하며 행 경계를
넘을 때마다 폼 전체와 구조 맵, 현재 데이터 보기가 교체되고 포커스를 받은 컨트롤과 텍스트
선택이 복원되었습니다. 컨트롤에 포커스가 있으면 스크롤이 그 컨트롤 쪽으로 되돌아갔습니다.
선택은 맵 표시에만 쓰였으므로 조건으로 막지 않고 제거했습니다. `FormInstance.selectRow`,
스냅숏과 뷰 상태의 `selection`, `RowSelection`, `selectRowView`, `OutlineRow.current`를
없앴고, `setAllExpandedView`는 노드와 펼침 여부만 받습니다. `connectRows(element)`는 폼
행만 추적하며(맵 행은 자신의 `data-field-path`를 가짐) 다른 행이 현재 행이 되면
`crudui-current` 이벤트를 보냅니다. 새 `markOutline(outline, form)`은 폼의 현재 행에 해당하는
맵 행에 `aria-current`를 붙이고, `connectOutline`은 그 이벤트가 오거나 맵이 다시 렌더링될
때마다 이를 호출하며, 비교 페이지의 `bindForm` 컨트롤러도 자기 맵에 호출합니다.
`select-row`는 상태를 바꾸지 않습니다. `runAction`이 이동할 행을 반환하고 바인딩이 그 행을
정렬합니다. `multiple.controls: outline`이면 맵은 모든 행의 컨트롤을 렌더링하고 스타일시트가
현재 행의 컨트롤만 보여 줍니다.

Chromium 스타일 검사는 이제 폼 옆에 구조 맵을 렌더링하고, 행을 스크롤하는 동안 아무것도
렌더링하지 않으며 매 단계 맵이 폼의 현재 행 하나만 표시하는지 확인합니다. 멤버 두 명을 추가하고
컨트롤에 포커스를 둔 미리보기를 puppeteer로 측정한 결과, 변경 전에는 스크롤 제스처마다 전체
렌더링이 한두 번 일어났고 변경 후에는 한 번도 일어나지 않았습니다. 다시 생성한 구조 맵 사례로
generator-core, HTML, React, Vue, Svelte가 테스트 108, 116, 705, 348, 349개를, Svelte
클라이언트가 10개, Node 검사(정규화, 스타일, 명명)가 11개, 폼 비교 소스 검사가 140개, Chromium
검사가 3개를 통과했고 `make docs-check`가 통과했습니다.

### 2026-09-13 — 마크업 명명 규칙과 접기·되돌리기 DOM 경로 검사

폼 마크업의 클래스 명명 규칙(N1–N3: `crudui-{block}`, `__{element}`, 블록과 함께 쓰는
`--{modifier}`, 헤더 안의 부품, 본문 안의 노드)은 문서에만 있고 검사하지 않았습니다. 이제
`tests/form-markup/naming.test.mjs`가 폼 렌더링과 구조 맵 사례의 모든 `crudui-` 클래스를 허용한
블록·요소·수식자와 대조하고, 규칙을 어긴 예시 다섯 개를 거부하는지 확인하며, `npm run
test:forms`가 이를 실행합니다. 공유 DOM 시나리오는 모든 행을 접고 펼쳐 각 토글의
`aria-expanded`와 `aria-controls`가 가리키는 본문의 `hidden`을 확인하고, 편집 하나를 되돌려
컨트롤 값과 인스턴스 값을 확인합니다.

명명 검사가 테스트 2개를 통과했고, React, Vue, Svelte가 확장한 시나리오를 포함해 각각 705,
348, 349개 테스트를 통과했습니다.

### 2026-09-13 — 고정 푸터의 폼 버튼, 폼 바깥에 생기는 끝 여백

스펙은 루트에 폼 버튼(`buttons`와 제출 대상 `action`)을 선언하지만, 스키마가 이를 거부했고
컴파일은 `properties`만 보존해 선언한 저장·취소·이전 버튼이 사라졌습니다. 이제 버튼은 다섯
구현 모두에서 폼 계약에 포함됩니다. `buttons`는 `{ type: submit | reset | button | link, text,
name, value, href, design, behavior }` 목록이며, `buttons`가 없는 스펙은 제출 버튼 하나를 가집니다.
제출·초기화 버튼은 인터페이스 문구를 기본값으로 쓰고, button·link는 `text`가, link는 `href`가
필요합니다. `action`(`method`, `url`, `enctype`)은 템플릿에 보존합니다. 두
키는 폼 루트 아래에서는 거부됩니다. 템플릿이 `buttons`와 `action`을 담고, `bindButtons`가 이를
평가하며 스냅숏이 보관하고, 모든 렌더러가 `formButtonsHtml`로 만든 마크업을 컨트롤 그룹 하나로
`crudui-form__footer`에 넣습니다. 푸터는 고정 행 헤더가 위에 붙듯 스크롤 영역 하단에
`--crudui-form-footer-height` 높이로 붙습니다. JSON 스키마, 검증기 네 개, CLI, 레거시 번역기가
이 선언을 받아들입니다.

폼 끝 행은 이제 마지막 행 안의 최소 높이(중첩 카드 안에 빈칸을 남김) 대신 폼 바깥 여백으로
고정선에 닿습니다. `connectRows`는 측정한 두 길이(그 행 상단부터 폼 내용 끝까지의 범위와 정렬
위치)를 연결 요소에 게시하고, 스타일시트는 `.crudui-form`의 아래 여백을 화면 높이에서 두 길이와
푸터를 뺀 값으로 줍니다. 폼 요소 자체에 게시하면 재렌더링이 여백을 없애 스크롤을 되돌렸으므로,
교체되지 않는 연결 요소에 게시합니다.

폼 비교 서버(PHP, PHP 확장, Go, Rust)는 렌더링한 폼 뒤에 자체 `_form_complete` 제출 버튼을
붙였는데, 이제 폼 푸터가 제출 버튼을 하나 더 그렸습니다. 비교 스펙과 Go·Rust·PHP 생성 테스트의
스펙이 그 버튼을 선언하고 서버는 버튼을 붙이지 않으며, 생성 검사는 문서의 제출 버튼이 정확히
하나인지 확인합니다. 이 변경의 첫 네 서버 후보 검증은 자체 스펙에 아직 버튼을 선언하지 않은 PHP
생성 테스트에서 실패했습니다. 두 번째 검증은 공개 스펙을 참조로 컴파일하는 생성 검사에서
실패했습니다. 이 검사는 버튼을 포함한 스펙 전체를 참조 파일에 넣었고, 합성은 파일의 필드만
가져오므로 참조 템플릿에는 기본 버튼이 들어갔습니다. 프레임도 같은 방식으로 서버에서 컴파일해
선언한 버튼이 템플릿에서 조용히 빠졌습니다. 이제 둘 다 루트 선언을 루트에 두고 필드만 참조합니다.

검증 결과: generator-core, HTML, React, Vue, Svelte가 테스트 108, 116, 705, 348, 349개를,
Svelte 클라이언트가 10개, 정규화가 6개, Chromium 스타일 검사가 3개를 통과했습니다.
`make test-native`가 생성기 검사 976개 전부와 구성별 PHP API 검사 361개, 검증 사례 103개를
통과했습니다. JSON 스키마가 검사 70개, TypeScript와 PHP 검증기가 1629, 1461개, Rust 검증기가
62개를 통과했고 Go 검증기와 CLI 37개가 통과했습니다. PHP 확장 엔진 테스트 22개, 교차 검증 콘솔
117개, 폼 비교 소스 검사 140개와 Chromium 검사 3개, Go·Rust 비교 서버 테스트, `make docs-check`가
통과했습니다. Chrome에서 끝 행은 최소 높이 없이 고정선에서 0.2px 떨어져 멈췄고, 폼 뒤 공간은
폼 바깥의 200px 여백이었습니다.

### 2026-09-13 — 구조 맵에 폼의 행만 표시

구조 맵은 단계마다 개수가 붙은 컬렉션 줄(예: "스토어 2개")과 그 아래 행 줄을 따로
보여 주었고, 줄마다 가이드선이 붙었으며 빈 컬렉션도 나열했습니다. 이제 규칙 하나를
따릅니다. 맵의 한 줄은 폼의 행 하나입니다. `buildOutline`은 각 행에 중첩된 행을 담은
`OutlineRow[]`를 반환하므로 맵은 폼과 똑같이 중첩되며, `OutlineCollection`은 제거했습니다.
컬렉션, 개수, 빈 컬렉션은 행이 아니므로 폼에만 남고, 중첩된 행 본문은 가이드선 없이 한 단계
들여씁니다. `multiple.controls: outline`이면 행 컨트롤은 여전히 선택한 행의 맵 줄로 옮겨지지만,
빈 컬렉션의 추가 컨트롤은 행 컨트롤이 아니므로 다섯 구현 모두에서 항상 컬렉션 푸터에 남습니다.

generator-core가 타입 검사와 테스트 104개를 통과했고, 다시 생성한 구조 맵 사례로 HTML, React,
Vue, Svelte가 116, 705, 348, 349개를 통과했습니다. 폼 비교 소스 검사 140개가 통과했고, 다섯 구현
모두 빈 컬렉션 배치를 바꾼 뒤 `make test-native`가 생성기 검사 976개를 통과했습니다. Chrome에서
맵은 단계마다 한 번씩 들여쓴 행만 보여 줍니다. 직전 변경의 네 서버 후보 검증은 서버마다
검사 1,452개(브라우저 검사 5,808개)를 실패 없이 통과했습니다.

### 2026-09-13 — 행을 고정선에 정렬하고 현재 행이 스크롤을 따르게 함

고정 행은 계산한 오프셋 대신 값 하나에서 나온 규칙을 따릅니다. 행 루트가
`--crudui-sticky-depth`를 가지며(다섯 구현 모두 헤더 스타일에서 옮김), 고정선은 그 값에
헤더 높이를 곱한 값입니다. 헤더는 고정선에 고정됩니다. 행의 `scroll-margin-top`이 헤더를
고정선에 놓으므로 `alignRow`는 `scrollIntoView({ block: 'start' })`입니다. 마지막 행은 정렬된
상단 아래 화면 높이 이상이므로, 그 헤더가 고정선에 닿을 때 스크롤이 끝납니다. 이 변경의
중간 초안은 폼 끝에 화면 높이만큼 여백을 두어 그 지점을 넘어 스크롤되었고, 이 방식은
남기지 않았습니다.

현재 행은 규칙 하나, 스크롤 위치로 정합니다. `connectRows`는 상단이 고정선에 닿은 행(고정
행에 `data-crudui-stuck`)과 그중 마지막인 현재 행(`data-crudui-current`, 테두리 강조)을
표시하고, 선택된 행과 구조 맵이 현재 행을 따릅니다. 행 작업 뒤나 구조 맵에서 행으로 이동하면
그 행을 고정선까지 스크롤합니다. 포커스는 선택하거나 스크롤하지 않고, 바인딩은 스크롤 위치를
복원하지 않습니다. 새로 포커스를 받은 컨트롤의 행도 정렬하고 렌더링 뒤 캡처한 스크롤 위치를
복원하던 초안은, 다른 입력에 포커스를 둔 채 끝까지 스크롤하면 포커스된 행으로 되돌렸으므로
둘 다 제거했습니다. 비교 페이지 컨트롤러도 같은 core 함수를 사용합니다.

`npm run test:forms`가 core 104, HTML 116, React 705, Vue 348, Svelte 349, 정규화 10개,
node 검사 9개를 통과했습니다. node 검사에는 Chromium 검사 3개가 포함됩니다. 정확한 헤더
높이로 쌓기, 다른 곳에 포커스가 있을 때 현재 행이 스크롤을 따르기, 끝 행이 행 안 빈칸 없이
고정선에서 정확히 멈추기입니다. 폼 비교 소스 검사 140개와 Chromium 검사 3개가 통과했습니다.
다섯 구현 모두 깊이 변수를 행 루트로 옮긴 뒤 `make test-native`가 생성기 검사 976개를
통과했습니다. `make docs-check`가 통과했습니다. Chrome에서 회사명에 포커스를 둔 채 휠로
스크롤하면 거꾸로 튀지 않고 끝에 도달했고, 포커스가 유지되었으며, 판교점이 현재 행이 되고
그 상단이 정렬 위치와 0.2px 차이로 멈췄습니다.

### 2026-09-13 — 고정 행 헤더를 정확한 높이로 쌓기

고정 행 헤더(`multiple.header: sticky`)는 단계마다 `--crudui-node-header-height`만큼
내려 쌓습니다. 그런데 헤더의 실제 높이는 패딩, 내용, 아래 테두리의 합이었습니다.
기준 미리보기에서 44px 오프셋에 45px였고, 긴 제목이나 컨트롤이 줄바꿈되면 더
높아졌습니다. 그래서 고정된 단계마다 위 단계와 겹쳤습니다. 이제 고정 헤더는 테두리를
포함해 정확히 그 높이이고, 줄바꿈하지 않으며 긴 제목을 줄임표로 자릅니다. 고정된
단계는 겹치지 않고 맞닿습니다. 고정된 헤더는 불투명 배경과 그림자를 가지며, 단계
라벨은 여전히 고정된 동안에만 보입니다. 고정 판정은 임계값 0과 1의
IntersectionObserver를 사용했는데, 화면보다 긴 행에서는 호출되지 않아 가장 바깥의 고정
단계에 라벨이 보이지 않았습니다. 이제 `connectForm`은 헤더가 행 상단의 본래 위치를
벗어났을 때 고정으로 표시하며, scroll과 resize에서 애니메이션 프레임당 최대 한 번
측정합니다. jsdom에는 레이아웃이 없으므로 Chromium 검사 `tests/form-styles.test.mjs`를
`npm run test:forms`에서 실행합니다. form-structure 미리보기는 이전에 고정 헤더를
선언하지 않아 순차 고정이 보이지 않았고, 이제 다섯 단계 모두에 선언합니다.

`npm run test:forms`가 core 104, HTML 116, React 705, Vue 348, Svelte 349, 정규화 10개,
node 검사 7개를 통과했으며 새 Chromium 검사가 포함됩니다. 이 검사는 판정 변경 전에는
가장 바깥의 고정 헤더를 기다리다 시간 초과로 실패했습니다. Chrome의 미리보기에서 다섯
단계가 라벨과 함께 겹침 없이 차례로 고정되었습니다.

### 2026-09-13 — 네 서버 후보 검증에서 실패한 비교 검사 수정

초기화 비교의 첫 후보 검증에서 PHP 검사 1,452개 중 36개가 실패했고 다른 서버는
실행되지 않았습니다. 빈 컬렉션 사례 단계는 행 안에 있는 컬렉션의 추가 버튼을
제외했습니다. 이 조건은 재귀 노드 변경에서 들어갔습니다. bindForm 컨트롤러는 새 행에
포커스를 준 뒤 스크롤해서, 선택 렌더링이 이전 스크롤 위치를 복원하고 입력이 프레임
밖에 남았습니다. 이제 core처럼 먼저 스크롤합니다. createForm 검사는 메인 페이지가
스크롤되지 않는다고 단정했는데, 1,450px 프레임에서는 행 포커스 규칙과 맞지 않습니다.
이제 포커스를 받은 입력이 프레임 뷰포트와 메인 페이지 뷰포트 안에 모두 보여야 합니다.
로컬 소스 검사와 Chromium 검사는 이 검사들을 실행하지 않으며, 후보 검증만 실행합니다.

이후 후보 검증이 통과했습니다. PHP, PHP 확장, Go, Rust가 각각 검사 1,452개를
실패 없이 통과해 브라우저 검사가 모두 5,808개였고, 명령은 상태 0으로 끝났습니다.

### 2026-09-13 — 두 초기화 경로를 좌우로 비교

폼 비교 페이지가 두 초기화 경로를 두 열로 보여 줍니다. 왼쪽 프레임은 데이터와 함께
폼을 생성하고, 오른쪽 프레임은 빈 폼을 마운트한 뒤 데이터를 주입합니다. API
선택(bindForm 또는 createForm)은 서버·프레임워크·언어 선택기 옆의 선택기로
옮겼습니다. 두 열은 같은 고정 행 키로 같은 단계를 실행합니다. 단계는 마운트, 반복
주입, 데이터 숨김과 복원, 편집, 저장, 다시 불러오기, 복사, 이동, 제거, 추가, 새 행
저장, 비우기, 복원, 구조 맵의 모두 펼치기·모두 접기·되돌리기입니다. 두 열이 같은
레코드에 저장하므로 차례로 실행하고, 오른쪽의 각 단계를 저장해 둔 왼쪽 단계와
비교합니다. 원시 HTML, DOM, 컨트롤 상태, 필드, 계산된 CSS, 제출 데이터, 포커스,
저장 응답을 정규화 없이 비교합니다. 상단 목록은 단계가 끝날 때마다 갱신됩니다.
프레임은 문법 스타일시트를 불러오므로 계산된 CSS가 실제 스타일을 반영합니다. 프레임
안의 초기화 검사는 제거했습니다.

bindForm 경로도 createForm과 같은 작업(펼치기/접기, 선택, 모두 펼치기, 모두 접기,
되돌리기)을 같은 뷰 상태·이력·포커스 규칙으로 지원합니다. generator-core는 이 규칙을
순수 뷰 상태·이력 함수로 export하고, 폼 인스턴스와 bindForm 컨트롤러가 함께
사용합니다. 두 경로 모두 프레임에 구조 맵과 현재 데이터 보기를 렌더링합니다. React,
Vue, Svelte는 상태 없는 `OutlineView`와 `DataPanel`(Vue: `outlineVNode`, `dataVNode`)을
제공하고, HTML 렌더러는 `renderOutlineView`와 `renderDataPanel`을 추가합니다. 공유 사례
`tests/fixtures/form-outline/cases.json`은 네 언어, 상위·중첩 행 선택,
`controls: outline`, 데이터 이스케이프에 대한 React 마크업을 담고, 네 렌더러가 모두
재현합니다. 기능 계약 매니페스트에 뷰 상태·이력 함수와 새 사례를 기록했습니다.

`make test-native`가 생성기 검사 976개(구현별 195개), 구성별 PHP API 검사 361개, PHP
구현별 검증 사례 100개를 통과했습니다. `npm run test:forms`가 core 104, HTML 116, React
705, Vue 348, Svelte 349, 정규화 10개 검사를 통과했습니다. 구조 맵 사례는 네 렌더러에서
각각 4개를 통과했습니다. 폼 비교 소스 검사 140개와 Chromium 검사 3개가 통과했습니다.
`UndoResult` 타입에 문서를 추가한 뒤 `make docs-check`가 통과했습니다. 이 타입 변경은
네이티브 검사 뒤의 타입 전용 변경입니다. 네 서버를 사용하는 전체 후보 검증은 이 변경을
커밋할 때 실행하지 않았습니다.

### 2026-09-13 — 행 작업 후 대상 행으로 포커스 이동

이전에는 행 작업이 활성 입력, 텍스트 선택, 스크롤 위치를 유지했고, 행 버튼을 포인터로
누를 때 포커스 이동을 막았습니다. 이제 런타임은 기준 폼의 포커스 규칙을 따릅니다.
추가나 복사는 새 행으로, 이동은 이동한 행으로 포커스를 옮기고, 제거는 이전 행, 다음
행, 상위 행, 컬렉션의 추가 버튼 순으로 옮깁니다. 포커스는 행의 첫 번째 활성 표시
입력이나 펼치기/접기·추가 버튼으로 가고, 행은 필요한 만큼만 스크롤합니다.
펼치기/접기, 선택, 되돌리기는 포커스를 받은 작업 버튼을 포함해 현재 포커스를
유지합니다. 포인터와 키보드 실행의 동작이 같습니다. `runAction`은 포커스를 받을 행을
`{ focus }`로 반환하고, 대상이 불완전하면 `undefined`를 반환합니다.

generator-core가 타입 검사와 테스트 102개를 통과했습니다. `npm run test:forms`가
HTML 112, React 701, Vue 344, Svelte 345, 정규화 10개 검사를 통과했고, 공유 DOM 사례가
추가·제거·복사·이동·펼치기/접기·마지막 행 제거 뒤 포커스를 받은 행을 확인합니다. jsdom은
스크롤을 구현하지 않으므로 테스트에서 `scrollIntoView`를 대체합니다. Chrome의
form-structure 미리보기에서 추가 뒤 새 행, 제거 뒤 이전 행으로 포커스가 이동했습니다.
호출을 계측해 포커스 전에 행을 스크롤하는 것을 확인했습니다. 이 순서는 동기 재렌더링이
교체한 요소를 스크롤하는 문제를 막습니다. 자동화 탭은 창을 스크롤하지 않아 실제 화면
위치는 측정하지 못했습니다. 비교 페이지의 포커스 검사는 다음 변경에서 같은 규칙으로
바뀝니다.

### 2026-09-13 — 폼을 행 카드가 있는 재귀 노드로 렌더링

모든 폼 렌더러(HTML, React, Vue, Svelte, PHP, Go, Rust, C PHP 확장)가 형태별 래퍼
대신 하나의 재귀 노드 문법을 출력합니다. 필드, 그룹, 컬렉션, 행, 언어 필드, 언어
항목은 모두 `__header`, `__body`, `__footer` 슬롯을 가진 `crudui-node`입니다. 종류는
수식자(`crudui-node--row`)이며, 동작은 `data-field-path`, `data-crudui-row-key`,
`data-lang`, `data-crudui-action`, `hidden`, ARIA 속성만 읽습니다. `bindForm`은 모든
구현에서 같은 JSON 모델의 `NodeVM[]`을 반환합니다. [폼 마크업](docs/spec/form-markup.ko.md)
명세가 문법을 정의하고 기준 폼에서 채택하지 않은 동작을 기록합니다.

- **행 카드:** 행은 계층 번호, `multiple.title`로 지정한 제목, 개수 또는 하위 행
  요약을 표시합니다. 이동·추가·복사·제거 컨트롤은 고정된 순서이며 비활성 상태를
  `min`, `max`, 위치로 모든 렌더러가 계산합니다. 브라우저가 렌더링 후 고치지
  않습니다. `multiple.controls`(`header`, `footer`, `outline`)와
  `multiple.header`(`static`, `sticky`)를 JSON 스키마, 검증기 네 개, CLI에 선언합니다.
- **문구:** 컨트롤 레이블, 개수, 요약은 모든 구현이 공유하는 ko/en/ja/zh 표 하나에서
  가져옵니다.
- **런타임:** 폼 인스턴스는 접힌 행, 선택한 행, 되돌리기 이력(100개, 같은 경로의
  연속 입력 병합)을 레코드 데이터와 분리해 보관합니다. `buildOutline`,
  `connectOutline`, `resolveAction`, `runAction`을 export합니다. React, Vue, Svelte는
  `Outline`과 `DataView`를, HTML 렌더러는 `renderOutline`과 `renderData`를 제공합니다.
- **스타일:** `@crudui/generator-core/styles.css`에 문법 스타일이 있습니다.
- **입력 규칙**(다섯 구현): 컴파일에서 `lang`은 불리언 또는 객체, `lang.only`는 언어
  코드 문자열 목록 또는 객체여야 합니다. 바인딩은 문자열이 아닌 언어, 문자열이 아닌
  `keyPrefix`·`idPrefix`, `throw`·`marker`가 아닌 `unsupported`, 지원하지 않는 언어를
  이 순서로 거부합니다. 이전에는 TypeScript가 `lang: null`에서 비정상 종료했고, C
  확장은 문자열이 아닌 `only` 항목에서 기본 언어 목록 범위 밖을 읽었으며,
  TypeScript는 `throw`가 아닌 모든 `unsupported` 문자열을 marker로, PHP는 오류로
  처리했습니다.
- **API 변경:** Go `BindOptions.Language`, `IDPrefix`, `KeyPrefix`, `Unsupported`는
  `any`이고 `KeyPrefixProvided`를 제거했으며 빈 `IDPrefix`를 그대로 사용합니다. Rust
  `BindOptions`의 문자열 옵션은 JSON 값입니다.

`examples/form-structure`는 5단계 기준 폼의 로컬 미리보기입니다. 폼 비교 페이지, 공유
DOM 사례, 교차 검증 콘솔은 속성으로 요소를 선택합니다.

복사된 PHP 검증기를 다시 설치한 뒤 `make test-native`가 생성기 검사 976개(구현별 195개와
입력 불변 검사), 구성별 PHP API 검사 361개, PHP 구현별 검증 사례 100개를 통과했습니다. `npm run test:forms`가 core 101, HTML 112, React 701, Vue 344, Svelte 345,
정규화 10개 검사를 통과했습니다. 폼 비교 페이지 소스 검사 137개, Go·Rust 검증기
바이너리를 다시 빌드한 뒤 교차 검증 콘솔 117개, `make docs-check`가 통과했습니다.

### 2026-09-13 — 통과한 검사의 임시 디렉터리 삭제

`tests/native-generators/run.mjs`는 실행마다 `crudui-native-generators-*` 빌드
디렉터리를 만들고 삭제하지 않았습니다. `scripts/check-packages.mjs`도 실행마다
145MB `crudui-install-*` 프로젝트를 남겼습니다. 반복 실행이 디스크를 채운 원인 중
하나였습니다. 이제 통과한 실행은 디렉터리를 삭제합니다. 실패한 실행은 디렉터리를
남기고 경로를 출력하며 보고서(`buildDirectory`) 또는 `failure.log`와 함께 기록합니다.
다른 검사 파일은 이미 임시 디렉터리를 삭제하고 있었습니다.

`make test-native`가 886개 검사를 통과하고 빌드 디렉터리를 남기지 않았습니다.
`npm run test:packages`가 통과하고 설치 프로젝트를 남기지 않았습니다.
`make docs-check`가 통과했습니다.

### 2026-09-13 — 잘못된 multiple·design 값 형식을 컴파일에서 거부

TypeScript, PHP, Go, Rust와 C PHP 확장의 폼 컴파일은 `multiple`과 `design`의 값
형식이 잘못되어도 무시했습니다. 형식이 잘못된 행 설정은 버려지고 잘못된 design은
빈 design이 되었습니다. 이제 컴파일이 `INVALID_FORM_INPUT`와
`Invalid {key} at {path}: expected {expected}`로 거부하며 `{path}`는 필드의 구조
경로입니다. `multiple`은 불리언 또는 객체이고 `min`·`max`는 숫자, `copy`·`sortable`은
불리언이어야 합니다. `design`은 불리언 또는 객체입니다. `show`는 표현식, 불리언
또는 조건 맵입니다. `class`와 `style`, 그리고 `label`·`wrapper`·`group`·`prepend`
노드의 `class`와 `style`은 문자열 또는 조건 맵이며 노드는 객체여야 합니다. 조건 맵은
JSON 스키마와 같이 비어 있지 않은 객체입니다. 이 버킷의 알 수 없는 키는 검사하지
않습니다. 스키마 명세가 규칙을 정의합니다.

C 템플릿은 엔진 검사에서 값·오류·합성 모듈과만 링크되므로 메시지를 지역 도우미로
만듭니다. 네이티브 검사는 컴파일 거부 8건을 전체 기록으로 비교합니다.

`make test-native`가 생성기 검사 886개(구현별 177개), 구성별 PHP API 검사 361개,
각 PHP 구현의 검증 사례 100개를 통과했습니다. generator-core 타입 검사와 89개
검사, `npm run test:forms`, `make docs-check`가 통과했습니다.

### 2026-09-13 — 형태가 잘못된 생성기 데이터를 전체 경로로 거부

TypeScript, PHP, Go, Rust와 C PHP 확장의 `bindForm`과 편집 인스턴스는 검증기와
같은 데이터 형태 규칙을 적용합니다. 객체가 아닌 루트 데이터는
`Form data must be an object`로 실패합니다. 값이 있지만 객체가 아닌 그룹 값이나
반복 그룹 행은 `Group data must be an object: {path}`로 실패합니다. 값이 있지만 키
기반 객체가 아닌 반복 값은 `Repeated data must be a keyed object: {path}`로
실패합니다. `{path}`는 행 키를 포함한 전체 데이터 경로입니다. 이전에는 인스턴스가
필드 이름만 보고했고 `bindForm`은 그룹 데이터를 검사하지 않았습니다. `addRow`는
제공한 그룹 행 값을 `{collection}.{key}`에서 검사합니다. 폼 런타임 명세가 규칙과
검사 순서를 정의합니다. 폼 비교 컨트롤러의 인스턴스 정규화 사본도 같은 메시지를
사용하며 이를 검사합니다.

네이티브 검사는 데이터 형태 8가지를 `bindForm`과 인스턴스 양쪽으로 검사하며, 거부
동작 시나리오에 중첩 경로의 `setValue`와 `addRow` 사례를 추가했습니다.

`make test-native`가 생성기 검사 846개(구현별 169개), 구성별 PHP API 검사 361개,
각 PHP 구현의 검증 사례 100개를 통과했습니다. generator-core 타입 검사와 88개
검사, 폼 비교 컨트롤러 5개 검사, `npm run test:forms`, `make docs-check`가
통과했습니다.

### 2026-09-13 — 구현 간 생성기 오류 메시지 비교

네이티브 생성기 검사는 오류 코드와 위치만 비교했고 README는 언어마다 메시지가
달라도 된다고 허용했습니다. 모든 구현이 동일해야 한다는 요구와 모순되므로 코드,
메시지, 위치가 모두 일치해야 한다는 규칙으로 바꿨습니다. 거부된 폼 입력은
JavaScript와 전체 기록으로 비교합니다.

강화한 비교로 기존 차이 12건을 찾아 수정했습니다.

- PHP, Go, Rust 생성기 CLI는 객체가 아닌 `data`를 각각 `Data must be an object`,
  `Group data must be an object`, `data must be an object`로 보고했습니다. 모두
  `Form data must be an object`로 보고합니다.
- Go와 Rust는 지원하지 않는 필드 형식 메시지 표기가 달랐습니다. 둘 다
  `Unsupported field type "{type}" at "{path}"`로 보고합니다.
- Go는 잘못된 행 키 메시지에 `SequenceRowKey`를 표기했으나 다른 구현과 같이
  `sequenceRowKey`를 표기합니다.

`make test-native`가 생성기 검사 786개, 구성별 PHP API 검사 361개, 각 PHP 구현의
검증 사례 100개를 통과했습니다.

### 2026-09-13 — 검증기 로드 실패와 입력 실패를 동일하게 보고

TypeScript, PHP, C PHP 확장, Go, Rust 검증기는 형태가 잘못된 제출 데이터를 건너뛰거나
변환하지 않고 입력 실패로 거부합니다. 루트 데이터는 객체여야 하며 합성 전에
검사합니다(`Form data must be an object`). 값이 있는 그룹 또는 반복 그룹 행은
객체여야 합니다(`Group data must be an object: {path}`). 값이 있는 반복 데이터는
키 기반 객체여야 합니다(`Repeated data must be a keyed object: {path}`). 각 언어는
코드 `INVALID_FORM_INPUT`와 빈 위치를 가진 `FormInputError`를 제공하며, Rust는
`ValidateError::Load` 또는 `ValidateError::Input`을 반환합니다. 모든 구현이 키 기반
행을 정렬된 키 순서로 순회합니다.

네 검증기 CLI는 하나의 프로세스 계약을 사용합니다. 결과는 종료 상태 0과
`{valid, errors}`, 로드 또는 입력 실패는 종료 상태 2와 정확히 `{error, code, at}`,
잘못된 요청은 종료 상태 1과 `{error}`를 출력합니다. 이전에는 TypeScript와 Go가
`at` 없이 1로 종료했고 PHP는 `rule: "compose"` 오류와 함께 0으로 종료했습니다.
검증 사례는 `expectLoadError: {code}`를 `expectFailure: {code, message, at}`로
대체하고 입력 실패 사례 6개를 추가합니다. 이전 배열 행 사례는 키 기반 행을
사용합니다. 사례 생성기에는 `cases.json`에만 추가했던 종료일
사례 7개를 넣어 재생성해도 사라지지 않습니다. 교차 검증 콘솔은 전체 `failure`
기록을 비교합니다. 비교·예제 서버는 입력 실패에 HTTP 400으로 응답합니다.

전체 기록을 비교하면서 Go에만 있던 차이가 드러났습니다. Go 목록 검증은 금지 키
위치 앞에 `list.`을 붙였고 Go 테스트가 이 접두를 고정했습니다. 공유 목록 사례와
다른 구현은 `columns.<이름>`을 사용하므로 Go도 같게 수정했습니다.

C 확장의 할당 실패 fixture는 키 기반 행을 사용하며 할당 횟수는 4와 3입니다. 엔진
fixture는 호출하는 C 도우미만 출력합니다. 검사 전에 콘솔이 사용하는 git 무시
대상 Go·Rust CLI 바이너리를 다시 빌드하고 generator-php의 복사된 검증기를 다시
설치했습니다. 셋 모두 소스 변경 이전 상태였습니다.

TypeScript 검증기 1618, PHP 검증기 1458, `go test ./...`, `cargo test`, 교차 검증
콘솔 117개 검사가 통과했습니다. `make test-native`는 생성기 검사 786개, 구성별
PHP API 검사 361개, 각 PHP 구현의 검증 사례 100개를 통과했습니다.
`make docs-check`가 통과했습니다.

### 2026-09-13 — 반복 행을 키 기반 객체에서만 바인딩

TypeScript, PHP, Go, Rust와 C PHP extension의 `bindForm`은 키 기반 객체에서만
반복 행을 생성합니다. 컬렉션 데이터가 없으면 `__0000000000000__` 키를 가진 행
하나를 생성합니다. 배열, null, 스칼라 컬렉션은 `INVALID_FORM_INPUT` 오류와
`Repeated data must be a keyed object: {path}` 메시지로 실패합니다. 필드 경로에
`#N` 배열 위치 세그먼트가 없으므로 다섯 구현에서 위치 도우미를 제거했습니다.
Go에서 사용하지 않던 `rowPosition` 함수도 제거했습니다. 공유 폼 사례는 키 기반
데이터를 사용하며 HTML 적합성 검사는 이전 배열 사례를 포함합니다.

`npm run test:forms`가 통과했습니다(core 88, HTML 112, React 701, Vue 344,
Svelte 345, 정규화 10). `make test-native`가 786개 생성기 검사를 통과했으며
다섯 구현의 거부 코드·메시지·경로가 같아야 하는 새 검사를 포함합니다.
`make docs-check`가 통과했습니다.

### 2026-09-13 — 스키마·검증기·CLI의 반복 행 선언 정렬

`multiple.min`을 TypeScript, Go, Rust 명세 모델에 선언하고 PHP `multiple`
버킷이 허용하며 `crudui explain`과 `crudui describe`가 표시합니다. JSON
스키마와 폼 런타임은 `min`을 정의하지만 PHP 버킷은 이를 거부했습니다. JSON
스키마에서 `multiple.copy`는 boolean이며 런타임 의미가 없던 객체 형태는
제거했습니다. 모델 주석은 숨은 식별자와 배열 순서 대신 키 기반 행 식별을
설명합니다.

스키마 검사 58개, TypeScript 검증기 테스트 1606개, PHP 검증기 테스트 1446개,
Go·Rust 검증기 테스트, CLI 테스트 37개와 `make docs-check`가 통과했습니다.

### 2026-09-13 — 프레임워크 독립 HTML 렌더링과 실행 가능한 기능 계약 추가

`@crudui/generator-html`은 프레임워크 의존성 없이 현재 폼·목록 view model을
HTML fragment로 렌더링합니다. 표·카드 목록, 현재 필드 구조, 위젯 레이아웃,
escaping 규칙과 원본 표시 콘텐츠를 지원하며 브라우저 이벤트 연결은
`@crudui/generator-core`가 담당합니다.

`contracts/features.json`은 패키지 export, 기능 계약, fixture, 테스트 파일,
지원 상태와 검증 명령을 기록합니다. manifest schema와 경로 검사기는 누락된
연결을 거부합니다. `manifest:test`는 선언된 검증 명령을 실행하며 기능 계약
페이지는 manifest에서 생성합니다. CI는 폼 검사 전에 manifest 검사와 명령 실행을
수행합니다.

HTML renderer 패키지 검사 110개가 통과했으며 폼 적합성 87개와 목록 적합성
20개를 포함합니다. 공개 패키지 export, 선언, 설치 빌드, API 문서와
`make docs-check`가 통과했습니다. 패키지는 배포하지 않았습니다.

### 2026-09-12 — GitHub Pages로 정적 문서 게시

문서 빌드는 `DOCS_BASE_PATH`를 지원하고 영어·한국어·API 문서에 명시적인
정적 HTML 링크를 생성합니다. 개발·미리보기·404 페이지는 같은 URL 접두
경로를 사용합니다. CI는 문서를 검사한 뒤 `main`에서 생성한 웹을
`https://polyspec.github.io/crudui/`에 배포합니다.

`DOCS_BASE_PATH=/crudui/`에서 `make docs-check`와
`make docs-verify-idempotent`가 통과했습니다. 데스크톱·모바일 화면, 한국어
탐색, 스타일시트와 중첩 경로의 404 페이지 브라우저 검사도 통과했습니다.

### 2026-09-11 — 비교 배포 명령 이름 명확화

로컬 비교 배포 진입점 이름을
`examples/form-comparison/comparison-deployment.mjs`로 변경했습니다. 검증 절차,
예제와 테스트가 명확한 비교 배포 이름을 사용합니다.

### 2026-09-11 — Linux 도구 모음에서 네이티브 C fixture 컴파일

`packages/php-ext/tests/engine.test.mjs`는 이제 네이티브 fixture를 컴파일할 때
`libm`을 연결하고 guard clause와 정리 문장을 별도 문장으로 출력합니다. C 엔진
fixture는 PHP 8.4 및 8.5 CI 작업에서 사용하는 경고 오류 설정으로 컴파일됩니다.

### 2026-09-11 — 네이티브 검사 전 JavaScript 의존성 빌드

`make test-native`는 이제 C 확장 엔진 검사 전에 작업공간 JavaScript 패키지를
빌드합니다. 네이티브 검사 대상은 깨끗한 체크아웃에서도 엔진 렌더링 fixture가
필요로 하는 빌드된 React 생성기 패키지를 제공합니다.

### 2026-09-11 — 독립 C PHP 확장 완성

PHP 확장이 폼과 검증 엔진을 C로 구현합니다. 엔진은 순서를 보존하는 값을 직접
관리하며 확장 프로세스 안에서 조합, 표현식 평가, 템플릿 컴파일, 데이터 바인딩,
폼·목록 렌더링, 검증, 행 작업과 PHP 값 변환을 수행합니다. 패키지에는 Cargo
manifest, Cargo 잠금 파일과 Rust 소스가 더 이상 없습니다. 직접 빌더는 전체 C
소스를 컴파일하며 폼 비교 이미지의 확장 단계는 Rust toolchain을 복사하지
않습니다. 비교 생성기 검사는 후보 소스 아카이브가 사용하는 루트 package lock
파일을 해시합니다.

macOS에서 C 엔진 검사 30개 중 29개가 통과했고 Linux 전용 주소 sanitizer 검사
1개는 건너뛰었습니다. 모듈 빌드와 로드는 성공했으며 PHP API 검사는 세 구성에서
각각 352개, 검증은 각 구현에서 94개를 통과했습니다. `make test-native`는 생성기
766/766개, 프로토콜 검사 19개, 모든 PHP·Go·Rust 패키지 검사와 위젯·시간대 검사를
통과했습니다. `npm run test:form-comparison`은 소스 검사 136개, 라이브러리 검사
10개와 browser-job 검사 3개를 통과했습니다. `make docs-check`도 통과했습니다.
확장과 비교 서비스는 배포하지 않았습니다.

### 2026-09-11 — C에서 폼 필드 렌더링

C 확장은 평가한 폼 필드를 서버 HTML로 렌더링합니다. 렌더러는 leaf, group, 반복,
언어 필드 구조와 현재 위젯 레이아웃 전체를 지원합니다. 컨트롤 속성 순서, 불투명
이벤트 속성, 원본 표시 콘텐츠, script와 style 요소를 유지합니다. 텍스트, 속성, URL
값과 최종 CSS 속성은 현재 렌더링 규칙을 사용합니다. 렌더링은 평가한 필드 모델을
변경하지 않습니다.

C 전용 검사는 성공하는 공통 폼 fixture 90개와 추가 escaping 및 CSS 사례 2개의
정확한 HTML이 일치하는지 확인했습니다. 같은 사례는 엄격한 C11 컴파일러 경고와
정의되지 않은 동작 검사를 통과했습니다. 이 변경은 배포하지 않았습니다.

### 2026-09-11 — C에서 폼 필드 바인딩

C 확장은 컴파일한 템플릿을 레코드 데이터에 바인딩하며 두 입력을 변경하지
않습니다. 바인딩은 표시 규칙, 번역 콘텐츠, 반복 행, 언어 필드, 체크박스 상태와
위젯 모델을 계산합니다. 명시적인 빈 배열과 빈 객체는 반복 행 0개를 생성하며,
반복 값이 누락된 경우에만 초기 행 1개를 생성합니다. 지원하지 않는 필드 타입은
호출자가 명시적인 표시 결과를 선택하지 않으면 `UNSUPPORTED_FIELD_TYPE`을
반환합니다.

위젯 구현은 완전한 버튼 및 편집기 스크립트를 생성하고 모델 멤버 순서를
유지합니다. C 전용 검사는 컴파일 가능한 공통 폼 fixture 91개의 순서 있는 필드
모델 전체가 일치하는지 확인하고 입력 불변성을 검사했으며, 같은 사례를 정의되지
않은 동작 검사와 함께 완료했습니다. 이 변경은 배포하지 않았습니다.

### 2026-09-11 — C에서 폼 표현식 평가

C 확장은 객체와 배열 경로를 확인하고 리터럴, 상대 경로, 와일드카드, 비교, 포함,
논리 연산과 삼항 표현식을 평가합니다. 조건 맵은 선언 순서에 따라 처음 일치하는
항목을 선택하고 명시적인 `true` 항목을 기본값으로 사용합니다. 구현은 표준 C11을
사용합니다.

C 전용 검사는 공통 표현식 명세 38개와 평가 사례 77개를 엄격한 컴파일러 경고
기준으로 모두 통과했습니다. 사례는 표현식 값과 논리 결과를 검사합니다. 이 변경은
배포하지 않았습니다.

### 2026-09-11 — C에서 폼 템플릿 컴파일

C 확장은 명시적인 메모리 파일을 조합하고 선언 순서를 유지하여 참조와 패치를
적용하며 참조 순환을 검출하고 조합 오류 코드와 경로를 반환합니다. 폼 컴파일은
템플릿 종류, 선택적 키 접두사, 재귀적으로 컴파일한 필드를 포함하는 데이터 독립
템플릿을 생성합니다. 필드 명세에는 중첩 `properties`를 유지하지 않습니다.

C 전용 검사는 공통 조합 20개를 모두 통과했고 공통 폼 fixture 92개에서
JavaScript 구현과 동일한 순서의 템플릿 또는 오류를 생성했습니다. C 소스는 엄격한
C11 경고 기준으로 컴파일됩니다. 이 변경은 배포하지 않았습니다.

### 2026-09-11 — C 확장 값 모델 추가

C 확장 엔진은 PHP나 Rust 데이터 구조를 사용하지 않고 null, 불리언, 정수,
유한한 수, UTF-8 문자열, 배열, 순서 있는 객체를 저장합니다. 각 값은 문자열,
객체 키, 하위 값의 수명을 직접 관리합니다. 복사, 교체, 제거는 객체 선언 순서를
유지하고 독립된 값을 생성합니다. 잘못된 UTF-8과 유한하지 않은 수는 거부합니다.

C 전용 검사는 순서, 교체, 깊은 복사, 배열, UTF-8, 숫자 비교를 확인합니다.
엄격한 C11 컴파일러 경고와 정의되지 않은 동작 검사를 통과했습니다. macOS 메모리
검사기는 누수 0건을 보고했습니다. 독립 C 확장 소스 검사는 선언된 빌드 산출물을
제외하고 패키지의 Rust 소스와 Cargo 파일을 계속 거부합니다. 이 변경은 배포하지
않았습니다.

### 2026-09-11 — Node.js 24 artifact action 사용

네이티브 PHP 8.4·8.5 CI 작업은 `actions/upload-artifact@v7`으로 비교 보고서를
업로드합니다. 이 action은 Node.js 24 런타임을 선언합니다. 이전 action은 Node.js
20을 선언했으므로 GitHub 호스팅 러너가 런타임을 교체하고 지원 종료 경고를
보고했습니다. 보고서 이름, 경로, 숨김 파일 포함 및 파일 누락 실패 동작은
변경되지 않습니다.

CI 설정 회귀 스위트는 현재 artifact action을 요구하며 검사 4개를 모두
통과했습니다. 이 변경은 배포되지 않았습니다.

### 2026-09-11 — npm 12 및 sandbox가 활성화된 Chrome CI 적용

npm 의존성 정책은 루트 매니페스트가 직접 선언하고 변경되지 않는 소스 리비전에
고정한 URL 의존성만 허용합니다. 의존성 검증은 다른 의존성이 추가한 URL 의존성을
거부합니다. 패키지 설치 검증은 현재 npm 12 `pack --json` 보고서를 읽고 요청한
패키지와 아카이브에 대한 보고서 하나만 요구합니다.

Linux 브라우저 CI는 `/opt/google/chrome/chrome`의 정규 Chrome 파일을 사용하고
Puppeteer의 브라우저 다운로드를 비활성화합니다. 사전 검사는 브라우저 경로의 심볼릭
링크를 거부하고 sandbox 비활성화 인자 없이 Chrome을 실행하며 `chrome://sandbox`가
활성화된 1차 계층, PID, 네트워크 및 Seccomp-BPF sandbox를 확인하도록 요구합니다.
두 브라우저 CI 작업은 테스트 시작 전에 이 사전 검사를 완료합니다.

GitHub Actions 실행은 작업 20개를 모두 성공했습니다. 이 실행은 패키지 설치, 공개
export와 타입, 반복 빌드, 브라우저 inspector와 CSS, 폼 비교 회귀, 문서 범위 및
PHP 8.4·8.5 네이티브 생성과 PHP API 검사를 포함합니다. 실패하거나 취소된 작업은
없습니다. 이 변경은 배포되지 않았습니다.

### 2026-09-11 — 깨끗한 CI 설치 검증

저장소 루트의 폼 비교·교차 검사 명령은 직접 사용하는 JavaScript 의존성을 루트
매니페스트에 선언합니다. 폼 비교는 루트 npm 그래프를 사용하며 교차 검사 렌더러는
Vite와 Svelte 플러그인을 패키지 이름으로 해석합니다. 패키지 설치 검증은 각 패키지
디렉터리에서 패키지를 생성하고 아카이브 결과 하나를 요구합니다.

폼 비교 CI 작업은 전체 스위트 실행 전에 PHP 8.5와 검증기·생성기 Composer 그래프를
설치합니다. 네이티브 PHP 매트릭스 작업은 선택한 PHP 릴리스의 버전이 명시된 정규
`php-config` 경로를 전달합니다. 산출물 업로드는 네이티브 검증이 보고서를 생성한
후에만 실행합니다.

깨끗한 소스 아카이브에서 폼 비교 소스 검사 136개, 생성기 구성 검사 10개와 Chromium
브라우저 검사 3개가 통과했습니다. 패키지 설치 프로젝트의 export, 타입, 프로덕션 빌드와
세 프레임워크 브라우저 검증이 통과했습니다. 공개 패키지 검사 9개, 반복 빌드 검사
1개, 폼 검사기 단위 검사 18개와 브라우저 CSS 검사 6개가 통과했습니다. 교차 검사
렌더링 33개가 통과했습니다. 이 변경은 배포하지 않았습니다.

### 2026-09-11 — Svelte 편집 컨트롤 유지

Svelte 생성기는 일반 input과 textarea 컨트롤을 안정적인 DOM 요소로 렌더링합니다.
폼 인스턴스 값이 갱신되어도 각 요소, 포커스와 텍스트 선택을 유지합니다. 문자열
`on*` 동작 속성이 있는 컨트롤과 정확한 특수 HTML이 필요한 컨트롤은 raw 직렬화
경로를 사용합니다.

브라우저 연결은 현재 폼 인스턴스에서 date와 datetime 값을 포맷한 뒤 실제
컨트롤을 갱신합니다. 초기 데이터와 나중 주입은 같은 값 변환을 사용합니다.

회귀 검사는 text, email, number, password, textarea, date, datetime 컨트롤을
확인합니다. Svelte SSR·HTML 비교 345개, 마운트 브라우저 검사 10개, 생성기 코어
검사 86개가 통과했고 `svelte-check`는 오류와 경고 0개를 보고했습니다. 이 변경은
배포하지 않았습니다.

전체 `make test-native` 명령은 종료 상태 0을 반환했습니다. 확장 빌드 검사 11개,
PHP 생성기 검사 160개, 모든 Go 패키지 검사, Rust 생성기 검사 20개, PHP API 세
구성에서 각각 352개, 두 PHP 구현의 검증 사례 각각 94개, 프로토콜 검사 19개,
생성기 보고서 766/766과 Chromium 위젯·시간대 검사 5개가 통과했습니다. 생성기
보고서 SHA-256은
`16ab371b3691429ca4e2c1a3eaa3c35fb7209861abd5759f16efea6c1a19aa5d`입니다.

### 2026-09-11 — 명시적인 브라우저·PHP 입력 검증

Chromium 위젯 검사는 Vite 의존성 탐색을 비활성화하고 명시한 React·CRUDUI 패키지
5개만 최적화합니다. 모든 검사 단계에서 페이지 예외, HTTP 오류 응답, 요청 실패,
`console.error` 메시지가 발생하면 실패합니다. 위젯·시간대 검사 5개가 통과했습니다.

PHP 폼 서버는 선택한 생성기 vendor의 `composer/installed.php`에서
`crudui/validator` 설치 디렉터리를 읽습니다. 등록된 다른 Composer 설치는 패키지
선택에 영향을 주지 않습니다. 디렉터리는 선택한 vendor 디렉터리 내부에 있어야 합니다.
모든 경로 구성 요소와 로드한 클래스 파일은 일반 파일 또는 디렉터리여야 하며, 설치한
검증기 파일은 후보 소스 파일과 일치해야 합니다. 선택한 기록의 누락 또는 잘못된 형식,
외부 경로, 변경된 패키지 복사본은 생성을 실패시킵니다.
시작 상태 검사는 `Generator`와 `Form`을 생성기 소스 디렉터리에서만 허용하고
`Validator`를 선택한 Composer 패키지 복사본에서만 허용합니다. 저장소 검증기 소스
경로는 거부합니다. 상태 응답을 거부하면 서버와 검증에 실패한 첫 응답 필드를
보고합니다.

PHP 소스·생성 스위트 10개가 통과했습니다. 검증을 포함한 500회 생성은 250밀리초
제한 이내에 완료됐습니다. PHP와 PHP 확장 통합 검사는 각 모드의 생성 검사 125개와
JSON 변환, 저장, 검증, 공개 시그니처, 처리 모드 검사를 통과했습니다. 전체 폼 비교
빌드 명령은 소스 검사 131개와 생성 검사 10개를 통과했습니다.

후보 소스 검사는 운영체제의 정규 임시 디렉터리 아래에 쓰기 가능한 검사 데이터를
생성합니다. 임시 경로의 모든 구성 요소는 일반 디렉터리여야 하며 심볼릭 링크를 사용할
수 없습니다. 후보 검사는 Git 메타데이터를 요구하지 않으며 추출한 소스 디렉터리 아래에
검사 데이터를 쓰지 않습니다. 후보 검사 데이터 위치 회귀 검사와 PHP 생성 검사 10개가
모두 통과했습니다.

### 2026-09-11 — PHP 확장 직접 빌드

PHP 확장 빌더 하나가 CRUDUI과 OrderedJSON 모듈을 컴파일하고 로드합니다. 별도
진입점은 각 모듈의 소스, 출력, 플랫폼 라이브러리, 로드 검사를 선언합니다. 후보 이미지는
두 진입점을 사용하며 `phpize`, Autoconf, libtool을 실행하지 않습니다.

빌더는 컴파일 전에 정규 `php-config`, C 컴파일러, Cargo, rustc 파일을 확인합니다.
상대경로, 심볼릭 링크, 누락되거나 모호한 도구, 서로 다른 PHP 설치 정보를 거부합니다.
Rustup은 선택한 도구 체인 하나의 정규 Cargo와 rustc 파일을 식별합니다. Cargo에는
정규 rustc와 linker 경로를 명시합니다. 생성 경로 정리는 제거 전에 선언한 모든 대상을
검사하고 심볼릭 링크를 따라가지 않습니다.

직접 빌드한 두 모듈을 PHP 8.5.10에서 로드했습니다. 한 프로세스에서 두 모듈 호출이
성공했습니다. PHP API 검사는 세 구성에서 각각 352개를 통과했고 구현별 검증 사례
94개를 통과했습니다. 빌더와 진입점 회귀 검사 6개가 통과했습니다.

### 2026-09-11 — 명시적인 브라우저 완료 신호 사용

폼 비교 실행기는 탐색 전에 메인 페이지와 프레임 준비 메시지를 구독합니다. 상호작용과
타이핑 검증기는 각 UI 작업을 실행 전에 예약하고 해당 작업의 완료를 기다립니다. React와
Svelte는 `flushSync`로 동기 갱신을 완료하며 Vue는 `nextTick` 완료를 게시합니다.
검증기는 렌더러 완료 후에만 DOM 결과를 읽습니다. 주기적인 DOM 조회, 네트워크 유휴
추론, 고정 렌더링 대기를 사용하지 않습니다.

문서 개발 서버는 초기 빌드 전에 재귀 파일 시스템 구독을 등록합니다. 생성 경로인
`docs/.web/` 이벤트를 제외하고 빌드를 직렬로 실행하며 빌드 중 수신한 소스 이벤트를
추가 빌드 한 번으로 합칩니다. 빌드 실패를 보고하고 다음 소스 이벤트가 새 빌드를 요청할
수 있습니다. 파일 시스템 구독이 실패하면 서버를 종료 상태 1로 닫습니다.

후보 검증 절차는 커밋별 수명 주기 명령 하나를 실행합니다. 이 명령은 후보를 준비하고
빌드하며 시작 전에 준비 파일을 구독하고 HTTP·브라우저 검사를 순차 실행한 뒤 검증된
배포 근거만 유지합니다. 절차는 sleep 간격이나 준비 재시도 반복을 사용하지 않습니다.

폼 비교 소스 스위트 129개, 생성기 구성 성능 스위트 4개, 브라우저 작업 스위트 1개가
통과했습니다. 문서 스위트 15개도 통과했습니다. 개발 서버 검사는 HTTP 상태 200을
반환했고 소스 이벤트 한 번에 빌드 한 번을 실행했으며 `SIGINT` 후 종료 상태 0을
반환했습니다.

### 2026-09-11 — 네이티브 Cargo 명령 경로 수정

`test-native` 타깃은 Cargo를 시작할 때 확장한 `PATH`를 전달합니다. GNU Make
3.81은 시작 환경에 해당 디렉터리가 없어도 Makefile이 추가한 디렉터리에서 Cargo를
찾습니다. 회귀 검사는 모의 명령으로 타깃을 실행하고 Cargo는 추가한 디렉터리에만
배치합니다.

회귀 검사와 런타임 정책 검사 8개가 모두 통과했습니다. PHP 8.5.10에서 전체
`make test-native` 명령이 종료 상태 0을 반환했고 PHP 검사 160개, 모든 Go 패키지
검사, Rust 검사 20개, 프로토콜 검사 19개, 생성기 보고서 766/766과 Chromium
위젯·시간대 검사 3개가 통과했습니다.

### 2026-09-11 — 로컬 비교 배포 검증

저장소는 로컬 비교 Compose 파일을 생성하기 전에 후보 메타데이터, 생성·저장·브라우저
보고서, 정확한 로컬 이미지 태그와 이미지 digest를 검사합니다. 배포는 기존 데이터를
보존하며 내용이 다른 파일을 덮어쓰지 않습니다. HTTPS 검증은 명시적인 containerctl 인증
기관을 사용하고 소스 커밋, 라우트, 인증서, 데이터 마운트, 저장 파일, 응답 바이트를
검사합니다. 같은 설정을 두 번째로 적용했을 때 모든 검사 값이 변경되지 않아야 합니다.

배포가 성공하면 후보 컨테이너, 후보 디렉터리, 원본 보고서, 스크린샷, 이전 배포 결과와
배포 서비스가 사용하지 않는 로컬 비교 이미지를 제거합니다. 배포 정리 검사 11개와 폼
비교 소스 검사 96개가 모두 통과했습니다.

검사는 실패하거나 오래된 근거, 정확한 보고서 개수, 결정적 Compose 출력, 데이터 보존,
인증 기관 로드, 동일 설정 재적용 변경과 정리 경로 제한을 포함합니다. 이 변경의 배포는
아직 실행하지 않았습니다.

### 2026-09-10 — 네이티브 검사 의존성 선언

저장소 루트 빌드·검사 진입점은 직접 import하는 모든 외부 패키지를 루트
매니페스트에 선언합니다. 의존성 검사는 `make test-native`가 실행하는 Node.js
진입점을 확인하고 선언되지 않은 import를 거부합니다. 위젯 스크립트 검사는 전이
설치 대신 루트 의존성의 Vite 8.2.2를 해석합니다.

의존성 검사 6/6이 통과했습니다. PHP 8.5.10에서 전체 `make test-native`가 종료
상태 0을 반환했고 PHP 검사 160개, 모든 Go 패키지 검사, Rust 검사 20개, 프로토콜
검사 19개, 생성기 보고서 766/766과 Chromium 위젯·시간대 검사 3개가
통과했습니다.

### 2026-09-10 — 의존성 설치 스크립트 승인 적용

독립적으로 설치하는 각 npm 그래프는 모든 의존성 생명주기 스크립트의 승인을
정확한 버전으로 기록합니다. 워크스페이스 패키지는 루트 잠금 파일을 사용합니다.
CI와 컨테이너 빌드의 새 설치는 `--strict-allow-scripts`를 사용하며 승인이 없으면
설치 전에 실패합니다.

추적하는 모든 잠금 파일의 의존성 검사 5/5가 통과했습니다. 브라우저 예제
3개가 빌드됐고 parity 검사 7/7, 런타임 정책 검사 7/7, 패키지 빌드 검사 7/7과
전체 문서 검사가 통과했습니다.

### 2026-09-10 — 현재 후보 검증

교차 프레임워크와 레거시 클라이언트 잠금 파일은 각 매니페스트가 허용하는 현재
패키지 릴리스를 해석합니다. 깨끗한 `npm ci`와 `npm audit` 실행은 취약점 0개를
보고했습니다. 교차 프레임워크 비교는 14/14, 레거시 클라이언트 비교는 5/5로
통과했습니다.

후보는 index digest가
`sha256:7842bd0a40f1e51d4c975008a9b5bdaf6d148e9faba05e68faf3a935b02fe2c7`인
이미지 `localhost/crudui-form-comparison:<commit>`를 빌드했습니다. 이미지
구성에서 소스 검사 81개와 라이브러리 검사 4개가 통과했습니다. 실행 검증은 PHP
두 모드, HTTP 요청 411개의 생성·SSR 검사 290개, 저장·검증 검사 120개와 Ordered
JSON 검사 3개를 통과했습니다.

브라우저 검증은 서버별 312개와 전체 1,248개를 통과했습니다. PHP는
213,288밀리초, PHP 확장은 206,475밀리초, Go는 200,691밀리초, Rust는
200,500밀리초에 완료했습니다. 집계는 `complete: true`, `passed: true`,
`failedChecks: 0`, `performancePassed: true`를 기록합니다. 패키지와 비교 서비스는
배포하지 않았습니다.

### 2026-09-10 — 완전한 공개 TypeScript API 타입

패키지 진입점은 공개 TypeScript 선언이 참조하는 이름 있는 타입을 모두 export합니다.
폼·목록 검증은 공개 파일 집합 타입 하나를 사용합니다. TypeDoc 검증 경고가 있으면
API 생성과 문서 커버리지가 실패합니다. export되지 않은 타입 회귀 검사 2개, 공개
선언 검사 6개와 격리한 다섯 패키지 설치 검사가 통과했습니다.

### 2026-09-10 — 선택한 런타임 채널

`.node-version`, CI와 Node.js 컨테이너 단계는 정확한 패치 릴리스를 고정하지 않고
다음 LTS 릴리스 계열인 Node.js 26을 선택합니다. `.go-version`, CI와 Go 컨테이너
단계는 Go 1.27 안정 릴리스 계열을 선택합니다. Rust CI와 컨테이너 단계는 Rust 안정
채널을 선택합니다. CI는 현재 안정 npm 릴리스를 설치합니다. 런타임 정책 검사
6개가 모두 통과했습니다. 패키지 잠금 파일은 해석한 패키지 버전을 계속 기록합니다.

### 2026-09-10 — 네 서버 후보 검증

후보 이미지는 커밋한 소스 아카이브 하나를 압축 해제 전에 검증하고 PHP, PHP
확장, Go, Rust 서버를 시작하기 전에 비특권 사용자로 전체 소스 검사를
실행합니다. 이미지 구성에서 소스 검사 81개와 라이브러리 검사 4개가 통과했습니다.
실행 검증은 Chromium 프로세스 검사, HTTP 요청 411개의 생성·SSR 검사 290개,
저장 검사 120개와 PHP 처리기 모드·Ordered JSON 검사를 모두 통과했습니다.

브라우저 집계는 시나리오 960개, 상호작용 240개, 로드 전 마운트 24개, 정적
문서 24개를 통과했습니다. 모든 서버는 900,000밀리초 제한 이내에 완료되었습니다.
집계는 실패 0개와 `passed: true`를 기록했습니다. 패키지와 비교 서비스는
배포하지 않았습니다.

### 2026-09-09 — CI 패키지·문서 검사

문서 CI 작업은 `make docs-check`를 실행하기 전에 두 PHP 패키지의 의존성을
모두 설치합니다. 패키지·브라우저 작업은 JavaScript 패키지 다섯 개를 격리한
설치 프로젝트에 패키징하고 공개 export·선언·스타일, 반복 빌드 출력을 검사하며 폼
검사기 단위 검사와 Chromium CSS 검사를 실행합니다.

패키지 설치·공개 빌드·재현 빌드·폼 검사기 검사는 로컬에서 통과했습니다.
세 프레임워크 브라우저를 통한 native PHP 출력 검증은 별도의 비교 환경
검증으로 남아 있으며 이 CI 변경으로 확인하지 않았습니다. 원격 CI 실행이나
배포는 수행하지 않았습니다.

### 2026-09-09 — 현재·보존 비교 문서

기능 상태는 구현된 네이티브 패키지와 pending인 네 서버 통합을 구분합니다. 검증
절차는 라이브러리 경로와 커밋을 명시적으로 받고, 현재 PHP·PHP 확장·Go·Rust 대상과
보존 비교 모드를 구분하며, 네이티브 모듈 두 개·생성 검사·SSR 경로를 설명합니다.
서버가 컴파일한 직렬화 템플릿을 사용하는 브라우저 연결은 구현됐고, 집중 단위 검사
7개, Go 서버 패키지 전체, Rust 서버 검사 4개와 React·Vue·Svelte 프레임 production
build 12개가 로컬에서 통과했습니다. 후보 이미지의 네 서버 전체 HTTP·브라우저·저장
검증은 계속 pending이며 배포하지 않았습니다. 실행 중인 보존 이미지는 교체하지
않았습니다.

### 2026-09-09 — OrderedJSON 구현 하위 모듈

처리기 검사기는 고정한 OrderedJSON 공통 저장소와 구현 하위 모듈 다섯 개를
사용합니다. 현재 registry API, PHP 네임스페이스와 확장 이름을 사용하며,
소스 변경·잘못된 출력·불완전한 결과를 거부합니다. 보고서는 소스·고정 사례·
모듈 해시를 기록합니다.

공식 처리기 검사 575개와 CRUDUI 검사 50개가 모두 통과했습니다.
검사기 단위 테스트 5개가 통과했고 잘못된 소스 입력 2개를 거부했습니다.
이 결과는 JSON 처리 검증이며 브라우저나 저장 통합 검증은 아닙니다.

### 2026-09-09 — 네이티브 폼 생성기와 공통 PHP API

PHP·Go·Rust는 폼 컴파일, 데이터 바인딩, 편집 인스턴스, 폼·목록 HTML,
CLI 어댑터와 HTTP 예제를 제공합니다. CRUDUI PHP 확장은 PHP 패키지와
동일한 Generator·Form·Validator 클래스를 등록합니다. C 바인딩은 PHP 값을
정적으로 연결한 Rust 엔진 값으로 직접 변환합니다. 각 구현은 순서가 있는
값 변환, UTC 날짜 렌더링, CSS 선언 처리와 위젯 컨트롤 계약을 공유합니다.

공통 검사는 구현 다섯 개에서 각각 153개와 입력 해시 검사 1개를 통과하여
총 766개 통과, 실패 0개입니다. PHP API는 세 프로세스 구성에서 각각
352개, PHP·네이티브 검증은 각각 94개를 통과했습니다. 폼 패키지 검사,
패키지 설치 검사와 문서 검사가 통과했습니다. Linux 이미지는 일반 사용자를

현재 소스 스냅샷으로 새로 만든 일반 사용자 Linux arm64 이미지에서 전체
`make test-native` 명령이 통과했습니다. 확장을 다시 빌드하고 로드한 뒤
PHP·Go·Rust 패키지 검사, PHP API·검증 검사, 프로토콜 검사 19개, Chromium
위젯·시간대 검사 3개를 실행했고 생성기 보고서도 다시 766/766으로
완료했습니다. 이미지 index digest는
`sha256:0612f157880aa4bd9ff05a64dc6044969d0736117164cafec466e45d53c64c02`,
보고서 SHA-256은
`3f8a91ccbbdaf72c116f2749aa4b6f5cee0975567f6edcbe1372e602cdcf7442`,
실행 로그 SHA-256은
`378f4e3a63a88823b3a15b88859237332c27d36f43ee89bd62f9ad03cd38b0b1`입니다.
이 결과는 네이티브 패키지 검증이며 별도 네 서버 비교 통합 검증은 아닙니다.
패키지 게시와 비교 환경 배포는 실행하지 않았습니다.

### 2026-09-09 — 검증기 CLI 응답

비교 콘솔은 프로세스 종료 상태, JSON 응답 타입, 오류 필드 다섯 개,
유효 여부와 오류의 일관성을 검사합니다. 누락된 필드를 채우거나 잘못된
타입을 변환하지 않고 반환된 값을 유지합니다. 명세 로드 실패는 CLI에
문서화된 응답과 종료 상태가 일치해야 합니다. 프로세스 실패와 잘못된
응답은 비교 실패로 처리합니다.

최초 회귀 사례 8개는 수정 전에 실패했습니다. 응답 검사 35개와 네 언어
CLI 실행을 포함한 콘솔 검사 116개가 모두 통과했습니다.
`make docs-check`가 통과했습니다. 로컬 검사 결과이며 배포는 실행하지 않았습니다.

### 2026-09-09 — 런타임 패키지 계약

런타임 계약은 JavaScript, PHP, Go, Rust, PHP 확장의 폼 생성, SSR, 검증
요구사항을 정의합니다. PHP API 계약은 공통 `CRUDUI\Generator`,
`CRUDUI\Validator`, `CRUDUI\Form` 클래스, Composer 클래스 로딩보다
먼저 실행되는 확장 클래스 등록, 동일한 메서드를 명시합니다.
구현 제안은 패키지, 현재 소스의 지원 범위, 필수 검사를 정리합니다.
기능 상태는 이 요구사항과 구현된 패키지를 구분합니다.

비교 문서는 네이티브 JSON 파싱과 네이티브 CRUDUI 생성·검증을 구분합니다.
`make docs-check`가 통과했습니다.

### 2026-09-09 — 구형 스펙 변환 식별자

내부 변환 변수는 변환된 필드나 스키마 값을 설명합니다.
명명 계약은 파일명·공개 API·내부 식별자에 적용합니다.
validator 패키지 빌드, validator 검사 1,606개와 `make docs-check`가 모두
통과했습니다.

### 2026-09-09 — CLI 의존성 빌드

CLI CI는 테스트 전에 validator 패키지를 빌드합니다. 로컬 실행 절차도 같은
선행 작업을 포함하며 문서 검사는 CLI README와 한국어 번역을 포함합니다.

validator 출력을 제거해 패키지 누락 실패를 재현했습니다. 다시 빌드한 뒤
CLI 검사 37개, 문서의 명령 네 가지와 실패 종료 코드 검사 두 가지가
통과했습니다. `make docs-check`를 통과했습니다.

### 2026-09-09 — 의존성 업데이트 절차

예약된 의존성 업데이트 풀 리퀘스트를 사용하지 않습니다. 의존성 업데이트는
로컬에서 준비하고 관련 패키지 검사와 문서 검사를 포함합니다.
`make docs-check`를 통과했습니다.

### 2026-09-09 — 비교 환경 검증

HTTP 대상 네 가지는 각각 현재 브라우저 시나리오 120개와 현재
상호작용 검사 30개를 통과했으며 페이지 오류는 없었습니다. 이미지는
잠금 버전의 PHP 의존성을 설치하며 HTTP 검사 240개와 PHP 처리 모드 검사가
통과했습니다. 외부 Compose 환경은 `containerctl`로 로컬 HTTPS를 제공합니다.
반복한 `up`은 상태·응답 비교 8개를 통과했습니다. 영어·한국어 절차는 환경
수명 주기를 설명합니다.

### 2026-09-09 — 의존성 설치와 생성 파일

PHP CI 작업은 `composer.lock`으로 의존성을 설치합니다. PHP `vendor/` 디렉터리와
컴파일한 Go CLI 실행 파일은 Git에서 제외합니다. 패키지 CI 작업은 필요한 폼
패키지를 모두 빌드하며 구형 비교 작업은 회귀 검사도 실행합니다. CI 주석과
단계 이름은 실제 실행 명령을 설명합니다.

새 Composer 설치는 의존성 26개의 버전·소스 참조를 모두 재현했습니다. PHP 검사
1,418개, 네 언어 구형 비교 사례 1,074개, 공용 검증 콘솔 검사 81개가
통과했습니다. 문서 검사가 통과했습니다.

### 2026-09-09 — 공개 API 설명

공개 폼·목록 API 주석은 현재 동작과 오류 결과를 설명합니다. 런타임 계약은
폼 인스턴스 용어를 사용하며 구형 검증기 예제는 명시적인 legacy 진입점을 import합니다. 사용하지 않는 Vue
타입 import와 존재하지 않는 옵션 타입 참조를 제거했습니다. 수정한 파일 5개의
실행 JavaScript는 동일합니다. 패키지 export·엄격한 설치 타입·프로덕션 렌더링·
반복 빌드 검사가 통과했습니다.

### 2026-09-09 — 종료일 필드 참조

TypeScript·PHP·Rust는 Go와 같이 `enddate` 필드 참조 매개변수를 유지합니다.
점으로 구분한 시작일 경로를 날짜 비교가 생략되는 불리언 조건으로 변환하지 않습니다.
TypeScript·PHP는 상대 참조에 공통 경로 해석기를 사용합니다.
시작일보다 이전인 종료일 회귀 검사는 수정 전에 실패했습니다. 공통 사례 7개는
절대·형제·상위 참조와 참조 날짜보다 이전·같음·이후인 날짜를 검사합니다. TypeScript 검사 1,606개,
PHP 검사 1,418개와 Go·Rust 패키지 검사가 통과했습니다.

현재 규칙 계약은 `docs/spec/`에서 영어·한국어로 관리합니다. 현재·구형 규칙이
혼재한 문서를 대체하고 등록·매개변수 평가·검증 근거를 구분합니다.

### 2026-09-09 — 구형 비교 정확성

비교 실행기는 명시적인 JavaScript legacy 진입점을 로드하고 선택한 Go·Rust 구형
실행 파일을 다시 빌드합니다. 프로세스 실패·읽을 수 없는 스위트·사례 기대값과
다른 결과를 거부합니다. 소스 로드와 개발자 홈 경로 폴백을 제거했습니다.
실패 회귀 검사 2개는 수정 전에 실패했고 수정 후 통과했습니다. 네 구현 모두
구형 사례 1,074개를 통과했습니다. 기본 테스트 명령에 실행기 회귀 검사를
포함합니다. 영어·한국어 테스트 절차는 현재 적합성과 구형 비교를 구분합니다.

### 2026-09-09 — 테스트 사례 계약

영어·한국어 사례 계약은 현재 검증·조합·표현식·렌더링·구형 사례를 구분합니다.
전체 검증 결과와 로드 실패를 별도로 설명하고 형식 명세에서 오래된 검사 수를
제거했습니다. 현재·구형 TypeScript 적합성 검사 1,124개가 통과했습니다.
문서 검사와 엄격한 웹 빌드가 통과했습니다.

### 2026-09-09 — CLI 조합 실패와 문서

`check`는 조합 전 입력 검사로 대체하지 않고 해결되지 않은 조합을 오류로
반환합니다. 참조 누락 회귀 검사는 수정 전에 실패했고 수정 후 통과했으며
CLI 검사 37개가 모두 통과했습니다. 영어·한국어 CLI 안내는 등록된 명령 4개를
설명합니다. 패키지 설명에서 미구현 명령을 제거하고 미구현 MCP 제안을 제거했습니다.

### 2026-09-09 — 스키마 문서 통합

현재 스키마와 표현식 계약은 기존 문서를 사용합니다. 별도의 영어·한국어
구형 스키마는 명시적인 legacy 필드 모델을 설명합니다. 중복된 루트 스키마와
조건식 파서 문서를 제거하고 참조를 해당하는 현재 또는 구형 계약으로 변경했습니다.
구형 예제의 정상 입력과 사용자 지정 필수 메시지 검사가 통과했습니다.

### 2026-09-09 — 구형 표시 계약

영어·한국어 구형 표시 계약은 검증기 조건과 렌더러 표시를 구분합니다.
렌더러의 맵 형식 처리를 설명하고 표시와 검증이 독립적인 현재 스키마 설정으로
연결합니다. 중복 표시 안내를 제거했습니다. 선택한 TypeScript 구형
display-switch 검사 84개가 통과했습니다.

### 2026-09-09 — 문서 웹 탐색

웹은 영어 탐색 메뉴와 한국어 색인 링크를 제공합니다. 생성 API 탐색에
공통 생성기 core를 포함합니다. 문서 검사·엄격한 웹 빌드·생성된 탐색 링크의
대상 검사가 통과했습니다.

### 2026-09-09 — 데이터 검증 안내

검증 안내는 `validate` 규칙을 사용하는 현재 JavaScript·PHP·Go·Rust 진입점을
설명합니다. 스키마 로드·입력 실패·표시 여부·전송 처리를 구분합니다. 오래된 API
안내를 제거하고 탐색 링크를 영어 안내와 한국어 번역으로 변경했습니다.
네 코드 예제는 모두 실행에 성공했고 예상한 필수 입력 실패를 확인했습니다.

### 2026-09-09 — Svelte 생성 출력

Git은 Svelte의 임시 `.svelte-kit` 출력을 제외합니다. 생성 파일 117개를
추적 대상에서 제거했습니다. 이전 디렉터리가 없는 상태에서 빌드가 통과했고,
패키지 export·설치 타입 검사·프로덕션 빌드·React·Vue·Svelte 브라우저 검사도
통과했습니다.

### 2026-09-09 — 공개 API 문서 생성

필수 도구가 실패하거나 출력이 없으면 API 생성이 실패합니다.
TypeScript는 Svelte 컴포넌트 선언을 포함한 공개 패키지 진입점 5개를
검사합니다. Go는 모든 검증기 패키지를 문서화합니다. Rust와 PHP HTML 참조는
정적 웹에 포함됩니다. 문서 생성 절차에 필수 도구를 명시하고 중복 절차를 제거했습니다.

생성 실패 검사 8개, 문서 검사, Svelte 서버 검사 345개와 마운트 검사 3개가
통과했습니다. 전체 문서를 두 번 생성한 결과는 네이티브 HTML 자산을 포함해
동일했습니다. 엄격한 웹 빌드가 통과했습니다.

### 2026-09-09 — 문서 링크 검증

웹 빌드는 내부 링크를 검사합니다. TypeDoc은 상대 링크와 패키지 색인
페이지를 생성합니다. 웹 밖의 실제 저장소 파일은 GitHub 소스 URL로
연결하며 파일이 없으면 실패합니다. `make docs-check`는 링크 검사 5개를
실행합니다. 엄격한 웹 빌드, 문서 검사, 생성된 HTML 링크 검사가 통과했습니다.

### 2026-09-09 — 현재 문서 탐색

문서 웹은 현재 표현식 계약으로 연결합니다. 문서 관리 절차는
`make docs-check`가 검사하는 현재 예제 색인을 명시합니다.
문서 검사와 정적 웹 빌드가 통과했습니다.

### 2026-09-09 — 삼항식 매개변수의 공통 AST 평가

폼 표시와 TypeScript·PHP·Go·Rust 검증 매개변수는 완전한 삼항식 AST를 평가합니다.
선택한 필드 경로, 중첩된 참 분기, 따옴표 문자열의 이스케이프는 별도 문자열
파서로 처리하지 않습니다. 폼 회귀 검사 3개와 검증 회귀 검사 1개는 수정 전에
실패했고 수정 후 통과했습니다. 공통 검증 사례 6개는 경로 값과 중첩 제한값을
검사합니다. 기존 검증 결과와 기대 폼 HTML은 변경하지 않았습니다. 클래스 이름
사례는 문자열 분기에 따옴표를 사용합니다.

표현식 계약은 `docs/spec/`에서 영어와 한국어로 관리합니다. 현재 불리언 변환과
필수 입력 검증을 구분하고 연산자 우선순위·조건맵 기본값을 설명합니다. CLI 설명은
이 계약을 사용합니다. 네 검증기 전체 테스트, 전체 폼 테스트, CLI 검사 36개와
문서 검사가 통과했습니다. 이 결과가 보존한 외부 브라우저 비교를 갱신하지는 않습니다.

### 2026-09-09 — 현재 API와 고정 사례 설명

콘솔 문서는 현재 렌더링 API 이름을 사용합니다. 조합·렌더링 고정 사례 설명은
구현 버전 표기 없이 동작을 설명합니다. 관련 조합 테스트 23개가 모두
통과했으며 고정 사례의 입력과 기대 결과는 변경하지 않았습니다.

### 2026-09-09 — 저장소 내부 폼 검사와 JSON 순서 검사

패키지 테스트는 저장소 내부 폼 검사기와 JSON 순서
검사를 사용합니다. JSON 순서 사례 50개와 전체 폼 테스트가
통과했습니다.

### 2026-09-09 — 재사용 폼 검사기

폼 검사기와 Node·브라우저 검사는 `tests/form-inspector/`에서 관리합니다.
프레임워크 초기화 테스트는 해당 모듈을 직접 사용합니다.
경로 변경 후 Node 검사 18개와 브라우저 검사 6개가 모두 통과했습니다.

### 2026-09-09 — 예제 명세 포함과 중첩 데이터

Bootstrap 예제는 정적 빌드에 상품·반복 폼 명세를 포함합니다. 부모가 데이터를
관리하는 페이지는 점으로 구분된 경로를 최상위 키로 설정하지 않고 전체 폼
데이터를 적용합니다. 예제 빌드와 문의·가입·상품·반복 폼의 브라우저
검사가 통과했으며 상품 중첩 데이터와 잘못된 점 경로 키의 미생성을 확인했습니다.

### 2026-09-09 — 부모가 데이터를 관리하는 레거시 React 갱신

레거시 폼 변경 알림은 React 상태 갱신 함수 밖에서 실행합니다. 연속 필드
변경은 이전 값을 보존하고 변경마다 데이터를 관리하는 부모에게 한 번 알립니다.
회귀 검사는 수정 전에 실패했습니다. 수정 후 React 검사 692개와 패키지
빌드가 통과했습니다.

### 2026-09-09 — 레거시 예제 구조와 빌드

레거시 예제는 `examples/legacy`를 사용합니다. import, 패키지 참조, 빌드 컨텍스트,
테스트와 문서는 이동한 경로를 사용합니다. 컨테이너 빌드는 패키지 명령으로
전체 작업 공간을 설치하고 빌드합니다. PHP 연동 클래스는 개별 PSR-4 파일을
사용합니다. Node 예제 잠금 파일은 현재 패키지 선언을 반영합니다.

로컬 프론트엔드 빌드, Go 테스트, Rust 컴파일, PHP API 검사 5개와 Node HTTP
유효·무효 사례가 통과했습니다. Composer 엄격한 PSR-4 생성과 문서 검사도
통과했습니다. 프론트엔드 예제와 Node·PHP·Go·Rust의 Linux 이미지가 빌드됐습니다.
서버 이미지 네 가지 모두 HTTP 유효·무효 사례가 통과했습니다. PHP Apache
라우팅과 문서 루트도 통과했습니다. 프론트엔드 브라우저 검증은 남아 있습니다.

### 2026-09-09 — 반복 필드 스키마

선언 스키마는 `multiple.min`을 허용하며 숨김 필드 없이 컬렉션 키로 행을
식별하는 구조를 설명합니다. 최소 개수 허용과 숫자가 아닌 최솟값의 거부를
포함한 스키마 고정 사례 56개가 통과했습니다.

### 2026-09-09 — 현재 비교 이미지

비교 이미지는 정상 의존성 설치로 라이브러리 소스를 빌드합니다.
이미지는 브라우저 압축 해제 도구를 설치하며 작업 공간 잠금 파일로
네이티브 JavaScript 빌드 의존성을 해석합니다.
로컬 비교 환경은 PHP·PHP 확장·Go·Rust를 실행합니다.
HTTP 검사 240개와 PHP 처리 모드 검사가 모두 통과했습니다.
이 소스와 의존성 그래프의 브라우저 비교는 진행 중입니다.

### 2026-09-09 — 의존성 설치와 패키지 검사

작업 공간 잠금 파일은 선언된 의존성 범위를 해석하며 지원 플랫폼의 네이티브
패키지를 포함합니다. 루트는 공통 테스트 연동을 위해 Vitest를 선언합니다.
npm 설치 스크립트 승인은 검토한 패키지 버전을 명시합니다.
별도 설치 프로젝트는 같은 스크립트 승인을 사용하여 정상 설치합니다.

새 설치, 공개 패키지 검사 5개, 반복 빌드 비교 1개, 설치 타입 검사,
프로덕션 컴파일과 세 프레임워크 브라우저 검사가 통과했습니다.
폼 검사는 코어 26개, React 691개, Vue 344개, Svelte 345개와 마운트 검사 3개,
HTML 정규화 검사 6개가 통과했습니다. JavaScript 검증 1,579개가 통과했습니다.
이 결과는 비교 환경의 배포를 확인하는 근거가 아닙니다.

### 2026-09-09 — 필드 오류 설명

지원하지 않는 필드 오류는 필드 타입과 경로를 명시합니다. 현재 검사 이름은
버전 없는 동작 이름을 사용합니다. 코어 검사 26개와 문서 검사가
통과했습니다.

### 2026-09-09 — 독립된 PHP 확장 대상

PHP 확장 실행은 별도 프로세스·저장소·서버 식별자를 사용합니다. 확장 모드는
네이티브 처리기를 필수로 요구하며 PHP 모드는 확장 사용을 금지합니다.
서버·브라우저 검사는 PHP 확장을 네 번째 대상으로 포함합니다.

독립된 컨테이너에서 처리 모드 확인을 포함한 네 대상의 HTTP 검사 240개가
통과했습니다. 두 PHP 코덱 모드와 확장 누락·잘못된 확장 사용의 거부 검사도
통과했습니다. 확장의 전체 브라우저 검증은 남아 있습니다. 기본 비교
컨테이너는 아직 이 이미지로 교체하지 않았습니다.

### 2026-09-09 — 빈 컬렉션 브라우저 검사

브라우저 검사는 필드 래퍼로 포커스된 버튼의 컬렉션을 확인합니다. 현재
렌더러는 래퍼의 name 속성을 사용하지 않습니다. 서버 세 가지·프레임워크
세 가지·전송 형식 두 가지의 현재 빈 컬렉션 검사 18개가 모두 통과했습니다.
PHP 실행에서는 현재 초기화 비교 6개와 현재 런타임 포인터·키보드 동작 검사
30개(비교 모드 전체 108개)가 통과했고 페이지 오류는 없었습니다. 보존된 소스의 HTML 차이는 실패로 유지합니다.

### 2026-09-09 — SSR 비교 인스턴스 공유

교차 검사 콘솔은 세 렌더러에 사용할 폼 인스턴스를 하나 생성합니다.
반복 데이터가 없을 때 생성되는 행 키가 프레임워크 출력 간에 동일합니다.
생성된 키 비교를 포함한 콘솔 검사 81개가 통과했습니다.

### 2026-09-09 — 비교 서버 진입점

현재 PHP·Go·Rust 서버는 버전 없는 검증 진입점을 사용합니다. 보존된
Go·Rust 서버는 고정된 서버 소스 아카이브에서 빌드합니다. 비교 컨테이너는
라이브러리 소스를 사용합니다. HTTP 저장 검사 180개가 모두
통과했습니다. 브라우저 동작 검증은 진행 중입니다. 패키지는 게시하지 않았습니다.

### 2026-09-09 — 비교 브라우저 진입점

비교 브라우저 빌드는 현재 소스와 보존된 소스의 진입점을 명시적으로 선택합니다.
현재 컬렉션 검사는 필드 경로를 사용합니다. 빌드에는 작업 공간의 절대 경로를
명시해야 합니다. 브라우저 번들 12개가 모두 빌드되었습니다.
서버 통합과 저장·재로드 검증은 남아 있으며 실행 중인 비교 환경은 교체하지 않았습니다.

### 2026-09-09 — 공개 타입 선언 빌드

TypeScript 패키지 빌드는 번들러로 JavaScript를 생성하고 TypeScript 컴파일러로
타입 선언을 생성합니다. 공개 진입점에는 선언된 legacy export를 포함합니다.
선언 컴파일은 `noEmitOnError`를 적용하며 폐기 예정 옵션의 경고를 억제하지
않습니다. 감시 명령은 JavaScript 빌드가 성공하면 선언을 다시 생성합니다.

검증: 새 설치와 전체 빌드가 통과했습니다. 엄격한 ESM·CommonJS 타입 해석,
스타일시트 생성, 잘못된 공개 선언의 생성 차단을 포함한 공개 패키지 검사
5개가 통과했습니다. 전체 빌드 두 번의 파일 경로와 SHA-256이 일치했습니다.
별도 패키지 설치 프로젝트의 타입 검사·프로덕션 빌드·세 프레임워크 브라우저 검사도
통과했습니다. 이번 빌드 변경에서 런타임 소스 파일은 변경하지 않았습니다.
패키지는 게시하지 않았습니다.

### 2026-09-08 — 폼 인스턴스와 입력 요소

폼 API는 `compileForm`으로 템플릿을 준비하고 `createForm`으로 편집 인스턴스를
생성합니다. `Form` 컴포넌트로 표시하며 `renderForm`도 인스턴스를 받습니다.
목록 렌더러는 같은 `layout` 옵션을 사용합니다. 기본 입력은 폼별로 구분되는
고정 라벨 식별자를 사용하고 복수 선택 입력은 배열을 전송합니다.
필드 컨테이너는 전송 이름 대신 `data-field-path`를 사용합니다.
Svelte 패키지에는 생성한 컴포넌트 타입 선언을 포함합니다. 패키지 의존성은
`0.0.1` 버전을 사용합니다. 필수 엔진의 실패·누락·중복 결과는 검증 비교 실패로
처리합니다.

검증: 폼 검사 1,409개, JavaScript 검증기 검사 1,579개, PHP 검사 1,392개,
Go·Rust 검사, 콘솔 검사 42개, 검사기 검사 18개, Svelte 타입 검사,
패키지 설치 컴파일·빌드, 문서 검사가 통과했습니다.
실행 중인 비교 컨테이너에는 이 소스를 반영하지 않았습니다.

### 2026-09-08 — 레코드 복원 HTML

공통 DOM 바인딩은 기존 `checked` 속성을 입력의 다른 속성 다음에 배치합니다.
최초 렌더링과 레코드 복원은 입력 요소를 교체하지 않고 같은 속성 순서를 사용합니다.
공유 회귀 검사는 복원한 HTML 전체를 비교하고 체크박스 요소가 유지되는지 확인합니다.

검증: 강화한 회귀 검사는 수정 전 React와 Vue에서 실패했습니다.
수정 후 생성기 빌드, 생성기 테스트 1,405개와 검사기 테스트 18개가 모두 통과했습니다.
소스는 서버·프레임워크·전송 방식 18개 조합에서 현재 런타임 시나리오
360개를 모두 통과했습니다. 초기화·반복 주입·복원의 항목별 비교 3,024개가 모두
통과했으며 HTML 원문 비교 378개를 포함합니다. 이전 복원 차이 24개를 해결했습니다.

실제 상호작용 324개, 로드 전 마운트 36개, 정적 문서 36개, HTTP 검사 180개,
타이핑 36개와 Chrome CSS 검출 검사 6개가 모두 통과했습니다. Rust를 사용하는
한국어 React와 영어 Vue 검사로 검사 버튼, 실행별 168개 항목 전체와 JSON·HTML
원문 다운로드를 확인했습니다. 브라우저 페이지 오류는 없었습니다. 전체 비교는
시나리오 1,290개 통과와 150개 실패를 기록했으며 남은 실패는 모두 보존한 소스의
실패로 이전 결과와 일치합니다.

중간 실행에서는 진행 확인용 연결이 브라우저 화면 크기를 변경한 후 CSS 실패가
추가됐습니다. 확인용 자동화를 제거하고 화면 크기 변경을 별도로 재현했으며,
추가 연결 없이 1680 × 1100에서 전체 검사를 다시 실행했습니다. 두 실행과 이전
보고서를 모두 보존했습니다. 내보낸 HTML 스냅샷 2,160개는 기록된 문자열과
일치합니다. 배포: 로컬 컨테이너는 검증한 소스를 사용하며 예제 파일 52개, DOM
바인딩 소스와 제공하는 메타데이터가 검증한 소스와 일치합니다. 패키지는 게시하지
않았습니다.

### 2026-09-08 — 폼 초기화 검사기

파싱한 브라우저 DOM, HTML 원문, 현재·기본 컨트롤, 순서를 유지한 필드, 계산된
CSS, 포커스와 저장 레코드로 초기 데이터 생성과 마운트 후 주입을 비교합니다.
검사기는 항목별 실패를 유지하며 반복 주입, 레코드 교체와 같은 행 동작을 계속
검사합니다. 예제에 별도 검사 버튼과 HTML·비교 자료 다운로드를 추가했습니다.
정적 HTML 응답과 데이터 로드 전 마운트를 독립적으로 검사합니다. React는
평가된 인라인 스타일을 제거할 때 빈 style 속성도 제거합니다.

검증: 생성기 빌드, 생성기 테스트 1,405개, 검사기 테스트 18개, Chrome CSS 검출
검사 6개가 통과했습니다. 15:35 UTC에 세 API 서버가 보고서 72개와 시나리오
결과 1,440개를 완료했으며 1,278개 통과와 162개 실패를 기록했습니다.
현재 런타임의 초기 데이터 생성·마운트 후 주입 비교는 18개 조합의 15단계에서
모두 통과했습니다. 반복 주입은 HTML 원문까지 통과했습니다. 레코드 복원에서는
React·Vue의 HTML 원문 속성 순서 차이 24개를 유지했으며 현재 DOM, CSS,
컨트롤, 데이터, 포커스와 저장 비교는 모두 통과했습니다. 과거 렌더러의 차이도
기록합니다. 서버별 실행기는 종료 코드 1을 반환했습니다.

상호작용 324개, 로드 전 마운트 36개, 정적 HTML 36개, HTTP 180개,
타이핑 36개와 두 언어의 UI 선택 54개가 모두 통과했습니다. 브라우저 페이지
오류는 없었습니다. 단계별 스냅샷 2,160개를 내보내고 중단한 보고서 42개를
보존했습니다. 브라우저 프로토콜 호출은 API 서버 하나씩 실행합니다. 들여쓴 DOM
기록이 런타임 문자열 제한을 초과하므로 전체 보고서 JSON에서 들여쓰기를 제거했으며
스냅샷 내용은 유지합니다. 배포 대상은 `localhost:4317`의 로컬 Apple container이며
패키지 게시와 원격 배포는 실행하지 않았습니다.

### 2026-09-07 — 빈 컬렉션 수정 병합

빈 컬렉션 수정을 `main`에 병합하고 안정적인 행 키와 포커스 처리를 유지했습니다.
React, Vue, Svelte의 빈 컬렉션 추가 버튼에 접근성 레이블을 적용했습니다.
회귀 검사 6개는 명시적인 빈 값, 데이터 누락, 표시 여부, 중첩 행 순서를
검증하며 현재 루트 그룹 계약을 사용합니다.

고정한 수정 원본 커밋을 `main` 이력에 포함하므로 전체 복제에서 비교 예제를
준비할 때 별도 브랜치가 필요하지 않습니다.

검증: 생성기 빌드와 테스트 1,402개(코어 25개, React 689개, Vue 342개,
Svelte 345개, Svelte 클라이언트 1개)가 통과했습니다. 회귀 검사는
`compileForm`과 `bindForm`을 사용합니다. 배포: 패키지를 게시하지 않았으며
로컬 비교 예제는 기존 고정 소스를 계속 사용합니다.

### 2026-09-07 — PHP·Go·Rust 폼 영속 저장

PHP와 함께 네이티브 폼·JSON 제출, 기존 CRUDUI 검증, 원자적 JSON 저장, 계층 재로드를
수행하는 독립된 Go·Rust 서버를 추가했습니다. 서버와 소스 리비전마다 독립된
저장소를 사용합니다. Go·Rust 실행 파일은 표시한 검증기 리비전으로 빌드합니다.
Node는 브라우저 파일을 제공하고 요청 바이트를 전달합니다. 공용 초기 자료는
동일한 저장 레코드를 정의합니다.

화면에서 서버를 선택하며 언어를 변경해도 서버 선택을 유지합니다. 폼 필드 값은
문자열 계약을 따르고 다국어 제목은 명세의 `ko`, `en` 필드를 받습니다. 잘못된 구조,
초기화 요청, 제한을 초과한 요청, 필수 값 검증 실패는 레코드를 변경하지 않고 거부합니다.

13:47 UTC 브라우저 보고서는 보고서 72개와 시나리오 결과 1,368개를 포함합니다.
PHP·Go·Rust 모두 수정 원본과 현재 런타임이 React·Vue·Svelte의 폼·JSON 전송에서
각각 19/19를 통과했습니다. 상호작용 검사 324개와 로드 전 마운트 검사 36개도
모두 통과했고 브라우저 페이지 오류는 없었습니다. 수정 전 원본 키 진단은 17/19,
배열 진단은 15/19를 유지하며 전체 실행기는 유지한 진단 실패 108개로 종료 코드 1을
반환했습니다. 공유 HTTP 검사 180개, 타이핑 검사 36개, 두 언어의 UI 선택 54개,
JavaScript·PHP 변환 검사, PHP 저장소 검사, Go 정적 검사, Rust Clippy와
`make docs-check`가 통과했습니다. 이전 실패 보고서는 보존했습니다.

배포: PHP 8.4.24, Go 1.27.0, Rust 1.98.0, Node 26.8.1을 사용하는
`localhost:4317`의 로컬 Apple container. 패키지 게시와 원격 배포는 수행하지 않았습니다.

### 2026-09-07 — 원본 컨트롤러 타이핑

원본 예제 컨트롤러가 이전 렌더링 값으로 새 입력을 덮어쓰고, 프레임워크의 input
교체 시 일시적으로 포커스를 잃는 문제가 있었습니다. 새 입력으로 대체된 입력
렌더링을 취소하고 React·Vue·Svelte의 DOM 갱신 직후 값과 포커스를 복원하도록
수정했습니다. 고정된 두 프레임 지연을 제거했습니다.

13:41 UTC 검증: 네 비교 예제와 세 프레임워크에서 문자당 0/10/50 ms 간격의
실제 키보드 검사 36개가 모두 통과했습니다. 즉시 값, 렌더링 후 값, 포커스와 커서
검사가 통과했고 브라우저 페이지 오류는 없었습니다. 라이브러리 소스 스냅샷은
변경하지 않았습니다. 배포는 `localhost:4317`의 로컬 Apple container이며 패키지
게시와 원격 배포는 수행하지 않았습니다.

### 2026-09-07 — 폼 비교 명칭

경로, 소스, 문서, 컨테이너 명령에 CRUDUI 예제 명칭을 일관되게
적용했습니다. 비교용 라이브러리와 테스트 파일의 내용은
동일합니다. 이전 데이터, 보고서와 소스 아카이브는 작업 디렉터리 밖에 보존했습니다.

12:21 UTC 검증: 수정한 원본과 현재 런타임이 React·Vue·Svelte의 폼·JSON 전송에서
각각 19/19를 통과했습니다. 실제 상호작용 검사 108개, 로드 전 마운트 검사 12개,
JavaScript·PHP 변환 검사, 두 저장소 검사와 `make docs-check`가 통과했습니다.
브라우저 페이지 오류는 없었습니다. 수정 전 원본 키 진단은 17/19, 배열 진단은
15/19이며 전체 실행기는 해당 실패를 기록하고 종료 코드 1을 반환합니다.
배포: `localhost:4317`의 로컬 Apple container. 패키지 게시와 원격 배포는 수행하지
않았습니다.

### 2026-09-07 — 폼과 순서 유지 JSON 전송

각 폼에서 네이티브 multipart 또는 JSON 전송을 선택합니다. 두 형식은 같은 기존
JavaScript·PHP 검증과 저장소 저장을 실행합니다. JSON 경로는 요청·응답과 저장
파일에 ordered-json을 사용합니다. 별도의 전송 모듈이 처리기의 값을
폼 데이터로 변환하며 13자리 키, 문서 순서, 빈 컬렉션 자료형을 유지합니다.
컨테이너 빌드는 고정한 소스를 포함하고 아카이브 해시를 표시합니다.

두 전송 방식의 전체 처리 과정, 같은 데이터의 저장 비교, 잘못된 JSON 거부
검사를 추가했습니다. 실제 브라우저 요청에서 선택한 Content-Type과 JSON 형태를
확인합니다. 잘못된 브라우저 값은 두 방식 모두 전송을 중단하며 잘못된 직접 요청은
저장 레코드를 유지합니다. 필수·선택 항목과 표시 규칙은 계속 기존 검증기를 사용합니다.

11:35 UTC 검증: 수정한 원본과 현재 런타임이 React·Vue·Svelte의 두 전송 방식에서
각각 19/19를 통과했습니다. 실제 상호작용 검사 108개, 로드 전 마운트 검사 12개,
JavaScript·PHP 변환 검사, 두 저장소 검사가 모두 통과했습니다. JavaScript, PHP,
Go, Rust 검증 적합성과 `make docs-check`도 통과했습니다. 브라우저 페이지 오류는
없었습니다. 수정 전 원본 키 진단은 두 방식 모두 17/19, 배열 진단은 15/19이며
기존 실패를 그대로 기록하므로 전체 실행기는 종료 코드 1을 반환합니다.
배포: `localhost:4317`의 로컬 Apple container. 패키지 게시와 원격 배포는 수행하지
않았습니다. 비교 소스와 이전 보고서는 계속 제공합니다.

### 2026-09-07 — JSON 처리기 계약 검증

ordered-json의 문서 멤버 순서, 중첩된 13자리 행 데이터, 빈 컬렉션
자료형을 재현 가능한 검사로 추가했습니다. 다섯 구현에서 전송 고정 데이터 10개와
처리기의 공용 사례 115개가 모두 통과했습니다. 고정 데이터는 JSON 표현을 검사하며,
브라우저 동작과 런타임 JSON 연동은 변경하지 않았습니다. 로컬 비교 환경은 계속
제공합니다.

### 2026-09-07 — 빈 컬렉션 수정과 브라우저 검증

- 수정한 원본 소스와 현재 런타임을 주 비교로 추가했습니다.
  수정 전 원본 키 예제와 배열 진단은 실제 실패 결과와 함께 계속 선택할 수 있습니다.
- 사용자 제출 전에 기존 JavaScript 검증기를 연결했습니다. 잘못된 값은 전송을
  중단하고 필드 오류를 표시하며 재로드는 이전 오류를 제거합니다. PHP는 같은
  규칙을 독립적으로 검증합니다. 검증 규칙은 변경하지 않았습니다.
- 선택 항목인 빈 부서명 저장, 숨겨진 필수 필드 실패, 빈 컬렉션 표시, 중첩 및
  전체 삭제, 재추가, 네이티브/JSON 저장, 형제 행 ID와 부모 관계를 검증했습니다.
- 실제 타이핑, 잘못된/올바른 요청 수, 빈 컬렉션의 키보드 포커스 검사를 추가했습니다.
  포커스 간섭을 방지하기 위해 프레임 사례를 순차 실행합니다. 실행기는 새 결과를
  작성하기 전에 이전 보고서와 스크린샷을 보존합니다.

10:15 UTC 검증: 두 주 비교 구현은 React, Vue, Svelte에서 각각 17/17을 통과했습니다.
상호작용 54개, 데이터 로드 전 마운트 12개, 두 PHP 저장소 검사가 모두 통과했고
브라우저 페이지 오류는 없었습니다. 수정 전 원본 키 진단은 15/17, 배열 진단은
13/17을 유지하므로 전체 실행기는 종료 코드 1을 반환합니다. 기존 공용 검증 사례는
TypeScript, PHP, Go, Rust에서 통과했습니다. `make docs-check`도 통과했습니다.
배포: `localhost:4317`의 로컬 Apple container이며 패키지는 게시하지 않았습니다.
비교 소스와 이전 보고서는 검토를 위해 유지합니다.

### 2026-09-07 — 실제 타이핑 중 포커스

값이 변경되지 않은 input/change 이벤트는 포커스를 저장하기 전에 제외합니다.
Vue와 Svelte에서 input 교체 중 발생한 change 이벤트가 복원할 포커스 정보를
초기화하여 첫 글자 뒤에 입력을 계속할 수 없었습니다.

검증: 전체 Chrome 검사에서 React, Vue, Svelte의 전체 입력값과 입력 포커스를
유지했습니다. 공통 마운트 DOM 검사와 코어 타입 검사도 통과했습니다.
배포: 로컬 비교 환경이며 패키지는 게시하지 않았습니다.

### 2026-09-07 — 빈 컬렉션에 추가한 후 포커스

브라우저 바인딩은 빈 컬렉션의 추가 버튼을 해당 wrapper로 식별합니다. 첫 행 생성으로
버튼이 교체되면 같은 컬렉션의 추가 버튼으로 `preventScroll`을 사용해 포커스를 복원합니다.

검증: 공통 마운트 DOM 사례와 실제 Chrome의 빈 컬렉션 키보드 검사가 React,
Vue, Svelte에서 통과했고 코어 타입 검사도 통과했습니다.
배포: 로컬 비교 환경이며 패키지는 게시하지 않았습니다.

### 2026-09-07 — 행 연산의 포커스 유지

포인터로 행 버튼을 실행할 때 입력 포커스를 유지합니다. DOM 동기화는 `preventScroll`로
텍스트 선택과 상위 요소의 스크롤 위치를 복원합니다. 키보드 실행은 기존 버튼의 포커스를
유지합니다. 생성기 빌드와 React, Vue, Svelte의 마운트 DOM 검사가 통과했습니다.
세 프레임워크의 실제 브라우저 포인터와 키보드 검사가 통과했습니다.
배포: 로컬 폼 비교 예제에서 실행 중이며 패키지는 게시하지 않았습니다.

### 2026-09-07 — 브라우저 비교와 PHP 영속 저장

- 정확한 원본과 현재 Git 소스를 사용하는 React, Vue, Svelte, PHP의
  Apple container 환경을 `localhost:4317`에 추가했습니다.
- 동일한 13자리 키 데이터의 기본 비교를 추가했습니다. 원본 공개 함수에는 예제 행
  컨트롤러와 캐시 바인딩을 연결하며 현재 런타임은 라이브러리 세션을 사용합니다.
  원본 라이브러리 소스는 수정하지 않았습니다.
- 원본 공개 함수 `composeProperties`의 캐시 준비, 직렬화한 구조 복원, `buildField`
  바인딩을 추가했습니다. 두 키 어댑터는 합성 참조를 한 번 읽으며 준비 후 추가
  로드를 거부합니다.
- 네이티브 PHP 파싱, 버전별 검증, 원자적 JSON 영속 저장, 부모 관계, 경로별 저장 키
  적용, 삭제, 독립적인 재로드를 추가했습니다. 잘못되거나 잘린 요청은 저장 레코드를
  변경하지 않습니다.
- ID 순서 `[5, 7, 1]`, ID 8로 삽입, ID 9로 하위 구조 복사를 추가했습니다.
  키 JSON은 별도 순서나 식별자 필드 없이 문서 멤버 순서를 사용합니다.
  문서 순서를 편집하면 저장 순서와 화면 순서가 변경됩니다.
- 전체 하위 행이 있는 연산 픽스처와 명시적인 빈 컬렉션 검사를 분리했습니다.
  비교 예제는 생성된 행을 제거하지 않고 빈 컬렉션 출력 실패를 유지합니다.
- 최초 PHP 데이터 요청 전에 각 폼을 마운트합니다. 브라우저 요청 검사는 요청을
  계속하기 전에 중첩 input이 있는지 확인합니다.
- 이전 숨김 필드 배열 진단을 선택 가능한 예제로 유지합니다. 해당 숨김 필드와
  캐시 바인딩 미구현은 예제 구성의 선택입니다.
- 포인터, 키보드, 체크박스 검사, 수동 제어, 데이터 확인, 결과 다운로드, 오류 원문,
  내용이 일치하는 영어·한국어 문서를 추가했습니다. 실패 설명은 예제 구성과 원본
  렌더러 동작을 구분합니다.
- 브라우저 실행기는 검사 실패, 결과 누락, 브라우저 오류가 있으면 종료 코드 1을
  반환합니다. 기록된 진단 실패는 실패로 유지합니다.

검증: 각 프레임워크에서 현재 런타임은 17/17개, 원본 키 바인딩은 15/17개,
유지한 배열 진단은 13/17개 시나리오를 통과했습니다. 원본 키 실패 두 항목은 모두
명시적인 빈 컬렉션 출력에 관한 것입니다. 두 키 예제의 캐시 바인딩은 통과했습니다.
상호작용 검사 27개, 로드 전 마운트 검사 아홉 개, 두 버전의 PHP 저장소 검사가
모두 통과했습니다. 브라우저 페이지 오류는 없었으며 비교 실행기는 기록된 실패로
종료 코드 1을 반환했습니다.
[기능 상태](docs/features.ko.md)에 현재 코드의 결과를 기록합니다.
배포: 로컬 Apple container이며 패키지 게시와 원격 배포는 수행하지 않았습니다.
비교 자료와 이전 결과는 검토할 수 있도록 유지합니다.

### 2026-09-07 — 컴파일된 폼과 13자리 행 키

- 변경 불가능한 JSON 캐시용 폼 템플릿과 별도 데이터 바인딩을 추가했습니다.
- 지연 데이터 주입과 경로별 중첩 행 추가, 복사, 제거, 정렬, 저장된 seq 키 변경을
  지원하는 편집 세션을 추가했습니다. 신규 행 키는 13자리 16진수이며 저장된 seq 키는
  13자리로 채운 10진수입니다.
- React, Vue, Svelte의 기본 입력과 행 버튼을 연결했습니다. 체크박스 데이터 표시,
  명시적 빈 값의 기본값 처리, 날짜 형식 동기화, React FormBuilder의 데이터 속성 교체를
  수정했습니다.
- 4개 언어에서 키가 있는 스칼라와 그룹 컬렉션 검증을 확장하고 오류 경로, 중복,
  최소 개수에 대한 공유 사례 5개를 추가했습니다.
- 합성과 바인딩을 함께 처리하던 `buildForm`과 불필요한 렌더링 별칭을 제거했습니다.
  SSR 소스 함수는 컴파일된 템플릿을 입력받습니다.
- 폼 계약과 사용 문서를 영어와 한국어로 갱신했습니다. 링크, 번역, 상태 검사를 추가하고
  기존 API 문서 검사에 generator-core를 포함했습니다. 현재 계약을 `docs/spec/`로
  정리한 후 오래된 폼 키와 스키마 문서를 제거했습니다.
- 개발자 체크아웃 경로를 저장소 상대 경로나 필수 외부 입력 경로로 변경했습니다.
  픽스처 재생성이 기존 사례를 갱신하도록 수정했습니다.

검증: 코어 19개, React 689개, Vue 342개, Svelte SSR/단위 345개와 마운트한 DOM 1개,
TypeScript 검증기 1,579개, PHP 적합성 61개, Go와 Rust 공유 검증이 통과했습니다.
이 실행에는 CRUDUI 공유 검증 사례 43개가 포함됩니다. 콘솔 SSR 32개, CLI 35개, 린트, 타입 검사, `make docs-check`가 통과했습니다.
API 생성, 스키마 생성, 문서 웹 빌드가 통과했습니다. 배포: 미배포.

### 2026-09-07 — 스키마 생성

스키마 생성기에 포함된 TypeScript 컴파일러가 거부하는 불필요한
`ignoreDeprecations: "6.0"` 설정을 제거했습니다. TypeScript 타입 검사, 예제 3개를
검사하는 스키마 생성, 문서 웹 빌드가 통과했습니다. 배포: 미배포.
