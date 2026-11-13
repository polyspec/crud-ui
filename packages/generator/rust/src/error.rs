use polyspec_crud_ui_validator::compose::{ComposeErrorCode, ComposeLoadError};

/// The code of a failed form operation: each code of a composition load failure, an input failure, a field type
/// that binding does not support or a failure of the random source. The enum holds no other enum, because the
/// interface contract names a kind of this library by one variant (CURP-033, binding GN-7c).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormErrorCode {
    /// A composition load failure with the composition code `RefFileNotFound`.
    RefFileNotFound,
    /// A composition load failure with the composition code `RefFormatError`.
    RefFormatError,
    /// A composition load failure with the composition code `RefDetectKeyNotFound`.
    RefDetectKeyNotFound,
    /// A composition load failure with the composition code `RefCycle`.
    RefCycle,
    /// A composition load failure with the composition code `RefValueType`.
    RefValueType,
    /// A composition load failure with the composition code `PatchShape`.
    PatchShape,
    /// A composition load failure with the composition code `PatchPathConflict`.
    PatchPathConflict,
    /// A composition load failure with the composition code `PatchRemoveTargetMissing`.
    PatchRemoveTargetMissing,
    /// A composition load failure with the composition code `ForbiddenMetaKey`.
    ForbiddenMetaKey,
    /// A composition load failure with the composition code `InvalidRuleParameter`.
    InvalidRuleParameter,
    /// A composition load failure with the composition code `InvalidRulePattern`.
    InvalidRulePattern,
    /// A composition load failure with the composition code `UnknownRule`.
    UnknownRule,
    /// A composition load failure with the composition code `InvalidText`.
    InvalidText,
    /// A value that the operation does not accept (`INVALID_FORM_INPUT`).
    InvalidFormInput,
    /// A field type that binding does not support (`UNSUPPORTED_FIELD_TYPE`).
    UnsupportedFieldType,
    /// The random source of the system failed (`RANDOM_UNAVAILABLE`, CURT-095).
    RandomUnavailable,
}

impl FormErrorCode {
    /// The composition code of the code of a composition load failure, or the code and the kind of a code of this
    /// crate.
    fn origin(self) -> Result<ComposeErrorCode, (&'static str, &'static str)> {
        match self {
            FormErrorCode::RefFileNotFound => Ok(ComposeErrorCode::RefFileNotFound),
            FormErrorCode::RefFormatError => Ok(ComposeErrorCode::RefFormatError),
            FormErrorCode::RefDetectKeyNotFound => Ok(ComposeErrorCode::RefDetectKeyNotFound),
            FormErrorCode::RefCycle => Ok(ComposeErrorCode::RefCycle),
            FormErrorCode::RefValueType => Ok(ComposeErrorCode::RefValueType),
            FormErrorCode::PatchShape => Ok(ComposeErrorCode::PatchShape),
            FormErrorCode::PatchPathConflict => Ok(ComposeErrorCode::PatchPathConflict),
            FormErrorCode::PatchRemoveTargetMissing => {
                Ok(ComposeErrorCode::PatchRemoveTargetMissing)
            }
            FormErrorCode::ForbiddenMetaKey => Ok(ComposeErrorCode::ForbiddenMetaKey),
            FormErrorCode::InvalidRuleParameter => Ok(ComposeErrorCode::InvalidRuleParameter),
            FormErrorCode::InvalidRulePattern => Ok(ComposeErrorCode::InvalidRulePattern),
            FormErrorCode::UnknownRule => Ok(ComposeErrorCode::UnknownRule),
            FormErrorCode::InvalidText => Ok(ComposeErrorCode::InvalidText),
            FormErrorCode::InvalidFormInput => Err(("INVALID_FORM_INPUT", "invalid_form_input")),
            FormErrorCode::UnsupportedFieldType => {
                Err(("UNSUPPORTED_FIELD_TYPE", "unsupported_field_type"))
            }
            FormErrorCode::RandomUnavailable => Err(("RANDOM_UNAVAILABLE", "random_unavailable")),
        }
    }

    /// The code as the specification writes it, such as `INVALID_FORM_INPUT`.
    pub fn as_str(self) -> &'static str {
        match self.origin() {
            Ok(code) => code.as_str(),
            Err((code, _)) => code,
        }
    }

    /// The kind of the failure (binding design E-1): the code in lower snake case.
    pub fn kind(self) -> &'static str {
        match self.origin() {
            Ok(code) => code.kind(),
            Err((_, kind)) => kind,
        }
    }
}

/// The code of a composition load failure with a composition code. The match names every composition code, so a new
/// one does not compile until this enum and the interface contract have its variant.
impl From<ComposeErrorCode> for FormErrorCode {
    fn from(code: ComposeErrorCode) -> Self {
        match code {
            ComposeErrorCode::RefFileNotFound => FormErrorCode::RefFileNotFound,
            ComposeErrorCode::RefFormatError => FormErrorCode::RefFormatError,
            ComposeErrorCode::RefDetectKeyNotFound => FormErrorCode::RefDetectKeyNotFound,
            ComposeErrorCode::RefCycle => FormErrorCode::RefCycle,
            ComposeErrorCode::RefValueType => FormErrorCode::RefValueType,
            ComposeErrorCode::PatchShape => FormErrorCode::PatchShape,
            ComposeErrorCode::PatchPathConflict => FormErrorCode::PatchPathConflict,
            ComposeErrorCode::PatchRemoveTargetMissing => FormErrorCode::PatchRemoveTargetMissing,
            ComposeErrorCode::ForbiddenMetaKey => FormErrorCode::ForbiddenMetaKey,
            ComposeErrorCode::InvalidRuleParameter => FormErrorCode::InvalidRuleParameter,
            ComposeErrorCode::InvalidRulePattern => FormErrorCode::InvalidRulePattern,
            ComposeErrorCode::UnknownRule => FormErrorCode::UnknownRule,
            ComposeErrorCode::InvalidText => FormErrorCode::InvalidText,
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
    /// The code of the failure: the projection from the error to the code whose variants the interface contract
    /// lists as kinds (CURP-033).
    pub fn code(&self) -> &FormErrorCode {
        &self.code
    }

    /// The composition trace or the form path of the failure, the property `at` of its error class.
    pub fn at(&self) -> &str {
        &self.at
    }

    /// The original composition trace, the property `trace` of its error class; empty for instance and binding
    /// failures.
    pub fn trace(&self) -> &[String] {
        &self.trace
    }

    /// A failure of the random source of the system (CURT-095).
    pub(crate) fn random_unavailable(cause: impl std::fmt::Display) -> Self {
        Self {
            code: FormErrorCode::RandomUnavailable,
            message: format!("Unable to generate a row key: {cause}"),
            at: String::new(),
            trace: Vec::new(),
        }
    }

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
            code: error.code.into(),
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
