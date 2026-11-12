"""Composition load failures.

Composition is a preprocessing pass that runs before validation and rendering:
the engine expands `$ref` and `$patch` into a single specification first. An
unresolved composition is not a validation failure (`valid: False`) — the
specification never comes into existence, so there is no validation result to
return. Every failure this module names is a load failure.

The codes:

- `REF_FILE_NOT_FOUND`: `$ref` names a file the loader does not hold.
- `REF_FORMAT_ERROR`: `$ref` is malformed, an unterminated `(path).keys` form or
  an empty path.
- `REF_DETECT_KEY_NOT_FOUND`: a detect-key path segment, or the trailing
  `properties`, is absent.
- `REF_CYCLE`: `$ref` returns to a file on the current resolution chain.
- `REF_VALUE_TYPE`: `$ref` is neither a string nor a list of strings.
- `PATCH_SHAPE`: `$patch` is not an object of operations.
- `PATCH_PATH_CONFLICT`: a `$patch` path descends into a non-object value.
- `PATCH_REMOVE_TARGET_MISSING`: a `$patch` remove path is absent.
- `FORBIDDEN_META_KEY`: a forbidden meta key survives into the composed
  specification at some depth; `trace` holds the dotted path to the key.
- `INVALID_RULE_PARAMETER`: a rule parameter outside the definitions; `trace`
  is the field's declaration path without row keys.
- `INVALID_RULE_PATTERN`: a `match`/`pattern` string outside the pattern
  language.
- `UNKNOWN_RULE`: a `validate` or `messages` key that is not a registered rule
  name; `trace` is the field's declaration path.
- `INVALID_TEXT`: a string or member name of the specification or a composition
  file that is not a sequence of Unicode scalar values; `trace` is its path.
"""

from collections.abc import Sequence

__all__ = ["ComposeLoadError"]


class ComposeLoadError(ValueError):
    """A specification that does not load: its composition, text or declarations fail."""

    def __init__(self, code: str, message: str, trace: Sequence[str] = ()) -> None:
        super().__init__(message)
        self.name = "ComposeLoadError"
        self.code = code
        self.trace = list(trace)
