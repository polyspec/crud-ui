"""Input text and value limit checks.

Every string and object member name of a specification, a composition file and
caller data is a sequence of Unicode scalar values. A Python string that
contains an unpaired surrogate code unit is rejected before any other check of
the operation; it is never replaced and never passed on.

A value walked as the tree it denotes holds at most 1,000,000 nodes and nests
at most 512 levels, so a value that contains itself is always beyond the
limits. A container reached twice, through sharing, is walked at each place.
"""

from collections.abc import Iterable, Sequence
from typing import Literal, TypeAlias, Union, cast

from .compose_errors import ComposeLoadError
from .errors import FormInputError
from .jsvalue import JsonValue, is_scalar_text
from .loader import DocumentLoader

# The failure of a value: 'limit' when it is beyond the limits, {'text': path} for invalid text at a path, None when clean.
Failure: TypeAlias = Union[Literal["limit"], dict[str, list[str]], None]

__all__ = [
    "INVALID_TEXT_MESSAGE",
    "VALUE_LIMIT_MESSAGE",
    "NESTING_LIMIT",
    "NODE_LIMIT",
    "value_size",
    "check_input_text",
    "check_option_text",
    "check_specification_text",
    "checked_composition",
    "input_failure",
    "option_entries",
    "specification_failure",
    "value_failure",
]

INVALID_TEXT_MESSAGE = "Text must be Unicode scalar values"
VALUE_LIMIT_MESSAGE = "Recursive or excessively nested value"

NESTING_LIMIT = 512
NODE_LIMIT = 1_000_000


class _Walk:
    """One walk of a value as the tree it denotes."""

    def __init__(self) -> None:
        self.nodes = 0

    def admit(self, value: JsonValue, depth: int) -> bool:
        """Count a node at `depth`; False when it takes the value beyond its limits."""
        self.nodes += 1
        if self.nodes > NODE_LIMIT:
            return False
        if depth >= NESTING_LIMIT and isinstance(value, (list, dict)):
            return False
        return True


def _holds_failure(value: JsonValue, depth: int, walk: _Walk) -> bool:
    if not walk.admit(value, depth):
        return True
    if isinstance(value, str):
        return not is_scalar_text(value)
    if isinstance(value, list):
        return any(_holds_failure(item, depth + 1, walk) for item in value)
    if not isinstance(value, dict):
        return False
    return any(
        not is_scalar_text(key) or _holds_failure(value[key], depth + 1, walk)
        for key in value
    )


def _first_failure(
    value: JsonValue, path: list[str], depth: int, walk: _Walk
) -> Failure:
    """The first failure in walk order: items in index order, members in code point order."""
    if not walk.admit(value, depth):
        return "limit"
    if isinstance(value, str):
        return None if is_scalar_text(value) else {"text": path}
    if isinstance(value, list):
        for index, item in enumerate(value):
            found = _first_failure(item, [*path, str(index)], depth + 1, walk)
            if found is not None:
                return found
        return None
    if not isinstance(value, dict):
        return None
    # A member name is reported at its object; members follow in code point order of their names.
    if not all(is_scalar_text(key) for key in value):
        return {"text": path}
    for key in sorted(value, key=_member_order):
        found = _first_failure(value[key], [*path, key], depth + 1, walk)
        if found is not None:
            return found
    return None


def _member_order(key: str) -> tuple[int, list[int]]:
    """Sort key placing every member name after the last, in code point order."""
    return (1, [ord(character) for character in key])


def value_size(value: JsonValue) -> tuple[int, int]:
    """The levels of lists and dicts that `value` nests, itself the first, and the nodes it holds."""
    levels = nodes = 0
    pending: list[tuple[JsonValue, int]] = [(value, 1)]
    while pending:
        node, level = pending.pop()
        nodes += 1
        if isinstance(node, list):
            levels = max(levels, level)
            pending.extend((item, level + 1) for item in node)
        elif isinstance(node, dict):
            levels = max(levels, level)
            pending.extend((item, level + 1) for item in node.values())
    return levels, nodes


def value_failure(value: JsonValue) -> Failure:
    """The first failure in `value`, or None: invalid text at its path or a limit."""
    if _holds_failure(value, 0, _Walk()):
        return _first_failure(value, [], 0, _Walk())
    return None


