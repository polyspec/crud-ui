"""The input text fixtures of the generation operations.

Every case of the `compileForm`, `bindForm`, `createForm`, `buildList` and
`buildDetail` files of `legacy/tests/fixtures/text-validity` runs with its inputs
decoded from JSON text that writes unpaired surrogates as escapes: a Python
string keeps the escape as a lone surrogate code unit, so the input text check
rejects it. A case either throws the recorded failure `{code, message, at}` or
passes; a `createForm` case runs its recorded action on the created instance.
"""

import unittest

from .conformance import add_case_tests, cases_of
from polyspec.crudui.conformance import Proving


def _options_of(case):
    options = dict(case.get("options") or {})
    if "files" in case:
        options["files"] = case["files"]
    return options


# The class of the error that the last run of `_outcome` threw (CUIT-041), or 'none'.
_THROWN = ["none"]


def _outcome(run):
    """The failure record of a thrown failure, or 'pass'."""
    from polyspec.crudui.generator import FormError
    from polyspec.crudui.validator import ComposeLoadError, FormInputError

    _THROWN[0] = "none"
    try:
        run()
    except (ComposeLoadError, FormInputError, FormError) as error:
        _THROWN[0] = type(error).__name__
        if isinstance(error, ComposeLoadError):
            return {
                "code": error.code,
                "message": str(error),
                "at": ".".join(error.trace),
            }
        at = error.path if isinstance(error, FormError) else ""
        return {"code": error.code, "message": str(error), "at": at}
    return "pass"


def _native_type(expect):
    """The class that a generation expectation names (CUIT-041): a load failure is a ComposeLoadError, an input failure a FormError."""
    if isinstance(expect, dict) and expect.get("code") == "INVALID_TEXT":
        return "ComposeLoadError"
    if isinstance(expect, dict) and expect.get("code") == "INVALID_FORM_INPUT":
        return "FormError"
    return "none"


def check_compile_form(test, case):
    from polyspec.crudui.generator import Generator

    with Proving(
        ["compileForm"],
        "legacy/tests/fixtures/text-validity/compileForm/cases.json",
        case["name"],
    ) as proof:
        outcome = _outcome(
            lambda: Generator.compileForm(case["spec"], _options_of(case))
        )
        test.assertEqual(outcome, case["expect"])
        test.assertEqual(_THROWN[0], _native_type(case["expect"]))
        proof.passed = True


def check_bind_form(test, case):
    from polyspec.crudui.generator import Generator

    with Proving(
        ["bindForm"],
        "legacy/tests/fixtures/text-validity/bindForm/cases.json",
        case["name"],
    ) as proof:
        template = (
            case["template"]
            if "template" in case
            else Generator.compileForm(case["spec"])
        )
        outcome = _outcome(
            lambda: Generator.bindForm(
                template, case.get("data", {}), _options_of(case)
            )
        )
        test.assertEqual(outcome, case["expect"])
        test.assertEqual(_THROWN[0], _native_type(case["expect"]))
        proof.passed = True


def check_create_form(test, case):
    from polyspec.crudui.generator import Generator

    def run():
        template = (
            case["template"]
            if "template" in case
            else Generator.compileForm(case["spec"])
        )
        form = Generator.createForm(template, case.get("data", {}), _options_of(case))
        action = case.get("action")
        if action is not None:
            method = getattr(form, action["method"])
            method(*action["args"])

    test.assertEqual(_outcome(run), case["expect"])

    test.assertEqual(_THROWN[0], _native_type(case["expect"]))


def check_build_list(test, case):
    from polyspec.crudui.generator import Generator

    with Proving(
        ["buildList"],
        "legacy/tests/fixtures/text-validity/buildList/cases.json",
        case["name"],
    ) as proof:
        outcome = _outcome(
            lambda: Generator.buildList(
                case["spec"], case.get("rows", []), _options_of(case)
            )
        )
        test.assertEqual(outcome, case["expect"])
        test.assertEqual(_THROWN[0], _native_type(case["expect"]))
        proof.passed = True


def check_build_detail(test, case):
    from polyspec.crudui.generator import Generator

    with Proving(
        ["buildDetail"],
        "legacy/tests/fixtures/text-validity/buildDetail/cases.json",
        case["name"],
    ) as proof:
        outcome = _outcome(
            lambda: Generator.buildDetail(
                case["spec"], case.get("record", {}), _options_of(case)
            )
        )
        test.assertEqual(outcome, case["expect"])
        test.assertEqual(_THROWN[0], _native_type(case["expect"]))
        proof.passed = True


class TestTextCompileFormConformance(unittest.TestCase):
    """Each compileForm case keeps the input text rule of the generation operation."""


add_case_tests(
    TestTextCompileFormConformance, "text-validity/compileForm", check_compile_form
)


class TestTextBindFormConformance(unittest.TestCase):
    """Each bindForm case keeps the input text rule of the generation operation."""


add_case_tests(TestTextBindFormConformance, "text-validity/bindForm", check_bind_form)


class TestTextCreateFormConformance(unittest.TestCase):
    """Each createForm case keeps the input text rule, and its recorded action runs on the instance."""


add_case_tests(
    TestTextCreateFormConformance, "text-validity/createForm", check_create_form
)


class TestTextBuildListConformance(unittest.TestCase):
    """Each buildList case keeps the input text rule of the generation operation."""


add_case_tests(
    TestTextBuildListConformance, "text-validity/buildList", check_build_list
)


class TestTextBuildDetailConformance(unittest.TestCase):
    """Each buildDetail case keeps the input text rule of the generation operation."""


add_case_tests(
    TestTextBuildDetailConformance, "text-validity/buildDetail", check_build_detail
)


class TestGeneratorTextValidityFixtureCounts(unittest.TestCase):
    """The text-validity fixture of each generation operation holds the recorded number of cases."""

    def test_compile_form_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "compileForm/cases.json")), 7)

    def test_bind_form_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "bindForm/cases.json")), 17)

    def test_create_form_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "createForm/cases.json")), 15)

    def test_build_list_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "buildList/cases.json")), 11)

    def test_build_detail_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "buildDetail/cases.json")), 6)


if __name__ == "__main__":
    unittest.main()
