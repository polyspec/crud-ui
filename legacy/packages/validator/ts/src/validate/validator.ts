/**
 * CRUDUI form validator (reference) — SPEC §2 G5→§3→§2 G1.
 *
 * The third pass of the CRUDUI pipeline. It consumes a CRUDUI field model (the
 * `validate`/`design`/`behavior`/`options` role slots) AFTER the compose pass
 * has expanded `$ref`/`$patch` into a single spec. It does NOT re-implement the
 * rule semantics or the expression engine — it CALLS the existing rule registry
 * (rules/index) and the existing expression engine (parser/ConditionParser,
 * parser/PathResolver). The logic here is: (a) reading the `validate` slot,
 * (b) evaluating a rule value that is an expression OR a condition map (G1 — the
 * condition is the value's expression, never a separate `if`/`when` key), and
 * (c) resolving `design.show` like a conditional parameter to skip hidden fields
 * (G1 forbids the `display_switch`/`display_target` meta keys).
 *
 * Pipeline (SPEC):
 *   1. compose — `composeSpec`/`composeProperties` (compose/) is run by the
 *      caller (`validate`) BEFORE this engine. An unresolved `$ref` throws a
 *      `ComposeLoadError` there (never `valid:true`).
 *   2. field traversal — recurse `properties`; group nesting and keyed
 *      `multiple` rows (sorted keys, items.__uid__). A field whose
 *      `design.show` resolves to false is hidden: it and everything it contains
 *      is skipped. Missing repeated data is an empty collection.
 *   3. validate-slot evaluation — per field, walk the `validate` slot in
 *      declaration order; for each rule, evaluate its value (expression /
 *      condition map → effective param); skip when the result is false/null;
 *      otherwise run the rule function. `type:number` runs an implicit `number`
 *      rule first when no explicit `number` rule is present.
 *   4. error collection — first error per field stops that field; collect into
 *      a flat `ValidationError[]`; `valid = errors.length === 0`.
 */

import type {
  ValidationError,
  ValidationResult,
  ValidationContext,
  ValidationRun,
  PathContext,
  MessagesSpec,
  ASTNode,
} from '../types';
import { getRule } from '../rules/index';
import { FormInputError } from './errors';
import { checkDataLimits } from './data-limits';
import { isRecord } from '../record';
import { compareCodePoints } from '../text/index';
import { assertRuleParameter, assertRuleName } from './parameters';
import { ComposeLoadError } from '../compose/errors';
import { groupChoices, groupSourceFailure, groupSourceRepeat, isGroupSource } from '../group-source';
import { assertKeyedMapKeys, assertKeyedMapReference } from './keyed-maps';
import { isMultipleField } from './fields';
import { isReferenceTarget, referenceIds, type ReferenceId } from './references';
import {
  parseCondition,
  isConditionExpression,
  ParseError,
} from '../parser/ConditionParser';
import {
  evaluateConditionOrFalse,
  evaluateExpressionValue,
  evaluateExpressionValueOrFalse,
  pathToString,
  getFieldName,
} from '../parser/PathResolver';

// ---------------------------------------------------------------------------
// Rule-class tables.
// ---------------------------------------------------------------------------

/**
 * Rules that apply to the whole array for a `multiple` field (the rest apply to
 * each element). VALIDATION-RULES §array-level.
 */
export const ARRAY_LEVEL_RULES = ['required', 'unique', 'mincount', 'maxcount'];

/**
 * Rules whose param is a field reference (relative path / filter condition) — it
 * is preserved verbatim and NOT evaluated as a condition expression. PATH-
 * REFERENCE-RULES.
 */
export const PATH_REFERENCE_RULES = ['equalTo', 'containedIn', 'typeFrom', 'minFrom', 'maxFrom', 'notEqual', 'unique', 'enddate', 'reference'];

/**
 * Rules whose param is a literal value, never a condition expression or a condition map. An
 * `accept` param like `.jpg` would otherwise be misread as a relative field reference, and the
 * `conditionTree` param `judge` as a path. LITERAL-PARAM-RULES.
 */
