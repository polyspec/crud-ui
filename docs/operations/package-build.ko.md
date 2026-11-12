# 패키지 빌드
<!-- doc-id: docs-operations-package-build -->
<!-- source-sha256: cbb3fd16e5a6382fdcee08571b0de6395acdbb902cc287382d8f57c0c9a8bca2 -->

[English](package-build.md).

패키지 빌드는 같은 소스에서 JavaScript·공개 TypeScript 선언·선언된 스타일시트를
생성한다. JavaScript는 각 패키지가 선언한 CommonJS·ES 모듈 형식을 유지한다.
TypeScript는 패키지의 엄격한 컴파일러 설정과 `noEmitOnError`를 사용해 공개 진입점과
해당 import에서 선언 파일을 생성한다. 테스트는 배포 선언과 별도로 검사한다.

테스트 설정 파일은 로더가 사용할 모듈 형식을 명시한다. ES 모듈 문법을 사용하는
Vitest 설정은 `.mts`·`.mjs` 확장자 또는 가장 가까운 `package.json`의
`"type": "module"`을 사용한다. CommonJS `.js` 파일을 게시하는 패키지는 CommonJS
패키지 형식을 유지하고 ES 모듈 Vitest 설정에 `.mts`를 사용한다. ES 모듈 Vite
설정은 `import.meta.dirname`에서 경로를 해석하며 CommonJS 전용 `__dirname` 바인딩을
사용하지 않는다.
설정 검사는 추출한 저장소 트리에서 소스 파일을 찾으며 Git 메타데이터를 요구하지
않는다. 생성 디렉터리와 의존성 디렉터리는 탐색하지 않는다.

선언 컴파일러는 JavaScript 번들러가 추가한 폐기 예정 모듈 해석 설정을 받지 않는다.
빌드 명령은 타입 오류를 억제하거나 대체 선언을 만들지 않는다. 전체 빌드는 이전
출력을 제거한 뒤 다음 패키지 산출물을 생성한다. 감시 명령은 JavaScript 빌드 성공
후 선언 파일을 다시 생성한다.

공개 TypeScript 선언이 참조하는 이름 있는 타입은 모두 패키지 진입점에서 export하고
생성 API 참조에 포함한다. API 참조는 각 패키지의 공개 `"."` 진입점을 다룬다.
generator-core와 validator의 `./internal` 진입점은 두 모듈 형식 모두에서 공유 chunk로 함께 빌드하여 두 진입점이
각 모듈의 사본 하나를 사용하며, 공개 API로 문서화하지 않는다. API Extractor는 copy된 `config/api-extractor.kit.json`으로
각 package를 검사한다(`make lint-ts`). 문서 없는 export(`ae-undocumented`)와 export되지 않은 type을 참조하는 공개 선언
(`ae-forgotten-export`)은 error이고, 공개 API는 commit된 report `etc/<package>.api.md`와 같아야 하므로 API 생성과 문서 검사는
그것들에서 실패한다. 문서 파이프라인은 export되지 않은 공개 타입 참조를 제외하지 않는다.

생성된 출력은 Git에서 추적하지 않습니다. Svelte의 `.svelte-kit` 디렉터리는
임시 패키징 출력이며 `src`는 빌드 입력, `dist`는 배포 출력입니다.
이전 `.svelte-kit` 디렉터리가 없는 상태에서도 빌드가 성공해야 합니다.
컴파일한 Go CLI 실행 파일은 소스에서 생성하며 Git에서 제외합니다.
CLI는 사용 전에 빌드합니다.

저장소 Make 타깃은 도구 디렉터리를 `PATH` 앞에 추가할 수 있습니다. 추가한
디렉터리에 의존하는 각 recipe 명령은 도구를 실행할 때 확장된 `PATH`를 명시적으로
전달합니다. Make 프로세스가 해당 디렉터리 없이 시작해도 그 디렉터리에서 도구를
찾아 실행해야 합니다.
Rust recipe는 Cargo 프록시 디렉터리를 `PATH`에 추가하지 않습니다. 공통 Rust 명령
진입점을 사용하여 toolchain 기록이 선택한 일반 파일 Cargo, rustc, rustdoc을
실행합니다.

