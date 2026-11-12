/**
 * CRUDUI Validator Type Definitions
 */

// ============================================================================
// Spec Types
// ============================================================================

/**
 * Custom error messages by registered rule name. Any other key fails the load
 * with `UNKNOWN_RULE`.
 */
export interface MessagesSpec {
  /** Error message shown when the `required` rule fails. */
  required?: string;
  /** Error message shown when the `email` rule fails. */
  email?: string;
  /** Error message shown when the `url` rule fails. */
  url?: string;
  /** Error message shown when the `minlength` rule fails. */
  minlength?: string;
  /** Error message shown when the `maxlength` rule fails. */
  maxlength?: string;
  /** Error message shown when the `rangelength` rule fails. */
  rangelength?: string;
  /** Error message shown when the `match` rule fails. */
  match?: string;
  /** Alias of `match` message */
  pattern?: string;
  /** Error message shown when the `number` rule fails. */
  number?: string;
  /** Error message shown when the `digits` rule fails. */
  digits?: string;
  /** Error message shown when the `min` rule fails. */
  min?: string;
  /** Error message shown when the `max` rule fails. */
  max?: string;
  /** Error message shown when the `range` rule fails. */
  range?: string;
  /** Error message shown when the `step` rule fails. */
  step?: string;
  /** Error message shown when the `equalTo` rule fails. */
  equalTo?: string;
  /** Error message shown when the `containedIn` rule fails. */
  containedIn?: string;
  /** Error message shown when the `typeFrom` rule fails. */
  typeFrom?: string;
  /** Error message shown when the `minFrom` rule fails. */
  minFrom?: string;
  /** Error message shown when the `maxFrom` rule fails. */
  maxFrom?: string;
  /** Error message shown when the `notEqual` rule fails. */
  notEqual?: string;
  /** Error message shown when the `reference` rule fails. */
  reference?: string;
  /** Error message shown when the `in` rule fails. */
  in?: string;
  /** Error message shown when the `date` rule fails. */
  date?: string;
  /** Error message shown when the `dateISO` rule fails. */
  dateISO?: string;
  /** Error message shown when the `enddate` rule fails. */
  enddate?: string;
  /** Error message shown when the `mincount` rule fails. */
  mincount?: string;
  /** Error message shown when the `maxcount` rule fails. */
  maxcount?: string;
  /** Error message shown when the `unique` rule fails. */
  unique?: string;
  /** Error message shown when the `accept` rule fails. */
  accept?: string;
  /** Error message shown when the `conditionTree` rule fails. */
  conditionTree?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * The result of checking a list or detail declaration: whether it is valid and its errors.
 */
export interface ListValidationResult {
  /** True when the declaration passed; false if any error was collected. */
  valid: boolean;
  /** List of all errors found; empty when `valid` is true. */
  errors: ValidationError[];
}

/**
 * The result of validating form data: whether it is valid, its errors and the data paths
 * that `design.show` hides.
 */
export interface ValidationResult {
  /** True when every field passed validation; false if any error was collected. */
  valid: boolean;
  /** List of all validation errors found; empty when `valid` is true. */
  errors: ValidationError[];
  /**
   * Data paths of the fields whose `design.show` resolves to `false`, in declaration order
   * (validation-rules.md, "Evaluation"); a path names the field and everything it contains.
   */
  hidden: string[];
}

/**
 * Single validation error
 */
export interface ValidationError {
  /** Full dotted path to the field that failed (e.g., `items.0.name`). */
  path: string;
  /** Name of the failing field (last segment of `path`). */
  field: string;
  /** Name of the rule that produced this error (e.g., `required`, `email`). */
  rule: string;
  /** Human-readable error message for display. */
  message: string;
  /** The field value that failed validation, if available. */
  value?: unknown;
}

/**
 * Validation context passed to rule functions
 */
export interface ValidationContext {
  /** Full path to the current field */
  path: string;
  /** Field name (last segment of path) */
  field: string;
  /** Current field value */
  value: unknown;
  /** All form data */
  allData: Record<string, unknown>;
  /** The composed specification of the field, as the specification declares it. */
  spec: Readonly<Record<string, unknown>>;
  /** Parsed path segments */
  pathSegments: string[];
  /** Positions of the row keys in `pathSegments` (expressions.md, "Evaluation"). */
  rowKeys: readonly number[];
  /** Rule parameter value */
  ruleParam: unknown;
  /** Custom messages */
  messages?: MessagesSpec;
  /** Name under which the rule was invoked (e.g., 'pattern' vs 'match') */
  ruleName?: string;
  /** The state of the validation the rule runs in. */
  run: ValidationRun;
}

/**
 * The state of one validation, dropped when it returns.
 */
export interface ValidationRun {
  /**
   * For each collection field (container path, field name and filter), the row keys whose
   * `unique` value an earlier row already holds.
   */
  uniqueDuplicates: Map<string, Set<string>>;
  /**
   * The ids of a declaration path in the data being validated (validation-rules.md, "References"),
   * collected once per validation.
   */
  referenceIds(path: string): readonly (string | number | boolean)[];
}

/**
 * Rule function signature
 */
type RuleFn = (context: ValidationContext) => string | null;

/**
 * Rule definition with its validation function
 */
export interface RuleDefinition {
  /** Validation function; returns an error message string on failure or null on success. */
  validate: RuleFn;
}

// ============================================================================
// Parser Types
// ============================================================================

/**
 * Token types for lexer
 */
export enum TokenType {
  // Literals
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',

