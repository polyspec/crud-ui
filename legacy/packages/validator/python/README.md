# CRUDUI Python validator
<!-- doc-id: packages-validator-python-readme -->

[한국어](README.ko.md).

Compose specifications, evaluate expressions and validate data in Python.

```sh
python3 -m unittest discover -s legacy/packages/validator/python/tests -p 'test_*.py'
```

## Public API

```python
from polyspec.crudui.validator import ComposeLoadError, FormInputError, validate

spec = {
    "type": "group",
    "properties": {"name": {"type": "text", "validate": {"required": True}}},
}
result = validate(spec, {"name": "Ada"})
assert result["valid"]
```

`validate(spec, data, options)` composes the specification, scans for
unsupported metadata and validates submitted data. `validateList` checks list
specification composition and metadata; it does not validate rows.
`validateDetail` checks detail specification composition, including `$ref` and
`$patch` on the root and the `fields` map, and metadata; it does not validate a
record. Both return `{'valid': True, 'errors': []}` on a clean load. Options
accept `files`, a map of composition documents, and `basepath`. Composition
failures raise `ComposeLoadError`; its `code` names the reason and its `trace`
the specification paths. Submitted data with the wrong shape or text raises
`FormInputError` with code `INVALID_FORM_INPUT`.

Results and error entries are dictionaries. `errors` is a list of `path`,
`field`, `rule`, `message` and `value` records. Dictionaries represent objects
and lists represent arrays; every string keeps its exact code points, and an
unpaired surrogate a caller passes is rejected before validation. The module
declares the namespace package `polyspec.crudui.validator`, needs Python 3.11
or newer and uses only the standard library.

The unit tests read the shared fixtures of `legacy/tests/fixtures`: every case of
`validate` (309), `expr` (54), `compose` (20), `spec-validity` (34),
`list-validity` (20), `detail-validity` (13) and the `validate`,
`validateList`, `validateDetail` files and `value-graphs.json` of
`text-validity`. [Feature status](../../../../docs/features.md) records current
verification separately from publication.