저장소의 Node.js 빌드·테스트 진입점은 하나의 공통 규칙으로 Rust 도구를
해석합니다. 실행 시 Cargo, rustc, rustdoc의 절대경로를 모두 선언할 수 있습니다. 경로를
선언하지 않으면 `PATH`가 가리키는 cargo, rustc, rustdoc을 씁니다. mise의 shim이
`rust-toolchain.toml`이 고정한 toolchain을 `PATH`에 둡니다. 진입점은 각 이름을 셸이
찾는 절대경로로 해석하고, 그 경로에서 `cargo --version`, `rustc --version`,
`rustdoc --version`을 실행하여 각 도구가 자신을 보고하는지 확인합니다. Cargo 명령의
작업 디렉터리는 심볼릭 링크가 아닌 절대·정규 디렉터리여야 합니다. 없거나 맞지 않거나
확인할 수 없는 도구는 빌드 시작 전에 실패합니다. 각 진입점은 해석된 Cargo 경로를
실행하고 `RUSTC`와 `RUSTDOC`에 해석된 컴파일러 경로를 설정하며, 다른 출처의 Rust 명령으로
대체하지 않습니다.

스펙 CLI는 `tsx`로 TypeScript 소스를 실행합니다. CLI가 import한 생성기는
공개 패키지 진입점으로 validator를 로드하므로 로컬 명령과 CI 테스트는 CLI를
실행하기 전에 validator를 빌드합니다. 의존성 설치만으로는 해당 패키지 출력이
생성되지 않습니다.

## 패키지 이름

패키지는 template, hyper와 같은 polyspec 저장소의 이름 규칙을 따릅니다.

