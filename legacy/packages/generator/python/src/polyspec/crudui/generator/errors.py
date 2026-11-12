"""A generation failure with its stable code and field path."""


class FormError(ValueError):
    """Report a generation failure with its stable code and field path."""

    def __init__(self, code: str, message: str, path: str | list[str] = "") -> None:
        super().__init__(message)
        self.name = "FormError"
        self.code = code
        self.path = path
