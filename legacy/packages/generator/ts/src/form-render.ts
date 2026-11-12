/**
 * Render options of a complete form (form-runtime.md, "Complete form"): the form element,
 * the hidden fields, form errors and node errors. Every renderer reads the
 * model this module builds, so each one checks the options and places errors the same way.
 */

import { FormInputError } from '@polyspec/crudui-validator';
import type { NodeVM } from './viewmodel';
import { isRecord, pointerToken, sanitizeUrl } from './util';

/** The submission target of the form element; each member overrides the template's `action`. */
export interface FormRenderAction {
  /** Form method. */
  method?: string;
  /** Form action URL. */
  url?: string;
  /** Form encoding type. */
  enctype?: string;
}

/** One error of a node: a validation result error is accepted unchanged. */
export interface FormRenderError {
  /** Data path of the node; a row's path is its collection path, `.` and its key. */
  path: string;
  /** Message text shown under the node. */
  message: string;
}

/** Options of `renderForm` and of the framework `Form` components. */
export interface FormRenderOptions {
  /** Writes a `form` element with this target. */
  action?: FormRenderAction;
  /** Hidden inputs written inside the form element, in member order; requires `action`. */
  hidden?: Record<string, string>;
  /** Errors of the whole form, written before the form body. */
  formErrors?: string[];
  /** Errors of nodes, written in the errors slot of the node of each path. */
  errors?: FormRenderError[];
}

/** The attributes of the form element, in the order React writes them. */
export interface FormElementAttributes {
  action?: string;
  encType?: string;
  method?: string;
}

/** Checked render options as the renderers use them. */
export interface FormRenderModel {
  /** Form element attributes; absent without `action`. */
  form?: FormElementAttributes;
  /** Hidden inputs as name and value pairs. */
  hidden: Array<[string, string]>;
  /** Form error texts. */
  formErrors: string[];
  /** Error texts of each node that has errors. */
  nodeErrors: Map<NodeVM, string[]>;
}

const MEMBERS = new Set(['action', 'hidden', 'formErrors', 'errors']);
const ACTION_MEMBERS = new Set(['method', 'url', 'enctype']);

/** Whether a value is an object of strings. */
function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((text) => typeof text === 'string');
}

/** Whether a value is a form action: an object of strings named method, url or enctype. */
function isRenderAction(value: unknown): value is FormRenderAction {
  return isStringRecord(value) && Object.keys(value).every((key) => ACTION_MEMBERS.has(key));
}

/** Whether a value is a node error: an object with a string path and message. */
function isRenderError(value: unknown): value is FormRenderError {
  return isRecord(value) && typeof value.path === 'string' && typeof value.message === 'string';
}


/** Every node with a data path, by that path: a row's path is its collection path, `.` and its key. */
function nodesByPath(nodes: readonly NodeVM[], parent: string | undefined, out: Map<string, NodeVM>): Map<string, NodeVM> {
  for (const node of nodes) {
    const path = node.kind === 'row' ? `${parent}.${node.key}` : node.kind === 'lang-item' ? undefined : node.path;
    if (path !== undefined) out.set(path, node);
    nodesByPath(node.children ?? [], path, out);
  }
  return out;
}

/**
 * The error of {@link decodeFormRenderOptions} and of the renderers for render options outside the contract of
 * form-runtime.md: a `FormInputError` with the code `INVALID_FORM_INPUT` and the message of that contract.
 */
export class FormRenderOptionsError extends FormInputError {
  /** The JSON Pointer (RFC 6901) of the invalid member of the options; the empty string is the options themselves. */
  readonly pointer: string;

  constructor(pointer: string, message: string) {
    super(message);
    this.name = 'FormRenderOptionsError';
    this.pointer = pointer;
    Object.setPrototypeOf(this, FormRenderOptionsError.prototype);
  }
}

/** Whether a value is a list of strings. */
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((text) => typeof text === 'string');

/** Whether a value is a list of node errors. */
const isErrorList = (value: unknown): value is FormRenderError[] => Array.isArray(value) && value.every(isRenderError);

