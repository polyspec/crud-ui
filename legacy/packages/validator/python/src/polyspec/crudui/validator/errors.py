"""Validation input failures, distinct from composition load failures."""


class FormInputError(ValueError):
    """Submitted form data whose shape or text does not match the specification.

    `code` is the stable machine-readable identifier shared with the form
    runtime.
    """

    code = "INVALID_FORM_INPUT"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.name = "FormInputError"
