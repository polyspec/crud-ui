"""JavaScript value semantics the shared contracts are stated in.

The validation contracts write numbers as ECMAScript writes the double they
denote, compare strings in code point order and order the members of a
specification object as a JavaScript object holds them: member names that are
array indexes come first in ascending numeric order, then every other name in
insertion order. This module writes and compares values exactly that way.
"""

import math
import re
from typing import TypeAlias, Union

__all__ = [
    "compare_code_points",
    "is_array_index",
    "is_number",
    "is_scalar_text",
    "js_number",
    "js_parse_float",
    "js_string",
    "number_text",
    "ordered_members",
    "ordered_value",
]

# A value of the JSON data model: null, boolean, number, string, array or object.
JsonValue: TypeAlias = Union[
    None, bool, int, float, str, list["JsonValue"], dict[str, "JsonValue"]
]

_SURROGATE = re.compile("[\ud800-\udfff]")

# Largest integer magnitude whose decimal text is its double's text.
_EXACT_INTEGER = 9007199254740992

_ARRAY_INDEX = re.compile(r"^(?:0|[1-9][0-9]{0,9})$")


def is_scalar_text(text: object) -> bool:
    """Whether `text` has no unpaired surrogate code unit."""
    if not isinstance(text, str):
        return False
    if not _SURROGATE.search(text):
        return True
    index = 0
    while index < len(text):
        unit = ord(text[index])
        if unit < 0xD800 or unit > 0xDFFF:
            index += 1
            continue
        if unit > 0xDBFF:
            return False
        following = ord(text[index + 1]) if index + 1 < len(text) else 0
        if not 0xDC00 <= following <= 0xDFFF:
            return False
        index += 2
    return True


def _rank(unit: int) -> int:
    """The order rank of one UTF-16 code unit: a surrogate ranks above U+FFFF."""
    if unit >= 0xE000:
        return unit - 0x800
    if unit >= 0xD800:
        return unit + 0x2000
    return unit


def _units(text: str) -> list[int]:
    """The UTF-16 code units of `text`."""
    units = []
    for character in text:
        point = ord(character)
        if point > 0xFFFF:
            point -= 0x10000
            units.append(0xD800 | (point >> 10))
            units.append(0xDC00 | (point & 0x3FF))
        else:
            units.append(point)
    return units


def compare_code_points(left: str, right: str) -> int:
    """Compare two strings in code point order, a surrogate pair above U+FFFF."""
    a = _units(left)
    b = _units(right)
    length = min(len(a), len(b))
    for index in range(length):
        if a[index] == b[index]:
            continue
        return _rank(a[index]) - _rank(b[index])
    return len(a) - len(b)


def is_array_index(name: object) -> bool:
    """Whether a member name is an array index: a canonical decimal integer 0..4294967294."""
    return (
        isinstance(name, str)
        and _ARRAY_INDEX.match(name) is not None
        and int(name) <= 4294967294
    )


def ordered_members(members: dict[str, JsonValue]) -> dict[str, JsonValue]:
    """A copy of one member map in specification member order, values untouched."""
    indexes = {name: value for name, value in members.items() if is_array_index(name)}
    names = {name: value for name, value in members.items() if not is_array_index(name)}
    out = {}
    for name in sorted(indexes, key=int):
        out[name] = indexes[name]
    out.update(names)
    return out


def ordered_value(value: JsonValue) -> JsonValue:
    """A copy of a value with every object in specification member order."""
    if isinstance(value, dict):
        return {
            name: ordered_value(child) for name, child in ordered_members(value).items()
        }
    if isinstance(value, list):
        return [ordered_value(child) for child in value]
    return value


