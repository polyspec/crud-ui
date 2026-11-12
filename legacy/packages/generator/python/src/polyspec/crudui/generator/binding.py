"""Bind compiled fields to data as nodes of the recursive form grammar.

One template and one record evaluate every field: leaves, groups, collections
with their rows, and language groups. A declared layout replaces the inherited
one for a group's children and a line group ends it; rows keep their keys and
numbers; a sticky row header carries its depth.
"""

from collections.abc import Mapping
from typing import Any, cast

from polyspec.crudui.validator.group_source import group_choices, is_group_source
from polyspec.crudui.validator.jsvalue import JsonValue

from . import messages as messages_module
from .design import declared as design_declared
from .design import resolve as design_resolve
from .errors import FormError
from .messages import count as message_count
from .template import checked as checked_template
from .value import (
    MISSING,
    Value,
    classes,
    control_id,
    name as value_name,
    object_value,
    path as value_path,
    record,
    segments,
    string,
    style_value,
    translate,
    truthy,
)
from .widget import evaluate as widget_evaluate

__all__ = ["bind", "field", "language"]

_LANGUAGES = ("ko", "en", "ja", "zh")


def _model(members: dict[str, Any]) -> dict[str, Any]:
    """A model object without the members marked absent."""
    return record(members)


def language(options: Mapping[str, Any]) -> str:
    """The checked language option, defaulting to Korean; a null option is absent."""
    value = options.get("language")
    if value is None:
        return "ko"
    if not isinstance(value, str):
        raise FormError("INVALID_FORM_INPUT", "Language must be a string")
    return value


def bind(
    template: Mapping[str, Any], data: JsonValue, options: Mapping[str, Any]
) -> list[dict[str, Any]]:
    """Evaluate every field of one template against one record."""
    template = checked_template(template)
    data = object_value(data)
    options = dict(options)
    options["language"] = language(options)
    for name in ("keyPrefix", "idPrefix"):
        if options.get(name) is not None and not isinstance(options.get(name), str):
            raise FormError("INVALID_FORM_INPUT", f"{name} must be a string")
    if options.get("unsupported") is not None and options.get("unsupported") not in (
        "throw",
        "marker",
    ):
        raise FormError("INVALID_FORM_INPUT", "unsupported must be throw or marker")
    options["messages"] = messages_module.for_language(options["language"])
    options["keyPrefix"] = (
        options.get("keyPrefix")
        if options.get("keyPrefix") is not None
        else template.get("keyPrefix")
    )
    state = {"rowSegments": [], "rowNumbers": [], "stickyDepth": 0, **options}
    return [field(entry, entry["name"], data, state) for entry in template["fields"]]


def field(entry: Mapping[str, Any], path: str, data: Any, state: Any) -> dict[str, Any]:
    """The node for one field and its group, collection or language children."""
    spec = entry["spec"]
    # A group source lists the rows of its group in the root data as a choice list
    # (schema.md, "Choices from a repeated group"); compilation has checked the source.
    if is_group_source(spec.get("items")):
        choices = group_choices(spec["items"], data)
        spec = {**spec, "items": choices}
    design = design_resolve(
        spec.get("design"), data, segments(path), state["rowSegments"]
    )
    label = (
        translate(spec["label"], state["language"])
        if truthy(spec.get("label"))
        else MISSING
    )
    description = (
        translate(spec["description"], state["language"])
        if truthy(spec.get("description"))
        else MISSING
    )
    multiple = _multiple(spec)
    if multiple is not None:
        return _collection(
            entry, path, data, design, label, description, multiple, state
        )
    if spec.get("type") == "group":
        _check_group(value_path(data, path), path)
        layout = _declared_layout(spec)
        root = _root("group", path, design, spec)
        # A line group is one row in an inline layout, and its children take no inline layout.
        if layout == "line":
            root["className"] = classes(
                "crudui-node--inline" if state.get("layout") == "inline" else "",
                "crudui-node--line",
                root["className"],
            )
        return _model(
            {
                **root,
                "header": _header({"label": label, "description": description}, design),
                "body": _body(design["group"]["class"], design["group"]["style"]),
                "children": _children(entry, path, data, _layout_state(state, layout)),
            }
        )
    lang = spec.get("lang")
    if lang is True or isinstance(lang, dict):
        return _lang(spec, path, data, design, label, description, lang, state)
    return _leaf(spec, path, data, design, label, description, state)


