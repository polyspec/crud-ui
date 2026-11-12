/**
 * Shared string conversion, field paths, names and identifiers.
 * Repeated rows use row keys in field paths; rule paths replace repeated
 * segments with [].
 */

export { styleString } from './css';

/** Whether a value is an object that is not an array, as an object of decoded JSON is. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Whether a value is a plain object: one whose prototype is Object.prototype or null. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** HTML attribute-value escaping. */
export function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** HTML text escaping. */
export function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** PHP (string) cast semantics for scalar spec/data values. */
export function phpString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '';
  // undefined, null, an array, an object and any other value: an empty string.
  return '';
}

/**
 * Expression string conversion of a JSON value: `undefined` → 'undefined', null → 'null',
 * an array → its items joined with ',' (null and undefined items empty), an object →
 * '[object Object]'.
 */
export function jsString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    return v.map((item: unknown) => (item === null || item === undefined ? '' : jsString(item))).join(',');
  }
  return '[object Object]';
}

/** PHP truthiness of an already string-cast value ('' and '0' are falsy). */
export function phpTruthy(s: string): boolean {
  return s !== '' && s !== '0';
}

/** Apply a default only when input data is missing. */
export function applyDefaultString(value: unknown, def: unknown): string {
  const v = phpString(value);
  if (value === undefined && def !== undefined && def !== null && !Array.isArray(def)) {
    return phpString(def);
  }
  return v;
}

/**
 * The condition text of a condition field value (docs/spec/form-markup.md, Condition fields): a
 * string is itself, null and an absent value are empty, and any other value is its JSON text.
 */
export function conditionText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === undefined || v === null) return '';
  return JSON.stringify(v);
}

/**
 * The value of the text of a condition control (docs/spec/form-runtime.md, Condition values): the
 * value of a JSON text, or the text itself when it is not one.
 */
export function decodeConditionText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    // A text that is not a JSON text is the value itself, which the conditionTree rule refuses.
    if (error instanceof SyntaxError) return text;
    throw error;
  }
}

/**
 * Deterministic element id from a field path (DOM-id uniqueness without a magic
 * token). The path is unique per field, so cleanStr(path) is a stable id that is
 * identical across frameworks — no per-render counter, no normalizer mask needed.
 */
export function elementId(prefix: string, path: string): string {
  const base = cleanStr(path).replace(/[^A-Za-z0-9_-]/g, '-');
  return prefix ? `${prefix}-${base}` : base;
}

// ---------------------------------------------------------------------------
// path / name conventions
// ---------------------------------------------------------------------------

/** Parse a dot/bracket path string to segments. */
export function parsePathString(path: string): string[] {
  if (!path) return [];
  const segments: string[] = [];
  let current = '';
  let inBracket = false;
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '[' && !inBracket) {
      if (current) {
        segments.push(current);
        current = '';
      }
      inBracket = true;
    } else if (ch === ']' && inBracket) {
      if (current) {
        segments.push(current);
        current = '';
      }
      inBracket = false;
    } else if (ch === '.' && !inBracket) {
      if (current) {
        segments.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) segments.push(current);
  return segments;
}

/** Whether a value is an object or an array, whose members a path segment names. */
function isIndexable(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/** Read the value at a dot/bracket path. */
export function getValueByPath(obj: unknown, path: string): unknown {
  const segments = parsePathString(path);
  let current: unknown = obj;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (isIndexable(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Convert dot path → bracket notation with optional key prefix. */
export function toBracketNotationWithPrefix(path: string, keyPrefix?: string): string {
  if (!path) return keyPrefix ? `${keyPrefix}[]` : '';
  const segments = parsePathString(path);
  if (keyPrefix) segments.unshift(keyPrefix);
  if (segments.length === 0) return '';
  if (segments.length === 1) return segments[0];
  return segments[0] + segments.slice(1).map((s) => `[${s}]`).join('');
}

/**
 * Replace bracket notation for an id: `[]` → '', `][`/`[`/`]` → '-'.
 * Used to derive deterministic element ids from bracket-notation names
 * (choice/multichoice/search) — paired with elementId() (path-derived, stable
 * across frameworks). No random token, no normalizer mask.
 */
export function cleanStr(s: string): string {
  return s
    .split('[]').join('')
    .split('][').join('-')
    .split('[').join('-')
    .split(']').join('-');
}

function pathSegmentsLoose(path: string): string[] {
  return path
    .replace(/\[([^\]]*)\]/g, '.$1')
    .split('.')
    .filter((s) => s !== '');
}

/** A path without its trailing `[]` (`p`), that suffix and the loose segments of the path without it. */
function splitRowSuffix(path: string): { p: string; suffix: string; segments: string[] } {
  const suffix = path.endsWith('[]') ? '[]' : '';
  const p = suffix ? path.slice(0, -2) : path;
  return { p, suffix, segments: pathSegmentsLoose(p) };
}

/** Leaf data-name for a dot path. A repeated row segment collapses to `name[]`. */
export function leafName(path: string, rowSegments: readonly number[] = []): string {
  const { p, suffix, segments } = splitRowSuffix(path);
  const last = segments[segments.length - 1] ?? p;
  if (rowSegments.includes(segments.length - 1)) {
    return (segments[segments.length - 2] ?? '') + '[]';
  }
  return last + suffix;
}

/** data-rule-name for a dot path: bracket notation relative to the form root. */
export function ruleNameForPath(path: string, rowSegments: readonly number[] = []): string {
  const { p, suffix, segments } = splitRowSuffix(path);
  if (segments.length <= 1) return (segments[0] ?? p) + suffix;
  return (
    segments[0] +
    segments
      .slice(1)
      .map((s, i) => (rowSegments.includes(i + 1) ? '[]' : `[${s}]`))
      .join('') +
    suffix
  );
}

/** Join class tokens, dropping empties and deduping whitespace. */
export function joinClass(...parts: Array<string | undefined | false>): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Encode a form scope and field path without collapsing distinct names. */
export function controlId(prefix: string, path: string): string {
  return `${encodeURIComponent(prefix)}:${encodeURIComponent(path)}`;
}

/** `name` as a reference token of a JSON Pointer (RFC 6901, section 3). */
export const pointerToken = (name: string): string => name.replace(/~/g, '~0').replace(/\//g, '~1');

// The URL scheme check accepts the control characters that HTML ignores within a scheme.
// eslint-disable-next-line no-control-regex -- URL scheme recognition includes the control characters ignored by HTML
const javascriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;

/** Replace a JavaScript URL with the throwing URL required by CUDF-023. */
export function sanitizeUrl(value: string): string {
  return javascriptProtocol.test(value)
    ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
    : value;
}
