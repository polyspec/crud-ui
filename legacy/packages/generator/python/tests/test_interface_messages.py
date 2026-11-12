"""The interface message tables of the Python generator equal contracts/interface-messages.json.

`interface_messages.py` embeds the form and list tables that the contract defines for every language; this test fails
when the embedded text differs from the contract, and the generator script rewrites it (the Go test does the same), CUMK-065.
"""

import json
import unittest

from polyspec.crudui.generator.interface_messages import FORM, LIST

from .conformance import ROOT


class TestInterfaceMessagesMatchContract(unittest.TestCase):
    """The embedded tables hold exactly the languages and the text of the contract."""

    def test_embedded_messages_equal_the_contract(self):
        contract = json.loads(
            (ROOT / "contracts" / "interface-messages.json").read_text(encoding="utf-8")
        )
        for name, embedded, table in (
            ("form", FORM, contract["form"]),
            ("list", LIST, contract["list"]),
        ):
            with self.subTest(table=name):
                self.assertEqual(sorted(embedded), sorted(table))
                for language, messages in table.items():
                    self.assertEqual(embedded[language], messages, language)


if __name__ == "__main__":
    unittest.main()