export const LITERAL_PARAM_RULES = ['accept', 'conditionTree'];

/**
 * `match`/`pattern` carry a regex string preserved verbatim (it is not a
 * condition expression). SPEC §10: a regex exists only as a `match` argument.
 */
export const REGEX_PARAM_RULES = ['match', 'pattern'];

/**
 * Membership rules whose param is the allowed-value SET (an array, comma string,
 * or a static value→label map, SPEC §2 G3). The param is data, NOT a
 * condition map — an object param here is the value→label map (key = option
 * value, value = display label), so it must be kept verbatim and never evaluated
 * key-by-key as expressions. The rule's own flatten reads keys for a value→label
 * map (the label, possibly a LangMap or null, is display-only).
 */
export const MEMBERSHIP_PARAM_RULES = ['in'];

// ---------------------------------------------------------------------------
// CRUDUI field shape (the subset this engine reads from a composed CRUDUI field).
// ---------------------------------------------------------------------------

/** A CRUDUI field after compose: a plain object with the role slots. */
export type ComposedField = Record<string, unknown>;

/** Whether a `multiple` declaration has one of its shapes: a boolean, `only` or an object (schema.md, CUSC-041). */
function isMultipleShape(multiple: unknown): boolean {
  return typeof multiple === 'boolean' || multiple === 'only' || isRecord(multiple);
}

/** Field types whose control holds one value (validation-rules.md, "Evaluation"). */
const SINGLE_CHOICE_TYPES: ReadonlySet<unknown> = new Set(['select', 'dropdown', 'selectbox', 'choice', 'radio']);

/** Whether a field is a single-choice field: a single-choice type without `lang`. */
function isSingleChoice(field: ComposedField): boolean {
  return SINGLE_CHOICE_TYPES.has(field.type) && (field.lang === undefined || field.lang === false || field.lang === null);
}

/**
 * Reject an array or object as the value of a single-choice field, or of a row of a
 * repeated one (rows in sorted key order).
 *
 * @throws {FormInputError} for the first value that is not a single value.
 */
function assertSingleChoiceData(value: unknown, path: string[], repeated: boolean): void {
  let entries: Array<[string[], unknown]>;
  if (!repeated) {
    entries = [[path, value]];
  } else if (isRecord(value)) {
    entries = Object.keys(value).sort().map((key) => [[...path, key], value[key]]);
  } else {
    throw new FormInputError(`Repeated data must be a keyed object: ${pathToString(path)}`);
  }
  for (const [entryPath, entry] of entries) {
    if (entry !== null && typeof entry === 'object') {
      throw new FormInputError(`Choice data must be a single value: ${pathToString(entryPath)}`);
    }
  }
}

/**
 * Normalize a polymorphic `validate` slot to a rule map. `false` → no rules;
 * `true`/`{}` → no rules (the default-on slot carries no sub-rules); an object →
 * the rule map itself. Returns `undefined` when there is nothing to run.
 */
function normalizeValidateSlot(
  slot: unknown
): Record<string, unknown> | undefined {
  if (slot === false || slot === true || slot === undefined || slot === null) {
    return undefined;
  }
  if (isRecord(slot)) {
    return slot;
  }
  return undefined;
}

/** True for a JSON object value; arrays and null are not objects. */
/** Read the per-field custom messages (the field's `messages` map). */
function fieldMessages(field: ComposedField): MessagesSpec | undefined {
  const m = field.messages;
  if (isRecord(m)) {
    return m;
  }
  return undefined;
}

/** How a declared rule value becomes the rule's effective parameter. */
type RuleValueForm =
  | { form: 'literal' }
  | { form: 'conditionMap'; map: Record<string, unknown> }
  | { form: 'ternary'; text: string }
  | { form: 'expression'; text: string };

/** Whether a string parses as a complete ternary expression. */
function isTernary(expression: string): boolean {
  try {
    return parseCondition(expression).type === 'Ternary';
  } catch (error) { if (!(error instanceof ParseError)) throw error;
    return false;
  }
}

