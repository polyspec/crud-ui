<!-- doc-id: rebuild-test-commands -->
<!-- source-sha256: 6ceae680dba15fd60de3d71f738e88626fd4041b3fae92f37aceefad6724b64a -->
# 재구현 기록: test-commands

[English](test-commands.md)

판정: **맞는 도구 없음**입니다. crudui가 자체 구현을 유지합니다. 2026-10-20에 측정했습니다.

## 대상

- `scripts/test-commands.mts`

## 요구 사항

project가 실행하는 모든 test는 `@polyspec/kit`의 run-tests 도구를 거칩니다. run-tests는 각 test의 시작, 통과, 실패를 출력하고
timeout을 넘긴 test를 멈춥니다. `tests/build/test-commands.test.mts`는 Makefile, `package.json`의 script, CI workflow의 step에서
test 도구를 직접 호출하는 명령, test target을 prerequisite로 받는 Makefile target, test step 위의 CI 시간 제한을 모두 찾아야
합니다.

## 평가한 도구

| 도구 | 상태 | 판정 |
|---|---|---|
| kit 0.0.54 (`test-markers-check`, `ci-targets`, `parity`) | 설치됨 | `test-markers-check`는 test 파일을 읽고, `ci-targets`는 target을 실행하고, `parity`는 구현의 unit을 읽습니다. Makefile, package script, workflow의 명령에서 test 도구의 직접 호출을 찾는 것은 없습니다 |
| actionlint, shellcheck | 설치되지 않음 | workflow와 shell의 문법을 검사하며, 명령이 어떤 도구를 실행하는지는 보지 않습니다 |
| ESLint, knip | 설치됨 | JavaScript 소스와 manifest를 읽으며, Makefile이나 workflow의 명령은 읽지 않습니다 |

## 맞는 도구가 없는 이유

test가 run-tests 도구로만 실행된다는 규칙에 대해 Makefile, package script, workflow step의 명령을 읽는 도구가 없습니다. 이 규칙은
polyspec의 규칙(S3)이므로 kit이 소유자입니다.

## 재시도 조건

kit이 이 검사를 제공하면 이 구현을 대체합니다. kit이 소유할지는 conductor와 열려 있는 질문입니다.
