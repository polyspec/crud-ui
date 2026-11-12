"""The form view state fixtures against the Python generator.

The cases of `legacy/tests/fixtures/form-view` run their steps on a form instance and
those of `legacy/tests/fixtures/view-functions` call the view functions; each
observation equals the one that the TypeScript reference recorded, as JSON text
so that the order of object members counts. A row key that a case does not
write is one that an operation generated, and the observation names it `$1`,
`$2` in the order of its first appearance (legacy/tests/fixtures/form-state/README.md).
"""

import json
import re
import unittest

from polyspec.crudui.generator import FormError, Generator
from polyspec.crudui.validator import validate as _validate

from .conformance import add_case_tests

_GENERATED_KEY = re.compile(r"__[0-9A-Za-z]{13}__")


def _text(value):
    return json.dumps(value, ensure_ascii=False)


class _Namer:
    """Names the row keys that an operation generated."""

    def __init__(self, *texts):
        self.known = {key for text in texts for key in _GENERATED_KEY.findall(text)}
        self.generated = {}

    def rename(self, text):
        def name(match):
            key = match.group(0)
            if key in self.known:
                return key
            return self.generated.setdefault(key, f"${len(self.generated) + 1}")

        return _GENERATED_KEY.sub(name, text)

    def walk(self, value):
        if isinstance(value, str):
            return self.rename(value)
        if isinstance(value, list):
            return [self.walk(item) for item in value]
        if isinstance(value, dict):
            return {self.rename(key): self.walk(item) for key, item in value.items()}
        return value


def _collapsed_rows(nodes):
    """The row paths of the collapsed rows of the evaluated nodes, depth first."""
    found = []
    for node in nodes:
        children = node.get("children") or []
        if node.get("kind") != "collection":
            found.extend(_collapsed_rows(children))
            continue
        for row in children:
            if row.get("collapsible") is True and row.get("expanded") is False:
                found.append(f"{node['path']}.{row['key']}")
            found.extend(_collapsed_rows(row.get("children") or []))
    return found


_ACTION_STEPS = ("runAction", "resolveAction")


def _field_choices(nodes, path):
    """The value and label of each option of the field node at a data path, depth first, or None."""
    for node in nodes:
        if node.get("kind") == "field" and node.get("path") == path:
            options = (node.get("widget") or {}).get("options") or []
            return [
                {"value": option["value"], "label": option["label"]}
                for option in options
            ]
        found = _field_choices(node.get("children") or [], path)
        if found is not None:
            return found
    return None


def _perform(form, op, args, spec):
    """Run one step on the form and return what the step returned."""
    if op == "validate":
        # The errors of the validator for the specification and the current record, in the validator's order.
        result = _validate(spec, form.getData(), {})
        return {
            "valid": result["valid"],
            "errors": [
                {
                    "path": e["path"],
                    "field": e["field"],
                    "rule": e["rule"],
                    "message": e["message"],
                }
                for e in result["errors"]
            ],
        }
    if op == "choices":
        found = _field_choices(form.getFields(), args[0])
        if found is None:
            raise AssertionError(f"no field node at {args[0]}")
        return found
    if op == "addRow":
        return form.addRow(args[0], args[1] if len(args) > 1 else {})
    if op == "copyRow":
        return form.copyRow(args[0], args[1], args[2] if len(args) > 2 else {})
    if op in ("removeRow", "moveRow", "rekeyRow", "setValue", "setData", "toggleRow"):
        return getattr(form, op)(*args)
    if op == "setAllExpanded":
        return form.setAllExpanded(args[0])
    if op in ("undo", "redo"):
        return getattr(form, op)()
    if op == "runAction":
        return Generator.runAction(form, args[0])
    if op == "resolveAction":
        return Generator.resolveAction(args[0])
    raise AssertionError(f"unknown step {op}")


def _check_session(test, case, history):
    """Run one session; `history` adds the history flags to each observation."""
    name = _Namer(_text(case["spec"]), _text(case["data"]), _text(case["steps"]))
    form = Generator.createForm(Generator.compileForm(case["spec"]), case["data"])
    for index, step in enumerate(case["steps"]):
        observed = {}
        try:
            result = _perform(form, step["op"], step["args"], case["spec"])
            # An action reports its target or its outcome, null when it has none.
            if result is not None or step["op"] in _ACTION_STEPS:
                observed["result"] = name.walk(result)
        except FormError as error:
            observed["error"] = {"code": error.code, "message": str(error)}
        observed["data"] = name.walk(form.getData())
        observed["revision"] = form.getRevision()
        if history:
            observed["canUndo"] = form.canUndo()
            observed["canRedo"] = form.canRedo()
        observed["collapsed"] = name.walk(_collapsed_rows(form.getFields()))
        test.assertEqual(_text(observed), _text(case["expected"][index]), step)


class TestFormView(unittest.TestCase):
    """Each session of the view state fixtures equals its recorded observations."""

    def check_case(self, case):
        _check_session(self, case, history=False)


add_case_tests(
    TestFormView, "form-view", TestFormView.check_case, features=["viewState"]
)


class TestFormHistory(unittest.TestCase):
    """Each session of the undo history fixtures equals its recorded observations, with the history flags."""

    def check_case(self, case):
        _check_session(self, case, history=True)


add_case_tests(
    TestFormHistory,
    "form-history",
    TestFormHistory.check_case,
    features=["formHistory"],
)


class TestFormChoices(unittest.TestCase):
    """Each session of the choices of a group source equals its recorded observations, with the history flags."""

    def check_case(self, case):
        _check_session(self, case, history=True)


add_case_tests(
    TestFormChoices,
    "form-choices",
    TestFormChoices.check_case,
    features=["createForm"],
)


def _nodes(spec, data, collapsed=None):
    template = Generator.compileForm(spec)
    options = {} if collapsed is None else {"collapsed": collapsed}
    return Generator.bindForm(template, data, options)


def _call(op, args):
    if op == "initialView":
        return Generator.initialView()
    if op == "toggleRowView":
        return Generator.toggleRowView(args[0], args[1])
    if op == "collapsibleRows":
        return Generator.collapsibleRows(_nodes(args[0], args[1]))
    if op == "setAllExpandedView":
        return Generator.setAllExpandedView(_nodes(args[0], args[1]), args[2])
    if op == "removeRowView":
        return Generator.removeRowView(args[0], args[1])
    if op == "rekeyRowView":
        return Generator.rekeyRowView(args[0], args[1], args[2])
    if op == "bindCollapsed":
        return _collapsed_rows(_nodes(args[0], args[1], args[2]))
    raise AssertionError(f"unknown function {op}")


class TestFormActions(unittest.TestCase):
    """Each session of the action fixtures, resolveAction and runAction, equals its recorded observations."""

    def check_case(self, case):
        _check_session(self, case, history=True)


add_case_tests(
    TestFormActions,
    "form-actions",
    TestFormActions.check_case,
    features=["runAction"],
)


class TestViewFunctions(unittest.TestCase):
    """Each call of the view function fixtures equals its recorded result."""

    def check_case(self, case):
        self.assertEqual(
            _text({"result": _call(case["op"], case["args"])}),
            _text(case["expected"]),
        )


add_case_tests(
    TestViewFunctions,
    "view-functions",
    TestViewFunctions.check_case,
    features=["viewState"],
)
