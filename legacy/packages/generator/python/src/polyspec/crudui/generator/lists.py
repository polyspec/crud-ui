"""Compose list declarations, evaluate supplied rows and render table or card HTML.

The member map (`columns`) and a list `search` with `$ref` or `$patch` are
composed with the same engine the form specification uses, the composed
specification is scanned for forbidden keys, and its declarations are checked
before any row is evaluated.
"""

import math
import re
from collections.abc import Mapping
from typing import Any, TypeGuard, cast

from polyspec.crudui.validator.compose import compose_properties
from polyspec.crudui.validator.forbidden import scan_forbidden_keys
from polyspec.crudui.validator.jsvalue import JsonValue

from . import dates as dates_module
from .choice_list import is_choice_list, pairs
from .design import appearance as design_appearance
from .design import flag as design_flag
from .design import resolve as design_resolve
from .display_declaration import check as check_display_declaration
from .errors import FormError
from .interface_messages import LIST
from .numbers import fixed as fixed_number
from .rendering import attrs as render_attrs
from .rendering import element as render_element
from .rendering import text as render_text
from .rendering import url as render_url
from .template import loader as template_loader
from .value import (
    MISSING,
    classes,
    get,
    object_value,
    path as value_path,
    record,
    scalar,
    segments,
    style_value,
    translate,
)

__all__ = [
    "actions_html",
    "build",
    "build_public",
    "render",
    "render_cell",
    "safe_integer",
]


def build_public(
    spec: dict[str, Any], rows: Any, options: Mapping[str, Any]
) -> dict[str, Any]:
    """One read-only list model from validated public inputs."""
    _check_input(spec, rows, options)
    return build(object_value(spec), rows, options, "list", "columns")


def _is_object(value: object) -> TypeGuard[dict[str, Any]]:
    """A dictionary."""
    return isinstance(value, dict)


def _check_input(spec: dict[str, Any], rows: Any, options: Mapping[str, Any]) -> None:
    """The list input in the order every runtime uses (docs/spec/display-formats.md)."""
    if isinstance(spec, list) or not _is_object(spec):
        raise FormError("INVALID_FORM_INPUT", "List specification must be an object")
    if not isinstance(rows, list):
        raise FormError("INVALID_FORM_INPUT", "List rows must be an array")
    for row in rows:
        if not _is_object(row):
            raise FormError("INVALID_FORM_INPUT", "List rows must be objects")
    if "columns" not in spec:
        raise FormError("INVALID_FORM_INPUT", "List specification must declare columns")
    _option_object(options, "data", "List context must be an object")
    _count_options(options)


def _option_object(
    options: Mapping[str, Any], key: str, message: str
) -> dict[str, Any] | None:
    """An absent or null option is none; any other value must be an object."""
    value = options.get(key)
    if value is not None and not _is_object(value):
        raise FormError("INVALID_FORM_INPUT", message)
    return value


def actions_html(actions: Any, block: str) -> str:
    """The actions of a list or detail: one action span per action.

    Each span holds a link or a button; the text is empty without actions.
    """
    if not actions:
        return ""
    html = ""
    for action in actions:
        attrs_action = {}
        tag = "button"
        if (
            isinstance(action.get("format"), dict)
            and action["format"].get("type") == "link"
        ):
            tag = "a"
            options = action["format"].get("options") or {}
            href = options.get("href", "#")
            attrs_action["href"] = href if isinstance(href, str) else "#"
            if isinstance(options.get("target"), str):
                attrs_action["target"] = options["target"]
        else:
            attrs_action["type"] = "button"
        for attribute, script in (action.get("behavior") or {}).items():
            attrs_action[attribute] = script
        html += render_element(
            "span",
            {"class": f"{block}__action", "data-action": action["key"]},
            render_element(tag, attrs_action, render_text(action["label"], True), True),
        )
    return render_element("div", {"class": f"{block}__actions"}, html)


