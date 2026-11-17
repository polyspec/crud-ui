"""Choices from a repeated group (docs/spec/schema.md, "Choices from a repeated group").

A choice field whose `items` is a group source `{from, label?}` takes its choices
from the rows of a repeated group of the same form. This module checks the
declaration of a group source and reads its choices from the data. The generator
lists the choices and the validator checks a value against them
(docs/spec/validation-rules.md, "Values").
"""

from typing import Any, TypeGuard

from .errors import FormInputError
from .values import canonical_text, trim

__all__ = [
    "CHOICE_TYPES",
    "is_selection_source",
    "group_choices",
    "group_source_failure",
    "group_source_repeat",
    "is_group_source",
]

# The field types whose stored value is the list of the selected values of their literal items (CUSC-097).
SELECTION_TYPES = ("multichoice", "checkboxes", "checkcontainer")

CHOICE_TYPES = (
    "select",
    "dropdown",
    "selectbox",
    "choice",
    "radio",
    "multichoice",
    "checkboxes",
    "checkcontainer",
)

# The field types whose stored value is a boolean, which a group source refuses (CUSC-068).
BOOLEAN_TYPES = ("checkbox", "switcher")


def _is_object(value: object) -> TypeGuard[dict[str, Any]]:
    return isinstance(value, dict)


def is_group_source(items: object) -> TypeGuard[dict[str, Any]]:
    """Whether `items` is a group source: an object with the member `from`."""
    return _is_object(items) and "from" in items


def _repeated(field: dict[str, Any]) -> bool:
    multiple = field.get("multiple")
    return multiple is True or multiple == "only" or _is_object(multiple)


def _has_lang(field: dict[str, Any]) -> bool:
    lang = field.get("lang")
    return lang is True or _is_object(lang)


def _scalar_child(properties: dict[str, Any], name: object) -> bool:
    """Whether `name` is a direct child of `properties` that is not repeated, not a group and has no `lang`."""
    if not isinstance(name, str) or name not in properties:
        return False
    child = properties[name]
    return (
        _is_object(child)
        and child.get("type") != "group"
        and "properties" not in child
        and not _repeated(child)
        and not _has_lang(child)
    )


def _holds_boolean(properties: dict[str, Any], name: object) -> bool:
    """Whether the scalar child `name` of a group is of a type that stores a boolean."""
    child = properties.get(name) if isinstance(name, str) else None
    return _is_object(child) and child.get("type") in BOOLEAN_TYPES


def _boolean_failure(member: str, path: str, field: str) -> str:
    """The message of a group source whose `member` names the field `field` that holds a boolean (CUSC-068)."""
    return (
        f"Invalid items.{member} at {path}: {field} holds a boolean, "
        "expected a field whose values are strings or numbers"
    )


def _source_group(from_: object, properties: dict[str, Any]) -> dict[str, Any] | None:
    """The child fields of the repeated group that `from_` names, or None when it breaks the rules.

    `from_` is `{group}.*.{field}`: the groups are named from the root `properties`,
    only the last of them is repeated, and `field` is a scalar child of the last group.
    """
    if not isinstance(from_, str):
        return None
    segments = from_.split(".")
    if len(segments) < 3 or segments[-2] != "*":
        return None
    names = segments[:-2]
    current = properties
    for index, name in enumerate(names):
        if name == "" or name not in current:
            return None
        field = current[name]
        if (
            not _is_object(field)
            or field.get("type") != "group"
            or not _is_object(field.get("properties"))
        ):
            return None
        if _repeated(field) != (index == len(names) - 1):
            return None
        current = field["properties"]
    return current if _scalar_child(current, segments[-1]) else None


