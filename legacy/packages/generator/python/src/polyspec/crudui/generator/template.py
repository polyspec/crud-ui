"""Compose field structures independently of instance data.

`compile` builds a serializable ordered template from a form specification:
the composed `properties` become a field list, each field its name, its spec
without `properties`, and its children. The declaration checks reject a wrong
root action or buttons declaration, a wrong value type or an unknown key in a
field's multiple, lang, design and behavior declarations, and a range field
without literal bounds.
"""

import re

from collections.abc import Mapping
from typing import Any, NoReturn, TypeGuard

from polyspec.crudui.validator.compose import MemoryLoader, compose_properties
from polyspec.crudui.validator.group_source import group_source_failure
from polyspec.crudui.validator.jsvalue import JsonValue
from polyspec.crudui.validator.values import (
    is_multiple,
    is_number_range,
    is_step,
)

from . import messages as messages_module
from .condition_editor import check_editor, fields_error
from .errors import FormError
from .value import MISSING, Value, copy_value, object_value, record, spec_value

__all__ = [
    "check_declared_attributes",
    "check_design_declaration",
    "checked",
    "compile",
    "loader",
]

BUTTON_TYPES = ("submit", "reset", "button", "link")
DEFAULT_BUTTONS = [{"type": "submit"}]

_OWNED_ATTRIBUTE_PREFIXES = ("data-crudui-", "data-source-")
_OWNED_ATTRIBUTE_NAMES = (
    "data-field-path",
    "data-lang",
    "data-name",
    "data-rule-name",
    "data-default",
    "data-is-default",
    "data-type",
    "data-height",
    "data-upload-server",
    "data-fileserver",
    "data-server",
    "data-max-tags",
    "data-keyword-min-length",
    "data-delay",
    "data-api-server",
    "data-max-width",
    "data-min-width",
    "data-max-height",
    "data-min-height",
    "data-preview-max-width",
    "data-preview-max-height",
    "data-unsupported-type",
)
_DECLARED_NAME = re.compile(r"\A(?:data|aria)-[a-z0-9][a-z0-9._-]*\Z")


def _is_object(value: object) -> TypeGuard[dict[str, Any]]:
    return value is not None and isinstance(value, dict)


def _condition_value(value: object) -> bool:
    """A string, or a condition map: a non-empty object."""
    return isinstance(value, str) or (_is_object(value) and len(value) > 0)


def _scalar_child(child: object) -> bool:
    """A child that renders one scalar value: not repeated, not a group, not a language field."""
    if not _is_object(child):
        return False
    repeated = (
        child.get("multiple") is True
        or child.get("multiple") == "only"
        or _is_object(child.get("multiple"))
    )
    lang = child.get("lang") is True or _is_object(child.get("lang"))
    return (
        child.get("type") != "group"
        and "properties" not in child
        and not repeated
        and not lang
    )


def compile(spec: object, options: Mapping[str, Any]) -> dict[str, Value]:
    """Composed properties as a serializable ordered template."""
    spec = spec_value(spec)
    group_properties = spec.get("properties")
    if spec.get("type") != "group" or not _is_object(group_properties):
        raise FormError(
            "INVALID_FORM_INPUT", "A form spec must be a group with properties"
        )
    _check_form_declarations(spec)
    # The form root takes no layout; a group field declares it.
    design = spec.get("design")
    if _is_object(design) and "layout" in design:
        raise FormError(
            "INVALID_FORM_INPUT", "Invalid design.layout at form: unknown key"
        )
    properties = compose_properties(
        dict(group_properties), loader(options), options.get("basepath", "")
    )
    return record(
        {
            "kind": "crudui/form-template",
            "keyPrefix": options.get("keyPrefix", MISSING)
            if "keyPrefix" in options
            else MISSING,
            "fields": _fields(properties, properties),
            "buttons": copy_value(spec["buttons"])
            if "buttons" in spec
            else [dict(button) for button in DEFAULT_BUTTONS],
            "action": copy_value(spec["action"])
            if _is_object(spec.get("action"))
            else MISSING,
            "description": copy_value(spec["description"])
            if "description" in spec
            else MISSING,
        }
    )


def loader(options: Mapping[str, Any]) -> MemoryLoader:
    """The composition loader of the `files` option, each document in member order."""
    files = object_value(options.get("files") or {})
    maps = {}
    for path, file in files.items():
        if not _is_object(file):
            raise FormError(
                "INVALID_FORM_INPUT", "Composition files must contain objects"
            )
        maps[path] = dict(spec_value(file))
    return MemoryLoader(maps)


