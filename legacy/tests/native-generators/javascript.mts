import { buffer } from 'node:stream/consumers';
import { pathToFileURL } from 'node:url';
import { compileForm, bindForm, bindButtons, formButtonsHtml, buildList, buildDetail, buildOutline, createForm, FormInputError, FormInstance } from '@polyspec/crudui-generator-core';
import * as react from '@polyspec/crudui-generator-react/server';
import * as html from '@polyspec/crudui-generator-html';
import type { ErrorRecord, FormState, JsonObject } from './protocol.mts';

/** The form, list and detail renderers of one JavaScript string renderer. */
export interface Renderer {
  renderForm: typeof react.renderForm;
  renderList: typeof react.renderList;
  renderDetail: typeof react.renderDetail;
}
/**
 * Calls the library function `fn` with the members of a request as JSON gave them: the library checks every input at run
 * time and throws FormInputError for one outside its contract, and that error is the response the protocol compares.
 */
const call = (fn: (...args: never[]) => unknown, ...args: unknown[]): unknown => Reflect.apply(fn, undefined, args);
type FormMethod = 'setData' | 'setValue' | 'addRow' | 'copyRow' | 'removeRow' | 'moveRow' | 'rekeyRow' | 'getValue' | 'getData';

const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
export function errorRecord(error: unknown): ErrorRecord {
  // A primitive has none of these members.
  const members: { code?: unknown; message?: unknown; at?: unknown; path?: unknown; trace?: unknown } = error !== null && typeof error === 'object' ? error : {};
  return { code: typeof members.code === 'string' ? members.code : 'INTERNAL_ERROR', message: String(members.message ?? error), at: typeof members.at === 'string' ? members.at : typeof members.path === 'string' ? members.path : Array.isArray(members.trace) ? members.trace.join('.') : '' };
}

/** Build the protocol dispatcher over one JavaScript string renderer's form, list and detail APIs. */
export function createDispatch({ renderForm, renderList, renderDetail }: Renderer): (request: unknown) => unknown {
  const state = (form: FormInstance): FormState => ({ data: form.getData(), fields: form.getSnapshot().fields, html: renderForm(form), revision: form.getSnapshot().revision });
  // JSON decides the type of each input: a specification and a template are objects.
  const spec = (value: unknown): JsonObject => { if (!object(value)) throw new FormInputError('A form spec must be a group with properties'); return value; };
  const template = (value: unknown): JsonObject => { if (!object(value)) throw new FormInputError('Unsupported form template'); return value; };
  // createForm returns a FormInstance for every input that it accepts.
  const instance = (value: unknown): FormInstance => { if (!(value instanceof FormInstance)) throw new Error('createForm returned no FormInstance'); return value; };
  return function dispatch(json: unknown): unknown {
    if (!object(json)) throw new FormInputError('Request must be an object');
    const request = json;
    if (own(request, 'options') && !object(request['options'])) throw new FormInputError('Options must be an object');
    if (own(request, 'data') && !object(request['data'])) throw new FormInputError('Form data must be an object');
    const { operation, data, options, rows } = request;
    switch (operation) {
      case 'compileForm': return call(compileForm, spec(request['spec']), options);
      case 'bindForm': return call(bindForm, template(request['template']), data, options);
      case 'bindButtons': return call(bindButtons, template(request['template']), data, options);
      case 'formButtonsHtml': return call(formButtonsHtml, request['buttons']);
      case 'renderList': return call(renderList, request['spec'], rows, options);
      case 'buildList': return call(buildList, request['spec'], rows, options);
      case 'buildOutline': return call(buildOutline, request['nodes']);
      case 'buildDetail':
      case 'renderDetail':
        // The library checks the record in rule order; an absent record is the empty object.
        return call(operation === 'buildDetail' ? buildDetail : renderDetail, request['spec'], own(request, 'record') ? request['record'] : {}, options);
      case 'renderForm':
        return call(renderForm, instance(call(createForm, template(request['template']), data, options)), own(request, 'render') ? request['render'] : {});
      case 'form': {
        const form = instance(call(createForm, template(request['template']), data, options));
        if (own(request, 'actions') && !Array.isArray(request['actions'])) throw new FormInputError('Actions must be an array');
        const methods = new Set<unknown>(['setData', 'setValue', 'addRow', 'copyRow', 'removeRow', 'moveRow', 'rekeyRow', 'getValue', 'getData']);
        const method = (value: unknown): value is FormMethod => methods.has(value);
        const steps = [];
        const actions: unknown[] = Array.isArray(request['actions']) ? request['actions'] : [];
        for (const action of actions) {
          let result: unknown = null, error: ErrorRecord | null = null;
          try {
            if (!object(action) || !method(action.method) || !Array.isArray(action.args)) throw new FormInputError('Invalid form action');
            // The library checks the arguments of each method at run time.
            result = Reflect.apply(form[action.method], form, action.args) ?? null;
          } catch (caught) { error = errorRecord(caught); }
          steps.push({ result, error, ...state(form) });
        }
        return { ...state(form), steps };
      }
      default: throw new FormInputError('Unknown generator operation');
    }
  };
}

// The string renderers' reference: React's server rendering. The HTML renderer must match it byte for byte.
export const dispatch = createDispatch(react);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const index = process.argv.indexOf('--renderer');
    const name = index === -1 ? 'react' : process.argv[index + 1];
    const renderers: Record<'react' | 'html', Renderer> = { react, html };
    const renderer = (value: string | undefined): value is keyof typeof renderers => value !== undefined && Object.hasOwn(renderers, value);
    if (!renderer(name)) throw new FormInputError('Unknown JavaScript renderer');
    const input = await buffer(process.stdin);
    let request: unknown;
    // Standard input that is not UTF-8 is not JSON text; it is never decoded with replacements.
    try { request = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input)); }
    catch (error) {
      const invalidEncoding = error instanceof TypeError && 'code' in error && error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA';
      if (!(error instanceof SyntaxError) && !invalidEncoding) throw error;
      throw new FormInputError('Request must be valid JSON');
    }
    process.stdout.write(`${JSON.stringify(createDispatch(renderers[name])(request))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ error: errorRecord(error) })}\n`);
    process.exitCode = 1;
  }
}