def render(spec: dict[str, Any], rows: Any, options: Mapping[str, Any]) -> str:
    """Composed list columns, supplied rows, the description, actions and pagination."""
    _check_input(spec, rows, options)
    # An absent or null layout selects the table.
    layout = options.get("layout")
    layout = "table" if layout is None else layout
    if layout not in ("table", "card"):
        raise FormError("INVALID_FORM_INPUT", "List layout must be table or card")
    vm = build(object_value(spec), rows, options, "list", "columns")
    attrs = _node("crudui-list", vm["design"]["wrapper"])
    body = ""
    if vm["description"] != "":
        body += render_element(
            "p", {"class": "crudui-list__description"}, render_text(vm["description"])
        )
    body += actions_html(vm["actions"], "crudui-list")
    if not vm["rows"]:
        body += render_element(
            "div", {"class": "crudui-list__empty"}, render_text(vm["empty"])
        )
    elif layout == "table":
        headers = ""
        for column in vm["columns"]:
            header = _node("crudui-list__heading", column["design"]["main"])
            if column["field"] != "":
                header["data-field"] = column["field"]
            if column["sortable"]:
                header["data-sortable"] = "true"
            if "sort" in vm and vm["sort"]["field"] in (column["field"], column["key"]):
                header["data-sort-dir"] = vm["sort"]["dir"]
            headers += render_element(
                "th",
                header,
                render_element(
                    "span",
                    {"class": "crudui-list__heading-label"},
                    render_text(column["label"]),
                )
                + (
                    render_element("span", {"class": "crudui-list__sort"}, "↕")
                    if column["sortable"]
                    else ""
                ),
            )
        body_rows = ""
        for row in vm["rows"]:
            cells = ""
            for cell in row["cells"]:
                cells += render_cell(
                    cell,
                    "td",
                    f"crudui-list__cell crudui-value crudui-value--{cell['format']['type']}",
                )
            body_rows += render_element("tr", {}, cells)
        body += render_element(
            "table",
            {"class": "crudui-list__table"},
            render_element("thead", {}, render_element("tr", {}, headers))
            + render_element("tbody", {}, body_rows),
        )
    else:
        cards = ""
        for row in vm["rows"]:
            cells = ""
            for index, cell in enumerate(row["cells"]):
                cell_class = classes(
                    f"crudui-list__cell crudui-value crudui-value--{cell['format']['type']}",
                    cell["design"]["main"]["class"],
                )
                cells += render_element(
                    "div",
                    {"class": cell_class},
                    render_element(
                        "span",
                        {"class": "crudui-list__card-label"},
                        render_text(vm["columns"][index]["label"]),
                    )
                    + render_cell(cell, "span", "crudui-list__card-value"),
                )
            cards += render_element("article", {"class": "crudui-list__card"}, cells)
        body += render_element("div", {"class": "crudui-list__cards"}, cards)
    if vm["pagination"]["enabled"]:
        pagination = {
            "class": "crudui-list__pagination",
            "data-mode": vm["pagination"]["mode"],
            "data-per-page": str(vm["pagination"]["perPage"]),
            "data-page": str(vm["pagination"]["page"]),
        }
        if "total" in vm["pagination"]:
            pagination["data-total"] = str(vm["pagination"]["total"])
        controls = ""
        for button in vm["pagination"]["buttons"]:
            button_attrs = {
                "type": "button",
                "class": f"crudui-list__pagination-{'prev' if button['role'] == 'previous' else button['role']}",
                "data-page": str(button["page"]),
                "aria-label": button["label"],
            }
            if button["current"]:
                button_attrs["aria-current"] = "page"
            if button["disabled"]:
                button_attrs["disabled"] = ""
            # The button's text follows its role.
            label = {"previous": "‹", "next": "›"}.get(
                button["role"], str(button["page"])
            )
            controls += render_element("button", button_attrs, label)
        body += render_element("nav", pagination, controls)
    return _preloads(vm) + render_element("div", attrs, body)


