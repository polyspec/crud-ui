"""References (validation rules, "References").

A `reference` parameter is the declaration path of a field: its property names
from the root joined with `.`, without row keys. The ids of the path are the
values of that field in the data, read in every row of every repeated field on
the path, and a value passes when it is a member of them as for `in`.
"""

import math

from .jsvalue import JsonValue
from .keyed_maps import is_multiple_field
from .values import canonical_text, trim

REFERENCE_PARAMETER_MESSAGE = (
    "Invalid reference parameter: expected the declaration path of a field"
)


def is_reference_target(properties: dict[str, JsonValue], path: str) -> bool:
    """Whether `path` is the declaration path of a field of the form whose type
    is not `group` and whose `lang` is absent, `false` or `null` (CUVR-074)."""
    fields: JsonValue = properties
    field: dict[str, JsonValue] | None = None
    for name in path.split("."):
        if not isinstance(fields, dict) or name not in fields:
            return False
        candidate = fields[name]
        if not isinstance(candidate, dict):
            return False
        field = candidate
        fields = (
            candidate.get("properties") if candidate.get("type") == "group" else None
        )
    if field is None or field.get("type") == "group":
        return False
    lang = field.get("lang")
    return lang is None or lang is False


def _is_id(value: JsonValue) -> bool:
    """Whether a value is an id: a string, a finite number or a boolean whose
    canonical text is not empty after trimming (CUVR-072)."""
    if isinstance(value, bool):
        return True
    if isinstance(value, (int, float)):
        return math.isfinite(value)
    if isinstance(value, str):
        text = canonical_text(value)
        return text is not None and trim(text) != ""
    return False


def _values_of(field: dict[str, JsonValue], value: JsonValue) -> list[JsonValue]:
    """The values a field has in its data: each row of a repeated field, or the value itself."""
    if not is_multiple_field(field):
        return [value]
    return list(value.values()) if isinstance(value, dict) else []


def reference_ids(
    properties: dict[str, JsonValue], data: dict[str, JsonValue], path: str
) -> list[JsonValue]:
    """The ids of the declaration path `path` in `data` (CUVR-072), in data order.

    Data of another shape at a step and a missing value hold no ids.
    """
    segments = path.split(".")
    ids: list[JsonValue] = []

    def walk(fields: JsonValue, value: JsonValue, index: int) -> None:
        if not isinstance(fields, dict) or not isinstance(value, dict):
            return
        name = segments[index]
        field = fields.get(name)
        if not isinstance(field, dict) or name not in value:
            return
        for item in _values_of(field, value[name]):
            if index == len(segments) - 1:
                if _is_id(item):
                    ids.append(item)
            else:
                walk(field.get("properties"), item, index + 1)

    walk(properties, data, 0)
    return ids
