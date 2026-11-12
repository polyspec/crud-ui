/**
 * Path Resolution Module
 *
 * Handles resolution of:
 * - Relative paths (., .., ...)
 * - Absolute paths
 * - Array wildcards (*)
 * - Array indices
 */

import { isRecord } from '../record';
import { parseCondition, ParseError } from './ConditionParser';
import {
  PathNode,
  PathContext,
  WildcardStrategy,
  ASTNode,
  BinaryNode,
  UnaryNode,
  InNode,
  TernaryNode,
} from '../types';

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Resolve a path node to an array of absolute path segments
 */
function resolvePathSegments(
  pathNode: PathNode,
  context: PathContext
): string[] {
  const { currentPath } = context;
  const { relative, levelsUp, segments } = pathNode;

  let basePath: string[];

  if (relative) {
    // The current field is one level and each further dot moves one more level up; a row key
    // and the name of its collection leave together (expressions.md, "Evaluation").
    basePath = [...currentPath];
    const rowKeys = context.rowKeys ?? [];
    for (let level = 0; level <= levelsUp && basePath.length > 0; level++) {
      const leaving = rowKeys.includes(basePath.length - 1) ? 2 : 1;
      basePath.length = Math.max(0, basePath.length - leaving);
    }
  } else {
    // Absolute path starts from root
    basePath = [];
  }

  // Add path segments
  for (const segment of segments) {
    if (segment.type === 'identifier') {
      basePath.push(segment.value);
    } else if (segment.type === 'index') {
      basePath.push(String(segment.value));
    } else if (segment.type === 'wildcard') {
      basePath.push('*');
    }
  }

  return basePath;
}

/**
 * Get value by path from data object
 */
