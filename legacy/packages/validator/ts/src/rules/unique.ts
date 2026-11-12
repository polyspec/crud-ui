/**
 * Unique validation rule
 *
 * Validates that all values in an array are unique.
 *
 * Two invocation modes:
 * 1. Array-level: the field value itself is an array (e.g., multiple text
 *    field) - all non-empty elements must be unique.
 * 2. Item-level: the field is a scalar inside a repeated group (array index
 *    or __xxxx__ unique-key parent) - the value must not duplicate the same
 *    field of any EARLIER sibling item. The error is therefore reported on
 *    the later (duplicate) item, matching fixture expectations
 *    (e.g., field "items.1.code").
 *
 * A string param that is a condition expression acts as a filter: only items
 * for which the condition holds participate in the uniqueness check.
 */

import { isRecord } from '../record';
import { RuleDefinition, ValidationContext } from '../types';
import { isEmpty } from './required';
import {
  getValueByPath,
  parsePathString,
  evaluateCondition,
} from '../parser/PathResolver';
import { parseCondition, isConditionExpression, ParseError } from '../parser/ConditionParser';

/**
 * The canonical key of a value for `unique` (docs/spec/validation-rules.md): equal keys mean the
 * same JSON value. Every value carries its type, strings are JSON-escaped, numbers are written by
 * their exact value, lists keep their order and object members are sorted by name at every depth,
 * so no encoding of one type can be read as another.
 */
function canonicalKey(value: unknown): string {
  if (value === null) return 'z';
  if (typeof value === 'boolean') return value ? 'b1' : 'b0';
  // String(-0) is "0", so -0 and 0 are the same number.
  if (typeof value === 'number') return `n${String(value)}`;
  if (typeof value === 'string') return `s${JSON.stringify(value)}`;
  if (Array.isArray(value)) return `a[${value.map(canonicalKey).join(',')}]`;
  if (isRecord(value)) {
    const members = Object.keys(value).sort()
      .map(name => `${JSON.stringify(name)}:${canonicalKey(value[name])}`);
    return `o{${members.join(',')}}`;
  }
  // The values outside JSON: undefined (a missing member), bigint, symbol and function.
  switch (typeof value) {
    case 'undefined':
      return 'uundefined';
    case 'bigint':
    case 'symbol':
    case 'function':
      return `u${value.toString()}`;
  }
  throw new TypeError(`unique: no canonical key for a value of type ${typeof value}`);
}

/**
 * Check if all values in array are unique
 */
