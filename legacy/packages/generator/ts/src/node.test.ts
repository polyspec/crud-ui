import { describe, expect, it } from 'vitest';
import {
  bindButtons,
  bindForm,
  buildOutline,
  compileForm,
  createForm,
  emptyHistory,
  formButtonsHtml,
  formMessages,
  initialView,
  recordChange,
  rekeyRowView,
  removeRowView,
  runAction,
  setAllExpandedView,
  toggleRowView,
  undoChange,
  redoChange,
  canRedo,
  type NodeVM,
} from './index';
import { HISTORY_LIMIT } from './history';
import { childrenOf, keysOf, present } from './test-support';

const k1 = '__0000000000001__';
const k2 = '__0000000000002__';

const spec = {
  type: 'group',
  properties: {
    teams: {
      type: 'group',
      label: 'Team',
      multiple: { min: 1, max: 2, sortable: true, copy: true, title: 'name', header: 'sticky' },
      properties: {
        name: { type: 'text', label: 'Name' },
        members: { type: 'text', label: 'Member', multiple: { controls: 'footer' } },
      },
    },
  },
};

const data = {
  teams: {
    [k1]: { name: 'Sales', members: { [k1]: 'Kim', [k2]: 'Lee' } },
    [k2]: { name: '', members: {} },
  },
};

function actions(node: NodeVM) {
  return present(node.controls, 'the row controls').actions.map(action => [action.name, action.disabled]);
}

describe('node grammar view model', () => {
  const [teams] = bindForm(compileForm(spec), data, { language: 'en' });
  const [first, second] = childrenOf(teams);

  it('describes collections and rows with numbers, titles, counts and summaries', () => {
    expect(teams).toMatchObject({ kind: 'collection', path: 'teams', item: 'group', header: { label: 'Team', count: 'Rows: 2' } });
    expect(first).toMatchObject({
      kind: 'row', key: k1, collapsible: true, expanded: true, sticky: true, stickyDepth: 0,
      header: { label: 'Team', number: '1', title: 'Sales', summary: 'Nested rows: 2' },
      body: { id: `crudui:teams.${k1}:body` },
    });
    expect(second.header).toMatchObject({ number: '2', title: '(untitled)', summary: 'Nested rows: 0' });
    const members = present(childrenOf(first).find(child => child.kind === 'collection'), 'the members collection');
    expect(childrenOf(members).map(row => [row.header?.number, row.collapsible, row.controls?.placement]))
      .toEqual([['1.1', undefined, 'footer'], ['1.2', undefined, 'footer']]);
  });

  it('computes control order and disabled states from limits and position', () => {
    expect(actions(first)).toEqual([
      ['move-up', true], ['move-down', false], ['add-row', true], ['copy-row', true], ['remove-row', false],
    ]);
    expect(actions(second)).toEqual([
      ['move-up', false], ['move-down', true], ['add-row', true], ['copy-row', true], ['remove-row', false],
    ]);
    const emptyMembers = present(childrenOf(second).find(child => child.kind === 'collection'), 'the members collection');
    expect(emptyMembers.controls).toEqual({
      placement: 'footer', label: 'Collection controls', actions: [{ name: 'add-row', label: 'Add', disabled: false }],
    });
  });

  it('renders collapsed rows from the collapsed option', () => {
    const [collapsed] = bindForm(compileForm(spec), data, { collapsed: new Set([`teams.${k1}`]) });
    expect(childrenOf(collapsed).map(row => row.expanded)).toEqual([false, true]);
  });

  it('marks hidden nodes and omits empty headers', () => {
    const template = compileForm({ type: 'group', properties: {
      secret: { type: 'hidden' },
      note: { type: 'text', design: { show: false } },
    } });
    const [secret, note] = bindForm(template, {});
    expect(secret.header).toBeUndefined();
    expect(note.hidden).toBe(true);
  });
});

