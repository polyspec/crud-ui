//! The functions that the bindings call on a form failure (CURP-033): the projection to its code, whose variants the
//! interface contract lists as kinds (binding GN-7b), and the properties `at` and `trace` of its error class (binding
//! GN-7a).

use polyspec_crud_ui_generator::{FormError, FormErrorCode};
use polyspec_crud_ui_validator::compose::{ComposeErrorCode, ComposeLoadError};

#[test]
fn a_composition_failure_projects_to_its_code_and_gives_its_trace() {
    let error = FormError::from(ComposeLoadError::with_trace(
        ComposeErrorCode::RefFileNotFound,
        "no file at b.json",
        vec!["a.json".to_owned(), "b.json".to_owned()],
    ));
    assert_eq!(*error.code(), FormErrorCode::RefFileNotFound);
    assert_eq!(error.at(), "a.json.b.json");
    assert_eq!(error.trace(), ["a.json", "b.json"]);
}

#[test]
fn a_failure_of_an_instance_has_its_path_and_no_trace() {
    let error = FormError {
        code: FormErrorCode::InvalidFormInput,
        message: "not a row".to_owned(),
        at: "rows.0".to_owned(),
        trace: Vec::new(),
    };
    assert_eq!(error.at(), "rows.0");
    assert!(error.trace().is_empty());
}

/// Binding GN-7c: a kind of this library is one variant of the code, so every composition code has a code of its own
/// with the code text and the kind of the composition code.
#[test]
fn every_composition_code_is_a_code_of_its_own() {
    let codes = [
        (
            ComposeErrorCode::RefFileNotFound,
            FormErrorCode::RefFileNotFound,
        ),
        (
            ComposeErrorCode::RefFormatError,
            FormErrorCode::RefFormatError,
        ),
        (
            ComposeErrorCode::RefDetectKeyNotFound,
            FormErrorCode::RefDetectKeyNotFound,
        ),
        (ComposeErrorCode::RefCycle, FormErrorCode::RefCycle),
        (ComposeErrorCode::RefValueType, FormErrorCode::RefValueType),
        (ComposeErrorCode::PatchShape, FormErrorCode::PatchShape),
        (
            ComposeErrorCode::PatchPathConflict,
            FormErrorCode::PatchPathConflict,
        ),
        (
            ComposeErrorCode::PatchRemoveTargetMissing,
            FormErrorCode::PatchRemoveTargetMissing,
        ),
        (
            ComposeErrorCode::ForbiddenMetaKey,
            FormErrorCode::ForbiddenMetaKey,
        ),
        (
            ComposeErrorCode::InvalidRuleParameter,
            FormErrorCode::InvalidRuleParameter,
        ),
        (
            ComposeErrorCode::InvalidRulePattern,
            FormErrorCode::InvalidRulePattern,
        ),
        (ComposeErrorCode::UnknownRule, FormErrorCode::UnknownRule),
        (ComposeErrorCode::InvalidText, FormErrorCode::InvalidText),
    ];
    for (compose, code) in codes {
        let error = FormError::from(ComposeLoadError::new(compose, "a load failure"));
        assert_eq!(*error.code(), code);
        assert_eq!(code.as_str(), compose.as_str());
        assert_eq!(code.kind(), compose.kind());
    }
    assert_eq!(
        FormErrorCode::InvalidFormInput.as_str(),
        "INVALID_FORM_INPUT"
    );
    assert_eq!(FormErrorCode::InvalidFormInput.kind(), "invalid_form_input");
    assert_eq!(
        FormErrorCode::UnsupportedFieldType.as_str(),
        "UNSUPPORTED_FIELD_TYPE"
    );
    assert_eq!(
        FormErrorCode::UnsupportedFieldType.kind(),
        "unsupported_field_type"
    );
    assert_eq!(
        FormErrorCode::RandomUnavailable.as_str(),
        "RANDOM_UNAVAILABLE"
    );
    assert_eq!(
        FormErrorCode::RandomUnavailable.kind(),
        "random_unavailable"
    );
}
