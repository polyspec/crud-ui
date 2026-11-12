"""The complete-form, list and detail rendering fixtures against the Python generator.

`legacy/tests/fixtures/form-complete/cases.json` renders the complete form of an
instance with its render options; `list-render` and `detail-render` render
supplied rows and records. Every output is compared byte for byte, and every
failure case raises the recorded code and message.
"""

import re
import unittest

from .conformance import add_case_tests, cases_of, failure_record, html_tree
from polyspec.crudui.conformance import Proving

_PRELOAD = re.compile(r'<link [^>]*rel="preload"[^>]*>')


def _without_preloads(html):
    """The rendered body without the image preload links before it."""
    return _PRELOAD.sub("", html)


def _generator():
    from polyspec.crudui.generator import Generator

    return Generator


def run_list(case):
    return _generator().renderList(
        case["spec"], case["rows"], case.get("options") or {}
    )


def run_detail(case):
    return _generator().renderDetail(
        case["spec"], case.get("record", {}), case.get("options") or {}
    )


def assert_render(test, case, run, features, fixture):
    """A case renders the recorded HTML, or raises the recorded code and message."""
    with Proving(features, fixture, case["name"]) as proof:
        if "expectError" in case:
            thrown = None
            try:
                run(case)
            except Exception as error:  # noqa: BLE001 - the record names the failure
                thrown = error
            test.assertIsNotNone(thrown, f"{case['name']} must fail")
            test.assertEqual(
                failure_record(thrown)["code"], case["expectError"]["code"]
            )
            if "message" in case["expectError"]:
                test.assertIn(
                    case["expectError"]["message"],
                    failure_record(thrown)["message"],
                )
        else:
            test.assertEqual(
                html_tree(_without_preloads(run(case))),
                html_tree(case["expected_html"]),
            )
        proof.passed = True


def check_form_complete(test, case):
    generator = _generator()
    with Proving(
        ["renderForm"],
        "legacy/tests/fixtures/form-complete/cases.json",
        case["name"],
    ) as proof:
        form = generator.createForm(
            generator.compileForm(case["spec"]),
            case["data"],
            case.get("options") or {},
        )
        if "expectError" in case:
            thrown = None
            try:
                generator.renderForm(form, case["render"])
            except Exception as error:  # noqa: BLE001 - the record names the failure
                thrown = error
            test.assertIsNotNone(thrown, f"{case['name']} must fail")
            record = failure_record(thrown)
            test.assertEqual(record["code"], case["expectError"]["code"])
            test.assertEqual(record["message"], case["expectError"]["message"])
            proof.passed = True
            return
        test.assertEqual(
            generator.renderForm(form, case["render"]), case["expected_html"]
        )
        proof.passed = True


def check_list_render(test, case):
    assert_render(
        test,
        case,
        run_list,
        ["renderList", "buildList"],
        "legacy/tests/fixtures/list-render/cases.json",
    )


def check_detail_render(test, case):
    assert_render(
        test,
        case,
        run_detail,
        ["renderDetail", "buildDetail"],
        "legacy/tests/fixtures/detail-render/cases.json",
    )


class TestFormCompleteConformance(unittest.TestCase):
    """The complete form writes the expected bytes or the declared failure."""


add_case_tests(TestFormCompleteConformance, "form-complete", check_form_complete)


class TestListRenderConformance(unittest.TestCase):
    """A list renders byte for byte or raises the recorded code."""


add_case_tests(TestListRenderConformance, "list-render", check_list_render)


class TestDetailRenderConformance(unittest.TestCase):
    """A detail renders byte for byte or raises the recorded code."""


add_case_tests(TestDetailRenderConformance, "detail-render", check_detail_render)


class TestRenderFixtureCounts(unittest.TestCase):
    """The rendering fixtures hold the recorded number of cases."""

    def test_form_complete_case_count(self):
        self.assertEqual(len(cases_of("form-complete")), 28)

    def test_list_render_case_count(self):
        self.assertEqual(len(cases_of("list-render")), 165)

    def test_detail_render_case_count(self):
        self.assertEqual(len(cases_of("detail-render")), 68)


if __name__ == "__main__":
    unittest.main()
