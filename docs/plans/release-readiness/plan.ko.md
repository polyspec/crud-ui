<!-- doc-id: plan-release-readiness -->
<!-- source-sha256: 363e82c9fd9fcea768a7c0e121a220ddaa866a3ea02328b24b514fa5016db512 -->
# 로컬 release candidate 준비

[English](plan.md)

## 준비 순서

[Checklist](checklist.ko.md)의 C18.1–C18.10은 완료했습니다. C18.12는 CI 환경의 설치 범위를 완료했고 C18.13은 0.0.9 공개를 준비합니다.
CRUDUI 0.0.8은 release commit의 전체 CI와 push 검사, 세 tag의 release workflow를
통과하고 공개했습니다. Release workflow는 공개 전에 checkout 밖에서 archive 11개를 설치하고 검사했습니다.

## 현재 결정

- C16.8: C18.2가 현재 parser 결정을 완료합니다. 새 stable과 next VitePress distribution에는 영향받는 parser가 남아 있고
  직접 관리하는 현재 markdown-it 15.0.3 parser에는 수정이 있습니다. 이 candidate는 기존 renderer를 유지합니다. Rebuild
  record의 유지보수 검토 조건은 현재 candidate 결정을 미루지 않습니다.
- C16.173: C18.3은 widget-script exception 없이 현재 React와 React DOM을 지원하며 script 실행과 server hydration 검증을
  유지합니다.
- C16.45, C16.170과 C16.171: Native package manager가 현재 로컬 source를 해석합니다. Root Composer 선언과 lock은 현재
  sibling package를 선택하며 중복 archive compatibility profile은 로컬 준비에 포함하지 않습니다.
- C16.169: 현재 advisory 검토로 적용할 finding을 판단합니다. 철회된 advisory는 version bump를 요구하지 않으며 현재 의존성
  graph의 보안 검증을 면제하지도 않습니다.
- C18.4는 현재 npm 의존성과 지원하는 Svelte peer를 준비합니다. C18.5는 version 0.0.8 선언과 native lock을 정렬합니다.
  C18.6은 PHP source-only helper test와 extension runtime test를 분리합니다.

## 수용한 결정

C16.13은 C16.13-1이 구현합니다. C16.29-1은 forwarding을 수정하고 현재 adapter를 유지하는 application 요구사항을
기록합니다. C16.65는 부적절한 용어 제한을 제거합니다. C16.172는 다른 저장소의 정확한 선언과 일치시키지 않고 Composer가
제약을 선택하게 합니다. 이 결정은 현재 source 의존성, package와 consumer 검사를 제거하지 않습니다.

## 완료

준비한 source commit, 검토일, 평가한 version, native package-manager 결과와 consumer 결과를 기록합니다. 로컬 candidate
artifact가 필요하면 현재 병합된 source snapshot에서 만들고 같은 실행에서 만든 artifact만 소비합니다. 남은 로컬 수정은
소유 검사로 검증하고 완료된 모든 개발 branch를 로컬 `main`에 반영합니다. C18.1은 이 준비와 로컬 검증이 끝나야 완료됩니다.

CI 성공은 이후 publication의 조건이며 로컬 준비를 우회 상태로 남길 이유가 아닙니다. 이후 변경은 해당 소유 검증과 결과
commit의 publication 검사를 필요로 합니다. 향후 유지보수 검토 조건과 이 candidate에서 완료한 결정은 구분합니다.


## CI 환경별 설치 준비 (C18.12)

Kit 0.0.63은 `make install-tools TOOLS="..."` 선택 설치를 제공합니다. 각 CI job은 필요한 도구를 선언하고
자체 lock 의존성과 build를 준비합니다. PHP extension job은 고정 arginfo parser를 명시적으로 준비합니다.
Root release asset과 native lock은 같은 릴리즈를 선택합니다. 로컬 source link는 개발 입력으로 유지합니다.

모든 job은 잠긴 npm을 bootstrap하고 필요한 npm package를 설치합니다. 아래는 추가 도구와 입력입니다.
도구 별칭과 필수 설치 의존성은 공개 Kit 인터페이스를 따릅니다. 앱 코드는 toolchain을 설치하지 않습니다.

| Job | 추가 환경 | 잠긴 입력과 담당 작업 |
| --- | --- | --- |
| validator-js, cli | 없음 | npm lock; 필요한 JavaScript package를 빌드하고 선택한 suite 실행 |
| validator-php | PHP, Composer | Root Composer lock과 선언한 source provider; 설치 후 PHP validator suite 실행 |
| validator-go | Go | go.work와 native module sum; module 다운로드 후 Go validator와 generator 빌드와 검사 |
| validator-rust | Rust | rust-toolchain.toml과 Cargo lock; crate 다운로드 후 Rust validator와 generator를 offline으로 빌드하고 검사 |
| python | Python, uv | uv.lock과 workspace build 선언; 잠긴 환경을 동기화하고 두 Python suite 실행 |
| cross-language-equivalence | Go, Rust, PHP, Composer, Python, uv와 PHP extension 빌드 지원 | 자체 native 의존성 설치, 현재 JavaScript와 extension 빌드 후 두 generator 비교 명령 실행 |
| cross-check-console | Go, Rust, PHP, Composer, Python, uv와 PHP extension 빌드 지원 | 자체 native 의존성 설치와 program 빌드 후 공용 validator 비교와 benchmark driver regression |
| native-generators | 고정 Chrome | JavaScript protocol과 widget unit suite; Go와 Rust generator suite는 각 언어 job에서 실행 |
| php-api | PHP, Composer와 PHP extension 빌드 지원 | 잠긴 Composer 설치, 현재 extension 빌드와 PHP unit suite |
| php-engine | C compiler와 sanitizer | 현재 JavaScript fixture 빌드와 native engine 컴파일; PHP setup 제거 전 실제 PHP 실행 여부 확인 |
| form-runtime, package-browser | 고정 browser | npm lock, 필요한 JavaScript 빌드와 package가 고정한 browser build |
| form-comparison | PHP, Composer, 고정 Chrome | Regression case와 실제 PHP 입력 |
| form-comparison-pipeline, form-comparison-browser, form-comparison-checks | Go, Rust, PHP, Composer, nginx, 고정 Chrome | 독립된 native stack 준비와 고정 release 입력; summary는 선언한 browser report도 읽음 |
| docs-coverage | Go, Rust, PHP, Composer와 선언한 문서 도구 | Native API 문서 빌드와 문서 검사 |
| runtime-tests, build-lint | 선택한 검사에서 실제 실행하는 모든 도구 | Runtime policy, 의존성 검증과 여러 언어의 lint; 설치 범위를 줄이기 전에 언어별 lint 분리 |
| conformance, ci-passed | 없음 | Conformance는 격리된 evidence artifact를 읽고 최종 CI는 모든 필수 job 결과 판정 |
| Dependency review workflow | 선언한 각 의존성 graph와 audit 명령에 필요한 도구 | Online registry 검토; PHP 도구 선택 설치 전에 PHP를 준비하고 검사 target과 의존성 version target을 분리 |