/** Whether a string parses as a complete expression; any other string is a literal. */
function isValidExpression(expression: string): boolean {
  try {
    parseCondition(expression);
    return true;
  } catch (error) { if (!(error instanceof ParseError)) throw error;
    return false;
  }
}

/**
 * Classify a declared rule value (G1).
 *
 *   - Path-reference / literal-param / regex / membership rules keep their
 *     parameter verbatim (SPEC §10) — never evaluated as a condition. A
 *     membership map is a value set, not a condition map.
 *   - A plain object is a ConditionMap (expression → value, declaration order).
 *   - A string that parses as a ternary returns its selected branch value.
 *   - Another string that parses as a condition expression evaluates to its value.
 *   - Anything else, including a string that is not a valid expression, is a
 *     literal parameter.
 */
function ruleValueForm(ruleName: string, ruleValue: unknown): RuleValueForm {
  if (
    PATH_REFERENCE_RULES.includes(ruleName) ||
    LITERAL_PARAM_RULES.includes(ruleName) ||
    REGEX_PARAM_RULES.includes(ruleName) ||
    MEMBERSHIP_PARAM_RULES.includes(ruleName)
  ) {
    return { form: 'literal' };
  }
  if (isRecord(ruleValue)) {
    return { form: 'conditionMap', map: ruleValue };
  }
  if (typeof ruleValue === 'string') {
    if (isTernary(ruleValue)) {
      return { form: 'ternary', text: ruleValue };
    }
    if (
      isConditionExpression(ruleValue) &&
      !/\?[^:]*:/.test(ruleValue) &&
      isValidExpression(ruleValue)
    ) {
      return { form: 'expression', text: ruleValue };
    }
  }
  return { form: 'literal' };
}

/**
 * The literals a declared rule value can make the effective parameter: the value
 * itself, every value of a condition map, and every literal branch of a ternary
 * (through nested ternaries and parentheses). Branches that read the data
 * (paths and computed conditions) are not literals; they are checked when
 * selected. A plain condition expression always reads the data.
 */
function declaredLiterals(ruleName: string, ruleValue: unknown): unknown[] {
  const resolved = ruleValueForm(ruleName, ruleValue);
  switch (resolved.form) {
    case 'literal':
      return [ruleValue];
    case 'conditionMap':
      return Object.values(resolved.map);
    case 'ternary':
      return ternaryLiterals(parseCondition(resolved.text));
    case 'expression':
      return [];
  }
}

function ternaryLiterals(node: ASTNode): unknown[] {
  switch (node.type) {
    case 'Ternary':
      return [...ternaryLiterals(node.trueValue), ...ternaryLiterals(node.falseValue)];
    case 'Group':
      return ternaryLiterals(node.expression);
    case 'Literal':
      return [node.value];
    default:
      return [];
  }
}

/**
 * CRUDUI validator. Construct from a COMPOSED CRUDUI spec (composition keys already
 * eliminated). `validate` (index) does the compose pass first.
 */
export class Validator {
  private readonly properties: Record<string, unknown>;
  /** The bounds of the data; data of any size when absent. */
  private readonly limits: { depth: number; values: number } | undefined;
  /** The state of the validation in progress. */
  private run: ValidationRun = this.newRun({});

  /**
   * @param composedSpec a composed CRUDUI root spec — a group with `properties`
   *        (already free of `$ref`/`$patch`).
   * @throws {ComposeLoadError} for the first unknown rule name or parameter outside the definitions,
   *         a `reference` that names no field it can name included: the declaration fails the load.
   */
  constructor(composedSpec: ComposedField, limits?: { depth: number; values: number }) {
    this.limits = limits;
    const props = composedSpec.properties;
    this.properties = isRecord(props) ? props : {};
    this.checkDeclaredParameters(this.properties, []);
  }

