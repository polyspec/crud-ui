"""The form validator: field traversal and validate-slot evaluation.

The third pass of the pipeline. It consumes a composed CRUDUI field model (the
`validate`/`design`/`behavior`/`options` role slots) after the compose pass has
expanded `$ref`/`$patch` into a single specification, and does not reimplement
the rule semantics or the expression engine — it calls the rule registry and
the expression engine. The logic here is: reading the `validate` slot,
evaluating a rule value that is an expression or a condition map (the
condition is the value's expression, never a separate `if`/`when` key), and
resolving `design.show` like a conditional parameter to skip hidden fields.

Pipeline:

1. compose — the caller expands the specification before this engine; an
   unresolved composition is a `ComposeLoadError`, never a valid result.
2. field traversal — recurse `properties`; group nesting and keyed `multiple`
   rows (sorted keys). A field whose `design.show` resolves to false is hidden:
   it and everything it contains is skipped for rules and kept for conditions.
3. validate-slot evaluation — per field, walk the `validate` slot in
   declaration order; for each rule, evaluate its value to the effective
   parameter, skip when the result is false or null, otherwise run the rule
   function. `type: number` runs an implicit `number` rule first when no
   explicit one is declared.
4. error collection — the first error per field stops that field; the errors
   collect into one flat list and `valid` is the absence of errors.
"""

import re
from collections.abc import Mapping
from typing import Any, TypeGuard

from .compose import MemoryLoader, compose_properties, compose_spec, compose_root
from .compose_errors import ComposeLoadError
from .data_limits import DataLimits, check_data_limits, data_limits
from .errors import FormInputError
from .forbidden import scan_forbidden_keys
from .keyed_maps import assert_keyed_map_keys, assert_keyed_map_reference
from .keyed_maps import is_multiple_field as _is_multiple_field
from .jsvalue import JsonValue, ordered_value
from .parser import Node, ParseError, is_condition_expression, parse_condition
from .resolver import evaluate_condition as _eval_condition
from .resolver import evaluate_expression_value as _eval_value
from .resolver import Value, get_field_name, path_to_string
from .references import REFERENCE_PARAMETER_MESSAGE, is_reference_target, reference_ids
from .rules import get_rule, rule_parameter_failure
from .group_source import (
    group_choices,
    group_source_failure,
    group_source_repeat,
    is_group_source,
)
from .loader import DocumentLoader
from .text import check_input_text, check_option_text, checked_composition

__all__ = ["ARRAY_LEVEL_RULES", "FormInputError", "Validator", "validate"]

ARRAY_LEVEL_RULES = ("required", "unique", "mincount", "maxcount")
PATH_REFERENCE_RULES = (
    "equalTo",
    "containedIn",
    "typeFrom",
    "minFrom",
    "maxFrom",
    "notEqual",
    "unique",
    "enddate",
    "reference",
)
LITERAL_PARAM_RULES = ("accept", "conditionTree")
REGEX_PARAM_RULES = ("match", "pattern")
MEMBERSHIP_PARAM_RULES = ("in",)

SINGLE_CHOICE_TYPES = frozenset(("select", "dropdown", "selectbox", "choice", "radio"))


def _is_object(value: object) -> TypeGuard[dict[str, JsonValue]]:
    return value is not None and isinstance(value, dict)


def _is_multiple_shape(multiple: object) -> bool:
    """Whether a `multiple` declaration is a boolean, `only` or an object (schema.md, CUSC-041)."""
    return isinstance(multiple, bool) or multiple == "only" or _is_object(multiple)


def _is_single_choice(field: dict[str, JsonValue]) -> bool:
    """Whether a field is a single-choice field: a single-choice type without `lang`."""
    lang = field.get("lang")
    return field.get("type") in SINGLE_CHOICE_TYPES and (lang is None or lang is False)


def _ordered_spec(spec: dict[str, JsonValue]) -> dict[str, JsonValue]:
    """A copy of a specification with every object in specification member order."""
    ordered = ordered_value(spec)
    assert isinstance(ordered, dict)  # an object stays an object
    return ordered


