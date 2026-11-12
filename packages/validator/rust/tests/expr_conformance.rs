//! CRUDUI expression-engine conformance (expressions.md §9 three-stage check):
//!   (1) lexer(expr)  == fixture tokens
//!   (2) parser(toks) == fixture ast
//!   (3) evaluate / evaluateValue == fixture truthy / value
//!
//! The shared fixture tests/fixtures/expr/cases.json defines the expected tokens,
//! syntax tree and evaluation result for every runtime.

#![allow(
    clippy::unwrap_used,
    clippy::disallowed_methods,
    clippy::cast_possible_truncation,
    reason = "R-1 holds the library paths; this harness reads fixtures and fails a case by a panic"
)]

mod common;

const FEATURE: &str = "validate";
const FIXTURE: &str = "tests/fixtures/expr/cases.json";

use libtest_mimic::{Arguments, Failed, Trial};
use polyspec_crudui_validator::expr::Expression;
use serde_json::Value;
use std::path::{Path, PathBuf};

fn fixture_path() -> PathBuf {
    // tests/expr_conformance.rs -> crate root is packages/validator/rust;
    // the shared expr fixture lives at ../../../tests/fixtures/expr/cases.json.
    let manifest = env!("CARGO_MANIFEST_DIR");
    Path::new(manifest)
        .join("..")
        .join("..")
        .join("..")
        .join("tests")
        .join("fixtures")
        .join("expr")
        .join("cases.json")
}

/// Canonicalize for cross-language equality: numbers → f64 (so 0 and 0.0, 1 and
/// 1.0 match; JSON loses the int/float distinction), arrays preserve order,
/// objects compared key-wise (recursively normalized).
fn normalize(v: &Value) -> Value {
    match v {
        Value::Number(n) => {
            let f = n.as_f64().unwrap_or(0.0);
            Value::from(f)
        }
        Value::Array(items) => Value::Array(items.iter().map(normalize).collect()),
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for (k, val) in map {
                out.insert(k.clone(), normalize(val));
            }
            Value::Object(out)
        }
        other => other.clone(),
    }
}

/// Value equality tolerant of int/float spelling (JSON loses the distinction).
fn value_equals(expected: &Value, actual: &Value) -> bool {
    normalize(expected) == normalize(actual)
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

/// The failures of one fixture case: its tokens, syntax tree and every evaluation sub-case must all match.
fn check_case(spec: &Value, name: &str) -> Vec<String> {
    let mut failures: Vec<String> = Vec::new();
    let expr = spec
        .get("expr")
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("[{}] case missing expr", name));

    // A rejected expression fails to parse with the recorded message.
    if let Some(error) = spec.get("error").and_then(Value::as_str) {
        match Expression::parse(expr) {
            Ok(_) => failures.push(format!("[{}] parsed; want error {}", name, error)),
            Err(e) => {
                if e.message != error {
                    failures.push(format!(
                        "[{}] error mismatch\n  expected: {}\n  actual:   {}",
                        name, error, e.message
                    ));
                }
            }
        }
        return failures;
    }

    // (1) lexer
    let expected = spec
        .get("tokens")
        .unwrap_or_else(|| panic!("[{}] case missing tokens", name));
    match Expression::tokenize(expr) {
        Ok(tokens) => {
            let actual = Value::Array(tokens.iter().map(|t| t.to_value()).collect());
            if normalize(expected) != normalize(&actual) {
                failures.push(format!(
                    "[{}] tokens mismatch for `{}`\n  expected: {}\n  actual:   {}",
                    name, expr, expected, actual
                ));
            }
        }
        Err(e) => failures.push(format!("[{}] lex: {}", name, e)),
    }

    // (2) parser
    let expected = spec
        .get("ast")
        .unwrap_or_else(|| panic!("[{}] case missing ast", name));
    match Expression::parse(expr) {
        Ok(ast) => {
            let actual = ast.to_value();
            if normalize(expected) != normalize(&actual) {
                failures.push(format!(
                    "[{}] AST mismatch for `{}`\n  expected: {}\n  actual:   {}",
                    name, expr, expected, actual
                ));
            }
        }
        Err(e) => failures.push(format!("[{}] parse: {}", name, e)),
    }

    // (3) evaluation sub-cases
    let empty: Vec<Value> = Vec::new();
    let case_list = spec
        .get("cases")
        .and_then(Value::as_array)
        .unwrap_or(&empty);
    for (i, case) in case_list.iter().enumerate() {
        let data = case.get("data").cloned().unwrap_or(Value::Null);
        let current_path: Vec<String> = case
            .get("currentPath")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .map(|x| x.as_str().unwrap_or_default().to_string())
                    .collect()
            })
            .unwrap_or_default();
        let row_keys: Vec<usize> = case
            .get("rowKeys")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(Value::as_u64)
                    .map(|x| x as usize)
                    .collect()
            })
            .unwrap_or_default();

        let exp_value = case.get("value").cloned().unwrap_or(Value::Null);
        let exp_truthy = case.get("truthy").and_then(Value::as_bool).unwrap_or(false);

        match Expression::evaluate_value(expr, &data, &current_path, &row_keys) {
            Ok(value) if !value_equals(&exp_value, &value) => failures.push(format!(
                "[{}] value mismatch case {}: `{}` data={} expected={} got={}",
                name, i, expr, data, exp_value, value
            )),
            Ok(_) => {}
            Err(e) => failures.push(format!("[{}] eval_value case {}: {}", name, i, e)),
        }

        match Expression::evaluate(expr, &data, &current_path, &row_keys) {
            Ok(truthy) if truthy != exp_truthy => failures.push(format!(
                "[{}] truthy mismatch case {}: `{}` data={} expected={} got={}",
                name, i, expr, data, exp_truthy, truthy
            )),
            Ok(_) => {}
            Err(e) => failures.push(format!("[{}] eval case {}: {}", name, i, e)),
        }
    }
    failures
}

