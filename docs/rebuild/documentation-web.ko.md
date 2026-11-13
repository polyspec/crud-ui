<!-- doc-id: rebuild-documentation-web -->
<!-- source-sha256: 1e08c771ae7e5a447bd75f0a8f54763ed3a1ab93fbfe06f5b9d78e04872aebd3 -->
# 재구현 기록: documentation web

[English](documentation-web.md)

판정: **검토한 release 중 맞는 도구 없음**입니다. CRUDUI는 검사된 Markdown renderer와 documentation server를 유지합니다.
2026-10-26에 검토했습니다. CI 전 candidate 검토 C18.2는 현재 문서 도구 결정을 완료합니다.

## 현재 candidate 결정

2026-10-26 registry 검토에서 VitePress의 `latest`는 `1.6.4`, `next`는 `2.0.0-alpha.21`입니다. GitHub release
목록은 alpha release를 latest로 표시하지만 npm stable channel을 바꾸지는 않습니다. 두 정확한 release의 새 archive에는
영향받는 내장 parser가 남아 있습니다. 이 candidate에서는 두 release 모두 현재 renderer를 대체하지 않습니다.

Root manifest, root lock과 설치된 parser는 모두 현재 npm `latest` release인 markdown-it `15.0.3`을 선택합니다.
배포된 parser에는 label 길이 제한과 position 기반 continuation 수정이 있습니다. 기존 문서 renderer는 이 package를 직접
import합니다. 따라서 candidate는 VitePress distribution을 편집하지 않고 현재 수정된 parser를 사용합니다. 이 결정에
package update는 필요하지 않습니다. 문서 build, link와 development 소유 unit은 이 parser로 통과합니다. 이 결정은
candidate CI 전에 완료하며, 향후 도구 release는 이 candidate에 남긴 선행 조건이 아니라 유지보수 검토의 조건입니다.

## 대상

- `scripts/docs-web/build.mts`
- `scripts/docs-web/cli.mts`
- `scripts/docs-web/paths.mts`
- `scripts/docs-web/server.mts`
- `scripts/docs-web/watch.mts`
- `scripts/documentation-links.mts`

## 요구 사항

문서 명령은 Markdown과 생성된 API reference를 빌드하고 local target과 fragment를 검증하며 HTML route와 heading identifier를
유지합니다. 검사된 deployment prefix 아래에서 같은 output을 제공합니다. Build는 잘못된 heading, 없는 repository target,
symbolic link와 생성된 page를 대체하는 public file을 거부합니다. 같은 입력은 같은 output을 만듭니다. Development server는
file-system event를 받고 rebuild 실패를 보고합니다.

Site renderer는 GHSA-gfr2-rv44-r23c의 수정이 있는 Markdown parser를 사용해야 합니다. Root Markdown dependency와 다른 도구의
distribution 안에 내장된 parser는 각각 관리됩니다.

## 평가한 도구

| 도구 | 평가 | 결과 |
|---|---|---|
| VitePress 1.6.4 | npm stable release를 npm으로 설치하고 배포된 Node chunk를 검사했습니다 | 내장 reference parser는 continuation line을 string에 더하고 매번 그 string을 검사합니다. 수정된 label bound와 position 기반 continuation 처리가 없습니다. Root markdown-it package의 update나 override는 이 내장 구현을 대체하지 않습니다. |
| VitePress 2.0.0-alpha.21 | npm next release의 정확한 archive를 검사했습니다 | 배포된 Node chunk에 같은 무제한 reference parser 구현이 있습니다. Prerelease도 이 문제를 해결하지 않습니다. |
| markdown-it 15.0.3을 사용하는 기존 Markdown renderer | Root manifest, root lock, 설치된 distribution과 소유 unit을 확인했습니다 | 현재 npm latest parser는 공식 수정을 포함하며 직접 import됩니다. Candidate는 의존성을 변경하지 않고 문서의 rendering과 입력 거부 동작을 유지합니다. |

VitePress는 필요한 route 규칙, base 설정, navigation, static asset과 development server를 제공합니다. 배포 parser에 보안 수정이
포함되면 적합한 대체 도구입니다. 현재는 내장 parser 때문에 검토한 두 release를 채택할 수 없습니다. VitePress dependency나
부분 전환은 남기지 않습니다.

## 근거

[Security advisory](https://github.com/advisories/GHSA-gfr2-rv44-r23c)는 markdown-it의
`>=14.1.0 <14.3.3`과 `>=15.0.0 <15.0.3`을 영향받는 version으로 명시합니다.
14.3.3과 15.0.3의 parser fix는 반복 string 누적을 position 기반 처리로 대체하고
reference label 길이를 제한합니다. 검사한 release archive는 `npm pack vitepress@1.6.4`와
`npm pack vitepress@2.0.0-alpha.21`로 받았습니다. 새 archive의 SHA-256은 1.6.4가 `37f38a64e1e8ea1e9db68ad201488327c8df1303d3cdb2ceb0e3754259d65114`,
2.0.0-alpha.21이 `770f3dd5521427e11959059f6bffd339ec71ce63fa6e9059a4d491c810dcd11a`입니다.
VitePress 근거는 배포 source 비교이며 exploit 시간 측정이나 VitePress site-build 결과를 주장하지 않습니다.

## 유지보수 검토 조건

Stable VitePress release가 reference parsing 수정을 포함한 parser를 배포하거나 수정 release를 선택할 수 있는 지원된 parser
dependency를 제공하면 대체를 다시 검토합니다. Renderer를 교체할 때 문서의 route와 입력 거부 test를 유지합니다.