  /**
   * Validate `data` against the composed CRUDUI spec.
   *
   * @throws {FormInputError} when root, group or repeated data has the wrong shape.
   */
  validate(data: unknown): ValidationResult {
    if (!isRecord(data)) {
      throw new FormInputError('Form data must be an object');
    }
    // The data is measured after the rule parameters, which the constructor checked, and before any rule (CUVR-082).
    if (this.limits) checkDataLimits(data, this.limits);
    this.run = this.newRun(data);
    const errors: ValidationError[] = [];
    this.validateProperties(this.properties, data, [], [], [], data, errors);
    return { valid: errors.length === 0, errors, hidden: this.hiddenPaths(data) };
  }

  /** The state of one validation of `data`: the ids of each declaration path are collected once. */
  private newRun(data: Record<string, unknown>): ValidationRun {
    const ids = new Map<string, ReferenceId[]>();
    return {
      uniqueDuplicates: new Map(),
      referenceIds: (path: string) => {
        let found = ids.get(path);
        if (found === undefined) {
          found = referenceIds(this.properties, data, path);
          ids.set(path, found);
        }
        return found;
      },
    };
  }

  /**
   * The data paths of the fields whose `design.show` resolves to `false` against `data`, in
   * declaration order, each field of a group row under the row's key and the fields inside a
   * hidden field included (form-runtime.md, "Display"). Data of another shape is read as missing.
   */
  hiddenPaths(data: Record<string, unknown>): string[] {
    const hidden: string[] = [];
    this.collectHidden(this.properties, data, [], [], data, hidden);
    return hidden;
  }

  private collectHidden(
    properties: Record<string, unknown>,
    data: Record<string, unknown>,
    currentPath: string[],
    rowKeys: number[],
    allData: Record<string, unknown>,
    hidden: string[]
  ): void {
    for (const [name, field] of Object.entries(properties)) {
      if (!isRecord(field)) {
        continue;
      }
      const fieldPath = [...currentPath, name];
      if (this.isHidden(field, { currentPath: fieldPath, rowKeys, formData: allData })) {
        hidden.push(pathToString(fieldPath));
      }
      const children = this.childProperties(field);
      if (field.type !== 'group' || !children) {
        continue;
      }
      const value = data[name];
      if (!this.isMultiple(field)) {
        this.collectHidden(children, isRecord(value) ? value : {}, fieldPath, rowKeys, allData, hidden);
        continue;
      }
      const rows = isRecord(value) ? value : {};
      for (const key of Object.keys(rows).sort()) {
        const row = rows[key];
        this.collectHidden(children, isRecord(row) ? row : {}, [...fieldPath, key], [...rowKeys, fieldPath.length], allData, hidden);
      }
    }
  }

  // =========================================================================
  // Declared parameters (validation-rules.md, "Parameter errors").
  // =========================================================================

  /**
   * Check every declared rule name and parameter before any value is validated:
   * fields in declaration order (a group before its children), each field's rules
   * in declaration order and then its `messages` keys. Every literal a condition map or a ternary can select is
   * checked here, selected or not; a value taken from the data is checked when
   * it is selected (`runRule`).
   *
   * @throws {ComposeLoadError} for the first unknown rule name or parameter outside the definitions.
   */
  private checkDeclaredParameters(
    properties: Record<string, unknown>,
    declarationPath: string[]
  ): void {
    for (const [propertyKey, field] of Object.entries(properties)) {
      if (!isRecord(field)) {
        continue;
      }
      const path = [...declarationPath, propertyKey];
      // The shape of multiple is checked before the field's group source and rules (schema.md, CUSC-081).
      if (Object.prototype.hasOwnProperty.call(field, 'multiple') && !isMultipleShape(field.multiple)) {
        throw new ComposeLoadError('INVALID_RULE_PARAMETER', `Invalid multiple at ${path.join('.')}: expected a boolean, only or an object`, path);
      }
      // A group source is checked before the field's rules (validation-rules.md, "Parameter errors").
      const sourceFailure = groupSourceFailure(field, path.join('.'), this.properties);
      if (sourceFailure !== undefined) throw new ComposeLoadError('INVALID_RULE_PARAMETER', sourceFailure, path);
      const rules = normalizeValidateSlot(field.validate);
      for (const [ruleName, ruleValue] of Object.entries(rules ?? {})) {
        assertRuleName(ruleName, path);
        for (const literal of declaredLiterals(ruleName, ruleValue)) {
          assertRuleParameter(ruleName, literal, path);
          if (ruleName === 'reference' && typeof literal === 'string' && !isReferenceTarget(this.properties, literal)) {
            throw new ComposeLoadError(
              'INVALID_RULE_PARAMETER',
              'Invalid reference parameter: expected the declaration path of a field',
              [...path]
            );
          }
        }
      }
      for (const ruleName of Object.keys(fieldMessages(field) ?? {})) {
        assertRuleName(ruleName, path);
      }
      assertKeyedMapReference(field, path, this.properties);
      const childProps = this.childProperties(field);
      if (field.type === 'group' && childProps) {
        this.checkDeclaredParameters(childProps, path);
      }
    }
  }