export function getValueByPath(
  data: object,
  path: string[]
): unknown {
  let current: unknown = data;

  for (const segment of path) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === 'object') {
      // A property read, as `current[segment]` reads it: an index of an array or a member of an object.
      const next: unknown = Reflect.get(current, segment);
      current = next;
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Find the array path and remaining path after wildcard
 */
function findWildcardPosition(path: string[]): {
  arrayPath: string[];
  remainingPath: string[];
  wildcardIndex: number;
} | null {
  const wildcardIndex = path.indexOf('*');
  if (wildcardIndex === -1) {
    return null;
  }

  return {
    arrayPath: path.slice(0, wildcardIndex),
    remainingPath: path.slice(wildcardIndex + 1),
    wildcardIndex,
  };
}

/**
 * Resolve path with wildcard to multiple concrete values
 */
function resolveWildcardPath(
  path: string[],
  formData: Record<string, unknown>,
  currentIndex?: number
): {
  /** Concrete path segments with each wildcard replaced by an actual index. */
  path: string[];
  /** Value found at the resolved concrete path. */
  value: unknown;
}[] {
  const wildcardInfo = findWildcardPosition(path);

  if (!wildcardInfo) {
    // No wildcard, return single value
    return [{ path, value: getValueByPath(formData, path) }];
  }

  const { arrayPath, remainingPath } = wildcardInfo;
  const arrayData = getValueByPath(formData, arrayPath);

  // Handle object data (e.g., from multiple: "only" pattern)
  // Treat the object as if accessing properties directly without index
  if (arrayData !== null && typeof arrayData === 'object' && !Array.isArray(arrayData)) {
    // For objects, skip the wildcard index and access remaining path directly
    const concretePath = [...arrayPath, ...remainingPath];
    // Recursively resolve any remaining wildcards
    const resolved = resolveWildcardPath(concretePath, formData);
    return resolved;
  }

  if (!Array.isArray(arrayData)) {
    return [];
  }

  const results: { path: string[]; value: unknown }[] = [];

  // If currentIndex is provided and path matches current array context
  if (currentIndex !== undefined) {
    const concretePath = [
      ...arrayPath,
      String(currentIndex),
      ...remainingPath,
    ];
    // Recursively resolve any remaining wildcards
    const resolved = resolveWildcardPath(concretePath, formData);
    results.push(...resolved);
  } else {
    // Resolve for all array indices
    for (let i = 0; i < arrayData.length; i++) {
      const concretePath = [...arrayPath, String(i), ...remainingPath];
      // Recursively resolve any remaining wildcards
      const resolved = resolveWildcardPath(concretePath, formData);
      results.push(...resolved);
    }
  }

  return results;
}

/**
 * Check if path contains a wildcard
 */
function hasWildcard(path: string[]): boolean {
  return path.includes('*');
}

/**
 * Replace wildcard with current index in path
 */
function replaceWildcardWithIndex(
  path: string[],
  currentPath: string[]
): string[] {
  const result: string[] = [];
  let currentArrayIndex = 0;

  // Find array indices in current path
  const arrayIndices: number[] = [];
  for (const segment of currentPath) {
    if (/^\d+$/.test(segment)) {
      arrayIndices.push(parseInt(segment, 10));
    }
  }

  for (const segment of path) {
    if (segment === '*') {
      // Use the corresponding array index from current path
      const index = arrayIndices[currentArrayIndex];
      if (index !== undefined) {
        result.push(String(index));
        currentArrayIndex++;
      } else {
        // No matching index, keep wildcard for later resolution
        result.push('*');
      }
    } else {
      result.push(segment);
    }
  }

  return result;
}

// ============================================================================
// Condition Evaluation
// ============================================================================

/**
 * Evaluate an AST node with the given context
 */
export function evaluateCondition(
  node: ASTNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy = 'CURRENT'
): boolean {
  switch (node.type) {
    case 'Binary':
      return evaluateBinary(node, context, wildcardStrategy);
    case 'Unary':
      return evaluateUnary(node, context, wildcardStrategy);
    case 'In':
      return evaluateIn(node, context, wildcardStrategy);
    case 'Group':
      return evaluateCondition(node.expression, context, wildcardStrategy);
    case 'Ternary':
      // For ternary in boolean context, evaluate and convert result to boolean
      return Boolean(evaluateTernary(node, context, wildcardStrategy));
    case 'Path':
    case 'Literal':
      // Truthy check for standalone values
      return Boolean(resolveValue(node, context, wildcardStrategy));
    default:
      return false;
  }
}

/**
 * Evaluate an AST node and return the actual value (not just boolean)
 * This is used for ternary expressions that return values like numbers
 * For non-ternary expressions (conditions), returns boolean
 */
export function evaluateExpressionValue(
  node: ASTNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy = 'CURRENT'
): unknown {
  switch (node.type) {
    case 'Ternary':
      // Ternary expressions return their actual evaluated value
      return evaluateTernary(node, context, wildcardStrategy);
    case 'Group':
      // For grouped expressions, check if inner is ternary
      return evaluateExpressionValue(node.expression, context, wildcardStrategy);
    case 'Binary':
    case 'Unary':
    case 'In':
    case 'Path':
    case 'Literal':
      // All other expressions return boolean (for conditions like ".field == 1" or ".field")
      return evaluateCondition(node, context, wildcardStrategy);
    default:
      return undefined;
  }
}

/**
 * Resolve a ternary branch value - returns the actual value of the node
 * Used by ternary evaluation to get the raw value of trueValue/falseValue
 */
function resolveTernaryBranchValue(
  node: ASTNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy
): unknown {
  switch (node.type) {
    case 'Ternary':
      // Nested ternary
      return evaluateTernary(node, context, wildcardStrategy);
    case 'Group':
      return resolveTernaryBranchValue(node.expression, context, wildcardStrategy);
    case 'Literal':
      return node.value;
    case 'Path':
      return resolveValue(node, context, wildcardStrategy);
    case 'Binary':
      return evaluateBinary(node, context, wildcardStrategy);
    case 'Unary':
      return evaluateUnary(node, context, wildcardStrategy);
    case 'In':
      return evaluateIn(node, context, wildcardStrategy);
    default:
      return undefined;
  }
}

/**
 * Evaluate a ternary expression and return the actual value
 */
function evaluateTernary(
  node: TernaryNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy
): unknown {
  const conditionResult = evaluateCondition(node.condition, context, wildcardStrategy);
  if (conditionResult) {
    return resolveTernaryBranchValue(node.trueValue, context, wildcardStrategy);
  } else {
    return resolveTernaryBranchValue(node.falseValue, context, wildcardStrategy);
  }
}

function evaluateBinary(
  node: BinaryNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy
): boolean {
  const { operator, left, right } = node;

  // Short-circuit evaluation for logical operators
  if (operator === '&&') {
    return (
      evaluateCondition(left, context, wildcardStrategy) &&
      evaluateCondition(right, context, wildcardStrategy)
    );
  }

  if (operator === '||') {
    return (
      evaluateCondition(left, context, wildcardStrategy) ||
      evaluateCondition(right, context, wildcardStrategy)
    );
  }

  // Comparison operators
  const leftValue = resolveOperand(left, context, wildcardStrategy);
  const rightValue = resolveValue(right, context, wildcardStrategy);

  // The candidates of a wildcard path; an array that a plain path names is one value.
  if (leftValue instanceof WildcardCandidates) {
    return evaluateWithStrategy(
      leftValue.values,
      (lv) => compare(lv, rightValue, operator),
      wildcardStrategy
    );
  }

  return compare(leftValue, rightValue, operator);
}

function evaluateUnary(
  node: UnaryNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy
): boolean {
  if (node.operator === '!') {
    return !evaluateCondition(node.operand, context, wildcardStrategy);
  }
  return false;
}

function evaluateIn(
  node: InNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy
): boolean {
  const value = resolveOperand(node.value, context, wildcardStrategy);
  const list = node.list.map((item) =>
    resolveValue(item, context, wildcardStrategy)
  );

  // The candidates of a wildcard path; an array that a plain path names is one value.
  if (value instanceof WildcardCandidates) {
    const check = (v: unknown) => {
      const included = list.some((item) => looseEquals(v, item));
      return node.negated ? !included : included;
    };
    return evaluateWithStrategy(value.values, check, wildcardStrategy);
  }

  const included = list.some((item) => looseEquals(value, item));
  return node.negated ? !included : included;
}

function evaluateWithStrategy(
  values: unknown[],
  predicate: (value: unknown) => boolean,
  strategy: WildcardStrategy
): boolean {
  switch (strategy) {
    case 'ANY':
      return values.some(predicate);
    case 'ALL':
      return values.every(predicate);
    case 'NONE':
      return values.every((v) => !predicate(v));
    case 'CURRENT':
      // Should not reach here if properly resolved
      return values.length > 0 ? predicate(values[0]) : false;
    default:
      return false;
  }
}

/** The values that a path with an unresolved wildcard names, each a candidate of a comparison. */
class WildcardCandidates {
  constructor(readonly values: unknown[]) {}
}

/**
 * Resolve the left operand of a comparison: the candidates of a wildcard path, or the one value of any other node.
 */
function resolveOperand(
  node: ASTNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy
): unknown {
  return node.type === 'Path'
    ? resolvePath(node, context, wildcardStrategy)
    : resolveValue(node, context, wildcardStrategy);
}

/**
 * Resolve an AST node to its value
 */
function resolveValue(
  node: ASTNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy
): unknown {
  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Path': {
      const value = resolvePath(node, context, wildcardStrategy);
      return value instanceof WildcardCandidates ? value.values : value;
    }

    case 'Group':
      return evaluateCondition(node.expression, context, wildcardStrategy);

    default:
      return undefined;
  }
}

