/**
 * CRUDUI validation entry point (reference) — SPEC §2 pipeline.
 *
 * Wires the three CRUDUI passes in order (G5 compose first → §3 traversal → §2 G1
 * value evaluation):
 *
 *   1. compose  — `composeSpec` expands `$ref`/`$patch` into a single spec.
 *                 An unresolved composition throws `ComposeLoadError` HERE
 *                 (a LOAD failure, NOT `valid:false`) — the spec never comes
 *                 into existence, so there is no validation result to return.
 *                 An unresolved `$ref` never yields `valid:true`.
 *   2/3. validate — `Validator` traverses the composed spec and runs the
 *                 `validate` slot (conditional rule values evaluated by the CRUDUI
 *                 expression engine, then handed to the existing rule registry).
 *
 * The compose pass reuses the existing compose module; the expression engine and
 * rule registry are reused as-is. Nothing here re-implements them.
 */

import { isRecord } from '../record';
import {
  composeSpec,
  composeProperties,
  MemoryLoader,
} from '../compose/index';
import type { FileLoader } from '../compose/index';
import type { FileSet, ValidationResult } from '../types';
import { scanForbiddenKeys } from '../forbidden-scan';
import { Validator } from './validator';
import { FormInputError } from './errors';
import { dataLimits } from './data-limits';
import { checkInputText, checkOptionText, checkedComposition } from '../text/index';

export { Validator, type ComposedField } from './validator';
export { ComposeLoadError } from '../compose/index';
export { FormInputError } from './errors';

/** Options for a CRUDUI validation run. */
export interface ValidateOptions {
  /** Virtual file set for `$ref` resolution (default: empty — no `$ref`). */
  files?: FileSet;
  /** A custom loader (overrides `files`). */
  loader?: FileLoader;
  /** Basepath for relative `$ref` resolution. */
  basepath?: string;
}

/**
 * Validate `data` against a CRUDUI spec. The spec may carry `$ref`/`$patch`; they
 * are expanded first via the compose pass. An unresolved composition throws
 * `ComposeLoadError` (caller distinguishes a LOAD failure from `valid:false`).
 *
 * @param spec - a CRUDUI root spec (a group with `properties`; may use composition).
 * @param data - the form data to validate; root and group data are objects and
 *        repeated data is a keyed object.
 * @param options - compose loader / file set / basepath.
 * @returns `{ valid, errors, hidden }`.
 * @throws {@link ComposeLoadError} when composition cannot be resolved.
 * @throws {@link FormInputError} when submitted data has the wrong shape.
 */
export function validate(
  spec: Record<string, unknown>,
  data: unknown,
  options: ValidateOptions = {}
): ValidationResult {
  // Input text is checked first: the specification and files, the data, then the options.
  const checked = checkedComposition(spec, options);
  checkInputText([['data', data]]);
  checkOptionText(options, ['basepath']);
  // Root data is a request precondition, checked before composition.
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new FormInputError('Form data must be an object');
  }
  const properties = composedProperties(spec, checked, options);
  // The data limits are checked after the forbidden-key scan and before the rule names.
  return new Validator({ type: 'group', properties }, dataLimits(spec)).validate(data);
}

/**
 * The data paths of the fields whose `design.show` resolves to `false` against `data`
 * (form-runtime.md, "Display"), as validation resolves them. The specification is composed
 * without files, as the browser binding sends it.
 *
 * @throws {@link ComposeLoadError} when composition cannot be resolved.
 * @throws {@link FormInputError} when the data is not an object.
 */
export function hiddenPaths(spec: Record<string, unknown>, data: unknown): string[] {
  const checked = checkedComposition(spec, {});
  checkInputText([['data', data]]);
  if (!isRecord(data)) {
    throw new FormInputError('Form data must be an object');
  }
  return new Validator({ type: 'group', properties: composedProperties(spec, checked, {}) })
    .hiddenPaths(data);
}

/** The composed `properties` of a root specification or a properties composition entry, scanned for forbidden keys. */
function composedProperties(
  spec: Record<string, unknown>,
  checked: FileLoader | undefined,
  options: ValidateOptions
): Record<string, unknown> {
  const loader: FileLoader =
    checked ?? new MemoryLoader(options.files ?? {});
  const opts = options.basepath ? { basepath: options.basepath } : {};

  // Pass 1 (G5): compose. Throws ComposeLoadError on unresolved $ref/$patch.
  //
  // The validation entry resolves to a single `properties` field map. Two entry
  // shapes:
  //   (a) a full root group spec `{ type:'group', properties:{…} }` — compose
  //       the whole spec, then read its composed `properties`.
  //   (b) a properties-layer composition entry `{ $ref, $patch }` (the
  //       composition entry point IS `properties`, types.ts) with no own
  //       `properties` — compose it AS a properties map directly. A top-level
  //       `$ref` flattens the base file's `properties` into this map.
  // Pass 2/3 (§3 + §2 G1): traverse + evaluate the validate slot.
  const hasOwnProperties = isRecord(spec.properties);
  const isCompositionEntry = '$ref' in spec || '$patch' in spec;

  let properties: Record<string, unknown>;
  if (isCompositionEntry && !hasOwnProperties) {
    properties = composeProperties(spec, loader, opts);
  } else {
    const composed = composeSpec(spec, loader, opts).properties;
    // A root whose composed `properties` is no object has no fields.
    properties = isRecord(composed) ? composed : {};
  }

  // Load-path forbidden-scan (SPEC §6): walk the composed single spec to
  // arbitrary depth and reject any forbidden meta key BEFORE validation entry.
  // A hit throws ComposeLoadError (a LOAD failure), never `valid:false`. This
  // closes the deep-nesting leak the typed models alone could not (R1).
  scanForbiddenKeys(properties, ['properties']);
  // The form root declarations are scanned like the fields they sit beside.
  for (const key of ['buttons', 'action']) {
    if (key in spec) scanForbiddenKeys(spec[key], [key]);
  }

  return properties;
}
