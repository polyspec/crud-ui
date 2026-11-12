/**
 * Shared-fixture generator for the 4-language CRUDUI validator (SPEC §2 pipeline).
 *
 * Runs the JS reference CRUDUI validator for real and dumps, per case, the
 * validation result (`expected = { valid, errors, hidden }`) or the failure record
 * (`expectFailure = { code, message, at }`) when composition cannot be resolved
 * or submitted data has the wrong shape. The PHP, C extension, Go and Rust
 * engines load the SAME `cases.json` and must reproduce it exactly.
 *
 * Each case is authored against the analysis (single truth) and VALIDATION-
 * RULES.md (the 1074 idempotence baseline). The JS engine GENERATES the
 * expected output; the adjacent conformance test RE-VERIFIES the JS engine
 * still reproduces it (a guard against silent drift), and the sibling engines
 * prove cross-language equality.
 *
 * Fixture format (per the task contract):
 *   { name, spec, data, expected: { valid, errors, hidden } }             — validation result
 *   { name, spec, data, expectFailure: { code, message, at } }    — load or input failure
 *
 * `spec`   : a CRUDUI root spec. Inline `{ type:'group', properties:{…} }`, or a
 *            composition entry (`files` + `$ref`/`$patch`).
 * `files`  : optional virtual file set `$ref` resolves against (`{ key: doc }`).
 * `data`   : the form data validated against the (composed) spec.
 * `expected`: `{ valid, errors[], hidden[] }` — first-error-per-field, declaration order.
 * `expectFailure`: a ComposeLoadError (`at` = trace joined with `.`) or a
 *            FormInputError (`at` = "").
 *
 * Regenerate (from repo root):
 *   node legacy/tests/fixtures/validate/generate.mts > legacy/tests/fixtures/validate/cases.json
 */

import {
  validate,
  ComposeLoadError,
  FormInputError,
} from '@polyspec/crudui-validator';
import { AUTHORED_CASES, type AuthoredCase } from './value-rules.mts';
import { DEFAULT_MESSAGES, VISIBILITY_CASES, type FailingCase, type WrittenCase } from './visibility.mts';
import { NUMERIC_CASES } from './numeric-rules.mts';
import { GROUP_SOURCE_CASES, GROUP_SOURCE_REQUIREMENTS } from './group-source.mts';
import { COMBINED_ITEMS_CASES, COMBINED_ITEMS_REQUIREMENTS } from './combined-items.mts';
import { MULTIPLE_SHAPE_CASES, MULTIPLE_SHAPE_REQUIREMENTS } from './multiple-shape.mts';
import { KEYED_MAP_CASES, KEYED_MAP_REQUIREMENTS } from './keyed-maps.mts';
import { CONDITION_TREE_CASES, CONDITION_TREE_REQUIREMENTS } from './condition-tree.mts';
import { REFERENCE_CASES } from './reference-rules.mts';
import { CONTAINED_IN_CASES, CONTAINED_IN_REQUIREMENTS } from './contained-in.mts';
import { TYPE_FROM_CASES, TYPE_FROM_REQUIREMENTS } from './type-from.mts';
import { BOUNDS_FROM_CASES, BOUNDS_FROM_REQUIREMENTS } from './bounds-from.mts';
import { DATA_LIMITS_CASES, DATA_LIMITS_COMPACT, DATA_LIMITS_REQUIREMENTS } from './data-limits.mts';
import { CONDITION_FIELD_CASES, CONDITION_FIELD_REQUIREMENTS } from './condition-field.mts';
import { parseJson } from '../../../../tests/json.mts';

interface CaseSpec {
  /** Specification written as JSON text, so array-index member names keep the order they were written in the fixture file. */
  specText?: string;
  name: string;
  note: string;
  spec: Record<string, unknown>;
  files?: Record<string, Record<string, unknown>>;
  data: unknown;
}

// ---------------------------------------------------------------------------
// Cases — one per fixture_ideas entry in the analysis (single truth).
// ---------------------------------------------------------------------------

/** Properties written as b, 10, a; JSON text keeps that order in the fixture file. */
const PROPERTY_ORDER_SPEC = '{"type":"group","properties":{"b":{"type":"text","validate":{"required":true}},"10":{"type":"text","validate":{"required":true}},"a":{"type":"text","validate":{"required":true}}}}';

