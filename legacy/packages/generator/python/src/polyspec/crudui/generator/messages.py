"""Runtime interface text shared by every renderer and implementation."""

from .errors import FormError
from .interface_messages import FORM

__all__ = ["for_language", "count"]


def for_language(language: object) -> dict[str, str]:
    """The interface text of a supported language (ko, en, ja or zh)."""
    if not isinstance(language, str):
        raise FormError("INVALID_FORM_INPUT", "Language must be a string")
    if language not in FORM:
        raise FormError("INVALID_FORM_INPUT", f"Unsupported language: {language}")
    return FORM[language]


def count(template: str, number: int) -> str:
    """Replace the first `{count}` in a counted message."""
    return template.replace("{count}", str(number), 1)
