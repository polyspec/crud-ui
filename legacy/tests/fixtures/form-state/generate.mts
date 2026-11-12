/**
 * Generates the shared form state fixtures of six families: `form-view`, `form-history`, `form-actions` and
 * `form-choices` (sessions of operations on a form instance) and `view-functions` and `history-functions` (the pure functions of the view and the
 * history).
 *
 * A form state case is `{ name, note, requirements, spec, data, options, steps, expected }`. Each step is
 * `{ op, args }` and `expected[i]` is what the TypeScript reference observed after step `i`: `result` or `error`
 * (`code`, `message`), then `data`, `revision`, `canUndo`, `canRedo` and `collapsed`, the row paths whose row is
 * collapsed. A row key that the case does not name (spec, data and steps) is one that an operation generated; the
 * observation names it `$1`, `$2` in order of first appearance, so the output is the same in every implementation.
 * A function case is `{ name, note, requirements, op, args, expected }`.
 *
 * Do not edit the `cases.json` files by hand. Regenerate:
 *   node legacy/tests/fixtures/form-state/generate.mts
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '@polyspec/crudui-generator-core';
import { observeFunction, observeSession, type Json, type Step } from './harness.mts';

interface Case { name: string; note: string; requirements: string[]; [key: string]: Json }

const here = dirname(fileURLToPath(import.meta.url));
const k = (n: number): string => `__${String(n).padStart(13, '0')}__`;
const A = k(1);
const B = k(2);
const M1 = k(11);
const M2 = k(12);
const M3 = k(13);

const spec: Json = {
  type: 'group',
  properties: {
    teams: {
      type: 'group',
      label: 'Team',
      multiple: { min: 1, max: 5, sortable: true, copy: true, title: 'name' },
      properties: {
        name: { type: 'text', label: 'Name' },
        members: {
          type: 'group',
          label: 'Member',
          multiple: { title: 'name' },
          properties: { name: { type: 'text', label: 'Name' } },
        },
      },
    },
    note: { type: 'text', label: 'Note' },
  },
};

const data: Json = {
  teams: {
    [A]: { name: 'Alpha', members: { [M1]: { name: 'One' }, [M2]: { name: 'Two' } } },
    [B]: { name: 'Beta', members: { [M3]: { name: 'Three' } } },
  },
  note: '',
};


/** The runtime requirements (runtime-packages.md) that a session tests: each session creates an instance and reads its data; a replace, a row operation and a failing operation are tested where a step performs them. */
const ROW_OPERATIONS = ['addRow', 'copyRow', 'removeRow', 'moveRow', 'rekeyRow'];
const ROW_ACTIONS = ['add-row', 'copy-row', 'remove-row', 'move-up', 'move-down'];
function runtimeRequirements(steps: Step[]): string[] {
  const ids = ['CURP-010', 'CURP-012', 'CURP-020'];
  if (steps.some(({ op }) => op === 'setData')) ids.push('CURP-011');
  const rowStep = steps.some(({ op, args }) => {
    if (ROW_OPERATIONS.includes(op)) return true;
    const target = args[0];
    const name = typeof target === 'object' && target !== null && !Array.isArray(target) ? target.name : undefined;
    return op === 'runAction' && typeof name === 'string' && ROW_ACTIONS.includes(name);
  });
  if (rowStep) ids.push('CURP-027');
  return ids;
}

function session(entry: { name: string; note: string; requirements: string[]; steps: Step[]; spec?: Json; data?: Json }, history = true): Case {
  const steps: Json[] = entry.steps.map(({ op, args }) => ({ op, args }));
  const caseSpec = entry.spec ?? spec;
  const caseData = entry.data ?? data;
  // The requirement ids are written in sorted order, as the committed cases list them.
  return { name: entry.name, note: entry.note, requirements: [...entry.requirements, ...runtimeRequirements(entry.steps)].sort(), spec: caseSpec, data: caseData, steps, expected: observeSession(core, { spec: caseSpec, data: caseData, steps: entry.steps }, history) };
}

const step = (op: string, ...args: Json[]): Step => ({ op, args });
const run = (target: Json): Step => step('runAction', target);

