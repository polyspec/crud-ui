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
#[path = "support/evidence.rs"]
mod evidence;
mod support;

use polyspec_crud_ui_generator::{
    bind_form, build_outline, compile_form, render_data_panel, render_outline_view, BindOptions,
    CompileOptions,
};
use serde_json::Value;
use support::{first_difference, html_tree};

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
    // CUMK-072 and CUMK-071: the structure map and the data panel, compared as layout trees.
    let language = case["options"]["language"].as_str().unwrap_or("ko");
    let outline = render_outline_view(
        &fields,
        case["canUndo"] == true,
        case["canRedo"] == true,
        language,
    )
    .unwrap();
    let (actual, expected) = (
        html_tree(&outline),
        html_tree(case["expected_outline_html"].as_str().unwrap()),
    );
    assert!(
        actual == expected,
        "{} outline: {:?}",
        case["name"],
        first_difference(&actual, &expected)
    );
    let data = render_data_panel(&case["data"], language).unwrap();
    let (actual, expected) = (
        html_tree(&data),
        html_tree(case["expected_data_html"].as_str().unwrap()),
    );
    assert!(
        actual == expected,
        "{} data: {:?}",
        case["name"],
        first_difference(&actual, &expected)
    );
}

fn main() {
    let trials = support::cases("form-outline")
        .into_iter()
        .map(|case| {
            let name = case["name"]
                .as_str()
                .expect("a case has a name")
                .to_string();
            Trial::test(format!("native_outline_fixture::{name}"), move || {
                evidence::prove_all(
                    &["compileForm", "bindForm", "buildOutline"],
                    "tests/fixtures/form-outline/cases.json",
                    &name,
                    || {
                        check_case(&case);
                        Ok(())
                    },
                )
            })
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