def build(
    spec: dict[str, Any], rows: Any, options: Mapping[str, Any], own: str, members: str
) -> dict[str, Any]:
    """Ordered list and cell models from checked input.

    `own` is `list` or `detail` and `members` names the member map, `columns`
    or `fields`.
    """
    from .value import spec_value

    spec = cast(Any, spec_value(spec))
    language = options.get("language", "ko")
    _option_object(options, "data", "List context must be an object")
    data: Any = object_value(options.get("data") or {})
    if not isinstance(spec.get(members), dict):
        raise FormError(
            "INVALID_FORM_INPUT", f"Invalid {members} at {own}: expected an object"
        )
    loader = template_loader(options)
    basepath = options.get("basepath", "")
    columns: dict[str, Any] = compose_properties(dict(spec[members]), loader, basepath)
    search = spec.get("search")
    compose_search = (
        own == "list"
        and isinstance(search, dict)
        and ("$ref" in search or "$patch" in search)
    )
    # The composed specification keeps the member order of the declared one.
    composed: dict[str, Any] = {}
    for key, value in spec.items():
        if key == members:
            composed[key] = dict(columns)
        elif key == "search" and compose_search:
            composed[key] = dict(
                compose_properties(dict(cast(dict[str, Any], search)), loader, basepath)
            )
        else:
            composed[key] = value
    spec = composed
    # The forbidden-key scan and then the declarations, as the display format
    # specification orders them.
    scan_forbidden_keys(spec)
    check_display_declaration(spec, own, members)
    column_models: list[Any] = []
    column_specs: list[Any] = []
    for key, raw in columns.items():
        raw = dict(raw)
        design = design_resolve(raw.get("design"), data, [], [])
        if not design["show"]:
            continue
        column_models.append(
            {
                "key": str(key),
                "field": raw["field"] if isinstance(raw.get("field"), str) else "",
                "label": translate(raw["label"], language)
                if "label" in raw
                else str(key),
                "format": _format(raw.get("format")),
                "sortable": design_flag(raw.get("sortable"), data, [], []),
                "design": design,
            }
        )
        column_specs.append(raw)
    row_models = []
    for row in rows:
        if not _is_object(row):
            raise FormError("INVALID_FORM_INPUT", "List rows must be objects")
        row = object_value(row)
        cells = []
        for index, column in enumerate(column_models):
            path = column["field"]
            cell_value = value_path(row, path) if path != "" else MISSING
            # A model is JSON: a path absent from the row is null, and the member is always present.
            cells.append(
                record(
                    {
                        "format": column["format"],
                        "value": None if cell_value is MISSING else cell_value,
                        "display": _display(
                            column["format"], cell_value, row, segments(path), language
                        ),
                        "design": design_resolve(
                            column_specs[index].get("design"), row, segments(path), []
                        ),
                    }
                )
            )
        row_models.append({"cells": cells})
    pagination = _pagination(spec.get("pagination"), _count_options(options), language)
    sort = (
        {
            "field": spec["sort"]["field"],
            "dir": "desc" if spec["sort"].get("dir") == "desc" else "asc",
        }
        if isinstance(spec.get("sort"), dict)
        and isinstance(spec["sort"].get("field"), str)
        and spec["sort"]["field"] != ""
        else MISSING
    )
    actions = []
    if isinstance(spec.get("actions"), dict):
        for key, raw in spec["actions"].items():
            # A script string: a button that runs the script when it is clicked.
            if isinstance(raw, str):
                actions.append({"key": key, "label": key, "behavior": {"onclick": raw}})
                continue
            raw = dict(raw)
            label = translate(raw["label"], language) if "label" in raw else key
            # An action object with a script is the object form of a script action.
            if isinstance(raw.get("script"), str):
                actions.append(
                    {"key": key, "label": label, "behavior": {"onclick": raw["script"]}}
                )
                continue
            action = {"key": key, "label": label}
            if "format" in raw:
                action["format"] = _format(raw["format"])
            behavior = {}
            if isinstance(raw.get("behavior"), dict):
                for event, entry in raw["behavior"].items():
                    script = (
                        entry
                        if isinstance(entry, str)
                        else (entry.get("script") if isinstance(entry, dict) else None)
                    )
                    if isinstance(script, str):
                        behavior[event] = script
            if behavior:
                action["behavior"] = behavior
            actions.append(action)
    # An absent or null empty uses the interface message; a declared text is used as declared.
    declared_empty = spec.get("empty")
    empty = (
        _messages(language)["emptyList"]
        if declared_empty is None
        else translate(declared_empty, language)
    )
    model: dict[str, Any] = {
        "columns": column_models,
        "rows": row_models,
        "pagination": pagination,
        "sort": sort,
        "actions": actions,
        "empty": empty,
        "description": translate(spec.get("description"), language),
        "design": design_resolve(spec.get("design"), data, [], []),
    }
    return record(model)


