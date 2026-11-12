"""Preserve JSON values and resolve form paths and presentation strings.

An absent value is the `MISSING` marker, distinct from an explicit `None`.
Objects are dictionaries and arrays are lists; a value copy keeps every object
and array type and rejects a value that a JSON document cannot hold.
"""

import re
import urllib.parse
from collections.abc import Collection
from typing import Any, TypeAlias, TypeGuard, TypeVar, Union

from polyspec.crudui.validator.jsvalue import JsonValue, ordered_value

from .errors import FormError
from .numbers import number_string
from .style import canonical

__all__ = [
    "MISSING",
    "classes",
    "control_id",
    "copy_value",
    "display",
    "element_id",
    "get",
    "leaf",
    "name",
    "object_value",
    "path",
    "record",
    "rule",
    "scalar",
    "segments",
    "spec_value",
    "string",
    "translate",
    "truthy",
]


class _Missing:
    """The absent value: a marker distinct from every JSON value, including null."""


MISSING = _Missing()

# A value of a form path: a JSON value, or the absent marker.
Value: TypeAlias = Union[JsonValue, _Missing]

_T = TypeVar("_T")

NESTING_LIMIT = 512
NODE_LIMIT = 1_000_000


def _is_object(value: object) -> TypeGuard[dict[str, Any]]:
    return isinstance(value, dict)


def _is_json_value(value: object, depth: int, nodes: list[int]) -> None:
    """Check one value against the JSON shapes and the value limits."""
    nodes[0] += 1
    if nodes[0] > NODE_LIMIT:
        raise ValueError("Recursive or excessively nested value")
    if depth >= NESTING_LIMIT and isinstance(value, (list, dict)):
        raise ValueError("Recursive or excessively nested value")
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str):
                raise ValueError("Object keys must be strings")
            _is_json_value(child, depth + 1, nodes)
        return
    if isinstance(value, list):
        for child in value:
            _is_json_value(child, depth + 1, nodes)
        return
    if value is None or isinstance(value, (str, bool)):
        return
    if isinstance(value, int):
        return
    if (
        isinstance(value, float)
        and value == value
        and value not in (float("inf"), float("-inf"))
    ):
        return
    raise ValueError(f"Unsupported value: {type(value).__name__}")


def _checked(value: _T, message: None) -> _T:
    nodes = [0]
    try:
        _is_json_value(value, 0, nodes)
    except ValueError as error:
        raise FormError("INVALID_FORM_INPUT", str(error)) from None
    return value


def _copy(value: JsonValue) -> JsonValue:
    """A detached copy while preserving object and array types."""
    return _checked(_deep_copy(value), None)


def _deep_copy(value: JsonValue) -> JsonValue:
    if isinstance(value, dict):
        return {key: _deep_copy(child) for key, child in value.items()}
    if isinstance(value, list):
        return [_deep_copy(child) for child in value]
    return value


def object_value(value: object) -> dict[str, JsonValue]:
    """A root record as a JSON object: a dictionary, never a list."""
    if isinstance(value, list) or not _is_object(value):
        raise FormError("INVALID_FORM_INPUT", "Expected an object")
    copied = _copy(value)
    assert isinstance(copied, dict)  # an object copy stays an object
    return copied


def spec_value(value: object) -> dict[str, JsonValue]:
    """A root specification or template in specification member order."""
    ordered = ordered_value(object_value(value))
    assert isinstance(ordered, dict)  # an object stays an object
    return ordered


def copy_value(value: JsonValue) -> JsonValue:
    """A detached JSON value while preserving object and array types."""
    return _checked(_deep_copy(value), None)


def get(value: Value, key: str) -> Value:
    """One own member, or the missing-value marker."""
    if isinstance(value, dict):
        return value[key] if key in value else MISSING
    return MISSING


def path(value: Value, path_text: str) -> Value:
    """A value through bracket or dot path segments."""
    for part in segments(path_text):
        value = get(value, part)
    return value


def segments(path_text: str) -> list[str]:
    """Split a value path while retaining dots inside brackets."""
    parts = []
    current = ""
    bracket = False
    for character in path_text:
        if (
            (character == "[" and not bracket)
            or (character == "]" and bracket)
            or (character == "." and not bracket)
        ):
            if current != "":
                parts.append(current)
            current = ""
            if character == "[":
                bracket = True
            elif character == "]":
                bracket = False
        else:
            current += character
    if current != "":
        parts.append(current)
    return parts


def scalar(value: object) -> str:
    """A scalar value for a form control; objects, arrays and null are empty."""
    if value is MISSING or value is None or isinstance(value, (list, dict)):
        return ""
    if isinstance(value, bool):
        return "1" if value else ""
    if isinstance(value, float):
        return number_string(value)
    return str(value)


def string(value: object) -> str:
    """A value as expression string conversion writes it."""
    if value is MISSING:
        return "undefined"
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        return ",".join("" if item is None else string(item) for item in value)
    if isinstance(value, dict):
        return "[object Object]"
    if isinstance(value, float):
        return number_string(value)
    return str(value)


