/** Form buttons: the actions a spec declares with root `buttons`, rendered in the form footer. */

import { FormInputError } from '@polyspec/crudui-validator';

import { makeTranslate, type Language } from './content';
import { styleString } from './css';
import { resolveDesign } from './design';
import { makeContext } from './expr';
import type { FormTemplate } from './form';
import { formMessages } from './messages';
import { checkBindText } from './input-text';
import { checkFormTemplate } from './template-shape';
import { escAttr, escText, isRecord } from './util';

/** Button kinds a spec can declare. A `link` renders an anchor. */
export type FormButtonType = 'submit' | 'reset' | 'button' | 'link';

/** Declared button types, in documentation order. */
export const FORM_BUTTON_TYPES: readonly FormButtonType[] = ['submit', 'reset', 'button', 'link'];

/** The buttons of a form whose spec declares none: one submit button. */
export const DEFAULT_FORM_BUTTONS: readonly Readonly<Record<string, unknown>>[] = [{ type: 'submit' }];

/** One evaluated form button. */
export interface ButtonVM {
  /** Declared button type. */
  type: FormButtonType;
  /** Element name: `a` for a link, `button` otherwise. */
  tag: 'a' | 'button';
  /** Declared content, or the interface text of the button type. */
  text: string;
  /** Attributes in output order: type, class, style, name, value, href, onclick. */
  attrs: Record<string, string>;
}

/** Options for evaluating form buttons. */
export interface BindButtonsOptions {
  /** Content and interface language, defaulting to Korean. */
  language?: Language;
}

/** A behavior script: a string, or the `script` of a `{ label, script }` action. */
function behaviorScript(behavior: unknown, action: string): string | undefined {
  const entry = isRecord(behavior) ? behavior[action] : undefined;
  const script = isRecord(entry) ? entry.script : entry;
  return typeof script === 'string' && script !== '' ? script : undefined;
}

/**
 * Evaluate the template's buttons for a record. Text is the declared content or the
 * interface text named by the button type; design classes and styles follow the
 * field design rules against the record data.
 */
export function bindButtons(
  template: FormTemplate,
  data: Record<string, unknown> = {},
  options: BindButtonsOptions = {},
): ButtonVM[] {
  checkBindText(template, data, options);
  checkFormTemplate(template);
  const language = options.language ?? 'ko';
  const t = makeTranslate(language);
  const messages = formMessages(language);
  return template.buttons.map((spec): ButtonVM => {
    const type = FORM_BUTTON_TYPES.find(name => name === spec.type);
    if (type === undefined) throw new FormInputError(`Invalid button type: ${String(spec.type)}`);
    const design = resolveDesign(spec.design, makeContext([], data));
    const style = styleString(design.main.style);
    const optional = { name: spec.name, value: spec.value, href: spec.href, onclick: behaviorScript(spec.behavior, 'onclick') };
    return {
      type,
      tag: type === 'link' ? 'a' : 'button',
      text: t(spec.text, type === 'submit' || type === 'reset' ? messages[type] : undefined),
      attrs: {
        ...(type === 'link' ? {} : { type }),
        class: ['crudui-action', 'crudui-action--text', design.main.class].filter(Boolean).join(' '),
        ...(style ? { style } : {}),
        ...Object.fromEntries(Object.entries(optional).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      },
    };
  });
}

/** The attributes a button may carry, in output order. */
const BUTTON_ATTRIBUTES = new Set(['type', 'class', 'style', 'name', 'value', 'href', 'onclick']);

/**
 * Markup of the form buttons. Every renderer inserts this one string into the footer controls
 * group. The buttons are evaluated buttons: a list of objects whose `tag` is `a` or `button`,
 * whose `text` is a string and whose `attrs` holds string values of the button attributes.
 */
export function formButtonsHtml(buttons: readonly ButtonVM[]): string {
  if (!Array.isArray(buttons)) throw new FormInputError('Form buttons must be a list');
  for (const button of buttons as unknown[]) {
    const evaluated = isRecord(button) && (button.tag === 'a' || button.tag === 'button') && typeof button.text === 'string'
      && isRecord(button.attrs) && Object.entries(button.attrs).every(([name, value]) => BUTTON_ATTRIBUTES.has(name) && typeof value === 'string');
    if (!evaluated) throw new FormInputError('Form buttons must be evaluated button objects');
  }
  return (buttons as readonly ButtonVM[]).map(button =>
    `<${button.tag}${Object.entries(button.attrs).map(([name, value]) => ` ${name}="${escAttr(value)}"`).join('')}>` +
    `${escText(button.text)}</${button.tag}>`).join('');
}
