pub(crate) use crate::css::style_string as style;
use polyspec_crud_ui_validator::validate::canonical::{json_number, number_text};
use serde_json::{Map, Value};

/// The text of a template, specification or view-model member read as text.
///
/// CURP-024: templates and view models are JSON shared by every runtime, and each runtime writes a
/// member that is absent or not text as no text. Every such read goes through this one rule; the
/// typed models that replace the JSON reads remove it.
pub(crate) trait OrNoText<'a> {
    /// The text, or the empty text for an absent member or a member that is not text.
    fn or_no_text(self) -> &'a str;
}

impl<'a> OrNoText<'a> for Option<&'a str> {
    #[allow(
        clippy::disallowed_methods,
        reason = "CURP-024: an absent or non-text member of a JSON model is no text"
    )]
    fn or_no_text(self) -> &'a str {
        self.unwrap_or("")
    }
}

/// The items of a JSON model member read as a list; CURP-024: an absent member or a member that
/// is not a list has no items.
pub(crate) trait OrNoList<'a> {
    /// The items, or none for an absent member or a member that is not a list.
    fn or_no_list(self) -> &'a [Value];
}

impl<'a> OrNoList<'a> for Option<&'a Vec<Value>> {
    fn or_no_list(self) -> &'a [Value] {
        match self {
            Some(items) => items,
            None => &[],
        }
    }
}

/// The members of a JSON model member read as an object; CURP-024: an absent member or a member
/// that is not an object has no members.
pub(crate) trait OrNoMembers {
    /// The members, or none for an absent member or a member that is not an object.
    fn or_no_members(self) -> Map<String, Value>;
}

impl OrNoMembers for Option<Map<String, Value>> {
    fn or_no_members(self) -> Map<String, Value> {
        match self {
            Some(members) => members,
            None => Map::new(),
        }
    }
}

/// The members of a `json!` object literal, which is always an object.
pub(crate) fn literal_members(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(members) => members,
        // `json!({ … })` builds an object, so no other value reaches here.
        _ => Map::new(),
    }
}

/// The text of a JSON number: the double that ECMAScript reads for it, as `Number::toString`
/// writes it (CURP-028), so an integer beyond 2^53 is written as its nearest double.
fn number_string(number: &serde_json::Number) -> String {
    number_text(json_number(number))
}

/// The JSON text of a value as ECMAScript `JSON.stringify` writes it (CUMK-066): members in order,
/// no whitespace, each string as the string token of polyspec-json and each number as its double
/// (CURP-028); the tokens are those of the serializer of polyspec-json (C-1).
pub(crate) fn json_text(value: &Value) -> String {
    let mut out = String::new();
    write_json(&mut out, value);
    out
}

/// The JSON text of a value as ECMAScript `JSON.stringify(value, null, 2)` writes it (CUMK-071): the
/// tokens of [`json_text`], each item and member on its own line indented by two spaces per level,
/// `": "` after a member name, and `[]` and `{}` for an empty array and object.
pub(crate) fn pretty_json_text(value: &Value) -> String {
    let mut out = String::new();
    write_pretty(&mut out, value, 0);
    out
}

fn write_pretty(out: &mut String, value: &Value, level: usize) {
    let indent = |out: &mut String, level: usize| {
        out.push('\n');
        out.push_str(&"  ".repeat(level));
    };
    match value {
        Value::Array(items) if !items.is_empty() => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                indent(out, level + 1);
                write_pretty(out, item, level + 1);
            }
            indent(out, level);
            out.push(']');
        }
        Value::Object(members) if !members.is_empty() => {
            out.push('{');
            for (index, (key, member)) in members.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                indent(out, level + 1);
                out.push_str(&string_token(key));
                out.push_str(": ");
                write_pretty(out, member, level + 1);
            }
            indent(out, level);
            out.push('}');
        }
        other => write_json(out, other),
    }
}

/// The string token of a text, as polyspec-json writes it.
pub(crate) fn string_token(text: &str) -> String {
    polyspec_json::Value::string(text).raw().to_owned()
}

/// Write the JSON text of a value; see [`json_text`].
fn write_json(out: &mut String, value: &Value) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Number(n) => out.push_str(&number_string(n)),
        Value::String(text) => out.push_str(&string_token(text)),
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_json(out, item);
            }
            out.push(']');
        }
        Value::Object(members) => {
            out.push('{');
            for (index, (key, member)) in members.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&string_token(key));
                out.push(':');
                write_json(out, member);
            }
            out.push('}');
        }
    }
}

pub(crate) fn scalar(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(true)) => "1".into(),
        Some(Value::Number(n)) => number_string(n),
        _ => String::new(),
    }
}

/// The condition text of a condition field value (docs/spec/form-markup.md, Condition fields): a
/// string is itself, null and an absent value are empty, and any other value is the JSON text that
/// ECMAScript's `JSON.stringify` writes for it.
pub(crate) fn condition_text(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(other) => json_text(other),
    }
}

