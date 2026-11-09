# CRUDUI 계약 manifest
<!-- doc-id: contracts-readme -->
<!-- source-sha256: 1ec90e6482e9fb59d1d1f02e92f48f8eef656bb7e3bf4e65e6a1b39a6b675bb3 -->

[English](README.md).

[`features.json`](features.json)은 각 기능과 담당 패키지, 입력, 출력, 상태 변경,
오류, 지원 행렬, 테스트, 문서를 연결합니다. manifest는 widget이나 검증
목록을 복사하지 않습니다. 해당 목록은 실제 registry와 schema에서 계속 생성합니다.

저장소 루트에서 manifest를 검사합니다.

```sh
npm run manifest:check
```

검사는 manifest 구조, 패키지 경로, 패키지 진입점, fixture·테스트·문서 연결을 확인합니다.

각 패키지는 `entries`에 `package.json` `exports`의 모든 JavaScript 진입점(`"."`과 코드를 담은
다른 하위 경로. 스타일시트와 `package.json`은 코드가 아닙니다)을 `visibility`, 그리고 코드 단위 순서로
정렬한 값 export 목록과 함께 선언합니다. 타입은 적지 않습니다. `public` 진입점은 공개
API입니다. `internal` 진입점은 CRUDUI 자체 패키지만 사용하며 그 밖의 사용은 지원하지 않습니다.
`npm run manifest:check`는 빌드가 최신이 아니면 패키지를 빌드하고, 검사는 타입이 이미 지워진 각
진입점의 빌드된 ES module 파일에서 [es-module-lexer](https://github.com/guybedford/es-module-lexer)로
값 export를 읽습니다. `export * from`은 Node의 해석이 그 지정자에 주는 모듈로 따라가고,
`export { default as Widget } from './Widget.svelte'` 같은 다시 내보내기는 그 모듈을 읽지 않고
이름을 줍니다. `require` 조건의 빌드 같은 CommonJS 빌드는 모듈 구문이 없으므로 읽지 않습니다.
검사는 다음 경우 실패합니다.

- `package.json` 코드 진입점에 manifest 항목이 없거나, manifest 항목에 해당하는 `package.json`
  코드 진입점이 없음
- `package.json` 코드 진입점의 빌드된 파일이 없거나, 진입점에 ES module 파일이 없음
- 값 export가 선언 목록과 어느 방향으로든 다르거나, 목록이 정렬되지 않음
- 구현 완료 기능의 `signature`에 적은 함수가 담당 패키지의 공개 `"."` 목록에 없음
- 구현 완료 기능의 `errors`에 적은 오류 클래스(`Error`로 끝나는 이름)가 JavaScript 기본 오류도
  아니고 어느 CRUDUI 패키지의 공개 `"."` 목록에도 없음
- `packages/` 아래 CRUDUI 패키지 코드가 아닌 파일이 `internal` 진입점을 가져옴. 예제, 테스트,
  문서와 패키지 README는 공개 진입점만 사용합니다.
- `packages/` 아래 패키지의 파일이 다른 패키지의 파일을 상대 경로로 가져옴(import, export,
  `require`, 동적 import, Vitest 모듈 mock). 패키지는 다른 패키지를 이름으로 지정한 진입점으로만
  사용합니다.

[`tests/build/contract-manifest.test.mts`](../tests/build/contract-manifest.test.mts)는 각 실패를
합성 저장소에서 증명하고, `npm run manifest:check`가 이 저장소에 검사를 실행합니다.
CLI는 같은 계약을 도구가 읽을 수 있는 JSON 또는 Markdown으로 출력할 수 있습니다.

## 화면 문구

[`interface-messages.json`](interface-messages.json)에는 지원하는 모든 언어의 화면
문구가 있습니다. 폼 컨트롤 레이블, 개수, 요약입니다
([폼 마크업](../docs/spec/form-markup.ko.md#화면-문구)). 문구는 이 파일에만 적습니다.
각 런타임은 자기 스크립트로 이 파일에서 생성한 소스를 담고, 담은 문구가 파일과
다르면 실패하는 테스트를 둡니다. 파일을 고친 뒤에는 모든 런타임의 스크립트를
실행합니다.

- TypeScript: `node packages/generator/ts/scripts/generate-interface-messages.mjs`
- Go: `packages/generator/go`에서 `go generate`
- Rust: `node packages/generator/rust/tools/generate-interface-messages.mjs`
- PHP: `make php-tables`. 추적하지 않는 `packages/generator/php`의 `src/Internal/InterfaceMessages.php`를 씁니다
- PHP 확장: `node packages/php-ext/tools/generate-interface-messages.mjs`
