/**
 * CRUDUI composition engine (reference) — SPEC §5, G5.
 *
 * The parser's first pass: expand `$ref` (base inheritance) then `$patch`
 * (add/remove/replace + deep-path set) into a single, composition-free spec,
 * BEFORE the field layer / validation / render. Unresolved composition is a LOAD
 * ERROR (`ComposeLoadError`) — never `valid:true`.
 */

export { composeProperties, composeSpec } from './compose';
export { resolveRef } from './ref';
export { MemoryLoader } from './loader';
export type { FileLoader, LoadedDoc } from './loader';
export { ComposeLoadError } from './errors';
export type { ComposeErrorCode } from './errors';