const all: Case[] = [
  session({
    name: 'toggle-row-collapses-and-expands',
    note: 'A toggle collapses a row, a second toggle expands it again, a nested row collapses after its parent, and an unknown row fails; the revision does not change.',
    requirements: ['CUMK-057', 'CURT-009', 'CURT-067', 'CURT-068'],
    steps: [
      step('toggleRow', 'teams', A),
      step('toggleRow', `teams.${A}.members`, M1),
      step('toggleRow', 'teams', A),
      step('toggleRow', 'teams', k(9)),
      step('toggleRow', 'teams', A),
    ],
  }, false),
  session({
    name: 'set-all-expanded-collapses-every-collapsible-row',
    note: 'Collapsing every row lists the collapsible rows depth first; expanding all clears the view.',
    requirements: ['CUMK-057', 'CURT-010', 'CURT-073'],
    steps: [step('setAllExpanded', false), step('toggleRow', 'teams', B), step('setAllExpanded', true), step('setAllExpanded', false)],
  }, false),
  session({
    name: 'row-removal-drops-and-rekey-moves-view',
    note: 'Removing a row drops the collapsed state of the row and of its rows; rekeying moves it to the new key.',
    requirements: ['CUMK-057', 'CURT-066', 'CURT-075', 'CURT-074', 'CURT-006', 'CURT-008'],
    steps: [
      step('setAllExpanded', false),
      step('rekeyRow', 'teams', A, k(3)),
      step('removeRow', 'teams', B),
      step('rekeyRow', `teams.${k(3)}.members`, M2, k(14)),
    ],
  }, false),
  session({
    name: 'set-data-restarts-history-and-view',
    note: 'Replacing the record clears the history and expands every row.',
    requirements: ['CURT-065'],
    steps: [
      step('setValue', 'note', 'first'),
      step('setAllExpanded', false),
      step('setData', data),
      step('undo'),
    ],
  }),
  session({
    name: 'visibility-hides-and-shows-rows-without-changing-data',
    note: 'A show condition that hides a collection keeps its rows and their data, and showing it again restores them unchanged (CUEC-006).',
    requirements: ['CUEC-006'],
    spec: {
      type: 'group',
      properties: {
        visible: { type: 'text' },
        items: { type: 'group', multiple: true, design: { show: '.visible' }, properties: { name: { type: 'text' } } },
      },
    },
    data: { visible: 'yes', items: { [k(1)]: { name: 'Alpha' }, [k(2)]: { name: 'Beta' } } },
    steps: [step('setValue', 'visible', ''), step('setValue', 'visible', 'yes'), step('setValue', 'visible', '')],
  }),
  session({
    name: 'edit-reorder-remove-and-add-rows-keep-no-stale-values',
    note: 'Editing, moving, removing and adding rows leaves each row with its own values; a row added later starts empty (CURT-053).',
    requirements: ['CURT-053'],
    steps: [
      step('setValue', `teams.${A}.name`, 'Alpha two'),
      step('moveRow', 'teams', B, 0),
      step('removeRow', 'teams', A),
      step('addRow', 'teams', { key: k(5) }),
    ],
  }),
  session({
    name: 'rekey-moves-the-edits-to-the-new-keys',
    note: 'Rekeying a row and a member keeps their values under the new keys; an edit after the rekey uses the new path. The rule paths of the fields are not observed.',
    requirements: [],
    steps: [
      step('rekeyRow', 'teams', A, k(6)),
      step('rekeyRow', `teams.${k(6)}.members`, M1, k(15)),
      step('setValue', `teams.${k(6)}.members.${k(15)}.name`, 'Uno'),
    ],
  }),
  session({
    name: 'invalid-removal-leaves-data-and-adding-continues',
    note: 'An unknown row and a removal below the minimum row count fail without changing the data; adding a row afterwards is permitted.',
    requirements: [],
    steps: [
      step('removeRow', 'teams', k(9)),
      step('addRow', 'teams', { key: k(5) }),
      step('removeRow', 'teams', A),
      step('removeRow', 'teams', B),
      step('removeRow', 'teams', k(5)),
      step('addRow', 'teams', { key: k(6) }),
    ],
  }),
  session({
    name: 'delete-every-row-then-add-one-with-min-zero',
    note: 'With no minimum row count, an unknown row fails and changes nothing; every row is deleted, and adding one row then gives a row with empty values (CURT-055).',
    requirements: ['CURT-055'],
    spec: {
      type: 'group',
      properties: {
        teams: {
          type: 'group',
          label: 'Team',
          multiple: { min: 0, max: 5, sortable: true, copy: true, title: 'name' },
          properties: {
            name: { type: 'text', label: 'Name' },
            members: { type: 'group', label: 'Member', multiple: { title: 'name' }, properties: { name: { type: 'text', label: 'Name' } } },
          },
        },
        note: { type: 'text', label: 'Note' },
      },
    },
    steps: [
      step('removeRow', 'teams', k(9)),
      step('removeRow', 'teams', A),
      step('removeRow', 'teams', B),
      step('addRow', 'teams', { key: k(5) }),
    ],
  }),
  session({
    name: 'rekey-moves-validation-errors-to-the-new-paths',
    note: 'A required member with no name is an error at its data path; after the team and the member are rekeyed, the same error is reported at the new path (CURT-054).',
    requirements: ['CURT-054'],
    spec: {
      type: 'group',
      properties: {
        teams: {
          type: 'group',
          label: 'Team',
          multiple: { min: 1, max: 5, sortable: true, copy: true, title: 'name' },
          properties: {
            name: { type: 'text', label: 'Name' },
            members: {
              type: 'group',
              label: 'Member',
              multiple: { title: 'name' },
              properties: { name: { type: 'text', label: 'Name', validate: { required: true } } },
            },
          },
        },
        note: { type: 'text', label: 'Note' },
      },
    },
    data: {
      teams: {
        [A]: { name: 'Alpha', members: { [M1]: { name: '' }, [M2]: { name: 'Two' } } },
        [B]: { name: 'Beta', members: { [M3]: { name: 'Three' } } },
      },
      note: '',
    },
    steps: [
      step('validate'),
      step('rekeyRow', 'teams', A, k(6)),
      step('rekeyRow', `teams.${k(6)}.members`, M1, k(15)),
      step('validate'),
    ],
  }),
  session({
    name: 'set-data-rejects-a-root-that-is-not-an-object',
    note: 'Replacing the record with a text or an array fails with the root message, and the record and the history stay as they were.',
    requirements: ['CURT-001', 'CURP-026'],
    steps: [step('setData', 'text'), step('setData', null), step('setData', ['a']), step('setValue', 'note', 'after')],
  }),
  session({
    name: 'set-data-rejects-a-group-row-that-is-not-an-object',
    note: 'A row of a repeated group that holds a text instead of an object fails with the path of the row.',
    requirements: ['CURT-002'],
    steps: [
      step('setData', { teams: { [k(1)]: 'x' }, note: '' }),
      step('setData', { teams: { [k(9)]: { name: 'Gamma' }, [k(10)]: 5 }, note: '' }),
    ],
  }),
  session({
    name: 'set-data-rejects-a-repeated-value-that-is-not-a-keyed-object',
    note: 'A repeated value that is a list or a text instead of a keyed object fails with the path of the value.',
    requirements: ['CURT-003'],
    steps: [
      step('setData', { teams: ['a'], note: '' }),
      step('setData', { teams: 'x', note: '' }),
    ],
  }),
  session({
    name: 'undo-and-redo-restore-the-record',
    note: 'Undo restores the record before the change and redo reapplies it; each changes the revision; nothing to undo or redo fails.',
    requirements: ['CUMK-061', 'CURT-011', 'CURT-012', 'CURT-061', 'CURT-067', 'CURT-004'],
    steps: [
      step('undo'),
      step('setValue', 'note', 'one'),
      step('addRow', 'teams', { key: k(5) }),
      step('undo'),
      step('undo'),
      step('redo'),
      step('redo'),
      step('redo'),
    ],
  }),
  session({
    name: 'same-path-edits-share-one-record',
    note: 'Consecutive edits of one path share a history record; an edit of another path or another change starts a new one.',
    requirements: ['CUMK-061', 'CURT-063'],
    steps: [
      step('setValue', 'note', 'a'),
      step('setValue', 'note', 'ab'),
      step('setValue', `teams.${A}.name`, 'Alpha 2'),
      step('setValue', 'note', 'abc'),
      step('undo'),
      step('undo'),
      step('undo'),
      step('undo'),
    ],
  }),
  session({
    name: 'a-change-after-undo-clears-redo',
    note: 'A data change after undo clears the redo records.',
    requirements: ['CUMK-061', 'CURT-064', 'CURT-061'],
    steps: [step('setValue', 'note', 'a'), step('undo'), step('setValue', 'note', 'b'), step('redo')],
  }),
  session({
    name: 'history-keeps-100-records',
    note: 'After 105 edits that alternate between two paths, 100 undos succeed and the next one fails.',
    requirements: ['CUMK-061', 'CURT-062'],
    steps: [
      ...Array.from({ length: 105 }, (_, i) => step('setValue', i % 2 === 0 ? 'note' : `teams.${A}.name`, `v${i}`)),
      ...Array.from({ length: 101 }, () => step('undo')),
    ],
  }),
  session({
    name: 'record-keeps-member-order-and-distinct-empty-values',
    note: 'A record keeps the order of its members and rows; an absent members value, an empty object and an empty array stay distinct, and a null value stays null.',
    requirements: ['CURP-025'],
    steps: [
      step('setData', { teams: { [B]: { name: 'Beta', members: {} }, [A]: { name: 'Alpha' } }, note: 'n' }),
      step('setData', { teams: { [B]: { name: 'Beta', members: [] } }, note: 'n' }),
      step('setValue', 'note', null),
      step('setValue', `teams.${A}.name`, 'Alpha 2'),
    ],
  }),
  session({
    name: 'resolve-action-names',
    note: 'An action resolves to a target with a non-empty path and key; an unknown or empty action resolves to nothing.',
    requirements: ['CURT-081'],
    steps: [
      step('resolveAction', { action: 'add-row', path: 'teams', key: A }),
      step('resolveAction', { action: 'undo' }),
      step('resolveAction', { action: 'move-up', path: '', key: '' }),
      step('resolveAction', { action: 'rename-row', path: 'teams' }),
      step('resolveAction', { action: '' }),
      step('resolveAction', {}),
    ],
  }),
  session({
    name: 'run-action-view-and-history',
    note: 'Expand all, collapse all, undo and redo return a result without focus; toggle-row collapses a row.',
    requirements: ['CURT-082', 'CURT-087', 'CURT-011', 'CURT-012'],
    steps: [
      run({ name: 'collapse-all' }),
      run({ name: 'expand-all' }),
      run({ name: 'toggle-row', path: 'teams', key: A }),
      run({ name: 'undo' }),
      step('setValue', 'note', 'x'),
      run({ name: 'undo' }),
      run({ name: 'redo' }),
      run({ name: 'redo' }),
    ],
  }),
  session({
    name: 'run-action-without-path-or-key',
    note: 'A path or key that an action needs is missing: no result and no change; add-row needs no key.',
    requirements: ['CURT-083'],
    steps: [
      run({ name: 'add-row' }),
      run({ name: 'copy-row', path: 'teams' }),
      run({ name: 'remove-row', key: A }),
      run({ name: 'toggle-row', path: 'teams' }),
      run({ name: 'select-row', key: A }),
      run({ name: 'move-up', path: 'teams' }),
    ],
  }),
  session({
    name: 'run-action-add-and-copy-row',
    note: 'Adding focuses the new row after the given row or last, and copying focuses the copy right after the original.',
    requirements: ['CURT-084', 'CURT-085', 'CURT-005'],
    steps: [
      run({ name: 'add-row', path: 'teams', key: A }),
      run({ name: 'copy-row', path: 'teams', key: B }),
      run({ name: 'add-row', path: 'teams', key: A }),
      run({ name: 'copy-row', path: `teams.${A}.members`, key: M1 }),
    ],
  }),
  session({
    name: 'run-action-remove-row-focus',
    note: 'Removing focuses the previous row, then the next row, then the collection.',
    requirements: ['CURT-086'],
    steps: [
      run({ name: 'remove-row', path: 'teams', key: B }),
      run({ name: 'remove-row', path: `teams.${A}.members`, key: M1 }),
      run({ name: 'remove-row', path: `teams.${A}.members`, key: M2 }),
      run({ name: 'remove-row', path: 'teams', key: A }),
    ],
  }),
  session({
    name: 'run-action-select-row',
    note: 'Selecting changes nothing and focuses the row, also a row that does not exist.',
    requirements: ['CURT-088'],
    steps: [run({ name: 'select-row', path: 'teams', key: A }), run({ name: 'select-row', path: 'teams', key: k(9) })],
  }),
  session({
    name: 'run-action-move-row',
    note: 'Moving up or down focuses the moved row; moving past an end fails and changes nothing.',
    requirements: ['CURT-089', 'CURT-090', 'CURT-007'],
    steps: [
      run({ name: 'move-up', path: 'teams', key: B }),
      run({ name: 'move-up', path: 'teams', key: B }),
      run({ name: 'move-down', path: 'teams', key: B }),
      run({ name: 'move-down', path: 'teams', key: B }),
    ],
  }),
  session({
    name: 'run-action-errors',
    note: 'An operation that fails fails the action: an unknown row, a path that is no keyed collection, an unknown collection, nothing to undo.',
    requirements: ['CURT-090', 'CURT-082'],
    steps: [
      run({ name: 'remove-row', path: 'teams', key: k(9) }),
      run({ name: 'toggle-row', path: 'teams', key: k(9) }),
      run({ name: 'add-row', path: 'note' }),
      run({ name: 'add-row', path: 'missing' }),
      run({ name: 'undo' }),
      run({ name: 'redo' }),
    ],
  }),
  session({
    name: 'run-action-unknown-name',
    note: 'A target whose name is none of the eleven actions fails, with or without a path and key, and changes nothing.',
    requirements: ['CURT-091'],
    steps: [
      run({ name: 'rename-row', path: 'teams', key: k(1) }),
      run({ name: 'rename-row' }),
      run({ name: '' }),
    ],
  }),  session({
    name: 'explicit-empty-collection-gets-keyed-rows',
    note: 'An explicit empty object has zero rows, and a row that an operation adds to it is a keyed object (CUEC-007, CUEC-001).',
    requirements: ['CUEC-007', 'CURT-004'],
    spec,
    data: { teams: {} },
    steps: [step('addRow', 'teams', { key: k(1) }), step('setValue', 'note', 'added')],
  }),

];


