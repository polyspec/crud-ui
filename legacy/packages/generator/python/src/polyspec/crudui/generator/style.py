"""Parse CSS declarations without splitting quoted or nested values."""

import re

__all__ = ["canonical", "declarations", "rendered"]

_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)


def declarations(style: str) -> list[tuple[str, str]]:
    """Complete property and value pairs in declaration order."""
    out: list[tuple[str, str]] = []
    start = 0
    colon = None
    quote = None
    escape = False
    comment = False
    stack: list[str] = []
    length = len(style)

    def finish(end: int) -> None:
        nonlocal start, colon
        if colon is not None:
            prop = _COMMENT.sub(" ", style[start:colon]).strip()
            value = style[colon + 1 : end].strip()
            if prop != "" and value != "":
                out.append((prop, value))
        start = end + 1
        colon = None

    index = 0
    while index < length:
        char = style[index]
        following = style[index + 1] if index + 1 < length else ""
        if comment:
            if char == "*" and following == "/":
                comment = False
                index += 1
            index += 1
            continue
        if escape:
            escape = False
            index += 1
            continue
        if char == "\\":
            escape = True
            index += 1
            continue
        if quote is not None:
            if char == quote:
                quote = None
            index += 1
            continue
        if char == "/" and following == "*":
            comment = True
            index += 2
            continue
        if char in ('"', "'"):
            quote = char
            index += 1
            continue
        if char in "([{":
            stack.append(char)
            index += 1
            continue
        if char in ")]}":
            if stack and {"(": ")", "[": "]", "{": "}"}[stack[-1]] == char:
                stack.pop()
            index += 1
            continue
        if stack:
            index += 1
            continue
        if char == ":" and colon is None:
            colon = index
            index += 1
            continue
        if char == ";":
            finish(index)
        index += 1
    finish(length)
    return out


def canonical(style: object) -> str | None:
    """Declaration spacing normalized, values and duplicate properties retained."""
    if not isinstance(style, str):
        return None
    parsed = declarations(style)
    if not parsed:
        return None
    return "; ".join(f"{prop}: {value}" for prop, value in parsed)


def _dash_lower(match: re.Match[str]) -> str:
    return match.group(1).upper()


def _dash_property(match: re.Match[str]) -> str:
    return "-" + match.group(0).lower()


def rendered(style: object) -> str | None:
    """Final property values in their first insertion order."""
    if not isinstance(style, str):
        return None
    properties: dict[str, str] = {}
    for prop, value in declarations(style):
        if not prop.startswith("--"):
            key = re.sub("-([a-z])", _dash_lower, prop)
            prop = re.sub("[A-Z]", _dash_property, key)
            if prop.startswith("ms-"):
                prop = "-" + prop
        properties[prop] = value
    if not properties:
        return None
    return ";".join(f"{key}:{value}" for key, value in properties.items())
