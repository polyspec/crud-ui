/** One CSS declaration, retaining its complete value and declaration order. */
export type StyleDeclaration = readonly [property: string, value: string];

/** Split inline CSS only at separators outside strings, comments and blocks. */
export function parseStyle(style: unknown): StyleDeclaration[] {
  if (typeof style !== 'string' || !style.trim()) return [];
  const declarations: StyleDeclaration[] = [];
  const blocks: string[] = [];
  let quote = '', escaped = false, comment = false;
  let start = 0, colon = -1;
  const finish = (end: number) => {
    if (colon >= start) {
      const property = style.slice(start, colon).replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
      const value = style.slice(colon + 1, end).trim();
      if (property && value) declarations.push([property, value]);
    }
    start = end + 1;
    colon = -1;
  };
  for (let index = 0; index < style.length; index++) {
    const character = style[index];
    if (comment) {
      if (character === '*' && style[index + 1] === '/') { comment = false; index++; }
      continue;
    }
    if (escaped) { escaped = false; continue; }
    if (character === '\\') { escaped = true; continue; }
    if (quote) { if (character === quote) quote = ''; continue; }
    if (character === '/' && style[index + 1] === '*') { comment = true; index++; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '(' || character === '[' || character === '{') { blocks.push(character); continue; }
    const closing = character === ')' ? '(' : character === ']' ? '[' : character === '}' ? '{' : '';
    if (closing) { if (blocks[blocks.length - 1] === closing) blocks.pop(); continue; }
    if (blocks.length) continue;
    if (character === ':' && colon === -1) colon = index;
    else if (character === ';') finish(index);
  }
  finish(style.length);
  return declarations;
}

/** Normalize declaration spacing without changing values or repeated properties. */
export function styleString(style: unknown): string | undefined {
  const declarations = parseStyle(style);
  return declarations.length ? declarations.map(([property, value]) => `${property}: ${value}`).join('; ') : undefined;
}
