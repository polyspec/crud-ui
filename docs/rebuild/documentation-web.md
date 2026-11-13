<!-- doc-id: rebuild-documentation-web -->
# Rebuild record: documentation web

[한국어](documentation-web.ko.md)

Verdict: **none of the evaluated releases fits**; CRUDUI retains its checked Markdown renderer and documentation server.
Reviewed on 2026-10-26. The pre-CI candidate review C18.2 completes the current documentation-tool decision.

## Current candidate decision

The registry review on 2026-10-26 reports VitePress `latest` as `1.6.4` and `next` as `2.0.0-alpha.21`.
The GitHub release list labels the alpha release as latest; it does not change the npm stable channel. Fresh archives of
both exact releases retain the affected bundled parser. Neither release replaces the current renderer in this candidate.

The root manifest, root lock and installed parser all select markdown-it `15.0.3`, the current npm `latest` release.
Its distributed parser contains the bounded label handling and position-based continuation fix. The existing document
renderer imports that package directly. The candidate therefore uses the current patched parser without editing a
VitePress distribution. No package update is needed for this decision. The documentation build, link and development
owner units pass with this parser. This decision is complete before candidate CI; a future tool release is a maintenance
review trigger, not a prerequisite left open for this candidate.

## Covers

- `scripts/docs-web/build.mts`
- `scripts/docs-web/cli.mts`
- `scripts/docs-web/paths.mts`
- `scripts/docs-web/server.mts`
- `scripts/docs-web/watch.mts`
- `scripts/documentation-links.mts`

## Requirement

The documentation commands build Markdown and generated API references, validate local targets and fragments, preserve
HTML routes and heading identifiers, and serve the same output under a checked deployment prefix. The build rejects
invalid headings, missing repository targets, symbolic links and public files that replace generated pages. Unchanged
inputs produce identical output. The development server receives file-system events and reports rebuild failures.

The site renderer must use a Markdown parser with the fix for GHSA-gfr2-rv44-r23c. The root Markdown dependency is managed
separately from a parser embedded inside another tool's distribution.

## Tools evaluated

| Tool | Evaluation | Result |
|---|---|---|
| VitePress 1.6.4 | npm stable release; installed with npm and its distributed Node chunk inspected | Its bundled reference parser appends continuation lines to a string and scans that string on every continuation. It lacks the fixed label bound and position-based continuation handling. Updating or overriding the root markdown-it package does not replace this embedded implementation. |
| VitePress 2.0.0-alpha.21 | npm next release; exact release archive inspected | Its distributed Node chunk contains the same unbounded reference-parser implementation. The prerelease does not resolve this finding. |
| Existing Markdown renderer with markdown-it 15.0.3 | Root manifest, root lock, installed distribution and owning units checked | The current npm latest parser contains the official fix and is imported directly. The candidate preserves the documented rendering and input-rejection behavior without a dependency change. |

VitePress provides the required route conventions, base configuration, navigation, static assets and development server.
Those capabilities make it a suitable replacement after its distributed parser contains the security fix. The bundled
parser currently prevents adopting either evaluated release. No VitePress dependency or partial conversion is retained.

## Evidence

The [security advisory](https://github.com/advisories/GHSA-gfr2-rv44-r23c) identifies markdown-it versions
`>=14.1.0 <14.3.3` and `>=15.0.0 <15.0.3` as affected. The
parser fix of 14.3.3 and 15.0.3 replaces the repeated string accumulation with
position-based handling and bounds reference labels. The release archives inspected were obtained by
`npm pack vitepress@1.6.4` and `npm pack vitepress@2.0.0-alpha.21`. The fresh archive SHA-256 values are `37f38a64e1e8ea1e9db68ad201488327c8df1303d3cdb2ceb0e3754259d65114`
for 1.6.4 and `770f3dd5521427e11959059f6bffd339ec71ce63fa6e9059a4d491c810dcd11a` for 2.0.0-alpha.21.
The VitePress evidence is a distributed-source comparison; no exploit timing or VitePress site-build result is claimed.

## Maintenance review trigger

Re-evaluate the replacement when a stable VitePress release distributes a parser with the reference-parsing fix, or exposes
a supported parser dependency that can select a fixed release. Preserve the documented routes and input-rejection tests
when replacing the renderer.
