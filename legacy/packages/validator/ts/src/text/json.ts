/** Parse JSON without discarding repeated object members. */
export function parseJsonDocument(source: string): unknown {
  const value: unknown = JSON.parse(source);
  let position = 0;
  const whitespace = () => {
    while (/\s/.test(source[position] ?? '') && position < source.length) position++;
  };
  const string = () => {
    const start = position++;
    while (position < source.length) {
      if (source[position] === '\\') {
        position += 2;
      } else if (source[position++] === '"') {
        const text: unknown = JSON.parse(source.slice(start, position));
        if (typeof text !== 'string') throw new SyntaxError(`No JSON string at ${start}`);
        return text;
      }
    }
    throw new SyntaxError(`Unterminated JSON string at ${start}`);
  };
  const scan = (): void => {
    whitespace();
    const token = source[position];
    if (token === '"') {
      string();
    } else if (token === '{') {
      position++;
      whitespace();
      const names = new Set<string>();
      while (source[position] !== '}') {
        const offset = position;
        const name = string();
        if (names.has(name)) throw new SyntaxError(`Repeated JSON member ${JSON.stringify(name)} at ${offset}`);
        names.add(name);
        whitespace();
        position++; // colon; JSON.parse already checked the grammar.
        scan();
        whitespace();
        if (source[position] !== ',') break;
        position++;
        whitespace();
      }
      position++; // closing brace
    } else if (token === '[') {
      position++;
      whitespace();
      while (source[position] !== ']') {
        scan();
        whitespace();
        if (source[position] !== ',') break;
        position++;
      }
      position++; // closing bracket
    } else {
      while (position < source.length && !/[\s,}\]]/.test(source[position])) position++;
    }
  };
  scan();
  return value;
}
