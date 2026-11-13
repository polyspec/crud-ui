//! Validation failures that produce no validation result.

use std::fmt;

use crate::compose::{ComposeErrorCode, ComposeLoadError};

/// Submitted form data whose shape does not match the specification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FormInputError {
    /// The rule and the data path.
    pub message: String,
}

impl FormInputError {
    /// Stable machine-readable code shared with the form runtime.
    pub const CODE: &'static str = "INVALID_FORM_INPUT";

    pub(crate) fn new(message: impl Into<String>) -> Self {
        FormInputError {
            message: message.into(),
        }
    }
}

impl fmt::Display for FormInputError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for FormInputError {}

/// The code of a validation failure, whose variants the interface contract lists as kinds (CURP-033): each code of
/// the composition of a load failure, and the code of an input failure. The enum holds no other enum, because the
/// contract names a kind of this library by one variant (binding GN-7c).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValidateErrorCode {
    /// A load failure with the composition code `RefFileNotFound`.
    RefFileNotFound,
    /// A load failure with the composition code `RefFormatError`.
    RefFormatError,
    /// A load failure with the composition code `RefDetectKeyNotFound`.
    RefDetectKeyNotFound,
    /// A load failure with the composition code `RefCycle`.
    RefCycle,
    /// A load failure with the composition code `RefValueType`.
    RefValueType,
    /// A load failure with the composition code `PatchShape`.
    PatchShape,
    /// A load failure with the composition code `PatchPathConflict`.
    PatchPathConflict,
    /// A load failure with the composition code `PatchRemoveTargetMissing`.
    PatchRemoveTargetMissing,
    /// A load failure with the composition code `ForbiddenMetaKey`.
    ForbiddenMetaKey,
    /// A load failure with the composition code `InvalidRuleParameter`.
    InvalidRuleParameter,
    /// A load failure with the composition code `InvalidRulePattern`.
    InvalidRulePattern,
    /// A load failure with the composition code `UnknownRule`.
    UnknownRule,
    /// A load failure with the composition code `InvalidText`.
    InvalidText,
    /// Submitted data has the wrong shape.
    InvalidFormInput,
}

impl ValidateErrorCode {
    /// The composition code of the code of a load failure; none for the code of an input failure.
    pub fn compose(self) -> Option<ComposeErrorCode> {
        match self {
            ValidateErrorCode::RefFileNotFound => Some(ComposeErrorCode::RefFileNotFound),
            ValidateErrorCode::RefFormatError => Some(ComposeErrorCode::RefFormatError),
            ValidateErrorCode::RefDetectKeyNotFound => Some(ComposeErrorCode::RefDetectKeyNotFound),
            ValidateErrorCode::RefCycle => Some(ComposeErrorCode::RefCycle),
            ValidateErrorCode::RefValueType => Some(ComposeErrorCode::RefValueType),
            ValidateErrorCode::PatchShape => Some(ComposeErrorCode::PatchShape),
            ValidateErrorCode::PatchPathConflict => Some(ComposeErrorCode::PatchPathConflict),
            ValidateErrorCode::PatchRemoveTargetMissing => {
                Some(ComposeErrorCode::PatchRemoveTargetMissing)
            }
            ValidateErrorCode::ForbiddenMetaKey => Some(ComposeErrorCode::ForbiddenMetaKey),
            ValidateErrorCode::InvalidRuleParameter => Some(ComposeErrorCode::InvalidRuleParameter),
            ValidateErrorCode::InvalidRulePattern => Some(ComposeErrorCode::InvalidRulePattern),
            ValidateErrorCode::UnknownRule => Some(ComposeErrorCode::UnknownRule),
            ValidateErrorCode::InvalidText => Some(ComposeErrorCode::InvalidText),
            ValidateErrorCode::InvalidFormInput => None,
        }
    }
}