| 언어 | 이름 |
|---|---|
| npm | `@polyspec/crudui-<name>`: `@polyspec/crudui-cli`, `@polyspec/crudui-form-binding`, `@polyspec/crudui-generator-core`, `@polyspec/crudui-generator-html`, `@polyspec/crudui-generator-react`, `@polyspec/crudui-generator-svelte`, `@polyspec/crudui-generator-vue`, `@polyspec/crudui-validator`. 비공개 workspace root는 `@polyspec/crudui-workspace`입니다 |
| Composer | `polyspec/crudui-generator`와 `polyspec/crudui-validator`이며 PHP namespace는 `Polyspec\Crudui\`입니다. 클래스는 `Polyspec\Crudui\Generator`, `Polyspec\Crudui\Validator`, `Polyspec\Crudui\Form`, `Polyspec\Crudui\FormError`이고, 내부 namespace는 `Polyspec\Crudui\Generator\`와 `Polyspec\Crudui\Validator\`입니다. PHP 확장도 같은 클래스를 등록합니다 |
| Rust | crate `polyspec-crud-ui-generator`와 `polyspec-crud-ui-validator`, library `polyspec_crud_ui_generator`와 `polyspec_crud_ui_validator` |
| Go | module `github.com/polyspec/crudui/packages/generator/go`와 `github.com/polyspec/crudui/packages/validator/go` |

`examples/`, `tests/`, `tools/`의 프로그램도 같은 규칙을 따릅니다. 비공개 npm package는
`@polyspec/crudui-cross-check-console`이고, crate는 `polyspec-crudui-cross-check-validator`,
`polyspec-crudui-form-comparison`, `polyspec-crudui-native-generator`, `polyspec-crudui-bench`이며 binary도 같은
이름입니다. 각 `go.mod`의 module은 `github.com/polyspec/crudui/<directory>`입니다.

`tests/build/package-names.test.mts`는 이 이름을 요구하고, 유지되는 파일이 이전 형태의 이름으로 패키지를 가리키면
실패합니다. 변경 기록, 체크리스트, wave 설명은 각 항목이 기록한 이름을 유지합니다.

## 인수 기준

- `npm ci --strict-allow-scripts`는 고정된 의존성을 설치하고 `npm run build`는
  선언된 validator·generator
  빌드를 의존성 순서로 실행한다.
- validator·generator-core·generator-html·generator-react는 패키지 소스 경로 import 없이 공개
  CommonJS·ES 모듈 export로 로드된다.
- `@polyspec/crudui-form-binding`은 ES 모듈 export로만 로드된다. 선언은 ES 모듈 형식이며, Node.js와
  TypeScript 모두 CommonJS 프로젝트에 이 패키지를 해석하지 않는다.
- `@polyspec/crudui-generator-vue`는 `"type": "module"`을 선언하고 ES 모듈·CommonJS export로 로드된다.
  선언은 ES 모듈 형식이고 상대 import는 `.js` 파일을 가리키므로, 엄격한 `NodeNext` ES 모듈·CommonJS
  프로젝트가 이 선언으로 컴파일된다.
- `@polyspec/crudui-generator-svelte`는 `svelte` export로 로드된다. 선언은 ES 모듈 형식이고 상대 import는
  `.js` 파일이나 `.svelte` 파일을 가리킨다. Svelte 도구처럼 `.svelte` 파일 import를 그 옆의
  `.svelte.d.ts` 선언으로 해석하면, 엄격한 `NodeNext` ES 모듈 프로젝트가 이 선언으로 컴파일된다.
- 엄격한 설치 검사는 공개 타입과 모든 하위 선언 import를 해석한다.
- 설치 검증은 `contracts/features.json`이 기록한 모든 패키지를 설치하고, 반복 빌드는 그 모든
  패키지의 출력을 비교한다. 패키지 목록이 이 기록과 다른 검사는 실패한다.
- 설치 검증은 각 워크스페이스를 해당 패키지 디렉터리에서 패키징한다. 기록된
  npm 릴리스의 `pack --json` 결과는 패키지 record를 정확히 하나 포함한다. record는 같은
  패키지 이름과 아카이브 파일 이름 하나를 보고한다.
- React가 export한 스타일시트가 존재하고 선언한 소스 스타일시트와 일치한다.
- 같은 입력의 반복 빌드는 공개 API를 유지하고 동일한 산출물을 생성한다.

이 검사는 패키지 생성과 설치를 확인한다. 폼 입력 동작·검증 일치·SSR·브라우저
상호작용은 해당 테스트를 계속 적용한다.

의존성 해석은 패키지 선언의 버전 조건을 사용합니다. 잠금 파일은 지원하는
플랫폼의 선택적 네이티브 패키지를 포함한 의존성 그래프를 기록합니다.
새 설치는 `npm ci --strict-allow-scripts`를 사용하며 검증 결과를 기록하기 전에
해석된 의존성으로
패키지와 설치 검사를 실행합니다.
설치는 의존성 생명주기 스크립트를 실행합니다. 독립적으로 설치하는 각 의존성
그래프는 해당 그래프의 루트 패키지 매니페스트 `allowScripts` 필드에 필요한
스크립트 승인을 정확한 패키지 버전으로 기록합니다. 패키지 이름만 사용하거나
버전 범위를 사용한 승인은 허용하지 않습니다. 새 설치는 npm의 엄격한 승인 검사를
사용하며, 생명주기 스크립트에 정확한 승인이 없으면 설치 전에 실패합니다.
워크스페이스 패키지는 루트 잠금 파일을 사용하며 패키지별 잠금 파일을 관리하지
않습니다.
루트 개발 의존성은 공통 테스트 실행기를 포함하며, 루트에 설치된 테스트
연동 패키지는 일반적인 모듈 해석으로 해당 실행기를 로드합니다.
빌드 또는 테스트 대상이 실행하는 저장소 루트 Node.js 진입점은 직접 import하는
각 외부 패키지를 루트 매니페스트에 선언합니다. 워크스페이스 패키지는 루트
워크스페이스 선언으로 제공합니다. 전이 의존성 또는 다른 워크스페이스에만 선언한
의존성은 루트 진입점의 선언으로 인정하지 않습니다.
저장소 루트 검사 명령은 `examples/` 아래의 모듈을 로드할 수 있습니다. 루트
매니페스트는 해당 모듈이 직접 import하는 모든 외부 패키지를 선언하며, 한 번의
깨끗한 루트 설치가 해당 의존성을 제공합니다. 검사는 무시된 하위 `node_modules`
디렉터리에 의존하지 않습니다. 교차 검사 렌더러는 Vite와 Svelte Vite 플러그인을
패키지 지정자로 해석하며 `node_modules` 내부 경로를 생성하지 않습니다.

의존성 업데이트는 로컬에서 준비하고 검증합니다. 저장소는 의존성 업데이트
풀 리퀘스트를 예약하지 않습니다. 변경된 매니페스트와 잠금 파일은 관련 패키지
검사와 문서 검사를 함께 실행해 검증합니다.
저장소 내부 패키지를 사용하는 Composer 경로 저장소는 Composer 기본 link를 유지합니다. `vendor/`는 각 로컬
패키지를 소스 디렉터리에 link하고 그 패키지 자신의 `composer.json`이 autoload를 선언하므로 복사본이 소스보다
뒤처질 수 없습니다. 릴리스가 담는 내용은 개발용 `vendor/`의 복사본이 아니라 릴리스 아카이브 설치
(`make release-consumer`)가 증명합니다.
Composer는 각 로컬 package가 선언한 version을 읽고 개발 profile의 호환 요구를 해석합니다. 선택한 native lock과 설치
metadata는 실제 source version을 기록합니다.

## 런타임과 의존성 버전

저장소를 빌드하거나 설치하거나 검사하는 모든 도구는 checkout이 기록한 정확한 버전 하나로
local과 CI에서 실행되므로, 같은 tree는 모든 날짜와 machine에서 같은 결과를
냅니다. 새 릴리스는 그 기록을 바꿔 채택하고, 검사는 그 뒤 모든 곳에서 그 릴리스를 요구합니다.
릴리스는 기록을 바꿀 때 고릅니다. LTS 채널을 제공하는 런타임은 최신 활성 LTS 릴리스를,
Node.js는 활성 LTS 또는 다음 LTS로 지정된 최신 짝수 안정 메이저를, 다른 도구는 프로젝트가
지원하는 최신 안정 릴리스를 사용합니다. 명세가 명시적으로 요구하지 않는 프리릴리스 버전은
사용하지 않습니다. 어떤 실행도 채널의 최신 릴리스를 registry에 묻지 않고, 어떤 도구도 스스로
다른 버전을 설치하지 않습니다.

첫 `make` 전에 `packageManager`에 선언한 release의 native npm으로 root lock을 설치합니다:

```sh
npm_config_cache="$PWD/var/bootstrap/npm-cache" npm exec --yes --package="$(node -p 'require("./package.json").packageManager.split("+")[0]')" -- npm ci --ignore-scripts
```

이 명령은 `@polyspec/kit`을 설치하며, Makefile의 recipe는 그 utility를 packed release의 `node_modules/@polyspec/kit/dist`에서,
또는 `.links`가 연결하는 kit checkout의 source에서 실행합니다. Makefile은 자신이 실행하는 recipe를 모두 담으며, kit은 recipe를 include하지 않고 이 저장소의 파일을 쓰지 않습니다. CI는
setup-node 뒤 첫 make 명령 전에 이 bootstrap을 실행합니다. Bootstrap npm cache는 checkout의 `var/bootstrap/npm-cache`에 둡니다.

- `mise.toml`의 `node`는 정확한 Node.js 릴리스를 기록합니다. `make install-tools TOOLS=npm`이 그것을 mise로
  `var/tools`에 설치하고 `var/tools/bin/node`가 실행하며, CI의 setup-node는 그 bootstrap을 시작하려고만 그것을 읽습니다(kit K171).
- 루트 `package.json`의 `packageManager`는 정확한 npm 릴리스를 기록합니다. 설치하고 패키징하고
  스크립트를 실행하는 npm이 그 결과를 바꾸기 때문이며, `pack --json` report가 npm 11의 배열에서
  npm 12의 object로 바뀐 것이 그 예입니다. `make install-tools`(`node_modules/@polyspec/kit/dist/install-tools.mjs`)는 정확히 그 릴리스를
  checkout의 무시되는 directory `var/tools/npm`에 설치하며, 다른 모든 checkout이 쓰는
  machine의 npm에는 설치하지 않습니다. Makefile은 `var/tools/bin`을 `PATH`의 맨 앞에 두고,
  Native bootstrap 뒤 CI는 저장소 도구를 make 대상으로 시작합니다.
- checkout의 kit인 `@polyspec/kit`은 toolchain마다 한 릴리스(Node.js 26.12.0, Python 3.14, PHP 8.4, Go 1.27.2, Rust 1.99.0,
  TypeScript 7.0.2)를 고정하고, 기록된 release는 선언과 manifest 하한이며 kit이 설치합니다(K854). 대상은
  `mise.toml`의 `node`, 모든 `package.json`의 `engines.node`(`>=26.12.0`), 모든 `composer.json`의 `require.php`(`>=8.4`), 모든
  `pyproject.toml`의 `requires-python`(`>=3.14`), 모든 `go.mod`의 `go` 줄(`1.27.2`, `toolchain` 줄 없음), 모든 Cargo package의
  `rust-version`, 모든 manifest와 lock의 `typescript`입니다. 벗어나는 값은 `config/toolchain.json`의 `exceptions` 항목으로 scope,
  이유, 재시도 조건과 함께 선언합니다. `packages/svelte`는 svelte-check와 `@sveltejs/package`가 TypeScript 6 API를
  요구하므로 TypeScript 6.0.3을 유지합니다.
- `mise.toml`은 kit pin인 정확한 Go 릴리스를 기록하고, `make install-tools`는 CI에서도 mise로 `mise.lock`의 digest에 맞춰
  그것을 설치하며, 모든 `go.mod`의 `go` 줄이 그 릴리스이고, Makefile과 CI가 설정하는
  `GOTOOLCHAIN=local`은 go가 다른 toolchain을 내려받지 못하게 합니다. 저장소의 Go module과 비교 예제의 OrderedJSON checkout의
  Go module은 루트 `go.work`로 서로를 찾으며, 어떤 `go.mod`도 `replace`를 적지 않습니다.
- `rust-toolchain.toml`은 정확한 Rust 릴리스를 profile `minimal`과 component `rustfmt`,
  `clippy`와 함께 기록합니다. Makefile과 CI는 `RUSTUP_AUTO_INSTALL=0`을 설정하므로, 설치된
  toolchain이 없는 cargo는 그것을 설치하는 대신 rustup의 메시지로 실패합니다. `make install`과 CI는
  `rustup toolchain install --no-self-update`로 그것을 설치합니다.
- `config/toolchain.json`은 `php`에 검사하는 PHP minor 릴리스를, `python`에 `var/python`에서 Python package와
  그 suite를 실행하는(`make crudui-install-python`) Python의 minor 릴리스(PHP처럼 비교)를, `composer`에 정확한 Composer 릴리스(`version`과 phar의
  SHA-256을 가진 object)를, `go`에 `go` 줄이 Go 릴리스인 `go.mod`를, uv와 Python build, alint, ruff, vulture, golangci-lint,
  deadcode의 정확한 릴리스와 digest를, `cargoAudit`에 정확한 cargo-audit 릴리스를
  기록합니다. 이 file은 kit의 도구가 읽는 field를 담습니다. setup-php는 다른 도구와 같은 patch를 설치할 수 없으므로 PHP는 minor 릴리스로 고정합니다. 검사는 실행 중인 PHP의 major와 minor를 비교하고, 실행이 쓴 patch는
  그 실행의 evidence이며 `node_modules/@polyspec/kit/dist/check-toolchain.mjs`가 출력하고 `var/full-run.json`이 다른 실행 중인 릴리스와
  함께 기록합니다.
- 기록된 release는 kit이 설치합니다(K854: 도구 검사는 삭제됨; 없는 도구는 그 도구를 쓰는 타깃을 실패시킵니다).

저장소는 컨테이너 정의를 두지 않습니다. Linux는 CI runner에서 실행됩니다. 패키지 잠금 파일은 해석한
패키지 버전을 기록하며 런타임 릴리스를 선택하지 않습니다.

GitHub 호스팅 CI는 `ubuntu-24.04`에서 실행되고, 모든 action을 한 릴리스의 commit SHA로 지정하며
그 릴리스를 주석에 적습니다. 네이티브 보고서 업로드는 action 런타임으로 Node.js 24를 사용하는
`actions/upload-artifact` 7을 사용합니다. 러너가 실행 중 런타임을 교체하더라도 지원 종료된
Node.js 런타임을 선언한 action은 허용하지 않습니다.

브라우저 검사는 잠긴 `puppeteer`가 고정한 build의 Chrome과 Firefox, 잠긴 `playwright`가 고정한
build의 WebKit을 실행합니다. `node scripts/install-browsers.mts <chrome|firefox|webkit>...`가
그것들을 설치하며, machine의 브라우저나 릴리스 채널의 브라우저는 사용하지 않습니다. Linux CI
브라우저 작업은 Puppeteer의 cache를 checkout의 `.tools/puppeteer`(`PUPPETEER_CACHE_DIR`)에 두고, 그
Chrome의 set-user-ID sandbox helper를 `CHROME_DEVEL_SANDBOX`가 지정하는
`/usr/local/sbin/chrome-devel-sandbox`에 설치합니다. 테스트 실행 전에 사전 검사는 브라우저와 모든
상위 경로 구성요소가 심볼릭 링크를 해석하지 않는 정규 파일시스템 항목인지 확인합니다. 사전 검사는
sandbox 비활성화 인자 없이 Chrome을 시작하고 `chrome://sandbox`가
`You are adequately sandboxed.`를 보고하도록 요구합니다. 이 상태에는 namespace 또는 SUID 1차
계층, PID·network namespace와 Seccomp-BPF가 필요합니다. 조건 하나라도 실패하면 작업이 실패합니다.
실패한 sandbox 조건은 평가 문구 또는 `chrome://sandbox` 행, 보고된 값과 필요한 값을 오류에
표시합니다. CI 브라우저 검사는 `--no-sandbox`와 `--disable-setuid-sandbox`를 사용하지 않습니다.

