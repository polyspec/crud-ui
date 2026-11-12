/**
 * Shared-fixture generator for the 4-language composition engine (SPEC §5).
 *
 * Runs the JS reference compose engine for real and dumps, per case, the
 * expanded single spec (`expected`) or the load-error code (`expectError`). The
 * other three engines (PHP / Go / Rust) load the SAME `cases.json` and must
 * reproduce it bit-for-bit (G-B 4-language idempotence).
 *
 * Fixture format (per the task contract):
 *   { name, input: { files?, entry, basepath? }, expected }      — success
 *   { name, input: { files?, entry, basepath? }, expectError }   — load error
 *
 * `input.files`   : the virtual file set `{ key: doc }` `$ref` resolves against.
 * `input.entry`   : the composition spec/properties handed to the engine.
 * `input.kind`    : 'properties' (default) | 'spec' — which entry point to call.
 * `input.basepath`: relative-`$ref` basepath (default '').
 * `expected`      : the engine's expanded single spec (composition keys gone).
 * `expectError`   : `{ code }` — the ComposeLoadError.code the engine throws.
 * `requirements` : the spec requirements the case tests: composition (CUSC-007) of docs/spec/schema.md.
 *
 * Regenerate (from repo root):
 *   node legacy/packages/validator/ts/scripts/generate-compose-cases.mts > legacy/tests/fixtures/compose/cases.json
 */

import { ComposeLoadError } from '@polyspec/crudui-validator';
import { composeProperties, composeSpec, MemoryLoader } from '@polyspec/crudui-validator/internal';

interface CaseInput {
  files?: Record<string, Record<string, unknown>>;
  entry: Record<string, unknown>;
  kind?: 'properties' | 'spec';
  basepath?: string;
}

interface CaseSpec {
  name: string;
  note: string;
  input: CaseInput;
  /** Requirements the case tests besides CUSC-007. */
  requirements?: string[];
}

// Every case tests the composition of field definitions, the requirement CUSC-007 of docs/spec/schema.md.
const REQUIREMENTS = ['CUSC-007'];

// ---------------------------------------------------------------------------
// Cases — one per fixture_case_ideas entry in the analysis (single truth).
// ---------------------------------------------------------------------------

