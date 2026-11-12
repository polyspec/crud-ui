"""Value definitions shared by every rule.

A value's canonical text is the value itself for a string, `1`/`0` for a
boolean and the ECMAScript text of the double a number denotes. Whitespace is
exactly the code points with the Unicode `White_Space` property. Members come
from a list, a choice list, a comma-separated string or a map, and every member
is a string, a number or a boolean.
"""

import math
import re


from .jsvalue import JsonValue, number_text
from .unicode_data import WHITE_SPACE

__all__ = [
    "MAX_LENGTH_LIMIT",
    "MEMBERSHIP_ERRORS",
    "canonical_text",
    "code_point_length",
    "count_of",
    "format_message",
    "is_digits",
    "is_empty_value",
    "is_finite_number",
    "is_length_limit",
    "is_length_range",
    "is_member",
    "is_multiple",
    "is_number_range",
    "is_step",
    "is_whitespace",
    "numeric_value",
    "numeric_value_as_written",
    "read_members",
    "trim",
    "whitespace_ranges",
]

MAX_LENGTH_LIMIT = 9007199254740991

MEMBERSHIP_ERRORS = {
    "shape": "Invalid in parameter: expected a list, a comma-separated string or a map",
    "type": "Invalid in parameter: members must be strings, numbers or booleans",
    "empty": "Invalid in parameter: members must not be empty",
    "pairs": "Invalid in parameter: expected value and label pairs with distinct string or number values",
}


def whitespace_ranges() -> list[tuple[int, int]]:
    """The White_Space code points as inclusive pairs."""
    return [
        (WHITE_SPACE[index], WHITE_SPACE[index + 1])
        for index in range(0, len(WHITE_SPACE), 2)
    ]


_WHITESPACE_PAIRS = whitespace_ranges()


def is_whitespace(code_point: int) -> bool:
    """Whether a code point has the Unicode `White_Space` property."""
    return any(first <= code_point <= last for first, last in _WHITESPACE_PAIRS)


def trim(text: str) -> str:
    """Remove leading and trailing whitespace and nothing else."""
    start = 0
    end = len(text)
    while start < end and is_whitespace(ord(text[start])):
        start += 1
    while end > start and is_whitespace(ord(text[end - 1])):
        end -= 1
    return text[start:end]


def is_empty_value(value: object) -> bool:
    """Whether a value is empty.

    A missing value, `None`, a string that is empty after trimming, an empty
    list and an empty object are empty. `0` and `False` are supplied values.
    """
    if value is None:
        return True
    if isinstance(value, str):
        return trim(value) == ""
    if isinstance(value, list):
        return len(value) == 0
    if isinstance(value, dict):
        return len(value) == 0
    return False


def canonical_text(value: JsonValue) -> str | None:
    """The canonical text of a scalar, or None for any other value."""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return number_text(value)
    if isinstance(value, float) and math.isfinite(value):
        return number_text(value)
    return None


def code_point_length(value: JsonValue) -> int | None:
    """The code-point length of a value's canonical text, or None when it has none."""
    text = canonical_text(value)
    if text is None:
        return None
    return len(text)


def is_length_limit(limit: object) -> bool:
    """Whether a parameter is a length limit: an integer from 0 to 2^53 - 1."""
    if isinstance(limit, bool) or not isinstance(limit, (int, float)):
        return False
    if isinstance(limit, float):
        if not math.isfinite(limit) or not limit.is_integer():
            return False
        return 0 <= int(limit) <= MAX_LENGTH_LIMIT
    return 0 <= limit <= MAX_LENGTH_LIMIT


def is_length_range(value: object) -> bool:
    """Whether a parameter is a `rangelength` pair with minimum not above maximum."""
    if not isinstance(value, list) or len(value) != 2:
        return False
    first, last = value
    return (
        is_length_limit(first)
        and is_length_limit(last)
        and isinstance(first, (int, float))
        and isinstance(last, (int, float))
        and first <= last
    )


def is_finite_number(param: object) -> bool:
    """Whether a parameter is a finite number."""
    if isinstance(param, bool):
        return False
    if isinstance(param, int):
        return True
    return isinstance(param, float) and math.isfinite(param)


def is_number_range(value: object) -> bool:
    """Whether a parameter is a `range` pair of finite numbers with minimum not above maximum."""
    if not isinstance(value, list) or len(value) != 2:
        return False
    first, last = value
    return (
        is_finite_number(first)
        and is_finite_number(last)
        and isinstance(first, (int, float))
        and isinstance(last, (int, float))
        and first <= last
    )


def is_step(step: object) -> bool:
    """Whether a parameter is a `step`: a finite number above 0."""
    return is_finite_number(step) and isinstance(step, (int, float)) and step > 0


_NUMERIC_TEXT = re.compile(r"^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$")