Git에서 추적하는 모든 npm 잠금 파일은 유지 관리 대상 의존성 그래프입니다. 루트
설치의 `npm ls --all`은 잘못되거나 누락되거나 충돌하는 의존성 없이 상태 0을
반환해야 합니다. 루트 잠금 파일은 한 version이 범위를 만족하는 package를 한 version으로
담습니다. `tests/build/dependency-health.test.mts`는 잠금 파일이 두 version으로 설치하는
package 가운데, 각 사본을 읽는 package들이 선언한 모든 범위를 그중 한 version이 만족하는
package에서 실패하며, 각 package는 자기 위치에서 위로 가장 가까운 `node_modules`의 사본을
읽습니다. 각 그래프의
`npm ci --dry-run --strict-allow-scripts`는 성공해야 합니다. npm은 package를
npm registry, workspace 또는 make 대상이 설치한 checkout 디렉터리에서 설치합니다. 루트
매니페스트는 `@polyspec/kit`과 `@polyspec/ordered-json`을 release asset의 URL로 고정하고,
잠금 파일의 모든 package는 SHA-512 무결성을 기록하며, `.npmrc`는 `allow-remote=root`와
`allow-git=none`을 선언하므로 npm은 루트 매니페스트가 적은 URL만 받고 의존성이 추가한 URL
또는 Git 소스는 거부합니다. 호환되는 안전한 안정
릴리스가 없는 도구는 교체합니다. 의존성 override와 audit 제외는 이 기준을
충족하지 않습니다. 사용하지 않는 빌드·문서 의존성은 제거합니다.

