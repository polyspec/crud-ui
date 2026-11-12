"""Serialize evaluated form models as HTML.

Text and attribute values are escaped; the javascript-URL check blocks a
script scheme between control characters. Input elements serialize their
name, checked and value attributes after the control attributes, and a
style attribute after the other declared attributes.
"""

import re

from collections.abc import Mapping
from typing import Any

from .condition_editor import OPS
from .style import rendered as style_rendered
from .value import MISSING, classes, scalar

__all__ = ["attrs", "element", "form", "text", "url"]

_SCRIPT_URL = re.compile(
    r"^[\x00-\x1f ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r"
    r"[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:",
    re.IGNORECASE,
)
_REACT_ATTRIBUTE_NAMES = {
    "autocomplete": "autoComplete",
    "readonly": "readOnly",
    "autofocus": "autofocus",
    "tabindex": "tabindex",
    "maxlength": "maxLength",
    "minlength": "minLength",
    "colspan": "colSpan",
    "rowspan": "rowSpan",
}


def text(value: str, raw: bool = False) -> str:
    """Escape ordinary text, or explicit raw-control text."""
    if raw:
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#x27;")
    )


def url(value: str) -> str:
    """Reject javascript URLs in ordinary link and image attributes."""
    if _SCRIPT_URL.match(value) is not None:
        return "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
    return value


def attrs(values: Mapping[str, Any], raw: bool = False) -> str:
    """Escape attributes and serialize ordinary or explicit raw styles."""
    out = ""
    for name, value in values.items():
        if not raw and name == "style" and isinstance(value, str):
            value = style_rendered(value)
        if value is None or value is MISSING:
            continue
        if raw:
            escaped = (
                scalar(value)
                .replace("&", "&amp;")
                .replace('"', "&quot;")
                .replace("<", "&lt;")
            )
        else:
            escaped = text(scalar(value))
            name = _REACT_ATTRIBUTE_NAMES.get(name, name)
        out += f' {name}="{escaped}"'
    return out


def element(
    tag: str, values: Mapping[str, Any] | None = None, body: str = "", raw: bool = False
) -> str:
    """A non-void element with an already rendered body."""
    return f"<{tag}{attrs(values or {}, raw)}>{body}</{tag}>"


def _control_attrs(values: Mapping[str, Any]) -> dict[str, Any]:
    """A style attribute moves after the other declared attributes."""
    values = dict(values)
    if "style" in values:
        style = values.pop("style")
        values["style"] = style
    return values


def _input(values: Mapping[str, Any], raw: bool = False) -> str:
    if not raw:
        values = dict(values)
        trailing: dict[str, Any] = {}
        for key in ("name", "checked", "value"):
            if key in values:
                trailing[key] = values.pop(key)
        values = {**_control_attrs(values), **trailing}
    return f"<input{attrs(values, raw)}{'>' if raw else '/>'}"


def _script(script: str) -> str:
    return f'<script nonce="">{script}</script>'


def form(
    nodes: list[Mapping[str, Any]],
    buttons: list[Any],
    messages: Mapping[str, Any],
    model: Mapping[str, Any] | None = None,
    description: str = "",
) -> str:
    """The complete form: the form element and hidden inputs of the model around the block.

    The crudui-form block holds the root description when it is not empty, the
    form errors, the nodes and the footer.
    """
    model = model or _EMPTY_MODEL
    description_html = (
        ""
        if description == ""
        else element("p", {"class": "crudui-form__description"}, text(description))
    )
    footer = element(
        "div",
        {"class": "crudui-form__footer"},
        element(
            "div",
            {
                "class": "crudui-controls",
                "role": "group",
                "aria-label": messages["formActions"],
            },
            _buttons_html(buttons),
        ),
    )
    form_errors = (
        ""
        if not model["formErrors"]
        else element(
            "div",
            {"class": "crudui-form__errors"},
            "".join(
                element("p", {"class": "crudui-form__error"}, text(item))
                for item in model["formErrors"]
            ),
        )
    )
    body = "".join(_node(vm, model["nodeErrors"]) for vm in nodes)
    block = element(
        "div",
        {"class": "crudui-form"},
        description_html
        + form_errors
        + element("div", {"class": "crudui-form__body"}, body)
        + footer,
    )
    if model["form"] is None:
        return block
    hidden = "".join(
        _input({"type": "hidden", "name": pair[0], "value": pair[1]})
        for pair in model["hidden"]
    )
    return element("form", model["form"], hidden + block)


