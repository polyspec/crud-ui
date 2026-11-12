"""Row view state of form instances, kept outside the record data.

A view is `{"collapsed": [...]}`: the row paths `{collection}.{key}` rendered
collapsed, in the order the rows were collapsed, without duplicates. Every
function returns a new view and changes none that it receives.
"""

from collections.abc import Mapping, Sequence
from typing import Any

View = dict[str, list[str]]


def initial() -> View:
    """The view with no collapsed row."""
    return {"collapsed": []}


def _inside(row_path: str, path: str) -> bool:
    """Whether `path` is the row path or lies inside that row."""
    return path == row_path or path.startswith(f"{row_path}.")


def collapsible_rows(nodes: Sequence[Mapping[str, Any]]) -> list[str]:
    """The row paths of every collapsible row of the evaluated nodes, depth first."""
    found: list[str] = []
    for node in nodes:
        children = node.get("children") or []
        if node.get("kind") != "collection":
            found.extend(collapsible_rows(children))
            continue
        for row in children:
            if row.get("collapsible") is True:
                found.append(f"{node['path']}.{row['key']}")
            found.extend(collapsible_rows(row.get("children") or []))
    return found


def toggle(view: Mapping[str, Any], row_path: str) -> View:
    """Expand a collapsed row or collapse an expanded one, appending a collapsed row last."""
    collapsed = [path for path in view["collapsed"] if path != row_path]
    if len(collapsed) == len(view["collapsed"]):
        collapsed.append(row_path)
    return {"collapsed": collapsed}


def set_all_expanded(nodes: Sequence[Mapping[str, Any]], expanded: bool) -> View:
    """The view with no collapsed row, or the view that collapses every collapsible row."""
    return initial() if expanded else {"collapsed": collapsible_rows(nodes)}


def remove_row(view: Mapping[str, Any], row_path: str) -> View:
    """Drop the collapsed state of a removed row and of the rows inside it."""
    return {
        "collapsed": [path for path in view["collapsed"] if not _inside(row_path, path)]
    }


def rekey_row(view: Mapping[str, Any], old_path: str, new_path: str) -> View:
    """Move the collapsed state of a rekeyed row and of the rows inside it to the new path."""
    moved = [
        new_path + path[len(old_path) :] if _inside(old_path, path) else path
        for path in view["collapsed"]
    ]
    return {"collapsed": list(dict.fromkeys(moved))}
