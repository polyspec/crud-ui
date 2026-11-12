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
use polyspec_crud_ui_generator::{build_list, list_rows, render_list, ListOptions};
use regex::Regex;
use serde_json::Value;
use std::sync::LazyLock;

static PRELOAD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"<link [^>]*rel="preload"[^>]*>"#).unwrap());

fn options(case: &Value) -> ListOptions<'static> {
    let options = &case["options"];
    ListOptions {
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
    // The rows of a case are a list of values; a case of the group row_shapes gives one value in their place.
    let rows = case.get("rows").map(|rows| match rows {
        Value::Array(items) => Value::Array(items.iter().map(support::case_value).collect()),
        other => support::case_value(other),
    });
    let spec = support::case_value(&case["spec"]);
    let rows = list_rows(rows.as_ref());
    // build_list gives the model of the same case: it fails with the code of the case, or it succeeds where only the
    // rendering refuses the case (the layout).
    let built = rows
        .clone()
        .and_then(|rows| build_list(&spec, rows, &options(case)));
    let result = rows.and_then(|rows| render_list(&spec, rows, &options(case)));
    match (&built, &result) {
        (Ok(_), Ok(_)) | (Ok(_), Err(_)) => {}
        // render_list checks the layout before the composition, so its failure may come first.
        (Err(built), Err(rendered)) if !rendered.message.contains("layout") => {
            assert_eq!(built.code, rendered.code, "{name}: build_list code");
        }
        (Err(_), Err(_)) => {}
        (Err(built), Ok(_)) => panic!(
            "{name}: build_list fails with {} where render_list renders",
            built.code
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
    let cases = support::case_groups("list-render", &["cases", "row_shapes"]);
    assert_eq!(cases.len(), 165, "list-render holds 165 cases");
    let trials = cases.into_iter().map(|case| {
        let name = case["name"].as_str().unwrap().to_string();
        Trial::test(
            format!("list_render_cases_reproduce_the_normalized_layout_or_the_failure::{name}"),
            move || {
                support::evidence::prove_all(
                    &["buildList", "renderList"],
                    "tests/fixtures/list-render/cases.json",
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
