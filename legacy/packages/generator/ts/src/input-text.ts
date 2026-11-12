/** Input text checks of the form operations (docs/spec/input-text.md). */

import { checkInputText, checkOptionText } from '@polyspec/crudui-validator/internal';

/** Options of a form binding or instance, in code point order of their names. */
const BIND_OPTIONS = ['idPrefix', 'keyPrefix', 'language', 'unsupported'];

/** Options of a list or detail model, in code point order of their names. */
export const DISPLAY_OPTIONS = ['basepath', 'data', 'language', 'layout'];

/** Check the text of the template, data and options a form binding reads. */
export function checkBindText(template: unknown, data: unknown, options: unknown): void {
  checkInputText([['template', template], ['data', data]]);
  checkOptionText(options, BIND_OPTIONS);
}

/** Check named operation arguments in order, then the named options. */
export function checkArgumentText(
  args: ReadonlyArray<readonly [string, unknown]>,
  options?: unknown,
  names: readonly string[] = [],
): void {
  checkInputText(args);
  checkOptionText(options, names);
}
