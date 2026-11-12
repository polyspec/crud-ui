"""The data limits of a form root (validation-rules.md, "Data limits")."""

from __future__ import annotations

from collections.abc import Mapping

from .compose_errors import ComposeLoadError
from .errors import FormInputError
from .jsvalue import JsonValue
from .text import NESTING_LIMIT, NODE_LIMIT, value_size
from .values import is_length_limit

DataLimits = tuple[int, int]
"""The bounds of the submitted data: its levels and its nodes."""

DEFAULT_LIMITS: DataLimits = (64, 100_000)
"""The limits of a form root that declares none (CUVR-083)."""

_BAD_LIMITS = (
    "Invalid dataLimits parameter: expected depth from 1 to "
    f"{NESTING_LIMIT} and values from 1 to {NODE_LIMIT}"
)


def data_limits(root: Mapping[str, JsonValue]) -> DataLimits:
    """The `dataLimits` of a form root, a missing member taking its default.

    A bad one raises `ComposeLoadError` (CUVR-084).
    """
    if "dataLimits" not in root:
        return DEFAULT_LIMITS
    declared = root["dataLimits"]
    if not isinstance(declared, dict):
        raise ComposeLoadError("INVALID_RULE_PARAMETER", _BAD_LIMITS)
    limits = {"depth": DEFAULT_LIMITS[0], "values": DEFAULT_LIMITS[1]}
    for key, value in declared.items():
        maximum = {"depth": NESTING_LIMIT, "values": NODE_LIMIT}.get(key, 0)
        if not is_length_limit(value) or not 1 <= int(value) <= maximum:
            raise ComposeLoadError("INVALID_RULE_PARAMETER", _BAD_LIMITS)
        limits[key] = int(value)
    return limits["depth"], limits["values"]


def check_data_limits(data: JsonValue, limits: DataLimits) -> None:
    """Raise `FormInputError` for data beyond its limits, its levels before its nodes (CUVR-082)."""
    levels, nodes = value_size(data)
    depth, values = limits
    if levels > depth:
        raise FormInputError(f"Submitted data exceeds the depth limit of {depth}")
    if nodes > values:
        raise FormInputError(f"Submitted data exceeds the values limit of {values}")
