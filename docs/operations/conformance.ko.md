# 적합성 증거
<!-- doc-id: docs-operations-conformance -->
<!-- source-sha256: 33ee0fc8da9a0b4551633bd066ca033feffa1ba89a23caf23052f17193a71b13 -->

[English](conformance.md).

[`contracts/features.json`](../../contracts/features.json)은 모든 런타임을 재는 기준입니다. 각 기능은
지원하는 런타임(`pass`)과 그 기능을 증명하는 공용 fixture를 선언합니다.
매니페스트의 `fixtures` 목록은 모든 fixture를 등록합니다. `cases.json` 가족, `cases`를 선언하거나 사례
목록을 내보내는 export를 지정한 모듈 fixture입니다.

Fixture family가 일부 implementation만 실행할 때 적용 범위를 명시합니다. Fixture의 `runtimes`는 실제 실행하는
runtime을 나열하며, 이 값이 없으면 지원하는 모든 runtime을 계속 요구합니다. `featureCases`는 여러 operation을
검사하는 family의 feature별 정확한 case 이름을 지정합니다. 모든 case는 feature에 속해야 하고, fixture를 소유하는
모든 feature는 case를 선택해야 하며, 지원하는 feature runtime마다 적용 가능한 case가 있어야 합니다. Unknown runtime,
unknown case와 empty selection은 실패합니다.

`featureRuntimes`는 fixture를 소유한 feature의 operation이 실제 실행되는 runtime으로 해당 feature의 적용 범위를
제한합니다. Override가 없는 feature는 fixture의 기본 runtime 범위를 유지합니다. Override는 해당 feature가 지원하고
fixture가 허용하는 runtime을 비어 있지 않게 선택해야 합니다. Python outline case는 outline을 만들기 전에 template을
compile하고 bind합니다. 다른 outline 검사는 target에서 실제로 실행한 operation만 기록합니다.

`support-module` 항목은 실제 shared module 경로와 해당 module을 통해 실행되는 등록된 case fixture를 `supports`로
선언합니다. 이 항목은 가짜 case를 선언하거나 passing evidence를 제공하지 않습니다. 연결된 fixture는 등록되어 feature로
검증되어야 하며 module 파일도 존재해야 합니다. Form-state registration module은 state fixture unit을 지원합니다.

## 런타임 키

| 키 | 구현 |
| --- | --- |
| `javascript` | `@polyspec/crudui-validator`와 `@polyspec/crudui-generator-core` 모델 |
| `javascript-html` | `@polyspec/crudui-generator-html` 문자열 렌더러 |
| `javascript-dom` | `@polyspec/crudui-generator-html` 마크업 위의 `@polyspec/crudui-generator-core` DOM 바인딩 |
| `react`, `vue`, `svelte` | 프레임워크 패키지 |
| `php`, `go`, `rust`, `python` | 서버 라이브러리 |
| `php-native` | PHP C 확장 |

JavaScript는 모델과 문자열 렌더러가 별도 패키지이므로 서버 출력에 키가 두 개입니다. PHP, Go, Rust는
둘을 한 라이브러리에 담으므로 모델 기능과 HTML 기능을 한 키로 증명합니다.

## 증거

공용 fixture 사례를 실행하는 테스트는 그 사례가 증명하는 기능마다 한 줄
`{"feature", "fixture", "runtime", "case", "passed"}`를 기록합니다. `passed`는 그 사례의 모든 검증이
성공했을 때만 참입니다. 기록기는
[`tests/conformance/evidence.mts`](../../tests/conformance/evidence.mts),
[`tests/conformance/php/Evidence.php`](../../tests/conformance/php/Evidence.php)의 class
`Polyspec\Crudui\Conformance\Evidence`, Go 패키지
`legacy/packages/validator/go/testsupport/conformance`, Rust 테스트 모듈 `tests/common`입니다. `CRUDUI_CONFORMANCE_EVIDENCE`가
디렉터리를 지정할 때만 기록합니다.

[`scripts/check-conformance.mts`](../../scripts/check-conformance.mts)는 그 디렉터리를 읽고 다음 경우에
실패합니다.

