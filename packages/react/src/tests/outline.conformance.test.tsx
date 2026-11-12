/**
 * Structure map and data view conformance — React reference verification.
 *
 * tests/fixtures/form-outline/cases.json holds the normalized static markup of
 * `OutlineView` and `DataPanel`. This test re-renders both components for each
 * case so the fixture stays the React output; the HTML, Vue and Svelte renderers
 * load the same file.
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { bindForm, compileForm, formMessages, type Language } from '@polyspec/crudui-generator-core';
import { DataPanel, OutlineView } from '../index';
import { normalizeHtml } from '../../../../legacy/tests/fixtures/form-render/normalize.mts';
import fixtureCases from '../../../../legacy/tests/fixtures/form-outline/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

/** Run one fixture case and record buildOutline evidence for it. */
function proves(name: string, body: () => unknown): Promise<unknown> {
  return provesConformance(
    { features: ['buildOutline'], fixture: 'legacy/tests/fixtures/form-outline/cases.json', runtime: 'react', case: name },
    body
  );
}

interface OutlineCase {
  name: string;
  spec: Record<string, unknown>;
  data: Record<string, unknown>;
  options: { language: string };
  canUndo: boolean;
  canRedo: boolean;
  expected_outline_html: string;
  expected_data_html: string;
}

const cases: OutlineCase[] = fixtureCases;

/** The language of the options of a case, one that the generator has messages for. */
function caseLanguage(c: OutlineCase): Language {
  const { language } = c.options;
  if (language === 'ko' || language === 'en' || language === 'ja' || language === 'zh') return language;
  throw new Error(`${c.name}: no language of the generator: ${language}`);
}

describe('structure map and data view: React reproduces the fixture', () => {
  for (const c of cases) {
    test(c.name, () => proves(c.name, () => {
      const messages = formMessages(c.options.language);
      const fields = bindForm(compileForm(c.spec), c.data, { language: caseLanguage(c) });
      const state = { fields, canUndo: c.canUndo, canRedo: c.canRedo };
      expect(normalizeHtml(renderToStaticMarkup(<OutlineView state={state} messages={messages} />))).toBe(c.expected_outline_html);
      expect(normalizeHtml(renderToStaticMarkup(<DataPanel data={c.data} messages={messages} />))).toBe(c.expected_data_html);
    }));
  }
});
