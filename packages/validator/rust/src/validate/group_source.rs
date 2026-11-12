//! Choices from a repeated group (schema.md, "Choices from a repeated group").
//!
//! A choice field whose `items` is a group source `{ from, label? }` takes its choices from
//! the rows of a repeated group of the same form. This module checks the declaration and
//! reads the choices from the data; the generator lists them and the validator checks a
//! value against them (validation-rules.md, "Values").

use serde_json::{Map, Value};
use std::collections::HashSet;

use super::canonical::canonical_text;
use super::whitespace::trim;

/// The field types that take a group source.
const CHOICE_TYPES: [&str; 8] = [
    "select",
    "dropdown",
    "selectbox",
    "choice",
    "radio",
    "multichoice",
    "checkboxes",
    "checkcontainer",
];

/// One choice of a group source: the canonical text of a row's value and its label text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GroupChoice {
    /// The canonical text of the row's value field.
    pub value: String,
    /// The declared label of a literal choice (CUSC-089), or the canonical text of the row's label
    /// field, or the value when it gives none.
    pub label: Value,
}

/// Why the choices of a group source could not be read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GroupChoicesError {
    /// The source breaks a rule of its declaration, with the message of that refusal.
    Declaration(String),
    /// A row's value repeats a literal choice (CUSC-089), with the message that names its path and value.
    Repeated(String),
}

/// The literal choices of a group source (CUSC-089), each with the canonical text of its value, or
/// `None` when `choices` is not a list of `{value, label}` pairs whose values are strings or
/// finite numbers with distinct canonical texts that are not empty after trimming.
fn literal_choices(choices: Option<&Value>) -> Option<Vec<GroupChoice>> {
    let Some(choices) = choices else {
        return Some(Vec::new());
    };
    let mut literal: Vec<GroupChoice> = Vec::new();
    for choice in choices.as_array()? {
        let choice = choice.as_object()?;
        if choice.len() != 2 || !choice.contains_key("label") {
            return None;
        }
        let value = choice_text(choice.get("value"))?;
        if literal.iter().any(|known| known.value == value) {
            return None;
        }
        literal.push(GroupChoice {
            value,
            label: choice["label"].clone(),
        });
    }
    Some(literal)
}

/// Whether `items` is a group source: an object with the member `from`.
pub fn is_group_source(items: &Value) -> bool {
    items
        .as_object()
        .is_some_and(|members| members.contains_key("from"))
}

/// Whether a field repeats: `multiple` is `true`, `only` or a settings object.
fn repeated(field: &Value) -> bool {
    matches!(
        field.get("multiple"),
        Some(Value::Bool(true)) | Some(Value::Object(_))
    ) || field.get("multiple").and_then(Value::as_str) == Some("only")
}

/// Whether a field declares a language: `lang` is `true` or an object.
fn has_lang(field: &Value) -> bool {
    matches!(
        field.get("lang"),
        Some(Value::Bool(true)) | Some(Value::Object(_))
    )
}

/// Whether `child` renders one scalar value: an object whose type is not `group`, that has no
/// `properties` member, is not repeated and has no `lang`.
pub fn scalar_child(child: &Value) -> bool {
    child.is_object()
        && child
            .get("type")
            .is_none_or(|kind| kind.as_str() != Some("group"))
        && child.get("properties").is_none()
        && !repeated(child)
        && !has_lang(child)
}

/// The properties of the repeated group that `from` names under the root `properties`, when
/// `from` is `{group}.*.{field}` with `field` a scalar child of that group, every group of the
/// path a group field with properties, and only the last one repeated.
fn source_group<'a>(from: &str, root: &'a Map<String, Value>) -> Option<&'a Map<String, Value>> {
    let segments: Vec<&str> = from.split('.').collect();
    let count = segments.len();
    if count < 3 || segments[count - 2] != "*" {
        return None;
    }
    let names = &segments[..count - 2];
    let mut current = root;
    for (index, name) in names.iter().enumerate() {
        let field = current.get(*name)?;
        if field.get("type").and_then(Value::as_str) != Some("group") {
            return None;
        }
        let properties = field.get("properties").and_then(Value::as_object)?;
        if repeated(field) != (index == names.len() - 1) {
            return None;
        }
        current = properties;
    }
    current
        .get(segments[count - 1])
        .filter(|child| scalar_child(child))
        .map(|_| current)
}