const viewCases: Case[] = [];
const historyCases: Case[] = [];
const fn = (family: Case[], name: string, note: string, requirements: string[], op: string, args: Json[]): void => {
  family.push({ name, note, requirements, op, args, expected: observeFunction(core, { op, args }) });
};
const viewOf = (...collapsed: string[]): Json => ({ collapsed });
const rowA = `teams.${A}`;
const rowM1 = `teams.${A}.members.${M1}`;
const plain: Json = { type: 'group', properties: { a: { type: 'text' } } };

fn(viewCases, 'initial-view', 'The initial view has no collapsed row.', ['CURT-070', 'CURT-068'], 'initialView', []);
fn(viewCases, 'toggle-collapses-and-appends', 'A toggled expanded row is appended to the collapsed rows.', ['CURT-071'], 'toggleRowView', [viewOf(rowM1), rowA]);
fn(viewCases, 'toggle-expands', 'A toggled collapsed row leaves the others in order.', ['CURT-071'], 'toggleRowView', [viewOf(rowA, rowM1, `teams.${B}`), rowM1]);
fn(viewCases, 'collapsible-rows-depth-first', 'The collapsible rows of the evaluated nodes in node order, depth first.', ['CURT-072'], 'collapsibleRows', [spec, data]);
fn(viewCases, 'collapsible-rows-without-collections', 'A form without repeated fields has no collapsible row.', ['CURT-072'], 'collapsibleRows', [plain, {}]);
fn(viewCases, 'set-all-collapsed', 'Collapsing all collapses the collapsible rows of the nodes.', ['CURT-073'], 'setAllExpandedView', [spec, data, false]);
fn(viewCases, 'set-all-expanded', 'Expanding all returns the view with no collapsed row.', ['CURT-073'], 'setAllExpandedView', [spec, data, true]);
fn(viewCases, 'remove-row-drops-inner-paths', 'Removing a row drops its path and the paths inside it, not a path that only starts with the same text.', ['CURT-074'], 'removeRowView', [viewOf(rowA, rowM1, `${rowA}x`, `teams.${B}`), rowA]);
fn(viewCases, 'rekey-row-renames-prefix', 'Rekeying replaces the prefix of the row path and of the paths inside it and keeps the order.', ['CURT-075'], 'rekeyRowView', [viewOf(`teams.${B}`, rowM1, rowA, `${rowA}x`), rowA, `teams.${k(3)}`]);
fn(viewCases, 'bind-form-collapsed-option', 'The bindForm option collapsed renders the listed collapsible rows collapsed and the others expanded.', ['CURT-069'], 'bindCollapsed', [spec, data, [rowA, rowM1, 'teams.__missing__']]);
fn(viewCases, 'bind-form-without-collapsed-option', 'Without the option every row is expanded.', ['CURT-069', 'CURT-068'], 'bindCollapsed', [spec, data, null]);

