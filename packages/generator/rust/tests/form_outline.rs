//! The form outline fixture against the Rust generator: each case of `tests/fixtures/form-outline` binds its data and
//! builds its outline rows, which must equal the recorded rows. Each case is one test.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

use libtest_mimic::{Arguments, Trial};
use polyspec_crudui_generator::{
    bind_form, build_outline, compile_form, BindOptions, CompileOptions,
};
use serde_json::Value;

fn cases() -> Vec<Value> {
    let cases: Vec<Value> = serde_json::from_str(include_str!(
        "../../../../tests/fixtures/form-outline/cases.json"
    ))
    .unwrap();
    assert!(!cases.is_empty(), "form-outline cases are empty");
    cases
}

/// One case builds the recorded outline rows.
fn check_case(case: &Value) {
    let template = compile_form(&case["spec"], &CompileOptions::default()).unwrap();
    let bind: BindOptions = serde_json::from_value(case["options"].clone()).unwrap();
    let fields = bind_form(&template, &case["data"], &bind).unwrap();
    assert_eq!(
        Value::Array(build_outline(&fields)),
        case["expected_outline_rows"],
        "{}",
        case["name"]
    );
}

fn main() {
    let trials = cases()
        .into_iter()
        .map(|case| {
            let name = case["name"]
                .as_str()
                .expect("a case has a name")
                .to_string();
            Trial::test(format!("native_outline_fixture::{name}"), move || {
                check_case(&case);
                Ok(())
            })
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