const SPECS: CaseSpec[] = [
  ...['2026-01-01', '2026-01-02', '2026-01-03'].map(end => ({
    name: `enddate-relative-path-${end}`,
    note: 'The enddate parameter remains a field path.',
    spec: { type: 'group', properties: {
      period: { type: 'group', properties: {
        start: { type: 'text' },
        end: { type: 'text', validate: { enddate: '.start' } },
      } },
    } },
    data: { period: { start: '2026-01-02', end } },
  })),
  {
    name: 'property-member-order',
    note: 'Errors follow specification member order: properties written as b, 10, a report 10, b, a. The fixture keeps the written order.',
    spec: parseJson<Record<string, unknown>>(PROPERTY_ORDER_SPEC, { values: {} }, 'PROPERTY_ORDER_SPEC'),
    specText: PROPERTY_ORDER_SPEC,
    data: {},
  },
  {
    name: 'composed-member-order',
    note: 'A property added by $patch to a base written as b, a joins in member order, so errors report 10, b, a.',
    spec: { type: 'group', properties: { $ref: 'base.json', $patch: { 10: { type: 'text', validate: { required: true } } } } },
    files: { 'base.json': { properties: {
      b: { type: 'text', validate: { required: true } },
      a: { type: 'text', validate: { required: true } },
    } } },
    data: {},
  },
  {
    name: 'enddate-parent-path',
    note: 'The enddate parameter remains a field path.',
    spec: { type: 'group', properties: {
      period: { type: 'group', properties: {
        end: { type: 'text', validate: { enddate: '..start' } },
      } },
      start: { type: 'text' },
    } },
    data: { period: { end: '2026-01-01' }, start: '2026-01-02' },
  },
  ...['2026-01-01', '2026-01-02', '2026-01-03'].map(end => ({
    name: `enddate-field-path-${end}`,
    note: 'The enddate parameter remains a field path.',
    spec: { type: 'group', properties: {
      period: { type: 'group', properties: {
        start: { type: 'text' },
        end: { type: 'text', validate: { enddate: 'period.start' } },
      } },
    } },
    data: { period: { start: '2026-01-02', end } },
  })),
  ...[false, true].flatMap(enabled => [5, 8].map(value => ({
    name: `ternary-field-limit-${enabled}-${value}`,
    note: 'The selected ternary branch resolves a field value as the validation limit.',
    spec: { type: 'group', properties: {
      enabled: { type: 'text' },
      limit: { type: 'text' },
      value: { type: 'text', validate: { min: '.enabled ? .limit : 0' } },
    } },
    data: { enabled, limit: 7, value: String(value) },
  }))),
  ...[false, true].map(selected => ({
    name: `ternary-nested-true-limit-${selected}`,
    note: 'The nested true branch resolves a field value through the expression AST.',
    spec: { type: 'group', properties: {
      enabled: { type: 'text' },
      selected: { type: 'text' },
      limit: { type: 'text' },
      value: { type: 'text', validate: { min: '.enabled ? .selected ? .limit : 0 : 0' } },
    } },
    data: { enabled: true, selected, limit: 7, value: '5' },
  })),

{
  "name": "items-langmap-4lang-membership-valid",
  "note": "G3 — in: value→label map with 4-language labels {ko,en,ja,zh}; value '1' is a key, valid (a 4-lang label is display-only, never a member)",
  "spec": {
    "type": "group",
    "properties": {
      "toggle": {
        "type": "select",
        "validate": {
          "in": {
            "0": {
              "ko": "미사용",
              "en": "Off",
              "ja": "オフ",
              "zh": "关闭"
            },
            "1": {
              "ko": "사용",
              "en": "On",
              "ja": "オン",
              "zh": "开启"
            }
          }
        }
      }
    }
  },
  "data": {
    "toggle": "1"
  }
},
{
  "name": "items-langmap-4lang-membership-invalid",
  "note": "G3 — in: 4-language value→label map; value 'オン' (a ja label, not a key) fails — the label is never a member in any of the 4 languages",
  "spec": {
    "type": "group",
    "properties": {
      "toggle": {
        "type": "select",
        "validate": {
          "in": {
            "0": {
              "ko": "미사용",
              "en": "Off",
              "ja": "オフ",
              "zh": "关闭"
            },
            "1": {
              "ko": "사용",
              "en": "On",
              "ja": "オン",
              "zh": "开启"
            }
          }
        }
      }
    }
  },
  "data": {
    "toggle": "オン"
  }
},
{
  "name": "items-4lang-null-label-slot-membership",
  "note": "G3 — in: 4-language map where key '2' has a partial-null label slot ({ko,en,ja:null,zh}) and key '4' has a fully null label; both keys stay valid members (a null label slot has no membership effect)",
  "spec": {
    "type": "group",
    "properties": {
      "opt": {
        "type": "select",
        "validate": {
          "in": {
            "1": {
              "ko": "하나",
              "en": "One",
              "ja": "一",
              "zh": "一"
            },
            "2": {
              "ko": "둘",
              "en": "Two",
              "ja": null,
              "zh": "二"
            },
            "3": {
              "ko": "셋",
              "en": "Three",
              "ja": "三",
              "zh": "三"
            },
            "4": null
          }
        }
      }
    }
  },
  "data": {
    "opt": "2"
  }
},
{
  "name": "items-4lang-fully-null-label-membership",
  "note": "G3 — the fully null label key '4' of the same 4-language map is still a valid member (null content == absent, no validate effect)",
  "spec": {
    "type": "group",
    "properties": {
      "opt": {
        "type": "select",
        "validate": {
          "in": {
            "1": {
              "ko": "하나",
              "en": "One",
              "ja": "一",
              "zh": "一"
            },
            "2": {
              "ko": "둘",
              "en": "Two",
              "ja": null,
              "zh": "二"
            },
            "3": {
              "ko": "셋",
              "en": "Three",
              "ja": "三",
              "zh": "三"
            },
            "4": null
          }
        }
      }
    }
  },
  "data": {
    "opt": "4"
  }
},
{
  "name": "null-content-4lang-no-validate-effect",
  "note": "G3 — label:null plus a 4-language content map with a null slot ({ko,en,ja:null,zh}) have no validate effect; required still fires on an empty value",
  "spec": {
    "type": "group",
    "properties": {
      "nickname": {
        "type": "text",
        "label": null,
        "description": {
          "ko": "별명",
          "en": "Nickname",
          "ja": null,
          "zh": "昵称"
        },
        "validate": {
          "required": true
        }
      }
    }
  },
  "data": {
    "nickname": ""
  }
},

  {
    name: 'keyed-scalar-email-errors',
    note: 'Repeated scalar errors preserve sorted row keys.',
    spec: { type: 'group', properties: { emails: { type: 'email', multiple: true, validate: { email: true } } } },
    data: { emails: { __0000000000002__: 'invalid-b', __0000000000001__: 'invalid-a' } },
  },
  {
    name: 'keyed-scalar-unique',
    note: 'Collection uniqueness checks keyed scalar values.',
    spec: { type: 'group', properties: { tags: { type: 'text', multiple: true, validate: { unique: true } } } },
    data: { tags: { __0000000000002__: 'same', __0000000000001__: 'same' } },
  },
  {
    name: 'keyed-scalar-mincount',
    note: 'Collection size uses keyed row count.',
    spec: { type: 'group', properties: { tags: { type: 'text', multiple: true, validate: { mincount: 2 } } } },
    data: { tags: { __0000000000001__: 'one' } },
  },
  {
    name: 'keyed-group-unique-filter',
    note: 'Unique filters evaluate the original key path for each row.',
    spec: { type: 'group', properties: { rows: {
      type: 'group', multiple: true, validate: { unique: '.enabled == 1' },
      properties: { name: { type: 'text' }, enabled: { type: 'number' } },
    } } },
    data: { rows: { second: { name: 'same', enabled: 1 }, first: { name: 'same', enabled: 1 }, ignored: { name: 'same', enabled: 0 } } },
  },
  {
    name: 'nested-company-store-key-errors',
    note: 'Company and store can share a key; errors retain the complete nested path.',
    spec: { type: 'group', properties: { companies: { type: 'group', multiple: true, properties: {
      stores: { type: 'group', multiple: true, properties: { name: { type: 'text', validate: { required: true } } } },
    } } } },
    data: { companies: { __0000000000001__: { stores: { __0000000000001__: { name: '' }, __0000000000002__: { name: 'ok' } } } } },
  },
  // 1. Conditional required — true branch (subscribe truthy → required fires).
  {
    name: 'conditional-required-true',
    note: "required:'.subscribe' fires when subscribe is truthy and value empty",
    spec: {
      type: 'group',
      properties: {
        subscribe: { type: 'checkbox' },
        email: { type: 'email', validate: { required: '.subscribe' } },
      },
    },
    data: { subscribe: true, email: '' },
  },
  // 2. Conditional required — false branch (condition falsy → rule disabled).
  {
    name: 'conditional-required-false',
    note: "required:'.subscribe' is disabled when subscribe is falsy",
    spec: {
      type: 'group',
      properties: {
        subscribe: { type: 'checkbox' },
        email: { type: 'email', validate: { required: '.subscribe' } },
      },
    },
    data: { subscribe: false, email: '' },
  },
  // 3. Condition map rule value — VIP branch (min:10) fails.
  {
    name: 'condition-map-min-vip',
    note: "min:{'.vip':10, true:1} → first-truthy key picks 10 for a VIP",
    spec: {
      type: 'group',
      properties: {
        vip: { type: 'checkbox' },
        qty: { type: 'number', validate: { min: { '.vip': 10, true: 1 } } },
      },
    },
    data: { vip: true, qty: 5 },
  },
  // 4. Condition map rule value — default branch (min:1) passes.
  {
    name: 'condition-map-min-default',
    note: "min:{'.vip':10, true:1} → default key picks 1 for a non-VIP",
    spec: {
      type: 'group',
      properties: {
        vip: { type: 'checkbox' },
        qty: { type: 'number', validate: { min: { '.vip': 10, true: 1 } } },
      },
    },
    data: { vip: false, qty: 5 },
  },
  // 5. Ternary value-return — premium branch (min:10) fails.
  {
    name: 'ternary-min-premium',
    note: "min:'.is_premium == 1 ? 10 : 1' evaluates the branch to 10",
    spec: {
      type: 'group',
      properties: {
        is_premium: { type: 'number' },
        quantity: {
          type: 'number',
          validate: { min: '.is_premium == 1 ? 10 : 1' },
        },
      },
    },
    data: { is_premium: 1, quantity: 5 },
  },
  // 6. Ternary value-return — non-premium branch (min:1) passes.
  {
    name: 'ternary-min-nonpremium',
    note: "min ternary evaluates to 1 when is_premium != 1",
    spec: {
      type: 'group',
      properties: {
        is_premium: { type: 'number' },
        quantity: {
          type: 'number',
          validate: { min: '.is_premium == 1 ? 10 : 1' },
        },
      },
    },
    data: { is_premium: 0, quantity: 5 },
  },
  // 7. Composed spec — $ref base + $patch adds an email rule; data fails it.
  {
    name: 'compose-ref-patch-email',
    note: '$ref base (required) + $patch adds email rule; "bad" fails email',
    files: {
      'Base.yml': {
        properties: {
          email: { type: 'email', validate: { required: true } },
        },
      },
    },
    spec: { $ref: 'Base.yml', $patch: { 'email.validate.email': true } },
    data: { email: 'bad' },
  },
  // 8. Unresolved $ref — compose LOAD ERROR (never valid:true).
  {
    name: 'compose-unresolved-ref-load-error',
    note: 'missing $ref file is a ComposeLoadError, not valid:true (873 lock)',
    spec: { $ref: 'Missing.yml' },
    data: {},
  },
  // 9. Nested group — empty zip → required (first), then digits on the next data.
  {
    name: 'nested-group-required',
    note: 'addr.zip required fires for empty nested value',
    spec: {
      type: 'group',
      properties: {
        addr: {
          type: 'group',
          properties: {
            zip: { type: 'text', validate: { required: true, digits: true } },
          },
        },
      },
    },
    data: { addr: { zip: '' } },
  },
  // 10. Nested group — non-empty non-digit zip → digits fires (required passes).
  {
    name: 'nested-group-digits',
    note: 'addr.zip passes required, then digits fires for "abc"',
    spec: {
      type: 'group',
      properties: {
        addr: {
          type: 'group',
          properties: {
            zip: { type: 'text', validate: { required: true, digits: true } },
          },
        },
      },
    },
    data: { addr: { zip: 'abc' } },
  },
  // 11. Repeated scalar — collection-level unique fires for a duplicate.
  {
    name: 'multiple-collection-level-unique',
    note: 'two equal keyed tags meet mincount:2, then collection-level unique fires',
    spec: {
      type: 'group',
      properties: {
        tags: {
          type: 'text',
          multiple: true,
          validate: { mincount: 2, unique: true },
        },
      },
    },
    data: { tags: { tag_a: 'a', tag_b: 'a' } },
  },
  // 12. Repeated scalar — mincount fires for too few rows.
  {
    name: 'multiple-collection-level-mincount',
    note: 'tags has one keyed row → mincount:2 fires',
    spec: {
      type: 'group',
      properties: {
        tags: {
          type: 'text',
          multiple: true,
          validate: { mincount: 2, unique: true },
        },
      },
    },
    data: { tags: { tag_a: 'a' } },
  },
  // 13. Repeated group — row key path items.__b__.code on the second row.
  {
    name: 'multiple-group-row-key-path',
    note: 'second row empty code → error path items.__b__.code',
    spec: {
      type: 'group',
      properties: {
        items: {
          type: 'group',
          multiple: true,
          properties: { code: { type: 'text', validate: { required: true } } },
        },
      },
    },
    data: { items: { __a__: { code: 'x' }, __b__: { code: '' } } },
  },
  // 14. Object-key multiple — sorted-key traversal, path rows.__a__.v first.
  {
    name: 'object-key-multiple-sorted-path',
    note: 'object keys sorted → first error rows.__a__.v before rows.__b__.v',
    spec: {
      type: 'group',
      properties: {
        rows: {
          type: 'group',
          multiple: true,
          properties: { v: { type: 'text', validate: { required: true } } },
        },
      },
    },
    data: { rows: { __b__: { v: '' }, __a__: { v: '' } } },
  },
  // 15. type:number implicit check — "Infinity" → rule:number before min.
  {
    name: 'type-number-implicit',
    note: 'type:number runs implicit number first → "Infinity" is rule:number',
    spec: {
      type: 'group',
      properties: { age: { type: 'number', validate: { min: 0 } } },
    },
    data: { age: 'Infinity' },
  },
  // 16. unique filter (condition param) — only active==1 items checked; a
  //     duplicate among inactive items passes.
  {
    name: 'unique-filter-condition-pass',
    note: "unique:'.active == 1' filters; duplicate among inactive items passes",
    spec: {
      type: 'group',
      properties: {
        rows: {
          type: 'group',
          multiple: true,
          properties: {
            active: { type: 'number' },
            code: { type: 'text', validate: { unique: '.active == 1' } },
          },
        },
      },
    },
    data: {
      rows: {
        __a__: { active: 0, code: 'dup' },
        __b__: { active: 0, code: 'dup' },
      },
    },
  },
  // 17. unique filter — duplicate among active==1 items fires (item-level).
  {
    name: 'unique-filter-condition-fail',
    note: "unique:'.active == 1' fires for a duplicate among active items",
    spec: {
      type: 'group',
      properties: {
        rows: {
          type: 'group',
          multiple: true,
          properties: {
            active: { type: 'number' },
            code: { type: 'text', validate: { unique: '.active == 1' } },
          },
        },
      },
    },
    data: {
      rows: {
        __a__: { active: 1, code: 'dup' },
        __b__: { active: 1, code: 'dup' },
      },
    },
  },
  // 18. Verbatim regex param — match is not evaluated as a condition.
  {
    name: 'match-regex-verbatim',
    note: 'match regex preserved verbatim; "ftp://x" fails ^https?://.+',
    spec: {
      type: 'group',
      properties: {
        url: { type: 'text', validate: { match: '^https?://.+' } },
      },
    },
    data: { url: 'ftp://x' },
  },
  // 19. Verbatim literal param — accept ".jpg" not misread as a field ref.
  {
    name: 'accept-literal-verbatim',
    note: 'accept ".jpg,.png" literal param; a .gif file fails',
    spec: {
      type: 'group',
      properties: {
        photo: { type: 'file', validate: { accept: '.jpg,.png' } },
      },
    },
    data: { photo: 'snapshot.gif' },
  },
  // 21. First-error-per-field — required fires; email never evaluated.
  {
    name: 'first-error-per-field',
    note: 'required+email; empty value → only required (email not reached)',
    spec: {
      type: 'group',
      properties: {
        email: { type: 'email', validate: { required: true, email: true } },
      },
    },
    data: { email: '' },
  },
  // 22. Empty value skips email (no required) → valid:true.
  {
    name: 'empty-skips-email',
    note: 'email rule only (no required); empty value passes (blank skip)',
    spec: {
      type: 'group',
      properties: { email: { type: 'email', validate: { email: true } } },
    },
    data: { email: '' },
  },
  // 23. Message override — custom required message wins.
  {
    name: 'message-override-required',
    note: 'field messages.required overrides the default message',
    spec: {
      type: 'group',
      properties: {
        name: {
          type: 'text',
          validate: { required: true },
          messages: { required: 'Name please' },
        },
      },
    },
    data: { name: '' },
  },
  // 25. Slot off (validate:false) — no rules run.
  {
    name: 'validate-slot-off',
    note: 'validate:false turns the slot off; empty value still valid',
    spec: {
      type: 'group',
      properties: { x: { type: 'text', validate: false } },
    },
    data: { x: '' },
  },
  // 26. equalTo path reference — mismatch fires (verbatim field ref param).
  {
    name: 'equalto-mismatch',
    note: "equalTo:'.password' compares to sibling; mismatch fires",
    spec: {
      type: 'group',
      properties: {
        password: { type: 'text' },
        confirm: { type: 'text', validate: { equalTo: '.password' } },
      },
    },
    data: { password: 'secret', confirm: 'other' },
  },
  // 27. equalTo path reference — match passes.
  {
    name: 'equalto-match',
    note: "equalTo:'.password' passes when the values match",
    spec: {
      type: 'group',
      properties: {
        password: { type: 'text' },
        confirm: { type: 'text', validate: { equalTo: '.password' } },
      },
    },
    data: { password: 'secret', confirm: 'secret' },
  },
  // 28. Conditional `in` membership — required-style gating via in expression.
  {
    name: 'conditional-required-in-list',
    note: "required:'.is_display in 2,3' fires only for matching is_display",
    spec: {
      type: 'group',
      properties: {
        is_display: { type: 'number' },
        memo: { type: 'text', validate: { required: '.is_display in 2,3' } },
      },
    },
    data: { is_display: 2, memo: '' },
  },
  // 29. G3 static value→label map (LangMap labels) — membership uses the KEYS;
  // a value equal to a key passes (the multilingual label is display-only).
  {
    name: 'items-langmap-in-membership-valid',
    note: "in: value→label map with {ko,en} labels — value '1' is a key, valid (label not a member)",
    spec: {
      type: 'group',
      properties: {
        toggle: {
          type: 'select',
          validate: {
            in: {
              '0': { ko: '미사용', en: 'Off' },
              '1': { ko: '사용', en: 'On' },
            },
          },
        },
      },
    },
    data: { toggle: '1' },
  },
  // 30. G3 static value→label map (LangMap labels) — a value that is NOT a key
  // fails `in`; the multilingual label text is never an allowed value.
  {
    name: 'items-langmap-in-membership-invalid',
    note: "in: value→label map with {ko,en} labels — value '미사용' (a label, not a key) fails",
    spec: {
      type: 'group',
      properties: {
        toggle: {
          type: 'select',
          validate: {
            in: {
              '0': { ko: '미사용', en: 'Off' },
              '1': { ko: '사용', en: 'On' },
            },
          },
        },
      },
    },
    data: { toggle: '미사용' },
  },
  // 31. G3 static value→label map (string labels) — membership still uses KEYS;
  // value '2' is a key (its display label is plain string, not a member).
  {
    name: 'items-string-label-in-membership-valid',
    note: "in: value→label map with string labels — value '2' is a key, valid",
    spec: {
      type: 'group',
      properties: {
        grade: {
          type: 'select',
          validate: {
            in: { '1': 'Bronze', '2': 'Silver', '3': 'Gold' },
          },
        },
      },
    },
    data: { grade: '2' },
  },
  // 32. G3 static value→label map with a NULL label slot — the empty label has
  // no membership effect; its key '2' is still a valid member.
  {
    name: 'items-langmap-null-label-membership',
    note: "in: value→label map where key '2' has a null label — '2' is still a valid member (null label no effect)",
    spec: {
      type: 'group',
      properties: {
        opt: {
          type: 'select',
          validate: {
            in: {
              '1': { ko: '하나', en: 'One' },
              '2': null,
              '3': { ko: '셋', en: 'Three' },
            },
          },
        },
      },
    },
    data: { opt: '2' },
  },
  // 33. G3 null content — a field whose label is null (and a null LangMap slot
  // on another field) validates exactly as if the content were absent.
  {
    name: 'null-content-no-validate-effect',
    note: 'label:null and a null LangMap slot have no effect — required still fires on empty value',
    spec: {
      type: 'group',
      properties: {
        nickname: {
          type: 'text',
          label: null,
          description: { ko: '별명', en: null },
          validate: { required: true },
        },
      },
    },
    data: { nickname: '' },
  },
  // 34. Input shape — root data that is not an object is an input failure.
  {
    name: 'input-root-data-not-object',
    note: 'root data is a non-empty array → INVALID_FORM_INPUT, no validation result',
    spec: {
      type: 'group',
      properties: { name: { type: 'text', validate: { required: true } } },
    },
    data: ['a'],
  },
  // 35. Input shape — present group data must be an object.
  {
    name: 'input-group-data-not-object',
    note: 'group data is a string → INVALID_FORM_INPUT at the group path',
    spec: {
      type: 'group',
      properties: {
        addr: { type: 'group', properties: { city: { type: 'text' } } },
      },
    },
    data: { addr: 'Seoul' },
  },
  // 36. Input shape — repeated group data must be a keyed object.
  {
    name: 'input-repeated-group-array',
    note: 'repeated group data is an array → INVALID_FORM_INPUT at the collection path',
    spec: {
      type: 'group',
      properties: {
        items: { type: 'group', multiple: true, properties: { code: { type: 'text' } } },
      },
    },
    data: { items: [{ code: 'x' }] },
  },
  // 37. Input shape — present repeated scalar data must be a keyed object.
  {
    name: 'input-repeated-scalar-null',
    note: 'repeated scalar data is null → INVALID_FORM_INPUT at the collection path',
    spec: {
      type: 'group',
      properties: { tags: { type: 'text', multiple: true } },
    },
    data: { tags: null },
  },
  // 38. Input shape — each repeated group row must be an object.
  {
    name: 'input-repeated-group-row-not-object',
    note: 'a repeated group row is a string → INVALID_FORM_INPUT at the row path',
    spec: {
      type: 'group',
      properties: {
        items: { type: 'group', multiple: true, properties: { code: { type: 'text' } } },
      },
    },
    data: { items: { __a__: 'x' } },
  },
  // 39. Input shape — nested collections report their full path.
  {
    name: 'input-nested-repeated-array',
    note: 'a nested repeated collection is an array → INVALID_FORM_INPUT at its full path',
    spec: {
      type: 'group',
      properties: {
        companies: {
          type: 'group',
          multiple: true,
          properties: {
            stores: { type: 'group', multiple: true, properties: { name: { type: 'text' } } },
          },
        },
      },
    },
    data: { companies: { __a__: { stores: [] } } },
  },
  {
    name: 'input-unknown-root-field',
    note: 'The first undeclared root member in code point order is an input failure.',
    spec: { type: 'group', properties: { name: { type: 'text' } } },
    data: { name: 'N', z: 1, a: 2 },
  },
  {
    name: 'input-unknown-group-field',
    note: 'An undeclared member inside a group is an input failure.',
    spec: { type: 'group', properties: {
      address: { type: 'group', properties: { city: { type: 'text' } } },
    } },
    data: { address: { city: 'Seoul', extra: 1 } },
  },
  {
    name: 'input-unknown-hidden-group-field',
    note: 'A hidden group still rejects an undeclared member in its data.',
    spec: { type: 'group', properties: {
      address: { type: 'group', design: { show: false }, properties: { city: { type: 'text' } } },
    } },
    data: { address: { city: 'Seoul', extra: 1 } },
  },
  {
    name: 'input-unknown-repeated-row-field',
    note: 'An undeclared member inside a repeated group row is an input failure.',
    spec: { type: 'group', properties: {
      rows: { type: 'group', multiple: true, properties: { code: { type: 'text' } } },
    } },
    data: { rows: { row1: { code: 'C', extra: 1 } } },
  },  {
    name: 'date-rule-rejects-text-that-is-no-date',
    note: 'The date rule enables the date format check: text that is no date is rejected (CUVR-012).',
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: 'not a date' },
  },
  {
    name: 'dateiso-rule-accepts-iso-date',
    note: 'The dateISO rule enables the ISO date format check: 2026-02-28 is an ISO date (CUVR-012).',
    spec: { type: 'group', properties: { day: { type: 'text', validate: { dateISO: true } } } },
    data: { day: '2026-02-28' },
  },
  {
    name: 'dateiso-rule-rejects-other-format',
    note: 'The dateISO rule rejects a day-first date (CUVR-012).',
    spec: { type: 'group', properties: { day: { type: 'text', validate: { dateISO: true } } } },
    data: { day: '28/02/2026' },
  },

  {
    name: 'date-rule-rejects-jan-2-2026',
    note: "The date layouts of CUVR-058 do not include month names: \"Jan 2, 2026\" is no date, although the JavaScript Date parser reads it.",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "Jan 2, 2026" },
  },
  {
    name: 'date-rule-rejects-weekday-month-day-year',
    note: "\"Tue Mar 01 2026\" is no date under CUVR-058, though the JavaScript Date parser reads it.",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "Tue Mar 01 2026" },
  },
  {
    name: 'date-layout-year-first-dashes-accepted',
    note: "YYYY-MM-DD names a calendar day (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "2026-02-28" },
  },
  {
    name: 'date-layout-year-first-slashes-accepted',
    note: "YYYY/MM/DD names a calendar day (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "2026/02/28" },
  },
  {
    name: 'date-layout-month-first-slashes-accepted',
    note: "MM/DD/YYYY names a calendar day when the month-first reading does (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "02/28/2026" },
  },
  {
    name: 'date-layout-day-first-slashes-accepted',
    note: "DD/MM/YYYY names a calendar day when the day-first reading does (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "28/02/2026" },
  },
  {
    name: 'date-layout-slashes-either-reading',
    note: "A slash date whose month-first and day-first readings both name a calendar day is a date (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "02/03/2026" },
  },
  {
    name: 'date-layout-rfc3339-utc-accepted',
    note: "An RFC 3339 date-time with Z is a date (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "2026-02-28T10:30:00Z" },
  },
  {
    name: 'date-layout-rfc3339-offset-accepted',
    note: "An RFC 3339 date-time with a +HH:MM offset is a date (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "2026-02-28T10:30:00+01:00" },
  },
  {
    name: 'date-layout-rfc3339-without-offset-rejected',
    note: "A date-time without an offset is no date (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "2026-02-28T10:30:00" },
  },
  {
    name: 'date-layout-rfc3339-offset-hour-rejected',
    note: "An offset hour above 23 is no date (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "2026-02-28T10:30:00+24:00" },
  },
  {
    name: 'date-rule-rejects-number',
    note: "A number is no date, although a Unix timestamp reads as one in JavaScript (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: 1700000000000 },
  },
  {
    name: 'date-layout-rejects-impossible-day',
    note: "2026-02-30 names no calendar day (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "2026-02-30" },
  },
  {
    name: 'date-layout-rejects-leap-day-of-common-year',
    note: "2026-02-29 names no calendar day in a common year (CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "2026-02-29" },
  },
  {
    name: 'date-layout-trims-surrounding-whitespace',
    note: "The date rule trims the text before it reads the layout (CUVR-019, CUVR-058).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { date: true } } } },
    data: { day: "  2026-02-28  " },
  },
  {
    name: 'dateiso-layout-rejects-slash-form',
    note: "dateISO accepts only YYYY-MM-DD (CUVR-059): a slash date is not an ISO date.",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { dateISO: true } } } },
    data: { day: "02/28/2026" },
  },
  {
    name: 'dateiso-layout-rejects-number',
    note: "dateISO rejects a number (CUVR-059).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { dateISO: true } } } },
    data: { day: 1700000000000 },
  },
  {
    name: 'dateiso-layout-accepts-trimmed-text',
    note: "dateISO trims the text before it reads YYYY-MM-DD (CUVR-019, CUVR-059).",
    spec: { type: 'group', properties: { day: { type: 'text', validate: { dateISO: true } } } },
    data: { day: "  2026-02-28 " },
  },
];