function areAllUnique(values: unknown[]): boolean {
  const seen = new Set<string>();

  for (const value of values) {
    const key = canonicalKey(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }

  return true;
}

/**
 * Extract values from array items by field name
 */
function extractFieldValues(items: unknown[], fieldName: string): unknown[] {
  const values: unknown[] = [];

  for (const item of items) {
    if (typeof item === 'object' && item !== null) {
      const path = parsePathString(fieldName);
      const value = getValueByPath(item, path);
      // Only include non-empty values
      if (!isEmpty(value)) {
        values.push(value);
      }
    }
  }

  return values;
}

/**
 * Evaluate a filter condition for a sibling item.
 * The condition is evaluated as if validating the same field on that item.
 */
function itemPassesCondition(
  condition: string,
  itemFieldPath: string[],
  rowKeys: readonly number[],
  allData: Record<string, unknown>
): boolean {
  try {
    const ast = parseCondition(condition);
    return evaluateCondition(
      ast,
      { currentPath: itemFieldPath, rowKeys, formData: allData },
      'CURRENT'
    );
  } catch (error) { if (!(error instanceof ParseError)) throw error;
    return false;
  }
}

/**
 * Unique rule definition
 */
export const uniqueRule: RuleDefinition = {
  validate(context: ValidationContext): string | null {
    const { value, ruleParam, messages, allData, pathSegments, rowKeys, run } = context;

    // Skip if rule is disabled
    if (ruleParam === false || ruleParam === null || ruleParam === undefined) {
      return null;
    }

    const isFilterCondition =
      typeof ruleParam === 'string' && isConditionExpression(ruleParam);

    const errorMessage = messages?.unique ?? 'Values must be unique.';

    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      // Array-level validation: the field value is the array itself
      const entries: [string, unknown][] = Object.entries(value);
      const elements = entries.map(([, element]) => element);
      let valuesToCheck: unknown[];

      if (isFilterCondition) {
        // Only elements whose item context passes the condition participate.
        // Evaluate condition once per item.
        valuesToCheck = [];
        for (const [key, element] of entries) {
          const itemPath = [...pathSegments, key];
          if (!itemPassesCondition(ruleParam, itemPath, [...rowKeys, pathSegments.length], allData)) {
            continue;
          }
          if (!isEmpty(element)) {
            valuesToCheck.push(element);
          }
        }
      } else if (typeof ruleParam === 'string') {
        // Param is a field name within array items
        valuesToCheck = extractFieldValues(elements, ruleParam);
      } else {
        valuesToCheck = elements.filter((v) => !isEmpty(v));
      }

      if (valuesToCheck.length === 0) {
        return null;
      }

      if (!areAllUnique(valuesToCheck)) {
        return errorMessage;
      }

      return null;
    }

    // Item-level validation: scalar field inside a repeated group.
    // Parent layout: <containerPath>.<itemKey>.<fieldName>
    if (pathSegments.length < 2) {
      return null;
    }

    const fieldName = pathSegments[pathSegments.length - 1];
    const itemKey = pathSegments[pathSegments.length - 2];
    const containerPath = pathSegments.slice(0, -2);
    const container = getValueByPath(allData, containerPath);

    // Rows are list items or members of an object keyed by unique keys (__xxxx__ format)
    let rows: unknown[] | Record<string, unknown>;
    if (Array.isArray(container)) {
      if (!/^\d+$/.test(itemKey)) return null;
      rows = container;
    } else if (isRecord(container)) {
      rows = container;
    } else {
      return null;
    }

    // Skip empty values (they never count as duplicates)
    if (isEmpty(value)) {
      return null;
    }

    // If a filter condition exists and the current item does not satisfy it,
    // the current item is excluded from the uniqueness check entirely
    if (
      isFilterCondition &&
      !itemPassesCondition(ruleParam, pathSegments, rowKeys, allData)
    ) {
      return null;
    }

    // The rows of this collection field are walked once per validation: the filter is
    // evaluated once per row and each row whose value an earlier row holds is recorded.
    const cacheKey = [...containerPath, fieldName, isFilterCondition ? ruleParam : ''].join('\0');
    let duplicates = run.uniqueDuplicates.get(cacheKey);
    if (!duplicates) {
      duplicates = new Set();
      run.uniqueDuplicates.set(cacheKey, duplicates);
      const seen = new Set<string>();
      const entries: [string, unknown][] = Array.isArray(rows)
        ? rows.map((item, i) => [String(i), item])
        : Object.entries(rows);
      for (const [key, item] of entries) {
        if (typeof item !== 'object' || item === null) {
          continue;
        }
        // A property read, as `item[fieldName]` reads it, of a row that is an object or a list.
        const itemValue: unknown = Reflect.get(item, fieldName);
        if (isEmpty(itemValue)) {
          continue;
        }
        if (
          isFilterCondition &&
          !itemPassesCondition(ruleParam, [...containerPath, key, fieldName], rowKeys, allData)
        ) {
          continue;
        }
        const itemValueKey = canonicalKey(itemValue);
        if (seen.has(itemValueKey)) {
          duplicates.add(key);
        } else {
          seen.add(itemValueKey);
        }
      }
    }

    return duplicates.has(itemKey) ? errorMessage : null;
  },
};