def numeric_value_as_written(value: object) -> int | float | None:
    """The value of a finite number or of numeric text as written (without trimming)."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if not isinstance(value, str):
        return None
    if _NUMERIC_TEXT.match(value) is None:
        return None
    try:
        number = float(value)
    except ValueError, OverflowError:
        return None
    return number if math.isfinite(number) else None


def numeric_value(value: JsonValue) -> int | float | None:
    """The value of a numeric value (the nearest double), or None when it is not numeric."""
    if isinstance(value, str):
        return numeric_value_as_written(trim(value))
    return numeric_value_as_written(value)


def _decimal(text: str) -> tuple[int, int]:
    """A nonnegative decimal `significand x 10^exponent` read from a canonical text."""
    mantissa, _, power = text.partition("e")
    whole, _, fraction = mantissa.partition(".")
    if power:
        exponent = int(power) - len(fraction)
    else:
        exponent = -len(fraction)
    return int(whole + fraction), exponent


def is_multiple(value: int | float, step: int | float) -> bool:
    """Whether a finite number is an integer multiple of a positive finite step, counted from 0.

    Both are read exactly as the decimal numbers their canonical texts write,
    without a tolerance.
    """
    value_text = canonical_text(abs(value))
    step_text = canonical_text(step)
    assert (
        value_text is not None and step_text is not None
    )  # finite numbers always have canonical text
    value_digits, value_exponent = _decimal(value_text)
    step_digits, step_exponent = _decimal(step_text)
    base = min(value_exponent, step_exponent)
    scaled_value: int = value_digits * 10 ** (value_exponent - base)
    scaled_step: int = step_digits * 10 ** (step_exponent - base)
    return scaled_value % scaled_step == 0


def is_digits(value: JsonValue) -> bool:
    """Whether a value passes `digits`: a string (trimmed) or number whose text is ASCII digits."""
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        return False
    text = trim(value) if isinstance(value, str) else canonical_text(value)
    return text is not None and re.match(r"^[0-9]+$", text) is not None


def count_of(value: JsonValue) -> int:
    """The count of a value for `mincount` and `maxcount`."""
    if isinstance(value, list):
        return len(value)
    if value is None:
        return 0
    if isinstance(value, dict):
        return len(value)
    if isinstance(value, str) and trim(value) == "":
        return 0
    return 1


def format_message(template: str, *params: JsonValue) -> str:
    """A message with every `{i}` replaced by the canonical text of parameter i."""
    text = template
    for index, param in enumerate(params):
        replacement = canonical_text(param)
        if replacement is None:
            replacement = str(param)
        text = text.replace("{" + str(index) + "}", replacement)
    return text


def _is_member_type(item: object) -> bool:
    return (
        isinstance(item, str)
        or isinstance(item, bool)
        or (
            isinstance(item, (int, float))
            and not isinstance(item, bool)
            and is_finite_number(item)
        )
    )


def _choice_values(items: list[JsonValue]) -> list[JsonValue] | None:
    """The values of a choice list in written order, or None when it is not one."""
    values: list[JsonValue] = []
    seen: set[str | None] = set()

    def add(item: JsonValue) -> bool:
        if (
            not isinstance(item, dict)
            or len(item) != 2
            or "value" not in item
            or "label" not in item
        ):
            return False
        value = item["value"]
        if not isinstance(value, str) and not (
            is_finite_number(value) and not isinstance(value, bool)
        ):
            return False
        text = canonical_text(value)
        if text in seen:
            return False
        seen.add(text)
        values.append(value)
        return True

    for item in items:
        if isinstance(item, dict) and "choices" in item:
            choices = item["choices"]
            if (
                len(item) != 2
                or "label" not in item
                or not isinstance(choices, list)
                or len(choices) == 0
            ):
                return None
            if not all(add(choice) for choice in choices):
                return None
        elif not add(item):
            return None
    return values


def _is_choice_list(items: list[JsonValue]) -> bool:
    return any(
        isinstance(item, dict) and ("value" in item or "choices" in item)
        for item in items
    )


def read_members(param: object) -> list[JsonValue] | str:
    """The members of an `in` parameter, or the parameter error message it causes."""
    members = None
    if isinstance(param, list) and _is_choice_list(param):
        values = _choice_values(param)
        if values is None:
            return MEMBERSHIP_ERRORS["pairs"]
        members = values
    elif isinstance(param, list):
        members = list(param)
    elif isinstance(param, str):
        members = [trim(part) for part in param.split(",")]
    elif isinstance(param, dict):
        members = list(param)
    else:
        return MEMBERSHIP_ERRORS["shape"]
    for member in members:
        if not _is_member_type(member):
            return MEMBERSHIP_ERRORS["type"]
        if trim(canonical_text(member) or "") == "":
            return MEMBERSHIP_ERRORS["empty"]
    return members


def _matches_member(value: JsonValue, member: JsonValue) -> bool:
    text = canonical_text(value)
    if text is None:
        return False
    if text == canonical_text(member):
        return True
    left = numeric_value(value)
    # Members are read as written; the value is already trimmed.
    right = numeric_value_as_written(member)
    return left is not None and right is not None and left == right


def _is_scalar_member(value: JsonValue, members: list[JsonValue]) -> bool:
    if isinstance(value, str):
        value = trim(value)
    if not _is_member_type(value):
        return False
    return any(_matches_member(value, member) for member in members)


def is_member(value: JsonValue, members: list[JsonValue]) -> bool:
    """Whether a value is a member.

    An array value is a member when every element is: an empty element passes
    as an empty value does, and a non-empty array or object element fails.
    """
    if isinstance(value, list):
        return all(
            is_empty_value(element) or _is_scalar_member(element, members)
            for element in value
        )
    return _is_scalar_member(value, members)
