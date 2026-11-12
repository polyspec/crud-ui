import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FormInputError } from '@polyspec/crudui-validator';
import { compileForm, createForm, decodeFormTemplate, FormTemplateError, type FormFieldTemplate } from './index';

const template = compileForm({
  type: 'group', properties: { name: { type: 'text' }, items: { type: 'group', multiple: true, properties: { title: { type: 'text' } } } },
});

/** `value` as a page embeds it and a client parses it: the JSON text read back. */
const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** The fields of the template with the field at `index` replaced by `change` of it. */
const fieldsWith = (index: number, change: (field: FormFieldTemplate) => unknown): unknown[] =>
  template.fields.map((field, at) => (at === index ? change(field) : field));

/** The JSON Pointer that decodeFormTemplate names for `value`, or undefined when it decodes. */
function pointerOf(value: unknown): string | undefined {
  try {
    decodeFormTemplate(asJson(value));
    return undefined;
  } catch (error) {
    if (!(error instanceof FormTemplateError)) throw error;
    return error.pointer;
  }
}

describe('decodeFormTemplate', () => {
  it('decodes the JSON of a compiled template into a template that createForm takes', () => {
    const decoded = decodeFormTemplate(asJson(template));
    expect(decoded).toStrictEqual(asJson(template));
    const data = { name: 'a', items: { r1: { title: 'b' } } };
    expect(createForm(decoded, data).getSnapshot().fields).toStrictEqual(createForm(template, data).getSnapshot().fields);
  });

  it('fails with the JSON Pointer of the invalid member', () => {
    expect(pointerOf('a template')).toBe('');
    expect(pointerOf({ ...template, kind: 'crudui/list' })).toBe('/kind');
    expect(pointerOf(Object.fromEntries(Object.entries(template).filter(([key]) => key !== 'buttons')))).toBe('/buttons');
    expect(pointerOf({ ...template, extra: true })).toBe('/extra');
    expect(pointerOf({ ...template, keyPrefix: 1 })).toBe('/keyPrefix');
    expect(pointerOf({ ...template, fields: fieldsWith(0, field => ({ ...field, spec: [] })) })).toBe('/fields/0/spec');
    const items = template.fields.findIndex(field => field.name === 'items');
    expect(items).toBeGreaterThanOrEqual(0);
    expect(pointerOf({ ...template, fields: fieldsWith(items, field => ({ ...field, children: [{ name: 2, spec: {}, children: [] }] })) }))
      .toBe(`/fields/${items}/children/0/name`);
    expect(pointerOf({ ...template, 'a/b~c': 1 })).toBe('/a~1b~0c');
  });

  it('loads no ajv and compiles no code at run time, so a Content-Security-Policy without unsafe-eval allows it', () => {
    for (const file of ['./decode-template.ts', './form-template-validator.mjs']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source, file).not.toMatch(/^import (?!type )[^;]*from 'ajv/m);
      expect(source, file).not.toMatch(/\bnew Function\b|\beval\(/);
    }
  });

  it('throws a FormInputError whose message names the pointer and the rule', () => {
    const decode = () => decodeFormTemplate(asJson({ ...template, fields: fieldsWith(0, field => ({ ...field, name: 3 })) }));
    expect(decode).toThrow(FormInputError);
    expect(decode).toThrow('Invalid form template at /fields/0/name: must be string');
  });
});