// ---------------------------------------------------------------------------
// Run the JS reference engine and emit the fixture.
// ---------------------------------------------------------------------------

function build(c: CaseSpec): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: c.name,
    note: c.note,
    // Written as a placeholder and replaced by the authored text after serialization.
    spec: c.specText === undefined ? c.spec : `__SPEC_TEXT_${c.name}__`,
  };
  if (c.files) {
    base.files = c.files;
  }
  base.data = c.data;

  try {
    const result = validate(c.spec, c.data, c.files ? { files: c.files } : {});
    base.expected = result;
  } catch (e) {
    if (e instanceof ComposeLoadError) {
      base.expectFailure = { code: e.code, message: e.message, at: e.trace.join('.') };
    } else if (e instanceof FormInputError) {
      base.expectFailure = { code: e.code, message: e.message, at: '' };
    } else {
      throw e;
    }
  }
  return base;
}

/**
 * The hidden paths of a written case: the stated list, or none for a specification without
 * design.show. A case that declares design.show states its list, so the list comes from the
 * specification, not from a runtime.
 */
function hiddenOf(name: string, spec: unknown, hidden: string[] | undefined): string[] {
  if (hidden !== undefined) return hidden;
  if (JSON.stringify(spec).includes('"show"')) throw new Error(`${name} declares design.show and must state its hidden paths`);
  return [];
}

