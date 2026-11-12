"""Evaluate field controls without generating HTML.

A supported field type evaluates to its widget model — the members in the
output order the form runtime defines — and a type outside the table is an
`UNSUPPORTED_FIELD_TYPE` failure, or a marker model when the binding option
asks for one.
"""

import json
import re
from collections.abc import Mapping
from typing import Any

from polyspec.crudui.validator.jsvalue import JsonValue

from .choice_list import appearances as choice_appearances
from .choice_list import check_appearance, is_choice_list, pairs
from . import messages as messages_module
from .condition_editor import editor
from .design import declared as design_declared
from .errors import FormError
from .numbers import number_string
from .value import (
    MISSING,
    Value,
    classes,
    condition,
    control_id,
    display,
    get,
    leaf,
    name as value_name,
    record,
    rule,
    scalar,
    string,
    style_value,
    translate,
    truthy,
)

__all__ = ["evaluate"]

_KINDS = {
    "text": "text",
    "string": "text",
    "email": "email",
    "number": "number",
    "integer": "number",
    "float": "number",
    "decimal": "number",
    "range": "range",
    "password": "password",
    "textarea": "textarea",
    "condition": "condition",
    "select": "select",
    "dropdown": "select",
    "selectbox": "select",
    "hidden": "hidden",
    "choice": "choice",
    "radio": "choice",
    "multichoice": "multichoice",
    "checkboxes": "multichoice",
    "checkcontainer": "multichoice",
    "date": "date",
    "datetime": "datetime",
    "datetime-local": "datetime",
    "dummy": "dummy",
    "html": "dummy",
    "static": "dummy",
    "dummy-input": "dummy-input",
    "image": "image",
    "file": "file",
    "cover": "cover",
    "cover-simple": "cover",
    "image-viewer": "image-viewer",
    "search": "search",
    "autocomplete": "search",
    "tinymce": "tinymce",
    "wysiwyg": "tinymce",
    "summernote": "summernote",
    "editorjs": "editorjs",
    "tui": "tui",
    "button": "button",
    "action": "button",
    "tagify": "tagify",
    "tagify2": "tagify2",
}

_MEMBERS = (
    "kind",
    "layout",
    "tag",
    "attrs",
    "text",
    "rawHtml",
    "source",
    "options",
    "itemLabelClass",
    "script",
    "styleChrome",
    "prepend",
    "append",
    "extra",
    "condition",
)


def evaluate(
    spec: dict[str, Any],
    value: Value,
    path: str,
    design: dict[str, Any],
    options: Mapping[str, Any],
    rows: list[int],
) -> dict[str, Any]:
    """A supported widget model, or the report of an unsupported field type."""
    field_type = string(spec.get("type", ""))
    kind = _KINDS.get(field_type.lower())
    items: Any = spec.get("items")
    if is_choice_list(items):
        # Only the choices of a choice or multichoice field declare their appearance.
        appearance = kind in ("choice", "multichoice")
        # Only the choice list of a select field has groups.
        if pairs(items, appearance, kind == "select") is None:
            from .choice_list import EXPECTED

            raise FormError(
                "INVALID_FORM_INPUT", f"Invalid items at {path}: expected {EXPECTED}"
            )
        if appearance:
            check_appearance(items, path)
    if kind is None:
        if options.get("unsupported", "throw") == "marker":
            return {"unsupported": True, "type": field_type}
        raise FormError(
            "UNSUPPORTED_FIELD_TYPE",
            f'Unsupported field type "{field_type}" at "{path}"',
            path,
        )
    context = _Widget(spec, value, path, design, options, rows)
    model = {
        "text": lambda: context.input("text"),
        "email": lambda: context.input("email"),
        "number": lambda: context.input("number"),
        "password": lambda: context.input("password"),
        "hidden": lambda: context.input("hidden"),
        "date": lambda: context.input("date"),
        "datetime": lambda: context.input("datetime"),
        "dummy-input": lambda: context.input("dummy-input"),
        "range": context.range_input,
        "textarea": context.textarea,
        "condition": context.condition,
        "select": lambda: context.select("select"),
        "search": lambda: context.select("search"),
        "choice": lambda: context.choices("choice"),
        "multichoice": lambda: context.choices("multichoice"),
        "image": lambda: context.file("image"),
        "file": lambda: context.file("file"),
        "cover": lambda: context.file("cover"),
        "dummy": lambda: context.display("dummy"),
        "image-viewer": lambda: context.display("image-viewer"),
        "tinymce": lambda: context.editor("tinymce"),
        "summernote": lambda: context.editor("summernote"),
        "editorjs": lambda: context.editor("editorjs"),
        "tui": lambda: context.editor("tui"),
        "tagify": lambda: context.editor("tagify"),
        "tagify2": lambda: context.editor("tagify2"),
        "button": context.button,
    }[kind]()
    if model.get("tag") in ("input", "select", "textarea"):
        model["attrs"]["id"] = context.id
    if isinstance(model.get("extra"), dict) and "file" in model["extra"]:
        model["extra"]["file"]["id"] = context.id
    if model["layout"] == "choices":
        for index, option in enumerate(model["options"]):
            option["id"] = f"{context.id}:{index}"
    # Declared control attributes follow the attributes crudui writes on the control.
    attributes = design_declared(spec.get("design"), False)
    if isinstance(attributes, dict):
        if model["layout"] == "choices":
            if "input" in model.get("extra", {}):
                model["extra"]["option"] = attributes
        else:
            target = (
                model["extra"]["file"]
                if isinstance(model.get("extra"), dict) and "file" in model["extra"]
                else model["attrs"]
            )
            for attribute, text in attributes.items():
                target[attribute] = text
    return model


