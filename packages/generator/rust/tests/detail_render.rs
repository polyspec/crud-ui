//! The detail rendering fixtures against the Rust generator: each case of `tests/fixtures/detail-render` renders its
//! record to the recorded layout, or raises the recorded code and message. Results are compared as normalized layout
//! trees (tests/support) without the image preload links, as the Python runner does. One trial per case.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

#[path = "support/evidence.rs"]
mod evidence;
mod support;

use libtest_mimic::{Arguments, Trial};
use polyspec_crud_ui_generator::{build_detail, render_detail, DetailOptions};
use regex::Regex;
use serde_json::{json, Value};
use std::sync::LazyLock;

static PRELOAD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"<link [^>]*rel="preload"[^>]*>"#).unwrap());

fn options(case: &Value) -> DetailOptions<'static> {
    let options = &case["options"];
    DetailOptions {
        files: support::case_files(case).unwrap_or_default(),
        basepath: options["basepath"].as_str().unwrap_or("").into(),
        language: options["language"].as_str().unwrap_or("ko").into(),
        data: match options.get("data") {
            Some(Value::Null) | None => Value::Null,
            Some(data) => support::case_value(data),
        },
        page: options.get("page").cloned().unwrap_or(Value::Null),
        total: options.get("total").cloned().unwrap_or(Value::Null),
        layout: options.get("layout").cloned().unwrap_or(Value::Null),
        ..Default::default()
    }
}

/// One case renders the recorded layout, or fails with the recorded code and message.
fn check_case(case: &Value) {
    let name = case["name"].as_str().unwrap();
    let record = case
        .get("record")
        .map(support::case_value)
        .unwrap_or(json!({}));
    let spec = support::case_value(&case["spec"]);
    // build_detail gives the model of the same case and fails with the same code.
    let built = build_detail(&spec, &record, &options(case));
    let result = render_detail(&spec, &record, &options(case));
    match (&built, &result) {
        (Ok(_), Ok(_)) => {}
        (Err(built), Err(rendered)) => {
            assert_eq!(built.code, rendered.code, "{name}: build_detail code")
        }
        (built, rendered) => panic!(
            "{name}: build_detail {:?} and render_detail {:?} differ",
            built.is_ok(),
            rendered.is_ok()
        ),
    }
    if let Some(expected) = case.get("raises") {
        let error = result.err().unwrap_or_else(|| panic!("{name} must fail"));
        assert_eq!(
            error.code,
            support::raised_code(case).unwrap().as_str(),
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
    let cases = support::case_groups("detail-render", &["cases"]);
    assert_eq!(cases.len(), 68, "detail-render holds 68 cases");
    let trials = cases.into_iter().map(|case| {
        let name = case["name"].as_str().unwrap().to_string();
        Trial::test(
            format!("detail_render_cases_reproduce_the_normalized_layout_or_the_failure::{name}"),
            move || {
                evidence::prove_all(
                    &["buildDetail", "renderDetail"],
                    "tests/fixtures/detail-render/cases.json",
                    &name,
                    || {
                        check_case(&case);
                        Ok(())
                    },
                )
            },
        )
    });
    libtest_mimic::run(&Arguments::from_args(), trials.collect()).exit();
}
