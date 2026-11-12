"""The shared expression fixtures against the Python parser and evaluator.

Every case of `legacy/tests/fixtures/expr/cases.json` parses to the recorded tokens
and syntax tree (positions excluded) and evaluates each recorded data context
to the recorded value and truthiness; a rejected expression reproduces the
first line of the recorded error message.
"""

import unittest


from .conformance import add_case_tests, cases_of
from polyspec.crudui.conformance import Proving
from polyspec.crudui.validator.parser import ParseError, parse_condition
from polyspec.crudui.validator.resolver import (
    evaluate_condition,
    evaluate_expression_value,
)


def _strip(value):
    """Drop the position of a token or syntax tree node."""
    if isinstance(value, dict):
        return {key: _strip(item) for key, item in value.items() if key != "position"}
    if isinstance(value, list):
        return [_strip(item) for item in value]
    return value


class TestExprConformance(unittest.TestCase):
    """Tokens, trees and evaluation results reproduce the fixture; errors their message."""

    def check_case(self, case):
        with Proving(
            ["validate"], "legacy/tests/fixtures/expr/cases.json", case["name"]
        ) as proof:
            if "tokens" in case:
                self.check_accepted(case)
            else:
                self.check_rejected(case)
            proof.passed = True

    def check_accepted(self, case):
        tokens = _parse_tokens(case["expr"])
        self.assertEqual(
            [_strip(token) for token in tokens], case["tokens"], case["expr"]
        )
        ast = parse_condition(case["expr"])
        self.assertEqual(_strip(ast), case["ast"], case["expr"])
        for recorded in case["cases"]:
            context = {
                "currentPath": recorded.get("currentPath") or [],
                "rowKeys": recorded.get("rowKeys") or [],
                "formData": recorded["data"],
            }
            value = evaluate_expression_value(ast, context, "CURRENT")
            self.assertEqual(_comparable(value), _comparable(recorded["value"]))
            self.assertEqual(
                evaluate_condition(ast, context, "CURRENT"), recorded["truthy"]
            )

    def check_rejected(self, case):
        thrown = None
        try:
            parse_condition(case["expr"])
        except ParseError as error:
            thrown = error
        self.assertIsNotNone(thrown, f"{case['expr']} must not parse")
        self.assertEqual(str(thrown).split("\n")[0], case["error"])


add_case_tests(TestExprConformance, "expr", TestExprConformance.check_case)


class TestExprFixtureCounts(unittest.TestCase):
    """The shape of the expression fixture: one expectation per case, and the counts of each kind."""

    def setUp(self):
        self.cases = cases_of("expr")
        self.accepted = [case for case in self.cases if "tokens" in case]
        self.rejected = [case for case in self.cases if "error" in case]

    def test_every_case_declares_exactly_one_expectation(self):
        for case in self.cases:
            exclusive = ("tokens" in case) != ("error" in case)
            self.assertTrue(exclusive, f"{case['name']} must declare tokens or error")
        self.assertEqual(len(self.cases), 74)

    def test_accepted_and_rejected_case_counts(self):
        self.assertEqual(len(self.accepted), 67)
        self.assertEqual(len(self.rejected), 7)


def _comparable(value):
    """A number compares numerically whatever integer or float writes it."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return float(value)
    return value


def _parse_tokens(expression):
    from polyspec.crudui.validator.parser import _Lexer

    return _Lexer(expression).tokenize()


if __name__ == "__main__":
    unittest.main()
