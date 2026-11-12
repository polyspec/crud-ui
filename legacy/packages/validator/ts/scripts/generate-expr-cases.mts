/**
 * Shared-fixture generator for the 4-language expression engine.
 *
 * Runs the JS reference engine (Lexer / Parser / evaluator) for real and dumps
 * tokens / AST / per-data evaluation results. AST + token `position` fields are
 * stripped (Rust AST holds no position; including it would break 4-language
 * parity). AST field names are the JS-actual ones.
 *
 * value  = evaluateExpressionValue(ast, ctx)   (ternary returns its branch value)
 * truthy = evaluateCondition(ast, ctx)          (boolean evaluate())
 */
import type { PathContext } from '@polyspec/crudui-validator';
import {
  Lexer,
  MAX_EXPRESSION_DEPTH,
  ParseError,
  Parser,
  evaluateCondition,
  evaluateExpressionValue,
} from '@polyspec/crudui-validator/internal';
// The global declaration of JSON.rawJSON.
import type {} from '../../../../tests/fixtures/json-raw.d.mts';

// ---------------------------------------------------------------------------
// Serialization helpers (drop `position`, keep JS-actual field names)
// ---------------------------------------------------------------------------

function serializeTokens(expr: string): unknown[] {
  const tokens = new Lexer(expr).tokenize();
  return tokens.map((t) => ({
    type: t.type,
    value: t.value,
    literal: t.literal,
  }));
}

const AST_FIELD_ORDER: Record<string, string[]> = {
  Ternary: ['type', 'condition', 'trueValue', 'falseValue'],
  Binary: ['type', 'operator', 'left', 'right'],
  Unary: ['type', 'operator', 'operand'],
  In: ['type', 'negated', 'value', 'list'],
  Path: ['type', 'relative', 'levelsUp', 'segments'],
  Literal: ['type', 'valueType', 'value'],
  Group: ['type', 'expression'],
};

/** Whether a value is a JSON object: an object that is neither null nor an array. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function stripPosition(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripPosition);
  }
  if (!isRecord(value)) {
    return value;
  }
  const node = value;
  // Path segment: {type:'identifier',value} | {type:'wildcard'} | {type:'index',value}
  if (node.type === 'identifier' || node.type === 'wildcard' || node.type === 'index') {
    if (node.type === 'wildcard') return { type: 'wildcard' };
    return { type: node.type, value: node.value };
  }
  const order = typeof node.type === 'string' ? AST_FIELD_ORDER[node.type] : undefined;
  const out: Record<string, unknown> = {};
  if (order) {
    for (const k of order) {
      if (k in node) out[k] = stripPosition(node[k]);
    }
    return out;
  }
  // Fallback: copy everything except position
  for (const k of Object.keys(node)) {
    if (k === 'position') continue;
    out[k] = stripPosition(node[k]);
  }
  return out;
}

function buildAst(expr: string): unknown {
  const tokens = new Lexer(expr).tokenize();
  const ast = new Parser(tokens).parse();
  return stripPosition(ast);
}

// ---------------------------------------------------------------------------
// Case specs: { name, expr, dataCases: [{data, currentPath?, rowKeys?}] }
// Expected value/truthy are computed by the real engine below.
// ---------------------------------------------------------------------------

interface DataSpec {
  data: Record<string, unknown>;
  currentPath?: string[];
  /** Positions of the row keys in currentPath (expressions.md, relative paths). */
  rowKeys?: number[];
  /**
   * The result the contract states, recorded in place of the engine's. A case of a
   * rule the languages once disagreed on states it, so that the fixture judges the
   * reference engine as well.
   */
  expected?: boolean;
}
interface CaseSpec {
  name: string;
  expr: string;
  dataCases: DataSpec[];
  /** Requirements the case tests besides those that its tokens, whitespace and tree nodes exercise. */
  requirements?: string[];
}

/**
 * The number 1 written `1.0`, a spelling that JSON.stringify does not write for a JavaScript number; a runtime that
 * decodes it to another type than `1` (a PHP float, a Rust float, a Python float) must still compare it by value.
 * JSON.rawJSON (legacy/tests/fixtures/json-raw.d.mts) writes the text as it is.
 */
const oneWithFraction = JSON.rawJSON('1.0');

