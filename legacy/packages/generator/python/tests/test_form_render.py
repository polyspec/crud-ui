"""The form rendering fixtures against the Python generator.

Every case of `legacy/tests/fixtures/form-render/cases.json` compiles, binds and
renders through the public operations: a result case reproduces the recorded
HTML as a parsed normalized tree, and a failure case raises the recorded code
and message.
Binding the same template twice writes the same fields.
"""

import unittest
import unittest.mock

from .conformance import add_case_tests, cases_of, failure_record, html_tree
from polyspec.crudui.conformance import Proving


class TestFormRenderConformance(unittest.TestCase):
    """The layout of the rendered form matches the shared fixture."""

    def render(self, case):
        from polyspec.crudui.generator import Generator

        options = case.get("options") or {}
        template = Generator.compileForm(case["spec"], options)
        data = case.get("data") or {}
        fields = Generator.bindForm(template, data, options)
        return template, fields, options, data

    def check_case(self, case):
        from polyspec.crudui.generator import Generator

        if "expected_html" in case:
            with Proving(
                ["compileForm", "bindForm", "renderForm"],
                "legacy/tests/fixtures/form-render/cases.json",
                case["name"],
            ) as proof:
                options = case.get("options") or {}
                template = Generator.compileForm(case["spec"], options)
                data = case.get("data") or {}
                form = Generator.createForm(template, data, options)
                actual = Generator.renderForm(form)
                self.assertEqual(html_tree(actual), html_tree(case["expected_html"]))
                # A new instance over the same template and data renders the same form.
                again = Generator.renderForm(
                    Generator.createForm(template, data, options)
                )
                self.assertEqual(actual, again)
                proof.passed = True
            return
        with Proving(
            ["compileForm", "bindForm", "renderForm"],
            "legacy/tests/fixtures/form-render/cases.json",
            case["name"],
        ) as proof:
            thrown = None
            try:
                self.render(case)
            except Exception as error:  # noqa: BLE001 - the record names the failure
                thrown = error
            record = failure_record(thrown)
            self.assertIsNotNone(record, f"{case['name']} must fail")
            self.assertEqual(
                {"code": record["code"], "message": record["message"]},
                case["expectError"],
            )
            proof.passed = True


add_case_tests(
    TestFormRenderConformance, "form-render", TestFormRenderConformance.check_case
)


class TestFormRenderFixtureCounts(unittest.TestCase):
    """The shape of the form render fixture: one expectation per case, and the counts of each kind."""

    def setUp(self):
        self.cases = cases_of("form-render")
        self.results = [case for case in self.cases if "expected_html" in case]
        self.failures = [case for case in self.cases if "expectError" in case]

    def test_every_case_runs_as_a_result_or_a_failure(self):
        # The counts follow cases.json: every case is one of the two kinds, and both kinds occur.
        self.assertGreater(len(self.results), 0)
        self.assertGreater(len(self.failures), 0)
        self.assertEqual(len(self.results) + len(self.failures), len(self.cases))

    def test_every_case_declares_exactly_one_expectation(self):
        for case in self.cases:
            exclusive = ("expected_html" in case) != ("expectError" in case)
            self.assertTrue(exclusive, f"{case['name']} must declare one expectation")


class TestAppearanceErrorsAreNotHidden(unittest.TestCase):
    """An evaluation error of an appearance ternary propagates, never as its text."""

    def test_evaluation_error_of_a_ternary_propagates(self):
        from polyspec.crudui.generator.design import appearance

        # The grammar of condition expressions has no division, so the failure is
        # injected at the evaluator: the error must reach the caller.
        with unittest.mock.patch(
            "polyspec.crudui.generator.design.evaluate_expression_value",
            side_effect=ZeroDivisionError("division by zero"),
        ):
            with self.assertRaises(ZeroDivisionError):
                appearance("1 > 0 ? 'btn-a' : 'btn-b'", {}, ["tier"], [])

    def test_a_string_that_is_not_an_expression_stays_literal(self):
        from polyspec.crudui.generator.design import appearance

        # "/" is not a token of the grammar, so the string is literal text.
        text = "(1 / 0) > 0 ? 'btn-a' : 'btn-b'"
        self.assertEqual(appearance(text, {}, ["tier"], []), text)


if __name__ == "__main__":
    unittest.main()
