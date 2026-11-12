"""The structure map fixtures against the Python generator.

Every case of `legacy/tests/fixtures/form-outline/cases.json` compiles and binds
through the public operations, and `buildOutline` reproduces the recorded rows
with the members in the recorded order.
"""

import json
import unittest

from .conformance import add_case_tests, cases_of
from polyspec.crudui.conformance import Proving


def check_case(test, case):
    from polyspec.crudui.generator import Generator

    with Proving(
        ["compileForm", "bindForm", "buildOutline"],
        "legacy/tests/fixtures/form-outline/cases.json",
        case["name"],
    ) as proof:
        options = case.get("options") or {}
        template = Generator.compileForm(case["spec"], options)
        nodes = Generator.bindForm(template, case.get("data") or {}, options)
        actual = Generator.buildOutline(nodes)
        test.assertEqual(json.dumps(actual), json.dumps(case["expected_outline_rows"]))
        proof.passed = True


class TestOutlineConformance(unittest.TestCase):
    """The rows of the structure map match the shared fixture."""


add_case_tests(TestOutlineConformance, "form-outline", check_case)


class TestOutlineFixtureCount(unittest.TestCase):
    """The form-outline fixture holds the recorded number of cases."""

    def test_case_count(self):
        self.assertEqual(len(cases_of("form-outline")), 5)