  // =========================================================================
  // Field traversal (SPEC §3).
  // =========================================================================

  private validateProperties(
    properties: Record<string, unknown>,
    data: Record<string, unknown>,
    currentPath: string[],
    rowKeys: number[],
    declarationPath: string[],
    allData: Record<string, unknown>,
    errors: ValidationError[],
    insideHidden = false
  ): void {
    for (const name of Object.keys(data).sort(compareCodePoints)) {
      if (!Object.prototype.hasOwnProperty.call(properties, name)) {
        throw new FormInputError(`Unknown form data field: ${pathToString([...currentPath, name])}`);
      }
    }
    for (const [propertyKey, field] of Object.entries(properties)) {
      if (!isRecord(field)) {
        continue;
      }
      const fieldName = propertyKey;
      const isMultiple = this.isMultiple(field);
      const fieldPath = [...currentPath, fieldName];
      const fieldDeclaration = [...declarationPath, fieldName];
      const present = Object.prototype.hasOwnProperty.call(data, fieldName);
      const fieldValue = data[fieldName];

      // A hidden field and every field it contains are not evaluated; its value
      // is kept for conditions and references elsewhere. The data shape is an
      // input contract, so hidden data is still traversed for shape checks.
      const hidden = insideHidden || this.isHidden(field, { currentPath: fieldPath, rowKeys, formData: allData });

      const childProps = this.childProperties(field);

      if (isMultiple && present && !isRecord(fieldValue)) {
        throw new FormInputError(
          `Repeated data must be a keyed object: ${pathToString(fieldPath)}`
        );
      }
      if (isMultiple && present && isRecord(fieldValue)) {
        assertKeyedMapKeys(field, fieldValue, { currentPath: fieldPath, rowKeys, formData: allData });
      }
      if (present && isSingleChoice(field)) {
        assertSingleChoiceData(fieldValue, fieldPath, isMultiple);
      }

      if (field.type === 'group' && childProps) {
        if (isMultiple) {
          // Keyed rows use sorted-key traversal so the first reported error
          // is identical in every validation implementation. Row keys stay in paths.
          // Missing data is an empty collection: no rows, collection rules still run.
          const rows = present && isRecord(fieldValue) ? fieldValue : {};
          for (const key of Object.keys(rows).sort()) {
            const row = rows[key];
            if (!isRecord(row)) {
              throw new FormInputError(
                `Group data must be an object: ${pathToString([...fieldPath, key])}`
              );
            }
            this.validateProperties(childProps, row, [...fieldPath, key], [...rowKeys, fieldPath.length], fieldDeclaration, allData, errors, hidden);
          }
          if (!hidden) {
            this.validateFieldRules(field, fieldValue, fieldPath, rowKeys, fieldDeclaration, allData, errors);
          }
        } else {
          if (present && !isRecord(fieldValue)) {
            throw new FormInputError(
              `Group data must be an object: ${pathToString(fieldPath)}`
            );
          }
          this.validateProperties(
            childProps,
            present && isRecord(fieldValue) ? fieldValue : {},
            fieldPath,
            rowKeys,
            fieldDeclaration,
            allData,
            errors,
            hidden
          );
          if (!hidden) {
            this.validateFieldRules(field, fieldValue, fieldPath, rowKeys, fieldDeclaration, allData, errors);
          }
        }
      } else if (hidden) {
        continue;
      } else if (isMultiple) {
        // Repeated scalar field: collection rules on the keyed object, the rest
        // on each row value. Missing data is an empty collection without rows.
        this.validateMultipleFieldRules(
          field,
          present && isRecord(fieldValue) ? fieldValue : undefined,
          fieldPath,
          rowKeys,
          fieldDeclaration,
          allData,
          errors
        );
      } else {
        this.validateFieldRules(field, fieldValue, fieldPath, rowKeys, fieldDeclaration, allData, errors);
      }
    }
  }

