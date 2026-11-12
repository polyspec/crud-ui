// @vitest-environment jsdom
/**
 * Shared form session scenarios over the HTML renderer's DOM binding.
 *
 * A page with the HTML renderer renders the session with `renderForm` and
 * `renderOutline`, connects the markup with `connectForm` and `connectOutline` from
 * @polyspec/crudui-generator-core, and on every change patches the new markup into the page with
 * `patchContent` and synchronizes the controls (tests/form-styles.test.mts mounts it the same
 * way in a browser). The React, Vue and Svelte
 * form tests run the same scenario modules over their components.
 */

import { expect, test } from 'vitest';
import {
  compileForm, connectForm, connectOutline, createForm, patchContent,
  type FormInstance,
} from '@polyspec/crudui-generator-core';
import { renderForm, renderOutline } from './index';
// @ts-expect-error Shared browser lifecycle across all renderers.
import { spec, data, exerciseSessionDom } from '../../../tests/fixtures/form-session/scenario.mts';
// @ts-expect-error Shared initialization comparison across all renderers.
import { compareInitialization, compareServerTakeover } from '../../../tests/fixtures/form-session/initialization.mts';
// @ts-expect-error Shared control assertions across all renderers.
import { controlSpec, exerciseControls } from '../../../tests/fixtures/form-session/controls.mts';
import { provesConformance } from '../../../../tests/conformance/evidence.mts';

const SESSION_FEATURES = ['connectForm', 'connectOutline', 'runAction', 'viewState', 'formHistory'];

/** Run one shared form session case and record javascript-dom evidence for the features it proves. */
function proves(fixture: string, name: string, features: string[], run: () => unknown) {
  return provesConformance(
    { features, fixture: `legacy/tests/fixtures/form-session/${fixture}`, runtime: 'javascript-dom', case: name },
    run
  );
}

/** Rendering is synchronous: a change has been rendered and synchronized when it returns. */
const flush = async () => {};

/**
 * Mount a session as a page with the HTML renderer does: render the form and its structure
 * map, connect both, and render and synchronize again on every change.
 */
function mount(session: FormInstance, element: HTMLElement) {
  const outline = document.createElement('div');
  document.body.append(element, outline);
  patchContent(element, renderForm(session));
  patchContent(outline, renderOutline(session));
  const connection = connectForm(element, session);
  const outlineConnection = connectOutline(outline, session, element);
  const unsubscribe = session.subscribe(() => {
    patchContent(element, renderForm(session));
    connection.sync();
    patchContent(outline, renderOutline(session));
  });
  return () => {
    unsubscribe();
    outlineConnection.disconnect();
    connection.disconnect();
    element.remove();
    outline.remove();
  };
}

test('renders identical DOM and control state with initial or repeatedly injected data', async () => {
  const template = compileForm(spec, { keyPrefix: 'form' });
  const initial = { session: createForm(template, data), element: document.createElement('form') };
  const deferred = { session: createForm(template), element: document.createElement('form') };
  const unmounts = [initial, deferred].map(({ session, element }) => mount(session, element));
  try {
    await proves('initialization.mts', 'compareServerTakeover', ['connectForm', 'patchContent'], () =>
      compareServerTakeover({ element: initial.element, session: initial.session, expect }));
    await proves('initialization.mts', 'compareInitialization', ['connectForm', 'patchContent'], () =>
      compareInitialization({ initial, deferred, expect, flush }));
  } finally {
    unmounts.forEach(unmount => unmount());
  }
});

test('runs the shared browser lifecycle over the connected HTML form', async () => {
  const session = createForm(compileForm(spec, { keyPrefix: 'form' }), {});
  const element = document.createElement('div');
  const unmount = mount(session, element);
  try {
    await proves('scenario.mts', 'exerciseSessionDom', SESSION_FEATURES, () =>
      exerciseSessionDom({ element, session, expect, flush }));
  } finally {
    unmount();
  }
});