def safe_integer(value: Any, minimum: int) -> int | None:
    """An int or float whose value is an integer from `minimum` to 2^53 - 1, as int; else None."""
    if isinstance(value, bool):
        return None
    integral = isinstance(value, int) or (
        isinstance(value, float) and math.isfinite(value) and math.floor(value) == value
    )
    if not integral or value < minimum or value > 9007199254740991:
        return None
    # An integral float such as 2.0 or -0.0 is the integer 2 or 0.
    return int(value)


def _count_options(options: Mapping[str, Any]) -> dict[str, int | None]:
    """The page and total options, checked in that order.

    Absent or null is none; otherwise an integer from 1 (page) or 0 (total) to
    2^53 - 1.
    """
    counts: dict[str, int | None] = {}
    for key, minimum, message in (
        ("page", 1, "List page must be a positive integer"),
        ("total", 0, "List total must be a nonnegative integer"),
    ):
        value = options.get(key)
        if value is None:
            counts[key] = None
            continue
        found = safe_integer(value, minimum)
        if found is None:
            raise FormError("INVALID_FORM_INPUT", message)
        counts[key] = found
    return counts


def _pagination(
    declared: Any, counts: Mapping[str, int | None], language: str
) -> dict[str, Any]:
    """The pagination model in member order: enabled, then the enabled paging members."""
    enabled = declared is True or isinstance(declared, dict)
    pagination: dict[str, Any] = {"enabled": enabled}
    per_page = 20
    if enabled:
        per_page = (
            int(declared["per_page"])
            if isinstance(declared, dict) and "per_page" in declared
            else 20
        )
        pagination["perPage"] = per_page
        pagination["mode"] = (
            declared.get("mode")
            if isinstance(declared, dict) and "mode" in declared
            else "pages"
        )
        pagination["page"] = counts["page"] if counts["page"] is not None else 1
    elif counts["page"] is not None:
        pagination["page"] = counts["page"]
    if counts["total"] is not None:
        pagination["total"] = counts["total"]
    if enabled:
        page_count = (
            0
            if counts["total"] is None
            else max(1, math.ceil(counts["total"] / per_page))
        )
        pagination["pageCount"] = page_count
        # Without a total the current page is 1; a page after the last page selects the last page.
        current = min(page_count, pagination["page"]) if page_count > 0 else 1
        messages = _messages(language)

        def button(
            role: str, page: Any, label: str, is_current: bool, disabled: bool
        ) -> dict[str, Any]:
            return {
                "role": role,
                "page": page,
                "label": label,
                "current": is_current,
                "disabled": disabled,
            }

        buttons = [
            button(
                "previous",
                max(1, current - 1),
                messages["previousPage"],
                False,
                current <= 1 or page_count == 0,
            )
        ]
        for value in _pagination_pages(current, page_count):
            buttons.append(
                button(
                    "page",
                    value,
                    messages["page"].replace("{page}", str(value)),
                    value == current,
                    value == current,
                )
            )
        buttons.append(
            button(
                "next",
                min(page_count, current + 1) if page_count > 0 else 1,
                messages["nextPage"],
                False,
                page_count == 0 or current >= page_count,
            )
        )
        pagination["buttons"] = buttons
    return pagination