def _fields(
    properties: dict[str, Any], root: dict[str, Any], parent: str = ""
) -> list[JsonValue]:
    """The field list of `properties`; `root` holds the form's root properties, which a group source reads."""
    out: list[JsonValue] = []
    for name, raw in properties.items():
        if not _is_object(raw):
            continue
        path = name if parent == "" else f"{parent}.{name}"
        _check_declarations(raw, path, True)
        # A group source is checked after the other declarations of its field (schema.md, "Choices from a repeated group").
        source_failure = group_source_failure(raw, path, root)
        if source_failure is not None:
            raise FormError("INVALID_FORM_INPUT", source_failure)
        children = raw.get("properties")
        raw = {key: value for key, value in raw.items() if key != "properties"}
        out.append(
            {
                "name": str(name),
                "spec": copy_value(raw),
                "children": (
                    _fields(dict(children), root, path) if _is_object(children) else []
                ),
            }
        )
    return out


def _fail(key: str, path: str, expected: str) -> NoReturn:
    raise FormError(
        "INVALID_FORM_INPUT", f"Invalid {key} at {path}: expected {expected}"
    )


def _closed(
    bucket: str, members: dict[str, Any], allowed: tuple[str, ...], path: str
) -> None:
    """Reject the first member, in member order, that `allowed` does not list."""
    for key in members:
        if key not in allowed:
            raise FormError(
                "INVALID_FORM_INPUT", f"Invalid {bucket}.{key} at {path}: unknown key"
            )


def _check_form_declarations(spec: dict[str, Any]) -> None:
    """Reject a wrong root action or buttons declaration."""
    if "action" in spec:
        if not _is_object(spec["action"]):
            _fail("action", "form", "an object")
        for key in ("method", "url", "enctype"):
            if key in spec["action"] and not isinstance(spec["action"][key], str):
                _fail(f"action.{key}", "form", "a string")
    if "buttons" not in spec:
        return
    buttons = spec["buttons"]
    if not isinstance(buttons, list):
        _fail("buttons", "form", "a list of buttons")
    # A button type without interface text needs declared text.
    texts = messages_module.for_language("ko")
    for index, button in enumerate(buttons):
        key = f"buttons.{index}"
        if not _is_object(button):
            _fail(key, "form", "an object")
        if button.get("type") not in BUTTON_TYPES:
            _fail(f"{key}.type", "form", "submit, reset, button or link")
        for name in ("name", "value", "href"):
            if name in button and not isinstance(button[name], str):
                _fail(f"{key}.{name}", "form", "a string")
        if button.get("type") not in texts and "text" not in button:
            _fail(f"{key}.text", "form", "content for this button type")
        if button.get("type") == "link" and "href" not in button:
            _fail(f"{key}.href", "form", "a link target")
        _check_declarations(button, f"form.{key}", False)