/**
 * A case whose outcome the specification states: the result record is written from the stated
 * outcomes with each rule's default message, never from a runtime's answer.
 */
function authored(c: AuthoredCase): Record<string, unknown> {
  const base: Record<string, unknown> = { name: c.name, note: c.note, spec: c.spec, data: c.data };
  if (c.failure) {
    base.expectFailure = c.failure;
    return base;
  }
  if (c.expected) {
    base.expected = { ...c.expected, hidden: hiddenOf(c.name, c.spec, c.hidden) };
    return base;
  }
  const errors = [];
  for (const [field, outcome] of Object.entries(c.outcomes ?? {})) {
    if (outcome === null) continue;
    const template = DEFAULT_MESSAGES[outcome.rule];
    if (template === undefined) throw new Error(`No default message for ${outcome.rule}`);
    const message = (outcome.params ?? []).reduce<string>((text, param, index) => text.replace(`{${index}}`, String(param)), template);
    errors.push({ path: field, field, rule: outcome.rule, message, value: c.data[field] ?? null });
  }
  base.expected = { valid: errors.length === 0, errors, hidden: hiddenOf(c.name, c.spec, c.hidden) };
  return base;
}

/** A case whose complete result record is written from the specification. */
function written(c: WrittenCase | FailingCase): Record<string, unknown> {
  const { name, note, spec, data } = c;
  return 'expectFailure' in c
    ? { name, note, spec, data, expectFailure: c.expectFailure }
    : { name, note, spec, data, expected: { ...c.expected, hidden: hiddenOf(name, spec, c.hidden) } };
}