def _pagination_pages(page: int, page_count: int) -> list[int]:
    """The bounded page-number window: every page up to seven pages.

    Otherwise the first, previous, current, next and last page.
    """
    if page_count <= 7:
        return list(range(1, page_count + 1)) if page_count > 0 else []
    ordered = [1, max(1, page - 1), page, min(page_count, page + 1), page_count]
    out = []
    for value in ordered:
        if value not in out:
            out.append(value)
    return out


def _messages(language: str) -> dict[str, str]:
    """The list interface text of a display language: its entry, else English."""
    return LIST.get(language, LIST["en"])


def _preloads(vm: Mapping[str, Any]) -> str:
    seen = set()
    html = ""
    for row in vm["rows"]:
        for cell in row["cells"]:
            display = cell["display"]
            if not isinstance(display, dict) or display.get("kind") != "image":
                continue
            source = display["src"]
            if source == "" or source.lower().startswith("data:") or source in seen:
                continue
            seen.add(source)
            html += f"<link{render_attrs({'rel': 'preload', 'as': 'image', 'href': render_url(source)})}/>"
    return html


def _node(base: Any, design: Any) -> dict[str, Any]:
    attrs = {"class": classes(base, design["class"])}
    style = style_value(design["style"])
    if style is not None:
        attrs["style"] = style
    return attrs


def _format(format_value: object) -> Any:
    options = format_value if isinstance(format_value, dict) else {}
    if isinstance(format_value, str) and format_value != "":
        kind = format_value
    elif isinstance(options.get("type"), str) and options["type"] != "":
        kind = options["type"]
    else:
        kind = "text"
    return {"type": kind, "options": options}


def _display(format_value: Any, value: Any, row: Any, path: Any, language: str) -> Any:
    """One display cell of a column format."""
    options = format_value["options"]
    text = scalar(value)
    kind = format_value["type"]
    if kind == "date":
        date = dates_module.parse_utc(text)
        if date is None:
            return text
        pattern = (
            options.get("pattern")
            if isinstance(options.get("pattern"), str) and options["pattern"] != ""
            else "YYYY-MM-DD"
        )
        year, month, day, hour, minute, second = dates_module.parts_utc(date)
        year_text = f"{year:04d}" if year >= 0 else f"-{-year:04d}"
        return (
            pattern.replace("YYYY", year_text)
            .replace("MM", f"{month:02d}")
            .replace("DD", f"{day:02d}")
            .replace("HH", f"{hour:02d}")
            .replace("mm", f"{minute:02d}")
            .replace("ss", f"{second:02d}")
        )
    if kind == "number":
        from polyspec.crudui.validator.jsvalue import js_number

        number = js_number(text)
        if number is None or not math.isfinite(number):
            return text
        places = options.get("decimals")
        if isinstance(places, (int, float)) and not isinstance(places, bool):
            body = fixed_number(number, places)
        else:
            body = scalar(number)
        if options.get("thousands"):
            whole, dot, fraction = body.partition(".")
            whole = re.sub(r"\B(?=(\d{3})+(?!\d))", ",", whole)
            body = whole + dot + fraction
        return (
            translate(options.get("prefix"), language)
            + body
            + translate(options.get("suffix"), language)
        )
    if kind == "badge":
        variant = get(options.get("map"), text)
        if isinstance(variant, dict):
            label = translate(variant, language)
            return {"kind": "badge", "variant": label, "label": label}
        return {"kind": "badge", "variant": scalar(variant), "label": text}
    if kind == "link":
        href = options.get("href")
        href = (
            href
            if isinstance(href, str)
            else (
                design_appearance(href, row, path, []) if isinstance(href, dict) else ""
            )
        )
        return record(
            {
                "kind": "link",
                "href": _interpolate(href, row, value),
                "text": translate(options["text"], language)
                if "text" in options and options["text"] != ""
                else text,
                "target": options["target"]
                if isinstance(options.get("target"), str) and options["target"] != ""
                else MISSING,
            }
        )
    if kind == "choice-label":
        items = options.get("items")
        if is_choice_list(items):
            for choice, label in pairs(items) or []:
                if choice == text:
                    return translate(label, language)
            return text
        if (isinstance(items, dict) and "model" not in items) or isinstance(
            items, list
        ):
            found = get(items, text)
            if found is not MISSING:
                # A choice label is content: a string or a language map.
                return translate(cast(JsonValue, found), language)
        return text
    if kind == "bool":
        if isinstance(value, bool):
            truth = value
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            truth = value != 0
        elif isinstance(value, str):
            truth = value not in ("", "0", "false")
        else:
            truth = value is not None and value is not MISSING
        option_label: Any = get(options, "true" if truth else "false")
        return {
            "kind": "bool",
            "value": truth,
            "label": translate(option_label, language)
            if option_label is not MISSING and option_label is not None
            else ("true" if truth else "false"),
            "as": options["as"]
            if isinstance(options.get("as"), str) and options["as"] != ""
            else "text",
        }
    if kind == "image":
        return record(
            {
                "kind": "image",
                "src": text,
                "alt": _interpolate(
                    translate(options.get("alt"), language), row, value
                ),
                "width": scalar(options["width"]) if "width" in options else MISSING,
                "height": scalar(options["height"]) if "height" in options else MISSING,
            }
        )
    if kind == "html":
        return {"kind": "html", "html": text}
    limit = options.get("truncate")
    # Only a number limits the text; its integer part counts Unicode code points.
    if isinstance(limit, (int, float)) and not isinstance(limit, bool) and limit >= 1:
        limit = math.floor(limit)
        if len(text) > limit:
            return text[: int(limit)] + "…"
    return text


