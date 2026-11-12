//! CRUDUI recursive forbidden-scan conformance (SPEC §6).
//!
//! The shared fixture tests/fixtures/spec-validity/cases.json defines each
//! expected result. A clean spec
//! passes the load path; a forbidden meta key found at ANY depth (slot/bucket
//! body and one level below, deep child subtrees, array elements, $ref-inherited
//! bases) is a LOAD ERROR (`ComposeLoadError`, code `FORBIDDEN_META_KEY`), never
//! `valid:true`. The test compares both the code and the complete dotted path
//! (`trace`) against the fixture `at_path`.
//!
//! Fixture format:
//!   { name, note, spec, files?, expect: "ok" }
//!   { name, note, spec, files?, expect: { error_code, at_path } }

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
const FIXTURE: &str = "tests/fixtures/spec-validity/cases.json";

use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crud_ui_validator::validate::{validate, ValidateOptions};
use serde_json::Value;
use std::path::{Path, PathBuf};

fn fixture_path() -> PathBuf {
    // tests/spec_validity_conformance.rs -> crate root is packages/validator/rust;
    // the shared fixture lives at ../../../tests/fixtures/spec-validity/cases.json.
    let manifest = env!("CARGO_MANIFEST_DIR");
    Path::new(manifest)
        .join("..")
        .join("..")
        .join("..")
        .join("tests")
        .join("fixtures")
        .join("spec-validity")
        .join("cases.json")
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

/// Run the real LOAD path (compose -> forbidden-scan -> validate) for a case.
/// Data is irrelevant to the scan; pass an empty object — the scan runs before
/// any data-driven validation. A load failure carries `code|at`.
fn run(case: &Value) -> Result<(bool, usize), String> {
    let spec = case.get("spec").expect("case missing spec");
    let files = case.get("files").and_then(Value::as_object).cloned();
    let options = ValidateOptions {
        files,
        loader: None,
        basepath: None,
    };
    let data = Value::Object(Default::default());
    match validate(spec, &data, &options) {
        Ok(result) => Ok((result.valid, result.errors.len())),
        Err(e) => Err(format!("{}|{}", e.code(), e.at())),
    }
}

/// One case of the spec-validity fixture, run through `prove_case`; returns its failure messages (none when it passes).
fn spec_validity_case_failures(case: &Value) -> Vec<String> {
    let name = case
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("fixture case missing name"));
    common::prove_case(FEATURE, FIXTURE, name, || {
        let mut failures: Vec<String> = Vec::new();
        let engine = case.get("engine").expect("case missing engine");

        let result = run(case);

        match engine {
            // "pass" — no load failure and { valid: true, errors: [] }.
            Value::String(s) if s == "pass" => match result {
                Ok((true, 0)) => {}
                Ok((valid, errors)) => failures.push(format!(
                    "[{}] engine:\"pass\" but valid={} with {} error(s)",
                    name, valid, errors
                )),
                Err(got) => failures.push(format!(
                    "[{}] engine:\"pass\" but got load error: {}",
                    name, got
                )),
            },
            // { code, at } — must be a LOAD ERROR with that exact code AND that
            // exact dotted path (depth is load-bearing).
            Value::Object(want) => {
                let code = want.get("code").and_then(Value::as_str).unwrap_or("?");
                let at = want.get("at").and_then(Value::as_str).unwrap_or("?");
                let expected = format!("{}|{}", code, at);
                match result {
                    Ok(_) => failures.push(format!(
                        "[{}] expected load error {} but loaded successfully",
                        name, expected
                    )),
                    Err(got) => {
                        if got != expected {
                            failures.push(format!(
                                "[{}] mismatch: expected {} got {}",
                                name, expected, got
                            ));
                        }
                    }
                }
            }
            other => failures.push(format!(
                "[{}] engine must be \"pass\" | {{code, at}}, got {}",
                name, other
            )),
        }
        failures
    })
}

fn main() {
    let cases = load_cases();
    assert!(
        !cases.is_empty(),
        "no spec-validity fixture cases were loaded"
    );
    let trials: Vec<Trial> = cases
        .into_iter()
        .map(|case| {
            let name = case
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_else(|| panic!("fixture case missing name"))
                .to_owned();
            Trial::test(
                format!("spec_validity_matches_fixture::{name}"),
                move || {
                    let failures = spec_validity_case_failures(&case);
                    if failures.is_empty() {
                        Ok(())
                    } else {
                        Err(Failed::from(failures.join("\n")))
                    }
                },
            )
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
