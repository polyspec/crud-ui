/**
 * The CRUDUI pattern language (validation-rules.md, "Patterns").
 *
 * A pattern is recognized with the language's grammar and matched by the
 * package's own linear-time matcher over the embedded Unicode data. No
 * regular-expression engine ever sees a declared pattern.
 */

import { recognizePattern } from './recognizer';
import { PatternMatcher } from './matcher';

export { recognizePattern } from './recognizer';
export { PatternMatcher } from './matcher';
export { PatternSyntaxError } from './errors';

const compiled = new Map<string, PatternMatcher>();

/**
 * The compiled matcher of a pattern, compiled once per pattern string.
 *
 * @throws {PatternSyntaxError} when the pattern is outside the language.
 */
export function compilePattern(pattern: string): PatternMatcher {
  let matcher = compiled.get(pattern);
  if (!matcher) {
    matcher = new PatternMatcher(recognizePattern(pattern));
    compiled.set(pattern, matcher);
  }
  return matcher;
}