describe('interface messages', () => {
  it('supports ko, en, ja and zh and rejects other languages', () => {
    for (const language of ['ko', 'en', 'ja', 'zh']) expect(formMessages(language).addRow).toBeTruthy();
    expect(() => formMessages('fr')).toThrow('Unsupported language: fr');
    // @ts-expect-error: fr is no Language; bindForm checks the language at run time.
    expect(() => bindForm(compileForm(spec), data, { language: 'fr' })).toThrow('Unsupported language: fr');
    expect(() => formMessages('')).toThrow('Unsupported language: ');
    for (const language of [5, true, ['ko'], { ko: 1 }]) {
      // @ts-expect-error: a value that is no string is no Language; bindForm checks it at run time.
      expect(() => bindForm(compileForm(spec), data, { language: language })).toThrow('Language must be a string');
    }
    for (const name of ['keyPrefix', 'idPrefix']) {
      // @ts-expect-error: a number is no Language and no prefix; bindForm checks the options at run time.
      expect(() => bindForm(compileForm(spec), data, { language: 5, [name]: 5 })).toThrow('Language must be a string');
      // @ts-expect-error: fr is no Language and a number is no prefix; bindForm checks the options at run time.
      expect(() => bindForm(compileForm(spec), data, { language: 'fr', [name]: 5 })).toThrow(`${name} must be a string`);
    }
    for (const unsupported of [true, 'other']) {
      // @ts-expect-error: fr is no Language and the value is no UnsupportedMode; bindForm checks the options at run time.
      expect(() => bindForm(compileForm(spec), data, { language: 'fr', keyPrefix: 'p', unsupported }))
        .toThrow('unsupported must be throw or marker');
    }
  });
});

describe('multiple layout declarations', () => {
  const compile = (field: Record<string, unknown>) => () => compileForm({ type: 'group', properties: { rows: field } });
  it('rejects titles, control placements and header modes with wrong values', () => {
    expect(compile({ type: 'text', multiple: { title: 'name' } }))
      .toThrow('Invalid multiple.title at rows: expected a repeated group');
    for (const title of ['missing', 'children', 'labels', 3]) {
      expect(compile({ type: 'group', multiple: { title }, properties: {
        name: { type: 'text' },
        children: { type: 'text', multiple: true },
        labels: { type: 'text', lang: true },
      } })).toThrow('Invalid multiple.title at rows: expected the name of a direct child field without multiple, properties or lang');
    }
    expect(compile({ type: 'text', multiple: { controls: 'side' } }))
      .toThrow('Invalid multiple.controls at rows: expected header, footer or outline');
    expect(compile({ type: 'text', multiple: { header: 'fixed' } }))
      .toThrow('Invalid multiple.header at rows: expected static or sticky');
    for (const lang of [null, 'ko', ['ko']]) {
      expect(compile({ type: 'text', lang })).toThrow('Invalid lang at rows: expected a boolean or an object');
    }
    for (const only of ['ko', null, ['ko', 3]]) {
      expect(compile({ type: 'text', lang: { only } }))
        .toThrow('Invalid lang.only at rows: expected a list of language codes or an object');
    }
    expect(compile({ type: 'text', lang: { only: ['ko', 'en'] } })).not.toThrow();
    expect(compile({ type: 'text', multiple: 'yes', lang: null }))
      .toThrow('Invalid multiple at rows: expected a boolean, only or an object');
  });
});

