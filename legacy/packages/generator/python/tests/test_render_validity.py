"""The list-validity cases against the Python generator (docs/spec/display-formats.md, CUDF-036 to CUDF-062).

Each case of legacy/tests/fixtures/list-validity is one test method `test_<case>` of TestListRenderValidity (the list-render-validity
unit), which calls Generator.buildList; the outcome is checked by conformance.check_validity.
"""

import unittest

from .conformance import add_case_tests, check_validity
from polyspec.crudui.generator import Generator


class TestListRenderValidity(unittest.TestCase):
    """Each list-validity case through Generator.buildList."""


add_case_tests(
    TestListRenderValidity,
    "list-validity",
    lambda test, case: check_validity(
        test,
        case,
        lambda spec, files: Generator.buildList(spec, [], {"files": files}),
    ),
)


if __name__ == "__main__":
    unittest.main()