def _limit_failure(name: str) -> FormInputError:
    return FormInputError(f"{VALUE_LIMIT_MESSAGE}: {name}")


def check_specification_text(spec: JsonValue, files: JsonValue = None) -> None:
    """Check a specification and the composition files the operation reads.

    Invalid text is the load failure `INVALID_TEXT`, located at its
    specification path or at the file name followed by its path in the file; an
    invalid file name is located at the empty path. A value beyond its limits is
    `INVALID_FORM_INPUT` naming `spec` or `files`.
    """
    for name, value in (("spec", spec), ("files", files)):
        failure = value_failure(value)
        if failure is None:
            continue
        if failure == "limit":
            raise _limit_failure(name)
        raise ComposeLoadError("INVALID_TEXT", INVALID_TEXT_MESSAGE, failure["text"])


def specification_failure(spec: JsonValue, files: JsonValue = None) -> str | None:
    """The failure message of a specification or its files, or None when clean.

    Invalid text raises the load failure `ComposeLoadError`, as a caller that
    loads a specification reports it; only a value beyond the limits returns a
    message, which names the value.
    """
    for name, value in (("spec", spec), ("files", files)):
        failure = value_failure(value)
        if failure is None:
            continue
        if failure == "limit":
            return f"{VALUE_LIMIT_MESSAGE}: {name}"
        raise ComposeLoadError("INVALID_TEXT", INVALID_TEXT_MESSAGE, failure["text"])
    return None


def input_failure(entries: Iterable[tuple[str, JsonValue]]) -> str | None:
    """The failure message of the first invalid text among named caller values.

    The message names the value and its path, or names a value beyond its
    limits; None when every value passes.
    """
    for name, value in entries:
        failure = value_failure(value)
        if failure is None:
            continue
        if failure == "limit":
            return f"{VALUE_LIMIT_MESSAGE}: {name}"
        return f"{INVALID_TEXT_MESSAGE}: {'.'.join([name, *failure['text']])}"
    return None


def option_entries(
    options: object, names: Sequence[str]
) -> list[tuple[str, JsonValue]]:
    """The present options named in `names`, given in code point order, as named values."""
    if not isinstance(options, dict):
        return []
    return [(f"options.{name}", options[name]) for name in names if name in options]


def check_input_text(inputs: Iterable[tuple[str, JsonValue]]) -> None:
    """Check named caller values in order.

    Invalid text is `INVALID_FORM_INPUT` naming the value and path, and a value
    beyond its limits is `INVALID_FORM_INPUT` naming the value.
    """
    for name, value in inputs:
        failure = value_failure(value)
        if failure is None:
            continue
        if failure == "limit":
            raise _limit_failure(name)
        raise FormInputError(
            f"{INVALID_TEXT_MESSAGE}: {'.'.join([name, *failure['text']])}"
        )


def check_option_text(options: object, names: Sequence[str]) -> None:
    """Check the present options named in `names`, given in code point order."""
    check_input_text(option_entries(options, names))


class _CheckedLoader:
    """A loader that checks each document it loads, located and named as a file."""

    def __init__(self, loader: DocumentLoader) -> None:
        self._loader = loader

    def normalize(self, path: str, basepath: str) -> str:
        return self._loader.normalize(path, basepath)

    def load(self, key: str) -> dict[str, JsonValue]:
        document = self._loader.load(key)
        failure = value_failure(document)
        if failure == "limit":
            raise _limit_failure("files")
        if failure is not None:
            raise ComposeLoadError(
                "INVALID_TEXT", INVALID_TEXT_MESSAGE, [key, *failure["text"]]
            )
        return document


def checked_composition(spec: JsonValue, options: object) -> DocumentLoader | None:
    """Check the specification side of an operation and return its loader.

    The specification is checked first, then the files it reads; a custom loader
    is wrapped so each document it loads is checked. The returned loader is the
    one the operation composes with, or None when the files are read directly.
    """
    loader = options.get("loader") if isinstance(options, dict) else None
    files = (
        None
        if loader
        else (options.get("files") if isinstance(options, dict) else None)
    )
    check_specification_text(spec, files)
    return _CheckedLoader(cast(DocumentLoader, loader)) if loader is not None else None
