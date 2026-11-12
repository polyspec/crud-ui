"""Read choice lists: `items` arrays of value and label pairs kept in list order."""

import math
from collections.abc import Container
from typing import Any, TypeGuard

from .errors import FormError
from .template import check_declared_attributes
from .value import scalar, style_value

__all__ = [
    "EXPECTED",
    "appearances",
    "check_appearance",
    "groups",
    "is_choice_list",
    "pairs",
]

EXPECTED = "value and label pairs with distinct string or number values"

_APPEARANCE_MEMBERS = ("class", "style", "attributes")


def is_choice_list(items: object) -> bool:
    """Whether `items` is a choice list: a list with an object element holding `value` or `choices`."""
    if not isinstance(items, list):
        return False
    return any(
        isinstance(item, dict) and ("value" in item or "choices" in item)
        for item in items
    )


def _is_group(item: object) -> TypeGuard[dict[str, Any]]:
    return isinstance(item, dict) and "choices" in item


def _finite_number(value: object) -> bool:
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float))
        and (isinstance(value, int) or math.isfinite(value))
    )


def pairs(
    items: list[Any], appearance: bool = False, groups: bool = False
) -> list[tuple[str, Any]] | None:
    """The value text and label pairs in list order, or None when an element breaks the rules.

    The choices of each group take the group's place. An element with another
    member (an appearance member is accepted with `appearance`), a missing
    value or label, a value that is not a string or a finite number, or the
    repeated canonical text of an earlier value breaks the list, and so does a
    group without `groups`, or a group that is not a label and a non-empty
    list of choices without appearance members.
    """
    out: list[tuple[str, Any]] = []
    seen: set[str] = set()

    def add(item: Any, members: Container[str]) -> bool:
        if not isinstance(item, dict) or "value" not in item or "label" not in item:
            return False
        for member in item:
            if member != "value" and member != "label" and member not in members:
                return False
        value = item["value"]
        if not isinstance(value, str) and not _finite_number(value):
            return False
        text = scalar(value)
        if text in seen:
            return False
        seen.add(text)
        out.append((text, item["label"]))
        return True

    for item in items:
        if groups and _is_group(item):
            choices = item["choices"]
            if (
                len(item) != 2
                or "label" not in item
                or not isinstance(choices, list)
                or not choices
            ):
                return None
            for choice in choices:
                if not add(choice, ()):
                    return None
        elif not add(item, _APPEARANCE_MEMBERS if appearance else ()):
            return None
    return out


def groups(items: list[Any]) -> list[dict[str, Any] | None]:
    """The group of each pair of a checked choice list, or None for a choice outside groups."""
    out: list[dict[str, Any] | None] = []
    for index, item in enumerate(items):
        if _is_group(item):
            for _choice in item["choices"]:
                out.append({"index": index, "label": item["label"]})
        else:
            out.append(None)
    return out


def check_appearance(items: list[Any], path: str) -> None:
    """Reject the appearance of a valid choice list that breaks the declaration rules."""
    for index, choice in enumerate(items):
        for member in ("class", "style"):
            if member in choice and not isinstance(choice[member], str):
                raise FormError(
                    "INVALID_FORM_INPUT",
                    f"Invalid items.{index}.{member} at {path}: expected a string",
                )
        if "attributes" in choice:
            check_declared_attributes(
                choice["attributes"], f"items.{index}.attributes", path
            )


def appearances(items: list[Any]) -> list[dict[str, Any]]:
    """The appearance of each choice in list order: className, style and attributes when declared."""
    out: list[dict[str, Any]] = []
    for choice in items:
        entry: dict[str, Any] = {}
        if isinstance(choice.get("class"), str) and choice["class"] != "":
            entry["className"] = choice["class"]
        style = style_value(choice.get("style"))
        if style is not None and style != "":
            entry["style"] = style
        if isinstance(choice.get("attributes"), dict) and choice["attributes"]:
            entry["attributes"] = dict(choice["attributes"])
        out.append(entry)
    return out
