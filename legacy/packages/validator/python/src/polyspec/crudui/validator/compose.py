"""The composition engine.

The parser's first pass: expand `$ref` (base inheritance) then `$patch`
(add/remove/replace and deep-path set) into a single, composition-free
specification before the field layer, validation and rendering. Priority:
`$ref` lays down the base, `$patch` overlays it, and a sibling key declared
after `$ref` overrides the base while one declared before it is overridden.

Resolution supports a single `$ref` string and a list of them (each path
resolves in order and later entries override earlier ones), a plain path (the
file's `properties` layer is taken) and a path-specified `(file.a.b)` form
(the named keys are descended, then `properties`). Nested `$ref` inside a
resolved document is expanded recursively, and a `$ref` that returns to a file
on the current resolution chain is a cycle.
"""

import re
from collections.abc import Callable, Mapping
from copy import deepcopy
from typing import TypeGuard

from .compose_errors import ComposeLoadError
from .jsvalue import JsonValue, ordered_members
from .loader import DocumentLoader

__all__ = [
    "MemoryLoader",
    "apply_patch",
    "compose_properties",
    "compose_root",
    "compose_spec",
    "resolve_ref",
]

_PATH_SPEC = re.compile(r"^\((?P<path>.*?)\)\.(?P<keys>.*)$", re.DOTALL)


class MemoryLoader:
    """An in-memory loader over a fixed `{key: document}` map.

    `normalize` resolves a path against a basepath to the canonical key the map
    uses: an absolute path passes through, a relative one is prefixed. `load`
    raises `ComposeLoadError('REF_FILE_NOT_FOUND')` for an absent key and
    returns a detached copy of the document.
    """

    def __init__(self, files: Mapping[str, dict[str, JsonValue]]) -> None:
        self.files = dict(files)

    def normalize(self, path: str, basepath: str) -> str:
        if path.startswith("/"):
            return path
        if basepath:
            return basepath + "/" + path
        return path

    def load(self, key: str) -> dict[str, JsonValue]:
        document = self.files.get(key)
        if document is None:
            raise ComposeLoadError(
                "REF_FILE_NOT_FOUND", f"$ref file not found: {key}", [key]
            )
        # A detached copy so resolution never mutates the source file set.
        return deepcopy(document)


def _is_object(value: object) -> TypeGuard[dict[str, JsonValue]]:
    return value is not None and isinstance(value, dict)


def _merge(a: dict[str, JsonValue], b: dict[str, JsonValue]) -> dict[str, JsonValue]:
    """A shallow merge in specification member order: `b` overrides `a` on a clash."""
    return ordered_members({**a, **b})


def resolve_ref(
    value: JsonValue,
    basepath: str,
    loader: DocumentLoader,
    visiting: frozenset[str] = frozenset(),
) -> dict[str, JsonValue]:
    """Resolve a `$ref` value (a string or a list of them) to one flattened properties map."""
    paths = _normalize_ref_value(value)
    merged: dict[str, JsonValue] = {}
    for path in paths:
        resolved = _resolve_single_ref(path, basepath, loader, visiting)
        # A later entry overrides an earlier one on a key clash.
        merged.update(resolved)
    return merged


def _normalize_ref_value(value: JsonValue) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        paths: list[str] = []
        for path in value:
            if not isinstance(path, str):
                raise ComposeLoadError(
                    "REF_VALUE_TYPE",
                    f"$ref array entries must be strings, got {type(path).__name__}",
                )
            paths.append(path)
        return paths
    kind = "null" if value is None else type(value).__name__
    raise ComposeLoadError(
        "REF_VALUE_TYPE", f"$ref must be a string or an array of strings, got {kind}"
    )


