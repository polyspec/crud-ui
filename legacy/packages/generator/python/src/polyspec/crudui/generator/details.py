"""Compose detail declarations and render one supplied record read-only."""

from collections.abc import Mapping
from typing import Any

from polyspec.crudui.validator.jsvalue import JsonValue

from . import lists as lists_module
from .errors import FormError
from .rendering import attrs as render_attrs
from .rendering import element as render_element
from .rendering import text as render_text
from .rendering import url as render_url
from .value import classes, object_value, spec_value, style_value

__all__ = ["build", "render"]


def build(
    spec: dict[str, Any], record: JsonValue, options: Mapping[str, Any]
) -> dict[str, Any]:
    """A detail model by delegating fields and cells to the list engine."""
    from .input_text import inputs as check_inputs
    from .input_text import specification as check_specification

    check_specification(spec, options)
    check_inputs(
        [("record", record)], options, ("basepath", "data", "language", "layout")
    )
    spec = spec_value(_root(spec, "Detail specification must be an object"))
    # Argument shapes in argument order, then the declaration, then options.
    record = _root(record, "Detail record must be an object")
    if "fields" not in spec:
        raise FormError(
            "INVALID_FORM_INPUT", "Detail specification must declare fields"
        )
    # An absent or null context is empty; data is a fixed object option.
    data = options.get("data")
    if data is not None and not isinstance(data, dict):
        raise FormError("INVALID_FORM_INPUT", "Detail context must be an object")
    # Page and total are list options; a detail neither checks nor uses them.
    model = lists_module.build(
        spec,
        [record],
        {key: value for key, value in options.items() if key not in ("page", "total")},
        "detail",
        "fields",
    )
    fields: list[dict[str, Any]] = []
    columns = model["columns"]
    cells = model["rows"][0]["cells"] if model["rows"] else []
    for index, column in enumerate(columns):
        if index >= len(cells):
            continue
        cell = cells[index]
        fields.append(
            {
                "key": column["key"],
                "label": column["label"],
                "format": cell["format"],
                "value": cell["value"],
                "display": cell["display"],
                "design": cell["design"],
            }
        )
    return {"fields": fields, "actions": model["actions"], "design": model["design"]}


def _root(value: object, message: str) -> dict[str, Any]:
    """A root object argument: a dictionary, never an array."""
    if not isinstance(value, dict):
        raise FormError("INVALID_FORM_INPUT", message)
    return object_value(value)


def render(spec: dict[str, Any], record: JsonValue, options: Mapping[str, Any]) -> str:
    """One read-only detail: image preload links, the actions and the definition list."""
    model = build(spec, record, options)
    design = model["design"]
    attrs = {"class": classes("crudui-detail", design["wrapper"]["class"])}
    style = style_value(design["wrapper"]["style"])
    if style is not None:
        attrs["style"] = style
    body = ""
    for field in model["fields"]:
        cell = {
            "display": field["display"],
            "design": field["design"],
            "format": field["format"],
        }
        body += render_element(
            "div",
            {"class": "crudui-detail__field"},
            render_element(
                "dt", {"class": "crudui-detail__label"}, render_text(field["label"])
            )
            + lists_module.render_cell(
                cell,
                "dd",
                f"crudui-detail__value crudui-value crudui-value--{field['format']['type']}",
            ),
        )
    return (
        _preloads(model)
        + lists_module.actions_html(model["actions"], "crudui-detail")
        + render_element("dl", attrs, body)
    )


def _preloads(model: dict[str, Any]) -> str:
    seen: set[str] = set()
    html = ""
    for field in model["fields"]:
        display = field["display"]
        if not isinstance(display, dict) or display.get("kind") != "image":
            continue
        source = display.get("src", "")
        if source == "" or source.lower().startswith("data:") or source in seen:
            continue
        seen.add(source)
        html += f"<link{render_attrs({'rel': 'preload', 'as': 'image', 'href': render_url(source)})}/>"
    return html
