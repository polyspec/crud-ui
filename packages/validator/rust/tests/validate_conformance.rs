//! CRUDUI validation-engine conformance (SPEC §2 pipeline, G-B 4-language idempotence).
//!
//! The shared fixture tests/fixtures/validate/cases.json defines the validation
//! result (`expected = { valid, errors, hidden }`) or the exact failure record of a load
//! or input failure (`expectFailure = { code, message, at }`).
//!
//! errors are compared IN ORDER (declaration / traversal order), key by key:
//! path, field, rule, message, value. A reorder is a failure.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

mod common;

const FEATURE: &str = "validate";
const FIXTURE: &str = "tests/fixtures/validate/cases.json";

use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crud_ui_validator::validate::{hidden_paths, validate, ValidateOptions};
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};

fn fixture_path() -> PathBuf {
    let manifest = env!("CARGO_MANIFEST_DIR");
    Path::new(manifest)
        .join("..")
        .join("..")
        .join("..")
        .join("tests")
        .join("fixtures")
        .join("validate")
        .join("cases.json")
}

/// Canonicalize numbers to f64 (JSON loses int/float, so 5 and 5.0 must match);
/// arrays preserve order; objects compared key-wise (recursively normalized).
/// Object KEY ORDER is NOT normalized away (serde_json preserve_order keeps
/// insertion order and the fixture is emitted in the same order).
fn normalize(v: &Value) -> Value {
    match v {
        Value::Number(n) => Value::from(n.as_f64().unwrap_or(0.0)),
        Value::Array(items) => Value::Array(items.iter().map(normalize).collect()),
        Value::Object(map) => {
            let mut out = Map::new();
            for (k, val) in map {
                out.insert(k.clone(), normalize(val));
            }
            Value::Object(out)
        }
        other => other.clone(),
    }
}

fn load_cases() -> Vec<Value> {
    let path = fixture_path();
    let raw = match std::fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(e) => panic!("read fixture {:?}: {}", path, e),
    };
    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(parsed) => parsed,
        Err(e) => panic!("parse fixture {:?}: {}", path, e),
    };
    parsed
        .as_array()
        .unwrap_or_else(|| panic!("fixture root is not an array"))
        .clone()
}

/// Build the `{ valid, errors, hidden }` value shape from a result for ordered comparison.
fn result_to_value(result: &polyspec_crud_ui_validator::validate::ValidationResult) -> Value {
    let errors: Vec<Value> = result.errors.iter().map(|e| e.to_value()).collect();
    let mut m = Map::new();
    m.insert("valid".to_string(), Value::Bool(result.valid));
    m.insert("errors".to_string(), Value::Array(errors));
    m.insert(
        "hidden".to_string(),
        Value::Array(result.hidden.iter().cloned().map(Value::String).collect()),
    );
    Value::Object(m)
}

/// The failures of one fixture case; the case passes when it has none.
fn check_case(case: &Value, name: &str) -> Vec<String> {
    let mut failures: Vec<String> = Vec::new();
    let spec = case.get("spec").expect("case missing spec");
    let data = case.get("data").cloned().unwrap_or(Value::Null);

    let files = case.get("files").and_then(Value::as_object).cloned();
    let options = ValidateOptions {
        files,
        loader: None,
        basepath: None,
    };

    let result = validate(spec, &data, &options);

    match (case.get("expected"), case.get("expectFailure")) {
        (Some(expected), None) => match result {
            Ok(actual) => {
                let actual_v = result_to_value(&actual);
                if normalize(expected) != normalize(&actual_v) {
                    failures.push(format!(
                        "[{}] result mismatch\n  expected: {}\n  actual:   {}",
                        name, expected, actual_v
                    ));
                }
                // CUVR-093: hidden_paths, composed without files, gives the hidden paths of the result.
                if case.get("files").is_none() {
                    match hidden_paths(spec, &data) {
                        Ok(hidden) if hidden == actual.hidden => {}
                        other => failures.push(format!(
                            "[{}] hidden_paths gave {:?}, want {:?}",
                            name, other, actual.hidden
                        )),
                    }
                }
            }
            Err(e) => failures.push(format!(
                "[{}] expected validation result but got failure {}: {}",
                name,
                e.code(),
                e.message()
            )),
        },
        (None, Some(expect_failure)) => match result {
            Ok(actual) => failures.push(format!(
                "[{}] expected failure {} but validated successfully: {}",
                name,
                expect_failure,
                result_to_value(&actual)
            )),
            Err(e) => {
                let got = json!({ "code": e.code(), "message": e.message(), "at": e.at() });
                if &got != expect_failure {
                    failures.push(format!(
                        "[{}] failure mismatch\n  expected: {}\n  actual:   {}",
                        name, expect_failure, got
                    ));
                }
            }
        },
        _ => failures.push(format!(
            "[{}] case must declare exactly one of expected/expectFailure",
            name
        )),
    }
    failures
}

fn main() {
    let cases = load_cases();
    assert!(!cases.is_empty(), "no validate fixture cases were loaded");
    let trials = cases
        .into_iter()
        .map(|case| {
            let name = case
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_else(|| panic!("fixture case missing name"))
                .to_string();
            Trial::test(format!("validate_matches_fixture::{name}"), move || {
                let failures =
                    common::prove_case(FEATURE, FIXTURE, &name, || check_case(&case, &name));
                if failures.is_empty() {
                    Ok(())
                } else {
                    Err(Failed::from(format!("\n{}", failures.join("\n"))))
                }
            })
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
