# 검증기 처리량 benchmark (JS / PHP / Go / Rust)
<!-- doc-id: benchmarks-validators-readme -->
<!-- source-sha256: e116544bde1783cdd31f07d96bd5a198e034948e95d5a1d916c5541ed71617a4 -->

[English](README.md).

네 crudui 검증기를 **같은 spec과 같은 입력**으로 각각 N번 실행하고
처리량(ops/sec)과 평균 지연 시간(µs)을 보고합니다. 목적은 근거를 댈 수 있는
"어느 backend인가?" 비교이며, 절대 속도의 주장이 아닙니다.

## 실행

```sh
make bench            # all four backends
make bench-js         # one backend
make bench-php
make bench-go
make bench-rust
```

또는 직접 실행합니다.

```sh
node benchmarks/validators/run.js --iters 50000 --warmup 5000
node benchmarks/validators/run.js --only js,rust --iters 100000
node benchmarks/validators/run.js --json          # raw JSON lines, no table/file
```

결과는 표로 출력되고 `benchmarks/validators/results.md`에 기록됩니다.

`--iters`는 1부터 10000000까지의 정수이고 `--warmup`은 0부터
10000000까지의 정수이며, 둘 다 한 자리에서 여덟 자리의 십진 숫자로 씁니다. `run.js`와 모든 driver는
검증기를 불러오기 전에 이 규칙(`arguments.js`와 PHP, Go, Rust
driver에 있는 그 사본)을 적용합니다. `1e20`,
`1.5`, `-1`, `abc` 같은 그 밖의 값은 종료 상태 2와
`--iters must be a whole number from 1 to 10000000`으로 프로그램을 멈춥니다. `npm run test:bench`는
`build-drivers.mjs`로 Go와 Rust driver를 빌드하고(루트의 `var/build/benchmarks/`와 Cargo target
디렉터리에) 모든 driver를 `benchmarks/validators/iteration-arguments.json`으로 검사합니다. 그 파일은 `rejected` 아래에 거부되는
인자 쌍을 각각 그 메시지와 함께 나열하고, `accepted` 아래에 `contact`
fixture를 가장 작은 횟수로 실행하는 한 번의 실행을 나열하며, 그 실행의 보고는 그 spec과 그 반복 횟수를 적어야 합니다.

`run.js`는 `go run`이나 cargo 빌드를 포함해 각 driver를 시간 제한 없이
끝까지 실행합니다. driver는 자기 process group에서 실행됩니다. driver의 종료
상태가 결과를 정하고, 실패한 driver는 실패한 backend로 보고되며,
driver가 남긴 process는 driver가 종료할 때 멈춥니다.

## 측정하는 것

각 backend는 다음을 합니다.

1. 검증기 라이브러리를 **process 안에서** 불러옵니다(JS `require`, PHP composer
   autoload, Go package import, Rust crate path-dep).
2. fixture의 spec과 입력을 읽습니다.
3. `Validator`를 **한 번** 만듭니다.
4. `warmup`번 **예열**합니다(JIT와 분기 예측의 안정).
5. `validate(input)`을 `iters`번 실행하는 **시간을 잽니다**.

시간을 재는 구간은 `validate()`뿐입니다. process 시작, module/autoload, spec
파싱, fixture I/O는 모두 시계가 시작하기 **전에** 일어납니다.

두 fixture는 다음과 같습니다.

| spec         | 크기       | 입력             | 출처 |
| ------------ | ---------- | ---------------- | ------ |
| `contact`    | 현재 schema의 필드 6개 | 모두 유효함      | `gen-fixtures.js`가 생성 |
| `large` | 현재 schema의 필드 80개 | 빈 폼 `{}`  | `gen-fixtures.js`가 생성 |

`gen-fixtures.js`가 fixture를 JSON으로 만들어 두므로 모든 backend는
바이트가 같은 입력을 읽고, fixture를 만드는 일은 시간을 재는 경로 밖에 있습니다.
`make bench`는 먼저 fixture를 다시 생성합니다.

## 공정성에 관한 주의: 수치를 인용하기 전에 읽습니다

- **절대 시간은 기계에 따라 다릅니다.** 이 시간은 한 기계에서 한 번
  실행한 결과입니다. 한 spec 안에서 backend 사이의 **비율**을 인용하고, µs 값 자체는 인용하지 않습니다.

- **한 spec 안에서 열을 따라 아래로 비교합니다.** 한 spec의 네 행이
  조건이 같은 backend 비교입니다. 두 spec은 서로 비교할 수 **없습니다**.
  `contact`는 유효한 payload를 *모든* 규칙에 통과시키고,
  `large`는 빈 폼을 실행하며 빈 폼은 **첫 필수 필드에서
  검증을 끝냅니다**. 한 spec이 "더 빠르게" 보이는 것은 그 입력을 반영하며 난이도를 반영하지 않습니다.
  (이 때문에 한 backend가 필드 6개인 spec보다 필드 80개인 spec에서 더 높은
  ops/sec을 낼 수 있습니다.)

- **시작 시간은 구조상 제외됩니다.** 한 번의 실행에서 backend마다 process가 하나이고,
  반복은 그 안에 있습니다. 사례마다 `spawnSync`를 호출하면 interpreter나 binary의
  시작이 모든 호출에 포함되어 검증이 아니라 시작 시간을 측정합니다.

- **같은 작업량을 강제합니다.** 네 backend는 모두 같은 `fixtures/*.json`을 읽고,
  어느 spec에서든 backend들의 `valid`/`error`/`field`가 다르면 `run.js`가
  실행을 중단합니다. 검증기들의 결과가 갈리는 작업량으로 처리량을 비교하는 것은
  의미가 없습니다.

- **Rust는 `--release`로 빌드합니다.** debug 빌드는 큰 배수만큼 잘못 측정하며,
  그 배수는 오해를 일으킵니다.

- **빈 폼인 `large` 입력은 의도한 것입니다.** `gen-fixtures.js`는
  현재 schema의 필드 80개인 명세와 빈 객체를 생성하므로, 모든 backend가
  backend마다 다른 정규화 규칙에 의존하지 않고 같은 필수 필드 결과에
  도달합니다.

## 파일

| 파일                | 역할 |
| ------------------- | ---- |
| `run.js`            | 조정자: driver 실행, 일치 검사, 표와 `results.md` |
| `arguments.js`      | `run.js`와 `bench-js.js`의 반복 횟수 규칙 |
| `gen-fixtures.js`   | spec → `fixtures/*.spec.json` + `*.input.json` |
| `bench-js.js`       | JS driver (process 안의 반복) |
| `bench-php.php`     | PHP driver (단일 process, process 안의 반복) |
| `go/main.go`        | Go driver (자체 module, `replace` → 로컬 validator-go) |
| `rust/main.rs`      | Rust driver (자체 crate, path-dep → 로컬 validator-rust) |
| `fixtures/`         | 생성된 spec과 입력 JSON |
| `results.md`        | 마지막 실행의 생성된 표 (기계에 따라 다름) |

## 필요한 것

- `node` (validator-ts의 `dist/`를 빌드한 상태: `cd legacy/packages/validator/ts && npm run build`)
- `vendor/`를 설치한 `php` (`composer install`)
- `go`
- `cargo` (`$HOME/.cargo/bin`에 있음; `make bench`가 이를 `PATH` 앞에 붙입니다)

toolchain이나 빌드가 없는 backend는 실패로 보고되고 건너뛰며,
나머지 backend는 그대로 실행됩니다.
