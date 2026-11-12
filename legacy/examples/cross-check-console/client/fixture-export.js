/**
 * Form validation fixture export of the cross-check console. Each language result of
 * `POST /api/validate` becomes one case of the legacy/tests/fixtures/validate/cases.json shape:
 * `{ name, note, requirements, spec, data, expected: { valid, errors, hidden } }` for a validation result,
 * with the errors and hidden paths in the order of the validator, or
 * `{ name, note, requirements, spec, data, expectFailure: { code, message, at } }` for a load or input failure.
 * Explicit requirement IDs are preserved; an unannotated export has an empty requirement list.
 * A process that answered no result or failure record gives no case.
 */

/**
 * Build the validation cases of one form run.
 *
 * @param {{ name: string, requirements?: string[], spec: object|null, data: object, run: { results: object[], idempotent: boolean } }} input
 * @returns {object[]} one case per language result
 */
export function validateCases({ name, requirements = [], spec, data, run }) {
  return run.results.filter(r => r.ok).map((r) => ({
    name: `${name}--${r.lang}`,
    note: `exported from cross-check console (lang=${r.lang}, idempotent=${run.idempotent})`,
    requirements: [...requirements],
    spec,
    data,
    ...(r.failure
      ? { expectFailure: { code: r.failure.code, message: r.failure.message, at: r.failure.at } }
      : {
        expected: {
          valid: r.valid,
          errors: r.errors.map(({ path, field, rule, message, value }) => ({ path, field, rule, message, value })),
          hidden: r.hidden,
        },
      }),
  }));
}
