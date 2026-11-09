#!/usr/bin/env python3
"""Write the module polyspec.crudui.generator.interface_messages from contracts/interface-messages.json.

python3 packages/generator/python/scripts/generate_interface_messages.py

make python-tables runs it before every target that reads packages/generator/python; the
output is untracked (P34).
"""

import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CONTRACT = ROOT / "contracts" / "interface-messages.json"
TARGET = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "polyspec"
    / "crudui"
    / "generator"
    / "interface_messages.py"
)


# The line length of ruff format; a table of a language that does not fit on one line takes one line for each message,
# the layout that ruff format gives it. ruff measures a line by its display width: a wide character counts 2.
LINE_LENGTH = 88


def width(text):
    return sum(2 if unicodedata.east_asian_width(char) in "WF" else 1 for char in text)


def table(messages, indent):
    lines = []
    for language, entries in messages.items():
        pairs = [
            f"{json.dumps(key, ensure_ascii=False)}: {json.dumps(value, ensure_ascii=False)}"
            for key, value in entries.items()
        ]
        line = f"{indent}    {json.dumps(language)}: {{{', '.join(pairs)}}},"
        if width(line) > LINE_LENGTH:
            line = "\n".join(
                [f"{indent}    {json.dumps(language)}: {{"]
                + [f"{indent}        {pair}," for pair in pairs]
                + [f"{indent}    }},"]
            )
        lines.append(line)
    return "\n".join(lines)


def main():
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    if contract.get("format") != "crudui/interface-messages":
        raise SystemExit("Unexpected contract format")
    body = f'''"""Interface message tables of every supported language.

Generated from contracts/interface-messages.json by
`python3 packages/generator/python/scripts/generate_interface_messages.py`.
Do not edit; test_interface_messages fails when this data differs from the
contract.

`FORM` holds the interface text of form controls, counts and summaries, where
`{{count}}` is replaced with a number. `LIST` holds the labels of the list
pagination buttons, where `{{page}}` is replaced with a page number, and the
text of the empty list.
"""

FORM = {{
{table(contract["form"], "")}
}}

LIST = {{
{table(contract["list"], "")}
}}
'''
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(body, encoding="utf-8")
    print(f"wrote {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
