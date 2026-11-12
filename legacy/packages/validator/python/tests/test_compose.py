"""The shared composition fixtures against the Python compose engine.

Every case of `legacy/tests/fixtures/compose/cases.json` composes its entry through
`compose_properties` or `compose_spec` with the recorded files and basepath:
a result case reproduces the composed map (compared with sorted member names,
which the other harnesses canonicalize the same way; arrays keep their order),
and an error case raises `ComposeLoadError` with the recorded code.
"""

import unittest


from .conformance import add_case_tests, cases_of
from polyspec.crudui.conformance import Proving
from polyspec.crudui.validator.compose import (
    MemoryLoader,
    compose_properties,
    compose_root,
    compose_spec,
)
from polyspec.crudui.validator.compose_errors import ComposeLoadError


def canon(value):
    """Sorted member names at every depth, for order-insensitive comparison."""
    if isinstance(value, list):
        return [canon(item) for item in value]
    if isinstance(value, dict):
        return {key: canon(value[key]) for key in sorted(value)}
    return value


def run_case(case):
    source = case["input"]
    loader = MemoryLoader(source.get("files") or {})
    opts = {"basepath": source["basepath"]} if source.get("basepath") else {}
    entry = source["entry"]
    if source.get("kind", "properties") == "spec":
        return compose_spec(entry, loader, opts)
    return compose_properties(entry, loader, opts)


def check_case(test, case):
    """A result case reproduces the composed map; an error case raises the recorded code."""
    if "expected" in case:
        with Proving(
            ["compileForm"], "legacy/tests/fixtures/compose/cases.json", case["name"]
        ) as proof:
            test.assertEqual(canon(run_case(case)), canon(case["expected"]))
            proof.passed = True
        return
    with Proving(
        ["compileForm"], "legacy/tests/fixtures/compose/cases.json", case["name"]
    ) as proof:
        thrown = None
        try:
            run_case(case)
        except ComposeLoadError as error:
            thrown = error
        test.assertIsNotNone(thrown, f"{case['name']} must fail to load")
        test.assertEqual(thrown.code, case["expectError"]["code"])
        proof.passed = True


class TestComposeConformance(unittest.TestCase):
    """Composed maps reproduce the fixture; failures raise the recorded code."""


add_case_tests(TestComposeConformance, "compose", check_case)


class TestComposeFixtureCounts(unittest.TestCase):
    """The compose fixture declares exactly one expectation per case and holds the recorded counts."""

    def setUp(self):
        self.cases = cases_of("compose")

    def test_every_case_declares_exactly_one_expectation(self):
        for case in self.cases:
            exclusive = ("expected" in case) != ("expectError" in case)
            self.assertTrue(
                exclusive, f"{case['name']} must declare expected or expectError"
            )
        self.assertEqual(len(self.cases), 20)

    def test_result_case_count(self):
        results = [case for case in self.cases if "expected" in case]
        self.assertEqual(len(results), 13)

    def test_error_case_count(self):
        errors = [case for case in self.cases if "expectError" in case]
        self.assertEqual(len(errors), 7)


class TestNullPatch(unittest.TestCase):
    """A `$patch` of null is a shape error at every entry, as in the other runtimes."""

    def test_every_entry_rejects_a_null_patch(self):
        loader = MemoryLoader({})
        for compose in (compose_properties, compose_spec, compose_root):
            with self.subTest(entry=compose.__name__):
                with self.assertRaises(ComposeLoadError) as raised:
                    compose({"$patch": None}, loader)
                self.assertEqual(raised.exception.code, "PATCH_SHAPE")


if __name__ == "__main__":
    unittest.main()
