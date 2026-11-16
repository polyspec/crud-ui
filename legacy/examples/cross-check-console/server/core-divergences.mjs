/**
 * The cases of legacy/tests/fixtures/validate/cases.json in which the Rust core gives another result than the four legacy
 * validators (js, php, go, python), each with the result of the core. The cross-check tests require the legacy result of
 * the fixture from the legacy validators and this result from the core; any other difference fails.
 *
 * Bases:
 * - legacy: the legacy validators follow legacy/tests/fixtures, the copy of the shared fixtures that is fixed and is
 *   never brought up to them (AGENTS.md, legacy/); its dataLimits cases from legacy/tests/fixtures/validate/cases.json
 *   line 25355 on accept a depth from 1 to 512.
 * - core: the Rust core follows docs/spec/schema.md CUSC-087 and docs/spec/validation-rules.md (data limits), whose depth
 *   is an integer from 1 to 256.
 *
 * The list is removed with the legacy validators (C19.2).
 */

/** The failure of the core for a dataLimits parameter outside the ranges of CUSC-087. */
const invalidDataLimits = Object.freeze({
  code: 'INVALID_RULE_PARAMETER',
  message: 'Invalid dataLimits parameter: expected depth from 1 to 256 and values from 1 to 1000000',
  at: '',
});

export const CORE_DIVERGENCES = Object.freeze(Object.fromEntries([
  'data-limits-default-values-over',
  'data-limits-bad-not-object',
  'data-limits-bad-unknown-member',
  'data-limits-bad-depth-zero',
  'data-limits-bad-depth-above',
  'data-limits-bad-depth-boolean',
  'data-limits-bad-depth-null',
  'data-limits-bad-values-above',
  'data-limits-bad-values-fraction',
  'data-limits-bad-before-rule-names',
].map(name => [name, Object.freeze({ lang: 'rust', failure: invalidDataLimits })])));