const SPECS: CaseSpec[] = [
  // 1. inheritance basics: base.yml(properties:{a,b}) + main properties.$ref.
  {
    name: 'ref-inherit-base',
    note: 'plain $ref pulls the file properties layer as the base (a,b)',
    // Every implementation composes field definitions: the composition part of CURP-001 of docs/spec/runtime-packages.md.
    requirements: ['CURP-001'],
    input: {
      files: {
        'base.yml': {
          properties: {
            a: { type: 'text', label: 'A' },
            b: { type: 'number', label: 'B' },
          },
        },
      },
      entry: { $ref: 'base.yml' },
    },
  },

  // 2. path-specified $ref: '(base.yml).group.properties'
  {
    name: 'ref-path-specified',
    note: 'path-specified $ref descends group.properties then properties',
    input: {
      files: {
        'base.yml': {
          group: {
            properties: {
              properties: {
                inner: { type: 'text' },
              },
            },
          },
        },
      },
      entry: { $ref: '(base.yml).group.properties' },
    },
  },

  // 3. multiple $ref: order merge, later overrides earlier on key clash.
  {
    name: 'ref-multiple-order',
    note: '$ref: [x,y] merges in order; y overrides x on a shared key',
    input: {
      files: {
        'x.yml': {
          properties: {
            shared: { type: 'text', label: 'x' },
            only_x: { type: 'text' },
          },
        },
        'y.yml': {
          properties: {
            shared: { type: 'number', label: 'y' },
            only_y: { type: 'text' },
          },
        },
      },
      entry: { $ref: ['x.yml', 'y.yml'] },
    },
  },

  // 4. deep-path set: base + $patch {'field.validate.required': '.other'}.
  {
    name: 'patch-deep-path-set',
    note: 'deep-path set updates only field.validate.required, preserving siblings',
    input: {
      files: {
        'base.yml': {
          properties: {
            field: {
              type: 'text',
              validate: { email: true, required: false },
              design: { class: 'form-control' },
            },
            other: { type: 'checkbox' },
          },
        },
      },
      entry: {
        $ref: 'base.yml',
        $patch: { 'field.validate.required': '.other' },
      },
    },
  },

  // 5. patch add: a new field absent in the base.
  {
    name: 'patch-add-field',
    note: 'structured add inserts a new field into the expanded spec',
    input: {
      files: {
        'base.yml': { properties: { a: { type: 'text' } } },
      },
      entry: {
        $ref: 'base.yml',
        $patch: { add: { newf: { type: 'email' } } },
      },
    },
  },

  // 6. patch replace: scalar design.class override (deep-merge scalar wins).
  {
    name: 'patch-replace-scalar',
    note: 'replace overrides a scalar leaf (deep-merge: latter scalar wins)',
    input: {
      files: {
        'base.yml': {
          properties: {
            a: { type: 'text', design: { class: 'old', show: '.x' } },
          },
        },
      },
      entry: {
        $ref: 'base.yml',
        $patch: { replace: { 'a.design.class': 'new' } },
      },
    },
  },

  // 7. remove whole key.
  {
    name: 'patch-remove-whole-key',
    note: 'remove deletes a whole field from the expanded spec',
    input: {
      files: {
        'base.yml': {
          properties: {
            keep: { type: 'text' },
            retired_field: { type: 'text' },
          },
        },
      },
      entry: {
        $ref: 'base.yml',
        $patch: { remove: ['retired_field'] },
      },
    },
  },

  // 8. remove deep path: drop a subkey, preserve the field and its siblings.
  {
    name: 'patch-remove-deep-path',
    note: 'remove a deep subkey (field.options.max_tags); field + siblings stay',
    input: {
      files: {
        'base.yml': {
          properties: {
            field: {
              type: 'tags',
              options: { max_tags: 5, keyword_min_length: 2 },
            },
          },
        },
      },
      entry: {
        $ref: 'base.yml',
        $patch: { remove: ['field.options.max_tags'] },
      },
    },
  },

  // 9. nested $ref: base.yml contains another $ref — full flatten.
  {
    name: 'ref-nested-flatten',
    note: 'a $ref inside the resolved base is expanded recursively to a single spec',
    input: {
      files: {
        'base.yml': {
          properties: {
            $ref: 'inner.yml',
            own: { type: 'text', label: 'base' },
          },
        },
        'inner.yml': {
          properties: {
            deep: { type: 'number', label: 'inner' },
          },
        },
      },
      entry: { $ref: 'base.yml' },
    },
  },

  // 10. multiple $ref + deep-path set combined (resolution order base→patch).
  {
    name: 'ref-then-patch-order',
    note: '$ref base laid down first, then $patch overlays (deep-path set)',
    input: {
      files: {
        'base.yml': {
          properties: {
            a: { type: 'text', validate: { required: true } },
          },
        },
      },
      entry: {
        $ref: 'base.yml',
        $patch: {
          'a.validate.required': false,
          add: { b: { type: 'number' } },
        },
      },
    },
  },

  // 11. sibling key declared after $ref overrides the base (declaration order).
  {
    name: 'ref-sibling-override',
    note: 'a named sibling after $ref overrides the inherited base key',
    input: {
      files: {
        'base.yml': {
          properties: {
            a: { type: 'text', label: 'base' },
          },
        },
      },
      entry: {
        $ref: 'base.yml',
        a: { type: 'email', label: 'override' },
      },
    },
  },

  // 12. spec-level $ref: a field inherits a whole base spec, then recurses props.
  {
    name: 'spec-level-ref',
    note: 'a field-level $ref inherits a base spec; its properties also compose',
    input: {
      kind: 'spec',
      files: {
        'group.yml': {
          properties: {
            child: { type: 'text' },
          },
        },
      },
      entry: {
        type: 'group',
        properties: { $ref: 'group.yml' },
      },
    },
  },

  // 13. basepath prefix on relative $ref.
  {
    name: 'ref-basepath-relative',
    note: 'relative $ref gets the basepath prefix before lookup',
    input: {
      basepath: '/forms',
      files: {
        '/forms/base.yml': { properties: { a: { type: 'text' } } },
      },
      entry: { $ref: 'base.yml' },
    },
  },

  // ---- load-error cases (expectError) -----------------------------------

  // 14. unresolved file — must be a load error, NOT valid:true.
  {
    name: 'err-ref-file-missing',
    note: 'A missing $ref file produces a load error.',
    input: {
      files: {},
      entry: { $ref: 'nonexistent.yml' },
    },
  },

  // 15. malformed format — '(broken'.
  {
    name: 'err-ref-format',
    note: 'malformed path-specified $ref is a ref-format load error',
    input: {
      files: {},
      entry: { $ref: '(broken' },
    },
  },

  // 16. detectKey absent — '(base.yml).nope'.
  {
    name: 'err-ref-detect-key',
    note: 'absent detectKey is a not-found load error',
    input: {
      files: {
        'base.yml': { properties: { a: { type: 'text' } } },
      },
      entry: { $ref: '(base.yml).nope' },
    },
  },

  // 17. cycle a.yml -> b.yml -> a.yml (infinite recursion forbidden).
  {
    name: 'err-ref-cycle',
    note: 'a $ref cycle is detected as a load error (no infinite recursion)',
    input: {
      files: {
        'a.yml': { properties: { $ref: 'b.yml' } },
        'b.yml': { properties: { $ref: 'a.yml' } },
      },
      entry: { $ref: 'a.yml' },
    },
  },

  // 18. patch remove target missing (strict array-path remove).
  {
    name: 'err-patch-remove-missing',
    note: 'strict deep-path remove of an absent target is a load error',
    input: {
      files: {
        'base.yml': { properties: { a: { type: 'text' } } },
      },
      entry: {
        $ref: 'base.yml',
        $patch: { remove: ['ghost.subkey'] },
      },
    },
  },

  // 19. patch path conflict (descend into a scalar).
  {
    name: 'err-patch-path-conflict',
    note: 'deep-path set descending into a scalar leaf is a load error',
    input: {
      files: {
        'base.yml': { properties: { a: { type: 'text' } } },
      },
      entry: {
        $ref: 'base.yml',
        $patch: { 'a.type.deeper': 'x' },
      },
    },
  },

  // 20. $ref value type error (not string / string[]).
  {
    name: 'err-ref-value-type',
    note: '$ref that is neither string nor string[] is a load error',
    input: {
      files: {},
      entry: { $ref: 123 },
    },
  },
];