const hist = (entries: Json[], redoEntries: Json[] = [], lastPath?: string): Json => ({ entries, redoEntries, ...(lastPath === undefined ? {} : { lastPath }) });
const range = (from: number, to: number): Json[] => Array.from({ length: to - from }, (_, i) => from + i);
fn(historyCases, 'empty-history', 'The empty history has no entries.', ['CURT-076'], 'emptyHistory', []);
fn(historyCases, 'record-appends-and-clears-redo', 'A record appends the previous record, clears redo and sets the path.', ['CURT-077'], 'recordChange', [hist(['a'], ['z'], 'p'), 'b', 'q']);
fn(historyCases, 'record-same-path-shares-entry', 'A value edit on the path of the last edit adds no entry.', ['CURT-077', 'CURT-063'], 'recordChange', [hist(['a'], [], 'p'), 'b', 'p']);
fn(historyCases, 'record-without-path-drops-last-path', 'A change without a path adds an entry and leaves no path.', ['CURT-077'], 'recordChange', [hist(['a'], [], 'p'), 'b', null]);
fn(historyCases, 'record-keeps-100-entries', 'The 101st entry drops the oldest.', ['CURT-077', 'CURT-062'], 'recordChange', [hist(range(0, 100)), 100, null]);
fn(historyCases, 'can-undo-and-redo-empty', 'An empty history can do neither.', ['CURT-078'], 'canUndoRedo', [hist([])]);
fn(historyCases, 'can-undo-and-redo-filled', 'An entry allows undo and a redo entry allows redo.', ['CURT-078'], 'canUndoRedo', [hist(['a'], ['b'])]);
fn(historyCases, 'undo-moves-the-record', 'Undo takes the last entry, queues the current record for redo and drops the path.', ['CURT-079'], 'undoChange', [hist(['a', 'b'], ['x'], 'p'), 'c']);
fn(historyCases, 'undo-keeps-100-redo-entries', 'The redo records are limited to 100.', ['CURT-079', 'CURT-062'], 'undoChange', [hist(['a'], range(0, 100)), 'c']);
fn(historyCases, 'undo-of-empty-fails', 'An empty history fails.', ['CURT-079'], 'undoChange', [hist([]), 'c']);
fn(historyCases, 'redo-moves-the-record', 'Redo takes the last redo entry and appends the current record to the entries.', ['CURT-080'], 'redoChange', [hist(['a'], ['x', 'y'], 'p'), 'c']);
fn(historyCases, 'redo-keeps-100-entries', 'The entries are limited to 100.', ['CURT-080', 'CURT-062'], 'redoChange', [hist(range(0, 100), ['x']), 'c']);
fn(historyCases, 'redo-without-redo-entry-fails', 'A history without a redo entry fails.', ['CURT-080'], 'redoChange', [hist(['a']), 'c']);

