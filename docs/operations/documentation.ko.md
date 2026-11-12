# 문서 관리
<!-- doc-id: docs-operations-documentation -->
<!-- source-sha256: 23b320f8eb8c94882178fa26442b93233f00b78f2e08cf99b661e3d5c8dad2ab -->

[English](documentation.md).

| 위치 | 내용 |
| --- | --- |
| `README.md` | 프로젝트 소개, 최소 설치 절차와 문서 링크. |
| `docs/spec/` | 승인한 구조·계약·규칙·인수 기준. |
| `docs/features.md` | 구현·검증 근거·배포 상태. |
| `docs/operations/` | 현재 설치·실행·배포·검증 절차. |
| `CHANGELOG.md` | 실제 동작 변경과 검증 결과. |
| `docs/plans/` | 승인 대기 제안. 승인 후 명세에 반영하고 제거. |
| `AGENTS.md` | 개발 절차와 필수 검사. |

주제마다 지원 언어별 문서를 관리합니다. 같은 변경에서 언어별 문서를 갱신하고
의미를 비교합니다. 개인 선호와 대화 맥락은 Git 외부에 보관합니다.

웹 탐색 메뉴는 영어를 사용하며 한국어 문서 색인을 포함합니다. API 탐색에는
검증기·공통 생성기 core·세 프레임워크 패키지와 Go·Rust·PHP 참조를 포함합니다.

방향을 변경하기 전에 명세를 갱신합니다. 미완성 동작은 기능 표에 표시합니다.
동작 변경과 함께 구현 상태·검증 근거·변경 기록을 갱신합니다. 테스트 결과는
검사한 코드에만 적용되며 배포를 증명하지 않습니다.

`make docs-check`로 API 문서, 로컬 링크, 필수 번역과 기능 상태 항목을 검사합니다.
`make docs`로 API 레퍼런스, 스키마와 문서 웹을 생성합니다. 자동 검사는 내용의
정확성을 증명하지 않습니다. 결과를 기록하기 전에 관련 소스와 테스트를 확인합니다.

`npm run docs:dev`는 초기 빌드 전에 `docs/` 아래의 재귀 파일 시스템 구독을
등록합니다. 생성 경로인 `docs/.web/` 이벤트를 제외하고 빌드를 직렬로 실행하며 빌드
중 수신한 소스 이벤트를 추가 빌드 한 번으로 합칩니다. 빌드 실패를 보고하고 이후 소스
이벤트가 새 빌드를 요청할 수 있습니다. 파일 시스템 구독이 실패하면 서버를 종료 상태
1로 닫습니다. 개발 서버는 소스 파일을 주기적으로 조회하지 않습니다.

스크립트와 문서는 저장소 상대경로를 사용합니다. 외부 소스를 처리하는 도구는
입력 경로를 명시적으로 받아야 합니다. 다른 프로젝트의 체크아웃이나 개발자의
홈 디렉터리에 의존하면 안 됩니다.

문서 웹 빌드는 내부 링크를 검사합니다. 웹 전체의 링크 검사를 끄지
않고 소스 또는 생성된 문서의 잘못된 링크를 수정합니다.
API Documenter는 TypeScript 패키지마다 상대 링크와 `index` 페이지를 생성합니다.
`docs/` 밖의 저장소 파일을 참조하는 상대 링크는 파일 존재를 확인하고 웹에서
GitHub 소스 링크로 출력합니다. 문서 원문은 저장소 상대 링크를 유지합니다.
저장소 파일이 없으면 빌드가 실패합니다.

API 생성에는 API Extractor·API Documenter·Go·Cargo·phpDocumentor가 필요합니다. TypeScript 패키지마다 API Extractor는
공개 API를 commit된 report `etc/<package>.api.md`와 비교하고 doc model을 `var/api-model/<package>`에 쓰며, API Documenter는 그
model의 Markdown 페이지를 `docs/api/<package>`에 씁니다. 도구 실행 실패나
출력 누락은 생성 실패로 처리하며 실패한 출력을 성공 페이지로 대체하지
않습니다. PHP 문서는 `var/tools/phpdocumentor/phpDocumentor.phar`를 사용합니다.