// ---------------------------------------------------------------------------
// Run the JS reference engine for real; dump expected | expectError.
// ---------------------------------------------------------------------------

interface OutCase {
  name: string;
  note: string;
  requirements: string[];
  input: CaseInput;
  expected?: unknown;
  expectError?: { code: string };
}

const out: OutCase[] = SPECS.map((spec) => {
  const loader = new MemoryLoader(spec.input.files ?? {});
  const kind = spec.input.kind ?? 'properties';
  const opts = spec.input.basepath ? { basepath: spec.input.basepath } : {};

  const base: OutCase = { name: spec.name, note: spec.note, requirements: [...REQUIREMENTS, ...(spec.requirements ?? [])].sort(), input: spec.input };
  try {
    const result =
      kind === 'spec'
        ? composeSpec(spec.input.entry, loader, opts)
        : composeProperties(spec.input.entry, loader, opts);
    base.expected = result;
  } catch (e) {
    if (e instanceof ComposeLoadError) {
      base.expectError = { code: e.code };
    } else {
      throw e; // an unexpected (non-load) error must not be silently encoded
    }
  }
  return base;
});

// Fail loudly if a case meant to succeed threw, or vice versa, by name prefix.
for (const c of out) {
  const isErrCase = c.name.startsWith('err-');
  if (isErrCase && !c.expectError) {
    throw new Error(`case ${c.name} expected an error but composed successfully`);
  }
  if (!isErrCase && !('expected' in c)) {
    throw new Error(`case ${c.name} expected success but threw a load error`);
  }
}

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
