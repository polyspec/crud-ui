//! The list and detail validity cases against the Rust generator (docs/spec/display-formats.md, CUDF-036 to CUDF-062):
//! `build_list` and `build_detail` refuse a case with the engine failure that the case records, refuse a case that the
//! meta-schema rejects but the validator loads with INVALID_FORM_INPUT, and build every other case. Each case of
//! tests/fixtures/list-validity is a trial `list_render_validity::<case>`, and each case of tests/fixtures/detail-validity
//! is a trial `detail_render_validity::<case>`.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crudui_generator::{build_detail, build_list, DetailOptions, FormError, ListOptions};
use serde_json::{json, Map, Value};
use std::path::Path;

/// The cases of one fixture family, read from `tests/fixtures/<family>/cases.json`.
fn cases(family: &str) -> Vec<Value> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../tests/fixtures")
        .join(family)
        .join("cases.json");
    let text = match std::fs::read_to_string(&path) {
        Ok(value) => value,
        Err(error) => panic!("read {}: {error}", path.display()),
    };
    let cases: Vec<Value> = match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(error) => panic!("parse {}: {error}", path.display()),
    };
    assert!(!cases.is_empty(), "{family} holds no case");
    cases
}

/// The files of a case, the composition file set that every runtime passes to the engine.
fn files(case: &Value) -> Map<String, Value> {
    case["files"].as_object().cloned().unwrap_or_default()
}

/// The outcome of a case in the shape of its engine record: "pass", or the code and the composition trace.
fn outcome(result: Result<(), FormError>) -> Value {
    match result {
        Ok(()) => json!("pass"),
        Err(error) => {
            let at = if error.trace.is_empty() {
                error.at.clone()
            } else {
                error.trace.join(".")
            };
            json!({"code": error.code, "at": at})
        }
    }
}

/// Checks the outcome of a case: its recorded engine failure, the INVALID_FORM_INPUT refusal of a rejected declaration, or a build.
fn check(case: &Value, observed: Value) -> Result<(), Failed> {
    let expected = match case["engine"].as_str() {
        Some("pass") => {
            if case["expect"] == "ok" {
                json!("pass")
            } else {
                json!({"code": "INVALID_FORM_INPUT", "at": ""})
            }
        }
        _ => case["engine"].clone(),
    };
    if observed == expected {
        Ok(())
    } else {
        Err(Failed::from(format!("\n got {observed}\nwant {expected}")))
    }
}

fn main() {
    let mut trials = Vec::new();
    for case in cases("list-validity") {
        let name = case["name"]
            .as_str()
            .expect("a case has a name")
            .to_string();
        trials.push(Trial::test(
            format!("list_render_validity::{name}"),
            move || {
                let options = ListOptions {
                    files: files(&case),
                    ..Default::default()
                };
                let result = build_list(&case["spec"], &[], &options).map(|_| ());
                check(&case, outcome(result))
            },
        ));
    }
    for case in cases("detail-validity") {
        let name = case["name"]
            .as_str()
            .expect("a case has a name")
            .to_string();
        trials.push(Trial::test(
            format!("detail_render_validity::{name}"),
            move || {
                let options = DetailOptions {
                    files: files(&case),
                    ..Default::default()
                };
                let result = build_detail(&case["spec"], &json!({}), &options).map(|_| ());
                check(&case, outcome(result))
            },
        ));
    }
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
