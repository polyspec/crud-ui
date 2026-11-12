"""The structured condition editor (docs/spec/schema.md and docs/spec/form-markup.md, Structured condition editor).

The editor model of a condition field: the nodes of a value that the editor shows, or the named error of a
value that it does not show, and the compilation checks of `design.editor` and `options.fields`.
"""

import math
from typing import Any

from polyspec.crudui.validator.values import is_empty_value

from .errors import FormError
from .value import MISSING, condition

#: The comparison operators that the editor offers, in their order (CUSC-073, CUSC-085).
OPS = ("eq", "ne", "lt", "le", "gt", "ge", "in", "has")

#: The deepest level of a condition tree; the root is level 1 (CUSC-075).
_MAX_DEPTH = 32


def is_empty(value: object) -> bool:
    """An empty value (CUVR-020), a missing value included."""
    return value is MISSING or is_empty_value(value)


def _scalar(value: object) -> bool:
    if isinstance(value, bool) or isinstance(value, str):
        return True
    return isinstance(value, (int, float)) and math.isfinite(value)


def _node(value: object, path: str, depth: int, judge: bool) -> dict[str, Any] | None:
    """The editor node of a condition, or None when the editor does not show it (CUSC-086)."""
    if depth > _MAX_DEPTH or not isinstance(value, dict):
        return None
    keys = list(value)
    if len(keys) == 1 and keys[0] in ("all", "any"):
        mode = keys[0]
        items = value[mode]
        if not isinstance(items, list):
            return None
        nodes = []
        for index, item in enumerate(items):
            child = _node(item, f"{path}/{mode}/{index}", depth + 1, judge)
            if child is None:
                return None
            nodes.append(child)
        return {"kind": "group", "path": path, "mode": mode, "items": nodes}
    if keys == ["judge"]:
        text = value["judge"]
        return (
            {"kind": "judge", "path": path, "text": text}
            if judge and isinstance(text, str)
            else None
        )
    if len(keys) == 3 and set(keys) == {"field", "op", "value"}:
        field, op, operand = value["field"], value["op"], value["value"]
        if not isinstance(field, str) or op not in OPS:
            return None
        valid = (
            isinstance(operand, list) and all(_scalar(item) for item in operand)
            if op == "in"
            else _scalar(operand)
        )
        if not valid:
            return None
        return {
            "kind": "comparison",
            "path": path,
            "field": field,
            "op": op,
            "value": condition(operand),
        }
    return None


def editor(
    value: object,
    control_id: str,
    spec: dict[str, Any],
    path: str,
    messages: dict[str, str],
) -> dict[str, Any]:
    """The editor model of a structured condition field (CUMK-067), or its named error (CUMK-068)."""
    validate = spec.get("validate")
    judge = isinstance(validate, dict) and validate.get("conditionTree") == "judge"
    root = (
        {"kind": "group", "path": "", "mode": "all", "items": []}
        if is_empty(value)
        else _node(value, "", 1, judge)
    )
    if root is None:
        return {
            "for": control_id,
            "error": messages["conditionInvalid"].replace("{path}", path, 1),
        }
    options = spec.get("options")
    fields = (
        options.get("fields")
        if isinstance(options, dict) and isinstance(options.get("fields"), list)
        else None
    )
    labels = {
        "mode": messages["conditionMode"],
        "addComparison": messages["conditionAddComparison"],
        "addGroup": messages["conditionAddGroup"],
        "addJudge": messages["conditionAddJudge"],
        "remove": messages["conditionRemove"],
    }
    return {
        "for": control_id,
        "judge": judge,
        "fields": fields,
        "labels": labels,
        "root": root,
    }


def fields_error(path: str) -> FormError:
    """The error of an options.fields that breaks its rule (CUSC-084)."""
    return FormError(
        "INVALID_FORM_INPUT",
        f"Invalid options.fields at {path}: expected distinct field names of a structured condition editor",
    )


def check_editor(spec: dict[str, Any], path: str) -> None:
    """Reject a design.editor other than text or structured (CUSC-083) and an options.fields outside a structured
    editor or with names that break its rule (CUSC-084)."""
    design = spec.get("design")
    editor_value = (
        design["editor"] if isinstance(design, dict) and "editor" in design else "text"
    )
    if editor_value not in ("text", "structured") or isinstance(editor_value, bool):
        raise FormError(
            "INVALID_FORM_INPUT",
            f"Invalid design.editor at {path}: expected text or structured",
        )
    options = spec.get("options")
    if not isinstance(options, dict) or "fields" not in options:
        return
    names = options["fields"]
    valid = (
        isinstance(names, list)
        and all(isinstance(name, str) and not is_empty(name) for name in names)
        and len(set(names)) == len(names)
    )
    if editor_value != "structured" or not valid:
        raise fields_error(path)
