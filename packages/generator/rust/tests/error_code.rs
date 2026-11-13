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
    assert_eq!(
        *error.code(),
        FormErrorCode::Compose(ComposeErrorCode::RefFileNotFound)
    );
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