def _assert_single_choice_data(
    value: JsonValue, path: list[str], repeated: bool
) -> None:
    """Reject an array or object as the value of a single-choice field.

    Rows of a repeated one are checked in sorted key order.
    """
    entries: list[tuple[list[str], JsonValue]]
    if repeated:
        assert _is_object(
            value
        )  # repeated data is a keyed object, checked before this call
        entries = [([*path, key], value[key]) for key in sorted(value)]
    else:
        entries = [(path, value)]
    for entry_path, entry in entries:
        if isinstance(entry, (dict, list)):
            raise FormInputError(
                f"Choice data must be a single value: {path_to_string(entry_path)}"
            )


def _normalize_validate_slot(slot: JsonValue) -> dict[str, JsonValue] | None:
    """Normalize a polymorphic `validate` slot to a rule map.

    `false`, `true` and an absent slot carry no sub-rules; a non-object value
    carries none either.
    """
    if slot is False or slot is True or slot is None:
        return None
    if isinstance(slot, dict):
        return slot
    return None


def _field_messages(field: dict[str, JsonValue]) -> dict[str, JsonValue] | None:
    """The per-field custom messages of the field's `messages` map."""
    messages = field.get("messages")
    return messages if isinstance(messages, dict) else None


def _is_ternary(expression: str) -> bool:
    """Whether a string parses as a complete ternary expression."""
    try:
        return bool(parse_condition(expression)["type"] == "Ternary")
    except ParseError:
        return False


def _is_valid_expression(expression: str) -> bool:
    """Whether a string parses as a complete expression; any other string is a literal."""
    try:
        parse_condition(expression)
        return True
    except ParseError:
        return False


def _rule_value_form(rule_name: str, rule_value: JsonValue) -> str:
    """How a declared rule value becomes the rule's effective parameter.

    Path-reference, literal-param, regex and membership rules keep their
    parameter verbatim — never evaluated as a condition. A plain object is a
    condition map (expression to value, declaration order). A string that
    parses as a ternary selects its branch value. Another string that parses
    as a condition expression evaluates to its value. Anything else is a
    literal parameter.
    """
    if (
        rule_name in PATH_REFERENCE_RULES
        or rule_name in LITERAL_PARAM_RULES
        or rule_name in REGEX_PARAM_RULES
        or rule_name in MEMBERSHIP_PARAM_RULES
    ):
        return "literal"
    if _is_object(rule_value):
        return "conditionMap"
    if isinstance(rule_value, str):
        if _is_ternary(rule_value):
            return "ternary"
        if (
            is_condition_expression(rule_value)
            and re.search(r"\?[^:]*:", rule_value) is None
            and _is_valid_expression(rule_value)
        ):
            return "expression"
    return "literal"


def _ternary_literals(node: Node) -> list[JsonValue]:
    """Every literal branch of a ternary, through nested ternaries and groups."""
    kind = node["type"]
    if kind == "Ternary":
        return [
            *_ternary_literals(node["trueValue"]),
            *_ternary_literals(node["falseValue"]),
        ]
    if kind == "Group":
        return _ternary_literals(node["expression"])
    if kind == "Literal":
        return [node["value"]]
    return []


def _declared_literals(rule_name: str, rule_value: JsonValue) -> list[JsonValue]:
    """The literals a declared rule value can make the effective parameter.

    The value itself, every value of a condition map and every literal branch
    of a ternary; a plain condition expression always reads the data.
    """
    form = _rule_value_form(rule_name, rule_value)
    if form == "literal":
        return [rule_value]
    if form == "conditionMap" and _is_object(rule_value):
        return list(rule_value.values())
    if form == "ternary" and isinstance(rule_value, str):
        return _ternary_literals(parse_condition(rule_value))
    return []


