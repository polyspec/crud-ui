/**
 * React's server output is the byte reference for the HTML renderer, the C engine and the native
 * generators. The conformance tests compare normalized HTML, which hides a change in attribute
 * spelling or order; this test requires the exact bytes of the HTML renderer for every shared
 * form, list and detail case, so a byte change in either renderer fails here.
 */
import { describe, expect, test } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { renderDetail, renderForm, renderList } from '../server';
import {
  renderDetail as htmlDetail, renderForm as htmlForm, renderList as htmlList,
} from '@polyspec/crudui-generator-html';
import formCases from '../../../../legacy/tests/fixtures/form-render/cases.json';
import listCases from '../../../../legacy/tests/fixtures/list-render/cases.json';
import detailCases from '../../../../legacy/tests/fixtures/detail-render/cases.json';
import completeCases from '../../../../legacy/tests/fixtures/form-complete/cases.json';

interface Case { name: string; spec: unknown; expectError?: unknown; options?: Record<string, unknown> }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The cases of a fixture that render: no expected error, and an object as the specification. */
function valid<T extends Case>(cases: readonly T[]): Array<Omit<T, 'spec' | 'options'> & Required<Pick<Case, 'options'>> & { spec: Record<string, unknown> }> {
  return cases.flatMap((c) => !c.expectError && isRecord(c.spec) ? [{ ...c, spec: c.spec, options: c.options ?? {} }] : []);
}

/** `value` of the case `name`, an object as the renderers take it. */
function record(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${name}: a value of a rendered case is no object`);
  return value;
}

describe('React server output has the bytes of the HTML renderer', () => {
  test('structured condition widgets preserve quoted identifiers, values and affixes', () => {
    const field = `name'"<&>`;
    const spec = {
      type: 'group',
      properties: {
        when: {
          type: 'condition', design: { editor: 'structured' },
          options: { fields: [field] }, validate: { conditionTree: 'judge' },
          prepend: `Before'"<&>`, append: `After'"<&>`,
        },
      },
    };
    const data = { when: { all: [{ field, op: 'eq', value: `value'"<&>` }, { judge: `approve'"<&>` }] } };
    const form = createForm(compileForm(spec), data, { idPrefix: `scope'"<&>` });
    const html = htmlForm(form);
    expect(renderForm(form)).toBe(html);
    expect(html).toContain(`data-condition-for="scope'%22%3C%26%3E:when"`);
    expect(html).toContain(`Before'"&lt;&amp;&gt;`);
    expect(html).toContain(`value="approve'&quot;&lt;&amp;>">`);
  });

  for (const c of valid(formCases)) {
    test(`form ${c.name}`, () => {
      const form = createForm(compileForm(c.spec, c.options), record(c.data ?? {}, c.name), c.options);
      expect(renderForm(form)).toBe(htmlForm(form));
    });
  }
  for (const c of valid(completeCases)) {
    test(`complete form ${c.name}`, () => {
      const form = createForm(compileForm(c.spec), c.data, c.options);
      const render = record(c.render, c.name);
      expect(renderForm(form, render)).toBe(htmlForm(form, render));
    });
  }
  for (const c of valid(listCases)) {
    test(`list ${c.name}`, () => {
      const rows: unknown = c.rows ?? [];
      if (!Array.isArray(rows) || !rows.every(isRecord)) throw new Error(`${c.name}: the rows of a rendered case are no objects`);
      expect(renderList(c.spec, rows, c.options)).toBe(htmlList(c.spec, rows, c.options));
    });
  }
  for (const c of valid(detailCases)) {
    test(`detail ${c.name}`, () => {
      const detailRecord = record(c.record ?? {}, c.name);
      expect(renderDetail(c.spec, detailRecord, c.options)).toBe(htmlDetail(c.spec, detailRecord, c.options));
    });
  }
});
