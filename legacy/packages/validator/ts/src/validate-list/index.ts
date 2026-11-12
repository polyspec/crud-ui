/**
 * CRUDUI list-spec validation entry point (reference) — SPEC §9 read sister.
 *
 * The read sister of `src/validate/index.ts` (validate). A list-spec describes the
 * SAME domain as a form-spec, shown as a list instead of accepted as input. It
 * shares the CRUDUI engine 100%: expression / i18n / design / composition ($ref/
 * $patch) / forbidden-key scan run the SAME code that form-spec runs. Nothing
 * here re-implements them.
 *
 * Pass model — list reuses form-spec passes 1 and 2, and STOPS:
 *
 *   1. compose (G5, structure) — `$ref`/`$patch` on the `columns` map are the
 *      composition entry point (the read mirror of form-spec `properties`); they
 *      expand through `composeProperties` — the SAME engine. `search` is INPUT, a
 *      form-spec reference (SPEC §9.1), so a `{ $ref, $patch }` search overlay
 *      expands through the SAME compose primitives. An unresolved composition
 *      throws `ComposeLoadError` HERE (a LOAD failure, NOT `valid:false`) — the
 *      spec never comes into existence.
 *   2. forbidden-scan (§6, structure) — `scanForbiddenKeys` walks the COMPOSED
 *      list tree (columns / each Column / format options bucket / actions / sort /
 *      pagination / design / search) to arbitrary depth and rejects any forbidden
 *      meta key (`display_switch`/`if`/`when`/`show_if`/`_`/`x{key}`…) as a LOAD
 *      failure (code `FORBIDDEN_META_KEY`, dotted trace). Pure structure — no data.
 *
 * Pass 3 (DATA validate) does NOT apply: a list has no `data` (rows are INJECTED,
 * DB-agnostic — SPEC §9). There is no value to evaluate a `validate` slot against.
 * So this function NEVER validates rows.
 *
 * The "schema shape" checks — `additionalProperties:false` (closed objects),
 * `required: columns`, the `sort.dir`/`pagination.mode` enums, and the polymorphic
 * `CellFormat` (anyOf) — are NOT this engine's job. The four-language CRUDUI engines
 * do not perform JSON-Schema-style shape validation (SPEC §8: JSON Schema is not
 * adopted). Those live ONLY in the meta-schema (ajv, list-metaschema.conformance.
 * test.ts). This entry performs only cross-language structure composition and
 * forbidden-key scanning.
 *
 * This NEVER touches form-spec `validate` (R7 parallel run): it is a sibling
 * entry that reuses the shared compose and forbidden-scan modules.
 */

import { composeProperties, MemoryLoader } from '../compose/index';
import { composeRoot } from '../compose-root';
import type { FileLoader } from '../compose/index';
import type { FileSet, ListValidationResult } from '../types';
import { scanForbiddenKeys } from '../forbidden-scan';
import { checkOptionText, checkedComposition } from '../text/index';
import { isRecord } from '../record';

/** Options for a CRUDUI list validation run (mirrors `ValidateOptions`). */
export interface ValidateListOptions {
  /** Virtual file set for `$ref` resolution (default: empty — no `$ref`). */
  files?: FileSet;
  /** A custom loader (overrides `files`). */
  loader?: FileLoader;
  /** Basepath for relative `$ref` resolution. */
  basepath?: string;
}

/**
 * Validate a CRUDUI list-spec STRUCTURE. The spec's `columns` map (and a
 * `{ $ref, $patch }` `search` overlay) may carry composition; it is expanded first via the
 * compose pass — the SAME engine form-spec uses. An unresolved composition throws
 * `ComposeLoadError` (caller distinguishes a LOAD failure from `valid:false`). A
 * forbidden meta key anywhere in the composed list tree is likewise a LOAD
 * failure. NO rows/data are validated (SPEC §9: rows are injected).
 *
 * @param spec - a CRUDUI list root spec
 *   (`{ columns, search?, sort?, pagination?, actions?, empty?, design?, $ref?, $patch? }`;
 *   columns may use composition).
 * @param options - compose loader / file set / basepath.
 * @returns `{ valid: true, errors: [] }` when the structure loads cleanly.
 * @throws {@link ComposeLoadError} when composition cannot be resolved OR a forbidden
 *   meta key survives into the composed list tree.
 */
export function validateList(
  spec: Record<string, unknown>,
  options: ValidateListOptions = {}
): ListValidationResult {
  // Input text is checked first: the specification and files, then the options.
  const checked = checkedComposition(spec, options);
  checkOptionText(options, ['basepath']);
  const loader: FileLoader = checked ?? new MemoryLoader(options.files ?? {});
  const opts = options.basepath ? { basepath: options.basepath } : {};

  // Pass 1 (G5): compose. Build the composed list tree the forbidden-scan walks.
  //
  // List-root $ref/$patch (G5: a base list-spec inheritance) is applied first,
  // through the SAME resolveRef/applyPatch primitives form-spec uses. The base
  // file exposes its list under a `properties` layer (the detectKey
  // convention resolveRef enforces). An unresolved root $ref throws here.
  let composed: Record<string, unknown> = composeRoot(spec, loader, opts);

  // columns is the composition ENTRY POINT (read mirror of form-spec
  // `properties`): $ref/$patch on the columns map expand through composeProperties
  // — the SAME engine. An unresolved columns $ref throws ComposeLoadError.
  if (isRecord(composed.columns)) {
    composed = {
      ...composed,
      columns: composeProperties(
        composed.columns,
        loader,
        opts
      ),
    };
  }

  // search is INPUT — a form-spec reference (SPEC §9.1). A `{ $ref, $patch }`
  // search overlay expands through the SAME compose primitives; its expanded
  // sub-form then rides the SAME forbidden-scan below (no separate invention).
  if (isRecord(composed.search) && ('$ref' in composed.search || '$patch' in composed.search)) {
    composed = {
      ...composed,
      search: composeProperties(
        composed.search,
        loader,
        opts
      ),
    };
  }

  // Pass 2 (§6): forbidden-scan over the WHOLE composed list tree to arbitrary
  // depth. A hit (a condition-only/composition-directive/magic meta key or an `x{key}` residue
  // anywhere — a forbidden COLUMN key, a `show_if` on a Column, an `if` one level
  // below the open CellFormat options bucket, …) is a LOAD failure, never
  // `valid:false`. The trace points at the shallowest offending key.
  scanForbiddenKeys(composed, []);

  // Structure loaded clean. No rows → no data validation (SPEC §9). The
  // "schema shape" checks are the meta-schema's job, not this engine's.
  return { valid: true, errors: [] };
}
