/** The compiled form template shape every template input must have (docs/spec/form-runtime.md). */

import { FormInputError } from '@polyspec/crudui-validator';

import type { FormTemplate } from './form';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Members with a defined value; an undefined member is an absent JSON member. */
const members = (value: Record<string, unknown>): string[] => Object.keys(value).filter(key => value[key] !== undefined);

const TEMPLATE_MEMBERS = new Set(['kind', 'keyPrefix', 'fields', 'buttons', 'action', 'description']);
const FIELD_MEMBERS = ['name', 'spec', 'children'];

function fieldShape(value: unknown): boolean {
  if (!object(value)) return false;
  const names = members(value);
  return names.length === FIELD_MEMBERS.length && FIELD_MEMBERS.every(name => names.includes(name))
    && typeof value.name === 'string' && object(value.spec)
    && Array.isArray(value.children) && value.children.every(fieldShape);
}

/**
 * Reject a value that is not exactly the shape `compileForm` produces: an object with the
 * template kind, a field list, a button object list, an optional string `keyPrefix`, an
 * optional object `action`, an optional `description` of any value and no other member; each field has exactly a string `name`,
 * an object `spec` and a field list `children`.
 */
export function checkFormTemplate(template: unknown): asserts template is FormTemplate {
  const valid = object(template)
    && members(template).every(name => TEMPLATE_MEMBERS.has(name))
    && template.kind === 'crudui/form-template'
    && Array.isArray(template.fields) && template.fields.every(fieldShape)
    && Array.isArray(template.buttons) && template.buttons.every(object)
    && (template.keyPrefix === undefined || typeof template.keyPrefix === 'string')
    && (template.action === undefined || object(template.action));
  if (!valid) throw new FormInputError('Unsupported form template');
}