  // Identifiers and paths
  IDENTIFIER = 'IDENTIFIER',
  DOT = 'DOT',
  DOT_DOT = 'DOT_DOT',
  ASTERISK = 'ASTERISK',

  // Comparison operators
  EQ = 'EQ',
  NE = 'NE',
  GT = 'GT',
  GE = 'GE',
  LT = 'LT',
  LE = 'LE',

  // Logical operators
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

  // Inclusion operators
  IN = 'IN',
  NOT_IN = 'NOT_IN',

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  COMMA = 'COMMA',

  // Ternary operators
  QUESTION = 'QUESTION',
  COLON = 'COLON',

  // Special
  EOF = 'EOF',
  WHITESPACE = 'WHITESPACE',
  INVALID = 'INVALID',
}

/**
 * Token position information
 */
export interface TokenPosition {
  /** Zero-based index of the token's first character in the source string. */
  start: number;
  /** Zero-based index just past the token's last character in the source string. */
  end: number;
  /** One-based line number where the token starts. */
  line: number;
  /** One-based column number where the token starts. */
  column: number;
}

/**
 * Token structure
 */
export interface Token {
  /** Lexical category of the token. */
  type: TokenType;
  /** Raw source text of the token. */
  value: string;
  /** Parsed literal value for value tokens (string/number/boolean/null); otherwise unused. */
  literal: unknown;
  /** Location of the token within the source string. */
  position: TokenPosition;
}

// ============================================================================
// AST Node Types
// ============================================================================

/**
 * Base AST node interface
 */
interface ASTNodeBase {
  /** Discriminant identifying the node kind (e.g., `Binary`, `Path`, `Literal`). */
  type: string;
  /** Source span covered by this node. */
  position: {
    /** Zero-based start index of the node in the source string. */
    start: number;
    /** Zero-based end index (exclusive) of the node in the source string. */
    end: number;
  };
}

/**
 * Binary operation node (&&, ||, ==, !=, etc.)
 */
export interface BinaryNode extends ASTNodeBase {
  /** Node discriminant; always `'Binary'`. */
  type: 'Binary';
  /** Binary operator joining the two operands. */
  operator: '&&' | '||' | '==' | '!=' | '>' | '>=' | '<' | '<=';
  /** Left-hand operand expression. */
  left: ASTNode;
  /** Right-hand operand expression. */
  right: ASTNode;
}

/**
 * Unary operation node (!)
 */
export interface UnaryNode extends ASTNodeBase {
  /** Node discriminant; always `'Unary'`. */
  type: 'Unary';
  /** Unary operator; logical negation (`!`). */
  operator: '!';
  /** Expression the operator is applied to. */
  operand: ASTNode;
}

/**
 * IN operation node
 */
export interface InNode extends ASTNodeBase {
  /** Node discriminant; always `'In'`. */
  type: 'In';
  /** True for `not in`; inverts the membership test. */
  negated: boolean;
  /** Expression tested for membership in the list. */
  value: ASTNode;
  /** Candidate expressions the value is checked against. */
  list: ASTNode[];
}

/**
 * Path segment types
 */
export type PathSegment =
  | {
      /** Segment kind: a named field/property. */
      type: 'identifier';
      /** Field/property name for this segment. */
      value: string;
    }
  | {
      /** Segment kind: a wildcard matching any array index. */
      type: 'wildcard';
    }
  | {
      /** Segment kind: a fixed array index. */
      type: 'index';
      /** Zero-based array index for this segment. */
      value: number;
    };

/**
 * Path reference node
 */
export interface PathNode extends ASTNodeBase {
  /** Node discriminant; always `'Path'`. */
  type: 'Path';
  /** True when the path is relative to the current field rather than absolute. */
  relative: boolean;
  /** Number of parent levels (`..`) to ascend before resolving the segments. */
  levelsUp: number;
  /** Ordered segments describing how to navigate the data tree. */
  segments: PathSegment[];
}

/**
 * Literal value node
 */
interface LiteralNode extends ASTNodeBase {
  /** Node discriminant; always `'Literal'`. */
  type: 'Literal';
  /** Primitive kind of the literal value. */
  valueType: 'string' | 'number' | 'boolean' | 'null';
  /** The literal's concrete value. */
  value: string | number | boolean | null;
}

/**
 * Grouped expression node (parentheses)
 */
interface GroupNode extends ASTNodeBase {
  /** Node discriminant; always `'Group'`. */
  type: 'Group';
  /** The parenthesized inner expression. */
  expression: ASTNode;
}

/**
 * Ternary conditional expression node (condition ? trueValue : falseValue)
 */
export interface TernaryNode extends ASTNodeBase {
  /** Node discriminant; always `'Ternary'`. */
  type: 'Ternary';
  /** Condition expression evaluated to choose a branch. */
  condition: ASTNode;
  /** Expression returned when the condition is truthy. */
  trueValue: ASTNode;
  /** Expression returned when the condition is falsy. */
  falseValue: ASTNode;
}

/**
 * Union of all AST node types
 */
export type ASTNode =
  | BinaryNode
  | UnaryNode
  | InNode
  | PathNode
  | LiteralNode
  | GroupNode
  | TernaryNode;

// ============================================================================
// Path Resolution Types
// ============================================================================

/**
 * Context for path resolution
 */
export interface PathContext {
  /** Current field's absolute path segments */
  currentPath: string[];
  /** Complete form data */
  formData: Record<string, unknown>;
  /**
   * Positions of the row keys in `currentPath`: a row key and the name of its collection are one
   * level of a relative path (expressions.md, "Evaluation").
   */
  rowKeys?: readonly number[];
}

/**
 * Wildcard evaluation strategy
 */
export type WildcardStrategy = 'ANY' | 'ALL' | 'NONE' | 'CURRENT';

// ============================================================================
// Condition Evaluation Types
// ============================================================================

/**
 * Parsed condition cache entry
 */
export interface CachedCondition {
  /** Original condition source string used as the cache key. */
  expression: string;
  /** Parsed AST for the expression, reused to avoid re-parsing. */
  ast: ASTNode;
}

// ============================================================================
// Validator Options
// ============================================================================

/** Virtual files available to `$ref` resolution, indexed by reference key. */
export type FileSet = Record<string, Record<string, unknown>>;
