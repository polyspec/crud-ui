/** Declaration rules of composed list and detail specifications (docs/spec/display-formats.md). */

import { FormInputError } from '@polyspec/crudui-validator';
import { checkDesignDeclaration } from './form';
import { CHOICE_LIST_EXPECTED, choicePairs, isChoiceList } from './choice-list';
import { isRecord } from './util';

/** Declaration path names of a display specification. */
export interface DisplayPaths {
  /** Path of the specification root: `list` or `detail`. */
  own: 'list' | 'detail';
  /** Name of the member map and the path prefix of each member: `columns` or `fields`. */
  members: 'columns' | 'fields';
}

const LIST_KEYS = ['columns', 'search', 'sort', 'pagination', 'actions', 'empty', 'description', 'design'];
const DETAIL_KEYS = ['fields', 'actions', 'design'];
const COLUMN_KEYS = ['field', 'label', 'format', 'design', 'sortable'];
const FIELD_KEYS = ['field', 'label', 'format', 'design'];
const SORT_KEYS = ['field', 'dir'];
const SCRIPT_ACTION_KEYS = ['label', 'script'];
const ACTION_KEYS = ['label', 'format', 'behavior', 'design'];
const BEHAVIOR_KEYS = ['onchange', 'onclick', 'onload'];
const FORMAT_STRINGS = ['type', 'pattern', 'target', 'as'];
const FORMAT_CONTENT = ['prefix', 'suffix', 'text', 'true', 'false', 'alt'];
const PAGINATION_KEYS = ['per_page', 'mode'];
const PAGINATION_MODES = ['pages', 'offset', 'cursor', 'none'];

const CONTENT = 'a string, a language map or null';


function has(object: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/** A string, a language map (a non-empty object of strings or null) or null. */
function isContent(value: unknown): boolean {
  if (value === null || typeof value === 'string') return true;
  if (!isRecord(value)) return false;
  const entries = Object.values(value);
  return entries.length > 0 && entries.every(entry => entry === null || typeof entry === 'string');
}

/** A condition map: an object with at least one member. */
function isConditionMap(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

function fail(key: string, path: string, expected: string): never {
  throw new FormInputError(`Invalid ${key} at ${path}: expected ${expected}`);
}

/** Reject the first key of `object`, in member order, that `allowed` does not list. */
function closed(object: Record<string, unknown>, prefix: string, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) throw new FormInputError(`Invalid ${prefix}${key} at ${path}: unknown key`);
  }
}

/** Check a cell format declaration at `path`. */
function checkFormat(format: unknown, path: string): void {
  if (typeof format === 'boolean' || typeof format === 'string') return;
  if (!isRecord(format)) fail('format', path, 'a boolean, a string or an object');
  for (const [key, value] of Object.entries(format)) {
    if (FORMAT_STRINGS.includes(key)) {
      if (typeof value !== 'string') fail(`format.${key}`, path, 'a string');
    } else if (FORMAT_CONTENT.includes(key)) {
      if (!isContent(value)) fail(`format.${key}`, path, CONTENT);
    } else if (key === 'map') {
      if (!isRecord(value)) fail('format.map', path, 'an object');
      for (const [name, label] of Object.entries(value)) {
        if (!isContent(label)) fail(`format.map.${name}`, path, CONTENT);
      }
    } else if (key === 'href') {
      if (typeof value !== 'string' && !isConditionMap(value)) fail('format.href', path, 'a string or a condition map');
    } else if (key === 'items') {
      if (!Array.isArray(value) && !isRecord(value)) fail('format.items', path, 'an array or an object');
      if (isChoiceList(value) && !choicePairs(value)) fail('format.items', path, CHOICE_LIST_EXPECTED);
    }
  }
}

/** Check one column or field declaration at `path`. */
function checkMember(name: string, member: unknown, paths: DisplayPaths): void {
  if (!isRecord(member)) fail(name, paths.members, 'an object');
  const path = `${paths.members}.${name}`;
  closed(member, '', paths.members === 'columns' ? COLUMN_KEYS : FIELD_KEYS, path);
  if (has(member, 'field') && typeof member.field !== 'string') fail('field', path, 'a string');
  if (has(member, 'label') && !isContent(member.label)) fail('label', path, CONTENT);
  if (has(member, 'format')) checkFormat(member.format, path);
  if (has(member, 'design')) checkDesignDeclaration(member.design, path);
  if (has(member, 'sortable')) {
    const sortable = member.sortable;
    if (typeof sortable !== 'boolean' && typeof sortable !== 'string' && !isConditionMap(sortable)) {
      fail('sortable', path, 'a boolean, an expression or a condition map');
    }
  }
}