def _check_declarations(spec: dict[str, Any], path: str, field: bool) -> None:
    """Reject a wrong value type or an unknown key in one field's declarations.

    Only a form field accepts declared attributes; buttons and the submission
    target belong to the form root.
    """
    for key in ("buttons", "action"):
        if key in spec:
            _fail(key, path, "the form root")
    if "multiple" in spec:
        multiple = spec["multiple"]
        if multiple is not True and multiple != "only" and not _is_object(multiple):
            _fail("multiple", path, "a boolean, only or an object")
        if _is_object(multiple):
            _closed(
                "multiple",
                multiple,
                (
                    "only",
                    "min",
                    "max",
                    "copy",
                    "sortable",
                    "title",
                    "controls",
                    "header",
                    "onclick",
                    "keys",
                ),
                path,
            )
            if "only" in multiple and not isinstance(multiple["only"], bool):
                _fail("multiple.only", path, "a boolean")
            # Rows of a data-only collection come from the data: row limits and row
            # controls do not apply.
            if multiple.get("only") is True:
                _closed("multiple", multiple, ("only", "title", "header", "keys"), path)
            # A keyed map is a data-only collection; validation resolves its reference.
            if "keys" in multiple:
                if multiple.get("only") is not True:
                    _fail("multiple.keys", path, "multiple.only: true")
                if not isinstance(multiple["keys"], str):
                    _fail("multiple.keys", path, "a reference to a repeated group")
            for key in ("min", "max"):
                if key in multiple and not (
                    isinstance(multiple[key], (int, float))
                    and not isinstance(multiple[key], bool)
                ):
                    _fail(f"multiple.{key}", path, "a number")
            for key in ("copy", "sortable"):
                if key in multiple and not isinstance(multiple[key], bool):
                    _fail(f"multiple.{key}", path, "a boolean")
            if "title" in multiple:
                if spec.get("type") != "group":
                    _fail("multiple.title", path, "a repeated group")
                raw_properties = spec.get("properties")
                properties: dict[str, Any] = (
                    raw_properties if _is_object(raw_properties) else {}
                )
                title = multiple["title"]
                if (
                    not isinstance(title, str)
                    or title not in properties
                    or not _scalar_child(properties[title])
                ):
                    _fail(
                        "multiple.title",
                        path,
                        "the name of a direct child field without multiple, properties or lang",
                    )
            if "controls" in multiple and multiple["controls"] not in (
                "header",
                "footer",
                "outline",
            ):
                _fail("multiple.controls", path, "header, footer or outline")
            if "header" in multiple and multiple["header"] not in ("static", "sticky"):
                _fail("multiple.header", path, "static or sticky")
    if (
        "lang" in spec
        and not isinstance(spec["lang"], bool)
        and not _is_object(spec["lang"])
    ):
        _fail("lang", path, "a boolean or an object")
    if _is_object(spec.get("lang")):
        lang = spec["lang"]
        _closed(
            "lang",
            lang,
            ("mode", "only", "name", "key", "frame", "title", "group_class"),
            path,
        )
        if "only" in lang:
            only = lang["only"]
            codes = isinstance(only, list) and all(
                isinstance(code, str) for code in only
            )
            if not codes and not _is_object(only):
                _fail("lang.only", path, "a list of language codes or an object")
    if "design" in spec:
        check_design_declaration(
            spec["design"],
            path,
            field,
            _group_layouts(spec) if field else None,
            field and _is_condition(spec),
        )
    if _is_object(spec.get("behavior")):
        _closed("behavior", spec["behavior"], ("onchange", "onclick", "onload"), path)
    if field and isinstance(spec.get("type"), str) and spec["type"].lower() == "range":
        _check_range_declaration(spec, path)
    if field and _is_condition(spec):
        _check_condition_declaration(spec, path)
        check_editor(spec, path)
    elif field and _is_object(spec.get("options")) and "fields" in spec["options"]:
        raise fields_error(path)


def _is_condition(spec: dict[str, Any]) -> bool:
    """Whether a field declares the condition type."""
    return isinstance(spec.get("type"), str) and spec["type"].lower() == "condition"


def _check_condition_declaration(spec: dict[str, Any], path: str) -> None:
    """Reject a condition field whose validate.conditionTree is not the literal true or judge.

    Every value of the field is checked as a condition tree.
    """
    raw_validate = spec.get("validate")
    validate: dict[str, Any] = raw_validate if _is_object(raw_validate) else {}
    parameter = validate.get("conditionTree")
    if parameter is not True and parameter != "judge":
        _fail("validate.conditionTree", path, "true or judge")


def _check_range_declaration(spec: dict[str, Any], path: str) -> None:
    """Reject a range field without literal bounds and a literal step whose multiple the minimum is.

    The slider moves from the minimum in steps.
    """
    raw_validate = spec.get("validate")
    validate: dict[str, Any] = raw_validate if _is_object(raw_validate) else {}
    bounds = validate.get("range")
    if not is_number_range(bounds):
        _fail(
            "validate.range",
            path,
            "[minimum, maximum] finite numbers with minimum not above maximum",
        )
    assert isinstance(bounds, list)  # is_number_range accepts only a list
    step = validate.get("step")
    if not is_step(step):
        _fail("validate.step", path, "a finite number above 0")
    assert isinstance(step, (int, float))  # is_step accepts only a finite number
    if not is_multiple(bounds[0], step):
        _fail("validate.range", path, "a minimum that is a multiple of validate.step")


def _group_layouts(spec: dict[str, Any]) -> list[str] | None:
    """The design.layout values a group field accepts.

    A repeated group has no line, and a field that is not a group has no
    layout at all.
    """
    if spec.get("type") != "group":
        return None
    multiple = spec.get("multiple")
    repeated = multiple is True or multiple == "only" or _is_object(multiple)
    return ["stacked", "inline"] if repeated else ["stacked", "inline", "line"]


