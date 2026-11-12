//! CRUDUI composition-engine conformance (SPEC §5, G5).
//!
//! The shared fixture tests/fixtures/compose/cases.json defines the expanded
//! specification (`expected`) or load-error code (`expectError.code`).
//!
//! Fixture format (per the task contract):
//!   { name, input: { files?, entry, basepath?, kind? }, expected }    — success
//!   { name, input: { files?, entry, basepath?, kind? }, expectError } — load error

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

const FEATURE: &str = "compileForm";
const FIXTURE: &str = "tests/fixtures/compose/cases.json";

use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crud_ui_validator::compose::{
    compose_properties, compose_spec, ComposeOptions, MemoryLoader,
};
use serde_json::{Map, Value};
use std::path::{Path, PathBuf};

fn fixture_path() -> PathBuf {
    // tests/compose_conformance.rs -> crate root is packages/validator/rust;
    // the shared compose fixture lives at ../../../tests/fixtures/compose/cases.json.
    let manifest = env!("CARGO_MANIFEST_DIR");
    Path::new(manifest)
        .join("..")
        .join("..")
        .join("..")
        .join("tests")
        .join("fixtures")
        .join("compose")
        .join("cases.json")
}

/// Canonicalize for cross-language equality: numbers → f64 (JSON loses the
/// int/float distinction so 5 and 5.0 must match), arrays preserve order,
/// objects compared key-wise (recursively normalized). Object KEY ORDER is NOT
/// normalized away — compose semantics are declaration-order-sensitive, but
/// serde_json with preserve_order keeps insertion order and the fixture is
/// emitted in the same order, so equality holds without reordering.
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

fn obj(v: &Value) -> Map<String, Value> {
    v.as_object().cloned().unwrap_or_default()
}

/// One case of the compose fixture, run through `prove_case`; returns its failure messages (none when it passes).
fn compose_case_failures(spec: &Value) -> Vec<String> {
    let name = spec
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("fixture case missing name"));
    common::prove_case(FEATURE, FIXTURE, name, || {
        let mut failures: Vec<String> = Vec::new();
        let input = spec.get("input").expect("case missing input");

        // Build the loader from input.files (default empty).
        let files = input
            .get("files")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        let loader = MemoryLoader::new(files);

        // kind: 'properties' (default) | 'spec'.
        let kind = input
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or("properties");

        // basepath (default '').
        let opts = match input.get("basepath").and_then(Value::as_str) {
            Some(bp) => ComposeOptions::with_basepath(bp),
            None => ComposeOptions::default(),
        };

        let entry = obj(input.get("entry").expect("case missing entry"));

        let result = if kind == "spec" {
            compose_spec(entry, &loader, &opts)
        } else {
            compose_properties(entry, &loader, &opts)
        };

        match (spec.get("expected"), spec.get("expectError")) {
            (Some(expected), None) => match result {
                Ok(actual) => {
                    let actual_v = Value::Object(actual);
                    if normalize(expected) != normalize(&actual_v) {
                        failures.push(format!(
                            "[{}] expanded spec mismatch\n  expected: {}\n  actual:   {}",
                            name, expected, actual_v
                        ));
                    }
                }
                Err(e) => failures.push(format!(
                    "[{}] expected success but got load error {}: {}",
                    name, e.code, e.message
                )),
            },
            (None, Some(expect_error)) => {
                let want = expect_error
                    .get("code")
                    .and_then(Value::as_str)
                    .unwrap_or("?");
                match result {
                    Ok(actual) => failures.push(format!(
                        "[{}] expected load error {} but composed successfully: {}",
                        name,
                        want,
                        Value::Object(actual)
                    )),
                    Err(e) => {
                        let got = e.code.as_str();
                        if got != want {
                            failures.push(format!(
                                "[{}] error code mismatch: expected {} got {} ({})",
                                name, want, got, e.message
                            ));
                        }
                    }
                }
            }
            _ => failures.push(format!(
                "[{}] case has neither (or both) expected/expectError",
                name
            )),
        }
        failures
    })
}

fn main() {
    let cases = load_cases();
    assert!(!cases.is_empty(), "no compose fixture cases were loaded");
    let trials: Vec<Trial> = cases
        .into_iter()
        .map(|spec| {
            let name = spec
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_else(|| panic!("fixture case missing name"))
                .to_owned();
            Trial::test(format!("compose_matches_fixture::{name}"), move || {
                let failures = compose_case_failures(&spec);
                if failures.is_empty() {
                    Ok(())
                } else {
                    Err(Failed::from(failures.join("\n")))
                }
            })
        })
        .collect();
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
