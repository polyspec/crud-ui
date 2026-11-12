"""Input text and value limit checks of the generator operations.

The specification and the files an operation reads are checked first, then its
named arguments, then the named options, in code point order of their names
(docs/spec/input-text.md). A failure is `FormError` with `INVALID_FORM_INPUT`.
"""

from collections.abc import Mapping, Sequence
from typing import Any

from polyspec.crudui.validator.jsvalue import JsonValue
from polyspec.crudui.validator.text import input_failure as _validator_input_failure
from polyspec.crudui.validator.text import option_entries as _option_entries
from polyspec.crudui.validator.text import (
    specification_failure as _validator_specification_failure,
)

from .errors import FormError

__all__ = ["BIND", "DISPLAY", "inputs", "specification"]

# Options of a form binding or instance, in code point order of their names.
BIND = ("idPrefix", "keyPrefix", "language", "unsupported")

# Options of a list or detail model, in code point order of their names.
DISPLAY = ("basepath", "data", "language", "layout")


def specification(spec: JsonValue, options: Mapping[str, Any]) -> None:
    """Check a specification and the files an operation reads."""
    failure = _validator_specification_failure(spec, options.get("files"))
    if failure is not None:
        raise FormError("INVALID_FORM_INPUT", failure)


def inputs(
    entries: Sequence[tuple[str, JsonValue]],
    options: Mapping[str, Any] | None = None,
    names: Sequence[str] = (),
) -> None:
    """Check named arguments in order, then the named options."""
    failure = _validator_input_failure(
        [*entries, *_option_entries(options or {}, list(names))]
    )
    if failure is not None:
        raise FormError("INVALID_FORM_INPUT", failure)
