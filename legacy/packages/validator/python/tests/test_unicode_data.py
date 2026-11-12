import json
import unittest

from .conformance import ROOT
from polyspec.crudui.validator import unicode_data


def flat(ranges):
    return [value for pair in ranges for value in pair]


class TestUnicodeData(unittest.TestCase):
    """The generated module holds the data of contracts/unicode-properties.json."""

    def test_the_module_holds_the_contract(self):
        """CUVR-018: the module holds the data of contracts/unicode-properties.json."""
        contract = json.loads(
            (ROOT / "contracts" / "unicode-properties.json").read_text(encoding="utf-8")
        )
        self.assertEqual(unicode_data.UNICODE_VERSION, contract["unicodeVersion"])
        self.assertEqual(unicode_data.WHITE_SPACE, flat(contract["whiteSpace"]))
        for name, table in (
            ("generalCategories", unicode_data.GENERAL_CATEGORIES),
            ("scripts", unicode_data.SCRIPTS),
        ):
            self.assertEqual(
                table, {key: flat(value) for key, value in contract[name].items()}
            )


if __name__ == "__main__":
    unittest.main()