def _declared_layout(spec: Mapping[str, Any]) -> Any:
    """The design.layout a group declares; compilation has checked the value."""
    design = spec.get("design")
    layout = design.get("layout") if isinstance(design, dict) else None
    return layout if isinstance(layout, str) else None


def _layout_state(state: Any, layout: Any) -> Any:
    """A declared layout replaces the inherited one, and a line ends it."""
    if layout is None:
        return state
    state = dict(state)
    state.pop("layout", None)
    if layout == "inline":
        state["layout"] = "inline"
    return state


def _multiple(spec: Mapping[str, Any]) -> dict[str, Any] | None:
    """Evaluated controls and limits for a repeated field, or None when it does not repeat."""
    multiple = spec.get("multiple")
    if multiple is True or multiple == "only":
        return {
            "only": multiple == "only",
            "copy": False,
            "sortable": False,
            "controls": "header",
            "header": "static",
        }
    if not isinstance(multiple, dict):
        return None
    settings: dict[str, Any] = {"only": multiple.get("only") is True}
    for key in ("min", "max"):
        value = multiple.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            settings[key] = value
    settings["copy"] = multiple.get("copy") is True
    settings["sortable"] = multiple.get("sortable") is True
    if isinstance(multiple.get("title"), str):
        settings["title"] = multiple["title"]
    settings["controls"] = (
        multiple.get("controls")
        if multiple.get("controls") in ("footer", "outline")
        else "header"
    )
    settings["header"] = "sticky" if multiple.get("header") == "sticky" else "static"
    return settings


def _root(kind: str, path: str, design: Any, spec: Mapping[str, Any]) -> dict[str, Any]:
    style = style_value(design["wrapper"]["style"])
    return _model(
        {
            "kind": kind,
            "path": path,
            "className": design["wrapper"]["class"],
            "style": style if style is not None else MISSING,
            "attributes": design_declared(spec.get("design"), True),
            "hidden": not design["show"],
        }
    )


def _header(parts: Mapping[str, Any], design: Any) -> Value:
    """A header with the given parts, or the missing marker when every part is empty."""
    present = {
        key: value
        for key, value in parts.items()
        if value is not MISSING and value != ""
    }
    if not present:
        return MISSING
    style = style_value(design["label"]["style"])
    return _model(
        {
            "className": design["label"]["class"],
            "style": style if style is not None else MISSING,
            **present,
        }
    )


def _body(
    class_name: str = "", style: str | None = None, identifier: str | None = None
) -> dict[str, Any]:
    style = style_value(style)
    return _model(
        {
            "className": class_name,
            "style": style if style is not None else MISSING,
            "id": identifier if identifier is not None else MISSING,
        }
    )


def _action(name: str, label: str, disabled: bool) -> dict[str, Any]:
    return {"name": name, "label": label, "disabled": disabled}