def _resolve_single_ref(
    raw_path: str, basepath: str, loader: DocumentLoader, visiting: frozenset[str]
) -> dict[str, JsonValue]:
    original = raw_path
    path = raw_path
    detect_keys = ["properties"]
    # Path-specified form `(file.a.b)`.
    if path.startswith("("):
        match = _PATH_SPEC.match(path)
        if match is None:
            raise ComposeLoadError("REF_FORMAT_ERROR", f"{original} ref error")
        path = match.group("path")
        detect_keys = [*match.group("keys").split("."), "properties"]
    if path == "":
        raise ComposeLoadError("REF_FORMAT_ERROR", f"{original} ref error")
    key = loader.normalize(path, basepath)
    # Cycle detection: this file key is already on the current resolution chain.
    if key in visiting:
        raise ComposeLoadError(
            "REF_CYCLE",
            f"$ref cycle detected: {' -> '.join([*visiting, key])}",
            [*visiting, key],
        )
    document = ordered_members(
        loader.load(key)
    )  # raises REF_FILE_NOT_FOUND when absent
    # Descend the detect keys.
    node: JsonValue = document
    for detect_key in detect_keys:
        if _is_object(node) and detect_key in node:
            node = node[detect_key]
        else:
            raise ComposeLoadError(
                "REF_DETECT_KEY_NOT_FOUND",
                f"{detect_key} not found in {original}",
                [*visiting, key],
            )
    if not _is_object(node):
        # A properties layer must be a map; a scalar or list here is a malformed ref.
        raise ComposeLoadError(
            "REF_DETECT_KEY_NOT_FOUND",
            f"{original} resolved to a non-object properties layer",
            [*visiting, key],
        )
    # A deeper `$ref` back to this file is a cycle.
    return _expand_nested_refs(node, basepath, loader, visiting | {key})


def _layer_members(
    node: dict[str, JsonValue],
    resolve: Callable[[JsonValue], dict[str, JsonValue]],
) -> dict[str, JsonValue]:
    """Layer the members of a node in declaration order.

    A `$ref` lays its resolved base over the members declared before it, the
    members declared after it override that base, and a `$patch` overlays the
    result (a `$patch` of null is a shape error, as in the other runtimes).
    """
    base: dict[str, JsonValue] = {}
    own: dict[str, JsonValue] = {}
    patch: JsonValue = None
    saw_patch = False
    for key, value in node.items():
        if key == "$ref":
            # The ref merges onto whatever was declared before it.
            base = _merge(own, resolve(value))
            own = {}
        elif key == "$patch":
            saw_patch = True
            patch = value
        else:
            own[key] = value
    result = _merge(base, own)
    return apply_patch(result, patch) if saw_patch else result


def _expand_nested_refs(
    node: dict[str, JsonValue],
    basepath: str,
    loader: DocumentLoader,
    visiting: frozenset[str],
) -> dict[str, JsonValue]:
    """Expand `$ref` and merge `$patch` inside a resolved properties map."""
    if "$ref" not in node and "$patch" not in node:
        return node
    return _layer_members(
        node, lambda ref: resolve_ref(ref, basepath, loader, visiting)
    )


def _split_path(path: str) -> list[str]:
    if path == "":
        raise ComposeLoadError("PATCH_SHAPE", "$patch path must be non-empty")
    return path.split(".")


def _merge_value(existing: JsonValue, incoming: JsonValue) -> JsonValue:
    """Deep-merge leaf rule: two objects merge recursively, the incoming value otherwise wins."""
    if _is_object(existing) and _is_object(incoming):
        out = dict(existing)
        for key, value in incoming.items():
            out[key] = _merge_value(out.get(key), value)
        return out
    return incoming


def _set_deep_path(
    node: dict[str, JsonValue], segments: list[str], value: JsonValue
) -> dict[str, JsonValue]:
    """Set a value at a deep path, creating intermediate objects."""
    head, rest = segments[0], segments[1:]
    out = dict(node)
    if not rest:
        out[head] = _merge_value(out.get(head), value)
        return out
    child = out.get(head)
    if child is None and head not in out:
        out[head] = _set_deep_path({}, rest, value)
    elif _is_object(child):
        out[head] = _set_deep_path(child, rest, value)
    else:
        # An intermediate node that is a scalar or a list cannot be descended into.
        raise ComposeLoadError(
            "PATCH_PATH_CONFLICT", f"$patch cannot descend into non-object at '{head}'"
        )
    return out


def _remove_deep_path(
    node: dict[str, JsonValue], segments: list[str]
) -> dict[str, JsonValue]:
    """Delete a value at a deep path; a missing target is a load error."""
    head, rest = segments[0], segments[1:]
    if head not in node:
        raise ComposeLoadError(
            "PATCH_REMOVE_TARGET_MISSING",
            f"$patch remove target not found: '{'.'.join(segments)}'",
        )
    out = dict(node)
    if not rest:
        del out[head]
        return out
    child = out[head]
    if not _is_object(child):
        raise ComposeLoadError(
            "PATCH_REMOVE_TARGET_MISSING",
            f"$patch remove cannot descend into non-object at '{head}'",
        )
    out[head] = _remove_deep_path(child, rest)
    return out


