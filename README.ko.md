# CRUDUI
<!-- doc-id: readme -->
<!-- source-sha256: c4a21ae0f1ff0f003faecb04f7e0ee02434b440fd3e716e3903087e7356bfed5 -->

[English](README.md).

CRUDUI은 YAML 또는 JavaScript 객체로 폼·목록·상세·검증을 정의합니다. 공유 코어가 데이터
로드 전에 폼 구조를 컴파일합니다. React, Vue, Svelte는 편집 가능한 인스턴스를
렌더링합니다. 프레임워크에 독립적인 HTML renderer는 UI 프레임워크 없이 폼과
목록 HTML을 제공합니다. PHP, Go, Rust, Python은 자체 프로세스에서 폼과 목록을 렌더링하고
데이터를 검증합니다. PHP 확장은 네이티브 폼 생성과 검증으로 같은 PHP 공개
클래스를 제공합니다.

## 시작

저장소 루트에서 실행합니다.

```sh
npm_config_cache="$PWD/var/bootstrap/npm-cache" npm exec --yes --package="$(node -p 'require("./package.json").packageManager.split("+")[0]')" -- npm ci --ignore-scripts
make install-tools TOOLS=npm
make install-packages
make install-tools
export PATH="$PWD/var/tools/bin:$PATH"
npm ci --strict-allow-scripts
npm run build
npm run test:forms
```

컴파일, 캐싱, 마운트, 데이터 주입은 [폼 설치와 사용](docs/operations/forms.ko.md)을
확인합니다.

## 문서

[온라인 문서](https://polyspec.github.io/crudui/)에서 영어·한국어 안내,
명세와 생성한 API 참조를 제공합니다.

- [명세 구조](docs/spec/schema.ko.md)
- [표시 형식](docs/spec/display-formats.ko.md)
- [정본 예제](docs/operations/examples.ko.md)
- [목록과 상세 개발](docs/operations/displays.ko.md)
- [폼 런타임 계약](docs/spec/form-runtime.ko.md)
- [런타임 패키지와 API](docs/spec/runtime-packages.ko.md)
- [네이티브 PHP 패키지](legacy/packages/php-ext/README.ko.md)
- [기능과 배포 상태](docs/features.ko.md)
- [개발과 검증](docs/operations/forms.ko.md)
- [문서 관리](docs/operations/documentation.ko.md)
- [변경 기록](CHANGELOG.ko.md)
- [개발 규칙](AGENTS.ko.md)

`make docs-check`로 문서를 검사하고 `make docs`로 API 참조, 스키마, 문서 웹을
생성합니다. 테스트 통과와 배포 상태는 별도로 기록합니다.