const SPECS: CaseSpec[] = [
  // ---- simple paths -----------------------------------------------------
  {
    name: 'path-sibling-truthy',
    // Every implementation evaluates expressions: the expression part of CURP-001 of docs/spec/runtime-packages.md.
    requirements: ['CURP-001'],
    expr: '.x',
    dataCases: [
      { data: { x: 1, self: 0 }, currentPath: ['self'] },
      { data: { x: 0, self: 0 }, currentPath: ['self'] },
      { data: { self: 0 }, currentPath: ['self'] },
    ],
  },
  {
    name: 'path-parent-up',
    expr: '..x',
    dataCases: [
      { data: { x: 'on', group: { self: 1 } }, currentPath: ['group', 'self'] },
      { data: { group: { self: 1 } }, currentPath: ['group', 'self'] },
    ],
  },
  // A row of a repeated field is one level, whatever its key; only a row key position is a row.
  {
    name: 'path-row-sibling',
    expr: ".x == 'row'",
    dataCases: [
      { data: { x: 'root', items: { __k__: { x: 'row', name: 1 } } }, currentPath: ['items', '__k__', 'name'], rowKeys: [1] },
    ],
  },
  {
    name: 'path-row-parent',
    expr: "..x == 'root'",
    dataCases: ['__0000000000001__', '7', 'r1'].map((key) => (
      { data: { x: 'root', items: { x: 'collection', [key]: { x: 'row', name: 1 } } }, currentPath: ['items', key, 'name'], rowKeys: [1] })),
  },
  {
    name: 'path-row-nested-parent',
    expr: "..x == 'group'",
    dataCases: [
      { data: { x: 'root', group: { x: 'group', items: { 7: { name: 1 } } } }, currentPath: ['group', 'items', '7', 'name'], rowKeys: [2] },
    ],
  },
  {
    name: 'path-row-value-sibling',
    expr: ".x == 'root'",
    dataCases: [
      { data: { x: 'root', tags: { x: 'collection', __k__: 'a' } }, currentPath: ['tags', '__k__'], rowKeys: [1] },
    ],
  },
  {
    name: 'path-numeric-field-parent',
    expr: "..x == 'group'",
    dataCases: [
      { data: { x: 'root', group: { x: 'group', 7: { name: 1 } } }, currentPath: ['group', '7', 'name'] },
    ],
  },
  {
    name: 'path-wildcard-array',
    expr: 'items.*.y',
    dataCases: [
      { data: { items: [{ y: 0 }, { y: 5 }] }, currentPath: ['items', '0', 'self'] },
      { data: { items: [{ y: 0 }, { y: 0 }] }, currentPath: ['items', '1', 'self'] },
    ],
  },
  {
    name: 'path-wildcard-compare',
    expr: 'items.*.is_close == 0',
    dataCases: [
      { data: { items: [{ is_close: 0 }, { is_close: 1 }] }, currentPath: ['items', '0', 'self'] },
      { data: { items: [{ is_close: 1 }, { is_close: 1 }] }, currentPath: ['items', '1', 'self'] },
    ],
  },

  // ---- comparisons ------------------------------------------------------
  {
    name: 'cmp-eq-string',
    expr: ".country == 'US'",
    dataCases: [
      { data: { country: 'US' } },
      { data: { country: 'CA' } },
    ],
  },
  {
    name: 'cmp-eq-unquoted-ident',
    expr: '.status == draft',
    dataCases: [
      { data: { status: 'draft' } },
      { data: { status: 'final' } },
    ],
  },
  {
    name: 'cmp-ne',
    expr: ".type != 'a'",
    dataCases: [{ data: { type: 'b' } }, { data: { type: 'a' } }],
  },
  {
    name: 'cmp-gt',
    expr: '.age > 18',
    dataCases: [{ data: { age: 21 } }, { data: { age: 18 } }, { data: { age: 5 } }],
  },
  {
    name: 'cmp-ge-le',
    expr: '.n >= 10',
    dataCases: [{ data: { n: 10 } }, { data: { n: 9 } }],
  },
  {
    name: 'cmp-lt-coerce-string',
    expr: '.score < 50',
    dataCases: [{ data: { score: '30' } }, { data: { score: '90' } }],
  },
  {
    name: 'in-number-list',
    expr: '.is_display in 2,3',
    dataCases: [
      { data: { is_display: 2 } },
      { data: { is_display: 3 } },
      { data: { is_display: 1 } },
    ],
  },
  {
    name: 'in-bracket-ident-list',
    expr: '.country in [US, CA, UK]',
    dataCases: [{ data: { country: 'CA' } }, { data: { country: 'FR' } }],
  },
  {
    name: 'not-in-list',
    expr: '.role not in admin,root',
    dataCases: [{ data: { role: 'user' } }, { data: { role: 'admin' } }],
  },

  // ---- arrays and objects in equality: no number, the empty text --------
  // The objects are not empty: PHP decodes an empty JSON object as an empty array.
  {
    name: 'cmp-eq-object-string',
    expr: ".o == '[object Object]'",
    dataCases: [{ data: { o: { a: 1 } }, expected: false }],
  },
  {
    name: 'cmp-ne-object-string',
    expr: ".o != '[object Object]'",
    dataCases: [{ data: { o: { a: 1 } }, expected: true }],
  },
  {
    name: 'cmp-eq-object-empty-text',
    expr: ".o == ''",
    dataCases: [{ data: { o: { a: 1 } }, expected: true }],
  },
  {
    name: 'cmp-eq-string-array',
    expr: "'a' == .tags",
    dataCases: [
      { data: { tags: ['a'] }, expected: false },
      { data: { tags: [] }, expected: false },
    ],
  },
  {
    name: 'cmp-eq-number-array',
    expr: '0 == .tags',
    dataCases: [
      { data: { tags: [] }, expected: false },
      { data: { tags: [0] }, expected: false },
    ],
  },
  {
    name: 'cmp-eq-empty-text-array',
    expr: "'' == .tags",
    dataCases: [{ data: { tags: ['a'] }, expected: true }],
  },
  {
    name: 'in-object',
    expr: ".o in '[object Object]', x",
    dataCases: [{ data: { o: { a: 1 } }, expected: false }],
  },
  {
    name: 'not-in-object',
    expr: ".o not in '[object Object]'",
    dataCases: [{ data: { o: { a: 1 } }, expected: true }],
  },

  // ---- two arrays or two objects: JSON-value structural equality ----------
  // The objects are not empty and their keys are not 0, 1, …: PHP decodes such an object as an array.
  {
    name: 'cmp-eq-array-array',
    expr: '.a == .b',
    dataCases: [
      { data: { a: [1, 'x', true, null], b: [1, 'x', true, null] }, expected: true },
      { data: { a: [1, 2], b: [2, 1] }, expected: false },
      { data: { a: [1], b: [1, 1] }, expected: false },
      { data: { a: [1], b: ['1'] }, expected: false },
      { data: { a: [true], b: [1] }, expected: false },
      { data: { a: [[1], { k: 'v' }], b: [[1], { k: 'v' }] }, expected: true },
      { data: { a: [1], b: [oneWithFraction] }, expected: true },
    ],
  },
  {
    name: 'cmp-ne-array-array',
    expr: '.a != .b',
    dataCases: [
      { data: { a: ['x'], b: ['x'] }, expected: false },
      { data: { a: ['x'], b: ['y'] }, expected: true },
    ],
  },
  {
    name: 'cmp-eq-object-object',
    expr: '.a == .b',
    dataCases: [
      { data: { a: { x: 1, y: 'z' }, b: { y: 'z', x: 1 } }, expected: true },
      { data: { a: { x: 1 }, b: { x: 1, y: 2 } }, expected: false },
      { data: { a: { x: 1 }, b: { x: 2 } }, expected: false },
      { data: { a: { x: 1 }, b: { y: 1 } }, expected: false },
      { data: { a: { x: { y: [1] } }, b: { x: { y: [1] } } }, expected: true },
      { data: { a: { x: 1 }, b: { x: oneWithFraction } }, expected: true },
    ],
  },
  {
    name: 'cmp-eq-array-object',
    expr: '.a == .o',
    dataCases: [
      { data: { a: [1], o: { x: 1 } }, expected: false },
      { data: { a: ['v'], o: { k: 'v' } }, expected: false },
    ],
  },
  {
    name: 'cmp-eq-array-null',
    expr: '.a == .n',
    dataCases: [
      { data: { a: [1], n: null }, expected: false },
      { data: { a: [1] }, expected: false },
    ],
  },
  // An array that a path without a wildcard names is one value, not the candidates of a wildcard.
  {
    name: 'in-array',
    expr: '.tags in a, b',
    dataCases: [{ data: { tags: ['a'] }, expected: false }],
  },
  {
    name: 'not-in-array',
    expr: '.tags not in a, b',
    dataCases: [{ data: { tags: ['a'] }, expected: true }],
  },
  {
    name: 'cmp-eq-number-fraction',
    expr: '.n == 1.0',
    dataCases: [{ data: { n: 1 }, expected: true }],
  },

  // ---- the text of a boolean in a string comparison: true or false --------
  {
    name: 'cmp-eq-boolean-text',
    expr: ".f == 'true'",
    dataCases: [
      { data: { f: true }, expected: true },
      { data: { f: false }, expected: false },
    ],
  },
  {
    name: 'cmp-eq-boolean-false-text',
    expr: ".f == 'false'",
    dataCases: [{ data: { f: false }, expected: true }],
  },
  {
    name: 'cmp-eq-boolean-array',
    expr: '.f == .tags',
    dataCases: [{ data: { f: false, tags: ['a'] }, expected: false }],
  },
  {
    name: 'in-boolean-text',
    expr: ".f in 'true', x",
    dataCases: [{ data: { f: true }, expected: true }],
  },

  // ---- logical ----------------------------------------------------------
  {
    name: 'logic-and',
    expr: ".a == 'x' && .b > 5",
    dataCases: [
      { data: { a: 'x', b: 6 } },
      { data: { a: 'x', b: 5 } },
      { data: { a: 'y', b: 6 } },
    ],
  },
  {
    name: 'logic-or',
    expr: '.a == 1 || .b == 1',
    dataCases: [
      { data: { a: 1, b: 0 } },
      { data: { a: 0, b: 1 } },
      { data: { a: 0, b: 0 } },
    ],
  },
  {
    name: 'logic-not',
    expr: '!.flag',
    dataCases: [{ data: { flag: false } }, { data: { flag: true } }],
  },
  {
    name: 'logic-not-group',
    expr: '!(.a == 1 || .b == 1)',
    dataCases: [{ data: { a: 0, b: 0 } }, { data: { a: 1, b: 0 } }],
  },

  // ---- precedence stress -----------------------------------------------
  {
    name: 'precedence-and-or-mix',
    expr: '.a == 1 || .b == 1 && .c == 1',
    dataCases: [
      { data: { a: 1, b: 0, c: 0 } }, // a true -> overall true regardless
      { data: { a: 0, b: 1, c: 1 } }, // b&&c true
      { data: { a: 0, b: 1, c: 0 } }, // b true but c false -> and is false -> false
    ],
  },
  {
    name: 'precedence-group-overrides',
    expr: '(.a == 1 || .b == 1) && .c == 1',
    dataCases: [
      { data: { a: 1, b: 0, c: 1 } },
      { data: { a: 1, b: 0, c: 0 } },
    ],
  },
  {
    name: 'precedence-not-vs-and',
    expr: '!.a && .b',
    dataCases: [
      { data: { a: false, b: true } },
      { data: { a: true, b: true } },
    ],
  },

  // ---- nested ternary (right-assoc), value-returning --------------------
  {
    name: 'ternary-value-string',
    expr: ".status == 'active' ? 'text-success' : 'text-muted'",
    dataCases: [{ data: { status: 'active' } }, { data: { status: 'off' } }],
  },
  {
    name: 'ternary-value-number',
    expr: '.big ? 100 : 0',
    dataCases: [{ data: { big: true } }, { data: { big: false } }],
  },
  {
    name: 'ternary-value-null',
    expr: ".show == 1 ? 'visible' : null",
    dataCases: [{ data: { show: 1 } }, { data: { show: 0 } }],
  },
  {
    name: 'ternary-nested-right-assoc',
    expr: ".level == 1 ? 'a' : .level == 2 ? 'b' : 'c'",
    dataCases: [
      { data: { level: 1 } },
      { data: { level: 2 } },
      { data: { level: 3 } },
    ],
  },

  // ---- path vs path comparison (.a < .b) -------------------------------
  {
    name: 'path-vs-path-lt',
    expr: '.a < .b',
    dataCases: [
      { data: { a: 1, b: 2 } },
      { data: { a: 2, b: 2 } },
      { data: { a: 3, b: 2 } },
    ],
  },
  {
    name: 'path-vs-path-eq',
    expr: '.password == .password_confirm',
    dataCases: [
      { data: { password: 'pw', password_confirm: 'pw' } },
      { data: { password: 'pw', password_confirm: 'no' } },
    ],
  },
  {
    name: 'path-vs-path-ge',
    expr: '.max >= .min',
    dataCases: [
      { data: { max: 10, min: 5 } },
      { data: { max: 5, min: 10 } },
    ],
  },

  // ---- condition-map shaped (default key true) -------------------------
  // The condition map is a thin wrapper that calls the engine per key in
  // declaration order. We model each key as its own case; the default key is
  // the literal `true` (always-true), evaluated as a standalone expression.
  {
    name: 'condmap-key-active',
    expr: ".status == 'active'",
    dataCases: [{ data: { status: 'active' } }, { data: { status: 'pending' } }],
  },
  {
    name: 'condmap-key-pending',
    expr: ".status == 'pending'",
    dataCases: [{ data: { status: 'pending' } }, { data: { status: 'active' } }],
  },
  {
    name: 'condmap-default-key-true',
    expr: 'true',
    dataCases: [{ data: {} }, { data: { status: 'active' } }],
  },

  // ---- truthy boundaries (null / 0 / "" / empty array) -----------------
  {
    name: 'truthy-null',
    expr: '.v',
    dataCases: [{ data: { v: null } }, { data: {} }],
  },
  {
    name: 'truthy-zero',
    expr: '.v',
    dataCases: [{ data: { v: 0 } }],
  },
  {
    name: 'truthy-empty-string',
    expr: '.v',
    dataCases: [{ data: { v: '' } }],
  },
  {
    name: 'truthy-empty-array',
    expr: '.v',
    dataCases: [{ data: { v: [] } }],
  },
  {
    name: 'truthy-empty-object',
    expr: '.v',
    dataCases: [{ data: { v: {} } }],
  },
  {
    name: 'truthy-nonempty-string',
    expr: '.v',
    dataCases: [{ data: { v: 'hello' } }],
  },
  {
    name: 'literal-bool-true',
    expr: 'true',
    dataCases: [{ data: {} }],
  },
  {
    name: 'literal-bool-false',
    expr: 'false',
    dataCases: [{ data: {} }],
  },

  // ---- nesting limit: a syntax tree of exactly the limit is accepted -----
  {
    name: 'nesting-at-limit',
    expr: nested(MAX_EXPRESSION_DEPTH - 1, '.a'),
    dataCases: [{ data: { a: 1 } }, { data: { a: 0 } }],
  },
  {
    name: 'nesting-at-limit-negations',
    expr: '!'.repeat(MAX_EXPRESSION_DEPTH - 1) + '.a',
    dataCases: [{ data: { a: 1 } }, { data: { a: 0 } }],
  },
  {
    name: 'nesting-at-limit-chain',
    expr: Array.from({ length: MAX_EXPRESSION_DEPTH }, () => '.a').join(' || '),
    dataCases: [{ data: { a: 1 } }, { data: { a: 0 } }],
  },
  {
    name: 'nesting-at-limit-ternaries',
    expr: '.a ? 1 : '.repeat(MAX_EXPRESSION_DEPTH - 1) + '2',
    dataCases: [{ data: { a: 1 } }, { data: { a: 0 } }],
  },
];

