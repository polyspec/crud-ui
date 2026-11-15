import React from 'react';
import { act, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import { Form } from '../components/Form';
import { spec, data, exerciseSessionDom } from '../../../../tests/fixtures/form-session/scenario.mts';
import { compareInitialization, compareServerTakeover } from '../../../../tests/fixtures/form-session/initialization.mts';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

/** Run one shared form session case and record react evidence for the features it proves. */
function proves(fixture: string, name: string, features: string[], run: () => unknown) {
  return provesConformance({ features, fixture: `tests/fixtures/form-session/${fixture}`, runtime: 'react', case: name }, run);
}
const SESSION_FEATURES = ['connectForm', 'connectOutline', 'runAction', 'viewState', 'formHistory'];

it('renders identical HTML and control state with initial or repeatedly injected data', async () => {
  const template = compileForm(spec, { keyPrefix: 'form' });
  const initial = { session: createForm(template, data), element: document.createElement('form') };
  const deferred = { session: createForm(template), element: document.createElement('form') };
  const first = render(<Form form={initial.session} />, { container: initial.element });
  const second = render(<Form form={deferred.session} />, { container: deferred.element });
  try {
    await proves('initialization.mts', 'compareServerTakeover', ['connectForm'], () =>
      compareServerTakeover({ element: initial.element, session: initial.session, expect }));
    await act(async () => {
      await proves('initialization.mts', 'compareInitialization', ['connectForm'], () =>
        compareInitialization({ initial, deferred, expect, flush: async () => { await act(async () => {}); } }));
    });
  } finally { first.unmount(); second.unmount(); }
});

it('injects into a mounted cached form, edits, copies, sorts, rekeys, deletes and adds', async () => {
  const session = createForm(compileForm(spec, { keyPrefix: 'form' }), {});
  const { container } = render(<Form form={session} />);
  await act(async () => {
    await proves('scenario.mts', 'exerciseSessionDom', SESSION_FEATURES, () =>
      exerciseSessionDom({ element: container, session, expect, flush: async () => { await act(async () => {}); } }));
  });
});

import { controlSpec, exerciseControls } from '../../../../tests/fixtures/form-session/controls.mts';
it('connects labels and preserves multiple choice values through editing and submission', async () => {
  const form = createForm(compileForm(controlSpec), { enabled: 1, memo: 'Original', choices: ['a', 'c'] });
  const element = document.createElement('form');
  document.body.append(element);
  const view = render(<Form form={form} />, { container: element });
  try {
    await act(async () => {
      await proves('controls.mts', 'exerciseControls', ['connectForm'], () =>
        exerciseControls({ element, form, expect, flush: async () => { await act(async () => {}); } }));
    });
  } finally { view.unmount(); element.remove(); }
});

import { onlySpec, exerciseOnlyRows, visibilitySpec, visibilityData, exerciseHiddenValues } from '../../../../tests/fixtures/form-session/data-rows.mts';
it('keeps a data-only collection to the rows of its data', async () => {
  const session = createForm(compileForm(onlySpec));
  const element = document.createElement('form');
  document.body.append(element);
  const view = render(<Form form={session} />, { container: element });
  try {
    await act(async () => {
      await proves('data-rows.mts', 'exerciseOnlyRows', ['connectForm'], () =>
        exerciseOnlyRows({ element, session, expect, flush: async () => { await act(async () => {}); } }));
    });
  } finally { view.unmount(); element.remove(); }
});

it('keeps the values of a group hidden by design.show', async () => {
  const session = createForm(compileForm(visibilitySpec), visibilityData);
  const element = document.createElement('form');
  document.body.append(element);
  const view = render(<Form form={session} />, { container: element });
  try {
    await act(async () => {
      await proves('data-rows.mts', 'exerciseHiddenValues', ['connectForm'], () =>
        exerciseHiddenValues({ element, session, expect, flush: async () => { await act(async () => {}); } }));
    });
  } finally { view.unmount(); element.remove(); }
});

import { sourceSpec, sourceData, exerciseGroupSource } from '../../../../tests/fixtures/form-session/group-source.mts';
it('lists the choices of a group source from the rows of each change', async () => {
  const session = createForm(compileForm(sourceSpec), sourceData);
  const element = document.createElement('form');
  document.body.append(element);
  const view = render(<Form form={session} />, { container: element });
  try {
    await act(async () => {
      await proves('group-source.mts', 'exerciseGroupSource', ['connectForm'], () =>
        exerciseGroupSource({ element, session, expect, flush: async () => { await act(async () => {}); } }));
    });
  } finally { view.unmount(); element.remove(); }
});

import { typingSpec, exerciseTyping, installWidgetHost } from '../../../../tests/fixtures/form-session/typing.mts';
it('keeps the typed control node, its order and its caret', async () => {
  installWidgetHost(document);
  const form = createForm(compileForm(typingSpec));
  const element = document.createElement('form');
  document.body.append(element);
  const view = render(<Form form={form} />, { container: element });
  try {
    await act(async () => {
      await proves('typing.mts', 'exerciseTyping', ['connectForm'], () =>
        exerciseTyping({ element, form, expect, flush: async () => { await act(async () => {}); } }));
    });
  } finally { view.unmount(); element.remove(); }
});
