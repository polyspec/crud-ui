/**
 * Numeric value and parameter cases written from docs/spec/validation-rules.md ("Values",
 * "Numbers", "Parameter errors"). Every result record is written from the specification with
 * the default rule messages, never from a runtime's answer.
 */
import { DEFAULT_MESSAGES, type WrittenCase } from './visibility.mts';

interface ErrorRecord { path: string; field: string; rule: string; message: string; value: unknown }

/** A default message with every `{i}` replaced by the canonical text of parameter i. */
function message(rule: string, params: unknown[], template = DEFAULT_MESSAGES[rule]): string {
  if (template === undefined) throw new Error(`No default message for ${rule}`);
  return params.reduce<string>((text, param, index) => text.split(`{${index}}`).join(String(param)), template);
}

function error(field: string, rule: string, value: unknown, params: unknown[] = [], template?: string): ErrorRecord {
  return { path: field, field, rule, message: message(rule, params, template), value };
}

/** One field of `type` (text unless given) per value, all declaring the same rules; `failing` maps a field to its failure. */
function fields(name: string, note: string, values: Record<string, unknown>, validate: Record<string, unknown>,
  failing: Record<string, [rule: string, params?: unknown[]]>, type = 'text'): WrittenCase {
  const properties: Record<string, unknown> = {};
  for (const field of Object.keys(values)) properties[field] = { type, validate };
  const errors = Object.keys(values).flatMap((field) => {
    const failure = failing[field];
    return failure === undefined ? [] : [error(field, failure[0], values[field] ?? null, failure[1] ?? [])];
  });
  return { name, note, spec: { type: 'group', properties }, data: values, expected: { valid: errors.length === 0, errors } };
}

/** Every field fails `rule` with `params`. */
const all = (values: Record<string, unknown>, rule: string, params: unknown[] = []) =>
  Object.fromEntries(Object.keys(values).map((field) => [field, [rule, params] as [string, unknown[]]]));

interface FailureCase { name: string; note: string; spec: Record<string, unknown>; data: Record<string, unknown>; expectFailure: { code: string; message: string; at: string } }

function declaration(name: string, note: string, validate: Record<string, unknown>, text: string): FailureCase {
  return {
    name, note,
    spec: { type: 'group', properties: { value: { type: 'text', validate } } },
    data: { value: '1' },
    expectFailure: { code: 'INVALID_RULE_PARAMETER', message: text, at: 'value' },
  };
}

const finite = (rule: string) => `Invalid ${rule} parameter: expected a finite number`;
const flag = (rule: string) => `Invalid ${rule} parameter: expected true or false`;
const count = (rule: string) => `Invalid ${rule} parameter: expected an integer from 0 to 9007199254740991`;
const rangeText = 'Invalid range parameter: expected [minimum, maximum] finite numbers with minimum not above maximum';
const stepText = 'Invalid step parameter: expected a finite number above 0';

const numericTexts = { integer: '12', negative: '-12', fraction: '0.5', leadingDot: '.5', exponent: '1e5',
  upperExponent: '1E-3', signedExponent: '-.5e+2', padded: '\u3000 12\t', zero: '0', number: 12, fractionNumber: 1.5 };
const notNumeric = { plus: '+1', trailingDot: '1.', hex: '0x10', infinity: 'Infinity', nan: 'NaN',
  separator: '1_000', arabicDigits: '\u0661\u0662', bareExponent: '1e', exponentOnly: 'e5', doubleSign: '--1',
  overflow: '1e999', comma: '1,5', inner: '1 2', yes: true, no: false, list: ['1'], record: { a: 1 } };

