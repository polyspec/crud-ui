/**
 * Structure map and data view conformance — HTML renderer against the React reference.
 *
 * legacy/tests/fixtures/form-outline/cases.json holds the normalized React markup of the
 * stateless structure map and data view. `renderOutlineView` and
 * `renderDataPanel` must reproduce it after the shared normalizer.
 */

import { expect, test } from 'vitest';
import { bindForm, compileForm, formMessages, type Language } from '@polyspec/crudui-generator-core';
// @ts-expect-error — shared JS normalizer (cross-framework).
import { normalizeHtml } from '../../../tests/fixtures/form-render/normalize.mts';
import { renderDataPanel, renderOutlineView } from './index';
import fixtureCases from '../../../tests/fixtures/form-outline/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

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

for (const c of cases) {
  test(c.name, () => provesConformance({
    features: ['buildOutline'], fixture: 'legacy/tests/fixtures/form-outline/cases.json', runtime: 'javascript-html', case: c.name,
  }, () => {
    const messages = formMessages(c.options.language);
    const fields = bindForm(compileForm(c.spec), c.data, { language: caseLanguage(c) });
    const state = { fields, canUndo: c.canUndo, canRedo: c.canRedo };
    expect(normalizeHtml(renderOutlineView(state, messages))).toBe(c.expected_outline_html);
    expect(normalizeHtml(renderDataPanel(c.data, messages))).toBe(c.expected_data_html);
  }));
}