_EMPTY_MODEL: dict[str, Any] = {
    "form": None,
    "hidden": [],
    "formErrors": [],
    "nodeErrors": {},
}


def _errors(messages: list[str]) -> str:
    """The errors slot of a node: one paragraph per message, present only with messages."""
    if not messages:
        return ""
    return element(
        "div",
        {"class": "crudui-node__errors"},
        "".join(
            element("p", {"class": "crudui-node__error"}, text(item))
            for item in messages
        ),
    )


def _join(*parts: str) -> str:
    return " ".join(part for part in parts if part != "")


def _open(
    values: Mapping[str, Any], hidden: object, declared: Mapping[str, Any] | None = None
) -> str:
    """A div with an optional valueless hidden attribute, then the declared attributes."""
    hidden_attr = ' hidden=""' if hidden else ""
    return f"<div{attrs(values)}{hidden_attr}{attrs(declared or {})}>"


def _node(vm: Mapping[str, Any], errors: Mapping[int, list[str]]) -> str:
    """One node of the recursive form grammar, with its header, body and errors."""
    style = vm.get("style")
    if vm.get("sticky"):
        # A sticky row carries its depth on the root; the stylesheet derives its
        # sticky line from it.
        style = "; ".join(
            part
            for part in (
                vm.get("style") or "",
                f"--crudui-sticky-depth: {vm.get('stickyDepth', 0)}",
            )
            if part != ""
        )
    values = {
        "class": _join(
            "crudui-node",
            f"crudui-node--{vm['kind']}",
            "crudui-node--sticky" if vm.get("sticky") else "",
            vm.get("className", ""),
        ),
        "style": style,
    }
    if vm.get("kind") not in ("row", "lang-item") and "path" in vm:
        values["data-field-path"] = vm["path"]
    if "key" in vm:
        values["data-crudui-row-key"] = vm["key"]
    if "lang" in vm:
        values["data-lang"] = vm["lang"]
    controls = vm.get("controls")
    footer = (
        element("div", {"class": "crudui-node__footer"}, _controls(controls))
        if controls is not None and controls.get("placement") == "footer"
        else ""
    )
    header = _header(vm)
    if vm.get("sticky") and header != "":
        header = element("div", {"class": "crudui-node__header-container"}, header)
    identity = id(vm)
    return (
        _open(values, vm.get("hidden"), vm.get("attributes"))
        + header
        + _body(vm, errors)
        + _errors(errors.get(identity, []))
        + footer
        + "</div>"
    )


def _header(vm: Mapping[str, Any]) -> str:
    header = vm.get("header")
    if header is None:
        header = {}
    parts = ""
    if vm.get("collapsible"):
        parts += (
            "<button"
            + attrs(
                {
                    "type": "button",
                    "class": "crudui-action",
                    "data-crudui-action": "toggle-row",
                    "aria-expanded": "true" if vm.get("expanded") is True else "false",
                    "aria-controls": vm.get("body", {}).get("id"),
                    "aria-label": vm.get("toggleLabel"),
                }
            )
            + "></button>"
        )
    if "label" in header:
        label = text(scalar(header["label"]))
        label_for = header.get("labelFor", "")
        if label_for != "":
            parts += element(
                "label", {"class": "crudui-node__label", "for": label_for}, label
            )
        else:
            parts += element("span", {"class": "crudui-node__label"}, label)
    if "description" in header:
        parts += element(
            "p", {"class": "crudui-node__description"}, text(header["description"])
        )
    for part in ("number", "title"):
        if part in header:
            parts += element(
                "span", {"class": f"crudui-node__{part}"}, text(header[part])
            )
    if "summary" in header:
        hidden_attr = ' hidden=""' if vm.get("expanded") is True else ""
        parts += (
            f'<span class="crudui-node__summary"{hidden_attr}>'
            + text(header["summary"])
            + "</span>"
        )
    if "count" in header:
        parts += element("span", {"class": "crudui-node__count"}, text(header["count"]))
    controls = vm.get("controls")
    if controls is not None and controls.get("placement") == "header":
        parts += _controls(controls)
    if parts == "":
        return ""
    return element(
        "div",
        {
            "class": _join("crudui-node__header", header.get("className", "")),
            "style": header.get("style", ""),
        },
        parts,
    )


