"""The validation rules registry.

Each rule receives the validation context — the value, the effective rule
parameter, the custom messages, the whole form data and the state of the
validation — and returns its error message or None. A false or null parameter
disables a rule; an empty value passes every rule except `required`, which the
empty-value definitions decide, and the count rules, which read the count of
the value.
"""

import calendar
import json
import math
import re
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Callable, TypeAlias, cast

from . import condition_tree
from .jsvalue import JsonValue
from .parser import is_condition_expression, parse_condition
from .pattern import PatternSyntaxError, compile_pattern
from .references import REFERENCE_PARAMETER_MESSAGE
from .resolver import (
    Value,
    evaluate_condition,
    get_value_by_path,
    parse_path_string,
    resolve_field_reference,
)
from .values import (
    canonical_text,
    code_point_length,
    count_of,
    format_message,
    is_digits,
    is_empty_value,
    is_finite_number,
    is_length_limit,
    is_length_range,
    is_member,
    is_multiple,
    is_number_range,
    is_step,
    numeric_value,
    read_members,
    trim,
)

__all__ = ["get_rule", "get_rule_names", "rule_parameter_failure"]

# A rule's context: `value`, `ruleParam`, `messages`, `formData`, `currentPath`, `rowKeys` and `allData`, as the field layer builds it.
RuleContext: TypeAlias = dict[str, Any]
# A rule: it returns the failure message of a value, or None when the value passes.
Rule: TypeAlias = Callable[[RuleContext], str | None]

_EMAIL = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
)

_DATE_FORMATS = (
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%d/%m/%Y",
    "%Y/%m/%d",
)

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_DIGITS_ONLY = re.compile(r"^[0-9]+$")

_EXTENSION_TO_MIME = {
    "jpg": ["image/jpeg"],
    "jpeg": ["image/jpeg"],
    "png": ["image/png"],
    "gif": ["image/gif"],
    "webp": ["image/webp"],
    "svg": ["image/svg+xml"],
    "bmp": ["image/bmp"],
    "ico": ["image/x-icon", "image/vnd.microsoft.icon"],
    "pdf": ["application/pdf"],
    "doc": ["application/msword"],
    "docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    "xls": ["application/vnd.ms-excel"],
    "xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    "ppt": ["application/vnd.ms-powerpoint"],
    "pptx": [
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ],
    "txt": ["text/plain"],
    "csv": ["text/csv", "application/csv"],
    "mp3": ["audio/mpeg", "audio/mp3"],
    "wav": ["audio/wav", "audio/x-wav"],
    "ogg": ["audio/ogg"],
    "flac": ["audio/flac"],
    "mp4": ["video/mp4"],
    "webm": ["video/webm"],
    "avi": ["video/x-msvideo"],
    "mov": ["video/quicktime"],
    "mkv": ["video/x-matroska"],
    "zip": ["application/zip", "application/x-zip-compressed"],
    "rar": ["application/x-rar-compressed", "application/vnd.rar"],
    "tar": ["application/x-tar"],
    "gz": ["application/gzip"],
    "7z": ["application/x-7z-compressed"],
    "json": ["application/json"],
    "xml": ["application/xml", "text/xml"],
    "html": ["text/html"],
    "css": ["text/css"],
    "js": ["application/javascript", "text/javascript"],
}


def _messages(context: RuleContext) -> dict[str, Any]:
    messages = context.get("messages")
    return messages if isinstance(messages, dict) else {}


def _message(context: RuleContext, key: str, default: str) -> str:
    """The configured message of a rule, or its default."""
    return cast(str, _messages(context).get(key, default))


def _disabled(rule_param: object) -> bool:
    """A false, null or missing parameter disables a rule."""
    return rule_param is False or rule_param is None