def _leaf(
    spec: Mapping[str, Any],
    path: str,
    data: Any,
    design: Any,
    label: Any,
    description: Any,
    state: Any,
) -> dict[str, Any]:
    field_type = string(spec.get("type", ""))
    value = value_path(data, path)
    root = _root("field", path, design, spec)
    # A field node of an inline layout is one row of a label column and a control column.
    inline = state.get("layout") == "inline"
    if inline:
        root["className"] = classes("crudui-node--inline", root["className"])
    if field_type in ("checkbox", "switcher"):
        identifier = control_id(state.get("idPrefix", "crudui"), path)
        # An inline layout writes the label in the label column of the header instead of the caption.
        header_label = inline and label is not MISSING and label != ""
        checked_value = spec.get("default") if value is MISSING else value
        # A switcher is a checkbox input announced and drawn as a switch.
        switcher = field_type == "switcher"
        checkbox = _model(
            {
                "id": identifier,
                "name": value_name(path, state.get("keyPrefix")),
                "className": classes(
                    "valid-target",
                    "crudui-input crudui-input--switch" if switcher else "",
                    design["main"]["class"],
                ),
                "checked": checked_value in (True, 1, "1"),
                "role": "switch" if switcher else MISSING,
                "caption": MISSING
                if header_label
                else ("" if label is MISSING else label),
                "attributes": design_declared(spec.get("design"), False),
            }
        )
        header = _header(
            {"label": label, "labelFor": identifier, "description": description}
            if header_label
            else {"description": description},
            design,
        )
        return _model({**root, "header": header, "body": _body(), "checkbox": checkbox})
    widget = widget_evaluate(
        cast(dict[str, Any], spec), value, path, design, state, state["rowSegments"]
    )
    if field_type == "hidden":
        return _model({**root, "body": _body(), "widget": widget})
    if label is not MISSING and label != "" and not widget.get("unsupported"):
        extra = widget.get("extra") if isinstance(widget, dict) else None
        file_id = (
            extra.get("file", {}).get("id")
            if isinstance(extra, dict) and "file" in extra
            else None
        )
        if file_id is not None:
            label_for = file_id
        else:
            found = widget.get("attrs", {}).get("id")
            label_for = found if found is not None else MISSING
    else:
        label_for = MISSING
    return _model(
        {
            **root,
            "header": _header(
                {"label": label, "labelFor": label_for, "description": description},
                design,
            ),
            "body": _body(),
            "widget": widget,
        }
    )


def _collection(
    entry: Mapping[str, Any],
    path: str,
    data: Any,
    design: Any,
    label: Any,
    description: Any,
    settings: Any,
    state: Any,
) -> dict[str, Any]:
    value = value_path(data, path)
    if value is MISSING:
        # Missing data has one initial row, or none in a data-only collection.
        keys = [] if settings["only"] else ["__0000000000000__"]
    elif isinstance(value, dict):
        keys = [str(key) for key in value]
    else:
        raise FormError(
            "INVALID_FORM_INPUT", f"Repeated data must be a keyed object: {path}"
        )
    item = "group" if entry["spec"].get("type") == "group" else "field"
    rows_state = (
        _layout_state(state, _declared_layout(entry["spec"]))
        if item == "group"
        else state
    )
    rows = [
        _row(
            entry, path, key, index, len(keys), item, label, settings, data, rows_state
        )
        for index, key in enumerate(keys)
    ]
    state_messages = state["messages"]
    controls: Any = MISSING
    if not keys and not settings["only"]:
        full = "max" in settings and len(keys) >= settings["max"]
        controls = {
            "placement": "footer",
            "label": state_messages["collectionControls"],
            "actions": [_action("add-row", state_messages["addRow"], full)],
        }
    header = _header(
        {
            "label": label,
            "description": description,
            "count": message_count(state_messages["count"], len(keys)),
        },
        design,
    )
    return _model(
        {
            **_root("collection", path, design, entry["spec"]),
            "header": header,
            "body": _body(),
            "item": item,
            "controls": controls,
            "children": rows,
        }
    )