- 지원 런타임에 기능이 지정한 fixture 사례의 증거가 없거나 실패한 증거가 있을 때
- 기준이 선언하지 않은 기능, fixture, 런타임, 사례의 증거가 있을 때(예: fixture 적용 범위 밖 runtime이나 다른 operation에 배정한 case)
- `tests/fixtures` 아래 디렉터리에 등록된 fixture가 없거나, 등록된 사례 fixture를 증명하는 기능이 없을 때
- 기능이 등록된 사례 fixture가 아닌 fixture를 지정할 때

Optional `phpExtensions` field는 runner가 요청한 PHP module을 repository root 기준 상대 경로로 기록합니다.
Generator PHP source 실행과 extension 실행은 case 인자가 같아도 별도 suite command입니다. Suite 상태는 command 실행만
설명하며, case 통과 증거는 계속 test의 실제 runtime에서 기록합니다.

## Suite 실행

빠진 사례만으로는 그 suite가 실패했는지, 끝나지 않았는지, 실행되지 않았는지 알 수 없으므로, 증거를 기록하는
suite의 실행은 증거 디렉터리의 `runs/`에 실행 기록도 남깁니다.
[`tests/conformance/run-suite.mts`](../../tests/conformance/run-suite.mts)는
`node_modules/@polyspec/kit/dist/run-tests.mjs`로 시작하는 suite의 테스트 명령 기록을,
[`tests/native-generators/run.mts`](../../tests/native-generators/run.mts)는 자신의 기록을
[`tests/conformance/runs.mts`](../../tests/conformance/runs.mts)로 씁니다. 기록
`{"program", "tool", "cwd", "args", "started", "status"}`는 실행이 시작할 때 `status`를 `null`로 써지고,
process가 끝날 때 종료 상태로 다시 써지므로 멈춘 실행은 `null`을 유지합니다. Python suite도
`make crudui-install-python`이 만드는 환경 `var/python`의 Python으로 `run-suite.mts`를 거쳐 실행되고,
[`tests/conformance/python`](../../tests/conformance/python/pyproject.toml)의 package `polyspec.crudui.conformance`로
증거를 기록합니다.

검사의 `evidenceSuites`는 suite마다 그것을 실행하는 명령과 증명하는 런타임을 선언합니다. 증거가 빠졌거나
실패한 기능, fixture, 런타임마다 검사는 그 런타임을 증명하는 모든 suite를 상태와 함께 적습니다. 명령에 맞는
기록이 없으면 `did not run`, 기록에 상태가 없으면 `did not finish`, 그 밖에는
`ended with failure (exit <status>)`나 `passed`입니다. 맞는 명령마다 가장 최근 기록이 결정하고, 여러 명령으로
실행되는 suite는 그중 가장 나쁜 상태를 가집니다. 기능이 지원하는 모든 런타임은 선언된 suite가 증명합니다.

서버 런타임은 [`tests/native-generators/run.mts`](../../tests/native-generators/run.mts)가 JavaScript
기준 출력과 바이트 단위로 비교합니다. 클라이언트 렌더러는 fixture의 정규화된 HTML과 비교하며, 정규화는
프레임워크 자체가 만드는 차이에만 적용합니다.

CI는 독립된 `cross-language-equivalence` job에서 `make crudui-test-cross-language-equivalence`를 실행합니다.
언어별 unit job을 기다리지 않고 JavaScript, HTML, Go, Rust, Python, PHP와 native PHP extension을 비교합니다.
이 job은 자체 build와 의존성을 준비하고 두 비교 report와 conformance evidence를 업로드합니다.
`conformance`와 `ci-passed`는 모두 이 job의 결과를 필수로 확인합니다.

`make conformance`는 디렉터리를 비우고 증거를 기록하는 모든 테스트를 실행한 뒤 검사를 실행합니다.
CI는 작업마다 고유한 artifact 이름으로 증거를 올리고 모든 증거에 대해 검사를 한 번 실행합니다.
conformance job은 artifact마다 별도 디렉터리에 내려받고, 검사는 디렉터리와 그 하위 디렉터리의 증거 파일과
`runs/` 기록을 읽으므로 한 job의 파일이 다른 job의 같은 이름 파일을 덮어쓰지 않습니다.
