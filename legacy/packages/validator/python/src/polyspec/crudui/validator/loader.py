"""The source of composition files that `$ref` reads.

A loader names each file by a key (`normalize`) and returns its document
(`load`). The composition engine calls it for every `$ref`, and the text checks
call it for every document the operation reads.
"""

from typing import Protocol

from .jsvalue import JsonValue

__all__ = ["DocumentLoader"]


class DocumentLoader(Protocol):
    """A file source: `normalize` resolves a path to the key of a file, `load` returns the document of that key."""

    def normalize(self, path: str, basepath: str) -> str:
        """The key of the file that `path` names when it is read from `basepath`."""
        ...

    def load(self, key: str) -> dict[str, JsonValue]:
        """The object document of `key`; a missing key is a load failure."""
        ...