/** `count` parentheses around `inner`. */
function nested(count: number, inner: string): string {
  return '('.repeat(count) + inner + ')'.repeat(count);
}

// ---------------------------------------------------------------------------
// Rejected expressions: { name, expr }. The expected error is the first line of
// the message the engine reports below.
// ---------------------------------------------------------------------------

const REJECTED: Array<{ name: string; expr: string }> = [
  { name: 'in-bracket-list-unclosed', expr: '.country in [US, CA' },
  // Each tree is one level deeper than the limit.
  { name: 'nesting-over-limit-groups', expr: nested(MAX_EXPRESSION_DEPTH, '.a') },
  { name: 'nesting-over-limit-negations', expr: '!'.repeat(MAX_EXPRESSION_DEPTH) + '.a' },
  { name: 'nesting-over-limit-comparison', expr: nested(MAX_EXPRESSION_DEPTH - 1, '.a == 1') },
  {
    name: 'nesting-over-limit-chain',
    expr: Array.from({ length: MAX_EXPRESSION_DEPTH + 1 }, () => '.a').join(' || '),
  },
  { name: 'nesting-over-limit-ternaries', expr: '.a ? 1 : '.repeat(MAX_EXPRESSION_DEPTH) + '1' },
  // Far deeper than any parser stack: the parser stops at the limit.
  { name: 'nesting-far-over-limit', expr: nested(10000, '.a') },
];

