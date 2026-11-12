"""The form button fixtures against the Python generator.

The cases of `legacy/tests/fixtures/buttons` run `bindButtons` (CURP-008) and `formButtonsHtml` (CURP-009); each observation
equals the one that the TypeScript reference recorded, as JSON text, so that the order of the attributes counts. A
failure is observed with its code and message.
"""

import json
import unittest

from polyspec.crudui.generator import FormError, Generator

from .conformance import add_case_tests


def _text(value):
    return json.dumps(value, ensure_ascii=False)


def _observe(run):
    try:
        return {"result": json.loads(_text(run()))}
    except FormError as error:
        return {"error": {"code": error.code, "message": str(error)}}


def _bind(case):
    """Compile the spec of a case, or pass its template as it is, then bind the buttons for its record."""
    if "spec" in case:
        template = Generator.compileForm(case["spec"])
    else:
        template = case["template"]
    return Generator.bindButtons(
        template, case.get("data", {}), case.get("options", {})
    )


def _check(test, case):
    if case["operation"] == "bindButtons":
        observed = _observe(lambda: _bind(case))
    else:
        observed = _observe(lambda: Generator.formButtonsHtml(case["buttons"]))
    test.assertEqual(_text(observed), _text(case["expected"]))


class TestButtonsSuite(unittest.TestCase):
    """Each case of the buttons fixture reproduces its expectation."""


add_case_tests(
    TestButtonsSuite,
    "buttons",
    _check,
    features=lambda case: [case["operation"]],
)


if __name__ == "__main__":
    unittest.main()
