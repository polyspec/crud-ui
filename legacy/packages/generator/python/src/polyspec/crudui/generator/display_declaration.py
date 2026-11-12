"""Declaration rules of composed list and detail specifications.

The root members, the own design, each column or field in member order and
then, for a list, search, sort, actions, empty, description and pagination,
and for a detail, actions (docs/spec/display-formats.md).
"""

from typing import Any, NoReturn, TypeGuard

from .choice_list import EXPECTED, is_choice_list, pairs
from .errors import FormError
from .template import check_design_declaration

__all__ = ["check"]

_LIST_KEYS = (
    "columns",
    "search",
    "sort",
    "pagination",
    "actions",
    "empty",
    "description",
    "design",
)
_DETAIL_KEYS = ("fields", "actions", "design")
_COLUMN_KEYS = ("field", "label", "format", "design", "sortable")
_FIELD_KEYS = ("field", "label", "format", "design")
_SORT_KEYS = ("field", "dir")
_SCRIPT_ACTION_KEYS = ("label", "script")
_ACTION_KEYS = ("label", "format", "behavior", "design")
_BEHAVIOR_KEYS = ("onchange", "onclick", "onload")
_FORMAT_STRINGS = ("type", "pattern", "target", "as")
_FORMAT_CONTENT = ("prefix", "suffix", "text", "true", "false", "alt")
_PAGINATION_MODES = ("pages", "offset", "cursor", "none")
_CONTENT = "a string, a language map or null"


def _is_object(value: object) -> TypeGuard[dict[str, Any]]:
    return isinstance(value, dict)


def _expected(key: str, path: str, expected: str) -> NoReturn:
    raise FormError(
        "INVALID_FORM_INPUT", f"Invalid {key} at {path}: expected {expected}"
    )


def _unknown(key: str, path: str) -> NoReturn:
    raise FormError("INVALID_FORM_INPUT", f"Invalid {key} at {path}: unknown key")


def _closed(
    members: dict[str, Any], prefix: str, allowed: tuple[str, ...], path: str
) -> None:
    """Reject the first member, in member order, that `allowed` does not list."""
    for key in members:
        if key not in allowed:
            _unknown(prefix + key, path)


def _is_content(value: object) -> bool:
    """A string, a language map (a non-empty object of strings or null) or null."""
    if value is None or isinstance(value, str):
        return True
    if not _is_object(value) or not value:
        return False
    return all(entry is None or isinstance(entry, str) for entry in value.values())


def _is_condition_map(value: object) -> bool:
    return _is_object(value) and bool(value)


def check(spec: dict[str, Any], own: str, members: str) -> None:
    """Check a composed list or detail specification.

    `own` is `list` or `detail` and `members` names the member map, `columns`
    or `fields`.
    """
    for key in spec:
        if key in ("$ref", "$patch"):
            _expected(key, own, f"composition inside {members}")
        if key not in (_LIST_KEYS if own == "list" else _DETAIL_KEYS):
            _unknown(key, own)
    if "design" in spec:
        check_design_declaration(spec["design"], own)
    for name, member in spec[members].items():
        _member(name, member, own, members)
    if own == "detail":
        if "actions" in spec:
            _actions(spec["actions"], own)
        return
    if (
        "search" in spec
        and not isinstance(spec["search"], bool)
        and not _is_object(spec["search"])
    ):
        _expected("search", own, "a boolean or an object")
    if "sort" in spec:
        if not _is_object(spec["sort"]):
            _expected("sort", own, "an object")
        sort = spec["sort"]
        _closed(sort, "sort.", _SORT_KEYS, own)
        if "field" in sort and not isinstance(sort["field"], str):
            _expected("sort.field", own, "a string")
        if "dir" in sort and sort["dir"] not in ("asc", "desc"):
            _expected("sort.dir", own, "asc or desc")
    if "actions" in spec:
        _actions(spec["actions"], own)
    if "empty" in spec and not _is_content(spec["empty"]):
        _expected("empty", own, _CONTENT)
    if "description" in spec and not _is_content(spec["description"]):
        _expected("description", own, _CONTENT)
    if "pagination" in spec:
        _pagination(spec["pagination"], own)


def _actions(actions: object, own: str) -> None:
    """The actions declaration of a list or detail, each action in member order."""
    if not _is_object(actions):
        _expected("actions", own, "an object")
    for name, action in actions.items():
        # Actions are not composed: a composition key is not an action name.
        if name in ("$ref", "$patch"):
            _unknown(name, "actions")
        _action(name, action)