def _row(
    entry: Mapping[str, Any],
    collection_path: str,
    key: str,
    index: int,
    count: int,
    item: str,
    label: Any,
    settings: Any,
    data: Any,
    state: Any,
) -> dict[str, Any]:
    spec = entry["spec"]
    state_messages = state["messages"]
    label = MISSING if label == "" else label
    row_path = f"{collection_path}.{key}"
    row_design = design_resolve(
        spec.get("design"),
        data,
        segments(row_path),
        [*state["rowSegments"], len(segments(collection_path))],
    )
    numbers = [*state["rowNumbers"], index + 1]
    sticky = settings["header"] == "sticky"
    row_state = {
        **state,
        "rowSegments": [*state["rowSegments"], len(segments(collection_path))],
        "rowNumbers": numbers,
        "stickyDepth": state["stickyDepth"] + (1 if sticky else 0),
    }
    full = "max" in settings and count >= settings["max"]
    actions = []
    if settings["sortable"]:
        actions.append(_action("move-up", state_messages["moveUp"], index == 0))
        actions.append(
            _action("move-down", state_messages["moveDown"], index == count - 1)
        )
    actions.append(_action("add-row", state_messages["addRow"], full))
    if settings["copy"]:
        actions.append(_action("copy-row", state_messages["copyRow"], full))
    actions.append(
        _action(
            "remove-row",
            state_messages["removeRow"],
            "min" in settings and count <= settings["min"],
        )
    )
    row = {"kind": "row", "key": key, "className": "", "hidden": False}
    # Rows of a data-only collection have no row controls.
    if not settings["only"]:
        row["controls"] = {
            "placement": settings["controls"],
            "label": state_messages["rowControls"],
            "actions": actions,
        }
    if sticky:
        row["sticky"] = True
        row["stickyDepth"] = state["stickyDepth"]
    number = ".".join(str(value) for value in numbers)
    if item == "field":
        widget = widget_evaluate(
            cast(dict[str, Any], spec),
            value_path(data, row_path),
            row_path,
            row_design,
            row_state,
            row_state["rowSegments"],
        )
        return _model(
            {
                **row,
                "header": _model({"className": "", "label": label, "number": number}),
                "body": _body(),
                "widget": widget,
            }
        )
    _check_group(value_path(data, row_path), row_path)
    children = _children(entry, row_path, data, row_state)
    nested = [child for child in children if child["kind"] == "collection"]
    summary = (
        state_messages["collapsed"]
        if not nested
        else message_count(
            state_messages["children"], sum(len(child["children"]) for child in nested)
        )
    )
    title: Any = MISSING
    if "title" in settings:
        value = value_path(data, f"{row_path}.{settings['title']}")
        title = (
            state_messages["untitled"]
            if value is MISSING or value is None or value == ""
            else string(value)
        )
    header = _model(
        {
            "className": "",
            "label": label,
            "number": number,
            "title": title,
            "summary": summary,
        }
    )
    body = _body(
        row_design["group"]["class"],
        row_design["group"]["style"],
        control_id(state.get("idPrefix", "crudui"), row_path) + ":body",
    )
    return _model(
        {
            **row,
            "header": header,
            "body": body,
            "collapsible": True,
            "expanded": row_path not in (state.get("collapsed") or ()),
            "toggleLabel": state_messages["toggleRow"],
            "children": children,
        }
    )


def _lang(
    spec: Mapping[str, Any],
    path: str,
    data: Any,
    design: Any,
    label: Any,
    description: Any,
    lang: Any,
    state: Any,
) -> dict[str, Any]:
    settings = lang if isinstance(lang, dict) else {}
    codes: Any = (
        settings.get("only")
        if isinstance(settings.get("only"), list) and settings.get("only")
        else _LANGUAGES
    )
    title = (
        translate(settings["title"], state["language"])
        if truthy(settings.get("title"))
        else ""
    )
    frame = settings.get("frame") is not False
    group_class = (
        settings["group_class"] if isinstance(settings.get("group_class"), str) else ""
    )
    children: list[dict[str, Any]] = []
    for code in codes:
        lang_path = f"{path}.{string(code)}"
        lang_design = design_resolve(
            spec.get("design"), data, segments(lang_path), state["rowSegments"]
        )
        children.append(
            {
                "kind": "lang-item",
                "lang": code,
                "className": "",
                "hidden": False,
                "header": {"className": "", "label": code},
                "body": _body(),
                "widget": widget_evaluate(
                    cast(dict[str, Any], spec),
                    value_path(data, lang_path),
                    lang_path,
                    lang_design,
                    state,
                    state["rowSegments"],
                ),
            }
        )
    header = _header(
        {"label": label, "description": description, "title": title}, design
    )
    root = _root("lang", path, design, spec)
    # A framed language group is a node modifier; the stylesheet draws the frame around its body.
    root["className"] = classes(
        "crudui-node--framed" if frame else "", root["className"]
    )
    return _model(
        {
            **root,
            "header": header,
            "body": _body(classes(group_class)),
            "children": children,
        }
    )


def _check_group(value: object, path: str) -> None:
    """Present group data, including a repeated group row, must be an object."""
    if value is not MISSING and not isinstance(value, dict):
        raise FormError("INVALID_FORM_INPUT", f"Group data must be an object: {path}")


def _children(
    entry: Mapping[str, Any], path: str, data: Any, state: Any
) -> list[dict[str, Any]]:
    return [
        field(child, f"{path}.{child['name']}", data, state)
        for child in entry["children"]
    ]