// ---------------------------------------------------------------------------
// Run the engine for real
// ---------------------------------------------------------------------------

function normalize(v: unknown): boolean | string | number | null {
  if (v === undefined) return null;
  if (
    v === null ||
    typeof v === 'boolean' ||
    typeof v === 'string' ||
    typeof v === 'number'
  ) {
    return v;
  }
  // Wildcard arrays etc. — should not appear in these fixtures; flag loudly.
  throw new Error('non-scalar evaluation value: ' + JSON.stringify(v));
}

/** The token type that each requirement of docs/spec/expressions.md (CUXP-001 to CUXP-017) defines. */
const TOKEN_REQUIREMENTS: Record<string, string> = {
  DOT: 'CUXP-001',
  DOT_DOT: 'CUXP-002',
  ASTERISK: 'CUXP-003',
  IDENTIFIER: 'CUXP-004',
  STRING: 'CUXP-005',
  NUMBER: 'CUXP-006',
  BOOLEAN: 'CUXP-007',
  NULL: 'CUXP-008',
  EQ: 'CUXP-009',
  NE: 'CUXP-009',
  GT: 'CUXP-010',
  GE: 'CUXP-010',
  LT: 'CUXP-010',
  LE: 'CUXP-010',
  AND: 'CUXP-011',
  OR: 'CUXP-011',
  NOT: 'CUXP-011',
  IN: 'CUXP-012',
  NOT_IN: 'CUXP-012',
  QUESTION: 'CUXP-013',
  COLON: 'CUXP-013',
  LPAREN: 'CUXP-014',
  RPAREN: 'CUXP-014',
  LBRACKET: 'CUXP-015',
  RBRACKET: 'CUXP-015',
  COMMA: 'CUXP-015',
  EOF: 'CUXP-017',
};