class _ValidationRun:
    """The state of one validation, dropped when it returns.

    For each collection field (container path, field name and filter), the row
    keys whose `unique` value an earlier row already holds, and for each
    declaration path that `reference` names, its ids in the data.
    """

    def __init__(
        self, properties: dict[str, JsonValue], data: dict[str, JsonValue]
    ) -> None:
        self.unique_duplicates: dict[str, set[str]] = {}
        self._properties = properties
        self._data = data
        self._reference_ids: dict[str, list[JsonValue]] = {}

    def reference_ids(self, path: str) -> list[JsonValue]:
        """The ids of a declaration path in the data, collected once per validation."""
        if path not in self._reference_ids:
            self._reference_ids[path] = reference_ids(
                self._properties, self._data, path
            )
        return self._reference_ids[path]


class Validator:
    """The validator of one composed specification: a group with `properties`."""

    def __init__(
        self, composed_spec: dict[str, JsonValue], limits: DataLimits | None = None
    ) -> None:
        """`limits` bounds the data, measured after the rule parameters are checked
        and before any rule runs; data of any size when it is None."""
        self.limits = limits
        properties = composed_spec.get("properties")
        self.properties: dict[str, JsonValue] = (
            properties if _is_object(properties) else {}
        )
        self.run = _ValidationRun(self.properties, {})
        # The declaration fails the load: rule names and parameters are checked here.
        self._check_declared_parameters(self.properties, [])

    def validate(self, data: JsonValue) -> dict[str, Any]:
        """Validate `data` against the composed specification.

        Raises `FormInputError` when root, group or repeated data has the wrong
        shape.
        """
        if not _is_object(data):
            raise FormInputError("Form data must be an object")
        # The data is measured after the rule parameters, which the constructor
        # checked, and before any rule (CUVR-082).
        if self.limits is not None:
            check_data_limits(data, self.limits)
        self.run = _ValidationRun(self.properties, data)
        errors: list[dict[str, Any]] = []
        self._validate_properties(self.properties, data, [], [], [], data, errors)
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "hidden": self.hiddenPaths(data),
        }

    def hiddenPaths(self, data: JsonValue) -> list[str]:
        """The data paths of the fields whose `design.show` resolves to false.

        The paths come in declaration order, each field of a group row under
        the row's key and the fields inside a hidden field included. Data of
        another shape is read as missing.
        """
        hidden: list[str] = []
        self._collect_hidden(self.properties, data, [], [], data, hidden)
        return hidden

    def _collect_hidden(
        self,
        properties: dict[str, JsonValue],
        data: JsonValue,
        current_path: list[str],
        row_keys: list[int],
        all_data: JsonValue,
        hidden: list[str],
    ) -> None:
        for name, field in properties.items():
            if not _is_object(field):
                continue
            field_path = [*current_path, name]
            if self._is_hidden(
                field,
                {"currentPath": field_path, "rowKeys": row_keys, "formData": all_data},
            ):
                hidden.append(path_to_string(field_path))
            children = self._child_properties(field)
            if field.get("type") != "group" or children is None:
                continue
            value = data.get(name) if isinstance(data, dict) else None
            if not _is_multiple_field(field):
                self._collect_hidden(
                    children,
                    value if _is_object(value) else {},
                    field_path,
                    row_keys,
                    all_data,
                    hidden,
                )
                continue
            rows = value if _is_object(value) else {}
            for key in sorted(rows):
                row = rows[key]
                self._collect_hidden(
                    children,
                    row if _is_object(row) else {},
                    [*field_path, key],
                    [*row_keys, len(field_path)],
                    all_data,
                    hidden,
                )

    def _check_declared_parameters(
        self, properties: dict[str, JsonValue], declaration_path: list[str]
    ) -> None:
        """Check every declared rule name and parameter before any value is validated.

        Fields come in declaration order (a group before its children), each
        field's rules in declaration order and then its `messages` keys. Every
        literal a condition map or a ternary can select is checked here,
        selected or not; a value taken from the data is checked when it is
        selected.
        """
        for property_key, field in properties.items():
            if not _is_object(field):
                continue
            path = [*declaration_path, property_key]
            # The shape of multiple is checked before the field's group source and rules (schema.md, CUSC-081).
            if "multiple" in field and not _is_multiple_shape(field["multiple"]):
                raise ComposeLoadError(
                    "INVALID_RULE_PARAMETER",
                    f"Invalid multiple at {'.'.join(path)}: expected a boolean, only or an object",
                    path,
                )
            # A group source is checked before the field's rules (validation-rules.md, "Parameter errors").
            failure = group_source_failure(field, ".".join(path), self.properties)
            if failure is not None:
                raise ComposeLoadError("INVALID_RULE_PARAMETER", failure, path)
            rules = _normalize_validate_slot(field.get("validate"))
            for rule_name, rule_value in (rules or {}).items():
                _assert_rule_name(rule_name, path)
                for literal in _declared_literals(rule_name, rule_value):
                    _assert_rule_parameter(rule_name, literal, path)
                    if (
                        rule_name == "reference"
                        and isinstance(literal, str)
                        and not is_reference_target(self.properties, literal)
                    ):
                        raise ComposeLoadError(
                            "INVALID_RULE_PARAMETER",
                            REFERENCE_PARAMETER_MESSAGE,
                            list(path),
                        )
            for rule_name in _field_messages(field) or {}:
                _assert_rule_name(rule_name, path)
            assert_keyed_map_reference(field, path, self.properties)
            child_properties = self._child_properties(field)
            if field.get("type") == "group" and child_properties is not None:
                self._check_declared_parameters(child_properties, path)

    def _validate_properties(
        self,
        properties: dict[str, JsonValue],
        data: dict[str, JsonValue],
        current_path: list[str],
        row_keys: list[int],
        declaration_path: list[str],
        all_data: JsonValue,
        errors: list[dict[str, Any]],
        inside_hidden: bool = False,
    ) -> None:
        # Code point order, which a Python string holds natively; the input text
        # check has rejected every string that is not Unicode scalar values.
        for name in sorted(data):
            if name not in properties:
                raise FormInputError(
                    f"Unknown form data field: {path_to_string([*current_path, name])}"
                )
        for property_key, field in properties.items():
            if not _is_object(field):
                continue
            field_name = property_key
            is_multiple = _is_multiple_field(field)
            field_path = [*current_path, field_name]
            field_declaration = [*declaration_path, field_name]
            present = field_name in data
            field_value = data.get(field_name)

            # A hidden field and every field it contains are not evaluated; its value
            # is kept for conditions and references elsewhere. The data shape is an
            # input contract, so hidden data is still traversed for shape checks.
            hidden = inside_hidden or self._is_hidden(
                field,
                {"currentPath": field_path, "rowKeys": row_keys, "formData": all_data},
            )
            children = self._child_properties(field)
            if is_multiple and present and not _is_object(field_value):
                raise FormInputError(
                    f"Repeated data must be a keyed object: {path_to_string(field_path)}"
                )
            if is_multiple and present and _is_object(field_value):
                assert_keyed_map_keys(
                    field, field_value, field_path, row_keys, all_data
                )
            if present and _is_single_choice(field):
                _assert_single_choice_data(field_value, field_path, is_multiple)

            if field.get("type") == "group" and children is not None:
                if is_multiple:
                    # Keyed rows use sorted-key traversal so the first reported error is
                    # identical in every validation implementation. Row keys stay in
                    # paths. Missing data is an empty collection: no rows, and the
                    # collection rules still run.
                    rows: dict[str, JsonValue] = (
                        field_value if present and _is_object(field_value) else {}
                    )
                    for key in sorted(rows):
                        row = rows[key]
                        if not _is_object(row):
                            raise FormInputError(
                                f"Group data must be an object: {path_to_string([*field_path, key])}"
                            )
                        self._validate_properties(
                            children,
                            row,
                            [*field_path, key],
                            [*row_keys, len(field_path)],
                            field_declaration,
                            all_data,
                            errors,
                            hidden,
                        )
                    if not hidden:
                        self._validate_field_rules(
                            field,
                            field_value,
                            field_path,
                            row_keys,
                            field_declaration,
                            all_data,
                            errors,
                        )
                else:
                    if present and not _is_object(field_value):
                        raise FormInputError(
                            f"Group data must be an object: {path_to_string(field_path)}"
                        )
                    self._validate_properties(
                        children,
                        field_value if present and _is_object(field_value) else {},
                        field_path,
                        row_keys,
                        field_declaration,
                        all_data,
                        errors,
                        hidden,
                    )
                    if not hidden:
                        self._validate_field_rules(
                            field,
                            field_value,
                            field_path,
                            row_keys,
                            field_declaration,
                            all_data,
                            errors,
                        )
            elif hidden:
                continue
            elif is_multiple:
                # Repeated scalar field: collection rules on the keyed object, the
                # rest on each row value. Missing data is an empty collection.
                self._validate_multiple_field_rules(
                    field,
                    field_value if present else None,
                    field_path,
                    row_keys,
                    field_declaration,
                    all_data,
                    errors,
                )
            else:
                self._validate_field_rules(
                    field,
                    field_value,
                    field_path,
                    row_keys,
                    field_declaration,
                    all_data,
                    errors,
                )

    def _is_hidden(self, field: dict[str, JsonValue], context: dict[str, Any]) -> bool:
        """Whether a field's `design.show` resolves to false in its row context.

        `design.show` resolves like a conditional parameter: a boolean, an
        expression or a condition map. A field without `design.show` is
        visible.
        """
        design = field.get("design")
        if not _is_object(design) or "show" not in design:
            return False
        return self._resolve_rule_value("show", design["show"], context) is False

    def _child_properties(
        self, field: dict[str, JsonValue]
    ) -> dict[str, JsonValue] | None:
        """The child field map of a group, or None."""
        properties = field.get("properties")
        return properties if _is_object(properties) else None

    def _validate_multiple_field_rules(
        self,
        field: dict[str, JsonValue],
        values: JsonValue,
        field_path: list[str],
        row_keys: list[int],
        declaration_path: list[str],
        all_data: JsonValue,
        errors: list[dict[str, Any]],
    ) -> None:
        """Collection rules and per-row rules for a repeated scalar field."""
        rules = _normalize_validate_slot(field.get("validate"))
        messages = _field_messages(field)
        # 1. Array-level rules in declaration order; the first error wins for the field.
        if rules:
            context = {
                "currentPath": field_path,
                "rowKeys": row_keys,
                "formData": all_data,
            }
            for rule_name, rule_value in rules.items():
                if rule_name not in ARRAY_LEVEL_RULES:
                    continue
                error = self._run_rule(
                    rule_name,
                    rule_value,
                    values,
                    context,
                    declaration_path,
                    field,
                    messages,
                )
                if error is not None:
                    errors.append(
                        {
                            "path": path_to_string(field_path),
                            "field": get_field_name(field_path),
                            "rule": rule_name,
                            "message": error,
                            "value": None if values is None else values,
                        }
                    )
                    return
        # 2. Row rules in sorted row-key order (the error-order contract).
        rows: dict[str, JsonValue] = values if _is_object(values) else {}
        for key in sorted(rows):
            self._validate_element_rules(
                field,
                rows[key],
                [*field_path, key],
                [*row_keys, len(field_path)],
                declaration_path,
                all_data,
                errors,
            )

    def _validate_element_rules(
        self,
        field: dict[str, JsonValue],
        value: JsonValue,
        item_path: list[str],
        row_keys: list[int],
        declaration_path: list[str],
        all_data: JsonValue,
        errors: list[dict[str, Any]],
    ) -> None:
        """Element-level rules for one element of a `multiple` field."""
        context = {"currentPath": item_path, "rowKeys": row_keys, "formData": all_data}
        messages = _field_messages(field)
        rules = _normalize_validate_slot(field.get("validate"))
        if self._run_implicit_rules(
            field, rules, value, context, declaration_path, messages, item_path, errors
        ):
            return
        if not rules:
            return
        for rule_name, rule_value in rules.items():
            if rule_name in ARRAY_LEVEL_RULES:
                continue
            error = self._run_rule(
                rule_name, rule_value, value, context, declaration_path, field, messages
            )
            if error is not None:
                errors.append(
                    {
                        "path": path_to_string(item_path),
                        "field": get_field_name(item_path),
                        "rule": rule_name,
                        "message": error,
                        "value": None if value is None else value,
                    }
                )
                break

    def _validate_field_rules(
        self,
        field: dict[str, JsonValue],
        value: JsonValue,
        field_path: list[str],
        row_keys: list[int],
        declaration_path: list[str],
        all_data: JsonValue,
        errors: list[dict[str, Any]],
    ) -> None:
        """All rules for a single (scalar or group-as-whole) field."""
        context = {"currentPath": field_path, "rowKeys": row_keys, "formData": all_data}
        messages = _field_messages(field)
        rules = _normalize_validate_slot(field.get("validate"))
        if self._run_implicit_rules(
            field, rules, value, context, declaration_path, messages, field_path, errors
        ):
            return
        if not rules:
            return
        for rule_name, rule_value in rules.items():
            error = self._run_rule(
                rule_name, rule_value, value, context, declaration_path, field, messages
            )
            if error is not None:
                errors.append(
                    {
                        "path": path_to_string(field_path),
                        "field": get_field_name(field_path),
                        "rule": rule_name,
                        "message": error,
                        "value": None if value is None else value,
                    }
                )
                break

    def _run_implicit_rules(
        self,
        field: dict[str, JsonValue],
        rules: dict[str, JsonValue] | None,
        value: JsonValue,
        context: dict[str, Any],
        declaration_path: list[str],
        messages: dict[str, JsonValue] | None,
        path: list[str],
        errors: list[dict[str, Any]],
    ) -> bool:
        """Run the rules a field implies before its declared rules.

        `type: number` implies a `number` rule unless the field declares one, and
        an `items` group source implies an `in` rule whose members are the choice
        values that the source gives for the data being validated
        (validation-rules.md, "Evaluation" and "Values"). The first failure is
        recorded under its rule name; returns True when one was recorded.
        """
        implied: list[tuple[str, JsonValue]] = []
        if field.get("type") == "number" and (rules is None or "number" not in rules):
            implied.append(("number", True))
        source = field.get("items")
        if is_group_source(source):
            # A repeated value among the source rows is data that the choices cannot
            # express (CUVR-087).
            repeat = group_source_repeat(source, context["formData"])
            if repeat is not None:
                raise FormInputError(repeat)
            members: list[JsonValue] = [
                choice["value"] for choice in group_choices(source, context["formData"])
            ]
            implied.append(("in", members))
        for rule_name, rule_value in implied:
            error = self._run_rule(
                rule_name, rule_value, value, context, declaration_path, field, messages
            )
            if error is not None:
                errors.append(
                    {
                        "path": path_to_string(path),
                        "field": get_field_name(path),
                        "rule": rule_name,
                        "message": error,
                        "value": None if value is None else value,
                    }
                )
                return True
        return False

    def _run_rule(
        self,
        rule_name: str,
        rule_value: JsonValue,
        value: JsonValue,
        context: dict[str, Any],
        declaration_path: list[str],
        field: dict[str, JsonValue],
        messages: dict[str, JsonValue] | None,
    ) -> str | None:
        """Run one rule: evaluate its (possibly conditional) value to the effective parameter,
        skip when the result disables the rule, else call the rule function."""
        effective_param = self._resolve_rule_value(rule_name, rule_value, context)
        # A false or null effective param disables the rule.
        if effective_param is False or effective_param is None:
            return None
        # A value taken from the data is checked when it is selected, before the
        # empty-value skip. Declared literals already passed at load, so checking
        # every resolved conditional value adds no other failure.
        if _rule_value_form(rule_name, rule_value) != "literal":
            _assert_rule_parameter(rule_name, effective_param, declaration_path)
        rule = get_rule(rule_name)
        if rule is None:
            # Rule names are checked when the specification loads.
            raise RuntimeError(f"Rule {rule_name} is not registered")
        validation_context: dict[str, Any] = {
            "path": path_to_string(context["currentPath"]),
            "field": get_field_name(context["currentPath"]),
            "value": value,
            "allData": context["formData"],
            # The rule reads `spec.type`/`spec.messages` only; pass the field as is.
            "spec": field,
            "pathSegments": context["currentPath"],
            "rowKeys": context.get("rowKeys") or [],
            "ruleParam": effective_param,
            "messages": messages,
            "ruleName": rule_name,
            "run": self.run,
        }
        return rule(validation_context)

    def _resolve_rule_value(
        self, rule_name: str, rule_value: JsonValue, context: dict[str, Any]
    ) -> Value:
        """Resolve a rule value to the effective parameter."""
        form = _rule_value_form(rule_name, rule_value)
        if form == "conditionMap" and _is_object(rule_value):
            return self._resolve_condition_map(rule_value, context)
        if form == "ternary" and isinstance(rule_value, str):
            return self._evaluate_ternary(rule_value, context)
        if form == "expression" and isinstance(rule_value, str):
            return self._evaluate_expression_value(rule_value, context)
        return rule_value

    def _resolve_condition_map(
        self, condition_map: dict[str, JsonValue], context: dict[str, Any]
    ) -> JsonValue:
        """Evaluate a condition map: the value of the first truthy key in
        declaration order, then the `true` key, else None (rule disabled)."""
        for key in condition_map:
            if key == "true":
                continue  # The default is the fallback, evaluated last.
            if self._evaluate_condition(key, context):
                return condition_map[key]
        if "true" in condition_map:
            return condition_map["true"]
        return None

    def _evaluate_ternary(self, expression: str, context: dict[str, Any]) -> Value:
        """Evaluate a ternary; its selected branch value is the parameter.

        A ternary that cannot be evaluated remains the literal string.
        """
        try:
            return _eval_value(parse_condition(expression), context, "CURRENT")
        except ValueError, TypeError:
            return expression

    def _evaluate_condition(self, expression: str, context: dict[str, Any]) -> bool:
        try:
            return _eval_condition(parse_condition(expression), context, "CURRENT")
        except ValueError, TypeError:
            return False

    def _evaluate_expression_value(
        self, expression: str, context: dict[str, Any]
    ) -> Value:
        try:
            return _eval_value(parse_condition(expression), context, "CURRENT")
        except ValueError, TypeError:
            return False


