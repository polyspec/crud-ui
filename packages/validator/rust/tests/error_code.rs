//! The functions that the bindings call on a validation failure (CURP-032, CURP-033): the projection to its code, whose
//! variants the interface contract lists as kinds (binding GN-7b), the failure of a recognized kind that a file loader
//! raised (binding GN-6d), and the trace of a load failure, the property `trace` of its error class (binding GN-7a).

use polyspec_crud_ui_validator::compose::{ComposeErrorCode, ComposeLoadError};
use polyspec_crud_ui_validator::{ValidateError, ValidateErrorCode};

#[test]
fn a_load_failure_projects_to_the_code_of_its_composition_and_gives_its_trace() {
    let error = ValidateError::Load(ComposeLoadError::with_trace(
        ComposeErrorCode::RefCycle,
        "a cycle",
        vec!["a.json".to_owned(), "b.json".to_owned()],
    ));
    assert_eq!(error.error_code(), ValidateErrorCode::RefCycle);
    assert_eq!(error.trace(), ["a.json", "b.json"]);
}

#[test]
fn a_recognized_load_kind_is_a_load_failure_with_its_message_and_no_trace() {
    let error = ValidateError::recognized(ValidateErrorCode::RefFileNotFound, "no file at a.json");
    assert_eq!(
        error,
        ValidateError::Load(ComposeLoadError::new(
            ComposeErrorCode::RefFileNotFound,
            "no file at a.json"
        ))
    );
    assert!(error.trace().is_empty());
}

#[test]
fn a_recognized_input_kind_is_an_input_failure_with_its_message() {
    let error = ValidateError::recognized(ValidateErrorCode::InvalidFormInput, "not an object");
    assert_eq!(error.error_code(), ValidateErrorCode::InvalidFormInput);
    assert_eq!(error.message(), "not an object");
    assert_eq!(error.code(), "INVALID_FORM_INPUT");
    assert!(error.trace().is_empty());
}

/// Binding GN-7c: a kind of this library is one variant of the code, so every composition code has a code of its own,
/// whose kind is the kind of the composition code and which gives the composition code back.
#[test]
fn every_composition_code_is_a_code_of_its_own() {
    let codes = [
        (
            ComposeErrorCode::RefFileNotFound,
            ValidateErrorCode::RefFileNotFound,
        ),
        (
            ComposeErrorCode::RefFormatError,
            ValidateErrorCode::RefFormatError,
        ),
        (
            ComposeErrorCode::RefDetectKeyNotFound,
            ValidateErrorCode::RefDetectKeyNotFound,
        ),
        (ComposeErrorCode::RefCycle, ValidateErrorCode::RefCycle),
        (
            ComposeErrorCode::RefValueType,
            ValidateErrorCode::RefValueType,
        ),
        (ComposeErrorCode::PatchShape, ValidateErrorCode::PatchShape),
        (
            ComposeErrorCode::PatchPathConflict,
            ValidateErrorCode::PatchPathConflict,
        ),
        (
            ComposeErrorCode::PatchRemoveTargetMissing,
            ValidateErrorCode::PatchRemoveTargetMissing,
        ),
        (
            ComposeErrorCode::ForbiddenMetaKey,
            ValidateErrorCode::ForbiddenMetaKey,
        ),
        (
            ComposeErrorCode::InvalidRuleParameter,
            ValidateErrorCode::InvalidRuleParameter,
        ),
        (
            ComposeErrorCode::InvalidRulePattern,
            ValidateErrorCode::InvalidRulePattern,
        ),
        (
            ComposeErrorCode::UnknownRule,
            ValidateErrorCode::UnknownRule,
        ),
        (
            ComposeErrorCode::InvalidText,
            ValidateErrorCode::InvalidText,
        ),
    ];
    for (compose, code) in codes {
        let error = ValidateError::Load(ComposeLoadError::new(compose, "a load failure"));
        assert_eq!(error.error_code(), code);
        assert_eq!(code.compose(), Some(compose));
        assert_eq!(ValidateError::recognized(code, "a load failure"), error);
    }
    assert_eq!(ValidateErrorCode::InvalidFormInput.compose(), None);
}
