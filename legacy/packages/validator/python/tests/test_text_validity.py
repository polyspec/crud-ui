"""The input text fixtures against the Python validators.

Every case of the `validate`, `validateList` and `validateDetail` files of
`legacy/tests/fixtures/text-validity` runs with its specification, files, data and
options decoded from JSON text that writes unpaired surrogates as escapes: a
Python string keeps the escape as a lone surrogate code unit, so the input
text check rejects it. The value graphs of `value-graphs.json` are built with
shared and self-containing containers, which Python values can hold.

Each case either throws the recorded failure `{code, message, at}` or returns
the recorded result. CUIT-041: a load failure is a ComposeLoadError and an input
failure is a FormInputError, and each case asserts the class it throws.
"""

import unittest


from .conformance import add_case_tests, cases_of, failure_record
from polyspec.crudui.conformance import Proving
from polyspec.crudui.validator import (
    ComposeLoadError,
    FormInputError,
    validate,
    validateDetail,
    validateList,
)

ENTRIES = {
    "validate": lambda spec, data, options: validate(spec, data, options),
    "validateList": lambda spec, data, options: validateList(spec, options),
    "validateDetail": lambda spec, data, options: validateDetail(spec, options),
}


def native_type(expect):
    """The class that an expectation names (CUIT-041): a load failure is a ComposeLoadError, an input failure a FormInputError."""
    if isinstance(expect, dict) and expect.get("code") == "INVALID_TEXT":
        return "ComposeLoadError"
    if isinstance(expect, dict) and expect.get("code") == "INVALID_FORM_INPUT":
        return "FormInputError"
    return "none"


def run_case(case, entry):
    """The record of a run and the class of the error it throws, or 'none'."""
    options = {}
    if case.get("files") is not None:
        options["files"] = case["files"]
    if case.get("options", {}).get("basepath") is not None:
        options["basepath"] = case["options"]["basepath"]
    data = case.get("data", {}) if "data" in case else {}
    try:
        result = entry(case["spec"], data, options)
    except (ComposeLoadError, FormInputError) as error:
        return failure_record(error), type(error).__name__
    if "hidden" in result:
        return {
            "valid": result["valid"],
            "errors": result["errors"],
            "hidden": result["hidden"],
        }, "none"
    return {"valid": result["valid"], "errors": result["errors"]}, "none"


def build_graph(graph):
    """The placement path and the value a graph case describes, with shared containers."""
    shape = graph["shape"]
    if shape == "self-twice":
        loop = {}
        loop["self"] = loop
        loop["again"] = loop
        return graph["at"], loop
    size = graph["size"]
    leaf = graph["leaf"]
    if shape == "flat":
        return graph["at"], [leaf] * size
    value = leaf
    for _ in range(size):
        value = [value, value] if shape == "doubled" else [value]
    return graph["at"], value


def assert_outcome(test, case, entry):
    """The record of the run is the expectation, and the class it throws is the class that the expectation names."""
    record, native = run_case(case, entry)
    test.assertEqual(record, case["expect"])
    test.assertEqual(native, native_type(case["expect"]))


def check_validate(test, case):
    with Proving(
        ["validate"],
        "legacy/tests/fixtures/text-validity/validate/cases.json",
        case["name"],
    ) as proof:
        assert_outcome(test, case, ENTRIES["validate"])
        proof.passed = True


def check_validate_list(test, case):
    with Proving(
        ["validateList"],
        "legacy/tests/fixtures/text-validity/validateList/cases.json",
        case["name"],
    ) as proof:
        assert_outcome(test, case, ENTRIES["validateList"])
        proof.passed = True


def check_validate_detail(test, case):
    with Proving(
        ["validateDetail"],
        "legacy/tests/fixtures/text-validity/validateDetail/cases.json",
        case["name"],
    ) as proof:
        assert_outcome(test, case, ENTRIES["validateDetail"])
        proof.passed = True


def check_value_graph(test, case):
    spec = case["spec"]
    data = case["data"]
    files = case.get("files")
    options = {"files": files} if files is not None else {}
    path, graph = build_graph(case["graph"])
    member = path[-1]
    if path[0] == "spec":
        spec[member] = graph
    elif path[0] == "files":
        options["files"][path[1]][member] = graph
    else:
        data[member] = graph
    assert_outcome(
        test,
        {"spec": spec, "data": data, **options, "expect": case["expect"]},
        ENTRIES["validate"],
    )


class TestTextValidityValidateConformance(unittest.TestCase):
    """Each case of the validate file keeps the input text rule of the validate operation."""


add_case_tests(
    TestTextValidityValidateConformance, "text-validity/validate", check_validate
)


class TestTextValidityValidateListConformance(unittest.TestCase):
    """Each case of the validateList file keeps the input text rule of the list operation."""


add_case_tests(
    TestTextValidityValidateListConformance,
    "text-validity/validateList",
    check_validate_list,
)


class TestTextValidityValidateDetailConformance(unittest.TestCase):
    """Each case of the validateDetail file keeps the input text rule of the detail operation."""


add_case_tests(
    TestTextValidityValidateDetailConformance,
    "text-validity/validateDetail",
    check_validate_detail,
)


class TestTextValidityValueGraphsConformance(unittest.TestCase):
    """Each shared-container graph of the value graph file keeps the input text rule of validate."""


add_case_tests(
    TestTextValidityValueGraphsConformance,
    "text-validity",
    check_value_graph,
    name="value-graphs.json",
)


class TestTextValidityFixtureCounts(unittest.TestCase):
    """The text-validity fixture of each operation holds the recorded number of cases."""

    def test_validate_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "validate/cases.json")), 21)

    def test_validate_list_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "validateList/cases.json")), 6)

    def test_validate_detail_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "validateDetail/cases.json")), 5)

    def test_value_graph_case_count(self):
        self.assertEqual(len(cases_of("text-validity", "value-graphs.json")), 12)


if __name__ == "__main__":
    unittest.main()