def _declared_attribute_name(name: str) -> bool:
    """Whether a name is a data-* or aria-* name the renderer does not write itself."""
    if _DECLARED_NAME.match(name) is None or name in _OWNED_ATTRIBUTE_NAMES:
        return False
    return not name.startswith(_OWNED_ATTRIBUTE_PREFIXES)


def check_declared_attributes(attributes: object, key: str, path: str) -> None:
    """Reject declared attributes that are not an object of permitted names to strings; names first."""
    if not _is_object(attributes):
        _fail(key, path, "an object")
    for name in attributes:
        if not _declared_attribute_name(str(name)):
            _fail(
                f"{key}.{name}",
                path,
                "a data-* or aria-* name that crudui does not write",
            )
    for name, value in attributes.items():
        if not isinstance(value, str):
            _fail(f"{key}.{name}", path, "a string")


def check_design_declaration(
    design: object,
    path: str,
    field: bool = False,
    layouts: list[str] | None = None,
    condition: bool = False,
) -> None:
    """Reject a wrong value type or an unknown key in one declared design.

    A form field or button, a list or detail specification, or a list column or
    detail field. Only a form field accepts attributes and wrapper.attributes,
    and only a group field accepts `layout`, one of `layouts`.
    """
    if not isinstance(design, bool) and not _is_object(design):
        _fail("design", path, "a boolean or an object")
    if not _is_object(design):
        return
    allowed: tuple[str, ...]
    if layouts is not None:
        allowed = (
            "show",
            "class",
            "style",
            "attributes",
            "layout",
            "label",
            "wrapper",
            "group",
            "prepend",
        )
    elif field:
        allowed = (
            "show",
            "class",
            "style",
            "attributes",
            # A condition field also declares its editor (docs/spec/schema.md, Structured condition editor).
            *(("editor",) if condition else ()),
            "label",
            "wrapper",
            "group",
            "prepend",
        )
    else:
        allowed = ("show", "class", "style", "label", "wrapper", "group", "prepend")
    _closed("design", design, allowed, path)
    if (
        "show" in design
        and not isinstance(design["show"], bool)
        and not _condition_value(design["show"])
    ):
        _fail("design.show", path, "an expression, a boolean or a condition map")
    for key in ("class", "style"):
        if key in design and not _condition_value(design[key]):
            _fail(f"design.{key}", path, "a string or a condition map")
    if "attributes" in design:
        check_declared_attributes(design["attributes"], "design.attributes", path)
    if layouts is not None and "layout" in design and design["layout"] not in layouts:
        _fail(
            "design.layout",
            path,
            "stacked, inline or line" if len(layouts) == 3 else "stacked or inline",
        )
    for node in ("label", "wrapper", "group", "prepend"):
        if node not in design:
            continue
        if not _is_object(design[node]):
            _fail(f"design.{node}", path, "an object")
        values = design[node]
        node_allowed = (
            ("class", "style", "attributes")
            if field and node == "wrapper"
            else ("class", "style")
        )
        _closed(f"design.{node}", values, node_allowed, path)
        for key in ("class", "style"):
            if key in values and not _condition_value(values[key]):
                _fail(f"design.{node}.{key}", path, "a string or a condition map")
        if "attributes" in values:
            check_declared_attributes(
                values["attributes"], f"design.{node}.attributes", path
            )


def checked(template: object) -> dict[str, Any]:
    """A copy of a template input, rejecting a value of another shape than compile produces.

    The template kind, a field list, a button object list, an optional string
    keyPrefix, an optional object action, an optional description of any value
    and no other member; each field has exactly a string name, an object spec
    and a field list children.
    """
    copy: dict[str, Any] = spec_value(template)
    valid = (
        set(copy) <= {"kind", "keyPrefix", "fields", "buttons", "action", "description"}
        and copy.get("kind") == "crudui/form-template"
        and _field_list(copy.get("fields"))
        and isinstance(copy.get("buttons"), list)
        and all(isinstance(button, dict) for button in copy["buttons"])
        and ("keyPrefix" not in copy or isinstance(copy["keyPrefix"], str))
        and ("action" not in copy or _is_object(copy["action"]))
    )
    if not valid:
        raise FormError("INVALID_FORM_INPUT", "Unsupported form template")
    return copy


def _field_list(fields: object) -> bool:
    """A list of field templates."""
    if not isinstance(fields, list):
        return False
    for field in fields:
        if not isinstance(field, dict):
            return False
        if (
            set(field) != {"children", "name", "spec"}
            or not isinstance(field["name"], str)
            or not _is_object(field["spec"])
            or not _field_list(field["children"])
        ):
            return False
    return True
