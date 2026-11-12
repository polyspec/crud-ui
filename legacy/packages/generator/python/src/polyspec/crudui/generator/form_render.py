"""Render options of a complete form.

The form element, the hidden fields, the form errors and the node errors: an
option outside the contract is a `FormError` in the documented order, and an
error path that no node carries is one too.
"""

from typing import Any, NoReturn

from .errors import FormError
from .rendering import url as render_url

__all__ = ["EMPTY", "model"]

EMPTY: dict[str, Any] = {"form": None, "hidden": [], "formErrors": [], "nodeErrors": {}}

_MEMBERS = ("action", "hidden", "formErrors", "errors")
_ACTION_MEMBERS = ("method", "url", "enctype")


def _members(value: object) -> dict[str, Any] | None:
    """The members of a JSON object: a dict, or None for any other value."""
    if isinstance(value, dict):
        return value
    return None


def model(
    nodes: list[dict[str, Any]], template_action: object, options: object
) -> dict[str, Any]:
    """Check render options and build the model the renderer writes.

    `nodes` are the top-level nodes the renderer writes; `template_action` is
    the compiled template's declared action.
    """
    members = _members(options)
    if members is None:
        _failure("Render options must be an object")
    for name in members:
        if name not in _MEMBERS:
            _failure(f"Unknown render option: {name}")
    action = _members(members["action"]) if "action" in members else None
    if "action" in members and (action is None or _invalid_action(action)):
        _failure("action must be an object with string method, url and enctype")
    hidden = _members(members["hidden"]) if "hidden" in members else None
    if "hidden" in members and (
        hidden is None or any(not isinstance(value, str) for value in hidden.values())
    ):
        _failure("hidden must be an object of strings")
    if hidden is not None and action is None:
        _failure("hidden requires action")
    form_errors = members.get("formErrors", [])
    if not isinstance(form_errors, list) or any(
        not isinstance(item, str) for item in form_errors
    ):
        _failure("formErrors must be a list of strings")
    errors = members.get("errors", [])
    records = (
        [_members(record) for record in errors] if isinstance(errors, list) else None
    )
    if records is None or any(
        record is None
        or not isinstance(record.get("path"), str)
        or not isinstance(record.get("message"), str)
        for record in records
    ):
        _failure("errors must be a list of objects with string path and message")
    node_errors: dict[int, list[str]] = {}
    if records:
        by_path: dict[str, dict[str, Any]] = {}
        _nodes_by_path(nodes, None, by_path)
        for record in records:
            assert record is not None  # every record was checked above
            record_path = str(record["path"])
            node = by_path.get(record_path)
            if node is None:
                _failure(f"Unknown error path: {record_path}")
            node_errors.setdefault(id(node), []).append(str(record["message"]))
    form: dict[str, str] | None = None
    if action is not None:
        declared = _members(template_action) or {}

        def value(key: str) -> str | None:
            found = action.get(key, declared.get(key))
            return found if isinstance(found, str) else None

        form = {
            key: item
            for key, item in (
                (
                    "action",
                    None if value("url") is None else render_url(str(value("url"))),
                ),
                ("encType", value("enctype")),
                ("method", value("method")),
            )
            if item is not None
        }
    pairs = [[str(name), value] for name, value in (hidden or {}).items()]
    return {
        "form": form,
        "hidden": pairs,
        "formErrors": form_errors,
        "nodeErrors": node_errors,
    }


def _invalid_action(action: dict[str, Any]) -> bool:
    for key, value in action.items():
        if key not in _ACTION_MEMBERS or not isinstance(value, str):
            return True
    return False


def _nodes_by_path(
    nodes: list[dict[str, Any]], parent: str | None, out: dict[str, dict[str, Any]]
) -> None:
    """Every node with a data path, by that path.

    A row's path is its collection path, `.` and its key.
    """
    for node in nodes:
        if node["kind"] == "row":
            path = f"{parent}.{node['key']}"
        elif node["kind"] == "lang-item":
            path = None
        else:
            path = node.get("path")
        if path is not None:
            out[path] = node
        _nodes_by_path(node.get("children", []), path, out)


def _failure(message: str) -> NoReturn:
    raise FormError("INVALID_FORM_INPUT", message)
