//! The row-level `unique` check: duplicates belong to one validation, and the rows are walked once
//! per validation.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

use polyspec_crudui_validator::validate::{validate, ValidateOptions};
use serde_json::{json, Map, Value};

fn spec() -> Value {
    json!({"type":"group","properties":{"rows":{"type":"group","multiple":true,"properties":{"code":{"type":"text","validate":{"unique":true}}}}}})
}

fn rows<S: Into<String>>(codes: impl IntoIterator<Item = S>) -> Value {
    let mut out = Map::new();
    for (i, code) in codes.into_iter().enumerate() {
        out.insert(format!("__{:013}__", i + 1), json!({"code": code.into()}));
    }
    json!({"rows": Value::Object(out)})
}

fn options() -> ValidateOptions<'static> {
    ValidateOptions {
        files: None,
        loader: None,
        basepath: None,
    }
}

// A second validation of the same specification with different data answers from its own rows.
#[test]
fn unique_rows_belong_to_one_validation() {
    let spec = spec();
    let first = validate(&spec, &rows(["x", "x"]), &options()).unwrap();
    assert!(!first.valid, "first validation finds the duplicate");
    let second = validate(&spec, &rows(["x", "y"]), &options()).unwrap();
    assert!(
        second.valid,
        "second validation took the first one's duplicates"
    );
}

/// 25,000 rows are walked once, within seconds; a walk of every earlier row for each row makes
/// 3 * 10^8 row visits and does not end before the per-test timeout of the run-tests tool of @polyspec/kit.
#[test]
fn many_unique_rows_are_walked_once() {
    let result = validate(
        &spec(),
        &rows((0..25_000).map(|i| i.to_string())),
        &options(),
    )
    .unwrap();
    assert!(result.valid, "distinct rows were reported as duplicates");
}