def _body(vm: Mapping[str, Any], errors: Mapping[int, list[str]]) -> str:
    values = {
        "class": _join("crudui-node__body", vm.get("body", {}).get("className", "")),
        "style": vm.get("body", {}).get("style"),
        "id": vm.get("body", {}).get("id"),
    }
    if "checkbox" in vm:
        box = vm["checkbox"]
        inputs = {
            "class": box["className"],
            "id": box["id"],
            "name": box["name"],
            "type": "checkbox",
        }
        if "role" in box:
            inputs["role"] = box["role"]
        inputs["value"] = "1"
        if box["checked"]:
            inputs["checked"] = ""
        inputs = {**inputs, **(box.get("attributes") or {})}
        inner = _input(inputs) + (
            element("label", {"for": box["id"]}, text(box["caption"]))
            if "caption" in box
            else ""
        )
    elif "widget" in vm:
        inner = _widget(vm["widget"])
    else:
        inner = "".join(_node(child, errors) for child in vm.get("children", []))
    hidden = vm.get("collapsible") is True and vm.get("expanded") is not True
    return _open(values, hidden) + inner + "</div>"


def _controls(controls: Mapping[str, Any]) -> str:
    buttons = ""
    for action in controls["actions"]:
        buttons += (
            "<button"
            + attrs(
                {
                    "type": "button",
                    "class": "crudui-action",
                    "data-crudui-action": action["name"],
                    "aria-label": action["label"],
                }
            )
            + (' aria-disabled="true"' if action["disabled"] else "")
            + "></button>"
        )
    return element(
        "div",
        {"class": "crudui-controls", "role": "group", "aria-label": controls["label"]},
        buttons,
    )


def _affix(affix: Mapping[str, Any] | Any, raw: bool = False) -> str:
    if affix is None:
        return ""
    values = {
        key: value
        for key, value in (("class", affix.get("class")), ("style", affix.get("style")))
        if value is not None and value != ""
    }
    return element("span", values, text(affix["text"], raw), raw)


def _has_events(values: Mapping[str, Any]) -> bool:
    return any(re.match(r"^on[a-z]", name) for name in values)


def _control(widget: Mapping[str, Any], raw: bool = False) -> str:
    tag = widget.get("tag", "")
    if tag == "textarea":
        body_text = widget.get("text", "")
        prefix = "\n" if not raw and body_text.startswith("\n") else ""
        return element(
            "textarea",
            widget["attrs"] if raw else _control_attrs(widget["attrs"]),
            prefix + text(body_text, raw),
            raw,
        )
    if tag == "select":
        # The options of one group are written inside one optgroup element, in list order.
        options = ""
        group = None
        run = ""
        for option in widget.get("options", []):
            index = (
                option.get("group", {}).get("index")
                if isinstance(option.get("group"), dict)
                else None
            )
            previous = group.get("index") if isinstance(group, dict) else None
            if index != previous:
                options += (
                    run
                    if group is None
                    else element("optgroup", {"label": group["label"]}, run, raw)
                )
                group = option.get("group")
                run = ""
            values = {"value": option["value"]}
            if option["selected"]:
                values["selected"] = "selected" if widget["kind"] == "search" else ""
            run += element("option", values, text(option["label"], raw), raw)
        options += (
            run
            if group is None
            else element("optgroup", {"label": group["label"]}, run, raw)
        )
        return element(
            "select",
            widget["attrs"] if raw else _control_attrs(widget["attrs"]),
            options,
            raw,
        )
    return _input(widget["attrs"], raw)