describe('instance view state and undo', () => {
  it('toggles, collapses and expands rows without changing data or revision', () => {
    const form = createForm(compileForm(spec), data);
    const { revision } = form.getSnapshot();
    form.toggleRow('teams', k1);
    expect(childrenOf(form.getSnapshot().fields[0]).map(row => row.expanded)).toEqual([false, true]);
    form.setAllExpanded(false);
    expect(childrenOf(form.getSnapshot().fields[0]).map(row => row.expanded)).toEqual([false, false]);
    form.setAllExpanded(true);
    expect(childrenOf(form.getSnapshot().fields[0]).map(row => row.expanded)).toEqual([true, true]);
    expect(form.getSnapshot().revision).toBe(revision);
    expect(form.getData()).toEqual(data);
  });

  it('merges consecutive edits of one path into one undo entry', () => {
    const form = createForm(compileForm(spec), data);
    expect(form.getSnapshot().canUndo).toBe(false);
    form.setValue(`teams.${k1}.name`, 'S');
    form.setValue(`teams.${k1}.name`, 'Sa');
    form.setValue(`teams.${k2}.name`, 'Ops');
    expect(form.getSnapshot().canUndo).toBe(true);
    form.undo();
    expect(form.getValue(`teams.${k2}.name`)).toBe('');
    expect(form.getValue(`teams.${k1}.name`)).toBe('Sa');
    form.undo();
    expect(form.getValue(`teams.${k1}.name`)).toBe('Sales');
    expect(form.getSnapshot().canUndo).toBe(false);
    expect(() => form.undo()).toThrow('Nothing to undo');
  });

  it('redoes an undone change and clears redo after a new change', () => {
    const form = createForm(compileForm(spec), data);
    const path = `teams.${k1}.name`;
    form.setValue(path, 'Sales team');
    form.undo();
    expect(form.getSnapshot().canRedo).toBe(true);
    expect(form.getValue(path)).toBe('Sales');
    form.redo();
    expect(form.getValue(path)).toBe('Sales team');
    expect(form.getSnapshot().canUndo).toBe(true);
    expect(form.getSnapshot().canRedo).toBe(false);
    form.undo();
    form.setValue(path, 'Revenue');
    expect(form.getSnapshot().canRedo).toBe(false);
    expect(() => form.redo()).toThrow('Nothing to redo');
  });

  it('restarts history and view state when the record is replaced', () => {
    const form = createForm(compileForm(spec), data);
    form.removeRow(`teams.${k1}.members`, k2);
    form.toggleRow('teams', k1);
    form.setData(data);
    const snapshot = form.getSnapshot();
    expect(snapshot.canUndo).toBe(false);
    expect(childrenOf(snapshot.fields[0]).map(row => row.expanded)).toEqual([true, true]);
  });

  it('keeps view state attached to rows through removal and rekeying', () => {
    const form = createForm(compileForm(spec), data);
    form.toggleRow('teams', k2);
    form.rekeyRow('teams', k2, '__0000000000042__');
    expect(childrenOf(form.getSnapshot().fields[0])[1].expanded).toBe(false);
    form.removeRow('teams', '__0000000000042__');
    form.undo();
    expect(childrenOf(form.getSnapshot().fields[0])[1].expanded).toBe(true);
  });
});

describe('structure map and actions', () => {
  it('maps rows only, nested as in the form', () => {
    const form = createForm(compileForm(spec), data, { language: 'en' });
    const rows = buildOutline(form.getSnapshot().fields);
    expect(rows.map(row => [row.path, row.number, row.title])).toEqual([
      ['teams', '1', 'Sales'], ['teams', '2', '(untitled)'],
    ]);
    expect(rows[0].rows.map(row => [row.path, row.number])).toEqual([[`teams.${k1}.members`, '1.1'], [`teams.${k1}.members`, '1.2']]);
    expect(rows[1].rows).toEqual([]);
  });

  it('runs resolved actions against the instance', () => {
    const form = createForm(compileForm(spec), { teams: { [k1]: { name: 'Sales', members: {} } } });
    const members = `teams.${k1}.members`;
    const added = runAction(form, { name: 'add-row', path: members });
    const [member] = keysOf(form.getValue(members), members);
    expect(added).toEqual({ focus: { path: members, key: member } });
    expect(runAction(form, { name: 'remove-row', path: 'teams' })).toBeUndefined();
    expect(runAction(form, { name: 'toggle-row', path: 'teams', key: k1 })).toEqual({});
    expect(childrenOf(form.getSnapshot().fields[0])[0].expanded).toBe(false);
    // Selecting changes no state; it names the row to move to.
    const revision = form.getSnapshot();
    expect(runAction(form, { name: 'select-row', path: 'teams', key: k1 })).toEqual({ focus: { path: 'teams', key: k1 } });
    expect(form.getSnapshot()).toBe(revision);
    expect(runAction(form, { name: 'undo' })).toEqual({});
    expect(form.getValue(members)).toEqual({});
    expect(runAction(form, { name: 'redo' })).toEqual({});
    expect(keysOf(form.getValue(members), members)).toHaveLength(1);
  });

  it('returns the row that receives focus after copying, moving and removing', () => {
    const form = createForm(compileForm(spec), data);
    // teams allows at most two rows, so remove one before copying.
    expect(runAction(form, { name: 'remove-row', path: 'teams', key: k1 })).toEqual({ focus: { path: 'teams', key: k2 } });
    const copied = runAction(form, { name: 'copy-row', path: 'teams', key: k2 });
    const [, copy] = keysOf(form.getValue('teams'), 'teams');
    expect(copied).toEqual({ focus: { path: 'teams', key: copy } });
    expect(runAction(form, { name: 'move-down', path: 'teams', key: k2 })).toEqual({ focus: { path: 'teams', key: k2 } });
    expect(runAction(form, { name: 'remove-row', path: 'teams', key: k2 })).toEqual({ focus: { path: 'teams', key: copy } });
    form.undo();
    form.undo();
    form.undo();
    form.undo();
    const members = `teams.${k1}.members`;
    expect(runAction(form, { name: 'remove-row', path: members, key: k1 })).toEqual({ focus: { path: members, key: k2 } });
    expect(runAction(form, { name: 'remove-row', path: members, key: k2 })).toEqual({ focus: { path: members } });
  });
});