  /** Whether a CRUDUI field repeats (`multiple: true`, `multiple: only` or `multiple: { ... }`). */
  private isMultiple(field: ComposedField): boolean {
    return isMultipleField(field);
  }

  /**
   * Whether a field is hidden: its `design.show` resolves to `false` in the
   * field's row context, like a conditional parameter (a boolean, an expression
   * or a condition map). A field without `design.show` is visible.
   */
  private isHidden(field: ComposedField, context: PathContext): boolean {
    const design = field.design;
    if (!isRecord(design) || !('show' in design)) {
      return false;
    }
    return this.resolveRuleValue('show', design.show, context) === false;
  }

  /** The child field map of a group (composed, plain object), or undefined. */
  private childProperties(
    field: ComposedField
  ): Record<string, unknown> | undefined {
    const props = field.properties;
    if (isRecord(props)) {
      return props;
    }
    return undefined;
  }

  // =========================================================================
  // validate-slot evaluation (SPEC §3 slots.validate).
  // =========================================================================

  /** Collection rules and per-row rules for a repeated scalar field. */
  private validateMultipleFieldRules(
    field: ComposedField,
    values: Record<string, unknown> | undefined,
    fieldPath: string[],
    rowKeys: number[],
    declarationPath: string[],
    allData: Record<string, unknown>,
    errors: ValidationError[]
  ): void {
    const rules = normalizeValidateSlot(field.validate);
    const messages = fieldMessages(field);

    // 1. Array-level rules in declaration order; first error wins for the field.
    if (rules) {
      const context: PathContext = { currentPath: fieldPath, rowKeys, formData: allData };
      for (const [ruleName, ruleValue] of Object.entries(rules)) {
        if (!ARRAY_LEVEL_RULES.includes(ruleName)) {
          continue;
        }
        const error = this.runRule(
          ruleName,
          ruleValue,
          values,
          context,
          declarationPath,
          field,
          messages
        );
        if (error) {
          errors.push({
            path: pathToString(fieldPath),
            field: getFieldName(fieldPath),
            rule: ruleName,
            message: error,
            value: values === undefined ? null : values,
          });
          return;
        }
      }
    }

    // 2. Row rules in sorted row-key order (the error-order contract).
    const rows = values ?? {};
    for (const key of Object.keys(rows).sort()) {
      const value = rows[key];
      this.validateElementRules(
        field,
        value,
        [...fieldPath, key],
        [...rowKeys, fieldPath.length],
        declarationPath,
        allData,
        errors
      );
    }
  }

  /** Element-level rules for one element of a `multiple` field (no array-level). */
  private validateElementRules(
    field: ComposedField,
    value: unknown,
    itemPath: string[],
    rowKeys: number[],
    declarationPath: string[],
    allData: Record<string, unknown>,
    errors: ValidationError[]
  ): void {
    const context: PathContext = { currentPath: itemPath, rowKeys, formData: allData };
    const messages = fieldMessages(field);
    const rules = normalizeValidateSlot(field.validate);

    if (this.runImplicitNumber(field, rules, value, context, declarationPath, messages, itemPath, errors)) {
      return;
    }
    if (this.runGroupSource(field, value, context, declarationPath, messages, itemPath, errors)) {
      return;
    }
    if (!rules) {
      return;
    }
    for (const [ruleName, ruleValue] of Object.entries(rules)) {
      if (ARRAY_LEVEL_RULES.includes(ruleName)) {
        continue;
      }
      const error = this.runRule(ruleName, ruleValue, value, context, declarationPath, field, messages);
      if (error) {
        errors.push({
          path: pathToString(itemPath),
          field: getFieldName(itemPath),
          rule: ruleName,
          message: error,
          value: value === undefined ? null : value,
        });
        break;
      }
    }
  }

