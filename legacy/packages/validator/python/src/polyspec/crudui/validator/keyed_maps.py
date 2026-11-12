"""Keyed maps (docs/spec/schema.md and docs/spec/validation-rules.md, "Keyed maps").

A field that declares `multiple.keys` holds rows only under the row keys of the
repeated group that the reference names.
"""

from __future__ import annotations

from .errors import FormInputError
from .jsvalue import JsonValue
from .resolver import path_to_string, resolve_field_reference

_ABSENT = object()


def _keyed_map_reference(field: dict[str, JsonValue]) -> object:
    """The declared `multiple.keys` of a field, or `_ABSENT` when it declares none."""
    multiple = field.get("multiple")
    if isinstance(multiple, dict) and "keys" in multiple:
        return multiple["keys"]
    return _ABSENT


def is_multiple_field(field: dict[str, JsonValue]) -> bool:
    """Whether a field repeats (`multiple: true`, `multiple: only` or an object)."""
    multiple = field.get("multiple")
    return multiple is True or multiple == "only" or isinstance(multiple, dict)


def _names_repeated_group(
    reference: object, declaration_path: list[str], root: dict[str, JsonValue]
) -> bool:
    """Whether the reference names a repeated group of the form (CUSC-077).

    It leaves as many fields of the declaration path as it has leading dots (a
    bare name one; a path with a dot inside and no leading dot starts at the
    root), stays within the root, has no empty name and no `*`, passes only
    through groups that do not repeat and ends on a repeated group.
    """
    if not isinstance(reference, str):
        return False
    dots = len(reference) - len(reference.lstrip("."))
    rest = reference[dots:]
    leave = len(declaration_path) if dots == 0 and "." in rest else max(dots, 1)
    if leave > len(declaration_path):
        return False
    names = rest.split(".")
    if any(name in ("", "*") for name in names):
        return False
    properties: dict[str, JsonValue] = root
    for name in declaration_path[: len(declaration_path) - leave]:
        field = properties.get(name)
        children = field.get("properties") if isinstance(field, dict) else None
        properties = children if isinstance(children, dict) else {}
    for index, name in enumerate(names):
        field = properties.get(name)
        if not isinstance(field, dict) or field.get("type") != "group":
            return False
        children = field.get("properties")
        if not isinstance(children, dict):
            return False
        if index == len(names) - 1:
            return is_multiple_field(field)
        if is_multiple_field(field):
            return False
        properties = children
    return False


def assert_keyed_map_reference(
    field: dict[str, JsonValue], declaration_path: list[str], root: dict[str, JsonValue]
) -> None:
    """Fail the load when `multiple.keys` names no repeated group (CUVR-070)."""
    reference = _keyed_map_reference(field)
    if reference is not _ABSENT and not _names_repeated_group(
        reference, declaration_path, root
    ):
        raise FormInputError(
            f"Invalid multiple.keys at {path_to_string(declaration_path)}: "
            "expected a reference to a repeated group"
        )


def assert_keyed_map_keys(
    field: dict[str, JsonValue],
    value: dict[str, JsonValue],
    field_path: list[str],
    row_keys: list[int],
    all_data: JsonValue,
) -> None:
    """Fail when a key of the keyed object is not a row key of the named group (CUVR-069).

    The reference is read in the field's row context; keys in code point order.
    """
    reference = _keyed_map_reference(field)
    if not isinstance(reference, str):
        return
    group = resolve_field_reference(
        reference,
        {"currentPath": field_path, "rowKeys": row_keys, "formData": all_data},
    )
    ids = group if isinstance(group, dict) else {}
    for key in sorted(value):
        if key not in ids:
            raise FormInputError(
                f"Row key is not an id of {reference}: {path_to_string([*field_path, key])}"
            )
