//! The complete-form fixtures against the Rust generator: each case of `tests/fixtures/form-complete` creates its form
//! with the case options and renders it with the case render options. A case with `expected_html` must render the same
//! bytes, and a case with `expectError` must fail with the recorded code and message. One trial per case.

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
use polyspec_crud_ui_generator::{
    compile_form, render_form, render_form_view, BindOptions, CompileOptions, Form,
};
use serde_json::Value;
use std::path::Path;

fn cases() -> Vec<Value> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../tests/fixtures/form-complete/cases.json");
    let text = match std::fs::read_to_string(&path) {
        Ok(value) => value,
        Err(error) => panic!("read {}: {error}", path.display()),
    };
    let cases: Vec<Value> = match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(error) => panic!("parse {}: {error}", path.display()),
    };
    assert_eq!(cases.len(), 28, "form-complete holds 28 cases");
    cases
}

/// The first byte where two strings differ, with the text around it in each.
fn first_difference(actual: &str, expected: &str) -> String {
    let index = actual
        .bytes()
        .zip(expected.bytes())
        .position(|(a, e)| a != e)
        .unwrap_or_else(|| actual.len().min(expected.len()));
    let window = |text: &str| {
        let start = index.saturating_sub(60);
        let end = (index + 60).min(text.len());
        String::from_utf8_lossy(&text.as_bytes()[start..end]).into_owned()
    };
    format!(
        "byte {index}: actual {:?} / expected {:?}",
        window(actual),
        window(expected)
    )
}

/// One case renders the recorded bytes, or fails with the recorded code and message.
fn check_case(case: &Value) {
    let name = case["name"].as_str().unwrap();
    let template = match compile_form(&case["spec"], &CompileOptions::default()) {
        Ok(template) => template,
        Err(error) => panic!("{name}: compile failed: {error}"),
    };
    let language = case["options"]
        .get("language")
        .cloned()
        .unwrap_or_else(|| BindOptions::default().language);
    let options = BindOptions {
        language,
        ..BindOptions::default()
    };
    let form = match Form::new(template, &case["data"], options) {
        Ok(form) => form,
        Err(error) => panic!("{name}: bind failed: {error}"),
    };
    let rendered = render_form(&form, Some(&case["render"]));
    // CUMK-073: without a template action, the view of the same nodes, buttons and description is
    // the same markup.
    if form.template().action.is_none() {
        let view = render_form_view(
            form.fields(),
            form.buttons(),
            case["options"]["language"].as_str().unwrap_or("ko"),
            Some(&case["render"]),
            &form.description(),
        );
        assert_eq!(
            view.as_ref().map_err(|error| error.message.clone()),
            rendered.as_ref().map_err(|error| error.message.clone()),
            "{name}: render_form_view"
        );
    }
    if let Some(expected) = case.get("expectError") {
        let error = rendered.err().unwrap_or_else(|| panic!("{name} must fail"));
        assert_eq!(
            error.code,
            expected["code"].as_str().unwrap(),
            "{name}: code"
        );
        assert_eq!(
            error.message,
            expected["message"].as_str().unwrap(),
            "{name}: message"
        );
    } else {
        let html = match rendered {
            Ok(html) => html,
            Err(error) => panic!("{name}: render failed: {error}"),
        };
        let expected = case["expected_html"].as_str().unwrap();
        assert!(
            html == expected,
            "{name}: {}",
            first_difference(&html, expected)
        );
    }
}

fn main() {
    let trials = cases().into_iter().map(|case| {
        let name = case["name"].as_str().unwrap().to_string();
        Trial::test(
            format!("form_complete_cases_render_the_recorded_bytes_or_failures::{name}"),
            move || {
                check_case(&case);
                Ok(())
            },
        )
    });
    libtest_mimic::run(&Arguments::from_args(), trials.collect()).exit();
}