describe('pure view state and history rules', () => {
  it('records, merges, limits and undoes history entries', () => {
    let history = emptyHistory<number>();
    history = recordChange(history, 0, 'a');
    history = recordChange(history, 1, 'a');
    history = recordChange(history, 2);
    expect(history.entries).toEqual([0, 2]);
    for (let value = 0; value < 150; value++) history = recordChange(history, value);
    expect(history.entries).toHaveLength(HISTORY_LIMIT);
    const { history: rest, value } = undoChange(history, 150);
    expect(value).toBe(149);
    expect(rest.entries).toHaveLength(HISTORY_LIMIT - 1);
    expect(rest.lastPath).toBeUndefined();
    expect(() => undoChange(emptyHistory(), 0)).toThrow('Nothing to undo');
  });

  it('redoes an undo and clears redo after a new change', () => {
    let history = emptyHistory<number>();
    history = recordChange(history, 0);
    const undone = undoChange(history, 1);
    expect(undone.value).toBe(0);
    expect(canRedo(undone.history)).toBe(true);
    const redone = redoChange(undone.history, 0);
    expect(redone.value).toBe(1);
    expect(canRedo(redone.history)).toBe(false);
    expect(recordChange(undone.history, 0).redoEntries).toEqual([]);
  });

  it('drops, renames and resets the view state of rows', () => {
    let view = toggleRowView(toggleRowView(initialView(), `teams.${k1}`), `teams.${k1}.members.${k2}`);
    view = toggleRowView(view, `teams.${k2}`);
    expect(rekeyRowView(view, `teams.${k1}`, 'teams.__0000000000009__')).toEqual({
      collapsed: new Set(['teams.__0000000000009__', `teams.__0000000000009__.members.${k2}`, `teams.${k2}`]),
    });
    expect(removeRowView(view, `teams.${k1}`)).toEqual({ collapsed: new Set([`teams.${k2}`]) });
    expect(setAllExpandedView(bindForm(compileForm(spec), data), false).collapsed)
      .toEqual(new Set([`teams.${k1}`, `teams.${k2}`]));
    expect(initialView()).toEqual({ collapsed: new Set() });
  });
});