### 의존성 review

의존성은 검사가 registry에 묻는 결과가 아니라 review 때 알려진 상태로 판단하므로, 같은
tree는 언제나 같은 결과를 냅니다. review 대상은 registry 의존성입니다. 루트와 각 workspace
`package.json`의 `dependencies`와 `devDependencies`, 그리고 `config/dependency-policy.json`이
지정한 Composer manifest(`config/dependency-policy.json`의 `composerPlatforms`가 지정하는 개발 root `composer.json`이며, 그 lock이 `legacy/packages/validator/php`,
`legacy/packages/generator/php`를 해석합니다)와 `pythonManifests`가 지정하는 Python manifest(`legacy/packages/validator/python`,
`legacy/packages/generator/python`)의 `build-system.requires` pin의 `require`와 `require-dev`입니다. peer 의존성, URL 의존성, 이 저장소의 package와 Composer platform 요구
사항은 정의상 review 밖에 있습니다. GitHub tag에서 가져온 polyspec package는 그 tag의
release입니다. 검사는 루트 매니페스트가 그 package를 tag의 checkout에 연결하고, checkout이
tag의 버전을 가지며, 잠금 파일이 그 버전을 기록할 것을 요구합니다. `make dependency-review`(`node_modules/@polyspec/kit/dist/dependency-review.mjs`)는 각 registry 의존성에 대해
게시자가 deprecated로 표시하지 않은 최신 안정 release를, 그리고 `package-lock.json`(moderate,
high, critical)과 각 `composer.lock`(모든 보안 권고와 abandoned package)의 보안 권고를
registry에 묻고, checkout의 모든 Cargo lock의 보안 권고를 cargo-audit으로 RustSec advisory
database에서 읽습니다(모든 취약점과 unmaintained, unsound, yanked crate). `make install-tools`는
`config/toolchain.json`의 cargo-audit release를 `var/tools/cargo-audit`에 설치합니다. checkout의 Go module은
`replace`로 checkout의 module만 요구하므로 review는 Go 의존성과 `go.sum`을 기록하지 않습니다. `RECORD=1`은 review를 각 잠금 파일의 sha256과 함께
`config/dependency-review.json`에 쓰고, `UPDATE=1`은 먼저 더 새로운 의존성을 manifest의 범위
연산자를 유지한 채 올리고, `npm install --workspace`가 루트가 설치한 release를 남긴 채 올린
release를 그 옆에 추가하므로 npm 갱신 뒤에 `npm dedupe`를 실행합니다. 예약된 workflow `.github/workflows/dependency-review.yml`이
매일 review를 실행하며, 어떤 검사나 gating CI job도 이를 실행하지 않습니다.