/** Resolve a path to its value, or to the candidates of a wildcard that the context does not resolve. */
function resolvePath(
  node: PathNode,
  context: PathContext,
  wildcardStrategy: WildcardStrategy
): unknown {
  let resolvedPath = resolvePathSegments(node, context);

  // Handle wildcard in path
  if (hasWildcard(resolvedPath)) {
    if (wildcardStrategy === 'CURRENT') {
      // Replace wildcards with current indices
      resolvedPath = replaceWildcardWithIndex(
        resolvedPath,
        context.currentPath
      );
    }

    if (hasWildcard(resolvedPath)) {
      // Still has wildcards, resolve to array of values
      const resolved = resolveWildcardPath(
        resolvedPath,
        context.formData
      );
      return new WildcardCandidates(resolved.map((r) => r.value));
    }
  }

  return getValueByPath(
    context.formData,
    resolvedPath
  );
}

/**
 * Compare two values with the given operator
 */
function compare(
  left: unknown,
  right: unknown,
  operator: BinaryNode['operator']
): boolean {
  switch (operator) {
    case '==':
      return looseEquals(left, right);
    case '!=':
      return !looseEquals(left, right);
    case '>':
      return coerceNumber(left) > coerceNumber(right);
    case '>=':
      return coerceNumber(left) >= coerceNumber(right);
    case '<':
      return coerceNumber(left) < coerceNumber(right);
    case '<=':
      return coerceNumber(left) <= coerceNumber(right);
    default:
      return false;
  }
}

/**
 * Loose equality comparison (like JavaScript ==)
 * Handles string/number comparisons; two arrays or two objects compare as JSON values.
 */