def _format(format_value: object, path: str) -> None:
    """A cell format declaration at `path`."""
    if isinstance(format_value, (bool, str)):
        return
    if not _is_object(format_value):
        _expected("format", path, "a boolean, a string or an object")
    for key, value in format_value.items():
        if key in _FORMAT_STRINGS:
            if not isinstance(value, str):
                _expected(f"format.{key}", path, "a string")
        elif key in _FORMAT_CONTENT:
            if not _is_content(value):
                _expected(f"format.{key}", path, _CONTENT)
        elif key == "map":
            if not _is_object(value):
                _expected("format.map", path, "an object")
            for name, label in value.items():
                if not _is_content(label):
                    _expected(f"format.map.{name}", path, _CONTENT)
        elif key == "href":
            if not isinstance(value, str) and not _is_condition_map(value):
                _expected("format.href", path, "a string or a condition map")
        elif key == "items":
            if not isinstance(value, (list, dict)):
                _expected("format.items", path, "an array or an object")
            if (
                isinstance(value, list)
                and is_choice_list(value)
                and pairs(value) is None
            ):
                _expected("format.items", path, EXPECTED)


def _member(name: str, member: object, own: str, members: str) -> None:
    """One column or field declaration."""
    if not _is_object(member):
        _expected(name, members, "an object")
    path = f"{members}.{name}"
    _closed(member, "", _COLUMN_KEYS if own == "list" else _FIELD_KEYS, path)
    if "field" in member and not isinstance(member["field"], str):
        _expected("field", path, "a string")
    if "label" in member and not _is_content(member["label"]):
        _expected("label", path, _CONTENT)
    if "format" in member:
        _format(member["format"], path)
    if "design" in member:
        check_design_declaration(member["design"], path)
    if "sortable" in member:
        sortable = member["sortable"]
        if (
            not isinstance(sortable, bool)
            and not isinstance(sortable, str)
            and not _is_condition_map(sortable)
        ):
            _expected("sortable", path, "a boolean, an expression or a condition map")


def _behavior_entry(event: str, entry: object, path: str) -> None:
    """One behavior entry of an action at `path`."""
    if isinstance(entry, str):
        return
    if not _is_object(entry):
        _expected(f"behavior.{event}", path, "a script or an object")
    _closed(entry, f"behavior.{event}.", _SCRIPT_ACTION_KEYS, path)
    if "label" in entry and not _is_content(entry["label"]):
        _expected(f"behavior.{event}.label", path, _CONTENT)
    if "script" in entry and not isinstance(entry["script"], str):
        _expected(f"behavior.{event}.script", path, "a string")


def _action(name: str, action: object) -> None:
    """One list or detail action at actions.<name>."""
    if isinstance(action, str):
        return
    if not _is_object(action):
        _expected(name, "actions", "a script or an object")
    path = f"actions.{name}"
    if "script" in action:
        _closed(action, "", _SCRIPT_ACTION_KEYS, path)
        if "label" in action and not _is_content(action["label"]):
            _expected("label", path, _CONTENT)
        if not isinstance(action["script"], str):
            _expected("script", path, "a string")
        return
    _closed(action, "", _ACTION_KEYS, path)
    if "label" in action and not _is_content(action["label"]):
        _expected("label", path, _CONTENT)
    if "format" in action:
        _format(action["format"], path)
    if "behavior" in action:
        behavior = action["behavior"]
        if not isinstance(behavior, bool) and not _is_object(behavior):
            _expected("behavior", path, "a boolean or an object")
        if _is_object(behavior):
            _closed(behavior, "behavior.", _BEHAVIOR_KEYS, path)
            for event, entry in behavior.items():
                _behavior_entry(event, entry, path)
    if "design" in action:
        check_design_declaration(action["design"], path)


def _pagination(pagination: object, path: str) -> None:
    """A wrong value type or an unknown key in the pagination declaration at `path`."""
    if not isinstance(pagination, bool) and not _is_object(pagination):
        _expected("pagination", path, "a boolean or an object")
    if not _is_object(pagination):
        return
    _closed(pagination, "pagination.", ("per_page", "mode"), path)
    if "per_page" in pagination and _safe_integer(pagination["per_page"], 1) is None:
        _expected("pagination.per_page", path, "a positive integer")
    if "mode" in pagination and pagination["mode"] not in _PAGINATION_MODES:
        _expected("pagination.mode", path, "pages, offset, cursor or none")


def _safe_integer(value: object, minimum: int) -> int | None:
    from .lists import safe_integer

    return safe_integer(value, minimum)
