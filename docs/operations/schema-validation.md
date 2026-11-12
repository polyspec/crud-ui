# Schema validation
<!-- doc-id: docs-operations-schema-validation -->

[한국어](schema-validation.ko.md).

Run `make docs-schema` from the repository root after installing npm dependencies.
The command compiles `contracts/schema/crudui.schema.json` with Ajv and checks shared form
and list fixtures. It fails when the schema is invalid or a fixture result differs.
It does not modify the schema or expected results.

`scripts/check-schema.mts` holds every specification in the repository that is meant
to be valid to the meta-schema: the form, list and detail specification of every
fixture family, each composition file as the fragment its `$ref` selects, the
specifications of every example under `examples` and `packages/*/examples`, the
form-session specifications and the requests that the cross-check console's validator
processes accept. A case that expects an input or composition failure is not such a
specification and is skipped. A specification
declared outside the schema on purpose is listed in the script with its reason and
asserted to fail, so an exemption cannot become silent. Every tracked YAML file must
parse under the unique-key rule and be a specification the script checks or a fixture
of the CLI's own tests. No YAML specification goes unchecked.

The JSON Schema defines accepted declaration shapes. The TypeScript declarations
in `legacy/packages/validator/ts/src/schema.ts` provide corresponding authoring types, which the entry
of `@polyspec/crudui-validator` exports and its API report `etc/crudui-validator.api.md` lists.
Update both when changing the declaration contract, then run the validator suites,
CLI checks and `make docs-schema`. `make docs-clean` preserves the schema source.
