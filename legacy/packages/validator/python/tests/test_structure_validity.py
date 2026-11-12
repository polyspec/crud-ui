"""The shared structure-validity fixtures against the Python validators.

`legacy/tests/fixtures/spec-validity/cases.json` runs each specification through
`validate` with empty data: an `engine: "pass"` case returns the clean result
and an `engine: {code, at}` case raises `ComposeLoadError` with that code and
dotted trace. The list and detail groups run the same contract through
`validateList` and `validateDetail`.
"""

import unittest


from .conformance import add_case_tests, cases_of
from polyspec.crudui.conformance import Proving
from polyspec.crudui.validator import (
    ComposeLoadError,
    validate,
    validateDetail,
    validateList,
)


def options_of(case):
    return {"files": case["files"]} if case.get("files") else {}


SPEC_CLEAN = {"valid": True, "errors": [], "hidden": []}
LOAD_CLEAN = {"valid": True, "errors": []}


def assert_load(test, case, run, clean, feature, fixture):
    """A clean specification returns the clean result; a failing one raises the recorded load failure."""
    with Proving([feature], fixture, case["name"]) as proof:
        if case["engine"] == "pass":
            test.assertEqual(run(case), clean)
        else:
            thrown = None
            try:
                run(case)
            except ComposeLoadError as error:
                thrown = error
            test.assertIsNotNone(thrown, f"{case['name']} must fail to load")
            test.assertEqual(thrown.code, case["engine"]["code"])
            # The depth is load-bearing, so the dotted trace is asserted, not
            # just the code.
            test.assertEqual(".".join(thrown.trace), case["engine"]["at"])
        proof.passed = True


def run_spec(case):
    # Data is irrelevant to the scan; the scan runs in the load path before
    # any data-driven validation.
    return validate(case["spec"], {}, options_of(case))


def run_list(case):
    return validateList(case["spec"], options_of(case))


def run_detail(case):
    return validateDetail(case["spec"], options_of(case))


def check_spec(test, case):
    assert_load(
        test,
        case,
        run_spec,
        SPEC_CLEAN,
        "validate",
        "legacy/tests/fixtures/spec-validity/cases.json",
    )


def check_list(test, case):
    assert_load(
        test,
        case,
        run_list,
        LOAD_CLEAN,
        "validateList",
        "legacy/tests/fixtures/list-validity/cases.json",
    )


def check_detail(test, case):
    assert_load(
        test,
        case,
        run_detail,
        LOAD_CLEAN,
        "validateDetail",
        "legacy/tests/fixtures/detail-validity/cases.json",
    )


class TestSpecValidityConformance(unittest.TestCase):
    """A forbidden meta key at any depth is a load failure; a clean spec validates empty data."""


add_case_tests(TestSpecValidityConformance, "spec-validity", check_spec)


class TestListValidityConformance(unittest.TestCase):
    """A list specification loads clean or raises the recorded load failure."""


add_case_tests(TestListValidityConformance, "list-validity", check_list)


class TestDetailValidityConformance(unittest.TestCase):
    """A detail specification loads clean or raises the recorded load failure."""


add_case_tests(TestDetailValidityConformance, "detail-validity", check_detail)


def assert_declares(test, cases):
    """Each case declares engine: pass, or the code and the trace of a load failure."""
    for case in cases:
        engine = case["engine"]
        ok = engine == "pass" or (
            isinstance(engine, dict)
            and isinstance(engine.get("code"), str)
            and isinstance(engine.get("at"), str)
        )
        test.assertTrue(ok, f"{case['name']} must declare engine: pass or code and at")


class TestStructureValidityFixtureCounts(unittest.TestCase):
    """Each structure-validity fixture declares an engine expectation per case and holds the recorded counts."""

    def test_spec_validity_counts(self):
        cases = cases_of("spec-validity")
        assert_declares(self, cases)
        self.assertEqual(len(cases), 37)
        self.assertEqual(len([case for case in cases if case["engine"] == "pass"]), 23)
        self.assertEqual(
            len([case for case in cases if isinstance(case["engine"], dict)]), 14
        )

    def test_list_validity_counts(self):
        cases = cases_of("list-validity")
        assert_declares(self, cases)
        self.assertEqual(len(cases), 20)
        self.assertEqual(len([case for case in cases if case["engine"] == "pass"]), 16)
        self.assertEqual(
            len([case for case in cases if isinstance(case["engine"], dict)]), 4
        )

    def test_detail_validity_counts(self):
        cases = cases_of("detail-validity")
        assert_declares(self, cases)
        self.assertEqual(len(cases), 13)
        self.assertEqual(len([case for case in cases if case["engine"] == "pass"]), 6)
        self.assertEqual(
            len([case for case in cases if isinstance(case["engine"], dict)]), 7
        )


if __name__ == "__main__":
    unittest.main()