def _widget(widget: Mapping[str, Any]) -> str:
    if widget.get("unsupported"):
        return element(
            "div",
            {
                "class": "crudui-widget crudui-widget--unsupported",
                "data-unsupported-type": widget["type"],
            },
        )
    raw = _has_events(widget["attrs"])
    layout = widget["layout"]
    if layout == "widget":
        return element(
            "div",
            {"class": "crudui-widget"},
            _affix(widget.get("prepend"), raw)
            + _control(widget, raw)
            + _affix(widget.get("append"), raw),
        )
    if layout == "bare":
        return _control(widget, raw)
    if layout == "range":
        output = element(
            "output",
            {"class": "crudui-widget__output", "for": widget["attrs"].get("id")},
            text(widget.get("text", ""), raw),
            raw,
        )
        return element(
            "div",
            {"class": "crudui-widget crudui-widget--range"},
            _affix(widget.get("prepend"), raw)
            + _control(widget, raw)
            + output
            + _affix(widget.get("append"), raw),
        )
    if layout == "host-script":
        return _control(widget, raw) + _script(widget.get("script", ""))
    if layout == "choices":
        body = ""
        radio = widget["kind"] == "choice"
        raw = _has_events(widget.get("extra", {}).get("input", {}))
        for option in widget["options"]:
            values = {
                **(widget.get("extra", {}).get("input", {})),
                "type": "radio" if radio else "checkbox",
                "value": option["value"],
                "autocomplete": "off",
                "class": "valid-target crudui-choices__input",
                "id": option["id"],
            }
            if radio:
                values["data-is-default"] = "1" if option["isDefault"] else ""
            if option["selected"]:
                values["checked"] = ""
            # A choice attribute named like a control attribute keeps the control attribute's position.
            values = {
                **values,
                **(widget.get("extra", {}).get("option", {})),
                **(option.get("attributes") or {}),
            }
            label = {
                "for": option["id"],
                "class": classes(
                    widget.get("itemLabelClass", ""), option.get("className", "")
                ),
            }
            if "style" in option:
                label["style"] = option["style"]
            body += _input(values, raw) + element(
                "label",
                label,
                element("span", {}, text(option["label"], raw), raw),
                raw,
            )
        return element("div", _control_attrs(widget["attrs"]), body)
    if layout == "file":
        raw = _has_events(widget["extra"]["file"])
        body = _affix(widget.get("prepend"), raw)
        if "display" in widget["extra"]:
            display = (
                {
                    "class": widget["extra"]["display"].get("class", ""),
                    "readonly": "",
                    "type": "text",
                    "value": "",
                }
                if raw
                else widget["extra"]["display"]
            )
            body += _input(display, raw)
        body += _input(widget["extra"]["file"], raw)
        if "display" in widget["extra"]:
            body += element(
                "button", {"class": "crudui-widget__button", "type": "button"}, "&nbsp;"
            )
        return element("div", {"class": "crudui-widget"}, body)
    if layout == "display":
        return element(
            "div", _control_attrs(widget["attrs"]), widget.get("rawHtml", "")
        )
    if layout == "search":
        raw = True
        return (
            (
                element("style", {"nonce": ""}, widget["styleChrome"])
                if widget.get("styleChrome", "") != ""
                else ""
            )
            + _script(widget.get("script", ""))
            + element(
                "div",
                {"class": "crudui-widget crudui-widget--search"},
                _affix(widget.get("prepend"), raw)
                + _control(widget, raw)
                + _affix(widget.get("append"), raw),
            )
        )
    if layout == "button":
        return element(
            "button",
            widget["attrs"] if raw else _control_attrs(widget["attrs"]),
            text(widget.get("text", ""), raw),
            raw,
        )
    if layout == "condition":
        return _condition_widget(widget)
    raise ValueError(f"Unknown widget layout: {widget['layout']}")