/**
 * The requirements of docs/spec/expressions.md that a case tests: each one whose token type, whitespace, or AST node
 * the case contains (CUXP-016 whitespace, CUXP-018 to CUXP-023 the operators and nodes of the precedence and AST).
 */
function requirementsOf(expr: string, tokens: unknown[], ast: unknown): string[] {
  const found = new Set<string>();
  for (const token of tokens) {
    const type = isRecord(token) ? token.type : undefined;
    const requirement = typeof type === 'string' ? TOKEN_REQUIREMENTS[type] : undefined;
    if (requirement !== undefined) found.add(requirement);
  }
  if (/\s/.test(expr)) found.add('CUXP-016');
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isRecord(node)) return;
    if (node.type === 'Ternary') found.add('CUXP-018');
    if (node.type === 'Binary' && node.operator === '||') found.add('CUXP-019');
    if (node.type === 'Binary' && node.operator === '&&') found.add('CUXP-020');
    if (node.type === 'Unary' && node.operator === '!') found.add('CUXP-021');
    if (node.type === 'In' || (node.type === 'Binary' && ['==', '!=', '>', '>=', '<', '<='].includes(String(node.operator)))) {
      found.add('CUXP-022');
    }
    if (node.type === 'Path' || node.type === 'Literal' || node.type === 'Group') found.add('CUXP-023');
    Object.values(node).forEach(walk);
  };
  walk(ast);
  return [...found].sort();
}

