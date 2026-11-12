#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

use polyspec_crud_ui_validator::{validate, ValidateOptions};
use serde_json::json;

#[test]
fn unknown_fields_fail_at_root_group_and_row() {
    let spec = json!({"type":"group","properties":{
        "title":{"type":"text"},
        "address":{"type":"group","properties":{"city":{"type":"text"}}},
        "rows":{"type":"group","multiple":true,"properties":{"code":{"type":"text"}}}
    }});
    for (data, path) in [
        (json!({"title":"T","z":1,"a":2}), "a"),
        (
            json!({"address":{"city":"Seoul","extra":1}}),
            "address.extra",
        ),
        (
            json!({"rows":{"row1":{"code":"C","extra":1}}}),
            "rows.row1.extra",
        ),
    ] {
        let error = validate(&spec, &data, &ValidateOptions::default()).unwrap_err();
        assert_eq!(error.code(), "INVALID_FORM_INPUT");
        assert_eq!(error.message(), format!("Unknown form data field: {path}"));
    }
}