def truthy(value: object) -> bool:
    """Condition truthiness with empty collections true."""
    return (
        value is not MISSING
        and value is not None
        and value is not False
        and value != ""
        and value != 0
    )


_SHORT_ESCAPES = {
    '"': '\\"',
    "\\": "\\\\",
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
}


def condition(value: Value) -> str:
    """The condition text of a condition field value (docs/spec/form-markup.md, Condition fields).

    A string is itself, null and an absent value are empty, and any other value is the JSON text
    that ECMAScript's JSON.stringify writes for it.
    """
    if value is MISSING or value is None:
        return ""
    if isinstance(value, str):
        return value
    return _condition_json(value)


def _condition_json(value: object) -> str:
    """The JSON.stringify text of a JSON value: members in order, no whitespace, ECMAScript numbers."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return number_string(float(value))
    if isinstance(value, str):
        return _condition_string(value)
    if isinstance(value, list):
        return "[" + ",".join(_condition_json(item) for item in value) + "]"
    if isinstance(value, dict):
        members = (
            f"{_condition_string(key)}:{_condition_json(item)}"
            for key, item in value.items()
        )
        return "{" + ",".join(members) + "}"
    raise FormError(
        "INVALID_FORM_INPUT", f"Unsupported condition value: {type(value).__name__}"
    )


def _condition_string(text: str) -> str:
    """A string as JSON.stringify quotes it: controls and unpaired surrogates as \\u escapes."""
    out = ['"']
    for character in text:
        code = ord(character)
        if character in _SHORT_ESCAPES:
            out.append(_SHORT_ESCAPES[character])
        elif code < 0x20 or 0xD800 <= code <= 0xDFFF:
            out.append(f"\\u{code:04x}")
        else:
            out.append(character)
    out.append('"')
    return "".join(out)


def display(value: Value, default: Value) -> str:
    """The default only when the field value is absent."""
    return scalar(
        default
        if value is MISSING
        and default is not None
        and not isinstance(default, (list, dict))
        else value
    )


def name(path_text: str, prefix: str | None = None) -> str:
    """A field path as a bracketed submission name."""
    parts = segments(path_text)
    if prefix:
        parts.insert(0, prefix)
    if not parts:
        return f"{prefix}[]" if prefix else ""
    return parts[0] + "".join(f"[{part}]" for part in parts[1:])


def rule(path_text: str, rows: Collection[int]) -> str:
    """A validation rule name with anonymous repeated segments."""
    suffix = "[]" if path_text.endswith("[]") else ""
    parts = segments(path_text)
    out = parts[0] if parts else ""
    for index, part in enumerate(parts[1:]):
        out += "[]" if index + 1 in rows else f"[{part}]"
    return out + suffix


def leaf(path_text: str, rows: Collection[int]) -> str:
    """The final field name, including repeated-value notation."""
    parts = segments(path_text)
    last = parts[-1] if parts else ""
    return f"{parts[-2]}[]" if len(parts) >= 2 and len(parts) - 1 in rows else last


_SAFE_ID = re.compile("^[A-Za-z0-9_-]$")


def element_id(prefix: str, path_text: str) -> str:
    """A field path as a structural element identifier."""
    clean = (
        path_text.replace("[]", "")
        .replace("][", "-")
        .replace("[", "-")
        .replace("]", "-")
    )
    base = "".join(
        character if ord(character) < 128 and _SAFE_ID.match(character) else "-"
        for character in clean
    )
    return f"{prefix}-{base}" if prefix != "" else base


def control_id(prefix: str, path_text: str) -> str:
    """The instance prefix and complete field path as a control identifier."""
    return f"{_encode(prefix)}:{_encode(path_text)}"


def _encode(value: str) -> str:
    quoted = urllib.parse.quote(value, safe="")
    return (
        quoted.replace("%21", "!")
        .replace("%27", "'")
        .replace("%28", "(")
        .replace("%29", ")")
        .replace("%2A", "*")
    )


def classes(*parts: str | None) -> str:
    """Class strings joined with normalized whitespace."""
    return re.sub(r"\s+", " ", " ".join(part for part in parts if part)).strip()


def translate(text: JsonValue, language: str, default: str = "") -> str:
    """Content: a string is itself; a language map yields its first non-empty entry.

    The language, then `en`, then `ko`, then the first key supply the entry; any
    other value, a list included, is the default.
    """
    if isinstance(text, str):
        return text
    if not _is_object(text):
        return default
    keys = [language, "en", "ko", next(iter(text), None)]
    for key in keys:
        entry = text.get(key) if key is not None else None
        if isinstance(entry, str) and entry != "":
            return entry
    return default


def style_value(style: object) -> str | None:
    """A declared style normalized for the evaluated model."""
    return canonical(style)


def record(members: dict[str, Value]) -> dict[str, Value]:
    """An object without the members marked absent."""
    return {key: value for key, value in members.items() if value is not MISSING}