def _assert_rule_parameter(
    rule_name: str, param: object, declaration_path: list[str]
) -> None:
    """Raise the load failure of an effective parameter outside the definitions."""
    failure = rule_parameter_failure(rule_name, param)
    if failure is not None:
        code, message = failure
        raise ComposeLoadError(code, message, declaration_path)


def _assert_rule_name(rule_name: str, declaration_path: list[str]) -> None:
    """Raise the load failure of a `validate` or `messages` key that is not a rule."""
    if get_rule(rule_name) is None:
        raise ComposeLoadError(
            "UNKNOWN_RULE", f"Unknown rule: {rule_name}", declaration_path
        )


def _files_loader(options: Mapping[str, Any]) -> MemoryLoader:
    """The memory loader of the `files` option, each document in specification member order."""
    files = options.get("files") or {}
    return MemoryLoader(
        {key: _ordered_spec(document) for key, document in files.items()}
        if isinstance(files, dict)
        else files
    )


def _composed_properties(
    spec: dict[str, JsonValue],
    checked: DocumentLoader | None,
    options: Mapping[str, Any],
) -> JsonValue:
    """The composed `properties` of a root specification, scanned for forbidden keys."""
    loader = checked if checked is not None else _files_loader(options)
    opts = {"basepath": options["basepath"]} if options.get("basepath") else {}

    # Two entry shapes: a full root group spec composes as a whole, and a
    # properties-layer composition entry (`$ref`/`$patch` with no own
    # `properties`) composes as a properties map directly.
    has_own_properties = _is_object(spec.get("properties"))
    is_composition_entry = "$ref" in spec or "$patch" in spec
    properties: JsonValue
    if is_composition_entry and not has_own_properties:
        properties = compose_properties(spec, loader, opts)
    else:
        properties = compose_spec(spec, loader, opts).get("properties") or {}

    # Walk the composed single specification to arbitrary depth and reject any
    # forbidden meta key before validation entry; the form root declarations
    # are scanned like the fields they sit beside.
    scan_forbidden_keys(properties, ["properties"])
    for key in ("buttons", "action"):
        if key in spec:
            scan_forbidden_keys(spec[key], [key])
    return properties