function looseEquals(a: unknown, b: unknown): boolean {
  // Same type comparison
  if (typeof a === typeof b) {
    return typeof a === 'object' ? jsonEquals(a, b) : a === b;
  }

  // null/undefined comparison
  if (a === null || a === undefined) {
    return b === null || b === undefined;
  }
  if (b === null || b === undefined) {
    return false;
  }

  // Numeric comparison when both scalars convert to numbers
  const aNum = equalityNumber(a);
  const bNum = equalityNumber(b);
  if (aNum !== undefined && bNum !== undefined) {
    return aNum === bNum;
  }

  return equalityString(a) === equalityString(b);
}

/**
 * JSON-value structural equality (docs/spec/expressions.md, Evaluation): two arrays hold equal elements in the same
 * order, two objects the same keys with equal values in any key order; other values compare without conversion,
 * numbers by value. An array never equals an object or null.
 */
function jsonEquals(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((item, index) => jsonEquals(item, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const left = a;
    const right = b;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length
      && keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && jsonEquals(left[key], right[key]));
  }
  return a === b;
}

/**
 * The number of a scalar for `==`: a number itself, a boolean 1 or 0, a string its
 * `Number()` value when that is not NaN. An array or an object has none.
 */
function equalityNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isNaN(num) ? undefined : num;
  }
  return undefined;
}

/** The text of a scalar for `==`; an array or an object is the empty string. */
function equalityString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * Coerce a value to a number for condition comparison.
 * Deliberately lenient (PHP ConditionParser::toNumber parity).
 * Not to be confused with the strict src/rules/min.ts toNumber used by
 * value-validation rules.
 */
function coerceNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return 0;
}

// ============================================================================
// Field Reference Resolution (display_target etc.)
// ============================================================================

/**
 * Resolve a simple field reference expression to its value.
 *
 * Supports:
 * - ".field" / "..field" relative references, a row being one level
 * - "a.b.c" references from the data root with wildcard support
 * - a bare "field", resolved as ".field"
 */
export function resolveFieldReference(
  expression: string,
  context: PathContext
): unknown {
  const trimmed = expression.trim();
  if (trimmed === '') {
    return undefined;
  }

  const formData = context.formData;

  // Count leading dots; a bare name without dots is the field beside the current one, as `.name`.
  let dots = 0;
  while (dots < trimmed.length && trimmed[dots] === '.') {
    dots++;
  }

  if (dots > 0 || !trimmed.includes('.')) {
    const fieldPath = trimmed.slice(dots);
    const pathNode: PathNode = {
      type: 'Path',
      relative: true,
      levelsUp: Math.max(0, dots - 1),
      segments: parsePathString(fieldPath).map((s) =>
        s === '*'
          ? ({ type: 'wildcard' } as const)
          : ({ type: 'identifier', value: s } as const)
      ),
      position: { start: 0, end: trimmed.length },
    };

    let resolved = resolvePathSegments(pathNode, context);
    if (hasWildcard(resolved)) {
      resolved = replaceWildcardWithIndex(resolved, context.currentPath);
    }
    return getValueByPath(formData, resolved);
  }

  // A path with dots inside (e.g., "common.is_display") resolves from the root.
  let segments = parsePathString(trimmed);
  if (hasWildcard(segments)) {
    segments = replaceWildcardWithIndex(segments, context.currentPath);
  }
  return getValueByPath(formData, segments);
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Parse a path string into segments
 */
export function parsePathString(pathString: string): string[] {
  if (!pathString) {
    return [];
  }
  return pathString.split('.').filter((s) => s.length > 0);
}

/**
 * Convert path segments to path string
 * Uses dot notation for all segments, including numeric indices and
 * unique keys (e.g., "items.0.code") to match fixture expectations.
 */
export function pathToString(path: string[]): string {
  return path.join('.');
}

/**
 * Get field name from path
 */
export function getFieldName(path: string[]): string {
  return path[path.length - 1] ?? '';
}

/** The truth value of a condition, or false when the expression does not parse; any other failure surfaces. */
export function evaluateConditionOrFalse(expression: string, context: PathContext): boolean {
  try {
    return evaluateCondition(parseCondition(expression), context, 'CURRENT');
  } catch (error) { if (!(error instanceof ParseError)) throw error;
    return false;
  }
}

/** The value of an expression, or false when the expression does not parse; any other failure surfaces. */
export function evaluateExpressionValueOrFalse(expression: string, context: PathContext): unknown {
  try {
    return evaluateExpressionValue(parseCondition(expression), context, 'CURRENT');
  } catch (error) { if (!(error instanceof ParseError)) throw error;
    return false;
  }
}
