/** Runtime interface text shared by every renderer and implementation. */

import { FormInputError } from '@polyspec/crudui-validator';
import type { Language } from './content';
import { FORM_MESSAGES } from './interface-messages';

/** Supported interface languages, in declaration order. */
const LANGUAGES: readonly Language[] = ['ko', 'en', 'ja', 'zh'];

/** Interface labels for row, collection and form controls. `{count}` is replaced by a number. */
export interface FormMessages {
  /** Move a row up. */
  moveUp: string;
  /** Move a row down. */
  moveDown: string;
  /** Add a row. */
  addRow: string;
  /** Copy a row. */
  copyRow: string;
  /** Remove a row. */
  removeRow: string;
  /** Expand or collapse a row. */
  toggleRow: string;
  /** Expand every row. */
  expandAll: string;
  /** Collapse every row. */
  collapseAll: string;
  /** Undo the last change. */
  undo: string;
  /** Redo the last undone change. */
  redo: string;
  /** Accessible name of a row's controls. */
  rowControls: string;
  /** Accessible name of an empty collection's controls. */
  collectionControls: string;
  /** Accessible name of the form controls. */
  formControls: string;
  /** Accessible name of the form buttons in the form footer. */
  formActions: string;
  /** Default text of a submit button. */
  submit: string;
  /** Default text of a reset button. */
  reset: string;
  /** Structure map heading. */
  outline: string;
  /** Current data heading. */
  data: string;
  /** Row title when the title field is empty. */
  untitled: string;
  /** Collapsed row summary without nested collections. */
  collapsed: string;
  /** Collection row count. */
  count: string;
  /** Collapsed row summary with nested rows. */
  children: string;
  /** Accessible name of the mode select of a condition group. */
  conditionMode: string;
  /** Add a field comparison to a condition group. */
  conditionAddComparison: string;
  /** Add a nested group to a condition group. */
  conditionAddGroup: string;
  /** Add a judged text to a condition group. */
  conditionAddJudge: string;
  /** Remove a condition from its group. */
  conditionRemove: string;
  /** Error of a value that the structured editor does not show; `{path}` is the data path of the field. */
  conditionInvalid: string;
}


// The generated tables must hold every FormMessages key; the type checker enforces it.
const MESSAGES: Readonly<Record<Language, FormMessages>> = FORM_MESSAGES;

/** Return the interface text for a supported language. */
export function formMessages(language: string): FormMessages {
  // Callers can pass decoded JSON; a non-string is rejected before any text conversion.
  if (typeof language !== 'string') throw new FormInputError('Language must be a string');
  const supported = LANGUAGES.find(name => name === language);
  if (supported === undefined) {
    throw new FormInputError(`Unsupported language: ${language}`);
  }
  return MESSAGES[supported];
}

/** Replace `{count}` in a counted message. */
export function formatCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}