def validate(
    spec: dict[str, JsonValue],
    data: JsonValue,
    options: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Validate `data` against a CRUDUI specification.

    The specification may carry `$ref`/`$patch`; they are expanded first. Input
    text is checked before composition: the specification and files, the data,
    then the options. Root data is a request precondition, checked before
    composition too.

    Raises `ComposeLoadError` when the composition cannot be resolved (a load
    failure, never a valid result) and `FormInputError` when the data has the
    wrong shape.
    """
    options = options or {}
    checked = checked_composition(spec, options)
    check_input_text([("data", data)])
    check_option_text(options, ["basepath"])
    if not _is_object(data):
        raise FormInputError("Form data must be an object")
    ordered = _ordered_spec(spec)
    properties = _composed_properties(ordered, checked, options)
    # The data limits are checked after the forbidden-key scan and before the rule names.
    limits = data_limits(ordered)
    return Validator({"type": "group", "properties": properties}, limits).validate(data)


def hiddenPaths(spec: dict[str, JsonValue], data: JsonValue) -> list[str]:
    """The data paths of the fields whose `design.show` resolves to false against `data`.

    The specification is composed without files, as the browser binding sends
    it. Raises `ComposeLoadError` when the composition cannot be resolved and
    `FormInputError` when the data is not an object.
    """
    checked = checked_composition(spec, {})
    check_input_text([("data", data)])
    if not _is_object(data):
        raise FormInputError("Form data must be an object")
    ordered = _ordered_spec(spec)
    properties = _composed_properties(ordered, checked, {})
    return Validator({"type": "group", "properties": properties}).hiddenPaths(data)


def validateList(
    spec: dict[str, JsonValue], options: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    """Validate a CRUDUI list specification's structure.

    The `columns` map and a `{ $ref, $patch }` `search` overlay expand through
    the same composition engine the form specification uses, then the whole
    composed list tree is scanned for forbidden meta keys. No rows are
    validated: a list injects them. Raises `ComposeLoadError` for an
    unresolved composition or a forbidden key.
    """
    return _validate_structure(spec, options, {"columns": False, "search": True})


def validateDetail(
    spec: dict[str, JsonValue], options: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    """Validate a detail specification's composition and forbidden-key structure.

    The root composes exactly as a list root does; the `fields` map composes as
    the composition entry point. Raises `ComposeLoadError` for an unresolved
    composition or a forbidden key.
    """
    return _validate_structure(spec, options, {"fields": False})


def _validate_structure(
    spec: dict[str, JsonValue],
    options: Mapping[str, Any] | None,
    maps: Mapping[str, bool],
) -> dict[str, Any]:
    """Compose the root of a list or detail and its object maps, then scan for forbidden keys.

    `maps` names the object maps to compose; a map marked True composes only
    when it declares `$ref` or `$patch`.
    """
    options = options or {}
    checked = checked_composition(spec, options)
    from .text import check_option_text

    check_option_text(options, ["basepath"])
    loader = checked if checked is not None else _files_loader(options)
    opts = {"basepath": options["basepath"]} if options.get("basepath") else {}

    composed = compose_root(_ordered_spec(spec), loader, opts)
    for key, only_composed in maps.items():
        member = composed.get(key)
        if _is_object(member) and (
            not only_composed or "$ref" in member or "$patch" in member
        ):
            composed = {**composed, key: compose_properties(member, loader, opts)}
    scan_forbidden_keys(composed, [])
    return {"valid": True, "errors": []}