def _rule_required(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is not True:
        return None
    if is_empty_value(value):
        message: str = _message(context, "required", "This field is required.")
        return message
    return None


def _valid_email(value: JsonValue) -> bool:
    if not isinstance(value, str):
        return False
    if _EMAIL.match(value) is None:
        return False
    local = value[: value.index("@")]
    if local.startswith(".") or local.endswith(".") or ".." in local:
        return False
    return True


def _rule_email(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is not True:
        return None
    if is_empty_value(value):
        return None
    if not _valid_email(value):
        message: str = _message(context, "email", "Please enter a valid email address.")
        return message
    return None


def _valid_url(value: JsonValue) -> bool:
    if not isinstance(value, str):
        return False
    trimmed = trim(value)
    if trimmed == "":
        return False
    try:
        parsed = urllib.parse.urlsplit(trimmed)
    except ValueError:
        return False
    if parsed.scheme.lower() not in ("http", "https", "ftp"):
        return False
    return parsed.netloc != ""


def _rule_url(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is False:
        return None
    if is_empty_value(value):
        return None
    if not _valid_url(value):
        message: str = _message(context, "url", "Please enter a valid URL.")
        return message
    return None


def _rule_minlength(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_length_limit(rule_param):
        raise TypeError(
            "Invalid minlength parameter: expected an integer from 0 to 9007199254740991"
        )
    if is_empty_value(value):
        return None
    length = code_point_length(value)
    if length is None or length < rule_param:
        message = _message(
            context, "minlength", "Please enter at least {0} characters."
        )
        return format_message(message, rule_param)
    return None


def _rule_maxlength(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_length_limit(rule_param):
        raise TypeError(
            "Invalid maxlength parameter: expected an integer from 0 to 9007199254740991"
        )
    if is_empty_value(value):
        return None
    length = code_point_length(value)
    if length is None or length > rule_param:
        message = _message(
            context, "maxlength", "Please enter no more than {0} characters."
        )
        return format_message(message, rule_param)
    return None


def _rule_rangelength(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_length_range(rule_param):
        raise TypeError(
            "Invalid rangelength parameter: expected [minimum, maximum] integers "
            "with minimum not above maximum"
        )
    if is_empty_value(value):
        return None
    minimum, maximum = rule_param
    length = code_point_length(value)
    if length is None or length < minimum or length > maximum:
        message = _message(
            context,
            "rangelength",
            "Please enter a value between {0} and {1} characters.",
        )
        return format_message(message, minimum, maximum)
    return None


def _rule_match(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    rule_name = context.get("ruleName")
    if _disabled(rule_param):
        return None
    if not isinstance(rule_param, str):
        raise TypeError(
            f"Invalid {rule_name or 'match'} parameter: expected a pattern string"
        )
    if is_empty_value(value):
        return None
    # A pattern outside the language is never skipped.
    matcher = compile_pattern(rule_param)
    text = canonical_text(value)
    if text is None or not matcher.test(text):
        messages = _messages(context)
        named = (
            messages.get("pattern") if rule_name == "pattern" else messages.get("match")
        )
        return named or "Please enter a valid format."
    return None


def _rule_number(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if rule_param is not True:
        raise TypeError("Invalid number parameter: expected true or false")
    if is_empty_value(value):
        return None
    if numeric_value(value) is None:
        message: str = _message(context, "number", "Please enter a valid number.")
        return message
    return None


def _rule_digits(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if rule_param is not True:
        raise TypeError("Invalid digits parameter: expected true or false")
    if is_empty_value(value):
        return None
    if not is_digits(value):
        message: str = _message(context, "digits", "Please enter only digits.")
        return message
    return None


def _rule_min(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_finite_number(rule_param):
        raise TypeError("Invalid min parameter: expected a finite number")
    if is_empty_value(value):
        return None
    number = numeric_value(value)
    if number is None or number < rule_param:
        message = _message(
            context, "min", "Please enter a value greater than or equal to {0}."
        )
        return format_message(message, rule_param)
    return None


def _rule_max(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_finite_number(rule_param):
        raise TypeError("Invalid max parameter: expected a finite number")
    if is_empty_value(value):
        return None
    number = numeric_value(value)
    if number is None or number > rule_param:
        message = _message(
            context, "max", "Please enter a value less than or equal to {0}."
        )
        return format_message(message, rule_param)
    return None


def _rule_range(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_number_range(rule_param):
        raise TypeError(
            "Invalid range parameter: expected [minimum, maximum] finite numbers "
            "with minimum not above maximum"
        )
    if is_empty_value(value):
        return None
    minimum, maximum = rule_param
    number = numeric_value(value)
    if number is None or number < minimum or number > maximum:
        message = _message(
            context, "range", "Please enter a value between {0} and {1}."
        )
        return format_message(message, minimum, maximum)
    return None


def _rule_step(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_step(rule_param):
        raise TypeError("Invalid step parameter: expected a finite number above 0")
    if is_empty_value(value):
        return None
    number = numeric_value(value)
    if number is None or not is_multiple(number, rule_param):
        message = _message(
            context, "step", "Please enter a value that is a multiple of {0}."
        )
        return format_message(message, rule_param)
    return None


def _resolve_field_param(param: JsonValue, context: RuleContext) -> Value:
    return resolve_field_reference(
        str(param),
        {
            "currentPath": context["pathSegments"],
            "rowKeys": context["rowKeys"],
            "formData": context["allData"],
        },
    )


def _rule_equal_to(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is None:
        return None
    if is_empty_value(value):
        return None
    target = _resolve_field_param(rule_param, context)
    if not _same_value(value, target):
        message: str = _message(
            context, "equalTo", "Please enter the same value again."
        )
        return message
    return None


def _rule_contained_in(context: RuleContext) -> str | None:
    """A string value occurs in the string value of the referenced field (CUVR-075)."""
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is None:
        return None
    if is_empty_value(value):
        return None
    target = _resolve_field_param(rule_param, context)
    if isinstance(value, str) and isinstance(target, str) and value in target:
        return None
    message: str = _message(
        context,
        "containedIn",
        "Please enter a value that the referenced field contains.",
    )
    return message


def _has_declared_type(value: Value, declared: Value) -> bool:
    """Whether the value has the type that `declared` names: bool, int or enum."""
    if declared == "bool":
        return isinstance(value, bool)
    if declared == "int":
        if isinstance(value, bool):
            return False
        if isinstance(value, int):
            return True
        return isinstance(value, float) and math.isfinite(value) and value.is_integer()
    if declared == "enum":
        return isinstance(value, str)
    return False


def _rule_type_from(context: RuleContext) -> str | None:
    """The value has the type that the referenced field names (CUVR-077)."""
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is None:
        return None
    if is_empty_value(value):
        return None
    if _has_declared_type(value, _resolve_field_param(rule_param, context)):
        return None
    message: str = _message(
        context, "typeFrom", "Please enter a value of the declared type."
    )
    return message


def _finite_bound(value: Value) -> float | None:
    """The finite number of a data value; a boolean is none."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def _bound_from(
    context: RuleContext, rule: str, fallback: str, below: bool
) -> str | None:
    """A finite number at or above (below is False) or at or below the referenced value (CUVR-079)."""
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is None or is_empty_value(value):
        return None
    bound = _resolve_field_param(rule_param, context)
    number = _finite_bound(value)
    if number is not None and bound is None:
        return None
    limit = _finite_bound(bound)
    if (
        number is not None
        and limit is not None
        and (number <= limit if below else number >= limit)
    ):
        return None
    message: str = _message(context, rule, fallback)
    return message


def _rule_min_from(context: RuleContext) -> str | None:
    return _bound_from(
        context,
        "minFrom",
        "Please enter a value at or above the declared minimum.",
        False,
    )


def _rule_max_from(context: RuleContext) -> str | None:
    return _bound_from(
        context,
        "maxFrom",
        "Please enter a value at or below the declared maximum.",
        True,
    )


def _same_value(left: Value, right: Value) -> bool:
    """The strict equality of two data values: objects and lists by identity."""
    if isinstance(left, (dict, list)) or isinstance(right, (dict, list)):
        return left is right
    if left is None or right is None:
        return left is None and right is None
    if isinstance(left, bool) != isinstance(right, bool):
        return False
    return left == right


def _rule_not_equal(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is None:
        return None
    if is_empty_value(value):
        return None
    # A field path reference (leading dot) resolves with the same relative-path
    # semantics as a condition; any other value compares directly.
    if isinstance(rule_param, str) and rule_param.startswith("."):
        compare = _resolve_field_param(rule_param, context)
    else:
        compare = rule_param
    if _same_value(value, compare):
        message: str = _message(context, "notEqual", "Please enter a different value.")
        return message
    return None


def _rule_in(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    members = read_members(rule_param)
    if isinstance(members, str):
        raise TypeError(members)
    if is_empty_value(value):
        return None
    if not is_member(value, members):
        message: str = _message(context, "in", "Please select a valid option.")
        return message
    return None


def _rule_reference(context: RuleContext) -> str | None:
    """Fail a value that is not a member of the ids of the declaration path its
    parameter names (validation rules, "References"). Empty values pass."""
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not isinstance(rule_param, str):
        raise TypeError(REFERENCE_PARAMETER_MESSAGE)
    if is_empty_value(value):
        return None
    if not is_member(value, context["run"].reference_ids(rule_param)):
        message: str = _message(
            context, "reference", "Please select an existing value."
        )
        return message
    return None


def _strptime_layout(text: str, pattern: str) -> datetime | None:
    """The datetime `text` names in `pattern`, or None when it has another layout.

    A value is tried against each accepted layout in turn, so a mismatch with one
    layout is the expected outcome here and only a value that matches none is invalid.
    """
    try:
        return datetime.strptime(text, pattern)
    except ValueError:
        return None


def _parse_date(value: Value) -> datetime | None:
    """The date a value names in an accepted layout, or None.

    Accepted layouts: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY/MM/DD`
    and an ISO datetime with an optional offset.
    """
    if isinstance(value, str):
        text = trim(value)
        if text == "":
            return None
        for pattern in (*_DATE_FORMATS, "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"):
            parsed = _strptime_layout(text, pattern)
            if parsed is not None:
                return parsed
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        # A Unix timestamp in milliseconds, as JavaScript reads one.
        try:
            return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)
        except OverflowError, OSError, ValueError:
            return None
    return None


_ISO_DAY = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})$")
_SLASH_YEAR_FIRST = re.compile(r"^([0-9]{4})/([0-9]{2})/([0-9]{2})$")
_SLASH_YEAR_LAST = re.compile(r"^([0-9]{2})/([0-9]{2})/([0-9]{4})$")
_DATE_TIME = re.compile(
    r"^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(Z|[+-][0-9]{2}:[0-9]{2})$"
)


def _calendar_day(year: int, month: int, day: int) -> bool:
    if month < 1 or month > 12 or day < 1:
        return False
    return day <= calendar.monthrange(year, month)[1]


def _is_day_text(text: str) -> bool:
    """Whether a trimmed text is YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY or DD/MM/YYYY naming a calendar day."""
    match = _ISO_DAY.match(text) or _SLASH_YEAR_FIRST.match(text)
    if match is not None:
        return _calendar_day(int(match[1]), int(match[2]), int(match[3]))
    match = _SLASH_YEAR_LAST.match(text)
    if match is not None:
        year = int(match[3])
        return _calendar_day(year, int(match[1]), int(match[2])) or _calendar_day(
            year, int(match[2]), int(match[1])
        )
    return False


def _valid_date(value: Value) -> bool:
    """The date rule (CUVR-058): a string, trimmed, in one of the layouts with a calendar day, or an RFC 3339
    date-time with a valid time and offset. A number is not a date."""
    if not isinstance(value, str):
        return False
    text = trim(value)
    match = _DATE_TIME.match(text)
    if match is None:
        return _is_day_text(text)
    hour, minute, second = int(match[2]), int(match[3]), int(match[4])
    if not _is_day_text(match[1]) or hour > 23 or minute > 59 or second > 59:
        return False
    offset = match[5]
    return offset == "Z" or (int(offset[1:3]) <= 23 and int(offset[4:6]) <= 59)


def _rule_date(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is False:
        return None
    if is_empty_value(value):
        return None
    if not _valid_date(value):
        message: str = _message(context, "date", "Please enter a valid date.")
        return message
    return None


def _valid_date_iso(value: Value) -> bool:
    if not isinstance(value, str):
        return False
    trimmed = trim(value)
    if _ISO_DATE.match(trimmed) is None:
        return False
    year, month, day = (int(part) for part in trimmed.split("-"))
    if month < 1 or month > 12:
        return False
    if day < 1 or day > calendar.monthrange(year, month)[1]:
        return False
    return True


def _rule_date_iso(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is False:
        return None
    if is_empty_value(value):
        return None
    if not _valid_date_iso(value):
        message = _message(
            context, "dateISO", "Please enter a valid date in ISO format (YYYY-MM-DD)."
        )
        return message
    return None


def _rule_enddate(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is None:
        return None
    if is_empty_value(value):
        return None
    end = _parse_date(value)
    if end is None:
        return None
    start_value = _resolve_field_param(str(rule_param), context)
    if is_empty_value(start_value):
        return None
    start = _parse_date(start_value)
    if start is None:
        return None
    if end < start:
        message: str = _message(
            context, "enddate", "End date must be after the start date."
        )
        return message
    return None


def _rule_mincount(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_length_limit(rule_param):
        raise TypeError(
            "Invalid mincount parameter: expected an integer from 0 to 9007199254740991"
        )
    if count_of(value) < rule_param:
        message = _message(context, "mincount", "Please select at least {0} items.")
        return format_message(message, rule_param)
    return None


def _rule_maxcount(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if _disabled(rule_param):
        return None
    if not is_length_limit(rule_param):
        raise TypeError(
            "Invalid maxcount parameter: expected an integer from 0 to 9007199254740991"
        )
    if count_of(value) > rule_param:
        message = _message(context, "maxcount", "Please select no more than {0} items.")
        return format_message(message, rule_param)
    return None


def _canonical_key(value: JsonValue) -> str:
    """The canonical key of a value for `unique`: equal keys mean the same JSON value."""
    if value is None:
        return "z"
    if isinstance(value, bool):
        return "b1" if value else "b0"
    if isinstance(value, (int, float)):
        return f"n{canonical_text(value)}"
    if isinstance(value, str):
        return f"s{json.dumps(value, ensure_ascii=False)}"
    if isinstance(value, list):
        return f"a[{','.join(_canonical_key(item) for item in value)}]"
    if isinstance(value, dict):
        members = ",".join(
            f"{json.dumps(name, ensure_ascii=False)}:{_canonical_key(value[name])}"
            for name in sorted(value)
        )
        return f"o{{{members}}}"
    return f"u{value}"


def _all_unique(values: list[JsonValue]) -> bool:
    seen = set()
    for value in values:
        key = _canonical_key(value)
        if key in seen:
            return False
        seen.add(key)
    return True


def _extract_field_values(items: list[JsonValue], field_name: str) -> list[JsonValue]:
    values = []
    segments = parse_path_string(field_name)
    for item in items:
        if isinstance(item, dict):
            value = get_value_by_path(item, segments)
            if not is_empty_value(value):
                values.append(value)
    return values


def _item_passes(
    condition: str, item_field_path: list[str], row_keys: list[int], all_data: JsonValue
) -> bool:
    try:
        ast = parse_condition(condition)
        return evaluate_condition(
            ast,
            {"currentPath": item_field_path, "rowKeys": row_keys, "formData": all_data},
            "CURRENT",
        )
    except ValueError, TypeError:
        return False


def _rule_unique(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    all_data = context["allData"]
    path_segments = context["pathSegments"]
    row_keys = context["rowKeys"]
    if _disabled(rule_param):
        return None
    is_filter = isinstance(rule_param, str) and is_condition_expression(rule_param)
    error = _message(context, "unique", "Values must be unique.")
    if isinstance(value, (list, dict)):
        entries = (
            list(value.items()) if isinstance(value, dict) else list(enumerate(value))
        )
        if is_filter:
            # Only elements whose item context passes the condition participate.
            values_to_check: list[JsonValue] = []
            for key, element in entries:
                item_path = [*path_segments, str(key)]
                if not _item_passes(
                    rule_param, item_path, [*row_keys, len(path_segments)], all_data
                ):
                    continue
                if not is_empty_value(element):
                    values_to_check.append(element)
        elif isinstance(rule_param, str):
            values_to_check = _extract_field_values(
                [element for _key, element in entries], rule_param
            )
        else:
            values_to_check = [
                element for _key, element in entries if not is_empty_value(element)
            ]
        if not values_to_check:
            return None
        if not _all_unique(values_to_check):
            return error
        return None
    # Item-level validation: a scalar field inside a repeated group.
    if len(path_segments) < 2:
        return None
    field_name = path_segments[-1]
    item_key = path_segments[-2]
    container_path = path_segments[:-2]
    container = get_value_by_path(all_data, container_path)
    if isinstance(container, list):
        if not _DIGITS_ONLY.match(item_key):
            return None
    elif not isinstance(container, dict):
        return None
    if is_empty_value(value):
        return None
    if is_filter and not _item_passes(rule_param, path_segments, row_keys, all_data):
        return None
    # The rows of this collection field are walked once per validation: the filter is
    # evaluated once per row and each row whose value an earlier row holds is recorded.
    cache_key = "\0".join(
        [*container_path, field_name, rule_param if is_filter else ""]
    )
    duplicates = context["run"].unique_duplicates.get(cache_key)
    if duplicates is None:
        duplicates = _row_duplicates(
            container,
            container_path,
            field_name,
            rule_param if is_filter else None,
            row_keys,
            all_data,
        )
        context["run"].unique_duplicates[cache_key] = duplicates
    return error if item_key in duplicates else None


def _row_duplicates(
    container: list[JsonValue] | dict[str, JsonValue],
    container_path: list[str],
    field_name: str,
    filter_condition: str | None,
    row_keys: list[int],
    all_data: JsonValue,
) -> set[str]:
    """The row keys whose `field_name` value an earlier row already holds."""
    duplicates: set[str] = set()
    seen = set()
    entries = (
        [(str(index), item) for index, item in enumerate(container)]
        if isinstance(container, list)
        else list(container.items())
    )
    for key, item in entries:
        if not isinstance(item, dict):
            continue
        item_value = item.get(field_name)
        if is_empty_value(item_value):
            continue
        if filter_condition is not None and not _item_passes(
            filter_condition, [*container_path, key, field_name], row_keys, all_data
        ):
            continue
        item_key = _canonical_key(item_value)
        if item_key in seen:
            duplicates.add(key)
        else:
            seen.add(item_key)
    return duplicates


def parse_accept_param(param: JsonValue) -> list[str]:
    """The allowed MIME types of an accept parameter."""
    accept_list = []
    if isinstance(param, str):
        for part in param.split(","):
            part = trim(part).lower()
            if part.startswith("."):
                mimes = _EXTENSION_TO_MIME.get(part[1:])
                if mimes:
                    accept_list.extend(mimes)
                else:
                    accept_list.append(part)
            elif "/" in part:
                accept_list.append(part)
    elif isinstance(param, list):
        for item in param:
            accept_list.extend(parse_accept_param(item))
    return accept_list


def matches_mime_type(mime_type: str, accept_list: list[str]) -> bool:
    """Whether a MIME type matches the accept list, wildcards included."""
    normalized = mime_type.lower()
    for accept in accept_list:
        if accept == "*/*":
            return True
        if accept.endswith("/*"):
            if normalized.startswith(accept[:-1]):
                return True
        elif accept.startswith("."):
            continue
        elif normalized == accept:
            return True
    return False


def matches_extension(filename: str, accept_list: list[str]) -> bool:
    """Whether a filename's extension matches the accept list.

    A filename carries no MIME header, so the extension maps to its MIME types
    and those match MIME entries; direct extension entries match as well.
    """
    parts = filename.lower().split(".")
    if len(parts) < 2:
        return False
    extension = parts[-1]
    if extension == "":
        return False
    for accept in accept_list:
        if accept.startswith(".") and accept[1:] == extension:
            return True
    inferred = _EXTENSION_TO_MIME.get(extension)
    if inferred:
        for mime in inferred:
            if matches_mime_type(mime, accept_list):
                return True
    return False


def _rule_accept(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if rule_param is None or rule_param is False:
        return None
    if is_empty_value(value):
        return None
    accept_list = parse_accept_param(rule_param)
    if not accept_list:
        return None
    if isinstance(value, str):
        if "/" in value:
            if not matches_mime_type(value, accept_list):
                message: str = _message(
                    context, "accept", "Please upload a file with a valid format."
                )
                return message
        elif not matches_extension(value, accept_list):
            message = _message(
                context, "accept", "Please upload a file with a valid format."
            )
            return message
        return None
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                mime = item.get("type") or item.get("mimeType") or ""
                name = item.get("name") or item.get("filename") or ""
                valid = (mime and matches_mime_type(mime, accept_list)) or (
                    name and matches_extension(name, accept_list)
                )
                if not valid:
                    message = _message(
                        context, "accept", "Please upload files with valid formats."
                    )
                    return message
        return None
    if isinstance(value, dict):
        mime = value.get("type") or value.get("mimeType") or ""
        name = value.get("name") or value.get("filename") or ""
        valid = (mime and matches_mime_type(mime, accept_list)) or (
            name and matches_extension(name, accept_list)
        )
        if not valid:
            message = _message(
                context, "accept", "Please upload a file with a valid format."
            )
            return message
        return None
    return None


def _rule_condition_tree(context: RuleContext) -> str | None:
    value, rule_param = context["value"], context["ruleParam"]
    if not condition_tree.is_parameter(rule_param) or is_empty_value(value):
        return None
    if condition_tree.is_condition_tree(value, rule_param == "judge"):
        return None
    message: str = _message(context, "conditionTree", "Please enter a valid condition.")
    return message


_RULES = {
    "required": _rule_required,
    "email": _rule_email,
    "minlength": _rule_minlength,
    "maxlength": _rule_maxlength,
    "min": _rule_min,
    "max": _rule_max,
    "match": _rule_match,
    # 'pattern' is an alias of 'match' (the same implementation).
    "pattern": _rule_match,
    "unique": _rule_unique,
    "in": _rule_in,
    "range": _rule_range,
    "rangelength": _rule_rangelength,
    "number": _rule_number,
    "digits": _rule_digits,
    "equalTo": _rule_equal_to,
    "containedIn": _rule_contained_in,
    "typeFrom": _rule_type_from,
    "minFrom": _rule_min_from,
    "maxFrom": _rule_max_from,
    "notEqual": _rule_not_equal,
    "date": _rule_date,
    "dateISO": _rule_date_iso,
    "enddate": _rule_enddate,
    "url": _rule_url,
    "accept": _rule_accept,
    "mincount": _rule_mincount,
    "maxcount": _rule_maxcount,
    "step": _rule_step,
    "conditionTree": _rule_condition_tree,
    "reference": _rule_reference,
}

_CHECKED_RULES = {
    "minlength",
    "maxlength",
    "rangelength",
    "number",
    "digits",
    "min",
    "max",
    "range",
    "step",
    "mincount",
    "maxcount",
    "in",
    "match",
    "pattern",
    "equalTo",
    "containedIn",
    "typeFrom",
    "minFrom",
    "maxFrom",
    "enddate",
    "notEqual",
    "unique",
    "conditionTree",
    "reference",
}


def get_rule(name: str) -> Rule | None:
    """The validation function of a registered rule name, or None."""
    return _RULES.get(name)


def get_rule_names() -> list[str]:
    """Every registered rule name, in registration order."""
    return list(_RULES)


def rule_parameter_failure(rule_name: str, param: object) -> tuple[str, str] | None:
    """The failure an effective (resolved) parameter of a rule causes, or None.

    `False` and `None` disable a rule and are never failures.
    """
    if param is False or param is None or rule_name not in _CHECKED_RULES:
        return None

    def invalid(message: str) -> tuple[str, str]:
        return "INVALID_RULE_PARAMETER", message

    if rule_name in ("minlength", "maxlength", "mincount", "maxcount"):
        return (
            None
            if is_length_limit(param)
            else invalid(
                f"Invalid {rule_name} parameter: expected an integer from 0 to 9007199254740991"
            )
        )
    if rule_name == "rangelength":
        return (
            None
            if is_length_range(param)
            else invalid(
                "Invalid rangelength parameter: expected [minimum, maximum] integers "
                "with minimum not above maximum"
            )
        )
    if rule_name in ("number", "digits"):
        return (
            None
            if param is True
            else invalid(f"Invalid {rule_name} parameter: expected true or false")
        )
    if rule_name in ("min", "max"):
        return (
            None
            if is_finite_number(param)
            else invalid(f"Invalid {rule_name} parameter: expected a finite number")
        )
    if rule_name == "range":
        return (
            None
            if is_number_range(param)
            else invalid(
                "Invalid range parameter: expected [minimum, maximum] finite numbers "
                "with minimum not above maximum"
            )
        )
    if rule_name == "step":
        return (
            None
            if is_step(param)
            else invalid("Invalid step parameter: expected a finite number above 0")
        )
    if rule_name == "in":
        members = read_members(param)
        return invalid(members) if isinstance(members, str) else None
    if rule_name in (
        "equalTo",
        "containedIn",
        "typeFrom",
        "minFrom",
        "maxFrom",
        "enddate",
    ):
        return (
            None
            if isinstance(param, str)
            else invalid(
                f"Invalid {rule_name} parameter: expected a field reference string"
            )
        )
    if rule_name == "notEqual":
        return (
            None
            if isinstance(param, (str, bool)) or is_finite_number(param)
            else invalid(
                "Invalid notEqual parameter: expected a string, number or boolean"
            )
        )
    if rule_name == "conditionTree":
        return (
            None
            if condition_tree.is_parameter(param)
            else invalid(condition_tree.PARAMETER_ERROR)
        )
    if rule_name == "reference":
        return None if isinstance(param, str) else invalid(REFERENCE_PARAMETER_MESSAGE)
    if rule_name == "unique":
        return (
            None
            if isinstance(param, str) or param is True
            else invalid("Invalid unique parameter: expected true, false or a string")
        )
    if not isinstance(param, str):
        return invalid(f"Invalid {rule_name} parameter: expected a pattern string")
    try:
        # Compiled once here, when the parameter is checked.
        compile_pattern(param)
        return None
    except PatternSyntaxError as error:
        return (
            "INVALID_RULE_PATTERN",
            f"Invalid {rule_name} pattern: {error.reason} at {error.offset}",
        )