const out = SPECS.map((spec) => {
  const tokens = serializeTokens(spec.expr);
  const ast = buildAst(spec.expr);
  const parsed = new Parser(new Lexer(spec.expr).tokenize()).parse();

  const cases = spec.dataCases.map((dc) => {
    const ctx: PathContext = {
      currentPath: dc.currentPath ?? [],
      formData: dc.data,
      ...(dc.rowKeys ? { rowKeys: dc.rowKeys } : {}),
    };
    const value = dc.expected ?? normalize(evaluateExpressionValue(parsed, ctx, 'CURRENT'));
    const truthy = dc.expected ?? evaluateCondition(parsed, ctx, 'CURRENT');
    const entry: Record<string, unknown> = { data: dc.data };
    if (dc.currentPath && dc.currentPath.length > 0) entry.currentPath = dc.currentPath;
    if (dc.rowKeys) entry.rowKeys = dc.rowKeys;
    entry.value = value;
    entry.truthy = truthy;
    return entry;
  });

  return { name: spec.name, expr: spec.expr, requirements: [...new Set([...requirementsOf(spec.expr, tokens, ast), ...(spec.requirements ?? [])])].sort(), tokens, ast, cases };
});

const rejected = REJECTED.map(({ name, expr }) => {
  try {
    new Parser(new Lexer(expr).tokenize()).parse();
  } catch (error) {
    if (error instanceof ParseError) {
      const requirements = requirementsOf(expr, serializeTokens(expr), undefined);
      return { name, expr, requirements, error: error.message.split('\n')[0] };
    }
    throw error;
  }
  throw new Error(`${name} parsed; it must be rejected`);
});

process.stdout.write(JSON.stringify([...out, ...rejected], null, 2) + '\n');