`make dependency-policy-check`(`node_modules/@polyspec/kit/dist/check-dependency-policy.mjs`)는 checkout의 file만 읽고 각
발견을 규칙과 고치는 방법과 함께 보고합니다. `make dependency-policy-mutation-check`는 의존성 file 사본의 알려진 mutation을 검사가
각각 거부할 것을 요구하고, `make crudui-test-dependencies`는 둘과 `npm run test:dependencies`를 실행합니다. 잠금 파일이 review 뒤에 바뀌었거나, registry
의존성에 review 항목이 없거나 review가 기록한 것과 다른 version으로 잠겼거나, registry
의존성이 예외 없이 review의 최신 안정 release보다 오래되었거나, 예외가 최신 release인 의존성을
지정하거나, 잠금 파일에 review 때 보안 권고가 있었거나, `package-lock.json`이 manifest를
기록하지 않거나, 이 저장소의 package를 그 자신의 version으로 요구하지 않거나, network 없는
`composer validate --strict`가 최신이 아닌 Composer lock을 찾거나, Composer manifest의 `config.platform.php` 또는 lock의
`platform-overrides`가 `composerPlatforms` 항목의 `php`(`8.4.1`, 잠긴 PHPUnit이 지원하는 가장 낮은 PHP release)와 다르면 실패합니다.
`config/dependency-policy.json`의 예외는 ecosystem, manifest, package를 지정하고 재현된 이유,
제거 조건, 검증 명령을 선언합니다.