### 적용 검증

- Bootstrap은 packageManager의 npm 릴리즈를 사용합니다. 선택한 도구는 mise.lock, rust-toolchain.toml과 선언한 hash를 유지합니다.
- 빈 언어 job은 선택한 도구와 필수 의존성만 설치합니다. 관련 없는 PHP, Go, Rust, Python setup은 없습니다.
- 필요한 build는 해당 job에서 실행합니다. Native test 명령은 자체 컴파일할 수 있으며 다른 언어 job의 build 산출물을 받지 않습니다.
- 두 비교 job은 언어별 job 의존성 없이 시작하며 비교할 모든 runtime을 자기 환경에서 준비합니다.
- 같은 입력으로 설치를 반복하면 올바른 버전을 재사용하고 선택한 설치 상태를 유지합니다.
- 의존성 설치는 online으로 lock을 따릅니다. CI Composer 설치는 lock을 갱신하지 않으며 로컬 source 갱신은 별도 작업입니다.
- 검사는 offline 환경과 자동 설치 금지를 유지합니다. Cache가 없으면 network fallback 대신 실패합니다.
- Conformance와 최종 CI는 관련 결과를 모두 요구합니다. Evidence summary만 evidence 생산 job을 기다립니다.
- 변경 중에는 소유 workflow와 Make 검사만 실행합니다. 전체 모음은 활성 checklist 항목을 모두 완료한 뒤 한 번 실행합니다.


## 빌드 의존성 권고 검토 (C18.12-3)

GHSA-gcqx-w48m-w2h4는 Svelte Vite plugin이 신뢰한 저장소 build 설정 병합에 사용하는 deepmerge 4.3.1에 해당합니다.
권고의 심각도는 low이며 패치 릴리즈는 없습니다. 공개 runtime package는 deepmerge에 의존하지 않습니다.
기존 의존성 검토는 npm moderate, high, critical 항목을 기록하며 이 기준을 유지합니다.
Raw npm audit는 low 항목과 이를 사용하는 plugin을 계속 보고합니다. 예외나 package override를 추가하지 않습니다.


## 0.0.9 candidate 검증 (C18.13-1)

Candidate archive는 C18.13-2 commit의 source를 담습니다. Native package manager가 0.0.9 입력을 해석했고
깨끗한 외부 consumer가 archive 11개를 모두 설치하고 검사했습니다. Go workspace는 로컬 module 7개를 선택하며
Cargo lock 6개는 외부 package version과 checksum을 유지합니다. PHP 검증은 8.4.27에서 실행해 source case 36개와
native constructor case 2개가 통과했습니다. 공개에는 최종 candidate commit의 CI 성공이 필요합니다.


## Kit 0.0.63 통합 검증 (C18.13-4, C18.13-5)

Root manifest와 native lock은 공개된 Kit 0.0.63 asset을 선택합니다. `config/ci.json`은 provider 인터페이스로 shared,
6개 runtime과 full parity 준비를 선언합니다. Native 계획, schema와 owner 검사는 통과했습니다.
PHP arginfo가 없는 상태에서 `node npm`과 `node npm go` 선택 검사가 통과했고 probe 후 기존 설치를 복구했습니다.

Provider runtime workflow는 native source 연결에 해당 runtime을 전달합니다. 실제 여러 언어 Git fixture는 TypeScript
연결이 다른 언어 도구 없이 성공하며 전체 연결은 Go 요구사항을 유지함을 검증합니다. 소유 검사는 Make와 workflow의
runtime 전달 및 native CI 계획을 검증합니다. C18.13은 전체 격리 candidate CI와 release proof를 계속 필수로 요구합니다.
실제 consumer CI 결과는 [Kit issue 14](https://github.com/polyspec/kit/issues/14)에 회신합니다.


## 최종 candidate 입력 (C18.13-6)

Kit 0.0.63은 C18.13-7의 source snapshot에서 archive 11개를 모두 빌드했습니다. 깨끗한 consumer 설치와 release/manifest
소유 case 20개가 통과했습니다. Native consumer metadata는 명시적 package repository로 로컬 zip archive를 지정합니다.
최종 source metadata와 consumer 기록을 main에 반영한 뒤 전체 candidate CI와 공개 검사를 실행합니다.