describe('form buttons', () => {
  const root = (extra: Record<string, unknown>) => ({ type: 'group', properties: { name: { type: 'text' } }, ...extra });

  it('keeps one submit button when the spec declares none', () => {
    const template = compileForm(root({}));
    expect(template.buttons).toEqual([{ type: 'submit' }]);
    expect(bindButtons(template, {}, { language: 'en' })).toEqual([
      { type: 'submit', tag: 'button', text: 'Save', attrs: { type: 'submit', class: 'crudui-action crudui-action--text' } },
    ]);
  });

  it('rejects a value that is not a compiled form template before reading its buttons', () => {
    for (const template of [{ kind: 'other' }, { kind: 'other', buttons: [] }]) {
      // @ts-expect-error: an object of another kind is no FormTemplate; bindButtons checks it at run time.
      expect(() => bindButtons(template)).toThrow('Unsupported form template');
    }
  });

  it('evaluates declared buttons in order with text, design and behavior', () => {
    const template = compileForm(root({
      action: { method: 'post', url: '/save' },
      buttons: [
        { type: 'submit', name: '__submitted__', value: 'go', text: { ko: '저장하기', en: 'Save now' }, design: { class: 'primary' } },
        { type: 'reset' },
        { type: 'button', text: 'Cancel', behavior: { onclick: 'history.back()' } },
        { type: 'link', text: 'List', href: '../?a=1&b="2"' },
      ],
    }));
    expect(template.action).toEqual({ method: 'post', url: '/save' });
    const buttons = bindButtons(template, {}, { language: 'ko' });
    expect(buttons.map(button => [button.tag, button.text, button.attrs])).toEqual([
      ['button', '저장하기', { type: 'submit', class: 'crudui-action crudui-action--text primary', name: '__submitted__', value: 'go' }],
      ['button', '초기화', { type: 'reset', class: 'crudui-action crudui-action--text' }],
      ['button', 'Cancel', { type: 'button', class: 'crudui-action crudui-action--text', onclick: 'history.back()' }],
      ['a', 'List', { class: 'crudui-action crudui-action--text', href: '../?a=1&b="2"' }],
    ]);
    expect(formButtonsHtml(buttons.slice(3))).toBe('<a class="crudui-action crudui-action--text" href="../?a=1&amp;b=&quot;2&quot;">List</a>');
    // Only evaluated buttons are rendered, with one error for any other shape.
    // @ts-expect-error: an object is no list of buttons; formButtonsHtml checks it at run time.
    expect(() => formButtonsHtml({})).toThrow('Form buttons must be a list');
    const button = buttons[0];
    for (const invalid of [null, [], { ...button, tag: 'div' }, { ...button, text: 1 }, { ...button, attrs: [] },
      { ...button, attrs: { onmouseover: 'x' } }, { ...button, attrs: { class: 1 } }]) {
      // @ts-expect-error: each invalid value is no ButtonVM; formButtonsHtml checks it at run time.
      expect(() => formButtonsHtml([invalid])).toThrow('Form buttons must be evaluated button objects');
    }
  });

  it('rejects wrong button and action declarations', () => {
    const compile = (extra: Record<string, unknown>) => () => compileForm(root(extra));
    expect(compile({ buttons: {} })).toThrow('Invalid buttons at form: expected a list of buttons');
    expect(compile({ buttons: [{ type: 'image' }] })).toThrow('Invalid buttons.0.type at form: expected submit, reset, button or link');
    expect(compile({ buttons: [{ type: 'button' }] })).toThrow('Invalid buttons.0.text at form: expected content for this button type');
    expect(compile({ buttons: [{ type: 'link', text: 'List' }] })).toThrow('Invalid buttons.0.href at form: expected a link target');
    expect(compile({ buttons: [{ type: 'submit', value: 1 }] })).toThrow('Invalid buttons.0.value at form: expected a string');
    expect(compile({ action: 'post' })).toThrow('Invalid action at form: expected an object');
    expect(() => compileForm({ type: 'group', properties: { rows: { type: 'group', buttons: [], properties: {} } } }))
      .toThrow('Invalid buttons at rows: expected the form root');
  });

  it('carries evaluated buttons in the instance snapshot', () => {
    const form = createForm(compileForm(root({ buttons: [{ type: 'submit', design: { class: { '.name': 'filled' } } }] })), { name: 'Ada' }, { language: 'en' });
    expect(form.getSnapshot().buttons[0].attrs.class).toBe('crudui-action crudui-action--text filled');
  });
});