`make crudui-install-phpdocumentor`는 phpDocumentor 3.10.0을 설치하고 SHA-256으로 검사합니다. Go·Cargo·PHP는 `PATH`에
있어야 하며 PHP에는 mbstring 확장이 필요합니다.

```sh
make crudui-install-phpdocumentor
make docs
make docs-verify-idempotent
```

TypeScript 참조는 공개 패키지 진입점 다섯 개를 설명합니다. Svelte는
`Form`을 포함한 빌드된 선언을 사용합니다. PHP·Rust의 자체
HTML은 `docs/public/api/`에서 웹에 포함합니다. 반복 생성 검사는 해당
자산, Markdown 참조, 스키마를 비교합니다.
Go 참조는 조합·표현식·검증을 포함해 `validator/`
아래의 모든 패키지를 설명합니다.

`make docs-check`(`node_modules/@polyspec/kit/dist/check-documents.mjs`, `config/documents.json`)는
`legacy/examples/cross-check-console/client/README.md`, `benchmarks/validators/README.md`를 뺀 저장소의 모든 Markdown 문서를 검사합니다. 각 영어 문서에는
한국어 twin `.ko.md`가 있고, 두 file은 같은 marker `<!-- doc-id: <id> -->`를 가집니다. id는 `.md`를 뺀 영어 file의 경로를 소문자로 하고
단어 사이를 `-`로 이은 것입니다. 한국어 file은 영어 file의 sha256인 `<!-- source-sha256: <sha256> -->`도 가지며, 영어 문서를 바꾼 뒤에는 한국어
twin을 검토하고 `make documents-stamp`를 실행하며, 이것이 모든 한국어 file의 marker를 영어 file의 sha256으로 설정합니다. 검사는 명시한 section anchor, fenced code block(info string과 내용),
상대 link와 anchor, 기능 상태 table(`docs/features.md`), `CHANGELOG.md`를 비교하며 본문의 의미 일치는 검토로 확인합니다.

## GitHub Pages

문서 URL은 `https://polyspec.github.io/crudui/`입니다. 저장소 Pages의 게시 소스는
**GitHub Actions**입니다. [CI](../../.github/workflows/ci.yml)는
`DOCS_BASE_PATH=/crudui/`로 `make docs-check`를 실행하고 `docs/.web/dist`를
업로드한 뒤 `github-pages` 환경에 배포합니다. `main` 푸시 또는 `main`의 CI
수동 실행은 웹을 게시합니다.

저장소 루트에서 게시 경로로 미리보기를 실행합니다.

```sh
DOCS_BASE_PATH=/crudui/ npm run docs:preview
```

`http://127.0.0.1:4173/crudui/`를 엽니다. GitHub 배포 결과와 공개 색인·한국어
페이지·API 진입점·스타일시트를 확인한 뒤 [배포 상태](../features.ko.md)를 갱신합니다.

## 저장소 문장 작성

관리하는 문서·주석·변경 기록·사용자 출력은 현재 동작을 직접 설명합니다. 각 문장은
구성 요소·동작·대상·결과를 명시합니다. 필요한 원인은 한 문장으로 설명합니다.
테스트 결과는 `통과`와 `실패`, 인수 검사는 `검사` 또는 `검증`으로 표현합니다.

이 기록에는 비유·의인화·색상으로 구분한 테스트 상태·구어체·복사나 이식 같은
구현 이력을 사용하지 않습니다. 현재 동작을 실행하는 데 식별자·API·경로가 필요한
경우에만 외부 프로젝트를 명시합니다. 대응하는 한국어 문서는 동일한 정보를
제공합니다.

`npm run test:docs`는 관리하는 Markdown·소스 주석·설명용 고정 데이터가 이 작성
규칙을 준수하는지 검사합니다. 외부 의존성과 생성한 참조 문서는
원문을 유지하며 이 검사에서 제외합니다.
