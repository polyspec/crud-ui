//! The list rendering fixtures against the Rust generator: each case of `tests/fixtures/list-render` renders its rows
//! to the recorded layout, or raises the recorded code and message. Results are compared as normalized layout trees
//! (tests/support) without the image preload links, as the Python runner does. One trial per case.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

mod support;

use libtest_mimic::{Arguments, Trial};
use polyspec_crud_ui_generator::{list_rows, render_list, ListOptions};
use regex::Regex;
use serde_json::Value;
use std::sync::LazyLock;

static PRELOAD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"<link [^>]*rel="preload"[^>]*>"#).unwrap());

fn options(case: &Value) -> ListOptions<'static> {
    let options = &case["options"];
    ListOptions {
        files: options["files"].as_object().cloned().unwrap_or_default(),
        basepath: options["basepath"].as_str().unwrap_or("").into(),
        language: options["language"].as_str().unwrap_or("ko").into(),
        data: options.get("data").cloned().unwrap_or(Value::Null),
        page: options.get("page").cloned().unwrap_or(Value::Null),
        total: options.get("total").cloned().unwrap_or(Value::Null),
        layout: options.get("layout").cloned().unwrap_or(Value::Null),
        ..Default::default()
    }
}

/// One case renders the recorded layout, or fails with the recorded code and message.
fn check_case(case: &Value) {
    let name = case["name"].as_str().unwrap();
    let rows = list_rows(case.get("rows"));
    let result = rows.and_then(|rows| render_list(&case["spec"], rows, &options(case)));
    if let Some(expected) = case.get("expectError") {
        let error = result.err().unwrap_or_else(|| panic!("{name} must fail"));
        assert_eq!(
            error.code,
            expected["code"].as_str().unwrap(),
            "{name}: code"
        );
        if let Some(message) = expected.get("message").and_then(Value::as_str) {
            assert!(
                error.message.contains(message),
                "{name}: message {:?} lacks {message:?}",
                error.message
            );
        }
        return;
    }
    let actual = match result {
        Ok(actual) => actual,
        Err(error) => panic!("{name}: {error}"),
    };
    let actual = PRELOAD.replace_all(&actual, "");
    let expected = case["expected_html"].as_str().unwrap();
    if let Some(difference) =
        support::first_difference(&support::html_tree(&actual), &support::html_tree(expected))
    {
        panic!("{name}: {difference}");
    }
}

fn main() {
    let cases = support::cases("list-render");
    assert_eq!(cases.len(), 165, "list-render holds 165 cases");
    let trials = cases.into_iter().map(|case| {
        let name = case["name"].as_str().unwrap().to_string();
        Trial::test(
            format!("list_render_cases_reproduce_the_normalized_layout_or_the_failure::{name}"),
            move || {
                check_case(&case);
                Ok(())
            },
        )
    });
    libtest_mimic::run(&Arguments::from_args(), trials.collect()).exit();
}
