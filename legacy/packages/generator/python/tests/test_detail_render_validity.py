"""The detail-validity cases against the Python generator (docs/spec/display-formats.md, CUDF-036 to CUDF-062).

Each case of legacy/tests/fixtures/detail-validity is one test method `test_<case>` of TestDetailRenderValidity (the
detail-render-validity unit), which calls Generator.buildDetail; the outcome is checked by conformance.check_validity.
"""

import unittest

from .conformance import add_case_tests, check_validity
from polyspec.crudui.generator import Generator


class TestDetailRenderValidity(unittest.TestCase):
    """Each detail-validity case through Generator.buildDetail."""


add_case_tests(
    TestDetailRenderValidity,
    "detail-validity",
    lambda test, case: check_validity(
        test,
        case,
        lambda spec, files: Generator.buildDetail(spec, {}, {"files": files}),
    ),
)


if __name__ == "__main__":
    unittest.main()