def group_source_failure(
    field: dict[str, Any], path: str, properties: dict[str, Any]
) -> str | None:
    """The message of the first rule that the group source of `field` breaks, or None.

    `path` is the declaration path of the field and `properties` the root properties.
    The members of `items` are checked in declaration order, then the field, then
    `from`, the type of its field, `label` and then the type of its field.
    """
    items = field.get("items")
    if not is_group_source(items):
        return None
    for key in items:
        if key not in ("from", "label", "choices"):
            return f"Invalid items.{key} at {path}: unknown key"
    if field.get("type") not in CHOICE_TYPES or _has_lang(field):
        return f"Invalid items.from at {path}: expected a choice field without lang"
    if _selection_field(items["from"], properties) is not None:
        # A source of selected values takes the labels of its field (CUSC-097).
        if "label" in items:
            return f"Invalid items.label at {path}: a source of selected values takes the labels of its field"
        if "choices" in items and _literal_choices(items["choices"]) is None:
            return (
                f"Invalid items.choices at {path}: expected value and label pairs "
                "with distinct string or number values"
            )
        return None
    group = _source_group(items["from"], properties)
    if group is None:
        return (
            f"Invalid items.from at {path}: expected {{group}}.*.{{field}} "
            "for a field of a repeated group outside repeated groups"
        )
    segments = items["from"].split(".")
    group_path = ".".join(segments[:-2])
    if _holds_boolean(group, segments[-1]):
        return _boolean_failure("from", path, f"{group_path}.{segments[-1]}")
    if "label" in items and not _scalar_child(group, items["label"]):
        return (
            f"Invalid items.label at {path}: expected the name of a direct child field "
            "of the group without multiple, properties or lang"
        )
    if "label" in items and _holds_boolean(group, items["label"]):
        return _boolean_failure("label", path, f"{group_path}.{items['label']}")
    if "choices" in items and _literal_choices(items["choices"]) is None:
        return (
            f"Invalid items.choices at {path}: expected value and label pairs "
            "with distinct string or number values"
        )
    return None


def _literal_choices(choices: object) -> list[dict[str, Any]] | None:
    """The literal choices of a group source (schema.md, CUSC-089), or None when they break its rules.

    Each is a `{value, label}` pair whose value is a string or a finite number with a
    canonical text that is not empty after trimming and that no other literal choice has;
    the value of a returned choice is that canonical text.
    """
    if not isinstance(choices, list):
        return None
    literal: list[dict[str, Any]] = []
    for choice in choices:
        if not _is_object(choice) or set(choice) != {"value", "label"}:
            return None
        value = _choice_text(choice["value"])
        if value is None or any(known["value"] == value for known in literal):
            return None
        literal.append({"value": value, "label": choice["label"]})
    return literal


def _source_literal(source: dict[str, Any]) -> list[dict[str, Any]]:
    """The literal choices of a checked group source, none when it declares no `choices`."""
    return (_literal_choices(source["choices"]) or []) if "choices" in source else []


def _choice_text(value: object) -> str | None:
    """The canonical text of a string or a finite number that is not empty after trimming, else None."""
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return None
    text = canonical_text(value)
    if text is None or trim(text) == "":
        return None
    return text


def _source_rows(source: dict[str, Any], data: object) -> dict[str, Any]:
    """The rows of the group that a checked group source names in the root `data`, by row key in data order."""
    rows: object = data
    for name in str(source["from"]).split(".")[:-2]:
        if not _is_object(rows) or name not in rows:
            return {}
        rows = rows[name]
    return rows if _is_object(rows) else {}


def group_source_repeat(source: dict[str, Any], data: object) -> str | None:
    """The input failure message of the first row of a checked group source, in data order,
    whose choice value repeats a literal choice (CUSC-089), or None."""
    return _first_repeat(source, data, rows=False)


def group_source_repeats(source: dict[str, Any], data: object) -> list[tuple[str, str]]:
    """The rows whose choice value repeats the value of an earlier row, in data order, as the data path
    of the value field and its canonical text (CUVR-087, CUVR-096). Each is a field error with rule `unique`."""
    segments = str(source["from"]).split(".")
    group_path = ".".join(segments[:-2])
    value_name = segments[-1]
    seen: set[str] = set()
    repeats: list[tuple[str, str]] = []
    for key, row in _source_rows(source, data).items():
        if not _is_object(row):
            continue
        value = _choice_text(row.get(value_name))
        if value is None:
            continue
        if value in seen:
            repeats.append((f"{group_path}.{key}.{value_name}", value))
        seen.add(value)
    return repeats