/** Check one behavior entry of an action at `path`. */
function checkBehaviorEntry(event: string, entry: unknown, path: string): void {
  if (typeof entry === 'string') return;
  if (!isRecord(entry)) fail(`behavior.${event}`, path, 'a script or an object');
  closed(entry, `behavior.${event}.`, SCRIPT_ACTION_KEYS, path);
  if (has(entry, 'label') && !isContent(entry.label)) fail(`behavior.${event}.label`, path, CONTENT);
  if (has(entry, 'script') && typeof entry.script !== 'string') fail(`behavior.${event}.script`, path, 'a string');
}

/** Check one list or detail action at `actions.{name}`. */
function checkAction(name: string, action: unknown): void {
  if (typeof action === 'string') return;
  if (!isRecord(action)) fail(name, 'actions', 'a script or an object');
  const path = `actions.${name}`;
  if (has(action, 'script')) {
    closed(action, '', SCRIPT_ACTION_KEYS, path);
    if (has(action, 'label') && !isContent(action.label)) fail('label', path, CONTENT);
    if (typeof action.script !== 'string') fail('script', path, 'a string');
    return;
  }
  closed(action, '', ACTION_KEYS, path);
  if (has(action, 'label') && !isContent(action.label)) fail('label', path, CONTENT);
  if (has(action, 'format')) checkFormat(action.format, path);
  if (has(action, 'behavior')) {
    const behavior = action.behavior;
    if (typeof behavior !== 'boolean' && !isRecord(behavior)) fail('behavior', path, 'a boolean or an object');
    if (isRecord(behavior)) {
      closed(behavior, 'behavior.', BEHAVIOR_KEYS, path);
      for (const [event, entry] of Object.entries(behavior)) checkBehaviorEntry(event, entry, path);
    }
  }
  if (has(action, 'design')) checkDesignDeclaration(action.design, path);
}

/** Reject a wrong value type or an unknown key in the pagination declaration at `path`. */
function checkPagination(pagination: unknown, path: string): void {
  if (typeof pagination !== 'boolean' && !isRecord(pagination)) fail('pagination', path, 'a boolean or an object');
  if (!isRecord(pagination)) return;
  closed(pagination, 'pagination.', PAGINATION_KEYS, path);
  if (has(pagination, 'per_page') && !(typeof pagination.per_page === 'number' && Number.isSafeInteger(pagination.per_page) && pagination.per_page >= 1)) {
    fail('pagination.per_page', path, 'a positive integer');
  }
  if (has(pagination, 'mode') && !(typeof pagination.mode === 'string' && PAGINATION_MODES.includes(pagination.mode))) {
    fail('pagination.mode', path, 'pages, offset, cursor or none');
  }
}

/** Check the actions declaration of a list or detail at `own`, each action in member order. */
function checkActions(actions: unknown, own: string): void {
  if (!isRecord(actions)) fail('actions', own, 'an object');
  for (const [name, action] of Object.entries(actions)) {
    // Actions are not composed: a composition key is not an action name.
    if (name === '$ref' || name === '$patch') throw new FormInputError(`Invalid ${name} at actions: unknown key`);
    checkAction(name, action);
  }
}

/**
 * Check a composed list or detail specification: the root members, the own design, each column
 * or field in member order and then, for a list, search, sort, actions, empty, description and
 * pagination, and for a detail, actions.
 */
export function checkDisplayDeclarations(spec: Record<string, unknown>, paths: DisplayPaths): void {
  const own = paths.own;
  for (const key of Object.keys(spec)) {
    if (key === '$ref' || key === '$patch') fail(key, own, `composition inside ${paths.members}`);
    if (!(own === 'list' ? LIST_KEYS : DETAIL_KEYS).includes(key)) {
      throw new FormInputError(`Invalid ${key} at ${own}: unknown key`);
    }
  }
  if (has(spec, 'design')) checkDesignDeclaration(spec.design, own);
  const members = spec[paths.members];
  if (!isRecord(members)) fail(paths.members, own, 'an object');
  for (const [name, member] of Object.entries(members)) {
    checkMember(name, member, paths);
  }
  if (own === 'detail') {
    if (has(spec, 'actions')) checkActions(spec.actions, own);
    return;
  }
  if (has(spec, 'search') && typeof spec.search !== 'boolean' && !isRecord(spec.search)) {
    fail('search', own, 'a boolean or an object');
  }
  if (has(spec, 'sort')) {
    const sort = spec.sort;
    if (!isRecord(sort)) fail('sort', own, 'an object');
    closed(sort, 'sort.', SORT_KEYS, own);
    if (has(sort, 'field') && typeof sort.field !== 'string') fail('sort.field', own, 'a string');
    if (has(sort, 'dir') && sort.dir !== 'asc' && sort.dir !== 'desc') fail('sort.dir', own, 'asc or desc');
  }
  if (has(spec, 'actions')) checkActions(spec.actions, own);
  if (has(spec, 'empty') && !isContent(spec.empty)) fail('empty', own, CONTENT);
  if (has(spec, 'description') && !isContent(spec.description)) fail('description', own, CONTENT);
  if (has(spec, 'pagination')) checkPagination(spec.pagination, own);
}