/// The message of the expected `from` of a group source, the same for every rule it breaks.
fn from_message(path: &str) -> String {
    format!(
        "Invalid items.from at {path}: expected {{group}}.*.{{field}} for a field of a repeated group outside repeated groups"
    )
}

/// The message of a `label` that is not a scalar child of its group.
fn label_message(path: &str) -> String {
    format!(
        "Invalid items.label at {path}: expected the name of a direct child field of the group without multiple, properties or lang"
    )
}

/// The field types whose stored value is a boolean, which a group source refuses (CUSC-068).
const BOOLEAN_TYPES: [&str; 2] = ["checkbox", "switcher"];

/// Whether the scalar child `name` of a group is of a type that stores a boolean.
fn holds_boolean(group: &Map<String, Value>, name: &str) -> bool {
    group
        .get(name)
        .and_then(|child| child.get("type"))
        .and_then(Value::as_str)
        .is_some_and(|kind| BOOLEAN_TYPES.contains(&kind))
}

/// The message of a group source whose `member` names the field `field` that holds a boolean
/// (CUSC-068).
fn boolean_message(member: &str, path: &str, field: &str) -> String {
    format!(
        "Invalid items.{member} at {path}: {field} holds a boolean, expected a field whose values are strings or numbers"
    )
}

/// The message of the first rule that the group source of `field` at the declaration `path`
/// breaks under the root `properties`, or `None`. The members of `items` are checked in
/// declaration order, then the field, then `from`, the type of its field, `label` and then the
/// type of its field.
pub fn group_source_failure(
    field: &Value,
    path: &str,
    root: &Map<String, Value>,
) -> Option<String> {
    let items = field.get("items").filter(|items| is_group_source(items))?;
    let members = items.as_object()?;
    if let Some(key) = members
        .keys()
        .find(|key| *key != "from" && *key != "label" && *key != "choices")
    {
        return Some(format!("Invalid items.{key} at {path}: unknown key"));
    }
    let is_choice = field
        .get("type")
        .and_then(Value::as_str)
        .is_some_and(|kind| CHOICE_TYPES.contains(&kind));
    if !is_choice || has_lang(field) {
        return Some(format!(
            "Invalid items.from at {path}: expected a choice field without lang"
        ));
    }
    let from = members.get("from").and_then(Value::as_str);
    let Some((from, group)) =
        from.and_then(|from| source_group(from, root).map(|group| (from, group)))
    else {
        return Some(from_message(path));
    };
    let segments: Vec<&str> = from.split('.').collect();
    let group_path = segments[..segments.len() - 2].join(".");
    let value_name = segments[segments.len() - 1];
    if holds_boolean(group, value_name) {
        return Some(boolean_message(
            "from",
            path,
            &format!("{group_path}.{value_name}"),
        ));
    }
    if let Some(label) = members.get("label") {
        match label.as_str() {
            Some(name) if group.get(name).is_some_and(scalar_child) => {
                if holds_boolean(group, name) {
                    return Some(boolean_message(
                        "label",
                        path,
                        &format!("{group_path}.{name}"),
                    ));
                }
            }
            _ => return Some(label_message(path)),
        }
    }
    literal_choices(members.get("choices"))
        .is_none()
        .then(|| choices_message(path))
}

fn choices_message(path: &str) -> String {
    format!("Invalid items.choices at {path}: expected value and label pairs with distinct string or number values")
}

/// The canonical text of a string or a number whose text is not empty after trimming.
fn choice_text(value: Option<&Value>) -> Option<String> {
    let value = value.filter(|value| value.is_string() || value.is_number())?;
    let text = canonical_text(value)?;
    if trim(&text).is_empty() {
        None
    } else {
        Some(text.into_owned())
    }
}