export const NUMERIC_CASES: Array<WrittenCase | FailureCase> = [
  // --- numeric text ---
  fields('number-text-accepted', 'numeric text and finite numbers are numeric.', numericTexts, { number: true }, {}),
  fields('number-text-rejected', 'other spellings, overflow, booleans, arrays and objects are not numeric.', notNumeric,
    { number: true }, all(notNumeric, 'number')),
  fields('number-empty-skipped', 'an empty value is not evaluated.', { missing: undefined, blank: ' ', nothing: null },
    { number: true }, {}),
  fields('number-underflow', 'text whose value underflows reads as 0 and is numeric.', { tiny: '1e-400' }, { number: true }, {}),

  // --- bounds ---
  fields('min-inclusive', 'min is inclusive and reads numeric text.', { equal: 5, text: '5.0', exponent: '5e0', below: 4.999, belowText: '4.999' },
    { min: 5 }, { below: ['min', [5]], belowText: ['min', [5]] }),
  fields('max-inclusive', 'max is inclusive.', { equal: '5', above: '5.0001', aboveNumber: 6 },
    { max: 5 }, { above: ['max', [5]], aboveNumber: ['max', [5]] }),
  fields('range-inclusive', 'range includes both bounds.', { low: 1, high: '5', below: '0.999', above: 5.5 },
    { range: [1, 5] }, { below: ['range', [1, 5]], above: ['range', [1, 5]] }),
  fields('bounds-fail-non-numeric', 'a value that is not numeric fails min, max and range.',
    { text: 'abc', exponent: '1e3x', yes: true },
    { min: 1, max: 10, range: [1, 10] }, { text: ['min', [1]], exponent: ['min', [1]], yes: ['min', [1]] }),
  fields('max-reads-exponent', 'exponent text is numeric: 1e3 is above 10.', { exponent: '1e3' }, { max: 10 }, { exponent: ['max', [10]] }),
  fields('bounds-negative-zero-and-fractions', 'fractional and negative bounds compare as doubles.',
    { inside: '-0.25', outside: '-0.75' }, { range: [-0.5, 0.5] }, { outside: ['range', [-0.5, 0.5]] }),

  // --- range fields (docs/spec/schema.md, Range fields) ---
  fields('range-field-values', 'a range field is validated by its range and step rules: a numeric value on a step within the bounds passes, an empty value is not evaluated.',
    { on: 0.3, text: '0.7', top: 1, empty: '', above: 1.1, below: -0.1, off: 0.25, drift: 0.30000000000000004, word: 'loud', yes: true },
    { range: [0, 1], step: 0.1 },
    { above: ['range', [0, 1]], below: ['range', [0, 1]], off: ['step', [0.1]], drift: ['step', [0.1]], word: ['range', [0, 1]], yes: ['range', [0, 1]] }, 'range'),

  // --- step ---
  fields('step-exact-decimal', 'multiples are decided on the decimal texts without a tolerance.',
    { exact: '0.3', drift: 0.30000000000000004, tiny: 2e-7, near: '1.0000000001', negative: -0.6, zero: 0, large: '1e21' },
    { step: 0.1 }, { drift: ['step', [0.1]], tiny: ['step', [0.1]], near: ['step', [0.1]] }),
  fields('step-small-and-large', 'small and large steps count from 0.',
    { small: 2e-7, notSmall: 3e-7 }, { step: 2e-7 }, { notSmall: ['step', [2e-7]] }),
  fields('step-large', 'a large step keeps exact multiples.', { multiple: 1e21, fifteen: '1.5e21', notMultiple: '1.05e21' }, { step: 1e20 },
    { notMultiple: ['step', [1e20]] }),
  fields('step-fails-non-numeric', 'a value that is not numeric fails step.', { text: 'ten', exponentOk: '1e1' }, { step: 5 },
    { text: ['step', [5]] }),
  fields('step-quarter', 'a quarter step.', { yes: 1.75, no: '1.8' }, { step: 0.25 }, { no: ['step', [0.25]] }),

  // --- digits ---
  fields('digits-values', 'digits accepts ASCII digit strings and numbers whose canonical text is digits.',
    { text: '123', padded: ' 123 ', leadingZeros: '007', number: 42, zero: 0,
      letters: '12a', signed: '-1', decimal: '1.0', fraction: 1.5, exponentNumber: 1e21, yes: true,
      arabic: '\u0661\u0662', inner: '1 2' },
    { digits: true },
    Object.fromEntries(['letters', 'signed', 'decimal', 'fraction', 'exponentNumber', 'yes', 'arabic', 'inner']
      .map((field) => [field, ['digits'] as [string]]))),

  // --- counts ---
  {
    name: 'count-values',
    note: 'arrays count elements, objects count keys, missing, null and blank count 0, other scalars count 1.',
    spec: {
      type: 'group',
      properties: {
        missing: { type: 'text', validate: { mincount: 1 } },
        nothing: { type: 'text', validate: { mincount: 1 } },
        blank: { type: 'text', validate: { mincount: 1 } },
        scalar: { type: 'text', validate: { mincount: 1, maxcount: 1 } },
        scalarOver: { type: 'text', validate: { maxcount: 0 } },
        list: { type: 'text', validate: { mincount: 2, maxcount: 2 } },
        emptyList: { type: 'text', validate: { mincount: 1 } },
        record: { type: 'text', validate: { maxcount: 1 } },
        number: { type: 'text', validate: { mincount: 1 } },
      },
    },
    data: { nothing: null, blank: ' ', scalar: 'x', scalarOver: 'x', list: ['a', 'b'], emptyList: [], record: { a: 1, b: 2 }, number: 0 },
    expected: {
      valid: false,
      errors: [
        error('missing', 'mincount', null, [1]),
        error('nothing', 'mincount', null, [1]),
        error('blank', 'mincount', ' ', [1]),
        error('scalarOver', 'maxcount', 'x', [0]),
        error('emptyList', 'mincount', [], [1]),
        error('record', 'maxcount', { a: 1, b: 2 }, [1]),
      ],
    },
  },

  // --- membership reads the same numeric text ---
  fields('in-numeric-text', 'in compares numeric values read with the numeric text grammar.',
    { exponent: '1e2', padded: ' 100 ', fraction: '100.0', plus: '+100', trailingDot: '100.', hex: '0x64' },
    { in: [100] }, { plus: ['in'], trailingDot: ['in'], hex: ['in'] }),

  // --- messages ---
  fields('message-parameter-text', 'a message shows parameters as canonical text.',
    { fraction: 1, large: 1 }, { min: 5.5 }, { fraction: ['min', [5.5]], large: ['min', [5.5]] }),
  fields('message-large-parameter', 'a large parameter uses the exponent form of the canonical text.',
    { value: 1 }, { min: 1e21 }, { value: ['min', ['1e+21']] }),
  {
    name: 'message-every-placeholder',
    note: 'every placeholder of a declared message is replaced.',
    spec: { type: 'group', properties: { value: { type: 'text', validate: { range: [2, 4] }, messages: { range: '{0}..{1} ({0} to {1})' } } } },
    data: { value: 9 },
    expected: { valid: false, errors: [error('value', 'range', 9, [2, 4], '{0}..{1} ({0} to {1})')] },
  },

  {
    name: 'message-missing-placeholder',
    note: 'a placeholder for a parameter the rule does not have stays as written.',
    spec: { type: 'group', properties: { value: { type: 'text', validate: { min: 3 }, messages: { min: 'at least {0}, not {1}' } } } },
    data: { value: 1 },
    expected: { valid: false, errors: [{ path: 'value', field: 'value', rule: 'min', message: 'at least 3, not {1}', value: 1 }] },
  },
  fields('in-member-as-written', 'list members are read as written: a member with whitespace is not numeric text, and a trimmed value never equals it.',
    { number: 100, text: ' 100' }, { in: [' 100'] }, { number: ['in'], text: ['in'] }),

  // --- parameter errors ---
  declaration('number-parameter-number', 'number takes true or false.', { number: 5 }, flag('number')),
  declaration('digits-parameter-number', 'digits takes true or false.', { digits: 1 }, flag('digits')),
  declaration('min-parameter-true', 'a bound is a finite number.', { min: true }, finite('min')),
  declaration('max-parameter-list', 'a bound is a finite number.', { max: [5] }, finite('max')),
  declaration('min-parameter-object', 'a bound is a finite number, not a condition map with a non-number.', { min: { '.x': 'high', true: 1 } }, finite('min')),
  declaration('range-parameter-reversed', 'a range starts at its minimum.', { range: [5, 1] }, rangeText),
  declaration('range-parameter-short', 'a range has two bounds.', { range: [1] }, rangeText),
  declaration('range-parameter-long', 'a range has exactly two bounds.', { range: [1, 5, 9] }, rangeText),
  declaration('range-parameter-null-bound', 'range bounds are finite numbers.', { range: [null, 5] }, rangeText),
  declaration('step-parameter-zero', 'a step is above 0.', { step: 0 }, stepText),
  declaration('step-parameter-negative', 'a step is above 0.', { step: -1 }, stepText),
  declaration('step-parameter-true', 'a step is a number.', { step: true }, stepText),
  declaration('mincount-parameter-fraction', 'a count is an integer.', { mincount: 1.5 }, count('mincount')),
  declaration('maxcount-parameter-negative', 'a count is not negative.', { maxcount: -1 }, count('maxcount')),
  declaration('maxcount-parameter-true', 'a count is a number.', { maxcount: true }, count('maxcount')),
  {
    name: 'min-parameter-from-data',
    note: 'a bound a ternary takes from the data is checked when selected.',
    spec: { type: 'group', properties: { strict: { type: 'text' }, limit: { type: 'text' }, value: { type: 'text', validate: { min: '.strict ? .limit : 0' } } } },
    data: { strict: 1, limit: 'high', value: '3' },
    expectFailure: { code: 'INVALID_RULE_PARAMETER', message: finite('min'), at: 'value' },
  },
  {
    name: 'min-parameter-from-data-numeric',
    note: 'a finite number taken from the data is a bound.',
    spec: { type: 'group', properties: { strict: { type: 'text' }, limit: { type: 'text' }, value: { type: 'text', validate: { min: '.strict ? .limit : 0' } } } },
    data: { strict: 1, limit: 4, value: '3' },
    expected: { valid: false, errors: [error('value', 'min', '3', [4])] },
  },
];