/**
 * The requirements of docs/spec/empty-collections.md and docs/spec/validation-rules.md that these cases test: a case is named
 * here with the ids it tests, and each named case must be generated, so a renamed case cannot lose its ids silently.
 */
const REQUIREMENTS: Record<string, string[]> = {
  ...GROUP_SOURCE_REQUIREMENTS,
  ...COMBINED_ITEMS_REQUIREMENTS,
  ...MULTIPLE_SHAPE_REQUIREMENTS,
  ...KEYED_MAP_REQUIREMENTS,
  ...CONTAINED_IN_REQUIREMENTS,
  ...TYPE_FROM_REQUIREMENTS,
  ...BOUNDS_FROM_REQUIREMENTS,
  ...DATA_LIMITS_REQUIREMENTS,
  'enddate-relative-path-2026-01-01': ['CUVR-013'],
  'property-member-order': ['CUVR-001', 'CURP-001'],
  'composed-member-order': ['CUVR-001'],
  'enddate-parent-path': ['CUVR-013'],
  'enddate-field-path-2026-01-01': ['CUVR-013'],
  'ternary-field-limit-true-5': ['CUVR-006'],
  'ternary-nested-true-limit-true': ['CUVR-006'],
  'items-langmap-4lang-membership-invalid': ['CUVR-011'],
  'null-content-4lang-no-validate-effect': ['CUVR-001'],
  'keyed-scalar-email-errors': ['CUVR-002'],
  'keyed-scalar-unique': ['CUVR-015'],
  'keyed-scalar-mincount': ['CUVR-014'],
  'nested-company-store-key-errors': ['CUVR-001'],
  'conditional-required-true': ['CUVR-001'],
  'condition-map-min-vip': ['CUVR-006'],
  'ternary-min-premium': ['CUVR-006'],
  'compose-ref-patch-email': ['CUVR-002'],
  'nested-group-required': ['CUVR-001'],
  'nested-group-digits': ['CUVR-005', 'CUVR-026'],
  'multiple-collection-level-unique': ['CUVR-015'],
  'multiple-collection-level-mincount': ['CUVR-014'],
  'multiple-group-row-key-path': ['CUVR-001'],
  'object-key-multiple-sorted-path': ['CUVR-001'],
  'type-number-implicit': ['CUVR-005'],
  'unique-filter-condition-fail': ['CUVR-015'],
  'match-regex-verbatim': ['CUVR-009'],
  'accept-literal-verbatim': ['CUVR-016'],
  'first-error-per-field': ['CUVR-001'],
  'empty-skips-email': ['CUVR-020'],
  'message-override-required': ['CUSC-003', 'CUSC-052', 'CUVR-001'],
  'equalto-mismatch': ['CUVR-010'],
  'conditional-required-in-list': ['CUVR-001'],
  'items-langmap-in-membership-invalid': ['CUVR-011'],
  'null-content-no-validate-effect': ['CUVR-001'],
  'input-repeated-group-array': ['CUEC-003'],
  'input-repeated-scalar-null': ['CUEC-003'],
  'input-nested-repeated-array': ['CUEC-003'],
  'value-required-whitespace': ['CUVR-001', 'CUVR-019'],
  'value-required-not-whitespace': ['CUVR-019'],
  'value-empty-skips-other-rules': ['CUVR-003', 'CUVR-020'],
  'value-length-canonical-text': ['CUVR-021', 'CUVR-022'],
  'value-length-limits': ['CUVR-003', 'CUVR-004'],
  'value-length-fraction-limit': ['CUVR-042'],
  'value-length-negative-limit': ['CUVR-042'],
  'value-length-unsafe-limit': ['CUVR-042'],
  'value-length-condition-map-limit': ['CUVR-042'],
  'value-length-ternary-limit': ['CUVR-042'],
  'value-length-data-limit-selected': ['CUVR-042'],
  'value-length-data-limit-unselected': ['CUVR-003'],
  'value-length-data-limit-valid': ['CUVR-003'],
  'value-length-condition-true': ['CUVR-042'],
  'value-length-invalid-expression': ['CUVR-042'],
  'value-length-reversed-range': ['CUVR-043'],
  'value-length-fraction-range': ['CUVR-043'],
  'value-in-comma-string': ['CUVR-011', 'CUVR-029'],
  'value-in-list': ['CUVR-011', 'CUVR-029'],
  'value-in-map': ['CUVR-011', 'CUVR-029'],
  'value-in-array-elements': ['CUVR-011', 'CUVR-029'],
  'value-in-member-order': ['CUVR-029', 'CUVR-051'],
  'value-in-member-emptiness-first': ['CUVR-052'],
  'value-in-empty-list': ['CUVR-011', 'CUVR-020'],
  'value-in-empty-map': ['CUVR-011', 'CUVR-020'],
  'value-in-empty-list-required': ['CUVR-001', 'CUVR-011', 'CUVR-020'],
  'select-placeholder-empty-value': ['CUVR-001', 'CUVR-020', 'CUVR-080'],
  'value-in-choice-list': ['CUVR-011'],
  'value-in-choice-list-items': ['CUVR-011'],
  'value-in-choice-groups': ['CUVR-011'],
  'value-in-choice-groups-only': ['CUVR-011'],
  'value-in-choice-groups-empty': ['CUVR-050'],
  'value-in-choice-groups-choices-text': ['CUVR-050'],
  'value-in-choice-groups-nested': ['CUVR-050'],
  'value-in-choice-groups-extra-member': ['CUVR-050'],
  'value-in-choice-groups-without-label': ['CUVR-050'],
  'value-in-choice-groups-duplicate': ['CUVR-050'],
  'value-in-choice-list-extra-member': ['CUVR-050'],
  'value-in-choice-list-missing-label': ['CUVR-050'],
  'value-in-choice-list-mixed': ['CUVR-050'],
  'value-in-choice-list-boolean': ['CUVR-050'],
  'value-in-choice-list-duplicate': ['CUVR-050'],
  'value-in-choice-list-shape-first': ['CUVR-050'],
  'value-in-choice-list-empty-value': ['CUVR-052'],
  'value-in-blank-string': ['CUVR-052'],
  'value-in-empty-item': ['CUVR-052'],
  'value-in-blank-element': ['CUVR-052'],
  'value-in-nested-list': ['CUVR-051'],
  'value-in-null-member': ['CUVR-051'],
  'value-in-number-parameter': ['CUVR-049'],
  'value-in-true-parameter': ['CUVR-049'],
  'pattern-whole-alternation': ['CUVR-009', 'CUVR-038'],
  'pattern-whole-trailing-newline': ['CUVR-009'],
  'pattern-anchors': ['CUVR-009', 'CUVR-039'],
  'pattern-shorthand-ascii': ['CUVR-009', 'CUVR-032'],
  'pattern-shorthand-space': ['CUVR-009', 'CUVR-032'],
  'pattern-complements': ['CUVR-009', 'CUVR-032'],
  'pattern-any-character': ['CUVR-009', 'CUVR-033'],
  'pattern-escapes': ['CUVR-009', 'CUVR-031'],
  'pattern-classes': ['CUVR-009', 'CUVR-034'],
  'pattern-properties': ['CUVR-009', 'CUVR-018', 'CUVR-035'],
  'pattern-groups-quantifiers': ['CUVR-009', 'CUVR-036', 'CUVR-037'],
  'pattern-class-members': ['CUVR-009', 'CUVR-034'],
  'pattern-script-complement': ['CUVR-009', 'CUVR-018', 'CUVR-035'],
  'pattern-empty-alternatives': ['CUVR-009', 'CUVR-038'],
  'pattern-anchors-only': ['CUVR-009', 'CUVR-020', 'CUVR-039'],
  'pattern-array-value': ['CUVR-009'],
  'pattern-size-limit': ['CUVR-009', 'CUVR-040'],
  'pattern-depth-limit': ['CUVR-009', 'CUVR-036'],
  'pattern-linear-alternation': ['CUVR-009', 'CUVR-038'],
  'pattern-linear-repetition': ['CUVR-009'],
  'pattern-large-property-repetition': ['CUVR-009'],
  'pattern-unicode-data': ['CUVR-009', 'CUVR-018'],
  'pattern-class-literals': ['CUVR-009', 'CUVR-034'],
  'pattern-leading-zero-bounds': ['CUVR-009', 'CUVR-037'],
  'pattern-single-anchor': ['CUVR-009', 'CUVR-039'],
  'pattern-integer-canonical-text': ['CUVR-021'],
  'pattern-delimiters-are-text': ['CUVR-009', 'CUVR-030'],
  'pattern-canonical-text': ['CUVR-021'],
  'pattern-match-name': ['CUVR-009'],
  'pattern-invalid-empty': ['CUVR-057'],
  'pattern-invalid-open-group': ['CUVR-036', 'CUVR-057'],
  'pattern-invalid-open-class': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-close-group': ['CUVR-036', 'CUVR-057'],
  'pattern-invalid-close-class': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-brace': ['CUVR-057'],
  'pattern-invalid-bare-brace': ['CUVR-037', 'CUVR-057'],
  'pattern-invalid-leading-quantifier': ['CUVR-037', 'CUVR-057'],
  'pattern-invalid-stacked-quantifier': ['CUVR-037', 'CUVR-057'],
  'pattern-invalid-possessive': ['CUVR-037', 'CUVR-057'],
  'pattern-invalid-reversed-bounds': ['CUVR-037', 'CUVR-057'],
  'pattern-invalid-large-bound': ['CUVR-037', 'CUVR-057'],
  'pattern-invalid-open-bound': ['CUVR-037', 'CUVR-057'],
  'pattern-invalid-inner-anchor': ['CUVR-039', 'CUVR-057'],
  'pattern-invalid-leading-end': ['CUVR-039', 'CUVR-057'],
  'pattern-invalid-unknown-escape': ['CUVR-031', 'CUVR-057'],
  'pattern-invalid-word-boundary': ['CUVR-031', 'CUVR-057'],
  'pattern-invalid-backreference': ['CUVR-031', 'CUVR-057'],
  'pattern-invalid-short-unicode': ['CUVR-031', 'CUVR-057'],
  'pattern-invalid-surrogate': ['CUVR-031', 'CUVR-057'],
  'pattern-invalid-large-code-point': ['CUVR-031', 'CUVR-057'],
  'pattern-invalid-hex': ['CUVR-031', 'CUVR-057'],
  'pattern-invalid-inline-flag': ['CUVR-036', 'CUVR-057'],
  'pattern-invalid-lookahead': ['CUVR-036', 'CUVR-057'],
  'pattern-invalid-lookbehind': ['CUVR-036', 'CUVR-057'],
  'pattern-invalid-group-name': ['CUVR-036', 'CUVR-057'],
  'pattern-invalid-duplicate-name': ['CUVR-036', 'CUVR-057'],
  'pattern-invalid-empty-class': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-class-bracket': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-posix-class': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-reversed-range': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-shorthand-range': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-class-complement': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-nested-size': ['CUVR-040', 'CUVR-057'],
  'pattern-invalid-unknown-script': ['CUVR-035', 'CUVR-057'],
  'pattern-invalid-property': ['CUVR-057'],
  'pattern-invalid-short-property': ['CUVR-035', 'CUVR-057'],
  'pattern-invalid-class-dash': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-set-range-end': ['CUVR-057'],
  'pattern-invalid-outer-size': ['CUVR-040', 'CUVR-057'],
  'pattern-invalid-size': ['CUVR-040', 'CUVR-057'],
  'pattern-invalid-plus-size': ['CUVR-040', 'CUVR-057'],
  'pattern-invalid-size-after-syntax': ['CUVR-040', 'CUVR-057'],
  'pattern-invalid-depth': ['CUVR-036', 'CUVR-057'],
  'pattern-invalid-class-shorthand-end': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-class-escape': ['CUVR-034', 'CUVR-057'],
  'pattern-invalid-class-property': ['CUVR-034', 'CUVR-035', 'CUVR-057'],
  'pattern-invalid-unclosed-name': ['CUVR-057'],
  'pattern-invalid-surrogate-category': ['CUVR-035', 'CUVR-057'],
  'value-parameter-order': ['CUVR-042'],
  'value-parameter-row-path': ['CUVR-057'],
  'pattern-invalid-number-parameter': ['CUVR-053'],
  'pattern-invalid-true-parameter': ['CUVR-053'],
  'reference-equalto-true-parameter': ['CUVR-054'],
  'reference-equalto-number-parameter': ['CUVR-054'],
  'reference-enddate-list-parameter': ['CUVR-054'],
  'reference-enddate-object-parameter': ['CUVR-054'],
  'reference-notequal-list-parameter': ['CUVR-055'],
  'reference-notequal-object-parameter': ['CUVR-055'],
  'reference-unique-number-parameter': ['CUVR-056'],
  'reference-unique-list-parameter': ['CUVR-056'],
  'unregistered-rule-rejected': ['CUVR-041'],
  'unregistered-rule-disabled-rejected': ['CUVR-041'],
  'unregistered-rule-case-rejected': ['CUVR-041'],
  'unregistered-rule-row-path': ['CUVR-041'],
  'unregistered-rule-hidden-field': ['CUVR-041'],
  'unregistered-rule-after-parameter': ['CUVR-042'],
  'unregistered-rule-before-parameter': ['CUVR-041'],
  'unregistered-rule-field-order': ['CUVR-041'],
  'unregistered-rule-message': ['CUSC-052', 'CUVR-041'],
  'unregistered-rule-message-order': ['CUSC-052', 'CUVR-041'],
  'unregistered-rule-message-after-parameter': ['CUSC-052', 'CUVR-042'],
  'pattern-message-declared-name': ['CUSC-003', 'CUSC-052', 'CUVR-009'],
  'unique-text-same': ['CUVR-015'],
  'unique-text-empty': ['CUVR-020'],
  'unique-number-same': ['CUVR-015'],
  'unique-list-same': ['CUVR-015'],
  'unique-object-member-order': ['CUVR-015'],
  'unique-nested-member-order': ['CUVR-015'],
  'unique-row-field': ['CUVR-015'],
  'registered-rule-message-undeclared': ['CUSC-052', 'CUVR-005'],
  'visibility-condition-map-without-selection': ['CUVR-001'],
  'visibility-literal-string-show': ['CUVR-001'],
  'visibility-show-literal-identifier': ['CUSC-055', 'CUVR-001', 'CUVR-017'],
  'visibility-hidden-data-shape': ['CUEC-003'],
  'visibility-hidden-field-skips-all-rules': ['CUSC-055', 'CUVR-017'],
  'visibility-shown-field-validates': ['CUVR-001', 'CUVR-002', 'CUVR-003', 'CUVR-005', 'CUVR-009', 'CUVR-014'],
  'visibility-literal-show': ['CUSC-055', 'CUVR-001', 'CUVR-017'],
  'visibility-condition-map': ['CUSC-055', 'CUVR-001', 'CUVR-017'],
  'visibility-hidden-group-descendants': ['CUEC-006', 'CUSC-055', 'CUVR-017'],
  'visibility-per-row': ['CUSC-055', 'CUVR-001', 'CUVR-003', 'CUVR-017'],
  'visibility-row-parent-a': ['CUVR-001', 'CUVR-010'],
  'visibility-row-parent-7': ['CUVR-001', 'CUVR-010'],
  'visibility-row-parent-r1': ['CUVR-001', 'CUVR-010'],
  'reference-nested-group': ['CUVR-010'],
  'visibility-row-parent-off': ['CUSC-055', 'CUVR-017'],
  'switch-group-subtree-off': ['CUSC-055', 'CUVR-017'],
  'switch-group-subtree-on': ['CUVR-001'],
  'switch-nested-levels-off': ['CUSC-055', 'CUVR-017'],
  'switch-nested-levels-on': ['CUSC-055', 'CUVR-017'],
  'switch-nested-levels-deep': ['CUVR-001'],
  'switch-rows-strict': ['CUSC-055', 'CUVR-001', 'CUVR-017'],
  'switch-rows-loose': ['CUSC-055', 'CUVR-001', 'CUVR-017'],
  'visibility-hidden-value-still-read': ['CUEC-006', 'CUSC-055', 'CUVR-001', 'CUVR-010', 'CUVR-017'],
  'visibility-toggle-step-2-hidden-invalid': ['CUSC-055', 'CUVR-017'],
  'visibility-toggle-step-3-shown-invalid': ['CUVR-001', 'CUVR-009'],
  'multiple-only-rows-validated': ['CUVR-001', 'CUVR-006'],
  'multiple-only-missing-data-valid': ['CUEC-005'],
  'multiple-only-missing-data-required': ['CUEC-005', 'CUVR-001'],
  'multiple-only-missing-data-mincount': ['CUEC-005', 'CUVR-014'],
  'multiple-missing-data-required': ['CUVR-001'],
  'multiple-missing-data-mincount': ['CUVR-014'],
  'multiple-only-empty-required': ['CUVR-001'],
  'number-text-accepted': ['CUVR-023', 'CUVR-024'],
  'number-text-rejected': ['CUVR-005', 'CUVR-023', 'CUVR-024'],
  'number-empty-skipped': ['CUVR-020'],
  'number-underflow': ['CUVR-023'],
  'min-inclusive': ['CUVR-006', 'CUVR-025'],
  'max-inclusive': ['CUVR-006', 'CUVR-025'],
  'range-inclusive': ['CUSC-008', 'CUVR-007', 'CUVR-025'],
  'bounds-fail-non-numeric': ['CUVR-006', 'CUVR-025'],
  'max-reads-exponent': ['CUVR-006', 'CUVR-023'],
  'bounds-negative-zero-and-fractions': ['CUVR-007', 'CUVR-025'],
  'range-field-values': ['CUSC-008', 'CUSC-009', 'CUSC-010', 'CUVR-007', 'CUVR-008', 'CUVR-020'],
  'step-exact-decimal': ['CUSC-009', 'CUVR-008'],
  'step-small-and-large': ['CUSC-009', 'CUVR-008'],
  'step-large': ['CUSC-009', 'CUVR-008'],
  'step-fails-non-numeric': ['CUSC-009', 'CUVR-008'],
  'step-quarter': ['CUSC-009', 'CUVR-008'],
  'digits-values': ['CUVR-005', 'CUVR-026'],
  'count-values': ['CUVR-014', 'CUVR-027'],
  'in-numeric-text': ['CUVR-011', 'CUVR-029'],
  'message-parameter-text': ['CUSC-052', 'CUVR-006', 'CUVR-028'],
  'message-large-parameter': ['CUSC-052', 'CUVR-006', 'CUVR-028'],
  'message-every-placeholder': ['CUSC-052', 'CUVR-007', 'CUVR-028'],
  'message-missing-placeholder': ['CUSC-052', 'CUVR-006', 'CUVR-028'],
  'in-member-as-written': ['CUVR-011', 'CUVR-029'],
  'number-parameter-number': ['CUVR-044'],
  'digits-parameter-number': ['CUVR-044'],
  'min-parameter-true': ['CUVR-045'],
  'max-parameter-list': ['CUVR-045'],
  'min-parameter-object': ['CUVR-045'],
  'range-parameter-reversed': ['CUSC-008', 'CUVR-046'],
  'range-parameter-short': ['CUSC-008', 'CUVR-046'],
  'range-parameter-long': ['CUSC-008', 'CUVR-046'],
  'range-parameter-null-bound': ['CUSC-008', 'CUVR-046'],
  'step-parameter-zero': ['CUSC-009', 'CUVR-047'],
  'step-parameter-negative': ['CUSC-009', 'CUVR-047'],
  'step-parameter-true': ['CUSC-009', 'CUVR-047'],
  'mincount-parameter-fraction': ['CUVR-048'],
  'maxcount-parameter-negative': ['CUVR-048'],
  'maxcount-parameter-true': ['CUVR-048'],
  'min-parameter-from-data': ['CUVR-045'],
  'min-parameter-from-data-numeric': ['CUVR-006'],
  'date-rule-rejects-text-that-is-no-date': ['CUVR-012', 'CUVR-058'],
  'dateiso-rule-accepts-iso-date': ['CUVR-012', 'CUVR-059'],
  'dateiso-rule-rejects-other-format': ['CUVR-012', 'CUVR-059'],
  'date-rule-rejects-jan-2-2026': ['CUVR-058'],
  'date-rule-rejects-weekday-month-day-year': ['CUVR-058'],
  'date-layout-year-first-dashes-accepted': ['CUVR-058'],
  'date-layout-year-first-slashes-accepted': ['CUVR-058'],
  'date-layout-month-first-slashes-accepted': ['CUVR-058'],
  'date-layout-day-first-slashes-accepted': ['CUVR-058'],
  'date-layout-slashes-either-reading': ['CUVR-058'],
  'date-layout-rfc3339-utc-accepted': ['CUVR-058'],
  'date-layout-rfc3339-offset-accepted': ['CUVR-058'],
  'date-layout-rfc3339-without-offset-rejected': ['CUVR-058'],
  'date-layout-rfc3339-offset-hour-rejected': ['CUVR-058'],
  'date-rule-rejects-number': ['CUVR-058'],
  'date-layout-rejects-impossible-day': ['CUVR-058'],
  'date-layout-rejects-leap-day-of-common-year': ['CUVR-058'],
  'date-layout-trims-surrounding-whitespace': ['CUVR-058'],
  'dateiso-layout-rejects-slash-form': ['CUVR-059'],
  'dateiso-layout-rejects-number': ['CUVR-059'],
  'dateiso-layout-accepts-trimmed-text': ['CUVR-059'],
  'expression-scalar-equals-array-is-false': ['CUSC-038'],
  'expression-zero-equals-empty-array-is-false': ['CUSC-038'],
  ...CONDITION_TREE_REQUIREMENTS,
  'reference-row-ids': ['CUVR-020', 'CUVR-071', 'CUVR-072', 'CUVR-073'],
  'reference-nested-rows-and-repeated-target': ['CUVR-071', 'CUVR-072'],
  'reference-membership-matching': ['CUVR-029', 'CUVR-071', 'CUVR-072', 'CUVR-073'],
  'reference-no-ids': ['CUVR-020', 'CUVR-073'],
  'reference-hidden-ids': ['CUVR-017', 'CUVR-072'],
  'reference-parameter-false': ['CUVR-071'],
  'reference-parameter-number': ['CUVR-074'],
  'reference-parameter-list': ['CUVR-074'],
  'reference-parameter-condition-map': ['CUVR-074'],
  'reference-parameter-undeclared': ['CUVR-074'],
  'reference-parameter-group': ['CUVR-074'],
  'reference-parameter-lang': ['CUVR-074'],
  'reference-parameter-row-key': ['CUVR-074'],
  'reference-parameter-relative': ['CUVR-074'],
  'reference-parameter-in-row': ['CUVR-074'],
  ...CONDITION_FIELD_REQUIREMENTS,
};