def _json_text(value: object) -> str:
    """JSON text as JSON.stringify writes it, each number as number_string writes it."""
    if isinstance(value, list):
        return "[" + ",".join(_json_text(item) for item in value) + "]"
    if isinstance(value, dict):
        return (
            "{"
            + ",".join(
                f"{_json_text(str(key))}:{_json_text(item)}"
                for key, item in value.items()
            )
            + "}"
        )
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return number_string(value)
    return json.dumps(value, ensure_ascii=False)


def placeholder_option() -> dict[str, Any]:
    """The one option of a select or search field with no option (CUSC-080).

    Its value is "" and its text is select, untranslated.
    """
    return {"value": "", "label": "select", "selected": False, "isDefault": False}


def _js(value: object) -> str:
    """A JavaScript string literal, with `<` escaped."""
    return json.dumps(value, ensure_ascii=False).replace("<", "\\u003c")


class _Widget:
    """The evaluation of one field control."""

    def __init__(
        self,
        spec: dict[str, Any],
        value: Value,
        path: str,
        design: dict[str, Any],
        options: Mapping[str, Any],
        rows: list[int],
    ) -> None:
        self.spec = spec
        self.value = value
        self.path = path
        self.design = design
        self.state = options
        self.rows = rows
        self.id = control_id(self.state.get("idPrefix") or "crudui", path)
        self.name = value_name(path, self.state.get("keyPrefix"))
        self.language = self.state.get("language", "ko")

    def t(self, value: JsonValue) -> str:
        return translate(value, self.language)

    def opt(self, key: str, default: str | None = None) -> Any:
        options = self.spec.get("options")
        value = options.get(key) if isinstance(options, dict) else None
        return default if value is None else scalar(value)

    def data(self) -> dict[str, str]:
        return {
            "data-name": leaf(self.path, self.rows),
            "data-rule-name": rule(self.path, self.rows),
            "data-default": scalar(self.spec.get("default")),
        }

    def main(self, base: str) -> str:
        return classes(base, self.design["main"]["class"])

    def style(self) -> dict[str, str]:
        style = style_value(self.design["main"]["style"])
        return {} if style is None else {"style": style}

    def placeholder(self) -> dict[str, str]:
        text = self.t(self.spec.get("placeholder"))
        return {} if text == "" else {"placeholder": text}

    def behavior(self) -> dict[str, str]:
        out: dict[str, str] = {}
        behavior = self.spec.get("behavior")
        if not isinstance(behavior, dict):
            return out
        for action, entry in behavior.items():
            script = (
                entry
                if isinstance(entry, str)
                else entry.get("script")
                if isinstance(entry, dict)
                else None
            )
            if isinstance(script, str) and script != "":
                out[action] = script
        return out

    def affix(self, kind: str) -> object:
        text = self.t(self.spec.get(kind))
        if text == "":
            return MISSING
        if kind == "prepend":
            style = style_value(self.design["prepend"]["style"])
            return record(
                {
                    "text": text,
                    "class": classes(
                        "crudui-widget__affix", self.design["prepend"]["class"]
                    ),
                    "style": style if style is not None else MISSING,
                }
            )
        return record({"text": text, "class": "crudui-widget__affix"})

    def affixes(self) -> dict[str, object]:
        return {"prepend": self.affix("prepend"), "append": self.affix("append")}

    def display_value(self) -> Value:
        return display(self.value, get(self.spec, "default"))

    def model(
        self,
        kind: str,
        layout: str,
        attrs: Mapping[str, Any],
        extra: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """A widget model with its members in output order."""
        members = {
            "kind": kind,
            "layout": layout,
            "attrs": dict(attrs),
            **(extra or {}),
        }
        order = [member for member in _MEMBERS if member in members]
        return record(
            {key: members[key] for key in (*order, *members)}
            if set(members) <= set(_MEMBERS)
            else members
        )

    def input(self, kind: str) -> dict[str, Any]:
        from . import dates as dates_module

        attr_type = {"datetime": "datetime-local", "dummy-input": "text"}.get(
            kind, kind
        )
        value = scalar(self.value) if kind == "password" else self.display_value()
        if kind in ("date", "datetime") and isinstance(value, str):
            parsed = dates_module.parse_utc(value)
            if parsed is not None:
                value = dates_module.format_utc(parsed, kind == "datetime")
        attrs = {"type": attr_type, "name": self.name, "value": value}
        if kind == "number":
            attrs["step"] = "any"
        if kind == "dummy-input":
            attrs["readonly"] = ""
        attrs["class"] = self.main(
            "valid-target"
            if kind == "hidden"
            else "crudui-input"
            if kind == "dummy-input"
            else "valid-target crudui-input"
        )
        if kind in ("text", "email", "number", "dummy-input"):
            attrs = {**attrs, **self.placeholder()}
        if kind != "hidden":
            attrs = {**attrs, **self.style()}
        if kind not in ("password", "hidden", "dummy-input"):
            attrs = {**attrs, **self.behavior()}
        attrs = {
            **attrs,
            **(
                {"data-default": scalar(self.spec.get("default"))}
                if kind == "dummy-input"
                else self.data()
            ),
        }
        bare = kind in ("password", "hidden", "datetime")
        return self.model(
            kind,
            "bare" if bare else "widget",
            attrs,
            {"tag": "input", **({} if bare else self.affixes())},
        )

    def range_input(self) -> dict[str, Any]:
        """A range input with the bounds and the step of its required validate declarations."""
        value = self.display_value()
        validate = self.spec["validate"]
        attrs = {
            "type": "range",
            "name": self.name,
            "value": value,
            "min": scalar(validate["range"][0]),
            "max": scalar(validate["range"][1]),
            "step": scalar(validate["step"]),
            "class": self.main("valid-target crudui-input crudui-input--range"),
            **self.style(),
            **self.behavior(),
            **self.data(),
        }
        return self.model(
            "range", "range", attrs, {"tag": "input", "text": value, **self.affixes()}
        )

    def textarea(self) -> dict[str, Any]:
        return self.model(
            "textarea",
            "widget",
            {
                "name": self.name,
                "class": self.main("valid-target crudui-input"),
                "rows": "5",
                **self.style(),
                **self.behavior(),
                **self.data(),
            },
            {"tag": "textarea", "text": self.display_value(), **self.affixes()},
        )

    def condition(self) -> dict[str, Any]:
        """A textarea holding the condition text of its tree, marked for the browser bindings. Under a structured
        editor (docs/spec/form-markup.md, Structured condition editor) the textarea keeps the value, hidden while the
        editor shows it (CUMK-067), visible with a named error otherwise (CUMK-068)."""
        default = get(self.spec, "default")
        value = default if self.value is MISSING else self.value
        design = self.spec.get("design")
        structured = isinstance(design, dict) and design.get("editor") == "structured"
        model = (
            editor(
                value,
                self.id,
                self.spec,
                self.path,
                messages_module.for_language(self.language),
            )
            if structured
            else None
        )
        hidden = {} if model is None or "error" in model else {"hidden": ""}
        return self.model(
            "condition",
            "widget" if model is None else "condition",
            {
                "name": self.name,
                "class": self.main("valid-target crudui-input crudui-input--condition"),
                "rows": "5",
                "data-crudui-value": "json",
                **self.style(),
                **self.behavior(),
                **self.data(),
                "data-default": condition(default),
                **hidden,
            },
            {
                "tag": "textarea",
                "text": condition(value),
                **self.affixes(),
                **({} if model is None else {"condition": model}),
            },
        )

    def dynamic(self) -> bool:
        items = self.spec.get("items")
        return isinstance(items, dict) and "model" in items

    def source(self) -> dict[str, str]:
        items = self.spec["items"]
        return {
            "data-source-model": scalar(items.get("model")),
            "data-source-method": scalar(items.get("method")),
            "data-source-table": scalar(items.get("table")),
            "data-source-relations": _json_text(
                [] if items.get("relations") is None else items.get("relations")
            ),
        }

    def items(self) -> list[list[Any]]:
        items: Any = self.spec.get("items")
        if is_choice_list(items):
            return [[value, label] for value, label in pairs(items, True, True) or []]
        if self.dynamic() or not isinstance(items, (dict, list)):
            return []
        out = []
        if isinstance(items, list):
            for index, label in enumerate(items):
                out.append([str(index), label])
        else:
            for key, label in items.items():
                out.append([str(key), label])
        return out

    def options(self, choice: bool = False) -> list[dict[str, Any]]:
        effective = (
            scalar(self.spec.get("default"))
            if self.value is MISSING
            else scalar(self.value)
        )
        default = self.spec.get("default")
        out = []
        for value, label in self.items():
            out.append(
                {
                    "value": value,
                    "label": self.t(label) or scalar(label),
                    "selected": effective == value,
                    "isDefault": choice
                    and default is not None
                    and not isinstance(default, list)
                    and scalar(default) == value,
                }
            )
        return out

    def select(self, kind: str) -> dict[str, Any]:
        from .choice_list import groups as group_list

        dynamic = self.dynamic()
        source = self.source() if dynamic else None
        options = self.options()
        if kind == "select" and is_choice_list(self.spec.get("items")):
            for index, group in enumerate(group_list(self.spec["items"])):
                if group is not None:
                    options[index]["group"] = {
                        "index": group["index"],
                        "label": self.t(group["label"]) or scalar(group["label"]),
                    }
        if not options:
            options = [placeholder_option()]
        if kind == "select":
            attrs = {
                "name": self.name,
                "class": self.main(
                    "valid-target crudui-input crudui-input--select valid-target-async"
                    if dynamic
                    else "valid-target crudui-input crudui-input--select"
                ),
                **(source or {}),
                **self.style(),
                **self.behavior(),
                **self.data(),
            }
            return self.model(
                "select",
                "widget",
                attrs,
                {
                    "tag": "select",
                    "source": source,
                    "options": options,
                    **self.affixes(),
                },
            )
        minimum = self.opt("keyword_min_length", "2")
        delay = self.opt("delay", "250")
        attrs = {
            "class": self.main(
                "valid-target crudui-input crudui-input--select valid-target-async"
                if dynamic
                else "valid-target crudui-input crudui-input--select"
            ),
            **self.style(),
            "name": self.name,
            "data-keyword-min-length": minimum,
            "data-delay": delay,
            "data-api-server": self.opt("api_server", ""),
            **(source or {}),
            "data-name": leaf(self.path, self.rows),
            "data-rule-name": rule(self.path, self.rows),
            "id": self.id,
        }
        if "onchange" in self.behavior():
            attrs["onchange"] = self.behavior()["onchange"]
        attrs["data-default"] = scalar(self.spec.get("default"))
        callback = self.opt("callback")
        callback_js = (
            f"$(document.getElementById({_js(self.id)})).on('select2:select', {callback});"
            if callback
            else ""
        )
        container = f"{self.id}_select2"
        script = f"$(function() {{select2(CSS.escape({_js(self.id)}), {_js(minimum)}, {_js(delay)}, {_js(container)});{callback_js}}});"
        style = (
            f"[class~={_js(container)}] .loading-results {{ display: none; }}"
            if self.opt("hide_searching") != ""
            else ""
        )
        return self.model(
            "search",
            "search",
            attrs,
            {
                "tag": "select",
                "source": source,
                "options": options,
                **self.affixes(),
                "script": script,
                "styleChrome": style,
            },
        )

    def choices(self, kind: str) -> dict[str, Any]:
        radio = kind == "choice"
        # The choices element: its classes, then the class and style of design.group.
        group_style = style_value(self.design["group"]["style"])
        attrs = {
            "class": classes(
                "crudui-choices"
                if radio
                else "crudui-choices crudui-choices--multiple",
                self.design["group"]["class"],
            ),
            **(
                {}
                if group_style is None or group_style == ""
                else {"style": group_style}
            ),
        }
        label_class = self.main("crudui-choices__label")
        if self.dynamic():
            return self.model(
                kind,
                "choices",
                {**attrs, **self.source()},
                {"source": self.source(), "options": [], "itemLabelClass": label_class},
            )
        options = self.options(radio)
        # Each option has its id (assigned with the control id) before the appearance of its choice.
        appearances = (
            [dict(appearance) for appearance in choice_appearances(self.spec["items"])]
            if is_choice_list(self.spec.get("items"))
            else []
        )
        for index, option in enumerate(options):
            options[index] = {
                **option,
                "id": "",
                **(appearances[index] if index < len(appearances) else {}),
            }
        if not radio:
            value = self.spec.get("default") if self.value is MISSING else self.value
            selected = (
                [string(item) for item in value]
                if isinstance(value, list)
                else ([string(value)] if truthy(value) else [])
            )
            for option in options:
                option["selected"] = option["value"] in selected
        shared = {
            "name": self.name + ("" if radio else "[]"),
            "data-name": leaf(self.path, self.rows),
            "data-rule-name": rule(self.path, self.rows),
        }
        for action, script in self.behavior().items():
            if action == "onchange" or (radio and action == "onclick"):
                shared[action] = script
        return self.model(
            kind,
            "choices",
            attrs,
            {
                "source": None,
                "options": options,
                "itemLabelClass": label_class,
                "extra": {"input": shared},
            },
        )

    def file(self, kind: str) -> dict[str, Any]:
        cover = kind == "cover"
        file = {
            "type": "file",
            "class": self.main("valid-target crudui-input crudui-input--file"),
        }
        for size in (
            "max_width",
            "min_width",
            "max_height",
            "min_height",
            "preview_max_width",
            "preview_max_height",
        ):
            file["data-" + size.replace("_", "-")] = self.opt(size, "0")
        file["name"] = self.name + ("[name]" if cover else "")
        file["data-name"] = leaf(self.path, self.rows)
        file["data-rule-name"] = rule(self.path, self.rows)
        file = {**file, **self.behavior()}
        if not cover:
            file["value"] = ""
        validate = self.spec.get("validate")
        options = self.spec.get("options")
        accept = validate.get("accept") if isinstance(validate, dict) else None
        if accept is None:
            accept = options.get("accept") if isinstance(options, dict) else None
        if accept is None:
            accept = "*/*" if kind == "file" else "image/*"
        file["accept"] = scalar(accept)
        extra = {}
        if not cover:
            extra["display"] = {
                "type": "text",
                "class": "crudui-input",
                "value": "",
                "readonly": "",
            }
        extra["file"] = file
        return self.model(
            kind, "file", {}, {"prepend": self.affix("prepend"), "extra": extra}
        )

    def display(self, kind: str) -> dict[str, Any]:
        from .choice_list import pairs as choice_pairs

        if kind == "image-viewer":
            height = self.opt("height", "")
            html = "이미지가 없습니다."
            if isinstance(self.value, list) and self.value:
                html = "".join(
                    f'<img src="{scalar(item)}"'
                    + (f' height="{height}"' if height != "" else "")
                    + ">"
                    for item in self.value
                )
            return self.model(
                kind,
                "display",
                {"class": self.design["main"]["class"]}
                if self.design["main"]["class"] != ""
                else {},
                {"tag": "div", "rawHtml": html},
            )
        value = self.value
        default = scalar(self.spec.get("default"))
        if value is MISSING and default != "" and default != "0":
            value = self.spec.get("default")
        if is_choice_list(self.spec.get("items")):
            text = scalar(value)
            for choice, label in choice_pairs(self.spec["items"]) or []:
                if choice == text:
                    value = label
                    break
        elif isinstance(self.spec.get("items"), dict) and not self.dynamic():
            found = get(self.spec["items"], scalar(value))
            if found is not MISSING:
                value = found
        html = scalar(value)
        if html != "" and html != "0":
            html = re.sub(r"(\r\n|\n\r|\r|\n)", r"<br />\1", html)
        attrs = {}
        if self.design["main"]["class"] != "":
            attrs["class"] = self.design["main"]["class"]
        attrs = {**attrs, **self.style()}
        return self.model("dummy", "display", attrs, {"tag": "div", "rawHtml": html})

    def editor(self, kind: str) -> dict[str, Any]:
        tagify = kind in ("tagify", "tagify2")
        height = self.opt("height", "300")
        base = {
            "tinymce": "valid-target crudui-input tinymcearea",
            "summernote": "valid-target crudui-input summernote",
            "editorjs": "valid-target crudui-input contentjs",
            "tui": "valid-target crudui-input tuiarea",
        }.get(kind, "valid-target crudui-input")
        if tagify:
            attrs = {
                "type": "text",
                "id": self.id,
                "class": self.main(base),
                "name": self.name,
                "value": self.display_value(),
                "data-max-tags": self.opt("max_tags", "0"),
            }
        else:
            attrs = {
                "id": self.id,
                "class": self.main(base),
                "name": self.name,
                "rows": self.opt("rows", "5" if kind == "summernote" else "3"),
            }
        if kind == "tinymce":
            attrs = {
                **attrs,
                "data-type": string(self.spec.get("type", "tinymce")),
                "data-height": height,
                "data-upload-server": self.opt("fileserver", "upload"),
            }
        if kind in ("editorjs", "tui"):
            attrs["data-fileserver"] = self.opt("fileserver", "")
        if kind == "tagify2":
            attrs["data-server"] = self.opt("server", "")
        if tagify:
            attrs = {**attrs, **self.placeholder()}
        attrs = {**attrs, **self.behavior(), **self.data()}
        selector = "'#'+CSS.escape(" + _js(self.id) + ")"
        arguments = {
            "tinymce": lambda: (
                f"{selector}, {height}, {_js(self.opt('fileserver', 'upload'))}, false"
            ),
            "summernote": lambda: f"{selector}, {_js(self.opt('upload', 'upload'))}",
            "editorjs": lambda: f"{selector}, {_js(self.opt('fileserver', ''))}",
            "tui": lambda: f"{selector}, {_js(self.opt('fileserver', ''))}",
            "tagify": lambda: f"{selector}, {self.opt('max_tags', '0')}",
            "tagify2": lambda: (
                f"{selector}, {self.opt('max_tags', '0')}, {_js(self.opt('server', ''))}"
            ),
        }[kind]()
        return self.model(
            kind,
            "host-script",
            attrs,
            {
                "tag": "input" if tagify else "textarea",
                "text": MISSING if tagify else self.display_value(),
                "script": f"$(function() {{editor_{kind}({arguments});}});",
            },
        )

    def button(self) -> dict[str, Any]:
        """A button element with the content text; behavior scripts are its event attributes."""
        text = self.t(self.spec["content"]) if "content" in self.spec else ""
        attrs = {
            "type": "button",
            "class": self.main("crudui-action crudui-action--text"),
            **self.style(),
            "id": self.id,
            **self.behavior(),
        }
        return self.model("button", "button", attrs, {"tag": "button", "text": text})
