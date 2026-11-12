"""Decimal display of binary64 values.

`number_string` writes a number with the decimal and exponent thresholds of
the form model; `fixed` truncates the precision and rounds the exact binary
value, with ties increasing the magnitude.
"""

import math
import struct

from .errors import FormError

__all__ = ["fixed", "number_string"]


def number_string(number: int | float) -> str:
    """A number with decimal and exponent thresholds matching the form model.

    A whole float writes without a decimal part, as the shortest decimal text
    of the double writes it.
    """
    if isinstance(number, bool):
        raise TypeError("A boolean is not a number")
    if number == 0:
        return "0"
    raw = repr(number).lower() if isinstance(number, float) else str(number)
    if "e" not in raw:
        return raw[:-2] if raw.endswith(".0") else raw
    mantissa, _, exponent_text = raw.partition("e")
    exponent = int(exponent_text)
    negative = mantissa.startswith("-")
    mantissa = mantissa.lstrip("-")
    whole, _, fraction = mantissa.partition(".")
    digits = (whole + fraction).rstrip("0")
    position = len(whole) + exponent
    sign = "-" if negative else ""
    if 1.0e-6 <= abs(number) < 1.0e21:
        if position <= 0:
            return sign + "0." + "0" * -position + digits
        if position >= len(digits):
            return sign + digits + "0" * (position - len(digits))
        return sign + digits[:position] + "." + digits[position:]
    exponent = position - 1
    tail = "." + digits[1:] if len(digits) > 1 else ""
    return f"{sign}{digits[0]}{tail}e{'+' if exponent >= 0 else ''}{exponent}"


def fixed(number: float, decimals: float) -> str:
    """The exact binary value rounded to `decimals` places, ties increasing magnitude."""
    if decimals < 0:
        decimals = math.ceil(decimals)
    else:
        decimals = math.floor(decimals)
    if not math.isfinite(decimals) or decimals < 0 or decimals > 100:
        raise FormError(
            "INVALID_FORM_INPUT", "Number decimals must be between 0 and 100"
        )
    decimals = int(decimals)
    if abs(number) >= 1.0e21:
        return number_string(number)
    negative = number < 0
    bits = struct.unpack(">Q", struct.pack(">d", abs(number)))[0]
    exponent_bits = (bits >> 52) & 0x7FF
    significand = bits & 0xFFFFFFFFFFFFF
    if exponent_bits != 0:
        significand |= 1 << 52
    exponent = (-1022 if exponent_bits == 0 else exponent_bits - 1023) - 52 + decimals
    digits = str(significand)
    for _ in range(decimals):
        digits = _multiply(digits, 5)
    if exponent >= 0:
        for _ in range(exponent):
            digits = _multiply(digits, 2)
    else:
        remainder = 0
        for _ in range(-exponent):
            digits, remainder = _divide_two(digits)
        if remainder == 1:
            digits = _increment(digits)
    if decimals > 0:
        digits = digits.rjust(decimals + 1, "0")
        digits = digits[:-decimals] + "." + digits[-decimals:]
    return ("-" if negative else "") + digits


def _multiply(digits: str, factor: int) -> str:
    out = ""
    carry = 0
    for character in reversed(digits):
        value = int(character) * factor + carry
        out = str(value % 10) + out
        carry = value // 10
    return (str(carry) if carry else "") + out


def _divide_two(digits: str) -> tuple[str, int]:
    out = ""
    remainder = 0
    for character in digits:
        value = remainder * 10 + int(character)
        out += str(value // 2)
        remainder = value % 2
    return out.lstrip("0") or "0", remainder


def _increment(digits: str) -> str:
    characters = list(digits)
    for index in range(len(characters) - 1, -1, -1):
        if characters[index] != "9":
            characters[index] = str(int(characters[index]) + 1)
            return "".join(characters)
        characters[index] = "0"
    return "1" + "".join(characters)
