"""Shared loading of the validation fixtures and failure records.

Every test reads the same `cases.json` the other language implementations
read, compares its results with the recorded expectations and fails for a
fixture that holds no case.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]


FIXTURES = ROOT / "legacy" / "tests" / "fixtures"

# The deepest fixture value nests 512 levels of containers and the traversal
# follows it; the default interpreter limit does not.
sys.setrecursionlimit(max(sys.getrecursionlimit(), 20000))


def cases_of(group, name="cases.json"):
    """The cases of one fixture group, or one operation of the text-validity group."""
    path = FIXTURES / group / name
    loaded = json.loads(path.read_text(encoding="utf-8"))
    if not loaded:
        raise AssertionError(f"{path.relative_to(ROOT)} holds no case")
    return loaded


def failure_record(error):
    """The cross-language failure record of a thrown validation failure."""
    from polyspec.crudui.validator import ComposeLoadError, FormInputError

    if isinstance(error, ComposeLoadError):
        return {"code": error.code, "message": str(error), "at": ".".join(error.trace)}
    if isinstance(error, FormInputError):
        return {"code": error.code, "message": str(error), "at": ""}
    return None


def add_case_tests(cls, group, check, name="cases.json"):
    """Give cls one test method per case of the fixture group, test_<case>, that calls check(test, case).

    The parity check reads each case by the name of its test method, and a test method that names no
    case is reported as not in the suite, so every case has a method of its own that runs the one
    assertion path of check.
    """
    for case in cases_of(group, name):

        def test(self, case=case):
            check(self, case)

        test.__name__ = f"test_{case['name']}"
        setattr(cls, test.__name__, test)