### offline 검사

검사는 network를 읽지 않습니다. Makefile은 모든 recipe와 그것이 시작하는 명령에
`CARGO_NET_OFFLINE=true`, `GOPROXY=off`, `npm_config_offline=true`,
`COMPOSER_DISABLE_NETWORK=1`을 export하고, download 대상인 `install`, `crudui-install-crates`,
`install-tools`, `dependency-review`와, lock이 고정한 제3자
package를 내려받는 release archive의 사용자 project lock `release-consumer-lock`만 `$(ONLINE)`으로 이를 풉니다.
`release-consumer`는 script가 스스로 풉니다. `make crudui-install-crates`는 모든 Cargo.lock의 crate를
`cargo fetch --locked`로 download하고, `make install`이 이를 실행하므로 어떤 대상도 따로 검사하지 않습니다.
`make ordered-json-ext`는 `composer.lock`이 설치한 OrderedJSON release의 PHP 확장을 `composer.json`의 packages.json 저장소에서
빌드하며, comparison pipeline은 그 빌드를 읽고
없으면 실패하며, 아무것도 download하지 않습니다. comparison의 Go module은 OrderedJSON module `v0.0.25`을 요구하고,
`GOPROXY=off`가 module cache에서 이를 읽습니다.

## 문서 웹