  /** All rules for a single (scalar or group-as-whole) field. */
  private validateFieldRules(
    field: ComposedField,
    value: unknown,
    fieldPath: string[],
    rowKeys: number[],
    declarationPath: string[],
    allData: Record<string, unknown>,
    errors: ValidationError[]
  ): void {
    const context: PathContext = { currentPath: fieldPath, rowKeys, formData: allData };
    const messages = fieldMessages(field);
    const rules = normalizeValidateSlot(field.validate);

    if (this.runImplicitNumber(field, rules, value, context, declarationPath, messages, fieldPath, errors)) {
      return;
    }
    if (this.runGroupSource(field, value, context, declarationPath, messages, fieldPath, errors)) {
      return;
    }
    if (!rules) {
      return;
    }
    for (const [ruleName, ruleValue] of Object.entries(rules)) {
      const error = this.runRule(ruleName, ruleValue, value, context, declarationPath, field, messages);
      if (error) {
        errors.push({
          path: pathToString(fieldPath),
          field: getFieldName(fieldPath),
          rule: ruleName,
          message: error,
          value: value === undefined ? null : value,
        });
        break;
      }
    }
  }

  /**
   * `type:number` runs an implicit `number` rule before everything else when no
   * explicit `number` rule is declared (VALIDATION-RULES §2 — reported as rule
   * `number`). Returns true when it pushed an error (caller must stop the field).
   */
  private runImplicitNumber(
    field: ComposedField,
    rules: Record<string, unknown> | undefined,
    value: unknown,
    context: PathContext,
    declarationPath: string[],
    messages: MessagesSpec | undefined,
    path: string[],
    errors: ValidationError[]
  ): boolean {
    if (field.type !== 'number') {
      return false;
    }
    if (rules && 'number' in rules) {
      return false;
    }
    const error = this.runRule('number', true, value, context, declarationPath, field, messages);
    if (error) {
      errors.push({
        path: pathToString(path),
        field: getFieldName(path),
        rule: 'number',
        message: error,
        value: value === undefined ? null : value,
      });
      return true;
    }
    return false;
  }

  /**
   * A field whose `items` is a group source runs an implicit `in` check against the choices that
   * the source gives for the data, before its declared rules (validation-rules.md, "Values").
   * Returns true when it pushed an error (caller must stop the field).
   */
  private runGroupSource(
    field: ComposedField,
    value: unknown,
    context: PathContext,
    declarationPath: string[],
    messages: MessagesSpec | undefined,
    path: string[],
    errors: ValidationError[]
  ): boolean {
    if (!isGroupSource(field.items)) {
      return false;
    }
    // A repeated value among the source rows is data that the choices cannot express (CUVR-087).
    const repeat = groupSourceRepeat(field.items, context.formData);
    if (repeat !== undefined) throw new FormInputError(repeat);
    const members = groupChoices(field.items, context.formData).map((choice) => choice.value);
    const error = this.runRule('in', members, value, context, declarationPath, field, messages);
    if (error) {
      errors.push({
        path: pathToString(path),
        field: getFieldName(path),
        rule: 'in',
        message: error,
        value: value === undefined ? null : value,
      });
      return true;
    }
    return false;
  }

  // =========================================================================
  // Conditional rule value (G1) — expression / condition map → effective param.
  // =========================================================================

