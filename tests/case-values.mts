// The cases of the shared fixtures in the form of the generated tests of binding (G-5): a file is an object of groups,
// each group a list of cases; a case names the arguments of the operation by their parameter names and writes a value
// of the value type `json_value` as `{ kind, value }` (`null` without a value, `bool`, `number` with its literal as
// text, `text`, `list` with its items, `map` with its `[name, value]` pairs in order).

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The JSON value of a value in the case form; a number is the double of its literal. */
export function caseValue(value: unknown): unknown {
  if (!isRecord(value) || typeof value.kind !== 'string') throw new Error(`not a value in the case form: ${JSON.stringify(value)}`);
  switch (value.kind) {
    case 'null': return null;
    case 'bool': case 'text': return value.value;
    case 'number': return Number(value.value);
    case 'list': {
      if (!Array.isArray(value.value)) throw new Error('a list value holds no array');
      return value.value.map(caseValue);
    }
    case 'map': {
      if (!Array.isArray(value.value)) throw new Error('a map value holds no array');
      const members: Record<string, unknown> = {};
      for (const pair of value.value as unknown[]) {
        if (!Array.isArray(pair) || typeof pair[0] !== 'string') throw new Error(`a map member is no [name, value] pair: ${JSON.stringify(pair)}`);
        Object.defineProperty(members, pair[0], { value: caseValue(pair[1]), enumerable: true, writable: true, configurable: true });
      }
      return members;
    }
    default: throw new Error(`unknown value kind ${value.kind}`);
  }
}

/** The cases of the group `group` of a case file. */
export function caseGroup(file: unknown, group = 'cases'): Record<string, unknown>[] {
  if (!isRecord(file) || !Array.isArray(file[group])) throw new Error(`the case file has no group ${group}`);
  return (file[group] as unknown[]).map((item, index) => {
    if (!isRecord(item)) throw new Error(`case ${index} of ${group} is no object`);
    return item;
  });
}

/** The composition files of the options of a case, decoded; undefined when the case gives none. */
export function caseFiles(item: Record<string, unknown>): Record<string, unknown> | undefined {
  const options = item.options;
  if (!isRecord(options) || !isRecord(options.files)) return undefined;
  return Object.fromEntries(Object.entries(options.files).map(([name, file]) => [name, caseValue(file)]));
}
