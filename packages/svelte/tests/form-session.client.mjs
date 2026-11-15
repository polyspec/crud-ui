import { mount, unmount, tick } from 'svelte';
import { expect, it } from 'vitest';
import { compileForm, createForm } from '@polyspec/crudui-generator-core';
import Form from '../src/components/Form.svelte';
import { spec, data, exerciseSessionDom } from '../../../tests/fixtures/form-session/scenario.mts';
import { compareInitialization, compareServerTakeover } from '../../../tests/fixtures/form-session/initialization.mts';
import { provesConformance } from '../../../tests/conformance/evidence.mts';

/** Run one shared form session case and record svelte evidence for the features it proves. */
function proves(fixture, name, features, run) {
  return provesConformance({ features, fixture: `tests/fixtures/form-session/${fixture}`, runtime: 'svelte', case: name }, run);
}
const SESSION_FEATURES = ['connectForm', 'connectOutline', 'runAction', 'viewState', 'formHistory'];

it('renders identical HTML and control state with initial or repeatedly injected data', async () => {
  const template = compileForm(spec, { keyPrefix: 'form' });
  const initial = { session: createForm(template, data), element: document.createElement('form') };
  const deferred = { session: createForm(template), element: document.createElement('form') };
  const apps = [initial, deferred].map(({ session, element }) => mount(Form, { target: element, props: { form: session } }));
  await tick();
  try {
    await proves('initialization.mts', 'compareServerTakeover', ['connectForm'], () =>
      compareServerTakeover({ element: initial.element, session: initial.session, expect }));
    await proves('initialization.mts', 'compareInitialization', ['connectForm'], () =>
      compareInitialization({ initial, deferred, expect, flush: tick }));
  }
  finally { await Promise.all(apps.map(app => unmount(app))); }
});

it('runs the shared browser lifecycle over a cached Svelte form', async () => {
  const session = createForm(compileForm(spec, { keyPrefix: 'form' }), {});
  const element = document.createElement('div');
  document.body.append(element);
  const app = mount(Form, { target: element, props: { form: session } });
  await tick();
  try {
    await proves('scenario.mts', 'exerciseSessionDom', SESSION_FEATURES, () =>
      exerciseSessionDom({ element, session, expect, flush: tick }));
  }
  finally { await unmount(app); element.remove(); }
});

it.each([
  { type: 'text', selector: 'input', values: ['c', 'co', 'con'], selection: true },
  { type: 'email', selector: 'input', values: ['name@one.test', 'name@two.test'] },
  { type: 'number', selector: 'input', values: ['1', '12', '123'] },
  { type: 'password', selector: 'input', values: ['s', 'se', 'sec'], selection: true },
  { type: 'textarea', selector: 'textarea', values: ['n', 'no', 'not'], selection: true },
  { type: 'date', selector: 'input', values: ['2026-09-10', '2026-09-11'] },
  { type: 'datetime', selector: 'input', values: ['2026-09-10T09:30', '2026-09-11T10:45'] },
])('preserves consecutive $type input across Svelte renders', async ({ type, selector, values, selection }) => {
  const form = createForm(compileForm({
    type: 'group',
    properties: { name: { type } },
  }));
  const element = document.createElement('form');
  document.body.append(element);
  const app = mount(Form, { target: element, props: { form } });
  await tick();
  try {
    const input = () => element.querySelector(`${selector}[name="name"]`);
    input().focus();
    const active = input();
    for (const [index, expected] of values.entries()) {
      active.value = expected;
      if (selection) active.setSelectionRange(expected.length, expected.length);
      active.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      expect(form.getValue('name')).toBe(expected);
      await tick();
      expect(input()).toBe(active);
      expect(input().value).toBe(expected);
      expect(document.activeElement).toBe(input());
      if (selection) expect(input().selectionStart).toBe(expected.length);
      expect(form.getSnapshot().revision).toBe(index + 1);
    }
    expect(new FormData(element).get('name')).toBe(values.at(-1));
  } finally { await unmount(app); element.remove(); }
});

import { controlSpec, exerciseControls } from '../../../tests/fixtures/form-session/controls.mts';
it('connects labels and preserves multiple choice values through editing and submission', async () => {
  const form = createForm(compileForm(controlSpec), { enabled: 1, memo: 'Original', choices: ['a', 'c'] });
  const element = document.createElement('form');
  document.body.append(element);
  const app = mount(Form, { target: element, props: { form } });
  await tick();
  try {
    await proves('controls.mts', 'exerciseControls', ['connectForm'], () =>
      exerciseControls({ element, form, expect, flush: tick }));
  }
  finally { await unmount(app); element.remove(); }
});

import { onlySpec, exerciseOnlyRows, visibilitySpec, visibilityData, exerciseHiddenValues } from '../../../tests/fixtures/form-session/data-rows.mts';
it('keeps a data-only collection to the rows of its data', async () => {
  const session = createForm(compileForm(onlySpec));
  const element = document.createElement('form');
  document.body.append(element);
  const app = mount(Form, { target: element, props: { form: session } });
  await tick();
  try {
    await proves('data-rows.mts', 'exerciseOnlyRows', ['connectForm'], () =>
      exerciseOnlyRows({ element, session, expect, flush: tick }));
  }
  finally { await unmount(app); element.remove(); }
});

it('keeps the values of a group hidden by design.show', async () => {
  const session = createForm(compileForm(visibilitySpec), visibilityData);
  const element = document.createElement('form');
  document.body.append(element);
  const app = mount(Form, { target: element, props: { form: session } });
  await tick();
  try {
    await proves('data-rows.mts', 'exerciseHiddenValues', ['connectForm'], () =>
      exerciseHiddenValues({ element, session, expect, flush: tick }));
  }
  finally { await unmount(app); element.remove(); }
});

import { typingSpec, exerciseTyping, installWidgetHost } from '../../../tests/fixtures/form-session/typing.mts';
it('keeps the typed control node, its order and its caret', async () => {
  installWidgetHost(document);
  const form = createForm(compileForm(typingSpec));
  const element = document.createElement('form');
  document.body.append(element);
  const app = mount(Form, { target: element, props: { form } });
  await tick();
  try {
    await proves('typing.mts', 'exerciseTyping', ['connectForm'], () =>
      exerciseTyping({ element, form, expect, flush: tick }));
  }
  finally { await unmount(app); element.remove(); }
});

import { sourceSpec, sourceData, exerciseGroupSource } from '../../../tests/fixtures/form-session/group-source.mts';
it('lists the choices of a group source from the rows of each change', async () => {
  const session = createForm(compileForm(sourceSpec), sourceData);
  const element = document.createElement('form');
  document.body.append(element);
  const app = mount(Form, { target: element, props: { form: session } });
  await tick();
  try {
    await proves('group-source.mts', 'exerciseGroupSource', ['connectForm'], () =>
      exerciseGroupSource({ element, session, expect, flush: tick }));
  }
  finally { await unmount(app); element.remove(); }
});