/**
 * The two CUSC-038 cases of an expression that compares with an array: the reference expression parser decides the
 * condition, and JavaScript loose equality would decide it differently (the expectation is the reference's).
 */
const EXPRESSION_CASES: CaseSpec[] = [
  {
    name: 'expression-scalar-equals-array-is-false',
    note: "'a' == .tags is false for tags ['a']: an array compared with a scalar has no text, so the note is not required. JavaScript loose equality gives true there, so this case rejects it (CUSC-038).",
    spec: { type: 'group', properties: { tags: { type: 'multichoice', items: ['a', 'b'] }, note: { type: 'text', validate: { required: "'a' == .tags" } } } },
    data: { tags: ['a'], note: '' },
  },
  {
    name: 'expression-zero-equals-empty-array-is-false',
    note: '0 == .tags is false for an empty array, so the note is not required. JavaScript loose equality gives true (0 == []), so this case rejects it (CUSC-038).',
    spec: { type: 'group', properties: { tags: { type: 'multichoice', items: ['a', 'b'] }, note: { type: 'text', validate: { required: '0 == .tags' } } } },
    data: { tags: [], note: '' },
  },
];

const generated = [...SPECS.map(build), ...AUTHORED_CASES.map(authored), ...VISIBILITY_CASES.map(written), ...NUMERIC_CASES.map(written), ...REFERENCE_CASES.map(written), ...EXPRESSION_CASES.map(build), ...GROUP_SOURCE_CASES.map(written), ...COMBINED_ITEMS_CASES.map(written), ...MULTIPLE_SHAPE_CASES.map(written), ...KEYED_MAP_CASES.map(written), ...CONDITION_TREE_CASES.map(written), ...CONTAINED_IN_CASES.map(written), ...TYPE_FROM_CASES.map(written), ...BOUNDS_FROM_CASES.map(written), ...DATA_LIMITS_CASES.map(written), ...CONDITION_FIELD_CASES.map(written)];
for (const name of Object.keys(REQUIREMENTS)) {
  if (!generated.some(c => c.name === name)) throw new Error(`requirements name ${name}, which no generated case has`);
}
/** Every case is a validate call of the runtime package (CURP-018) that validates record data and reports its errors (CURP-022). */
const RUNTIME_REQUIREMENTS = ['CURP-018', 'CURP-022'];
const out = generated.map((c): Record<string, unknown> => ({ ...c, requirements: [...(REQUIREMENTS[String(c.name)] ?? []), ...RUNTIME_REQUIREMENTS] }));
const dataPlaceholder = (name: string) => `__DATA_TEXT_${name}__`;
const compactData = (name: string) => JSON.stringify(dataPlaceholder(name));
let text = JSON.stringify(out.map(c => (DATA_LIMITS_COMPACT.includes(String(c.name)) ? { ...c, data: dataPlaceholder(String(c.name)) } : c)), null, 2);
// Data of many nodes is written on one line, which a line per node would make the largest part of the file.
for (const c of out) {
  if (!DATA_LIMITS_COMPACT.includes(String(c.name))) continue;
  if (text.split(compactData(String(c.name))).length !== 2) throw new Error(`data text placeholder for ${String(c.name)} must occur once`);
  text = text.replace(compactData(String(c.name)), JSON.stringify(c.data));
}
for (const c of SPECS) {
  if (c.specText === undefined) continue;
  const placeholder = JSON.stringify(`__SPEC_TEXT_${c.name}__`);
  if (text.split(placeholder).length !== 2) throw new Error(`specification text placeholder for ${c.name} must occur once`);
  text = text.replace(placeholder, c.specText);
}
process.stdout.write(text + '\n');
