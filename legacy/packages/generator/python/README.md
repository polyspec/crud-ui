# CRUDUI Python generator
<!-- doc-id: packages-generator-python-readme -->

[한국어](README.ko.md).

Compile form templates, bind data and render forms, lists and details in Python.

```sh
python3 -m unittest discover -s legacy/packages/generator/python/tests -p 'test_*.py'
```

## Public API

```python
from polyspec.crudui.generator import Generator

spec = {"type": "group", "properties": {"name": {"type": "text", "label": "Name"}}}
template = Generator.compileForm(spec)
form = Generator.createForm(template, {"name": "Ada"})
html = Generator.renderForm(form)
```

`Generator.compileForm(spec, options)` compiles a specification into a
JSON-serializable template without record data. `bindForm` binds data to the
fields of a template, `bindButtons` evaluates the buttons of a record and
`formButtonsHtml` renders evaluated buttons as the markup every renderer places
in the form footer. `createForm` holds an independent form instance — a `Form`
over a copied template — whose row operations `addRow`, `copyRow`, `removeRow`,
`moveRow` and `rekeyRow`, value operations `getValue`, `setValue` and `setData`
and getters feed `renderForm`. `renderList` renders supplied rows with the
table or card layout and `buildList` builds the read-only list model; `renderDetail`
and `buildDetail` do the same for one record. `buildOutline` builds the structure map rows of evaluated nodes. `sequenceRowKey` formats a
nonnegative sequence as thirteen decimal digits and `createRowKey` makes a
thirteen-character hexadecimal row key.

Generation failures raise `FormError` with code `INVALID_FORM_INPUT` or
`UNSUPPORTED_FIELD_TYPE`; specification composition failures raise the
`ComposeLoadError` and `FormInputError` of `polyspec.crudui.validator`.
Dictionaries represent objects and lists represent arrays; every string keeps
its exact code points, and an unpaired surrogate a caller passes is rejected
before generation. The module declares the namespace package
`polyspec.crudui.generator`, needs Python 3.11 or newer and uses only the
standard library beside `polyspec-crudui-validator`.

The unit tests read the shared fixtures of `legacy/tests/fixtures`: every case of
`form-render` (188), `list-render` (157), `detail-render` (62), `form-complete`
(28) and the `compileForm`, `bindForm`, `createForm`, `buildList` and
`buildDetail` files of `text-validity`. [Feature status](../../../../docs/features.md)
records current verification separately from publication.