const sessions = (names: string[]): Case[] => names.map(name => {
  const found = all.find(entry => entry.name === name);
  if (!found) throw new Error(`Unknown session: ${name}`);
  return found;
});
const view = sessions(['toggle-row-collapses-and-expands', 'set-all-expanded-collapses-every-collapsible-row', 'row-removal-drops-and-rekey-moves-view']);
const historySessions = sessions(['set-data-restarts-history-and-view', 'undo-and-redo-restore-the-record', 'same-path-edits-share-one-record', 'a-change-after-undo-clears-redo', 'history-keeps-100-records']);
const actions = all.filter(entry => !view.includes(entry) && !historySessions.includes(entry));

// The sessions of `form-choices`: a field whose items is a group source lists the rows of its group in the current data
// after every change (docs/spec/schema.md, CUSC-071); the step `choices` observes the options of the field node.
const sourceSpec: Json = {
  type: 'group',
  properties: {
    characters: {
      type: 'group',
      label: 'Character',
      multiple: { copy: true, sortable: true },
      properties: { id: { type: 'text', label: 'Id' }, name: { type: 'text', label: 'Name' } },
    },
    lead: { type: 'select', label: 'Lead', items: { from: 'characters.*.id', label: 'name' } },
    cast: { type: 'multichoice', label: 'Cast', items: { from: 'characters.*.id', label: 'name' } },
    roles: {
      type: 'group',
      label: 'Role',
      multiple: true,
      properties: { character: { type: 'radio', label: 'Character', items: { from: 'characters.*.id' } } },
    },
  },
};
const C1 = k(21);
const C2 = k(22);
const C3 = k(23);
const C4 = k(24);
const R1 = k(31);
const sourceData: Json = {
  characters: { [C1]: { id: 'ann', name: 'Ann' }, [C2]: { id: 'bob', name: 'Bob' } },
  lead: 'ann',
  cast: ['bob'],
  roles: { [R1]: { character: 'bob' } },
};
const choices = (path: string): Step => step('choices', path);
const choiceCases: Case[] = [
  session({
    name: 'choices-follow-edited-values-and-labels',
    note: 'An edited value or label of a source row changes its choice in the next view, in every field with the source.',
    requirements: ['CUSC-071'],
    spec: sourceSpec,
    data: sourceData,
    steps: [
      choices('lead'),
      step('setValue', `characters.${C1}.name`, 'Anna'),
      choices('lead'),
      step('setValue', `characters.${C2}.id`, 'rob'),
      choices('cast'),
      choices(`roles.${R1}.character`),
    ],
  }),
  session({
    name: 'choices-follow-added-copied-moved-and-rekeyed-rows',
    note: 'An added row gives a choice in data order; a copied row repeats a value and gives none; moving a row moves its choice; rekeying keeps it.',
    requirements: ['CUSC-071'],
    spec: sourceSpec,
    data: sourceData,
    steps: [
      step('addRow', 'characters', { key: C3, value: { id: 'cy', name: '' } }),
      choices('lead'),
      step('copyRow', 'characters', C3, { key: C4 }),
      choices('lead'),
      step('moveRow', 'characters', C3, 0),
      choices('lead'),
      step('rekeyRow', 'characters', C3, k(25)),
      choices('lead'),
    ],
  }),
  session({
    name: 'choices-follow-removed-rows-and-history',
    note: 'Removing the row of the selected value removes its choice and keeps the value, which validation reports; undo and redo list the restored rows.',
    requirements: ['CUSC-071', 'CUVR-060'],
    spec: sourceSpec,
    data: sourceData,
    steps: [
      step('removeRow', 'characters', C1),
      choices('lead'),
      step('validate'),
      step('undo'),
      choices('lead'),
      step('redo'),
      choices('lead'),
    ],
  }),
  session({
    name: 'choices-follow-replaced-data',
    note: 'setData lists the rows of the new data, and a group without rows has no choices; the explicit empty collections keep the observation free of generated row keys.',
    requirements: ['CUSC-071'],
    spec: sourceSpec,
    data: sourceData,
    steps: [
      step('setData', { characters: { [C3]: { id: 'dee', name: 'Dee' } }, lead: 'dee', roles: {} }),
      choices('lead'),
      step('setData', { characters: {}, roles: {} }),
      choices('lead'),
      choices('cast'),
    ],
  }),
];

for (const [folder, cases] of [['form-view', view], ['form-history', historySessions], ['form-actions', actions], ['view-functions', viewCases], ['history-functions', historyCases], ['form-choices', choiceCases]] as const) {
  writeFileSync(resolve(here, '..', folder, 'cases.json'), `${JSON.stringify(cases, null, 2)}\n`);
}