def _remove_nested(
    base: dict[str, JsonValue], spec: dict[str, JsonValue]
) -> dict[str, JsonValue]:
    """Nested-map remove: recurse where both sides are objects, else unset the key."""
    out = dict(base)
    for key, sub in spec.items():
        target = out.get(key)
        if key in out and _is_object(target) and _is_object(sub):
            out[key] = _remove_nested(target, sub)
        else:
            out.pop(key, None)
    return out


def apply_patch(base: dict[str, JsonValue], patch: JsonValue) -> dict[str, JsonValue]:
    """Apply a `$patch` object to the `$ref`-expanded base.

    A deep-path entry sets its value at the dotted path; structured `add`,
    `replace` and `remove` keys apply in declaration order.
    """
    if not _is_object(patch):
        kind = (
            "null"
            if patch is None
            else "array"
            if isinstance(patch, list)
            else type(patch).__name__
        )
        raise ComposeLoadError(
            "PATCH_SHAPE", f"$patch must be an object of operations, got {kind}"
        )
    result = base
    for key, value in patch.items():
        if key in ("add", "replace"):
            if not _is_object(value):
                raise ComposeLoadError(
                    "PATCH_SHAPE",
                    f"$patch.{key} must be an object of deep-path → value",
                )
            for path, item in value.items():
                result = _set_deep_path(result, _split_path(path), item)
        elif key == "remove":
            if isinstance(value, list):
                for entry in value:
                    if not isinstance(entry, str):
                        raise ComposeLoadError(
                            "PATCH_SHAPE", "$patch.remove array entries must be strings"
                        )
                    result = _remove_deep_path(result, _split_path(entry))
            elif _is_object(value):
                result = _remove_nested(result, value)
            else:
                raise ComposeLoadError(
                    "PATCH_SHAPE",
                    "$patch.remove must be an array of paths or a nested object",
                )
        else:
            # Deep-path set: "a.b.c": value.
            result = _set_deep_path(result, _split_path(key), value)
    return ordered_members(result)


def compose_properties(
    properties: dict[str, JsonValue],
    loader: DocumentLoader,
    opts: Mapping[str, str] | None = None,
) -> dict[str, JsonValue]:
    """Compose a `properties` map: expand `$ref`, overlay `$patch`, recurse children."""
    opts = opts or {}
    basepath = opts.get("basepath", "")
    result = _layer_members(properties, lambda ref: resolve_ref(ref, basepath, loader))
    # Recurse into every child field's `properties`; the tree may compose deeper.
    for name, field in result.items():
        if isinstance(field, dict):
            result[name] = compose_spec(field, loader, opts)
    return result


def compose_spec(
    spec: dict[str, JsonValue],
    loader: DocumentLoader,
    opts: Mapping[str, str] | None = None,
) -> dict[str, JsonValue]:
    """Compose a full field spec: its own `$ref`/`$patch`, then its `properties`."""
    opts = opts or {}
    basepath = opts.get("basepath", "")
    if "$ref" in spec or "$patch" in spec:
        # A field-level `$ref` resolves a file's properties layer too.
        resolved = _layer_members(spec, lambda ref: resolve_ref(ref, basepath, loader))
    else:
        resolved = dict(spec)
    properties = resolved.get("properties")
    if _is_object(properties):
        resolved["properties"] = compose_properties(properties, loader, opts)
    return resolved


def compose_root(
    spec: dict[str, JsonValue],
    loader: DocumentLoader,
    opts: Mapping[str, str] | None = None,
) -> dict[str, JsonValue]:
    """Apply a list or detail root `$ref`/`$patch` with the shared composition primitives.

    Own keys written before `$ref` yield to the base; own keys written after it
    override the base; `$patch` applies last. A root without composition keys
    is returned as a shallow copy.
    """
    opts = opts or {}
    basepath = opts.get("basepath", "")
    if "$ref" not in spec and "$patch" not in spec:
        return dict(spec)
    return _layer_members(spec, lambda ref: resolve_ref(ref, basepath, loader))
