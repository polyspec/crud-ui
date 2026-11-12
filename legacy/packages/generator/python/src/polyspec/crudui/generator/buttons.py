"""Form buttons: the actions a specification declares with root buttons.

The evaluated buttons render in the form footer as one markup string every
renderer inserts into the footer controls group.
"""

from collections.abc import Mapping
from typing import Any

from polyspec.crudui.validator.jsvalue import JsonValue

from .errors import FormError
from .messages import for_language
from .value import object_value, style_value, translate
from .design import resolve as design_resolve

__all__ = ["BUTTON_TYPES", "bind", "bind_public", "html", "html_public"]

BUTTON_TYPES = ("submit", "reset", "button", "link")
DEFAULT_BUTTONS = [{"type": "submit"}]
_ATTRIBUTES = ("type", "class", "style", "name", "value", "href", "onclick")


def _script(behavior: object, action: str) -> str | None:
    entry = behavior.get(action) if isinstance(behavior, dict) else None
    script = entry.get("script") if isinstance(entry, dict) else entry
    return script if isinstance(script, str) and script != "" else None


def bind(
    template: dict[str, Any], data: JsonValue, language: str
) -> list[dict[str, Any]]:
    """The template buttons for a record, in declaration order."""
    messages = for_language(language)
    buttons: list[dict[str, Any]] = []
    for declared in template["buttons"]:
        button = object_value(declared)
        button_type = button["type"]
        if button_type not in ("submit", "reset", "button", "link"):
            # A template given without compiling is checked here as the reference checks it (CURP-008).
            raise FormError("INVALID_FORM_INPUT", f"Invalid button type: {button_type}")
        design = design_resolve(button.get("design"), data, [], [])
        attrs: dict[str, str] = {}
        if button_type != "link":
            attrs["type"] = button_type
        attrs["class"] = " ".join(
            part
            for part in (
                "crudui-action",
                "crudui-action--text",
                design["main"]["class"],
            )
            if part != ""
        )
        style = style_value(design["main"]["style"])
        if style is not None:
            attrs["style"] = style
        for name in ("name", "value", "href"):
            declared_text = button.get(name)
            if isinstance(declared_text, str):
                attrs[name] = declared_text
        onclick = _script(button.get("behavior"), "onclick")
        if onclick is not None:
            attrs["onclick"] = onclick
        buttons.append(
            {
                "type": button_type,
                "tag": "a" if button_type == "link" else "button",
                "text": translate(
                    button.get("text"), language, messages.get(button_type, "")
                ),
                "attrs": attrs,
            }
        )
    return buttons


def bind_public(
    template: object, data: object, options: Mapping[str, Any]
) -> list[dict[str, Any]]:
    """Evaluate public input with the same template, data and option checks as form binding."""
    from .binding import language
    from .template import checked

    return bind(checked(template), object_value(data), language(options))


def html_public(buttons: object) -> str:
    """Markup of public input after checking that every element is an evaluated button."""
    if not isinstance(buttons, list):
        raise FormError("INVALID_FORM_INPUT", "Form buttons must be a list")
    for button in buttons:
        if not _evaluated(button):
            raise FormError(
                "INVALID_FORM_INPUT", "Form buttons must be evaluated button objects"
            )
    return html(buttons)


def _evaluated(button: object) -> bool:
    """Whether a value has the tag, text and string attributes that the markup reads."""
    if (
        not isinstance(button, dict)
        or button.get("tag") not in ("a", "button")
        or not isinstance(button.get("text"), str)
        or not isinstance(button.get("attrs"), dict)
    ):
        return False
    for name, value in button["attrs"].items():
        if name not in _ATTRIBUTES or not isinstance(value, str):
            return False
    return True


def html(buttons: list[dict[str, Any]]) -> str:
    """The markup of the form buttons."""
    out = ""
    for button in buttons:
        out += f"<{button['tag']}"
        for name, value in button["attrs"].items():
            out += f' {name}="{value.replace("&", "&amp;").replace(chr(34), "&quot;").replace("<", "&lt;")}"'
        out += f">{button['text'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')}</{button['tag']}>"
    return out