/** The JSON Pointer of the list `name` of options, or of its first item that `valid` refuses. */
function listPointer(name: string, value: unknown, valid: (item: unknown) => boolean): string {
  const at = Array.isArray(value) ? value.findIndex((item) => !valid(item)) : -1;
  return at < 0 ? `/${name}` : `/${name}/${at}`;
}

/**
 * Decode render options, such as the options that a server wrote into a page with `JSON.stringify` and a client read
 * back with `JSON.parse`, into the {@link FormRenderOptions} of `renderForm` and the framework `Form` components. It is
 * the check that every renderer runs on its options before it places the errors on the nodes of the form.
 *
 * @param value - The parsed options.
 * @returns The members of the value as render options; a node error keeps its other members, such as those of a
 *   validation result error.
 * @throws {@link FormRenderOptionsError} for the first option outside the contract, in the documented order, with the
 *   JSON Pointer of that member.
 */
export function decodeFormRenderOptions(value: unknown): FormRenderOptions {
  if (!isRecord(value)) throw new FormRenderOptionsError('', 'Render options must be an object');
  for (const name of Object.keys(value)) {
    if (!MEMBERS.has(name)) throw new FormRenderOptionsError(`/${pointerToken(name)}`, `Unknown render option: ${name}`);
  }
  const { action, hidden, formErrors, errors } = value;
  if (action !== undefined && !isRenderAction(action)) {
    throw new FormRenderOptionsError('/action', 'action must be an object with string method, url and enctype');
  }
  if (hidden !== undefined && !isStringRecord(hidden)) throw new FormRenderOptionsError('/hidden', 'hidden must be an object of strings');
  if (hidden !== undefined && action === undefined) throw new FormRenderOptionsError('/hidden', 'hidden requires action');
  if (formErrors !== undefined && !isStringList(formErrors)) {
    throw new FormRenderOptionsError(listPointer('formErrors', formErrors, (text) => typeof text === 'string'), 'formErrors must be a list of strings');
  }
  if (errors !== undefined && !isErrorList(errors)) {
    throw new FormRenderOptionsError(listPointer('errors', errors, isRenderError), 'errors must be a list of objects with string path and message');
  }
  return {
    ...(action !== undefined ? { action } : {}),
    ...(hidden !== undefined ? { hidden } : {}),
    ...(isStringList(formErrors) ? { formErrors } : {}),
    ...(isErrorList(errors) ? { errors } : {}),
  };
}

/**
 * Check render options and build the model the renderers write.
 *
 * @throws {@link FormRenderOptionsError} for the first option outside the contract, in the documented order
 *   ({@link decodeFormRenderOptions}), and a `FormInputError` for an error whose path names no node.
 */
export function formRenderModel(
  fields: readonly NodeVM[],
  templateAction: Readonly<Record<string, unknown>> | undefined,
  options: unknown = {},
): FormRenderModel {
  const { action, hidden, formErrors, errors } = decodeFormRenderOptions(options);
  const nodeErrors = new Map<NodeVM, string[]>();
  if (errors !== undefined && errors.length) {
    const byPath = nodesByPath(fields, undefined, new Map());
    for (const { path, message } of errors) {
      const node = byPath.get(path);
      if (!node) throw new FormInputError(`Unknown error path: ${path}`);
      nodeErrors.set(node, [...(nodeErrors.get(node) ?? []), message]);
    }
  }
  let form: FormElementAttributes | undefined;
  if (action !== undefined) {
    const own = action;
    const declared = (key: keyof FormRenderAction): string | undefined => {
      const value = own[key] ?? templateAction?.[key];
      return typeof value === 'string' ? value : undefined;
    };
    const url = declared('url');
    const encType = declared('enctype');
    const method = declared('method');
    form = {
      ...(url !== undefined ? { action: sanitizeUrl(url) } : {}),
      ...(encType !== undefined ? { encType } : {}),
      ...(method !== undefined ? { method } : {}),
    };
  }
  return {
    ...(form ? { form } : {}),
    hidden: hidden === undefined ? [] : Object.entries(hidden),
    formErrors: formErrors ?? [],
    nodeErrors,
  };
}
