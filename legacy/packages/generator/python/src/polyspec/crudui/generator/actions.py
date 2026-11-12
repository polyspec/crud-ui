"""Action buttons of forms: the targets of `data-crudui-action` and their runs (CURT-081 to CURT-090).

A target is `{"name", "path"?, "key"?}`; `resolveAction` reads the values a button declares and `runAction`
performs the operation on a form instance, returning the row that receives focus.
"""

from collections.abc import Mapping
from typing import Any

from .errors import FormError

_ACTION_NAMES = (
    "move-up",
    "move-down",
    "add-row",
    "copy-row",
    "remove-row",
    "toggle-row",
    "select-row",
    "expand-all",
    "collapse-all",
    "undo",
    "redo",
)


def resolveAction(source: Any) -> Any:
    """The target of an action button, or None when `action` is not one of the eleven actions (CURT-081)."""
    if not isinstance(source, Mapping):
        raise FormError("INVALID_FORM_INPUT", "An action must be an object")
    name = source.get("action")
    if name not in _ACTION_NAMES:
        return None
    target: dict[str, Any] = {"name": name}
    if source.get("path"):
        target["path"] = source["path"]
    if source.get("key"):
        target["key"] = source["key"]
    return target


def runAction(form: Any, target: Any) -> Any:
    """Run a resolved action; returns its focus, or None when the target lacks a path or key (CURT-082 to CURT-090).

    Adding and copying focus the new row, moving focuses the moved row, and removing focuses the previous row, then
    the next row, then the collection. A failing operation raises its error and leaves the form unchanged.
    """
    name = target.get("name")
    path = target.get("path")
    key = target.get("key")
    if name in ("expand-all", "collapse-all"):
        form.setAllExpanded(name == "expand-all")
        return {}
    if name == "undo":
        form.undo()
        return {}
    if name == "redo":
        form.redo()
        return {}
    if name not in _ACTION_NAMES:
        raise FormError("INVALID_FORM_INPUT", f"Unknown action: {name}")
    if not path:
        return None
    if name == "add-row":
        options = {} if key is None else {"afterKey": key}
        return {"focus": {"path": path, "key": form.addRow(path, options)}}
    if not key:
        return None
    if name == "copy-row":
        return {"focus": {"path": path, "key": form.copyRow(path, key)}}
    if name == "remove-row":
        keys = _row_keys(form, path)
        position = _position(keys, key)
        neighbour = _neighbour(keys, position)
        form.removeRow(path, key)
        if neighbour is None:
            return {"focus": {"path": path}}
        return {"focus": {"path": path, "key": neighbour}}
    if name == "toggle-row":
        form.toggleRow(path, key)
        return {}
    if name == "select-row":
        # Selecting changes no state: it only moves focus to the row.
        return {"focus": {"path": path, "key": key}}
    keys = _row_keys(form, path)
    step = -1 if name == "move-up" else 1
    form.moveRow(path, key, _position(keys, key) + step)
    return {"focus": {"path": path, "key": key}}


def _row_keys(form: Any, path: str) -> list[str]:
    """The row keys of the keyed collection at `path`, whose row an action names."""
    rows = form.getValue(path)
    if not isinstance(rows, dict):
        raise FormError(
            "INVALID_FORM_INPUT", f"Repeated data must be a keyed object: {path}"
        )
    return list(rows)


def _position(keys: list[str], key: str) -> int:
    """The index of a row key, or -1 when the collection has no such row (the operation then reports it)."""
    return keys.index(key) if key in keys else -1


def _neighbour(keys: list[str], position: int) -> Any:
    """The row before the removed one, else the row after it, else None."""
    for candidate in (position - 1, position + 1):
        if 0 <= candidate < len(keys):
            return keys[candidate]
    return None
