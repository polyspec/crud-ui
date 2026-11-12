"""Undo history rules of form instances (CURT-011, CURT-012), as pure functions over immutable values.

A history is `{"entries": [...], "redoEntries": [...], "lastPath": str}`; `lastPath` is present only when the last change
was a value edit. Every function returns new values and leaves its arguments unchanged.
"""

from typing import Any

from .errors import FormError

HISTORY_LIMIT = 100


def empty() -> dict[str, Any]:
    """A history with nothing to undo."""
    return {"entries": [], "redoEntries": []}


def record(
    history: dict[str, Any], previous: Any, path: str | None = None
) -> dict[str, Any]:
    """Record the record before a change; a value edit on the path of the previous value edit shares its entry."""
    merged = path is not None and path == history.get("lastPath")
    entries = (
        list(history["entries"])
        if merged
        else [*history["entries"], previous][-HISTORY_LIMIT:]
    )
    result: dict[str, Any] = {"entries": entries, "redoEntries": []}
    if path is not None:
        result["lastPath"] = path
    return result


def can_undo(history: dict[str, Any]) -> bool:
    """Whether a history has a record to restore."""
    return len(history["entries"]) > 0


def can_redo(history: dict[str, Any]) -> bool:
    """Whether a history has a record to restore in the forward direction."""
    return len(history["redoEntries"]) > 0


def undo(history: dict[str, Any], current: Any) -> dict[str, Any]:
    """Take the record before the last change; the current record becomes redoable."""
    if not history["entries"]:
        raise FormError("INVALID_FORM_INPUT", "Nothing to undo")
    entries = history["entries"]
    return {
        "history": {
            "entries": list(entries[:-1]),
            "redoEntries": [*history["redoEntries"], current][-HISTORY_LIMIT:],
        },
        "value": entries[-1],
    }


def redo(history: dict[str, Any], current: Any) -> dict[str, Any]:
    """Take the record after the last undone change; the current record moves back into the entries."""
    if not history["redoEntries"]:
        raise FormError("INVALID_FORM_INPUT", "Nothing to redo")
    redo_entries = history["redoEntries"]
    return {
        "history": {
            "entries": [*history["entries"], current][-HISTORY_LIMIT:],
            "redoEntries": list(redo_entries[:-1]),
        },
        "value": redo_entries[-1],
    }
