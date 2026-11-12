"""The recursive forbidden meta-key scan.

The runtime half of the global rejection that the meta-schema's
`propertyNames` enforces statically. It walks the composed single
specification to arbitrary depth and rejects a forbidden key found at any
depth: an enumerated condition-only, composition-directive or magic-symbol
meta key, or any `x{key}` comment key that survived composition. A hit is a
load failure (`ComposeLoadError`, code `FORBIDDEN_META_KEY`) with the dotted
path to the offending key, never a validation result.
"""

from collections.abc import Sequence

from .compose_errors import ComposeLoadError
from .jsvalue import JsonValue

__all__ = ["FORBIDDEN_META_KEYS", "scan_forbidden_keys"]

FORBIDDEN_META_KEYS = (
    "display_switch",
    "display_target",
    "if",
    "when",
    "show_if",
    "_",
    "seqtokey",
    "__13hex__",
    "$after",
    "$before",
    "$merge",
    "$remove",
    "xclass",
    "xstyle",
)

_FORBIDDEN = frozenset(FORBIDDEN_META_KEYS)


def _is_x_comment_key(key: str) -> bool:
    """Whether a key is an `x{key}` comment key: `x` followed by at least one more character."""
    return len(key) > 1 and ord(key[0]) == 0x78


def _is_forbidden_key(key: str) -> bool:
    return key in _FORBIDDEN or _is_x_comment_key(key)


def scan_forbidden_keys(spec: JsonValue, root_path: Sequence[str] = ()) -> None:
    """Recursively scan a composed specification for a forbidden meta key at any depth.

    The scan descends into every object value and every array element; map keys
    are checked before descending into their values, so the reported path
    points at the shallowest offending key.
    """
    _walk(spec, list(root_path))


def _walk(node: JsonValue, path: list[str]) -> None:
    if isinstance(node, list):
        for index, item in enumerate(node):
            _walk(item, [*path, str(index)])
        return
    if not isinstance(node, dict):
        return
    for key in node:
        if _is_forbidden_key(key):
            at = [*path, key]
            raise ComposeLoadError(
                "FORBIDDEN_META_KEY",
                f'forbidden meta key "{key}" at {".".join(at)}',
                at,
            )
    for key in node:
        _walk(node[key], [*path, key])