test('connects labels and preserves multiple choice values through editing and submission', async () => {
  const form = createForm(compileForm(controlSpec), { enabled: 1, memo: 'Original', choices: ['a', 'c'] });
  const element = document.createElement('form');
  const unmount = mount(form, element);
  try {
    await proves('controls.mts', 'exerciseControls', ['connectForm'], () =>
      exerciseControls({ element, form, expect, flush }));
  } finally {
    unmount();
  }
});

// @ts-expect-error Shared data-only collection and visibility assertions across all renderers.
import { onlySpec, exerciseOnlyRows, visibilitySpec, visibilityData, exerciseHiddenValues } from '../../../tests/fixtures/form-session/data-rows.mts';

test('keeps a data-only collection to the rows of its data', async () => {
  const session = createForm(compileForm(onlySpec));
  const element = document.createElement('form');
  const unmount = mount(session, element);
  try {
    await proves('data-rows.mts', 'exerciseOnlyRows', ['connectForm'], () =>
      exerciseOnlyRows({ element, session, expect, flush }));
  } finally {
    unmount();
  }
});

// @ts-expect-error Shared group source assertions across all renderers.
import { sourceSpec, sourceData, exerciseGroupSource } from '../../../tests/fixtures/form-session/group-source.mts';

test('lists the choices of a group source from the rows of each change', async () => {
  const session = createForm(compileForm(sourceSpec), sourceData);
  const element = document.createElement('form');
  const unmount = mount(session, element);
  try {
    await proves('group-source.mts', 'exerciseGroupSource', ['connectForm'], () =>
      exerciseGroupSource({ element, session, expect, flush }));
  } finally {
    unmount();
  }
});

test('keeps the values of a group hidden by design.show', async () => {
  const session = createForm(compileForm(visibilitySpec), visibilityData);
  const element = document.createElement('form');
  const unmount = mount(session, element);
  try {
    await proves('data-rows.mts', 'exerciseHiddenValues', ['connectForm'], () =>
      exerciseHiddenValues({ element, session, expect, flush }));
  } finally {
    unmount();
  }
});

// @ts-expect-error Shared typing assertions across all renderers.
import { typingSpec, exerciseTyping, installWidgetHost } from '../../../tests/fixtures/form-session/typing.mts';

test('keeps the typed control node, its order and its caret', async () => {
  installWidgetHost(document);
  const form = createForm(compileForm(typingSpec));
  const element = document.createElement('form');
  const unmount = mount(form, element);
  try {
    await proves('typing.mts', 'exerciseTyping', ['connectForm', 'patchContent'], () =>
      exerciseTyping({ element, form, expect, flush }));
  } finally {
    unmount();
  }
});

test('connecting keeps values entered into the server markup before the connection', () => {
  const session = createForm(compileForm({
    type: 'group',
    properties: { email: { type: 'text' }, note: { type: 'textarea' }, kept: { type: 'text' } },
  }, { keyPrefix: 'form' }), { email: '', note: '', kept: 'server' });
  const element = document.createElement('div');
  element.innerHTML = renderForm(session);
  const email = element.querySelector('input[name="form[email]"]');
  const note = element.querySelector('textarea[name="form[note]"]');
  const kept = element.querySelector('input[name="form[kept]"]');
  if (!(email instanceof HTMLInputElement) || !(note instanceof HTMLTextAreaElement) || !(kept instanceof HTMLInputElement)) {
    throw new Error('the server markup has no email, note or kept control');
  }
  email.value = 'typed@example.test';
  note.value = 'typed note';
  const connection = connectForm(element, session);
  try {
    expect(email.value).toBe('typed@example.test');
    expect(note.value).toBe('typed note');
    expect(kept.value).toBe('server');
    expect(session.getValue('email')).toBe('typed@example.test');
    expect(session.getValue('note')).toBe('typed note');
    expect(session.getValue('kept')).toBe('server');
  } finally {
    connection.disconnect();
  }
});
