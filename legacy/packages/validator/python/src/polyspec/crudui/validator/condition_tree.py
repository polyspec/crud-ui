"""The conditionTree rule (docs/spec/schema.md, "Condition trees").

A value passes when it is a group ``{all: [...]}`` or ``{any: [...]}``, a field comparison
``{field, op, value}`` or, under the parameter ``judge``, a judged text ``{judge}``, at most
32 levels deep. The check reads no level below the limit.
"""

from __future__ import annotations

from .values import is_finite_number, trim

__all__ = ["PARAMETER_ERROR", "is_condition_tree", "is_parameter"]

# The deepest level of a condition tree; the root condition is level 1 (CUSC-075).
_DEPTH = 32

# The operators of a field comparison (CUSC-073).
_OPERATORS = frozenset(("eq", "ne", "lt", "le", "gt", "ge", "in", "has"))

PARAMETER_ERROR = "Invalid conditionTree parameter: expected true, false or judge"


def is_parameter(param: object) -> bool:
    """Whether a parameter enables the rule: True or judge."""
    return param is True or param == "judge"


def _is_scalar(value: object) -> bool:
    """Whether a value is a string, a finite number or a boolean."""
    return isinstance(value, (str, bool)) or is_finite_number(value)


def _is_text(value: object) -> bool:
    """Whether a value is a string that is not empty after trimming."""
    return isinstance(value, str) and trim(value) != ""


def is_condition_tree(node: object, judge: bool, level: int = 1) -> bool:
    """Whether ``node``, at ``level``, is a condition; ``judge`` permits judged text."""
    if level > _DEPTH or not isinstance(node, dict):
        return False
    names = sorted(str(name) for name in node)
    if names in (["all"], ["any"]):
        items = node[names[0]]
        return isinstance(items, list) and all(
            is_condition_tree(item, judge, level + 1) for item in items
        )
    if names == ["field", "op", "value"]:
        op = node["op"]
        if (
            not _is_text(node["field"])
            or not isinstance(op, str)
            or op not in _OPERATORS
        ):
            return False
        value = node["value"]
        if op != "in":
            return _is_scalar(value)
        return isinstance(value, list) and all(_is_scalar(item) for item in value)
    return names == ["judge"] and judge and _is_text(node["judge"])
