import { expect, test } from 'vitest';
import {
  bindButtons, bindForm, compileForm, createForm, formDescription, formMessages,
  type CompileFormOptions, type CreateFormOptions,
} from '@polyspec/crudui-generator-core';
import { renderForm, renderFormView } from './index';
// @ts-expect-error shared JavaScript fixture normalizer
import { normalizeHtml } from '../../../tests/fixtures/form-render/normalize.mts';
import cases from '../../../tests/fixtures/form-render/cases.json';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

interface FixtureCase {
  name: string;
  spec: Record<string, unknown>;
  data?: Record<string, unknown>;
  options?: Record<string, unknown>;
  expected_html?: string;
  expectError?: { code: string; message: string };
}

const fixtures: FixtureCase[] = cases;

/** Run one fixture case and record renderForm evidence for the HTML renderer. */
function proves(name: string, body: () => void): Promise<void> {
  return provesConformance(
    { features: ['renderForm'], fixture: 'legacy/tests/fixtures/form-render/cases.json', runtime: 'javascript-html', case: name },
    body
  );
}

function renderFixture(item: FixtureCase): string {
  const compileOptions = (item.options ?? {}) as CompileFormOptions;
  const template = compileForm(item.spec, compileOptions);
  const formOptions = (item.options ?? {}) as CreateFormOptions;
  return renderForm(createForm(template, item.data ?? {}, formOptions));
}

/** Render a fixture from data bound with bindForm: bindForm, bindButtons and renderFormView. */
function renderFixtureView(item: FixtureCase): string {
  const template = compileForm(item.spec, item.options ?? {});
  const options = (item.options ?? {}) as NonNullable<Parameters<typeof bindForm>[2]> & { language?: string };
  const data = item.data ?? {};
  return renderFormView(bindForm(template, data, options), bindButtons(template, data, options), formMessages(options.language ?? 'ko'),
    undefined, formDescription(template, options));
}

// Each case is a top-level test named by the case, so the parity check reads every case of the unit by its name.
// A renderable case checks the stateless view, where bindForm gives missing repeated data its fixed row key, so every
// renderable case applies; then the framework-independent renderer, except multiple-leaf-empty-placeholder: a form instance
// gives missing repeated data a random row key, so that case's fixed bindForm key cannot match this public-instance path.
for (const item of fixtures.filter((fixture) => !fixture.expectError)) {
  test(item.name, () => proves(item.name, () => {
    expect(normalizeHtml(renderFixtureView(item))).toBe(item.expected_html);
    if (item.name !== 'multiple-leaf-empty-placeholder') {
      expect(normalizeHtml(renderFixture(item))).toBe(item.expected_html);
    }
  }));
}

// A load or registry failure is a surfaced error with the recorded code and message.
for (const item of fixtures.filter((fixture) => fixture.expectError)) {
  test(item.name, () => proves(item.name, () => {
    let thrown: unknown;
    try {
      renderFixture(item);
    } catch (error) {
      thrown = error;
    }
    expect(thrown, `${item.name} must throw`).toBeInstanceOf(Error);
    const raised = thrown instanceof Error && 'code' in thrown ? { code: thrown.code, message: thrown.message } : thrown;
    expect(raised).toEqual(item.expectError);
  }));
}
