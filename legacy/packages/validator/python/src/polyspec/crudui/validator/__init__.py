"""CRUDUI form, list and detail validation.

`validate` composes a specification and validates submitted data against it;
`validateList` and `validateDetail` check the composition and the forbidden
keys of a list or detail specification. A specification that does not load
raises `ComposeLoadError`; submitted data of the wrong shape or text raises
`FormInputError`.
"""

from .compose_errors import ComposeLoadError
from .errors import FormInputError
from .validator import Validator, hiddenPaths, validate, validateDetail, validateList

__all__ = [
    "ComposeLoadError",
    "FormInputError",
    "Validator",
    "hiddenPaths",
    "validate",
    "validateDetail",
    "validateList",
]