/// The choices of a group source for the root `data`: one per row of the group in data order
/// whose value gives a non-empty canonical text, each value once, labelled with the text of its
/// `label` field or else its value. A group missing from the data gives no choices.
///
/// `items` must have passed [`group_source_failure`]; a source whose `from` or `label` is not
/// of the declared shape gives the message of its declaration failure, located at `path`.
pub fn group_choices(
    items: &Value,
    data: &Value,
    path: &str,
) -> Result<Vec<GroupChoice>, GroupChoicesError> {
    let declaration = |message: String| GroupChoicesError::Declaration(message);
    let members = items
        .as_object()
        .ok_or_else(|| declaration(from_message(path)))?;
    let from = members
        .get("from")
        .and_then(Value::as_str)
        .ok_or_else(|| declaration(from_message(path)))?;
    let segments: Vec<&str> = from.split('.').collect();
    let count = segments.len();
    if count < 3 || segments[count - 2] != "*" {
        return Err(declaration(from_message(path)));
    }
    let label_name = match members.get("label") {
        None => None,
        Some(Value::String(name)) => Some(name.as_str()),
        Some(_) => return Err(declaration(label_message(path))),
    };
    let literal = literal_choices(members.get("choices"))
        .ok_or_else(|| declaration(choices_message(path)))?;
    if let Some(repeat) = first_repeat(items, data, false) {
        return Err(GroupChoicesError::Repeated(repeat));
    }
    let value_name = segments[count - 1];
    let Some(rows) = source_rows(&segments, data) else {
        return Ok(literal);
    };
    let mut choices = literal;
    let mut seen = HashSet::new();
    for row in rows.values() {
        let Some(row) = row.as_object() else {
            continue;
        };
        let Some(value) = choice_text(row.get(value_name)) else {
            continue;
        };
        if !seen.insert(value.clone()) {
            continue;
        }
        #[allow(
            clippy::disallowed_methods,
            reason = "CUSC-063: a choice whose row has no label text is labelled by its value"
        )]
        let label = label_name
            .and_then(|name| choice_text(row.get(name)))
            .unwrap_or_else(|| value.clone());
        choices.push(GroupChoice {
            value,
            label: Value::String(label),
        });
    }
    Ok(choices)
}

/// The rows of the group that the `from` path `segments` name in the root `data`, by row key in
/// data order, when the group has object data.
fn source_rows<'a>(segments: &[&str], data: &'a Value) -> Option<&'a Map<String, Value>> {
    let mut rows = data;
    for name in &segments[..segments.len() - 2] {
        rows = rows.as_object()?.get(*name)?;
    }
    rows.as_object()
}

/// The input failure message of the first row of a checked group source, in data order, whose
/// choice value repeats a literal choice (CUSC-089) or that of an earlier row (CUVR-087), or
/// `None`. A source whose `from` is not of the declared shape has no rows.
pub fn group_source_repeat(items: &Value, data: &Value) -> Option<String> {
    first_repeat(items, data, true)
}

/// The message of the first row whose choice value is a literal choice or, with `rows`, the value
/// of an earlier row.
fn first_repeat(items: &Value, data: &Value, rows: bool) -> Option<String> {
    let from = items.get("from").and_then(Value::as_str)?;
    #[allow(
        clippy::disallowed_methods,
        reason = "CUSC-089: a group source without choices has no literal choice"
    )]
    let literal = literal_choices(items.get("choices")).unwrap_or_default();
    let segments: Vec<&str> = from.split('.').collect();
    if segments.len() < 3 {
        return None;
    }
    let group_path = segments[..segments.len() - 2].join(".");
    let value_name = segments[segments.len() - 1];
    let mut seen = HashSet::new();
    for (key, row) in source_rows(&segments, data)? {
        let Some(value) = choice_text(row.as_object().and_then(|row| row.get(value_name))) else {
            continue;
        };
        if literal.iter().any(|choice| choice.value == value) {
            return Some(format!(
                "Group source value repeats a literal choice at {group_path}.{key}.{value_name}: {value}"
            ));
        }
        if !seen.insert(value.clone()) && rows {
            return Some(format!(
                "Group source value repeats an earlier row: {value} at {group_path}.{key}.{value_name}"
            ));
        }
    }
    None
}
