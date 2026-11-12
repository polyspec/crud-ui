/**
 * Visibility and data-only collection cases written from docs/spec/validation-rules.md
 * ("Evaluation", "Conditional parameters"), docs/spec/schema.md and docs/spec/form-runtime.md.
 *
 * Each case carries its complete result record. The records are written from the
 * specification with the default rule messages below, never from a runtime's answer.
 */

/** Default message of each rule; `{0}` and `{1}` are the rule parameters. */
export const DEFAULT_MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  email: 'Please enter a valid email address.',
  url: 'Please enter a valid URL.',
  minlength: 'Please enter at least {0} characters.',
  maxlength: 'Please enter no more than {0} characters.',
  rangelength: 'Please enter a value between {0} and {1} characters.',
  number: 'Please enter a valid number.',
  digits: 'Please enter only digits.',
  min: 'Please enter a value greater than or equal to {0}.',
  max: 'Please enter a value less than or equal to {0}.',
  range: 'Please enter a value between {0} and {1}.',
  step: 'Please enter a value that is a multiple of {0}.',
  match: 'Please enter a valid format.',
  pattern: 'Please enter a valid format.',
  equalTo: 'Please enter the same value again.',
  containedIn: 'Please enter a value that the referenced field contains.',
  typeFrom: 'Please enter a value of the declared type.',
  minFrom: 'Please enter a value at or above the declared minimum.',
  maxFrom: 'Please enter a value at or below the declared maximum.',
  notEqual: 'Please enter a different value.',
  in: 'Please select a valid option.',
  date: 'Please enter a valid date.',
  dateISO: 'Please enter a valid date in ISO format (YYYY-MM-DD).',
  enddate: 'End date must be after the start date.',
  mincount: 'Please select at least {0} items.',
  maxcount: 'Please select no more than {0} items.',
  unique: 'Values must be unique.',
  accept: 'Please upload a file with a valid format.',
  conditionTree: 'Please enter a valid condition.',
  reference: 'Please select an existing value.',
};

interface ErrorRecord {
  path: string;
  field: string;
  rule: string;
  message: string;
  value: unknown;
}

export interface WrittenCase {
  name: string;
  note: string;
  spec: Record<string, unknown>;
  data: Record<string, unknown>;
  expected: { valid: boolean; errors: ErrorRecord[] };
  /**
   * The data paths of the fields whose design.show resolves to false, stated for every case whose
   * specification declares design.show (validation-rules.md, "Evaluation").
   */
  hidden?: string[];
}

/** One error record: the field is the last path segment. */
function error(path: string, rule: string, value: unknown, ...params: unknown[]): ErrorRecord {
  const template = DEFAULT_MESSAGES[rule];
  if (template === undefined) throw new Error(`No default message for ${rule}`);
  const message = params.reduce<string>((text, param, index) => text.replace(`{${index}}`, String(param)), template);
  return { path, field: path.slice(path.lastIndexOf('.') + 1), rule, message, value };
}

const result = (...errors: ErrorRecord[]) => ({ valid: errors.length === 0, errors });

/** Fields that each fail a different rule while visible. */
function failingFields(show: unknown): Record<string, unknown> {
  return {
    name: { type: 'text', design: { show }, validate: { required: true } },
    code: { type: 'text', design: { show }, validate: { required: true, pattern: '^[a-z]+$' } },
    title: { type: 'text', design: { show }, validate: { minlength: 3, maxlength: 10 } },
    amount: { type: 'number', design: { show }, validate: { min: 1 } },
    contact: { type: 'email', design: { show }, validate: { email: true } },
    tags: { type: 'text', multiple: true, design: { show }, validate: { mincount: 2 } },
  };
}
const failingValues = { name: '', code: 'x!', title: 'ab', amount: 'abc', contact: 'not-an-address', tags: { __t1__: 'one' } };

/** A flag and a group shown only when the flag is 1. */
const toggleSpec = {
  type: 'group',
  properties: {
    is_display: { type: 'text' },
    display: {
      type: 'group',
      design: { show: '.is_display == 1' },
      properties: {
        code: { type: 'text', validate: { required: true, pattern: '^[A-Z]{3}$' } },
        title: { type: 'text', validate: { required: true, maxlength: 10 } },
      },
    },
  },
};
const invalidDisplay = { code: 'abc1', title: '' };

