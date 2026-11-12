//! Input text conformance for the Rust validator. The validation families of
//! tests/fixtures/text-validity are JSON text with unpaired surrogate escapes;
//! `JsonText` reads them and the JSON text entry points report the failure each
//! case declares.

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

use libtest_mimic::{Arguments, Failed, Trial};
use std::path::PathBuf;

use serde_json::{json, Value};

use polyspec_crudui_validator::text::{self, JsonString, JsonText};

fn fixture(feature: &str) -> (String, Vec<JsonText>) {
    let relative = format!("tests/fixtures/text-validity/{feature}/cases.json");
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .join(&relative);
    let source = match std::fs::read_to_string(&path) {
        Ok(source) => source,
        Err(e) => panic!("read {path:?}: {e}"),
    };
    assert!(
        serde_json::from_str::<Value>(&source).is_err(),
        "the fixture carries unpaired surrogate escapes"
    );
    match JsonText::parse(&source).expect("fixture JSON text") {
        JsonText::Array(cases) => (relative, cases),
        _ => panic!("fixture is not an array"),
    }
}

/// The native type of a run (CUIT-041): a load failure is ComposeLoadError in ValidateError::Load, an input failure
/// FormInputError in ValidateError::Input, and a run that passes is none.
fn native_type<T>(result: &Result<T, polyspec_crudui_validator::ValidateError>) -> &'static str {
    match result {
        Ok(_) => "none",
        Err(polyspec_crudui_validator::ValidateError::Load(_)) => "ComposeLoadError",
        Err(polyspec_crudui_validator::ValidateError::Input(_)) => "FormInputError",
    }
}

/// The native type that an expectation names, read from its code.
fn expected_type(expected: &Value) -> &'static str {
    match expected.get("code").and_then(Value::as_str) {
        Some("INVALID_TEXT") => "ComposeLoadError",
        Some("INVALID_FORM_INPUT") => "FormInputError",
        _ => "none",
    }
}

fn outcome(result: Result<Value, polyspec_crudui_validator::ValidateError>) -> Value {
    match result {
        Ok(value) => value,
        Err(error) => json!({"code": error.code(), "message": error.message(), "at": error.at()}),
    }
}

/// One case of a validation family: its failure messages, empty when the case passes.
fn check_text_case(feature: &str, case: &JsonText, name: &str) -> Vec<String> {
    let clean = || json!({"valid": true, "errors": []});
    let spec = case.get("spec").expect("spec");
    let files = case.get("files");
    let basepath = case
        .get("options")
        .and_then(|options| options.get("basepath"));
    let result = match feature {
        "validate" => text::validate_text(spec, case.get("data"), files, basepath).map(|result| {
            json!({"valid": result.valid, "errors": result.errors.iter().map(|e| e.to_value()).collect::<Vec<_>>(), "hidden": result.hidden})
        }),
        "validateList" => text::validate_list_text(spec, files, basepath).map(|()| clean()),
        _ => text::validate_detail_text(spec, files, basepath).map(|()| clean()),
    };
    let native = native_type(&result);
    let actual = outcome(result);
    let expected = case
        .get("expect")
        .and_then(JsonText::to_value)
        .expect("expect");
    if actual == expected && native == expected_type(&expected) {
        Vec::new()
    } else {
        vec![format!(
            "{feature}/{name}: got {actual} ({native}), want {expected} ({})",
            expected_type(&expected)
        )]
    }
}

/// The fixture families of the validate trio, each with the symbol of its test.
const FAMILIES: [(&str, &str); 3] = [
    ("validate", "input_text_validate"),
    ("validateList", "input_text_validate_list"),
    ("validateDetail", "input_text_validate_detail"),
];