def _first_repeat(source: dict[str, Any], data: object, *, rows: bool) -> str | None:
    """The message of the first row whose value is a literal choice or, with `rows`, an earlier row's value."""
    segments = str(source["from"]).split(".")
    group_path = ".".join(segments[:-2])
    value_name = segments[-1]
    literal = {choice["value"] for choice in _source_literal(source)}
    seen: set[str] = set()
    for key, row in _source_rows(source, data).items():
        if not _is_object(row):
            continue
        value = _choice_text(row.get(value_name))
        if value is None:
            continue
        at = f"{group_path}.{key}.{value_name}"
        if value in literal:
            return f"Group source value repeats a literal choice at {at}: {value}"
        if rows and value in seen:
            return f"Group source value repeats an earlier row: {value} at {at}"
        seen.add(value)
    return None


def _selection_field(from_: object, properties: dict[str, Any]) -> dict[str, Any] | None:
    """The root field that a `from` with no `.` names when it is a source of selected values (CUSC-097):
    a field of a selection type whose items are literal, which is no group source."""
    if not isinstance(from_, str) or "." in from_ or from_ not in properties:
        return None
    field = properties[from_]
    if not _is_object(field) or field.get("type") not in SELECTION_TYPES:
        return None
    if is_group_source(field.get("items")):
        return None
    items = field.get("items")
    return field if isinstance(items, list) or _is_object(items) else None


def is_selection_source(items: object, properties: dict[str, Any]) -> bool:
    """Whether a group source names a source of selected values under the root `properties` (CUSC-097)."""
    return _is_object(items) and _selection_field(items.get("from"), properties) is not None


def _selection_choices(
    source: dict[str, Any], field: dict[str, Any], data: object
) -> list[dict[str, Any]]:
    """The choices of a source of selected values (CUSC-097): its literal choices in written order, then
    each item of the source field, in the order of its items, that the field selects in the data, with
    the label of that item."""
    choices = list(_source_literal(source))
    seen = {choice["value"] for choice in choices}
    selected_values = data.get(source["from"]) if _is_object(data) else None
    if not isinstance(selected_values, list):
        return choices
    selected = {
        text
        for member in selected_values
        if (text := _choice_text(member)) is not None
    }
    items: list[tuple[str, object]] = []
    field_items = field["items"]
    if isinstance(field_items, list):
        for item in field_items:
            if _is_object(item):
                text = _choice_text(item.get("value"))
                if text is not None:
                    items.append((text, item.get("label")))
    else:
        for key, label in field_items.items():
            text = _choice_text(key)
            if text is not None:
                items.append((text, label))
    for text, label in items:
        if text not in selected or text in seen:
            continue
        seen.add(text)
        choices.append({"value": text, "label": text if label is None else label})
    return choices


def group_choices(
    source: dict[str, Any], data: object, properties: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    """The choices of a checked group source for the root `data`, as `{value, label}` pairs.

    The literal choices come first in written order (CUSC-089), then one choice per row of
    the group in data order whose value text is not empty and not seen before. The label
    of a row is the text of its `label` field, or else the value. A row whose value is a
    literal choice raises FormInputError with the row path and the value.
    """
    if properties is not None:
        selected = _selection_field(source["from"], properties)
        if selected is not None:
            return _selection_choices(source, selected, data)
    literal_repeat = _first_repeat(source, data, rows=False)
    if literal_repeat is not None:
        raise FormInputError(literal_repeat)
    value_name = str(source["from"]).split(".")[-1]
    choices: list[dict[str, Any]] = list(_source_literal(source))
    seen: set[str] = set()
    for row in _source_rows(source, data).values():
        if not _is_object(row):
            continue
        value = _choice_text(row.get(value_name))
        if value is None or value in seen:
            continue
        seen.add(value)
        label = (
            _choice_text(row.get(source["label"]))
            if isinstance(source.get("label"), str)
            else None
        )
        choices.append({"value": value, "label": label if label is not None else value})
    return choices