def _interpolate(template: str, row: Any, cell_value: Any) -> str:
    """Replace `{=path}` references with the row's values."""

    def replace(match: re.Match[str]) -> str:
        path = match.group(0)[2:-1]
        value = cell_value if path == "field" else value_path(row, path)
        return scalar(cell_value if value is MISSING else value)

    return re.sub(r"\{=[A-Za-z_][\w.]*\}", replace, template, flags=re.ASCII)


def render_cell(cell: Any, tag: str, base: Any) -> str:
    """One already-evaluated display cell for another read-only renderer."""
    display = cell["display"]
    if isinstance(display, str):
        body = render_text(display)
    else:
        kind = display.get("kind")
        if kind == "badge":
            body = render_element(
                "span",
                {
                    "class": "crudui-badge",
                    **(
                        {"data-crudui-variant": display["variant"]}
                        if display["variant"] != ""
                        else {}
                    ),
                },
                render_text(display["label"]),
            )
        elif kind == "link":
            body = render_element(
                "a",
                {
                    **(
                        {"href": render_url(display["href"])}
                        if "href" in display
                        else {}
                    ),
                    **({"target": display["target"]} if "target" in display else {}),
                },
                render_text(display["text"]),
            )
        elif kind == "image":
            values = {"src": render_url(display["src"]), "alt": display["alt"]}
            if "width" in display:
                values["width"] = display["width"]
            if "height" in display:
                values["height"] = display["height"]
            body = f"<img{render_attrs(values)}/>"
        elif kind == "bool":
            if display["as"] == "check":
                body = render_element(
                    "span",
                    {
                        "class": "crudui-bool crudui-bool--check",
                        "data-crudui-state": "true" if display["value"] else "false",
                        "aria-label": display["label"],
                    },
                    "✔" if display["value"] else "✘",
                )
            elif display["as"] == "icon":
                body = render_element(
                    "span",
                    {
                        "class": "crudui-bool crudui-bool--icon",
                        "data-crudui-state": "true" if display["value"] else "false",
                        "aria-label": display["label"],
                    },
                )
            else:
                body = render_element(
                    "span",
                    {
                        "class": "crudui-bool crudui-bool--text",
                        "data-crudui-state": "true" if display["value"] else "false",
                    },
                    render_text(display["label"]),
                )
        else:
            body = display["html"]
    return render_element(tag, _node(base, cell["design"]["main"]), body)