fn json_text_reads_what_serde_json_reads() {
    for source in [
        r#"{"a":[1,-2.5e3,0,true,false,null,{"b":"\u00e9\ud83d\ude00\n\/"}],"c":"中"}"#,
        " [ ] ",
        "123",
        r#""\u0000""#,
    ] {
        let expected: Value = serde_json::from_str(source).unwrap();
        let parsed = JsonText::parse(source).unwrap();
        assert_eq!(parsed.to_value(), Some(expected.clone()), "{source}");
        assert_eq!(parsed.shape(), expected, "{source}");
        assert_eq!(parsed.invalid_path(), None);
    }
    for source in [
        "",
        "{",
        "[1,]",
        "01",
        "1.",
        "-",
        "\"\\x\"",
        "\"a\u{1}\"",
        "{} {}",
        "{\"a\" 1}",
        "tru",
        "\"\\u12\"",
    ] {
        assert!(serde_json::from_str::<Value>(source).is_err(), "{source}");
        assert!(JsonText::parse(source).is_err(), "{source}");
    }
    let nested = |depth: usize| format!("{}{}", "[".repeat(depth), "]".repeat(depth));
    // serde_json has a hard limit of 128 nesting levels
    assert!(serde_json::from_str::<Value>(&nested(127)).is_ok());
    assert!(JsonText::parse(&nested(127)).is_ok());
    assert!(serde_json::from_str::<Value>(&nested(128)).is_err());
    // JsonText now supports up to 512 levels
    assert!(JsonText::parse(&nested(512)).is_ok());
    assert!(JsonText::parse(&nested(513)).is_err());
}

