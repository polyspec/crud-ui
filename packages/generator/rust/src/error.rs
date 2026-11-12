use polyspec_crud_ui_validator::compose::{ComposeErrorCode, ComposeLoadError};

/// The code of a failed form operation: a composition load failure, an input failure or a field
/// type that binding does not support.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormErrorCode {
    /// A composition load failure.
    Compose(ComposeErrorCode),
    /// A value that the operation does not accept (`INVALID_FORM_INPUT`).
    InvalidFormInput,
    /// A field type that binding does not support (`UNSUPPORTED_FIELD_TYPE`).
    UnsupportedFieldType,
}

impl FormErrorCode {
    /// The code as the specification writes it, such as `INVALID_FORM_INPUT`.
    pub fn as_str(self) -> &'static str {
        match self {
            FormErrorCode::Compose(code) => code.as_str(),
            FormErrorCode::InvalidFormInput => "INVALID_FORM_INPUT",
            FormErrorCode::UnsupportedFieldType => "UNSUPPORTED_FIELD_TYPE",
        }
    }

    /// The kind of the failure (binding design E-1): the code in lower snake case.
    pub fn kind(self) -> &'static str {
        match self {
            FormErrorCode::Compose(code) => code.kind(),
            FormErrorCode::InvalidFormInput => "invalid_form_input",
            FormErrorCode::UnsupportedFieldType => "unsupported_field_type",
        }
    }
}

impl std::fmt::Display for FormErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl PartialEq<&str> for FormErrorCode {
    fn eq(&self, other: &&str) -> bool {
        self.as_str() == *other
    }
}

impl serde::Serialize for FormErrorCode {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

/// A failed form compilation, binding or instance operation.
#[derive(Debug, Clone)]
pub struct FormError {
    /// Stable failure identifier.
    pub code: FormErrorCode,
    /// Description of the failed operation.
    pub message: String,
    /// Composition trace or form path.
    pub at: String,
    /// Original composition trace; empty for instance and binding failures.
    pub trace: Vec<String>,
}

impl FormError {
    pub(crate) fn input(message: impl Into<String>) -> Self {
        Self {
            code: FormErrorCode::InvalidFormInput,
            message: message.into(),
            at: String::new(),
            trace: Vec::new(),
        }
    }
}

impl std::fmt::Display for FormError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}
impl std::error::Error for FormError {}

impl From<polyspec_crud_ui_validator::ValidateError> for FormError {
    fn from(error: polyspec_crud_ui_validator::ValidateError) -> Self {
        match error {
            polyspec_crud_ui_validator::ValidateError::Load(error) => error.into(),
            polyspec_crud_ui_validator::ValidateError::InvalidFormInput(error) => {
                Self::input(error.message)
            }
        }
    }
}

impl From<ComposeLoadError> for FormError {
    fn from(error: ComposeLoadError) -> Self {
        Self {
            code: FormErrorCode::Compose(error.code),
            message: error.message,
            at: error.trace.join("."),
            trace: error.trace,
        }
    }
}

impl binding_core::Kinds for FormError {
    fn kind(&self) -> &'static str {
        self.code.kind()
    }
    fn status(&self) -> Option<u16> {
        None
    }
    fn errno(&self) -> Option<i32> {
        None
    }
}

/// Result of a form operation.
pub type FormResult<T> = Result<T, FormError>;