def _condition_widget(widget: Mapping[str, Any]) -> str:
    """A structured condition widget (docs/spec/form-markup.md, Structured condition editor): the prepend affix, the
    named error of a value that the editor does not show, the textarea, the editor of a value that it shows and the
    append affix."""
    editor = widget["condition"]
    body = _affix(widget.get("prepend"), True)
    if "error" in editor:
        body += element(
            "p",
            {"class": "crudui-condition__error", "role": "alert"},
            text(editor["error"], raw=True),
            raw=True,
        )
    body += _control(widget, True)
    if "error" not in editor:
        body += element(
            "div",
            {"class": "crudui-condition", "data-condition-for": editor["for"]},
            _condition_node(editor["root"], editor),
            raw=True,
        )
    return element(
        "div",
        {"class": "crudui-widget crudui-widget--condition"},
        body + _affix(widget.get("append"), True),
        raw=True,
    )


def _condition_button(action: str, label: str) -> str:
    return element(
        "button",
        {
            "type": "button",
            "class": "crudui-action crudui-action--text",
            "data-condition-action": action,
        },
        text(label, raw=True),
        raw=True,
    )


def _condition_select(
    values: Mapping[str, Any], choices: list[str], selected: str
) -> str:
    return element(
        "select",
        values,
        "".join(
            element(
                "option",
                {"value": choice, **({"selected": ""} if choice == selected else {})},
                text(choice, raw=True),
                raw=True,
            )
            for choice in choices
        ),
        raw=True,
    )


def _condition_node(node: Mapping[str, Any], editor: Mapping[str, Any]) -> str:
    """One condition of the editor: a group, a field comparison or a judged text (CUMK-067)."""
    labels = editor["labels"]
    remove = "" if node["path"] == "" else _condition_button("remove", labels["remove"])
    if node["kind"] == "group":
        items = "".join(
            element(
                "li",
                {"class": "crudui-condition__item"},
                _condition_node(item, editor),
                raw=True,
            )
            for item in node["items"]
        )
        return element(
            "fieldset",
            {"class": "crudui-condition__group", "data-condition-path": node["path"]},
            _condition_select(
                {
                    "class": "crudui-condition__mode",
                    "data-condition-part": "mode",
                    "aria-label": labels["mode"],
                },
                ["all", "any"],
                node["mode"],
            )
            + element("ol", {"class": "crudui-condition__list"}, items, raw=True)
            + _condition_button("add-comparison", labels["addComparison"])
            + _condition_button("add-group", labels["addGroup"])
            + (
                _condition_button("add-judge", labels["addJudge"])
                if editor["judge"]
                else ""
            )
            + remove,
            raw=True,
        )
    if node["kind"] == "judge":
        return element(
            "div",
            {"class": "crudui-condition__judge", "data-condition-path": node["path"]},
            _input(
                {
                    "class": "crudui-condition__text",
                    "data-condition-part": "judge",
                    "value": node["text"],
                },
                raw=True,
            )
            + remove,
            raw=True,
        )
    fields = editor["fields"]
    if fields is None:
        field = _input(
            {
                "class": "crudui-condition__field",
                "data-condition-part": "field",
                "value": node["field"],
            },
            raw=True,
        )
    else:
        choices = list(fields) if node["field"] in fields else [node["field"], *fields]
        field = _condition_select(
            {"class": "crudui-condition__field", "data-condition-part": "field"},
            choices,
            node["field"],
        )
    return element(
        "div",
        {"class": "crudui-condition__comparison", "data-condition-path": node["path"]},
        field
        + _condition_select(
            {"class": "crudui-condition__op", "data-condition-part": "op"},
            list(OPS),
            node["op"],
        )
        + _input(
            {
                "class": "crudui-condition__value",
                "data-condition-part": "value",
                "value": node["value"],
            },
            raw=True,
        )
        + remove,
        raw=True,
    )


def _buttons_html(buttons: list[Any]) -> str:
    """The markup of the form buttons; every renderer inserts this one string into the footer."""
    out = ""
    for button in buttons:
        out += f"<{button['tag']}"
        for name, value in button["attrs"].items():
            out += f' {name}="{value.replace("&", "&amp;").replace(chr(34), "&quot;").replace("<", "&lt;")}"'
        out += f">{button['text'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')}</{button['tag']}>"
    return out