/// The code of a load failure with a composition code. The match names every composition code, so a new one does
/// not compile until this enum and the interface contract have its variant.
impl From<ComposeErrorCode> for ValidateErrorCode {
    fn from(code: ComposeErrorCode) -> Self {
        match code {
            ComposeErrorCode::RefFileNotFound => ValidateErrorCode::RefFileNotFound,
            ComposeErrorCode::RefFormatError => ValidateErrorCode::RefFormatError,
            ComposeErrorCode::RefDetectKeyNotFound => ValidateErrorCode::RefDetectKeyNotFound,
            ComposeErrorCode::RefCycle => ValidateErrorCode::RefCycle,
            ComposeErrorCode::RefValueType => ValidateErrorCode::RefValueType,
            ComposeErrorCode::PatchShape => ValidateErrorCode::PatchShape,
            ComposeErrorCode::PatchPathConflict => ValidateErrorCode::PatchPathConflict,
            ComposeErrorCode::PatchRemoveTargetMissing => {
                ValidateErrorCode::PatchRemoveTargetMissing
            }
            ComposeErrorCode::ForbiddenMetaKey => ValidateErrorCode::ForbiddenMetaKey,
            ComposeErrorCode::InvalidRuleParameter => ValidateErrorCode::InvalidRuleParameter,
            ComposeErrorCode::InvalidRulePattern => ValidateErrorCode::InvalidRulePattern,
            ComposeErrorCode::UnknownRule => ValidateErrorCode::UnknownRule,
            ComposeErrorCode::InvalidText => ValidateErrorCode::InvalidText,
        }
    }
}

/// A validation run that produced no validation result.
#[derive(Debug, Clone, PartialEq)]
pub enum ValidateError {
    /// The specification could not be composed.
    Load(ComposeLoadError),
    /// Submitted data has the wrong shape.
    InvalidFormInput(FormInputError),
}

impl ValidateError {
    /// Stable machine-readable code.
    pub fn code(&self) -> &str {
        match self {
            ValidateError::Load(error) => error.code.as_str(),
            ValidateError::InvalidFormInput(_) => FormInputError::CODE,
        }
    }

    /// Failure message without the code.
    pub fn message(&self) -> &str {
        match self {
            ValidateError::Load(error) => &error.message,
            ValidateError::InvalidFormInput(error) => &error.message,
        }
    }

    /// The code of the failure: the projection that the bindings match the kinds of the interface contract on
    /// (CURP-033, binding GN-7b).
    pub fn error_code(&self) -> ValidateErrorCode {
        match self {
            ValidateError::Load(error) => error.code.into(),
            ValidateError::InvalidFormInput(_) => ValidateErrorCode::InvalidFormInput,
        }
    }

    /// The failure of the kind `code` that a file loader raised with `message`, as an instance of a recognized error
    /// class (CURP-032, binding GN-6d): a load failure has no trace.
    pub fn recognized(code: ValidateErrorCode, message: &str) -> Self {
        match code.compose() {
            Some(code) => ValidateError::Load(ComposeLoadError::new(code, message)),
            None => ValidateError::InvalidFormInput(FormInputError::new(message)),
        }
    }

    /// The composition path stack of a load failure, the property `trace` of its error class; empty for an input
    /// failure.
    pub fn trace(&self) -> &[String] {
        match self {
            ValidateError::Load(error) => &error.trace,
            ValidateError::InvalidFormInput(_) => &[],
        }
    }

    /// Load-failure trace joined with `.` (a composition trace or a field's
    /// declaration path); empty for an input failure.
    pub fn at(&self) -> String {
        match self {
            ValidateError::Load(error) => error.trace.join("."),
            ValidateError::InvalidFormInput(_) => String::new(),
        }
    }
}

impl fmt::Display for ValidateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ValidateError::Load(error) => error.fmt(f),
            ValidateError::InvalidFormInput(error) => error.fmt(f),
        }
    }
}

impl std::error::Error for ValidateError {}

impl From<ComposeLoadError> for ValidateError {
    fn from(error: ComposeLoadError) -> Self {
        ValidateError::Load(error)
    }
}

impl From<FormInputError> for ValidateError {
    fn from(error: FormInputError) -> Self {
        ValidateError::InvalidFormInput(error)
    }
}

impl binding_core::Kinds for FormInputError {
    fn kind(&self) -> &'static str {
        "invalid_form_input"
    }
    fn status(&self) -> Option<u16> {
        None
    }
    fn errno(&self) -> Option<i32> {
        None
    }
}

/// The kind of a validation failure (binding design E-1): the kind of the load failure or of the
/// input failure that it holds.
impl binding_core::Kinds for ValidateError {
    fn kind(&self) -> &'static str {
        match self {
            ValidateError::Load(error) => error.kind(),
            ValidateError::InvalidFormInput(error) => error.kind(),
        }
    }
    fn status(&self) -> Option<u16> {
        None
    }
    fn errno(&self) -> Option<i32> {
        None
    }
}