def is_number(value: object) -> bool:
    """Whether a value is a JSON number: an int (not a boolean) or a finite float."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return isinstance(value, float) and math.isfinite(value)


def number_text(number: int | float) -> str:
    """Write a finite number as ECMAScript `Number.prototype.toString` does.

    The fewest significant digits that read back as the same double (the closest
    such digits when several exist), plain notation for magnitudes from 10^-6 up
    to below 10^21, exponent notation otherwise, and `0` for both zeros.
    """
    if isinstance(number, int) and not isinstance(number, bool):
        if -_EXACT_INTEGER <= number <= _EXACT_INTEGER:
            return str(number)
        number = float(number)
    if not math.isfinite(number):
        raise ValueError("Only finite numbers have canonical text")
    if number == 0.0:
        return "0"
    sign = "-" if number < 0 else ""
    digits, exponent = _shortest(abs(number))
    return sign + _layout(digits, exponent + 1)


def _rounded(number: float, precision: int) -> tuple[str, int]:
    """Correctly rounded significant digits at a precision: digits and the exponent of the first."""
    text = f"{number:.{precision - 1}e}"
    mantissa, _, power = text.partition("e")
    whole, _, fraction = mantissa.partition(".")
    return whole + fraction, int(power)


def _read(digits: str, exponent: int) -> float:
    """The double a digit string reads as."""
    return float(f"{digits[0]}.{digits[1:]}e{exponent}")


def _step(digits: str, exponent: int, direction: int) -> tuple[str, int]:
    """The adjacent decimal with the same number of significant digits."""
    width = len(digits)
    value = list(digits)
    index = width - 1
    if direction > 0:
        while index >= 0 and value[index] == "9":
            value[index] = "0"
            index -= 1
        if index < 0:
            return "1" + "".join(value[: width - 1]), exponent + 1
        value[index] = str(int(value[index]) + 1)
        return "".join(value), exponent
    while index >= 0 and value[index] == "0":
        value[index] = "9"
        index -= 1
    if index < 0:
        return "1" + "".join(value[: width - 1]), exponent - 1
    value[index] = str(int(value[index]) - 1)
    if index == 0 and value[0] == "0":
        return "".join(value[1:]) or "0", exponent
    return "".join(value), exponent


def _stripped(digits: str, exponent: int) -> tuple[str, int]:
    """Digits without trailing zeros, keeping at least one."""
    while len(digits) > 1 and digits.endswith("0"):
        digits = digits[:-1]
    return digits, exponent


def _shortest(number: float) -> tuple[str, int]:
    """Shortest round-trip significant digits of a positive finite double."""
    for precision in range(1, 18):
        digits, exponent = _rounded(number, precision)
        if _read(digits, exponent) == number:
            return _stripped(digits, exponent)
        # The correctly rounded digits miss, but the decimal on the other side of
        # the number may still read back when the rounding interval is asymmetric.
        other = _step(digits, exponent, -1 if _read(digits, exponent) > number else 1)
        if _read(other[0], other[1]) == number:
            return _stripped(other[0], other[1])
    raise AssertionError(f"No 17-digit decimal reads back as {number:.17e}")


def _layout(digits: str, point: int) -> str:
    """Lay digits out around the decimal point the ECMAScript way."""
    count = len(digits)
    if count <= point <= 21:
        return digits + "0" * (point - count)
    if 0 < point <= 21:
        return f"{digits[:point]}.{digits[point:]}"
    if -6 < point <= 0:
        return f"0.{'0' * -point}{digits}"
    power = point - 1
    exponent = f"e{'-' if power < 0 else '+'}{abs(power)}"
    return (
        f"{digits}{exponent}" if count == 1 else f"{digits[0]}.{digits[1:]}{exponent}"
    )


def js_string(value: JsonValue) -> str:
    """Convert a value to text as JavaScript `String()` does."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return canonical_number(value)
    if isinstance(value, list):
        return ",".join("" if item is None else js_string(item) for item in value)
    return "[object Object]"


def canonical_number(value: int | float) -> str:
    """The canonical text of a number: integers within the exact range plainly."""
    return number_text(value)


def js_parse_float(text: str) -> float:
    """JavaScript `parseFloat`: the leading numeric prefix, or NaN."""
    match = re.match(
        r"\s*[+-]?(?:Infinity|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)",
        text,
    )
    if match is None:
        return math.nan
    found = match.group(0).strip()
    if found.endswith(("+", "-")):
        found = found[:-1]
    if "Infinity" in found:
        return -math.inf if found.startswith("-") else math.inf
    try:
        return float(found)
    except ValueError:
        return math.nan


_NUMBER_DECIMAL = re.compile(
    r"[+-]?(?:Infinity|(?:(?:\d+|\.\d+|\d+\.\d*)(?:[eE][+-]?\d+)?))$"
)
_NUMBER_RADIX = re.compile(r"0[xX][0-9a-fA-F]+$|0[bB][01]+$|0[oO][0-7]+$")
# The white space `String.prototype.trim` and `Number` accept: the ECMAScript
# white space and line terminators, including the byte order mark.
_JS_SPACE = (
    " \t\n\v\f\r\u00a0\ufeff\u1680"
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
    "\u2028\u2029\u202f\u205f\u3000"
)


def js_number(value: JsonValue) -> float:
    """JavaScript `Number()`: the number a value converts to, or NaN."""
    if value is None:
        return 0.0
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        try:
            return float(value)
        except OverflowError:
            return math.inf if value > 0 else -math.inf
    if isinstance(value, str):
        text = value.strip(_JS_SPACE)
        if text == "":
            return 0.0
        if _NUMBER_RADIX.match(text):
            return float(int(text, 0))
        if not _NUMBER_DECIMAL.match(text):
            return math.nan
        return js_parse_float(text)
    if isinstance(value, list):
        if len(value) == 0:
            return 0.0
        if len(value) == 1:
            return js_number(value[0])
        return math.nan
    return math.nan
