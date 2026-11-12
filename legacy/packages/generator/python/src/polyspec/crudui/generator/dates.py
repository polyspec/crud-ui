"""Parse supported date strings for UTC control and list display.

Accepted inputs: a calendar date with an optional time and offset
(`YYYY-MM-DD`, `YYYY-MM-DDTHH:MM`, `YYYY-MM-DD HH:MM:SS+09:00`), and the RFC
2822 date forms with a weekday, a named month and a zone. The result is UTC at
whole-second precision; invalid and unsupported input is `None`.

The instant is seconds since 1970-01-01, so a year of the JavaScript `Date`
range outside the Python `datetime` range — year 0, a negative year or 10000
and beyond — still formats as JavaScript writes it.
"""

import re

__all__ = ["format_utc", "parse_utc", "parts_utc"]

_MONTHS = (
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
)
_WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
_ZONES = {
    "z": 0,
    "ut": 0,
    "gmt": 0,
    "est": -18000,
    "edt": -14400,
    "cst": -21600,
    "cdt": -18000,
    "mst": -25200,
    "mdt": -21600,
    "pst": -28800,
    "pdt": -25200,
}

_ISO = re.compile(
    r"\A([0-9]{4})-([0-9]{2})-([0-9]{2})"
    r"(?:[T ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})?)?\Z"
)
_RFC2822 = re.compile(
    r"\A(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),[ \t]+)?([0-9]{1,2})[ \t]+"
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ \t]+([0-9]{4})[ \t]+"
    r"([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?[ \t]+"
    r"([+-][0-9]{4}|UT|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\Z",
    re.IGNORECASE,
)


def parse_utc(value: str) -> int | None:
    """Seconds since 1970-01-01 at whole-second precision, or None for invalid input."""
    parts = _ISO.match(value)
    if parts is not None:
        offset = _offset(parts.group(7) or "Z")
        if offset is None:
            return None
        return _create(
            int(parts.group(1)),
            int(parts.group(2)),
            int(parts.group(3)),
            int(parts.group(4) or 0),
            int(parts.group(5) or 0),
            int(parts.group(6) or 0),
            offset,
        )
    parts = _RFC2822.match(value)
    if parts is not None:
        offset = _offset(parts.group(8))
        month = _MONTHS.index(parts.group(3).lower()) + 1
        if offset is None:
            return None
        return _create(
            int(parts.group(4)),
            month,
            int(parts.group(2)),
            int(parts.group(5)),
            int(parts.group(6)),
            int(parts.group(7) or 0),
            offset,
            parts.group(1),
        )
    return None


def parts_utc(seconds: int) -> tuple[int, int, int, int, int, int]:
    """The civil date and time of one instant: (year, month, day, hour, minute, second)."""
    days, rest = divmod(seconds, 86400)
    year, month, day = _civil_from_days(days)
    hour, rest = divmod(rest, 3600)
    minute, second = divmod(rest, 60)
    return year, month, day, hour, minute, second


def format_utc(seconds: int, with_time: bool) -> str:
    """The instant as `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`, a negative year signed."""
    year, month, day, hour, minute, second = parts_utc(seconds)
    year_text = f"{year:04d}" if year >= 0 else f"-{-year:04d}"
    date_text = f"{year_text}-{month:02d}-{day:02d}"
    if not with_time:
        return date_text
    return f"{date_text}T{hour:02d}:{minute:02d}:{second:02d}"


def _offset(zone: str) -> int | None:
    named = _ZONES.get(zone.lower())
    if named is not None:
        return named
    numeric = zone.replace(":", "")
    hours = int(numeric[1:3])
    minutes = int(numeric[3:5])
    if hours > 23 or minutes > 59:
        return None
    return (-1 if numeric[0] == "-" else 1) * (hours * 3600 + minutes * 60)


def _create(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int,
    second: int,
    offset: int,
    weekday: str | None = None,
) -> int | None:
    if (
        hour > 23
        or minute > 59
        or second > 59
        or month < 1
        or month > 12
        or day < 1
        or day > 31
    ):
        return None
    days = _days_from_civil(year, month, day)
    if _civil_from_days(days) != (year, month, day):
        return None
    if weekday is not None and weekday.lower() != _WEEKDAYS[(days + 3) % 7].lower():
        return None
    return days * 86400 + hour * 3600 + minute * 60 + second - offset


def _trunc_div(value: int, divisor: int) -> int:
    """The C integer division of the civil-date arithmetic: toward zero."""
    quotient = value // divisor
    if quotient < 0 and quotient * divisor != value:
        quotient += 1
    return quotient


def _days_from_civil(year: int, month: int, day: int) -> int:
    """Days since 1970-01-01 of one proleptic Gregorian date."""
    year -= month <= 2
    era = _trunc_div(year if year >= 0 else year - 399, 400)
    year_of_era = year - era * 400
    day_of_year = (153 * (month + (-3 if month > 2 else 9)) + 2) // 5 + day - 1
    day_of_era = year_of_era * 365 + year_of_era // 4 - year_of_era // 100 + day_of_year
    return era * 146097 + day_of_era - 719468


def _civil_from_days(days: int) -> tuple[int, int, int]:
    """The proleptic Gregorian date of one count of days since 1970-01-01."""
    days += 719468
    era = _trunc_div(days if days >= 0 else days - 146096, 146097)
    day_of_era = days - era * 146097
    year_of_era = (
        day_of_era - day_of_era // 1460 + day_of_era // 36524 - day_of_era // 146096
    ) // 365
    year = year_of_era + era * 400
    day_of_year = day_of_era - (
        365 * year_of_era + year_of_era // 4 - year_of_era // 100
    )
    month_pointer = (5 * day_of_year + 2) // 153
    day = day_of_year - (153 * month_pointer + 2) // 5 + 1
    month = month_pointer + (3 if month_pointer < 10 else -9)
    return year + (month <= 2), month, day
