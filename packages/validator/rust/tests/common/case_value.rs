//! The cases of the shared fixtures in the form of the generated tests of binding (G-5): a file is an object of groups,
//! each group a list of cases; a case names the arguments of the operation by their parameter names, writes a value of
//! the value type `json_value` as `{"kind", "value"}` (`null` without a value, `bool`, `number` with its literal as
//! text, `text`, `list` with its items, `map` with its `[name, value]` pairs in order), and a failure as
//! `raises: {kind, status, category}`, which these tests extend with the `message` and the `at` of the failure.

#![allow(
    dead_code,
    reason = "each test crate of the package uses the readers that its fixtures need"
)]

use serde_json::{Map, Value};
use std::path::Path;

/// The deepest nesting that a case file may have: three levels of the case form for each of the 256 levels of a value
/// (CUIT-022), and eight for the file, its group, a case, its options, the files and an argument.
pub const CASE_DEPTH_LIMIT: usize = 3 * 256 + 8;

/// The deepest nesting of arrays and objects in a JSON text, counted outside its strings.
fn text_depth(text: &str) -> usize {
    let (mut depth, mut deepest, mut in_string, mut escaped) = (0usize, 0usize, false, false);
    for byte in text.bytes() {
        if in_string {
            match (escaped, byte) {
                (true, _) => escaped = false,
                (false, b'\\') => escaped = true,
                (false, b'"') => in_string = false,
                _ => {}
            }
            continue;
        }
        match byte {
            b'"' => in_string = true,
            b'[' | b'{' => {
                depth += 1;
                deepest = deepest.max(depth);
            }
            b']' | b'}' => depth = depth.saturating_sub(1),
            _ => {}
        }
    }
    deepest
}

/// The cases of the group `cases` of the fixture at `path`.
pub fn read_cases(path: &Path) -> Vec<Value> {
    match read_file(path).get("cases") {
        Some(Value::Array(cases)) => cases.clone(),
        _ => panic!("fixture {:?} has no group cases", path),
    }
}

/// The case file at `path`, an object of groups.
pub fn read_file(path: &Path) -> Value {
    let raw =
        std::fs::read_to_string(path).unwrap_or_else(|e| panic!("read fixture {:?}: {}", path, e));
    // The case form nests a value three levels per level of the value, so a value of 256 levels is beyond the
    // recursion limit of serde_json; the reader of the cases has its own limit, CASE_DEPTH_LIMIT, checked before the
    // parse. The libraries keep the limit of serde_json.
    let depth = text_depth(&raw);
    assert!(
        depth <= CASE_DEPTH_LIMIT,
        "fixture {:?} nests {depth} levels, beyond {CASE_DEPTH_LIMIT}",
        path
    );
    let mut reader = serde_json::Deserializer::from_str(&raw);
    reader.disable_recursion_limit();
    let parsed: Value = serde::Deserialize::deserialize(&mut reader)
        .unwrap_or_else(|e| panic!("parse fixture {:?}: {}", path, e));
    parsed
}

/// The JSON value of a value in the case form.
pub fn case_value(value: &Value) -> Value {
    let kind = value
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("no value kind in {value}"));
    let inner = || {
        value
            .get("value")
            .unwrap_or_else(|| panic!("no value in {value}"))
    };
    match kind {
        "null" => Value::Null,
        "bool" => Value::Bool(
            inner()
                .as_bool()
                .unwrap_or_else(|| panic!("a bool value is no boolean: {value}")),
        ),
        "number" => {
            let literal = inner()
                .as_str()
                .unwrap_or_else(|| panic!("a number value is no literal: {value}"));
            serde_json::from_str(literal)
                .unwrap_or_else(|e| panic!("number literal {literal}: {e}"))
        }
        "text" => Value::String(
            inner()
                .as_str()
                .unwrap_or_else(|| panic!("a text value is no text: {value}"))
                .to_owned(),
        ),
        "list" => Value::Array(
            inner()
                .as_array()
                .unwrap_or_else(|| panic!("a list value is no array: {value}"))
                .iter()
                .map(case_value)
                .collect(),
        ),
        "map" => {
            let mut members = Map::new();
            for pair in inner()
                .as_array()
                .unwrap_or_else(|| panic!("a map value is no array: {value}"))
            {
                let name = pair[0]
                    .as_str()
                    .unwrap_or_else(|| panic!("a member name is no text: {pair}"));
                members.insert(name.to_owned(), case_value(&pair[1]));
            }
            Value::Object(members)
        }
        other => panic!("unknown value kind {other}"),
    }
}

/// The argument `name` of a case, decoded; none when the case does not give it.
pub fn case_argument(case: &Value, name: &str) -> Option<Value> {
    case.get(name).map(case_value)
}

/// The composition files of the options of a case, decoded.
pub fn case_files(case: &Value) -> Option<Map<String, Value>> {
    let files = case.get("options")?.get("files")?.as_object()?;
    Some(
        files
            .iter()
            .map(|(name, file)| (name.clone(), case_value(file)))
            .collect(),
    )
}

/// The code of the failure that a case raises: its kind in capitals, as the load and input failures name it.
pub fn raised_code(case: &Value) -> Option<String> {
    Some(case.get("raises")?.get("kind")?.as_str()?.to_uppercase())
}
