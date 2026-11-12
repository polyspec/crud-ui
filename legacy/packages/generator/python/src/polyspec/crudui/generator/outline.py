"""Derive the structure map of a form: one entry per row of its collections."""

from collections.abc import Mapping, Sequence
from typing import Any

__all__ = ["build"]


def build(nodes: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """The form's rows, nested as in the form; collections, counts and empty
    collections are not rows."""
    return _rows(nodes)


def _rows(nodes: Sequence[Mapping[str, Any]] | None) -> list[dict[str, Any]]:
    """The rows under the nodes, looking through every node that is not a collection."""
    rows: list[dict[str, Any]] = []
    for node in nodes or []:
        if node.get("kind") != "collection":
            rows.extend(_rows(node.get("children")))
            continue
        rows.extend(
            _entry(node.get("path") or "", row) for row in node.get("children") or []
        )
    return rows


def _entry(path: str, row: Mapping[str, Any]) -> dict[str, Any]:
    """The entry of one row of the collection at `path`, with the rows nested in it."""
    entry: dict[str, Any] = {"path": path, "key": row.get("key") or ""}
    header = row.get("header") or {}
    for name in ("number", "title"):
        if header.get(name) is not None:
            entry[name] = header[name]
    controls = row.get("controls")
    if controls is not None and controls.get("placement") == "outline":
        entry["controls"] = controls
    entry["rows"] = _rows(row.get("children"))
    return entry