fn json_text_preserves_object_member_values_for_validation() {
    let spec = JsonText::parse(
        r#"{"type":"group","properties":{"title":{"type":"text","validate":{"required":true}},"body":{"type":"text","validate":{"maxlength":2}}}}"#,
    )
    .unwrap();
    let missing_title = JsonText::parse(r#"{"body":"ok"}"#).unwrap();
    let result = text::validate_text(&spec, Some(&missing_title), None, None).unwrap();
    assert!(!result.valid, "a missing required title must fail");
    let long_body = JsonText::parse(r#"{"title":"Title","body":"long"}"#).unwrap();
    let result = text::validate_text(&spec, Some(&long_body), None, None).unwrap();
    assert!(!result.valid, "a body beyond maxlength must fail");
}

fn json_text_locates_invalid_text() {
    let parsed =
        JsonText::parse(r#"{"z":["ok","\udc00\ud800"],"\uffff":{"x":"\ud800"},"😀":"\ud800"}"#)
            .unwrap();
    assert_eq!(
        parsed.invalid_path(),
        Some(vec!["z".to_owned(), "1".to_owned()])
    );
    let ordered = JsonText::parse(r#"{"😀":"\ud800","\uffff":{"x":"\ud800"}}"#).unwrap();
    assert_eq!(
        ordered.invalid_path(),
        Some(vec!["\u{ffff}".to_owned(), "x".to_owned()])
    );
    assert_eq!(parsed.to_value(), None);
    assert_eq!(parsed.shape()["z"], json!(["ok", ""]));
    let named = JsonText::parse(r#"{"a":{"\ud800":1},"b":"\ud800"}"#).unwrap();
    assert_eq!(named.invalid_path(), Some(vec!["a".to_owned()]));
    assert_eq!(named.shape()["a"].as_object().unwrap().len(), 1);
    assert_eq!(
        text::check_inputs(&[("data", Some(&named))])
            .unwrap_err()
            .message,
        "Text must be Unicode scalar values: data.a"
    );
    let error = text::check_specification(None, Some(&named)).unwrap_err();
    match error {
        polyspec_crudui_validator::ValidateError::Load(load_error) => {
            assert_eq!(load_error.code.as_str(), "INVALID_TEXT");
            assert_eq!(load_error.trace.join("."), "a");
        }
        _ => panic!("expected Load error"),
    }
    // A number serde_json refuses fails after the text checks.
    let spec = JsonText::parse(r#"{"type":"group","properties":{}}"#).unwrap();
    let data = JsonText::parse(r#"{"n":1e400}"#).unwrap();
    assert_eq!(
        text::validate_text(&spec, Some(&data), None, None)
            .unwrap_err()
            .code(),
        "INVALID_FORM_INPUT"
    );
}

/// A value graph of the fixture (value-graphs.json): the path of the input it is placed at, its shape, and the size and
/// leaf of the graph.
struct Graph {
    at: Vec<String>,
    shape: String,
    size: usize,
    leaf: JsonString,
}

fn graph_of(case: &JsonText) -> Graph {
    let graph = case.get("graph").expect("a case has a graph");
    let at = match graph.get("at") {
        Some(JsonText::Array(names)) => names
            .iter()
            .map(|name| match name {
                JsonText::String(JsonString::Text(text)) => text.clone(),
                other => panic!("a graph path names text: {other:?}"),
            })
            .collect(),
        _ => panic!("a graph has a path"),
    };
    let shape = match graph.get("shape") {
        Some(JsonText::String(JsonString::Text(text))) => text.clone(),
        _ => panic!("a graph has a shape"),
    };
    let size = match graph.get("size") {
        Some(JsonText::Number(number)) => number.parse::<usize>().expect("a size is a usize"),
        None => 0,
        other => panic!("a graph size is a number: {other:?}"),
    };
    let leaf = match graph.get("leaf") {
        Some(JsonText::String(text)) => text.clone(),
        None => JsonString::Text("x".to_owned()),
        other => panic!("a graph leaf is text: {other:?}"),
    };
    Graph {
        at,
        shape,
        size,
        leaf,
    }
}

/// The value of a graph that is a tree: `chain` nests the leaf and `flat` lists it. A Rust value owns its nodes, so
/// the shapes that share a container (`doubled`, `self-twice`) are cases of the walk of the bindings (CUIT-042) and
/// have no value here; [`tree_shape`] selects the cases that this test builds.
fn build_graph(graph: &Graph) -> JsonText {
    let leaf = JsonText::String(graph.leaf.clone());
    match graph.shape.as_str() {
        "flat" => JsonText::Array(vec![leaf; graph.size]),
        "chain" => (0..graph.size).fold(leaf, |value, _| JsonText::Array(vec![value])),
        other => panic!("the graph shape {other} is no tree"),
    }
}

/// Whether a value-graph case describes a tree, which a Rust value can hold (CUIT-042).
fn tree_shape(case: &JsonText) -> bool {
    matches!(graph_of(case).shape.as_str(), "flat" | "chain")
}

/// The member `name` of an object, which the path of a graph reads.
fn member_mut<'a>(value: &'a mut JsonText, name: &str) -> &'a mut JsonText {
    match value {
        JsonText::Object(members) => {
            let position = members
                .iter()
                .position(|(member, _)| member.as_str() == Some(name))
                .expect("the graph lies in an object member");
            &mut members[position].1
        }
        other => panic!("the graph lies in an object, not {other:?}"),
    }
}

/// Place `value` at the path of a graph: its first name is an input (`spec`, `data` or `files`), the rest are the members
/// of the objects that hold it, and the last member is replaced or added.
fn place(inputs: [&mut Option<JsonText>; 3], at: &[String], value: JsonText) {
    let [spec, data, files] = inputs;
    let root = match at[0].as_str() {
        "spec" => spec,
        "data" => data,
        "files" => files,
        other => panic!("a graph lies in an input, not {other}"),
    };
    let mut target = root
        .as_mut()
        .expect("the graph lies in an input that the case gives");
    let (last, holders) = at[1..].split_last().expect("the graph path names a member");
    for holder in holders {
        target = member_mut(target, holder);
    }
    match target {
        JsonText::Object(members) => match members
            .iter()
            .position(|(member, _)| member.as_str() == Some(last.as_str()))
        {
            Some(position) => members[position].1 = value,
            None => members.push((JsonString::Text(last.clone()), value)),
        },
        other => panic!("the graph lies in an object, not {other:?}"),
    }
}

/// One value-graph case: its graph is built and placed, and its validation checked against the expectation.
fn check_graph_case(case: &JsonText, name: &str) -> Vec<String> {
    let graph = graph_of(case);
    let mut spec = case.get("spec").cloned();
    let mut data = case.get("data").cloned();
    let mut files = case.get("files").cloned();
    place(
        [&mut spec, &mut data, &mut files],
        &graph.at,
        build_graph(&graph),
    );
    let spec = spec.expect("a graph case has a specification");
    let basepath = case
        .get("options")
        .and_then(|options| options.get("basepath"));
    let result = text::validate_text(&spec, data.as_ref(), files.as_ref(), basepath);
    let native = native_type(&result);
    let actual = match result {
        Ok(result) => {
            json!({"valid": result.valid, "errors": result.errors.iter().map(|e| e.to_value()).collect::<Vec<_>>(), "hidden": result.hidden})
        }
        Err(error) => json!({"code": error.code(), "message": error.message(), "at": error.at()}),
    };
    let expected = case
        .get("expect")
        .and_then(JsonText::to_value)
        .expect("expect");
    if actual == expected && native == expected_type(&expected) {
        Vec::new()
    } else {
        vec![format!(
            "value-graphs/{name}: got {actual} ({native}), want {expected} ({})",
            expected_type(&expected)
        )]
    }
}

/// The cases of the value-graph fixture, read as JSON text.
fn value_graph_cases() -> Vec<JsonText> {
    let relative = "tests/fixtures/text-validity/value-graphs.json";
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .join(relative);
    let source = match std::fs::read_to_string(&path) {
        Ok(source) => source,
        Err(e) => panic!("read {path:?}: {e}"),
    };
    match JsonText::parse(&source).expect("value-graphs.json") {
        JsonText::Array(cases) => cases,
        _ => panic!("fixture is not an array"),
    }
}

fn main() {
    let mut trials = Vec::new();
    for (feature, symbol) in FAMILIES {
        let (relative, cases) = fixture(feature);
        for case in cases {
            let relative = relative.clone();
            let name = case
                .get("name")
                .and_then(|n| match n {
                    JsonText::String(JsonString::Text(name)) => Some(name.clone()),
                    _ => None,
                })
                .expect("case name");
            trials.push(Trial::test(format!("{symbol}::{name}"), move || {
                let failures = common::prove_case(feature, &relative, &name, || {
                    check_text_case(feature, &case, &name)
                });
                if failures.is_empty() {
                    Ok(())
                } else {
                    Err(Failed::from(format!("\n{}", failures.join("\n"))))
                }
            }));
        }
    }
    trials.push(Trial::test("json_text_reads_what_serde_json_reads", || {
        json_text_reads_what_serde_json_reads();
        Ok(())
    }));
    trials.push(Trial::test(
        "json_text_preserves_object_member_values_for_validation",
        || {
            json_text_preserves_object_member_values_for_validation();
            Ok(())
        },
    ));
    trials.push(Trial::test("json_text_locates_invalid_text", || {
        json_text_locates_invalid_text();
        Ok(())
    }));
    for case in value_graph_cases().into_iter().filter(tree_shape) {
        let name = case
            .get("name")
            .and_then(|n| match n {
                JsonText::String(JsonString::Text(name)) => Some(name.clone()),
                _ => None,
            })
            .expect("case name");
        trials.push(Trial::test(
            format!("value_graph_limits::{name}"),
            move || {
                let failures = check_graph_case(&case, &name);
                if failures.is_empty() {
                    Ok(())
                } else {
                    Err(Failed::from(format!("\n{}", failures.join("\n"))))
                }
            },
        ));
    }
    libtest_mimic::run(&Arguments::from_args(), trials).exit();
}