/** A data-only repeated group with a required name and a non-negative price per row. */
const onlyRows = (multiple: unknown, validate?: Record<string, unknown>) => ({
  type: 'group',
  properties: {
    variants: {
      type: 'group',
      multiple,
      ...(validate ? { validate } : {}),
      properties: {
        name: { type: 'text', validate: { required: true } },
        price: { type: 'number', validate: { min: 0 } },
      },
    },
  },
});

/** A case whose data or specification fails before validation. */
export interface FailingCase {
  name: string;
  note: string;
  spec: Record<string, unknown>;
  data: Record<string, unknown>;
  expectFailure: { code: string; message: string; at: string };
}

export const VISIBILITY_CASES: Array<WrittenCase | FailingCase> = [
  {
    name: 'visibility-condition-map-without-selection',
    note: 'Only a resolved false hides a field: a condition map that selects nothing leaves the field visible.',
    spec: {
      type: 'group',
      properties: {
        mode: { type: 'text' },
        unselected: { type: 'text', design: { show: { ".mode == 'on'": false } }, validate: { required: true } },
      },
    },
    data: { mode: 'off', unselected: '' },
    hidden: [],
    expected: result(error('unselected', 'required', '')),
  },
  {
    name: 'visibility-literal-string-show',
    note: 'A design.show string that is not a valid expression is a literal, and only false hides: the field is visible.',
    spec: {
      type: 'group',
      properties: {
        literal: { type: 'text', design: { show: '.mode == (' }, validate: { required: true } },
      },
    },
    data: { literal: '' },
    hidden: [],
    expected: result(error('literal', 'required', '')),
  },
  {
    name: 'visibility-show-literal-identifier',
    note: "A design.show string that is not a condition expression is a literal even when it parses: 'enabled' is a literal and shows the field, and a ternary whose branch is 0 resolves to 0, which is not false.",
    spec: {
      type: 'group',
      properties: {
        enabled: { type: 'text' },
        word: { type: 'text', design: { show: 'enabled' }, validate: { required: true } },
        zero: { type: 'text', design: { show: ".enabled == 1 ? true : 0" }, validate: { required: true } },
        off: { type: 'text', design: { show: ".enabled == 1 ? true : false" }, validate: { required: true } },
      },
    },
    data: { enabled: 0, word: '', zero: '', off: '' },
    hidden: ['off'],
    expected: result(error('word', 'required', ''), error('zero', 'required', '')),
  },
  {
    name: 'visibility-hidden-data-shape',
    note: 'The data shape is an input contract, checked whether or not the field is visible.',
    spec: {
      type: 'group',
      properties: {
        items: { type: 'group', multiple: true, design: { show: false }, properties: { code: { type: 'text' } } },
      },
    },
    data: { items: [{ code: 'x' }] },
    expectFailure: { code: 'INVALID_FORM_INPUT', message: 'Repeated data must be a keyed object: items', at: '' },
  },
  {
    name: 'visibility-hidden-field-skips-all-rules',
    note: 'A field whose design.show resolves to false is hidden: none of its rules run (required, pattern, lengths, the implicit number check, email, mincount) and it reports no error. Its value is kept.',
    spec: { type: 'group', properties: { enabled: { type: 'checkbox' }, ...failingFields('.enabled') } },
    data: { enabled: 0, ...failingValues },
    hidden: ['name', 'code', 'title', 'amount', 'contact', 'tags'],
    expected: result(),
  },
  {
    name: 'visibility-shown-field-validates',
    note: 'The same fields with design.show resolving to true are visible, and each reports its first failing rule in declaration order.',
    spec: { type: 'group', properties: { enabled: { type: 'checkbox' }, ...failingFields('.enabled') } },
    data: { enabled: 1, ...failingValues },
    hidden: [],
    expected: result(
      error('name', 'required', ''),
      error('code', 'pattern', 'x!'),
      error('title', 'minlength', 'ab', 3),
      error('amount', 'number', 'abc'),
      error('contact', 'email', 'not-an-address'),
      error('tags', 'mincount', { __t1__: 'one' }, 2),
    ),
  },
  {
    name: 'visibility-literal-show',
    note: 'design.show: false hides a field whatever the data; design.show: true and a field without design.show are visible.',
    spec: {
      type: 'group',
      properties: {
        hidden: { type: 'text', design: { show: false }, validate: { required: true } },
        shown: { type: 'text', design: { show: true }, validate: { required: true } },
        plain: { type: 'text', validate: { required: true } },
      },
    },
    data: { hidden: '', shown: '', plain: '' },
    hidden: ['hidden'],
    expected: result(error('shown', 'required', ''), error('plain', 'required', '')),
  },
  {
    name: 'visibility-condition-map',
    note: 'A condition map resolves design.show to its first matching value or its true default: the first two maps select false and hide their fields, the third selects true.',
    spec: {
      type: 'group',
      properties: {
        mode: { type: 'text' },
        defaulted: { type: 'text', design: { show: { ".mode == 'on'": true, true: false } }, validate: { required: true } },
        matched: { type: 'text', design: { show: { ".mode == 'off'": false, true: true } }, validate: { required: true } },
        visible: { type: 'text', design: { show: { ".mode == 'on'": false, true: true } }, validate: { required: true } },
      },
    },
    data: { mode: 'off', defaulted: '', matched: '', visible: '' },
    hidden: ['defaulted', 'matched'],
    expected: result(error('visible', 'required', '')),
  },
  {
    name: 'visibility-hidden-group-descendants',
    note: 'Every field inside a hidden group is skipped, including a nested group, a nested repeated group with mincount, the rows of that collection and a child whose own design.show is true. A hidden top-level collection skips its count rule.',
    spec: {
      type: 'group',
      properties: {
        enabled: { type: 'checkbox' },
        details: {
          type: 'group',
          design: { show: '.enabled' },
          properties: {
            name: { type: 'text', validate: { required: true } },
            always: { type: 'text', design: { show: true }, validate: { required: true } },
            inner: {
              type: 'group',
              properties: { code: { type: 'text', validate: { pattern: '^[0-9]+$' } } },
            },
            items: {
              type: 'group',
              multiple: true,
              validate: { mincount: 2 },
              properties: { code: { type: 'text', validate: { required: true } } },
            },
          },
        },
        rows: {
          type: 'group',
          multiple: true,
          design: { show: false },
          validate: { mincount: 3 },
          properties: { label: { type: 'text', validate: { required: true } } },
        },
      },
    },
    data: {
      enabled: '',
      details: { name: '', always: '', inner: { code: 'abc' }, items: { __i1__: { code: '' } } },
      rows: { __r1__: { label: '' } },
    },
    hidden: ['details', 'rows'],
    expected: result(),
  },
  {
    name: 'visibility-per-row',
    note: "design.show resolves in the row context: '.kind' reads the sibling in the same row, so only the row whose kind is custom validates its note.",
    spec: {
      type: 'group',
      properties: {
        items: {
          type: 'group',
          multiple: true,
          properties: {
            kind: { type: 'text' },
            note: { type: 'text', design: { show: ".kind == 'custom'" }, validate: { required: true, minlength: 2 } },
          },
        },
      },
    },
    data: {
      items: {
        __b__: { kind: 'custom', note: 'x' },
        __a__: { kind: 'plain', note: '' },
        __c__: { kind: 'custom', note: '' },
      },
    },
    hidden: ['items.__a__.note'],
    expected: result(
      error('items.__b__.note', 'minlength', 'x', 2),
      error('items.__c__.note', 'required', ''),
    ),
  },
  // A row is one level of a relative path, whatever its key (expressions.md, "Evaluation").
  ...['__a__', '7', 'r1'].map((key): WrittenCase => ({
    name: `visibility-row-parent-${key.replace(/_/g, '')}`,
    note: "in a field of a group row, '..' reads the field beside the collection for design.show, a conditional parameter and a field reference, whatever the row key is.",
    spec: {
      type: 'group',
      properties: {
        mode: { type: 'text' },
        strict: { type: 'text' },
        code: { type: 'text' },
        items: {
          type: 'group',
          multiple: true,
          properties: {
            note: { type: 'text', design: { show: "..mode == 'on'" }, validate: { required: true } },
            level: { type: 'text', validate: { required: '..strict == 1' } },
            copy: { type: 'text', validate: { equalTo: '..code' } },
          },
        },
      },
    },
    data: { mode: 'on', strict: 1, code: 'abc', items: { [key]: { note: '', level: '', copy: 'abd' } } },
    hidden: [],
    expected: result(
      error(`items.${key}.note`, 'required', ''),
      error(`items.${key}.level`, 'required', ''),
      error(`items.${key}.copy`, 'equalTo', 'abd'),
    ),
  })),
  {
    name: 'reference-nested-group',
    note: "a field reference resolves as a relative expression path: '.a' in a group reads the field of the group and '..a' the field beside the group.",
    spec: {
      type: 'group',
      properties: {
        a: { type: 'text' },
        g: {
          type: 'group',
          properties: {
            a: { type: 'text' },
            same: { type: 'text', validate: { equalTo: '.a' } },
            other: { type: 'text', validate: { notEqual: '..a' } },
          },
        },
      },
    },
    data: { a: 'root', g: { a: '1', same: '1', other: 'root' } },
    expected: result(error('g.other', 'notEqual', 'root')),
  },
  {
    name: 'visibility-row-parent-off',
    note: "the same row with the parent values off: '..mode' hides the note, '..strict' makes the level optional and '..code' matches the copy.",
    spec: {
      type: 'group',
      properties: {
        mode: { type: 'text' },
        strict: { type: 'text' },
        code: { type: 'text' },
        items: {
          type: 'group',
          multiple: true,
          properties: {
            note: { type: 'text', design: { show: "..mode == 'on'" }, validate: { required: true } },
            level: { type: 'text', validate: { required: '..strict == 1' } },
            copy: { type: 'text', validate: { equalTo: '..code' } },
          },
        },
      },
    },
    data: { mode: 'off', strict: 0, code: 'abc', items: { __a__: { note: '', level: '', copy: 'abc' } } },
    hidden: ['items.__a__.note'],
    expected: result(),
  },
  // Display switching: a parent value switches a subtree and its required fields on and off.
  ...([['off', 'b', [], ['details']], ['on', 'a', [error('details.name', 'required', ''), error('details.inner.code', 'required', '')], []]] as const)
    .map(([state, kind, errors, hidden]): WrittenCase => ({
      name: `switch-group-subtree-${state}`,
      note: 'a group whose design.show reads a sibling switches every rule of its subtree, a nested group included.',
      spec: { type: 'group', properties: {
        kind: { type: 'text' },
        details: { type: 'group', design: { show: ".kind == 'a'" }, properties: {
          name: { type: 'text', validate: { required: true } },
          inner: { type: 'group', properties: { code: { type: 'text', validate: { required: true } } } },
        } },
      } },
      data: { kind, details: { name: '', inner: { code: '' } } },
      hidden: [...hidden],
      expected: result(...errors),
    })),
  ...([['off', ['outer', 'outer.inner'], []], ['on', ['outer.inner'], []], ['deep', [], [error('outer.inner.code', 'required', '')]]] as const)
    .map(([mode, hidden, errors]): WrittenCase => ({
      name: `switch-nested-levels-${mode}`,
      note: "two nested groups switched by the same parent value: the inner group reads it with '..', and its required field applies only when both groups are shown.",
      spec: { type: 'group', properties: {
        mode: { type: 'text' },
        outer: { type: 'group', design: { show: ".mode != 'off'" }, properties: {
          inner: { type: 'group', design: { show: "..mode == 'deep'" }, properties: {
            code: { type: 'text', validate: { required: true } },
          } },
        } },
      } },
      data: { mode, outer: { inner: { code: '' } } },
      hidden: [...hidden],
      expected: result(...errors),
    })),
  ...([
    ['strict', ['rows.r2.extra'], [error('rows.r1.extra.note', 'required', ''), error('rows.r1.extra.flag.code', 'required', '')]],
    ['loose', ['rows.r1.extra.flag', 'rows.r2.extra', 'rows.r2.extra.flag'], [error('rows.r1.extra.note', 'required', '')]],
  ] as const).map(([mode, hidden, errors]): WrittenCase => ({
    name: `switch-rows-${mode}`,
    note: "in each row a group is switched by the kind of its row, and a group inside it by the value beside the collection, read with '...' because the row is one level.",
    spec: { type: 'group', properties: {
      mode: { type: 'text' },
      rows: { type: 'group', multiple: true, properties: {
        kind: { type: 'text' },
        extra: { type: 'group', design: { show: ".kind == 'x'" }, properties: {
          note: { type: 'text', validate: { required: true } },
          flag: { type: 'group', design: { show: "...mode == 'strict'" }, properties: {
            code: { type: 'text', validate: { required: true } },
          } },
        } },
      } },
    } },
    data: { mode, rows: {
      r2: { kind: 'y', extra: { note: '', flag: { code: '' } } },
      r1: { kind: 'x', extra: { note: '', flag: { code: '' } } },
    } },
    hidden: [...hidden],
    expected: result(...errors),
  })),
  {
    name: 'visibility-hidden-value-still-read',
    note: 'A hidden field reports nothing, but equalTo and a required condition elsewhere read its kept value.',
    spec: {
      type: 'group',
      properties: {
        secret: { type: 'text', design: { show: false }, validate: { minlength: 10 } },
        confirm: { type: 'text', validate: { equalTo: '.secret' } },
        reason: { type: 'text', validate: { required: ".secret == 'open'" } },
      },
    },
    data: { secret: 'open', confirm: 'other', reason: '' },
    hidden: ['secret'],
    expected: result(error('confirm', 'equalTo', 'other'), error('reason', 'required', '')),
  },
  {
    name: 'visibility-toggle-step-1-shown-valid',
    note: 'Step 1 of 3: the flag is 1, the group is shown and its values are valid.',
    spec: toggleSpec,
    data: { is_display: '1', display: { code: 'ABC', title: 'Hello' } },
    hidden: [],
    expected: result(),
  },
  {
    name: 'visibility-toggle-step-2-hidden-invalid',
    note: 'Step 2 of 3: the flag is 0, the group is hidden, and a pattern-violating code and a missing required title report nothing.',
    spec: toggleSpec,
    data: { is_display: '0', display: invalidDisplay },
    hidden: ['display'],
    expected: result(),
  },
  {
    name: 'visibility-toggle-step-3-shown-invalid',
    note: 'Step 3 of 3: the flag is 1 again, and the values kept while the group was hidden are validated.',
    spec: toggleSpec,
    data: { is_display: '1', display: invalidDisplay },
    hidden: [],
    expected: result(error('display.code', 'pattern', 'abc1'), error('display.title', 'required', '')),
  },
  {
    name: 'multiple-only-rows-validated',
    note: 'multiple: only takes its rows from the data keys; each row is validated, and errors follow sorted key order.',
    spec: onlyRows('only'),
    data: { variants: { __opt_b2__: { name: '', price: 5 }, __opt_a1__: { name: 'Red', price: -1 } } },
    expected: result(
      error('variants.__opt_a1__.price', 'min', -1, 0),
      error('variants.__opt_b2__.name', 'required', ''),
    ),
  },
  {
    name: 'multiple-only-missing-data-valid',
    note: 'Missing data of a multiple: only collection has no row, so its row rules do not run.',
    spec: onlyRows('only'),
    data: {},
    expected: result(),
  },
  {
    name: 'multiple-only-missing-data-required',
    note: 'A required multiple.only collection without data fails required with the missing value.',
    spec: onlyRows({ only: true, title: 'name' }, { required: true }),
    data: {},
    expected: result(error('variants', 'required', null)),
  },
  {
    name: 'multiple-only-missing-data-mincount',
    note: 'Collection counts evaluate empty collections, and missing data is an empty value: a multiple: only collection without data fails mincount with the missing value.',
    spec: onlyRows('only', { mincount: 1 }),
    data: {},
    expected: result(error('variants', 'mincount', null, 1)),
  },
  {
    name: 'multiple-missing-data-required',
    note: 'Missing data of any repeated group is an empty collection: required fails with the missing value.',
    spec: onlyRows(true, { required: true }),
    data: {},
    expected: result(error('variants', 'required', null)),
  },
  {
    name: 'multiple-missing-data-mincount',
    note: 'Missing data of any repeated group is an empty collection: mincount counts 0.',
    spec: onlyRows(true, { mincount: 1 }),
    data: {},
    expected: result(error('variants', 'mincount', null, 1)),
  },
  {
    name: 'multiple-only-empty-required',
    note: 'A required multiple: only collection with {} has zero rows and fails required with the empty object.',
    spec: onlyRows('only', { required: true }),
    data: { variants: {} },
    expected: result(error('variants', 'required', {})),
  },
];
