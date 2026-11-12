/** Evaluate form visibility and appearance using the shared expression engine. */
import {
  parseCondition,
  isConditionExpression,
  evaluateExpressionValue,
  evaluateConditionOrFalse,
  evaluateExpressionValueOrFalse,
  ParseError,
} from '@polyspec/crudui-validator/internal';
import type { PathContext } from '@polyspec/crudui-validator';
import { isRecord, jsString } from './util';

/**
 * Build the engine PathContext for a field at `currentPath` over `formData`; `rowKeys` are the
 * positions of the row keys in the path, so a row is one level of a relative path.
 */
export function makeContext(
  currentPath: string[],
  formData: Record<string, unknown>,
  rowKeys: readonly number[] = []
): PathContext {
  return { currentPath, rowKeys, formData };
}

function evalConditionBool(expression: string, context: PathContext): boolean {
  return evaluateConditionOrFalse(expression, context);
}

function evalExpressionValue(expression: string, context: PathContext): unknown {
  return evaluateExpressionValueOrFalse(expression, context);
}

/** Evaluate a complete ternary AST; other strings remain literal values. */
function tryEvaluateTernary(
  expression: string,
  context: PathContext
): { handled: boolean; value?: unknown } {
  try {
    const node = parseCondition(expression);
    if (node.type !== 'Ternary') return { handled: false };
    return { handled: true, value: evaluateExpressionValue(node, context) };
  } catch (error) { if (!(error instanceof ParseError)) throw error;
    return { handled: false };
  }
}

/**
 * Evaluate a ConditionMap (expressions.md §8): walk keys in declaration
 * order, return the value of the first truthy key; else the `true` default key;
 * else null.
 */
function resolveConditionMap(
  map: Record<string, unknown>,
  context: PathContext
): unknown {
  for (const key of Object.keys(map)) {
    if (key === 'true') continue;
    if (evalConditionBool(key, context)) return map[key];
  }
  if ('true' in map) return map.true;
  return null;
}

// ---------------------------------------------------------------------------
// public dispatchers (the only surfaces the renderer calls)
// ---------------------------------------------------------------------------

/**
 * A boolean flag other than visibility (e.g. a list column's `sortable`) →
 * boolean. Absent = false. An expression is evaluated as a condition; a
 * condition map selecting nothing is false; failures are false.
 */
export function evalFlag(
  value: unknown,
  context: PathContext
): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (isRecord(value)) {
    return Boolean(resolveConditionMap(value, context));
  }
  if (typeof value === 'string') {
    return evalConditionBool(value, context);
  }
  return Boolean(value);
}

/** Whether a string is a well-formed expression. */
function isValidExpression(expression: string): boolean {
  try {
    parseCondition(expression);
    return true;
  } catch (error) { if (!(error instanceof ParseError)) throw error;
    return false;
  }
}

/**
 * `design.show` → boolean, by the validators' visibility rule: the value is
 * resolved like a conditional parameter and only a resolved `false` hides.
 * Absent = visible; a condition map selecting nothing, a literal string (not a
 * valid expression) and any other literal are visible; a ternary yields its
 * branch value (an unevaluable ternary stays a literal); a bare expression
 * yields its value, and an evaluation failure is `false`.
 */
export function evalShow(
  value: unknown,
  context: PathContext
): boolean {
  return resolveShow(value, context) !== false;
}

function resolveShow(value: unknown, context: PathContext): unknown {
  if (isRecord(value)) {
    return resolveConditionMap(value, context);
  }
  if (typeof value !== 'string') return value;
  const ternary = tryEvaluateTernary(value, context);
  if (ternary.handled) return ternary.value;
  if (isConditionExpression(value) && !/\?[^:]*:/.test(value) && isValidExpression(value)) {
    return evalExpressionValue(value, context);
  }
  return value;
}

/**
 * `design.class` / `design.style` → string. Mirrors validator.ts
 * resolveRuleValue: object → condition map; string → ternary value-return, else
 * a bare condition expression that parses completely returns its evaluated value,
 * else the literal.
 * A non-string literal is returned as-is (then string-cast by the caller).
 */
export function evalAppearance(
  value: unknown,
  context: PathContext
): string {
  if (value === undefined || value === null) return '';
  if (isRecord(value)) {
    const resolved = resolveConditionMap(value, context);
    return resolved === null || resolved === undefined ? '' : jsString(resolved);
  }
  if (typeof value === 'string') {
    const ternary = tryEvaluateTernary(value, context);
    if (ternary.handled) {
      return ternary.value === null || ternary.value === undefined
        ? ''
        : jsString(ternary.value);
    }
    // A bare condition expression (no ternary) that parses completely returns its
    // evaluated value; any other string is a literal.
    if (isConditionExpression(value) && !/\?[^:]*:/.test(value) && isValidExpression(value)) {
      const v = evalExpressionValue(value, context);
      return v === null || v === undefined || v === false ? '' : jsString(v);
    }
    // Plain literal class/style string.
    return value;
  }
  return jsString(value);
}