  /**
   * Run one rule: evaluate its (possibly conditional) value to an effective
   * param, skip when the result disables the rule (false/null), else call the
   * existing rule function. Returns the error message or null.
   */
  private runRule(
    ruleName: string,
    ruleValue: unknown,
    value: unknown,
    context: PathContext,
    declarationPath: string[],
    field: ComposedField,
    messages: MessagesSpec | undefined
  ): string | null {
    const effectiveParam = this.resolveRuleValue(ruleName, ruleValue, context);

    // A false/null effective param disables the rule (VALIDATION-RULES common §3).
    if (effectiveParam === false || effectiveParam === null) {
      return null;
    }

    // A value taken from the data is checked when it is selected, before the
    // empty-value skip. Declared literals already passed at load, so checking
    // every resolved conditional value adds no other failure.
    if (ruleValueForm(ruleName, ruleValue).form !== 'literal') {
      assertRuleParameter(ruleName, effectiveParam, declarationPath);
    }

    const ruleDefinition = getRule(ruleName);
    if (!ruleDefinition) {
      // Rule names are checked when the specification loads.
      throw new Error(`Rule ${ruleName} is not registered`);
    }

    const validationContext: ValidationContext = {
      path: pathToString(context.currentPath),
      field: getFieldName(context.currentPath),
      value,
      allData: context.formData,
      spec: field,
      pathSegments: context.currentPath,
      rowKeys: context.rowKeys ?? [],
      ruleParam: effectiveParam,
      messages,
      ruleName,
      run: this.run,
    };

    return ruleDefinition.validate(validationContext);
  }

  /**
   * Resolve a rule value to the effective param (G1).
   *
   * The value is `Evaluated<V>` = literal | Expression(string) | ConditionMap.
   *   - Path-reference / literal-param / regex rules keep their string param
   *     verbatim (SPEC §10) — never evaluated as a condition.
   *   - A ConditionMap (plain object whose keys are expressions) is evaluated in
   *     declaration order; the first truthy key's value is the param; otherwise
   *     the `true` key; otherwise null (disabled).
   *   - A string is evaluated as a ternary (value-returning branch) or a plain
   *     condition expression.
   *   - Anything else is a literal param.
   */
  private resolveRuleValue(
    ruleName: string,
    ruleValue: unknown,
    context: PathContext
  ): unknown {
    const resolved = ruleValueForm(ruleName, ruleValue);
    switch (resolved.form) {
      case 'conditionMap':
        return this.resolveConditionMap(resolved.map, context);
      case 'ternary':
        return this.evaluateTernary(resolved.text, context);
      case 'expression':
        return this.evaluateExpressionValue(resolved.text, context);
      case 'literal':
        return ruleValue;
    }
  }

  /**
   * Evaluate a ConditionMap (expressions.md §8): walk keys in declaration
   * order, return the value of the first key whose expression is truthy; if none
   * match, return the `true` (always-true default) key's value; if absent, null
   * (rule disabled). The map is a thin repeated-engine-call wrapper, not a new
   * parser; a single ternary is its shorthand (handled in resolveRuleValue).
   */
  private resolveConditionMap(
    map: Record<string, unknown>,
    context: PathContext
  ): unknown {
    for (const key of Object.keys(map)) {
      if (key === 'true') {
        continue; // The default is the fallback, evaluated last.
      }
      if (this.evaluateCondition(key, context)) {
        return map[key];
      }
    }
    if ('true' in map) {
      return map.true;
    }
    return null;
  }

  /**
   * Evaluate a ternary; its selected branch value is the parameter. A ternary
   * that cannot be evaluated remains the literal string.
   */
  private evaluateTernary(expression: string, context: PathContext): unknown {
    try {
      return evaluateExpressionValue(parseCondition(expression), context);
    } catch (error) { if (!(error instanceof ParseError)) throw error;
      return expression;
    }
  }

  private evaluateCondition(expression: string, context: PathContext): boolean {
    return evaluateConditionOrFalse(expression, context);
  }

  private evaluateExpressionValue(
    expression: string,
    context: PathContext
  ): unknown {
    return evaluateExpressionValueOrFalse(expression, context);
  }
}