// --- targeted unit checks beyond the shared fixture --------------------------

fn condition_map_resolves_in_declaration_order() {
    use polyspec_crudui_validator::expr::condition_map;

    let entries = vec![
        (".tier == 'gold'".to_string(), Value::from("premium")),
        (".tier == 'silver'".to_string(), Value::from("standard")),
        ("true".to_string(), Value::from("basic")),
    ];

    let cp = vec!["x".to_string()];
    assert_eq!(
        condition_map::resolve(
            &entries,
            &serde_json::json!({"tier":"gold","x":1}),
            &cp,
            &[]
        ),
        Some(Value::from("premium"))
    );
    assert_eq!(
        condition_map::resolve(
            &entries,
            &serde_json::json!({"tier":"silver","x":1}),
            &cp,
            &[]
        ),
        Some(Value::from("standard"))
    );
    assert_eq!(
        condition_map::resolve(
            &entries,
            &serde_json::json!({"tier":"bronze","x":1}),
            &cp,
            &[]
        ),
        Some(Value::from("basic"))
    );

    // No default key, no match -> None.
    let no_default = vec![(".a == 1".to_string(), Value::from("one"))];
    assert_eq!(
        condition_map::resolve(&no_default, &serde_json::json!({"a":9,"x":1}), &cp, &[]),
        None
    );
}

fn condition_map_default_does_not_short_circuit() {
    use polyspec_crudui_validator::expr::condition_map;

    let entries = vec![
        ("true".to_string(), Value::from("fallback")),
        (".tier == 'gold'".to_string(), Value::from("premium")),
    ];
    let cp = vec!["x".to_string()];
    assert_eq!(
        condition_map::resolve(
            &entries,
            &serde_json::json!({"tier":"gold","x":1}),
            &cp,
            &[]
        ),
        Some(Value::from("premium"))
    );
    assert_eq!(
        condition_map::resolve(
            &entries,
            &serde_json::json!({"tier":"none","x":1}),
            &cp,
            &[]
        ),
        Some(Value::from("fallback"))
    );
}

fn ternary_returns_raw_branch_value() {
    let cp: Vec<String> = vec!["x".to_string()];

    assert_eq!(
        Expression::evaluate_value(
            ".big ? 'huge' : 'tiny'",
            &serde_json::json!({"big":true,"x":1}),
            &cp,
            &[]
        )
        .unwrap(),
        Value::from("huge")
    );
    assert_eq!(
        Expression::evaluate_value(
            ".a ? 'A' : .b ? 'B' : 'C'",
            &serde_json::json!({"a":false,"b":true,"x":1}),
            &cp,
            &[]
        )
        .unwrap(),
        Value::from("B")
    );
    assert_eq!(
        Expression::evaluate_value(
            ".show == 1 ? 1 : null",
            &serde_json::json!({"show":0,"x":1}),
            &cp,
            &[]
        )
        .unwrap(),
        Value::Null
    );
}

fn main() {
    let cases = load_cases();
    assert!(!cases.is_empty(), "no expr fixture cases were loaded");
    let mut trials: Vec<Trial> = cases
        .into_iter()
        .map(|spec| {
            let name = spec
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_else(|| panic!("fixture case missing name"))
                .to_string();
            Trial::test(format!("expression_fixture_matches::{name}"), move || {
                let failures =
                    common::prove_case(FEATURE, FIXTURE, &name, || check_case(&spec, &name));
                if failures.is_empty() {
                    Ok(())
                } else {
                    Err(Failed::from(format!("\n{}", failures.join("\n"))))
                }
            })
        })
        .collect();
    trials.push(Trial::test(
        "condition_map_resolves_in_declaration_order",
        || {
            condition_map_resolves_in_declaration_order();
            Ok(())
        },
    ));
    trials.push(Trial::test(
        "condition_map_default_does_not_short_circuit",
        || {
            condition_map_default_does_not_short_circuit();
            Ok(())
        },
    ));
    trials.push(Trial::test("ternary_returns_raw_branch_value", || {
        ternary_returns_raw_branch_value();
        Ok(())
    }));
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
