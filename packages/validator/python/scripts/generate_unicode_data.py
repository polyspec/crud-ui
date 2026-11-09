#!/usr/bin/env python3
"""Write the module polyspec.crudui.validator.unicode_data from contracts/unicode-properties.json.

    python3 packages/validator/python/scripts/generate_unicode_data.py

make python-tables runs it before every target that reads packages/validator/python; the
output is untracked (P34).

Ranges are written as flat [start, end, start, end, ...] lists of inclusive code
points. test_unicode_data fails when the written data differs from the contract.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CONTRACT = ROOT / "contracts" / "unicode-properties.json"
TARGET = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "polyspec"
    / "crudui"
    / "validator"
    / "unicode_data.py"
)


def flat(ranges, indent):
    """One number on each line, the layout that ruff format gives a list longer than a line."""
    numbers = [value for pair in ranges for value in pair]
    lines = [f"{indent}    {number}," for number in numbers]
    return "[\n" + "\n".join(lines) + "\n" + indent + "]"


def table(mapping):
    return "\n".join(
        f"    {json.dumps(name)}: {flat(ranges, '    ')},"
        for name, ranges in mapping.items()
    )


def main():
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    body = f'''"""Unicode {contract["unicodeVersion"]} data of the CRUDUI pattern language and value definitions.

Generated from contracts/unicode-properties.json by
`python3 packages/validator/python/scripts/generate_unicode_data.py`. Do not edit;
test_unicode_data fails when this data differs from the contract.

Every list is flat inclusive ranges: [start, end, start, end, ...].
"""

UNICODE_VERSION = {json.dumps(contract["unicodeVersion"])}

WHITE_SPACE = {flat(contract["whiteSpace"], "")}

GENERAL_CATEGORIES = {{
{table(contract["generalCategories"])}
}}

SCRIPTS = {{
{table(contract["scripts"])}
}}
'''
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(body, encoding="utf-8")
    print(f"wrote {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