pub(crate) fn js_string(value: &Value) -> String {
    match value {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => number_string(n),
        Value::String(s) => s.clone(),
        Value::Array(a) => a
            .iter()
            .map(|v| {
                if v.is_null() {
                    String::new()
                } else {
                    js_string(v)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

pub(crate) fn default_string(value: Option<&Value>, spec: &Value) -> String {
    scalar(value.or_else(|| spec.get("default")))
}

pub(crate) fn join_class(parts: &[&str]) -> String {
    parts
        .iter()
        .flat_map(|s| s.split_whitespace())
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn segments(path: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut bracket = false;
    for character in path.chars() {
        if (character == '[' && !bracket)
            || (character == ']' && bracket)
            || (character == '.' && !bracket)
        {
            if !current.is_empty() {
                result.push(std::mem::take(&mut current));
            }
            if character == '[' {
                bracket = true;
            }
            if character == ']' {
                bracket = false;
            }
        } else {
            current.push(character);
        }
    }
    if !current.is_empty() {
        result.push(current);
    }
    result
}

/// The index that a path segment names in a list: decimal digits without a sign or a leading
/// zero (CURT-093); `None` for any other segment and for an index beyond `usize`.
fn list_index(segment: &str) -> Option<usize> {
    let canonical = !segment.is_empty()
        && segment.bytes().all(|byte| byte.is_ascii_digit())
        && (segment == "0" || !segment.starts_with('0'));
    if !canonical {
        return None;
    }
    // Digits beyond usize name no item of any list.
    segment.bytes().try_fold(0usize, |index, digit| {
        index
            .checked_mul(10)?
            .checked_add(usize::from(digit - b'0'))
    })
}

/// The value at a data path (CURT-093), or `None` when the data holds no value there.
pub(crate) fn value_at<'a>(data: &'a Value, path: &str) -> Option<&'a Value> {
    let mut value = data;
    for segment in segments(path) {
        let key = segment.as_str();
        value = match value {
            Value::Object(map) => map.get(key)?,
            // CURT-093: an item is named by its index in decimal without a sign or a leading zero; any
            // other segment names no item, so the path has no value.
            Value::Array(list) => list.get(list_index(key)?)?,
            _ => return None,
        };
    }
    Some(value)
}

pub(crate) fn bracket(path: &str, prefix: Option<&str>) -> String {
    let mut parts = segments(path);
    if let Some(prefix) = prefix.filter(|s| !s.is_empty()) {
        parts.insert(0, prefix.into());
    }
    let Some((head, tail)) = parts.split_first() else {
        return String::new();
    };
    head.clone() + &tail.iter().map(|s| format!("[{s}]")).collect::<String>()
}

pub(crate) fn rule_name(path: &str, rows: &[usize]) -> String {
    let parts = segments(path);
    let suffix = if path.ends_with("[]") { "[]" } else { "" };
    let Some((head, tail)) = parts.split_first() else {
        return suffix.into();
    };
    head.clone()
        + &tail
            .iter()
            .enumerate()
            .map(|(i, s)| {
                if rows.contains(&(i + 1)) {
                    "[]".into()
                } else {
                    format!("[{s}]")
                }
            })
            .collect::<String>()
        + suffix
}

pub(crate) fn leaf_name(path: &str, rows: &[usize]) -> String {
    let parts = segments(path);
    let Some(last) = parts.last() else {
        return path.into();
    };
    if rows.contains(&(parts.len() - 1)) {
        format!(
            "{}[]",
            parts
                .get(parts.len().wrapping_sub(2))
                .map(String::as_str)
                .or_no_text()
        )
    } else {
        last.clone() + if path.ends_with("[]") { "[]" } else { "" }
    }
}

fn encode_component(value: &str) -> String {
    let mut out = String::new();
    for b in value.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

pub(crate) fn control_id(prefix: &str, path: &str) -> String {
    format!("{}:{}", encode_component(prefix), encode_component(path))
}

pub(crate) fn translate(value: Option<&Value>, language: &str) -> String {
    match value {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Object(map)) => {
            for key in [language, "en", "ko"]
                .into_iter()
                .chain(map.keys().next().map(String::as_str))
            {
                if let Some(Value::String(s)) = map.get(key) {
                    if !s.is_empty() {
                        return s.clone();
                    }
                }
            }
            String::new()
        }
        _ => String::new(),
    }
}

pub(crate) fn put_string(map: &mut Map<String, Value>, key: &str, value: impl Into<String>) {
    map.insert(key.into(), Value::String(value.into()));
}

pub(crate) fn put_nonempty(map: &mut Map<String, Value>, key: &str, value: String) {
    if !value.is_empty() {
        put_string(map, key, value);
    }
}