문서 웹 빌드는 API 참조 생성 후 `docs/`의 Markdown을 읽습니다. 손으로 쓴 각
Markdown 문서는 H1 제목을 정확히 하나 포함해야 합니다. API Documenter가 쓴
page는 그 표지 주석으로 시작하고 H2 제목만 가지며, 도구가 쓴 그대로 받아 그 첫
제목을 제목으로 삼습니다. 이 제목을 문서 제목으로 사용하고
브라우저 제목은 `<제목> | CRUDUI`으로 생성합니다. `index.md`는 해당 디렉터리
경로로 변환하고 나머지 Markdown 파일은 `.html` 확장자를 사용하는 동일 경로로
변환합니다. 빌드는 `404.html`도 생성합니다.

제목 앵커는 렌더링한 제목 텍스트에서 GitHub와 호환되는 slug를 사용합니다.
대소문자를 접고 구두점과 공백을 하이픈으로 바꾸며, 연속 하이픈과 양 끝
하이픈을 제거하고 제목 첫 글자가 숫자여도 접두사를 추가하지 않습니다. 중복
제목 slug에는 숫자 접미사를 붙입니다. 문서 내부 상대 링크는 이 앵커를
사용하므로 링크 조각은 생성한 slug와 일치해야 합니다.

문서 내부 상대 링크는 생성한 HTML 경로를 사용합니다. 빌드는 모든 로컬
대상과 프래그먼트를 검사합니다. `docs/` 밖을 참조하는 상대 링크는 저장소 파일이나
디렉터리가 실제로 있어야 하며 생성 HTML에서는 저장소 소스 링크로 변환합니다.
`docs/public/`의 파일은 웹 루트에 복사합니다. 대상 또는 프래그먼트 누락,
경로 중복, 잘못된 문서 제목이 있으면 빌드가 실패합니다.

생성 웹는 탐색 메뉴, 전체 문서 사이드바, 페이지별 제목 목록과 반응형 스타일을
포함합니다. 영어 문서는 `en-US`, `.ko.md` 문서는 `ko-KR`을 사용합니다. 정리 후
빌드는 결정적인 결과만 `docs/.web/dist/`에 기록하며 입력이 같으면 반복 빌드의
모든 파일이 같아야 합니다. 개발·미리보기 명령은 같은 생성 결과를 제공하고 최초
빌드가 실패하면 0이 아닌 상태를 반환합니다.

`DOCS_BASE_PATH`는 빌드·개발·미리보기의 URL 접두 경로를 지정하며 생략하면
`/`를 사용합니다. 명시한 값은 `/`로 시작하고 끝나야 하며 각 경로 구간에는
영문자·숫자·`_`·`-`만 사용할 수 있습니다. 잘못된 값은 명령 실패로 처리합니다.
탐색 메뉴·문서 링크·이미지·스타일·404 페이지는 이 접두 경로를 사용합니다.
GitHub Pages는 `main`의 CI 문서 작업이 성공한 뒤 검사한 웹를
`https://polyspec.github.io/crudui/`에 게시합니다.

## PHP 의존성

각 PHP package는 runtime과 test 의존성을 선언합니다. Canonical private project는 `composer.json`과 `composer.lock`을
사용합니다. `make crudui-install-composer`는 이 checkout의 path package와 release의 packages.json 저장소에 있는 OrderedJSON을
해석하고, `make link`가 그것을 `.links`가 선언한 checkout에 연결합니다. Composer는 `vendor/`, native 링크, 설치 metadata와 autoload를 관리하며 별도 manifest selector는
필요하지 않습니다. `make crudui-local-composer-check`는 이 project와 PHP platform을 검증합니다. 생성 vendor 디렉터리는
Git에서 제외합니다. PHP 검증, test와 문서 검사 전에 source 의존성을 설치합니다. Release archive consumer project는
이 개발 project와 독립적입니다.
